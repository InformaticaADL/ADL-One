import React, { useState, useRef, useTransition, useCallback, useEffect } from 'react';
import { AntecedentesForm } from './AntecedentesForm';
import type { AntecedentesFormHandle } from './AntecedentesForm';
import { AnalysisForm } from './AnalysisForm';
import { ObservacionesForm } from './ObservacionesForm';
import type { ObservacionesFormHandle } from './ObservacionesForm';
import { fichaService } from '../services/ficha.service';
import { facturacionService } from '../../facturacion/services/facturacion.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
    IconCheck,
    IconChevronLeft,
    IconPlus,
    IconFileText,
    IconArrowRight,
    IconTable,
    IconEdit,
    IconEye,
    IconInfoCircle,
    IconMapPin,
    IconTrash,
} from '@tabler/icons-react';
import { useNavStore } from '../../../store/navStore';

// ─── Visita con varios puntos ────────────────────────────────────────────────────────────────────────
// Un punto ya completado de la visita. `antecedentes` es lo que devuelve AntecedentesForm.getData() y
// `analisisUI` la lista de análisis tal como la edita AnalysisForm (con sus campos de pantalla).
type PuntoVisita = { id: number; antecedentes: any; analisisUI: any[] };

const claveBorrador = (idUsuario: unknown) => `adlone:borrador-visita:${idUsuario ?? 0}`;

const leerBorrador = (clave: string): any => {
    try {
        const raw = localStorage.getItem(clave);
        if (!raw) return null;
        const d = JSON.parse(raw);
        if (d?.version !== 1) return null;
        const hayPuntos = Array.isArray(d.puntos) && d.puntos.length > 0;
        const hayActual = !!(d.actual?.antecedentes?.puntoMuestreo || d.actual?.antecedentes?.selectedFuente);
        return hayPuntos || hayActual ? d : null;
    } catch { return null; }
};
const escribirBorrador = (clave: string, valor: unknown): boolean => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; } catch { return false; }
};
const borrarBorrador = (clave: string) => { try { localStorage.removeItem(clave); } catch { /* sin acceso al almacenamiento */ } };

// Los análisis viajan sin los campos que solo usa la pantalla (filas fijas sin configurar y opciones).
const analisisParaEnviar = (lista: any[]) =>
    lista.filter((a: any) => !a._fijo || a.id_referenciaanalisis).map((a: any) => { const rest = { ...a }; delete rest.opciones; return rest; });

// Un punto nuevo parte con los datos del anterior; solo se vacía lo que identifica al punto.
const sinDatosDelPunto = (ant: any) => ({ ...ant, puntoMuestreo: '', utmNorte: '', utmEste: '', refGoogle: '' });

