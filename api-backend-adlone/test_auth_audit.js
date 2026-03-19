
import authService from './src/services/auth.service.js';
import { requestContext } from './src/utils/context.js';
import { randomUUID } from 'crypto';

async function testAuthAudit() {
    console.log('--- Starting Auth Audit Test ---');

    const mockContext = {
        traceId: randomUUID(),
        ip: '9.8.7.6',
        method: 'POST',
        path: '/api/auth/login',
        userAgent: 'MockAuthTester/1.0'
    };

    try {
        await requestContext.run(mockContext, async () => {
            console.log('Attempting invalid login (should log LOGIN_FAILURE)...');
            // Using random non-existent credentials
            await authService.login('nonexistent_user_xyz', 'wrong_password', false);
            console.log('Invalid login attempt finished.');
        });

        console.log('--- Auth Audit Test Finished ---');
        console.log('Please check the App_Audit_Log table for a record with:');
        console.log(`- evento_tipo: LOGIN_FAILURE`);
        console.log(`- metadatos_extra: should contain "username": "nonexistent_user_xyz", "path": "/api/auth/login"`);
        
    } catch (error) {
        console.error('Auth Test failed:', error);
    } finally {
        process.exit(0);
    }
}

testAuthAudit();
