import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Group, 
    Text, 
    Button, 
    Table, 
    Badge, 
    ActionIcon, 
    Paper, 
    LoadingOverlay, 
    TextInput, 
    Select, 
    ScrollArea, 
    Box, 
    Tooltip,
    Image,
    Modal
} from '@mantine/core';
import { 
    IconPlus, 
    IconSearch, 
    IconEdit, 
    IconPower, 
    IconFileDescription,
    IconCheck,
    IconX
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { MuestreadorModal } from '../components/MuestreadorModal';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack: () => void;
}

export const MuestreadoresPage: React.FC<Props> = ({ onBack }) => {
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVOS');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMuestreador, setSelectedMuestreador] = useState<any | null>(null);

    // Confirm Modal State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [muestreadorToDisable, setMuestreadorToDisable] = useState<any | null>(null);

    // Enable Confirm Modal State
    const [isEnableConfirmOpen, setIsEnableConfirmOpen] = useState(false);
    const [muestreadorToEnable, setMuestreadorToEnable] = useState<any | null>(null);

    // Image Zoom State
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await adminService.getMuestreadores(searchTerm, statusFilter);
            setMuestreadores(result.data || []);
        } catch (error) {
            console.error('Error fetching muestreadores:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, statusFilter]);

    const handleCreate = () => {
        setSelectedMuestreador(null);
        setIsModalOpen(true);
    };

    const handleEdit = (m: any) => {
        setSelectedMuestreador(m);
        setIsModalOpen(true);
    };

    const handleDisableClick = (m: any) => {
        setMuestreadorToDisable(m);
        setIsConfirmModalOpen(true);
    };

    const confirmDisable = async () => {
        if (!muestreadorToDisable) return;
        try {
            await adminService.disableMuestreador(muestreadorToDisable.id_muestreador);
            fetchData();
            setIsConfirmModalOpen(false);
            setMuestreadorToDisable(null);
        } catch (error) {
            console.error(error);
        }
    };

    const handleEnableClick = (m: any) => {
        setMuestreadorToEnable(m);
        setIsEnableConfirmOpen(true);
    };

    const confirmEnable = async () => {
        if (!muestreadorToEnable) return;
        try {
            await adminService.enableMuestreador(muestreadorToEnable.id_muestreador);
            fetchData();
            setIsEnableConfirmOpen(false);
            setMuestreadorToEnable(null);
        } catch (error) {
            console.error(error);
        }
    };

    const handleExportPdf = async () => {
        setIsExporting(true);
        try {
            const blob = await adminService.getMuestreadoresPdf(searchTerm, statusFilter);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Muestreadores_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting PDF:', error);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <Container fluid py="md">
            <PageHeader
                title="Gestión de Muestreadores"
                subtitle="Administra el personal de muestreo técnico y sus firmas digitales autorizadas."
                onBack={onBack}
                rightSection={
                    <Group>
                        <Button 
                            variant="light" 
                            color="red" 
                            leftSection={<IconFileDescription size={18} />}
                            onClick={handleExportPdf}
                            loading={isExporting}
                            radius="md"
                        >
                            Exportar PDF
                        </Button>
                        <Button 
                            leftSection={<IconPlus size={18} />} 
                            onClick={handleCreate}
                            radius="md"
                        >
                            Nuevo Muestreador
                        </Button>
                    </Group>
                }
            />

            <Paper withBorder p="md" radius="md" shadow="sm" mt="xl">
                <Group grow>
                    <TextInput
                        label="Buscar por Nombre"
                        placeholder="Escriba nombre o ID..."
                        leftSection={<IconSearch size={16} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.currentTarget.value)}
                        radius="md"
                    />
                    <Select
                        label="Estado"
                        placeholder="Filtrar por estado"
                        data={[
                            { value: 'ACTIVOS', label: 'Solo Activos' },
                            { value: 'INACTIVOS', label: 'Solo Inactivos' },
                            { value: 'TODOS', label: 'Todos' }
                        ]}
                        value={statusFilter}
                        onChange={(val) => setStatusFilter(val || 'ACTIVOS')}
                        radius="md"
                    />
                </Group>
            </Paper>

            <Paper withBorder radius="md" shadow="sm" mt="lg" style={{ position: 'relative' }}>
                <LoadingOverlay visible={loading} overlayProps={{ radius: "md", blur: 2 }} />
                
                <ScrollArea h={500}>
                    <Table verticalSpacing="sm" highlightOnHover striped>
                        <Table.Thead bg="blue.0">
                            <Table.Tr>
                                <Table.Th>Muestreador</Table.Th>
                                <Table.Th>Contacto</Table.Th>
                                <Table.Th>Estado</Table.Th>
                                <Table.Th>Firma Digital</Table.Th>
                                <Table.Th ta="center">Acciones</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {muestreadores.length === 0 && !loading ? (
                                <Table.Tr>
                                    <Table.Td colSpan={5} ta="center" py="xl">
                                        <Text c="dimmed">No se encontraron muestreadores con los filtros aplicados.</Text>
                                    </Table.Td>
                                </Table.Tr>
                            ) : (
                                muestreadores.map((m) => (
                                    <Table.Tr key={m.id_muestreador}>
                                        <Table.Td>
                                            <Box>
                                                <Text fw={700} size="sm">{m.nombre_muestreador}</Text>
                                                <Text size="xs" c="dimmed">ID: {m.id_muestreador}</Text>
                                            </Box>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm">{m.correo_electronico || '---'}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge 
                                                color={m.habilitado === 'S' ? 'green' : 'red'} 
                                                variant="light"
                                                leftSection={m.habilitado === 'S' ? <IconCheck size={10} /> : <IconX size={10} />}
                                            >
                                                {m.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            {m.firma_muestreador ? (
                                                <Tooltip label="Ver firma ampliada">
                                                    <Paper 
                                                        withBorder 
                                                        h={40} 
                                                        w={100} 
                                                        shadow="xs"
                                                        onClick={() => setZoomedImage(m.firma_muestreador)}
                                                        style={{ cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                    >
                                                        <Image src={m.firma_muestreador} fit="contain" h={36} />
                                                    </Paper>
                                                </Tooltip>
                                            ) : (
                                                <Text size="xs" c="dimmed" fs="italic">Sin firma registrada</Text>
                                            )}
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs" justify="center">
                                                <Tooltip label="Editar Información">
                                                    <ActionIcon variant="light" color="blue" onClick={() => handleEdit(m)}>
                                                        <IconEdit size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                                
                                                {m.habilitado === 'S' ? (
                                                    <Tooltip label="Deshabilitar Muestreador">
                                                        <ActionIcon variant="light" color="red" onClick={() => handleDisableClick(m)}>
                                                            <IconPower size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip label="Habilitar Muestreador">
                                                        <ActionIcon variant="light" color="green" onClick={() => handleEnableClick(m)}>
                                                            <IconCheck size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))
                            )}
                        </Table.Tbody>
                    </Table>
                </ScrollArea>
            </Paper>

            <MuestreadorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchData}
                initialData={selectedMuestreador}
            />

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                title="Confirmar Deshabilitación"
                message={`¿Está seguro de deshabilitar a ${muestreadorToDisable?.nombre_muestreador}? Esta acción impedirá que el muestreador sea asignado a nuevas fichas.`}
                confirmText="Deshabilitar"
                confirmColor="red"
                onConfirm={confirmDisable}
                onCancel={() => {
                    setIsConfirmModalOpen(false);
                    setMuestreadorToDisable(null);
                }}
            />

            <ConfirmModal
                isOpen={isEnableConfirmOpen}
                title="Confirmar Habilitación"
                message={`¿Está seguro de habilitar a ${muestreadorToEnable?.nombre_muestreador}? El muestreador podrá ser asignado a nuevas fichas.`}
                confirmText="Habilitar"
                confirmColor="green"
                onConfirm={confirmEnable}
                onCancel={() => {
                    setIsEnableConfirmOpen(false);
                    setMuestreadorToEnable(null);
                }}
            />

            <Modal 
                opened={!!zoomedImage} 
                onClose={() => setZoomedImage(null)} 
                title="Firma Digital" 
                centered 
                size="lg"
                padding="xl"
            >
                <Paper withBorder p="xl" bg="gray.0" radius="md">
                    <Image src={zoomedImage} fit="contain" mah={400} />
                </Paper>
            </Modal>
        </Container>
    );
};
