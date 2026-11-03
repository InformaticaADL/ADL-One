import React, { useEffect, useMemo, useState } from 'react';
import { IconFilePlus, IconSearch, IconAlertTriangle, IconBan } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '../../../../contexts/ToastContext';
import { verificacionTemperaturaService as api, type EquipoElegible } from '../../services/verificacionTemperatura.service';
import { fmtFecha, hoyYmd, nombrePeriodo } from '../../utils/verificacionTemperatura';

interface Props {
    open: boolean;
    onClose: () => void;
    // Una sola ficha → se abre directo para llenarla. Varias → se refresca el listado.
    onCreadas: (ids: number[]) => void;
}

const SEDES = ['PM', 'VI', 'AY', 'PA'];

// Crea fichas de verificación para uno o muchos equipos a la vez (la "campaña"
// del mes, como la planilla Excel). Solo lista los equipos que miden
// temperatura; los que ya tienen ficha en el periodo no se pueden repetir.
// Los dados de baja aparecen al final con advertencia: se pueden elegir uno a
// uno, pero no entran en "Todos" ni "Por vencer".
export const CrearFichasDialog: React.FC<Props> = ({ open, onClose, onCreadas }) => {
    const { showToast } = useToast();
    const [fecha, setFecha] = useState(hoyYmd());
    const [periodo, setPeriodo] = useState(hoyYmd().slice(0, 7));
    const [sede, setSede] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [equipos, setEquipos] = useState<EquipoElegible[]>([]);
    const [cargando, setCargando] = useState(false);
    const [seleccion, setSeleccion] = useState<Set<number>>(new Set());
    const [creando, setCreando] = useState(false);

    useEffect(() => {
        if (!open) return;
        setSeleccion(new Set());
        setBusqueda('');
    }, [open]);

    useEffect(() => {
        if (!open || !/^\d{4}-\d{2}$/.test(periodo)) return;
        setCargando(true);
        api.elegibles({ periodo, sede: sede || undefined })
            .then(setEquipos)
            .catch(() => setEquipos([]))
            .finally(() => setCargando(false));
    }, [open, periodo, sede]);

    const hoy = hoyYmd();
    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return q ? equipos.filter((e) => `${e.codigo} ${e.nombre} ${e.nombre_muestreador || ''}`.toLowerCase().includes(q)) : equipos;
    }, [equipos, busqueda]);
    const disponibles = visibles.filter((e) => !e.id_ficha_periodo && !e.dado_baja);
    const dadosBaja = visibles.filter((e) => e.dado_baja).length;
    const bajaSeleccionados = equipos.filter((e) => e.dado_baja && seleccion.has(e.id_equipo)).length;
    const vencidos = disponibles.filter((e) => !e.siguiente_verificacion || e.siguiente_verificacion <= `${periodo}-31`);

    const toggle = (id: number) => setSeleccion((prev) => {
        const s = new Set(prev);
        if (s.has(id)) s.delete(id); else s.add(id);
        return s;
    });

    const marcar = (lista: EquipoElegible[]) => setSeleccion(new Set(lista.map((e) => e.id_equipo)));

    const crear = async () => {
        const ids = [...seleccion];
        if (!ids.length) return;
        setCreando(true);
        try {
            if (ids.length === 1) {
                const r = await api.crear({ id_equipo: ids[0], fecha, periodo });
                showToast({ type: 'success', message: 'Ficha creada' });
                onCreadas([r.id_verificacion]);
            } else {
                const r = await api.crearLote({ ids_equipo: ids, fecha, periodo });
                showToast({
                    type: r.omitidas.length ? 'warning' : 'success',
                    message: `${r.creadas} ficha(s) creada(s) para ${nombrePeriodo(periodo)}${r.omitidas.length ? ` · ${r.omitidas.length} omitida(s): ${r.omitidas[0].motivo}` : ''}`,
                });
                onCreadas(r.ids);
            }
        } catch (err) {
            const mensaje = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: mensaje || 'No se pudieron crear las fichas' });
        } finally {
            setCreando(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o && !creando) onClose(); }}>
            <DialogContent className="flex h-[88vh] w-[95vw] max-w-4xl flex-col gap-4 overflow-hidden">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <IconFilePlus size={22} />
                        </div>
                        <div className="min-w-0 text-left">
                            <DialogTitle>Crear fichas de verificación de temperatura</DialogTitle>
                            <DialogDescription>Seleccione uno o varios equipos. Se crean en borrador para llenar sus mediciones.</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Fecha de verificación
                        <Input type="date" value={fecha} max={hoy} onChange={(e) => { setFecha(e.target.value); if (e.target.value) setPeriodo(e.target.value.slice(0, 7)); }} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Periodo (campaña)
                        <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
                    </label>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        Sede
                        <div className="flex gap-1">
                            {['', ...SEDES].map((s) => (
                                <button
                                    key={s || 'todas'}
                                    type="button"
                                    onClick={() => setSede(s)}
                                    className={cn('h-9 flex-1 rounded-md border text-sm transition-colors', sede === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:bg-muted')}
                                >
                                    {s || 'Todas'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative min-w-[200px] flex-1">
                        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar por código, nombre o muestreador..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => marcar(disponibles)} disabled={!disponibles.length}>Todos ({disponibles.length})</Button>
                    <Button variant="outline" size="sm" onClick={() => marcar(vencidos)} disabled={!vencidos.length} title="Equipos cuya siguiente revisión vence dentro del periodo o ya venció">
                        Por vencer ({vencidos.length})
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setSeleccion(new Set())} disabled={!seleccion.size}>Ninguno</Button>
                </div>

                {dadosBaja > 0 && (
                    <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconBan size={13} className="shrink-0 text-destructive" />
                        {dadosBaja} equipo(s) dado(s) de baja al final de la lista: se pueden seleccionar uno a uno.
                    </p>
                )}

                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border">
                    {cargando ? (
                        <div className="flex h-full items-center justify-center py-10">
                            <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : visibles.length === 0 ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">No hay equipos que midan temperatura con estos filtros.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {visibles.map((e) => {
                                const yaTiene = !!e.id_ficha_periodo;
                                const baja = !!e.dado_baja;
                                const vencido = !baja && (!e.siguiente_verificacion || e.siguiente_verificacion < hoy);
                                return (
                                    <li key={e.id_equipo}>
                                        <label className={cn('flex items-center gap-3 px-4 py-2.5', yaTiene ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-muted/40', baja && 'bg-destructive/[0.04]')}>
                                            <Checkbox checked={seleccion.has(e.id_equipo)} disabled={yaTiene} onCheckedChange={() => toggle(e.id_equipo)} />
                                            <div className="min-w-0 flex-1">
                                                <p className="flex items-center gap-2 text-sm">
                                                    <span className={cn('font-semibold', baja && 'text-muted-foreground line-through decoration-destructive/60')}>{e.codigo}</span>
                                                    <span className="truncate text-muted-foreground">{e.nombre}</span>
                                                </p>
                                                <p className="truncate text-xs text-muted-foreground">
                                                    {e.nombre_muestreador || 'Sin responsable'} · Última: {fmtFecha(e.ultima_verificacion)} · Siguiente:{' '}
                                                    <span className={cn(vencido && 'font-medium text-destructive')}>{fmtFecha(e.siguiente_verificacion)}</span>
                                                </p>
                                            </div>
                                            {baja && (
                                                <Badge variant="destructive" className="shrink-0 gap-1" title={`Estado: ${e.estado_equipo || 'Dado de baja'}`}>
                                                    <IconBan size={12} /> Dado de baja
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="shrink-0">{e.sede}</Badge>
                                            {yaTiene && <Badge variant="secondary" className="shrink-0">Ya tiene ficha</Badge>}
                                            {!yaTiene && vencido && <IconAlertTriangle size={15} className="shrink-0 text-destructive" aria-label="Revisión vencida" />}
                                        </label>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <DialogFooter className="items-center gap-2 sm:justify-between">
                    <span className="text-sm text-muted-foreground">
                        {seleccion.size} equipo(s) seleccionado(s) · {nombrePeriodo(periodo)}
                        {bajaSeleccionados > 0 && (
                            <span className="ml-2 inline-flex items-center gap-1 font-medium text-destructive">
                                <IconAlertTriangle size={14} /> {bajaSeleccionados} dado(s) de baja
                            </span>
                        )}
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={creando}>Cancelar</Button>
                        <Button onClick={crear} disabled={!seleccion.size || creando || !fecha}>
                            {creando
                                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                : <IconFilePlus size={15} />}
                            {seleccion.size > 1 ? `Crear ${seleccion.size} fichas` : 'Crear ficha'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
