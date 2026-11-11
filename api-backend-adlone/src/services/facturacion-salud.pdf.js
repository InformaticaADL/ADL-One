/**
 * PDF «Resumen» de una factura (Facturación Salud), réplica del informe fac_prever_resumen_general.frx de ADLSOFT.
 *
 * Contenido (igual que ADLSOFT): empresa, programa, «facturado por» con sus datos, fecha e ID, valor de la UF, una fila con N° de
 * factura, UF de ingresos, descuentos, casos y total, pesos (y dólares para la empresa 500), el detalle de otros ingresos y de otros
 * descuentos, la fecha de emisión del informe y el número de página.
 * ADLSOFT lo escribe en una carpeta de red con el año y el mes elegidos a mano; aquí se guarda en la carpeta de documentos de ADL ONE
 * (variable FACTURACION_SALUD_DOCS_DIR), en una subcarpeta <año>/<MES> tomada de la fecha de facturación (D-27).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import sql from '../config/databaseSalud.js';
import { roundVfp } from './facturacion-salud.exportacion.js';
import { ID_EMPRESA_CON_DOLAR } from './facturacion-salud.consulta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(__dirname, '../assets/logo_adl_diagnostic.png');
const LOGO_ADLSOFT = path.join(__dirname, '../assets/logo_adlsoft_facturacion.png');
const N = sql.Numeric(10, 0);
const txt = (v) => String(v ?? '').trim();
const num = (v) => Number(v) || 0;

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

const miles = (n, dec = 0) => num(n).toLocaleString('es-CL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const dos = (n) => String(n).padStart(2, '0');
const fechaHora = (d) => `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} - ${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;

// ---------------------------------------------------------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------------------------------------------------------

/** «Facturado por (centro veterinario agua)»: los tres datos se reubican según por qué se factura, como en la pantalla de ADLSOFT. */
export function datosFacturadoPor(fila) {
  const por = txt(fila.facturado_por);
  let [d1, d2, d3] = [txt(fila.dato1), txt(fila.dato2), txt(fila.dato3)];
  if (por === 'Centro') { d2 = ''; d3 = ''; }
  else if (por === 'Veterinario') { d1 = d2; d2 = ''; d3 = ''; }
  else if (por === 'Centro - Veterinario') { d3 = ''; }
  else if (por === 'Tipo de Agua' || por === 'Tipo de Agua - Veterinario') { d1 = d3; d2 = ''; d3 = ''; }
  const detalle = [d1, d2, d3].filter(Boolean).join('   ');
  return { por, detalle, texto: `${por}( ${detalle} )` };
}

/** Lo que imprime el informe: la primera fila del resumen de la factura (ADLSOFT borra las demás) y sus otros ingresos y descuentos. */
export function armarDatosResumen({ resumen, ingresos = [], descuentos = [] }) {
  const f = resumen?.[0];
  if (!f) throw new Error('La factura no tiene datos para el resumen.');
  const ufTotal = roundVfp(f.uf_total, 2);
  return {
    id_facturacion: num(f.id_facturacion),
    factura: num(f.factura),
    empresa: txt(f.empresa),
    programa: txt(f.programa),
    fecha: txt(f.fecha),
    facturadoPor: datosFacturadoPor(f),
    valorUf: num(f.valor_uf),
    ufIngresos: roundVfp(f.uf_ingresos, 2),
    ufDescuentos: roundVfp(f.uf_descuentos, 2),
    ufCaso: roundVfp(f.uf_caso, 2),
    ufTotal,
    pesosTotal: roundVfp(roundVfp(ufTotal * num(f.valor_uf), 2), 0),
    llevaDolar: num(f.id_empresaservicio) === ID_EMPRESA_CON_DOLAR,
    usdTotal: roundVfp(f.usd_total, 2),
    valorUsd: num(f.valor_usd),
    ingresos: ingresos.filter((i) => num(i.id_otrosingresos) > 0).map((i) => ({ concepto: txt(i.nombre_otrosingresos), valor: num(i.valor) })),
    descuentos: descuentos.filter((d) => num(d.id_otrosdescuentos) > 0).map((d) => ({ concepto: txt(d.nombre_otrosdescuentos), valor: num(d.valor) }))
  };
}

