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

    // Normalizar campos opcionales: "-" o vac\u00edo \u2192 "No Aplica"
    normalizeOptionalField(value) {
        if (!value) return 'No Aplica';
        const str = String(value).trim();
        if (str === '-' || str === '' || this.normalize(str) === 'N/A') return 'No Aplica';
        return str;
    }

    // Attempt to match an Excel cell string to a catalog
    matchCatalog(value, catalog, nameKey = 'nombre', idKey = 'id', minScore = 80) {
        if (!value) return null;
        const normVal = this.normalize(value);
        if (!normVal) return null;
        // Permitir "NO APLICA" y "N/A" — intentar buscar en el catálogo en caso de existir

        let bestMatch = null;
        let bestScore = 0;
        
        const valWords = normVal.split(/\s+/).filter(w => w.length > 1);
        if (valWords.length === 0 && normVal.length > 0) valWords.push(normVal); // Fallback

        for (const item of catalog) {
            const itemNameOrig = item[nameKey] || '';
            const itemName = this.normalize(itemNameOrig);
            
            // 1. Exact Match
            if (itemName === normVal) {
                return { id: item[idKey], nombre: itemNameOrig, score: 100, extra: item };
            }
            
            // 2. Word Intersection Match
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
            
            // 3. Fallback Substring Match (Handles "Centro Pilpilehue" vs "Pilpilehue")
            let finalScore = score;
            if (normVal.length > 4 && itemName.length > 4) {
                if (itemName.includes(normVal) || normVal.includes(itemName)) {
                    const shorter = normVal.length < itemName.length ? normVal : itemName;
                    const longer = normVal.length > itemName.length ? normVal : itemName;
                    
                    // Check if the difference is just generic words
                    const diff = longer.replace(shorter, '').trim();
                    const isNoiseOnly = diff.split(/\s+/).every(w => ['CENTRO', 'PISCICULTURA', 'PISC', 'PLANTA', 'ESTERO', 'RIO', 'LAGO', 'CULTIVO', 'MAR', 'SECTOR', 'DE', 'LA', 'EL', 'LOS', 'LAS'].includes(w));
                    
                    if (isNoiseOnly || diff === '') {
                        finalScore = Math.max(score, 95); // High confidence if only noise separates them
                    } else {
                        finalScore = Math.max(score, 85); // Partial substring match
                    }
                }
            }

            if (finalScore > bestScore && finalScore >= minScore) {
                bestScore = finalScore;
                bestMatch = { id: item[idKey], nombre: itemNameOrig, score: finalScore, extra: item };
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

        const parseCellValue = (val) => {
            if (!val) return null;
            if (val.result !== undefined) return val.result;
            if (val.richText) return val.richText.map(rt => rt.text).join('');
            if (val.text && val.hyperlink) return val.text;
            return val;
        };

        const getCellF = (row, ...headers) => {
            for (const h of headers) {
                const colMatches = Object.keys(cmF).filter(k => k.includes(h.toUpperCase()));
                if (colMatches.length > 0) {
                    const cell = row.getCell(cmF[colMatches[0]]);
                    return parseCellValue(cell.value);
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
                    return parseCellValue(cell.value);
                }
            }
            return null;
        };

        // Read all analysis rows and group by ID_MUESTRA
        // Recorremos hasta la última fila con contenido y SALTAMOS las vacías
        // (tolera huecos en medio en vez de cortar en la primera fila vacía).
        const analysisRowsMap = {}; // id_muestra -> rows[]
        const lastRowA = wsAnalisis.actualRowCount || wsAnalisis.rowCount;

        for (let rowCount = 4; rowCount <= lastRowA; rowCount++) {
            const row = wsAnalisis.getRow(rowCount);
            const idMuestra = getCellA(row, 'ID MUESTRA');

            if (!idMuestra) continue; // fila sin ID MUESTRA → se ignora

            const rawId = String(idMuestra).trim();
            if (!analysisRowsMap[rawId]) analysisRowsMap[rawId] = [];
            
            // Normalizar UF: "No Aplica", "-" o vacío → 0
            let ufVal = getCellA(row, 'UF', 'UF MANUAL', 'UF INDIVIDUAL');
            let ufIndividual = 0;
            if (ufVal !== 'No Aplica' && ufVal !== 'No aplica' && ufVal !== '-' && ufVal !== null && ufVal !== '') {
                ufIndividual = parseFloat(ufVal) || 0;
            }

            analysisRowsMap[rawId].push({
                nombre: getCellA(row, 'NOMBRE ANÁLISIS'),
                tipo_analisis: getCellA(row, 'TIPO ANÁLISIS') || 'Terreno',
                laboratorio_texto: getCellA(row, 'LABORATORIO 1', 'LABORATORIO'),
                tipo_entrega_texto: getCellA(row, 'TIPO ENTREGA'),
                normativa: getCellA(row, 'NORMATIVA'),
                referencia: getCellA(row, 'REFERENCIA NORMATIVA'),
                // UF: usuario escribe directamente en la columna (antes era UF INDIVIDUAL AUTO, ahora es UF editable)
                uf_individual: ufIndividual
            });
        }

        // Process FICHAS
        // Igual que ANALISIS: recorremos todas las filas con contenido y
        // saltamos las vacías. Tope de seguridad MAX_FICHAS para el lote.
        const results = [];
        const MAX_FICHAS = 1000;
        let truncated = false;
        const lastRowF = wsFichas.actualRowCount || wsFichas.rowCount;

        for (let rowCount = 4; rowCount <= lastRowF; rowCount++) {
            const row = wsFichas.getRow(rowCount);
            const idMuestra = getCellF(row, 'ID MUESTRA');

            if (!idMuestra) continue; // fila sin ID MUESTRA → se ignora

            const rawId = String(idMuestra).trim();
            const result = {
                idMuestra: rawId,            // ID MUESTRA tal cual en el Excel (ej. M-001)
                excelRow: rowCount,          // fila del Excel donde está esta ficha
                filename: rawId,             // se muestra como "Archivo" en el grid
                status: 'READY',
                errors: [],
                warnings: [],
                antecedentes: {},
                analisis: [],
                observaciones: '',
                costoOperativo: { activo: true, uf: 0 }
            };

            // Costo Operativo ahora viene como una FILA en ANALISIS (tipo_analisis = 'CostoOperativo')
            // Se extrae tras resolver los análisis (ver más abajo)

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

            // 3. Fuente Emisora (Centro) — por CÓDIGO CENTRO (exacto) o por NOMBRE (similitud)
            // IMPORTANTE: usar el header exacto "CENTRO / FUENTE EMISORA" para no leer
            // por error la columna "CODIGO CENTRO" (ambas contienen "CENTRO").
            const codigoCentroVal = getCellF(row, 'CODIGO CENTRO');
            const centroVal = getCellF(row, 'CENTRO / FUENTE EMISORA', 'FUENTE EMISORA');
            let centrosToSearch = catalogs.centros;
            if (clienteMatch) {
                centrosToSearch = catalogs.centros.filter(c => String(c.id_empresa) === String(clienteMatch.id));
            }

            // Preferir coincidencia exacta por código de centro cuando viene informado
            let centroMatch = null;
            const codigoNorm = this.normalize(codigoCentroVal);
            if (codigoNorm && codigoNorm !== 'NO APLICA') {
                const byCodigo = centrosToSearch.find(c => c.codigo && this.normalize(c.codigo) === codigoNorm);
                if (byCodigo) {
                    centroMatch = { id: byCodigo.id, nombre: byCodigo.nombre, score: 100, extra: byCodigo };
                }
            }
            // Fallback: coincidencia por nombre (similitud)
            if (!centroMatch) {
                centroMatch = this.matchCatalog(centroVal, centrosToSearch);
            }

            if (centroMatch) {
                fields.selectedFuente = String(centroMatch.id);
                fields._fuenteNombre = centroMatch.nombre;
                fields._fuenteMatch_method = centroMatch.score === 100 ? 'exact' : 'fuzzy';
                const c = centroMatch.extra;
                // Exponer código e id del centro para verificar la selección en la revisión
                fields.idCentro = centroMatch.id;
                fields.codigoCentro = (c.codigo || '').trim();
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
            // ✅ PUNTUAL: muestreo de un solo día; en carga masiva suelen ingresar 1 hr.
            //    Compuesta: por defecto 24 hrs. Si la celda trae un valor, se respeta.
            fields.duracion = String(getCellF(row, 'DURACIÓN', 'DURACION') || (fields.tipoMonitoreo === 'Puntual' ? '1' : '24'));
            fields.medicionCaudal = getCellF(row, 'MEDICION CAUDAL') || 'No Aplica';
            fields.responsableMuestreo = getCellF(row, 'RESPONSABLE') || 'ADL Diagnostic';

            // NOMBRE TABLA: construida automáticamente desde CENTRO + OBJETIVO
            fields.glosa = (fields._fuenteNombre && fields._objetivoNombre) ? `${fields._fuenteNombre} - ${fields._objetivoNombre}` : 'Sin glosa';
            
            // Instrumento (opcional, puede ser "No Aplica")
            const instVal = this.normalizeOptionalField(getCellF(row, 'INSTRUMENTO AMBIENTAL'));
            fields.instrumentoFull = instVal;
            // Try to match or just use as is
            const instMatch = this.matchCatalog(instVal, catalogs.instrumentos);
            if (instMatch) {
                fields.selectedInstrumento = instMatch.nombre;
            } else {
                fields.selectedInstrumento = instVal;
            }
            
            // Coords - ZONA UTM es REQUERIDA (no puede estar vacía)
            const utmZRaw = getCellF(row, 'ZONA UTM');
            const utmZ = String(utmZRaw || '').trim();
            const utmZNoAplica = /^no\s*aplica$/i.test(utmZ);
            if (!utmZ || utmZ === '-') {
                errs.push({ field: 'Zona UTM', message: 'La Zona UTM es requerida' });
            }
            if (!utmZ || utmZ === '-' || utmZNoAplica) {
                fields.zona = null;
            } else if (/[FGH]$/i.test(utmZ)) {
                fields.zona = utmZ.toUpperCase();               // 18F, 18G, 18H, 19F, 19G, 19H
            } else {
                fields.zona = utmZ.replace(/[^0-9]/g, '') + 'H'; // número simple → huso H por defecto
            }
            fields.utmNorte = getCellF(row, 'UTM NORTE') || '';
            fields.utmEste = getCellF(row, 'UTM ESTE') || '';
            // Ref. Google Maps: "-" / vacío se tratan como SIN enlace (no se valida)
            const refG = String(getCellF(row, 'REF. GOOGLE') || '').trim();
            fields.refGoogle = (refG === '' || refG === '-') ? '' : refG;

            // Componente (opcional: fallback a "No Aplica")
            const compVal = this.normalizeOptionalField(getCellF(row, 'COMPONENTE AMBIENTAL'));
            const compMatch = this.matchCatalog(compVal, catalogs.componentes);
            if (compMatch) {
                fields.selectedComponente = String(compMatch.id);
                fields._componenteNombre = compMatch.nombre;
            } else if (compVal === 'No Aplica') {
                fields.selectedComponente = 'No Aplica';
                fields._componenteNombre = 'No Aplica';
            }

            // Sub Area (opcional: fallback a "No Aplica")
            const subVal = this.normalizeOptionalField(getCellF(row, 'SUB ÁREA', 'SUB AREA'));
            const subMatch = this.matchCatalog(subVal, catalogs.subAreas);
            if (subMatch) {
                fields.selectedSubArea = String(subMatch.id);
                fields._subAreaNombre = subMatch.nombre;
            } else if (subVal === 'No Aplica') {
                fields.selectedSubArea = 'No Aplica';
                fields._subAreaNombre = 'No Aplica';
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

            // Resolve Analysis (separar Costo Operativo como fila especial)
            let allExcelRows = analysisRowsMap[rawId] || [];

            // Validar que si el nombre contiene "COSTO OPERATIVO", el tipo DEBE ser "CostoOperativo"
            for (const row of allExcelRows) {
                const nombreUpper = String(row.nombre || '').toUpperCase();
                if (nombreUpper.includes('COSTO') && nombreUpper.includes('OPERATIVO')) {
                    if (row.tipo_analisis !== 'CostoOperativo') {
                        errs.push({
                            field: 'Análisis',
                            message: `La fila "${row.nombre}" contiene "Costo Operativo" pero tipo_analisis es "${row.tipo_analisis}". Debe ser "CostoOperativo"`
                        });
                    }
                }
            }

            const costoOperativoRow = allExcelRows.find(r => r.tipo_analisis === 'CostoOperativo');
            const excelAnalysisRows = allExcelRows.filter(r => r.tipo_analisis !== 'CostoOperativo');

            // Extraer UF de Costo Operativo si existe
            if (costoOperativoRow) {
                let costoUF = costoOperativoRow.uf_individual;
                // Normalizar "No Aplica" o "-" a 0
                if (costoUF === 'No Aplica' || costoUF === 'No aplica' || costoUF === '-' || !costoUF) {
                    costoUF = 0;
                } else {
                    costoUF = Number(costoUF) || 0;
                }
                result.costoOperativo = { activo: true, uf: costoUF };
            }

            result.analysisErrors = [];

            if (excelAnalysisRows.length === 0) {
                // Sin análisis: mensaje claro y NO intentamos resolver (evita errores espurios de normativa)
                errs.push({ field: 'Análisis', message: `No existen análisis asociados al número de muestra "${rawId}" en la hoja ANALISIS. Agregue al menos una fila de análisis con ese ID MUESTRA.` });
                result.analisis = [];
                result._ufTotal = result.costoOperativo?.activo ? Number(result.costoOperativo.uf || 0) : 0;
            } else
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

                // Override individual UFs with Excel values (normalizar "No Aplica" a 0)
                for (let i = 0; i < resolved.length; i++) {
                    if (resolved[i]._matched) {
                        let ufVal = excelAnalysisRows[i]?.uf_individual;
                        if (ufVal === 'No Aplica' || ufVal === 'No aplica' || ufVal === '-' || !ufVal) {
                            resolved[i].uf_individual = 0;
                        } else {
                            resolved[i].uf_individual = parseFloat(ufVal) || 0;
                        }
                    }
                }

                result.analysisErrors = analysisErrs;

                // Compute total UF for this ficha (sum de uf_individual + Costo Operativo si está activo)
                const ufAnalisis = (result.analisis || []).reduce((sum, a) => sum + (parseFloat(a.uf_individual) || 0), 0);
                const ufCosto = result.costoOperativo?.activo ? Number(result.costoOperativo.uf || 0) : 0;
                result._ufTotal = ufAnalisis + ufCosto;


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

            // Mensaje CLARO por cada análisis no encontrado en su normativa/tabla.
            // Estos análisis NO se incluyen al crear la ficha (commit los filtra).
            for (const a of unmatchedAnalysis) {
                const tabla = a.nombre_normativareferencia || a.nombre_normativa || result._normativaRef || result._normativa || '-';
                warns.push({
                    field: 'Análisis no encontrado',
                    message: `"${a.nombre_original}" no se encontró en la normativa/tabla "${tabla}". No se incluirá en la ficha.`
                });
            }

            if (criticalErrors.length > 0 || result.errors.length > 0) {
                result.status = 'ERROR';
            } else if (unmatchedAnalysis.length > 0 || result.warnings.length > 0) {
                result.status = 'WARNING';
            } else {
                result.status = 'READY';
            }

            results.push(result);
            if (results.length >= MAX_FICHAS) {
                logger.warn(`[BulkExcel] Reached max batch limit of ${MAX_FICHAS} fichas — truncating.`);
                truncated = true;
                break;
            }
        }

        const ready = results.filter(r => r.status === 'READY').length;
        const warn = results.filter(r => r.status === 'WARNING').length;
        const err = results.filter(r => r.status === 'ERROR').length;
        logger.info(`[BulkExcel] Batch complete: ${ready} ready, ${warn} warnings, ${err} errors (truncated=${truncated})`);

        return {
            total: results.length,
            ready,
            warnings: warn,
            errors: err,
            truncated,
            maxFichas: MAX_FICHAS,
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

        // ── 4. MAESTRO_ZONAS_UTM ───────────────────────────────────────────
        const zonasUTMRows = [
            ['Nombre Zona UTM'],
            ...(catalogs.zonasUTM || []).map(z => [z.nombre])
        ];
        const wsZ = rebuildMasterSheet(
            'MAESTRO_ZONAS_UTM',
            'MAESTRO: Zonas UTM',
            zonasUTMRows,
            [25]
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
            const zonaUTMIdx      = cmF['ZONA UTM'];

            // NOTA: Empresas y Centro/Fuente Emisora son EDITABLES (sin dropdown).
            // El sistema de matching por similitud en backend maneja la búsqueda automática.
            // Solo ZONA UTM tiene dropdown como validación auxiliar.
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

            // Solo ZONA UTM con dropdown
            if (zonaUTMIdx)     setDropdown(zonaUTMIdx,     `MAESTRO_ZONAS_UTM!$A$4:$A$${3 + zonasUTMRows.length - 1}`, 'Zona UTM', 'Seleccione la Zona UTM.');

            // ── NOMBRE TABLA (AUTO) column ─────────────────────────────────
            const nombreTablaIdx = cmF['NOMBRE TABLA (AUTOMATICO)'] || cmF['NOMBRE TABLA'];
            const centroColLt = colLetter(centroIdx || 6);
            const objetivoColLt = colLetter(cmF['OBJETIVO MUESTREO'] || 9);

            const AUTO_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }; // light yellow-orange

            if (nombreTablaIdx) {
                const ntColLt = colLetter(nombreTablaIdx);
                for (let r = DATA_START; r <= DATA_END; r++) {
                    const cell = wsFichas.getCell(`${ntColLt}${r}`);
                    cell.value = {
                        formula: `IF(AND(${centroColLt}${r}<>"",${objetivoColLt}${r}<>""), CONCATENATE(${centroColLt}${r}," - ",${objetivoColLt}${r}), "Sin glosa")`,
                        result: 'Sin glosa'
                    };
                    cell.fill = AUTO_FILL;
                    cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF7B5900' } };
                    cell.protection = { locked: true };
                }
            }

            // ── UF TOTAL (AUTO) column ─────────────────────────────────────
            // Formula: =IF(A4="","",SUMIF(ANALISIS!$A:$A, A4, ANALISIS!$I:$I))
            // Col I in ANALISIS = UF INDIVIDUAL (col 9)
            const ufTotalCol   = cmF['UF TOTAL REAL (AUTO)'] || cmF['UF TOTAL (AUTO)'] || 42;
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
            // Ahora suma desde ANALISIS!UF MANUAL (col J/10, no col I/9)
            for (let r = DATA_START; r <= DATA_END; r++) {
                const idCol = colLetter(1); // Column A = ID MUESTRA
                const cell  = wsFichas.getCell(`${ufTotalColLt}${r}`);
                cell.value  = {
                    formula: `IF(${idCol}${r}="","",SUMIF(ANALISIS!$A:$A,${idCol}${r},ANALISIS!$J:$J))`,
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

            // ── Sheet protection: MINIMAL — solo NOMBRE TABLA y UF TOTAL bloqueados ──────
            // Todas las demás columnas totalmente editables (sin protección)
            for (let c = 1; c <= ufTotalCol; c++) {
                wsFichas.getColumn(c).style = { protection: { locked: false } };
            }
            // Bloquear SOLO NOMBRE TABLA y UF TOTAL
            if (nombreTablaIdx) {
                for (let r = DATA_START; r <= DATA_END; r++) {
                    wsFichas.getCell(`${colLetter(nombreTablaIdx)}${r}`).protection = { locked: true };
                }
                wsFichas.getColumn(nombreTablaIdx).style = { protection: { locked: true } };
            }
            wsFichas.getColumn(ufTotalCol).style = { protection: { locked: true } };

            // Protect sheet — MÁS PERMISIVO
            wsFichas.protect('', {
                selectLockedCells:   true,
                selectUnlockedCells: true,
                formatCells:         false,   // permite cambiar formato
                formatColumns:       false,   // permite redimensionar columnas
                formatRows:          false,   // permite redimensionar filas
                insertRows:          true,    // permite agregar filas
                deleteRows:          true,    // permite eliminar filas
                sort:                true,
                autoFilter:          true,
            });
        }

        // ── ANALISIS sheet: bloquear UF INDIVIDUAL (AUTO) y _CNT, dejar el resto editable ─────
        const wsAnalisis = wb.getWorksheet('ANALISIS');
        if (wsAnalisis) {
            const colLetterA = (n) => {
                let s = '';
                while (n > 0) {
                    const rem = (n - 1) % 26;
                    s = String.fromCharCode(65 + rem) + s;
                    n = Math.floor((n - 1) / 26);
                }
                return s;
            };

            const cmA = {};
            wsAnalisis.getRow(3).eachCell({ includeEmpty: false }, (c, i) => {
                const h = String(c.value || '').replace(/[\r\n🔁✏️\*]/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
                if (h) cmA[h] = i;
            });

            const ufManualIdx = cmA['UF MANUAL (ESCRIBA AQUÍ)'] || cmA['UF MANUAL'] || 10;

            const DATA_START_A = 4;
            const DATA_END_A   = 2003;

            const ufManualColLt = colLetterA(ufManualIdx);

            const THIN_BORDER_A = {
                top:    { style: 'thin', color: { argb: 'FFBFBFBF' } },
                left:   { style: 'thin', color: { argb: 'FFBFBFBF' } },
                bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                right:  { style: 'thin', color: { argb: 'FFBFBFBF' } }
            };

            // Estilizar encabezado UF MANUAL
            const ufManualHdr = wsAnalisis.getRow(3).getCell(ufManualIdx);
            ufManualHdr.value = '✏️ UF\n(Escriba Aquí)';
            ufManualHdr.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF92D050' } };
            ufManualHdr.font = { bold: true, color: { argb: 'FF000000' }, name: 'Calibri', size: 10 };
            ufManualHdr.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            ufManualHdr.border = THIN_BORDER_A;

            // UF MANUAL: solo editable, sin fórmulas
            for (let r = DATA_START_A; r <= DATA_END_A; r++) {
                const cellMan = wsAnalisis.getCell(`${ufManualColLt}${r}`);
                cellMan.numFmt = '#,##0.00';
                cellMan.alignment = { horizontal: 'right', vertical: 'middle' };
                cellMan.border = THIN_BORDER_A;
                cellMan.protection = { locked: false };
            }

            wsAnalisis.getColumn(ufManualIdx).width = 14;

            // Todo lo demás editable (sin protecciones)
            for (let c = 1; c <= wsAnalisis.columnCount; c++) {
                wsAnalisis.getColumn(c).style = { protection: { locked: false } };
            }

            // Proteger hoja ANALISIS — MÁS PERMISIVO
            wsAnalisis.protect('', {
                selectLockedCells: true,
                selectUnlockedCells: true,
                formatCells: false,
                formatColumns: false,
                formatRows: false,
                insertRows: true,
                deleteRows: true,
                sort: true,
                autoFilter: true,
            });
        }

        // ── Serialize to Buffer ────────────────────────────────────────────
        const buffer = await wb.xlsx.writeBuffer();
        logger.info(`[BulkExcel] Template generated: ${empFactRows.length - 1} clientes, ${empServRows.length - 1} empresas, ${centrosRows.length - 1} centros`);
        return buffer;
    }
}

export default new BulkExcelService();
