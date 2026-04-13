import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Stack,
    Group,
    Text,
    TextInput,
    ActionIcon,
    Loader,
    ScrollArea,
    Box,
    Center,
    Title,
    SegmentedControl,
    Select,
    Badge,
    UnstyledButton,
    Flex,
    Paper
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
    IconSearch,
    IconPlus,
    IconChevronRight,
    IconCalendar,
    IconClock,
    IconCircleFilled,
    IconFolderOpen,
    IconArrowLeft
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotificationStore } from '../../../store/notificationStore';
import RequestDetailPanel from './RequestDetailPanel';
import RequestActivityAndChat from './RequestActivityAndChat';
import { StatusBadge } from '../../../components/ui/StatusBadge';

interface Request {
    id_solicitud: number;
    id_solicitante: number;
    titulo: string;
    nombre_tipo: string;
    estado: string;
    area_destino: string;
    fecha_solicitud: string;
    nombre_solicitante: string;
    prioridad?: string;
    conversacion_count?: number;
    unread_count?: number;
}

const UniversalInbox: React.FC = () => {
    const { 
        setActiveSubmodule, 
        pendingRequestId, 
        setPendingRequestId, 
        selectedRequestId, 
        setSelectedRequestId,
        ursInboxMode, 
        setUrsInboxMode 
    } = useNavStore();
    
    const { user } = useAuth();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { markAsReadByRef, notifications } = useNotificationStore();
    
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState({ status: '', area: '', type: '' });
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // Track notification count for real-time inbox refresh
    const prevNotifCountRef = useRef(notifications.length);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const reqs = await ursService.getRequests();
            setRequests(reqs);
        } catch (error) {
            console.error("Error loading inbox data:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadRequestDetail = async (id: number, silent = false) => {
        if (!silent) setLoadingDetail(true);
        
        setRequests(prev => prev.map(r => 
            r.id_solicitud === id ? { ...r, unread_count: 0 } : r
        ));

        try {
            markAsReadByRef(id);
            const data = await ursService.getRequestDetail(id);
            setSelectedRequest(data);
        } catch (error) {
            console.error("Error loading request detail:", error);
            setSelectedRequest(null);
        } finally {
            if (!silent) setLoadingDetail(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (pendingRequestId && !loading) {
            setSelectedRequestId(pendingRequestId);
            setPendingRequestId(null);
        }
    }, [pendingRequestId, loading]);

    const itemRefs = useRef<{ [key: number]: HTMLButtonElement | null }>({});

    // Effect 1: Handle detail loading and scrolling when ID change
    useEffect(() => {
        if (selectedRequestId) {
            loadRequestDetail(selectedRequestId);
            
            // Auto-scroll to the selected item after a short delay to ensure DOM is ready
            setTimeout(() => {
                const element = itemRefs.current[selectedRequestId];
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        } else {
            setSelectedRequest(null);
        }
    }, [selectedRequestId]);

    // Effect 2: Auto-switch tab based on selected request ownership
    // This runs when requests are loaded or selection changes
    useEffect(() => {
        if (selectedRequestId && requests.length > 0) {
            const req = requests.find(r => r.id_solicitud === selectedRequestId);
            if (req) {
                const isMine = Number(req.id_solicitante) === Number(user?.id);
                const targetMode = isMine ? 'SENT' : 'RECEIVED';
                // Only switch if different, but don't depend on ursInboxMode to avoid locking manual changes
                if (ursInboxMode !== targetMode) {
                    setUrsInboxMode(targetMode);
                }
            }
        }
    }, [selectedRequestId, requests.length, user?.id]); // Removed ursInboxMode to allow manual switching thereafter

    useEffect(() => {
        if (!selectedRequestId) return;
        const interval = setInterval(() => {
            loadRequestDetail(selectedRequestId, true);
        }, 5000);
        return () => clearInterval(interval);
    }, [selectedRequestId]);

    // Real-time refresh: when new notifications arrive, refresh inbox immediately
    useEffect(() => {
        if (notifications.length > prevNotifCountRef.current) {
            // A new notification arrived — refresh the inbox list
            ursService.getRequests().then(reqs => setRequests(reqs)).catch(console.error);
            // If a request is selected, refresh its detail too
            if (selectedRequestId) {
                loadRequestDetail(selectedRequestId, true);
            }
        }
        prevNotifCountRef.current = notifications.length;
    }, [notifications.length]);

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const reqs = await ursService.getRequests();
                setRequests(reqs);
            } catch (error) {
                console.error("Error polling inbox list:", error);
            }
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const formatDateTime = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) {
            return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('es-CL', { 
            day: '2-digit', 
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(',', '');
    };

    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const isMine = Number(req.id_solicitante) === Number(user?.id);
            if (ursInboxMode === 'SENT' && !isMine) return false;
            if (ursInboxMode === 'RECEIVED' && isMine) return false;

            const matchesSearch = (req.titulo || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                   (req.nombre_solicitante || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                   req.id_solicitud.toString().includes(searchTerm);
            
            const matchesStatus = !filter.status || req.estado === filter.status;
            const matchesArea = !filter.area || req.area_destino === filter.area;
            const matchesType = !filter.type || req.nombre_tipo === filter.type;

            return matchesSearch && matchesStatus && matchesArea && matchesType;
        });
    }, [requests, searchTerm, filter, ursInboxMode, user]);

    const groupedRequests = useMemo(() => {
        const groups: { [key: string]: Request[] } = {};
        filteredRequests.forEach(req => {
            const date = new Date(req.fecha_solicitud);
            const today = new Date();
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            let group = 'Más antiguas';
            if (date.toDateString() === today.toDateString()) group = 'Hoy';
            else if (date.toDateString() === yesterday.toDateString()) group = 'Ayer';
            else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) group = 'Esta semana';

            if (!groups[group]) groups[group] = [];
            groups[group].push(req);
        });
        return groups;
    }, [filteredRequests]);

    return (
        <Box h={{ base: 'calc(100dvh - 100px)', lg: 'calc(100dvh - var(--app-shell-header-height, 0px))' }} bg="white" style={{ overflow: 'hidden' }}>
            <Flex direction={{ base: 'column', md: 'row' }} h="100%" align="stretch" style={{ flexWrap: 'nowrap' }}>
                {/* COLUMN 1: INBOX LIST - Hide on mobile if a request is selected */}
                {(!isMobile || !selectedRequestId) && (
                    <Box 
                        flex={{ base: '1', md: '0 0 21%' }} 
                        h="100%"
                        style={{ 
                            borderRight: isMobile ? 'none' : '1px solid var(--mantine-color-gray-2)', 
                            display: 'flex', 
                            flexDirection: 'column',
                            minWidth: 0
                        }}
                    >
                        {/* Header/Filters Section (Fixed) */}
                        <Stack px="md" py="md" gap="md" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                            <Group justify="space-between">
                                <Title order={4}>Solicitudes</Title>
                                <ActionIcon 
                                    variant="filled" 
                                    color="adl-blue" 
                                    size="md" 
                                    radius="md" 
                                    onClick={() => setActiveSubmodule('urs-new-request')}
                                >
                                    <IconPlus size={18} />
                                </ActionIcon>
                            </Group>

                            <SegmentedControl 
                                fullWidth
                                value={ursInboxMode}
                                onChange={(val) => setUrsInboxMode(val as 'RECEIVED' | 'SENT')}
                                data={[
                                    { label: 'Recibidas', value: 'RECEIVED' },
                                    { label: 'Enviadas', value: 'SENT' }
                                ]}
                                color="adl-blue"
                                radius="md"
                            />

                            <TextInput 
                                placeholder="Buscar..."
                                leftSection={<IconSearch size={16} color="var(--mantine-color-gray-5)" />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                radius="md"
                            />

                            <Group grow gap="xs">
                                <Select 
                                    label="Estado"
                                    placeholder="Seleccionar"
                                    value={filter.status}
                                    onChange={(val) => setFilter({...filter, status: val || ''})}
                                    data={[
                                        { value: '', label: 'Todos' },
                                        { value: 'PENDIENTE', label: 'Pendientes' },
                                        { value: 'EN_REVISION', label: 'En Revisión' },
                                        { value: 'ACEPTADA', label: 'Aceptadas' },
                                        { value: 'REALIZADA', label: 'Realizadas' },
                                        { value: 'RECHAZADA', label: 'Rechazadas' }
                                    ]}
                                    size="xs"
                                    radius="md"
                                />
                                <Select 
                                    label="Área"
                                    placeholder="Seleccionar"
                                    value={filter.area}
                                    onChange={(val) => setFilter({...filter, area: val || ''})}
                                    data={[
                                        { value: '', label: 'Todas' },
                                        { value: 'INF', label: 'Informática' },
                                        { value: 'GC', label: 'Calidad' }
                                    ]}
                                    size="xs"
                                    radius="md"
                                />
                            </Group>
                        </Stack>

                        {/* Scrollable list Section */}
                        <ScrollArea flex={1} px="xs" py="xs">
                            {loading ? (
                                <Center py="xl">
                                    <Loader size="sm" color="adl-blue" />
                                </Center>
                            ) : filteredRequests.length > 0 ? (
                                ['Hoy', 'Ayer', 'Esta semana', 'Más antiguas'].map(label => {
                                    const groupReqs = groupedRequests[label];
                                    if (!groupReqs || groupReqs.length === 0) return null;
                                    return (
                                        <Stack key={label} gap="xs" mb="lg">
                                            <Text size="xs" fw={800} c="dimmed" tt="uppercase" lts="1px" px="xs">
                                                {label}
                                            </Text>
                                            {groupReqs.map((req) => {
                                                const isActive = selectedRequestId === req.id_solicitud;
                                                const unread = (req.unread_count || 0) > 0;
                                                const isMine = Number(req.id_solicitante) === Number(user?.id);
                                                
                                                return (
                                                    <UnstyledButton
                                                        key={req.id_solicitud}
                                                        ref={el => { itemRefs.current[req.id_solicitud] = el; }}
                                                        onClick={() => setSelectedRequestId(req.id_solicitud)}
                                                        p="sm"
                                                        style={{
                                                            borderRadius: 'var(--mantine-radius-md)',
                                                            backgroundColor: isActive ? 'var(--mantine-color-adl-blue-0)' : 'transparent',
                                                            border: isActive ? '1px solid var(--mantine-color-adl-blue-2)' : '1px solid transparent',
                                                            transition: 'all 150ms ease'
                                                        }}
                                                    >
                                                        <Stack gap={4}>
                                                            <Group justify="space-between" align="start" wrap="nowrap">
                                                                <Group gap={6}>
                                                                    <Badge size="xs" color="gray" variant="light">#{req.id_solicitud}</Badge>
                                                                    {!isMine && (
                                                                        <Text size="xs" fw={700} c="adl-blue">
                                                                            {req.nombre_solicitante?.split(' ')[0]}
                                                                        </Text>
                                                                    )}
                                                                </Group>
                                                                <Text size="xs" c="dimmed">
                                                                    {formatDateTime(req.fecha_solicitud)}
                                                                </Text>
                                                            </Group>
                                                            
                                                            <Text size="sm" fw={unread ? 800 : 600} truncate lineClamp={2} c="dark.4">
                                                                {req.titulo || req.nombre_tipo}
                                                            </Text>
                                                            
                                                            <Group justify="space-between" align="center">
                                                                <Group gap={6}>
                                                                    <StatusBadge status={req.estado} size="xs" />
                                                                    {unread && <IconCircleFilled size={10} color="var(--mantine-color-red-6)" />}
                                                                </Group>
                                                                <IconChevronRight size={14} color="var(--mantine-color-gray-4)" />
                                                            </Group>
                                                        </Stack>
                                                    </UnstyledButton>
                                                );
                                            })}
                                        </Stack>
                                    );
                                })
                            ) : (
                                <Center py={100}>
                                    <Stack align="center" gap="xs">
                                        <IconFolderOpen size={40} color="var(--mantine-color-gray-3)" stroke={1} />
                                        <Text size="sm" c="dimmed">No hay solicitudes.</Text>
                                    </Stack>
                                </Center>
                            )}
                        </ScrollArea>
                    </Box>
                )}

                {/* COLUMN 2: DETAILS - Show on dynamic basis on mobile */}
                {(!isMobile || selectedRequestId) && (
                    <Box 
                        flex={{ base: '1', md: '0 0 54%' }}
                        h="100%"
                        style={{ 
                            borderRight: isMobile ? 'none' : '1px solid var(--mantine-color-gray-2)', 
                            backgroundColor: 'white', 
                            display: 'flex', 
                            flexDirection: 'column',
                            minWidth: 0
                        }}
                    >
                        {/* Mobile Header for Details */}
                        {isMobile && selectedRequestId && (
                            <Paper p="sm" withBorder radius={0} style={{ borderTop: 0, borderLeft: 0, borderRight: 0 }}>
                                <Group justify="space-between" align="center">
                                    <Group gap="xs">
                                        <ActionIcon variant="light" color="gray" onClick={() => setSelectedRequestId(null)}>
                                            <IconArrowLeft size={18} />
                                        </ActionIcon>
                                        <Text fw={800} size="sm">Detalle de Solicitud</Text>
                                    </Group>
                                    <Badge variant="outline" color="gray" size="sm">#{selectedRequestId}</Badge>
                                </Group>
                            </Paper>
                        )}

                        {loadingDetail ? (
                            <Center h="100%">
                                <Stack align="center" gap="md">
                                    <Loader size="md" color="adl-blue" />
                                    <Text size="sm" c="dimmed">Abriendo solicitud...</Text>
                                </Stack>
                            </Center>
                        ) : selectedRequest ? (
                            <ScrollArea flex={1} scrollbars="y">
                                <Box p="lg">
                                    <RequestDetailPanel 
                                        request={selectedRequest} 
                                        onRequestUpdate={loadInitialData}
                                        onReload={() => loadRequestDetail(selectedRequestId!, true)}
                                    />
                                </Box>
                                
                                {/* On Mobile, Activity section appears at bottom of flow */}
                                {isMobile && (
                                    <>
                                        <Box p="xs" bg="gray.1">
                                            <Text size="xs" fw={800} c="dimmed" tt="uppercase">Actividad y Chat</Text>
                                        </Box>
                                        <Box p="sm">
                                            <RequestActivityAndChat 
                                                request={selectedRequest} 
                                                onReload={() => loadRequestDetail(selectedRequestId!, true)}
                                            />
                                        </Box>
                                    </>
                                )}
                            </ScrollArea>
                        ) : (
                            <Center h="100%">
                                <Stack align="center" gap="sm">
                                    <IconCalendar size={48} color="var(--mantine-color-gray-3)" stroke={1} />
                                    <Title order={4} c="dimmed">Selecciona una solicitud</Title>
                                    <Text size="sm" c="dimmed">Haz clic en la lista para ver detalles.</Text>
                                </Stack>
                            </Center>
                        )}
                    </Box>
                )}

                {/* COLUMN 3: ACTIVITY & CHAT (Desktop only or specific layout) */}
                {!isMobile && (
                    <Box 
                        flex="0 0 25%"
                        h="100%"
                        style={{ 
                            display: 'flex', 
                            flexDirection: 'column',
                            minWidth: 0
                        }}
                    >
                        <Box flex={1} style={{ overflow: 'hidden' }}>
                            {selectedRequest ? (
                                <RequestActivityAndChat 
                                    request={selectedRequest} 
                                    onReload={() => loadRequestDetail(selectedRequestId!, true)}
                                />
                            ) : (
                                <Center h="100%">
                                    <IconClock size={40} color="var(--mantine-color-gray-2)" />
                                </Center>
                            )}
                        </Box>
                    </Box>
                )}
            </Flex>
        </Box>
    );
};

export default UniversalInbox;
