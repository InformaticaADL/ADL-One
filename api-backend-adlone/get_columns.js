const { getConnection } = require('./src/config/database');

async function getColumns() {
    try {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'App_Ma_FichaIngresoServicio_ENC'
        `);
        console.log(result.recordset.map(r => r.COLUMN_NAME).join('\n'));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

getColumns();
