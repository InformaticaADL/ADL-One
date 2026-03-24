import React, { useState, useEffect } from 'react';
import { 
    Modal, 
    Table, 
    Badge, 
    Button, 
    Group, 
    Text, 
    Stack, 
    LoadingOverlay, 
    ScrollArea, 
    Tooltip, 
    ActionIcon, 
    Alert,
    Box,
    Menu
} from '@mantine/core';
import {
    IconCalendar,
    IconUser,
    IconMapPin,
    IconCheck,
    IconInfoCircle,
    IconDots,
    IconEye,
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { useToast } from '../../../contexts/ToastContext';

interface EquipmentRequestsModalProps {
    idEquipo: number | string | null;
    nombreEquipo: string;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    onGoToSolicitud?: (solicitud: any) => void;
    codigoEquipo?: string;
}

export const EquipmentRequestsModal: React.FC<EquipmentRequestsModalProps> = ({ 
    idEquipo, 
    nombreEquipo,
    codigoEquipo,
    isOpen, 
    onClose, 
    onRefresh,
    onGoToSolicitud
}) => {
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<number | null>(null);
    const { showToast } = useToast();

    const fetchRequests = async () => {
        if (!idEquipo) return;
        setLoading(true);
        try {
            const res = await adminService.getSolicitudesByEquipo(idEquipo);
            setRequests(res.data || []);
        } catch (error) {
            console.error('Error fetching requests for equipment:', error);
            showToast({ type: 'error', message: 'Error al cargar las solicitudes' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && idEquipo) {
            fetchRequests();
        }
    }, [isOpen, idEquipo]);

    const handleMarkAsRealizada = async (sol: any) => {
        setProcessingId(sol.id_solicitud);
        try {
            await adminService.updateSolicitudStatus(
                sol.id_solicitud, 
                'REALIZADA', 
                'Solicitud marcada como realizada desde el panel de equipos.'
            );
            showToast({ type: 'success', message: `Solicitud #${sol.id_solicitud} marcada como realizada` });
            fetchRequests();
            onRefresh();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast({ type: 'error', message: 'Error al actualizar la solicitud' });
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDIENTE':
            case 'PENDIENTE_TECNICA':
            case 'PENDIENTE_CALIDAD': return 'yellow';
            case 'EN_REVISION':
            case 'EN_REVISION_TECNICA': return 'blue';
            case 'ACEPTADA': return 'teal';
            case 'RECHAZADA':
            case 'RECHAZADO_TECNICA': return 'red';
            case 'REALIZADA': return 'gray';
            default: return 'gray';
        }
    };

    const getStatusLabel = (status: string) => {
        return (status || '').replace(/_/g, ' ');
    };

    const renderSolicitudDetails = (sol: any) => {
        const d = sol.datos_json || {};
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const type = typeRaw.toUpperCase();
        
        const isTraspaso = type.includes('TRASPASO') || d._form_type === 'TRASPASO_EQUIPO' || d.isTransfer;
        const isAlta = type.includes('ALTA') || (type.includes('REACTIVACI') && d.isReactivation);
        const isBaja = type.includes('BAJA') || type.includes('RETIRO');
        const isProblem = type.includes('PROBLEMA') || type.includes('FALLA');
        
        return (
            <Stack gap={4}>
                <Text size="sm" fw={800} c="blue.9">{typeRaw}</Text>
                
                {/* Specific Details based on Type */}
                <Box mt={2}>
                    {/* TRASPASO DETAILS */}
                    {isTraspaso && (
                        <Stack gap={2}>
                            {(d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino) && (
                                <Group gap={4} wrap="nowrap">
                                    <IconMapPin size={12} color="var(--mantine-color-blue-6)" />
                                    <Text size="xs" fw={700}>Destino:</Text>
                                    <Badge size="xs" variant="filled" color="blue">
                                        {d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino}
                                    </Badge>
                                </Group>
                            )}
                            {(d.nombre_muestreador_destino || d.nuevo_responsable_nombre || d.nuevo_responsable || d.responsable_destino) && (
                                <Group gap={4} wrap="nowrap">
                                    <IconUser size={12} color="var(--mantine-color-indigo-6)" />
                                    <Text size="xs" fw={700}>Responsable:</Text>
                                    <Text size="xs" c="indigo.8" fw={700}>
                                        {d.nombre_muestreador_destino || d.nuevo_responsable_nombre || d.nuevo_responsable || d.responsable_destino}
                                    </Text>
                                </Group>
                            )}
                        </Stack>
                    )}

                    {/* ALTA / REACTIVACION DETAILS */}
                    {isAlta && (
                        <Group gap={4} wrap="nowrap">
                            <IconCalendar size={12} color="var(--mantine-color-teal-6)" />
                            <Text size="xs" fw={700}>Nueva Vigencia:</Text>
                            <Badge size="xs" variant="filled" color="teal">
                                {d.nueva_vigencia_solicitada || d.vigencia_propuesta || d.fecha_vigencia || d.vigencia}
                            </Badge>
                        </Group>
                    )}

                    {/* PROBLEM REPORT DETAILS */}
                    {isProblem && (
                        <Stack gap={2}>
                            {d.criticidad && (
                                <Badge size="xs" color={d.criticidad.toUpperCase() === 'ALTA' ? 'red' : 'orange'} variant="filled">
                                    CRITICIDAD: {d.criticidad}
                                </Badge>
                            )}
                            {d.descripcion_falla && (
                                <Text size="xs" c="red.9" fw={600}>Falla: {d.descripcion_falla}</Text>
                            )}
                        </Stack>
                    )}

                    {/* BAJA DETAILS */}
                    {isBaja && d.fecha_baja && (
                        <Group gap={4} wrap="nowrap">
                            <IconCalendar size={12} color="var(--mantine-color-red-6)" />
                            <Text size="xs" fw={700}>Fecha Retiro:</Text>
                            <Text size="xs" c="red.8" fw={600}>{d.fecha_baja}</Text>
                        </Group>
                    )}
                </Box>

                {/* General Motive/Comments (Always at the bottom) */}
                {(d.motivo || d.observaciones || d.descripcion || d.comentario) && (
                    <Text size="xs" c="dimmed" fs="italic" lineClamp={3}>
                        "{d.motivo || d.observaciones || d.descripcion || d.comentario}"
                    </Text>
                )}
            </Stack>
        );
    };

    const formatDate = (date: string) => {
        if (!date) return '-';
        return new Date(date).toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Modal 
            opened={isOpen} 
            onClose={onClose} 
            title={
                <Box>
                    <Text fw={700} size="lg">Solicitudes Pendientes</Text>
                    <Group gap={6}>
                        {codigoEquipo && (
                            <Badge variant="light" color="blue" size="sm">
                                {codigoEquipo}
                            </Badge>
                        )}
                        <Text size="sm" c="dimmed">{nombreEquipo}</Text>
                    </Group>
                </Box>
            }
            size="xl"
            scrollAreaComponent={ScrollArea.Autosize}
        >
            <Box pos="relative" miw={500} mih={200}>
                <LoadingOverlay visible={loading} />

                {requests.length === 0 && !loading ? (
                    <Alert icon={<IconInfoCircle size="1rem" />} color="blue" mt="md">
                        No hay solicitudes pendientes activas para este equipo.
                    </Alert>
                ) : (
                    <Stack gap="md" mt="md">
                        <Table striped highlightOnHover verticalSpacing="sm">
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>ID</Table.Th>
                                    <Table.Th>Tipo</Table.Th>
                                    <Table.Th>Solicitante</Table.Th>
                                    <Table.Th>Fecha</Table.Th>
                                    <Table.Th>Estado</Table.Th>
                                    <Table.Th ta="right">Acciones</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {requests.map((sol) => (
                                    <Table.Tr key={`${sol.origen_tabla}-${sol.id_solicitud}`}>
                                        <Table.Td>
                                            <Tooltip label={sol.origen_tabla === 'GENERAL' ? 'Solicitud GERR (Sistema General)' : 'Solicitud de Equipo'}>
                                                <Text size="sm" fw={700} c={sol.origen_tabla === 'GENERAL' ? 'indigo.7' : 'inherit'}>
                                                    #{sol.id_solicitud}
                                                </Text>
                                            </Tooltip>
                                        </Table.Td>
                                        <Table.Td>
                                            {renderSolicitudDetails(sol)}
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={6} wrap="nowrap">
                                                <IconUser size={14} color="gray" />
                                                <Text size="xs">{sol.nombre_solicitante || 'N/A'}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap={6} wrap="nowrap">
                                                <IconCalendar size={14} color="gray" />
                                                <Text size="xs">{formatDate(sol.fecha_creacion)}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color={getStatusColor(sol.estado)} variant="filled" size="sm">
                                                {getStatusLabel(sol.estado)}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group justify="flex-end">
                                                <Menu position="bottom-end" shadow="md" withArrow>
                                                    <Menu.Target>
                                                        <ActionIcon variant="subtle" color="gray">
                                                            <IconDots size={20} />
                                                        </ActionIcon>
                                                    </Menu.Target>
                                                    <Menu.Dropdown>
                                                        <Menu.Label>Acciones de Solicitud</Menu.Label>
                                                        
                                                        {onGoToSolicitud && (
                                                            <Menu.Item 
                                                                leftSection={<IconEye size={16} />} 
                                                                onClick={() => onGoToSolicitud(sol)}
                                                            >
                                                                Ver Detalles
                                                            </Menu.Item>
                                                        )}

                                                        {(sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                                                            <Menu.Item 
                                                                leftSection={<IconCheck size={16} />} 
                                                                color="green"
                                                                disabled={processingId === sol.id_solicitud}
                                                                onClick={() => handleMarkAsRealizada(sol)}
                                                            >
                                                                Marcar como Realizada
                                                            </Menu.Item>
                                                        )}

                                                        {/* Optional: Add more actions if appropriate */}
                                                    </Menu.Dropdown>
                                                </Menu>
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                        
                        <Text size="xs" c="dimmed" fs="italic">
                            * Las solicitudes GERR provienen del sistema general de requerimientos.
                        </Text>
                    </Stack>
                )}
            </Box>

            <Group justify="flex-end" mt="xl">
                <Button variant="default" onClick={onClose}>Cerrar</Button>
            </Group>
        </Modal>
    );
};
