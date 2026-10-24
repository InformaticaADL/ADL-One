import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { IconSearch, IconMessageCircle, IconSend, IconArrowLeft, IconFileText, IconFilterOff } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { esNotificacionSolicitudCliente } from '../../notifications/utils/notificationNavigation';
import {
    solicitudesClientesService,
    type EstadoSolicitudCliente,
    type SolicitudClienteResumen,
    type SolicitudClienteDetalle,
} from '../../../services/solicitudesClientes.service';

interface Props {
    onBack: () => void;
}

const ESTADO_LABEL: Record<string, string> = {
    recibida: 'Recibida',
    en_revision: 'En revisión',
    respondida: 'Respondida',
    cerrada: 'Cerrada',
};
const ESTADO_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'destructive'> = {
    recibida: 'default',
    en_revision: 'default',
    respondida: 'success',
    cerrada: 'outline',
};
const ESTADOS: EstadoSolicitudCliente[] = ['recibida', 'en_revision', 'respondida', 'cerrada'];
const AREA_LABEL: Record<string, string> = { LAB: 'Laboratorio', MAM: 'Medio Ambiente' };
// Mismas transiciones que valida WebClientesV2 (ver TRANSICIONES en solicitudesRoutes.js) —
// solo para no ofrecer botones que el backend de todos modos rechazaría.
const TRANSICIONES: Record<string, EstadoSolicitudCliente[]> = {
    recibida: ['en_revision', 'cerrada'],
    en_revision: ['respondida', 'cerrada'],
    respondida: ['en_revision', 'cerrada'],
    cerrada: ['en_revision'],
};

// La lista se refresca sola; el detalle abierto más seguido, para que la conversación se sienta en vivo.
const REFRESCO_LISTA_MS = 15000;
const REFRESCO_DETALLE_MS = 5000;

const requiereAtencion = (s: SolicitudClienteResumen) => Number(s.requiere_atencion) === 1;

const iniciales = (nombre?: string | null) =>
    (nombre || '?').split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?';

const fechaCorta = (iso: string) => {
    const f = new Date(iso);
    const hoy = new Date();
    const mismoDia = f.toDateString() === hoy.toDateString();
    return mismoDia
        ? f.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
        : f.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
};

const claseSelect =
    'h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30';

