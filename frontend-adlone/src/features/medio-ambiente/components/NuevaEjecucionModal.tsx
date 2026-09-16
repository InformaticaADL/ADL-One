import React, { useState, useEffect, useMemo } from 'react';
import {
    IconCalendarEvent, IconCheck, IconAlertCircle, IconRefresh
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { rutasEjecucionesService, type FichaDisponible, type CorrelativoOption } from '../services/rutasEjecuciones.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { useToast } from '../../../contexts/ToastContext';

interface NuevaEjecucionModalProps {
    opened: boolean;
    onClose: () => void;
    rutaId: number;
    rutaNombre: string;
    onSuccess: () => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
    DISPONIBLE: 'success',
    AGENDADO: 'warning',
    EN_RUTA: 'secondary'
};

const STATUS_LABEL: Record<string, string> = {
    DISPONIBLE: 'Disponible',
    AGENDADO: 'Agendado',
    EN_RUTA: 'En Ruta'
};

const Spinner = ({ className }: { className?: string }) => (
    <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent', className)} />
);

export const NuevaEjecucionModal: React.FC<NuevaEjecucionModalProps> = ({
    opened, onClose, rutaId, rutaNombre, onSuccess
}) => {
    const { showToast } = useToast();
    const { getCatalogo } = useCatalogos();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [plantillaData, setPlantillaData] = useState<{ fichas: FichaDisponible[] } | null>(null);

    // Form fields
    const [fecha, setFecha] = useState('');
    const [muestreadorInst, setMuestreadorInst] = useState<string | null>(null);
    const [muestreadorRet, setMuestreadorRet] = useState<string | null>(null);
    const [observaciones, setObservaciones] = useState('');

    // Per-ficha selection state: Map<id_fichaingresoservicio, { selected, correlativo, id_agendamam }>
    const [fichaState, setFichaState] = useState<Map<number, { selected: boolean; correlativo: string; id_agendamam: number | null }>>(new Map());

    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    const muestreadorOptions = useMemo(
        () => muestreadores.map((m: any) => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const [result, muest] = await Promise.all([
                rutasEjecucionesService.getFichasDisponibles(rutaId),
                getCatalogo('muestreadores', () => catalogosService.getMuestreadores())
            ]);
            setPlantillaData(result);
            if (muest) setMuestreadores(muest);

            // Initialize per-ficha state: auto-deselect fichas with 0 disponibles
            const initMap = new Map<number, { selected: boolean; correlativo: string; id_agendamam: number | null }>();
            result.fichas.forEach((f: FichaDisponible) => {
                initMap.set(f.id_fichaingresoservicio, {
                    selected: f.disponibles > 0,
                    correlativo: f.suggested_correlativo || '',
                    id_agendamam: f.suggested_id_agendamam
                });
            });
            setFichaState(initMap);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar las fichas de la ruta' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (opened) {
            loadData();
            setFecha('');
            setMuestreadorInst(null);
            setMuestreadorRet(null);
            setObservaciones('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened, rutaId]);

    const toggleFicha = (id: number) => {
        setFichaState(prev => {
            const next = new Map(prev);
            const cur = next.get(id);
            if (cur) next.set(id, { ...cur, selected: !cur.selected });
            return next;
        });
    };

    const setCorrelativo = (id: number, ficha: FichaDisponible, corrValue: string) => {
        const corrObj = ficha.correlativos.find(c => c.frecuencia_correlativo === corrValue);
        setFichaState(prev => {
            const next = new Map(prev);
            const cur = next.get(id);
            if (cur) next.set(id, { ...cur, correlativo: corrValue, id_agendamam: corrObj?.id_agendamam ?? null });
            return next;
        });
    };

    const selectedCount = useMemo(() =>
        [...fichaState.values()].filter(v => v.selected).length,
        [fichaState]
    );

    const handleSelectAll = (val: boolean) => {
        setFichaState(prev => {
            const next = new Map(prev);
            next.forEach((v, k) => next.set(k, { ...v, selected: val }));
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!fecha) { showToast({ type: 'warning', message: 'Selecciona la fecha de muestreo' }); return; }
        if (!muestreadorInst) { showToast({ type: 'warning', message: 'Selecciona el muestreador de instalación' }); return; }
        if (selectedCount === 0) { showToast({ type: 'warning', message: 'Selecciona al menos una ficha' }); return; }

        const sinCorrelativo = [...fichaState.values()].filter(v => v.selected && !v.correlativo?.trim());
        if (sinCorrelativo.length > 0) {
            showToast({ type: 'warning', message: 'Todas las fichas seleccionadas deben tener un correlativo asignado' });
            return;
        }

        const fichasPayload = (plantillaData?.fichas ?? [])
            .filter(f => fichaState.get(f.id_fichaingresoservicio)?.selected)
            .map((f, i) => {
                const state = fichaState.get(f.id_fichaingresoservicio)!;
                return {
                    id_fichaingresoservicio: f.id_fichaingresoservicio,
                    orden: f.orden ?? i + 1,
                    frecuencia_correlativo: state.correlativo,
                    id_agendamam: state.id_agendamam ?? undefined
                };
            });

        setSubmitting(true);
        try {
            await rutasEjecucionesService.create({
                id_ruta_planificada: rutaId,
                fecha_ejecucion: fecha,
                id_muestreador_inst: Number(muestreadorInst),
                id_muestreador_ret: muestreadorRet ? Number(muestreadorRet) : undefined,
                fichas: fichasPayload,
                observaciones: observaciones || undefined
            });
            showToast({ type: 'success', message: `Ejecución creada: ${selectedCount} ficha(s) asignadas` });
            onSuccess();
            onClose();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al crear la ejecución' });
        } finally {
            setSubmitting(false);
        }
    };

    const allSelected = selectedCount === (plantillaData?.fichas.length ?? 0);
    const noneSelected = selectedCount === 0;

    return (
        <Dialog open={opened} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-h-[85vh] max-w-[840px] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconCalendarEvent size={20} className="text-[#2f9e44]" />
                        Nueva Ejecución
                        <Badge variant="outline">{rutaNombre}</Badge>
                    </DialogTitle>
                </DialogHeader>
                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {/* Header fields */}
                        <Card className="bg-muted/40 p-3">
                            <div className="grid grid-cols-3 items-start gap-3">
                                <Field label="Fecha de Muestreo *">
                                    <Input
                                        type="date"
                                        value={fecha}
                                        onChange={e => setFecha(e.target.value)}
                                    />
                                </Field>
                                <Field label="Muestreador Instalación *">
                                    <Combobox
                                        options={muestreadorOptions}
                                        value={muestreadorInst ?? ''}
                                        onValueChange={v => { setMuestreadorInst(v || null); if (!muestreadorRet) setMuestreadorRet(v || null); }}
                                        placeholder="Seleccionar..."
                                        searchPlaceholder="Buscar muestreador..."
                                    />
                                </Field>
                                <Field label="Muestreador Retiro">
                                    <Combobox
                                        options={muestreadorOptions}
                                        value={muestreadorRet ?? ''}
                                        onValueChange={v => setMuestreadorRet(v || null)}
                                        placeholder="Igual al de instalación"
                                        searchPlaceholder="Buscar muestreador..."
                                    />
                                </Field>
                            </div>
                            <div className="mt-2">
                                <Field label="Observaciones">
                                    <Input
                                        placeholder="Opcional"
                                        value={observaciones}
                                        onChange={e => setObservaciones(e.target.value)}
                                    />
                                </Field>
                            </div>
                        </Card>

                        <hr className="border-t border-border" />

                        {/* Banner fichas agotadas */}
                        {(plantillaData?.fichas ?? []).some(f => f.disponibles === 0) && (
                            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                                <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-warning" />
                                <p className="text-xs text-foreground">
                                    <span className="font-semibold">{(plantillaData?.fichas ?? []).filter(f => f.disponibles === 0).length} ficha(s)</span> no tienen correlativos disponibles y fueron deseleccionadas automáticamente.
                                    Puedes seleccionarlas manualmente si lo requieres, pero su correlativo sugerido puede estar ya ejecutado.
                                </p>
                            </div>
                        )}

                        {/* Fichas list */}
                        <div className="flex items-center justify-between">
                            <span className="text-[13px] font-semibold">
                                Fichas de la plantilla
                                <span className="font-normal text-muted-foreground"> — {selectedCount} de {plantillaData?.fichas.length ?? 0} seleccionadas</span>
                            </span>
                            <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleSelectAll(true)} disabled={allSelected}>Todas</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleSelectAll(false)} disabled={noneSelected}>Ninguna</Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" title="Recargar correlativos disponibles" onClick={loadData}>
                                    <IconRefresh size={14} />
                                </Button>
                            </div>
                        </div>

                        {plantillaData?.fichas.length === 0 ? (
                            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                                <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-warning" />
                                <p className="text-xs text-foreground">Esta plantilla no tiene fichas. Edítala primero para agregar fichas.</p>
                            </div>
                        ) : selectedCount === 0 && (plantillaData?.fichas ?? []).every(f => f.disponibles === 0) ? (
                            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                                <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                                <div>
                                    <p className="text-xs font-semibold text-foreground">Sin fichas ejecutables</p>
                                    <p className="text-xs text-muted-foreground">Todas las fichas de esta ruta tienen sus correlativos agotados (ejecutados o cancelados). No es posible crear una ejecución hasta que las fichas tengan nuevos servicios disponibles.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-h-[340px] overflow-y-auto pr-1">
                                <div className="flex flex-col gap-2">
                                    {(plantillaData?.fichas ?? []).map((f) => {
                                        const state = fichaState.get(f.id_fichaingresoservicio);
                                        const isSelected = state?.selected ?? false;
                                        const currentCorr = state?.correlativo ?? '';
                                        const sinDisponibles = f.disponibles === 0;
                                        const corrOptions = f.correlativos.map((c: CorrelativoOption) => ({
                                            value: c.frecuencia_correlativo,
                                            label: `${c.frecuencia_correlativo} — ${STATUS_LABEL[c.status] ?? c.status}${c.fecha_muestreo ? ` (${new Date(c.fecha_muestreo).toLocaleDateString('es-CL')})` : ''}`
                                        }));

                                        const selectedCorrObj = f.correlativos.find(c => c.frecuencia_correlativo === currentCorr);

                                        return (
                                            <Card
                                                key={f.id_fichaingresoservicio}
                                                className={cn(
                                                    'p-3 transition-opacity',
                                                    isSelected ? 'opacity-100' : 'opacity-50',
                                                    sinDisponibles ? 'border-[#e8590c] bg-[#e8590c]/5' : isSelected && 'border-[#4dabf7]'
                                                )}
                                            >
                                                <div className="flex flex-nowrap items-start gap-2.5">
                                                    <Checkbox
                                                        checked={isSelected}
                                                        onCheckedChange={() => toggleFicha(f.id_fichaingresoservicio)}
                                                        className="mt-1"
                                                    />
                                                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#9c36b5] text-[10px] font-bold text-white">
                                                        {f.orden}
                                                    </div>
                                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                                        <div className="flex flex-nowrap items-center gap-2">
                                                            <span className="text-xs font-semibold text-primary">#{f.id_fichaingresoservicio}</span>
                                                            {f.centro && <span className="truncate text-xs text-muted-foreground">{f.centro}</span>}
                                                            {f.empresa_servicio && <span className="truncate text-[10px] text-muted-foreground">{f.empresa_servicio}</span>}
                                                            {sinDisponibles && (
                                                                <Badge variant="warning" className="shrink-0" title="Todos los correlativos de esta ficha ya fueron ejecutados o cancelados">
                                                                    Sin disponibles
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex flex-nowrap items-center gap-2">
                                                            <Combobox
                                                                options={corrOptions}
                                                                value={currentCorr}
                                                                onValueChange={v => v && setCorrelativo(f.id_fichaingresoservicio, f, v)}
                                                                disabled={!isSelected || corrOptions.length === 0}
                                                                placeholder={corrOptions.length === 0 ? 'Sin correlativos' : 'Seleccionar correlativo...'}
                                                                searchPlaceholder="Buscar correlativo..."
                                                                className="min-w-[200px] flex-1"
                                                            />
                                                            {selectedCorrObj && (
                                                                <Badge variant={STATUS_VARIANT[selectedCorrObj.status] ?? 'outline'} className="shrink-0">
                                                                    {STATUS_LABEL[selectedCorrObj.status] ?? selectedCorrObj.status}
                                                                </Badge>
                                                            )}
                                                            <span className="shrink-0 text-[10px] text-muted-foreground">
                                                                {f.disponibles}/{f.total} disp.
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <hr className="border-t border-border" />

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
                            <Button
                                className="bg-[#2f9e44] text-white hover:bg-[#2f9e44]/90"
                                onClick={handleSubmit}
                                disabled={submitting || selectedCount === 0 || !fecha || !muestreadorInst}
                            >
                                {submitting ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <IconCheck size={16} />}
                                Crear Ejecución ({selectedCount} ficha{selectedCount !== 1 ? 's' : ''})
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}
