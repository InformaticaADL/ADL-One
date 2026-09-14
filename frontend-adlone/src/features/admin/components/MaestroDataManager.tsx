import React, { useState, useEffect, useMemo } from 'react';
import {
    Typography,
    Button,
    Input,
    Modal,
    Card,
    Tag,
    Tooltip,
    Spin,
    Select,
    Alert,
    Pagination,
    Tabs,
    Upload
} from 'antd';
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

const { Text, Title } = Typography;

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

// Small colored icon badge (replaces Mantine ThemeIcon)
const iconColors: Record<string, string> = {
    blue: '#1c7ed6', teal: '#0c8599', green: '#2f9e44', grape: '#9c36b5', orange: '#e8590c', gray: '#868e96'
};
const IconBadge: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = 'blue', size = 32 }) => {
    const hex = iconColors[color] || color;
    return (
        <div style={{ width: size, height: size, borderRadius: 8, backgroundColor: `${hex}1a`, color: hex, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {children}
        </div>
    );
};

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
    const [dynamicFilters, setDynamicFilters] = useState<{[key: string]: string}>({});
    const [view, setView] = useState<'list' | 'form'>('list');
    const [activeFormTab, setActiveFormTab] = useState('general');
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
        setDynamicFilters({});
        setSearchTerm('');
        setStatusFilter('all');
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Apply dynamic filters (FK relations, dependancies)
        Object.entries(dynamicFilters).forEach(([col, val]) => {
            if (val) {
                filtered = filtered.filter(item => String(item[col]) === val);
            }
        });

        // Apply search term filter
        if (!searchTerm) return filtered;
        const s = searchTerm.toLowerCase();
        return filtered.filter(item =>
            Object.values(item).some(val =>
                String(val).toLowerCase().includes(s)
            )
        );
    }, [data, searchTerm, statusFilter, dynamicFilters, config]);

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
        setActiveFormTab('general');
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
            // Auto-siguiente "orden" si la tabla maneja esa columna
            const hasOrden = (config.summaryColumns?.includes('orden')) || data.some((d: any) => 'orden' in d);
            if (hasOrden) {
                const maxOrden = data.reduce((mx: number, d: any) => {
                    const n = Number(d.orden);
                    return Number.isFinite(n) && n > mx ? n : mx;
                }, 0);
                defaults['orden'] = String(maxOrden + 1);
            }
            setFormData(defaults);
        }
        setView('form');
    };

    const handleSave = async () => {
        // MA-01: validar que al menos el campo display tenga valor, y que el formulario no esté vacío.
        const displayCol = config.displayColumn;
        const idCol = config.idName;
        const missing: string[] = [];

        // Validar campo principal (display)
        if (displayCol) {
            const val = formData[displayCol];
            if (val === undefined || val === null || String(val).trim() === '') {
                missing.push(formatHeader(displayCol));
            }
        }

        // Validar que el form tenga algún valor en general (no todo vacío)
        const hasAnyValue = Object.entries(formData).some(([k, v]) => {
            if (k === idCol) return false;
            if (v === undefined || v === null) return false;
            if (typeof v === 'string' && v.trim() === '') return false;
            return true;
        });
        if (!hasAnyValue) {
            showToast({ type: 'error', message: 'Debe completar al menos un campo para guardar' });
            return;
        }

        if (missing.length > 0) {
            showToast({
                type: 'error',
                message: `Faltan campos obligatorios: ${missing.join(', ')}`
            });
            return;
        }

        setSaving(true);
        try {
            if (editingItem) {
                const idValue = editingItem[config.idName];
                const { [config.idName]: _, ...cleanData } = formData;
                await catalogosService.updateMaestro(config.tableName, config.idName, idValue, cleanData);
                showToast({ type: 'success', message: 'Registro actualizado correctamente' });
            } else {
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

        let newStatus: any;
        let isNowActive: boolean;
        if (typeof currentStatus === 'boolean') {
            newStatus = !currentStatus;
            isNowActive = newStatus;
        } else if (currentStatus === 1 || currentStatus === 0) {
            newStatus = currentStatus === 1 ? 0 : 1;
            isNowActive = newStatus === 1;
        } else {
            newStatus = (currentStatus === 'S' || currentStatus === 'V' || currentStatus === 'A') ? 'N' : 'S';
            isNowActive = newStatus === 'S';
        }

        // MA-03: advertencia previa al deshabilitar (registros podrían estar en uso por fichas activas)
        if (!isNowActive) {
            const displayName = config.displayColumn ? item[config.displayColumn] : `#${idValue}`;
            const ok = window.confirm(
                `¿Deshabilitar "${displayName}"?\n\n` +
                `Atención: si este registro está en uso por fichas activas, podría afectar su visualización. ` +
                `Las fichas existentes mantendrán el valor pero ya no podrá seleccionarse para nuevas fichas.\n\n` +
                `¿Desea continuar?`
            );
            if (!ok) return;
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
                <div key={col} style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexWrap: 'nowrap' }}>
                    <div style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, color: '#1c7ed6', fontWeight: 600, display: 'block', marginBottom: 4 }}>{formatHeader(col)}</Text>
                        <Select
                            style={{ width: '100%', borderLeft: '3px solid #4dabf7', borderRadius: 6 }}
                            placeholder={`Seleccione ${formatHeader(col)}...`}
                            options={(() => {
                                const seen = new Set();
                                return options
                                    .map(opt => ({
                                        value: String(opt[lookup.idColumn]),
                                        label: String(opt[lookup.displayColumn])
                                    }))
                                    .filter(opt => {
                                        if (!opt.value || opt.value === 'undefined' || opt.value === 'null') return false;
                                        if (seen.has(opt.value)) return false;
                                        seen.add(opt.value);
                                        return true;
                                    });
                            })()}
                            value={formData[col] === null || formData[col] === undefined || formData[col] === '' ? undefined : String(formData[col])}
                            onChange={(v) => {
                                const updatedForm = { ...formData, [col]: v };
                                if (v) {
                                    const selectedOpt = options.find(opt => String(opt[lookup.idColumn]) === String(v));
                                    if (selectedOpt) {
                                        // Autofill other matching or similar fields in the form
                                        Object.keys(formData).forEach(formKey => {
                                            if (formKey === col) return; // don't overwrite the selected id column itself

                                            // Try exact match or fuzzy match (e.g. tipoequipo vs tipo_equipo)
                                            const cleanFormKey = formKey.toLowerCase().replace(/_/g, '');

                                            const matchingKey = Object.keys(selectedOpt).find(optKey => {
                                                const cleanOptKey = optKey.toLowerCase().replace(/_/g, '');
                                                return cleanOptKey === cleanFormKey && optKey !== lookup.idColumn;
                                            });

                                            if (matchingKey) {
                                                updatedForm[formKey] = String(selectedOpt[matchingKey]);
                                            }
                                        });
                                    }
                                }

                                // Check if we need to auto-set es_fijo based on the new name
                                const currentName = updatedForm.nombre || '';
                                const fijos = ['MUESTREADOR AUTOMÁTICO', 'SONDA CAUDAL', 'SONDA PH/TEMPERATURA', 'BATERIA', 'POWER PACK', 'FILTRO', 'Pedestal'];
                                const isFijoName = fijos.some(f => currentName.trim().toUpperCase() === f.toUpperCase());
                                if ('es_fijo' in updatedForm) {
                                    updatedForm.es_fijo = isFijoName;
                                }

                                setFormData(updatedForm);
                            }}
                            showSearch
                            allowClear
                            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                            notFoundContent="Sin opciones disponibles"
                        />
                    </div>
                    {!lookup.noCreate && (
                        <Tooltip title={`Crear nuevo en ${lookup.tableName}`}>
                            <Button
                                type="text"
                                size="large"
                                style={{ color: '#2f9e44', marginBottom: 1 }}
                                icon={<IconPlus size={18} />}
                                onClick={() => openQuickFk(col, lookup)}
                            />
                        </Tooltip>
                    )}
                </div>
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
                <div key={col}>
                    <Text style={{ fontSize: 13, fontWeight: 600, color: '#1c7ed6', display: 'block', marginBottom: 6 }}>{formatHeader(col)}</Text>
                    {previewUrl && (
                        <div style={{ marginBottom: 8, border: '1px solid #dee2e6', borderRadius: 8, padding: 8, display: 'inline-block', background: '#f8f9fa' }}>
                            <img
                                src={previewUrl}
                                alt={col}
                                style={{ height: 120, width: 'auto', objectFit: 'contain', borderRadius: 4 }}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x120?text=Sin+imagen'; }}
                            />
                            <Text style={{ fontSize: 11, color: 'var(--app-text-secondary)', marginTop: 4, textAlign: 'center', display: 'block' }}>{currentPath}</Text>
                        </div>
                    )}
                    <Upload
                        accept="image/*"
                        showUploadList={false}
                        beforeUpload={(file) => { handleFileChange(file); return false; }}
                    >
                        <Button icon={<IconUpload size={16} />}>{previewUrl ? 'Cambiar imagen...' : 'Seleccionar imagen...'}</Button>
                    </Upload>
                </div>
            );
        }

        // Precise boolean detection: exact names, or specific prefixes (no false positives on 'nombre_estadomuestreo')
        const boolExact    = ['habilitado','activo','active','enabled','vigente','estado','visible','oculto','transaccional','inspector','guia','realiza_screening','tienefc','visible_muestreador','informe'];
        const boolPrefix   = ['envia_','es_','is_','tiene_','permite_','perfil_','esta_'];
        const boolSuffix   = ['_habilitado','_activo','_estado','_vigente','_oculto'];
        const isBoolField  =
            boolExact.includes(col.toLowerCase()) ||
            boolPrefix.some(p => col.toLowerCase().startsWith(p)) ||
            boolSuffix.some(p => col.toLowerCase().endsWith(p));

        if (isBoolField) {
            const raw = formData[col];
            // Normalize current value to string 'true'/'false' for the Select
            const isCurrentlyTrue = raw === true || raw === 1 || raw === 'true' || raw === 'S' || raw === '1' || raw === 'SI' || raw === 'Si' || raw === 'si' || raw === 'SÍ' || raw === 'sí';
            return (
                <div key={col}>
                    <Text style={{ fontSize: 13, color: '#1c7ed6', fontWeight: 600, display: 'block', marginBottom: 4 }}>{formatHeader(col)}</Text>
                    <Select
                        style={{ width: '100%' }}
                        options={[
                            { value: 'true', label: '✅ Sí' },
                            { value: 'false', label: '❌ No' },
                        ]}
                        value={isCurrentlyTrue ? 'true' : 'false'}
                        onChange={(v) => {
                            const isTrue = v === 'true';
                            const originalRaw = formData[col];
                            const c = col.toLowerCase();
                            let newVal: any = isTrue;
                            if (originalRaw === 'S' || originalRaw === 'N' ||
                                ['habilitado', 'visible_muestreador', 'informe', 'activo', 'vigente', 'tienefc', 'tiene_fc'].includes(c)) {
                                newVal = isTrue ? 'S' : 'N';
                            } else if (originalRaw === 'Si' || originalRaw === 'No' || originalRaw === 'si' || originalRaw === 'no') {
                                newVal = isTrue ? 'Si' : 'No';
                            } else if (originalRaw === 1 || originalRaw === 0 || typeof originalRaw === 'number') {
                                newVal = isTrue ? 1 : 0;
                            } else {
                                if (['habilitado', 'visible_muestreador', 'informe', 'activo', 'vigente', 'tienefc', 'tiene_fc'].includes(c)) {
                                    newVal = isTrue ? 'S' : 'N';
                                } else {
                                    newVal = isTrue;
                                }
                            }
                            setFormData({ ...formData, [col]: newVal });
                        }}
                    />
                </div>
            );
        }

        const isDateField = ['fecha', 'date', 'verificacion'].some(p => col.toLowerCase().includes(p));

        if (isDateField) {
            let val = '';
            if (formData[col]) {
                const dateStr = String(formData[col]);
                if (dateStr.includes('T')) {
                    val = dateStr.split('T')[0];
                } else if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
                    val = dateStr.substring(0, 10);
                } else {
                    try {
                        const d = new Date(dateStr);
                        if (!isNaN(d.getTime())) {
                            const y = d.getFullYear();
                            const m = String(d.getMonth() + 1).padStart(2, '0');
                            const day = String(d.getDate()).padStart(2, '0');
                            val = `${y}-${m}-${day}`;
                        }
                    } catch {
                        val = dateStr;
                    }
                }
            }
            return (
                <div key={col}>
                    <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{formatHeader(col)}</Text>
                    <Input
                        placeholder={col}
                        type="date"
                        prefix={icon}
                        value={val}
                        onChange={(e) => setFormData({ ...formData, [col]: e.currentTarget.value })}
                    />
                </div>
            );
        }

        return (
            <div key={col}>
                <Text style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>{formatHeader(col)}</Text>
                <Input
                    placeholder={col}
                    prefix={icon}
                    value={formData[col] === null || formData[col] === undefined ? '' : String(formData[col])}
                    onChange={(e) => {
                        const newVal = e.currentTarget.value;
                        const updatedForm = { ...formData, [col]: newVal };
                        if (col === 'nombre' && 'es_fijo' in updatedForm) {
                            const fijos = ['MUESTREADOR AUTOMÁTICO', 'SONDA CAUDAL', 'SONDA PH/TEMPERATURA', 'BATERIA', 'POWER PACK', 'FILTRO', 'Pedestal'];
                            updatedForm.es_fijo = fijos.some(f => newVal.trim().toUpperCase() === f.toUpperCase());
                        }
                        setFormData(updatedForm);
                    }}
                />
            </div>
        );
    };

    const quickFkModal = (
        <Modal
            open={!!quickFk}
            onCancel={() => !quickFkSaving && setQuickFk(null)}
            title={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <IconBadge color="green" size={28}><IconPlus size={16} /></IconBadge>
                    <Text strong style={{ fontSize: 13 }}>
                        Crear nuevo en <Tag color="blue" style={{ fontFamily: 'monospace' }}>{quickFk?.lookup.tableName}</Tag>
                    </Text>
                </div>
            }
            width={700}
            centered
            footer={null}
        >
            {quickFk && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {quickFkCols.length === 0 ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}><Spin size="small" /></div>
                    ) : (
                        <div style={{ maxHeight: 420, overflowY: 'auto', paddingRight: 8 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                {quickFkCols.map(col => {
                                    const boolPats = ['habilitado','activo','active','enabled','envia_','es_','oculto','visible','is_','tiene_','permite_','transaccional','vigente','estado'];
                                    const imgPats  = ['firma_','foto','imagen','logo','avatar','signature'];
                                    const isBool = boolPats.some(p => col.toLowerCase().includes(p));
                                    const isImg  = imgPats.some(p => col.toLowerCase().includes(p));

                                    if (isImg) {
                                        return (
                                            <div key={col}>
                                                <Text style={{ fontSize: 12, fontWeight: 600, color: '#1c7ed6', display: 'block', marginBottom: 4 }}>{formatHeader(col)}</Text>
                                                <Upload
                                                    accept="image/*"
                                                    showUploadList={false}
                                                    beforeUpload={async (file) => {
                                                        const fd = new FormData();
                                                        fd.append('archivo', file);
                                                        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                                                        const token = localStorage.getItem('token');
                                                        const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                                                        const json = await res.json();
                                                        if (json.success) setQuickFkFormData((p: any) => ({ ...p, [col]: json.filePath }));
                                                        return false;
                                                    }}
                                                >
                                                    <Button size="small" icon={<IconUpload size={14} />}>Seleccionar imagen...</Button>
                                                </Upload>
                                            </div>
                                        );
                                    }
                                    if (isBool) {
                                        return (
                                            <div key={col}>
                                                <Text style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>{formatHeader(col)}</Text>
                                                <Select
                                                    style={{ width: '100%' }}
                                                    options={[{ value: '1', label: '✅ Sí / Habilitado' }, { value: '0', label: '❌ No / Deshabilitado' }]}
                                                    value={quickFkFormData[col] !== undefined ? String(quickFkFormData[col]) : '1'}
                                                    onChange={(v) => setQuickFkFormData((p: any) => ({ ...p, [col]: v }))}
                                                />
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={col}>
                                            <Text style={{ fontSize: 12, fontWeight: 600, color: col === quickFk.lookup.displayColumn ? '#1c7ed6' : undefined, display: 'block', marginBottom: 4 }}>{formatHeader(col)}</Text>
                                            <Input
                                                placeholder={col}
                                                value={quickFkFormData[col] || ''}
                                                onChange={(e) => setQuickFkFormData((p: any) => ({ ...p, [col]: e.currentTarget.value }))}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setQuickFk(null)} disabled={quickFkSaving}>Cancelar</Button>
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#2f9e44', borderColor: '#2f9e44' }}
                            icon={<IconPlus size={16} />}
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
                    </div>
                </div>
            )}
        </Modal>
    );

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

        const generalPanel = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
                        <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                <IconBadge color="blue" size={28}><IconSettings size={16} /></IconBadge>
                                <Title level={5} style={{ margin: 0 }}>Estado del Registro</Title>
                            </div>
                            <Select
                                options={[
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
                                style={{ maxWidth: 300, width: '100%' }}
                            />
                        </div>
                    );
                })()}

                {/* Dependency selectors (clientes, componentes) */}
                {config.dependsOn === 'clientes' && (
                    <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <IconBadge color="teal" size={28}><IconBuilding size={16} /></IconBadge>
                            <Title level={5} style={{ margin: 0 }}>Cliente Asociado</Title>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                            <Select
                                placeholder="Seleccione cliente..."
                                options={dependencyData.map(c => ({ value: String(c.id || c.id_empresa), label: String(c.nombre || c.nombre_empresa || '(sin nombre)') }))}
                                value={formData.id_empresa ? String(formData.id_empresa) : undefined}
                                onChange={(v) => setFormData({ ...formData, id_empresa: v })}
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                style={{ flex: 1, maxWidth: 400 }}
                            />
                            <Button icon={<IconPlus size={14} />} onClick={() => { setQuickCreateType('clientes'); setQuickFormData({}); }}>
                                Nuevo Cliente
                            </Button>
                        </div>
                    </div>
                )}

                {config.dependsOn === 'componentes' && (
                    <div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <IconBadge color="green" size={28}><IconBuilding size={16} /></IconBadge>
                            <Title level={5} style={{ margin: 0 }}>Componente Asociado</Title>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                            <Select
                                placeholder="Seleccione componente..."
                                options={dependencyData.map(c => ({ value: String(c.id || c.id_tipomuestra), label: String(c.nombre || c.nombre_tipomuestra || '(sin nombre)') }))}
                                value={formData.id_tipomuestra ? String(formData.id_tipomuestra) : undefined}
                                onChange={(v) => setFormData({ ...formData, id_tipomuestra: v })}
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                style={{ flex: 1, maxWidth: 400 }}
                            />
                            <Button icon={<IconPlus size={14} />} onClick={() => { setQuickCreateType('componentes'); setQuickFormData({}); }}>
                                Nuevo Componente
                            </Button>
                        </div>
                    </div>
                )}

                <div style={{ borderTop: '1px solid var(--app-border)' }} />

                {/* Main fields */}
                <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <IconBadge color="blue" size={28}><IconSettings size={16} /></IconBadge>
                        <Title level={5} style={{ margin: 0 }}>Atributos de {config.label}</Title>
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>Complete los campos para registrar la información.</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
                        {generalFields.map((col: string) => renderField(col))}
                    </div>
                </div>

                {advancedFields.length === 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            type="primary"
                            icon={<IconCheck size={18} />}
                            onClick={() => setConfirmSaveOpen(true)}
                            loading={saving}
                        >
                            {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                        </Button>
                    </div>
                )}

                {advancedFields.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={() => setActiveFormTab('advanced')}>
                            Ver Datos Detallados <IconArrowRight size={16} style={{ marginLeft: 6, verticalAlign: 'middle' }} />
                        </Button>
                    </div>
                )}
            </div>
        );

        const advancedPanel = (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <IconBadge color="grape" size={28}><IconActivity size={16} /></IconBadge>
                        <Title level={5} style={{ margin: 0 }}>Configuración Detallada</Title>
                    </div>
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 20 }}>Campos adicionales y configuración avanzada del registro.</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                        {advancedFields.map((col: string) => renderField(col))}
                    </div>
                </div>

                <div style={{ borderTop: '1px solid var(--app-border)' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        type="primary"
                        icon={<IconCheck size={18} />}
                        onClick={() => setConfirmSaveOpen(true)}
                        loading={saving}
                    >
                        {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                    </Button>
                </div>
            </div>
        );

        return (
            <div style={{ animation: 'fadeIn 0.4s ease' }}>
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                `}} />
                {/* Header bar */}
                <div style={{ padding: '16px 16px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Button
                                type="text"
                                icon={<IconArrowLeft size={16} />}
                                onClick={() => setView('list')}
                                style={{ width: 'fit-content', padding: 0, color: 'var(--app-text-secondary)' }}
                            >
                                Volver al Listado
                            </Button>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <IconBadge color="blue" size={44}>
                                    {editingItem ? <IconEdit size={22} /> : <IconPlus size={22} />}
                                </IconBadge>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, display: 'block' }}>
                                        {editingItem ? 'Editando registro' : 'Nuevo Registro'} — {config.tableName}
                                    </Text>
                                    <Title level={3} style={{ margin: 0, color: '#1864ab' }}>
                                        {editingItem && config.displayColumn
                                            ? (editingItem[config.displayColumn] || config.label)
                                            : config.label}
                                    </Title>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
                            <Button onClick={() => setView('list')}>
                                Cancelar
                            </Button>
                            <Button
                                type="primary"
                                icon={<IconCheck size={18} />}
                                onClick={() => setConfirmSaveOpen(true)}
                                loading={saving}
                            >
                                {editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div style={{ padding: '24px 16px' }}>
                    <Card>
                        <Tabs
                            activeKey={activeFormTab}
                            onChange={setActiveFormTab}
                            items={[
                                { key: 'general', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconSettings size={16} /> Información General</span>, children: generalPanel },
                                ...(advancedFields.length > 0 ? [{ key: 'advanced', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconActivity size={16} /> Datos Detallados</span>, children: advancedPanel }] : [])
                            ]}
                        />
                    </Card>
                </div>

                {/* Quick Create Modal */}
                <Modal
                    open={quickCreateType !== null}
                    onCancel={() => !quickSaving && setQuickCreateType(null)}
                    title={
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <IconBadge color="green" size={28}><IconPlus size={18} /></IconBadge>
                            <Text strong>Creación Rápida: {quickCreateType === 'clientes' ? 'Nuevo Cliente' : 'Nuevo Componente'}</Text>
                        </div>
                    }
                    width={480}
                    centered
                    footer={null}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {quickCreateType === 'clientes' ? (
                            <>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nombre de Empresa *</Text>
                                    <Input
                                        value={quickFormData.nombre_empresa || ''}
                                        onChange={(e) => setQuickFormData({...quickFormData, nombre_empresa: e.currentTarget.value})}
                                    />
                                </div>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>RUT *</Text>
                                    <Input
                                        placeholder="12.345.678-9"
                                        value={quickFormData.rut_empresa || ''}
                                        onChange={(e) => setQuickFormData({...quickFormData, rut_empresa: e.currentTarget.value})}
                                    />
                                </div>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Dirección *</Text>
                                    <Input
                                        value={quickFormData.direccion_empresa || ''}
                                        onChange={(e) => setQuickFormData({...quickFormData, direccion_empresa: e.currentTarget.value})}
                                    />
                                </div>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Email Empresa *</Text>
                                    <Input
                                        value={quickFormData.email_empresa || ''}
                                        onChange={(e) => setQuickFormData({...quickFormData, email_empresa: e.currentTarget.value})}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Nombre Componente *</Text>
                                    <Input
                                        value={quickFormData.nombre_tipomuestra || ''}
                                        onChange={(e) => setQuickFormData({...quickFormData, nombre_tipomuestra: e.currentTarget.value})}
                                    />
                                </div>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Sigla *</Text>
                                    <Input
                                        value={quickFormData.sigla_tipomuestra || ''}
                                        onChange={(e) => setQuickFormData({...quickFormData, sigla_tipomuestra: e.currentTarget.value})}
                                    />
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                            <Button onClick={() => setQuickCreateType(null)} disabled={quickSaving}>Cancelar</Button>
                            <Button
                                type="primary"
                                style={{ backgroundColor: '#2f9e44', borderColor: '#2f9e44' }}
                                onClick={handleQuickSave}
                                loading={quickSaving}
                            >
                                Crear y Seleccionar
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Confirm Save Modal */}
                <Modal
                    open={confirmSaveOpen}
                    onCancel={() => !saving && setConfirmSaveOpen(false)}
                    title={<Text strong style={{ color: '#1864ab' }}>Confirmación de Guardado</Text>}
                    width={420}
                    centered
                    footer={null}
                >
                    <Text style={{ fontSize: 13, display: 'block', marginBottom: 24 }}>
                        ¿Está seguro que desea {editingItem ? 'actualizar' : 'crear'} este registro en {config.label}?
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setConfirmSaveOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button
                            type="primary"
                            onClick={() => {
                                setConfirmSaveOpen(false);
                                handleSave();
                            }}
                            loading={saving}
                        >
                            Confirmar
                        </Button>
                    </div>
                </Modal>

                {/* ── QUICK-CREATE FK MODAL ── */}
                {quickFkModal}

            </div>
        );
    }



    return (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>

                {fetchError && (
                    <Alert icon={<IconAlertCircle size={16} />} showIcon type="error" style={{ width: '100%' }} message={fetchError} />
                )}
                <Button
                    icon={<IconArrowLeft size={16} />}
                    onClick={onBack}
                >
                    Volver al Panel
                </Button>
                <Button
                    type="primary"
                    icon={<IconPlus size={20} />}
                    onClick={() => handleOpenModal()}
                    disabled={needsDependency}
                >
                    Añadir {config.label}
                </Button>
            </div>

            {needsDependency && (
                <Alert icon={<IconAlertCircle size={16} />} showIcon type="warning" message="Atención" description={
                    <>Necesita crear primero registros en el maestro <strong>{config.dependsOn}</strong> antes de poder añadir nuevos {config.label}.</>
                } />
            )}

            {/* ── MAESTRO INFO PANEL ─────────────────────────────────────── */}
            <Card size="small" style={{ background: '#e7f3ff', borderColor: '#a5d8ff' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <IconBadge color="blue" size={20}><IconSettings size={12} /></IconBadge>
                    <Text strong style={{ fontSize: 12, color: '#1864ab' }}>Información del Maestro</Text>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Tabla */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12 }} type="secondary">Tabla:</Text>
                        <Tag color="blue" style={{ fontFamily: 'monospace' }}>{config.tableName}</Tag>
                    </div>
                    {/* ID */}
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12 }} type="secondary">ID:</Text>
                        <Tag style={{ fontFamily: 'monospace' }}>{config.idName}</Tag>
                    </div>
                    {/* Status column */}
                    {config.statusColumn && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12 }} type="secondary">Estado:</Text>
                            <Tag color="green" style={{ fontFamily: 'monospace' }}>{config.statusColumn}</Tag>
                        </div>
                    )}
                    {/* Lookups / FK relations */}
                    {config.lookups && Object.entries(config.lookups).map(([field, lookup]) => (
                        <div key={field} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Tag color="purple" style={{ fontFamily: 'monospace' }}>{field}</Tag>
                            <Text style={{ fontSize: 12 }} type="secondary">→</Text>
                            <Tag color="purple" style={{ fontFamily: 'monospace' }}>{lookup.tableName}.{lookup.displayColumn}</Tag>
                        </div>
                    ))}
                    {/* Dependency */}
                    {config.dependsOn && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12 }} type="secondary">Depende de:</Text>
                            <Tag color="orange">{config.dependsOn}</Tag>
                        </div>
                    )}
                    {/* Total records */}
                    {data.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <Text style={{ fontSize: 12 }} type="secondary">Registros:</Text>
                            <Tag color="blue">{data.length}</Tag>
                        </div>
                    )}
                </div>
            </Card>

            <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Text strong style={{ fontSize: 20 }}>{config.label}</Text>
                            <Tag>{config.tableName}</Tag>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <Select
                                placeholder="Estado"
                                options={[
                                    { value: 'all', label: 'Todos los estados' },
                                    { value: 'active', label: 'Solo Activos' },
                                    { value: 'inactive', label: 'Solo Inactivos' }
                                ]}
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v || 'all')}
                                style={{ width: 190 }}
                            />

                            {/* Dynamic filters based on FK lookups */}
                            {config.lookups && Object.entries(config.lookups).map(([field, lookup]) => {
                                if (!lookup) return null;
                                const options = lookupData[field] || [];
                                return (
                                    <Select
                                        key={`filter-${field}`}
                                        placeholder={`Filtrar por ${formatHeader(field)}`}
                                        options={(() => {
                                            const seen = new Set();
                                            return options
                                                .map(opt => ({
                                                    value: String(opt[lookup.idColumn]),
                                                    label: String(opt[lookup.displayColumn])
                                                }))
                                                .filter(opt => {
                                                    if (!opt.value || opt.value === 'undefined' || opt.value === 'null') return false;
                                                    if (seen.has(opt.value)) return false;
                                                    seen.add(opt.value);
                                                    return true;
                                                });
                                        })()}
                                        value={dynamicFilters[field] || undefined}
                                        onChange={(v) => setDynamicFilters(prev => ({ ...prev, [field]: v || '' }))}
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                        style={{ width: 200 }}
                                    />
                                );
                            })}

                            {/* Dynamic filters based on hierarchical dependencies */}
                            {config.dependsOn === 'clientes' && (
                                <Select
                                    placeholder="Filtrar por Cliente"
                                    options={dependencyData.map(c => ({
                                        value: String(c.id || c.id_empresa),
                                        label: String(c.nombre || c.nombre_empresa)
                                    }))}
                                    value={dynamicFilters['id_empresa'] || undefined}
                                    onChange={(v) => setDynamicFilters(prev => ({ ...prev, id_empresa: v || '' }))}
                                    allowClear
                                    showSearch
                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                    style={{ width: 200 }}
                                />
                            )}

                            {config.dependsOn === 'componentes' && (
                                <Select
                                    placeholder="Filtrar por Componente"
                                    options={dependencyData.map(c => ({
                                        value: String(c.id || c.id_tipomuestra),
                                        label: String(c.nombre || c.nombre_tipomuestra)
                                    }))}
                                    value={dynamicFilters['id_tipomuestra'] || undefined}
                                    onChange={(v) => setDynamicFilters(prev => ({ ...prev, id_tipomuestra: v || '' }))}
                                    allowClear
                                    showSearch
                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                    style={{ width: 200 }}
                                />
                            )}

                            <Input
                                placeholder="Buscar..."
                                prefix={<IconSearch size={16} />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                style={{ width: 250 }}
                            />
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', minWidth: 800, borderCollapse: 'collapse' }}>
                            <thead style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                                <tr>
                                    <th style={{ width: 80, textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--app-border)' }}>ID</th>

                                    {/* Granular columns */}
                                    {mainTableColumns.map((col: string) => (
                                        <th key={col} style={{ textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--app-border)' }}>{formatHeader(col)}</th>
                                    ))}

                                    {hasStatusColumn && <th style={{ width: 100, textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--app-border)' }}>Estado</th>}
                                    <th style={{ width: 100, textAlign: 'left', padding: '10px 12px', borderBottom: '1px solid var(--app-border)' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={mainTableColumns.length + 3} style={{ textAlign: 'center', padding: '32px 0' }}>
                                            <Spin size="small" />
                                            <Text style={{ fontSize: 13, display: 'block', marginTop: 8 }}>Cargando datos...</Text>
                                        </td>
                                    </tr>
                                ) : filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={mainTableColumns.length + 3} style={{ textAlign: 'center', padding: '32px 0' }}>
                                            <Text type="secondary">No se encontraron registros</Text>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((item) => {
                                        const status = item[config.statusColumn || 'habilitado'] || item.activo || item.estado || 'S';
                                        const isActive = status === 'S' || status === 'V' || status === 1 || status === true;

                                        return (
                                            <tr key={item[config.idName]} style={{ borderBottom: '1px solid var(--app-border)' }}>
                                                <td style={{ padding: '10px 12px' }}>
                                                    <Text style={{ fontSize: 12, fontWeight: 500 }} type="secondary">{item[config.idName]}</Text>
                                                </td>

                                                {/* Granular data cells */}
                                                {mainTableColumns.map((col: string) => {
                                                    const raw = item[col];

                                                    // Only treat as boolean if column NAME suggests it, not just any 0/1 value
                                                    const boolNamePatterns = ['envia_', 'es_', 'oculto', 'visible', 'activo', 'active', 'enabled', 'is_', 'tiene_', 'permite_', 'transaccional'];
                                                    const isBoolCol = typeof raw === 'boolean' || boolNamePatterns.some(p => col.toLowerCase().includes(p));
                                                    const isNullValue = raw === null || raw === undefined || raw === '';
                                                    const isDescCol = /descrip|observ/i.test(col);
                                                    let displayValue: React.ReactNode = isNullValue
                                                        ? <Text style={{ fontSize: 12, fontStyle: 'italic' }} type="secondary">{isDescCol ? 'Sin observaciones' : 'null'}</Text>
                                                        : String(raw);

                                                    if (isBoolCol && raw !== null && raw !== undefined) {
                                                        const isTrue = raw === true || raw === 1;
                                                        displayValue = (
                                                            <Tag color={isTrue ? 'green' : 'default'}>
                                                                {isTrue ? '✅ Sí' : '❌ No'}
                                                            </Tag>
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

                                                    const isNameCol = col === config.displayColumn;
                                                    return (
                                                        <td key={col} style={{ padding: '10px 12px', minWidth: isNameCol ? 220 : undefined }}>
                                                            <Text
                                                                style={{
                                                                    fontSize: 13,
                                                                    fontWeight: isNameCol ? 600 : 400,
                                                                    ...(isNameCol
                                                                        ? { whiteSpace: 'normal', wordBreak: 'break-word' }
                                                                        : { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 250, display: 'block' })
                                                                }}
                                                            >
                                                                {displayValue}
                                                            </Text>
                                                        </td>
                                                    );
                                                })}

                                                {hasStatusColumn && (
                                                    <td style={{ padding: '10px 12px' }}>
                                                        <Tag color={isActive ? 'green' : 'red'}>
                                                            {isActive ? 'Activo' : 'Inactivo'}
                                                        </Tag>
                                                    </td>
                                                )}

                                                <td style={{ padding: '10px 12px' }}>
                                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                                                        <Tooltip title="Editar">
                                                            <Button
                                                                type="text"
                                                                size="small"
                                                                style={{ color: '#1c7ed6' }}
                                                                icon={<IconEdit size={14} />}
                                                                onClick={() => handleOpenModal(item)}
                                                            />
                                                        </Tooltip>
                                                        {hasStatusColumn && (
                                                            <Tooltip title={isActive ? 'Deshabilitar' : 'Habilitar'}>
                                                                <Button
                                                                    type="text"
                                                                    size="small"
                                                                    style={{ color: isActive ? '#e03131' : '#2f9e44' }}
                                                                    icon={isActive ? <IconTrash size={14} /> : <IconCheck size={14} />}
                                                                    onClick={() => handleToggleStatus(item)}
                                                                />
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {totalPages > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16, marginBottom: 8 }}>
                            <Pagination
                                total={filteredData.length}
                                pageSize={itemsPerPage}
                                current={page}
                                onChange={setPage}
                                showSizeChanger={false}
                            />
                        </div>
                    )}
                </div>
            </Card>
        </div>
        <style dangerouslySetInnerHTML={{ __html: `
            @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        `}} />

        {/* ── QUICK-CREATE FK MODAL (list view) ── */}
        {quickFkModal}
        </>

    );
};
