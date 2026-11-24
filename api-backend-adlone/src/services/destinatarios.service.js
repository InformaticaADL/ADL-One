// Reúne desde la base de datos lo que necesita notifications/destinatarios.js (roles, selecciones, silencios, acceso a la solicitud) y lo aplica a los
// destinatarios de un evento. Si algo falla al leer, NO se bloquea el aviso: se envía como antes y queda una advertencia en el log.
import sql from 'mssql';
import logger from '../utils/logger.js';
import { decidirDestinatarios, explicarDestinatarios, combinarAcceso } from '../notifications/destinatarios.js';

const num = (v) => Number(v);

// Una consulta con una lista de números ya validada (solo enteros) dentro del IN.
const lista = (ids) => ids.map(num).filter((n) => Number.isInteger(n) && n > 0).join(',') || '0';

/**
 * Silencios que alcanzan a un aviso: los de ese aviso, los de una familia que lo incluye («SOL_*») y los de todos los avisos (codigo_evento NULL).
 * En el patrón el guion bajo se escapa para que no valga «cualquier letra» (si no, «SOL_*» alcanzaría también a «SOLICITUD_…»).
 */
export async function silenciosDelAviso(pool, codigoEvento) {
    const filas = (await pool.request().input('c', sql.VarChar(50), codigoEvento).query(`
        SELECT id_usuario, codigo_evento, canal FROM cfg_notificacion_silencio
        WHERE codigo_evento = @c OR codigo_evento IS NULL
           OR (codigo_evento LIKE '%*' AND @c LIKE REPLACE(REPLACE(codigo_evento, '_', '[_]'), '*', '%'))`)).recordset;
    return filas.map((r) => ({ id_usuario: num(r.id_usuario), codigo_evento: r.codigo_evento, canal: r.canal }));
}

/** Roles y personas por los que un evento llega, según la configuración (administrador, reglas, destinatarios fijos) y los gestores del tipo de solicitud. */
async function origenesDelEvento(pool, codigoEvento, idTipo) {
    const rolesDelEvento = new Set();
    const directos = new Set();
    const q = async (consulta, ...params) => {
        const req = pool.request().input('c', sql.VarChar(50), codigoEvento);
        params.forEach(([n, t, v]) => req.input(n, t, v));
        return (await req.query(consulta)).recordset;
    };
    (await q(`SELECT c.id_rol, c.id_usuario FROM cfg_notificacion_config c JOIN mae_evento_notificacion e ON e.id_evento = c.id_evento WHERE e.codigo_evento = @c`))
        .forEach((r) => { if (r.id_rol) rolesDelEvento.add(num(r.id_rol)); if (r.id_usuario) directos.add(num(r.id_usuario)); });
    (await q(`SELECT id_rol_destino, id_usuario_destino FROM mae_notificacion_regla WHERE codigo_evento = @c AND ISNULL(estado, 1) = 1`))
        .forEach((r) => { if (r.id_rol_destino) rolesDelEvento.add(num(r.id_rol_destino)); if (r.id_usuario_destino) directos.add(num(r.id_usuario_destino)); });
    (await q(`SELECT r.id_rol, r.id_usuario FROM rel_evento_destinatario r JOIN mae_evento_notificacion e ON e.id_evento = r.id_evento WHERE e.codigo_evento = @c`))
        .forEach((r) => { if (r.id_rol) rolesDelEvento.add(num(r.id_rol)); if (r.id_usuario) directos.add(num(r.id_usuario)); });
    if (idTipo) {
        // Los gestores del tipo reciben el aviso por su rol (o nombrados), aunque no estén en la configuración del evento.
        (await q(`SELECT id_rol, id_usuario FROM rel_solicitud_tipo_permiso WHERE id_tipo = @t AND tipo_acceso IN ('GESTION', 'DESTINO_DERIVACION')`, ['t', sql.Numeric(10, 0), idTipo]))
            .forEach((r) => { if (r.id_rol) rolesDelEvento.add(num(r.id_rol)); if (r.id_usuario) directos.add(num(r.id_usuario)); });
    }
    return { rolesDelEvento, directos };
}

