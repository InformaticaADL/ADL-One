import React, { useState, useEffect, useMemo } from 'react';
import { 
    Table, 
    Text, 
    Group, 
    ActionIcon, 
    TextInput, 
    Button, 
    Modal, 
    Stack, 
    Paper, 
    Badge, 
    Tooltip, 
    Loader,
    Select,
    Alert,
    Pagination,
    ScrollArea,
    Box,
    SimpleGrid,
    ThemeIcon,
    Divider,
    Tabs,
    Container,
    Title,
    FileInput,
    Image
} from '@mantine/core';
import { 
    IconEdit, 
    IconTrash, 
    IconPlus, 
    IconSearch, 
    IconArrowLeft,
    IconCheck,
    IconAlertCircle,
    IconSettings,
    IconActivity,
    IconMail,
    IconUser,
    IconMapPin,
    IconBuilding,
    IconId,
    IconPhone,
    IconCalendar,
    IconArrowRight,
    IconUpload
} from '@tabler/icons-react';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';

interface MaestroConfig {
    id: string;
    label: string;
    tableName: string;
    idName: string;
    displayColumn?: string;
    summaryColumns?: string[];
    statusColumn?: string;
    dependsOn?: string;
    lookups?: {
        [fieldName: string]: {
            tableName: string;
            idColumn: string;
            displayColumn: string;
            noCreate?: boolean;
        }
    };
}

interface Props {
    config: MaestroConfig;
    onBack: () => void;
}

