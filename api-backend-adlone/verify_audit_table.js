
import { getConnection } from './src/config/database.js';
import sql from 'mssql';

async function verify() {
    try {
        const pool = await getConnection();
        console.log('✅ Connected to SQL Server');

        // 1. Verify existence
        const resTable = await pool.request().query("SELECT * FROM sys.tables WHERE name = 'App_Audit_Log'");
        if (resTable.recordset.length > 0) {
            console.log('✅ Table App_Audit_Log exists.');
        } else {
            console.error('❌ Table App_Audit_Log NOT found.');
        }

        // 2. Test INSERT
        console.log('Testing INSERT...');
        const insertRes = await pool.request()
            .input('user_id', sql.Numeric(18,0), 1)
            .input('area', sql.NVarChar, 'TEST')
            .input('module', sql.NVarChar, 'VERIFICATION')
            .input('event', sql.NVarChar, 'INSERT_TEST')
            .input('entity', sql.NVarChar, 'Test_Entity')
            .input('entity_id', sql.NVarChar, '123')
            .input('desc', sql.NVarChar, 'Verification test insert')
            .query(`
                INSERT INTO App_Audit_Log 
                (usuario_id, area_key, modulo_nombre, evento_tipo, entidad_nombre, entidad_id, descripcion_humana)
                VALUES (@user_id, @area, @module, @event, @entity, @entity_id, @desc);
                SELECT TOP 1 id, fecha_registro FROM App_Audit_Log ORDER BY fecha_registro DESC;
            `);
        
        const lastRecord = insertRes.recordset[0];
        console.log('✅ INSERT successful. ID:', lastRecord.id);

        // 3. Test UPDATE (Should fail)
        console.log('Testing UPDATE (expecting error)...');
        try {
            await pool.request()
                .input('id', sql.UniqueIdentifier, lastRecord.id)
                .input('fecha', sql.DateTimeOffset, lastRecord.fecha_registro)
                .query("UPDATE App_Audit_Log SET descripcion_humana = 'HACKED' WHERE id = @id AND fecha_registro = @fecha");
            console.error('❌ UPDATE unexpectedly succeeded!');
        } catch (err) {
            console.log('✅ UPDATE failed as expected:', err.message);
        }

        // 4. Test DELETE (Should fail)
        console.log('Testing DELETE (expecting error)...');
        try {
            await pool.request()
                .input('id', sql.UniqueIdentifier, lastRecord.id)
                .input('fecha', sql.DateTimeOffset, lastRecord.fecha_registro)
                .query("DELETE FROM App_Audit_Log WHERE id = @id AND fecha_registro = @fecha");
            console.error('❌ DELETE unexpectedly succeeded!');
        } catch (err) {
            console.log('✅ DELETE failed as expected:', err.message);
        }

        await pool.close();
    } catch (err) {
        console.error('❌ Verification failed:', err);
    }
}

verify();
