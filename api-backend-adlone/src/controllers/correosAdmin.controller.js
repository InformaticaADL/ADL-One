// Administrador de correos: quién recibe cada aviso. Complementa la pantalla de Notificaciones con tres cosas:
//  · «Quién lo recibe hoy» de un evento (cada persona con su canal o el motivo por el que no recibe),
//  · la selección de personas dentro de un rol (de 10 personas del rol, solo estas 3),
//  · los silencios por persona y canal (puede ver la solicitud, pero no quiere correos).
// Todo exige el permiso INF_NOTIF (ver routes/notification.routes.js).
import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import auditService from '../services/audit.service.js';
import destinatariosService from '../services/destinatarios.service.js';

const idsValidos = (v) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : null);
const codigoValido = (c) => typeof c === 'string' && /^[A-Z0-9_]{3,50}$/.test(c);
const actor = (req) => Number(req.user?.id || req.user?.id_usuario || 0) || null;
const falla = (res, error, mensaje) => { logger.error(`${mensaje}:`, error); return res.status(500).json({ message: mensaje }); };

const auditar = (req, evento, descripcion, datos) => auditService.log({
    usuario_id: actor(req) || 0, area_key: 'it', modulo_nombre: 'Notificaciones', evento_tipo: evento,
    entidad_nombre: 'cfg_notificacion', entidad_id: String(datos.codigo_evento || datos.id_usuario || ''),
    descripcion_humana: `${req.user?.nombre_usuario || `ID:${actor(req)}`} ${descripcion}`, datos_nuevos: datos, severidad: 1,
});

/** GET /events/catalogo → todos los avisos (también los ocultos en el centro de notificaciones) y los tipos de solicitud, para armar la pantalla. */
export const getCatalogoAdmin = async (_req, res) => {
    try {
        const pool = await getConnection();
        const eventos = (await pool.request().query(`
            SELECT e.codigo_evento AS codigo, e.descripcion, e.es_transaccional, ISNULL(e.oculto_en_hub, 0) AS oculto, m.nombre AS modulo
            FROM mae_evento_notificacion e
            LEFT JOIN mae_notificacion_funcionalidad f ON f.id_funcionalidad = e.id_funcionalidad
            LEFT JOIN mae_notificacion_modulo m ON m.id_modulo = f.id_modulo
            ORDER BY m.nombre, e.codigo_evento`)).recordset
            .map((e) => ({ codigo: e.codigo, descripcion: e.descripcion, es_transaccional: !!e.es_transaccional, oculto: !!e.oculto, modulo: e.modulo || 'Otros' }));
        const tipos = (await pool.request().query(`SELECT id_tipo, nombre FROM mae_solicitud_tipo WHERE estado = 1 ORDER BY nombre`)).recordset
            .map((t) => ({ id_tipo: Number(t.id_tipo), nombre: t.nombre }));
        res.json({ eventos, tipos });
    } catch (e) { falla(res, e, 'No se pudo leer el catálogo de avisos'); }
};

/** GET /events/:codigo/destinatarios?idTipo= → quién lo recibiría hoy. */
export const getDestinatarios = async (req, res) => {
    const { codigo } = req.params;
    if (!codigoValido(codigo)) return res.status(400).json({ message: 'Código de evento inválido' });
    try {
        const pool = await getConnection();
        const personas = await destinatariosService.previsualizar(pool, codigo, { idTipo: Number(req.query.idTipo) || null });
        const silencios = (await pool.request().input('c', sql.VarChar(50), codigo)
            .query('SELECT id_usuario, codigo_evento, canal FROM cfg_notificacion_silencio WHERE codigo_evento = @c OR codigo_evento IS NULL')).recordset
            .map((s) => ({ id_usuario: Number(s.id_usuario), codigo_evento: s.codigo_evento, canal: s.canal }));
        const canales = await destinatariosService.canalesDelEvento(pool, codigo);
        res.json({ codigo, personas, silencios, canales });
    } catch (e) { falla(res, e, 'No se pudo calcular quién recibe este aviso'); }
};

