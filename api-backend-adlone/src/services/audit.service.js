
import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import { getContext } from '../utils/context.js';

class AuditService {
    /**
     * Registra un evento en la tabla App_Audit_Log
     * @param {object} params - Parámetros de la auditoría
     * @param {number} params.usuario_id - ID del usuario que realiza la acción
     * @param {number} params.usuario_id - ID del usuario que realiza la acción
     * @param {string} params.area_key - Slug del área (ventas, it, rrhh, etc)
     * @param {string} params.modulo_nombre - Nombre del módulo
     * @param {string} params.evento_tipo - Tipo de evento (INSERT, UPDATE, APROBACION, etc)
     * @param {string} params.entidad_nombre - Nombre de la tabla/entidad afectada
     * @param {string} params.entidad_id - ID del registro afectado
     * @param {string} params.descripcion_humana - Descripción legible
     * @param {object} [params.datos_anteriores] - Objeto previo
     * @param {object} [params.datos_nuevos] - Objeto nuevo
     * @param {object} [params.metadatos_extra] - Headers, User-Agent, etc
     * @param {string} [params.ip_address] - Dirección IP
     * @param {string} [params.trace_id] - ID de seguimiento (Correlation ID)
     * @param {number} [params.severidad] - 1: Info, 2: Warning, 3: Critical
     */
    async log(params) {
        try {
            const context = getContext();
            const pool = await getConnection();
            const request = pool.request();


            request.input('usuario_id', sql.Numeric(18,0), params.usuario_id);
            request.input('area_key', sql.NVarChar(50), params.area_key);
            request.input('modulo_nombre', sql.NVarChar(100), params.modulo_nombre);
            request.input('evento_tipo', sql.NVarChar(50), params.evento_tipo);
            request.input('entidad_nombre', sql.NVarChar(100), params.entidad_nombre);
            request.input('entidad_id', sql.NVarChar(100), String(params.entidad_id));
            request.input('descripcion_humana', sql.NVarChar(500), params.descripcion_humana);
            
            request.input('datos_anteriores', sql.NVarChar(sql.MAX), params.datos_anteriores ? JSON.stringify(params.datos_anteriores) : null);
            request.input('datos_nuevos', sql.NVarChar(sql.MAX), params.datos_nuevos ? JSON.stringify(params.datos_nuevos) : null);
            
            // Enrichment: Always attempt to get data from context if missing in params
            const ipAddress = params.ip_address || context.ip || null;
            const traceId = params.trace_id || context.traceId || null;

            // Enrich metadatos_extra with user agent and other context info
            const extra = params.metadatos_extra || {};
            if (context.userAgent && !extra.userAgent) {
                extra.userAgent = context.userAgent;
            }
            // Add method and path for better traceability
            if (context.method && !extra.method) {
                extra.method = context.method;
            }
            if (context.path && !extra.path) {
                extra.path = context.path;
            }
            // Also store the inferred IP if not explicitly in extra
            if (ipAddress && !extra.ip_context) {
                extra.ip_context = ipAddress;
            }

            request.input('metadatos_extra', sql.NVarChar(sql.MAX), Object.keys(extra).length > 0 ? JSON.stringify(extra) : null);
            request.input('ip_address', sql.VarChar(45), ipAddress);
            request.input('trace_id', sql.UniqueIdentifier, traceId);
            request.input('severidad', sql.Int, params.severidad || 1);

            await request.query(`
                INSERT INTO [dbo].[App_Audit_Log] (
                    usuario_id, area_key, modulo_nombre, evento_tipo, 
                    entidad_nombre, entidad_id, descripcion_humana, 
                    datos_anteriores, datos_nuevos, metadatos_extra, 
                    ip_address, trace_id, severidad
                ) VALUES (
                    @usuario_id, @area_key, @modulo_nombre, @evento_tipo, 
                    @entidad_nombre, @entidad_id, @descripcion_humana, 
                    @datos_anteriores, @datos_nuevos, @metadatos_extra, 
                    @ip_address, @trace_id, @severidad
                )
            `);

            logger.debug(`Audit logged: ${params.evento_tipo} on ${params.entidad_nombre}(${params.entidad_id})`);
        } catch (error) {
            logger.error('Failed to write audit log:', error);
            // We don't throw to avoid breaking the main business logic
        }
    }
}

export default new AuditService();
