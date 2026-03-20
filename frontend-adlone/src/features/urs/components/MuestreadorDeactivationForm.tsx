import React, { useState, useEffect } from 'react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import apiClient from '../../../config/axios.config';
import {
    Stack,
    Group,
    Select,
    Paper,
    Text,
    Button,
    Badge,
    Title,
    ThemeIcon,
    SimpleGrid,
    UnstyledButton,
    Loader,
    Alert,
    Center,
    Divider
} from '@mantine/core';
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

    useEffect(() => {
        apiClient.get('/api/catalogos/muestreadores')
            .then(res => setMuestreadores(res.data.data))
            .catch(console.error);
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
                .catch(console.error)
                .finally(() => setLoadingEquipos(false));
        } else {
            setEquipmentList([]);
            setEquipmentCount(null);
        }
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
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (submitted && !isEmbedded) {
        return (
            <Paper p="xl" radius="lg" withBorder shadow="sm" style={{ textAlign: 'center' }}>
                <ThemeIcon size={64} radius={64} color="teal" variant="light" mb="md">
                    <IconCheck size={40} />
                </ThemeIcon>
                <Title order={2} mb="xs">¡Solicitud Enviada!</Title>
                <Text c="dimmed" mb="lg">La solicitud de deshabilitación ha sido creada correctamente.</Text>
                <Button color="adl-blue" radius="md" onClick={() => setActiveSubmodule('urs-list')}>
                    Volver a la lista
                </Button>
            </Paper>
        );
    }

    return (
        <Stack gap="lg">
            {!isEmbedded && (
                <Alert icon={<IconUserMinus size={18} />} title="Baja de Muestreador" color="adl-blue" radius="md">
                    Procedimiento para deshabilitar a un compañero y reasignar sus equipos.
                </Alert>
            )}

            <Select 
                label="Persona a deshabilitar"
                placeholder="Seleccione un muestreador..."
                data={muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                value={selectedId}
                onChange={setSelectedId}
                required
                searchable
                radius="md"
            />

            {selectedId && (
                <Stack gap="xs">
                    <Text size="sm" fw={700}>Reasignación de Equipos ({equipmentCount ?? '...'})</Text>
                    <SimpleGrid cols={3} spacing="sm">
                        {[
                            { id: 'BASE', label: 'Traspaso a Base', icon: <IconBuildingCommunity size={20} />, color: 'blue' },
                            { id: 'MUESTREADOR', label: 'A Compañero', icon: <IconUsers size={20} />, color: 'teal' },
                            { id: 'MANUAL', label: 'Manual', icon: <IconEdit size={20} />, color: 'indigo' }
                        ].map((opt) => (
                            <UnstyledButton
                                key={opt.id}
                                onClick={() => setTransferType(opt.id as any)}
                                p="md"
                                style={{
                                    borderRadius: 'var(--mantine-radius-md)',
                                    border: `1px solid ${transferType === opt.id ? `var(--mantine-color-${opt.color}-4)` : 'var(--mantine-color-gray-2)'}`,
                                    backgroundColor: transferType === opt.id ? `var(--mantine-color-${opt.color}-0)` : 'white',
                                    transition: 'all 150ms ease',
                                    textAlign: 'center'
                                }}
                            >
                                <Center style={{ flexDirection: 'column' }}>
                                    <ThemeIcon variant="light" color={opt.color} size="lg" mb={8} radius="md">
                                        {opt.icon}
                                    </ThemeIcon>
                                    <Text size="xs" fw={700} c={transferType === opt.id ? `${opt.color}.8` : 'gray.7'}>
                                        {opt.label}
                                    </Text>
                                </Center>
                            </UnstyledButton>
                        ))}
                    </SimpleGrid>
                </Stack>
            )}

            {transferType === 'BASE' && (
                <Select 
                    label="Base de destino"
                    placeholder="Seleccione base..."
                    data={bases}
                    value={targetBase}
                    onChange={setTargetBase}
                    required
                    radius="md"
                />
            )}

            {transferType === 'MUESTREADOR' && (
                <Select 
                    label="Muestreador de destino"
                    placeholder="Seleccione destino..."
                    data={muestreadores.filter(m => String(m.id_muestreador) !== selectedId).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                    value={targetMuestreadorId}
                    onChange={setTargetMuestreadorId}
                    required
                    searchable
                    radius="md"
                />
            )}

            {transferType === 'MANUAL' && (
                <Paper p="md" withBorder radius="md" bg="gray.0">
                    <Group justify="space-between" mb="xs">
                        <Text size="xs" fw={800} c="dimmed">Equipos de {muestreadores.find(m => String(m.id_muestreador) === selectedId)?.nombre_muestreador}</Text>
                        <Badge size="xs" color="indigo">{equipmentList.length} ítems</Badge>
                    </Group>
                    
                    <Divider mb="md" />

                    <Stack gap="sm">
                        {loadingEquipos ? <Center py="xl"><Loader size="xs" /></Center> : (
                            equipmentList.map(eq => (
                                <Paper key={eq.id_equipo} p="xs" bg="white" radius="md" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                                    <Group justify="space-between" wrap="nowrap">
                                        <Group gap="xs">
                                            <Badge variant="light" color="gray" size="xs"><IconHash size={10} /> {eq.codigo}</Badge>
                                            <Text size="sm" fw={600} truncate>{eq.nombre}</Text>
                                        </Group>
                                        <Select 
                                            size="xs"
                                            placeholder="Destino"
                                            data={muestreadores.filter(m => String(m.id_muestreador) !== selectedId).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
                                            value={manualAssignments[eq.id_equipo] ? String(manualAssignments[eq.id_equipo]) : null}
                                            onChange={(val) => setManualAssignments({ ...manualAssignments, [eq.id_equipo]: Number(val) })}
                                            radius="sm"
                                            style={{ width: 140 }}
                                        />
                                    </Group>
                                </Paper>
                            ))
                        )}
                    </Stack>
                </Paper>
            )}

            {!isEmbedded && (
                <Group justify="flex-end" mt="xl">
                    <Button variant="light" color="gray" onClick={onCancel} radius="md">
                        Cancelar
                    </Button>
                    <Button 
                        color="adl-blue" 
                        radius="md" 
                        loading={loading} 
                        disabled={!transferType}
                        onClick={() => handleSubmit()}
                    >
                        Confirmar Baja
                    </Button>
                </Group>
            )}
        </Stack>
    );
};

export default MuestreadorDeactivationForm;
