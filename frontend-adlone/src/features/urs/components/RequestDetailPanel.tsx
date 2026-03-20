import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import React, { useState } from 'react';
import FileIcon from './FileIcon';
import DeriveRequestModal from './DeriveRequestModal';
import {
    Stack,
    Group,
    Paper,
    Text,
    Title,
    Badge,
    Divider,
    Box,
    Button,
    Grid,
    ThemeIcon,
    SimpleGrid,
    Alert,
    Center
} from '@mantine/core';
import {
    IconFileText,
    IconCalendar,
    IconUser,
    IconAlertCircle,
    IconDownload,
    IconCheck,
    IconX,
    IconSearch,
    IconArrowUpRight,
    IconInfoCircle,
    IconLock,
    IconMapPin,
    IconDeviceDesktop,
    IconAlertTriangle,
    IconArrowsExchange
} from '@tabler/icons-react';
import { StatusBadge } from '../../../components/ui/StatusBadge';

interface RequestDetailPanelProps {
    request: any;
    onRequestUpdate: () => void;
    onReload: () => void;
}

const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({ request, onRequestUpdate, onReload }) => {
    const [isDeriving, setIsDeriving] = useState(false);
    const { token } = useAuth();

    const handleStatusUpdate = async (newStatus: string) => {
        try {
            await ursService.updateStatus(request.id_solicitud, { status: newStatus });
            onReload();
            onRequestUpdate();
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    if (!request) return (
        <Center h={400}>
            <Text c="dimmed">Selecciona una solicitud</Text>
        </Center>
    );

    const getPriorityColor = (p?: string) => {
        const priority = p?.toUpperCase() || 'NORMAL';
        if (priority === 'ALTA' || priority === 'CRITICO' || priority === 'URGENTE') return 'red';
        if (priority === 'MEDIA') return 'orange';
        return 'blue';
    };

    return (
        <Stack gap="xl">
            {/* Header Section */}
            <Paper p="lg" radius="lg" withBorder shadow="sm">
                <Stack gap="md">
                    <Group justify="space-between">
                        <Badge variant="light" color="gray" size="lg" radius="sm">
                            ID #{request.id_solicitud}
                        </Badge>
                        <StatusBadge status={request.estado} size="md" />
                    </Group>
                    
                    <Title order={2} style={{ letterSpacing: '-0.5px' }}>
                        {request.titulo || request.nombre_tipo}
                    </Title>
                    
                    <Group 
                        gap="lg" 
                        wrap="wrap" 
                        justify="space-between" 
                        style={{ rowGap: 'var(--mantine-spacing-md)' }}
                    >
                        <Group gap="xs" wrap="nowrap" style={{ flex: '1 1 200px' }}>
                            <ThemeIcon variant="light" color="gray" size="sm" radius="md">
                                <IconFileText size={14} />
                            </ThemeIcon>
                            <Box>
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Tipo</Text>
                                <Text size="sm" fw={700} truncate>{request.nombre_tipo}</Text>
                            </Box>
                        </Group>
                        
                        <Group gap="xs" wrap="nowrap" style={{ flex: '1 1 200px' }}>
                            <ThemeIcon variant="light" color="gray" size="sm" radius="md">
                                <IconCalendar size={14} />
                            </ThemeIcon>
                            <Box>
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Creada</Text>
                                <Text size="sm" fw={700}>
                                    {new Date(request.fecha_creacion).toLocaleDateString('es-CL', {
                                        day: '2-digit', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </Text>
                            </Box>
                        </Group>

                        <Group gap="xs" wrap="nowrap" style={{ flex: '1 1 150px' }}>
                            <ThemeIcon variant="light" color={getPriorityColor(request.prioridad)} size="sm" radius="md">
                                <IconAlertCircle size={14} />
                            </ThemeIcon>
                            <Box>
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Prioridad</Text>
                                <Text size="sm" fw={700} c={getPriorityColor(request.prioridad)}>
                                    {request.prioridad || 'NORMAL'}
                                </Text>
                            </Box>
                        </Group>

                        <Group gap="xs" wrap="nowrap" style={{ flex: '1 1 200px' }}>
                            <ThemeIcon variant="light" color="adl-blue" size="sm" radius="md">
                                <IconUser size={14} />
                            </ThemeIcon>
                            <Box>
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Solicitante</Text>
                                <Text size="sm" fw={700} truncate>{request.nombre_solicitante}</Text>
                            </Box>
                        </Group>
                    </Group>
                </Stack>
            </Paper>

            {/* Observations Section */}
            {request.observaciones && (
                <Alert icon={<IconInfoCircle size={20} />} title="Observaciones del Solicitante" color="adl-blue" variant="light" radius="lg">
                    <Text size="sm" style={{ fontStyle: 'italic' }}>"{request.observaciones}"</Text>
                </Alert>
            )}

            {/* Data Detail Section */}
            <Paper p="lg" radius="lg" withBorder>
                <Stack gap="md">
                    <Group gap="xs">
                        <ThemeIcon variant="filled" color="adl-blue" size="md" radius="md">
                            <IconFileText size={18} />
                        </ThemeIcon>
                        <Title order={4}>Detalle de la Información</Title>
                    </Group>
                    
                    <Divider />

                    <Box pt="sm">
                        {/* Specialized for Sampler Deactivation */}
                        {request.id_tipo === 7 || request.id_tipo === 8 ? (
                            <Stack gap="md">
                                <Paper p="md" bg="adl-blue.0" radius="md" withBorder style={{ borderColor: 'var(--mantine-color-adl-blue-2)' }}>
                                    <Text size="xs" c="adl-blue.7" fw={800} tt="uppercase" mb={4}>Muestreador a deshabilitar</Text>
                                    <Group justify="space-between">
                                        <Text fw={700} size="lg">{request.datos_json?.muestreador_origen_nombre}</Text>
                                        <Badge color="adl-blue">ID: {request.datos_json?.muestreador_origen_id || 'N/A'}</Badge>
                                    </Group>
                                </Paper>

                                <Grid>
                                    <Grid.Col span={6}>
                                        <Paper p="sm" withBorder radius="md">
                                            <Text size="xs" c="dimmed" fw={700}>Traspaso de equipos</Text>
                                            <Text fw={700} c={request.datos_json?.muestreador_origen_id ? 'teal' : 'red'}>
                                                {request.datos_json?.reasignacion_manual || request.datos_json?.muestreador_destino_nombre || request.datos_json?.base_destino ? '✅ SI' : '❌ NO'}
                                            </Text>
                                        </Paper>
                                    </Grid.Col>
                                    <Grid.Col span={6}>
                                        <Paper p="sm" withBorder radius="md">
                                            <Text size="xs" c="dimmed" fw={700}>Tipo de traspaso</Text>
                                            <Text fw={700}>
                                                {request.datos_json?.tipo_traspaso === 'IGUAL' || request.datos_json?.tipo_traspaso === 'MUESTREADOR' ? 'A un Muestreador' : 
                                                 request.datos_json?.tipo_traspaso === 'BASE' ? 'BASE' : 
                                                 request.datos_json?.tipo_traspaso === 'DISTINGO' || request.datos_json?.tipo_traspaso === 'MANUAL' ? 'Personalizado' : 
                                                 request.datos_json?.tipo_traspaso || 'N/A'}
                                            </Text>
                                        </Paper>
                                    </Grid.Col>
                                </Grid>

                                <Paper p="md" bg="gray.0" radius="md" withBorder>
                                    <Text size="xs" c="dimmed" fw={800} tt="uppercase" mb={4}>Destino Final</Text>
                                    <Text fw={700} size="md">
                                        {request.datos_json?.tipo_traspaso === 'IGUAL' || request.datos_json?.tipo_traspaso === 'MUESTREADOR' ? (
                                            `👤 ${request.datos_json?.muestreador_destino_nombre || 'Muestreador No Especificado'}`
                                        ) : request.datos_json?.tipo_traspaso === 'BASE' ? (
                                            `🏢 ${request.datos_json?.base_destino || 'Base No Especificada'}`
                                        ) : request.datos_json?.tipo_traspaso === 'DISTINGO' || request.datos_json?.tipo_traspaso === 'MANUAL' ? (
                                            `🛠️ Reasignación Manual (${request.datos_json?.reasignacion_manual?.length || 0} equipos)`
                                        ) : (
                                            `❓ ${request.datos_json?.tipo_traspaso || 'No definido'}`
                                        )}
                                    </Text>
                                </Paper>
                            </Stack>
                        ) : (request.id_tipo === 1 || request.datos_json?._form_type === 'ACTIVACION_EQUIPO') ? (
                            <Stack gap="md">
                                <Paper p="md" bg="blue.0" radius="md" withBorder>
                                    <Text size="xs" c="blue.8" fw={800} mb={4}>NOMBRE DEL EQUIPO</Text>
                                    <Text size="xl" fw={800} c="blue.9">{request.datos_json?.nombre_equipo}</Text>
                                </Paper>
                                <SimpleGrid cols={2}>
                                    <Paper p="sm" withBorder radius="md">
                                        <Group gap="xs">
                                            <IconDeviceDesktop size={16} />
                                            <Box>
                                                <Text size="xs" c="dimmed">Tipo de Dispositivo</Text>
                                                <Text size="sm" fw={700}>{request.datos_json?.tipo_equipo || 'N/A'}</Text>
                                            </Box>
                                        </Group>
                                    </Paper>
                                    <Paper p="sm" withBorder radius="md">
                                        <Group gap="xs">
                                            <IconMapPin size={16} />
                                            <Box>
                                                <Text size="xs" c="dimmed">Sede / Centro</Text>
                                                <Text size="sm" fw={700}>{request.datos_json?.nombre_centro || 'N/A'}</Text>
                                            </Box>
                                        </Group>
                                    </Paper>
                                </SimpleGrid>
                            </Stack>
                        ) : (request.id_tipo === 2 || request.id_tipo === 6 || request.id_tipo === 10 || request.datos_json?._form_type === 'BAJA_EQUIPO') ? (
                            <Stack gap="md">
                                <Alert color="red" icon={<IconAlertTriangle size={20} />} title="Equipo Desvinculado" radius="md">
                                    <Text fw={700} size="lg">{request.datos_json?.nombre_equipo_full}</Text>
                                </Alert>
                                <SimpleGrid cols={2}>
                                    <Box>
                                        <Text size="xs" c="dimmed" fw={700}>CAUSA</Text>
                                        <Text fw={700} c="red.7">{request.datos_json?.motivo || 'N/A'}</Text>
                                    </Box>
                                    <Box>
                                        <Text size="xs" c="dimmed" fw={700}>FECHA EFECTIVA</Text>
                                        <Text fw={700}>📅 {request.datos_json?.fecha_baja ? new Date(request.datos_json.fecha_baja).toLocaleDateString() : 'N/A'}</Text>
                                    </Box>
                                </SimpleGrid>
                            </Stack>
                        ) : (request.id_tipo === 3 || request.datos_json?._form_type === 'TRASPASO_EQUIPO') ? (
                             <Stack gap="md">
                                <Paper p="md" bg="teal.0" radius="md" withBorder>
                                    <Text size="xs" c="teal.8" fw={800} mb={4}>EQUIPO EN TRASPASO</Text>
                                    <Text size="lg" fw={800} c="teal.9">{request.datos_json?.nombre_equipo_full}</Text>
                                </Paper>
                                
                                {request.datos_json?.traspaso_de?.includes('UBICACION') && (
                                    <Paper p="md" withBorder radius="md">
                                        <Text size="xs" fw={800} c="dimmed" mb="xs">CAMBIO DE UBICACIÓN</Text>
                                        <Group grow align="center">
                                            <Box style={{ textAlign: 'center' }}>
                                                <Text size="xs" c="dimmed">ACTUAL</Text>
                                                <Text fw={700}>{request.datos_json?.info_actual?.ubicacion || 'N/A'}</Text>
                                            </Box>
                                            <IconArrowsExchange size={20} color="var(--mantine-color-blue-4)" />
                                            <Box style={{ textAlign: 'center' }}>
                                                <Text size="xs" c="blue.6" fw={700}>NUEVA</Text>
                                                <Text fw={800} c="blue.9">{request.datos_json?.nombre_centro_destino}</Text>
                                            </Box>
                                        </Group>
                                    </Paper>
                                )}

                                {request.datos_json?.traspaso_de?.includes('RESPONSABLE') && (
                                    <Paper p="md" withBorder radius="md">
                                        <Text size="xs" fw={800} c="dimmed" mb="xs">CAMBIO DE RESPONSABLE</Text>
                                        <Group grow align="center">
                                            <Box style={{ textAlign: 'center' }}>
                                                <Text size="xs" c="dimmed">ACTUAL</Text>
                                                <Text fw={700}>{request.datos_json?.info_actual?.responsable || 'N/A'}</Text>
                                            </Box>
                                            <IconArrowsExchange size={20} color="var(--mantine-color-teal-4)" />
                                            <Box style={{ textAlign: 'center' }}>
                                                <Text size="xs" c="teal.6" fw={700}>NUEVO</Text>
                                                <Text fw={800} c="teal.9">{request.datos_json?.nombre_muestreador_destino}</Text>
                                            </Box>
                                        </Group>
                                    </Paper>
                                )}
                             </Stack>
                        ) : (
                            /* Generic Display */
                            <Stack gap="xs">
                                {request.datos_json && typeof request.datos_json === 'object' ? (
                                    Object.entries(request.datos_json).map(([key, value]) => {
                                        if (['prioridad', 'titulo', 'descripcion', '_form_type'].includes(key)) return null;
                                        return (
                                            <Group key={key} justify="space-between" p="xs" style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
                                                <Text size="sm" fw={600} c="dimmed" tt="capitalize">{key.replace(/_/g, ' ')}</Text>
                                                <Text size="sm" fw={700}>{String(value)}</Text>
                                            </Group>
                                        );
                                    })
                                ) : (
                                    <Text size="sm" c="dimmed">No hay datos específicos disponibles.</Text>
                                )}
                            </Stack>
                        )}
                    </Box>
                </Stack>
            </Paper>

            {/* Attachments Section */}
            <Paper p="lg" radius="lg" withBorder>
                <Stack gap="md">
                    <Group gap="xs">
                        <ThemeIcon variant="light" color="adl-blue" size="md" radius="md">
                            <IconDownload size={18} />
                        </ThemeIcon>
                        <Title order={4}>Archivos Adjuntos</Title>
                    </Group>
                    <Divider />
                    
                    {request.archivos_adjuntos && request.archivos_adjuntos.length > 0 ? (
                        <Stack gap="sm">
                            {request.archivos_adjuntos.map((file: any) => (
                                <Paper 
                                    key={file.id_adjunto}
                                    component="a"
                                    href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`}
                                    target="_blank"
                                    p="sm"
                                    withBorder
                                    radius="md"
                                    style={{ cursor: 'pointer', textDecoration: 'none' }}
                                    styles={{ root: { '&:hover': { backgroundColor: 'var(--mantine-color-gray-0)' } } }}
                                >
                                    <Group justify="space-between" wrap="nowrap">
                                        <Group gap="sm" wrap="nowrap">
                                            <FileIcon mimetype={file.tipo_archivo} filename={file.nombre_archivo} size={28} />
                                            <Box>
                                                <Text size="sm" fw={700} c="blue.7" truncate>{file.nombre_archivo}</Text>
                                                <Text size="xs" c="dimmed">{(file.tipo_archivo || 'Archivo').toUpperCase()} • {new Date(file.fecha).toLocaleDateString()}</Text>
                                            </Box>
                                        </Group>
                                        <IconDownload size={18} color="var(--mantine-color-gray-4)" />
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    ) : (
                        <Center py="xl">
                            <Text size="sm" c="dimmed">No hay archivos adjuntos.</Text>
                        </Center>
                    )}
                </Stack>
            </Paper>

            {/* Management Section */}
            <Paper p="lg" radius="xl" bg="gray.0" withBorder>
                <Stack gap="md">
                    <Group gap="xs">
                        <ThemeIcon variant="filled" color="dark" size="md" radius="md">
                            <IconCheck size={18} />
                        </ThemeIcon>
                        <Title order={4}>Gestión de Solicitud</Title>
                    </Group>
                    
                    { (request.can_manage || request.can_derive) ? (
                        <Grid>
                            {request.can_manage && (
                                <>
                                    <Grid.Col span={{ base: 12, sm: 4 }}>
                                        <Button fullWidth leftSection={<IconCheck size={18} />} color="teal" radius="md" onClick={() => handleStatusUpdate('APROBADO')}>
                                            Aprobar
                                        </Button>
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 4 }}>
                                        <Button fullWidth leftSection={<IconX size={18} />} color="red" radius="md" onClick={() => handleStatusUpdate('RECHAZADO')}>
                                            Rechazar
                                        </Button>
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, sm: 4 }}>
                                        <Button fullWidth leftSection={<IconSearch size={18} />} color="blue" radius="md" onClick={() => handleStatusUpdate('EN_REVISION')}>
                                            En Revisión
                                        </Button>
                                    </Grid.Col>
                                </>
                            )}
                            {request.can_derive && (
                                <Grid.Col span={12}>
                                    <Button fullWidth variant="light" color="adl-blue" leftSection={<IconArrowUpRight size={18} />} radius="md" onClick={() => setIsDeriving(true)}>
                                        Derivar Solicitud
                                    </Button>
                                </Grid.Col>
                            )}
                        </Grid>
                    ) : (
                        <Alert color="gray" icon={<IconLock size={20} />} radius="md">
                            <Text size="sm" fw={700}>Modo Lectura</Text>
                            <Text size="xs">Usted tiene acceso de visualización para este trámite.</Text>
                        </Alert>
                    )}
                </Stack>
            </Paper>

            <DeriveRequestModal 
                isOpen={isDeriving} 
                requestId={request.id_solicitud} 
                requestTypeId={request.id_tipo}
                onClose={() => setIsDeriving(false)} 
                onSuccess={() => {
                    onReload();
                    onRequestUpdate();
                }}
            />
        </Stack>
    );
};

export default RequestDetailPanel;
