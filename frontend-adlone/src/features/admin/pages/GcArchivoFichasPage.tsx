import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconSearch, IconFileTypePdf, IconDownload, IconBan, IconRefresh, IconArchive, IconSignature, IconX } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { cn } from '@/lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import PdfViewerModal from '../../facturacion/components/PdfViewerModal';
import {
    fichasEquipoService as api,
    type FichaArchivo,
    type AnioArchivo,
    type TipoFichaGuardada,
    type EstadoFichaArchivo,
} from '../services/fichasEquipo.service';

interface Props {
    onBack: () => void;
}

// Archivo de las fichas de equipo guardadas (OI-FoGe-22/24/36/42) de todos los
// equipos. Cada ficha vale para el año en que se emitió (el historial, para el
// año que cubre), así se consulta "las fichas técnicas del 2026" aunque el
// equipo haya cambiado después.
const TIPOS: { value: TipoFichaGuardada; label: string; formato: string }[] = [
    { value: 'tecnica', label: 'Ficha técnica', formato: 'OI-FoGe-22' },
    { value: 'historial', label: 'Historial', formato: 'OI-FoGe-24' },
    { value: 'entrega', label: 'Ficha de entrega', formato: 'OI-FoGe-36' },
    { value: 'recepcion', label: 'Recepción y puesta en marcha', formato: 'OI-FoGe-42' },
];
const SEDES = ['PM', 'VI', 'AY', 'PA'];
const ESTADOS: { value: EstadoFichaArchivo; label: string }[] = [
    { value: 'VIGENTE', label: 'Vigentes' },
    { value: 'ANULADO', label: 'Anuladas' },
    { value: 'TODOS', label: 'Todas' },
];

