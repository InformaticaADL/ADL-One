/**
 * Lógica pura (sin acceso a base de datos) de la creación de pre-facturas de Salud.
 * Réplica de fac_unaempresa_v4.scx de ADLSOFT (botones "Pre-ver Facturación" y "Facturar").
 *
 * En ADLSOFT el agrupamiento no se calcula en pantalla: se ejecuta un procedimiento almacenado de pre-visualización según el
 * combo de programas, el criterio de agrupación y el programa elegido; el formulario recorre sus líneas y, cada vez que
 * aparece un grupo nuevo (por programa, centro, veterinario, etc.), le asigna el siguiente N° de facturación.
 */

// Criterio de agrupación (texto de la pantalla) -> sufijo del procedimiento almacenado.
export const SUFIJO_SP_CRITERIO = {
  'Na': 'na',
  'Centro': 'centro',
  'Veterinario': 'veterinario',
  'Centro - Veterinario': 'centroveterinario',
  'Tipo de Agua': 'tagua',
  'Tipo de Agua - Veterinario': 'taguaveterinario'
};

// eligeprograma de la pantalla de facturación -> nombre del programa dentro del procedimiento.
const NOMBRE_SP_PROGRAMA = {
  1: 'pva',
  2: 'screening',
  3: 'cisa_pvs',
  4: 'sd_atv',
  5: 'id',
  6: 'il',
  8: 'samic',
  9: 'caligus'
};

// Combo "Programas Oficiales" (PVA, Screening, Cisa-PVS-SRS, SAMIC, Caligus) frente a "Programas Servicios y Otros"
// (SDiag-ATV, I+D, ILab, Mamb). Cada combo muestra criterios distintos: los oficiales no ofrecen "Tipo de Agua".
export const PROGRAMAS_OFICIALES = [1, 2, 3, 8, 9];
export const CRITERIOS_OFICIALES = ['Na', 'Centro', 'Veterinario', 'Centro - Veterinario'];
export const CRITERIOS_PREFACTURA = Object.keys(SUFIJO_SP_CRITERIO);

export function esProgramaOficial(eligeprograma) {
  return PROGRAMAS_OFICIALES.includes(Number(eligeprograma));
}

/** Criterios que ADLSOFT ofrece para el programa dado. */
export function criteriosDisponibles(eligeprograma) {
  return esProgramaOficial(eligeprograma) ? CRITERIOS_OFICIALES : CRITERIOS_PREFACTURA;
}

/**
 * Nombre del procedimiento de pre-visualización que ADLSOFT ejecuta para esa combinación.
 * Lanza un error claro si la combinación no existe o está rota en ADLSOFT.
 */
export function nombreSpPrever(eligeprograma, criterio) {
  const prog = Number(eligeprograma);
  const nombreProg = NOMBRE_SP_PROGRAMA[prog];
  if (!nombreProg) {
    throw new Error(`El programa ${eligeprograma} no se factura desde Salud (ADLSOFT: Medio Ambiente va por otra pantalla).`);
  }
  const sufijo = SUFIJO_SP_CRITERIO[criterio];
  if (!sufijo) {
    throw new Error(`Criterio de agrupación no válido: "${criterio}". Opciones: ${CRITERIOS_PREFACTURA.join(', ')}.`);
  }
  if (!criteriosDisponibles(prog).includes(criterio)) {
    throw new Error(`El criterio "${criterio}" no está disponible para este programa (en ADLSOFT solo se ofrece: ${criteriosDisponibles(prog).join(', ')}).`);
  }
  // SDiag-ATV + "Tipo de Agua - Veterinario": ADLSOFT llama a un procedimiento que no existe en la base
  // (sd_atv_taguaveterinario_detalle; el real se llama sd_atv_taguaveterianrio_detalle, con un error de tipeo). En ADLSOFT esa
  // opción no devuelve nada; aquí se avisa en vez de fallar en silencio.
  if (prog === 4 && criterio === 'Tipo de Agua - Veterinario') {
    throw new Error('ADLSOFT no tiene un procedimiento válido para SDiag-ATV con "Tipo de Agua - Veterinario" (la opción no funciona allá). Elige otro criterio.');
  }
  // ILab + "Tipo de Agua - Veterinario": ADLSOFT usa el procedimiento de I+D (id) en vez del de ILab. Se replica tal cual.
  if (prog === 6 && criterio === 'Tipo de Agua - Veterinario') {
    return 'fac_prever_programa_id_taguaveterinario_detalle';
  }
  return `fac_prever_programa_${nombreProg}_${sufijo}_detalle`;
}

