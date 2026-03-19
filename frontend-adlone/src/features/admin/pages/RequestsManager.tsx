import React, { useState, useEffect, useMemo } from 'react';
import {
    Container,
    Paper,
    Title,
    Text,
    Button,
    Group,
    Table,
    Badge,
    Loader,
    Stack,
    TextInput,
    Box,
    Flex,
    Avatar
} from '@mantine/core';
import {
    IconFileText,
    IconSearch,
    IconSettings,
    IconChevronRight
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';

interface RequestType {
    id_tipo: number;
    nombre: string;
    descripcion?: string;
    area_destino: string;
    estado: boolean;
}

interface RequestsManagerProps {
    onBack?: () => void;
    onConfigureType?: (type: RequestType) => void;
}

export const RequestsManager: React.FC<RequestsManagerProps> = ({ onConfigureType }) => {
    const { showToast } = useToast();
    
    const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
    const [loading, setLoading] = useState(true);
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
            showToast({ type: 'error', message: 'Error al cargar tipos de solicitud' });
        } finally {
            setLoading(false);
        }
    };

    const filteredTypes = useMemo(() => 
        requestTypes.filter(t => 
            t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.area_destino.toLowerCase().includes(searchTerm.toLowerCase())
        ), [requestTypes, searchTerm]);

    if (loading) {
        return (
            <Flex direction="column" align="center" justify="center" h="100%" gap="md">
                <Loader size="xl" color="adl-blue.6" />
                <Text size="sm" c="dimmed" fw={600}>Cargando trámites...</Text>
            </Flex>
        );
    }

    return (
        <Container size="xl" py="md" bg="#f8fafc" h="100%" style={{ minHeight: '100vh' }}>
            <Stack gap="lg">
                {/* Header Page */}
                <Paper withBorder p="md" radius="lg" shadow="sm">
                    <Group justify="space-between">
                        <Box>
                            <Title order={4} fw={800} c="dark.4">Gestión de Trámites y Solicitudes</Title>
                            <Text size="xs" c="dimmed" fw={500}>Selecciona un trámite para configurar sus permisos de acceso y roles.</Text>
                        </Box>
                        <TextInput 
                            placeholder="Buscar trámite..." 
                            leftSection={<IconSearch size={16} color="#94a3b8" />}
                            size="sm"
                            radius="md"
                            w={280}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.currentTarget.value)}
                        />
                    </Group>
                </Paper>

                {/* List View with Paper and Table */}
                <Paper withBorder radius="lg" shadow="sm" style={{ overflow: 'hidden' }}>
                    <Table verticalSpacing="md" horizontalSpacing="lg" highlightOnHover>
                        <Table.Thead bg="gray.0">
                            <Table.Tr>
                                <Table.Th>
                                    <Text size="xs" fw={700} tt="uppercase" lts="0.05em" c="gray.6">Tipo de Trámite</Text>
                                </Table.Th>
                                <Table.Th>
                                    <Text size="xs" fw={700} tt="uppercase" lts="0.05em" c="gray.6">Área Responsable</Text>
                                </Table.Th>
                                <Table.Th style={{ textAlign: 'center' }}>
                                    <Text size="xs" fw={700} tt="uppercase" lts="0.05em" c="gray.6">Estado</Text>
                                </Table.Th>
                                <Table.Th style={{ width: 150 }} />
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {filteredTypes.length === 0 ? (
                                <Table.Tr>
                                    <Table.Td colSpan={4} py={60}>
                                        <Stack align="center" gap="xs">
                                            <IconFileText size={40} style={{ opacity: 0.2 }} />
                                            <Text fw={600} size="sm" c="dimmed">Sin trámites encontrados</Text>
                                        </Stack>
                                    </Table.Td>
                                </Table.Tr>
                            ) : filteredTypes.map(type => (
                                <Table.Tr key={type.id_tipo}>
                                    <Table.Td>
                                        <Group gap="sm">
                                            <Avatar 
                                                radius="md" 
                                                color="adl-blue.6" 
                                                variant="light"
                                                size={36}
                                            >
                                                <IconFileText size={20} />
                                            </Avatar>
                                            <Text size="sm" fw={700} c="dark.4">{type.nombre}</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge variant="light" color="gray" radius="sm" fw={700} size="sm">
                                            {type.area_destino}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td style={{ textAlign: 'center' }}>
                                        <Badge 
                                            variant="dot" 
                                            color={type.estado ? 'teal' : 'red'} 
                                            fw={800} 
                                            size="sm"
                                        >
                                            {type.estado ? 'ACTIVO' : 'INACTIVO'}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Button 
                                            variant="light" 
                                            color="adl-blue.6"
                                            radius="md"
                                            size="xs"
                                            fullWidth
                                            leftSection={<IconSettings size={14} />}
                                            rightSection={<IconChevronRight size={14} />}
                                            onClick={() => onConfigureType?.(type)}
                                        >
                                            Configurar
                                        </Button>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                </Paper>
            </Stack>
        </Container>
    );
};
