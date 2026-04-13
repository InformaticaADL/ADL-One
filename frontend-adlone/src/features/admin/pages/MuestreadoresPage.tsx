import React, { useState, useEffect } from 'react';
import { 
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
    Modal,
    Stack as MantineStack,
    Divider,
    SimpleGrid
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconPlus, 
    IconSearch, 
    IconEdit, 
    IconPower, 
    IconFileDescription,
    IconCheck,
    IconX,
    IconBell
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { MuestreadorForm } from '../components/MuestreadorForm';
import { SamplerRequestsModal } from '../components/SamplerRequestsModal';
import SamplerDeactivationModal from '../components/SamplerDeactivationModal';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

interface Props {
    onBack: () => void;
}

export const MuestreadoresPage: React.FC<Props> = ({ onBack }) => {
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [solicitudesRealizadas, setSolicitudesRealizadas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVOS');

    // Selected state
    const [selectedMuestreador, setSelectedMuestreador] = useState<any | null>(null);

    // Modals State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [muestreadorToDisable, setMuestreadorToDisable] = useState<any | null>(null);
    const [isEnableConfirmOpen, setIsEnableConfirmOpen] = useState(false);
    const [muestreadorToEnable, setMuestreadorToEnable] = useState<any | null>(null);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [requestsSamplerInfo, setRequestsSamplerInfo] = useState<{ id: string | number; nombre: string } | null>(null);

    // Image Zoom State
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const { showToast } = useToast();
    const { pendingRequestId } = useNavStore();

    const isMobile = useMediaQuery('(max-width: 768px)');

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await adminService.getMuestreadores(searchTerm, statusFilter);
            setMuestreadores(result.data || []);
        } catch (error) {
            console.error('Error fetching muestreadores:', error);
            showToast({ type: 'error', message: 'Error al cargar los muestreadores' });
        } finally {
            setLoading(false);
        }
    };

    const loadSolicitudes = async () => {
        try {
            // Focus ONLY on ACEPTADA states as requested (the ones to be marked as realized)
            const targetStates = 'ACEPTADA';
            
            const [legacyData, ursData] = await Promise.all([
                adminService.getSolicitudes({ estado: targetStates }).catch(() => []),
                ursService.getRequests({ estado: targetStates }).catch(() => [])
            ]);
            const data = [...(Array.isArray(legacyData) ? legacyData : []), ...(Array.isArray(ursData) ? ursData : [])];
            
            // Filter ones that might relate to Muestreadores
            const filtered = data.filter((s: any) => {
                if (s.modulo_destino === 'MUESTREADORES') return true;
                const typeRaw = (s.tipo_solicitud || s.nombre_tipo || '').toUpperCase();
                return typeRaw.includes('MUESTREADOR') || typeRaw.includes('FIRMA') || typeRaw.includes('DESHABILITAR');
            });
            setSolicitudesRealizadas(filtered);
        } catch (error) {
            console.error("Error loading solicitudes:", error);
        }
    };

    useEffect(() => {
        loadSolicitudes();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, statusFilter]);

    // Handle incoming pending request from NavStore
    useEffect(() => {
        if (pendingRequestId && solicitudesRealizadas.length > 0) {
            const sol = solicitudesRealizadas.find(s => s.id_solicitud === pendingRequestId);
            if (sol) {
                // Determine if it belongs to a sampler here or just open the global inbox?
                // Usually these redirects go to UniversalInbox, but if we are here, we might want to highlight it.
                // For now, let's keep it simple.
            }
        }
    }, [pendingRequestId, solicitudesRealizadas]);

    const handleCreate = () => {
        setSelectedMuestreador(null);
        setViewMode('form');
    };

    const handleEdit = (m: any) => {
        setSelectedMuestreador(m);
        setViewMode('form');
    };

    const handleOpenRequests = (m: any) => {
        setRequestsSamplerInfo({ id: m.id_muestreador, nombre: m.nombre_muestreador });
        setShowRequestsModal(true);
    };

    const getPendingRequestsForSampler = (id: number) => {
        return solicitudesRealizadas.filter(sol => {
            const d = sol.datos_json || {};
            const idStr = String(id);
            // check multiple possible ID keys (URS and Legacy)
            if (String(d.id_muestreador) === idStr) return true;
            if (String(d.muestreador_origen_id) === idStr) return true; // Fix for ID 11
            if (String(d.muestreador_destino_id) === idStr) return true;
            if (String(d.nuevo_responsable_id) === idStr) return true; // Legacy Traspaso
            if (String(d.id_muestreador_nuevo) === idStr) return true; // Manual reassignment
            return false;
        });
    };

    const handleDisableClick = (m: any) => {
        setMuestreadorToDisable(m);
        setIsConfirmModalOpen(true);
    };

    // Note: confirmDisable is now handled by SamplerDeactivationModal

    const handleEnableClick = (m: any) => {
        setMuestreadorToEnable(m);
        setIsEnableConfirmOpen(true);
    };

    const confirmEnable = async () => {
        if (!muestreadorToEnable) return;
        try {
            await adminService.enableMuestreador(muestreadorToEnable.id_muestreador);
            showToast({ type: 'success', message: 'Muestreador habilitado correctamente' });
            fetchData();
            setIsEnableConfirmOpen(false);
            setMuestreadorToEnable(null);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al habilitar' });
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
            showToast({ type: 'error', message: 'Error al exportar PDF' });
        } finally {
            setIsExporting(false);
        }
    };

    const content = viewMode === 'form' ? (
        <MuestreadorForm
            initialData={selectedMuestreador}
            pendingRequests={selectedMuestreador ? getPendingRequestsForSampler(selectedMuestreador.id_muestreador) : []}
            onSave={() => {
                fetchData();
                loadSolicitudes();
                setViewMode('list');
            }}
            onCancel={() => setViewMode('list')}
            onViewRequests={() => handleOpenRequests(selectedMuestreador!)}
        />
    ) : (
        <Box p="md" style={{ width: '100%' }}>
            <PageHeader
                title="Gestión de Muestreadores"
                subtitle={!isMobile ? "Administra el personal de muestreo técnico y sus firmas digitales autorizadas." : undefined}
                onBack={onBack}
                rightSection={
                    <Group gap="xs" wrap={isMobile ? "wrap" : "nowrap"}>
                        <ProtectedContent permission="MU_EXP">
                            <Button 
                                variant="light" 
                                color="red" 
                                leftSection={<IconFileDescription size={18} />}
                                onClick={handleExportPdf}
                                loading={isExporting}
                                radius="md"
                                size={isMobile ? "xs" : "sm"}
                                style={{ flex: isMobile ? 1 : 'auto' }}
                            >
                                Exportar PDF
                            </Button>
                        </ProtectedContent>
                        <ProtectedContent permission="AI_MA_CREAR_NEW_MUESTREADOR">
                            <Button 
                                leftSection={<IconPlus size={18} />} 
                                onClick={handleCreate}
                                radius="md"
                                size={isMobile ? "xs" : "sm"}
                                style={{ flex: isMobile ? 1 : 'auto' }}
                            >
                                Nuevo {isMobile ? '' : 'Muestreador'}
                            </Button>
                        </ProtectedContent>
                    </Group>
                }
            />

            <Paper withBorder p="md" radius="md" shadow="sm" mt="xl">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
                </SimpleGrid>
            </Paper>

            <Paper withBorder radius="md" shadow="sm" mt="lg" style={{ position: 'relative' }}>
                <LoadingOverlay visible={loading} overlayProps={{ radius: "md", blur: 2 }} />
                
                {!isMobile ? (
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
                                    muestreadores.map((m) => {
                                        const pendingReqs = getPendingRequestsForSampler(m.id_muestreador);
                                        const hasPending = pendingReqs.length > 0;

                                        return (
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
                                                        <ProtectedContent permission="MU_SOLICITUDES">
                                                            <Tooltip label="Ver Solicitudes">
                                                                <ActionIcon 
                                                                    variant="light" 
                                                                    color={hasPending ? "orange" : "gray"} 
                                                                    onClick={() => handleOpenRequests(m)}
                                                                >
                                                                    <IconBell size={16} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </ProtectedContent>

                                                        <ProtectedContent permission="AI_MA_EDITAR_MUESTREADOR">
                                                            <Tooltip label="Editar Información">
                                                                <ActionIcon variant="light" color="blue" onClick={() => handleEdit(m)}>
                                                                    <IconEdit size={16} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </ProtectedContent>
                                                        
                                                        <ProtectedContent permission="AI_MA_DESHABILITAR_MUESTREADOR">
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
                                                        </ProtectedContent>
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>
                                        );
                                    })
                                )}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>
                ) : (
                    <MantineStack gap="md" p="md">
                        {muestreadores.length === 0 && !loading ? (
                            <Paper withBorder p="xl" radius="md" bg="gray.0" style={{ borderStyle: 'dashed' }}>
                                <Text c="dimmed" ta="center">No se encontraron muestreadores.</Text>
                            </Paper>
                        ) : (
                            muestreadores.map((m) => {
                                const pendingReqs = getPendingRequestsForSampler(m.id_muestreador);
                                const hasPending = pendingReqs.length > 0;

                                return (
                                    <Paper key={m.id_muestreador} withBorder p="md" radius="lg" shadow="xs">
                                        <MantineStack gap="sm">
                                            <Group justify="space-between" align="flex-start" wrap="nowrap">
                                                <Box>
                                                    <Text fw={800} size="md" c="blue.8">{m.nombre_muestreador}</Text>
                                                    <Text size="xs" c="dimmed" fw={600}>ID: {m.id_muestreador}</Text>
                                                </Box>
                                                <Badge 
                                                    color={m.habilitado === 'S' ? 'green' : 'red'} 
                                                    variant="light"
                                                    size="sm"
                                                >
                                                    {m.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </Group>

                                            <Divider variant="dashed" />

                                            <Box>
                                                <Text size="xs" fw={700} c="dimmed" mb={4}>CONTACTO:</Text>
                                                <Text size="sm" fw={600}>{m.correo_electronico || 'Sin correo registrado'}</Text>
                                            </Box>

                                            <Box>
                                                <Text size="xs" fw={700} c="dimmed" mb={4}>FIRMA DIGITAL:</Text>
                                                {m.firma_muestreador ? (
                                                    <Paper 
                                                        withBorder p={4} radius="md" bg="gray.0" w={110} h={48}
                                                        onClick={() => setZoomedImage(m.firma_muestreador)}
                                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                    >
                                                        <Image src={m.firma_muestreador} fit="contain" h={40} />
                                                    </Paper>
                                                ) : (
                                                    <Text size="xs" c="dimmed" fs="italic">Sin firma registrada</Text>
                                                )}
                                            </Box>

                                            <Divider variant="dashed" />

                                            <Group grow gap="xs">
                                                <Button 
                                                    variant="light" 
                                                    color={hasPending ? "orange" : "gray"} 
                                                    onClick={() => handleOpenRequests(m)}
                                                    leftSection={<IconBell size={16} />}
                                                    size="xs"
                                                    radius="md"
                                                >
                                                    Solicitudes
                                                </Button>
                                                <Button 
                                                    variant="light" 
                                                    color="blue" 
                                                    onClick={() => handleEdit(m)}
                                                    leftSection={<IconEdit size={16} />}
                                                    size="xs"
                                                    radius="md"
                                                >
                                                    Editar
                                                </Button>
                                                {m.habilitado === 'S' ? (
                                                    <Button 
                                                        variant="light" 
                                                        color="red" 
                                                        onClick={() => handleDisableClick(m)}
                                                        leftSection={<IconPower size={16} />}
                                                        size="xs"
                                                        radius="md"
                                                    >
                                                        Baja
                                                    </Button>
                                                ) : (
                                                    <Button 
                                                        variant="light" 
                                                        color="green" 
                                                        onClick={() => handleEnableClick(m)}
                                                        leftSection={<IconCheck size={16} />}
                                                        size="xs"
                                                        radius="md"
                                                    >
                                                        Alta
                                                    </Button>
                                                )}
                                            </Group>
                                        </MantineStack>
                                    </Paper>
                                );
                            })
                        )}
                    </MantineStack>
                )}
            </Paper>
        </Box>
    );

    return (
        <>
            {content}
            <SamplerRequestsModal
                idMuestreador={requestsSamplerInfo?.id || null}
                nombreMuestreador={requestsSamplerInfo?.nombre || ''}
                isOpen={showRequestsModal}
                onClose={() => setShowRequestsModal(false)}
                onRefresh={() => {
                    loadSolicitudes();
                    fetchData();
                }}
                requests={getPendingRequestsForSampler(Number(requestsSamplerInfo?.id))}
            />

            <SamplerDeactivationModal
                opened={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false);
                    setMuestreadorToDisable(null);
                }}
                sampler={{ 
                    id_muestreador: muestreadorToDisable?.id_muestreador, 
                    nombre_muestreador: muestreadorToDisable?.nombre_muestreador || '' 
                }}
                onSuccess={() => {
                    fetchData();
                    loadSolicitudes();
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
        </>
    );
};
