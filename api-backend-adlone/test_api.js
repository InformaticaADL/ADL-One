import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 8002;
const BASE_URL = `http://localhost:${PORT}/api/gchat`;

async function testClearChat() {
    try {
        console.log(`Testing Clear Chat at ${BASE_URL}/conversations/5/clear`);
        // We might need a token, but let's see if we get a 500 even with 401/403 (if it fails before auth, unlikely)
        // Actually, let's try to get a token if we can, or just send the request.
        // Looking at the log, it was a 500, which means it likely passed auth and failed in the service.
        
        const response = await axios.put(`${BASE_URL}/conversations/5/clear`, {}, {
            headers: {
                // Assuming no auth for simplicity or that it fails with 500 if the route matches
            }
        });
        console.log('Response:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

testClearChat();
