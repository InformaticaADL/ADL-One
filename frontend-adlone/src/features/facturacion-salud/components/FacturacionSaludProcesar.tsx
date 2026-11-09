import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    IconCalculator,
    IconSearch,
    IconCheck,
    IconFilePlus,
    IconChevronDown,
    IconChevronRight,
    IconEdit,
    IconArrowsExchange,
    IconSparkles,
    IconRefresh,
    IconLayersSubtract,
} from '@tabler/icons-react';
import { facturacionSaludService } from '../services/facturacionSalud.service';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    initialPrograma?: number;
    onNavigate?: (vista: string) => void;
}

const PROGRAMAS_OPCIONES = [
    { id: 1, label: '1. Vigilancia Activa (PVA)', desc: 'Tarifario PVA por cliente/empresa/centro/especie' },
    { id: 2, label: '2. Screening (Brotes / Reproductores)', desc: 'Tarifario Screening + Costo Operativo por Crotales' },
    { id: 3, label: '3. Peces Reproductores', desc: 'Casos cerrados (FINAL / ENMIENDA-F)' },
    { id: 4, label: '4. Servicio Diagnóstico (SDiag / Salud)', desc: 'ATBPlex rangos, Multiplex, Derivación, Ensilaje y PROA' },
    { id: 5, label: '5. Investigación y Desarrollo (I+D)', desc: 'Tarifario por Proyecto, Packs o Lista' },
    { id: 6, label: '6. Investigación Laboratorio', desc: 'Tarifario Especial o Lista Estándar' },
    { id: 7, label: '7. Genética', desc: 'Casos del programa Genética (id_programa = 8)' },
    { id: 8, label: '8. SAMIC (Monitoreo de Caligus)', desc: 'Tarifario SAMIC por cliente/empresa/centro/técnica' },
    { id: 9, label: '9. Susceptibilidad de Caligus', desc: 'Tarifa mae_tecnica.vta_cal o lista' },
];

const CRITERIOS_AGRUPACION = [
    { value: 'Na', label: 'Na (1 sola Pre-Factura con todos los casos)' },
    { value: 'Centro', label: 'Por Centro de Cultivo' },
    { value: 'Veterinario', label: 'Por Médico Veterinario (cliente_entrega)' },
    { value: 'Centro - Veterinario', label: 'Por Centro + Médico Veterinario' },
    { value: 'Tipo de Agua', label: 'Por Tipo de Agua (Agua Dulce / Mar)' },
    { value: 'Tipo de Agua - Veterinario', label: 'Por Tipo de Agua + Médico Veterinario' },
];

