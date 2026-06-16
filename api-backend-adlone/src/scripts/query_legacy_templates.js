import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import { getConnection, closeConnection } from '../config/database.js';

async function queryLegacyTemplates() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT id_evento, codigo_evento, cuerpo_template_html
            FROM mae_evento_notificacion 
            WHERE cuerpo_template_html LIKE '%<!DOCTYPE html>%' 
               OR cuerpo_template_html LIKE '%<table class="main-card"%'
        `);
        fs.writeFileSync('db_legacy_templates.json', JSON.stringify(result.recordset, null, 2), 'utf8');
        console.log(`Found ${result.recordset.length} legacy templates.`);
    } catch (err) {
        console.error(err);
    } finally {
        await closeConnection();
    }
}
queryLegacyTemplates();
