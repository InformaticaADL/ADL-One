const jwt = require('jsonwebtoken');
const http = require('http');
require('dotenv').config();

async function testApi() {
    const secret = process.env.JWT_SECRET;
    console.log("Using Secret:", secret);
    
    // We need permissions array too because controllers check req.user.permissions?.includes('ADMIN_ACCESS')
    const token = jwt.sign({ 
        id: 464, 
        usuario: 'vremolcoy', 
        rol: 'Administrador',
        permissions: ['ADMIN_ACCESS', 'URS_ACCESS'] 
    }, secret, { expiresIn: '1h' });
    
    const options = {
        hostname: '127.0.0.1',
        port: 8002,
        path: '/api/urs',
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + token
        }
    };

    const req = http.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            try {
                const data = JSON.parse(rawData);
                if(Array.isArray(data)) {
                    const req118 = data.find(r => r.id_solicitud === 118);
                    if (req118) {
                        console.log("✅ 118 SE ENCUENTRA EN LA RESPUESTA DE LA API:");
                        console.log(req118);
                    } else {
                        console.log("❌ 118 NO ESTA EN LA RESPUESTA JSON DE LA API.");
                        console.log("Primeros 3 registros encontrados:", data.slice(0, 3).map(r => r.id_solicitud));
                    }
                } else {
                    console.log("Error API no devolvió array:", data);
                }
            } catch (e) {
                console.error("Error parseando:", e.message);
                console.log("Raw:", rawData);
            }
        });
    });

    req.on('error', (e) => {
        console.error("error:", e.message);
    });
    
    req.end();
}

testApi();
