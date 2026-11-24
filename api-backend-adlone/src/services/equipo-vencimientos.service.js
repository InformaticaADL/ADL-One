import { getConnection } from '../config/database.js';
import sql from 'mssql';
import unsService from './uns.service.js';
import logger from '../utils/logger.js';
import { excluirSinVencimiento } from '../utils/sinVencimientoSql.js';
import emailService from './email.service.js';
import destinatariosService from './destinatarios.service.js';

// Avisos de vencimiento de equipos para Gestión de Calidad, como notificaciones
// recientes (campana). Dos tramos: 30 y 7 días antes de la Siguiente revisión.
// Cada equipo se avisa una vez por tramo y por fecha de vencimiento: si se
// renueva (cambia la fecha), vuelve a avisarse cuando se acerque la nueva.

export const AREA_VENCIMIENTOS = 'Vencimientos de equipos';
const PERMISOS_DESTINO = ['GC_ACCESO', 'GC_EQUIPOS'];

const TRAMOS = [
    { id: 7, titulo: 'Equipos por vencer (7 días)', tipo: 'WARNING', min: 0, max: 7 },
    { id: 30, titulo: 'Equipos por vencer (30 días)', tipo: 'INFO', min: 8, max: 30 },
];

const fmtFecha = (d) => {
    const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
    const [y, m, dd] = s.split('-');
    return `${dd}/${m}/${y}`;
};

// Texto que identifica al equipo y su vencimiento dentro del mensaje; sirve
// también para saber si ya se avisó (se busca en las notificaciones previas).
const marca = (e) => `${e.codigo} · vence ${fmtFecha(e.siguiente)}`;

const enDias = (n) => (n === 0 ? 'hoy' : n === 1 ? 'mañana' : `en ${n} días`);

// Código del aviso en el administrador de correos (mae_evento_notificacion): ahí se elige quién lo recibe, con los mismos filtros que los demás avisos.
export const CODIGO_EVENTO_VENCIMIENTOS = 'EQUIPOS_POR_VENCER';

