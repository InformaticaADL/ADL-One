import React, { useState, useEffect } from 'react';
import { 
    Modal, 
    Table, 
    Badge, 
    Button, 
    LoadingOverlay, 
    Box, 
    ScrollArea,
    Alert,
    Tooltip,
    Stack,
    Group,
    Text
} from '@mantine/core';
import {
    IconCalendar,
    IconUser,
    IconMapPin,
    IconCheck,
    IconInfoCircle
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';

interface EquipmentRequestsModalProps {
    idEquipo: number | string | null;
    nombreEquipo: string;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    codigoEquipo?: string;
    requests: any[];
}

export const EquipmentRequestsModal: React.FC<EquipmentRequestsModalProps> = ({ 
    nombreEquipo,
    codigoEquipo,
    isOpen, 
    onClose, 
    onRefresh,
    requests
}) => {
    const displayRequests = requests || [];
    const loading = false;
    const [processingId, setProcessingId] = useState<number | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        // Simple mount dependency
    }, [isOpen]);

    const handleMarkAsRealizada = async (sol: any) => {
        setProcessingId(sol.id_solicitud);
        try {
            if (sol.id_tipo || (sol.origen_tabla && sol.origen_tabla !== 'GENERAL')) {
                // Es URS
                await ursService.updateStatus(sol.id_solicitud, { 
                    status: 'REALIZADA', 
                    comment: 'Equipo gestionado y marcado como realizado automáticamente.' 
                });
            } else {
                // Es Legacy
                await adminService.updateSolicitudStatus(
                    sol.id_solicitud, 
                    'REALIZADA', 
                    'Solicitud marcada como realizada desde el panel de equipos.'
                );
            }
            showToast({ type: 'success', message: `Solicitud #${sol.id_solicitud} marcada como realizada` });
            onRefresh();

        } catch (error) {
            console.error('Error updating status:', error);
            showToast({ type: 'error', message: 'Error al actualizar la solicitud' });
        } finally {
            setProcessingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        const s = (status || '').toUpperCase().trim();
        switch (s) {
            case 'PENDIENTE':
            case 'PENDIENTE_TECNICA':
            case 'PENDIENTE_CALIDAD': return 'yellow';
            case 'EN_REVISION':
            case 'EN_REVISION_TECNICA': return 'cyan';
            case 'ACEPTADA': return 'teal';
            case 'RECHAZADA':
            case 'RECHAZADO_TECNICA': return 'red';
            case 'REALIZADA': return 'blue';
            default: return 'gray';
        }
    };

    const getStatusLabel = (status: string) => {
        return (status || '').replace(/_/g, ' ');
    };

    /** Converts code-like strings to human-readable text */
    const CODE_VALUE_MAP: Record<string, string> = {
        'VIDA_UTIL': 'Vida Útil',
        'DANIO': 'Daño',
        'DANO': 'Daño',
        'OBSOLESCENCIA': 'Obsolescencia',
        'PERDIDA': 'Pérdida',
        'ROBO': 'Robo',
        'DETERIORO': 'Deterioro',
        'REEMPLAZO': 'Reemplazo',
        'OTRO': 'Otro',
    };

    const formatCodeValue = (value: string | null | undefined): string => {
        if (!value) return '';
        const upper = String(value).trim().toUpperCase();
        if (CODE_VALUE_MAP[upper]) return CODE_VALUE_MAP[upper];
        return String(value);
    };

    const renderSolicitudDetails = (sol: any) => {
        const d = sol.datos_json || {};
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const type = typeRaw.toUpperCase();
        
        const isTraspaso = type.includes('TRASPASO') || d._form_type === 'TRASPASO_EQUIPO' || d.isTransfer;
        const isAlta = type.includes('ALTA') || (type.includes('REACTIVACI') && d.isReactivation);
        const isProblem = type.includes('PROBLEMA') || type.includes('FALLA');
        
        return (
            <Stack gap={4}>
                <Text size="sm" fw={800} c="blue.9">{typeRaw}</Text>
                
                {/* Specific Details based on Type */}
                <Box mt={2}>
                    {isTraspaso && (
                        <Stack gap={3}>
                            {d.traspaso_de && (
                                <Group gap={4}>
                                    <Text size="xs" fw={700} c="dimmed">Tipo Traspaso:</Text>
                                    <Text size="xs" fw={800} c="blue.7">
                                        {d.traspaso_de.map((t: string) => t === 'UBICACION' ? 'Sede' : (t === 'RESPONSABLE' ? 'Muestreador' : t)).join(' y ')}
                                    </Text>
                                </Group>
                            )}
                            {(d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino) && (
                                <Group gap={4} wrap="nowrap">
                                    <IconMapPin size={12} color="var(--mantine-color-blue-6)" />
                                    <Text size="xs" fw={700}>Sede Destino:</Text>
                                    <Badge size="xs" variant="light" color="blue" styles={{ root: { minWidth: 'fit-content' }}}>
                                        {d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino}
                                    </Badge>
                                </Group>
                            )}
                            {(d.nombre_muestreador_destino || d.nuevo_responsable_nombre || d.nuevo_responsable || d.responsable_destino) && (
                                <Group gap={4} wrap="nowrap">
                                    <IconUser size={12} color="var(--mantine-color-indigo-6)" />
                                    <Text size="xs" fw={700}>Nuevo Responsable:</Text>
                                    <Text size="xs" c="indigo.8" fw={800}>
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
                </Box>

                {/* General Motive/Comments (Always at the bottom) */}
                {(d.motivo || d.observaciones || d.descripcion || d.comentario) && (
                    <Text size="xs" c="dimmed" fs="italic" lineClamp={3}>
                        "{formatCodeValue(String(d.motivo || d.observaciones || d.descripcion || d.comentario))}"
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

                {displayRequests.length === 0 && !loading ? (
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
                                {displayRequests.map((sol: any) => (
                                    <React.Fragment key={`${sol.origen_tabla}-${sol.id_solicitud}`}>
                                        <Table.Tr>
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
                                                <Badge color={getStatusColor(sol.estado)} variant="filled" size="sm" styles={{ root: { minWidth: '80px', textAlign: 'center' }}}>
                                                    {getStatusLabel(sol.estado)}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group justify="flex-end" gap="xs">
                                                    {(sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                                                        <Button
                                                            size="xs"
                                                            color="green"
                                                            leftSection={<IconCheck size={14} />}
                                                            loading={processingId === sol.id_solicitud}
                                                            onClick={() => handleMarkAsRealizada(sol)}
                                                        >
                                                            Realizar
                                                        </Button>
                                                    )}
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    </React.Fragment>
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
