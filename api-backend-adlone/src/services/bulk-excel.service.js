import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import bulkFichaService from './bulk-ficha.service.js';
import ExcelJS from 'exceljs';

class BulkExcelService {
    
    // Normalize string for matching (simpler version for strict columns)
    normalize(str) {
        if (!str) return '';
        return String(str)
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .trim();
    }

    // Attempt to match an Excel cell string to a catalog
    matchCatalog(value, catalog, nameKey = 'nombre', idKey = 'id', minScore = 80) {
        if (!value) return null;
        const normVal = this.normalize(value);
        if (!normVal || normVal === 'NO APLICA' || normVal === 'N/A') return null;

        const valWords = normVal.split(/\s+/).filter(w => w.length > 1);
        if (valWords.length === 0 && normVal.length > 0) valWords.push(normVal); // Handle single short words

        let bestMatch = null;
        let bestScore = 0;

        for (const item of catalog) {
            const itemNameOrig = item[nameKey] || '';
            const itemName = this.normalize(itemNameOrig);
            
            // 1. Exact Match
            if (itemName === normVal) {
                return { id: item[idKey], nombre: itemNameOrig, score: 100, extra: item };
            }
            
            // 2. Word Intersection Match (Handles "Pisc. Lago Verde" vs "Piscicultura Lago Verde")
            const itemWords = itemName.split(/\s+/).filter(w => w.length > 1);
            if (itemWords.length === 0 && itemName.length > 0) itemWords.push(itemName);
            
            // Check how many words from val match item words (or start with them)
            let matches = 0;
            for (const vw of valWords) {
                if (itemWords.some(iw => iw.startsWith(vw) || vw.startsWith(iw))) {
                    matches++;
                }
            }
            
            const score = (matches / Math.max(valWords.length, itemWords.length)) * 100;
            
            if (score > bestScore && score >= minScore) {
                bestScore = score;
                bestMatch = { id: item[idKey], nombre: itemNameOrig, score, extra: item };
            }
        }
        
        return bestMatch;
    }

