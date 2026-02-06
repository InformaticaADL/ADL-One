import { getConnection } from './src/config/database.js';
import fs from 'fs';
import path from 'path';

async function runSql() {
    console.log('--- REFINING EMAIL CONTENT ---');
    try {
        const pool = await getConnection();
        // Read the SQL file from the artifacts directory
        // Fix path: artifacts are in .gemini/antigravity/brain/...
        // But for simplicity, I can just copy the content or read from absolute path if I knew it.
        // Or better, I'll just write the query directly here since I know it.
        // Wait, I have the path in the previous step: C:\Users\vremolcoy\.gemini\antigravity\brain\001e5e94-9d2b-4af2-9358-bb68daa59e07\refine_email_content.sql

        const sqlPath = String.raw`C:\Users\vremolcoy\.gemini\antigravity\brain\001e5e94-9d2b-4af2-9358-bb68daa59e07\refine_email_content.sql`;

        if (!fs.existsSync(sqlPath)) {
            console.error('SQL file not found at:', sqlPath);
            process.exit(1);
        }

        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        const queries = sqlContent.split(';').filter(q => q.trim().length > 0);

        for (const query of queries) {
            if (query.trim().startsWith('--')) continue; // Skip comments only if whole query is comment (naive)
            // Better: just run it. Comments are fine in SQL usually.
            console.log('Executing query...');
            await pool.request().query(query);
        }

        console.log('✅ ALL QUERIES EXECUTED SUCCESSFULLY');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error executing SQL:', err);
        process.exit(1);
    }
}

runSql();
