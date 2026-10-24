// Servicio para gestionar la lista global de verificadores (jefatura) en
// PruebasInformatica.dbo.rel_usuario_verificador_solicitudes. A diferencia de
// rel_usuario_empresa_asignada, no tiene empresa ni área: es una sola lista
// que se entera de TODAS las solicitudes de clientes (WebClientesV2).
import sql from 'mssql';
import { getConnection } from '../config/database.js';

class VerificadorSolicitudesService {
    /**
     * Todos los verificadores (para la pantalla de configuración),
     * con nombre de usuario resuelto.
     */
    async listar() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            SELECT rvs.id, rvs.id_usuario, u.usuario AS nombre_usuario, rvs.asignado_en
            FROM dbo.rel_usuario_verificador_solicitudes rvs
            JOIN dbo.mae_usuario u ON u.id_usuario = rvs.id_usuario
            ORDER BY u.usuario
        `);
        return r.recordset;
    }

    /**
     * Agrega un verificador (idempotente: si ya existe, no hace nada).
     */
    async agregar({ idUsuario, asignadoPor }) {
        const pool = await getConnection();
        await pool.request()
            .input('u',  sql.Numeric(10, 0), idUsuario)
            .input('ap', sql.Numeric(10, 0), asignadoPor || null)
            .query(`
                IF NOT EXISTS (SELECT 1 FROM dbo.rel_usuario_verificador_solicitudes WHERE id_usuario = @u)
                    INSERT INTO dbo.rel_usuario_verificador_solicitudes (id_usuario, asignado_por)
                    VALUES (@u, @ap)
            `);
    }

    /**
     * ¿Este usuario es verificador (jefatura en copia)? Los verificadores ven TODAS las solicitudes de clientes.
     */
    async esVerificador(idUsuario) {
        const pool = await getConnection();
        const r = await pool.request()
            .input('u', sql.Numeric(10, 0), idUsuario)
            .query('SELECT 1 AS x FROM dbo.rel_usuario_verificador_solicitudes WHERE id_usuario = @u');
        return r.recordset.length > 0;
    }

    /**
     * Quita un verificador por su id de fila.
     */
    async quitar(id) {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM dbo.rel_usuario_verificador_solicitudes WHERE id = @id');
    }
}

export default new VerificadorSolicitudesService();
