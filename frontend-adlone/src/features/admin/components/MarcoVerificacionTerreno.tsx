import React, { useCallback, useEffect, useState } from 'react';
import { IconDeviceFloppy, IconBan, IconCircleCheck, IconSearch } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useToast } from '../../../contexts/ToastContext';
import { CampoFirma } from './CampoFirma';
import { VistaPreviaPdf } from './VistaPreviaPdf';
import {
    verificacionTerrenoService as svc, mensajeError,
    type TipoFormulario, type FilaListado, type Formulario, type ItemsApi, type MuestreoListado, type Muestreo,
} from '../services/verificacionTerreno.service';

// Armazón de los tres formularios de terreno: a la izquierda la lista y el formulario, a la derecha el
// mismo PDF que se descarga, regenerándose mientras se escribe. Cada página pone sus campos en `children`.

const ESTADO_VARIANT = { BORRADOR: 'warning', FIRMADA: 'success', ANULADA: 'destructive' } as const;

interface Props {
    tipo: TipoFormulario;
    titulo: string;
    subtitulo: string;
    onBack: () => void;
    /** Solo consulta: no se eligen muestreos ni se crea nada, y lo abierto no se edita. */
    soloVista?: boolean;
    /** Aviso que explica por qué está en solo consulta. */
    avisoSoloVista?: string;
    /** Los campos propios del formulario; recibe lo cargado y cómo cambiarlo. */
    children: (ctx: {
        datos: Formulario;
        items: ItemsApi;
        editable: boolean;
        set: (cambios: Partial<Formulario>) => void;
    }) => React.ReactNode;
}

