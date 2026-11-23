import { fichasEquipoService, type FichaArchivo, type TipoFichaGuardada, type EstadoFichaArchivo } from '../../services/fichasEquipo.service';

// Funciones de datos de los dashboards de G.C. MAM.

export const COLOR = {
    ok: 'var(--sc-success)',
    warn: 'var(--sc-warning)',
    bad: 'var(--sc-destructive)',
    main: 'var(--sc-primary)',
    muted: 'var(--sc-muted-foreground)',
};

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Últimos 12 meses (incluido el actual) como claves 'YYYY-MM' con su etiqueta corta. */
export const ultimos12Meses = (): { clave: string; mes: string }[] => {
    const hoy = new Date();
    return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - 11 + i, 1);
        return { clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, mes: `${MESES[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` };
    });
};

/** Agrupa filas por mes (últimos 12) y por una serie: devuelve [{ mes, <serie>: n }]. */
export const agruparPorMes = <T>(filas: T[], fecha: (f: T) => string | null | undefined, serie: (f: T) => string): Record<string, string | number>[] => {
    const meses = ultimos12Meses();
    const base = new Map(meses.map((m) => [m.clave, { mes: m.mes } as Record<string, string | number>]));
    for (const f of filas) {
        const clave = String(fecha(f) ?? '').slice(0, 7);
        const fila = base.get(clave);
        if (!fila) continue;
        const s = serie(f);
        fila[s] = (Number(fila[s]) || 0) + 1;
    }
    return [...base.values()];
};

/** Cuenta por una clave y devuelve el ranking ordenado de mayor a menor. */
export const contar = <T>(filas: T[], clave: (f: T) => string | null | undefined, max = 12): { name: string; value: number }[] => {
    const m = new Map<string, number>();
    for (const f of filas) {
        const k = clave(f) || 'Sin dato';
        m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, max);
};

export const diasEntre = (desde: string | null | undefined, hasta: string | null | undefined): number | null => {
    if (!desde || !hasta) return null;
    const a = new Date(desde).getTime();
    const b = new Date(hasta).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.max(0, Math.round((b - a) / 86400000));
};

export const hoyIso = () => new Date().toISOString().slice(0, 10);
export const sumarDias = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString().slice(0, 10);

/** Trae todas las fichas del archivo (el servidor entrega de a 200 por página). */
export const cargarArchivo = async (filtros: { tipo?: TipoFichaGuardada; estado?: EstadoFichaArchivo } = {}): Promise<FichaArchivo[]> => {
    const todas: FichaArchivo[] = [];
    for (let page = 1; page <= 50; page++) {
        const r = await fichasEquipoService.archivo({ ...filtros, page, limit: 200 });
        if (!r.disponible) break;
        todas.push(...r.fichas);
        if (todas.length >= r.total || r.fichas.length === 0) break;
    }
    return todas;
};