/** Quién tiene acceso a la solicitud: quien la creó, quien puede verla o gestionarla (por rol o nombrado) y a quien se la derivaron. null si el evento no es de una solicitud. */
async function accesoAlTipo(pool, idTipo, context) {
    if (!idTipo) return null;
    const acceso = new Set();
    const personas = (await pool.request().input('t', sql.Numeric(10, 0), idTipo).query(`
        SELECT DISTINCT x.id_usuario FROM (
            SELECT ur.id_usuario FROM rel_solicitud_tipo_permiso p JOIN rel_usuario_rol ur ON ur.id_rol = p.id_rol
              WHERE p.id_tipo = @t AND p.tipo_acceso IN ('VISTA', 'GESTION', 'DERIVACION', 'DESTINO_DERIVACION')
            UNION
            SELECT p.id_usuario FROM rel_solicitud_tipo_permiso p
              WHERE p.id_tipo = @t AND p.id_usuario IS NOT NULL AND p.tipo_acceso IN ('VISTA', 'GESTION', 'DERIVACION', 'DESTINO_DERIVACION')
        ) x`)).recordset;
    personas.forEach((r) => acceso.add(num(r.id_usuario)));
    [context.id_solicitante, context.id_usuario_propietario].map(num).filter(Boolean).forEach((u) => acceso.add(u));
    const idSolicitud = num(context.id_solicitud || 0);
    if (idSolicitud) {
        const der = (await pool.request().input('s', sql.Numeric(10, 0), idSolicitud).query(`
            SELECT d.usuario_destino AS id_usuario FROM mae_solicitud_derivacion d WHERE d.id_solicitud = @s AND d.usuario_destino IS NOT NULL
            UNION
            SELECT ur.id_usuario FROM mae_solicitud_derivacion d JOIN rel_usuario_rol ur ON ur.id_rol = d.id_rol_destino WHERE d.id_solicitud = @s`)).recordset;
        der.forEach((r) => acceso.add(num(r.id_usuario)));
    }
    return acceso;
}

/** Permisos que declara un aviso (basta uno) y las personas que tienen alguno por sus roles. null si el aviso no declara permisos (sin techo por permiso). */
async function accesoPorPermiso(pool, codigoEvento) {
    const permisos = (await pool.request().input('c', sql.VarChar(50), codigoEvento).query('SELECT permiso FROM cfg_evento_permiso WHERE codigo_evento = @c')).recordset.map((r) => r.permiso);
    if (!permisos.length) return null;
    const req = pool.request();
    const nombres = permisos.map((p, i) => { req.input(`p${i}`, sql.VarChar(100), p); return `@p${i}`; });
    // Igual que el inicio de sesión: usuario → roles → permisos del rol.
    const personas = (await req.query(`
        SELECT DISTINCT ur.id_usuario FROM rel_usuario_rol ur
        JOIN rel_rol_permiso rp ON rp.id_rol = ur.id_rol
        JOIN mae_permiso p ON p.id_permiso = rp.id_permiso
        WHERE p.codigo IN (${nombres.join(',')})`)).recordset;
    return { permisos, personas: new Set(personas.map((r) => num(r.id_usuario))) };
}

/** Todo lo que decidirDestinatarios necesita, leído de la base, para un evento y un conjunto de personas candidatas. */
async function reunirEntrada(pool, codigoEvento, context, destinatarios) {
    const idTipo = num(context.id_tipo || 0) || null;
    const ids = [...destinatarios.keys()];
    const { rolesDelEvento, directos } = await origenesDelEvento(pool, codigoEvento, idTipo);
    const propietario = num(context.id_usuario_propietario || 0);
    if (propietario) directos.add(propietario);

    const rolesDe = new Map();
    (await pool.request().query(`SELECT id_usuario, id_rol FROM rel_usuario_rol WHERE id_usuario IN (${lista(ids)})`)).recordset
        .forEach((r) => { const u = num(r.id_usuario); rolesDe.set(u, [...(rolesDe.get(u) || []), num(r.id_rol)]); });

    const limites = new Map();
    (await pool.request().input('c', sql.VarChar(50), codigoEvento).query(`SELECT id_rol, id_usuario FROM cfg_notificacion_rol_limite WHERE codigo_evento = @c`)).recordset
        .forEach((r) => { const rol = num(r.id_rol); if (!limites.has(rol)) limites.set(rol, new Set()); limites.get(rol).add(num(r.id_usuario)); });

    const silencios = (await silenciosDelAviso(pool, codigoEvento)).map((r) => ({ id_usuario: r.id_usuario, canal: r.canal }));

    const porPermiso = await accesoPorPermiso(pool, codigoEvento);
    const acceso = combinarAcceso(await accesoAlTipo(pool, idTipo, context), porPermiso ? porPermiso.personas : null);
    return { destinatarios, rolesDe, rolesDelEvento, directos, limites, acceso, silencios };
}

