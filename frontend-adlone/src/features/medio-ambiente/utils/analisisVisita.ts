/**
 * Lógica pura (sin React) de «Análisis y precio» de una visita con varios puntos.
 *
 * Modelo: una visita tiene N puntos (una ficha por punto) y una lista de parámetros. Cada parámetro dice en qué
 * puntos se mide (`en`) y cuánto cuesta en cada uno (`u`, en centésimas de UF para no arrastrar decimales).
 * El valor de un punto y el total de la visita SIEMPRE son la suma de lo que hay en los parámetros: el reparto rápido
 * solo sirve para partir de un valor, después todo se edita libremente.
 *
 * El costo operativo es uno por visita y se suma aparte; el backend lo reparte entre las fichas (createFichaGrupo).
 */

/** Laboratorio 3 queda oculto hasta que exista la columna en la base (hoy solo hay id_laboratorioensayo e _2). */
export const LABORATORIOS_MAXIMOS = 2;

export type TipoParametro = 'laboratorio' | 'terreno';

export interface ParametroVisita {
    /** Identificador propio dentro de la pantalla. */
    id: string;
    tipo: TipoParametro;
    nombre: string;
    nombreNormativa: string;
    nombreTabla: string;
    /** Fila del catálogo tal como la entrega la API (id_referenciaanalisis, id_tecnica, límites, errores, etc.). */
    base: Record<string, any>;
    /** Laboratorio 1 (obligatorio en laboratorio) y laboratorio 2 (opcional). 0 = ninguno. */
    idLab1: number;
    idLab2: number;
    /** Tipo de entrega (en terreno es siempre «Directa»). */
    idTipoEntrega: number;
    /** Por punto (clave = id del punto): si el parámetro se mide ahí y su precio en centésimas de UF. */
    en: Record<string, boolean>;
    u: Record<string, number>;
    /** pH y Temperatura vienen de partida sin normativa/tabla: se eligen entre `opciones`; sin elegir no se envían. */
    fijo?: boolean;
    opciones?: any[];
}

export type IdPunto = string;

export interface ModoReparto {
    /** 'visita': un valor para toda la visita (se divide entre los puntos). 'punto': un valor para cada punto. */
    tipo: 'visita' | 'punto';
    /** En centésimas de UF. */
    valor: number;
}

// ─── Números ─────────────────────────────────────────────────────────────────────────────────────────

