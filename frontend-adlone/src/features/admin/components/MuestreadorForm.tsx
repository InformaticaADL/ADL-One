import React, { useState, useEffect } from 'react';
import { 
    Container, 
    Paper, 
    TextInput, 
    PasswordInput, 
    Button, 
    Group, 
    Stack, 
    Text, 
    Image, 
    Box, 
    LoadingOverlay, 
    Alert,
    FileButton,
    Affix,
    Transition
} from '@mantine/core';
import { 
    IconDeviceFloppy, 
    IconTrash, 
    IconUpload, 
    IconAlertCircle,
    IconSignature,
    IconMail,
    IconUser,
    IconBell
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';

interface Muestreador {
    id_muestreador?: number;
    nombre_muestreador: string;
    correo_electronico: string;
    clave_usuario: string;
    firma_muestreador?: string;
}

interface Props {
    initialData?: Muestreador | null;
    pendingRequests?: any[];
    onSave: () => void;
    onCancel: () => void;
    onViewRequests?: () => void;
}

export const MuestreadorForm: React.FC<Props> = ({ 
    initialData, 
    pendingRequests = [],
    onSave, 
    onCancel,
    onViewRequests
}) => {
    const [formData, setFormData] = useState<Muestreador>({
        nombre_muestreador: '',
        correo_electronico: '',
        clave_usuario: '',
        firma_muestreador: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        } else {
            setFormData({
                nombre_muestreador: '',
                correo_electronico: '',
                clave_usuario: '',
                firma_muestreador: ''
            });
        }
    }, [initialData]);

    const handleFileChange = (file: File | null) => {
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setFormData(prev => ({ ...prev, firma_muestreador: base64 }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setDuplicateWarning(null);

        try {
            if (initialData?.id_muestreador) {
                await adminService.updateMuestreador(initialData.id_muestreador, {
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    clave: formData.clave_usuario,
                    firma: formData.firma_muestreador
                });
                showToast({ type: 'success', message: 'Muestreador actualizado correctamente' });
            } else {
                // Check for duplicates
                const dupResult = await adminService.checkDuplicateMuestreador(
                    formData.nombre_muestreador,
                    formData.correo_electronico
                );
                const duplicates = dupResult?.data || [];
                if (duplicates.length > 0) {
                    const dup = duplicates[0];
                    const estado = dup.habilitado === 'S' ? 'Activo' : 'Inactivo';
                    setDuplicateWarning(
                        `Ya existe un muestreador similar: "${dup.nombre_muestreador}" (${dup.correo_electronico}) - Estado: ${estado}.`
                    );
                    setLoading(false);
                    return;
                }

                await adminService.createMuestreador({
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    clave: formData.clave_usuario,
                    firma: formData.firma_muestreador
                });
                showToast({ type: 'success', message: 'Muestreador creado correctamente' });
            }
            onSave();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Error al guardar los datos del muestreador');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container size="md" py="xl">
            <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
            
            <PageHeader
                title={initialData ? 'Editar Muestreador' : 'Nuevo Muestreador'}
                subtitle={initialData ? `Actualizando información de ${initialData.nombre_muestreador}` : 'Registra un nuevo técnico para toma de muestras'}
                onBack={onCancel}
            />

            <form onSubmit={handleSubmit}>
                <Stack gap="lg" mt="xl">
                    {error && (
                        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" variant="light" withCloseButton onClose={() => setError(null)}>
                            {error}
                        </Alert>
                    )}

                    {duplicateWarning && (
                        <Alert icon={<IconAlertCircle size={16} />} title="Advertencia" color="orange" variant="light">
                            {duplicateWarning}
                        </Alert>
                    )}

                    <Paper withBorder p="xl" radius="md" shadow="sm">
                        <Stack gap="md">
                            <Text fw={700} size="lg" c="blue.7">Información Personal</Text>
                            
                            <Group grow align="flex-start">
                                <TextInput
                                    label="Nombre Completo"
                                    placeholder="Ej: Juan Pérez"
                                    required
                                    leftSection={<IconUser size={18} stroke={1.5} />}
                                    value={formData.nombre_muestreador}
                                    onChange={(e) => setFormData({ ...formData, nombre_muestreador: e.target.value })}
                                    radius="md"
                                />
                                <TextInput
                                    label="Correo Electrónico"
                                    placeholder="ejemplo@adldiagnostic.cl"
                                    required
                                    leftSection={<IconMail size={18} stroke={1.5} />}
                                    value={formData.correo_electronico}
                                    onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                                    radius="md"
                                />
                            </Group>

                            <Group grow align="flex-start">
                                <PasswordInput
                                    label="Clave de Acceso"
                                    placeholder="******"
                                    required
                                    maxLength={6}
                                    description={`${formData.clave_usuario.length} / 6 caracteres`}
                                    value={formData.clave_usuario}
                                    onChange={(e) => setFormData({ ...formData, clave_usuario: e.target.value })}
                                    radius="md"
                                />
                                <Box /> {/* Spacer */}
                            </Group>
                        </Stack>
                    </Paper>

                    <Paper withBorder p="xl" radius="md" shadow="sm">
                        <Stack gap="md">
                            <Text fw={700} size="lg" c="blue.7">Firma Digital</Text>
                            <Text size="sm" c="dimmed">Esta firma se utilizará para validar las fichas de muestreo electrónicamente.</Text>
                            
                            <Box 
                                style={{ 
                                    border: '2px dashed var(--mantine-color-gray-3)', 
                                    borderRadius: '12px',
                                    padding: '2rem',
                                    backgroundColor: 'var(--mantine-color-gray-0)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: '200px'
                                }}
                            >
                                {formData.firma_muestreador ? (
                                    <Stack align="center">
                                        <Paper withBorder p="md" bg="white" radius="md" shadow="xs">
                                            <Image 
                                                src={formData.firma_muestreador} 
                                                h={120} 
                                                fit="contain" 
                                                alt="Vista previa firma" 
                                            />
                                        </Paper>
                                        <Button 
                                            variant="light" 
                                            color="red" 
                                            size="xs" 
                                            leftSection={<IconTrash size={14} />}
                                            onClick={() => setFormData({ ...formData, firma_muestreador: '' })}
                                        >
                                            Eliminar Firma
                                        </Button>
                                    </Stack>
                                ) : (
                                    <Stack align="center" gap="xs">
                                        <IconSignature size={48} stroke={1} color="var(--mantine-color-gray-5)" />
                                        <Text size="sm" c="dimmed">No hay firma registrada</Text>
                                        <FileButton onChange={handleFileChange} accept="image/png,image/jpeg">
                                            {(props) => (
                                                <Button 
                                                    {...props} 
                                                    variant="outline" 
                                                    leftSection={<IconUpload size={16} />}
                                                    radius="md"
                                                    mt="sm"
                                                >
                                                    Subir Imagen de Firma
                                                </Button>
                                            )}
                                        </FileButton>
                                    </Stack>
                                )}
                            </Box>
                        </Stack>
                    </Paper>

                    <Group justify="flex-end" mt="xl">
                        <Button variant="subtle" color="gray" onClick={onCancel} radius="md">
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            leftSection={<IconDeviceFloppy size={18} />} 
                            loading={loading}
                            radius="md"
                            px="xl"
                        >
                            Guardar Muestreador
                        </Button>
                    </Group>
                </Stack>
            </form>

            <Affix position={{ bottom: 20, right: 20 }}>
                <Transition transition="slide-up" mounted={pendingRequests.length > 0}>
                    {(transitionStyles) => (
                        <Button
                            leftSection={<IconBell size={20} />}
                            style={{ ...transitionStyles, boxShadow: 'var(--mantine-shadow-md)' }}
                            color="orange"
                            size="lg"
                            radius="xl"
                            onClick={onViewRequests}
                        >
                            Solicitudes ({pendingRequests.length})
                        </Button>
                    )}
                </Transition>
            </Affix>
        </Container>
    );
};
