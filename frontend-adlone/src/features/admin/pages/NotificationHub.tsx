import React, { useState, useEffect } from 'react';
import {
    Grid,
    Stack,
    Group,
    Paper,
    Text,
    TextInput,
    ActionIcon,
    Loader,
    NavLink,
    Box,
    Center,
    Title,
    Accordion,
    ThemeIcon,
    Transition,
    Tooltip,
    Badge,
    useMantineTheme
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
    IconLayoutDashboard,
    IconChevronRight,
    IconBell,
    IconSearch,
    IconRefresh,
    IconShield,
    IconLeaf,
    IconUserCircle,
    IconServer,
    IconBolt,
    IconLayoutGrid
} from '@tabler/icons-react';
import { notificationService } from '../../../services/notification.service';
import { useToast } from '../../../contexts/ToastContext';
import { EventRow } from '../components/notifications/EventRow';
import { RecipientModal } from '../components/notifications/RecipientModal';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Module {
    id: string | number;
    nombre: string;
    icono?: string;
    funcionalidades: Funcionalidad[];
}

interface Funcionalidad {
    id: number;
    nombre: string;
    eventos: any[];
}

export const NotificationHub: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
    const { showToast } = useToast();
    const [catalog, setCatalog] = useState<Module[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeModuleId, setActiveModuleId] = useState<string | number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        loadCatalog();
    }, []);

    const loadCatalog = async () => {
        try {
            setLoading(true);
            const data = await notificationService.getNotificationCatalog();
            
            const processedModules: Module[] = [];
            let dynamicEvents: any[] = [];
            
            data.forEach((mod: any) => {
                const cleanMod = { ...mod, funcionalidades: [] };
                mod.funcionalidades.forEach((func: any) => {
                    const normalEvents: any[] = [];
                    func.eventos.forEach((ev: any) => {
                        if (ev.es_transaccional) {
                            dynamicEvents.push(ev);
                        } else {
                            normalEvents.push(ev);
                        }
                    });
                    if (normalEvents.length > 0) {
                        cleanMod.funcionalidades.push({ ...func, eventos: normalEvents });
                    }
                });
                if (cleanMod.funcionalidades.length > 0) {
                    processedModules.push(cleanMod);
                }
            });
            
            if (dynamicEvents.length > 0) {
                processedModules.push({
                    id: 'dynamic-events',
                    nombre: 'Eventos Dinámicos',
                    icono: 'zap',
                    funcionalidades: [
                        {
                            id: 999999,
                            nombre: 'Notificaciones Transaccionales',
                            eventos: dynamicEvents
                        }
                    ]
                });
            }

            setCatalog(processedModules);

            if (processedModules.length > 0 && !activeModuleId) {
                setActiveModuleId(processedModules[0].id || processedModules[0].nombre);
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar el catálogo de notificaciones' });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenSettings = (event: any) => {
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const activeModule = catalog.find(m => (m.id || m.nombre) === activeModuleId);

    const filteredFuncionalidades = activeModule ? activeModule.funcionalidades.map(func => {
        const filteredEvents = func.eventos.filter(ev =>
            (ev.descripcion || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (ev.codigo || ev.codigo_evento || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

        return {
            ...func,
            eventos: filteredEvents,
            matchesName: (func.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
        };
    }).filter(func => func.eventos.length > 0 || func.matchesName) : [];

    const getModuleIcon = (name: string, isActive?: boolean) => {
        const n = name.toUpperCase();
        const iconSize = 18;
        const color = isActive ? 'var(--mantine-color-white)' : 'var(--mantine-color-adl-blue-6)';
        
        if (n.includes('DINÁMICOS')) return <IconBolt size={iconSize} color={color} />;
        if (n.includes('MEDIO') || n.includes('AMBIENTE')) return <IconLeaf size={iconSize} color={color} />;
        if (n.includes('ADMIN') || n.includes('SISTEMA')) return <IconShield size={iconSize} color={color} />;
        if (n.includes('USUARIO')) return <IconUserCircle size={iconSize} color={color} />;
        return <IconServer size={iconSize} color={color} />;
    };

    return (
        <Stack gap="lg" align="stretch">
            <PageHeader 
                title="Hub de Notificaciones"
                subtitle="Administre destinatarios y canales de alerta para todo el sistema."
                onBack={onBack}
                rightSection={
                    <Group gap="sm" wrap={isMobile ? "wrap" : "nowrap"} style={{ flex: 1 }}>
                        <TextInput 
                            placeholder="Buscar evento o sección..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            leftSection={<IconSearch size={16} color="var(--mantine-color-gray-5)" />}
                            w={isMobile ? "100%" : 300}
                        />
                        <Tooltip label="Refrescar catálogo">
                            <ActionIcon 
                                variant="light" 
                                color="adl-blue" 
                                size="lg" 
                                onClick={loadCatalog}
                                loading={loading && catalog.length > 0}
                            >
                                <IconRefresh size={18} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>
                }
            />

            {loading && catalog.length === 0 ? (
                <Center h={400}>
                    <Stack align="center" gap="md">
                        <Loader size="xl" type="bars" color="adl-blue" />
                        <Text size="sm" c="dimmed">Sincronizando catálogo universal...</Text>
                    </Stack>
                </Center>
            ) : (
                <Grid gutter="xl">
                    {/* Navigation sidebar */}
                    <Grid.Col span={{ base: 12, md: 3 }}>
                        <Paper p="md" bg="gray.0" radius="lg">
                            <Text size="xs" fw={800} c="dimmed" tt="uppercase" lts="1px" mb="md" px="xs">
                                Módulos del Sistema
                            </Text>
                            <Stack gap={4}>
                                {catalog.map(mod => {
                                    const modId = mod.id || mod.nombre;
                                    const isActive = activeModuleId === modId;
                                    return (
                                        <NavLink
                                            key={modId}
                                            label={mod.nombre}
                                            active={isActive}
                                            onClick={() => {
                                                setActiveModuleId(modId);
                                                setSearchTerm('');
                                            }}
                                            leftSection={
                                                <ThemeIcon 
                                                    variant={isActive ? 'filled' : 'light'} 
                                                    color={isActive ? 'adl-blue' : 'gray'}
                                                    size="sm"
                                                    radius="md"
                                                >
                                                    {getModuleIcon(mod.nombre, isActive)}
                                                </ThemeIcon>
                                            }
                                            rightSection={isActive && <IconChevronRight size={14} />}
                                            styles={{
                                                root: {
                                                    borderRadius: 'var(--mantine-radius-md)',
                                                    fontWeight: 600,
                                                    transition: 'all 200ms ease'
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    {/* Main content area */}
                    <Grid.Col span={{ base: 12, md: 9 }}>
                        {activeModule ? (
                            <Transition transition="fade" mounted={!!activeModule} duration={400}>
                                {(styles) => (
                                    <div style={styles}>
                                        <Stack gap="xl">
                                            <Box>
                                                <Group align="center" gap="xs">
                                                    <IconLayoutGrid size={24} color="var(--mantine-color-adl-blue-6)" />
                                                    <Title order={3}>{activeModule.nombre}</Title>
                                                </Group>
                                                <Text size="sm" c="dimmed">
                                                    {searchTerm ? `Resultados de búsqueda en "${activeModule.nombre}"` : `${activeModule.funcionalidades.length} funcionalidades configuradas.`}
                                                </Text>
                                            </Box>

                                            {filteredFuncionalidades.length === 0 ? (
                                                <Paper p="xl" style={{ borderStyle: 'dashed', textAlign: 'center' }}>
                                                    <Text c="dimmed">No se encontraron eventos coincidentes.</Text>
                                                </Paper>
                                            ) : (
                                                <Accordion 
                                                    variant="separated" 
                                                    radius="lg" 
                                                    chevronPosition="right"
                                                    styles={{
                                                        item: { border: '1px solid var(--mantine-color-gray-2)' },
                                                        control: { padding: 'var(--mantine-spacing-md) var(--mantine-spacing-lg)' },
                                                        content: { padding: '0 var(--mantine-spacing-lg) var(--mantine-spacing-lg) var(--mantine-spacing-lg)' }
                                                    }}
                                                >
                                                    {filteredFuncionalidades.map(func => (
                                                        <Accordion.Item key={func.id} value={String(func.id)}>
                                                            <Accordion.Control
                                                                icon={
                                                                    <ThemeIcon variant="light" color="adl-blue" size="md" radius="md">
                                                                        <IconLayoutDashboard size={18} />
                                                                    </ThemeIcon>
                                                                }
                                                            >
                                                                <Group justify="space-between" pr="md">
                                                                    <Text fw={700} size="md">{func.nombre}</Text>
                                                                    <Badge variant="dot" color="gray" size="sm">{func.eventos.length} eventos</Badge>
                                                                </Group>
                                                            </Accordion.Control>
                                                            <Accordion.Panel>
                                                                <Box pt="md">
                                                                    {func.eventos.map((ev: any) => (
                                                                        <EventRow
                                                                            key={ev.id}
                                                                            event={ev}
                                                                            onOpenSettings={handleOpenSettings}
                                                                            onStatusChange={loadCatalog}
                                                                        />
                                                                    ))}
                                                                </Box>
                                                            </Accordion.Panel>
                                                        </Accordion.Item>
                                                    ))}
                                                </Accordion>
                                            )}
                                        </Stack>
                                    </div>
                                )}
                            </Transition>
                        ) : (
                            <Paper h={400} bg="gray.0" radius="lg">
                                <Center h="100%">
                                    <Stack align="center" gap="xs">
                                        <IconBell size={48} color="var(--mantine-color-gray-4)" stroke={1} />
                                        <Text c="dimmed">Seleccione un módulo para comenzar la configuración.</Text>
                                    </Stack>
                                </Center>
                            </Paper>
                        )}
                    </Grid.Col>
                </Grid>
            )}

            <RecipientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                event={selectedEvent}
                onSaved={loadCatalog}
            />
        </Stack>
    );
};