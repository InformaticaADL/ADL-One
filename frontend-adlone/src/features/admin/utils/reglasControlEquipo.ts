// Reglas de control de fechas por tipo de equipo (mantención anual, contrastación
// semestral, verificación trimestral, calibración anual de patrón, sin vencimiento).
// El catálogo viene del backend (GET /admin/equipos/reglas-control); acá solo están
// las funciones para usarlo. Debe coincidir con api-backend-adlone/src/utils/reglasControlEquipo.js.

export type ModalidadControl =
    | 'MANTENCION_ANUAL'
    | 'CONTRASTACION_SEMESTRAL'
    | 'VERIFICACION_TRIMESTRAL'
    | 'CALIBRACION_ANUAL'
    | 'SIN_VENCIMIENTO';

export interface ModalidadInfo { meses: number | null; nombre: string; corto: string }

export interface ReglasControl {
    modalidades: Record<ModalidadControl, ModalidadInfo>;
    equipos: Record<string, { permitidas: ModalidadControl[]; defecto: ModalidadControl }>;
    /** Familia → nombres de equipo (normalizados) que la forman. */
    familias?: Record<string, string[]>;
}

export const normalizarNombreEquipo = (nombre: unknown): string =>
    String(nombre ?? '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

export interface ControlEquipo {
    permitidas: ModalidadControl[];
    elegible: boolean;
    modalidad: ModalidadControl;
    info: ModalidadInfo;
    meses: number | null;
    sinVencimiento: boolean;
}

/** Control que rige para un equipo; null si su nombre no tiene regla (se comporta como antes). */
export const controlDeEquipo = (
    reglas: ReglasControl | null,
    nombre: unknown,
    modalidadElegida?: string | null,
): ControlEquipo | null => {
    if (!reglas) return null;
    const r = reglas.equipos[normalizarNombreEquipo(nombre)];
    if (!r) return null;
    const pedida = String(modalidadElegida ?? '').toUpperCase() as ModalidadControl;
    const modalidad = r.permitidas.includes(pedida) ? pedida : r.defecto;
    const info = reglas.modalidades[modalidad];
    return {
        permitidas: r.permitidas,
        elegible: r.permitidas.length > 1,
        modalidad,
        info,
        meses: info.meses,
        sinVencimiento: modalidad === 'SIN_VENCIMIENTO',
    };
};

/** Suma meses de calendario a 'YYYY-MM-DD' (31-ago + 6 meses → 28/29-feb). '' si la fecha no es válida. */
export const sumarMeses = (fechaISO: string, meses: number): string => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fechaISO || '');
    if (!m) return '';
    const mes0 = Number(m[2]) - 1 + meses;
    const anio = Number(m[1]) + Math.floor(mes0 / 12);
    const mesDestino = ((mes0 % 12) + 12) % 12;
    const ultimoDia = new Date(Date.UTC(anio, mesDestino + 1, 0)).getUTCDate();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${anio}-${p(mesDestino + 1)}-${p(Math.min(Number(m[3]), ultimoDia))}`;
};
