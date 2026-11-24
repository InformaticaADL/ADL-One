import React, { useEffect, useState, useRef, useMemo } from 'react';
import { PuntosVisitaTabla, MatrizPrecioVisita, useDatosVisita } from './PuntosVisitaPanel';
import { EditarVisitaView } from './EditarVisitaView';
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
import { useNavStore } from '../../../store/navStore';
import { ProgramacionEjecucion, type ProgramacionFicha, type ServicioProgramado } from './ProgramacionEjecucion';
import { estadoVisible, estaCompletada } from '../utils/avanceFicha';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { catalogosService } from '../services/catalogos.service';
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
    IconFileDownload,
    IconListDetails,
    IconCalendarEvent
} from '@tabler/icons-react';

interface Props {
    fichaId: number;
    onBack: () => void;
    // Si se entrega, en una visita con varios puntos se muestra el selector de punto y se aprueba toda la visita de una vez.
    onCambiarFicha?: (id: number) => void;
}

type ModoObs = 'sin' | 'texto' | null;

// Observación de una validación: o se marca «Sin observaciones» o se elige «Ingresar observación» y aparece el campo.
const SelectorObservacion = ({ modo, onModo, texto, onTexto, placeholder, permiteSin = true }: {
    modo: ModoObs; onModo: (m: ModoObs) => void; texto: string; onTexto: (t: string) => void; placeholder: string; permiteSin?: boolean;
}) => (
    <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {permiteSin && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                    <Checkbox checked={modo === 'sin'} onCheckedChange={(v) => onModo(v === true ? 'sin' : null)} />
                    Sin observaciones
                </label>
            )}
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <Checkbox checked={modo === 'texto'} onCheckedChange={(v) => onModo(v === true ? 'texto' : null)} />
                Ingresar observación
            </label>
        </div>
        {modo === 'texto' && <DeferredTextarea placeholder={placeholder} value={texto} onChange={onTexto} minRows={3} />}
    </div>
);

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'info' | 'destructive';

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
    if (s.includes('COMPLETADA')) return { variant: 'success', label: s };
    if (s.includes('RECHAZADA') || s.includes('CANCELADO') || s.includes('REVISAR')) return { variant: 'destructive', label: s };
    if (s.includes('COORDINACIÓN')) return { variant: 'info', label: s };
    if (s.includes('PROGRAMACIÓN')) return { variant: 'secondary', label: s };
    if (s.includes('PENDIENTE') || s.includes('ÁREA TÉCNICA')) return { variant: 'warning', label: 'PENDIENTE TÉCNICA' };
    if (s.includes('ASIGNAR')) return { variant: 'warning', label: s };
    if (s.includes('EN PROCESO')) return { variant: 'info', label: s };
    if (s.includes('VIGENTE') || s.includes('APROBADA') || s.includes('EJECUTADO')) return { variant: 'success', label: s };
    return { variant: 'outline', label: s || 'SIN ESTADO' };
};

// Datos de solo lectura: etiqueta chica arriba y el valor completo debajo (sin cortarlo con «…»).
const Dato = ({ label, value, ancho }: { label: string; value: any; ancho?: boolean }) => (
    <div className={cn('min-w-0', ancho && 'sm:col-span-2')}>
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium leading-snug text-foreground">
            {value === undefined || value === null || String(value).trim() === '' ? <span className="font-normal text-muted-foreground">—</span> : value}
        </dd>
    </div>
);

// Bloque con título para agrupar datos relacionados; los datos van en dos columnas cuando hay espacio.
const Seccion = ({ titulo, children, pie, className }: { titulo: string; children: React.ReactNode; pie?: React.ReactNode; className?: string }) => (
    <section className={cn('rounded-xl border border-border bg-card p-4 md:p-5', className)}>
        <h3 className="mb-3.5 border-b border-border pb-2 text-[13px] font-semibold text-foreground">{titulo}</h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3.5 sm:grid-cols-2">{children}</dl>
        {pie}
    </section>
);

