import { getConnection } from '../config/database.js';
import { getIo } from '../utils/socketManager.js';
import logger from '../utils/logger.js';
import { calcularKmRecorridos } from '../utils/distanciaHelper.js';

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
     * Snapshot inicial para cuando un supervisor abre "Hoy en Vivo": el estado
     * del día de cada muestreador que inició al menos una jornada hoy (activa
     * O ya finalizada — un muestreador que terminó su ruta sigue visible con
     * estado "finalizada" y su resumen del día, no desaparece del mapa/lista),
     * su última posición conocida, y las fichas agendadas del día (fecha_
     * muestreo o fecha_retiro = hoy), ordenadas por hora. Todo en la misma BD
     * compartida que usa la app móvil (mam_jornadas / mam_ubicaciones_tracking
     * vienen de la fase 1 de api-app-mam; App_Ma_Agenda_MUESTREOS es la tabla
     * existente de ADL ONE).
     *
     * Un muestreador puede tener MÁS DE UNA jornada hoy (p.ej. cortó para
     * almorzar y volvió a tocar "Iniciar Ruta"): se agrupan todas sus
     * jornadas de hoy en una sola entrada, sumando horas/km de cada tramo por
     * separado — así una pausa entre jornadas nunca se cuenta como distancia
     * recorrida.
     */
    async getSnapshotHoy() {
        const pool = await getConnection();

        const jornadas = await pool.request().query(`
            SELECT
                j.id_jornada,
                j.id_muestreador,
                j.fecha_inicio,
                j.fecha_fin,
                j.motivo_fin,
                j.bateria_inicio,
                j.bateria_fin,
                m.nombre_muestreador
            FROM mam_jornadas j
            INNER JOIN mae_muestreador m ON m.id_muestreador = j.id_muestreador
            WHERE CAST(j.fecha_inicio AS DATE) = CAST(GETDATE() AS DATE)
            ORDER BY j.id_muestreador, j.fecha_inicio ASC
        `);

        if (jornadas.recordset.length === 0) {
            return { jornadas: [] };
        }

        const idsJornada = jornadas.recordset.map(j => j.id_jornada);
        const idsMuestreador = [...new Set(jornadas.recordset.map(j => Number(j.id_muestreador)))];

        // Jornadas de hoy agrupadas por muestreador — base para agregar
        // horas/km/estado/última posición por persona en vez de por jornada.
        const jornadasPorMuestreador = new Map();
        for (const j of jornadas.recordset) {
            const idM = Number(j.id_muestreador);
            if (!jornadasPorMuestreador.has(idM)) jornadasPorMuestreador.set(idM, []);
            jornadasPorMuestreador.get(idM).push(j);
        }

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

        // Historial completo de puntos por jornada (no solo el último), para
        // sumar km recorridos con Haversine. Consulta aparte de
        // ultimasPosiciones a propósito: son dos formas distintas de leer la
        // misma tabla y mezclarlas complicaría esa query ya probada en
        // producción sin necesidad real.
        const todosLosPuntos = await pool.request().query(`
            SELECT id_jornada, latitud, longitud
            FROM mam_ubicaciones_tracking
            WHERE id_jornada IN (${idsJornada.join(',')})
            ORDER BY id_jornada, timestamp_reporte ASC
        `);
        const puntosPorJornada = new Map();
        for (const p of todosLosPuntos.recordset) {
            const idJornada = Number(p.id_jornada);
            if (!puntosPorJornada.has(idJornada)) puntosPorJornada.set(idJornada, []);
            puntosPorJornada.get(idJornada).push({ lat: Number(p.latitud), lon: Number(p.longitud) });
        }

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
                a.instalacion_hora_inicio_trabajo,
                a.instalacion_hora_fin_trabajo,
                a.retiro_hora_inicio_trabajo,
                a.retiro_hora_fin_trabajo,
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

        // Tiempo de trabajo en terreno (diagnóstico — ver migración
        // add_tiempo_trabajo_ficha.sql en api-app-mam): usa el par retiro si
        // esa visita llegó a registrar su propio inicio (fase 'término' real,
        // no Puntual de proceso único), si no cae al par instalación — que es
        // también donde queda el único inicio registrado para una ficha
        // Puntual, aunque ambos *_hora_fin_trabajo se marquen juntos.
        for (const ficha of fichasHoy.recordset) {
            const inicio = ficha.retiro_hora_inicio_trabajo || ficha.instalacion_hora_inicio_trabajo;
            const fin = ficha.retiro_hora_inicio_trabajo ? ficha.retiro_hora_fin_trabajo : ficha.instalacion_hora_fin_trabajo;
            const minutos = (inicio && fin) ? Math.round((new Date(fin).getTime() - new Date(inicio).getTime()) / 60000) : null;
            ficha.tiempo_trabajo_minutos = (minutos != null && minutos >= 0) ? minutos : null;
        }

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

        const resultado = [...jornadasPorMuestreador.entries()].map(([idMuestreador, jornadasDelDia]) => {
            // Representativa para efectos de matching con el socket
            // (posicion_actualizada llega taggeada con el id_jornada REAL y
            // activo) y de "hora de inicio": la más reciente de hoy — si hay
            // una activa, es esa; si todas están cerradas, es el último tramo.
            const jornadaMasReciente = jornadasDelDia[jornadasDelDia.length - 1];
            const activa = jornadasDelDia.find(j => j.fecha_fin === null);
            // 'pausada': ninguna jornada activa, pero la más reciente se cerró
            // con motivo_fin='pausa' (el muestreador tocó "Pausar", no
            // "Terminar") — jornadas de antes de la migración tienen
            // motivo_fin NULL y caen en 'finalizada', que es el comportamiento
            // previo.
            const estado = activa
                ? 'en_ruta'
                : (jornadaMasReciente.motivo_fin === 'pausa' ? 'pausada' : 'finalizada');

            let horasTrabajadasMinutos = 0;
            let kmRecorridos = 0;
            let ultimaPosicion = null;
            let ultimoTimestamp = null;

            for (const j of jornadasDelDia) {
                const idJornada = Number(j.id_jornada);
                const finTramo = j.fecha_fin ? new Date(j.fecha_fin).getTime() : Date.now();
                // Math.max(0, ...) por tramo: un reloj de dispositivo desfasado
                // (o datos de prueba manuales) podría producir un fecha_fin
                // anterior a fecha_inicio — mejor mostrar 0 minutos para ese
                // tramo que un total negativo sin sentido para el supervisor.
                horasTrabajadasMinutos += Math.max(0, Math.round((finTramo - new Date(j.fecha_inicio).getTime()) / 60000));
                kmRecorridos += calcularKmRecorridos(puntosPorJornada.get(idJornada) || []);

                const posicionTramo = posicionPorJornada.get(idJornada);
                if (posicionTramo) {
                    const ts = new Date(posicionTramo.timestamp_reporte).getTime();
                    if (ultimoTimestamp === null || ts > ultimoTimestamp) {
                        ultimoTimestamp = ts;
                        ultimaPosicion = posicionTramo;
                    }
                }
            }

            return {
                id_jornada: Number(jornadaMasReciente.id_jornada),
                id_muestreador: idMuestreador,
                nombre_muestreador: jornadaMasReciente.nombre_muestreador,
                fecha_inicio: jornadasDelDia[0].fecha_inicio,
                fecha_fin: activa ? null : jornadaMasReciente.fecha_fin,
                estado,
                horas_trabajadas_minutos: horasTrabajadasMinutos,
                km_recorridos: Math.round(kmRecorridos * 100) / 100,
                // Batería al primer inicio del día y en el tramo más reciente
                // (activo o no) — no tiene sentido sumarla como horas/km,
                // es un nivel puntual, no una cantidad acumulable.
                bateria_inicio: jornadasDelDia[0].bateria_inicio,
                bateria_fin: jornadaMasReciente.bateria_fin,
                ultima_posicion: ultimaPosicion,
                fichas_hoy: fichasPorMuestreador.get(idMuestreador) || [],
            };
        });

        return { jornadas: resultado };
    }
}

export default new TrackingService();
