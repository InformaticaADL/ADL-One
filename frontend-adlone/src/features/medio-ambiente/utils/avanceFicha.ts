// Avance de ejecución de una ficha: cuántos de sus servicios (el 1.º, 2.º… de la frecuencia) ya se ejecutaron.
// «Realizado» es solo el estado «Ejecutado»; los suspendidos y los cancelados se cuentan aparte y los cancelados no entran en el total.

export interface AvanceFicha {
    total: number;
    ejecutados: number;
    suspendidos: number;
    cancelados: number;
    /** Fecha (AAAA-MM-DD) del último servicio ejecutado. */
    ultimo: string | null;
    /** Fecha (AAAA-MM-DD) del próximo servicio agendado que aún no se ejecuta. */
    proximo: string | null;
}

/** Avance que el listado de fichas trae en cada fila (campos avance_*); null si la ficha no tiene agenda. */
export const avanceDeFila = (f: any): AvanceFicha | null => {
    if (!f || f.avance_total === null || f.avance_total === undefined) return null;
    return {
        total: Number(f.avance_total) || 0,
        ejecutados: Number(f.avance_ejecutados) || 0,
        suspendidos: Number(f.avance_suspendidos) || 0,
        cancelados: Number(f.avance_cancelados) || 0,
        ultimo: f.avance_ultimo || null,
        proximo: f.avance_proximo || null,
    };
};

/** Los puntos de una visita se ejecutan juntos: se toma el más atrasado para no dar por hecho lo que falta. */
export const avanceDeVisita = (puntos: any[]): AvanceFicha | null => {
    const lista = puntos.map(avanceDeFila).filter((a): a is AvanceFicha => a !== null);
    if (lista.length === 0) return null;
    return lista.reduce((peor, a) => (a.ejecutados < peor.ejecutados ? a : peor));
};

export const hoyISO = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const estaCompletada = (a: AvanceFicha | null): boolean => !!a && a.total > 0 && a.ejecutados >= a.total;

/** Servicios que aún no se ejecutan ni están suspendidos. */
export const pendientesDe = (a: AvanceFicha): number => Math.max(0, a.total - a.ejecutados - a.suspendidos);

export const proximoAtrasado = (a: AvanceFicha | null): boolean => !!a && !!a.proximo && a.proximo < hoyISO();

/** Hay servicios por hacer y ninguno tiene fecha agendada. */
export const faltaProgramar = (a: AvanceFicha | null): boolean => !!a && pendientesDe(a) > 0 && !a.proximo;

/** ¿Tiene sentido mostrar el avance? Solo cuando la ficha ya está aprobada y en marcha (o ya tiene algo ejecutado). */
export const avanceAplica = (estado: string | null | undefined, a: AvanceFicha | null): a is AvanceFicha => {
    if (!a || a.total === 0) return false;
    if (a.ejecutados > 0) return true;
    return /EN PROCESO|VIGENTE|APROBADA|EJECUTADO|COMPLETADA/.test(String(estado || '').toUpperCase());
};

/** «EN PROCESO» pasa a «COMPLETADA» cuando todos los servicios ya se ejecutaron. */
export const estadoVisible = (estado: string | null | undefined, a: AvanceFicha | null): string => {
    const s = String(estado || '');
    return s.toUpperCase().includes('EN PROCESO') && estaCompletada(a) ? 'COMPLETADA' : s;
};

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «2026-11-18» → «18 nov 2026» (sin pasar por Date, para que la zona horaria no corra el día). */
export const fechaLarga = (iso: string | null | undefined): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : '—';
};

/** «2026-11-18» → «18 nov». */
export const fechaCorta = (iso: string | null | undefined): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]}` : '—';
};

/** «2026-11-18» → «nov 2026». */
export const mesAnio = (iso: string | null | undefined): string => {
    const m = /^(\d{4})-(\d{2})/.exec(String(iso || ''));
    return m ? `${MESES[Number(m[2]) - 1]} ${m[1]}` : '';
};