export const equipoVencimientosService = {
    /**
     * Quién recibe hoy los avisos de equipos por vencer, y por qué canal. Los destinatarios salen de la configuración del aviso (personas o roles) y pasan por
     * el techo de acceso, la selección dentro del rol y los silencios del administrador de correos. Si el aviso no tuviera destinatarios configurados, se
     * usa el criterio anterior (quien tenga GC_ACCESO o GC_EQUIPOS), para que nunca quede sin avisar a nadie por un descuido de configuración.
     */
    async resolverDestinatarios(pool) {
        const mapa = new Map();
        const sumar = (id, email, web) => {
            const u = mapa.get(Number(id)) || { id_usuario: Number(id), email: false, web: false };
            mapa.set(Number(id), { ...u, email: u.email || !!email, web: u.web || !!web });
        };
        const cfg = (await pool.request().input('c', sql.VarChar(50), CODIGO_EVENTO_VENCIMIENTOS).query(`
            SELECT c.id_rol, c.id_usuario, c.envia_email, c.envia_web FROM cfg_notificacion_config c
            JOIN mae_evento_notificacion e ON e.id_evento = c.id_evento
            WHERE e.codigo_evento = @c AND (c.id_rol IS NOT NULL OR c.id_usuario IS NOT NULL)`)).recordset;
        if (cfg.length) {
            for (const c of cfg) {
                if (c.id_usuario) {
                    const ok = (await pool.request().input('u', sql.Numeric(10, 0), c.id_usuario).query(`SELECT 1 AS x FROM mae_usuario WHERE id_usuario = @u AND habilitado = 'S'`)).recordset.length;
                    if (ok) sumar(c.id_usuario, c.envia_email, c.envia_web);
                }
                if (c.id_rol) {
                    (await pool.request().input('r', sql.Numeric(10, 0), c.id_rol).query(
                        `SELECT u.id_usuario FROM rel_usuario_rol ur JOIN mae_usuario u ON u.id_usuario = ur.id_usuario WHERE ur.id_rol = @r AND u.habilitado = 'S'`)).recordset
                        .forEach((r) => sumar(r.id_usuario, c.envia_email, c.envia_web));
                }
            }
        } else {
            const req = pool.request();
            PERMISOS_DESTINO.forEach((p, i) => req.input(`p${i}`, sql.VarChar(50), p));
            (await req.query(`
                SELECT DISTINCT u.id_usuario FROM mae_usuario u
                JOIN rel_usuario_rol ur ON ur.id_usuario = u.id_usuario
                JOIN rel_rol_permiso rp ON rp.id_rol = ur.id_rol
                JOIN mae_permiso p ON p.id_permiso = rp.id_permiso
                WHERE u.habilitado = 'S' AND p.codigo IN (${PERMISOS_DESTINO.map((_, i) => `@p${i}`).join(', ')})`)).recordset
                .forEach((r) => sumar(r.id_usuario, true, true));
        }
        await destinatariosService.aplicar(pool, CODIGO_EVENTO_VENCIMIENTOS, {}, mapa);
        if (mapa.size === 0) return [];
        const correos = new Map((await pool.request().query(`SELECT id_usuario, correo_electronico FROM mae_usuario WHERE id_usuario IN (${[...mapa.keys()].join(',')})`)).recordset
            .map((r) => [Number(r.id_usuario), String(r.correo_electronico || '').trim()]));
        return [...mapa.values()].map((r) => ({ id: r.id_usuario, correo: correos.get(r.id_usuario) || '', email: r.email, web: r.web }));
    },

    async notificarProximosVencimientos() {
        const pool = await getConnection();

        const usuarios = await this.resolverDestinatarios(pool);
        if (!usuarios.length) return { enviadas: 0 };

        // Solo equipos en uso: activos y operativos (no dados de baja ni fuera de servicio).
        // Los complementos (baterías, botellas…) no vencen: no se avisa de ellos.
        const sinVenc = await excluirSinVencimiento(pool, 'e');
        const equipos = (await pool.request().query(`
            SELECT e.id_equipo, LTRIM(RTRIM(e.codigo)) AS codigo, e.nombre, e.sede,
                   CAST(e.Siguiente_verificacion AS DATE) AS siguiente,
                   DATEDIFF(day, CAST(GETDATE() AS DATE), CAST(e.Siguiente_verificacion AS DATE)) AS dias
            FROM mae_equipo e
            WHERE e.habilitado = 'S'
              AND ISNULL(e.Estado, '') LIKE '%operativo%'
              AND e.Siguiente_verificacion IS NOT NULL
              AND DATEDIFF(day, CAST(GETDATE() AS DATE), CAST(e.Siguiente_verificacion AS DATE)) BETWEEN 0 AND 30${sinVenc}
            ORDER BY e.Siguiente_verificacion, e.codigo
        `)).recordset;
        if (!equipos.length) return { enviadas: 0 };

        // Avisos ya enviados (últimos 90 días alcanzan: el tramo más largo es 30).
        const previos = (await pool.request()
            .input('area', sql.VarChar(50), AREA_VENCIMIENTOS)
            .query(`
                SELECT id_usuario, titulo, mensaje FROM mae_notificacion
                WHERE area = @area AND fecha_creacion >= DATEADD(day, -90, GETUTCDATE())
            `)).recordset;

        let enviadas = 0;
        for (const tramo of TRAMOS) {
            const delTramo = equipos.filter((e) => e.dias >= tramo.min && e.dias <= tramo.max);
            if (!delTramo.length) continue;
            for (const { id: idUsuario, correo, email: porCorreo, web: porWeb } of usuarios) {
                const avisados = previos
                    .filter((n) => Number(n.id_usuario) === idUsuario && n.titulo?.startsWith(tramo.titulo))
                    .map((n) => n.mensaje || '');
                const nuevos = delTramo.filter((e) => !avisados.some((m) => m.includes(marca(e))));
                if (!nuevos.length) continue;

                const titulo = `${tramo.titulo}: ${nuevos.length === 1 ? nuevos[0].codigo : `${nuevos.length} equipos`}`;
                const mensaje = nuevos
                    .map((e) => `${marca(e)} (${enDias(e.dias)})${e.sede ? ` · Sede ${e.sede}` : ''}${e.nombre ? ` · ${String(e.nombre).trim()}` : ''}`)
                    .join('\n');
                try {
                    if (porWeb) {
                        await unsService.sendWebNotification(idUsuario, titulo.slice(0, 200), mensaje, tramo.tipo, null, AREA_VENCIMIENTOS);
                    } else {
                        // Sin aviso web, igual se deja el registro (ya leído) para no repetir el correo cada día: el servicio sabe qué avisó mirando esos registros.
                        await pool.request()
                            .input('u', sql.Numeric(10, 0), idUsuario).input('t', sql.VarChar(200), titulo.slice(0, 200)).input('m', sql.NVarChar(sql.MAX), mensaje)
                            .input('k', sql.VarChar(20), tramo.tipo).input('a', sql.VarChar(50), AREA_VENCIMIENTOS)
                            .query('INSERT INTO mae_notificacion (id_usuario, titulo, mensaje, tipo, id_referencia, leido, area, fecha_creacion) VALUES (@u, @t, @m, @k, NULL, 1, @a, GETUTCDATE())');
                    }
                    enviadas++;
                    // Correo solo si está activo para esa persona y tiene correo registrado. Si falla, el aviso web (o su registro) ya quedó.
                    if (porCorreo && correo) {
                        emailService.sendEquiposPorVencer({ to: correo, tramo: tramo.id, equipos: nuevos })
                            .catch((e) => logger.warn(`[Vencimientos] No se pudo enviar el correo a ${correo}: ${e.message}`));
                    }
                } catch (err) {
                    logger.error(`[Vencimientos] No se pudo notificar al usuario ${idUsuario}:`, err);
                }
            }
        }
        return { enviadas };
    },
};

export default equipoVencimientosService;
