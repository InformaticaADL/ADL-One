import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    IconCheck,
    IconUpload,
    IconSettings,
    IconX
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import MuestreadorDeactivationForm from '../components/MuestreadorDeactivationForm';
import EquipoActivationForm from '../components/EquipoActivationForm';
import EquipoBajaForm from '../components/EquipoBajaForm';
import EquipoTraspasoForm from '../components/EquipoTraspasoForm';
import NuevoEquipoForm from '../components/NuevoEquipoForm';
import ReporteProblemaForm from '../components/ReporteProblemaForm';
import VigenciaExtensionForm from '../components/VigenciaExtensionForm';
import { useNavStore } from '../../../store/navStore';
import FileIcon from '../components/FileIcon';
import { useToast } from '../../../contexts/ToastContext';

// Memoize sub-forms to prevent heavy parent re-renders when local state changes
const MemoizedEquipoTraspasoForm = React.memo(EquipoTraspasoForm);
const MemoizedMuestreadorDeactivationForm = React.memo(MuestreadorDeactivationForm);
const MemoizedEquipoActivationForm = React.memo(EquipoActivationForm);
const MemoizedEquipoBajaForm = React.memo(EquipoBajaForm);
const MemoizedNuevoEquipoForm = React.memo(NuevoEquipoForm);
const MemoizedReporteProblemaForm = React.memo(ReporteProblemaForm);
const MemoizedVigenciaExtensionForm = React.memo(VigenciaExtensionForm);

const PRIORITY_OPTIONS: { value: string; label: string }[] = [
    { value: 'BAJA', label: 'Baja' },
    { value: 'MEDIA', label: 'Media' },
    { value: 'ALTA', label: 'Alta' },
];

interface NewRequestPageProps {
    onBack?: () => void;
}