export const SolicitudesClientesPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const { pendingSolicitudClienteId, setPendingSolicitudClienteId, setSolicitudesClientePendientes } = useNavStore();
    const notifications = useNotificationStore((s) => s.notifications);
    const markAsRead = useNotificationStore((s) => s.markAsRead);

    const [solicitudes, setSolicitudes] = useState<SolicitudClienteResumen[]>([]);
    const [loading, setLoading] = useState(true);

    // Filtros
    const [busqueda, setBusqueda] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState<'todas' | EstadoSolicitudCliente>('todas');
    const [empresaFiltro, setEmpresaFiltro] = useState('todas');
    const [casoFiltro, setCasoFiltro] = useState('todos');
    const [areaFiltro, setAreaFiltro] = useState('todas');
    const [soloSinTomar, setSoloSinTomar] = useState(false);
    const [soloPorAtender, setSoloPorAtender] = useState(false);

    // Detalle
    const [seleccionada, setSeleccionada] = useState<number | null>(null);
    const [detalle, setDetalle] = useState<SolicitudClienteDetalle | null>(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [respuesta, setRespuesta] = useState('');
    const [enviando, setEnviando] = useState(false);
    const finChatRef = useRef<HTMLDivElement>(null);
    const mensajesPrevios = useRef(0);

    // ---- Datos -----------------------------------------------------------

    const cargarLista = useCallback(async (silencioso = false) => {
        try {
            if (!silencioso) setLoading(true);
            const filas = await solicitudesClientesService.listar();
            // Un cliente vinculado a más de una empresa puede repetir la fila: se deja una por solicitud.
            const unicas = new Map<number, SolicitudClienteResumen>();
            filas.forEach((f) => { if (!unicas.has(f.id)) unicas.set(f.id, f); });
            setSolicitudes([...unicas.values()]);
            // El contador de la barra lateral se alinea al instante con lo que muestra la lista.
            setSolicitudesClientePendientes([...unicas.values()].filter(requiereAtencion).length);
        } catch {
            if (!silencioso) showToast({ type: 'error', message: 'Error al cargar las solicitudes' });
        } finally {
            if (!silencioso) setLoading(false);
        }
    }, [showToast, setSolicitudesClientePendientes]);

    const cargarDetalle = useCallback(async (id: number, silencioso = false) => {
        try {
            if (!silencioso) setLoadingDetalle(true);
            const d = await solicitudesClientesService.detalle(id);
            setDetalle((previo) => (previo && previo.id === id && silencioso &&
                previo.mensajes.length === d.mensajes.length && previo.estado === d.estado &&
                previo.responsable_nombre === d.responsable_nombre) ? previo : d);
        } catch {
            if (!silencioso) {
                showToast({ type: 'error', message: 'Error al cargar la solicitud' });
                setSeleccionada(null);
            }
        } finally {
            if (!silencioso) setLoadingDetalle(false);
        }
    }, [showToast]);

    const abrir = useCallback((id: number) => {
        // Sus avisos de la campana quedan leídos (solo los de solicitudes de clientes: el id_referencia puede
        // coincidir con el de una solicitud interna).
        notifications
            .filter((n) => !n.leido && n.id_referencia === id && esNotificacionSolicitudCliente(n))
            .forEach((n) => { void markAsRead(n.id_notificacion); });
        mensajesPrevios.current = 0;
        setRespuesta('');
        setSeleccionada(id);
        void cargarDetalle(id);
    }, [notifications, markAsRead, cargarDetalle]);

    useEffect(() => { void cargarLista(); }, [cargarLista]);

    // Llegada desde una notificación de la campana: abre directamente esa solicitud.
    useEffect(() => {
        if (!pendingSolicitudClienteId) return;
        const id = pendingSolicitudClienteId;
        setPendingSolicitudClienteId(null);
        abrir(id);
    }, [pendingSolicitudClienteId, setPendingSolicitudClienteId, abrir]);

    // En vivo: refresco periódico (solo con la pestaña visible)...
    useEffect(() => {
        const t = setInterval(() => { if (!document.hidden) void cargarLista(true); }, REFRESCO_LISTA_MS);
        return () => clearInterval(t);
    }, [cargarLista]);
    useEffect(() => {
        if (!seleccionada) return;
        const t = setInterval(() => { if (!document.hidden) void cargarDetalle(seleccionada, true); }, REFRESCO_DETALLE_MS);
        return () => clearInterval(t);
    }, [seleccionada, cargarDetalle]);

    // ...y apenas llega un aviso nuevo de una solicitud (el socket lo empuja al instante).
    const firmaAvisos = notifications
        .filter((n) => esNotificacionSolicitudCliente(n)).map((n) => n.id_notificacion).join(',');
    const primeraFirma = useRef(true);
    useEffect(() => {
        if (primeraFirma.current) { primeraFirma.current = false; return; }
        void cargarLista(true);
        if (seleccionada) void cargarDetalle(seleccionada, true);
    }, [firmaAvisos]); // eslint-disable-line react-hooks/exhaustive-deps

    // La conversación baja sola al último mensaje cuando llega uno nuevo.
    useEffect(() => {
        const total = detalle?.mensajes.length || 0;
        if (total !== mensajesPrevios.current) {
            mensajesPrevios.current = total;
            finChatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }, [detalle]);

    // ---- Filtros ---------------------------------------------------------

    const empresas = useMemo(
        () => [...new Set(solicitudes.map((s) => s.cliente_nombre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
        [solicitudes]);
    const areas = useMemo(() => [...new Set(solicitudes.map((s) => s.area))], [solicitudes]);
    const codigosDeCasos = (s: SolicitudClienteResumen) => (s.casos || '').split(',').map((c) => c.trim()).filter(Boolean);
    // Los casos que se ofrecen salen de las solicitudes que quedan con el filtro de empresa elegido.
    const casos = useMemo(
        () => [...new Set(solicitudes
            .filter((s) => empresaFiltro === 'todas' || s.cliente_nombre === empresaFiltro)
            .flatMap((s) => (s.casos || '').split(',').map((c) => c.trim()).filter(Boolean)))]
            .sort((a, b) => b.localeCompare(a, 'es', { numeric: true })),
        [solicitudes, empresaFiltro]);

    const sinEstado = useMemo(() => {
        const term = busqueda.trim().toLowerCase();
        return solicitudes.filter((s) => {
            if (empresaFiltro !== 'todas' && s.cliente_nombre !== empresaFiltro) return false;
            if (areaFiltro !== 'todas' && s.area !== areaFiltro) return false;
            if (casoFiltro !== 'todos' && !codigosDeCasos(s).includes(casoFiltro)) return false;
            if (soloSinTomar && s.responsable_nombre) return false;
            if (soloPorAtender && !requiereAtencion(s)) return false;
            if (!term) return true;
            return [s.asunto, s.cliente_nombre, s.solicitante_nombre, s.solicitante_email, s.casos, `#${s.id}`]
                .some((v) => (v || '').toLowerCase().includes(term));
        });
    }, [solicitudes, busqueda, empresaFiltro, casoFiltro, areaFiltro, soloSinTomar, soloPorAtender]);

    const conteoEstado = useMemo(() => {
        const c: Record<string, number> = { todas: sinEstado.length };
        ESTADOS.forEach((e) => { c[e] = sinEstado.filter((s) => s.estado === e).length; });
        return c;
    }, [sinEstado]);

    const filtradas = useMemo(
        () => sinEstado
            .filter((s) => estadoFiltro === 'todas' || s.estado === estadoFiltro)
            .sort((a, b) => new Date(b.actualizada_en).getTime() - new Date(a.actualizada_en).getTime()),
        [sinEstado, estadoFiltro]);

    const hayFiltros = !!busqueda.trim() || estadoFiltro !== 'todas' || empresaFiltro !== 'todas' || casoFiltro !== 'todos' || areaFiltro !== 'todas' || soloSinTomar || soloPorAtender;
    const limpiarFiltros = () => {
        setBusqueda(''); setEstadoFiltro('todas'); setEmpresaFiltro('todas'); setCasoFiltro('todos'); setAreaFiltro('todas'); setSoloSinTomar(false); setSoloPorAtender(false);
    };

    const totalPorAtender = useMemo(() => solicitudes.filter(requiereAtencion).length, [solicitudes]);

    const resumenSeleccionada = solicitudes.find((s) => s.id === seleccionada) || null;

    // ---- Acciones --------------------------------------------------------

    const handleTomar = async (id: number) => {
        try {
            await solicitudesClientesService.tomar(id);
            showToast({ type: 'success', message: 'Solicitud tomada' });
            await cargarDetalle(id, true);
            void cargarLista(true);
        } catch {
            showToast({ type: 'error', message: 'Error al tomar la solicitud' });
        }
    };

    const handleResponder = async () => {
        if (!detalle || !respuesta.trim()) return;
        try {
            setEnviando(true);
            await solicitudesClientesService.responder(detalle.id, respuesta.trim());
            setRespuesta('');
            await cargarDetalle(detalle.id, true);
            void cargarLista(true);
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al enviar la respuesta' });
        } finally {
            setEnviando(false);
        }
    };

    const handleCambiarEstado = async (estado: EstadoSolicitudCliente) => {
        if (!detalle) return;
        try {
            await solicitudesClientesService.cambiarEstado(detalle.id, estado);
            showToast({ type: 'success', message: `Estado cambiado a ${ESTADO_LABEL[estado]}` });
            await cargarDetalle(detalle.id, true);
            void cargarLista(true);
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al cambiar el estado' });
        }
    };

    // ---- Vista: lista ----------------------------------------------------

    const panelLista = (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex flex-col gap-2 border-b border-border p-3">
                <div className="relative">
                    <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por asunto, cliente o correo..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="pl-8"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Combobox
                        value={empresaFiltro}
                        onValueChange={(v) => { setEmpresaFiltro(v); setCasoFiltro('todos'); }}
                        placeholder="Todas las empresas"
                        searchPlaceholder="Buscar empresa..."
                        options={[{ value: 'todas', label: 'Todas las empresas' }, ...empresas.map((e) => ({ value: e, label: e }))]}
                    />
                    <Combobox
                        value={casoFiltro}
                        onValueChange={setCasoFiltro}
                        placeholder="Todos los casos"
                        searchPlaceholder="Buscar caso (OI)..."
                        emptyText="Sin casos."
                        options={[{ value: 'todos', label: 'Todos los casos' }, ...casos.map((c) => ({ value: c, label: c }))]}
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {areas.length > 1 && (
                        <select className={claseSelect} value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)}>
                            <option value="todas">Todas las áreas</option>
                            {areas.map((a) => <option key={a} value={a}>{AREA_LABEL[a] || a}</option>)}
                        </select>
                    )}
                    <Button
                        type="button"
                        size="sm"
                        variant={soloPorAtender ? 'default' : 'outline'}
                        onClick={() => setSoloPorAtender((v) => !v)}
                    >
                        Por atender ({totalPorAtender})
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant={soloSinTomar ? 'default' : 'outline'}
                        onClick={() => setSoloSinTomar((v) => !v)}
                    >
                        Sin tomar
                    </Button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {(['todas', ...ESTADOS] as const).map((e) => (
                        <button
                            key={e}
                            type="button"
                            onClick={() => setEstadoFiltro(e)}
                            className={cn(
                                'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                                estadoFiltro === e
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-border bg-background text-muted-foreground hover:bg-muted',
                            )}
                        >
                            {e === 'todas' ? 'Todas' : ESTADO_LABEL[e]} <span className="opacity-70">{conteoEstado[e] ?? 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="relative min-h-0 flex-1 overflow-y-auto">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                )}
                {filtradas.length === 0 && !loading ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
                        <IconMessageCircle size={40} className="text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                            {hayFiltros ? 'Ninguna solicitud coincide con los filtros' : 'No tienes solicitudes pendientes'}
                        </p>
                        {hayFiltros && (
                            <Button variant="ghost" size="sm" onClick={limpiarFiltros}>
                                <IconFilterOff size={14} /> Limpiar filtros
                            </Button>
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-border">
                        {filtradas.map((s) => {
                            const activa = s.id === seleccionada;
                            const nueva = requiereAtencion(s);
                            return (
                                <li key={s.id}>
                                    <button
                                        type="button"
                                        onClick={() => abrir(s.id)}
                                        className={cn(
                                            'flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60',
                                            activa && 'bg-primary/10',
                                        )}
                                    >
                                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                                            {iniciales(s.solicitante_nombre)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={cn('truncate text-sm', nueva ? 'font-bold text-foreground' : 'font-medium text-foreground')}>
                                                    {s.solicitante_nombre || s.cliente_nombre}
                                                </p>
                                                <span className="shrink-0 text-[11px] text-muted-foreground">{fechaCorta(s.actualizada_en)}</span>
                                            </div>
                                            <p className={cn('truncate text-sm', nueva ? 'font-semibold text-foreground' : 'text-foreground/80')}>{s.asunto}</p>
                                            <p className="truncate text-xs text-muted-foreground">{s.cliente_nombre}{s.casos ? ` · ${s.casos.split(',').join(', ')}` : ''}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <Badge variant={ESTADO_VARIANT[s.estado]}>{ESTADO_LABEL[s.estado]}</Badge>
                                                <Badge variant="outline">{AREA_LABEL[s.area] || s.area}</Badge>
                                                {!s.responsable_nombre && <span className="text-[11px] text-muted-foreground">Sin tomar</span>}
                                                {nueva && <span className="ml-auto h-2 w-2 rounded-full bg-primary" title="Por atender" />}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );

    // ---- Vista: detalle --------------------------------------------------

    const panelDetalle = (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
            {!seleccionada ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                    <IconMessageCircle size={44} className="text-muted-foreground/40" />
                    <p className="text-sm font-medium text-muted-foreground">Selecciona una solicitud para ver la conversación</p>
                </div>
            ) : loadingDetalle || !detalle ? (
                <div className="flex flex-1 items-center justify-center p-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-2 border-b border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                {isMobile && (
                                    <button type="button" onClick={() => { setSeleccionada(null); setDetalle(null); }}
                                        className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                                        <IconArrowLeft size={14} /> Volver a la lista
                                    </button>
                                )}
                                <h2 className="truncate text-base font-semibold text-foreground">{detalle.asunto}</h2>
                                <p className="text-sm text-muted-foreground">
                                    {detalle.solicitante_nombre || 'Cliente'}
                                    {detalle.solicitante_email && (
                                        <> · <a className="text-primary hover:underline" href={`mailto:${detalle.solicitante_email}`}>{detalle.solicitante_email}</a></>
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {detalle.cliente_nombre} · #{detalle.id} · {new Date(detalle.creada_en).toLocaleString('es-CL')}
                                </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                                <Badge variant={ESTADO_VARIANT[detalle.estado]}>{ESTADO_LABEL[detalle.estado]}</Badge>
                                {resumenSeleccionada && <Badge variant="outline">{AREA_LABEL[resumenSeleccionada.area] || resumenSeleccionada.area}</Badge>}
                            </div>
                        </div>

                        {detalle.referencias.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {detalle.referencias.map((r) => (
                                    <span key={r.id} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs text-foreground">
                                        <IconFileText size={12} className="text-muted-foreground" />
                                        {r.caso_codigo ? `Caso ${r.caso_codigo}` : (r.documento_nombre_original || r.documento_nombre || 'Archivo')}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-2">
                            {!detalle.responsable_nombre && (
                                <Button size="sm" onClick={() => handleTomar(detalle.id)}>Tomar</Button>
                            )}
                            {detalle.responsable_nombre && (
                                <span className="text-xs text-muted-foreground">Atiende: {detalle.responsable_nombre}</span>
                            )}
                            {(TRANSICIONES[detalle.estado] || []).map((estado) => (
                                <Button key={estado} variant="outline" size="sm" onClick={() => handleCambiarEstado(estado)}>
                                    Pasar a {ESTADO_LABEL[estado]}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 p-4">
                        {detalle.mensajes.length === 0 ? (
                            <p className="py-6 text-center text-sm text-muted-foreground">Sin mensajes todavía.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {detalle.mensajes.map((m) => (
                                    <div
                                        key={m.id}
                                        className={cn(
                                            'max-w-[80%] rounded-xl p-3',
                                            m.es_adl ? 'ml-auto bg-primary/10' : 'bg-card border border-border',
                                        )}
                                    >
                                        <p className="mb-1 text-xs font-semibold text-muted-foreground">
                                            {m.es_adl ? `${m.autor_externo || m.autor_nombre} · ADL` : m.autor_nombre}
                                        </p>
                                        <p className="whitespace-pre-wrap text-sm text-foreground">{m.texto}</p>
                                        <p className="mt-1 text-[11px] text-muted-foreground">{new Date(m.creado_en).toLocaleString('es-CL')}</p>
                                    </div>
                                ))}
                                <div ref={finChatRef} />
                            </div>
                        )}
                    </div>

                    {detalle.estado !== 'cerrada' ? (
                        <div className="flex flex-col gap-2 border-t border-border p-3">
                            <Textarea
                                placeholder="Escribe tu respuesta..."
                                value={respuesta}
                                onChange={(e) => setRespuesta(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void handleResponder(); } }}
                                rows={3}
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground">Ctrl + Enter para enviar</span>
                                <Button onClick={handleResponder} disabled={enviando || !respuesta.trim()}>
                                    <IconSend size={15} /> {enviando ? 'Enviando...' : 'Responder'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <p className="border-t border-border p-3 text-center text-xs text-muted-foreground">
                            Solicitud cerrada. Para responder, reábrela con "Pasar a En revisión".
                        </p>
                    )}
                </>
            )}
        </div>
    );

    // ---- Composición -----------------------------------------------------

    return (
        <div className="shadcn-scope flex h-full w-full flex-col p-4 md:p-6">
            <PageHeader
                title="Solicitudes de clientes"
                subtitle="Lo que tus clientes piden desde el portal. Se actualiza solo."
                onBack={onBack}
            />
            <div
                className={cn(
                    'mt-4 grid min-h-0 flex-1 gap-4',
                    isMobile ? 'grid-cols-1' : 'grid-cols-[380px_minmax(0,1fr)]',
                )}
                style={{ height: isMobile ? undefined : 'calc(100dvh - 190px)', minHeight: 420 }}
            >
                {isMobile ? (seleccionada ? panelDetalle : panelLista) : (<>{panelLista}{panelDetalle}</>)}
            </div>
        </div>
    );
};

export default SolicitudesClientesPage;
