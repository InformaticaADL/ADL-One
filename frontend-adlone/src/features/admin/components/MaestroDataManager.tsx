import { EstadoPill } from '@/components/ui/estado-pill';
import { useConfirmacion } from '@/components/ui/confirm-dialog';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Ellipsis } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { AdvancedDataTable, DataTableColumnHeader } from '@/components/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
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
    description?: string;
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
            autofill?: boolean;
        }
    };
    /** Campos con opciones fijas (lista desplegable en vez de texto libre). */
    fixedOptions?: { [fieldName: string]: { value: string; label: string }[] };
}

interface Props {
    config: MaestroConfig;
    onBack: () => void;
    /** Pestaña adicional del formulario; solo aparece al editar un registro existente. */
    extraTab?: {
        label: string;
        icon: React.ReactNode;
        render: (item: any) => React.ReactNode;
    };
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
    <Alert variant={variant === 'error' ? 'destructive' : 'warning'}>
        {icon}
        <AlertDescription className="text-current">{children}</AlertDescription>
    </Alert>
);

export const MaestroDataManager: React.FC<Props> = ({ config, onBack, extraTab }) => {
    const { showToast } = useToast();
    const { confirmar, dialogo: dialogoConfirmacion } = useConfirmacion();
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<any>({});
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [saving, setSaving] = useState(false);
    const [formInicial, setFormInicial] = useState<any>(null);
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
    const [itemsPerPage, setItemsPerPage] = useState(10);

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


    const handleOpenModal = (item: any = null) => {
        setEditingItem(item);
        setActiveFormTab('general');
        if (item) {
            // Convert all values to strings so Select components find their values
            const normalized: any = {};
            Object.entries(item).forEach(([k, v]) => {
                normalized[k] = v === null || v === undefined ? '' : String(v).trim();
            });
            setFormData(normalized);
            setFormInicial(normalized);
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
            setFormInicial(defaults);
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
            const ok = await confirmar({
                titulo: `Deshabilitar "${displayName}"`,
                mensaje: 'Si este registro está en uso por fichas activas, podría afectar su visualización. Las fichas existentes mantendrán el valor, pero ya no podrá seleccionarse para fichas nuevas.',
                textoConfirmar: 'Deshabilitar',
                peligro: true,
            });
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
    // Nombre legible de un campo de relación: sin el prefijo id_ y con las palabras pegadas separadas.
    const etiquetaCampo = (col: string) => {
        const conocidas: Record<string, string> = { empresaservicio: 'Empresa de servicio', empresaservicios: 'Empresa de servicio', tipomuestra: 'Tipo de muestra', tipoequipo: 'Tipo de equipo', equipocatalogo: 'Equipo del catálogo' };
        const base = col.replace(/^id_/i, '').toLowerCase();
        return conocidas[base] ?? formatHeader(base);
    };

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
        const fijas = config.fixedOptions?.[col];

        if (fijas) {
            return (
                <div key={col}>
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{formatHeader(col)}</Label>
                    <Combobox
                        className="border-l-[3px] border-l-sky-400"
                        placeholder={`Seleccione ${formatHeader(col)}...`}
                        options={fijas}
                        value={formData[col] ? String(formData[col]) : fijas[0].value}
                        onValueChange={(v) => setFormData({ ...formData, [col]: v })}
                    />
                </div>
            );
        }

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
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{etiquetaCampo(col)}</Label>
                        <Combobox
                            placeholder={`Seleccione ${etiquetaCampo(col).toLowerCase()}...`}
                            searchPlaceholder="Buscar..."
                            footerAction={lookup.noCreate ? undefined : { label: `Crear ${etiquetaCampo(col).toLowerCase()} nuevo...`, onClick: () => openQuickFk(col, lookup) }}
                            emptyText="Sin opciones disponibles"
                            options={comboOptions}
                            value={formData[col] === null || formData[col] === undefined ? '' : String(formData[col])}
                            onValueChange={(v) => {
                                const updatedForm = { ...formData, [col]: v };
                                // Solo los maestros que lo piden (equipos) copian columnas del registro elegido; en el resto
                                // (ej. contactos) elegir una empresa no debe tocar el email, el teléfono ni el estado.
                                if (v && lookup.autofill) {
                                    const selectedOpt = options.find(opt => String(opt[lookup.idColumn]) === String(v));
                                    if (selectedOpt) {
                                        // Autofill other matching or similar fields in the form
                                        Object.keys(formData).forEach(formKey => {
                                            if (formKey === col || formKey.toLowerCase() === 'habilitado') return; // ni la columna elegida ni el estado

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
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{formatHeader(col)}</Label>
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
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{formatHeader(col)}</Label>
                    <Combobox
                        options={[
                            { value: 'true', label: 'Sí' },
                            { value: 'false', label: 'No' },
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
                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{formatHeader(col)}</Label>
                    <div className="relative">
                        {icon && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
                        <Input
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
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{formatHeader(col)}{col === config.displayColumn && <span className="text-destructive"> *</span>}</Label>
                <div className="relative">
                    {icon && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
                    <Input
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
                        <span className="text-[13px] font-semibold">
                            Crear nuevo registro
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
                                                    <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{formatHeader(col)}</Label>
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
                                                        options={[{ value: '1', label: 'Sí' }, { value: '0', label: 'No' }]}
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

    const sucio = JSON.stringify(formData) !== JSON.stringify(formInicial ?? {});
    const salirDelFormulario = async () => {
        if (sucio && !(await confirmar({ titulo: 'Cambios sin guardar', mensaje: 'Si sales ahora se pierden los cambios que hiciste.', textoConfirmar: 'Salir sin guardar', textoCancelar: 'Seguir editando', peligro: true }))) return;
        setView('list');
    };
    const estadoDe = (item: any) => {
        const st = item[config.statusColumn || 'habilitado'] || item.activo || item.estado || 'S';
        return st === 'S' || st === 'V' || st === 1 || st === true;
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

        const bloqueEstado = (
            <>
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
                            <Combobox
                                className="max-w-[300px]"
                                options={[
                                    { value: 'on', label: 'Activo' },
                                    { value: 'off', label: 'Deshabilitado' }
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
            </>
        );
        const bloqueDependencia = (
            <>
                {config.dependsOn === 'clientes' && (
                    <div>
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cliente asociado</Label>
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
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Componente asociado</Label>
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
            </>
        );
        const hayDependencia = config.dependsOn === 'clientes' || config.dependsOn === 'componentes';

        const generalPanel = (
            <div className="flex flex-col gap-6">
                {config.statusColumn && (
                    <div>
                        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Estado del registro</Label>
                        {bloqueEstado}
                    </div>
                )}
                {hayDependencia && <div>{bloqueDependencia}</div>}
                {(config.statusColumn || hayDependencia) && <div className="border-t border-border" />}
                <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                    {generalFields.map((col: string) => renderField(col))}
                </div>
            </div>
        );

        const advancedPanel = (
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {advancedFields.map((col: string) => renderField(col))}
            </div>
        );

        return (
            <div className="shadcn-scope">
                {dialogoConfirmacion}
                <div className="p-4 md:p-6">
                    <PageHeader
                        title={editingItem && config.displayColumn ? (editingItem[config.displayColumn] || config.label) : config.label}
                        subtitle={(editingItem ? 'Editando registro' : 'Nuevo registro') + ' · ' + config.label}
                        breadcrumbItems={[
                            { label: 'Maestros Hub', onClick: onBack },
                            { label: config.label, onClick: salirDelFormulario },
                            { label: editingItem ? 'Editar' : 'Nuevo' },
                        ]}
                    />

                    <Card className="mt-6">
                        <CardContent className="p-5">
                            <Tabs value={activeFormTab} onValueChange={setActiveFormTab}>
                                <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
                                    {[
                                        { v: 'general', t: 'Información general', show: true },
                                        { v: 'advanced', t: 'Datos detallados', show: advancedFields.length > 0 },
                                        { v: 'extra', t: extraTab ? extraTab.label : '', show: !!(extraTab && editingItem) },
                                    ].filter((p) => p.show).map((p) => (
                                        <TabsTrigger key={p.v} value={p.v}
                                            className="-mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none">
                                            {p.t}
                                        </TabsTrigger>
                                    ))}
                                </TabsList>
                                <TabsContent value="general" className="mt-5">{generalPanel}</TabsContent>
                                {advancedFields.length > 0 && (
                                    <TabsContent value="advanced" className="mt-5">{advancedPanel}</TabsContent>
                                )}
                                {extraTab && editingItem && (
                                    <TabsContent value="extra" className="mt-5">{extraTab.render(editingItem)}</TabsContent>
                                )}
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>

                <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:px-6">
                    <div className="mx-auto flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <span className={cn('size-1.5 rounded-full', sucio ? 'bg-[var(--sc-mark)]' : 'bg-muted-foreground/40')} />
                            {sucio ? 'Cambios sin guardar' : 'Sin cambios'}
                        </span>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={salirDelFormulario} disabled={saving}>
                                {editingItem ? 'Descartar' : 'Cancelar'}
                            </Button>
                            <Button type="button" onClick={handleSave} disabled={saving || (!!editingItem && !sucio)}>
                                {saving ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Crear registro'}
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Quick Create Modal */}
                <Dialog open={quickCreateType !== null} onOpenChange={(open) => { if (!open && !quickSaving) setQuickCreateType(null); }}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
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

                {/* ── QUICK-CREATE FK MODAL ── */}
                {quickFkModal}

            </div>
        );
    }



    // ---- Listado (misma tabla, filtros y paginación que la página de Usuarios) ----

    const boolNombres = ['envia_', 'es_', 'oculto', 'visible', 'activo', 'active', 'enabled', 'is_', 'tiene_', 'permite_', 'transaccional'];
    const esColumnaBool = (col: string, raw: any) => typeof raw === 'boolean' || boolNombres.some((p) => col.toLowerCase().includes(p));

    // Texto visible de una celda: resuelve el nombre de las relaciones (empresa, cargo...) en lugar del id.
    const textoCelda = (item: any, col: string): string => {
        const raw = item[col];
        if (raw === null || raw === undefined || raw === '') return '';
        if (esColumnaBool(col, raw)) return raw === true || raw === 1 ? 'Sí' : 'No';
        if (config.lookups && config.lookups[col]) {
            const lk = config.lookups[col];
            const found = (lookupData[col] || []).find((o) => String(o[lk.idColumn]) === String(raw));
            if (found) return String(found[lk.displayColumn]);
        } else if (col === 'id_empresa' && config.dependsOn === 'clientes') {
            const found = dependencyData.find((c) => String(c.id || c.id_empresa) === String(raw));
            if (found) return String(found.nombre || found.nombre_empresa);
        } else if (col === 'id_tipomuestra' && config.dependsOn === 'componentes') {
            const found = dependencyData.find((c) => String(c.id || c.id_tipomuestra) === String(raw));
            if (found) return String(found.nombre || found.nombre_tipomuestra);
        }
        return String(raw).trim();
    };

    const camposBusqueda = [config.displayColumn, ...mainTableColumns].filter((c, i, l): c is string => !!c && l.indexOf(c) === i && c !== config.idName);
    const textoBusqueda = camposBusqueda.length
        ? 'Buscar por ' + camposBusqueda.slice(0, 3).map((c) => etiquetaCampo(c).toLowerCase()).join(', ') + (camposBusqueda.length > 3 ? '…' : '')
        : 'Buscar...';

    const opcionesDe = (col: string) => {
        const nombres = new Set<string>();
        data.forEach((item) => { const t = textoCelda(item, col); if (t) nombres.add(t); });
        return [...nombres].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })).map((t) => ({ label: t, value: t }));
    };

    const columnasMaestro: ColumnDef<any>[] = [
        ...mainTableColumns.map((col: string): ColumnDef<any> => {
            const esNombre = col === config.displayColumn;
            const filtrable = !!(config.lookups && config.lookups[col]) || (col === 'id_empresa' && config.dependsOn === 'clientes') || (col === 'id_tipomuestra' && config.dependsOn === 'componentes');
            return {
                id: col,
                meta: { titulo: etiquetaCampo(col) },
                header: ({ column }) => <DataTableColumnHeader column={column} title={etiquetaCampo(col)} />,
                accessorFn: (item) => textoCelda(item, col),
                sortingFn: (a, b) => (a.getValue(col) as string).localeCompare(b.getValue(col) as string, 'es', { numeric: true, sensitivity: 'base' }),
                ...(filtrable ? { filterFn: (row: any, id: string, valor: string[]) => valor.includes(row.getValue(id)) } : {}),
                cell: ({ row }) => {
                    const raw = row.original[col];
                    const texto = textoCelda(row.original, col);
                    if (!texto) return <span className="ps-2 text-muted-foreground">{/descrip|observ/i.test(col) ? 'Sin observaciones' : '—'}</span>;
                    if (esColumnaBool(col, raw)) {
                        const si = texto === 'Sí';
                        return (
                            <span className={cn('ps-2 inline-flex items-center gap-2 text-sm', !si && 'text-muted-foreground')}>
                                <span className={cn('size-1.5 rounded-full', si ? 'bg-foreground' : 'bg-muted-foreground/50')} />
                                {texto}
                            </span>
                        );
                    }
                    return <span className={cn('ps-2 block text-sm', esNombre ? 'font-medium' : 'max-w-[260px] truncate')} title={texto}>{texto}</span>;
                },
            };
        }),
        ...(hasStatusColumn ? [{
            id: 'estado',
            meta: { titulo: 'Estado' },
            enableHiding: false,
            enableSorting: false,
            header: ({ column }: any) => <DataTableColumnHeader column={column} title="Estado" />,
            accessorFn: (item: any) => (estadoDe(item) ? 'Activo' : 'Inactivo'),
            filterFn: (row: any, id: string, valor: string[]) => valor.includes(row.getValue(id)),
            cell: ({ row }: any) => {
                const activo = estadoDe(row.original);
                return <EstadoPill tono={activo ? 'ok' : 'off'}>{activo ? 'Activo' : 'Inactivo'}</EstadoPill>;
            },
        } as ColumnDef<any>] : []),
        {
            id: 'acciones',
            enableHiding: false,
            enableSorting: false,
            header: () => null,
            cell: ({ row }) => {
                const activo = estadoDe(row.original);
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                                <Ellipsis className="h-4 w-4" />
                                <span className="sr-only">Abrir menú de la fila</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem onSelect={() => handleOpenModal(row.original)}>
                                Editar <span className="ms-auto"><IconEdit size={16} /></span>
                            </DropdownMenuItem>
                            {hasStatusColumn && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onSelect={() => handleToggleStatus(row.original)} className={activo ? 'text-red-500' : undefined}>
                                        {activo ? 'Deshabilitar' : 'Habilitar'} <span className="ms-auto">{activo ? <IconTrash size={16} /> : <IconCheck size={16} />}</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    const filtrosMaestro = [
        ...(hasStatusColumn ? [{ columna: 'estado', titulo: 'Estado', opciones: [{ label: 'Activo', value: 'Activo' }, { label: 'Inactivo', value: 'Inactivo' }] }] : []),
        ...mainTableColumns
            .filter((col: string) => (config.lookups && config.lookups[col]) || (col === 'id_empresa' && config.dependsOn === 'clientes') || (col === 'id_tipomuestra' && config.dependsOn === 'componentes'))
            .map((col: string) => ({ columna: col, titulo: etiquetaCampo(col), opciones: opcionesDe(col) })),
    ];

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            {dialogoConfirmacion}
            <PageHeader
                title={config.label}
                subtitle={config.description}
                breadcrumbItems={[{ label: 'Maestros Hub', onClick: onBack }, { label: config.label }]}
                rightSection={
                    <Button type="button" className="space-x-1" onClick={() => handleOpenModal()} disabled={needsDependency}>
                        <span>Añadir {config.label}</span> <IconPlus size={18} />
                    </Button>
                }
            />

            {fetchError && (
                <div className="mt-4">
                    <AlertBox variant="error" icon={<IconAlertCircle size={16} className="mt-0.5 shrink-0" />}>
                        {fetchError}
                    </AlertBox>
                </div>
            )}

            {needsDependency && (
                <div className="mt-4">
                    <AlertBox variant="warning" icon={<IconAlertTriangle size={16} className="mt-0.5 shrink-0" />}>
                        <span className="font-semibold">Atención: </span>
                        Necesita crear primero registros en el maestro <strong>{config.dependsOn}</strong> antes de poder añadir nuevos {config.label}.
                    </AlertBox>
                </div>
            )}

            <div className="mt-6 flex flex-col gap-4">
                <AdvancedDataTable
                    key={config.id + ':' + mainTableColumns.length + ':' + (hasStatusColumn ? 's' : 'n')}
                    columns={columnasMaestro}
                    data={data}
                    getRowId={(item) => String(item[config.idName])}
                    cargando={loading}
                    pageSize={10}
                    mensajeVacio="No se encontraron registros"
                    busqueda={{
                        placeholder: textoBusqueda,
                        texto: (item) => {
                            const propios = Object.entries(item)
                                .filter(([k]) => k !== config.idName && !k.toLowerCase().startsWith('id_'))
                                .map(([, v]) => String(v ?? ''));
                            const nombres = mainTableColumns.map((c: string) => textoCelda(item, c));
                            return [...propios, ...nombres].join(' ');
                        },
                    }}
                    filtros={filtrosMaestro}
                />
            </div>

            {quickFkModal}
        </div>
    );
};
