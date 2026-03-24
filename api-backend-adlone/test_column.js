import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function testUpdate() {
    try {
        const pool = await getConnection();
        console.log('--- Testing UPDATE on rel_chat_participante ---');
        
        // Try to update one record (or just a dummy update)
        const result = await pool.request()
            .query(`
                UPDATE TOP (1) rel_chat_participante 
                SET ocultar_si_vacio = ocultar_si_vacio 
                WHERE id_participante IS NOT NULL
            `);
        
        console.log('Update successful, rows affected:', result.rowsAffected);
        
        // Let's also check the actual columns again using a query that might fail if the column is missing
        const resultCheck = await pool.request()
            .query(`SELECT TOP 1 ocultar_si_vacio FROM rel_chat_participante`);
        console.log('SELECT successful, value:', resultCheck.recordset[0]?.ocultar_si_vacio);

        process.exit(0);
    } catch (err) {
        console.error('Update/Select failed:', err.message);
        process.exit(1);
    }
}

testUpdate();
