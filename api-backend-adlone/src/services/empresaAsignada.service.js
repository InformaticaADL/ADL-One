// Servicio para gestionar las asignaciones usuario↔empresa↔área en
// PruebasInformatica.dbo.rel_usuario_empresa_asignada.
import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { wcFetch } from './solicitudesProxy.service.js';

// Rol de respaldo: a quién le llegan los avisos de una empresa que no tiene a nadie asignado
// (ver avisarAdlOne() en WebClientesV2, app/backend/src/solicitudes/solicitudesRoutes.js) — el
// MISMO id acá y allá, porque los dos lados tienen que coincidir en quién es "el grupo de
// respaldo". Si se cambia uno, hay que cambiar el otro.
const ROL_RESPALDO = 2; // "Área Comercial"

class EmpresaAsignadaService {
    // ¿Este usuario pertenece al grupo de respaldo (ve también lo que no tiene dueño asignado)?
    async esRespaldo(idUsuario) {
        const pool = await getConnection();
        const r = await pool.request()
            .input('u', sql.Numeric(10, 0), idUsuario)
            .input('r', sql.Int, ROL_RESPALDO)
            .query('SELECT 1 AS x FROM dbo.rel_usuario_rol WHERE id_usuario = @u AND id_rol = @r');
        return r.recordset.length > 0;
    }

    /**
     * Empresas (id_empresa) que puede atender un usuario para un área dada,
     * o todas las del usuario si area=null.
     */
    async misEmpresas(idUsuario, area = null) {
        const pool = await getConnection();
        const req = pool.request().input('u', sql.Numeric(10, 0), idUsuario);
        let where = 'WHERE id_usuario = @u';
        if (area) {
            req.input('a', sql.VarChar(10), area);
            where += ' AND area = @a';
        }
        const r = await req.query(
            `SELECT id_empresa, area FROM dbo.rel_usuario_empresa_asignada ${where}`
        );
        return r.recordset;
    }

    /**
     * Todas las asignaciones (para la pantalla de configuración),
     * con nombre de usuario y empresa resueltos.
     */
    async listarTodas() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT ruea.id, ruea.id_usuario, u.usuario AS nombre_usuario,
                   ruea.id_empresa, e.nombre_empresa, ruea.area, ruea.asignado_en
            FROM dbo.rel_usuario_empresa_asignada ruea
            JOIN dbo.mae_usuario u ON u.id_usuario = ruea.id_usuario
            LEFT JOIN dbo.mae_empresa e ON e.id_empresa = ruea.id_empresa
            ORDER BY u.usuario, e.nombre_empresa, ruea.area
        `);
        return r.recordset;
    }

    /**
     * Crea una asignación (idempotente: si ya existe, no hace nada).
     */
    async asignar({ idUsuario, idEmpresa, area, asignadoPor }) {
        const pool = await getConnection();
        await pool.request()
            .input('u',  sql.Numeric(10, 0), idUsuario)
            .input('e',  sql.Int, idEmpresa)
            .input('a',  sql.VarChar(10), area)
            .input('ap', sql.Numeric(10, 0), asignadoPor || null)
            .query(`
                IF NOT EXISTS (
                    SELECT 1 FROM dbo.rel_usuario_empresa_asignada
                    WHERE id_usuario = @u AND id_empresa = @e AND area = @a
                )
                    INSERT INTO dbo.rel_usuario_empresa_asignada (id_usuario, id_empresa, area, asignado_por)
                    VALUES (@u, @e, @a, @ap)
            `);
    }

    /**
     * Elimina una asignación por su id de fila.
     */
    async quitar(id) {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM dbo.rel_usuario_empresa_asignada WHERE id = @id');
    }

    /**
     * Catálogo de empresas para el selector de "Nueva asignación", acotado a las que
     * tienen al menos un cliente ACTIVO en WebClientesV2 -- sin esto el selector mezcla
     * las ~17 empresas que de verdad usan el portal con el resto del catálogo del LIMS
     * (miles de empresas que nunca van a generar una solicitud).
     */
    async empresasPortal() {
        const { status, body } = await wcFetch('/v1/solicitudes/empresas-portal');
        if (status !== 200) throw new Error(body?.error || 'Error al obtener empresas del portal.');
        const ids = Array.isArray(body) ? body.map(Number) : [];
        if (!ids.length) return [];
        const pool = await getConnection();
        const req = pool.request();
        ids.forEach((id, i) => req.input('e' + i, sql.Int, id));
        const r = await req.query(
            `SELECT id_empresa, nombre_empresa FROM dbo.mae_empresa
             WHERE habilitado = 'S' AND id_empresa IN (${ids.map((_, i) => '@e' + i).join(',')})
             ORDER BY nombre_empresa`);
        return r.recordset;
    }
}

export default new EmpresaAsignadaService();
