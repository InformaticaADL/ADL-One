import React, { useState, useEffect } from 'react';
import {
    Modal,
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
    IconHash,
    IconAlertTriangle
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

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
    const { showToast } = useToast();

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
            apiClient.get(`/api/admin/equipos?id_muestreador=${sampler.id_muestreador}&limit=100`)
                .then(res => {
                    const list = res.data.data || [];
                    setEquipmentList(list);
                    setEquipmentCount(list.length);
                })
                .catch(console.error)
                .finally(() => setLoadingEquipos(false));
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

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={<Group gap="xs"><IconUserMinus size={20} color="var(--mantine-color-red-6)"/><Title order={4}>Deshabilitar Muestreador</Title></Group>}
            size="lg"
            radius="md"
        >
            <Stack gap="lg">
                <Alert icon={<IconAlertTriangle size={18} />} color="orange" radius="md">
                    Está a punto de deshabilitar a <b>{sampler?.nombre_muestreador}</b>. 
                    Todos sus equipos deben ser reasignados para completar esta acción.
                </Alert>

                <Stack gap="xs">
                    <Text size="sm" fw={700}>¿Qué desea hacer con los equipos? ({equipmentCount ?? '...'})</Text>
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
                        data={muestreadores.filter(m => m.id_muestreador !== sampler?.id_muestreador).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
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
                            <Text size="xs" fw={800} c="dimmed">Equipos de {sampler?.nombre_muestreador}</Text>
                            <Badge size="xs" color="indigo">{equipmentList.length} ítems</Badge>
                        </Group>
                        
                        <Divider mb="md" />

                        <Stack gap="sm" style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {loadingEquipos ? <Center py="xl"><Loader size="xs" /></Center> : (
                                equipmentList.length === 0 ? <Text size="sm" c="dimmed" ta="center" py="md">No hay equipos asignados.</Text> :
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
                                                data={muestreadores.filter(m => m.id_muestreador !== sampler?.id_muestreador).map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador }))}
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

                <Group justify="flex-end" mt="xl">
                    <Button variant="light" color="gray" onClick={onClose} radius="md">
                        Cancelar
                    </Button>
                    <Button 
                        color="red" 
                        radius="md" 
                        loading={loading} 
                        disabled={!transferType || (transferType === 'BASE' && !targetBase) || (transferType === 'MUESTREADOR' && !targetMuestreadorId)}
                        onClick={handleConfirm}
                    >
                        Confirmar Baja
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default SamplerDeactivationModal;
