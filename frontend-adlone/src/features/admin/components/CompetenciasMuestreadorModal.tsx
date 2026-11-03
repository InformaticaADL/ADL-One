import React, { useState, useEffect, useRef, useMemo } from 'react';
import { IconUpload, IconTrash, IconChevronDown, IconFileTypePdf, IconPencil, IconNotes, IconCircleCheck, IconBan, IconHistory, IconLock, IconFolder, IconSearch, IconEye, IconCloudUpload, IconX } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { adminService } from '../../../services/admin.service';
import { useToast } from '../../../contexts/ToastContext';
import API_CONFIG from '../../../config/api.config';
import { DocumentoViewerModal, ArchivoIcono, type DocumentoVisor } from './DocumentoViewerModal';
import { tipoArchivo, extensionArchivo } from '../utils/tipoArchivo';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    // Se llama al cerrar si se habilitó/deshabilitó alguna competencia, para que
    // la lista de muestreadores refresque su columna de competencias.
    onChanged?: () => void;
    muestreador: { id_muestreador: number; nombre_muestreador: string } | null;
}

interface Competencia {
    id_competencia: number;
    nombre_competencia: string;
    descripcion?: string | null;
    // 'S' en el maestro; las asignadas que después se desactivaron en el
    // maestro llegan con 'N' y se muestran solo para consulta.
    activo: string;
    // Solo en las asignadas al muestreador: con qué observación y quién la habilitó.
    observacion?: string | null;
    fecha_asignacion?: string | null;
    usuario_asignacion?: string | null;
}

const MAX_OBSERVACION = 1000;

interface HistorialCompetencia {
    id_historial: number;
    id_competencia: number;
    accion: 'HABILITADA' | 'DESHABILITADA';
    observacion: string;
    fecha: string;
    usuario?: string | null;
}

interface Documento {
    id_documento: number;
    nombre_documento: string;
    ruta_archivo: string;
    fecha_subida: string;
    id_competencia: number | null;
}

const formatFecha = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-CL');
};

const urlDocumento = (d: Documento) => `${API_CONFIG.getBaseURL()}${d.ruta_archivo}`;

const ETIQUETA_TIPO = { pdf: 'PDF', imagen: 'Imagen', otro: 'Archivo' } as const;

// Muestra 4 documentos y el resto con scroll. Cada tarjeta mide 62px (44px de
// ícono + 16px de padding + 2px de borde) y el gap es de 8px: en escritorio son
// 2 filas de 2 (2·62 + 8 = 132px) y en celular 4 filas de 1 (4·62 + 3·8 = 272px).
const ALTO_LISTA_DOCS = 'max-h-[272px] overflow-y-auto pr-1 sm:max-h-[132px]';

