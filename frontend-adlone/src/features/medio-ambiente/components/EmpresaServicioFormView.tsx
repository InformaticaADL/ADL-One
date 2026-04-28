import React, { useState, useEffect } from 'react';
import { 
    Stack, 
    Title, 
    Text, 
    Group, 
    Button, 
    Paper, 
    Divider,
    Box,
    Tabs,
    Container,
    TextInput,
    NumberInput,
    Select,
    SimpleGrid,
    ThemeIcon,
    LoadingOverlay,
    ActionIcon,
    Table,
    ScrollArea,
    Badge,
    Tooltip,
    SegmentedControl,
    Textarea
} from '@mantine/core';
import { 
    IconCheck, 
    IconPlus, 
    IconBuilding, 
    IconMail, 
    IconUser,
    IconEdit,
    IconSearch,
    IconArrowRight,
    IconMapPin,
    IconSettings
} from '@tabler/icons-react';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface EmpresaServicioFormViewProps {
    onBack: () => void;
}

export const EmpresaServicioFormView: React.FC<EmpresaServicioFormViewProps> = ({ onBack }) => {
    const { showToast } = useToast();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<string | null>('general');
    const [comunas, setComunas] = useState<{ value: string, label: string }[]>([]);
    const [users, setUsers] = useState<{ value: string, label: string }[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [userFilter, setUserFilter] = useState<string | null>(null);
    
    const [formData, setFormData] = useState<any>({});
    const [errors, setErrors] = useState<Record<string, string>>({});

    const COLUMN_LIMITS: Record<string, number> = {
        nombre_empresaservicios: 200,
        rut_empresaservicios: 50,
        giro_empresaservicios: 200,
        nombre_fantasia: 100,
        sigla: 100,
        resumenejecutivo: 5000,
        direccion_empresaservicios: 200,
        ciudad_empresaservicios: 100,
        direccion_comercial: 200,
        contacto_empresaservicios: 200,
        email_contacto: 200,
        email_empresaservicios: 200,
        email_facturacion: 200,
        fono_empresaservicios: 100,
        fono_contacto: 100,
        rlegal_nombre: 200,
        rlegal_rut: 50,
        rlegal_direccion: 200,
        usr_login: 50,
        precio_lista: 50,
        grupo: 50,
        categoria: 50,
        lote_facturacion: 20
    };

    const FLAG_FIELDS = [
        'jornada', 
        'envio_cotizacion', 
        'tablact', 
        'precio_especial', 
        'costo_op', 
        'mam_oc', 
        'lote_facturacion',
        'habilitado'
    ];

    const MANDATORY_FIELDS = [
        'nombre_empresaservicios',
        'rut_empresaservicios',
        'direccion_empresaservicios',
        'email_empresaservicios',
        'fono_empresaservicios',
        'contacto_empresaservicios',
        'email_contacto',
        'email_facturacion',
        'fono_contacto',
        'id_listaprecio',
        'envio_cotizacion',
        'giro_empresaservicios',
        'ciudad_empresaservicios',
        'habilitado',
        'precio_lista',
        'tablact',
        'precio_especial',
        'factor_km',
        'costo_op'
    ];

    const formatHeader = (str: string) => {
        return str.replace(/_/g, ' ')
            .replace(/empresaservicios/g, '')
            .replace(/contacto/g, 'contacto ')
            .replace(/rlegal/g, 'Rep. Legal ')
            .replace('id ', 'ID ')
            .replace('mam ', 'MAM ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const sections = {
        identificacion: [
            'nombre_empresaservicios', 
            'rut_empresaservicios', 
            'giro_empresaservicios', 
            'nombre_fantasia', 
            'sigla',
            'resumenejecutivo'
        ],
        ubicacion: [
            'direccion_empresaservicios', 
            'ciudad_empresaservicios', 
            'direccion_comercial'
        ],
        contacto: [
            'contacto_empresaservicios', 
            'email_contacto', 
            'email_empresaservicios', 
            'email_facturacion', 
            'fono_empresaservicios', 
            'fono_contacto'
        ],
        legal: [
            'rlegal_nombre', 
            'rlegal_rut', 
            'rlegal_direccion'
        ],
        avanzado: [
            'id_listaprecio',
            'id_giro',
            'id_direccion',
            'id_comuna',
            'id_formapago',
            'id_ciudad',
            'id_comunaef',
            'factor_km',
            'lote_facturacion'
        ],
        config: [
            'usr_login', 
            'jornada', 
            'envio_cotizacion',
            'tablact',
            'precio_especial',
            'costo_op',
            'precio_lista',
            'habilitado',
            'mam_oc',
            'grupo',
            'categoria'
        ]
    };

    useEffect(() => {
        fetchComunas();
        fetchUsers();
        if (view === 'list') {
            fetchData();
        }
    }, [view]);

    const fetchUsers = async () => {
        try {
            const data = await catalogosService.getMaestroData('mae_usuario');
            // Usar un Map para asegurar que no haya logins duplicados
            const uniqueUsersMap = new Map();
            data.forEach((u: any) => {
                const login = u.usuario || u.login_usuario || String(u.id_usuario);
                if (!uniqueUsersMap.has(login)) {
                    uniqueUsersMap.set(login, {
                        value: login,
                        label: u.nombre_usuario || u.usuario
                    });
                }
            });
            setUsers(Array.from(uniqueUsersMap.values()));
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    const fetchComunas = async () => {
        try {
            const data = await catalogosService.getMaestroData('mae_comuna');
            const uniqueComunasMap = new Map();
            data.forEach((c: any) => {
                const id = String(c.id_comuna);
                if (!uniqueComunasMap.has(id)) {
                    uniqueComunasMap.set(id, {
                        value: id,
                        label: c.nombre_comuna
                    });
                }
            });
            setComunas(Array.from(uniqueComunasMap.values()));
        } catch (error) {
            console.error('Error fetching comunas:', error);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await catalogosService.getMaestroData('mae_empresaservicios');
            setData(res || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            showToast({ type: 'error', message: 'Error al cargar empresas' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingId(null);
        setFormData({
            habilitado: 'S'
        });
        setErrors({});
        setView('form');
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id_empresaservicio);
        setFormData({ ...item });
        setErrors({});
        setView('form');
    };

    const validateField = (name: string, value: any) => {
        // 1. Validar longitud máxima siempre (si está definida)
        if (COLUMN_LIMITS[name] && typeof value === 'string' && value.length > COLUMN_LIMITS[name]) {
            return `Demasiado largo (máx ${COLUMN_LIMITS[name]} caract.)`;
        }

        // 2. Validar obligatoriedad solo si está en la lista de MANDATORY_FIELDS
        const isMandatory = MANDATORY_FIELDS.includes(name);
        const isEmpty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
        
        if (isMandatory && isEmpty) {
            return "Este campo es obligatorio";
        }

        return "";
    };

    const handleFieldChange = (name: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [name]: value }));
        const error = validateField(name, value);
        setErrors((prev: any) => ({ ...prev, [name]: error }));
    };

    const handleSubmit = async () => {
        // Validar que todos los campos de todas las secciones estén completos y correctos
        const allFields = Object.values(sections).flat();
        const newErrors: Record<string, string> = {};
        let hasErrors = false;

        for (const col of allFields) {
            const error = validateField(col, formData[col]);
            if (error) {
                newErrors[col] = error;
                hasErrors = true;
            }
        }

        setErrors(newErrors);

        if (hasErrors) {
            showToast({ 
                type: 'error', 
                message: `Existen errores en el formulario (${Object.keys(newErrors).length}). Por favor revise los campos marcados en rojo.` 
            });
            
            // Llevar al usuario a la primera pestaña con errores
            for (const [tab, fields] of Object.entries(sections)) {
                if (fields.some(f => newErrors[f])) {
                    setActiveTab(tab);
                    break;
                }
            }
            return;
        }

        setLoading(true);
        try {
            if (editingId) {
                await catalogosService.updateMaestro('mae_empresaservicios', 'id_empresaservicio', editingId, formData);
                showToast({ type: 'success', message: 'Empresa actualizada correctamente' });
            } else {
                await catalogosService.createMaestro('mae_empresaservicios', formData);
                showToast({ type: 'success', message: 'Empresa creada correctamente' });
            }
            setView('list');
        } catch (error) {
            console.error('Error saving:', error);
            showToast({ type: 'error', message: 'Error al guardar los cambios' });
        } finally {
            setLoading(false);
        }
    };

    const isFormComplete = () => {
        const allFields = Object.values(sections).flat();
        // El formulario es válido si ningún campo devuelve un mensaje de error
        return allFields.every(col => {
            const error = validateField(col, formData[col]);
            return error === "";
        });
    };

    const filteredData = data.filter(item => {
        const matchesSearch = Object.values(item).some(val => 
            String(val).toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const matchesStatus = statusFilter === 'ALL' || item.habilitado === statusFilter;
        const matchesUser = !userFilter || item.usr_login === userFilter;
        
        return matchesSearch && matchesStatus && matchesUser;
    });

    if (view === 'form') {
        return (
            <Box style={{ animation: 'fadeIn 0.5s ease' }}>
                <PageHeader 
                    title={editingId ? "Editar Empresa de Servicio" : "Crear Nueva Empresa"}
                    subtitle="Complete los datos de la empresa para habilitar sus servicios en el sistema."
                    onBack={() => setView('list')}
                    breadcrumbItems={[
                        { label: 'Fichas de Ingreso', onClick: onBack },
                        { label: 'Empresas de Servicio', onClick: () => setView('list') },
                        { label: editingId ? 'Editar' : 'Nueva' }
                    ]}
                />

                <Container fluid px="md" pb="xl" mt="xl">
                    <Paper withBorder p="md" radius="lg" shadow="sm">
                        <Tabs value={activeTab} onChange={setActiveTab} variant="pills" radius="md">
                            <Tabs.List mb="xl">
                                <Tabs.Tab value="general" leftSection={<IconBuilding size={16} />}>
                                    Identificación y Ubicación
                                </Tabs.Tab>
                                <Tabs.Tab value="contacto" leftSection={<IconMail size={16} />}>
                                    Contacto y Facturación
                                </Tabs.Tab>
                                <Tabs.Tab value="legal" leftSection={<IconUser size={16} />}>
                                    Legal y Configuración
                                </Tabs.Tab>
                                <Tabs.Tab value="avanzado" leftSection={<IconSettings size={16} />}>
                                    Avanzado
                                </Tabs.Tab>
                            </Tabs.List>

                            <Tabs.Panel value="general">
                                <Stack gap="xl">
                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="teal" size="md">
                                                <IconBuilding size={18} />
                                            </ThemeIcon>
                                            <Title order={4}>Identificación de la Empresa</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed">Datos legales, RUT y nombres comerciales de la prestadora.</Text>
                                    </Box>

                                    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                                        {sections.identificacion.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            if (col === 'resumenejecutivo') {
                                                return (
                                                    <Textarea 
                                                        key={col}
                                                        label={formatHeader(col)}
                                                        placeholder="Resumen de servicios, alcances, etc."
                                                        minRows={4}
                                                        size="md"
                                                        radius="md"
                                                        value={formData[col] || ''}
                                                        error={errors[col]}
                                                        required={isMandatory}
                                                        onChange={(e) => handleFieldChange(col, e.target.value)}
                                                        styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                    />
                                                );
                                            }
                                            return (
                                                <TextInput 
                                                    key={col}
                                                    label={formatHeader(col)}
                                                    placeholder={col}
                                                    size="md"
                                                    radius="md"
                                                    leftSection={<IconBuilding size={18} />}
                                                    value={formData[col] || ''}
                                                    error={errors[col]}
                                                    required={isMandatory}
                                                    onChange={(e) => handleFieldChange(col, e.target.value)}
                                                    styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>

                                    <Divider mt="md" />

                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="blue" size="md">
                                                <IconMapPin size={18} />
                                            </ThemeIcon>
                                            <Title order={4}>Ubicación y Direcciones</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed">Dirección casa matriz y sucursales comerciales.</Text>
                                    </Box>

                                    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                                        {sections.ubicacion.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            return (
                                                <TextInput 
                                                    key={col}
                                                    label={formatHeader(col)}
                                                    placeholder={col}
                                                    size="md"
                                                    radius="md"
                                                    leftSection={<IconMapPin size={18} />}
                                                    value={formData[col] || ''}
                                                    error={errors[col]}
                                                    required={isMandatory}
                                                    onChange={(e) => handleFieldChange(col, e.target.value)}
                                                    styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>

                                    <Divider mt="xl" />

                                    <Group justify="flex-end">
                                        <Button 
                                            variant="light" 
                                            rightSection={<IconArrowRight size={16} />} 
                                            onClick={() => setActiveTab('contacto')}
                                        >
                                            Siguiente: Contacto
                                        </Button>
                                    </Group>
                                </Stack>
                            </Tabs.Panel>

                            <Tabs.Panel value="contacto">
                                <Stack gap="xl">
                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="blue" size="md">
                                                <IconMail size={18} />
                                            </ThemeIcon>
                                            <Title order={4}>Información de Contacto y Facturación</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed">Canales de comunicación directa y facturación electrónica.</Text>
                                    </Box>

                                    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                                        {sections.contacto.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            return (
                                                <TextInput 
                                                    key={col}
                                                    label={formatHeader(col)}
                                                    placeholder={col}
                                                    size="md"
                                                    radius="md"
                                                    leftSection={col.includes('email') || col.includes('mail') ? <IconMail size={18} /> : <IconUser size={18} />}
                                                    value={formData[col] || ''}
                                                    error={errors[col]}
                                                    required={isMandatory}
                                                    onChange={(e) => handleFieldChange(col, e.target.value)}
                                                    styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>

                                    <Divider mt="xl" />

                                    <Group justify="flex-end">
                                        <Button 
                                            variant="light" 
                                            rightSection={<IconArrowRight size={16} />} 
                                            onClick={() => setActiveTab('legal')}
                                        >
                                            Siguiente: Legal
                                        </Button>
                                    </Group>
                                </Stack>
                            </Tabs.Panel>

                            <Tabs.Panel value="legal">
                                <Stack gap="xl">
                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="orange" size="md">
                                                <IconUser size={18} />
                                            </ThemeIcon>
                                            <Title order={4}>Representante Legal</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed">Información del representante ante el sistema.</Text>
                                    </Box>

                                    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                                        {sections.legal.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            return (
                                                <TextInput 
                                                    key={col}
                                                    label={formatHeader(col)}
                                                    placeholder={col}
                                                    size="md"
                                                    radius="md"
                                                    leftSection={<IconUser size={18} />}
                                                    value={formData[col] || ''}
                                                    error={errors[col]}
                                                    required={isMandatory}
                                                    onChange={(e) => handleFieldChange(col, e.target.value)}
                                                    styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>

                                    <Divider mt="md" />

                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="gray" size="md">
                                                <IconBuilding size={18} />
                                            </ThemeIcon>
                                            <Title order={4}>Configuración del Sistema</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed">Datos operativos y de login asociados.</Text>
                                    </Box>

                                    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                                        {sections.config.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            if (col === 'usr_login') {
                                                return (
                                                    <Select 
                                                        key={col}
                                                        label={formatHeader(col)}
                                                        placeholder={col}
                                                        searchable
                                                        clearable
                                                        size="md"
                                                        radius="md"
                                                        data={users}
                                                        value={String(formData[col] || '')}
                                                        error={errors[col]}
                                                        required={isMandatory}
                                                        onChange={(val) => handleFieldChange(col, val)}
                                                        styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                    />
                                                );
                                            }
                                            if (FLAG_FIELDS.includes(col)) {
                                                return (
                                                    <Select 
                                                        key={col}
                                                        label={formatHeader(col)}
                                                        placeholder="Seleccione"
                                                        size="md"
                                                        radius="md"
                                                        data={[
                                                            { value: 'S', label: 'Sí / Activo' },
                                                            { value: 'N', label: 'No / Inactivo' }
                                                        ]}
                                                        value={formData[col] || (col === 'habilitado' ? 'S' : 'N')}
                                                        error={errors[col]}
                                                        required={isMandatory}
                                                        onChange={(val) => handleFieldChange(col, val)}
                                                        styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                    />
                                                );
                                            }
                                            return (
                                                <TextInput 
                                                    key={col}
                                                    label={formatHeader(col)}
                                                    placeholder={col}
                                                    size="md"
                                                    radius="md"
                                                    leftSection={<IconSettings size={18} />}
                                                    value={formData[col] || ''}
                                                    error={errors[col]}
                                                    onChange={(e) => handleFieldChange(col, e.target.value)}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>

                                    <Divider mt="xl" />

                                    <Group justify="flex-end">
                                        <Button 
                                            variant="light" 
                                            rightSection={<IconArrowRight size={16} />} 
                                            onClick={() => setActiveTab('avanzado')}
                                        >
                                            Siguiente: Avanzado
                                        </Button>
                                    </Group>
                                </Stack>
                            </Tabs.Panel>

                            <Tabs.Panel value="avanzado">
                                <Stack gap="xl">
                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="red" size="md">
                                                <IconSettings size={18} />
                                            </ThemeIcon>
                                            <Title order={4}>Configuración Avanzada e IDs</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed">Identificadores técnicos y parámetros de integración con otros módulos.</Text>
                                    </Box>

                                    <SimpleGrid cols={{ base: 1, md: 2, lg: 3 }} spacing="lg">
                                        {sections.avanzado.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            if (col === 'id_comuna' || col === 'id_comunaef') {
                                                return (
                                                    <Select 
                                                        key={col}
                                                        label={formatHeader(col)}
                                                        placeholder="Seleccione Comuna"
                                                        searchable
                                                        clearable
                                                        size="md"
                                                        radius="md"
                                                        data={comunas}
                                                        value={String(formData[col] || '')}
                                                        error={errors[col]}
                                                        required={isMandatory}
                                                        onChange={(val) => handleFieldChange(col, val ? Number(val) : null)}
                                                        styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                    />
                                                );
                                            }
                                            if (col === 'lote_facturacion') {
                                                return (
                                                    <TextInput 
                                                        key={col}
                                                        label={formatHeader(col)}
                                                        placeholder="Lote"
                                                        size="md"
                                                        radius="md"
                                                        value={formData[col] || ''}
                                                        error={errors[col]}
                                                        required={isMandatory}
                                                        onChange={(e) => handleFieldChange(col, e.target.value)}
                                                        styles={isMandatory ? { label: { color: 'var(--mantine-color-blue-filled)' } } : {}}
                                                    />
                                                );
                                            }
                                            return (
                                                <NumberInput 
                                                    key={col}
                                                    label={formatHeader(col)}
                                                    placeholder="Sin asignar"
                                                    size="md"
                                                    radius="md"
                                                    value={formData[col] === undefined || formData[col] === null ? '' : formData[col]}
                                                    error={errors[col]}
                                                    required={isMandatory}
                                                    onChange={(val) => handleFieldChange(col, val === '' ? null : val)}
                                                    styles={isMandatory ? { 
                                                        label: { color: 'var(--mantine-color-blue-filled)' },
                                                        input: { borderLeft: '3px solid var(--mantine-color-blue-filled)' }
                                                    } : {}}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>

                                    <Divider mt="xl" />

                                    <Group justify="flex-end" gap="md">
                                        <Button variant="light" color="gray" onClick={() => setView('list')} size="md" radius="md">
                                            Cancelar
                                        </Button>
                                        <Button 
                                            color="teal" 
                                            size="md" 
                                            radius="md" 
                                            onClick={handleSubmit}
                                            loading={loading}
                                            disabled={!isFormComplete()}
                                            leftSection={<IconCheck size={20} />}
                                        >
                                            {editingId ? 'Guardar Cambios' : 'Crear Empresa'}
                                        </Button>
                                    </Group>
                                </Stack>
                            </Tabs.Panel>
                        </Tabs>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box style={{ animation: 'fadeIn 0.5s ease' }}>
            <PageHeader 
                title="Gestión de Empresas de Servicio"
                subtitle="Administre el catálogo de proveedores de servicios de muestreo y terreno."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: 'Empresas de Servicio' }
                ]}
                rightSection={
                    <Button 
                        leftSection={<IconPlus size={18} />}
                        color="teal"
                        radius="md"
                        onClick={handleCreate}
                    >
                        Nueva Empresa
                    </Button>
                }
            />

            <Container fluid px="md" pb="xl" mt="xl">
                <Paper withBorder p="md" radius="lg" shadow="sm">
                    <Stack gap="md">
                        <Group justify="space-between" align="flex-end">
                            <Group align="flex-end" style={{ flex: 1 }}>
                                <TextInput 
                                    label="Búsqueda Rápida"
                                    placeholder="Nombre, RUT, Email..."
                                    leftSection={<IconSearch size={16} />}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                    style={{ width: 300 }}
                                    radius="md"
                                />

                                <Box>
                                    <Text size="xs" fw={700} mb={5} c="dimmed">Filtrar por Estado</Text>
                                    <SegmentedControl
                                        value={statusFilter}
                                        onChange={setStatusFilter}
                                        radius="md"
                                        data={[
                                            { label: 'Todos', value: 'ALL' },
                                            { label: 'Activos', value: 'S' },
                                            { label: 'Inactivos', value: 'N' },
                                        ]}
                                    />
                                </Box>

                                <Select 
                                    label="Responsable"
                                    placeholder="Todos los responsables"
                                    data={users}
                                    value={userFilter}
                                    onChange={setUserFilter}
                                    clearable
                                    searchable
                                    radius="md"
                                    style={{ width: 250 }}
                                />
                            </Group>

                            <Badge variant="light" color="blue" size="lg" radius="sm">
                                Total: {filteredData.length}
                            </Badge>
                        </Group>

                        <Divider />

                        <Box pos="relative">
                            <LoadingOverlay visible={loading} overlayProps={{ blur: 2 }} />
                            <ScrollArea offsetScrollbars>
                                <Table verticalSpacing="md" highlightOnHover>
                                    <Table.Thead bg="gray.0">
                                        <Table.Tr>
                                            <Table.Th>Nombre</Table.Th>
                                            <Table.Th>Contacto</Table.Th>
                                            <Table.Th>Email</Table.Th>
                                            <Table.Th ta="center">Estado</Table.Th>
                                            <Table.Th ta="right">Acciones</Table.Th>
                                        </Table.Tr>
                                    </Table.Thead>
                                    <Table.Tbody>
                                        {filteredData.length > 0 ? (
                                            filteredData.map((item) => (
                                                <Table.Tr key={item.id_empresaservicio}>
                                                    <Table.Td>
                                                        <Group gap="sm">
                                                            <ThemeIcon variant="light" color="teal" size="sm">
                                                                <IconBuilding size={14} />
                                                            </ThemeIcon>
                                                            <Text size="sm" fw={600}>{item.nombre_empresaservicios}</Text>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm">{item.contacto_empresaservicios || '-'}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Text size="sm" c="dimmed">{item.email_empresaservicios || item.email_contacto || '-'}</Text>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group justify="center">
                                                            <Badge color={item.habilitado === 'S' ? 'green' : 'red'} variant="light">
                                                                {item.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                                            </Badge>
                                                        </Group>
                                                    </Table.Td>
                                                    <Table.Td>
                                                        <Group justify="flex-end" gap="xs">
                                                            <Tooltip label="Editar">
                                                                <ActionIcon variant="light" color="blue" onClick={() => handleEdit(item)}>
                                                                    <IconEdit size={16} />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        </Group>
                                                    </Table.Td>
                                                </Table.Tr>
                                            ))
                                        ) : (
                                            <Table.Tr>
                                                <Table.Td colSpan={5} ta="center" py="xl">
                                                    <Text c="dimmed">No se encontraron empresas</Text>
                                                </Table.Td>
                                            </Table.Tr>
                                        )}
                                    </Table.Tbody>
                                </Table>
                            </ScrollArea>
                        </Box>
                    </Stack>
                </Paper>
            </Container>
        </Box>
    );
};
