import React, { useState } from 'react';
import {
    Modal,
    Table,
    Tag,
    Button,
    Alert,
    Typography,
    Collapse,
    Card
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconCalendar,
    IconUser,
    IconCheck,
    IconInfoCircle,
    IconBriefcase,
    IconSignature,
    IconArrowRight,
    IconBuildingCommunity,
    IconList
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface SamplerRequestsModalProps {
    idMuestreador: number | string | null;
    nombreMuestreador: string;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    requests: any[];
}

export const SamplerRequestsModal: React.FC<SamplerRequestsModalProps> = ({
    nombreMuestreador,
    isOpen,
    onClose,
    onRefresh,
    requests
}) => {
    const displayRequests = requests || [];
    const [processingId, setProcessingId] = useState<number | null>(null);
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const handleMarkAsRealizada = async (sol: any) => {
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const isDeshabilitar = typeRaw.toUpperCase().includes('DESHABILITAR');

        const executeUpdate = async () => {
            setProcessingId(sol.id_solicitud);
            try {
                if (sol.id_tipo || (sol.origen_tabla && sol.origen_tabla !== 'GENERAL')) {
                    // Es URS
                    await ursService.updateStatus(sol.id_solicitud, {
                        status: 'REALIZADA',
                        comment: 'Solicitud gestionada y marcada como realizada automáticamente.'
                    });
                } else {
                    // Es Legacy
                    await adminService.updateSolicitudStatus(
                        sol.id_solicitud,
                        'REALIZADA',
                        'Solicitud marcada como realizada desde el panel de muestreadores.'
                    );
                }
                showToast({ type: 'success', message: `Solicitud #${sol.id_solicitud} marcada como realizada` });
                onRefresh();

            } catch (error) {
                console.error('Error updating status:', error);
                showToast({ type: 'error', message: 'Error al actualizar la solicitud' });
            } finally {
                setProcessingId(null);
            }
        };

        if (isDeshabilitar) {
            Modal.confirm({
                title: 'Confirmar Deshabilitación',
                content: (
                    <Text style={{ fontSize: 13 }}>
                        ¿Está seguro de que desea deshabilitar este muestreador y reasignar todos sus equipos según lo solicitado?
                        Esta acción es irreversible y afectará el acceso del usuario.
                    </Text>
                ),
                okText: 'Confirmar y Ejecutar',
                cancelText: 'Cancelar',
                okButtonProps: { danger: true },
                onOk: executeUpdate,
            });
        } else {
            executeUpdate();
        }
    };

    const getStatusColor = (status: string) => {
        const s = (status || '').toUpperCase().trim();
        switch (s) {
            case 'PENDIENTE':
            case 'PENDIENTE_TECNICA':
            case 'PENDIENTE_CALIDAD': return 'gold';
            case 'EN_REVISION':
            case 'EN_REVISION_TECNICA': return 'cyan';
            case 'ACEPTADA': return 'green';
            case 'RECHAZADA':
            case 'RECHAZADO_TECNICA': return 'red';
            case 'REALIZADA': return 'blue';
            default: return 'default';
        }
    };

    const getStatusLabel = (status: string) => {
        return (status || '').replace(/_/g, ' ');
    };

    const renderSolicitudDetails = (sol: any) => {
        const d = sol.datos_json || {};
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const type = typeRaw.toUpperCase();

        const isDeshabilitar = type.includes('DESHABILITAR');
        const isFirma = type.includes('FIRMA');
        const isTraspaso = type.includes('TRASPASO');

        const transferType = d.tipo_traspaso; // BASE, MUESTREADOR, MANUAL
        const equipmentCount = d.reasignacion_manual?.length || 0;

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Text strong style={{ fontSize: 13, color: '#1864ab' }}>{typeRaw}</Text>

                <div>
                    {isDeshabilitar && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                                <IconBriefcase size={14} color="red" />
                                <Text strong style={{ fontSize: 12, color: '#c92a2a' }}>Solicitud de Deshabilitación</Text>
                            </div>

                            {transferType === 'BASE' && (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                                    <IconBuildingCommunity size={12} color="gray" />
                                    <Text strong style={{ fontSize: 12 }}>Traspaso a Base:</Text>
                                    <Text style={{ fontSize: 12, color: '#1c7ed6' }}>{d.base_destino || 'Principal'}</Text>
                                </div>
                            )}

                            {transferType === 'MUESTREADOR' && (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                                    <IconUser size={12} color="gray" />
                                    <Text strong style={{ fontSize: 12 }}>Traspaso a:</Text>
                                    <Text style={{ fontSize: 12, color: '#1c7ed6' }}>{d.muestreador_destino_nombre || 'Muestreador Destino'}</Text>
                                </div>
                            )}

                            {transferType === 'MANUAL' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                                        <IconList size={12} color="gray" />
                                        <Text strong style={{ fontSize: 12 }}>Traspaso Manual ({equipmentCount} equipos)</Text>
                                    </div>
                                    <Collapse
                                        size="small"
                                        items={[{
                                            key: 'manual-list',
                                            label: <Text strong style={{ fontSize: 12 }}>Ver Detalle de Equipos</Text>,
                                            children: (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {d.reasignacion_manual?.map((item: any, idx: number) => (
                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', gap: 4 }}>
                                                            <Text style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre_equipo}</Text>
                                                            <IconArrowRight size={10} />
                                                            <Text strong style={{ fontSize: 12, color: '#0c8599' }}>{item.id_muestreador_nuevo ? 'Asignado' : 'Pendiente'}</Text>
                                                        </div>
                                                    ))}
                                                </div>
                                            ),
                                        }]}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                    {isFirma && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                            <IconSignature size={12} color="#4c6ef5" />
                            <Text strong style={{ fontSize: 12, color: '#3b5bdb' }}>Actualización de Firma</Text>
                        </div>
                    )}
                    {isTraspaso && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                            <IconUser size={12} color="#0c8599" />
                            <Text strong style={{ fontSize: 12, color: '#087f5b' }}>Asignación de Equipos</Text>
                        </div>
                    )}
                </div>

                {(d.observaciones || d.descripcion || d.comentario) && (
                    <div style={{ marginTop: 4 }}>
                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Observaciones</Text>
                        <Text type="secondary" italic style={{ fontSize: 12 }}>
                            "{d.observaciones || d.descripcion || d.comentario}"
                        </Text>
                    </div>
                )}
            </div>
        );
    };

    const formatDate = (date: string) => {
        if (!date) return '-';
        return new Date(date).toLocaleString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const columns = [
        { title: 'ID', key: 'id', render: (_: unknown, sol: any) => <Text strong style={{ fontSize: 13 }}>#{sol.id_solicitud}</Text> },
        { title: 'Tipo', key: 'tipo', render: (_: unknown, sol: any) => renderSolicitudDetails(sol) },
        {
            title: 'Solicitante', key: 'solicitante',
            render: (_: unknown, sol: any) => (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                    <IconUser size={14} color="gray" />
                    <Text style={{ fontSize: 12 }}>{sol.nombre_solicitante || 'N/A'}</Text>
                </div>
            ),
        },
        {
            title: 'Fecha', key: 'fecha',
            render: (_: unknown, sol: any) => (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                    <IconCalendar size={14} color="gray" />
                    <Text style={{ fontSize: 12 }}>{formatDate(sol.fecha_creacion)}</Text>
                </div>
            ),
        },
        {
            title: 'Estado', key: 'estado',
            render: (_: unknown, sol: any) => <Tag color={getStatusColor(sol.estado)} style={{ minWidth: 80, textAlign: 'center' }}>{getStatusLabel(sol.estado)}</Tag>,
        },
        {
            title: 'Acciones', key: 'acciones', align: 'right' as const,
            render: (_: unknown, sol: any) => (
                (sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                    <Button
                        size="small"
                        type="primary"
                        style={{ backgroundColor: '#2f9e44' }}
                        icon={<IconCheck size={14} />}
                        loading={processingId === sol.id_solicitud}
                        onClick={() => handleMarkAsRealizada(sol)}
                    >
                        Realizar
                    </Button>
                )
            ),
        },
    ];

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={isMobile ? '100%' : 900}
            style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : undefined}
            maskClosable={false}
            title={
                <div>
                    <Text strong style={{ fontSize: 16, display: 'block' }}>Solicitudes Pendientes</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>{nombreMuestreador}</Text>
                </div>
            }
        >
            <div style={{ position: 'relative', minWidth: isMobile ? 'auto' : 500, minHeight: 200, padding: isMobile ? 8 : 0, marginTop: 16 }}>
                {displayRequests.length === 0 ? (
                    <Alert type="info" showIcon icon={<IconInfoCircle size={16} />} message="No hay solicitudes pendientes activas para este muestreador." />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {!isMobile ? (
                            <Table
                                rowKey={(sol) => `${sol.origen_tabla}-${sol.id_solicitud}`}
                                columns={columns}
                                dataSource={displayRequests}
                                pagination={false}
                                size="small"
                                scroll={{ x: 800 }}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {displayRequests.map((sol: any) => (
                                    <Card key={`${sol.origen_tabla}-${sol.id_solicitud}`} size="small">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Text strong style={{ fontSize: 13, color: '#1864ab' }}>#{sol.id_solicitud}</Text>
                                                <Tag color={getStatusColor(sol.estado)}>{getStatusLabel(sol.estado)}</Tag>
                                            </div>

                                            <hr style={{ border: 'none', borderTop: '1px dashed var(--app-border)' }} />

                                            {renderSolicitudDetails(sol)}

                                            <hr style={{ border: 'none', borderTop: '1px dashed var(--app-border)' }} />

                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                <div>
                                                    <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>SOLICITANTE</Text>
                                                    <Text strong style={{ fontSize: 12 }}>{sol.nombre_solicitante || 'N/A'}</Text>
                                                </div>
                                                <div>
                                                    <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>FECHA</Text>
                                                    <Text strong style={{ fontSize: 12 }}>{formatDate(sol.fecha_creacion)}</Text>
                                                </div>
                                            </div>

                                            {(sol.estado === 'PENDIENTE' || sol.estado === 'ACEPTADA') && (
                                                <Button
                                                    block
                                                    type="primary"
                                                    style={{ backgroundColor: '#2f9e44', marginTop: 8 }}
                                                    icon={<IconCheck size={16} />}
                                                    loading={processingId === sol.id_solicitud}
                                                    onClick={() => handleMarkAsRealizada(sol)}
                                                >
                                                    Marcar como Realizada
                                                </Button>
                                            )}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <Button onClick={onClose} block={isMobile}>Cerrar</Button>
            </div>
        </Modal>
    );
};
