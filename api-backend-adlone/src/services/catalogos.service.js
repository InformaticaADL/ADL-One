import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

// Whitelist of tables accessible via the generic maestros API
const ALLOWED_TABLES = new Set([
  'mae_empresa', 'mae_empresaservicios', 'mae_contacto', 'mae_cargo', 'mae_rol',
  'mae_usuario', 'mae_tipomuestra_ma', 'mae_subarea', 'mae_objetivomuestreo_ma',
  'mae_tipomuestreo', 'mae_tipomuestra', 'mae_actividadmuestreo', 'mae_tipodescarga',
  'mae_inspectorambiental', 'mae_muestreador', 'mae_coordinador', 'mae_centro',
  'mae_modalidad', 'mae_frecuencia', 'mae_estadomuestreo', 'mae_equipo',
  'mae_instrumentoambiental', 'mae_umedida', 'mae_lugaranalisis', 'mae_formacanal',
  'mae_dispositivohidraulico', 'mae_solicitud_tipo', 'mae_permiso',
  'mae_notificacion_regla', 'mae_evento_notificacion', 'mae_comuna', 'mae_zonautm'
]);

// Columns that must never be returned by the generic getMaestroData endpoint
const SENSITIVE_COLUMNS = {
  mae_usuario: new Set(['clave_usuario']),
  mae_muestreador: new Set(['clave_muestreador']),
};

// Validates that a column/identifier is safe to interpolate (alphanumeric + underscores)
const IDENTIFIER_RE = /^[a-z][a-z0-9_]{0,63}$/i;
function assertIdentifier(value, label) {
  if (!IDENTIFIER_RE.test(value)) throw new Error(`Invalid ${label}: ${value}`);
}
function assertTable(name) {
  if (!ALLOWED_TABLES.has(name)) throw new Error(`Table not allowed: ${name}`);
}

