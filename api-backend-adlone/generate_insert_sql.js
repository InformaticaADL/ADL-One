import './src/config/env.js';
import { getConnection } from './src/config/database.js';
import sql from 'mssql';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';

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

// Escapes single quotes for SQL Server
function sqlEscape(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val.toString();
    if (typeof val === 'boolean') return val ? '1' : '0';
    if (val instanceof Date) {
        return `'${val.toISOString().split('T')[0]}'`;
    }
    
    // Check if it's a date string
    const dateStr = String(val);
    if (dateStr.includes('T') && !isNaN(Date.parse(dateStr))) {
        return `'${dateStr.split('T')[0]}'`;
    }

    // Standard string escaping
    return `'${dateStr.replace(/'/g, "''")}'`;
}

async function run() {
    try {
        const pool = await getConnection();
        
        console.log("Loading catalog models...");
        const catRes = await pool.request().query("SELECT * FROM mae_equipo_catalogo");
        const catalog = catRes.recordset;

        console.log("Reading Excel file...");
        const workbook = new ExcelJS.Workbook();
        const filePath = "C:\\Users\\rdiaz\\Desktop\\Copia de Copia de Nueva propuejkbvkj.xlsx";
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];

        let sqlContent = [];
        sqlContent.push("USE [PruebasInformatica];");
        sqlContent.push("GO\n");
        sqlContent.push("-- Descomenta si la columna es de tipo IDENTITY:");
        sqlContent.push("-- SET IDENTITY_INSERT mae_equipo ON;\n");

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

            const rawHabilitado = getCellValue(row.getCell(8));
            const habilitado = rawHabilitado === 'N' ? 'N' : 'S';

            const rawVisible = getCellValue(row.getCell(20));
            const visible_muestreador = (rawVisible === 'S' || rawVisible === 'SI' || rawVisible === 'SÍ') ? 'S' : 'N';

            const rawInforme = getCellValue(row.getCell(24));
            const informe = (rawInforme === 'S' || rawInforme === 'SI' || rawInforme === 'SÍ') ? 'S' : 'N';

            const esta_ocupado = getCellValue(row.getCell(29)) === 1 ? 1 : 0;

            const Ultima_verificacion = parseDate(getCellValue(row.getCell(15)));
            let Siguiente_verificacion = parseDate(getCellValue(row.getCell(16)));

            if (!Siguiente_verificacion && Ultima_verificacion) {
                const d = new Date(Ultima_verificacion);
                d.setDate(d.getDate() + 90);
                Siguiente_verificacion = d;
            }

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

            let rawSede = getCellValue(row.getCell(6));
            if (rawSede) {
                const upperSede = String(rawSede).trim().toUpperCase();
                if (upperSede === '.A') rawSede = 'AY';
                else if (upperSede === '.P' || upperSede === '.M') rawSede = 'PM';
                else if (upperSede === '.V') rawSede = 'VI';
            }

            const values = [
                sqlEscape(parseNumeric(id_equipo)),
                sqlEscape(match ? match.tipo_equipo : eq_type),
                sqlEscape(match ? match.nombre : eq_name),
                sqlEscape(getCellValue(row.getCell(4))),
                sqlEscape(parseNumeric(getCellValue(row.getCell(5)))),
                sqlEscape(rawSede),
                sqlEscape(getCellValue(row.getCell(7))),
                sqlEscape(habilitado),
                sqlEscape(id_muestreador),
                sqlEscape(getCellValue(row.getCell(10))),
                sqlEscape(parseNumeric(getCellValue(row.getCell(11)))),
                sqlEscape(parseNumeric(getCellValue(row.getCell(12)))),
                sqlEscape(parseNumeric(getCellValue(row.getCell(13)))),
                sqlEscape(Siguiente_verificacion), // fecha_vigencia = Siguiente_verificacion
                sqlEscape(getCellValue(row.getCell(18))),
                sqlEscape(getCellValue(row.getCell(19))),
                sqlEscape(visible_muestreador),
                sqlEscape(match ? match.que_mide : getCellValue(row.getCell(21))),
                sqlEscape(match ? match.unidad_medida_textual : getCellValue(row.getCell(22))),
                sqlEscape(match ? match.unidad_medida_sigla : getCellValue(row.getCell(23))),
                sqlEscape(informe),
                'NULL', // id_historial_actual
                sqlEscape(getCellValue(row.getCell(26)) || 'v1'),
                sqlEscape(id_equipocatalogo),
                sqlEscape(es_fijo),
                sqlEscape(esta_ocupado),
                sqlEscape(getCellValue(row.getCell(30))),
                sqlEscape(Ultima_verificacion), // Ultima_verificacion
                sqlEscape(Siguiente_verificacion), // Siguiente_verificacion
                sqlEscape(getCellValue(row.getCell(17))),
                sqlEscape(getCellValue(row.getCell(31)) || 'Operativo')
            ];

            const query = `INSERT INTO mae_equipo (id_equipo, tipoequipo, nombre, sigla, correlativo, sede, codigo, habilitado, id_muestreador, tienefc, error0, error15, error30, fecha_vigencia, equipo_asociado, observacion, visible_muestreador, que_mide, unidad_medida_textual, unidad_medida_sigla, informe, id_historial_actual, version, id_equipocatalogo, es_fijo, esta_ocupado, ocupado_por_frecuencia, Ultima_verificacion, Siguiente_verificacion, Plazo_Vigencia, Estado) VALUES (${values.join(', ')});`;
            sqlContent.push(query);
        }

        sqlContent.push("\n-- Descomenta si la columna es de tipo IDENTITY:");
        sqlContent.push("-- SET IDENTITY_INSERT mae_equipo OFF;");
        sqlContent.push("GO");

        const outPathProject = path.join("..", "db_scripts", "insert_all_equipos.sql");
        fs.writeFileSync(outPathProject, sqlContent.join("\n"));
        console.log(`SQL script generated successfully in project: ${outPathProject}`);

        // Write directly to user's Desktop as well
        const outPathDesktop = "C:\\Users\\rdiaz\\Desktop\\insert_all_equipos.sql";
        fs.writeFileSync(outPathDesktop, sqlContent.join("\n"));
        console.log(`SQL script generated successfully on Desktop: ${outPathDesktop}`);

        process.exit(0);
    } catch (err) {
        console.error("Failed to generate SQL script:", err);
        process.exit(1);
    }
}
run();
