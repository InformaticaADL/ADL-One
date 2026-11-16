import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import equipoService from './equipo.service.js';
import { generarPdfVerificacion } from './verificacionTemperatura.pdf.js';
import firmaRemotaService from './firmaRemota.service.js';
import { calcularVerificacion, normalizarLecturas, lecturasVacias, sumarMeses } from '../utils/verificacionTemperatura.calc.js';

// Formulario OI-FoGe-39 "Verificación Intermedia de Temperatura" digitalizado.
// Ver migrations/add_verificacion_temperatura.sql para el flujo de estados.

const TABLA = 'mae_verificacion_temperatura';
const PDF_DIR = path.join(process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'), 'equipos');

// Equipos que llevan este formulario: los que miden temperatura según su
// catálogo (Sondas pH/T°, Medidores de pH, Medidores de Oxígeno Disuelto y
// Multiparámetros — exactamente los tipos de la planilla Excel), menos los
// propios termómetros patrón (se calibran afuera), los cables de descarga
// (su "qué mide" dice Temperatura porque transmiten ese dato, pero no miden).
// Los dados de baja también se listan (la planilla los incluye), marcados
// con dado_baja para advertirlo.
const FILTRO_ELEGIBLES = `
    e.que_mide LIKE '%temperatura%'
    AND ISNULL(e.tipoequipo, '') NOT IN ('Termometro patrón', 'Cable de descarga de datos')`;

const error = (mensaje, statusCode = 400) => Object.assign(new Error(mensaje), { statusCode });

// "Antecedentes del Termómetro Patrón" (C23:H28 de la hoja Excel). mae_equipo no
// los tiene: se guardan en cada ficha y una ficha nueva con el mismo patrón los
// copia de la última que los tenga, para no reescribirlos cada vez.
const CAMPOS_PATRON = [
    { campo: 'patron_marca', tipo: () => sql.NVarChar(100), max: 100 },
    { campo: 'patron_modelo', tipo: () => sql.NVarChar(100), max: 100 },
    { campo: 'patron_serie', tipo: () => sql.NVarChar(100), max: 100 },
    { campo: 'patron_identificacion', tipo: () => sql.NVarChar(150), max: 150 },
    { campo: 'patron_intervalo', tipo: () => sql.NVarChar(100), max: 100 },
    { campo: 'patron_fecha_calibracion', tipo: () => sql.Date, fecha: true },
    { campo: 'patron_empresa', tipo: () => sql.NVarChar(150), max: 150 },
    { campo: 'patron_maxima_division', tipo: () => sql.NVarChar(50), max: 50 },
];
const LISTA_CAMPOS_PATRON = CAMPOS_PATRON.map((c) => c.campo).join(', ');
const ALGUNO_CAMPO_PATRON = CAMPOS_PATRON.map((c) => `${c.campo} IS NOT NULL`).join(' OR ');

// Las columnas llegan con add_patron_antecedentes_verificacion_temperatura.sql;
// sin ella todo sigue funcionando, solo que esta sección no se guarda.
let columnasPatronExisten = false;
const hayColumnasPatron = async (pool) => {
    if (columnasPatronExisten) return true;
    try {
        const r = await pool.request().query(`SELECT COL_LENGTH('${TABLA}', 'patron_marca') AS c`);
        columnasPatronExisten = !!r.recordset[0]?.c;
        if (!columnasPatronExisten) logger.warn('Faltan los antecedentes del patrón — ejecute migrations/add_patron_antecedentes_verificacion_temperatura.sql');
    } catch (e) {
        logger.warn('No se pudo verificar patron_marca: ' + e.message);
    }
    return columnasPatronExisten;
};

// Máxima división del termómetro verificado y del patrón: siempre 5, no se modifica.
const MAXIMA_DIVISION_FIJA = '5';

// Cada lectura queda registrada cuando se escribe su temperatura TP: el
// formulario le marca la hora en ese momento. Desde ahí la TP y la hora no se
// cambian (aunque llegue otro valor); solo se pueden borrar (botón × del
// formulario: llega sin hora) y la lectura vuelve a quedar por registrar, con
// la TP nominal del rango. Una TP nueva sin hora toma la del servidor.
const horaActual = () => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const bloquearTpRegistradas = (previas, nuevas) => {
    for (const r of Object.keys(nuevas)) {
        nuevas[r] = nuevas[r].map((f, i) => {
            const prev = previas[r]?.[i];
            if (prev?.hora) return f.hora ? { ...f, tp: prev.tp, hora: prev.hora } : { ...f, tp: Number(r), hora: '' };
            if (f.hora || (prev && f.tp !== prev.tp)) return { ...f, hora: f.hora || horaActual() };
            return f;
        });
    }
    return nuevas;
};
// Filas sin TP registrada (sin hora).
const tpSinRegistrar = (lecturas) => Object.values(lecturas).reduce((n, filas) => n + filas.filter((f) => !f.hora).length, 0);

// Antecedentes vigentes de cada patrón (marca, modelo, serie, calibración…),
// en mae_termometro_patron_antecedentes (migrations/add_antecedentes_termometro_patron.sql).
// Sin esa tabla se usan los de la última ficha con el mismo patrón.
const TABLA_ANT_PATRON = 'mae_termometro_patron_antecedentes';
let tablaAntPatronExiste = false;
let tablaAntPatronRevisada = 0; // si falta, se vuelve a revisar (y avisar) cada 5 min
const hayTablaAntPatron = async (pool) => {
    if (tablaAntPatronExiste) return true;
    if (Date.now() - tablaAntPatronRevisada < 5 * 60 * 1000) return false;
    tablaAntPatronRevisada = Date.now();
    try {
        const r = await pool.request().query(`SELECT OBJECT_ID('${TABLA_ANT_PATRON}', 'U') AS o`);
        tablaAntPatronExiste = !!r.recordset[0]?.o;
        if (!tablaAntPatronExiste) logger.warn(`Falta ${TABLA_ANT_PATRON} — ejecute migrations/add_antecedentes_termometro_patron.sql`);
    } catch (e) {
        logger.warn(`No se pudo verificar ${TABLA_ANT_PATRON}: ${e.message}`);
    }
    return tablaAntPatronExiste;
};

const fechaYmd = (f) => (f instanceof Date ? f.toISOString().slice(0, 10) : (f ? String(f).slice(0, 10) : null));

// Datos del inventario OI-FoGe-21 (hoja EQUIPOS MUESTREO), los mismos que
// siembra la migración. Respaldo para cuando la tabla aún no existe o le falta
// un dato: así la ficha se llena igual.
const ANTECEDENTES_INVENTARIO = {
    'TPA.01/MA.PM': { patron_marca: 'HANNA INSTRUMENTS', patron_modelo: 'HI935003', patron_serie: 'TA02360040', patron_fecha_calibracion: '2026-06-17', patron_empresa: 'CESMEC' },
    'TPA.02/MA.VI': { patron_marca: 'HANNA INSTRUMENTS', patron_modelo: 'HI935005', patron_serie: '7400002101', patron_fecha_calibracion: '2026-09-29', patron_empresa: 'CESMEC' },
    'TPA.03/MA.AY': { patron_marca: 'HANNA INSTRUMENTS', patron_modelo: 'HI935005', patron_serie: '7400048101', patron_fecha_calibracion: '2026-09-29', patron_empresa: 'CESMEC' },
};

// Antecedentes de un patrón campo por campo: los de la tabla de patrones; donde
// falte algo, los de su última ficha; y si aún falta, los del inventario
// (identificación especial = código del patrón). id_patron → { patron_marca, … }.
const antecedentesDePatrones = async (pool, idPatron = null) => {
    const conTabla = await hayTablaAntPatron(pool);
    const conFichas = await hayColumnasPatron(pool);
    const req = pool.request();
    if (idPatron) req.input('p', sql.Numeric(10, 0), Number(idPatron));
    const r = await req.query(`
        SELECT e.id_equipo, e.codigo,
               ${CAMPOS_PATRON.map((c) => {
                   const fuentes = [conTabla && `t.${c.campo}`, conFichas && `f.${c.campo}`].filter(Boolean);
                   const valor = fuentes.length > 1 ? `COALESCE(${fuentes.join(', ')})` : (fuentes[0] || 'NULL');
                   return `${valor} AS ${c.campo}`;
               }).join(',\n               ')}
        FROM mae_equipo e
        ${conTabla ? `LEFT JOIN ${TABLA_ANT_PATRON} t ON t.id_equipo = e.id_equipo` : ''}
        ${conFichas ? `OUTER APPLY (SELECT TOP 1 ${LISTA_CAMPOS_PATRON} FROM ${TABLA}
                                     WHERE id_patron = e.id_equipo AND (${ALGUNO_CAMPO_PATRON})
                                     ORDER BY ISNULL(fecha_modificacion, fecha_creacion) DESC) f` : ''}
        WHERE ${FILTRO_PATRON.replace(/(tipoequipo|codigo)/g, 'e.$1')} ${idPatron ? 'AND e.id_equipo = @p' : ''}`);
    return Object.fromEntries(r.recordset.map((p) => {
        const inventario = { patron_identificacion: p.codigo, ...(ANTECEDENTES_INVENTARIO[String(p.codigo || '').trim()] || {}) };
        return [
            Number(p.id_equipo),
            Object.fromEntries(CAMPOS_PATRON.map((c) => {
                if (c.campo === 'patron_maxima_division') return [c.campo, MAXIMA_DIVISION_FIJA];
                const v = c.fecha ? fechaYmd(p[c.campo]) : p[c.campo];
                return [c.campo, v ?? inventario[c.campo] ?? null];
            })),
        ];
    }));
};

// Copia a la ficha los antecedentes vigentes del patrón.
const heredarAntecedentesPatron = async (pool, idVerificacion, idPatron) => {
    if (!idPatron || !(await hayColumnasPatron(pool))) return;
    const ant = (await antecedentesDePatrones(pool, idPatron))[Number(idPatron)];
    if (!ant || CAMPOS_PATRON.every((c) => ant[c.campo] == null)) return;
    const req = pool.request().input('id', sql.Int, Number(idVerificacion));
    for (const c of CAMPOS_PATRON) req.input(c.campo, c.tipo(), ant[c.campo]);
    await req.query(`UPDATE ${TABLA} SET ${CAMPOS_PATRON.map((c) => `${c.campo} = @${c.campo}`).join(', ')} WHERE id_verificacion = @id`);
};

// Lo que se guarda en una ficha pasa a ser lo vigente del patrón (ej. una
// nueva fecha de calibración): las fichas siguientes ya lo traen.
const guardarAntecedentesPatron = async (pool, idPatron, valores) => {
    if (!idPatron || !(await hayTablaAntPatron(pool))) return;
    if (CAMPOS_PATRON.every((c) => valores[c.campo] == null)) return;
    const req = pool.request().input('p', sql.Numeric(10, 0), Number(idPatron));
    for (const c of CAMPOS_PATRON) req.input(c.campo, c.tipo(), valores[c.campo]);
    await req.query(`
        IF EXISTS (SELECT 1 FROM ${TABLA_ANT_PATRON} WHERE id_equipo = @p)
            UPDATE ${TABLA_ANT_PATRON} SET ${CAMPOS_PATRON.map((c) => `${c.campo} = @${c.campo}`).join(', ')}, fecha_modificacion = GETDATE()
            WHERE id_equipo = @p
        ELSE
            INSERT INTO ${TABLA_ANT_PATRON} (id_equipo, ${LISTA_CAMPOS_PATRON})
            VALUES (@p, ${CAMPOS_PATRON.map((c) => `@${c.campo}`).join(', ')})`);
};

const hoyYmd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ymd = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ? String(v).slice(0, 10) : null));

