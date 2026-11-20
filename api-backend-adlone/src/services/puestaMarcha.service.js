import fs from 'fs';
import path from 'path';
import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import firmaDigitalService from './firmaDigital.service.js';
import fichasEquipoService from './fichasEquipo.service.js';
import gcDocumentosService from './gcDocumentos.service.js';
import { ITEMS_RECEPCION } from './fichasEquipo.pdf.js';
import { equipoService } from './equipo.service.js';
import auditService from './audit.service.js';
import { areasPorRoles } from '../utils/areasRoles.js';
import { PERMISOS_GC, permisosGc, puedeGc } from '../utils/permisosCalidad.js';

// Puesta en Marcha de equipos (OI-FoGe-42) como registro propio (migrations/add_puesta_en_marcha.sql).
//
// Flujo: se registra (equipo, fecha, tipo, recepción, patrón, observación) y queda PENDIENTE_FIRMA. La verificación o
// validación es compartida: si la realiza el Área Técnica de Medio Ambiente la valida Gestión de Calidad, y al revés;
// firman dos personas distintas. Con las dos firmas queda APROBADA y recién ahí entra al historial del equipo. Si el
// equipo queda Operativo o Fuera de Servicio se decide después, en el inventario: aquí no se toca su estado.
//
// Definido por Gestión de Calidad (respuestas a las consultas de desarrollo):
//   · Las tres partes del formulario (Recepción, Puesta en Marcha y Verificación) se marcan siempre, sea cual sea el caso.
//   · El estado de recepción lo elige quien registra; el funcionamiento también (puede no cumplir y quedar operativo).
//   · Firman: por Gestión de Calidad, cualquiera del área; por Medio Ambiente, muestreadores con competencias,
//     coordinadores, jefe de terreno y jefe técnico (roles Área Técnica MAM, Área Coordinación MAM y Gerencia Técnica).
//   · El patrón de referencia, si es un equipo, se elige de la lista (termómetros patrón, molinetes, muestreadores
//     automáticos); si es un buffer, se escribe.
//   · Ya aprobada, solo Gestión de Calidad la edita, complementa o le adjunta documentos. Un documento adjuntado después
//     (informe de diagnóstico, reparación o mantención) con su observación complementa la línea del historial (lo que
//     ven los auditores). Los cambios internos (fechas modificadas, acciones fuera de plazo) quedan en el registro de
//     uso de la aplicación (App_Audit_Log), que solo ve Gestión de Calidad.
//
// ── PARA MEJORAR EN EL FUTURO ──────────────────────────────────────────────────────────────────────────────────────
// La secuencia del historial (lámina 11 del documento «Avance y Observaciones») está implementada como una primera
// versión: una línea de observación con fecha, acción, conector (la observación de la puesta en marcha) y vinculación
// (verificación asociada y documentos adjuntos). Se va a detallar y ajustar más adelante: toda la redacción de esa línea
// está en `lineaHistorial`, un solo lugar para cambiarla. También queda pendiente cómo se registran las modificaciones
// posteriores de una puesta en marcha (hoy los documentos adjuntados después no entran al historial).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const AVISO_FUTURO = 'Primera versión: la secuencia que se escribe en el historial del equipo y el registro de modificaciones posteriores se van a mejorar más adelante.';

const TABLA = 'mae_puesta_marcha';
const TABLA_ADJ = 'mae_puesta_marcha_adjunto';
// Envíos a firmar (migrations/add_puesta_marcha_asignacion_firma.sql): quien registra firma su parte y, si no puede
// firmar la otra, la envía a una persona concreta que sí tiene el permiso; esa persona firma con el mismo endpoint
// de siempre desde su propia sesión. Esta tabla solo registra a quién se le pidió cada firma.
const TABLA_ASIG = 'mae_puesta_marcha_asignacion_firma';
export const TIPOS = ['EQUIPO_NUEVO', 'RETORNO_SERVICIO', 'CAMBIO_SEDE', 'REACTIVACION'];
const NOMBRE_TIPO = { EQUIPO_NUEVO: 'equipo nuevo', RETORNO_SERVICIO: 'retorno de servicio externo', CAMBIO_SEDE: 'cambio de sede', REACTIVACION: 'reactivación tras Fuera de Servicio' };
const AREAS = ['TECNICA', 'CALIDAD'];
const NOMBRE_AREA = { TECNICA: 'Área Técnica de Medio Ambiente', CALIDAD: 'Gestión de Calidad' };

