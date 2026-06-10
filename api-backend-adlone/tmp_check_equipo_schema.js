import './src/config/env.js';
import { getConnection } from './src/config/database.js';

import fs from 'fs';
import path from 'path';

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

async function check() {
    try {
        const workbook = new ExcelJS.Workbook();
        const filePath = "C:\\Users\\rdiaz\\Desktop\\Copia de Copia de Nueva propuejkbvkj.xlsx";
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        const row = sheet.getRow(1);
        console.log("Excel Headers:");
        for (let c = 1; c <= sheet.columnCount; c++) {
            console.log(`Column ${c}: "${row.getCell(c).value}"`);
        }
    } catch (err) {
        console.error(err);
    }
}

check();
