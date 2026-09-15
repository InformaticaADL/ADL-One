import React, { useState, useEffect } from 'react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    IconUserMinus,
    IconBuildingCommunity,
    IconUsers,
    IconEdit,
    IconCheck,
    IconHash
} from '@tabler/icons-react';

interface MuestreadorDeactivationFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    isEmbedded?: boolean;
    onDataChange?: (data: any) => void;
}

const MuestreadorDeactivationForm: React.FC<MuestreadorDeactivationFormProps> = ({
    onSuccess,
    onCancel,
    isEmbedded = false,
    onDataChange
}) => {
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [transferType, setTransferType] = useState<'BASE' | 'MUESTREADOR' | 'MANUAL' | ''>('');
    const [targetBase, setTargetBase] = useState<string | null>(null);
    const [targetMuestreadorId, setTargetMuestreadorId] = useState<string | null>(null);
    const [equipmentList, setEquipmentList] = useState<any[]>([]);
    const [manualAssignments, setManualAssignments] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [loadingEquipos, setLoadingEquipos] = useState(false);
    const [equipmentCount, setEquipmentCount] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const { setActiveSubmodule } = useNavStore();
    const { showToast } = useToast();

    useEffect(() => {
        apiClient.get('/api/catalogos/muestreadores')
            .then(res => setMuestreadores(res.data.data))
            .catch(() => showToast({ type: 'error', message: 'Error al cargar muestreadores' }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedId) {
            setLoadingEquipos(true);
            setEquipmentCount(null);
            apiClient.get(`/api/admin/equipos?id_muestreador=${selectedId}&limit=100`)
                .then(res => {
                    const list = res.data.data || [];
                    setEquipmentList(list);
                    setEquipmentCount(list.length);
                })
                .catch(() => showToast({ type: 'error', message: 'Error al cargar equipos del muestreador' }))
                .finally(() => setLoadingEquipos(false));
        } else {
            setEquipmentList([]);
            setEquipmentCount(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedId]);

    // Notify parent
    useEffect(() => {
        if (onDataChange) {
            const data: any = {
                muestreador_origen_id: selectedId ? Number(selectedId) : null,
                muestreador_origen_nombre: muestreadores.find(m => String(m.id_muestreador) === selectedId)?.nombre_muestreador,
                tipo_traspaso: transferType,
            };

            if (transferType === 'BASE') {
                data.base_destino = targetBase;
            } else if (transferType === 'MUESTREADOR') {
                data.muestreador_destino_id = targetMuestreadorId ? Number(targetMuestreadorId) : null;
                data.muestreador_destino_nombre = muestreadores.find(m => String(m.id_muestreador) === targetMuestreadorId)?.nombre_muestreador;
            } else if (transferType === 'MANUAL') {
                data.reasignacion_manual = equipmentList.map(eq => ({
                    id_equipo: eq.id_equipo,
                    nombre_equipo: eq.nombre,
                    codigo_equipo: eq.codigo,
                    id_muestreador_nuevo: manualAssignments[eq.id_equipo] || null
                }));
            }
            onDataChange(data);
        }
    }, [selectedId, transferType, targetBase, targetMuestreadorId, manualAssignments, equipmentList, muestreadores, onDataChange]);

    const bases = [
        { value: 'Base Aysén', label: '🏢 Base Aysén' },
        { value: 'Base Puerto Montt', label: '🏢 Base Puerto Montt' },
        { value: 'Base Villarrica', label: '🏢 Base Villarrica' },
        { value: 'Sede Villarrica', label: '🏢 Sede Villarrica' }
    ];

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (isEmbedded) return;

        if (!selectedId || !transferType) return;

        setLoading(true);
        try {
            const types = await ursService.getRequestTypes();
            const type = types.find((t: any) => t.codigo === 'DESHABILITAR_MUESTREADOR' || t.nombre === 'Deshabilitar muestreador');
            if (!type) throw new Error("No se encontró el tipo de solicitud");

            const payload: any = {
                muestreador_origen_id: Number(selectedId),
                muestreador_origen_nombre: muestreadores.find(m => String(m.id_muestreador) === selectedId)?.nombre_muestreador,
                tipo_traspaso: transferType,
            };

            if (transferType === 'BASE') payload.base_destino = targetBase;
            else if (transferType === 'MUESTREADOR') {
                payload.muestreador_destino_id = Number(targetMuestreadorId);
                payload.muestreador_destino_nombre = muestreadores.find(m => String(m.id_muestreador) === targetMuestreadorId)?.nombre_muestreador;
            }
            else if (transferType === 'MANUAL') {
                payload.reasignacion_manual = equipmentList.map(eq => ({
                    id_equipo: eq.id_equipo,
                    nombre_equipo: eq.nombre,
                    codigo_equipo: eq.codigo,
                    id_muestreador_nuevo: manualAssignments[eq.id_equipo] || null
                }));
            }

            await ursService.createRequest({
                id_tipo: type.id_tipo,
                datos_json: payload,
                archivos: []
            });
            setSubmitted(true);
            if (onSuccess) onSuccess();
        } catch {
            showToast({ type: 'error', message: 'Error al crear la solicitud de deshabilitación' });
        } finally {
            setLoading(false);
        }
    };

    if (submitted && !isEmbedded) {
        return (
            <Card className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <IconCheck size={40} />
                </div>
                <h2 className="mb-2 text-xl font-bold text-foreground">¡Solicitud Enviada!</h2>
                <p className="mb-6 text-sm text-muted-foreground">La solicitud de deshabilitación ha sido creada correctamente.</p>
                <Button onClick={() => setActiveSubmodule('')}>
                    Volver a la lista
                </Button>
            </Card>
        );
    }

    const opciones: { id: 'BASE' | 'MUESTREADOR' | 'MANUAL'; label: string; icon: React.ReactNode }[] = [
        { id: 'BASE', label: 'Traspaso a Base', icon: <IconBuildingCommunity size={20} /> },
        { id: 'MUESTREADOR', label: 'A Compañero', icon: <IconUsers size={20} /> },
        { id: 'MANUAL', label: 'Manual', icon: <IconEdit size={20} /> },
    ];

    return (
        <div className="flex flex-col gap-6">
            {!isEmbedded && (
                <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    <IconUserMinus size={18} className="mt-0.5 shrink-0" />
                    <div>
                        <div className="font-medium">Baja de Muestreador</div>
                        <div className="text-muted-foreground">Procedimiento para deshabilitar a un compañero y reasignar sus equipos.</div>
                    </div>
                </div>
            )}

            <Field label="Persona a deshabilitar *">
                <Combobox
                    placeholder="Seleccione un muestreador..."
                    searchPlaceholder="Buscar muestreador..."
                    options={muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                    value={selectedId ?? undefined}
                    onValueChange={(v) => setSelectedId(v ?? null)}
                />
            </Field>

            {selectedId && (
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-semibold text-foreground">Reasignación de Equipos ({equipmentCount ?? '...'})</span>
                    <div className="grid grid-cols-3 gap-2">
                        {opciones.map((opt) => {
                            const selected = transferType === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setTransferType(opt.id)}
                                    className={cn(
                                        'flex flex-col items-center rounded-lg border p-4 text-center transition-colors',
                                        selected ? 'border-primary bg-primary/10' : 'border-border bg-card hover:bg-muted/50'
                                    )}
                                >
                                    <span className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-md', selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                                        {opt.icon}
                                    </span>
                                    <span className={cn('text-xs font-semibold', selected ? 'text-primary' : 'text-muted-foreground')}>
                                        {opt.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {transferType === 'BASE' && (
                <Field label="Base de destino *">
                    <Combobox
                        placeholder="Seleccione base..."
                        searchPlaceholder="Buscar base..."
                        options={bases}
                        value={targetBase ?? undefined}
                        onValueChange={(v) => setTargetBase(v ?? null)}
                    />
                </Field>
            )}

            {transferType === 'MUESTREADOR' && (
                <Field label="Muestreador de destino *">
                    <Combobox
                        placeholder="Seleccione destino..."
                        searchPlaceholder="Buscar muestreador..."
                        options={muestreadores.filter(m => String(m.id_muestreador) !== selectedId).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                        value={targetMuestreadorId ?? undefined}
                        onValueChange={(v) => setTargetMuestreadorId(v ?? null)}
                    />
                </Field>
            )}

            {transferType === 'MANUAL' && (
                <Card className="p-4">
                    <div className="mb-2 flex justify-between">
                        <span className="text-[11px] font-semibold text-muted-foreground">Equipos de {muestreadores.find(m => String(m.id_muestreador) === selectedId)?.nombre_muestreador}</span>
                        <Badge variant="secondary">{equipmentList.length} ítems</Badge>
                    </div>

                    <hr className="my-0 mb-4 border-t border-border" />

                    <div className="flex flex-col gap-2">
                        {loadingEquipos ? (
                            <div className="flex justify-center p-8">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        ) : (
                            equipmentList.map(eq => (
                                <div key={eq.id_equipo} className="rounded-lg border border-border bg-card p-2">
                                    <div className="flex flex-nowrap items-center justify-between">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <Badge variant="outline" className="gap-1"><IconHash size={10} />{eq.codigo}</Badge>
                                            <span className="truncate text-sm font-semibold text-foreground">{eq.nombre}</span>
                                        </div>
                                        <Combobox
                                            className="w-[140px]"
                                            placeholder="Destino"
                                            searchPlaceholder="Buscar..."
                                            options={muestreadores.filter(m => String(m.id_muestreador) !== selectedId).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                                            value={manualAssignments[eq.id_equipo] ? String(manualAssignments[eq.id_equipo]) : undefined}
                                            onValueChange={(val) => setManualAssignments({ ...manualAssignments, [eq.id_equipo]: Number(val) })}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            )}

            {!isEmbedded && (
                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button
                        disabled={!transferType || loading}
                        onClick={() => handleSubmit()}
                    >
                        {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                        Confirmar Baja
                    </Button>
                </div>
            )}
        </div>
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

export default MuestreadorDeactivationForm;
