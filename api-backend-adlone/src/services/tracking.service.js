import { getConnection } from '../config/database.js';
import { getIo } from '../utils/socketManager.js';
import logger from '../utils/logger.js';

export const TRACKING_ROOM = 'hoy_en_vivo';

class TrackingService {
    /**
     * Recibe una posición ya persistida por api-app-mam (esta capa NO escribe
     * en mam_ubicaciones_tracking — esa tabla vive en la misma BD compartida y
     * ya fue insertada por el lado app-mam antes de reenviar). Su único trabajo
     * es difundirla en tiempo real a los supervisores conectados.
     */
    broadcastPosicion({ id_muestreador, id_jornada, lat, lon, timestamp }) {
        const payload = {
            id_muestreador: Number(id_muestreador),
            id_jornada: Number(id_jornada),
            lat: Number(lat),
            lon: Number(lon),
            timestamp,
        };
        getIo().to(TRACKING_ROOM).emit('posicion_actualizada', payload);
        logger.info(`[Tracking] Posición difundida: muestreador ${payload.id_muestreador}, jornada ${payload.id_jornada}`);
        return payload;
    }

    /**
     * Snapshot inicial para cuando un supervisor abre "Hoy en Vivo": jornadas
     * activas de hoy, su última posición conocida, y las fichas agendadas del
     * día (fecha_muestreo o fecha_retiro = hoy) para cada muestreador con
     * jornada activa, ordenadas por hora. Todo en la misma BD compartida que
     * usa la app móvil (mam_jornadas / mam_ubicaciones_tracking vienen de la
     * fase 1 de api-app-mam; App_Ma_Agenda_MUESTREOS es la tabla existente de
     * ADL ONE).
     */
    async getSnapshotHoy() {
        const pool = await getConnection();

        const jornadas = await pool.request().query(`
            SELECT
                j.id_jornada,
                j.id_muestreador,
                j.fecha_inicio,
                m.nombre_muestreador
            FROM mam_jornadas j
            INNER JOIN mae_muestreador m ON m.id_muestreador = j.id_muestreador
            WHERE j.fecha_fin IS NULL
            ORDER BY j.fecha_inicio ASC
        `);

        if (jornadas.recordset.length === 0) {
            return { jornadas: [] };
        }

        const idsJornada = jornadas.recordset.map(j => j.id_jornada);
        const idsMuestreador = jornadas.recordset.map(j => j.id_muestreador);

        // Última posición conocida por jornada (una fila por jornada activa).
        // Se ordena por timestamp_reporte, NO por id_ubicacion: la app móvil
        // encola posiciones offline y las sube en lote al reconectar, así que
        // un punto con timestamp más antiguo puede insertarse DESPUÉS (con un
        // id_ubicacion mayor) que uno más reciente. Usar MAX(id_ubicacion)
        // mostraría posiciones desactualizadas al supervisor tras cualquier
        // reconexión con puntos en cola.
        const ultimasPosiciones = await pool.request().query(`
            SELECT id_jornada, latitud, longitud, timestamp_reporte
            FROM (
                SELECT
                    id_jornada, latitud, longitud, timestamp_reporte,
                    ROW_NUMBER() OVER (PARTITION BY id_jornada ORDER BY timestamp_reporte DESC) AS rn
                FROM mam_ubicaciones_tracking
                WHERE id_jornada IN (${idsJornada.join(',')})
            ) ultimo
            WHERE rn = 1
        `);
        const posicionPorJornada = new Map(
            ultimasPosiciones.recordset.map(p => [Number(p.id_jornada), p])
        );

        // Fichas agendadas hoy (muestreo o retiro) para los muestreadores con
        // jornada activa — cubre tanto el primer muestreador como el de retiro.
        // El JOIN a App_Ma_FichaIngresoServicio_ENC (y de ahí a empresa/centro/
        // objetivo) sigue el mismo patrón ya usado en ficha.service.js — es LEFT
        // JOIN a propósito: un registro de agenda sin ficha ENC asociada todavía
        // no debe desaparecer del mapa, solo mostrar esos datos vacíos.
        const fichasHoy = await pool.request().query(`
            SELECT
                a.id_agendamam,
                a.frecuencia_correlativo,
                a.id_muestreador,
                a.id_muestreador2,
                a.fecha_muestreo,
                a.fecha_retiro,
                a.hora_coordinador,
                a.estado_caso,
                a.instalacion_completado,
                a.retiro_completado,
                a.id_estadomuestreo,
                c.nombre_empresa AS empresa,
                ce.nombre_centro AS centro,
                o.nombre_objetivomuestreo_ma AS objetivo
            FROM App_Ma_Agenda_MUESTREOS a
            LEFT JOIN App_Ma_FichaIngresoServicio_ENC f ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
            LEFT JOIN mae_empresa c ON f.id_empresa = c.id_empresa
            LEFT JOIN mae_centro ce ON f.id_centro = ce.id_centro
            LEFT JOIN mae_objetivomuestreo_ma o ON f.id_objetivomuestreo_ma = o.id_objetivomuestreo_ma
            WHERE (a.id_muestreador IN (${idsMuestreador.join(',')}) OR a.id_muestreador2 IN (${idsMuestreador.join(',')}))
              AND (a.fecha_muestreo = CAST(GETDATE() AS DATE) OR a.fecha_retiro = CAST(GETDATE() AS DATE))
              AND (a.estado_caso IS NULL OR a.estado_caso <> 'CANCELADO')
            ORDER BY a.fecha_muestreo ASC, a.hora_coordinador ASC
        `);

        const fichasPorMuestreador = new Map();
        for (const ficha of fichasHoy.recordset) {
            // Set, no array: en una ficha Puntual de proceso único,
            // id_muestreador e id_muestreador2 son la MISMA persona (instalación
            // y retiro el mismo día, mismo muestreador). Sin deduplicar, la
            // ficha se empujaba dos veces al mismo arreglo y el correlativo
            // aparecía repetido en el itinerario del supervisor.
            const idsUnicos = new Set(
                [Number(ficha.id_muestreador), Number(ficha.id_muestreador2)]
                    .filter((id) => Number.isFinite(id) && id > 0)
            );
            for (const idMuestreador of idsUnicos) {
                if (!fichasPorMuestreador.has(idMuestreador)) fichasPorMuestreador.set(idMuestreador, []);
                fichasPorMuestreador.get(idMuestreador).push(ficha);
            }
        }

        const resultado = jornadas.recordset.map(j => {
            const idJornada = Number(j.id_jornada);
            const idMuestreador = Number(j.id_muestreador);
            return {
                id_jornada: idJornada,
                id_muestreador: idMuestreador,
                nombre_muestreador: j.nombre_muestreador,
                fecha_inicio: j.fecha_inicio,
                ultima_posicion: posicionPorJornada.get(idJornada) || null,
                fichas_hoy: fichasPorMuestreador.get(idMuestreador) || [],
            };
        });

        return { jornadas: resultado };
    }
}

export default new TrackingService();
