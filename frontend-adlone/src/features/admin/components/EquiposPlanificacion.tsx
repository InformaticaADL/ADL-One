import React, { useEffect, useMemo, useState } from 'react';
import { IconCircleCheck, IconDownload, IconEraser, IconPencil, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { equipoService, type Equipo } from '../services/equipo.service';
import { COLOR_CONTROL, type ReglasControl, type ModalidadControl } from '../utils/reglasControlEquipo';
import { RegistrarRevisionDialog } from './RegistrarRevisionDialog';

// Planificación de revisiones: cuántas vencen cada mes, por tipo de control, y cuáles son. Se elige
// un mes a la izquierda; a la derecha están sus equipos: al hacer clic en uno (o marcar varios) se abre
// el formulario para registrar la revisión (mantención, contrastación, verificación trimestral o
// calibración del patrón), o la ficha completa para editarlo. Cuenta equipos en uso con fecha de
// siguiente revisión; complementos (sin vencimiento), dados de baja y fuera de servicio no entran.
// Va aparte del listado: no usa sus filtros.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ATRASADOS = '0-atrasados';
const CONTROLES: ModalidadControl[] = ['MANTENCION_ANUAL', 'CONTRASTACION_SEMESTRAL', 'VERIFICACION_TRIMESTRAL', 'CALIBRACION_ANUAL'];
const MESES_ADELANTE = 12;

const COLOR = COLOR_CONTROL;

const etiquetaMes = (clave: string) => {
    if (clave === ATRASADOS) return 'Atrasadas';
    const [y, m] = clave.split('-');
    return `${MESES[Number(m) - 1]} ${y}`;
};
const fechaDMY = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}-${m}-${y}`; };
const sumarMesesClave = (clave: string, n: number) => {
    const [y, m] = clave.split('-').map(Number);
    const t = y * 12 + (m - 1) + n;
    return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
const diasHasta = (iso: string, hoy: string) =>
    Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(+hoy.slice(0, 4), +hoy.slice(5, 7) - 1, +hoy.slice(8, 10))) / 86400000);

interface Props {
    reglas: ReglasControl | null;
    /** Abre la ficha completa del equipo para editarlo. */
    onEditEquipo?: (equipo: Equipo) => void;
    /** Quien puede editar equipos: ve los botones de registrar y editar. */
    puedeEditar?: boolean;
    /** Se registró una revisión: el listado y el calendario se recargan. */
    onCambio?: () => void;
    onIrVerificacionTemperatura?: () => void;
}

export const EquiposPlanificacion: React.FC<Props> = ({ reglas, onEditEquipo, puedeEditar = false, onCambio, onIrVerificacionTemperatura }) => {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [control, setControl] = useState<string>('all');
    const [sede, setSede] = useState<string>('all');
    const [responsable, setResponsable] = useState<string>('all');
    const [mesSel, setMesSel] = useState<string | null>(null);
    const [marcados, setMarcados] = useState<Set<number>>(new Set());
    const [registrando, setRegistrando] = useState<Equipo[]>([]);

    const cargar = () => equipoService.getResumenCalidad()
        .then((r) => setEquipos(r.equipos))
        .catch(() => setError('No se pudo cargar la planificación.'))
        .finally(() => setCargando(false));
    useEffect(() => { cargar(); }, []);

    const nombreControl = (m: string) => reglas?.modalidades?.[m as ModalidadControl]?.nombre ?? m;
    const cortoControl = (m: string) => reglas?.modalidades?.[m as ModalidadControl]?.corto ?? m;

    // Equipos que entran al plan: en uso, con fecha y con un control que vence.
    const base = useMemo(() => equipos.filter((e) =>
        !!e.siguiente_verificacion
        && e.estado_vigencia !== 'retirado'
        && e.estado_vigencia !== 'sin_vencimiento'
        && !!e.modalidad_control
        && e.modalidad_control !== 'SIN_VENCIMIENTO'
    ), [equipos]);

    const sedes = useMemo(() => Array.from(new Set(base.map((e) => e.ubicacion || 'Sin sede'))).sort(), [base]);
    const responsables = useMemo(() => Array.from(new Set(base.map((e) => e.nombre_asignado || 'Sin responsable'))).sort(), [base]);

    // Sede y responsable filtran todo; el control filtra la lista y se elige también desde las tarjetas.
    const delAlcance = useMemo(() => base.filter((e) =>
        (sede === 'all' || (e.ubicacion || 'Sin sede') === sede)
        && (responsable === 'all' || (e.nombre_asignado || 'Sin responsable') === responsable)
    ), [base, sede, responsable]);
    const filtrados = useMemo(() => delAlcance.filter((e) => control === 'all' || e.modalidad_control === control), [delAlcance, control]);

    const hoy = new Date().toISOString().slice(0, 10);

    const meses = useMemo(() => {
        const mesDe = (e: Equipo) => {
            const iso = String(e.siguiente_verificacion).slice(0, 10);
            return iso < hoy ? ATRASADOS : iso.slice(0, 7);
        };
        const porMes = new Map<string, Equipo[]>();
        for (const e of filtrados) porMes.set(mesDe(e), [...(porMes.get(mesDe(e)) ?? []), e]);
        const claves: string[] = [];
        if (porMes.has(ATRASADOS)) claves.push(ATRASADOS);
        // Los próximos 12 meses siempre (también los vacíos: se ven los huecos), más cualquier mes posterior con datos.
        const set = new Set<string>();
        for (let i = 0; i < MESES_ADELANTE; i++) set.add(sumarMesesClave(hoy.slice(0, 7), i));
        for (const k of porMes.keys()) if (k !== ATRASADOS) set.add(k);
        claves.push(...Array.from(set).sort());
        return claves.map((k) => {
            const lista = (porMes.get(k) ?? []).slice().sort((a, b) => String(a.siguiente_verificacion).localeCompare(String(b.siguiente_verificacion)) || String(a.codigo).localeCompare(String(b.codigo)));
            const porControl = Object.fromEntries(CONTROLES.map((c) => [c, lista.filter((e) => e.modalidad_control === c).length])) as Record<ModalidadControl, number>;
            return { clave: k, lista, porControl, total: lista.length };
        });
    }, [filtrados, hoy]);

    // Mes que se está viendo: el elegido (si sigue teniendo equipos) o el primero con trabajo (las atrasadas, si hay).
    const mesActivo = meses.find((m) => m.clave === mesSel && m.total > 0) ?? meses.find((m) => m.total > 0) ?? null;
    const maxMes = Math.max(1, ...meses.filter((m) => m.clave !== ATRASADOS).map((m) => m.total));
    const atrasadasTotal = filtrados.filter((e) => String(e.siguiente_verificacion).slice(0, 10) < hoy).length;

    const resumenControles = useMemo(() => CONTROLES.map((m) => {
        const lista = delAlcance.filter((e) => e.modalidad_control === m);
        return { m, total: lista.length, atrasadas: lista.filter((e) => String(e.siguiente_verificacion).slice(0, 10) < hoy).length };
    }), [delAlcance, hoy]);

    const abierto = registrando.length === 1 ? registrando[0].id_equipo : null;
    const hayFiltros = control !== 'all' || sede !== 'all' || responsable !== 'all';
    const limpiar = () => { setControl('all'); setSede('all'); setResponsable('all'); };

    // Selección múltiple: solo equipos que siguen en la lista visible.
    const visibles = new Set(filtrados.map((e) => e.id_equipo));
    const elegidos = equipos.filter((e) => marcados.has(e.id_equipo) && visibles.has(e.id_equipo));
    const alternar = (id: number) => setMarcados((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const todosDelMes = !!mesActivo && mesActivo.lista.length > 0 && mesActivo.lista.every((e) => marcados.has(e.id_equipo));
    const alternarMes = () => {
        if (!mesActivo) return;
        setMarcados((p) => {
            const n = new Set(p);
            if (todosDelMes) mesActivo.lista.forEach((e) => n.delete(e.id_equipo));
            else mesActivo.lista.forEach((e) => n.add(e.id_equipo));
            return n;
        });
    };

    const exportarCsv = () => {
        const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const filas = [['Mes', 'Código', 'Equipo', 'Control de fechas', 'Sede', 'Responsable', 'Vence', 'Días']];
        for (const m of meses) for (const e of m.lista) {
            const iso = String(e.siguiente_verificacion).slice(0, 10);
            filas.push([etiquetaMes(m.clave), e.codigo ?? '', e.nombre ?? '', nombreControl(String(e.modalidad_control)), e.ubicacion ?? '', e.nombre_asignado ?? '', fechaDMY(iso), String(diasHasta(iso, hoy))]);
        }
        const blob = new Blob(['﻿' + filas.map((f) => f.map(esc).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `plan-revisiones-equipos-${hoy}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando planificación…</p>;
    if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;

    return (
        <div className="flex flex-col gap-4 pb-6">
            {/* Resumen por tipo de control (clic para filtrar) */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {resumenControles.map(({ m, total, atrasadas }) => (
                    <button
                        key={m}
                        type="button"
                        aria-pressed={control === m}
                        onClick={() => setControl(control === m ? 'all' : m)}
                        className={cn('relative overflow-hidden rounded-lg border bg-background p-3 pl-4 text-left transition-colors hover:bg-muted/50', control === m && 'border-primary bg-primary/5')}
                    >
                        <span className={cn('absolute inset-y-0 left-0 w-1', COLOR[m].barra)} />
                        <div className="text-xs text-muted-foreground">{nombreControl(m)}</div>
                        <div className="mt-1 flex items-baseline gap-2">
                            <span className="text-2xl font-semibold tabular-nums">{total}</span>
                            <span className={cn('text-xs', atrasadas > 0 ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                                {atrasadas > 0 ? `${atrasadas} atrasadas` : 'al día'}
                            </span>
                        </div>
                    </button>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-60">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Control de fechas</Label>
                    <Combobox value={control} onValueChange={(v) => setControl(v || 'all')} placeholder="Control de fechas"
                        options={[{ value: 'all', label: 'Todos' }, ...CONTROLES.map((m) => ({ value: m, label: nombreControl(m) }))]} />
                </div>
                <div className="w-full sm:w-44">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sede</Label>
                    <Combobox value={sede} onValueChange={(v) => setSede(v || 'all')} placeholder="Sede"
                        options={[{ value: 'all', label: 'Todas las sedes' }, ...sedes.map((s) => ({ value: s, label: s }))]} />
                </div>
                <div className="w-full sm:w-56">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Responsable</Label>
                    <Combobox value={responsable} onValueChange={(v) => setResponsable(v || 'all')} placeholder="Responsable" searchPlaceholder="Buscar responsable..."
                        options={[{ value: 'all', label: 'Todos los responsables' }, ...responsables.map((r) => ({ value: r, label: r }))]} />
                </div>
                {hayFiltros && (
                    <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={limpiar}>
                        <IconEraser size={16} /> Limpiar
                    </Button>
                )}
                <Button variant="outline" className="ml-auto" onClick={exportarCsv} disabled={filtrados.length === 0}>
                    <IconDownload size={16} /> Exportar plan
                </Button>
            </div>

            <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{filtrados.length}</span> revisiones
                {atrasadasTotal > 0 && <> · <span className="font-medium text-destructive">{atrasadasTotal} atrasadas</span></>}
                {puedeEditar && <> · haga clic en cualquier parte de un equipo para ver qué le corresponde y registrar su revisión</>}
            </p>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
                {/* Carga por mes */}
                {/* Queda fijo al desplazar la página y la lista de meses tiene su propio scroll. */}
                <div className="flex min-w-0 flex-col rounded-lg border bg-background lg:sticky lg:top-0 lg:max-h-[calc(100vh-10rem)] lg:self-start">
                    <div className="shrink-0 border-b px-3 py-2.5">
                        <span className="text-sm font-semibold">Carga por mes</span>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                            {CONTROLES.map((c) => (
                                <span key={c} className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', COLOR[c].punto)} />{cortoControl(c)}</span>
                            ))}
                        </div>
                    </div>
                    <ul className="flex min-h-0 flex-col overflow-y-auto overscroll-contain p-1.5">
                        {meses.map((m) => {
                            const activo = mesActivo?.clave === m.clave;
                            const esAtraso = m.clave === ATRASADOS;
                            return (
                                <li key={m.clave}>
                                    <button
                                        type="button"
                                        disabled={m.total === 0}
                                        onClick={() => setMesSel(m.clave)}
                                        aria-pressed={activo}
                                        className={cn(
                                            'flex w-full flex-col gap-1.5 rounded-md px-2.5 py-2 text-left transition-colors',
                                            m.total === 0 ? 'cursor-default opacity-50' : 'hover:bg-muted/60',
                                            activo && 'bg-primary/10 ring-1 ring-primary/40',
                                            esAtraso && !activo && m.total > 0 && 'bg-destructive/5',
                                        )}
                                    >
                                        <span className="flex items-center justify-between gap-2">
                                            <span className={cn('text-sm font-medium', esAtraso && m.total > 0 && 'text-destructive')}>{etiquetaMes(m.clave)}</span>
                                            <span className="text-sm font-semibold tabular-nums">{m.total || <span className="font-normal text-muted-foreground">—</span>}</span>
                                        </span>
                                        {m.total > 0 && (
                                            <span className="flex h-1.5 overflow-hidden rounded-full bg-muted" style={{ width: esAtraso ? '100%' : `${Math.max(12, (m.total / maxMes) * 100)}%` }}>
                                                {CONTROLES.map((c) => m.porControl[c] > 0 && (
                                                    <span key={c} className={COLOR[c].barra} style={{ width: `${(m.porControl[c] / m.total) * 100}%` }} title={`${cortoControl(c)}: ${m.porControl[c]}`} />
                                                ))}
                                            </span>
                                        )}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Equipos del mes elegido */}
                <div className="flex min-w-0 flex-col rounded-lg border bg-background">
                    {!mesActivo ? (
                        <p className="p-8 text-center text-sm text-muted-foreground">No hay revisiones para este filtro.</p>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
                                <div className="flex items-center gap-3">
                                    {puedeEditar && <Checkbox checked={todosDelMes} onCheckedChange={alternarMes} aria-label="Seleccionar todos los equipos del mes" />}
                                    <div>
                                        <span className={cn('text-sm font-semibold', mesActivo.clave === ATRASADOS && 'text-destructive')}>
                                            {mesActivo.clave === ATRASADOS ? 'Revisiones atrasadas' : `Vencen en ${etiquetaMes(mesActivo.clave)}`}
                                        </span>
                                        <span className="ml-2 text-xs text-muted-foreground">{mesActivo.total} equipo{mesActivo.total === 1 ? '' : 's'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Barra de acción al marcar varios */}
                            {puedeEditar && elegidos.length > 0 && (
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-primary/5 px-3 py-2">
                                    <span className="text-sm font-medium">{elegidos.length} seleccionado{elegidos.length === 1 ? '' : 's'}</span>
                                    <div className="flex gap-2">
                                        <Button size="sm" onClick={() => setRegistrando(elegidos)}><IconCircleCheck size={15} /> Registrar revisión</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setMarcados(new Set())}><IconX size={14} /> Quitar selección</Button>
                                    </div>
                                </div>
                            )}

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b text-left text-xs text-muted-foreground">
                                            {puedeEditar && <th className="w-9 py-2 pl-3" />}
                                            <th className="px-3 py-2 font-medium">Equipo</th>
                                            <th className="px-3 py-2 font-medium">Control</th>
                                            <th className="hidden px-3 py-2 font-medium md:table-cell">Sede</th>
                                            <th className="hidden px-3 py-2 font-medium xl:table-cell">Responsable</th>
                                            <th className="px-3 py-2 text-right font-medium">Vence</th>
                                            {puedeEditar && <th className="w-24 py-2 pr-3" />}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {mesActivo.lista.map((e) => {
                                            const iso = String(e.siguiente_verificacion).slice(0, 10);
                                            const dias = diasHasta(iso, hoy);
                                            const marcado = marcados.has(e.id_equipo);
                                            return (
                                                <tr
                                                    key={e.id_equipo}
                                                    className={cn(
                                                        'border-b border-border/60 last:border-0',
                                                        puedeEditar && 'cursor-pointer hover:bg-muted/40',
                                                        marcado && 'bg-primary/5',
                                                        abierto === e.id_equipo && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
                                                    )}
                                                    onClick={() => puedeEditar && setRegistrando([e])}
                                                    onKeyDown={(ev) => { if (puedeEditar && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); setRegistrando([e]); } }}
                                                    tabIndex={puedeEditar ? 0 : undefined}
                                                    aria-label={puedeEditar ? `Registrar la revisión de ${e.codigo}` : undefined}
                                                >
                                                    {puedeEditar && (
                                                        <td className="py-2 pl-3">
                                                            <Checkbox checked={marcado} onClick={(ev) => ev.stopPropagation()} onCheckedChange={() => alternar(e.id_equipo)} aria-label={`Seleccionar ${e.codigo}`} />
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-2">
                                                        <div className="font-semibold leading-tight">{e.codigo}</div>
                                                        <div className="max-w-[16rem] truncate text-xs text-muted-foreground" title={e.nombre}>{e.nombre}</div>
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs">
                                                            <span className={cn('h-2 w-2 rounded-full', COLOR[String(e.modalidad_control)]?.punto)} />
                                                            {cortoControl(String(e.modalidad_control))}
                                                        </span>
                                                    </td>
                                                    <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{e.ubicacion}</td>
                                                    <td className="hidden px-3 py-2 text-muted-foreground xl:table-cell">{e.nombre_asignado || '—'}</td>
                                                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                                                        <div className={cn(dias < 0 && 'font-medium text-destructive')}>{fechaDMY(iso)}</div>
                                                        <div className="text-[11px] text-muted-foreground">{dias < 0 ? `hace ${-dias} d` : dias === 0 ? 'hoy' : `en ${dias} d`}</div>
                                                    </td>
                                                    {puedeEditar && (
                                                        <td className="py-2 pr-3 text-right">
                                                            <div className="flex justify-end gap-1">
                                                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setRegistrando([e])}>Registrar</Button>
                                                                {onEditEquipo && (
                                                                    <Button size="icon-xs" variant="ghost" onClick={(ev) => { ev.stopPropagation(); onEditEquipo(e); }} title="Editar el equipo (ficha completa)" aria-label={`Editar ${e.codigo}`}><IconPencil size={14} /></Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <p className="text-xs text-muted-foreground">
                Incluye equipos operativos con fecha de siguiente revisión. Los complementos (sin vencimiento), dados de baja y fuera de servicio no cuentan.
            </p>

            {/* Formulario para registrar la revisión */}
            <RegistrarRevisionDialog
                equipos={registrando}
                reglas={reglas}
                onClose={() => setRegistrando([])}
                onGuardado={(ids) => {
                    setMarcados((p) => { const n = new Set(p); ids.forEach((i) => n.delete(i)); return n; });
                    cargar();
                    onCambio?.();
                }}
                onAbrirFicha={onEditEquipo ? (eq) => { setRegistrando([]); onEditEquipo(eq); } : undefined}
                onIrVerificacionTemperatura={onIrVerificacionTemperatura}
            />
        </div>
    );
};
