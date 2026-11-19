import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formatearFechaHoraCorta } from '@/lib/fechas';
import { IconPlus, IconSearch, IconFileTypePdf, IconPaperclip, IconTrash, IconDownload, IconBan, IconCircleCheck, IconClock, IconEdit } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { firmaUsuarioService } from '../../../services/firmaUsuario.service';
import PdfViewerModal from '../../facturacion/components/PdfViewerModal';
import { CampoFirma } from '../components/CampoFirma';
import { equipoService } from '../services/equipo.service';
import { ITEMS_RECEPCION, type ItemRecepcion } from '../services/fichasEquipo.service';
import {
    puestaMarchaService as api,
    TIPOS_PUESTA_MARCHA,
    NOMBRE_AREA,
    type PuestaMarcha,
    type PuestaMarchaDetalle,
    type DatosEquipoPuesta,
    type AreaPuestaMarcha,
    type TipoPuestaMarcha,
    type FirmantesPuesta,
    type RegistroInternoPuesta,
    type EdicionPuestaMarcha,
    type PatronReferencia,
} from '../services/puestaMarcha.service';

interface Props {
    onBack: () => void;
}

const mensajeError = (e: unknown) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
const hoyYmd = () => new Date().toISOString().slice(0, 10);
const dmy = (ymd: string | null | undefined) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : '');
const NOMBRE_TIPO = Object.fromEntries(TIPOS_PUESTA_MARCHA.map((t) => [t.value, t.label])) as Record<TipoPuestaMarcha, string>;
const BUFFERS = ['Buffer 4.0', 'Buffer 7.0', 'Buffer 10.0'];

const EstadoBadge: React.FC<{ estado: PuestaMarcha['estado'] }> = ({ estado }) => (
    estado === 'APROBADA' ? <Badge variant="success" className="gap-1"><IconCircleCheck size={12} /> Aprobada</Badge>
        : estado === 'ANULADA' ? <Badge variant="destructive" className="gap-1"><IconBan size={12} /> Anulada</Badge>
            : <Badge variant="warning" className="gap-1"><IconClock size={12} /> Pendiente de firma</Badge>
);


