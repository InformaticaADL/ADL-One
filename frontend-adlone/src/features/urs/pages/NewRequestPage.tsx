import React, { useState, useEffect } from 'react';
import { 
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
    Transition,
    LoadingOverlay
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
    const goToInbox = () => setActiveSubmodule('');
    
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
    const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);

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
            
            setCreatedRequestId(result.id_solicitud);
            setUrsInboxMode('SENT');
            setPendingRequestId(result.id_solicitud);
            setIsSubmitting(false);
            setShowSuccess(true);
            
            setTimeout(() => {
                goToInbox();
            }, 2800);
        } catch (error) {
            console.error(error);
            alert('Error al crear la solicitud');
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

    return (
        <Box p="xl" pos="relative" style={{ width: '100%' }}>
            <LoadingOverlay 
                visible={isSubmitting} 
                zIndex={1000} 
                overlayProps={{ radius: 'md', blur: 3 }} 
                loaderProps={{ type: 'dots', size: 'xl', color: 'blue' }} 
            />

            {/* Success Overlay */}
            {showSuccess && (
                <Box
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 2000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(8px)',
                        backgroundColor: 'rgba(255, 255, 255, 0.6)',
                        animation: 'fadeIn 0.4s ease-out'
                    }}
                >
                    <Paper
                        shadow="xl"
                        p="xl"
                        radius="lg"
                        withBorder
                        style={{
                            width: 420,
                            maxWidth: '90vw',
                            borderColor: 'var(--mantine-color-green-3)',
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,255,240,0.95) 100%)',
                            animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        <Stack align="center" gap="lg" py="lg">
                            <div style={{
                                width: 80,
                                height: 80,
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--mantine-color-green-5) 0%, var(--mantine-color-teal-5) 100%)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 8px 32px rgba(34, 197, 94, 0.3)',
                                animation: 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both'
                            }}>
                                <IconCheck size={44} color="white" stroke={3} />
                            </div>
                            <Stack align="center" gap={4}>
                                <Title order={2} style={{ letterSpacing: '-0.5px' }}>¡Solicitud Enviada!</Title>
                                {createdRequestId && (
                                    <Badge
                                        size="lg"
                                        variant="light"
                                        color="blue"
                                        radius="md"
                                        style={{ fontWeight: 700, fontSize: '0.85rem' }}
                                    >
                                        Solicitud #{createdRequestId}
                                    </Badge>
                                )}
                            </Stack>
                            <Text size="sm" c="dimmed" ta="center" maw={300}>
                                Tu solicitud ha sido registrada correctamente. Redirigiendo a tu solicitud...
                            </Text>
                            <Box w="60%" style={{ overflow: 'hidden', borderRadius: 999, backgroundColor: 'var(--mantine-color-gray-2)' }}>
                                <div style={{
                                    height: 4,
                                    borderRadius: 999,
                                    background: 'linear-gradient(90deg, var(--mantine-color-green-5), var(--mantine-color-teal-5))',
                                    animation: 'progressBar 2.5s ease-in-out forwards'
                                }} />
                            </Box>
                        </Stack>
                    </Paper>
                    <style>{`
                        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                        @keyframes scaleIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
                        @keyframes bounceIn { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
                        @keyframes progressBar { from { width: 0%; } to { width: 100%; } }
                    `}</style>
                </Box>
            )}

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
        </Box>
    );
};

export default NewRequestPage;
