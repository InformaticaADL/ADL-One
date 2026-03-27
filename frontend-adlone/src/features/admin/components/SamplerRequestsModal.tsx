import React, { useState } from 'react';
import { 
    Modal, 
    Table, 
    Badge, 
    Button, 
    LoadingOverlay, 
    Box, 
    ScrollArea,
    Alert,
    Stack,
    Group,
    Text,
    Accordion,
    Divider,
    Paper,
    SimpleGrid
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import {
    IconCalendar,
    IconUser,
    IconCheck,
    IconInfoCircle,
    IconBriefcase,
    IconSignature,
    IconArrowRight,
    IconBuildingCommunity,
    IconList
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';

interface SamplerRequestsModalProps {
    idMuestreador: number | string | null;
    nombreMuestreador: string;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    requests: any[];
}

export const SamplerRequestsModal: React.FC<SamplerRequestsModalProps> = ({ 
    nombreMuestreador,
    isOpen, 
    onClose, 
    onRefresh,
    requests
}) => {
    const displayRequests = requests || [];
    const loading = false;
    const [processingId, setProcessingId] = useState<number | null>(null);
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const handleMarkAsRealizada = async (sol: any) => {
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const isDeshabilitar = typeRaw.toUpperCase().includes('DESHABILITAR');

        const executeUpdate = async () => {
            setProcessingId(sol.id_solicitud);
            try {
                if (sol.id_tipo || (sol.origen_tabla && sol.origen_tabla !== 'GENERAL')) {
                    // Es URS
                    await ursService.updateStatus(sol.id_solicitud, { 
                        status: 'REALIZADA', 
                        comment: 'Solicitud gestionada y marcada como realizada automáticamente.' 
                    });
                } else {
                    // Es Legacy
                    await adminService.updateSolicitudStatus(
                        sol.id_solicitud, 
                        'REALIZADA', 
                        'Solicitud marcada como realizada desde el panel de muestreadores.'
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

        if (isDeshabilitar) {
            modals.openConfirmModal({
                title: <Text fw={700}>Confirmar Deshabilitación</Text>,
                children: (
                    <Text size="sm">
                        ¿Está seguro de que desea deshabilitar este muestreador y reasignar todos sus equipos según lo solicitado? 
                        Esta acción es irreversible y afectará el acceso del usuario.
                    </Text>
                ),
                labels: { confirm: 'Confirmar y Ejecutar', cancel: 'Cancelar' },
                confirmProps: { color: 'red' },
                onConfirm: executeUpdate
            });
        } else {
            executeUpdate();
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

    const renderSolicitudDetails = (sol: any) => {
        const d = sol.datos_json || {};
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const type = typeRaw.toUpperCase();
        
        const isDeshabilitar = type.includes('DESHABILITAR');
        const isFirma = type.includes('FIRMA');
        const isTraspaso = type.includes('TRASPASO');

        const transferType = d.tipo_traspaso; // BASE, MUESTREADOR, MANUAL
        const equipmentCount = d.reasignacion_manual?.length || 0;

        return (
            <Stack gap={8}>
                <Text size="sm" fw={800} c="blue.9">{typeRaw}</Text>
                
                <Box>
                    {isDeshabilitar && (
                        <Stack gap={4}>
                            <Group gap={4} wrap="nowrap">
                                <IconBriefcase size={14} color="red" />
                                <Text size="xs" fw={700} c="red.7">Solicitud de Deshabilitación</Text>
                            </Group>
                            
                            {transferType === 'BASE' && (
                                <Group gap={4} wrap="nowrap">
                                    <IconBuildingCommunity size={12} color="gray" />
                                    <Text size="xs" fw={700}>Traspaso a Base:</Text>
                                    <Text size="xs" c="blue">{d.base_destino || 'Principal'}</Text>
                                </Group>
                            )}

                            {transferType === 'MUESTREADOR' && (
                                <Group gap={4} wrap="nowrap">
                                    <IconUser size={12} color="gray" />
                                    <Text size="xs" fw={700}>Traspaso a:</Text>
                                    <Text size="xs" c="blue">{d.muestreador_destino_nombre || 'Muestreador Destino'}</Text>
                                </Group>
                            )}

                            {transferType === 'MANUAL' && (
                                <Stack gap={2}>
                                    <Group gap={4} wrap="nowrap">
                                        <IconList size={12} color="gray" />
                                        <Text size="xs" fw={700}>Traspaso Manual ({equipmentCount} equipos)</Text>
                                    </Group>
                                    <Accordion variant="separated" radius="xs">
                                        <Accordion.Item value="manual-list">
                                            <Accordion.Control p={4}>
                                                <Text size="xs" fw={700}>Ver Detalle de Equipos</Text>
                                            </Accordion.Control>
                                            <Accordion.Panel>
                                                <Stack gap={2}>
                                                    {d.reasignacion_manual?.map((item: any, idx: number) => (
                                                        <Group key={idx} justify="space-between" wrap="nowrap">
                                                            <Text size="xs" truncate>{item.nombre_equipo}</Text>
                                                            <IconArrowRight size={10} />
                                                            <Text size="xs" fw={700} c="teal">{item.id_muestreador_nuevo ? 'Asignado' : 'Pendiente'}</Text>
                                                        </Group>
                                                    ))}
                                                </Stack>
                                            </Accordion.Panel>
                                        </Accordion.Item>
                                    </Accordion>
                                </Stack>
                            )}
                        </Stack>
                    )}
                    {isFirma && (
                        <Group gap={4} wrap="nowrap">
                            <IconSignature size={12} color="indigo" />
                            <Text size="xs" fw={700} c="indigo.7">Actualización de Firma</Text>
                        </Group>
                    )}
                    {isTraspaso && (
                        <Group gap={4} wrap="nowrap">
                            <IconUser size={12} color="teal" />
                            <Text size="xs" fw={700} c="teal.7">Asignación de Equipos</Text>
                        </Group>
                    )}
                </Box>

                {(d.observaciones || d.descripcion || d.comentario) && (
                    <Box mt={4}>
                        <Divider label="Observaciones" labelPosition="left" size="xs" mb={4} />
                        <Text size="xs" c="dimmed" fs="italic">
                            "{d.observaciones || d.descripcion || d.comentario}"
                        </Text>
                    </Box>
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
                    <Text size="sm" c="dimmed">{nombreMuestreador}</Text>
                </Box>
            }
            size={isMobile ? "100%" : "xl"}
            fullScreen={isMobile}
            scrollAreaComponent={ScrollArea.Autosize}
            withOverlay={false}
            trapFocus={false}
            closeOnClickOutside={false}
            shadow="xl"
            styles={{
                content: {
                    border: '1px solid var(--mantine-color-gray-3)',
                    boxShadow: 'var(--mantine-shadow-xl)'
                }
            }}
        >
            <Box pos="relative" miw={isMobile ? 'auto' : 500} mih={200} p={isMobile ? "xs" : 0}>
                <LoadingOverlay visible={loading} />

                {displayRequests.length === 0 && !loading ? (
                    <Alert icon={<IconInfoCircle size="1rem" />} color="blue" mt="md">
                        No hay solicitudes pendientes activas para este muestreador.
                    </Alert>
                ) : (
                    <Stack gap="md" mt="md">
                        {!isMobile ? (
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
                                        <Table.Tr key={`${sol.origen_tabla}-${sol.id_solicitud}`}>
                                            <Table.Td>
                                                <Text size="sm" fw={700}>#{sol.id_solicitud}</Text>
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
                                    ))}
                                </Table.Tbody>
                            </Table>
                        ) : (
                            <Stack gap="sm">
                                {displayRequests.map((sol: any) => (
                                    <Paper key={`${sol.origen_tabla}-${sol.id_solicitud}`} withBorder p="md" radius="md" shadow="xs">
                                        <Stack gap="xs">
                                            <Group justify="space-between">
                                                <Text size="sm" fw={800} c="blue.7">#{sol.id_solicitud}</Text>
                                                <Badge color={getStatusColor(sol.estado)} variant="filled" size="sm">
                                                    {getStatusLabel(sol.estado)}
                                                </Badge>
                                            </Group>
                                            
                                            <Divider variant="dashed" />
                                            
                                            {renderSolicitudDetails(sol)}
                                            
                                            <Divider variant="dashed" />
                                            
                                            <SimpleGrid cols={2}>
                                                <Box>
                                                    <Text size="xs" fw={700} c="dimmed">SOLICITANTE</Text>
                                                    <Text size="xs" fw={600}>{sol.nombre_solicitante || 'N/A'}</Text>
                                                </Box>
                                                <Box>
                                                    <Text size="xs" fw={700} c="dimmed">FECHA</Text>
                                                    <Text size="xs" fw={600}>{formatDate(sol.fecha_creacion)}</Text>
                                                </Box>
                                            </SimpleGrid>

                                            {(sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                                                <Button
                                                    fullWidth
                                                    mt="xs"
                                                    color="green"
                                                    leftSection={<IconCheck size={16} />}
                                                    loading={processingId === sol.id_solicitud}
                                                    onClick={() => handleMarkAsRealizada(sol)}
                                                    radius="md"
                                                >
                                                    Marcar como Realizada
                                                </Button>
                                            )}
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Stack>
                )}
            </Box>

            <Group justify="flex-end" mt="xl">
                <Button variant="default" onClick={onClose} fullWidth={isMobile}>Cerrar</Button>
            </Group>
        </Modal>
    );
};
