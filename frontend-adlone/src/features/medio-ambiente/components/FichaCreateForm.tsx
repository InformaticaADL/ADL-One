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

import { Modal, Button, Typography, Tabs, Alert, Card, Divider } from 'antd';
import {
    IconCheck,
    IconChevronLeft,
    IconPlus,
    IconFileText,
    IconArrowRight,
    IconTable,
    IconEdit,
    IconEye
} from '@tabler/icons-react';
import { useNavStore } from '../../../store/navStore';

const { Title, Text } = Typography;

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
        <Modal
            open={isOpen}
            onCancel={onClose}
            title="¡Ficha Creada Exitosamente!"
            centered
            width={420}
            closable={false}
            footer={null}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '24px 0' }}>
                <div style={{
                    width: 80, height: 80, borderRadius: '50%', backgroundColor: 'rgba(47,158,68,0.12)', color: '#2f9e44',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <IconCheck size={40} />
                </div>

                <Title level={4} style={{ margin: 0, textAlign: 'center' }}>Registro Confirmado</Title>

                <Text type="secondary" style={{ textAlign: 'center' }}>
                    Se ha generado la Ficha N° <Text strong style={{ color: 'var(--app-accent-text)' }}>{fichaId}</Text> correctamente en el sistema.
                </Text>

                <div style={{ display: 'flex', width: '100%', gap: 12, marginTop: 16 }}>
                    <Button
                        style={{ flex: 1 }}
                        size="large"
                        icon={<IconEye size={18} />}
                        onClick={onViewFicha}
                    >
                        Ver Ficha
                    </Button>
                    <Button
                        style={{ flex: 1 }}
                        size="large"
                        type="primary"
                        onClick={onClose}
                    >
                        Volver al Menú
                    </Button>
                </div>
            </div>
        </Modal>
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
        // F-11: bloquear salto de tabs sin haber completado las anteriores
        if (val === 'analisis' && !isAntecedentesValid) {
            showToast({ type: 'warning', message: 'Complete primero los antecedentes obligatorios' });
            return;
        }
        if (val === 'observaciones' && (!isAntecedentesValid || savedAnalysis.length === 0)) {
            showToast({ type: 'warning', message: 'Complete antecedentes y al menos un análisis primero' });
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

            <div ref={topRef} style={{ height: 0, overflow: 'hidden' }} />
            <PageHeader
                title="Nueva Ficha de Ingreso"
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Creación Manual' }
                ]}
            />

            <Card styles={{ body: { padding: 0 } }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    centered
                    tabBarStyle={{ margin: 0, padding: `0 ${isMobile ? 16 : 50}px`, borderBottom: '1px solid var(--app-border)' }}
                    items={[
                        {
                            key: 'antecedentes',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isVerySmall ? 12 : (isMobile ? 13.5 : 15), fontWeight: 600 }}><IconFileText size={tabIconSize} />{isVerySmall ? 'Antec.' : 'Antecedentes'}</span>,
                            children: (
                                <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPadding}px`, minHeight: '70vh' }}>
                                    {cargandoCotizacion ? (
                                        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginTop: 32 }}>
                                            Cargando los datos de la cotización…
                                        </Text>
                                    ) : (
                                        <>
                                            {prefillCotizacion && (
                                                <Alert
                                                    type="info"
                                                    showIcon
                                                    style={{ marginBottom: 24 }}
                                                    message={`Desde la cotización N° ${prefillCotizacion.numero_cotizacion}`}
                                                    description={
                                                        <>
                                                            El cliente, el centro y {prefillCotizacion.analisis?.length || 0} análisis vienen cargados
                                                            con el precio que el cliente aceptó. Falta completar objetivo, punto de muestreo y programación.
                                                            {prefillCotizacion.avisos?.length > 0 && (
                                                                <> <b>{prefillCotizacion.avisos.length} análisis no se pudieron traer</b> y hay que agregarlos a mano.</>
                                                            )}
                                                        </>
                                                    }
                                                />
                                            )}
                                            <AntecedentesForm
                                                ref={antecedentesRef}
                                                initialData={prefillCotizacion?.antecedentes}
                                                onValidationChange={handleValidationChange}
                                            />
                                        </>
                                    )}
                                </div>
                            ),
                        },
                        {
                            key: 'analisis',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isMobile ? 13.5 : 15, fontWeight: 600 }}><IconTable size={tabIconSize} />Análisis</span>,
                            children: (
                                <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPadding}px` }}>
                                    <AnalysisForm
                                        savedAnalysis={savedAnalysis}
                                        onSavedAnalysisChange={setSavedAnalysis}
                                        costoOperativo={costoOperativo}
                                        onCostoOperativoChange={setCostoOperativo}
                                    />
                                </div>
                            ),
                        },
                        {
                            key: 'observaciones',
                            label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: isVerySmall ? 12 : (isMobile ? 13.5 : 15), fontWeight: 600 }}><IconEdit size={tabIconSize} />{isVerySmall ? 'Obs.' : 'Observaciones'}</span>,
                            children: (
                                <div style={{ padding: `${isMobile ? 16 : 32}px ${panelPadding}px` }}>
                                    <ObservacionesForm
                                        ref={observacionesRef}
                                        label="Instrucciones comerciales"
                                        onValidationChange={handleObsValidationChange}
                                    />
                                </div>
                            ),
                        },
                    ]}
                />

                <div style={{ padding: `0 ${panelPadding}px ${panelPadding}px` }}>
                    <Divider style={{ margin: '0 0 24px' }} />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                        {activeTab === 'antecedentes' && (
                            <Button
                                type="primary"
                                size="large"
                                iconPosition="end"
                                icon={<IconArrowRight size={20} />}
                                onClick={() => { setActiveTab('analisis'); scrollToTop(); }}
                                disabled={!isAntecedentesValid}
                            >
                                Siguiente
                            </Button>
                        )}

                        {activeTab === 'analisis' && (
                            <>
                                <Button
                                    size="large"
                                    icon={<IconChevronLeft size={20} />}
                                    onClick={() => setActiveTab('antecedentes')}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    type="primary"
                                    size="large"
                                    iconPosition="end"
                                    icon={<IconArrowRight size={20} />}
                                    onClick={() => { setActiveTab('observaciones'); scrollToTop(); }}
                                    disabled={savedAnalysis.length === 0}
                                >
                                    Siguiente
                                </Button>
                            </>
                        )}

                        {activeTab === 'observaciones' && (
                            <>
                                <Button
                                    size="large"
                                    icon={<IconChevronLeft size={20} />}
                                    onClick={() => setActiveTab('analisis')}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    type="primary"
                                    size="large"
                                    style={{ backgroundColor: '#2f9e44' }}
                                    icon={<IconPlus size={20} />}
                                    onClick={handleSave}
                                    disabled={!isAntecedentesValid || savedAnalysis.length === 0 || !isObservacionesValid}
                                    loading={isSaving}
                                >
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
