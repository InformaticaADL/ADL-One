import { EstadoPill } from '@/components/ui/estado-pill';
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
import { Ellipsis } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { AdvancedDataTable, DataTableColumnHeader } from '@/components/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useConfirmacion } from '@/components/ui/confirm-dialog';

interface EmpresaServicioFormViewProps {
    onBack: () => void;
}

export const EmpresaServicioFormView: React.FC<EmpresaServicioFormViewProps> = ({ onBack }) => {
    const { showToast } = useToast();
    const { confirmar, dialogo: dialogoConfirmacion } = useConfirmacion();
    const [formInicial, setFormInicial] = useState<any>(null);
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
        setFormInicial({ habilitado: 'S' });
        setErrors({});
        setView('form');
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id_empresaservicio);
        setFormData({ ...item });
        setFormInicial({ ...item });
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const renderTextField = (col: string, _icon?: React.ReactNode) => {
        const isMandatory = MANDATORY_FIELDS.includes(col);
        return (
            <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                <Input
                    className={cn(errors[col] && 'border-destructive focus-visible:ring-destructive')}
                    value={formData[col] || ''}
                    onChange={(e) => handleFieldChange(col, e.target.value)}
                />
            </FormField>
        );
    };

    const sucio = JSON.stringify(formData) !== JSON.stringify(formInicial ?? {});
    const salirDelFormulario = async () => {
        if (sucio && !(await confirmar({ titulo: 'Cambios sin guardar', mensaje: 'Si sales ahora se pierden los cambios que hiciste.', textoConfirmar: 'Salir sin guardar', textoCancelar: 'Seguir editando', peligro: true }))) return;
        setView('list');
    };

    if (view === 'form') {
        return (
            <div className="shadcn-scope w-full p-4 md:p-6">
                {dialogoConfirmacion}
                <PageHeader
                    title={editingId ? "Editar empresa de servicio" : "Nueva empresa de servicio"}
                    subtitle="Complete los datos de la empresa para habilitar sus servicios en el sistema."
                    breadcrumbItems={[
                        { label: 'Maestros Hub', onClick: onBack },
                        { label: 'Empresas de Servicio', onClick: salirDelFormulario },
                        { label: editingId ? 'Editar' : 'Nueva' }
                    ]}
                />

                <div className="mt-6">
                    <Card className="p-5">
                        <Tabs value={activeTab} onValueChange={setActiveTab}>
                            <TabsList className="mb-6 h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-border bg-transparent p-0">
                                <TabsTrigger value="general" className="-mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none">Identificación y Ubicación</TabsTrigger>
                                <TabsTrigger value="contacto" className="-mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none">Contacto y Facturación</TabsTrigger>
                                <TabsTrigger value="legal" className="-mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none">Legal y Configuración</TabsTrigger>
                                <TabsTrigger value="avanzado" className="-mb-px rounded-none border-b-2 border-transparent px-4 py-2.5 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-foreground data-[state=active]:shadow-none">Avanzado</TabsTrigger>
                            </TabsList>

                            <TabsContent value="general">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconBuilding size={18} />} color="var(--sc-primary)" title="Identificación de la Empresa" subtitle="Datos legales, RUT y nombres comerciales de la prestadora." />

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


                                    <SectionHeading icon={<IconMapPin size={18} />} color="var(--sc-primary)" title="Ubicación y Direcciones" subtitle="Dirección casa matriz y sucursales comerciales." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.ubicacion.map(col => renderTextField(col, <IconMapPin size={16} className="text-muted-foreground" />))}
                                    </div>


                                </div>
                            </TabsContent>

                            <TabsContent value="contacto">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconMail size={18} />} color="var(--sc-primary)" title="Información de Contacto y Facturación" subtitle="Canales de comunicación directa y facturación electrónica." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.contacto.map(col => renderTextField(
                                            col,
                                            (col.includes('email') || col.includes('mail'))
                                                ? <IconMail size={16} className="text-muted-foreground" />
                                                : <IconUser size={16} className="text-muted-foreground" />
                                        ))}
                                    </div>


                                </div>
                            </TabsContent>

                            <TabsContent value="legal">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconUser size={18} />} color="var(--sc-warning)" title="Representante Legal" subtitle="Información del representante ante el sistema." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.legal.map(col => renderTextField(col, <IconUser size={16} className="text-muted-foreground" />))}
                                    </div>


                                    <SectionHeading icon={<IconBuilding size={18} />} color="var(--sc-muted-foreground)" title="Configuración del Sistema" subtitle="Datos operativos y de login asociados." />

                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                                        {sections.config.map(col => {
                                            const isMandatory = MANDATORY_FIELDS.includes(col);
                                            if (col === 'usr_login') {
                                                return (
                                                    <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                                        <Combobox
                                                            options={users}
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
                                                                { value: 'S', label: 'Sí' },
                                                                { value: 'N', label: 'No' }
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
                                                                                                                <Input
                                                                                                                        value={formData[col] || ''}
                                                            onChange={(e) => handleFieldChange(col, e.target.value)}
                                                        />
                                                    </div>
                                                </FormField>
                                            );
                                        })}
                                    </div>


                                </div>
                            </TabsContent>

                            <TabsContent value="avanzado">
                                <div className="flex flex-col gap-6">
                                    <SectionHeading icon={<IconSettings size={18} />} color="var(--sc-destructive)" title="Configuración Avanzada e IDs" subtitle="Identificadores técnicos y parámetros de integración con otros módulos." />

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


                                </div>
                            </TabsContent>
                        </Tabs>
                    </Card>
                </div>

                <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                    <div className="mx-auto flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <span className={cn('size-1.5 rounded-full', sucio ? 'bg-[var(--sc-mark)]' : 'bg-muted-foreground/40')} />
                            {sucio ? 'Cambios sin guardar' : 'Sin cambios'}
                        </span>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={salirDelFormulario} disabled={loading}>
                                {editingId ? 'Descartar' : 'Cancelar'}
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading || !isFormComplete() || (!!editingId && !sucio)}>
                                {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear empresa'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const nombreResponsable = (login?: string) => (login ? (users.find((u) => u.value === login)?.label ?? login) : '');
    const estaActiva = (item: any) => item.habilitado === 'S';

    const columnas: ColumnDef<any>[] = [
        {
            id: 'nombre',
            meta: { titulo: 'Nombre' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            accessorFn: (item) => item.nombre_empresaservicios || '',
            sortingFn: (x, y) => String(x.getValue('nombre')).localeCompare(String(y.getValue('nombre')), 'es', { sensitivity: 'base' }),
            cell: ({ row }) => <span className="ps-2 text-sm font-medium">{row.original.nombre_empresaservicios}</span>,
        },
        {
            id: 'contacto',
            meta: { titulo: 'Contacto' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto" />,
            accessorFn: (item) => item.contacto_empresaservicios || '',
            cell: ({ row }) => <span className="ps-2 text-sm">{row.original.contacto_empresaservicios || '—'}</span>,
        },
        {
            id: 'email',
            meta: { titulo: 'Email', className: 'hidden md:table-cell' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
            accessorFn: (item) => item.email_empresaservicios || item.email_contacto || '',
            cell: ({ row }) => <span className="ps-2 text-sm text-muted-foreground">{row.original.email_empresaservicios || row.original.email_contacto || '—'}</span>,
        },
        {
            id: 'responsable',
            meta: { titulo: 'Responsable', className: 'hidden lg:table-cell' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Responsable" />,
            accessorFn: (item) => nombreResponsable(item.usr_login),
            filterFn: (row, id, valor: string[]) => valor.includes(row.getValue(id)),
            cell: ({ row }) => <span className="ps-2 text-sm">{nombreResponsable(row.original.usr_login) || '—'}</span>,
        },
        {
            id: 'estado',
            meta: { titulo: 'Estado' },
            enableHiding: false,
            enableSorting: false,
            header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
            accessorFn: (item) => (estaActiva(item) ? 'Activo' : 'Inactivo'),
            filterFn: (row, id, valor: string[]) => valor.includes(row.getValue(id)),
            cell: ({ row }) => {
                const activo = estaActiva(row.original);
                return <EstadoPill tono={activo ? 'ok' : 'off'}>{activo ? 'Activo' : 'Inactivo'}</EstadoPill>;
            },
        },
        {
            id: 'acciones',
            enableHiding: false,
            enableSorting: false,
            header: () => null,
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                            <Ellipsis className="h-4 w-4" />
                            <span className="sr-only">Abrir menú de la fila</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem onSelect={() => handleEdit(row.original)}>
                            Editar <span className="ms-auto"><IconEdit size={16} /></span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const responsablesUsados = [...new Set(data.map((d) => nombreResponsable(d.usr_login)).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es', { sensitivity: 'base' }));

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            {dialogoConfirmacion}
            <PageHeader
                title="Empresas de Servicio"
                subtitle="Administre el catálogo de proveedores de servicios de muestreo y terreno."
                breadcrumbItems={[
                    { label: 'Maestros Hub', onClick: onBack },
                    { label: 'Empresas de Servicio' }
                ]}
                rightSection={
                    <Button className="space-x-1" onClick={handleCreate}>
                        <span>Nueva empresa</span> <IconPlus size={18} />
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <AdvancedDataTable
                    columns={columnas}
                    data={data}
                    getRowId={(item) => String(item.id_empresaservicio)}
                    cargando={loading}
                    pageSize={10}
                    mensajeVacio="No se encontraron empresas"
                    busqueda={{
                        placeholder: 'Buscar por nombre, RUT, contacto o email...',
                        texto: (item) => [item.nombre_empresaservicios, item.rut_empresaservicios, item.contacto_empresaservicios, item.email_empresaservicios, item.email_contacto, item.nombre_fantasia, item.sigla, nombreResponsable(item.usr_login)].filter(Boolean).join(' '),
                    }}
                    filtros={[
                        { columna: 'estado', titulo: 'Estado', opciones: [{ label: 'Activo', value: 'Activo' }, { label: 'Inactivo', value: 'Inactivo' }] },
                        { columna: 'responsable', titulo: 'Responsable', opciones: responsablesUsados.map((n) => ({ label: n, value: n })) },
                    ]}
                />
            </div>
        </div>
    );
};

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {label}{required && <span className="text-destructive"> *</span>}
            </span>
            {children}
            {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
        </div>
    );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function SectionHeading({ title, subtitle }: { icon?: React.ReactNode; color?: string; title: string; subtitle: string }) {
    return (
        <div>
            <h4 className="m-0 text-sm font-semibold">{title}</h4>
            <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
    );
}