/** GET /events/:codigo/roles?idTipo= → por cada rol del evento: sus personas, cuáles tienen acceso y cuáles están elegidas (limitado o no). */
export const getRolesDelEvento = async (req, res) => {
    const { codigo } = req.params;
    if (!codigoValido(codigo)) return res.status(400).json({ message: 'Código de evento inválido' });
    try {
        const pool = await getConnection();
        const idTipo = Number(req.query.idTipo) || null;
        const roles = (await pool.request().input('c', sql.VarChar(50), codigo).query(`
            SELECT DISTINCT r.id_rol, r.nombre_rol FROM mae_rol r WHERE r.id_rol IN (
                SELECT c.id_rol FROM cfg_notificacion_config c JOIN mae_evento_notificacion e ON e.id_evento = c.id_evento WHERE e.codigo_evento = @c AND c.id_rol IS NOT NULL
                UNION SELECT id_rol_destino FROM mae_notificacion_regla WHERE codigo_evento = @c AND ISNULL(estado, 1) = 1 AND id_rol_destino IS NOT NULL
                UNION SELECT r2.id_rol FROM rel_evento_destinatario r2 JOIN mae_evento_notificacion e2 ON e2.id_evento = r2.id_evento WHERE e2.codigo_evento = @c AND r2.id_rol IS NOT NULL
                ${idTipo ? `UNION SELECT p.id_rol FROM rel_solicitud_tipo_permiso p WHERE p.id_tipo = ${idTipo} AND p.tipo_acceso IN ('GESTION', 'DESTINO_DERIVACION') AND p.id_rol IS NOT NULL` : ''}
            ) ORDER BY r.nombre_rol`)).recordset;
        const limites = (await pool.request().input('c', sql.VarChar(50), codigo).query(`SELECT id_rol, id_usuario FROM cfg_notificacion_rol_limite WHERE codigo_evento = @c`)).recordset;
        const acceso = idTipo ? new Set((await destinatariosService.accesoDelTipo(pool, idTipo)).map(Number)) : null;
        const salida = [];
        for (const r of roles) {
            const miembros = (await pool.request().input('r', sql.Numeric(10, 0), r.id_rol).query(`
                SELECT u.id_usuario, u.nombre_usuario, u.usuario AS nombre_real FROM rel_usuario_rol ur JOIN mae_usuario u ON u.id_usuario = ur.id_usuario
                WHERE ur.id_rol = @r AND u.habilitado = 'S' ORDER BY u.usuario`)).recordset;
            const elegidos = limites.filter((l) => Number(l.id_rol) === Number(r.id_rol)).map((l) => Number(l.id_usuario));
            salida.push({
                id_rol: Number(r.id_rol), nombre_rol: r.nombre_rol, limitado: elegidos.length > 0,
                miembros: miembros.map((m) => ({ id_usuario: Number(m.id_usuario), nombre: (m.nombre_real || m.nombre_usuario || '').trim(), tiene_acceso: acceso ? acceso.has(Number(m.id_usuario)) : null, elegido: elegidos.includes(Number(m.id_usuario)) })),
            });
        }
        res.json({ codigo, roles: salida });
    } catch (e) { falla(res, e, 'No se pudieron leer los roles del evento'); }
};

/** PUT /events/:codigo/limites { id_rol, usuarios: [ids] } → «de este rol, solo estas personas». Lista vacía = quitar la limitación (entra todo el rol). */
export const putLimiteDeRol = async (req, res) => {
    const { codigo } = req.params;
    const idRol = Number(req.body?.id_rol);
    const usuarios = idsValidos(req.body?.usuarios);
    if (!codigoValido(codigo) || !Number.isInteger(idRol) || idRol <= 0 || usuarios === null) return res.status(400).json({ message: 'Datos inválidos' });
    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();
        await new sql.Request(tx).input('c', sql.VarChar(50), codigo).input('r', sql.Numeric(10, 0), idRol)
            .query('DELETE FROM cfg_notificacion_rol_limite WHERE codigo_evento = @c AND id_rol = @r');
        if (usuarios.length) {
            // Solo personas que de verdad están en el rol y habilitadas: no se puede «elegir» a quien no pertenece.
            const validos = (await new sql.Request(tx).input('r', sql.Numeric(10, 0), idRol).query(
                `SELECT u.id_usuario FROM rel_usuario_rol ur JOIN mae_usuario u ON u.id_usuario = ur.id_usuario WHERE ur.id_rol = @r AND u.habilitado = 'S' AND u.id_usuario IN (${usuarios.join(',')})`)).recordset.map((x) => Number(x.id_usuario));
            for (const u of validos) {
                await new sql.Request(tx).input('c', sql.VarChar(50), codigo).input('r', sql.Numeric(10, 0), idRol).input('u', sql.Numeric(10, 0), u).input('by', sql.Numeric(10, 0), actor(req))
                    .query('INSERT INTO cfg_notificacion_rol_limite (codigo_evento, id_rol, id_usuario, creado_por) VALUES (@c, @r, @u, @by)');
            }
        }
        await tx.commit();
        auditar(req, 'NOTIFICATION_ROLE_LIMIT', usuarios.length ? `limitó el rol ${idRol} a ${usuarios.length} persona(s) en el aviso ${codigo}` : `quitó la limitación del rol ${idRol} en el aviso ${codigo}`, { codigo_evento: codigo, id_rol: idRol, usuarios });
        res.json({ success: true });
    } catch (e) { try { await tx.rollback(); } catch { /* ya cerrada */ } falla(res, e, 'No se pudo guardar la selección del rol'); }
};