const fechaHora = (v: string | null | undefined) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const soloFecha = (v: string | null | undefined) => {
    if (!v) return '';
    const s = String(v).slice(0, 10);
    const [a, m, d] = s.split('-');
    return a && m && d ? `${d}/${m}/${a}` : s;
};
const tamano = (b: number | null) => (b ? (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`) : '');

export const GcArchivoFichasPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    const puedeAnular = hasPermission('AI_MA_EDITAR_EQUIPO') || hasPermission('GC_EQUIPOS');

    const [anios, setAnios] = useState<AnioArchivo[]>([]);
    const [anio, setAnio] = useState<number | null>(null);
    const [tipo, setTipo] = useState<TipoFichaGuardada | ''>('');
    const [sede, setSede] = useState('');
    const [estado, setEstado] = useState<EstadoFichaArchivo>('VIGENTE');
    const [busqueda, setBusqueda] = useState('');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [fichas, setFichas] = useState<FichaArchivo[]>([]);
    const [total, setTotal] = useState(0);
    const [disponible, setDisponible] = useState(true);
    const [cargando, setCargando] = useState(false);
    const [pdf, setPdf] = useState<{ url: string; titulo: string } | null>(null);
    const [aAnular, setAAnular] = useState<FichaArchivo | null>(null);
    const [motivo, setMotivo] = useState('');
    const [anulando, setAnulando] = useState(false);

    // La búsqueda se aplica un momento después de dejar de escribir.
    useEffect(() => {
        const t = setTimeout(() => { setQ(busqueda.trim()); setPage(1); }, 350);
        return () => clearTimeout(t);
    }, [busqueda]);

    const cargarAnios = useCallback(async () => {
        try {
            const r = await api.archivoAnios();
            setAnios(r.anios);
        } catch { /* los filtros por año son opcionales */ }
    }, []);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const r = await api.archivo({ tipo: tipo || undefined, anio: anio ?? undefined, sede: sede || undefined, estado, q: q || undefined, page, limit });
            setDisponible(r.disponible);
            setFichas(r.fichas);
            setTotal(r.total);
        } catch (err) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: msg || 'No se pudo leer el archivo de fichas' });
        } finally {
            setCargando(false);
        }
    }, [tipo, anio, sede, estado, q, page, limit, showToast]);

    useEffect(() => { cargarAnios(); }, [cargarAnios]);
    useEffect(() => { cargar(); }, [cargar]);

    const cambiar = <T,>(set: React.Dispatch<React.SetStateAction<T>>) => (v: T) => { set(v); setPage(1); };

    const verPdf = async (f: FichaArchivo) => {
        try {
            const r = await api.guardadaPdf(f.id_ficha);
            setPdf({ url: r.url, titulo: `${f.formato} · ${f.codigo_equipo ?? ''}${f.anio ? ` · ${f.anio}` : ''}` });
        } catch {
            showToast({ type: 'error', message: 'No se pudo abrir el PDF' });
        }
    };

    const descargar = async (f: FichaArchivo) => {
        try {
            const r = await api.guardadaPdf(f.id_ficha);
            const a = document.createElement('a');
            a.href = r.url;
            a.download = r.nombre || f.nombre_archivo;
            a.click();
            setTimeout(() => URL.revokeObjectURL(r.url), 10_000);
        } catch {
            showToast({ type: 'error', message: 'No se pudo descargar el PDF' });
        }
    };

    const anular = async () => {
        if (!aAnular || !motivo.trim()) return;
        setAnulando(true);
        try {
            await api.anularGuardada(aAnular.id_ficha, motivo.trim());
            showToast({ type: 'success', message: `Ficha ${aAnular.formato} de ${aAnular.codigo_equipo ?? ''} anulada` });
            setAAnular(null);
            setMotivo('');
            cargar();
            cargarAnios();
        } catch (err) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: msg || 'No se pudo anular la ficha' });
        } finally {
            setAnulando(false);
        }
    };

    const resumenAnio = useMemo(() => anios.find((a) => a.anio === anio) ?? null, [anios, anio]);
    const hayFiltros = !!(anio || tipo || sede || q || estado !== 'VIGENTE');
    const limpiar = () => { setAnio(null); setTipo(''); setSede(''); setEstado('VIGENTE'); setBusqueda(''); setQ(''); setPage(1); };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Archivo de fichas de equipo"
                subtitle="Fichas guardadas (OI-FoGe-22 / 24 / 36 / 42) de todos los equipos, consultables por año de vigencia."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Gestión de Calidad', onClick: onBack }, { label: 'Archivo de fichas' }]}
                rightSection={(
                    <Button variant="outline" onClick={() => { cargar(); cargarAnios(); }} disabled={cargando}>
                        <IconRefresh size={16} className={cn(cargando && 'animate-spin')} /> Actualizar
                    </Button>
                )}
            />

            {/* Años con fichas: un clic filtra todo el archivo por ese año. */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => cambiar(setAnio)(null)}
                    className={cn('rounded-full border px-3 py-1 text-sm font-medium transition-colors', anio === null ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted')}
                >
                    Todos los años
                </button>
                {anios.map((a) => (
                    <button
                        key={a.anio}
                        type="button"
                        onClick={() => cambiar(setAnio)(a.anio)}
                        className={cn('flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium tabular-nums transition-colors', anio === a.anio ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted')}
                        title={TIPOS.map((t) => `${t.label}: ${a.por_tipo[t.value] ?? 0}`).join(' · ')}
                    >
                        {a.anio}
                        <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{a.total}</span>
                    </button>
                ))}
                {anios.length === 0 && disponible && (
                    <span className="text-sm text-muted-foreground">Todavía no hay fichas guardadas. Se guardan desde el equipo con el botón «Guardar» de cada ficha.</span>
                )}
            </div>

            <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-64">
                    <p className="mb-1 text-xs text-muted-foreground">Formulario</p>
                    <Combobox
                        value={tipo}
                        onValueChange={(v) => cambiar(setTipo)(v as TipoFichaGuardada | '')}
                        options={[{ value: '', label: 'Todos los formularios' }, ...TIPOS.map((t) => ({ value: t.value, label: `${t.formato} · ${t.label}` }))]}
                        placeholder="Formulario"
                    />
                </div>
                <div className="w-36">
                    <p className="mb-1 text-xs text-muted-foreground">Sede</p>
                    <Combobox value={sede} onValueChange={cambiar(setSede)} options={[{ value: '', label: 'Todas' }, ...SEDES.map((s) => ({ value: s, label: s }))]} placeholder="Sede" />
                </div>
                <div className="w-36">
                    <p className="mb-1 text-xs text-muted-foreground">Estado</p>
                    <Combobox value={estado} onValueChange={(v) => cambiar(setEstado)(v as EstadoFichaArchivo)} options={ESTADOS} placeholder="Estado" />
                </div>
                <div className="relative min-w-[240px] flex-1">
                    <p className="mb-1 text-xs text-muted-foreground">Buscar</p>
                    <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-[30px] text-muted-foreground" />
                    <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Código o nombre del equipo, quién la guardó…" className="pl-8" />
                </div>
                {hayFiltros && (
                    <Button variant="ghost" onClick={limpiar}><IconX size={15} /> Limpiar</Button>
                )}
            </div>

            {resumenAnio && (
                <div className="mb-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Vigentes en {resumenAnio.anio}:</span>
                    {TIPOS.map((t) => (
                        <Badge key={t.value} variant="outline" className="font-normal">{t.label}: {resumenAnio.por_tipo[t.value] ?? 0}</Badge>
                    ))}
                </div>
            )}

            {!disponible && (
                <div className="mb-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
                    Falta ejecutar la migración <code>add_gc_documentos.sql</code> en la base de datos para guardar y consultar fichas.
                </div>
            )}

            <div className="rounded-md border border-border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Formulario</TableHead>
                            <TableHead>Equipo</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead className="text-center">Año</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Guardada por</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {fichas.map((f) => {
                            const t = TIPOS.find((x) => x.value === f.tipo);
                            const anulada = f.estado === 'ANULADO';
                            return (
                                <TableRow key={f.id_ficha} className={cn('cursor-pointer', anulada && 'opacity-60')} onClick={() => verPdf(f)}>
                                    <TableCell>
                                        <p className="font-semibold">{f.formato}</p>
                                        <p className="text-xs text-muted-foreground">{t?.label ?? f.nombre_formulario ?? ''}</p>
                                    </TableCell>
                                    <TableCell>
                                        <p className="font-semibold">{f.codigo_equipo ?? <span className="text-muted-foreground">(equipo en creación)</span>}</p>
                                        <p className="max-w-[260px] truncate text-xs text-muted-foreground">{f.nombre_equipo}</p>
                                    </TableCell>
                                    <TableCell>{f.sede ? <Badge variant="outline">{f.sede}</Badge> : null}</TableCell>
                                    <TableCell className="text-center font-medium tabular-nums">{f.anio ?? '—'}</TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">
                                        <p>{soloFecha(f.fecha_documento)}</p>
                                        <p className="text-xs text-muted-foreground">{fechaHora(f.fecha_creacion)}</p>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        <p>{f.nombre_usuario ?? '—'}</p>
                                        <p className="text-xs text-muted-foreground">{tamano(f.tamano_bytes)}{f.con_firmas ? ' · con firmas' : ''}</p>
                                    </TableCell>
                                    <TableCell>
                                        {anulada
                                            ? <Badge variant="destructive" title={f.motivo_anulacion ? `${f.motivo_anulacion} (${fechaHora(f.fecha_anulacion)})` : ''}>Anulada</Badge>
                                            : <Badge variant="success">Vigente</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => verPdf(f)} title="Ver PDF">
                                                <IconFileTypePdf size={16} className="text-red-600" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => descargar(f)} title="Descargar PDF">
                                                <IconDownload size={16} className="text-muted-foreground" />
                                            </Button>
                                            {puedeAnular && !anulada && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { setAAnular(f); setMotivo(''); }} title="Anular esta ficha (queda registrada como anulada)">
                                                    <IconBan size={16} />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                {!cargando && fichas.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-12 text-center">
                        <IconArchive size={28} className="text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">
                            {hayFiltros ? 'Ninguna ficha coincide con los filtros.' : 'Aún no hay fichas guardadas en el archivo.'}
                        </p>
                    </div>
                )}
                {total > 0 && (
                    <DataPagination className="border-t border-border px-3 py-2" page={page} pageSize={limit} total={total} onPageChange={setPage} onPageSizeChange={(n) => { setLimit(n); setPage(1); }} />
                )}
            </div>

            <PdfViewerModal open={!!pdf} onClose={() => setPdf(null)} url={pdf?.url ?? null} title={pdf?.titulo} />

            <Dialog open={!!aAnular} onOpenChange={(o) => { if (!o && !anulando) setAAnular(null); }}>
                <DialogContent className="shadcn-scope sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><IconBan size={18} className="text-destructive" /> Anular ficha guardada</DialogTitle>
                        <DialogDescription>
                            {aAnular?.formato} de {aAnular?.codigo_equipo ?? 'equipo en creación'}{aAnular?.anio ? ` (año ${aAnular.anio})` : ''}, guardada el {fechaHora(aAnular?.fecha_creacion)}.
                            Queda registrada como anulada y el PDF se conserva; no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <div>
                        <p className="mb-1 text-xs text-muted-foreground">Motivo (obligatorio)</p>
                        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={300} placeholder="Por qué se anula esta ficha…" autoFocus />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAAnular(null)} disabled={anulando}>Cancelar</Button>
                        <Button variant="destructive" onClick={anular} disabled={anulando || !motivo.trim()}>
                            <IconSignature size={15} /> {anulando ? 'Anulando…' : 'Anular ficha'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default GcArchivoFichasPage;
