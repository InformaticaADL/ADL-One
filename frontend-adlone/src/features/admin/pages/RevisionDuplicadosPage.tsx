import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconSearch, IconGitMerge, IconEqualNot, IconTrash, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import {
    revisionDuplicadosService as api,
    type AccionRevision, type EntidadRevision, type EstadoRevision, type LadoDuplicado, type ParDuplicado, type ResumenFila,
} from '../services/revisionDuplicados.service';

interface Props { onBack: () => void }

const mensajeError = (e: unknown, def: string): string => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || def;

const ENTIDADES: { id: EntidadRevision; label: string; singular: string }[] = [
    { id: 'CLI_EMPRESA', label: 'Empresas', singular: 'empresa' },
    { id: 'CLI_SERVICIO', label: 'Servicios', singular: 'servicio' },
    { id: 'CLI_CENTRO', label: 'Centros', singular: 'centro' },
    { id: 'FAC_CONVENIO', label: 'Convenios', singular: 'convenio' },
];

const CRITERIOS: Record<string, { label: string; ayuda: string }> = {
    MISMO_RUT: { label: 'Mismo RUT', ayuda: 'Comparten RUT: casi siempre es la misma empresa (cambio de razón social o carga repetida).' },
    MISMO_NOMBRE: { label: 'Mismo nombre', ayuda: 'Mismo nombre con RUT distinto.' },
    MISMO_NOMBRE_MISMA_EMPRESA: { label: 'Mismo nombre y empresa', ayuda: 'Mismo nombre y misma empresa: probablemente el centro está registrado dos veces.' },
    MISMA_DIMENSION: { label: 'Mismo servicio y centro', ayuda: 'Dos convenios habilitados para el mismo servicio y centro. Los que no comparten ninguna técnica ya se marcaron como separados; aquí quedan los que repiten técnicas.' },
    COORDENADAS_CERCANAS: { label: 'Coordenadas cercanas', ayuda: 'A 100 m o menos. Pueden ser centros distintos de empresas distintas en el mismo lugar.' },
};

const ESTADOS: { id: EstadoRevision | 'TODOS'; label: string }[] = [
    { id: 'PENDIENTE', label: 'Pendientes' },
    { id: 'TODOS', label: 'Todos' },
    { id: 'FUSIONAR', label: 'Fusionados' },
    { id: 'MANTENER_SEPARADO', label: 'Separados' },
    { id: 'DESCARTAR', label: 'Descartados' },
];

const CAMPOS: Record<EntidadRevision, { key: keyof LadoDuplicado; label: string }[]> = {
    CLI_EMPRESA: [{ key: 'nombre', label: 'Razón social' }, { key: 'rut', label: 'RUT' }, { key: 'direccion', label: 'Dirección' }, { key: 'email', label: 'Correo' }],
    CLI_SERVICIO: [{ key: 'nombre', label: 'Nombre' }, { key: 'rut', label: 'RUT' }, { key: 'empresa', label: 'Empresa' }, { key: 'email_facturacion', label: 'Correo facturación' }],
    CLI_CENTRO: [{ key: 'nombre', label: 'Nombre' }, { key: 'codigo', label: 'Código' }, { key: 'empresa', label: 'Empresa' }, { key: 'rut', label: 'RUT empresa' }, { key: 'ubicacion', label: 'Ubicación' }],
    FAC_CONVENIO: [{ key: 'nombre', label: 'Convenio' }, { key: 'servicio', label: 'Servicio' }, { key: 'centro', label: 'Centro' }, { key: 'tarifas', label: 'Precios (tarifas)' }],
};

const valor = (l: LadoDuplicado, k: keyof LadoDuplicado): string => {
    const v = l[k];
    return v == null || v === '' ? '—' : String(v);
};
const activo = (l: LadoDuplicado) => (l.habilitada ?? l.habilitado) !== false;
const coord = (l: LadoDuplicado) => (l.lat != null && l.lon != null ? `${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}` : '—');

