import dotenv from 'dotenv';
dotenv.config();

// Importar después de configurar dotenv para que las variables estén disponibles
const { getConnection } = await import('./src/config/database.js');
import sql from 'mssql';

async function addPermission() {
    try {
        console.log('Conectando a la base de datos...');
        const pool = await getConnection();
        
        const permissionCode = 'FI_CREAR_EMPRESA';
        
        // Verificar si ya existe
        const check = await pool.request()
            .input('code', sql.VarChar, permissionCode)
            .query('SELECT id_permiso FROM mae_permiso WHERE codigo = @code');
            
        if (check.recordset.length > 0) {
            console.log(`El permiso ${permissionCode} ya existe con ID: ${check.recordset[0].id_permiso}`);
            process.exit(0);
        }
        
        console.log(`Insertando permiso '${permissionCode}'...`);
        
        // Quitamos id_permiso del INSERT ya que es una columna IDENTITY
        await pool.request()
            .input('nombre', sql.VarChar, 'Crear Empresa de Servicio (Comercial)')
            .input('codigo', sql.VarChar, permissionCode)
            .input('modulo', sql.VarChar, 'Medio Ambiente')
            .input('submodulo', sql.VarChar, 'Ficha Ingreso')
            .input('tipo', sql.VarChar, 'ACCIÓN')
            .query(`
                INSERT INTO mae_permiso (nombre, codigo, modulo, submodulo, tipo, habilitado)
                VALUES (@nombre, @codigo, @modulo, @submodulo, @tipo, 1)
            `);
            
        console.log('¡Permiso creado exitosamente!');
        console.log('RECUERDA: Ahora debes asignar este permiso al rol correspondiente desde el panel de administración.');
        
        process.exit(0);
    } catch (error) {
        console.error('Error al insertar permiso:', error);
        process.exit(1);
    }
}

addPermission();
