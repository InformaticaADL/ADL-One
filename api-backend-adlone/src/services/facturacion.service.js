import sql from '../config/database.js';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import PDFDocument from 'pdfkit-table';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getTransporter } from '../config/mailer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(__dirname, '../../uploads');

const fmtUf = (n) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const fmtClp = (n) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
// Valor de la UF del día (magnitud ~$40.000), 2 decimales — distinto de fmtUf (montos de línea, 3 decimales).
const fmtUfValor = (n) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

class FacturacionService {

    /**
     * Casos facturables de Medio Ambiente: muestreos ejecutados con su informe
     * completo (ver trg_App_Ma_Resultados_InformeCompleto) y aún no incluidos
     * en ninguna pre-factura. El grano es el muestreo (id_agendamam), no la
     * ficha: una ficha con N frecuencias (visitas recurrentes) genera N casos
     * facturables independientes, cada uno cobrado al precio completo de su
     * ficha (confirmado con datos reales — no se reparte entre visitas).
     *
     * Solo lectura. No escribe id_estado_facturacion — eso ocurre recién al
     * crear una pre-factura (Fase 2), dentro de una transacción que bloquea
     * los casos elegidos.
     *
     * @param {Object} filtros
     * @param {number} [filtros.idEmpresaServicio] - entidad a facturar (RUT)
     * @param {number} [filtros.idEmpresa]
     * @param {number} [filtros.idCentro]
     * @param {string} [filtros.fechaInicio] - filtra por fecha_informe (YYYY-MM-DD)
     * @param {string} [filtros.fechaFin]
     * @returns {Promise<Array>}
     */
    async getCasosFacturables(filtros = {}) {
        const pool = await getConnection();
        const request = pool.request();

        const condiciones = [
            'a.id_estadomuestreo = 3',            // Ejecutado
            "a.informe_emitido = 'S'",             // resultados completos (trigger)
            'a.id_estado_facturacion IS NULL',     // aún no incluido en ninguna PF
        ];

        if (filtros.idEmpresaServicio) {
            request.input('idEmpresaServicio', sql.Numeric(10, 0), filtros.idEmpresaServicio);
            condiciones.push('f.id_empresaservicio = @idEmpresaServicio');
        }
        if (filtros.idEmpresa) {
            request.input('idEmpresa', sql.Numeric(10, 0), filtros.idEmpresa);
            condiciones.push('f.id_empresa = @idEmpresa');
        }
        if (filtros.idCentro) {
            request.input('idCentro', sql.Numeric(10, 0), filtros.idCentro);
            condiciones.push('f.id_centro = @idCentro');
        }
        if (filtros.fechaInicio) {
            request.input('fechaInicio', sql.Date, filtros.fechaInicio);
            condiciones.push('a.fecha_informe_emitido >= @fechaInicio');
        }
        if (filtros.fechaFin) {
            request.input('fechaFin', sql.Date, filtros.fechaFin);
            condiciones.push('a.fecha_informe_emitido <= @fechaFin');
        }

        const query = `
            SELECT
                a.id_agendamam,
                ISNULL(NULLIF(a.caso_adlab, ''), a.frecuencia_correlativo)              AS n_caso,
                f.id_fichaingresoservicio,
                f.id_empresaservicio,
                es.nombre_empresaservicios                                  AS empresaservicio_nombre,
                f.id_empresa,
                emp.nombre_empresa                                          AS empresa_nombre,
                f.id_centro,
                cen.nombre_centro                                           AS centro_nombre,
                f.id_tipoagua,
                a.fecha_informe_emitido                                     AS fecha_informe,
                ISNULL((
                    SELECT SUM(d.uf_individual)
                    FROM App_Ma_FichaIngresoServicio_DET d
                    WHERE d.id_fichaingresoservicio = f.id_fichaingresoservicio
                      AND d.activo = 1
                ), 0)                                                       AS precio_uf
            FROM App_Ma_Agenda_MUESTREOS a
            JOIN App_Ma_FichaIngresoServicio_ENC f
                 ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = f.id_empresaservicio
            LEFT JOIN mae_empresa emp          ON emp.id_empresa = f.id_empresa
            LEFT JOIN mae_centro cen           ON cen.id_centro = f.id_centro
            WHERE ${condiciones.join(' AND ')}
            ORDER BY f.id_empresaservicio, f.id_centro, a.id_agendamam;
        `;

        try {
            const result = await request.query(query);
            return result.recordset;
        } catch (error) {
            logger.error('Error obteniendo casos facturables:', error);
            throw error;
        }
    }

    /**
     * Valor UF a usar: el indicado, o el último registrado en fac_valor_uf
     * con fecha <= la indicada (hoy por defecto).
     */
    async resolverValorUf(transactionOrPool, fecha) {
        const req = new sql.Request(transactionOrPool);
        req.input('fecha', sql.Date, fecha || new Date());
        const result = await req.query(`
            SELECT TOP 1 valor
            FROM fac_valor_uf
            WHERE fecha <= @fecha
            ORDER BY fecha DESC
        `);
        if (result.recordset.length === 0) {
            throw new Error('No hay valor UF registrado en fac_valor_uf para la fecha solicitada.');
        }
        return result.recordset[0].valor;
    }

