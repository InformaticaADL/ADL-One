import React, { useEffect, useState, useRef } from 'react';
import { useNavStore } from '../../../store/navStore';
import { fichaService } from '../services/ficha.service';
import { AntecedentesForm, type AntecedentesFormHandle } from '../components/AntecedentesForm';
import { AnalysisForm } from '../components/AnalysisForm';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { PageHeader } from '../../../components/layout/PageHeader';
import { mapToAntecedentes } from '../utils/fichaMapping';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconClipboardList,
    IconFlask,
    IconDeviceFloppy,
    IconX,
    IconInfoCircle,
    IconFileText,
    IconArrowRight
} from '@tabler/icons-react';

import { CatalogosProvider } from '../context/CatalogosContext';

const RemuestreoPageContent: React.FC = () => {
    const { selectedFichaId, setActiveSubmodule, setFichasMode } = useNavStore();
    const { showToast } = useToast();
    const auth = useAuth();
    const catalogos = useCachedCatalogos();
    const isMobile = useMediaQuery('(max-width: 768px)');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('antecedentes');
    const [originalFicha, setOriginalFicha] = useState<any>(null);
    const [analysisList, setAnalysisList] = useState<any[]>([]);
    const [costoOperativo, setCostoOperativo] = useState<{ enabled: boolean; uf: number | string }>({ enabled: true, uf: '' });
    const [observaciones, setObservaciones] = useState<string>('');
    // Otros puntos de la visita de la ficha original, que se pueden remuestrear junto con este.
    const [otrosPuntos, setOtrosPuntos] = useState<{ id: number; punto: string; estado: string }[]>([]);
    const [puntosExtra, setPuntosExtra] = useState<Set<number>>(new Set());

    const antecedentesRef = useRef<AntecedentesFormHandle>(null);
    const mappedInitialDataRef = useRef<any>(null);

    useEffect(() => {
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFichaId]);

    const loadData = async () => {
        if (!selectedFichaId) return;
        setLoading(true);
        try {
            const [response, labsData] = await Promise.all([
                fichaService.getById(selectedFichaId),
                catalogos.getLaboratorios()
            ]);

            if (response && (response.success !== false)) {
                const data = response.data || response;
                setOriginalFicha(data);

                // Map Antecedentes
                mappedInitialDataRef.current = mapToAntecedentes(data, data.agenda);

                // Map Analysis
                const getLabName = (id: any) => {
                    if (!id) return null;
                    const lab = (labsData || []).find((l: any) => l.id_laboratorioensayo === id || l.id_laboratorioensayo === Number(id));
                    return lab ? lab.nombre_laboratorioensayo : null;
                };

                const allRows = data.detalles || [];
                const costoRow = allRows.find((r: any) => r.tipo_analisis === 'CostoOperativo');
                const regularRows = allRows.filter((r: any) => r.tipo_analisis !== 'CostoOperativo');
                const mappedAnalysis = regularRows.map((row: any, index: number) => ({
                    ...row,
                    savedId: `remuestreo-${index}-${Date.now()}`,
                    nombre_tecnica: row.nombre_tecnica || row.nombre_determinacion || row.nombre_examen,
                    nombre_laboratorioensayo: getLabName(row.id_laboratorioensayo),
                    nombre_laboratorioensayo_2: getLabName(row.id_laboratorioensayo_2 || row.id_laboratorioensayo2),
                    item: index + 1
                }));
                setAnalysisList(mappedAnalysis);
                // Costo Operativo siempre marcado por defecto; el usuario lo desactiva manualmente.
                const coUF = Number(costoRow?.uf_individual || 0);
                setCostoOperativo({ enabled: true, uf: coUF > 0 ? coUF : '' });
                setObservaciones('');

                // ¿La ficha es un punto de una visita? Entonces se pueden remuestrear también los otros puntos.
                setPuntosExtra(new Set());
                try {
                    const g = (await fichaService.getGrupo(selectedFichaId))?.data;
                    setOtrosPuntos((g?.puntos || [])
                        .filter((p: any) => Number(p.id_fichaingresoservicio) !== Number(selectedFichaId))
                        .map((p: any) => ({ id: Number(p.id_fichaingresoservicio), punto: p.punto || `Ficha ${p.id_fichaingresoservicio}`, estado: p.estado || '' })));
                } catch {
                    setOtrosPuntos([]);
                }
            } else {
                showToast({ type: 'error', message: 'No se pudo cargar la ficha original' });
            }
        } catch (error) {
            console.error("Error loading original ficha:", error);
            showToast({ type: 'error', message: 'Error al cargar datos' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateRemuestreo = async () => {
        if (!antecedentesRef.current) return;

        const antecedentesData = antecedentesRef.current.getData();

        if (!antecedentesData?.tipoMonitoreo || !antecedentesData?.selectedEmpresa || !antecedentesData?.selectedCliente) {
            showToast({ type: 'warning', message: 'Complete los antecedentes requeridos antes de crear el remuestreo' });
            setActiveTab('antecedentes');
            return;
        }

        if (analysisList.length === 0) {
            showToast({ type: 'warning', message: 'Debe haber al menos un análisis grabado' });
            setActiveTab('analisis');
            return;
        }

        let payload: Record<string, unknown> = {
            antecedentes: antecedentesData,
            analisis: analysisList,
            costoOperativo: {
                activo: !!costoOperativo.enabled,
                uf: costoOperativo.enabled ? Number(costoOperativo.uf || 0) : 0
            },
            observaciones: observaciones,
            user: auth?.user,
            isRemuestreo: true,
            originalFichaId: selectedFichaId
        };

        try {
            setSaving(true);

            // Remuestreo de varios puntos de una visita: se crea una visita nueva. Cada punto marcado entra con su nombre, sus
            // coordenadas y sus análisis originales; el resto de los datos es el de esta pantalla (misma visita, mismo centro).
            const extras = otrosPuntos.filter(p => puntosExtra.has(p.id));
            if (extras.length > 0) {
                let costoTotal = costoOperativo.enabled ? Number(costoOperativo.uf || 0) : 0;
                const puntosAdicionales: Record<string, unknown>[] = [];
                for (const e of extras) {
                    const resp = await fichaService.getById(e.id);
                    const d = resp?.data || resp;
                    const m: any = mapToAntecedentes(d, d?.agenda);
                    const filas: any[] = d?.detalles || [];
                    const costoRowE = filas.find((r: any) => r.tipo_analisis === 'CostoOperativo');
                    if (costoOperativo.enabled) costoTotal += Number(costoRowE?.uf_individual || 0);
                    puntosAdicionales.push({
                        puntoMuestreo: String(m.puntoMuestreo || e.punto).trim(),
                        zona: m.zona || '',
                        utmNorte: m.utmNorte || '',
                        utmEste: m.utmEste || '',
                        refGoogle: m.refGoogle || '',
                        originalFichaId: e.id,
                        analisis: filas
                            .filter((r: any) => r.tipo_analisis !== 'CostoOperativo')
                            .map((r: any, i: number) => ({ ...r, savedId: `remuestreo-${e.id}-${i}-${Date.now()}`, item: i + 1 })),
                    });
                }
                payload = {
                    ...payload,
                    puntosAdicionales,
                    // El costo operativo es uno por visita: suma de lo que cobraba cada punto (se reparte al crear).
                    costoOperativo: { activo: !!costoOperativo.enabled, uf: Math.round(costoTotal * 100) / 100 },
                };
            }

            const response = extras.length > 0 ? await fichaService.createGrupo(payload) : await fichaService.create(payload);
            if (response && (response.success || response.id)) {
                showToast({ type: 'success', message: extras.length > 0 ? `Remuestreo creado: ${extras.length + 1} puntos` : 'Remuestreo creado exitosamente' });
                // Return to Muestreos Ejecutados List
                setFichasMode('list_ejecutados');
                setActiveSubmodule('ma-fichas-ingreso');
            } else {
                showToast({ type: 'error', message: response.message || 'Error al crear remuestreo' });
            }
        } catch (error) {
            showToast({ type: 'error', message: 'Excepción al crear remuestreo' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="shadcn-scope flex min-h-[400px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
    );

    const tabPadding = isMobile ? 'px-4' : 'px-8';

    return (
        <div className="shadcn-scope p-4">
            <div className="flex flex-col gap-6">
                <PageHeader
                    title="Nuevo Remuestreo"
                    subtitle={`Basado en Ficha N° ${originalFicha?.fichaingresoservicio || '-'}`}
                    onBack={() => setActiveSubmodule('ma-ficha-detalle')}
                    breadcrumbItems={[
                        { label: `Ficha N° ${originalFicha?.fichaingresoservicio || '-'}`, onClick: () => setActiveSubmodule('ma-ficha-detalle') },
                        { label: 'Nuevo remuestreo' }
                    ]}
                    rightSection={
                        <Button variant="outline" onClick={() => setActiveSubmodule('ma-ficha-detalle')}>
                            <IconX size={18} />
                            Cancelar
                        </Button>
                    }
                />

                <div className="flex items-start gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-primary" />
                    <div>
                        <p className="m-0 text-sm font-semibold text-foreground">Información de Remuestreo</p>
                        <p className="m-0 mt-0.5 text-[13px] text-muted-foreground">
                            Se ha pre-llenado la información basándose en la ficha original. Por favor revise y ajuste los datos si es necesario antes de confirmar la creación de la nueva ficha.
                        </p>
                    </div>
                </div>

                {otrosPuntos.length > 0 && (
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <div className="mb-1.5 flex items-center justify-between gap-3">
                            <p className="m-0 text-sm font-semibold text-foreground">Esta ficha es un punto de una visita con {otrosPuntos.length + 1} puntos</p>
                            <button
                                type="button"
                                className="text-xs text-primary underline-offset-2 hover:underline"
                                onClick={() => setPuntosExtra(puntosExtra.size === otrosPuntos.length ? new Set() : new Set(otrosPuntos.map(p => p.id)))}
                            >
                                {puntosExtra.size === otrosPuntos.length ? 'Quitar todos' : 'Marcar todos'}
                            </button>
                        </div>
                        <p className="m-0 mb-2 text-[13px] text-muted-foreground">
                            Por defecto se remuestrea solo este punto. Marque los que también quiera remuestrear: se crea una visita nueva con
                            ellos, cada uno con sus coordenadas y análisis originales (se pueden ajustar después en su ficha).
                        </p>
                        <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 p-0">
                            {otrosPuntos.map(p => (
                                <li key={p.id}>
                                    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                                        <input
                                            type="checkbox"
                                            checked={puntosExtra.has(p.id)}
                                            onChange={(e) => setPuntosExtra(prev => {
                                                const sig = new Set(prev);
                                                if (e.target.checked) sig.add(p.id); else sig.delete(p.id);
                                                return sig;
                                            })}
                                        />
                                        <span>{p.punto}</span>
                                    </label>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <Card className="overflow-hidden rounded-2xl p-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <div className={cn('flex justify-center', tabPadding)}>
                            <TabsList>
                                <TabsTrigger value="antecedentes" className="gap-1.5">
                                    <IconClipboardList size={18} />
                                    Antecedentes
                                </TabsTrigger>
                                <TabsTrigger value="analisis" className="gap-1.5">
                                    <IconFlask size={18} />
                                    Análisis
                                </TabsTrigger>
                                <TabsTrigger value="observaciones" className="gap-1.5">
                                    <IconFileText size={18} />
                                    Observaciones
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="antecedentes" className={cn('mt-0 flex flex-col gap-6 py-6', tabPadding)}>
                            <AntecedentesForm ref={antecedentesRef} initialData={mappedInitialDataRef.current} />
                            <div className="flex justify-end">
                                <Button onClick={() => setActiveTab('analisis')}>
                                    Siguiente
                                    <IconArrowRight size={18} />
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="analisis" className={cn('mt-0 flex flex-col gap-6 py-6', tabPadding)}>
                            <AnalysisForm
                                savedAnalysis={analysisList}
                                onSavedAnalysisChange={setAnalysisList}
                                costoOperativo={costoOperativo}
                                onCostoOperativoChange={setCostoOperativo}
                            />
                            <div className="flex justify-end">
                                <Button onClick={() => setActiveTab('observaciones')}>
                                    Siguiente
                                    <IconArrowRight size={18} />
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="observaciones" className={cn('mt-0 flex flex-col gap-6 py-6', tabPadding)}>
                            <div>
                                <label className="mb-2 block text-[13px] font-semibold text-foreground">Observaciones del Remuestreo *</label>
                                <Textarea
                                    value={observaciones}
                                    onChange={(e) => setObservaciones(e.target.value)}
                                    placeholder="Especifique las observaciones de este remuestreo..."
                                    rows={5}
                                />
                            </div>
                            <div className="flex justify-center">
                                <Button
                                    size="lg"
                                    className="bg-violet-500 text-white hover:bg-violet-600"
                                    onClick={handleCreateRemuestreo}
                                    disabled={saving || !observaciones.trim()}
                                >
                                    {saving ? (
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    ) : (
                                        <IconDeviceFloppy size={20} />
                                    )}
                                    Crear Ficha de Remuestreo
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                </Card>
            </div>
        </div>
    );
};

export const RemuestreoPage: React.FC = () => {
    return (
        <CatalogosProvider>
            <RemuestreoPageContent />
        </CatalogosProvider>
    );
};
