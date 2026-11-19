import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import { equipoService } from './equipo.service.js';
import ursService from './urs.service.js';
import { codigoConSede } from '../utils/codigoEquipo.js';

// Aplicar en los equipos una solicitud URS ya aceptada por Gestión de Calidad.
//
//   plan(id)     Qué hay que cambiar: el equipo de la solicitud (y, solo en un traspaso, sus equipos
//                asociados), campo por campo (actual → nuevo), con la observación que Calidad escribió al
//                aceptar. No toca nada.
//   aplicar(id)  Hace esos cambios en los equipos, deja en cada uno la observación (debajo de las anteriores) y
//                marca la solicitud como REALIZADA. Se pide desde la pantalla de Gestión de Equipos al
//                presionar "Actualizar", por eso no se vuelve a pedir una observación.
//
// Tipos de solicitud (_form_type del datos_json): TRASPASO_EQUIPO, BAJA_EQUIPO, EXTENSION_VIGENCIA y
// REPORTE_PROBLEMA. Un tipo que no cambia campos (reporte de problema) solo deja la observación.

const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const hoyCorto = () => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(2)}`;
};
const hoyISO = () => new Date().toISOString().slice(0, 10);
const dmy = (iso) => (iso ? String(iso).slice(0, 10).split('-').reverse().join('-') : '—');
const iso = (v) => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};

const EQUIPO_SQL = `
    SELECT e.id_equipo, LTRIM(RTRIM(e.codigo)) AS codigo, e.nombre, e.tipoequipo AS tipo, e.sede, e.id_muestreador,
           m.nombre_muestreador AS responsable, e.Estado AS estado_equipo,
           CONVERT(VARCHAR(10), e.Ultima_verificacion, 23) AS ultima_verificacion,
           CONVERT(VARCHAR(10), e.Siguiente_verificacion, 23) AS siguiente_verificacion,
           CONVERT(VARCHAR(10), e.fecha_baja, 23) AS fecha_baja, LTRIM(RTRIM(ISNULL(e.equipo_asociado, '0'))) AS equipo_asociado
    FROM mae_equipo e LEFT JOIN mae_muestreador m ON m.id_muestreador = e.id_muestreador`;

const cargarSolicitud = async (pool, id) => {
    const r = await pool.request().input('id', sql.Numeric(10, 0), id).query(`
        SELECT s.id_solicitud, s.estado, CAST(s.datos_json AS NVARCHAR(MAX)) AS datos_json, t.nombre AS nombre_tipo,
               COALESCE(u.usuario, mu.nombre_muestreador) AS solicitante, CONVERT(VARCHAR(10), s.fecha_creacion, 23) AS fecha_creacion
        FROM mae_solicitud s
        JOIN mae_solicitud_tipo t ON t.id_tipo = s.id_tipo
        LEFT JOIN mae_usuario u ON u.id_usuario = s.id_solicitante
        LEFT JOIN mae_muestreador mu ON mu.id_muestreador = s.id_solicitante
        WHERE s.id_solicitud = @id`);
    const s = r.recordset[0];
    if (!s) throw error('Solicitud no encontrada', 404);
    let datos = {};
    try { datos = JSON.parse(s.datos_json || '{}'); } catch { datos = {}; }
    return { ...s, datos };
};

// La observación que Calidad escribió al aceptar queda en el hilo como "Cambio de estado a ACEPTADA: <texto>".
const observacionDeAceptacion = async (pool, id) => {
    const r = await pool.request().input('id', sql.Numeric(10, 0), id).query(`
        SELECT TOP 1 mensaje FROM mae_solicitud_comentario
        WHERE id_solicitud = @id AND es_sistema = 1 AND mensaje LIKE 'Cambio de estado a ACEPTADA%'
        ORDER BY fecha DESC, id_comentario DESC`);
    const msg = r.recordset[0]?.mensaje || '';
    const i = msg.indexOf(':');
    return i >= 0 ? msg.slice(i + 1).trim() : '';
};

const equipoPorId = async (pool, id) => (await pool.request().input('id', sql.Numeric(10, 0), id).query(`${EQUIPO_SQL} WHERE e.id_equipo = @id`)).recordset[0] || null;

// Equipos asociados (el vínculo está en el texto equipo_asociado y suele ser en ambos sentidos).
const asociadosDe = async (pool, equipo) => {
    const r = await pool.request()
        .input('codigo', sql.VarChar(100), equipo.codigo)
        .input('id', sql.Numeric(10, 0), equipo.id_equipo)
        .input('asoc', sql.VarChar(100), equipo.equipo_asociado && equipo.equipo_asociado !== '0' ? equipo.equipo_asociado : '')
        .query(`${EQUIPO_SQL}
                WHERE e.id_equipo <> @id AND ISNULL(e.Estado, '') NOT LIKE '%baja%'
                  AND ((@asoc <> '' AND LTRIM(RTRIM(e.codigo)) = @asoc) OR LTRIM(RTRIM(ISNULL(e.equipo_asociado, '0'))) = @codigo)`);
    return r.recordset;
};

const cambio = (campo, etiqueta, actual, nuevo) => ({ campo, etiqueta, actual: actual || '—', nuevo: nuevo || '—' });

// Cambios de la solicitud sobre un equipo: lista para mostrar y campos para guardar.
export const cambiosPara = (tipo, d, eq) => {
    const cambios = [];
    const payload = {};
    if (tipo === 'TRASPASO_EQUIPO') {
        const de = Array.isArray(d.traspaso_de) ? d.traspaso_de : [];
        if (de.includes('RESPONSABLE') && d.id_muestreador_destino) {
            payload.id_muestreador = Number(d.id_muestreador_destino);
            cambios.push(cambio('id_muestreador', 'Responsable', eq.responsable, d.nombre_muestreador_destino));
        }
        if (de.includes('UBICACION') && d.id_centro_destino) {
            payload.ubicacion = String(d.id_centro_destino);
            cambios.push(cambio('ubicacion', 'Sede', eq.sede, d.nombre_centro_destino || d.id_centro_destino));
            // Gestión de Calidad: el código se mantiene y solo cambia la sede del final (MAU.01/MA.PM → MAU.01/MA.VI).
            const nuevoCodigo = codigoConSede(eq.codigo, d.id_centro_destino);
            if (nuevoCodigo && nuevoCodigo !== eq.codigo) {
                payload.codigo = nuevoCodigo;
                cambios.push(cambio('codigo', 'Código', eq.codigo, nuevoCodigo));
            }
        }
    } else if (tipo === 'BAJA_EQUIPO') {
        payload.estado_equipo = 'Dado de Baja';
        cambios.push(cambio('estado_equipo', 'Estado', eq.estado_equipo, 'Dado de Baja'));
        if (d.fecha_baja) {
            payload.fecha_baja = String(d.fecha_baja).slice(0, 10);
            cambios.push(cambio('fecha_baja', 'Fecha de baja', dmy(eq.fecha_baja), dmy(d.fecha_baja)));
        }
    } else if (tipo === 'EXTENSION_VIGENCIA') {
        const nueva = iso(d.nueva_vigencia || d.siguiente_verificacion || d.nueva_vigencia_solicitada);
        if (d.fecha_revision) {
            payload.ultima_verificacion = iso(d.fecha_revision);
            cambios.push(cambio('ultima_verificacion', 'Última revisión', dmy(eq.ultima_verificacion), dmy(d.fecha_revision)));
        }
        if (nueva) {
            payload.siguiente_verificacion = nueva;
            if (nueva >= hoyISO()) payload.vigencia = nueva;
            cambios.push(cambio('siguiente_verificacion', 'Siguiente revisión', dmy(eq.siguiente_verificacion), dmy(nueva)));
        }
    }
    return { cambios, payload };
};

const idEquipoDe = (d) => Number(d.id_equipo || d.id_equipo_afectado || d.id_equipo_original) || null;

const solicitudEquipoService = {
    async plan(id) {
        const pool = await getConnection();
        const s = await cargarSolicitud(pool, id);
        const tipo = s.datos._form_type || '';
        const idEquipo = idEquipoDe(s.datos);
        if (!idEquipo) throw error('Esta solicitud no indica un equipo.', 422);
        const principal = await equipoPorId(pool, idEquipo);
        if (!principal) throw error('El equipo de la solicitud ya no existe.', 404);

        const equipos = [];
        const base = cambiosPara(tipo, s.datos, principal);
        equipos.push({ ...principal, rol: 'PRINCIPAL', cambios: base.cambios, payload: base.payload });
        // Los equipos asociados se actualizan siempre, pero solo en un traspaso.
        if (tipo === 'TRASPASO_EQUIPO') {
            for (const a of await asociadosDe(pool, principal)) {
                const c = cambiosPara(tipo, s.datos, a);
                equipos.push({ ...a, rol: 'ASOCIADO', cambios: c.cambios, payload: c.payload });
            }
        }
        return {
            id_solicitud: s.id_solicitud,
            estado: s.estado,
            tipo,
            nombre_tipo: s.nombre_tipo,
            solicitante: s.solicitante,
            fecha_creacion: s.fecha_creacion,
            motivo: s.datos.motivo || s.datos.justificacion || s.datos.descripcion_problema || '',
            observacion_aceptacion: await observacionDeAceptacion(pool, id),
            equipos,
        };
    },

    async aplicar(id, idUsuario) {
        const p = await this.plan(id);
        if (p.estado !== 'ACEPTADA') throw error('La solicitud debe estar aceptada para aplicarla en los equipos.', 409);
        const fecha = hoyCorto();
        const resultados = [];
        for (const e of p.equipos) {
            const que = e.cambios.length ? e.cambios.map((c) => `${c.etiqueta}: ${c.actual} → ${c.nuevo}`).join(', ') : '';
            // En el historial: qué cambió, quién lo solicitó y por qué (los movimientos deben quedar justificados).
            const partes = [
                `Solicitud #${id} (${p.nombre_tipo})${e.rol === 'ASOCIADO' ? ' · equipo asociado' : ''}`,
                que,
                p.solicitante ? `Solicitado por ${p.solicitante}` : '',
                p.motivo ? `Motivo: ${String(p.motivo).replace(/\s+/g, ' ').trim()}` : '',
                p.observacion_aceptacion,
            ].filter(Boolean);
            try {
                await equipoService.updateEquipo(e.id_equipo, { ...e.payload, observacion_agregada: `${fecha} ${partes.join('. ')}` }, idUsuario);
                resultados.push({ id_equipo: e.id_equipo, codigo: e.codigo, ok: true });
            } catch (err) {
                logger.error(`Solicitud ${id}: no se pudo actualizar el equipo ${e.codigo}:`, err);
                resultados.push({ id_equipo: e.id_equipo, codigo: e.codigo, ok: false, error: err.message });
            }
        }
        const todosOk = resultados.every((r) => r.ok);
        // Con todos los equipos al día la solicitud se cierra sola (llega el aviso de "realizada" al solicitante).
        if (todosOk) {
            try {
                await ursService.updateStatus(id, 'REALIZADA', idUsuario, 'Aplicada en Gestión de Equipos.');
            } catch (err) {
                logger.error(`Solicitud ${id}: los equipos se actualizaron pero no se pudo marcar como realizada:`, err);
            }
        }
        return { resultados, realizada: todosOk };
    },
};

export default solicitudEquipoService;