export const carpetaAdjuntos = path.join(process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'), 'puestas-marcha');

const error = (mensaje, statusCode = 400) => Object.assign(new Error(mensaje), { statusCode });
const esImagen = (f) => /^data:image\/(png|jpeg);base64,/.test(String(f || '')) && String(f).length <= 900_000;
const hoyYmd = () => new Date().toISOString().slice(0, 10);
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const dmy = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');
const dmyCorto = (ymd) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(2, 4)}`;
const texto = (v, max) => String(v ?? '').trim().slice(0, max);

/**
 * La línea que queda en el historial del equipo cuando la puesta en marcha se aprueba (lámina 11):
 *   Fecha · Acción · Conector («Realizada por: observación») · Vinculación (verificación y documentos asociados).
 * PRIMERA VERSIÓN: se va a ajustar más adelante (ver nota al inicio del archivo).
 */
export const lineaHistorial = (p, adjuntos = []) => {
    const partes = [`${dmyCorto(p.fecha)} Puesta en marcha (${NOMBRE_TIPO[p.tipo] || p.tipo}). Realizada por: ${p.observacion.replace(/\s+/g, ' ').trim()}`];
    if (p.verificacion_tipo) {
        const doc = p.verificacion_tipo === 'TEMPERATURA' ? 'Verificación de Temperatura' : 'Verificación de Caudal';
        partes.push(`Se asocia ${doc}${p.verificacion_codigo ? ` ${p.verificacion_codigo}` : ''}${p.verificacion_fecha ? ` realizada el ${dmy(p.verificacion_fecha)}` : ''}`);
    }
    if (adjuntos.length) partes.push(`Se asocian documentos: ${adjuntos.map((a) => a.documento).join(', ')}`);
    return `${partes.join('. ')}.`;
};

/** Solo las opciones que trae el formulario OI-FoGe-42 para cada ítem; lo demás queda sin marcar. */
export const itemsValidos = (items) => {
    const r = {};
    for (const [clave, opciones] of Object.entries(ITEMS_RECEPCION)) {
        if (items && opciones.includes(items[clave])) r[clave] = items[clave];
    }
    return r;
};

// Las columnas items / otros llegan con migrations/alter_puesta_marcha_items.sql; sin ellas se registra igual.
let columnasItems = false;
const hayColumnasItems = async (pool) => {
    if (columnasItems) return true;
    const r = await pool.request().query("SELECT COL_LENGTH('mae_puesta_marcha', 'items') AS i, COL_LENGTH('mae_puesta_marcha', 'otros') AS o");
    columnasItems = !!(r.recordset[0].i && r.recordset[0].o);
    return columnasItems;
};
let columnaObsAdjunto = false;
const hayColumnaObsAdjunto = async (pool) => {
    if (columnaObsAdjunto) return true;
    const r = await pool.request().query("SELECT COL_LENGTH('mae_puesta_marcha_adjunto', 'observacion') AS o");
    columnaObsAdjunto = !!r.recordset[0].o;
    return columnaObsAdjunto;
};

// Quién firma por cada parte y quién edita se asigna por permiso en Configurar rol / permisos (utils/permisosCalidad.js).
const areasDe = async (pool, usuario) => {
    const p = await permisosGc(pool, usuario?.id, [PERMISOS_GC.FIRMA_CALIDAD, PERMISOS_GC.FIRMA_TECNICA]);
    return { CALIDAD: p[PERMISOS_GC.FIRMA_CALIDAD], TECNICA: p[PERMISOS_GC.FIRMA_TECNICA] };
};
const puedeEditar = (pool, usuario) => puedeGc(pool, usuario?.id, PERMISOS_GC.EDITAR_PM);
const exigirCalidad = async (pool, usuario, accion) => {
    if (!(await puedeEditar(pool, usuario))) throw error(`No tiene el permiso para ${accion} (Puesta en Marcha: editar).`, 403);
};

/** Registro interno de uso (App_Audit_Log): lo que no va al historial del equipo, solo para Gestión de Calidad. */
const auditar = (usuario, evento, p, descripcion, antes = null, despues = null) => auditService.log({
    usuario_id: usuario?.id ? Number(usuario.id) : null,
    area_key: 'calidad',
    modulo_nombre: 'Puesta en Marcha',
    evento_tipo: evento,
    entidad_nombre: 'mae_puesta_marcha',
    entidad_id: p.id_puesta_marcha,
    descripcion_humana: `${p.codigo_equipo || ''}: ${descripcion}`.slice(0, 500),
    datos_anteriores: antes,
    datos_nuevos: despues,
    severidad: evento === 'EDICION' ? 2 : 1,
});

const leerItems = (json) => { try { return itemsValidos(JSON.parse(json || '{}')); } catch { return {}; } };

/**
 * «Se registra» del formulario: Gestión de Calidad definió que las tres partes (Recepción, Puesta en Marcha y
 * Verificación) se marcan siempre, independiente del caso, aunque el área llene solo una.
 */
export const partesRegistradas = () => ({ recepcion: true, puesta_marcha: true, verificacion: true });

/** Funcionamiento: el que eligió quien registra; si no eligió, sale del estado de recepción. */
export const funcionamientoDe = (estadoRecepcion, elegido) => {
    if (['OPERATIVO', 'NO_OPERATIVO'].includes(elegido)) return elegido;
    if (estadoRecepcion === 'CUMPLE') return 'OPERATIVO';
    if (estadoRecepcion === 'NO_CUMPLE') return 'NO_OPERATIVO';
    return '';
};

// Por qué área puede firmar alguien según sus roles: regla compartida en utils/areasRoles.js.
export { areasPorRoles };

/** La línea que complementa el historial cuando se adjunta un documento a una puesta en marcha ya aprobada. */
export const lineaComplemento = (p, documento, observacion, hoy = hoyYmd()) => {
    const obs = String(observacion || '').replace(/\s+/g, ' ').trim();
    return `${dmyCorto(hoy)} Complemento a la puesta en marcha del ${dmy(p.fecha)}: se adjunta ${documento}.${obs ? ` ${obs}${/[.!?]$/.test(obs) ? '' : '.'}` : ''}`;
};

/** Lo que va en el PDF OI-FoGe-42 de una puesta en marcha (guardada o en borrador). */
const cuerpoPdf = (p, eq = {}) => ({
    nombre: eq.nombre || p.nombre_equipo || '', codigo: eq.codigo || p.codigo_equipo || '', marca: eq.marca || '', modelo: eq.modelo || '', serie: eq.n_serie || '',
    fecha: dmy(p.fecha),
    ...partesRegistradas(p),
    ...(p.items || {}),
    otros: p.otros || '',
    estado_recepcion: p.estado_recepcion === 'CUMPLE' ? 'Cumple' : p.estado_recepcion === 'NO_CUMPLE' ? 'No Cumple' : '',
    funcionamiento: p.funcionamiento === 'OPERATIVO' ? 'Operativo' : p.funcionamiento === 'NO_OPERATIVO' ? 'No Operativo' : '',
    patron_referencia: p.patron_referencia || '',
    observaciones: p.observacion || '',
    firma_recepcion: p.nombre_tecnica || '', imagen_firma_recepcion: p.firma_tecnica || '',
    firma_calidad: p.nombre_calidad || '', imagen_firma_calidad: p.firma_calidad || '',
});

const exigirTablas = async (pool) => {
    const r = await pool.request().query(`SELECT OBJECT_ID('${TABLA}', 'U') AS a, OBJECT_ID('${TABLA_ADJ}', 'U') AS b`);
    if (!r.recordset[0].a || !r.recordset[0].b) throw error('Falta ejecutar la migración add_puesta_en_marcha.sql para usar las puestas en marcha.', 503);
};

let hayTablaAsig = false;
const hayTablaAsignacion = async (pool) => {
    if (hayTablaAsig) return true;
    const r = await pool.request().query(`SELECT OBJECT_ID('${TABLA_ASIG}', 'U') AS a`);
    hayTablaAsig = !!r.recordset[0].a;
    return hayTablaAsig;
};
const exigirTablaAsignacion = async (pool) => {
    if (!(await hayTablaAsignacion(pool))) throw error('Falta ejecutar la migración add_puesta_marcha_asignacion_firma.sql para enviar a firmar.', 503);
};

/** Avisa por la Notificación Unificada (UNS); si falla, solo lo deja en el log (no corta la acción). */
const notificar = async (idUsuario, titulo, mensaje, idPuesta) => {
    try {
        const { default: uns } = await import('./uns.service.js');
        await uns.sendWebNotification(idUsuario, titulo, mensaje, 'INFO', idPuesta, 'PuestaMarcha');
    } catch (e) {
        logger.warn(`Puesta en marcha: no se pudo avisar al usuario ${idUsuario}: ${e.message}`);
    }
};

const filaPublica = (p) => ({
    id_puesta_marcha: p.id_puesta_marcha,
    id_equipo: Number(p.id_equipo),
    codigo_equipo: p.codigo_equipo,
    nombre_equipo: p.nombre_equipo,
    sede: p.sede,
    tipo: p.tipo,
    fecha: p.fecha,
    area_realiza: p.area_realiza,
    estado_recepcion: p.estado_recepcion,
    funcionamiento: p.funcionamiento,
    patron_referencia: p.patron_referencia,
    observacion: p.observacion,
    verificacion_tipo: p.verificacion_tipo,
    verificacion_id: p.verificacion_id,
    verificacion_codigo: p.verificacion_codigo,
    verificacion_fecha: p.verificacion_fecha,
    estado: p.estado,
    firmas: {
        TECNICA: { firmada: !!p.firma_tecnica, nombre: p.nombre_tecnica, fecha: p.fecha_firma_tecnica },
        CALIDAD: { firmada: !!p.firma_calidad, nombre: p.nombre_calidad, fecha: p.fecha_firma_calidad },
    },
    en_historial: !!p.en_historial,
    motivo_anulacion: p.motivo_anulacion,
    nombre_crea: p.nombre_crea,
    fecha_creacion: p.fecha_creacion,
    n_adjuntos: p.n_adjuntos ?? undefined,
    items: leerItems(p.items),
    otros: p.otros || '',
});

const COLUMNAS = `p.id_puesta_marcha, p.id_equipo, p.codigo_equipo, p.nombre_equipo, p.sede, p.tipo,
    CONVERT(VARCHAR(10), p.fecha, 23) AS fecha, p.area_realiza, p.estado_recepcion, p.funcionamiento, p.patron_referencia, p.observacion,
    p.verificacion_tipo, p.verificacion_id, p.verificacion_codigo, CONVERT(VARCHAR(10), p.verificacion_fecha, 23) AS verificacion_fecha,
    p.estado, p.firma_tecnica, p.nombre_tecnica, p.fecha_firma_tecnica, p.firma_calidad, p.nombre_calidad, p.fecha_firma_calidad,
    p.en_historial, p.motivo_anulacion, p.id_usuario_crea, p.nombre_crea, p.fecha_creacion`;

const columnas = async (pool) => `${COLUMNAS}${(await hayColumnasItems(pool)) ? ', p.items, p.otros' : ''}`;

const cargar = async (pool, id) => {
    const r = await pool.request().input('id', sql.Int, Number(id)).query(`SELECT ${await columnas(pool)} FROM ${TABLA} p WHERE p.id_puesta_marcha = @id`);
    if (!r.recordset[0]) throw error('Puesta en marcha no encontrada.', 404);
    return r.recordset[0];
};

const adjuntosDe = async (pool, id) => (await pool.request().input('id', sql.Int, Number(id)).query(`
    SELECT id_adjunto, documento, archivo_nombre, nombre_usuario, fecha${(await hayColumnaObsAdjunto(pool)) ? ', observacion' : ''}
    FROM ${TABLA_ADJ} WHERE id_puesta_marcha = @id ORDER BY id_adjunto`)).recordset;

/** Envío pendiente por rol (si existe), para mostrar "Enviado a <nombre>, pendiente de su firma". */
const asignacionesDe = async (pool, id) => {
    if (!(await hayTablaAsignacion(pool))) return {};
    const r = await pool.request().input('id', sql.Int, Number(id)).query(`
        SELECT a.rol, a.id_usuario_destino, u.nombre_usuario AS nombre_destino, a.fecha_creacion
        FROM ${TABLA_ASIG} a JOIN mae_usuario u ON u.id_usuario = a.id_usuario_destino
        WHERE a.id_puesta_marcha = @id AND a.estado = 'PENDIENTE'`);
    return Object.fromEntries(r.recordset.map((x) => [x.rol, { id_usuario_destino: x.id_usuario_destino, nombre_destino: x.nombre_destino, fecha_creacion: x.fecha_creacion }]));
};

const puestaMarchaService = {
    async listar({ id_equipo, estado, q } = {}) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const req = pool.request();
        const where = ['1 = 1'];
        if (id_equipo) { req.input('eq', sql.Numeric(10, 0), Number(id_equipo)); where.push('p.id_equipo = @eq'); }
        if (estado) { req.input('est', sql.VarChar(15), String(estado)); where.push('p.estado = @est'); }
        if (q) { req.input('q', sql.NVarChar(200), `%${String(q).trim()}%`); where.push('(p.codigo_equipo LIKE @q OR p.nombre_equipo LIKE @q OR p.observacion LIKE @q)'); }
        const r = await req.query(`
            SELECT ${await columnas(pool)}, (SELECT COUNT(*) FROM ${TABLA_ADJ} a WHERE a.id_puesta_marcha = p.id_puesta_marcha) AS n_adjuntos
            FROM ${TABLA} p WHERE ${where.join(' AND ')} ORDER BY p.fecha DESC, p.id_puesta_marcha DESC`);
        return r.recordset.map(filaPublica);
    },

    async obtener(id, usuario = null) {
        const pool = await getConnection();
        await exigirTablas(pool);
        let p = await cargar(pool, id);
        // Aprobada pero sin su línea en el historial (falló al aprobar): se reintenta, una sola escritura a la vez.
        if (p.estado === 'APROBADA' && !p.en_historial && usuario?.id) {
            const toma = await pool.request().input('id', sql.Int, Number(id)).query(
                `UPDATE ${TABLA} SET en_historial = 1 WHERE id_puesta_marcha = @id AND estado = 'APROBADA' AND en_historial = 0`);
            if (toma.rowsAffected[0]) { await this._escribirHistorial(pool, p, usuario); p = await cargar(pool, id); }
        }
        const areas = await areasDe(pool, usuario);
        return {
            ...filaPublica(p), adjuntos: await adjuntosDe(pool, id), aviso_futuro: AVISO_FUTURO,
            // Partes por las que puede firmar quien mira, y si puede editar (según sus permisos).
            mis_areas: areas, puede_editar: (await puedeEditar(pool, usuario)) && p.estado !== 'ANULADA',
            // Si la parte que falta ya se envió a firmar a alguien, por rol ('TECNICA'/'CALIDAD').
            asignaciones: await asignacionesDe(pool, id),
        };
    },

    /** Equipo con los datos que se rellenan solos en el formulario, y las verificaciones de T° firmadas que se pueden vincular. */
    async datosEquipo(idEquipo) {
        const pool = await getConnection();
        const r = await pool.request().input('id', sql.Int, Number(idEquipo)).query(`
            SELECT id_equipo, codigo, nombre, tipoequipo, sede, marca, modelo, n_serie, Estado AS estado_equipo FROM mae_equipo WHERE id_equipo = @id`);
        const e = r.recordset[0];
        if (!e) throw error('Equipo no encontrado.', 404);
        const v = await pool.request().input('id', sql.Int, Number(idEquipo)).query(`
            IF OBJECT_ID('mae_verificacion_temperatura') IS NOT NULL
                SELECT id_verificacion, CONVERT(VARCHAR(10), fecha_verificacion, 23) AS fecha, cumple, patron_codigo, patron_nombre
                FROM mae_verificacion_temperatura WHERE id_equipo = @id AND estado = 'FIRMADA' ORDER BY fecha_verificacion DESC`);
        // Verificaciones de caudal (OI-FoGe-30) con V°B° de esta sonda, para vincularlas.
        const c = await pool.request().input('id', sql.Int, Number(idEquipo)).query(`
            IF OBJECT_ID('mae_verificacion_caudal') IS NOT NULL
                SELECT id_verificacion, CONVERT(VARCHAR(10), fecha_verificacion, 23) AS fecha, cumple, equipo_referencia
                FROM mae_verificacion_caudal WHERE id_equipo = @id AND estado = 'FIRMADA' ORDER BY fecha_verificacion DESC`);
        return { equipo: e, verificaciones_temperatura: v.recordset || [], verificaciones_caudal: c.recordset || [] };
    },

    async crear(body = {}, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const idEquipo = Number(body.id_equipo);
        if (!Number.isInteger(idEquipo) || idEquipo <= 0) throw error('Indique el equipo (su código).');
        if (!esFecha(body.fecha)) throw error('Indique la fecha en que se realizó la puesta en marcha.');
        if (body.fecha > hoyYmd()) throw error('La fecha de la puesta en marcha no puede ser futura.');
        if (!TIPOS.includes(body.tipo)) throw error('Indique el tipo de puesta en marcha.');
        if (!AREAS.includes(body.area_realiza)) throw error('Indique quién realiza la puesta en marcha: Área Técnica o Gestión de Calidad.');
        if (!['CUMPLE', 'NO_CUMPLE'].includes(body.estado_recepcion)) throw error('Indique si la recepción Cumple o No cumple.');
        const observacion = texto(body.observacion, 1500);
        if (!observacion) throw error('La observación de la puesta en marcha es obligatoria.');
        // El funcionamiento lo elige quien registra (puede no cumplir la recepción y quedar operativo); si no, sale del estado.
        const funcionamiento = funcionamientoDe(body.estado_recepcion, body.funcionamiento);
        const patron = texto(body.patron_referencia, 300);
        if (funcionamiento === 'OPERATIVO' && !patron) throw error('Cite el patrón de referencia: el equipo o el buffer que se usó (ej. Buffer 4.0 / 7.0 / 10.0).');

        const eq = (await pool.request().input('id', sql.Int, idEquipo).query('SELECT id_equipo, codigo, nombre, sede FROM mae_equipo WHERE id_equipo = @id')).recordset[0];
        if (!eq) throw error('Equipo no encontrado.', 404);

        // Verificación vinculada (opcional): de temperatura, una ficha firmada de este equipo; de caudal, el código y la fecha.
        let vTipo = null, vId = null, vCodigo = null, vFecha = null;
        if (body.verificacion_tipo === 'TEMPERATURA' && body.verificacion_id) {
            const v = (await pool.request().input('v', sql.Int, Number(body.verificacion_id)).input('e', sql.Numeric(10, 0), idEquipo).query(`
                SELECT id_verificacion, CONVERT(VARCHAR(10), fecha_verificacion, 23) AS fecha FROM mae_verificacion_temperatura
                WHERE id_verificacion = @v AND id_equipo = @e AND estado = 'FIRMADA'`)).recordset[0];
            if (!v) throw error('La verificación de temperatura indicada no existe, no es de este equipo o aún no está firmada.');
            vTipo = 'TEMPERATURA'; vId = v.id_verificacion; vCodigo = `(OI-FoGe-39 N° ${v.id_verificacion})`; vFecha = v.fecha;
        } else if (body.verificacion_tipo === 'CAUDAL' && body.verificacion_id) {
            const v = (await pool.request().input('v', sql.Int, Number(body.verificacion_id)).input('e', sql.Numeric(10, 0), idEquipo).query(`
                SELECT id_verificacion, CONVERT(VARCHAR(10), fecha_verificacion, 23) AS fecha FROM mae_verificacion_caudal
                WHERE id_verificacion = @v AND id_equipo = @e AND estado = 'FIRMADA'`)).recordset[0];
            if (!v) throw error('La verificación de caudal indicada no existe, no es de este equipo o aún no tiene V°B°.');
            vTipo = 'CAUDAL'; vId = v.id_verificacion; vCodigo = `(OI-FoGe-30 N° ${v.id_verificacion})`; vFecha = v.fecha;
        } else if (body.verificacion_tipo === 'CAUDAL') {
            // Respaldo: una verificación hecha fuera del sistema (código y fecha a mano).
            if (!texto(body.verificacion_codigo, 100) || !esFecha(body.verificacion_fecha)) throw error('Para vincular una verificación de caudal indique su código y la fecha en que se realizó.');
            vTipo = 'CAUDAL'; vCodigo = texto(body.verificacion_codigo, 100); vFecha = body.verificacion_fecha;
        }

        const r = await pool.request()
            .input('eq', sql.Numeric(10, 0), idEquipo)
            .input('cod', sql.VarChar(100), texto(eq.codigo, 100))
            .input('nom', sql.NVarChar(200), texto(eq.nombre, 200))
            .input('sede', sql.VarChar(10), texto(eq.sede, 10) || null)
            .input('tipo', sql.VarChar(20), body.tipo)
            .input('fecha', sql.Date, body.fecha)
            .input('area', sql.VarChar(10), body.area_realiza)
            .input('rec', sql.VarChar(10), body.estado_recepcion)
            .input('fun', sql.VarChar(12), funcionamiento)
            .input('pat', sql.NVarChar(300), patron || null)
            .input('obs', sql.NVarChar(1500), observacion)
            .input('vt', sql.VarChar(12), vTipo)
            .input('vi', sql.Int, vId)
            .input('vc', sql.NVarChar(100), vCodigo)
            .input('vf', sql.Date, vFecha)
            .input('u', sql.Numeric(10, 0), Number(usuario.id))
            .input('un', sql.NVarChar(150), texto(usuario.name, 150) || null)
            .query(`INSERT INTO ${TABLA} (id_equipo, codigo_equipo, nombre_equipo, sede, tipo, fecha, area_realiza, estado_recepcion, funcionamiento,
                        patron_referencia, observacion, verificacion_tipo, verificacion_id, verificacion_codigo, verificacion_fecha, id_usuario_crea, nombre_crea)
                    OUTPUT INSERTED.id_puesta_marcha
                    VALUES (@eq, @cod, @nom, @sede, @tipo, @fecha, @area, @rec, @fun, @pat, @obs, @vt, @vi, @vc, @vf, @u, @un)`);
        const id = r.recordset[0].id_puesta_marcha;
        if (await hayColumnasItems(pool)) {
            await pool.request().input('id', sql.Int, id)
                .input('items', sql.NVarChar(1000), JSON.stringify(itemsValidos(body.items)))
                .input('otros', sql.NVarChar(300), texto(body.otros, 300) || null)
                .query(`UPDATE ${TABLA} SET items = @items, otros = @otros WHERE id_puesta_marcha = @id`);
        }
        logger.info(`Puesta en marcha ${id} registrada para el equipo ${eq.codigo} por ${usuario.id}`);
        auditar(usuario, 'CREACION', { id_puesta_marcha: id, codigo_equipo: eq.codigo }, `Puesta en marcha registrada (${NOMBRE_TIPO[body.tipo]}, ${dmy(body.fecha)})`);
        return this.obtener(id, usuario);
    },

    /**
     * Firma una de las dos partes. Quien la realiza y quien la valida son personas distintas; con las dos firmas la puesta en
     * marcha queda aprobada y se escribe en el historial del equipo (una sola vez).
     * body: { rol: 'TECNICA' | 'CALIDAD', imagen? (data URL), usar_registrada?, id_muestreador? }
     * Por Medio Ambiente también firma un muestreador con competencias (body.id_muestreador): con su firma registrada o
     * dibujada en el momento.
     */
    async firmar(id, body = {}, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const p = await cargar(pool, id);
        if (p.estado !== 'PENDIENTE_FIRMA') throw error(p.estado === 'APROBADA' ? 'La puesta en marcha ya está aprobada.' : 'La puesta en marcha está anulada.', 409);
        const rol = body.rol;
        if (!AREAS.includes(rol)) throw error('Indique si firma por el Área Técnica o por Gestión de Calidad.');
        const columna = rol === 'TECNICA' ? 'tecnica' : 'calidad';
        const otra = rol === 'TECNICA' ? 'calidad' : 'tecnica';
        if (p[`firma_${columna}`]) throw error(`La firma de ${NOMBRE_AREA[rol]} ya está registrada.`, 409);

        let imagen = '';
        let nombre = texto(usuario.name, 150);
        let idFirmante = Number(usuario.id);
        if (rol === 'TECNICA' && body.id_muestreador) {
            // Firma un muestreador con competencias (no es usuario de la aplicación).
            const m = (await pool.request().input('m', sql.Numeric(10, 0), Number(body.id_muestreador)).query(`
                SELECT m.id_muestreador, m.nombre_muestreador, m.firma_muestreador,
                       (SELECT COUNT(*) FROM mae_muestreador_competencia mc WHERE mc.id_muestreador = m.id_muestreador) AS competencias
                FROM mae_muestreador m WHERE m.id_muestreador = @m AND ISNULL(m.habilitado, 'S') = 'S'`)).recordset[0];
            if (!m) throw error('Muestreador no encontrado o no habilitado.', 404);
            if (!m.competencias) throw error(`${m.nombre_muestreador} no tiene competencias registradas: no puede firmar la puesta en marcha.`, 403);
            if (body.usar_registrada) {
                imagen = (await firmaDigitalService.vigente('MUESTREADOR', m.id_muestreador))?.imagen
                    || (String(m.firma_muestreador || '').startsWith('data:image') ? m.firma_muestreador : '');
                if (!imagen) throw error(`${m.nombre_muestreador} no tiene una firma registrada.`);
            }
            nombre = texto(m.nombre_muestreador, 150);
            idFirmante = null;
        } else {
            const areas = await areasDe(pool, usuario);
            if (!areas[rol]) {
                throw error(rol === 'CALIDAD'
                    ? 'No tiene el permiso para firmar por Gestión de Calidad.'
                    : 'No tiene el permiso para firmar por el Área Técnica (también puede firmar un muestreador con competencias).', 403);
            }
            if (p[`id_usuario_${otra}`] && Number(p[`id_usuario_${otra}`]) === Number(usuario.id)) {
                throw error('La puesta en marcha la verifica una persona y la valida otra: ya firmó por la otra parte.', 409);
            }
            if (body.usar_registrada) {
                imagen = (await firmaDigitalService.vigente('USUARIO', usuario.id))?.imagen || '';
                if (!imagen) throw error('No tiene una firma registrada en su perfil.');
            }
        }
        if (!imagen && esImagen(body.imagen)) imagen = body.imagen;
        if (!imagen) throw error('Firme para continuar.');

        const upd = await pool.request()
            .input('id', sql.Int, Number(id))
            .input('firma', sql.NVarChar(sql.MAX), imagen)
            .input('nom', sql.NVarChar(150), nombre || null)
            .input('u', sql.Numeric(10, 0), idFirmante)
            .query(`UPDATE ${TABLA} SET firma_${columna} = @firma, nombre_${columna} = @nom, id_usuario_${columna} = @u,
                        fecha_firma_${columna} = GETDATE(), fecha_modificacion = GETDATE()
                    WHERE id_puesta_marcha = @id AND estado = 'PENDIENTE_FIRMA' AND firma_${columna} IS NULL`);
        if (!upd.rowsAffected[0]) throw error('La puesta en marcha cambió mientras firmaba; ábrala de nuevo.', 409);

        auditar(usuario, 'FIRMA', p, `Firma de ${NOMBRE_AREA[rol]}: ${nombre}`);
        // Si esta firma venía de un envío ("Enviar a firmar"), queda resuelto y se avisa a quien la envió.
        if (await hayTablaAsignacion(pool)) {
            const asig = (await pool.request().input('id', sql.Int, Number(id)).input('rol', sql.VarChar(10), rol)
                .query(`UPDATE ${TABLA_ASIG} SET estado = 'FIRMADA', fecha_resuelta = GETDATE()
                        OUTPUT INSERTED.id_usuario_envia
                        WHERE id_puesta_marcha = @id AND rol = @rol AND estado = 'PENDIENTE'`)).recordset[0];
            if (asig?.id_usuario_envia && Number(asig.id_usuario_envia) !== Number(usuario.id)) {
                await notificar(Number(asig.id_usuario_envia), 'Firma registrada',
                    `${nombre || 'Alguien'} firmó la puesta en marcha de ${p.codigo_equipo || p.nombre_equipo} por ${NOMBRE_AREA[rol]}.`, Number(id));
            }
        }
        const actual = await cargar(pool, id);
        if (actual.firma_tecnica && actual.firma_calidad) await this._aprobar(pool, actual, usuario);
        return this.obtener(id, usuario);
    },

    /** Personas que tienen el permiso para firmar por ese rol (para elegir a quién enviarle la firma). */
    async usuariosParaFirmar(rol) {
        if (!AREAS.includes(rol)) throw error('Indique por qué área: Área Técnica o Gestión de Calidad.');
        const pool = await getConnection();
        const codigo = rol === 'CALIDAD' ? PERMISOS_GC.FIRMA_CALIDAD : PERMISOS_GC.FIRMA_TECNICA;
        const candidatos = (await pool.request().query(
            "SELECT id_usuario, nombre_usuario FROM mae_usuario WHERE habilitado = 'S' ORDER BY nombre_usuario")).recordset;
        const resultado = [];
        for (const u of candidatos) {
            if (await puedeGc(pool, u.id_usuario, codigo)) resultado.push({ id_usuario: u.id_usuario, nombre: u.nombre_usuario });
        }
        return resultado;
    },

    /** Envía a firmar la parte que falta a una persona concreta: le llega como «Firmas pendientes». */
    async enviarAFirmar(id, body = {}, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        await exigirTablaAsignacion(pool);
        const p = await cargar(pool, id);
        if (p.estado !== 'PENDIENTE_FIRMA') throw error('Esta puesta en marcha ya no tiene firmas pendientes.', 409);
        const rol = body.rol;
        if (!AREAS.includes(rol)) throw error('Indique por qué área: Área Técnica o Gestión de Calidad.');
        const columna = rol === 'TECNICA' ? 'tecnica' : 'calidad';
        if (p[`firma_${columna}`]) throw error(`La firma de ${NOMBRE_AREA[rol]} ya está registrada.`, 409);
        const idDestino = Number(body.id_usuario_destino);
        if (!idDestino) throw error('Elija a quién enviarle la firma.');
        const codigo = rol === 'CALIDAD' ? PERMISOS_GC.FIRMA_CALIDAD : PERMISOS_GC.FIRMA_TECNICA;
        if (!(await puedeGc(pool, idDestino, codigo))) {
            throw error(`Esa persona no tiene el permiso para firmar por ${NOMBRE_AREA[rol]}.`);
        }
        const destino = (await pool.request().input('u', sql.Numeric(10, 0), idDestino)
            .query("SELECT nombre_usuario FROM mae_usuario WHERE id_usuario = @u AND habilitado = 'S'")).recordset[0];
        if (!destino) throw error('Usuario no encontrado o deshabilitado.', 404);

        // Si ya había un envío pendiente para este rol (a otra persona u a la misma), queda anulado: solo rige el último.
        await pool.request().input('id', sql.Int, Number(id)).input('rol', sql.VarChar(10), rol)
            .query(`UPDATE ${TABLA_ASIG} SET estado = 'ANULADA', fecha_resuelta = GETDATE() WHERE id_puesta_marcha = @id AND rol = @rol AND estado = 'PENDIENTE'`);
        await pool.request()
            .input('pm', sql.Int, Number(id)).input('rol', sql.VarChar(10), rol)
            .input('dest', sql.Numeric(10, 0), idDestino).input('envia', sql.Numeric(10, 0), Number(usuario.id))
            .query(`INSERT INTO ${TABLA_ASIG} (id_puesta_marcha, rol, id_usuario_destino, id_usuario_envia) VALUES (@pm, @rol, @dest, @envia)`);

        await notificar(idDestino, 'Firma pendiente: puesta en marcha',
            `${texto(usuario.name, 150) || 'Alguien'} le envió la puesta en marcha de ${p.codigo_equipo || p.nombre_equipo} para que la firme por ${NOMBRE_AREA[rol]}.`,
            Number(id));
        return this.obtener(id, usuario);
    },

    /** Puestas en marcha que le enviaron a firmar a esta persona y siguen pendientes. */
    async misFirmasPendientes(usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        if (!(await hayTablaAsignacion(pool))) return [];
        const r = await pool.request().input('u', sql.Numeric(10, 0), Number(usuario.id)).query(`
            SELECT p.id_puesta_marcha, p.codigo_equipo, p.nombre_equipo, p.nombre_crea, a.rol, a.fecha_creacion
            FROM ${TABLA_ASIG} a JOIN ${TABLA} p ON p.id_puesta_marcha = a.id_puesta_marcha
            WHERE a.id_usuario_destino = @u AND a.estado = 'PENDIENTE' AND p.estado = 'PENDIENTE_FIRMA'
            ORDER BY a.fecha_creacion DESC`);
        return r.recordset;
    },

    /**
     * Escribe la línea de la puesta en marcha en el historial del equipo. Si falla, la deja marcada como pendiente
     * (en_historial = 0) y se vuelve a intentar la próxima vez que alguien abra la puesta en marcha.
     */
    async _escribirHistorial(pool, p, usuario) {
        try {
            const linea = lineaHistorial(p, await adjuntosDe(pool, p.id_puesta_marcha));
            await equipoService.updateEquipo(Number(p.id_equipo), { observacion_agregada: linea }, Number(usuario.id));
            await pool.request().input('id', sql.Int, p.id_puesta_marcha).query(`UPDATE ${TABLA} SET en_historial = 1 WHERE id_puesta_marcha = @id`);
            return true;
        } catch (e) {
            await pool.request().input('id', sql.Int, p.id_puesta_marcha).query(`UPDATE ${TABLA} SET en_historial = 0 WHERE id_puesta_marcha = @id`);
            logger.error(`Puesta en marcha ${p.id_puesta_marcha} aprobada, pero no se pudo escribir en el historial del equipo:`, e);
            return false;
        }
    },

    /** Con las dos firmas: queda aprobada y entra al historial del equipo. El estado del equipo no se toca. */
    async _aprobar(pool, p, usuario) {
        const marca = await pool.request().input('id', sql.Int, p.id_puesta_marcha).query(
            `UPDATE ${TABLA} SET estado = 'APROBADA', en_historial = 1, fecha_modificacion = GETDATE()
             WHERE id_puesta_marcha = @id AND estado = 'PENDIENTE_FIRMA' AND en_historial = 0`);
        if (!marca.rowsAffected[0]) return;
        await this._escribirHistorial(pool, p, usuario);
        // El formulario OI-FoGe-42 firmado queda también en el Archivo de Fichas de Gestión de Calidad, como las demás fichas.
        try {
            const eq = (await pool.request().input('id', sql.Int, Number(p.id_equipo)).query('SELECT id_equipo, codigo, nombre, sede FROM mae_equipo WHERE id_equipo = @id')).recordset[0]
                || { id_equipo: p.id_equipo, codigo: p.codigo_equipo, nombre: p.nombre_equipo, sede: p.sede };
            const pdf = await this.pdf(p.id_puesta_marcha, usuario);
            const firmante = (rolArea) => {
                const c = rolArea === 'TECNICA' ? 'tecnica' : 'calidad';
                return {
                    rol: rolArea === p.area_realiza ? 'REALIZA' : 'VALIDA', tipo_firmante: 'USUARIO', id_firmante: Number(p[`id_usuario_${c}`]) || null,
                    nombre_firmante: p[`nombre_${c}`] || null, cargo: NOMBRE_AREA[rolArea], modo: 'EN_EL_MOMENTO', id_firma: null,
                };
            };
            await gcDocumentosService.guardarFichaEquipo({
                tipo: 'recepcion', equipo: eq, anio: Number(String(p.fecha).slice(0, 4)), ...pdf,
                datos: { origen: 'PUESTA_EN_MARCHA', id_puesta_marcha: p.id_puesta_marcha, tipo: p.tipo, fecha: p.fecha },
                usuario, firmas: [firmante(p.area_realiza), firmante(p.area_realiza === 'TECNICA' ? 'CALIDAD' : 'TECNICA')],
            });
        } catch (e) {
            logger.error(`Puesta en marcha ${p.id_puesta_marcha} aprobada, pero no se pudo guardar en el Archivo de Fichas:`, e);
        }
    },

    async anular(id, motivo, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const p = await cargar(pool, id);
        if (p.estado === 'APROBADA') throw error('Una puesta en marcha aprobada ya está en el historial del equipo y no se puede anular.', 409);
        if (p.estado === 'ANULADA') throw error('Ya está anulada.', 409);
        const m = texto(motivo, 300);
        if (!m) throw error('Indique el motivo de la anulación.');
        await pool.request().input('id', sql.Int, Number(id)).input('m', sql.NVarChar(300), m)
            .query(`UPDATE ${TABLA} SET estado = 'ANULADA', motivo_anulacion = @m, fecha_modificacion = GETDATE() WHERE id_puesta_marcha = @id`);
        logger.info(`Puesta en marcha ${id} anulada por ${usuario?.id}`);
        auditar(usuario, 'ANULACION', p, `Anulada: ${m}`);
        return this.obtener(id, usuario);
    },

    /**
     * Documentos que se adjuntan después (el proveedor demora). Ya aprobada, solo Gestión de Calidad adjunta; el documento
     * con su observación complementa la línea de la puesta en marcha en el historial del equipo.
     */
    async adjuntar(id, { documento, archivo, observacion }, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const p = await cargar(pool, id);
        const descartar = () => { if (archivo?.path) fs.unlink(archivo.path, () => {}); };
        if (p.estado === 'ANULADA') { descartar(); throw error('La puesta en marcha está anulada.', 409); }
        if (p.estado === 'APROBADA') {
            try { await exigirCalidad(pool, usuario, 'adjuntar documentos a una puesta en marcha aprobada'); } catch (e) { descartar(); throw e; }
        }
        const doc = texto(documento, 200);
        if (!doc) { descartar(); throw error('Indique qué documento es.'); }
        if (!archivo) throw error('Seleccione el archivo.');
        const obs = texto(observacion, 500);
        const conObs = await hayColumnaObsAdjunto(pool);
        await pool.request()
            .input('id', sql.Int, Number(id))
            .input('doc', sql.NVarChar(200), doc)
            .input('nom', sql.NVarChar(260), texto(archivo.originalname, 260))
            .input('ruta', sql.NVarChar(500), archivo.filename)
            .input('u', sql.Numeric(10, 0), Number(usuario.id))
            .input('un', sql.NVarChar(150), texto(usuario.name, 150) || null)
            .input('obs', sql.NVarChar(500), obs || null)
            .query(`INSERT INTO ${TABLA_ADJ} (id_puesta_marcha, documento, archivo_nombre, archivo_ruta, id_usuario, nombre_usuario${conObs ? ', observacion' : ''})
                    VALUES (@id, @doc, @nom, @ruta, @u, @un${conObs ? ', @obs' : ''})`);
        auditar(usuario, 'ADJUNTO', p, `Documento adjuntado: ${doc}${obs ? ` (${obs})` : ''}`);
        // Aprobada y ya en el historial: el documento complementa el evento (lo que ven los auditores).
        if (p.estado === 'APROBADA' && p.en_historial) {
            try {
                await equipoService.updateEquipo(Number(p.id_equipo), { observacion_agregada: lineaComplemento(p, doc, obs) }, Number(usuario.id));
            } catch (e) {
                logger.error(`No se pudo complementar el historial con el documento de la puesta en marcha ${id}:`, e);
            }
        }
        return this.obtener(id, usuario);
    },

    async eliminarAdjunto(idAdjunto, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const a = (await pool.request().input('a', sql.Int, Number(idAdjunto)).query(`SELECT id_puesta_marcha, documento, archivo_ruta FROM ${TABLA_ADJ} WHERE id_adjunto = @a`)).recordset[0];
        if (!a) throw error('Documento no encontrado.', 404);
        const p = await cargar(pool, a.id_puesta_marcha);
        if (p.estado === 'APROBADA') await exigirCalidad(pool, usuario, 'quitar documentos de una puesta en marcha aprobada');
        await pool.request().input('a', sql.Int, Number(idAdjunto)).query(`DELETE FROM ${TABLA_ADJ} WHERE id_adjunto = @a`);
        fs.unlink(path.join(carpetaAdjuntos, path.basename(a.archivo_ruta)), () => {});
        auditar(usuario, 'ADJUNTO_ELIMINADO', p, `Documento quitado: ${a.documento}`);
        return this.obtener(a.id_puesta_marcha, usuario);
    },

    /**
     * Edición de una puesta en marcha (también ya aprobada): solo Gestión de Calidad, que lleva el control documental.
     * Lo que cambia queda en el registro interno con el valor anterior y el nuevo; no se reescribe el historial del equipo.
     */
    async editar(id, body = {}, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const p = await cargar(pool, id);
        if (p.estado === 'ANULADA') throw error('La puesta en marcha está anulada.', 409);
        await exigirCalidad(pool, usuario, 'editar una puesta en marcha');
        const motivo = texto(body.motivo, 300);
        if (!motivo) throw error('Indique el motivo del cambio: queda en el registro interno.');

        const nuevo = {};
        if (body.fecha !== undefined) {
            if (!esFecha(body.fecha) || body.fecha > hoyYmd()) throw error('La fecha no es válida.');
            nuevo.fecha = body.fecha;
        }
        if (body.estado_recepcion !== undefined) {
            if (!['CUMPLE', 'NO_CUMPLE'].includes(body.estado_recepcion)) throw error('Estado de recepción no válido.');
            nuevo.estado_recepcion = body.estado_recepcion;
        }
        if (body.funcionamiento !== undefined) {
            if (!['OPERATIVO', 'NO_OPERATIVO'].includes(body.funcionamiento)) throw error('Funcionamiento no válido.');
            nuevo.funcionamiento = body.funcionamiento;
        }
        if (body.patron_referencia !== undefined) nuevo.patron_referencia = texto(body.patron_referencia, 300) || null;
        if (body.observacion !== undefined) {
            nuevo.observacion = texto(body.observacion, 1500);
            if (!nuevo.observacion) throw error('La observación no puede quedar vacía.');
        }
        const conItems = await hayColumnasItems(pool);
        if (conItems && body.items !== undefined) nuevo.items = JSON.stringify(itemsValidos(body.items));
        if (conItems && body.otros !== undefined) nuevo.otros = texto(body.otros, 300) || null;

        const antes = {};
        const despues = {};
        for (const [k, v] of Object.entries(nuevo)) {
            const previo = p[k] === undefined ? null : p[k];
            if (String(previo ?? '') !== String(v ?? '')) { antes[k] = previo; despues[k] = v; }
        }
        if (!Object.keys(despues).length) return this.obtener(id, usuario);

        const req = pool.request().input('id', sql.Int, Number(id));
        const sets = [];
        const TIPOS_SQL = {
            fecha: sql.Date, estado_recepcion: sql.VarChar(10), funcionamiento: sql.VarChar(12), patron_referencia: sql.NVarChar(300),
            observacion: sql.NVarChar(1500), items: sql.NVarChar(1000), otros: sql.NVarChar(300),
        };
        for (const [k, v] of Object.entries(despues)) { req.input(k, TIPOS_SQL[k], v); sets.push(`${k} = @${k}`); }
        await req.query(`UPDATE ${TABLA} SET ${sets.join(', ')}, fecha_modificacion = GETDATE() WHERE id_puesta_marcha = @id`);
        auditar(usuario, 'EDICION', p, `Editada (${Object.keys(despues).join(', ')}). Motivo: ${motivo}`, antes, { ...despues, motivo });
        return this.obtener(id, usuario);
    },

    /** Registro interno de uso de una puesta en marcha (quién hizo qué y cuándo): solo para Gestión de Calidad. */
    async registroInterno(id, usuario) {
        const pool = await getConnection();
        await exigirCalidad(pool, usuario, 'ver el registro interno');
        const r = await pool.request().input('id', sql.NVarChar(100), String(Number(id))).query(`
            SELECT TOP 100 a.fecha_registro, a.evento_tipo, a.descripcion_humana, a.datos_anteriores, a.datos_nuevos, u.usuario AS nombre_usuario
            FROM App_Audit_Log a LEFT JOIN mae_usuario u ON u.id_usuario = a.usuario_id
            WHERE a.entidad_nombre = 'mae_puesta_marcha' AND a.entidad_id = @id
            ORDER BY a.fecha_registro DESC`);
        return r.recordset;
    },

    /** Quién puede firmar: las áreas de quien mira y los muestreadores con competencias (firman por Medio Ambiente). */
    async firmantes(usuario) {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT m.id_muestreador, m.nombre_muestreador,
                   CASE WHEN m.firma_muestreador LIKE 'data:image%' THEN 1 ELSE 0 END AS firma_legacy
            FROM mae_muestreador m
            WHERE ISNULL(m.habilitado, 'S') = 'S'
              AND EXISTS (SELECT 1 FROM mae_muestreador_competencia mc WHERE mc.id_muestreador = m.id_muestreador)
            ORDER BY m.nombre_muestreador`);
        const muestreadores = [];
        for (const m of r.recordset) {
            const registrada = !!m.firma_legacy || !!(await firmaDigitalService.vigente('MUESTREADOR', m.id_muestreador).catch(() => null));
            muestreadores.push({ id_muestreador: m.id_muestreador, nombre: m.nombre_muestreador, firma_registrada: registrada });
        }
        return { areas: await areasDe(pool, usuario), muestreadores };
    },

    /** Equipos que sirven de patrón o referencia: termómetros patrón, molinetes y muestreadores automáticos. */
    async patronesReferencia() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT id_equipo, codigo, nombre, tipoequipo, sede FROM mae_equipo
            WHERE tipoequipo IN ('Termometro patrón', 'Molinete', 'MUESTREADOR AUTOMÁTICO')
              AND ISNULL(Estado, '') NOT LIKE '%baja%'
            ORDER BY tipoequipo, codigo`);
        return r.recordset;
    },

    async archivoAdjunto(idAdjunto) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const a = (await pool.request().input('a', sql.Int, Number(idAdjunto)).query(`SELECT archivo_nombre, archivo_ruta FROM ${TABLA_ADJ} WHERE id_adjunto = @a`)).recordset[0];
        if (!a) throw error('Documento no encontrado.', 404);
        const ruta = path.join(carpetaAdjuntos, path.basename(a.archivo_ruta));
        if (!fs.existsSync(ruta)) throw error('El archivo ya no está en el servidor.', 404);
        return { ruta, nombre: a.archivo_nombre };
    },

    /** El formulario OI-FoGe-42 de esta puesta en marcha, con las firmas que ya tiene. */
    async pdf(id, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const p = await cargar(pool, id);
        const eq = (await pool.request().input('id', sql.Int, Number(p.id_equipo)).query('SELECT codigo, nombre, marca, modelo, n_serie FROM mae_equipo WHERE id_equipo = @id')).recordset[0] || {};
        return fichasEquipoService.recepcionPdf(cuerpoPdf({ ...p, items: leerItems(p.items) }, eq), usuario);
    },

    /**
     * Vista previa del OI-FoGe-42 mientras se llena una puesta en marcha nueva (no se guarda nada). Lo que falta queda
     * en blanco, como en el formulario impreso.
     */
    async vistaPrevia(body = {}, usuario) {
        const pool = await getConnection();
        const idEquipo = Number(body.id_equipo);
        const eq = idEquipo > 0
            ? (await pool.request().input('id', sql.Int, idEquipo).query('SELECT codigo, nombre, marca, modelo, n_serie FROM mae_equipo WHERE id_equipo = @id')).recordset[0] || {}
            : {};
        const rec = ['CUMPLE', 'NO_CUMPLE'].includes(body.estado_recepcion) ? body.estado_recepcion : '';
        const borrador = {
            tipo: TIPOS.includes(body.tipo) ? body.tipo : 'EQUIPO_NUEVO',
            fecha: esFecha(body.fecha) ? body.fecha : '',
            estado_recepcion: rec,
            funcionamiento: funcionamientoDe(rec, body.funcionamiento),
            patron_referencia: texto(body.patron_referencia, 300),
            observacion: texto(body.observacion, 1500),
            verificacion_tipo: ['TEMPERATURA', 'CAUDAL'].includes(body.verificacion_tipo) ? body.verificacion_tipo : null,
            items: itemsValidos(body.items),
            otros: texto(body.otros, 300),
        };
        // Sin código ni nombre el formulario no se puede generar: se muestra en blanco con un guion.
        const datos = cuerpoPdf(borrador, eq);
        if (!datos.codigo && !datos.nombre) datos.nombre = '—';
        return fichasEquipoService.recepcionPdf(datos, usuario);
    },

    /**
     * Vista previa del OI-FoGe-42 mientras se edita una puesta en marcha guardada: el formulario como quedaría
     * (con el logo, el encabezado y las firmas que ya tiene) con los cambios aplicados. No guarda nada.
     */
    async vistaPreviaEdicion(id, body = {}, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const p = await cargar(pool, id);
        const eq = (await pool.request().input('id', sql.Int, Number(p.id_equipo)).query('SELECT codigo, nombre, marca, modelo, n_serie FROM mae_equipo WHERE id_equipo = @id')).recordset[0] || {};
        const editado = { ...p, items: leerItems(p.items) };
        if (esFecha(body.fecha)) editado.fecha = body.fecha;
        if (['CUMPLE', 'NO_CUMPLE'].includes(body.estado_recepcion)) editado.estado_recepcion = body.estado_recepcion;
        if (['OPERATIVO', 'NO_OPERATIVO'].includes(body.funcionamiento)) editado.funcionamiento = body.funcionamiento;
        if (body.patron_referencia !== undefined) editado.patron_referencia = texto(body.patron_referencia, 300);
        if (body.observacion !== undefined) editado.observacion = texto(body.observacion, 1500);
        if (body.items !== undefined) editado.items = itemsValidos(body.items);
        if (body.otros !== undefined) editado.otros = texto(body.otros, 300);
        return fichasEquipoService.recepcionPdf(cuerpoPdf(editado, eq), usuario);
    },
};

export default puestaMarchaService;
