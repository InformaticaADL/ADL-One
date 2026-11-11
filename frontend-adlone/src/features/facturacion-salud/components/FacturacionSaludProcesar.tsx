import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconCalculator, IconFilePlus, IconSearch, IconSparkles } from '@tabler/icons-react';
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

    const [casos, setCasos] = useState<Fila[]>([]);
    const [cargandoCasos, setCargandoCasos] = useState(false);
    const [elegidos, setElegidos] = useState<Set<number>>(new Set());
    const [valorizando, setValorizando] = useState(false);
    const [reglas, setReglas] = useState<Record<string, number>>({});
    const [guardandoLinea, setGuardandoLinea] = useState(false);

    const [criterio, setCriterio] = useState('Na');
    const [dialogoAbierto, setDialogoAbierto] = useState(false);
    const [creando, setCreando] = useState(false);

    const valorUf = aNumero(uf);
    const valorUsd = aNumero(usd);
    const modalidad4 = programa === 4;

    useEffect(() => { if (initialPrograma) setPrograma(initialPrograma); }, [initialPrograma]);

    useEffect(() => {
        facturacionSaludService.getMaestros().then((m) => setProgramas(m.programas ?? [])).catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los programas.') }));
        facturacionSaludService.getMaestrosDocumentos().then(setMaestrosDoc).catch(() => undefined);
        facturacionSaludService.getDashboard().then((d) => { if (d?.kpis?.ultimaUf) setUf(String(d.kpis.ultimaUf)); }).catch(() => undefined);
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
        setCasos([]);
        setReglas({});
    }, [cargarEmpresas]);

    const elegirEmpresa = async (emp: Fila) => {
        setEmpresa(emp);
        setCargandoCasos(true);
        setReglas({});
        try {
            const lista = (await facturacionSaludService.getCasosElegibles({ eligeprograma: programa, id_empresaservicio: emp.id_empresaservicio, fecha_proceso_ini: fechaIni, fecha_proceso_fin: fechaFin, ensilaje: modalidad4 ? ensilaje : false, proa: modalidad4 ? proa : false })) || [];
            setCasos(lista);
            setElegidos(new Set(lista.map((c: Fila) => Number(c.id_caso))));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los casos de la empresa.') });
        } finally {
            setCargandoCasos(false);
        }
    };

    const valorizar = async () => {
        if (!empresa) return;
        if (!(valorUf > 0)) return showToast({ type: 'warning', message: 'Debes ingresar el valor de la UF.' });
        if (Number(empresa.id_empresaservicio) === 500 && !(valorUsd > 0)) return showToast({ type: 'warning', message: 'Para esta empresa debes ingresar el valor del dólar.' });
        setValorizando(true);
        try {
            const r = await facturacionSaludService.valorizarCasos({
                id_empresaservicio: empresa.id_empresaservicio, eligeprograma: programa, fecha_proceso_ini: fechaIni || undefined, fecha_proceso_fin: fechaFin || undefined,
                ensilaje: modalidad4 ? ensilaje : false, proa: modalidad4 ? proa : false, uf: valorUf, usd: valorUsd || undefined,
            });
            setCasos(r.casos || []);
            setReglas(r.reglasAplicadas || {});
            setElegidos(new Set((r.casos || []).map((c: Fila) => Number(c.id_caso))));
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
            const g = mapa.get(clave) ?? { label, casos: 0, totalUf: 0 };
            g.casos += 1;
            g.totalUf = Math.round((g.totalUf + Number(c.uf_totalfac || 0)) * 100) / 100;
            mapa.set(clave, g);
        }
        return Array.from(mapa.values());
    }, [casos, elegidos, criterio]);

    const totalUf = useMemo(() => casos.filter((c) => elegidos.has(Number(c.id_caso))).reduce((a, c) => a + Number(c.uf_totalfac || 0), 0), [casos, elegidos]);

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

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <Card className="p-5 lg:col-span-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="m-0 text-sm font-semibold text-foreground">Empresas con casos ({empresasFiltradas.length})</h3>
                    </div>
                    <div className="relative mb-3">
                        <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-9" placeholder="Buscar por nombre o RUT" value={busquedaEmpresa} onChange={(e) => setBusquedaEmpresa(e.target.value)} />
                    </div>
                    {cargandoEmpresas ? (
                        <p className="py-10 text-center text-sm text-muted-foreground">Buscando empresas con casos pendientes…</p>
                    ) : (
                        <div className="flex max-h-[560px] flex-col gap-2 overflow-y-auto pr-1">
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
                                <p className="py-8 text-center text-sm text-muted-foreground">
                                    {fechaIni && fechaFin ? 'No hay empresas con casos pendientes para este programa y rango de fechas.' : 'Elige el rango de fechas de los datos a procesar para buscar las empresas.'}
                                </p>
                            )}
                        </div>
                    )}
                </Card>

                <Card className="p-5 lg:col-span-8">
                    {!empresa ? (
                        <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
                            <IconCalculator size={36} className="opacity-40" />
                            <p className="m-0 text-sm font-medium text-foreground">Elige una empresa</p>
                            <p className="m-0 max-w-md text-sm">Podrás valorizar sus casos, ajustar precios línea por línea y agruparlos en facturas.</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-5">
                            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
                                <div className="min-w-0">
                                    <h3 className="m-0 whitespace-normal break-words text-base font-semibold text-foreground">{empresa.nombre_empresaservicios}</h3>
                                    <p className="m-0 mt-1 text-xs text-muted-foreground">{empresa.rut_empresaservicios} · Lista de precios: {empresa.precio_lista} · Precio especial: {empresa.precio_especial === 'S' ? 'sí' : 'no'} · Factor km: {empresa.factor_km}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button variant="outline" onClick={valorizar} disabled={valorizando || casos.length === 0}><IconSparkles size={16} />{valorizando ? 'Valorizando…' : 'Valorizar casos'}</Button>
                                    <Button onClick={() => setDialogoAbierto(true)} disabled={elegidos.size === 0 || !(valorUf > 0)}><IconFilePlus size={16} />Crear facturas ({grupos.length})</Button>
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

                            <div className="grid grid-cols-1 items-end gap-4 rounded-lg bg-muted/30 p-4 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]">
                                <Campo label="Agrupar en facturas"><SelectBuscable opciones={CRITERIOS} valor={criterio} onChange={setCriterio} /></Campo>
                                <Dato label="Casos elegidos">{elegidos.size} de {casos.length}</Dato>
                                <Dato label="Total (UF)"><span className="text-base font-semibold">{fmtNum(totalUf, 3)}</span></Dato>
                                <Dato label="Neto estimado">$ {fmtClp(totalUf * valorUf)}</Dato>
                            </div>

                            {cargandoCasos ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">Cargando casos y técnicas…</p>
                            ) : (
                                <CasosTabla casos={casos} elegidos={elegidos} onElegidos={setElegidos} guardando={guardandoLinea} onGuardarLinea={guardarLinea} />
                            )}
                        </div>
                    )}
                </Card>
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
