/**
 * Núcleo de la valorización de Salud: réplica del recorrido por líneas del doble clic de fac_prefacturacion_new_v6.scx (ADLSOFT).
 *
 * Es lógica sin acceso directo a la base: las consultas de precios (procedimientos de ADLSOFT) entran por un `repo` inyectado,
 * así se puede probar cada regla con respuestas simuladas. ADLSOFT decide el precio según el programa DE CADA CASO
 * (muestras.id_programa) y según la lista de precios de la empresa; la cantidad, según el tipo de cobro de la técnica.
 */

// Qué columna de mae_tecnica lee cada lista de precios de la empresa (mae_empresaservicios.precio_lista).
const COLUMNA_POR_LISTA = {
  'precio lista': 'precio_lista',
  'precio convenio': 'precio_lista_menos',
  'precio adl': 'precio_lista_adl',
  'precio recargo': 'precio_lista_mas'
};

/** Columna de precio de la lista de la empresa, o null si la lista no es una de las cuatro (ADLSOFT no valoriza esos casos). */
export function columnaDeLista(precioLista) {
  return COLUMNA_POR_LISTA[String(precioLista ?? '').trim().toLowerCase()] || null;
}

export const PROGRAMA = {
  PVA: 1, SCREENING: 2, SERVICIO_DIAGNOSTICO: 3, ID: 4, CISA: 5, SALMON_CHILE: 6, LABORATORIO: 7, ATV: 8, MAMB: 9, SRS: 10, SAMIC: 18, CALIGUS: 19
};

// Tipos de agua de PVA: mar (5, 6) y dulce (2, 4, 15, 16, 17); cualquier otro se cobra como mar.
const TIPOAGUA_DULCE = [2, 4, 15, 16, 17];

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const txt = (v) => String(v ?? '').trim();
const cuatro = (v) => Math.round((num(v) + Number.EPSILON) * 1e6) / 1e6;

/** Un caso de proyecto (programa 3 o 4 con id_proyecto) se cobra entero con la tarifa del proyecto. */
export const esCasoDeProyecto = (caso) => num(caso.id_proyecto) > 0 && [PROGRAMA.SERVICIO_DIAGNOSTICO, PROGRAMA.ID].includes(num(caso.id_programa));

/**
 * Derivaciones y secciones 10/13: si no son de ensilaje ni de PROA, ADLSOFT NO las vuelve a valorizar. Con valor previo
 * (cantidad, unitario y total mayores que 0) lo conserva y la línea entra a la factura; sin valor previo la deja fuera (mf = 0).
 */
export function esLineaDerivada(caso, linea) {
  return txt(caso.proa) === 'N' && txt(caso.ensilaje) === 'N'
    && (num(linea.id_seccion) === 10 || num(linea.id_seccion) === 13 || txt(linea.sederiva) === 'S');
}
export const tieneValorPrevio = (linea) => num(linea.n_analisis) > 0 && num(linea.vtaunitario) > 0 && num(linea.vtatotal) > 0;

/**
 * Cantidad y total de una línea según el tipo de cobro de su técnica (tabla del doble clic).
 *  - variante 'principal': recorrido normal; 'proyecto': recorrido de casos de proyecto (en multiplex deja la cantidad).
 * Los tipos 9, 10 y 11 no hacen nada en ADLSOFT (quedan con lo de la línea anterior) y ninguna línea pendiente los usa: aquí
 * dan cero. El tipo 12 (Rango) es ATBPlex y se valoriza aparte.
 */
export function cantidadYTotal({ idTipoCobro, linea, caso, xvta, variante = 'principal', nIdentificaciones = 0 }) {
  const ind = num(linea.ind_nmuestras);
  const pol = num(linea.pol_npooles);
  let n = 0;
  let precio = num(xvta);
  let total = 0;

  switch (num(idTipoCobro)) {
    case 1: // Pez
      n = txt(linea.tipoingreso) === 'INDIVIDUAL' ? ind : pol;
      total = n * precio;
      break;
    case 2: // Muestra
    case 3: // Cada uno
    case 5: // Tejido
    case 7: // Aislado
      n = ind;
      total = n * precio;
      break;
    case 4: // Pool
      n = pol;
      total = pol * precio;
      if (txt(caso.multiplex) === 'S' && num(linea.item) < 300) {
        // Las líneas hijas de un multiplex no se cobran
        total = 0;
        precio = 0;
        if (variante === 'principal') n = 0;
      }
      break;
    case 6: { // Placa y medio: placas necesarias según las muestras que caben en cada placa
      const porPlaca = num(linea.muestrasxplaca);
      if (ind > 0 && num(linea.id_medios) > 1 && porPlaca > 0) {
        const razon = ind / porPlaca;
        if (ind % porPlaca > 0) n = Math.floor(razon) + 1;
        else n = razon < 0.4 ? 1 : razon;
      }
      total = n * precio;
      break;
    }
    case 8: // Identificación: cuántas identificaciones tiene el caso
      n = nIdentificaciones > 0 ? nIdentificaciones : 0;
      total = n * precio;
      break;
    case 0: // NA
    default:
      n = 0;
      total = 0;
  }
  return { nAnalisis: n, vtaUnitario: cuatro(precio), vtaTotal: cuatro(total) };
}

