import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconSearch,
    IconTrash,
    IconDeviceFloppy,
    IconCheck,
    IconX,
    IconAdjustmentsHorizontal,
    IconTable,
    IconArrowsDownUp
} from '@tabler/icons-react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Badge } from '../../../components/ui/badge';
import { Combobox, type ComboboxOption } from '../../../components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../components/ui/table';
import { cn } from '../../../lib/utils';

export interface CostoOperativoState {
    enabled: boolean;
    uf: number | string;
}

interface AnalysisFormProps {
    savedAnalysis: any[];
    onSavedAnalysisChange: (newAnalysis: any[]) => void;
    costoOperativo?: CostoOperativoState;
    onCostoOperativoChange?: (next: CostoOperativoState) => void;
}

const DEFAULT_COSTO: CostoOperativoState = { enabled: true, uf: '' };

export const AnalysisForm: React.FC<AnalysisFormProps> = ({ savedAnalysis, onSavedAnalysisChange, costoOperativo, onCostoOperativoChange }) => {
    const costo = costoOperativo || DEFAULT_COSTO;
    const updateCosto = (next: Partial<CostoOperativoState>) => {
        onCostoOperativoChange && onCostoOperativoChange({ ...costo, ...next });
    };
    const { showToast } = useToast();
    const catalogos = useCachedCatalogos();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // ===== ESTADO: Filtros de Búsqueda =====
    const [normativa, setNormativa] = useState<string | null>(null);
    const [referencia, setReferencia] = useState<string | null>(null);
    const [searchText, setSearchText] = useState<string>('');

    // ===== ESTADO: Catálogos =====
    const [normativas, setNormativas] = useState<any[]>([]);
    const [referencias, setReferencias] = useState<any[]>([]);
    const [analysisResults, setAnalysisResults] = useState<any[]>([]);
    const [tiposMuestra] = useState([
        { value: 'Laboratorio', label: 'Laboratorio' },
        { value: 'Terreno', label: 'Terreno' }
    ]);
    const [laboratorios, setLaboratorios] = useState<any[]>([]);
    const [tiposEntrega, setTiposEntrega] = useState<any[]>([]);

    // ===== ESTADO: Configuración =====
    const [tipoMuestra, setTipoMuestra] = useState<string | null>(null);

    // ===== ESTADO: Selección de Análisis =====
    const [selectedAnalysis, setSelectedAnalysis] = useState<Set<string>>(new Set());
    const [tempLabs, setTempLabs] = useState<Record<string, string>>({});
    const [tempLabs2, setTempLabs2] = useState<Record<string, string>>({});
    const [tempDeliveries, setTempDeliveries] = useState<Record<string, string>>({});

    // ===== ESTADO: aplicar-a-todos (selects de la fila de cabecera) =====
    const [bulkDeliveryValue, setBulkDeliveryValue] = useState<string | undefined>(undefined);
    const [bulkLabValue, setBulkLabValue] = useState<string | undefined>(undefined);
    const [bulkLab2Value, setBulkLab2Value] = useState<string | undefined>(undefined);

    // ===== ESTADO: UF Total de Ficha =====
    const [totalRealUF, setTotalRealUF] = useState<number | string>('');

    // Sincronizar estado inicial si se cargan datos (incluye Costo Operativo si está activo)
    useEffect(() => {
        const analysisSum = savedAnalysis.reduce((acc, curr) => acc + Number(curr.uf_individual || 0), 0);
        const costoSum = costo.enabled ? Number(costo.uf || 0) : 0;
        const sum = analysisSum + costoSum;
        if (savedAnalysis.length > 0 || costoSum > 0) {
            if (sum > 0) {
                setTotalRealUF(sum.toFixed(2));
            } else if (totalRealUF !== '') {
                setTotalRealUF('');
            }
        } else if (totalRealUF !== '') {
            setTotalRealUF('');
        }
    }, [savedAnalysis, costo.enabled, costo.uf]);

    // ===== FUNCIONES: Carga de Catálogos =====
    const loadNormativas = async () => {
        try {
            const data = await catalogos.getNormativas();
            setNormativas(data || []);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar normativas' });
        }
    };

    const loadLaboratorios = async () => {
        try {
            const data = await catalogos.getLaboratorios();
            setLaboratorios(data || []);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar laboratorios' });
        }
    };

    const loadTiposEntrega = async () => {
        try {
            const data = await catalogos.getTiposEntrega();
            setTiposEntrega(data || []);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar tipos de entrega' });
        }
    };

    useEffect(() => {
        loadNormativas();
        loadLaboratorios();
        loadTiposEntrega();
    }, []);

    // ===== FUNCIONES: Cascadas =====
    const loadReferencias = async (normativaId: string) => {
        try {
            const data = await catalogos.getReferenciasByNormativa(normativaId);
            setReferencias(data || []);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar referencias' });
        }
    };

    const loadAnalysisResults = async (normativaId: string, referenciaId: string) => {
        try {
            const data = await catalogos.getAnalysisByNormativaReferencia(normativaId, referenciaId);
            setAnalysisResults(data || []);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar análisis' });
        }
    };

    useEffect(() => {
        if (normativa) {
            loadReferencias(normativa);
            setReferencia(null);
        } else {
            setReferencias([]);
        }
    }, [normativa]);

    useEffect(() => {
        if (normativa && referencia) {
            loadAnalysisResults(normativa, referencia);
        } else {
            setAnalysisResults([]);
            setSelectedAnalysis(new Set());
        }
    }, [normativa, referencia]);

    // ===== FUNCIONES: Filtrado =====
    const filteredAnalysis = useMemo(() =>
        analysisResults.filter(analysis =>
            analysis.nombre_tecnica?.toLowerCase().includes(searchText.toLowerCase()) ||
            analysis.id_referenciaanalisis?.toString().includes(searchText)
        ),
    [analysisResults, searchText]);

    // ===== FUNCIONES: Selección de Análisis =====
    const handleSelectAll = () => {
        const allIds = new Set(filteredAnalysis.map(a => String(a.id_referenciaanalisis)));
        setSelectedAnalysis(allIds);
    };

    const handleSelectNone = () => {
        setSelectedAnalysis(new Set());
        setTempLabs({});
        setTempLabs2({});
        setTempDeliveries({});
    };

    const handleToggleAnalysis = (id: string) => {
        const idStr = String(id);
        const newSelection = new Set(selectedAnalysis);
        if (newSelection.has(idStr)) {
            newSelection.delete(idStr);
            const newTempLabs = { ...tempLabs };
            delete newTempLabs[idStr];
            setTempLabs(newTempLabs);

            const newTempLabs2 = { ...tempLabs2 };
            delete newTempLabs2[idStr];
            setTempLabs2(newTempLabs2);

            const newTempDeliveries = { ...tempDeliveries };
            delete newTempDeliveries[idStr];
            setTempDeliveries(newTempDeliveries);
        } else {
            newSelection.add(idStr);
            setSearchText('');
        }
        setSelectedAnalysis(newSelection);
    };

    const handleTempLabChange = (analysisId: string, labId: string) => {
        setTempLabs(prev => ({ ...prev, [analysisId]: labId }));
    };

    const handleTempLab2Change = (analysisId: string, labId: string) => {
        setTempLabs2(prev => ({ ...prev, [analysisId]: labId }));
    };

    const handleTempDeliveryChange = (analysisId: string, deliveryId: string) => {
        setTempDeliveries(prev => ({ ...prev, [analysisId]: deliveryId }));
    };

    const handleBulkDeliveryChange = (deliveryId: string) => {
        const newDeliveries = { ...tempDeliveries };
        selectedAnalysis.forEach(id => {
            newDeliveries[id] = deliveryId;
        });
        setTempDeliveries(newDeliveries);
        setBulkDeliveryValue(undefined);
        showToast({ type: 'info', message: 'Tipo de entrega aplicado a todos' });
    };

    const handleBulkLabChange = (labId: string) => {
        const newLabs = { ...tempLabs };
        selectedAnalysis.forEach(id => {
            newLabs[id] = labId;
        });
        setTempLabs(newLabs);
        setBulkLabValue(undefined);
        showToast({ type: 'info', message: 'Laboratorio derivado aplicado a todos' });
    };

    const handleBulkLab2Change = (labId: string) => {
        const newLabs2 = { ...tempLabs2 };
        selectedAnalysis.forEach(id => {
            newLabs2[id] = labId;
        });
        setTempLabs2(newLabs2);
        setBulkLab2Value(undefined);
        showToast({ type: 'info', message: 'Laboratorio secundario aplicado a todos' });
    };

    // ===== FUNCIONES: Grabar Análisis =====
    const handleSaveAnalysis = () => {
        if (!normativa || !referencia) {
            showToast({ type: 'warning', message: 'Debes seleccionar una Normativa y Referencia' });
            return;
        }

        if (selectedAnalysis.size === 0) {
            showToast({ type: 'warning', message: 'Debes seleccionar al menos un análisis' });
            return;
        }

        if (!tipoMuestra) {
            showToast({ type: 'warning', message: 'Debes seleccionar el Tipo de Muestra' });
            return;
        }

        if (tipoMuestra === 'Laboratorio') {
            const missingDeliveries = Array.from(selectedAnalysis).filter(id => !tempDeliveries[id]);
            if (missingDeliveries.length > 0) {
                showToast({ type: 'warning', message: `Faltan tipos de entrega por asignar` });
                return;
            }

            const missingLabs = Array.from(selectedAnalysis).filter(id => !tempLabs[id]);
            if (missingLabs.length > 0) {
                showToast({ type: 'warning', message: `Faltan laboratorios por asignar` });
                return;
            }
        }

        // F-01b: capturar normativa y tabla/referencia activas para guardarlas POR análisis
        const normativaObj = normativas.find(n => String(n.id_normativa) === String(normativa));
        const referenciaObj = referencias.find(r => String(r.id_normativareferencia) === String(referencia));

        const newSavedAnalysis = Array.from(selectedAnalysis).map((id, index) => {
            const analysis = analysisResults.find(a => String(a.id_referenciaanalisis) === id);

            let specificDeliveryId = tempDeliveries[id];
            if (tipoMuestra === 'Terreno') {
                const directaOption = tiposEntrega.find((t: any) => t.nombre_tipoentrega && t.nombre_tipoentrega.toUpperCase().includes('DIRECTA'));
                specificDeliveryId = directaOption?.id_tipoentrega || '';
            }

            const selectedTipoEntregaObj = tiposEntrega.find((t: any) => String(t.id_tipoentrega) === String(specificDeliveryId));

            const specificLabId = tempLabs[id];
            const selectedLabObj = laboratorios.find((l: any) => String(l.id_laboratorioensayo) === String(specificLabId));

            const specificLabId2 = tempLabs2[id];
            const selectedLabObj2 = laboratorios.find((l: any) => String(l.id_laboratorioensayo) === String(specificLabId2));

            return {
                ...analysis,
                tipo_analisis: tipoMuestra,
                nombre_tipoentrega: selectedTipoEntregaObj?.nombre_tipoentrega || '',
                uf_individual: 0,
                // Normativa y referencia por análisis (F-01b)
                id_normativa: normativaObj?.id_normativa ?? Number(normativa),
                nombre_normativa: normativaObj?.nombre_normativa || '',
                id_normativareferencia: referenciaObj?.id_normativareferencia ?? Number(referencia),
                nombre_normativareferencia: referenciaObj?.nombre_normativareferencia || '',
                // Laboratorio 1
                nombre_laboratorioensayo: tipoMuestra === 'Terreno' ? '' : (selectedLabObj?.nombre_laboratorioensayo || ''),
                id_laboratorioensayo: tipoMuestra === 'Terreno' ? 0 : (selectedLabObj?.id_laboratorioensayo || 0),
                // Laboratorio 2
                nombre_laboratorioensayo_2: tipoMuestra === 'Terreno' ? '' : (selectedLabObj2?.nombre_laboratorioensayo || ''),
                id_laboratorioensayo_2: tipoMuestra === 'Terreno' ? 0 : (selectedLabObj2?.id_laboratorioensayo || 0),

                item: savedAnalysis.length + index + 1,
                id_tipoentrega: selectedTipoEntregaObj?.id_tipoentrega || specificDeliveryId,
                id_transporte: 0,
                resultado_fecha: '  /  /    ',
                savedId: `${id}-${Date.now()}`
            };
        });

        onSavedAnalysisChange([...savedAnalysis, ...newSavedAnalysis]);
        setSelectedAnalysis(new Set());
        setTempLabs({});
        setTempLabs2({});
        setTempDeliveries({});
        setSearchText('');
        setTipoMuestra(null);

        showToast({ type: 'success', message: `${newSavedAnalysis.length} análisis grabados` });
    };

    const handleUfChange = (savedId: string, newValue: number | string | null) => {
        const updatedAnalysis = savedAnalysis.map((item: any) => {
            if (item.savedId === savedId) return { ...item, uf_individual: newValue };
            return item;
        });
        onSavedAnalysisChange(updatedAnalysis);
    };

    // Análisis fijos (pH/Temperatura): al elegir la normativa/tabla, se copian
    // sus límites y errores desde la opción seleccionada.
    const handleFixedRefChange = (savedId: string, refId: string | null) => {
        const updated = savedAnalysis.map((item: any) => {
            if (item.savedId !== savedId) return item;
            const opt = (item.opciones || []).find((o: any) => String(o.id_referenciaanalisis) === String(refId));
            if (!opt) {
                return {
                    ...item,
                    id_referenciaanalisis: null, id_tecnica: null,
                    id_normativa: null, nombre_normativa: '',
                    id_normativareferencia: null, nombre_normativareferencia: '',
                    limitemax_d: null, limitemax_h: null, llevaerror: 'N', error_min: null, error_max: null
                };
            }
            return {
                ...item,
                id_referenciaanalisis: opt.id_referenciaanalisis, id_tecnica: opt.id_tecnica,
                id_normativa: opt.id_normativa, nombre_normativa: opt.nombre_normativa,
                id_normativareferencia: opt.id_normativareferencia, nombre_normativareferencia: opt.nombre_normativareferencia,
                limitemax_d: opt.limitemax_d, limitemax_h: opt.limitemax_h,
                llevaerror: opt.llevaerror, error_min: opt.error_min, error_max: opt.error_max
            };
        });
        onSavedAnalysisChange(updated);
    };

    const handleDeleteSavedAnalysis = (savedId: string) => {
        const updatedAnalysis = savedAnalysis.filter((a: any) => a.savedId !== savedId);
        onSavedAnalysisChange(updatedAnalysis);
        showToast({ type: 'info', message: 'Análisis eliminado' });
    };

    const handleTotalUfChange = (val: number | string | null) => {
        setTotalRealUF(val ?? '');
        if (!val || isNaN(Number(val))) return;

        const total = Number(val);
        // El Costo Operativo (si está activo) NO se redistribuye: conserva su UF
        const costoUF = costo.enabled ? Number(costo.uf || 0) : 0;
        const remaining = Math.max(0, total - costoUF);
        if (savedAnalysis.length > 0) {
            const divide = +(remaining / savedAnalysis.length).toFixed(2);
            const updated = savedAnalysis.map((a: any) => ({ ...a, uf_individual: divide }));
            onSavedAnalysisChange(updated);
        }
    };

    const selectedRows = Array.from(selectedAnalysis).map(id => ({
        id,
        analysis: analysisResults.find(a => String(a.id_referenciaanalisis) === id),
    }));

    return (
        <div className="flex flex-col" style={{ gap: isMobile ? 16 : 24 }}>
            <Card className="p-5">
                <div className={cn('grid gap-6', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                    {/* Búsqueda */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <IconSearch size={18} className="text-primary" />
                            <span className="text-[13px] font-semibold text-primary">Búsqueda de Análisis</span>
                        </div>

                        <Field label="Normativa">
                            <Combobox
                                placeholder="Seleccione normativa..."
                                options={normativas.map(n => ({ value: String(n.id_normativa), label: n.nombre_normativa }))}
                                value={normativa || undefined}
                                onValueChange={(val) => setNormativa(val || '')}
                            />
                        </Field>

                        <Field label="Referencia">
                            <Combobox
                                placeholder="Seleccione referencia..."
                                options={referencias.map(r => ({ value: String(r.id_normativareferencia), label: r.nombre_normativareferencia }))}
                                value={referencia || undefined}
                                onValueChange={(val) => setReferencia(val || '')}
                                disabled={!normativa}
                            />
                        </Field>

                        <Field label="Buscar Análisis">
                            <div className="relative">
                                <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="Filtrar por nombre o código..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    disabled={!referencia}
                                    className="pl-8"
                                />
                            </div>
                        </Field>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleSelectAll}
                                disabled={!referencia || filteredAnalysis.length === 0}
                            >
                                <IconCheck size={14} /> Todos
                            </Button>
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={handleSelectNone}
                                disabled={!referencia || selectedAnalysis.size === 0}
                            >
                                <IconX size={14} /> Ninguno
                            </Button>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-border">
                            <Table>
                                <TableHeader className="sticky top-0 bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Análisis</TableHead>
                                        <TableHead className="w-[50px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {catalogos.isLoading(`analysis-${normativa}-${referencia}`) ? (
                                        <TableRow><TableCell colSpan={2} className="text-center py-4">Cargando...</TableCell></TableRow>
                                    ) : filteredAnalysis.length > 0 ? (
                                        filteredAnalysis.map(analysis => (
                                            <TableRow key={analysis.id_referenciaanalisis}>
                                                <TableCell className="py-1.5">{analysis.nombre_tecnica}</TableCell>
                                                <TableCell className="py-1.5 text-center">
                                                    <Checkbox
                                                        checked={selectedAnalysis.has(String(analysis.id_referenciaanalisis))}
                                                        onCheckedChange={() => handleToggleAnalysis(analysis.id_referenciaanalisis)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={2} className="text-center py-4 text-muted-foreground">{normativa && referencia ? 'Sin resultados' : 'Seleccione criterios'}</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Configuración */}
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <IconAdjustmentsHorizontal size={18} style={{ color: '#9c36b5' }} />
                            <span className="text-[13px] font-semibold" style={{ color: '#9c36b5' }}>Configuración de Análisis</span>
                        </div>

                        <Field label="Tipo de Muestra *">
                            <Combobox
                                placeholder="OBLIGATORIO"
                                options={tiposMuestra}
                                value={tipoMuestra || undefined}
                                onValueChange={(val) => setTipoMuestra(val || '')}
                                disabled={!referencia}
                            />
                        </Field>

                        {selectedAnalysis.size > 0 && (
                            <>
                                <SectionDivider>Seleccionados ({selectedAnalysis.size})</SectionDivider>
                                <div className="max-h-[345px] overflow-y-auto">
                                    {isMobile ? (
                                        <div className="flex flex-col gap-2 pb-4">
                                            {selectedRows.map(({ id, analysis }) => (
                                                <div key={id} className="rounded-lg border border-border bg-muted/40 p-2.5">
                                                    <div className="mb-2 flex items-center justify-between gap-2">
                                                        <span className="flex-1 text-xs font-semibold">{analysis?.nombre_tecnica || id}</span>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleToggleAnalysis(id)} title="Quitar">
                                                            <IconTrash size={14} />
                                                        </Button>
                                                    </div>
                                                    {tipoMuestra === 'Laboratorio' && (
                                                        <div className="flex flex-col gap-2">
                                                            <Field label="Tipo Entrega">
                                                                <Combobox
                                                                    options={tiposEntrega.map(t => ({ value: String(t.id_tipoentrega), label: t.nombre_tipoentrega }))}
                                                                    value={tempDeliveries[id] || undefined}
                                                                    onValueChange={(val) => handleTempDeliveryChange(id, val || '')}
                                                                />
                                                            </Field>
                                                            <Field label="Laboratorio Derivado">
                                                                <Combobox
                                                                    options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                    value={tempLabs[id] || undefined}
                                                                    onValueChange={(val) => handleTempLabChange(id, val || '')}
                                                                    placeholder="Seleccione..."
                                                                />
                                                            </Field>
                                                            <Field label="Laboratorio Secundario">
                                                                <Combobox
                                                                    options={clearableOptions(laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo })))}
                                                                    value={tempLabs2[id] || undefined}
                                                                    onValueChange={(val) => handleTempLab2Change(id, val || '')}
                                                                    placeholder="(Opcional)"
                                                                />
                                                            </Field>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-muted/50">
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Análisis</TableHead>
                                                    {tipoMuestra === 'Laboratorio' && (
                                                        <>
                                                            <TableHead className="w-[160px]">Entrega</TableHead>
                                                            <TableHead className="w-[180px]">Lab. Derivado</TableHead>
                                                            <TableHead className="w-[180px]">Lab. Secundario</TableHead>
                                                        </>
                                                    )}
                                                    <TableHead className="w-10" />
                                                </TableRow>
                                                {tipoMuestra === 'Laboratorio' && selectedAnalysis.size > 1 && (
                                                    <TableRow className="bg-primary/5 hover:bg-primary/5">
                                                        <TableCell className="py-1.5">
                                                            <div className="flex items-center gap-1">
                                                                <IconArrowsDownUp size={14} className="text-primary" />
                                                                <span className="text-[11px] font-bold text-primary">Aplicar a todos:</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-1.5">
                                                            <Combobox
                                                                options={tiposEntrega.map(t => ({ value: String(t.id_tipoentrega), label: t.nombre_tipoentrega }))}
                                                                value={bulkDeliveryValue}
                                                                placeholder="Seleccionar todos..."
                                                                onValueChange={(val) => val && handleBulkDeliveryChange(val)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-1.5">
                                                            <Combobox
                                                                options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                value={bulkLabValue}
                                                                placeholder="Seleccionar todos..."
                                                                onValueChange={(val) => val && handleBulkLabChange(val)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="py-1.5">
                                                            <Combobox
                                                                options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                value={bulkLab2Value}
                                                                placeholder="Seleccionar todos..."
                                                                onValueChange={(val) => val && handleBulkLab2Change(val)}
                                                            />
                                                        </TableCell>
                                                        <TableCell />
                                                    </TableRow>
                                                )}
                                            </TableHeader>
                                            <TableBody>
                                                {selectedRows.map(({ id, analysis }) => (
                                                    <TableRow key={id}>
                                                        <TableCell className="py-1.5 font-medium">{analysis?.nombre_tecnica || id}</TableCell>
                                                        {tipoMuestra === 'Laboratorio' && (
                                                            <>
                                                                <TableCell className="py-1.5">
                                                                    <Combobox
                                                                        className="min-w-[140px]"
                                                                        options={tiposEntrega.map(t => ({ value: String(t.id_tipoentrega), label: t.nombre_tipoentrega }))}
                                                                        value={tempDeliveries[id] || undefined}
                                                                        onValueChange={(val) => handleTempDeliveryChange(id, val || '')}
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="py-1.5">
                                                                    <Combobox
                                                                        options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                        value={tempLabs[id] || undefined}
                                                                        onValueChange={(val) => handleTempLabChange(id, val || '')}
                                                                        placeholder="..."
                                                                    />
                                                                </TableCell>
                                                                <TableCell className="py-1.5">
                                                                    <Combobox
                                                                        options={clearableOptions(laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo })))}
                                                                        value={tempLabs2[id] || undefined}
                                                                        onValueChange={(val) => handleTempLab2Change(id, val || '')}
                                                                        placeholder="(Opcional)"
                                                                    />
                                                                </TableCell>
                                                            </>
                                                        )}
                                                        <TableCell className="text-center">
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleToggleAnalysis(id)} title="Quitar">
                                                                <IconTrash size={14} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </>
                        )}

                        <Button
                            className="mt-auto h-11 bg-[#0d9488] text-white hover:bg-[#0d9488]/90"
                            onClick={handleSaveAnalysis}
                            disabled={
                                selectedAnalysis.size === 0 || !tipoMuestra ||
                                (tipoMuestra === 'Laboratorio' && (
                                    Array.from(selectedAnalysis).some(id => !tempDeliveries[id]) ||
                                    Array.from(selectedAnalysis).some(id => !tempLabs[id])
                                ))
                            }
                        >
                            <IconDeviceFloppy size={20} /> Grabar Análisis
                        </Button>
                    </div>
                </div>
            </Card>

            <Card className="p-5">
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <IconTable size={18} style={{ color: '#4f46e5' }} />
                            <span className="text-[13px] font-semibold" style={{ color: '#4f46e5' }}>Análisis Grabados</span>
                        </div>
                        <Badge variant="secondary">{savedAnalysis.length}</Badge>
                    </div>

                    <div className="overflow-x-auto">
                        <Table style={{ minWidth: 1100 }}>
                            <TableHeader className="sticky top-0 bg-muted/50">
                                <TableRow className="hover:bg-transparent">
                                    {['Análisis', 'Normativa', 'Tabla / Referencia', 'Muestra', 'L. Min', 'L. Max', 'Error', 'Err. Min', 'Err. Max', 'Entrega', 'U.F.', 'Lab. Derivado', 'Lab. Secundario', ''].map((h, i) => (
                                        <TableHead key={i} className={cn('whitespace-nowrap', i >= 4 && i <= 8 && 'text-right')}>{h}</TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Fila SIEMPRE presente: Costo Operativo (opcional, marcable) */}
                                <TableRow className={cn(costo.enabled && 'bg-warning/10')}>
                                    <TableCell className="py-1.5 font-semibold">
                                        <div className="flex items-center gap-2">
                                            <Checkbox checked={costo.enabled} onCheckedChange={(checked) => updateCosto({ enabled: checked === true })} />
                                            <span className={cn('text-sm font-bold', costo.enabled ? 'text-warning' : 'text-muted-foreground')}>Costo Operativo</span>
                                        </div>
                                    </TableCell>
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <TableCell key={i} className={cn('py-1.5 text-muted-foreground', i >= 3 && i <= 7 && 'text-right')}>—</TableCell>
                                    ))}
                                    <TableCell className="py-1.5">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            value={costo.uf === '' ? '' : Number(costo.uf)}
                                            onChange={(e) => updateCosto({ uf: e.target.value === '' ? '' : Number(e.target.value) })}
                                            onFocus={(e) => { if (String(costo.uf) === '0') updateCosto({ uf: '' }); e.currentTarget.select(); }}
                                            disabled={!costo.enabled}
                                            placeholder="0.00"
                                        />
                                    </TableCell>
                                    <TableCell className="py-1.5 text-muted-foreground">—</TableCell>
                                    <TableCell className="py-1.5 text-muted-foreground">—</TableCell>
                                    <TableCell />
                                </TableRow>
                                {savedAnalysis.length > 0 ? (
                                    savedAnalysis.map(analysis => {
                                        const isFixed = !!analysis._fijo;
                                        return (
                                            <TableRow key={analysis.savedId} className={cn(isFixed && 'bg-primary/5')}>
                                                <TableCell className="py-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm">{analysis.nombre_tecnica}</span>
                                                        {isFixed && <Badge variant="outline" className="text-[10px]">Fijo</Badge>}
                                                    </div>
                                                </TableCell>
                                                {isFixed ? (
                                                    <TableCell className="py-1.5" colSpan={2}>
                                                        <Combobox
                                                            className="min-w-[230px]"
                                                            placeholder="Seleccione normativa / tabla"
                                                            options={(analysis.opciones || []).map((o: any) => ({
                                                                value: String(o.id_referenciaanalisis),
                                                                label: `${o.nombre_normativa} / ${o.nombre_normativareferencia}`
                                                            }))}
                                                            value={analysis.id_referenciaanalisis ? String(analysis.id_referenciaanalisis) : undefined}
                                                            onValueChange={(val) => handleFixedRefChange(analysis.savedId, val)}
                                                        />
                                                    </TableCell>
                                                ) : (
                                                    <>
                                                        <TableCell className="py-1.5">{analysis.nombre_normativa || '-'}</TableCell>
                                                        <TableCell className="py-1.5">{analysis.nombre_normativareferencia || '-'}</TableCell>
                                                    </>
                                                )}
                                                <TableCell className="py-1.5">{analysis.tipo_analisis}</TableCell>
                                                <TableCell className="py-1.5 text-right">{analysis.limitemax_d ?? '-'}</TableCell>
                                                <TableCell className="py-1.5 text-right">{analysis.limitemax_h ?? '-'}</TableCell>
                                                <TableCell className="py-1.5 text-right">{['S', 's', 'Y', 'y', true].includes(analysis.llevaerror) ? 'Sí' : 'No'}</TableCell>
                                                <TableCell className="py-1.5 text-right">{analysis.error_min ?? '-'}</TableCell>
                                                <TableCell className="py-1.5 text-right">{analysis.error_max ?? '-'}</TableCell>
                                                <TableCell className="py-1.5">{analysis.nombre_tipoentrega}</TableCell>
                                                <TableCell className="py-1.5">
                                                    <Input
                                                        type="number"
                                                        step="0.01"
                                                        value={analysis.uf_individual === '' ? '' : Number(analysis.uf_individual)}
                                                        onChange={(e) => handleUfChange(analysis.savedId, e.target.value === '' ? '' : Number(e.target.value))}
                                                        onFocus={(e) => { if (String(analysis.uf_individual) === '0') handleUfChange(analysis.savedId, ''); e.currentTarget.select(); }}
                                                    />
                                                </TableCell>
                                                <TableCell className="py-1.5">{analysis.nombre_laboratorioensayo || '-'}</TableCell>
                                                <TableCell className="py-1.5">{analysis.nombre_laboratorioensayo_2 || '-'}</TableCell>
                                                <TableCell className="text-center">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteSavedAnalysis(analysis.savedId)} title="Eliminar">
                                                        <IconTrash size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow><TableCell colSpan={14} className="text-center py-8 text-muted-foreground">Aún no hay análisis grabados (agregue al menos uno)</TableCell></TableRow>
                                )}
                            </TableBody>
                            {(savedAnalysis.length > 0 || costo.enabled) && (
                                <tfoot className="sticky bottom-0 bg-muted/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={10} className="py-2 text-right font-bold text-sm" style={{ color: '#4f46e5' }}>
                                            UF TOTAL DE LA FICHA:
                                        </TableCell>
                                        <TableCell className="py-1.5">
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="bg-primary/5 font-extrabold"
                                                value={totalRealUF === '' ? '' : Number(totalRealUF)}
                                                onChange={(e) => handleTotalUfChange(e.target.value === '' ? '' : Number(e.target.value))}
                                                placeholder="0.00"
                                            />
                                        </TableCell>
                                        <TableCell colSpan={3} />
                                    </TableRow>
                                </tfoot>
                            )}
                        </Table>
                    </div>
                </div>
            </Card>
        </div>
    );
};

function clearableOptions(options: ComboboxOption[]): ComboboxOption[] {
    return [{ value: '', label: '(Ninguno)' }, ...options];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
    return (
        <div className="my-1 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">{children}</span>
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}