export const FichaUniversalView: React.FC<Props> = ({ fichaId, onBack, onCambiarFicha }) => {
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const auth = useAuth();
    const { hasPermission, user } = auth;
    const isMobile = useMediaQuery('(max-width: 500px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');

    const [loading, setLoading] = useState(true);
    // Visita con varios puntos: todos sus puntos a un clic y aprobación de toda la visita de una vez
    const [grupo, setGrupo] = useState<{ total: number; puntos: { id_fichaingresoservicio: number; punto: string; estado: string }[] } | null>(null);
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
    // Cancelar la ficha completa (p. ej. una ficha creada dos veces)
    const [showCancelarFicha, setShowCancelarFicha] = useState(false);
    const [confirmarEditar, setConfirmarEditar] = useState(false);
    const [motivosFicha, setMotivosFicha] = useState<any[]>([]);
    const [motivoFichaId, setMotivoFichaId] = useState('');
    const [obsCancelarFicha, setObsCancelarFicha] = useState('');
    const [cancelandoFicha, setCancelandoFicha] = useState(false);
    useEffect(() => {
        if (!showCancelarFicha) return;
        setMotivoFichaId(''); setObsCancelarFicha('');
        catalogosService.getMotivosCancelacionFicha().then((m) => setMotivosFicha(m || [])).catch(() => setMotivosFicha([]));
    }, [showCancelarFicha]);

    // Observations for actions
    const [newObservation, setNewObservation] = useState(''); // Comercial
    const [tecnicaObs, setTecnicaObs] = useState(''); // Técnica
    const [coordinacionObs, setCoordinacionObs] = useState(''); // Coordinación
    // Cómo se declara la observación de la validación: «sin observaciones» o con texto (nada elegido = falta decidir)
    const [modoObsTec, setModoObsTec] = useState<ModoObs>(null);
    const [modoObsCoord, setModoObsCoord] = useState<ModoObs>(null);
    const textoObs = (modo: ModoObs, texto: string) => (modo === 'sin' ? 'Sin observaciones.' : texto.trim());

    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [confirmAction, setConfirmAction] = useState<{
        type: 'approve_tech' | 'reject_tech' | 'approve_coord' | 'reject_coord';
        title: string;
        message: string;
    } | null>(null);

    useEffect(() => {
        // Si la ficha nueva es otro punto de la misma visita, la visita se conserva mientras se vuelve a leer: borrarla hacía que la pantalla
        // dejara de ser «de visita» un instante (parpadeo), se recargaran todos los puntos y la selección volviera a «Todos».
        setGrupo((prev) => (prev && prev.puntos.some((p) => Number(p.id_fichaingresoservicio) === Number(fichaId)) ? prev : null));
        if (!fichaId) return;
        let cancelado = false;
        fichaService.getGrupo(fichaId)
            .then((resp: any) => { if (!cancelado) { const g = resp?.data ?? null; setGrupo(g && g.total > 1 ? g : null); } })
            .catch(() => { /* sin grupo: la ficha se aprueba sola */ });
        return () => { cancelado = true; };
    }, [fichaId]);
    const esVisita = !!grupo && grupo.total > 1;

    // Programación y ejecución de la ficha (un renglón por servicio). Se vuelve a leer al cambiar de ficha.
    const [programacion, setProgramacion] = useState<ProgramacionFicha | null>(null);
    const [cargandoProg, setCargandoProg] = useState(false);
    const [errorProg, setErrorProg] = useState(false);
    const [reintentoProg, setReintentoProg] = useState(0);
    useEffect(() => {
        if (!fichaId) return;
        let cancelado = false;
        setCargandoProg(true); setErrorProg(false);
        fichaService.getProgramacion(fichaId)
            .then((p: ProgramacionFicha) => { if (!cancelado) setProgramacion(p ?? null); })
            .catch(() => { if (!cancelado) { setProgramacion(null); setErrorProg(true); } })
            .finally(() => { if (!cancelado) setCargandoProg(false); });
        return () => { cancelado = true; };
    }, [fichaId, reintentoProg]);
    const { setSelectedFicha, setActiveSubmodule } = useNavStore();
    const puedeAbrirMuestreo = hasPermission(['MA_COMERCIAL_HISTORIAL_DETALLE', 'FI_VER', 'FI_APROBAR_TEC', 'FI_APROBAR_COO']);
    const abrirMuestreo = (s: ServicioProgramado) => { setSelectedFicha(Number(fichaId), s.correlativo); setActiveSubmodule('ma-ficha-detalle'); };
    // Datos de todos los puntos de la visita (se leen una vez y los usan la pestaña de puntos y la de análisis y precio).
    const [versionPuntos, setVersionPuntos] = useState(0);
    const datosVisita = useDatosVisita(esVisita && grupo ? grupo.puntos : [], versionPuntos);
    // «Editar visita»: pantalla por pasos como la de crear la visita (Antecedentes y Puntos y análisis)
    const [editarVisita, setEditarVisita] = useState(false);

    // Pestaña de análisis de una visita: «todos» (matriz con el precio de cada punto) o el detalle de un punto.
    const [analisisModo, setAnalisisModo] = useState<'todos' | 'punto'>('todos');
    const visitaYaAbierta = useRef<number | null>(null);
    useEffect(() => {
        const idGrupo = (grupo as any)?.id_grupo ?? null;
        if (esVisita && idGrupo !== visitaYaAbierta.current) {
            visitaYaAbierta.current = idGrupo ?? -1;
            setAnalisisModo('todos');
            setVisitedTabs((prev) => ({ ...prev, puntos: true } as any));
        }
        if (!esVisita) visitaYaAbierta.current = null;
    }, [esVisita, grupo]);

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
        if (!fichaId) return;
        if (!antecedentesRef.current) {
            showToast({ type: 'error', message: 'No se pudo leer el formulario de antecedentes. Intente nuevamente.' });
            return;
        }

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

    // Después de editar la visita: vuelve a la vista de la visita y se lee de nuevo todo (puntos, antecedentes, estado).
    const alGuardarVisita = async () => {
        setEditarVisita(false);
        try {
            const g = (await fichaService.getGrupo(fichaId))?.data ?? null;
            setGrupo(g && g.total > 1 ? g : null);
        } catch { /* la visita se vuelve a leer al entrar de nuevo */ }
        setVersionPuntos((v) => v + 1);
        loadData();
    };

    // Tech & Coord Actions
    const handleActionClick = (type: 'approve_tech' | 'reject_tech' | 'approve_coord' | 'reject_coord') => {
        const esTec = type === 'approve_tech' || type === 'reject_tech';
        const modo = esTec ? modoObsTec : modoObsCoord;
        const texto = esTec ? tecnicaObs : coordinacionObs;
        const rechaza = type === 'reject_tech' || type === 'reject_coord';
        if (!modo) {
            showToast({ type: 'warning', message: rechaza ? 'Marque «Ingresar observación» y explique el motivo.' : 'Elija «Sin observaciones» o «Ingresar observación» antes de continuar.' });
            return;
        }
        if (rechaza && modo === 'sin') {
            showToast({ type: 'warning', message: 'Para solicitar una corrección debe ingresar una observación con el motivo.' });
            return;
        }
        if (modo === 'texto' && !texto.trim()) {
            showToast({ type: 'warning', message: 'Escriba la observación o marque «Sin observaciones».' });
            return;
        }

        const todaLaVisita = esVisita;
        const actionConfig = {
            approve_tech: { title: 'Confirmar Aprobación Técnica', message: '¿Está seguro de ACEPTAR esta ficha técnicamente? Esta acción habilitará la ficha para coordinación.' },
            reject_tech: { title: 'Solicitar Revisión Técnica', message: todaLaVisita ? `¿Está seguro de devolver los ${grupo!.total} puntos de la VISITA a Comercial para su corrección?` : '¿Está seguro de solicitar una REVISIÓN para esta ficha? Volverá al área comercial para su corrección.' },
            approve_coord: { title: 'Confirmar Aprobación Coordinación', message: '¿Está seguro de ACEPTAR esta ficha? Esta acción habilitará la ficha para su programación.' },
            reject_coord: { title: 'Solicitar Revisión Coordinación', message: todaLaVisita ? `¿Está seguro de devolver los ${grupo!.total} puntos de la VISITA a Comercial para corrección desde inicio?` : '¿Está seguro de solicitar una REVISIÓN? La ficha volverá a Comercial para corrección desde inicio.' }
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

    // Aprobar toda la visita puede dejar puntos sin aprobar (cada uno se aprueba por separado): se avisa cuáles y por qué, no solo "éxito"
    const avisarResultadoVisita = (r: any, textoOk: string, clave: 'aprobados' | 'rechazados' = 'aprobados') => {
        const aprobados = r?.[clave]?.length ?? 0;
        const fallidos: { id: number; error: string }[] = r?.fallidos ?? [];
        if (fallidos.length === 0) {
            showToast({ type: 'success', message: `Visita ${textoOk} (${aprobados} puntos)` });
            return;
        }
        showToast({
            type: 'error',
            message: `Se ${clave === 'aprobados' ? 'aprobaron' : 'devolvieron'} ${aprobados} de ${r?.total ?? aprobados + fallidos.length} puntos. No se pudo ${clave === 'aprobados' ? 'aprobar' : 'devolver'}: ${fallidos.map((x) => `ficha ${x.id} (${x.error})`).join('; ')}`,
        });
    };

    const processAction = async () => {
        if (!confirmAction) return;
        setActionLoading(true);
        try {
            switch (confirmAction.type) {
                case 'approve_tech':
                    if (esVisita) {
                        const r = (await fichaService.aprobarVisita(fichaId, 'tecnica', { observaciones: textoObs(modoObsTec, tecnicaObs), user: { id: user?.id || 0 } }))?.data;
                        avisarResultadoVisita(r, 'ACEPTADA técnicamente');
                    } else {
                        await fichaService.approve(fichaId, { observaciones: textoObs(modoObsTec, tecnicaObs), user: { id: user?.id || 0 } });
                        showToast({ type: 'success', message: 'Ficha ACEPTADA técnicamente' });
                    }
                    break;
                case 'reject_tech':
                    if (esVisita) {
                        const r = (await fichaService.rechazarVisita(fichaId, 'tecnica', { observaciones: textoObs(modoObsTec, tecnicaObs), user: { id: user?.id || 0 } }))?.data;
                        avisarResultadoVisita(r, 'DEVUELTA a Comercial', 'rechazados');
                    } else {
                        await fichaService.reject(fichaId, { observaciones: textoObs(modoObsTec, tecnicaObs), user: { id: user?.id || 0 } });
                        showToast({ type: 'info', message: 'Revisión solicitada a Comercial' });
                    }
                    break;
                case 'approve_coord':
                    if (esVisita) {
                        const r = (await fichaService.aprobarVisita(fichaId, 'coordinacion', { observaciones: textoObs(modoObsCoord, coordinacionObs), user: { id: user?.id || 0 } }))?.data;
                        avisarResultadoVisita(r, 'APROBADA para programación');
                    } else {
                        await fichaService.approveCoordinacion(fichaId, { observaciones: textoObs(modoObsCoord, coordinacionObs), user: { id: user?.id || 0 } });
                        showToast({ type: 'success', message: 'Ficha APROBADA para programación' });
                    }
                    break;
                case 'reject_coord':
                    if (esVisita) {
                        const r = (await fichaService.rechazarVisita(fichaId, 'coordinacion', { observaciones: textoObs(modoObsCoord, coordinacionObs), user: { id: user?.id || 0 } }))?.data;
                        avisarResultadoVisita(r, 'DEVUELTA a Comercial', 'rechazados');
                    } else {
                        await fichaService.reviewCoordinacion(fichaId, { observaciones: textoObs(modoObsCoord, coordinacionObs), user: { id: user?.id || 0 } });
                        showToast({ type: 'info', message: 'Ficha devuelta a Comercial' });
                    }
                    break;
            }
            onBack();
        } catch (error: any) {
            console.error(error);
            // Se muestra el motivo que da el servidor (por ejemplo, «falta la firma del observador»), no un error genérico.
            showToast({ type: 'error', message: error?.response?.data?.message || 'Error al procesar la ficha' });
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

    // La ficha no se pudo leer (por ejemplo, fue eliminada y alguien abrió un aviso o un enlace antiguo): se avisa en vez de romper la pantalla.
    if (!data) {
        return (
            <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
                <p className="m-0 text-lg font-semibold">Esta ficha ya no existe</p>
                <p className="m-0 max-w-md text-sm text-muted-foreground">No se pudo cargar la ficha N° {fichaId}. Puede haber sido eliminada o cancelada. Si abriste un aviso antiguo, ya no hay nada que ver aquí.</p>
                <Button variant="outline" onClick={onBack}>Volver</Button>
            </div>
        );
    }

    if (editarVisita && (grupo || data)) {
        return <EditarVisitaView fichaId={fichaId} grupo={esVisita && grupo ? grupo : { total: 1, puntos: [{ id_fichaingresoservicio: Number(fichaId), punto: String(data?.ma_punto_muestreo || ''), estado: String(data?.estado_ficha || '') }] }} data={data} onVolver={() => setEditarVisita(false)} onGuardado={alGuardarVisita} />;
    }

    const statusObj = getStatusProps(estadoVisible(data?.estado_ficha, estaCompletada(programacion?.resumen ?? null) ? programacion!.resumen : null));

    // Capabilities
    const canEdit = hasPermission('FI_EDITAR') && !isEditing && [1, 2, 3, 4, 5, 6].includes(Number(data?.id_validaciontecnica));
    const canProcessTech = (hasPermission('FI_APROBAR_TEC') || hasPermission('FI_RECHAZAR_TEC')) && [0, 3, 4].includes(data?.id_validaciontecnica || -1);
    const canProcessCoord = (hasPermission('FI_APROBAR_COO') || hasPermission('FI_RECHAZAR_COO')) && data?.id_validaciontecnica === 1;
    // Una ficha ya aprobada (p. ej. creada por carga masiva) que aún no se programa: Coordinación puede devolverla a Comercial para que la edite.
    const canDevolverCoord = hasPermission('FI_RECHAZAR_COO') && data?.id_validaciontecnica === 6;
    // Editar una ficha que ya avanzó de etapa la devuelve a validación técnica: se pide confirmación.
    const edicionConfirma = [1, 5, 6].includes(Number(data?.id_validaciontecnica));

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
                title={esVisita
                    ? `Visita · ${data?.nombre_centro || 'Sin centro'}`
                    : `Ficha N° ${data?.fichaingresoservicio || '-'}${(data?.es_remuestreo === 'S' || data?.es_remuestreo === true || data?.es_remuestreo === 1) ? ` (REMUESTREO DE LA FICHA N° ${data?.id_ficha_original})` : ''}`}
                subtitle={isEditing ? 'Modo Edición' : (esVisita
                    ? `${grupo!.total} puntos · ${data?.nombre_empresaservicios || data?.nombre_empresa || ''}`
                    : [data?.nombre_empresaservicios || data?.nombre_empresa, data?.nombre_centro].filter(Boolean).join(' · ') || 'Ficha de ingreso')}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: isEditing ? 'Editar Ficha' : (esVisita ? 'Visita' : 'Ficha') }
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
                                <Button onClick={() => (edicionConfirma ? setConfirmarEditar(true) : setEditarVisita(true))}>
                                    <IconEdit size={18} /> {esVisita ? 'Editar visita' : 'Editar ficha'}
                                </Button>
                            )
                        )}
                        {!isEditing && ![7, 8].includes(Number(data?.id_validaciontecnica)) && (
                            <ProtectedContent permission={['FI_EDITAR', 'MA_CALENDARIO_CANCELAR']}>
                                <Button
                                    variant="outline"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    title={esVisita ? 'Cancelar la visita completa con un motivo (por ejemplo, si está duplicada). No se borra nada.' : 'Cancelar la ficha con un motivo (por ejemplo, si está duplicada). No se borra nada.'}
                                    onClick={() => setShowCancelarFicha(true)}
                                >
                                    <IconX size={18} /> {esVisita ? 'Cancelar visita' : 'Cancelar ficha'}
                                </Button>
                            </ProtectedContent>
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
                            {esVisita && !isEditing && onCambiarFicha && (
                                <TabsTrigger value="puntos" className="gap-1.5 px-3 py-2 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                                    <IconListDetails size={tabIconSize} />Puntos
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="analisis" className="gap-1.5 px-3 py-2 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                                <IconFlask size={tabIconSize} />{esVisita && showUfColumn ? 'Análisis y precio' : 'Análisis'}
                            </TabsTrigger>
                            {!isEditing && (
                                <TabsTrigger value="programacion" className="gap-1.5 px-3 py-2 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                                    <IconCalendarEvent size={tabIconSize} />{isVerySmall ? 'Prog.' : 'Programación'}
                                </TabsTrigger>
                            )}
                            <TabsTrigger value="observaciones" className="gap-1.5 px-3 py-2 text-sm font-semibold data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                                <IconHistory size={tabIconSize} />{isVerySmall ? 'Historial/Valid.' : 'Validación e Historial'}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    {/* forceMount: Radix desmonta el contenido de los tabs inactivos por defecto, lo
                        que borraba antecedentesRef (useImperativeHandle de AntecedentesForm) apenas el
                        usuario se movía a otra pestaña — Guardar quedaba sin efecto desde Análisis u
                        Observaciones porque el ref ya era null. Se mantiene montado y solo se oculta
                        con CSS mientras no es la pestaña activa. */}
                    {esVisita && !isEditing && onCambiarFicha && (
                        <TabsContent value="puntos" className="mt-0">
                            <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px` }}>
                                <PuntosVisitaTabla puntos={grupo!.puntos} activoId={fichaId} onCambiar={onCambiarFicha} datos={datosVisita} verPrecios={showUfColumn} />
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="antecedentes" className="mt-0 data-[state=inactive]:hidden" forceMount>
                        <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px`, minHeight: '70vh' }}>
                            {isEditing ? (
                                <AntecedentesForm ref={antecedentesRef} initialData={mappedInitialDataRef.current} />
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {(() => {
                                        const coord = String(data.ma_coordenadas || '').trim();
                                        const m = coord.match(/^(.*?) UTM ([\d.,]*)E ([\d.,]*)S/);
                                        const zona = m ? m[1] : coord;
                                        const noCaudal = !data.medicion_caudal || /no\s*aplica/i.test(String(data.medicion_caudal));
                                        const medida = (n: any, u: any) => [n, u].filter((x) => x !== undefined && x !== null && String(x).trim() !== '').join(' ');
                                        const hayOtraDireccion = data.ubicacion && String(data.ubicacion).trim() !== String(data.direccion_centro || '').trim();
                                        return (
                                            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
                                                <div className="flex flex-col gap-4">
                                                    <Seccion titulo="Servicio">
                                                        <Dato label="Monitoreo agua/RIL" value={data.tipo_fichaingresoservicio} />
                                                        <Dato label="Objetivo" value={data.nombre_objetivomuestreo_ma} />
                                                        <Dato label="Tipo de agua" value={data.nombre_tipoagua || data.tipo_agua} />
                                                        <Dato label="Base de operaciones" value={data.id_lugaranalisis === 0 ? 'No aplica' : data.nombre_lugaranalisis} />
                                                        <Dato label="Es ETFA" value={data.etfa === 'S' ? 'Sí' : 'No'} />
                                                        <Dato label="Inspector" value={data.agenda?.nombre_inspector} />
                                                        <Dato label="Tabla / Glosa" value={data.nombre_tabla_largo} ancho />
                                                        {!esVisita && <Dato label="Punto de muestreo" value={data.ma_punto_muestreo} ancho />}
                                                    </Seccion>

                                                    <Seccion
                                                        titulo="Frecuencia y programación"
                                                        pie={(
                                                            <p className="mt-3.5 rounded-lg bg-muted/50 px-3 py-2 text-xs italic leading-relaxed text-muted-foreground">
                                                                {`Se realizarán ${data.agenda?.total_servicios || '—'} muestreo(s) en total, con una frecuencia de ${data.agenda?.frecuencia || '—'} vez/veces cada periodo ${(data.agenda?.nombre_frecuencia || '—').toLowerCase()}, multiplicado por un factor de ${data.agenda?.frecuencia_factor || '—'}.`}
                                                            </p>
                                                        )}
                                                    >
                                                        <Dato label="Frecuencia" value={data.agenda?.frecuencia} />
                                                        <Dato label="Periodo" value={data.agenda?.nombre_frecuencia} />
                                                        <Dato label="Factor" value={data.agenda?.frecuencia_factor} />
                                                        <Dato label="Total de servicios" value={data.agenda?.total_servicios} />
                                                    </Seccion>

                                                    <Seccion titulo="Responsable del muestreo">
                                                        <Dato label="Responsable" value={data.responsablemuestreo} />
                                                        <Dato label="Cargo" value={data.nombre_cargo} />
                                                        <Dato label="Tipo de muestreo" value={data.nombre_tipomuestreo} />
                                                        <Dato label="Actividad" value={data.nombre_actividadmuestreo} />
                                                    </Seccion>
                                                </div>

                                                <div className="flex flex-col gap-4">
                                                    <Seccion titulo="Cliente y centro">
                                                        <Dato label="Empresa a facturar" value={data.nombre_empresa} />
                                                        <Dato label="Empresa de servicio" value={data.nombre_empresaservicios} />
                                                        <Dato label="Fuente emisora" value={data.nombre_centro} />
                                                        <Dato label="Código del centro" value={data.codigo_centro} />
                                                        <Dato label="Comuna" value={data.nombre_comuna} />
                                                        <Dato label="Región" value={data.nombre_region} />
                                                        {/* La dirección del centro es la del maestro de centros. Si la ficha trae otra escrita a mano, se muestra aparte. */}
                                                        <Dato label="Dirección del centro" value={data.direccion_centro || 'Sin dirección registrada'} ancho />
                                                        {hayOtraDireccion && <Dato label="Ubicación / Dirección indicada en la ficha" value={data.ubicacion} ancho />}
                                                    </Seccion>

                                                    <Seccion titulo="Contacto">
                                                        <Dato label="Contacto" value={data.nombre_contacto} />
                                                        <Dato label="Correo electrónico" value={data.email_contacto} />
                                                    </Seccion>

                                                    <Seccion titulo="Detalles del servicio y del muestreo">
                                                        <Dato label="Componente" value={data.nombre_tipomuestra} />
                                                        <Dato label="Sub área" value={data.nombre_subarea} />
                                                        <Dato label="Instrumento ambiental" value={data.instrumento_ambiental} />
                                                        <Dato label="Tipo de muestra" value={data.nombre_tipomuestra_ma} />
                                                        <Dato label="Tipo de descarga" value={data.nombre_tipodescarga} />
                                                        {String(data.tipo_fichaingresoservicio || '').toLowerCase() !== 'puntual' && (
                                                            <Dato label="Duración del muestreo" value={data.ma_duracion_muestreo ? `${data.ma_duracion_muestreo} h` : ''} />
                                                        )}
                                                    </Seccion>

                                                    <Seccion titulo="Medición de caudal">
                                                        <Dato label="Medición de caudal" value={data.medicion_caudal || 'No aplica'} />
                                                        {!noCaudal && <Dato label="Modalidad" value={data.nombre_modalidad} />}
                                                        {!noCaudal && <Dato label="Forma del canal" value={data.nombre_formacanal ? medida(data.nombre_formacanal, '') + (data.formacanal_medida ? ` · ${medida(data.formacanal_medida, data.nombre_um_formacanal)}` : '') : ''} />}
                                                        {!noCaudal && <Dato label="Dispositivo hidráulico" value={data.nombre_dispositivohidraulico ? medida(data.nombre_dispositivohidraulico, '') + (data.dispositivohidraulico_medida ? ` · ${medida(data.dispositivohidraulico_medida, data.nombre_um_dispositivohidraulico)}` : '') : ''} />}
                                                    </Seccion>

                                                    {!esVisita && (
                                                        <Seccion titulo="Ubicación del punto">
                                                            <Dato label="Zona UTM" value={zona || 'Sin zona'} />
                                                            <Dato label="UTM Norte" value={m?.[2]} />
                                                            <Dato label="UTM Este" value={m?.[3]} />
                                                        </Seccion>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* F-24/F-25: Referencia Google Maps + mapa */}
                                    {!esVisita && (data.referencia_googlemaps || (data.ubicacion_lat && data.ubicacion_lon)) && (
                                        <section className="rounded-xl border border-border bg-card p-4 md:p-5">
                                            <h3 className="mb-3.5 border-b border-border pb-2 text-[13px] font-semibold text-foreground">Ubicación</h3>
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
                                        </section>
                                    )}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    {!isEditing && (
                        <TabsContent value="programacion" className="mt-0">
                            <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px` }}>
                                <ProgramacionEjecucion
                                    programacion={programacion}
                                    cargando={cargandoProg}
                                    error={errorProg}
                                    visita={esVisita ? { punto: String(data?.ma_punto_muestreo || '').trim(), puntos: grupo!.total } : null}
                                    puedeAbrir={puedeAbrirMuestreo}
                                    onAbrir={abrirMuestreo}
                                    onReintentar={() => setReintentoProg((n) => n + 1)}
                                />
                            </div>
                        </TabsContent>
                    )}

                    <TabsContent value="analisis" className="mt-0">
                        <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPad}px` }}>
                            {esVisita && !isEditing && onCambiarFicha && (
                                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                                    <span className="mr-1 text-xs font-medium text-muted-foreground">Ver:</span>
                                    <Button size="sm" variant={analisisModo === 'todos' ? 'default' : 'outline'} onClick={() => setAnalisisModo('todos')}>Todos los puntos</Button>
                                    {grupo!.puntos.map((pt, i) => (
                                        <Button
                                            key={pt.id_fichaingresoservicio}
                                            size="sm"
                                            variant={analisisModo === 'punto' && Number(pt.id_fichaingresoservicio) === Number(fichaId) ? 'default' : 'outline'}
                                            onClick={() => { setAnalisisModo('punto'); if (Number(pt.id_fichaingresoservicio) !== Number(fichaId)) onCambiarFicha(Number(pt.id_fichaingresoservicio)); }}
                                        >
                                            {pt.punto || `Punto ${i + 1}`}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            {esVisita && !isEditing && analisisModo === 'punto' && (
                                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                                    <h4 className="m-0 text-base font-semibold">
                                        Análisis de «{grupo!.puntos.find((pt) => Number(pt.id_fichaingresoservicio) === Number(fichaId))?.punto || 'este punto'}»
                                        <span className="ml-2 text-sm font-normal text-muted-foreground">Ficha N° {fichaId}</span>
                                    </h4>
                                    {(loading || Number(data?.id_fichaingresoservicio ?? data?.id ?? fichaId) !== Number(fichaId)) && (
                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Cargando el punto…
                                        </span>
                                    )}
                                </div>
                            )}
                            {esVisita && !isEditing && analisisModo === 'todos' ? (
                                <MatrizPrecioVisita puntos={grupo!.puntos} datos={datosVisita} verPrecios={showUfColumn} />
                            ) : isEditing ? (
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
                                            Para aprobar, elija «Sin observaciones» o escriba una. Para pedir una corrección es obligatorio explicar el motivo.
                                        </span>
                                        <SelectorObservacion modo={modoObsTec} onModo={setModoObsTec} texto={tecnicaObs} onTexto={setTecnicaObs} placeholder="Ingrese sus observaciones técnicas aquí..." />
                                        {!allTabsVisited && (
                                            <p className="mb-0 mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                                                Para aprobar, revise antes las pestañas que faltan: {[!visitedTabs.antecedentes && 'Antecedentes', !visitedTabs.analisis && 'Análisis', !visitedTabs.observaciones && 'Observaciones'].filter(Boolean).join(', ')}.
                                            </p>
                                        )}
                                        {esVisita && (
                                            <p className="mb-0 mt-3 rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
                                                Es una visita: lo que decidas se aplica a los {grupo!.total} puntos a la vez.
                                            </p>
                                        )}
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

                                {!isEditing && (canProcessCoord || canDevolverCoord) && (
                                    <div className="rounded-[10px] border border-violet-500/20 bg-violet-500/5 p-4">
                                        <div className="flex items-center gap-2">
                                            <IconMessageDots size={20} className="text-violet-600" />
                                            <h5 className="m-0 text-sm font-semibold text-violet-600">{canDevolverCoord ? 'Gestión Coordinación: Devolver a Comercial' : 'Gestión Coordinación: Aprobación Logística'}</h5>
                                        </div>
                                        <span className="my-1 mb-2 block text-xs text-violet-600">
                                            {canDevolverCoord ? 'Esta ficha ya está aprobada y pendiente de programar. Si hay datos que corregir, devuélvala a Comercial con el motivo: podrá editarla y volverá a validación técnica.' : 'Ingrese comentarios operativos finales antes de habilitar la Ficha para programación y asignación de terreno.'}
                                        </span>
                                        <SelectorObservacion modo={modoObsCoord} onModo={setModoObsCoord} texto={coordinacionObs} onTexto={setCoordinacionObs} placeholder="Ingrese las observaciones de coordinación aquí..." />
                                        {canProcessCoord && !allTabsVisited && (
                                            <p className="mb-0 mt-3 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                                                Para aprobar, revise antes las pestañas que faltan: {[!visitedTabs.antecedentes && 'Antecedentes', !visitedTabs.analisis && 'Análisis', !visitedTabs.observaciones && 'Observaciones'].filter(Boolean).join(', ')}.
                                            </p>
                                        )}
                                        {esVisita && (
                                            <p className="mb-0 mt-3 rounded-md bg-muted px-3 py-2 text-[13px] text-muted-foreground">
                                                Es una visita: lo que decidas se aplica a los {grupo!.total} puntos a la vez.
                                            </p>
                                        )}
                                        <div className="mt-4 flex justify-end gap-2.5">
                                            {canProcessCoord && (<ProtectedContent permission="FI_APROBAR_COO">
                                                <span title={!allTabsVisited ? 'Debe visualizar todas las pestañas (Antecedentes, Análisis, Historial) antes de probar' : undefined}>
                                                    <Button className="bg-violet-500 text-white hover:bg-violet-600" onClick={() => handleActionClick('approve_coord')} disabled={!allTabsVisited || actionLoading}>
                                                        {actionLoading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                                                        <IconCheck size={18} /> Aprobar Coordinación
                                                    </Button>
                                                </span>
                                            </ProtectedContent>)}
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

            <Dialog open={confirmarEditar} onOpenChange={setConfirmarEditar}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{esVisita ? 'Editar la visita' : 'Editar la ficha'}</DialogTitle></DialogHeader>
                    <p className="text-[13px]">
                        {Number(data?.id_validaciontecnica) === 1 && <>Esta {esVisita ? 'visita' : 'ficha'} ya fue aprobada por el Área Técnica y espera a Coordinación. </>}
                        {Number(data?.id_validaciontecnica) === 6 && <>Esta {esVisita ? 'visita' : 'ficha'} ya fue aprobada y está pendiente de programar. </>}
                        {Number(data?.id_validaciontecnica) === 5 && <>Esta {esVisita ? 'visita' : 'ficha'} ya está en programación; se conservan sus fechas y muestreadores. </>}
                        Al guardar los cambios volverá a <strong>validación técnica</strong> y deberá aprobarse de nuevo. Solo se puede editar mientras ningún servicio se haya ejecutado, empezado en terreno o tenga documentos enviados.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmarEditar(false)}>No, volver</Button>
                        <Button onClick={() => { setConfirmarEditar(false); setEditarVisita(true); }}>Sí, editar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showCancelarFicha} onOpenChange={setShowCancelarFicha}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{esVisita ? `Cancelar la visita completa (${grupo!.total} puntos)` : `Cancelar la ficha ${data?.fichaingresoservicio ? `N° ${data.fichaingresoservicio}` : ''}`}</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">
                            {esVisita
                                ? <>Los <strong>{grupo!.total} puntos</strong> de la visita ({grupo!.puntos.map((p) => p.punto).join(', ')}) quedan como <strong>CANCELADOS</strong>, salen de las bandejas de Área Técnica, Coordinación y Asignación y la visita se deshace. No se borra:
                                  queda el motivo y quién la canceló en el historial de cada punto. Esta acción es irreversible.</>
                                : <>La ficha queda como <strong>CANCELADA</strong> y sale de las bandejas de Área Técnica, Coordinación y Asignación. No se borra:
                                  queda el motivo y quién la canceló en su historial. Esta acción es irreversible.</>}
                        </p>
                        {[5, 6].includes(Number(data?.id_validaciontecnica)) && (
                            <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">Ya está en programación: sus servicios agendados también se cancelan y se liberan del calendario.</p>
                        )}
                        <div>
                            <span className="mb-1 block text-xs">Motivo *</span>
                            <Combobox
                                placeholder="Seleccione un motivo..."
                                options={motivosFicha.map((m) => ({ value: String(m.id_motivocancelacion), label: m.nombre_motivo }))}
                                value={motivoFichaId}
                                onValueChange={setMotivoFichaId}
                            />
                        </div>
                        <div>
                            <span className="mb-1 block text-xs">Observación * <span className="text-muted-foreground">(por ejemplo: «duplicada de la ficha N° …»)</span></span>
                            <Input placeholder="Detalle de la cancelación..." value={obsCancelarFicha} onChange={(e) => setObsCancelarFicha(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCancelarFicha(false)}>No, volver</Button>
                        <Button
                            variant="destructive"
                            disabled={!motivoFichaId || !obsCancelarFicha.trim() || cancelandoFicha}
                            onClick={async () => {
                                setCancelandoFicha(true);
                                try {
                                    if (esVisita) {
                                        await fichaService.cancelarVisita(Number(fichaId), Number(motivoFichaId), obsCancelarFicha.trim());
                                        showToast({ type: 'success', message: 'Visita cancelada correctamente.' });
                                        setShowCancelarFicha(false);
                                        onBack();
                                        return;
                                    }
                                    await fichaService.cancelarFicha(Number(fichaId), Number(motivoFichaId), obsCancelarFicha.trim());
                                    showToast({ type: 'success', message: 'Ficha cancelada correctamente.' });
                                    setShowCancelarFicha(false);
                                    await loadData();
                                } catch (err: any) {
                                    showToast({ type: 'error', message: err?.response?.data?.message || 'No se pudo cancelar la ficha.' });
                                } finally {
                                    setCancelandoFicha(false);
                                }
                            }}
                        >
                            {cancelandoFicha && <div className="h-4 w-4 animate-spin rounded-full border-2 border-destructive-foreground border-t-transparent" />}
                            {esVisita ? 'Sí, cancelar la visita' : 'Sí, cancelar la ficha'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                tone={confirmAction?.type.includes('approve') ? 'success' : 'destructive'}
                onConfirm={processAction}
                onCancel={() => setShowConfirmModal(false)}
            />
        </div>
    );
};
