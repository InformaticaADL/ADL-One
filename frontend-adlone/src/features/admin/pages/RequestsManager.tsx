import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    Typography,
    Button,
    Table,
    Tag,
    Input,
    Avatar,
    Tooltip,
    Spin
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconFileText,
    IconSearch,
    IconSettings,
    IconChevronRight,
    IconPower,
    IconCheck,
    IconX,
    IconInfoCircle
} from '@tabler/icons-react';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Text } = Typography;

interface RequestType {
    id_tipo: number;
    nombre: string;
    descripcion?: string;
    area_destino: string;
    estado: boolean;
}

interface RequestsManagerProps {
    onBack: () => void;
    onConfigureType: (type: RequestType) => void;
}

export const RequestsManager: React.FC<RequestsManagerProps> = ({ onBack, onConfigureType }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();

    const [requestTypes, setRequestTypes] = useState<RequestType[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const types = await ursService.getRequestTypes(true);
            setRequestTypes(types);
        } catch (error) {
            console.error('Error loading request types:', error);
            showToast({ type: 'error', message: 'Error al cargar tipos de solicitud' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (type: RequestType) => {
        try {
            setActionLoading(type.id_tipo);
            await (ursService as any).toggleTypeStatus(type.id_tipo, !type.estado);
            showToast({
                type: 'success',
                message: `Trámite ${!type.estado ? 'habilitado' : 'deshabilitado'} correctamente`
            });
            await loadData();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cambiar estado del trámite' });
        } finally {
            setActionLoading(null);
        }
    };

    const filteredTypes = useMemo(() =>
        requestTypes.filter(t =>
            t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.area_destino.toLowerCase().includes(searchTerm.toLowerCase())
        ), [requestTypes, searchTerm]);

    const columns = [
        {
            title: 'Tipo de Trámite', key: 'nombre',
            render: (_: unknown, type: RequestType) => (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Avatar shape="square" size={40} style={{ backgroundColor: 'var(--app-accent-bg)', color: '#0062a8', borderRadius: 8 }} icon={<IconFileText size={22} />} />
                    <div>
                        <Text strong style={{ fontSize: 13, display: 'block' }}>{type.nombre}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>ID: {type.id_tipo}</Text>
                    </div>
                </div>
            ),
        },
        { title: 'Área Responsable', key: 'area', render: (_: unknown, type: RequestType) => <Tag color="blue">{type.area_destino}</Tag> },
        {
            title: 'Estado', key: 'estado', align: 'center' as const,
            render: (_: unknown, type: RequestType) => (
                <Tag color={type.estado ? 'green' : 'red'} icon={type.estado ? <IconCheck size={10} style={{ verticalAlign: 'text-bottom' }} /> : <IconX size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                    {type.estado ? 'ACTIVO' : 'INACTIVO'}
                </Tag>
            ),
        },
        {
            title: 'Acciones', key: 'acciones', align: 'right' as const,
            render: (_: unknown, type: RequestType) => (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <Tooltip title={type.estado ? 'Deshabilitar trámite' : 'Habilitar trámite'}>
                        <Button
                            type="text"
                            danger={type.estado}
                            icon={<IconPower size={18} />}
                            onClick={() => handleToggleStatus(type)}
                            loading={actionLoading === type.id_tipo}
                        />
                    </Tooltip>
                    <Button
                        type="primary"
                        icon={<IconSettings size={14} />}
                        iconPosition="end"
                        onClick={() => onConfigureType(type)}
                    >
                        Configurar Accesos <IconChevronRight size={14} />
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <div style={{ padding: isMobile ? 8 : 16, width: '100%' }}>
            <PageHeader
                title="Administración de Solicitudes"
                subtitle="Gestiona quién puede enviar y administrar los trámites URS."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Solicitudes URS' }
                ]}
                rightSection={
                    <Input
                        placeholder="Buscar..."
                        prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                        style={{ width: isMobile ? '100%' : 300, marginTop: isMobile ? 16 : 0 }}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32, position: 'relative' }}>
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spin />
                    </div>
                )}

                {isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {filteredTypes.length > 0 ? (
                            filteredTypes.map((type) => (
                                <Card key={type.id_tipo} size="small">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
                                            <Avatar shape="square" size={40} style={{ backgroundColor: 'var(--app-accent-bg)', color: '#0062a8', borderRadius: 8 }} icon={<IconFileText size={22} />} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{type.nombre}</Text>
                                                <Text type="secondary" style={{ fontSize: 12 }}>ID: {type.id_tipo}</Text>
                                            </div>
                                        </div>
                                        <Tag color={type.estado ? 'green' : 'red'} icon={type.estado ? <IconCheck size={10} style={{ verticalAlign: 'text-bottom' }} /> : <IconX size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                                            {type.estado ? 'ACTIVO' : 'INACTIVO'}
                                        </Tag>
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Tag color="blue">{type.area_destino}</Tag>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <Button
                                                type="text"
                                                danger={type.estado}
                                                icon={<IconPower size={18} />}
                                                onClick={() => handleToggleStatus(type)}
                                                loading={actionLoading === type.id_tipo}
                                            />
                                            <Button
                                                type="primary"
                                                size="small"
                                                icon={<IconSettings size={14} />}
                                                onClick={() => onConfigureType(type)}
                                            >
                                                Configurar
                                            </Button>
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <Card style={{ textAlign: 'center' }}>
                                <Text type="secondary">No se encontraron trámites</Text>
                            </Card>
                        )}
                    </div>
                ) : (
                    <Card styles={{ body: { padding: 0 } }}>
                        <Table
                            rowKey="id_tipo"
                            columns={columns}
                            dataSource={filteredTypes}
                            pagination={false}
                            scroll={{ y: 600 }}
                            locale={{
                                emptyText: (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '60px 0' }}>
                                        <IconFileText size={48} color="var(--app-border)" />
                                        <Text strong type="secondary">No se encontraron trámites</Text>
                                    </div>
                                ),
                            }}
                        />
                    </Card>
                )}

                <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                        <IconInfoCircle size={20} color="#1c7ed6" style={{ marginTop: 2, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>Información para Administradores</Text>
                            <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.5 }}>
                                La creación de nuevos tipos de formularios y la edición técnica están reservadas para el equipo de desarrollo.
                                Desde este panel usted puede controlar <strong>quién tiene permiso para enviar</strong> cada solicitud y
                                <strong>quién tiene la autoridad para resolverla</strong>.
                            </Text>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};