const Lado: React.FC<{ letra: 'A' | 'B'; lado: LadoDuplicado; otro: LadoDuplicado; entidad: EntidadRevision }> = ({ letra, lado, otro, entidad }) => (
    <div className="min-w-0 flex-1 rounded-md border border-border bg-background p-3">
        <div className="mb-2 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-xs font-semibold">{letra}</span>
            <Badge variant={activo(lado) ? 'success' : 'secondary'}>{activo(lado) ? 'Habilitado' : 'Deshabilitado'}</Badge>
            {lado.fichas > 0 && <Badge variant="warning">{lado.fichas} ficha{lado.fichas === 1 ? '' : 's'}</Badge>}
            {(lado.usos ?? 0) > 0 && <Badge variant="warning">en {lado.usos} cotización{lado.usos === 1 ? '' : 'es'}</Badge>}
        </div>
        <dl className="space-y-1 text-sm">
            {CAMPOS[entidad].map(({ key, label }) => {
                const distinto = valor(lado, key) !== valor(otro, key);
                return (
                    <div key={key} className="flex gap-2">
                        <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
                        <dd className={cn('min-w-0 break-words', distinto && 'font-medium text-foreground')}>{valor(lado, key)}</dd>
                    </div>
                );
            })}
            {entidad === 'CLI_CENTRO' && (
                <div className="flex gap-2">
                    <dt className="w-28 shrink-0 text-muted-foreground">Coordenadas</dt>
                    <dd className={cn(coord(lado) !== coord(otro) && 'font-medium')}>{coord(lado)}</dd>
                </div>
            )}
        </dl>
    </div>
);