    /**
     * Crea una o más pre-facturas a partir de una selección de casos
     * facturables (id_agendamam). Todo dentro de una única transacción:
     *
     *   1) Reclama los casos (UPDATE ... WHERE id_estado_facturacion IS NULL,
     *      con OUTPUT) — si alguno ya fue tomado por otro proceso mientras
     *      tanto, aborta TODA la operación (evita doble cobro por carrera).
     *   2) Trae datos autoritativos de cada caso reclamado (no confía en lo
     *      que mandó el cliente, salvo la selección de IDs).
     *   3) Agrupa: SIEMPRE por id_empresaservicio primero (una factura es a
     *      una sola entidad), y dentro de eso, según agrupacionTipo:
     *      SIN_AGRUPACION (todo junto) | CENTRO | TIPO_AGUA.
     *   4) Por cada grupo: correlativo (fac_prefactura_seq), snapshot de
     *      precio y valor UF, inserta fac_prefactura + fac_prefactura_caso,
     *      y dispara fac_historial.
     *
     * @param {Object} input
     * @param {number[]} input.idAgendamamList
     * @param {'SIN_AGRUPACION'|'CENTRO'|'TIPO_AGUA'} [input.agrupacionTipo]
     * @param {number} [input.valorUf] - si no se indica, se resuelve de fac_valor_uf
     * @param {string} [input.formaPago]
     * @param {string} [input.mesAno]
     * @param {string} [input.glosa]
     * @param {string} [input.glosaFe]
     * @param {string} [input.observaciones]
     * @param {string} [input.facturadoPor]
     * @param {Object<number,number>} [input.costosOperativos] - id_agendamam -> UF manual (default 0)
     * @param {number} idUsuario
     * @returns {Promise<Array<{numero_id:number, id_prefactura:number, id_empresaservicio:number, agrupacion_valor:string, total_uf:number, total_clp:number, casos:number}>>}
     */
    async crearPrefacturas(input, idUsuario) {
        const ids = [...new Set((input.idAgendamamList || []).map(Number))];
        if (ids.length === 0) throw new Error('Debe seleccionar al menos un caso.');
        if (ids.some((n) => !Number.isInteger(n) || n <= 0)) {
            throw new Error('idAgendamamList debe contener solo IDs numéricos válidos.');
        }

        const agrupacionTipo = input.agrupacionTipo || 'SIN_AGRUPACION';
        if (!['SIN_AGRUPACION', 'CENTRO', 'TIPO_AGUA'].includes(agrupacionTipo)) {
            throw new Error('agrupacionTipo inválido.');
        }

        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const idsInClause = ids.join(',');

            // 1) Reclamar (candado anti doble-cobro)
            const claim = await new sql.Request(transaction).query(`
                UPDATE App_Ma_Agenda_MUESTREOS
                SET id_estado_facturacion = 'EN_PREFACTURA'
                OUTPUT inserted.id_agendamam
                WHERE id_agendamam IN (${idsInClause})
                  AND id_estado_facturacion IS NULL
            `);
            const claimedIds = claim.recordset.map((r) => r.id_agendamam);
            if (claimedIds.length !== ids.length) {
                const perdidos = ids.filter((id) => !claimedIds.includes(id));
                throw new Error(`Estos casos ya no están disponibles (tomados por otro proceso): ${perdidos.join(', ')}. Vuelve a cargar la cola de facturables.`);
            }

            // 2) Datos autoritativos de cada caso reclamado
            const detalle = await new sql.Request(transaction).query(`
                SELECT
                    a.id_agendamam, ISNULL(NULLIF(a.caso_adlab, ''), a.frecuencia_correlativo) AS caso_adlab,
                    f.id_fichaingresoservicio, f.id_empresaservicio, f.id_empresa,
                    f.id_centro, cen.nombre_centro, f.id_tipoagua, a.fecha_informe_emitido AS fecha_informe,
                    ISNULL((
                        SELECT SUM(d.uf_individual)
                        FROM App_Ma_FichaIngresoServicio_DET d
                        WHERE d.id_fichaingresoservicio = f.id_fichaingresoservicio AND d.activo = 1
                    ), 0) AS precio_analisis_uf
                FROM App_Ma_Agenda_MUESTREOS a
                JOIN App_Ma_FichaIngresoServicio_ENC f ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
                LEFT JOIN mae_centro cen ON cen.id_centro = f.id_centro
                WHERE a.id_agendamam IN (${idsInClause})
            `);
            const casos = detalle.recordset;

            const valorUf = input.valorUf || await this.resolverValorUf(transaction, new Date());

            // 3) Agrupar: siempre por empresaservicio; sub-agrupar según agrupacionTipo
            const grupos = new Map();
            for (const c of casos) {
                const subKey = agrupacionTipo === 'CENTRO' ? `C${c.id_centro}`
                    : agrupacionTipo === 'TIPO_AGUA' ? `T${c.id_tipoagua}`
                    : 'ALL';
                const key = `${c.id_empresaservicio}|${subKey}`;
                if (!grupos.has(key)) grupos.set(key, []);
                grupos.get(key).push(c);
            }

            const costosOperativos = input.costosOperativos || {};
            const creadas = [];

            for (const [, grupoCasos] of grupos) {
                const first = grupoCasos[0];

                const seqResult = await new sql.Request(transaction)
                    .query('SELECT NEXT VALUE FOR dbo.fac_prefactura_seq AS numero_id');
                const numeroId = seqResult.recordset[0].numero_id;

                let subtotalUf = 0;
                const casosConPrecio = grupoCasos.map((c) => {
                    const costoOpUf = Number(costosOperativos[c.id_agendamam] || 0);
                    const precioVentaUf = Number(c.precio_analisis_uf) + costoOpUf;
                    subtotalUf += precioVentaUf;
                    return { ...c, costoOpUf, precioVentaUf };
                });

                const totalUf = subtotalUf; // sin descuentos/ingresos en esta fase
                const netoClp = Math.round(totalUf * valorUf);
                const ivaClp = Math.round(netoClp * 0.19);
                const totalClp = netoClp + ivaClp;

                const agrupacionValor = agrupacionTipo === 'CENTRO' ? (first.nombre_centro || `Centro ${first.id_centro}`)
                    : agrupacionTipo === 'TIPO_AGUA' ? `Tipo agua ${first.id_tipoagua}`
                    : null;

                const pfReq = new sql.Request(transaction);
                pfReq.input('numeroId', sql.Numeric(10, 0), numeroId);
                pfReq.input('idEmpresaServicio', sql.Numeric(10, 0), first.id_empresaservicio);
                pfReq.input('idEmpresa', sql.Numeric(10, 0), first.id_empresa);
                pfReq.input('agrupacionTipo', sql.VarChar(20), agrupacionTipo);
                pfReq.input('agrupacionValor', sql.VarChar(150), agrupacionValor);
                pfReq.input('formaPago', sql.VarChar(100), input.formaPago || null);
                pfReq.input('mesAno', sql.VarChar(10), input.mesAno || null);
                pfReq.input('glosa', sql.NVarChar(500), input.glosa || null);
                pfReq.input('glosaFe', sql.NVarChar(500), input.glosaFe || null);
                pfReq.input('observaciones', sql.NVarChar(1000), input.observaciones || null);
                pfReq.input('facturadoPor', sql.VarChar(100), input.facturadoPor || null);
                pfReq.input('valorUf', sql.Decimal(18, 4), valorUf);
                pfReq.input('subtotalUf', sql.Decimal(18, 4), subtotalUf);
                pfReq.input('totalUf', sql.Decimal(18, 4), totalUf);
                pfReq.input('netoClp', sql.Decimal(18, 2), netoClp);
                pfReq.input('ivaClp', sql.Decimal(18, 2), ivaClp);
                pfReq.input('totalClp', sql.Decimal(18, 2), totalClp);
                pfReq.input('idUsuario', sql.Int, idUsuario || null);

                const pfResult = await pfReq.query(`
                    INSERT INTO fac_prefactura (
                        numero_id, id_empresaservicio, id_empresa, agrupacion_tipo, agrupacion_valor,
                        fecha_facturacion, forma_pago, mes_ano, glosa, glosa_fe, observaciones, facturado_por,
                        valor_uf, subtotal_uf, total_uf, neto_clp, iva_clp, total_clp,
                        estado, id_usuario
                    )
                    OUTPUT inserted.id_prefactura
                    VALUES (
                        @numeroId, @idEmpresaServicio, @idEmpresa, @agrupacionTipo, @agrupacionValor,
                        NULL, @formaPago, @mesAno, @glosa, @glosaFe, @observaciones, @facturadoPor,
                        @valorUf, @subtotalUf, @totalUf, @netoClp, @ivaClp, @totalClp,
                        'BORRADOR', @idUsuario
                    )
                `);
                const idPrefactura = pfResult.recordset[0].id_prefactura;

                for (const c of casosConPrecio) {
                    const caseReq = new sql.Request(transaction);
                    caseReq.input('idPrefactura', sql.Int, idPrefactura);
                    caseReq.input('idAgendamam', sql.Numeric(10, 0), c.id_agendamam);
                    caseReq.input('idFicha', sql.Numeric(10, 0), c.id_fichaingresoservicio);
                    caseReq.input('precioAnalisisUf', sql.Decimal(18, 4), c.precio_analisis_uf);
                    caseReq.input('costoOperativoUf', sql.Decimal(18, 4), c.costoOpUf);
                    caseReq.input('precioVentaUf', sql.Decimal(18, 4), c.precioVentaUf);
                    caseReq.input('precioVentaClp', sql.Decimal(18, 2), Math.round(c.precioVentaUf * valorUf));
                    caseReq.input('correlativoCaso', sql.VarChar(50), c.caso_adlab);
                    caseReq.input('nombreCentro', sql.VarChar(200), c.nombre_centro || null);
                    caseReq.input('idTipoAgua', sql.Numeric(10, 0), c.id_tipoagua);
                    caseReq.input('fechaInforme', sql.Date, c.fecha_informe);

                    await caseReq.query(`
                        INSERT INTO fac_prefactura_caso (
                            id_prefactura, id_agendamam, id_fichaingresoservicio,
                            precio_analisis_uf, costo_operativo_uf, precio_venta_uf, precio_venta_clp,
                            correlativo_caso, nombre_centro, id_tipoagua, fecha_informe
                        ) VALUES (
                            @idPrefactura, @idAgendamam, @idFicha,
                            @precioAnalisisUf, @costoOperativoUf, @precioVentaUf, @precioVentaClp,
                            @correlativoCaso, @nombreCentro, @idTipoAgua, @fechaInforme
                        )
                    `);
                }

                const histReq = new sql.Request(transaction);
                histReq.input('idEntidad', sql.Int, idPrefactura);
                histReq.input('idUsuario', sql.Int, idUsuario || null);
                histReq.input('descripcion', sql.NVarChar(500), `Pre-factura #${numeroId} creada con ${casosConPrecio.length} caso(s).`);
                await histReq.query(`
                    INSERT INTO fac_historial (entidad, id_entidad, accion, estado_anterior, estado_nuevo, descripcion, id_usuario)
                    VALUES ('PREFACTURA', @idEntidad, 'CREADA', NULL, 'BORRADOR', @descripcion, @idUsuario)
                `);

                creadas.push({
                    numero_id: numeroId,
                    id_prefactura: idPrefactura,
                    id_empresaservicio: first.id_empresaservicio,
                    agrupacion_valor: agrupacionValor,
                    total_uf: totalUf,
                    total_clp: totalClp,
                    casos: casosConPrecio.length,
                });
            }

            await transaction.commit();
            return creadas;
        } catch (error) {
            await transaction.rollback();
            logger.error('Error creando pre-facturas:', error);
            throw error;
        }
    }

    /** Listado de pre-facturas con filtros opcionales (estado, empresaservicio). */
    async listarPrefacturas(filtros = {}) {
        const pool = await getConnection();
        const request = pool.request();
        const condiciones = [];

        if (filtros.estado) {
            request.input('estado', sql.VarChar(30), filtros.estado);
            condiciones.push('p.estado = @estado');
        }
        if (filtros.idEmpresaServicio) {
            request.input('idEmpresaServicio', sql.Numeric(10, 0), filtros.idEmpresaServicio);
            condiciones.push('p.id_empresaservicio = @idEmpresaServicio');
        }
        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const result = await request.query(`
            SELECT p.id_prefactura, p.numero_id, p.id_empresaservicio, es.nombre_empresaservicios,
                   p.agrupacion_tipo, p.agrupacion_valor, p.estado, p.valor_uf,
                   p.total_uf, p.total_clp, p.email_enviado, p.fecha_email,
                   p.fecha_creacion,
                   (SELECT COUNT(*) FROM fac_prefactura_caso c WHERE c.id_prefactura = p.id_prefactura) AS cantidad_casos,
                   (SELECT COUNT(*) FROM fac_orden_compra o WHERE o.id_prefactura = p.id_prefactura) AS cantidad_oc
            FROM fac_prefactura p
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = p.id_empresaservicio
            ${where}
            ORDER BY p.fecha_creacion DESC
        `);
        return result.recordset;
    }

    /** Detalle completo de una pre-factura: cabecera + casos + OC/HES + historial. */
    async getPrefacturaDetalle(idPrefactura) {
        const pool = await getConnection();
        const req1 = pool.request();
        req1.input('id', sql.Int, idPrefactura);

        const cabecera = await req1.query(`
            SELECT p.*, es.nombre_empresaservicios, emp.nombre_empresa
            FROM fac_prefactura p
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = p.id_empresaservicio
            LEFT JOIN mae_empresa emp ON emp.id_empresa = p.id_empresa
            WHERE p.id_prefactura = @id
        `);
        if (cabecera.recordset.length === 0) return null;

        const req2 = pool.request();
        req2.input('id', sql.Int, idPrefactura);
        const casos = await req2.query(`
            SELECT * FROM fac_prefactura_caso WHERE id_prefactura = @id ORDER BY id_pf_caso
        `);

        const req3 = pool.request();
        req3.input('id', sql.Int, idPrefactura);
        const ordenesCompra = await req3.query(`
            SELECT * FROM fac_orden_compra WHERE id_prefactura = @id ORDER BY fecha_registro DESC
        `);

        const req4 = pool.request();
        req4.input('id', sql.Int, idPrefactura);
        const historial = await req4.query(`
            SELECT * FROM fac_historial WHERE entidad = 'PREFACTURA' AND id_entidad = @id ORDER BY fecha DESC
        `);

        return {
            ...cabecera.recordset[0],
            casos: casos.recordset,
            ordenes_compra: ordenesCompra.recordset,
            historial: historial.recordset,
        };
    }

    // ------------------------------------------------------------------
    // PDF — resumen (por caso) y detalle (por técnica, releído del DET vivo)
    // Diseño replicado del formato legado de ADLSoft (logo, tipografía y
    // agrupación por Centro con subtotales), verificado contra una factura
    // real emitida (folio 30632, ID72325).
    // ------------------------------------------------------------------

    static NAVY = '#173A5E';
    static ORANGE = '#F4801F';
    static LOGO_PATH = path.join(__dirname, '../assets/logo_adl_diagnostic.png');

    _drawHeader(doc, pf, tipoDocumento = 'RESUMEN', etiqueta = 'PRE-FACTURA', prefijoRef = 'PF') {
        const NAVY = FacturacionService.NAVY;
        const ORANGE = FacturacionService.ORANGE;
        try {
            doc.image(FacturacionService.LOGO_PATH, 40, 30, { width: 150 });
        } catch (_) { /* el logo es decorativo; si el archivo no está no se bloquea el PDF */ }

        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(15)
            .text(`${etiqueta} N°: ${pf.numero_id}`, 280, 40, { width: 275, align: 'right' });
        doc.fillColor('#000').font('Helvetica').fontSize(9)
            .text(`Fecha: ${pf.fecha_facturacion ? this._fechaDDMMYYYY(pf.fecha_facturacion) : this._hoyDDMMYYYY()}`, 280, 60, { width: 275, align: 'right' })
            .text(`Valor U.F.: ${fmtUfValor(pf.valor_uf)}`, 280, 73, { width: 275, align: 'right' });
        doc.fontSize(8).fillColor('#777')
            .text('ADL ONE - Sistema de Facturación', 280, 93, { width: 275, align: 'right' })
            .text(`${tipoDocumento} - ${prefijoRef}${pf.numero_id}`, 280, 104, { width: 275, align: 'right' });
        doc.fillColor('#000');

        // Doble filete de marca: navy grueso + naranjo fino debajo (mismos
        // colores del logo ADL Diagnostic Chile).
        doc.lineWidth(1.4).strokeColor(NAVY).moveTo(40, 122).lineTo(555, 122).stroke();
        doc.lineWidth(2).strokeColor(ORANGE).moveTo(40, 125.5).lineTo(555, 125.5).stroke();
        doc.lineWidth(1);

        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
            .text('Empresa:', 40, 132, { continued: true })
            .font('Helvetica').text(` ${pf.nombre_empresaservicios || '—'}`);
        doc.font('Helvetica-Bold').fontSize(9).text('Programa:', 400, 132, { continued: true })
            .font('Helvetica').text(' Medio Ambiente');

        let y = 148;
        if (pf.facturado_por) {
            doc.font('Helvetica-Bold').fontSize(9).text('Facturado por:', 40, y, { continued: true })
                .font('Helvetica').text(` ${pf.facturado_por}`);
            y += 15;
        }
        if (pf.glosa) {
            doc.fontSize(8.5).font('Helvetica').fillColor('#555').text(pf.glosa, 40, y, { width: 515 }).fillColor('#000');
            y += 15;
        }
        return y + 8;
    }

    _drawColHeaders(doc, y, cols) {
        const NAVY = FacturacionService.NAVY;
        doc.rect(40, y, 515, 16).fill('#EEF3F7');
        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(8.5);
        for (const c of cols) doc.text(c.label, c.x, y + 4, { width: c.width, align: c.align || 'left' });
        doc.fillColor('#000');
        return y + 20;
    }

    _drawTotales(doc, pf, y) {
        const NAVY = FacturacionService.NAVY;
        const ORANGE = FacturacionService.ORANGE;
        doc.lineWidth(1.2).strokeColor(NAVY).moveTo(320, y).lineTo(555, y).stroke();
        doc.lineWidth(1);
        let yy = y + 8;
        const row = (label, value, bold = false, color = null) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(color || (bold ? NAVY : '#000'))
                .text(label, 320, yy, { width: 150 })
                .text(value, 470, yy, { width: 85, align: 'right' });
            yy += 16;
        };
        row('Subtotal U.F.:', fmtUf(pf.subtotal_uf));
        if (Number(pf.descuento_uf) > 0) row('Descuento U.F.:', `- ${fmtUf(pf.descuento_uf)}`);
        if (Number(pf.ingreso_uf) > 0) row('Ingreso U.F.:', fmtUf(pf.ingreso_uf));
        row('TOTAL GENERAL U.F.:', fmtUf(pf.total_uf), true);
        yy += 6;
        row('TOTAL NETO $:', `$ ${fmtClp(pf.neto_clp)}`);
        row('IVA (19%) $:', `$ ${fmtClp(pf.iva_clp)}`);
        row('TOTAL $:', `$ ${fmtClp(pf.total_clp)}`, true, ORANGE);
        doc.fillColor('#000');
        return yy;
    }

    /**
     * Pie de página en todas las páginas ya generadas (requiere bufferPages:true).
     * La línea y el texto se dibujan bien dentro del margen inferior — PDFKit
     * dispara un salto de página automático si el texto cae fuera del área
     * imprimible aunque se le pase x/y explícitos, así que hay que dejar
     * margen de sobra (visto en pruebas: pegado al borde generaba 2 páginas
     * en blanco extra, una por cada .text() que se salía).
     */
    _drawFooters(doc) {
        const range = doc.bufferedPageRange();
        const generado = `${this._hoyDDMMYYYY()} - ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
        for (let i = range.start; i < range.start + range.count; i++) {
            doc.switchToPage(i);
            const printableBottom = doc.page.height - doc.page.margins.bottom;
            const lineY = printableBottom - 22;
            const textY = printableBottom - 16;
            doc.lineWidth(0.5).strokeColor('#ccc').moveTo(40, lineY).lineTo(555, lineY).stroke();
            doc.fontSize(7.5).fillColor('#888').font('Helvetica')
                .text(`Generado: ${generado}`, 40, textY, { width: 300, lineBreak: false })
                .text(`Página: ${i - range.start + 1} de ${range.count}`, 355, textY, { width: 200, align: 'right', lineBreak: false });
            doc.fillColor('#000');
        }
    }

    /**
     * Cuerpo del resumen (una línea por caso, agrupado por Centro con
     * subtotal) para un "pf-like" (numero_id, nombre_empresaservicios,
     * valor_uf, casos[], subtotal/total/neto/iva/total). No abre página
     * nueva por sí solo — el llamador decide cuándo paginar.
     */
    _renderResumenBody(doc, pf, tipoDocumento) {
        let y = this._drawHeader(doc, pf, tipoDocumento);
        y += 4;

        const porCentro = new Map();
        for (const c of pf.casos) {
            const key = (c.nombre_centro || '').trim() || 'Sin centro';
            if (!porCentro.has(key)) porCentro.set(key, []);
            porCentro.get(key).push(c);
        }

        for (const [centro, casos] of porCentro) {
            if (y > 690) { doc.addPage(); y = 40; }
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor(FacturacionService.NAVY).text(`Centro: ${centro}`, 40, y);
            doc.fillColor('#000');
            y += 16;
            y = this._drawColHeaders(doc, y, [
                { label: 'N° Caso', x: 46, width: 200 },
                { label: 'Fecha Informe', x: 260, width: 130 },
                { label: 'U.F. Unitario', x: 395, width: 90, align: 'right' },
                { label: 'U.F. Total', x: 490, width: 65, align: 'right' },
            ]);

            doc.font('Helvetica').fontSize(9);
            let subtotalCentro = 0;
            for (const c of casos) {
                doc.text(c.correlativo_caso || '-', 46, y, { width: 200 })
                    .text(c.fecha_informe ? this._fechaDDMMYYYY(c.fecha_informe) : '-', 260, y, { width: 130 })
                    .text(fmtUf(c.precio_venta_uf), 395, y, { width: 90, align: 'right' })
                    .text(fmtUf(c.precio_venta_uf), 490, y, { width: 65, align: 'right' });
                subtotalCentro += Number(c.precio_venta_uf || 0);
                y += 15;
                if (y > 730) { doc.addPage(); y = 40; }
            }
            doc.lineWidth(0.5).strokeColor('#ccc').moveTo(320, y).lineTo(555, y).stroke();
            y += 4;
            doc.font('Helvetica-Bold').fontSize(9)
                .text('TOTAL CENTRO U.F.:', 320, y, { width: 165 })
                .text(fmtUf(subtotalCentro), 490, y, { width: 65, align: 'right' });
            y += 24;
        }

        y += 6;
        if (y > 660) { doc.addPage(); y = 40; }
        this._drawTotales(doc, pf, y);
    }

    /**
     * Cuerpo del detalle (por Centro → por caso, cada análisis/técnica
     * releído en vivo del DET, con N° Análisis / U.F. Unitario / U.F. Total
     * — mismas columnas que el formato legado verificado contra una factura
     * real). Igual que _renderResumenBody, no abre página nueva por sí solo.
     */
    async _renderDetalleBody(doc, pf, tipoDocumento, pool) {
        let y = this._drawHeader(doc, pf, tipoDocumento);
        y += 4;

        const porCentro = new Map();
        for (const c of pf.casos) {
            const key = (c.nombre_centro || '').trim() || 'Sin centro';
            if (!porCentro.has(key)) porCentro.set(key, []);
            porCentro.get(key).push(c);
        }

        for (const [centro, casos] of porCentro) {
            if (y > 680) { doc.addPage(); y = 40; }
            doc.font('Helvetica-Bold').fontSize(9.5).fillColor(FacturacionService.NAVY).text(`Centro: ${centro}`, 40, y);
            doc.fillColor('#000');
            y += 16;
            y = this._drawColHeaders(doc, y, [
                { label: 'N° Caso', x: 46, width: 140 },
                { label: 'Técnica', x: 195, width: 170 },
                { label: 'Cant.', x: 375, width: 40, align: 'right' },
                { label: 'U.F. Unitario', x: 425, width: 60, align: 'right' },
                { label: 'U.F. Total', x: 490, width: 65, align: 'right' },
            ]);

            let subtotalCentro = 0;
            for (const c of casos) {
                if (y > 700) { doc.addPage(); y = 40; }
                doc.font('Helvetica-Bold').fontSize(8.5).text(c.correlativo_caso || '-', 46, y, { width: 140 });

                const detReq = pool.request();
                detReq.input('idFicha', sql.Numeric(10, 0), c.id_fichaingresoservicio);
                const detRes = await detReq.query(`
                    SELECT d.tipo_analisis, t.nombre_tecnica, d.uf_individual
                    FROM App_Ma_FichaIngresoServicio_DET d
                    LEFT JOIN mae_tecnica t ON t.id_tecnica = d.id_tecnica
                    WHERE d.id_fichaingresoservicio = @idFicha AND d.activo = 1
                    ORDER BY d.item
                `);

                doc.font('Helvetica').fontSize(8.5);
                for (const a of detRes.recordset) {
                    if (y > 730) { doc.addPage(); y = 40; }
                    const nombre = a.tipo_analisis === 'CostoOperativo' ? 'Costo operativo' : (a.nombre_tecnica || '-');
                    doc.text(nombre, 195, y, { width: 170 })
                        .text('1', 375, y, { width: 40, align: 'right' })
                        .text(fmtUf(a.uf_individual), 425, y, { width: 60, align: 'right' })
                        .text(fmtUf(a.uf_individual), 490, y, { width: 65, align: 'right' });
                    y += 12;
                }
                doc.lineWidth(0.5).strokeColor('#ddd').moveTo(375, y).lineTo(555, y).stroke();
                y += 3;
                doc.font('Helvetica-Bold').fontSize(8.5)
                    .text('Subtotal caso:', 195, y, { width: 170 })
                    .text(fmtUf(c.precio_venta_uf), 490, y, { width: 65, align: 'right' });
                subtotalCentro += Number(c.precio_venta_uf || 0);
                y += 20;
            }

            doc.lineWidth(0.5).strokeColor('#ccc').moveTo(320, y).lineTo(555, y).stroke();
            y += 4;
            doc.font('Helvetica-Bold').fontSize(9)
                .text('TOTAL CENTRO U.F.:', 320, y, { width: 165 })
                .text(fmtUf(subtotalCentro), 490, y, { width: 65, align: 'right' });
            y += 24;
        }

        y += 6;
        if (y > 660) { doc.addPage(); y = 40; }
        this._drawTotales(doc, pf, y);
    }

    /** Resumen: una línea por caso (N° Caso, Fecha Informe, UF Unitario, UF Total), agrupado por Centro. */
    async generarPdfResumen(idPrefactura) {
        const pf = await this.getPrefacturaDetalle(idPrefactura);
        if (!pf) throw new Error('Pre-factura no encontrada.');

        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
        const buffers = [];
        return new Promise((resolve, reject) => {
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
            try {
                this._renderResumenBody(doc, pf, 'RESUMEN');
                this._drawFooters(doc);
                doc.end();
            } catch (e) { reject(e); }
        });
    }

    /** Detalle: por Centro → por caso, cada análisis (técnica) releído en vivo del DET. */
    async generarPdfDetalle(idPrefactura) {
        const pf = await this.getPrefacturaDetalle(idPrefactura);
        if (!pf) throw new Error('Pre-factura no encontrada.');

        const pool = await getConnection();
        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
        const buffers = [];
        return new Promise(async (resolve, reject) => {
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
            try {
                await this._renderDetalleBody(doc, pf, 'DETALLE', pool);
                this._drawFooters(doc);
                doc.end();
            } catch (e) { reject(e); }
        });
    }

    /**
     * Vista previa (sin persistir nada): arma los mismos grupos que
     * crearPrefacturas para la selección dada, y renderiza — por cada grupo
     * prospectivo — un resumen seguido de su detalle, en un solo PDF, sin
     * reclamar los casos ni escribir en fac_prefactura. Pensado para
     * revisar antes de confirmar en Procesar.
     */
    async generarPdfPreview(idAgendamamList, agrupacionTipo = 'SIN_AGRUPACION') {
        const ids = [...new Set((idAgendamamList || []).map(Number))];
        if (ids.length === 0) throw new Error('Debe seleccionar al menos un caso.');
        if (!['SIN_AGRUPACION', 'CENTRO', 'TIPO_AGUA'].includes(agrupacionTipo)) {
            throw new Error('agrupacionTipo inválido.');
        }

        const pool = await getConnection();
        const idsInClause = ids.join(',');
        const detalle = await pool.request().query(`
            SELECT
                a.id_agendamam, ISNULL(NULLIF(a.caso_adlab, ''), a.frecuencia_correlativo) AS caso_adlab,
                f.id_fichaingresoservicio, f.id_empresaservicio, es.nombre_empresaservicios,
                f.id_centro, cen.nombre_centro, f.id_tipoagua, a.fecha_informe_emitido AS fecha_informe,
                ISNULL((
                    SELECT SUM(d.uf_individual)
                    FROM App_Ma_FichaIngresoServicio_DET d
                    WHERE d.id_fichaingresoservicio = f.id_fichaingresoservicio AND d.activo = 1
                ), 0) AS precio_venta_uf
            FROM App_Ma_Agenda_MUESTREOS a
            JOIN App_Ma_FichaIngresoServicio_ENC f ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = f.id_empresaservicio
            LEFT JOIN mae_centro cen ON cen.id_centro = f.id_centro
            WHERE a.id_agendamam IN (${idsInClause})
        `);

        const valorUf = await this.resolverValorUf(pool, new Date());
        const grupos = new Map();
        for (const c of detalle.recordset) {
            const subKey = agrupacionTipo === 'CENTRO' ? `C${c.id_centro}`
                : agrupacionTipo === 'TIPO_AGUA' ? `T${c.id_tipoagua}`
                : 'ALL';
            const key = `${c.id_empresaservicio}|${subKey}`;
            if (!grupos.has(key)) grupos.set(key, []);
            grupos.get(key).push({ ...c, correlativo_caso: c.caso_adlab });
        }

        const pfs = [];
        for (const [, casos] of grupos) {
            const first = casos[0];
            const subtotalUf = casos.reduce((s, c) => s + Number(c.precio_venta_uf || 0), 0);
            const netoClp = Math.round(subtotalUf * valorUf);
            const ivaClp = Math.round(netoClp * 0.19);
            pfs.push({
                numero_id: 'VISTA PREVIA',
                nombre_empresaservicios: first.nombre_empresaservicios,
                fecha_facturacion: null,
                facturado_por: null,
                glosa: null,
                valor_uf: valorUf,
                subtotal_uf: subtotalUf,
                descuento_uf: 0,
                ingreso_uf: 0,
                total_uf: subtotalUf,
                neto_clp: netoClp,
                iva_clp: ivaClp,
                total_clp: netoClp + ivaClp,
                casos,
            });
        }
        if (pfs.length === 0) throw new Error('No se encontraron datos para los casos seleccionados.');

        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
        const buffers = [];
        return new Promise((resolve, reject) => {
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
            (async () => {
                try {
                    for (let i = 0; i < pfs.length; i++) {
                        if (i > 0) doc.addPage();
                        this._renderResumenBody(doc, pfs[i], 'VISTA PREVIA · RESUMEN');
                        doc.addPage();
                        await this._renderDetalleBody(doc, pfs[i], 'VISTA PREVIA · DETALLE', pool);
                    }
                    this._drawFooters(doc);
                    doc.end();
                } catch (e) { reject(e); }
            })();
        });
    }

    /**
     * Genera ambos PDF, los guarda en /uploads/facturacion/{numero_id}/ y
     * actualiza la pre-factura (paths + estado BORRADOR -> PDF_GENERADO).
     */
    async generarPdfs(idPrefactura, idUsuario) {
        const pf = await this.getPrefacturaDetalle(idPrefactura);
        if (!pf) throw new Error('Pre-factura no encontrada.');

        const [resumenBuf, detalleBuf] = await Promise.all([
            this.generarPdfResumen(idPrefactura),
            this.generarPdfDetalle(idPrefactura),
        ]);

        const dir = path.join(UPLOAD_PATH, 'facturacion', String(pf.numero_id));
        fs.mkdirSync(dir, { recursive: true });
        const resumenPath = path.join(dir, 'resumen.pdf');
        const detallePath = path.join(dir, 'detalle.pdf');
        fs.writeFileSync(resumenPath, resumenBuf);
        fs.writeFileSync(detallePath, detalleBuf);

        const relResumen = `/uploads/facturacion/${pf.numero_id}/resumen.pdf`;
        const relDetalle = `/uploads/facturacion/${pf.numero_id}/detalle.pdf`;

        const pool = await getConnection();
        const req = pool.request();
        req.input('id', sql.Int, idPrefactura);
        req.input('resumen', sql.VarChar(500), relResumen);
        req.input('detalle', sql.VarChar(500), relDetalle);
        await req.query(`
            UPDATE fac_prefactura
            SET pdf_resumen_path = @resumen, pdf_detalle_path = @detalle,
                estado = CASE WHEN estado = 'BORRADOR' THEN 'PDF_GENERADO' ELSE estado END,
                fecha_modificacion = GETDATE()
            WHERE id_prefactura = @id
        `);

        const histReq = pool.request();
        histReq.input('idEntidad', sql.Int, idPrefactura);
        histReq.input('idUsuario', sql.Int, idUsuario || null);
        await histReq.query(`
            INSERT INTO fac_historial (entidad, id_entidad, accion, estado_nuevo, descripcion, id_usuario)
            VALUES ('PREFACTURA', @idEntidad, 'PDF_GENERADO', 'PDF_GENERADO', 'PDF resumen y detalle generados.', @idUsuario)
        `);

        return { pdf_resumen_path: relResumen, pdf_detalle_path: relDetalle };
    }

    /**
     * Envía la pre-factura por email al cliente (usa fac_cliente_config para
     * el destino y para saber si corresponde esperar OC). Genera los PDF si
     * aún no existen.
     */
    async enviarPorEmail(idPrefactura, idUsuario) {
        let pf = await this.getPrefacturaDetalle(idPrefactura);
        if (!pf) throw new Error('Pre-factura no encontrada.');

        if (!pf.pdf_detalle_path || !pf.pdf_resumen_path) {
            await this.generarPdfs(idPrefactura, idUsuario);
            pf = await this.getPrefacturaDetalle(idPrefactura);
        }

        const pool = await getConnection();
        const cfgReq = pool.request();
        cfgReq.input('idEmpresaServicio', sql.Numeric(10, 0), pf.id_empresaservicio);
        const cfgRes = await cfgReq.query(`
            SELECT
                COALESCE(NULLIF(cfg.email_facturacion, ''), NULLIF(es.email_facturacion, '')) AS email_facturacion,
                ISNULL(cfg.requiere_oc, 'S') AS requiere_oc
            FROM mae_empresaservicios es
            LEFT JOIN fac_cliente_config cfg ON cfg.id_empresaservicio = es.id_empresaservicio
            WHERE es.id_empresaservicio = @idEmpresaServicio
        `);
        const cfg = cfgRes.recordset[0] || { email_facturacion: null, requiere_oc: 'S' };

        const destino = cfg.email_facturacion;
        if (!destino) {
            throw new Error('El cliente no tiene un email de facturación configurado (ni en fac_cliente_config ni en mae_empresaservicios). Complétalo en Facturación → Configuración → Clientes.');
        }

        const transporter = getTransporter();
        const envio = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Facturación ADL" <no-reply@adldiagnostic.cl>',
            to: destino,
            subject: `Pre-Factura N° ${pf.numero_id} - ${pf.nombre_empresaservicios || ''}`,
            html: `
                <p>Estimado(a),</p>
                <p>Adjuntamos la pre-factura N° <b>${pf.numero_id}</b> por un total de
                   <b>${fmtUf(pf.total_uf)} U.F.</b> ($ ${fmtClp(pf.total_clp)}).</p>
                <p>${cfg.requiere_oc === 'N'
                    ? 'Este documento se procesará directamente para su facturación.'
                    : pf.portal_publicado
                        // Si la pre-factura ya está publicada en el portal, ahí puede
                        // cargar la OC y queda vinculada sola. Si no lo está, ofrecer
                        // esa vía sería mandarlo a buscar un documento que no verá.
                        ? 'Para proceder con la facturación, agradecemos remitir su Orden de Compra (y HES si corresponde). Puede cargarla directamente en el portal ADL WEB GO, en la sección Archivos junto a esta pre-factura, o responder a este correo.'
                        : 'Para proceder con la facturación, agradecemos remitir su Orden de Compra (y HES si corresponde) en respuesta a este correo.'}</p>
                <p>Saludos,<br/>Facturación ADL Diagnostic</p>
            `,
            attachments: [
                { filename: `PF_${pf.numero_id}_resumen.pdf`, path: path.join(UPLOAD_PATH, 'facturacion', String(pf.numero_id), 'resumen.pdf') },
                { filename: `PF_${pf.numero_id}_detalle.pdf`, path: path.join(UPLOAD_PATH, 'facturacion', String(pf.numero_id), 'detalle.pdf') },
            ],
        });

        const nuevoEstado = cfg.requiere_oc === 'N' ? 'ENVIADA' : 'PENDIENTE_OC';
        const req = pool.request();
        req.input('id', sql.Int, idPrefactura);
        req.input('estado', sql.VarChar(30), nuevoEstado);
        // Se guarda el Message-ID del envío para, más adelante (Fase 7), poder
        // emparejar la respuesta del cliente por hilo (In-Reply-To) sin
        // escanear el buzón completo.
        req.input('messageId', sql.VarChar(300), envio.messageId || null);
        await req.query(`
            UPDATE fac_prefactura
            SET email_enviado = 1, fecha_email = GETDATE(), estado = @estado,
                email_message_id = @messageId, fecha_modificacion = GETDATE()
            WHERE id_prefactura = @id
        `);

        const histReq = pool.request();
        histReq.input('idEntidad', sql.Int, idPrefactura);
        histReq.input('idUsuario', sql.Int, idUsuario || null);
        histReq.input('estadoNuevo', sql.VarChar(30), nuevoEstado);
        histReq.input('descripcion', sql.NVarChar(500), `Enviada por email a ${destino}.`);
        await histReq.query(`
            INSERT INTO fac_historial (entidad, id_entidad, accion, estado_nuevo, descripcion, id_usuario)
            VALUES ('PREFACTURA', @idEntidad, 'ENVIADA_EMAIL', @estadoNuevo, @descripcion, @idUsuario)
        `);

        return { estado: nuevoEstado, destino };
    }

    /**
     * Registra una Orden de Compra (y HES opcional) recibida del cliente.
     * Una pre-factura puede recibir varias OC. Mueve el estado a OC_RECIBIDA,
     * salvo que ya esté más avanzada (en emisión o emitida). NO fija
     * fecha_facturacion aquí — puede pasar tiempo entre recibir la OC y
     * realmente generar/subir el archivo plano (semanas, según el cliente),
     * así que esa fecha se fija recién en generarArchivoPlano(), al momento
     * real de la emisión.
     */
    // ------------------------------------------------------------------
    // EDITAR / ANULAR PRE-FACTURA
    //
    // Antes no había forma de corregir nada: un error de tipeo en la glosa o
    // un caso incluido por equivocación quedaban fijos, y los casos mal
    // facturados se perdían para siempre (id_estado_facturacion los saca de la
    // cola de facturables y nada los devolvía).
    //
    // Se permite editar solo ANTES de la emisión: una vez que salió el archivo
    // plano al Sistema de Ventas, cambiar la pre-factura acá dejaría los dos
    // sistemas diciendo cosas distintas.
    // ------------------------------------------------------------------

    static ESTADOS_EDITABLES = ['BORRADOR', 'PDF_GENERADO', 'ENVIADA', 'PENDIENTE_OC', 'OC_RECIBIDA'];

    _validarEditable(pf) {
        if (!pf) throw new Error('Pre-factura no encontrada.');
        if (!FacturacionService.ESTADOS_EDITABLES.includes(pf.estado)) {
            throw new Error(`No se puede modificar una pre-factura en estado ${pf.estado}: ya fue emitida o está en emisión.`);
        }
    }

    /** Recalcula los totales desde los casos que quedan y guarda el snapshot. */
    async _recalcularTotales(pool, idPrefactura, transaction = null) {
        const req = transaction ? new sql.Request(transaction) : pool.request();
        req.input('id', sql.Int, idPrefactura);
        await req.query(`
            UPDATE p SET
                p.subtotal_uf = ISNULL(s.suma, 0),
                p.total_uf = ISNULL(s.suma, 0) - p.descuento_uf + p.ingreso_uf,
                p.neto_clp = ROUND((ISNULL(s.suma, 0) - p.descuento_uf + p.ingreso_uf) * p.valor_uf, 0),
                p.iva_clp  = ROUND(ROUND((ISNULL(s.suma, 0) - p.descuento_uf + p.ingreso_uf) * p.valor_uf, 0) * 0.19, 0),
                p.total_clp = ROUND((ISNULL(s.suma, 0) - p.descuento_uf + p.ingreso_uf) * p.valor_uf, 0)
                            + ROUND(ROUND((ISNULL(s.suma, 0) - p.descuento_uf + p.ingreso_uf) * p.valor_uf, 0) * 0.19, 0),
                p.fecha_modificacion = GETDATE(),
                -- Los PDF ya generados dejan de reflejar el contenido: se
                -- invalidan para que nadie mande el viejo por correo.
                p.pdf_resumen_path = NULL, p.pdf_detalle_path = NULL
            FROM fac_prefactura p
            OUTER APPLY (
                SELECT SUM(c.precio_venta_uf) AS suma
                FROM fac_prefactura_caso c WHERE c.id_prefactura = p.id_prefactura
            ) s
            WHERE p.id_prefactura = @id
        `);
    }

    /**
     * Corrige los datos de una pre-factura (glosa, forma de pago, descuentos…).
     * Solo campos de cabecera: los precios de cada caso quedaron congelados a
     * propósito al crearla y no se tocan desde acá.
     */
    async actualizarPrefactura(idPrefactura, datos, idUsuario) {
        const pool = await getConnection();
        const pf = (await pool.request().input('id', sql.Int, idPrefactura)
            .query('SELECT * FROM fac_prefactura WHERE id_prefactura = @id')).recordset[0];
        this._validarEditable(pf);

        const campos = [];
        const req = pool.request();
        req.input('id', sql.Int, idPrefactura);
        const texto = { glosa: 500, glosa_fe: 500, observaciones: 1000, forma_pago: 100, facturado_por: 100, mes_ano: 10 };
        for (const [campo, largo] of Object.entries(texto)) {
            if (datos[campo] !== undefined) {
                req.input(campo, sql.NVarChar(largo), datos[campo] || null);
                campos.push(`${campo} = @${campo}`);
            }
        }
        if (datos.fecha_facturacion !== undefined) {
            req.input('fecha_facturacion', sql.Date, datos.fecha_facturacion || null);
            campos.push('fecha_facturacion = @fecha_facturacion');
        }
        let recalcular = false;
        for (const campo of ['descuento_uf', 'ingreso_uf']) {
            if (datos[campo] !== undefined) {
                req.input(campo, sql.Decimal(18, 4), Number(datos[campo]) || 0);
                campos.push(`${campo} = @${campo}`);
                recalcular = true;
            }
        }
        if (campos.length === 0) throw new Error('No se indicó ningún campo para modificar.');

        await req.query(`UPDATE fac_prefactura SET ${campos.join(', ')}, fecha_modificacion = GETDATE() WHERE id_prefactura = @id`);
        if (recalcular) await this._recalcularTotales(pool, idPrefactura);

        await pool.request()
            .input('idEntidad', sql.Int, idPrefactura)
            .input('idUsuario', sql.Int, idUsuario || null)
            .input('desc', sql.NVarChar(500), `Pre-factura corregida: ${Object.keys(datos).join(', ')}.`)
            .query(`INSERT INTO fac_historial (entidad, id_entidad, accion, descripcion, id_usuario)
                    VALUES ('PREFACTURA', @idEntidad, 'EDITADA', @desc, @idUsuario)`);

        return this.getPrefacturaDetalle(idPrefactura);
    }

    /**
     * Saca un caso de la pre-factura y lo DEVUELVE a la cola de facturables.
     * Liberar id_estado_facturacion es lo que evita que un caso mal incluido
     * quede infacturable para siempre.
     */
    async quitarCasoDePrefactura(idPrefactura, idPfCaso, idUsuario) {
        const pool = await getConnection();
        const pf = (await pool.request().input('id', sql.Int, idPrefactura)
            .query('SELECT * FROM fac_prefactura WHERE id_prefactura = @id')).recordset[0];
        this._validarEditable(pf);

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const caso = (await new sql.Request(transaction)
                .input('idc', sql.Int, idPfCaso).input('idp', sql.Int, idPrefactura)
                .query('SELECT * FROM fac_prefactura_caso WHERE id_pf_caso = @idc AND id_prefactura = @idp')).recordset[0];
            if (!caso) throw new Error('Ese caso no pertenece a esta pre-factura.');

            const restantes = (await new sql.Request(transaction).input('idp', sql.Int, idPrefactura)
                .query('SELECT COUNT(*) AS n FROM fac_prefactura_caso WHERE id_prefactura = @idp')).recordset[0].n;
            if (restantes <= 1) {
                throw new Error('Es el único caso de la pre-factura: anúlala en vez de dejarla vacía.');
            }

            await new sql.Request(transaction).input('idc', sql.Int, idPfCaso)
                .query('DELETE FROM fac_prefactura_caso WHERE id_pf_caso = @idc');
            await new sql.Request(transaction).input('ida', sql.Numeric(10, 0), caso.id_agendamam)
                .query(`UPDATE App_Ma_Agenda_MUESTREOS SET id_estado_facturacion = NULL WHERE id_agendamam = @ida`);

            await new sql.Request(transaction)
                .input('idEntidad', sql.Int, idPrefactura)
                .input('idUsuario', sql.Int, idUsuario || null)
                .input('desc', sql.NVarChar(500), `Caso ${caso.correlativo_caso || caso.id_agendamam} quitado y devuelto a la cola de facturables.`)
                .query(`INSERT INTO fac_historial (entidad, id_entidad, accion, descripcion, id_usuario)
                        VALUES ('PREFACTURA', @idEntidad, 'CASO_QUITADO', @desc, @idUsuario)`);

            await transaction.commit();
        } catch (e) {
            await transaction.rollback();
            throw e;
        }

        await this._recalcularTotales(pool, idPrefactura);
        return this.getPrefacturaDetalle(idPrefactura);
    }

    /** Anula la pre-factura y libera TODOS sus casos para volver a facturarlos. */
    async anularPrefactura(idPrefactura, motivo, idUsuario) {
        const pool = await getConnection();
        const pf = (await pool.request().input('id', sql.Int, idPrefactura)
            .query('SELECT * FROM fac_prefactura WHERE id_prefactura = @id')).recordset[0];
        this._validarEditable(pf);
        if (!motivo?.trim()) throw new Error('Indica el motivo de la anulación.');

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const liberados = await new sql.Request(transaction).input('idp', sql.Int, idPrefactura)
                .query(`UPDATE a SET a.id_estado_facturacion = NULL
                        OUTPUT inserted.id_agendamam
                        FROM App_Ma_Agenda_MUESTREOS a
                        JOIN fac_prefactura_caso c ON c.id_agendamam = a.id_agendamam
                        WHERE c.id_prefactura = @idp`);

            await new sql.Request(transaction).input('idp', sql.Int, idPrefactura)
                .query(`UPDATE fac_prefactura SET estado = 'ANULADA', fecha_modificacion = GETDATE() WHERE id_prefactura = @idp`);

            await new sql.Request(transaction)
                .input('idEntidad', sql.Int, idPrefactura)
                .input('idUsuario', sql.Int, idUsuario || null)
                .input('desc', sql.NVarChar(500), `Anulada: ${motivo.trim()}. ${liberados.recordset.length} caso(s) devuelto(s) a la cola.`)
                .query(`INSERT INTO fac_historial (entidad, id_entidad, accion, estado_nuevo, descripcion, id_usuario)
                        VALUES ('PREFACTURA', @idEntidad, 'ANULADA', 'ANULADA', @desc, @idUsuario)`);

            await transaction.commit();
            logger.info(`[Pre-factura] N° ${pf.numero_id} anulada; ${liberados.recordset.length} casos liberados.`);
            return { anulada: true, casos_liberados: liberados.recordset.length };
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    }

    /**
     * ¿Este cliente exige HES y la OC no lo trae?
     *
     * Devuelve un aviso, NO un error: hay clientes configurados con HES que
     * igual mandan la OC sin él, y bloquear la carga dejaría la OC afuera del
     * sistema (peor que registrarla incompleta). El aviso aparece al cargarla
     * y otra vez antes de emitir, que es donde el Sistema de Ventas la
     * rechazaría sin explicar por qué.
     */
    async _avisoHesFaltante(idPrefactura, numeroHes) {
        if (numeroHes) return null;
        const pool = await getConnection();
        const r = await pool.request()
            .input('id', sql.Int, idPrefactura)
            .query(`
                SELECT ISNULL(cfg.requiere_hes, 'N') AS requiere_hes, es.nombre_empresaservicios
                FROM fac_prefactura p
                LEFT JOIN fac_cliente_config cfg ON cfg.id_empresaservicio = p.id_empresaservicio
                LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = p.id_empresaservicio
                WHERE p.id_prefactura = @id
            `);
        const cfg = r.recordset[0];
        if (cfg?.requiere_hes !== 'S') return null;
        return `${(cfg.nombre_empresaservicios || 'Este cliente').trim()} está configurado como cliente que exige HES y esta OC no lo trae. Se registró igual, pero conviene pedirlo antes de emitir.`;
    }

    async registrarOrdenCompra(idPrefactura, datos, idUsuario) {
        if (!datos?.numeroOc) throw new Error('numeroOc es requerido.');
        const avisoHes = await this._avisoHesFaltante(idPrefactura, datos.numeroHes);

        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const ocReq = new sql.Request(transaction);
            ocReq.input('idPrefactura', sql.Int, idPrefactura);
            ocReq.input('numeroOc', sql.VarChar(100), datos.numeroOc);
            ocReq.input('fechaOc', sql.Date, datos.fechaOc || null);
            ocReq.input('referencia', sql.NVarChar(300), datos.referencia || null);
            ocReq.input('numeroHes', sql.VarChar(100), datos.numeroHes || null);
            ocReq.input('fechaHes', sql.Date, datos.fechaHes || null);
            ocReq.input('observaciones', sql.NVarChar(500), datos.observaciones || null);
            ocReq.input('idUsuario', sql.Int, idUsuario || null);
            await ocReq.query(`
                INSERT INTO fac_orden_compra (id_prefactura, numero_oc, fecha_oc, referencia, numero_hes, fecha_hes, observaciones, id_usuario)
                VALUES (@idPrefactura, @numeroOc, @fechaOc, @referencia, @numeroHes, @fechaHes, @observaciones, @idUsuario)
            `);

            const upReq = new sql.Request(transaction);
            upReq.input('id', sql.Int, idPrefactura);
            const upResult = await upReq.query(`
                UPDATE fac_prefactura
                SET estado = CASE WHEN estado NOT IN ('EN_EMISION', 'EMITIDA', 'ANULADA') THEN 'OC_RECIBIDA' ELSE estado END,
                    fecha_modificacion = GETDATE()
                OUTPUT inserted.estado
                WHERE id_prefactura = @id
            `);

            const histReq = new sql.Request(transaction);
            histReq.input('idEntidad', sql.Int, idPrefactura);
            histReq.input('idUsuario', sql.Int, idUsuario || null);
            histReq.input('descripcion', sql.NVarChar(500), `OC ${datos.numeroOc} registrada${datos.numeroHes ? ` (HES ${datos.numeroHes})` : ''}.`);
            await histReq.query(`
                INSERT INTO fac_historial (entidad, id_entidad, accion, estado_nuevo, descripcion, id_usuario)
                VALUES ('PREFACTURA', @idEntidad, 'OC_REGISTRADA', 'OC_RECIBIDA', @descripcion, @idUsuario)
            `);

            await transaction.commit();
            return { estado: upResult.recordset[0]?.estado, aviso_hes: avisoHes };
        } catch (error) {
            await transaction.rollback();
            logger.error('Error registrando orden de compra:', error);
            throw error;
        }
    }

    // ------------------------------------------------------------------
    // FASE 4 — Emisión: archivo plano (.txt) al Sistema de Ventas + cierre
    // automático del folio leyendo adl_facturacion.dbo.ventas.
    // ------------------------------------------------------------------

    // Columnas exactas, en este orden, verificadas byte a byte contra dos
    // .txt reales (FE_CASOS_... de Medio Ambiente y FE_OTRASVENTAS_...).
    static TXT_COLUMNAS = [
        'prefactura', 'n_td', 'ffac', 'oficina', 'id_cli', 'id_dir', 'id_gir', 'id_formapago',
        'banco', 'documento', 'ocompra', 'totaldoc', 'cantidad', 'claseserv', 'tiposerv', 'detalle',
        'neto', 'oficargo', 'proyecto', 'rut_cli', 'nom_cli', 'nom_dir', 'dir', 'id_ciu', 'ciudad',
        'id_com', 'nom_com', 'nom_gir', 'nom_fp', 'tipo_ref', 'num_ref', 'fecha_ref',
        'cod_razon', 'motivo', 'nota',
    ];

    static _txtCsvValue(v) {
        if (v === null || v === undefined) return '';
        return String(v);
    }

    /**
     * Resuelve los datos del Sistema de Ventas necesarios para emitir, en
     * cascada: 1) override manual en fac_cliente_config (si existe), 2) si
     * falta algo, lo busca por RUT contra adl_facturacion (cross-DB, solo
     * lectura) — clientes → clientesdir → clientesgir. El RUT en sí sale de
     * mae_empresaservicios.rut_empresaservicios (ADL ONE).
     *
     * @param {number} idEmpresaServicio
     * @returns {Promise<Object>} datos listos para _filaLinea/_filaReferencia
     */
    async _resolverClienteVentas(idEmpresaServicio) {
        const pool = await getConnection();

        const esReq = pool.request();
        esReq.input('id', sql.Numeric(10, 0), idEmpresaServicio);
        const esRes = await esReq.query(`
            SELECT rut_empresaservicios AS rut, nombre_empresaservicios AS razon_social
            FROM mae_empresaservicios WHERE id_empresaservicio = @id
        `);
        const es = esRes.recordset[0];
        if (!es || !es.rut) {
            throw new Error(`La empresaservicio #${idEmpresaServicio} no tiene RUT registrado en mae_empresaservicios.`);
        }

        const cfgReq = pool.request();
        cfgReq.input('id', sql.Numeric(10, 0), idEmpresaServicio);
        const cfgRes = await cfgReq.query('SELECT * FROM fac_cliente_config WHERE id_empresaservicio = @id');
        const cfg = cfgRes.recordset[0] || {};

        const rut = cfg.rut || es.rut;
        let idCli = cfg.id_cli_ventas;
        let razonSocial = cfg.razon_social || es.razon_social;

        if (!idCli) {
            const cliReq = pool.request();
            cliReq.input('rut', sql.VarChar(12), rut);
            const cliRes = await cliReq.query('SELECT TOP 1 idcliente, razon_social FROM adl_facturacion.dbo.clientes WHERE rut = @rut');
            const cliente = cliRes.recordset[0];
            if (!cliente) {
                throw new Error(`Cliente con RUT ${rut} no está registrado en el Sistema de Ventas (adl_facturacion.clientes). Regístralo (spNuevoCliente) antes de emitir.`);
            }
            idCli = cliente.idcliente;
            razonSocial = razonSocial || cliente.razon_social;
        }

        let idDir = cfg.id_dir_ventas, direccion = cfg.direccion, idCom = cfg.id_com_ventas;
        if (!idDir) {
            const dirReq = pool.request();
            dirReq.input('idCli', sql.Int, idCli);
            const dirRes = await dirReq.query('SELECT TOP 1 iddireccion, direccion, idcomuna FROM adl_facturacion.dbo.clientesdir WHERE idcliente = @idCli ORDER BY iddireccion');
            const d = dirRes.recordset[0];
            if (!d) throw new Error(`Cliente RUT ${rut} no tiene dirección registrada en el Sistema de Ventas.`);
            idDir = d.iddireccion;
            direccion = direccion || d.direccion;
            idCom = idCom || d.idcomuna;
        }

        let idGir = cfg.id_gir_ventas, giro = cfg.giro;
        if (!idGir) {
            const girReq = pool.request();
            girReq.input('idCli', sql.Int, idCli);
            const girRes = await girReq.query('SELECT TOP 1 idgiro, giro FROM adl_facturacion.dbo.clientesgir WHERE idcliente = @idCli ORDER BY idgiro');
            const g = girRes.recordset[0];
            if (!g) throw new Error(`Cliente RUT ${rut} no tiene giro registrado en el Sistema de Ventas.`);
            idGir = g.idgiro;
            giro = giro || g.giro;
        }

        return {
            id_cli_ventas: idCli,
            id_dir_ventas: idDir,
            id_gir_ventas: idGir,
            id_formapago_ventas: cfg.id_formapago_ventas || 1, // observado como constante '1' en los .txt reales vistos
            rut,
            razon_social: razonSocial,
            direccion,
            giro,
            id_ciu_ventas: cfg.id_ciu_ventas || null,
            nom_ciu_ventas: cfg.nom_ciu_ventas || null,
            id_com_ventas: idCom || null,
            nom_com_ventas: cfg.nom_com_ventas || null,
        };
    }

    /**
     * Arma la fila de "línea" (cantidad=1, lleva neto/glosa) para una
     * pre-factura ya validada y con snapshot de cliente completo (cfg).
     */
    _filaLinea(pf, cfg) {
        const q = (s) => `"${s ?? ''}"`;
        const fechaFac = pf.fecha_facturacion ? this._fechaDDMMYYYY(pf.fecha_facturacion) : this._hoyDDMMYYYY();
        return [
            pf.numero_id, q('FE'), fechaFac, q('Casa Matriz'),
            cfg.id_cli_ventas, cfg.id_dir_ventas, cfg.id_gir_ventas, cfg.id_formapago_ventas || 1,
            q('Banco'), q('Documento'), q(''),
            Math.round(pf.total_clp), 1,
            q('Medio Ambiente'), q('ADL'), q(pf.glosa_fe || pf.glosa || 'Servicio Muestreo y Análisis de Medio Ambiente'),
            Math.round(pf.neto_clp), q('Casa Matriz'), q('Laboratorio'),
            q(cfg.rut), q(cfg.razon_social), q(cfg.direccion), q(cfg.direccion),
            cfg.id_ciu_ventas, q(cfg.nom_ciu_ventas), cfg.id_com_ventas, q(cfg.nom_com_ventas),
            q(cfg.giro), q(pf.forma_pago || ''),
            q(''), q(''), '/  /',
            0, q(''), q(''),
        ].join(',');
    }

    /** Fila de referencia (OC o HES) — misma cabecera repetida, cantidad=0. */
    _filaReferencia(pf, cfg, tipoRef, numRef, fechaRef) {
        const q = (s) => `"${s ?? ''}"`;
        const fechaFac = pf.fecha_facturacion ? this._fechaDDMMYYYY(pf.fecha_facturacion) : this._hoyDDMMYYYY();
        const fref = fechaRef ? this._fechaDDMMYYYY(fechaRef) : '/  /';
        return [
            pf.numero_id, q('FE'), fechaFac, q('Casa Matriz'),
            cfg.id_cli_ventas, cfg.id_dir_ventas, cfg.id_gir_ventas, cfg.id_formapago_ventas || 1,
            q('Banco'), q('Documento'), q(''),
            Math.round(pf.total_clp), 0,
            q(''), q(''), q(''),
            0, q(''), q(''),
            q(cfg.rut), q(cfg.razon_social), q(cfg.direccion), q(cfg.direccion),
            cfg.id_ciu_ventas, q(cfg.nom_ciu_ventas), cfg.id_com_ventas, q(cfg.nom_com_ventas),
            q(cfg.giro), q(pf.forma_pago || ''),
            q(tipoRef), q(numRef), fref,
            0, q(''), q(''),
        ].join(',');
    }

    /** DD/MM/YYYY de "ahora" — hora local, correcto usar getters locales. */
    _hoyDDMMYYYY() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    /**
     * DD/MM/YYYY de una fecha GUARDADA (fecha_facturacion, fecha_oc, fecha_hes
     * — columnas DATE sin hora). new Date('2026-08-28') se interpreta como
     * medianoche UTC; con getters locales en un huso detrás de UTC (Chile)
     * eso retrocede un día. Por eso: strings 'YYYY-MM-DD' se parsean por
     * texto (sin pasar por Date), y objetos Date ya materializados se leen
     * con getters UTC (así llegan los DATE del driver mssql).
     */
    _fechaDDMMYYYY(fecha) {
        if (typeof fecha === 'string') {
            const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        }
        const d = fecha instanceof Date ? fecha : new Date(fecha);
        return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
    }

    /**
     * Genera el archivo plano de un lote de pre-facturas y lo deja listo
     * para subir manualmente al Sistema de Ventas. Requiere que cada
     * pre-factura esté en OC_RECIBIDA (o ENVIADA si su cliente no requiere
     * OC) y que su cliente tenga completo el snapshot en fac_cliente_config
     * (id_cli_ventas/id_dir_ventas/id_gir_ventas/rut/razon_social/dirección).
     *
     * @param {number[]} idPrefacturaList
     * @param {number} idUsuario
     * @returns {Promise<{id_lote:number, archivo_path:string, nombre_archivo:string, cantidad_prefacturas:number}>}
     */
    async generarArchivoPlano(idPrefacturaList, idUsuario) {
        const ids = [...new Set((idPrefacturaList || []).map(Number))];
        if (ids.length === 0) throw new Error('Debe seleccionar al menos una pre-factura.');

        const pool = await getConnection();
        const filas = [];
        const numerosParaNombre = [];
        const incluidas = [];

        // La fecha del archivo es la del día en que REALMENTE se genera/sube al
        // Sistema de Ventas — puede pasar tiempo desde que se recibió la OC
        // (semanas, según el cliente), así que se fija recién acá, no antes.
        // Como string 'YYYY-MM-DD' con getters LOCALES (no toISOString/UTC):
        // _fechaDDMMYYYY interpreta un Date vivo con getters UTC (así lee
        // fechas ya guardadas por mssql, que materializa DATE en UTC-medianoche),
        // y aplicado a un "ahora" real en Chile (UTC-3/4) corre el día hacia
        // adelante en la tarde/noche. Un string lo hace pasar por la rama de
        // parseo de texto, que es segura para "ahora".
        const hoyDate = new Date();
        const hoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')}`;
        const avisos = [];

        for (const id of ids) {
            const pf = await this.getPrefacturaDetalle(id);
            if (!pf) throw new Error(`Pre-factura #${id} no encontrada.`);
            if (!['OC_RECIBIDA', 'ENVIADA'].includes(pf.estado)) {
                throw new Error(`Pre-factura #${pf.numero_id} está en estado '${pf.estado}' — debe estar OC_RECIBIDA (o ENVIADA sin OC requerida) para emitir.`);
            }

            // Último punto donde el HES faltante todavía se puede pedir: si el
            // lote sale sin él, el Sistema de Ventas lo rechaza sin decir por qué.
            // Avisa, no bloquea (hay clientes que igual facturan sin HES).
            const sinHes = !pf.ordenes_compra?.some((oc) => oc.numero_hes);
            const aviso = await this._avisoHesFaltante(pf.id_prefactura, sinHes ? null : 'ok');
            if (aviso) avisos.push(`Pre-factura N° ${pf.numero_id}: ${aviso}`);

            pf.fecha_facturacion = hoy;
            await pool.request()
                .input('id', sql.Int, pf.id_prefactura)
                .input('fecha', sql.Date, hoy)
                .query('UPDATE fac_prefactura SET fecha_facturacion = @fecha, fecha_modificacion = GETDATE() WHERE id_prefactura = @id');

            const cfg = await this._resolverClienteVentas(pf.id_empresaservicio);

            filas.push(this._filaLinea(pf, cfg));
            for (const oc of pf.ordenes_compra) {
                filas.push(this._filaReferencia(pf, cfg, 'OC', oc.numero_oc, oc.fecha_oc));
                if (oc.numero_hes) {
                    filas.push(this._filaReferencia(pf, cfg, 'HES', oc.numero_hes, oc.fecha_hes));
                }
            }

            numerosParaNombre.push(pf.numero_id);
            incluidas.push(pf);
        }

        const header = FacturacionService.TXT_COLUMNAS.join(',');
        const contenido = [header, ...filas].join('\r\n') + '\r\n';
        const buffer = Buffer.from(contenido, 'latin1'); // cp1252 ~ latin1 para acentos/ñ (mismo rango 0xA0+)

        // MES_ID..._EMPRESA — mes de emisión (no de la OC), un ID por
        // pre-factura incluida, y el nombre del cliente si el lote es de
        // uno solo (si mezcla empresas, va "VARIOS" — no hay dimensión de
        // programa/centro a nivel de pre-factura para incluir, cada una
        // puede tener casos de varios centros).
        const MESES_ABR = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const mesAbr = MESES_ABR[hoyDate.getMonth()];
        const sanitizarNombre = (s) => (s || '')
            .normalize('NFD').replace(/\p{Diacritic}/gu, '')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '');
        const empresasUnicas = new Set(incluidas.map((p) => p.id_empresaservicio));
        const empresaParte = empresasUnicas.size === 1
            ? sanitizarNombre(incluidas[0].nombre_empresaservicios)
            : 'VARIOS';
        const idsParte = numerosParaNombre.map((n) => `ID${n}`).join('_');
        const nombreArchivo = `${mesAbr}_${idsParte}_${empresaParte}.txt`;
        const dir = path.join(UPLOAD_PATH, 'facturacion', '_lotes');
        fs.mkdirSync(dir, { recursive: true });
        const archivoPath = path.join(dir, nombreArchivo);
        fs.writeFileSync(archivoPath, buffer);
        const relPath = `/uploads/facturacion/_lotes/${nombreArchivo}`;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const loteReq = new sql.Request(transaction);
            loteReq.input('nombreArchivo', sql.VarChar(200), nombreArchivo);
            loteReq.input('archivoPath', sql.VarChar(500), relPath);
            loteReq.input('cantidad', sql.Int, incluidas.length);
            loteReq.input('idUsuario', sql.Int, idUsuario || null);
            const loteResult = await loteReq.query(`
                INSERT INTO fac_lote_emision (nombre_archivo, tipo_documento, archivo_path, cantidad_prefacturas, estado, id_usuario)
                OUTPUT inserted.id_lote
                VALUES (@nombreArchivo, 'FEA', @archivoPath, @cantidad, 'GENERADO', @idUsuario)
            `);
            const idLote = loteResult.recordset[0].id_lote;

            for (const pf of incluidas) {
                const emReq = new sql.Request(transaction);
                emReq.input('idPrefactura', sql.Int, pf.id_prefactura);
                emReq.input('idLote', sql.Int, idLote);
                emReq.input('montoNeto', sql.Decimal(18, 2), pf.neto_clp);
                emReq.input('iva', sql.Decimal(18, 2), pf.iva_clp);
                emReq.input('montoTotal', sql.Decimal(18, 2), pf.total_clp);
                await emReq.query(`
                    INSERT INTO fac_emision (id_prefactura, id_lote, tipo_documento, monto_neto, iva, monto_total, estado)
                    VALUES (@idPrefactura, @idLote, 'FE', @montoNeto, @iva, @montoTotal, 'ARCHIVO_GENERADO')
                `);

                const upReq = new sql.Request(transaction);
                upReq.input('id', sql.Int, pf.id_prefactura);
                await upReq.query(`UPDATE fac_prefactura SET estado = 'EN_EMISION', fecha_modificacion = GETDATE() WHERE id_prefactura = @id`);

                const histReq = new sql.Request(transaction);
                histReq.input('idEntidad', sql.Int, pf.id_prefactura);
                histReq.input('idUsuario', sql.Int, idUsuario || null);
                histReq.input('descripcion', sql.NVarChar(500), `Incluida en lote de emisión ${nombreArchivo}.`);
                await histReq.query(`
                    INSERT INTO fac_historial (entidad, id_entidad, accion, estado_nuevo, descripcion, id_usuario)
                    VALUES ('PREFACTURA', @idEntidad, 'EN_EMISION', 'EN_EMISION', @descripcion, @idUsuario)
                `);
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }

        return { archivo_path: relPath, nombre_archivo: nombreArchivo, cantidad_prefacturas: incluidas.length, avisos };
    }

    /**
     * Cierre automático del folio: lee adl_facturacion.dbo.ventas por
     * prefactura (nuestro numero_id) y, si ya tiene folio (nrodoc) y no está
     * anulada (nulo=0), lo registra en fac_emision y pasa la pre-factura a
     * EMITIDA — sin re-tecleo. Pensado para correr en un poller periódico.
     * Solo lectura sobre adl_facturacion; solo escribe en PruebasInformatica.
     */
    /** Lotes de archivo plano ya generados (para poder volver a descargarlos). */
    async listarLotesEmision(limit = 50) {
        const pool = await getConnection();
        const result = await pool.request()
            .input('limit', sql.Int, limit)
            .query(`
                SELECT TOP (@limit) id_lote, nombre_archivo, tipo_documento, archivo_path,
                       cantidad_prefacturas, estado, fecha_creacion
                FROM fac_lote_emision
                ORDER BY fecha_creacion DESC
            `);
        return result.recordset;
    }

    async cerrarFoliosPendientes() {
        const pool = await getConnection();

        const pendientes = await pool.request().query(`
            SELECT e.id_emision, e.id_prefactura, p.numero_id
            FROM fac_emision e
            JOIN fac_prefactura p ON p.id_prefactura = e.id_prefactura
            WHERE e.estado = 'ARCHIVO_GENERADO' AND e.folio_sii IS NULL
        `);
        if (pendientes.recordset.length === 0) return { cerrados: 0 };

        let cerrados = 0;
        for (const row of pendientes.recordset) {
            const ventaReq = pool.request();
            ventaReq.input('prefactura', sql.Int, row.numero_id);
            const ventaRes = await ventaReq.query(`
                SELECT TOP 1 idtipodoc, nrodoc, total, nulo
                FROM adl_facturacion.dbo.ventas
                WHERE prefactura = @prefactura AND nrodoc IS NOT NULL AND nrodoc <> 0
                ORDER BY idventa DESC
            `);
            const venta = ventaRes.recordset[0];
            if (!venta || venta.nulo === 1) continue;

            const upEmReq = pool.request();
            upEmReq.input('id', sql.Int, row.id_emision);
            upEmReq.input('folio', sql.VarChar(50), String(venta.nrodoc));
            await upEmReq.query(`
                UPDATE fac_emision
                SET folio_sii = @folio, fecha_emision = CAST(GETDATE() AS DATE), estado = 'FOLIO_REGISTRADO', fecha_modificacion = GETDATE()
                WHERE id_emision = @id
            `);

            const upPfReq = pool.request();
            upPfReq.input('id', sql.Int, row.id_prefactura);
            await upPfReq.query(`UPDATE fac_prefactura SET estado = 'EMITIDA', fecha_modificacion = GETDATE() WHERE id_prefactura = @id`);

            const histReq = pool.request();
            histReq.input('idEntidad', sql.Int, row.id_prefactura);
            histReq.input('descripcion', sql.NVarChar(500), `Folio SII ${venta.nrodoc} registrado automáticamente.`);
            await histReq.query(`
                INSERT INTO fac_historial (entidad, id_entidad, accion, estado_nuevo, descripcion)
                VALUES ('PREFACTURA', @idEntidad, 'FOLIO_REGISTRADO', 'EMITIDA', @descripcion)
            `);

            logger.info(`[Facturacion] Folio ${venta.nrodoc} cerrado para pre-factura #${row.numero_id}`);
            cerrados++;
        }
        return { cerrados };
    }

    // ------------------------------------------------------------------
    // FASE 6 — Portal de clientes (ADL WEB GO / WebClientesV2)
    // Canal primario de OCs: se publica la prefactura allá (empuje, contrato
    // ya existente /api/v1/ingesta) y se recibe la OC de vuelta por un
    // endpoint interno nuevo (protectWebClientesService), cuando ese lado
    // esté implementado en WebClientesV2. El email (Fase 3) sigue vivo como
    // canal alterno para clientes que no usen el portal.
    // ------------------------------------------------------------------

    /**
     * Publica el PDF resumen de una pre-factura en ADL WEB GO, vía su
     * endpoint /ingesta (idempotente por referencia_externa = "PF-{numero_id}").
     * Requiere que el cliente tenga portal_cliente_codigo configurado en
     * fac_cliente_config — esa taxonomía es propia de WebClientesV2 y no se
     * adivina.
     */
    async publicarEnPortal(idPrefactura, idUsuario) {
        let pf = await this.getPrefacturaDetalle(idPrefactura);
        if (!pf) throw new Error('Pre-factura no encontrada.');

        if (!pf.pdf_resumen_path) {
            await this.generarPdfs(idPrefactura, idUsuario);
            pf = await this.getPrefacturaDetalle(idPrefactura);
        }

        const pool = await getConnection();
        const cfgReq = pool.request();
        cfgReq.input('idEmpresaServicio', sql.Numeric(10, 0), pf.id_empresaservicio);
        const cfgRes = await cfgReq.query(`
            SELECT portal_cliente_codigo, portal_sede_codigo FROM fac_cliente_config WHERE id_empresaservicio = @idEmpresaServicio
        `);
        const cfg = cfgRes.recordset[0];
        if (!cfg?.portal_cliente_codigo) {
            throw new Error(`Pre-factura #${pf.numero_id}: falta configurar portal_cliente_codigo en fac_cliente_config para publicarla en ADL WEB GO.`);
        }

        if (!process.env.WEBCLIENTES_API_URL || !process.env.WEBCLIENTES_API_KEY) {
            throw new Error('WEBCLIENTES_API_URL / WEBCLIENTES_API_KEY no están configuradas en .env.');
        }

        const pdfBuffer = fs.readFileSync(path.join(UPLOAD_PATH, 'facturacion', String(pf.numero_id), 'resumen.pdf'));
        const form = new FormData();
        form.append('cliente_codigo', cfg.portal_cliente_codigo);
        if (cfg.portal_sede_codigo) form.append('sede_codigo', cfg.portal_sede_codigo);
        // 'FACTURACION' no es un área real en WebClientesV2 (verificado: solo
        // existen MAM/LAB/AGUAS) — la Facturación de Medio Ambiente cuelga del
        // área MAM. Tampoco se manda 'clasificaciones': su taxonomía real ahí
        // es programa/centro/punto (por muestra), y una pre-factura no se
        // reduce a un único programa/centro (puede agrupar casos de varios) —
        // fabricar un valor sería adivinar, así que se deja sin clasificar.
        form.append('area_codigo', 'MAM');
        form.append('fecha_informe', new Date().toISOString().slice(0, 10));
        form.append('nombre_visible', `Pre-Factura N° ${pf.numero_id} - ${pf.nombre_empresaservicios || ''}`);
        form.append('referencia_externa', `PF-${pf.numero_id}`);
        form.append('archivo', new Blob([pdfBuffer], { type: 'application/pdf' }), `PF_${pf.numero_id}.pdf`);

        const resp = await fetch(`${process.env.WEBCLIENTES_API_URL}/api/v1/ingesta`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}` },
            body: form,
            signal: AbortSignal.timeout(15000),
        });
        if (!resp.ok) {
            const texto = await resp.text().catch(() => '');
            throw new Error(`ADL WEB GO respondió ${resp.status}: ${texto}`);
        }
        const data = await resp.json();

        const upReq = pool.request();
        upReq.input('id', sql.Int, idPrefactura);
        await upReq.query(`
            UPDATE fac_prefactura SET portal_publicado = 1, fecha_portal_publicado = GETDATE(), fecha_modificacion = GETDATE()
            WHERE id_prefactura = @id
        `);

        const histReq = pool.request();
        histReq.input('idEntidad', sql.Int, idPrefactura);
        histReq.input('idUsuario', sql.Int, idUsuario || null);
        await histReq.query(`
            INSERT INTO fac_historial (entidad, id_entidad, accion, descripcion, id_usuario)
            VALUES ('PREFACTURA', @idEntidad, 'PUBLICADA_PORTAL', 'Publicada en ADL WEB GO.', @idUsuario)
        `);

        return { publicado: true, respuesta_portal: data };
    }

    /**
     * Recibe una OC/HES que el cliente subió en ADL WEB GO (llamado por el
     * backend de WebClientesV2, servidor-a-servidor). Resuelve la
     * pre-factura por su referencia externa (PF-{numero_id}) y reusa
     * registrarOrdenCompra — misma validación y misma transición de estado
     * que si se hubiera registrado a mano en ADL ONE.
     */
    async recibirOrdenCompraDesdePortal(referenciaExterna, datos, idUsuario) {
        const m = String(referenciaExterna || '').match(/^PF-(\d+)$/);
        if (!m) throw new Error(`referencia_externa inválida: "${referenciaExterna}" (esperado formato PF-<numero_id>).`);
        const numeroId = Number(m[1]);

        const pool = await getConnection();
        const req = pool.request();
        req.input('numeroId', sql.Numeric(10, 0), numeroId);
        const res = await req.query('SELECT id_prefactura FROM fac_prefactura WHERE numero_id = @numeroId');
        if (res.recordset.length === 0) throw new Error(`No existe una pre-factura con numero_id=${numeroId}.`);

        return this.registrarOrdenCompra(res.recordset[0].id_prefactura, datos, idUsuario);
    }

    /**
     * Recibe una solicitud de cotización que un cliente creó en su portal
     * (WebClientesV2, dbo.cotizacion_solicitud). NO calcula precio ni crea la
     * fac_cotizacion — el cliente describe en texto libre lo que necesita
     * (no técnicas del catálogo), así que sigue siendo un humano de ADL quien
     * arma la cotización real con el motor de precios (resolverPrecioTecnica).
     * Esto solo la deja en la bandeja de entrada, intentando resolver la
     * empresa por RUT para ahorrar ese paso. Idempotente por referencia_externa.
     */
    async recibirSolicitudCotizacionPortal(referenciaExterna, datos) {
        if (!referenciaExterna) throw new Error('referencia_externa es requerida.');
        if (!datos?.titulo) throw new Error('titulo es requerido.');

        const pool = await getConnection();
        const existente = await pool.request()
            .input('r', sql.VarChar(100), referenciaExterna)
            .query('SELECT id_solicitud_portal FROM fac_cotizacion_portal_solicitud WHERE referencia_externa = @r');
        if (existente.recordset.length > 0) {
            return { id_solicitud_portal: existente.recordset[0].id_solicitud_portal, estado: 'ya_existia' };
        }

        // Resolución por cliente_codigo (fac_cliente_config.portal_cliente_codigo)
        // — es el MISMO vínculo que ya usa publicarEnPortal/generarArchivoPlano
        // para saber a quién corresponde cada cliente de WebClientesV2, así que
        // cualquier cliente que YA pueda recibir pre-facturas en el portal
        // resuelve solo acá también. RUT queda como respaldo (WebClientesV2 no
        // guarda el RUT del cliente hoy, así que en la práctica no llega, pero
        // si algún día lo manda, se usa igual).
        let idEmpresaServicio = null;
        if (datos.clienteCodigo) {
            const es = await pool.request()
                .input('cod', sql.VarChar(50), datos.clienteCodigo)
                .query(`SELECT TOP 1 id_empresaservicio FROM fac_cliente_config WHERE portal_cliente_codigo = @cod`);
            if (es.recordset.length > 0) idEmpresaServicio = es.recordset[0].id_empresaservicio;
        }
        if (!idEmpresaServicio && datos.rut) {
            const es = await pool.request()
                .input('rut', sql.VarChar(20), datos.rut)
                .query(`SELECT TOP 1 id_empresaservicio FROM mae_empresaservicios WHERE LTRIM(RTRIM(rut_empresaservicios)) = @rut`);
            if (es.recordset.length > 0) idEmpresaServicio = es.recordset[0].id_empresaservicio;
        }

        const row = (await pool.request()
            .input('ref', sql.VarChar(100), referenciaExterna)
            .input('es', sql.Numeric(10, 0), idEmpresaServicio)
            .input('rut', sql.VarChar(20), datos.rut || null)
            .input('nombreCliente', sql.VarChar(200), datos.nombreCliente || null)
            .input('titulo', sql.NVarChar(200), datos.titulo)
            .input('descripcion', sql.NVarChar(sql.MAX), datos.descripcion || null)
            .input('items', sql.NVarChar(sql.MAX), JSON.stringify(datos.items || []))
            .input('solNombre', sql.NVarChar(200), datos.solicitanteNombre || null)
            .input('solEmail', sql.NVarChar(255), datos.solicitanteEmail || null)
            .query(`
                INSERT INTO fac_cotizacion_portal_solicitud
                    (referencia_externa, id_empresaservicio, rut_cliente_portal, nombre_cliente_portal, titulo, descripcion, items_json,
                     solicitante_nombre, solicitante_email)
                OUTPUT INSERTED.id_solicitud_portal
                VALUES (@ref, @es, @rut, @nombreCliente, @titulo, @descripcion, @items, @solNombre, @solEmail)
            `)).recordset[0];

        logger.info(`[Cotizaciones-Portal] Solicitud recibida: ${referenciaExterna} — "${datos.titulo}"${idEmpresaServicio ? ` (empresaservicio=${idEmpresaServicio})` : ' (empresa no resuelta, requiere match manual)'}`);
        return { id_solicitud_portal: row.id_solicitud_portal, estado: 'creada', id_empresaservicio: idEmpresaServicio };
    }

    /** Bandeja de solicitudes del portal aún no atendidas (o todas, si se pide). */
    async listarSolicitudesCotizacionPortal(soloPendientes = true) {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT sp.id_solicitud_portal, sp.referencia_externa, sp.id_empresaservicio,
                   es.nombre_empresaservicios, sp.rut_cliente_portal, sp.nombre_cliente_portal,
                   sp.titulo, sp.descripcion, sp.items_json, sp.atendida, sp.id_cotizacion, sp.fecha_creacion
            FROM fac_cotizacion_portal_solicitud sp
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = sp.id_empresaservicio
            ${soloPendientes ? 'WHERE sp.atendida = 0' : ''}
            ORDER BY sp.fecha_creacion DESC
        `);
        return result.recordset.map((r) => ({ ...r, items: r.items_json ? JSON.parse(r.items_json) : [] }));
    }

    /**
     * Bandeja UNIFICADA de Cotizaciones: una fila por conversación con el
     * cliente, venga o no del portal, tenga o no cotización armada todavía.
     * Se pinta 100% con datos locales (columnas de caché de chat en
     * fac_cotizacion_portal_solicitud, actualizadas por registrarEventoPortal) —
     * NO consulta a WebClientesV2 por cada fila, para que escale con cientos
     * de solicitudes.
     */
    async listarBandejaCotizaciones(filtros = {}) {
        const pool = await getConnection();
        const result = await pool.request().query(`
            WITH bandeja AS (
                SELECT
                    'PORTAL' AS origen,
                    sp.id_solicitud_portal, sp.id_cotizacion, c.numero_cotizacion, sp.referencia_externa,
                    COALESCE(c.id_empresaservicio, sp.id_empresaservicio) AS id_empresaservicio,
                    sp.nombre_cliente_portal, sp.titulo,
                    c.estado AS estado_cotizacion, sp.estado_portal,
                    CASE WHEN sp.ultimo_mensaje_autor = 'CLIENTE'
                              AND (sp.staff_ultima_vista IS NULL OR sp.ultimo_mensaje_fecha > sp.staff_ultima_vista)
                         THEN 1 ELSE 0 END AS tiene_mensaje_nuevo,
                    sp.ultimo_mensaje_texto, sp.ultimo_mensaje_autor, sp.ultimo_mensaje_fecha,
                    c.total_uf, c.total_clp,
                    sp.fecha_creacion,
                    COALESCE(c.fecha_modificacion, sp.fecha_creacion) AS fecha_actualizacion
                FROM fac_cotizacion_portal_solicitud sp
                LEFT JOIN fac_cotizacion c ON c.id_cotizacion = sp.id_cotizacion

                UNION ALL

                SELECT
                    'MANUAL' AS origen,
                    NULL, c.id_cotizacion, c.numero_cotizacion, NULL,
                    c.id_empresaservicio, NULL, c.glosa,
                    c.estado, NULL,
                    0,
                    NULL, NULL, NULL,
                    c.total_uf, c.total_clp,
                    c.fecha_creacion,
                    COALESCE(c.fecha_modificacion, c.fecha_creacion)
                FROM fac_cotizacion c
                WHERE c.referencia_externa_portal IS NULL
            )
            SELECT bandeja.*, es.nombre_empresaservicios
            FROM bandeja
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = bandeja.id_empresaservicio
        `);

        const ESTADO_LABEL = {
            PENDIENTE: 'Solicitud pendiente', BORRADOR: 'Cotización en preparación', ENVIADA: 'Enviada al cliente',
            ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada por el cliente', EXPIRADA: 'Expirada',
        };

        let rows = result.recordset.map((r) => {
            let estadoUnificado;
            if (r.origen === 'MANUAL') {
                estadoUnificado = r.estado_cotizacion;
            } else if (!r.id_cotizacion) {
                estadoUnificado = r.estado_portal === 'CANCELADA' ? 'CANCELADA' : 'PENDIENTE';
            } else if (['ACEPTADA', 'RECHAZADA', 'CANCELADA'].includes(r.estado_portal)) {
                estadoUnificado = r.estado_portal; // el cliente ya respondió — esa respuesta manda
            } else {
                estadoUnificado = r.estado_cotizacion || 'BORRADOR';
            }
            return {
                ...r,
                nombre_cliente: r.nombre_empresaservicios || r.nombre_cliente_portal || 'Cliente sin resolver',
                estado_unificado: estadoUnificado,
                estado_label: ESTADO_LABEL[estadoUnificado] || estadoUnificado,
            };
        });

        if (filtros.estado) rows = rows.filter((r) => r.estado_unificado === filtros.estado);
        if (filtros.soloNoLeidos) rows = rows.filter((r) => r.tiene_mensaje_nuevo);
        if (filtros.idEmpresaServicio) rows = rows.filter((r) => Number(r.id_empresaservicio) === Number(filtros.idEmpresaServicio));

        rows.sort((a, b) => (b.tiene_mensaje_nuevo - a.tiene_mensaje_nuevo) || (new Date(b.fecha_actualizacion) - new Date(a.fecha_actualizacion)));
        return rows;
    }

    /**
     * Recibe eventos en vivo de una solicitud del portal desde WebClientesV2
     * (mensaje nuevo del cliente, o cambio de estado) para mantener la
     * caché local que pinta la bandeja sin consultar a WebClientesV2.
     */
    async registrarEventoPortal(referenciaExterna, evento) {
        if (!referenciaExterna) throw new Error('referencia_externa es requerida.');
        const pool = await getConnection();
        const sp = (await pool.request()
            .input('r', sql.VarChar(100), referenciaExterna)
            .query('SELECT id_solicitud_portal FROM fac_cotizacion_portal_solicitud WHERE referencia_externa = @r'))
            .recordset[0];
        if (!sp) {
            logger.warn(`[Cotizaciones-Portal] Evento para ${referenciaExterna} pero esa solicitud no existe en ADL ONE.`);
            return { ok: false };
        }

        if (evento.tipo === 'mensaje') {
            await pool.request()
                .input('id', sql.Int, sp.id_solicitud_portal)
                .input('texto', sql.NVarChar(500), String(evento.mensaje || '').slice(0, 500))
                .query(`UPDATE fac_cotizacion_portal_solicitud
                        SET ultimo_mensaje_texto = @texto, ultimo_mensaje_autor = 'CLIENTE', ultimo_mensaje_fecha = GETDATE()
                        WHERE id_solicitud_portal = @id`);
        } else if (evento.tipo === 'estado') {
            await pool.request()
                .input('id', sql.Int, sp.id_solicitud_portal)
                .input('e', sql.VarChar(20), String(evento.estado || '').toUpperCase())
                .query(`UPDATE fac_cotizacion_portal_solicitud SET estado_portal = @e WHERE id_solicitud_portal = @id`);
        }
        return { ok: true };
    }

    /** Limpia el badge de "mensaje nuevo" cuando un usuario de ADL ONE abre el detalle. */
    async marcarVistaStaffPortal(idSolicitudPortal) {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, idSolicitudPortal)
            .query(`UPDATE fac_cotizacion_portal_solicitud SET staff_ultima_vista = GETDATE() WHERE id_solicitud_portal = @id`);
        return { ok: true };
    }

    /** Actualiza la caché local de "último mensaje" al enviar desde ADL ONE (limpia el badge de paso). */
    async _actualizarCacheMensajeLocal(referenciaExterna, texto) {
        if (!referenciaExterna) return;
        const pool = await getConnection();
        await pool.request()
            .input('r', sql.VarChar(100), referenciaExterna)
            .input('texto', sql.NVarChar(500), String(texto || '').slice(0, 500))
            .query(`UPDATE fac_cotizacion_portal_solicitud
                    SET ultimo_mensaje_texto = @texto, ultimo_mensaje_autor = 'ADL_ONE',
                        ultimo_mensaje_fecha = GETDATE(), staff_ultima_vista = GETDATE()
                    WHERE referencia_externa = @r`);
    }

    // ------------------------------------------------------------------
    // COTIZACIÓN → FICHA
    //
    // El eslabón que faltaba para cerrar el ciclo. NO crea la ficha sola: una
    // ficha necesita mucho más de lo que una cotización sabe (objetivo de
    // muestreo, punto, frecuencia, inspector, lugar de análisis...), así que
    // inventarlos sería peor que tipearlos. Lo que sí hace es entregar todo lo
    // que la cotización YA tiene decidido —cliente, centro, y cada análisis con
    // el precio que el cliente aprobó— para que el formulario nazca con eso
    // cargado y nadie lo vuelva a teclear ni se desvíe del precio cotizado.
    // ------------------------------------------------------------------

    /**
     * Datos de una cotización aceptada listos para precargar el formulario de
     * ficha. Devuelve también los análisis que NO se pueden reconstruir, en vez
     * de omitirlos en silencio: son cotizaciones viejas, guardadas antes de que
     * se registrara la identidad completa del análisis.
     */
    async getCotizacionParaFicha(idCotizacion) {
        const cot = await this.getCotizacionDetalle(idCotizacion);
        if (!cot) throw new Error('Cotización no encontrada.');
        if (cot.estado !== 'ACEPTADA') {
            throw new Error(`Solo se pueden convertir cotizaciones aceptadas. Esta está en estado ${cot.estado}.`);
        }

        // El detalle de la ficha necesita la terna normativa/referencia/análisis.
        const convertibles = (cot.items || []).filter((it) => it.id_referenciaanalisis);
        const noConvertibles = (cot.items || []).filter((it) => !it.id_referenciaanalisis);

        // Se relee el catálogo para traer límites y traducción tal como los
        // espera el detalle de la ficha; el precio, en cambio, es el COTIZADO,
        // no el vigente hoy: es lo que el cliente aceptó.
        const pool = await getConnection();
        const analisis = [];
        for (const it of convertibles) {
            let extra = {};
            try {
                const cat = await pool.request()
                    .input('xid_normativareferencia', it.id_normativareferencia)
                    .execute('Consulta_App_Ma_ReferenciaAnalisis');
                extra = cat.recordset.find((a) => Number(a.id_referenciaanalisis) === Number(it.id_referenciaanalisis)) || {};
            } catch (e) {
                logger.warn(`[Cotización→Ficha] No se pudo releer el catálogo del análisis ${it.id_referenciaanalisis}: ${e.message}`);
            }
            // Una cantidad > 1 en la cotización es "N muestras de este análisis":
            // en la ficha eso se refleja repitiendo la línea.
            for (let i = 0; i < (Number(it.cantidad) || 1); i++) {
                analisis.push({
                    id_tecnica: it.id_tecnica,
                    id_normativa: it.id_normativa,
                    id_normativareferencia: it.id_normativareferencia,
                    id_referenciaanalisis: it.id_referenciaanalisis,
                    nombre_tecnica: (extra.nombre_tecnica || it.descripcion || '').trim(),
                    uf_individual: it.precio_unitario_uf ?? 0,
                    limitemax_d: extra.limitemax_d ?? null,
                    limitemax_h: extra.limitemax_h ?? null,
                    llevaerror: extra.llevaerror ?? 'N',
                    error_min: extra.error_min ?? null,
                    error_max: extra.error_max ?? null,
                    llevatraduccion: extra.llevatraduccion ?? 'N',
                    traduccion_0: extra.traduccion_0 ?? '',
                    traduccion_1: extra.traduccion_1 ?? '',
                });
            }
        }

        return {
            id_cotizacion: cot.id_cotizacion,
            numero_cotizacion: cot.numero_cotizacion,
            fecha_convertida_ficha: cot.fecha_convertida_ficha || null,
            // Claves con los nombres que hidrata AntecedentesForm.
            antecedentes: {
                selectedEmpresa: cot.id_empresaservicio ? String(cot.id_empresaservicio) : '',
                selectedCliente: cot.id_empresa ? String(cot.id_empresa) : '',
                selectedFuente: cot.id_centro ? String(cot.id_centro) : '',
                glosa: cot.glosa || '',
            },
            analisis,
            avisos: noConvertibles.map((it) => ({
                descripcion: it.descripcion || `Técnica #${it.id_tecnica}`,
                motivo: 'Cotizada antes de que se registrara la normativa y referencia del análisis: hay que agregarla a mano.',
            })),
        };
    }

    /** Deja registrado que esta cotización ya se convirtió en trabajo. */
    async marcarCotizacionConvertida(idCotizacion) {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, idCotizacion)
            .query(`UPDATE fac_cotizacion
                    SET fecha_convertida_ficha = ISNULL(fecha_convertida_ficha, GETDATE()), fecha_modificacion = GETDATE()
                    WHERE id_cotizacion = @id`);
        return { ok: true };
    }

    /** Detalle completo de UNA solicitud del portal — usado por la vista de detalle, no por la lista. */
    async getSolicitudPortal(idSolicitudPortal) {
        const pool = await getConnection();
        const r = (await pool.request()
            .input('id', sql.Int, idSolicitudPortal)
            .query(`
                SELECT sp.*, es.nombre_empresaservicios
                FROM fac_cotizacion_portal_solicitud sp
                LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = sp.id_empresaservicio
                WHERE sp.id_solicitud_portal = @id
            `)).recordset[0];
        if (!r) return null;
        return { ...r, items: r.items_json ? JSON.parse(r.items_json) : [] };
    }

    /** Marca una solicitud del portal como atendida, vinculada a la cotización real que un humano armó. */
    async vincularCotizacionAPortal(idCotizacion, idSolicitudPortal) {
        const pool = await getConnection();
        const sp = (await pool.request()
            .input('id', sql.Int, idSolicitudPortal)
            .query('SELECT referencia_externa FROM fac_cotizacion_portal_solicitud WHERE id_solicitud_portal = @id'))
            .recordset[0];
        if (!sp) throw new Error(`Solicitud del portal #${idSolicitudPortal} no encontrada.`);

        await pool.request()
            .input('id', sql.Int, idSolicitudPortal).input('cot', sql.Int, idCotizacion)
            .query('UPDATE fac_cotizacion_portal_solicitud SET atendida = 1, id_cotizacion = @cot WHERE id_solicitud_portal = @id');
        await pool.request()
            .input('cot', sql.Int, idCotizacion).input('ref', sql.VarChar(100), sp.referencia_externa)
            .query('UPDATE fac_cotizacion SET referencia_externa_portal = @ref WHERE id_cotizacion = @cot');
        return { ok: true };
    }

    // ------------------------------------------------------------------
    // PROPUESTA TÉCNICO ECONÓMICA (PDF de cotización)
    //
    // Réplica del documento Word que Medio Ambiente usa hoy
    // ("MEDIO AMBIENTE-P881-01092026-...doc"), con la identidad visual de
    // las pre-facturas (logo ADL Diagnostic + doble filete navy/naranjo).
    // Los textos legales de acá salen literales de ese documento: son
    // condiciones comerciales reales, no se inventan ni se resumen.
    // ------------------------------------------------------------------

    static MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    static EMPRESA_ADL = {
        nombre: 'Soc. ADL Diagnostic Chile SpA.',
        rut: '77.354.970-2',
        giro: 'Laboratorio',
        direccion: 'Sector la Vara S/N, Camino Alerce, Puerto Montt',
        banco: 'El depósito o transferencia debe realizarse a nombre de ADL Diagnostic Chile SpA., Cta. Cte. Nro. 63042975 Banco Crédito e Inversiones (BCI), Puerto Montt. Para validar el pago se deberá enviar copia del comprobante respectivo a la Srta. Karina Rival a la casilla electrónica krival@adldiagnostic.cl',
    };

    static ANTECEDENTES_GENERALES = [
        'Todos los informes serán entregados dentro de 10 a 15 días hábiles de recepcionada la muestra en laboratorio de análisis.',
        'La emisión de informes se realizará en forma electrónica.',
        'Laboratorio de análisis cuenta con acreditación INN bajo la Norma Chilena ISO 17025 Of. 2017.',
        'Los muestreos normativos serán subcontratados al laboratorio Hidrolab S.A. (Código ETFA 003-01) y/o laboratorio Análisis Ambientales S.A. (Código ETFA 011-01 y 011-02). Estos laboratorios cuentan con la autorización por parte de la Superintendencia del Medio Ambiente (SMA) como Entidad Técnica de Fiscalización Ambiental (ETFA) para la ejecución de dichos muestreos y sus correspondientes mediciones.',
        'Análisis son analizados por Laboratorio ETFA, autorizado por la Superintendencia del Medio Ambiente (SMA).',
    ];

    // El mínimo de 2,5 UF es una condición comercial real de la propuesta: se
    // informa al cliente pero NO se aplica automáticamente al totalizar — el
    // sistema factura el monto que corresponda y Facturación decide cuándo
    // cobrar el mínimo. Por eso está en el texto y no en el cálculo.
    static NOTAS_IMPORTANTES = [
        'Soc. ADL Diagnostic Chile SpA., aplica en el cobro de todos sus servicios una facturación mínima neta de 2,5 UF mensual, por lo que si el monto global no alcanza a este valor se cobrará el monto mínimo indicado.',
        'El tiempo de respuesta contará desde la recepción de la muestra en el laboratorio de análisis hasta que se entregue el informe final al cliente.',
        'El Informe solo contendrá resultados de análisis.',
        'Si la cotización es aceptada, debe indicar por escrito el número de esta al solicitar el servicio.',
        'El atraso del pago en más de 60 días de emitida la factura, facultará a Soc. ADL Diagnostic Chile SpA., a retener indefinidamente y hasta el pago total de lo adeudado, la entrega del respectivo informe de resultados.',
        'Para los servicios realizados en zonas lejanas, propuesta indicará claramente la cantidad de días involucrados en la realización del servicio; si por razones externas a Soc. ADL Diagnostic Chile SpA., sean estas condiciones climáticas, cierre de puertos u otras que hagan extender el servicio, se cobrará un valor adicional diario de 5 UF.',
        'En aquellos casos que el servicio sea suspendido por parte del mandante en el lugar de ejecución de éste por razones de operatividad del establecimiento industrial se cobrará 3,0 UF por concepto de visita, 0,01 UF por kilómetro recorrido, peajes y transbordador si correspondiere.',
        'En actividades de muestreo realizadas en zonas lejanas que impliquen viajes en avión, avioneta y/o embarcaciones, los costos de traslado, alojamiento y alimentación son de cargo del mandante durante el o los días que dure la actividad de muestreo.',
        'El mandante debe velar por las condiciones mínimas de seguridad para que la actividad se desarrolle sin problemas, independiente de las medidas que entregue ADL a sus trabajadores.',
        'Si la propuesta es aceptada, se deben establecer claramente las contrapartes asociadas a la actividad.',
        'Soc. ADL Diagnostic Chile SpA., se compromete a mantener la confidencialidad respecto de toda la información obtenida o creada durante la realización de actividades de inspección, excepto la información que el cliente pone a disposición del público o lo acuerda previamente con ADL.',
        'Cuando ADL deba revelar información confidencial, ya sea requerido por ley o autorizado por las disposiciones contractuales, se debe notificar al cliente o persona interesada, la información proporcionada, salvo que esté prohibido por ley.',
        'Toda información obtenida del cliente por terceros, será confidencial entre el cliente y ADL. La fuente de información también debe mantenerse como confidencial por parte de ADL y no puede compartirse con el cliente, a menos que se haya acordado con la fuente.',
        'ADL debe informar al cliente con antelación acerca de la información que pretende poner al alcance del público.',
    ];

    _fechaLarga(fecha) {
        const d = fecha ? new Date(fecha) : new Date();
        return `${String(d.getDate()).padStart(2, '0')} de ${FacturacionService.MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`;
    }

    /** Encabezado de la propuesta: logo + título + doble filete de marca. */
    _drawHeaderPropuesta(doc) {
        const NAVY = FacturacionService.NAVY;
        const ORANGE = FacturacionService.ORANGE;
        try {
            doc.image(FacturacionService.LOGO_PATH, 40, 30, { width: 150 });
        } catch (_) { /* el logo es decorativo; si no está, el PDF igual sale */ }

        doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(14)
            .text('PROPUESTA', 300, 38, { width: 255, align: 'right' })
            .fontSize(14).text('TÉCNICO ECONÓMICA', 300, 55, { width: 255, align: 'right' });
        doc.fillColor('#777').font('Helvetica').fontSize(8)
            .text('Medio Ambiente', 300, 76, { width: 255, align: 'right' });

        doc.lineWidth(1.4).strokeColor(NAVY).moveTo(40, 96).lineTo(555, 96).stroke();
        doc.lineWidth(2).strokeColor(ORANGE).moveTo(40, 99.5).lineTo(555, 99.5).stroke();
        doc.lineWidth(1).fillColor('#000');
        return 112;
    }

    /** Bloque "Código Propuesta / Señores / RUT / Dirección / Fecha / Atención". */
    _drawDatosPropuesta(doc, y, datos) {
        const fila = (etiqueta, valor) => {
            doc.font('Helvetica-Bold').fontSize(9).fillColor(FacturacionService.NAVY)
                .text(etiqueta, 40, y, { width: 110, lineBreak: false });
            doc.font('Helvetica').fontSize(9).fillColor('#000')
                .text(`: ${valor || '—'}`, 150, y, { width: 405 });
            y = doc.y + 3;
        };
        fila('Código Propuesta', datos.codigo);
        fila('Señores', datos.cliente);
        fila('RUT', datos.rut);
        fila('Dirección', datos.direccion);
        fila('Fecha', datos.fecha);
        if (datos.atencion) fila('Atención', datos.atencion);
        return y + 8;
    }

    /** Título de sección numerada ("1. SERVICIO ...", "2. ANTECEDENTES ..."). */
    _drawSeccion(doc, y, texto) {
        doc.font('Helvetica-Bold').fontSize(10).fillColor(FacturacionService.NAVY)
            .text(texto, 40, y, { width: 515 });
        doc.fillColor('#000');
        return doc.y + 8;
    }

    /** Lista de párrafos con viñeta/letra, con salto de página automático. */
    _drawLista(doc, y, items, tipo = 'letra') {
        doc.font('Helvetica').fontSize(8.5).fillColor('#000');
        items.forEach((txt, i) => {
            const marca = tipo === 'letra' ? `${String.fromCharCode(97 + i)}.` : '•';
            const alto = doc.heightOfString(txt, { width: 495 });
            if (y + alto > 740) { doc.addPage(); y = 50; }
            doc.font('Helvetica-Bold').text(marca, 46, y, { width: 14, lineBreak: false });
            doc.font('Helvetica').text(txt, 62, y, { width: 493, align: 'justify' });
            y = doc.y + 7;
        });
        return y;
    }

    /**
     * PDF de la cotización con el formato real de Propuesta Técnico Económica.
     * Los datos del cliente (RUT/dirección/contacto) salen de getClienteConfig,
     * que ya hace COALESCE con mae_empresaservicios.
     */
    async generarPdfCotizacion(idCotizacion) {
        const cot = await this.getCotizacionDetalle(idCotizacion);
        if (!cot) throw new Error('Cotización no encontrada.');

        let cliente = {};
        try { cliente = await this.getClienteConfig(cot.id_empresaservicio) || {}; } catch { /* sigue sin datos extra */ }

        const fechaEmision = cot.fecha_creacion ? new Date(cot.fecha_creacion) : new Date();
        const ddmmyyyy = `${String(fechaEmision.getDate()).padStart(2, '0')}${String(fechaEmision.getMonth() + 1).padStart(2, '0')}${fechaEmision.getFullYear()}`;
        const nombreCliente = cot.nombre_empresaservicios || cliente.razon_social || 'Cliente';
        const codigo = `MA-P${cot.numero_cotizacion}-${ddmmyyyy}-${nombreCliente.toUpperCase()}`;

        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
        const buffers = [];
        return new Promise((resolve, reject) => {
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));
            doc.on('error', reject);
            try {
                let y = this._drawHeaderPropuesta(doc);
                // getClienteConfig devuelve los campos ya normalizados como
                // rut/razon_social/direccion/contacto (COALESCE con mae_empresaservicios).
                y = this._drawDatosPropuesta(doc, y, {
                    codigo,
                    cliente: nombreCliente,
                    rut: (cliente.rut || '').trim(),
                    direccion: (cliente.direccion || '').trim(),
                    fecha: this._fechaLarga(fechaEmision),
                    atencion: (cliente.contacto || '').trim(),
                });

                // Un servicio por sección, numerado, cada uno con su tabla y su
                // subtotal — igual que la propuesta en Word, que trae varios.
                const seccionesPdf = cot.secciones?.length
                    ? cot.secciones
                    : [{ titulo: cot.glosa || 'SERVICIO DE MUESTREO Y ANÁLISIS', items: cot.items, subtotal_uf: cot.subtotal_uf }];

                seccionesPdf.forEach((sec, idx) => {
                    if (y > 640) { doc.addPage(); y = 50; }
                    y = this._drawSeccion(doc, y + 4, `${idx + 1}. ${(sec.titulo || '').toUpperCase()}`);
                    y = this._drawColHeaders(doc, y, [
                        { label: 'ÍTEM', x: 46, width: 265 },
                        { label: 'Valor Neto Unitario (UF)', x: 315, width: 95, align: 'right' },
                        { label: 'N° Muestras', x: 415, width: 60, align: 'right' },
                        { label: 'Valor Neto (UF)', x: 480, width: 70, align: 'right' },
                    ]);
                    doc.font('Helvetica').fontSize(8.5);
                    for (const it of (sec.items || [])) {
                        const desc = it.descripcion || `Técnica #${it.id_tecnica}`;
                        const alto = Math.max(doc.heightOfString(desc, { width: 265 }), 11);
                        if (y + alto > 700) { doc.addPage(); y = 50; }
                        doc.fillColor('#000')
                            .text(desc, 46, y, { width: 265 })
                            .text(it.precio_unitario_uf == null ? 'Sin tarifa' : fmtUf(it.precio_unitario_uf), 315, y, { width: 95, align: 'right' })
                            .text(String(it.cantidad), 415, y, { width: 60, align: 'right' })
                            .text(it.precio_total_uf == null ? '—' : fmtUf(it.precio_total_uf), 480, y, { width: 70, align: 'right' });
                        y += alto + 4;
                    }
                    // Subtotal por servicio: solo tiene sentido si hay más de uno.
                    if (seccionesPdf.length > 1) {
                        doc.lineWidth(0.5).strokeColor('#ccc').moveTo(315, y + 2).lineTo(555, y + 2).stroke();
                        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(FacturacionService.NAVY)
                            .text('Subtotal servicio U.F.:', 315, y + 6, { width: 155, align: 'right' })
                            .text(fmtUf(sec.subtotal_uf), 480, y + 6, { width: 70, align: 'right' });
                        doc.fillColor('#000');
                        y += 22;
                    }
                    y += 6;
                });

                y += 8;
                if (y > 620) { doc.addPage(); y = 50; }
                y = this._drawTotales(doc, {
                    subtotal_uf: cot.subtotal_uf, descuento_uf: 0, ingreso_uf: 0,
                    total_uf: cot.total_uf, neto_clp: cot.neto_clp, iva_clp: cot.iva_clp, total_clp: cot.total_clp,
                }, y);
                doc.font('Helvetica-Oblique').fontSize(7.5).fillColor('#777')
                    .text(`Valores expresados en UF. Conversión referencial con UF de $ ${fmtUfValor(cot.valor_uf)} a la fecha de emisión; se factura con la UF del día de facturación.`, 40, y + 6, { width: 515 });
                doc.fillColor('#000');
                y = doc.y + 14;

                // Los bloques fijos siguen la numeración de los servicios: con
                // dos servicios son el 3 y el 4, no siempre el 2 y el 3.
                const nFijo = seccionesPdf.length;

                // Antecedentes generales
                if (y > 620) { doc.addPage(); y = 50; }
                y = this._drawSeccion(doc, y, `${nFijo + 1}. ANTECEDENTES GENERALES`);
                y = this._drawLista(doc, y, FacturacionService.ANTECEDENTES_GENERALES, 'letra');

                // Condiciones generales del servicio
                if (y > 620) { doc.addPage(); y = 50; }
                y = this._drawSeccion(doc, y + 6, `${nFijo + 2}. CONDICIONES GENERALES DEL SERVICIO`);

                const E = FacturacionService.EMPRESA_ADL;
                const subtitulo = (txt) => {
                    if (y > 720) { doc.addPage(); y = 50; }
                    doc.font('Helvetica-Bold').fontSize(9).fillColor('#000').text(txt, 46, y, { width: 509 });
                    y = doc.y + 4;
                };
                const parrafo = (txt) => {
                    const alto = doc.heightOfString(txt, { width: 509 });
                    if (y + alto > 740) { doc.addPage(); y = 50; }
                    doc.font('Helvetica').fontSize(8.5).fillColor('#000').text(txt, 46, y, { width: 509, align: 'justify' });
                    y = doc.y + 8;
                };

                subtitulo('a. VALIDEZ DE LA PROPUESTA');
                parrafo(`La presente cotización tiene una validez de ${cot.fecha_vigencia ? `${Math.max(1, Math.round((new Date(cot.fecha_vigencia) - fechaEmision) / 86400000))} días` : '30 días'} a partir de la fecha de emisión.`);

                subtitulo('b. DATOS EMPRESA');
                parrafo(`Nombre: ${E.nombre}\nRut: ${E.rut}\nGiro: ${E.giro}\nDirección: ${E.direccion}\n${E.banco}`);

                subtitulo('c. CONDICIONES DE PAGO');
                parrafo('El pago se realizará a 30 días, con valor de UF al día de facturación y previa emisión de la respectiva Orden de Compra a nombre de ADL Diagnostic Chile SpA.');

                subtitulo('d. NOTAS IMPORTANTES DEL SERVICIO');
                y = this._drawLista(doc, y, FacturacionService.NOTAS_IMPORTANTES, 'vineta');

                if (cot.observaciones) {
                    if (y > 660) { doc.addPage(); y = 50; }
                    subtitulo('e. OBSERVACIONES');
                    parrafo(cot.observaciones);
                }

                // Firma
                if (y > 640) { doc.addPage(); y = 50; }
                y += 16;
                doc.font('Helvetica').fontSize(9).fillColor('#000').text('Atentamente,', 46, y);
                y = doc.y + 46;
                doc.lineWidth(0.5).strokeColor('#999').moveTo(46, y).lineTo(226, y).stroke();
                doc.font('Helvetica-Bold').fontSize(9).fillColor(FacturacionService.NAVY)
                    .text('Jefe Comercial Medio Ambiente', 46, y + 6, { width: 260 });
                doc.font('Helvetica').fontSize(8.5).fillColor('#000')
                    .text(FacturacionService.EMPRESA_ADL.nombre, 46, doc.y + 1, { width: 260 });

                this._drawFooters(doc);
                doc.end();
            } catch (e) { reject(e); }
        });
    }

    /**
     * Publica una cotización ya armada: genera el PDF, lo sube a WebClientesV2
     * (mismo endpoint /api/v1/ingesta que las pre-facturas, área MAM), y si
     * vino de una solicitud del portal, avisa de vuelta vía
     * /api/v1/cotizaciones/respuesta para que el cliente la vea como COTIZADA.
     * Requiere WEBCLIENTES_API_URL / WEBCLIENTES_API_KEY en .env.
     */
    async publicarCotizacionEnPortal(idCotizacion, idUsuario) {
        const cot = await this.getCotizacionDetalle(idCotizacion);
        if (!cot) throw new Error('Cotización no encontrada.');
        // No se le puede mandar al cliente una propuesta con líneas en "Sin
        // tarifa": hay que ponerles precio a mano antes de enviarla.
        const sinTarifa = (cot.items || []).filter((i) => i.precio_unitario_uf == null);
        if (sinTarifa.length > 0) {
            const nombres = sinTarifa.map((i) => i.descripcion || `Técnica ${i.id_tecnica}`).join(', ');
            throw new Error(`Hay ${sinTarifa.length} ítem(s) sin precio (${nombres}). Asígnales un valor en UF antes de enviar la cotización.`);
        }
        if (!process.env.WEBCLIENTES_API_URL || !process.env.WEBCLIENTES_API_KEY) {
            throw new Error('WEBCLIENTES_API_URL / WEBCLIENTES_API_KEY no están configuradas en .env.');
        }

        const pool = await getConnection();
        const cfgReq = pool.request();
        cfgReq.input('idEmpresaServicio', sql.Numeric(10, 0), cot.id_empresaservicio);
        const cfgRes = await cfgReq.query(`SELECT portal_cliente_codigo, portal_sede_codigo FROM fac_cliente_config WHERE id_empresaservicio = @idEmpresaServicio`);
        const cfg = cfgRes.recordset[0];
        if (!cfg?.portal_cliente_codigo) {
            throw new Error(`Cotización #${cot.numero_cotizacion}: falta configurar portal_cliente_codigo en fac_cliente_config para publicarla en ADL WEB GO.`);
        }

        const pdfBuffer = await this.generarPdfCotizacion(idCotizacion);
        const form = new FormData();
        form.append('cliente_codigo', cfg.portal_cliente_codigo);
        if (cfg.portal_sede_codigo) form.append('sede_codigo', cfg.portal_sede_codigo);
        form.append('area_codigo', 'MAM');
        form.append('fecha_informe', new Date().toISOString().slice(0, 10));
        form.append('nombre_visible', `Cotización N° ${cot.numero_cotizacion} - ${cot.nombre_empresaservicios || ''}`);
        form.append('referencia_externa', `COT-${cot.numero_cotizacion}`);
        form.append('archivo', new Blob([pdfBuffer], { type: 'application/pdf' }), `COT_${cot.numero_cotizacion}.pdf`);

        const respIngesta = await fetch(`${process.env.WEBCLIENTES_API_URL}/api/v1/ingesta`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}` },
            body: form,
            signal: AbortSignal.timeout(15000),
        });
        if (!respIngesta.ok) {
            const texto = await respIngesta.text().catch(() => '');
            throw new Error(`ADL WEB GO (ingesta) respondió ${respIngesta.status}: ${texto}`);
        }

        // Si vino de una solicitud del portal, avisar de vuelta para que pase a COTIZADA.
        if (cot.referencia_externa_portal) {
            const respCallback = await fetch(`${process.env.WEBCLIENTES_API_URL}/api/v1/cotizaciones/respuesta`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ referencia_externa: cot.referencia_externa_portal, numero_cotizacion: cot.numero_cotizacion }),
                signal: AbortSignal.timeout(15000),
            });
            if (!respCallback.ok) {
                const texto = await respCallback.text().catch(() => '');
                logger.error(`[Cotizaciones-Portal] El PDF se publicó pero el callback de respuesta falló (${respCallback.status}): ${texto}`);
                // No se relanza: el documento YA está publicado y visible en el portal
                // (notificacion_pendiente genérica de WebClientesV2 avisará igual); solo
                // no quedó marcada como COTIZADA con este mecanismo específico.
            }
        }

        await pool.request()
            .input('id', sql.Int, idCotizacion)
            // Enviar al cliente es también la transición BORRADOR → ENVIADA: el estado
            // de la cotización tiene que reflejar que el cliente ya la tiene, si no la
            // bandeja unificada la sigue mostrando como "en preparación" para siempre.
            .query(`UPDATE fac_cotizacion
                    SET portal_publicado = 1, fecha_portal_publicado = GETDATE(), fecha_modificacion = GETDATE(),
                        estado = CASE WHEN estado = 'BORRADOR' THEN 'ENVIADA' ELSE estado END
                    WHERE id_cotizacion = @id`);

        logger.info(`[Cotizaciones-Portal] Cotización #${cot.numero_cotizacion} enviada al cliente por usuario ${idUsuario || '—'}.`);
        return { publicado: true };
    }

    /**
     * Lee el chat de una solicitud/cotización desde ADL WEB GO (fuente real
     * de verdad del hilo — ADL ONE no guarda mensajes propios, solo los
     * muestra). El chat vive en la SOLICITUD del cliente (COTSOL-<id>) desde
     * que llega, no en la cotización de ADL ONE — así que no hace falta
     * haber armado la cotización todavía para poder conversar con el cliente.
     */
    async _mensajesPortalGet(referenciaExterna) {
        if (!referenciaExterna) return [];
        if (!process.env.WEBCLIENTES_API_URL || !process.env.WEBCLIENTES_API_KEY) {
            throw new Error('WEBCLIENTES_API_URL / WEBCLIENTES_API_KEY no están configuradas en .env.');
        }
        const resp = await fetch(`${process.env.WEBCLIENTES_API_URL}/api/v1/cotizaciones/${referenciaExterna}/mensajes`, {
            headers: { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) {
            const texto = await resp.text().catch(() => '');
            throw new Error(`ADL WEB GO (mensajes) respondió ${resp.status}: ${texto}`);
        }
        return resp.json();
    }

    /**
     * Publica un mensaje de staff ADL ONE en el chat, que el cliente ve en
     * su portal. Se atribuye allá al usuario de servicio "Facturación ADL
     * ONE" (no hay sesión de WebClientesV2 por-persona acá).
     */
    async _mensajesPortalPost(referenciaExterna, mensaje, autor = {}, archivos = []) {
        if (!referenciaExterna) throw new Error('Esta solicitud no está vinculada al portal.');
        if (!process.env.WEBCLIENTES_API_URL || !process.env.WEBCLIENTES_API_KEY) {
            throw new Error('WEBCLIENTES_API_URL / WEBCLIENTES_API_KEY no están configuradas en .env.');
        }
        const url = `${process.env.WEBCLIENTES_API_URL}/api/v1/cotizaciones/${referenciaExterna}/mensajes`;
        const headers = { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}` };

        let body;
        if (archivos.length > 0) {
            // Con archivos va como multipart; el endpoint del portal acepta ambos.
            const form = new FormData();
            form.append('mensaje', mensaje);
            if (autor.nombre) form.append('autor_nombre', autor.nombre);
            if (autor.email) form.append('autor_email', autor.email);
            for (const f of archivos) {
                form.append('archivos', new Blob([f.buffer], { type: f.mimetype || 'application/octet-stream' }), f.originalname);
            }
            body = form;
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({ mensaje, autor_nombre: autor.nombre, autor_email: autor.email });
        }

        const resp = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(30000) });
        if (!resp.ok) {
            const texto = await resp.text().catch(() => '');
            throw new Error(`ADL WEB GO (mensajes) respondió ${resp.status}: ${texto}`);
        }
        return resp.json();
    }

    /** Archivos adjuntos de la conversación (los del cliente y los que subió ADL ONE). */
    async _adjuntosPortalGet(referenciaExterna) {
        if (!referenciaExterna) return [];
        if (!process.env.WEBCLIENTES_API_URL || !process.env.WEBCLIENTES_API_KEY) {
            throw new Error('WEBCLIENTES_API_URL / WEBCLIENTES_API_KEY no están configuradas en .env.');
        }
        const resp = await fetch(`${process.env.WEBCLIENTES_API_URL}/api/v1/cotizaciones/${referenciaExterna}/adjuntos`, {
            headers: { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}` },
            signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) {
            const texto = await resp.text().catch(() => '');
            throw new Error(`ADL WEB GO (adjuntos) respondió ${resp.status}: ${texto}`);
        }
        return resp.json();
    }

    /** Descarga el contenido de un adjunto del portal para reenviarlo al navegador. */
    async _adjuntoPortalDescargar(referenciaExterna, idAdjunto) {
        if (!process.env.WEBCLIENTES_API_URL || !process.env.WEBCLIENTES_API_KEY) {
            throw new Error('WEBCLIENTES_API_URL / WEBCLIENTES_API_KEY no están configuradas en .env.');
        }
        const resp = await fetch(`${process.env.WEBCLIENTES_API_URL}/api/v1/cotizaciones/${referenciaExterna}/adjuntos/${idAdjunto}`, {
            headers: { Authorization: `Bearer ${process.env.WEBCLIENTES_API_KEY}` },
            signal: AbortSignal.timeout(30000),
        });
        if (!resp.ok) {
            const texto = await resp.text().catch(() => '');
            throw new Error(`ADL WEB GO (adjunto) respondió ${resp.status}: ${texto}`);
        }
        return {
            buffer: Buffer.from(await resp.arrayBuffer()),
            mime: resp.headers.get('content-type') || 'application/octet-stream',
            disposition: resp.headers.get('content-disposition') || '',
        };
    }

    async _referenciaDeSolicitud(idSolicitudPortal) {
        const pool = await getConnection();
        const row = (await pool.request()
            .input('id', sql.Int, idSolicitudPortal)
            .query(`SELECT referencia_externa FROM fac_cotizacion_portal_solicitud WHERE id_solicitud_portal = @id`)).recordset[0];
        if (!row) throw new Error('Solicitud del portal no encontrada.');
        return row.referencia_externa;
    }

    async listarAdjuntosSolicitudPortal(idSolicitudPortal) {
        return this._adjuntosPortalGet(await this._referenciaDeSolicitud(idSolicitudPortal));
    }

    async descargarAdjuntoSolicitudPortal(idSolicitudPortal, idAdjunto) {
        return this._adjuntoPortalDescargar(await this._referenciaDeSolicitud(idSolicitudPortal), idAdjunto);
    }

    /** Chat de una cotización YA creada en ADL ONE (usa su referencia_externa_portal). */
    async listarMensajesCotizacionPortal(idCotizacion) {
        const cot = await this.getCotizacionDetalle(idCotizacion);
        if (!cot) throw new Error('Cotización no encontrada.');
        return this._mensajesPortalGet(cot.referencia_externa_portal);
    }

    async enviarMensajeCotizacionPortal(idCotizacion, mensaje) {
        const cot = await this.getCotizacionDetalle(idCotizacion);
        if (!cot) throw new Error('Cotización no encontrada.');
        const r = await this._mensajesPortalPost(cot.referencia_externa_portal, mensaje);
        await this._actualizarCacheMensajeLocal(cot.referencia_externa_portal, mensaje);
        return r;
    }

    /**
     * Chat de una SOLICITUD del portal aún sin cotización creada en ADL ONE
     * — para poder responder/pedir detalles al cliente desde la Bandeja
     * antes de armar la cotización real.
     */
    async listarMensajesSolicitudPortal(idSolicitudPortal) {
        const pool = await getConnection();
        const req = pool.request();
        req.input('id', sql.Int, idSolicitudPortal);
        const row = (await req.query(`SELECT referencia_externa FROM fac_cotizacion_portal_solicitud WHERE id_solicitud_portal = @id`)).recordset[0];
        if (!row) throw new Error('Solicitud del portal no encontrada.');
        return this._mensajesPortalGet(row.referencia_externa);
    }

    async enviarMensajeSolicitudPortal(idSolicitudPortal, mensaje, autor = {}, archivos = []) {
        const referencia = await this._referenciaDeSolicitud(idSolicitudPortal);
        const r = await this._mensajesPortalPost(referencia, mensaje, autor, archivos);
        await this._actualizarCacheMensajeLocal(referencia, mensaje);
        return r;
    }

    // ------------------------------------------------------------------
    // FASE 7 — Bandeja de OCs (intake asistido, respaldo del portal)
    //
    // Diseño en dos capas, para no fingir automatización que no existe:
    //   1) LO QUE FUNCIONA HOY sin credenciales nuevas: alguien arrastra el
    //      PDF de la OC que llegó por correo → queda un candidato pendiente
    //      de confirmar con 1 click. Ya reemplaza "buscar y tipear" por
    //      "adjuntar y revisar".
    //   2) LO QUE SE ENCHUFA DESPUÉS sin tocar el modelo de datos: un
    //      conector de buzón (Microsoft Graph — rastrea respuestas por
    //      In-Reply-To contra fac_prefactura.email_message_id, no escanea
    //      todo el buzón) que llama automáticamente a crearCandidatoOc(), y
    //      extraerDatosOcDePdf() con visión (Claude) en vez de null. Ninguna
    //      de las dos tiene credenciales configuradas todavía — ver el error
    //      explícito más abajo en vez de una simulación.
    // ------------------------------------------------------------------

    /**
     * Intenta extraer {numeroOc, fechaOc, numeroHes, fechaHes, monto} del PDF
     * de una OC usando un modelo con visión. NO implementado aún: requiere
     * ANTHROPIC_API_KEY + @anthropic-ai/sdk (ninguno presente en este
     * proyecto hoy). Devuelve null (no lanza) para que crearCandidatoOc
     * siga funcionando en modo manual mientras tanto — este es el único
     * punto que hay que completar cuando haya API key.
     */
    async extraerDatosOcDePdf(_pdfBuffer) {
        if (!process.env.ANTHROPIC_API_KEY) {
            logger.debug('[BandejaOC] Extracción por visión no configurada (falta ANTHROPIC_API_KEY) — candidato queda para revisión manual.');
            return null;
        }
        // TODO: cuando exista la API key, llamar al modelo con el PDF/imagen
        // y parsear una respuesta estructurada {numeroOc, fechaOc, numeroHes,
        // fechaHes, monto, confianza}. Ver diseño acordado: alta confianza
        // (RUT + monto + N° citado coinciden) → tarjeta pre-llenada; baja
        // confianza → igual queda "PENDIENTE_REVISION".
        return null;
    }

    /**
     * Registra un PDF de OC recibido (adjunto de correo, subido a mano, o
     * remitido por el portal) como candidato pendiente de confirmar. Intenta
     * extracción automática; si no hay (o falla), el candidato queda igual,
     * listo para que una persona lo revise y complete en un click.
     */
    /**
     * Guarda el PDF de una OC como candidato pendiente de confirmar.
     *
     * `idPrefactura` puede venir NULL: es la OC ANTICIPADA, la que el cliente
     * manda antes de que exista la pre-factura. En ese caso se guarda contra
     * el cliente (idEmpresaServicio) y espera ahí hasta que haya una
     * pre-factura contra la cual confirmarla. Antes esto no tenía dónde caer y
     * la OC se quedaba en el correo de alguien.
     */
    async crearCandidatoOc(idPrefactura, archivoBuffer, nombreArchivoOriginal, origen, idUsuario, idEmpresaServicio = null) {
        let pf = null;
        if (idPrefactura) {
            pf = await this.getPrefacturaDetalle(idPrefactura);
            if (!pf) throw new Error('Pre-factura no encontrada.');
            idEmpresaServicio = pf.id_empresaservicio;
        } else if (!idEmpresaServicio) {
            throw new Error('Indica la pre-factura o, si todavía no existe, el cliente al que corresponde la OC.');
        }

        // Sin pre-factura el archivo se guarda bajo el cliente, no bajo un
        // número de pre-factura que aún no existe.
        const carpeta = pf ? String(pf.numero_id) : `cliente_${idEmpresaServicio}`;
        const dir = path.join(UPLOAD_PATH, 'facturacion', carpeta, 'oc_candidatos');
        fs.mkdirSync(dir, { recursive: true });
        const nombreSeguro = `${Date.now()}_${(nombreArchivoOriginal || 'oc.pdf').replace(/[^\w.\-]/g, '_')}`;
        const archivoPath = path.join(dir, nombreSeguro);
        fs.writeFileSync(archivoPath, archivoBuffer);
        const relPath = `/uploads/facturacion/${carpeta}/oc_candidatos/${nombreSeguro}`;

        let extraccion = null;
        try {
            extraccion = await this.extraerDatosOcDePdf(archivoBuffer);
        } catch (e) {
            logger.warn('[BandejaOC] Extracción falló, queda para revisión manual:', e.message);
        }

        const pool = await getConnection();
        const req = pool.request();
        req.input('idPrefactura', sql.Int, idPrefactura);
        req.input('origen', sql.VarChar(20), origen || 'MANUAL');
        req.input('archivoPath', sql.VarChar(500), relPath);
        req.input('numeroOc', sql.VarChar(100), extraccion?.numeroOc || null);
        req.input('fechaOc', sql.Date, extraccion?.fechaOc || null);
        req.input('numeroHes', sql.VarChar(100), extraccion?.numeroHes || null);
        req.input('fechaHes', sql.Date, extraccion?.fechaHes || null);
        req.input('monto', sql.Decimal(18, 2), extraccion?.monto || null);
        req.input('confianza', sql.VarChar(10), extraccion?.confianza || null);
        req.input('metodo', sql.VarChar(30), extraccion ? 'VISION_IA' : null);
        req.input('idUsuario', sql.Int, idUsuario || null);
        req.input('idEmpresaServicio', sql.Numeric(10, 0), idEmpresaServicio || null);
        const result = await req.query(`
            INSERT INTO fac_oc_candidato (
                id_prefactura, id_empresaservicio, origen, archivo_path,
                numero_oc_sugerido, fecha_oc_sugerida, numero_hes_sugerido, fecha_hes_sugerida,
                monto_sugerido, confianza, metodo_extraccion, id_usuario
            )
            OUTPUT inserted.id_candidato
            VALUES (
                @idPrefactura, @idEmpresaServicio, @origen, @archivoPath,
                @numeroOc, @fechaOc, @numeroHes, @fechaHes,
                @monto, @confianza, @metodo, @idUsuario
            )
        `);

        return {
            id_candidato: result.recordset[0].id_candidato,
            extraido: !!extraccion,
            archivo_path: relPath,
            anticipada: !idPrefactura,
        };
    }

    /** Candidatos pendientes de revisión (para la bandeja). */
    async listarCandidatosOc(filtros = {}) {
        const pool = await getConnection();
        const request = pool.request();
        const condiciones = ["c.estado = 'PENDIENTE_REVISION'"];
        if (filtros.idPrefactura) {
            request.input('idPrefactura', sql.Int, filtros.idPrefactura);
            condiciones.push('c.id_prefactura = @idPrefactura');
        }
        // LEFT JOIN a pre-factura: las OC anticipadas todavía no tienen una, y
        // con el JOIN interno desaparecían del listado sin dejar rastro.
        const result = await request.query(`
            SELECT c.*, p.numero_id,
                   COALESCE(p.id_empresaservicio, c.id_empresaservicio) AS id_empresaservicio,
                   es.nombre_empresaservicios,
                   CASE WHEN c.id_prefactura IS NULL THEN 1 ELSE 0 END AS anticipada,
                   (SELECT COUNT(*) FROM fac_prefactura pf
                     WHERE pf.id_empresaservicio = COALESCE(p.id_empresaservicio, c.id_empresaservicio)
                       AND pf.estado IN ('BORRADOR','PDF_GENERADO','ENVIADA','PENDIENTE_OC')) AS prefacturas_disponibles
            FROM fac_oc_candidato c
            LEFT JOIN fac_prefactura p ON p.id_prefactura = c.id_prefactura
            LEFT JOIN mae_empresaservicios es
                   ON es.id_empresaservicio = COALESCE(p.id_empresaservicio, c.id_empresaservicio)
            WHERE ${condiciones.join(' AND ')}
            ORDER BY c.fecha_creacion DESC
        `);
        return result.recordset;
    }

    /**
     * Confirma un candidato con 1 click: toma los datos (posiblemente
     * corregidos a mano) y los registra como una OC real vía
     * registrarOrdenCompra — mismo camino que si se hubiera tecleado a mano.
     */
    async confirmarCandidatoOc(idCandidato, datosFinales, idUsuario) {
        const pool = await getConnection();
        const candReq = pool.request();
        candReq.input('id', sql.Int, idCandidato);
        const candRes = await candReq.query('SELECT * FROM fac_oc_candidato WHERE id_candidato = @id');
        const candidato = candRes.recordset[0];
        if (!candidato) throw new Error('Candidato no encontrado.');
        if (candidato.estado !== 'PENDIENTE_REVISION') throw new Error(`Candidato ya fue ${candidato.estado.toLowerCase()}.`);

        const datos = {
            numeroOc: datosFinales?.numeroOc || candidato.numero_oc_sugerido,
            fechaOc: datosFinales?.fechaOc || candidato.fecha_oc_sugerida,
            numeroHes: datosFinales?.numeroHes || candidato.numero_hes_sugerido,
            fechaHes: datosFinales?.fechaHes || candidato.fecha_hes_sugerida,
            referencia: `Confirmado desde candidato #${idCandidato} (${candidato.archivo_path})`,
        };
        if (!datos.numeroOc) throw new Error('numeroOc es requerido para confirmar.');

        // Una OC anticipada no tiene pre-factura todavía: al confirmarla hay
        // que decir contra cuál se aplica.
        const idPrefactura = candidato.id_prefactura || datosFinales?.idPrefactura;
        if (!idPrefactura) {
            throw new Error('Esta OC se cargó antes de que existiera la pre-factura: indica contra cuál se aplica.');
        }
        if (!candidato.id_prefactura) {
            const destino = await this.getPrefacturaDetalle(idPrefactura);
            if (!destino) throw new Error('La pre-factura indicada no existe.');
            if (Number(destino.id_empresaservicio) !== Number(candidato.id_empresaservicio)) {
                throw new Error('Esa pre-factura es de otro cliente: la OC no corresponde.');
            }
            await pool.request()
                .input('id', sql.Int, idCandidato).input('pf', sql.Int, idPrefactura)
                .query('UPDATE fac_oc_candidato SET id_prefactura = @pf WHERE id_candidato = @id');
        }

        const oc = await this.registrarOrdenCompra(idPrefactura, datos, idUsuario);

        const upReq = pool.request();
        upReq.input('id', sql.Int, idCandidato);
        upReq.input('idUsuario', sql.Int, idUsuario || null);
        await upReq.query(`
            UPDATE fac_oc_candidato
            SET estado = 'CONFIRMADO', fecha_resolucion = GETDATE(), id_usuario = @idUsuario
            WHERE id_candidato = @id
        `);

        return oc;
    }

    /** Descarta un candidato (no era una OC válida, duplicado, etc.). */
    async descartarCandidatoOc(idCandidato, idUsuario) {
        const pool = await getConnection();
        const req = pool.request();
        req.input('id', sql.Int, idCandidato);
        req.input('idUsuario', sql.Int, idUsuario || null);
        await req.query(`
            UPDATE fac_oc_candidato
            SET estado = 'DESCARTADO', fecha_resolucion = GETDATE(), id_usuario = @idUsuario
            WHERE id_candidato = @id AND estado = 'PENDIENTE_REVISION'
        `);
        return { descartado: true };
    }

    // ------------------------------------------------------------------
    // FASE 8 — Estado de cuenta (SIN pago en línea, a propósito)
    //
    // adl_facturacion.dbo.ventas.facturada se verificó contra datos reales:
    // 35.267 filas con folio, 2016-2026, TODAS en 0 — no es una señal de
    // pago utilizable. No hay fuente automática de "pagado" a la que ADL
    // ONE tenga acceso. Este módulo muestra el historial de emisión (que sí
    // es confiable) y un marcado MANUAL de pago — nada de Webpay/Transbank
    // todavía, por decisión explícita (integrar un gateway de pago sin
    // entenderlo bien primero es un riesgo real).
    // ------------------------------------------------------------------

    /** Estado de cuenta de un cliente: facturas emitidas + antigüedad de emisión. */
    async getEstadoCuenta(idEmpresaServicio) {
        const pool = await getConnection();
        const req = pool.request();
        req.input('idEmpresaServicio', sql.Numeric(10, 0), idEmpresaServicio);
        const result = await req.query(`
            SELECT
                e.id_emision, e.folio_sii, e.tipo_documento, e.fecha_emision,
                e.monto_neto, e.iva, e.monto_total,
                e.pagada, e.fecha_pago,
                p.id_prefactura, p.numero_id,
                DATEDIFF(day, e.fecha_emision, GETDATE()) AS dias_desde_emision
            FROM fac_emision e
            JOIN fac_prefactura p ON p.id_prefactura = e.id_prefactura
            WHERE p.id_empresaservicio = @idEmpresaServicio
              AND e.estado = 'FOLIO_REGISTRADO'
            ORDER BY e.fecha_emision DESC
        `);

        const facturas = result.recordset;
        const pendientes = facturas.filter(f => !f.pagada);
        return {
            facturas,
            resumen: {
                total_facturado: facturas.reduce((s, f) => s + Number(f.monto_total), 0),
                total_sin_marcar_pago: pendientes.reduce((s, f) => s + Number(f.monto_total), 0),
                cantidad_sin_marcar_pago: pendientes.length,
            },
        };
    }

    /** Marca una factura como pagada (acción MANUAL — no hay fuente automática). */
    async marcarFacturaPagada(idEmision, fechaPago, idUsuario) {
        const pool = await getConnection();
        const req = pool.request();
        req.input('id', sql.Int, idEmision);
        req.input('fechaPago', sql.Date, fechaPago || new Date());
        req.input('idUsuario', sql.Int, idUsuario || null);
        const result = await req.query(`
            UPDATE fac_emision
            SET pagada = 1, fecha_pago = @fechaPago, id_usuario_pago = @idUsuario, fecha_modificacion = GETDATE()
            OUTPUT inserted.id_emision, inserted.folio_sii
            WHERE id_emision = @id
        `);
        if (result.recordset.length === 0) throw new Error('Emisión no encontrada.');
        return result.recordset[0];
    }

    /** Tramos de antigüedad de emisión, para el dashboard (todas las facturas sin marcar pago). */
    async getAntiguedadEmision() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT
                CASE
                    WHEN DATEDIFF(day, e.fecha_emision, GETDATE()) <= 30 THEN '0-30'
                    WHEN DATEDIFF(day, e.fecha_emision, GETDATE()) <= 60 THEN '31-60'
                    WHEN DATEDIFF(day, e.fecha_emision, GETDATE()) <= 90 THEN '61-90'
                    ELSE '90+'
                END AS tramo,
                COUNT(*) AS cantidad,
                SUM(e.monto_total) AS monto_total
            FROM fac_emision e
            WHERE e.estado = 'FOLIO_REGISTRADO' AND e.pagada = 0
            GROUP BY CASE
                    WHEN DATEDIFF(day, e.fecha_emision, GETDATE()) <= 30 THEN '0-30'
                    WHEN DATEDIFF(day, e.fecha_emision, GETDATE()) <= 60 THEN '31-60'
                    WHEN DATEDIFF(day, e.fecha_emision, GETDATE()) <= 90 THEN '61-90'
                    ELSE '90+'
                END
        `);
        return result.recordset;
    }

    // ------------------------------------------------------------------
    // FASE 9 — Motor de precios (resolución hacia adelante) + Cotizaciones
    //
    // Hasta aquí, "precio" siempre se LEÍA de fichas ya creadas (DET
    // congelado). Este motor lo RESUELVE desde cero — necesario para cotizar
    // antes de que exista una ficha, y es el mismo mecanismo pensado para
    // auto-rellenar el precio de una ficha nueva (no conectado a
    // ficha.service.js todavía — ver nota al final del archivo).
    //
    // Alcance honesto: la cotización llega hasta ACEPTADA. Convertirla en una
    // ficha real / agendar en ADL SAMPLING requiere contexto operativo
    // (lugar de análisis, objetivo de muestreo, etc.) que no está cubierto
    // acá para no fingir una integración no verificada.
    // ------------------------------------------------------------------

    /**
     * Resuelve el precio UF de una técnica por especificidad: entre todas
     * las tarifas vigentes que calzan (comodines NULL en fac_convenio /
     * fac_tablama), gana la que matchea MÁS dimensiones. Empate → la de
     * vigencia más reciente.
     *
     * @param {Object} p
     * @param {number} p.idTecnica
     * @param {number} [p.idTablama]
     * @param {number} [p.idEmpresaServicio]
     * @param {number} [p.idEmpresa]
     * @param {number} [p.idCentro]
     * @param {Date|string} [p.fecha] - default hoy
     * @returns {Promise<{precioUf:number, idConvenio:number, especificidad:number}|null>} null si no hay tarifa que calce
     */
    async resolverPrecioTecnica(p) {
        const pool = await getConnection();
        const req = pool.request();
        req.input('idTecnica', sql.Numeric(10, 0), p.idTecnica);
        req.input('idTablama', sql.Numeric(10, 0), p.idTablama ?? null);
        req.input('idEmpresaServicio', sql.Numeric(10, 0), p.idEmpresaServicio ?? null);
        req.input('idEmpresa', sql.Numeric(10, 0), p.idEmpresa ?? null);
        req.input('idCentro', sql.Numeric(10, 0), p.idCentro ?? null);
        req.input('fecha', sql.Date, p.fecha || new Date());

        const result = await req.query(`
            SELECT TOP 1
                t.uf_individual, c.id_convenio,
                (CASE WHEN c.id_empresaservicio IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN c.id_empresa IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN c.id_centro IS NOT NULL THEN 1 ELSE 0 END
               + CASE WHEN t.id_tablama IS NOT NULL THEN 1 ELSE 0 END) AS especificidad
            FROM fac_tarifa t
            JOIN fac_convenio c ON c.id_convenio = t.id_convenio
            WHERE t.id_tecnica = @idTecnica
              AND (t.id_tablama IS NULL OR t.id_tablama = @idTablama)
              AND (c.id_empresaservicio IS NULL OR c.id_empresaservicio = @idEmpresaServicio)
              AND (c.id_empresa IS NULL OR c.id_empresa = @idEmpresa)
              AND (c.id_centro IS NULL OR c.id_centro = @idCentro)
              AND ISNULL(c.habilitado, 'S') = 'S'
              AND (c.vigencia_desde IS NULL OR c.vigencia_desde <= @fecha)
              AND (c.vigencia_hasta IS NULL OR c.vigencia_hasta >= @fecha)
              AND (t.vigencia_desde IS NULL OR t.vigencia_desde <= @fecha)
              AND (t.vigencia_hasta IS NULL OR t.vigencia_hasta >= @fecha)
            ORDER BY especificidad DESC, c.vigencia_desde DESC
        `);
        if (result.recordset.length === 0) return null;
        const row = result.recordset[0];
        return { precioUf: Number(row.uf_individual), idConvenio: row.id_convenio, especificidad: row.especificidad };
    }

    /**
     * Tablas MA que tienen tarifa para ese cliente + centro.
     *
     * El precio de un mismo análisis cambia según el centro Y la tabla, y las
     * 13.369 tarifas cargadas están TODAS amarradas a una combinación exacta
     * (ninguna es genérica). Sin elegir tabla, el motor no puede calzar nada:
     * por eso el cotizador la pide en vez de dejarla en blanco.
     *
     * El nombre sale de LaboratorioADL.dbo.mae_tablama; si el usuario de la
     * app no tiene SELECT sobre ese maestro, se devuelve el id igual (la
     * cotización funciona, solo se ve el número en vez del nombre).
     */
    /**
     * Marca como EXPIRADA toda cotización ENVIADA cuya vigencia ya pasó.
     *
     * Solo las ENVIADAS: son las que el cliente tiene en la mano con una fecha
     * de validez impresa en la propuesta. Un BORRADOR vencido nunca se le
     * comunicó a nadie, así que marcarlo "expirado" contaría algo que no pasó.
     *
     * Aceptar una vencida ya estaba bloqueado; esto es para que la bandeja
     * diga la verdad sin que alguien revise fecha por fecha.
     */
    async expirarCotizacionesVencidas() {
        const pool = await getConnection();
        const r = await pool.request().query(`
            UPDATE fac_cotizacion
            SET estado = 'EXPIRADA', fecha_modificacion = GETDATE()
            OUTPUT inserted.id_cotizacion, inserted.numero_cotizacion
            WHERE estado = 'ENVIADA'
              AND fecha_vigencia IS NOT NULL
              AND fecha_vigencia < CAST(GETDATE() AS DATE)
        `);
        if (r.recordset.length > 0) {
            logger.info(`[Cotizaciones] ${r.recordset.length} marcada(s) EXPIRADA: ${r.recordset.map((c) => `N° ${c.numero_cotizacion}`).join(', ')}`);
        }
        return { expiradas: r.recordset.length, cotizaciones: r.recordset };
    }

    async listarTablasDeConvenio(idEmpresaServicio, idCentro) {
        if (!idEmpresaServicio) throw new Error('idEmpresaServicio es requerido.');
        const pool = await getConnection();
        const req = pool.request();
        req.input('es', sql.Numeric(10, 0), idEmpresaServicio);
        req.input('centro', sql.Numeric(10, 0), idCentro || null);
        const result = await req.query(`
            SELECT t.id_tablama, COUNT(*) AS tarifas, MIN(c.id_empresa) AS id_empresa
            FROM fac_convenio c
            JOIN fac_tarifa t ON t.id_convenio = c.id_convenio
            WHERE c.id_empresaservicio = @es
              AND (@centro IS NULL OR c.id_centro = @centro)
              AND ISNULL(c.habilitado, 'S') = 'S'
              AND t.id_tablama IS NOT NULL
            GROUP BY t.id_tablama
            ORDER BY COUNT(*) DESC
        `);
        const tablas = result.recordset;

        // Nombres, si hay permiso sobre el maestro del laboratorio.
        try {
            const ids = tablas.map((t) => Number(t.id_tablama)).filter(Number.isFinite);
            if (ids.length) {
                const nombres = await pool.request().query(`
                    SELECT id_tablama, nombre_tablama FROM LaboratorioADL.dbo.mae_tablama
                    WHERE id_tablama IN (${ids.join(',')})
                `);
                const mapa = new Map(nombres.recordset.map((n) => [Number(n.id_tablama), (n.nombre_tablama || '').trim()]));
                tablas.forEach((t) => { t.nombre_tablama = mapa.get(Number(t.id_tablama)) || null; });
            }
        } catch (e) {
            logger.warn(`[Cotización] Sin acceso a mae_tablama, se muestran solo los ids: ${e.message}`);
        }
        return tablas;
    }

    /** El centro determina la empresa (mae_centro.id_empresa): no se pide aparte. */
    async getEmpresaDeCentro(idCentro) {
        if (!idCentro) return null;
        const pool = await getConnection();
        const r = await pool.request()
            .input('c', sql.Numeric(10, 0), idCentro)
            .query('SELECT id_empresa FROM mae_centro WHERE id_centro = @c');
        return r.recordset[0]?.id_empresa ?? null;
    }

    /**
     * Crea una cotización: por cada técnica pedida, resuelve su precio con
     * el motor y arma el total. Ítems sin tarifa que calce quedan con precio
     * NULL y se reportan aparte — no se inventa un precio.
     *
     * @param {Object} input
     * @param {number} input.idEmpresaServicio
     * @param {number} [input.idEmpresa]
     * @param {number} [input.idCentro]
     * @param {Array<{idTecnica:number, idTablama?:number, descripcion?:string, cantidad?:number}>} input.items
     * @param {string} [input.glosa]
     * @param {number} [input.vigenciaDias] - default 30
     * @param {number} [input.valorUf]
     */
    async crearCotizacion(input, idUsuario) {
        if (!input.idEmpresaServicio) throw new Error('idEmpresaServicio es requerido.');

        // Una propuesta real trae VARIOS servicios, cada uno con su título y su
        // tabla (ver el Word de Medio Ambiente). Se acepta igual el formato
        // antiguo de lista plana: se envuelve en una sección con la glosa.
        const secciones = input.secciones?.length
            ? input.secciones
            : [{ titulo: input.glosa || 'Servicio cotizado', items: input.items || [] }];
        if (!secciones.some((s) => s.items?.length)) throw new Error('Debe incluir al menos un ítem.');

        const pool = await getConnection();
        const valorUf = input.valorUf || await this.resolverValorUf(pool, new Date());

        // Los convenios están amarrados a (empresaservicio, empresa, centro,
        // tabla). La empresa no se pide en pantalla porque el centro ya la
        // determina — sin resolverla acá, el motor no calza ninguna tarifa.
        if (!input.idEmpresa && input.idCentro) {
            input.idEmpresa = await this.getEmpresaDeCentro(input.idCentro);
        }
        // Una tabla a nivel de cotización aplica a todos sus ítems, salvo que
        // el ítem traiga la suya.
        const tablaPorDefecto = input.idTablama || null;

        const sinPrecio = [];
        const seccionesResueltas = [];
        for (const [i, sec] of secciones.entries()) {
            const items = [];
            for (const it of (sec.items || [])) {
                const cantidad = Number(it.cantidad || 1);
                it.idTablama = it.idTablama || tablaPorDefecto;

                // Precio puesto a mano: manda sobre el motor. Es lo que permite
                // cobrar "Gastos de Traslado" y arreglar un análisis cuyo
                // convenio no cubre esta combinación cliente+centro+tabla.
                if (it.precioManual && it.precioUf != null) {
                    items.push({ ...it, cantidad, precioUf: Number(it.precioUf), idConvenio: null, especificidad: null, precioManual: true });
                    continue;
                }
                // Línea libre sin técnica (no está en el catálogo) y sin precio:
                // no hay nada que resolver, queda sin tarifa a la espera de una.
                if (!it.idTecnica) {
                    sinPrecio.push(it.descripcion || 'Línea sin técnica');
                    items.push({ ...it, cantidad, precioUf: null, idConvenio: null, especificidad: null, precioManual: false });
                    continue;
                }
                const precio = await this.resolverPrecioTecnica({
                    idTecnica: it.idTecnica, idTablama: it.idTablama,
                    idEmpresaServicio: input.idEmpresaServicio, idEmpresa: input.idEmpresa, idCentro: input.idCentro,
                });
                if (!precio) {
                    sinPrecio.push(it.descripcion || `Técnica ${it.idTecnica}`);
                    items.push({ ...it, cantidad, precioUf: null, idConvenio: null, especificidad: null, precioManual: false });
                } else {
                    items.push({ ...it, cantidad, precioUf: precio.precioUf, idConvenio: precio.idConvenio, especificidad: precio.especificidad, precioManual: false });
                }
            }
            seccionesResueltas.push({
                titulo: (sec.titulo || `Servicio ${i + 1}`).slice(0, 500),
                orden: i + 1,
                items,
                subtotal: items.reduce((s, it) => s + (it.precioUf || 0) * it.cantidad, 0),
            });
        }

        const itemsResueltos = seccionesResueltas.flatMap((s) => s.items);
        const subtotalUf = itemsResueltos.reduce((s, it) => s + (it.precioUf || 0) * it.cantidad, 0);
        const totalUf = subtotalUf;
        const netoClp = Math.round(totalUf * valorUf);
        const ivaClp = Math.round(netoClp * 0.19);
        const totalClp = netoClp + ivaClp;

        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        try {
            const seqResult = await new sql.Request(transaction).query('SELECT NEXT VALUE FOR dbo.fac_cotizacion_seq AS n');
            const numero = seqResult.recordset[0].n;

            const vigenciaDias = input.vigenciaDias || 30;
            const fechaVigencia = new Date();
            fechaVigencia.setDate(fechaVigencia.getDate() + vigenciaDias);

            const req = new sql.Request(transaction);
            req.input('numero', sql.Numeric(10, 0), numero);
            req.input('idEmpresaServicio', sql.Numeric(10, 0), input.idEmpresaServicio);
            req.input('idEmpresa', sql.Numeric(10, 0), input.idEmpresa || null);
            req.input('idCentro', sql.Numeric(10, 0), input.idCentro || null);
            req.input('glosa', sql.NVarChar(500), input.glosa || null);
            req.input('valorUf', sql.Decimal(18, 4), valorUf);
            req.input('subtotalUf', sql.Decimal(18, 4), subtotalUf);
            req.input('totalUf', sql.Decimal(18, 4), totalUf);
            req.input('netoClp', sql.Decimal(18, 2), netoClp);
            req.input('ivaClp', sql.Decimal(18, 2), ivaClp);
            req.input('totalClp', sql.Decimal(18, 2), totalClp);
            req.input('fechaVigencia', sql.Date, fechaVigencia);
            req.input('idUsuario', sql.Int, idUsuario || null);
            req.input('observaciones', sql.NVarChar(1000), input.observaciones || null);
            const cotResult = await req.query(`
                INSERT INTO fac_cotizacion (
                    numero_cotizacion, id_empresaservicio, id_empresa, id_centro, glosa, observaciones,
                    valor_uf, subtotal_uf, total_uf, neto_clp, iva_clp, total_clp,
                    estado, fecha_vigencia, id_usuario
                )
                OUTPUT inserted.id_cotizacion
                VALUES (
                    @numero, @idEmpresaServicio, @idEmpresa, @idCentro, @glosa, @observaciones,
                    @valorUf, @subtotalUf, @totalUf, @netoClp, @ivaClp, @totalClp,
                    'BORRADOR', @fechaVigencia, @idUsuario
                )
            `);
            const idCotizacion = cotResult.recordset[0].id_cotizacion;

            // Secciones primero: cada ítem necesita el id de la suya.
            for (const sec of seccionesResueltas) {
                const secReq = new sql.Request(transaction);
                secReq.input('idCotizacion', sql.Int, idCotizacion);
                secReq.input('orden', sql.Int, sec.orden);
                secReq.input('titulo', sql.NVarChar(500), sec.titulo);
                secReq.input('subtotal', sql.Decimal(18, 4), sec.subtotal);
                const r = await secReq.query(`
                    INSERT INTO fac_cotizacion_seccion (id_cotizacion, orden, titulo, subtotal_uf)
                    OUTPUT inserted.id_seccion
                    VALUES (@idCotizacion, @orden, @titulo, @subtotal)
                `);
                const idSeccion = r.recordset[0].id_seccion;
                sec.items.forEach((it) => { it._idSeccion = idSeccion; });
            }

            for (const it of itemsResueltos) {
                const itReq = new sql.Request(transaction);
                itReq.input('idCotizacion', sql.Int, idCotizacion);
                itReq.input('idSeccion', sql.Int, it._idSeccion || null);
                itReq.input('precioManual', sql.Bit, it.precioManual ? 1 : 0);
                itReq.input('idTecnica', sql.Numeric(10, 0), it.idTecnica || null);
                itReq.input('idTablama', sql.Numeric(10, 0), it.idTablama || null);
                itReq.input('descripcion', sql.VarChar(200), it.descripcion || null);
                itReq.input('cantidad', sql.Int, it.cantidad);
                // NULL (no 0) cuando no hay tarifa: así el detalle lo marca como
                // "Sin tarifa" y se le puede poner precio a mano después.
                itReq.input('precioUnitario', sql.Decimal(18, 4), it.precioUf == null ? null : it.precioUf);
                itReq.input('precioTotal', sql.Decimal(18, 4), it.precioUf == null ? null : it.precioUf * it.cantidad);
                itReq.input('idConvenio', sql.Int, it.idConvenio);
                itReq.input('especificidad', sql.Int, it.especificidad);
                // Identidad completa del análisis. Sin estos tres, convertir la
                // cotización en ficha obliga a volver a elegir cada análisis a
                // mano: el detalle de la ficha se arma con normativa +
                // referencia + referenciaanalisis, no solo con la técnica.
                itReq.input('idNormativa', sql.Numeric(10, 0), it.idNormativa || null);
                itReq.input('idNormativaReferencia', sql.Numeric(10, 0), it.idNormativaReferencia || null);
                itReq.input('idReferenciaAnalisis', sql.Numeric(10, 0), it.idReferenciaAnalisis || null);
                await itReq.query(`
                    INSERT INTO fac_cotizacion_item (
                        id_cotizacion, id_seccion, id_tecnica, id_tablama, descripcion, cantidad,
                        precio_unitario_uf, precio_total_uf, precio_manual, id_convenio_resuelto, especificidad,
                        id_normativa, id_normativareferencia, id_referenciaanalisis
                    ) VALUES (
                        @idCotizacion, @idSeccion, @idTecnica, @idTablama, @descripcion, @cantidad,
                        @precioUnitario, @precioTotal, @precioManual, @idConvenio, @especificidad,
                        @idNormativa, @idNormativaReferencia, @idReferenciaAnalisis
                    )
                `);
            }

            await transaction.commit();
            return { id_cotizacion: idCotizacion, numero_cotizacion: numero, total_uf: totalUf, total_clp: totalClp, items_sin_precio: sinPrecio };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getCotizacionDetalle(idCotizacion) {
        const pool = await getConnection();
        const req1 = pool.request();
        req1.input('id', sql.Int, idCotizacion);
        const cab = await req1.query(`
            SELECT c.*, es.nombre_empresaservicios, emp.nombre_empresa
            FROM fac_cotizacion c
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = c.id_empresaservicio
            LEFT JOIN mae_empresa emp ON emp.id_empresa = c.id_empresa
            WHERE c.id_cotizacion = @id
        `);
        if (cab.recordset.length === 0) return null;

        const req2 = pool.request();
        req2.input('id', sql.Int, idCotizacion);
        const items = await req2.query('SELECT * FROM fac_cotizacion_item WHERE id_cotizacion = @id ORDER BY id_item');

        const req3 = pool.request();
        req3.input('id', sql.Int, idCotizacion);
        const secs = await req3.query('SELECT * FROM fac_cotizacion_seccion WHERE id_cotizacion = @id ORDER BY orden');

        // `items` se mantiene plano por compatibilidad (el PDF viejo y la ficha
        // lo usan así); `secciones` agrupa lo mismo para el documento nuevo.
        const secciones = secs.recordset.map((s) => ({
            ...s,
            items: items.recordset.filter((i) => i.id_seccion === s.id_seccion),
        }));
        // Ítems sin sección (cotizaciones anteriores a la migración) van a una
        // sección implícita, para que la vista nunca los pierda.
        const huerfanos = items.recordset.filter((i) => !i.id_seccion);
        if (huerfanos.length) {
            secciones.push({
                id_seccion: null, orden: secciones.length + 1,
                titulo: cab.recordset[0].glosa || 'Servicio cotizado',
                subtotal_uf: huerfanos.reduce((s, i) => s + Number(i.precio_total_uf || 0), 0),
                items: huerfanos,
            });
        }

        return { ...cab.recordset[0], items: items.recordset, secciones };
    }

    /**
     * Cambia a mano el precio de un ítem ya cotizado y recalcula los totales.
     *
     * Es la salida para los análisis que el convenio no cubre (quedan en
     * "Sin tarifa") y para las líneas que no son del catálogo, como "Gastos de
     * Traslado". Queda marcado con precio_manual para poder distinguir después
     * un cero real de una tarifa que faltaba.
     */
    async actualizarPrecioItemCotizacion(idCotizacion, idItem, precioUf, idUsuario) {
        const cot = await this.getCotizacionDetalle(idCotizacion);
        if (!cot) throw new Error('Cotización no encontrada.');
        if (!['BORRADOR', 'ENVIADA'].includes(cot.estado)) {
            throw new Error(`No se puede cambiar el precio de una cotización ${cot.estado}.`);
        }
        const precio = Number(precioUf);
        if (!Number.isFinite(precio) || precio < 0) throw new Error('El precio debe ser un número mayor o igual a 0.');

        const pool = await getConnection();
        await pool.request()
            .input('idItem', sql.Int, idItem)
            .input('idCot', sql.Int, idCotizacion)
            .input('precio', sql.Decimal(18, 4), precio)
            .query(`
                UPDATE fac_cotizacion_item
                SET precio_unitario_uf = @precio,
                    precio_total_uf = @precio * cantidad,
                    precio_manual = 1
                WHERE id_item = @idItem AND id_cotizacion = @idCot
            `);

        await this._recalcularTotalesCotizacion(idCotizacion);
        logger.info(`[Cotizaciones] Precio manual ${precio} UF en el ítem ${idItem} (cotización ${idCotizacion}) por usuario ${idUsuario || '—'}.`);
        return this.getCotizacionDetalle(idCotizacion);
    }

    /** Rehace subtotales de sección y totales de la cotización desde sus ítems. */
    async _recalcularTotalesCotizacion(idCotizacion) {
        const pool = await getConnection();
        await pool.request().input('id', sql.Int, idCotizacion).query(`
            UPDATE s SET s.subtotal_uf = ISNULL(x.suma, 0)
            FROM fac_cotizacion_seccion s
            OUTER APPLY (SELECT SUM(i.precio_total_uf) AS suma FROM fac_cotizacion_item i WHERE i.id_seccion = s.id_seccion) x
            WHERE s.id_cotizacion = @id;

            UPDATE c SET
                c.subtotal_uf = ISNULL(t.suma, 0),
                c.total_uf   = ISNULL(t.suma, 0),
                c.neto_clp   = ROUND(ISNULL(t.suma, 0) * c.valor_uf, 0),
                c.iva_clp    = ROUND(ROUND(ISNULL(t.suma, 0) * c.valor_uf, 0) * 0.19, 0),
                c.total_clp  = ROUND(ISNULL(t.suma, 0) * c.valor_uf, 0)
                             + ROUND(ROUND(ISNULL(t.suma, 0) * c.valor_uf, 0) * 0.19, 0),
                c.fecha_modificacion = GETDATE()
            FROM fac_cotizacion c
            OUTER APPLY (SELECT SUM(i.precio_total_uf) AS suma FROM fac_cotizacion_item i WHERE i.id_cotizacion = c.id_cotizacion) t
            WHERE c.id_cotizacion = @id;
        `);
    }

    async listarCotizaciones(filtros = {}) {
        const pool = await getConnection();
        const request = pool.request();
        const condiciones = [];
        if (filtros.idEmpresaServicio) {
            request.input('idEmpresaServicio', sql.Numeric(10, 0), filtros.idEmpresaServicio);
            condiciones.push('c.id_empresaservicio = @idEmpresaServicio');
        }
        if (filtros.estado) {
            request.input('estado', sql.VarChar(20), filtros.estado);
            condiciones.push('c.estado = @estado');
        }
        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const result = await request.query(`
            SELECT c.id_cotizacion, c.numero_cotizacion, c.id_empresaservicio, es.nombre_empresaservicios,
                   c.estado, c.total_uf, c.total_clp, c.fecha_vigencia, c.fecha_creacion
            FROM fac_cotizacion c
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = c.id_empresaservicio
            ${where}
            ORDER BY c.fecha_creacion DESC
        `);
        return result.recordset;
    }

    /** Cambia el estado (ENVIADA/ACEPTADA/RECHAZADA), validando vigencia al aceptar. */
    async cambiarEstadoCotizacion(idCotizacion, nuevoEstado, idUsuario) {
        if (!['ENVIADA', 'ACEPTADA', 'RECHAZADA'].includes(nuevoEstado)) {
            throw new Error('Estado inválido.');
        }
        const pool = await getConnection();
        const cot = await this.getCotizacionDetalle(idCotizacion);
        if (!cot) throw new Error('Cotización no encontrada.');

        if (nuevoEstado === 'ACEPTADA' && cot.fecha_vigencia && new Date(cot.fecha_vigencia) < new Date()) {
            throw new Error(`Cotización vencida (vigente hasta ${this._fechaDDMMYYYY(cot.fecha_vigencia)}). Genere una nueva.`);
        }

        const req = pool.request();
        req.input('id', sql.Int, idCotizacion);
        req.input('estado', sql.VarChar(20), nuevoEstado);
        await req.query(`UPDATE fac_cotizacion SET estado = @estado, fecha_modificacion = GETDATE() WHERE id_cotizacion = @id`);
        return { estado: nuevoEstado };
    }

    // ------------------------------------------------------------------
    // FASE 10 — Recurrencia y convenio
    //
    // El cierre de ciclo completo (FICHA_CICLO_FINALIZADO, id_validaciontecnica=8)
    // ya se construyó en la Fase 0/7 — dispara cuando TODAS las visitas
    // recurrentes de una ficha ya tienen informe. Es la mitad reactiva del
    // recordatorio de recompra. Lo que falta acá es la mitad PROACTIVA:
    // avisar ANTES de que se agote el ciclo (queda la última visita), para
    // gestionar la renovación con tiempo — y la transparencia de tarifa
    // vigente por cliente.
    //
    // "Tramos por volumen" NO se implementa: el maestro importado (1000
    // convenios, 15.241 tarifas) no trae ninguna regla de tramo — son
    // precios planos por (empresa, centro, técnica). fac_descuento_regla
    // existe desde la Fase 0 lista para cuando haya reglas reales que
    // cargar; no se inventan umbrales que no existen.
    // ------------------------------------------------------------------

    /**
     * Fichas recurrentes (más de 1 visita programada) a las que les queda
     * como máximo 1 visita sin informe — candidatas a gestionar la
     * renovación del contrato antes de que el ciclo se agote del todo.
     */
    async getFichasProximasARenovar() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT
                f.id_fichaingresoservicio, f.id_empresaservicio, es.nombre_empresaservicios,
                f.id_centro, cen.nombre_centro,
                COUNT(*) AS total_servicios,
                SUM(CASE WHEN a.informe_emitido = 'S' THEN 1 ELSE 0 END) AS servicios_completados,
                MAX(a.fecha_muestreo) AS ultima_fecha_muestreo
            FROM App_Ma_Agenda_MUESTREOS a
            JOIN App_Ma_FichaIngresoServicio_ENC f ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
            LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = f.id_empresaservicio
            LEFT JOIN mae_centro cen ON cen.id_centro = f.id_centro
            WHERE (a.estado_caso IS NULL OR a.estado_caso NOT IN ('CANCELADO', 'ANULADA'))
            GROUP BY f.id_fichaingresoservicio, f.id_empresaservicio, es.nombre_empresaservicios,
                     f.id_centro, cen.nombre_centro
            HAVING COUNT(*) > 1
               AND SUM(CASE WHEN a.informe_emitido = 'S' THEN 1 ELSE 0 END) >= COUNT(*) - 1
               AND SUM(CASE WHEN a.informe_emitido = 'S' THEN 1 ELSE 0 END) < COUNT(*)
            ORDER BY servicios_completados DESC
        `);
        return result.recordset;
    }

    /**
     * Tarifas negociadas vigentes de un cliente (transparencia): lo que hoy
     * tiene pactado, según el maestro. No incluye tramos por volumen — no
     * existen reglas reales de tramo en los datos importados.
     */
    async getTarifasVigentesCliente(idEmpresaServicio) {
        const pool = await getConnection();
        const req = pool.request();
        req.input('idEmpresaServicio', sql.Numeric(10, 0), idEmpresaServicio);
        const result = await req.query(`
            SELECT t.id_tarifa, t.id_tecnica, tec.nombre_tecnica, t.id_tablama, t.uf_individual,
                   c.id_convenio, c.id_centro, cen.nombre_centro
            FROM fac_tarifa t
            JOIN fac_convenio c ON c.id_convenio = t.id_convenio
            LEFT JOIN mae_tecnica tec ON tec.id_tecnica = t.id_tecnica
            LEFT JOIN mae_centro cen ON cen.id_centro = c.id_centro
            WHERE c.id_empresaservicio = @idEmpresaServicio
              AND ISNULL(c.habilitado, 'S') = 'S'
              AND (c.vigencia_desde IS NULL OR c.vigencia_desde <= GETDATE())
              AND (c.vigencia_hasta IS NULL OR c.vigencia_hasta >= GETDATE())
            ORDER BY cen.nombre_centro, tec.nombre_tecnica
        `);
        return result.recordset;
    }

    // ------------------------------------------------------------------
    // FASE 5 — UF automática (Banco Central vía mindicador.cl) + Dashboard
    // ------------------------------------------------------------------

    /**
     * Obtiene la UF del día desde mindicador.cl (indicador público del BCCh,
     * sin API key) y la guarda en fac_valor_uf con fuente='BCCH_API'. Si ya
     * existe un valor MANUAL para hoy, no lo pisa (el override manual manda).
     * Pensado para correr una vez al día vía scheduler; también expuesto
     * como acción manual ("actualizar ahora").
     */
    async actualizarValorUfHoy() {
        const pool = await getConnection();
        // Fecha LOCAL (no toISOString/UTC) — igual que _hoyDDMMYYYY: en Chile
        // (UTC-3/4) tomar el día vía UTC puede adelantarlo en la tarde/noche.
        const hoyDate = new Date();
        const hoy = `${hoyDate.getFullYear()}-${String(hoyDate.getMonth() + 1).padStart(2, '0')}-${String(hoyDate.getDate()).padStart(2, '0')}`;

        const existente = await pool.request()
            .input('fecha', sql.Date, hoy)
            .query('SELECT fuente FROM fac_valor_uf WHERE fecha = @fecha');
        if (existente.recordset.length > 0 && existente.recordset[0].fuente === 'MANUAL') {
            return { actualizado: false, motivo: 'Ya existe un valor MANUAL para hoy; no se sobrescribe.' };
        }

        // Reintenta ante fallas transitorias de red (visto en producción: una
        // llamada funciona y la siguiente, segundos después, da timeout —
        // conectividad intermitente hacia mindicador.cl, no un bloqueo total).
        let valor;
        let ultimoError;
        for (let intento = 1; intento <= 3; intento++) {
            try {
                const resp = await fetch('https://mindicador.cl/api/uf', { signal: AbortSignal.timeout(15000) });
                if (!resp.ok) throw new Error(`mindicador.cl respondió ${resp.status}`);
                const data = await resp.json();
                valor = data?.serie?.[0]?.valor;
                if (!valor) throw new Error('Respuesta de mindicador.cl sin valor UF.');
                ultimoError = null;
                break;
            } catch (err) {
                ultimoError = err;
                logger.warn(`[UF] Intento ${intento}/3 fallido obteniendo UF desde mindicador.cl: ${err.message}`);
                if (intento < 3) await new Promise((r) => setTimeout(r, 2000));
            }
        }
        if (ultimoError) {
            logger.error(`[UF] Error obteniendo UF desde mindicador.cl tras 3 intentos: ${ultimoError.message}`);
            throw new Error(`No se pudo obtener la UF del día tras 3 intentos: ${ultimoError.message}`);
        }

        const req = pool.request();
        req.input('fecha', sql.Date, hoy);
        req.input('valor', sql.Decimal(18, 4), valor);
        if (existente.recordset.length > 0) {
            await req.query(`UPDATE fac_valor_uf SET valor = @valor, fuente = 'BCCH_API', fecha_registro = GETDATE() WHERE fecha = @fecha`);
        } else {
            await req.query(`INSERT INTO fac_valor_uf (fecha, valor, fuente) VALUES (@fecha, @valor, 'BCCH_API')`);
        }

        logger.info(`[UF] Valor UF actualizado: ${valor} (${hoy})`);
        return { actualizado: true, valor, fecha: hoy };
    }

    /** Últimos valores de UF registrados (histórico corto para la pantalla de Configuración). */
    async listarUfHistorial(limit = 30) {
        const pool = await getConnection();
        const result = await pool.request()
            .input('limit', sql.Int, limit)
            .query('SELECT TOP (@limit) fecha, valor, fuente, fecha_registro FROM fac_valor_uf ORDER BY fecha DESC');
        return result.recordset;
    }

    /** Registra/corrige manualmente el valor UF de una fecha (fuente='MANUAL', prevalece sobre BCCH_API). */
    async registrarUfManual(fecha, valor, idUsuario) {
        if (!fecha) throw new Error('fecha es requerida.');
        if (!valor || Number(valor) <= 0) throw new Error('valor debe ser un número positivo.');

        const pool = await getConnection();
        const existente = await pool.request()
            .input('fecha', sql.Date, fecha)
            .query('SELECT id_uf FROM fac_valor_uf WHERE fecha = @fecha');

        const req = pool.request();
        req.input('fecha', sql.Date, fecha);
        req.input('valor', sql.Decimal(18, 4), valor);
        req.input('idUsuario', sql.Int, idUsuario || null);
        if (existente.recordset.length > 0) {
            await req.query(`UPDATE fac_valor_uf SET valor = @valor, fuente = 'MANUAL', id_usuario = @idUsuario, fecha_registro = GETDATE() WHERE fecha = @fecha`);
        } else {
            await req.query(`INSERT INTO fac_valor_uf (fecha, valor, fuente, id_usuario) VALUES (@fecha, @valor, 'MANUAL', @idUsuario)`);
        }
        return { fecha, valor: Number(valor), fuente: 'MANUAL' };
    }

    // ------------------------------------------------------------------
    // CONFIGURACIÓN — snapshot por cliente (fac_cliente_config): email de
    // facturación, si requiere OC/HES, y los datos del Sistema de Ventas
    // (id_cli_ventas, etc.) necesarios para emitir el archivo plano. Sin
    // esto configurado, enviarPorEmail/generarArchivoPlano fallan con un
    // error explícito en vez de adivinar — este endpoint es donde se carga.
    // ------------------------------------------------------------------

    /**
     * Formas de pago vigentes (maestro real de ADL Soft, no una lista
     * inventada) — espeja LaboratorioADL.dbo.consulta_mae_formapago.
     * Requiere el GRANT de solo lectura de db-migrations/
     * grant_laboratorioadl_maestros_readonly.sql.
     */
    async listarFormasPago() {
        const pool = await getConnection();
        const result = await pool.request().query(`
            SELECT nombre_formapago, id_formapago
            FROM LaboratorioADL.dbo.mae_formapago
            WHERE habilitado = 'S'
            ORDER BY nombre_formapago
        `);
        return result.recordset;
    }

    /**
     * Glosas vigentes para Factura Electrónica (id_tipodocumento=1 — el
     * único tipo de documento que ADL ONE emite hoy, confirmado contra el
     * 'FE' ya hardcodeado en _filaLinea/_filaReferencia del archivo plano).
     * Espeja LaboratorioADL.dbo.consulta_mae_glosa_tipodocumento.
     */
    async listarGlosas(idTipoDocumento = 1) {
        const pool = await getConnection();
        const result = await pool.request()
            .input('idTipoDocumento', sql.Numeric(10, 0), idTipoDocumento)
            .query(`
                SELECT nombre_glosa, id_glosa
                FROM LaboratorioADL.dbo.mae_glosa
                WHERE habilitado = 'S' AND id_tipodocumento = @idTipoDocumento
                ORDER BY nombre_glosa
            `);
        return result.recordset;
    }

    /**
     * Configuración efectiva de un cliente: el override guardado en
     * fac_cliente_config, completado (COALESCE) con lo que ya existe en
     * mae_empresaservicios (rut_empresaservicios, nombre_empresaservicios,
     * direccion_empresaservicios, giro_empresaservicios, email_facturacion,
     * ciudad_empresaservicios — verificado con datos reales: 495/495 clientes
     * habilitados tienen RUT ahí). Los campos propios del Sistema de Ventas
     * (id_cli_ventas/id_dir_ventas/id_gir_ventas) no tienen equivalente en
     * ADL ONE y quedan NULL hasta cargarse manualmente o resolverse en la
     * emisión (_resolverClienteVentas). `tiene_config_guardada` indica si ya
     * existe una fila propia en fac_cliente_config (vs. solo los defaults).
     */
    async getClienteConfig(idEmpresaServicio) {
        const pool = await getConnection();
        const result = await pool.request()
            .input('id', sql.Numeric(10, 0), idEmpresaServicio)
            .query(`
                SELECT
                    cfg.id_config,
                    es.id_empresaservicio,
                    ISNULL(cfg.requiere_oc, 'S')  AS requiere_oc,
                    ISNULL(cfg.requiere_hes, 'N') AS requiere_hes,
                    COALESCE(NULLIF(cfg.email_facturacion, ''), NULLIF(es.email_facturacion, '')) AS email_facturacion,
                    cfg.forma_pago_default,
                    ISNULL(cfg.dias_alerta_oc, 10) AS dias_alerta_oc,
                    COALESCE(cfg.rut, NULLIF(LTRIM(RTRIM(es.rut_empresaservicios)), '')) AS rut,
                    COALESCE(cfg.razon_social, es.nombre_empresaservicios) AS razon_social,
                    COALESCE(cfg.direccion, NULLIF(es.direccion_empresaservicios, '')) AS direccion,
                    COALESCE(cfg.giro, NULLIF(es.giro_empresaservicios, '')) AS giro,
                    cfg.id_cli_ventas, cfg.id_dir_ventas, cfg.id_gir_ventas,
                    cfg.id_ciu_ventas,
                    COALESCE(cfg.nom_ciu_ventas, NULLIF(es.ciudad_empresaservicios, '')) AS nom_ciu_ventas,
                    cfg.id_com_ventas, cfg.nom_com_ventas,
                    ISNULL(cfg.id_formapago_ventas, 1) AS id_formapago_ventas,
                    -- Contacto del cliente: es el "Atención:" de la propuesta.
                    NULLIF(LTRIM(RTRIM(es.contacto_empresaservicios)), '') AS contacto,
                    NULLIF(LTRIM(RTRIM(es.email_contacto)), '') AS email_contacto,
                    cfg.portal_cliente_codigo, cfg.portal_sede_codigo,
                    CASE WHEN cfg.id_config IS NULL THEN 0 ELSE 1 END AS tiene_config_guardada
                FROM mae_empresaservicios es
                LEFT JOIN fac_cliente_config cfg ON cfg.id_empresaservicio = es.id_empresaservicio
                WHERE es.id_empresaservicio = @id
            `);
        return result.recordset[0] || null;
    }

    async upsertClienteConfig(idEmpresaServicio, datos, idUsuario) {
        const pool = await getConnection();
        const existente = await pool.request()
            .input('id', sql.Numeric(10, 0), idEmpresaServicio)
            .query('SELECT id_config FROM fac_cliente_config WHERE id_empresaservicio = @id');

        const req = pool.request();
        req.input('idEmpresaServicio', sql.Numeric(10, 0), idEmpresaServicio);
        req.input('requiereOc', sql.VarChar(1), datos.requiereOc === 'N' ? 'N' : 'S');
        req.input('requiereHes', sql.VarChar(1), datos.requiereHes === 'S' ? 'S' : 'N');
        req.input('emailFacturacion', sql.VarChar(200), datos.emailFacturacion || null);
        req.input('formaPagoDefault', sql.VarChar(100), datos.formaPagoDefault || null);
        req.input('diasAlertaOc', sql.Int, datos.diasAlertaOc ?? 10);
        req.input('rut', sql.VarChar(12), datos.rut || null);
        req.input('razonSocial', sql.NVarChar(150), datos.razonSocial || null);
        req.input('direccion', sql.NVarChar(150), datos.direccion || null);
        req.input('giro', sql.NVarChar(150), datos.giro || null);
        req.input('idCliVentas', sql.Int, datos.idCliVentas || null);
        req.input('idDirVentas', sql.Int, datos.idDirVentas || null);
        req.input('idGirVentas', sql.Int, datos.idGirVentas || null);
        req.input('idCiuVentas', sql.Int, datos.idCiuVentas || null);
        req.input('nomCiuVentas', sql.VarChar(80), datos.nomCiuVentas || null);
        req.input('idComVentas', sql.Int, datos.idComVentas || null);
        req.input('nomComVentas', sql.VarChar(80), datos.nomComVentas || null);
        req.input('idFormapagoVentas', sql.Int, datos.idFormapagoVentas ?? 1);
        req.input('portalClienteCodigo', sql.VarChar(50), datos.portalClienteCodigo || null);
        req.input('portalSedeCodigo', sql.VarChar(50), datos.portalSedeCodigo || null);
        req.input('idUsuario', sql.Int, idUsuario || null);

        if (existente.recordset.length > 0) {
            await req.query(`
                UPDATE fac_cliente_config SET
                    requiere_oc = @requiereOc, requiere_hes = @requiereHes,
                    email_facturacion = @emailFacturacion, forma_pago_default = @formaPagoDefault,
                    dias_alerta_oc = @diasAlertaOc, rut = @rut, razon_social = @razonSocial,
                    direccion = @direccion, giro = @giro,
                    id_cli_ventas = @idCliVentas, id_dir_ventas = @idDirVentas, id_gir_ventas = @idGirVentas,
                    id_ciu_ventas = @idCiuVentas, nom_ciu_ventas = @nomCiuVentas,
                    id_com_ventas = @idComVentas, nom_com_ventas = @nomComVentas,
                    id_formapago_ventas = @idFormapagoVentas,
                    portal_cliente_codigo = @portalClienteCodigo, portal_sede_codigo = @portalSedeCodigo,
                    id_usuario = @idUsuario, fecha_modificacion = GETDATE()
                WHERE id_empresaservicio = @idEmpresaServicio
            `);
        } else {
            await req.query(`
                INSERT INTO fac_cliente_config (
                    id_empresaservicio, requiere_oc, requiere_hes, email_facturacion, forma_pago_default,
                    dias_alerta_oc, rut, razon_social, direccion, giro,
                    id_cli_ventas, id_dir_ventas, id_gir_ventas, id_ciu_ventas, nom_ciu_ventas,
                    id_com_ventas, nom_com_ventas, id_formapago_ventas,
                    portal_cliente_codigo, portal_sede_codigo, id_usuario
                ) VALUES (
                    @idEmpresaServicio, @requiereOc, @requiereHes, @emailFacturacion, @formaPagoDefault,
                    @diasAlertaOc, @rut, @razonSocial, @direccion, @giro,
                    @idCliVentas, @idDirVentas, @idGirVentas, @idCiuVentas, @nomCiuVentas,
                    @idComVentas, @nomComVentas, @idFormapagoVentas,
                    @portalClienteCodigo, @portalSedeCodigo, @idUsuario
                )
            `);
        }
        return this.getClienteConfig(idEmpresaServicio);
    }

    /** Dashboard: KPIs en vivo + alertas accionables. */
    async getDashboard() {
        const pool = await getConnection();

        const [pendientes, porEstado, facturadoMes, ufActual, ocDemoradas] = await Promise.all([
            // Pendiente por facturar: casos facturables aún no incluidos en ninguna PF
            pool.request().query(`
                SELECT COUNT(*) AS cantidad,
                       ISNULL(SUM(det.uf), 0) AS total_uf
                FROM App_Ma_Agenda_MUESTREOS a
                JOIN App_Ma_FichaIngresoServicio_ENC f ON f.id_fichaingresoservicio = a.id_fichaingresoservicio
                CROSS APPLY (
                    SELECT ISNULL(SUM(d.uf_individual), 0) AS uf
                    FROM App_Ma_FichaIngresoServicio_DET d
                    WHERE d.id_fichaingresoservicio = f.id_fichaingresoservicio AND d.activo = 1
                ) det
                WHERE a.id_estadomuestreo = 3 AND a.informe_emitido = 'S' AND a.id_estado_facturacion IS NULL
            `),
            // Pre-facturas por estado
            pool.request().query(`
                SELECT estado, COUNT(*) AS cantidad, ISNULL(SUM(total_uf), 0) AS total_uf, ISNULL(SUM(total_clp), 0) AS total_clp
                FROM fac_prefactura
                GROUP BY estado
            `),
            // Facturado este mes (folio registrado este mes calendario)
            pool.request().query(`
                SELECT ISNULL(SUM(e.monto_total), 0) AS total_clp, COUNT(*) AS cantidad
                FROM fac_emision e
                WHERE e.estado = 'FOLIO_REGISTRADO'
                  AND YEAR(e.fecha_emision) = YEAR(GETDATE()) AND MONTH(e.fecha_emision) = MONTH(GETDATE())
            `),
            // Valor UF más reciente registrado
            pool.request().query('SELECT TOP 1 fecha, valor, fuente FROM fac_valor_uf ORDER BY fecha DESC'),
            // Pre-facturas esperando OC hace más de lo tolerado por su cliente
            pool.request().query(`
                SELECT p.id_prefactura, p.numero_id, p.id_empresaservicio, es.nombre_empresaservicios,
                       p.fecha_email, DATEDIFF(day, ISNULL(p.fecha_email, p.fecha_creacion), GETDATE()) AS dias_esperando
                FROM fac_prefactura p
                LEFT JOIN mae_empresaservicios es ON es.id_empresaservicio = p.id_empresaservicio
                LEFT JOIN fac_cliente_config cfg ON cfg.id_empresaservicio = p.id_empresaservicio
                WHERE p.estado = 'PENDIENTE_OC'
                  AND DATEDIFF(day, ISNULL(p.fecha_email, p.fecha_creacion), GETDATE()) >= ISNULL(cfg.dias_alerta_oc, 10)
                ORDER BY dias_esperando DESC
            `),
        ]);

        const ufDesactualizada = ufActual.recordset.length === 0
            || new Date(ufActual.recordset[0].fecha).toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10);

        const antiguedadEmision = await this.getAntiguedadEmision();
        const proximosARenovar = await this.getFichasProximasARenovar();

        return {
            pendiente_facturar: pendientes.recordset[0],
            prefacturas_por_estado: porEstado.recordset,
            facturado_mes: facturadoMes.recordset[0],
            valor_uf_actual: ufActual.recordset[0] || null,
            // Antigüedad de EMISIÓN, no de pago — no hay señal de pago automática
            // disponible (ver Fase 8: ventas.facturada verificado como no usable).
            antiguedad_emision_sin_marcar_pago: antiguedadEmision,
            alertas: {
                uf_desactualizada: ufDesactualizada,
                oc_demoradas: ocDemoradas.recordset,
                proximos_a_renovar: proximosARenovar,
            },
        };
    }
}

export default new FacturacionService();
