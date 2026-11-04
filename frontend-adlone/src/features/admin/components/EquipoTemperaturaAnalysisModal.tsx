import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconUpload,
    IconCloudUpload,
    IconRefresh,
    IconAlertTriangle,
    IconFileSpreadsheet,
    IconX,
    IconTemperature,
    IconFileAnalytics,
    IconEye,
    IconPencil,
} from '@tabler/icons-react';
import { ImportacionInformeModal } from './ImportacionInformeModal';
import { equipoService, type AnalisisTemperaturaResponse, type AnalisisTemperaturaItem, type Equipo } from '../services/equipo.service';
import { EquipoForm } from './EquipoForm';
import { EquipoDetalleLectura } from './EquipoDetalleLectura';
import { formatearTamano } from '../utils/documentosEquipo';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction } from '@/components/ui/attachment';
import { cn } from '@/lib/utils';
import {
    EstadoBadge, StatCard, DiffDetailView, BusquedaFlotante, LoteResultadoView,
    guardarLote, leerLote, limpiarLote, appendObservacion, extraerResponsableFaltante,
    SolicitarMuestreadorPopover, PanelCampos,
    type EstadoMeta, type LoteItemResultado, type LoteGuardado,
} from './excelAnalysisShared';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onDataChanged: () => void;
    // Cuando el botón unificado "Subir y Analizar Excel" ya detectó y analizó
    // el archivo (ver EquiposPage), se pasan acá para saltar directo a
    // resultados en vez de mostrar la pantalla de subida de nuevo.
    resultadoInicial?: AnalisisTemperaturaResponse | null;
    archivoInicial?: File | null;
}

type Vista = 'upload' | 'resultados' | 'confirmacion_lote';
type PestanaVer = 'diferencias' | 'ficha' | 'excel' | 'editar';
type FiltroEstado = 'todos' | AnalisisTemperaturaItem['status'];

const LOTE_KEY = 'equipo_temperatura_lote_pendiente';

// Campos leídos del Resumen de verificaciones T°, en el orden en que se muestran en "Datos del Excel".
const ETIQUETAS_EXCEL: Record<string, string> = {
    codigo: 'Código', ubicacion: 'Sede', error0: 'Error 0', error15: 'Error 15', error30: 'Error 30',
    tiene_fc: 'Factor de corrección', ultima_verificacion: 'Última verificación', estado_equipo: 'Estado operativo',
    id_muestreador: 'Responsable (id)', equipo_asociado: 'Equipo asociado', observacion: 'Observación',
};

const STATUS_META: Record<AnalisisTemperaturaItem['status'], EstadoMeta> = {
    coincide: { label: 'Coincide', badge: 'success' },
    difiere: { label: 'Difiere', badge: 'warning' },
    no_encontrado: { label: 'No encontrado', badge: 'destructive' },
};

// Solo los campos de temperatura/estado que trae este archivo — nunca
// nombre/tipo, que no vienen acá y no se deben tocar desde este análisis
// ("Sede" sí viene, igual que en el analizador de Inventario). updateEquipo
// es un update parcial, así que basta mandar estos.
const buildUpdatePayload = (item: AnalisisTemperaturaItem) => {
    const d = item.excelData;
    const payload: Record<string, unknown> = {};
    if (d.ubicacion) payload.ubicacion = d.ubicacion;
    if (d.error0 !== undefined && d.error0 !== null) payload.error0 = d.error0;
    if (d.error15 !== undefined && d.error15 !== null) payload.error15 = d.error15;
    if (d.error30 !== undefined && d.error30 !== null) payload.error30 = d.error30;
    if (d.tiene_fc) payload.tiene_fc = d.tiene_fc;
    if (d.ultima_verificacion) payload.ultima_verificacion = d.ultima_verificacion;
    if (d.estado_equipo) payload.estado_equipo = d.estado_equipo;
    if (d.observacion) {
        // Si el equipo ya tenía una observación (ej. la cargada desde el inventario
        // de equipos), se conserva y la de este archivo se agrega debajo, en vez de
        // sobreescribirla — las dos observaciones vienen de análisis distintos.
        const diffObs = item.diffs.find((diff) => diff.campo === 'observacion');
        const actual = diffObs && typeof diffObs.valorBD === 'string' ? diffObs.valorBD : '';
        payload.observacion = appendObservacion(actual, d.observacion);
    }
    if (d.equipo_asociado) payload.equipo_asociado = d.equipo_asociado;
    if (d.id_muestreador) payload.id_muestreador = d.id_muestreador;
    return payload;
};