const validarFecha = (f) => {
    const s = ymd(f);
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw error('Fecha de verificación inválida');
    if (s > hoyYmd()) throw error('La fecha de verificación no puede ser futura');
    return s;
};

const validarPeriodo = (p, fecha) => {
    const s = p ? String(p) : String(fecha).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(s)) throw error('Periodo inválido (formato AAAA-MM)');
    return s;
};

const nombreUsuario = async (pool, idUsuario) => {
    if (!idUsuario) return null;
    const r = await pool.request().input('u', sql.Numeric(10, 0), Number(idUsuario))
        .query('SELECT TOP 1 ISNULL(NULLIF(LTRIM(RTRIM(usuario)), \'\'), nombre_usuario) AS n FROM mae_usuario WHERE id_usuario = @u');
    return r.recordset[0]?.n || null;
};

// Patrón por defecto según la sede del equipo: el termómetro patrón (TPA.*)
// de esa sede; si la sede no tiene uno (ej. Punta Arenas) se usa el de Puerto
// Montt, que es lo que hacía la planilla.
// Solo los termómetros patrón TPA (los de la planilla); las sondas patrón STP no se usan en este formulario.
const FILTRO_PATRON = "tipoequipo = 'Termometro patrón' AND codigo LIKE 'TPA%'";

const patronPorSede = async (pool, sede) => {
    const r = await pool.request().input('s', sql.VarChar(10), sede || 'PM').query(`
        SELECT TOP 1 id_equipo, codigo, nombre, sede, error0, error15, error30
        FROM mae_equipo
        WHERE ${FILTRO_PATRON} AND habilitado = 'S'
        ORDER BY CASE WHEN sede = @s THEN 0 WHEN sede = 'PM' THEN 1 ELSE 2 END, codigo`);
    return r.recordset[0] || null;
};

const obtenerPatron = async (pool, idPatron) => {
    const r = await pool.request().input('id', sql.Numeric(10, 0), Number(idPatron))
        .query(`SELECT id_equipo, codigo, nombre, sede, error0, error15, error30 FROM mae_equipo WHERE id_equipo = @id AND ${FILTRO_PATRON}`);
    if (!r.recordset[0]) throw error('El termómetro patrón seleccionado no existe', 404);
    return r.recordset[0];
};