    async processExcelFile(fileBuffer) {
        logger.info('[BulkExcel] Processing Excel upload...');
        const catalogs = await bulkFichaService.loadCatalogs();
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(fileBuffer);
        
        const wsFichas = workbook.getWorksheet('FICHAS');
        const wsAnalisis = workbook.getWorksheet('ANALISIS');
        
        if (!wsFichas || !wsAnalisis) {
            throw new Error('El archivo Excel no tiene las hojas requeridas: "FICHAS" y "ANALISIS".');
        }

        // Map column names to indexes for FICHAS
        const cmF = {};
        wsFichas.getRow(3).eachCell({includeEmpty: false}, (c, i) => {
            const h = String(c.value||'').replace(/[\r\n🔁✏️\*]/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
            if (h) cmF[h] = i;
        });

        const getCellF = (row, ...headers) => {
            for (const h of headers) {
                const colMatches = Object.keys(cmF).filter(k => k.includes(h.toUpperCase()));
                if (colMatches.length > 0) {
                    const cell = row.getCell(cmF[colMatches[0]]);
                    return cell.value?.result !== undefined ? cell.value.result : cell.value;
                }
            }
            return null;
        };

        // Map column names to indexes for ANALISIS
        const cmA = {};
        wsAnalisis.getRow(3).eachCell({includeEmpty: false}, (c, i) => {
            const h = String(c.value||'').replace(/[\r\n🔁✏️\*]/g,' ').replace(/\s+/g,' ').trim().toUpperCase();
            if (h) cmA[h] = i;
        });

        const getCellA = (row, ...headers) => {
            for (const h of headers) {
                const colMatches = Object.keys(cmA).filter(k => k.includes(h.toUpperCase()));
                if (colMatches.length > 0) {
                    const cell = row.getCell(cmA[colMatches[0]]);
                    return cell.value?.result !== undefined ? cell.value.result : cell.value;
                }
            }
            return null;
        };

        // Read all analysis rows and group by ID_MUESTRA
        const analysisRowsMap = {}; // id_muestra -> rows[]
        let rowCount = 4;
        let hasMore = true;
        
        while (hasMore) {
            const row = wsAnalisis.getRow(rowCount);
            const idMuestra = getCellA(row, 'ID MUESTRA');
            
            if (!idMuestra) {
                if (rowCount > 10) hasMore = false; // Stop if empty rows
                rowCount++;
                continue;
            }
            
            const rawId = String(idMuestra).trim();
            if (!analysisRowsMap[rawId]) analysisRowsMap[rawId] = [];
            
            analysisRowsMap[rawId].push({
                nombre: getCellA(row, 'NOMBRE ANÁLISIS'),
                tipo_analisis: getCellA(row, 'TIPO ANÁLISIS') || 'Terreno',
                laboratorio_texto: getCellA(row, 'LABORATORIO 1', 'LABORATORIO'),
                tipo_entrega_texto: getCellA(row, 'TIPO ENTREGA'),
                normativa: getCellA(row, 'NORMATIVA'),
                referencia: getCellA(row, 'REFERENCIA NORMATIVA'),
                // UF INDIVIDUAL is now directly entered by user per analysis row (no auto-distribution)
                uf_individual: parseFloat(getCellA(row, 'UF INDIVIDUAL') || 0) || 0
            });
            
            rowCount++;
        }

        // Process FICHAS
        const results = [];
        rowCount = 4;
        hasMore = true;

        while (hasMore) {
            const row = wsFichas.getRow(rowCount);
            const idMuestra = getCellF(row, 'ID MUESTRA');
            
            if (!idMuestra) {
                if (rowCount > 10) hasMore = false;
                rowCount++;
                continue;
            }

            const rawId = String(idMuestra).trim();
            const result = {
                filename: `Excel_Ficha_${rawId}`,
                status: 'READY',
                errors: [],
                warnings: [],
                antecedentes: {},
                analisis: [],
                observaciones: ''
            };

            const fields = result.antecedentes;
            const errs = result.errors;
            const warns = result.warnings;

            // Capture Observaciones
            fields.observaciones = getCellF(row, 'OBSERVACIONES') || '';
            result.observaciones = fields.observaciones;

            // Simple parsing to match the expected format of FI_CREAR

            // 1. Cliente (Empresa a Facturar)
            const clienteVal = getCellF(row, 'EMPRESA A FACTURAR');
            const clienteMatch = this.matchCatalog(clienteVal, catalogs.clientes);
            if (clienteMatch) {
                fields.selectedCliente = String(clienteMatch.id);
                fields._clienteNombre = clienteMatch.nombre;
                fields._clienteMatch_method = clienteMatch.score === 100 ? 'exact' : 'fuzzy';
            } else {
                errs.push({ field: 'Empresa a facturar', message: `No se encontró: ${clienteVal}` });
            }

            // 2. Empresa Servicio
            const empServVal = getCellF(row, 'EMPRESA DE SERVICIO');
            const empServMatch = this.matchCatalog(empServVal, catalogs.empresasServicio);
            if (empServMatch) {
                fields.selectedEmpresa = String(empServMatch.id);
                fields._empresaNombre = empServMatch.nombre;
            } else {
                errs.push({ field: 'Empresa de servicio', message: `No se encontró: ${empServVal}` });
            }

            // 3. Fuente Emisora (Centro)
            const centroVal = getCellF(row, 'CENTRO', 'FUENTE EMISORA');
            let centrosToSearch = catalogs.centros;
            if (clienteMatch) {
                centrosToSearch = catalogs.centros.filter(c => String(c.id_empresa) === String(clienteMatch.id));
            }
            
            const centroMatch = this.matchCatalog(centroVal, centrosToSearch);

            if (centroMatch) {
                fields.selectedFuente = String(centroMatch.id);
                fields._fuenteNombre = centroMatch.nombre;
                fields._fuenteMatch_method = centroMatch.score === 100 ? 'exact' : 'fuzzy';
                const c = centroMatch.extra;
                fields.tipoAgua = (c.tipo_agua || '').trim();
                fields.idTipoAgua = c.id_tipoagua || null;
                // Correct field name from catalog item (it was dir || ubi)
                fields.ubicacion = (c.direccion || '').trim();
                fields.comuna = (c.comuna || 'No informado').trim();
                fields.region = (c.region || 'No informado').trim();
            } else {
                errs.push({ field: 'Fuente emisora', message: `No se encontró un centro para este cliente que coincida con: ${centroVal}` });
            }

            // UF DISTRIBUIR column has been removed. UF is now per-analysis only.

            // 4. Base de Operaciones
            const lugarVal = getCellF(row, 'BASE DE OPERACIONES');
            const lugarMatch = this.matchCatalog(lugarVal, catalogs.lugares);
            if (lugarMatch) {
                fields.selectedLugar = String(lugarMatch.id);
                fields._lugarNombre = lugarMatch.nombre;
                fields._lugarMatch_method = lugarMatch.score === 100 ? 'exact' : 'fuzzy';
            } else {
                errs.push({ field: 'Base de operaciones', message: `No se encontró: ${lugarVal}` });
            }

            // 5. Objetivo
            const objVal = getCellF(row, 'OBJETIVO MUESTREO');
            const objMatch = this.matchCatalog(objVal, catalogs.objetivos);
            if (objMatch) {
                fields.selectedObjetivo = String(objMatch.id);
                fields._objetivoNombre = objMatch.nombre;
            } else {
                errs.push({ field: 'Objetivo Muestreo', message: `No se encontró: ${objVal}` });
            }

            // 6. Monitoreo
            const monVal = String(getCellF(row, 'MONITOREO') || '').toUpperCase();
            fields.tipoMonitoreo = monVal.includes('COMPUEST') ? 'Compuesta' : 'Puntual';

            // 7. Frecuencia y Factor
            const freqVal = getCellF(row, 'FRECUENCIA PERÍODO', 'FRECUENCIA PERIODO');
            const freqMatch = this.matchCatalog(freqVal, catalogs.frecuencias);
            if (freqMatch) {
                fields.periodo = String(freqMatch.id);
                fields._periodoNombre = freqMatch.nombre;
                fields.frecuencia = String(getCellF(row, 'FREC. MUESTREO') || freqMatch.extra?.cantidad || 1);
                fields.factor = String(getCellF(row, 'FACTOR') || freqMatch.extra?.multiplicadopor || 1);
            } else {
                fields.periodo = null;
                fields._periodoNombre = freqVal || 'No Encontrado';
                fields.frecuencia = String(getCellF(row, 'FREC. MUESTREO') || 1);
                fields.factor = String(getCellF(row, 'FACTOR') || 1);
            }
            fields.totalServicios = String((parseInt(fields.frecuencia) || 1) * (parseInt(fields.factor) || 1));

            // 8. Contacto
            fields.contactoNombre = getCellF(row, 'CONTACTO NOMBRE') || '';
            fields.contactoEmail = getCellF(row, 'CONTACTO EMAIL') || '';
            if (fields.contactoEmail && catalogs.contactos) {
                const byEmail = catalogs.contactos.find(c => String(c.email).toLowerCase() === String(fields.contactoEmail).toLowerCase());
                if (byEmail) fields.selectedContacto = String(byEmail.id);
            }

            // 9. Extra fields
            const etfaVal = String(getCellF(row, 'ETFA') || '').toUpperCase();
            fields.esETFA = (etfaVal.startsWith('S') || etfaVal.includes('SI')) ? 'Si' : 'No';
            fields.puntoMuestreo = getCellF(row, 'PUNTO DE MUESTREO') || 'Sin determinar';
            fields.duracion = String(getCellF(row, 'DURACIÓN', 'DURACION') || '24');
            fields.medicionCaudal = getCellF(row, 'MEDICION CAUDAL') || 'No Aplica';
            fields.responsableMuestreo = getCellF(row, 'RESPONSABLE') || 'ADL Diagnostic';
            fields.glosa = getCellF(row, 'NOMBRE TABLA') || (fields._fuenteNombre && fields._objetivoNombre ? `${fields._fuenteNombre} - ${fields._objetivoNombre}` : 'Carga Masiva Excel');
            
            // Instrumento
            const instVal = getCellF(row, 'INSTRUMENTO AMBIENTAL');
            if (instVal) {
                fields.instrumentoFull = instVal;
                // Try to match or just use as is
                const instMatch = this.matchCatalog(instVal, catalogs.instrumentos);
                if (instMatch) {
                    fields.selectedInstrumento = instMatch.nombre;
                } else {
                    fields.selectedInstrumento = instVal;
                }
            }
            
            // Coords
            const utmZ = String(getCellF(row, 'ZONA UTM') || '18H');
            fields.zona = utmZ.endsWith('H') || utmZ.endsWith('G') ? utmZ : utmZ.replace(/[^0-9]/g, '') + 'H';
            fields.utmNorte = getCellF(row, 'UTM NORTE') || '';
            fields.utmEste = getCellF(row, 'UTM ESTE') || '';
            fields.refGoogle = getCellF(row, 'REF. GOOGLE') || '';

            // Componente
            const compVal = getCellF(row, 'COMPONENTE AMBIENTAL');
            const compMatch = this.matchCatalog(compVal, catalogs.componentes);
            if (compMatch) {
                fields.selectedComponente = String(compMatch.id);
                fields._componenteNombre = compMatch.nombre;
            }

            // Sub Area
            const subVal = getCellF(row, 'SUB ÁREA', 'SUB AREA');
            const subMatch = this.matchCatalog(subVal, catalogs.subAreas);
            if (subMatch) {
                fields.selectedSubArea = String(subMatch.id);
                fields._subAreaNombre = subMatch.nombre;
            }

            // Inspector
            const inspVal = getCellF(row, 'INSPECTOR');
            const inspMatch = this.matchCatalog(inspVal, catalogs.inspectores);
            if (inspMatch) {
                fields.selectedInspector = String(inspMatch.id);
                fields._inspectorNombre = inspMatch.nombre;
            }

            // Tipo Muestreo
            const tmVal = getCellF(row, 'TIPO DE MUESTREO');
            const tmMatch = this.matchCatalog(tmVal, catalogs.tiposMuestreo);
            if (tmMatch) {
                fields.selectedTipoMuestreo = String(tmMatch.id);
                fields._tipoMuestreoNombre = tmMatch.nombre;
            }

            // Cargo
            const cargoVal = getCellF(row, 'CARGO');
            const cargoMatch = this.matchCatalog(cargoVal, catalogs.cargos);
            if (cargoMatch) {
                fields.cargoResponsable = String(cargoMatch.id);
                fields._cargoNombre = cargoMatch.nombre;
            } else if (cargoVal) {
                fields.cargoResponsable = cargoVal; // Store raw if no match but not empty
            }

            // Tipo Muestra (Specific for MA)
            const tmuVal = getCellF(row, 'TIPO DE MUESTRA');
            const tmuMatch = this.matchCatalog(tmuVal, catalogs.tiposMuestra);
            if (tmuMatch) {
                fields.selectedTipoMuestra = String(tmuMatch.id);
                fields._tipoMuestraNombre = tmuMatch.nombre;
            }

            // Actividad
            const actVal = getCellF(row, 'ACTIVIDAD');
            const actMatch = this.matchCatalog(actVal, catalogs.actividades);
            if (actMatch) {
                fields.selectedActividad = String(actMatch.id);
                fields._actividadNombre = actMatch.nombre;
            }

            // Resolve Analysis
            const excelAnalysisRows = analysisRowsMap[rawId] || [];
            if (excelAnalysisRows.length === 0) {
                errs.push({ field: 'Análisis', message: `No se encontraron análisis en la Hoja 2 para el ID ${rawId}` });
            }

            // Reuse existing resolve logic from BulkFichaService for analysis
            try {
                // Combine all unique normativa/referencia names to help the resolver find the correct one
                const contextText = Array.from(new Set([
                    ...excelAnalysisRows.map(r => r.normativa),
                    ...excelAnalysisRows.map(r => r.referencia)
                ])).filter(Boolean).join(' ');

                const { 
                    resolved, 
                    errors: analysisErrs, 
                    normativaId, 
                    normativaNombre, 
                    normativaRefId, 
                    normativaRefNombre 
                } = await bulkFichaService.resolveAnalysisRows(excelAnalysisRows, catalogs, contextText);
                
                result.analisis = resolved;
                
                // Override individual UFs with Excel values
                for (let i = 0; i < resolved.length; i++) {
                    if (resolved[i]._matched) {
                        resolved[i].uf_individual = excelAnalysisRows[i]?.uf_individual || 0;
                    }
                }
                
                result.analysisErrors = analysisErrs;
                
                // Compute total UF for this ficha (sum of all uf_individual)
                result._ufTotal = (result.analisis || []).reduce((sum, a) => sum + (parseFloat(a.uf_individual) || 0), 0);


                if (normativaId) fields.selectedNormativa = String(normativaId);
                if (normativaRefId) fields.selectedNormativaRef = String(normativaRefId);
                fields._normativaNombre = normativaNombre;
                fields._normativaRefNombre = normativaRefNombre;
                result._normativa = normativaNombre;
                result._normativaRef = normativaRefNombre;

            } catch (e) {
                errs.push({ field: 'Análisis', message: 'Error al resolver los análisis: ' + e.message });
            }

            // Determine status
            const criticalErrors = result.errors.filter(e =>
                ['Empresa de servicio', 'Empresa a facturar', 'Fuente emisora'].includes(e.field)
            );
            const unmatchedAnalysis = (result.analisis || []).filter(r => !r._matched);

            if (criticalErrors.length > 0 || result.errors.length > 0) {
                result.status = 'ERROR';
            } else if (unmatchedAnalysis.length > 0 || result.warnings.length > 0) {
                result.status = 'WARNING';
            } else {
                result.status = 'READY';
            }

            results.push(result);
            if (results.length >= 100) {
                logger.warn(`[BulkExcel] Reached max batch limit of 100 fichas — truncating.`);
                hasMore = false;
            }
            rowCount++;
        }

        const ready = results.filter(r => r.status === 'READY').length;
        const warn = results.filter(r => r.status === 'WARNING').length;
        const err = results.filter(r => r.status === 'ERROR').length;
        logger.info(`[BulkExcel] Batch complete: ${ready} ready, ${warn} warnings, ${err} errors`);

        return {
            total: results.length,
            ready,
            warnings: warn,
            errors: err,
            items: results
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // generateTemplate: Build a fresh Excel template with DB-populated masters
    // ─────────────────────────────────────────────────────────────────────────
    async generateTemplate() {
        logger.info('[BulkExcel] Generating Excel template with live DB data...');

        // Load catalogs (reuse existing method - already loads clientes, empresasServicio, centros)
        const catalogs = await bulkFichaService.loadCatalogs();

        // Load base template from disk
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        // Template is at: <project-root>/Formato_Carga_Masiva_ADL_test_oficial.xlsx
        const templatePath = path.join(__dirname, '..', '..', '..', 'Formato_Carga_Masiva_ADL_test_oficial.xlsx');

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(templatePath);

        // ── Helper styles ──────────────────────────────────────────────────
        const MASTER_HEAD_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF203864' } };
        const MASTER_HEAD_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 10 };
        const DATA_FILL        = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        const DATA_FONT        = { name: 'Calibri', size: 10 };
        const THIN_BORDER      = {
            top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
            left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
            bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
            right:  { style: 'thin', color: { argb: 'FFBFBFBF' } }
        };
        const CENTER = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const WRAP   = { horizontal: 'left',   vertical: 'middle', wrapText: true };

        const applyHeaderCell = (cell, text) => {
            cell.value     = text;
            cell.fill      = MASTER_HEAD_FILL;
            cell.font      = MASTER_HEAD_FONT;
            cell.border    = THIN_BORDER;
            cell.alignment = CENTER;
        };

        const applyDataCell = (cell, value) => {
            cell.value     = value ?? '';
            cell.fill      = DATA_FILL;
            cell.font      = DATA_FONT;
            cell.border    = THIN_BORDER;
            cell.alignment = WRAP;
        };

        // ── Helper: rebuild a master sheet entirely ────────────────────────
        const rebuildMasterSheet = (sheetName, titleText, rows, colWidths) => {
            // Remove old and recreate to avoid stale data
            const existing = wb.getWorksheet(sheetName);
            if (existing) wb.removeWorksheet(existing.id);
            const ws = wb.addWorksheet(sheetName, { state: 'visible' });

            const colCount = rows[0]?.length || 1;

            // Row 1: Title
            ws.getCell('A1').value     = titleText;
            ws.getCell('A1').font      = { bold: true, size: 12, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
            ws.getCell('A1').fill      = MASTER_HEAD_FILL;
            ws.getCell('A1').alignment = CENTER;
            if (colCount > 1) ws.mergeCells(1, 1, 1, colCount);
            ws.getRow(1).height = 28;

            // Row 2: Note
            ws.getCell('A2').value     = '⚠️ Hoja de referencia — Los valores de esta columna son los válidos para usar en la hoja FICHAS.';
            ws.getCell('A2').font      = { italic: true, size: 9, color: { argb: 'FF555555' } };
            ws.getCell('A2').alignment = WRAP;
            if (colCount > 1) ws.mergeCells(2, 1, 2, colCount);
            ws.getRow(2).height = 30;

            // Row 3: Column headers
            rows[0].forEach((h, ci) => applyHeaderCell(ws.getRow(3).getCell(ci + 1), h));
            ws.getRow(3).height = 24;

            // Data rows (rows 4+)
            for (let ri = 1; ri < rows.length; ri++) {
                const dataRow = ws.getRow(ri + 3);
                rows[ri].forEach((val, ci) => applyDataCell(dataRow.getCell(ci + 1), val));
                dataRow.height = 20;
            }

            // Column widths
            (colWidths || [35]).forEach((w, ci) => { ws.getColumn(ci + 1).width = w; });

            return ws;
        };

        // ── 1. MAESTRO_EMP_FACTURAR (Empresa a Facturar = Clientes) ───────
        const empFactRows = [
            ['Nombre Empresa a Facturar'],
            ...catalogs.clientes.map(c => [c.nombre])
        ];
        const wsEF = rebuildMasterSheet(
            'MAESTRO_EMP_FACTURAR',
            'MAESTRO: Empresas a Facturar (Clientes)',
            empFactRows,
            [50]
        );

        // ── 2. MAESTRO_EMP_SERVICIO ────────────────────────────────────────
        const empServRows = [
            ['Nombre Empresa de Servicio'],
            ...catalogs.empresasServicio.map(e => [e.nombre])
        ];
        const wsES = rebuildMasterSheet(
            'MAESTRO_EMP_SERVICIO',
            'MAESTRO: Empresas de Servicio',
            empServRows,
            [40]
        );

        // ── 3. MAESTRO_CENTROS ─────────────────────────────────────────────
        const centrosRows = [
            ['Nombre Centro / Fuente Emisora', 'Empresa Propietaria', 'Comuna', 'Región'],
            ...catalogs.centros.map(c => {
                const empNombre = catalogs.clientes.find(cl => String(cl.id) === String(c.id_empresa))?.nombre || '';
                return [c.nombre, empNombre, c.comuna, c.region];
            })
        ];
        const wsC = rebuildMasterSheet(
            'MAESTRO_CENTROS',
            'MAESTRO: Centros / Fuentes Emisoras',
            centrosRows,
            [50, 40, 25, 20]
        );

        // ── Update data validations in FICHAS to point to new master ranges ─
        const wsFichas = wb.getWorksheet('FICHAS');
        if (wsFichas) {
            const efCount  = empFactRows.length  - 1; // exclude header
            const esCount  = empServRows.length  - 1;
            const ctCount  = centrosRows.length  - 1;

            const DATA_START = 4;
            const DATA_END   = 2003; // Up to 2000 fichas

            const colLetter = (n) => {
                let s = '';
                while (n > 0) {
                    const rem = (n - 1) % 26;
                    s = String.fromCharCode(65 + rem) + s;
                    n = Math.floor((n - 1) / 26);
                }
                return s;
            };

            // Find column indices from header row 3
            const cmF = {};
            wsFichas.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
                const h = String(c.value || '').replace(/[\r\n🔁✏️\*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
                if (h) cmF[h] = i;
            });

            const empresaServIdx  = cmF['EMPRESA DE SERVICIO'];
            const empresaFactIdx  = cmF['EMPRESA A FACTURAR'];
            const centroIdx       = cmF['CENTRO / FUENTE EMISORA'];

            const setDropdown = (colIdx, formula, title, prompt) => {
                if (!colIdx) return;
                const col = colLetter(colIdx);
                for (let r = DATA_START; r <= DATA_END; r++) {
                    wsFichas.getCell(`${col}${r}`).dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [formula],
                        showErrorMessage: true,
                        errorStyle: 'warning',
                        errorTitle: 'Valor no en maestro',
                        error: `"${title}" no encontrado en el maestro. Puede igualmente ingresarlo y el sistema intentará buscarlo por similitud.`,
                        showInputMessage: true,
                        promptTitle: title,
                        prompt
                    };
                }
            };

            if (empresaFactIdx) setDropdown(empresaFactIdx, `MAESTRO_EMP_FACTURAR!$A$4:$A$${3 + efCount}`, 'Empresa a Facturar', 'Seleccione o escriba el nombre de la empresa a facturar.');
            if (empresaServIdx) setDropdown(empresaServIdx, `MAESTRO_EMP_SERVICIO!$A$4:$A$${3 + esCount}`,  'Empresa de Servicio',  'Seleccione o escriba la empresa de servicio.');
            if (centroIdx)      setDropdown(centroIdx,      `MAESTRO_CENTROS!$A$4:$A$${3 + ctCount}`,       'Centro / Fuente Emisora', 'Seleccione o escriba el centro/fuente emisora.');

            // ── UF TOTAL (AUTO) column ─────────────────────────────────────
            // Place it right after OBSERVACIONES (col 39), at col 40.
            // Formula: =IF(A4="","",SUMIF(ANALISIS!$A:$A, A4, ANALISIS!$I:$I))
            // Col I in ANALISIS = UF INDIVIDUAL (col 9)
            const ufTotalCol   = 40;
            const ufTotalColLt = colLetter(ufTotalCol);

            // Header (row 3)
            const ufHdrCell = wsFichas.getRow(3).getCell(ufTotalCol);
            ufHdrCell.value     = '🔁 UF TOTAL\n(AUTO)';
            ufHdrCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC000' } }; // orange
            ufHdrCell.font      = { bold: true, color: { argb: 'FF000000' }, name: 'Calibri', size: 10 };
            ufHdrCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            ufHdrCell.border    = THIN_BORDER;
            ufHdrCell.protection = { locked: true };

            // Data rows: SUMIF formula + orange read-only style
            const AUTO_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // light yellow-orange
            for (let r = DATA_START; r <= DATA_END; r++) {
                const idCol = colLetter(1); // Column A = ID MUESTRA
                const cell  = wsFichas.getCell(`${ufTotalColLt}${r}`);
                cell.value  = {
                    formula: `IF(${idCol}${r}="","",SUMIF(ANALISIS!$A:$A,${idCol}${r},ANALISIS!$I:$I))`,
                    result: 0
                };
                cell.numFmt     = '#,##0.00';
                cell.fill       = AUTO_FILL;
                cell.font       = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF7B5900' } };
                cell.alignment  = { horizontal: 'right', vertical: 'middle' };
                cell.border     = THIN_BORDER;
                cell.protection = { locked: true };
            }

            // Column width
            wsFichas.getColumn(ufTotalCol).width  = 14;
            wsFichas.getColumn(ufTotalCol).hidden = false;

            // Keep col 41 hidden (old UF TOTAL REAL remnant)
            wsFichas.getColumn(41).hidden = true;

            // ── Sheet protection: col 40 read-only, cols 1-39 editable ──────
            // column.style = { protection: { locked: false } } unlocks ALL cells
            // in that column (including empty ones the user will type into).
            // This is the only reliable approach in ExcelJS.
            for (let c = 1; c <= 39; c++) {
                wsFichas.getColumn(c).style = {
                    protection: { locked: false }
                };
            }
            // Col 40 stays locked (default locked: true) — no need to set explicitly.

            // Protect the sheet — locked cells become read-only, unlocked stay editable.
            // No password so the user can unprotect via Excel if needed.
            wsFichas.protect('', {
                selectLockedCells:   true,   // can click on UF TOTAL to see value
                selectUnlockedCells: true,   // can click and edit all other cells
                formatCells:         true,
                formatColumns:       true,
                formatRows:          true,
                insertRows:          true,
                deleteRows:          true,
                sort:                true,
                autoFilter:          true,
            });
        }

        // ── Serialize to Buffer ────────────────────────────────────────────
        const buffer = await wb.xlsx.writeBuffer();
        logger.info(`[BulkExcel] Template generated: ${empFactRows.length - 1} clientes, ${empServRows.length - 1} empresas, ${centrosRows.length - 1} centros`);
        return buffer;
    }
}

export default new BulkExcelService();