export async function leerDatosResumen(db, { id_facturacion }) {
  const lee = async (sp) => (await db.request().input('id', N, num(id_facturacion)).query(`EXEC dbo.${sp} @xid_facturacion = @id;`)).recordset || [];
  const [resumen, ingresos, descuentos] = await Promise.all([lee('fac_excel_resumen'), lee('fac_consulta_una_factura_ing'), lee('fac_consulta_una_factura_des')]);
  return armarDatosResumen({ resumen, ingresos, descuentos });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------------------------
// Documento «Resumen»
//
// Medidas tomadas del PDF real que genera ADLSOFT (factura ID 69637, Screening con un otro ingreso) y del informe
// fac_prever_resumen_general.frx. Carta, Arial 8/10, barras naranjas #FF8000; textos por su línea base (puntos desde arriba).
// Reglas del informe que se replican:
//  - los números en cero se imprimen en blanco (formato «@Z»), por eso no sale «0,000» ni el folio 0;
//  - los campos de UF miden 30,75 pt y el formato «9.999,999» ocupa 9 posiciones: un valor de 2 o más dígitos enteros (65,520) no cabe y
//    pasa a una segunda línea, y esa línea agranda la banda y baja todo lo que viene después (H-95);
//  - «Otros ingresos / descuentos» no imprime filas si no hay registros, y cada fila ocupa 23,46 pt (el nombre del concepto viene
//    relleno de espacios y también se parte en dos líneas, H-95).
// ---------------------------------------------------------------------------------------------------------------------------

/** Texto por su línea base y líneas, comunes a los dos informes. Con «der» el x es el borde derecho del texto. */
function herramientasPdf(doc) {
  const texto = (s, x, base, { negrita = false, tam = 8, der = false, fuente } = {}) => {
    doc.font(fuente || (negrita ? 'Helvetica-Bold' : 'Helvetica')).fontSize(tam).fillColor('#000000');
    const ancho = doc.widthOfString(String(s));
    doc.text(String(s), der ? x - ancho : x, base, { lineBreak: false, baseline: 'alphabetic' });
  };
  const linea = (x1, y, x2, grosor, color = '#000000') => doc.moveTo(x1, y).lineTo(x2, y).lineWidth(grosor).strokeColor(color).stroke();
  return { texto, linea };
}

const ANCHO_CAMPO_UF = 30.75; // campos «U.F. Ing.», «U.F. Des.», «U.F. Caso» y «U.F. Total»
const SALTO_LINEA_CAMPO = 8.0; // la segunda línea de un campo que no cabe
const ALTURA_EXTRA_CAMPO = 9.22; // lo que crece la banda por esa segunda línea
const ALTO_FILA_OTROS = 23.46; // fila de «Otros ingresos / descuentos» (14,26 + la línea en blanco del concepto)

/** Número en el formato «@Z 9,999.999»: en blanco si es cero. */
const ufZ = (n) => (num(n) === 0 ? '' : miles(n, 3));

/** Genera el PDF en memoria. */
export function crearPdfResumen(d, { ahora = new Date() } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [HOJA.ancho, HOJA.alto], margin: 0, bufferPages: true, info: { Title: `Resumen factura ID ${d.id_facturacion}`, Author: 'ADL ONE' } });
    const trozos = [];
    doc.on('data', (t) => trozos.push(t));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
    const { texto, linea } = herramientasPdf(doc);

    // ¿cabe el valor en su campo? el formato ocupa 9 posiciones (relleno con espacios a la izquierda)
    const noCabe = (s, tam = 8) => s !== '' && doc.font('Helvetica').fontSize(tam).widthOfString(s.padStart(9)) > ANCHO_CAMPO_UF;

    const cabeceraPagina = () => {
      if (fs.existsSync(LOGO_ADLSOFT)) doc.image(LOGO_ADLSOFT, 9.75, 5.25, { width: 157.5, height: 55.5 });
      texto('ADL ONE - Sistema de Facturación', 416.25, 27.05, { negrita: true, tam: 10 });
      texto('RESUMEN', 414.75, 39.05, { negrita: true, tam: 10 });
      texto(` - ID ${d.id_facturacion}`, 464.25, 39.05, { negrita: true, tam: 10 });
      linea(X_IZQ, 61.5, 582, 4, NARANJA);
      texto('Empresa:', 9, 81.8, { negrita: true, tam: 10 });
      texto(d.empresa, 72, 81.8, { negrita: true, tam: 10 });
      linea(X_IZQ, 774, 582, 4, NARANJA); // barra naranja del pie
    };
    cabeceraPagina();

    // Datos generales
    texto('Programa', 9, 100.56);
    texto(`: ${d.programa}`, 83.3, 100.56);
    texto('Facturado por', 9, 117.06);
    texto(`: ${d.facturadoPor.texto}`, 83.3, 117.06);
    texto('Fecha Facturación', 9, 133.56);
    texto(`: ${d.fecha}`, 83.3, 133.56);
    texto('Valor U.F.', 272.3, 154.56);
    texto(miles(d.valorUf, 2), 364.5, 154.56, { der: true });
    if (d.llevaDolar) {
      texto('Valor USD', 378, 154.56);
      texto(miles(d.valorUsd, 2), 470.25, 154.56, { der: true });
    }
    linea(123, 158.25, 504.75, 1);

    // Totales de la factura: títulos, línea y una fila de valores
    texto('Fac. N°', 135, 186.06);
    texto('U.F. Ing.', 186.8, 186.06);
    texto('U.F. Des.', 232.5, 186.06);
    texto('U.F. Caso', 276.8, 186.06);
    texto('U.F. Total', 328.5, 186.06);
    texto('Pesos Total', 441, 186.06);
    if (d.llevaDolar) texto('USD Total', 378.75, 186.06);
    linea(123, 189.75, 504.75, 1);

    const BASE_VALORES = 204.06;
    let hayDesborde = false;
    const campoUf = (valor, derecho) => {
      const s = ufZ(valor);
      const parte = noCabe(s);
      if (parte) hayDesborde = true;
      texto(s, derecho, BASE_VALORES + (parte ? SALTO_LINEA_CAMPO : 0), { der: true });
    };
    texto(d.factura ? String(d.factura) : '', 163.5, BASE_VALORES, { der: true });
    campoUf(d.ufIngresos, 213);
    campoUf(d.ufDescuentos, 261);
    campoUf(d.ufCaso, 309);
    campoUf(d.ufTotal, 357);
    texto(num(d.pesosTotal) === 0 ? '' : miles(d.pesosTotal), 495.75, 203.44, { negrita: true, der: true });
    if (d.llevaDolar) texto(num(d.usdTotal) === 0 ? '' : miles(d.usdTotal, 2), 414.75, BASE_VALORES, { der: true });
    const desplazamiento = hayDesborde ? ALTURA_EXTRA_CAMPO : 0;
    linea(411, 216 + desplazamiento, 504, 1);
    linea(411, 217.5 + desplazamiento, 504, 1);

    // Otros ingresos / otros descuentos. Cada bloque es una pila de bandas: título y encabezado (45,0 pt en ingresos y 45,76 en descuentos),
    // una fila por registro y un pie de 30 pt con la suma. Con registros, la fila y el pie crecen 9,22 pt cada uno (la línea en blanco de los
    // campos que se estiran, H-95). Sin registros no se imprime ninguna fila. Devuelve el tope del bloque siguiente.
    const bloque = (titulo, filas, arriba, altoEncabezado, suma) => {
      if (arriba > LIMITE_CUERPO - 80) {
        doc.addPage({ size: [HOJA.ancho, HOJA.alto], margin: 0 });
        cabeceraPagina();
        arriba = 100;
      }
      const base = arriba + 11.9;
      texto(titulo, 124.5, base, { negrita: true, tam: 10 });
      texto('Concepto', 170.3, base + 24.77);
      texto('U.F.', 378, base + 24.77);
      linea(123, base + 29.21, 407.25, 1);
      let y = arriba + altoEncabezado;
      for (const f of filas) {
        if (y + ALTO_FILA_OTROS + 40 > LIMITE_CUERPO) {
          doc.addPage({ size: [HOJA.ancho, HOJA.alto], margin: 0 });
          cabeceraPagina();
          y = 100;
        }
        texto(f.concepto, 171, y + 9.67);
        // el valor de la fila también pasa a una segunda línea si no cabe en su campo
        texto(ufZ(f.valor), 393.75, y + 9.67 + (noCabe(ufZ(f.valor)) ? SALTO_LINEA_CAMPO : 0), { der: true });
        y += ALTO_FILA_OTROS;
      }
      linea(352.5, y + 2.27, 407.25, 1);
      linea(352.5, y + 3.77, 407.25, 1);
      const textoSuma = ufZ(filas.reduce((a, f) => a + f.valor, 0));
      texto(textoSuma, 393.75, y + suma.dy + (noCabe(textoSuma, suma.tam) ? SALTO_LINEA_CAMPO : 0), { der: true, tam: suma.tam });
      return y + 30 + (filas.length ? ALTURA_EXTRA_CAMPO : 0);
    };
    const proximo = bloque('Otros Ingresos', d.ingresos, 237.15 + desplazamiento, 45, { dy: 17.18, tam: 8 });
    bloque('Otros Descuentos', d.descuentos, proximo, 45.76, { dy: 17.63, tam: 7 }); // la suma de descuentos va en Arial 7

    // Pie de cada hoja: fecha del informe y N° de página (en Arial)
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(paginas.start + i);
      texto(`Informe:  ${fechaHora(ahora)}`, 9, 787.27, { tam: 7 });
      texto(`Página:  ${i + 1}  de  ${paginas.count}`, 581.2, 787.27, { tam: 7, der: true });
    }
    doc.end();
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Archivo y carpeta
// ---------------------------------------------------------------------------------------------------------------------------

