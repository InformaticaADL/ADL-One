const jwt = require('jsonwebtoken');

function generateTestToken() {
    const payload = {
        id: 464, // vremolcoy
        usuario: "vremolcoy",
        rol: "Administrador"
    };
    
    // Assuming the backend uses a default JWT_SECRET if none provided
    // This script might fail if the secret is strictly loaded from .env
    const secret = process.env.JWT_SECRET || 'adl-secret-key-2024'; 
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });
    console.log("Token:", token);
    return token;
}

generateTestToken();