export const RevisionDuplicadosPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [entidad, setEntidad] = useState<EntidadRevision>('CLI_EMPRESA');
    const [criterio, setCriterio] = useState<string>('');
    const [estado, setEstado] = useState<EstadoRevision | 'TODOS'>('PENDIENTE');
    const [q, setQ] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [soloFichas, setSoloFichas] = useState(false);
    const [page, setPage] = useState(1);
    const [items, setItems] = useState<ParDuplicado[]>([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(25);
    const [resumen, setResumen] = useState<ResumenFila[]>([]);
    const [cargando, setCargando] = useState(false);
    const [sel, setSel] = useState<Set<number>>(new Set());
    const [confirmar, setConfirmar] = useState<{ ids: number[]; accion: AccionRevision; mantener?: 'A' | 'B'; texto: string } | null>(null);
    const [obs, setObs] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [r, s] = await Promise.all([
                api.listar({ entidad, criterio: criterio || undefined, estado, q: busqueda || undefined, soloConFichas: soloFichas, page, limit: 25 }),
                api.resumen(),
            ]);
            setItems(r.items); setTotal(r.total); setLimit(r.limit); setResumen(s); setSel(new Set());
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo cargar la revisión de duplicados') });
        } finally { setCargando(false); }
    }, [entidad, criterio, estado, busqueda, soloFichas, page, showToast]);

    useEffect(() => { void cargar(); }, [cargar]);

    const pendientes = (id: string) => resumen.filter((r) => r.entidad === id && r.estado === 'PENDIENTE').reduce((a, r) => a + r.n, 0);
    const criterios = useMemo(() => [...new Set(resumen.filter((r) => r.entidad === entidad).map((r) => r.criterio))], [resumen, entidad]);
    const paginas = Math.max(1, Math.ceil(total / limit));

    const ejecutar = async () => {
        if (!confirmar) return;
        setEnviando(true);
        try {
            if (confirmar.ids.length === 1) {
                await api.resolver(confirmar.ids[0], { accion: confirmar.accion, mantener: confirmar.mantener, observacion: obs || undefined });
                showToast({ type: 'success', message: 'Par resuelto' });
            } else {
                const r = await api.resolverLote(confirmar.ids, { accion: confirmar.accion, observacion: obs || undefined });
                showToast({ type: r.errores.length ? 'warning' : 'success', message: `${r.ok} par(es) resuelto(s)${r.errores.length ? `; ${r.errores.length} con error (${r.errores[0].mensaje})` : ''}` });
            }
            setConfirmar(null); setObs('');
            await cargar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo resolver') });
        } finally { setEnviando(false); }
    };

    const pedir = (ids: number[], accion: AccionRevision, mantener?: 'A' | 'B') => {
        const n = ids.length; const sing = ENTIDADES.find((e) => e.id === entidad)!.singular;
        const texto = accion === 'FUSIONAR' && entidad === 'FAC_CONVENIO'
            ? (n === 1 ? `Se mantiene el convenio ${mantener} y el otro se deshabilita (no se borra: conserva sus precios y las cotizaciones que lo usan).` : `Se mantiene el convenio A de ${n} pares y se deshabilita el otro de cada uno (no se borran).`)
            : accion === 'FUSIONAR'
            ? (n === 1 ? `Se fusionan los dos registros y queda el ${mantener}. Todo lo que apunta al otro (fichas, servicios, centros, contactos) pasará al ${mantener}. No se puede deshacer.`
                : `Se fusionan ${n} pares dejando siempre el registro A de cada uno. Todo lo que apunta al otro registro pasará al A. No se puede deshacer.`)
            : accion === 'MANTENER_SEPARADO' ? `Se marca${n > 1 ? 'n' : ''} ${n} par${n > 1 ? 'es' : ''} de ${sing}s como distintos. No volverán a aparecer como pendientes.`
                : `Se descarta${n > 1 ? 'n' : ''} ${n} par${n > 1 ? 'es' : ''} sin cambiar ningún dato.`;
        setObs(''); setConfirmar({ ids, accion, mantener, texto });
    };

    const alternar = (id: number) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const todosMarcados = items.length > 0 && items.every((i) => sel.has(i.id));
    const pendientesPagina = items.filter((i) => i.estado === 'PENDIENTE');

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Revisión de duplicados"
                subtitle="Empresas, servicios y centros que podrían estar repetidos en la base nueva. Nada se fusiona sin tu decisión."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Admin. Info', onClick: onBack }, { label: 'Informática', onClick: onBack }, { label: 'Revisión de duplicados' }]}
            />

            <Tabs value={entidad} onValueChange={(v) => { setEntidad(v as EntidadRevision); setCriterio(''); setPage(1); }} className="mb-4">
                <TabsList>
                    {ENTIDADES.map((e) => (
                        <TabsTrigger key={e.id} value={e.id}>{e.label}<span className="ml-2 rounded bg-background/60 px-1.5 text-xs tabular-nums">{pendientes(e.id)}</span></TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                    <IconSearch size={16} className="absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Buscar por nombre, RUT, código…" value={q} onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { setBusqueda(q); setPage(1); } }} />
                </div>
                <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={criterio} onChange={(e) => { setCriterio(e.target.value); setPage(1); }} aria-label="Criterio">
                    <option value="">Todos los criterios</option>
                    {criterios.map((c) => <option key={c} value={c}>{CRITERIOS[c]?.label ?? c}</option>)}
                </select>
                <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={estado} onChange={(e) => { setEstado(e.target.value as EstadoRevision | 'TODOS'); setPage(1); }} aria-label="Estado">
                    {ESTADOS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={soloFichas} onCheckedChange={(v) => { setSoloFichas(v === true); setPage(1); }} /> Solo con fichas
                </label>
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">{total} par{total === 1 ? '' : 'es'}</span>
            </div>

            {criterio && CRITERIOS[criterio] && <p className="mb-3 text-sm text-muted-foreground">{CRITERIOS[criterio].ayuda}</p>}

            {pendientesPagina.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={todosMarcados} onCheckedChange={(v) => setSel(v === true ? new Set(pendientesPagina.map((i) => i.id)) : new Set())} /> Marcar los de esta página
                    </label>
                    {sel.size > 0 && (
                        <>
                            <span className="text-sm text-muted-foreground">{sel.size} marcado{sel.size === 1 ? '' : 's'}</span>
                            <Button size="sm" variant="outline" onClick={() => pedir([...sel], 'MANTENER_SEPARADO')}><IconEqualNot size={15} className="mr-1" />Son distintos</Button>
                            <Button size="sm" variant="outline" onClick={() => pedir([...sel], 'DESCARTAR')}><IconTrash size={15} className="mr-1" />Descartar</Button>
                            <Button size="sm" onClick={() => pedir([...sel], 'FUSIONAR')}><IconGitMerge size={15} className="mr-1" />{entidad === 'FAC_CONVENIO' ? 'Mantener A' : 'Fusionar (queda A)'}</Button>
                        </>
                    )}
                </div>
            )}

            <div className={cn('space-y-3', cargando && 'opacity-60')}>
                {!cargando && items.length === 0 && <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No hay pares con estos filtros.</div>}
                {items.map((p) => p.detalle && (
                    <div key={p.id} className="rounded-lg border border-border p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                            {p.estado === 'PENDIENTE' && <Checkbox checked={sel.has(p.id)} onCheckedChange={() => alternar(p.id)} aria-label="Marcar par" />}
                            <Badge variant="outline">{CRITERIOS[p.criterio]?.label ?? p.criterio}</Badge>
                            {p.distancia_metros != null && <Badge variant="outline">{Math.round(p.distancia_metros)} m</Badge>}
                            {p.estado !== 'PENDIENTE' && <Badge variant={p.estado === 'FUSIONAR' ? 'success' : 'secondary'}>{ESTADOS.find((s) => s.id === p.estado)?.label}</Badge>}
                            {p.observacion && p.estado !== 'PENDIENTE' && <span className="text-xs text-muted-foreground">{p.observacion}</span>}
                        </div>
                        <div className="flex flex-col gap-2 md:flex-row">
                            <Lado letra="A" lado={p.detalle.a} otro={p.detalle.b} entidad={entidad} />
                            <Lado letra="B" lado={p.detalle.b} otro={p.detalle.a} entidad={entidad} />
                        </div>
                        {p.detalle.comparacion && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                Comparten {p.detalle.comparacion.en_comun} técnica{p.detalle.comparacion.en_comun === 1 ? '' : 's'} (con su tabla): {p.detalle.comparacion.precio_distinto === 0 ? 'todas con el mismo precio' : `${p.detalle.comparacion.precio_distinto} con precio distinto`}. Solo en A: {p.detalle.comparacion.solo_a}; solo en B: {p.detalle.comparacion.solo_b}.
                            </p>
                        )}
                        {p.estado === 'PENDIENTE' && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                <Button size="sm" onClick={() => pedir([p.id], 'FUSIONAR', 'A')}><IconGitMerge size={15} className="mr-1" />{entidad === 'FAC_CONVENIO' ? 'Mantener A, deshabilitar B' : 'Fusionar, queda A'}</Button>
                                <Button size="sm" onClick={() => pedir([p.id], 'FUSIONAR', 'B')}><IconGitMerge size={15} className="mr-1" />{entidad === 'FAC_CONVENIO' ? 'Mantener B, deshabilitar A' : 'Fusionar, queda B'}</Button>
                                <Button size="sm" variant="outline" onClick={() => pedir([p.id], 'MANTENER_SEPARADO')}><IconEqualNot size={15} className="mr-1" />Son distintos</Button>
                                <Button size="sm" variant="ghost" onClick={() => pedir([p.id], 'DESCARTAR')}>Descartar</Button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
                <Button size="sm" variant="outline" disabled={page <= 1 || cargando} onClick={() => setPage((n) => n - 1)}><IconChevronLeft size={16} /></Button>
                <span className="text-sm tabular-nums">Página {page} de {paginas}</span>
                <Button size="sm" variant="outline" disabled={page >= paginas || cargando} onClick={() => setPage((n) => n + 1)}><IconChevronRight size={16} /></Button>
            </div>

            <Dialog open={!!confirmar} onOpenChange={(o) => { if (!o && !enviando) setConfirmar(null); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{confirmar?.accion === 'FUSIONAR' ? (entidad === 'FAC_CONVENIO' ? 'Confirmar' : 'Confirmar fusión') : 'Confirmar'}</DialogTitle></DialogHeader>
                    <p className="text-sm">{confirmar?.texto}</p>
                    <Textarea placeholder="Observación (opcional)" maxLength={500} value={obs} onChange={(e) => setObs(e.target.value)} />
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" disabled={enviando} onClick={() => setConfirmar(null)}>Cancelar</Button>
                        <Button variant={confirmar?.accion === 'FUSIONAR' ? 'destructive' : 'default'} disabled={enviando} onClick={ejecutar}>{enviando ? 'Procesando…' : 'Confirmar'}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
