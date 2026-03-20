import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Paper, 
    Title, 
    Text, 
    Select, 
    SegmentedControl, 
    Textarea, 
    Button, 
    Group, 
    Stack, 
    ActionIcon, 
    Tooltip, 
    Loader, 
    Center, 
    Box, 
    FileButton, 
    Badge,
    Transition
} from '@mantine/core';
import { 
    IconSearch, 
    IconCheck, 
    IconUpload, 
    IconSettings,
    IconX
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import MuestreadorDeactivationForm from '../components/MuestreadorDeactivationForm';
import EquipoActivationForm from '../components/EquipoActivationForm';
import EquipoBajaForm from '../components/EquipoBajaForm';
import EquipoTraspasoForm from '../components/EquipoTraspasoForm';
import NuevoEquipoForm from '../components/NuevoEquipoForm';
import ReporteProblemaForm from '../components/ReporteProblemaForm';
import VigenciaExtensionForm from '../components/VigenciaExtensionForm';
import { useNavStore } from '../../../store/navStore';
import FileIcon from '../components/FileIcon';

// Memoize sub-forms to prevent heavy parent re-renders when local state changes
const MemoizedEquipoTraspasoForm = React.memo(EquipoTraspasoForm);
const MemoizedMuestreadorDeactivationForm = React.memo(MuestreadorDeactivationForm);
const MemoizedEquipoActivationForm = React.memo(EquipoActivationForm);
const MemoizedEquipoBajaForm = React.memo(EquipoBajaForm);
const MemoizedNuevoEquipoForm = React.memo(NuevoEquipoForm);
const MemoizedReporteProblemaForm = React.memo(ReporteProblemaForm);
const MemoizedVigenciaExtensionForm = React.memo(VigenciaExtensionForm);

interface NewRequestPageProps {
    onBack?: () => void;
}

const NewRequestPage: React.FC<NewRequestPageProps> = ({ onBack }) => {
    const { setPendingRequestId, setUrsInboxMode, setActiveSubmodule } = useNavStore();
    
    // Navigation
    const goToInbox = () => setActiveSubmodule('urs_bandeja');
    
    // State
    const [types, setTypes] = useState<any[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [priority, setPriority] = useState('NORMAL');
    const [observations, setObservations] = useState('');
    const [files, setFiles] = useState<File[]>([]);
    const [subFormData, setSubFormData] = useState<any>(null);
    
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        ursService.getRequestTypes()
            .then(res => {
                setTypes(res);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error loading types:", err);
                setLoading(false);
            });
    }, []);

    const selectedType = types.find(t => t.id_tipo.toString() === selectedTypeId);

    const handleFileChange = (payload: File[]) => {
        setFiles(prev => [...prev, ...payload]);
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        if (!selectedTypeId) return;
        if (!observations.trim()) return;
        
        setIsSubmitting(true);
        try {
            const payload = {
                id_tipo: Number(selectedTypeId),
                prioridad: priority,
                observaciones: observations,
                datos_json: { ...subFormData },
                archivos: files
            };
            
            const result = await ursService.createRequest(payload);
            
            setUrsInboxMode('SENT');
            setPendingRequestId(result.id_solicitud);
            setShowSuccess(true);
            
            setTimeout(() => {
                goToInbox();
            }, 2300);
        } catch (error) {
            console.error(error);
            // We could use notifications here too, but staying simple for now
            alert('Error al crear la solicitud');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Center h="80vh">
                <Stack align="center" gap="md">
                    <Loader size="xl" type="bars" color="blue" />
                    <Text size="sm" c="dimmed" fw={500}>Cargando opciones ADL...</Text>
                </Stack>
            </Center>
        );
    }

    if (showSuccess) {
        return (
            <Center h="80vh" style={{ overflow: 'hidden' }}>
                <Transition transition="fade" mounted={showSuccess} duration={500}>
                    {(styles) => (
                        <Paper shadow="xl" p="xl" withBorder radius="md" style={{ ...styles, width: '100%' }}>
                            <Stack align="center" gap="lg" py="xl">
                                <div style={{ 
                                    backgroundColor: 'var(--mantine-color-green-1)', 
                                    borderRadius: '50%', 
                                    padding: '20px',
                                    display: 'flex'
                                }}>
                                    <IconCheck size={60} color="var(--mantine-color-green-7)" />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <Title order={2} c="green.8">¡Solicitud Enviada!</Title>
                                    <Text size="md" mt="xs" c="dimmed">
                                        Tu solicitud ha sido registrada correctamente.<br />
                                        Redirigiendo a la bandeja de salida...
                                    </Text>
                                </div>
                                <Loader size="md" color="green" type="dots" />
                            </Stack>
                        </Paper>
                    )}
                </Transition>
            </Center>
        );
    }

    return (
        <Container fluid py="xl">
            <Paper shadow="sm" p="lg" withBorder radius="md" style={{ backgroundColor: 'var(--mantine-color-gray-0)' }}>
                <Stack gap="xl">
                    {/* Header */}
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Stack gap={0}>
                            <Title order={1} fw={800} style={{ fontSize: '1.8rem', letterSpacing: '-0.5px' }}>
                                Nueva Solicitud
                            </Title>
                            <Text c="dimmed" size="sm">
                                Complete la información requerida para su trámite de forma unificada.
                            </Text>
                        </Stack>
                        <Tooltip label="Cerrar y volver a bandeja">
                            <ActionIcon 
                                variant="subtle" 
                                color="gray" 
                                size="lg" 
                                onClick={onBack || goToInbox}
                                radius="md"
                            >
                                <IconX size={24} />
                            </ActionIcon>
                        </Tooltip>
                    </Group>

                    {/* Section 1: Selector & Priority */}
                    <Paper shadow="xs" p="md" withBorder radius="md">
                        <Stack gap="md">
                            <Select
                                label="Tipo de Solicitud"
                                placeholder="Seleccione el trámite a realizar"
                                data={types.map(t => ({ value: t.id_tipo.toString(), label: t.nombre }))}
                                value={selectedTypeId}
                                onChange={setSelectedTypeId}
                                searchable
                                clearable
                                leftSection={<IconSearch size={16} />}
                                nothingFoundMessage="No se encontraron trámites"
                                size="md"
                                radius="md"
                                comboboxProps={{ transitionProps: { transition: 'pop-top-left', duration: 200 } }}
                            />

                            {selectedTypeId && (
                                <Box mt="xs">
                                    <Text size="sm" fw={600} mb={5}>Prioridad del Trámite</Text>
                                    <SegmentedControl
                                        value={priority}
                                        onChange={setPriority}
                                        data={[
                                            { label: 'Normal', value: 'NORMAL' },
                                            { label: 'Alta', value: 'ALTA' },
                                            { label: 'Urgente', value: 'URGENTE' },
                                        ]}
                                        color={priority === 'URGENTE' ? 'red' : priority === 'ALTA' ? 'orange' : 'blue'}
                                        fullWidth
                                        radius="md"
                                        size="md"
                                    />
                                </Box>
                            )}
                        </Stack>
                    </Paper>

                    {/* Section 2: Dynamic Form Area */}
                    <Transition mounted={!!selectedTypeId} transition="scale-y" duration={200}>
                        {(styles) => (
                            <div style={styles}>
                                <Paper shadow="xs" p="md" withBorder radius="md">
                                    <Group mb="md" gap="xs">
                                        <IconSettings size={20} color="var(--mantine-color-blue-6)" />
                                        <Title order={4}>Información de {selectedType?.nombre}</Title>
                                    </Group>

                                    <Box py="sm">
                                        {/* ID 1: Activación de Equipo */}
                                        {selectedType?.id_tipo === 1 || selectedType?.nombre === 'Activación de Equipo' ? (
                                            <MemoizedEquipoActivationForm 
                                                onDataChange={setSubFormData}
                                            />
                                        ) : selectedType?.id_tipo === 2 || selectedType?.id_tipo === 6 || selectedType?.id_tipo === 10 || selectedType?.nombre?.includes('Baja de Equipo') ? (
                                            <MemoizedEquipoBajaForm 
                                                onDataChange={setSubFormData}
                                            />
                                        ) : selectedType?.id_tipo === 3 || selectedType?.nombre?.includes('Traspaso de Equipo') ? (
                                            <MemoizedEquipoTraspasoForm 
                                                onDataChange={setSubFormData}
                                            />
                                        ) : selectedType?.id_tipo === 4 || selectedType?.nombre?.includes('Nuevo Equipo') ? (
                                            <MemoizedNuevoEquipoForm 
                                                onDataChange={setSubFormData}
                                            />
                                        ) : selectedType?.id_tipo === 5 || selectedType?.id_tipo === 9 || selectedType?.nombre?.includes('Problema') ? (
                                            <MemoizedReporteProblemaForm 
                                                onDataChange={setSubFormData}
                                            />
                                        ) : selectedType?.id_tipo === 7 || selectedType?.nombre?.includes('Vigencia') ? (
                                            <MemoizedVigenciaExtensionForm 
                                                onDataChange={setSubFormData}
                                            />
                                        ) : (selectedType?.id_tipo === 8 || selectedType?.nombre === 'Deshabilitar muestreador') ? (
                                            <MemoizedMuestreadorDeactivationForm 
                                                isEmbedded
                                                onDataChange={setSubFormData}
                                            />
                                        ) : (
                                            <Box p="lg" style={{ 
                                                border: '1px dashed var(--mantine-color-gray-4)', 
                                                borderRadius: 'var(--mantine-radius-md)',
                                                backgroundColor: 'var(--mantine-color-gray-0)',
                                                textAlign: 'center'
                                            }}>
                                                <Text size="sm" c="dimmed">
                                                    Este trámite no requiere campos adicionales. <br />
                                                    Por favor complete los detalles en la sección de observaciones.
                                                </Text>
                                            </Box>
                                        )}
                                    </Box>
                                </Paper>
                            </div>
                        )}
                    </Transition>

                    {/* Section 3: Observations & Files */}
                    <Transition mounted={!!selectedTypeId} transition="scale-y" duration={300}>
                        {(styles) => (
                            <div style={styles}>
                                <Stack gap="md">
                                    <Textarea
                                        label="Observaciones"
                                        description="Explique brevemente los detalles de su solicitud"
                                        placeholder="Detalle su solicitud aquí..."
                                        value={observations}
                                        onChange={(e) => setObservations(e.target.value)}
                                        required
                                        minRows={3}
                                        autosize
                                        size="md"
                                        radius="md"
                                    />

                                    <Box>
                                        <Text size="sm" fw={500} mb={5}>Archivos Adjuntos</Text>
                                        <Group gap="sm">
                                            <FileButton onChange={handleFileChange} accept="image/png,image/jpeg,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" multiple>
                                                {(props) => (
                                                    <Button 
                                                        {...props} 
                                                        variant="light" 
                                                        leftSection={<IconUpload size={18} />}
                                                        radius="md"
                                                    >
                                                        Adjuntar Archivos
                                                    </Button>
                                                )}
                                            </FileButton>
                                            <Text size="xs" c="dimmed">(PDF, Excel, Imágenes)</Text>
                                        </Group>

                                        {files.length > 0 && (
                                            <Box mt="md" p="xs" style={{ 
                                                backgroundColor: 'white', 
                                                borderRadius: 'var(--mantine-radius-md)',
                                                border: '1px solid var(--mantine-color-gray-2)'
                                            }}>
                                                <Stack gap="xs">
                                                    {files.map((file, idx) => (
                                                        <Group key={idx} justify="space-between" p={8} style={{ 
                                                            borderBottom: idx < files.length - 1 ? '1px solid var(--mantine-color-gray-1)' : 'none'
                                                        }}>
                                                            <Group gap="sm">
                                                                <FileIcon filename={file.name} mimetype={file.type} />
                                                                <Text size="sm" fw={500} truncate maw={300}>{file.name}</Text>
                                                                <Badge variant="dot" color="gray" size="sm">{(file.size / 1024).toFixed(0)} KB</Badge>
                                                            </Group>
                                                            <ActionIcon 
                                                                variant="subtle" 
                                                                color="red" 
                                                                size="sm" 
                                                                onClick={() => removeFile(idx)}
                                                            >
                                                                <IconX size={14} />
                                                            </ActionIcon>
                                                        </Group>
                                                    ))}
                                                </Stack>
                                            </Box>
                                        )}
                                    </Box>
                                </Stack>
                            </div>
                        )}
                    </Transition>

                    {/* Footer Actions */}
                    <Box pt="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                        <Group justify="flex-end">
                            <Button variant="subtle" color="gray" onClick={goToInbox} disabled={isSubmitting}>
                                Cancelar
                            </Button>
                            <Button 
                                size="md" 
                                radius="md" 
                                onClick={handleSubmit}
                                loading={isSubmitting}
                                disabled={!selectedTypeId || !observations.trim()}
                                leftSection={!isSubmitting && <IconCheck size={18} />}
                                color="blue"
                                px="xl"
                            >
                                Enviar Solicitud ADL
                            </Button>
                        </Group>
                    </Box>
                </Stack>
            </Paper>
        </Container>
    );
};

export default NewRequestPage;
