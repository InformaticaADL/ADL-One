import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import fichaService from './ficha.service.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// ─────────────────────────────────────────────────────────────
// UTILITY: Text normalization for fuzzy matching
// ─────────────────────────────────────────────────────────────
const normalize = (str, preserveLines = false) => {
    if (!str) return '';
    let normalized = String(str)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Remove accents
    
    if (preserveLines) {
        // Replace non-newline whitespace with single space, but keep \n
        return normalized.toUpperCase()
            .replace(/[ \t]+/g, ' ')
            .replace(/[.,;:'"()]/g, '')
            .trim();
    } else {
        return normalized.toUpperCase()
            .replace(/\s+/g, ' ')
            .replace(/[.,;:'"()]/g, '')
            .trim();
    }
};

// Common abbreviations in ADL datasets
const expandAbbreviations = (str) => {
    if (!str) return '';
    return str
        .replace(/\bPISC\b\.?/g, 'PISCICULTURA')
        .replace(/\bEST\b\.?/g, 'ESTERO')
        .replace(/\bRES\b\.?/g, 'RESOLUCION')
        .replace(/\bENT\b\.?/g, 'ENTRADA')
        .replace(/\bSAL\b\.?/g, 'SALIDA')
        .replace(/\bAVE\b\.?/g, 'AVENIDA')
        .replace(/\bKM\b\.?/g, 'KILOMETRO')
        .replace(/\bDS\b\.?/g, 'DECRETO SUPREMO')
        .replace(/\bN[°º]\b\.?/g, '') // REMOVE N° to simplify matching (e.g. D.S. N° 90 -> DECRETO SUPREMO 90)
        .replace(/\bNUMERO\b/g, '') // Same for expanded
        .replace(/\s+/g, ' ')
        .trim();
};

// Similarity score (0-100) between two strings
const similarity = (a, b) => {
    const na = expandAbbreviations(normalize(a));
    const nb = expandAbbreviations(normalize(b));
    if (!na || !nb) return 0;
    if (na === nb) return 100;
    
    // Check if one contains the other (High confidence for partial matches)
    if (na.includes(nb) || nb.includes(na)) {
        const shorter = Math.min(na.length, nb.length);
        const longer = Math.max(na.length, nb.length);
        const ratio = shorter / longer;

        // Common noise words that trigger false positives in containment
        const noiseWords = ['ANALISIS', 'MUESTREO', 'FICHA', 'SERVICIO', 'ANEXO', 'TABLA'];
        if (noiseWords.includes(shorter === na.length ? na : nb) && ratio < 0.6) {
            return 40; // Low score for noise words that are only partially matching
        }

        if (ratio > 0.4) return 90;
        return 85;
    }

    // Levenshtein-based similarity
    const maxLen = Math.max(na.length, nb.length);
    if (maxLen === 0) return 100;
    const dist = levenshtein(na, nb);
    const score = Math.round((1 - dist / maxLen) * 100);
    return score;
};

// Simple Levenshtein distance
const levenshtein = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            const cost = b[i - 1] === a[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return matrix[b.length][a.length];
};

// Find best match for a text value against a catalog list
const findBestMatch = (searchText, catalog, nameKey = 'nombre', idKey = 'id', minScore = 40) => {
    if (!searchText || !catalog || catalog.length === 0) return null;
    let bestMatch = null;
    let bestScore = 0;

    for (const item of catalog) {
        const itemName = item[nameKey] || '';
        const score = similarity(searchText, itemName);
        
        // Bonus for partial exact matches (e.g. searching "Coliformes" in "Coliformes Fecales")
        const na = normalize(searchText);
        const ni = normalize(itemName);
        let finalScore = score;
        if (ni.includes(na) && na.length > 4) finalScore += 10;
        
        if (finalScore > bestScore && finalScore >= minScore) {
            bestScore = finalScore;
            bestMatch = { id: item[idKey], nombre: itemName, score: finalScore, original: searchText };
        }
    }
    return bestMatch;
};

// ─────────────────────────────────────────────────────────────
// BULK FICHA SERVICE
// ─────────────────────────────────────────────────────────────
class BulkFichaService {

    // =========================================================
    // 1. LOAD ALL CATALOGS FROM DB (once per batch)
    // =========================================================
    async loadCatalogs() {
        const pool = await getConnection();
        logger.info('[BulkFicha] Loading all catalogs for matching...');

        const [
            lugaresRes, empresasServRes, clientesRes,
            objetivosRes, componentesRes, inspectoresRes,
            tiposMuestreoRes, tiposMuestraRes, actividadesRes,
            tiposDescargaRes, modalidadesRes, cargosRes,
            frecuenciasRes, formasCanalRes, dispositivosRes,
            instrumentosRes, laboratoriosRes, tiposEntregaRes,
            normativasRes, contactosRes, subAreasRes
        ] = await Promise.all([
            pool.request().execute('maestro_lugaranalisis'),
            pool.request().query("SELECT id_empresaservicio, nombre_empresaservicios FROM mae_empresaservicios WHERE habilitado = 'S'"),
            pool.request().query("SELECT id_empresa, nombre_empresa, id_empresaservicio FROM mae_empresa"),
            pool.request().execute('consulta_objetivomuestreo_ma_oservicios'),
            pool.request().execute('consulta_tipomuestra_medioambiente'),
            pool.request().execute('consulta_inspectorambiental'),
            pool.request().execute('consulta_tipomuestreo_medio_ambiente').catch(() => ({ recordset: [] })),
            pool.request().execute('consulta_tipomuestra_ma').catch(() => ({ recordset: [] })),
            pool.request().execute('consulta_mae_actividadmuestreo').catch(() => ({ recordset: [] })),
            pool.request().execute('consulta_mae_tipodescarga').catch(() => ({ recordset: [] })),
            pool.request().execute('Consulta_Mae_Modalidad').catch(() => ({ recordset: [] })),
            pool.request().query('SELECT id_cargo, nombre_cargo, cliente FROM mae_cargo ORDER BY nombre_cargo').catch(() => ({ recordset: [] })),
            pool.request().execute('Consulta_Frecuencia_Periodo').catch(() => ({ recordset: [] })),
            pool.request().execute('Consulta_Mae_Formacanal').catch(() => ({ recordset: [] })),
            pool.request().execute('Consulta_Mae_Dispositivohidraulico').catch(() => ({ recordset: [] })),
            pool.request().query("SELECT id, nombre FROM mae_instrumentoambiental WHERE estado = 'V' ORDER BY id ASC").catch(() => ({ recordset: [] })),
            pool.request().execute('consulta_laboratorioensayo').catch(() => ({ recordset: [] })),
            pool.request().execute('Maestro_Tipoentrega').catch(() => ({ recordset: [] })),
            pool.request().execute('Consulta_App_Ma_Normativa').catch(() => ({ recordset: [] })),
            pool.request().query("SELECT id_contacto, nombre_contacto, email_contacto, id_empresa, id_empresaservicio FROM mae_contacto WHERE habilitado = 'S'"),
            pool.request().query("SELECT id_subarea, nombre_subarea FROM mae_subarea WHERE activo = 'S'").catch(() => ({ recordset: [] }))
        ]);

        // Also load centros (fuentes emisoras) - we load ALL since we need to match by name
        const centrosRes = await pool.request().execute('consulta_centro').catch(() => ({ recordset: [] }));

        // Load ALL referencia analysis for matching analysis names
        // We query the base table directly for name matching
        let referenciaAnalisisRes;
        try {
            referenciaAnalisisRes = await pool.request().query(`
                SELECT ra.id_referenciaanalisis, ra.id_normativareferencia, ra.id_tecnica,
                       ra.limitemax_d, ra.limitemax_h, ra.llevaerror, ra.error_min, ra.error_max,
                       t.nombre_tecnica
                FROM App_Ma_ReferenciaAnalisis ra
                LEFT JOIN mae_tecnica t ON ra.id_tecnica = t.id_tecnica
            `);
        } catch (e) {
            logger.warn('[BulkFicha] Could not load referencia analisis:', e.message);
            referenciaAnalisisRes = { recordset: [] };
        }

        // Load normativa referencias
        let normativaRefRes;
        try {
            normativaRefRes = await pool.request().query(`
                SELECT id_normativareferencia, nombre_normativareferencia, id_normativa 
                FROM mae_normativareferencia
            `);
        } catch (e) {
            logger.warn('[BulkFicha] Could not load normativa referencias:', e.message);
            normativaRefRes = { recordset: [] };
        }

        const catalogs = {
            lugares: lugaresRes.recordset.map(r => ({
                id: r.id_lugaranalisis || r.IdLugarAnalisis || r.ID || r.id,
                nombre: (r.nombre_lugaranalisis || r.NombreLugar || r.Nombre || r.nombre || '').trim()
            })),
            empresasServicio: empresasServRes.recordset.map(r => ({
                id: r.id_empresaservicio,
                nombre: (r.nombre_empresaservicios || '').trim()
            })),
            clientes: clientesRes.recordset.map(r => ({
                id: r.id_empresa,
                nombre: (r.nombre_empresa || '').trim(),
                id_empresaservicio: r.id_empresaservicio
            })),
            centros: centrosRes.recordset.map(r => ({
                id: r.id_centro || r.id,
                nombre: (r.nombre_centro || r.nombre || '').trim(),
                direccion: r.direccion || r.ubicacion,
                comuna: r.nombre_comuna || r.comuna,
                region: r.nombre_region || r.region,
                tipo_agua: r.tipo_agua || r.TipoAgua || r.tipoagua || r.nombre_tipoagua,
                id_tipoagua: r.id_tipoagua || r.IdTipoAgua || r.ID_TIPOAGUA,
                id_empresa: r.id_empresa || r.IdEmpresa,
                codigo: r.codigo_centro || r.codigo || r.codigo_ma
            })),
            objetivos: objetivosRes.recordset.map(r => ({
                id: r.id_objetivomuestreo_ma || r.id,
                nombre: (r.nombre_objetivomuestreo_ma || r.nombre || '').trim()
            })),
            componentes: componentesRes.recordset.map(r => ({
                id: r.id_tipomuestra || r.id,
                nombre: (r.nombre_tipomuestra || r.nombre || '').trim()
            })),
            inspectores: inspectoresRes.recordset.map(r => ({
                id: r.id_inspectorambiental || r.id,
                nombre: (r.nombre_inspector || r.nombre || '').trim()
            })),
            tiposMuestreo: tiposMuestreoRes.recordset.map(r => ({
                id: r.id_tipomuestreo || r.id,
                nombre: (r.nombre_tipomuestreo || r.nombre || '').trim()
            })),
            tiposMuestra: tiposMuestraRes.recordset.map(r => ({
                id: r.id_tipomuestra_ma || r.id,
                nombre: (r.nombre_tipomuestra_ma || r.nombre || '').trim()
            })),
            actividades: actividadesRes.recordset.map(r => ({
                id: r.id_actividadmuestreo || r.id,
                nombre: (r.nombre_actividadmuestreo || r.nombre || '').trim()
            })),
            tiposDescarga: tiposDescargaRes.recordset.map(r => ({
                id: r.id_tipodescarga || r.id,
                nombre: (r.nombre_tipodescarga || r.nombre || '').trim()
            })),
            modalidades: modalidadesRes.recordset.map(r => ({
                id: r.id_modalidad || r.id,
                nombre: (r.nombre_modalidad || r.nombre || '').trim()
            })),
            subAreas: subAreasRes.recordset.map(r => ({
                id: r.id_subarea,
                nombre: (r.nombre_subarea || '').trim()
            })),
            cargos: cargosRes.recordset.map(r => ({
                id: r.id_cargo,
                nombre: (r.nombre_cargo || '').trim(),
                cliente: r.cliente
            })),
            frecuencias: frecuenciasRes.recordset.map(r => ({
                id: r.id_frecuencia || r.id_frecuenciaperiodo || r.id,
                nombre: (r.nombre_frecuencia || r.nombre || '').trim(),
                cantidad: r.cantidad,
                multiplicadopor: r.multiplicadopor
            })),
            formasCanal: formasCanalRes.recordset.map(r => ({
                id: r.id_formacanal || r.id,
                nombre: (r.nombre_formacanal || r.nombre || '').trim()
            })),
            dispositivos: dispositivosRes.recordset.map(r => ({
                id: r.id_dispositivohidraulico || r.id,
                nombre: (r.nombre_dispositivohidraulico || r.nombre || '').trim()
            })),
            instrumentos: instrumentosRes.recordset.map(r => ({
                id: r.id,
                nombre: (r.nombre || '').trim()
            })),
            laboratorios: laboratoriosRes.recordset.map(r => ({
                id: r.id_laboratorioensayo || r.id,
                nombre: (r.nombre_laboratorioensayo || r.nombre || '').trim()
            })),
            tiposEntrega: tiposEntregaRes.recordset.map(r => ({
                id: r.id_tipoentrega || r.id,
                nombre: (r.nombre_tipoentrega || r.nombre || '').trim()
            })),
            normativas: normativasRes.recordset.map(r => ({
                id: r.id_normativa || r.id,
                nombre: (r.nombre_normativa || r.nombre || '').trim()
            })),
            normativaReferencias: (normativaRefRes.recordset || []).map(r => ({
                id: r.id_normativareferencia,
                nombre: (r.nombre_normativareferencia || '').trim(),
                id_normativa: r.id_normativa
            })),
            referenciaAnalisis: (referenciaAnalisisRes.recordset || []).map(r => ({
                id: r.id_referenciaanalisis,
                nombre: (r.nombre_tecnica || '').trim(), // No direct name column, use tecnica
                id_normativareferencia: r.id_normativareferencia,
                id_tecnica: r.id_tecnica,
                nombre_tecnica: (r.nombre_tecnica || '').trim(),
                limitemax_d: r.limitemax_d,
                limitemax_h: r.limitemax_h,
                llevaerror: r.llevaerror,
                error_min: r.error_min,
                error_max: r.error_max
            })),
            contactos: contactosRes.recordset.map(r => ({
                id: r.id_contacto,
                nombre: (r.nombre_contacto || '').trim(),
                email: (r.email_contacto || '').trim(),
                id_empresa: r.id_empresa,
                id_empresaservicio: r.id_empresaservicio
            }))
        };

        logger.info(`[BulkFicha] Catalogs loaded: ${Object.entries(catalogs).map(([k, v]) => `${k}=${v.length}`).join(', ')}`);
        return catalogs;
    }

    // =========================================================
    // 2. EXTRACT RAW TEXT FROM A SINGLE PDF
    // =========================================================
    async parsePdf(buffer) {
        const data = await pdfParse(buffer);
        return data.text || '';
    }

    // =========================================================
    // 3. EXTRACT ANALYSIS ROWS FROM TEXT
    // =========================================================
    extractAnalysisRows(text) {
        const rows = [];
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
            // Pattern: [AnalysisName][Terreno|Laboratorio][LabName][No Aplica|Transporte|Directa]
            const match = line.match(/^(.+?)(Terreno|Laboratorio)(.+?)(No Aplica|Transporte|Directa)$/i);
            if (match) {
                let analysisName = match[1].trim();
                const tipoMuestra = match[2].trim();
                const laboratorio = match[3].trim();
                const tipoEntrega = match[4].trim();

                // Skip header row
                if (normalize(analysisName).includes('TIPO DE MUESTRA')) continue;
                if (normalize(analysisName) === 'ANALISIS') continue;

                // Handle known synonyms/abbreviations
                const mapSynonyms = (name) => {
                    const normalized = name.replace(/\s+/g, '').toUpperCase();
                    if (normalized === 'T°' || normalized === 'Tº') return 'Temperatura';
                    if (normalized === 'CAUDAL') return 'Caudal'; // Ensure exact match
                    return name;
                };

                // Handle combined Terreno analyses like "pH - T° - Caudal"
                // Split by '-' or '–' (en dash) or '/'
                if (tipoMuestra === 'Terreno' && (analysisName.includes('-') || analysisName.includes('–') || analysisName.includes('/'))) {
                    const subAnalyses = analysisName.split(/[-–\/]/).map(s => s.trim()).filter(Boolean);
                    for (const sub of subAnalyses) {
                        rows.push({
                            nombre: mapSynonyms(sub),
                            tipo_analisis: tipoMuestra,
                            laboratorio_texto: laboratorio,
                            tipo_entrega_texto: tipoEntrega
                        });
                    }
                } else {
                    rows.push({
                        nombre: mapSynonyms(analysisName),
                        tipo_analisis: tipoMuestra,
                        laboratorio_texto: laboratorio,
                        tipo_entrega_texto: tipoEntrega
                    });
                }
            }
        }

        logger.info(`[BulkFicha] Extracted ${rows.length} analysis rows`);
        return rows;
    }

    // =========================================================
    // 4. EXTRACT OBSERVATIONS FROM TEXT
    // =========================================================
    extractObservations(text) {
        const obsSet = new Set();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
            if (/^Limite\s+normativ/i.test(line) || /^Caudal:\s+Anotar/i.test(line)) {
                obsSet.add(line);
            }
        }

        return obsSet.size > 0 ? Array.from(obsSet).join('\n') : 'No Aplica';
    }

    // =========================================================
    // 5. SEARCH TEXT FOR CATALOG MATCHES (Core matching engine)
    // =========================================================
    findInText(text, catalog, nameKey = 'nombre', idKey = 'id', minScore = 70) {
        const normalizedText = normalize(text, true); // PRESERVE LINES
        const lines = normalizedText.split('\n');
        
        const fullNormalizedText = normalizedText.replace(/\n/g, ' '); // Non-line version for containment
        const expandedFullText = expandAbbreviations(fullNormalizedText);

        let bestMatch = null;
        let bestScore = 0;

        // Keywords that signal a line is likely an address or other junk context
        const addressKeywords = ['CAMINO', 'SECTOR', 'KM', 'KILOMETRO', 'RUT', 'UTM', 'COORDENADAS', 'REGION', 'COMUNA', 'PROVINCIA', 'REFERENCIA', 'GOOGLE', 'LLANQUIHUE'];

        for (const item of catalog) {
            const rawName = item[nameKey] || '';
            const itemName = normalize(rawName);
            const expandedItemName = expandAbbreviations(itemName);
            
            if (!itemName || itemName.length < 2) continue;
            if (['NO APLICA', 'SIN DATO', 'POR DEFINIR', 'SIN DETERMINAR'].includes(itemName)) continue;

            // 1. Direct containment check (High Confidence)
            // Bi-directional check: Item in Text OR Text in Item
            const itemNameInText = expandedFullText.includes(expandedItemName);
            let score = 0;

            if (itemNameInText && expandedItemName.length >= 4) {
                score = Math.min(99, 88 + expandedItemName.length);
            } else {
                // Check if any significant line (the value) is contained in the catalog name
                // e.g. PDF "Autocontrol" contained in DB "Autocontrol RILes"
                for (const line of lines) {
                    const expandedLine = expandAbbreviations(line);
                    if (expandedLine.length >= 5 && expandedItemName.includes(expandedLine)) {
                        // NOISE FILTER: Don't give high score to common words found in longer names
                        const noiseWords = ['ANALISIS', 'MUESTREO', 'FICHA', 'SERVICIO', 'ANEXO', 'TABLA'];
                        if (noiseWords.includes(expandedLine) && expandedItemName.length > expandedLine.length + 5) {
                            continue; // Skip noise word containment
                        }
                        
                        const lineScore = 85 + (expandedLine.length * 2);
                        if (lineScore > score) score = Math.min(95, lineScore);
                    }
                }
            }

            if (score > 0) {
                // LINE-SPECIFIC ADDRESS PENALTY
                for (const line of lines) {
                    const expandedLine = expandAbbreviations(line);
                    if (expandedLine.includes(expandedItemName) || expandedItemName.includes(expandedLine)) {
                        const isAddressLine = addressKeywords.some(kw => line.includes(kw));
                        if (isAddressLine && !rawName.toUpperCase().includes('CAMINO')) {
                            score -= 45;
                        }
                    }
                }

                if (score > bestScore && score >= minScore) {
                    bestScore = score;
                    bestMatch = { id: item[idKey], nombre: item[nameKey], score, method: 'contains', extra: item };
                }
            }

            // 2. Word overlap check restricted to individual lines
            const itemWords = expandedItemName.split(' ').filter(w => w.length > 2 && w !== 'RILES' && w !== 'RIL');
            if (itemWords.length >= 1) {
                for (const line of lines) {
                    const expandedLine = expandAbbreviations(line);
                    const lineWords = expandedLine.split(' ').filter(w => w.length > 2);
                    
                    let matches = 0;
                    for (const iw of itemWords) {
                        if (lineWords.includes(iw)) matches++;
                    }

                    const density = matches / itemWords.length;
                    
                    // Relaxed density: 50% match if words are significant
                    if (density >= 0.5 || (matches >= 1 && expandedItemName.length > 10 && density >= 0.3)) {
                        let wordScore = 70 + (matches * 10);
                        if (matches === itemWords.length) wordScore += 15;
                        
                        if (density < 1) wordScore -= 5;

                        // LINE-SPECIFIC Penalty
                        const isAddressLine = addressKeywords.some(kw => line.includes(kw));
                        if (isAddressLine && !rawName.toUpperCase().includes('CAMINO')) {
                            wordScore -= 35;
                        }

                        if (wordScore > bestScore && wordScore >= minScore) {
                            bestScore = Math.min(98, wordScore);
                            bestMatch = { id: item[idKey], nombre: item[nameKey], score: bestScore, method: 'words', extra: item };
                        }
                    }
                }
            }
        }

        return bestMatch;
    }

    // =========================================================
    // 6. EXTRACT AND RESOLVE ALL FIELDS FROM PDF TEXT
    // =========================================================
    extractAndResolve(text, catalogs) {
        const errors = [];
        const warnings = [];
        const fields = {};

        // Split text into "Labels/Template" and "Data/Values"
        // In ADL forms, labels appear first, then a header like "FICHA INGRESO SERVICIO", then values.
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const normalLines = lines.map(l => normalize(l));
        
        let splitIdx = normalLines.findIndex(l => l.includes('FICHA INGRESO SERVICIO') || l.includes('ANALISIS'));
        if (splitIdx === -1) splitIdx = Math.floor(lines.length / 2); // Fallback

        const templateBlock = lines.slice(0, splitIdx).join('\n');
        const dataBlock = lines.slice(splitIdx).join('\n');
        const dataLines = lines.slice(splitIdx);

        // --- FIXED VALUES: Search for known constants ---
        const normalText = normalize(text);
        
        // Tipo Monitoreo
        if (normalText.includes('COMPUESTO') || normalText.includes('COMPUESTA')) {
            fields.tipoMonitoreo = 'Compuesta';
        } else if (normalText.includes('PUNTUAL')) {
            fields.tipoMonitoreo = 'Puntual';
        } else {
            fields.tipoMonitoreo = null;
            errors.push({ field: 'Monitoreo Agua/RIL', message: 'No se detectó "Compuesta" ni "Puntual" en el texto' });
        }

        // ETFA
        if (/ETFA.*?S[iI]/i.test(text) || /\bSi\b/.test(text)) {
            fields.esETFA = 'Si';
        } else {
            fields.esETFA = 'No';
        }

        // Medición Caudal
        const caudalMatches = text.match(/(?:Medici[oó]n\s+caudal|caudal)[\s\S]{0,50}?(Autom[aá]tico|Manual|No Aplica)/i);
        if (caudalMatches) {
            fields.medicionCaudal = caudalMatches[1];
        } else if (normalText.includes('AUTOMATICO')) {
            fields.medicionCaudal = 'Automático';
        } else if (normalText.includes('MANUAL')) {
            fields.medicionCaudal = 'Manual';
        } else {
            fields.medicionCaudal = 'No Aplica';
        }

        // Helper to find a value that is NOT a label
        const findValueInBlock = (catalog, minScore = 60) => {
            return this.findInText(dataBlock, catalog, 'nombre', 'id', minScore);
        };

        // --- CATALOG MATCHING ---
        // ---------------------------------------------------------
        
        // Base de operaciones (Lugar análisis)
        const lugarMatch = findValueInBlock(catalogs.lugares) || this.findInText(text, catalogs.lugares);
        if (lugarMatch) {
            fields.selectedLugar = String(lugarMatch.id);
            fields._lugarNombre = lugarMatch.nombre;
        } else {
            fields.selectedLugar = null;
            errors.push({ field: 'Base de operaciones', message: 'No se encontró la sede' });
        }

        // Empresa de servicio
        const empresaMatch = this.findInText(text, catalogs.empresasServicio);
        if (empresaMatch) {
            fields.selectedEmpresa = String(empresaMatch.id);
            fields._empresaNombre = empresaMatch.nombre;
        } else {
            fields.selectedEmpresa = null;
            errors.push({ field: 'Empresa de servicio', message: 'No se encontró la empresa de servicio' });
        }

        // Empresa a facturar (Cliente)
        // STRATEGY: Prioritize exact matches for "Empresa a Facturar" to avoid confusion with Service Provider
        let clienteMatch = this.findInText(text, catalogs.clientes, 'nombre', 'id', 85); // Strict first
        if (!clienteMatch) {
            clienteMatch = this.findInText(text, catalogs.clientes, 'nombre', 'id', 60); // Fuzzy fallback
        }
        
        if (clienteMatch) {
            fields.selectedCliente = String(clienteMatch.id);
            fields._clienteNombre = clienteMatch.nombre;
            logger.info(`[BulkFicha] Cliente Match [${clienteMatch.nombre}] ID: ${clienteMatch.id} Score: ${clienteMatch.score}`);
        } else {
            fields.selectedCliente = null;
            errors.push({ field: 'Empresa a facturar', message: 'No se encontró el cliente' });
        }

        // Fuente emisora (Centro)
        let centrosToSearch = catalogs.centros;
        if (clienteMatch) {
            const clientIds = [String(clienteMatch.id), Number(clienteMatch.id)];
            const filtered = catalogs.centros.filter(c => clientIds.includes(String(c.id_empresa)) || clientIds.includes(c.id_empresa));
            if (filtered.length > 0) centrosToSearch = filtered;
            logger.info(`[BulkFicha] Filtered source to ${filtered.length} candidates for client ${clienteMatch.nombre}`);
        }
        
        let centroMatch = this.findInText(dataBlock, centrosToSearch, 'nombre', 'id', 65);
        if (!centroMatch && clienteMatch) {
            // Fallback if client-filter was too strict
            centroMatch = this.findInText(dataBlock, catalogs.centros, 'nombre', 'id', 65);
        }
        if (!centroMatch) {
             // Second fallback to whole text but with address penalty (already in findInText)
             centroMatch = this.findInText(text, centrosToSearch, 'nombre', 'id', 70);
        }

        if (centroMatch) {
            fields.selectedFuente = String(centroMatch.id);
            fields._fuenteNombre = centroMatch.nombre;
            fields._fuenteMatch_score = centroMatch.score;
            fields._fuenteMatch_method = centroMatch.method;
            // Auto-fill derived fields
            const centro = centroMatch.extra;
            fields.tipoAgua = centro.tipo_agua || '';
            fields.idTipoAgua = centro.id_tipoagua || null;
            fields.ubicacion = centro.direccion || '';
            fields.comuna = centro.comuna || '';
            fields.region = centro.region || '';
            logger.info(`[BulkFicha] Fuente Match [${centroMatch.nombre}] Score: ${centroMatch.score}`);
        } else {
            fields.selectedFuente = null;
            errors.push({ field: 'Fuente emisora', message: 'No se encontró la fuente' });
        }

        // Frecuencia Periodo
        // Prioritize finding it in the data block to avoid noise from duration/hours
        let freqMatch = this.findInText(dataBlock, catalogs.frecuencias, 'nombre', 'id', 80);
        
        if (!freqMatch) {
            // Search near the label
            const freqLabelIdx = lines.findIndex(l => normalize(l).includes('FRECUENCIA MUESTREO'));
            if (freqLabelIdx !== -1) {
                const searchArea = lines.slice(Math.max(0, freqLabelIdx - 2), freqLabelIdx + 5).join('\n');
                freqMatch = this.findInText(searchArea, catalogs.frecuencias, 'nombre', 'id', 70);
            }
        }
        
        if (!freqMatch) {
            freqMatch = this.findInText(text, catalogs.frecuencias);
        }

        // CRITICAL FIX: "Mensual" priority over "Hora"
        // Common issue where "24 horas" (duration) triggers "Hora" frequency match.
        const normalTextLower = normalize(text).toUpperCase();
        if (normalTextLower.includes('MENSUAL')) {
             const mensualEntry = catalogs.frecuencias.find(f => f.nombre.toUpperCase() === 'MENSUAL');
             if (mensualEntry) {
                 // Even if freqMatch found something else, if it's low score or "Hora", prefer "Mensual"
                 if (!freqMatch || freqMatch.nombre.toUpperCase() === 'HORA' || freqMatch.score < 90) {
                     freqMatch = { id: mensualEntry.id, nombre: mensualEntry.nombre, score: 99, extra: mensualEntry };
                 }
             }
        }

        if (freqMatch) {
            fields.periodo = String(freqMatch.id);
            fields._periodoNombre = freqMatch.nombre;
            fields.frecuencia = String(freqMatch.extra?.cantidad || 1);
            fields.factor = String(freqMatch.extra?.multiplicadopor || 1);
        } else {
            fields.periodo = null;
            fields.frecuencia = '1';
            fields.factor = '1';
        }

        // Logic for explicit Frecuencia Muestreo and Factor using Relative Proximity
        const findValueAfterLabel = (label) => {
            const idx = lines.findIndex(l => normalize(l).includes(normalize(label)));
            if (idx !== -1) {
                // Search next 3 lines
                for (let i = 1; i <= 3; i++) {
                    if (lines[idx+i] && /^\d+$/.test(lines[idx+i])) return lines[idx+i];
                }
                
                // NEW: Search in the Data Block using sequential mapping
                // Find the relative position of the label in the template
                const labelsOfInterest = ['FRECUENCIA MUESTREO', 'FACTOR', 'DURACION MUESTREO', 'PUNTO DE MUESTREO'];
                const labelPos = labelsOfInterest.indexOf(normalize(label));
                if (labelPos !== -1) {
                    // Try to find known values around freq/factor area in dataLines
                    // In this PDF, Mensual is line 73, and "4" (freq) is line 74.
                    const mensualIdx = dataLines.findIndex(l => normalize(l).includes('MENSUAL') || normalize(l).includes('SEMANAL') || normalize(l).includes('DIARIO'));
                    if (mensualIdx !== -1) {
                        if (normalize(label) === 'FRECUENCIA MUESTREO' && dataLines[mensualIdx+1] && /^\d+$/.test(dataLines[mensualIdx+1])) {
                             return dataLines[mensualIdx+1];
                        }
                    }
                }
            }
            return null;
        };

        const docFreq = findValueAfterLabel('FRECUENCIA MUESTREO');
        if (docFreq) fields.frecuencia = docFreq;

        const docFactor = findValueAfterLabel('FACTOR');
        if (docFactor) fields.factor = docFactor;
        else {
            // Fallback if Factor is empty or missing line
            fields.factor = (fields.frecuencia === '1' && fields._periodoNombre === 'Mensual') ? '12' : '1';
        }

        const fv = parseInt(fields.frecuencia) || 1;
        const fa = parseInt(fields.factor) || 1;
        fields.totalServicios = String(fv * fa);

        // --- OTHER PATTERN FIELDS ---
        // Google Maps URL
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/i);
        fields.refGoogle = urlMatch ? urlMatch[1] : '';

        // Coordinates: UTM[Huso][Easting][Northing]
        const coordMatch = text.match(/UTM\s*(\d{2})\s*(\d{5,8})\s*(\d{5,8})/i);
        if (coordMatch) {
            fields.zona = coordMatch[1] + 'H'; // Assume H hemisphere for Chile
            fields.utmNorte = coordMatch[2];
            fields.utmEste = coordMatch[3];
        } else {
            // Try alternate format
            const coordMatch2 = text.match(/(\d{2}[A-Z])\s*UTM\s*(\d+)\s*[EeNn]\s*(\d+)/i);
            if (coordMatch2) {
                fields.zona = coordMatch2[1];
                fields.utmNorte = coordMatch2[2];
                fields.utmEste = coordMatch2[3];
            } else {
                // Positional search for coordinates
                const latIdx = dataLines.findIndex(l => l.startsWith('UTM') || l.includes('5426'));
                if (latIdx !== -1) {
                     const parts = dataLines[latIdx].match(/UTM\s*(\d+)\s*(\d+)\s*(\d+)/i);
                     if (parts) {
                         fields.zona = parts[1] + 'H';
                         fields.utmNorte = parts[2];
                         fields.utmEste = parts[3];
                     }
                } else {
                    fields.zona = 'No aplica';
                    fields.utmNorte = '';
                    fields.utmEste = '';
                    warnings.push({ field: 'Coordenadas', message: 'No se detectaron coordenadas UTM' });
                }
            }
        }

        // Email
        const emailMatch = text.match(/([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        fields.contactoEmail = emailMatch ? emailMatch[1] : '';

        // Duration (hours)
        const durMatch = text.match(/(?:Duraci[oó]n|(\d{1,3}))\s*(?:hrs|horas|muestreo)/i)
            || text.match(/\b(\d{1,3})\b/g); // Fallback: find a number near duration context
        // Search specifically near "24" pattern (common duration)
        const durLines = text.split('\n');
        let foundDuration = '';
        for (let i = 0; i < durLines.length; i++) {
            if (durLines[i].match(/^\d{1,3}$/) && parseInt(durLines[i]) >= 1 && parseInt(durLines[i]) <= 168) {
                // Could be duration, but we need context. Save as candidate.
                if (!foundDuration) foundDuration = durLines[i].trim();
            }
        }
        fields.duracion = foundDuration || '24'; // Default 24hrs for compuesto

        // Factor / Frecuencia
        const factorMatch = text.match(/\b(\d{1,3})\b/g);
        // We'll refine this after matching frecuencia catalog

        // Responsable Muestreo
        if (normalText.includes('ADL DIAGNOSTIC') || normalText.includes('ADL')) {
            fields.responsableMuestreo = 'ADL';
        } else {
            fields.responsableMuestreo = 'Cliente';
        }

        // Contacto Lookup
        fields.selectedContacto = null;
        fields.contactoNombre = 'Cliente';
        fields.contactoEmail = emailMatch ? emailMatch[1] : '';

        // Filter contact catalog by detected companies (STRICT FILTER)
        let contactCandidates = catalogs.contactos;
        if (fields.selectedCliente && fields.selectedEmpresa) {
            // Prefer contacts linked to BOTH
            const strict = catalogs.contactos.filter(c => 
                String(c.id_empresa) === String(fields.selectedCliente) && 
                String(c.id_empresaservicio) === String(fields.selectedEmpresa)
            );
            if (strict.length > 0) contactCandidates = strict;
            else {
                // Fallback to contacts linked to at least the Facturar company
                contactCandidates = catalogs.contactos.filter(c => String(c.id_empresa) === String(fields.selectedCliente));
            }
        } else if (fields.selectedCliente) {
            contactCandidates = catalogs.contactos.filter(c => String(c.id_empresa) === String(fields.selectedCliente));
        }

        // Try to match by email first
        if (fields.contactoEmail) {
            const byEmail = contactCandidates.find(c => c.email.toLowerCase() === fields.contactoEmail.toLowerCase());
            if (byEmail) {
                fields.selectedContacto = String(byEmail.id);
                fields.contactoNombre = byEmail.nombre;
            }
        }

        // If not found by email, try matching name from text
        if (!fields.selectedContacto) {
            const contactNames = text.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\s*;/g);
            if (contactNames && contactNames.length > 0) {
                const rawContactName = contactNames[0].replace(';', '').trim();
                const nameMatch = this.findInText(rawContactName, contactCandidates, 'nombre', 'id', 85);
                if (nameMatch) {
                    fields.selectedContacto = String(nameMatch.id);
                    fields.contactoNombre = nameMatch.nombre;
                } else {
                    fields.contactoNombre = rawContactName;
                }
            }
        }

        // Objetivo del Muestreo
        const objMatch = findValueInBlock(catalogs.objetivos) || this.findInText(text, catalogs.objetivos);
        if (objMatch) {
            fields.selectedObjetivo = String(objMatch.id);
            fields._objetivoNombre = objMatch.nombre;
        } else {
            fields.selectedObjetivo = null;
            errors.push({ field: 'Objetivo del Muestreo', message: 'No se encontró el objetivo en los catálogos' });
        }

        // Cargo
        if (fields.responsableMuestreo === 'ADL') {
            fields.cargoResponsable = '53'; // Default ADL cargo
        } else {
            const cargoMatch = findValueInBlock(catalogs.cargos) || this.findInText(text, catalogs.cargos);
            fields.cargoResponsable = cargoMatch ? String(cargoMatch.id) : '53';
        }

        // Punto de muestreo (free text - search for common terms)
        const puntoTerms = ['Efluente', 'Afluente', 'Descarga', 'Entrada', 'Salida', 'Punto', 'RIL'];
        let foundPunto = '';
        const lowerDataBlock = dataBlock.toLowerCase();
        for (const term of puntoTerms) {
            if (lowerDataBlock.includes(term.toLowerCase())) {
                foundPunto = term;
                break;
            }
        }
        fields.puntoMuestreo = foundPunto || 'Sin determinar';

        // Instrumento Ambiental
        const instrMatch = findValueInBlock(catalogs.instrumentos) || this.findInText(text, catalogs.instrumentos);
        if (instrMatch) {
            fields.selectedInstrumento = instrMatch.nombre;
            // Try to extract number & year
            const instrNumMatch = text.match(/(?:Resoluci[oó]n|RCA|D\.?S\.?)\s*(?:SISS\s*)?(?:N[°º]?\s*)?(\d+)\s*[\/]\s*(\d{4})/i);
            if (instrNumMatch) {
                fields.nroInstrumento = instrNumMatch[1];
                fields.anioInstrumento = instrNumMatch[2];
            } else {
                fields.nroInstrumento = '';
                fields.anioInstrumento = '';
                warnings.push({ field: 'Instrumento', message: 'Se encontró el instrumento pero no su número/año' });
            }
        } else {
            fields.selectedInstrumento = 'No aplica';
            fields.nroInstrumento = '';
            fields.anioInstrumento = '';
            warnings.push({ field: 'Instrumento Ambiental', message: 'No se encontró el instrumento en los catálogos' });
        }

        // Componente Ambiental
        const compMatch = findValueInBlock(catalogs.componentes) || this.findInText(text, catalogs.componentes);
        if (compMatch) {
            fields.selectedComponente = String(compMatch.id);
            fields._componenteNombre = compMatch.nombre;
        } else {
            fields.selectedComponente = null;
            errors.push({ field: 'Componente Ambiental', message: 'No se encontró el componente ambiental' });
        }

        // Sub Área
        let subAreaDetected = null;
        const normalizedFull = normalize(text).toUpperCase();
        
        // HIGHEST PRIORITY: Explicit "Agua Residual" or "RIL"
        if (normalizedFull.includes('AGUA RESIDUAL') || normalizedFull.includes('RESIDUALES') || normalizedFull.includes('RIL')) {
             const residualMatch = catalogs.subAreas.find(t => {
                 const n = t.nombre.toUpperCase();
                 return n.includes('AGUA RESIDUAL') || n.includes('RESIDUAL') || n.includes(' RIL');
             });
             if (residualMatch) {
                 subAreaDetected = { id: String(residualMatch.id), nombre: residualMatch.nombre };
                 logger.info(`[BulkFicha] SubArea Priority Match (from mae_subarea): ${residualMatch.nombre}`);
             }
        }

        if (!subAreaDetected) {
            const subMatch = findValueInBlock(catalogs.subAreas, 70) || this.findInText(text, catalogs.subAreas, 'nombre', 'id', 70);
            if (subMatch) {
                subAreaDetected = { id: String(subMatch.id), nombre: subMatch.nombre };
            }
        }

        if (subAreaDetected) {
            fields.selectedSubArea = subAreaDetected.id;
            fields._subAreaNombre = subAreaDetected.nombre;
        } else {
            fields.selectedSubArea = null;
            warnings.push({ field: 'Sub Área', message: 'No se encontró la sub área. Requiere corrección manual.' });
        }

        // Glosa (auto-generated)
        const fuenteName = fields._fuenteNombre || '';
        const objName = fields._objetivoNombre || '';
        fields.glosa = (fuenteName && objName) ? `${fuenteName} - ${objName}` : 'Sin glosa';

        // Inspector Ambiental
        const inspMatch = findValueInBlock(catalogs.inspectores) || this.findInText(text, catalogs.inspectores);
        if (inspMatch) {
            fields.selectedInspector = String(inspMatch.id);
            fields._inspectorNombre = inspMatch.nombre;
        } else {
            fields.selectedInspector = '';
            warnings.push({ field: 'Inspector', message: 'No se encontró el inspector. Se dejará vacío.' });
        }

        // Tipo Muestreo
        const tMuestreoMatch = findValueInBlock(catalogs.tiposMuestreo) || this.findInText(text, catalogs.tiposMuestreo);
        if (tMuestreoMatch) {
            fields.selectedTipoMuestreo = String(tMuestreoMatch.id);
            fields._tipoMuestreoNombre = tMuestreoMatch.nombre;
        } else {
            fields.selectedTipoMuestreo = null;
            warnings.push({ field: 'Tipo Muestreo', message: 'No se encontró el tipo de muestreo' });
        }

        // Tipo Muestra
        const tMuestraMatch = this.findInText(text, catalogs.tiposMuestra);
        if (tMuestraMatch) {
            fields.selectedTipoMuestra = String(tMuestraMatch.id);
        } else {
            fields.selectedTipoMuestra = null;
            warnings.push({ field: 'Tipo Muestra', message: 'No se encontró el tipo de muestra' });
        }

        // Actividad Muestreo
        const actMatch = this.findInText(text, catalogs.actividades);
        if (actMatch) {
            fields.selectedActividad = String(actMatch.id);
        } else {
            fields.selectedActividad = null;
            warnings.push({ field: 'Actividad', message: 'No se encontró la actividad de muestreo' });
        }

        // Tipo Descarga
        const descMatch = this.findInText(text, catalogs.tiposDescarga);
        if (descMatch) {
            fields.selectedTipoDescarga = String(descMatch.id);
        } else {
            fields.selectedTipoDescarga = 'No Aplica';
        }

        // Modalidad
        const modMatch = this.findInText(text, catalogs.modalidades);
        if (modMatch) {
            fields.selectedModalidad = String(modMatch.id);
        } else {
            fields.selectedModalidad = 'No Aplica';
        }

        // Forma Canal / Dispositivo (often "No Aplica")
        fields.formaCanal = 'No Aplica';
        fields.detalleCanal = 'No Aplica';
        fields.dispositivo = 'No Aplica';
        fields.detalleDispositivo = 'No Aplica';
        fields.tipoMedidaCanal = null;
        fields.tipoMedidaDispositivo = null;

        return { fields, errors, warnings };
    }

    // =========================================================
    // 7. RESOLVE ANALYSIS ROWS TO DB IDS
    // =========================================================
    async resolveAnalysisRows(analysisRows, catalogs, text) {
        const resolved = [];
        const errors = [];

        // PRE-PROCESSING: Normalize common normativa names to help matching
        let normText = text.replace(/D\.S\./gi, 'DS').replace(/D\.S/gi, 'DS').replace(/D-S/gi, 'DS');
        
        const normMatch = this.findInText(normText, catalogs.normativas, 'nombre', 'id', 50);
        const normId = normMatch ? normMatch.id : null;
        const normNombre = normMatch ? normMatch.nombre : null;

        // Find normativa referencia
        let normRefId = null;
        let normRefNombre = null;
        if (normId) {
            const refs = catalogs.normativaReferencias.filter(r => r.id_normativa === normId);
            if (refs.length > 0) {
                // Try to match referencia name in text
                const refMatch = this.findInText(text, refs);
                if (refMatch) {
                    normRefId = refMatch.id;
                    normRefNombre = refMatch.nombre;
                } else {
                    // Try to find one that says "Tabla 1" or similar common default
                    const tabla1 = refs.find(r => r.nombre && typeof r.nombre === 'string' && r.nombre.toLowerCase().includes('tabla 1'));
                    if (tabla1) {
                        normRefId = tabla1.id;
                        normRefNombre = tabla1.nombre;
                    } else {
                        // Use first one
                        normRefId = refs[0].id;
                        normRefNombre = refs[0].nombre;
                    }
                }
            }
        }

        if (!normId) {
            errors.push({ field: 'Normativa', message: 'No se encontró la normativa en los catálogos' });
        }

        // LOAD ANALYSIS FROM SP FOR THIS NORM/REF
        let analysisCatalog = [];
        if (normRefId) {
            try {
                const pool = await getConnection();
                const spRes = await pool.request()
                    .input('xid_normativareferencia', normRefId)
                    .execute('Consulta_App_Ma_ReferenciaAnalisis');
                analysisCatalog = spRes.recordset.map(r => ({
                    id: r.id_referenciaanalisis,
                    nombre: r.nombre_tecnica, // In this SP, tecnica name acts as analysis name
                    id_tecnica: r.id_tecnica,
                    nombre_tecnica: r.nombre_tecnica,
                    limitemax_d: r.limitemax_d,
                    limitemax_h: r.limitemax_h,
                    llevaerror: r.llevaerror,
                    error_min: r.error_min,
                    error_max: r.error_max
                }));
            } catch (e) {
                logger.warn(`[BulkFicha] Failed to fetch Analysis SP for ref ${normRefId}: ${e.message}`);
            }
        }

        for (const row of analysisRows) {
            const rowErrors = [];

            // Match analysis name against specific REF catalog!
            let id_referenciaanalisis = null;
            let id_tecnica = null;
            let limitemax_d = null;
            let limitemax_h = null;
            let row_llevaerror = 'N';
            let row_error_min = null;
            let row_error_max = null;
            let refMatch = null;

            if (analysisCatalog.length > 0) {
                refMatch = findBestMatch(row.nombre, analysisCatalog, 'nombre', 'id', 40);
                if (refMatch) {
                    id_referenciaanalisis = refMatch.id;
                    const fullRef = analysisCatalog.find(r => r.id === refMatch.id);
                    if (fullRef) {
                        id_tecnica = fullRef.id_tecnica;
                        id_referenciaanalisis = fullRef.id;
                        limitemax_d = fullRef.limitemax_d;
                        limitemax_h = fullRef.limitemax_h;
                        row_llevaerror = fullRef.llevaerror || 'N';
                        row_error_min = fullRef.error_min;
                        row_error_max = fullRef.error_max;
                    }
                }
            } 
            
            // FALLBACK BUSQUEDA GLOBAL
            if (!refMatch && catalogs.referenciaAnalisis && catalogs.referenciaAnalisis.length > 0) {
                const globalMatch = findBestMatch(row.nombre, catalogs.referenciaAnalisis, 'nombre', 'id', 40);
                if (globalMatch) {
                    refMatch = globalMatch;
                    id_referenciaanalisis = globalMatch.id;
                    const fullRef = catalogs.referenciaAnalisis.find(r => r.id === globalMatch.id);
                    if (fullRef) {
                        id_tecnica = fullRef.id_tecnica;
                        id_referenciaanalisis = fullRef.id;
                        limitemax_d = fullRef.limitemax_d;
                        limitemax_h = fullRef.limitemax_h;
                        row_llevaerror = fullRef.llevaerror || 'N';
                        row_error_min = fullRef.error_min;
                        row_error_max = fullRef.error_max;
                    }
                    rowErrors.push(`Obtenido mediante Fallback desde otra Normativa`);
                } else {
                    rowErrors.push(`Análisis "${row.nombre}" no encontrado en la Normativa ni en el Catálogo Global`);
                }
            } else if (!refMatch) {
                rowErrors.push(`Análisis "${row.nombre}" omitido (Tabla de Referencia vacía o SP falló)`);
            }

            // Match laboratorio
            const labMatch = findBestMatch(row.laboratorio_texto, catalogs.laboratorios, 'nombre', 'id', 50);
            const id_laboratorio = labMatch ? labMatch.id : null;
            if (!labMatch && row.tipo_analisis === 'Laboratorio') {
                rowErrors.push(`Laboratorio "${row.laboratorio_texto}" no encontrado`);
            }

            // Match tipo entrega
            const entregaMatch = findBestMatch(row.tipo_entrega_texto, catalogs.tiposEntrega, 'nombre', 'id', 70);
            const id_tipoentrega = entregaMatch ? entregaMatch.id : null;

            resolved.push({
                nombre_original: row.nombre,
                tipo_analisis: row.tipo_analisis,
                laboratorio_texto: row.laboratorio_texto,
                tipo_entrega_texto: row.tipo_entrega_texto,
                id_referenciaanalisis,
                id_tecnica,
                id_normativa: normId,
                id_normativareferencia: normRefId,
                id_laboratorioensayo: row.tipo_analisis === 'Terreno' ? 0 : id_laboratorio,
                id_laboratorioensayo_2: null,
                id_tipoentrega,
                id_transporte: null,
                uf_individual: 0, 
                limitemax_d,
                limitemax_h,
                llevaerror: row_llevaerror,
                error_min: row_error_min,
                error_max: row_error_max,
                _matched: !!refMatch,
                _labMatched: !!labMatch || row.tipo_analisis === 'Terreno',
                _errors: rowErrors
            });
        }

        return { 
            resolved, 
            errors, 
            normativaId: normId,
            normativaNombre: normNombre, 
            normativaRefId: normRefId,
            normativaRefNombre: normRefNombre 
        };
    }

    // =========================================================
    // 8. PROCESS A BATCH OF PDF FILES
    // =========================================================
    async processBatch(files) {
        logger.info(`[BulkFicha] Processing batch of ${files.length} PDFs...`);

        // Load catalogs ONCE for the entire batch
        const catalogs = await this.loadCatalogs();

        const results = [];
        let processedCount = 0;

        for (const file of files) {
            processedCount++;
            const result = {
                filename: file.originalname || file.name || `file_${processedCount}`,
                index: processedCount,
                status: 'PENDING',
                antecedentes: null,
                analisis: [],
                observaciones: '',
                errors: [],
                warnings: [],
                analysisErrors: []
            };

            try {
                // Extract text
                const text = await this.parsePdf(file.buffer);

                if (!text || text.trim().length < 50) {
                    result.status = 'ERROR';
                    result.errors.push({ field: 'PDF', message: 'El archivo PDF no contiene texto suficiente. ¿Es un escaneo?' });
                    results.push(result);
                    continue;
                }

                // Extract and resolve antecedentes
                const { fields, errors, warnings } = this.extractAndResolve(text, catalogs);
                result.antecedentes = fields;
                result.errors = errors;
                result.warnings = warnings;

                // Extract and resolve analysis rows (AWAIT)
                const analysisRows = this.extractAnalysisRows(text);
                const { 
                    resolved, 
                    errors: analysisErrs, 
                    normativaId, 
                    normativaNombre, 
                    normativaRefId, 
                    normativaRefNombre 
                } = await this.resolveAnalysisRows(analysisRows, catalogs, text);
                
                result.analisis = resolved;
                result.analysisErrors = analysisErrs;

                // Inject normativa info back into antecedents for saving
                if (result.antecedentes) {
                    result.antecedentes.selectedNormativa = normativaId ? String(normativaId) : null;
                    result.antecedentes.selectedNormativaRef = normativaRefId ? String(normativaRefId) : null;
                    result.antecedentes._normativaNombre = normativaNombre;
                    result.antecedentes._normativaRefNombre = normativaRefNombre;
                }

                // Extract observations
                result.observaciones = this.extractObservations(text);

                // Store normativa info for UI display
                result._normativa = normativaNombre;
                result._normativaRef = normativaRefNombre;

                // Determine status
                const criticalErrors = result.errors.filter(e =>
                    ['Empresa de servicio', 'Empresa a facturar', 'Fuente emisora'].includes(e.field)
                );
                const unmatchedAnalysis = resolved.filter(r => !r._matched);

                if (criticalErrors.length > 0) {
                    result.status = 'ERROR';
                } else if (result.errors.length > 0 || unmatchedAnalysis.length > 0 || result.warnings.length > 0) {
                    result.status = 'WARNING';
                } else {
                    result.status = 'READY';
                }

                if (analysisRows.length === 0) {
                    result.status = 'ERROR';
                    result.errors.push({ field: 'Análisis', message: 'No se detectaron filas de análisis en el PDF' });
                }

            } catch (err) {
                logger.error(`[BulkFicha] Error processing ${result.filename}:`, err);
                result.status = 'ERROR';
                result.errors.push({ field: 'Sistema', message: `Error al procesar: ${err.message}` });
            }

            results.push(result);
        }

        // Summary
        const ready = results.filter(r => r.status === 'READY').length;
        const warn = results.filter(r => r.status === 'WARNING').length;
        const err = results.filter(r => r.status === 'ERROR').length;
        logger.info(`[BulkFicha] Batch complete: ${ready} ready, ${warn} warnings, ${err} errors`);

        return {
            total: results.length,
            ready,
            warnings: warn,
            errors: err,
            items: results
        };
    }

    // =========================================================
    // 9. COMMIT VALIDATED ITEMS (Create actual fichas)
    // =========================================================
    async commitBatch(items, userId) {
        logger.info(`[BulkFicha] Committing ${items.length} fichas...`);
        const results = [];

        for (const item of items) {
            try {
                // Build payload in the format createFicha expects
                // Only include analysis rows that were successfully matched (have id_referenciaanalisis)
                const payload = {
                    antecedentes: item.antecedentes,
                    analisis: item.analisis
                        .filter(a => a.id_referenciaanalisis) // CRITICAL: Filter out unmatched rows
                        .map(a => ({
                            id_tecnica: a.id_tecnica,
                            id_normativa: a.id_normativa || item.antecedentes?.selectedNormativa, // Fallback to header norm
                            id_normativareferencia: a.id_normativareferencia || item.antecedentes?.selectedNormativaRef,
                            id_referenciaanalisis: a.id_referenciaanalisis,
                            limitemax_d: a.limitemax_d,
                            limitemax_h: a.limitemax_h,
                            llevaerror: a.llevaerror || 'N',
                            error_min: a.error_min,
                            error_max: a.error_max,
                            tipo_analisis: a.tipo_analisis,
                            uf_individual: a.uf_individual || 0,
                            id_laboratorioensayo: String(a.id_laboratorioensayo) === '0' ? 0 : (a.id_laboratorioensayo || 0),
                            id_laboratorioensayo_2: null,
                            id_tipoentrega: a.id_tipoentrega || item.antecedentes?.selectedTipoEntrega || 0,
                            id_transporte: a.id_transporte || 0
                        })),
                    observaciones: item.observaciones || 'Carga masiva PDF',
                    user: { id: userId }
                };

                const result = await fichaService.createFicha(payload);
                results.push({
                    filename: item.filename,
                    success: true,
                    fichaId: result.id,
                    message: `Ficha #${result.id} creada exitosamente`
                });
            } catch (err) {
                logger.error(`[BulkFicha] Error creating ficha for ${item.filename}:`, err);
                results.push({
                    filename: item.filename,
                    success: false,
                    fichaId: null,
                    message: `Error: ${err.message}`
                });
            }
        }

        const created = results.filter(r => r.success).length;
        logger.info(`[BulkFicha] Commit complete: ${created}/${items.length} fichas created`);

        return {
            total: items.length,
            created,
            failed: items.length - created,
            results
        };
    }
}

export default new BulkFichaService();
