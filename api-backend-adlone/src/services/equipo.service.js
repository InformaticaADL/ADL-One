import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

// Helper to parse dates in various formats (ISO, DD/MM/YYYY, Date objects)
const parseSqlDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;

    // Check if it's a string in DD/MM/YYYY format
    if (typeof dateVal === 'string' && dateVal.includes('/')) {
        const parts = dateVal.split('/');
        if (parts.length === 3) {
            const day = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
            const year = parseInt(parts[2], 10);
            const date = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }
    }

    // Fallback to standard constructor (handles ISO strings)
    const fallbackDate = new Date(dateVal);
    return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
};

export const equipoService = {
    /**
     * Get list of equipment with filters and pagination
     */
    getEquipos: async (params = {}) => {
        try {
            const { search, tipo, sede, estado, page = 1, limit = 10 } = params;
            const pool = await getConnection();

            // Filters logic for both count and data
            let whereClause = ' WHERE 1=1';
            const request = pool.request();

            if (search) {
                request.input('search', sql.VarChar, `%${search}%`);
                whereClause += ` AND (
                    e.codigo LIKE @search OR 
                    e.nombre LIKE @search OR 
                    e.tipoequipo LIKE @search OR 
                    e.sede LIKE @search OR 
                    m.nombre_muestreador LIKE @search
                )`;
            }

            if (tipo && tipo !== 'Todos') {
                request.input('tipo', sql.VarChar, tipo);
                whereClause += ` AND e.tipoequipo = @tipo`;
            }

            if (sede && sede !== 'Todos') {
                request.input('sede', sql.VarChar, sede);
                whereClause += ` AND e.sede = @sede`;
            }

            if (estado && estado !== 'Todos') {
                const habilitadoVal = estado === 'Activo' ? 'S' : 'N';
                request.input('habilitado', sql.VarChar, habilitadoVal);
                whereClause += ` AND e.habilitado = @habilitado`;
            }

            // 1. Get total for pagination
            const countQuery = `
                SELECT COUNT(*) as total 
                FROM mae_equipo e 
                LEFT JOIN mae_muestreador m ON e.id_muestreador = m.id_muestreador
                ${whereClause}
            `;
            const countResult = await request.query(countQuery);
            const total = countResult.recordset[0].total;

            // 2. Get data
            const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
            request.input('offset', sql.Int, offset);
            request.input('limit', sql.Int, Number(limit));

            const query = `
                SELECT 
                    e.id_equipo,
                    e.codigo,
                    e.nombre,
                    e.tipoequipo as tipo,
                    e.sede as ubicacion,
                    FORMAT(e.fecha_vigencia, 'dd/MM/yyyy') as vigencia,
                    e.id_muestreador,
                    CASE WHEN e.habilitado = 'S' THEN 'Activo' ELSE 'Inactivo' END as estado,
                    m.nombre_muestreador as nombre_asignado,
                    e.sigla,
                    e.correlativo,
                    e.tienefc as tiene_fc,
                    e.error0,
                    e.error15,
                    e.error30,
                    e.equipo_asociado,
                    e.observacion,
                    e.visible_muestreador,
                    e.que_mide,
                    e.unidad_medida_textual,
                    e.unidad_medida_sigla,
                    e.informe
                FROM mae_equipo e
                LEFT JOIN mae_muestreador m ON e.id_muestreador = m.id_muestreador
                ${whereClause}
                ORDER BY e.id_equipo ASC 
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `;

            const result = await request.query(query);

            // 3. Get unique types and states based on current OTHER filters
            const getCatalogs = async (currentSede) => {
                let typesQuery = 'SELECT DISTINCT tipoequipo as tipo FROM mae_equipo WHERE tipoequipo IS NOT NULL';
                let statesQuery = 'SELECT DISTINCT CASE WHEN habilitado = \'S\' THEN \'Activo\' ELSE \'Inactivo\' END as estado FROM mae_equipo WHERE 1=1';
                let sedesQuery = 'SELECT DISTINCT sede FROM mae_equipo WHERE sede IS NOT NULL AND sede != \'\'';
                let namesQuery = 'SELECT DISTINCT nombre FROM mae_equipo WHERE nombre IS NOT NULL';

                if (currentSede && currentSede !== 'Todos') {
                    typesQuery += ` AND sede = '${currentSede}'`;
                    statesQuery += ` AND sede = '${currentSede}'`;
                    namesQuery += ` AND sede = '${currentSede}'`;
                }

                const [tRes, sRes, lRes, nRes] = await Promise.all([
                    pool.request().query(typesQuery),
                    pool.request().query(statesQuery),
                    pool.request().query(sedesQuery),
                    pool.request().query(namesQuery)
                ]);
                return {
                    tipos: tRes.recordset.map(r => r.tipo).sort(),
                    estados: sRes.recordset.map(r => r.estado).sort(),
                    sedes: lRes.recordset.map(r => r.sede).sort(),
                    nombres: nRes.recordset.map(r => r.nombre).sort()
                };
            };

            const catalogs = await getCatalogs(sede);

            return {
                data: result.recordset,
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit),
                catalogs
            };
        } catch (error) {
            logger.error('Error in getEquipos service:', error);
            throw error;
        }
    },

    getNextCorrelativo: async (tipo) => {
        try {
            const pool = await getConnection();
            const request = pool.request();
            request.input('tipo', sql.VarChar, tipo);

            const query = `
                SELECT MAX(correlativo) as lastCorrelativo 
                FROM mae_equipo 
                WHERE tipoequipo = @tipo
            `;
            const result = await request.query(query);
            const lastNum = result.recordset[0].lastCorrelativo || 0;
            return { nextCorrelativo: Number(lastNum) + 1 };
        } catch (error) {
            logger.error('Error in getNextCorrelativo service:', error);
            throw error;
        }
    },

    suggestNextCode: async (tipo, ubicacion, nombre = '') => {
        try {
            const pool = await getConnection();

            // 1. Try to find the most common sigla for this name or type
            const siglaRequest = pool.request();
            siglaRequest.input('tipo', sql.VarChar, `%${tipo}%`);
            siglaRequest.input('nombre', sql.VarChar, `%${nombre}%`);

            // Priority: Name match, then Type match
            const siglaQuery = `
                SELECT TOP 1 sigla 
                FROM mae_equipo 
                WHERE (nombre LIKE @nombre OR tipoequipo LIKE @tipo)
                AND sigla IS NOT NULL AND sigla != ''
                GROUP BY sigla 
                ORDER BY MAX(CASE WHEN nombre LIKE @nombre THEN 1 ELSE 0 END) DESC, COUNT(*) DESC
            `;
            const siglaResult = await siglaRequest.query(siglaQuery);

            let sigla = 'EQ'; // Default if none found
            if (siglaResult.recordset.length > 0 && siglaResult.recordset[0].sigla) {
                sigla = siglaResult.recordset[0].sigla;
            } else {
                // Fallback: common mappings
                const commonMappings = {
                    'Analizador': 'ANA',
                    'Balanza': 'BAL',
                    'Cámara': 'CAM',
                    'Centrífuga': 'CEN',
                    'GPS': 'GPS',
                    'Instrumento': 'INS',
                    'Medidor': 'MED',
                    'Multiparámetro': 'MPA',
                    'Phmetro': 'PHM',
                    'Sonda': 'SON'
                };

                const searchStr = (nombre + ' ' + tipo).toLowerCase();
                for (const [key, val] of Object.entries(commonMappings)) {
                    if (searchStr.includes(key.toLowerCase())) {
                        sigla = val;
                        break;
                    }
                }
            }

            // 2. Find the highest correlativo for this sigla
            const corrRequest = pool.request();
            corrRequest.input('sigla', sql.VarChar, sigla);
            const corrQuery = `
                SELECT MAX(correlativo) as lastCorrelativo 
                FROM mae_equipo 
                WHERE sigla = @sigla
                `;
            const corrResult = await corrRequest.query(corrQuery);
            const nextCorr = (Number(corrResult.recordset[0].lastCorrelativo) || 0) + 1;

            // 3. Format code: [Sigla].[Correlativo]/MA.[Ubicacion]
            const formattedCorr = nextCorr < 10 ? `0${nextCorr} ` : `${nextCorr} `;
            const suggestedCode = `${sigla}.${formattedCorr}/MA.${ubicacion}`;

            return {
                sigla,
                correlativo: nextCorr,
                suggestedCode
            };
        } catch (error) {
            logger.error('Error in suggestNextCode service:', error);
            throw error;
        }
    },

    getEquipoById: async (id) => {
        try {
            const pool = await getConnection();
            const request = pool.request();
            request.input('id', sql.Int, id);

            const query = `
                SELECT 
                    e.id_equipo,
                    e.codigo,
                    e.nombre,
                    e.tipoequipo as tipo,
                    e.sede as ubicacion,
                    FORMAT(e.fecha_vigencia, 'dd/MM/yyyy') as vigencia,
                    e.id_muestreador,
                    CASE WHEN e.habilitado = 'S' THEN 'Activo' ELSE 'Inactivo' END as estado,
                    m.nombre_muestreador as nombre_asignado,
                    e.sigla,
                    e.correlativo,
                    e.tienefc as tiene_fc,
                    e.error0,
                    e.error15,
                    e.error30,
                    e.equipo_asociado,
                    e.observacion,
                    e.visible_muestreador,
                    e.que_mide,
                    e.unidad_medida_textual,
                    e.unidad_medida_sigla,
                    e.informe,
                    e.version
                FROM mae_equipo e
                LEFT JOIN mae_muestreador m ON e.id_muestreador = m.id_muestreador
                WHERE e.id_equipo = @id
            `;

            const result = await request.query(query);
            return result.recordset[0];
        } catch (error) {
            logger.error('Error in getEquipoById service:', error);
            throw error;
        }
    },

    findMatchingVersion: async (id_equipo, data) => {
        try {
            const pool = await getConnection();
            const request = pool.request();
            request.input('id_equipo', sql.Numeric(10, 0), Number(id_equipo));

            // Fetch all history entries for this equipment
            const result = await request.query('SELECT * FROM mae_equipo_historial WHERE id_equipo = @id_equipo ORDER BY version DESC');
            const history = result.recordset;

            for (const h of history) {
                // Compare all relevant fields
                // Note: Use fuzzy comparison for numbers and handle nulls

                // Safe date comparison
                const hDate = h.fecha_vigencia ? h.fecha_vigencia.toISOString().split('T')[0] : null;
                const dDate = data.vigencia ? new Date(data.vigencia).toISOString().split('T')[0] : null;

                const matches =
                    h.codigo === data.codigo &&
                    h.nombre === data.nombre &&
                    h.tipoequipo === data.tipo &&
                    h.sede === data.ubicacion &&
                    hDate === dDate &&
                    Number(h.id_muestreador) === Number(data.id_muestreador || 0) &&
                    h.habilitado === (data.estado === 'Activo' ? 'S' : 'N') &&
                    h.sigla === (data.sigla || '') &&
                    Number(h.correlativo) === Number(data.correlativo || 0) &&
                    h.tienefc === ((data.tiene_fc === 'SI' || data.tiene_fc === 'S') ? 'S' : 'N') &&
                    Number(h.error0) === Number(data.error0 || 0) &&
                    Number(h.error15) === Number(data.error15 || 0) &&
                    Number(h.error30) === Number(data.error30 || 0) &&
                    h.equipo_asociado === ((data.equipo_asociado === null || data.equipo_asociado === undefined || data.equipo_asociado === 'No Aplica') ? '0' : String(data.equipo_asociado)) &&
                    (h.observacion || '') === (data.observacion || '') &&
                    h.visible_muestreador === ((data.visible_muestreador === 'SI' || data.visible_muestreador === 'S') ? 'S' : 'N') &&
                    (h.que_mide || '') === (data.que_mide || '') &&
                    (h.unidad_medida_textual || '') === (data.unidad_medida_textual || '') &&
                    (h.unidad_medida_sigla || '') === (data.unidad_medida_sigla || '') &&
                    h.informe === ((data.informe === 'SI' || data.informe === 'S') ? 'S' : 'N');

                if (matches) return h.version;
            }
            return null;
        } catch (error) {
            console.error('Error in findMatchingVersion:', error);
            return null; // Don't crash the whole save if matching fails
        }
    },

    createEquipo: async (data, userId = null) => {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            const request = new sql.Request(transaction);

            // Bind all inputs
            request.input('codigo', sql.VarChar, data.codigo);
            request.input('nombre', sql.VarChar, data.nombre);
            request.input('tipoequipo', sql.VarChar, data.tipo);
            request.input('sede', sql.VarChar, data.ubicacion);
            request.input('fecha_vigencia', sql.Date, data.vigencia);
            request.input('id_muestreador', sql.Numeric(10, 0), data.id_muestreador || 0);
            request.input('habilitado', sql.VarChar(1), data.estado === 'Activo' ? 'S' : 'N');
            request.input('sigla', sql.VarChar(10), data.sigla || '');
            request.input('correlativo', sql.Numeric(10, 0), data.correlativo || 0);
            request.input('tienefc', sql.VarChar(1), (data.tiene_fc === 'SI' || data.tiene_fc === 'S') ? 'S' : 'N');
            request.input('error0', sql.Numeric(10, 1), isNaN(parseFloat(data.error0)) ? 0 : parseFloat(data.error0));
            request.input('error15', sql.Numeric(10, 1), isNaN(parseFloat(data.error15)) ? 0 : parseFloat(data.error15));
            request.input('error30', sql.Numeric(10, 1), isNaN(parseFloat(data.error30)) ? 0 : parseFloat(data.error30));
            request.input('equipo_asociado', sql.VarChar(20), (data.equipo_asociado === null || data.equipo_asociado === undefined || data.equipo_asociado === 'No Aplica') ? '0' : String(data.equipo_asociado));
            request.input('observacion', sql.VarChar, data.observacion || '');
            request.input('visible_muestreador', sql.VarChar(1), (data.visible_muestreador === 'SI' || data.visible_muestreador === 'S') ? 'S' : 'N');
            request.input('que_mide', sql.VarChar, data.que_mide || '');
            request.input('unidad_medida_textual', sql.VarChar, data.unidad_medida_textual || '');
            request.input('unidad_medida_sigla', sql.VarChar, data.unidad_medida_sigla || '');
            request.input('informe', sql.VarChar(1), (data.informe === 'SI' || data.informe === 'S') ? 'S' : 'N');

            const queryMain = `
                INSERT INTO mae_equipo (
                    codigo, nombre, tipoequipo, sede, fecha_vigencia, id_muestreador, habilitado,
                    sigla, correlativo, tienefc, error0, error15, error30, equipo_asociado,
                    observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla, informe, version
                ) VALUES (
                    @codigo, @nombre, @tipoequipo, @sede, @fecha_vigencia, @id_muestreador, @habilitado,
                    @sigla, @correlativo, @tienefc, @error0, @error15, @error30, @equipo_asociado,
                    @observacion, @visible_muestreador, @que_mide, @unidad_medida_textual, @unidad_medida_sigla, @informe, 'v1'
                );
                SELECT SCOPE_IDENTITY() as id;
            `;

            const resultMain = await request.query(queryMain);
            const newId = resultMain.recordset[0].id;

            await transaction.commit();
            return { id: newId, ...data };
        } catch (error) {
            await transaction.rollback();
            logger.error('Error in createEquipo service:', error);
            throw error;
        }
    },

    updateEquipo: async (id, data, userId = null) => {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Fetch CURRENT state (to move to history)
            const currentRequest = new sql.Request(transaction);
            currentRequest.input('id', sql.Int, id);
            const currentResult = await currentRequest.query('SELECT * FROM mae_equipo WHERE id_equipo = @id');
            const current = currentResult.recordset[0];

            if (!current) throw new Error('Equipo no encontrado');

            // 2. Count existing history entries to determine version
            const countRequest = new sql.Request(transaction);
            countRequest.input('id_equipo', sql.Numeric(10, 0), Number(id));
            const countResult = await countRequest.query('SELECT COUNT(*) as total FROM mae_equipo_historial WHERE id_equipo = @id_equipo');
            const versionNum = countResult.recordset[0].total + 1;
            // const nextVersionLabel = `v${versionNum + 1}`; // This will be determined dynamically

            // 3. ARCHIVE CURRENT state into History (Upsert)
            const checkHistReq = new sql.Request(transaction);
            checkHistReq.input('id_equipo', sql.Numeric(10, 0), Number(id));
            checkHistReq.input('version', sql.VarChar(10), current.version || 'v1');
            const checkHistRes = await checkHistReq.query('SELECT id_historial FROM mae_equipo_historial WHERE id_equipo = @id_equipo AND version = @version');

            if (checkHistRes.recordset.length > 0) {
                // UPDATE existing history entry's timestamp (Bubble up)
                const updHistReq = new sql.Request(transaction);
                updHistReq.input('id_h', sql.Numeric(10, 0), checkHistRes.recordset[0].id_historial);
                await updHistReq.query('UPDATE mae_equipo_historial SET fecha_cambio = GETDATE() WHERE id_historial = @id_h');
            } else {
                // INSERT new history entry
                const requestHist = new sql.Request(transaction);
                requestHist.input('id_equipo', sql.Numeric(10, 0), Number(id));
                requestHist.input('usuario_cambio', sql.Numeric(10, 0), userId);
                requestHist.input('version', sql.VarChar(10), current.version || 'v1');

                // Bind current record values for history
                requestHist.input('codigo', sql.VarChar, current.codigo);
                requestHist.input('nombre', sql.VarChar, current.nombre);
                requestHist.input('tipoequipo', sql.VarChar, current.tipoequipo);
                requestHist.input('sede', sql.VarChar, current.sede);
                requestHist.input('fecha_vigencia', sql.Date, current.fecha_vigencia);
                requestHist.input('id_muestreador', sql.Numeric(10, 0), current.id_muestreador || 0);
                requestHist.input('habilitado', sql.VarChar(1), current.habilitado || 'S');
                requestHist.input('sigla', sql.VarChar(10), current.sigla || '');
                requestHist.input('correlativo', sql.Numeric(10, 0), current.correlativo || 0);
                requestHist.input('tienefc', sql.VarChar(1), current.tienefc || 'N');
                requestHist.input('error0', sql.Numeric(10, 1), current.error0 || 0);
                requestHist.input('error15', sql.Numeric(10, 1), current.error15 || 0);
                requestHist.input('error30', sql.Numeric(10, 1), current.error30 || 0);
                requestHist.input('equipo_asociado', sql.VarChar(20), current.equipo_asociado || '0');
                requestHist.input('observacion', sql.VarChar, current.observacion || '');
                requestHist.input('visible_muestreador', sql.VarChar(1), current.visible_muestreador || 'N');
                requestHist.input('que_mide', sql.VarChar, current.que_mide || '');
                requestHist.input('unidad_medida_textual', sql.VarChar, current.unidad_medida_textual || '');
                requestHist.input('unidad_medida_sigla', sql.VarChar, current.unidad_medida_sigla || '');
                requestHist.input('informe', sql.VarChar(1), current.informe || 'N');

                const queryHist = `
                    INSERT INTO mae_equipo_historial (
                        id_equipo, codigo, nombre, tipoequipo, sede, fecha_vigencia, id_muestreador, habilitado,
                        sigla, correlativo, tienefc, error0, error15, error30, equipo_asociado,
                        observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla, informe, 
                        usuario_cambio, version, fecha_cambio
                    ) VALUES (
                        @id_equipo, @codigo, @nombre, @tipoequipo, @sede, @fecha_vigencia, @id_muestreador, @habilitado,
                        @sigla, @correlativo, @tienefc, @error0, @error15, @error30, @equipo_asociado,
                        @observacion, @visible_muestreador, @que_mide, @unidad_medida_textual, @unidad_medida_sigla, @informe, 
                        @usuario_cambio, @version, GETDATE()
                    );
                `;
                await requestHist.query(queryHist);
            }

            // 4. Update Main Table with NEW data and increment version
            const requestMain = new sql.Request(transaction);
            requestMain.input('id', sql.Int, id);

            // Partial Update Support: If a field is missing in 'data', use 'current' value
            requestMain.input('codigo', sql.VarChar, data.hasOwnProperty('codigo') ? data.codigo : current.codigo);
            requestMain.input('nombre', sql.VarChar, data.hasOwnProperty('nombre') ? data.nombre : current.nombre);
            requestMain.input('tipoequipo', sql.VarChar, data.hasOwnProperty('tipo') ? data.tipo : current.tipoequipo);
            requestMain.input('sede', sql.VarChar, data.hasOwnProperty('ubicacion') ? data.ubicacion : current.sede);

            // Fix for EPARAM error: Ensure date is properly parsed before binding
            const vigDate = data.hasOwnProperty('vigencia') ? data.vigencia : current.fecha_vigencia;
            requestMain.input('fecha_vigencia', sql.Date, parseSqlDate(vigDate));

            requestMain.input('id_muestreador', sql.Numeric(10, 0), data.hasOwnProperty('id_muestreador') ? data.id_muestreador : (current.id_muestreador || 0));
            requestMain.input('habilitado', sql.VarChar(1), data.hasOwnProperty('estado') ? (data.estado === 'Activo' ? 'S' : 'N') : current.habilitado);
            requestMain.input('sigla', sql.VarChar(10), data.hasOwnProperty('sigla') ? (data.sigla || '') : (current.sigla || ''));
            requestMain.input('correlativo', sql.Numeric(10, 0), data.hasOwnProperty('correlativo') ? (data.correlativo || 0) : (current.correlativo || 0));
            requestMain.input('tienefc', sql.VarChar(1), data.hasOwnProperty('tiene_fc') ? ((data.tiene_fc === 'SI' || data.tiene_fc === 'S') ? 'S' : 'N') : (current.tienefc || 'N'));

            const error0 = data.hasOwnProperty('error0') ? data.error0 : current.error0;
            requestMain.input('error0', sql.Numeric(10, 1), isNaN(parseFloat(error0)) ? 0 : parseFloat(error0));

            const error15 = data.hasOwnProperty('error15') ? data.error15 : current.error15;
            requestMain.input('error15', sql.Numeric(10, 1), isNaN(parseFloat(error15)) ? 0 : parseFloat(error15));

            const error30 = data.hasOwnProperty('error30') ? data.error30 : current.error30;
            requestMain.input('error30', sql.Numeric(10, 1), isNaN(parseFloat(error30)) ? 0 : parseFloat(error30));

            const eqAsoc = data.hasOwnProperty('equipo_asociado') ? data.equipo_asociado : current.equipo_asociado;
            requestMain.input('equipo_asociado', sql.VarChar(20), (eqAsoc === null || eqAsoc === undefined || eqAsoc === 'No Aplica') ? '0' : String(eqAsoc));

            requestMain.input('observacion', sql.VarChar, data.hasOwnProperty('observacion') ? (data.observacion || '') : (current.observacion || ''));

            const visMuest = data.hasOwnProperty('visible_muestreador') ? data.visible_muestreador : current.visible_muestreador;
            requestMain.input('visible_muestreador', sql.VarChar(1), (visMuest === 'SI' || visMuest === 'S') ? 'S' : 'N');

            requestMain.input('que_mide', sql.VarChar, data.hasOwnProperty('que_mide') ? (data.que_mide || '') : (current.que_mide || ''));
            requestMain.input('unidad_medida_textual', sql.VarChar, data.hasOwnProperty('unidad_medida_textual') ? (data.unidad_medida_textual || '') : (current.unidad_medida_textual || ''));
            requestMain.input('unidad_medida_sigla', sql.VarChar, data.hasOwnProperty('unidad_medida_sigla') ? (data.unidad_medida_sigla || '') : (current.unidad_medida_sigla || ''));

            const inf = data.hasOwnProperty('informe') ? data.informe : current.informe;
            requestMain.input('informe', sql.VarChar(1), (inf === 'SI' || inf === 'S') ? 'S' : 'N');

            // Increment version based on current OR reuse if matches history
            let nextVersionLabel;
            const matchingVersion = await equipoService.findMatchingVersion(id, data);

            if (matchingVersion) {
                nextVersionLabel = matchingVersion;
            } else {
                const currentVersionNum = (current.version && current.version.startsWith('v')) ? parseInt(current.version.substring(1)) : 1;
                nextVersionLabel = `v${currentVersionNum + 1}`;
            }

            requestMain.input('version', sql.VarChar(10), nextVersionLabel);

            const queryUpdate = `
                UPDATE mae_equipo 
                SET codigo = @codigo,
                    nombre = @nombre,
                    tipoequipo = @tipoequipo,
                    sede = @sede,
                    fecha_vigencia = @fecha_vigencia,
                    id_muestreador = @id_muestreador,
                    habilitado = @habilitado,
                    sigla = @sigla,
                    correlativo = @correlativo,
                    tienefc = @tienefc,
                    error0 = @error0,
                    error15 = @error15,
                    error30 = @error30,
                    equipo_asociado = @equipo_asociado,
                    observacion = @observacion,
                    visible_muestreador = @visible_muestreador,
                    que_mide = @que_mide,
                    unidad_medida_textual = @unidad_medida_textual,
                    unidad_medida_sigla = @unidad_medida_sigla,
                    informe = @informe,
                    version = @version
                WHERE id_equipo = @id
            `;
            await requestMain.query(queryUpdate);
            await transaction.commit();
            return { id, ...data, version: nextVersionLabel };
        } catch (error) {
            await transaction.rollback();
            logger.error('Error in updateEquipo service:', error);
            throw error;
        }
    },

    getEquipoHistorial: async (id) => {
        try {
            const pool = await getConnection();
            const request = pool.request();
            request.input('id', sql.Numeric(10, 0), id);

            const query = `
                SELECT TOP 7
                    h.id_historial,
                    h.id_equipo,
                    h.nombre,
                    h.tipoequipo as tipo,
                    h.sede as ubicacion,
                    FORMAT(h.fecha_vigencia, 'dd/MM/yyyy') as vigencia,
                    h.id_muestreador,
                    CASE WHEN h.habilitado = 'S' THEN 'Activo' ELSE 'Inactivo' END as estado,
                    h.sigla,
                    h.correlativo,
                    h.tienefc as tiene_fc,
                    h.error0,
                    h.error15,
                    h.error30,
                    h.equipo_asociado as equipo_asociado,
                    h.observacion,
                    h.visible_muestreador,
                    h.que_mide,
                    h.unidad_medida_textual,
                    h.unidad_medida_sigla,
                    h.informe,
                    h.fecha_cambio,
                    h.version,
                    u.usuario as nombre_usuario_cambio
                FROM mae_equipo_historial h
                LEFT JOIN mae_usuario u ON h.usuario_cambio = u.id_usuario
                WHERE h.id_equipo = @id
                ORDER BY h.fecha_cambio DESC
            `;

            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getEquipoHistorial service:', error);
            throw error;
        }
    },

    deleteEquipo: async (id, userId = null) => {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Get current equipment data to populate history
            const requestGet = new sql.Request(transaction);
            requestGet.input('id', sql.Int, id);
            const currentRes = await requestGet.query('SELECT * FROM mae_equipo WHERE id_equipo = @id');
            const current = currentRes.recordset[0];

            if (!current) {
                throw new Error('Equipo no encontrado');
            }

            // 2. Update Main Table to 'N' (Habilitado)
            await new sql.Request(transaction)
                .input('id', sql.Int, id)
                .query("UPDATE mae_equipo SET habilitado = 'N' WHERE id_equipo = @id");

            // 3. Insert into History (New Snapshot with current version)
            const requestHist = new sql.Request(transaction);
            requestHist.input('id_equipo', sql.Numeric(10, 0), Number(id));
            requestHist.input('usuario_cambio', sql.Numeric(10, 0), userId);
            requestHist.input('version', sql.VarChar(10), current.version || 'v1');

            requestHist.input('codigo', sql.VarChar, current.codigo);
            requestHist.input('nombre', sql.VarChar, current.nombre);
            requestHist.input('tipoequipo', sql.VarChar, current.tipoequipo);
            requestHist.input('sede', sql.VarChar, current.sede);
            requestHist.input('fecha_vigencia', sql.Date, current.fecha_vigencia);
            requestHist.input('id_muestreador', sql.Numeric(10, 0), current.id_muestreador);
            requestHist.input('habilitado', sql.VarChar(1), 'N');
            requestHist.input('sigla', sql.VarChar(10), current.sigla);
            requestHist.input('correlativo', sql.Numeric(10, 0), current.correlativo);
            requestHist.input('tienefc', sql.VarChar(1), current.tienefc);
            requestHist.input('error0', sql.Numeric(10, 1), current.error0);
            requestHist.input('error15', sql.Numeric(10, 1), current.error15);
            requestHist.input('error30', sql.Numeric(10, 1), current.error30);
            requestHist.input('equipo_asociado', sql.VarChar(20), current.equipo_asociado);
            requestHist.input('observacion', sql.VarChar, current.observacion);
            requestHist.input('visible_muestreador', sql.VarChar(1), current.visible_muestreador);
            requestHist.input('que_mide', sql.VarChar, current.que_mide);
            requestHist.input('unidad_medida_textual', sql.VarChar, current.unidad_medida_textual);
            requestHist.input('unidad_medida_sigla', sql.VarChar, current.unidad_medida_sigla);
            requestHist.input('informe', sql.VarChar(1), current.informe);

            const queryHist = `
                INSERT INTO mae_equipo_historial (
                    id_equipo, codigo, nombre, tipoequipo, sede, fecha_vigencia, id_muestreador, habilitado,
                    sigla, correlativo, tienefc, error0, error15, error30, equipo_asociado,
                    observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla, informe, usuario_cambio, version
                ) VALUES (
                    @id_equipo, @codigo, @nombre, @tipoequipo, @sede, @fecha_vigencia, @id_muestreador, @habilitado,
                    @sigla, @correlativo, @tienefc, @error0, @error15, @error30, @equipo_asociado,
                    @observacion, @visible_muestreador, @que_mide, @unidad_medida_textual, @unidad_medida_sigla, @informe, @usuario_cambio, @version
                );
            `;
            await requestHist.query(queryHist);

            await transaction.commit();
            return { success: true };
        } catch (error) {
            await transaction.rollback();
            logger.error('Error in deleteEquipo (soft delete) service:', error);
            throw error;
        }
    },

    restoreEquipoVersion: async (id, idHistorial, userId = null) => {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Fetch CURRENT state from main table (to move to history)
            const currentReq = new sql.Request(transaction);
            currentReq.input('id', sql.Int, id);
            const currentRes = await currentReq.query('SELECT * FROM mae_equipo WHERE id_equipo = @id');
            const current = currentRes.recordset[0];
            if (!current) throw new Error('Equipo no encontrado');

            // 2. Fetch TARGET snapshot from history table
            const targetReq = new sql.Request(transaction);
            targetReq.input('idHistId', sql.Numeric(10, 0), idHistorial);
            const targetRes = await targetReq.query('SELECT * FROM mae_equipo_historial WHERE id_historial = @idHistId');
            const target = targetRes.recordset[0];
            if (!target) throw new Error('Versión histórica no encontrada');

            // 3. Determine next version label (In restore, it matches the history version directly)
            const nextVersionLabel = target.version || 'v1';

            // 4. Snapshot CURRENT into history (Upsert/Bubble up)
            const checkHistReq = new sql.Request(transaction);
            checkHistReq.input('id_equipo', sql.Numeric(10, 0), Number(id));
            checkHistReq.input('version', sql.VarChar(10), current.version || 'v1');
            const checkHistRes = await checkHistReq.query('SELECT id_historial FROM mae_equipo_historial WHERE id_equipo = @id_equipo AND version = @version');

            if (checkHistRes.recordset.length > 0) {
                // UPDATE existing history entry's timestamp (Bubble up)
                const updHistReq = new sql.Request(transaction);
                updHistReq.input('id_h', sql.Numeric(10, 0), checkHistRes.recordset[0].id_historial);
                await updHistReq.query('UPDATE mae_equipo_historial SET fecha_cambio = GETDATE() WHERE id_historial = @id_h');
            } else {
                // INSERT new history entry
                const snapReq = new sql.Request(transaction);
                snapReq.input('id_equipo', sql.Numeric(10, 0), Number(id));
                snapReq.input('usuario_cambio', sql.Numeric(10, 0), userId);
                snapReq.input('version', sql.VarChar(10), current.version || 'v1');

                // Bind current values
                snapReq.input('codigo', sql.VarChar, current.codigo);
                snapReq.input('nombre', sql.VarChar, current.nombre);
                snapReq.input('tipoequipo', sql.VarChar, current.tipoequipo);
                snapReq.input('sede', sql.VarChar, current.sede);
                snapReq.input('fecha_vigencia', sql.Date, current.fecha_vigencia);
                snapReq.input('id_muestreador', sql.Numeric(10, 0), current.id_muestreador || 0);
                snapReq.input('habilitado', sql.VarChar(1), current.habilitado || 'S');
                snapReq.input('sigla', sql.VarChar(10), current.sigla || '');
                snapReq.input('correlativo', sql.Numeric(10, 0), current.correlativo || 0);
                snapReq.input('tienefc', sql.VarChar(1), current.tienefc || 'N');
                snapReq.input('error0', sql.Numeric(10, 1), current.error0 || 0);
                snapReq.input('error15', sql.Numeric(10, 1), current.error15 || 0);
                snapReq.input('error30', sql.Numeric(10, 1), current.error30 || 0);
                snapReq.input('equipo_asociado', sql.VarChar(20), current.equipo_asociado || '0');
                snapReq.input('observacion', sql.VarChar, current.observacion || '');
                snapReq.input('visible_muestreador', sql.VarChar(1), current.visible_muestreador || 'N');
                snapReq.input('que_mide', sql.VarChar, current.que_mide || '');
                snapReq.input('unidad_medida_textual', sql.VarChar, current.unidad_medida_textual || '');
                snapReq.input('unidad_medida_sigla', sql.VarChar, current.unidad_medida_sigla || '');
                snapReq.input('informe', sql.VarChar(1), current.informe || 'N');

                await snapReq.query(`
                    INSERT INTO mae_equipo_historial (
                        id_equipo, codigo, nombre, tipoequipo, sede, fecha_vigencia, id_muestreador, habilitado,
                        sigla, correlativo, tienefc, error0, error15, error30, equipo_asociado,
                        observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla, informe, 
                        usuario_cambio, version, fecha_cambio
                    ) VALUES (
                        @id_equipo, @codigo, @nombre, @tipoequipo, @sede, @fecha_vigencia, @id_muestreador, @habilitado,
                        @sigla, @correlativo, @tienefc, @error0, @error15, @error30, @equipo_asociado,
                        @observacion, @visible_muestreador, @que_mide, @unidad_medida_textual, @unidad_medida_sigla, @informe, 
                        @usuario_cambio, @version, GETDATE()
                    )
                `);
            }

            // 5. Update main table with HISTORICAL data and NEW version label
            const updReq = new sql.Request(transaction);
            updReq.input('id', sql.Int, id);
            updReq.input('codigo', sql.VarChar, target.codigo);
            updReq.input('nombre', sql.VarChar, target.nombre);
            updReq.input('tipoequipo', sql.VarChar, target.tipoequipo);
            updReq.input('sede', sql.VarChar, target.sede);
            updReq.input('fecha_vigencia', sql.Date, target.fecha_vigencia);
            updReq.input('id_muestreador', sql.Numeric(10, 0), target.id_muestreador || 0);
            updReq.input('habilitado', sql.VarChar(1), target.habilitado || 'S');
            updReq.input('sigla', sql.VarChar(10), target.sigla || '');
            updReq.input('correlativo', sql.Numeric(10, 0), target.correlativo || 0);
            updReq.input('tienefc', sql.VarChar(1), target.tienefc || 'N');
            updReq.input('error0', sql.Numeric(10, 1), target.error0 || 0);
            updReq.input('error15', sql.Numeric(10, 1), target.error15 || 0);
            updReq.input('error30', sql.Numeric(10, 1), target.error30 || 0);
            updReq.input('equipo_asociado', sql.VarChar(20), target.equipo_asociado || '0');
            updReq.input('observacion', sql.VarChar, target.observacion || '');
            updReq.input('visible_muestreador', sql.VarChar(1), target.visible_muestreador || 'N');
            updReq.input('que_mide', sql.VarChar, target.que_mide || '');
            updReq.input('unidad_medida_textual', sql.VarChar, target.unidad_medida_textual || '');
            updReq.input('unidad_medida_sigla', sql.VarChar, target.unidad_medida_sigla || '');
            updReq.input('informe', sql.VarChar(1), target.informe || 'N');
            updReq.input('version', sql.VarChar(10), nextVersionLabel);

            await updReq.query(`
                UPDATE mae_equipo 
                SET codigo=@codigo, nombre=@nombre, tipoequipo=@tipoequipo, sede=@sede, 
                    fecha_vigencia=@fecha_vigencia, id_muestreador=@id_muestreador, habilitado=@habilitado,
                    sigla=@sigla, correlativo=@correlativo, tienefc=@tienefc, error0=@error0, 
                    error15=@error15, error30=@error30, equipo_asociado=@equipo_asociado,
                    observacion=@observacion, visible_muestreador=@visible_muestreador, 
                    que_mide=@que_mide, unidad_medida_textual=@unidad_medida_textual, 
                    unidad_medida_sigla=@unidad_medida_sigla, informe=@informe, version=@version
                WHERE id_equipo = @id
            `);

            // 6. DELETE the target version from history (as it is now active)
            const delHistReq = new sql.Request(transaction);
            delHistReq.input('id_h', sql.Numeric(10, 0), idHistorial);
            await delHistReq.query('DELETE FROM mae_equipo_historial WHERE id_historial = @id_h');

            await transaction.commit();
            return { success: true, newVersion: nextVersionLabel };
        } catch (error) {
            await transaction.rollback();
            logger.error('Error in restoreEquipoVersion service:', error);
            throw error;
        }
    }
};

export default equipoService;