/** Quita de un nombre lo que Windows no permite en archivos. */
export const nombreSeguro = (t) => txt(t).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

export const nombreArchivoResumen = (titulo) => `${nombreSeguro(titulo) || 'Factura'} RESUMEN.PDF`;

/** Subcarpeta <año>/<MES> según la fecha de facturación dd/mm/yyyy (si no hay fecha válida, la fecha de hoy). */
export function subcarpetaDe(fechaFacturacion, hoy = new Date()) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(txt(fechaFacturacion));
  const mes = m ? Number(m[2]) : hoy.getMonth() + 1;
  const ano = m ? Number(m[3]) : hoy.getFullYear();
  return path.join(String(ano), MESES[Math.min(Math.max(mes, 1), 12) - 1]);
}

/**
 * Guarda el PDF en <carpeta base>/<año>/<MES>/ y devuelve la ruta. Si no hay carpeta configurada devuelve null (el PDF igual se
 * entrega para descargar). Crea las carpetas que falten, incluida la base.
 */
export function guardarPdf(buffer, { carpetaBase, titulo, fechaFacturacion, nombreArchivo }) {
  if (!txt(carpetaBase)) return null;
  const carpeta = path.join(path.resolve(carpetaBase), subcarpetaDe(fechaFacturacion));
  fs.mkdirSync(carpeta, { recursive: true });
  const ruta = path.join(carpeta, nombreArchivo || nombreArchivoResumen(titulo));
  fs.writeFileSync(ruta, buffer);
  return ruta;
}

