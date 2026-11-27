import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatearFechaHoraCorta } from '@/lib/fechas';
import { IconChartBar, IconCircleCheck, IconClock, IconDeviceMobile, IconFileCheck, IconPencil, IconSearch, IconX } from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { CampoFirma, type CampoFirmaHandle } from '../../admin/components/CampoFirma';
import { FirmaCelularDialog } from '../../admin/components/FirmaCelularDialog';
import { fichaFirmaService, type DetalleFichaFirma, type FichaFirmaEnviada, type FichaFirmaSeguimiento, type FirmaPendiente } from '../../admin/services/fichaFirma.service';
import { firmaUsuarioService } from '../../../services/firmaUsuario.service';
import { useAuth } from '../../../contexts/AuthContext';

// "Firmas pendientes" de Solicitudes: las fichas de equipo que le enviaron a firmar a esta persona (Para firmar) y las
// que ella envió (Enviadas). Al elegir una se ve la ficha sin opción de guardarla ni imprimirla y se firma dibujando,
// con la firma registrada o con el celular (QR). Cuando firman todos, la ficha queda guardada en el archivo del equipo.

const TEXTO_ROL = { ENTREGA: 'Responsable de entrega', RESPONSABLE_AREA: 'Responsable de área', RECIBE: 'Recibe el equipo' } as const;
// Hora guardada por la base (hora local de Chile): se muestra tal cual, sin convertir de zona.
const fechaHora = (v?: string | null) => formatearFechaHoraCorta(v);
const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;

interface Props {
    /** Solicitud de firma a abrir (viene de una notificación). */
    abrirId?: number | null;
    onAbierta?: () => void;
    /** Avisa que cambió la cantidad de pendientes (para el contador de la carpeta). */
    onCambio?: () => void;
    /** Pestaña con que abre (la carpeta «Seguimiento de firmas» de Solicitudes abre en 'seguimiento'). */
    pestanaInicial?: 'firmar' | 'enviadas' | 'seguimiento';
    /** Tiene el permiso GC_SEGUIMIENTO_FIRMAS: ve además el seguimiento de todas las solicitudes de firma. */
    seguimiento?: boolean;
}

