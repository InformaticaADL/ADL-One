import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconDownload, IconDeviceFloppy, IconPlus, IconLock, IconClipboardCheck, IconArrowRight } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { VistaPreviaPdf } from '../components/VistaPreviaPdf';
import { calidadService, mensajeError, type AuditoriaRow, type ElementoIso, type Programa } from '../services/calidad.service';

const MES_NOMBRE = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ESTADO_AUDITORIA: Record<string, 'warning' | 'secondary' | 'success' | 'destructive'> = { PLANIFICADA: 'secondary', EN_CURSO: 'warning', CERRADA: 'success', ANULADA: 'destructive' };

// G. Calidad → Calidad → Programa Anual de Auditorías Internas (OI-FoGe-07). A la izquierda, una grilla de
// elemento × mes para marcar cuándo se audita cada uno; a la derecha, el formulario en vivo. Un mes ya tomado por
// una auditoría creada (fase 3) queda bloqueado: solo se libera anulando esa auditoría.

const MESES = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = Array.from({ length: 4 }, (_, i) => ANIO_ACTUAL - 1 + i);

const COLOR_ESTADO: Record<string, string> = {
    REALIZADA: 'bg-success text-white',
    REPROGRAMADA: 'bg-warning text-white',
    CANCELADA: 'bg-muted-foreground/40 text-white',
};

export const GcProgramaAuditoriaPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
    const { setActiveSubmodule, setPendingAuditoriaId } = useNavStore();
    const { showToast } = useToast();
    const ancha = useMediaQuery('(min-width: 1024px)');

    const [anio, setAnio] = useState(ANIO_ACTUAL);
    const [programa, setPrograma] = useState<Programa | null>(null);
    const [elementos, setElementos] = useState<ElementoIso[]>([]);
    const [auditorias, setAuditorias] = useState<AuditoriaRow[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [marcas, setMarcas] = useState<Record<number, Set<number>>>({});
    const [observaciones, setObservaciones] = useState('');
    const [guardando, setGuardando] = useState(false);
    const [sucio, setSucio] = useState(false);
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevaRef, setNuevaRef] = useState('');
    const [agregando, setAgregando] = useState(false);
    const [ampliada, setAmpliada] = useState(false);
    const [creandoItem, setCreandoItem] = useState<number | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [p, els, auds] = await Promise.all([calidadService.programa(anio), calidadService.elementosIso(), calidadService.listarAuditorias(anio)]);
            setPrograma(p);
            setElementos(els);
            setAuditorias(auds);
            setObservaciones(p.observaciones || '');
            const m: Record<number, Set<number>> = {};
            for (const f of p.filas) m[f.id_elemento] = new Set(Object.keys(f.meses).map(Number));
            setMarcas(m);
            setSucio(false);
            setError(null);
        } catch (e) {
            setError(mensajeError(e) || 'No se pudo cargar el programa.');
        } finally {
            setCargando(false);
        }
    }, [anio]);
    useEffect(() => { cargar(); }, [cargar]);

    const irAAuditoria = (id: number) => { setPendingAuditoriaId(id); setActiveSubmodule('gc-auditorias'); };

    const pendientesDeAuditoria = useMemo(() => {
        const out: { id_item: number; mes: number; elemento: string; referencia: string | null }[] = [];
        for (const f of programa?.filas || []) {
            for (const [mesStr, info] of Object.entries(f.meses)) {
                if (!info.id_auditoria && info.id_item) out.push({ id_item: info.id_item, mes: Number(mesStr), elemento: f.nombre, referencia: f.referencia });
            }
        }
        return out.sort((a, b) => a.mes - b.mes);
    }, [programa]);

    const crearDesdeItem = async (idItem: number) => {
        setCreandoItem(idItem);
        try {
            const r = await calidadService.crearAuditoriaDesdeItem(idItem);
            showToast({ type: 'success', message: `Auditoría ${r.folio} creada.` });
            irAAuditoria(r.id_auditoria);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo crear la auditoría.' });
        } finally {
            setCreandoItem(null);
        }
    };

    const filaPorElemento = useMemo(() => new Map((programa?.filas || []).map((f) => [f.id_elemento, f])), [programa]);

    const alternar = (idElemento: number, mes: number) => {
        const bloqueo = filaPorElemento.get(idElemento)?.meses?.[mes]?.id_auditoria;
        if (bloqueo) {
            showToast({ type: 'warning', message: 'Este mes ya tiene una auditoría creada; anúlela para poder cambiarlo.' });
            return;
        }
        setMarcas((prev) => {
            const actual = new Set(prev[idElemento] || []);
            if (actual.has(mes)) actual.delete(mes); else actual.add(mes);
            return { ...prev, [idElemento]: actual };
        });
        setSucio(true);
    };

    const guardar = async () => {
        setGuardando(true);
        try {
            const meses: Record<number, number[]> = {};
            for (const e of elementos) meses[e.id_elemento] = [...(marcas[e.id_elemento] || [])];
            const r = await calidadService.guardarPrograma(anio, { meses, observaciones });
            if (r.bloqueados.length) {
                showToast({ type: 'warning', message: `No se pudieron desmarcar ${r.bloqueados.length} mes(es) con auditoría creada.` });
            } else {
                showToast({ type: 'success', message: 'Programa guardado.' });
            }
            await cargar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar el programa.' });
        } finally {
            setGuardando(false);
        }
    };

    const agregarElemento = async () => {
        if (!nuevoNombre.trim()) return;
        setAgregando(true);
        try {
            await calidadService.crearElementoIso({ nombre: nuevoNombre.trim(), referencia: nuevaRef.trim() || undefined });
            setNuevoNombre(''); setNuevaRef('');
            await cargar();
            showToast({ type: 'success', message: 'Elemento agregado.' });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo agregar el elemento.' });
        } finally {
            setAgregando(false);
        }
    };

    const generar = useCallback(async () => {
        const meses: Record<number, number[]> = {};
        for (const e of elementos) meses[e.id_elemento] = [...(marcas[e.id_elemento] || [])];
        const url = await calidadService.programaVistaPreviaUrl(anio, { meses, observaciones });
        return { url, nombre: `OI-FoGe-07 Programa Anual de Auditorías Internas ${anio}.pdf` };
    }, [anio, elementos, marcas, observaciones]);
    const descargar = async () => {
        try {
            const pdf = await calidadService.programaPdf(anio);
            const a = document.createElement('a'); a.href = pdf.url; a.download = pdf.nombre; a.click();
            setTimeout(() => URL.revokeObjectURL(pdf.url), 4000);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo generar el PDF.' });
        }
    };

    return (
        <div className="shadcn-scope flex w-full flex-col gap-4 p-4 md:p-6 lg:h-[calc(100vh-64px)]">
            <PageHeader
                title="Programa Anual de Auditorías Internas"
                subtitle="Formulario OI-FoGe-07: qué elemento del sistema de calidad se audita cada mes."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Calidad', onClick: () => setActiveSubmodule('gc-hub-cal') }, { label: 'Programa Anual OI-FoGe-07' }]}
            />

            <div className={cn('grid min-h-0 flex-1 gap-4', ampliada && ancha ? 'lg:grid-cols-[minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)]')}>
                <div className={cn('flex min-h-0 flex-col gap-3', ampliada && ancha && 'hidden')}>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                        <div className="flex gap-1.5">
                            {ANIOS.map((a) => (
                                <button key={a} type="button" onClick={() => setAnio(a)}
                                    className={cn('h-8 rounded-md border px-3 text-sm tabular-nums transition-colors', anio === a ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}>
                                    {a}
                                </button>
                            ))}
                        </div>
                        <Button size="sm" onClick={guardar} disabled={!sucio || guardando}>
                            <IconDeviceFloppy size={15} /> {guardando ? 'Guardando…' : 'Guardar programa'}
                        </Button>
                    </div>

                    <section className="flex min-h-[260px] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        <header className="border-b border-border px-4 py-2.5 text-sm font-semibold">Elementos del sistema de calidad</header>
                        {cargando ? (
                            <div className="flex justify-center p-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
                        ) : error ? (
                            <p className="px-4 py-8 text-center text-sm text-destructive">{error}</p>
                        ) : (
                            <div className="min-h-0 flex-1 overflow-auto">
                                <table className="w-full border-collapse text-xs">
                                    <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
                                        <tr>
                                            <th className="w-12 border-b border-r border-border p-1.5 text-left font-medium">Ref.</th>
                                            <th className="min-w-[180px] border-b border-r border-border p-1.5 text-left font-medium">Elemento</th>
                                            {MESES.map((m, i) => <th key={i} className="w-7 border-b border-r border-border p-1 text-center font-medium">{m}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {elementos.map((e) => (
                                            <tr key={e.id_elemento} className="hover:bg-muted/40">
                                                <td className="border-b border-r border-border p-1.5 text-muted-foreground">{e.referencia}</td>
                                                <td className="border-b border-r border-border p-1.5">{e.nombre}</td>
                                                {MESES.map((_, i) => {
                                                    const mes = i + 1;
                                                    const marca = filaPorElemento.get(e.id_elemento)?.meses?.[mes];
                                                    const marcado = marcas[e.id_elemento]?.has(mes);
                                                    const bloqueado = !!marca?.id_auditoria;
                                                    return (
                                                        <td key={mes} className="border-b border-r border-border p-0.5 text-center">
                                                            <button type="button" disabled={bloqueado} onClick={() => alternar(e.id_elemento, mes)}
                                                                title={bloqueado ? `Tomado por la auditoría #${marca?.id_auditoria}` : undefined}
                                                                className={cn('flex h-6 w-6 items-center justify-center rounded transition-colors',
                                                                    marcado ? (bloqueado ? COLOR_ESTADO[marca?.estado || ''] || 'bg-primary text-primary-foreground' : 'bg-primary text-primary-foreground')
                                                                        : 'hover:bg-muted', bloqueado && 'cursor-not-allowed')}>
                                                                {bloqueado ? <IconLock size={11} /> : marcado ? '✓' : ''}
                                                            </button>
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div className="flex items-center gap-2 border-t border-border p-2">
                                    <Input placeholder="Ref. (opcional)" className="h-8 w-24 text-xs" value={nuevaRef} onChange={(e) => setNuevaRef(e.target.value)} />
                                    <Input placeholder="Nuevo elemento del sistema de calidad" className="h-8 flex-1 text-xs" value={nuevoNombre}
                                        onChange={(e) => setNuevoNombre(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') agregarElemento(); }} />
                                    <Button size="sm" variant="outline" onClick={agregarElemento} disabled={!nuevoNombre.trim() || agregando}>
                                        <IconPlus size={14} /> Agregar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </section>

                    {(pendientesDeAuditoria.length > 0 || auditorias.length > 0) && (
                        <section className="flex max-h-[220px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                            <header className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-sm font-semibold">
                                <IconClipboardCheck size={15} /> Auditorías de {anio}
                            </header>
                            <div className="min-h-0 flex-1 overflow-y-auto">
                                {pendientesDeAuditoria.length > 0 && (
                                    <div className="flex flex-col divide-y divide-border border-b border-border">
                                        {pendientesDeAuditoria.map((p) => (
                                            <div key={p.id_item} className="flex items-center justify-between gap-2 px-4 py-2">
                                                <span className="text-xs"><b>{MES_NOMBRE[p.mes - 1]}</b> · {p.referencia ? `${p.referencia} ` : ''}{p.elemento}</span>
                                                <Button size="sm" variant="outline" className="h-7 shrink-0 text-xs" disabled={creandoItem === p.id_item}
                                                    onClick={() => crearDesdeItem(p.id_item)}>
                                                    {creandoItem === p.id_item ? 'Creando…' : <>Crear auditoría <IconArrowRight size={13} /></>}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {auditorias.map((a) => (
                                    <button key={a.id_auditoria} type="button" onClick={() => irAAuditoria(a.id_auditoria)}
                                        className="flex w-full items-center justify-between gap-2 border-b border-border px-4 py-2 text-left text-xs transition-colors last:border-0 hover:bg-muted">
                                        <span className="flex items-center gap-2">
                                            <span className="font-mono font-semibold">{a.folio}</span>
                                            {a.mes && <span className="text-muted-foreground">{MES_NOMBRE[a.mes - 1]}</span>}
                                            {a.no_conformidades > 0 && <Badge variant="destructive">{a.no_conformidades} NC</Badge>}
                                        </span>
                                        <Badge variant={ESTADO_AUDITORIA[a.estado] || 'secondary'}>{a.estado.replace('_', ' ')}</Badge>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="rounded-xl border border-border bg-card p-3 shadow-sm">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Observaciones</label>
                        <Textarea rows={2} value={observaciones} onChange={(e) => { setObservaciones(e.target.value); setSucio(true); }} placeholder="Notas sobre el programa de este año (opcional)." />
                    </section>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="gap-1"><span className="h-2 w-2 rounded-full bg-success" /> Realizada</Badge>
                        <Badge variant="outline" className="gap-1"><span className="h-2 w-2 rounded-full bg-warning" /> Reprogramada</Badge>
                        <Badge variant="outline" className="gap-1"><IconLock size={11} /> Con auditoría creada</Badge>
                    </div>
                </div>

                <div className="flex min-h-[520px] flex-col gap-2 lg:min-h-0">
                    <VistaPreviaPdf className="flex-1" generar={generar} clave={`${anio}:${JSON.stringify(marcas, (_, v) => (v instanceof Set ? [...v] : v))}:${observaciones}`}
                        ampliada={ampliada} onAmpliar={ancha ? () => setAmpliada((v) => !v) : undefined} />
                    <div className="flex justify-end"><Button onClick={descargar}><IconDownload size={16} /> Descargar PDF</Button></div>
                </div>
            </div>
        </div>
    );
};

export default GcProgramaAuditoriaPage;