const FacturacionSaludProcesar: React.FC<Props> = ({ initialPrograma = 4, onNavigate }) => {
    const { showToast } = useToast();

    // Filtros de búsqueda y valorización
    const [eligeprograma, setEligeprograma] = useState<number>(initialPrograma);
    const [ensilaje, setEnsilaje] = useState<boolean>(false);
    const [proa, setProa] = useState<boolean>(false);
    const [fechaRecIni, setFechaRecIni] = useState<string>('');
    const [fechaRecFin, setFechaRecFin] = useState<string>('');
    const [fechaInfIni, setFechaInfIni] = useState<string>('');
    const [fechaInfFin, setFechaInfFin] = useState<string>('');
    const [valorUf, setValorUf] = useState<number>(38500);
    const [valorUsd, setValorUsd] = useState<number>(950);

    // Catálogos maestros
    const [maestros, setMaestros] = useState<any>({
        formasPago: [],
        glosas: [],
        empresasServicio: [],
    });

    // Empresas con casos elegibles
    const [empresasElegibles, setEmpresasElegibles] = useState<any[]>([]);
    const [loadingEmpresas, setLoadingEmpresas] = useState<boolean>(false);
    const [searchEmpresa, setSearchEmpresa] = useState<string>('');
    const [selectedEmpresa, setSelectedEmpresa] = useState<any | null>(null);

    // Casos de la empresa seleccionada
    const [casos, setCasos] = useState<any[]>([]);
    const [loadingCasos, setLoadingCasos] = useState<boolean>(false);
    const [valorizando, setValorizando] = useState<boolean>(false);
    const [reglasAplicadas, setReglasAplicadas] = useState<Record<string, number>>({});
    const [selectedCasosIds, setSelectedCasosIds] = useState<Set<number>>(new Set());
    const [expandedCasos, setExpandedCasos] = useState<Set<number>>(new Set());

    // Edición manual de línea
    const [editingLineKey, setEditingLineKey] = useState<string | null>(null);
    const [editCant, setEditCant] = useState<string>('1');
    const [editUnitUf, setEditUnitUf] = useState<string>('0');
    const [savingLine, setSavingLine] = useState<boolean>(false);

    // Cambio de empresa a facturar de un caso
    const [casoCambiarEmpresa, setCasoCambiarEmpresa] = useState<any | null>(null);
    const [nuevaEmpresaId, setNuevaEmpresaId] = useState<string>('');

    // Creación de Pre-Facturas
    const [criterioAgrupacion, setCriterioAgrupacion] = useState<string>('Na');
    const [modalCrearOpen, setModalCrearOpen] = useState<boolean>(false);
    const [creandoPrefacturas, setCreandoPrefacturas] = useState<boolean>(false);
    const [formPrefactura, setFormPrefactura] = useState({
        fecha_facturacion: new Date().toISOString().slice(0, 10),
        id_formapago: 1,
        id_glosa: 1,
        glosa: 'SERVICIO DE ANÁLISIS DE LABORATORIO ÁREA SALUD',
        observaciones: '',
        nota: '',
        ocompra: '',
        ocompra_fecha: '',
        referencia_oc: 'Orden de Compra',
        hes: '',
        hes_fecha: '',
        referencia_hes: 'HES',
    });

    useEffect(() => {
        if (initialPrograma) setEligeprograma(initialPrograma);
    }, [initialPrograma]);

    useEffect(() => {
        facturacionSaludService
            .getMaestros()
            .then((d) => {
                setMaestros(d);
                if (d.formasPago?.length > 0) {
                    setFormPrefactura((prev) => ({
                        ...prev,
                        id_formapago: d.formasPago[0].id_formapago,
                    }));
                }
            })
            .catch(() => {});

        facturacionSaludService
            .getDashboard()
            .then((d) => {
                if (d?.kpis?.ultimaUf) setValorUf(Number(d.kpis.ultimaUf));
            })
            .catch(() => {});
    }, []);

    const cargarEmpresasElegibles = useCallback(async () => {
        setLoadingEmpresas(true);
        try {
            const lista = await facturacionSaludService.getEmpresasElegibles({
                eligeprograma,
                fecha_rec_ini: fechaRecIni,
                fecha_rec_fin: fechaRecFin,
                fecha_inf_ini: fechaInfIni,
                fecha_inf_fin: fechaInfFin,
                ensilaje: eligeprograma === 4 ? ensilaje : false,
                proa: eligeprograma === 4 ? proa : false,
            });
            setEmpresasElegibles(lista || []);
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al buscar empresas con casos pendientes',
            });
        } finally {
            setLoadingEmpresas(false);
        }
    }, [eligeprograma, fechaRecIni, fechaRecFin, fechaInfIni, fechaInfFin, ensilaje, proa, showToast]);

    useEffect(() => {
        cargarEmpresasElegibles();
        setSelectedEmpresa(null);
        setCasos([]);
        setReglasAplicadas({});
    }, [cargarEmpresasElegibles]);

    const seleccionarEmpresa = async (emp: any) => {
        setSelectedEmpresa(emp);
        setLoadingCasos(true);
        setReglasAplicadas({});
        try {
            const listaCasos = await facturacionSaludService.getCasosElegibles({
                eligeprograma,
                id_empresaservicio: emp.id_empresaservicio,
                fecha_rec_ini: fechaRecIni,
                fecha_rec_fin: fechaRecFin,
                fecha_inf_ini: fechaInfIni,
                fecha_inf_fin: fechaInfFin,
                ensilaje: eligeprograma === 4 ? ensilaje : false,
                proa: eligeprograma === 4 ? proa : false,
            });
            setCasos(listaCasos || []);
            setSelectedCasosIds(new Set((listaCasos || []).map((c: any) => Number(c.id_caso))));
            if (listaCasos?.length === 1) {
                setExpandedCasos(new Set([Number(listaCasos[0].id_caso)]));
            } else {
                setExpandedCasos(new Set());
            }
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al cargar casos de la empresa',
            });
        } finally {
            setLoadingCasos(false);
        }
    };

    const ejecutarValorizacion = async () => {
        if (!selectedEmpresa) return;
        if (!valorUf || valorUf <= 0) {
            showToast({ type: 'error', message: 'Debe ingresar un Valor UF válido mayor a 0.' });
            return;
        }
        setValorizando(true);
        try {
            const res = await facturacionSaludService.valorizarCasos({
                id_empresaservicio: selectedEmpresa.id_empresaservicio,
                eligeprograma,
                fecha_rec_ini: fechaRecIni || undefined,
                fecha_rec_fin: fechaRecFin || undefined,
                fecha_inf_ini: fechaInfIni || undefined,
                fecha_inf_fin: fechaInfFin || undefined,
                ensilaje: eligeprograma === 4 ? ensilaje : false,
                proa: eligeprograma === 4 ? proa : false,
                uf: valorUf,
                usd: valorUsd,
            });
            setCasos(res.casos || []);
            setReglasAplicadas(res.reglasAplicadas || {});
            setSelectedCasosIds(new Set((res.casos || []).map((c: any) => Number(c.id_caso))));
            showToast({
                type: 'success',
                message: `Valorización completada: ${res.casosValorizados} casos (${res.lineasValorizadas} líneas) = ${res.ufTotalGeneral} UF`,
            });
            cargarEmpresasElegibles();
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al valorizar casos de salud',
            });
        } finally {
            setValorizando(false);
        }
    };

    const handleGuardarLineaManual = async (caso: any, linea: any) => {
        setSavingLine(true);
        try {
            const res = await facturacionSaludService.actualizarLineaCasoManual({
                id_caso: caso.id_caso,
                item: linea.item,
                id_tecnica: linea.id_tecnica,
                n_analisis: Number(editCant),
                vtaunitario: Number(editUnitUf),
            });
            setCasos((prev) =>
                prev.map((c) => {
                    if (c.id_caso !== caso.id_caso) return c;
                    return {
                        ...c,
                        uf_totalfac: res.uf_totalfac_caso,
                        lineas: c.lineas.map((l: any) =>
                            l.item === linea.item && l.id_tecnica === linea.id_tecnica
                                ? {
                                      ...l,
                                      n_analisis: res.n_analisis,
                                      vtaunitario: res.vtaunitario,
                                      vtatotal: res.vtatotal,
                                      mf: 1,
                                      regla_aplicada: 'Ajuste Manual Caso a Caso',
                                  }
                                : l
                        ),
                    };
                })
            );
            setEditingLineKey(null);
            showToast({ type: 'success', message: `Caso #${caso.caso_adlab || caso.id_caso} actualizado manualmente.` });
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'No se pudo actualizar la línea',
            });
        } finally {
            setSavingLine(false);
        }
    };

    const handleConfirmarCambioEmpresa = async () => {
        if (!casoCambiarEmpresa || !nuevaEmpresaId) return;
        try {
            await facturacionSaludService.cambiarEmpresaCaso({
                id_caso: casoCambiarEmpresa.id_caso,
                id_empresaservicio: Number(nuevaEmpresaId),
            });
            showToast({
                type: 'success',
                message: `Caso #${casoCambiarEmpresa.caso_adlab} reasignado exitosamente.`,
            });
            setCasoCambiarEmpresa(null);
            setNuevaEmpresaId('');
            if (selectedEmpresa) seleccionarEmpresa(selectedEmpresa);
            cargarEmpresasElegibles();
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al reasignar empresa del caso',
            });
        }
    };

    // Previsualización de agrupación según criterio seleccionado
    const previewGrupos = useMemo(() => {
        const seleccionados = casos.filter((c) => selectedCasosIds.has(Number(c.id_caso)));
        const map = new Map<string, { label: string; casos: any[]; totalUf: number }>();

        for (const c of seleccionados) {
            let key = 'ALL';
            let label = 'Factura Única (Todos los casos seleccionados)';
            if (criterioAgrupacion === 'Centro') {
                key = `C_${c.id_centro}`;
                label = `Centro: ${c.nombre_centro || c.id_centro}`;
            } else if (criterioAgrupacion === 'Veterinario') {
                key = `V_${c.cliente_entrega}`;
                label = `Veterinario: ${c.cliente_entrega || 'Sin Veterinario'}`;
            } else if (criterioAgrupacion === 'Centro - Veterinario') {
                key = `CV_${c.id_centro}__${c.cliente_entrega}`;
                label = `${c.nombre_centro} · ${c.cliente_entrega}`;
            } else if (criterioAgrupacion === 'Tipo de Agua') {
                key = `TA_${c.id_tipoagua}`;
                label = `Agua: ${c.nombre_tipoagua || 'General'}`;
            } else if (criterioAgrupacion === 'Tipo de Agua - Veterinario') {
                key = `TAV_${c.id_tipoagua}__${c.cliente_entrega}`;
                label = `${c.nombre_tipoagua} · ${c.cliente_entrega}`;
            }

            if (!map.has(key)) {
                map.set(key, { label, casos: [], totalUf: 0 });
            }
            const g = map.get(key)!;
            g.casos.push(c);
            g.totalUf = Math.round((g.totalUf + Number(c.uf_totalfac || 0)) * 100) / 100;
        }
        return Array.from(map.values());
    }, [casos, selectedCasosIds, criterioAgrupacion]);

    const handleCrearPrefacturas = async () => {
        if (!selectedEmpresa || selectedCasosIds.size === 0) return;
        setCreandoPrefacturas(true);
        try {
            const res = await facturacionSaludService.crearPrefacturas({
                id_empresaservicio: selectedEmpresa.id_empresaservicio,
                eligeprograma,
                criterio_agrupacion: criterioAgrupacion,
                casos_ids: Array.from(selectedCasosIds),
                valor_uf: valorUf,
                valor_usd: valorUsd,
                fecha_proceso_ini: fechaRecIni,
                fecha_proceso_fin: fechaRecFin,
                fecha_informe_ini: fechaInfIni,
                fecha_informe_fin: fechaInfFin,
                ...formPrefactura,
            });
            showToast({
                type: 'success',
                message: `Se crearon ${res.total_prefacturas_creadas} pre-factura(s) exitosamente (#${res.prefacturas.map((p: any) => p.id_facturacion).join(', #')}).`,
            });
            setModalCrearOpen(false);
            onNavigate?.('fs-prefacturas');
        } catch (e: any) {
            showToast({
                type: 'error',
                message: e?.response?.data?.message || 'Error al crear pre-facturas',
            });
        } finally {
            setCreandoPrefacturas(false);
        }
    };

    const fmtUf = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const fmtClp = (n: number) =>
        Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

    const empresasFiltradas = useMemo(() => {
        if (!searchEmpresa.trim()) return empresasElegibles;
        const q = searchEmpresa.toLowerCase();
        return empresasElegibles.filter(
            (e) =>
                String(e.nombre_empresaservicios || '').toLowerCase().includes(q) ||
                String(e.rut_empresaservicios || '').toLowerCase().includes(q)
        );
    }, [empresasElegibles, searchEmpresa]);

    const totalUfSeleccionados = useMemo(() => {
        return casos
            .filter((c) => selectedCasosIds.has(Number(c.id_caso)))
            .reduce((acc, c) => acc + Number(c.uf_totalfac || 0), 0);
    }, [casos, selectedCasosIds]);

    return (
        <div className="space-y-5">
            {/* Barra de Configuración del Programa y Parámetros Financieros */}
            <Card className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h3 className="m-0 text-base font-bold text-foreground">
                            1. Selección de Programa de Salud y Parámetros de Valorización
                        </h3>
                        <p className="m-0 text-xs text-muted-foreground">
                            Replica el motor <span className="font-mono">fac_prefacturacion_new_v6.scx</span> +{' '}
                            <span className="font-mono">fac_unaempresa_v5.scx</span>
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={cargarEmpresasElegibles}>
                        <IconRefresh size={15} /> Recargar Empresas
                    </Button>
                </div>

                <div className="grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-semibold text-foreground">
                            Programa de Salud (eligeprograma)
                        </label>
                        <select
                            value={eligeprograma}
                            onChange={(e) => {
                                const val = Number(e.target.value);
                                setEligeprograma(val);
                                if (val !== 4) {
                                    setEnsilaje(false);
                                    setProa(false);
                                }
                            }}
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
                        >
                            {PROGRAMAS_OPCIONES.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                            {PROGRAMAS_OPCIONES.find((p) => p.id === eligeprograma)?.desc}
                        </p>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">Recepción Desde</label>
                        <input
                            type="date"
                            value={fechaRecIni}
                            onChange={(e) => setFechaRecIni(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">Recepción Hasta</label>
                        <input
                            type="date"
                            value={fechaRecFin}
                            onChange={(e) => setFechaRecFin(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">Valor UF ($ CLP)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={valorUf}
                            onChange={(e) => setValorUf(Number(e.target.value))}
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs font-semibold"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-semibold text-foreground">Valor Dólar ($ CLP)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={valorUsd}
                            onChange={(e) => setValorUsd(Number(e.target.value))}
                            className="h-9 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs"
                        />
                    </div>
                </div>

                {/* Sub-switches exclusivos de Servicio Diagnóstico (eligeprograma = 4) */}
                {eligeprograma === 4 && (
                    <div className="mt-3 flex flex-wrap items-center gap-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                        <span className="font-semibold text-primary">Sub-modalidad Servicio Diagnóstico:</span>
                        <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                                type="checkbox"
                                checked={ensilaje}
                                onChange={(e) => {
                                    setEnsilaje(e.target.checked);
                                    if (e.target.checked) setProa(false);
                                }}
                            />
                            <span>Solo Casos de Ensilaje (tarifario ensilaje)</span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-1.5">
                            <input
                                type="checkbox"
                                checked={proa}
                                onChange={(e) => {
                                    setProa(e.target.checked);
                                    if (e.target.checked) setEnsilaje(false);
                                }}
                            />
                            <span>Solo Casos PROA (tarifario PROA)</span>
                        </label>
                    </div>
                )}
            </Card>

            {/* Layout Principal: Izquierda Empresas Elegibles | Derecha Casos y Motor de Valorización */}
            <div className="grid gap-4 lg:grid-cols-12">
                {/* Columna Izquierda: Empresas con casos elegibles */}
                <Card className="p-4 lg:col-span-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="m-0 text-sm font-bold text-foreground">
                            Empresas con Casos ({empresasFiltradas.length})
                        </h4>
                    </div>

                    <div className="relative mb-3">
                        <IconSearch size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Filtrar por cliente o RUT..."
                            value={searchEmpresa}
                            onChange={(e) => setSearchEmpresa(e.target.value)}
                            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs"
                        />
                    </div>

                    {loadingEmpresas ? (
                        <div className="py-12 text-center text-xs text-muted-foreground">
                            Buscando empresas con casos ENVIADOS...
                        </div>
                    ) : (
                        <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                            {empresasFiltradas.map((emp) => {
                                const isSelected =
                                    selectedEmpresa?.id_empresaservicio === emp.id_empresaservicio;
                                return (
                                    <div
                                        key={emp.id_empresaservicio}
                                        onClick={() => seleccionarEmpresa(emp)}
                                        className={`cursor-pointer rounded-lg border p-3 transition ${
                                            isSelected
                                                ? 'border-primary bg-primary/10 shadow-sm'
                                                : 'border-border hover:bg-muted/40'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-semibold text-xs text-foreground">
                                                {emp.nombre_empresaservicios}
                                            </div>
                                            <Badge variant="secondary" className="shrink-0 text-[10px]">
                                                {emp.total_casos} casos
                                            </Badge>
                                        </div>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                            <span className="font-mono">{emp.rut_empresaservicios}</span>
                                            <span>·</span>
                                            <span>{emp.precio_lista}</span>
                                            {emp.precio_especial === 'S' && (
                                                <Badge variant="outline" className="text-[9px] text-amber-600">
                                                    Tarifa Especial
                                                </Badge>
                                            )}
                                            {emp.costo_op === 'S' && (
                                                <Badge variant="outline" className="text-[9px] text-blue-600">
                                                    Costo Op.
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between border-t border-border/60 pt-1.5 text-[11px]">
                                            <span className="text-muted-foreground">
                                                {emp.total_lineas} líneas
                                            </span>
                                            <span className="font-mono font-bold text-foreground">
                                                {fmtUf(emp.uf_total_actual)} UF
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                            {empresasFiltradas.length === 0 && (
                                <div className="py-8 text-center text-xs text-muted-foreground">
                                    No hay empresas con casos pendientes para este programa y filtro.
                                </div>
                            )}
                        </div>
                    )}
                </Card>

                {/* Columna Derecha: Casos de la Empresa, Motor de Valorización y Agrupación */}
                <Card className="p-4 lg:col-span-8">
                    {!selectedEmpresa ? (
                        <div className="flex h-96 flex-col items-center justify-center text-center text-muted-foreground">
                            <IconCalculator size={38} className="mb-2 opacity-40" />
                            <p className="text-sm font-medium text-foreground">
                                Seleccione una Empresa de Servicio en el panel izquierdo
                            </p>
                            <p className="mt-1 max-w-md text-xs">
                                Podrá ejecutar el motor de valorización automática (11 niveles de prioridad tarifaria y
                                cargos operativos de terreno), ajustar precios caso a caso y agrupar las pre-facturas.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Cabecera de la Empresa Seleccionada */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="m-0 text-base font-bold text-foreground">
                                            {selectedEmpresa.nombre_empresaservicios}
                                        </h3>
                                        <Badge variant="outline" className="font-mono text-xs">
                                            {selectedEmpresa.rut_empresaservicios}
                                        </Badge>
                                    </div>
                                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                                        Modalidad: <strong>{selectedEmpresa.precio_lista}</strong> · Precio Especial:{' '}
                                        <strong>{selectedEmpresa.precio_especial}</strong> · Factor Km:{' '}
                                        <strong>{selectedEmpresa.factor_km}</strong> · Costo Op:{' '}
                                        <strong>{selectedEmpresa.costo_op}</strong>
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        onClick={ejecutarValorizacion}
                                        disabled={valorizando || casos.length === 0}
                                        className="bg-amber-600 hover:bg-amber-700 text-white"
                                    >
                                        <IconSparkles size={16} />
                                        {valorizando ? 'Valorizando casos...' : '1. Pre-Facturar / Valorizar Casos'}
                                    </Button>

                                    <Button
                                        onClick={() => setModalCrearOpen(true)}
                                        disabled={selectedCasosIds.size === 0}
                                    >
                                        <IconFilePlus size={16} />
                                        2. Crear Pre-Factura(s) ({previewGrupos.length})
                                    </Button>
                                </div>
                            </div>

                            {/* Resumen de Reglas Tarifarias Aplicadas */}
                            {Object.keys(reglasAplicadas).length > 0 && (
                                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                                    <p className="m-0 mb-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                        Reglas Tarifarias Aplicadas en esta Valorización:
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(reglasAplicadas).map(([regla, count]) => (
                                            <Badge key={regla} variant="secondary" className="text-[11px]">
                                                {regla}: {count} línea(s)
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Barra de Agrupación y Totales */}
                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/40 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <IconLayersSubtract size={16} className="text-primary" />
                                    <span className="text-xs font-semibold">Agrupar Pre-Facturas por:</span>
                                    <select
                                        value={criterioAgrupacion}
                                        onChange={(e) => setCriterioAgrupacion(e.target.value)}
                                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium"
                                    >
                                        {CRITERIOS_AGRUPACION.map((cr) => (
                                            <option key={cr.value} value={cr.value}>
                                                {cr.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="flex items-center gap-4 text-xs">
                                    <div>
                                        Casos marcados:{' '}
                                        <strong>
                                            {selectedCasosIds.size} / {casos.length}
                                        </strong>
                                    </div>
                                    <div>
                                        Total UF:{' '}
                                        <strong className="font-mono text-sm text-primary">
                                            {fmtUf(totalUfSeleccionados)} UF
                                        </strong>
                                    </div>
                                    <div>
                                        Neto Estimado:{' '}
                                        <strong className="font-mono text-sm">
                                            $ {fmtClp(totalUfSeleccionados * valorUf)}
                                        </strong>
                                    </div>
                                </div>
                            </div>

                            {/* Tabla de Casos y Líneas de Muestras Detalle */}
                            {loadingCasos ? (
                                <div className="py-12 text-center text-xs text-muted-foreground">
                                    Cargando casos y técnicas del cliente...
                                </div>
                            ) : (
                                <div className="max-h-[480px] overflow-y-auto rounded-lg border border-border">
                                    <table className="w-full border-collapse text-left text-xs">
                                        <thead className="sticky top-0 bg-muted/90 backdrop-blur">
                                            <tr className="border-b border-border text-[11px] uppercase text-muted-foreground">
                                                <th className="py-2 pl-3 pr-1">
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            casos.length > 0 &&
                                                            selectedCasosIds.size === casos.length
                                                        }
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedCasosIds(
                                                                    new Set(casos.map((c) => Number(c.id_caso)))
                                                                );
                                                            } else {
                                                                setSelectedCasosIds(new Set());
                                                            }
                                                        }}
                                                    />
                                                </th>
                                                <th className="py-2 px-2">Detalle</th>
                                                <th className="py-2 px-2">Caso ADLAB</th>
                                                <th className="py-2 px-2">Centro / Agua</th>
                                                <th className="py-2 px-2">Veterinario</th>
                                                <th className="py-2 px-2">F. Recepción / Informe</th>
                                                <th className="py-2 px-2 text-right">Líneas</th>
                                                <th className="py-2 px-2 text-right">Total UF</th>
                                                <th className="py-2 pr-3 text-right">Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {casos.map((c) => {
                                                const idCaso = Number(c.id_caso);
                                                const isChecked = selectedCasosIds.has(idCaso);
                                                const isExpanded = expandedCasos.has(idCaso);

                                                return (
                                                    <React.Fragment key={idCaso}>
                                                        <tr className="hover:bg-muted/30">
                                                            <td className="py-2 pl-3 pr-1">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={(e) => {
                                                                        const next = new Set(selectedCasosIds);
                                                                        if (e.target.checked) next.add(idCaso);
                                                                        else next.delete(idCaso);
                                                                        setSelectedCasosIds(next);
                                                                    }}
                                                                />
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const next = new Set(expandedCasos);
                                                                        if (isExpanded) next.delete(idCaso);
                                                                        else next.add(idCaso);
                                                                        setExpandedCasos(next);
                                                                    }}
                                                                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-primary hover:bg-primary/10"
                                                                >
                                                                    {isExpanded ? (
                                                                        <IconChevronDown size={14} />
                                                                    ) : (
                                                                        <IconChevronRight size={14} />
                                                                    )}
                                                                    <span>Ver</span>
                                                                </button>
                                                            </td>
                                                            <td className="py-2 px-2 font-mono font-bold text-foreground">
                                                                #{c.caso_adlab || c.id_caso}
                                                            </td>
                                                            <td className="py-2 px-2">
                                                                <div className="font-medium text-foreground">
                                                                    {c.nombre_centro}
                                                                </div>
                                                                <div className="text-[10px] text-muted-foreground">
                                                                    {c.nombre_tipoagua}
                                                                </div>
                                                            </td>
                                                            <td className="py-2 px-2 text-muted-foreground">
                                                                {c.cliente_entrega}
                                                            </td>
                                                            <td className="py-2 px-2 font-mono text-[11px] text-muted-foreground">
                                                                {c.fecha_recepcion} → {c.fecha_informe}
                                                            </td>
                                                            <td className="py-2 px-2 text-right">
                                                                {c.lineas?.length || 0}
                                                            </td>
                                                            <td className="py-2 px-2 text-right font-mono font-bold text-foreground">
                                                                {fmtUf(c.uf_totalfac)} UF
                                                            </td>
                                                            <td className="py-2 pr-3 text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-6 px-2 text-[11px]"
                                                                    title="Cambiar Empresa a Facturar de este caso"
                                                                    onClick={() => {
                                                                        setCasoCambiarEmpresa(c);
                                                                        setNuevaEmpresaId(
                                                                            String(c.id_empresaservicio)
                                                                        );
                                                                    }}
                                                                >
                                                                    <IconArrowsExchange size={13} /> Empresa
                                                                </Button>
                                                            </td>
                                                        </tr>

                                                        {/* Sub-tabla expandible de técnicas (muestras_detalle) con edición manual */}
                                                        {isExpanded && (
                                                            <tr className="bg-muted/20">
                                                                <td colSpan={9} className="p-3">
                                                                    <div className="rounded-md border border-border bg-background p-2.5">
                                                                        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                                                                            <span>
                                                                                Desglose Técnico Caso #{c.caso_adlab} (Edición manual caso a caso habilitada)
                                                                            </span>
                                                                            <span>
                                                                                Recepción: {c.n_recepcion || '—'} · Especie: {c.nombre_especie || '—'}
                                                                            </span>
                                                                        </div>
                                                                        <table className="w-full text-[11px]">
                                                                            <thead>
                                                                                <tr className="border-b border-border text-muted-foreground">
                                                                                    <th className="py-1 text-left">Ítem</th>
                                                                                    <th className="py-1 text-left">Técnica</th>
                                                                                    <th className="py-1 text-left">Órgano / Medio</th>
                                                                                    <th className="py-1 text-left">Ingreso (Ind/Pool)</th>
                                                                                    <th className="py-1 text-left">Regla / Origen</th>
                                                                                    <th className="py-1 text-right">N° Análisis</th>
                                                                                    <th className="py-1 text-right">UF Unitario</th>
                                                                                    <th className="py-1 text-right">UF Total</th>
                                                                                    <th className="py-1 text-right">Ajustar</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-border/60">
                                                                                {(c.lineas || []).map((l: any) => {
                                                                                    const lineKey = `${c.id_caso}_${l.item}_${l.id_tecnica}`;
                                                                                    const isEditing = editingLineKey === lineKey;
                                                                                    return (
                                                                                        <tr key={lineKey}>
                                                                                            <td className="py-1.5 font-mono">{l.item}</td>
                                                                                            <td className="py-1.5 font-medium text-foreground">
                                                                                                [{l.id_tecnica}] {l.nombre_tecnica}
                                                                                            </td>
                                                                                            <td className="py-1.5 text-muted-foreground">
                                                                                                {l.nombre_organo}
                                                                                                {l.nombre_medios ? ` / ${l.nombre_medios}` : ''}
                                                                                            </td>
                                                                                            <td className="py-1.5 text-muted-foreground">
                                                                                                {l.tipoingreso} (I:{l.ind_nmuestras} / P:{l.pol_npooles})
                                                                                            </td>
                                                                                            <td className="py-1.5">
                                                                                                <Badge variant="outline" className="text-[10px]">
                                                                                                    {l.regla_aplicada || (l.mf === 1 ? 'Valorizado' : 'Pendiente')}
                                                                                                </Badge>
                                                                                            </td>
                                                                                            <td className="py-1.5 text-right font-mono">
                                                                                                {isEditing ? (
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        step="1"
                                                                                                        value={editCant}
                                                                                                        onChange={(e) => setEditCant(e.target.value)}
                                                                                                        className="w-16 rounded border border-input px-1 py-0.5 text-right"
                                                                                                    />
                                                                                                ) : (
                                                                                                    l.n_analisis
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-1.5 text-right font-mono">
                                                                                                {isEditing ? (
                                                                                                    <input
                                                                                                        type="number"
                                                                                                        step="0.0001"
                                                                                                        value={editUnitUf}
                                                                                                        onChange={(e) => setEditUnitUf(e.target.value)}
                                                                                                        className="w-24 rounded border border-input px-1 py-0.5 text-right"
                                                                                                    />
                                                                                                ) : (
                                                                                                    fmtUf(l.vtaunitario)
                                                                                                )}
                                                                                            </td>
                                                                                            <td className="py-1.5 text-right font-mono font-bold text-foreground">
                                                                                                {fmtUf(l.vtatotal)} UF
                                                                                            </td>
                                                                                            <td className="py-1.5 text-right">
                                                                                                {isEditing ? (
                                                                                                    <div className="flex justify-end gap-1">
                                                                                                        <Button
                                                                                                            size="sm"
                                                                                                            className="h-6 px-2 text-[10px]"
                                                                                                            disabled={savingLine}
                                                                                                            onClick={() => handleGuardarLineaManual(c, l)}
                                                                                                        >
                                                                                                            <IconCheck size={12} /> Guardar
                                                                                                        </Button>
                                                                                                        <Button
                                                                                                            variant="ghost"
                                                                                                            size="sm"
                                                                                                            className="h-6 px-1.5 text-[10px]"
                                                                                                            onClick={() => setEditingLineKey(null)}
                                                                                                        >
                                                                                                            ✕
                                                                                                        </Button>
                                                                                                    </div>
                                                                                                ) : (
                                                                                                    <Button
                                                                                                        variant="ghost"
                                                                                                        size="sm"
                                                                                                        className="h-6 px-2 text-[10px]"
                                                                                                        onClick={() => {
                                                                                                            setEditingLineKey(lineKey);
                                                                                                            setEditCant(String(l.n_analisis || 1));
                                                                                                            setEditUnitUf(String(l.vtaunitario || 0));
                                                                                                        }}
                                                                                                    >
                                                                                                        <IconEdit size={12} /> Editar UF
                                                                                                    </Button>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>
                                                                                    );
                                                                                })}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>

            {/* Modal para Cambiar Empresa a Facturar de un Caso */}
            {casoCambiarEmpresa && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="w-full max-w-md p-5">
                        <h3 className="m-0 text-base font-bold text-foreground">
                            Reasignar Empresa a Facturar · Caso #{casoCambiarEmpresa.caso_adlab}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Replica la opción de <span className="font-mono">fac_elimina_reprocesa_v2.scx</span> (actualiza{' '}
                            <span className="font-mono">muestras.id_empresaservicio</span>).
                        </p>

                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold">Nueva Empresa de Servicio</label>
                            <select
                                value={nuevaEmpresaId}
                                onChange={(e) => setNuevaEmpresaId(e.target.value)}
                                className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                            >
                                {(maestros.empresasServicio || []).map((es: any) => (
                                    <option key={es.id_empresaservicio} value={es.id_empresaservicio}>
                                        {es.nombre_empresaservicios} ({es.rut_empresaservicios})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setCasoCambiarEmpresa(null)}>
                                Cancelar
                            </Button>
                            <Button size="sm" onClick={handleConfirmarCambioEmpresa}>
                                Guardar Nueva Empresa
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Modal para Confirmar y Crear Pre-Facturas */}
            {modalCrearOpen && selectedEmpresa && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
                        <h3 className="m-0 text-base font-bold text-foreground">
                            Confirmar Creación de Pre-Factura(s) · {selectedEmpresa.nombre_empresaservicios}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Se consumirá correlativo en <span className="font-mono">Mae_id.id_facturacion</span>, se
                            insertará en <span className="font-mono">facturacion_enc</span> /{' '}
                            <span className="font-mono">facturacion_det</span> y los casos pasarán a{' '}
                            <Badge variant="secondary" className="text-[10px]">FACTURADO</Badge>.
                        </p>

                        {/* Previsualización de Grupos */}
                        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                            <p className="m-0 mb-2 text-xs font-bold">
                                Se generarán {previewGrupos.length} Pre-Factura(s) por criterio "{criterioAgrupacion}":
                            </p>
                            <div className="max-h-36 space-y-1.5 overflow-y-auto text-xs">
                                {previewGrupos.map((g, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center justify-between rounded bg-background px-2.5 py-1.5"
                                    >
                                        <span className="font-medium">{g.label}</span>
                                        <span className="font-mono">
                                            {g.casos.length} caso(s) · <strong>{fmtUf(g.totalUf)} UF</strong> ($
                                            {fmtClp(g.totalUf * valorUf)})
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold">Fecha de Facturación</label>
                                <input
                                    type="date"
                                    value={formPrefactura.fecha_facturacion}
                                    onChange={(e) =>
                                        setFormPrefactura({ ...formPrefactura, fecha_facturacion: e.target.value })
                                    }
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Forma de Pago</label>
                                <select
                                    value={formPrefactura.id_formapago}
                                    onChange={(e) =>
                                        setFormPrefactura({
                                            ...formPrefactura,
                                            id_formapago: Number(e.target.value),
                                        })
                                    }
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                >
                                    {(maestros.formasPago || []).map((fp: any) => (
                                        <option key={fp.id_formapago} value={fp.id_formapago}>
                                            {fp.nombre_formapago}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-xs font-semibold">
                                    Plantilla de Glosa (mae_glosa) o Texto Libre
                                </label>
                                <select
                                    value={formPrefactura.id_glosa}
                                    onChange={(e) => {
                                        const idG = Number(e.target.value);
                                        const found = (maestros.glosas || []).find(
                                            (g: any) => Number(g.id_glosa) === idG
                                        );
                                        setFormPrefactura({
                                            ...formPrefactura,
                                            id_glosa: idG,
                                            glosa: found ? found.nombre_glosa : formPrefactura.glosa,
                                        });
                                    }}
                                    className="mb-2 h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                >
                                    <option value={0}>-- Seleccionar plantilla de glosa --</option>
                                    {(maestros.glosas || []).map((g: any) => (
                                        <option key={g.id_glosa} value={g.id_glosa}>
                                            {g.nombre_glosa}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={formPrefactura.glosa}
                                    onChange={(e) => setFormPrefactura({ ...formPrefactura, glosa: e.target.value })}
                                    placeholder="Detalle / Glosa de la factura..."
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">N° Orden de Compra (Opcional)</label>
                                <input
                                    type="text"
                                    value={formPrefactura.ocompra}
                                    onChange={(e) => setFormPrefactura({ ...formPrefactura, ocompra: e.target.value })}
                                    placeholder="Ej: 4500123456"
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Fecha OC</label>
                                <input
                                    type="date"
                                    value={formPrefactura.ocompra_fecha}
                                    onChange={(e) =>
                                        setFormPrefactura({ ...formPrefactura, ocompra_fecha: e.target.value })
                                    }
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">N° HES / MIGO (Opcional)</label>
                                <input
                                    type="text"
                                    value={formPrefactura.hes}
                                    onChange={(e) => setFormPrefactura({ ...formPrefactura, hes: e.target.value })}
                                    placeholder="Ej: 100098765"
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold">Fecha HES</label>
                                <input
                                    type="date"
                                    value={formPrefactura.hes_fecha}
                                    onChange={(e) =>
                                        setFormPrefactura({ ...formPrefactura, hes_fecha: e.target.value })
                                    }
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="mb-1 block text-xs font-semibold">
                                    Nota pie de factura (se exporta en columna 35 de DTE)
                                </label>
                                <input
                                    type="text"
                                    value={formPrefactura.nota}
                                    onChange={(e) => setFormPrefactura({ ...formPrefactura, nota: e.target.value })}
                                    placeholder="Nota adicional..."
                                    className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-xs"
                                />
                            </div>
                        </div>

                        <div className="mt-5 flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setModalCrearOpen(false)}>
                                Cancelar
                            </Button>
                            <Button onClick={handleCrearPrefacturas} disabled={creandoPrefacturas}>
                                <IconCheck size={16} />
                                {creandoPrefacturas
                                    ? 'Generando Pre-Facturas...'
                                    : `Confirmar y Crear ${previewGrupos.length} Pre-Factura(s)`}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default FacturacionSaludProcesar;

