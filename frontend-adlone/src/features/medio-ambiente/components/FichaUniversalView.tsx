import React, { useEffect, useState, useRef, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { ObservationTimeline } from './ObservationTimeline';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';
import { AntecedentesForm, type AntecedentesFormHandle } from './AntecedentesForm';
import { AnalysisForm } from './AnalysisForm';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { mapToAntecedentes } from '../utils/fichaMapping';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

import { Button, Typography, Card, Table, Tag, Tabs, Spin, Divider, Input, Tooltip } from 'antd';
import {
    IconDeviceFloppy,
    IconX,
    IconEdit,
    IconClipboardList,
    IconFlask,
    IconHistory,
    IconCheck,
    IconRotate,
    IconMessageDots,
    IconFileDownload
} from '@tabler/icons-react';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Props {
    fichaId: number;
    onBack: () => void;
}

// F-36: Textarea con estado local — actualiza al padre via startTransition para evitar lag por re-render del componente grande.
const DeferredTextarea = React.memo(({ value, onChange, placeholder, minRows }: {
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    minRows?: number;
}) => {
    const [local, setLocal] = useState(value);
    React.useEffect(() => { setLocal(value); }, [value]);
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const next = e.currentTarget.value;
        setLocal(next);
        React.startTransition(() => onChange(next));
    };
    return (
        <TextArea
            value={local}
            onChange={handleChange}
            placeholder={placeholder}
            autoSize={{ minRows: minRows || 3 }}
        />
    );
});

const getStatusProps = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('REVISAR')) return { color: 'red', label: s };
    if (s.includes('COORDINACIÓN')) return { color: 'blue', label: s };
    if (s.includes('PROGRAMACIÓN')) return { color: 'purple', label: s };
    if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { color: 'gold', label: 'PENDIENTE TÉCNICA' };
    if (s.includes('ASIGNAR')) return { color: 'orange', label: s };
    if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO') || s.includes('EN PROCESO')) return { color: 'green', label: s };
    return { color: 'default', label: s || 'SIN ESTADO' };
};

// Grid responsivo genérico para los bloques de campos estáticos — reemplaza
// los SimpleGrid de Mantine con distintos cols={{base,sm,md}} por bloque.
function FieldGrid({ min = 200, children }: { min?: number; children: React.ReactNode }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>
            {children}
        </div>
    );
}

const StaticField = ({ label, value, span }: { label: string; value: any; span?: number }) => (
    <div style={{ gridColumn: span ? `span ${span}` : undefined }}>
        <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-secondary)', textTransform: 'uppercase', display: 'block', whiteSpace: 'nowrap' }}>
            {label}
        </Text>
        <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: '6px 10px', backgroundColor: 'var(--app-hover-bg)', marginTop: 2 }}>
            <Text style={{ fontSize: 13.5, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }} title={String(value || '-')}>
                {value || '-'}
            </Text>
        </div>
    </div>
);

