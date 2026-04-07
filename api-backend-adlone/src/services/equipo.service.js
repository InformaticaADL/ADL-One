import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';
import ExcelJS from 'exceljs';

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
     * Get unique names and metadata from the master catalog
     */
    getEquipoCatalogo: async () => {
        try {
            const pool = await getConnection();
            const result = await pool.request().query('SELECT * FROM mae_equipo_catalogo ORDER BY nombre');
            return result.recordset;
        } catch (error) {
            logger.error('Error in getEquipoCatalogo service:', error);
            throw error;
        }
    },

    /**
     * Create a new catalog item
     */
    createEquipoCatalogo: async (data) => {
        try {
            const pool = await getConnection();
            const { nombre, que_mide, unidad_medida_textual, unidad_medida_sigla, tipo_equipo } = data;
            
            await pool.request()
                .input('nombre', sql.NVARCHAR, nombre)
                .input('que_mide', sql.NVARCHAR, que_mide)
                .input('unidad_medida_textual', sql.NVARCHAR, unidad_medida_textual)
                .input('unidad_medida_sigla', sql.NVARCHAR, unidad_medida_sigla)
                .input('tipo_equipo', sql.NVARCHAR, tipo_equipo)
                .query(`
                    INSERT INTO mae_equipo_catalogo (nombre, que_mide, unidad_medida_textual, unidad_medida_sigla, tipo_equipo)
                    VALUES (@nombre, @que_mide, @unidad_medida_textual, @unidad_medida_sigla, @tipo_equipo)
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error in createEquipoCatalogo service:', error);
            throw error;
        }
    },

    /**
     * Update a catalog item
     */
    updateEquipoCatalogo: async (id, data) => {
        try {
            const pool = await getConnection();
            const { nombre, que_mide, unidad_medida_textual, unidad_medida_sigla, tipo_equipo } = data;
            
            await pool.request()
                .input('id', sql.INT, id)
                .input('nombre', sql.NVARCHAR, nombre)
                .input('que_mide', sql.NVARCHAR, que_mide)
                .input('unidad_medida_textual', sql.NVARCHAR, unidad_medida_textual)
                .input('unidad_medida_sigla', sql.NVARCHAR, unidad_medida_sigla)
                .input('tipo_equipo', sql.NVARCHAR, tipo_equipo)
                .query(`
                    UPDATE mae_equipo_catalogo
                    SET nombre = @nombre,
                        que_mide = @que_mide,
                        unidad_medida_textual = @unidad_medida_textual,
                        unidad_medida_sigla = @unidad_medida_sigla,
                        tipo_equipo = @tipo_equipo
                    WHERE id_equipocatalogo = @id
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error in updateEquipoCatalogo service:', error);
            throw error;
        }
    },

    /**
     * Delete a catalog item
     */
    deleteEquipoCatalogo: async (id) => {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('id', sql.INT, id)
                .query('DELETE FROM mae_equipo_catalogo WHERE id_equipocatalogo = @id');
            return { success: true };
        } catch (error) {
            logger.error('Error in deleteEquipoCatalogo service:', error);
            throw error;
        }
    },

    /**
     * Get list of equipment with filters and pagination
     */
    getEquipos: async (params = {}) => {
        try {
            const { search, tipo, sede, estado, fechaDesde, fechaHasta, id_muestreador, page = 1, limit = 10 } = params;
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

            if (id_muestreador && id_muestreador !== 'Todos') {
                request.input('id_muestreador', sql.Int, Number(id_muestreador));
                whereClause += ` AND e.id_muestreador = @id_muestreador`;
            }

            if (fechaDesde) {
                request.input('fechaDesde', sql.Date, new Date(fechaDesde));
                whereClause += ` AND CAST(e.fecha_vigencia AS DATE) >= @fechaDesde`;
            }

            if (fechaHasta) {
                request.input('fechaHasta', sql.Date, new Date(fechaHasta));
                whereClause += ` AND CAST(e.fecha_vigencia AS DATE) <= @fechaHasta`;
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
                    e.informe,
                    e.version
                FROM mae_equipo e
                LEFT JOIN mae_muestreador m ON e.id_muestreador = m.id_muestreador
                ${whereClause}
                ORDER BY e.id_equipo ASC 
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `;

            const result = await request.query(query);

            // 3. Get unique types and states based on current OTHER filters
            const getCatalogs = async (currentSede) => {
                let typesQuery = 'SELECT DISTINCT tipo_equipo as tipo FROM mae_equipo_catalogo WHERE tipo_equipo IS NOT NULL';
                let statesQuery = 'SELECT DISTINCT CASE WHEN habilitado = \'S\' THEN \'Activo\' ELSE \'Inactivo\' END as estado FROM mae_equipo WHERE 1=1';
                let sedesQuery = 'SELECT DISTINCT sede FROM mae_equipo WHERE sede IS NOT NULL AND LEN(TRIM(sede)) > 0';
                
                // NAMES and METADATA now come from mae_equipo_catalogo
                let namesQuery = 'SELECT * FROM mae_equipo_catalogo ORDER BY nombre';
                
                let queMideQuery = `
                    SELECT DISTINCT que_mide FROM mae_equipo WHERE que_mide IS NOT NULL AND LEN(TRIM(que_mide)) > 0
                    UNION
                    SELECT DISTINCT que_mide FROM mae_equipo_catalogo WHERE que_mide IS NOT NULL AND LEN(TRIM(que_mide)) > 0
                `;
                let unidadesQuery = `
                    SELECT DISTINCT unidad_medida_textual as unidad FROM mae_equipo WHERE unidad_medida_textual IS NOT NULL AND LEN(TRIM(unidad_medida_textual)) > 0
                    UNION
                    SELECT DISTINCT unidad_medida_textual as unidad FROM mae_equipo_catalogo WHERE unidad_medida_textual IS NOT NULL AND LEN(TRIM(unidad_medida_textual)) > 0
                `;

                if (currentSede && currentSede !== 'Todos') {
                    typesQuery += ` AND sede = '${currentSede}'`;
                    statesQuery += ` AND sede = '${currentSede}'`;
                    queMideQuery += ` AND sede = '${currentSede}'`;
                    unidadesQuery += ` AND sede = '${currentSede}'`;
                }

                const [tRes, sRes, lRes, nRes, qRes, uRes] = await Promise.all([
                    pool.request().query(typesQuery),
                    pool.request().query(statesQuery),
                    pool.request().query(sedesQuery),
                    pool.request().query(namesQuery),
                    pool.request().query(queMideQuery),
                    pool.request().query(unidadesQuery)
                ]);
                return {
                    tipos: tRes.recordset.map(r => r.tipo).sort(),
                    estados: sRes.recordset.map(r => r.estado).sort(),
                    sedes: lRes.recordset.map(r => r.sede).sort(),
                    nombres: nRes.recordset, // Return full objects for frontend metadata extraction
                    que_mide: qRes.recordset.map(r => r.que_mide).sort(),
                    unidades: uRes.recordset.map(r => r.unidad).sort()
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

            // 2. Find the previous equipment for this sigla to get its correlativo and code
            const corrRequest = pool.request();
            corrRequest.input('sigla', sql.VarChar, sigla);
            const corrQuery = `
                SELECT TOP 1 
                    correlativo as lastCorrelativo, 
                    codigo as previousCode, 
                    CASE WHEN habilitado = 'S' THEN 'Activo' ELSE 'Inactivo' END as previousStatus
                FROM mae_equipo 
                WHERE sigla = @sigla
                ORDER BY correlativo DESC
            `;
            const corrResult = await corrRequest.query(corrQuery);

            let lastCorrelativo = 0;
            let previousCode = null;
            let previousStatus = null;

            if (corrResult.recordset.length > 0) {
                lastCorrelativo = Number(corrResult.recordset[0].lastCorrelativo) || 0;
                previousCode = corrResult.recordset[0].previousCode;
                previousStatus = corrResult.recordset[0].previousStatus;
            }

            const nextCorr = lastCorrelativo + 1;

            // 3. Format code: [Sigla].[Correlativo]/MA.[Ubicacion]
            const formattedCorr = nextCorr < 10 ? `0${nextCorr} ` : `${nextCorr} `;
            const suggestedCode = `${sigla}.${formattedCorr}/MA.${ubicacion}`;

            return {
                sigla,
                correlativo: nextCorr,
                suggestedCode,
                previousCode,
                previousStatus
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
        // Validate Vigencia
        if (data.vigencia) {
            const vigenciaDate = new Date(data.vigencia);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (vigenciaDate < today) {
                const vigenciaStr = vigenciaDate.toISOString().split('T')[0];
                const todayStr = today.toISOString().split('T')[0];
                if (vigenciaStr < todayStr) { // Double check with strings to avoid timezone issues
                    throw new Error('La fecha de vigencia no puede ser anterior a la fecha actual.');
                }
            }
        }
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            // 1. Generate new ID manually (Pattern from ficha.service.js)
            const idResult = await transaction.request()
                .query('SELECT ISNULL(MAX(id_equipo), 0) + 1 as NewId FROM mae_equipo');
            const newId = idResult.recordset[0].NewId;

            const request = new sql.Request(transaction);

            // Bind all inputs
            request.input('id_equipo', sql.Numeric(10, 0), newId);
            request.input('codigo', sql.VarChar, data.codigo);
            request.input('nombre', sql.VarChar, data.nombre);
            request.input('tipoequipo', sql.VarChar, data.tipo);
            request.input('sede', sql.VarChar, data.ubicacion);
            request.input('fecha_vigencia', sql.Date, parseSqlDate(data.vigencia));
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
                    id_equipo, codigo, nombre, tipoequipo, sede, fecha_vigencia, id_muestreador, habilitado,
                    sigla, correlativo, tienefc, error0, error15, error30, equipo_asociado,
                    observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla, informe, version
                ) VALUES (
                    @id_equipo, @codigo, @nombre, @tipoequipo, @sede, @fecha_vigencia, @id_muestreador, @habilitado,
                    @sigla, @correlativo, @tienefc, @error0, @error15, @error30, @equipo_asociado,
                    @observacion, @visible_muestreador, @que_mide, @unidad_medida_textual, @unidad_medida_sigla, @informe, 'v1'
                );
            `;

            await request.query(queryMain);

            await transaction.commit();
            return { id: newId, ...data };
        } catch (error) {
            await transaction.rollback();
            logger.error('Error in createEquipo service:', error);
            throw error;
        }
    },

    createEquiposBulk: async (equiposData, userId = null) => {
        if (!Array.isArray(equiposData) || equiposData.length === 0) {
            throw new Error('No hay equipos para crear');
        }

        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();
            
            // 1. Get initial ID
            const idResult = await transaction.request()
                .query('SELECT ISNULL(MAX(id_equipo), 0) as MaxId FROM mae_equipo');
            let currentId = Number(idResult.recordset[0].MaxId);

            const results = [];

            for (const data of equiposData) {
                currentId++;
                const request = new sql.Request(transaction);

                // Bind all inputs
                request.input('id_equipo', sql.Numeric(10, 0), currentId);
                request.input('codigo', sql.VarChar, data.codigo);
                request.input('nombre', sql.VarChar, data.nombre);
                request.input('tipoequipo', sql.VarChar, data.tipo);
                request.input('sede', sql.VarChar, data.ubicacion);
                request.input('fecha_vigencia', sql.Date, parseSqlDate(data.vigencia));
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
                        id_equipo, codigo, nombre, tipoequipo, sede, fecha_vigencia, id_muestreador, habilitado,
                        sigla, correlativo, tienefc, error0, error15, error30, equipo_asociado,
                        observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla, informe, version
                    ) VALUES (
                        @id_equipo, @codigo, @nombre, @tipoequipo, @sede, @fecha_vigencia, @id_muestreador, @habilitado,
                        @sigla, @correlativo, @tienefc, @error0, @error15, @error30, @equipo_asociado,
                        @observacion, @visible_muestreador, @que_mide, @unidad_medida_textual, @unidad_medida_sigla, @informe, 'v1'
                    );
                `;

                await request.query(queryMain);
                results.push({ id: currentId, ...data });
            }

            await transaction.commit();
            return results;
        } catch (error) {
            await transaction.rollback();
            logger.error('Error in createEquiposBulk service:', error);
            throw error;
        }
    },

    updateEquipo: async (id, data, userId = null) => {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Fetch CURRENT state (to move to history and check date)
            const currentRequest = new sql.Request(transaction);
            currentRequest.input('id', sql.Int, id);
            const currentResult = await currentRequest.query('SELECT * FROM mae_equipo WHERE id_equipo = @id');
            const current = currentResult.recordset[0];

            if (!current) throw new Error('Equipo no encontrado');

            // --- REFINED DATE VALIDATION ---
            // Only validate if a NEW date is provided and it's different from the current one
            if (data.vigencia) {
                const incomingDate = parseSqlDate(data.vigencia);
                const currentVigDate = current.fecha_vigencia ? new Date(current.fecha_vigencia) : null;

                const toYMD = (d) => {
                    if (!d || isNaN(d.getTime())) return null;
                    const year = d.getUTCFullYear();
                    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(d.getUTCDate()).padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                const vigStr = toYMD(incomingDate);
                const currentVigStr = toYMD(currentVigDate);

                console.log('DEBUG updateEquipo Date Validation:', {
                    vigenciaInput: data.vigencia,
                    incomingDate: incomingDate?.toISOString(),
                    currentVigDate: currentVigDate?.toISOString(),
                    vigStr,
                    currentVigStr,
                    hasChanged: vigStr !== currentVigStr
                });

                // Only throw error if the user is TRYING to set a NEW date that is in the past
                if (vigStr && vigStr !== currentVigStr) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const todayStr = toYMD(today);

                    if (vigStr < todayStr) {
                        throw new Error('La fecha de vigencia no puede ser anterior a la fecha actual.');
                    }
                }
            }
            // -------------------------------

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
    },

    // --- AUTOMATED TASKS ---
    inactivateExpiredEquipos: async () => {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        try {
            await transaction.begin();

            // 1. Find Expired & Active Equipment
            // Use CAST(GETDATE() AS DATE) to ignore time part, so if expires at 00:00 today, it is expired today?
            // Actually, usually expiry means "up to and including". So if vigencia is TODAY, it is still valid. 
            // It expires tomorrow. So find where vigencia < TODAY.
            const findReq = new sql.Request(transaction);
            const findQuery = `
                SELECT id_equipo, nombre, codigo 
                FROM mae_equipo 
                WHERE habilitado = 'S' 
                AND fecha_vigencia < CAST(GETDATE() AS DATE)
            `;
            const findRes = await findReq.query(findQuery);
            const expiredEquipos = findRes.recordset;

            if (expiredEquipos.length === 0) {
                await transaction.commit();
                return { processed: 0, message: 'No expired equipment found.' };
            }

            logger.info(`Found ${expiredEquipos.length} expired equipment to inactivate.`);

            for (const eq of expiredEquipos) {
                // A. Fetch current for history
                const curReq = new sql.Request(transaction);
                curReq.input('id', sql.Int, eq.id_equipo);
                const curRes = await curReq.query('SELECT * FROM mae_equipo WHERE id_equipo = @id');
                const current = curRes.recordset[0];

                if (!current) continue;

                // B. Update to Inactive
                const updReq = new sql.Request(transaction);
                updReq.input('id', sql.Int, eq.id_equipo);
                await updReq.query("UPDATE mae_equipo SET habilitado = 'N' WHERE id_equipo = @id");

                // C. Insert into History
                const histReq = new sql.Request(transaction);
                histReq.input('id_equipo', sql.Numeric(10, 0), Number(eq.id_equipo));
                histReq.input('usuario_cambio', sql.Numeric(10, 0), 0); // 0 for System
                histReq.input('version', sql.VarChar(10), current.version || 'v1');

                // Bind all
                histReq.input('codigo', sql.VarChar, current.codigo);
                histReq.input('nombre', sql.VarChar, current.nombre);
                histReq.input('tipoequipo', sql.VarChar, current.tipoequipo);
                histReq.input('sede', sql.VarChar, current.sede);
                histReq.input('fecha_vigencia', sql.Date, current.fecha_vigencia);
                histReq.input('id_muestreador', sql.Numeric(10, 0), current.id_muestreador || 0);
                histReq.input('habilitado', sql.VarChar(1), 'N'); // New state
                histReq.input('sigla', sql.VarChar(10), current.sigla || '');
                histReq.input('correlativo', sql.Numeric(10, 0), current.correlativo || 0);
                histReq.input('tienefc', sql.VarChar(1), current.tienefc || 'N');
                histReq.input('error0', sql.Numeric(10, 1), current.error0 || 0);
                histReq.input('error15', sql.Numeric(10, 1), current.error15 || 0);
                histReq.input('error30', sql.Numeric(10, 1), current.error30 || 0);
                histReq.input('equipo_asociado', sql.VarChar(20), current.equipo_asociado || '0');
                histReq.input('observacion', sql.VarChar, `[SISTEMA] Inactivación automática por vencimiento. Obs anterior: ${current.observacion || ''}`.substring(0, 500));
                histReq.input('visible_muestreador', sql.VarChar(1), current.visible_muestreador || 'N');
                histReq.input('que_mide', sql.VarChar, current.que_mide || '');
                histReq.input('unidad_medida_textual', sql.VarChar, current.unidad_medida_textual || '');
                histReq.input('unidad_medida_sigla', sql.VarChar, current.unidad_medida_sigla || '');
                histReq.input('informe', sql.VarChar(1), current.informe || 'N');

                await histReq.query(`
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
                `);
            }

            await transaction.commit();
            return { processed: expiredEquipos.length, message: 'Process completed successfully.' };

        } catch (error) {
            await transaction.rollback();
            logger.error('Error in inactivateExpiredEquipos service:', error);
            throw error;
        }
    },

    /**
     * Export equipment data to Excel with native charts
     */
    exportEquiposExcel: async (params = {}) => {
        try {
            const { search, tipo, sede, estado, id_muestreador, fechaDesde, fechaHasta } = params;
            const pool = await getConnection();
            const request = pool.request();

            // 1. Build where clause (Same as getEquipos but without pagination)
            let whereClause = ' WHERE 1=1';
            if (search) {
                request.input('search', sql.VarChar, `%${search}%`);
                whereClause += ` AND (e.codigo LIKE @search OR e.nombre LIKE @search OR e.tipoequipo LIKE @search OR e.sede LIKE @search)`;
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
                request.input('habilitado', sql.VarChar, estado === 'Activo' ? 'S' : 'N');
                whereClause += ` AND e.habilitado = @habilitado`;
            }
            if (id_muestreador && id_muestreador !== 'Todos') {
                request.input('id_muestreador', sql.Int, Number(id_muestreador));
                whereClause += ` AND e.id_muestreador = @id_muestreador`;
            }

            const queryDetail = `
                SELECT 
                    e.id_equipo, e.codigo, e.nombre, e.tipoequipo as tipo, e.sede as ubicacion,
                    FORMAT(e.fecha_vigencia, 'dd/MM/yyyy') as vigencia,
                    CASE WHEN e.habilitado = 'S' THEN 'Activo' ELSE 'Inactivo' END as estado,
                    m.nombre_muestreador as nombre_asignado, e.sigla, e.correlativo,
                    e.tienefc as tiene_fc, e.error0, e.error15, e.error30, e.equipo_asociado,
                    e.observacion, e.visible_muestreador, e.que_mide, e.unidad_medida_textual,
                    e.unidad_medida_sigla, e.informe, e.version
                FROM mae_equipo e
                LEFT JOIN mae_muestreador m ON e.id_muestreador = m.id_muestreador
                ${whereClause}
                ORDER BY e.id_equipo ASC
            `;
            const result = await request.query(queryDetail);
            const data = result.recordset;

            // 2. Aggregate data for "Reportes" sheet
            const stats = {
                estado: { 'Activo': 0, 'Inactivo': 0 },
                tipo: {},
                ubicacion: {},
                responsable: {}
            };

            data.forEach(item => {
                // Estado
                stats.estado[item.estado]++;
                
                // Tipo
                const t = item.tipo || 'Sin Tipo';
                stats.tipo[t] = (stats.tipo[t] || 0) + 1;
                
                // Ubicación
                const u = item.ubicacion || 'Sin Ubicación';
                stats.ubicacion[u] = (stats.ubicacion[u] || 0) + 1;
                
                // Responsable (Muestreador)
                const r = item.nombre_asignado || 'Sin Asignar';
                stats.responsable[r] = (stats.responsable[r] || 0) + 1;
            });

            // 3. Generate Excel with ExcelJS
            const workbook = new ExcelJS.Workbook();
            
            // --- SHEET 1: EQUIPOS (First) ---
            const wsData = workbook.addWorksheet('Equipos');
            wsData.columns = [
                { header: 'ID', key: 'id_equipo', width: 10 },
                { header: 'CÓDIGO', key: 'codigo', width: 15 },
                { header: 'NOMBRE', key: 'nombre', width: 30 },
                { header: 'ESTADO', key: 'estado', width: 12 },
                { header: 'TIPO', key: 'tipo', width: 20 },
                { header: 'UBICACIÓN', key: 'ubicacion', width: 25 },
                { header: 'VIGENCIA', key: 'vigencia', width: 15 },
                { header: 'ASIGNADO A', key: 'nombre_asignado', width: 25 },
                { header: 'SIGLA', key: 'sigla', width: 10 },
                { header: 'CORRELATIVO', key: 'correlativo', width: 10 },
                { header: 'TIENE FC', key: 'tiene_fc', width: 10 },
                { header: 'ERROR 0', key: 'error0', width: 10 },
                { header: 'ERROR 15', key: 'error15', width: 10 },
                { header: 'ERROR 30', key: 'error30', width: 10 },
                { header: 'EQUIPO ASOCIADO', key: 'equipo_asociado', width: 20 },
                { header: 'QUE MIDE', key: 'que_mide', width: 20 },
                { header: 'UNIDAD TEXTUAL', key: 'unidad_medida_textual', width: 15 },
                { header: 'UNIDAD SIGLA', key: 'unidad_medida_sigla', width: 10 },
                { header: 'INFORME', key: 'informe', width: 15 },
                { header: 'VERSIÓN', key: 'version', width: 10 },
                { header: 'VISIBLE MUEST.', key: 'visible_muestreador', width: 12 },
                { header: 'OBSERVACIÓN', key: 'observacion', width: 40 }
            ];
            
            data.forEach((row, index) => {
                const newRow = wsData.addRow(row);
                // Alternating row colors (Light blue-ish / White)
                if (index % 2 !== 0) {
                    newRow.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF1F5F9' } // Slate 100
                    };
                }
            });
            
            // Format header
            wsData.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            wsData.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
            wsData.autoFilter = 'A1:V1';

            // --- SHEET 2: REPORTES ---
            const wsReports = workbook.addWorksheet('Reportes');
            
            // Function to add a summary table
            const addSummaryTable = (ws, title, dataObj, startRow) => {
                ws.getCell(`A${startRow}`).value = title;
                ws.getCell(`A${startRow}`).font = { bold: true, size: 12 };
                
                const headerRow = startRow + 1;
                ws.getCell(`A${headerRow}`).value = 'Categoría';
                ws.getCell(`B${headerRow}`).value = 'Cantidad';
                ws.getRow(headerRow).font = { bold: true };
                ws.getRow(headerRow).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
                
                let currentRow = headerRow + 1;
                Object.entries(dataObj).forEach(([key, val]) => {
                    ws.getCell(`A${currentRow}`).value = key;
                    ws.getCell(`B${currentRow}`).value = val;
                    currentRow++;
                });
                
                // Add a border / format as table
                ws.addTable({
                    name: title.replace(/\s+/g, '_') + '_' + Math.floor(Math.random() * 1000), // Randomize name to avoid conflicts if same title used
                    ref: `A${headerRow}`,
                    headerRow: true,
                    totalsRow: true,
                    style: { theme: 'TableStyleMedium2', showRowStripes: true },
                    columns: [{ name: 'Categoría' }, { name: 'Cantidad', totalsRowFunction: 'sum' }],
                    rows: Object.entries(dataObj)
                });

                return currentRow + 2; // Next start row
            };

            let nextRow = 1;
            nextRow = addSummaryTable(wsReports, 'Resumen por Estado', stats.estado, nextRow);
            nextRow = addSummaryTable(wsReports, 'Resumen por Tipo', stats.tipo, nextRow);
            nextRow = addSummaryTable(wsReports, 'Resumen por Ubicación', stats.ubicacion, nextRow);
            nextRow = addSummaryTable(wsReports, 'Resumen por Responsable', stats.responsable, nextRow);

            wsReports.getColumn(1).width = 40;
            wsReports.getColumn(2).width = 15;

            return await workbook.xlsx.writeBuffer();
        } catch (error) {
            logger.error('Error in exportEquiposExcel service:', error);
            throw error;
        }
    },

    /**
     * Executes equipment reassignment logic (used by URS and directly by Admin)
     */
    executeEquipmentReassignment: async (idMuestreadorOrigen, options, requestId = null) => {
        try {
            const pool = await getConnection();
            const { tipoTraspaso, baseDestino, idDestino, reasignacionManual } = options;
            
            const baseMap = {
                'Base Aysén': { id: 1023, code: 'AY' },
                'Base Puerto Montt': { id: 1024, code: 'PM' },
                'Base Villarrica': { id: 1025, code: 'VI' },
                'Sede Villarrica': { id: 1026, code: 'VI' },
                'Base Punta Arenas': { id: 0, code: 'PA' }
            };

            const reqInfo = requestId ? ` (Solicitud URS ${requestId})` : ' (Acción Directa)';

            if (tipoTraspaso === 'BASE') {
                const mappedBase = baseMap[baseDestino] || { id: 0, code: (baseDestino || '').substring(0, 2).toUpperCase() };
                await pool.request()
                    .input('id_m', sql.Numeric(10, 0), idMuestreadorOrigen)
                    .input('id_d', sql.Numeric(10, 0), mappedBase.id)
                    .input('base', sql.VarChar(2), mappedBase.code)
                    .input('obs', sql.VarChar(sql.MAX), `Traspaso a ${baseDestino} por deshabilitación de muestreador${reqInfo}.`)
                    .query(`
                        UPDATE mae_equipo 
                        SET id_muestreador = @id_d, 
                            sede = @base,
                            observacion = @obs
                        WHERE id_muestreador = @id_m
                    `);
                logger.info(`EQUIPMENT REASSIGNMENT: All equipment for ${idMuestreadorOrigen} moved to ${baseDestino}.`);
            } else if (tipoTraspaso === 'MUESTREADOR') {
                await pool.request()
                    .input('id_m', sql.Numeric(10, 0), idMuestreadorOrigen)
                    .input('id_d', sql.Numeric(10, 0), idDestino)
                    .input('obs', sql.VarChar(sql.MAX), `Traspaso a nuevo responsable (ID ${idDestino}) por deshabilitación de muestreador${reqInfo}.`)
                    .query(`
                        UPDATE mae_equipo 
                        SET id_muestreador = @id_d,
                            observacion = @obs
                        WHERE id_muestreador = @id_m
                    `);
                logger.info(`EQUIPMENT REASSIGNMENT: All equipment for ${idMuestreadorOrigen} moved to Sampler ${idDestino}.`);
            } else if (tipoTraspaso === 'MANUAL') {
                const reasignaciones = reasignacionManual || [];
                for (const re of reasignaciones) {
                    if (re.id_equipo) {
                        const sedeManual = re.sede_nueva || 'PM';
                        const mappedSede = baseMap[sedeManual] || { id: re.id_muestreador_nuevo || 0, code: (sedeManual.length > 2 ? sedeManual.substring(0, 2).toUpperCase() : sedeManual) };
                        
                        await pool.request()
                            .input('id_e', sql.Numeric(10, 0), re.id_equipo)
                            .input('id_d', sql.Numeric(10, 0), mappedSede.id)
                            .input('sede', sql.VarChar(2), mappedSede.code)
                            .input('obs', sql.VarChar(sql.MAX), `Traspaso manual por deshabilitación de muestreador${reqInfo}.`)
                            .query(`
                                UPDATE mae_equipo 
                                SET id_muestreador = @id_d,
                                    sede = @sede,
                                    observacion = @obs
                                WHERE id_equipo = @id_e
                            `);
                    }
                }
                logger.info(`EQUIPMENT REASSIGNMENT: ${reasignaciones.length} equipments reassigned manually.`);
            }
            return { success: true };
        } catch (error) {
            logger.error('Error in executeEquipmentReassignment service:', error);
            throw error;
        }
    },

    getEquipmentComparisonForResampling: async (idOriginal, idNueva, idMuestreador) => {
        try {
            const pool = await getConnection();
            const request = pool.request();
            request.input('idOriginal', sql.Numeric(10, 0), Number(idOriginal));
            request.input('idNueva', sql.Numeric(10, 0), Number(idNueva));
            request.input('idMuestreador', sql.Numeric(10, 0), Number(idMuestreador));

            // LEFT: Equipment snapshot from the original ficha (APP_MA_EQUIPOS_MUESTREOS)
            // RIGHT: Current live data from mae_equipo (master table - real current state)
            const query = `
                SELECT DISTINCT
                    e.id_equipo,
                    e.nombre,
                    e.codigo,
                    e.tienefc,
                    orig.version as version_original,
                    orig.error0 as error0_original,
                    orig.error15 as error15_original,
                    orig.error30 as error30_original,
                    e.version as version_nueva,
                    e.error0 as error0_nueva,
                    e.error15 as error15_nueva,
                    e.error30 as error30_nueva
                FROM APP_MA_EQUIPOS_MUESTREOS orig
                INNER JOIN mae_equipo e ON orig.id_equipo = e.id_equipo
                WHERE orig.id_fichaingresoservicio = @idOriginal
                AND orig.id_muestreador = @idMuestreador
                AND ISNULL(orig.estado, 'ACTIVO') = 'ACTIVO'
            `;

            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getEquipmentComparisonForResampling service:', error);
            throw error;
        }
    }
};

export default equipoService;