const NewRequestPage: React.FC<NewRequestPageProps> = ({ onBack }) => {
    const { setPendingRequestId, setUrsInboxMode, setActiveSubmodule } = useNavStore();
    const { showToast } = useToast();

    // Navigation
    const goToInbox = () => setActiveSubmodule('');

    // State
    const [types, setTypes] = useState<any[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [priority, setPriority] = useState('MEDIA');
    const [observations, setObservations] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [subFormData, setSubFormData] = useState<any>(null);

    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        ursService.getRequestTypes()
            .then(res => {
                setTypes(res);
                setLoading(false);
            })
            .catch(() => {
                showToast({ type: 'error', message: 'Error al cargar los tipos de solicitud. Recarga la página.' });
                setLoading(false);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedType = types.find(t => t.id_tipo.toString() === selectedTypeId);

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const validateSubForm = (): string | null => {
        if (!subFormData) return null;
        const d = subFormData;
        switch (d._form_type) {
            case 'ACTIVACION_EQUIPO':
                if (d.subtipo_alta === 'EXISTENTE' && !d.id_equipo) return 'Selecciona un equipo del inventario.';
                if (d.subtipo_alta === 'NUEVO' && !d.nombre_equipo?.trim()) return 'Ingresa el nombre/modelo del equipo.';
                if (d.subtipo_alta === 'NUEVO' && !d.tipo_equipo) return 'Selecciona el tipo de equipo.';
                if (!d.id_ubicacion) return 'Selecciona la ubicación destino.';
                if (!d.id_responsable) return 'Selecciona el responsable asignado.';
                break;
            case 'BAJA_EQUIPO':
                if (!d.id_equipo) return 'Selecciona el equipo a desvincular.';
                if (!d.motivo) return 'Selecciona el motivo del cese.';
                break;
            case 'TRASPASO_EQUIPO':
                if (!d.id_equipo) return 'Selecciona el equipo a traspasar.';
                if (!d.traspaso_de?.length) return 'Indica qué deseas traspasar (ubicación y/o responsable).';
                if (d.traspaso_de.includes('UBICACION') && !d.id_centro_destino) return 'Selecciona la nueva ubicación destino.';
                if (d.traspaso_de.includes('RESPONSABLE') && !d.id_muestreador_destino) return 'Selecciona el nuevo responsable destino.';
                break;
            case 'NUEVO_EQUIPO':
                if (!d.nombre_equipo?.trim()) return 'Ingresa el nombre descriptivo del equipo.';
                if (!d.tipo_equipo) return 'Selecciona la categoría del equipo.';
                break;
            case 'REPORTE_PROBLEMA':
                if (!d.asunto?.trim()) return 'Ingresa el asunto del reporte.';
                if (!d.categoria_problema) return 'Selecciona la categoría del problema.';
                if (!d.descripcion_problema?.trim()) return 'Ingresa la descripción detallada.';
                break;
            case 'EXTENSION_VIGENCIA':
                if (!d.id_equipo) return 'Selecciona el equipo.';
                if (!d.nueva_vigencia) return 'Indica la nueva fecha de vigencia.';
                if (!d.justificacion?.trim()) return 'Ingresa la justificación de la extensión.';
                break;
        }
        return null;
    };

    const handleSubmit = async () => {
        if (!selectedTypeId) return;
        if (!observations.trim()) {
            showToast({ type: 'warning', message: 'Las observaciones son obligatorias.' });
            return;
        }

        const subFormError = validateSubForm();
        if (subFormError) {
            showToast({ type: 'warning', message: subFormError });
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                id_tipo: Number(selectedTypeId),
                prioridad: priority,
                observaciones: observations,
                datos_json: { ...subFormData },
                archivos: files
            };

            const result = await ursService.createRequest(payload);

            setCreatedRequestId(result.id_solicitud);
            setUrsInboxMode('SENT');
            setPendingRequestId(result.id_solicitud);
            setIsSubmitting(false);
            setShowSuccess(true);

            setTimeout(() => {
                goToInbox();
            }, 1500);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al crear la solicitud' });
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="shadcn-scope flex h-[80vh] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-[13px] font-semibold text-muted-foreground">Cargando opciones ADL...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="shadcn-scope relative w-full p-8">
            {isSubmitting && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-sm">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            {/* Success Overlay */}
            {showSuccess && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background/60 backdrop-blur-md animate-[fadeIn_0.4s_ease-out]">
                    <Card className="w-[420px] max-w-[90vw] border-success/40 bg-gradient-to-br from-card to-success/5 animate-[scaleIn_0.5s_cubic-bezier(0.34,1.56,0.64,1)] p-6">
                        <div className="flex flex-col items-center gap-6 py-6">
                            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-success to-success/70 shadow-lg shadow-success/30 animate-[bounceIn_0.6s_cubic-bezier(0.34,1.56,0.64,1)_0.2s_both]">
                                <IconCheck size={44} className="text-white" strokeWidth={3} />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <h1 className="m-0 text-2xl font-bold tracking-tight">¡Solicitud Enviada!</h1>
                                {createdRequestId && (
                                    <Badge variant="outline" className="mt-1 font-bold">
                                        Solicitud #{createdRequestId}
                                    </Badge>
                                )}
                            </div>
                            <p className="max-w-[300px] text-center text-[13px] text-muted-foreground">
                                Tu solicitud ha sido registrada correctamente. Redirigiendo a tu solicitud...
                            </p>
                            <div className="w-3/5 overflow-hidden rounded-full bg-border">
                                <div className="h-1 rounded-full bg-gradient-to-r from-success to-success/70 animate-[progressBar_2.5s_ease-in-out_forwards]" />
                            </div>
                        </div>
                    </Card>
                    <style>{`
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
                        @keyframes bounceIn { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
                        @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
                    `}</style>
                </div>
            )}

            <Card className="bg-muted/30 p-6">
                <div className="flex flex-col gap-6">
                    {/* Header */}
                    <div className="flex flex-nowrap items-start justify-between">
                        <div>
                            <h1 className="m-0 text-[1.8rem] font-bold tracking-tight">
                                Nueva Solicitud
                            </h1>
                            <p className="text-[13px] text-muted-foreground">
                                Complete la información requerida para su trámite de forma unificada.
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" className="rounded-full" title="Cerrar y volver a bandeja" onClick={onBack || goToInbox}>
                            <IconX size={24} />
                        </Button>
                    </div>

                    {/* Section 1: Selector & Priority */}
                    <Card className="p-4">
                        <div className="flex flex-col gap-4">
                            <Field label="Tipo de Solicitud">
                                <Combobox
                                    placeholder="Seleccione el trámite a realizar"
                                    searchPlaceholder="Buscar trámite..."
                                    emptyText="No se encontraron trámites"
                                    options={types.map(t => ({ value: t.id_tipo.toString(), label: t.nombre }))}
                                    value={selectedTypeId ?? undefined}
                                    onValueChange={(v) => setSelectedTypeId(v ?? null)}
                                />
                            </Field>

                            {selectedTypeId && (
                                <div className="mt-1">
                                    <span className="mb-1.5 block text-[13px] font-semibold">Prioridad del Trámite</span>
                                    <div className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
                                        {PRIORITY_OPTIONS.map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setPriority(opt.value)}
                                                className={cn(
                                                    'flex-1 rounded-md px-3 py-1 text-sm font-medium transition-colors',
                                                    priority === opt.value ? 'bg-background text-foreground shadow-sm' : 'hover:text-foreground'
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Section 2: Dynamic Form Area */}
                    {!!selectedTypeId && (
                        <Card className="p-4">
                            <div className="mb-4 flex items-center gap-2">
                                <IconSettings size={20} className="text-primary" />
                                <h4 className="m-0 text-base font-semibold">Información de {selectedType?.nombre}</h4>
                            </div>

                            <div className="py-2">
                                {/* ID 1: Activación de Equipo */}
                                {selectedType?.id_tipo === 1 || selectedType?.nombre === 'Activación de Equipo' ? (
                                    <MemoizedEquipoActivationForm
                                        onDataChange={setSubFormData}
                                    />
                                ) : selectedType?.id_tipo === 2 || selectedType?.id_tipo === 6 || selectedType?.id_tipo === 10 || selectedType?.nombre?.includes('Baja de Equipo') ? (
                                    <MemoizedEquipoBajaForm
                                        onDataChange={setSubFormData}
                                    />
                                ) : selectedType?.id_tipo === 3 || selectedType?.nombre?.includes('Traspaso de Equipo') ? (
                                    <MemoizedEquipoTraspasoForm
                                        onDataChange={setSubFormData}
                                    />
                                ) : selectedType?.id_tipo === 4 || selectedType?.nombre?.includes('Nuevo Equipo') ? (
                                    <MemoizedNuevoEquipoForm
                                        onDataChange={setSubFormData}
                                    />
                                ) : selectedType?.id_tipo === 5 || selectedType?.id_tipo === 9 || selectedType?.nombre?.includes('Problema') ? (
                                    <MemoizedReporteProblemaForm
                                        onDataChange={setSubFormData}
                                    />
                                ) : selectedType?.id_tipo === 7 || selectedType?.nombre?.includes('Vigencia') ? (
                                    <MemoizedVigenciaExtensionForm
                                        onDataChange={setSubFormData}
                                    />
                                ) : (selectedType?.id_tipo === 8 || selectedType?.nombre === 'Deshabilitar muestreador') ? (
                                    <MemoizedMuestreadorDeactivationForm
                                        isEmbedded
                                        onDataChange={setSubFormData}
                                    />
                                ) : (
                                    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                                        <span className="text-[13px] text-muted-foreground">
                                            Este trámite no requiere campos adicionales. <br />
                                            Por favor complete los detalles en la sección de observaciones.
                                        </span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Section 3: Observations & Files */}
                    {!!selectedTypeId && (
                        <div className="flex flex-col gap-4">
                            <Field label="Observaciones *" hint="Explique brevemente los detalles de su solicitud">
                                <Textarea
                                    placeholder="Detalle su solicitud aquí..."
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    rows={3}
                                />
                            </Field>

                            <div>
                                <span className="mb-1.5 block text-[13px] font-semibold">Archivos Adjuntos</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/png,image/jpeg,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                        hidden
                                        onChange={(e) => {
                                            if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                                        <IconUpload size={18} /> Adjuntar Archivos
                                    </Button>
                                    <span className="text-xs text-muted-foreground">(PDF, Excel, Imágenes)</span>
                                </div>

                                {files.length > 0 && (
                                    <div className="mt-4 rounded-lg border border-border bg-card p-2">
                                        <div className="flex flex-col gap-2">
                                            {files.map((file, idx) => (
                                                <div key={idx} className={cn('flex items-center justify-between p-2', idx < files.length - 1 && 'border-b border-border')}>
                                                    <div className="flex items-center gap-2">
                                                        <FileIcon filename={file.name} mimetype={file.type} />
                                                        <span className="max-w-[300px] truncate text-[13px] font-semibold">{file.name}</span>
                                                        <Badge variant="outline">{(file.size / 1024).toFixed(0)} KB</Badge>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeFile(idx)}>
                                                        <IconX size={14} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div className="border-t border-border pt-4">
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={goToInbox} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || !selectedTypeId || !observations.trim()}
                            >
                                {isSubmitting ? (
                                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                ) : (
                                    <IconCheck size={18} />
                                )}
                                Enviar Solicitud ADL
                            </Button>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-[13px] font-semibold">{label}</span>
            {children}
            {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
        </div>
    );
}

export default NewRequestPage;