const rt = (v) => String(v ?? '').replace(/\s+$/, '');

/**
 * Clave del grupo al que pertenece una línea según el criterio. Es la misma comparación (LOCATE) que hace ADLSOFT:
 * Na = programa; Centro = id_centro; Veterinario = cliente_entrega; Tipo de Agua = id_tipoagua; y sus combinaciones.
 */
export function claveGrupoPrefactura(criterio, linea) {
  switch (criterio) {
    case 'Centro': return `C:${linea.id_centro}`;
    case 'Veterinario': return `V:${rt(linea.cliente_entrega)}`;
    case 'Centro - Veterinario': return `C:${linea.id_centro}|V:${rt(linea.cliente_entrega)}`;
    case 'Tipo de Agua': return `A:${linea.id_tipoagua}`;
    case 'Tipo de Agua - Veterinario': return `A:${linea.id_tipoagua}|V:${rt(linea.cliente_entrega)}`;
    case 'Na':
    default: return `P:${linea.id_programa}`;
  }
}

/** Texto con que se muestra el grupo en la pre-visualización. */
export function etiquetaGrupoPrefactura(criterio, linea) {
  const vet = rt(linea.cliente_entrega) || 'Sin veterinario';
  const centro = rt(linea.nombre_centro) || `Centro ${linea.id_centro}`;
  const agua = rt(linea.nombre_tipoagua) || `Tipo de agua ${linea.id_tipoagua}`;
  switch (criterio) {
    case 'Centro': return centro;
    case 'Veterinario': return vet;
    case 'Centro - Veterinario': return `${centro} · ${vet}`;
    case 'Tipo de Agua': return agua;
    case 'Tipo de Agua - Veterinario': return `${agua} · ${vet}`;
    case 'Na':
    default: return rt(linea.nombre_programa) || `Programa ${linea.id_programa}`;
  }
}

/**
 * Recorre las líneas que devolvió el procedimiento (en su orden) y arma los grupos. Solo cuentan las líneas de los casos
 * marcados por el usuario. Cada grupo nuevo recibe el siguiente N° de facturación a partir de `idBase` (el valor actual de
 * Mae_id.id_facturacion): el primer grupo es idBase + 1, igual que en ADLSOFT.
 *
 * @returns {{ grupos: Array, lineas: Array<{id_facturacion:number,id_caso:number,id_tecnica:number,item:number}> }}
 */
export function agruparLineasPrefactura(lineas, criterio, casosSeleccionados, idBase) {
  const marcados = casosSeleccionados instanceof Set
    ? casosSeleccionados
    : new Set((casosSeleccionados || []).map(Number));
  const grupos = new Map();
  const asignadas = [];
  let idActual = Number(idBase);

  for (const l of lineas || []) {
    const idCaso = Number(l.id_caso);
    if (!marcados.has(idCaso)) continue;

    const clave = claveGrupoPrefactura(criterio, l);
    let g = grupos.get(clave);
    if (!g) {
      idActual += 1;
      g = {
        clave,
        id_facturacion: idActual,
        etiqueta: etiquetaGrupoPrefactura(criterio, l),
        casos: new Set(),
        total_lineas: 0,
        uf_total: 0
      };
      grupos.set(clave, g);
    }
    g.casos.add(idCaso);
    g.total_lineas += 1;
    g.uf_total += Number(l.vtatotal) || 0;

    asignadas.push({
      id_facturacion: g.id_facturacion,
      id_caso: idCaso,
      id_tecnica: Number(l.id_tecnica),
      item: Number(l.item)
    });
  }

  return {
    grupos: [...grupos.values()].map((g) => ({
      clave: g.clave,
      id_facturacion: g.id_facturacion,
      etiqueta: g.etiqueta,
      total_casos: g.casos.size,
      total_lineas: g.total_lineas,
      uf_total: Math.round((g.uf_total + Number.EPSILON) * 100) / 100
    })),
    lineas: asignadas
  };
}

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

