import React, { useState, useEffect } from 'react';
import {
    Typography,
    Button,
    Table,
    Tag,
    Input,
    Spin,
    Card,
    Tooltip
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconPlus,
    IconEdit,
    IconTrash,
    IconArrowLeft,
    IconDeviceFloppy,
    IconX,
    IconSearch,
    IconListNumbers
} from '@tabler/icons-react';
import { equipoService } from '../services/equipo.service';
import { useToast } from '../../../contexts/ToastContext';

const { Title, Text } = Typography;

interface CatalogItem {
    id_equipocatalogo?: number;
    nombre: string;
    que_mide: string;
    unidad_medida_textual: string;
    unidad_medida_sigla: string;
    tipo_equipo: string;
}

interface Props {
    onBack: () => void;
}

export const EquipoCatalogoView: React.FC<Props> = ({ onBack }) => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<CatalogItem>({
        nombre: '',
        que_mide: '',
        unidad_medida_textual: '',
        unidad_medida_sigla: '',
        tipo_equipo: ''
    });
    const [isSiglaManual, setIsSiglaManual] = useState(false);

    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await equipoService.getEquipoCatalogo();
            if (res.success) {
                setItems(res.data);
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
            showToast({ type: 'error', message: 'Error al cargar el catálogo' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const autoGenerateSigla = (text: string) => {
        if (!text) return '';
        return text.split(',')
            .map(part => part.trim()
                .replace(/^(Unid\. de |Unidades de |Grados |de |en )/i, '')
            )
            .filter(part => part.length > 0)
            .join('/');
    };

    useEffect(() => {
        if (showForm && !isSiglaManual) {
            const suggestedSigla = autoGenerateSigla(formData.unidad_medida_textual);
            setFormData(prev => ({ ...prev, unidad_medida_sigla: suggestedSigla }));
        }
    }, [formData.unidad_medida_textual, showForm, isSiglaManual]);

    const handleEdit = (item: CatalogItem) => {
        setEditingItem(item);
        setFormData(item);
        setIsSiglaManual(true);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este elemento del catálogo?')) return;

        try {
            const res = await equipoService.deleteEquipoCatalogo(id);
            if (res.success) {
                showToast({ type: 'success', message: 'Elemento eliminado' });
                fetchItems();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast({ type: 'error', message: 'Error al eliminar el elemento' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (editingItem?.id_equipocatalogo) {
                res = await equipoService.updateEquipoCatalogo(editingItem.id_equipocatalogo, formData);
            } else {
                res = await equipoService.createEquipoCatalogo(formData);
            }

            if (res.success) {
                showToast({
                    type: 'success',
                    message: editingItem ? 'Elemento actualizado' : 'Elemento creado'
                });
                setShowForm(false);
                fetchItems();
            }
        } catch (error) {
            console.error('Error saving item:', error);
            showToast({ type: 'error', message: 'Error al guardar el elemento' });
        } finally {
            setLoading(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tipo_equipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.que_mide.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCancel = () => {
        setShowForm(false);
        setEditingItem(null);
        setFormData({ nombre: '', que_mide: '', unidad_medida_textual: '', unidad_medida_sigla: '', tipo_equipo: '' });
        setIsSiglaManual(false);
    };

    const columns = [
        { title: 'Nombre', key: 'nombre', render: (_: unknown, item: CatalogItem) => <Text strong style={{ fontSize: 13 }}>{item.nombre}</Text> },
        { title: 'Tipo', key: 'tipo', render: (_: unknown, item: CatalogItem) => <Tag color="geekblue">{item.tipo_equipo}</Tag> },
        {
            title: 'Qué Mide', key: 'quemide',
            render: (_: unknown, item: CatalogItem) => <Text type="secondary" style={{ fontSize: 12, maxWidth: 300, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.que_mide}</Text>,
        },
        { title: 'Sigla', key: 'sigla', render: (_: unknown, item: CatalogItem) => <Tag>{item.unidad_medida_sigla || 'N/A'}</Tag> },
        {
            title: 'Acciones', key: 'acciones', align: 'right' as const,
            render: (_: unknown, item: CatalogItem) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Tooltip title="Editar detalles">
                        <Button type="text" size="small" icon={<IconEdit size={16} color="#1c7ed6" />} onClick={() => handleEdit(item)} />
                    </Tooltip>
                    <Tooltip title="Eliminar del catálogo">
                        <Button type="text" size="small" icon={<IconTrash size={16} color="#e03131" />} onClick={() => handleDelete(item.id_equipocatalogo!)} />
                    </Tooltip>
                </div>
            ),
        },
    ];

    return (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '8px 4px' : '16px' }}>
            <Card style={{ position: 'relative' }}>
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                        <Spin />
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: isMobile ? '100%' : 280 }}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: isMobile ? 'wrap' : 'nowrap', justifyContent: isMobile ? 'center' : 'flex-start', alignItems: 'center' }}>
                                <IconListNumbers size={28} color="#1677ff" style={{ flexShrink: 0 }} />
                                <Title level={isMobile ? 4 : 3} style={{ margin: 0, lineHeight: 1.2, textAlign: isMobile ? 'center' : 'left' }}>
                                    {showForm ? (editingItem ? 'Editar Modelo' : 'Nuevo Modelo de Equipo') : 'Gestión de Catálogo'}
                                </Title>
                            </div>
                            <Text type="secondary" style={{ fontSize: 13, textAlign: isMobile ? 'center' : 'left' }}>
                                {showForm
                                    ? 'Defina los parámetros técnicos del modelo en el catálogo maestro.'
                                    : 'Administre los modelos autorizados con sus especificaciones detalladas para el inventario.'}
                            </Text>
                        </div>

                        <Button
                            icon={<IconArrowLeft size={16} />}
                            onClick={showForm ? handleCancel : onBack}
                            style={{ width: isMobile ? '100%' : 'auto' }}
                        >
                            {showForm ? 'Volver a la lista' : 'Volver al Hub'}
                        </Button>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: 0 }} />

                    {showForm ? (
                        <form onSubmit={handleSubmit}>
                            <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
                                        <Field label="Nombre del Equipo *" hint="Nombre principal que identifica al modelo">
                                            <Input
                                                placeholder="Ej: MULTIPARAMETRO"
                                                value={formData.nombre}
                                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Tipo de Equipo *" hint="Categoría técnica del equipo">
                                            <Input
                                                placeholder="Ej: Sonda, Sensor, Medidor"
                                                value={formData.tipo_equipo}
                                                onChange={(e) => setFormData({ ...formData, tipo_equipo: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Qué Mide (Variables) *" hint="Variables que el equipo registra">
                                            <Input
                                                placeholder="Ej: pH, Temperatura, Turbiedad"
                                                value={formData.que_mide}
                                                onChange={(e) => setFormData({ ...formData, que_mide: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Unidad de Medida (Detallado) *" hint="Descripción formal de las unidades">
                                            <Input
                                                placeholder="Ej: Unid. de pH, Grados Celsius, NTU"
                                                value={formData.unidad_medida_textual}
                                                onChange={(e) => setFormData({ ...formData, unidad_medida_textual: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Sigla de Unidad (Corta)" hint="Versión abreviada">
                                            <Input
                                                placeholder="Ej: pH/°C/NTU"
                                                value={formData.unidad_medida_sigla}
                                                onChange={(e) => {
                                                    setIsSiglaManual(true);
                                                    setFormData({ ...formData, unidad_medida_sigla: e.target.value });
                                                }}
                                                suffix={isSiglaManual ? (
                                                    <Tooltip title="Editado manualmente">
                                                        <Text style={{ fontSize: 12, color: '#1c7ed6', cursor: 'help' }}>✍️</Text>
                                                    </Tooltip>
                                                ) : undefined}
                                            />
                                        </Field>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, flexWrap: 'wrap-reverse', flexDirection: isMobile ? 'column' : 'row' }}>
                                        <Button icon={<IconX size={16} />} onClick={handleCancel} block={isMobile}>
                                            Cancelar
                                        </Button>
                                        <Button htmlType="submit" type="primary" icon={<IconDeviceFloppy size={18} />} block={isMobile}>
                                            {editingItem ? 'Actualizar' : 'Registrar'} {isMobile ? '' : 'Modelo'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        </form>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, width: '100%' }}>
                                <Input
                                    placeholder="Buscar por nombre, tipo o variable..."
                                    prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <Button
                                    icon={<IconPlus size={18} />}
                                    onClick={() => setShowForm(true)}
                                    type="primary"
                                    style={{ backgroundColor: '#212529' }}
                                >
                                    Agregar Nuevo Modelo
                                </Button>
                            </div>

                            <Card size="small" styles={{ body: { padding: isMobile ? 8 : 0 } }}>
                                {!isMobile ? (
                                    <Table
                                        rowKey="id_equipocatalogo"
                                        columns={columns}
                                        dataSource={filteredItems}
                                        pagination={false}
                                        size="small"
                                        scroll={{ y: 650, x: 800 }}
                                        locale={{
                                            emptyText: (
                                                <Text type="secondary" style={{ fontSize: 13 }}>
                                                    {loading ? 'Cargando datos...' : (searchTerm ? 'No se encontraron coincidencias.' : 'El catálogo está vacío.')}
                                                </Text>
                                            ),
                                        }}
                                    />
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {filteredItems.length === 0 ? (
                                            <div style={{ padding: 32, textAlign: 'center' }}>
                                                <Text type="secondary" style={{ fontSize: 13 }}>
                                                    {loading ? 'Cargando datos...' : (searchTerm ? 'No se encontraron coincidencias.' : 'El catálogo está vacío.')}
                                                </Text>
                                            </div>
                                        ) : (
                                            filteredItems.map((item) => (
                                                <Card key={item.id_equipocatalogo} size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                                                            <div style={{ flex: 1 }}>
                                                                <Text strong style={{ fontSize: 15, color: '#1864ab', display: 'block' }}>{item.nombre}</Text>
                                                                <Tag color="geekblue" style={{ marginTop: 4 }}>{item.tipo_equipo}</Tag>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: 6 }}>
                                                                <Button type="text" size="large" icon={<IconEdit size={20} color="#1c7ed6" />} onClick={() => handleEdit(item)} />
                                                                <Button type="text" size="large" icon={<IconTrash size={20} color="#e03131" />} onClick={() => handleDelete(item.id_equipocatalogo!)} />
                                                            </div>
                                                        </div>

                                                        <hr style={{ border: 'none', borderTop: '1px dashed var(--app-border)' }} />

                                                        <div>
                                                            <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>MIDE:</Text>
                                                            <Text style={{ fontSize: 13 }}>{item.que_mide}</Text>
                                                        </div>

                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <div>
                                                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>SIGLA:</Text>
                                                                <Tag>{item.unidad_medida_sigla || 'N/A'}</Tag>
                                                            </div>
                                                            <div style={{ textAlign: 'right' }}>
                                                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>ID:</Text>
                                                                <Text strong style={{ fontSize: 12 }}>#{item.id_equipocatalogo}</Text>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </Card>
                                            ))
                                        )}
                                    </div>
                                )}
                            </Card>

                            {!loading && filteredItems.length > 0 && (
                                <Text type="secondary" style={{ fontSize: 12, textAlign: 'right' }}>
                                    Mostrando {filteredItems.length} modelos en el catálogo
                                </Text>
                            )}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
            {hint && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{hint}</Text>}
        </div>
    );
}
