import React, { useState, useEffect } from 'react';
import {
    Typography,
    Button,
    Card,
    Tabs,
    Input,
    InputNumber,
    Select,
    Spin,
    Table,
    Tag,
    Tooltip,
    Segmented
} from 'antd';
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

const { Title, Text } = Typography;
const { TextArea } = Input;

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
                <Input
                    placeholder={col}
                    prefix={icon}
                    value={formData[col] || ''}
                    status={errors[col] ? 'error' : undefined}
                    onChange={(e) => handleFieldChange(col, e.target.value)}
                />
            </FormField>
        );
    };

    if (view === 'form') {
        const tabItems = [
            {
                key: 'general',
                label: <span><IconBuilding size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Identificación y Ubicación</span>,
                children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <SectionHeading icon={<IconBuilding size={18} />} color="#0b7285" title="Identificación de la Empresa" subtitle="Datos legales, RUT y nombres comerciales de la prestadora." />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                            {sections.identificacion.map(col => {
                                const isMandatory = MANDATORY_FIELDS.includes(col);
                                if (col === 'resumenejecutivo') {
                                    return (
                                        <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                            <TextArea
                                                placeholder="Resumen de servicios, alcances, etc."
                                                autoSize={{ minRows: 4 }}
                                                value={formData[col] || ''}
                                                status={errors[col] ? 'error' : undefined}
                                                onChange={(e) => handleFieldChange(col, e.target.value)}
                                            />
                                        </FormField>
                                    );
                                }
                                return renderTextField(col, <IconBuilding size={16} style={{ color: 'var(--app-text-secondary)' }} />);
                            })}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />

                        <SectionHeading icon={<IconMapPin size={18} />} color="#1864ab" title="Ubicación y Direcciones" subtitle="Dirección casa matriz y sucursales comerciales." />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                            {sections.ubicacion.map(col => renderTextField(col, <IconMapPin size={16} style={{ color: 'var(--app-text-secondary)' }} />))}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button icon={<IconArrowRight size={16} />} iconPosition="end" onClick={() => setActiveTab('contacto')}>
                                Siguiente: Contacto
                            </Button>
                        </div>
                    </div>
                ),
            },
            {
                key: 'contacto',
                label: <span><IconMail size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Contacto y Facturación</span>,
                children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <SectionHeading icon={<IconMail size={18} />} color="#1864ab" title="Información de Contacto y Facturación" subtitle="Canales de comunicación directa y facturación electrónica." />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                            {sections.contacto.map(col => renderTextField(
                                col,
                                (col.includes('email') || col.includes('mail'))
                                    ? <IconMail size={16} style={{ color: 'var(--app-text-secondary)' }} />
                                    : <IconUser size={16} style={{ color: 'var(--app-text-secondary)' }} />
                            ))}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button icon={<IconArrowRight size={16} />} iconPosition="end" onClick={() => setActiveTab('legal')}>
                                Siguiente: Legal
                            </Button>
                        </div>
                    </div>
                ),
            },
            {
                key: 'legal',
                label: <span><IconUser size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Legal y Configuración</span>,
                children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <SectionHeading icon={<IconUser size={18} />} color="#e8590c" title="Representante Legal" subtitle="Información del representante ante el sistema." />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                            {sections.legal.map(col => renderTextField(col, <IconUser size={16} style={{ color: 'var(--app-text-secondary)' }} />))}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />

                        <SectionHeading icon={<IconBuilding size={18} />} color="#868e96" title="Configuración del Sistema" subtitle="Datos operativos y de login asociados." />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                            {sections.config.map(col => {
                                const isMandatory = MANDATORY_FIELDS.includes(col);
                                if (col === 'usr_login') {
                                    return (
                                        <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                            <Select
                                                options={users}
                                                showSearch
                                                allowClear
                                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                                placeholder={col}
                                                value={formData[col] ? String(formData[col]) : undefined}
                                                status={errors[col] ? 'error' : undefined}
                                                onChange={(val) => handleFieldChange(col, val)}
                                                style={{ width: '100%' }}
                                            />
                                        </FormField>
                                    );
                                }
                                if (FLAG_FIELDS.includes(col)) {
                                    return (
                                        <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                            <Select
                                                options={[
                                                    { value: 'S', label: 'Sí / Activo' },
                                                    { value: 'N', label: 'No / Inactivo' }
                                                ]}
                                                placeholder="Seleccione"
                                                value={formData[col] || (col === 'habilitado' ? 'S' : 'N')}
                                                status={errors[col] ? 'error' : undefined}
                                                onChange={(val) => handleFieldChange(col, val)}
                                                style={{ width: '100%' }}
                                            />
                                        </FormField>
                                    );
                                }
                                return (
                                    <FormField key={col} label={formatHeader(col)} error={errors[col]}>
                                        <Input
                                            placeholder={col}
                                            prefix={<IconSettings size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                                            value={formData[col] || ''}
                                            status={errors[col] ? 'error' : undefined}
                                            onChange={(e) => handleFieldChange(col, e.target.value)}
                                        />
                                    </FormField>
                                );
                            })}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button icon={<IconArrowRight size={16} />} iconPosition="end" onClick={() => setActiveTab('avanzado')}>
                                Siguiente: Avanzado
                            </Button>
                        </div>
                    </div>
                ),
            },
            {
                key: 'avanzado',
                label: <span><IconSettings size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />Avanzado</span>,
                children: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <SectionHeading icon={<IconSettings size={18} />} color="#e03131" title="Configuración Avanzada e IDs" subtitle="Identificadores técnicos y parámetros de integración con otros módulos." />

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                            {sections.avanzado.map(col => {
                                const isMandatory = MANDATORY_FIELDS.includes(col);
                                if (col === 'id_comuna' || col === 'id_comunaef') {
                                    return (
                                        <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                            <Select
                                                options={comunas}
                                                showSearch
                                                allowClear
                                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                                placeholder="Seleccione Comuna"
                                                value={formData[col] ? String(formData[col]) : undefined}
                                                status={errors[col] ? 'error' : undefined}
                                                onChange={(val) => handleFieldChange(col, val ? Number(val) : null)}
                                                style={{ width: '100%' }}
                                            />
                                        </FormField>
                                    );
                                }
                                if (col === 'lote_facturacion') {
                                    return (
                                        <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                            <Input
                                                placeholder="Lote"
                                                value={formData[col] || ''}
                                                status={errors[col] ? 'error' : undefined}
                                                onChange={(e) => handleFieldChange(col, e.target.value)}
                                            />
                                        </FormField>
                                    );
                                }
                                return (
                                    <FormField key={col} label={formatHeader(col)} required={isMandatory} error={errors[col]}>
                                        <InputNumber
                                            placeholder="Sin asignar"
                                            value={formData[col] === undefined || formData[col] === null ? undefined : formData[col]}
                                            status={errors[col] ? 'error' : undefined}
                                            onChange={(val) => handleFieldChange(col, val === null ? null : val)}
                                            style={{ width: '100%' }}
                                        />
                                    </FormField>
                                );
                            })}
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <Button onClick={() => setView('list')}>
                                Cancelar
                            </Button>
                            <Button
                                type="primary"
                                style={{ backgroundColor: '#0b7285' }}
                                onClick={handleSubmit}
                                loading={loading}
                                disabled={!isFormComplete()}
                                icon={<IconCheck size={20} />}
                            >
                                {editingId ? 'Guardar Cambios' : 'Crear Empresa'}
                            </Button>
                        </div>
                    </div>
                ),
            },
        ];

        return (
            <div>
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

                <div style={{ padding: '24px 16px' }}>
                    <Card style={{ borderRadius: 16 }}>
                        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
                    </Card>
                </div>
            </div>
        );
    }

    const columns = [
        {
            title: 'Nombre', dataIndex: 'nombre_empresaservicios', key: 'nombre',
            render: (v: string) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' as const }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(9,143,131,0.12)', color: '#098f83', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconBuilding size={14} />
                    </div>
                    <Text strong style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{v}</Text>
                </div>
            ),
        },
        { title: 'Contacto', dataIndex: 'contacto_empresaservicios', key: 'contacto', render: (v: string) => <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{v || '-'}</Text> },
        {
            title: 'Email', key: 'email',
            render: (_: unknown, item: any) => <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{item.email_empresaservicios || item.email_contacto || '-'}</Text>,
        },
        {
            title: 'Estado', key: 'estado', align: 'center' as const,
            render: (_: unknown, item: any) => (
                <Tag color={item.habilitado === 'S' ? 'green' : 'red'}>
                    {item.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                </Tag>
            ),
        },
        {
            title: 'Acciones', key: 'acciones', align: 'right' as const,
            render: (_: unknown, item: any) => (
                <Tooltip title="Editar">
                    <Button type="text" size="small" icon={<IconEdit size={16} />} onClick={() => handleEdit(item)} />
                </Tooltip>
            ),
        },
    ];

    return (
        <div>
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
                        icon={<IconPlus size={18} />}
                        type="primary"
                        style={{ backgroundColor: '#0b7285' }}
                        onClick={handleCreate}
                    >
                        Nueva Empresa
                    </Button>
                }
            />

            <div style={{ padding: '24px 16px' }}>
                <Card style={{ borderRadius: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', flex: 1 }}>
                                <FormField label="Búsqueda Rápida">
                                    <Input
                                        placeholder="Nombre, RUT, Email..."
                                        prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ width: 300 }}
                                    />
                                </FormField>

                                <FormField label="Filtrar por Estado">
                                    <Segmented
                                        value={statusFilter}
                                        onChange={(v) => setStatusFilter(v as string)}
                                        options={[
                                            { label: 'Todos', value: 'ALL' },
                                            { label: 'Activos', value: 'S' },
                                            { label: 'Inactivos', value: 'N' },
                                        ]}
                                    />
                                </FormField>

                                <FormField label="Responsable">
                                    <Select
                                        options={users}
                                        placeholder="Todos los responsables"
                                        value={userFilter ?? undefined}
                                        onChange={(v) => setUserFilter(v ?? null)}
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                        style={{ width: 250 }}
                                    />
                                </FormField>
                            </div>

                            <Tag color="blue" style={{ fontSize: 13, padding: '4px 10px' }}>
                                Total: {filteredData.length}
                            </Tag>
                        </div>

                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: 0 }} />

                        <Spin spinning={loading}>
                            <Table
                                dataSource={filteredData}
                                columns={columns}
                                rowKey="id_empresaservicio"
                                pagination={false}
                                size="middle"
                                scroll={{ y: 620, x: 800 }}
                                locale={{ emptyText: 'No se encontraron empresas' }}
                            />
                        </Spin>
                    </div>
                </Card>
            </div>
        </div>
    );
};

function FormField({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: required ? '#1677ff' : 'var(--app-text-secondary)', fontWeight: required ? 600 : 400, display: 'block', marginBottom: 4 }}>
                {label}{required ? ' *' : ''}
            </Text>
            {children}
            {error && <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{error}</Text>}
        </div>
    );
}

function SectionHeading({ icon, color, title, subtitle }: { icon: React.ReactNode; color: string; title: string; subtitle: string }) {
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: `${color}1f`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
                <Title level={4} style={{ margin: 0 }}>{title}</Title>
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>{subtitle}</Text>
        </div>
    );
}
