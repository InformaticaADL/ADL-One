import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';
import fs from 'fs';
import path from 'path';

const executeSql = async () => {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('❌ Please provide a path to an SQL file.');
        process.exit(1);
    }

    try {
        const fullPath = path.resolve(filePath);
        const sqlQuery = fs.readFileSync(fullPath, 'utf8');
        
        console.log(`Executing SQL from ${filePath}...`);
        const pool = await getConnection();
        
        // Split by GO if necessary, but mssql can handle multiple statements if written correctly
        // Here we'll try to execute it as one batch
        await pool.request().batch(sqlQuery);
        
        console.log('✅ SQL executed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error executing SQL:', error);
        process.exit(1);
    }
};

executeSql();
