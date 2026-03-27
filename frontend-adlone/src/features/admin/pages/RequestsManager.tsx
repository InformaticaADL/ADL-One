import React, { useState, useEffect, useMemo } from 'react';
import {
    Paper,
    Text,
    Button,
    Group,
    Table,
    Badge,
    Stack,
    TextInput,
    Box,
    Avatar,
    ScrollArea,
    ActionIcon,
    Tooltip,
    Center,
    useMantineTheme,
    LoadingOverlay
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
    IconFileText,
    IconSearch,
    IconSettings,
    IconChevronRight,
    IconPower,
    IconCheck,
    IconX,
    IconInfoCircle
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface RequestType {
    id_tipo: number;
    nombre: string;
    descripcion?: string;
    area_destino: string;
    estado: boolean;
}

interface RequestsManagerProps {
    onBack: () => void;
    onConfigureType: (type: RequestType) => void;
}

export const RequestsManager: React.FC<RequestsManagerProps> = ({ onBack, onConfigureType }) => {
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
    const { showToast } = useToast();
    
    const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const types = await ursService.getRequestTypes(true);
            setRequestTypes(types);
        } catch (error) {
            console.error('Error loading request types:', error);
            showToast({ type: 'error', message: 'Error al cargar tipos de solicitud' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (type: RequestType) => {
        try {
            setActionLoading(type.id_tipo);
            await (ursService as any).toggleTypeStatus(type.id_tipo, !type.estado);
            showToast({ 
                type: 'success', 
                message: `Trámite ${!type.estado ? 'habilitado' : 'deshabilitado'} correctamente` 
            });
            await loadData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cambiar estado del trámite' });
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTypes = useMemo(() => 
        requestTypes.filter(t => 
            t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.area_destino.toLowerCase().includes(searchTerm.toLowerCase())
        ), [requestTypes, searchTerm]);

    return (
        <Box p={isMobile ? "xs" : "md"} style={{ width: '100%' }}>
            <PageHeader 
                title="Administración de Solicitudes"
                subtitle="Gestiona quién puede enviar y administrar los trámites URS."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Solicitudes URS' }
                ]}
                rightSection={
                    <TextInput 
                        placeholder="Buscar..." 
                        leftSection={<IconSearch size={16} />}
                        radius="md"
                        w={isMobile ? "100%" : 300}
                        mt={isMobile ? "md" : 0}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.currentTarget.value)}
                    />
                }
            />

            <Stack gap="lg" mt="xl" pos="relative">
                <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />

                {isMobile ? (
                    <Stack gap="sm">
                        {filteredTypes.length > 0 ? (
                            filteredTypes.map((type) => (
                                <Paper key={type.id_tipo} withBorder p="md" radius="md" shadow="xs">
                                    <Group justify="space-between" align="flex-start" mb="md" wrap="nowrap">
                                        <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                            <Avatar radius="md" color="blue" variant="light" size={40}>
                                                <IconFileText size={24} />
                                            </Avatar>
                                            <Box style={{ flex: 1, minWidth: 0 }}>
                                                <Text size="sm" fw={700} truncate>{type.nombre}</Text>
                                                <Text size="xs" c="dimmed">ID: {type.id_tipo}</Text>
                                            </Box>
                                        </Group>
                                        <Badge 
                                            variant="light" 
                                            size="xs"
                                            color={type.estado ? 'teal' : 'red'} 
                                            leftSection={type.estado ? <IconCheck size={10} /> : <IconX size={10} />}
                                        >
                                            {type.estado ? 'ACTIVO' : 'INACTIVO'}
                                        </Badge>
                                    </Group>

                                    <Group justify="space-between" align="center">
                                        <Badge variant="dot" color="blue" radius="sm">
                                            {type.area_destino}
                                        </Badge>
                                        <Group gap="xs">
                                            <ActionIcon 
                                                variant="light" 
                                                color={type.estado ? 'red' : 'teal'} 
                                                onClick={() => handleToggleStatus(type)}
                                                loading={actionLoading === type.id_tipo}
                                                size="md"
                                            >
                                                <IconPower size={18} />
                                            </ActionIcon>
                                            <Button 
                                                variant="filled" 
                                                color="blue"
                                                radius="md"
                                                size="xs"
                                                leftSection={<IconSettings size={14} />}
                                                onClick={() => onConfigureType(type)}
                                            >
                                                Configurar
                                            </Button>
                                        </Group>
                                    </Group>
                                </Paper>
                            ))
                        ) : (
                            <Paper withBorder p="xl" radius="md" ta="center">
                                <Text c="dimmed">No se encontraron trámites</Text>
                            </Paper>
                        )}
                    </Stack>
                ) : (
                    <Paper withBorder radius="md" p={0} style={{ overflow: 'hidden' }} shadow="sm">
                        <ScrollArea h={600}>
                            <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
                                <Table.Thead bg="gray.0" style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'var(--mantine-color-gray-0)' }}>
                                    <Table.Tr>
                                        <Table.Th>Tipo de Trámite</Table.Th>
                                        <Table.Th>Área Responsable</Table.Th>
                                        <Table.Th style={{ textAlign: 'center' }}>Estado</Table.Th>
                                        <Table.Th style={{ textAlign: 'right' }}>Acciones</Table.Th>
                                    </Table.Tr>
                                </Table.Thead>
                                <Table.Tbody>
                                    {filteredTypes.length === 0 && !loading ? (
                                        <Table.Tr>
                                            <Table.Td colSpan={4}>
                                                <Center py={100}>
                                                    <Stack align="center" gap="xs">
                                                        <IconFileText size={48} color="var(--mantine-color-gray-3)" />
                                                        <Text fw={600} c="dimmed">No se encontraron trámites</Text>
                                                    </Stack>
                                                </Center>
                                            </Table.Td>
                                        </Table.Tr>
                                    ) : filteredTypes.map(type => (
                                        <Table.Tr key={type.id_tipo}>
                                            <Table.Td>
                                                <Group gap="sm">
                                                    <Avatar 
                                                        radius="md" 
                                                        color="blue" 
                                                        variant="light"
                                                        size={40}
                                                    >
                                                        <IconFileText size={24} />
                                                    </Avatar>
                                                    <Stack gap={0}>
                                                        <Text size="sm" fw={700}>{type.nombre}</Text>
                                                        <Text size="xs" c="dimmed">ID: {type.id_tipo}</Text>
                                                    </Stack>
                                                </Group>
                                            </Table.Td>
                                            <Table.Td>
                                                <Badge variant="dot" color="blue" radius="sm">
                                                    {type.area_destino}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td style={{ textAlign: 'center' }}>
                                                <Badge 
                                                    variant="light" 
                                                    color={type.estado ? 'teal' : 'red'} 
                                                    leftSection={type.estado ? <IconCheck size={10} /> : <IconX size={10} />}
                                                >
                                                    {type.estado ? 'ACTIVO' : 'INACTIVO'}
                                                </Badge>
                                            </Table.Td>
                                            <Table.Td>
                                                <Group gap="sm" justify="flex-end">
                                                    <Tooltip label={type.estado ? 'Deshabilitar trámite' : 'Habilitar trámite'}>
                                                        <ActionIcon 
                                                            variant="light" 
                                                            color={type.estado ? 'red' : 'teal'} 
                                                            onClick={() => handleToggleStatus(type)}
                                                            loading={actionLoading === type.id_tipo}
                                                        >
                                                            <IconPower size={18} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                    <Button 
                                                        variant="filled" 
                                                        color="blue"
                                                        radius="md"
                                                        size="xs"
                                                        leftSection={<IconSettings size={14} />}
                                                        rightSection={<IconChevronRight size={14} />}
                                                        onClick={() => onConfigureType(type)}
                                                    >
                                                        Configurar Accesos
                                                    </Button>
                                                </Group>
                                            </Table.Td>
                                        </Table.Tr>
                                    ))}
                                </Table.Tbody>
                            </Table>
                        </ScrollArea>
                    </Paper>
                )}

                <Paper withBorder p="md" radius="md" bg="gray.0">
                    <Group gap="xs" wrap="nowrap" align="flex-start">
                        <IconInfoCircle size={20} color="var(--mantine-color-blue-6)" style={{ marginTop: 2, flexShrink: 0 }} />
                        <Box style={{ flex: 1 }}>
                            <Text size="sm" fw={700} mb={4}>Información para Administradores</Text>
                            <Text size="xs" c="dimmed" lh={1.5}>
                                La creación de nuevos tipos de formularios y la edición técnica están reservadas para el equipo de desarrollo. 
                                Desde este panel usted puede controlar <strong>quién tiene permiso para enviar</strong> cada solicitud y 
                                <strong>quién tiene la autoridad para resolverla</strong>.
                            </Text>
                        </Box>
                    </Group>
                </Paper>
            </Stack>
        </Box>
    );
};