// ---------------------------------------------------------------------------------------------------------------------------
// PDF «Detalle» (réplica de fac_prever_detalle_general / _general_scree de ADLSOFT)
//
// Medidas tomadas del PDF que genera ADLSOFT (carta, Arial 8/10/14, barras naranjas #FF8000) y de las expresiones del informe .frx.
// Todas las posiciones están en puntos desde el borde superior izquierdo; los textos se ubican por su línea base.
// ---------------------------------------------------------------------------------------------------------------------------

// ADLSOFT guarda el detalle solo con el nombre sugerido (sin sufijo); el resumen lleva «RESUMEN»
export const nombreArchivoDetalle = (titulo) => `${nombreSeguro(titulo) || 'Factura'}.PDF`;

/**
 * Variante del informe según la factura (igual que ADLSOFT): los programas «Screening» usan un informe con la fecha de informe en vez de
 * la recepción; para la empresa 56 (AquaGen) que no sea de proyecto se lee el detalle con jornada.
 */
export function variantePdfDetalle(fila) {
  if (txt(fila?.programa) !== 'Screening') return { plantilla: 'general', jornada: false };
  const proyecto = num(fila.id_programa) === 2 && num(fila.id_unegocio) === 1;
  return { plantilla: 'screening', jornada: !proyecto && num(fila.id_empresaservicio) === 56 };
}

/** Líneas que el informe con jornada no imprime: «Costo jornada» en cero y las técnicas 960 a 963. */
export const filtrarLineasJornada = (filas) =>
  filas.filter((f) => !(num(f.n_analisis) === 0 && txt(f.tecnica) === 'Costo jornada') && !(num(f.id_tecnica) >= 960 && num(f.id_tecnica) <= 963));

/**
 * «Facturado por» del detalle. ADLSOFT escribe siempre «<por>(Veterinario: <veterinario> )», aunque se facture por centro o por tipo de
 * agua (la palabra «Veterinario:» está fija en el informe); solo en el programa 9 imprime únicamente el veterinario (H-89).
 */
export const textoFacturadoPorDetalle = (fila) =>
  num(fila.id_programa) === 9 ? txt(fila.veterinario) : `${txt(fila.facturado_por)}(Veterinario: ${txt(fila.veterinario)} )`;