/** Las técnicas 316 y 317 (Viabilidad ADLMag) se cobran siempre como 1. */
export function aplicaExcepcionViabilidad(idTecnica, resultado) {
  if (num(idTecnica) === 316 || num(idTecnica) === 317) {
    return { ...resultado, nAnalisis: 1, vtaTotal: cuatro(resultado.vtaUnitario * 1) };
  }
  return resultado;
}

/**
 * Precio unitario de una línea y tipo de cobro, según el programa del caso. Devuelve
 * { xvta, idTipoCobro, regla, sinCostoOperativo }. `repo` entrega las filas de cada procedimiento de precios de ADLSOFT.
 */
export async function resolverPrecioLinea({ caso, linea, columna, poolOIndv }, repo) {
  const es = num(caso.id_empresaservicio);
  const empresa = num(caso.id_empresa);
  const centro = num(caso.id_centro);
  const especie = num(caso.id_especie);
  const idProg = num(caso.id_programa);
  const nombreTec = txt(linea.nombre_tecnica);
  // Las técnicas "RT-PCR-ELF…" se cobran con la tarifa de la técnica 193
  const tec = nombreTec.slice(0, 10) === 'RT-PCR-ELF' ? 193 : num(linea.id_tecnica);

  const nulo = (regla) => ({ xvta: 0, idTipoCobro: 0, regla, sinCostoOperativo: false });
  const fila = (rows) => (rows && rows.length ? rows[0] : null);
  const delaLista = async (regla) => {
    const r = fila(await repo.precioLista(tec));
    return r ? { xvta: num(r[columna]), idTipoCobro: num(r.id_tipocobro), regla, sinCostoOperativo: false } : nulo(regla);
  };
  const especialOLista = async (reglaEsp, reglaLista) => {
    if (txt(caso.precio_especial) === 'S') {
      const r = fila(await repo.precioEspecial(es, tec));
      if (r) return { xvta: num(r.precio_especial), idTipoCobro: num(r.id_tipocobro), regla: reglaEsp, sinCostoOperativo: false };
    }
    return delaLista(reglaLista);
  };

  switch (idProg) {
    case PROGRAMA.PVA: {
      const lista = fila(await repo.tipoListaPva(es));
      if (!lista) return nulo('PVA sin tipo de lista');
      const tipo = txt(lista.tipo_lista);
      const rows = tipo === 'General' ? await repo.precioPva(es, tec)
        : tipo === 'Por centro' ? await repo.precioPvaPorCentro(es, tec, centro) : [];
      const r = fila(rows);
      if (!r) return nulo(`PVA ${tipo}: sin tarifa`);
      const dulce = TIPOAGUA_DULCE.includes(num(caso.id_tipoagua));
      return { xvta: num(dulce ? r.uf_ad : r.uf_am), idTipoCobro: num(r.id_tipocobro), regla: `PVA ${tipo} (${dulce ? 'agua dulce' : 'agua mar'})`, sinCostoOperativo: false };
    }

    case PROGRAMA.SCREENING: {
      const r = fila(txt(caso.multiplex) === 'S'
        ? await repo.precioScreeningMultiplex(es, empresa, centro, especie, tec)
        : await repo.precioScreening(es, empresa, centro, especie, tec));
      if (!r) return nulo('Screening: sin tarifa');
      // Costo veterinario y costo operativo (281 y 282) siguen la modalidad del caso; el resto, la de cada línea.
      const modalidad = tec === 281 || tec === 282 ? poolOIndv : txt(linea.tipoingreso);
      const conApertura = txt(caso.apertura) === 'S';
      if (modalidad === 'INDIVIDUAL') {
        return { xvta: num(conApertura ? r.uf_individual_ap : r.uf_individual), idTipoCobro: num(r.id_tipocobro), regla: 'Screening individual', sinCostoOperativo: false };
      }
      if (modalidad === 'POOLES') {
        return { xvta: num(conApertura ? r.uf_pool_ap : r.uf_pool), idTipoCobro: num(r.id_tipocobro), regla: 'Screening pool', sinCostoOperativo: false };
      }
      return nulo('Screening: modalidad sin definir');
    }

    case PROGRAMA.SERVICIO_DIAGNOSTICO: {
      if (txt(caso.ensilaje) === 'S') {
        const r = fila(await repo.precioEnsilaje(es, empresa, centro, tec));
        if (!r) return { ...nulo('Ensilaje: sin tarifa'), sinCostoOperativo: true };
        const conCoOficial = ((await repo.costoOperativoEnsilaje(num(caso.id_lugaranalisis), txt(caso.fecha_muestreo), es, centro)) || []).length > 0;
        let xvta;
        let regla;
        if (conCoOficial) { xvta = num(r.uf_normativo); regla = 'Ensilaje normativo (con visita oficial)'; }
        else if (num(caso.id_veterinario) === 33) { xvta = num(r.uf_derivacion); regla = 'Ensilaje derivación (ingresado por el cliente)'; }
        else { xvta = num(r.uf_nonormativo); regla = 'Ensilaje no normativo'; }
        return { xvta, idTipoCobro: num(r.id_tipocobro), regla, sinCostoOperativo: true };
      }
      if (txt(caso.proa) === 'S') {
        const r = fila(await repo.precioProa(es, empresa, centro, tec));
        if (r) return { xvta: num(r.uf), idTipoCobro: num(r.id_tipocobro), regla: 'Tarifa PROA', sinCostoOperativo: true };
        return { ...(await delaLista('PROA sin tarifa: precio de lista')), sinCostoOperativo: true };
      }
      if (txt(linea.pack) === 'S') {
        const r = fila(await repo.precioPack(num(linea.id_pack), es, tec));
        if (r) return { xvta: num(r.valor), idTipoCobro: num(r.id_tipocobro), regla: `Pack ${linea.id_pack}`, sinCostoOperativo: false };
        return nulo(`Pack ${linea.id_pack}: sin tarifa`);
      }
      return especialOLista('Precio especial', 'Precio de lista');
    }

    case PROGRAMA.CALIGUS:
    case PROGRAMA.ID:
    case PROGRAMA.LABORATORIO:
      return especialOLista('Precio especial', 'Precio de lista');

    case PROGRAMA.ATV:
      return delaLista('Precio de lista (ATV)');

    case PROGRAMA.CISA:
    case PROGRAMA.SRS: {
      const srs = idProg === PROGRAMA.SRS;
      const lista = fila(await (srs ? repo.tipoListaSrs(es) : repo.tipoListaCisa(es)));
      if (!lista) return nulo(`${srs ? 'SRS' : 'CISA'} sin tipo de lista`);
      const tipo = txt(lista.tipo_lista);
      const rows = tipo === 'General' ? await (srs ? repo.precioSrs(es, tec) : repo.precioCisa(es, tec))
        : tipo === 'Por centro' ? await (srs ? repo.precioSrsPorCentro(es, tec, centro) : repo.precioCisaPorCentro(es, tec, centro)) : [];
      const r = fila(rows);
      if (!r) return nulo(`${srs ? 'SRS' : 'CISA'} ${tipo}: sin tarifa`);
      return { xvta: num(r.uf_pool), idTipoCobro: num(r.id_tipocobro), regla: `${srs ? 'SRS' : 'CISA'} ${tipo}`, sinCostoOperativo: false };
    }

    case PROGRAMA.SALMON_CHILE: {
      const r = fila(await repo.precioCisa(es, tec));
      return r ? { xvta: num(r.uf_pool), idTipoCobro: num(r.id_tipocobro), regla: 'Programa Salmón Chile', sinCostoOperativo: false } : nulo('Salmón Chile: sin tarifa');
    }

    case PROGRAMA.MAMB: {
      const r = fila(await repo.precioMedioAmbiente(es, empresa, centro, num(linea.id_tablama), tec));
      return r ? { xvta: num(r.uf_individual), idTipoCobro: num(r.id_tipocobro), regla: 'Medio Ambiente', sinCostoOperativo: false } : nulo('Medio Ambiente: sin tarifa');
    }

    case PROGRAMA.SAMIC: {
      const r = fila(await repo.precioSamic(es, empresa, centro, tec));
      return r ? { xvta: num(r.uf), idTipoCobro: num(r.id_tipocobro), regla: 'SAMIC', sinCostoOperativo: false } : nulo('SAMIC: sin tarifa');
    }

    default:
      return nulo(`Programa ${idProg} sin regla de precio`);
  }
}