export const MarcoVerificacionTerreno: React.FC<Props> = ({ tipo, titulo, subtitulo, onBack, soloVista = false, avisoSoloVista, children }) => {
    const { setActiveSubmodule } = useNavStore();
    const { showToast } = useToast();
    const [lista, setLista] = useState<FilaListado[]>([]);
    const [items, setItems] = useState<ItemsApi | null>(null);
    const [elegido, setElegido] = useState<number | null>(null);
    const [datos, setDatos] = useState<Formulario | null>(null);
    const [refMuestreo, setRefMuestreo] = useState<Muestreo | null>(null);
    const [muestreos, setMuestreos] = useState<MuestreoListado[]>([]);
    const [busqueda, setBusqueda] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [creando, setCreando] = useState<number | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [firmando, setFirmando] = useState(false);
    const [firma, setFirma] = useState<{ nombre: string; imagen: string | null }>({ nombre: '', imagen: null });
    const [anulando, setAnulando] = useState(false);
    const [motivo, setMotivo] = useState('');

    const cargarLista = useCallback(async () => {
        try { setLista(await svc.listar(tipo)); } catch { /* lista vacía */ }
    }, [tipo]);

    useEffect(() => { cargarLista(); }, [cargarLista]);
    useEffect(() => {
        if (soloVista) return;
        let vigente = true;
        setBuscando(true);
        const t = setTimeout(() => {
            svc.muestreos(tipo, busqueda.trim())
                .then((m) => { if (vigente) setMuestreos(m); })
                .catch(() => { if (vigente) setMuestreos([]); })
                .finally(() => { if (vigente) setBuscando(false); });
        }, 300);
        return () => { vigente = false; clearTimeout(t); };
    }, [tipo, busqueda, soloVista]);
    useEffect(() => { svc.items().then(setItems).catch(() => { /* sin ítems no se puede marcar */ }); }, []);

    useEffect(() => {
        if (!elegido) { setDatos(null); return; }
        let vigente = true;
        svc.obtener(tipo, elegido)
            .then((d) => {
                if (!vigente) return;
                setDatos(d);
                setRefMuestreo(null);
                if (d.folio_foma) {
                    svc.previo(tipo, d.folio_foma)
                        .then((r) => { if (vigente) setRefMuestreo(r.muestreo); })
                        .catch(() => { /* sin referencia, el formulario funciona igual */ });
                }
            })
            .catch((e) => showToast({ type: 'error', message: mensajeError(e) || 'No se pudo abrir el formulario.' }));
        return () => { vigente = false; };
    }, [tipo, elegido, showToast]);

    /** Un solo gesto: se elige el muestreo y el formulario aparece; si no existía, se crea con sus datos. */
    const abrir = async (folio: number) => {
        setCreando(folio);
        try {
            const r = await svc.abrir(tipo, folio);
            if (r.creado) {
                showToast({ type: 'success', message: `Formulario del folio ${r.folio} listo con los datos del muestreo.` });
                await cargarLista();
                setMuestreos((m) => m.map((x) => (x.folio === folio
                    ? { ...x, hechos: x.hechos + 1, id_formulario: r.id, estado_formulario: 'BORRADOR' as const }
                    : x)));
            }
            setElegido(r.id);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo abrir el formulario.' });
        } finally {
            setCreando(null);
        }
    };

    const idDe = (d: Formulario) => d.id_verificacion ?? d.id_lista ?? 0;
    const editable = !soloVista && datos?.estado === 'BORRADOR';
    const set = (cambios: Partial<Formulario>) => setDatos((d) => (d ? { ...d, ...cambios } : d));

    const guardar = async () => {
        if (!datos) return;
        setGuardando(true);
        try {
            await svc.guardar(tipo, idDe(datos), datos);
            showToast({ type: 'success', message: 'Formulario guardado.' });
            await cargarLista();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo guardar.' });
        } finally {
            setGuardando(false);
        }
    };

    const confirmarFirma = async () => {
        if (!datos) return;
        try {
            await svc.guardar(tipo, idDe(datos), datos);
            await svc.firmar(tipo, idDe(datos), { nombre: firma.nombre, firma: firma.imagen });
            showToast({ type: 'success', message: 'Formulario firmado.' });
            setFirmando(false);
            await cargarLista();
            setDatos(await svc.obtener(tipo, idDe(datos)));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo firmar.' });
        }
    };

    const confirmarAnulacion = async () => {
        if (!datos) return;
        try {
            await svc.anular(tipo, idDe(datos), motivo);
            showToast({ type: 'success', message: 'Formulario anulado.' });
            setAnulando(false);
            setMotivo('');
            await cargarLista();
            setDatos(await svc.obtener(tipo, idDe(datos)));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo anular.' });
        }
    };

    return (
        <div className="shadcn-scope flex w-full flex-col gap-4 p-4 md:p-6 lg:h-[calc(100vh-64px)]">
            <PageHeader
                title={titulo}
                subtitle={subtitulo}
                onBack={onBack}
                breadcrumbItems={[{ label: 'G.C. MAM', onClick: () => setActiveSubmodule('gc-hub-mam') }, { label: titulo }]}
            />
            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
                {/* Izquierda: crear desde el folio, lista y formulario */}
                <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
                    {soloVista ? (
                        <section className="shrink-0 rounded-xl border border-dashed border-border bg-muted/30 p-3">
                            <p className="text-xs font-medium">Solo consulta</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                                {avisoSoloVista || "Este formulario todavía no se completa desde aquí."}
                            </p>
                        </section>
                    ) : (
                    <section className="shrink-0 rounded-xl border border-border bg-card shadow-sm">
                        <div className="border-b border-border p-2">
                            <div className="relative">
                                <IconSearch size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    placeholder="Buscar por folio, empresa o punto"
                                    className="h-8 pl-7 text-xs"
                                />
                            </div>
                        </div>
                        <p className="px-3 py-1.5 text-[11px] text-muted-foreground">
                            {buscando ? 'Buscando…' : `Muestreos a verificar (${muestreos.length})`}
                        </p>
                        <div className="max-h-56 divide-y divide-border overflow-y-auto">
                            {!buscando && muestreos.length === 0 && (
                                <p className="p-3 text-xs text-muted-foreground">
                                    {busqueda ? 'Ningún muestreo coincide con la búsqueda.' : 'No hay muestreos que usen este equipo.'}
                                </p>
                            )}
                            {muestreos.map((m) => (
                                <button
                                    key={m.folio}
                                    type="button"
                                    onClick={() => abrir(m.folio)}
                                    disabled={creando !== null}
                                    className={cn('flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted/60 disabled:opacity-60',
                                        m.id_formulario && elegido === m.id_formulario && 'bg-muted')}
                                >
                                    <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                                        Folio {m.folio}
                                        {m.estado_formulario
                                            ? <Badge variant={ESTADO_VARIANT[m.estado_formulario]} className="text-[10px]">{m.estado_formulario}</Badge>
                                            : <span className="text-[10px] font-normal text-muted-foreground">sin iniciar</span>}
                                    </span>
                                    <span className="truncate text-[11px] text-muted-foreground" title={`${m.empresa || ''} · ${m.punto || ''}`}>
                                        {m.empresa || 'Sin empresa'}{m.punto ? ` · ${m.punto}` : ''}
                                    </span>
                                    <span className="truncate text-[11px] text-muted-foreground">
                                        {m.fecha}{m.hora ? ` ${m.hora}` : ''}{m.muestreador ? ` · ${m.muestreador}` : ''}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                    )}

                    <section className="shrink-0 rounded-xl border border-border bg-card shadow-sm">
                        <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Ya registrados ({lista.length})</p>
                        <div className="max-h-44 divide-y divide-border overflow-y-auto">
                            {lista.length === 0 && <p className="p-3 text-xs text-muted-foreground">Todavía no hay ninguno.</p>}
                            {lista.map((f) => (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setElegido(f.id)}
                                    className={cn('flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-muted/60',
                                        elegido === f.id && 'bg-muted')}
                                >
                                    <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                                        Folio {f.folio_foma ?? '—'}
                                        <Badge variant={ESTADO_VARIANT[f.estado]} className="text-[10px]">{f.estado}</Badge>
                                    </span>
                                    <span className="truncate text-[11px] text-muted-foreground">{f.empresa || 'Sin empresa'} · {f.fecha}</span>
                                </button>
                            ))}
                        </div>
                    </section>

                    {datos && items && (
                        <section className="flex shrink-0 flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                            {!editable && (
                                <p className={cn('rounded-md px-2 py-1 text-[11px]',
                                    datos.estado === 'ANULADA' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                                    {datos.estado === 'ANULADA' ? `Anulado: ${datos.motivo_anulacion || ''}` : `Firmado por ${datos.nombre_firma || ''}`}
                                </p>
                            )}
                            {refMuestreo?.medicion && (refMuestreo.medicion.ph || refMuestreo.medicion.temperatura) && (
                                <div className="rounded-md border border-border bg-muted/40 p-2">
                                    <p className="text-[11px] font-semibold text-muted-foreground">Medido en terreno (referencia del FoMa)</p>
                                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px]">
                                        {refMuestreo.medicion.ph && <span>pH <strong>{refMuestreo.medicion.ph}</strong></span>}
                                        {refMuestreo.medicion.temperatura && <span>T° <strong>{refMuestreo.medicion.temperatura}</strong></span>}
                                        {refMuestreo.medicion.temperatura_corregida && <span>T° corregida <strong>{refMuestreo.medicion.temperatura_corregida}</strong></span>}
                                    </div>
                                    {refMuestreo.medicion.observacion && (
                                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{refMuestreo.medicion.observacion}</p>
                                    )}
                                    <p className="mt-1 text-[10px] italic text-muted-foreground">
                                        Son lecturas del agua, no de los buffers: no se copian al formulario.
                                    </p>
                                </div>
                            )}
                            {children({ datos, items, editable, set })}
                            <div>
                                <label className="text-xs font-medium">Observaciones</label>
                                <Textarea
                                    value={datos.observaciones || ''}
                                    onChange={(e) => set({ observaciones: e.target.value })}
                                    disabled={!editable}
                                    rows={3}
                                    className="mt-1 text-xs"
                                />
                            </div>
                            {editable && (
                                <div className="flex flex-wrap gap-2">
                                    <Button size="sm" onClick={guardar} disabled={guardando}><IconDeviceFloppy size={14} /> Guardar</Button>
                                    <Button size="sm" variant="outline" onClick={() => setFirmando(true)}><IconCircleCheck size={14} /> Firmar</Button>
                                    <Button size="sm" variant="destructive" onClick={() => setAnulando(true)}><IconBan size={14} /> Anular</Button>
                                </div>
                            )}
                        </section>
                    )}
                </div>

                {/* Derecha: el documento, actualizándose mientras se escribe */}
                <div className="min-h-0">
                    <VistaPreviaPdf
                        generar={async () => (datos ? { url: await svc.vistaPreviaUrl(tipo, datos), nombre: `${tipo}.pdf` } : null)}
                        clave={datos ? JSON.stringify(datos) : ''}
                        aviso={datos ? null : 'Elija un formulario de la lista o cree uno con el folio del muestreo.'}
                        className="h-full"
                    />
                </div>
            </div>

            <Dialog open={firmando} onOpenChange={setFirmando}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Firmar el formulario</DialogTitle></DialogHeader>
                    <div className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-medium">Nombre de quien firma</label>
                            <Input value={firma.nombre} onChange={(e) => setFirma((f) => ({ ...f, nombre: e.target.value }))} className="mt-1 h-8 text-xs" />
                        </div>
                        <CampoFirma
                            titulo="Firma"
                            nombre={firma.nombre}
                            onChange={(imagen) => setFirma((f) => ({ ...f, imagen }))}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setFirmando(false)}>Cancelar</Button>
                        <Button size="sm" onClick={confirmarFirma} disabled={!firma.nombre.trim()}>Firmar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={anulando} onOpenChange={setAnulando}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Anular el formulario</DialogTitle></DialogHeader>
                    <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Motivo de la anulación" className="text-xs" />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setAnulando(false)}>Cancelar</Button>
                        <Button variant="destructive" size="sm" onClick={confirmarAnulacion} disabled={!motivo.trim()}>Anular</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default MarcoVerificacionTerreno;
