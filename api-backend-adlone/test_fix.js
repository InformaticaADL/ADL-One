import adminService from './src/services/admin.service.js';

async function testExport() {
    try {
        console.log('Testing getExportPdf with empty params...');
        const result = await adminService.getExportPdf({});
        console.log('Success! PDF Buffer length:', result.length);
        process.exit(0);
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

testExport();
