import React, { useState, useEffect } from 'react';
import {
    Modal,
    Select,
    Typography,
    Card,
    Button,
    Tag,
    Spin,
    Alert
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconUserMinus,
    IconBuildingCommunity,
    IconUsers,
    IconEdit,
    IconHash,
    IconAlertTriangle
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

const { Title, Text } = Typography;

interface SamplerDeactivationModalProps {
    opened: boolean;
    onClose: () => void;
    sampler: { id_muestreador: number; nombre_muestreador: string } | null;
    onSuccess: () => void;
}

const SamplerDeactivationModal: React.FC<SamplerDeactivationModalProps> = ({
    opened,
    onClose,
    sampler,
    onSuccess
}) => {
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [transferType, setTransferType] = useState<'BASE' | 'MUESTREADOR' | 'MANUAL' | ''>('');
    const [targetBase, setTargetBase] = useState<string | null>(null);
    const [targetMuestreadorId, setTargetMuestreadorId] = useState<string | null>(null);
    const [equipmentList, setEquipmentList] = useState<any[]>([]);
    const [manualAssignments, setManualAssignments] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [loadingEquipos, setLoadingEquipos] = useState(false);
    const [equipmentCount, setEquipmentCount] = useState<number | null>(null);
    // MS-04: asignaciones futuras de muestreo
    const [futureAssignments, setFutureAssignments] = useState<{ count: number; assignments: any[] } | null>(null);
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    useEffect(() => {
        if (opened) {
            apiClient.get('/api/catalogos/muestreadores')
                .then(res => setMuestreadores(res.data.data))
                .catch(console.error);
        } else {
            // Reset state on close
            setTransferType('');
            setTargetBase(null);
            setTargetMuestreadorId(null);
            setManualAssignments({});
        }
    }, [opened]);

    useEffect(() => {
        if (opened && sampler) {
            setLoadingEquipos(true);
            setEquipmentCount(null);
            setFutureAssignments(null);
            apiClient.get(`/api/admin/equipos?id_muestreador=${sampler.id_muestreador}&limit=100`)
                .then(res => {
                    const list = res.data.data || [];
                    setEquipmentList(list);
                    setEquipmentCount(list.length);
                })
                .catch(console.error)
                .finally(() => setLoadingEquipos(false));

            // MS-04: chequear asignaciones futuras de muestreo
            apiClient.get(`/api/admin/muestreadores/${sampler.id_muestreador}/future-assignments`)
                .then(res => setFutureAssignments(res.data?.data || { count: 0, assignments: [] }))
                .catch(() => setFutureAssignments({ count: 0, assignments: [] }));
        }
    }, [opened, sampler]);

    const bases = [
        { value: 'Base Aysén', label: '🏢 Base Aysén' },
        { value: 'Base Puerto Montt', label: '🏢 Base Puerto Montt' },
        { value: 'Base Villarrica', label: '🏢 Base Villarrica' },
        { value: 'Sede Villarrica', label: '🏢 Sede Villarrica' }
    ];

    const handleConfirm = async () => {
        if (!sampler || !transferType) return;

        // Validation for MANUAL
        if (transferType === 'MANUAL' && equipmentList.length > 0) {
            const allAssigned = equipmentList.every(eq => manualAssignments[eq.id_equipo]);
            if (!allAssigned) {
                showToast({
                    type: 'warning',
                    message: 'Debe asignar todos los equipos antes de continuar con el traspaso manual.'
                });
                return;
            }
        }

        setLoading(true);
        try {
            const reassignmentOptions: any = {
                tipoTraspaso: transferType,
            };

            if (transferType === 'BASE') {
                if (!targetBase) throw new Error("Debe seleccionar una base de destino");
                reassignmentOptions.baseDestino = targetBase;
            } else if (transferType === 'MUESTREADOR') {
                if (!targetMuestreadorId) throw new Error("Debe seleccionar un muestreador de destino");
                reassignmentOptions.idDestino = Number(targetMuestreadorId);
            } else if (transferType === 'MANUAL') {
                reassignmentOptions.reasignacionManual = equipmentList.map(eq => ({
                    id_equipo: eq.id_equipo,
                    sede_nueva: 'PM', // Default for now
                    id_muestreador_nuevo: manualAssignments[eq.id_equipo]
                }));
            }

            await adminService.disableWithReassignment(sampler.id_muestreador, reassignmentOptions);

            showToast({
                type: 'success',
                message: `Muestreador ${sampler.nombre_muestreador} deshabilitado y equipos reasignados.`
            });

            onSuccess();
            onClose();
        } catch (error: any) {
            showToast({
                type: 'error',
                message: error.message || 'Error al deshabilitar muestreador'
            });
        } finally {
            setLoading(false);
        }
    };

    const opciones: { id: 'BASE' | 'MUESTREADOR' | 'MANUAL'; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
        { id: 'BASE', label: 'Traspaso a Base', icon: <IconBuildingCommunity size={20} />, color: '#1c7ed6', bg: 'var(--app-accent-bg)' },
        { id: 'MUESTREADOR', label: 'A Compañero', icon: <IconUsers size={20} />, color: '#0c8599', bg: 'rgba(12,133,153,0.1)' },
        { id: 'MANUAL', label: 'Manual', icon: <IconEdit size={20} />, color: '#4c6ef5', bg: 'rgba(76,110,245,0.1)' },
    ];

    return (
        <Modal
            open={opened}
            onCancel={onClose}
            footer={null}
            width={isMobile ? '100%' : 640}
            style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : undefined}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconUserMinus size={20} color="#e03131" />
                    <Title level={4} style={{ margin: 0 }}>Deshabilitar Muestreador</Title>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                <Alert
                    type="warning"
                    showIcon
                    icon={<IconAlertTriangle size={18} />}
                    message={<>Está a punto de deshabilitar a <b>{sampler?.nombre_muestreador}</b>. Todos sus equipos deben ser reasignados para completar esta acción.</>}
                />

                {/* MS-04: advertencia si hay muestreos futuros */}
                {futureAssignments && futureAssignments.count > 0 && (
                    <Alert
                        type="error"
                        showIcon
                        icon={<IconAlertTriangle size={18} />}
                        message="Asignaciones de muestreo pendientes"
                        description={
                            <div>
                                <Text style={{ fontSize: 13 }}>
                                    Este muestreador tiene <b>{futureAssignments.count}</b> muestreo{futureAssignments.count !== 1 ? 's' : ''} programado{futureAssignments.count !== 1 ? 's' : ''} para fechas futuras.
                                    Tras deshabilitarlo, esos muestreos quedarán <b>huérfanos</b> y deberán ser reasignados manualmente desde Asignación o el Calendario.
                                </Text>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
                                    {futureAssignments.assignments.slice(0, 5).map((a: any) => (
                                        <Text key={a.id_agendamam} type="secondary" style={{ fontSize: 12 }}>
                                            • Ficha #{a.id_fichaingresoservicio} — {a.frecuencia_correlativo} ({a.rol === 'INSTALACION' ? 'instalación' : 'retiro'}) — {a.fecha_muestreo ? new Date(a.fecha_muestreo).toLocaleDateString('es-CL') : '-'}
                                        </Text>
                                    ))}
                                    {futureAssignments.assignments.length > 5 && (
                                        <Text type="secondary" italic style={{ fontSize: 12 }}>y {futureAssignments.assignments.length - 5} más...</Text>
                                    )}
                                </div>
                            </div>
                        }
                    />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>¿Qué desea hacer con los equipos? ({equipmentCount ?? '...'})</Text>

                    {/* Equipos list */}
                    {equipmentList.length > 0 && (
                        <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                                {loadingEquipos ? (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}><Spin size="small" /></div>
                                ) : equipmentList.map(eq => (
                                    <div key={eq.id_equipo} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                        <Tag style={{ flexShrink: 0 }}>{eq.codigo || `#${eq.id_equipo}`}</Tag>
                                        <Text strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.nombre}</Text>
                                        {eq.ubicacion && <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>{eq.ubicacion}</Text>}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 8 }}>
                        {opciones.map((opt) => {
                            const selected = transferType === opt.id;
                            return (
                                <div
                                    key={opt.id}
                                    onClick={() => setTransferType(opt.id)}
                                    style={{
                                        padding: 16,
                                        borderRadius: 8,
                                        border: `1px solid ${selected ? opt.color : 'var(--app-border)'}`,
                                        backgroundColor: selected ? opt.bg : 'var(--app-bg-elevated)',
                                        transition: 'all 150ms ease',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 8, backgroundColor: opt.bg, color: opt.color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8,
                                        }}>
                                            {opt.icon}
                                        </div>
                                        <Text strong style={{ fontSize: 12, color: selected ? opt.color : 'var(--app-text-secondary)' }}>
                                            {opt.label}
                                        </Text>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {transferType === 'BASE' && (
                    <Field label="Base de destino *">
                        <Select
                            placeholder="Seleccione base..."
                            options={bases}
                            value={targetBase ?? undefined}
                            onChange={(v) => setTargetBase(v ?? null)}
                            style={{ width: '100%' }}
                        />
                    </Field>
                )}

                {transferType === 'MUESTREADOR' && (
                    <Field label="Muestreador de destino *">
                        <Select
                            placeholder="Seleccione destino..."
                            options={muestreadores.filter(m => m.id_muestreador !== sampler?.id_muestreador).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                            value={targetMuestreadorId ?? undefined}
                            onChange={(v) => setTargetMuestreadorId(v ?? null)}
                            showSearch
                            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                            style={{ width: '100%' }}
                        />
                    </Field>
                )}

                {transferType === 'MANUAL' && (
                    <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <Text type="secondary" strong style={{ fontSize: 11 }}>Equipos de {sampler?.nombre_muestreador}</Text>
                            <Tag color="geekblue">{equipmentList.length} ítems</Tag>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '0 0 16px' }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 300, overflowY: 'auto' }}>
                            {loadingEquipos ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin size="small" /></div> : (
                                equipmentList.length === 0 ? <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No hay equipos asignados.</Text> :
                                equipmentList.map(eq => (
                                    <div key={eq.id_equipo} style={{ padding: 8, backgroundColor: 'var(--app-bg-elevated)', borderRadius: 8, border: '1px solid var(--app-border)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, overflow: 'hidden' }}>
                                                    <Tag icon={<IconHash size={10} style={{ verticalAlign: 'text-bottom' }} />}>{eq.codigo}</Tag>
                                                    <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.nombre}</Text>
                                                </div>
                                                {!isMobile && (
                                                    <Select
                                                        size="small"
                                                        placeholder="Destino"
                                                        options={muestreadores.filter(m => m.id_muestreador !== sampler?.id_muestreador).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                                                        value={manualAssignments[eq.id_equipo] ? String(manualAssignments[eq.id_equipo]) : undefined}
                                                        onChange={(val) => setManualAssignments({ ...manualAssignments, [eq.id_equipo]: Number(val) })}
                                                        style={{ width: 140 }}
                                                    />
                                                )}
                                            </div>
                                            {isMobile && (
                                                <Field label="Asignar a:">
                                                    <Select
                                                        placeholder="Seleccione destino"
                                                        options={muestreadores.filter(m => m.id_muestreador !== sampler?.id_muestreador).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                                                        value={manualAssignments[eq.id_equipo] ? String(manualAssignments[eq.id_equipo]) : undefined}
                                                        onChange={(val) => setManualAssignments({ ...manualAssignments, [eq.id_equipo]: Number(val) })}
                                                        style={{ width: '100%' }}
                                                    />
                                                </Field>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, flexDirection: isMobile ? 'column' : 'row' }}>
                    <Button onClick={onClose} block={isMobile}>
                        Cancelar
                    </Button>
                    <Button
                        danger
                        type="primary"
                        loading={loading}
                        block={isMobile}
                        disabled={!transferType || (transferType === 'BASE' && !targetBase) || (transferType === 'MUESTREADOR' && !targetMuestreadorId)}
                        onClick={handleConfirm}
                    >
                        Confirmar Baja
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}

export default SamplerDeactivationModal;
