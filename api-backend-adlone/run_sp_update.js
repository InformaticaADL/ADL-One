
import { getConnection } from './src/config/database.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    try {
        const pool = await getConnection();
        const sqlPath = path.join('C:', 'Users', 'vremolcoy', 'Desktop', 'ADL ONE', 'db_scripts', 'modify_detail_sp.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing Detail SP Update...');
        await pool.request().query(sqlContent);
        console.log('✅ SP Updated Successfully.');

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

run();
