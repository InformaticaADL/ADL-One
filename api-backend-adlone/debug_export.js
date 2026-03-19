
import { adminService } from './src/services/admin.service.js';
import { getConnection } from './src/config/database.js';

async function test() {
    console.log('Testing getTableData for mae_muestreador...');
    try {
        const data = await adminService.getTableData('mae_muestreador');
        console.log('SUCCESS: Retrieved ' + data.length + ' rows');
        if (data.length > 0) {
            console.log('Columns and Types:');
            for (const key in data[0]) {
                const val = data[0][key];
                const type = typeof val;
                const isBuffer = Buffer.isBuffer(val);
                console.log(`- ${key}: ${type}${isBuffer ? ' (Buffer)' : ''}`);
            }
        }
    } catch (e) {
        console.error('FAILED:', e.message);
    } finally {
        process.exit(0);
    }
}

test();