// Puestas en marcha de equipos (OI-FoGe-42). Se registran con el código del equipo y la fecha (lo demás sale del
// inventario), las verifican y validan dos personas (Área Técnica ↔ Gestión de Calidad) y, ya aprobadas, quedan en el
// historial del equipo. El estado del equipo (Operativo / Fuera de Servicio) se define después, en el inventario.
export const GcPuestaMarchaPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [filas, setFilas] = useState<PuestaMarcha[]>([]);
    const [cargando, setCargando] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [estado, setEstado] = useState('');
    const [nueva, setNueva] = useState(false);
    const [abierta, setAbierta] = useState<number | null>(null);
    const [pdf, setPdf] = useState<{ url: string; titulo: string } | null>(null);

    const cargar = useCallback(async () => {
        try {
            setFilas(await api.listar({ q: busqueda.trim() || undefined, estado: estado || undefined }));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudieron leer las puestas en marcha' });
        } finally {
            setCargando(false);
        }
    }, [busqueda, estado, showToast]);
    useEffect(() => {
        const t = setTimeout(cargar, 250);
        return () => clearTimeout(t);
    }, [cargar]);

    const verPdf = async (p: PuestaMarcha) => {
        try {
            setPdf({ url: await api.pdfUrl(p.id_puesta_marcha), titulo: `OI-FoGe-42 ${p.codigo_equipo ?? ''}` });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo generar el PDF' });
        }
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Puesta en Marcha"
                subtitle="Recepción, puesta en marcha y verificación de equipos (OI-FoGe-42)."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Gestión de Calidad', onClick: onBack }, { label: 'Puesta en Marcha' }]}
                rightSection={<Button onClick={() => setNueva(true)}><IconPlus size={16} /> Nueva puesta en marcha</Button>}
            />


            {/* Búsqueda arriba y estados en una fila que en el celular se desliza de lado (no se amontonan en varias líneas). */}
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative min-w-0 flex-1">
                    <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Buscar por código, nombre u observación…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
                <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0 md:pb-0">
                    {[['', 'Todas'], ['PENDIENTE_FIRMA', 'Pendientes de firma'], ['APROBADA', 'Aprobadas'], ['ANULADA', 'Anuladas']].map(([v, l]) => (
                        <button
                            key={v || 'todas'}
                            type="button"
                            onClick={() => setEstado(v)}
                            className={cn('h-9 shrink-0 whitespace-nowrap rounded-md border px-3 text-sm transition-colors', estado === v ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}
                        >
                            {l}
                        </button>
                    ))}
                </div>
            </div>

            {/* Celular: una tarjeta por puesta en marcha */}
            <div className="flex flex-col gap-2 md:hidden">
                {cargando ? (
                    <p className="rounded-xl border border-border py-10 text-center text-sm text-muted-foreground">Cargando…</p>
                ) : filas.length === 0 ? (
                    <p className="rounded-xl border border-border py-10 text-center text-sm text-muted-foreground">No hay puestas en marcha con estos filtros.</p>
                ) : filas.map((p) => (
                    <div key={p.id_puesta_marcha} role="button" tabIndex={0} onClick={() => setAbierta(p.id_puesta_marcha)} onKeyDown={(e) => { if (e.key === 'Enter') setAbierta(p.id_puesta_marcha); }}
                        className="rounded-xl border border-border bg-card p-3 active:bg-muted/50">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <p className="font-semibold">{p.codigo_equipo}</p>
                                <p className="truncate text-xs text-muted-foreground">{p.nombre_equipo}</p>
                            </div>
                            <EstadoBadge estado={p.estado} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{dmy(p.fecha)} · {NOMBRE_TIPO[p.tipo]}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                            <Badge variant={p.estado_recepcion === 'CUMPLE' ? 'success' : 'destructive'}>{p.estado_recepcion === 'CUMPLE' ? 'Cumple' : 'No cumple'}</Badge>
                            <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {!!p.n_adjuntos && <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><IconPaperclip size={13} />{p.n_adjuntos}</span>}
                                <Button size="sm" variant="outline" onClick={() => verPdf(p)}><IconFileTypePdf size={15} /> PDF</Button>
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tablet y escritorio: tabla */}
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Equipo</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Recepción</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="w-24 text-right" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {cargando ? (
                            <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">Cargando…</TableCell></TableRow>
                        ) : filas.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No hay puestas en marcha con estos filtros.</TableCell></TableRow>
                        ) : filas.map((p) => (
                            <TableRow key={p.id_puesta_marcha} className="cursor-pointer" onClick={() => setAbierta(p.id_puesta_marcha)}>
                                <TableCell className="whitespace-nowrap">{dmy(p.fecha)}</TableCell>
                                <TableCell>
                                    <span className="font-semibold">{p.codigo_equipo}</span>
                                    <span className="ml-2 text-muted-foreground">{p.nombre_equipo}</span>
                                </TableCell>
                                <TableCell className="text-muted-foreground">{NOMBRE_TIPO[p.tipo]}</TableCell>
                                <TableCell>
                                    <Badge variant={p.estado_recepcion === 'CUMPLE' ? 'success' : 'destructive'}>{p.estado_recepcion === 'CUMPLE' ? 'Cumple' : 'No cumple'}</Badge>
                                </TableCell>
                                <TableCell><EstadoBadge estado={p.estado} /></TableCell>
                                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                    {!!p.n_adjuntos && <span className="mr-2 inline-flex items-center gap-0.5 text-xs text-muted-foreground"><IconPaperclip size={13} />{p.n_adjuntos}</span>}
                                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver PDF" onClick={() => verPdf(p)}><IconFileTypePdf size={16} /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {nueva && <NuevaPuestaDialog onClose={() => setNueva(false)} onCreada={(id) => { setNueva(false); cargar(); setAbierta(id); }} />}
            {abierta !== null && <DetalleDialog key={abierta} id={abierta} onClose={() => { setAbierta(null); cargar(); }} onCambio={cargar} verPdf={verPdf} />}
            <PdfViewerModal open={!!pdf} onClose={() => setPdf(null)} url={pdf?.url ?? null} title={pdf?.titulo} />
        </div>
    );
};

// ─── Nueva puesta en marcha ─────────────────────────────────────────────────

interface OpcionEquipo { value: string; label: string }

type Items = Partial<Record<ItemRecepcion, string>>;

// Las secciones del OI-FoGe-42, en el mismo orden y con los mismos nombres que en el documento.
const ITEMS_RECEPCION_EQUIPO: { clave: ItemRecepcion; label: string }[] = [
    { clave: 'caja', label: 'Condición de caja' },
    { clave: 'embalaje', label: 'Condición de embalaje' },
];
const ITEMS_CONTENIDO: { clave: ItemRecepcion; label: string }[] = [
    { clave: 'manual', label: 'Contiene Manual' },
    { clave: 'cable', label: 'Contiene Cable Alimentación' },
    { clave: 'accesorios', label: 'Contiene Accesorios' },
];
const ITEMS_PUESTA: { clave: ItemRecepcion; label: string }[] = [
    { clave: 'interruptor', label: 'Condición interruptor' },
    { clave: 'comandos', label: 'Condición de comandos' },
    { clave: 'encendido', label: 'Encendido' },
];

/** Una sección del formulario, con el mismo título que en el documento. */
const SeccionFormulario: React.FC<{ titulo: string; children: React.ReactNode; accion?: React.ReactNode }> = ({ titulo, children, accion }) => (
    <section className="rounded-lg border border-border">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-1.5">
            <span className="text-xs font-semibold">{titulo}</span>
            {accion}
        </div>
        <div className="divide-y divide-border">{children}</div>
    </section>
);

/** Una fila del formulario: el nombre a la izquierda y lo que se marca o escribe a la derecha. */
const FilaFormulario: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm">{label}</span>
        <div className="flex flex-wrap gap-1 sm:justify-end">{children}</div>
    </div>
);

export const NuevaPuestaDialog: React.FC<{ onClose: () => void; onCreada: (id: number) => void; idEquipoInicial?: number }> = ({ onClose, onCreada, idEquipoInicial }) => {
    const { showToast } = useToast();
    const [equipos, setEquipos] = useState<OpcionEquipo[]>([]);
    const [idEquipo, setIdEquipo] = useState('');
    const [datos, setDatos] = useState<DatosEquipoPuesta | null>(null);
    const [fecha, setFecha] = useState(hoyYmd());
    const [tipo, setTipo] = useState<TipoPuestaMarcha>('EQUIPO_NUEVO');
    const [area, setArea] = useState<AreaPuestaMarcha>('TECNICA');
    const [items, setItems] = useState<Items>({});
    const [otros, setOtros] = useState('');
    // Sin marcar hasta que se elija: así el formulario de la derecha muestra solo lo que se ha llenado.
    const [recepcion, setRecepcion] = useState<'' | 'CUMPLE' | 'NO_CUMPLE'>('');
    // El funcionamiento lo elige quien registra (puede no cumplir y quedar operativo); sin elegir, sale del estado.
    const [funcionamientoSel, setFuncionamientoSel] = useState<'' | 'OPERATIVO' | 'NO_OPERATIVO'>('');
    const [patron, setPatron] = useState('');
    const [patrones, setPatrones] = useState<PatronReferencia[]>([]);
    const [observacion, setObservacion] = useState('');
    const [vinculo, setVinculo] = useState<'' | 'TEMPERATURA' | 'CAUDAL'>('');
    const [verifId, setVerifId] = useState('');
    const [caudalCodigo, setCaudalCodigo] = useState('');
    const [caudalFecha, setCaudalFecha] = useState('');
    const [guardando, setGuardando] = useState(false);
    // Vista previa del formulario (derecha): se regenera un instante después de cada cambio.
    const [previa, setPrevia] = useState<string | null>(null);
    const [generando, setGenerando] = useState(false);

    useEffect(() => {
        let vigente = true;
        equipoService.getEquipos({ page: 1, limit: 5000 })
            .then((r) => {
                if (!vigente) return;
                setEquipos((r.data || []).filter((e) => !/baja/i.test(String(e.estado_equipo || ''))).map((e) => ({ value: String(e.id_equipo), label: `${e.codigo} · ${e.nombre}` })));
            })
            .catch(() => { if (vigente) setEquipos([]); });
        api.patrones().then((l) => { if (vigente) setPatrones(l); }).catch(() => { if (vigente) setPatrones([]); });
        return () => { vigente = false; };
    }, []);

    const elegirEquipo = useCallback((id: string) => {
        setIdEquipo(id);
        setDatos(null);
        setVerifId('');
        if (id) api.datosEquipo(Number(id)).then(setDatos).catch(() => setDatos(null));
    }, []);
    // Desde el inventario: el equipo ya viene elegido.
    useEffect(() => { if (idEquipoInicial) elegirEquipo(String(idEquipoInicial)); }, [idEquipoInicial, elegirEquipo]);

    const funcionamientoCod = funcionamientoSel || (recepcion === 'CUMPLE' ? 'OPERATIVO' : recepcion === 'NO_CUMPLE' ? 'NO_OPERATIVO' : '');
    const verifElegida = datos?.verificaciones_temperatura.find((v) => String(v.id_verificacion) === verifId);

    // «Se registra»: Gestión de Calidad definió que las tres partes se marcan siempre, sea cual sea el caso.
    const registra = { recepcion: true, puesta: true, verificacion: true };

    const elegirItem = (clave: ItemRecepcion, op: string) => setItems((prev) => ({ ...prev, [clave]: prev[clave] === op ? '' : op }));
    // Marca la primera opción («Sin problema», «Cumple», «Con Manual», «Sí», «Bueno»…) en lo que sigue en blanco de la sección.
    const conforme = (lista: { clave: ItemRecepcion }[]) => setItems((prev) => {
        const r = { ...prev };
        for (const { clave } of lista) if (!r[clave]) r[clave] = ITEMS_RECEPCION[clave][0];
        return r;
    });
    const noAplica = (lista: { clave: ItemRecepcion }[]) => setItems((prev) => {
        const r = { ...prev };
        for (const { clave } of lista) r[clave] = 'No Aplica';
        return r;
    });

    const cuerpo = () => ({
        id_equipo: Number(idEquipo), fecha, tipo, area_realiza: area,
        estado_recepcion: (recepcion || undefined) as 'CUMPLE' | 'NO_CUMPLE' | undefined,
        funcionamiento: (funcionamientoCod || undefined) as 'OPERATIVO' | 'NO_OPERATIVO' | undefined,
        items, otros: otros.trim() || undefined,
        patron_referencia: patron.trim() || undefined, observacion: observacion.trim(),
        verificacion_tipo: vinculo || null,
        ...(vinculo === 'TEMPERATURA' ? { verificacion_id: Number(verifId) } : {}),
        // Caudal: una verificación OI-FoGe-30 con V°B° del sistema, o (respaldo) una hecha fuera, con código y fecha.
        ...(vinculo === 'CAUDAL' ? (verifId ? { verificacion_id: Number(verifId) } : { verificacion_codigo: caudalCodigo.trim(), verificacion_fecha: caudalFecha }) : {}),
    });

    useEffect(() => {
        let vigente = true;
        const t = setTimeout(async () => {
            setGenerando(true);
            try {
                const url = await api.vistaPreviaUrl(cuerpo());
                if (!vigente) { URL.revokeObjectURL(url); return; }
                setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return url; });
            } catch { /* la vista previa queda como estaba */ }
            finally { if (vigente) setGenerando(false); }
        }, 500);
        return () => { vigente = false; clearTimeout(t); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idEquipo, fecha, tipo, area, recepcion, funcionamientoSel, items, otros, patron, observacion, vinculo, verifId, caudalCodigo, caudalFecha]);
    useEffect(() => () => { setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return null; }); }, []);

    const guardar = async () => {
        if (!recepcion) return;
        setGuardando(true);
        try {
            const d = await api.crear({ ...cuerpo(), estado_recepcion: recepcion });
            showToast({ type: 'success', message: 'Puesta en marcha registrada: falta firmarla' });
            onCreada(d.id_puesta_marcha);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo registrar la puesta en marcha' });
        } finally {
            setGuardando(false);
        }
    };

    const faltan = [
        !idEquipo && 'el equipo',
        !fecha && 'la fecha',
        !recepcion && 'el estado de recepción',
        funcionamientoCod === 'OPERATIVO' && !patron.trim() && 'el patrón de referencia',
        !observacion.trim() && 'las observaciones',
        vinculo === 'TEMPERATURA' && !verifId && 'la verificación de temperatura',
        vinculo === 'CAUDAL' && !verifId && (!caudalCodigo.trim() || !caudalFecha) && 'la verificación de caudal',
    ].filter(Boolean) as string[];

    const opcion = (activo: boolean) => cn('h-9 flex-1 rounded-md border px-3 text-sm transition-colors', activo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted');
    const chip = (activo: boolean) => cn('min-w-[84px] rounded-md border px-2 py-1 text-xs transition-colors', activo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted');
    const accionesSeccion = (lista: { clave: ItemRecepcion }[]) => (
        <span className="flex gap-1">
            <button type="button" className="rounded px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10" onClick={() => conforme(lista)}>Todo conforme</button>
            <button type="button" className="rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted" onClick={() => noAplica(lista)}>No aplica</button>
        </span>
    );
    const filasItems = (lista: { clave: ItemRecepcion; label: string }[]) => lista.map((it) => (
        <FilaFormulario key={it.clave} label={it.label}>
            {ITEMS_RECEPCION[it.clave].map((op) => (
                <button key={op} type="button" aria-pressed={items[it.clave] === op} onClick={() => elegirItem(it.clave, op)} className={chip(items[it.clave] === op)}>{op}</button>
            ))}
        </FilaFormulario>
    ));
    const casilla = (label: string, marcada: boolean) => (
        <span className="flex items-center gap-1.5 text-sm">
            {label}
            <span className={cn('flex h-5 w-5 items-center justify-center rounded border text-xs font-bold', marcada ? 'border-foreground' : 'border-border text-transparent')}>X</span>
        </span>
    );

    return (
        <Dialog open onOpenChange={(o) => { if (!o && !guardando) onClose(); }}>
            <DialogContent className="shadcn-scope flex h-[94vh] w-[97vw] max-w-[1400px] flex-col gap-3 overflow-hidden sm:max-w-[1400px]">
                <DialogHeader>
                    <DialogTitle>Nueva puesta en marcha</DialogTitle>
                    <DialogDescription>Se llena igual que el formulario OI-FoGe-42: a la derecha se ve cómo va quedando.</DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
                    {/* Izquierda: el formulario, en el mismo orden que el documento */}
                    <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
                        {/* Datos del registro: no van impresos en el formulario */}
                        <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
                            <p className="text-xs font-semibold text-muted-foreground">Datos del registro <span className="font-normal">(no salen en el formulario)</span></p>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                Tipo de puesta en marcha
                                <div className="grid gap-1 sm:grid-cols-2">
                                    {TIPOS_PUESTA_MARCHA.map((t) => (
                                        <button key={t.value} type="button" onClick={() => setTipo(t.value)} className={cn('rounded-md border px-3 py-1.5 text-left text-sm transition-colors', tipo === t.value ? 'border-primary bg-primary/10 font-medium text-foreground' : 'border-border bg-background hover:bg-muted')}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                                La realiza <span className="text-[11px]">(la otra parte la valida)</span>
                                <div className="flex gap-1">
                                    <button type="button" className={opcion(area === 'TECNICA')} onClick={() => setArea('TECNICA')}>Área Técnica</button>
                                    <button type="button" className={opcion(area === 'CALIDAD')} onClick={() => setArea('CALIDAD')}>Gestión de Calidad</button>
                                </div>
                            </div>
                        </div>

                        {/* Encabezado del formulario: equipo y fecha */}
                        <section className="space-y-3 rounded-lg border border-border p-3">
                            <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
                                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                                    Equipo (Cód. Interno)
                                    <Combobox options={equipos} value={idEquipo} onValueChange={elegirEquipo} placeholder="Seleccione el equipo…" disabled={!!idEquipoInicial} />
                                </label>
                                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                                    Fecha
                                    <Input type="date" value={fecha} max={hoyYmd()} onChange={(e) => setFecha(e.target.value)} />
                                </label>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                                {[['Equipo', datos?.equipo.nombre], ['Marca', datos?.equipo.marca], ['Modelo', datos?.equipo.modelo], ['Serie', datos?.equipo.n_serie]].map(([k, v]) => (
                                    <div key={k}><p className="text-[11px] text-muted-foreground">{k}</p><p className="truncate font-medium">{v || '—'}</p></div>
                                ))}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-2">
                                {casilla('Recepción', registra.recepcion)}
                                {casilla('Puesta en Marcha', registra.puesta)}
                                {casilla('Verificación', registra.verificacion)}
                                <span className="text-[11px] text-muted-foreground">Se marcan siempre las tres.</span>
                            </div>
                        </section>

                        <SeccionFormulario titulo="Recepción de Equipo" accion={accionesSeccion(ITEMS_RECEPCION_EQUIPO)}>
                            {filasItems(ITEMS_RECEPCION_EQUIPO)}
                        </SeccionFormulario>

                        <SeccionFormulario titulo="Contenido Caja" accion={accionesSeccion(ITEMS_CONTENIDO)}>
                            {filasItems(ITEMS_CONTENIDO)}
                            <FilaFormulario label="Otros">
                                <Input className="h-8 sm:w-64" placeholder="Ej. maletín, sonda, pilas" value={otros} maxLength={300} onChange={(e) => setOtros(e.target.value)} />
                            </FilaFormulario>
                        </SeccionFormulario>

                        <SeccionFormulario titulo="Puesta en Marcha" accion={accionesSeccion(ITEMS_PUESTA)}>
                            {filasItems(ITEMS_PUESTA)}
                            <FilaFormulario label="Estado Recepción *">
                                <button type="button" aria-pressed={recepcion === 'CUMPLE'} className={chip(recepcion === 'CUMPLE')} onClick={() => setRecepcion((r) => (r === 'CUMPLE' ? '' : 'CUMPLE'))}>Cumple</button>
                                <button type="button" aria-pressed={recepcion === 'NO_CUMPLE'} className={chip(recepcion === 'NO_CUMPLE')} onClick={() => setRecepcion((r) => (r === 'NO_CUMPLE' ? '' : 'NO_CUMPLE'))}>No Cumple</button>
                            </FilaFormulario>
                        </SeccionFormulario>

                        <SeccionFormulario titulo="Verificación">
                            <FilaFormulario label="Funcionamiento">
                                {(['OPERATIVO', 'NO_OPERATIVO'] as const).map((f) => (
                                    <button key={f} type="button" aria-pressed={funcionamientoCod === f} className={chip(funcionamientoCod === f)}
                                        onClick={() => setFuncionamientoSel((s) => (s === f ? '' : f))}>
                                        {f === 'OPERATIVO' ? 'Operativo' : 'No Operativo'}
                                    </button>
                                ))}
                            </FilaFormulario>
                            <p className="px-3 pb-2 text-[11px] text-muted-foreground">Se propone según el estado de recepción; quien registra lo puede cambiar (puede no cumplir y quedar operativo).</p>
                            <div className="space-y-1.5 px-3 py-2">
                                <span className="text-sm">Con Patrón de Referencia {funcionamientoCod === 'OPERATIVO' && '*'}</span>
                                {/* Si el patrón es un equipo, se elige de la lista (trazabilidad por código); si es buffer, se escribe. */}
                                <Combobox
                                    value=""
                                    onValueChange={(v) => {
                                        const e = patrones.find((x) => String(x.id_equipo) === v);
                                        if (e) setPatron(`${e.tipoequipo} ${e.codigo}`);
                                    }}
                                    options={patrones.map((e) => ({ value: String(e.id_equipo), label: `${e.codigo} · ${e.tipoequipo}${e.sede ? ` (${e.sede})` : ''}` }))}
                                    placeholder="Elegir equipo patrón (termómetro patrón, molinete, muestreador automático)…"
                                />
                                <Input value={patron} maxLength={300} placeholder="Equipo elegido o buffer usado" onChange={(e) => setPatron(e.target.value)} />
                                <div className="flex flex-wrap gap-1">
                                    {BUFFERS.map((b) => (
                                        <button key={b} type="button" onClick={() => setPatron((p) => (p.includes(b) ? p : [p.trim(), b].filter(Boolean).join(' / ')))} className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-muted">{b}</button>
                                    ))}
                                    {verifElegida?.patron_codigo && !patron.includes(verifElegida.patron_codigo) && (
                                        <button type="button" className="rounded-full border border-primary/40 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/10" onClick={() => setPatron([verifElegida.patron_codigo, verifElegida.patron_nombre].filter(Boolean).join(' – '))}>
                                            Patrón de la verificación ({verifElegida.patron_codigo})
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-1.5 px-3 py-2">
                                <span className="text-sm">Verificación vinculada <span className="text-xs text-muted-foreground">(opcional, no sale en el formulario; queda en el historial)</span></span>
                                <div className="flex gap-1">
                                    <button type="button" className={opcion(vinculo === '')} onClick={() => setVinculo('')}>Ninguna</button>
                                    <button type="button" className={opcion(vinculo === 'TEMPERATURA')} onClick={() => setVinculo('TEMPERATURA')}>De temperatura</button>
                                    <button type="button" className={opcion(vinculo === 'CAUDAL')} onClick={() => setVinculo('CAUDAL')}>De sonda caudal</button>
                                </div>
                                {vinculo === 'TEMPERATURA' && (
                                    datos?.verificaciones_temperatura.length ? (
                                        <Combobox
                                            options={datos.verificaciones_temperatura.map((v) => ({ value: String(v.id_verificacion), label: `OI-FoGe-39 N° ${v.id_verificacion} · ${dmy(v.fecha)}${v.cumple === 'S' ? ' · Cumple' : v.cumple === 'N' ? ' · No cumple' : ''}` }))}
                                            value={verifId}
                                            onValueChange={setVerifId}
                                            placeholder="Seleccione la verificación firmada…"
                                        />
                                    ) : <p className="text-[11px] text-muted-foreground">{idEquipo ? 'Este equipo no tiene verificaciones de temperatura firmadas.' : 'Elija primero el equipo.'}</p>
                                )}
                                {vinculo === 'CAUDAL' && (
                                    <div className="space-y-2">
                                        {!!datos?.verificaciones_caudal?.length && (
                                            <Combobox
                                                options={datos.verificaciones_caudal.map((v) => ({ value: String(v.id_verificacion), label: `OI-FoGe-30 N° ${v.id_verificacion} · ${dmy(v.fecha)}${v.cumple === true ? ' · Cumple' : v.cumple === false ? ' · No cumple' : ''}` }))}
                                                value={verifId}
                                                onValueChange={setVerifId}
                                                placeholder="Seleccione la verificación de caudal con V°B°…"
                                            />
                                        )}
                                        {!verifId && (
                                            <>
                                                <p className="text-[11px] text-muted-foreground">{datos?.verificaciones_caudal?.length ? 'O, si se hizo fuera del sistema, su código y fecha:' : 'Esta sonda no tiene verificaciones de caudal con V°B° en el sistema. Si se hizo fuera, indique su código y fecha:'}</p>
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <Input placeholder="Código del documento" value={caudalCodigo} maxLength={100} onChange={(e) => setCaudalCodigo(e.target.value)} />
                                                    <Input type="date" value={caudalFecha} max={hoyYmd()} onChange={(e) => setCaudalFecha(e.target.value)} />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        </SeccionFormulario>

                        <SeccionFormulario titulo="Observaciones *">
                            <div className="px-3 py-2">
                                <Textarea rows={3} maxLength={1500} value={observacion} placeholder="Es lo que queda escrito en el historial del equipo." onChange={(e) => setObservacion(e.target.value)} />
                            </div>
                        </SeccionFormulario>

                        <div className="grid gap-2 sm:grid-cols-2">
                            {['Firma Recepción Área Técnica Medio Ambiente', 'Firma Área Gestión de Calidad'].map((f) => (
                                <div key={f} className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                                    <p className="font-medium text-foreground">{f}</p>
                                    Se firma después de registrar.
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Derecha: cómo va quedando el formulario */}
                    <div className="relative hidden min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/30 lg:flex">
                        <div className="flex items-center justify-between border-b border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                            <span>Vista previa · OI-FoGe-42</span>
                            {generando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
                        </div>
                        {previa
                            ? <iframe title="Vista previa del formulario OI-FoGe-42" src={`${previa}#toolbar=0&navpanes=0&view=FitH`} className="min-h-0 w-full flex-1 bg-white" />
                            : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Generando vista previa…</div>}
                    </div>
                </div>

                <DialogFooter className="items-center gap-2 sm:justify-between">
                    <span className="text-xs text-muted-foreground">{faltan.length ? `Falta: ${faltan.join(', ')}.` : 'Listo para registrar.'}</span>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={guardando}>Cancelar</Button>
                        <Button onClick={guardar} disabled={faltan.length > 0 || guardando}>Registrar</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// ─── Detalle: firmas, documentos y anulación ────────────────────────────────

export const DetalleDialog: React.FC<{ id: number; onClose: () => void; onCambio: () => void; verPdf: (p: PuestaMarcha) => void }> = ({ id, onClose, onCambio, verPdf }) => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [p, setP] = useState<PuestaMarchaDetalle | null>(null);
    const [miFirma, setMiFirma] = useState<string | null>(null);
    const [firmantes, setFirmantes] = useState<FirmantesPuesta | null>(null);
    // Quién firma por Medio Ambiente: el usuario conectado o un muestreador con competencias.
    const [muestreador, setMuestreador] = useState('');
    const [firma, setFirma] = useState<{ imagen: string | null; usar: boolean }>({ imagen: null, usar: false });
    const [claveFirma, setClaveFirma] = useState(0);
    const [ocupado, setOcupado] = useState(false);
    const [documento, setDocumento] = useState('');
    const [obsDocumento, setObsDocumento] = useState('');
    const archivo = useRef<HTMLInputElement>(null);
    const [anulando, setAnulando] = useState(false);
    const [motivo, setMotivo] = useState('');
    const [editando, setEditando] = useState(false);
    const [registro, setRegistro] = useState<RegistroInternoPuesta[] | null>(null);

    useEffect(() => {
        let vigente = true;
        api.obtener(id).then((d) => { if (vigente) setP(d); }).catch((e) => {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo abrir la puesta en marcha' });
            onClose();
        });
        firmaUsuarioService.obtener().then((f) => { if (vigente) setMiFirma(f.firma); }).catch(() => { if (vigente) setMiFirma(null); });
        api.firmantes().then((f) => { if (vigente) setFirmantes(f); }).catch(() => { if (vigente) setFirmantes(null); });
        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const ejecutar = async (fn: () => Promise<PuestaMarchaDetalle>, ok: string) => {
        setOcupado(true);
        try {
            setP(await fn());
            onCambio();
            showToast({ type: 'success', message: ok });
            if (registro) setRegistro(await api.registroInterno(id).catch(() => registro));
            return true;
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo completar la acción' });
            return false;
        } finally {
            setOcupado(false);
        }
    };

    if (!p) return null;
    const pendiente = p.estado === 'PENDIENTE_FIRMA';
    const aprobada = p.estado === 'APROBADA';
    const falta = (['TECNICA', 'CALIDAD'] as AreaPuestaMarcha[]).filter((a) => !p.firmas[a].firmada);
    const valida: AreaPuestaMarcha = p.area_realiza === 'TECNICA' ? 'CALIDAD' : 'TECNICA';
    const areas = p.mis_areas || { TECNICA: false, CALIDAD: false };
    const muestreadorElegido = firmantes?.muestreadores.find((m) => String(m.id_muestreador) === muestreador) || null;
    // Por qué partes puede firmar ahora: un muestreador elegido firma solo por Medio Ambiente.
    const rolesFirmables = falta.filter((rol) => (muestreadorElegido ? rol === 'TECNICA' : areas[rol]));
    const firmaLista = !!firma.imagen || firma.usar;
    // Ya aprobada, solo quien tiene el permiso de editar agrega o quita documentos.
    const puedeDocumentos = p.estado !== 'ANULADA' && (!aprobada || p.puede_editar);

    const firmar = async (rol: AreaPuestaMarcha) => {
        const cuerpo = { rol, ...(muestreadorElegido ? { id_muestreador: muestreadorElegido.id_muestreador } : {}), ...(firma.usar ? { usar_registrada: true } : { imagen: firma.imagen ?? undefined }) };
        const ok = await ejecutar(() => api.firmar(p.id_puesta_marcha, cuerpo), 'Firma registrada');
        if (ok) { setFirma({ imagen: null, usar: false }); setClaveFirma((k) => k + 1); setMuestreador(''); }
    };

    const adjuntar = async () => {
        const f = archivo.current?.files?.[0];
        if (!f || !documento.trim()) return;
        const ok = await ejecutar(() => api.adjuntar(p.id_puesta_marcha, documento.trim(), f, obsDocumento.trim() || undefined), 'Documento adjuntado');
        if (ok) { setDocumento(''); setObsDocumento(''); if (archivo.current) archivo.current.value = ''; }
    };

    const verRegistro = async () => {
        try { setRegistro(await api.registroInterno(id)); } catch (e) { showToast({ type: 'error', message: mensajeError(e) || 'No se pudo leer el registro interno' }); }
    };

    return (
        <Dialog open onOpenChange={(o) => { if (!o && !ocupado) onClose(); }}>
            <DialogContent className={cn('shadcn-scope flex max-h-[92vh] w-[95vw] flex-col gap-4 overflow-y-auto',
                editando ? 'h-[94vh] max-w-[1400px] sm:max-w-[1400px]' : 'max-w-3xl')}>
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        Puesta en marcha · {p.codigo_equipo} <EstadoBadge estado={p.estado} />
                    </DialogTitle>
                    <DialogDescription>{p.nombre_equipo} · {NOMBRE_TIPO[p.tipo]} · {dmy(p.fecha)}</DialogDescription>
                </DialogHeader>

                {editando ? (
                    <EditarPuestaForm p={p} ocupado={ocupado} onCancelar={() => setEditando(false)}
                        onGuardar={async (cambios) => { if (await ejecutar(() => api.editar(p.id_puesta_marcha, cambios), 'Puesta en marcha actualizada')) setEditando(false); }} />
                ) : (
                    <div className="grid gap-x-4 gap-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm sm:grid-cols-2">
                        <p><span className="text-muted-foreground">La realiza:</span> {NOMBRE_AREA[p.area_realiza]} <span className="text-muted-foreground">· la valida {NOMBRE_AREA[valida]}</span></p>
                        <p><span className="text-muted-foreground">Recepción:</span> {p.estado_recepcion === 'CUMPLE' ? 'Cumple' : 'No cumple'} · <span className="text-muted-foreground">Funcionamiento:</span> {p.funcionamiento === 'OPERATIVO' ? 'Operativo' : 'No operativo'}</p>
                        <p className="sm:col-span-2"><span className="text-muted-foreground">Patrón de referencia:</span> {p.patron_referencia || '—'}</p>
                        {p.verificacion_tipo && (
                            <p className="sm:col-span-2"><span className="text-muted-foreground">Verificación vinculada:</span> {p.verificacion_tipo === 'TEMPERATURA' ? 'Temperatura' : 'Sonda caudal'} {p.verificacion_codigo} · {dmy(p.verificacion_fecha)}</p>
                        )}
                        <p className="whitespace-pre-wrap sm:col-span-2"><span className="text-muted-foreground">Observación:</span> {p.observacion}</p>
                        {p.estado === 'ANULADA' && <p className="text-destructive sm:col-span-2">Anulada: {p.motivo_anulacion}</p>}
                    </div>
                )}

                {/* Firmas: se aprueba con las dos, de personas distintas */}
                <div className="grid gap-2 sm:grid-cols-2">
                    {(['TECNICA', 'CALIDAD'] as AreaPuestaMarcha[]).map((a) => (
                        <div key={a} className={cn('rounded-lg border p-3 text-sm', p.firmas[a].firmada ? 'border-success/40 bg-success/5' : 'border-border')}>
                            <p className="text-xs text-muted-foreground">{NOMBRE_AREA[a]} · {a === p.area_realiza ? 'realiza' : 'valida'}</p>
                            {p.firmas[a].firmada
                                ? <p className="mt-1 flex items-center gap-1 font-medium text-success"><IconCircleCheck size={15} /> Firmada por {p.firmas[a].nombre}</p>
                                : <p className="mt-1 text-muted-foreground">Pendiente</p>}
                        </div>
                    ))}
                </div>

                {pendiente && (
                    <div className="flex flex-col gap-3 rounded-lg border border-primary/40 p-3">
                        <p className="text-sm font-semibold">Firmar</p>
                        {/* Por Medio Ambiente también firma un muestreador con competencias */}
                        {!p.firmas.TECNICA.firmada && !!firmantes?.muestreadores.length && (
                            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                                Firma por Medio Ambiente
                                <Combobox
                                    value={muestreador}
                                    onValueChange={(v) => { setMuestreador(v); setFirma({ imagen: null, usar: false }); setClaveFirma((k) => k + 1); }}
                                    options={[{ value: '', label: `Yo (${user?.name || 'usuario conectado'})` }, ...firmantes.muestreadores.map((m) => ({ value: String(m.id_muestreador), label: `${m.nombre} · muestreador con competencias` }))]}
                                    placeholder="Quién firma"
                                />
                            </label>
                        )}
                        {rolesFirmables.length > 0 ? (
                            <>
                                <div className="max-w-md">
                                    <CampoFirma
                                        key={claveFirma}
                                        titulo={muestreadorElegido ? `Firma de ${muestreadorElegido.nombre}` : 'Su firma'}
                                        nombre={muestreadorElegido ? muestreadorElegido.nombre : (user?.name || '')}
                                        guardada={muestreadorElegido ? null : miFirma}
                                        importable={!!muestreadorElegido}
                                        usarGuardadaInicial={false}
                                        onChange={(f, usar) => setFirma({ imagen: f, usar })}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {rolesFirmables.map((rol) => (
                                        <Button key={rol} size="sm" disabled={!firmaLista || ocupado} onClick={() => firmar(rol)}>
                                            Firmar como {NOMBRE_AREA[rol]}{rol === p.area_realiza ? ' (realiza)' : ' (valida)'}
                                        </Button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                No tiene el permiso para firmar las partes pendientes. Por Gestión de Calidad firma quien tenga «Puesta en Marcha: firmar por Gestión de Calidad»; por el Área Técnica, quien tenga «Puesta en Marcha: firmar por el Área Técnica» o un muestreador con competencias.
                            </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">Quien realiza y quien valida son personas distintas: no se puede firmar por las dos partes.</p>
                    </div>
                )}

                {/* Documentos: se adjuntan después (informe de diagnóstico, reparación o mantención) */}
                <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
                    <p className="flex items-center gap-1 text-sm font-semibold"><IconPaperclip size={15} /> Documentos asociados</p>
                    {p.adjuntos.length === 0 && <p className="text-xs text-muted-foreground">Sin documentos. Se pueden adjuntar después, cuando el proveedor los entregue.</p>}
                    {p.adjuntos.map((a) => (
                        <div key={a.id_adjunto} className="flex items-start gap-2 text-sm">
                            <span className="min-w-0 flex-1">
                                <span className="block truncate"><b>{a.documento}</b> <span className="text-muted-foreground">· {a.archivo_nombre}</span></span>
                                {a.observacion && <span className="block text-xs text-muted-foreground">{a.observacion}</span>}
                            </span>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" title="Descargar" onClick={() => api.descargarAdjunto(a)}><IconDownload size={14} /></Button>
                            {puedeDocumentos && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" title="Quitar" disabled={ocupado} onClick={() => ejecutar(() => api.eliminarAdjunto(a.id_adjunto), 'Documento quitado')}><IconTrash size={14} /></Button>
                            )}
                        </div>
                    ))}
                    {puedeDocumentos && (
                        <div className="grid gap-2 sm:grid-cols-2">
                            <Input placeholder="Qué documento es (ej. Informe de mantención)" value={documento} maxLength={200} onChange={(e) => setDocumento(e.target.value)} />
                            <Input ref={archivo} type="file" accept="application/pdf,image/*" />
                            <Textarea className="sm:col-span-2" rows={2} maxLength={500} placeholder={aprobada ? 'Observación: complementa la línea de esta puesta en marcha en el historial del equipo' : 'Observación del documento (opcional)'} value={obsDocumento} onChange={(e) => setObsDocumento(e.target.value)} />
                            <Button variant="outline" className="sm:col-span-2 sm:justify-self-end" disabled={!documento.trim() || ocupado} onClick={adjuntar}>Adjuntar</Button>
                        </div>
                    )}
                    {aprobada && (
                        <p className="text-[11px] text-muted-foreground">
                            {p.puede_editar
                                ? 'Al adjuntar un documento, su observación complementa la línea de esta puesta en marcha en el historial del equipo.'
                                : 'Ya aprobada: adjuntar o quitar documentos requiere el permiso «Puesta en Marcha: editar».'}
                        </p>
                    )}
                </div>

                {/* Registro interno: cambios y acciones, solo para Gestión de Calidad (no va al historial ni a auditores) */}
                {p.puede_editar && (
                    <div className="rounded-lg border border-dashed border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold">Registro interno <span className="text-xs font-normal text-muted-foreground">(permiso «Puesta en Marcha: editar»)</span></p>
                            <Button size="sm" variant="ghost" onClick={registro ? () => setRegistro(null) : verRegistro}>{registro ? 'Ocultar' : 'Ver'}</Button>
                        </div>
                        {registro && (registro.length === 0
                            ? <p className="mt-2 text-xs text-muted-foreground">Sin movimientos registrados.</p>
                            : (
                                <ul className="mt-2 space-y-1.5 text-xs">
                                    {registro.map((r, i) => (
                                        <li key={i} className="border-l-2 border-border pl-2">
                                            <span className="text-muted-foreground">{formatearFechaHoraCorta(r.fecha_registro)} · {r.nombre_usuario || '—'}</span>
                                            <span className="block">{r.descripcion_humana}</span>
                                        </li>
                                    ))}
                                </ul>
                            ))}
                    </div>
                )}


                <DialogFooter className="flex-wrap items-center gap-2 sm:justify-between">
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => verPdf(p)}><IconFileTypePdf size={15} /> Ver PDF</Button>
                        {p.puede_editar && !editando && (
                            <Button variant="outline" onClick={() => setEditando(true)}><IconEdit size={15} /> Editar</Button>
                        )}
                        {pendiente && !anulando && (
                            <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setAnulando(true)}><IconBan size={15} /> Anular</Button>
                        )}
                    </div>
                    {anulando && (
                        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-1">
                            <Input className="min-w-0 flex-1" placeholder="Motivo de la anulación" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} />
                            <Button variant="destructive" disabled={!motivo.trim() || ocupado} onClick={() => ejecutar(() => api.anular(p.id_puesta_marcha, motivo.trim()), 'Puesta en marcha anulada')}>Confirmar</Button>
                            <Button variant="ghost" onClick={() => setAnulando(false)}>Cancelar</Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// Edición por Gestión de Calidad (también ya aprobada). Lo que cambie queda en el registro interno con el motivo; el
// historial del equipo no se reescribe (para complementarlo, se adjunta un documento con su observación).
const EditarPuestaForm: React.FC<{
    p: PuestaMarchaDetalle;
    ocupado: boolean;
    onCancelar: () => void;
    onGuardar: (cambios: EdicionPuestaMarcha) => void;
}> = ({ p, ocupado, onCancelar, onGuardar }) => {
    const [fecha, setFecha] = useState(p.fecha);
    const [recepcion, setRecepcion] = useState(p.estado_recepcion);
    const [funcionamiento, setFuncionamiento] = useState(p.funcionamiento);
    const [patron, setPatron] = useState(p.patron_referencia || '');
    const [observacion, setObservacion] = useState(p.observacion);
    const [motivo, setMotivo] = useState('');
    // Vista previa (derecha): el formulario OI-FoGe-42 con logo, encabezado y firmas, con los cambios aplicados.
    const [previa, setPrevia] = useState<string | null>(null);
    const [generando, setGenerando] = useState(false);
    useEffect(() => {
        let vigente = true;
        const t = setTimeout(async () => {
            setGenerando(true);
            try {
                const url = await api.vistaPreviaEdicionUrl(p.id_puesta_marcha, {
                    fecha, estado_recepcion: recepcion, funcionamiento, patron_referencia: patron, observacion,
                });
                if (!vigente) { URL.revokeObjectURL(url); return; }
                setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return url; });
            } catch { /* la vista previa queda como estaba */ }
            finally { if (vigente) setGenerando(false); }
        }, 500);
        return () => { vigente = false; clearTimeout(t); };
    }, [p.id_puesta_marcha, fecha, recepcion, funcionamiento, patron, observacion]);
    useEffect(() => () => { setPrevia((antes) => { if (antes) URL.revokeObjectURL(antes); return null; }); }, []);
    const chip = (activo: boolean) => cn('min-w-[90px] rounded-md border px-2 py-1 text-xs transition-colors', activo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted');

    return (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 self-start rounded-lg border border-primary/40 p-3 text-sm">
            <p className="font-semibold">Editar puesta en marcha</p>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:max-w-[200px]">
                Fecha
                <Input type="date" value={fecha} max={hoyYmd()} onChange={(e) => setFecha(e.target.value)} />
            </label>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Estado de recepción
                <button type="button" className={chip(recepcion === 'CUMPLE')} onClick={() => setRecepcion('CUMPLE')}>Cumple</button>
                <button type="button" className={chip(recepcion === 'NO_CUMPLE')} onClick={() => setRecepcion('NO_CUMPLE')}>No Cumple</button>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                Funcionamiento
                <button type="button" className={chip(funcionamiento === 'OPERATIVO')} onClick={() => setFuncionamiento('OPERATIVO')}>Operativo</button>
                <button type="button" className={chip(funcionamiento === 'NO_OPERATIVO')} onClick={() => setFuncionamiento('NO_OPERATIVO')}>No Operativo</button>
            </div>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Patrón de referencia
                <Input value={patron} maxLength={300} onChange={(e) => setPatron(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Observación
                <Textarea rows={3} maxLength={1500} value={observacion} onChange={(e) => setObservacion(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                Motivo del cambio * <span className="text-[11px]">Queda en el registro interno (lo ve quien tiene el permiso de editar); no se escribe en el historial del equipo.</span>
                <Input value={motivo} maxLength={300} placeholder="Ej. corrección de fecha, acción fuera de plazo" onChange={(e) => setMotivo(e.target.value)} />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={onCancelar} disabled={ocupado}>Cancelar</Button>
                <Button disabled={ocupado || !motivo.trim() || !observacion.trim()} onClick={() => onGuardar({
                    fecha, estado_recepcion: recepcion, funcionamiento, patron_referencia: patron.trim(), observacion: observacion.trim(), motivo: motivo.trim(),
                })}>Guardar cambios</Button>
            </div>
        </div>
        <div className="relative hidden min-h-[70vh] flex-col overflow-hidden rounded-lg border border-border bg-muted/30 lg:flex">
            <div className="flex items-center justify-between border-b border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                <span>Vista previa · OI-FoGe-42</span>
                {generando && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />}
            </div>
            {previa
                ? <iframe title="Vista previa del formulario OI-FoGe-42" src={`${previa}#toolbar=0&navpanes=0&view=FitH`} className="min-h-0 w-full flex-1 bg-white" />
                : <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Generando vista previa…</div>}
        </div>
        </div>
    );
};

export default GcPuestaMarchaPage;