const SuccessModal = ({
    isOpen,
    onClose,
    onViewFicha,
    fichaId,
    cantidad = 1
}: {
    isOpen: boolean;
    onClose: () => void;
    onViewFicha: () => void;
    fichaId: number | null;
    cantidad?: number;
}) => {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>¡Ficha Creada Exitosamente!</DialogTitle>
                </DialogHeader>

                <div className="flex flex-col items-center gap-3 py-6">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 text-success">
                        <IconCheck size={40} />
                    </div>

                    <h4 className="m-0 text-center text-base font-semibold text-foreground">Registro Confirmado</h4>

                    <p className="text-center text-sm text-muted-foreground">
                        {cantidad > 1
                            ? <>Se generaron <span className="font-semibold text-primary">{cantidad} fichas</span> (una por punto), agrupadas como una sola visita. La primera es la N° <span className="font-semibold text-primary">{fichaId}</span>.</>
                            : <>Se ha generado la Ficha N° <span className="font-semibold text-primary">{fichaId}</span> correctamente en el sistema.</>}
                    </p>

                    <div className="mt-4 flex w-full gap-3">
                        <Button variant="outline" size="lg" className="flex-1" onClick={onViewFicha}>
                            <IconEye size={18} /> Ver Ficha
                        </Button>
                        <Button size="lg" className="flex-1" onClick={onClose}>
                            Volver al Menú
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export const FichaCreateForm = ({ onBackToMenu, onSuccess }: { onBackToMenu: () => void; onSuccess?: () => void }) => {
    const isMobile = useMediaQuery('(max-width: 550px)');
    const isVerySmall = useMediaQuery('(max-width: 450px)');
    const { user } = useAuth();
    const { showToast } = useToast();
    const { setSelectedFicha, setFichasMode, cotizacionParaFicha, setCotizacionParaFicha } = useNavStore();
    // Ficha que nace de una cotización aceptada: llega con cliente, centro y los
    // análisis con el precio que el cliente ya aprobó. AntecedentesForm decide si
    // hidrata al montarse, así que no se renderiza hasta tener la precarga.
    const [prefillCotizacion, setPrefillCotizacion] = useState<any>(null);
    const [cargandoCotizacion, setCargandoCotizacion] = useState<boolean>(!!cotizacionParaFicha);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdFichaId, setCreatedFichaId] = useState<number | null>(null);
    const [createdCount, setCreatedCount] = useState<number>(1);
    const [isAntecedentesValid, setIsAntecedentesValid] = useState(false);
    const [isObservacionesValid, setIsObservacionesValid] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const observacionesRef = useRef<ObservacionesFormHandle>(null);
    const topRef = useRef<HTMLDivElement>(null);
    const [savedAnalysis, setSavedAnalysis] = useState<any[]>([]);
    const [costoOperativo, setCostoOperativo] = useState<{ enabled: boolean; uf: number | string }>({ enabled: true, uf: '' });

    // Visita con varios puntos: al abrir se pregunta si será uno o varios. En "varios" cada punto se completa y se guarda
    // como borrador (en este navegador) hasta "Finalizar", que crea todos juntos en una sola operación.
    const [modo, setModo] = useState<'pregunta' | 'uno' | 'varios'>('pregunta');
    const [puntos, setPuntos] = useState<PuntoVisita[]>([]);
    const [editandoId, setEditandoId] = useState<number | null>(null);
    const [datosIniciales, setDatosIniciales] = useState<any>(null);
    const [formKey, setFormKey] = useState(0);
    const [decisionAbierta, setDecisionAbierta] = useState(false);
    const [obsInicial, setObsInicial] = useState('');
    const [obsKey, setObsKey] = useState(0);
    const claveBorr = claveBorrador(user?.id);
    const [borradorPendiente, setBorradorPendiente] = useState<any>(() => (cotizacionParaFicha ? null : leerBorrador(claveBorrador(user?.id))));
    const numeroPuntoActual = editandoId != null ? puntos.findIndex(p => p.id === editandoId) + 1 : puntos.length + 1;
    // Foto del estado para el autoguardado (el intervalo no debe depender de cada render).
    const estadoRef = useRef<any>(null);
    estadoRef.current = { modo, puntos, editandoId, costoOperativo, savedAnalysis, decisionAbierta };

    // Pre-agregar análisis fijos (pH + Temperatura, DS 90 / Tabla 1 / Terreno) a la
    // ficha nueva. Quedan listos para rellenar precio (UF=0) y son desmarcables
    // (el usuario los puede eliminar con el ícono de basurero, igual que cualquier
    // análisis). Se cargan una sola vez al montar el formulario de creación.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const defaults = await fichaService.getDefaultAnalyses();
                if (cancelled || !defaults || defaults.length === 0) return;
                setSavedAnalysis(prev => {
                    if (prev.length > 0) return prev; // no pisar si el usuario ya agregó algo
                    return defaults.map((d: any, i: number) => ({
                        ...d,
                        uf_individual: 0,
                        item: i + 1,
                        savedId: `fijo-${d._fijoTecnica || d.nombre_tecnica || i}-${Date.now()}-${i}`
                    }));
                });
            } catch {
                /* si falla, la ficha simplemente arranca sin los fijos */
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Precarga desde la cotización. Los análisis cotizados se AGREGAN a los
    // fijos (pH/Temperatura), no los reemplazan: siguen siendo obligatorios.
    useEffect(() => {
        if (!cotizacionParaFicha) return;
        let cancelled = false;
        (async () => {
            try {
                const prep = await facturacionService.getCotizacionParaFicha(cotizacionParaFicha);
                if (cancelled) return;
                setPrefillCotizacion(prep);
                if (prep.analisis?.length) {
                    setSavedAnalysis(prev => [
                        ...prev,
                        ...prep.analisis.map((a: any, i: number) => ({
                            ...a,
                            tipo_analisis: 'Laboratorio',
                            item: prev.length + i + 1,
                            savedId: `cot-${cotizacionParaFicha}-${i}-${Date.now()}`,
                        })),
                    ]);
                }
            } catch {
                if (!cancelled) {
                    showToast({ type: 'error', message: 'No se pudo cargar la cotización: complete la ficha a mano.' });
                }
            } finally {
                if (!cancelled) setCargandoCotizacion(false);
            }
        })();
        return () => { cancelled = true; };
    }, [cotizacionParaFicha, showToast]);

    const handleValidationChange = useCallback((isValid: boolean) => {
        startTransition(() => {
            setIsAntecedentesValid(isValid);
        });
    }, [startTransition]);

    const handleObsValidationChange = useCallback((isValid: boolean) => {
        startTransition(() => {
            setIsObservacionesValid(isValid);
        });
    }, [startTransition]);

    const scrollToTop = () => {
        if (topRef.current) {
            topRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
    };

    // Datos comunes a toda la visita: costo operativo, observaciones comerciales, usuario y cotización de origen.
    const datosDeLaVisita = () => ({
        costoOperativo: {
            activo: !!costoOperativo.enabled,
            uf: costoOperativo.enabled ? Number(costoOperativo.uf || 0) : 0
        },
        observaciones: observacionesRef.current?.getData() || 'No Aplica',
        user: { id: user?.id || 0 },
        // Trazabilidad cotización → ficha → casos → pre-factura.
        idCotizacion: cotizacionParaFicha || null,
    });

    const handleSave = async () => {
        if (isSaving) return;
        const antData = antecedentesRef.current?.getData ? antecedentesRef.current.getData() : null;
        if (!antData) {
            showToast({ type: 'warning', message: 'Por favor complete los antecedentes requeridos' });
            return;
        }
        await enviarVisita({
            // Descartar filas fijas (pH/Temperatura) que el usuario no configuró
            // con normativa/tabla, y quitar el array `opciones` (solo de UI).
            antecedentes: antData,
            analisis: analisisParaEnviar(savedAnalysis),
            ...datosDeLaVisita(),
        }, false);
    };

    // Crea la ficha (un punto) o la visita completa (varios puntos agrupados) y muestra el resultado.
    const enviarVisita = async (payload: Record<string, unknown>, esGrupo: boolean) => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const result = esGrupo ? await fichaService.createGrupo(payload) : await fichaService.create(payload);

            if (result && (result.success || result.data?.success)) {
                borrarBorrador(claveBorr);
                setDecisionAbierta(false);
                const idToUse = result.data?.id_fichaingresoservicio || result.data?.id || result.id;
                if (idToUse) {
                    if (cotizacionParaFicha) {
                        // Deja la cotización marcada como ya convertida en trabajo.
                        // Si esto falla, la ficha ya quedó creada: no se revierte.
                        facturacionService.marcarCotizacionConvertida(cotizacionParaFicha).catch(() => { });
                        setCotizacionParaFicha(null);
                    }
                    setCreatedFichaId(Number(idToUse));
                    setCreatedCount(Array.isArray(result.data?.ids) ? result.data.ids.length : 1);
                    setShowSuccessModal(true);
                } else {
                    showToast({ type: 'warning', message: 'Ficha creada pero no se recibió un ID válido.' });
                }
            } else {
                showToast({ type: 'error', message: 'Error en la respuesta del servidor' });
            }

        } catch (error: any) {
            console.error("Error saving ficha:", error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al grabar la ficha' });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Varios puntos ──────────────────────────────────────────────────────────────────────────────────
    // Guarda el borrador en el navegador. Con el diálogo de decisión abierto el formulario muestra un punto que ya está en la
    // lista, así que no se guarda como "punto en curso" para no duplicarlo al retomar.
    const guardarBorradorAhora = useCallback((): boolean => {
        const e = estadoRef.current;
        if (!e || e.modo !== 'varios') return true;
        const enCurso = !e.decisionAbierta ? antecedentesRef.current?.getData?.() : null;
        const hayEnCurso = !!(enCurso && (enCurso.puntoMuestreo || enCurso.selectedFuente));
        if (e.puntos.length === 0 && !hayEnCurso) return true;
        return escribirBorrador(claveBorr, {
            version: 1,
            guardadoEn: Date.now(),
            puntos: e.puntos,
            editandoId: e.editandoId,
            costoOperativo: e.costoOperativo,
            observaciones: observacionesRef.current?.getData() || '',
            actual: hayEnCurso ? { antecedentes: enCurso, analisisUI: e.savedAnalysis } : null,
        });
    }, [claveBorr]);

    useEffect(() => {
        if (modo !== 'varios') return;
        let avisado = false;
        const guardar = () => {
            if (!guardarBorradorAhora() && !avisado) {
                avisado = true;
                showToast({ type: 'warning', message: 'No se pudo guardar el borrador en este navegador. Termine la visita antes de salir.' });
            }
        };
        const t = setInterval(guardar, 4000);
        window.addEventListener('beforeunload', guardar);
        return () => { clearInterval(t); window.removeEventListener('beforeunload', guardar); };
    }, [modo, guardarBorradorAhora, showToast]);

    // Carga un punto en el formulario (se vuelve a montar para que tome los datos como iniciales).
    const cargarPuntoEnFormulario = (antecedentes: any, analisisUI: any[], idEditando: number | null) => {
        setEditandoId(idEditando);
        setDatosIniciales(antecedentes);
        setSavedAnalysis(analisisUI.map((a: any) => ({ ...a })));
        setFormKey(k => k + 1);
        setActiveTab('antecedentes');
        scrollToTop();
    };

    const handleGuardarPunto = () => {
        const ant = antecedentesRef.current?.getData ? antecedentesRef.current.getData() : null;
        if (!ant) {
            showToast({ type: 'warning', message: 'Por favor complete los antecedentes requeridos' });
            return;
        }
        const nombre = String(ant.puntoMuestreo || '').trim();
        const otros = puntos.filter(p => p.id !== editandoId);
        if (otros.some(p => String(p.antecedentes.puntoMuestreo || '').trim().toLowerCase() === nombre.toLowerCase())) {
            showToast({ type: 'warning', message: `El punto "${nombre}" ya existe en esta visita. Use un nombre distinto.` });
            return;
        }
        if (otros.some(p => String(p.antecedentes.selectedCliente) !== String(ant.selectedCliente) || String(p.antecedentes.selectedFuente) !== String(ant.selectedFuente))) {
            showToast({ type: 'warning', message: 'Todos los puntos de una visita deben ser de la misma empresa y el mismo centro.' });
            return;
        }
        const punto: PuntoVisita = { id: editandoId ?? Date.now(), antecedentes: ant, analisisUI: savedAnalysis };
        setPuntos(prev => (editandoId != null ? prev.map(p => (p.id === editandoId ? punto : p)) : [...prev, punto]));
        setEditandoId(null);
        setDecisionAbierta(true);
    };

    const handleAgregarOtroPunto = () => {
        const base = puntos[puntos.length - 1];
        if (!base) return;
        setDecisionAbierta(false);
        cargarPuntoEnFormulario(sinDatosDelPunto(base.antecedentes), base.analisisUI, null);
    };

    const handleEditarPunto = (id: number) => {
        const p = puntos.find(x => x.id === id);
        if (!p) return;
        setDecisionAbierta(false);
        cargarPuntoEnFormulario(p.antecedentes, p.analisisUI, id);
    };

    const handleQuitarPunto = (id: number) => {
        if (puntos.length <= 1) return;
        setPuntos(prev => prev.filter(p => p.id !== id));
    };

    const handleFinalizarVisita = async () => {
        if (puntos.length === 0) return;
        const [primero, ...resto] = puntos;
        await enviarVisita({
            antecedentes: primero.antecedentes,
            analisis: analisisParaEnviar(primero.analisisUI),
            ...(resto.length > 0 ? {
                puntosAdicionales: resto.map(p => ({
                    puntoMuestreo: String(p.antecedentes.puntoMuestreo || '').trim(),
                    zona: p.antecedentes.zona || '',
                    utmNorte: p.antecedentes.utmNorte || '',
                    utmEste: p.antecedentes.utmEste || '',
                    refGoogle: p.antecedentes.refGoogle || '',
                    // El punto lleva TODOS sus antecedentes y sus análisis: pueden diferir del punto 1.
                    antecedentes: p.antecedentes,
                    analisis: analisisParaEnviar(p.analisisUI),
                })),
            } : {}),
            ...datosDeLaVisita(),
        }, resto.length > 0);
    };

    const handleSalirConBorrador = () => {
        if (!guardarBorradorAhora()) {
            showToast({ type: 'warning', message: 'No se pudo guardar el borrador en este navegador.' });
            return;
        }
        onBackToMenu();
    };

    const handleDescartarBorrador = () => {
        borrarBorrador(claveBorr);
        setBorradorPendiente(null);
        setPuntos([]);
        setEditandoId(null);
        setDecisionAbierta(false);
        setDatosIniciales(null);
        setModo('pregunta');
        setFormKey(k => k + 1);
        setObsInicial('');
        setObsKey(k => k + 1);
        setSavedAnalysis([]);
        // Vuelve a los análisis fijos de partida (pH + Temperatura), igual que al abrir la pantalla.
        fichaService.getDefaultAnalyses().then((defaults: any[]) => {
            if (!defaults || defaults.length === 0) return;
            setSavedAnalysis(prev => (prev.length > 0 ? prev : defaults.map((d: any, i: number) => ({
                ...d,
                uf_individual: 0,
                item: i + 1,
                savedId: `fijo-${d._fijoTecnica || d.nombre_tecnica || i}-${Date.now()}-${i}`
            }))));
        }).catch(() => { /* la ficha arranca sin los fijos */ });
    };

    const handleContinuarBorrador = () => {
        const d = borradorPendiente;
        if (!d) return;
        setBorradorPendiente(null);
        setModo('varios');
        setPuntos(Array.isArray(d.puntos) ? d.puntos : []);
        if (d.costoOperativo) setCostoOperativo(d.costoOperativo);
        setObsInicial(d.observaciones || '');
        setObsKey(k => k + 1);
        if (d.actual?.antecedentes) {
            cargarPuntoEnFormulario(d.actual.antecedentes, d.actual.analisisUI || [], d.editandoId ?? null);
        } else {
            setDecisionAbierta(true);
        }
    };

    const handleCloseSuccess = () => {
        setShowSuccessModal(false);
        setCreatedFichaId(null);
        // F-01a: tras crear, ir al listado de fichas en lugar del selector
        if (onSuccess) {
            onSuccess();
        } else {
            onBackToMenu();
        }
    };

    const handleViewFicha = () => {
        if (createdFichaId) {
            setSelectedFicha(createdFichaId, null);
            setFichasMode('detail_ficha');
        }
        setShowSuccessModal(false);
    };

    const tabIconSize = isVerySmall ? 16 : (isMobile ? 18 : 22);
    const panelPadding = isMobile ? 16 : 50;

    const handleTabChange = (val: string) => {
        // F-11: bloquear salto de tabs sin haber completado las anteriores.
        // id fijo en el toast: Radix dispara onValueChange dos veces para un
        // mismo clic en un trigger que no tenía el foco (una vez por el
        // focus, otra por el click) — invisible en cualquier otro uso de
        // Tabs de la app porque ahí el handler solo hace setState, pero acá
        // showToast() sí deja huella visible (dos toasts apilados). Mismo id
        // en sonner = la segunda llamada actualiza el toast existente en vez
        // de apilar uno nuevo.
        if (val === 'analisis' && !isAntecedentesValid) {
            showToast({ id: 'ficha-tab-guard', type: 'warning', message: 'Complete primero los antecedentes obligatorios' });
            return;
        }
        if (val === 'observaciones' && (!isAntecedentesValid || savedAnalysis.length === 0)) {
            showToast({ id: 'ficha-tab-guard', type: 'warning', message: 'Complete antecedentes y al menos un análisis primero' });
            return;
        }
        setActiveTab(val);
        scrollToTop();
    };

    return (
        <div>
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleCloseSuccess}
                onViewFicha={handleViewFicha}
                fichaId={createdFichaId}
                cantidad={createdCount}
            />

            {/* Borrador de una visita con varios puntos que quedó a medias */}
            <Dialog open={!!borradorPendiente} onOpenChange={() => { /* hay que elegir una opción */ }}>
                <DialogContent className="max-w-[460px]" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Tiene una visita sin terminar</DialogTitle>
                        <DialogDescription>
                            {(borradorPendiente?.puntos?.length || 0) > 0
                                ? `Quedaron ${borradorPendiente.puntos.length} punto(s) guardados: ${borradorPendiente.puntos.map((p: PuntoVisita) => p.antecedentes?.puntoMuestreo || 'sin nombre').join(', ')}.`
                                : 'Quedó un punto a medio completar.'}
                            {' '}Guardado el {borradorPendiente?.guardadoEn ? new Date(borradorPendiente.guardadoEn).toLocaleString('es-CL') : ''}.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={handleDescartarBorrador}>Descartar y empezar de nuevo</Button>
                        <Button onClick={handleContinuarBorrador}>Continuar donde quedé</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Primera pregunta: ¿uno o varios puntos? */}
            <Dialog open={modo === 'pregunta' && !borradorPendiente && !cargandoCotizacion} onOpenChange={(abierto) => { if (!abierto) onBackToMenu(); }}>
                <DialogContent className="max-w-[480px]" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle>¿Cuántos puntos tendrá esta visita?</DialogTitle>
                        <DialogDescription>
                            Si en el mismo centro se muestrean varios puntos en una sola visita, créelos juntos: comparten empresa, centro y datos
                            generales, y solo cambia lo propio de cada punto. Todos quedan agrupados bajo un mismo OI.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="outline" onClick={onBackToMenu}>Cancelar</Button>
                        <Button variant="outline" onClick={() => setModo('uno')}>Un solo punto</Button>
                        <Button onClick={() => setModo('varios')}><IconMapPin size={18} /> Varios puntos</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Después de guardar cada punto: ¿otro o finalizar? */}
            <Dialog open={decisionAbierta} onOpenChange={() => { /* hay que elegir una opción */ }}>
                <DialogContent className="max-w-[560px]" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>{puntos.length === 1 ? 'Punto 1 guardado' : `${puntos.length} puntos guardados`}</DialogTitle>
                        <DialogDescription>
                            Aún no se ha creado nada: las fichas se crean todas juntas al finalizar. El costo operativo es uno por visita y se reparte entre los puntos.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="m-0 flex max-h-[40vh] list-none flex-col gap-1.5 overflow-y-auto p-0">
                        {puntos.map((p, i) => (
                            <li key={p.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                                <span className="font-semibold text-primary">Punto {i + 1}</span>
                                <span className="min-w-0 flex-1 truncate text-foreground">{p.antecedentes?.puntoMuestreo || 'sin nombre'}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{p.analisisUI?.length || 0} análisis</span>
                                <Button type="button" variant="ghost" size="icon" aria-label={`Editar el punto ${i + 1}`} onClick={() => handleEditarPunto(p.id)}><IconEdit size={16} /></Button>
                                <Button type="button" variant="ghost" size="icon" aria-label={`Quitar el punto ${i + 1}`} disabled={puntos.length <= 1} onClick={() => handleQuitarPunto(p.id)}><IconTrash size={16} /></Button>
                            </li>
                        ))}
                    </ul>
                    <DialogFooter className="gap-2 sm:gap-2">
                        <Button variant="ghost" onClick={handleSalirConBorrador} disabled={isSaving}>Salir y seguir después</Button>
                        <Button variant="outline" onClick={handleAgregarOtroPunto} disabled={isSaving}><IconPlus size={18} /> Agregar otro punto</Button>
                        <Button onClick={handleFinalizarVisita} disabled={isSaving}>
                            {isSaving && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />}
                            Finalizar y crear {puntos.length > 1 ? `${puntos.length} fichas` : 'la ficha'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div ref={topRef} className="h-0 overflow-hidden" />
            <PageHeader
                title="Nueva Ficha de Ingreso"
                onBack={modo === 'varios' ? handleSalirConBorrador : onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: modo === 'varios' ? handleSalirConBorrador : onBackToMenu },
                    { label: 'Creación Manual' }
                ]}
            />

            {modo === 'varios' && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
                    <IconMapPin size={16} className="shrink-0 text-primary" />
                    <span className="font-medium text-foreground">
                        Visita con varios puntos · {editandoId != null ? `editando el punto ${numeroPuntoActual}` : `completando el punto ${numeroPuntoActual}`}
                    </span>
                    {puntos.map((p, i) => (
                        <span key={p.id} className={cn('rounded-full border px-2 py-0.5 text-xs', p.id === editandoId ? 'border-primary text-primary' : 'border-border text-muted-foreground')}>
                            {i + 1}. {p.antecedentes?.puntoMuestreo || 'sin nombre'}
                        </span>
                    ))}
                    <span className="ml-auto flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Se guarda un borrador automáticamente.</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { if (window.confirm('¿Descartar esta visita y el borrador?')) handleDescartarBorrador(); }}>Descartar</Button>
                    </span>
                </div>
            )}

            {/* overflow-clip (no -hidden): recorta igual las esquinas del tab bar,
                pero sin volverse contenedor de scroll — overflow-hidden rompía el
                position:sticky del índice lateral de Antecedentes. */}
            <Card className="overflow-clip p-0">
                {/* activationMode="manual": el default ("automatic") de Radix dispara
                    onValueChange tanto en mousedown como en el focus que ese mismo click
                    produce — dos llamadas por un solo clic en un trigger sin foco previo.
                    En "manual" solo el click/mousedown navega; ↑↓←→ mueve el foco sin
                    cambiar de tab hasta Enter/Espacio (estándar de Radix para este caso). */}
                <Tabs value={activeTab} onValueChange={handleTabChange} activationMode="manual">
                    <div className="flex justify-center border-b border-border" style={{ padding: `0 ${panelPadding}px` }}>
                        <TabsList className="h-auto gap-1 rounded-none bg-transparent p-0">
                            <TabsTrigger
                                value="antecedentes"
                                className="gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                                style={{ fontSize: isVerySmall ? 12 : (isMobile ? 13.5 : 15) }}
                            >
                                <IconFileText size={tabIconSize} />{isVerySmall ? 'Antec.' : 'Antecedentes'}
                            </TabsTrigger>
                            <TabsTrigger
                                value="analisis"
                                className="gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                                style={{ fontSize: isMobile ? 13.5 : 15 }}
                            >
                                <IconTable size={tabIconSize} />Análisis
                            </TabsTrigger>
                            <TabsTrigger
                                value="observaciones"
                                className="gap-1.5 rounded-none border-b-2 border-transparent px-4 py-3 text-muted-foreground shadow-none data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                                style={{ fontSize: isVerySmall ? 12 : (isMobile ? 13.5 : 15) }}
                            >
                                <IconEdit size={tabIconSize} />{isVerySmall ? 'Obs.' : 'Observaciones'}
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent
                        value="antecedentes"
                        forceMount
                        className={cn('mt-0 min-h-[70vh]', activeTab !== 'antecedentes' && 'hidden')}
                        style={{ padding: `${isMobile ? 16 : 32}px ${panelPadding}px` }}
                    >
                        {cargandoCotizacion ? (
                            <p className="mt-8 text-center text-sm text-muted-foreground">
                                Cargando los datos de la cotización…
                            </p>
                        ) : (
                            <>
                                {prefillCotizacion && (
                                    <div className="mb-6 flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
                                        <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />
                                        <div className="text-muted-foreground">
                                            <p className="m-0 font-medium text-foreground">Desde la cotización N° {prefillCotizacion.numero_cotizacion}</p>
                                            <p className="m-0 mt-1">
                                                El cliente, el centro y {prefillCotizacion.analisis?.length || 0} análisis vienen cargados
                                                con el precio que el cliente aceptó. Falta completar objetivo, punto de muestreo y programación.
                                                {prefillCotizacion.avisos?.length > 0 && (
                                                    <> <strong className="text-foreground">{prefillCotizacion.avisos.length} análisis no se pudieron traer</strong> y hay que agregarlos a mano.</>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                <AntecedentesForm
                                    key={formKey}
                                    ref={antecedentesRef}
                                    initialData={datosIniciales ?? prefillCotizacion?.antecedentes}
                                    onValidationChange={handleValidationChange}
                                    exigirCoordenadas={modo === 'varios'}
                                />
                            </>
                        )}
                    </TabsContent>

                    <TabsContent
                        value="analisis"
                        forceMount
                        className={cn('mt-0', activeTab !== 'analisis' && 'hidden')}
                        style={{ padding: `${isMobile ? 16 : 32}px ${panelPadding}px` }}
                    >
                        <AnalysisForm
                            savedAnalysis={savedAnalysis}
                            onSavedAnalysisChange={setSavedAnalysis}
                            costoOperativo={costoOperativo}
                            onCostoOperativoChange={setCostoOperativo}
                        />
                    </TabsContent>

                    <TabsContent
                        value="observaciones"
                        forceMount
                        className={cn('mt-0', activeTab !== 'observaciones' && 'hidden')}
                        style={{ padding: `${isMobile ? 16 : 32}px ${panelPadding}px` }}
                    >
                        <ObservacionesForm
                            key={obsKey}
                            ref={observacionesRef}
                            initialValue={obsInicial}
                            label="Instrucciones comerciales"
                            onValidationChange={handleObsValidationChange}
                        />
                    </TabsContent>
                </Tabs>

                <div style={{ padding: `0 ${panelPadding}px ${panelPadding}px` }}>
                    <div className="flex items-start justify-end gap-3 border-t border-border pt-6">
{activeTab === 'antecedentes' && (
                            <Button
                                size="lg"
                                onClick={() => { setActiveTab('analisis'); scrollToTop(); }}
                                disabled={!isAntecedentesValid}
                            >
                                Siguiente <IconArrowRight size={20} />
                            </Button>
                        )}

                        {activeTab === 'analisis' && (
                            <>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => setActiveTab('antecedentes')}
                                >
                                    <IconChevronLeft size={20} /> Anterior
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={() => { setActiveTab('observaciones'); scrollToTop(); }}
                                    disabled={savedAnalysis.length === 0}
                                >
                                    Siguiente <IconArrowRight size={20} />
                                </Button>
                            </>
                        )}

                        {activeTab === 'observaciones' && (
                            <>
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={() => setActiveTab('analisis')}
                                >
                                    <IconChevronLeft size={20} /> Anterior
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={modo === 'varios' ? handleGuardarPunto : handleSave}
                                    disabled={!isAntecedentesValid || savedAnalysis.length === 0 || !isObservacionesValid || isSaving}
                                >
                                    {isSaving ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                    ) : (
                                        <IconPlus size={20} />
                                    )}
                                    {modo === 'varios' ? `Guardar punto ${numeroPuntoActual}` : 'Grabar Ficha'}
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};
