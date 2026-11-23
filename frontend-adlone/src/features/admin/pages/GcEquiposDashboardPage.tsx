import React, { useEffect, useMemo, useState } from 'react';
import { IconChartBar, IconDevices, IconThermometer, IconLayoutDashboard, IconArrowRight, IconRocket, IconDroplet, IconTransfer, IconFileDescription } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { formatearFecha } from '@/lib/fechas';
import { EquiposDashboard } from '../components/EquiposDashboard';
import { DashboardPuestaMarcha } from '../components/dashboard-gc/DashboardPuestaMarcha';
import { DashboardCaudal } from '../components/dashboard-gc/DashboardCaudal';
import { DashboardTraspasos } from '../components/dashboard-gc/DashboardTraspasos';
import { DashboardDocumentacion } from '../components/dashboard-gc/DashboardDocumentacion';
import { ResumenVerificacionTemp } from '../components/verificacion-temperatura/ResumenVerificacionTemp';
import { VerificacionTempEditor } from '../components/verificacion-temperatura/VerificacionTempEditor';
import { equipoService, type ResumenCalidad } from '../services/equipo.service';
import { verificacionTemperaturaService as tempApi, type VerificacionResumen } from '../services/verificacionTemperatura.service';
import { puestaMarchaService, type PuestaMarcha } from '../services/puestaMarcha.service';
import { verificacionCaudalService, type VerificacionCaudal } from '../services/verificacionCaudal.service';
import { hoyYmd, nombrePeriodo } from '../utils/verificacionTemperatura';
import { useNavStore } from '../../../store/navStore';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
    onBack: () => void;
}

type Pestana = 'general' | 'equipos' | 'temperaturas' | 'puesta-marcha' | 'caudal' | 'traspasos' | 'documentacion';

// Tarjeta de un número del resumen general. Si trae onClick, lleva al detalle.
const Kpi: React.FC<{ label: string; valor: number | string; tono?: string; detalle?: string; onClick?: () => void }> = ({ label, valor, tono = 'text-foreground', detalle, onClick }) => {
    const Comp = onClick ? 'button' : 'div';
    return (
        <Comp
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn('rounded-xl border border-border bg-card px-4 py-3 text-left', onClick && 'transition-colors hover:border-primary/40')}
        >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', tono)}>{valor}</p>
            {detalle && <p className="text-[11px] text-muted-foreground">{detalle}</p>}
        </Comp>
    );
};

const Seccion: React.FC<{ titulo: string; icono: React.ReactNode; accion?: { label: string; onClick: () => void }; children: React.ReactNode }> = ({ titulo, icono, accion, children }) => (
    <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">{icono}{titulo}</h2>
            {accion && (
                <button type="button" onClick={accion.onClick} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    {accion.label} <IconArrowRight size={13} />
                </button>
            )}
        </div>
        {children}
    </section>
);

/**
 * Dashboard de G.C. MAM: reúne en un solo lugar los dashboards que antes estaban dentro de
 * Inventario de Equipos (pestaña Dashboard) y de Verificación de Temperatura (Resumen y estadística).
 * Al entrar muestra el resumen General; las pestañas Equipos y Temperaturas tienen el detalle.
 */