const SELECT_LISTA = `
    SELECT v.id_verificacion, v.id_equipo, v.codigo_equipo, v.nombre_equipo, v.sede, v.periodo,
           CONVERT(VARCHAR(10), v.fecha_verificacion, 23) AS fecha_verificacion,
           v.patron_codigo, v.error0, v.error15, v.error30, v.cumple, v.estado,
           v.id_muestreador, m.nombre_muestreador AS muestreador_nombre,
           v.id_usuario_responsable,
           (SELECT TOP 1 ISNULL(NULLIF(LTRIM(RTRIM(u.usuario)), ''), u.nombre_usuario) FROM mae_usuario u WHERE u.id_usuario = v.id_usuario_responsable) AS responsable_nombre,
           v.fecha_firma, CONVERT(VARCHAR(10), v.siguiente_verificacion, 23) AS siguiente_verificacion,
           v.pdf_ruta, v.motivo_anulacion, v.fecha_creacion, v.fecha_modificacion
    FROM ${TABLA} v
    LEFT JOIN mae_muestreador m ON m.id_muestreador = v.id_muestreador`;

const cargar = async (pool, id) => {
    const r = await pool.request().input('id', sql.Int, Number(id)).query(`
        SELECT v.*, CONVERT(VARCHAR(10), v.fecha_verificacion, 23) AS fecha_ymd,
               CONVERT(VARCHAR(10), v.siguiente_verificacion, 23) AS siguiente_ymd,
               m.nombre_muestreador AS muestreador_nombre,
               CASE WHEN m.firma_muestreador IS NOT NULL AND LEN(m.firma_muestreador) > 0 THEN 1 ELSE 0 END AS muestreador_tiene_firma,
               (SELECT TOP 1 ISNULL(NULLIF(LTRIM(RTRIM(u.usuario)), ''), u.nombre_usuario) FROM mae_usuario u WHERE u.id_usuario = v.id_usuario_responsable) AS responsable_nombre
        FROM ${TABLA} v
        LEFT JOIN mae_muestreador m ON m.id_muestreador = v.id_muestreador
        WHERE v.id_verificacion = @id`);
    const v = r.recordset[0];
    if (!v) throw error('Ficha de verificación no encontrada', 404);
    // DATE llega como objeto Date: se deja en 'AAAA-MM-DD' como las demás fechas.
    if (v.patron_fecha_calibracion instanceof Date) v.patron_fecha_calibracion = v.patron_fecha_calibracion.toISOString().slice(0, 10);
    v.fecha_verificacion = v.fecha_ymd;
    v.siguiente_verificacion = v.siguiente_ymd;
    delete v.fecha_ymd;
    delete v.siguiente_ymd;
    // Fichas abiertas: máxima división fija y, si la ficha aún no tiene
    // antecedentes del patrón, los vigentes del patrón (formulario y PDF).
    if (v.estado === 'BORRADOR' || v.estado === 'PENDIENTE_FIRMA') {
        v.maxima_division = MAXIMA_DIVISION_FIJA;
        // Cada dato del patrón que la ficha no tenga se toma de los vigentes del
        // patrón. Vale también al estar pendiente de firma: con esto se genera el
        // PDF definitivo al firmar.
        if (v.id_patron && CAMPOS_PATRON.some((c) => v[c.campo] == null || v[c.campo] === '')) {
            const ant = (await antecedentesDePatrones(pool, v.id_patron))[Number(v.id_patron)];
            if (ant) for (const c of CAMPOS_PATRON) if (v[c.campo] == null || v[c.campo] === '') v[c.campo] = ant[c.campo];
        }
        v.patron_maxima_division = MAXIMA_DIVISION_FIJA;
    }
    return v;
};

const resultadoCalculo = (v) => calcularVerificacion(normalizarLecturas(v.lecturas), {
    0: v.patron_error0, 15: v.patron_error15, 30: v.patron_error30,
});

// Sesión de firma por celular de una ficha (ver firmaRemota.service.js), con
// los datos que ve el muestreador antes de firmar. urlDe=null: sin QR (se abre
// desde el propio celular).
const sesionFirma = async (pool, v, idMuestreador, urlDe, idUsuario) => {
    if (v.estado !== 'PENDIENTE_FIRMA') throw error('La ficha debe estar pendiente de firma', 409);
    if (!idMuestreador) throw error('Seleccione el muestreador que firma');
    const m = (await pool.request().input('m', sql.Numeric(10, 0), idMuestreador)
        .query('SELECT nombre_muestreador FROM mae_muestreador WHERE id_muestreador = @m')).recordset[0];
    if (!m) throw error('Muestreador no encontrado', 404);
    const calc = resultadoCalculo(v);
    return firmaRemotaService.crear({
        idVerificacion: Number(v.id_verificacion),
        idMuestreador,
        idUsuario,
        url: urlDe,
        info: {
            codigo_equipo: v.codigo_equipo,
            nombre_equipo: v.nombre_equipo,
            fecha_verificacion: v.fecha_verificacion,
            muestreador: m.nombre_muestreador,
            cumple: calc.cumple,
            errores: [0, 15, 30].map((r) => ({ rango: r, error: calc.rangos[r].promedio })),
            observacion: v.observacion || null,
        },
    });
};

const fmt1 = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));

// ── Errores de patrón por año (migrations/add_errores_termometro_patron.sql) ──
// El año más reciente de cada patrón es el vigente: sus errores se copian a
// mae_equipo, que es de donde los toman las fichas nuevas.
const TABLA_ERR_PATRON = 'mae_termometro_patron_errores';
let tablaErrPatronExiste = false;
let tablaErrPatronRevisada = 0;
const hayTablaErrPatron = async (pool) => {
    if (tablaErrPatronExiste) return true;
    if (Date.now() - tablaErrPatronRevisada < 5 * 60 * 1000) return false;
    tablaErrPatronRevisada = Date.now();
    try {
        const r = await pool.request().query(`SELECT OBJECT_ID('${TABLA_ERR_PATRON}', 'U') AS o`);
        tablaErrPatronExiste = !!r.recordset[0]?.o;
        if (!tablaErrPatronExiste) logger.warn(`Falta ${TABLA_ERR_PATRON} — ejecute migrations/add_errores_termometro_patron.sql`);
    } catch (e) {
        logger.warn(`No se pudo verificar ${TABLA_ERR_PATRON}: ${e.message}`);
    }
    return tablaErrPatronExiste;
};
const exigirTablaErrPatron = async (pool) => {
    // Forzar la revisión: quien guarda puede haber corrido la migración recién.
    tablaErrPatronRevisada = 0;
    if (!(await hayTablaErrPatron(pool))) throw error('Falta ejecutar la migración add_errores_termometro_patron.sql en la base de datos', 503);
};

// Error de un patrón: número con hasta 2 decimales, en ±5 °C (los reales son décimas).
const errorPatron = (v, nombre) => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || Math.abs(n) > 5) throw error(`${nombre}: ingrese un número entre -5 y 5`);
    return Math.round(n * 100) / 100;
};
const fechaOpcional = (f, nombre) => {
    if (f === null || f === undefined || f === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(f)) || Number.isNaN(new Date(f).getTime())) throw error(`${nombre}: fecha inválida`);
    return String(f);
};
const filaErrorPatron = (f) => {
    const anio = Number(f.anio);
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw error('Año inválido');
    if (!f.id_equipo) throw error('Falta el termómetro patrón');
    const fila = {
        id_equipo: Number(f.id_equipo),
        anio,
        fecha_calibracion: fechaOpcional(f.fecha_calibracion, 'Última calibración'),
        error0: errorPatron(f.error0, '0 °C'),
        error15: errorPatron(f.error15, '15 °C'),
        error30: errorPatron(f.error30, '30 °C'),
        valido_hasta: fechaOpcional(f.valido_hasta, 'Válido hasta'),
    };
    if (fila.fecha_calibracion && fila.valido_hasta && fila.valido_hasta < fila.fecha_calibracion) {
        throw error('"Válido hasta" no puede ser anterior a la última calibración');
    }
    return fila;
};