export const catalogosService = {
  // Bloque 1: Identificación
  getLugaresAnalisis: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('maestro_lugaranalisis');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getLugaresAnalisis service:', error);
      throw error;
    }
  },

  getEmpresasServicio: async () => {
    try {
      const pool = await getConnection();
      // Changed to query mae_empresaservicios table which is the correct source for service entities
      const result = await pool.request().query("SELECT id_empresaservicio, nombre_empresaservicios, contacto_empresaservicios, email_contacto, email_empresaservicios FROM mae_empresaservicios WHERE habilitado = 'S'");
      let empresas = result.recordset;

      logger.info(`Returning all service empresas from mae_empresaservicios (${empresas.length} records)`);
      return empresas;
    } catch (error) {
      logger.error('Error in getEmpresasServicio service:', error);
      throw error;
    }
  },

  getClientes: async (idEmpresaServicio) => {
    try {
      const pool = await getConnection();
      const request = pool.request();
      let query = "SELECT id_empresa, nombre_empresa, id_empresaservicio, email_empresa FROM mae_empresa WHERE habilitado = 'S'";
      if (idEmpresaServicio) {
        request.input('idEmpresaServicio', sql.Int, Number(idEmpresaServicio));
        query += ' AND id_empresaservicio = @idEmpresaServicio';
      }
      const result = await request.query(query);
      logger.info(`Returning ${result.recordset.length} clientes${idEmpresaServicio ? ` for empresa_servicio ${idEmpresaServicio}` : ''}`);
      return result.recordset;
    } catch (error) {
      logger.error('Error in getClientes service:', error);
      throw error;
    }
  },

  getContactos: async (idCliente, idEmpresaServicio) => {
    try {
      const pool = await getConnection();
      const request = pool.request();

      // If both are provided, we want contacts that belong to the Client
      // but we also allow finding contacts linked via the Service Provider.
      // However, the "Client" selection should take precedence for filtering contacts.
      if (idCliente) {
          request.input('xid_empresa', sql.Int, idCliente);
          const result = await request.execute('consulta_contacto_una_empresa');
          const contactos = (result.recordset || []).filter(c => c.habilitado === 'S');
          logger.info(`Contactos for cliente ${idCliente}: ${contactos.length} records (filtered by habilitado=S)`);
          return contactos;
      }

      if (idEmpresaServicio) {
        const query = `
          SELECT * FROM mae_contacto
          WHERE id_empresa IN (SELECT id_empresa FROM mae_empresa WHERE id_empresaservicio = @idEmpresaServicio AND habilitado = 'S')
          AND habilitado = 'S'
        `;
        request.input('idEmpresaServicio', sql.Int, Number(idEmpresaServicio));
        const result = await request.query(query);
        logger.info(`Contactos for empresa_servicio ${idEmpresaServicio}: ${result.recordset.length} records`);
        return result.recordset;
      }

      // If nothing provided, return all habilitados
      const result = await pool.request().query("SELECT * FROM mae_contacto WHERE habilitado = 'S'");
      return result.recordset;
    } catch (error) {
      logger.error('Error in getContactos service:', error);
      throw error;
    }
  },

  getCentros: async (idCliente, idEmpresaServicio) => {
    try {
      const pool = await getConnection();
      const request = pool.request();

      // Direct parameterized query — avoids loading the full table into memory
      let query = `
        SELECT c.id_centro, c.codigo_centro, c.nombre_centro, c.ubicacion,
               c.id_empresa, e.nombre_empresa
        FROM mae_centro c
        INNER JOIN mae_empresa e ON c.id_empresa = e.id_empresa
        WHERE c.vigente = 'S'
      `;

      if (idCliente) {
        request.input('idCliente', sql.Int, Number(idCliente));
        query += ' AND c.id_empresa = @idCliente';
      } else if (idEmpresaServicio) {
        request.input('idServicio', sql.Int, Number(idEmpresaServicio));
        query += ' AND e.id_empresaservicio = @idServicio';
      }

      query += ' ORDER BY c.nombre_centro';
      const result = await request.query(query);
      logger.info(`Centros${idCliente ? ` for cliente ${idCliente}` : idEmpresaServicio ? ` for empresa_servicio ${idEmpresaServicio}` : ''}: ${result.recordset.length} records`);
      return result.recordset;
    } catch (error) {
      logger.error('Error in getCentros service:', error);
      throw error;
    }
  },

  // Futuros SPs se implementarán aquí siguiendo el mismo patrón
  /*
  getEmpresasServicio: async (idLugarAnalisis) => {
    try {
      const pool = await getConnection();
      const result = await pool.request()
        .input('id_lugaranalisis', sql.Int, idLugarAnalisis)
        .execute('maestro_empresaservicio');
      return result.recordset;
    } catch (error) { ... }
  },
  */
  // Bloque 2: Datos del Servicio y Muestreo
  // Bloque 2: Datos del Servicio y Muestreo
  getObjetivosMuestreo: async (clienteId, idEmpresaServicio) => {
    try {
      const pool = await getConnection();
      // SP does not accept params
      const result = await pool.request().execute('consulta_objetivomuestreo_ma_oservicios');
      let data = result.recordset;

      if (idEmpresaServicio) {
        const idS = Number(idEmpresaServicio);
        const clientRes = await pool.request()
          .input('idS', sql.Int, idS)
          .query("SELECT id_empresa FROM mae_empresa WHERE id_empresaservicio = @idS AND habilitado = 'S'");
        const allowedIds = clientRes.recordset.map(r => r.id_empresa);
        
        // Filter objectives by those client IDs if possible (though objectives usually depend on clienteId more specifically)
        // However, if we want to show all possible objectives for the service company:
        const clientCol = data.length > 0 ? Object.keys(data[0]).find(k => /id_?cliente/i.test(k) || /xid_?cliente/i.test(k)) : null;
        if (clientCol) {
            data = data.filter(item => allowedIds.includes(Number(item[clientCol])));
        }
        logger.info(`Objetivos filtered for empresa_servicio ${idEmpresaServicio}: ${data.length} records`);
      } else if (clienteId) {
        const id = Number(clienteId);
        // Try all casing variations for ID Client
        const clientCol = data.length > 0 ? Object.keys(data[0]).find(k => /id_?cliente/i.test(k) || /xid_?cliente/i.test(k)) : null;

        if (clientCol) {
          data = data.filter(item => item[clientCol] == id);
        } else if (data.length > 0) {
          // Warn but return all to avoid empty list if column name is completely different
          logger.warn('getObjetivosMuestreo: Cannot filter by clienteId, keys:', Object.keys(data[0]));
        }
      }
      return data;
    } catch (error) {
      logger.error('Error in getObjetivosMuestreo:', error);
      throw error;
    }
  },

  getComponentesAmbientales: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('consulta_tipomuestra_medioambiente');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getComponentesAmbientales:', error);
      throw error;
    }
  },

  getSubAreas: async (idComponente) => {
    try {
      const pool = await getConnection();
      const request = pool.request();

      // Fix: Procedure expects @xid_tipomuestra (which corresponds to Componente ID)
      if (idComponente) {
        request.input('xid_tipomuestra', sql.Int, idComponente);
        const result = await request.execute('consulta_subarea_medioambiente');
        return result.recordset;
      } else {
        // Since it's a required param, return empty instead of letting SP fail
        logger.warn('getSubAreas called without idComponente, returning empty array');
        return [];
      }
    } catch (error) {
      logger.error('Error in getSubAreas:', error);
      throw error;
    }
  },

  getInspectores: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('consulta_inspectorambiental');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getInspectores:', error);
      throw error;
    }
  },

  getTiposMuestreo: async () => {
    try {
      const pool = await getConnection();
      // Simplify SP name
      const result = await pool.request().execute('consulta_tipomuestreo_medio_ambiente');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getTiposMuestreo:', error);
      // Suppress error
      return [];
    }
  },

  getTiposMuestra: async (idTipoMuestreo) => {
    try {
      const pool = await getConnection();
      const request = pool.request();

      // if (idTipoMuestreo) {
      //   request.input('id_tipomuestreo', sql.Int, idTipoMuestreo);
      // }

      // Simplify SP name
      const result = await request.execute('consulta_tipomuestra_ma');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getTiposMuestra:', error);
      return [];
    }
  },

  getActividadesMuestreo: async (idTipoMuestra) => {
    try {
      const pool = await getConnection();
      const request = pool.request();

      // if (idTipoMuestreo) {
      //   request.input('id_tipomuestreo', sql.Int, idTipoMuestreo);
      // }

      // Simplify SP name
      const result = await request.execute('consulta_mae_actividadmuestreo');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getActividadesMuestreo:', error);
      throw error;
    }
  },

  getTiposDescarga: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('consulta_mae_tipodescarga');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getTiposDescarga:', error);
      throw error;
    }
  },

  getModalidades: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('Consulta_Mae_Modalidad');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getModalidades:', error);
      throw error;
    }
  },

  getCargos: async () => {
    try {
      const pool = await getConnection();
      // User provided raw SQL: Select nombre_cargo,id_cargo from mae_cargo Order by nombre_cargo
      const result = await pool.request().query('Select * from mae_cargo Order by nombre_cargo');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getCargos:', error);
      // Suppress error to avoid breaking form, return empty
      return [];
    }
  },

  getFrecuenciasPeriodo: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('Consulta_Frecuencia_Periodo');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getFrecuenciasPeriodo:', error);
      return [];
    }
  },

  getFormasCanal: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('Consulta_Mae_Formacanal');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getFormasCanal:', error);
      throw error;
    }
  },

  getDispositivosHidraulicos: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('Consulta_Mae_Dispositivohidraulico');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getDispositivosHidraulicos:', error);
      throw error;
    }
  },

  getMuestreadores: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().query("SELECT id_muestreador, nombre_muestreador FROM mae_muestreador WHERE habilitado = 'S' ORDER BY nombre_muestreador");
      return result.recordset;
    } catch (error) {
      logger.error('Error in getMuestreadores:', error);
      throw error;
    }
  },

  getCoordinadores: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().execute('consulta_coordinador');
      return result.recordset;
    } catch (error) {
      logger.error('Error in getCoordinadores:', error);
      throw error;
    }
  },
  getInstrumentosAmbientales: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().query("SELECT id, nombre FROM mae_instrumentoambiental WHERE estado = 'V' ORDER BY id ASC");
      return result.recordset;
    } catch (error) {
      logger.error('Error in getInstrumentosAmbientales:', error);
      throw error;
    }
  },
  getUnidadesMedida: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().query("SELECT id_umedida, nombre_umedida FROM mae_umedida ORDER BY nombre_umedida");
      return result.recordset;
    } catch (error) {
      logger.error('Error in getUnidadesMedida:', error);
      throw error;
    }
  },
  getEstadosMuestreo: async () => {
    try {
      const pool = await getConnection();
      const result = await pool.request().query("SELECT id_estadomuestreo, nombre_estadomuestreo FROM mae_estadomuestreo WHERE habilitado = 'S' AND id_estadomuestreo NOT IN (1, 3) ORDER BY orden");
      return result.recordset;
    } catch (error) {
      logger.error('Error in getEstadosMuestreo service:', error);
      throw error;
    }
  },

  getMaestroData: async (tableName) => {
    try {
      assertTable(tableName);
      const pool = await getConnection();
      const result = await pool.request().query(`SELECT * FROM ${tableName}`);
      const blocked = SENSITIVE_COLUMNS[tableName];
      if (!blocked) return result.recordset;
      return result.recordset.map(row => {
        const clean = { ...row };
        blocked.forEach(col => delete clean[col]);
        return clean;
      });
    } catch (error) {
      logger.error(`Error in getMaestroData (${tableName}):`, error);
      throw error;
    }
  },
  
  // Generic CRUD for Maestros
  createMaestro: async (tableName, data) => {
    try {
      assertTable(tableName);
      Object.keys(data).forEach(k => assertIdentifier(k, 'column'));
      const pool = await getConnection();

      // Check if table has an identity column
      const identityCheck = await pool.request()
        .input('tName', sql.VarChar(128), tableName)
        .query(`SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(@tName) AND is_identity = 1`);

      const hasIdentity = identityCheck.recordset.length > 0;
      let finalData = { ...data };

      if (!hasIdentity) {
        const pkCheck = await pool.request()
          .input('tName2', sql.VarChar(128), tableName)
          .query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_NAME = @tName2
            AND OBJECTPROPERTY(OBJECT_ID(CONSTRAINT_SCHEMA + '.' + CONSTRAINT_NAME), 'IsPrimaryKey') = 1
          `);

        if (pkCheck.recordset.length > 0) {
          const pkName = pkCheck.recordset[0].COLUMN_NAME;
          assertIdentifier(pkName, 'pk column');
          if (!finalData[pkName] || finalData[pkName] === 0 || finalData[pkName] === '0') {
            const maxIdRes = await pool.request().query(`SELECT MAX(${pkName}) as MaxID FROM ${tableName}`);
            const nextId = (maxIdRes.recordset[0].MaxID || 0) + 1;
            finalData[pkName] = nextId;
            logger.info(`Generated next ID ${nextId} for non-identity table ${tableName} column ${pkName}`);
          }
        }
      }

      const columns = Object.keys(finalData).join(', ');
      const values = Object.keys(finalData).map(key => `@${key}`).join(', ');

      const request = pool.request();
      Object.entries(finalData).forEach(([key, value]) => {
        let finalValue = value;
        if (value === '' || value === undefined || (typeof value === 'number' && isNaN(value))) {
          finalValue = null;
        }
        request.input(key, finalValue);
      });

      await request.query(`INSERT INTO ${tableName} (${columns}) VALUES (${values})`);
      return { success: true };
    } catch (error) {
      logger.error(`Error in createMaestro (${tableName}):`, error);
      throw error;
    }
  },

  updateMaestro: async (tableName, idName, idValue, data) => {
    try {
      assertTable(tableName);
      assertIdentifier(idName, 'id column');
      Object.keys(data).forEach(k => assertIdentifier(k, 'column'));
      const pool = await getConnection();
      const updates = Object.keys(data).map(key => `${key} = @${key}`).join(', ');

      const request = pool.request();
      request.input('idValue', idValue);
      Object.entries(data).forEach(([key, value]) => {
        let finalValue = value;
        if (value === '' || value === undefined || (typeof value === 'number' && isNaN(value))) {
          finalValue = null;
        }
        request.input(key, finalValue);
      });

      await request.query(`UPDATE ${tableName} SET ${updates} WHERE ${idName} = @idValue`);
      return { success: true };
    } catch (error) {
      logger.error(`Error in updateMaestro (${tableName}):`, error);
      throw error;
    }
  },

  toggleMaestroStatus: async (tableName, idName, idValue, statusColumn, newStatus) => {
    const ALLOWED_STATUS_VALUES = new Set(['S', 'N', 'activo', 'inactivo', 'Activo', 'Inactivo', '1', '0', 1, 0, true, false]);
    try {
      assertTable(tableName);
      assertIdentifier(idName, 'id column');
      assertIdentifier(statusColumn, 'status column');
      if (!ALLOWED_STATUS_VALUES.has(newStatus)) {
        throw new Error(`Invalid status value: ${newStatus}`);
      }
      const pool = await getConnection();
      const request = pool.request();
      request.input('idValue', idValue);
      request.input('newStatus', String(newStatus));

      await request.query(`UPDATE ${tableName} SET ${statusColumn} = @newStatus WHERE ${idName} = @idValue`);
      return { success: true };
    } catch (error) {
      logger.error(`Error in toggleMaestroStatus (${tableName}):`, error);
      throw error;
    }
  }
};
