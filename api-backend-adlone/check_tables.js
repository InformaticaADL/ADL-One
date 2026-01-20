import { getConnection } from './src/config/database.js';
import sql from 'mssql';

const checkTables = async () => {
    try {
        const pool = await getConnection();

        console.log('--- mae_centro ---');
        try {
            const res = await pool.request().query('SELECT TOP 1 * FROM mae_centro');
            console.log(res.recordset[0]);
        } catch (e) {
            console.log('Error querying mae_centro:', e.message);
        }

        console.log('--- mae_contacto ---');
        try {
            const res = await pool.request().query('SELECT TOP 1 * FROM mae_contacto');
            console.log(res.recordset[0]);
        } catch (e) {
            console.log('Error querying mae_contacto:', e.message);
            // Try plural
            try {
                console.log('--- mae_contactos ---');
                const res2 = await pool.request().query('SELECT TOP 1 * FROM mae_contactos');
                console.log(res2.recordset[0]);
            } catch (e2) {
                console.log('Error querying mae_contactos:', e2.message);
            }
        }

        console.log('--- mae_comuna ---');
        try {
            const res = await pool.request().query('SELECT TOP 1 * FROM mae_comuna');
            console.log(res.recordset[0]);
        } catch (e) {
            console.log('Error querying mae_comuna:', e.message);
        }

        console.log('--- mae_region ---');
        try {
            const res = await pool.request().query('SELECT TOP 1 * FROM mae_region');
            console.log(res.recordset[0]);
        } catch (e) {
            console.log('Error querying mae_region:', e.message);
        }

        await pool.close();
        process.exit(0);
    } catch (error) {
        console.error('Script error:', error);
        process.exit(1);
    }
};

checkTables();
