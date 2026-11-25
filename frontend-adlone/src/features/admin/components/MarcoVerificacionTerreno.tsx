import React, { useCallback, useEffect, useState } from 'react';
import { IconPlus, IconDeviceFloppy, IconBan, IconCircleCheck, IconSearch } from '@tabler/icons-react';
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
    type TipoFormulario, type FilaListado, type Formulario, type Muestreo, type ItemsApi,
} from '../services/verificacionTerreno.service';

// Armazón de los tres formularios de terreno: a la izquierda la lista y el formulario, a la derecha el
// mismo PDF que se descarga, regenerándose mientras se escribe. Cada página pone sus campos en `children`.

const ESTADO_VARIANT = { BORRADOR: 'warning', FIRMADA: 'success', ANULADA: 'destructive' } as const;

interface Props {
    tipo: TipoFormulario;
    titulo: string;
    subtitulo: string;
    onBack: () => void;
    /** Los campos propios del formulario; recibe lo cargado y cómo cambiarlo. */
    children: (ctx: {
        datos: Formulario;
        items: ItemsApi;
        muestreo: Muestreo | null;
        editable: boolean;
        set: (cambios: Partial<Formulario>) => void;
    }) => React.ReactNode;
}

export const MarcoVerificacionTerreno: React.FC<Props> = ({ tipo, titulo, subtitulo, onBack, children }) => {
    const { setActiveSubmodule } = useNavStore();
    const { showToast } = useToast();
    const [lista, setLista] = useState<FilaListado[]>([]);
    const [items, setItems] = useState<ItemsApi | null>(null);
    const [elegido, setElegido] = useState<number | null>(null);
    const [datos, setDatos] = useState<Formulario | null>(null);
    const [muestreo, setMuestreo] = useState<Muestreo | null>(null);
    const [folio, setFolio] = useState('');
    const [creando, setCreando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [firmando, setFirmando] = useState(false);
    const [firma, setFirma] = useState<{ nombre: string; imagen: string | null }>({ nombre: '', imagen: null });
    const [anulando, setAnulando] = useState(false);
    const [motivo, setMotivo] = useState('');

    const cargarLista = useCallback(async () => {
        try { setLista(await svc.listar(tipo)); } catch { /* lista vacía */ }
    }, [tipo]);

    useEffect(() => { cargarLista(); }, [cargarLista]);
    useEffect(() => { svc.items().then(setItems).catch(() => { /* sin ítems no se puede marcar */ }); }, []);

    useEffect(() => {
        if (!elegido) { setDatos(null); setMuestreo(null); return; }
        let vigente = true;
        svc.obtener(tipo, elegido)
            .then((d) => { if (vigente) setDatos(d); })
            .catch((e) => showToast({ type: 'error', message: mensajeError(e) || 'No se pudo abrir el formulario.' }));
        return () => { vigente = false; };
    }, [tipo, elegido, showToast]);

    const crear = async () => {
        const n = Number(folio);
        if (!n) { showToast({ type: 'error', message: 'Escriba el folio de la planilla OI-FoMa-01.' }); return; }
        setCreando(true);
        try {
            const r = await svc.crear(tipo, n);
            showToast({ type: 'success', message: `Formulario creado desde el folio ${r.folio}.` });
            setFolio('');
            await cargarLista();
            setElegido(r.id);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) || 'No se pudo crear el formulario.' });
        } finally {
            setCreando(false);
        }
    };

    /** Vista del muestreo antes de crear: confirma que el folio existe y qué traerá. */
    const mirarFolio = async () => {
        const n = Number(folio);
        if (!n) return;
        try {
            const r = await svc.previo(tipo, n);
            setMuestreo(r.muestreo);
            showToast({ type: 'success', message: `Folio ${n}: ${r.muestreo.empresa || ''} · ${r.muestreo.lugar_muestreo || ''}` });
        } catch (e) {
            setMuestreo(null);
            showToast({ type: 'error', message: mensajeError(e) || 'No se encontró el folio.' });
        }
    };

    const idDe = (d: Formulario) => d.id_verificacion ?? d.id_lista ?? 0;
    const editable = datos?.estado === 'BORRADOR';
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
                    <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                        <span className="text-xs font-medium text-muted-foreground">Nuevo desde el folio de la planilla OI-FoMa-01</span>
                        <div className="flex gap-2">
                            <Input
                                value={folio}
                                onChange={(e) => setFolio(e.target.value.replace(/\D/g, ''))}
                                placeholder="Folio (ej. 500471)"
                                className="h-8 text-xs"
                                inputMode="numeric"
                            />
                            <Button size="sm" variant="outline" onClick={mirarFolio} disabled={!folio} title="Ver qué trae ese folio">
                                <IconSearch size={14} />
                            </Button>
                        </div>
                        {muestreo && (
                            <div className="rounded-md border border-border bg-muted/40 p-2 text-[11px] leading-relaxed">
                                <p className="font-medium">{muestreo.empresa}</p>
                                <p className="text-muted-foreground">{muestreo.lugar_muestreo}</p>
                                <p className="text-muted-foreground">{muestreo.fecha} {muestreo.hora} · {muestreo.muestreador}</p>
                                {muestreo.equipos.length > 0 && (
                                    <p className="mt-1 text-muted-foreground">
                                        Equipos: {muestreo.equipos.map((e) => e.codigo).join(', ')}
                                    </p>
                                )}
                            </div>
                        )}
                        <Button size="sm" onClick={crear} disabled={creando || !folio}><IconPlus size={14} /> Crear</Button>
                    </section>

                    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card shadow-sm">
                        <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Formularios ({lista.length})</p>
                        <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                            {lista.length === 0 && <p className="p-3 text-xs text-muted-foreground">Todavía no hay formularios.</p>}
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
                        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
                            {!editable && (
                                <p className={cn('rounded-md px-2 py-1 text-[11px]',
                                    datos.estado === 'ANULADA' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success')}>
                                    {datos.estado === 'ANULADA' ? `Anulado: ${datos.motivo_anulacion || ''}` : `Firmado por ${datos.nombre_firma || ''}`}
                                </p>
                            )}
                            {children({ datos, items, muestreo, editable, set })}
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
