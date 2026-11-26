import sql from 'mssql';
import { getConnection } from '../config/database.js';

// G.C. Medio Ambiente → verificaciones de terreno. Los tres formularios se llenan a partir de un muestreo:
// con su folio (el de la planilla OI-FoMa-01, que el OI-FoGe-26 pide por su nombre) ya llegan el encabezado,
// los equipos que se usaron y su error de temperatura, que la app del muestreador deja en
// App_Ma_Equipos_MUESTREOS. Lo demás son listas de chequeo que se marcan a mano.

const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });

// Prefijo del código del equipo (pHp.71/MA.PM) → para qué sirve en estos formularios.
const FAMILIA = {
    pHp: 'ph', MpH: 'ph', pHs: 'ph',
    MOD: 'oxigeno', SOD: 'oxigeno',
    MCL: 'cloro',
    MAU: 'mau',
    MCA: 'sonda_caudal',
};
const familiaDe = (codigo) => FAMILIA[String(codigo || '').split('.')[0]] || null;

// Tipo de agua del muestreo → casilla de «Características de la muestra» del OI-FoMa-19.
const caracteristicaDe = (nombre, agrupa) => {
    const n = String(nombre || '').trim().toLowerCase();
    if (/servida|a\.?s\.?$/.test(n)) return 'AS';
    if (/\bril\b/.test(n)) return 'RIL';
    if (agrupa === 'AM' || /mar/.test(n)) return 'MAR';
    if (agrupa === 'AD' || agrupa === 'AE') return 'SUPERFICIAL';
    return n && n !== 'no aplica' && n !== 'no informado' ? 'OTROS' : null;
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/**
 * Datos del muestreo con los que se precargan los tres formularios.
 * Los equipos se buscan por ficha **y** correlativo: una misma ficha puede tener varias frecuencias,
 * cada una con sus propios equipos.
 */
const datosDeFolio = async (folio) => {
    const n = Number(folio);
    if (!Number.isFinite(n) || n <= 0) throw error('Indique el folio de la planilla OI-FoMa-01.');
    const pool = await getConnection();

    const r = await pool.request().input('folio', sql.Numeric(10, 0), n).query(`
        SELECT TOP 1
            a.Folio AS folio, a.id_agendamam, a.id_fichaingresoservicio, a.frecuencia_correlativo,
            CONVERT(VARCHAR(10), a.fecha_muestreo, 23) AS fecha_muestreo,
            a.ma_muestreo_horai, a.ma_muestreo_horat,
            LTRIM(RTRIM(e.nombre_empresa)) AS empresa,
            LTRIM(RTRIM(f.ma_punto_muestreo)) AS punto,
            LTRIM(RTRIM(ta.nombre_tipoagua)) AS tipo_agua, ta.agrupa,
            LTRIM(RTRIM(m.nombre_muestreador)) AS muestreador,
            LTRIM(RTRIM(f.responsablemuestreo)) AS responsable_ficha,
            a.ma_phi, a.ma_temperaturai, a.temperatura_corregidai, a.temperatura_fc,
            a.observaciones_muestreador
        FROM App_Ma_Agenda_MUESTREOS a
        JOIN App_Ma_FichaIngresoServicio_ENC f ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
        LEFT JOIN mae_empresa e ON e.id_empresa = f.id_empresa
        LEFT JOIN mae_tipoagua ta ON ta.id_tipoagua = f.id_tipoagua
        LEFT JOIN mae_muestreador m ON m.id_muestreador = a.id_muestreador
        WHERE a.Folio = @folio`);

    const m = r.recordset[0];
    if (!m) throw error(`No se encontró un muestreo con el folio ${n}.`, 404);

    const eq = await pool.request()
        .input('ficha', sql.Numeric(10, 0), m.id_fichaingresoservicio)
        .input('corr', sql.NVarChar(100), m.frecuencia_correlativo || '')
        .query(`
            SELECT q.id_equipo, LTRIM(RTRIM(q.codigo)) AS codigo, LTRIM(RTRIM(q.nombre)) AS nombre,
                   LTRIM(RTRIM(q.marca)) AS marca, LTRIM(RTRIM(q.n_serie)) AS n_serie,
                   x.tienefc, x.error0, x.error15, x.error30, x.usado_instalacion, x.usado_retiro
            FROM App_Ma_Equipos_MUESTREOS x
            JOIN mae_equipo q ON q.id_equipo = x.id_equipo
            WHERE x.id_fichaingresoservicio = @ficha AND x.frecuencia_correlativo = @corr
            ORDER BY q.codigo`);

    const equipos = eq.recordset.map((x) => ({
        id_equipo: Number(x.id_equipo), codigo: x.codigo, nombre: x.nombre, marca: x.marca, n_serie: x.n_serie,
        familia: familiaDe(x.codigo),
        tiene_fc: String(x.tienefc || '').toUpperCase() === 'S',
        error_t0: num(x.error0), error_t15: num(x.error15), error_t30: num(x.error30),
    }));

    return {
        folio: Number(m.folio),
        id_agendamam: Number(m.id_agendamam),
        fecha: m.fecha_muestreo,
        hora: m.ma_muestreo_horai || m.ma_muestreo_horat || null,
        hora_termino: m.ma_muestreo_horat || null,
        empresa: m.empresa || null,
        lugar_muestreo: m.punto || null,
        muestreador: m.muestreador || m.responsable_ficha || null,
        tipo_agua: m.tipo_agua || null,
        caracteristica: caracteristicaDe(m.tipo_agua, m.agrupa),
        // Lo que el muestreador midió en el agua. No se vuelca al formulario: las tablas de «Control
        // Medición» son lecturas de los buffers de calibración, no de la muestra. Va a la vista como
        // referencia, para tenerlo delante al verificar el equipo.
        medicion: {
            ph: m.ma_phi || null,
            temperatura: m.ma_temperaturai || null,
            temperatura_corregida: m.temperatura_corregidai || null,
            factor_correccion: m.temperatura_fc === null || m.temperatura_fc === undefined ? null : Number(m.temperatura_fc),
            observacion: m.observaciones_muestreador || null,
        },
        equipos,
        // Atajos para cada formulario: el primero de cada familia es el que se propone.
        sugerencias: {
            ph: equipos.find((x) => x.familia === 'ph') || null,
            oxigeno: equipos.find((x) => x.familia === 'oxigeno') || null,
            cloro: equipos.find((x) => x.familia === 'cloro') || null,
            mau: equipos.find((x) => x.familia === 'mau') || null,
            sonda_caudal: equipos.find((x) => x.familia === 'sonda_caudal') || null,
        },
    };
};


/**
 * Muestreos con folio para elegir en la pantalla, del más reciente al más antiguo.
 * `texto` busca por folio, empresa o punto. `tabla` (opcional) marca los que ya tienen el formulario hecho.
 */
const buscarMuestreos = async ({ texto = '', limite = 40, tabla = null } = {}) => {
    const pool = await getConnection();
    const req = pool.request().input('top', sql.Int, Math.min(Number(limite) || 40, 200));
    const filtros = ['a.Folio IS NOT NULL'];
    const t = String(texto || '').trim();
    if (t) {
        req.input('txt', sql.NVarChar(200), `%${t}%`);
        filtros.push(`(CONVERT(VARCHAR(20), a.Folio) LIKE @txt OR e.nombre_empresa LIKE @txt OR f.ma_punto_muestreo LIKE @txt)`);
    }
    // Sólo se marca «ya hecho» con un nombre de tabla propio, nunca con algo que venga de afuera.
    const TABLAS = { equipos: 'mae_ma_verif_equipos', mau: 'mae_ma_verif_mau', materiales: 'mae_ma_lista_materiales' };
    const nombreTabla = TABLAS[tabla] || null;

    // Cada formulario verifica unos equipos: no tiene sentido ofrecer muestreos donde no se usaron.
    // Los prefijos son los del código del equipo (MAU.05/MA.PM), fijos en el código, nunca de fuera.
    const PREFIJOS = {
        mau: ['MAU'],
        equipos: ['pHp', 'MpH', 'pHs', 'MOD', 'SOD', 'MCL'],
    };
    const prefijos = PREFIJOS[tabla];
    if (prefijos) {
        const like = prefijos.map((x) => `q.codigo LIKE '${x}.%'`).join(' OR ');
        filtros.push(`EXISTS (
            SELECT 1 FROM App_Ma_Equipos_MUESTREOS x
            JOIN mae_equipo q ON q.id_equipo = x.id_equipo
            WHERE x.id_fichaingresoservicio = a.id_fichaingresoservicio
              AND x.frecuencia_correlativo = a.frecuencia_correlativo
              AND (${like}))`);
    }
    const pk = nombreTabla === 'mae_ma_lista_materiales' ? 'id_lista' : 'id_verificacion';
    const yaHecho = nombreTabla
        ? `(SELECT COUNT(*) FROM ${nombreTabla} x WHERE x.folio_foma = a.Folio AND x.estado <> 'ANULADA')`
        : '0';
    // El formulario vigente de ese folio, si ya existe, para abrirlo sin crear otro.
    const idHecho = nombreTabla
        ? `(SELECT TOP 1 x.${pk} FROM ${nombreTabla} x WHERE x.folio_foma = a.Folio AND x.estado <> 'ANULADA' ORDER BY x.${pk} DESC)`
        : 'NULL';
    const estadoHecho = nombreTabla
        ? `(SELECT TOP 1 x.estado FROM ${nombreTabla} x WHERE x.folio_foma = a.Folio AND x.estado <> 'ANULADA' ORDER BY x.${pk} DESC)`
        : 'NULL';

    const r = await req.query(`
        SELECT TOP (@top)
            a.Folio AS folio,
            CONVERT(VARCHAR(10), a.fecha_muestreo, 23) AS fecha,
            a.ma_muestreo_horai AS hora,
            LTRIM(RTRIM(e.nombre_empresa)) AS empresa,
            LTRIM(RTRIM(f.ma_punto_muestreo)) AS punto,
            LTRIM(RTRIM(m.nombre_muestreador)) AS muestreador,
            ${yaHecho} AS hechos, ${idHecho} AS id_formulario, ${estadoHecho} AS estado_formulario
        FROM App_Ma_Agenda_MUESTREOS a
        JOIN App_Ma_FichaIngresoServicio_ENC f ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
        LEFT JOIN mae_empresa e ON e.id_empresa = f.id_empresa
        LEFT JOIN mae_muestreador m ON m.id_muestreador = a.id_muestreador
        WHERE ${filtros.join(' AND ')}
        ORDER BY a.fecha_muestreo DESC, a.Folio DESC`);

    return r.recordset.map((x) => ({
        folio: Number(x.folio), fecha: x.fecha, hora: x.hora || null,
        empresa: x.empresa || null, punto: x.punto || null, muestreador: x.muestreador || null,
        hechos: Number(x.hechos) || 0,
        id_formulario: x.id_formulario === null ? null : Number(x.id_formulario),
        estado_formulario: x.estado_formulario || null,
    }));
};

export default { datosDeFolio, buscarMuestreos, familiaDe, caracteristicaDe };
export { datosDeFolio, buscarMuestreos, familiaDe, caracteristicaDe };
