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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
} from '@tabler/icons-react';
import { useNavStore } from '../../../store/navStore';

const SuccessModal = ({
    isOpen,
    onClose,
    onViewFicha,
    fichaId
}: {
    isOpen: boolean;
    onClose: () => void;
    onViewFicha: () => void;
    fichaId: number | null
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
                        Se ha generado la Ficha N° <span className="font-semibold text-primary">{fichaId}</span> correctamente en el sistema.
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

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            const antData = antecedentesRef.current?.getData ? antecedentesRef.current.getData() : null;
            if (!antData) {
                showToast({ type: 'warning', message: 'Por favor complete los antecedentes requeridos' });
                return;
            }

            // Descartar filas fijas (pH/Temperatura) que el usuario no configuró
            // con normativa/tabla, y quitar el array `opciones` (solo de UI).
            const analisisPayload = savedAnalysis
                .filter((a: any) => !a._fijo || a.id_referenciaanalisis)
                .map((a: any) => { const rest = { ...a }; delete rest.opciones; return rest; });

            const payload = {
                antecedentes: antData,
                analisis: analisisPayload,
                costoOperativo: {
                    activo: !!costoOperativo.enabled,
                    uf: costoOperativo.enabled ? Number(costoOperativo.uf || 0) : 0
                },
                observaciones: observacionesRef.current?.getData() || 'No Aplica',
                user: { id: user?.id || 0 },
                // Trazabilidad cotización → ficha → casos → pre-factura.
                idCotizacion: cotizacionParaFicha || null,
            };

            const result = await fichaService.create(payload);

            if (result && (result.success || result.data?.success)) {
                const idToUse = result.data?.id_fichaingresoservicio || result.data?.id || result.id;
                if (idToUse) {
                    if (cotizacionParaFicha) {
                        // Deja la cotización marcada como ya convertida en trabajo.
                        // Si esto falla, la ficha ya quedó creada: no se revierte.
                        facturacionService.marcarCotizacionConvertida(cotizacionParaFicha).catch(() => { });
                        setCotizacionParaFicha(null);
                    }
                    setCreatedFichaId(Number(idToUse));
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
            />

            <div ref={topRef} className="h-0 overflow-hidden" />
            <PageHeader
                title="Nueva Ficha de Ingreso"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Creación Manual' }
                ]}
            />

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
                                    ref={antecedentesRef}
                                    initialData={prefillCotizacion?.antecedentes}
                                    onValidationChange={handleValidationChange}
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
                            ref={observacionesRef}
                            label="Instrucciones comerciales"
                            onValidationChange={handleObsValidationChange}
                        />
                    </TabsContent>
                </Tabs>

                <div style={{ padding: `0 ${panelPadding}px ${panelPadding}px` }}>
                    <div className="flex justify-end gap-3 border-t border-border pt-6">
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
                                    onClick={handleSave}
                                    disabled={!isAntecedentesValid || savedAnalysis.length === 0 || !isObservacionesValid || isSaving}
                                >
                                    {isSaving ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                    ) : (
                                        <IconPlus size={20} />
                                    )}
                                    Grabar Ficha
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
};
