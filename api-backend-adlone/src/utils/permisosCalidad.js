import sql from 'mssql';
import { permisoRegistrado } from '../middlewares/permisoConRespaldo.js';
import { areasPorRoles } from './areasRoles.js';

// Acciones de Gestión de Calidad que se asignan por permiso (Configurar rol / permisos), no por el nombre del rol.
// Los crea la migración add_permisos_gestion_calidad.sql y se los da a los roles que hoy hacen cada acción.
export const PERMISOS_GC = {
    FIRMA_CALIDAD: 'GC_PM_FIRMA_CALIDAD', // Puesta en Marcha: firmar por Gestión de Calidad
    FIRMA_TECNICA: 'GC_PM_FIRMA_TECNICA', // Puesta en Marcha: firmar por el Área Técnica de Medio Ambiente
    EDITAR_PM: 'GC_PM_EDITAR',            // Puesta en Marcha: editar, documentos de una aprobada y registro interno
    VOBO_CAUDAL: 'GC_CAUDAL_VOBO',        // Verificación de caudal: dar el V°B°
    CREAR_TIPO: 'GC_CREAR_TIPO',          // Nuevo Equipo: registrar un tipo de equipo nuevo (define la sigla)
    SEGUIMIENTO_FIRMAS: 'GC_SEGUIMIENTO_FIRMAS', // Solicitudes: seguimiento de todas las fichas enviadas a firmar
    AUDITORIAS: 'GC_AUDITORIAS',                  // Calidad: ver auditorías, acciones correctivas y listado de quejas
    AUDITORIAS_EDITAR: 'GC_AUDITORIAS_EDITAR',    // Calidad: crear y editar programa, auditorías, informes y acciones
};

// Mientras la migración no cree un permiso, rige la regla anterior por nombre de rol, para no dejar a nadie afuera.
const RESPALDO = {
    [PERMISOS_GC.FIRMA_CALIDAD]: (a) => a.CALIDAD,
    [PERMISOS_GC.FIRMA_TECNICA]: (a) => a.TECNICA,
    [PERMISOS_GC.EDITAR_PM]: (a) => a.CALIDAD,
    [PERMISOS_GC.VOBO_CAUDAL]: (a) => a.CALIDAD || a.TECNICA,
    [PERMISOS_GC.CREAR_TIPO]: (a) => a.CALIDAD,
    [PERMISOS_GC.SEGUIMIENTO_FIRMAS]: (a) => a.CALIDAD,
    [PERMISOS_GC.AUDITORIAS]: (a) => a.CALIDAD,
    [PERMISOS_GC.AUDITORIAS_EDITAR]: (a) => a.CALIDAD,
};

/**
 * Permisos del usuario leídos de la base (igual que al iniciar sesión), así un cambio en Configurar rol / permisos
 * rige de inmediato en estas acciones. `poolOTx` puede ser un pool o una transacción.
 */
const permisosDe = async (poolOTx, idUsuario) => {
    const req = poolOTx.request ? poolOTx.request() : new sql.Request(poolOTx);
    const r = await req.input('u', sql.Numeric(10, 0), Number(idUsuario)).query(`
        SELECT DISTINCT p.codigo
        FROM mae_permiso p
        JOIN rel_rol_permiso rp ON rp.id_permiso = p.id_permiso
        JOIN rel_usuario_rol ur ON ur.id_rol = rp.id_rol
        WHERE ur.id_usuario = @u`);
    return r.recordset.map((x) => x.codigo);
};

const rolesDe = async (poolOTx, idUsuario) => {
    const req = poolOTx.request ? poolOTx.request() : new sql.Request(poolOTx);
    return (await req.input('u', sql.Numeric(10, 0), Number(idUsuario)).query(`
        SELECT r.nombre_rol FROM rel_usuario_rol ur JOIN mae_rol r ON r.id_rol = ur.id_rol WHERE ur.id_usuario = @u`)).recordset.map((x) => x.nombre_rol);
};

/** ¿Puede el usuario hacer esa acción? → { codigo: boolean } para cada código pedido. */
export const permisosGc = async (poolOTx, idUsuario, codigos) => {
    const out = Object.fromEntries(codigos.map((c) => [c, false]));
    if (!idUsuario) return out;
    const propios = new Set(await permisosDe(poolOTx, idUsuario));
    let areas = null;
    for (const c of codigos) {
        if (propios.has(c)) { out[c] = true; continue; }
        if (await permisoRegistrado(c)) continue;
        areas ??= areasPorRoles(await rolesDe(poolOTx, idUsuario));
        out[c] = !!RESPALDO[c]?.(areas);
    }
    return out;
};

export const puedeGc = async (poolOTx, idUsuario, codigo) => (await permisosGc(poolOTx, idUsuario, [codigo]))[codigo];
