import sql from 'mssql';
import { getConnection } from '../config/database.js';
import revisionDocumentalService from './revisionDocumental.service.js';
import { pdfVerifEquipos, pdfVerifMau, pdfListaMateriales } from './verificacionTerreno.pdf.js';
import { datosDeFolio } from './verificacionTerreno.service.js';

// CRUD de los tres formularios de terreno. Comparten forma (se crean desde un folio, se guardan como
// borrador, se firman y se pueden anular), así que el tipo sólo cambia tabla, columnas y generador de PDF.

const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

const COMUNES = ['folio_foma', 'id_agendamam', 'empresa', 'observaciones'];

export const TIPOS = {
    equipos: {
        tabla: 'mae_ma_verif_equipos', pk: 'id_verificacion', formato: 'verif_equipos', codigo: 'OI-FoGe-26',
        pdf: pdfVerifEquipos, fecha: 'fecha_verificacion',
        columnas: [...COMUNES, 'fecha_verificacion', 'hora_verificacion', 'responsable_muestreo', 'lugar_muestreo',
            'id_equipo_ph', 'codigo_equipo_ph', 'error_t0', 'error_t15', 'error_t30',
            'id_equipo_oxigeno', 'codigo_equipo_oxigeno', 'id_equipo_cloro', 'codigo_equipo_cloro'],
        json: ['items_ph', 'ajuste_ph', 'verificacion_ph', 'items_oxigeno', 'referencia_oxigeno', 'mediciones_oxigeno',
            'items_cloro', 'referencia_cloro', 'mediciones_cloro'],
        desdeFolio: (m) => ({
            folio_foma: m.folio, id_agendamam: m.id_agendamam, fecha_verificacion: m.fecha, hora_verificacion: m.hora,
            responsable_muestreo: m.muestreador, lugar_muestreo: m.lugar_muestreo, empresa: m.empresa,
            id_equipo_ph: m.sugerencias.ph?.id_equipo ?? null, codigo_equipo_ph: m.sugerencias.ph?.codigo ?? null,
            error_t0: m.sugerencias.ph?.error_t0 ?? null, error_t15: m.sugerencias.ph?.error_t15 ?? null, error_t30: m.sugerencias.ph?.error_t30 ?? null,
            id_equipo_oxigeno: m.sugerencias.oxigeno?.id_equipo ?? null, codigo_equipo_oxigeno: m.sugerencias.oxigeno?.codigo ?? null,
            id_equipo_cloro: m.sugerencias.cloro?.id_equipo ?? null, codigo_equipo_cloro: m.sugerencias.cloro?.codigo ?? null,
        }),
    },
    mau: {
        tabla: 'mae_ma_verif_mau', pk: 'id_verificacion', formato: 'verif_mau', codigo: 'OI-FoMa-03',
        pdf: pdfVerifMau, fecha: 'fecha_verificacion',
        columnas: [...COMUNES, 'fecha_verificacion', 'hora_verificacion', 'responsable_muestreo', 'lugar_muestreo',
            'id_equipo', 'codigo_equipo', 'id_sonda_caudal', 'codigo_sonda_caudal', 'error_t0', 'error_t15', 'error_t30',
            'nivel_real', 'nivel_equipo', 'acepta_nivel', 'volumen_obtenido', 'volumen_real', 'acepta_volumen',
            'hora_inicio', 'hora_termino'],
        json: ['items'],
        desdeFolio: (m) => ({
            folio_foma: m.folio, id_agendamam: m.id_agendamam, fecha_verificacion: m.fecha, hora_verificacion: m.hora,
            responsable_muestreo: m.muestreador, lugar_muestreo: m.lugar_muestreo, empresa: m.empresa,
            id_equipo: m.sugerencias.mau?.id_equipo ?? null, codigo_equipo: m.sugerencias.mau?.codigo ?? null,
            id_sonda_caudal: m.sugerencias.sonda_caudal?.id_equipo ?? null, codigo_sonda_caudal: m.sugerencias.sonda_caudal?.codigo ?? null,
            error_t0: m.sugerencias.mau?.error_t0 ?? null, error_t15: m.sugerencias.mau?.error_t15 ?? null, error_t30: m.sugerencias.mau?.error_t30 ?? null,
            hora_inicio: m.hora, hora_termino: m.hora_termino,
        }),
    },
    materiales: {
        tabla: 'mae_ma_lista_materiales', pk: 'id_lista', formato: 'lista_materiales', codigo: 'OI-FoMa-19',
        pdf: pdfListaMateriales, fecha: 'fecha',
        // Pendiente: el chequeo se hace antes de salir a terreno, cuando el muestreo todavía no tiene folio
        // OI-FoMa-01, así que no se crea desde aquí. Lo ya registrado se puede consultar e imprimir.
        soloConsulta: true,
        columnas: [...COMUNES, 'fecha', 'muestreador', 'lote_lavado', 'caracteristica', 'caracteristica_otro'],
        json: ['items'],
        desdeFolio: (m) => ({
            folio_foma: m.folio, id_agendamam: m.id_agendamam, fecha: m.fecha, empresa: m.empresa,
            muestreador: m.muestreador, caracteristica: m.caracteristica,
        }),
    },
};