/** UF (número o texto, con coma o punto) → centésimas enteras. */
export const aCentesimas = (v: unknown): number => {
    const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
export const aUF = (centesimas: number): number => Math.round(centesimas) / 100;
export const formatoUF = (centesimas: number): string =>
    (centesimas / 100).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Divide `total` (entero) en `n` partes que suman exactamente `total`; el resto va de a 1 desde la primera. */
export function partir(total: number, n: number): number[] {
    if (n <= 0) return [];
    const t = Math.round(total);
    const base = Math.floor(t / n);
    const resto = t - base * n;
    return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

// ─── Consultas ───────────────────────────────────────────────────────────────────────────────────────

export const estaEn = (p: ParametroVisita, punto: IdPunto): boolean => !!p.en[punto];
export const cantidadDePuntos = (p: ParametroVisita): number => Object.values(p.en).filter(Boolean).length;

/** Valor de un punto = suma de sus parámetros (centésimas, sin costo operativo). */
export const totalDelPunto = (params: ParametroVisita[], punto: IdPunto): number =>
    params.reduce((s, p) => s + (estaEn(p, punto) ? p.u[punto] || 0 : 0), 0);

export const totalesPorPunto = (params: ParametroVisita[], puntos: IdPunto[]): Record<IdPunto, number> => {
    const r: Record<IdPunto, number> = {};
    for (const id of puntos) r[id] = totalDelPunto(params, id);
    return r;
};

export const sumaDeLosPuntos = (params: ParametroVisita[], puntos: IdPunto[]): number =>
    puntos.reduce((s, id) => s + totalDelPunto(params, id), 0);

/** Total de la visita = suma de los puntos + costo operativo (una sola vez). */
export const totalDeLaVisita = (params: ParametroVisita[], puntos: IdPunto[], costoOperativo: number): number =>
    sumaDeLosPuntos(params, puntos) + Math.max(0, costoOperativo);

// ─── Reparto rápido ──────────────────────────────────────────────────────────────────────────────────

/** Reparte `centesimas` en partes iguales entre los parámetros que se miden en el punto (modifica `params`). */
export function repartirEnPunto(params: ParametroVisita[], punto: IdPunto, centesimas: number): void {
    const aqui = params.filter((p) => estaEn(p, punto));
    if (aqui.length === 0) return;
    partir(Math.max(0, centesimas), aqui.length).forEach((c, i) => { aqui[i].u[punto] = c; });
}

/**
 * Reparto rápido de toda la visita. 'visita': el valor se divide entre los puntos y cada punto entre sus parámetros
 * (el costo operativo NO entra: se suma aparte). 'punto': cada punto recibe ese valor.
 */
export function repartirVisita(params: ParametroVisita[], puntos: IdPunto[], modo: ModoReparto): void {
    const porPunto = modo.tipo === 'visita' ? partir(Math.max(0, modo.valor), puntos.length) : puntos.map(() => Math.max(0, modo.valor));
    puntos.forEach((id, i) => repartirEnPunto(params, id, porPunto[i]));
}

// ─── Cambios de puntos y parámetros ──────────────────────────────────────────────────────────────────

const claveNueva = (() => { let n = 0; return () => `p${Date.now().toString(36)}${(n++).toString(36)}`; })();
export const idNuevoParametro = (): string => claveNueva();

/** Un punto nuevo parte con los mismos parámetros y precios que el punto de referencia (el último, normalmente). */
export function alAgregarPunto(params: ParametroVisita[], nuevo: IdPunto, referencia?: IdPunto): void {
    for (const p of params) {
        p.en[nuevo] = referencia ? !!p.en[referencia] : true;
        p.u[nuevo] = referencia ? p.u[referencia] || 0 : 0;
    }
}

/** Al quitar un punto se olvidan sus datos; el parámetro que quede sin ningún punto desaparece. */
export function alQuitarPunto(params: ParametroVisita[], punto: IdPunto): ParametroVisita[] {
    for (const p of params) { delete p.en[punto]; delete p.u[punto]; }
    return params.filter((p) => cantidadDePuntos(p) > 0);
}

/** Copia los parámetros y precios de un punto a los demás. */
export function copiarPuntoATodos(params: ParametroVisita[], desde: IdPunto, puntos: IdPunto[]): ParametroVisita[] {
    for (const p of params) {
        const aqui = estaEn(p, desde);
        const precio = p.u[desde] || 0;
        for (const id of puntos) {
            if (id === desde) continue;
            p.en[id] = aqui;
            p.u[id] = aqui ? precio : 0;
        }
    }
    return params.filter((p) => cantidadDePuntos(p) > 0);
}

export interface NuevoParametro {
    tipo: TipoParametro;
    fila: Record<string, any>;
    idLab1?: number;
    idLab2?: number;
    idTipoEntrega: number;
    /** Precio de partida en centésimas. */
    precio?: number;
}

/**
 * Agrega parámetros en los puntos indicados. Si el parámetro ya existe (mismo análisis del catálogo y mismo tipo) solo se
 * activa en los puntos donde faltaba, con el precio que ya tenía; si no, se crea.
 */
export function agregarParametros(
    params: ParametroVisita[],
    nuevos: NuevoParametro[],
    donde: IdPunto[],
    todosLosPuntos: IdPunto[],
): ParametroVisita[] {
    const lista = [...params];
    for (const n of nuevos) {
        const refId = n.fila.id_referenciaanalisis;
        const existente = lista.find((p) => p.tipo === n.tipo && refId != null && p.base.id_referenciaanalisis === refId);
        if (existente) {
            const modelo = todosLosPuntos.find((id) => estaEn(existente, id));
            for (const id of donde) {
                if (!estaEn(existente, id)) {
                    existente.en[id] = true;
                    existente.u[id] = modelo ? existente.u[modelo] || 0 : n.precio || 0;
                }
            }
            continue;
        }
        const en: Record<string, boolean> = {};
        const u: Record<string, number> = {};
        for (const id of todosLosPuntos) {
            en[id] = donde.includes(id);
            u[id] = en[id] ? (n.tipo === 'terreno' ? 0 : n.precio || 0) : 0;
        }
        lista.push({
            id: idNuevoParametro(),
            tipo: n.tipo,
            nombre: n.fila.nombre_tecnica || n.fila.nombre || '',
            nombreNormativa: n.fila.nombre_normativa || '',
            nombreTabla: n.fila.nombre_normativareferencia || '',
            base: n.fila,
            idLab1: n.tipo === 'terreno' ? 0 : n.idLab1 || 0,
            idLab2: n.tipo === 'terreno' ? 0 : n.idLab2 || 0,
            idTipoEntrega: n.idTipoEntrega,
            en, u,
        });
    }
    return lista;
}

// ─── Conversión desde las filas que ya conoce el sistema ─────────────────────────────────────────────

/** Fila de análisis «guardado» (cotización, ficha existente) → parámetro aplicado a los puntos indicados. */
export function desdeFilaGuardada(fila: Record<string, any>, puntos: IdPunto[]): ParametroVisita {
    const esTerreno = String(fila.tipo_analisis || '').trim() === 'Terreno';
    const precio = esTerreno ? 0 : aCentesimas(fila.uf_individual);
    const en: Record<string, boolean> = {};
    const u: Record<string, number> = {};
    for (const id of puntos) { en[id] = true; u[id] = precio; }
    const base = { ...fila };
    delete base.opciones;
    delete base.savedId;
    return {
        id: idNuevoParametro(),
        tipo: esTerreno ? 'terreno' : 'laboratorio',
        nombre: fila.nombre_tecnica || fila.nombre || '',
        nombreNormativa: fila.nombre_normativa || '',
        nombreTabla: fila.nombre_normativareferencia || '',
        base,
        idLab1: esTerreno ? 0 : Number(fila.id_laboratorioensayo) || 0,
        idLab2: esTerreno ? 0 : Number(fila.id_laboratorioensayo_2) || 0,
        idTipoEntrega: Number(fila.id_tipoentrega) || 0,
        en, u,
    };
}

/** pH y Temperatura de partida (vienen del backend sin normativa/tabla, con la lista de opciones para elegir). */
export function desdeFijoPorDefecto(fila: Record<string, any>, puntos: IdPunto[]): ParametroVisita {
    const p = desdeFilaGuardada({ ...fila, tipo_analisis: 'Terreno', uf_individual: 0 }, puntos);
    p.fijo = true;
    p.opciones = Array.isArray(fila.opciones) ? fila.opciones : [];
    p.base = { ...p.base, _fijo: true };
    return p;
}

/** El usuario eligió normativa/tabla para un pH/Temperatura: se copian sus datos y límites. */
export function configurarFijo(p: ParametroVisita, idReferenciaAnalisis: string | number | null): void {
    const opt = (p.opciones || []).find((o) => String(o.id_referenciaanalisis) === String(idReferenciaAnalisis));
    const vacio = {
        id_referenciaanalisis: null, id_tecnica: null, id_normativa: null, nombre_normativa: '',
        id_normativareferencia: null, nombre_normativareferencia: '',
        limitemax_d: null, limitemax_h: null, llevaerror: 'N', error_min: null, error_max: null,
    };
    const datos = opt
        ? {
            id_referenciaanalisis: opt.id_referenciaanalisis, id_tecnica: opt.id_tecnica,
            id_normativa: opt.id_normativa, nombre_normativa: opt.nombre_normativa,
            id_normativareferencia: opt.id_normativareferencia, nombre_normativareferencia: opt.nombre_normativareferencia,
            limitemax_d: opt.limitemax_d, limitemax_h: opt.limitemax_h,
            llevaerror: opt.llevaerror, error_min: opt.error_min, error_max: opt.error_max,
        }
        : vacio;
    p.base = { ...p.base, ...datos };
    p.nombreNormativa = datos.nombre_normativa || '';
    p.nombreTabla = datos.nombre_normativareferencia || '';
}

// ─── Validación y armado para enviar ─────────────────────────────────────────────────────────────────

/** Parámetros que se enviarán: los fijos (pH/Temperatura) que no se configuraron se descartan, como hasta ahora. */
export const seEnvia = (p: ParametroVisita): boolean => !p.fijo || p.base.id_referenciaanalisis != null;

export function problemasDeParametros(params: ParametroVisita[], puntos: Array<{ id: IdPunto; nombre: string }> = []): string[] {
    const r: string[] = [];
    // Cada punto necesita al menos un parámetro: el backend, si un punto no trae análisis, le copia los del primero.
    const enviables = params.filter(seEnvia);
    if (enviables.length === 0) r.push('Agregue al menos un parámetro.');
    else for (const pt of puntos) {
        if (!enviables.some((p) => estaEn(p, pt.id))) r.push(`El punto «${pt.nombre || 'sin nombre'}» no tiene parámetros.`);
    }
    for (const p of enviables) {
        if (p.tipo === 'laboratorio') {
            if (!p.idLab1) r.push(`«${p.nombre}»: falta el laboratorio 1.`);
            if (!p.idTipoEntrega) r.push(`«${p.nombre}»: falta el tipo de entrega.`);
            if (p.idLab2 && p.idLab2 === p.idLab1) r.push(`«${p.nombre}»: el laboratorio 2 no puede ser el mismo que el 1.`);
        }
    }
    return r;
}

export interface Resolvedor {
    nombreLaboratorio: (id: number) => string;
    nombreTipoEntrega: (id: number) => string;
}

/** Filas de detalle (`analisis`) de UN punto, en el formato que ya recibe el backend. */
export function analisisDelPunto(params: ParametroVisita[], punto: IdPunto, res: Resolvedor): any[] {
    const filas: any[] = [];
    let item = 1;
    for (const p of params) {
        if (!estaEn(p, punto) || !seEnvia(p)) continue;
        const esTerreno = p.tipo === 'terreno';
        const fila: Record<string, any> = {
            ...p.base,
            tipo_analisis: esTerreno ? 'Terreno' : 'Laboratorio',
            uf_individual: aUF(p.u[punto] || 0),
            item: item++,
            id_tipoentrega: p.idTipoEntrega || p.base.id_tipoentrega || 0,
            nombre_tipoentrega: res.nombreTipoEntrega(p.idTipoEntrega),
            id_transporte: 0,
            id_laboratorioensayo: esTerreno ? 0 : p.idLab1,
            nombre_laboratorioensayo: esTerreno ? '' : res.nombreLaboratorio(p.idLab1),
            id_laboratorioensayo_2: esTerreno ? 0 : p.idLab2,
            nombre_laboratorioensayo_2: esTerreno ? '' : res.nombreLaboratorio(p.idLab2),
            resultado_fecha: '  /  /    ',
            savedId: `${p.id}-${punto}`,
        };
        delete fila.opciones;
        delete fila._fijo;
        filas.push(fila);
    }
    return filas;
}

/** Costo operativo para el backend: siempre presente; con 0 UF si no se cobra. */
export const costoOperativoParaEnviar = (centesimas: number) => ({ activo: true, uf: aUF(Math.max(0, centesimas)) });

/** Tipo de entrega de las mediciones en terreno: «Directa». */
export const idEntregaDirecta = (tiposEntrega: Array<Record<string, any>>): number => {
    const norm = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const t = tiposEntrega.find((x) => norm(x.nombre_tipoentrega).includes('DIRECTA'));
    return Number(t?.id_tipoentrega) || 0;
};

// ─── Puntos (tabla de puntos de la visita) ───────────────────────────────────────────────────────────

export interface PuntoFila {
    id: IdPunto;
    puntoMuestreo: string;
    zona: string;
    utmNorte: string;
    utmEste: string;
    refGoogle: string;
}

export const nuevoPunto = (datos: Partial<PuntoFila> = {}): PuntoFila => ({
    id: `pt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    puntoMuestreo: '', zona: '', utmNorte: '', utmEste: '', refGoogle: '',
    ...datos,
});

/**
 * Genera filas a partir de nombres y réplicas: «Borde AZE, Control» × 3 →
 * Borde AZE 1, Borde AZE 2, Borde AZE 3, Control 1, Control 2, Control 3. Con 1 réplica no se numera.
 */
export function generarPuntos(nombres: string, replicas: number, base: Partial<PuntoFila> = {}): PuntoFila[] {
    const lista = nombres.split(',').map((s) => s.trim()).filter(Boolean);
    const r = Math.max(1, Math.floor(replicas) || 1);
    const filas: PuntoFila[] = [];
    for (const nombre of lista) {
        for (let k = 1; k <= r; k++) filas.push(nuevoPunto({ ...base, puntoMuestreo: r === 1 ? nombre : `${nombre} ${k}` }));
    }
    return filas;
}

/** Pegar desde Excel: columnas separadas por tabulador, en el orden Punto, Zona, UTM Norte, UTM Este, Referencia. */
export function puntosDesdeTexto(texto: string, base: Partial<PuntoFila> = {}): PuntoFila[] {
    return texto
        .split(/\r?\n/)
        .map((l) => l.split('\t').map((c) => c.trim()))
        .filter((c) => c.some(Boolean) && c[0])
        .map((c) => nuevoPunto({ ...base, puntoMuestreo: c[0], ...(c[1] ? { zona: c[1] } : {}), utmNorte: c[2] || '', utmEste: c[3] || '', refGoogle: c[4] || '' }));
}

export function problemasDePuntos(puntos: PuntoFila[], zonaNoAplica: (zona: string) => boolean): string[] {
    const r: string[] = [];
    if (puntos.length === 0) return ['Agregue al menos un punto.'];
    const vistos = new Map<string, number>();
    puntos.forEach((p, i) => {
        const nombre = p.puntoMuestreo.trim();
        if (!nombre) { r.push(`El punto ${i + 1} no tiene nombre.`); return; }
        const k = nombre.toLowerCase();
        if (vistos.has(k)) r.push(`El punto «${nombre}» está repetido.`);
        vistos.set(k, i);
        if (!p.zona) r.push(`«${nombre}»: falta la zona UTM.`);
        else if (!zonaNoAplica(p.zona) && (!p.utmNorte.trim() || !p.utmEste.trim())) r.push(`«${nombre}»: faltan las coordenadas UTM.`);
    });
    return r;
}

// ─── Cambios en la lista de puntos y armado del envío ────────────────────────────────────────────────

/**
 * Cuando cambia la lista de puntos, los parámetros se ajustan: un punto nuevo parte con los parámetros y precios de un
 * punto que ya existía, y al quitar uno se olvidan sus datos. Primero se agregan y después se quitan, así ningún parámetro
 * queda sin puntos en el medio (por ejemplo al reemplazar el punto vacío del comienzo por los generados).
 */
export function ajustarParametrosPorCambioDePuntos(params: ParametroVisita[], actuales: IdPunto[], nuevos: IdPunto[]): ParametroVisita[] {
    let copia = params.map((p) => ({ ...p, base: { ...p.base }, en: { ...p.en }, u: { ...p.u } }));
    const agregados = nuevos.filter((id) => !actuales.includes(id));
    const quitados = actuales.filter((id) => !nuevos.includes(id));
    const referencia = actuales[0];
    for (const id of agregados) alAgregarPunto(copia, id, referencia);
    for (const id of quitados) copia = alQuitarPunto(copia, id);
    return copia;
}

const datosDeUbicacion = (p: PuntoFila) => ({
    puntoMuestreo: p.puntoMuestreo.trim(),
    zona: p.zona || '',
    utmNorte: p.utmNorte.trim(),
    utmEste: p.utmEste.trim(),
    refGoogle: p.refGoogle.trim(),
});

/**
 * Cuerpo que recibe el backend: la ficha del primer punto y, si hay más, `puntosAdicionales` con la ubicación y los análisis
 * (con el precio) de cada uno. `comunes` trae lo que es de toda la visita (observaciones, usuario, cotización).
 */
export function armarPayloadVisita(args: {
    antecedentes: Record<string, any>;
    puntos: PuntoFila[];
    parametros: ParametroVisita[];
    costoOperativo: number;
    resolvedor: Resolvedor;
    comunes?: Record<string, unknown>;
}): { payload: Record<string, unknown>; esGrupo: boolean } {
    const [primero, ...resto] = args.puntos;
    const payload: Record<string, unknown> = {
        antecedentes: { ...args.antecedentes, ...datosDeUbicacion(primero) },
        analisis: analisisDelPunto(args.parametros, primero.id, args.resolvedor),
        ...(resto.length > 0 ? {
            puntosAdicionales: resto.map((p) => ({
                ...datosDeUbicacion(p),
                analisis: analisisDelPunto(args.parametros, p.id, args.resolvedor),
            })),
        } : {}),
        // El costo operativo es uno por visita: el backend lo reparte entre las fichas (cada una lleva su parte).
        costoOperativo: costoOperativoParaEnviar(args.costoOperativo),
        ...(args.comunes || {}),
    };
    return { payload, esGrupo: resto.length > 0 };
}
