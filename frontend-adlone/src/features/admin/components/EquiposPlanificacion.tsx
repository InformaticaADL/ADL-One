import React, { useEffect, useMemo, useState } from 'react';
import { IconChevronRight, IconDownload, IconEraser } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { equipoService, type Equipo } from '../services/equipo.service';
import type { ReglasControl, ModalidadControl } from '../utils/reglasControlEquipo';

// Planificación: cuántas revisiones vencen cada mes, por tipo de control, y cuáles son.
// Cuenta equipos en uso con fecha de siguiente revisión; los complementos (sin
// vencimiento), dados de baja y fuera de servicio no entran. Va aparte del listado: no usa
// sus filtros. Cada mes se abre para ver los equipos y abrir su ficha.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ATRASADOS = '0-atrasados';
const CONTROLES: ModalidadControl[] = ['MANTENCION_ANUAL', 'CONTRASTACION_SEMESTRAL', 'VERIFICACION_TRIMESTRAL', 'CALIBRACION_ANUAL'];
const MESES_ADELANTE = 12;

const etiquetaMes = (clave: string) => {
    if (clave === ATRASADOS) return 'Atrasadas (ya vencidas)';
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
    onEditEquipo?: (equipo: Equipo) => void;
}

export const EquiposPlanificacion: React.FC<Props> = ({ reglas, onEditEquipo }) => {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [control, setControl] = useState<string>('all');
    const [sede, setSede] = useState<string>('all');
    const [responsable, setResponsable] = useState<string>('all');
    const [abierto, setAbierto] = useState<string | null>(null);

    useEffect(() => {
        equipoService.getResumenCalidad()
            .then((r) => setEquipos(r.equipos))
            .catch(() => setError('No se pudo cargar la planificación.'))
            .finally(() => setCargando(false));
    }, []);

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

    // Sede y responsable filtran todo; el control filtra la tabla y se elige también desde las tarjetas.
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
        for (const e of filtrados) {
            const k = mesDe(e);
            porMes.set(k, [...(porMes.get(k) ?? []), e]);
        }
        // Los próximos 12 meses siempre (también los vacíos: se ven los huecos), más cualquier mes posterior con datos.
        const claves: string[] = [];
        if (porMes.has(ATRASADOS)) claves.push(ATRASADOS);
        const inicio = hoy.slice(0, 7);
        const set = new Set<string>();
        for (let i = 0; i < MESES_ADELANTE; i++) set.add(sumarMesesClave(inicio, i));
        for (const k of porMes.keys()) if (k !== ATRASADOS) set.add(k);
        claves.push(...Array.from(set).sort());
        return claves.map((k) => {
            const lista = (porMes.get(k) ?? []).slice().sort((a, b) => String(a.siguiente_verificacion).localeCompare(String(b.siguiente_verificacion)) || String(a.codigo).localeCompare(String(b.codigo)));
            const porControl = Object.fromEntries(CONTROLES.map((c) => [c, lista.filter((e) => e.modalidad_control === c).length])) as Record<ModalidadControl, number>;
            return { clave: k, lista, porControl, total: lista.length };
        });
    }, [filtrados, hoy]);

    const maxMes = Math.max(1, ...meses.filter((m) => m.clave !== ATRASADOS).map((m) => m.total));
    const mesPico = meses.filter((m) => m.clave !== ATRASADOS).reduce((a, b) => (b.total > a.total ? b : a), { clave: '', total: 0 } as { clave: string; total: number });
    const atrasadasTotal = filtrados.filter((e) => String(e.siguiente_verificacion).slice(0, 10) < hoy).length;

    const resumenControles = useMemo(() => CONTROLES.map((m) => {
        const lista = delAlcance.filter((e) => e.modalidad_control === m);
        return { m, total: lista.length, atrasadas: lista.filter((e) => String(e.siguiente_verificacion).slice(0, 10) < hoy).length };
    }), [delAlcance, hoy]);

    const hayFiltros = control !== 'all' || sede !== 'all' || responsable !== 'all';
    const limpiar = () => { setControl('all'); setSede('all'); setResponsable('all'); };

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
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {resumenControles.map(({ m, total, atrasadas }) => (
                    <button
                        key={m}
                        type="button"
                        aria-pressed={control === m}
                        onClick={() => setControl(control === m ? 'all' : m)}
                        className={cn('rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50', control === m && 'border-primary bg-primary/5')}
                    >
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
                {mesPico.total > 0 && <> · mayor carga: <span className="font-medium text-foreground">{etiquetaMes(mesPico.clave)}</span> ({mesPico.total})</>}
            </p>

            <div className="overflow-x-auto rounded-lg border bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[22%]">Mes de vencimiento</TableHead>
                            {CONTROLES.map((c) => <TableHead key={c} className="text-right text-xs" title={nombreControl(c)}>{cortoControl(c)}</TableHead>)}
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="hidden w-[22%] md:table-cell">Carga</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {meses.map((m) => {
                            const esAtraso = m.clave === ATRASADOS;
                            const vacio = m.total === 0;
                            const esPico = !esAtraso && m.total > 0 && m.total === mesPico.total;
                            const abierta = abierto === m.clave;
                            return (
                                <React.Fragment key={m.clave}>
                                    <TableRow
                                        className={cn(esAtraso && 'bg-destructive/5', vacio ? 'text-muted-foreground' : 'cursor-pointer hover:bg-muted/40')}
                                        onClick={() => !vacio && setAbierto(abierta ? null : m.clave)}
                                        aria-expanded={vacio ? undefined : abierta}
                                    >
                                        <TableCell className={cn('font-medium', esAtraso && 'text-destructive')}>
                                            <span className="inline-flex items-center gap-1.5">
                                                <IconChevronRight size={14} className={cn('transition-transform', vacio && 'invisible', abierta && 'rotate-90')} />
                                                {etiquetaMes(m.clave)}
                                            </span>
                                        </TableCell>
                                        {CONTROLES.map((c) => (
                                            <TableCell key={c} className="text-right tabular-nums">{m.porControl[c] || <span className="text-muted-foreground/50">·</span>}</TableCell>
                                        ))}
                                        <TableCell className="text-right font-semibold tabular-nums">{m.total || <span className="font-normal text-muted-foreground/50">·</span>}</TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {!esAtraso && m.total > 0 && (
                                                <div className="h-2 w-full rounded-full bg-muted">
                                                    <div className={cn('h-2 rounded-full', esPico ? 'bg-warning' : 'bg-primary/60')} style={{ width: `${Math.max(4, (m.total / maxMes) * 100)}%` }} />
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    {abierta && (
                                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                                            <TableCell colSpan={CONTROLES.length + 3} className="p-0">
                                                <div className="overflow-x-auto px-4 py-3">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-left text-xs text-muted-foreground">
                                                                <th className="py-1 pr-3 font-medium">Código</th>
                                                                <th className="py-1 pr-3 font-medium">Equipo</th>
                                                                <th className="py-1 pr-3 font-medium">Control</th>
                                                                <th className="py-1 pr-3 font-medium">Sede</th>
                                                                <th className="py-1 pr-3 font-medium">Responsable</th>
                                                                <th className="py-1 text-right font-medium">Vence</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {m.lista.map((e) => {
                                                                const iso = String(e.siguiente_verificacion).slice(0, 10);
                                                                const dias = diasHasta(iso, hoy);
                                                                return (
                                                                    <tr key={e.id_equipo} className="border-t border-border/60">
                                                                        <td className="py-1.5 pr-3 font-semibold">
                                                                            {onEditEquipo
                                                                                ? <button type="button" className="underline-offset-2 hover:underline" onClick={() => onEditEquipo(e)}>{e.codigo}</button>
                                                                                : e.codigo}
                                                                        </td>
                                                                        <td className="py-1.5 pr-3">{e.nombre}</td>
                                                                        <td className="py-1.5 pr-3 text-muted-foreground">{cortoControl(String(e.modalidad_control))}</td>
                                                                        <td className="py-1.5 pr-3 text-muted-foreground">{e.ubicacion}</td>
                                                                        <td className="py-1.5 pr-3 text-muted-foreground">{e.nombre_asignado || '—'}</td>
                                                                        <td className={cn('whitespace-nowrap py-1.5 text-right tabular-nums', dias < 0 && 'font-medium text-destructive')}>
                                                                            {fechaDMY(iso)} <span className="text-xs text-muted-foreground">({dias < 0 ? `hace ${-dias} d` : dias === 0 ? 'hoy' : `en ${dias} d`})</span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                            <TableCell className="font-semibold">Total</TableCell>
                            {CONTROLES.map((c) => <TableCell key={c} className="text-right font-semibold tabular-nums">{filtrados.filter((e) => e.modalidad_control === c).length}</TableCell>)}
                            <TableCell className="text-right font-semibold tabular-nums">{filtrados.length}</TableCell>
                            <TableCell className="hidden md:table-cell" />
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
            <p className="text-xs text-muted-foreground">
                Incluye equipos operativos con fecha de siguiente revisión. Los complementos (sin vencimiento), dados de baja y fuera de servicio no cuentan. Haz clic en un mes para ver sus equipos.
            </p>
        </div>
    );
};