/**
 * Agrupa las líneas como el informe de ADLSOFT: por cortes de control consecutivos (no junta centros que no vienen seguidos). En la
 * versión con jornada el primer nivel es la fecha de muestreo y el segundo el centro; en las demás solo el centro. Cada grupo lleva su
 * «TOTAL CENTRO». Calcula también los totales y el IVA.
 */
export function armarDatosDetalle({ filas, usdTotalCasos = 0 }) {
  const primera = filas?.[0];
  if (!primera) throw new Error('La factura no tiene líneas para el detalle.');
  const variante = variantePdfDetalle(primera);
  const grupos = [];
  let actual = null;
  for (const f of filas) {
    const centro = txt(f.centro);
    const fechaMuestreo = variante.jornada ? txt(f.fecha_muestreo) : '';
    if (!actual || actual.centro !== centro || actual.fechaMuestreo !== fechaMuestreo) {
      actual = { centro, fechaMuestreo, filas: [], totalUf: 0 };
      grupos.push(actual);
    }
    actual.filas.push({
      recepcion: txt(f.n_recepcion), caso: txt(f.caso), tecnica: txt(f.tecnica), nAnalisis: num(f.n_analisis), ufUni: num(f.uf_uni), ufTot: num(f.uf_tot),
      fechaInforme: txt(f.fecha_informe), fechaMuestreo: txt(f.fecha_muestreo)
    });
    actual.totalUf += num(f.uf_tot);
  }
  const ufValor = num(primera.uf_valor);
  const totalUf = grupos.reduce((a, g) => a + g.totalUf, 0);
  const neto = roundVfp(roundVfp(totalUf, 2) * ufValor, 0);
  const iva = roundVfp(neto * 0.19, 0);
  return {
    variante,
    empresa: txt(primera.empresa),
    factura: num(primera.factura),
    id_facturacion: num(primera.id_facturacion),
    fecha: txt(primera.fecha),
    programa: txt(primera.programa),
    facturadoPor: textoFacturadoPorDetalle(primera),
    ufValor,
    usdValor: num(primera.usd_valor),
    llevaDolar: num(primera.id_empresaservicio) === ID_EMPRESA_CON_DOLAR,
    usdTotalCasos: num(usdTotalCasos),
    // ADLSOFT imprime aquí el rango de las fechas de INFORME (fecha_informe_ini/fin), no el de proceso (H-90)
    fechaProceso: `${txt(primera.fecha_informe_ini)} - ${txt(primera.fecha_informe_fin)}`,
    grupos: grupos.map((g, i) => {
      // en la versión con jornada el «TOTAL CENTRO» no se reinicia por centro sino por fecha de muestreo (H-93)
      let totalCentro = g.totalUf;
      if (variante.jornada) {
        totalCentro = 0;
        for (let k = i; k >= 0 && grupos[k].fechaMuestreo === g.fechaMuestreo; k--) totalCentro += grupos[k].totalUf;
      }
      return { ...g, totalUf: roundVfp(totalCentro, 2), totalPesos: roundVfp(roundVfp(totalCentro, 2) * ufValor, 0) };
    }),
    totalUf: roundVfp(totalUf, 2),
    neto,
    iva,
    total: neto + iva
  };
}

export async function leerDatosDetalle(db, { id_facturacion, usdTotalCasos = 0 }) {
  const leer = async (sp) => (await db.request().input('id', N, num(id_facturacion)).query(`SET DATEFORMAT dmy; EXEC dbo.${sp} @xid_facturacion = @id;`)).recordset || [];
  let filas = await leer('fac_excel_detalle');
  if (variantePdfDetalle(filas[0]).jornada) filas = filtrarLineasJornada(await leer('fac_excel_detalle_jornada'));
  return armarDatosDetalle({ filas, usdTotalCasos });
}

// Medidas del informe de ADLSOFT (puntos, medidas con decimales de los PDF reales)
const HOJA = { ancho: 612, alto: 792 };
const NARANJA = '#FF8000';
const X_IZQ = 7.5;
const X_DER = 584.25;
const ALTO_FILA = 12.75; // banda de detalle y de encabezado de centro
const ALTO_FECHA = 15; // encabezado «Fecha de muestreo»
const ALTO_PIE_CASO = 14.26;
const ALTO_RESUMEN = 75.8;
const BASE_FILA = 9.82; // línea base dentro de una banda de 12,75
const BASE_ENC = 9.2; // línea base dentro de un encabezado de grupo
const LIMITE_CUERPO = 765; // una banda no se imprime si termina más abajo (sobre el pie de página)
const COL = { recepcion: 13.5, caso: 63.8, tecnica: 110.3, nDer: 488.25, uniDer: 524.3, totDer: 577.5 };
// Plantilla de Screening: sin recepción; el caso primero y la fecha de informe entre la técnica y el N° de análisis
const COL_SCREE = { fecha: 380.25, caso: 11.25, tecnica: 57.75, nDer: 488.25, uniDer: 524.3, totDer: 577.5 };

