import React, { useState, useEffect } from 'react';
import { 
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
    FileInput,
    Anchor,
    Checkbox,
    Badge,
    ActionIcon,
    Affix,
    Transition,
    SimpleGrid,
    Container
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

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
    // Helper to safely read clave_usuario length (guards against undefined from API responses)
    const claveLength = (formData.clave_usuario ?? '').length;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // --- Documentos ---
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docNombre, setDocNombre] = useState('');
    const [docUploading, setDocUploading] = useState(false);

    // --- Competencias ---
    const [allCompetencias, setAllCompetencias] = useState<any[]>([]);      // activas (asignables)
    const [compAsignadas, setCompAsignadas] = useState<any[]>([]);          // asignadas (incluye inactivas)
    const [compSeleccionadas, setCompSeleccionadas] = useState<number[]>([]); // ids activas marcadas

    useEffect(() => {
        if (initialData) {
            setFormData({ ...initialData, clave_usuario: initialData.clave_usuario ?? '' });
        } else {
            setFormData({
                nombre_muestreador: '',
                correo_electronico: '',
                clave_usuario: '',
                firma_muestreador: ''
            });
        }
    }, [initialData]);

    useEffect(() => {
        adminService.getCompetencias(false).then(setAllCompetencias).catch(() => {});
        const id = initialData?.id_muestreador;
        if (id) {
            adminService.getDocumentosMuestreador(id).then(setDocumentos).catch(() => {});
            adminService.getCompetenciasMuestreador(id).then((rows: any[]) => {
                setCompAsignadas(rows);
                setCompSeleccionadas(rows.filter(r => r.activo === 'S').map(r => r.id_competencia));
            }).catch(() => {});
        } else {
            setDocumentos([]); setCompAsignadas([]); setCompSeleccionadas([]);
        }
    }, [initialData]);

    const handleUploadDoc = async () => {
        const id = initialData?.id_muestreador;
        if (!id || !docFile) return;
        setDocUploading(true);
        try {
            await adminService.uploadDocumentoMuestreador(id, docFile, docNombre || docFile.name);
            const list = await adminService.getDocumentosMuestreador(id);
            setDocumentos(list);
            setDocFile(null); setDocNombre('');
            showToast({ type: 'success', message: 'Documento agregado' });
        } catch {
            showToast({ type: 'error', message: 'Error al subir documento' });
        } finally { setDocUploading(false); }
    };

    const handleDeleteDoc = async (idDoc: number) => {
        try {
            await adminService.deleteDocumentoMuestreador(idDoc);
            setDocumentos(prev => prev.filter(d => d.id_documento !== idDoc));
            showToast({ type: 'success', message: 'Documento eliminado' });
        } catch {
            showToast({ type: 'error', message: 'Error al eliminar documento' });
        }
    };

    const handleFileChange = (file: File | null) => {
        if (!file) return;
        // MS-06: validar tipo (solo imagen png/jpg/jpeg)
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            showToast({ type: 'error', message: 'La firma debe ser una imagen PNG o JPG. Formato no permitido.' });
            return;
        }
        // MS-07: validar tamaño máximo 2 MB (suficiente para firmas)
        const MAX_SIZE = 2 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
            showToast({ type: 'error', message: `La firma supera el tamaño máximo (${sizeMb} MB). Máximo permitido: 2 MB.` });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setFormData(prev => ({ ...prev, firma_muestreador: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setDuplicateWarning(null);

        try {
            if (initialData?.id_muestreador) {
                // MS-05: si el usuario no escribió clave nueva, no la enviamos (se conserva la actual).
                const payload: any = {
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    firma: formData.firma_muestreador
                };
                if (formData.clave_usuario && formData.clave_usuario.trim()) {
                    payload.clave = formData.clave_usuario;
                }
                await adminService.updateMuestreador(initialData.id_muestreador, payload);
                await adminService.setCompetenciasMuestreador(initialData.id_muestreador, compSeleccionadas);
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

                const created = await adminService.createMuestreador({
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    clave: formData.clave_usuario,
                    firma: formData.firma_muestreador
                });
                const newId = created?.data?.id_muestreador;
                if (newId && compSeleccionadas.length > 0) {
                    try { await adminService.setCompetenciasMuestreador(newId, compSeleccionadas); } catch { /* no bloquear creación */ }
                }
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
        <Container size="md" py={isMobile ? "md" : "xl"} px={isMobile ? "xs" : "md"}>
            <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
            
            <PageHeader
                title={initialData ? 'Editar Muestreador' : 'Nuevo Muestreador'}
                subtitle={!isMobile ? (initialData ? `Actualizando información de ${initialData.nombre_muestreador}` : 'Registra un nuevo técnico para toma de muestras') : undefined}
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

                    <Paper withBorder p={isMobile ? "md" : "xl"} radius="md" shadow="sm">
                        <Stack gap="md">
                            <Text fw={700} size="lg" c="blue.7" ta={isMobile ? "center" : "left"}>Información Personal</Text>
                            
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
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
                            </SimpleGrid>

                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                                <PasswordInput
                                    label={initialData?.id_muestreador ? "Clave de Acceso (opcional)" : "Clave de Acceso"}
                                    placeholder={initialData?.id_muestreador ? "Dejar vacío para conservar la actual" : "******"}
                                    required={!initialData?.id_muestreador}
                                    maxLength={6}
                                    description={initialData?.id_muestreador
                                        ? `${claveLength} / 6 caracteres — solo escriba si desea cambiarla`
                                        : `${claveLength} / 6 caracteres`}
                                    value={formData.clave_usuario ?? ''}
                                    onChange={(e) => setFormData({ ...formData, clave_usuario: e.target.value })}
                                    radius="md"
                                />
                                {!isMobile && <Box />} {/* Spacer only for desktop */}
                            </SimpleGrid>
                        </Stack>
                    </Paper>

                    <Paper withBorder p={isMobile ? "md" : "xl"} radius="md" shadow="sm">
                        <Stack gap="md">
                            <Text fw={700} size="lg" c="blue.7" ta={isMobile ? "center" : "left"}>Firma Digital</Text>
                            <Text size="sm" c="dimmed" ta={isMobile ? "center" : "left"}>Esta firma se utilizará para validar las fichas de muestreo electrónicamente.</Text>
                            
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
                                        <ProtectedContent permission="MU_FIRMA">
                                            <Button 
                                                variant="light" 
                                                color="red" 
                                                size="xs" 
                                                leftSection={<IconTrash size={14} />}
                                                onClick={() => setFormData({ ...formData, firma_muestreador: '' })}
                                            >
                                                Eliminar Firma
                                            </Button>
                                        </ProtectedContent>
                                    </Stack>
                                ) : (
                                    <Stack align="center" gap="xs">
                                        <IconSignature size={48} stroke={1} color="var(--mantine-color-gray-5)" />
                                        <Text size="sm" c="dimmed">No hay firma registrada</Text>
                                        <ProtectedContent permission="MU_FIRMA">
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
                                        </ProtectedContent>
                                    </Stack>
                                )}
                            </Box>
                        </Stack>
                    </Paper>

                    {/* --- Competencias --- */}
                    <Paper withBorder p={isMobile ? "md" : "xl"} radius="md" shadow="sm">
                        <Stack gap="md">
                            <Text fw={700} size="lg" c="blue.7" ta={isMobile ? "center" : "left"}>Competencias</Text>
                            <Text size="sm" c="dimmed">Marque las competencias del muestreador. Se pueden agregar y quitar libremente.</Text>
                            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={4}>
                                {allCompetencias.map(c => (
                                    <Checkbox
                                        key={c.id_competencia}
                                        label={c.nombre_competencia}
                                        checked={compSeleccionadas.includes(c.id_competencia)}
                                        onChange={(e) => {
                                            const on = e.currentTarget.checked;
                                            setCompSeleccionadas(prev => on ? [...prev, c.id_competencia] : prev.filter(x => x !== c.id_competencia));
                                        }}
                                    />
                                ))}
                            </SimpleGrid>
                            {compAsignadas.filter(c => c.activo !== 'S').length > 0 && (
                                <Box>
                                    <Text size="xs" fw={600} c="dimmed" mt="sm">Competencias inactivas (conservadas):</Text>
                                    <Group gap={4} mt={4}>
                                        {compAsignadas.filter(c => c.activo !== 'S').map(c => (
                                            <Badge key={c.id_competencia} color="gray" variant="light">{c.nombre_competencia}</Badge>
                                        ))}
                                    </Group>
                                </Box>
                            )}
                        </Stack>
                    </Paper>

                    {/* --- Documentos / Certificados (solo en edición) --- */}
                    {initialData?.id_muestreador && (
                        <Paper withBorder p={isMobile ? "md" : "xl"} radius="md" shadow="sm">
                            <Stack gap="md">
                                <Text fw={700} size="lg" c="blue.7" ta={isMobile ? "center" : "left"}>Documentos / Certificados</Text>
                                <Text size="sm" c="dimmed">Adjunte respaldos de cursos o capacitaciones (disponible para cualquier muestreador).</Text>
                                <Stack gap="xs">
                                    {documentos.length === 0 && <Text size="xs" c="dimmed">Sin documentos.</Text>}
                                    {documentos.map(d => (
                                        <Group key={d.id_documento} justify="space-between" wrap="nowrap">
                                            <Anchor href={d.ruta_archivo} target="_blank" size="sm" truncate>{d.nombre_documento}</Anchor>
                                            <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteDoc(d.id_documento)}><IconTrash size={16} /></ActionIcon>
                                        </Group>
                                    ))}
                                </Stack>
                                <Group align="flex-end" gap="xs">
                                    <FileInput placeholder="Seleccionar archivo" value={docFile} onChange={setDocFile} accept="application/pdf,image/*" style={{ flex: 1 }} clearable />
                                    <TextInput placeholder="Nombre/Título (opcional)" value={docNombre} onChange={e => setDocNombre(e.currentTarget.value)} style={{ flex: 1 }} />
                                    <Button onClick={handleUploadDoc} loading={docUploading} disabled={!docFile} leftSection={<IconUpload size={16} />}>Subir</Button>
                                </Group>
                            </Stack>
                        </Paper>
                    )}

                    <Group justify="flex-end" mt="xl" grow={isMobile}>
                        <Button variant="subtle" color="gray" onClick={onCancel} radius="md" size={isMobile ? "md" : "sm"}>
                            Cancelar
                        </Button>
                        <Button 
                            type="submit" 
                            leftSection={<IconDeviceFloppy size={18} />} 
                            loading={loading}
                            radius="md"
                            px="xl"
                            size={isMobile ? "md" : "sm"}
                        >
                            Guardar {isMobile ? '' : 'Muestreador'}
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