export const FirmasPendientesView: React.FC<Props> = ({ abrirId, onAbierta, onCambio, pestanaInicial = 'firmar', seguimiento = false }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const calidad = seguimiento;
    const [pestana, setPestana] = useState<'firmar' | 'enviadas' | 'seguimiento'>(pestanaInicial === 'seguimiento' && !calidad ? 'firmar' : pestanaInicial);
    const [pendientes, setPendientes] = useState<FirmaPendiente[]>([]);
    const [enviadas, setEnviadas] = useState<FichaFirmaEnviada[]>([]);
    const [todas, setTodas] = useState<FichaFirmaSeguimiento[]>([]);
    const [errorSeg, setErrorSeg] = useState<string | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [elegida, setElegida] = useState<number | null>(null);

    const cargar = useCallback(async () => {
        try {
            const [p, e] = await Promise.all([fichaFirmaService.pendientes(), fichaFirmaService.enviadas()]);
            setPendientes(p); setEnviadas(e); setError(null);
        } catch (err) {
            setError(mensajeError(err) || 'No se pudieron cargar las firmas pendientes.');
        } finally {
            setCargando(false);
        }
        // Aparte: si el seguimiento falla, lo propio (Para firmar / Enviadas) se sigue viendo.
        if (calidad) {
            try { setTodas(await fichaFirmaService.seguimiento()); setErrorSeg(null); }
            catch (err) { setErrorSeg(mensajeError(err) || 'No se pudo cargar el seguimiento de firmas.'); }
        }
    }, [calidad]);
    useEffect(() => { cargar(); }, [cargar]);
    // La lista se mantiene al día sola (firmas nuevas, firmas que hicieron otros).
    useEffect(() => {
        const t = setInterval(() => { cargar(); onCambio?.(); }, 8000);
        return () => clearInterval(t);
    }, [cargar, onCambio]);

    // Llega desde una notificación: se abre esa solicitud de firma.
    useEffect(() => {
        if (!abrirId) return;
        setElegida(abrirId);
        onAbierta?.();
    }, [abrirId, onAbierta]);

    // Mismo orden de la lista: la que está elegida debe seguir existiendo.
    const refrescar = async () => { await cargar(); onCambio?.(); };

    return (
        <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Lista */}
            <div className="flex w-[340px] shrink-0 flex-col border-r border-border">
                <div className="flex gap-1 border-b border-border p-2">
                    {([
                        ['firmar', `Para firmar${pendientes.length ? ` (${pendientes.length})` : ''}`],
                        ['enviadas', 'Enviadas'],
                        ...(calidad ? [['seguimiento', 'Seguimiento'] as const] : []),
                    ] as const).map(([k, etiqueta]) => (
                        <button key={k} type="button" onClick={() => { setPestana(k); setElegida(null); }}
                            className={cn('flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors', pestana === k ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                            {etiqueta}
                        </button>
                    ))}
                </div>
                {pestana === 'seguimiento' ? (
                    <ListaSeguimiento fichas={todas} error={errorSeg} cargando={cargando} elegida={elegida} onElegir={setElegida} />
                ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                    {cargando ? (
                        <div className="flex justify-center p-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                    ) : error ? (
                        <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
                    ) : pestana === 'firmar' ? (
                        pendientes.length ? pendientes.map((f) => (
                            <button key={f.id_ficha_firma} type="button" onClick={() => setElegida(f.id_ficha_firma)}
                                className={cn('mb-1 flex w-full flex-col gap-0.5 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted', elegida === f.id_ficha_firma && 'border-primary/40 bg-primary/10')}>
                                <span className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-semibold">Ficha de entrega · {f.codigo_equipo}</span>
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
                                </span>
                                <span className="truncate text-xs text-muted-foreground">{f.nombre_equipo}</span>
                                <span className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                    <span>De {f.nombre_crea || 'Gestión de Calidad'} · {fechaHora(f.fecha_creacion)}</span>
                                </span>
                                <Badge variant="warning" className="mt-1 w-fit">Firma como {f.roles.map((r) => TEXTO_ROL[r].toLowerCase()).join(' y ')} · {f.firmadas} de {f.total}</Badge>
                            </button>
                        )) : <p className="px-4 py-12 text-center text-sm text-muted-foreground">No tiene firmas pendientes.</p>
                    ) : (
                        enviadas.length ? enviadas.map((f) => (
                            <button key={f.id_ficha_firma} type="button" onClick={() => setElegida(f.id_ficha_firma)}
                                className={cn('mb-1 flex w-full flex-col gap-0.5 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted', elegida === f.id_ficha_firma && 'border-primary/40 bg-primary/10')}>
                                <span className="text-sm font-semibold">Ficha de entrega · {f.codigo_equipo}</span>
                                <span className="truncate text-xs text-muted-foreground">{f.nombre_equipo}</span>
                                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                    <Badge variant={f.estado === 'COMPLETA' ? 'success' : f.estado === 'CANCELADA' ? 'destructive' : 'warning'}>
                                        {f.estado === 'COMPLETA' ? 'Firmada por todos' : f.estado === 'CANCELADA' ? 'Cancelada' : `Faltan ${f.firmantes.filter((x) => x.estado === 'PENDIENTE').length} firma(s)`}
                                    </Badge>
                                    {fechaHora(f.fecha_creacion)}
                                </span>
                            </button>
                        )) : <p className="px-4 py-12 text-center text-sm text-muted-foreground">No ha enviado fichas a firmar.</p>
                    )}
                </div>
                )}
            </div>

            {/* Detalle */}
            <div className="min-w-0 flex-1 overflow-y-auto bg-muted/30">
                {elegida ? (
                    <DetalleFirma key={elegida} id={elegida} nombreUsuario={user?.name || ''} onCambio={refrescar} showToast={showToast} />
                ) : pestana === 'seguimiento' ? (
                    <ResumenSeguimiento fichas={todas} />
                ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-6 text-center text-muted-foreground">
                        <IconFileCheck size={44} className="opacity-40" />
                        <h2 className="m-0 text-base font-semibold text-foreground/80">Seleccione una ficha</h2>
                        <span>Aquí se ve la ficha y se firma.</span>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Seguimiento (Gestión de Calidad): todas las solicitudes de firma ─────────

type FiltroEstado = 'TODAS' | 'PENDIENTE' | 'COMPLETA' | 'CANCELADA';
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const firmadasDe = (f: FichaFirmaEnviada) => f.firmantes.filter((x) => x.estado === 'FIRMADA').length;

const ListaSeguimiento: React.FC<{
    fichas: FichaFirmaSeguimiento[];
    error: string | null;
    cargando: boolean;
    elegida: number | null;
    onElegir: (id: number) => void;
}> = ({ fichas, error, cargando, elegida, onElegir }) => {
    const [filtro, setFiltro] = useState<FiltroEstado>('PENDIENTE');
    const [texto, setTexto] = useState('');
    const cuenta = useMemo(() => ({
        TODAS: fichas.length,
        PENDIENTE: fichas.filter((f) => f.estado === 'PENDIENTE').length,
        COMPLETA: fichas.filter((f) => f.estado === 'COMPLETA').length,
        CANCELADA: fichas.filter((f) => f.estado === 'CANCELADA').length,
    }), [fichas]);
    const visibles = useMemo(() => {
        const q = sinTildes(texto.trim());
        return fichas.filter((f) => (filtro === 'TODAS' || f.estado === filtro) && (!q || sinTildes(
            [f.codigo_equipo, f.nombre_equipo, f.nombre_crea, ...f.firmantes.map((x) => x.nombre)].filter(Boolean).join(' '),
        ).includes(q)));
    }, [fichas, filtro, texto]);

    const chips: { k: FiltroEstado; label: string; tono: string }[] = [
        { k: 'PENDIENTE', label: 'Pendientes', tono: 'bg-warning' },
        { k: 'COMPLETA', label: 'Firmadas', tono: 'bg-success' },
        { k: 'CANCELADA', label: 'Canceladas', tono: 'bg-destructive' },
        { k: 'TODAS', label: 'Todas', tono: 'bg-muted-foreground/50' },
    ];

    return (
        <>
            <div className="flex flex-col gap-2 border-b border-border p-2">
                <div className="grid grid-cols-2 gap-1">
                    {chips.map((c) => (
                        <button key={c.k} type="button" onClick={() => setFiltro(c.k)}
                            className={cn('flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                                filtro === c.k ? 'border-primary/50 bg-primary/10 font-semibold text-foreground' : 'border-border text-muted-foreground hover:bg-muted')}>
                            <span className="flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', c.tono)} />{c.label}</span>
                            <span className="tabular-nums">{cuenta[c.k]}</span>
                        </button>
                    ))}
                </div>
                <div className="relative">
                    <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar equipo o persona" className="h-8 pl-8 text-sm" />
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {cargando ? (
                    <div className="flex justify-center p-6"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                ) : error ? (
                    <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>
                ) : visibles.length ? visibles.map((f) => {
                    const hechas = firmadasDe(f);
                    const faltan = f.firmantes.filter((x) => x.estado === 'PENDIENTE');
                    return (
                        <button key={f.id_ficha_firma} type="button" onClick={() => onElegir(f.id_ficha_firma)}
                            className={cn('mb-1 flex w-full flex-col gap-1 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:bg-muted', elegida === f.id_ficha_firma && 'border-primary/40 bg-primary/10')}>
                            <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold">Ficha de entrega · {f.codigo_equipo}</span>
                                <Badge variant={f.estado === 'COMPLETA' ? 'success' : f.estado === 'CANCELADA' ? 'destructive' : 'warning'} className="shrink-0">
                                    {f.estado === 'COMPLETA' ? 'Firmada' : f.estado === 'CANCELADA' ? 'Cancelada' : `${hechas} de ${f.firmantes.length}`}
                                </Badge>
                            </span>
                            <span className="truncate text-xs text-muted-foreground">{f.nombre_equipo}</span>
                            {f.estado === 'PENDIENTE' && faltan.length > 0 && (
                                <span className="truncate text-[11px] text-warning">Falta: {faltan.map((x) => x.nombre).join(', ')}</span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                                De {f.nombre_crea || 'Gestión de Calidad'} · {fechaHora(f.fecha_creacion)}
                                {f.estado === 'COMPLETA' && f.fecha_completa ? ` · firmada ${fechaHora(f.fecha_completa)}` : ''}
                            </span>
                        </button>
                    );
                }) : (
                    <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                        {fichas.length ? 'Ninguna solicitud coincide con el filtro.' : 'Todavía no se han enviado fichas a firmar.'}
                    </p>
                )}
            </div>
        </>
    );
};

const Kpi: React.FC<{ label: string; valor: number; tono: string; nota?: string }> = ({ label, valor, tono, nota }) => (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={cn('h-2 w-2 rounded-full', tono)} />{label}</span>
        <span className="text-2xl font-bold tabular-nums">{valor}</span>
        {nota && <span className="text-[11px] text-muted-foreground">{nota}</span>}
    </div>
);

/** Vista general del seguimiento: cuántas fichas y cuántas firmas van, y quién tiene firmas por hacer. */
const ResumenSeguimiento: React.FC<{ fichas: FichaFirmaSeguimiento[] }> = ({ fichas }) => {
    const vigentes = fichas.filter((f) => f.estado !== 'CANCELADA');
    const completas = fichas.filter((f) => f.estado === 'COMPLETA').length;
    const pendientes = fichas.filter((f) => f.estado === 'PENDIENTE').length;
    const canceladas = fichas.length - vigentes.length;
    const firmasTotal = vigentes.reduce((s, f) => s + f.firmantes.length, 0);
    const firmasHechas = vigentes.reduce((s, f) => s + firmadasDe(f), 0);
    const pct = firmasTotal ? Math.round((firmasHechas / firmasTotal) * 100) : 0;
    const pctFichas = vigentes.length ? Math.round((completas / vigentes.length) * 100) : 0;

    // Quién tiene firmas por hacer (en solicitudes pendientes), de más a menos.
    const porPersona = useMemo(() => {
        const m = new Map<string, { nombre: string; cargo: string | null; n: number; desde: string }>();
        for (const f of fichas) {
            if (f.estado !== 'PENDIENTE') continue;
            for (const x of f.firmantes) {
                if (x.estado !== 'PENDIENTE') continue;
                const p = m.get(x.nombre);
                if (p) { p.n += 1; if (f.fecha_creacion < p.desde) p.desde = f.fecha_creacion; }
                else m.set(x.nombre, { nombre: x.nombre, cargo: x.cargo, n: 1, desde: f.fecha_creacion });
            }
        }
        return [...m.values()].sort((a, b) => b.n - a.n || a.desde.localeCompare(b.desde));
    }, [fichas]);

    return (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-5">
            <div className="flex items-center gap-2">
                <IconChartBar size={20} className="text-primary" />
                <div>
                    <h2 className="m-0 text-base font-semibold">Seguimiento de firmas</h2>
                    <p className="m-0 text-xs text-muted-foreground">Todas las fichas enviadas a firmar. Elija una en la lista para ver su detalle.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Kpi label="Enviadas" valor={fichas.length} tono="bg-primary" />
                <Kpi label="Firmadas por todos" valor={completas} tono="bg-success" nota={vigentes.length ? `${pctFichas}% de las vigentes` : undefined} />
                <Kpi label="Pendientes" valor={pendientes} tono="bg-warning" />
                <Kpi label="Canceladas" valor={canceladas} tono="bg-destructive" />
            </div>

            <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">Firmas realizadas</span>
                    <span className="text-sm tabular-nums"><b>{firmasHechas}</b> de {firmasTotal} <span className="text-muted-foreground">({pct}%)</span></span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] text-muted-foreground">Cuenta cada firma (responsable de entrega y de área) de las solicitudes no canceladas.</span>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-background">
                <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">Quién tiene firmas pendientes</div>
                {porPersona.length ? (
                    <ul className="divide-y divide-border">
                        {porPersona.map((p) => (
                            <li key={p.nombre} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                <div className="min-w-0">
                                    <p className="m-0 truncate text-sm font-medium">{p.nombre}</p>
                                    <p className="m-0 truncate text-[11px] text-muted-foreground">{p.cargo ? `${p.cargo} · ` : ''}la más antigua desde {fechaHora(p.desde)}</p>
                                </div>
                                <Badge variant="warning" className="shrink-0 tabular-nums">{p.n} {p.n === 1 ? 'firma' : 'firmas'}</Badge>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="flex items-center gap-1.5 px-4 py-6 text-sm text-muted-foreground"><IconCircleCheck size={16} className="text-success" /> No hay firmas pendientes.</p>
                )}
            </div>
        </div>
    );
};

// ─── Una solicitud de firma ───────────────────────────────────────────────────

interface DetalleProps {
    id: number;
    nombreUsuario: string;
    onCambio: () => Promise<void>;
    showToast: (t: { type: 'success' | 'error' | 'warning' | 'info'; message: string }) => void;
}

const DetalleFirma: React.FC<DetalleProps> = ({ id, nombreUsuario, onCambio, showToast }) => {
    const [d, setD] = useState<DetalleFichaFirma | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pdf, setPdf] = useState<string | null>(null);
    const [miFirma, setMiFirma] = useState<string | null>(null);
    // Lo que hay que firmar: la imagen (dibujada, importada o del celular) o su firma registrada.
    const [firma, setFirma] = useState<{ imagen: string | null; usarRegistrada: boolean }>({ imagen: null, usarRegistrada: false });
    const campo = useRef<CampoFirmaHandle>(null);
    // Firma de quien recibe el equipo, que le pide quien entrega (con el celular o en pantalla).
    const campoEquipo = useRef<CampoFirmaHandle>(null);
    const [firmaEquipo, setFirmaEquipo] = useState<string | null>(null);
    const [celular, setCelular] = useState(false);
    const [firmando, setFirmando] = useState(false);
    const [cancelando, setCancelando] = useState(false);
    const [motivo, setMotivo] = useState('');

    // Lo último que se ve de la ficha (firmas hechas), para saber si cambió algo mientras se mira.
    const huella = useRef('');
    // Firmas que se están poniendo y aún no se guardan: la ficha las muestra apenas se hacen.
    const provisional = useRef<{ imagen?: string; usar_registrada?: boolean; imagen_equipo?: string }>({});

    const verPdf = useCallback(async () => {
        const p = provisional.current;
        const url = (p.imagen || p.usar_registrada || p.imagen_equipo)
            ? await fichaFirmaService.vistaPreviaUrl(id, p)
            : await fichaFirmaService.pdfUrl(id);
        setPdf((previo) => { if (previo) URL.revokeObjectURL(previo); return url; });
    }, [id]);

    const cargar = useCallback(async () => {
        try {
            const det = await fichaFirmaService.obtener(id);
            setD(det);
            huella.current = JSON.stringify([det.estado, det.firmantes.map((x) => x.estado)]);
            await verPdf();
        } catch (e) {
            setError(mensajeError(e) || 'No se pudo abrir la solicitud de firma.');
        }
    }, [id, verPdf]);
    useEffect(() => { cargar(); }, [cargar]);

    // En vivo: si otra persona firma (o se cancela) mientras se mira, el estado y la ficha se actualizan solos.
    useEffect(() => {
        if (d?.estado !== 'PENDIENTE') return;
        const t = setInterval(async () => {
            try {
                const det = await fichaFirmaService.obtener(id);
                const h = JSON.stringify([det.estado, det.firmantes.map((x) => x.estado)]);
                if (h !== huella.current) {
                    huella.current = h;
                    setD(det);
                    await verPdf();
                }
            } catch { /* se reintenta en el próximo ciclo */ }
        }, 4000);
        return () => clearInterval(t);
    }, [d?.estado, id, verPdf]);
    useEffect(() => () => { setPdf((p) => { if (p) URL.revokeObjectURL(p); return null; }); }, []);
    useEffect(() => { firmaUsuarioService.obtener().then((f) => setMiFirma(f.firma)).catch(() => setMiFirma(null)); }, []);

    const pideEquipo = !!d?.requiere_firma_equipo;
    // Si se le pidió en ADL SAMPLING no es obligatoria aquí, pero estando presente puede firmar igual.
    const equipoOpcional = !!d?.firma_equipo_en_app && !!d?.mis_roles?.includes('ENTREGA');
    const muestraEquipo = pideEquipo || equipoOpcional;
    const miFirmaLista = firma.usarRegistrada || !!firma.imagen;

    // Apenas se hace una firma (dibujada, importada o del celular) la ficha de arriba la muestra: se espera un instante
    // para no pedir la ficha en cada trazo.
    useEffect(() => {
        if (!d?.puede_firmar) return;
        provisional.current = {
            ...(firma.usarRegistrada ? { usar_registrada: true } : firma.imagen ? { imagen: firma.imagen } : {}),
            ...(firmaEquipo ? { imagen_equipo: firmaEquipo } : {}),
        };
        const t = setTimeout(() => { verPdf().catch(() => { /* la ficha sigue como estaba */ }); }, 500);
        return () => clearTimeout(t);
    }, [firma.imagen, firma.usarRegistrada, firmaEquipo, d?.puede_firmar, verPdf]);
    // Se puede firmar cuando está la propia y, si corresponde, la de quien recibe el equipo.
    const listaParaFirmar = miFirmaLista && (!pideEquipo || !!firmaEquipo);

    const firmar = async () => {
        if (!d || !listaParaFirmar) return;
        setFirmando(true);
        try {
            const r = await fichaFirmaService.firmar(d.id_ficha_firma, {
                ...(firma.usarRegistrada ? { usar_registrada: true } : { imagen: firma.imagen as string }),
                ...(muestraEquipo && firmaEquipo ? { imagen_equipo: firmaEquipo } : {}),
            });
            if (r.error) showToast({ type: 'warning', message: r.error });
            else showToast({ type: 'success', message: r.completa ? 'Firmó la ficha. Con su firma quedó completa y guardada.' : 'Firma registrada. Faltan otras firmas.' });
            await cargar();
            await onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo registrar la firma.' });
        } finally {
            setFirmando(false);
        }
    };

    const cancelar = async () => {
        if (!d) return;
        try {
            await fichaFirmaService.cancelar(d.id_ficha_firma, motivo);
            setCancelando(false); setMotivo('');
            showToast({ type: 'success', message: 'Solicitud de firma cancelada' });
            await cargar();
            await onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo cancelar.' });
        }
    };

    if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
    if (!d) return <p className="p-6 text-sm text-muted-foreground">Abriendo la ficha…</p>;

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background p-4">
                <div className="min-w-0">
                    <h2 className="m-0 text-lg font-bold">Ficha de entrega · {d.codigo_equipo}</h2>
                    <p className="m-0 truncate text-sm text-muted-foreground">{d.nombre_equipo}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Preparada por {d.nombre_crea || 'Gestión de Calidad'} el {fechaHora(d.fecha_creacion)}
                        {d.responsable_equipo ? ` · Recibe: ${d.responsable_equipo}` : ''}
                    </p>
                </div>
                <Badge variant={d.estado === 'COMPLETA' ? 'success' : d.estado === 'CANCELADA' ? 'destructive' : 'warning'}>
                    {d.estado === 'COMPLETA' ? 'Firmada por todos' : d.estado === 'CANCELADA' ? 'Cancelada' : 'Pendiente de firmas'}
                </Badge>
            </div>

            {/* Quién debe firmar y cómo va */}
            <ul className="grid gap-2 sm:grid-cols-2">
                {d.firmantes.map((f) => (
                    <li key={f.rol} className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', f.estado === 'FIRMADA' ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground')}>
                            {f.estado === 'FIRMADA' ? <IconCircleCheck size={17} /> : <IconClock size={16} />}
                        </span>
                        <div className="min-w-0">
                            <p className="m-0 text-sm font-medium leading-tight">{TEXTO_ROL[f.rol]}</p>
                            <p className="m-0 truncate text-xs text-muted-foreground">{f.nombre}{f.cargo ? ` · ${f.cargo}` : ''} — {f.estado === 'FIRMADA' ? `${f.rol === 'RECIBE' ? 'aceptó' : 'firmó'} ${fechaHora(f.fecha_firma)}` : f.estado === 'RECHAZADA' ? 'rechazó' : f.rol === 'RECIBE' ? 'falta que acepte en ADL SAMPLING' : 'falta firmar'}</p>
                        </div>
                    </li>
                ))}
            </ul>

            {d.firma_equipo_en_app && (
                <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">A {d.responsable_equipo} se le pidió aceptar el equipo en ADL SAMPLING; la ficha se completa cuando responda. Si está presente, quien entrega también puede pedirle la firma aquí.</p>
            )}
            {d.estado === 'CANCELADA' && <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">Cancelada: {d.motivo_cancelacion}</p>}
            {d.estado === 'COMPLETA' && <p className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">Firmaron todos. La ficha quedó guardada en el archivo de fichas del equipo.</p>}

            {/* La ficha: solo para ver (sin guardar ni imprimir) */}
            <div className="overflow-hidden rounded-lg border border-border bg-background">
                <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
                    <span>Ficha de entrega (OI-FoGe-36) · solo lectura</span>
                </div>
                {pdf
                    ? <iframe title="Ficha de entrega" src={`${pdf}#toolbar=0&navpanes=0&scrollbar=1`} className="h-[70vh] w-full" onContextMenu={(e) => e.preventDefault()} />
                    : <p className="p-6 text-sm text-muted-foreground">Cargando la ficha…</p>}
            </div>

            {/* Firmar */}
            {d.puede_firmar && d.mi_rol && (
                <div className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-background p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold">Su firma como {(d.mis_roles?.length ? d.mis_roles : [d.mi_rol]).map((r) => TEXTO_ROL[r].toLowerCase()).join(' y ')}</span>
                        <Button type="button" size="sm" variant="outline" onClick={() => setCelular(true)}><IconDeviceMobile size={14} /> Firmar con el celular</Button>
                    </div>
                    <div className={cn('grid gap-3', muestraEquipo ? 'md:grid-cols-2' : 'max-w-md')}>
                        <CampoFirma
                            ref={campo}
                            titulo={(d.mis_roles?.length ? d.mis_roles : [d.mi_rol]).map((r) => TEXTO_ROL[r]).join(' y ')}
                            nombre={nombreUsuario}
                            guardada={miFirma}
                            usarGuardadaInicial={false}
                            onChange={(f, usar) => setFirma({ imagen: f, usarRegistrada: usar })}
                        />
                        {/* Quien entrega le pide la firma a quien recibe el equipo: con el QR firma en el celular */}
                        {muestraEquipo && (
                            <CampoFirma
                                ref={campoEquipo}
                                titulo={equipoOpcional ? 'Responsable del equipo (recibe) · opcional' : 'Responsable del equipo (recibe)'}
                                nombre={d.responsable_equipo}
                                onChange={(f) => setFirmaEquipo(f)}
                            />
                        )}
                    </div>
                    {pideEquipo && (
                        <p className="rounded-md border border-warning/40 bg-warning/5 px-3 py-2 text-xs text-warning">
                            Como responsable de entrega, pídale la firma a quien recibe el equipo ({d.responsable_equipo || 'responsable del equipo'}): con «Firmar con el celular» él o ella firma con el dedo en el celular. Sin esa firma no se puede firmar la ficha.
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">Firme en pantalla, use su firma registrada o firme con el celular. Al presionar Firmar queda registrada en la ficha.</p>
                    <div className="flex justify-end">
                        <Button onClick={firmar} disabled={!listaParaFirmar || firmando} title={pideEquipo && !firmaEquipo ? 'Falta la firma del responsable del equipo' : undefined}><IconPencil size={16} /> {firmando ? 'Firmando…' : 'Firmar ficha'}</Button>
                    </div>
                    <FirmaCelularDialog
                        open={celular}
                        onClose={() => setCelular(false)}
                        titulo="Ficha de entrega"
                        subtitulo={`Equipo ${d.codigo_equipo}`}
                        slots={[
                            { id: 'firma', titulo: (d.mis_roles?.length ? d.mis_roles : [d.mi_rol]).map((r) => TEXTO_ROL[r]).join(' y '), nombre: nombreUsuario, firmada: miFirmaLista },
                            ...(muestraEquipo ? [{ id: 'equipo', titulo: 'Responsable del equipo (recibe)', nombre: d.responsable_equipo, firmada: !!firmaEquipo }] : []),
                        ]}
                        onFirma={(slot, imagen) => (slot === 'equipo' ? campoEquipo.current : campo.current)?.fijar(imagen)}
                        crearSesion={(cuerpo) => fichaFirmaService.crearQr(d.id_ficha_firma, cuerpo.slots)}
                        estadoSesion={(token) => fichaFirmaService.estadoQr(token)}
                    />
                </div>
            )}

            {/* Quien la envió puede cancelarla mientras falten firmas */}
            {d.es_creador && d.estado === 'PENDIENTE' && (
                <div className="flex justify-end">
                    <Button variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setCancelando(true)}><IconX size={15} /> Cancelar solicitud de firma</Button>
                </div>
            )}
            <Dialog open={cancelando} onOpenChange={(v) => { if (!v) setCancelando(false); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancelar solicitud de firma</DialogTitle>
                        <DialogDescription>A quienes aún no firman se les avisa. Escriba el motivo.</DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (obligatorio)" />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelando(false)}>Volver</Button>
                        <Button variant="destructive" onClick={cancelar} disabled={motivo.trim().length < 3}>Cancelar solicitud</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FirmasPendientesView;
