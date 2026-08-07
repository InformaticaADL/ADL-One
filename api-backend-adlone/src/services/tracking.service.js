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
     * Recibe el aviso de api-app-mam de que un muestreador inició una
     * jornada NUEVA y lo difunde a los supervisores conectados. A
     * diferencia de broadcastPosicion (que solo actualiza un campo de una
     * jornada que el frontend YA tiene en su lista), esto puede ser un
     * muestreador que el snapshot inicial nunca cargó — el frontend
     * reacciona pidiendo el snapshot completo de nuevo (ver trackingStore.ts),
     * no intentando reconstruir la jornada a mano con este payload parcial.
     */
    broadcastJornadaIniciada({ id_muestreador, nombre_muestreador, id_jornada, fecha_inicio }) {
        const payload = {
            id_muestreador: Number(id_muestreador),
            nombre_muestreador,
            id_jornada: Number(id_jornada),
            fecha_inicio,
        };
        getIo().to(TRACKING_ROOM).emit('jornada_iniciada', payload);
        logger.info(`[Tracking] Jornada iniciada difundida: muestreador ${payload.id_muestreador} (${nombre_muestreador})`);
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
                f.id_objetivomuestreo_ma,
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

        // Tiempo estimado por objetivo de muestreo: promedio histórico del
        // tiempo real ya medido (mismo cálculo instalación/retiro de arriba)
        // en TODA la base, no solo hoy — mientras más fichas se completen con
        // tiempo por ficha activo, más preciso se vuelve solo. HAVING >= 3
        // evita mostrar un "estimado" basado en 1-2 muestras, que sería más
        // ruido que señal.
        // El CASE de "duracion" mira retiro únicamente si ese par TIENE
        // inicio (igual que el cálculo por ficha de arriba) — antes, si
        // retiro_hora_inicio_trabajo estaba seteado pero faltaba el fin,
        // caía al par instalación y metía en el promedio la duración de una
        // visita de OTRO día (instalación), distinta de la que en realidad
        // se estaba midiendo. duracion <= 480 (8h) descarta una ficha donde
        // alguien olvidó cerrar el trabajo (ej. 480+ min) y que de otro modo
        // arrastra el promedio de todo un objetivo a un número sin sentido.
        const promedios = await pool.request().query(`
            SELECT id_objetivomuestreo_ma, AVG(CAST(duracion AS FLOAT)) AS promedio_minutos, COUNT(*) AS muestras
            FROM (
                SELECT
                    f.id_objetivomuestreo_ma,
                    CASE
                        WHEN a.retiro_hora_inicio_trabajo IS NOT NULL THEN
                            CASE WHEN a.retiro_hora_fin_trabajo IS NOT NULL
                                THEN DATEDIFF(minute, a.retiro_hora_inicio_trabajo, a.retiro_hora_fin_trabajo)
                                ELSE NULL
                            END
                        ELSE
                            CASE WHEN a.instalacion_hora_inicio_trabajo IS NOT NULL AND a.instalacion_hora_fin_trabajo IS NOT NULL
                                THEN DATEDIFF(minute, a.instalacion_hora_inicio_trabajo, a.instalacion_hora_fin_trabajo)
                                ELSE NULL
                            END
                    END AS duracion
                FROM App_Ma_Agenda_MUESTREOS a
                INNER JOIN App_Ma_FichaIngresoServicio_ENC f ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
                WHERE f.id_objetivomuestreo_ma IS NOT NULL
            ) x
            WHERE duracion IS NOT NULL AND duracion >= 0 AND duracion <= 480
            GROUP BY id_objetivomuestreo_ma
            HAVING COUNT(*) >= 3
        `);
        const promedioPorObjetivo = new Map(
            promedios.recordset.map(p => [Number(p.id_objetivomuestreo_ma), Math.round(p.promedio_minutos)])
        );
        for (const ficha of fichasHoy.recordset) {
            ficha.tiempo_estimado_minutos = ficha.id_objetivomuestreo_ma
                ? (promedioPorObjetivo.get(Number(ficha.id_objetivomuestreo_ma)) ?? null)
                : null;
        }

        // hoy: mismo día que ya usa el filtro SQL de fichasHoy (CAST(... AS
        // DATE) = CAST(GETDATE() AS DATE)) — comparado en JS vía
        // toISOString() porque database.js fija useUTC:true, así que ambas
        // formas de calcular "hoy" coinciden (a diferencia de api-app-mam,
        // que corre en un proceso Node aparte sin esa garantía).
        const hoy = new Date().toISOString().slice(0, 10);
        const fichasPorMuestreador = new Map();
        for (const ficha of fichasHoy.recordset) {
            const diaMuestreo = ficha.fecha_muestreo ? new Date(ficha.fecha_muestreo).toISOString().slice(0, 10) : null;
            const diaRetiro = ficha.fecha_retiro ? new Date(ficha.fecha_retiro).toISOString().slice(0, 10) : null;
            const idInstalador = Number(ficha.id_muestreador) || null;
            // id_muestreador2 NULL significa "el mismo muestreador hace
            // instalación y retiro" (mismo criterio usado en el geofence de
            // api-app-mam) — sin este fallback, el retiro de una ficha así
            // nunca se le asignaba a nadie.
            const idRetirador = Number(ficha.id_muestreador2) || idInstalador;

            // Antes esto asignaba la ficha a AMBOS id_muestreador/id_muestreador2
            // sin mirar si el rol de cada uno correspondía a HOY — un
            // muestreador de instalación (fecha_muestreo de otro día) y un
            // muestreador de retiro (fecha_retiro = hoy) en la MISMA ficha
            // Compuesta terminaban viendo la ficha del otro en su propio
            // itinerario, con el badge/estado de completado que no les
            // correspondía. El Set sigue deduplicando el caso Puntual (mismo
            // muestreador, mismo día, ambos roles).
            const idsAAgregar = new Set();
            if (diaMuestreo === hoy && idInstalador) idsAAgregar.add(idInstalador);
            if (diaRetiro === hoy && idRetirador) idsAAgregar.add(idRetirador);

            for (const idMuestreador of idsAAgregar) {
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
            // De las jornadas ABIERTAS, la de fecha_inicio más reciente — no
            // "la primera que aparezca" (jornadasDelDia viene ASC por
            // fecha_inicio, así que un .find() ingenuo se queda con la más
            // VIEJA). En teoría solo puede haber una jornada abierta a la vez
            // por el índice único filtrado del lado api-app-mam, pero si por
            // cualquier motivo hubiera más de una, la más vieja sería una
            // jornada huérfana (app matada sin terminar) y no debería
            // "secuestrar" el estado del día — sus horas quedarían creciendo
            // para siempre si la tratáramos como la activa real.
            const abiertas = jornadasDelDia.filter(j => j.fecha_fin === null);
            const activa = abiertas.length > 0 ? abiertas[abiertas.length - 1] : undefined;
            // 'pausada': ninguna jornada activa, pero la más reciente se cerró
            // con motivo_fin='pausa' (el muestreador tocó "Pausar", no
            // "Terminar") — jornadas de antes de la migración tienen
            // motivo_fin NULL y caen en 'finalizada', que es el comportamiento
            // previo.
            const estado = activa
                ? 'en_ruta'
                : (jornadaMasReciente.motivo_fin === 'pausa' ? 'pausada' : 'finalizada');

            let horasTrabajadasMinutos = 0;
            // Suma solo de tramos YA CERRADOS (excluye el activo) — el
            // frontend usa esto + un tick en vivo desde fecha_inicio_tramo_
            // actual para que "horas trabajadas" avance sin contar el tiempo
            // de una pausa anterior del mismo día (antes usaba fecha_inicio
            // del PRIMER tramo del día para el tick en vivo, así que una
            // pausa de mediodía se sumaba como si fuera trabajo).
            let horasTrabajadasCerradasMinutos = 0;
            let kmRecorridos = 0;
            let ultimaPosicion = null;
            let ultimoTimestamp = null;

            for (const j of jornadasDelDia) {
                const idJornada = Number(j.id_jornada);
                const esTramoActivo = activa && Number(j.id_jornada) === Number(activa.id_jornada);
                const finTramo = j.fecha_fin ? new Date(j.fecha_fin).getTime() : Date.now();
                // Math.max(0, ...) por tramo: un reloj de dispositivo desfasado
                // (o datos de prueba manuales) podría producir un fecha_fin
                // anterior a fecha_inicio — mejor mostrar 0 minutos para ese
                // tramo que un total negativo sin sentido para el supervisor.
                const minutosTramo = Math.max(0, Math.round((finTramo - new Date(j.fecha_inicio).getTime()) / 60000));
                horasTrabajadasMinutos += minutosTramo;
                if (!esTramoActivo) horasTrabajadasCerradasMinutos += minutosTramo;
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
                fecha_inicio_tramo_actual: activa ? activa.fecha_inicio : null,
                fecha_fin: activa ? null : jornadaMasReciente.fecha_fin,
                estado,
                horas_trabajadas_minutos: horasTrabajadasMinutos,
                horas_trabajadas_cerradas_minutos: horasTrabajadasCerradasMinutos,
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

    /**
     * Historial de jornadas por día — a diferencia de getSnapshotHoy (siempre
     * "hoy", con estado en vivo), esto es retrospectivo: agrupa por
     * (muestreador, día calendario de fecha_inicio) dentro del rango pedido,
     * sin importar si esas jornadas siguen activas o no. Reutiliza la misma
     * idea de "un día puede tener varias jornadas" (pausas de almuerzo, etc.)
     * sumando horas/km por tramo por separado.
     * @param {{fechaDesde: string, fechaHasta: string, idMuestreador?: number}} filtros - fechas 'YYYY-MM-DD'
     */
    async getHistorialJornadas({ fechaDesde, fechaHasta, idMuestreador }) {
        const pool = await getConnection();

        const reqJornadas = pool.request()
            .input('fechaDesde', fechaDesde)
            .input('fechaHasta', fechaHasta);
        if (idMuestreador) reqJornadas.input('idMuestreador', idMuestreador);

        const jornadas = await reqJornadas.query(`
            SELECT
                j.id_jornada,
                j.id_muestreador,
                j.fecha_inicio,
                j.fecha_fin,
                j.bateria_inicio,
                j.bateria_fin,
                m.nombre_muestreador
            FROM mam_jornadas j
            INNER JOIN mae_muestreador m ON m.id_muestreador = j.id_muestreador
            WHERE CAST(j.fecha_inicio AS DATE) BETWEEN @fechaDesde AND @fechaHasta
            ${idMuestreador ? 'AND j.id_muestreador = @idMuestreador' : ''}
            ORDER BY j.id_muestreador, CAST(j.fecha_inicio AS DATE), j.fecha_inicio ASC
        `);

        if (jornadas.recordset.length === 0) {
            return { dias: [] };
        }

        const idsJornada = jornadas.recordset.map(j => j.id_jornada);
        const idsMuestreador = [...new Set(jornadas.recordset.map(j => Number(j.id_muestreador)))];

        // Jornadas agrupadas por (muestreador, día calendario de fecha_inicio)
        // — cada combinación es una fila del historial.
        const jornadasPorDia = new Map();
        for (const j of jornadas.recordset) {
            const idM = Number(j.id_muestreador);
            const dia = new Date(j.fecha_inicio).toISOString().slice(0, 10);
            const clave = `${idM}|${dia}`;
            if (!jornadasPorDia.has(clave)) jornadasPorDia.set(clave, { idMuestreador: idM, dia, jornadas: [] });
            jornadasPorDia.get(clave).jornadas.push(j);
        }

        const todosLosPuntos = await pool.request().query(`
            SELECT id_jornada, latitud, longitud
            FROM mam_ubicaciones_tracking
            WHERE id_jornada IN (${idsJornada.join(',')})
            ORDER BY id_jornada, timestamp_reporte ASC
        `);
        const puntosPorJornada = new Map();
        for (const p of todosLosPuntos.recordset) {
            const id = Number(p.id_jornada);
            if (!puntosPorJornada.has(id)) puntosPorJornada.set(id, []);
            puntosPorJornada.get(id).push({ lat: Number(p.latitud), lon: Number(p.longitud) });
        }

        // Fichas del rango para contar completadas/total por día — mismo
        // patrón de dedup que getSnapshotHoy (una ficha Puntual de proceso
        // único cuenta una sola vez, no una por rol), aplicado por cada
        // combinación (muestreador, día) en vez de solo "hoy".
        const fichasRango = await pool.request()
            .input('fechaDesde', fechaDesde)
            .input('fechaHasta', fechaHasta)
            .query(`
                SELECT a.id_muestreador, a.id_muestreador2, a.fecha_muestreo, a.fecha_retiro,
                       a.instalacion_completado, a.retiro_completado, a.estado_caso
                FROM App_Ma_Agenda_MUESTREOS a
                WHERE (a.id_muestreador IN (${idsMuestreador.join(',')}) OR a.id_muestreador2 IN (${idsMuestreador.join(',')}))
                  AND (
                    CAST(a.fecha_muestreo AS DATE) BETWEEN @fechaDesde AND @fechaHasta
                    OR CAST(a.fecha_retiro AS DATE) BETWEEN @fechaDesde AND @fechaHasta
                  )
                  AND (a.estado_caso IS NULL OR a.estado_caso <> 'CANCELADO')
            `);

        const fichasPorDia = new Map(); // clave "idMuestreador|dia" -> {completadas, total}
        const sumarFicha = (idM, dia, completada) => {
            const clave = `${idM}|${dia}`;
            if (!fichasPorDia.has(clave)) fichasPorDia.set(clave, { completadas: 0, total: 0 });
            const acc = fichasPorDia.get(clave);
            acc.total += 1;
            if (completada) acc.completadas += 1;
        };
        for (const ficha of fichasRango.recordset) {
            const diaMuestreo = ficha.fecha_muestreo ? new Date(ficha.fecha_muestreo).toISOString().slice(0, 10) : null;
            const diaRetiro = ficha.fecha_retiro ? new Date(ficha.fecha_retiro).toISOString().slice(0, 10) : null;
            const idInstalador = Number(ficha.id_muestreador) || null;
            // id_muestreador2 NULL => el mismo muestreador cubre ambos roles
            // (mismo criterio que getSnapshotHoy y el geofence) — sin esto el
            // retiro de esa ficha no se contaba para nadie en el historial.
            const idRetirador = Number(ficha.id_muestreador2) || idInstalador;
            const eventos = [];
            if (diaMuestreo && idInstalador) {
                eventos.push({ idM: idInstalador, dia: diaMuestreo, completada: ficha.instalacion_completado === 'S' });
            }
            if (diaRetiro && idRetirador) {
                eventos.push({ idM: idRetirador, dia: diaRetiro, completada: ficha.retiro_completado === 'S' });
            }
            // Dedup: Puntual de proceso único repite mismo muestreador+día en
            // ambos eventos (instalación y retiro son la misma visita).
            const vistos = new Set();
            for (const ev of eventos) {
                const clave = `${ev.idM}|${ev.dia}`;
                if (vistos.has(clave)) continue;
                vistos.add(clave);
                if (ev.dia >= fechaDesde && ev.dia <= fechaHasta) sumarFicha(ev.idM, ev.dia, ev.completada);
            }
        }

        const hoy = new Date().toISOString().slice(0, 10);
        const resultado = [...jornadasPorDia.values()].map(({ idMuestreador, dia, jornadas: jornadasDelDia }) => {
            let horasTrabajadasMinutos = 0;
            let kmRecorridos = 0;

            for (const j of jornadasDelDia) {
                const idJornada = Number(j.id_jornada);
                let finTramo;
                if (j.fecha_fin) {
                    finTramo = new Date(j.fecha_fin).getTime();
                } else if (dia === hoy) {
                    // Hoy: sigue corriendo de verdad, Date.now() es correcto.
                    finTramo = Date.now();
                } else {
                    // Un tramo de un día PASADO que nunca se cerró (batería
                    // muerta, app matada sin volver a abrirla) — sin este cap,
                    // Date.now() seguía creciendo cada vez que alguien mira el
                    // historial, mostrando más y más horas para un día que ya
                    // terminó hace tiempo. Se acota al fin de ese día.
                    finTramo = new Date(`${dia}T23:59:59`).getTime();
                }
                horasTrabajadasMinutos += Math.max(0, Math.round((finTramo - new Date(j.fecha_inicio).getTime()) / 60000));
                kmRecorridos += calcularKmRecorridos(puntosPorJornada.get(idJornada) || []);
            }

            const fichas = fichasPorDia.get(`${idMuestreador}|${dia}`) || { completadas: 0, total: 0 };

            return {
                id_muestreador: idMuestreador,
                nombre_muestreador: jornadasDelDia[0].nombre_muestreador,
                dia,
                num_jornadas: jornadasDelDia.length,
                horas_trabajadas_minutos: horasTrabajadasMinutos,
                km_recorridos: Math.round(kmRecorridos * 100) / 100,
                bateria_inicio: jornadasDelDia[0].bateria_inicio,
                bateria_fin: jornadasDelDia[jornadasDelDia.length - 1].bateria_fin,
                fichas_completadas: fichas.completadas,
                fichas_total: fichas.total,
            };
        });

        resultado.sort((a, b) => (a.dia === b.dia ? a.nombre_muestreador.localeCompare(b.nombre_muestreador) : b.dia.localeCompare(a.dia)));

        return { dias: resultado };
    }

    /**
     * Detalle de un día para el replay del historial (ver
     * tracking.controller.js:getHistorialDia). Devuelve las fichas visitadas
     * ese día por el muestreador, con su hora de llegada confirmada
     * (instalacion_hora_inicio_trabajo / retiro_hora_inicio_trabajo — el mismo
     * campo que ya escribe el geofence de api-app-mam, ver
     * trackingController.js:detectarLlegadasFichas), no el trazo GPS crudo.
     */
    async getHistorialDia({ idMuestreador, dia }) {
        const pool = await getConnection();

        const jornadasReq = await pool.request()
            .input('idMuestreador', idMuestreador)
            .input('dia', dia)
            .query(`
                SELECT id_jornada, fecha_inicio, fecha_fin
                FROM mam_jornadas
                WHERE id_muestreador = @idMuestreador
                  AND CAST(fecha_inicio AS DATE) = @dia
                ORDER BY fecha_inicio ASC
            `);

        // instalación y retiro se traen como dos eventos candidatos por
        // ficha; cuál de los dos aplica a ESTE muestreador y ESTE día se
        // resuelve en JS abajo (mismo criterio de roles que
        // detectarLlegadasFichas: id_muestreador2 NULL = mismo muestreador
        // cubre ambos roles).
        const fichasReq = await pool.request()
            .input('idMuestreador', idMuestreador)
            .input('dia', dia)
            .query(`
                SELECT
                    a.id_agendamam, a.frecuencia_correlativo,
                    a.id_muestreador, a.id_muestreador2,
                    a.instalacion_hora_inicio_trabajo, a.retiro_hora_inicio_trabajo,
                    f.ubicacion_lat, f.ubicacion_lon,
                    c.nombre_centro, e.nombre_empresa
                FROM App_Ma_Agenda_MUESTREOS a
                INNER JOIN App_Ma_FichaIngresoServicio_ENC f ON a.id_fichaingresoservicio = f.id_fichaingresoservicio
                INNER JOIN mae_centro c ON f.id_centro = c.id_centro
                INNER JOIN mae_empresa e ON f.id_empresa = e.id_empresa
                WHERE (a.id_muestreador = @idMuestreador OR a.id_muestreador2 = @idMuestreador)
                  AND f.ubicacion_lat IS NOT NULL AND f.ubicacion_lon IS NOT NULL
                  AND (
                    CAST(a.instalacion_hora_inicio_trabajo AS DATE) = @dia
                    OR CAST(a.retiro_hora_inicio_trabajo AS DATE) = @dia
                  )
            `);

        const eventos = [];
        for (const f of fichasReq.recordset) {
            const mismoMuestreadorAmbosRoles = f.id_muestreador2 == null;
            const esInstalador = Number(f.id_muestreador) === idMuestreador;
            const esRetirador = Number(f.id_muestreador2) === idMuestreador
                || (mismoMuestreadorAmbosRoles && esInstalador);

            const punto = {
                id_agendamam: f.id_agendamam,
                frecuencia_correlativo: f.frecuencia_correlativo,
                nombre_centro: f.nombre_centro,
                nombre_empresa: f.nombre_empresa,
                lat: Number(f.ubicacion_lat),
                lon: Number(f.ubicacion_lon),
            };

            if (esInstalador && f.instalacion_hora_inicio_trabajo
                && new Date(f.instalacion_hora_inicio_trabajo).toISOString().slice(0, 10) === dia) {
                eventos.push({ ...punto, tipo: 'instalacion', hora: f.instalacion_hora_inicio_trabajo });
            }
            // Puntual de proceso único solo escribe UNO de los dos campos
            // (ver detectarLlegadasFichas: prioriza retiro), así que esto no
            // duplica esa visita — son genuinamente dos eventos distintos
            // cuando ambos están presentes (p.ej. Compuesta corta).
            if (esRetirador && f.retiro_hora_inicio_trabajo
                && new Date(f.retiro_hora_inicio_trabajo).toISOString().slice(0, 10) === dia) {
                eventos.push({ ...punto, tipo: 'retiro', hora: f.retiro_hora_inicio_trabajo });
            }
        }
        eventos.sort((a, b) => new Date(a.hora) - new Date(b.hora));

        return {
            jornadas: jornadasReq.recordset,
            fichas_visitadas: eventos,
        };
    }
}

export default new TrackingService();