export const FichaUniversalView: React.FC<Props> = ({ fichaId, onBack }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const auth = useAuth();
    const { hasPermission, user } = auth;
    const isMobile = useMediaQuery('(max-width: 500px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');

    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    const [visitedTabs, setVisitedTabs] = useState({ antecedentes: true, analisis: false, observaciones: false });
    const allTabsVisited = visitedTabs.antecedentes && visitedTabs.analisis && visitedTabs.observaciones;
    const [data, setData] = useState<any>(null);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);

    // Edit States
    const [isEditing, setIsEditing] = useState(false);
    const [analysisList, setAnalysisList] = useState<any[]>([]);
    const [costoOperativo, setCostoOperativo] = useState<{ enabled: boolean; uf: number | string }>({ enabled: true, uf: '' });
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const mappedInitialDataRef = useRef<any>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);

    // Observations for actions
    const [newObservation, setNewObservation] = useState(''); // Comercial
    const [tecnicaObs, setTecnicaObs] = useState(''); // Técnica
    const [coordinacionObs, setCoordinacionObs] = useState(''); // Coordinación

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        type: 'approve_tech' | 'reject_tech' | 'approve_coord' | 'reject_coord';
        title: string;
        message: string;
    } | null>(null);

    const timelineCreationData = useMemo(() => {
        if (!data) return undefined;
        return {
            date: data.fecha_fichacomercial || new Date().toISOString(),
            user: data.responsablemuestreo || 'Comercial',
            observation: data.observaciones_comercial || ''
        };
    }, [data]);

    useEffect(() => {
        loadData();
    }, [fichaId]);

    const loadData = async () => {
        if (!fichaId) return;
        setLoading(true);
        try {
            const [fichaResponse, labsData] = await Promise.all([
                fichaService.getById(fichaId),
                catalogos.getLaboratorios()
            ]);

            let fichaData = null;
            if (fichaResponse && fichaResponse.success && fichaResponse.data) {
                fichaData = fichaResponse.data;
            } else if (fichaResponse && (fichaResponse.encabezado || fichaResponse.fichaingresoservicio)) {
                fichaData = fichaResponse;
            }

            if (fichaData) {
                setData(fichaData);
            } else {
                showToast({ type: 'error', message: 'No se pudo cargar la ficha' });
            }
            setLaboratorios(labsData || []);
        } catch (error) {
            console.error("Error loading data:", error);
            showToast({ type: 'error', message: "Error al cargar datos" });
        } finally {
            setLoading(false);
        }
    };

    const getLabName = (id: any) => {
        if (!id) return null;
        const lab = laboratorios.find(l => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
        return lab ? lab.nombre_laboratorioensayo : null;
    };

    // Comercial Edit Logic
    const handleEditStart = () => {
        if (!data) return;
        const allRows = data.detalles || [];
        // Separar la fila sentinela "CostoOperativo"
        const costoRow = allRows.find((r: any) => r.tipo_analisis === 'CostoOperativo');
        const regularRows = allRows.filter((r: any) => r.tipo_analisis !== 'CostoOperativo');

        const mappedAnalysis = regularRows.map((row: any, index: number) => ({
            ...row,
            savedId: `edit-${index}-${Date.now()}`,
            nombre_tecnica: row.nombre_tecnica || row.nombre_determinacion || row.nombre_examen,
            nombre_laboratorioensayo: getLabName(row.id_laboratorioensayo),
            nombre_laboratorioensayo_2: getLabName(row.id_laboratorioensayo_2 || row.id_laboratorioensayo2),
            item: index + 1
        }));

        // Costo Operativo siempre marcado por defecto; el usuario lo desactiva manualmente.
        const costoUF = Number(costoRow?.uf_individual || 0);
        setCostoOperativo({ enabled: true, uf: costoUF > 0 ? costoUF : '' });

        mappedInitialDataRef.current = mapToAntecedentes(data, data.agenda);
        setAnalysisList(mappedAnalysis);
        setNewObservation('');
        setIsEditing(true);
        setActiveTab('antecedentes');
    };

    const handleSaveChanges = async () => {
        if (!fichaId || !antecedentesRef.current) return;

        // F-37: si el usuario no ingresó observación, se permite guardar igual con texto por defecto
        // (la auditoría queda registrada con quién y cuándo).
        const obsToSave = (newObservation && newObservation.trim())
            ? newObservation.trim()
            : 'Edición sin observaciones adicionales';

        const payload = {
            antecedentes: antecedentesRef.current.getData(),
            analisis: analysisList,
            costoOperativo: {
                activo: !!costoOperativo.enabled,
                uf: costoOperativo.enabled ? Number(costoOperativo.uf || 0) : 0
            },
            observaciones: obsToSave
        };

        try {
            setIsSaving(true);
            const response = await fichaService.update(fichaId, payload, auth?.user as any);
            if (response && response.success) {
                showToast({ type: 'success', message: 'Ficha actualizada correctamente' });
                setIsEditing(false);
                setNewObservation('');
                onBack(); // Alternatively reload data
            } else {
                showToast({ type: 'error', message: response.message || 'Error al actualizar ficha' });
            }
        } catch {
            showToast({ type: 'error', message: 'Excepción al guardar cambios' });
        } finally {
            setIsSaving(false);
        }
    };

    // Tech & Coord Actions
    const handleActionClick = (type: 'approve_tech' | 'reject_tech' | 'approve_coord' | 'reject_coord') => {
        if (type === 'reject_tech' && !tecnicaObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para rechazar' });
            return;
        }
        if (type === 'approve_coord' && !coordinacionObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para aceptar' });
            return;
        }
        if (type === 'reject_coord' && !coordinacionObs.trim()) {
            showToast({ type: 'warning', message: 'Debe ingresar una observación para solicitar revisión' });
            return;
        }

        const actionConfig = {
            approve_tech: { title: 'Confirmar Aprobación Técnica', message: '¿Está seguro de ACEPTAR esta ficha técnicamente? Esta acción habilitará la ficha para coordinación.' },
            reject_tech: { title: 'Solicitar Revisión Técnica', message: '¿Está seguro de solicitar una REVISIÓN para esta ficha? Volverá al área comercial para su corrección.' },
            approve_coord: { title: 'Confirmar Aprobación Coordinación', message: '¿Está seguro de ACEPTAR esta ficha? Esta acción habilitará la ficha para su programación.' },
            reject_coord: { title: 'Solicitar Revisión Coordinación', message: '¿Está seguro de solicitar una REVISIÓN? La ficha volverá a Comercial para corrección desde inicio.' }
        };

        setConfirmAction({
            type,
            ...actionConfig[type]
        });
        setShowConfirmModal(true);
    };

    const handleDownloadPdf = async () => {
        if (!fichaId) return;
        try {
            const pdfBlob = await fichaService.downloadPdf(fichaId);
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            const fileName = data?.caso_adlab || data?.frecuencia_correlativo || `Ficha_${fichaId}`;
            link.href = url;
            link.setAttribute('download', `${fileName}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch {
            showToast({ type: 'error', message: 'Error al generar el PDF' });
        }
    };

    const processAction = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            switch (confirmAction.type) {
                case 'approve_tech':
                    await fichaService.approve(fichaId, { observaciones: tecnicaObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'success', message: 'Ficha ACEPTADA técnicamente' });
                    break;
                case 'reject_tech':
                    await fichaService.reject(fichaId, { observaciones: tecnicaObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'info', message: 'Revisión solicitada a Comercial' });
                    break;
                case 'approve_coord':
                    await fichaService.approveCoordinacion(fichaId, { observaciones: coordinacionObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'success', message: 'Ficha APROBADA para programación' });
                    break;
                case 'reject_coord':
                    await fichaService.reviewCoordinacion(fichaId, { observaciones: coordinacionObs, user: { id: user?.id || 0 } });
                    showToast({ type: 'info', message: 'Ficha devuelta a Comercial' });
                    break;
            }
            onBack();
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al procesar la ficha' });
        } finally {
            setActionLoading(false);
            setShowConfirmModal(false);
        }
    };

    if (loading && !data) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
                <Spin size="large" />
            </div>
        );
    }

    const statusObj = getStatusProps(data?.estado_ficha);

    // Capabilities
    const canEdit = hasPermission('FI_EDITAR') && !isEditing && [1, 2, 3, 4].includes(Number(data?.id_validaciontecnica));
    const canProcessTech = (hasPermission('FI_APROBAR_TEC') || hasPermission('FI_RECHAZAR_TEC')) && [0, 3, 4].includes(data?.id_validaciontecnica || -1);
    const canProcessCoord = (hasPermission('FI_APROBAR_COO') || hasPermission('FI_RECHAZAR_COO')) && data?.id_validaciontecnica === 1;

    const det = data?.detalles || [];
    const rejected = data?.id_validaciontecnica === 2 || data?.id_validaciontecnica === 4;

    const analisisColumns = [
        { title: 'Análisis', dataIndex: 'nombre_tecnica', render: (_: any, r: any) => <Text strong>{r.nombre_tecnica || r.nombre_determinacion || '-'}</Text> },
        { title: 'Normativa', dataIndex: 'nombre_normativa' },
        { title: 'Tabla / Referencia', dataIndex: 'nombre_normativareferencia', render: (_: any, r: any) => r.nombre_normativareferencia || r.nombre_referencia || '-' },
        { title: 'Tipo Muestra', dataIndex: 'tipo_analisis', render: (_: any, r: any) => r.tipo_analisis || r.nombre_tipomuestra || '-' },
        { title: 'Lím. Min', dataIndex: 'limitemax_d', align: 'right' as const },
        { title: 'Lím. Max', dataIndex: 'limitemax_h', align: 'right' as const },
        { title: 'Error', dataIndex: 'llevaerror', align: 'center' as const, render: (v: any) => (v === 'S' || v === true ? 'Sí' : 'No') },
        { title: 'Entrega', dataIndex: 'nombre_tipoentrega' },
        { title: 'Lab. Principal', dataIndex: 'id_laboratorioensayo', render: (v: any) => getLabName(v) || 'Interno' },
        { title: 'Lab. Secundario', dataIndex: 'id_laboratorioensayo_2', render: (v: any) => getLabName(v) || '-' },
        ...(hasPermission('FI_EXP_VER_UF') ? [{
            title: 'UF', dataIndex: 'uf_individual', align: 'center' as const,
            render: (v: any) => <Text strong style={{ color: 'var(--app-accent-text)' }}>{v > 0 ? Number(v).toFixed(2) : '—'}</Text>,
        }] : []),
    ];
    const analisisRows = det.filter((row: any) => row.tipo_analisis !== 'CostoOperativo');
    const coRow = det.find((r: any) => r.tipo_analisis === 'CostoOperativo');
    const coUF = Number(coRow?.uf_individual || 0);

    const tabIconSize = isVerySmall ? 16 : (isMobile ? 18 : 22);
    const panelPad = isMobile ? 16 : 50;

    return (
        <div>
            <PageHeader
                title={`Ficha N° ${data?.fichaingresoservicio || '-'}${(data?.es_remuestreo === 'S' || data?.es_remuestreo === true || data?.es_remuestreo === 1) ? ` (REMUESTREO DE LA FICHA N° ${data?.id_ficha_original})` : ''}`}
                subtitle={isEditing ? 'Modo Edición' : 'Visor Universal de Ficha'}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: isEditing ? 'Editar Ficha' : 'Ver Ficha' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Tag color={statusObj.color} style={{ fontSize: 13, padding: '4px 10px' }}>{statusObj.label}</Tag>
                        {isEditing ? (
                            <>
                                <Button type="primary" style={{ backgroundColor: '#2f9e44' }} icon={<IconDeviceFloppy size={18} />} onClick={handleSaveChanges} loading={isSaving}>
                                    Guardar
                                </Button>
                                <Button icon={<IconX size={18} />} onClick={() => setShowCancelModal(true)}>
                                    Cancelar
                                </Button>
                            </>
                        ) : (
                            canEdit && (
                                <Button type="primary" icon={<IconEdit size={18} />} onClick={handleEditStart}>
                                    Editar Comercial
                                </Button>
                            )
                        )}
                        <ProtectedContent permission="FI_EXPORTAR_CFI">
                            <Tooltip title={rejected ? 'Atención: esta ficha ha sido rechazada.' : 'Descargar Ficha Técnica'}>
                                <Button
                                    danger={rejected}
                                    icon={<IconFileDownload size={18} />}
                                    onClick={handleDownloadPdf}
                                >
                                    Exportar PDF
                                </Button>
                            </Tooltip>
                        </ProtectedContent>
                    </div>
                }
            />

            <Card styles={{ body: { padding: 0 } }}>
                <div style={{ padding: `${isMobile ? 16 : 24}px ${panelPad}px 0` }}>
                    {(data?.es_remuestreo === 'S' || data?.es_remuestreo === true || data?.es_remuestreo === 1) && data?.id_ficha_original && (
                        <div style={{ marginBottom: 16 }}>
                            <WorkflowAlert
                                type="info"
                                title={`Ficha de Remuestreo — Original: N° ${data.id_ficha_original}`}
                                message="Esta ficha fue generada como remuestreo de la ficha referenciada. Verifique equipos y muestreador originales antes de ejecutar."
                            />
                        </div>
                    )}
                    {[1, 2, 3, 4, 5, 6, 7].includes(Number(data?.id_validaciontecnica)) && (
                        <div style={{ marginBottom: 16 }}>
                            {data.id_validaciontecnica === 3 && <WorkflowAlert type="warning" title="Pendiente Técnica" message="Esta ficha requiere revisión por el Área Técnica." />}
                            {data.id_validaciontecnica === 1 && <WorkflowAlert type="info" title="Pendiente Coordinación" message="Aprobada técnicamente. Revisión de Coordinación pendiente." />}
                            {data.id_validaciontecnica === 2 && <WorkflowAlert type="error" title="Rechazada Técnica" message="Devuelta a Comercial. Requiere correcciones." />}
                            {data.id_validaciontecnica === 4 && <WorkflowAlert type="error" title="Rechazada Coordinación" message="Devuelta a Comercial. Requiere correcciones de inicio." />}
                            {data.id_validaciontecnica === 5 && <WorkflowAlert type="info" title="En Proceso / Programación" message="Ficha con programación activa en terreno." />}
                            {data.id_validaciontecnica === 6 && <WorkflowAlert type="info" title="Aprobada Coordinación" message="Pendiente de ejecución/programación final." />}
                            {data.id_validaciontecnica === 7 && <WorkflowAlert type="error" title="Ficha Cancelada" message="Esta ficha ha sido anulada en el sistema." />}
                        </div>
                    )}
                </div>

                <Tabs
                    activeKey={activeTab}
                    onChange={(v) => { setActiveTab(v); setVisitedTabs(prev => ({ ...prev, [v]: true })); }}
                    centered
                    tabBarStyle={{ margin: '8px 0 0', padding: `0 ${panelPad}px`, borderBottom: '1px solid var(--app-border)' }}
                    items={[
                        {
                            key: 'antecedentes',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isVerySmall ? 12 : (isMobile ? 13.5 : 15), fontWeight: 600 }}><IconClipboardList size={tabIconSize} />{isVerySmall ? 'Antec.' : 'Antecedentes'}</span>,
                            children: (
                                <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px`, minHeight: '70vh' }}>
                                    {isEditing ? (
                                        <AntecedentesForm ref={antecedentesRef} initialData={mappedInitialDataRef.current} />
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                            <FieldGrid>
                                                <StaticField label="Monitoreo" value={data.tipo_fichaingresoservicio} />
                                                <StaticField label="Base Operaciones" value={data.id_lugaranalisis === 0 ? 'No Aplica' : data.nombre_lugaranalisis} />
                                                <StaticField label="Cliente" value={data.nombre_empresa} />
                                                <StaticField label="Empresa Servicio" value={data.nombre_empresaservicios} />
                                            </FieldGrid>

                                            <FieldGrid>
                                                <StaticField label="Fuente Emisora" value={data.nombre_centro} />
                                                <StaticField label="Comuna" value={data.nombre_comuna} />
                                                <StaticField label="Región" value={data.nombre_region} />
                                                <StaticField label="Código Centro" value={data.codigo_centro} />
                                            </FieldGrid>

                                            <FieldGrid>
                                                <StaticField label="Tipo Agua" value={data.nombre_tipoagua || data.tipo_agua} />
                                                <StaticField label="Contacto" value={data.nombre_contacto} />
                                                <StaticField label="E-mail" value={data.email_contacto} />
                                                <StaticField label="Objetivo" value={data.nombre_objetivomuestreo_ma} />
                                            </FieldGrid>

                                            <StaticField label="Tabla / Glosa" value={data.nombre_tabla_largo} />

                                            <FieldGrid>
                                                <StaticField label="Es ETFA" value={data.etfa ? 'Sí' : 'No'} />
                                                <StaticField label="Inspector" value={data.agenda?.nombre_inspector} />
                                                <StaticField label="Punto de Muestreo" value={data.ma_punto_muestreo} span={2} />
                                            </FieldGrid>

                                            <Divider titlePlacement="center" style={{ margin: '4px 0' }}>
                                                <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>Frecuencia y Programación</Text>
                                            </Divider>

                                            <FieldGrid min={160}>
                                                <StaticField label="Frecuencia" value={data.agenda?.frecuencia} />
                                                <StaticField label="Periodo" value={data.agenda?.nombre_frecuencia} />
                                                <StaticField label="Factor" value={data.agenda?.frecuencia_factor} />
                                                <StaticField label="Total Servicios" value={data.agenda?.total_servicios} />
                                            </FieldGrid>
                                            <Text type="secondary" italic style={{ fontSize: 13, textAlign: 'center', display: 'block' }}>
                                                {`Se realizarán ${data.agenda?.total_servicios || '—'} muestreo(s) en total, con una frecuencia de ${data.agenda?.frecuencia || '—'} vez/veces cada periodo ${(data.agenda?.nombre_frecuencia || '—').toLowerCase()}, multiplicado por un factor de ${data.agenda?.frecuencia_factor || '—'}.`}
                                            </Text>

                                            <Divider titlePlacement="center" style={{ margin: '4px 0' }}>
                                                <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>Detalles del Servicio</Text>
                                            </Divider>

                                            <FieldGrid min={180}>
                                                <StaticField label="Componente" value={data.nombre_tipomuestra} />
                                                <StaticField label="Sub Área" value={data.nombre_subarea} />
                                                <StaticField label="Instrumento" value={data.instrumento_ambiental} />
                                            </FieldGrid>

                                            <FieldGrid min={160}>
                                                <StaticField label="Responsable" value={data.responsablemuestreo} />
                                                <StaticField label="Cargo" value={data.nombre_cargo} />
                                                <StaticField label="Tipo Muestreo" value={data.nombre_tipomuestreo} />
                                                <StaticField label="Actividad" value={data.nombre_actividadmuestreo} />
                                            </FieldGrid>

                                            {/* F-24/F-25: Referencia Google Maps + mapa */}
                                            {(data.referencia_googlemaps || (data.ubicacion_lat && data.ubicacion_lon)) && (
                                                <>
                                                    <Divider titlePlacement="center" style={{ margin: '4px 0' }}>
                                                        <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>Ubicación</Text>
                                                    </Divider>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                        {data.referencia_googlemaps && (
                                                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 8, backgroundColor: 'var(--app-hover-bg)', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                                                <Text style={{ fontSize: 13, fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={data.referencia_googlemaps}>
                                                                    {data.referencia_googlemaps}
                                                                </Text>
                                                                <Button size="small" href={data.referencia_googlemaps} target="_blank" rel="noopener noreferrer">
                                                                    Abrir en Google Maps
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {data.ubicacion_lat && data.ubicacion_lon ? (
                                                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, overflow: 'hidden' }}>
                                                                <iframe
                                                                    title="Mapa de la ficha"
                                                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(data.ubicacion_lon) - 0.01},${Number(data.ubicacion_lat) - 0.01},${Number(data.ubicacion_lon) + 0.01},${Number(data.ubicacion_lat) + 0.01}&layer=mapnik&marker=${data.ubicacion_lat},${data.ubicacion_lon}`}
                                                                    width="100%"
                                                                    height="260"
                                                                    style={{ border: 0, display: 'block' }}
                                                                />
                                                                <div style={{ padding: 8, backgroundColor: 'var(--app-hover-bg)' }}>
                                                                    <Text type="secondary" style={{ fontSize: 12 }}>
                                                                        Coordenadas: {data.ubicacion_lat}, {data.ubicacion_lon}
                                                                    </Text>
                                                                </div>
                                                            </div>
                                                        ) : data.referencia_googlemaps ? (
                                                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>
                                                                Coordenadas no resueltas — verifique el link.
                                                            </Text>
                                                        ) : null}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'analisis',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isMobile ? 13.5 : 15, fontWeight: 600 }}><IconFlask size={tabIconSize} />Análisis</span>,
                            children: (
                                <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px` }}>
                                    {isEditing ? (
                                        <AnalysisForm
                                            savedAnalysis={analysisList}
                                            onSavedAnalysisChange={setAnalysisList}
                                            costoOperativo={costoOperativo}
                                            onCostoOperativoChange={setCostoOperativo}
                                        />
                                    ) : (
                                        <div>
                                            <Table
                                                rowKey={(_, i) => String(i)}
                                                columns={analisisColumns}
                                                dataSource={analisisRows}
                                                pagination={false}
                                                scroll={{ x: 1000 }}
                                                summary={() => (
                                                    <Table.Summary.Row style={{ backgroundColor: coUF > 0 ? 'rgba(250,173,20,0.1)' : 'var(--app-hover-bg)' }}>
                                                        <Table.Summary.Cell index={0}>
                                                            <Text strong style={{ color: coUF > 0 ? '#d48806' : 'var(--app-text-secondary)' }}>Costo Operativo</Text>
                                                        </Table.Summary.Cell>
                                                        <Table.Summary.Cell index={1} colSpan={hasPermission('FI_EXP_VER_UF') ? 8 : 9}>
                                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                                {coUF > 0 ? 'Opcional — incluido en esta ficha' : 'Opcional — no aplica para esta ficha'}
                                                            </Text>
                                                        </Table.Summary.Cell>
                                                        {hasPermission('FI_EXP_VER_UF') && (
                                                            <Table.Summary.Cell index={2} align="center">
                                                                <Text strong style={{ color: coUF > 0 ? '#d48806' : 'var(--app-text-secondary)' }}>
                                                                    {coUF > 0 ? Number(coUF).toFixed(2) : 'No aplica'}
                                                                </Text>
                                                            </Table.Summary.Cell>
                                                        )}
                                                    </Table.Summary.Row>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'observaciones',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isVerySmall ? 12 : (isMobile ? 13.5 : 15), fontWeight: 600 }}><IconHistory size={tabIconSize} />{isVerySmall ? 'Historial/Valid.' : 'Validación e Historial'}</span>,
                            children: (
                                <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px`, display: 'flex', flexDirection: 'column', gap: 24 }}>
                                    {isEditing && (
                                        <div style={{ border: '1px solid rgba(47,158,68,0.25)', borderRadius: 10, padding: 16, backgroundColor: 'rgba(47,158,68,0.08)' }}>
                                            <Title level={5} style={{ margin: 0, color: '#2f9e44' }}>Nueva Observación Comercial Requerida</Title>
                                            <Text style={{ fontSize: 12, color: '#2f9e44', display: 'block', marginTop: 4, marginBottom: 8 }}>
                                                Describa los motivos de los cambios realizados comercialmente.
                                            </Text>
                                            <DeferredTextarea value={newObservation} onChange={setNewObservation} placeholder="Describa aquí los cambios..." minRows={3} />
                                        </div>
                                    )}

                                    {!isEditing && canProcessTech && (
                                        <div style={{ border: '1px solid var(--app-accent-bg)', borderRadius: 10, padding: 16, backgroundColor: 'var(--app-accent-bg)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <IconMessageDots size={20} color="var(--app-accent-text)" />
                                                <Title level={5} style={{ margin: 0, color: 'var(--app-accent-text)' }}>Gestión Técnica: Validación</Title>
                                            </div>
                                            <Text style={{ fontSize: 12, color: 'var(--app-accent-text)', display: 'block', margin: '4px 0 8px' }}>
                                                Ingrese sus observaciones técnicas antes de aprobar o solicitar revisión.
                                            </Text>
                                            <DeferredTextarea placeholder="Ingrese sus observaciones técnicas aquí..." value={tecnicaObs} onChange={setTecnicaObs} minRows={3} />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                                                <ProtectedContent permission="FI_APROBAR_TEC">
                                                    <Tooltip title={!allTabsVisited ? 'Debe visualizar todas las pestañas (Antecedentes, Análisis, Historial) antes de probar' : ''}>
                                                        <span>
                                                            <Button type="primary" icon={<IconCheck size={18} />} onClick={() => handleActionClick('approve_tech')} loading={actionLoading} disabled={!allTabsVisited}>
                                                                Aprobar Técnica
                                                            </Button>
                                                        </span>
                                                    </Tooltip>
                                                </ProtectedContent>
                                                <ProtectedContent permission="FI_RECHAZAR_TEC">
                                                    <Button danger icon={<IconRotate size={18} />} onClick={() => handleActionClick('reject_tech')} loading={actionLoading}>
                                                        Pedir Corrección Comercial
                                                    </Button>
                                                </ProtectedContent>
                                            </div>
                                        </div>
                                    )}

                                    {!isEditing && canProcessCoord && (
                                        <div style={{ border: '1px solid rgba(156,54,181,0.2)', borderRadius: 10, padding: 16, backgroundColor: 'rgba(156,54,181,0.08)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <IconMessageDots size={20} color="#9c36b5" />
                                                <Title level={5} style={{ margin: 0, color: '#9c36b5' }}>Gestión Coordinación: Aprobación Logística</Title>
                                            </div>
                                            <Text style={{ fontSize: 12, color: '#9c36b5', display: 'block', margin: '4px 0 8px' }}>
                                                Ingrese comentarios operativos finales antes de habilitar la Ficha para programación y asignación de terreno.
                                            </Text>
                                            <DeferredTextarea placeholder="Ingrese las observaciones de coordinación aquí..." value={coordinacionObs} onChange={setCoordinacionObs} minRows={3} />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                                                <ProtectedContent permission="FI_APROBAR_COO">
                                                    <Tooltip title={!allTabsVisited ? 'Debe visualizar todas las pestañas (Antecedentes, Análisis, Historial) antes de probar' : ''}>
                                                        <span>
                                                            <Button style={{ backgroundColor: '#9c36b5', color: '#fff', border: 'none' }} icon={<IconCheck size={18} />} onClick={() => handleActionClick('approve_coord')} loading={actionLoading} disabled={!allTabsVisited}>
                                                                Aprobar Coordinación
                                                            </Button>
                                                        </span>
                                                    </Tooltip>
                                                </ProtectedContent>
                                                <ProtectedContent permission="FI_RECHAZAR_COO">
                                                    <Button danger icon={<IconRotate size={18} />} onClick={() => handleActionClick('reject_coord')} loading={actionLoading}>
                                                        Devolver a Comercial
                                                    </Button>
                                                </ProtectedContent>
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <Title level={4} style={{ marginBottom: 16 }}>Línea de Tiempo y Validación</Title>
                                        <ObservationTimeline fichaId={fichaId} creationData={timelineCreationData} />
                                    </div>
                                </div>
                            ),
                        },
                    ]}
                />
            </Card>

            <ConfirmModal
                isOpen={showCancelModal}
                title="Descartar cambios"
                message="¿Estás seguro de que deseas cancelar la edición? Los cambios no guardados se perderán."
                onConfirm={() => {
                    setIsEditing(false);
                    setShowCancelModal(false);
                }}
                onCancel={() => setShowCancelModal(false)}
            />

            <ConfirmModal
                isOpen={showConfirmModal}
                title={confirmAction?.title || ''}
                message={confirmAction?.message || ''}
                confirmColor={confirmAction?.type.includes('approve') ? '#10b981' : '#ef4444'}
                onConfirm={processAction}
                onCancel={() => setShowConfirmModal(false)}
            />
        </div>
    );
};
