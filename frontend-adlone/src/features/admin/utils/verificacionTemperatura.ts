import type { LecturasTemp, EstadoVerificacion } from '../services/verificacionTemperatura.service';

// Copia del cálculo del backend (src/utils/verificacionTemperatura.calc.js),
// solo para mostrar resultados en vivo mientras se llena la ficha. El valor que
// queda guardado lo recalcula siempre el backend.
//   TFP = TP - error del patrón · Error = TC - TFP · promedio de 5 · Cumple si |Error| ≤ 0,5

export const RANGOS = [0, 15, 30] as const;
export const TOLERANCIA = 0.5;

// "+ 0" convierte -0 en 0, para que nunca se muestre "-0,0".
const redondear = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100 + 0);

export interface FilaCalculada {
    tp: number | null;
    tc: number | null;
    hora: string;
    tfp: number | null;
    error: number | null;
}

export interface RangoCalculado {
    filas: FilaCalculada[];
    promedio: number | null;
    fc: number | null;
    cumple: boolean | null;
    completas: number;
}

export const calcular = (lecturas: LecturasTemp, errPatron: Record<number, number | null | undefined>) => {
    const rangos = {} as Record<number, RangoCalculado>;
    let completas = true;
    for (const r of RANGOS) {
        const ep = Number(errPatron[r] ?? 0);
        const filas = (lecturas[String(r) as '0'] || []).map((f) => {
            const tfp = f.tp === null ? null : f.tp - ep;
            const error = f.tc === null || tfp === null ? null : f.tc - tfp;
            return { ...f, tfp: redondear(tfp), error: redondear(error) };
        });
        const errores = filas.map((f) => f.error).filter((e): e is number => e !== null);
        if (errores.length < 5) completas = false;
        const promedio = errores.length ? redondear(errores.reduce((a, b) => a + b, 0) / errores.length) : null;
        rangos[r] = {
            filas,
            promedio,
            fc: promedio === null ? null : redondear(-promedio),
            cumple: promedio === null ? null : Math.abs(promedio) <= TOLERANCIA + 1e-9,
            completas: errores.length,
        };
    }
    const cumple = completas ? RANGOS.every((r) => rangos[r].cumple) : null;
    return { rangos, completas, cumple };
};

export const fmtNum = (n: number | null | undefined, minDec = 1) =>
    n === null || n === undefined || Number.isNaN(n)
        ? '—'
        : Number(n).toLocaleString('es-CL', { minimumFractionDigits: minDec, maximumFractionDigits: 2 });

export const fmtFecha = (ymd: string | null | undefined) => {
    if (!ymd) return '—';
    const [y, m, d] = String(ymd).slice(0, 10).split('-');
    return d ? `${d}-${m}-${y}` : String(ymd);
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const nombrePeriodo = (periodo: string) => {
    const [y, m] = periodo.split('-').map(Number);
    return m ? `${MESES[m - 1]} ${y}` : periodo;
};

export const hoyYmd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const ESTADO_META: Record<EstadoVerificacion, { label: string; badge: 'outline' | 'warning' | 'success' | 'destructive' | 'secondary' }> = {
    BORRADOR: { label: 'Borrador', badge: 'outline' },
    PENDIENTE_FIRMA: { label: 'Pendiente de firma', badge: 'warning' },
    FIRMADA: { label: 'Firmada', badge: 'success' },
    ANULADA: { label: 'Anulada', badge: 'secondary' },
};

// Convierte lo escrito en un input (admite coma decimal) a número o null.
export const parseNum = (s: string): number | null => {
    const t = s.trim().replace(',', '.');
    if (t === '' || t === '-' || t === '.') return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
};
