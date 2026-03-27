import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import React, { useState, useMemo } from 'react';
import FileIcon from './FileIcon';
import DeriveRequestModal from './DeriveRequestModal';
import { useToast } from '../../../contexts/ToastContext';
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
    Center,
    Modal,
    Textarea,
    Timeline,
    ScrollArea,
    Collapse,
    UnstyledButton,
    useMantineTheme
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
    IconArrowsExchange,
    IconHistory,
    IconArrowRight,
    IconChevronDown,
    IconChevronUp,
    IconCheckbox
} from '@tabler/icons-react';
import { StatusBadge } from '../../../components/ui/StatusBadge';

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
    'EN_REVISION': 'En Revisión',
    'PENDIENTE': 'Pendiente',
    'ACEPTADA': 'Aceptada',
    'RECHAZADA': 'Rechazada',
    'REALIZADA': 'Realizada',
    'NORMAL': 'Normal',
    'ALTA': 'Alta',
    'CRITICO': 'Crítico',
    'URGENTE': 'Urgente',
    'MEDIA': 'Media',
    'BAJA': 'Baja',
};

const formatCodeValue = (value: string | null | undefined): string => {
    if (!value) return 'N/A';
    const upper = String(value).trim().toUpperCase();
    if (CODE_VALUE_MAP[upper]) return CODE_VALUE_MAP[upper];
    // Fallback: SNAKE_CASE → Title Case
    return String(value)
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/\bDe\b/g, 'de')
        .replace(/\bDel\b/g, 'del')
        .replace(/\bY\b/g, 'y')
        .replace(/\bEn\b/g, 'en')
        .replace(/\bA\b/g, 'a');
};

interface RequestDetailPanelProps {
    request: any;
    onRequestUpdate: () => void;
    onReload: () => void;
}

