import './src/config/env.js';
import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import ExcelJS from 'exceljs';

function getCellValue(cell) {
    if (!cell) return null;
    let val = cell.value;
    if (val && typeof val === 'object') {
        if (val.result !== undefined) {
            val = val.result;
        } else if (val.richText) {
            val = val.richText.map(t => t.text).join('');
        }
    }
    if (val === 'NULL' || val === 'null' || val === '') {
        return null;
    }
    return val;
}

function parseNumeric(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const str = String(val).trim().replace(',', '.');
    if (str === '' || str === 'NULL' || str === 'null') return null;
    const num = Number(str);
    return isNaN(num) ? null : num;
}

function parseDate(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val;
    const str = String(val).trim();
    if (str === '' || str === 'NULL' || str === 'null') return null;
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

function parseString(val) {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) {
        return val.toISOString().split('T')[0];
    }
    return String(val).trim();
}

async function run() {
    try {
        const pool = await getConnection();
        
        console.log("Loading catalog models...");
        const catRes = await pool.request().query("SELECT * FROM mae_equipo_catalogo");
        const catalog = catRes.recordset;
        console.log(`Loaded ${catalog.length} catalog models.`);

        console.log("Reading Excel file...");
        const workbook = new ExcelJS.Workbook();
        const filePath = "C:\\Users\\rdiaz\\Desktop\\Copia de Copia de Nueva propuejkbvkj.xlsx";
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        
        console.log(`Found ${sheet.rowCount} rows in Hoja1.`);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            console.log("Deleting existing rows in mae_equipo...");
            await transaction.request().query("DELETE FROM mae_equipo");
            console.log("Table cleared.");

            let insertedCount = 0;

            for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
                const row = sheet.getRow(rowNum);
                const id_equipo = getCellValue(row.getCell(1));
                if (!id_equipo) continue;

                const eq_name = String(getCellValue(row.getCell(3)) || '').trim();
                const eq_type = String(getCellValue(row.getCell(2)) || '').trim();

                // Find matching catalog model
                let match = catalog.find(c => c.nombre.toLowerCase().trim() === eq_name.toLowerCase());
                if (!match) {
                    if (eq_name.toUpperCase() === 'GPS') {
                        match = catalog.find(c => c.nombre === 'Sistema de Posicionamiento Global');
                    } else if (eq_name.toUpperCase() === 'MOLINETE') {
                        match = catalog.find(c => c.nombre === 'Molinete');
                    } else if (eq_name.toUpperCase() === 'SONDA CAUDAL') {
                        match = catalog.find(c => c.nombre === 'Sonda Caudal');
                    }
                }
                if (!match) {
                    match = catalog.find(c => c.nombre.toLowerCase().trim() === eq_type.toLowerCase());
                }

                const id_equipocatalogo = match ? match.id_equipocatalogo : null;
                const catName = match ? match.nombre : '';

                // es_fijo logic
                const fijos = ['MUESTREADOR AUTOMÁTICO', 'Sonda Caudal', 'SONDA PH/TEMPERATURA', 'BATERIA', 'POWER PACK', 'FILTRO', 'Pedestal'];
                const es_fijo = fijos.some(f => catName.toLowerCase() === f.toLowerCase()) ? 1 : 0;

                const request = transaction.request();
                request.input('id_equipo', sql.Numeric(10, 0), id_equipo);
                request.input('tipoequipo', sql.VarChar(50), parseString(match ? match.tipo_equipo : eq_type));
                request.input('nombre', sql.VarChar(100), parseString(match ? match.nombre : eq_name));
                request.input('sigla', sql.VarChar(20), parseString(getCellValue(row.getCell(4))));
                request.input('correlativo', sql.Numeric(10, 0), parseNumeric(getCellValue(row.getCell(5))));
                let rawSede = parseString(getCellValue(row.getCell(6)));
                if (rawSede) {
                    const upperSede = rawSede.toUpperCase();
                    if (upperSede === '.A') rawSede = 'AY';
                    else if (upperSede === '.P') rawSede = 'PM';
                    else if (upperSede === '.V') rawSede = 'VI';
                }
                request.input('sede', sql.VarChar(2), rawSede);
                request.input('codigo', sql.VarChar(100), parseString(getCellValue(row.getCell(7))));
                
                // Normalizing habilitado: default to 'S' unless 'N' is specified
                const rawHabilitado = getCellValue(row.getCell(8));
                request.input('habilitado', sql.VarChar(1), rawHabilitado === 'N' ? 'N' : 'S');
                
                const Ultima_verificacion = parseDate(getCellValue(row.getCell(15)));
                let Siguiente_verificacion = parseDate(getCellValue(row.getCell(16)));

                if (!Siguiente_verificacion && Ultima_verificacion) {
                    const d = new Date(Ultima_verificacion);
                    d.setDate(d.getDate() + 90);
                    Siguiente_verificacion = d;
                }
                const fecha_vigencia = Siguiente_verificacion;

                let id_muestreador = parseNumeric(getCellValue(row.getCell(9)));
                if (id_muestreador === null) {
                    const fallbackMuestreadores = {
                        4: 1035, 11: 1036, 15: 226, 16: 177, 33: 226, 41: 1020, 114: 226, 119: 226, 129: 1035, 134: 21,
                        169: 1034, 172: 226, 176: 1035, 178: 1036, 258: 1020, 267: 1020, 270: 21, 274: 21, 316: 21, 317: 21,
                        364: 21, 365: 21, 366: 21, 596: 226, 597: 226, 598: 226, 622: 21, 623: 21, 624: 21, 625: 21, 626: 21, 627: 21
                    };
                    if (fallbackMuestreadores[id_equipo] !== undefined) {
                        id_muestreador = fallbackMuestreadores[id_equipo];
                    }
                }
                request.input('id_muestreador', sql.Numeric(10, 0), id_muestreador);
                request.input('tienefc', sql.VarChar(10), parseString(getCellValue(row.getCell(10))));
                request.input('error0', sql.Numeric(10, 1), parseNumeric(getCellValue(row.getCell(11))));
                request.input('error15', sql.Numeric(10, 1), parseNumeric(getCellValue(row.getCell(12))));
                request.input('error30', sql.Numeric(10, 1), parseNumeric(getCellValue(row.getCell(13))));
                request.input('fecha_vigencia', sql.Date, fecha_vigencia);
                request.input('equipo_asociado', sql.VarChar(200), parseString(getCellValue(row.getCell(18))));
                request.input('observacion', sql.VarChar(1000), parseString(getCellValue(row.getCell(19))));
                
                // Normalizing visible_muestreador
                const rawVisible = getCellValue(row.getCell(20));
                request.input('visible_muestreador', sql.VarChar(10), (rawVisible === 'S' || rawVisible === 'SI' || rawVisible === 'SÍ') ? 'S' : 'N');
                
                request.input('que_mide', sql.VarChar(250), parseString(match ? match.que_mide : getCellValue(row.getCell(21))));
                request.input('unidad_medida_textual', sql.VarChar(250), parseString(match ? match.unidad_medida_textual : getCellValue(row.getCell(22))));
                request.input('unidad_medida_sigla', sql.VarChar(100), parseString(match ? match.unidad_medida_sigla : getCellValue(row.getCell(23))));
                
                // Normalizing informe
                const rawInforme = getCellValue(row.getCell(24));
                request.input('informe', sql.VarChar(10), (rawInforme === 'S' || rawInforme === 'SI' || rawInforme === 'SÍ') ? 'S' : 'N');
                
                request.input('id_historial_actual', sql.Numeric(10, 0), null);
                request.input('version', sql.VarChar(10), parseString(getCellValue(row.getCell(26)) || 'v1'));
                request.input('id_equipocatalogo', sql.Int, id_equipocatalogo);
                request.input('es_fijo', sql.Bit, es_fijo);
                request.input('esta_ocupado', sql.Bit, getCellValue(row.getCell(29)) === 1 ? 1 : 0);
                request.input('ocupado_por_frecuencia', sql.VarChar(50), parseString(getCellValue(row.getCell(30))));
                request.input('Ultima_verificacion', sql.Date, Ultima_verificacion);
                request.input('Siguiente_verificacion', sql.Date, Siguiente_verificacion);
                request.input('Plazo_Vigencia', sql.VarChar(500), parseString(getCellValue(row.getCell(17))));
                request.input('Estado', sql.VarChar(100), parseString(getCellValue(row.getCell(31)) || 'Operativo'));

                await request.query(`
                    INSERT INTO mae_equipo (
                        id_equipo, tipoequipo, nombre, sigla, correlativo, sede, codigo, habilitado,
                        id_muestreador, tienefc, error0, error15, error30, fecha_vigencia, equipo_asociado,
                        observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla,
                        informe, id_historial_actual, version, id_equipocatalogo, es_fijo, esta_ocupado,
                        ocupado_por_frecuencia, Ultima_verificacion, Siguiente_verificacion, Plazo_Vigencia, Estado
                    ) VALUES (
                        @id_equipo, @tipoequipo, @nombre, @sigla, @correlativo, @sede, @codigo, @habilitado,
                        @id_muestreador, @tienefc, @error0, @error15, @error30, @fecha_vigencia, @equipo_asociado,
                        @observacion, @visible_muestreador, @que_mide, @unidad_medida_textual, @unidad_medida_sigla,
                        @informe, @id_historial_actual, @version, @id_equipocatalogo, @es_fijo, @esta_ocupado,
                        @ocupado_por_frecuencia, @Ultima_verificacion, @Siguiente_verificacion, @Plazo_Vigencia, @Estado
                    )
                `);
                
                insertedCount++;
            }

            await transaction.commit();
            console.log(`Successfully imported ${insertedCount} equipment records into database!`);

        } catch (err) {
            console.error("Error during import transaction, rolling back...", err);
            await transaction.rollback();
            throw err;
        }

        process.exit(0);
    } catch (err) {
        console.error("Import failed:", err);
        process.exit(1);
    }
}
run();
