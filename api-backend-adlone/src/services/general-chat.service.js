import { getConnection } from '../config/database.js';
import sql from 'mssql';
import logger from '../utils/logger.js';
import unsService from './uns.service.js';
import path from 'path';
import fs from 'fs';
// Dummy comment to trigger nodemon restart and refresh DB connection pool

class GeneralChatService {

    // ─── CONVERSACIONES ────────────────────────────────────────
    
    /**
     * Lista conversaciones del usuario con último mensaje y conteo de no leídos
     */
    async getConversations(userId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`
                    SELECT 
                        c.id_conversacion,
                        c.tipo,
                        c.nombre_grupo,
                        c.foto_grupo,
                        c.descripcion,
                        c.fecha_creacion,
                        c.ultimo_mensaje_fecha,
                        CASE WHEN m.id_mensaje IS NOT NULL AND (p.mensajes_ocultos_hasta IS NULL OR m.fecha > p.mensajes_ocultos_hasta)
                            THEN m.mensaje ELSE NULL END as ultimo_mensaje,
                        CASE WHEN m.id_mensaje IS NOT NULL AND (p.mensajes_ocultos_hasta IS NULL OR m.fecha > p.mensajes_ocultos_hasta)
                            THEN m.tipo_mensaje ELSE NULL END as ultimo_tipo_mensaje,
                        CASE WHEN m.id_mensaje IS NOT NULL AND (p.mensajes_ocultos_hasta IS NULL OR m.fecha > p.mensajes_ocultos_hasta)
                            THEN m.id_emisor ELSE NULL END as ultimo_emisor_id,
                        CASE WHEN m.id_mensaje IS NOT NULL AND (p.mensajes_ocultos_hasta IS NULL OR m.fecha > p.mensajes_ocultos_hasta)
                            THEN ue.usuario ELSE NULL END as ultimo_emisor_nombre,
                        -- Para conversaciones directas, obtener datos del otro participante
                        CASE WHEN c.tipo = 'DIRECTA' 
                            THEN (SELECT TOP 1 u2.id_usuario FROM rel_chat_participante p2 
                                  JOIN mae_usuario u2 ON p2.id_usuario = u2.id_usuario 
                                  WHERE p2.id_conversacion = c.id_conversacion 
                                  AND p2.id_usuario <> @userId AND p2.activo = 1)
                            ELSE NULL END as contacto_id,
                        CASE WHEN c.tipo = 'DIRECTA' 
                            THEN (SELECT TOP 1 u2.usuario FROM rel_chat_participante p2 
                                  JOIN mae_usuario u2 ON p2.id_usuario = u2.id_usuario 
                                  WHERE p2.id_conversacion = c.id_conversacion 
                                  AND p2.id_usuario <> @userId AND p2.activo = 1)
                            ELSE c.nombre_grupo END as nombre_display,
                        CASE WHEN c.tipo = 'DIRECTA' 
                            THEN (SELECT TOP 1 u2.foto FROM rel_chat_participante p2 
                                  JOIN mae_usuario u2 ON p2.id_usuario = u2.id_usuario 
                                  WHERE p2.id_conversacion = c.id_conversacion 
                                  AND p2.id_usuario <> @userId AND p2.activo = 1)
                            ELSE c.foto_grupo END as foto_display,
                        -- Conteo no leídos
                        (SELECT COUNT(*) FROM mae_chat_mensaje msg
                         WHERE msg.id_conversacion = c.id_conversacion
                         AND msg.id_emisor <> @userId
                         AND msg.eliminado = 0
                         AND (msg.fecha >= p.fecha_union AND (p.mensajes_ocultos_hasta IS NULL OR msg.fecha > p.mensajes_ocultos_hasta))
                         AND NOT EXISTS (
                             SELECT 1 FROM rel_chat_lectura l 
                             WHERE l.id_mensaje = msg.id_mensaje AND l.id_usuario = @userId
                         )) as no_leidos,
                        -- Cantidad de miembros (para grupos)
                        (SELECT COUNT(*) FROM rel_chat_participante pm 
                         WHERE pm.id_conversacion = c.id_conversacion AND pm.activo = 1) as total_miembros,
                        -- Favorito (directo o grupo)
                        CASE WHEN EXISTS (
                            SELECT 1 FROM rel_contacto_favorito f 
                            WHERE f.id_usuario = @userId 
                            AND (
                                (c.tipo = 'DIRECTA' AND f.tipo_contacto = 'USER' AND f.id_contacto = (SELECT TOP 1 p2.id_usuario FROM rel_chat_participante p2 WHERE p2.id_conversacion = c.id_conversacion AND p2.id_usuario <> @userId AND p2.activo = 1))
                                OR (c.tipo = 'GRUPO' AND f.tipo_contacto = 'GROUP' AND f.id_contacto = c.id_conversacion)
                            )
                        ) THEN 1 ELSE 0 END as es_favorito
                    FROM mae_chat_conversacion c
                    INNER JOIN rel_chat_participante p ON c.id_conversacion = p.id_conversacion 
                        AND p.id_usuario = @userId AND p.activo = 1
                    LEFT JOIN mae_chat_mensaje m ON m.id_mensaje = c.ultimo_mensaje_id
                    LEFT JOIN mae_usuario ue ON m.id_emisor = ue.id_usuario
                    WHERE c.activo = 1
                    -- Mostrar si: no está oculta O hay mensajes nuevos desde el ocultamiento
                    AND (p.ocultar_si_vacio = 0 OR (p.mensajes_ocultos_hasta IS NULL OR CAST(ISNULL(c.ultimo_mensaje_fecha, c.fecha_creacion) AS DATETIME) > CAST(p.mensajes_ocultos_hasta AS DATETIME)))
                    -- Mostrar si: no está oculta O no hay mensajes O el último mensaje es posterior a unirse
                    AND (p.ocultar_si_vacio = 0 OR c.ultimo_mensaje_id IS NULL OR CAST(c.ultimo_mensaje_fecha AS DATETIME) >= CAST(p.fecha_union AS DATETIME))
                    ORDER BY es_favorito DESC, ISNULL(c.ultimo_mensaje_fecha, c.fecha_creacion) DESC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getConversations:', error);
            throw error;
        }
    }

    /**
     * Obtener o crear conversación directa (1-a-1) entre dos usuarios
     */
    async getOrCreateDirectConversation(userId, targetUserId) {
        try {
            const pool = await getConnection();
            
            // Buscar conversación directa existente
            const existing = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('targetUserId', sql.Numeric(10, 0), targetUserId)
                .query(`
                    SELECT c.id_conversacion
                    FROM mae_chat_conversacion c
                    WHERE c.tipo = 'DIRECTA' AND c.activo = 1
                    AND EXISTS (SELECT 1 FROM rel_chat_participante p1 WHERE p1.id_conversacion = c.id_conversacion AND p1.id_usuario = @userId AND p1.activo = 1)
                    AND EXISTS (SELECT 1 FROM rel_chat_participante p2 WHERE p2.id_conversacion = c.id_conversacion AND p2.id_usuario = @targetUserId AND p2.activo = 1)
                    AND (SELECT COUNT(*) FROM rel_chat_participante px WHERE px.id_conversacion = c.id_conversacion AND px.activo = 1) = 2
                `);

            if (existing.recordset.length > 0) {
                const convId = existing.recordset[0].id_conversacion;
                // Asegurar que la conversación vuelva a ser visible si estaba oculta
                await pool.request()
                    .input('convId', sql.Numeric(10,0), convId)
                    .input('userId', sql.Numeric(10,0), userId)
                    .query('UPDATE rel_chat_participante SET ocultar_si_vacio = 0 WHERE id_conversacion = @convId AND id_usuario = @userId');
                
                return { id_conversacion: convId, created: false };
            }

            // Crear nueva conversación directa
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const convResult = await transaction.request()
                    .input('creador', sql.Numeric(10, 0), userId)
                    .query(`
                        INSERT INTO mae_chat_conversacion (tipo, creado_por)
                        OUTPUT INSERTED.id_conversacion
                        VALUES ('DIRECTA', @creador)
                    `);
                const convId = convResult.recordset[0].id_conversacion;

                // Agregar participantes
                await transaction.request()
                    .input('convId', sql.Numeric(10, 0), convId)
                    .input('userId', sql.Numeric(10, 0), userId)
                    .query(`INSERT INTO rel_chat_participante (id_conversacion, id_usuario, rol) VALUES (@convId, @userId, 'ADMIN')`);

                await transaction.request()
                    .input('convId', sql.Numeric(10, 0), convId)
                    .input('targetUserId', sql.Numeric(10, 0), targetUserId)
                    .query(`INSERT INTO rel_chat_participante (id_conversacion, id_usuario, rol) VALUES (@convId, @targetUserId, 'MIEMBRO')`);

                await transaction.commit();
                return { id_conversacion: convId, created: true };
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error in getOrCreateDirectConversation:', error);
            throw error;
        }
    }

    // ─── GRUPOS ────────────────────────────────────────────────

    async createGroup(userId, nombre, memberIds, descripcion = '', foto_grupo = null) {
        try {
            const pool = await getConnection();
            const transaction = new sql.Transaction(pool);
            await transaction.begin();
            try {
                const convResult = await transaction.request()
                    .input('creador', sql.Numeric(10, 0), userId)
                    .input('nombre', sql.NVarChar(100), nombre)
                    .input('desc', sql.NVarChar(500), descripcion)
                    .input('foto', sql.NVarChar(500), foto_grupo)
                    .query(`
                        INSERT INTO mae_chat_conversacion (tipo, nombre_grupo, creado_por, descripcion, foto_grupo)
                        OUTPUT INSERTED.id_conversacion
                        VALUES ('GRUPO', @nombre, @creador, @desc, @foto)
                    `);
                const convId = convResult.recordset[0].id_conversacion;

                // Agregar creador como ADMIN
                await transaction.request()
                    .input('convId', sql.Numeric(10, 0), convId)
                    .input('userId', sql.Numeric(10, 0), userId)
                    .query(`INSERT INTO rel_chat_participante (id_conversacion, id_usuario, rol, mensajes_ocultos_hasta) VALUES (@convId, @userId, 'ADMIN', GETUTCDATE())`);

                // Agregar miembros
                for (const memberId of memberIds) {
                    if (Number(memberId) === Number(userId)) continue;
                    await transaction.request()
                        .input('convId', sql.Numeric(10, 0), convId)
                        .input('memberId', sql.Numeric(10, 0), memberId)
                        .query(`INSERT INTO rel_chat_participante (id_conversacion, id_usuario, rol, mensajes_ocultos_hasta) VALUES (@convId, @memberId, 'MIEMBRO', GETUTCDATE())`);
                }

                await transaction.request()
                    .input('convId', sql.Numeric(10, 0), convId)
                    .input('userId', sql.Numeric(10, 0), userId)
                    .input('msg', sql.NVarChar(sql.MAX), `Grupo "${nombre}" creado`)
                    .query(`
                        INSERT INTO mae_chat_mensaje (id_conversacion, id_emisor, mensaje, tipo_mensaje, fecha)
                        VALUES (@convId, @userId, @msg, 'SISTEMA', GETUTCDATE())
                    `);

                // Actualizar último mensaje de conversación
                await transaction.request()
                    .input('convId', sql.Numeric(10, 0), convId)
                    .query(`UPDATE mae_chat_conversacion SET ultimo_mensaje_fecha = GETUTCDATE() WHERE id_conversacion = @convId`);

                await transaction.commit();

                // Notificación a miembros (vía UNS Trigger para respetar el Hub)
                for (const memberId of memberIds) {
                    if (Number(memberId) === Number(userId)) continue;
                    try {
                        await unsService.trigger('GCHAT_GRUPO_CREADO', {
                            id_usuario_accion: userId,
                            id_usuario_destino: memberId,
                            nombre_grupo: nombre,
                            id_referencia: convId,
                            area: 'Chat'
                        });
                        if (global.io) {
                            global.io.to(`user_${memberId}`).emit('chatConversacionNueva', { id_conversacion: convId });
                        }
                    } catch (e) { logger.error('Notification error on group create:', e); }
                }

                return { id_conversacion: convId };
            } catch (err) {
                await transaction.rollback();
                throw err;
            }
        } catch (error) {
            logger.error('Error in createGroup:', error);
            throw error;
        }
    }

    async updateGroup(userId, conversationId, data) {
        try {
            const pool = await getConnection();
            // Verify admin
            await this._verifyGroupAdmin(pool, conversationId, userId);
            
            const sets = [];
            const request = pool.request().input('convId', sql.Numeric(10, 0), conversationId);
            if (data.nombre_grupo !== undefined) {
                sets.push('nombre_grupo = @nombre');
                request.input('nombre', sql.NVarChar(100), data.nombre_grupo);
            }
            if (data.foto_grupo !== undefined) {
                sets.push('foto_grupo = @foto');
                request.input('foto', sql.VarChar(500), data.foto_grupo);
            }
            if (data.descripcion !== undefined) {
                sets.push('descripcion = @desc');
                request.input('desc', sql.NVarChar(500), data.descripcion);
            }
            if (sets.length === 0) return { success: true };
            
            await request.query(`UPDATE mae_chat_conversacion SET ${sets.join(', ')} WHERE id_conversacion = @convId`);
            return { success: true };
        } catch (error) {
            logger.error('Error in updateGroup:', error);
            throw error;
        }
    }

    async addGroupMember(adminUserId, conversationId, targetUserId) {
        try {
            const pool = await getConnection();
            await this._verifyGroupAdmin(pool, conversationId, adminUserId);
            
            // Check if already a member (possibly inactive)
            const existing = await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('userId', sql.Numeric(10, 0), targetUserId)
                .query(`SELECT id_participante, activo FROM rel_chat_participante WHERE id_conversacion = @convId AND id_usuario = @userId`);

            if (existing.recordset.length > 0) {
                if (existing.recordset[0].activo) {
                    throw new Error('El usuario ya es miembro del grupo');
                }
                // Re-activate
                await pool.request()
                    .input('id', sql.Numeric(10, 0), existing.recordset[0].id_participante)
                    .query(`UPDATE rel_chat_participante SET activo = 1, fecha_salida = NULL, fecha_union = GETUTCDATE(), mensajes_ocultos_hasta = GETUTCDATE() WHERE id_participante = @id`);
            } else {
                await pool.request()
                    .input('convId', sql.Numeric(10, 0), conversationId)
                    .input('userId', sql.Numeric(10, 0), targetUserId)
                    .query(`INSERT INTO rel_chat_participante (id_conversacion, id_usuario, rol, mensajes_ocultos_hasta) VALUES (@convId, @userId, 'MIEMBRO', GETUTCDATE())`);
            }

            // Get group name for notification
            const conv = await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .query(`SELECT nombre_grupo FROM mae_chat_conversacion WHERE id_conversacion = @convId`);
            const groupName = conv.recordset[0]?.nombre_grupo || 'Grupo';

            // System message
            const targetUser = await pool.request()
                .input('uid', sql.Numeric(10, 0), targetUserId)
                .query(`SELECT usuario FROM mae_usuario WHERE id_usuario = @uid`);
            const userName = targetUser.recordset[0]?.usuario || 'Usuario';

            await this._insertSystemMessage(pool, conversationId, adminUserId, `${userName} fue agregado al grupo`);

            // Notification (vía UNS Trigger)
            try {
                await unsService.trigger('GCHAT_GRUPO_MIEMBRO_NUEVO', {
                    id_usuario_accion: adminUserId,
                    id_usuario_destino: targetUserId, // El principal afectado
                    nombre_grupo: groupName,
                    id_referencia: conversationId,
                    area: 'Chat'
                });
                
                if (global.io) {
                    global.io.to(`user_${targetUserId}`).emit('chatConversacionNueva', { id_conversacion: conversationId });
                }
            } catch (e) { logger.error('Notification error:', e); }

            return { success: true };
        } catch (error) {
            logger.error('Error in addGroupMember:', error);
            throw error;
        }
    }

    async removeGroupMember(adminUserId, conversationId, targetUserId) {
        try {
            const pool = await getConnection();
            await this._verifyGroupAdmin(pool, conversationId, adminUserId);

            if (Number(adminUserId) === Number(targetUserId)) {
                throw new Error('No puedes expulsarte a ti mismo. Usa "Salir del grupo".');
            }

            await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('userId', sql.Numeric(10, 0), targetUserId)
                .query(`UPDATE rel_chat_participante SET activo = 0, fecha_salida = GETUTCDATE() WHERE id_conversacion = @convId AND id_usuario = @userId`);

            // Get group name
            const conv = await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .query(`SELECT nombre_grupo FROM mae_chat_conversacion WHERE id_conversacion = @convId`);
            const groupName = conv.recordset[0]?.nombre_grupo || 'Grupo';

            const targetUser = await pool.request()
                .input('uid', sql.Numeric(10, 0), targetUserId)
                .query(`SELECT usuario FROM mae_usuario WHERE id_usuario = @uid`);

            await this._insertSystemMessage(pool, conversationId, adminUserId, `${targetUser.recordset[0]?.usuario || 'Usuario'} fue removido del grupo`);

            // Notification (vía UNS Trigger)
            try {
                await unsService.trigger('GCHAT_GRUPO_EXPULSADO', {
                    id_usuario_accion: adminUserId,
                    id_usuario_destino: targetUserId,
                    nombre_grupo: groupName,
                    id_referencia: conversationId,
                    area: 'Chat'
                });
                if (global.io) {
                    global.io.to(`user_${targetUserId}`).emit('chatMiembroRemovido', { id_conversacion: conversationId });
                }
            } catch (e) { logger.error('Notification error:', e); }

            return { success: true };
        } catch (error) {
            logger.error('Error in removeGroupMember:', error);
            throw error;
        }
    }

    async updateGroupMemberRole(adminUserId, conversationId, targetUserId, newRole) {
        try {
            const pool = await getConnection();
            await this._verifyGroupAdmin(pool, conversationId, adminUserId);
            
            await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('userId', sql.Numeric(10, 0), targetUserId)
                .input('rol', sql.VarChar(20), newRole)
                .query(`UPDATE rel_chat_participante SET rol = @rol WHERE id_conversacion = @convId AND id_usuario = @userId`);
                
            const targetUser = await pool.request()
                .input('uid', sql.Numeric(10, 0), targetUserId)
                .query(`SELECT usuario FROM mae_usuario WHERE id_usuario = @uid`);
            
            await this._insertSystemMessage(pool, conversationId, adminUserId, `${targetUser.recordset[0]?.usuario || 'Usuario'} ahora es ${newRole}`);
            
            return { success: true };
        } catch (error) {
            logger.error('Error in updateGroupMemberRole:', error);
            throw error;
        }
    }

    async leaveGroup(userId, conversationId) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`UPDATE rel_chat_participante SET activo = 0, fecha_salida = GETUTCDATE() WHERE id_conversacion = @convId AND id_usuario = @userId`);

            const user = await pool.request()
                .input('uid', sql.Numeric(10, 0), userId)
                .query(`SELECT usuario FROM mae_usuario WHERE id_usuario = @uid`);

            await this._insertSystemMessage(pool, conversationId, userId, `${user.recordset[0]?.usuario || 'Usuario'} salió del grupo`);

            return { success: true };
        } catch (error) {
            logger.error('Error in leaveGroup:', error);
            throw error;
        }
    }

    async getConversationMembers(conversationId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .query(`
                    SELECT p.id_participante, p.id_usuario, p.id_usuario as id_entidad, p.rol, p.activo, p.fecha_union,
                           u.usuario as nombre, u.foto, u.correo_electronico as email
                    FROM rel_chat_participante p
                    JOIN mae_usuario u ON p.id_usuario = u.id_usuario
                    WHERE p.id_conversacion = @convId AND p.activo = 1
                    ORDER BY p.rol DESC, u.usuario ASC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getConversationMembers:', error);
            throw error;
        }
    }

    // ─── MENSAJES ──────────────────────────────────────────────

    async getMessages(userId, conversationId, page = 1, pageSize = 50) {
        try {
            const pool = await getConnection();
            
            // Verify user is participant
            await this._verifyParticipant(pool, conversationId, userId);

            // Get visibility floor for this user
            const partResult = await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`SELECT mensajes_ocultos_hasta, fecha_union FROM rel_chat_participante WHERE id_conversacion = @convId AND id_usuario = @userId AND activo = 1`);
            
            if (partResult.recordset.length === 0) {
                return []; // Not a participant
            }

            const { mensajes_ocultos_hasta, fecha_union } = partResult.recordset[0];

            const offset = (page - 1) * pageSize;
            const result = await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('userId', sql.Numeric(10, 0), userId)
                .input('ocultosHasta', sql.DateTime, mensajes_ocultos_hasta)
                .input('fechaUnion', sql.DateTime, fecha_union)
                .input('offset', sql.Int, offset)
                .input('pageSize', sql.Int, pageSize)
                .query(`
                    SELECT 
                        m.id_mensaje, m.id_conversacion, m.id_emisor, m.mensaje,
                        m.tipo_mensaje, m.fecha, m.editado, m.eliminado,
                        m.archivo_ruta, m.archivo_nombre,
                        u.usuario as nombre_emisor, u.foto as foto_emisor,
                        CASE WHEN EXISTS (SELECT 1 FROM rel_chat_lectura l WHERE l.id_mensaje = m.id_mensaje AND l.id_usuario = @userId) THEN 1 ELSE 0 END as leido_por_mi
                    FROM mae_chat_mensaje m
                    JOIN mae_usuario u ON m.id_emisor = u.id_usuario
                    WHERE m.id_conversacion = @convId
                    AND m.eliminado = 0
                    AND (m.fecha >= @fechaUnion AND (@ocultosHasta IS NULL OR m.fecha > @ocultosHasta))
                    ORDER BY m.fecha DESC
                    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
                `);

            // Reverse for chronological display
            return result.recordset.reverse();
        } catch (error) {
            logger.error('Error in getMessages:', error);
            throw error;
        }
    }

    async sendMessage(userId, conversationId, mensaje, file = null) {
        try {
            const pool = await getConnection();
            await this._verifyParticipant(pool, conversationId, userId);

            const request = pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('emisor', sql.Numeric(10, 0), userId)
                .input('mensaje', sql.NVarChar(sql.MAX), mensaje || null)
                .input('tipoMensaje', sql.VarChar(20), file ? 'ARCHIVO' : 'TEXTO')
                .input('archivoRuta', sql.NVarChar(500), file?.path || null)
                .input('archivoNombre', sql.NVarChar(255), file?.originalname || null);

            const result = await request.query(`
                INSERT INTO mae_chat_mensaje (id_conversacion, id_emisor, mensaje, tipo_mensaje, archivo_ruta, archivo_nombre, fecha)
                OUTPUT INSERTED.*
                VALUES (@convId, @emisor, @mensaje, @tipoMensaje, @archivoRuta, @archivoNombre, GETUTCDATE())
            `);

            const newMessage = result.recordset[0];

            // Update conversation's last message
            await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('msgId', sql.Numeric(18, 0), newMessage.id_mensaje)
                .query(`
                    UPDATE mae_chat_conversacion SET ultimo_mensaje_id = @msgId, ultimo_mensaje_fecha = GETUTCDATE() WHERE id_conversacion = @convId;
                    -- Resetear ocultar_si_vacio para todos los participantes que ahora tienen un mensaje nuevo
                    UPDATE rel_chat_participante SET ocultar_si_vacio = 0 WHERE id_conversacion = @convId;
                `);

            // Auto-mark as read by sender
            await pool.request()
                .input('msgId', sql.Numeric(18, 0), newMessage.id_mensaje)
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`INSERT INTO rel_chat_lectura (id_mensaje, id_usuario) VALUES (@msgId, @userId)`);

            // Get sender info for real-time emission
            const senderInfo = await pool.request()
                .input('uid', sql.Numeric(10, 0), userId)
                .query(`SELECT usuario, foto FROM mae_usuario WHERE id_usuario = @uid`);

            const messageForEmit = {
                ...newMessage,
                nombre_emisor: senderInfo.recordset[0]?.usuario,
                foto_emisor: senderInfo.recordset[0]?.foto
            };

            // Real-time: emit to all participants except sender
            const participants = await pool.request()
                .input('convId', sql.Numeric(10, 0), conversationId)
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`SELECT id_usuario FROM rel_chat_participante WHERE id_conversacion = @convId AND id_usuario <> @userId AND activo = 1`);

            // Fetch conversation info for notification
            const convInfo = await pool.request()
                .input('cid', sql.Numeric(10, 0), conversationId)
                .query(`SELECT tipo, nombre_grupo FROM mae_chat_conversacion WHERE id_conversacion = @cid`);
            const conversation = convInfo.recordset[0];

            for (const p of participants.recordset) {
                if (global.io) {
                    global.io.to(`user_${p.id_usuario}`).emit('nuevoChatMensaje', messageForEmit);
                }
            }

            // Web Notification (vía UNS Trigger para que aparezca en el Hub y barra lateral)
            // Se envía una sola vez con todos los destinatarios para que UNS gestione las reglas/filtros
            try {
                const notifyTitle = conversation?.tipo === 'GRUPO' ? `Grupo: ${conversation.nombre_grupo}` : `Mensaje de ${senderInfo.recordset[0]?.usuario}`;
                const notifyMsg = messageForEmit.tipo_mensaje === 'TEXTO' ? messageForEmit.mensaje : 'Ha enviado un archivo';
                
                await unsService.trigger('GCHAT_NUEVO_MENSAJE', {
                    id_usuario_accion: userId,
                    destinatarios_directos: participants.recordset.map(p => p.id_usuario),
                    titulo_notificacion: notifyTitle,
                    mensaje_notificacion: notifyMsg,
                    id_referencia: conversationId,
                    area: 'Chat'
                });
            } catch (notifyErr) {
                logger.error('Error sending message notification:', notifyErr);
            }

            return messageForEmit;
        } catch (error) {
            logger.error('Error in sendMessage:', error);
            throw error;
        }
    }

    async markAsRead(userId, conversationId) {
        try {
            const pool = await getConnection();
            // Mark all unread messages in conversation
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('convId', sql.Numeric(10, 0), conversationId)
                .query(`
                    INSERT INTO rel_chat_lectura (id_mensaje, id_usuario)
                    SELECT m.id_mensaje, @userId
                    FROM mae_chat_mensaje m
                    WHERE m.id_conversacion = @convId
                    AND m.id_emisor <> @userId
                    AND m.eliminado = 0
                    AND NOT EXISTS (SELECT 1 FROM rel_chat_lectura l WHERE l.id_mensaje = m.id_mensaje AND l.id_usuario = @userId)
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error in markAsRead:', error);
            throw error;
        }
    }

    async clearMessages(userId, conversationId) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('convId', sql.Numeric(10, 0), conversationId)
                .query(`
                    UPDATE rel_chat_participante 
                    SET mensajes_ocultos_hasta = GETUTCDATE(),
                        ocultar_si_vacio = 0
                    WHERE id_conversacion = @convId AND id_usuario = @userId
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error in clearMessages:', error);
            throw error;
        }
    }

    async ensureVisible(userId, conversationId) {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('convId', sql.Numeric(10, 0), conversationId)
                .query(`
                    UPDATE rel_chat_participante 
                    SET ocultar_si_vacio = 0 
                    WHERE id_conversacion = @convId AND id_usuario = @userId
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error in ensureVisible:', error);
            throw error;
        }
    }

    async deleteMessage(userId, messageId) {
        try {
            const pool = await getConnection();
            // Only allow deleting own messages
            await pool.request()
                .input('msgId', sql.Numeric(18, 0), messageId)
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`
                    UPDATE mae_chat_mensaje SET eliminado = 1 
                    WHERE id_mensaje = @msgId AND id_emisor = @userId
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error in deleteMessage:', error);
            throw error;
        }
    }

    async deleteConversation(userId, conversationId) {
        try {
            const pool = await getConnection();
            // Para "Eliminar", ocultamos la conversación hasta que llegue algo nuevo
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('convId', sql.Numeric(10, 0), conversationId)
                .query(`UPDATE rel_chat_participante SET mensajes_ocultos_hasta = GETUTCDATE(), ocultar_si_vacio = 1 WHERE id_conversacion = @convId AND id_usuario = @userId`);
            return { success: true };
        } catch (error) {
            logger.error('Error in deleteConversation:', error);
            throw error;
        }
    }

    // ─── CONTACTOS ─────────────────────────────────────────────

    async searchContacts(query, onlyUsers = false) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('query', sql.NVarChar(100), `%${query}%`)
                .query(`
                    -- Usuarios
                    SELECT u.id_usuario as id_entidad, u.usuario as nombre, u.foto, u.correo_electronico as email, 
                           u.mam_cargo as cargo, 'USER' as tipo_entidad
                    FROM mae_usuario u
                    WHERE (u.usuario LIKE @query OR u.correo_electronico LIKE @query)
                      AND u.habilitado = 'S'

                    ${onlyUsers ? '' : `
                    UNION ALL

                    -- Grupos
                    SELECT c.id_conversacion as id_entidad, c.nombre_grupo as nombre, c.foto_grupo as foto, 
                           c.descripcion as email, NULL as cargo, 'GROUP' as tipo_entidad
                    FROM mae_chat_conversacion c
                    WHERE c.tipo = 'GRUPO' AND c.activo = 1 AND c.nombre_grupo LIKE @query
                    `}

                    ORDER BY nombre ASC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in searchContacts:', error);
            throw error;
        }
    }

    async getFavoriteContacts(userId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .query(`
                    SELECT f.id_favorito, f.id_contacto as id_entidad, u.usuario as nombre, u.foto, 
                           u.correo_electronico as email, 'USER' as tipo_entidad, f.fecha_agregado
                    FROM rel_contacto_favorito f
                    JOIN mae_usuario u ON f.id_contacto = u.id_usuario
                    WHERE f.id_usuario = @userId AND u.habilitado = 'S' AND f.tipo_contacto = 'USER'
                    
                    UNION ALL
                    
                    SELECT f.id_favorito, f.id_contacto as id_entidad, c.nombre_grupo as nombre, c.foto_grupo as foto,
                           c.descripcion as email, 'GROUP' as tipo_entidad, f.fecha_agregado
                    FROM rel_contacto_favorito f
                    JOIN mae_chat_conversacion c ON f.id_contacto = c.id_conversacion
                    WHERE f.id_usuario = @userId AND c.activo = 1 AND f.tipo_contacto = 'GROUP'
                    
                    ORDER BY nombre ASC
                `);
            return result.recordset;
        } catch (error) {
            logger.error('Error in getFavoriteContacts:', error);
            throw error;
        }
    }

    async addFavoriteContact(userId, contactId, tipo = 'USER') {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('contactId', sql.Numeric(10, 0), contactId)
                .input('tipo', sql.VarChar(10), tipo)
                .query(`
                    IF NOT EXISTS (SELECT 1 FROM rel_contacto_favorito WHERE id_usuario = @userId AND id_contacto = @contactId AND tipo_contacto = @tipo)
                    INSERT INTO rel_contacto_favorito (id_usuario, id_contacto, tipo_contacto) VALUES (@userId, @contactId, @tipo)
                `);
            return { success: true };
        } catch (error) {
            logger.error('Error in addFavoriteContact:', error);
            throw error;
        }
    }

    async removeFavoriteContact(userId, contactId, tipo = 'USER') {
        try {
            const pool = await getConnection();
            await pool.request()
                .input('userId', sql.Numeric(10, 0), userId)
                .input('contactId', sql.Numeric(10, 0), contactId)
                .input('tipo', sql.VarChar(10), tipo)
                .query(`DELETE FROM rel_contacto_favorito WHERE id_usuario = @userId AND id_contacto = @contactId AND tipo_contacto = @tipo`);
            return { success: true };
        } catch (error) {
            logger.error('Error in removeFavoriteContact:', error);
            throw error;
        }
    }

    // ─── PERFIL ────────────────────────────────────────────────

    async getUserProfile(targetUserId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('userId', sql.Numeric(10, 0), targetUserId)
                .query(`
                    SELECT u.id_usuario, u.usuario as nombre, u.nombre_usuario, u.foto,
                           u.correo_electronico as email,
                           STRING_AGG(r.nombre_rol, ', ') as roles
                    FROM mae_usuario u
                    LEFT JOIN rel_usuario_rol ur ON u.id_usuario = ur.id_usuario
                    LEFT JOIN mae_rol r ON ur.id_rol = r.id_rol
                    WHERE u.id_usuario = @userId AND u.habilitado = 'S'
                    GROUP BY u.id_usuario, u.usuario, u.nombre_usuario, u.foto, u.correo_electronico
                `);
            return result.recordset[0] || null;
        } catch (error) {
            logger.error('Error in getUserProfile:', error);
            throw error;
        }
    }

    // ─── ADJUNTOS / DESCARGA ───────────────────────────────────

    async getAttachment(attachmentMsgId) {
        try {
            const pool = await getConnection();
            const result = await pool.request()
                .input('msgId', sql.Numeric(18, 0), attachmentMsgId)
                .query(`SELECT archivo_ruta, archivo_nombre FROM mae_chat_mensaje WHERE id_mensaje = @msgId AND tipo_mensaje = 'ARCHIVO'`);
            return result.recordset[0] || null;
        } catch (error) {
            logger.error('Error in getAttachment:', error);
            throw error;
        }
    }

    // ─── HELPERS PRIVADOS ──────────────────────────────────────

    async _verifyParticipant(pool, conversationId, userId) {
        const check = await pool.request()
            .input('convId', sql.Numeric(10, 0), conversationId)
            .input('userId', sql.Numeric(10, 0), userId)
            .query(`SELECT 1 FROM rel_chat_participante WHERE id_conversacion = @convId AND id_usuario = @userId AND activo = 1`);
        if (check.recordset.length === 0) {
            throw new Error('No eres participante de esta conversación');
        }
    }

    async _verifyGroupAdmin(pool, conversationId, userId) {
        const check = await pool.request()
            .input('convId', sql.Numeric(10, 0), conversationId)
            .input('userId', sql.Numeric(10, 0), userId)
            .query(`SELECT 1 FROM rel_chat_participante WHERE id_conversacion = @convId AND id_usuario = @userId AND activo = 1 AND rol = 'ADMIN'`);
        if (check.recordset.length === 0) {
            throw new Error('No tienes permisos de administrador en este grupo');
        }
    }

    async _insertSystemMessage(pool, conversationId, userId, text) {
        const result = await pool.request()
            .input('convId', sql.Numeric(10, 0), conversationId)
            .input('userId', sql.Numeric(10, 0), userId)
            .input('msg', sql.NVarChar(sql.MAX), text)
            .query(`
                INSERT INTO mae_chat_mensaje (id_conversacion, id_emisor, mensaje, tipo_mensaje, fecha)
                OUTPUT INSERTED.id_mensaje
                VALUES (@convId, @userId, @msg, 'SISTEMA', GETUTCDATE())
            `);
        const msgId = result.recordset[0].id_mensaje;

        await pool.request()
            .input('convId', sql.Numeric(10, 0), conversationId)
            .input('msgId', sql.Numeric(18, 0), msgId)
            .query(`UPDATE mae_chat_conversacion SET ultimo_mensaje_id = @msgId, ultimo_mensaje_fecha = GETDATE() WHERE id_conversacion = @convId`);
    }
}

export default new GeneralChatService();
