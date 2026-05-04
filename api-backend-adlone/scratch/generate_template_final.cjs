const ExcelJS = require('exceljs');
const path = require('path');

async function generateTemplateFinal() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ADL ONE';
    workbook.created = new Date();

    const COLORS = {
        headerBg:   '1A6FBF', headerFont: 'FFFFFF',
        requiredBg: 'EBF5FB', optionalBg: 'F8F9FA',
        formulaBg:  'EAF7EA', formulaHdr: '0A7A3A',
        warnBg:     'FFF3CD', warnFont:   '856404', 
        linkedCol:  'D6EAF8', sheet2Bg:   '0D5C2E',
        borderColor:'BDC9D7', manualBlue: '2E86C1'
    };

    const headerFont = { bold: true, color: { argb: COLORS.headerFont }, size: 10, name: 'Calibri' };
    const normalFont = { size: 10, name: 'Calibri' };
    const formulaFont = { size: 10, italic: true, color: { argb: '1A7A1A' }, name: 'Calibri' };
    const thinBorder = {
        top: { style:'thin', color:{argb:COLORS.borderColor} },
        left: { style:'thin', color:{argb:COLORS.borderColor} },
        bottom: { style:'thin', color:{argb:COLORS.borderColor} },
        right: { style:'thin', color:{argb:COLORS.borderColor} },
    };

    // ═══════════════════════════════════════════════════════
    // SHEET 1: FICHAS
    // ═══════════════════════════════════════════════════════
    const ws1 = workbook.addWorksheet('FICHAS', {
        views: [{ state:'frozen', xSplit:1, ySplit:3 }],
        properties: { tabColor: { argb: COLORS.headerBg } }
    });

    const fichaColumns = [
        ['ID_MUESTRA',             'ID MUESTRA',               14, true],
        ['TIPO_MONITOREO',         'MONITOREO',                18, true],
        ['EMPRESA_SERVICIO',       'EMPRESA DE SERVICIO',       30, true],
        ['RUT_EMPRESA_SERVICIO',   'RUT EMPRESA SERVICIO',      18, false],
        ['DIR_EMPRESA_SERVICIO',   'DIRECCIÓN EMP. SERVICIO',   30, false],
        ['EMPRESA_FACTURAR',       'EMPRESA A FACTURAR',        30, true],
        ['BASE_OPERACIONES',       'BASE DE OPERACIONES',       22, true],
        ['CENTRO',                 'CENTRO / FUENTE EMISORA',   30, true],
        ['CONTACTO_NOMBRE',        'CONTACTO NOMBRE',           26, false],
        ['CONTACTO_EMAIL',         'CONTACTO EMAIL',            28, false],
        ['OBJETIVO_MUESTREO',      'OBJETIVO MUESTREO',         22, true],
        ['RESPONSABLE_MUESTREO',   'RESPONSABLE DEL MUESTREO',  24, false],
        ['CARGO',                  'CARGO CONTACTO',            20, false],
        ['PUNTO_MUESTREO',         'PUNTO DE MUESTREO',         22, false],
        ['FRECUENCIA_PERIODO',     'FRECUENCIA PERÍODO',        20, true],
        ['FRECUENCIA_CANTIDAD',    'FREC. MUESTREO',            16, true],
        ['FACTOR',                 'FACTOR',                    12, true],
        // 18: TOTAL SERVICIOS (Auto) -> Col R
        ['TOTAL_SERVICIOS',        '🔁 TOTAL SERVICIOS (AUTO)',  20, false],
        ['COORD_GEOGRAFICAS',      'COORD. GEOGRAFICAS',        22, false],
        ['UTM_ZONA',               'ZONA UTM',                  12, false],
        ['UTM_NORTE',              'UTM NORTE',                 14, false],
        ['UTM_ESTE',               'UTM ESTE',                  14, false],
        ['INSTRUMENTO_AMBIENTAL',  'INSTRUMENTO AMBIENTAL',     28, false],
        ['COMPONENTE',             'COMPONENTE AMBIENTAL',      22, true],
        ['SUB_AREA',               'SUB ÁREA',                  20, false],
        ['NOMBRE_TABLA',           'NOMBRE TABLA',              20, false],
        ['ES_ETFA',                'ETFA S/N',                   10, false],
        ['INSPECTOR',              'INSPECTOR AMBIENTAL',        22, false],
        ['TIPO_MUESTREO',          'TIPO DE MUESTREO',          22, false],
        ['TIPO_MUESTRA',           'TIPO DE MUESTRA',           22, false],
        ['ACTIVIDAD',              'ACTIVIDAD DEL MUESTREO',    26, false],
        ['DURACION_HRS',           'DURACIÓN DEL MUESTREO',      22, false],
        ['TIPO_DESCARGA',          'TIPO DE DESCARGA',          18, false],
        ['REF_GOOGLE',             'REF. GOOGLE MAPS',          38, false],
        ['MEDICION_CAUDAL',        'MEDICION CAUDAL',           18, false],
        ['MODALIDAD',              'MODALIDAD',                 18, false],
        ['FORMA_CANAL',            'FORMA CANAL',               16, false],
        ['U_MEDIDA_CANAL',         'U MEDIDA FORMA CANAL',      22, false],
        ['VALOR_CANAL',            'VALOR FORMA CANAL',         20, false],
        ['DISPOSITIVO',            'DISPOSITIVO HIDRÁULICO',    22, false],
        ['U_MEDIDA_DISPOSITIVO',   'U MEDIDA DISPOSITIVO HIDRÁULICO', 30, false],
        ['VALOR_DISPOSITIVO',      'VALOR DISPOSITIVO HIDRÁULICO', 30, false],
        // 43: UF DISTRIBUIR (Manual) -> Col AQ
        ['UF_DISTRIBUIR',          '✏️ UF DISTRIBUIR (Escriba Aquí)', 25, false],
        // 44: UF TOTAL REAL (Auto) -> Col AR
        ['UF_TOTAL_REAL',          '🔁 UF TOTAL REAL (AUTO)',     20, false],
    ];

    ws1.mergeCells('A1:AR1');
    const t1 = ws1.getCell('A1');
    t1.value = '📋 ADL ONE — Carga Masiva  |  Hoja 1: FICHAS (una fila = una ficha)';
    t1.font = { bold:true, size:12, color:{argb:COLORS.headerFont}, name:'Calibri' };
    t1.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.headerBg} };
    t1.alignment = { vertical:'middle', horizontal:'center' };

    ws1.mergeCells('A2:AR2');
    const n1 = ws1.getCell('A2');
    n1.value = '⚠️ INGRESE DATOS EN CELDAS AZULES. LAS CELDAS VERDES SE CALCULAN SOLAS. NO LAS SOBREESCRIBA.';
    n1.font = { bold:true, size:10, color:{argb:'856404'}, name:'Calibri' };
    n1.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.warnBg} };
    n1.alignment = { vertical:'middle', horizontal:'center' };

    const hr1 = ws1.getRow(3);
    hr1.height = 35;
    fichaColumns.forEach(([key, header, width, req], i) => {
        const cell = hr1.getCell(i+1);
        cell.value = req ? `${header} *` : header;
        
        if (header.includes('🔁')) {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaHdr} };
        } else if (header.includes('✏️')) {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.manualBlue} };
        } else {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.headerBg} };
        }
        
        cell.font = headerFont;
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = thinBorder;
        ws1.getColumn(i+1).width = width;
    });

    for (let r = 4; r <= 104; r++) {
        const row = ws1.getRow(r);
        row.height = 20;
        
        fichaColumns.forEach(([key, header, width, req], i) => {
            const cell = row.getCell(i+1);
            cell.alignment = { vertical:'middle', horizontal:'center' };
            cell.border = thinBorder;
            cell.font = normalFont;

            if (header.includes('🔁')) {
                cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaBg} };
                cell.font = formulaFont;
            } else if (header.includes('✏️')) {
                cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'D6EAF8'} }; // Light Blue
            } else {
                cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb: i===0 ? COLORS.linkedCol : req ? COLORS.requiredBg : COLORS.optionalBg} };
            }
        });

        // FORMULAS HOJA 1
        // Col P(16), Q(17) -> R(18)
        ws1.getCell(`R${r}`).value = { formula: `IF(AND(P${r}<>"",Q${r}<>""),P${r}*Q${r},"")` };
        
        // Col AR(44) = SUMIF(ANALISIS!A:A, A, ANALISIS!I:I)
        ws1.getCell(`AR${r}`).value = { formula: `IF(A${r}="","",IFERROR(SUMIF(ANALISIS!$A:$A,A${r},ANALISIS!$I:$I),0))` };
    }

    // ═══════════════════════════════════════════════════════
    // SHEET 2: ANALISIS
    // ═══════════════════════════════════════════════════════
    const ws2 = workbook.addWorksheet('ANALISIS', {
        views: [{ state:'frozen', xSplit:2, ySplit:3 }],
        properties: { tabColor: { argb: COLORS.sheet2Bg } }
    });

    const analisisColumns = [
        ['ID_MUESTRA',      'ID MUESTRA',         14, true],
        ['NOMBRE_ANALISIS', 'NOMBRE ANÁLISIS',     30, true],
        ['TIPO_ANALISIS',   'TIPO ANÁLISIS',       18, true],
        ['LABORATORIO',     'LABORATORIO 1',       26, true],
        ['TIPO_ENTREGA',    'TIPO ENTREGA',        18, true],
        ['NORMATIVA',       'NORMATIVA',           22, false],
        ['REFERENCIA',      'REFERENCIA NORMATIVA',26, false],
        ['LABORATORIO_2',   'LABORATORIO 2',       22, false],
        // 9: UF INDIVIDUAL (Auto) -> Col I
        ['UF_INDIVIDUAL',   '🔁 UF INDIVIDUAL (AUTO)', 22, false],
        // 10: UF MANUAL (Input) -> Col J
        ['UF_MANUAL',       '✏️ UF MANUAL (Escriba Aquí)', 25, false],
        // 11: HELPER
        ['HELPER',          '_CNT',                0,  false]
    ];

    ws2.mergeCells('A1:J1');
    const t2 = ws2.getCell('A1');
    t2.value = '🧪 ADL ONE — Carga Masiva  |  Hoja 2: ANALISIS (una fila = un análisis)';
    t2.font = { bold:true, size:12, color:{argb:COLORS.headerFont}, name:'Calibri' };
    t2.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.sheet2Bg} };
    t2.alignment = { vertical:'middle', horizontal:'center' };

    ws2.mergeCells('A2:J2');
    const n2 = ws2.getCell('A2');
    n2.value = '⚠️ SI DESEA MODIFICAR LA UF, ESCRIBA EN LA COLUMNA AZUL "UF MANUAL". NO TOQUE LA COLUMNA VERDE.';
    n2.font = { bold:true, size:10, color:{argb:'856404'}, name:'Calibri' };
    n2.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.warnBg} };
    n2.alignment = { vertical:'middle', horizontal:'center' };

    const hr2 = ws2.getRow(3);
    hr2.height = 35;
    analisisColumns.forEach(([key, header, width, req], i) => {
        const cell = hr2.getCell(i+1);
        cell.value = req ? `${header} *` : header;
        
        if (header.includes('🔁')) {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaHdr} };
        } else if (header.includes('✏️')) {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.manualBlue} };
        } else {
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.sheet2Bg} };
        }

        cell.font = headerFont;
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = thinBorder;
        ws2.getColumn(i+1).width = width;
    });

    for (let r = 4; r <= 508; r++) {
        const row = ws2.getRow(r);
        row.height = 20;
        
        analisisColumns.forEach(([key, hdr, width, req], i) => {
            const cell = row.getCell(i+1);
            cell.alignment = { vertical:'middle', horizontal:'center' };
            cell.border = thinBorder;
            cell.font = normalFont;

            if (hdr.includes('🔁')) {
                cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.formulaBg} };
                cell.font = formulaFont;
            } else if (hdr.includes('✏️')) {
                cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:'D6EAF8'} }; // Light Blue
            } else {
                cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb: i < 2 ? COLORS.linkedCol : req ? COLORS.requiredBg : COLORS.optionalBg} };
            }
        });

        // HELPER K
        ws2.getCell(`K${r}`).value = { formula: `IF(A${r}<>"",COUNTIF($A$4:$A$508,A${r}),0)` };
        
        // UF INDIVIDUAL I
        // VLOOKUP debe ir a FICHAS!A:AQ y sacar col 43
        ws2.getCell(`I${r}`).value = {
            formula: 
                `IF(A${r}="","",` +
                `IF(J${r}<>"",J${r},` +
                `IFERROR(` +
                    `VLOOKUP(A${r},FICHAS!$A:$AQ,43,0)` +
                    `/IF(K${r}=0,1,K${r}),` +
                `"")))`
        };
    }

    ws2.getColumn(11).hidden = true;

    // AÑADIR DATOS DE EJEMPLO PARA QUE VEA QUE FUNCIONA
    ws1.getCell('A4').value = 'M-001';
    ws1.getCell('B4').value = 'Compuesta';
    ws1.getCell('F4').value = 'EJEMPLO EMPRESA';
    ws1.getCell('AQ4').value = 10; // 10 UF

    ws2.getCell('A4').value = 'M-001'; ws2.getCell('B4').value = 'pH';
    ws2.getCell('A5').value = 'M-001'; ws2.getCell('B5').value = 'Temperatura';
    ws2.getCell('A6').value = 'M-001'; ws2.getCell('B6').value = 'DBO5';
    ws2.getCell('A7').value = 'M-001'; ws2.getCell('B7').value = 'Aceites y Grasas';
    ws2.getCell('A8').value = 'M-001'; ws2.getCell('B8').value = 'Sólidos Suspendidos';

    // SHEET 3: INSTRUCCIONES
    const ws3 = workbook.addWorksheet('INSTRUCCIONES');
    ws3.getColumn(1).width = 100;
    const instructions = [
        ['📖 INSTRUCCIONES DE USO', true, 14, COLORS.headerBg, 'FFFFFF'],
        ['', false, 10, 'FFFFFF', '000000'],
        ['1. HOJA "FICHAS": Ingrese los datos de la ficha en una fila.', false, 11, 'FFFFFF', '000000'],
        ['   • La columna AZUL "✏️ UF DISTRIBUIR" es donde usted pone el valor total.', false, 11, 'D6EAF8', '1A5276'],
        ['2. HOJA "ANALISIS": Repita el ID MUESTRA por cada análisis.', false, 11, 'FFFFFF', '000000'],
        ['   • La columna VERDE "🔁 UF INDIVIDUAL" se calculará dividiendo la UF DISTRIBUIR.', false, 11, 'EAF7EA', '1A7A1A'],
        ['   • Si quiere que un análisis específico tenga otro valor, escríbalo en la columna AZUL "✏️ UF MANUAL".', false, 11, 'D6EAF8', '1A5276'],
        ['3. DINAMISMO:', false, 11, 'FFFFFF', '000000'],
        ['   • Al escribir en UF DISTRIBUIR (Hoja 1), se actualizan todos los análisis (Hoja 2).', false, 10, 'FDF2E9', '000000'],
        ['   • Al escribir en UF MANUAL (Hoja 2), se actualiza el UF TOTAL REAL (Hoja 1).', false, 10, 'FDF2E9', '000000'],
    ];
    instructions.forEach(([t, b, s, bg, fg], i) => {
        const c = ws3.getCell(`A${i+1}`);
        c.value = t;
        c.font = { bold:b, size:s, name:'Calibri', color:{argb:fg} };
        c.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bg} };
    });

    await workbook.xlsx.writeFile('C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx');
    console.log('✅ Archivo regenerado con VLOOKUP corregido ($A:$AQ, 43).');
}

generateTemplateFinal().catch(console.error);
