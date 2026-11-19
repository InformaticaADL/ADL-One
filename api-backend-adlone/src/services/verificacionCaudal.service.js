import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import auditService from './audit.service.js';
import firmaDigitalService from './firmaDigital.service.js';
import gcDocumentosService from './gcDocumentos.service.js';
import revisionDocumentalService from './revisionDocumental.service.js';
import { equipoService } from './equipo.service.js';
import { PERMISOS_GC, puedeGc } from '../utils/permisosCalidad.js';
import { pdfCaudal } from './fichasEquipo.pdf.js';
import { calcularCaudal, lecturasValidas, MIN_LECTURAS } from '../utils/verificacionCaudal.calc.js';
import { calcularSiguiente } from '../utils/reglasControlEquipo.js';

// Formulario OI-FoGe-30 «Verificación Intermedia Sonda Caudal» (migrations/add_verificacion_caudal.sql).
//
// Se verifica una sonda de caudal contra un equipo de referencia (molinete): se anotan el caudal de referencia y las
// lecturas de la sonda (hasta 10); el sistema calcula el promedio, el % de desviación y el índice (caudal menor / caudal
// mayor) con su grado de correlación, y se acepta un índice > 0,90 (±10 %). Queda en BORRADOR mientras se llena; con
// el V°B° queda FIRMADA y se aplica al equipo:
//   · cumple    → última verificación = fecha; siguiente = fecha próxima (según el control de fechas del equipo:
//                 contrastación semestral, o trimestral si así está definido); la vigencia se extiende.
//   · no cumple → el equipo pasa a Fuera de Servicio hasta corregirse y verificarse de nuevo.
// En ambos casos queda una línea en el historial del equipo y el PDF firmado en el Archivo de Fichas.

const TABLA = 'mae_verificacion_caudal';
const error = (mensaje, statusCode = 400) => Object.assign(new Error(mensaje), { statusCode });
const hoyYmd = () => new Date().toISOString().slice(0, 10);
const esFecha = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const dmy = (ymd) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');
const dmyCorto = (ymd) => `${ymd.slice(8, 10)}.${ymd.slice(5, 7)}.${ymd.slice(2, 4)}`;
const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(',', '.')));
const fmt = (n, d = 2) => (n === null || n === undefined ? '' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: d }));
const esImagen = (f) => /^data:image\/(png|jpeg);base64,/.test(String(f || '')) && String(f).length <= 900_000;
export const UNIDADES = ['L/s', 'm³/h'];

/** La línea que queda en el historial del equipo al firmar la verificación. */
export const lineaHistorialCaudal = (v) => {
    const r = `${v.cumple ? 'Cumple' : 'NO CUMPLE'}`;
    const datos = `Caudal referencia ${fmt(v.caudal_referencia, 4)} ${v.unidad || ''} (${v.equipo_referencia || 'equipo de referencia'}), promedio sonda ${fmt(v.caudal_promedio, 3)} ${v.unidad || ''}, desviación ${fmt(v.desviacion_pct)} %, índice ${fmt(v.indice, 3)} (${v.grado})`;
    return `${dmyCorto(v.fecha_verificacion)} Verificación intermedia de caudal (OI-FoGe-30, N° ${v.id_verificacion}): ${r}. ${datos.replace(/\s+/g, ' ').trim()}.`
        + (v.cumple ? '' : ' Equipo pasa a Fuera de Servicio hasta su corrección y nueva verificación.');
};

const exigirTabla = async (pool) => {
    const r = await pool.request().query(`SELECT OBJECT_ID('${TABLA}', 'U') AS t`);
    if (!r.recordset[0].t) throw error('Falta ejecutar la migración add_verificacion_caudal.sql para usar la verificación de caudal.', 503);
};


const auditar = (usuario, evento, v, descripcion) => auditService.log({
    usuario_id: usuario?.id ? Number(usuario.id) : null, area_key: 'calidad', modulo_nombre: 'Verificación Caudal', evento_tipo: evento,
    entidad_nombre: TABLA, entidad_id: v.id_verificacion, descripcion_humana: `${v.codigo_equipo || ''}: ${descripcion}`.slice(0, 500),
});

