import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function checkChatSchema() {
    try {
        const pool = await getConnection();
        
        console.log('--- rel_chat_participante ---');
        try {
            const resultPart = await pool.request().query("SELECT TOP 1 * FROM rel_chat_participante");
            if (resultPart.recordset.length > 0) {
                console.log('Columns:', Object.keys(resultPart.recordset[0]).join(', '));
            } else {
                // If table is empty, query sys.columns
                const colsResult = await pool.request().query(`
                    SELECT name FROM sys.columns 
                    WHERE object_id = OBJECT_ID('rel_chat_participante')
                `);
                console.log('Columns (empty table):', colsResult.recordset.map(c => c.name).join(', '));
            }
        } catch (err) {
            console.error('Error checking rel_chat_participante:', err.message);
        }

        console.log('\n--- mae_chat_conversacion ---');
        try {
            const resultConv = await pool.request().query("SELECT TOP 1 * FROM mae_chat_conversacion");
            if (resultConv.recordset.length > 0) {
                console.log('Columns:', Object.keys(resultConv.recordset[0]).join(', '));
            } else {
                const colsResult = await pool.request().query(`
                    SELECT name FROM sys.columns 
                    WHERE object_id = OBJECT_ID('mae_chat_conversacion')
                `);
                console.log('Columns (empty table):', colsResult.recordset.map(c => c.name).join(', '));
            }
        } catch (err) {
            console.error('Error checking mae_chat_conversacion:', err.message);
        }

        console.log('\n--- mae_chat_mensaje ---');
        try {
            const resultMsg = await pool.request().query("SELECT TOP 1 * FROM mae_chat_mensaje");
            if (resultMsg.recordset.length > 0) {
                console.log('Columns:', Object.keys(resultMsg.recordset[0]).join(', '));
            } else {
                const colsResult = await pool.request().query(`
                    SELECT name FROM sys.columns 
                    WHERE object_id = OBJECT_ID('mae_chat_mensaje')
                `);
                console.log('Columns (empty table):', colsResult.recordset.map(c => c.name).join(', '));
            }
        } catch (err) {
            console.error('Error checking mae_chat_mensaje:', err.message);
        }

        process.exit(0);
    } catch (err) {
        console.error('Global error:', err);
        process.exit(1);
    }
}

checkChatSchema();
