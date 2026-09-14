import React, { useState, useEffect } from 'react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';
import {
    Select,
    Typography,
    Card,
    Button,
    Tag,
    Spin,
    Alert
} from 'antd';
import {
    IconUserMinus,
    IconBuildingCommunity,
    IconUsers,
    IconEdit,
    IconCheck,
    IconHash
} from '@tabler/icons-react';

const { Title, Text } = Typography;

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
            <Card style={{ textAlign: 'center' }}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', backgroundColor: 'rgba(9,143,131,0.12)', color: '#0c8599',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                    <IconCheck size={40} />
                </div>
                <Title level={2} style={{ marginBottom: 8 }}>¡Solicitud Enviada!</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>La solicitud de deshabilitación ha sido creada correctamente.</Text>
                <Button type="primary" onClick={() => setActiveSubmodule('')}>
                    Volver a la lista
                </Button>
            </Card>
        );
    }

    const opciones: { id: 'BASE' | 'MUESTREADOR' | 'MANUAL'; label: string; icon: React.ReactNode; color: string; bg: string }[] = [
        { id: 'BASE', label: 'Traspaso a Base', icon: <IconBuildingCommunity size={20} />, color: '#1c7ed6', bg: 'var(--app-accent-bg)' },
        { id: 'MUESTREADOR', label: 'A Compañero', icon: <IconUsers size={20} />, color: '#0c8599', bg: 'rgba(12,133,153,0.1)' },
        { id: 'MANUAL', label: 'Manual', icon: <IconEdit size={20} />, color: '#4c6ef5', bg: 'rgba(76,110,245,0.1)' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {!isEmbedded && (
                <Alert type="info" showIcon icon={<IconUserMinus size={18} />} message="Baja de Muestreador" description="Procedimiento para deshabilitar a un compañero y reasignar sus equipos." />
            )}

            <Field label="Persona a deshabilitar *">
                <Select
                    placeholder="Seleccione un muestreador..."
                    options={muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                    value={selectedId ?? undefined}
                    onChange={(v) => setSelectedId(v ?? null)}
                    showSearch
                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                    style={{ width: '100%' }}
                />
            </Field>

            {selectedId && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>Reasignación de Equipos ({equipmentCount ?? '...'})</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
            )}

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
                        options={muestreadores.filter(m => String(m.id_muestreador) !== selectedId).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
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
                        <Text type="secondary" strong style={{ fontSize: 11 }}>Equipos de {muestreadores.find(m => String(m.id_muestreador) === selectedId)?.nombre_muestreador}</Text>
                        <Tag color="geekblue">{equipmentList.length} ítems</Tag>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '0 0 16px' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {loadingEquipos ? <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin size="small" /></div> : (
                            equipmentList.map(eq => (
                                <div key={eq.id_equipo} style={{ padding: 8, backgroundColor: 'var(--app-bg-elevated)', borderRadius: 8, border: '1px solid var(--app-border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', overflow: 'hidden' }}>
                                            <Tag icon={<IconHash size={10} style={{ verticalAlign: 'text-bottom' }} />}>{eq.codigo}</Tag>
                                            <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eq.nombre}</Text>
                                        </div>
                                        <Select
                                            size="small"
                                            placeholder="Destino"
                                            options={muestreadores.filter(m => String(m.id_muestreador) !== selectedId).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                                            value={manualAssignments[eq.id_equipo] ? String(manualAssignments[eq.id_equipo]) : undefined}
                                            onChange={(val) => setManualAssignments({ ...manualAssignments, [eq.id_equipo]: Number(val) })}
                                            style={{ width: 140 }}
                                        />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </Card>
            )}

            {!isEmbedded && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                    <Button onClick={onCancel}>
                        Cancelar
                    </Button>
                    <Button
                        type="primary"
                        loading={loading}
                        disabled={!transferType}
                        onClick={() => handleSubmit()}
                    >
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
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}

export default MuestreadorDeactivationForm;
