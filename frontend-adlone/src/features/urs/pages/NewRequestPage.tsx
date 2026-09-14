import React, { useState, useEffect, useRef } from 'react';
import {
    Typography,
    Select,
    Segmented,
    Input,
    Button,
    Tooltip,
    Spin,
    Card,
    Tag
} from 'antd';
import {
    IconSearch,
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

const { Title, Text } = Typography;
const { TextArea } = Input;

// Memoize sub-forms to prevent heavy parent re-renders when local state changes
const MemoizedEquipoTraspasoForm = React.memo(EquipoTraspasoForm);
const MemoizedMuestreadorDeactivationForm = React.memo(MuestreadorDeactivationForm);
const MemoizedEquipoActivationForm = React.memo(EquipoActivationForm);
const MemoizedEquipoBajaForm = React.memo(EquipoBajaForm);
const MemoizedNuevoEquipoForm = React.memo(NuevoEquipoForm);
const MemoizedReporteProblemaForm = React.memo(ReporteProblemaForm);
const MemoizedVigenciaExtensionForm = React.memo(VigenciaExtensionForm);

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
            <div style={{ height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <Spin size="large" />
                    <Text type="secondary" strong style={{ fontSize: 13 }}>Cargando opciones ADL...</Text>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 32, position: 'relative', width: '100%' }}>
            {isSubmitting && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin size="large" />
                </div>
            )}

            {/* Success Overlay */}
            {showSuccess && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(8px)',
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        animation: 'fadeIn 0.4s ease-out'
                    }}
                >
                    <Card
                        style={{
                            width: 420,
                            maxWidth: '90vw',
                            borderColor: '#8ce99a',
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,255,240,0.95) 100%)',
                            animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '24px 0' }}>
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #40c057 0%, #12b886 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
                                animation: 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both'
                            }}>
                                <IconCheck size={44} color="white" strokeWidth={3} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <Title level={2} style={{ margin: 0, letterSpacing: '-0.5px' }}>¡Solicitud Enviada!</Title>
                                {createdRequestId && (
                                    <Tag color="blue" style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>
                                        Solicitud #{createdRequestId}
                                    </Tag>
                                )}
                            </div>
                            <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', maxWidth: 300 }}>
                                Tu solicitud ha sido registrada correctamente. Redirigiendo a tu solicitud...
                            </Text>
                            <div style={{ width: '60%', overflow: 'hidden', borderRadius: 999, backgroundColor: 'var(--app-border)' }}>
                                <div style={{
                                    height: 4,
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, #40c057, #12b886)',
                                    animation: 'progressBar 2.5s ease-in-out forwards'
                                }} />
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

            <Card style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                        <div>
                            <Title level={1} style={{ margin: 0, fontSize: '1.8rem', letterSpacing: '-0.5px' }}>
                                Nueva Solicitud
                            </Title>
                            <Text type="secondary" style={{ fontSize: 13 }}>
                                Complete la información requerida para su trámite de forma unificada.
                            </Text>
                        </div>
                        <Tooltip title="Cerrar y volver a bandeja">
                            <Button type="text" shape="circle" size="large" icon={<IconX size={24} />} onClick={onBack || goToInbox} />
                        </Tooltip>
                    </div>

                    {/* Section 1: Selector & Priority */}
                    <Card size="small">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Field label="Tipo de Solicitud">
                                <Select
                                    placeholder="Seleccione el trámite a realizar"
                                    options={types.map(t => ({ value: t.id_tipo.toString(), label: t.nombre }))}
                                    value={selectedTypeId ?? undefined}
                                    onChange={(v) => setSelectedTypeId(v ?? null)}
                                    showSearch
                                    allowClear
                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                    notFoundContent="No se encontraron trámites"
                                    size="large"
                                    suffixIcon={<IconSearch size={16} />}
                                    style={{ width: '100%' }}
                                />
                            </Field>

                            {selectedTypeId && (
                                <div style={{ marginTop: 4 }}>
                                    <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 5 }}>Prioridad del Trámite</Text>
                                    <Segmented
                                        block
                                        value={priority}
                                        onChange={(v) => setPriority(v as string)}
                                        options={[
                                            { label: 'Baja', value: 'BAJA' },
                                            { label: 'Media', value: 'MEDIA' },
                                            { label: 'Alta', value: 'ALTA' },
                                        ]}
                                    />
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Section 2: Dynamic Form Area */}
                    {!!selectedTypeId && (
                        <Card size="small">
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                                <IconSettings size={20} color="#1c7ed6" />
                                <Title level={4} style={{ margin: 0 }}>Información de {selectedType?.nombre}</Title>
                            </div>

                            <div style={{ padding: '8px 0' }}>
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
                                    <div style={{
                                        padding: 24,
                                        border: '1px dashed var(--app-border)',
                                        borderRadius: 8,
                                        backgroundColor: 'var(--app-hover-bg)',
                                        textAlign: 'center'
                                    }}>
                                        <Text type="secondary" style={{ fontSize: 13 }}>
                                            Este trámite no requiere campos adicionales. <br />
                                            Por favor complete los detalles en la sección de observaciones.
                                        </Text>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )}

                    {/* Section 3: Observations & Files */}
                    {!!selectedTypeId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Field label="Observaciones *" hint="Explique brevemente los detalles de su solicitud">
                                <TextArea
                                    placeholder="Detalle su solicitud aquí..."
                                    value={observations}
                                    onChange={(e) => setObservations(e.target.value)}
                                    autoSize={{ minRows: 3 }}
                                />
                            </Field>

                            <div>
                                <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 5 }}>Archivos Adjuntos</Text>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        accept="image/png,image/jpeg,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                                        style={{ display: 'none' }}
                                        onChange={(e) => {
                                            if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                            e.target.value = '';
                                        }}
                                    />
                                    <Button icon={<IconUpload size={18} />} onClick={() => fileInputRef.current?.click()}>
                                        Adjuntar Archivos
                                    </Button>
                                    <Text type="secondary" style={{ fontSize: 12 }}>(PDF, Excel, Imágenes)</Text>
                                </div>

                                {files.length > 0 && (
                                    <div style={{ marginTop: 16, padding: 8, backgroundColor: 'var(--app-bg-elevated)', borderRadius: 8, border: '1px solid var(--app-border)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {files.map((file, idx) => (
                                                <div key={idx} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8,
                                                    borderBottom: idx < files.length - 1 ? '1px solid var(--app-border)' : 'none'
                                                }}>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <FileIcon filename={file.name} mimetype={file.type} />
                                                        <Text strong style={{ fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</Text>
                                                        <Tag>{(file.size / 1024).toFixed(0)} KB</Tag>
                                                    </div>
                                                    <Button type="text" danger size="small" icon={<IconX size={14} />} onClick={() => removeFile(idx)} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer Actions */}
                    <div style={{ paddingTop: 16, borderTop: '1px solid var(--app-border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button onClick={goToInbox} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                loading={isSubmitting}
                                disabled={!selectedTypeId || !observations.trim()}
                                icon={!isSubmitting && <IconCheck size={18} />}
                            >
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
            <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
            {hint && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{hint}</Text>}
        </div>
    );
}

export default NewRequestPage;
