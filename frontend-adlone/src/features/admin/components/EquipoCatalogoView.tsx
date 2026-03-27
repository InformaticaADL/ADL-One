import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Paper, 
    Stack, 
    Group, 
    Title, 
    Text, 
    Button, 
    Table, 
    Badge, 
    ActionIcon, 
    TextInput, 
    LoadingOverlay, 
    SimpleGrid,
    Box,
    Card,
    Tooltip,
    Divider,
    Transition,
    ScrollArea
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconPlus, 
    IconEdit, 
    IconTrash, 
    IconArrowLeft, 
    IconDeviceFloppy, 
    IconX,
    IconSearch,
    IconListNumbers
} from '@tabler/icons-react';
import { equipoService } from '../services/equipo.service';
import { useToast } from '../../../contexts/ToastContext';

interface CatalogItem {
    id_equipocatalogo?: number;
    nombre: string;
    que_mide: string;
    unidad_medida_textual: string;
    unidad_medida_sigla: string;
    tipo_equipo: string;
}

interface Props {
    onBack: () => void;
}

export const EquipoCatalogoView: React.FC<Props> = ({ onBack }) => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<CatalogItem>({
        nombre: '',
        que_mide: '',
        unidad_medida_textual: '',
        unidad_medida_sigla: '',
        tipo_equipo: ''
    });
    const [isSiglaManual, setIsSiglaManual] = useState(false);

    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await equipoService.getEquipoCatalogo();
            if (res.success) {
                setItems(res.data);
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
            showToast({ type: 'error', message: 'Error al cargar el catálogo' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const autoGenerateSigla = (text: string) => {
        if (!text) return '';
        return text.split(',')
            .map(part => part.trim()
                .replace(/^(Unid\. de |Unidades de |Grados |de |en )/i, '')
            )
            .filter(part => part.length > 0)
            .join('/');
    };

    useEffect(() => {
        if (showForm && !isSiglaManual) {
            const suggestedSigla = autoGenerateSigla(formData.unidad_medida_textual);
            setFormData(prev => ({ ...prev, unidad_medida_sigla: suggestedSigla }));
        }
    }, [formData.unidad_medida_textual, showForm, isSiglaManual]);

    const handleEdit = (item: CatalogItem) => {
        setEditingItem(item);
        setFormData(item);
        setIsSiglaManual(true);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este elemento del catálogo?')) return;
        
        try {
            const res = await equipoService.deleteEquipoCatalogo(id);
            if (res.success) {
                showToast({ type: 'success', message: 'Elemento eliminado' });
                fetchItems();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast({ type: 'error', message: 'Error al eliminar el elemento' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (editingItem?.id_equipocatalogo) {
                res = await equipoService.updateEquipoCatalogo(editingItem.id_equipocatalogo, formData);
            } else {
                res = await equipoService.createEquipoCatalogo(formData);
            }

            if (res.success) {
                showToast({ 
                    type: 'success', 
                    message: editingItem ? 'Elemento actualizado' : 'Elemento creado' 
                });
                setShowForm(false);
                fetchItems();
            }
        } catch (error) {
            console.error('Error saving item:', error);
            showToast({ type: 'error', message: 'Error al guardar el elemento' });
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item => 
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tipo_equipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.que_mide.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCancel = () => {
        setShowForm(false);
        setEditingItem(null);
        setFormData({ nombre: '', que_mide: '', unidad_medida_textual: '', unidad_medida_sigla: '', tipo_equipo: '' });
        setIsSiglaManual(false);
    };

    return (
        <Container size="xl" py={isMobile ? "xs" : "md"} px={isMobile ? 4 : "md"}>
            <Paper shadow="sm" radius="md" p={{ base: 'md', sm: 'xl' }} withBorder pos="relative">
                <LoadingOverlay visible={loading} overlayProps={{ radius: 'sm', blur: 2 }} zIndex={100} />
                
                <Stack gap="xl">
                    <Group justify="space-between" align="flex-start" wrap="wrap">
                        <Stack gap={4} style={{ flex: 1, minWidth: isMobile ? '100%' : '280px' }}>
                            <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"} justify={isMobile ? "center" : "flex-start"}>
                                <IconListNumbers size={28} color="var(--mantine-primary-color-filled)" style={{ flexShrink: 0 }} />
                                <Title order={2} fw={800} size={isMobile ? "h4" : "h3"} style={{ lineHeight: 1.2, textAlign: isMobile ? 'center' : 'left' }}>
                                    {showForm ? (editingItem ? 'Editar Modelo' : 'Nuevo Modelo de Equipo') : 'Gestión de Catálogo'}
                                </Title>
                            </Group>
                            <Text c="dimmed" size="sm" ta={isMobile ? "center" : "left"}>
                                {showForm 
                                    ? 'Defina los parámetros técnicos del modelo en el catálogo maestro.' 
                                    : 'Administre los modelos autorizados con sus especificaciones detalladas para el inventario.'}
                            </Text>
                        </Stack>

                        <Button 
                            variant="subtle" 
                            color="gray" 
                            leftSection={<IconArrowLeft size={16} />}
                            onClick={showForm ? handleCancel : onBack}
                            size="sm"
                            w={{ base: '100%', sm: 'auto' }}
                        >
                            {showForm ? 'Volver a la lista' : 'Volver al Hub'}
                        </Button>
                    </Group>

                    <Divider />

                    {showForm ? (
                        <Transition mounted={showForm} transition="fade" duration={400} timingFunction="ease">
                            {(styles) => (
                                <Box style={styles}>
                                    <form onSubmit={handleSubmit}>
                                        <Card withBorder radius="md" p={{ base: 'lg', sm: 'xl' }} bg="var(--mantine-color-gray-0)">
                                            <Stack gap="lg">
                                                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                                                    <TextInput
                                                        label="Nombre del Equipo"
                                                        placeholder="Ej: MULTIPARAMETRO"
                                                        required
                                                        value={formData.nombre}
                                                        onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                                        description="Nombre principal que identifica al modelo"
                                                    />
                                                    <TextInput
                                                        label="Tipo de Equipo"
                                                        placeholder="Ej: Sonda, Sensor, Medidor"
                                                        required
                                                        value={formData.tipo_equipo}
                                                        onChange={(e) => setFormData({ ...formData, tipo_equipo: e.target.value })}
                                                        description="Categoría técnica del equipo"
                                                    />
                                                    <TextInput
                                                        label="Qué Mide (Variables)"
                                                        placeholder="Ej: pH, Temperatura, Turbiedad"
                                                        required
                                                        value={formData.que_mide}
                                                        onChange={(e) => setFormData({ ...formData, que_mide: e.target.value })}
                                                        description="Variables que el equipo registra"
                                                    />
                                                    <TextInput
                                                        label="Unidad de Medida (Detallado)"
                                                        placeholder="Ej: Unid. de pH, Grados Celsius, NTU"
                                                        required
                                                        value={formData.unidad_medida_textual}
                                                        onChange={(e) => setFormData({ ...formData, unidad_medida_textual: e.target.value })}
                                                        description="Descripción formal de las unidades"
                                                    />
                                                    <Box>
                                                        <TextInput
                                                            label="Sigla de Unidad (Corta)"
                                                            placeholder="Ej: pH/°C/NTU"
                                                            value={formData.unidad_medida_sigla}
                                                            onChange={(e) => {
                                                                setIsSiglaManual(true);
                                                                setFormData({ ...formData, unidad_medida_sigla: e.target.value });
                                                            }}
                                                            description="Versión abreviada"
                                                            rightSection={isSiglaManual ? (
                                                                <Tooltip label="Editado manualmente">
                                                                    <Text size="xs" c="blue" mr="xs" style={{ cursor: 'help' }}>✍️</Text>
                                                                </Tooltip>
                                                            ) : null}
                                                        />
                                                    </Box>
                                                </SimpleGrid>

                                                <Group justify="flex-end" mt="xl" wrap="wrap-reverse" grow={isMobile}>
                                                    <Button variant="outline" color="gray" onClick={handleCancel} leftSection={<IconX size={16} />} radius="md">
                                                        Cancelar
                                                    </Button>
                                                    <Button type="submit" gradient={{ from: 'indigo', to: 'cyan' }} variant="gradient" leftSection={<IconDeviceFloppy size={18} />} radius="md">
                                                        {editingItem ? 'Actualizar' : 'Registrar'} {isMobile ? '' : 'Modelo'}
                                                    </Button>
                                                </Group>
                                            </Stack>
                                        </Card>
                                    </form>
                                </Box>
                            )}
                        </Transition>
                    ) : (
                        <Transition mounted={!showForm} transition="fade" duration={400} timingFunction="ease">
                            {(styles) => (
                                <Stack style={styles} gap="md">
                                        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm" style={{ width: '100%' }}>
                                            <TextInput
                                                placeholder="Buscar por nombre, tipo o variable..."
                                                leftSection={<IconSearch size={16} />}
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                                variant="filled"
                                                radius="md"
                                                size={isMobile ? "md" : "sm"}
                                            />
                                            <Button 
                                                leftSection={<IconPlus size={18} />} 
                                                onClick={() => setShowForm(true)}
                                                radius="md"
                                                variant="filled"
                                                color="dark"
                                                size={isMobile ? "md" : "sm"}
                                            >
                                                Agregar Nuevo Modelo
                                            </Button>
                                        </SimpleGrid>

                                    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
                                        {!isMobile ? (
                                            <ScrollArea h={650} type="auto" offsetScrollbars>
                                                <Table verticalSpacing="sm" highlightOnHover striped style={{ minWidth: 800 }}>
                                                    <Table.Thead bg="var(--mantine-color-gray-0)">
                                                        <Table.Tr>
                                                            <Table.Th>Nombre</Table.Th>
                                                            <Table.Th>Tipo</Table.Th>
                                                            <Table.Th>Qué Mide</Table.Th>
                                                            <Table.Th>Sigla</Table.Th>
                                                            <Table.Th align="right" style={{ textAlign: 'right', paddingRight: '2rem' }}>Acciones</Table.Th>
                                                        </Table.Tr>
                                                    </Table.Thead>
                                                    <Table.Tbody>
                                                        {filteredItems.length === 0 ? (
                                                            <Table.Tr>
                                                                <Table.Td colSpan={5} py="xl">
                                                                    <Stack align="center" gap="xs">
                                                                        <Text c="dimmed" size="sm">
                                                                            {loading ? 'Cargando datos...' : (searchTerm ? 'No se encontraron coincidencias.' : 'El catálogo está vacío.')}
                                                                        </Text>
                                                                    </Stack>
                                                                </Table.Td>
                                                            </Table.Tr>
                                                        ) : (
                                                            filteredItems.map((item) => (
                                                                <Table.Tr key={item.id_equipocatalogo}>
                                                                    <Table.Td>
                                                                        <Text fw={700} size="sm">{item.nombre}</Text>
                                                                    </Table.Td>
                                                                    <Table.Td>
                                                                        <Badge variant="light" color="indigo" radius="sm">
                                                                            {item.tipo_equipo}
                                                                        </Badge>
                                                                    </Table.Td>
                                                                    <Table.Td>
                                                                        <Text size="xs" c="dimmed" lineClamp={2} style={{ maxWidth: 300 }}>
                                                                            {item.que_mide}
                                                                        </Text>
                                                                    </Table.Td>
                                                                    <Table.Td>
                                                                        <Badge variant="outline" color="gray" radius="sm">
                                                                            {item.unidad_medida_sigla || 'N/A'}
                                                                        </Badge>
                                                                    </Table.Td>
                                                                    <Table.Td>
                                                                        <Group gap="xs" justify="flex-end" wrap="nowrap">
                                                                            <Tooltip label="Editar detalles">
                                                                                <ActionIcon 
                                                                                    variant="light" 
                                                                                    color="blue" 
                                                                                    onClick={() => handleEdit(item)}
                                                                                    radius="md"
                                                                                >
                                                                                    <IconEdit size={16} />
                                                                                </ActionIcon>
                                                                            </Tooltip>
                                                                            <Tooltip label="Eliminar del catálogo">
                                                                                <ActionIcon 
                                                                                    variant="light" 
                                                                                    color="red" 
                                                                                    onClick={() => handleDelete(item.id_equipocatalogo!)}
                                                                                    radius="md"
                                                                                >
                                                                                    <IconTrash size={16} />
                                                                                </ActionIcon>
                                                                            </Tooltip>
                                                                        </Group>
                                                                    </Table.Td>
                                                                </Table.Tr>
                                                            ))
                                                        )}
                                                    </Table.Tbody>
                                                </Table>
                                            </ScrollArea>
                                        ) : (
                                            <Stack gap="sm" p="sm">
                                                {filteredItems.length === 0 ? (
                                                    <Box py="xl" ta="center">
                                                        <Text c="dimmed" size="sm">
                                                            {loading ? 'Cargando datos...' : (searchTerm ? 'No se encontraron coincidencias.' : 'El catálogo está vacío.')}
                                                        </Text>
                                                    </Box>
                                                ) : (
                                                    filteredItems.map((item) => (
                                                        <Paper key={item.id_equipocatalogo} withBorder p="md" radius="md" bg="var(--mantine-color-gray-0)">
                                                            <Stack gap="xs">
                                                                <Group justify="space-between" wrap="nowrap" align="flex-start">
                                                                    <Box style={{ flex: 1 }}>
                                                                        <Text fw={800} size="md" c="blue.8">{item.nombre}</Text>
                                                                        <Badge variant="light" color="indigo" size="xs" mt={4}>
                                                                            {item.tipo_equipo}
                                                                        </Badge>
                                                                    </Box>
                                                                    <Group gap={6} wrap="nowrap">
                                                                        <ActionIcon 
                                                                            variant="subtle" 
                                                                            color="blue" 
                                                                            onClick={() => handleEdit(item)}
                                                                            radius="md"
                                                                            size="lg"
                                                                        >
                                                                            <IconEdit size={20} />
                                                                        </ActionIcon>
                                                                        <ActionIcon 
                                                                            variant="subtle" 
                                                                            color="red" 
                                                                            onClick={() => handleDelete(item.id_equipocatalogo!)}
                                                                            radius="md"
                                                                            size="lg"
                                                                        >
                                                                            <IconTrash size={20} />
                                                                        </ActionIcon>
                                                                    </Group>
                                                                </Group>
                                                                
                                                                <Divider variant="dashed" />
                                                                
                                                                <Box>
                                                                    <Text size="xs" fw={700} c="dimmed">MIDE:</Text>
                                                                    <Text size="sm">{item.que_mide}</Text>
                                                                </Box>
                                                                
                                                                <Group justify="space-between">
                                                                    <Box>
                                                                        <Text size="xs" fw={700} c="dimmed">SIGLA:</Text>
                                                                        <Badge variant="outline" color="gray" radius="sm">
                                                                            {item.unidad_medida_sigla || 'N/A'}
                                                                        </Badge>
                                                                    </Box>
                                                                    <Box ta="right">
                                                                        <Text size="xs" fw={700} c="dimmed">ID:</Text>
                                                                        <Text size="xs" fw={600}>#{item.id_equipocatalogo}</Text>
                                                                    </Box>
                                                                </Group>
                                                            </Stack>
                                                        </Paper>
                                                    ))
                                                )}
                                            </Stack>
                                        )}
                                    </Paper>
                                    
                                    {!loading && filteredItems.length > 0 && (
                                        <Text size="xs" c="dimmed" ta="right">
                                            Mostrando {filteredItems.length} modelos en el catálogo
                                        </Text>
                                    )}
                                </Stack>
                            )}
                        </Transition>
                    )}
                </Stack>
            </Paper>
        </Container>
    );
};