const tipoDe = (nombre) => TIPOS[nombre] || (() => { throw error('Formulario desconocido.', 404); })();

/** Los tipos en solo consulta se leen y se imprimen, pero no se crean ni se modifican. */
const exigirEditable = (t) => {
    if (t.soloConsulta) throw error(`${t.codigo} está en solo consulta: todavía no se completa desde aquí.`, 409);
};

const existeTabla = async (pool, tabla) =>
    !!(await pool.request().query(`SELECT OBJECT_ID('${tabla}', 'U') AS id`)).recordset[0].id;

const exigirTabla = async (pool, t) => {
    if (!(await existeTabla(pool, t.tabla))) {
        throw error('Falta ejecutar la migración add_verificaciones_terreno.sql en la base de datos.', 503);
    }
};

/** Columnas JSON: en la base viajan como texto y hacia afuera como objeto. */
const parsear = (t, fila) => {
    if (!fila) return null;
    const salida = { ...fila };
    for (const c of t.json) {
        try { salida[c] = fila[c] ? JSON.parse(fila[c]) : null; } catch { salida[c] = null; }
    }
    return salida;
};

const tipoSql = (columna, valor) => {
    if (/^(id_|folio_)/.test(columna)) return [sql.Numeric(10, 0), valor === '' || valor === undefined ? null : valor];
    if (/^(error_|nivel_|volumen_)/.test(columna)) return [sql.Decimal(12, 3), valor === '' || valor === undefined ? null : valor];
    if (/^acepta_/.test(columna)) return [sql.Bit, valor === null || valor === undefined || valor === '' ? null : (valor ? 1 : 0)];
    if (/^(fecha|hora)/.test(columna)) return [columna.startsWith('fecha') ? sql.Date : sql.VarChar(5), valor || null];
    return [sql.NVarChar(sql.MAX), valor === undefined ? null : valor];
};

