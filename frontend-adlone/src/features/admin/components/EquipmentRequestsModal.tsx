import React, { useState, useEffect } from 'react';
import {
    Modal,
    Table,
    Tag,
    Button,
    Alert,
    Tooltip,
    Typography
} from 'antd';
import {
    IconCalendar,
    IconUser,
    IconMapPin,
    IconCheck,
    IconInfoCircle
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface EquipmentRequestsModalProps {
    idEquipo: number | string | null;
    nombreEquipo: string;
    isOpen: boolean;
    onClose: () => void;
    onRefresh: () => void;
    codigoEquipo?: string;
    requests: any[];
}

export const EquipmentRequestsModal: React.FC<EquipmentRequestsModalProps> = ({
    nombreEquipo,
    codigoEquipo,
    isOpen,
    onClose,
    onRefresh,
    requests
}) => {
    const displayRequests = requests || [];
    const [processingId, setProcessingId] = useState<number | null>(null);
    const { showToast } = useToast();

    useEffect(() => {
        // Simple mount dependency
    }, [isOpen]);

    const handleMarkAsRealizada = async (sol: any) => {
        setProcessingId(sol.id_solicitud);
        try {
            if (sol.id_tipo || (sol.origen_tabla && sol.origen_tabla !== 'GENERAL')) {
                // Es URS
                await ursService.updateStatus(sol.id_solicitud, {
                    status: 'REALIZADA',
                    comment: 'Equipo gestionado y marcado como realizado automáticamente.'
                });
            } else {
                // Es Legacy
                await adminService.updateSolicitudStatus(
                    sol.id_solicitud,
                    'REALIZADA',
                    'Solicitud marcada como realizada desde el panel de equipos.'
                );
            }
            showToast({ type: 'success', message: `Solicitud #${sol.id_solicitud} marcada como realizada` });
            onRefresh();
            onClose();

        } catch (error) {
            console.error('Error updating status:', error);
            showToast({ type: 'error', message: 'Error al actualizar la solicitud' });
        } finally {
            setProcessingId(null);
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

    /** Converts code-like strings to human-readable text */
    const CODE_VALUE_MAP: Record<string, string> = {
        'VIDA_UTIL': 'Vida Útil',
        'DANIO': 'Daño',
        'DANO': 'Daño',
        'OBSOLESCENCIA': 'Obsolescencia',
        'PERDIDA': 'Pérdida',
        'ROBO': 'Robo',
        'DETERIORO': 'Deterioro',
        'REEMPLAZO': 'Reemplazo',
        'OTRO': 'Otro',
    };

    const formatCodeValue = (value: string | null | undefined): string => {
        if (!value) return '';
        const upper = String(value).trim().toUpperCase();
        if (CODE_VALUE_MAP[upper]) return CODE_VALUE_MAP[upper];
        return String(value);
    };

    const renderSolicitudDetails = (sol: any) => {
        const d = sol.datos_json || {};
        const typeRaw = sol.tipo_solicitud || sol.nombre_tipo || '';
        const type = typeRaw.toUpperCase();

        const isTraspaso = type.includes('TRASPASO') || d._form_type === 'TRASPASO_EQUIPO' || d.isTransfer;
        const isAlta = type.includes('ALTA') || (type.includes('REACTIVACI') && d.isReactivation);
        const isProblem = type.includes('PROBLEMA') || type.includes('FALLA');

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Text strong style={{ fontSize: 13, color: '#1864ab' }}>{typeRaw}</Text>

                {/* Specific Details based on Type */}
                <div style={{ marginTop: 2 }}>
                    {isTraspaso && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {d.traspaso_de && (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <Text type="secondary" strong style={{ fontSize: 12 }}>Tipo Traspaso:</Text>
                                    <Text strong style={{ fontSize: 12, color: '#1864ab' }}>
                                        {d.traspaso_de.map((t: string) => t === 'UBICACION' ? 'Sede' : (t === 'RESPONSABLE' ? 'Muestreador' : t)).join(' y ')}
                                    </Text>
                                </div>
                            )}
                            {(d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino) && (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                                    <IconMapPin size={12} color="#1c7ed6" />
                                    <Text strong style={{ fontSize: 12 }}>Sede Destino:</Text>
                                    <Tag color="blue" style={{ minWidth: 'fit-content' }}>
                                        {d.nombre_centro_destino || d.nueva_ubicacion || d.destino || d.ubicacion_destino}
                                    </Tag>
                                </div>
                            )}
                            {(d.nombre_muestreador_destino || d.nuevo_responsable_nombre || d.nuevo_responsable || d.responsable_destino) && (
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                                    <IconUser size={12} color="#4c6ef5" />
                                    <Text strong style={{ fontSize: 12 }}>Nuevo Responsable:</Text>
                                    <Text strong style={{ fontSize: 12, color: '#3b5bdb' }}>
                                        {d.nombre_muestreador_destino || d.nuevo_responsable_nombre || d.nuevo_responsable || d.responsable_destino}
                                    </Text>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ALTA / REACTIVACION DETAILS */}
                    {isAlta && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap' }}>
                            <IconCalendar size={12} color="#0c8599" />
                            <Text strong style={{ fontSize: 12 }}>Nueva Vigencia:</Text>
                            <Tag color="cyan">
                                {d.nueva_vigencia_solicitada || d.vigencia_propuesta || d.fecha_vigencia || d.vigencia}
                            </Tag>
                        </div>
                    )}

                    {/* PROBLEM REPORT DETAILS */}
                    {isProblem && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {d.criticidad && (
                                <Tag color={d.criticidad.toUpperCase() === 'ALTA' ? 'red' : 'orange'}>
                                    CRITICIDAD: {d.criticidad}
                                </Tag>
                            )}
                            {d.descripcion_falla && (
                                <Text strong style={{ fontSize: 12, color: '#c92a2a' }}>Falla: {d.descripcion_falla}</Text>
                            )}
                        </div>
                    )}
                </div>

                {/* General Motive/Comments (Always at the bottom) */}
                {(d.motivo || d.observaciones || d.descripcion || d.comentario) && (
                    <Text type="secondary" italic style={{ fontSize: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        "{formatCodeValue(String(d.motivo || d.observaciones || d.descripcion || d.comentario))}"
                    </Text>
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
        {
            title: 'ID', key: 'id',
            render: (_: unknown, sol: any) => (
                <Tooltip title={sol.origen_tabla === 'GENERAL' ? 'Solicitud GERR (Sistema General)' : 'Solicitud de Equipo'}>
                    <Text strong style={{ fontSize: 13, color: sol.origen_tabla === 'GENERAL' ? '#3b5bdb' : undefined }}>
                        #{sol.id_solicitud}
                    </Text>
                </Tooltip>
            ),
        },
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
            render: (_: unknown, sol: any) => (
                <Tag color={getStatusColor(sol.estado)} style={{ minWidth: 80, textAlign: 'center' }}>
                    {getStatusLabel(sol.estado)}
                </Tag>
            ),
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
            width={900}
            title={
                <div>
                    <Text strong style={{ fontSize: 16, display: 'block' }}>Solicitudes Pendientes</Text>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {codigoEquipo && (
                            <Tag color="blue">{codigoEquipo}</Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 13 }}>{nombreEquipo}</Text>
                    </div>
                </div>
            }
        >
            <div style={{ position: 'relative', minWidth: 500, minHeight: 200, marginTop: 16 }}>
                {displayRequests.length === 0 ? (
                    <Alert type="info" showIcon icon={<IconInfoCircle size={16} />} message="No hay solicitudes pendientes activas para este equipo." style={{ marginTop: 16 }} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                        <Table
                            rowKey={(sol) => `${sol.origen_tabla}-${sol.id_solicitud}`}
                            columns={columns}
                            dataSource={displayRequests}
                            pagination={false}
                            size="small"
                            scroll={{ x: 800 }}
                        />

                        <Text type="secondary" italic style={{ fontSize: 12 }}>
                            * Las solicitudes GERR provienen del sistema general de requerimientos.
                        </Text>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
                <Button onClick={onClose}>Cerrar</Button>
            </div>
        </Modal>
    );
};
