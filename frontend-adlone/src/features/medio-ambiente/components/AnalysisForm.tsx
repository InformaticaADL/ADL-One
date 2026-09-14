import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useCachedCatalogos } from '../hooks/useCachedCatalogos';
import {
    Typography,
    Card,
    Select,
    Input,
    Button,
    Table,
    Checkbox,
    InputNumber,
    Divider,
    Tag,
} from 'antd';
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

const { Text } = Typography;

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
        showToast({ type: 'info', message: 'Tipo de entrega aplicado a todos' });
    };

    const handleBulkLabChange = (labId: string) => {
        const newLabs = { ...tempLabs };
        selectedAnalysis.forEach(id => {
            newLabs[id] = labId;
        });
        setTempLabs(newLabs);
        showToast({ type: 'info', message: 'Laboratorio derivado aplicado a todos' });
    };

    const handleBulkLab2Change = (labId: string) => {
        const newLabs2 = { ...tempLabs2 };
        selectedAnalysis.forEach(id => {
            newLabs2[id] = labId;
        });
        setTempLabs2(newLabs2);
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 16 : 24 }}>
            <Card>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
                    {/* Búsqueda */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <IconSearch size={18} color="var(--app-accent-text)" />
                            <Text strong style={{ fontSize: 13, color: 'var(--app-accent-text)' }}>Búsqueda de Análisis</Text>
                        </div>

                        <Field label="Normativa">
                            <Select
                                placeholder="Seleccione normativa..."
                                options={normativas.map(n => ({ value: String(n.id_normativa), label: n.nombre_normativa }))}
                                value={normativa || undefined}
                                onChange={(val) => setNormativa(val || '')}
                                showSearch
                                style={{ width: '100%' }}
                            />
                        </Field>

                        <Field label="Referencia">
                            <Select
                                placeholder="Seleccione referencia..."
                                options={referencias.map(r => ({ value: String(r.id_normativareferencia), label: r.nombre_normativareferencia }))}
                                value={referencia || undefined}
                                onChange={(val) => setReferencia(val || '')}
                                disabled={!normativa}
                                showSearch
                                style={{ width: '100%' }}
                            />
                        </Field>

                        <Field label="Buscar Análisis">
                            <Input
                                placeholder="Filtrar por nombre o código..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                disabled={!referencia}
                                prefix={<IconSearch size={14} />}
                            />
                        </Field>

                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button
                                style={{ flex: 1 }}
                                onClick={handleSelectAll}
                                disabled={!referencia || filteredAnalysis.length === 0}
                                icon={<IconCheck size={14} />}
                            >
                                Todos
                            </Button>
                            <Button
                                style={{ flex: 1 }}
                                onClick={handleSelectNone}
                                disabled={!referencia || selectedAnalysis.size === 0}
                                icon={<IconX size={14} />}
                            >
                                Ninguno
                            </Button>
                        </div>

                        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--app-border)', borderRadius: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead style={{ backgroundColor: 'var(--app-hover-bg)', position: 'sticky', top: 0 }}>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600 }}>Análisis</th>
                                        <th style={{ width: 50, padding: '6px 8px' }} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {catalogos.isLoading(`analysis-${normativa}-${referencia}`) ? (
                                        <tr><td colSpan={2} style={{ textAlign: 'center', padding: 16 }}>Cargando...</td></tr>
                                    ) : filteredAnalysis.length > 0 ? (
                                        filteredAnalysis.map(analysis => (
                                            <tr key={analysis.id_referenciaanalisis} style={{ borderTop: '1px solid var(--app-border)' }}>
                                                <td style={{ padding: '6px 8px' }}>{analysis.nombre_tecnica}</td>
                                                <td style={{ textAlign: 'center', padding: '6px 8px' }}>
                                                    <Checkbox
                                                        checked={selectedAnalysis.has(String(analysis.id_referenciaanalisis))}
                                                        onChange={() => handleToggleAnalysis(analysis.id_referenciaanalisis)}
                                                    />
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={2} style={{ textAlign: 'center', padding: 16, color: 'var(--app-text-secondary)' }}>{normativa && referencia ? 'Sin resultados' : 'Seleccione criterios'}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Configuración */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <IconAdjustmentsHorizontal size={18} color="#9c36b5" />
                            <Text strong style={{ fontSize: 13, color: '#9c36b5' }}>Configuración de Análisis</Text>
                        </div>

                        <Field label="Tipo de Muestra *">
                            <Select
                                placeholder="OBLIGATORIO"
                                options={tiposMuestra}
                                value={tipoMuestra || undefined}
                                onChange={(val) => setTipoMuestra(val || '')}
                                disabled={!referencia}
                                style={{ width: '100%' }}
                            />
                        </Field>

                        {selectedAnalysis.size > 0 && (
                            <>
                                <Divider titlePlacement="center" style={{ margin: '4px 0' }}>
                                    <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>Seleccionados ({selectedAnalysis.size})</Text>
                                </Divider>
                                <div style={{ maxHeight: 345, overflowY: 'auto' }}>
                                    {isMobile ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 16 }}>
                                            {selectedRows.map(({ id, analysis }) => (
                                                <div key={id} style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 10, backgroundColor: 'var(--app-hover-bg)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                        <Text strong style={{ fontSize: 12, flex: 1 }}>{analysis?.nombre_tecnica || id}</Text>
                                                        <Button type="text" danger shape="circle" size="small" icon={<IconTrash size={14} />} onClick={() => handleToggleAnalysis(id)} />
                                                    </div>
                                                    {tipoMuestra === 'Laboratorio' && (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            <Field label="Tipo Entrega">
                                                                <Select
                                                                    style={{ width: '100%' }}
                                                                    options={tiposEntrega.map(t => ({ value: String(t.id_tipoentrega), label: t.nombre_tipoentrega }))}
                                                                    value={tempDeliveries[id] || undefined}
                                                                    onChange={(val) => handleTempDeliveryChange(id, val || '')}
                                                                />
                                                            </Field>
                                                            <Field label="Laboratorio Derivado">
                                                                <Select
                                                                    style={{ width: '100%' }}
                                                                    options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                    value={tempLabs[id] || undefined}
                                                                    onChange={(val) => handleTempLabChange(id, val || '')}
                                                                    placeholder="Seleccione..."
                                                                    showSearch
                                                                />
                                                            </Field>
                                                            <Field label="Laboratorio Secundario">
                                                                <Select
                                                                    style={{ width: '100%' }}
                                                                    options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                    value={tempLabs2[id] || undefined}
                                                                    onChange={(val) => handleTempLab2Change(id, val || '')}
                                                                    placeholder="(Opcional)"
                                                                    allowClear
                                                                    showSearch
                                                                />
                                                            </Field>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                            <thead style={{ backgroundColor: 'var(--app-hover-bg)', position: 'sticky', top: 0 }}>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: '6px 8px' }}>Análisis</th>
                                                    {tipoMuestra === 'Laboratorio' && (
                                                        <>
                                                            <th style={{ width: 160, padding: '6px 8px' }}>Entrega</th>
                                                            <th style={{ width: 180, padding: '6px 8px' }}>Lab. Derivado</th>
                                                            <th style={{ width: 180, padding: '6px 8px' }}>Lab. Secundario</th>
                                                        </>
                                                    )}
                                                    <th style={{ width: 40 }} />
                                                </tr>
                                                {tipoMuestra === 'Laboratorio' && selectedAnalysis.size > 1 && (
                                                    <tr style={{ backgroundColor: 'var(--app-accent-bg)' }}>
                                                        <td style={{ padding: '6px 8px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                                                <IconArrowsDownUp size={14} color="var(--app-accent-text)" />
                                                                <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-accent-text)' }}>Aplicar a todos:</Text>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '6px 8px' }}>
                                                            <Select
                                                                style={{ width: '100%' }}
                                                                options={tiposEntrega.map(t => ({ value: String(t.id_tipoentrega), label: t.nombre_tipoentrega }))}
                                                                placeholder="Seleccionar todos..."
                                                                onChange={(val) => val && handleBulkDeliveryChange(val)}
                                                                showSearch
                                                            />
                                                        </td>
                                                        <td style={{ padding: '6px 8px' }}>
                                                            <Select
                                                                style={{ width: '100%' }}
                                                                options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                placeholder="Seleccionar todos..."
                                                                onChange={(val) => val && handleBulkLabChange(val)}
                                                                showSearch
                                                            />
                                                        </td>
                                                        <td style={{ padding: '6px 8px' }}>
                                                            <Select
                                                                style={{ width: '100%' }}
                                                                options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                placeholder="Seleccionar todos..."
                                                                onChange={(val) => val && handleBulkLab2Change(val)}
                                                                showSearch
                                                            />
                                                        </td>
                                                        <td />
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody>
                                                {selectedRows.map(({ id, analysis }) => (
                                                    <tr key={id} style={{ borderTop: '1px solid var(--app-border)' }}>
                                                        <td style={{ padding: '6px 8px', fontWeight: 500 }}>{analysis?.nombre_tecnica || id}</td>
                                                        {tipoMuestra === 'Laboratorio' && (
                                                            <>
                                                                <td style={{ padding: '6px 8px' }}>
                                                                    <Select
                                                                        style={{ width: '100%', minWidth: 140 }}
                                                                        options={tiposEntrega.map(t => ({ value: String(t.id_tipoentrega), label: t.nombre_tipoentrega }))}
                                                                        value={tempDeliveries[id] || undefined}
                                                                        onChange={(val) => handleTempDeliveryChange(id, val || '')}
                                                                        showSearch
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '6px 8px' }}>
                                                                    <Select
                                                                        style={{ width: '100%' }}
                                                                        options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                        value={tempLabs[id] || undefined}
                                                                        onChange={(val) => handleTempLabChange(id, val || '')}
                                                                        placeholder="..."
                                                                        showSearch
                                                                    />
                                                                </td>
                                                                <td style={{ padding: '6px 8px' }}>
                                                                    <Select
                                                                        style={{ width: '100%' }}
                                                                        options={laboratorios.map(l => ({ value: String(l.id_laboratorioensayo), label: l.nombre_laboratorioensayo }))}
                                                                        value={tempLabs2[id] || undefined}
                                                                        onChange={(val) => handleTempLab2Change(id, val || '')}
                                                                        placeholder="(Opcional)"
                                                                        allowClear
                                                                        showSearch
                                                                    />
                                                                </td>
                                                            </>
                                                        )}
                                                        <td style={{ textAlign: 'center' }}>
                                                            <Button type="text" danger shape="circle" size="small" icon={<IconTrash size={14} />} onClick={() => handleToggleAnalysis(id)} />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </>
                        )}

                        <Button
                            type="primary"
                            style={{ backgroundColor: '#0d9488', marginTop: 'auto', height: 44 }}
                            block
                            onClick={handleSaveAnalysis}
                            disabled={
                                selectedAnalysis.size === 0 || !tipoMuestra ||
                                (tipoMuestra === 'Laboratorio' && (
                                    Array.from(selectedAnalysis).some(id => !tempDeliveries[id]) ||
                                    Array.from(selectedAnalysis).some(id => !tempLabs[id])
                                ))
                            }
                            icon={<IconDeviceFloppy size={20} />}
                        >
                            Grabar Análisis
                        </Button>
                    </div>
                </div>
            </Card>

            <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <IconTable size={18} color="#4f46e5" />
                            <Text strong style={{ fontSize: 13, color: '#4f46e5' }}>Análisis Grabados</Text>
                        </div>
                        <Tag color="geekblue">{savedAnalysis.length}</Tag>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1100 }}>
                            <thead style={{ backgroundColor: 'var(--app-hover-bg)', position: 'sticky', top: 0 }}>
                                <tr>
                                    {['Análisis', 'Normativa', 'Tabla / Referencia', 'Muestra', 'L. Min', 'L. Max', 'Error', 'Err. Min', 'Err. Max', 'Entrega', 'U.F.', 'Lab. Derivado', 'Lab. Secundario', ''].map((h, i) => (
                                        <th key={i} style={{ textAlign: i >= 4 && i <= 8 ? 'right' : 'left', padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Fila SIEMPRE presente: Costo Operativo (opcional, marcable) */}
                                <tr style={{ backgroundColor: costo.enabled ? 'rgba(250,173,20,0.1)' : undefined, borderTop: '1px solid var(--app-border)' }}>
                                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <Checkbox checked={costo.enabled} onChange={(e) => updateCosto({ enabled: e.target.checked })} />
                                            <Text style={{ fontSize: 13, fontWeight: 700, color: costo.enabled ? '#d48806' : 'var(--app-text-secondary)' }}>Costo Operativo</Text>
                                        </div>
                                    </td>
                                    {Array.from({ length: 8 }).map((_, i) => (
                                        <td key={i} style={{ padding: '6px 8px', color: 'var(--app-text-secondary)', textAlign: i >= 3 && i <= 7 ? 'right' : 'left' }}>—</td>
                                    ))}
                                    <td style={{ padding: '6px 8px' }}>
                                        <InputNumber
                                            style={{ width: '100%' }}
                                            value={costo.uf === '' ? undefined : Number(costo.uf)}
                                            onChange={(val) => updateCosto({ uf: val ?? '' })}
                                            onFocus={(e) => { if (String(costo.uf) === '0') updateCosto({ uf: '' }); e.currentTarget.select(); }}
                                            precision={2}
                                            controls={false}
                                            disabled={!costo.enabled}
                                            placeholder="0.00"
                                        />
                                    </td>
                                    <td style={{ padding: '6px 8px', color: 'var(--app-text-secondary)' }}>—</td>
                                    <td style={{ padding: '6px 8px', color: 'var(--app-text-secondary)' }}>—</td>
                                    <td />
                                </tr>
                                {savedAnalysis.length > 0 ? (
                                    savedAnalysis.map(analysis => {
                                        const isFixed = !!analysis._fijo;
                                        return (
                                            <tr key={analysis.savedId} style={{ backgroundColor: isFixed ? 'var(--app-accent-bg)' : undefined, borderTop: '1px solid var(--app-border)' }}>
                                                <td style={{ padding: '6px 8px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <Text style={{ fontSize: 13 }}>{analysis.nombre_tecnica}</Text>
                                                        {isFixed && <Tag color="blue" style={{ fontSize: 10 }}>Fijo</Tag>}
                                                    </div>
                                                </td>
                                                {isFixed ? (
                                                    <td colSpan={2} style={{ padding: '6px 8px' }}>
                                                        <Select
                                                            style={{ minWidth: 230, width: '100%' }}
                                                            placeholder="Seleccione normativa / tabla"
                                                            options={(analysis.opciones || []).map((o: any) => ({
                                                                value: String(o.id_referenciaanalisis),
                                                                label: `${o.nombre_normativa} / ${o.nombre_normativareferencia}`
                                                            }))}
                                                            value={analysis.id_referenciaanalisis ? String(analysis.id_referenciaanalisis) : undefined}
                                                            onChange={(val) => handleFixedRefChange(analysis.savedId, val)}
                                                            showSearch
                                                        />
                                                    </td>
                                                ) : (
                                                    <>
                                                        <td style={{ padding: '6px 8px' }}>{analysis.nombre_normativa || '-'}</td>
                                                        <td style={{ padding: '6px 8px' }}>{analysis.nombre_normativareferencia || '-'}</td>
                                                    </>
                                                )}
                                                <td style={{ padding: '6px 8px' }}>{analysis.tipo_analisis}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{analysis.limitemax_d ?? '-'}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{analysis.limitemax_h ?? '-'}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{['S', 's', 'Y', 'y', true].includes(analysis.llevaerror) ? 'Sí' : 'No'}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{analysis.error_min ?? '-'}</td>
                                                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{analysis.error_max ?? '-'}</td>
                                                <td style={{ padding: '6px 8px' }}>{analysis.nombre_tipoentrega}</td>
                                                <td style={{ padding: '6px 8px' }}>
                                                    <InputNumber
                                                        style={{ width: '100%' }}
                                                        value={analysis.uf_individual === '' ? undefined : Number(analysis.uf_individual)}
                                                        onChange={(val) => handleUfChange(analysis.savedId, val)}
                                                        onFocus={(e) => { if (String(analysis.uf_individual) === '0') handleUfChange(analysis.savedId, ''); e.currentTarget.select(); }}
                                                        precision={2}
                                                        controls={false}
                                                    />
                                                </td>
                                                <td style={{ padding: '6px 8px' }}>{analysis.nombre_laboratorioensayo || '-'}</td>
                                                <td style={{ padding: '6px 8px' }}>{analysis.nombre_laboratorioensayo_2 || '-'}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <Button type="text" danger shape="circle" size="small" icon={<IconTrash size={14} />} onClick={() => handleDeleteSavedAnalysis(analysis.savedId)} />
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr><td colSpan={14} style={{ textAlign: 'center', padding: 32, color: 'var(--app-text-secondary)' }}>Aún no hay análisis grabados (agregue al menos uno)</td></tr>
                                )}
                            </tbody>
                            {(savedAnalysis.length > 0 || costo.enabled) && (
                                <tfoot style={{ position: 'sticky', bottom: 0, backgroundColor: 'var(--app-hover-bg)' }}>
                                    <tr>
                                        <td colSpan={10} style={{ textAlign: 'right', fontWeight: 700, color: '#4f46e5', padding: '8px', fontSize: 13 }}>
                                            UF TOTAL DE LA FICHA:
                                        </td>
                                        <td style={{ padding: '6px 8px' }}>
                                            <InputNumber
                                                style={{ width: '100%', backgroundColor: 'var(--app-accent-bg)', fontWeight: 800 }}
                                                value={totalRealUF === '' ? undefined : Number(totalRealUF)}
                                                onChange={handleTotalUfChange}
                                                precision={2}
                                                controls={false}
                                                placeholder="0.00"
                                            />
                                        </td>
                                        <td colSpan={3} />
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </Card>
        </div>
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
