import type { Caso } from '../../services/quejasApelaciones.service';
import { IconFlag, IconProgress, IconFlagCheck } from '@tabler/icons-react';

// =============================================================================
// Reglas del módulo Quejas y apelaciones (G. Calidad → Calidad): catálogos,
// fechas y validaciones. Son las mismas del panel de ADLWeb
// (frontend-adlclone/src/components/QualityComplaintsManager.tsx), porque los dos
// sistemas administran los mismos casos. Los componentes están en comun.tsx.
// =============================================================================

export const TIPOS = [{ value: 'queja', label: 'Queja' }, { value: 'apelacion', label: 'Apelación' }];
export const ORIGENES = [{ value: 'externo', label: 'Externo' }, { value: 'interno', label: 'Interno' }];
export const EMISORES = [{ value: 'cliente', label: 'Cliente' }, { value: 'fiscalizador', label: 'Organismo fiscalizador' }, { value: 'otro', label: 'Otro' }];
export const ESTADOS: { value: string; label: string; variant: 'info' | 'warning' | 'destructive' | 'success' | 'secondary' }[] = [
    { value: 'registrada', label: 'Registrada', variant: 'info' },
    { value: 'en_evaluacion', label: 'En evaluación', variant: 'warning' },
    { value: 'en_tratamiento', label: 'En tratamiento', variant: 'warning' },
    { value: 'cerrada', label: 'Cerrada', variant: 'success' },
    { value: 'no_procede', label: 'No procede (cerrada)', variant: 'secondary' },
];
export const estadoVariant = (estado: string) => ESTADOS.find((e) => e.value === estado)?.variant || 'secondary';
export const ETAPAS = [
    { value: 'inicio', label: 'Inicio de proceso', icon: IconFlag },
    { value: 'avance', label: 'Avance de proceso', icon: IconProgress },
    { value: 'finalizacion', label: 'Finalización de proceso', icon: IconFlagCheck },
] as const;
export const VIAS = ['Correo electrónico', 'Teléfono', 'Reunión presencial', 'Videollamada', 'Carta', 'WhatsApp'];
export const VIAS_INGRESO = ['En persona', 'Correo electrónico', 'Teléfono', 'Fax', 'Carta', 'Formulario web'];
// Sugerencias de causa: se puede escribir otra. Se agrupan en la estadística.
export const CAUSAS_SUGERIDAS = ['Resultado de análisis', 'Plazo de entrega', 'Toma de muestras', 'Informe o documentación', 'Atención al cliente', 'Facturación', 'Decisión de inspección'];
export const TECNICAS = ['5 porqués', 'Diagrama de Ishikawa', 'Lluvia de ideas', 'Análisis de Pareto'];
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const PIE_FORMULARIO = 'La copia original administrada por Gestión de Calidad posee las firmas correspondientes.';
export const MAX_ADJUNTO = 5 * 1024 * 1024;
export const TIPOS_ADJUNTO = 'application/pdf,image/jpeg,image/png,image/webp';

// ── Fechas ───────────────────────────────────────────────────────────────────
const pad = (n: number) => String(n).padStart(2, '0');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const nowTime = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const fmtDay = (d?: string | null) => (d ? String(d).slice(0, 10).split('-').reverse().join('-') : '—');
export const fmtDateTime = (d?: string | null) => (d ? new Date(d).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const yesNo = (v: boolean | null | undefined) => (v === true ? 'Sí' : v === false ? 'No' : '—');
export const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// Fechas de hechos ya ocurridos: entre la recepción del caso y hoy (el servidor también lo valida).
export const noFuture = (v: string, recepcion?: string | null) => ({
    max: today(),
    min: recepcion || undefined,
    error: !v ? undefined
        : v > today() ? 'No puede ser posterior a hoy.'
            : recepcion && v < recepcion ? `No puede ser anterior a la recepción (${fmtDay(recepcion)}).` : undefined,
});
/** min/max para un <Input type="date"> a partir de noFuture / notBefore. */
export const limites = ({ min, max }: { min?: string; max?: string }) => ({ min, max });
// Fechas planificadas (plazo, seguimiento): pueden ser futuras, no anteriores a la recepción.
export const notBefore = (v: string, recepcion?: string | null) => ({
    min: recepcion || undefined,
    error: v && recepcion && v < recepcion ? `No puede ser anterior a la recepción (${fmtDay(recepcion)}).` : undefined,
});

// ── Validación de campos (mismas reglas que el formulario público de ADLWeb) ─
const LETTER = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
export const cleanName = (v: string) => v.replace(new RegExp(`[^${LETTER} ]`, 'g'), '').replace(/ {2,}/g, ' ').replace(/^ +/, '').slice(0, 100);
export const nameError = (v: string) => {
    const t = v.trim();
    if (!t) return 'Ingresa el nombre.';
    if (!new RegExp(`^[${LETTER}]+( [${LETTER}]+)*$`).test(t)) return 'Usa solo letras y espacios.';
    if (t.replace(/ /g, '').length < 2) return 'Debe tener al menos 2 letras.';
    return '';
};
export const cleanCompany = (v: string) => v.replace(new RegExp(`[^${LETTER} .&-]`, 'g'), '').replace(/ {2,}/g, ' ').replace(/^ +/, '').slice(0, 120);
export const companyError = (v: string) => {
    const t = v.trim();
    if (!t) return 'Indica la empresa.';
    if (!new RegExp(`^[${LETTER} .&-]+$`).test(t)) return 'Usa solo letras (se permiten ".", "-" y "&").';
    if (!new RegExp(`[${LETTER}]{2,}`).test(t)) return 'Ingresa un nombre de empresa válido.';
    return '';
};
export const cleanEmail = (v: string) => v.replace(/\s/g, '').toLowerCase().slice(0, 254);
const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/i;
export const emailError = (v: string) => {
    const t = v.trim();
    if (!t) return 'Ingresa el correo.';
    if (!EMAIL_RE.test(t)) return 'Revisa el formato del correo (ej. nombre@empresa.cl).';
    return '';
};
export const cleanPhone = (v: string) => `+${v.replace(/\D/g, '').slice(0, 15)}`;
export const finalizePhone = (v: string) => (v === '+' ? '' : v);
export const phoneError = (v: string) => {
    if (!v || v === '+') return 'Ingresa el fono de contacto.';
    if (!/^\+\d{8,15}$/.test(v)) return 'Código de país y número, solo dígitos (ej. +56912345678).';
    return '';
};
export const cleanReference = (v: string) => v.replace(/[^A-Za-z0-9\-./ ]/g, '').toUpperCase().slice(0, 50);

// ── Requisitos para avanzar ─────────────────────────────────────────────────
export interface Requisito { ok: boolean; label: string; why: string; show?: boolean }
export const visibles = (rs: Requisito[]) => rs.filter((r) => r.show !== false);

// Acciones correctivas activas: las anuladas (levantadas por error) se muestran pero no cuentan.
export const acActivas = (c: Caso) => c.acciones.filter((a) => a.estado !== 'anulada');

/** Descarga un CSV (con BOM para que Excel respete los acentos). */
export function descargarCsv(filas: (string | number | null | undefined)[][], nombre: string) {
    const celda = (v: string | number | null | undefined) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = filas.map((f) => f.map(celda).join(',')).join('\r\n');
    const BOM = String.fromCharCode(0xfeff);
    const url = URL.createObjectURL(new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    a.click();
    URL.revokeObjectURL(url);
}