/**
 * Campo `mes` de facturacion_enc. En ADLSOFT es el texto de un combo con mes y año ("OCTUBRE 2025").
 * Si no se indica, se toma el mes de la fecha de facturación (dd/mm/aaaa).
 */
export function textoMesFacturacion(mes, ano, fechaFacturacionDmy) {
  const m = String(mes || '').trim().toUpperCase();
  const a = String(ano || '').trim();
  if (m) return (/\d{4}/.test(m) || !a ? m : `${m} ${a}`).slice(0, 20);
  const partes = String(fechaFacturacionDmy || '').split('/');
  const idx = Number(partes[1]) - 1;
  if (idx >= 0 && idx < 12 && /^\d{4}$/.test(partes[2] || '')) return `${MESES[idx]} ${partes[2]}`;
  return '';
}

/** Redondeos de FoxPro (ROUND): a la mitad se aleja del cero. */
export const redondea = (n, dec = 0) => {
  const f = 10 ** dec;
  const v = Number(n) || 0;
  return (Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * f)) / f;
};

/** Divide una lista en trozos (para no armar sentencias gigantes). */
export function enTrozos(lista, tam) {
  const out = [];
  for (let i = 0; i < lista.length; i += tam) out.push(lista.slice(i, i + tam));
  return out;
}

// ──────────────────────────────────────────────────────────────────────────────────────────────────
// Elegibilidad: procedimientos que ADLSOFT ejecuta en fac_prefacturacion_new_v6 (botón "Procesar" y doble clic en la empresa).
// ──────────────────────────────────────────────────────────────────────────────────────────────────

const SUFIJO_SP_ELEGIBILIDAD = { 1: 'pva', 2: 'screening', 3: 'cisa_pvs', 5: 'id', 6: 'il', 8: 'samic', 9: 'caligus' };

/**
 * Sufijo de los procedimientos de elegibilidad según el programa elegido. SDiag-ATV tiene tres variantes; si se marcan
 * ensilaje y PROA a la vez, ADLSOFT atiende primero ensilaje.
 */
export function sufijoSpElegibilidad(eligeprograma, { ensilaje = false, proa = false } = {}) {
  const n = Number(eligeprograma);
  if (n === 4) return ensilaje ? 'sd_atv_ensilaje' : proa ? 'sd_atv_proa' : 'sd_atv';
  const sufijo = SUFIJO_SP_ELEGIBILIDAD[n];
  if (!sufijo) throw new Error(`El programa ${eligeprograma} no se factura desde Salud (ADLSOFT: Medio Ambiente va por otra pantalla).`);
  return sufijo;
}

/** Procedimiento que lista las EMPRESAS con datos por facturar (botón "Procesar"). Parámetros: fechaini, fechafin. */
export const nombreSpEmpresas = (eligeprograma, opciones) => `fac_agrupaempresa_entrefechas_${sufijoSpElegibilidad(eligeprograma, opciones)}`;

/** Procedimiento que lista los CASOS de una empresa (doble clic). Parámetros: id_empresaservicio, fechaini, fechafin. */
export const nombreSpCasos = (eligeprograma, opciones) => `fac_agrupaempresacasos_entrefechas_${sufijoSpElegibilidad(eligeprograma, opciones)}`;

/** ATBPlex (SDiag-ATV normal) se valoriza en un paso previo con sus propios procedimientos; no entra en el recorrido por caso. */
export const ID_TECNICA_ATBPLEX = 647;
export const aplicaAtbplex = (eligeprograma, { ensilaje = false, proa = false } = {}) => Number(eligeprograma) === 4 && !ensilaje && !proa;

/** Elige el tramo de precio de ATBPlex donde cae la cantidad de pools (LOCATE de ADLSOFT: desde <= pools <= hasta). */
export function tramoDePrecioPorRango(tramos, pools) {
  const p = Number(pools);
  return (tramos || []).find((t) => p >= Number(t.rangodesde) && p <= Number(t.rangohasta)) || null;
}

/** Ejecuta `fn` sobre cada elemento con a lo más `limite` en paralelo (para no saturar el servidor del LIMS). */
export async function mapConLimite(items, limite, fn) {
  const lista = [...items];
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < lista.length) {
      const i = siguiente++;
      await fn(lista[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limite), lista.length) }, trabajador));
}