const COLUMNAS = `v.id_verificacion, v.id_equipo, v.codigo_equipo, v.nombre_equipo, v.sede,
    CONVERT(VARCHAR(10), v.fecha_verificacion, 23) AS fecha_verificacion, CONVERT(VARCHAR(10), v.fecha_proxima, 23) AS fecha_proxima,
    v.id_equipo_referencia, v.equipo_referencia, v.caudal_referencia, v.unidad, v.lecturas, v.caudal_promedio, v.desviacion_pct,
    v.indice, v.grado, v.cumple, v.observacion, v.estado, v.firma_vobo, v.nombre_vobo, v.id_usuario_vobo, v.fecha_firma,
    v.motivo_anulacion, v.nombre_crea, v.fecha_creacion`;

const leerLecturas = (j) => { try { return lecturasValidas(JSON.parse(j || '[]')); } catch { return []; } };

const publica = (v) => ({
    id_verificacion: v.id_verificacion,
    id_equipo: Number(v.id_equipo),
    codigo_equipo: v.codigo_equipo,
    nombre_equipo: v.nombre_equipo,
    sede: v.sede,
    fecha_verificacion: v.fecha_verificacion,
    fecha_proxima: v.fecha_proxima,
    id_equipo_referencia: v.id_equipo_referencia ? Number(v.id_equipo_referencia) : null,
    equipo_referencia: v.equipo_referencia,
    caudal_referencia: num(v.caudal_referencia),
    unidad: v.unidad,
    lecturas: leerLecturas(v.lecturas),
    caudal_promedio: num(v.caudal_promedio),
    desviacion_pct: num(v.desviacion_pct),
    indice: num(v.indice),
    grado: v.grado,
    cumple: v.cumple === null || v.cumple === undefined ? null : !!v.cumple,
    observacion: v.observacion,
    estado: v.estado,
    firmada: !!v.firma_vobo,
    nombre_vobo: v.nombre_vobo,
    fecha_firma: v.fecha_firma,
    motivo_anulacion: v.motivo_anulacion,
    nombre_crea: v.nombre_crea,
    fecha_creacion: v.fecha_creacion,
});

const cargar = async (pool, id) => {
    const r = await pool.request().input('id', sql.Int, Number(id)).query(`SELECT ${COLUMNAS} FROM ${TABLA} v WHERE v.id_verificacion = @id`);
    if (!r.recordset[0]) throw error('Verificación no encontrada.', 404);
    return r.recordset[0];
};

const sondaDe = async (pool, idEquipo) => {
    const e = (await pool.request().input('id', sql.Int, Number(idEquipo)).query(`
        SELECT id_equipo, codigo, nombre, tipoequipo, sede, Estado AS estado_equipo, modalidad_control
        FROM mae_equipo WHERE id_equipo = @id`)).recordset[0];
    if (!e) throw error('Equipo no encontrado.', 404);
    if (!/caudal/i.test(`${e.tipoequipo} ${e.nombre}`)) throw error(`${e.codigo} no es una sonda de caudal.`);
    if (/baja/i.test(String(e.estado_equipo || ''))) throw error(`${e.codigo} está dado de baja: no corresponde verificarlo.`, 409);
    return e;
};

/** Datos del formulario con el resultado calculado (para guardar y para la vista previa). */
const armar = async (pool, body, eq) => {
    const fecha = esFecha(body.fecha_verificacion) ? body.fecha_verificacion : '';
    const lecturas = lecturasValidas(body.lecturas);
    const calc = calcularCaudal({ caudal_referencia: body.caudal_referencia, lecturas });
    let referencia = texto(body.equipo_referencia, 200);
    let idRef = null;
    if (body.id_equipo_referencia) {
        const r = (await pool.request().input('id', sql.Int, Number(body.id_equipo_referencia)).query('SELECT id_equipo, codigo, tipoequipo FROM mae_equipo WHERE id_equipo = @id')).recordset[0];
        if (r) { idRef = Number(r.id_equipo); referencia = `${r.tipoequipo} ${r.codigo}`; }
    }
    // Próxima verificación: la que se indicó, o la que da el control de fechas del equipo (semestral por defecto).
    const proxima = esFecha(body.fecha_proxima) ? body.fecha_proxima
        : (fecha ? calcularSiguiente(fecha, eq?.modalidad_control || 'CONTRASTACION_SEMESTRAL') : '');
    return {
        fecha_verificacion: fecha,
        fecha_proxima: proxima || null,
        id_equipo_referencia: idRef,
        equipo_referencia: referencia || null,
        caudal_referencia: num(body.caudal_referencia),
        unidad: UNIDADES.includes(body.unidad) ? body.unidad : 'L/s',
        lecturas,
        caudal_promedio: calc.promedio,
        desviacion_pct: calc.desviacion,
        indice: calc.indice,
        grado: calc.grado,
        cumple: calc.cumple,
        completa: calc.completa,
        observacion: texto(body.observacion, 1000) || null,
    };
};

