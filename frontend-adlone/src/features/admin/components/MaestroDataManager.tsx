import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, SortableTableHead, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useTableSort } from '../../../hooks/useTableSort';
import {
    IconEdit,
    IconTrash,
    IconPlus,
    IconSearch,
    IconArrowLeft,
    IconCheck,
    IconAlertCircle,
    IconAlertTriangle,
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

const iconColors: Record<string, string> = {
    blue: '#1c7ed6', teal: '#0c8599', green: '#2f9e44', grape: '#9c36b5', orange: '#e8590c', gray: '#868e96'
};
const IconBadge: React.FC<{ children: React.ReactNode; color?: string; size?: number }> = ({ children, color = 'blue', size = 32 }) => {
    const hex = iconColors[color] || color;
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-lg"
            style={{ width: size, height: size, backgroundColor: `${hex}1a`, color: hex }}
        >
            {children}
        </div>
    );
};

const AlertBox: React.FC<{ variant: 'error' | 'warning'; icon?: React.ReactNode; children: React.ReactNode }> = ({ variant, icon, children }) => (
    <div
        className={cn(
            'flex w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-sm',
            variant === 'error'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-warning/30 bg-warning/10 text-warning'
        )}
    >
        {icon}
        <div className="min-w-0 flex-1">{children}</div>
    </div>
);

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

    const firmaFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

    // Detect if table actually has a status column in the data
    const hasStatusColumn = useMemo(() => {
        if (data.length === 0) return false;
        const knownStatusCols = ['habilitado', 'activo', 'estado', 'active', 'enabled'];
        const explicit = config.statusColumn;
        const dataKeys = Object.keys(data[0]);
        return explicit ? dataKeys.includes(explicit) : knownStatusCols.some(c => dataKeys.includes(c));
    }, [data, config]);

    const sortAccessors = useMemo(() => {
        const acc: Record<string, (row: any) => string | number | null | undefined> = {};
        mainTableColumns.forEach((col: string) => {
            acc[col] = (row: any) => {
                const v = row[col];
                if (v === null || v === undefined || v === '') return null;
                if (typeof v === 'number') return v;
                if (typeof v === 'boolean') return v ? 1 : 0;
                return String(v);
            };
        });
        if (hasStatusColumn) {
            acc.__estado = (row: any) => {
                const status = row[config.statusColumn || 'habilitado'] || row.activo || row.estado || 'S';
                const isActive = status === 'S' || status === 'V' || status === 1 || status === true;
                return isActive ? 0 : 1;
            };
        }
        return acc;
    }, [mainTableColumns, hasStatusColumn, config]);

    const { sorted: sortedData, sort, toggleSort } = useTableSort(filteredData, sortAccessors);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * itemsPerPage;
        return sortedData.slice(start, start + itemsPerPage);
    }, [sortedData, page]);

    const sortProps = (col: string) => ({
        active: sort.key === col,
        direction: sort.direction,
        onSort: () => { toggleSort(col); setPage(1); },
    });

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

    // All columns for the form view
    const allDetailColumns = useMemo(() => {
        if (data.length === 0) return [];
        // Only exclude the PK id - everything else is editable
        return Object.keys(data[0]).filter(key => key !== config.idName && key !== 'id');
    }, [data, config]);

    const needsDependency = useMemo(() =>
        Boolean(config.dependsOn && dependencyData.length === 0 && !dependencyLoading),
    [config.dependsOn, dependencyData.length, dependencyLoading]);

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

            const comboOptions = (() => {
                const seen = new Set<string>();
                const opts = options
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
                return [{ value: '', label: '(Sin selección)' }, ...opts];
            })();

            return (
                <div key={col} className="flex flex-nowrap items-end gap-1.5">
                    <div className="flex-1">
                        <Label className="mb-1 block text-[13px] font-semibold text-primary">{formatHeader(col)}</Label>
                        <Combobox
                            className="border-l-[3px] border-l-sky-400"
                            placeholder={`Seleccione ${formatHeader(col)}...`}
                            searchPlaceholder="Buscar..."
                            emptyText="Sin opciones disponibles"
                            options={comboOptions}
                            value={formData[col] === null || formData[col] === undefined ? '' : String(formData[col])}
                            onValueChange={(v) => {
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
                        />
                    </div>
                    {!lookup.noCreate && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="mb-0.5 h-9 w-9 text-success"
                            title={`Crear nuevo en ${lookup.tableName}`}
                            onClick={() => openQuickFk(col, lookup)}
                        >
                            <IconPlus size={18} />
                        </Button>
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
                    <Label className="mb-1.5 block text-[13px] font-semibold text-primary">{formatHeader(col)}</Label>
                    {previewUrl && (
                        <div className="mb-2 inline-block rounded-lg border border-border bg-muted/40 p-2">
                            <img
                                src={previewUrl}
                                alt={col}
                                className="h-[120px] w-auto rounded object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x120?text=Sin+imagen'; }}
                            />
                            <p className="mt-1 block text-center text-[11px] text-muted-foreground">{currentPath}</p>
                        </div>
                    )}
                    <input
                        ref={(el) => { firmaFileInputRefs.current[col] = el; }}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { handleFileChange(e.target.files?.[0] ?? null); e.target.value = ''; }}
                    />
                    <Button type="button" variant="outline" onClick={() => firmaFileInputRefs.current[col]?.click()}>
                        <IconUpload size={16} /> {previewUrl ? 'Cambiar imagen...' : 'Seleccionar imagen...'}
                    </Button>
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
                    <Label className="mb-1 block text-[13px] font-semibold text-primary">{formatHeader(col)}</Label>
                    <Combobox
                        options={[
                            { value: 'true', label: '✅ Sí' },
                            { value: 'false', label: '❌ No' },
                        ]}
                        value={isCurrentlyTrue ? 'true' : 'false'}
                        onValueChange={(v) => {
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
                    <Label className="mb-1 block text-[13px]">{formatHeader(col)}</Label>
                    <div className="relative">
                        {icon && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
                        <Input
                            placeholder={col}
                            type="date"
                            value={val}
                            onChange={(e) => setFormData({ ...formData, [col]: e.currentTarget.value })}
                            className={icon ? 'pl-8' : undefined}
                        />
                    </div>
                </div>
            );
        }

        return (
            <div key={col}>
                <Label className="mb-1 block text-[13px]">{formatHeader(col)}</Label>
                <div className="relative">
                    {icon && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
                    <Input
                        placeholder={col}
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
                        className={icon ? 'pl-8' : undefined}
                    />
                </div>
            </div>
        );
    };

    const quickFkModal = (
        <Dialog open={!!quickFk} onOpenChange={(open) => { if (!open && !quickFkSaving) setQuickFk(null); }}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconBadge color="green" size={28}><IconPlus size={16} /></IconBadge>
                        <span className="text-[13px] font-semibold">
                            Crear nuevo en <Badge variant="outline" className="font-mono">{quickFk?.lookup.tableName}</Badge>
                        </span>
                    </DialogTitle>
                </DialogHeader>

                {quickFk && (
                    <div className="flex flex-col gap-4">
                        {quickFkCols.length === 0 ? (
                            <div className="flex justify-center p-4">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        ) : (
                            <div className="max-h-[420px] overflow-y-auto pr-2">
                                <div className="grid grid-cols-2 gap-4">
                                    {quickFkCols.map(col => {
                                        const boolPats = ['habilitado','activo','active','enabled','envia_','es_','oculto','visible','is_','tiene_','permite_','transaccional','vigente','estado'];
                                        const imgPats  = ['firma_','foto','imagen','logo','avatar','signature'];
                                        const isBool = boolPats.some(p => col.toLowerCase().includes(p));
                                        const isImg  = imgPats.some(p => col.toLowerCase().includes(p));

                                        if (isImg) {
                                            return (
                                                <div key={col}>
                                                    <Label className="mb-1 block text-xs font-semibold text-primary">{formatHeader(col)}</Label>
                                                    <input
                                                        id={`quickfk-file-${col}`}
                                                        type="file"
                                                        accept="image/*"
                                                        className="hidden"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            e.target.value = '';
                                                            if (!file) return;
                                                            const fd = new FormData();
                                                            fd.append('archivo', file);
                                                            const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
                                                            const token = localStorage.getItem('token');
                                                            const res = await fetch(`${apiBase}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
                                                            const json = await res.json();
                                                            if (json.success) setQuickFkFormData((p: any) => ({ ...p, [col]: json.filePath }));
                                                        }}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => document.getElementById(`quickfk-file-${col}`)?.click()}
                                                    >
                                                        <IconUpload size={14} /> Seleccionar imagen...
                                                    </Button>
                                                </div>
                                            );
                                        }
                                        if (isBool) {
                                            return (
                                                <div key={col}>
                                                    <Label className="mb-1 block text-xs font-semibold">{formatHeader(col)}</Label>
                                                    <Combobox
                                                        options={[{ value: '1', label: '✅ Sí / Habilitado' }, { value: '0', label: '❌ No / Deshabilitado' }]}
                                                        value={quickFkFormData[col] !== undefined ? String(quickFkFormData[col]) : '1'}
                                                        onValueChange={(v) => setQuickFkFormData((p: any) => ({ ...p, [col]: v }))}
                                                    />
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={col}>
                                                <Label className={cn('mb-1 block text-xs font-semibold', col === quickFk.lookup.displayColumn && 'text-primary')}>{formatHeader(col)}</Label>
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
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setQuickFk(null)} disabled={quickFkSaving}>Cancelar</Button>
                            <Button
                                type="button"
                                className="bg-success text-success-foreground hover:bg-success/90"
                                disabled={quickFkSaving || !quickFkFormData[quickFk.lookup.displayColumn]?.trim?.()}
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
                                <IconPlus size={16} /> {quickFkSaving ? 'Creando...' : 'Crear'}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
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
            <div className="flex flex-col gap-6">
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
                            <div className="mb-1 flex items-center gap-2">
                                <IconBadge color="blue" size={28}><IconSettings size={16} /></IconBadge>
                                <h5 className="m-0 text-base font-semibold">Estado del Registro</h5>
                            </div>
                            <Combobox
                                className="max-w-[300px]"
                                options={[
                                    { value: 'on', label: '✅ Habilitado / Activo' },
                                    { value: 'off', label: '🚫 Deshabilitado / Inactivo' }
                                ]}
                                value={isOn ? 'on' : 'off'}
                                onValueChange={(v) => {
                                    const isActive = v === 'on';
                                    let newVal: any = isActive;
                                    if (isInt) newVal = isActive ? 1 : 0;
                                    else if (isStr) newVal = isActive ? 'S' : 'N';
                                    setFormData({ ...formData, [statusCol]: newVal });
                                }}
                            />
                        </div>
                    );
                })()}

                {/* Dependency selectors (clientes, componentes) */}
                {config.dependsOn === 'clientes' && (
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <IconBadge color="teal" size={28}><IconBuilding size={16} /></IconBadge>
                            <h5 className="m-0 text-base font-semibold">Cliente Asociado</h5>
                        </div>
                        <div className="flex items-end gap-2">
                            <Combobox
                                className="max-w-[400px] flex-1"
                                placeholder="Seleccione cliente..."
                                searchPlaceholder="Buscar..."
                                options={dependencyData.map(c => ({ value: String(c.id || c.id_empresa), label: String(c.nombre || c.nombre_empresa || '(sin nombre)') }))}
                                value={formData.id_empresa ? String(formData.id_empresa) : ''}
                                onValueChange={(v) => setFormData({ ...formData, id_empresa: v })}
                            />
                            <Button type="button" variant="outline" onClick={() => { setQuickCreateType('clientes'); setQuickFormData({}); }}>
                                <IconPlus size={14} /> Nuevo Cliente
                            </Button>
                        </div>
                    </div>
                )}

                {config.dependsOn === 'componentes' && (
                    <div>
                        <div className="mb-2 flex items-center gap-2">
                            <IconBadge color="green" size={28}><IconBuilding size={16} /></IconBadge>
                            <h5 className="m-0 text-base font-semibold">Componente Asociado</h5>
                        </div>
                        <div className="flex items-end gap-2">
                            <Combobox
                                className="max-w-[400px] flex-1"
                                placeholder="Seleccione componente..."
                                searchPlaceholder="Buscar..."
                                options={dependencyData.map(c => ({ value: String(c.id || c.id_tipomuestra), label: String(c.nombre || c.nombre_tipomuestra || '(sin nombre)') }))}
                                value={formData.id_tipomuestra ? String(formData.id_tipomuestra) : ''}
                                onValueChange={(v) => setFormData({ ...formData, id_tipomuestra: v })}
                            />
                            <Button type="button" variant="outline" onClick={() => { setQuickCreateType('componentes'); setQuickFormData({}); }}>
                                <IconPlus size={14} /> Nuevo Componente
                            </Button>
                        </div>
                    </div>
                )}

                <div className="border-t border-border" />

                {/* Main fields */}
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <IconBadge color="blue" size={28}><IconSettings size={16} /></IconBadge>
                        <h5 className="m-0 text-base font-semibold">Atributos de {config.label}</h5>
                    </div>
                    <p className="mb-5 block text-[13px] text-muted-foreground">Complete los campos para registrar la información.</p>
                    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                        {generalFields.map((col: string) => renderField(col))}
                    </div>
                </div>

                {advancedFields.length === 0 && (
                    <div className="flex justify-end">
                        <Button type="button" onClick={() => setConfirmSaveOpen(true)} disabled={saving}>
                            <IconCheck size={18} /> {saving ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                        </Button>
                    </div>
                )}

                {advancedFields.length > 0 && (
                    <div className="flex justify-end">
                        <Button type="button" variant="outline" onClick={() => setActiveFormTab('advanced')}>
                            Ver Datos Detallados <IconArrowRight size={16} />
                        </Button>
                    </div>
                )}
            </div>
        );

        const advancedPanel = (
            <div className="flex flex-col gap-6">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <IconBadge color="grape" size={28}><IconActivity size={16} /></IconBadge>
                        <h5 className="m-0 text-base font-semibold">Configuración Detallada</h5>
                    </div>
                    <p className="mb-5 block text-[13px] text-muted-foreground">Campos adicionales y configuración avanzada del registro.</p>
                    <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                        {advancedFields.map((col: string) => renderField(col))}
                    </div>
                </div>

                <div className="border-t border-border" />
                <div className="flex justify-end">
                    <Button type="button" onClick={() => setConfirmSaveOpen(true)} disabled={saving}>
                        <IconCheck size={18} /> {saving ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                    </Button>
                </div>
            </div>
        );

        return (
            <div className="shadcn-scope animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Header bar */}
                <div className="p-4 pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-col gap-1">
                            <Button
                                type="button"
                                variant="ghost"
                                className="h-auto w-fit p-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
                                onClick={() => setView('list')}
                            >
                                <IconArrowLeft size={16} /> Volver al Listado
                            </Button>
                            <div className="flex items-center gap-2">
                                <IconBadge color="blue" size={44}>
                                    {editingItem ? <IconEdit size={22} /> : <IconPlus size={22} />}
                                </IconBadge>
                                <div>
                                    <p className="block text-xs font-medium text-muted-foreground">
                                        {editingItem ? 'Editando registro' : 'Nuevo Registro'} — {config.tableName}
                                    </p>
                                    <h3 className="m-0 text-xl font-semibold text-primary">
                                        {editingItem && config.displayColumn
                                            ? (editingItem[config.displayColumn] || config.label)
                                            : config.label}
                                    </h3>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 flex gap-2">
                            <Button type="button" variant="outline" onClick={() => setView('list')}>
                                Cancelar
                            </Button>
                            <Button type="button" onClick={() => setConfirmSaveOpen(true)} disabled={saving}>
                                <IconCheck size={18} /> {saving ? 'Guardando...' : editingItem ? 'Guardar Cambios' : 'Crear Registro'}
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="p-4 py-6">
                    <Card>
                        <CardContent className="p-5">
                            <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
                                <TabsList>
                                    <TabsTrigger value="general" className="gap-1.5"><IconSettings size={16} /> Información General</TabsTrigger>
                                    {advancedFields.length > 0 && (
                                        <TabsTrigger value="advanced" className="gap-1.5"><IconActivity size={16} /> Datos Detallados</TabsTrigger>
                                    )}
                                </TabsList>
                                <TabsContent value="general">{generalPanel}</TabsContent>
                                {advancedFields.length > 0 && (
                                    <TabsContent value="advanced">{advancedPanel}</TabsContent>
                                )}
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                {/* Quick Create Modal */}
                <Dialog open={quickCreateType !== null} onOpenChange={(open) => { if (!open && !quickSaving) setQuickCreateType(null); }}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <IconBadge color="green" size={28}><IconPlus size={18} /></IconBadge>
                                Creación Rápida: {quickCreateType === 'clientes' ? 'Nuevo Cliente' : 'Nuevo Componente'}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="flex flex-col gap-3">
                            {quickCreateType === 'clientes' ? (
                                <>
                                    <div>
                                        <Label className="mb-1 block text-xs">Nombre de Empresa *</Label>
                                        <Input
                                            value={quickFormData.nombre_empresa || ''}
                                            onChange={(e) => setQuickFormData({...quickFormData, nombre_empresa: e.currentTarget.value})}
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-1 block text-xs">RUT *</Label>
                                        <Input
                                            placeholder="12.345.678-9"
                                            value={quickFormData.rut_empresa || ''}
                                            onChange={(e) => setQuickFormData({...quickFormData, rut_empresa: e.currentTarget.value})}
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-1 block text-xs">Dirección *</Label>
                                        <Input
                                            value={quickFormData.direccion_empresa || ''}
                                            onChange={(e) => setQuickFormData({...quickFormData, direccion_empresa: e.currentTarget.value})}
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-1 block text-xs">Email Empresa *</Label>
                                        <Input
                                            value={quickFormData.email_empresa || ''}
                                            onChange={(e) => setQuickFormData({...quickFormData, email_empresa: e.currentTarget.value})}
                                        />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <Label className="mb-1 block text-xs">Nombre Componente *</Label>
                                        <Input
                                            value={quickFormData.nombre_tipomuestra || ''}
                                            onChange={(e) => setQuickFormData({...quickFormData, nombre_tipomuestra: e.currentTarget.value})}
                                        />
                                    </div>
                                    <div>
                                        <Label className="mb-1 block text-xs">Sigla *</Label>
                                        <Input
                                            value={quickFormData.sigla_tipomuestra || ''}
                                            onChange={(e) => setQuickFormData({...quickFormData, sigla_tipomuestra: e.currentTarget.value})}
                                        />
                                    </div>
                                </>
                            )}

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setQuickCreateType(null)} disabled={quickSaving}>Cancelar</Button>
                                <Button
                                    type="button"
                                    className="bg-success text-success-foreground hover:bg-success/90"
                                    onClick={handleQuickSave}
                                    disabled={quickSaving}
                                >
                                    {quickSaving ? 'Creando...' : 'Crear y Seleccionar'}
                                </Button>
                            </DialogFooter>
                        </div>
                    </DialogContent>
                </Dialog>

                {/* Confirm Save Modal */}
                <Dialog open={confirmSaveOpen} onOpenChange={(open) => { if (!open && !saving) setConfirmSaveOpen(false); }}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="text-primary">Confirmación de Guardado</DialogTitle>
                        </DialogHeader>
                        <p className="block text-[13px]">
                            ¿Está seguro que desea {editingItem ? 'actualizar' : 'crear'} este registro en {config.label}?
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setConfirmSaveOpen(false)} disabled={saving}>Cancelar</Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    setConfirmSaveOpen(false);
                                    handleSave();
                                }}
                                disabled={saving}
                            >
                                {saving ? 'Guardando...' : 'Confirmar'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* ── QUICK-CREATE FK MODAL ── */}
                {quickFkModal}

            </div>
        );
    }



    return (
        <div className="shadcn-scope flex flex-col gap-4">
            <div className="flex flex-wrap justify-between gap-3">

                {fetchError && (
                    <AlertBox variant="error" icon={<IconAlertCircle size={16} className="mt-0.5 shrink-0" />}>
                        {fetchError}
                    </AlertBox>
                )}
                <Button type="button" variant="outline" onClick={onBack}>
                    <IconArrowLeft size={16} /> Volver al Panel
                </Button>
                <Button type="button" onClick={() => handleOpenModal()} disabled={needsDependency}>
                    <IconPlus size={20} /> Añadir {config.label}
                </Button>
            </div>

            {needsDependency && (
                <AlertBox variant="warning" icon={<IconAlertTriangle size={16} className="mt-0.5 shrink-0" />}>
                    <span className="font-semibold">Atención: </span>
                    Necesita crear primero registros en el maestro <strong>{config.dependsOn}</strong> antes de poder añadir nuevos {config.label}.
                </AlertBox>
            )}

            {/* ── MAESTRO INFO PANEL ─────────────────────────────────────── */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                        <IconBadge color="blue" size={20}><IconSettings size={12} /></IconBadge>
                        <span className="text-xs font-semibold text-primary">Información del Maestro</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Tabla */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">Tabla:</span>
                            <Badge variant="outline" className="font-mono">{config.tableName}</Badge>
                        </div>
                        {/* ID */}
                        <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">ID:</span>
                            <Badge variant="outline" className="font-mono">{config.idName}</Badge>
                        </div>
                        {/* Status column */}
                        {config.statusColumn && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Estado:</span>
                                <Badge variant="outline" className="font-mono">{config.statusColumn}</Badge>
                            </div>
                        )}
                        {/* Lookups / FK relations */}
                        {config.lookups && Object.entries(config.lookups).map(([field, lookup]) => (
                            <div key={field} className="flex items-center gap-1">
                                <Badge variant="outline" className="font-mono">{field}</Badge>
                                <span className="text-xs text-muted-foreground">→</span>
                                <Badge variant="outline" className="font-mono">{lookup.tableName}.{lookup.displayColumn}</Badge>
                            </div>
                        ))}
                        {/* Dependency */}
                        {config.dependsOn && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Depende de:</span>
                                <Badge variant="outline">{config.dependsOn}</Badge>
                            </div>
                        )}
                        {/* Total records */}
                        {data.length > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">Registros:</span>
                                <Badge variant="outline">{data.length}</Badge>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex flex-wrap justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-semibold">{config.label}</span>
                            <Badge variant="outline">{config.tableName}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Combobox
                                className="w-[190px]"
                                placeholder="Estado"
                                options={[
                                    { value: 'all', label: 'Todos los estados' },
                                    { value: 'active', label: 'Solo Activos' },
                                    { value: 'inactive', label: 'Solo Inactivos' }
                                ]}
                                value={statusFilter}
                                onValueChange={(v) => setStatusFilter(v || 'all')}
                            />

                            {/* Dynamic filters based on FK lookups */}
                            {config.lookups && Object.entries(config.lookups).map(([field, lookup]) => {
                                if (!lookup) return null;
                                const options = lookupData[field] || [];
                                const comboOptions = (() => {
                                    const seen = new Set<string>();
                                    const opts = options
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
                                    return [{ value: '', label: `Todos` }, ...opts];
                                })();
                                return (
                                    <Combobox
                                        key={`filter-${field}`}
                                        className="w-[200px]"
                                        placeholder={`Filtrar por ${formatHeader(field)}`}
                                        searchPlaceholder="Buscar..."
                                        options={comboOptions}
                                        value={dynamicFilters[field] || ''}
                                        onValueChange={(v) => setDynamicFilters(prev => ({ ...prev, [field]: v || '' }))}
                                    />
                                );
                            })}

                            {/* Dynamic filters based on hierarchical dependencies */}
                            {config.dependsOn === 'clientes' && (
                                <Combobox
                                    className="w-[200px]"
                                    placeholder="Filtrar por Cliente"
                                    searchPlaceholder="Buscar..."
                                    options={[{ value: '', label: 'Todos' }, ...dependencyData.map(c => ({
                                        value: String(c.id || c.id_empresa),
                                        label: String(c.nombre || c.nombre_empresa)
                                    }))]}
                                    value={dynamicFilters['id_empresa'] || ''}
                                    onValueChange={(v) => setDynamicFilters(prev => ({ ...prev, id_empresa: v || '' }))}
                                />
                            )}

                            {config.dependsOn === 'componentes' && (
                                <Combobox
                                    className="w-[200px]"
                                    placeholder="Filtrar por Componente"
                                    searchPlaceholder="Buscar..."
                                    options={[{ value: '', label: 'Todos' }, ...dependencyData.map(c => ({
                                        value: String(c.id || c.id_tipomuestra),
                                        label: String(c.nombre || c.nombre_tipomuestra)
                                    }))]}
                                    value={dynamicFilters['id_tipomuestra'] || ''}
                                    onValueChange={(v) => setDynamicFilters(prev => ({ ...prev, id_tipomuestra: v || '' }))}
                                />
                            )}

                            <div className="relative w-[250px]">
                                <IconSearch size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                    className="pl-8"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-lg border border-border">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-20">ID</TableHead>

                                    {/* Granular columns */}
                                    {mainTableColumns.map((col: string) => (
                                        <SortableTableHead key={col} {...sortProps(col)}>{formatHeader(col)}</SortableTableHead>
                                    ))}

                                    {hasStatusColumn && <SortableTableHead className="w-28" {...sortProps('__estado')}>Estado</SortableTableHead>}
                                    <TableHead className="w-24">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={mainTableColumns.length + 3} className="py-8 text-center">
                                            <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            <p className="mt-2 block text-[13px]">Cargando datos...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredData.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={mainTableColumns.length + 3} className="py-8 text-center text-sm text-muted-foreground">
                                            No se encontraron registros
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    paginatedData.map((item) => {
                                        const status = item[config.statusColumn || 'habilitado'] || item.activo || item.estado || 'S';
                                        const isActive = status === 'S' || status === 'V' || status === 1 || status === true;

                                        return (
                                            <TableRow key={item[config.idName]}>
                                                <TableCell>
                                                    <span className="text-xs font-medium text-muted-foreground">{item[config.idName]}</span>
                                                </TableCell>

                                                {/* Granular data cells */}
                                                {mainTableColumns.map((col: string) => {
                                                    const raw = item[col];

                                                    // Only treat as boolean if column NAME suggests it, not just any 0/1 value
                                                    const boolNamePatterns = ['envia_', 'es_', 'oculto', 'visible', 'activo', 'active', 'enabled', 'is_', 'tiene_', 'permite_', 'transaccional'];
                                                    const isBoolCol = typeof raw === 'boolean' || boolNamePatterns.some(p => col.toLowerCase().includes(p));
                                                    const isNullValue = raw === null || raw === undefined || raw === '';
                                                    const isDescCol = /descrip|observ/i.test(col);
                                                    let displayValue: React.ReactNode = isNullValue
                                                        ? <span className="text-xs italic text-muted-foreground">{isDescCol ? 'Sin observaciones' : 'null'}</span>
                                                        : String(raw);

                                                    if (isBoolCol && raw !== null && raw !== undefined) {
                                                        const isTrue = raw === true || raw === 1;
                                                        displayValue = (
                                                            <Badge variant={isTrue ? 'success' : 'secondary'}>
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

                                                    const isNameCol = col === config.displayColumn;
                                                    return (
                                                        <TableCell key={col} style={isNameCol ? { minWidth: 220 } : undefined}>
                                                            <span
                                                                className={cn(
                                                                    'text-[13px]',
                                                                    isNameCol
                                                                        ? 'font-semibold whitespace-normal break-words'
                                                                        : 'block max-w-[250px] truncate font-normal'
                                                                )}
                                                            >
                                                                {displayValue}
                                                            </span>
                                                        </TableCell>
                                                    );
                                                })}

                                                {hasStatusColumn && (
                                                    <TableCell>
                                                        <Badge variant={isActive ? 'success' : 'destructive'}>
                                                            {isActive ? 'Activo' : 'Inactivo'}
                                                        </Badge>
                                                    </TableCell>
                                                )}

                                                <TableCell>
                                                    <div className="flex flex-nowrap gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-primary"
                                                            title="Editar"
                                                            onClick={() => handleOpenModal(item)}
                                                        >
                                                            <IconEdit size={14} />
                                                        </Button>
                                                        {hasStatusColumn && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn('h-8 w-8', isActive ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : 'text-success hover:bg-success/10 hover:text-success')}
                                                                title={isActive ? 'Deshabilitar' : 'Habilitar'}
                                                                onClick={() => handleToggleStatus(item)}
                                                            >
                                                                {isActive ? <IconTrash size={14} /> : <IconCheck size={14} />}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <DataPagination page={page} pageSize={itemsPerPage} total={sortedData.length} onPageChange={setPage} />
                </CardContent>
            </Card>

            {/* ── QUICK-CREATE FK MODAL (list view) ── */}
            {quickFkModal}
        </div>

    );
};
