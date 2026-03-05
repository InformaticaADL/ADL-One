import FichaIngresoService from './src/services/ficha.service.js';

async function test() {
    try {
        const result = await FichaIngresoService.getFichaById(96);
        const data = result.data;
        console.log("ficha 96 id_empresa:", data.id_empresa);
        console.log("ficha 96 id_empresaservicio:", data.id_empresaservicio);
        console.log("ficha 96 id_empresaservicios:", data.id_empresaservicios);
        console.log("ficha 96 nombre_empresaservicios:", data.nombre_empresaservicios);
        console.log("ficha 96 nombre_empresa:", data.nombre_empresa);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}

test();
