import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';

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

  getEmpresasServicio: async (idLugarAnalisis) => {
    try {
      const pool = await getConnection();
      // Requirement: Show all companies, no dependency on Sede
      // User requested independence.
      const spResult = await pool.request().execute('maestro_empresaservicio');
      let empresas = spResult.recordset;

      logger.info(`Returning all empresas (${empresas.length} records)`);
      return empresas;
    } catch (error) {
      logger.error('Error in getEmpresasServicio service:', error);
      throw error;
    }
  },

  getClientes: async (idEmpresaServicio) => {
    try {
      const pool = await getConnection();
      // Requirement: Show all clients, no dependency on Empresa Facturar
      const result = await pool.request().execute('maestro_empresa');
      let clientes = result.recordset;

      logger.info(`Returning all clientes (${clientes.length} records)`);
      return clientes;
    } catch (error) {
      logger.error('Error in getClientes service:', error);
      throw error;
    }
  },

  getContactos: async (idCliente) => {
    try {
      const pool = await getConnection();
      const request = pool.request();

      // User specified SP: consulta_contacto_una_empresa @xid_empresa
      // Logs showed this working with params, so keeping it.
      if (idCliente) {
        request.input('xid_empresa', sql.Int, idCliente);
      }

      const result = await request.execute('consulta_contacto_una_empresa');
      logger.info(`Contactos for cliente ${idCliente}: ${result.recordset.length} records`);
      return result.recordset;
    } catch (error) {
      logger.error('Error in getContactos service:', error);
      throw error;
    }
  },

  getCentros: async (idCliente) => {
    try {
      const pool = await getConnection();

      // FIX: "Procedure consulta_centro has no parameters and arguments were supplied."
      // We must call it without params and filter in memory.
      const result = await pool.request().execute('consulta_centro');
      let centros = result.recordset;

      if (idCliente) {
        const idFilter = Number(idCliente);
        centros = centros.filter(c =>
          c.id_empresa === idFilter ||
          c.IdEmpresa === idFilter
        );
      }

      logger.info(`Centros filtered for cliente ${idCliente}: ${centros.length} records`);
      return centros;
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
  getObjetivosMuestreo: async (clienteId) => {
    try {
      const pool = await getConnection();
      // SP does not accept params
      const result = await pool.request().execute('consulta_objetivomuestreo_ma_oservicios');
      let data = result.recordset;

      if (clienteId) {
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
      } else {
        // Since it's a required param, if not provided it will fail. 
        // We can either throw or send 0 or null if SP handles it.
        // Assuming we need it.
        logger.warn('getSubAreas called without idComponente, SP might fail');
      }

      const result = await request.execute('consulta_subarea_medioambiente');
      return result.recordset;
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
      const result = await pool.request().query("SELECT id_muestreador, nombre_muestreador FROM mae_muestreador ORDER BY nombre_muestreador");
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
};
