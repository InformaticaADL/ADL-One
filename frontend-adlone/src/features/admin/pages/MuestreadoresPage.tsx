import React, { useState, useEffect, useMemo } from 'react';
import {
    Typography,
    Button,
    Table,
    Tag,
    Card,
    Spin,
    Input,
    Select,
    Tooltip,
    Modal
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconPlus,
    IconSearch,
    IconEdit,
    IconPower,
    IconFileDescription,
    IconCheck,
    IconX,
    IconBell,
    IconSchool
} from '@tabler/icons-react';
import { adminService } from '../../../services/admin.service';
import { ursService } from '../../../services/urs.service';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { MuestreadorForm } from '../components/MuestreadorForm';
import { SamplerRequestsModal } from '../components/SamplerRequestsModal';
import SamplerDeactivationModal from '../components/SamplerDeactivationModal';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { useNavStore } from '../../../store/navStore';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

const { Text } = Typography;

interface Props {
    onBack: () => void;
}

export const MuestreadoresPage: React.FC<Props> = ({ onBack }) => {
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [solicitudesRealizadas, setSolicitudesRealizadas] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVOS');

    // Selected state
    const [selectedMuestreador, setSelectedMuestreador] = useState<any | null>(null);

    // Modals State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [muestreadorToDisable, setMuestreadorToDisable] = useState<any | null>(null);
    const [isEnableConfirmOpen, setIsEnableConfirmOpen] = useState(false);
    const [muestreadorToEnable, setMuestreadorToEnable] = useState<any | null>(null);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [requestsSamplerInfo, setRequestsSamplerInfo] = useState<{ id: string | number; nombre: string } | null>(null);

    // Image Zoom State
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const { showToast } = useToast();
    const { pendingRequestId } = useNavStore();

    const isMobile = useMediaQuery('(max-width: 768px)');

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await adminService.getMuestreadores(searchTerm, statusFilter);
            setMuestreadores(result.data || []);
        } catch (error) {
            console.error('Error fetching muestreadores:', error);
            showToast({ type: 'error', message: 'Error al cargar los muestreadores' });
        } finally {
            setLoading(false);
        }
    };

    const loadSolicitudes = async () => {
        try {
            // Focus ONLY on ACEPTADA states as requested (the ones to be marked as realized)
            const targetStates = 'ACEPTADA';

            const [legacyData, ursData] = await Promise.all([
                adminService.getSolicitudes({ estado: targetStates }).catch(() => []),
                ursService.getRequests({ estado: targetStates }).catch(() => [])
            ]);
            const data = [...(Array.isArray(legacyData) ? legacyData : []), ...(Array.isArray(ursData) ? ursData : [])];

            // Filter ones that might relate to Muestreadores
            const filtered = data.filter((s: any) => {
                if (s.modulo_destino === 'MUESTREADORES') return true;
                const typeRaw = (s.tipo_solicitud || s.nombre_tipo || '').toUpperCase();
                return typeRaw.includes('MUESTREADOR') || typeRaw.includes('FIRMA') || typeRaw.includes('DESHABILITAR');
            });
            setSolicitudesRealizadas(filtered);
        } catch (error) {
            console.error("Error loading solicitudes:", error);
        }
    };

    useEffect(() => {
        loadSolicitudes();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, statusFilter]);

    // Handle incoming pending request from NavStore — find the muestreador it belongs to and open its requests modal
    useEffect(() => {
        if (!pendingRequestId || solicitudesRealizadas.length === 0 || muestreadores.length === 0) return;
        const sol = solicitudesRealizadas.find(s => s.id_solicitud === pendingRequestId);
        if (!sol) return;
        const d = sol.datos_json || {};
        const idStr = String(d.id_muestreador || d.muestreador_origen_id || d.nuevo_responsable_id || '');
        const target = muestreadores.find(m => String(m.id_muestreador) === idStr);
        if (target) {
            handleOpenRequests(target);
        }
    }, [pendingRequestId, solicitudesRealizadas, muestreadores]);

    const handleCreate = () => {
        setSelectedMuestreador(null);
        setViewMode('form');
    };

    const handleEdit = (m: any) => {
        setSelectedMuestreador(m);
        setViewMode('form');
    };

    const handleOpenRequests = (m: any) => {
        setRequestsSamplerInfo({ id: m.id_muestreador, nombre: m.nombre_muestreador });
        setShowRequestsModal(true);
    };

    // Pre-build index once per solicitudesRealizadas change — O(1) lookup per row
    const pendingBySampler = useMemo(() => {
        const map = new Map<string, any[]>();
        for (const sol of solicitudesRealizadas) {
            const d = sol.datos_json || {};
            const ids = [
                d.id_muestreador,
                d.muestreador_origen_id,
                d.muestreador_destino_id,
                d.nuevo_responsable_id,
                d.id_muestreador_nuevo,
            ].filter(Boolean).map(String);
            for (const idStr of ids) {
                if (!map.has(idStr)) map.set(idStr, []);
                map.get(idStr)!.push(sol);
            }
        }
        return map;
    }, [solicitudesRealizadas]);

    const getPendingRequestsForSampler = (id: number) => pendingBySampler.get(String(id)) ?? [];

    const handleDisableClick = (m: any) => {
        setMuestreadorToDisable(m);
        setIsConfirmModalOpen(true);
    };

    // Note: confirmDisable is now handled by SamplerDeactivationModal

    const handleEnableClick = (m: any) => {
        setMuestreadorToEnable(m);
        setIsEnableConfirmOpen(true);
    };

    const confirmEnable = async () => {
        if (!muestreadorToEnable) return;
        try {
            await adminService.enableMuestreador(muestreadorToEnable.id_muestreador);
            showToast({ type: 'success', message: 'Muestreador habilitado correctamente' });
            fetchData();
            setIsEnableConfirmOpen(false);
            setMuestreadorToEnable(null);
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al habilitar' });
        }
    };

    const handleToggleEntrenamiento = async (m: any) => {
        const nuevo = m.en_entrenamiento === 'S' ? 'N' : 'S';
        try {
            await adminService.setEntrenamiento(m.id_muestreador, nuevo);
            showToast({ type: 'success', message: nuevo === 'N' ? 'Marcado como Operativo' : 'Marcado En entrenamiento' });
            fetchData();
        } catch {
            showToast({ type: 'error', message: 'Error al actualizar estado de entrenamiento' });
        }
    };

    // Parsea las competencias asignadas (FOR JSON desde el backend) → badges
    const parseCompetencias = (m: any): { nombre: string; activo: string }[] => {
        try { return JSON.parse(m.competencias_json || '[]'); } catch { return []; }
    };
    const renderCompetencias = (m: any) => {
        const comps = parseCompetencias(m);
        if (comps.length === 0) return <Text type="secondary" style={{ fontSize: 12 }}>Sin competencias</Text>;
        return (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {comps.map((c, i) => (
                    <Tag
                        key={i}
                        color={c.activo === 'S' ? 'purple' : 'default'}
                        title={c.activo === 'S' ? c.nombre : `${c.nombre} (inactiva)`}
                    >
                        {c.nombre}
                    </Tag>
                ))}
            </div>
        );
    };

    const handleExportPdf = async () => {
        setIsExporting(true);
        try {
            const blob = await adminService.getMuestreadoresPdf(searchTerm, statusFilter);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Muestreadores_${new Date().toISOString().split('T')[0]}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting PDF:', error);
            showToast({ type: 'error', message: 'Error al exportar PDF' });
        } finally {
            setIsExporting(false);
        }
    };

    const columns = [
        {
            title: 'Muestreador', key: 'nombre',
            render: (_: unknown, m: any) => (
                <div>
                    <Text strong style={{ fontSize: 13, display: 'block' }}>{m.nombre_muestreador}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>ID: {m.id_muestreador}</Text>
                </div>
            ),
        },
        { title: 'Contacto', key: 'contacto', render: (_: unknown, m: any) => <Text style={{ fontSize: 13 }}>{m.correo_electronico || '---'}</Text> },
        {
            title: 'Estado', key: 'estado',
            render: (_: unknown, m: any) => (
                <Tag color={m.habilitado === 'S' ? 'green' : 'red'} icon={m.habilitado === 'S' ? <IconCheck size={10} style={{ verticalAlign: 'text-bottom' }} /> : <IconX size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                    {m.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                </Tag>
            ),
        },
        {
            title: 'Entrenamiento', key: 'entrenamiento',
            render: (_: unknown, m: any) => (
                <Tooltip title={m.en_entrenamiento === 'S' ? 'En entrenamiento — clic para marcar Operativo' : 'Operativo — clic para marcar En entrenamiento'}>
                    <Tag
                        color={m.en_entrenamiento === 'S' ? 'gold' : 'green'}
                        icon={<IconSchool size={10} style={{ verticalAlign: 'text-bottom' }} />}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleEntrenamiento(m)}
                    >
                        {m.en_entrenamiento === 'S' ? 'En entrenamiento' : 'Operativo'}
                    </Tag>
                </Tooltip>
            ),
        },
        { title: 'Competencias', key: 'competencias', render: (_: unknown, m: any) => renderCompetencias(m) },
        {
            title: 'Firma Digital', key: 'firma',
            render: (_: unknown, m: any) => (
                m.firma_muestreador ? (
                    <Tooltip title="Ver firma ampliada">
                        <div
                            onClick={() => setZoomedImage(m.firma_muestreador)}
                            style={{ height: 40, width: 100, border: '1px solid var(--app-border)', borderRadius: 6, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <img src={m.firma_muestreador} style={{ height: 36, objectFit: 'contain' }} alt="Firma" />
                        </div>
                    </Tooltip>
                ) : (
                    <Text type="secondary" italic style={{ fontSize: 12 }}>Sin firma registrada</Text>
                )
            ),
        },
        {
            title: 'Acciones', key: 'acciones', align: 'center' as const,
            render: (_: unknown, m: any) => {
                const pendingReqs = getPendingRequestsForSampler(m.id_muestreador);
                const hasPending = pendingReqs.length > 0;
                return (
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <ProtectedContent permission="MU_SOLICITUDES">
                            <Tooltip title="Ver Solicitudes">
                                <Button type="text" size="small" icon={<IconBell size={16} color={hasPending ? '#e8590c' : undefined} />} onClick={() => handleOpenRequests(m)} />
                            </Tooltip>
                        </ProtectedContent>
                        <ProtectedContent permission="AI_MA_EDITAR_MUESTREADOR">
                            <Tooltip title="Editar Información">
                                <Button type="text" size="small" icon={<IconEdit size={16} color="#1c7ed6" />} onClick={() => handleEdit(m)} />
                            </Tooltip>
                        </ProtectedContent>
                        <ProtectedContent permission="AI_MA_DESHABILITAR_MUESTREADOR">
                            {m.habilitado === 'S' ? (
                                <Tooltip title="Deshabilitar Muestreador">
                                    <Button type="text" size="small" icon={<IconPower size={16} color="#e03131" />} onClick={() => handleDisableClick(m)} />
                                </Tooltip>
                            ) : (
                                <Tooltip title="Habilitar Muestreador">
                                    <Button type="text" size="small" icon={<IconCheck size={16} color="#2f9e44" />} onClick={() => handleEnableClick(m)} />
                                </Tooltip>
                            )}
                        </ProtectedContent>
                    </div>
                );
            },
        },
    ];

    const content = viewMode === 'form' ? (
        <MuestreadorForm
            initialData={selectedMuestreador}
            pendingRequests={selectedMuestreador ? getPendingRequestsForSampler(selectedMuestreador.id_muestreador) : []}
            onSave={() => {
                fetchData();
                loadSolicitudes();
                setViewMode('list');
            }}
            onCancel={() => setViewMode('list')}
            onViewRequests={() => handleOpenRequests(selectedMuestreador!)}
        />
    ) : (
        <div style={{ padding: 16, width: '100%' }}>
            <PageHeader
                title="Gestión de Muestreadores"
                subtitle={!isMobile ? "Administra el personal de muestreo técnico y sus firmas digitales autorizadas." : undefined}
                onBack={onBack}
                breadcrumbItems={[{ label: 'Administración', onClick: onBack }, { label: 'Muestreadores' }]}
                rightSection={
                    <>
                        <ProtectedContent permission="MU_EXP">
                            <Button
                                danger
                                icon={<IconFileDescription size={18} />}
                                onClick={handleExportPdf}
                                loading={isExporting}
                                size={isMobile ? 'small' : 'middle'}
                                style={{ flex: isMobile ? 1 : 'auto' }}
                            >
                                Exportar PDF
                            </Button>
                        </ProtectedContent>
                        <ProtectedContent permission="AI_MA_CREAR_NUEVO_MUESTREADOR">
                            <Button
                                type="primary"
                                icon={<IconPlus size={18} />}
                                onClick={handleCreate}
                                size={isMobile ? 'small' : 'middle'}
                                style={{ flex: isMobile ? 1 : 'auto' }}
                            >
                                Nuevo {isMobile ? '' : 'Muestreador'}
                            </Button>
                        </ProtectedContent>
                    </>
                }
            />

            <Card style={{ marginTop: 32 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                    <Field label="Buscar por Nombre">
                        <Input
                            placeholder="Escriba nombre o ID..."
                            prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </Field>
                    <Field label="Estado">
                        <Select
                            placeholder="Filtrar por estado"
                            options={[
                                { value: 'ACTIVOS', label: 'Solo Activos' },
                                { value: 'INACTIVOS', label: 'Solo Inactivos' },
                                { value: 'TODOS', label: 'Todos' }
                            ]}
                            value={statusFilter}
                            onChange={(val) => setStatusFilter(val || 'ACTIVOS')}
                            style={{ width: '100%' }}
                        />
                    </Field>
                </div>
            </Card>

            <Card style={{ marginTop: 24, position: 'relative' }} styles={{ body: { padding: isMobile ? 16 : 0 } }}>
                {loading && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}>
                        <Spin />
                    </div>
                )}

                {!isMobile ? (
                    <Table
                        rowKey="id_muestreador"
                        columns={columns}
                        dataSource={muestreadores}
                        pagination={false}
                        size="small"
                        scroll={{ y: 500, x: 1000 }}
                        locale={{ emptyText: 'No se encontraron muestreadores con los filtros aplicados.' }}
                    />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {muestreadores.length === 0 && !loading ? (
                            <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)', borderStyle: 'dashed', textAlign: 'center' }}>
                                <Text type="secondary">No se encontraron muestreadores.</Text>
                            </Card>
                        ) : (
                            muestreadores.map((m) => {
                                const pendingReqs = getPendingRequestsForSampler(m.id_muestreador);
                                const hasPending = pendingReqs.length > 0;

                                return (
                                    <Card key={m.id_muestreador} size="small">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                                                <div>
                                                    <Text strong style={{ fontSize: 15, color: '#1864ab', display: 'block' }}>{m.nombre_muestreador}</Text>
                                                    <Text type="secondary" strong style={{ fontSize: 12 }}>ID: {m.id_muestreador}</Text>
                                                </div>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <Tag color={m.habilitado === 'S' ? 'green' : 'red'}>{m.habilitado === 'S' ? 'Activo' : 'Inactivo'}</Tag>
                                                    <Tag
                                                        color={m.en_entrenamiento === 'S' ? 'gold' : 'green'}
                                                        icon={<IconSchool size={10} style={{ verticalAlign: 'text-bottom' }} />}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => handleToggleEntrenamiento(m)}
                                                    >
                                                        {m.en_entrenamiento === 'S' ? 'En entren.' : 'Operativo'}
                                                    </Tag>
                                                </div>
                                            </div>

                                            <hr style={{ border: 'none', borderTop: '1px dashed var(--app-border)' }} />

                                            <div>
                                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>CONTACTO:</Text>
                                                <Text strong style={{ fontSize: 13 }}>{m.correo_electronico || 'Sin correo registrado'}</Text>
                                            </div>

                                            <div>
                                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>FIRMA DIGITAL:</Text>
                                                {m.firma_muestreador ? (
                                                    <div
                                                        onClick={() => setZoomedImage(m.firma_muestreador)}
                                                        style={{ border: '1px solid var(--app-border)', padding: 4, borderRadius: 8, backgroundColor: 'var(--app-hover-bg)', width: 110, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                    >
                                                        <img src={m.firma_muestreador} style={{ height: 40, objectFit: 'contain' }} alt="Firma" />
                                                    </div>
                                                ) : (
                                                    <Text type="secondary" italic style={{ fontSize: 12 }}>Sin firma registrada</Text>
                                                )}
                                            </div>

                                            <div>
                                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>COMPETENCIAS:</Text>
                                                {renderCompetencias(m)}
                                            </div>

                                            <hr style={{ border: 'none', borderTop: '1px dashed var(--app-border)' }} />

                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <ProtectedContent permission="MU_SOLICITUDES">
                                                    <Button
                                                        style={{ flex: 1, color: hasPending ? '#e8590c' : undefined }}
                                                        onClick={() => handleOpenRequests(m)}
                                                        icon={<IconBell size={16} />}
                                                        size="small"
                                                    >
                                                        Solicitudes
                                                    </Button>
                                                </ProtectedContent>
                                                <ProtectedContent permission="AI_MA_EDITAR_MUESTREADOR">
                                                    <Button
                                                        style={{ flex: 1, color: '#1c7ed6' }}
                                                        onClick={() => handleEdit(m)}
                                                        icon={<IconEdit size={16} />}
                                                        size="small"
                                                    >
                                                        Editar
                                                    </Button>
                                                </ProtectedContent>
                                                <ProtectedContent permission="AI_MA_DESHABILITAR_MUESTREADOR">
                                                    {m.habilitado === 'S' ? (
                                                        <Button
                                                            danger
                                                            style={{ flex: 1 }}
                                                            onClick={() => handleDisableClick(m)}
                                                            icon={<IconPower size={16} />}
                                                            size="small"
                                                        >
                                                            Baja
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            style={{ flex: 1, color: '#2f9e44' }}
                                                            onClick={() => handleEnableClick(m)}
                                                            icon={<IconCheck size={16} />}
                                                            size="small"
                                                        >
                                                            Alta
                                                        </Button>
                                                    )}
                                                </ProtectedContent>
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                )}
            </Card>
        </div>
    );

    return (
        <>
            {content}
            <SamplerRequestsModal
                idMuestreador={requestsSamplerInfo?.id || null}
                nombreMuestreador={requestsSamplerInfo?.nombre || ''}
                isOpen={showRequestsModal}
                onClose={() => setShowRequestsModal(false)}
                onRefresh={() => {
                    loadSolicitudes();
                    fetchData();
                }}
                requests={getPendingRequestsForSampler(Number(requestsSamplerInfo?.id))}
            />

            <SamplerDeactivationModal
                opened={isConfirmModalOpen}
                onClose={() => {
                    setIsConfirmModalOpen(false);
                    setMuestreadorToDisable(null);
                }}
                sampler={{
                    id_muestreador: muestreadorToDisable?.id_muestreador,
                    nombre_muestreador: muestreadorToDisable?.nombre_muestreador || ''
                }}
                onSuccess={() => {
                    fetchData();
                    loadSolicitudes();
                }}
            />

            <ConfirmModal
                isOpen={isEnableConfirmOpen}
                title="Confirmar Habilitación"
                message={`¿Está seguro de habilitar a ${muestreadorToEnable?.nombre_muestreador}? El muestreador podrá ser asignado a nuevas fichas.`}
                confirmText="Habilitar"
                confirmColor="#2f9e44"
                onConfirm={confirmEnable}
                onCancel={() => {
                    setIsEnableConfirmOpen(false);
                    setMuestreadorToEnable(null);
                }}
            />

            <Modal
                open={!!zoomedImage}
                onCancel={() => setZoomedImage(null)}
                footer={null}
                width={560}
                centered
                title="Firma Digital"
            >
                <div style={{ border: '1px solid var(--app-border)', padding: 24, backgroundColor: 'var(--app-hover-bg)', borderRadius: 8, marginTop: 16, display: 'flex', justifyContent: 'center' }}>
                    <img src={zoomedImage ?? undefined} style={{ maxHeight: 400, objectFit: 'contain' }} alt="Firma ampliada" />
                </div>
            </Modal>
        </>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}
