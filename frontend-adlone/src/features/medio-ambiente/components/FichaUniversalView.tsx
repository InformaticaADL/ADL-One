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

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
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

interface Props {
    fichaId: number;
    onBack: () => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

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
        <Textarea
            value={local}
            onChange={handleChange}
            placeholder={placeholder}
            rows={minRows || 3}
        />
    );
});

const getStatusProps = (status: string): { variant: BadgeVariant; label: string } => {
    const s = (status || '').toUpperCase();
    if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('REVISAR')) return { variant: 'destructive', label: s };
    if (s.includes('COORDINACIÓN')) return { variant: 'default', label: s };
    if (s.includes('PROGRAMACIÓN')) return { variant: 'secondary', label: s };
    if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { variant: 'warning', label: 'PENDIENTE TÉCNICA' };
    if (s.includes('ASIGNAR')) return { variant: 'warning', label: s };
    if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO') || s.includes('EN PROCESO')) return { variant: 'success', label: s };
    return { variant: 'outline', label: s || 'SIN ESTADO' };
};

const gridMinClass: Record<number, string> = {
    200: 'grid-cols-[repeat(auto-fit,minmax(200px,1fr))]',
    180: 'grid-cols-[repeat(auto-fit,minmax(180px,1fr))]',
    160: 'grid-cols-[repeat(auto-fit,minmax(160px,1fr))]',
};

// Grid responsivo genérico para los bloques de campos estáticos — reemplaza
// los SimpleGrid de Mantine con distintos cols={{base,sm,md}} por bloque.
function FieldGrid({ min = 200, children }: { min?: number; children: React.ReactNode }) {
    return (
        <div className={cn('grid gap-3', gridMinClass[min] ?? gridMinClass[200])}>
            {children}
        </div>
    );
}

const SectionDivider: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
    <div className="my-1 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        {children && <span className="shrink-0 text-xs text-muted-foreground">{children}</span>}
        <div className="h-px flex-1 bg-border" />
    </div>
);