export const destinatariosService = {
    /**
     * Aplica el techo de acceso, la selección dentro del rol y los silencios a los destinatarios de un aviso (modifica el mapa en su lugar).
     * Devuelve los descartados con su motivo.
     */
    async aplicar(pool, codigoEvento, context, recipientsById) {
        if (!recipientsById || recipientsById.size === 0) return [];
        try {
            const entrada = await reunirEntrada(pool, codigoEvento, context, recipientsById);
            const { aceptados, descartados } = decidirDestinatarios(entrada);
            descartados.forEach((d) => recipientsById.delete(d.id_usuario));
            aceptados.forEach((a, uid) => recipientsById.set(uid, { ...recipientsById.get(uid), email: a.email, web: a.web }));
            if (descartados.length) {
                const porMotivo = descartados.reduce((m, d) => ({ ...m, [d.motivo]: (m[d.motivo] || 0) + 1 }), {});
                logger.info(`UNS: ${codigoEvento} — ${descartados.length} persona(s) no reciben el aviso: ${JSON.stringify(porMotivo)}`);
            }
            return descartados;
        } catch (e) {
            logger.warn(`UNS: no se pudieron aplicar los límites de avisos a ${codigoEvento} (${e.message}); se avisa como antes`);
            return [];
        }
    },

    /** Qué exige un aviso para recibirlo: permisos (basta uno) y, si es de solicitud, acceso al tipo. Para mostrarlo en el administrador. */
    async requisitos(pool, codigoEvento, idTipo = null) {
        const p = await accesoPorPermiso(pool, codigoEvento);
        let permisos = [];
        if (p) {
            const req = pool.request();
            const ph = p.permisos.map((c, i) => { req.input(`p${i}`, sql.VarChar(100), c); return `@p${i}`; });
            permisos = (await req.query(`SELECT codigo, nombre FROM mae_permiso WHERE codigo IN (${ph.join(',')}) ORDER BY codigo`)).recordset
                .map((r) => ({ codigo: r.codigo, nombre: r.nombre }));
            const conocidos = new Set(permisos.map((x) => x.codigo));
            p.permisos.filter((c) => !conocidos.has(c)).forEach((c) => permisos.push({ codigo: c, nombre: c }));
        }
        return { permisos, tipoDeSolicitud: !!idTipo };
    },

    /** Canales que ofrece un aviso según su configuración (correo y/o aviso web). */
    async canalesDelEvento(pool, codigoEvento) {
        const r = (await pool.request().input('c', sql.VarChar(50), codigoEvento).query(`
            SELECT MAX(CAST(x.email AS INT)) AS email, MAX(CAST(x.web AS INT)) AS web FROM (
                SELECT c.envia_email AS email, c.envia_web AS web FROM cfg_notificacion_config c JOIN mae_evento_notificacion e ON e.id_evento = c.id_evento WHERE e.codigo_evento = @c
                UNION ALL SELECT envia_email, envia_web FROM mae_notificacion_regla WHERE codigo_evento = @c AND ISNULL(estado, 1) = 1
            ) x`)).recordset[0] || {};
        return { email: !!r.email, web: !!r.web };
    },

    /** Personas con acceso a un tipo de solicitud (para marcar en el administrador quién puede ver y quién no). */
    async accesoDelTipo(pool, idTipo) {
        return [...(await accesoAlTipo(pool, num(idTipo), {}))];
    },

    /** Para el administrador: quién recibiría hoy este evento (y por qué canal, o por qué no). */
    async previsualizar(pool, codigoEvento, { idTipo = null } = {}) {
        const context = { id_tipo: idTipo || undefined };
        const { rolesDelEvento, directos } = await origenesDelEvento(pool, codigoEvento, idTipo ? num(idTipo) : null);
        // Canales configurados para el evento (si alguna fila los permite)
        const canales = (await pool.request().input('c', sql.VarChar(50), codigoEvento).query(`
            SELECT MAX(CAST(x.email AS INT)) AS email, MAX(CAST(x.web AS INT)) AS web FROM (
                SELECT c.envia_email AS email, c.envia_web AS web FROM cfg_notificacion_config c JOIN mae_evento_notificacion e ON e.id_evento = c.id_evento WHERE e.codigo_evento = @c
                UNION ALL SELECT envia_email, envia_web FROM mae_notificacion_regla WHERE codigo_evento = @c AND ISNULL(estado, 1) = 1
            ) x`)).recordset[0] || {};
        const email = !!canales.email; const web = !!canales.web;
        const roles = [...rolesDelEvento];
        const candidatos = (await pool.request().query(`
            SELECT DISTINCT u.id_usuario, u.nombre_usuario, u.usuario AS nombre_real FROM mae_usuario u
            WHERE u.habilitado = 'S' AND (u.id_usuario IN (${lista([...directos])})
               OR EXISTS (SELECT 1 FROM rel_usuario_rol ur WHERE ur.id_usuario = u.id_usuario AND ur.id_rol IN (${lista(roles)})))`)).recordset;
        const destinatarios = new Map(candidatos.map((c) => [num(c.id_usuario), { id_usuario: num(c.id_usuario), web, email }]));
        const entrada = await reunirEntrada(pool, codigoEvento, context, destinatarios);
        const nombres = new Map(candidatos.map((c) => [num(c.id_usuario), (c.nombre_real || c.nombre_usuario || '').trim()]));
        return explicarDestinatarios(entrada, nombres);
    },
};

export default destinatariosService;
