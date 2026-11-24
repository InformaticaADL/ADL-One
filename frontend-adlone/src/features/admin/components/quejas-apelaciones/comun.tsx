import React from 'react';
import { IconCheck, IconMinus, IconClockHour4, IconCircleCheck, IconCircleX } from '@tabler/icons-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { Caso } from '../../services/quejasApelaciones.service';
import { fmtDay, type Requisito } from './reglas';

// =============================================================================
// Componentes comunes del módulo Quejas y apelaciones (G. Calidad → Calidad).
// Catálogos, fechas y validaciones están en reglas.ts.
// =============================================================================

// ── Controles ────────────────────────────────────────────────────────────────
/** Etiqueta + control + ayuda o error, en el estilo del sistema. */
export function Campo({ label, required, description, error, className, children, htmlFor }: {
    label: React.ReactNode; required?: boolean; description?: React.ReactNode; error?: string; className?: string; children: React.ReactNode; htmlFor?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
            <Label htmlFor={htmlFor} className="text-[13px]">
                {label}{required && <span className="ml-0.5 text-destructive">*</span>}
            </Label>
            {children}
            {error ? <p className="text-xs text-destructive">{error}</p> : description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
    );
}

/** Selector de opciones excluyentes (botones unidos). value '' = sin elegir. */
export function Segmentado({ options, value, onChange, disabled, tono, className, ariaLabel }: {
    options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; disabled?: boolean;
    /** Color del botón elegido según su valor (p. ej. «si» en rojo). */
    tono?: (v: string) => 'primary' | 'success' | 'destructive' | 'warning';
    className?: string; ariaLabel?: string;
}) {
    const color = { primary: 'bg-primary text-primary-foreground', success: 'bg-success text-white', destructive: 'bg-destructive text-destructive-foreground', warning: 'bg-warning text-white' };
    return (
        <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex w-full rounded-md border border-border bg-muted/40 p-0.5', disabled && 'opacity-60', className)}>
            {options.map((o) => {
                const activo = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="radio"
                        aria-checked={activo}
                        disabled={disabled}
                        onClick={() => onChange(o.value)}
                        className={cn(
                            'flex-1 rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed',
                            activo ? color[tono?.(o.value) || 'primary'] : 'text-muted-foreground hover:bg-background hover:text-foreground',
                        )}
                    >
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

/** Texto con sugerencias (input + datalist nativo): se puede elegir o escribir otro valor. */
export function ConSugerencias({ id, sugerencias, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string; sugerencias: string[] }) {
    return (
        <>
            <input
                id={id}
                list={`${id}-lista`}
                className={cn('flex h-9 w-full rounded-md border border-border bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50', className)}
                {...props}
            />
            <datalist id={`${id}-lista`}>{sugerencias.map((s) => <option key={s} value={s} />)}</datalist>
        </>
    );
}

/** Tarjeta con título para agrupar campos. */
export function Seccion({ titulo, icono, accion, children, className }: { titulo?: React.ReactNode; icono?: React.ReactNode; accion?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={cn('rounded-lg border border-border bg-card p-4', className)}>
            {(titulo || accion) && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">{icono}{titulo}</h3>
                    {accion}
                </div>
            )}
            {children}
        </section>
    );
}

// ── Requisitos para avanzar (panel fijo a la izquierda del formulario) ───────

export function RequisitosPanel({ accion, requisitos, nota }: { accion: string; requisitos: Requisito[]; nota?: React.ReactNode }) {
    const faltan = requisitos.filter((r) => !r.ok).length;
    const pct = requisitos.length ? Math.round(((requisitos.length - faltan) / requisitos.length) * 100) : 100;
    return (
        <div aria-live="polite" className={cn('rounded-lg border p-3', faltan ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5')}>
            <p className="text-sm font-semibold text-foreground">{faltan ? `Para ${accion}` : `Listo para ${accion}`}</p>
            <p className="mb-2 text-xs text-muted-foreground">{faltan ? `Faltan ${faltan} de ${requisitos.length} requisitos` : 'Todos los requisitos están completos.'}</p>
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <div className={cn('h-full transition-[width] duration-300', faltan ? 'bg-warning' : 'bg-success')} style={{ width: `${pct}%` }} />
            </div>
            <ul className="flex flex-col gap-2">
                {requisitos.map((r) => (
                    <li key={r.label} className="flex items-start gap-2">
                        {r.ok
                            ? <IconCircleCheck size={18} className="mt-px shrink-0 text-success" aria-label="Listo" />
                            : <IconCircleX size={18} className="mt-px shrink-0 text-warning" aria-label="Falta" />}
                        <div className="min-w-0">
                            <p className={cn('text-sm leading-snug', r.ok ? 'text-muted-foreground' : 'font-medium text-foreground')}>{r.label}</p>
                            {!r.ok && <p className="text-xs leading-snug text-muted-foreground">{r.why}</p>}
                        </div>
                    </li>
                ))}
            </ul>
            {nota && <p className="mt-3 text-xs text-muted-foreground">{nota}</p>}
        </div>
    );
}

/** Requisitos fijos a la izquierda y formulario a la derecha; en pantallas angostas, el panel va arriba. */
export function ConRequisitos({ panel, children }: { panel: React.ReactNode | null; children: React.ReactNode }) {
    if (!panel) return <>{children}</>;
    return (
        <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="lg:sticky lg:top-0">{panel}</div>
            <div className="min-w-0">{children}</div>
        </div>
    );
}

// ── Avance del caso por etapa (misma regla que ADLWeb: lib/qaProgress.ts) ────
type StepState = 'done' | 'current' | 'pending' | 'skipped';
function qaSteps(c: Caso) {
    const noProcede = c.estado === 'no_procede';
    const cerrado = c.estado === 'cerrada' || noProcede;
    const evaluado = c.procede !== null || cerrado || c.estado === 'en_tratamiento';
    const f = (d?: string | null) => (d ? fmtDay(d) : '');
    const evaluacion = evaluado
        ? { label: 'Evaluación', state: 'done' as StepState, detail: [noProcede || c.procede === false ? 'No procede' : 'Procede', f(c.fecha_evaluacion)].filter(Boolean).join(' · ') }
        : { label: 'Evaluación', state: 'current' as StepState, detail: c.estado === 'en_evaluacion' ? 'En curso' : 'Por iniciar' };
    const tratamiento = noProcede ? { label: 'Tratamiento', state: 'skipped' as StepState, detail: 'No aplica' }
        : cerrado ? { label: 'Tratamiento', state: 'done' as StepState, detail: f(c.fecha_tratamiento) || 'Terminado' }
            : c.estado === 'en_tratamiento' ? { label: 'Tratamiento', state: 'current' as StepState, detail: 'En curso' }
                : { label: 'Tratamiento', state: 'pending' as StepState, detail: 'Pendiente' };
    const cierre = cerrado
        ? { label: 'Cierre', state: 'done' as StepState, detail: f(c.cerrado_en) || 'Cerrado' }
        : { label: 'Cierre', state: 'pending' as StepState, detail: c.plazo_vence ? `Plazo ${f(c.plazo_vence)}` : 'Pendiente' };
    return [{ label: 'Registro', state: 'done' as StepState, detail: f(c.fecha_recepcion) || 'Recibido' }, evaluacion, tratamiento, cierre];
}

export function AvanceCaso({ caso }: { caso: Caso }) {
    const steps = qaSteps(caso);
    const circulo: Record<StepState, string> = {
        done: 'border-success bg-success text-white',
        current: 'border-warning bg-warning/10 text-warning ring-4 ring-warning/15',
        pending: 'border-border bg-background text-muted-foreground',
        skipped: 'border-border bg-muted text-muted-foreground',
    };
    return (
        <ol aria-label="Avance del caso" className="grid grid-cols-4 rounded-lg border border-border bg-muted/30 px-2 py-3">
            {steps.map((s, i) => {
                const prevDone = i > 0 && steps[i - 1].state === 'done' && s.state !== 'pending';
                return (
                    <li key={s.label} aria-current={s.state === 'current' ? 'step' : undefined} className="relative flex min-w-0 flex-col items-center px-1 text-center">
                        {i > 0 && <span aria-hidden="true" className={cn('absolute right-1/2 top-[15px] h-0.5 w-full', prevDone ? 'bg-success' : 'bg-border')} />}
                        <span className={cn('relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-[13px] font-bold', circulo[s.state])}>
                            {s.state === 'done' ? <IconCheck size={17} stroke={3} /> : s.state === 'skipped' ? <IconMinus size={16} stroke={3} /> : s.state === 'current' ? <IconClockHour4 size={16} stroke={2.4} /> : i + 1}
                        </span>
                        <span className={cn('mt-1.5 text-sm font-semibold leading-tight', s.state === 'pending' || s.state === 'skipped' ? 'text-muted-foreground' : 'text-foreground')}>{s.label}</span>
                        <span className={cn('text-xs leading-snug', s.state === 'current' ? 'font-medium text-warning' : 'text-muted-foreground')}>
                            {s.state === 'current' ? `En curso${s.detail !== 'En curso' ? ` · ${s.detail}` : ''}` : s.detail}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}