/** GET /personas/:idUsuario → silencios de la persona y, evento por evento, si recibiría el aviso y por qué canal. */
export const getVistaPorPersona = async (req, res) => {
    const idUsuario = Number(req.params.idUsuario);
    if (!Number.isInteger(idUsuario) || idUsuario <= 0) return res.status(400).json({ message: 'Persona inválida' });
    try {
        const pool = await getConnection();
        // Todos los eventos, también los ocultos en el centro de notificaciones (p. ej. los de solicitudes de equipo): si le llegan a la persona, tienen que verse.
        const eventos = (await pool.request().query(`SELECT codigo_evento, descripcion FROM mae_evento_notificacion ORDER BY codigo_evento`)).recordset;
        const silencios = (await pool.request().input('u', sql.Numeric(10, 0), idUsuario).query(`SELECT codigo_evento, canal FROM cfg_notificacion_silencio WHERE id_usuario = @u`)).recordset;
        const filas = [];
        for (const ev of eventos) {
            const personas = await destinatariosService.previsualizar(pool, ev.codigo_evento);
            const yo = personas.find((p) => Number(p.id_usuario) === idUsuario);
            if (!yo) continue; // el aviso no le llega por ningún camino
            filas.push({ codigo_evento: ev.codigo_evento, descripcion: ev.descripcion, recibe: yo.recibe, email: yo.email, web: yo.web, motivo: yo.motivo });
        }
        res.json({ id_usuario: idUsuario, silencios, eventos: filas });
    } catch (e) { falla(res, e, 'No se pudo armar la vista por persona'); }
};

/** PUT /silencios { id_usuario, codigo_evento|null, silenciar_email, silenciar_web } → fija los silencios de la persona en ese evento (null = todos los eventos). */
export const putSilencio = async (req, res) => {
    const idUsuario = Number(req.body?.id_usuario);
    const codigo = req.body?.codigo_evento ?? null;
    if (!Number.isInteger(idUsuario) || idUsuario <= 0 || (codigo !== null && !codigoValido(codigo))) return res.status(400).json({ message: 'Datos inválidos' });
    const email = !!req.body?.silenciar_email;
    const web = !!req.body?.silenciar_web;
    const pool = await getConnection();
    const tx = new sql.Transaction(pool);
    try {
        await tx.begin();
        await new sql.Request(tx).input('u', sql.Numeric(10, 0), idUsuario).input('c', sql.VarChar(50), codigo)
            .query('DELETE FROM cfg_notificacion_silencio WHERE id_usuario = @u AND ((@c IS NULL AND codigo_evento IS NULL) OR codigo_evento = @c)');
        const canal = email && web ? 'TODOS' : email ? 'EMAIL' : web ? 'WEB' : null;
        if (canal) {
            await new sql.Request(tx).input('u', sql.Numeric(10, 0), idUsuario).input('c', sql.VarChar(50), codigo).input('k', sql.VarChar(10), canal).input('by', sql.Numeric(10, 0), actor(req))
                .query('INSERT INTO cfg_notificacion_silencio (id_usuario, codigo_evento, canal, creado_por) VALUES (@u, @c, @k, @by)');
        }
        await tx.commit();
        auditar(req, 'NOTIFICATION_MUTE', canal ? `silenció (${canal}) los avisos${codigo ? ` ${codigo}` : ' de todos los eventos'} de la persona ${idUsuario}` : `quitó el silencio de la persona ${idUsuario}${codigo ? ` en ${codigo}` : ''}`, { id_usuario: idUsuario, codigo_evento: codigo, canal });
        res.json({ success: true, canal });
    } catch (e) { try { await tx.rollback(); } catch { /* ya cerrada */ } falla(res, e, 'No se pudo guardar el silencio'); }
};
