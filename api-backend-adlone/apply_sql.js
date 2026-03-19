import dotenv from 'dotenv';
dotenv.config();
import { getConnection } from './src/config/database.js';
import fs from 'fs';
import path from 'path';

const applySql = async (sqlFilePath) => {
    try {
        const fullPath = path.resolve(sqlFilePath);
        console.log(`Reading SQL from: ${fullPath}`);
        const sqlContent = fs.readFileSync(fullPath, 'utf8');

        // Split by GO or simple line breaks for cursor logic if needed, 
        // but mssql can handle most scripts if they don't have GO.
        // If GO is present, we must split.
        const statements = sqlContent.split(/\bGO\b/i);

        const pool = await getConnection();
        const transaction = pool.transaction();
        await transaction.begin();

        try {
            for (let stmt of statements) {
                const trimmedStmt = stmt.trim();
                if (trimmedStmt) {
                    const request = transaction.request();
                    try {
                        console.log(`Executing statement: ${trimmedStmt.substring(0, 100)}...`);
                        await request.query(trimmedStmt);
                    } catch (stmtErr) {
                        console.error(`❌ Error in statement: ${trimmedStmt.substring(0, 200)}`);
                        console.error(stmtErr);
                        throw stmtErr; 
                    }
                }
            }
            await transaction.commit();
            console.log('✅ SQL Script executed successfully.');
        } catch (err) {
            if (transaction._aborted) {
                console.warn('⚠️ Transaction was already aborted.');
            } else {
                await transaction.rollback();
            }
            throw err;
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error executing SQL:', error);
        process.exit(1);
    }
};

const filePath = process.argv[2] || '../db_scripts/expand_rbac.sql';
applySql(filePath);