export const EquipoTemperaturaAnalysisModal: React.FC<Props> = ({ isOpen, onClose, onDataChanged, resultadoInicial, archivoInicial }) => {
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [analizando, setAnalizando] = useState(false);
    const [resultado, setResultado] = useState<AnalisisTemperaturaResponse | null>(null);
    const [vista, setVista] = useState<Vista>('upload');
    // Vista dividida: fila abierta en el panel de la derecha y su pestaña.
    const [filaVer, setFilaVer] = useState<number | null>(null);
    const [pestanaVer, setPestanaVer] = useState<PestanaVer>('diferencias');
    // Ficha del equipo en el sistema de la fila abierta (se pide al abrirla).
    const [fichaBd, setFichaBd] = useState<{ id: number; equipo: Equipo | null; cargando: boolean } | null>(null);
    const [actualizandoFila, setActualizandoFila] = useState<number | null>(null);
    const [actualizandoTodo, setActualizandoTodo] = useState(false);
    const [progresoTodo, setProgresoTodo] = useState<{ hecho: number; total: number } | null>(null);
    const [confirmarActualizarTodo, setConfirmarActualizarTodo] = useState(false);
    const [loteResultado, setLoteResultado] = useState<LoteGuardado | null>(null);
    const [reintentandoLote, setReintentandoLote] = useState<number | null>(null);

    // Filtros — todo client-side sobre el array ya cargado en memoria.
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
    const [mostrarInforme, setMostrarInforme] = useState(false);
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
        } else if (resultadoInicial) {
            // Viene del botón unificado: ya se analizó, se salta la pantalla de subida.
            setResultado(resultadoInicial);
            setFile(archivoInicial ?? null);
            setVista('resultados');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, resultadoInicial]);

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
        setFilaVer(null);
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

    // "Ver" abre la fila en el panel de la derecha (la lista se corre a la
    // izquierda); el resultado del análisis no se toca. Otra vez "Ver" lo cierra.
    const abrirDetalle = (item: AnalisisTemperaturaItem, pestana?: PestanaVer) => {
        if (filaVer === item.rowNumber && !pestana) { setFilaVer(null); return; }
        setFilaVer(item.rowNumber);
        setPestanaVer(pestana ?? (item.status === 'difiere' ? 'diferencias' : 'excel'));
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
        await equipoService.updateEquipo(item.id_equipo, buildUpdatePayload(item));
    };

    const actualizarFila = async (item: AnalisisTemperaturaItem) => {
        setActualizandoFila(item.rowNumber);
        try {
            await actualizarEquipo(item);
            marcarComoActualizado(item.rowNumber);
            showToast({ type: 'success', message: `Equipo "${item.nombre || item.codigo}" actualizado correctamente` });
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

    // Solo lo pendiente (difiere / no encontrado) se abre en el panel: al
    // actualizarse pasa a "coincide" y el panel se cierra solo.
    const itemVer = useMemo(
        () => (filaVer === null ? null : itemsFiltrados.find((i) => i.rowNumber === filaVer && i.status !== 'coincide') || null),
        [filaVer, itemsFiltrados],
    );

    // Al abrir una fila con equipo en el sistema se trae su ficha completa
    // (para "Ficha en el sistema" y "Editar").
    const idEquipoVer = itemVer?.id_equipo ?? null;
    useEffect(() => {
        if (!idEquipoVer) { setFichaBd(null); return; }
        let vigente = true;
        setFichaBd({ id: idEquipoVer, equipo: null, cargando: true });
        equipoService.getEquipoById(idEquipoVer)
            .then((r) => { if (vigente) setFichaBd({ id: idEquipoVer, equipo: r?.success ? r.data : null, cargando: false }); })
            .catch(() => { if (vigente) setFichaBd({ id: idEquipoVer, equipo: null, cargando: false }); });
        return () => { vigente = false; };
    }, [idEquipoVer]);

    const toggleFiltroEstado = (estado: FiltroEstado) => {
        setFiltroEstado((prev) => (prev === estado ? 'todos' : estado));
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => { if (!open) { if (actualizandoTodo) return; handleClose(); } }}
        >
            <DialogContent
                className="flex h-[95vh] w-[98vw] max-w-[1800px] flex-col gap-4 overflow-hidden"
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
                            <Button size="sm" variant="outline" className="shrink-0" onClick={() => setMostrarInforme(true)}>
                                <IconFileAnalytics size={14} /> Ver informe completo
                            </Button>
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

                {/* Resultados: al presionar "Ver" la lista se corre a la izquierda (más
                    angosta) y el detalle de la fila aparece a la derecha. */}
                {vista === 'resultados' && resultado && (
                    <div className={cn(
                        'grid min-h-0 flex-1 gap-3 transition-[grid-template-columns] duration-300 ease-out',
                        itemVer ? 'grid-cols-[minmax(340px,2fr)_minmax(0,3fr)]' : 'grid-cols-[minmax(0,1fr)_0fr]',
                    )}>
                    <div className="min-h-0 overflow-auto rounded-xl border border-border bg-card">
                        <Table className={cn(itemVer && 'min-w-[760px]')} containerClassName="overflow-visible">
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Estado</TableHead>
                                    {!itemVer && <TableHead>Detalle</TableHead>}
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {itemsFiltrados.map((item) => {
                                    const viendo = filaVer === item.rowNumber;
                                    // "Ver" solo en lo que aún falta resolver (difiere / no encontrado).
                                    const pendiente = item.status !== 'coincide';
                                    return (
                                    <TableRow
                                        key={item.rowNumber}
                                        className={cn(itemVer && pendiente && 'cursor-pointer', viendo && 'bg-primary/5 hover:bg-primary/10')}
                                        onClick={itemVer && pendiente ? () => abrirDetalle(item) : undefined}
                                    >
                                        <TableCell className={cn('text-sm font-semibold text-foreground', viendo && 'border-l-2 border-l-primary')}>{item.codigo || '—'}</TableCell>
                                        <TableCell className="max-w-[260px] truncate font-medium text-foreground" title={item.nombre || ''}>{item.nombre || '—'}</TableCell>
                                        <TableCell><EstadoBadge status={item.status} meta={STATUS_META} /></TableCell>
                                        {!itemVer && <TableCell className="max-w-xs text-xs text-muted-foreground">
                                            {item.status === 'difiere' && (
                                                <span>{item.diffs.length} campo(s) distinto(s): {item.diffs.map(d => d.etiqueta).join(', ')}</span>
                                            )}
                                            {item.status === 'coincide' && <span className="text-success">Sin diferencias</span>}
                                            {item.warnings.length > 0 && (
                                                <div className="mt-1 flex items-start gap-1 text-warning">
                                                    <IconAlertTriangle size={12} className="mt-0.5 shrink-0" /> <span>{item.warnings[0]}</span>
                                                </div>
                                            )}
                                        </TableCell>}
                                        <TableCell className="whitespace-nowrap text-right" onClick={(ev) => ev.stopPropagation()}>
                                            {/* Grilla de ancho fijo por botón (Ver, Actualizar, Solicitar, Editar) — así
                                                cada uno cae siempre en la misma posición horizontal entre filas,
                                                tenga o no esa fila ese botón en particular. */}
                                            <div className="grid grid-cols-[72px_108px_88px_80px] items-center justify-items-end gap-1.5">
                                                <div>
                                                    {pendiente && (
                                                        <Button
                                                            size="sm"
                                                            variant={viendo && pestanaVer !== 'editar' ? 'default' : 'outline'}
                                                            onClick={() => (viendo && pestanaVer === 'editar' ? setPestanaVer(item.status === 'difiere' ? 'diferencias' : 'excel') : abrirDetalle(item))}
                                                            disabled={actualizandoTodo}
                                                        >
                                                            <IconEye size={14} /> {viendo && pestanaVer !== 'editar' ? 'Viendo' : 'Ver'}
                                                        </Button>
                                                    )}
                                                </div>
                                                <div>
                                                    {item.status === 'difiere' && (
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
                                                    )}
                                                </div>
                                                <div>
                                                    {extraerResponsableFaltante(item.warnings) && (
                                                        <SolicitarMuestreadorPopover
                                                            nombreSugerido={extraerResponsableFaltante(item.warnings)!}
                                                            origen="Resumen Verificaciones Intermedias T°"
                                                        />
                                                    )}
                                                </div>
                                                <div>
                                                    {item.status === 'difiere' && item.id_equipo && (
                                                        <Button
                                                            size="sm"
                                                            variant={viendo && pestanaVer === 'editar' ? 'default' : 'outline'}
                                                            onClick={() => (viendo && pestanaVer === 'editar' ? setPestanaVer('diferencias') : abrirDetalle(item, 'editar'))}
                                                            disabled={actualizandoTodo}
                                                        >
                                                            <IconPencil size={14} /> {viendo && pestanaVer === 'editar' ? 'Editando' : 'Editar'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
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

                    {/* Panel de detalle a la derecha; key = fila para que la entrada se anime al cambiar. */}
                    <div className="min-h-0 overflow-hidden">
                        {itemVer && (
                            <div key={itemVer.rowNumber} className="flex h-full min-h-0 flex-col gap-3 rounded-xl border border-border bg-background p-3 animate-in fade-in slide-in-from-right-6 duration-300">
                                <div className="flex items-start gap-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-lg font-bold leading-tight">{itemVer.codigo || 'Sin código'}</p>
                                        <p className="truncate text-sm text-muted-foreground">{itemVer.nombre || fichaBd?.equipo?.nombre || ''}</p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                            <EstadoBadge status={itemVer.status} meta={STATUS_META} />
                                            <span className="text-[11px] text-muted-foreground">Fila {itemVer.rowNumber} del Excel</span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFilaVer(null)} aria-label="Cerrar detalle" title="Cerrar detalle">
                                        <IconX size={16} />
                                    </Button>
                                </div>

                                {itemVer.warnings.length > 0 && (
                                    <div className="flex flex-col gap-1 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                                        {itemVer.warnings.map((w, i) => (
                                            <p key={i} className="flex items-start gap-1.5"><IconAlertTriangle size={13} className="mt-0.5 shrink-0" /> {w}</p>
                                        ))}
                                    </div>
                                )}

                                {/* Pestañas según el estado de la fila */}
                                <div className="flex gap-1 rounded-lg bg-muted p-1">
                                    {([
                                        itemVer.status === 'difiere' && { id: 'diferencias' as const, label: `Diferencias (${itemVer.diffs.length})` },
                                        itemVer.id_equipo && { id: 'ficha' as const, label: 'Ficha en el sistema' },
                                        { id: 'excel' as const, label: 'Datos del Excel' },
                                        itemVer.id_equipo && { id: 'editar' as const, label: 'Editar' },
                                    ].filter(Boolean) as { id: PestanaVer; label: string }[]).map((t) => (
                                        <button
                                            key={t.id}
                                            type="button"
                                            onClick={() => setPestanaVer(t.id)}
                                            className={cn('flex-1 rounded-md px-2 py-1.5 text-sm transition-colors', pestanaVer === t.id ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="flex min-h-0 flex-1 flex-col">
                                    {pestanaVer === 'diferencias' && itemVer.status === 'difiere' && (
                                        <DiffDetailView panel titulo="" diffs={itemVer.diffs} onBack={() => setFilaVer(null)} subtitulo="Lo que cambiaría en el sistema al actualizar con el Excel." />
                                    )}
                                    {(pestanaVer === 'ficha' || pestanaVer === 'editar') && itemVer.id_equipo && (
                                        !fichaBd || fichaBd.cargando ? (
                                            <div className="flex flex-1 items-center justify-center py-10">
                                                <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                            </div>
                                        ) : !fichaBd.equipo ? (
                                            <p className="py-10 text-center text-sm text-muted-foreground">No se pudo cargar la ficha del equipo.</p>
                                        ) : pestanaVer === 'ficha' ? (
                                            <EquipoDetalleLectura equipo={fichaBd.equipo} onBack={() => setFilaVer(null)} panel sinEncabezado />
                                        ) : (
                                            <div key={`form-${itemVer.rowNumber}`} className="min-h-0 flex-1 overflow-y-auto pr-1">
                                                <EquipoForm
                                                    initialData={fichaBd.equipo}
                                                    onCancel={() => setPestanaVer(itemVer.status === 'difiere' ? 'diferencias' : 'excel')}
                                                    onSave={() => {
                                                        setFilaVer(null);
                                                        reanalizar();
                                                    }}
                                                />
                                            </div>
                                        )
                                    )}
                                    {(pestanaVer === 'excel' || (pestanaVer === 'diferencias' && itemVer.status !== 'difiere')) && (
                                        <div className="min-h-0 overflow-y-auto">
                                            <PanelCampos
                                                titulo="Datos leídos del Excel"
                                                icon={<IconFileSpreadsheet size={15} />}
                                                tono="neutral"
                                                filas={Object.entries(ETIQUETAS_EXCEL)
                                                    .filter(([campo]) => itemVer.excelData[campo as keyof typeof itemVer.excelData] !== undefined)
                                                    .map(([campo, etiqueta]) => ({ campo, etiqueta, valor: itemVer.excelData[campo as keyof typeof itemVer.excelData] }))}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Acciones de la fila (el formulario de "Editar" trae las suyas) */}
                                {pestanaVer !== 'editar' && (extraerResponsableFaltante(itemVer.warnings) || itemVer.status === 'difiere') && (
                                    <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                                        {extraerResponsableFaltante(itemVer.warnings) && (
                                            <SolicitarMuestreadorPopover nombreSugerido={extraerResponsableFaltante(itemVer.warnings)!} origen="Resumen Verificaciones Intermedias T°" />
                                        )}
                                        {itemVer.status === 'difiere' && itemVer.id_equipo && (
                                            <Button variant="outline" size="sm" onClick={() => setPestanaVer('editar')} disabled={actualizandoTodo}>
                                                <IconPencil size={14} /> Editar
                                            </Button>
                                        )}
                                        {itemVer.status === 'difiere' && (
                                            <Button size="sm" onClick={() => actualizarFila(itemVer)} disabled={actualizandoFila === itemVer.rowNumber || actualizandoTodo}>
                                                {actualizandoFila === itemVer.rowNumber
                                                    ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                                    : <IconCloudUpload size={14} />}
                                                Actualizar
                                            </Button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    </div>
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
            <ImportacionInformeModal
                isOpen={mostrarInforme}
                onClose={() => setMostrarInforme(false)}
                titulo="Verificaciones de temperatura"
                archivo={file?.name}
                items={resultado?.items || []}
                rowErrors={resultado?.rowErrors || []}
            />
        </Dialog>
    );
};