/** Precio de una línea de un caso de proyecto: tarifa del proyecto, individual o pool según la línea; sin tarifa = 0. */
export async function resolverPrecioProyecto({ caso, linea }, repo) {
  const r = (await repo.precioProyecto(num(caso.id_empresaservicio), num(caso.id_proyecto), num(linea.id_tecnica)) || [])[0];
  if (!r) return { xvta: 0, idTipoCobro: 0, regla: 'Proyecto: sin tarifa', sinCostoOperativo: false };
  const modalidad = txt(linea.tipoingreso);
  const xvta = modalidad === 'INDIVIDUAL' ? num(r.uf_individual) : modalidad === 'POOLES' ? num(r.uf_pool) : 0;
  return { xvta, idTipoCobro: num(r.id_tipocobro), regla: `Proyecto ${caso.id_proyecto}`, sinCostoOperativo: false };
}

/** En Screening, la modalidad (individual o pool) del costo veterinario y operativo la fija la técnica 146 del caso; sin ella, pool. */
export function modalidadScreening(caso) {
  if (num(caso.id_programa) !== PROGRAMA.SCREENING) return '';
  const l146 = (caso.lineas || []).find((l) => num(l.id_tecnica) === 146);
  return l146 ? txt(l146.tipoingreso) : 'POOLES';
}
