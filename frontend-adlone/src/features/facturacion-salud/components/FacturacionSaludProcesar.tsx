import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArrowLeft, IconCalculator, IconFilePlus, IconFilterOff, IconSearch, IconSparkles } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type MaestrosDocumentos } from '../services/facturacionSalud.service';
import { Campo, Dato, SelectBuscable } from './compartido';
import { aNumero, fmtClp, fmtNum, type Fila } from './formatos';
import CasosTabla from './procesar/CasosTabla';
import CrearFacturasDialog, { type DatosFacturas } from './procesar/CrearFacturasDialog';
import ParametrosCard, { type Programa } from './procesar/ParametrosCard';

interface Props {
    initialPrograma?: number;
    /** Navega a otra vista del módulo; con `idFactura` la vista abre esa factura. */
    onNavigate?: (vista: string, idFactura?: number) => void;
}

const CRITERIOS = [
    { value: 'Na', label: 'Una sola factura con todos los casos' },
    { value: 'Centro', label: 'Por centro de cultivo' },
    { value: 'Veterinario', label: 'Por médico veterinario' },
    { value: 'Centro - Veterinario', label: 'Por centro y médico veterinario' },
    { value: 'Tipo de Agua', label: 'Por tipo de agua' },
    { value: 'Tipo de Agua - Veterinario', label: 'Por tipo de agua y médico veterinario' },
    { value: 'Lote', label: 'Por lote' },
    { value: 'Especie', label: 'Por especie' },
];

