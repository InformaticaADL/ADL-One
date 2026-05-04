const ExcelJS = require('exceljs');
const path = require('path');

async function generateTemplate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ADL ONE';
    workbook.created = new Date();

    const COLORS = {
        headerBg:   '1A6FBF', headerFont: 'FFFFFF',
        requiredBg: 'E8F4FD', optionalBg: 'F8F9FA',
        exampleFont:'6C757D', borderColor:'BDC9D7',
        sheet2Bg:   '0D5C2E', warnBg:     'FFF3CD',
        warnFont:   '856404', linkedCol:  'D6EAF8',
    };
    const headerFont = { bold: true, color: { argb: COLORS.headerFont }, size: 10, name: 'Calibri' };
    const normalFont = { size: 10, name: 'Calibri' };
    const exampleFont = { size: 9, italic: true, color: { argb: COLORS.exampleFont }, name: 'Calibri' };
    const thinBorder = {
        top: { style:'thin', color:{argb:COLORS.borderColor} },
        left: { style:'thin', color:{argb:COLORS.borderColor} },
        bottom: { style:'thin', color:{argb:COLORS.borderColor} },
        right: { style:'thin', color:{argb:COLORS.borderColor} },
    };

    // ═══════════════════════════════════════════════════════
    // SHEET 1: FICHAS  — columnas completas basadas en PDF
    // ═══════════════════════════════════════════════════════
    const ws1 = workbook.addWorksheet('FICHAS', {
        views: [{ state:'frozen', xSplit:1, ySplit:3 }],
        properties: { tabColor: { argb: COLORS.headerBg } }
    });

    // [key, header display, width, required, example, note]
    const fichaColumns = [
        // ── IDENTIFICACIÓN ──
        ['ID_MUESTRA',             'ID MUESTRA',               14, true,  'M-001',                          'Clave única. Repita en Hoja 2 ANALISIS.'],
        // ── EMPRESA SERVICIO ──
        ['EMPRESA_SERVICIO',       'EMPRESA DE SERVICIO',       30, true,  'ADL Diagnostic Ltda.',           'Matching automático con catálogo'],
        ['RUT_EMPRESA_SERVICIO',   'RUT EMPRESA SERVICIO',      18, false, '77.979.799-2',                   'RUT legal de la empresa'],
        ['DIR_EMPRESA_SERVICIO',   'DIRECCIÓN EMP. SERVICIO',   30, false, 'Camino a Chinquihue, Km.12',    ''],
        ['REPRESENTANTE_LEGAL',    'REPRESENTANTE LEGAL',       26, false, 'Cristian Fernandes Jeria',       ''],
        ['RUT_REP_LEGAL',          'RUT REPRESENTANTE LEGAL',   18, false, '10.528.819',                     ''],
        // ── CLIENTE ──
        ['EMPRESA_FACTURAR',       'EMPRESA A FACTURAR',        30, true,  'Invermar S.A.',                  'Matching automático con catálogo'],
        ['BASE_OPERACIONES',       'BASE DE OPERACIONES',       22, true,  'Puerto Montt',                   'Sede ADL responsable. Ej: Puerto Montt'],
        // ── CENTRO / FUENTE ──
        ['CENTRO',                 'CENTRO / FUENTE EMISORA',   30, true,  'Piscicultura Lago Verde',        'Matching automático con catálogo'],
        ['TIPO_AGUA',              'TIPO DE AGUA',              18, false, 'Agua',                           'Ej: Agua, Agua de mar, Agua subterránea'],
        ['UBICACION',              'UBICACIÓN (DIRECCIÓN)',      36, false, 'Camino a Ralun, Puerto Varas',  'Dirección física del punto de muestreo'],
        ['REGION',                 'REGIÓN',                    24, false, 'Región de los Lagos',            ''],
        ['COMUNA',                 'COMUNA',                    18, false, 'Puerto Varas',                   ''],
        // ── CONTACTO ──
        ['CONTACTO_NOMBRE',        'CONTACTO NOMBRE',           26, false, 'Maria Jose Castro',              ''],
        ['CONTACTO_EMAIL',         'CONTACTO EMAIL',            28, false, 'mariajose.castro@invermar.cl',   ''],
        ['CARGO',                  'CARGO CONTACTO',            20, false, 'Jefe de Planta',                 ''],
        // ── SERVICIO ──
        ['OBJETIVO_MUESTREO',      'OBJETIVO MUESTREO',         22, true,  'Autocontrol',                    'Ej: Autocontrol, Fiscalización, RSCO'],
        ['ACTIVIDAD',              'ACTIVIDAD',                 26, false, 'Autocontrol RILes',              ''],
        ['COMPONENTE',             'COMPONENTE AMBIENTAL',      22, true,  'Agua residual',                  'Ej: Agua residual, Agua de mar'],
        ['SUB_AREA',               'SUB ÁREA',                  20, false, 'Residuos Líquidos',              ''],
        ['PUNTO_MUESTREO',         'PUNTO DE MUESTREO',         22, false, 'Efluente',                       'Ej: Efluente Punto 1, Efluente'],
        // ── FRECUENCIA ──
        ['FRECUENCIA_PERIODO',     'FRECUENCIA PERÍODO',        20, true,  'Mensual',                        'Ej: Mensual, Trimestral, Anual'],
        ['FRECUENCIA_CANTIDAD',    'FREC. CANTIDAD',            16, true,  '4',                              'Nº de muestreos por período'],
        ['FACTOR',                 'FACTOR',                    12, true,  '1',                              'Multiplicador del período. Ej: 12 = anual'],
        // ── MONITOREO ──
        ['TIPO_MONITOREO',         'TIPO MONITOREO',            18, true,  'Compuesto',                      'Puntual o Compuesta'],
        ['TIPO_MUESTRA',           'TIPO DE MUESTRA (laboratorio)' ,22,false,'Agua residual',               'Matriz de laboratorio'],
        ['TIPO_MUESTREO',          'TIPO MUESTREO',             18, false, 'Compuesto 24 h',                 'Ej: Puntual, Compuesto 24 h'],
        ['DURACION_HRS',           'DURACIÓN (HRS)',             14, false, '24',                             ''],
        ['TIPO_DESCARGA',          'TIPO DESCARGA',             18, false, 'Continua',                       'Ej: Continua, Intermitente, Permanente'],
        ['MEDICION_CAUDAL',        'MEDICIÓN CAUDAL',           18, false, 'Automático',                     'Manual / Automático / No Aplica'],
        ['ES_ETFA',                'ES ETFA',                   10, false, 'Si',                             'Si o No'],
        // ── TÉCNICO ──
        ['INSTRUMENTO_AMBIENTAL',  'INSTRUMENTO AMBIENTAL',     28, false, 'D.S 90',                         'Ej: D.S. N° 90, D.S. N° 46'],
        ['NORMATIVA_REFERENCIA',   'NORMATIVA REFERENCIA',      30, false, 'Resolución SISS N° 3360/2011',  'Resolución específica del punto'],
        ['RESPONSABLE_MUESTREO',   'RESP. MUESTREO',            18, false, 'ADL Diagnostic',                 'Ej: ADL Diagnostic, Contratante, Laboratorio'],
        ['INSPECTOR',              'INSPECTOR AMBIENTAL',        22, false, 'Pablo Flores',                   ''],
        ['MODALIDAD',              'MODALIDAD',                 18, false, 'Autocontrol',                    ''],
        ['FORMA_CANAL',            'FORMA CANAL',               16, false, '',                               'Ej: Rectangular, Circular'],
        ['DISPOSITIVO',            'DISPOSITIVO HIDRÁULICO',    22, false, '',                               ''],
        // ── COORDENADAS / UBICACIÓN ──
        ['UTM_ZONA',               'UTM ZONA',                  12, false, '18S',                            ''],
        ['UTM_NORTE',              'UTM NORTE',                 14, false, '5426758',                        ''],
        ['UTM_ESTE',               'UTM ESTE',                  14, false, '711953',                         ''],
        ['REF_GOOGLE',             'LINK GOOGLE MAPS',          38, false, 'https://maps.app.goo.gl/...',   'URL completa de Google Maps'],
        // ── OBSERVACIONES ──
        ['OBSERVACIONES',          'OBSERVACIONES',             40, false, 'Límite normativo pH: 6,0 - 8,5',''],
    ];

    // Row 1 title
    ws1.mergeCells(`A1:${colNum2Letter(fichaColumns.length)}1`);
    const t1 = ws1.getCell('A1');
    t1.value = '📋 ADL ONE — Carga Masiva de Fichas  |  Hoja 1: FICHAS (una fila = una ficha)';
    t1.font = { bold:true, size:12, color:{argb:COLORS.headerFont}, name:'Calibri' };
    t1.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.headerBg} };
    t1.alignment = { vertical:'middle', horizontal:'center' };
    ws1.getRow(1).height = 28;

    // Row 2 note
    ws1.mergeCells(`A2:${colNum2Letter(fichaColumns.length)}2`);
    const n1 = ws1.getCell('A2');
    n1.value = '⚠️  Campos con * son OBLIGATORIOS. Los textos se buscan automáticamente en catálogos (no requieren ser exactos). El ID_MUESTRA debe coincidir con la Hoja 2.';
    n1.font = { size:9, italic:true, color:{argb:COLORS.warnFont}, name:'Calibri' };
    n1.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.warnBg} };
    n1.alignment = { vertical:'middle', horizontal:'left', wrapText:true };
    ws1.getRow(2).height = 22;

    // Row 3 headers
    const hr1 = ws1.getRow(3);
    hr1.height = 32;
    fichaColumns.forEach(([key, header, width, req], i) => {
        const cell = hr1.getCell(i+1);
        cell.value = req ? `${header} *` : header;
        cell.font = headerFont;
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.headerBg} };
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = thinBorder;
        ws1.getColumn(i+1).width = width;
    });

    // Row 4 example
    const er1 = ws1.getRow(4);
    er1.height = 20;
    fichaColumns.forEach(([key, header, width, req, example], i) => {
        const cell = er1.getCell(i+1);
        cell.value = example;
        cell.font = exampleFont;
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb: i===0 ? COLORS.linkedCol : req ? COLORS.requiredBg : COLORS.optionalBg} };
        cell.alignment = { vertical:'middle', horizontal:'left' };
        cell.border = thinBorder;
    });

    // Data rows 5-104
    for (let r = 5; r <= 104; r++) {
        const row = ws1.getRow(r);
        row.height = 18;
        fichaColumns.forEach(([key, header, width, req], i) => {
            const cell = row.getCell(i+1);
            cell.font = normalFont;
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb: i===0 ? COLORS.linkedCol : req ? COLORS.requiredBg : COLORS.optionalBg} };
            cell.alignment = { vertical:'middle', horizontal:'left' };
            cell.border = thinBorder;
        });
    }

    // Validations sheet 1
    const tipoMonCol = colNum2Letter(fichaColumns.findIndex(c=>c[0]==='TIPO_MONITOREO')+1);
    const caudalCol  = colNum2Letter(fichaColumns.findIndex(c=>c[0]==='MEDICION_CAUDAL')+1);
    const etfaCol    = colNum2Letter(fichaColumns.findIndex(c=>c[0]==='ES_ETFA')+1);
    ws1.dataValidations.add(`${tipoMonCol}4:${tipoMonCol}104`, { type:'list', allowBlank:true, formulae:['"Puntual,Compuesto,Compuesta"'] });
    ws1.dataValidations.add(`${caudalCol}4:${caudalCol}104`,   { type:'list', allowBlank:true, formulae:['"Manual,Automático,No Aplica"'] });
    ws1.dataValidations.add(`${etfaCol}4:${etfaCol}104`,      { type:'list', allowBlank:true, formulae:['"Si,No"'] });

    // ═══════════════════════════════════════════════════════
    // SHEET 2: ANALISIS
    // ═══════════════════════════════════════════════════════
    const ws2 = workbook.addWorksheet('ANALISIS', {
        views: [{ state:'frozen', xSplit:2, ySplit:3 }],
        properties: { tabColor: { argb: COLORS.sheet2Bg } }
    });

    const analisisColumns = [
        ['ID_MUESTRA',      'ID MUESTRA',         14, true,  'M-001',              '← Mismo ID que Hoja 1'],
        ['NOMBRE_ANALISIS', 'NOMBRE ANÁLISIS',     30, true,  'DBO5',               'Ej: pH, DBO5, Coliformes Fecales, SST'],
        ['TIPO_ANALISIS',   'TIPO ANÁLISIS',       18, true,  'Laboratorio',        'Terreno o Laboratorio'],
        ['LABORATORIO',     'LABORATORIO 1',       26, true,  'Hidrolab',           'Matching automático con catálogo'],
        ['TIPO_ENTREGA',    'TIPO ENTREGA',        18, true,  'Transporte',         'No Aplica / Transporte / Directa'],
        ['NORMATIVA',       'NORMATIVA',           22, false, 'D.S 90',             'Normativa del análisis (matching automático)'],
        ['REFERENCIA',      'REFERENCIA NORMATIVA',26, false, 'DS 90 Tabla 1',     'Tabla o artículo específico'],
        ['LABORATORIO_2',   'LABORATORIO 2',       22, false, '',                   'Segundo laboratorio (si aplica)'],
        ['UF_INDIVIDUAL',   'UF INDIVIDUAL',       14, false, '0.5',                'Valor UF por análisis (solo área Comercial)'],
    ];

    ws2.mergeCells('A1:I1');
    const t2 = ws2.getCell('A1');
    t2.value = '🧪 ADL ONE — Carga Masiva de Fichas  |  Hoja 2: ANALISIS (una fila = un análisis)';
    t2.font = { bold:true, size:12, color:{argb:COLORS.headerFont}, name:'Calibri' };
    t2.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.sheet2Bg} };
    t2.alignment = { vertical:'middle', horizontal:'center' };
    ws2.getRow(1).height = 28;

    ws2.mergeCells('A2:I2');
    const n2 = ws2.getCell('A2');
    n2.value = '⚠️  Una fila por análisis. Repita el ID_MUESTRA tantas veces como análisis tenga la ficha. El ID debe coincidir EXACTAMENTE con la Hoja 1.';
    n2.font = { size:9, italic:true, color:{argb:COLORS.warnFont}, name:'Calibri' };
    n2.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.warnBg} };
    n2.alignment = { vertical:'middle', horizontal:'left', wrapText:true };
    ws2.getRow(2).height = 22;

    const hr2 = ws2.getRow(3);
    hr2.height = 32;
    analisisColumns.forEach(([key, header, width, req], i) => {
        const cell = hr2.getCell(i+1);
        cell.value = req ? `${header} *` : header;
        cell.font = headerFont;
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:COLORS.sheet2Bg} };
        cell.alignment = { vertical:'middle', horizontal:'center', wrapText:true };
        cell.border = thinBorder;
        ws2.getColumn(i+1).width = width;
    });

    // Example rows (from the actual PDF)
    const exRows = [
        ['M-001', 'pH',                        'Terreno',    'ADL Diagnostic', 'No Aplica', 'D.S 90', 'DS 90 Tabla 1', '',         ''],
        ['M-001', 'Temperatura',                'Terreno',    'ADL Diagnostic', 'No Aplica', 'D.S 90', 'DS 90 Tabla 1', '',         ''],
        ['M-001', 'Caudal',                     'Terreno',    'ADL Diagnostic', 'No Aplica', 'D.S 90', '',              '',         ''],
        ['M-001', 'Aceites y Grasas',           'Laboratorio','Hidrolab',        'Transporte','D.S 90', 'DS 90 Tabla 1', '',         '0.5'],
        ['M-001', 'DBO5',                       'Laboratorio','Hidrolab',        'Transporte','D.S 90', 'DS 90 Tabla 1', '',         '0.5'],
        ['M-001', 'Nitrógeno Total Kjeldahl',   'Laboratorio','Hidrolab',        'Transporte','D.S 90', 'DS 90 Tabla 1', '',         '0.5'],
        ['M-001', 'Sólidos Suspendidos Totales','Laboratorio','Hidrolab',        'Transporte','D.S 90', 'DS 90 Tabla 1', '',         '0.5'],
        ['M-001', 'Fósforo Total',              'Laboratorio','Hidrolab',        'Transporte','D.S 90', 'DS 90 Tabla 1', '',         '0.5'],
        ['M-001', 'Cloruros',                   'Laboratorio','Hidrolab',        'Transporte','D.S 90', 'DS 90 Tabla 1', '',         '0.5'],
    ];

    exRows.forEach((rowData, rowIdx) => {
        const row = ws2.getRow(4 + rowIdx);
        row.height = 18;
        rowData.forEach((val, colIdx) => {
            const cell = row.getCell(colIdx+1);
            cell.value = val;
            cell.font = exampleFont;
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb: colIdx < 2 ? COLORS.linkedCol : COLORS.optionalBg} };
            cell.alignment = { vertical:'middle', horizontal:'left' };
            cell.border = thinBorder;
        });
    });

    // Data rows
    for (let r = 4 + exRows.length; r <= 508; r++) {
        const row = ws2.getRow(r);
        row.height = 18;
        analisisColumns.forEach(([key, hdr, width, req], i) => {
            const cell = row.getCell(i+1);
            cell.font = normalFont;
            cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb: i < 2 ? COLORS.linkedCol : req ? COLORS.requiredBg : COLORS.optionalBg} };
            cell.alignment = { vertical:'middle', horizontal:'left' };
            cell.border = thinBorder;
        });
    }

    ws2.dataValidations.add('C4:C508', { type:'list', allowBlank:false, formulae:['"Terreno,Laboratorio"'] });
    ws2.dataValidations.add('E4:E508', { type:'list', allowBlank:false, formulae:['"No Aplica,Transporte,Directa"'] });

    // ═══════════════════════════════════════════════════════
    // SHEET 3: INSTRUCCIONES
    // ═══════════════════════════════════════════════════════
    const ws3 = workbook.addWorksheet('INSTRUCCIONES', {
        properties: { tabColor: { argb:'E67E22' } }
    });
    ws3.getColumn(1).width = 90;
    const instRows = [
        ['📖 INSTRUCCIONES — Plantilla Carga Masiva ADL ONE', true, 13, COLORS.headerBg, COLORS.headerFont],
        ['', false, 10, 'FFFFFF', '000000'],
        ['HOJA 1 "FICHAS" — una fila por ficha:', true, 11, COLORS.sheet2Bg, COLORS.headerFont],
        ['  1. El ID_MUESTRA (col A) es un código que usted define libremente. Ej: M-001, LAGOVERDE-ENE26.', false, 10, 'F0FFF4', '1B4332'],
        ['  2. Los campos marcados con * son obligatorios. Sin ellos la ficha no podrá crearse.', false, 10, 'F0FFF4', '1B4332'],
        ['  3. Los textos (Empresa, Centro, Laboratorio, etc.) se buscan automáticamente. No necesitan ser exactos.', false, 10, 'F0FFF4', '1B4332'],
        ['  4. Para TIPO_MONITOREO use: Puntual / Compuesto / Compuesta', false, 10, 'F0FFF4', '1B4332'],
        ['  5. Para MEDICION_CAUDAL use: Manual / Automático / No Aplica', false, 10, 'F0FFF4', '1B4332'],
        ['  6. Para ES_ETFA use: Si / No', false, 10, 'F0FFF4', '1B4332'],
        ['', false, 10, 'FFFFFF', '000000'],
        ['HOJA 2 "ANALISIS" — una fila por análisis:', true, 11, COLORS.headerBg, COLORS.headerFont],
        ['  1. El ID_MUESTRA (col A) debe coincidir EXACTAMENTE con el de la Hoja 1.', false, 10, 'EBF5FB', '1A5276'],
        ['  2. Una ficha puede tener múltiples análisis: repita el mismo ID_MUESTRA en cada fila.', false, 10, 'EBF5FB', '1A5276'],
        ['  3. Para TIPO_ANÁLISIS use: Terreno / Laboratorio', false, 10, 'EBF5FB', '1A5276'],
        ['  4. Para TIPO_ENTREGA use: No Aplica / Transporte / Directa', false, 10, 'EBF5FB', '1A5276'],
        ['', false, 10, 'FFFFFF', '000000'],
        ['EJEMPLO REAL (basado en PDF Piscicultura Lago Verde):', true, 11, '7D3C98', COLORS.headerFont],
        ['  Hoja 1, fila 4: M-001 | ADL Diagnostic | Invermar S.A. | Piscicultura Lago Verde | Puerto Montt | Autocontrol | ...', false, 9, 'F5EEF8', '4A235A'],
        ['  Hoja 2, fila 4: M-001 | pH              | Terreno     | ADL Diagnostic | No Aplica | D.S 90', false, 9, 'F5EEF8', '4A235A'],
        ['  Hoja 2, fila 5: M-001 | DBO5            | Laboratorio | Hidrolab       | Transporte | D.S 90', false, 9, 'F5EEF8', '4A235A'],
        ['  Hoja 2, fila 6: M-001 | Aceites y Grasas| Laboratorio | Hidrolab       | Transporte | D.S 90', false, 9, 'F5EEF8', '4A235A'],
    ];

    instRows.forEach(([text, bold, size, bgColor, fontColor], i) => {
        const cell = ws3.getCell(`A${i+1}`);
        cell.value = text;
        cell.font = { bold, size, name:'Calibri', color:{argb:fontColor} };
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{argb:bgColor} };
        cell.alignment = { vertical:'middle', horizontal:'left', indent:1 };
        ws3.getRow(i+1).height = size >= 13 ? 28 : 20;
    });

    // Save
    const outputPath = 'C:\\Users\\vremolcoy\\Desktop\\ADL ONE\\Formato_Carga_Masiva_ADL.xlsx';
    await workbook.xlsx.writeFile(outputPath);
    console.log(`✅ Archivo generado: ${outputPath}`);
    console.log(`   Hoja 1 FICHAS: ${fichaColumns.length} columnas`);
    console.log(`   Hoja 2 ANALISIS: ${analisisColumns.length} columnas`);
}

function colNum2Letter(num) {
    let letter = '';
    while (num > 0) {
        const mod = (num - 1) % 26;
        letter = String.fromCharCode(65 + mod) + letter;
        num = Math.floor((num - 1) / 26);
    }
    return letter;
}

generateTemplate().catch(console.error);
