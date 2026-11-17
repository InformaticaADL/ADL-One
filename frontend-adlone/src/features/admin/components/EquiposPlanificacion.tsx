import React, { useEffect, useMemo, useState } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { equipoService, type Equipo } from '../services/equipo.service';
import type { ReglasControl, ModalidadControl } from '../utils/reglasControlEquipo';

// Planificación: cuántas revisiones vencen cada mes, por sede y tipo de control
// (mantención anual, contrastación semestral, verificación trimestral, calibración de
// patrón). Sirve para repartir el trabajo con tiempo. Solo cuenta equipos en uso con
// fecha de siguiente revisión; los complementos (sin vencimiento), dados de baja y fuera
// de servicio no entran. Va aparte del listado: no usa sus filtros.

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ATRASADOS = '0-atrasados';
const CONTROLES: ModalidadControl[] = ['MANTENCION_ANUAL', 'CONTRASTACION_SEMESTRAL', 'VERIFICACION_TRIMESTRAL', 'CALIBRACION_ANUAL'];

const claveMes = (iso: string) => iso.slice(0, 7);
const etiquetaMes = (clave: string) => {
    if (clave === ATRASADOS) return 'Atrasadas (ya vencidas)';
    const [y, m] = clave.split('-');
    return `${MESES[Number(m) - 1]} ${y}`;
};

interface Props { reglas: ReglasControl | null }

export const EquiposPlanificacion: React.FC<Props> = ({ reglas }) => {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [control, setControl] = useState<string>('all');
    const [sede, setSede] = useState<string>('all');

    useEffect(() => {
        equipoService.getResumenCalidad()
            .then((r) => setEquipos(r.equipos))
            .catch(() => setError('No se pudo cargar la planificación.'))
            .finally(() => setCargando(false));
    }, []);

    const nombreControl = (m: string) => reglas?.modalidades?.[m as ModalidadControl]?.nombre ?? m;

    // Equipos que entran al plan: en uso, con fecha y con un control que vence.
    const base = useMemo(() => equipos.filter((e) =>
        !!e.siguiente_verificacion
        && e.estado_vigencia !== 'retirado'
        && e.estado_vigencia !== 'sin_vencimiento'
        && !!e.modalidad_control
        && e.modalidad_control !== 'SIN_VENCIMIENTO'
    ), [equipos]);

    const sedes = useMemo(() => Array.from(new Set(base.map((e) => e.ubicacion || 'Sin sede'))).sort(), [base]);

    const filtrados = useMemo(() => base.filter((e) =>
        (control === 'all' || e.modalidad_control === control)
        && (sede === 'all' || (e.ubicacion || 'Sin sede') === sede)
    ), [base, control, sede]);

    const hoy = new Date().toISOString().slice(0, 10);

    // Filas por mes (primero las atrasadas), columnas por sede.
    const tabla = useMemo(() => {
        const columnas = sede === 'all' ? sedes : [sede];
        const porMes = new Map<string, Record<string, number>>();
        for (const e of filtrados) {
            const iso = String(e.siguiente_verificacion).slice(0, 10);
            const mes = iso < hoy ? ATRASADOS : claveMes(iso);
            const fila = porMes.get(mes) ?? {};
            const s = e.ubicacion || 'Sin sede';
            fila[s] = (fila[s] ?? 0) + 1;
            porMes.set(mes, fila);
        }
        const filas = Array.from(porMes.entries()).sort(([a], [b]) => a.localeCompare(b));
        return { columnas, filas };
    }, [filtrados, sedes, sede, hoy]);

    const totalFila = (f: Record<string, number>) => Object.values(f).reduce((a, b) => a + b, 0);
    const totalColumna = (c: string) => tabla.filas.reduce((acc, [, f]) => acc + (f[c] ?? 0), 0);

    const resumenControles = useMemo(() => CONTROLES.map((m) => {
        const lista = base.filter((e) => e.modalidad_control === m);
        return { m, total: lista.length, atrasadas: lista.filter((e) => String(e.siguiente_verificacion).slice(0, 10) < hoy).length };
    }), [base, hoy]);

    if (cargando) return <p className="p-6 text-sm text-muted-foreground">Cargando planificación…</p>;
    if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;

    return (
        <div className="flex flex-col gap-4 pb-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {resumenControles.map(({ m, total, atrasadas }) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setControl(control === m ? 'all' : m)}
                        className={cn('rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50', control === m && 'border-primary bg-primary/5')}
                    >
                        <div className="text-xs text-muted-foreground">{nombreControl(m)}</div>
                        <div className="mt-1 text-2xl font-semibold tabular-nums">{total}</div>
                        <div className={cn('text-xs', atrasadas > 0 ? 'text-destructive' : 'text-muted-foreground')}>
                            {atrasadas > 0 ? `${atrasadas} atrasadas` : 'Sin atrasos'}
                        </div>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-end gap-3">
                <div className="w-full sm:w-64">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Control de fechas</Label>
                    <Combobox
                        value={control}
                        onValueChange={(v) => setControl(v || 'all')}
                        placeholder="Control de fechas"
                        options={[{ value: 'all', label: 'Todos' }, ...CONTROLES.map((m) => ({ value: m, label: nombreControl(m) }))]}
                    />
                </div>
                <div className="w-full sm:w-48">
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Sede</Label>
                    <Combobox
                        value={sede}
                        onValueChange={(v) => setSede(v || 'all')}
                        placeholder="Sede"
                        options={[{ value: 'all', label: 'Todas las sedes' }, ...sedes.map((s) => ({ value: s, label: s }))]}
                    />
                </div>
                <span className="pb-2 text-xs text-muted-foreground">{filtrados.length} revisiones en el plan</span>
            </div>

            <div className="overflow-x-auto rounded-lg border bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Mes de vencimiento</TableHead>
                            {tabla.columnas.map((c) => <TableHead key={c} className="text-right">{c}</TableHead>)}
                            <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {tabla.filas.length === 0 ? (
                            <TableRow><TableCell colSpan={tabla.columnas.length + 2} className="py-8 text-center text-sm text-muted-foreground">No hay revisiones para este filtro.</TableCell></TableRow>
                        ) : tabla.filas.map(([mes, fila]) => (
                            <TableRow key={mes} className={cn(mes === ATRASADOS && 'bg-destructive/5')}>
                                <TableCell className={cn('font-medium', mes === ATRASADOS && 'text-destructive')}>{etiquetaMes(mes)}</TableCell>
                                {tabla.columnas.map((c) => <TableCell key={c} className="text-right tabular-nums">{fila[c] ?? '—'}</TableCell>)}
                                <TableCell className="text-right font-semibold tabular-nums">{totalFila(fila)}</TableCell>
                            </TableRow>
                        ))}
                        {tabla.filas.length > 0 && (
                            <TableRow className="bg-muted/40">
                                <TableCell className="font-semibold">Total</TableCell>
                                {tabla.columnas.map((c) => <TableCell key={c} className="text-right font-semibold tabular-nums">{totalColumna(c)}</TableCell>)}
                                <TableCell className="text-right font-semibold tabular-nums">{filtrados.length}</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <p className="text-xs text-muted-foreground">Incluye equipos operativos con fecha de siguiente revisión. Los complementos (sin vencimiento), dados de baja y fuera de servicio no cuentan.</p>
        </div>
    );
};
