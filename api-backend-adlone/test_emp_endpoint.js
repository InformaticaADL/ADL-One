import axios from 'axios';

async function testEndpoint() {
    try {
        const res = await axios.get('http://localhost:4000/api/catalogos/empresas-servicio');
        console.log("empresas-servicio SUCCESS:", res.data.success);
        console.log("empresas length:", res.data.data.length);
        console.log("First element:", res.data.data[0]);
    } catch (error) {
        console.error("Error calling endpoint:", error.message);
    }
}

testEndpoint();
