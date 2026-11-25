import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArchive, IconDownload, IconRefresh, IconAlertTriangle } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatearFechaHoraCorta } from '@/lib/fechas';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { VistaPreviaPdf } from '../components/VistaPreviaPdf';
import { Segmentado } from '../components/quejas-apelaciones/comun';
import { calidadService, mensajeError, type FilaListadoQa, type FiltroEstadoQa, type TipoQa } from '../services/calidad.service';

// G. Calidad → Calidad → Listado de Quejas y Apelaciones (OI-FoGe-06). A la izquierda se eligen el año, el tipo y
// qué casos van; a la derecha se ve el formulario armándose en vivo. Los casos salen de ADLWeb (todos los recibidos);
// los cerrados además quedan copiados en el archivo de ADL-One.

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: 6 }, (_, i) => ANIO_ACTUAL - i);
const fechaDmy = (ymd?: string | null) => (ymd ? ymd.slice(0, 10).split('-').reverse().join('-') : '');

export const GcListadoQaPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { setActiveSubmodule, setPendingQaCasoId } = useNavStore();
    const { showToast } = useToast();
    const ancha = useMediaQuery('(min-width: 1024px)');

    const [anio, setAnio] = useState<number | null>(ANIO_ACTUAL);
    const [tipo, setTipo] = useState<'' | TipoQa>('');
    const [estado, setEstado] = useState<FiltroEstadoQa>('todos');
    const [conEstado, setConEstado] = useState(false);
    const [excluir, setExcluir] = useState<number[]>([]);
    const [filas, setFilas] = useState<FilaListadoQa[]>([]);
    const [fuente, setFuente] = useState<'adlweb' | 'archivo'>('adlweb');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [archivo, setArchivo] = useState<{ total: number; ultima: string | null } | null>(null);
    const [sincronizando, setSincronizando] = useState(false);
    const [descargando, setDescargando] = useState(false);
    const [ampliada, setAmpliada] = useState(false);

    const filtros = useMemo(() => ({ anio, tipo: tipo || null, estado, conEstado, excluir }), [anio, tipo, estado, conEstado, excluir]);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const r = await calidadService.listadoQa({ anio, tipo: tipo || null, estado });
            setFilas(r.filas);
            setFuente(r.fuente);
            setError(null);
        } catch (e) {
            setError(mensajeError(e) || 'No se pudo armar el listado.');
        } finally {
            setCargando(false);
        }
    }, [anio, tipo, estado]);
    useEffect(() => { cargar(); }, [cargar]);
    // Al cambiar de año o filtro, los excluidos de antes ya no aplican.
    useEffect(() => { setExcluir([]); }, [anio, tipo, estado]);

    const cargarArchivo = useCallback(async () => {
        try {
            const r = await calidadService.archivoQa({});
            setArchivo({ total: r.casos.length, ultima: r.ultima_copia });
        } catch { setArchivo(null); }
    }, []);
    useEffect(() => { cargarArchivo(); }, [cargarArchivo]);

    const sincronizar = async () => {
        setSincronizando(true);
        try {
            const r = await calidadService.sincronizarArchivoQa();
            if (r.omitido) showToast({ type: 'warning', message: r.omitido });
            else showToast({ type: 'success', message: r.copiados || r.actualizados ? `Archivo al día: ${r.copiados} copiado(s), ${r.actualizados} actualizado(s).` : 'El archivo ya estaba al día.' });
            await Promise.all([cargarArchivo(), cargar()]);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo sincronizar el archivo.' });
        } finally {
            setSincronizando(false);
        }
    };

    const descargar = async () => {
        setDescargando(true);
        try {
            const pdf = await calidadService.listadoQaPdf(filtros);
            const a = document.createElement('a');
            a.href = pdf.url; a.download = pdf.nombre; a.click();
            setTimeout(() => URL.revokeObjectURL(pdf.url), 4000);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo generar el PDF.' });
        } finally {
            setDescargando(false);
        }
    };

    const incluidas = filas.filter((f) => !excluir.includes(f.id)).length;
    const alternar = (id: number) => setExcluir((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    const generar = useCallback(() => calidadService.listadoQaPdf(filtros), [filtros]);

    return (
        <div className="shadcn-scope flex w-full flex-col gap-4 p-4 md:p-6 lg:h-[calc(100vh-64px)]">
            <PageHeader
                title="Listado de Quejas y Apelaciones"
                subtitle="Formulario OI-FoGe-06: todas las quejas y apelaciones recibidas, internas y externas."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Calidad', onClick: () => setActiveSubmodule('gc-hub-cal') }, { label: 'Listado OI-FoGe-06' }]}
            />

            <div className={cn('grid min-h-0 flex-1 gap-4', ampliada && ancha ? 'lg:grid-cols-[minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
                {/* Izquierda: qué va en el listado */}
                <div className={cn('flex min-h-0 flex-col gap-3', ampliada && ancha && 'hidden')}>
                    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex flex-col gap-1.5">
                            <span className="text-xs font-medium text-muted-foreground">Año de recepción</span>
                            <div className="flex flex-wrap gap-1.5">
                                {ANIOS.map((a) => (
                                    <button key={a} type="button" onClick={() => setAnio(a)}
                                        className={cn('h-8 rounded-md border px-3 text-sm tabular-nums transition-colors', anio === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                                        {a}
                                    </button>
                                ))}
                                <button type="button" onClick={() => setAnio(null)}
                                    className={cn('h-8 rounded-md border px-3 text-sm transition-colors', anio === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                                    Todos
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground">Tipo</span>
                                <Segmentado ariaLabel="Tipo" value={tipo || 'ambos'} onChange={(v) => setTipo(v === 'ambos' ? '' : (v as TipoQa))}
                                    options={[{ value: 'ambos', label: 'Ambos' }, { value: 'queja', label: 'Quejas' }, { value: 'apelacion', label: 'Apelaciones' }]} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-muted-foreground">Estado</span>
                                <Segmentado ariaLabel="Estado" value={estado} onChange={(v) => setEstado(v as FiltroEstadoQa)}
                                    options={[{ value: 'todos', label: 'Todos' }, { value: 'cerrados', label: 'Cerrados' }, { value: 'abiertos', label: 'En curso' }]} />
                            </div>
                        </div>
                        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                            <span>Imprimir el estado de cada caso</span>
                            <Switch checked={conEstado} onCheckedChange={setConEstado} />
                        </label>
                    </section>

                    <section className="flex min-h-[240px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                            <span className="text-sm font-semibold">Casos del listado</span>
                            <Badge variant="secondary" className="tabular-nums">{incluidas} de {filas.length}</Badge>
                        </header>
                        {fuente === 'archivo' && (
                            <p className="flex items-start gap-1.5 border-b border-border bg-warning/10 px-4 py-2 text-xs text-warning">
                                <IconAlertTriangle size={14} className="mt-px shrink-0" /> ADLWeb no responde: se muestran solo los casos cerrados del archivo de ADL-One.
                            </p>
                        )}
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {cargando ? (
                                <div className="flex justify-center p-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                            ) : error ? (
                                <p className="px-4 py-8 text-center text-sm text-destructive">{error}</p>
                            ) : filas.length === 0 ? (
                                <p className="px-4 py-10 text-center text-sm text-muted-foreground">No hay quejas ni apelaciones con estos filtros. El formulario sale con la tabla en blanco.</p>
                            ) : (
                                <ul className="divide-y divide-border">
                                    {filas.map((f) => {
                                        const va = !excluir.includes(f.id);
                                        return (
                                            <li key={f.id} className={cn('flex items-start gap-3 px-4 py-2.5', !va && 'opacity-50')}>
                                                <Checkbox className="mt-0.5" checked={va} onCheckedChange={() => alternar(f.id)} aria-label={`Incluir ${f.folio}`} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <button type="button" className="font-mono text-sm font-semibold hover:underline"
                                                            onClick={() => { setPendingQaCasoId(f.id); setActiveSubmodule(f.tipo === 'apelacion' ? 'gc-apelaciones' : 'gc-quejas'); }}>
                                                            {f.folio || `#${f.id}`}
                                                        </button>
                                                        <span className="text-xs tabular-nums text-muted-foreground">{fechaDmy(f.fecha_recepcion)}</span>
                                                        <Badge variant="outline">{f.tipo === 'apelacion' ? 'Apelación' : 'Queja'}</Badge>
                                                        <Badge variant="outline">{f.origen === 'interno' ? 'Interno' : 'Externo'}</Badge>
                                                        <Badge variant={f.cerrado ? 'success' : 'warning'}>{f.estadoLabel}</Badge>
                                                        {f.archivado && <span title="Copiado en el archivo de ADL-One" className="text-muted-foreground"><IconArchive size={14} /></span>}
                                                    </div>
                                                    <p className="m-0 truncate text-xs text-muted-foreground">{[f.empresa, f.nombre].filter(Boolean).join(' – ')}</p>
                                                    {f.motivo && <p className="m-0 line-clamp-2 text-xs">{f.motivo}</p>}
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </section>

                    <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm">
                        <span className="flex items-center gap-1.5">
                            <IconArchive size={15} />
                            {archivo
                                ? <>Archivo ADL-One: <b className="text-foreground">{archivo.total}</b> {archivo.total === 1 ? 'caso cerrado' : 'casos cerrados'}{archivo.ultima ? ` · última copia ${formatearFechaHoraCorta(archivo.ultima)}` : ''}</>
                                : 'Archivo ADL-One no disponible (falta la migración add_calidad_auditorias.sql).'}
                        </span>
                        <Button type="button" size="sm" variant="outline" onClick={sincronizar} disabled={sincronizando}>
                            <IconRefresh size={14} className={cn(sincronizando && 'animate-spin')} /> {sincronizando ? 'Copiando…' : 'Copiar cerrados ahora'}
                        </Button>
                    </section>
                </div>

                {/* Derecha: el formulario en vivo */}
                <div className="flex min-h-[520px] flex-col gap-2 lg:min-h-0">
                    <VistaPreviaPdf className="flex-1" generar={generar} clave={JSON.stringify(filtros)} ampliada={ampliada} onAmpliar={ancha ? () => setAmpliada((v) => !v) : undefined} />
                    <div className="flex justify-end">
                        <Button onClick={descargar} disabled={descargando}><IconDownload size={16} /> {descargando ? 'Generando…' : 'Descargar PDF'}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GcListadoQaPage;
