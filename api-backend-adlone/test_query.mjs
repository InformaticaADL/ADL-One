import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const config = {
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT) || 1433,
  database: process.env.DB_DATABASE || 'ADL_ONE_DB',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

async function check() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request()
                .input('id', sql.Numeric(10, 0), 8)
                .query(`
                    SELECT DISTINCT 
                           p.id_rol, r.nombre_rol,
                           p.id_usuario, u.nombre_usuario, u.usuario as nombre_real
                    FROM rel_solicitud_tipo_permiso p
                    LEFT JOIN mae_rol r ON p.id_rol = r.id_rol
                    LEFT JOIN mae_usuario u ON p.id_usuario = u.id_usuario
                    WHERE p.id_tipo = @id AND p.tipo_acceso = 'DESTINO_DERIVACION'
                `);
        console.table(result.recordset);
        await pool.close();
    } catch (err) {
        console.error(err);
    }
}
check();