/** Posiciones de la cabecera, del pie y de los pies de grupo en cada plantilla (general y Screening). */
const DISENO = {
  general: {
    titX: 414, detalleX: 415.5, idX: 462.7, idTexto: (id) => ` - ID${id}`, titBase: 27.05,
    fechaX: 231, fechaVX: 261.8, fechaBase: 40.56, ufX: 231.8, ufVX: 274.4, ufBase: 54.06, procBase: 53.31, usdBase: 67.75,
    naranja: 71.25, linea1: 108.75, linea2: 135, empLabBase: 92.3, empValBase: 91.55, progBase: 91.56, facBase: 105.81, colBase: 131.31, totX: 548.3,
    primerEncabezado: 144.94, pieCentroX: { etiqueta: 345, pesos: 421.5, pesosDer: 498.7, ufEtq: 503.3, ufDer: 577.5 },
    subtotalDy: 10.7, pieCentroValDy: 11.44, pieCentroEtqDy: 12.19, altoPieCentro: 23.26, lineaResumenDy: 3.74,
    totGenDy: 15.19, netoDy: 42.19, ivaDy: 55.69, totalDy: 69.19,
    piePie: { base: 779.54, fuente: 'Times-Roman', paginaIzq: false, paginaX: 579 }
  },
  screening: {
    titX: 411, detalleX: 411, idX: 457.5, idTexto: (id) => ` - ID ${id}`, titBase: 27.05,
    fechaX: 230.3, fechaVX: 261, fechaBase: 41.31, ufX: 231, ufVX: 273.6, ufBase: 54.81, procBase: 53.31, usdBase: 68.5,
    naranja: 72.75, linea1: 110.25, linea2: 136.5, empLabBase: 93.8, empValBase: 93.05, progBase: 93.06, facBase: 107.31, colBase: 132.81, totX: 547.5,
    primerEncabezado: 148.69, pieCentroX: { etiqueta: 344.3, pesos: 420.8, pesosDer: 498, ufEtq: 502.6, ufDer: 576.8 },
    subtotalDy: 11.45, pieCentroValDy: 13.69, pieCentroEtqDy: 14.44, altoPieCentro: 25.49, lineaResumenDy: 1.51,
    totGenDy: 14.44, netoDy: 41.44, ivaDy: 54.94, totalDy: 68.44,
    piePie: { base: 781.27, fuente: 'Helvetica', paginaIzq: true, paginaX: 528.1 }
  }
};

/** Número con coma decimal y puntos de miles (formato chileno de ADLSOFT). */
const num3 = (n) => miles(n, 3);
/** El informe deja en blanco los montos en cero. */
const blancoSiCero = (n, dec) => (num(n) === 0 ? '' : miles(n, dec));