const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({ request, onRequestUpdate, onReload }) => {
    const [isDeriving, setIsDeriving] = useState(false);
    const { token } = useAuth();
    const { showToast } = useToast();
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);

    // Observation modal state
    const [obsModalOpen, setObsModalOpen] = useState(false);
    const [obsText, setObsText] = useState('');
    const [pendingAction, setPendingAction] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState(false);
    // Action history toggle
    const [historyOpen, setHistoryOpen] = useState(false);

    const isClosed = request?.estado === 'REALIZADA' || request?.estado === 'RECHAZADA';

    // Build unified action history from system comments + derivations
    const actionHistory = useMemo(() => {
        if (!request) return [];
        const items: { date: string; action: string; user: string; observation: string; type: string }[] = [];

        // System comments (es_sistema === true or 1)
        (request.conversacion || []).forEach((msg: any) => {
            if (msg.es_sistema) {
                let action = msg.mensaje || '';
                let obs = '';
                // Parse "Cambio de estado a X: observación"
                const match = action.match(/^Cambio de estado a ([^:]+)(?::\s*(.+))?$/);
                if (match) {
                    action = match[1].trim();
                    obs = match[2]?.trim() || '';
                }
                items.push({
                    date: msg.fecha,
                    action,
                    user: msg.nombre_usuario || 'Sistema',
                    observation: obs,
                    type: 'status'
                });
            }
        });

        // Derivations
        (request.historial_derivaciones || []).forEach((d: any) => {
            items.push({
                date: d.fecha,
                action: `Derivada → ${d.usuario_destino || d.rol_destino || d.area_destino || 'Otro destino'}`,
                user: d.usuario_origen || 'Sistema',
                observation: d.motivo || '',
                type: 'derivation'
            });
        });

        items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return items;
    }, [request]);

    const getActionColor = (action: string) => {
        const a = action.toUpperCase();
        if (a.includes('ACEPTADA') || a.includes('APROBAD')) return 'teal';
        if (a.includes('REALIZADA')) return 'green';
        if (a.includes('RECHAZAD')) return 'red';
        if (a.includes('REVISION')) return 'blue';
        if (a.includes('DERIVAD')) return 'indigo';
        return 'gray';
    };

    const openObservationModal = (actionType: string) => {
        setPendingAction(actionType);
        setObsText('');
        setObsModalOpen(true);
    };

    const getActionLabel = (actionType: string | null) => {
        switch (actionType) {
            case 'ACEPTADA': return 'Aceptar Solicitud';
            case 'RECHAZADA': return 'Rechazar Solicitud';
            case 'EN_REVISION': return 'Poner En Revisión';
            case 'REALIZADA': return 'Marcar como Realizada';
            default: return 'Confirmar';
        }
    };

    const getActionColor2 = (actionType: string | null) => {
        switch (actionType) {
            case 'ACEPTADA': return 'teal';
            case 'RECHAZADA': return 'red';
            case 'EN_REVISION': return 'blue';
            case 'REALIZADA': return 'green';
            default: return 'gray';
        }
    };

    const confirmAction = async () => {
        if (!pendingAction || !obsText.trim()) return;
        setActionLoading(true);
        try {
            await ursService.updateStatus(request.id_solicitud, { 
                status: pendingAction, 
                comment: obsText.trim() 
            });
            const messages: Record<string, string> = {
                'ACEPTADA': 'Solicitud aceptada correctamente',
                'RECHAZADA': 'Solicitud rechazada',
                'EN_REVISION': 'Solicitud puesta en revisión',
                'REALIZADA': 'Solicitud marcada como realizada'
            };
            showToast({ message: messages[pendingAction] || 'Estado actualizado', type: 'success' });
            setObsModalOpen(false);
            onReload();
            onRequestUpdate();
        } catch (error) {
            console.error('Error updating status:', error);
            showToast({ message: 'Error al actualizar el estado', type: 'error' });
        } finally {
            setActionLoading(false);
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
            <Paper p={{ base: 'md', sm: 'lg' }} radius="lg" withBorder shadow="sm">
                <Stack gap="md">
                    <Group justify="space-between">
                        <Badge variant="light" color="gray" size={isMobile ? 'sm' : 'lg'} radius="sm">
                            ID #{request.id_solicitud}
                        </Badge>
                        <StatusBadge status={request.estado} size={isMobile ? 'xs' : 'md'} />
                    </Group>
                    
                    <Title order={isMobile ? 3 : 2} style={{ letterSpacing: '-0.5px' }}>
                        {request.titulo || request.nombre_tipo}
                    </Title>
                    
                    <SimpleGrid 
                        cols={{ base: 1, xs: 2, sm: 4 }} 
                        spacing="lg"
                    >
                        <Group gap="xs" wrap="nowrap">
                            <ThemeIcon variant="light" color="gray" size="sm" radius="md">
                                <IconFileText size={14} />
                            </ThemeIcon>
                            <Box>
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Tipo</Text>
                                <Text size="sm" fw={700} truncate>{request.nombre_tipo}</Text>
                            </Box>
                        </Group>
                        
                        <Group gap="xs" wrap="nowrap">
                            <ThemeIcon variant="light" color="gray" size="sm" radius="md">
                                <IconCalendar size={14} />
                            </ThemeIcon>
                            <Box>
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Creada</Text>
                                <Text size="sm" fw={700}>
                                    {new Date(request.fecha_creacion).toLocaleDateString('es-CL', {
                                        day: '2-digit', 
                                        month: 'short', 
                                        year: 'numeric'
                                    })}
                                </Text>
                            </Box>
                        </Group>

                        <Group gap="xs" wrap="nowrap">
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

                        <Group gap="xs" wrap="nowrap">
                            <ThemeIcon variant="light" color="adl-blue" size="sm" radius="md">
                                <IconUser size={14} />
                            </ThemeIcon>
                            <Box>
                                <Text size="xs" c="dimmed" fw={700} tt="uppercase">Solicitante</Text>
                                <Text size="sm" fw={700} truncate>{request.nombre_solicitante?.split(' ')[0]}</Text>
                            </Box>
                        </Group>
                    </SimpleGrid>
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

                                <Grid gutter="md">
                                    <Grid.Col span={{ base: 12, xs: 6 }}>
                                        <Paper p="sm" withBorder radius="md">
                                            <Text size="xs" c="dimmed" fw={700}>Traspaso de equipos</Text>
                                            <Text fw={700} c={request.datos_json?.muestreador_origen_id ? 'teal' : 'red'}>
                                                {request.datos_json?.reasignacion_manual || request.datos_json?.muestreador_destino_nombre || request.datos_json?.base_destino ? '✅ SI' : '❌ NO'}
                                            </Text>
                                        </Paper>
                                    </Grid.Col>
                                    <Grid.Col span={{ base: 12, xs: 6 }}>
                                        <Paper p="sm" withBorder radius="md">
                                            <Text size="xs" c="dimmed" fw={700}>Tipo de traspaso</Text>
                                            <Text fw={700} truncate>
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
                                <SimpleGrid cols={{ base: 1, xs: 2 }}>
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
                                <SimpleGrid cols={{ base: 1, xs: 2 }}>
                                    <Box>
                                        <Text size="xs" c="dimmed" fw={700}>CAUSA</Text>
                                        <Text fw={700} c="red.7">
                                            {formatCodeValue(request.datos_json?.motivo)}
                                        </Text>
                                    </Box>
                                    <Box>
                                        <Text size="xs" c="dimmed" fw={700}>FECHA EFECTIVA</Text>
                                        <Text fw={700}>
                                            📅 {request.datos_json?.fecha_baja ? request.datos_json.fecha_baja.split('-').reverse().join('/') : 'N/A'}
                                        </Text>
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
                                                <Text size="sm" fw={700}>{formatCodeValue(String(value))}</Text>
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

            {/* Status Messages */}
            {request.estado === 'ACEPTADA' && (
                <Alert icon={<IconCheck size={20} />} color="teal" variant="light" radius="lg">
                    <Text size="sm" fw={700}>Solicitud aceptada, se le avisará cuando se haya realizado lo solicitado.</Text>
                </Alert>
            )}
            {request.estado === 'REALIZADA' && (
                <Alert icon={<IconCheckbox size={20} />} color="green" variant="light" radius="lg">
                    <Text size="sm" fw={700}>Solicitud realizada, por ende se cierra esta solicitud.</Text>
                </Alert>
            )}
            {request.estado === 'RECHAZADA' && (
                <Alert icon={<IconX size={20} />} color="red" variant="light" radius="lg">
                    <Text size="sm" fw={700}>Solicitud rechazada. No se pueden realizar más acciones.</Text>
                </Alert>
            )}
            {request.estado === 'EN_REVISION' && (
                <Alert icon={<IconSearch size={20} />} color="blue" variant="light" radius="lg">
                    <Text size="sm" fw={700}>Solicitud en revisión. Se está evaluando para proceder.</Text>
                </Alert>
            )}

            {/* Management Section - Only show if not closed */}
            {!isClosed && (
                <Paper p="lg" radius="xl" bg="gray.0" withBorder>
                    <Stack gap="md">
                        <Group gap="xs">
                            <ThemeIcon variant="filled" color="dark" size="md" radius="md">
                                <IconCheck size={18} />
                            </ThemeIcon>
                            <Title order={4}>Gestión de Solicitud</Title>
                        </Group>
                        
                        {(request.can_manage || request.can_derive) ? (
                            <Grid>
                                {request.can_manage && request.estado !== 'ACEPTADA' && (
                                    <>
                                        <Grid.Col span={{ base: 12, sm: 4 }}>
                                            <Button fullWidth leftSection={<IconCheck size={18} />} color="teal" radius="md" onClick={() => openObservationModal('ACEPTADA')}>
                                                Aceptar
                                            </Button>
                                        </Grid.Col>
                                        <Grid.Col span={{ base: 12, sm: 4 }}>
                                            <Button fullWidth leftSection={<IconX size={18} />} color="red" radius="md" onClick={() => openObservationModal('RECHAZADA')}>
                                                Rechazar
                                            </Button>
                                        </Grid.Col>
                                        <Grid.Col span={{ base: 12, sm: 4 }}>
                                            <Button fullWidth leftSection={<IconSearch size={18} />} color="blue" radius="md" onClick={() => openObservationModal('EN_REVISION')}>
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
                        
                        {/* Marcar como Realizado - Only when ACEPTADA and user can manage */}
                        {request.can_manage && request.estado === 'ACEPTADA' && (
                            <Button fullWidth leftSection={<IconCheckbox size={18} />} color="green" radius="md" size="lg" onClick={() => openObservationModal('REALIZADA')}>
                                Marcar como Realizado
                            </Button>
                        )}
                    </Stack>
                </Paper>
            )}

            {/* Action History Section */}
            <Paper p="lg" radius="lg" withBorder>
                <Stack gap="md">
                    <UnstyledButton onClick={() => setHistoryOpen(!historyOpen)} style={{ width: '100%' }}>
                        <Group justify="space-between">
                            <Group gap="xs">
                                <ThemeIcon variant="light" color="gray" size="md" radius="md">
                                    <IconHistory size={18} />
                                </ThemeIcon>
                                <Title order={4}>Historial de Acciones</Title>
                                {actionHistory.length > 0 && (
                                    <Badge size="sm" variant="filled" color="gray">{actionHistory.length}</Badge>
                                )}
                            </Group>
                            {historyOpen ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
                        </Group>
                    </UnstyledButton>

                    <Collapse in={historyOpen}>
                        {actionHistory.length > 0 ? (
                            <ScrollArea.Autosize mah={300}>
                                <Timeline active={actionHistory.length - 1} bulletSize={24} lineWidth={2} mt="sm">
                                    {actionHistory.map((item, idx) => (
                                        <Timeline.Item
                                            key={idx}
                                            bullet={item.type === 'derivation' ? <IconArrowRight size={12} /> : <IconCheck size={12} />}
                                            color={getActionColor(item.action)}
                                            title={
                                                <Group gap="xs">
                                                    <Badge size="xs" variant="light" color={getActionColor(item.action)}>
                                                        {item.action}
                                                    </Badge>
                                                    <Text size="xs" c="dimmed">
                                                        {new Date(item.date).toLocaleString('es-CL', {
                                                            day: '2-digit', month: '2-digit', year: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </Text>
                                                </Group>
                                            }
                                        >
                                            <Text c="dimmed" size="xs" mt={4}>
                                                <Text span fw={600} c="dark">{item.user || 'Sistema'}</Text>
                                                {' '}•{' '}
                                                {item.observation || 'Sin detalle'}
                                            </Text>
                                        </Timeline.Item>
                                    ))}
                                </Timeline>
                            </ScrollArea.Autosize>
                        ) : (
                            <Text size="sm" c="dimmed" fs="italic" ta="center" py="md">
                                Sin movimientos registrados.
                            </Text>
                        )}
                    </Collapse>
                </Stack>
            </Paper>

            {/* Observation Modal */}
            <Modal
                opened={obsModalOpen}
                onClose={() => { setObsModalOpen(false); setPendingAction(null); }}
                title={
                    <Group gap="xs">
                        <ThemeIcon variant="light" color={getActionColor2(pendingAction)} radius="md">
                            <IconCheck size={18} />
                        </ThemeIcon>
                        <Text fw={700}>{getActionLabel(pendingAction)}</Text>
                    </Group>
                }
                radius="lg"
                zIndex={1100}
            >
                <Stack gap="md">
                    <Textarea
                        label="Observaciones"
                        placeholder="Escriba sus observaciones para esta acción..."
                        required
                        minRows={3}
                        value={obsText}
                        onChange={(e) => setObsText(e.currentTarget.value)}
                        radius="md"
                    />
                    <Group justify="flex-end" mt="md">
                        <Button variant="light" color="gray" onClick={() => setObsModalOpen(false)} radius="md">
                            Cancelar
                        </Button>
                        <Button
                            color={getActionColor2(pendingAction)}
                            radius="md"
                            loading={actionLoading}
                            disabled={!obsText.trim()}
                            onClick={confirmAction}
                        >
                            {getActionLabel(pendingAction)}
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            <DeriveRequestModal 
                isOpen={isDeriving} 
                requestId={request.id_solicitud} 
                requestTypeId={request.id_tipo}
                onClose={() => setIsDeriving(false)} 
                onSuccess={() => {
                    showToast({ message: 'Solicitud derivada correctamente', type: 'success' });
                    onReload();
                    onRequestUpdate();
                }}
            />
        </Stack>
    );
};

export default RequestDetailPanel;