export const GcEquiposDashboardPage: React.FC<Props> = ({ onBack }) => {
    const { setActiveSubmodule, setPageBreadcrumb } = useNavStore();
    const { hasPermission } = useAuth();
    const puedeTemp = hasPermission('GC_VERIF_TEMP');

    const [pestana, setPestana] = useState<Pestana>('general');
    const [resumen, setResumen] = useState<ResumenCalidad | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const periodoActual = hoyYmd().slice(0, 7);
    const [periodo, setPeriodo] = useState(periodoActual);
    const [periodos, setPeriodos] = useState<{ periodo: string }[]>([]);
    const [fichasTemp, setFichasTemp] = useState<VerificacionResumen[] | null>(null);
    const [puestas, setPuestas] = useState<PuestaMarcha[] | null>(null);
    const [caudal, setCaudal] = useState<VerificacionCaudal[] | null>(null);
    const [fichaAbierta, setFichaAbierta] = useState<number | null>(null);

    // Se publica apenas entra, sin esperar a que carguen los datos.
    useEffect(() => {
        setPageBreadcrumb([{ label: 'G.C. MAM', onClick: () => setActiveSubmodule('gc-hub-mam') }, { label: 'Dashboard' }]);
        return () => setPageBreadcrumb([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        equipoService.getResumenCalidad()
            .then(setResumen)
            .catch(() => setError('Error al cargar los equipos.'))
            .finally(() => setLoading(false));
        // Datos del resumen general: si alguno falla (o no hay permiso), esa sección simplemente no se muestra.
        puestaMarchaService.listar().then(setPuestas).catch(() => setPuestas(null));
        verificacionCaudalService.listar().then(setCaudal).catch(() => setCaudal(null));
        if (puedeTemp) {
            tempApi.listar({ periodo: periodoActual }).then(setFichasTemp).catch(() => setFichasTemp(null));
            tempApi.periodos().then(setPeriodos).catch(() => setPeriodos([]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const opcionesPeriodo = useMemo(() => {
        const set = new Set([periodoActual, ...periodos.map((p) => p.periodo)]);
        return [...set].sort().reverse().map((p) => ({ value: p, label: nombrePeriodo(p) }));
    }, [periodos, periodoActual]);

    const general = useMemo(() => {
        const eq = resumen?.equipos ?? [];
        const proximos = eq
            .filter((e) => e.estado_vigencia === 'por_vencer' && e.vigencia)
            .sort((a, b) => String(a.vigencia).localeCompare(String(b.vigencia)))
            .slice(0, 6);
        const temp = (fichasTemp ?? []).filter((f) => f.estado !== 'ANULADA');
        const firmadasTemp = temp.filter((f) => f.estado === 'FIRMADA').length;
        const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
        const caudalVig = (caudal ?? []).filter((c) => c.estado !== 'ANULADA');
        return {
            fueraServicio: eq.filter((e) => e.estado === 'Fuera de Servicio' && e.estado_vigencia !== 'pendiente_pm').length,
            pendientePm: eq.filter((e) => e.estado_vigencia === 'pendiente_pm').length,
            proximos,
            temp: {
                total: temp.length,
                firmadas: firmadasTemp,
                pendientes: temp.filter((f) => f.estado === 'PENDIENTE_FIRMA').length,
                borrador: temp.filter((f) => f.estado === 'BORRADOR').length,
                noCumplen: temp.filter((f) => f.cumple === 'N').length,
                avance: temp.length ? Math.round((firmadasTemp / temp.length) * 100) : 0,
            },
            pm: {
                pendientes: (puestas ?? []).filter((p) => p.estado === 'PENDIENTE_FIRMA').length,
                aprobadas30: (puestas ?? []).filter((p) => p.estado === 'APROBADA' && String(p.fecha ?? '').slice(0, 10) >= hace30).length,
            },
            caudal: {
                borrador: caudalVig.filter((c) => c.estado === 'BORRADOR').length,
                firmadas30: caudalVig.filter((c) => c.estado === 'FIRMADA' && String(c.fecha_verificacion).slice(0, 10) >= hace30).length,
                noCumplen: caudalVig.filter((c) => c.estado === 'FIRMADA' && c.cumple === false).length,
            },
        };
    }, [resumen, fichasTemp, puestas, caudal]);

    const pestanas: { k: Pestana; label: string; icon: typeof IconChartBar }[] = [
        { k: 'general', label: 'General', icon: IconLayoutDashboard },
        { k: 'equipos', label: 'Equipos', icon: IconDevices },
        ...(puedeTemp ? [{ k: 'temperaturas' as const, label: 'Temperaturas', icon: IconThermometer }] : []),
        { k: 'puesta-marcha', label: 'Puesta en Marcha', icon: IconRocket },
        { k: 'caudal', label: 'Caudal', icon: IconDroplet },
        { k: 'traspasos', label: 'Traspasos', icon: IconTransfer },
        { k: 'documentacion', label: 'Documentación', icon: IconFileDescription },
    ];

    return (
        <div className="shadcn-scope flex flex-col gap-0">
            <div className="px-4 pt-4 md:px-6 md:pt-6">
                <PageHeader
                    title="Dashboard"
                    subtitle="Indicadores de equipos, verificaciones, puestas en marcha, traspasos y documentación de G.C. MAM."
                    onBack={onBack}
                    breadcrumbItems={[{ label: 'G.C. MAM', onClick: () => setActiveSubmodule('gc-hub-mam') }, { label: 'Dashboard' }]}
                />
                <div className="mb-2 flex max-w-full overflow-x-auto rounded-lg border border-border bg-muted/40 p-1 md:w-fit" role="tablist">
                    {pestanas.map(({ k, label, icon: Icono }) => (
                        <button
                            key={k}
                            type="button"
                            role="tab"
                            aria-selected={pestana === k}
                            onClick={() => setPestana(k)}
                            className={cn('flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors', pestana === k ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                        >
                            <Icono size={15} /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="flex h-64 items-center justify-center">
                    <span className="text-sm text-muted-foreground">Cargando dashboard...</span>
                </div>
            )}
            {!loading && (error || !resumen) && (
                <div className="flex h-64 items-center justify-center">
                    <span className="text-sm text-destructive">{error || 'Error al cargar los equipos.'}</span>
                </div>
            )}

            {!loading && resumen && pestana === 'general' && (
                <div className="flex flex-col gap-6 px-4 pb-6 pt-2 md:px-6">
                    <Seccion titulo="Equipos" icono={<IconDevices size={16} />} accion={{ label: 'Ver dashboard de equipos', onClick: () => setPestana('equipos') }}>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                            <Kpi label="Total" valor={resumen.kpis.total} />
                            <Kpi label="Operativos" valor={resumen.kpis.activos} tono="text-success" />
                            <Kpi label="Por vencer" valor={resumen.kpis.porVencer} tono="text-warning" detalle="próximos 30 días" />
                            <Kpi label="Vencidos" valor={resumen.kpis.vencidos} tono="text-destructive" />
                            <Kpi label="Pendientes de PM" valor={general.pendientePm} tono="text-warning" detalle="equipos nuevos" />
                            <Kpi label="Fuera de servicio" valor={general.fueraServicio} tono="text-destructive" />
                        </div>
                    </Seccion>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {puedeTemp && fichasTemp && (
                            <Seccion titulo={`Verificación de temperatura · ${nombrePeriodo(periodoActual)}`} icono={<IconThermometer size={16} />} accion={{ label: 'Ver estadística', onClick: () => setPestana('temperaturas') }}>
                                <div className="rounded-xl border border-border bg-card px-4 py-3">
                                    <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                                        <span>Avance del periodo</span>
                                        <span className="tabular-nums">{general.temp.firmadas} de {general.temp.total} firmadas · {general.temp.avance}%</span>
                                    </div>
                                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                                        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${general.temp.avance}%` }} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <Kpi label="En borrador" valor={general.temp.borrador} tono="text-muted-foreground" />
                                    <Kpi label="Pendientes de firma" valor={general.temp.pendientes} tono="text-warning" />
                                    <Kpi label="No cumplen" valor={general.temp.noCumplen} tono="text-destructive" />
                                </div>
                            </Seccion>
                        )}

                        {(puestas || caudal) && (
                            <Seccion titulo="Puesta en marcha y caudal" icono={<IconChartBar size={16} />} accion={{ label: 'Ver puestas en marcha', onClick: () => setPestana('puesta-marcha') }}>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {puestas && <Kpi label="PM pendientes de firma" valor={general.pm.pendientes} tono="text-warning" onClick={() => setActiveSubmodule('gc-puesta-marcha')} />}
                                    {puestas && <Kpi label="PM aprobadas" valor={general.pm.aprobadas30} tono="text-success" detalle="con fecha en los últimos 30 días" onClick={() => setActiveSubmodule('gc-puesta-marcha')} />}
                                    {caudal && <Kpi label="Caudal en borrador" valor={general.caudal.borrador} tono="text-muted-foreground" onClick={() => setActiveSubmodule('gc-verificacion-caudal')} />}
                                    {caudal && <Kpi label="Caudal firmadas" valor={general.caudal.firmadas30} tono="text-success" detalle="últimos 30 días" onClick={() => setActiveSubmodule('gc-verificacion-caudal')} />}
                                    {caudal && <Kpi label="Caudal no cumple" valor={general.caudal.noCumplen} tono="text-destructive" onClick={() => setActiveSubmodule('gc-verificacion-caudal')} />}
                                </div>
                            </Seccion>
                        )}
                    </div>

                    <Seccion titulo="Próximos vencimientos" icono={<IconChartBar size={16} />} accion={{ label: 'Ver inventario', onClick: () => setActiveSubmodule('admin-equipos-gestion') }}>
                        {general.proximos.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No hay equipos por vencer en los próximos 30 días.</p>
                        ) : (
                            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                                {general.proximos.map((e) => (
                                    <div key={e.id_equipo} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold">{e.codigo}</p>
                                            <p className="truncate text-xs text-muted-foreground">{e.nombre}</p>
                                        </div>
                                        <span className="shrink-0 tabular-nums text-warning">{formatearFecha(e.vigencia)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Seccion>
                </div>
            )}

            {!loading && resumen && pestana === 'equipos' && (
                <EquiposDashboard
                    onKpiClick={(filtro) => { useNavStore.getState().setEquiposKpiPendiente(filtro); setActiveSubmodule('admin-equipos-gestion'); }}
                    equipos={resumen.equipos}
                    expiringCount={resumen.kpis.porVencer}
                    expiredCount={resumen.kpis.vencidos}
                    activeCount={resumen.kpis.activos}
                    inactiveSamplerCount={resumen.kpis.sinAsignar}
                />
            )}

            {!loading && pestana === 'puesta-marcha' && <DashboardPuestaMarcha onIr={() => setActiveSubmodule('gc-puesta-marcha')} />}
            {!loading && pestana === 'caudal' && <DashboardCaudal onIr={() => setActiveSubmodule('gc-verificacion-caudal')} />}
            {!loading && pestana === 'traspasos' && <DashboardTraspasos onIr={() => setActiveSubmodule('gc-archivo-fichas')} />}
            {!loading && resumen && pestana === 'documentacion' && (
                <DashboardDocumentacion equipos={resumen.equipos} onIrArchivo={() => setActiveSubmodule('gc-archivo-fichas')} onIrRevision={() => setActiveSubmodule('gc-revision-documental')} />
            )}

            {!loading && puedeTemp && pestana === 'temperaturas' && (
                <div className="px-4 pb-6 pt-2 md:px-6">
                    <div className="mb-4 w-full sm:w-52">
                        <p className="mb-1 text-xs text-muted-foreground">Periodo (campaña)</p>
                        <Combobox value={periodo} onValueChange={setPeriodo} options={opcionesPeriodo} placeholder="Periodo" />
                    </div>
                    <ResumenVerificacionTemp periodo={periodo} onAbrirFicha={setFichaAbierta} />
                    <VerificacionTempEditor idVerificacion={fichaAbierta} onClose={() => setFichaAbierta(null)} onChanged={() => undefined} />
                </div>
            )}
        </div>
    );
};