const servicio = {
    /** Lo que trae el muestreo para precargar el formulario (sin crearlo todavía). */
    async previo(nombre, folio) {
        const t = tipoDe(nombre);
        const m = await datosDeFolio(folio);
        return { muestreo: m, campos: t.desdeFolio(m) };
    },

    async listar(nombre, { anio, estado } = {}) {
        const t = tipoDe(nombre);
        const pool = await getConnection();
        if (!(await existeTabla(pool, t.tabla))) return [];
        const req = pool.request();
        const where = [];
        if (anio) { req.input('anio', sql.Int, Number(anio)); where.push(`YEAR(${t.fecha}) = @anio`); }
        if (estado) { req.input('estado', sql.VarChar(15), String(estado)); where.push('estado = @estado'); }
        const r = await req.query(`
            SELECT ${t.pk} AS id, folio_foma, empresa, CONVERT(VARCHAR(10), ${t.fecha}, 23) AS fecha,
                   estado, nombre_crea, nombre_firma, fecha_creacion
            FROM ${t.tabla} ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
            ORDER BY ${t.fecha} DESC, ${t.pk} DESC`);
        return r.recordset;
    },

    async obtener(nombre, id) {
        const t = tipoDe(nombre);
        const pool = await getConnection();
        await exigirTabla(pool, t);
        // Ojo: no se puede pedir `SELECT *` y además un CONVERT con el mismo alias que la columna de fecha;
        // serían dos columnas con un nombre y el driver las devuelve juntas en un array. La fecha se formatea aquí.
        const r = await pool.request().input('id', sql.Int, Number(id))
            .query(`SELECT * FROM ${t.tabla} WHERE ${t.pk} = @id`);
        const fila = r.recordset[0];
        if (!fila) throw error('No se encontró el formulario.', 404);
        if (fila[t.fecha] instanceof Date) fila[t.fecha] = fila[t.fecha].toISOString().slice(0, 10);
        return parsear(t, fila);
    },

    /** Crea el formulario ya rellenado con lo que trae el muestreo. */
    async crear(nombre, folio, usuario) {
        const t = tipoDe(nombre);
        exigirEditable(t);
        const pool = await getConnection();
        await exigirTabla(pool, t);
        const { campos } = await this.previo(nombre, folio);
        const cols = Object.keys(campos).filter((c) => t.columnas.includes(c));
        const req = pool.request()
            .input('uid', sql.Numeric(10, 0), Number(usuario?.id) || 0)
            .input('ucrea', sql.NVarChar(150), usuario?.name || usuario?.username || null);
        cols.forEach((c, i) => { const [tipo, val] = tipoSql(c, campos[c]); req.input(`p${i}`, tipo, val); });
        const r = await req.query(`
            INSERT INTO ${t.tabla} (${cols.join(', ')}, id_usuario_crea, nombre_crea)
            OUTPUT INSERTED.${t.pk} AS id
            VALUES (${cols.map((_, i) => `@p${i}`).join(', ')}, @uid, @ucrea)`);
        return { id: r.recordset[0].id, folio: Number(folio) };
    },

    async guardar(nombre, id, datos = {}) {
        const t = tipoDe(nombre);
        exigirEditable(t);
        const pool = await getConnection();
        await exigirTabla(pool, t);
        const actual = await this.obtener(nombre, id);
        if (actual.estado !== 'BORRADOR') throw error('El formulario ya está firmado o anulado: no se puede editar.', 409);

        const sets = [];
        const req = pool.request().input('id', sql.Int, Number(id));
        for (const c of t.columnas) {
            if (!(c in datos)) continue;
            const [tipo, val] = tipoSql(c, datos[c]);
            req.input(`c_${c}`, tipo, val);
            sets.push(`${c} = @c_${c}`);
        }
        for (const c of t.json) {
            if (!(c in datos)) continue;
            req.input(`j_${c}`, sql.NVarChar(sql.MAX), datos[c] ? JSON.stringify(datos[c]) : null);
            sets.push(`${c} = @j_${c}`);
        }
        if (!sets.length) return { ok: true };
        await req.query(`UPDATE ${t.tabla} SET ${sets.join(', ')} WHERE ${t.pk} = @id`);
        return { ok: true };
    },

    async firmar(nombre, id, { nombre: quien, firma } = {}) {
        const t = tipoDe(nombre);
        exigirEditable(t);
        const pool = await getConnection();
        await exigirTabla(pool, t);
        const actual = await this.obtener(nombre, id);
        if (actual.estado !== 'BORRADOR') throw error('El formulario ya está firmado o anulado.', 409);
        await pool.request().input('id', sql.Int, Number(id))
            .input('n', sql.NVarChar(150), quien || null)
            .input('f', sql.NVarChar(sql.MAX), firma || null)
            .query(`UPDATE ${t.tabla} SET estado = 'FIRMADA', nombre_firma = @n, firma = @f, fecha_firma = GETDATE() WHERE ${t.pk} = @id`);
        return { ok: true };
    },

    async anular(nombre, id, motivo) {
        const t = tipoDe(nombre);
        if (!String(motivo || '').trim()) throw error('Indique el motivo de la anulación.');
        const pool = await getConnection();
        await exigirTabla(pool, t);
        await pool.request().input('id', sql.Int, Number(id)).input('m', sql.NVarChar(300), String(motivo).trim())
            .query(`UPDATE ${t.tabla} SET estado = 'ANULADA', motivo_anulacion = @m WHERE ${t.pk} = @id AND estado <> 'ANULADA'`);
        return { ok: true };
    },

    /** PDF de lo guardado. */
    async pdf(nombre, id) {
        const t = tipoDe(nombre);
        const v = await this.obtener(nombre, id);
        const buffer = await t.pdf({ v, encabezado: await revisionDocumentalService.encabezado(t.codigo) });
        return { buffer, nombre: `${t.codigo} ${v.folio_foma || id}.pdf` };
    },

    /** PDF de lo que se está escribiendo, sin guardarlo: alimenta la vista previa en vivo. */
    async vistaPrevia(nombre, datos = {}) {
        const t = tipoDe(nombre);
        const buffer = await t.pdf({ v: datos, encabezado: await revisionDocumentalService.encabezado(t.codigo) });
        return { buffer, nombre: `${t.codigo}.pdf` };
    },
};

export default servicio;