export const MaestroDataManager: React.FC<Props> = ({ config, onBack }) => {
    const { showToast } = useToast();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<any>({});
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [view, setView] = useState<'list' | 'form'>('list');
    const [quickCreateType, setQuickCreateType] = useState<'clientes' | 'componentes' | null>(null);
    const [quickFormData, setQuickFormData] = useState<any>({});
    const [quickSaving, setQuickSaving] = useState(false);

    // Quick-create FK inline modal
    const [quickFk, setQuickFk] = useState<{ field: string; lookup: { tableName: string; idColumn: string; displayColumn: string } } | null>(null);
    const [quickFkCols, setQuickFkCols] = useState<string[]>([]);
    const [quickFkFormData, setQuickFkFormData] = useState<any>({});
    const [quickFkSaving, setQuickFkSaving] = useState(false);

    const openQuickFk = async (field: string, lookup: { tableName: string; idColumn: string; displayColumn: string }) => {
        setQuickFk({ field, lookup });
        setQuickFkFormData({});
        try {
            // Fetch one sample row to discover columns
            const sample = await catalogosService.getMaestroData(lookup.tableName);
            if (sample && sample.length > 0) {
                const cols = Object.keys(sample[0]).filter(k => k !== lookup.idColumn && k !== 'id');
                setQuickFkCols(cols);
            } else {
                // Fallback: just show the display column
                setQuickFkCols([lookup.displayColumn]);
            }
        } catch {
            setQuickFkCols([lookup.displayColumn]);
        }
    };


    // For lookups (foreign keys)
    const [lookupData, setLookupData] = useState<{[key: string]: any[]}>({});
    
    // Pagination state
    const [page, setPage] = useState(1);
    const itemsPerPage = 12;
    
    // For dependency checks
    const [dependencyData, setDependencyData] = useState<any[]>([]);
    const [dependencyLoading, setDependencyLoading] = useState(false);

    // Fetch primary data
    const fetchData = async () => {
        setLoading(true);
        setFetchError(null);
        try {
            const data = await catalogosService.getMaestroData(config.tableName);
            setData(data || []);
        } catch (error: any) {
            const msg = error?.response?.data?.message || error?.message || 'Error desconocido';
            console.error(`Error fetching ${config.tableName}:`, msg);
            setFetchError(`No se pudo cargar "${config.label}": ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    // Check dependencies (e.g., if we need Clientes to create a Centro)
    useEffect(() => {
        const checkDependencies = async () => {
            if (config.dependsOn) {
                setDependencyLoading(true);
                try {
                    let depResult: any[] = [];
                    if (config.dependsOn === 'clientes') depResult = await catalogosService.getClientes();
                    if (config.dependsOn === 'componentes') depResult = await catalogosService.getComponentesAmbientales();
                    setDependencyData(depResult || []);
                } catch (err) {
                    console.error('Error loading dependency:', err);
                } finally {
                    setDependencyLoading(false);
                }
            }
        };
        const fetchLookups = async () => {
            if (config.lookups) {
                try {
                    const results: {[key: string]: any[]} = {};
                    for (const [field, lookup] of Object.entries(config.lookups)) {
                        let data: any[] = [];
                        // Use dedicated endpoints for known tables (more reliable than generic SELECT *)
                        if (lookup.tableName === 'mae_cargo') {
                            data = await catalogosService.getCargos();
                        } else if (lookup.tableName === 'mae_rol') {
                            data = await catalogosService.getRoles();
                        } else if (lookup.tableName === 'mae_empresa') {
                            data = await catalogosService.getEmpresas();
                        } else if (lookup.tableName === 'mae_usuario') {
                            // Use the RBAC users endpoint for reliable user lookup
                            data = await catalogosService.getMaestroData('mae_usuario');
                            // Map 'usuario' field to a combined display name for readability
                            data = data.map((u: any) => ({ ...u, nombre_usuario: u.nombre_usuario || u.usuario || `Usuario ${u.id_usuario}` }));
                        } else {
                            data = await catalogosService.getMaestroData(lookup.tableName);
                        }
                        results[field] = data || [];
                    }
                    setLookupData(results);
                } catch (err) {
                    console.error('Error fetching lookups:', err);
                }
            }
        };

        checkDependencies();
        fetchLookups();
        fetchData();
    }, [config]);

    const filteredData = useMemo(() => {
        let filtered = data;

        // Apply status filter
        if (statusFilter !== 'all') {
            filtered = filtered.filter(item => {
                const status = item[config.statusColumn || 'habilitado'] || item.activo || item.estado || 'S';
                const isActive = status === 'S' || status === 'V' || status === 1 || status === true;
                return statusFilter === 'active' ? isActive : !isActive;
            });
        }

        // Apply search term filter
        if (!searchTerm) return filtered;
        const s = searchTerm.toLowerCase();
        return filtered.filter(item => 
            Object.values(item).some(val => 
                String(val).toLowerCase().includes(s)
            )
        );
    }, [data, searchTerm, statusFilter, config]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return filteredData.slice(start, start + itemsPerPage);
    }, [filteredData, page]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    // Reset page when search changes
    useEffect(() => {
        setPage(1);
    }, [searchTerm, statusFilter]);

    const handleOpenModal = (item: any = null) => {
        setEditingItem(item);
        if (item) {
            // Convert all values to strings so Select components find their values
            const normalized: any = {};
            Object.entries(item).forEach(([k, v]) => {
                normalized[k] = v === null || v === undefined ? '' : String(v);
            });
            setFormData(normalized);
        } else {
            const defaults: any = {};
            if (config.statusColumn) defaults[config.statusColumn] = 'S';
            setFormData(defaults);
        }
        setView('form');
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editingItem) {
                // Update
                const idValue = editingItem[config.idName];
                // Clean data (don't send ID in the update body if not needed, or send carefully)
                const { [config.idName]: _, ...cleanData } = formData;
                await catalogosService.updateMaestro(config.tableName, config.idName, idValue, cleanData);
                showToast({ type: 'success', message: 'Registro actualizado correctamente' });
            } else {
                // Create
                await catalogosService.createMaestro(config.tableName, formData);
                showToast({ type: 'success', message: 'Registro creado correctamente' });
            }
            setView('list');
            fetchData();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al guardar cambios' });
        } finally {
            setSaving(false);
        }
    };

    const handleQuickSave = async () => {
        if (quickSaving) return;
        setQuickSaving(true);
        try {
            const tableName = quickCreateType === 'clientes' ? 'mae_empresa' : 'mae_tipomuestra';
            await catalogosService.createMaestro(tableName, quickFormData);
            showToast({ type: 'success', message: 'Registro creado correctamente' });
            
            // Refrescar dependencias
            const depResult = quickCreateType === 'clientes' 
                ? await catalogosService.getClientes() 
                : await catalogosService.getComponentesAmbientales();
            setDependencyData(depResult || []);
            
            setQuickCreateType(null);
            setQuickFormData({});
        } catch (error: any) {
            showToast({ type: 'error', message: 'Error al crear el registro rápido' });
        } finally {
            setQuickSaving(false);
        }
    };

    const handleToggleStatus = async (item: any) => {
        const statusCol = config.statusColumn || 'habilitado';
        const currentStatus = item[statusCol];
        const idValue = item[config.idName];

        // Detect value type and toggle accordingly
        let newStatus: any;
        let isNowActive: boolean;
        if (typeof currentStatus === 'boolean') {
            newStatus = !currentStatus;
            isNowActive = newStatus;
        } else if (currentStatus === 1 || currentStatus === 0) {
            newStatus = currentStatus === 1 ? 0 : 1;
            isNowActive = newStatus === 1;
        } else {
            // String 'S'/'N' or similar
            newStatus = (currentStatus === 'S' || currentStatus === 'V' || currentStatus === 'A') ? 'N' : 'S';
            isNowActive = newStatus === 'S';
        }

        try {
            await catalogosService.toggleMaestroStatus(config.tableName, config.idName, idValue, statusCol, newStatus);
            showToast({ type: 'success', message: `Registro ${isNowActive ? 'habilitado' : 'deshabilitado'} correctamente` });
            fetchData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cambiar el estado' });
        }
    };


    // Helper to format technical keys to readable headers
    const formatHeader = (key: string) => {
        return key
            .replace(/_/g, ' ')
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Get columns to show in the main table based on config or discovery
    const mainTableColumns = useMemo(() => {
        if (data.length === 0) return [];

        // Columns that are always rendered separately (ID column + Estado column)
        const alwaysExcluded = [
            config.idName,
            'id',
            config.statusColumn,  // explicit status column
            // Auto-detect common status column names to avoid duplication with the fixed Estado column
            'habilitado', 'activo', 'estado', 'active', 'enabled'
        ].filter(Boolean) as string[];

        if (config.summaryColumns && config.summaryColumns.length > 0) {
            // Even in summaryColumns, remove any that match excluded names
            return config.summaryColumns.filter(col => !alwaysExcluded.includes(col));
        }
        // Auto-discover: show everything except excluded cols
        return Object.keys(data[0]).filter(key => !alwaysExcluded.includes(key));
    }, [data, config]);

    // All columns for the form view
    const allDetailColumns = useMemo(() => {
        if (data.length === 0) return [];
        // Only exclude the PK id - everything else is editable
        return Object.keys(data[0]).filter(key => key !== config.idName && key !== 'id');
    }, [data, config]);

    const needsDependency = useMemo(() => 
        Boolean(config.dependsOn && dependencyData.length === 0 && !dependencyLoading),
    [config.dependsOn, dependencyData.length, dependencyLoading]);

    // Detect if table actually has a status column in the data
    const hasStatusColumn = useMemo(() => {
        if (data.length === 0) return false;
        const knownStatusCols = ['habilitado', 'activo', 'estado', 'active', 'enabled'];
        const explicit = config.statusColumn;
        const dataKeys = Object.keys(data[0]);
        return explicit ? dataKeys.includes(explicit) : knownStatusCols.some(c => dataKeys.includes(c));
    }, [data, config]);

    // Detect icon for a field based on name patterns
    const getFieldIcon = (col: string) => {
        const c = col.toLowerCase();
        if (c.includes('email') || c.includes('mail')) return <IconMail size={16} />;
        if (c.includes('nombre') || c.includes('contacto') || c.includes('usuario')) return <IconUser size={16} />;
        if (c.includes('telefon') || c.includes('fono') || c.includes('cel')) return <IconPhone size={16} />;
        if (c.includes('direccion') || c.includes('ciudad') || c.includes('region') || c.includes('comuna') || c.includes('ubicacion')) return <IconMapPin size={16} />;
        if (c.includes('empresa') || c.includes('rut') || c.includes('giro')) return <IconBuilding size={16} />;
        if (c.includes('id_') || c.includes('codigo') || c.includes('sigla')) return <IconId size={16} />;
        if (c.includes('fecha') || c.includes('date')) return <IconCalendar size={16} />;
        return null;
    };

    const renderField = (col: string) => {
        const icon = getFieldIcon(col);
        const isLookup = config.lookups && config.lookups[col];

        if (isLookup) {
            const lookup = config.lookups![col];
            const options = lookupData[col] || [];
            
            return (
                <Group key={col} align="flex-end" gap={6} style={{ flexWrap: 'nowrap' }}>
                    <Select 
                        style={{ flex: 1 }}
                        label={formatHeader(col)}
                        placeholder={`Seleccione ${formatHeader(col)}...`}
                        data={options.map(opt => ({ 
                            value: String(opt[lookup.idColumn]), 
                            label: String(opt[lookup.displayColumn]) 
                        }))}
                        value={formData[col] === null || formData[col] === undefined ? '' : String(formData[col])}
                        onChange={(v) => setFormData({ ...formData, [col]: v })}
                        searchable
                        nothingFoundMessage="Sin opciones disponibles"
                        size="md"
                        radius="md"
                        styles={{
                            label: { color: 'var(--mantine-color-blue-filled)', fontWeight: 600 },
                            input: { borderLeft: '3px solid var(--mantine-color-blue-5)' }
                        }}
                    />
                    {!lookup.noCreate && (
                        <Tooltip label={`Crear nuevo en ${lookup.tableName}`} position="top">
                            <ActionIcon
                                size="lg"
                                variant="light"
                                color="green"
                                radius="md"
                                mb={1}
                                onClick={() => openQuickFk(col, lookup)}
                            >
                                <IconPlus size={18} />
                            </ActionIcon>
                        </Tooltip>
                    )}
                </Group>
            );
        }

        // ── IMAGE / FIRMA FIELDS ───────────────────────────────────────────
        const isImageField = ['firma_', 'foto', 'imagen', 'logo', 'avatar', 'signature'].some(p => col.toLowerCase().includes(p));

        if (isImageField) {
            const currentPath = formData[col];
            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
            const previewUrl = currentPath && !currentPath.startsWith('http')
                ? `${apiBase}${currentPath}`
                : currentPath || null;

            const handleFileChange = async (file: File | null) => {
                if (!file) return;
                const fd = new FormData();
                fd.append('archivo', file);
                try {
                    const token = localStorage.getItem('token');
                    const res = await fetch(`${apiBase}/api/upload`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                        body: fd,
                    });
                    const json = await res.json();
                    if (json.success) {
                        setFormData((prev: any) => ({ ...prev, [col]: json.filePath }));
                    }
                } catch (err) {
                    console.error('Error uploading file:', err);
                }
            };

            return (
                <Box key={col}>
                    <Text size="sm" fw={600} c="blue" mb={6}>{formatHeader(col)}</Text>
                    {previewUrl && (
                        <Box mb={8} style={{ border: '1px solid #dee2e6', borderRadius: 8, padding: 8, display: 'inline-block', background: '#f8f9fa' }}>
                            <Image
                                src={previewUrl}
                                alt={col}
                                h={120}
                                w="auto"
                                fit="contain"
                                radius="sm"
                                fallbackSrc="https://placehold.co/200x120?text=Sin+imagen"
                            />
                            <Text size="xs" c="dimmed" mt={4} ta="center">{currentPath}</Text>
                        </Box>
                    )}
                    <FileInput
                        placeholder={previewUrl ? 'Cambiar imagen...' : 'Seleccionar imagen...'}
                        accept="image/*"
                        leftSection={<IconUpload size={16} />}
                        onChange={handleFileChange}
                        size="md"
                        radius="md"
                        styles={{ input: { borderLeft: '3px solid var(--mantine-color-blue-5)' } }}
                    />
                </Box>
            );
        }

        // Precise boolean detection: exact names, or specific prefixes (no false positives on 'nombre_estadomuestreo')
        const boolExact    = ['habilitado','activo','active','enabled','vigente','estado','visible','oculto','transaccional','inspector'];
        const boolPrefix   = ['envia_','es_','is_','tiene_','permite_','perfil_'];
        const boolSuffix   = ['_habilitado','_activo','_estado','_vigente','_oculto'];
        const isBoolField  =
            boolExact.includes(col.toLowerCase()) ||
            boolPrefix.some(p => col.toLowerCase().startsWith(p)) ||
            boolSuffix.some(p => col.toLowerCase().endsWith(p));

        if (isBoolField) {
            const raw = formData[col];
            // Normalize current value to string 'true'/'false' for the Select
            const isCurrentlyTrue = raw === true || raw === 1 || raw === 'true' || raw === 'S' || raw === '1';
            return (
                <Select
                    key={col}
                    label={formatHeader(col)}
                    data={[
                        { value: 'true', label: '✅ Sí' },
                        { value: 'false', label: '❌ No' },
                    ]}
                    value={isCurrentlyTrue ? 'true' : 'false'}
                    onChange={(v) => {
                        // Convert back to the original DB type
                        const originalRaw = formData[col];
                        let newVal: any = v === 'true';
                        if (originalRaw === 1 || originalRaw === 0) newVal = v === 'true' ? 1 : 0;
                        else if (originalRaw === 'S' || originalRaw === 'N') newVal = v === 'true' ? 'S' : 'N';
                        setFormData({ ...formData, [col]: newVal });
                    }}
                    size="md"
                    radius="md"
                    styles={{
                        label: { color: 'var(--mantine-color-blue-filled)', fontWeight: 600 },
                        input: { borderLeft: '3px solid var(--mantine-color-blue-5)' }
                    }}
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
                leftSection={icon}
                value={formData[col] === null || formData[col] === undefined ? '' : String(formData[col])}
                onChange={(e) => setFormData({ ...formData, [col]: e.currentTarget.value })}
            />
        );
    };

    if (view === 'form') {
        // Fields declared as "summary" go to General tab; the rest go to Detalle tab
        const primaryFields = config.summaryColumns || (config.displayColumn ? [config.displayColumn] : []);
        // Lookup fields are always shown in General tab too
        const lookupFields = config.lookups ? Object.keys(config.lookups) : [];
        const allPrimary = [...new Set([...primaryFields, ...lookupFields])];

        // Fields to render automatically (exclude id, status, and dependency FK handled manually)
        const autoExcluded = [
            config.idName,
            ...(config.statusColumn ? [config.statusColumn] : []),
            'activo', 'estado'
        ].filter(Boolean) as string[];

        const renderableColumns = allDetailColumns.filter(col => !autoExcluded.includes(col));
        const generalFields = renderableColumns.filter(col => allPrimary.length === 0 || allPrimary.includes(col));
        const advancedFields = renderableColumns.filter(col => allPrimary.length > 0 && !allPrimary.includes(col));

        return (
            <Box style={{ animation: 'fadeIn 0.4s ease' }}>
                {/* Header bar */}
                <Box p="md" pb={0}>
                    <Group justify="space-between" align="flex-start">
                        <Stack gap={4}>
                            <Button 
                                variant="subtle" 
                                color="gray" 
                                leftSection={<IconArrowLeft size={16} />} 
                                onClick={() => setView('list')}
                                p={0}
                                style={{ width: 'fit-content' }}
                            >
                                Volver al Listado
                            </Button>
                            <Group gap="xs">
                                <ThemeIcon size={44} radius="md" color="blue" variant="light">
                                    {editingItem ? <IconEdit size={22} /> : <IconPlus size={22} />}
                                </ThemeIcon>
                                <Stack gap={0}>
                                    <Text size="xs" c="dimmed" fw={500}>
                                        {editingItem ? 'Editando registro' : 'Nuevo Registro'} — {config.tableName}
                                    </Text>
                                    <Title order={2} c="blue.9">
                                        {editingItem && config.displayColumn 
                                            ? (editingItem[config.displayColumn] || config.label)
                                            : config.label}
                                    </Title>
                                </Stack>
                            </Group>
                        </Stack>

                        <Group mt="xl">
                            <Button variant="default" size="md" radius="md" onClick={() => setView('list')}>
                                Cancelar
                            </Button>
                            <Button 
                                color="blue" 
                                size="md" 
                                radius="md"
                                leftSection={<IconCheck size={18} />}
                                onClick={() => setConfirmSaveOpen(true)} 
                                loading={saving}
                            >
                                {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                            </Button>
                        </Group>
                    </Group>
                </Box>

                <Container fluid px="md" pb="xl" mt="xl">
                    <Paper withBorder p="md" radius="lg" shadow="sm">
                        <Tabs defaultValue="general" variant="pills" radius="md">
                            <Tabs.List mb="xl">
                                <Tabs.Tab value="general" leftSection={<IconSettings size={16} />}>
                                    Información General
                                </Tabs.Tab>
                                {advancedFields.length > 0 && (
                                    <Tabs.Tab value="advanced" leftSection={<IconActivity size={16} />}>
                                        Datos Detallados
                                    </Tabs.Tab>
                                )}
                            </Tabs.List>

                            <Tabs.Panel value="general">
                                <Stack gap="xl">
                                    {/* Estado */}
                                    {config.statusColumn && (() => {
                                        const statusCol = config.statusColumn!;
                                        const raw = formData[statusCol];
                                        // Detect the original DB format from the first data row
                                        const sample = data.length > 0 ? data[0][statusCol] : null;
                                        const isInt = sample === 1 || sample === 0;
                                        const isStr = sample === 'S' || sample === 'N';
                                        // Normalize current value to boolean for the Select
                                        const isOn = raw === true || raw === 1 || raw === 'true' || raw === 'S' || raw === '1';
                                        return (
                                            <Box>
                                                <Group gap="sm" mb={4}>
                                                    <ThemeIcon variant="light" color="blue" size="md">
                                                        <IconSettings size={16} />
                                                    </ThemeIcon>
                                                    <Title order={5}>Estado del Registro</Title>
                                                </Group>
                                                <Select 
                                                    data={[
                                                        { value: 'on', label: '✅ Habilitado / Activo' },
                                                        { value: 'off', label: '🚫 Deshabilitado / Inactivo' }
                                                    ]}
                                                    value={isOn ? 'on' : 'off'}
                                                    onChange={(v) => {
                                                        const isActive = v === 'on';
                                                        let newVal: any = isActive;
                                                        if (isInt) newVal = isActive ? 1 : 0;
                                                        else if (isStr) newVal = isActive ? 'S' : 'N';
                                                        setFormData({ ...formData, [statusCol]: newVal });
                                                    }}
                                                    size="md"
                                                    radius="md"
                                                    style={{ maxWidth: 300 }}
                                                    styles={{ label: { color: 'var(--mantine-color-blue-filled)', fontWeight: 600 } }}
                                                />
                                            </Box>
                                        );
                                    })()}

                                    {/* Dependency selectors (clientes, componentes) */}
                                    {config.dependsOn === 'clientes' && (
                                        <Box>
                                            <Group gap="sm" mb="sm">
                                                <ThemeIcon variant="light" color="teal" size="md"><IconBuilding size={16} /></ThemeIcon>
                                                <Title order={5}>Cliente Asociado</Title>
                                            </Group>
                                            <Group align="flex-end" gap="sm">
                                                <Select 
                                                    placeholder="Seleccione cliente..."
                                                    data={dependencyData.map(c => ({ value: String(c.id || c.id_empresa), label: c.nombre || c.nombre_empresa }))}
                                                    value={formData.id_empresa ? String(formData.id_empresa) : null}
                                                    onChange={(v) => setFormData({ ...formData, id_empresa: v })}
                                                    searchable
                                                    size="md"
                                                    radius="md"
                                                    style={{ flex: 1, maxWidth: 400 }}
                                                    styles={{ label: { color: 'var(--mantine-color-teal-filled)', fontWeight: 600 }, input: { borderLeft: '3px solid var(--mantine-color-teal-5)' } }}
                                                />
                                                <Button variant="light" color="teal" leftSection={<IconPlus size={14} />} onClick={() => { setQuickCreateType('clientes'); setQuickFormData({}); }}>
                                                    Nuevo Cliente
                                                </Button>
                                            </Group>
                                        </Box>
                                    )}

                                    {config.dependsOn === 'componentes' && (
                                        <Box>
                                            <Group gap="sm" mb="sm">
                                                <ThemeIcon variant="light" color="green" size="md"><IconBuilding size={16} /></ThemeIcon>
                                                <Title order={5}>Componente Asociado</Title>
                                            </Group>
                                            <Group align="flex-end" gap="sm">
                                                <Select 
                                                    placeholder="Seleccione componente..."
                                                    data={dependencyData.map(c => ({ value: String(c.id || c.id_tipomuestra), label: c.nombre || c.nombre_tipomuestra }))}
                                                    value={formData.id_tipomuestra ? String(formData.id_tipomuestra) : null}
                                                    onChange={(v) => setFormData({ ...formData, id_tipomuestra: v })}
                                                    searchable
                                                    size="md"
                                                    radius="md"
                                                    style={{ flex: 1, maxWidth: 400 }}
                                                    styles={{ input: { borderLeft: '3px solid var(--mantine-color-green-5)' } }}
                                                />
                                                <Button variant="light" color="green" leftSection={<IconPlus size={14} />} onClick={() => { setQuickCreateType('componentes'); setQuickFormData({}); }}>
                                                    Nuevo Componente
                                                </Button>
                                            </Group>
                                        </Box>
                                    )}

                                    <Divider />

                                    {/* Main fields */}
                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="blue" size="md"><IconSettings size={16} /></ThemeIcon>
                                            <Title order={5}>Atributos de {config.label}</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed" mb="lg">Complete los campos para registrar la información.</Text>
                                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                                            {generalFields.map((col: string) => renderField(col))}
                                        </SimpleGrid>
                                    </Box>

                                    {advancedFields.length === 0 && (
                                        <Group justify="flex-end">
                                            <Button 
                                                color="blue" size="md" radius="md"
                                                leftSection={<IconCheck size={18} />}
                                                onClick={() => setConfirmSaveOpen(true)} 
                                                loading={saving}
                                            >
                                                {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                                            </Button>
                                        </Group>
                                    )}

                                    {advancedFields.length > 0 && (
                                        <Group justify="flex-end">
                                            <Button variant="light" rightSection={<IconArrowRight size={16} />} onClick={() => {}}>
                                                Ver Datos Detallados
                                            </Button>
                                        </Group>
                                    )}
                                </Stack>
                            </Tabs.Panel>

                            <Tabs.Panel value="advanced">
                                <Stack gap="xl">
                                    <Box>
                                        <Group gap="sm" mb={4}>
                                            <ThemeIcon variant="light" color="grape" size="md"><IconActivity size={16} /></ThemeIcon>
                                            <Title order={5}>Configuración Detallada</Title>
                                        </Group>
                                        <Text size="sm" c="dimmed" mb="lg">Campos adicionales y configuración avanzada del registro.</Text>
                                        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg">
                                            {advancedFields.map((col: string) => renderField(col))}
                                        </SimpleGrid>
                                    </Box>

                                    <Divider />
                                    <Group justify="flex-end">
                                        <Button 
                                            color="blue" size="md" radius="md"
                                            leftSection={<IconCheck size={18} />}
                                            onClick={() => setConfirmSaveOpen(true)} 
                                            loading={saving}
                                        >
                                            {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                                        </Button>
                                    </Group>
                                </Stack>
                            </Tabs.Panel>
                        </Tabs>
                    </Paper>
                </Container>

                {/* Quick Create Modal */}
                <Modal
                    opened={quickCreateType !== null}
                    onClose={() => !quickSaving && setQuickCreateType(null)}
                    title={
                        <Group gap="xs">
                            <ThemeIcon color="green" radius="md">
                                <IconPlus size={18} />
                            </ThemeIcon>
                            <Text fw={700}>Creación Rápida: {quickCreateType === 'clientes' ? 'Nuevo Cliente' : 'Nuevo Componente'}</Text>
                        </Group>
                    }
                    size="md"
                    radius="lg"
                    centered
                >
                    <Stack gap="md">
                        {quickCreateType === 'clientes' ? (
                            <>
                                <TextInput 
                                    label="Nombre de Empresa" 
                                    required 
                                    value={quickFormData.nombre_empresa || ''} 
                                    onChange={(e) => setQuickFormData({...quickFormData, nombre_empresa: e.currentTarget.value})}
                                />
                                <TextInput 
                                    label="RUT" 
                                    placeholder="12.345.678-9"
                                    required 
                                    value={quickFormData.rut_empresa || ''} 
                                    onChange={(e) => setQuickFormData({...quickFormData, rut_empresa: e.currentTarget.value})}
                                />
                                <TextInput 
                                    label="Dirección" 
                                    required 
                                    value={quickFormData.direccion_empresa || ''} 
                                    onChange={(e) => setQuickFormData({...quickFormData, direccion_empresa: e.currentTarget.value})}
                                />
                                <TextInput 
                                    label="Email Empresa" 
                                    required 
                                    value={quickFormData.email_empresa || ''} 
                                    onChange={(e) => setQuickFormData({...quickFormData, email_empresa: e.currentTarget.value})}
                                />
                            </>
                        ) : (
                            <>
                                <TextInput 
                                    label="Nombre Componente" 
                                    required 
                                    value={quickFormData.nombre_tipomuestra || ''} 
                                    onChange={(e) => setQuickFormData({...quickFormData, nombre_tipomuestra: e.currentTarget.value})}
                                />
                                <TextInput 
                                    label="Sigla" 
                                    required 
                                    value={quickFormData.sigla_tipomuestra || ''} 
                                    onChange={(e) => setQuickFormData({...quickFormData, sigla_tipomuestra: e.currentTarget.value})}
                                />
                            </>
                        )}
                        
                        <Group justify="flex-end" mt="md">
                            <Button variant="default" onClick={() => setQuickCreateType(null)} disabled={quickSaving}>Cancelar</Button>
                            <Button 
                                color="green" 
                                onClick={handleQuickSave} 
                                loading={quickSaving}
                            >
                                Crear y Seleccionar
                            </Button>
                        </Group>
                    </Stack>
                </Modal>

                {/* Confirm Save Modal */}
                <Modal
                    opened={confirmSaveOpen}
                    onClose={() => !saving && setConfirmSaveOpen(false)}
                    title={<Text fw={700} c="blue.9">Confirmación de Guardado</Text>}
                    size="sm"
                    centered
                    radius="md"
                >
                    <Text size="sm" mb="xl">
                        ¿Está seguro que desea {editingItem ? 'actualizar' : 'crear'} este registro en {config.label}?
                    </Text>
                    <Group justify="flex-end">
                        <Button variant="default" onClick={() => setConfirmSaveOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button 
                            color="blue" 
                            onClick={() => { 
                                setConfirmSaveOpen(false); 
                                handleSave(); 
                            }} 
                            loading={saving}
                        >
                            Confirmar
                        </Button>
                    </Group>
                </Modal>

                {/* ── QUICK-CREATE FK MODAL ── */}
                <Modal
                    opened={!!quickFk}
                    onClose={() => !quickFkSaving && setQuickFk(null)}
                    title={
                        <Group gap="xs">
                            <ThemeIcon color="green" variant="light" size="md"><IconPlus size={16} /></ThemeIcon>
                            <Text fw={700} size="sm">
                                Crear nuevo en <Badge variant="dot" color="blue" size="sm" style={{ fontFamily: 'monospace' }}>{quickFk?.lookup.tableName}</Badge>
                            </Text>
                        </Group>
                    }
                    size="lg"
                    radius="md"
                    centered
                >
                    {quickFk && (
                        <Stack gap="md">
                            {quickFkCols.length === 0 ? (
                                <Group justify="center" py="md"><Loader size="sm" /></Group>
                            ) : (
                                <ScrollArea.Autosize mah={420}>
                                    <SimpleGrid cols={2} spacing="md" pr="xs">
                                        {quickFkCols.map(col => {
                                            const boolPats = ['habilitado','activo','active','enabled','envia_','es_','oculto','visible','is_','tiene_','permite_','transaccional','vigente','estado'];
                                            const imgPats  = ['firma_','foto','imagen','logo','avatar','signature'];
                                            const isBool = boolPats.some(p => col.toLowerCase().includes(p));
                                            const isImg  = imgPats.some(p => col.toLowerCase().includes(p));

                                            if (isImg) {
                                                return (
                                                    <Box key={col}>
                                                        <Text size="xs" fw={600} c="blue" mb={4}>{formatHeader(col)}</Text>
                                                        <FileInput
                                                            placeholder="Seleccionar imagen..."
                                                            accept="image/*"
                                                            leftSection={<IconUpload size={14} />}
                                                            onChange={async (file) => {
                                                                if (!file) return;
                                                                const fd = new FormData();
                                                                fd.append('archivo', file);
                                                                const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                                                                const token = localStorage.getItem('token');
                                                                const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                                                                const json = await res.json();
                                                                if (json.success) setQuickFkFormData((p: any) => ({ ...p, [col]: json.filePath }));
                                                            }}
                                                            size="sm" radius="md"
                                                        />
                                                    </Box>
                                                );
                                            }
                                            if (isBool) {
                                                return (
                                                    <Select
                                                        key={col}
                                                        label={formatHeader(col)}
                                                        data={[{ value: '1', label: '✅ Sí / Habilitado' }, { value: '0', label: '❌ No / Deshabilitado' }]}
                                                        value={quickFkFormData[col] !== undefined ? String(quickFkFormData[col]) : '1'}
                                                        onChange={(v) => setQuickFkFormData((p: any) => ({ ...p, [col]: v }))}
                                                        size="sm" radius="md"
                                                        styles={{ label: { fontWeight: 600 } }}
                                                    />
                                                );
                                            }
                                            return (
                                                <TextInput
                                                    key={col}
                                                    label={formatHeader(col)}
                                                    placeholder={col}
                                                    value={quickFkFormData[col] || ''}
                                                    onChange={(e) => setQuickFkFormData((p: any) => ({ ...p, [col]: e.currentTarget.value }))}
                                                    size="sm" radius="md"
                                                    styles={{ label: { fontWeight: 600, color: col === quickFk.lookup.displayColumn ? 'var(--mantine-color-blue-filled)' : undefined } }}
                                                    required={col === quickFk.lookup.displayColumn}
                                                />
                                            );
                                        })}
                                    </SimpleGrid>
                                </ScrollArea.Autosize>
                            )}
                            <Group justify="flex-end" mt="xs">
                                <Button variant="default" onClick={() => setQuickFk(null)} disabled={quickFkSaving}>Cancelar</Button>
                                <Button
                                    color="green"
                                    leftSection={<IconPlus size={16} />}
                                    loading={quickFkSaving}
                                    disabled={!quickFkFormData[quickFk.lookup.displayColumn]?.trim?.()}
                                    onClick={async () => {
                                        setQuickFkSaving(true);
                                        try {
                                            const newRecord = await catalogosService.createMaestro(quickFk.lookup.tableName, quickFkFormData);
                                            const fresh = await catalogosService.getMaestroData(quickFk.lookup.tableName);
                                            setLookupData(prev => ({ ...prev, [quickFk.field]: fresh || [] }));
                                            const newId = newRecord?.[quickFk.lookup.idColumn] || newRecord?.id;
                                            if (newId) setFormData((prev: any) => ({ ...prev, [quickFk.field]: String(newId) }));
                                            showToast({ type: 'success', message: `Registro creado correctamente` });
                                            setQuickFk(null);
                                        } catch {
                                            showToast({ type: 'error', message: 'Error al crear el registro' });
                                        } finally {
                                            setQuickFkSaving(false);
                                        }
                                    }}
                                >
                                    Crear
                                </Button>
                            </Group>
                        </Stack>
                    )}
                </Modal>

            </Box>
        );
    }



    return (
        <>
        <Stack gap="md">
            <Group justify="space-between">

                {fetchError && (
                    <Alert icon={<IconAlertCircle size={16} />} color="red" radius="md" style={{ width: '100%' }}>
                        {fetchError}
                    </Alert>
                )}
                <Button 
                    variant="subtle" 
                    leftSection={<IconArrowLeft size={16} />} 
                    onClick={onBack}
                    color="gray"
                >
                    Volver al Panel
                </Button>
                <Button 
                    leftSection={<IconPlus size={20} />} 
                    onClick={() => handleOpenModal()}
                    color="blue"
                    disabled={needsDependency}
                >
                    Añadir {config.label}
                </Button>
            </Group>

            {needsDependency && (
                <Alert icon={<IconAlertCircle size={16} />} title="Atención" color="orange" radius="md">
                    Necesita crear primero registros en el maestro <strong>{config.dependsOn}</strong> antes de poder añadir nuevos {config.label}.
                </Alert>
            )}

            {/* ── MAESTRO INFO PANEL ─────────────────────────────────────── */}
            <Paper withBorder p="sm" radius="md" style={{ background: 'var(--mantine-color-blue-0)', borderColor: 'var(--mantine-color-blue-2)' }}>
                <Group gap="xs" mb={6}>
                    <ThemeIcon size="sm" variant="light" color="blue"><IconSettings size={12} /></ThemeIcon>
                    <Text size="xs" fw={700} c="blue.7">Información del Maestro</Text>
                </Group>
                <Group gap="md" wrap="wrap">
                    {/* Tabla */}
                    <Group gap={4}>
                        <Text size="xs" c="dimmed">Tabla:</Text>
                        <Badge size="xs" variant="outline" color="blue" radius="sm" style={{ fontFamily: 'monospace' }}>{config.tableName}</Badge>
                    </Group>
                    {/* ID */}
                    <Group gap={4}>
                        <Text size="xs" c="dimmed">ID:</Text>
                        <Badge size="xs" variant="outline" color="gray" radius="sm" style={{ fontFamily: 'monospace' }}>{config.idName}</Badge>
                    </Group>
                    {/* Status column */}
                    {config.statusColumn && (
                        <Group gap={4}>
                            <Text size="xs" c="dimmed">Estado:</Text>
                            <Badge size="xs" variant="outline" color="green" radius="sm" style={{ fontFamily: 'monospace' }}>{config.statusColumn}</Badge>
                        </Group>
                    )}
                    {/* Lookups / FK relations */}
                    {config.lookups && Object.entries(config.lookups).map(([field, lookup]) => (
                        <Group key={field} gap={4}>
                            <Badge size="xs" variant="light" color="violet" radius="sm" style={{ fontFamily: 'monospace' }}>{field}</Badge>
                            <Text size="xs" c="dimmed">→</Text>
                            <Badge size="xs" variant="outline" color="violet" radius="sm" style={{ fontFamily: 'monospace' }}>{lookup.tableName}.{lookup.displayColumn}</Badge>
                        </Group>
                    ))}
                    {/* Dependency */}
                    {config.dependsOn && (
                        <Group gap={4}>
                            <Text size="xs" c="dimmed">Depende de:</Text>
                            <Badge size="xs" variant="light" color="orange" radius="sm">{config.dependsOn}</Badge>
                        </Group>
                    )}
                    {/* Total records */}
                    {data.length > 0 && (
                        <Group gap={4}>
                            <Text size="xs" c="dimmed">Registros:</Text>
                            <Badge size="xs" variant="filled" color="blue" radius="sm">{data.length}</Badge>
                        </Group>
                    )}
                </Group>
            </Paper>

            <Paper withBorder p="md" radius="md" shadow="sm">
                <Stack gap="md">
                    <Group justify="space-between">
                        <Group gap="xs">
                            <Text fw={700} size="xl">{config.label}</Text>
                            <Badge variant="dot" color="gray" size="sm">
                                {config.tableName}
                            </Badge>
                        </Group>
                        <Group>
                            <Select 
                                placeholder="Filtrar por estado"
                                data={[
                                    { value: 'all', label: 'Todos los estados' },
                                    { value: 'active', label: 'Solo Activos' },
                                    { value: 'inactive', label: 'Solo Inactivos' }
                                ]}
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v || 'all')}
                                style={{ width: 180 }}
                            />
                            <TextInput 
                                placeholder="Buscar..." 
                                leftSection={<IconSearch size={16} />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                style={{ width: 300 }}
                            />
                        </Group>
                    </Group>

                    <ScrollArea offsetScrollbars>
                        <Table highlightOnHover verticalSpacing="sm" style={{ minWidth: 800 }}>
                            <Table.Thead bg="gray.0">
                                <Table.Tr>
                                    <Table.Th style={{ width: 80 }}>ID</Table.Th>
                                    
                                    {/* Granular columns */}
                                    {mainTableColumns.map((col: string) => (
                                        <Table.Th key={col}>{formatHeader(col)}</Table.Th>
                                    ))}

                                    {hasStatusColumn && <Table.Th style={{ width: 100 }}>Estado</Table.Th>}
                                    <Table.Th style={{ width: 100 }}>Acciones</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {loading ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={mainTableColumns.length + 3} align="center" py="xl">
                                            <Loader size="sm" />
                                            <Text size="sm" mt="xs">Cargando datos...</Text>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : filteredData.length === 0 ? (
                                    <Table.Tr>
                                        <Table.Td colSpan={mainTableColumns.length + 3} align="center" py="xl">
                                            <Text c="dimmed">No se encontraron registros</Text>
                                        </Table.Td>
                                    </Table.Tr>
                                ) : (
                                    paginatedData.map((item) => {
                                        const status = item[config.statusColumn || 'habilitado'] || item.activo || item.estado || 'S';
                                        const isActive = status === 'S' || status === 'V' || status === 1 || status === true;
                                        
                                        return (
                                            <Table.Tr key={item[config.idName]}>
                                                <Table.Td>
                                                    <Text size="xs" c="dimmed" fw={500}>{item[config.idName]}</Text>
                                                </Table.Td>
                                                
                                                {/* Granular data cells */}
                                                {mainTableColumns.map((col: string) => {
                                                    const raw = item[col];
                                                    
                                                    // Only treat as boolean if column NAME suggests it, not just any 0/1 value
                                                    const boolNamePatterns = ['envia_', 'es_', 'oculto', 'visible', 'activo', 'active', 'enabled', 'is_', 'tiene_', 'permite_', 'transaccional'];
                                                    const isBoolCol = typeof raw === 'boolean' || boolNamePatterns.some(p => col.toLowerCase().includes(p));
                                                    const isNullValue = raw === null || raw === undefined || raw === '';
                                                    let displayValue: React.ReactNode = isNullValue
                                                        ? <Text size="xs" c="dimmed" fs="italic">null</Text>
                                                        : String(raw);
                                                    
                                                    if (isBoolCol && raw !== null && raw !== undefined) {
                                                        const isTrue = raw === true || raw === 1;
                                                        displayValue = (
                                                            <Badge color={isTrue ? 'green' : 'gray'} variant="light" size="sm">
                                                                {isTrue ? '✅ Sí' : '❌ No'}
                                                            </Badge>
                                                        );
                                                    }
                                                    
                                                    // Resolve Lookup names if available
                                                    if (!isBoolCol && config.lookups && config.lookups[col]) {
                                                        const lookup = config.lookups[col];
                                                        const options = lookupData[col] || [];
                                                        const found = options.find(opt => String(opt[lookup.idColumn]) === String(raw));
                                                        if (found) displayValue = String(found[lookup.displayColumn]);
                                                    } else if (!isBoolCol && col === 'id_empresa' && (config.dependsOn === 'clientes')) {
                                                        const found = dependencyData.find(c => String(c.id || c.id_empresa) === String(raw));
                                                        if (found) displayValue = String(found.nombre || found.nombre_empresa);
                                                    } else if (!isBoolCol && col === 'id_tipomuestra' && (config.dependsOn === 'componentes')) {
                                                        const found = dependencyData.find(c => String(c.id || c.id_tipomuestra) === String(raw));
                                                        if (found) displayValue = String(found.nombre || found.nombre_tipomuestra);
                                                    }

                                                    return (
                                                        <Table.Td key={col}>
                                                            <Text component="div" size="sm" fw={col === config.displayColumn ? 600 : 400} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250 }}>
                                                                {displayValue}
                                                            </Text>
                                                        </Table.Td>
                                                    );
                                                })}

                                                {hasStatusColumn && (
                                                    <Table.Td>
                                                        <Badge 
                                                            color={isActive ? 'green' : 'red'} 
                                                            variant="light"
                                                            size="sm"
                                                        >
                                                            {isActive ? 'Activo' : 'Inactivo'}
                                                        </Badge>
                                                    </Table.Td>
                                                )}
                                                
                                                <Table.Td>
                                                    <Group gap={4} wrap="nowrap">
                                                        <Tooltip label="Editar">
                                                            <ActionIcon 
                                                                color="blue" 
                                                                variant="light" 
                                                                size="sm"
                                                                onClick={() => handleOpenModal(item)}
                                                            >
                                                                <IconEdit size={14} />
                                                            </ActionIcon>
                                                        </Tooltip>
                                                        {hasStatusColumn && (
                                                            <Tooltip label={isActive ? 'Deshabilitar' : 'Habilitar'}>
                                                                <ActionIcon 
                                                                    color={isActive ? 'red' : 'green'} 
                                                                    variant="light"
                                                                    size="sm"
                                                                    onClick={() => handleToggleStatus(item)}
                                                                >
                                                                    {isActive ? <IconTrash size={14} /> : <IconCheck size={14} />}
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        )}
                                                    </Group>
                                                </Table.Td>
                                            </Table.Tr>
                                        );
                                    })
                                )}
                            </Table.Tbody>
                        </Table>
                    </ScrollArea>

                    {totalPages > 1 && (
                        <Group justify="center" mt="md" mb="xs">
                            <Pagination 
                                total={totalPages} 
                                value={page} 
                                onChange={setPage} 
                                color="blue" 
                                radius="md" 
                                withEdges
                            />
                        </Group>
                    )}
                </Stack>
            </Paper>
        </Stack>
        <style dangerouslySetInnerHTML={{ __html: `
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}} />

        {/* ── QUICK-CREATE FK MODAL (list view) ── */}
        <Modal
            opened={!!quickFk}
            onClose={() => !quickFkSaving && setQuickFk(null)}
            title={
                <Group gap="xs">
                    <ThemeIcon color="green" variant="light" size="md"><IconPlus size={16} /></ThemeIcon>
                    <Text fw={700} size="sm">
                        Crear nuevo en <Badge variant="dot" color="blue" size="sm" style={{ fontFamily: 'monospace' }}>{quickFk?.lookup.tableName}</Badge>
                    </Text>
                </Group>
            }
            size="lg"
            radius="md"
            centered
        >
            {quickFk && (
                <Stack gap="md">
                    {quickFkCols.length === 0 ? (
                        <Group justify="center" py="md"><Loader size="sm" /></Group>
                    ) : (
                        <ScrollArea.Autosize mah={420}>
                            <SimpleGrid cols={2} spacing="md" pr="xs">
                                {quickFkCols.map(col => {
                                    const boolExact2  = ['habilitado','activo','active','enabled','vigente','estado','visible','oculto','transaccional'];
                                    const boolPrefix2 = ['envia_','es_','is_','tiene_','permite_','perfil_'];
                                    const boolSuffix2 = ['_habilitado','_activo','_estado','_vigente','_oculto'];
                                    const imgPats     = ['firma_','foto','imagen','logo','avatar','signature'];
                                    const isBool = boolExact2.includes(col.toLowerCase()) || boolPrefix2.some(p => col.toLowerCase().startsWith(p)) || boolSuffix2.some(p => col.toLowerCase().endsWith(p));
                                    const isImg  = imgPats.some(p => col.toLowerCase().includes(p));
                                    if (isImg) return (
                                        <Box key={col}>
                                            <Text size="xs" fw={600} c="blue" mb={4}>{formatHeader(col)}</Text>
                                            <FileInput placeholder="Seleccionar imagen..." accept="image/*" leftSection={<IconUpload size={14} />}
                                                onChange={async (file) => {
                                                    if (!file) return;
                                                    const fd = new FormData(); fd.append('archivo', file);
                                                    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                                                    const token = localStorage.getItem('token');
                                                    const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                                                    const json = await res.json();
                                                    if (json.success) setQuickFkFormData((p: any) => ({ ...p, [col]: json.filePath }));
                                                }} size="sm" radius="md" />
                                        </Box>
                                    );
                                    if (isBool) return (
                                        <Select key={col} label={formatHeader(col)}
                                            data={[{ value: '1', label: '✅ Sí' }, { value: '0', label: '❌ No' }]}
                                            value={quickFkFormData[col] !== undefined ? String(quickFkFormData[col]) : '1'}
                                            onChange={(v) => setQuickFkFormData((p: any) => ({ ...p, [col]: v }))}
                                            size="sm" radius="md" styles={{ label: { fontWeight: 600 } }} />
                                    );
                                    return (
                                        <TextInput key={col} label={formatHeader(col)} placeholder={col}
                                            value={quickFkFormData[col] || ''}
                                            onChange={(e) => setQuickFkFormData((p: any) => ({ ...p, [col]: e.currentTarget.value }))}
                                            size="sm" radius="md" required={col === quickFk.lookup.displayColumn}
                                            styles={{ label: { fontWeight: 600, color: col === quickFk.lookup.displayColumn ? 'var(--mantine-color-blue-filled)' : undefined } }} />
                                    );
                                })}
                            </SimpleGrid>
                        </ScrollArea.Autosize>
                    )}
                    <Group justify="flex-end" mt="xs">
                        <Button variant="default" onClick={() => setQuickFk(null)} disabled={quickFkSaving}>Cancelar</Button>
                        <Button color="green" leftSection={<IconPlus size={16} />} loading={quickFkSaving}
                            disabled={!quickFkFormData[quickFk.lookup.displayColumn]?.trim?.()}
                            onClick={async () => {
                                setQuickFkSaving(true);
                                try {
                                    const newRecord = await catalogosService.createMaestro(quickFk.lookup.tableName, quickFkFormData);
                                    const fresh = await catalogosService.getMaestroData(quickFk.lookup.tableName);
                                    setLookupData(prev => ({ ...prev, [quickFk.field]: fresh || [] }));
                                    const newId = newRecord?.[quickFk.lookup.idColumn] || newRecord?.id;
                                    if (newId) setFormData((prev: any) => ({ ...prev, [quickFk.field]: String(newId) }));
                                    showToast({ type: 'success', message: `Registro creado correctamente` });
                                    setQuickFk(null);
                                } catch {
                                    showToast({ type: 'error', message: 'Error al crear el registro' });
                                } finally { setQuickFkSaving(false); }
                            }}>
                            Crear
                        </Button>
                    </Group>
                </Stack>
            )}
        </Modal>
        </>

    );
};
