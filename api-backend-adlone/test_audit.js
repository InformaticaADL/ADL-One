
import { AsyncLocalStorage } from 'async_hooks';
import sql from './src/config/database.js';
import auditService from './src/services/audit.service.js';
import { requestContext } from './src/utils/context.js';
import { randomUUID } from 'crypto';

async function testAuditEnrichment() {
    console.log('--- Starting Audit Enrichment Test ---');

    const mockContext = {
        traceId: randomUUID(),
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/test/verification',
        user: { id: 999, nombre_usuario: 'TestUser' },
        userAgent: 'MockBrowser/1.0'
    };

    console.log('Mock Context:', mockContext);

    try {
        await requestContext.run(mockContext, async () => {
            console.log('Inside context...');
            
            await auditService.log({
                usuario_id: mockContext.user.id,
                area_key: 'test',
                modulo_nombre: 'Test Module',
                evento_tipo: 'VERIFICATION',
                entidad_nombre: 'Test_Entity',
                entidad_id: '123',
                descripcion_humana: 'Verification test audit log with automatic enrichment',
                severidad: 1
            });

            console.log('Audit log call completed.');
        });

        console.log('--- Test Finished ---');
        console.log('Please check the App_Audit_Log table for a record with:');
        console.log(`- trace_id: ${mockContext.traceId}`);
        console.log(`- ip_address: ${mockContext.ip}`);
        console.log(`- metadatos_extra: should contain "userAgent": "${mockContext.userAgent}"`);
        
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        process.exit(0);
    }
}

testAuditEnrichment();
