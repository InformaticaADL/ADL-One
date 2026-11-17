import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    IconTicket, IconArrowRight, IconPlus, IconTable, IconMapPin, IconCalendar, IconChartBar, IconHistory,
    IconRotate, IconChecklist, IconClockPlay, IconCalendarEvent, IconAlertTriangle, IconBell,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNavStore } from '../store/navStore';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationStore } from '../store/notificationStore';
import { fichaService } from '../features/medio-ambiente/services/ficha.service';
import fondoLogin from '../assets/images/fondo-login.png';

interface FilaVisita { id: number; puntos: number; centro: string; empresa: string; programa: string; desde: string; dias: number; motivo?: string | null }
interface Lista { total: number; diasMasAntigua: number | null; filas: FilaVisita[] }
interface Resumen {
    comercial?: { rechazadas: Lista; enValidacion: Lista; creadasHoy: number };
    tecnica?: Lista;
    coordinacion?: Lista;
    programar?: Lista;
    operacion?: { visitasHoy: number; visitasHoyRealizadas: number; noRealizadas: number };
}

const saludo = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
};
const primerNombre = (n?: string) => (n || '').trim().split(/\s+/)[0] || '';

/** Tarjeta de «lo que te toca»: cuántas visitas esperan, la más antigua y las primeras de la fila (clic = abrir). */
function Pendientes({ titulo, ayuda, icono, color, lista, vacio, onAbrir, onVerTodas, textoTodas }: {
    titulo: string; ayuda: string; icono: React.ReactNode; color: string; lista?: Lista; vacio: string;
    onAbrir: (id: number) => void; onVerTodas: () => void; textoTodas: string;
}) {
    const total = lista?.total ?? 0;
    return (
        <Card className="flex flex-col rounded-xl p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <span className="flex items-center gap-2 text-sm font-semibold" style={{ color }}>{icono}{titulo}</span>
                    <span className="text-xs text-muted-foreground">{ayuda}</span>
                </div>
                <div className="text-right">
                    <span className="block text-3xl font-extrabold leading-none tracking-tight">{total}</span>
                    <span className="text-[11px] text-muted-foreground">{total === 1 ? 'visita' : 'visitas'}</span>
                </div>
            </div>
            {total === 0 ? (
                <p className="m-0 rounded-md bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">{vacio}</p>
            ) : (
                <>
                    {lista?.diasMasAntigua != null && lista.diasMasAntigua > 0 && (
                        <p className="mb-2 mt-0 text-xs text-muted-foreground">La más antigua espera hace <strong className="text-foreground">{lista.diasMasAntigua} {lista.diasMasAntigua === 1 ? 'día' : 'días'}</strong>.</p>
                    )}
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                        {lista!.filas.map((f) => (
                            <li key={f.id}>
                                <button type="button" onClick={() => onAbrir(f.id)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5">
                                    <span className="min-w-0">
                                        <span className="block truncate text-[13px] font-semibold">{f.centro || 'Sin centro'}{f.puntos > 1 ? ` · ${f.puntos} puntos` : ''}</span>
                                        <span className="block truncate text-xs text-muted-foreground">{[f.empresa, f.programa].filter(Boolean).join(' · ')}</span>
                                        {f.motivo && <span className="mt-0.5 block truncate text-xs italic text-destructive" title={f.motivo}>«{f.motivo}»</span>}
                                    </span>
                                    <span className="shrink-0 text-xs text-muted-foreground">{f.dias > 0 ? `${f.dias} d` : 'hoy'}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                    {total > lista!.filas.length && <p className="mb-0 mt-2 text-xs text-muted-foreground">y {total - lista!.filas.length} más.</p>}
                    <button type="button" onClick={onVerTodas} className="mt-3 flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline">
                        {textoTodas} <IconArrowRight size={12} />
                    </button>
                </>
            )}
        </Card>
    );
}

export const WelcomePage: React.FC = () => {
    const nav = useNavStore();
    const { user, hasPermission } = useAuth();
    const notificaciones = useNotificationStore((s) => s.notifications);
    const [resumen, setResumen] = useState<Resumen | null>(null);
    const [cargando, setCargando] = useState(true);

    const cargar = useCallback(async () => {
        try {
            setResumen(await fichaService.getResumenInicio());
        } catch {
            setResumen({});
        } finally {
            setCargando(false);
        }
    }, []);
    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => { const t = setInterval(cargar, 120000); return () => clearInterval(t); }, [cargar]);

    // Ir a una pantalla de Fichas de Ingreso, o abrir una ficha concreta
    const irAFichas = (modo: Parameters<typeof nav.setFichasMode>[0], fichaId?: number) => {
        nav.setActiveModule('medio_ambiente');
        nav.setActiveSubmodule('ma-fichas-ingreso');
        if (fichaId) nav.setSelectedFicha(fichaId, null);
        nav.setFichasMode(modo);
    };
    const abrirFicha = (id: number) => irAFichas('detail_ficha', id);

    const areas = useMemo(() => [
        hasPermission('FI_CREAR') && 'Comercial',
        hasPermission(['FI_APROBAR_TEC', 'FI_RECHAZAR_TEC']) && 'Técnica',
        hasPermission(['FI_APROBAR_COO', 'FI_RECHAZAR_COO']) && 'Coordinación',
        hasPermission('FI_ASIG_GRUPO') && 'Asignación',
    ].filter(Boolean) as string[], [hasPermission]);

    const accesos = [
        { permiso: 'FI_CREAR', titulo: 'Nueva ficha', detalle: 'Crear una ficha o una visita', icono: <IconPlus size={20} />, ir: () => irAFichas('create_choice') },
        { permiso: ['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR'], titulo: 'Explorador', detalle: 'Buscar, validar y editar fichas', icono: <IconTable size={20} />, ir: () => irAFichas('list_fichas') },
        { permiso: 'FI_ASIG_GRUPO', titulo: 'Asignación', detalle: 'Agendar visitas y muestreadores', icono: <IconMapPin size={20} />, ir: () => irAFichas('list_assign') },
        { permiso: 'MA_CALENDARIO_ACCESO', titulo: 'Calendario', detalle: 'La programación en terreno', icono: <IconCalendar size={20} />, ir: () => irAFichas('calendar') },
        { permiso: 'MA_COORDINACION_ACCESO', titulo: 'Dashboard', detalle: 'La operación en visitas', icono: <IconChartBar size={20} />, ir: () => irAFichas('dashboard') },
        { permiso: ['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC'], titulo: 'Completados', detalle: 'Muestreos ejecutados y reportes', icono: <IconHistory size={20} />, ir: () => irAFichas('list_ejecutados') },
    ].filter((a) => hasPermission(a.permiso as any));

    const op = resumen?.operacion;
    const sinNada = !cargando && resumen && !resumen.comercial && !resumen.tecnica && !resumen.coordinacion && !resumen.programar && !resumen.operacion;
    const novedades = [...notificaciones].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))).slice(0, 5);
    const fecha = new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="shadcn-scope flex w-full max-w-full flex-col">
            {/* Cabecera */}
            <div
                className="relative flex min-h-[190px] items-end overflow-hidden"
                style={{ backgroundImage: `url(${fondoLogin})`, backgroundSize: 'cover', backgroundPosition: 'center 40%' }}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/45 to-black/70" />
                <div className="relative z-10 flex w-full flex-col gap-2 px-6 pb-6 pt-10 md:px-10">
                    <p className="m-0 text-[12px] font-bold uppercase tracking-widest text-white/70">ADL Diagnostic · Sistema interno</p>
                    <h1 className="m-0 text-3xl font-black leading-tight tracking-tight text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.6)] md:text-4xl">
                        {saludo()}{primerNombre(user?.name) ? `, ${primerNombre(user?.name)}` : ''}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm capitalize text-white/80">{fecha}</span>
                        {areas.map((a) => <Badge key={a} variant="secondary" className="bg-white/15 text-white hover:bg-white/15">{a}</Badge>)}
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-8 px-6 py-8 md:px-10">
                {/* La operación de hoy */}
                {op && (
                    <section>
                        <h2 className="mb-3 mt-0 text-lg font-bold tracking-tight">La operación de hoy</h2>
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                            <button type="button" onClick={() => irAFichas('calendar')} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5">
                                <span className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><IconCalendarEvent size={15} />Visitas hoy</span>
                                <span className="text-3xl font-extrabold leading-none tracking-tight">{op.visitasHoy}</span>
                                <span className="text-xs text-muted-foreground">{op.visitasHoy ? `${op.visitasHoyRealizadas} realizadas · ${op.visitasHoy - op.visitasHoyRealizadas} por hacer` : 'Sin visitas agendadas'}</span>
                            </button>
                            <button type="button" onClick={() => irAFichas('dashboard')} className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5">
                                <span className="flex items-center gap-2 text-xs font-semibold" style={op.noRealizadas ? { color: 'var(--sc-destructive)' } : undefined}><IconAlertTriangle size={15} />Visitas no realizadas</span>
                                <span className="text-3xl font-extrabold leading-none tracking-tight">{op.noRealizadas}</span>
                                <span className="text-xs text-muted-foreground">{op.noRealizadas ? 'Pasaron de fecha sin ejecutarse' : 'Todo al día'}</span>
                            </button>
                        </div>
                    </section>
                )}

                {/* Lo que te toca */}
                {(resumen?.comercial || resumen?.tecnica || resumen?.coordinacion || resumen?.programar) && (
                    <section>
                        <h2 className="mb-3 mt-0 text-lg font-bold tracking-tight">Requiere tu atención</h2>
                        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
                            {resumen?.comercial && (
                                <Pendientes
                                    titulo="Tus fichas por corregir" ayuda="Rechazadas por Técnica o Coordinación" color="var(--sc-destructive)" icono={<IconRotate size={16} />}
                                    lista={resumen.comercial.rechazadas} vacio="No tienes fichas por corregir." onAbrir={abrirFicha}
                                    onVerTodas={() => irAFichas('list_fichas')} textoTodas="Ver en el explorador"
                                />
                            )}
                            {resumen?.tecnica && (
                                <Pendientes
                                    titulo="Por validar · Técnica" ayuda="Esperan al Área Técnica" color="var(--sc-primary)" icono={<IconChecklist size={16} />}
                                    lista={resumen.tecnica} vacio="No hay visitas esperando validación técnica." onAbrir={abrirFicha}
                                    onVerTodas={() => irAFichas('list_fichas')} textoTodas="Ver en el explorador"
                                />
                            )}
                            {resumen?.coordinacion && (
                                <Pendientes
                                    titulo="Por validar · Coordinación" ayuda="Aprobadas por Técnica" color="var(--sc-accent-foreground)" icono={<IconChecklist size={16} />}
                                    lista={resumen.coordinacion} vacio="No hay visitas esperando a Coordinación." onAbrir={abrirFicha}
                                    onVerTodas={() => irAFichas('list_fichas')} textoTodas="Ver en el explorador"
                                />
                            )}
                            {resumen?.programar && (
                                <Pendientes
                                    titulo="Por programar" ayuda="Aprobadas, sin fecha ni muestreador" color="var(--sc-warning)" icono={<IconClockPlay size={16} />}
                                    lista={resumen.programar} vacio="No hay visitas por programar." onAbrir={abrirFicha}
                                    onVerTodas={() => irAFichas('list_assign')} textoTodas="Ir a Asignación"
                                />
                            )}
                        </div>
                        {resumen?.comercial && (resumen.comercial.enValidacion.total > 0 || resumen.comercial.creadasHoy > 0) && (
                            <p className="mb-0 mt-3 text-sm text-muted-foreground">
                                {resumen.comercial.enValidacion.total > 0 && <>Tienes <strong className="text-foreground">{resumen.comercial.enValidacion.total}</strong> {resumen.comercial.enValidacion.total === 1 ? 'visita' : 'visitas'} en validación. </>}
                                {resumen.comercial.creadasHoy > 0 && <>Hoy has creado <strong className="text-foreground">{resumen.comercial.creadasHoy}</strong> {resumen.comercial.creadasHoy === 1 ? 'ficha' : 'fichas'}.</>}
                            </p>
                        )}
                    </section>
                )}

                {sinNada && (
                    <p className="m-0 rounded-lg bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                        No tienes tareas pendientes en Fichas de Ingreso. Usa el menú de la izquierda para ir a tu módulo.
                    </p>
                )}

                {/* Accesos rápidos */}
                {accesos.length > 0 && (
                    <section>
                        <h2 className="mb-3 mt-0 text-lg font-bold tracking-tight">Accesos rápidos</h2>
                        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
                            {accesos.map((a) => (
                                <button key={a.titulo} type="button" onClick={a.ir} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5">
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{a.icono}</span>
                                    <span><span className="block text-sm font-semibold">{a.titulo}</span><span className="block text-xs text-muted-foreground">{a.detalle}</span></span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                <div className={cn('grid gap-4', novedades.length > 0 && 'lg:grid-cols-2')}>
                    {/* Mesa de ayuda */}
                    <Card className="flex flex-col gap-3 rounded-xl p-5">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><IconTicket size={22} /></span>
                            <div>
                                <h3 className="m-0 text-base font-bold">Solicitudes ADL</h3>
                                <p className="m-0 text-xs text-muted-foreground">Pide ayuda o un cambio a Informática y a otras áreas.</p>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button onClick={() => { nav.setActiveModule('solicitudes'); nav.setActiveSubmodule('urs-new-request'); }} className="gap-2"><IconTicket size={16} />Realizar solicitud</Button>
                            <button type="button" onClick={() => { nav.setActiveModule('solicitudes'); nav.setActiveSubmodule(''); }} className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary">
                                Ver todas mis solicitudes <IconArrowRight size={12} />
                            </button>
                        </div>
                    </Card>

                    {/* Novedades */}
                    {novedades.length > 0 && (
                        <Card className="rounded-xl p-5">
                            <h3 className="mb-3 mt-0 flex items-center gap-2 text-base font-bold"><IconBell size={18} />Novedades</h3>
                            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                                {novedades.map((n) => (
                                    <li key={n.id_notificacion} className="flex items-start gap-2.5 text-[13px]">
                                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.leido ? 'bg-muted-foreground/30' : 'bg-primary')} />
                                        <span className="min-w-0">
                                            <span className={cn('block truncate', !n.leido && 'font-semibold')}>{n.titulo}</span>
                                            <span className="block truncate text-xs text-muted-foreground">{n.mensaje}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
};
