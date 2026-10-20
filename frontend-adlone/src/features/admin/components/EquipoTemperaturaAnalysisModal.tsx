import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconUpload,
    IconCloudUpload,
    IconRefresh,
    IconAlertTriangle,
    IconFileSpreadsheet,
    IconX,
    IconTemperature,
} from '@tabler/icons-react';
import { equipoService, type AnalisisTemperaturaResponse, type AnalisisTemperaturaItem } from '../services/equipo.service';
import { formatearTamano } from '../utils/documentosEquipo';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction } from '@/components/ui/attachment';
import { cn } from '@/lib/utils';
import {
    EstadoBadge, StatCard, DiffDetailView, BusquedaFlotante, LoteResultadoView,
    guardarLote, leerLote, limpiarLote,
    type EstadoMeta, type LoteItemResultado, type LoteGuardado,
} from './excelAnalysisShared';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onDataChanged: () => void;
}

type Vista = 'upload' | 'resultados' | 'detalle' | 'confirmacion_lote';
type FiltroEstado = 'todos' | AnalisisTemperaturaItem['status'];

const LOTE_KEY = 'equipo_temperatura_lote_pendiente';

const STATUS_META: Record<AnalisisTemperaturaItem['status'], EstadoMeta> = {
    coincide: { label: 'Coincide', badge: 'success' },
    difiere: { label: 'Difiere', badge: 'warning' },
    no_encontrado: { label: 'No encontrado', badge: 'destructive' },
};

// Solo los campos de temperatura/estado que trae este archivo — nunca
// nombre/tipo/ubicación, que no vienen acá y no se deben tocar desde este
// análisis. updateEquipo es un update parcial, así que basta mandar estos.
const buildUpdatePayload = (d: AnalisisTemperaturaItem['excelData']) => {
    const payload: Record<string, unknown> = {};
    if (d.error0 !== undefined && d.error0 !== null) payload.error0 = d.error0;
    if (d.error15 !== undefined && d.error15 !== null) payload.error15 = d.error15;
    if (d.error30 !== undefined && d.error30 !== null) payload.error30 = d.error30;
    if (d.tiene_fc) payload.tiene_fc = d.tiene_fc;
    if (d.ultima_verificacion) payload.ultima_verificacion = d.ultima_verificacion;
    if (d.estado_equipo) payload.estado_equipo = d.estado_equipo;
    if (d.observacion) payload.observacion = d.observacion;
    if (d.equipo_asociado) payload.equipo_asociado = d.equipo_asociado;
    if (d.id_muestreador) payload.id_muestreador = d.id_muestreador;
    return payload;
};