// Pantalla acotada para Gestión de Calidad (permiso MU_COMPETENCIAS): solo
// Competencias y sus Documentos — nada de nombre/correo/firma/estado, eso sigue
// siendo exclusivo del formulario completo de Jefe Técnico (MuestreadorForm).
//
// Una competencia puede acumular muchos respaldos (cursos, certificados,
// evaluaciones), así que cada fila muestra solo la competencia y su contador,
// y los documentos se despliegan bajo demanda. Solo se adjunta a competencias
// habilitadas; al deshabilitar una, sus documentos se conservan.
export const CompetenciasMuestreadorModal: React.FC<Props> = ({ isOpen, onClose, onChanged, muestreador }) => {
    const { showToast } = useToast();

    const [allCompetencias, setAllCompetencias] = useState<Competencia[]>([]);
    const [compAsignadas, setCompAsignadas] = useState<Competencia[]>([]);
    const [habilitadas, setHabilitadas] = useState<number[]>([]);
    const [guardandoId, setGuardandoId] = useState<number | null>(null);
    const [huboCambios, setHuboCambios] = useState(false);

    const [documentos, setDocumentos] = useState<Documento[]>([]);
    const [abiertas, setAbiertas] = useState<Set<number | 'generales'>>(new Set());
    const [busqueda, setBusqueda] = useState('');
    const [visor, setVisor] = useState<{ docs: DocumentoVisor[]; indice: number; subtitulo: string } | null>(null);
    const [cambio, setCambio] = useState<{ competencia: Competencia; modo: 'habilitar' | 'deshabilitar' } | null>(null);
    const [observacion, setObservacion] = useState('');
    const [historial, setHistorial] = useState<HistorialCompetencia[]>([]);
    const [docAEliminar, setDocAEliminar] = useState<Documento | null>(null);
    const [eliminando, setEliminando] = useState(false);

    useEffect(() => {
        if (!isOpen || !muestreador) return;
        setAbiertas(new Set());
        setBusqueda('');
        setHuboCambios(false);
        adminService.getCompetencias(false).then(setAllCompetencias).catch(() => {});
        adminService.getCompetenciasMuestreador(muestreador.id_muestreador).then((rows: Competencia[]) => {
            setCompAsignadas(rows);
            setHabilitadas(rows.filter((r) => r.activo === 'S').map((r) => r.id_competencia));
        }).catch(() => {});
        adminService.getDocumentosMuestreador(muestreador.id_muestreador).then(setDocumentos).catch(() => {});
        adminService.getHistorialCompetenciasMuestreador(muestreador.id_muestreador).then(setHistorial).catch(() => setHistorial([]));
    }, [isOpen, muestreador]);

    // Activas del maestro (en su orden) + las asignadas que el maestro ya
    // desactivó, al final, para no perder de vista sus documentos.
    const competencias = useMemo(() => {
        const inactivas = compAsignadas.filter((c) => c.activo !== 'S');
        return [...allCompetencias, ...inactivas];
    }, [allCompetencias, compAsignadas]);

    const asignacionPorId = useMemo(() => new Map(compAsignadas.map((a) => [a.id_competencia, a])), [compAsignadas]);

    // Ya viene del más reciente al más antiguo: el primero es el último cambio.
    const historialPorCompetencia = useMemo(() => {
        const map = new Map<number, HistorialCompetencia[]>();
        for (const h of historial) map.set(h.id_competencia, [...(map.get(h.id_competencia) || []), h]);
        return map;
    }, [historial]);

    const docsPorCompetencia = useMemo(() => {
        const map = new Map<number, Documento[]>();
        for (const d of documentos) {
            if (!d.id_competencia) continue;
            map.set(d.id_competencia, [...(map.get(d.id_competencia) || []), d]);
        }
        return map;
    }, [documentos]);

    // Documentos sin competencia (los sube Jefe Técnico desde el formulario
    // completo) o de una competencia que ya no aparece en la lista.
    const docsGenerales = useMemo(() => {
        const ids = new Set(competencias.map((c) => c.id_competencia));
        return documentos.filter((d) => !d.id_competencia || !ids.has(d.id_competencia));
    }, [documentos, competencias]);

    const competenciasFiltradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return q ? competencias.filter((c) => c.nombre_competencia.toLowerCase().includes(q)) : competencias;
    }, [competencias, busqueda]);

    const toggleAbierta = (key: number | 'generales') => {
        setAbiertas((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const recargarHistorial = async () => {
        if (!muestreador) return;
        setHistorial(await adminService.getHistorialCompetenciasMuestreador(muestreador.id_muestreador));
    };

    const recargarAsignadas = async () => {
        if (!muestreador) return;
        const rows: Competencia[] = await adminService.getCompetenciasMuestreador(muestreador.id_muestreador);
        setCompAsignadas(rows);
        setHabilitadas(rows.filter((r) => r.activo === 'S').map((r) => r.id_competencia));
    };

    // El interruptor no cambia nada por sí solo: abre la ventana de
    // confirmación (con observación obligatoria al habilitar) y recién al
    // confirmar se guarda.
    const toggleHabilitada = (c: Competencia, on: boolean) => {
        setObservacion('');
        setCambio({ competencia: c, modo: on ? 'habilitar' : 'deshabilitar' });
    };

    const confirmarCambio = async () => {
        if (!muestreador || !cambio) return;
        const { competencia: c, modo } = cambio;
        if (!observacion.trim()) return;
        setGuardandoId(c.id_competencia);
        try {
            if (modo === 'habilitar') {
                await adminService.habilitarCompetenciaMuestreador(muestreador.id_muestreador, c.id_competencia, observacion.trim());
                setAbiertas((prev) => new Set(prev).add(c.id_competencia));
            } else {
                await adminService.deshabilitarCompetenciaMuestreador(muestreador.id_muestreador, c.id_competencia, observacion.trim());
            }
            await Promise.all([recargarAsignadas(), recargarHistorial()]);
            setHuboCambios(true);
            setCambio(null);
            showToast({ type: 'success', message: `"${c.nombre_competencia}" ${modo === 'habilitar' ? 'habilitada' : 'deshabilitada'}` });
        } catch (err) {
            const mensaje = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: mensaje || `No se pudo ${modo} "${c.nombre_competencia}"` });
        } finally {
            setGuardandoId(null);
        }
    };

    const recargarDocumentos = async () => {
        if (!muestreador) return;
        setDocumentos(await adminService.getDocumentosMuestreador(muestreador.id_muestreador));
    };

    const handleDeleteDoc = (doc: Documento) => setDocAEliminar(doc);

    const confirmarEliminar = async () => {
        if (!docAEliminar) return;
        setEliminando(true);
        try {
            await adminService.deleteDocumentoMuestreador(docAEliminar.id_documento);
            setDocumentos((prev) => prev.filter((d) => d.id_documento !== docAEliminar.id_documento));
            showToast({ type: 'success', message: 'Documento eliminado' });
            setDocAEliminar(null);
        } catch (err) {
            const mensaje = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: mensaje || 'Error al eliminar documento' });
        } finally {
            setEliminando(false);
        }
    };

    // El visor recibe la lista completa del grupo, así se puede pasar de un
    // documento al siguiente sin cerrar.
    const abrirVisor = (docs: Documento[], indice: number, subtitulo: string) => {
        setVisor({
            docs: docs.map((d) => ({ id: d.id_documento, nombre: d.nombre_documento, url: urlDocumento(d), fecha: formatFecha(d.fecha_subida) })),
            indice,
            subtitulo,
        });
    };

    const handleClose = () => {
        if (huboCambios) onChanged?.();
        onClose();
    };

    if (!muestreador) return null;

    const totalHabilitadas = competencias.filter((c) => habilitadas.includes(c.id_competencia)).length;

    // soloLectura: competencia deshabilitada — sus documentos se pueden ver
    // pero no eliminar (el backend también lo rechaza).
    const renderDocs = (docs: Documento[], subtitulo: string, soloLectura = false) => (
        docs.length === 0
            ? <p className="rounded-lg border border-dashed border-border py-5 text-center text-xs text-muted-foreground">Aún no hay documentos adjuntos.</p>
            : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {docs.map((d, i) => {
                        const tipo = tipoArchivo(d.ruta_archivo);
                        const ext = extensionArchivo(d.ruta_archivo);
                        return (
                            <div
                                key={d.id_documento}
                                className="group relative flex items-center gap-3 rounded-lg border border-border bg-card p-2 pr-1.5 transition-colors hover:border-primary/40 hover:bg-primary/5"
                            >
                                <button
                                    type="button"
                                    className="absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    onClick={() => abrirVisor(docs, i, subtitulo)}
                                    aria-label={`Ver ${d.nombre_documento}`}
                                />
                                <div className="pointer-events-none relative">
                                    <ArchivoIcono url={urlDocumento(d)} size="md" />
                                    {/* Al pasar el mouse el ícono indica que la tarjeta abre el visor. */}
                                    <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-primary/85 text-primary-foreground opacity-0 transition-opacity group-hover:opacity-100">
                                        <IconEye size={18} />
                                    </span>
                                </div>
                                <div className="pointer-events-none min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-foreground" title={d.nombre_documento}>{d.nombre_documento}</p>
                                    <p className="text-xs text-muted-foreground">{ETIQUETA_TIPO[tipo]}{ext ? ` (.${ext})` : ''} · {formatFecha(d.fecha_subida)}</p>
                                </div>
                                <div className="relative z-10 flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                                    <Button variant="ghost" size="icon-xs" onClick={() => abrirVisor(docs, i, subtitulo)} aria-label={`Ver ${d.nombre_documento}`} title="Ver">
                                        <IconEye size={14} />
                                    </Button>
                                    {!soloLectura && (
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => handleDeleteDoc(d)}
                                            aria-label={`Eliminar ${d.nombre_documento}`}
                                            title="Eliminar"
                                        >
                                            <IconTrash size={14} />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )
    );

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
            <DialogContent className="flex h-[92vh] w-[95vw] max-w-6xl flex-col gap-4 overflow-hidden">
                <DialogHeader>
                    <DialogTitle>Competencias y Documentos — {muestreador.nombre_muestreador}</DialogTitle>
                    <p className="text-[13px] text-muted-foreground">
                        {totalHabilitadas} de {competencias.length} competencias habilitadas · {documentos.length} documento(s).
                        Habilite una competencia para adjuntarle sus respaldos.
                    </p>
                </DialogHeader>

                {competencias.length > 8 && (
                    <div className="relative">
                        <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar competencia..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-border">
                    {competenciasFiltradas.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">
                            {competencias.length === 0 ? 'No hay competencias configuradas.' : 'Ninguna competencia coincide con la búsqueda.'}
                        </p>
                    )}
                    {competenciasFiltradas.map((c) => {
                        const habilitada = habilitadas.includes(c.id_competencia);
                        const inactivaMaestro = c.activo !== 'S';
                        const docs = docsPorCompetencia.get(c.id_competencia) || [];
                        const abierta = abiertas.has(c.id_competencia);
                        const asignacion = habilitada ? asignacionPorId.get(c.id_competencia) : undefined;
                        const eventos = historialPorCompetencia.get(c.id_competencia) || [];
                        const ultimaBaja = !habilitada && eventos[0]?.accion === 'DESHABILITADA' ? eventos[0] : undefined;
                        // Una deshabilitada sin documentos ni historial no tiene nada que desplegar.
                        const puedeAbrir = habilitada || docs.length > 0 || eventos.length > 0;
                        return (
                            <div key={c.id_competencia} className={cn('border-b border-border last:border-b-0', abierta && 'bg-muted/30')}>
                                <div className="flex items-center gap-3 px-4 py-3">
                                    <Switch
                                        checked={habilitada}
                                        disabled={inactivaMaestro || guardandoId !== null}
                                        onCheckedChange={(on) => toggleHabilitada(c, on)}
                                        aria-label={`${habilitada ? 'Deshabilitar' : 'Habilitar'} ${c.nombre_competencia}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className={cn('truncate text-sm font-medium', habilitada ? 'text-foreground' : 'text-muted-foreground')} title={c.nombre_competencia}>
                                            {c.nombre_competencia}
                                        </p>
                                        {asignacion?.observacion && (
                                            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={asignacion.observacion}>
                                                <IconNotes size={12} className="shrink-0" />
                                                <span className="truncate">{asignacion.observacion}</span>
                                            </p>
                                        )}
                                        {ultimaBaja && (
                                            <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-destructive/80" title={ultimaBaja.observacion}>
                                                <IconBan size={12} className="shrink-0" />
                                                <span className="truncate">Deshabilitada el {formatFecha(ultimaBaja.fecha)}: {ultimaBaja.observacion}</span>
                                            </p>
                                        )}
                                        {inactivaMaestro && <Badge variant="outline" className="mt-0.5 text-[10px]">Inactiva en el maestro</Badge>}
                                    </div>
                                    <Button
                                        size="sm"
                                        variant={abierta ? 'secondary' : 'outline'}
                                        disabled={!puedeAbrir}
                                        onClick={() => toggleAbierta(c.id_competencia)}
                                        aria-expanded={abierta}
                                    >
                                        <IconFolder size={14} />
                                        Documentos
                                        <Badge variant={docs.length > 0 ? 'default' : 'outline'} className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-[10px]">{docs.length}</Badge>
                                        <IconChevronDown size={14} className={cn('transition-transform', abierta && 'rotate-180')} />
                                    </Button>
                                </div>
                                {abierta && (
                                    <div className="mx-4 mb-4 flex flex-col gap-3 rounded-lg border border-border bg-background p-3">
                                        {asignacion?.observacion && (
                                            <div className="rounded-md border-l-2 border-primary bg-primary/5 px-3 py-2">
                                                <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                                    <IconNotes size={12} /> Observación de habilitación
                                                </p>
                                                <p className="whitespace-pre-wrap text-sm text-foreground">{asignacion.observacion}</p>
                                                {(asignacion.fecha_asignacion || asignacion.usuario_asignacion) && (
                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                        Habilitada{asignacion.fecha_asignacion ? ` el ${formatFecha(asignacion.fecha_asignacion)}` : ''}
                                                        {asignacion.usuario_asignacion ? ` por ${asignacion.usuario_asignacion}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {habilitada && !inactivaMaestro ? (
                                            <SubirDocumentoCompetencia
                                                idMuestreador={muestreador.id_muestreador}
                                                competencia={c}
                                                onSubido={recargarDocumentos}
                                            />
                                        ) : (
                                            <p className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                                                <IconLock size={13} className="shrink-0" />
                                                Competencia deshabilitada: sus documentos son de solo lectura. Se pueden ver, pero no adjuntar nuevos ni eliminar.
                                            </p>
                                        )}
                                        <div className={ALTO_LISTA_DOCS}>{renderDocs(docs, c.nombre_competencia, !habilitada || inactivaMaestro)}</div>
                                        {eventos.length > 0 && (
                                            <div className="border-t border-border pt-3">
                                                <p className="mb-2 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    <IconHistory size={12} /> Historial de la competencia
                                                </p>
                                                <ol className="flex max-h-40 flex-col gap-2 overflow-y-auto pr-1">
                                                    {eventos.map((h) => (
                                                        <li key={h.id_historial} className="flex gap-2 text-xs">
                                                            <span className={cn(
                                                                'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                                                                h.accion === 'HABILITADA' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
                                                            )}>
                                                                {h.accion === 'HABILITADA' ? <IconCircleCheck size={12} /> : <IconBan size={12} />}
                                                            </span>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-muted-foreground">
                                                                    <span className="font-medium text-foreground">{h.accion === 'HABILITADA' ? 'Habilitada' : 'Deshabilitada'}</span>
                                                                    {' · '}{formatFecha(h.fecha)}{h.usuario ? ` · ${h.usuario}` : ''}
                                                                </p>
                                                                <p className="whitespace-pre-wrap text-foreground">{h.observacion}</p>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ol>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {docsGenerales.length > 0 && !busqueda.trim() && (
                        <div className={cn('border-t border-border', abiertas.has('generales') && 'bg-muted/30')}>
                            <div className="flex items-center gap-3 px-4 py-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-foreground">Documentos generales</p>
                                    <p className="text-xs text-muted-foreground">Sin competencia asociada (cargados desde la ficha del muestreador).</p>
                                </div>
                                <Button size="sm" variant={abiertas.has('generales') ? 'secondary' : 'outline'} onClick={() => toggleAbierta('generales')} aria-expanded={abiertas.has('generales')}>
                                    <IconFolder size={14} />
                                    Documentos
                                    <Badge className="ml-0.5 h-5 min-w-5 justify-center px-1.5 text-[10px]">{docsGenerales.length}</Badge>
                                    <IconChevronDown size={14} className={cn('transition-transform', abiertas.has('generales') && 'rotate-180')} />
                                </Button>
                            </div>
                            {abiertas.has('generales') && (
                                <div className="mx-4 mb-4 rounded-lg border border-border bg-background p-3">
                                    <div className={ALTO_LISTA_DOCS}>{renderDocs(docsGenerales, 'Documentos generales')}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </DialogContent>
            <DocumentoViewerModal
                documentos={visor?.docs ?? []}
                indice={visor?.indice ?? null}
                onIndiceChange={(i) => setVisor((prev) => (prev && i !== null ? { ...prev, indice: i } : null))}
                subtitulo={visor?.subtitulo}
            />

            {/* Habilitar y deshabilitar exigen una observación (por qué, con
                qué respaldo); queda en el historial. No se puede cerrar
                mientras se guarda. */}
            <Dialog open={!!cambio} onOpenChange={(open) => { if (!open && guardandoId === null) setCambio(null); }}>
                <DialogContent className="max-w-lg gap-5" showCloseButton={guardandoId === null}>
                    {cambio && (
                        <>
                            <DialogHeader>
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                                        cambio.modo === 'habilitar' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
                                    )}>
                                        {cambio.modo === 'habilitar' ? <IconCircleCheck size={22} /> : <IconBan size={22} />}
                                    </div>
                                    <div className="min-w-0 text-left">
                                        <DialogTitle>{cambio.modo === 'habilitar' ? 'Habilitar competencia' : 'Deshabilitar competencia'}</DialogTitle>
                                        <DialogDescription className="truncate" title={cambio.competencia.nombre_competencia}>
                                            {cambio.competencia.nombre_competencia}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            {cambio.modo === 'deshabilitar' && (
                                <p className="rounded-md bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                                    El muestreador dejará de tener esta competencia.
                                    {(docsPorCompetencia.get(cambio.competencia.id_competencia)?.length ?? 0) > 0 && (
                                        <> Sus <b className="text-foreground">{docsPorCompetencia.get(cambio.competencia.id_competencia)!.length} documento(s)</b> se conservan.</>
                                    )}
                                </p>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label htmlFor="obs-competencia" className="text-sm font-medium text-foreground">
                                    {cambio.modo === 'habilitar' ? 'Observación' : 'Motivo de la deshabilitación'} <span className="text-destructive">*</span>
                                </label>
                                <Textarea
                                    id="obs-competencia"
                                    autoFocus
                                    rows={4}
                                    maxLength={MAX_OBSERVACION}
                                    placeholder={cambio.modo === 'habilitar'
                                        ? 'Ej: Aprobó capacitación y evaluación práctica en terreno el 15-10-2026.'
                                        : 'Ej: Certificado vencido; debe repetir la evaluación práctica.'}
                                    value={observacion}
                                    onChange={(e) => setObservacion(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirmarCambio(); }}
                                    disabled={guardandoId !== null}
                                    className="resize-none"
                                />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Obligatoria. {cambio.modo === 'habilitar' ? 'Indique el motivo o respaldo de la habilitación.' : 'Indique por qué se deshabilita.'}</span>
                                    <span className="tabular-nums">{observacion.length}/{MAX_OBSERVACION}</span>
                                </div>
                            </div>

                            <DialogFooter className="gap-2">
                                <Button variant="outline" onClick={() => setCambio(null)} disabled={guardandoId !== null}>Cancelar</Button>
                                <Button
                                    variant={cambio.modo === 'habilitar' ? 'default' : 'destructive'}
                                    onClick={confirmarCambio}
                                    disabled={guardandoId !== null || !observacion.trim()}
                                >
                                    {guardandoId !== null ? (
                                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                    ) : cambio.modo === 'habilitar' ? <IconCircleCheck size={14} /> : <IconBan size={14} />}
                                    {cambio.modo === 'habilitar' ? 'Habilitar' : 'Deshabilitar'}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Confirmación propia (en vez de window.confirm): muestra el archivo
                que se va a borrar y a qué competencia pertenece. No se puede
                cerrar mientras se está eliminando. */}
            <Dialog open={!!docAEliminar} onOpenChange={(open) => { if (!open && !eliminando) setDocAEliminar(null); }}>
                <DialogContent className="max-w-md gap-5" showCloseButton={!eliminando}>
                    <DialogHeader className="items-center text-center sm:text-center">
                        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                            <IconTrash size={22} />
                        </div>
                        <DialogTitle>¿Eliminar este documento?</DialogTitle>
                        <DialogDescription>Se borrará el archivo de forma permanente. Esta acción no se puede deshacer.</DialogDescription>
                    </DialogHeader>
                    {docAEliminar && (
                        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 p-3">
                            <ArchivoIcono url={urlDocumento(docAEliminar)} size="md" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground" title={docAEliminar.nombre_documento}>{docAEliminar.nombre_documento}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {[
                                        competencias.find((c) => c.id_competencia === docAEliminar.id_competencia)?.nombre_competencia || 'Documento general',
                                        formatFecha(docAEliminar.fecha_subida),
                                    ].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:justify-center">
                        <Button variant="outline" className="sm:min-w-28" onClick={() => setDocAEliminar(null)} disabled={eliminando}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" className="sm:min-w-28" onClick={confirmarEliminar} disabled={eliminando}>
                            {eliminando ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                                <IconTrash size={14} />
                            )}
                            {eliminando ? 'Eliminando...' : 'Eliminar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};

const esArchivoPermitido = (f: File) => f.type === 'application/pdf' || f.type.startsWith('image/');

const formatTamano = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);

// Nombre sugerido para el documento: el del archivo sin la extensión.
const nombreSinExtension = (nombre: string) => nombre.replace(/\.[^.]+$/, '');

interface ArchivoPendiente {
    key: string;
    file: File;
    // Nombre con que se guarda el documento; editable por archivo.
    nombre: string;
    estado: 'pendiente' | 'subiendo' | 'error';
    error?: string;
    // Vista previa local (solo imágenes), para reconocer el archivo antes de subirlo.
    preview?: string;
}

// Zona de subida de una sola competencia: cada panel abierto tiene su propia
// lista de archivos pendientes, así no se mezclan entre competencias. Se
// pueden elegir o arrastrar varios a la vez (y seguir agregando), cada uno con
// su propio nombre; se suben uno tras otro. Los que fallan quedan en la lista
// con su error para reintentar; los que suben bien salen de ella.
const SubirDocumentoCompetencia: React.FC<{
    idMuestreador: number;
    competencia: Competencia;
    onSubido: () => Promise<void>;
}> = ({ idMuestreador, competencia, onSubido }) => {
    const { showToast } = useToast();
    const [pendientes, setPendientes] = useState<ArchivoPendiente[]>([]);
    const [subiendo, setSubiendo] = useState(false);
    const [progreso, setProgreso] = useState<{ hecho: number; total: number } | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Libera las vistas previas al desmontar (cerrar el panel o la ventana).
    const previewsRef = useRef<Set<string>>(new Set());
    useEffect(() => {
        const previews = previewsRef.current;
        return () => previews.forEach((u) => URL.revokeObjectURL(u));
    }, []);

    const liberar = (p: ArchivoPendiente) => {
        if (!p.preview) return;
        URL.revokeObjectURL(p.preview);
        previewsRef.current.delete(p.preview);
    };

    const agregar = (lista: FileList | null) => {
        const todos = Array.from(lista ?? []);
        const validos = todos.filter(esArchivoPermitido);
        if (validos.length < todos.length) showToast({ type: 'error', message: 'Solo se aceptan archivos PDF o imágenes; los demás se omitieron' });
        if (inputRef.current) inputRef.current.value = '';
        if (validos.length === 0) return;
        setPendientes((prev) => {
            // El mismo archivo elegido dos veces no se duplica.
            const yaEstan = new Set(prev.map((p) => p.key));
            const nuevos: ArchivoPendiente[] = [];
            for (const file of validos) {
                const key = `${file.name}-${file.size}-${file.lastModified}`;
                if (yaEstan.has(key)) continue;
                yaEstan.add(key);
                const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
                if (preview) previewsRef.current.add(preview);
                nuevos.push({ key, file, nombre: nombreSinExtension(file.name), estado: 'pendiente', preview });
            }
            return [...prev, ...nuevos];
        });
    };

    const quitar = (key: string) => {
        setPendientes((prev) => {
            const p = prev.find((x) => x.key === key);
            if (p) liberar(p);
            return prev.filter((x) => x.key !== key);
        });
    };

    const quitarTodos = () => {
        pendientes.forEach(liberar);
        setPendientes([]);
    };

    const renombrar = (key: string, nombre: string) => setPendientes((prev) => prev.map((p) => (p.key === key ? { ...p, nombre } : p)));

    const subir = async () => {
        const cola = pendientes;
        if (cola.length === 0) return;
        setSubiendo(true);
        setProgreso({ hecho: 0, total: cola.length });
        let ok = 0;
        for (const p of cola) {
            setPendientes((prev) => prev.map((x) => (x.key === p.key ? { ...x, estado: 'subiendo', error: undefined } : x)));
            try {
                await adminService.uploadDocumentoMuestreador(idMuestreador, p.file, p.nombre.trim() || p.file.name, undefined, competencia.id_competencia);
                ok++;
                liberar(p);
                setPendientes((prev) => prev.filter((x) => x.key !== p.key));
            } catch (err) {
                const mensaje = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo subir este archivo';
                setPendientes((prev) => prev.map((x) => (x.key === p.key ? { ...x, estado: 'error', error: mensaje } : x)));
            }
            setProgreso((prev) => (prev ? { ...prev, hecho: prev.hecho + 1 } : prev));
        }
        setSubiendo(false);
        setProgreso(null);
        if (ok > 0) await onSubido();
        if (ok === cola.length) {
            showToast({ type: 'success', message: ok === 1 ? `Documento agregado a "${competencia.nombre_competencia}"` : `${ok} documentos agregados a "${competencia.nombre_competencia}"` });
        } else {
            showToast({ type: 'error', message: `Se subieron ${ok} de ${cola.length}. Los que fallaron quedaron en la lista para reintentar.` });
        }
    };

    const total = pendientes.length;
    const conError = pendientes.filter((p) => p.estado === 'error').length;

    return (
        <div className="flex flex-col gap-2">
            <input
                ref={inputRef}
                type="file"
                multiple
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => agregar(e.target.files)}
            />
            <div
                role="button"
                tabIndex={0}
                aria-disabled={subiendo}
                onClick={() => !subiendo && inputRef.current?.click()}
                onKeyDown={(e) => { if (!subiendo && (e.key === 'Enter' || e.key === ' ')) inputRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); if (!subiendo) setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); if (!subiendo) agregar(e.dataTransfer.files); }}
                className={cn(
                    'flex items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2.5 transition-colors',
                    subiendo ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                    dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'
                )}
            >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <IconCloudUpload size={16} />
                </div>
                <p className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {total === 0 ? (
                        <><span className="font-medium text-foreground">Arrastre uno o varios archivos aquí</span> o haga clic para seleccionarlos · PDF o imagen</>
                    ) : (
                        <><span className="font-medium text-foreground">Agregar más archivos</span> · arrastre o haga clic</>
                    )}
                </p>
            </div>

            {total > 0 && (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                        <p className="flex items-center gap-2 text-xs">
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{total}</span>
                            <span className="font-medium text-foreground">{total === 1 ? 'Archivo listo para subir' : 'Archivos listos para subir'}</span>
                            <span className="text-muted-foreground">· {formatTamano(pendientes.reduce((s, p) => s + p.file.size, 0))}</span>
                            {conError > 0 && !subiendo && <span className="text-destructive">· {conError} con error</span>}
                        </p>
                        {!subiendo && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive" onClick={quitarTodos}>
                                <IconTrash size={13} /> Quitar todos
                            </Button>
                        )}
                    </div>

                    <ul className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                        {pendientes.map((p) => {
                            const ext = extensionArchivo(p.file.name);
                            return (
                                <li
                                    key={p.key}
                                    className={cn(
                                        'group/pend relative flex items-center gap-3 rounded-lg border bg-background p-2 pr-9 transition-colors',
                                        p.estado === 'error' ? 'border-destructive/50 bg-destructive/5'
                                            : p.estado === 'subiendo' ? 'border-primary/50' : 'border-border hover:border-primary/30',
                                    )}
                                >
                                    {/* Miniatura con borde y fondo para que también se vean las imágenes claras. */}
                                    <div className={cn(
                                        'relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border',
                                        p.preview ? 'border-border bg-muted' : 'border-red-100 bg-red-50 dark:border-red-900/50 dark:bg-red-950/40',
                                    )}>
                                        {p.preview ? (
                                            <img src={p.preview} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <IconFileTypePdf size={22} className="text-red-600 dark:text-red-400" />
                                        )}
                                        {p.preview && ext && (
                                            <span className="absolute inset-x-0 bottom-0 bg-foreground/70 text-center text-[8px] font-bold uppercase leading-3 text-background">{ext}</span>
                                        )}
                                        {p.estado === 'subiendo' && (
                                            <span className="absolute inset-0 flex items-center justify-center bg-background/70">
                                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        {/* Nombre editable "en línea": parece texto y se vuelve campo al pasar o hacer foco. */}
                                        <div className="relative">
                                            <input
                                                className="h-7 w-full rounded-md border border-transparent bg-transparent px-1.5 pr-6 text-sm font-medium text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border focus:border-ring focus:bg-background disabled:opacity-70"
                                                value={p.nombre}
                                                onChange={(e) => renombrar(p.key, e.target.value)}
                                                disabled={subiendo}
                                                placeholder={p.file.name}
                                                title="Nombre con que se guardará el documento"
                                                aria-label={`Nombre del documento para ${p.file.name}`}
                                            />
                                            {!subiendo && (
                                                <IconPencil size={12} className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover/pend:opacity-100" />
                                            )}
                                        </div>
                                        <p className={cn('truncate px-1.5 text-[11px]', p.estado === 'error' ? 'text-destructive' : 'text-muted-foreground')} title={p.error || p.file.name}>
                                            {p.estado === 'error'
                                                ? p.error
                                                : p.estado === 'subiendo'
                                                    ? 'Subiendo...'
                                                    : `${ext ? ext.toUpperCase() : 'Archivo'} · ${formatTamano(p.file.size)}`}
                                        </p>
                                    </div>
                                    {!subiendo && (
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            className="absolute right-1.5 top-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() => quitar(p.key)}
                                            aria-label={`Quitar ${p.file.name}`}
                                            title="Quitar de la lista"
                                        >
                                            <IconX size={14} />
                                        </Button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    {progreso && (
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progreso.hecho / progreso.total) * 100}%` }} />
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-2 px-1">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <IconPencil size={11} /> Haga clic en un nombre para cambiarlo antes de subir.
                        </span>
                        <Button size="sm" onClick={subir} disabled={subiendo}>
                            {subiendo ? (
                                <>
                                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                    Subiendo {progreso ? `${progreso.hecho + 1}/${progreso.total}` : '...'}
                                </>
                            ) : (
                                <><IconUpload size={14} /> {conError > 0 ? 'Reintentar' : 'Adjuntar'}{total > 1 ? ` ${total} archivos` : ''}</>
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
