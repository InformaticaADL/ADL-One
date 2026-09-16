import React, { useState, useEffect } from 'react';
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

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

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
    const [activeTab, setActiveTab] = useState<string>('general');
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                        label: String(u.nombre_usuario || u.usuario || login || '(sin nombre)')
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
                        label: String(c.nombre_comuna || `Comuna #${id}`)
                    });
                }
            });
            // Filtrar registros sin id válido para evitar duplicados con "Comuna #undefined"
            setComunas(Array.from(uniqueComunasMap.values()).filter(c => c.value && c.value !== 'undefined' && c.value !== 'null'));
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

    const renderTextField = (col: string, icon: React.ReactNode) => {
        const isMandatory = MANDATORY_FIELDS.includes(col);
        return (
            <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                <div className="relative">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">{icon}</span>
                    <Input
                        placeholder={col}
                        className={cn('pl-8', errors[col] && 'border-destructive focus-visible:ring-destructive')}
                        value={formData[col] || ''}
                        onChange={(e) => handleFieldChange(col, e.target.value)}
                    />
                </div>
            </FormField>
        );
    };

    if (view === 'form') {
        return (
            <div className="shadcn-scope">
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

                <div className="px-4 py-6">
                    <Card className="p-5">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="mb-6 flex-wrap">
                                <TabsTrigger value="general"><IconBuilding size={16} className="mr-1.5" />Identificación y Ubicación</TabsTrigger>
                                <TabsTrigger value="contacto"><IconMail size={16} className="mr-1.5" />Contacto y Facturación</TabsTrigger>
                                <TabsTrigger value="legal"><IconUser size={16} className="mr-1.5" />Legal y Configuración</TabsTrigger>
                                <TabsTrigger value="avanzado"><IconSettings size={16} className="mr-1.5" />Avanzado</TabsTrigger>
                            </TabsList>

                            <TabsContent value="general">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconBuilding size={18} />} color="#0b7285" title="Identificación de la Empresa" subtitle="Datos legales, RUT y nombres comerciales de la prestadora." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.identificacion.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            if (col === 'resumenejecutivo') {
                                                return (
                                                    <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                                        <Textarea
                                                            placeholder="Resumen de servicios, alcances, etc."
                                                            rows={4}
                                                            className={cn(errors[col] && 'border-destructive focus-visible:ring-destructive')}
                                                            value={formData[col] || ''}
                                                            onChange={(e) => handleFieldChange(col, e.target.value)}
                                                        />
                                                    </FormField>
                                                );
                                            }
                                            return renderTextField(col, <IconBuilding size={16} className="text-muted-foreground" />);
                                        })}
                                    </div>

                                    <hr className="border-t border-border" />

                                    <SectionHeading icon={<IconMapPin size={18} />} color="#1864ab" title="Ubicación y Direcciones" subtitle="Dirección casa matriz y sucursales comerciales." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.ubicacion.map(col => renderTextField(col, <IconMapPin size={16} className="text-muted-foreground" />))}
                                    </div>

                                    <hr className="border-t border-border" />

                                    <div className="flex justify-end">
                                        <Button onClick={() => setActiveTab('contacto')}>
                                            Siguiente: Contacto <IconArrowRight size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="contacto">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconMail size={18} />} color="#1864ab" title="Información de Contacto y Facturación" subtitle="Canales de comunicación directa y facturación electrónica." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.contacto.map(col => renderTextField(
                                            col,
                                            (col.includes('email') || col.includes('mail'))
                                                ? <IconMail size={16} className="text-muted-foreground" />
                                                : <IconUser size={16} className="text-muted-foreground" />
                                        ))}
                                    </div>

                                    <hr className="border-t border-border" />

                                    <div className="flex justify-end">
                                        <Button onClick={() => setActiveTab('legal')}>
                                            Siguiente: Legal <IconArrowRight size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="legal">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconUser size={18} />} color="#e8590c" title="Representante Legal" subtitle="Información del representante ante el sistema." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.legal.map(col => renderTextField(col, <IconUser size={16} className="text-muted-foreground" />))}
                                    </div>

                                    <hr className="border-t border-border" />

                                    <SectionHeading icon={<IconBuilding size={18} />} color="#868e96" title="Configuración del Sistema" subtitle="Datos operativos y de login asociados." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.config.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            if (col === 'usr_login') {
                                                return (
                                                    <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                                        <Combobox
                                                            options={users}
                                                            placeholder={col}
                                                            searchPlaceholder="Buscar usuario..."
                                                            value={formData[col] ? String(formData[col]) : ''}
                                                            onValueChange={(val) => handleFieldChange(col, val)}
                                                        />
                                                    </FormField>
                                                );
                                            }
                                            if (FLAG_FIELDS.includes(col)) {
                                                return (
                                                    <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                                        <Combobox
                                                            options={[
                                                                { value: 'S', label: 'Sí / Activo' },
                                                                { value: 'N', label: 'No / Inactivo' }
                                                            ]}
                                                            placeholder="Seleccione"
                                                            value={formData[col] || (col === 'habilitado' ? 'S' : 'N')}
                                                            onValueChange={(val) => handleFieldChange(col, val)}
                                                        />
                                                    </FormField>
                                                );
                                            }
                                            return (
                                                <FormField key={col} label={formatHeader(col)} error={errors[col]}>
                                                    <div className="relative">
                                                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
                                                            <IconSettings size={16} className="text-muted-foreground" />
                                                        </span>
                                                        <Input
                                                            placeholder={col}
                                                            className="pl-8"
                                                            value={formData[col] || ''}
                                                            onChange={(e) => handleFieldChange(col, e.target.value)}
                                                        />
                                                    </div>
                                                </FormField>
                                            );
                                        })}
                                    </div>

                                    <hr className="border-t border-border" />

                                    <div className="flex justify-end">
                                        <Button onClick={() => setActiveTab('avanzado')}>
                                            Siguiente: Avanzado <IconArrowRight size={16} />
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="avanzado">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconSettings size={18} />} color="#e03131" title="Configuración Avanzada e IDs" subtitle="Identificadores técnicos y parámetros de integración con otros módulos." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.avanzado.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            if (col === 'id_comuna' || col === 'id_comunaef') {
                                                return (
                                                    <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                                        <Combobox
                                                            options={comunas}
                                                            placeholder="Seleccione Comuna"
                                                            searchPlaceholder="Buscar comuna..."
                                                            value={formData[col] ? String(formData[col]) : ''}
                                                            onValueChange={(val) => handleFieldChange(col, val ? Number(val) : null)}
                                                        />
                                                    </FormField>
                                                );
                                            }
                                            if (col === 'lote_facturacion') {
                                                return (
                                                    <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                                        <Input
                                                            placeholder="Lote"
                                                            className={cn(errors[col] && 'border-destructive focus-visible:ring-destructive')}
                                                            value={formData[col] || ''}
                                                            onChange={(e) => handleFieldChange(col, e.target.value)}
                                                        />
                                                    </FormField>
                                                );
                                            }
                                            return (
                                                <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                                    <Input
                                                        type="number"
                                                        placeholder="Sin asignar"
                                                        className={cn(errors[col] && 'border-destructive focus-visible:ring-destructive')}
                                                        value={formData[col] === undefined || formData[col] === null ? '' : formData[col]}
                                                        onChange={(e) => handleFieldChange(col, e.target.value === '' ? null : Number(e.target.value))}
                                                    />
                                                </FormField>
                                            );
                                        })}
                                    </div>

                                    <hr className="border-t border-border" />

                                    <div className="flex justify-end gap-3">
                                        <Button variant="outline" onClick={() => setView('list')}>
                                            Cancelar
                                        </Button>
                                        <Button
                                            className="bg-[#0b7285] text-white hover:bg-[#0b7285]/90"
                                            onClick={handleSubmit}
                                            disabled={loading || !isFormComplete()}
                                        >
                                            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <IconCheck size={20} />}
                                            {editingId ? 'Guardar Cambios' : 'Crear Empresa'}
                                        </Button>
                                    </div>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="shadcn-scope">
            <PageHeader
                title="Gestión de Empresas de Servicio"
                subtitle="Administre el catálogo de proveedores de servicios de muestreo y terreno."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: 'Empresas de Servicio' }
                ]}
                rightSection={
                    <Button className="bg-[#0b7285] text-white hover:bg-[#0b7285]/90" onClick={handleCreate}>
                        <IconPlus size={18} /> Nueva Empresa
                    </Button>
                }
            />

            <div className="px-4 py-6">
                <Card className="p-5">
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                            <div className="flex flex-1 flex-wrap items-end gap-4">
                                <FormField label="Búsqueda Rápida">
                                    <div className="relative w-[300px]">
                                        <IconSearch size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            placeholder="Nombre, RUT, Email..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </FormField>

                                <FormField label="Filtrar por Estado">
                                    <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                                        {[
                                            { label: 'Todos', value: 'ALL' },
                                            { label: 'Activos', value: 'S' },
                                            { label: 'Inactivos', value: 'N' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setStatusFilter(opt.value)}
                                                className={cn(
                                                    'rounded-[5px] px-3 py-1 text-sm font-medium transition-colors',
                                                    statusFilter === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                                )}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </FormField>

                                <FormField label="Responsable">
                                    <div className="w-[250px]">
                                        <Combobox
                                            options={users}
                                            placeholder="Todos los responsables"
                                            searchPlaceholder="Buscar responsable..."
                                            value={userFilter ?? ''}
                                            onValueChange={(v) => setUserFilter(v || null)}
                                        />
                                    </div>
                                </FormField>
                            </div>

                            <Badge className="px-2.5 py-1 text-[13px]">Total: {filteredData.length}</Badge>
                        </div>

                        <hr className="border-t border-border" />

                        <div className="relative overflow-hidden rounded-lg">
                            {loading && (
                                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                </div>
                            )}
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Nombre</TableHead>
                                        <TableHead>Contacto</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead className="text-center">Estado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.length === 0 ? (
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                No se encontraron empresas
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredData.map((item) => (
                                            <TableRow key={item.id_empresaservicio}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 whitespace-nowrap">
                                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#098f83]/10 text-[#098f83]">
                                                            <IconBuilding size={14} />
                                                        </div>
                                                        <span className="text-[13px] font-semibold">{item.nombre_empresaservicios}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap text-[13px]">{item.contacto_empresaservicios || '-'}</TableCell>
                                                <TableCell className="whitespace-nowrap text-[13px] text-muted-foreground">{item.email_empresaservicios || item.email_contacto || '-'}</TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant={item.habilitado === 'S' ? 'success' : 'destructive'}>
                                                        {item.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" title="Editar" onClick={() => handleEdit(item)}>
                                                        <IconEdit size={16} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <span className={cn('mb-1 block text-xs', required ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                {label}{required ? ' *' : ''}
            </span>
            {children}
            {error && <span className="mt-0.5 block text-[11px] text-destructive">{error}</span>}
        </div>
    );
}

function SectionHeading({ icon, color, title, subtitle }: { icon: React.ReactNode; color: string; title: string; subtitle: string }) {
    return (
        <div>
            <div className="mb-1 flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}1f`, color }}>
                    {icon}
                </div>
                <h4 className="m-0 text-base font-semibold">{title}</h4>
            </div>
            <p className="text-[13px] text-muted-foreground">{subtitle}</p>
        </div>
    );
}