// Copia el año más reciente del patrón a mae_equipo (errores) y a los
// antecedentes (fecha de calibración), para que las fichas nuevas lo usen.
const sincronizarPatronVigente = async (tx, idEquipo) => {
    const r = await new sql.Request(tx).input('p', sql.Numeric(10, 0), idEquipo).query(`
        SELECT TOP 1 anio, fecha_calibracion, error0, error15, error30
        FROM ${TABLA_ERR_PATRON} WHERE id_equipo = @p ORDER BY anio DESC`);
    const v = r.recordset[0];
    if (!v) return;
    await new sql.Request(tx)
        .input('p', sql.Numeric(10, 0), idEquipo)
        .input('e0', sql.Decimal(6, 2), v.error0 ?? 0)
        .input('e15', sql.Decimal(6, 2), v.error15 ?? 0)
        .input('e30', sql.Decimal(6, 2), v.error30 ?? 0)
        .query(`UPDATE mae_equipo SET error0 = @e0, error15 = @e15, error30 = @e30
                WHERE id_equipo = @p AND tipoequipo = 'Termometro patrón'`);
    if (v.fecha_calibracion && (await hayTablaAntPatron(tx))) {
        await new sql.Request(tx)
            .input('p', sql.Numeric(10, 0), idEquipo)
            .input('f', sql.Date, v.fecha_calibracion)
            // Solo si es más nueva: nunca retrocede una fecha de calibración ya registrada.
            .query(`UPDATE ${TABLA_ANT_PATRON} SET patron_fecha_calibracion = @f, fecha_modificacion = GETDATE()
                    WHERE id_equipo = @p AND (patron_fecha_calibracion IS NULL OR patron_fecha_calibracion < @f)`);
    }
    logger.info(`Errores de patrón: ${idEquipo} sincronizado con el año ${v.anio}`);
};