export const EquipoTemperaturaAnalysisModal: React.FC<Props> = ({ isOpen, onClose, onDataChanged }) => {
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [analizando, setAnalizando] = useState(false);
    const [resultado, setResultado] = useState<AnalisisTemperaturaResponse | null>(null);
    const [vista, setVista] = useState<Vista>('upload');
    const [itemSeleccionado, setItemSeleccionado] = useState<AnalisisTemperaturaItem | null>(null);
    const [actualizandoFila, setActualizandoFila] = useState<number | null>(null);
    const [actualizandoTodo, setActualizandoTodo] = useState(false);
    const [progresoTodo, setProgresoTodo] = useState<{ hecho: number; total: number } | null>(null);
    const [confirmarActualizarTodo, setConfirmarActualizarTodo] = useState(false);
    const [loteResultado, setLoteResultado] = useState<LoteGuardado | null>(null);
    const [reintentandoLote, setReintentandoLote] = useState<number | null>(null);

    // Filtros — todo client-side sobre el array ya cargado en memoria.
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
    const [soloAdvertencias, setSoloAdvertencias] = useState(false);
    const [busqueda, setBusqueda] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    // Si quedó un lote sin confirmar de una sesión anterior (cierre accidental
    // de pestaña, recarga a mitad de un "Actualizar Todo"), se muestra de
    // nuevo apenas se abre el modal, en vez de perderse en silencio.
    useEffect(() => {
        if (!isOpen) return;
        const pendiente = leerLote(LOTE_KEY);
        if (pendiente && pendiente.items.length > 0) {
            setLoteResultado(pendiente);
            setVista('confirmacion_lote');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    // Aviso nativo del navegador si intenta cerrar/recargar la pestaña a mitad
    // de un lote — no se puede evitar del todo, pero sí advertir.
    useEffect(() => {
        if (!actualizandoTodo) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [actualizandoTodo]);

    const reset = () => {
        setFile(null);
        setResultado(null);
        setVista('upload');
        setItemSeleccionado(null);
        setFiltroEstado('todos');
        setSoloAdvertencias(false);
        setBusqueda('');
    };

    const handleClose = () => {
        const huboAnalisis = !!resultado;
        reset();
        onClose();
        if (huboAnalisis) onDataChanged();
    };

    const analizar = async (archivo: File) => {
        setAnalizando(true);
        try {
            const res = await equipoService.analizarExcelTemperatura(archivo);
            setResultado(res);
            setVista('resultados');
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || 'No se pudo analizar el archivo' });
        } finally {
            setAnalizando(false);
        }
    };

    const reanalizar = () => {
        if (!file) return;
        analizar(file);
    };

    // "Ver" solo cambia de vista — el resultado del análisis no se toca, así
    // que "Volver a resultados" deja la lista exactamente como estaba.
    const abrirDetalle = (item: AnalisisTemperaturaItem) => {
        setItemSeleccionado(item);
        setVista('detalle');
    };

    const marcarComoActualizado = (rowNumber: number) => {
        setResultado((prev) => {
            if (!prev) return prev;
            const items = prev.items.map((it) =>
                it.rowNumber === rowNumber ? { ...it, status: 'coincide' as const, diffs: [] } : it
            );
            return {
                ...prev,
                items,
                resumen: { ...prev.resumen, difieren: Math.max(0, prev.resumen.difieren - 1), coinciden: prev.resumen.coinciden + 1 },
            };
        });
    };

    const actualizarEquipo = async (item: AnalisisTemperaturaItem) => {
        if (!item.id_equipo) return;
        await equipoService.updateEquipo(item.id_equipo, buildUpdatePayload(item.excelData));
    };

    const actualizarFila = async (item: AnalisisTemperaturaItem, volverAResultados = false) => {
        setActualizandoFila(item.rowNumber);
        try {
            await actualizarEquipo(item);
            marcarComoActualizado(item.rowNumber);
            showToast({ type: 'success', message: `Equipo "${item.nombre || item.codigo}" actualizado correctamente` });
            if (volverAResultados) setVista('resultados');
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'No se pudo actualizar el equipo' });
        } finally {
            setActualizandoFila(null);
        }
    };

    const actualizarTodosLosDiferentes = async () => {
        setConfirmarActualizarTodo(false);
        const diferentes = resultado?.items.filter((i) => i.status === 'difiere') || [];
        if (diferentes.length === 0) return;

        setActualizandoTodo(true);
        setProgresoTodo({ hecho: 0, total: diferentes.length });
        const loteItems: LoteItemResultado[] = [];

        for (const item of diferentes) {
            try {
                await actualizarEquipo(item);
                marcarComoActualizado(item.rowNumber);
                loteItems.push({ rowNumber: item.rowNumber, codigo: item.codigo, nombre: item.nombre, estado: 'ok' });
            } catch (err: any) {
                loteItems.push({
                    rowNumber: item.rowNumber,
                    codigo: item.codigo,
                    nombre: item.nombre,
                    estado: 'error',
                    mensaje: err?.response?.data?.message || err?.message || 'Error desconocido',
                });
            }
            setProgresoTodo((prev) => prev ? { ...prev, hecho: prev.hecho + 1 } : prev);
            guardarLote(LOTE_KEY, { tipo: 'Actualización masiva de temperaturas', items: loteItems, terminado: false, timestamp: Date.now() });
        }

        setActualizandoTodo(false);
        setProgresoTodo(null);
        const loteFinal: LoteGuardado = { tipo: 'Actualización masiva de temperaturas', items: loteItems, terminado: true, timestamp: Date.now() };
        guardarLote(LOTE_KEY, loteFinal);
        setLoteResultado(loteFinal);
        setVista('confirmacion_lote');
    };

    // "Reintentar" en la pantalla de confirmación: busca la fila original en
    // `resultado` (sigue ahí con sus datos del Excel) y repite la actualización.
    const reintentarItemLote = async (loteItem: LoteItemResultado) => {
        if (!resultado) return;
        const item = resultado.items.find((i) => i.rowNumber === loteItem.rowNumber);
        if (!item) return;

        setReintentandoLote(loteItem.rowNumber);
        try {
            await actualizarEquipo(item);
            marcarComoActualizado(item.rowNumber);
            setLoteResultado((prev) => {
                if (!prev) return prev;
                const items = prev.items.map((i) => i.rowNumber === loteItem.rowNumber ? { ...i, estado: 'ok' as const, mensaje: undefined } : i);
                const actualizado = { ...prev, items };
                guardarLote(LOTE_KEY, actualizado);
                return actualizado;
            });
            showToast({ type: 'success', message: `"${loteItem.nombre || loteItem.codigo}" actualizado correctamente` });
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'Siguió fallando' });
        } finally {
            setReintentandoLote(null);
        }
    };

    const confirmarLote = () => {
        limpiarLote(LOTE_KEY);
        setLoteResultado(null);
        setVista('resultados');
    };

    const seleccionarArchivo = (f: File | null) => {
        if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
            showToast({ type: 'error', message: 'Solo se aceptan archivos Excel (.xlsx)' });
            return;
        }
        setFile(f);
    };

    const itemsFiltrados = useMemo(() => {
        if (!resultado) return [];
        return resultado.items.filter((item) => {
            if (filtroEstado !== 'todos' && item.status !== filtroEstado) return false;
            if (soloAdvertencias && item.warnings.length === 0) return false;
            if (busqueda.trim()) {
                const q = busqueda.trim().toLowerCase();
                const enCodigo = (item.codigo || '').toLowerCase().includes(q);
                const enNombre = (item.nombre || '').toLowerCase().includes(q);
                if (!enCodigo && !enNombre) return false;
            }
            return true;
        });
    }, [resultado, filtroEstado, soloAdvertencias, busqueda]);

    const toggleFiltroEstado = (estado: FiltroEstado) => {
        setFiltroEstado((prev) => (prev === estado ? 'todos' : estado));
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => { if (!open) { if (actualizandoTodo) return; handleClose(); } }}
        >
            <DialogContent
                className="flex max-h-[88vh] max-w-5xl flex-col gap-4 overflow-hidden"
                showCloseButton={!actualizandoTodo}
                onInteractOutside={(e) => { if (actualizandoTodo) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (actualizandoTodo) e.preventDefault(); }}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconTemperature size={20} className="text-primary" />
                        Análisis de Temperatura (Verificaciones Intermedias T°)
                    </DialogTitle>
                </DialogHeader>

                {actualizandoTodo && (
                    <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                        No cierres esta ventana mientras se procesa — el progreso queda respaldado, pero es mejor esperar a que termine.
                    </p>
                )}

                {resultado && vista !== 'confirmacion_lote' && (
                    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-stretch">
                        <div className="grid flex-1 grid-cols-3 gap-2">
                            <StatCard label="Total analizados" value={resultado.resumen.total} tone="default" onClick={() => setFiltroEstado('todos')} active={filtroEstado === 'todos'} />
                            <StatCard label="Coinciden" value={resultado.resumen.coinciden} tone="success" onClick={() => toggleFiltroEstado('coincide')} active={filtroEstado === 'coincide'} />
                            <StatCard label="Difieren" value={resultado.resumen.difieren} tone="warning" onClick={() => toggleFiltroEstado('difiere')} active={filtroEstado === 'difiere'} />
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            {resultado.resumen.difieren > 0 && (
                                <Button
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => setConfirmarActualizarTodo(true)}
                                    disabled={actualizandoTodo || analizando}
                                >
                                    {actualizandoTodo ? (
                                        <>
                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                            Actualizando {progresoTodo ? `${progresoTodo.hecho}/${progresoTodo.total}` : '...'}
                                        </>
                                    ) : (
                                        <><IconCloudUpload size={14} /> Actualizar Todo ({resultado.resumen.difieren})</>
                                    )}
                                </Button>
                            )}
                            <Button variant="outline" size="sm" className="shrink-0" onClick={reanalizar} disabled={analizando || actualizandoTodo}>
                                <IconRefresh size={14} className={cn(analizando && 'animate-spin')} /> Volver a analizar
                            </Button>
                        </div>
                    </div>
                )}

                {resultado && vista === 'resultados' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant={soloAdvertencias ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSoloAdvertencias((v) => !v)}
                        >
                            <IconAlertTriangle size={14} /> Solo con advertencias
                        </Button>
                        {(filtroEstado !== 'todos' || soloAdvertencias || busqueda) && (
                            <Button variant="ghost" size="sm" onClick={() => { setFiltroEstado('todos'); setSoloAdvertencias(false); setBusqueda(''); }}>
                                <IconX size={14} /> Limpiar filtros
                            </Button>
                        )}
                        <span className="text-xs text-muted-foreground">{itemsFiltrados.length} de {resultado.items.length}</span>
                        <div className="ml-auto">
                            <BusquedaFlotante valor={busqueda} onChange={setBusqueda} placeholder="Buscar por código o nombre..." />
                        </div>
                    </div>
                )}

                {vista === 'upload' && (
                    <div className="flex flex-col gap-4 py-6">
                        <div
                            role="button"
                            tabIndex={0}
                            onClick={() => fileInputRef.current?.click()}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragOver(false);
                                seleccionarArchivo(e.dataTransfer.files?.[0] ?? null);
                            }}
                            className={cn(
                                'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
                                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/40'
                            )}
                        >
                            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <IconFileSpreadsheet size={24} />
                            </div>
                            <p className="text-sm font-medium">Arrastre el "Resumen Verificaciones Intermedias T°" o haga clic para seleccionarlo</p>
                            <p className="text-xs text-muted-foreground">Archivo Excel (.xlsx) de hasta 10 MB — hoja "Verif. T°"</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx"
                                className="hidden"
                                onChange={(e) => seleccionarArchivo(e.target.files?.[0] ?? null)}
                            />
                        </div>

                        {file && (
                            <Attachment size="sm" className="w-full">
                                <AttachmentMedia>
                                    <IconFileSpreadsheet />
                                </AttachmentMedia>
                                <AttachmentContent>
                                    <AttachmentTitle>{file.name}</AttachmentTitle>
                                    <AttachmentDescription>{formatearTamano(file.size) || 'Listo para analizar'}</AttachmentDescription>
                                </AttachmentContent>
                                <AttachmentActions>
                                    <AttachmentAction aria-label="Quitar archivo" title="Quitar" onClick={() => setFile(null)}>
                                        <IconX size={14} />
                                    </AttachmentAction>
                                </AttachmentActions>
                            </Attachment>
                        )}

                        <Button className="self-center px-8" onClick={() => file && analizar(file)} disabled={!file || analizando}>
                            {analizando
                                ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> Analizando...</>)
                                : (<><IconUpload size={16} /> Analizar</>)}
                        </Button>
                    </div>
                )}

                {vista === 'resultados' && resultado && (
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Detalle</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {itemsFiltrados.map((item) => (
                                    <TableRow key={item.rowNumber}>
                                        <TableCell className="text-sm font-semibold text-foreground">{item.codigo || '—'}</TableCell>
                                        <TableCell className="font-medium text-foreground">{item.nombre || '—'}</TableCell>
                                        <TableCell><EstadoBadge status={item.status} meta={STATUS_META} /></TableCell>
                                        <TableCell className="max-w-xs text-xs text-muted-foreground">
                                            {item.status === 'difiere' && (
                                                <span>{item.diffs.length} campo(s) distinto(s): {item.diffs.map(d => d.etiqueta).join(', ')}</span>
                                            )}
                                            {item.status === 'coincide' && <span className="text-success">Sin diferencias</span>}
                                            {item.warnings.length > 0 && (
                                                <div className="mt-1 flex items-start gap-1 text-warning">
                                                    <IconAlertTriangle size={12} className="mt-0.5 shrink-0" /> <span>{item.warnings[0]}</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1.5">
                                                {item.status === 'difiere' && (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => abrirDetalle(item)} disabled={actualizandoTodo}>
                                                            Ver
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => actualizarFila(item)}
                                                            disabled={actualizandoFila === item.rowNumber || actualizandoTodo}
                                                        >
                                                            {actualizandoFila === item.rowNumber ? (
                                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                                            ) : (
                                                                <IconCloudUpload size={14} />
                                                            )}
                                                            Actualizar
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {itemsFiltrados.length === 0 && (
                            <p className="py-10 text-center text-sm text-muted-foreground">Ningún equipo coincide con los filtros actuales.</p>
                        )}
                        {resultado.rowErrors.length > 0 && (
                            <div className="m-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                                {resultado.rowErrors.map((e, i) => <div key={i}>Fila {e.rowNumber}: {e.message}</div>)}
                            </div>
                        )}
                    </div>
                )}

                {vista === 'detalle' && itemSeleccionado && (
                    <DiffDetailView
                        titulo={`${itemSeleccionado.nombre || 'Equipo'} — ${itemSeleccionado.codigo || 'sin código'}`}
                        subtitulo={`${itemSeleccionado.diffs.length} campo(s) distinto(s)`}
                        diffs={itemSeleccionado.diffs}
                        onBack={() => setVista('resultados')}
                    >
                        <Button
                            size="sm"
                            onClick={() => actualizarFila(itemSeleccionado, true)}
                            disabled={actualizandoFila === itemSeleccionado.rowNumber}
                        >
                            {actualizandoFila === itemSeleccionado.rowNumber ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            ) : (
                                <IconCloudUpload size={14} />
                            )}
                            Actualizar
                        </Button>
                    </DiffDetailView>
                )}

                {vista === 'confirmacion_lote' && loteResultado && (
                    <LoteResultadoView
                        titulo={loteResultado.tipo}
                        items={loteResultado.items}
                        onReintentar={reintentarItemLote}
                        reintentando={reintentandoLote}
                        onConfirmar={confirmarLote}
                    />
                )}
            </DialogContent>

            <Dialog open={confirmarActualizarTodo} onOpenChange={setConfirmarActualizarTodo}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Actualizar todos los equipos con diferencias</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Se van a actualizar <b>{resultado?.resumen.difieren ?? 0}</b> equipo(s) con los valores de temperatura (Error 0/15/30, Factor de Corrección, Estado, Observación) leídos del Excel. Al terminar se mostrará una pantalla de confirmación con el detalle.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmarActualizarTodo(false)}>Cancelar</Button>
                        <Button onClick={actualizarTodosLosDiferentes}>
                            <IconCloudUpload size={14} /> Confirmar y Actualizar Todo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};