const StaticField = ({ label, value, span }: { label: string; value: any; span?: number }) => (
    <div className={span === 2 ? 'col-span-2' : undefined}>
        <span className="block whitespace-nowrap text-[11px] font-bold uppercase text-muted-foreground">
            {label}
        </span>
        <div className="mt-0.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5">
            <span className="block truncate text-[13.5px] font-medium" title={String(value || '-')}>
                {value || '-'}
            </span>
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
            <div className="flex h-[400px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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

    const analisisRows = det.filter((row: any) => row.tipo_analisis !== 'CostoOperativo');
    const coRow = det.find((r: any) => r.tipo_analisis === 'CostoOperativo');
    const coUF = Number(coRow?.uf_individual || 0);
    const showUfColumn = hasPermission('FI_EXP_VER_UF');

    const tabIconSize = isVerySmall ? 16 : (isMobile ? 18 : 22);
    const panelPad = isMobile ? 16 : 50;

    return (
        <div className="shadcn-scope">
            <PageHeader
                title={`Ficha N° ${data?.fichaingresoservicio || '-'}${(data?.es_remuestreo === 'S' || data?.es_remuestreo === true || data?.es_remuestreo === 1) ? ` (REMUESTREO DE LA FICHA N° ${data?.id_ficha_original})` : ''}`}
                subtitle={isEditing ? 'Modo Edición' : 'Visor Universal de Ficha'}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: isEditing ? 'Editar Ficha' : 'Ver Ficha' }
                ]}
                rightSection={
                    <div className="flex flex-wrap items-center gap-2.5">
                        <Badge variant={statusObj.variant} className="px-2.5 py-1 text-[13px]">{statusObj.label}</Badge>
                        {isEditing ? (
                            <>
                                <Button className="bg-success text-success-foreground hover:bg-success/90" onClick={handleSaveChanges} disabled={isSaving}>
                                    {isSaving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                    <IconDeviceFloppy size={18} /> Guardar
                                </Button>
                                <Button variant="outline" onClick={() => setShowCancelModal(true)}>
                                    <IconX size={18} /> Cancelar
                                </Button>
                            </>
                        ) : (
                            canEdit && (
                                <Button onClick={handleEditStart}>
                                    <IconEdit size={18} /> Editar Comercial
                                </Button>
                            )
                        )}
                        <ProtectedContent permission="FI_EXPORTAR_CFI">
                            <Button
                                variant="outline"
                                className={rejected ? 'text-destructive hover:bg-destructive/10 hover:text-destructive' : undefined}
                                title={rejected ? 'Atención: esta ficha ha sido rechazada.' : 'Descargar Ficha Técnica'}
                                onClick={handleDownloadPdf}
                            >
                                <IconFileDownload size={18} /> Exportar PDF
                            </Button>
                        </ProtectedContent>
                    </div>
                }
            />

            <Card className="p-0">
                <div style={{ padding: `${isMobile ? 16 : 24}px ${panelPad}px 0` }}>
                    {(data?.es_remuestreo === 'S' || data?.es_remuestreo === true || data?.es_remuestreo === 1) && data?.id_ficha_original && (
                        <div className="mb-4">
                            <WorkflowAlert
                                type="info"
                                title={`Ficha de Remuestreo — Original: N° ${data.id_ficha_original}`}
                                message="Esta ficha fue generada como remuestreo de la ficha referenciada. Verifique equipos y muestreador originales antes de ejecutar."
                            />
                        </div>
                    )}
                    {[1, 2, 3, 4, 5, 6, 7].includes(Number(data?.id_validaciontecnica)) && (
                        <div className="mb-4">
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
                    value={activeTab}
                    onValueChange={(v) => { setActiveTab(v); setVisitedTabs(prev => ({ ...prev, [v]: true })); }}
                >
                    <div className="mt-2 flex justify-center border-b border-border" style={{ padding: `0 ${panelPad}px` }}>
                        <TabsList className="bg-transparent p-0">
                            <TabsTrigger value="antecedentes" className="gap-1.5 px-3 py-2 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                                <IconClipboardList size={tabIconSize} />{isVerySmall ? 'Antec.' : 'Antecedentes'}
                            </TabsTrigger>
                            <TabsTrigger value="analisis" className="gap-1.5 px-3 py-2 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                                <IconFlask size={tabIconSize} />Análisis
                            </TabsTrigger>
                            <TabsTrigger value="observaciones" className="gap-1.5 px-3 py-2 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                                <IconHistory size={tabIconSize} />{isVerySmall ? 'Historial/Valid.' : 'Validación e Historial'}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="antecedentes" className="mt-0">
                        <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px`, minHeight: '70vh' }}>
                            {isEditing ? (
                                <AntecedentesForm ref={antecedentesRef} initialData={mappedInitialDataRef.current} />
                            ) : (
                                <div className="flex flex-col gap-5">
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

                                    <SectionDivider>Frecuencia y Programación</SectionDivider>

                                    <FieldGrid min={160}>
                                        <StaticField label="Frecuencia" value={data.agenda?.frecuencia} />
                                        <StaticField label="Periodo" value={data.agenda?.nombre_frecuencia} />
                                        <StaticField label="Factor" value={data.agenda?.frecuencia_factor} />
                                        <StaticField label="Total Servicios" value={data.agenda?.total_servicios} />
                                    </FieldGrid>
                                    <p className="block text-center text-sm italic text-muted-foreground">
                                        {`Se realizarán ${data.agenda?.total_servicios || '—'} muestreo(s) en total, con una frecuencia de ${data.agenda?.frecuencia || '—'} vez/veces cada periodo ${(data.agenda?.nombre_frecuencia || '—').toLowerCase()}, multiplicado por un factor de ${data.agenda?.frecuencia_factor || '—'}.`}
                                    </p>

                                    <SectionDivider>Detalles del Servicio</SectionDivider>

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
                                            <SectionDivider>Ubicación</SectionDivider>
                                            <div className="flex flex-col gap-2">
                                                {data.referencia_googlemaps && (
                                                    <div className="flex flex-nowrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-2">
                                                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium" title={data.referencia_googlemaps}>
                                                            {data.referencia_googlemaps}
                                                        </span>
                                                        <Button size="sm" variant="outline" asChild>
                                                            <a href={data.referencia_googlemaps} target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>
                                                        </Button>
                                                    </div>
                                                )}
                                                {data.ubicacion_lat && data.ubicacion_lon ? (
                                                    <div className="overflow-hidden rounded-lg border border-border">
                                                        <iframe
                                                            title="Mapa de la ficha"
                                                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(data.ubicacion_lon) - 0.01},${Number(data.ubicacion_lat) - 0.01},${Number(data.ubicacion_lon) + 0.01},${Number(data.ubicacion_lat) + 0.01}&layer=mapnik&marker=${data.ubicacion_lat},${data.ubicacion_lon}`}
                                                            width="100%"
                                                            height="260"
                                                            className="block border-0"
                                                        />
                                                        <div className="bg-muted/40 p-2">
                                                            <span className="text-xs text-muted-foreground">
                                                                Coordenadas: {data.ubicacion_lat}, {data.ubicacion_lon}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : data.referencia_googlemaps ? (
                                                    <span className="block text-center text-xs text-muted-foreground">
                                                        Coordenadas no resueltas — verifique el link.
                                                    </span>
                                                ) : null}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="analisis" className="mt-0">
                        <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px` }}>
                            {isEditing ? (
                                <AnalysisForm
                                    savedAnalysis={analysisList}
                                    onSavedAnalysisChange={setAnalysisList}
                                    costoOperativo={costoOperativo}
                                    onCostoOperativoChange={setCostoOperativo}
                                />
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Análisis</TableHead>
                                            <TableHead>Normativa</TableHead>
                                            <TableHead>Tabla / Referencia</TableHead>
                                            <TableHead>Tipo Muestra</TableHead>
                                            <TableHead className="text-right">Lím. Min</TableHead>
                                            <TableHead className="text-right">Lím. Max</TableHead>
                                            <TableHead className="text-center">Error</TableHead>
                                            <TableHead>Entrega</TableHead>
                                            <TableHead>Lab. Principal</TableHead>
                                            <TableHead>Lab. Secundario</TableHead>
                                            {showUfColumn && <TableHead className="text-center">UF</TableHead>}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {analisisRows.map((r: any, i: number) => (
                                            <TableRow key={i}>
                                                <TableCell className="font-semibold text-foreground">{r.nombre_tecnica || r.nombre_determinacion || '-'}</TableCell>
                                                <TableCell>{r.nombre_normativa}</TableCell>
                                                <TableCell>{r.nombre_normativareferencia || r.nombre_referencia || '-'}</TableCell>
                                                <TableCell>{r.tipo_analisis || r.nombre_tipomuestra || '-'}</TableCell>
                                                <TableCell className="text-right">{r.limitemax_d}</TableCell>
                                                <TableCell className="text-right">{r.limitemax_h}</TableCell>
                                                <TableCell className="text-center">{r.llevaerror === 'S' || r.llevaerror === true ? 'Sí' : 'No'}</TableCell>
                                                <TableCell>{r.nombre_tipoentrega}</TableCell>
                                                <TableCell>{getLabName(r.id_laboratorioensayo) || 'Interno'}</TableCell>
                                                <TableCell>{getLabName(r.id_laboratorioensayo_2) || '-'}</TableCell>
                                                {showUfColumn && (
                                                    <TableCell className="text-center font-semibold text-primary">
                                                        {r.uf_individual > 0 ? Number(r.uf_individual).toFixed(2) : '—'}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))}
                                        <TableRow className={cn('hover:bg-transparent', coUF > 0 ? 'bg-warning/10' : 'bg-muted/40')}>
                                            <TableCell>
                                                <span className={cn('font-semibold', coUF > 0 ? 'text-warning' : 'text-muted-foreground')}>Costo Operativo</span>
                                            </TableCell>
                                            <TableCell colSpan={showUfColumn ? 8 : 9}>
                                                <span className="text-xs text-muted-foreground">
                                                    {coUF > 0 ? 'Opcional — incluido en esta ficha' : 'Opcional — no aplica para esta ficha'}
                                                </span>
                                            </TableCell>
                                            {showUfColumn && (
                                                <TableCell className="text-center">
                                                    <span className={cn('font-semibold', coUF > 0 ? 'text-warning' : 'text-muted-foreground')}>
                                                        {coUF > 0 ? Number(coUF).toFixed(2) : 'No aplica'}
                                                    </span>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="observaciones" className="mt-0">
                        <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px` }}>
                            <div className="flex flex-col gap-6">
                                {isEditing && (
                                    <div className="rounded-[10px] border border-success/25 bg-success/10 p-4">
                                        <h5 className="m-0 text-sm font-semibold text-success">Nueva Observación Comercial Requerida</h5>
                                        <span className="mb-2 mt-1 block text-xs text-success">
                                            Describa los motivos de los cambios realizados comercialmente.
                                        </span>
                                        <DeferredTextarea value={newObservation} onChange={setNewObservation} placeholder="Describa aquí los cambios..." minRows={3} />
                                    </div>
                                )}

                                {!isEditing && canProcessTech && (
                                    <div className="rounded-[10px] border border-primary/20 bg-primary/5 p-4">
                                        <div className="flex items-center gap-2">
                                            <IconMessageDots size={20} className="text-primary" />
                                            <h5 className="m-0 text-sm font-semibold text-primary">Gestión Técnica: Validación</h5>
                                        </div>
                                        <span className="my-1 mb-2 block text-xs text-primary">
                                            Ingrese sus observaciones técnicas antes de aprobar o solicitar revisión.
                                        </span>
                                        <DeferredTextarea placeholder="Ingrese sus observaciones técnicas aquí..." value={tecnicaObs} onChange={setTecnicaObs} minRows={3} />
                                        <div className="mt-4 flex justify-end gap-2.5">
                                            <ProtectedContent permission="FI_APROBAR_TEC">
                                                <span title={!allTabsVisited ? 'Debe visualizar todas las pestañas (Antecedentes, Análisis, Historial) antes de probar' : undefined}>
                                                    <Button onClick={() => handleActionClick('approve_tech')} disabled={!allTabsVisited || actionLoading}>
                                                        {actionLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                                        <IconCheck size={18} /> Aprobar Técnica
                                                    </Button>
                                                </span>
                                            </ProtectedContent>
                                            <ProtectedContent permission="FI_RECHAZAR_TEC">
                                                <Button variant="destructive" onClick={() => handleActionClick('reject_tech')} disabled={actionLoading}>
                                                    {actionLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                                    <IconRotate size={18} /> Pedir Corrección Comercial
                                                </Button>
                                            </ProtectedContent>
                                        </div>
                                    </div>
                                )}

                                {!isEditing && canProcessCoord && (
                                    <div className="rounded-[10px] border border-violet-500/20 bg-violet-500/5 p-4">
                                        <div className="flex items-center gap-2">
                                            <IconMessageDots size={20} className="text-violet-600" />
                                            <h5 className="m-0 text-sm font-semibold text-violet-600">Gestión Coordinación: Aprobación Logística</h5>
                                        </div>
                                        <span className="my-1 mb-2 block text-xs text-violet-600">
                                            Ingrese comentarios operativos finales antes de habilitar la Ficha para programación y asignación de terreno.
                                        </span>
                                        <DeferredTextarea placeholder="Ingrese las observaciones de coordinación aquí..." value={coordinacionObs} onChange={setCoordinacionObs} minRows={3} />
                                        <div className="mt-4 flex justify-end gap-2.5">
                                            <ProtectedContent permission="FI_APROBAR_COO">
                                                <span title={!allTabsVisited ? 'Debe visualizar todas las pestañas (Antecedentes, Análisis, Historial) antes de probar' : undefined}>
                                                    <Button className="bg-violet-500 text-white hover:bg-violet-600" onClick={() => handleActionClick('approve_coord')} disabled={!allTabsVisited || actionLoading}>
                                                        {actionLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                                        <IconCheck size={18} /> Aprobar Coordinación
                                                    </Button>
                                                </span>
                                            </ProtectedContent>
                                            <ProtectedContent permission="FI_RECHAZAR_COO">
                                                <Button variant="destructive" onClick={() => handleActionClick('reject_coord')} disabled={actionLoading}>
                                                    {actionLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                                    <IconRotate size={18} /> Devolver a Comercial
                                                </Button>
                                            </ProtectedContent>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="mb-4 text-lg font-semibold">Línea de Tiempo y Validación</h4>
                                    <ObservationTimeline fichaId={fichaId} creationData={timelineCreationData} />
                                </div>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
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
