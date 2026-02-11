import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';

const findUsers = async (pattern) => {
    try {
        const pool = await getConnection();
        const result = await pool.request()
            .input('pattern', `%${pattern}%`)
            .query(`SELECT id_usuario, nombre_usuario, usuario FROM mae_usuario WHERE usuario LIKE @pattern OR nombre_usuario LIKE @pattern`);

        console.log(`Users matching ${pattern}:`);
        console.log(result.recordset);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

const pattern = process.argv[2] || 'Flores';
findUsers(pattern);