/** Valorizar y crear facturas (réplica de «Pre-Facturación» y «Facturar» de ADLSOFT). */
const FacturacionSaludProcesar: React.FC<Props> = ({ initialPrograma = 4, onNavigate }) => {
    const { showToast } = useToast();

    const [programas, setProgramas] = useState<Programa[]>([]);
    const [programa, setPrograma] = useState<number>(initialPrograma);
    const [ensilaje, setEnsilaje] = useState(false);
    const [proa, setProa] = useState(false);
    const [fechaIni, setFechaIni] = useState('');
    const [fechaFin, setFechaFin] = useState('');
    const [informeIni, setInformeIni] = useState('');
    const [informeFin, setInformeFin] = useState('');
    const [uf, setUf] = useState('');
    const [usd, setUsd] = useState('');
    const [maestrosDoc, setMaestrosDoc] = useState<MaestrosDocumentos | null>(null);

    const [empresas, setEmpresas] = useState<Fila[]>([]);
    const [cargandoEmpresas, setCargandoEmpresas] = useState(false);
    const [busquedaEmpresa, setBusquedaEmpresa] = useState('');
    const [empresa, setEmpresa] = useState<Fila | null>(null);
    const [mostrarEmpresas, setMostrarEmpresas] = useState(true);

    const [casos, setCasos] = useState<Fila[]>([]);
    const [cargandoCasos, setCargandoCasos] = useState(false);
    const [elegidos, setElegidos] = useState<Set<number>>(new Set());
    const [valorizando, setValorizando] = useState(false);
    const [reglas, setReglas] = useState<Record<string, number>>({});
    const [guardandoLinea, setGuardandoLinea] = useState(false);

    const [criterio, setCriterio] = useState('Na');
    const [incluirRezagados] = useState(false);
    const [filtroSubprograma, setFiltroSubprograma] = useState('ALL');
    const [filtroCentro, setFiltroCentro] = useState('ALL');
    const [filtroVeterinario, setFiltroVeterinario] = useState('ALL');
    const [filtroTipoAgua, setFiltroTipoAgua] = useState('ALL');
    const [filtroLote, setFiltroLote] = useState('ALL');
    const [filtroEspecie, setFiltroEspecie] = useState('ALL');
    const [busquedaCaso, setBusquedaCaso] = useState('');
    const [dialogoAbierto, setDialogoAbierto] = useState(false);
    const [creando, setCreando] = useState(false);

    const valorUf = aNumero(uf);
    const valorUsd = aNumero(usd);
    const modalidad4 = programa === 4;

    useEffect(() => { if (initialPrograma) setPrograma(initialPrograma); }, [initialPrograma]);

    useEffect(() => {
        facturacionSaludService.getMaestros().then((m) => setProgramas(m.programas ?? [])).catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los programas.') }));
        facturacionSaludService.getMaestrosDocumentos().then(setMaestrosDoc).catch(() => undefined);
        facturacionSaludService.getDashboard().then((d) => { if (d?.kpis?.ultimaUf) setUf(fmtNum(d.kpis.ultimaUf)); }).catch(() => undefined);
    }, [showToast]);

    const cargarEmpresas = useCallback(async () => {
        // Como en ADLSOFT: sin rango de fechas no se busca
        if (!fechaIni || !fechaFin) {
            setEmpresas([]);
            return;
        }
        setCargandoEmpresas(true);
        try {
            setEmpresas((await facturacionSaludService.getEmpresasElegibles({ eligeprograma: programa, fecha_proceso_ini: fechaIni, fecha_proceso_fin: fechaFin, ensilaje: modalidad4 ? ensilaje : false, proa: modalidad4 ? proa : false })) || []);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudieron buscar las empresas con casos pendientes.') });
        } finally {
            setCargandoEmpresas(false);
        }
    }, [programa, fechaIni, fechaFin, ensilaje, proa, modalidad4, showToast]);

    useEffect(() => {
        cargarEmpresas();
        setEmpresa(null);
        setMostrarEmpresas(true);
        setCasos([]);
        setReglas({});
    }, [cargarEmpresas]);

    const cargarCasosEmpresa = useCallback(async (emp: Fila, incluirRez: boolean) => {
        setCargandoCasos(true);
        setReglas({});
        setFiltroSubprograma('ALL');
        setFiltroCentro('ALL');
        setFiltroVeterinario('ALL');
        setFiltroTipoAgua('ALL');
        setFiltroLote('ALL');
        setFiltroEspecie('ALL');
        setBusquedaCaso('');
        try {
            const lista = (await facturacionSaludService.getCasosElegibles({
                eligeprograma: programa,
                id_empresaservicio: emp.id_empresaservicio,
                fecha_proceso_ini: fechaIni,
                fecha_proceso_fin: fechaFin,
                ensilaje: modalidad4 ? ensilaje : false,
                proa: modalidad4 ? proa : false,
                incluir_rezagados: incluirRez,
            })) || [];
            setCasos(lista);
            setElegidos(new Set(lista.map((c: Fila) => Number(c.id_caso))));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los casos de la empresa.') });
        } finally {
            setCargandoCasos(false);
        }
    }, [programa, fechaIni, fechaFin, modalidad4, ensilaje, proa, showToast]);

    const elegirEmpresa = async (emp: Fila) => {
        setEmpresa(emp);
        setMostrarEmpresas(false);
        await cargarCasosEmpresa(emp, incluirRezagados);
    };

    // Opciones dinámicas de filtro según los casos de la empresa seleccionada
    const opcionesSubprograma = useMemo(() => {
        const conteo = new Map<string, { label: string; n: number }>();
        for (const c of casos) {
            const key = String(c.id_programa ?? '');
            const nombre = String(c.nombre_programa || `Programa ${key}`).trim();
            const actual = conteo.get(key) ?? { label: nombre, n: 0 };
            actual.n += 1;
            conteo.set(key, actual);
        }
        const items = [...conteo.entries()]
            .sort((a, b) => a[1].label.localeCompare(b[1].label, 'es'))
            .map(([value, { label, n }]) => ({ value, label: `${label} (${n})` }));
        return [{ value: 'ALL', label: `Todos los subprogramas (${casos.length})` }, ...items];
    }, [casos]);

    const opcionesCentro = useMemo(() => {
        const conteo = new Map<string, { label: string; n: number }>();
        for (const c of casos) {
            const key = String(c.id_centro ?? '');
            const nombre = String(c.nombre_centro || c.id_centro || 'Sin centro').trim();
            const actual = conteo.get(key) ?? { label: nombre, n: 0 };
            actual.n += 1;
            conteo.set(key, actual);
        }
        const items = [...conteo.entries()]
            .sort((a, b) => a[1].label.localeCompare(b[1].label, 'es'))
            .map(([value, { label, n }]) => ({ value, label: `${label} (${n})` }));
        return [{ value: 'ALL', label: `Todos los centros (${casos.length})` }, ...items];
    }, [casos]);

    const opcionesVeterinario = useMemo(() => {
        const conteo = new Map<string, number>();
        const baseCasos = filtroCentro === 'ALL' ? casos : casos.filter((c) => String(c.id_centro ?? '') === filtroCentro);
        for (const c of baseCasos) {
            const vet = String(c.cliente_entrega || 'Sin veterinario').trim() || 'Sin veterinario';
            conteo.set(vet, (conteo.get(vet) ?? 0) + 1);
        }
        const items = [...conteo.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'es'))
            .map(([vet, n]) => ({ value: vet, label: `${vet} (${n})` }));
        return [{ value: 'ALL', label: `Todos los veterinarios (${baseCasos.length})` }, ...items];
    }, [casos, filtroCentro]);

    const opcionesTipoAgua = useMemo(() => {
        const conteo = new Map<string, { label: string; n: number }>();
        for (const c of casos) {
            const key = String(c.id_tipoagua ?? '');
            const nombre = String(c.nombre_tipoagua || 'General').trim() || 'General';
            const actual = conteo.get(key) ?? { label: nombre, n: 0 };
            actual.n += 1;
            conteo.set(key, actual);
        }
        const items = [...conteo.entries()]
            .sort((a, b) => a[1].label.localeCompare(b[1].label, 'es'))
            .map(([value, { label, n }]) => ({ value, label: `${label} (${n})` }));
        return [{ value: 'ALL', label: `Todos los tipos de agua (${casos.length})` }, ...items];
    }, [casos]);

    const opcionesLote = useMemo(() => {
        const conteo = new Map<string, number>();
        for (const c of casos) {
            const lote = String(c.lote || '').trim() || 'Sin lote';
            conteo.set(lote, (conteo.get(lote) ?? 0) + 1);
        }
        const items = [...conteo.entries()]
            .sort((a, b) => a[0].localeCompare(b[0], 'es'))
            .map(([lote, n]) => ({ value: lote, label: `${lote} (${n})` }));
        return [{ value: 'ALL', label: `Todos los lotes (${casos.length})` }, ...items];
    }, [casos]);

    const opcionesEspecie = useMemo(() => {
        const conteo = new Map<string, { label: string; n: number }>();
        for (const c of casos) {
            const key = String(c.id_especie ?? '');
            const nombre = String(c.nombre_especie || 'Sin especie').trim() || 'Sin especie';
            const actual = conteo.get(key) ?? { label: nombre, n: 0 };
            actual.n += 1;
            conteo.set(key, actual);
        }
        const items = [...conteo.entries()]
            .sort((a, b) => a[1].label.localeCompare(b[1].label, 'es'))
            .map(([value, { label, n }]) => ({ value, label: `${label} (${n})` }));
        return [{ value: 'ALL', label: `Todas las especies (${casos.length})` }, ...items];
    }, [casos]);

    const filtrarListaCasos = useCallback(
        (lista: Fila[], subprog: string, cen: string, vet: string, agua: string, lote: string, especie: string, texto: string) => {
            const q = texto.trim().toLowerCase();
            return lista.filter((c) => {
                if (subprog !== 'ALL' && String(c.id_programa ?? '') !== subprog) return false;
                if (cen !== 'ALL' && String(c.id_centro ?? '') !== cen) return false;
                if (vet !== 'ALL' && (String(c.cliente_entrega || 'Sin veterinario').trim() || 'Sin veterinario') !== vet) return false;
                if (agua !== 'ALL' && String(c.id_tipoagua ?? '') !== agua) return false;
                if (lote !== 'ALL' && (String(c.lote || '').trim() || 'Sin lote') !== lote) return false;
                if (especie !== 'ALL' && String(c.id_especie ?? '') !== especie) return false;
                if (q) {
                    const coincide = [c.caso_adlab, c.id_caso, c.nombre_centro, c.cliente_entrega, c.nombre_tipoagua, c.nombre_programa, c.lote, c.nombre_especie, c.n_recepcion]
                        .some((v) => String(v ?? '').toLowerCase().includes(q));
                    if (!coincide) return false;
                }
                return true;
            });
        },
        []
    );

    const casosVisibles = useMemo(
        () => filtrarListaCasos(casos, filtroSubprograma, filtroCentro, filtroVeterinario, filtroTipoAgua, filtroLote, filtroEspecie, busquedaCaso),
        [casos, filtroSubprograma, filtroCentro, filtroVeterinario, filtroTipoAgua, filtroLote, filtroEspecie, busquedaCaso, filtrarListaCasos]
    );

    const aplicarFiltrosCategoria = (nuevoSubprog: string, nuevoCentro: string, nuevoVet: string, nuevaAgua: string, nuevoLote: string, nuevaEspecie: string) => {
        setFiltroSubprograma(nuevoSubprog);
        setFiltroCentro(nuevoCentro);
        setFiltroVeterinario(nuevoVet);
        setFiltroTipoAgua(nuevaAgua);
        setFiltroLote(nuevoLote);
        setFiltroEspecie(nuevaEspecie);
        const filtrados = filtrarListaCasos(casos, nuevoSubprog, nuevoCentro, nuevoVet, nuevaAgua, nuevoLote, nuevaEspecie, busquedaCaso);
        setElegidos(new Set(filtrados.map((c) => Number(c.id_caso))));
    };

    const cambiarCriterio = (nuevoCriterio: string) => {
        setCriterio(nuevoCriterio);
        // Al cambiar de categoría de agrupación, limpiar los filtros que no correspondan a la nueva categoría
        const usaCentro = nuevoCriterio === 'Centro' || nuevoCriterio === 'Centro - Veterinario' || nuevoCriterio === 'Na';
        const usaVet = nuevoCriterio === 'Veterinario' || nuevoCriterio === 'Centro - Veterinario' || nuevoCriterio === 'Tipo de Agua - Veterinario' || nuevoCriterio === 'Na';
        const usaAgua = nuevoCriterio === 'Tipo de Agua' || nuevoCriterio === 'Tipo de Agua - Veterinario';
        const usaLote = nuevoCriterio === 'Lote';
        const usaEspecie = nuevoCriterio === 'Especie';
        const nextCen = usaCentro ? filtroCentro : 'ALL';
        const nextVet = usaVet ? filtroVeterinario : 'ALL';
        const nextAgua = usaAgua ? filtroTipoAgua : 'ALL';
        const nextLote = usaLote ? filtroLote : 'ALL';
        const nextEspecie = usaEspecie ? filtroEspecie : 'ALL';
        if (nextCen !== filtroCentro || nextVet !== filtroVeterinario || nextAgua !== filtroTipoAgua || nextLote !== filtroLote || nextEspecie !== filtroEspecie) {
            aplicarFiltrosCategoria(filtroSubprograma, nextCen, nextVet, nextAgua, nextLote, nextEspecie);
        }
    };

    const limpiarFiltrosCasos = () => {
        setFiltroSubprograma('ALL');
        setFiltroCentro('ALL');
        setFiltroVeterinario('ALL');
        setFiltroTipoAgua('ALL');
        setFiltroLote('ALL');
        setFiltroEspecie('ALL');
        setBusquedaCaso('');
        setElegidos(new Set(casos.map((c) => Number(c.id_caso))));
    };

    const hayFiltroActivo = filtroSubprograma !== 'ALL' || filtroCentro !== 'ALL' || filtroVeterinario !== 'ALL' || filtroTipoAgua !== 'ALL' || filtroLote !== 'ALL' || filtroEspecie !== 'ALL' || busquedaCaso.trim() !== '';
    const mostrarFiltroSubprograma = opcionesSubprograma.length > 2;
    const mostrarFiltroCentro = criterio === 'Centro' || criterio === 'Centro - Veterinario' || criterio === 'Na';
    const mostrarFiltroVet = criterio === 'Veterinario' || criterio === 'Centro - Veterinario' || criterio === 'Tipo de Agua - Veterinario' || criterio === 'Na';
    const mostrarFiltroAgua = criterio === 'Tipo de Agua' || criterio === 'Tipo de Agua - Veterinario';
    const mostrarFiltroLote = criterio === 'Lote';
    const mostrarFiltroEspecie = criterio === 'Especie';

    const valorizar = async () => {
        if (!empresa) return;
        if (!(valorUf > 0)) return showToast({ type: 'warning', message: 'Debes ingresar el valor de la UF.' });
        if (Number(empresa.id_empresaservicio) === 500 && !(valorUsd > 0)) return showToast({ type: 'warning', message: 'Para esta empresa debes ingresar el valor del dólar.' });
        setValorizando(true);
        try {
            const r = await facturacionSaludService.valorizarCasos({
                id_empresaservicio: empresa.id_empresaservicio, eligeprograma: programa, fecha_proceso_ini: fechaIni || undefined, fecha_proceso_fin: fechaFin || undefined,
                ensilaje: modalidad4 ? ensilaje : false, proa: modalidad4 ? proa : false, incluir_rezagados: incluirRezagados, uf: valorUf, usd: valorUsd || undefined,
                casos_ids: elegidos.size > 0 ? Array.from(elegidos) : undefined,
            });
            setCasos(r.casos || []);
            setReglas(r.reglasAplicadas || {});
            const nuevosIds = new Set((r.casos || []).map((c: Fila) => Number(c.id_caso)));
            setElegidos((prev) => {
                const conservados = [...prev].filter((id) => nuevosIds.has(id));
                return conservados.length > 0 ? new Set(conservados) : nuevosIds;
            });
            showToast({ type: 'success', message: `Valorización lista: ${r.casosValorizados} caso(s), ${r.lineasValorizadas} línea(s), ${fmtNum(r.ufTotalGeneral)} UF.` });
            cargarEmpresas();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo valorizar.') });
        } finally {
            setValorizando(false);
        }
    };

    const guardarLinea = async (caso: Fila, linea: Fila, cantidad: number, unitario: number) => {
        setGuardandoLinea(true);
        try {
            const r = await facturacionSaludService.actualizarLineaCasoManual({ id_caso: caso.id_caso, item: linea.item, id_tecnica: linea.id_tecnica, n_analisis: cantidad, vtaunitario: unitario });
            setCasos((prev) => prev.map((c) => c.id_caso !== caso.id_caso ? c : {
                ...c,
                uf_totalfac: r.uf_totalfac_caso,
                lineas: c.lineas.map((l: Fila) => (l.item === linea.item && l.id_tecnica === linea.id_tecnica ? { ...l, n_analisis: r.n_analisis, vtaunitario: r.vtaunitario, vtatotal: r.vtatotal, mf: 1, regla_aplicada: 'Ajuste manual' } : l)),
            }));
            showToast({ type: 'success', message: `Se ajustó el caso ${caso.caso_adlab || caso.id_caso}.` });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo ajustar la línea.') });
        } finally {
            setGuardandoLinea(false);
        }
    };

    const grupos = useMemo(() => {
        const mapa = new Map<string, { label: string; casos: number; totalUf: number }>();
        for (const c of casos.filter((x) => elegidos.has(Number(x.id_caso)))) {
            let clave = 'TODOS';
            let label = 'Todos los casos elegidos';
            if (criterio === 'Centro') { clave = `C${c.id_centro}`; label = `Centro: ${c.nombre_centro || c.id_centro}`; }
            else if (criterio === 'Veterinario') { clave = `V${c.cliente_entrega}`; label = `Veterinario: ${c.cliente_entrega || 'sin veterinario'}`; }
            else if (criterio === 'Centro - Veterinario') { clave = `CV${c.id_centro}|${c.cliente_entrega}`; label = `${c.nombre_centro} · ${c.cliente_entrega}`; }
            else if (criterio === 'Tipo de Agua') { clave = `A${c.id_tipoagua}`; label = `Agua: ${c.nombre_tipoagua || 'general'}`; }
            else if (criterio === 'Tipo de Agua - Veterinario') { clave = `AV${c.id_tipoagua}|${c.cliente_entrega}`; label = `${c.nombre_tipoagua} · ${c.cliente_entrega}`; }
            else if (criterio === 'Lote') { const lote = String(c.lote || '').trim() || 'Sin lote'; clave = `L${lote}`; label = `Lote: ${lote}`; }
            else if (criterio === 'Especie') { const esp = String(c.nombre_especie || '').trim() || 'Sin especie'; clave = `E${c.id_especie ?? esp}`; label = `Especie: ${esp}`; }
            const g = mapa.get(clave) ?? { label, casos: 0, totalUf: 0 };
            g.casos += 1;
            g.totalUf = Math.round((g.totalUf + Number(c.uf_totalfac || 0)) * 1000) / 1000;
            mapa.set(clave, g);
        }
        return Array.from(mapa.values());
    }, [casos, elegidos, criterio]);

    const totalUf = useMemo(() => casos.filter((c) => elegidos.has(Number(c.id_caso))).reduce((a, c) => a + Number(c.uf_totalfac || 0), 0), [casos, elegidos]);
    const todosElegidosValorizados = useMemo(() => {
        const seleccionados = casos.filter((c) => elegidos.has(Number(c.id_caso)));
        if (seleccionados.length === 0) return false;
        return seleccionados.every((c) => (c.lineas || []).some((l: Fila) => Number(l.mf) === 1));
    }, [casos, elegidos]);

    const crear = async (datos: DatosFacturas) => {
        if (!empresa) return;
        setCreando(true);
        try {
            const r = await facturacionSaludService.crearPrefacturas({
                id_empresaservicio: empresa.id_empresaservicio,
                eligeprograma: programa,
                criterio_agrupacion: criterio,
                casos_ids: Array.from(elegidos),
                valor_uf: valorUf,
                valor_usd: valorUsd,
                fecha_proceso_ini: fechaIni,
                fecha_proceso_fin: fechaFin,
                fecha_informe_ini: informeIni,
                fecha_informe_fin: informeFin,
                incluir_rezagados: incluirRezagados,
                ...datos,
            });
            const ids: number[] = (r.prefacturas || []).map((p: Fila) => p.id_facturacion);
            showToast({ type: 'success', message: `Se crearon ${r.total_prefacturas_creadas} factura(s): N° ${ids.join(', ')}.` });
            setDialogoAbierto(false);
            onNavigate?.('fs-prefacturas', ids[0]);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudieron crear las facturas.') });
        } finally {
            setCreando(false);
        }
    };

    const empresasFiltradas = useMemo(() => {
        const q = busquedaEmpresa.trim().toLowerCase();
        if (!q) return empresas;
        return empresas.filter((e) => String(e.nombre_empresaservicios || '').toLowerCase().includes(q) || String(e.rut_empresaservicios || '').toLowerCase().includes(q));
    }, [empresas, busquedaEmpresa]);

    return (
        <div className="flex flex-col gap-5">
            <ParametrosCard
                programas={programas} programa={programa} onPrograma={(v) => { setPrograma(v); if (v !== 4) { setEnsilaje(false); setProa(false); } }}
                fechaIni={fechaIni} fechaFin={fechaFin} onFechaIni={setFechaIni} onFechaFin={setFechaFin}
                informeIni={informeIni} informeFin={informeFin} onInformeIni={setInformeIni} onInformeFin={setInformeFin}
                uf={uf} usd={usd} onUf={setUf} onUsd={setUsd} ensilaje={ensilaje} proa={proa} onEnsilaje={setEnsilaje} onProa={setProa} onRecargar={cargarEmpresas}
            />

            <div className={`grid grid-cols-1 gap-5 ${(!empresa || mostrarEmpresas) ? 'lg:grid-cols-12' : ''}`}>
                {(!empresa || mostrarEmpresas) && (
                    <Card className={`p-5 ${!empresa ? 'lg:col-span-12' : 'lg:col-span-4'}`}>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <h3 className="m-0 text-sm font-semibold text-foreground">Empresas con casos ({empresasFiltradas.length})</h3>
                            {empresa && (
                                <Button variant="ghost" size="sm" onClick={() => setMostrarEmpresas(false)}>
                                    Ocultar lista
                                </Button>
                            )}
                        </div>
                        <div className="relative mb-3">
                            <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-9" placeholder="Buscar por nombre o RUT" value={busquedaEmpresa} onChange={(e) => setBusquedaEmpresa(e.target.value)} />
                        </div>
                        {cargandoEmpresas ? (
                            <p className="py-10 text-center text-sm text-muted-foreground">Buscando empresas con casos pendientes…</p>
                        ) : (
                            <div className={empresa
                                ? 'flex max-h-[560px] flex-col gap-2 overflow-y-auto pr-1'
                                : 'grid max-h-[560px] grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3'
                            }>
                                {empresasFiltradas.map((emp) => {
                                    const activa = empresa?.id_empresaservicio === emp.id_empresaservicio;
                                    return (
                                        <button
                                            key={emp.id_empresaservicio}
                                            type="button"
                                            onClick={() => elegirEmpresa(emp)}
                                            className={`flex flex-col gap-1 rounded-lg border px-3.5 py-3 text-left transition ${activa ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                                        >
                                            <span className="whitespace-normal break-words text-sm font-medium text-foreground">{emp.nombre_empresaservicios}</span>
                                            <span className="text-xs text-muted-foreground">{emp.rut_empresaservicios} · {emp.precio_lista}</span>
                                            {emp.total_casos != null && <span className="text-xs text-muted-foreground">{emp.total_casos} caso(s)</span>}
                                        </button>
                                    );
                                })}
                                {empresasFiltradas.length === 0 && (
                                    <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                                        {fechaIni && fechaFin ? 'No hay empresas con casos pendientes para este programa y rango de fechas.' : 'Elige el rango de fechas de los datos a procesar para buscar las empresas.'}
                                    </p>
                                )}
                            </div>
                        )}
                    </Card>
                )}

                {empresa && (
                    <Card className={`p-5 ${mostrarEmpresas ? 'lg:col-span-8' : 'w-full'}`}>
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setMostrarEmpresas((v) => !v)}
                                        >
                                            <IconArrowLeft size={15} />
                                            {mostrarEmpresas ? 'Ocultar empresas' : `Cambiar empresa (${empresas.length})`}
                                        </Button>
                                        <h3 className="m-0 whitespace-normal break-words text-base font-semibold text-foreground">{empresa.nombre_empresaservicios}</h3>
                                    </div>
                                    <p className="m-0 mt-1.5 text-xs text-muted-foreground">{empresa.rut_empresaservicios} · Lista de precios: {empresa.precio_lista} · Precio especial: {empresa.precio_especial === 'S' ? 'sí' : 'no'} · Factor km: {empresa.factor_km}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" onClick={valorizar} disabled={valorizando || casos.length === 0}><IconSparkles size={16} />{valorizando ? 'Valorizando…' : 'Valorizar casos'}</Button>
                                    <Button
                                        onClick={() => setDialogoAbierto(true)}
                                        disabled={elegidos.size === 0 || !(valorUf > 0) || !todosElegidosValorizados}
                                        title={!todosElegidosValorizados && elegidos.size > 0 ? 'Debes valorizar los casos seleccionados antes de crear las facturas.' : undefined}
                                    >
                                        <IconFilePlus size={16} />Crear facturas ({grupos.length})
                                    </Button>
                                </div>
                            </div>

                            {Object.keys(reglas).length > 0 && (
                                <div className="rounded-lg border border-border bg-muted/30 p-4">
                                    <p className="m-0 mb-2 text-xs font-medium text-muted-foreground">Reglas de precio aplicadas</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {Object.entries(reglas).map(([regla, n]) => <Badge key={regla} variant="secondary" className="whitespace-normal break-words">{regla}: {n}</Badge>)}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-4 rounded-lg border border-border bg-muted/30 p-4">
                                <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <Campo label="Agrupar en facturas" info="Define cómo se dividirán los casos seleccionados al crear las facturas: todos en una sola factura o separados por Centro, Veterinario o Tipo de Agua.">
                                        <SelectBuscable opciones={CRITERIOS} valor={criterio} onChange={cambiarCriterio} />
                                    </Campo>

                                    {mostrarFiltroSubprograma && (
                                        <Campo label="Filtrar por subprograma" info="Filtra la tabla y selecciona automáticamente solo los casos del subprograma elegido (ej. Contingencia ISA o SRS).">
                                            <SelectBuscable
                                                opciones={opcionesSubprograma}
                                                valor={filtroSubprograma}
                                                onChange={(v) => aplicarFiltrosCategoria(v || 'ALL', filtroCentro, filtroVeterinario, filtroTipoAgua, filtroLote, filtroEspecie)}
                                                placeholder="Todos los subprogramas"
                                            />
                                        </Campo>
                                    )}

                                    {mostrarFiltroCentro && (
                                        <Campo label="Filtrar por centro" info="Filtra la tabla y selecciona automáticamente solo los casos pertenecientes al centro de cultivo elegido.">
                                            <SelectBuscable
                                                opciones={opcionesCentro}
                                                valor={filtroCentro}
                                                onChange={(v) => aplicarFiltrosCategoria(filtroSubprograma, v || 'ALL', filtroVeterinario, filtroTipoAgua, filtroLote, filtroEspecie)}
                                                placeholder="Todos los centros"
                                                buscar="Buscar centro de cultivo…"
                                            />
                                        </Campo>
                                    )}

                                    {mostrarFiltroVet && (
                                        <Campo label="Filtrar por médico veterinario" info="Filtra la tabla y selecciona automáticamente solo los casos asociados al médico veterinario elegido.">
                                            <SelectBuscable
                                                opciones={opcionesVeterinario}
                                                valor={filtroVeterinario}
                                                onChange={(v) => aplicarFiltrosCategoria(filtroSubprograma, filtroCentro, v || 'ALL', filtroTipoAgua, filtroLote, filtroEspecie)}
                                                placeholder="Todos los veterinarios"
                                                buscar="Buscar médico veterinario…"
                                            />
                                        </Campo>
                                    )}

                                    {mostrarFiltroAgua && (
                                        <Campo label="Filtrar por tipo de agua" info="Filtra la tabla y selecciona automáticamente solo los casos del tipo de agua elegido (Agua Dulce o Agua de Mar).">
                                            <SelectBuscable
                                                opciones={opcionesTipoAgua}
                                                valor={filtroTipoAgua}
                                                onChange={(v) => aplicarFiltrosCategoria(filtroSubprograma, filtroCentro, filtroVeterinario, v || 'ALL', filtroLote, filtroEspecie)}
                                                placeholder="Todos los tipos de agua"
                                            />
                                        </Campo>
                                    )}

                                    {mostrarFiltroLote && (
                                        <Campo label="Filtrar por lote" info="Filtra la tabla y selecciona automáticamente solo los casos del lote elegido.">
                                            <SelectBuscable
                                                opciones={opcionesLote}
                                                valor={filtroLote}
                                                onChange={(v) => aplicarFiltrosCategoria(filtroSubprograma, filtroCentro, filtroVeterinario, filtroTipoAgua, v || 'ALL', filtroEspecie)}
                                                placeholder="Todos los lotes"
                                                buscar="Buscar lote…"
                                            />
                                        </Campo>
                                    )}

                                    {mostrarFiltroEspecie && (
                                        <Campo label="Filtrar por especie" info="Filtra la tabla y selecciona automáticamente solo los casos de la especie elegida.">
                                            <SelectBuscable
                                                opciones={opcionesEspecie}
                                                valor={filtroEspecie}
                                                onChange={(v) => aplicarFiltrosCategoria(filtroSubprograma, filtroCentro, filtroVeterinario, filtroTipoAgua, filtroLote, v || 'ALL')}
                                                placeholder="Todas las especies"
                                                buscar="Buscar especie…"
                                            />
                                        </Campo>
                                    )}

                                    <Campo label="Buscar caso" info="Busca un caso específico por su código ADLAB (ej. PM-170806), N° recepción, centro, lote, especie o veterinario.">
                                        <div className="relative">
                                            <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                                className="pl-9"
                                                placeholder="Ej.: PM-170806, centro, lote o vet…"
                                                value={busquedaCaso}
                                                onChange={(e) => {
                                                    const texto = e.target.value;
                                                    setBusquedaCaso(texto);
                                                    const filtrados = filtrarListaCasos(casos, filtroSubprograma, filtroCentro, filtroVeterinario, filtroTipoAgua, filtroLote, filtroEspecie, texto);
                                                    setElegidos(new Set(filtrados.map((c) => Number(c.id_caso))));
                                                }}
                                            />
                                        </div>
                                    </Campo>
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/60 pt-3">
                                    <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
                                        <Dato label="Casos elegidos" info="Cantidad de casos marcados con check que se van a valorizar o facturar sobre el total de casos pendientes de la empresa.">
                                            {elegidos.size} de {casos.length}
                                            {hayFiltroActivo && (
                                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                                    ({casosVisibles.length} en vista)
                                                </span>
                                            )}
                                        </Dato>
                                        <Dato label="Total (UF)" info="Suma acumulada en UF de todos los casos actualmente marcados con check."><span className="text-base font-semibold">{fmtNum(totalUf, 3)}</span></Dato>
                                        <Dato label="Neto estimado" info="Monto neto estimado en pesos chilenos (sin IVA), calculado como Total (UF) × Valor de la UF.">$ {fmtClp(totalUf * valorUf)}</Dato>
                                    </div>
                                    {hayFiltroActivo && (
                                        <Button variant="ghost" size="sm" onClick={limpiarFiltrosCasos}>
                                            <IconFilterOff size={15} /> Limpiar filtros
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {cargandoCasos ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">Cargando casos y técnicas…</p>
                            ) : (
                                <CasosTabla casos={casosVisibles} elegidos={elegidos} onElegidos={setElegidos} guardando={guardandoLinea} onGuardarLinea={guardarLinea} />
                            )}
                        </div>
                    </Card>
                )}
            </div>

            <CrearFacturasDialog
                key={dialogoAbierto ? 'abierto' : 'cerrado'}
                abierto={dialogoAbierto}
                onCerrar={() => setDialogoAbierto(false)}
                empresa={empresa?.nombre_empresaservicios ?? ''}
                grupos={grupos}
                criterio={CRITERIOS.find((c) => c.value === criterio)?.label ?? criterio}
                uf={valorUf}
                idFormaPagoEmpresa={Number(empresa?.id_formapago) || undefined}
                maestros={maestrosDoc}
                creando={creando}
                onConfirmar={crear}
            />
        </div>
    );
};

export default FacturacionSaludProcesar;