const verificacionCaudalService = {
    async listar({ estado, q, id_equipo } = {}) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const req = pool.request();
        const where = ['1 = 1'];
        if (estado) { req.input('est', sql.VarChar(15), String(estado)); where.push('v.estado = @est'); }
        if (id_equipo) { req.input('eq', sql.Numeric(10, 0), Number(id_equipo)); where.push('v.id_equipo = @eq'); }
        if (q) { req.input('q', sql.NVarChar(200), `%${String(q).trim()}%`); where.push('(v.codigo_equipo LIKE @q OR v.nombre_equipo LIKE @q OR v.equipo_referencia LIKE @q)'); }
        const r = await req.query(`SELECT ${COLUMNAS} FROM ${TABLA} v WHERE ${where.join(' AND ')} ORDER BY v.fecha_verificacion DESC, v.id_verificacion DESC`);
        return r.recordset.map(publica);
    },

    /** Sondas de caudal que se pueden verificar (no las dadas de baja), con su próxima verificación. */
    async elegibles() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT id_equipo, codigo, nombre, sede, Estado AS estado_equipo, modalidad_control,
                   CONVERT(VARCHAR(10), Ultima_verificacion, 23) AS ultima_verificacion,
                   CONVERT(VARCHAR(10), Siguiente_verificacion, 23) AS siguiente_verificacion
            FROM mae_equipo
            WHERE (tipoequipo LIKE '%caudal%' OR nombre LIKE '%caudal%') AND ISNULL(Estado, '') NOT LIKE '%baja%'
            ORDER BY sede, codigo`);
        return r.recordset;
    },

    /** Equipos de referencia: molinetes (no dados de baja). */
    async referencias() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT id_equipo, codigo, nombre, tipoequipo, sede FROM mae_equipo
            WHERE (tipoequipo LIKE '%molinete%' OR nombre LIKE '%molinete%') AND ISNULL(Estado, '') NOT LIKE '%baja%'
            ORDER BY codigo`);
        return r.recordset;
    },

    async obtener(id, usuario = null) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const v = publica(await cargar(pool, id));
        // El V°B° se asigna por permiso en Configurar rol / permisos.
        return { ...v, puede_firmar: v.estado === 'BORRADOR' && (await puedeGc(pool, usuario?.id, PERMISOS_GC.VOBO_CAUDAL)) };
    },

    async crear(body = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const eq = await sondaDe(pool, body.id_equipo);
        const d = await armar(pool, body, eq);
        if (!d.fecha_verificacion) throw error('Indique la fecha de la verificación.');
        if (d.fecha_verificacion > hoyYmd()) throw error('La fecha de la verificación no puede ser futura.');
        const r = await this._guardar(pool, null, { ...d, eq }, usuario);
        auditar(usuario, 'CREACION', { id_verificacion: r, codigo_equipo: eq.codigo }, `Verificación de caudal registrada (${dmy(d.fecha_verificacion)})`);
        return this.obtener(r, usuario);
    },

    async actualizar(id, body = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const v = await cargar(pool, id);
        if (v.estado !== 'BORRADOR') throw error('Solo se puede editar una verificación en borrador.', 409);
        const eq = await sondaDe(pool, v.id_equipo);
        const d = await armar(pool, body, eq);
        if (!d.fecha_verificacion || d.fecha_verificacion > hoyYmd()) throw error('La fecha de la verificación no es válida.');
        await this._guardar(pool, Number(id), { ...d, eq }, usuario);
        return this.obtener(id, usuario);
    },

    async _guardar(pool, id, d, usuario) {
        const req = pool.request()
            .input('fv', sql.Date, d.fecha_verificacion)
            .input('fp', sql.Date, d.fecha_proxima)
            .input('ir', sql.Numeric(10, 0), d.id_equipo_referencia)
            .input('er', sql.NVarChar(200), d.equipo_referencia)
            .input('cr', sql.Decimal(12, 4), d.caudal_referencia)
            .input('un', sql.VarChar(20), d.unidad)
            .input('lec', sql.NVarChar(500), JSON.stringify(d.lecturas))
            .input('cp', sql.Decimal(12, 4), d.caudal_promedio)
            .input('dp', sql.Decimal(8, 2), d.desviacion_pct)
            .input('ix', sql.Decimal(6, 3), d.indice)
            .input('gr', sql.VarChar(20), d.grado)
            .input('cu', sql.Bit, d.cumple === null ? null : d.cumple ? 1 : 0)
            .input('ob', sql.NVarChar(1000), d.observacion);
        if (id) {
            await req.input('id', sql.Int, id).query(`UPDATE ${TABLA} SET fecha_verificacion = @fv, fecha_proxima = @fp, id_equipo_referencia = @ir,
                equipo_referencia = @er, caudal_referencia = @cr, unidad = @un, lecturas = @lec, caudal_promedio = @cp, desviacion_pct = @dp,
                indice = @ix, grado = @gr, cumple = @cu, observacion = @ob, fecha_modificacion = GETDATE() WHERE id_verificacion = @id AND estado = 'BORRADOR'`);
            return id;
        }
        const r = await req
            .input('eq', sql.Numeric(10, 0), Number(d.eq.id_equipo))
            .input('cod', sql.VarChar(100), texto(d.eq.codigo, 100))
            .input('nom', sql.NVarChar(200), texto(d.eq.nombre, 200))
            .input('sede', sql.VarChar(10), texto(d.eq.sede, 10) || null)
            .input('u', sql.Numeric(10, 0), Number(usuario.id))
            .input('unom', sql.NVarChar(150), texto(usuario.name, 150) || null)
            .query(`INSERT INTO ${TABLA} (id_equipo, codigo_equipo, nombre_equipo, sede, fecha_verificacion, fecha_proxima, id_equipo_referencia,
                        equipo_referencia, caudal_referencia, unidad, lecturas, caudal_promedio, desviacion_pct, indice, grado, cumple, observacion,
                        id_usuario_crea, nombre_crea)
                    OUTPUT INSERTED.id_verificacion
                    VALUES (@eq, @cod, @nom, @sede, @fv, @fp, @ir, @er, @cr, @un, @lec, @cp, @dp, @ix, @gr, @cu, @ob, @u, @unom)`);
        return r.recordset[0].id_verificacion;
    },

    /**
     * V°B°: firma quien tiene el rol de Gestión de Calidad o de Medio Ambiente (Técnica, Coordinación, Gerencia Técnica).
     * Exige la verificación completa; la aplica al equipo y guarda el PDF firmado en el Archivo de Fichas.
     */
    async firmar(id, body = {}, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const v = await cargar(pool, id);
        if (v.estado !== 'BORRADOR') throw error('La verificación ya está firmada o anulada.', 409);
        if (!(await puedeGc(pool, usuario?.id, PERMISOS_GC.VOBO_CAUDAL))) throw error('No tiene el permiso para dar el V°B° de la verificación de caudal.', 403);
        const p = publica(v);
        if (!p.equipo_referencia) throw error('Falta el equipo de referencia.');
        if (p.caudal_referencia === null || p.lecturas.length < MIN_LECTURAS) throw error(`Faltan datos: el caudal de referencia y al menos ${MIN_LECTURAS} lecturas de la sonda.`);
        let imagen = '';
        if (body.usar_registrada) imagen = (await firmaDigitalService.vigente('USUARIO', usuario.id))?.imagen || '';
        else if (esImagen(body.imagen)) imagen = body.imagen;
        if (!imagen) throw error(body.usar_registrada ? 'No tiene una firma registrada en su perfil.' : 'Firme para dar el V°B°.');

        const upd = await pool.request().input('id', sql.Int, Number(id)).input('f', sql.NVarChar(sql.MAX), imagen)
            .input('n', sql.NVarChar(150), texto(usuario.name, 150) || null).input('u', sql.Numeric(10, 0), Number(usuario.id))
            .query(`UPDATE ${TABLA} SET estado = 'FIRMADA', firma_vobo = @f, nombre_vobo = @n, id_usuario_vobo = @u, fecha_firma = GETDATE(),
                        fecha_modificacion = GETDATE() WHERE id_verificacion = @id AND estado = 'BORRADOR'`);
        if (!upd.rowsAffected[0]) throw error('La verificación cambió mientras firmaba; ábrala de nuevo.', 409);
        auditar(usuario, 'FIRMA', v, `V°B° de ${usuario.name || ''}: ${p.cumple ? 'cumple' : 'no cumple'}`);

        // Aplicar al equipo.
        try {
            const eq = (await pool.request().input('id', sql.Int, Number(v.id_equipo)).query('SELECT Estado FROM mae_equipo WHERE id_equipo = @id')).recordset[0];
            const payload = { ultima_verificacion: p.fecha_verificacion, observacion_agregada: lineaHistorialCaudal(p) };
            if (p.cumple) {
                if (p.fecha_proxima) {
                    payload.siguiente_verificacion = p.fecha_proxima;
                    if (p.fecha_proxima >= hoyYmd()) payload.vigencia = p.fecha_proxima;
                }
            } else if (!/baja/i.test(String(eq?.Estado || ''))) {
                payload.estado_equipo = 'Fuera de Servicio';
            }
            await equipoService.updateEquipo(Number(v.id_equipo), payload, Number(usuario.id));
        } catch (e) {
            logger.error(`Verificación de caudal ${id} firmada, pero no se pudo aplicar al equipo:`, e);
        }
        // PDF firmado al Archivo de Fichas.
        try {
            const pdf = await this.pdf(id);
            const eq = (await pool.request().input('id', sql.Int, Number(v.id_equipo)).query('SELECT id_equipo, codigo, nombre, sede FROM mae_equipo WHERE id_equipo = @id')).recordset[0];
            await gcDocumentosService.guardarFichaEquipo({
                tipo: 'caudal', equipo: eq || { id_equipo: v.id_equipo, codigo: v.codigo_equipo, nombre: v.nombre_equipo, sede: v.sede },
                anio: Number(p.fecha_verificacion.slice(0, 4)), ...pdf,
                datos: { origen: 'VERIFICACION_CAUDAL', id_verificacion: Number(id) }, usuario,
                firmas: [{ rol: 'VALIDA', tipo_firmante: 'USUARIO', id_firmante: Number(usuario.id), nombre_firmante: usuario.name || null, cargo: 'V°B°', modo: body.usar_registrada ? 'GUARDADA' : 'EN_EL_MOMENTO', id_firma: null }],
            });
        } catch (e) {
            logger.error(`Verificación de caudal ${id} firmada, pero no se pudo guardar en el Archivo de Fichas:`, e);
        }
        return this.obtener(id, usuario);
    },

    async anular(id, motivo, usuario) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const v = await cargar(pool, id);
        if (v.estado !== 'BORRADOR') throw error('Solo se puede anular una verificación en borrador (la firmada ya se aplicó al equipo).', 409);
        const m = texto(motivo, 300);
        if (!m) throw error('Indique el motivo de la anulación.');
        await pool.request().input('id', sql.Int, Number(id)).input('m', sql.NVarChar(300), m)
            .query(`UPDATE ${TABLA} SET estado = 'ANULADA', motivo_anulacion = @m, fecha_modificacion = GETDATE() WHERE id_verificacion = @id`);
        auditar(usuario, 'ANULACION', v, `Anulada: ${m}`);
        return this.obtener(id, usuario);
    },

    async pdf(id) {
        const pool = await getConnection();
        await exigirTabla(pool);
        const v = await cargar(pool, id);
        const buffer = await pdfCaudal({
            ...publica(v), codigo: v.codigo_equipo, nombre: v.nombre_equipo, firma_vobo: v.firma_vobo,
            encabezado: await revisionDocumentalService.encabezado('OI-FoGe-30'),
        });
        return { buffer, nombre: `OI-FoGe-30 ${String(v.codigo_equipo || v.id_verificacion).replace(/[\\/:*?"<>|]+/g, '-')}.pdf` };
    },

    /** El formulario como quedaría con lo que se lleva llenado (no guarda nada). */
    async vistaPrevia(body = {}) {
        const pool = await getConnection();
        let eq = null;
        if (body.id_equipo) {
            eq = (await pool.request().input('id', sql.Int, Number(body.id_equipo)).query('SELECT codigo, nombre, sede, modalidad_control FROM mae_equipo WHERE id_equipo = @id')).recordset[0] || null;
        }
        const d = await armar(pool, body, eq);
        const buffer = await pdfCaudal({ ...d, codigo: eq?.codigo || '', nombre: eq?.nombre || '', sede: eq?.sede || '', encabezado: await revisionDocumentalService.encabezado('OI-FoGe-30') });
        return { buffer };
    },
};

export default verificacionCaudalService;