/** Genera el PDF de detalle en memoria. */
export function crearPdfDetalle(d, { ahora = new Date() } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [HOJA.ancho, HOJA.alto], margin: 0, bufferPages: true, info: { Title: `Detalle factura ID ${d.id_facturacion}`, Author: 'ADL ONE' } });
    const trozos = [];
    doc.on('data', (t) => trozos.push(t));
    doc.on('end', () => resolve(Buffer.concat(trozos)));
    doc.on('error', reject);
    const { texto, linea } = herramientasPdf(doc);

    const esScreening = d.variante.plantilla === 'screening';
    const col = esScreening ? COL_SCREE : COL;
    const dis = esScreening ? DISENO.screening : DISENO.general;
    const primerEncabezado = esScreening && !d.variante.jornada ? 146.44 : dis.primerEncabezado;

    const cabeceraPagina = () => {
      if (fs.existsSync(LOGO_ADLSOFT)) doc.image(LOGO_ADLSOFT, 9.8, 8, { width: 147.8, height: 52.5 });
      texto('Factura N°', 204.75, 26.02, { negrita: true, tam: 14 });
      texto(`: ${d.factura}`, 282, 26.02, { negrita: true, tam: 14 });
      texto('ADL ONE - Sistema de Facturación', dis.titX, dis.titBase, { negrita: true, tam: 10 });
      texto('DETALLE', esScreening && !d.variante.jornada ? 410.3 : dis.detalleX, 39.05, { negrita: true, tam: 10 });
      texto(dis.idTexto(d.id_facturacion), dis.idX, 39.05, { negrita: true, tam: 10 });
      texto('Fecha', dis.fechaX, dis.fechaBase);
      texto(`: ${d.fecha}`, dis.fechaVX, dis.fechaBase);
      texto(`Fecha proceso: ${d.fechaProceso}`, 411.8, dis.procBase);
      texto('Valor U.F.', dis.ufX, dis.ufBase);
      texto(`: ${miles(d.ufValor, 2)}`, dis.ufVX, dis.ufBase);
      if (d.llevaDolar) {
        texto('Valor USD', dis.ufX, dis.usdBase);
        texto(`: ${miles(d.usdValor, 2)}`, dis.ufVX, dis.usdBase);
      }
      linea(X_IZQ, dis.naranja, X_DER, 4, NARANJA);
      texto('Empresa', 13.5, dis.empLabBase, { negrita: true, tam: 10 });
      texto(`: ${d.empresa}`, 81, dis.empValBase, { negrita: true, tam: 10 });
      texto('Programa', 430.5, dis.progBase);
      texto(`: ${d.programa}`, 467.3, dis.progBase);
      texto('Facturado por', 13.5, dis.facBase);
      texto(`: ${d.facturadoPor}`, 76.5, dis.facBase);
      linea(X_IZQ, dis.linea1, X_DER, 1);
      texto('N° Caso', col.caso, dis.colBase);
      texto('Técnica', col.tecnica, dis.colBase);
      if (esScreening) texto('Fecha Informe', col.fecha, dis.colBase);
      else texto('Recepción', col.recepcion, dis.colBase);
      texto('N° Análisis', 488.7, dis.colBase, { der: true });
      texto('U.F. Unitario', 495.8, dis.colBase);
      texto('U.F. Total', dis.totX, dis.colBase);
      linea(X_IZQ, dis.linea2, X_DER, 1);
      // barra naranja del pie
      linea(X_IZQ, 768, X_DER, 4, NARANJA);
    };

    let y;
    const nuevaPagina = () => {
      doc.addPage({ size: [HOJA.ancho, HOJA.alto], margin: 0 });
      cabeceraPagina();
      y = primerEncabezado - BASE_ENC; // tope del primer encabezado de grupo
    };
    cabeceraPagina();
    y = primerEncabezado - BASE_ENC;

    /** Encabezados del grupo (fecha de muestreo en la versión con jornada, y centro). Se repiten al empezar una hoja nueva. */
    const encabezados = (g) => {
      if (g.fechaMuestreo && esScreening) {
        texto(`Fecha de muestreo: ${g.fechaMuestreo}`, 11.3, y + BASE_ENC, { negrita: true });
        y += ALTO_FECHA;
      }
      texto(`Centro: ${g.centro}`, 11.3, y + BASE_ENC, { negrita: true });
      y += ALTO_FILA;
    };
    /** Pone la banda en la hoja actual si cabe; si no, abre hoja nueva y repite los encabezados del grupo (como ADLSOFT). */
    const banda = (alto, g) => {
      if (y + alto <= LIMITE_CUERPO) return false;
      nuevaPagina();
      encabezados(g);
      return true;
    };

    let fechaAnterior = null;
    for (const g of d.grupos) {
      // la fecha de muestreo solo abre un encabezado nuevo cuando cambia
      const nuevaFecha = esScreening && g.fechaMuestreo && g.fechaMuestreo !== fechaAnterior;
      fechaAnterior = g.fechaMuestreo;
      if (nuevaFecha) {
        if (y + ALTO_FECHA > LIMITE_CUERPO) nuevaPagina();
        texto(`Fecha de muestreo: ${g.fechaMuestreo}`, 11.3, y + BASE_ENC, { negrita: true });
        y += ALTO_FECHA;
      }
      if (y + ALTO_FILA > LIMITE_CUERPO) {
        nuevaPagina();
        if (esScreening && g.fechaMuestreo) { texto(`Fecha de muestreo: ${g.fechaMuestreo}`, 11.3, y + BASE_ENC, { negrita: true }); y += ALTO_FECHA; }
      }
      texto(`Centro: ${g.centro}`, 11.3, y + BASE_ENC, { negrita: true });
      y += ALTO_FILA;

      // el informe agrupa por centro y caso: sube un subtotal por cada caso, y recepción y caso solo se repiten al cambiar de grupo o de hoja
      let casoActual = null;
      let subtotalCaso = 0;
      let primeraDeGrupo = true;
      let fechaInformeAnterior = null;
      let inicioFecha = true; // primera línea del centro o de una hoja
      const cerrarCaso = () => {
        if (casoActual === null) return;
        if (y + ALTO_PIE_CASO > LIMITE_CUERPO) { nuevaPagina(); encabezados(g); primeraDeGrupo = true; }
        linea(524.25, y, 583.5, 1);
        texto(num3(roundVfp(subtotalCaso, 2)), COL.totDer, y + dis.subtotalDy, { negrita: true, der: true });
        y += ALTO_PIE_CASO;
      };
      for (const f of g.filas) {
        if (f.caso !== casoActual) {
          cerrarCaso();
          casoActual = f.caso;
          if (!d.variante.jornada) subtotalCaso = 0; // con jornada el subtotal se acumula dentro del centro (H-93)
          primeraDeGrupo = true;
        }
        if (banda(ALTO_FILA, g)) { primeraDeGrupo = true; inicioFecha = true; }
        const base = y + BASE_FILA;
        // con jornada la fecha de informe solo sale cuando cambia (o al empezar el centro o la hoja); sin jornada sale en la primera línea de cada caso
        const imprimeFecha = d.variante.jornada ? inicioFecha || f.fechaInforme !== fechaInformeAnterior : primeraDeGrupo;
        if (esScreening && imprimeFecha) texto(f.fechaInforme, col.fecha, base);
        fechaInformeAnterior = f.fechaInforme;
        inicioFecha = false;
        if (primeraDeGrupo) {
          if (!esScreening) texto(f.recepcion, col.recepcion, base);
          texto(f.caso, col.caso, base);
        }
        texto(f.tecnica, col.tecnica, base);
        texto(blancoSiCero(f.nAnalisis, 0), COL.nDer, base, { der: true });
        texto(blancoSiCero(f.ufUni, 3), COL.uniDer, base, { der: true });
        texto(blancoSiCero(f.ufTot, 3), COL.totDer, base, { der: true });
        subtotalCaso += f.ufTot;
        primeraDeGrupo = false;
        y += ALTO_FILA;
      }
      cerrarCaso();

      if (y + dis.altoPieCentro > LIMITE_CUERPO) { nuevaPagina(); encabezados(g); }
      const px = dis.pieCentroX;
      texto('TOTAL CENTRO', px.etiqueta, y + dis.pieCentroEtqDy, { negrita: true });
      texto('$:', px.pesos, y + dis.pieCentroEtqDy, { negrita: true });
      texto(miles(g.totalPesos), px.pesosDer, y + dis.pieCentroValDy, { negrita: true, der: true });
      texto('U.F.:', px.ufEtq, y + dis.pieCentroValDy, { negrita: true });
      texto(num3(g.totalUf), px.ufDer, y + dis.pieCentroValDy, { negrita: true, der: true });
      y += dis.altoPieCentro;
    }

    // Totales generales
    if (y + ALTO_RESUMEN > LIMITE_CUERPO) nuevaPagina();
    const yl = y + dis.lineaResumenDy;
    linea(X_IZQ, yl, X_DER, 1);
    const total = (etiqueta, valor, base) => {
      texto(etiqueta, 488.25, base, { negrita: true, der: true });
      texto(valor, 582.75, base, { negrita: true, der: true });
    };
    total('TOTAL GENERAL U.F.', num3(d.totalUf), yl + dis.totGenDy);
    if (d.llevaDolar) total('TOTAL GENERAL USD', miles(d.usdTotalCasos, 2), yl + dis.totGenDy + 14.25);
    total('TOTAL NETO $', miles(d.neto), yl + dis.netoDy);
    total('IVA $', miles(d.iva), yl + dis.ivaDy);
    total('TOTAL $', miles(d.total), yl + dis.totalDy);

    // Pie de cada hoja: fecha del informe y N° de página
    const paginas = doc.bufferedPageRange();
    const pie = dis.piePie;
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(paginas.start + i);
      texto(`Informe:  ${fechaHora(ahora)}`, 9, pie.base, { tam: 7, fuente: pie.fuente });
      const pag = `Página:  ${i + 1}  de  ${paginas.count}`;
      texto(pag, pie.paginaX, pie.base, { tam: 7, fuente: pie.fuente, der: !pie.paginaIzq });
    }
    doc.end();
  });
}
