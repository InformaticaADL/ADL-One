import { getConnection } from '../config/database.js';
import sql from 'mssql';
import unsService from './uns.service.js';
import logger from '../utils/logger.js';

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

export const equipoVencimientosService = {
    async notificarProximosVencimientos() {
        const pool = await getConnection();

        const req = pool.request();
        PERMISOS_DESTINO.forEach((p, i) => req.input(`p${i}`, sql.VarChar(50), p));
        const usuarios = (await req.query(`
            SELECT DISTINCT u.id_usuario
            FROM mae_usuario u
            JOIN rel_usuario_rol ur ON ur.id_usuario = u.id_usuario
            JOIN rel_rol_permiso rp ON rp.id_rol = ur.id_rol
            JOIN mae_permiso p ON p.id_permiso = rp.id_permiso
            WHERE u.habilitado = 'S' AND p.codigo IN (${PERMISOS_DESTINO.map((_, i) => `@p${i}`).join(', ')})
        `)).recordset.map((r) => Number(r.id_usuario));
        if (!usuarios.length) return { enviadas: 0 };

        // Solo equipos en uso: activos y operativos (no dados de baja ni fuera de servicio).
        const equipos = (await pool.request().query(`
            SELECT e.id_equipo, LTRIM(RTRIM(e.codigo)) AS codigo, e.nombre, e.sede,
                   CAST(e.Siguiente_verificacion AS DATE) AS siguiente,
                   DATEDIFF(day, CAST(GETDATE() AS DATE), CAST(e.Siguiente_verificacion AS DATE)) AS dias
            FROM mae_equipo e
            WHERE e.habilitado = 'S'
              AND ISNULL(e.Estado, '') LIKE '%operativo%'
              AND e.Siguiente_verificacion IS NOT NULL
              AND DATEDIFF(day, CAST(GETDATE() AS DATE), CAST(e.Siguiente_verificacion AS DATE)) BETWEEN 0 AND 30
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
            for (const idUsuario of usuarios) {
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
                    await unsService.sendWebNotification(idUsuario, titulo.slice(0, 200), mensaje, tramo.tipo, null, AREA_VENCIMIENTOS);
                    enviadas++;
                } catch (err) {
                    logger.error(`[Vencimientos] No se pudo notificar al usuario ${idUsuario}:`, err);
                }
            }
        }
        return { enviadas };
    },
};

export default equipoVencimientosService;