const verificacionTemperaturaService = {
    async listar({ periodo, estado, sede, search } = {}) {
        const pool = await getConnection();
        const req = pool.request();
        const where = ['1 = 1'];
        if (periodo) { req.input('periodo', sql.VarChar(7), periodo); where.push('v.periodo = @periodo'); }
        if (estado) { req.input('estado', sql.VarChar(20), estado); where.push('v.estado = @estado'); }
        if (sede) { req.input('sede', sql.VarChar(10), sede); where.push('v.sede = @sede'); }
        if (search) { req.input('q', sql.NVarChar(200), `%${search}%`); where.push('(v.codigo_equipo LIKE @q OR v.nombre_equipo LIKE @q)'); }
        const r = await req.query(`${SELECT_LISTA} WHERE ${where.join(' AND ')} ORDER BY v.periodo DESC, v.sede, v.codigo_equipo`);
        return r.recordset;
    },

    async periodos() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT periodo, COUNT(*) AS total,
                   SUM(CASE WHEN estado = 'FIRMADA' THEN 1 ELSE 0 END) AS firmadas
            FROM ${TABLA} WHERE estado <> 'ANULADA'
            GROUP BY periodo ORDER BY periodo DESC`);
        return r.recordset;
    },

    async elegibles({ sede, periodo } = {}) {
        const pool = await getConnection();
        const req = pool.request().input('periodo', sql.VarChar(7), periodo || '');
        let filtroSede = '';
        if (sede) { req.input('sede', sql.VarChar(10), sede); filtroSede = 'AND e.sede = @sede'; }
        const r = await req.query(`
            SELECT e.id_equipo, e.codigo, e.nombre, e.tipoequipo, e.sede, e.Estado AS estado_equipo, e.habilitado,
                   CASE WHEN ISNULL(e.Estado, '') LIKE '%baja%' THEN 1 ELSE 0 END AS dado_baja,
                   e.id_muestreador, m.nombre_muestreador,
                   CONVERT(VARCHAR(10), e.Ultima_verificacion, 23) AS ultima_verificacion,
                   CONVERT(VARCHAR(10), e.Siguiente_verificacion, 23) AS siguiente_verificacion,
                   (SELECT TOP 1 v.id_verificacion FROM ${TABLA} v
                    WHERE v.id_equipo = e.id_equipo AND v.periodo = @periodo AND v.estado <> 'ANULADA') AS id_ficha_periodo
            FROM mae_equipo e
            LEFT JOIN mae_muestreador m ON m.id_muestreador = e.id_muestreador
            WHERE ${FILTRO_ELEGIBLES} ${filtroSede}
            ORDER BY dado_baja, e.sede, e.tipoequipo, e.codigo`);
        return r.recordset;
    },

    // Cada patrón trae sus últimos antecedentes conocidos, para llenarlos al
    // elegirlo en el formulario.
    async patrones() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT e.id_equipo, e.codigo, e.nombre, e.sede, e.error0, e.error15, e.error30
            FROM mae_equipo e
            WHERE ${FILTRO_PATRON.replace(/(tipoequipo|codigo)/g, 'e.$1')} AND e.habilitado = 'S'
            ORDER BY e.sede, e.codigo`);
        const ant = await antecedentesDePatrones(pool);
        return r.recordset.map((p) => ({ ...p, antecedentes: ant[Number(p.id_equipo)] || null }));
    },

    // Firma registrada del muestreador (para mostrarla antes de usarla).
    async firmaRegistrada(idMuestreador) {
        const pool = await getConnection();
        const r = await pool.request().input('m', sql.Numeric(10, 0), Number(idMuestreador))
            .query('SELECT id_muestreador, nombre_muestreador, firma_muestreador FROM mae_muestreador WHERE id_muestreador = @m');
        const m = r.recordset[0];
        if (!m) throw error('Muestreador no encontrado', 404);
        const firma = m.firma_muestreador && String(m.firma_muestreador).startsWith('data:image') ? m.firma_muestreador : null;
        return { id_muestreador: m.id_muestreador, nombre_muestreador: m.nombre_muestreador, firma };
    },

    // Genera el QR para que el muestreador firme desde su celular. Si ya firmó
    // esta ficha en el celular, devuelve esa firma (estado 'firmado').
    async iniciarFirmaRemota(id, { id_muestreador }, urlDe, idUsuario) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        const idMuestreador = Number(id_muestreador || v.id_muestreador);
        return sesionFirma(pool, v, idMuestreador, urlDe, idUsuario);
    },

    // Celular: fichas del mismo muestreador que siguen pendientes de firma.
    async pendientesCelular(token) {
        const { idMuestreador, idVerificacion } = firmaRemotaService.sesion(token);
        const pool = await getConnection();
        const r = await pool.request().input('m', sql.Numeric(10, 0), idMuestreador).query(`
            SELECT id_verificacion, codigo_equipo, nombre_equipo, CONVERT(VARCHAR(10), fecha_verificacion, 23) AS fecha_verificacion, cumple
            FROM ${TABLA}
            WHERE estado = 'PENDIENTE_FIRMA' AND id_muestreador = @m
            ORDER BY fecha_verificacion DESC, codigo_equipo`);
        return r.recordset
            .filter((x) => x.id_verificacion !== idVerificacion)
            .map((x) => ({ ...x, firmada_celular: false }));
    },

    // Celular: abre la firma de otra ficha pendiente del mismo muestreador.
    async abrirDesdeCelular(token, idVerificacion) {
        const { idMuestreador, idUsuario } = firmaRemotaService.sesion(token);
        const pool = await getConnection();
        const v = await cargar(pool, idVerificacion);
        if (Number(v.id_muestreador) !== idMuestreador) throw error('Esta ficha no le corresponde a este muestreador', 403);
        const s = await sesionFirma(pool, v, idMuestreador, null, idUsuario);
        return { token: s.token };
    },

    estadoFirmaRemota(id, token) {
        return firmaRemotaService.estado(token, id);
    },

    async muestreadores() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT id_muestreador, nombre_muestreador, habilitado,
                   CASE WHEN firma_muestreador IS NOT NULL AND LEN(firma_muestreador) > 0 THEN 1 ELSE 0 END AS tiene_firma
            FROM mae_muestreador ORDER BY CASE WHEN habilitado = 'S' THEN 0 ELSE 1 END, nombre_muestreador`);
        return r.recordset;
    },

    async obtener(id) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        v.lecturas = normalizarLecturas(v.lecturas);
        v.calculo = resultadoCalculo(v);
        // La firma (imagen) no viaja en el detalle: solo si existe.
        v.tiene_firma = !!v.firma_muestreador;
        delete v.firma_muestreador;
        return v;
    },

    async crear(idUsuario, { id_equipo, fecha, periodo }) {
        const pool = await getConnection();
        const fechaOk = validarFecha(fecha || hoyYmd());
        const periodoOk = validarPeriodo(periodo, fechaOk);
        const eq = await pool.request().input('id', sql.Numeric(10, 0), Number(id_equipo)).query(`
            SELECT e.id_equipo, e.codigo, e.nombre, e.sede, e.id_muestreador FROM mae_equipo e
            WHERE e.id_equipo = @id AND ${FILTRO_ELEGIBLES}`);
        const equipo = eq.recordset[0];
        if (!equipo) throw error('El equipo no existe o no corresponde a verificación de temperatura', 404);

        const dup = await pool.request()
            .input('id', sql.Numeric(10, 0), Number(id_equipo))
            .input('p', sql.VarChar(7), periodoOk)
            .query(`SELECT TOP 1 id_verificacion FROM ${TABLA} WHERE id_equipo = @id AND periodo = @p AND estado <> 'ANULADA'`);
        if (dup.recordset[0]) throw error(`${equipo.codigo} ya tiene una ficha en el periodo ${periodoOk}`, 409);

        const patron = await patronPorSede(pool, equipo.sede);
        const r = await pool.request()
            .input('id_equipo', sql.Numeric(10, 0), equipo.id_equipo)
            .input('codigo', sql.VarChar(100), equipo.codigo)
            .input('nombre', sql.NVarChar(200), equipo.nombre)
            .input('sede', sql.VarChar(10), equipo.sede)
            .input('periodo', sql.VarChar(7), periodoOk)
            .input('fecha', sql.Date, fechaOk)
            .input('id_patron', sql.Numeric(10, 0), patron?.id_equipo ?? null)
            .input('p_cod', sql.VarChar(100), patron?.codigo ?? null)
            .input('p_nom', sql.NVarChar(200), patron?.nombre ?? null)
            .input('p_e0', sql.Decimal(6, 2), patron?.error0 ?? 0)
            .input('p_e15', sql.Decimal(6, 2), patron?.error15 ?? 0)
            .input('p_e30', sql.Decimal(6, 2), patron?.error30 ?? 0)
            .input('lecturas', sql.NVarChar(sql.MAX), JSON.stringify(lecturasVacias()))
            .input('maxdiv', sql.NVarChar(50), MAXIMA_DIVISION_FIJA)
            .input('resp', sql.Numeric(10, 0), idUsuario || null)
            .input('muest', sql.Numeric(10, 0), equipo.id_muestreador || null)
            .query(`INSERT INTO ${TABLA} (id_equipo, codigo_equipo, nombre_equipo, sede, periodo, fecha_verificacion,
                        id_patron, patron_codigo, patron_nombre, patron_error0, patron_error15, patron_error30,
                        lecturas, estado, id_usuario_responsable, id_muestreador, id_usuario_crea, maxima_division)
                    OUTPUT INSERTED.id_verificacion
                    VALUES (@id_equipo, @codigo, @nombre, @sede, @periodo, @fecha,
                        @id_patron, @p_cod, @p_nom, @p_e0, @p_e15, @p_e30,
                        @lecturas, 'BORRADOR', @resp, @muest, @resp, @maxdiv)`);
        const idNueva = r.recordset[0].id_verificacion;
        await heredarAntecedentesPatron(pool, idNueva, patron?.id_equipo);
        return { id_verificacion: idNueva };
    },

    async crearLote(idUsuario, { ids_equipo, fecha, periodo }) {
        const ids = [...new Set((ids_equipo || []).map(Number).filter(Boolean))];
        if (!ids.length) throw error('Seleccione al menos un equipo');
        const creadas = [];
        const omitidas = [];
        for (const id of ids) {
            try {
                creadas.push(await this.crear(idUsuario, { id_equipo: id, fecha, periodo }));
            } catch (e) {
                if (!e.statusCode) throw e;
                omitidas.push({ id_equipo: id, motivo: e.message });
            }
        }
        return { creadas: creadas.length, ids: creadas.map((c) => c.id_verificacion), omitidas };
    },

    async actualizar(id, data) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        if (v.estado !== 'BORRADOR') throw error('Solo se puede editar una ficha en borrador', 409);

        const fecha = data.fecha_verificacion ? validarFecha(data.fecha_verificacion) : v.fecha_verificacion;
        let patron = { id_equipo: v.id_patron, codigo: v.patron_codigo, nombre: v.patron_nombre, error0: v.patron_error0, error15: v.patron_error15, error30: v.patron_error30 };
        // Cambiar de patrón vuelve a tomar su error actual; mantenerlo conserva el de la ficha.
        if (data.id_patron && Number(data.id_patron) !== Number(v.id_patron)) patron = await obtenerPatron(pool, data.id_patron);
        const lecturas = data.lecturas ? bloquearTpRegistradas(normalizarLecturas(v.lecturas), normalizarLecturas(data.lecturas)) : normalizarLecturas(v.lecturas);
        const calc = calcularVerificacion(lecturas, { 0: patron.error0, 15: patron.error15, 30: patron.error30 });

        await pool.request()
            .input('id', sql.Int, Number(id))
            .input('fecha', sql.Date, fecha)
            .input('maxdiv', sql.NVarChar(50), MAXIMA_DIVISION_FIJA)
            .input('id_patron', sql.Numeric(10, 0), patron.id_equipo ?? null)
            .input('p_cod', sql.VarChar(100), patron.codigo ?? null)
            .input('p_nom', sql.NVarChar(200), patron.nombre ?? null)
            .input('p_e0', sql.Decimal(6, 2), patron.error0 ?? 0)
            .input('p_e15', sql.Decimal(6, 2), patron.error15 ?? 0)
            .input('p_e30', sql.Decimal(6, 2), patron.error30 ?? 0)
            .input('lecturas', sql.NVarChar(sql.MAX), JSON.stringify(lecturas))
            .input('e0', sql.Decimal(6, 2), calc.rangos[0].promedio)
            .input('e15', sql.Decimal(6, 2), calc.rangos[15].promedio)
            .input('e30', sql.Decimal(6, 2), calc.rangos[30].promedio)
            .input('cumple', sql.Char(1), calc.cumple === null ? null : (calc.cumple ? 'S' : 'N'))
            .input('obs', sql.NVarChar(2000), data.observacion !== undefined ? (String(data.observacion || '').slice(0, 2000) || null) : v.observacion)
            .input('muest', sql.Numeric(10, 0), data.id_muestreador !== undefined ? (Number(data.id_muestreador) || null) : v.id_muestreador)
            .query(`UPDATE ${TABLA} SET fecha_verificacion = @fecha, maxima_division = @maxdiv,
                        id_patron = @id_patron, patron_codigo = @p_cod, patron_nombre = @p_nom,
                        patron_error0 = @p_e0, patron_error15 = @p_e15, patron_error30 = @p_e30,
                        lecturas = @lecturas, error0 = @e0, error15 = @e15, error30 = @e30, cumple = @cumple,
                        observacion = @obs, id_muestreador = @muest, fecha_modificacion = GETDATE()
                    WHERE id_verificacion = @id`);

        // Antecedentes del patrón: los que manda el formulario (y pasan a ser
        // los vigentes del patrón); si cambió de patrón y no mandó nada, los
        // vigentes de ese patrón.
        const ant = data.patron_antecedentes;
        if (ant && typeof ant === 'object' && (await hayColumnasPatron(pool))) {
            const valores = {};
            for (const c of CAMPOS_PATRON) {
                let val = ant[c.campo];
                val = val === undefined || val === null || String(val).trim() === '' ? null : String(val).trim();
                if (val && c.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(val.slice(0, 10))) throw error('Fecha de calibración del patrón inválida');
                valores[c.campo] = val && c.fecha ? val.slice(0, 10) : (val ? val.slice(0, c.max) : null);
            }
            valores.patron_maxima_division = MAXIMA_DIVISION_FIJA;
            const req = pool.request().input('id', sql.Int, Number(id));
            for (const c of CAMPOS_PATRON) req.input(c.campo, c.tipo(), valores[c.campo]);
            await req.query(`UPDATE ${TABLA} SET ${CAMPOS_PATRON.map((c) => `${c.campo} = @${c.campo}`).join(', ')} WHERE id_verificacion = @id`);
            await guardarAntecedentesPatron(pool, patron.id_equipo, valores);
        } else if (Number(patron.id_equipo) !== Number(v.id_patron)) {
            await heredarAntecedentesPatron(pool, id, patron.id_equipo);
        }
        return this.obtener(id);
    },

    async enviarFirma(id) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        if (v.estado !== 'BORRADOR') throw error('La ficha no está en borrador', 409);
        const calc = resultadoCalculo(v);
        if (!calc.completas) throw error('Faltan lecturas: complete las 5 mediciones de cada rango (0, 15 y 30 °C)');
        const sinTp = tpSinRegistrar(normalizarLecturas(v.lecturas));
        if (sinTp > 0) throw error(`Faltan ${sinTp} temperatura(s) TP por registrar`);
        if (!v.id_muestreador) throw error('Indique el muestreador que debe firmar la ficha');
        // La observación es obligatoria: el formulario la empieza con "- dd/mm/aaaa"
        // y debe tener texto después de esa fecha.
        if (!String(v.observacion || '').replace(/^\s*-\s*\d{1,2}[./-]\d{1,2}[./-]\d{4}\s*/, '').trim()) {
            throw error(calc.cumple === false
                ? 'La verificación NO CUMPLE: registre una observación antes de enviarla a firma'
                : 'Escriba la observación de la verificación antes de enviarla a firma');
        }
        await pool.request().input('id', sql.Int, Number(id))
            .query(`UPDATE ${TABLA} SET estado = 'PENDIENTE_FIRMA', fecha_modificacion = GETDATE() WHERE id_verificacion = @id`);
        return this.obtener(id);
    },

    async volverBorrador(id) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        if (v.estado !== 'PENDIENTE_FIRMA') throw error('Solo una ficha pendiente de firma puede volver a borrador', 409);
        await pool.request().input('id', sql.Int, Number(id))
            .query(`UPDATE ${TABLA} SET estado = 'BORRADOR', fecha_modificacion = GETDATE() WHERE id_verificacion = @id`);
        return this.obtener(id);
    },

    // Firmadas: el PDF definitivo guardado. Antes de la firma: vista previa
    // temporal generada al vuelo (no se guarda en ningún lado).
    async pdf(id) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        if (v.estado === 'FIRMADA' && v.pdf_ruta) {
            const abs = path.join(PDF_DIR, path.basename(v.pdf_ruta));
            if (fs.existsSync(abs)) return { buffer: fs.readFileSync(abs), nombre: path.basename(abs) };
        }
        const buffer = await generarPdfVerificacion(v);
        return { buffer, nombre: `OI-FoGe-39_${String(v.codigo_equipo || v.id_verificacion).replace(/[^\w.-]+/g, '-')}_borrador.pdf` };
    },

    async firmar(id, idUsuario, { id_muestreador, firma, usar_firma_registrada }) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        if (v.estado !== 'PENDIENTE_FIRMA') throw error('La ficha debe estar pendiente de firma', 409);

        const idMuestreador = Number(id_muestreador || v.id_muestreador);
        if (!idMuestreador) throw error('Indique el muestreador que firma');
        const m = (await pool.request().input('m', sql.Numeric(10, 0), idMuestreador)
            .query('SELECT id_muestreador, nombre_muestreador, firma_muestreador FROM mae_muestreador WHERE id_muestreador = @m')).recordset[0];
        if (!m) throw error('Muestreador no encontrado', 404);

        let imagenFirma = null;
        if (usar_firma_registrada) {
            if (!m.firma_muestreador) throw error(`${m.nombre_muestreador} no tiene una firma registrada`);
            imagenFirma = m.firma_muestreador;
        } else {
            const f = String(firma || '');
            if (!/^data:image\/(png|jpeg);base64,/.test(f)) throw error('Falta la firma del muestreador');
            if (f.length > 900_000) throw error('La imagen de la firma es demasiado grande');
            imagenFirma = f;
        }

        const calc = resultadoCalculo(v);
        if (!calc.completas) throw error('La ficha tiene lecturas incompletas');
        const siguiente = sumarMeses(v.fecha_verificacion);
        const fechaFirma = new Date();

        // 1. PDF definitivo, con la firma.
        const datosPdf = { ...v, id_muestreador: idMuestreador, muestreador_nombre: m.nombre_muestreador, firma_muestreador: imagenFirma, fecha_firma: fechaFirma };
        const buffer = await generarPdfVerificacion(datosPdf);
        fs.mkdirSync(PDF_DIR, { recursive: true });
        const archivo = `verif-temp-${v.id_verificacion}-${Date.now()}.pdf`;
        const abs = path.join(PDF_DIR, archivo);
        fs.writeFileSync(abs, buffer);
        const ruta = `/uploads/equipos/${archivo}`;

        // 2. Aplicar a la ficha del equipo: errores, FC, revisión y el PDF como
        //    documento de esta revisión (la anterior pasa al historial).
        try {
            const actual = await equipoService.getEquipoById(v.id_equipo);
            const [y, mo, d] = v.fecha_verificacion.split('-');
            const lineaObs = `${d}.${mo}.${y.slice(2)} Verificación intermedia de temperatura (OI-FoGe-39, ficha N° ${v.id_verificacion}): `
                + `${calc.cumple ? 'Cumple' : 'NO CUMPLE'}. Error 0/15/30 °C: ${fmt1(calc.rangos[0].promedio)} / ${fmt1(calc.rangos[15].promedio)} / ${fmt1(calc.rangos[30].promedio)}.`;
            const obsActual = String(actual?.observacion || '').trim();
            const redondear1 = (n) => Math.round(Number(n) * 10) / 10;
            const payload = {
                error0: redondear1(calc.rangos[0].promedio),
                error15: redondear1(calc.rangos[15].promedio),
                error30: redondear1(calc.rangos[30].promedio),
                tiene_fc: 'SI',
                ultima_verificacion: v.fecha_verificacion,
                siguiente_verificacion: siguiente,
                observacion: obsActual && obsActual !== 'No Aplica' ? `${obsActual}\n${lineaObs}` : lineaObs,
                documento_ruta: ruta,
                documento_nombre: `OI-FoGe-39 Verificación T° ${d}-${mo}-${y}`,
            };
            // updateEquipo rechaza una vigencia ya vencida; si la verificación se
            // registra tarde, se actualiza solo la siguiente revisión.
            if (siguiente >= hoyYmd()) payload.vigencia = siguiente;
            await equipoService.updateEquipo(v.id_equipo, payload, idUsuario);
        } catch (e) {
            try { fs.unlinkSync(abs); } catch { /* ya no existe */ }
            logger.error(`[VerificacionTemperatura] No se pudo aplicar la ficha ${id} al equipo ${v.id_equipo}:`, e);
            throw error(`No se pudo actualizar el equipo: ${e.message}`, 500);
        }

        // Si había un QR de firma por celular, la web ve que ya quedó firmada.
        firmaRemotaService.marcarRegistrada(id, imagenFirma);

        // 3. Cerrar la ficha.
        await pool.request()
            .input('id', sql.Int, Number(id))
            .input('m', sql.Numeric(10, 0), idMuestreador)
            .input('firma', sql.NVarChar(sql.MAX), imagenFirma)
            .input('ff', sql.DateTime, fechaFirma)
            .input('sig', sql.Date, siguiente)
            .input('ruta', sql.NVarChar(500), ruta)
            .query(`UPDATE ${TABLA} SET estado = 'FIRMADA', id_muestreador = @m, firma_muestreador = @firma,
                        fecha_firma = @ff, siguiente_verificacion = @sig, pdf_ruta = @ruta, fecha_modificacion = GETDATE()
                    WHERE id_verificacion = @id`);
        return this.obtener(id);
    },

    async anular(id, motivo) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        if (v.estado === 'FIRMADA') throw error('Una ficha firmada no se puede anular: ya quedó registrada en el equipo', 409);
        if (v.estado === 'ANULADA') throw error('La ficha ya está anulada', 409);
        const m = String(motivo || '').trim();
        if (!m) throw error('Indique el motivo de la anulación');
        await pool.request().input('id', sql.Int, Number(id)).input('mot', sql.NVarChar(500), m.slice(0, 500))
            .query(`UPDATE ${TABLA} SET estado = 'ANULADA', motivo_anulacion = @mot, fecha_modificacion = GETDATE() WHERE id_verificacion = @id`);
        return { success: true };
    },

    // Descartar una ficha que se estaba llenando: se borra del todo (no queda
    // como anulada). Solo en borrador: lo enviado a firma o firmado ya es registro.
    async eliminar(id) {
        const pool = await getConnection();
        const v = await cargar(pool, id);
        if (v.estado !== 'BORRADOR') throw error('Solo se puede eliminar una ficha en borrador; las enviadas a firma se anulan', 409);
        await pool.request().input('id', sql.Int, Number(id))
            .query(`DELETE FROM ${TABLA} WHERE id_verificacion = @id AND estado = 'BORRADOR'`);
        logger.info(`Verificación T° ficha ${id} (${v.codigo_equipo}, ${v.periodo}) eliminada en borrador`);
        return { success: true };
    },

    // ── Resumen y estadística (hoja "Resumen" de la planilla) ────────────────
    // Una fila por equipo con su última ficha no anulada hasta el periodo
    // elegido (fecha, error y FC por rango, resultado y estado del registro),
    // más la serie por periodo para los gráficos.
    async resumen({ periodo } = {}) {
        const pool = await getConnection();
        const hasta = /^\d{4}-\d{2}$/.test(String(periodo || '')) ? String(periodo) : hoyYmd().slice(0, 7);
        const r = await pool.request().input('hasta', sql.VarChar(7), hasta).query(`
            SELECT e.id_equipo, e.codigo, e.nombre, e.tipoequipo, e.sede, e.Estado AS estado_equipo, e.habilitado,
                   CASE WHEN ISNULL(e.Estado, '') LIKE '%baja%' THEN 1 ELSE 0 END AS dado_baja,
                   NULLIF(NULLIF(LTRIM(RTRIM(e.equipo_asociado)), '0'), 'No Aplica') AS equipo_asociado,
                   m.nombre_muestreador,
                   -- Lo registrado en el equipo (planilla / última ficha firmada):
                   -- se muestra cuando aún no hay ficha en el sistema.
                   e.error0 AS eq_error0, e.error15 AS eq_error15, e.error30 AS eq_error30,
                   CONVERT(VARCHAR(10), e.Ultima_verificacion, 23) AS eq_ultima_verificacion,
                   CONVERT(VARCHAR(10), e.Siguiente_verificacion, 23) AS eq_siguiente_verificacion,
                   u.id_verificacion, u.periodo, CONVERT(VARCHAR(10), u.fecha_verificacion, 23) AS fecha_verificacion,
                   u.error0, u.error15, u.error30, u.cumple, u.estado,
                   CASE WHEN u.periodo = @hasta THEN 1 ELSE 0 END AS del_periodo
            FROM mae_equipo e
            LEFT JOIN mae_muestreador m ON m.id_muestreador = e.id_muestreador
            OUTER APPLY (
                SELECT TOP 1 v.id_verificacion, v.periodo, v.fecha_verificacion, v.error0, v.error15, v.error30, v.cumple, v.estado
                FROM ${TABLA} v
                WHERE v.id_equipo = e.id_equipo AND v.estado <> 'ANULADA' AND v.periodo <= @hasta
                ORDER BY v.periodo DESC, v.fecha_verificacion DESC, v.id_verificacion DESC
            ) u
            WHERE ${FILTRO_ELEGIBLES}
            ORDER BY e.tipoequipo, e.codigo`);
        const s = await pool.request().query(`
            SELECT periodo,
                   COUNT(*) AS total,
                   SUM(CASE WHEN estado = 'FIRMADA' THEN 1 ELSE 0 END) AS firmadas,
                   SUM(CASE WHEN estado = 'PENDIENTE_FIRMA' THEN 1 ELSE 0 END) AS pendientes,
                   SUM(CASE WHEN estado = 'BORRADOR' THEN 1 ELSE 0 END) AS borradores,
                   SUM(CASE WHEN cumple = 'S' THEN 1 ELSE 0 END) AS cumplen,
                   SUM(CASE WHEN cumple = 'N' THEN 1 ELSE 0 END) AS no_cumplen,
                   AVG(ABS(CAST(error0 AS FLOAT))) AS prom_abs0,
                   AVG(ABS(CAST(error15 AS FLOAT))) AS prom_abs15,
                   AVG(ABS(CAST(error30 AS FLOAT))) AS prom_abs30
            FROM ${TABLA}
            WHERE estado <> 'ANULADA'
            GROUP BY periodo
            ORDER BY periodo`);
        const red = (n) => (n === null || n === undefined ? null : Math.round(Number(n) * 1000) / 1000);
        return {
            periodo: hasta,
            tolerancia: 0.5,
            equipos: r.recordset,
            serie: s.recordset.map((x) => ({ ...x, prom_abs0: red(x.prom_abs0), prom_abs15: red(x.prom_abs15), prom_abs30: red(x.prom_abs30) })),
        };
    },

    // ── Errores de patrón ────────────────────────────────────────────────────
    // Patrones TPA (con los errores que usan hoy las fichas nuevas) y su
    // historial por año.
    async erroresPatron() {
        const pool = await getConnection();
        const p = await pool.request().query(`
            SELECT e.id_equipo, e.codigo, e.nombre, e.sede, e.habilitado, e.error0, e.error15, e.error30
            FROM mae_equipo e
            WHERE ${FILTRO_PATRON.replace(/(tipoequipo|codigo)/g, 'e.$1')}
            ORDER BY e.codigo`);
        if (!(await hayTablaErrPatron(pool))) return { disponible: false, patrones: p.recordset, registros: [] };
        const r = await pool.request().query(`
            SELECT x.id_error, x.id_equipo, e.codigo, x.anio, x.fecha_calibracion, x.error0, x.error15, x.error30, x.valido_hasta, x.fecha_modificacion
            FROM ${TABLA_ERR_PATRON} x
            JOIN mae_equipo e ON e.id_equipo = x.id_equipo
            ORDER BY x.anio DESC, e.codigo`);
        const registros = r.recordset.map((x) => ({ ...x, fecha_calibracion: ymd(x.fecha_calibracion), valido_hasta: ymd(x.valido_hasta) }));
        return { disponible: true, patrones: p.recordset, registros };
    },

    // Agrega un año nuevo para uno o varios patrones ("Nuevo año"). Los
    // registros son un historial: nunca se reemplazan ni se eliminan, y el año
    // nuevo tiene que ser posterior al vigente del patrón.
    async guardarErroresPatron(idUsuario, body) {
        const pool = await getConnection();
        await exigirTablaErrPatron(pool);
        const filas = (Array.isArray(body?.filas) ? body.filas : [body]).map(filaErrorPatron);
        if (!filas.length) throw error('No hay filas para guardar');
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            for (const f of filas) {
                const ok = await new sql.Request(tx).input('p', sql.Numeric(10, 0), f.id_equipo)
                    .query(`SELECT 1 AS ok FROM mae_equipo WHERE id_equipo = @p AND ${FILTRO_PATRON}`);
                if (!ok.recordset.length) throw error('El equipo indicado no es un termómetro patrón TPA');
                const max = await new sql.Request(tx).input('p', sql.Numeric(10, 0), f.id_equipo)
                    .query(`SELECT MAX(anio) AS anio FROM ${TABLA_ERR_PATRON} WHERE id_equipo = @p`);
                const vigente = max.recordset[0]?.anio;
                if (vigente && f.anio <= vigente) {
                    throw error(f.anio === vigente
                        ? `Ese patrón ya tiene registro para ${f.anio}: edita la fila vigente`
                        : `${f.anio} es anterior al año vigente (${vigente}) de ese patrón: los años pasados no se modifican`, 409);
                }
                await new sql.Request(tx)
                    .input('p', sql.Numeric(10, 0), f.id_equipo)
                    .input('anio', sql.Int, f.anio)
                    .input('fc', sql.Date, f.fecha_calibracion)
                    .input('e0', sql.Decimal(6, 2), f.error0)
                    .input('e15', sql.Decimal(6, 2), f.error15)
                    .input('e30', sql.Decimal(6, 2), f.error30)
                    .input('vh', sql.Date, f.valido_hasta)
                    .input('u', sql.Numeric(10, 0), idUsuario ? Number(idUsuario) : null)
                    .query(`
                        INSERT INTO ${TABLA_ERR_PATRON} (id_equipo, anio, fecha_calibracion, error0, error15, error30, valido_hasta, id_usuario)
                        VALUES (@p, @anio, @fc, @e0, @e15, @e30, @vh, @u)`);
            }
            for (const idEquipo of new Set(filas.map((f) => f.id_equipo))) await sincronizarPatronVigente(tx, idEquipo);
            await tx.commit();
        } catch (e) {
            await tx.rollback().catch(() => {});
            throw e;
        }
        return this.erroresPatron();
    },

    // Solo se corrige el registro vigente (el año más reciente del patrón), y
    // sin cambiarle el año. Los años pasados quedan como historial.
    async actualizarErrorPatron(idError, idUsuario, body) {
        const pool = await getConnection();
        await exigirTablaErrPatron(pool);
        const r = await pool.request().input('id', sql.Int, Number(idError)).query(`
            SELECT x.id_equipo, x.anio,
                   (SELECT MAX(y.anio) FROM ${TABLA_ERR_PATRON} y WHERE y.id_equipo = x.id_equipo) AS anio_vigente
            FROM ${TABLA_ERR_PATRON} x WHERE x.id_error = @id`);
        const actual = r.recordset[0];
        if (!actual) throw error('Registro no encontrado', 404);
        if (actual.anio !== actual.anio_vigente) {
            throw error(`El registro ${actual.anio} ya no está vigente (vigente: ${actual.anio_vigente}): los años pasados no se modifican`, 409);
        }
        const f = filaErrorPatron({ ...body, id_equipo: actual.id_equipo, anio: actual.anio });
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx)
                .input('id', sql.Int, Number(idError))
                .input('anio', sql.Int, f.anio)
                .input('fc', sql.Date, f.fecha_calibracion)
                .input('e0', sql.Decimal(6, 2), f.error0)
                .input('e15', sql.Decimal(6, 2), f.error15)
                .input('e30', sql.Decimal(6, 2), f.error30)
                .input('vh', sql.Date, f.valido_hasta)
                .input('u', sql.Numeric(10, 0), idUsuario ? Number(idUsuario) : null)
                .query(`UPDATE ${TABLA_ERR_PATRON}
                        SET anio = @anio, fecha_calibracion = @fc, error0 = @e0, error15 = @e15, error30 = @e30, valido_hasta = @vh,
                            id_usuario = @u, fecha_modificacion = GETDATE()
                        WHERE id_error = @id`);
            await sincronizarPatronVigente(tx, f.id_equipo);
            await tx.commit();
        } catch (e) {
            await tx.rollback().catch(() => {});
            throw e;
        }
        return this.erroresPatron();
    },

    nombreUsuario: async (idUsuario) => nombreUsuario(await getConnection(), idUsuario),
};

export default verificacionTemperaturaService;
