import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// First login
async function hit() {
    try {
        const loginRes = await fetch('http://localhost:8002/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: 'vremolcoy', constrasena: '123' }) // Using a test pass or similar?
        });
        
        // Wait, I don't know the password. I'll just use a JWT if I can forge it.
    } catch(e) {
        console.error(e);
    }
}
hit();
