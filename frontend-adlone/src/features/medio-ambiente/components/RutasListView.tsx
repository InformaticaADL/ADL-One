import React, { useState, useEffect, useMemo } from 'react';
import { 
    Table, Button, Badge, Group, ActionIcon, Text, Loader, Center, 
    Paper, Stack, Title, Modal, Select, TextInput, Tooltip, ThemeIcon
} from '@mantine/core';
import { 
    IconTrash, IconCalendarEvent, IconRefresh, IconPlus, 
    IconEdit, IconUserPlus, IconRoute, IconMapPin, IconCheck
} from '@tabler/icons-react';
import { rutasPlanificadasService } from '../services/rutasPlanificadas.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface RutasListViewProps {
    onBackToMenu: () => void;
    onNuevaRuta: () => void;
    onEditarRuta?: (rutaId: number) => void;
}

export const RutasListView: React.FC<RutasListViewProps> = ({ onBackToMenu, onNuevaRuta, onEditarRuta }) => {
    const [rutas, setRutas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();
    const { user } = useAuth();
    const { getCatalogo } = useCatalogos();

    // Delete confirmation modal
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; nombre: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Assignment modal
    const [assignTarget, setAssignTarget] = useState<{ id: number; nombre: string; fichas: number } | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [assignDate, setAssignDate] = useState('');
    const [assignMuestreadorInst, setAssignMuestreadorInst] = useState<string | null>(null);
    const [assignMuestreadorRet, setAssignMuestreadorRet] = useState<string | null>(null);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    const muestreadorOptions = useMemo(() =>
        muestreadores.map((m: any) => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const fetchRutas = async () => {
        setLoading(true);
        try {
            const data = await rutasPlanificadasService.getAll();
            setRutas(data || []);
        } catch (e) {
            showToast({ type: 'error', message: 'Error al obtener rutas guardadas' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRutas();
        // Pre-load muestreadores for assignment
        getCatalogo('muestreadores', () => catalogosService.getMuestreadores())
            .then(data => { if (data) setMuestreadores(data); })
            .catch(() => {});
    }, []);

    // --- DELETE ---
    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await rutasPlanificadasService.delete(deleteTarget.id);
            showToast({ type: 'success', message: 'Ruta eliminada correctamente' });
            setDeleteTarget(null);
            fetchRutas();
        } catch (e) {
            showToast({ type: 'error', message: 'Error al eliminar la ruta' });
        } finally {
            setDeleting(false);
        }
    };

    // --- ASSIGN ---
    const handleAssignConfirm = async () => {
        if (!assignTarget) return;
        if (!assignDate) {
            showToast({ type: 'warning', message: 'Selecciona una fecha de muestreo' });
            return;
        }
        if (!assignMuestreadorInst) {
            showToast({ type: 'warning', message: 'Selecciona un muestreador de instalación' });
            return;
        }
        setAssigning(true);
        try {
            await rutasPlanificadasService.asignar(assignTarget.id, {
                assignDate,
                assignMuestreadorInst,
                assignMuestreadorRet: assignMuestreadorRet || undefined
            });
            showToast({ type: 'success', message: `Ruta "${assignTarget.nombre}" asignada oficialmente ✅` });
            setAssignTarget(null);
            resetAssignForm();
            fetchRutas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al asignar la ruta' });
        } finally {
            setAssigning(false);
        }
    };

    const resetAssignForm = () => {
        setAssignDate('');
        setAssignMuestreadorInst(null);
        setAssignMuestreadorRet(null);
    };

    // --- EDIT ---
    const handleEdit = (rutaId: number) => {
        if (onEditarRuta) {
            onEditarRuta(rutaId);
        } else {
            showToast({ type: 'info', message: 'Edición de rutas próximamente' });
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'PENDIENTE': return 'blue';
            case 'ASIGNADA': return 'green';
            case 'COMPLETADA': return 'teal';
            case 'CANCELADA': return 'red';
            default: return 'gray';
        }
    };

    return (
        <Stack gap="md" style={{ width: '100%' }} p="md">
            <PageHeader 
                title="Administrador de Rutas" 
                subtitle="Gestiona y asigna las rutas planificadas de muestreo."
                onBack={onBackToMenu}
                rightSection={
                    <Button leftSection={<IconPlus size={16} />} color="blue" onClick={onNuevaRuta}>
                        Nueva Ruta
                    </Button>
                }
            />

            <Paper withBorder radius="md" p="md" shadow="sm">
                <Group justify="space-between" mb="md">
                    <Group gap="sm">
                        <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                            <IconRoute size={18} />
                        </ThemeIcon>
                        <div>
                            <Title order={4}>Rutas Guardadas</Title>
                            <Text size="xs" c="dimmed">{rutas.length} ruta{rutas.length !== 1 ? 's' : ''} en el sistema</Text>
                        </div>
                    </Group>
                    <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={fetchRutas} loading={loading}>
                        Actualizar
                    </Button>
                </Group>

                {loading ? (
                    <Center p="xl"><Loader /></Center>
                ) : rutas.length === 0 ? (
                    <Center py={60}>
                        <Stack align="center" gap="md">
                            <IconRoute size={48} color="var(--mantine-color-gray-4)" />
                            <div>
                                <Text c="dimmed" ta="center" fw={500}>No hay rutas guardadas</Text>
                                <Text c="dimmed" ta="center" size="sm">Haz clic en "Nueva Ruta" para comenzar a planificar.</Text>
                            </div>
                            <Button variant="light" leftSection={<IconPlus size={14} />} onClick={onNuevaRuta}>
                                Crear Primera Ruta
                            </Button>
                        </Stack>
                    </Center>
                ) : (
                    <Table striped highlightOnHover verticalSpacing="sm">
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>ID</Table.Th>
                                <Table.Th>Nombre Ruta</Table.Th>
                                <Table.Th>Creador</Table.Th>
                                <Table.Th ta="center">Fichas</Table.Th>
                                <Table.Th>Fecha Creación</Table.Th>
                                <Table.Th>Estado</Table.Th>
                                <Table.Th ta="right">Acciones</Table.Th>
                            </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                            {rutas.map(r => (
                                <Table.Tr key={r.id_ruta_planificada}>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">#{r.id_ruta_planificada}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs">
                                            <IconMapPin size={14} color="var(--mantine-color-blue-5)" />
                                            <Text fw={500} size="sm">{r.nombre_ruta}</Text>
                                        </Group>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="sm" c="dimmed">{r.creador || 'Sistema'}</Text>
                                    </Table.Td>
                                    <Table.Td ta="center">
                                        <Badge variant="light" color="blue" size="sm">{r.cantidad_fichas}</Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Text size="xs" c="dimmed">{formatDate(r.fecha_creacion)}</Text>
                                    </Table.Td>
                                    <Table.Td>
                                        <Badge color={getEstadoColor(r.estado)} variant="light" size="sm">
                                            {r.estado}
                                        </Badge>
                                    </Table.Td>
                                    <Table.Td>
                                        <Group gap="xs" justify="flex-end">
                                            {r.estado === 'PENDIENTE' && (
                                                <Tooltip label="Asignar fecha y muestreador">
                                                    <Button 
                                                        size="compact-xs" 
                                                        color="green" 
                                                        variant="light"
                                                        leftSection={<IconCalendarEvent size={14} />}
                                                        onClick={() => setAssignTarget({ 
                                                            id: r.id_ruta_planificada, 
                                                            nombre: r.nombre_ruta, 
                                                            fichas: r.cantidad_fichas 
                                                        })}
                                                    >
                                                        Asignar
                                                    </Button>
                                                </Tooltip>
                                            )}
                                            {r.estado === 'PENDIENTE' && (
                                                <Tooltip label="Editar ruta">
                                                    <ActionIcon color="blue" variant="subtle" onClick={() => handleEdit(r.id_ruta_planificada)}>
                                                        <IconEdit size={16} />
                                                    </ActionIcon>
                                                </Tooltip>
                                            )}
                                            <Tooltip label="Eliminar ruta">
                                                <ActionIcon 
                                                    color="red" 
                                                    variant="subtle" 
                                                    onClick={() => setDeleteTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })}
                                                >
                                                    <IconTrash size={16} />
                                                </ActionIcon>
                                            </Tooltip>
                                        </Group>
                                    </Table.Td>
                                </Table.Tr>
                            ))}
                        </Table.Tbody>
                    </Table>
                )}
            </Paper>

            {/* ======================== DELETE CONFIRMATION MODAL ======================== */}
            <Modal
                opened={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                title={<Text fw={600} size="lg">Confirmar Eliminación</Text>}
                centered
                size="sm"
            >
                <Stack gap="md">
                    <Text size="sm">
                        ¿Estás seguro de que deseas eliminar la ruta <Text span fw={700}>"{deleteTarget?.nombre}"</Text>?
                    </Text>
                    <Text size="xs" c="dimmed">
                        Esta acción no se puede deshacer. Las fichas asociadas no serán eliminadas, solo la planificación de la ruta.
                    </Text>
                    <Group justify="flex-end" mt="sm">
                        <Button variant="default" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button color="red" leftSection={<IconTrash size={16} />} onClick={handleDeleteConfirm} loading={deleting}>
                            Eliminar Ruta
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* ======================== ASSIGNMENT MODAL ======================== */}
            <Modal
                opened={assignTarget !== null}
                onClose={() => { setAssignTarget(null); resetAssignForm(); }}
                title={
                    <Group gap="xs">
                        <IconCalendarEvent size={20} color="var(--mantine-color-green-6)" />
                        <Text fw={600} size="lg">Asignar Ruta Oficialmente</Text>
                    </Group>
                }
                centered
                size="md"
            >
                <Stack gap="md">
                    <Paper withBorder p="sm" radius="sm" bg="blue.0">
                        <Group gap="xs">
                            <IconRoute size={16} color="var(--mantine-color-blue-7)" />
                            <Text size="sm" fw={600} c="blue.8">{assignTarget?.nombre}</Text>
                            <Badge size="xs" variant="light" color="blue">{assignTarget?.fichas} fichas</Badge>
                        </Group>
                    </Paper>

                    <TextInput
                        label="Fecha de Muestreo"
                        type="date"
                        value={assignDate}
                        onChange={(e) => setAssignDate(e.target.value)}
                        leftSection={<IconCalendarEvent size={16} />}
                        required
                    />
                    <Select
                        label="Muestreador Instalación"
                        data={muestreadorOptions}
                        value={assignMuestreadorInst}
                        onChange={(v) => { setAssignMuestreadorInst(v); if (!assignMuestreadorRet) setAssignMuestreadorRet(v); }}
                        searchable
                        placeholder="Seleccionar muestreador..."
                        leftSection={<IconUserPlus size={16} />}
                        required
                        comboboxProps={{ zIndex: 10001 }}
                    />
                    <Select
                        label="Muestreador Retiro"
                        data={muestreadorOptions}
                        value={assignMuestreadorRet}
                        onChange={setAssignMuestreadorRet}
                        searchable
                        placeholder="Igual al de instalación"
                        leftSection={<IconUserPlus size={16} />}
                        comboboxProps={{ zIndex: 10001 }}
                    />

                    <Button
                        fullWidth
                        color="green"
                        size="md"
                        leftSection={<IconCheck size={20} />}
                        onClick={handleAssignConfirm}
                        loading={assigning}
                        disabled={!assignDate || !assignMuestreadorInst}
                        mt="xs"
                    >
                        Confirmar Asignación Oficial
                    </Button>
                </Stack>
            </Modal>
        </Stack>
    );
};
