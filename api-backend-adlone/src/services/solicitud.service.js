import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import notificationService from './notification.service.js';

class SolicitudService {
    async create(data) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('tipo', sql.VarChar(20), data.tipo_solicitud)
                .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(data.datos_json))
                .input('usuario', sql.Numeric(10, 0), data.usuario_solicita)
                .query(`
                    INSERT INTO mae_solicitud_equipo (tipo_solicitud, estado, datos_json, usuario_solicita, fecha_solicitud)
                    VALUES (@tipo, 'PENDIENTE', @datos, @usuario, GETDATE());
                    SELECT SCOPE_IDENTITY() AS id;
                `);

            const newId = result.recordset[0].id;

            // Enviar notificación a administradores
            try {
                const userResult = await pool.request()
                    .input('id', sql.Numeric(10, 0), data.usuario_solicita)
                    .query("SELECT nombre_usuario FROM mae_usuario WHERE id_usuario = @id");

                const userName = userResult.recordset[0]?.nombre_usuario || 'Usuario';

                let tipoLabel = data.tipo_solicitud;
                if (tipoLabel === 'ALTA') {
                    tipoLabel = data.datos_json?.isReactivation ? 'Activación de Equipo' : 'Registro de Nuevo Equipo';
                } else if (tipoLabel === 'BAJA') {
                    tipoLabel = 'Baja de Equipo';
                } else if (tipoLabel === 'TRASPASO') {
                    tipoLabel = 'Traspaso de Equipo';
                }

                notificationService.send('SOL_EQUIPO_NUEVA', {
                    CORRELATIVO: newId,
                    TIPO_SOLICITUD: tipoLabel,
                    USUARIO: userName,
                    FECHA: new Date().toLocaleDateString('es-CL'),
                    HORA: new Date().toLocaleTimeString('es-CL'),
                    OBSERVACION: data.datos_json?.motivo || 'Sin observaciones',
                    equipos: this._getEquiposList(data.tipo_solicitud, data.datos_json)
                });
            } catch (notifyError) {
                logger.error('Error sending new solicitud notification:', notifyError);
            }

            return { success: true, id: newId };
        } catch (error) {
            logger.error('Error creating solicitud:', error);
            throw error;
        }
    }

    async getSolicitudes(filters = {}) {
        try {
            const pool = await getConnection();
            let query = `
                SELECT s.*, 
                       u_sol.nombre_usuario as nombre_solicitante,
                       u_sol.seccion as seccion_solicitante,
                       u_rev.nombre_usuario as nombre_revisor
                FROM mae_solicitud_equipo s
                LEFT JOIN mae_usuario u_sol ON s.usuario_solicita = u_sol.id_usuario
                LEFT JOIN mae_usuario u_rev ON s.usuario_revisa = u_rev.id_usuario
            `;

            const request = pool.request();
            const whereConditions = [];

            if (filters.estado) {
                whereConditions.push('s.estado = @estado');
                request.input('estado', sql.VarChar(20), filters.estado);
            }
            if (filters.usuario_solicita) {
                whereConditions.push('s.usuario_solicita = @usuario');
                request.input('usuario', sql.Numeric(10, 0), filters.usuario_solicita);
            }
            if (filters.usuario_excluir) {
                whereConditions.push('s.usuario_solicita != @usuarioExcluir');
                request.input('usuarioExcluir', sql.Numeric(10, 0), filters.usuario_excluir);
            }
            if (filters.secciones && filters.secciones.length > 0) {
                const sectionParams = filters.secciones.map((s, i) => `@sec${i}`).join(',');
                let sectionClause = `u_sol.seccion IN (${sectionParams})`;

                if (filters.siempre_incluir_usuario) {
                    sectionClause = `(${sectionClause} OR s.usuario_solicita = @incluirUsuario)`;
                    request.input('incluirUsuario', sql.Numeric(10, 0), filters.siempre_incluir_usuario);
                }

                whereConditions.push(sectionClause);
                filters.secciones.forEach((s, i) => {
                    request.input(`sec${i}`, sql.VarChar(20), s);
                });
            }


            if (whereConditions.length > 0) {
                query += ' WHERE ' + whereConditions.join(' AND ');
            }

            query += ' ORDER BY s.fecha_solicitud DESC';

            const result = await request.query(query);
            return result.recordset.map(row => ({
                ...row,
                datos_json: JSON.parse(row.datos_json)
            }));
        } catch (error) {
            logger.error('Error fetching solicitudes:', error);
            throw error;
        }
    }

    async updateStatus(id, status, feedback, adminId, datos_json = null) {
        try {
            const pool = await getConnection();

            // 1. Get Solicitante details and Request Type before updating
            const solInfo = await pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .query(`
                    SELECT s.usuario_solicita, s.tipo_solicitud, s.datos_json, u.correo_electronico, u.nombre_usuario
                    FROM mae_solicitud_equipo s
                    JOIN mae_usuario u ON s.usuario_solicita = u.id_usuario
                    WHERE s.id_solicitud = @id
                `);

            let query = `
                UPDATE mae_solicitud_equipo 
                SET estado = @status, 
                    feedback_admin = @feedback, 
                    usuario_revisa = @adminId, 
                    fecha_revision = GETDATE()
            `;

            const request = pool.request()
                .input('id', sql.Numeric(10, 0), id)
                .input('status', sql.VarChar(20), status)
                .input('feedback', sql.VarChar(1000), feedback)
                .input('adminId', sql.Numeric(10, 0), adminId);

            if (datos_json) {
                query += `, datos_json = @datos`;
                request.input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos_json));
            }

            query += ` WHERE id_solicitud = @id`;

            await request.query(query);

            // Enviar notificación de resultado al solicitante
            try {
                const sol = solInfo.recordset[0];
                const adminResult = await pool.request()
                    .input('id', sql.Numeric(10, 0), adminId)
                    .query("SELECT nombre_usuario FROM mae_usuario WHERE id_usuario = @id");

                const adminName = adminResult.recordset[0]?.nombre_usuario || 'Administrador';
                const solDatos = JSON.parse(sol.datos_json);

                let eventCode = '';
                const statusSuffix = status === 'APROBADO' ? 'APR' : 'RECH';
                const type = sol.tipo_solicitud;
                let tipoLabel = type;

                if (type === 'TRASPASO') {
                    eventCode = `SOL_EQUIPO_TRASPASO_${statusSuffix}`;
                    tipoLabel = 'Traspaso de Equipo';
                } else if (type === 'BAJA') {
                    eventCode = `SOL_EQUIPO_BAJA_${statusSuffix}`;
                    tipoLabel = 'Baja de Equipo';
                } else if (type === 'ALTA') {
                    const isReac = solDatos?.isReactivation || false;
                    eventCode = isReac ? `SOL_EQUIPO_REAC_${statusSuffix}` : `SOL_EQUIPO_ALTA_${statusSuffix}`;
                    tipoLabel = isReac ? 'Activación de Equipo' : 'Registro de Nuevo Equipo';
                }

                if (eventCode) {
                    notificationService.send(eventCode, {
                        CORRELATIVO: id,
                        TIPO_SOLICITUD: tipoLabel,
                        USUARIO: adminName,
                        FECHA: new Date().toLocaleDateString('es-CL'),
                        HORA: new Date().toLocaleTimeString('es-CL'),
                        OBSERVACION: feedback || (status === 'APROBADO' ? 'Aprobado correctamente' : 'Sin motivo especificado'),
                        directEmails: sol.correo_electronico,
                        equipos: this._getEquiposList(type, solDatos)
                    });
                }
            } catch (notifyError) {
                logger.error('Error sending result notification:', notifyError);
            }

            return { success: true };
        } catch (error) {
            logger.error('Error updating solicitud status:', error);
            throw error;
        }
    }

    _getEquiposList(type, solDatos) {
        if (!solDatos) return [];

        if (type === 'ALTA') {
            if (solDatos.isReactivation && solDatos.equipos_alta) {
                return solDatos.equipos_alta.map(e => ({
                    nombre: e.nombre,
                    codigo: e.codigo,
                    tipo: e.tipo,
                    marca: e.marca,
                    modelo: e.modelo,
                    serie: e.serie,
                    ubicacion: e.ubicacion,
                    vigencia: e.vigencia
                }));
            } else {
                return [{
                    nombre: solDatos.nombre,
                    codigo: solDatos.correlativo ? `${solDatos.sigla}-${solDatos.correlativo}` : solDatos.codigo,
                    tipo: solDatos.tipo,
                    marca: solDatos.marca,
                    modelo: solDatos.modelo,
                    serie: solDatos.serie,
                    ubicacion: solDatos.ubicacion,
                    vigencia: solDatos.vigencia,
                    responsable: solDatos.responsable || solDatos.responsable_nombre
                }];
            }
        } else if (type === 'BAJA') {
            const list = solDatos.equipos_baja || [];
            return list.map(e => ({
                nombre: e.nombre,
                codigo: e.codigo,
                tipo: e.tipo,
                marca: e.marca,
                modelo: e.modelo,
                serie: e.serie,
                ubicacion: e.ubicacion
            }));
        } else if (type === 'TRASPASO') {
            return [{
                nombre: solDatos.equipo_nombre,
                codigo: solDatos.equipo_codigo,
                tipo: solDatos.equipo_tipo,
                ubicacion: solDatos.ubicacion_actual,
                nueva_ubicacion: solDatos.nueva_ubicacion,
                responsable: solDatos.nuevo_responsable_nombre,
                vigencia: solDatos.vigencia
            }];
        }
        return [];
    }
}

export default new SolicitudService();
