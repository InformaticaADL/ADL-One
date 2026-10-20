import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    IconUpload,
    IconCloudUpload,
    IconRefresh,
    IconAlertTriangle,
    IconArrowLeft,
    IconFileSpreadsheet,
    IconX,
    IconListDetails,
} from '@tabler/icons-react';
import { equipoService, type AnalisisExcelResponse, type AnalisisExcelItem } from '../services/equipo.service';
import { formatearTamano } from '../utils/documentosEquipo';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction } from '@/components/ui/attachment';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { EquipoForm } from './EquipoForm';
import {
    EstadoBadge, StatCard, DiffDetailView, BusquedaFlotante, LoteResultadoView,
    guardarLote, leerLote, limpiarLote, appendObservacion,
    type EstadoMeta, type LoteItemResultado, type LoteGuardado,
} from './excelAnalysisShared';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onDataChanged: () => void;
}

type Vista = 'upload' | 'resultados' | 'form' | 'detalle' | 'confirmacion_lote';
type FiltroEstado = 'todos' | AnalisisExcelItem['status'];

const LOTE_KEY = 'equipo_excel_lote_pendiente';

const getTodayString = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const addDays = (dateStr: string, days: number) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

// Mapea excelData a las claves que espera createEquipo/updateEquipo (ver
// equipo.service.ts). Compartido entre el prellenado del formulario y la
// subida directa, para que ambos caminos manden exactamente los mismos datos.
//
// El inventario real no trae fecha de verificación para la mayoría de los
// equipos (ver compararConBD en el backend, que por eso deja estos dos campos
// en null para no comparar contra la BD y generar diferencias falsas). Acá sí
// hace falta un valor: un equipo nuevo no puede quedar sin fecha, así que se
// usa hoy/+90 días — el mismo default que ya usa EquipoForm al crear — pero
// solo en este punto (armar el payload a guardar), nunca en la comparación.
const mapExcelDataToPayload = (d: AnalisisExcelItem['excelData']) => {
    const ultimaVerificacion = d.ultima_verificacion || getTodayString();
    const siguienteVerificacion = d.siguiente_verificacion || addDays(ultimaVerificacion, 90);
    return {
        codigo: d.codigo || '',
        nombre: d.nombre || '',
        tipo: d.tipo || '',
        ubicacion: d.ubicacion || '',
        vigencia: siguienteVerificacion,
        id_muestreador: d.id_muestreador || 0,
        estado: d.estado || 'Activo',
        sigla: d.sigla || '',
        correlativo: d.correlativo || 0,
        que_mide: d.que_mide || '',
        unidad_medida_textual: d.unidad_medida_textual || '',
        unidad_medida_sigla: d.unidad_medida_sigla || '',
        equipo_asociado: d.equipo_asociado || 'No Aplica',
        tiene_fc: d.tiene_fc || 'NO',
        visible_muestreador: d.visible_muestreador || 'NO',
        informe: d.informe || 'NO',
        error0: d.error0 || 0,
        error15: d.error15 || 0,
        error30: d.error30 || 0,
        observacion: d.observacion || '',
        ultima_verificacion: ultimaVerificacion,
        siguiente_verificacion: siguienteVerificacion,
        proveedor: d.proveedor || '',
        fecha_compra: d.fecha_compra || undefined,
        documento_compra: d.documento_compra || '',
        n_documento_compra: d.n_documento_compra || '',
        valor_unitario: d.valor_unitario ?? undefined,
        fecha_baja: d.fecha_baja || undefined,
        plazo_vigencia: d.plazo_vigencia || '',
        estado_equipo: d.estado_equipo || '',
    };
};

// Payload para el botón "Actualizar" directo (equipos "difiere"): a diferencia
// de mapExcelDataToPayload (creación, exige todos los campos), acá solo se
// mandan los campos que el Excel realmente trae — updateEquipo es un update
// parcial, así que lo que no se manda simplemente no se toca en la BD. Sin
// fallback hoy/+90: si el Excel no trae fecha, se deja la que ya tenía el
// equipo tal cual, no se inventa una.
const mapExcelDataToUpdatePayload = (item: AnalisisExcelItem) => {
    const d = item.excelData;
    const payload: Record<string, unknown> = {};
    if (d.nombre) payload.nombre = d.nombre;
    if (d.tipo) payload.tipo = d.tipo;
    if (d.ubicacion) payload.ubicacion = d.ubicacion;
    if (d.estado) payload.estado = d.estado;
    if (d.estado_equipo) payload.estado_equipo = d.estado_equipo;
    if (d.sigla) payload.sigla = d.sigla;
    if (d.correlativo !== undefined && d.correlativo !== null) payload.correlativo = d.correlativo;
    if (d.que_mide) payload.que_mide = d.que_mide;
    if (d.unidad_medida_textual) payload.unidad_medida_textual = d.unidad_medida_textual;
    if (d.unidad_medida_sigla) payload.unidad_medida_sigla = d.unidad_medida_sigla;
    if (d.equipo_asociado) payload.equipo_asociado = d.equipo_asociado;
    if (d.tiene_fc) payload.tiene_fc = d.tiene_fc;
    if (d.visible_muestreador) payload.visible_muestreador = d.visible_muestreador;
    if (d.informe) payload.informe = d.informe;
    if (d.error0 !== undefined && d.error0 !== null) payload.error0 = d.error0;
    if (d.error15 !== undefined && d.error15 !== null) payload.error15 = d.error15;
    if (d.error30 !== undefined && d.error30 !== null) payload.error30 = d.error30;
    if (d.observacion) {
        // Si el equipo ya tenía una observación (ej. la cargada desde el analizador
        // de temperaturas), se conserva y la de este archivo se agrega debajo, en
        // vez de sobreescribirla — las dos observaciones vienen de análisis distintos.
        const diffObs = item.diffs.find((diff) => diff.campo === 'observacion');
        const actual = diffObs && typeof diffObs.valorBD === 'string' ? diffObs.valorBD : '';
        payload.observacion = appendObservacion(actual, d.observacion);
    }
    if (d.ultima_verificacion) payload.ultima_verificacion = d.ultima_verificacion;
    if (d.proveedor) payload.proveedor = d.proveedor;
    if (d.fecha_compra) payload.fecha_compra = d.fecha_compra;
    if (d.documento_compra) payload.documento_compra = d.documento_compra;
    if (d.n_documento_compra) payload.n_documento_compra = d.n_documento_compra;
    if (d.valor_unitario !== undefined && d.valor_unitario !== null) payload.valor_unitario = d.valor_unitario;
    if (d.fecha_baja) payload.fecha_baja = d.fecha_baja;
    if (d.siguiente_verificacion) {
        // vigencia sigue a siguiente_verificacion (mismo criterio que EquipoForm).
        payload.siguiente_verificacion = d.siguiente_verificacion;
        payload.vigencia = d.siguiente_verificacion;
    }
    if (d.plazo_vigencia) payload.plazo_vigencia = d.plazo_vigencia;
    if (d.id_muestreador) payload.id_muestreador = d.id_muestreador;
    return payload;
};

// Construye el initialData que recibe EquipoForm. "difiere" solo pasa el id:
// el propio EquipoForm ya trae el equipo completo y actual desde el servidor.
// "no_existe" prellena con lo leído del Excel e id_equipo=0, que es justo lo
// que EquipoForm interpreta como "creación nueva" (ver EquipoForm.tsx, todas
// las comprobaciones son `!!initialData?.id_equipo`, no `!!initialData`).
const buildInitialData = (item: AnalisisExcelItem): any => {
    if (item.status === 'difiere' && item.id_equipo) {
        return { id_equipo: item.id_equipo };
    }
    return { id_equipo: 0, ...mapExcelDataToPayload(item.excelData) };
};

const STATUS_META: Record<AnalisisExcelItem['status'], EstadoMeta> = {
    coincide: { label: 'Coincide', badge: 'success' },
    difiere: { label: 'Difiere', badge: 'warning' },
    no_existe: { label: 'No existe', badge: 'destructive' },
};

export const EquipoExcelAnalysisModal: React.FC<Props> = ({ isOpen, onClose, onDataChanged }) => {
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [analizando, setAnalizando] = useState(false);
    const [resultado, setResultado] = useState<AnalisisExcelResponse | null>(null);
    const [vista, setVista] = useState<Vista>('upload');
    const [itemSeleccionado, setItemSeleccionado] = useState<AnalisisExcelItem | null>(null);
    const [subiendoFila, setSubiendoFila] = useState<number | null>(null);
    const [actualizandoFila, setActualizandoFila] = useState<number | null>(null);
    const [subiendoTodo, setSubiendoTodo] = useState(false);
    const [actualizandoTodo, setActualizandoTodo] = useState(false);
    const [progresoTodo, setProgresoTodo] = useState<{ hecho: number; total: number } | null>(null);
    const [confirmarSubirTodo, setConfirmarSubirTodo] = useState(false);
    const [confirmarActualizarTodo, setConfirmarActualizarTodo] = useState(false);
    const [loteResultado, setLoteResultado] = useState<LoteGuardado | null>(null);
    const [reintentandoLote, setReintentandoLote] = useState<number | null>(null);

    // Filtros — todo client-side sobre el array ya cargado en memoria.
    const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
    const [filtroSede, setFiltroSede] = useState('todos');
    const [soloAdvertencias, setSoloAdvertencias] = useState(false);
    const [busqueda, setBusqueda] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const procesandoLote = subiendoTodo || actualizandoTodo;

    // Si quedó un lote sin confirmar de una sesión anterior (cierre accidental
    // de pestaña, recarga a mitad de un "Subir/Actualizar Todo"), se muestra
    // de nuevo apenas se abre el modal, en vez de perderse en silencio.
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
        if (!procesandoLote) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [procesandoLote]);

    const reset = () => {
        setFile(null);
        setResultado(null);
        setVista('upload');
        setItemSeleccionado(null);
        setFiltroEstado('todos');
        setFiltroSede('todos');
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
            const res = await equipoService.analizarExcel(archivo);
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

    const abrirForm = (item: AnalisisExcelItem) => {
        setItemSeleccionado(item);
        setVista('form');
    };

    // "Ver" solo cambia de vista — el resultado del análisis (resultado, items)
    // no se toca, así que "Volver a resultados" deja la lista exactamente como
    // estaba, sin volver a subir ni re-analizar el archivo.
    const abrirDetalle = (item: AnalisisExcelItem) => {
        setItemSeleccionado(item);
        setVista('detalle');
    };

    // Quita el item del contador "No existen" y lo pasa a "Coinciden" en el estado local,
    // sin tener que re-subir y re-analizar todo el Excel de nuevo tras cada creación —
    // con 700+ filas esa re-consulta completa sería lenta para algo que ya sabemos que
    // ahora existe (lo acabamos de crear con estos mismos datos).
    const marcarComoCreado = (rowNumber: number, idEquipo: number) => {
        setResultado((prev) => {
            if (!prev) return prev;
            const items = prev.items.map((it) =>
                it.rowNumber === rowNumber
                    ? { ...it, status: 'coincide' as const, id_equipo: idEquipo, diffs: [], warnings: [] }
                    : it
            );
            return {
                ...prev,
                items,
                resumen: {
                    ...prev.resumen,
                    noExisten: Math.max(0, prev.resumen.noExisten - 1),
                    coinciden: prev.resumen.coinciden + 1,
                },
            };
        });
    };

    // Igual que marcarComoCreado pero para "difiere" → "coincide": tras actualizar,
    // ya no hay diferencias que mostrar.
    const marcarComoActualizado = (rowNumber: number) => {
        setResultado((prev) => {
            if (!prev) return prev;
            const items = prev.items.map((it) =>
                it.rowNumber === rowNumber ? { ...it, status: 'coincide' as const, diffs: [] } : it
            );
            return {
                ...prev,
                items,
                resumen: {
                    ...prev.resumen,
                    difieren: Math.max(0, prev.resumen.difieren - 1),
                    coinciden: prev.resumen.coinciden + 1,
                },
            };
        });
    };

    // Botón "Actualizar" en una fila "difiere": guarda directo los campos que trae
    // el Excel para ese equipo (update parcial), sin pasar por el formulario completo.
    const actualizarFila = async (item: AnalisisExcelItem, volverAResultados = false) => {
        if (!item.id_equipo) return;
        setActualizandoFila(item.rowNumber);
        try {
            await equipoService.updateEquipo(item.id_equipo, mapExcelDataToUpdatePayload(item));
            marcarComoActualizado(item.rowNumber);
            showToast({ type: 'success', message: `Equipo "${item.nombre || item.codigo}" actualizado correctamente` });
            if (volverAResultados) setVista('resultados');
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'No se pudo actualizar el equipo' });
        } finally {
            setActualizandoFila(null);
        }
    };

    // Crea el equipo directamente con lo leído del Excel, sin pasar por el formulario.
    // Si el Excel no trajo Código, se genera uno (mismo endpoint que usa EquipoForm al
    // crear) antes de guardar — secuencial a propósito: así "Subir Todo" ve, en cada
    // vuelta, el correlativo recién usado por la anterior y no genera códigos duplicados.
    const crearEquipoDesdeExcel = async (item: AnalisisExcelItem) => {
        const payload = mapExcelDataToPayload(item.excelData);
        if (!payload.codigo) {
            const sugerido = await equipoService.suggestNextCode(payload.tipo, payload.ubicacion, payload.nombre);
            if (sugerido?.success && sugerido.data?.suggestedCode) {
                payload.codigo = sugerido.data.suggestedCode;
                payload.sigla = sugerido.data.sigla || payload.sigla;
                payload.correlativo = sugerido.data.correlativo ?? payload.correlativo;
            }
        }
        const res = await equipoService.createEquipo(payload);
        if (!res?.success) {
            throw new Error(res?.message || 'No se pudo crear el equipo');
        }
        return res.data?.id as number;
    };

    const subirFila = async (item: AnalisisExcelItem) => {
        setSubiendoFila(item.rowNumber);
        try {
            const idEquipo = await crearEquipoDesdeExcel(item);
            marcarComoCreado(item.rowNumber, idEquipo);
            showToast({ type: 'success', message: `Equipo "${item.nombre || item.excelData.codigo}" creado correctamente` });
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || err?.message || 'No se pudo crear el equipo' });
        } finally {
            setSubiendoFila(null);
        }
    };

    // Núcleo compartido de "Subir Todo"/"Actualizar Todo": procesa la lista
    // secuencialmente, respalda el progreso en localStorage después de cada
    // ítem (sobrevive a un cierre accidental de pestaña), y al terminar pasa a
    // la pantalla de confirmación con el detalle completo — no solo un toast.
    const procesarLote = async (
        tipo: 'subir' | 'actualizar',
        titulo: string,
        items: AnalisisExcelItem[],
        accion: (item: AnalisisExcelItem) => Promise<void>,
        setFlag: (v: boolean) => void,
    ) => {
        setFlag(true);
        setProgresoTodo({ hecho: 0, total: items.length });
        const loteItems: LoteItemResultado[] = [];

        for (const item of items) {
            try {
                await accion(item);
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
            guardarLote(LOTE_KEY, { tipo, items: loteItems, terminado: false, timestamp: Date.now() });
        }

        setFlag(false);
        setProgresoTodo(null);
        const loteFinal: LoteGuardado = { tipo: titulo, items: loteItems, terminado: true, timestamp: Date.now() };
        guardarLote(LOTE_KEY, loteFinal);
        setLoteResultado(loteFinal);
        setVista('confirmacion_lote');
    };

    const subirTodosLosFaltantes = async () => {
        setConfirmarSubirTodo(false);
        const faltantes = resultado?.items.filter((i) => i.status === 'no_existe') || [];
        if (faltantes.length === 0) return;
        await procesarLote('subir', 'Subida masiva de equipos', faltantes, async (item) => {
            const idEquipo = await crearEquipoDesdeExcel(item);
            marcarComoCreado(item.rowNumber, idEquipo);
        }, setSubiendoTodo);
    };

    const actualizarTodosLosDiferentes = async () => {
        setConfirmarActualizarTodo(false);
        const diferentes = resultado?.items.filter((i) => i.status === 'difiere') || [];
        if (diferentes.length === 0) return;
        await procesarLote('actualizar', 'Actualización masiva de equipos', diferentes, async (item) => {
            await equipoService.updateEquipo(item.id_equipo!, mapExcelDataToUpdatePayload(item));
            marcarComoActualizado(item.rowNumber);
        }, setActualizandoTodo);
    };

    // "Reintentar" en la pantalla de confirmación: vuelve a intentar solo ese
    // ítem puntual. Busca la fila original en `resultado` (sigue ahí, con sus
    // datos del Excel, porque solo se marcan como "coincide" las que sí se
    // guardaron bien) y repite la misma acción que usó el lote.
    const reintentarItemLote = async (loteItem: LoteItemResultado) => {
        if (!resultado || !loteResultado) return;
        const item = resultado.items.find((i) => i.rowNumber === loteItem.rowNumber);
        if (!item) return;

        setReintentandoLote(loteItem.rowNumber);
        try {
            if (loteResultado.tipo.includes('Subida') || item.status === 'no_existe') {
                const idEquipo = await crearEquipoDesdeExcel(item);
                marcarComoCreado(item.rowNumber, idEquipo);
            } else {
                await equipoService.updateEquipo(item.id_equipo!, mapExcelDataToUpdatePayload(item));
                marcarComoActualizado(item.rowNumber);
            }
            setLoteResultado((prev) => {
                if (!prev) return prev;
                const items = prev.items.map((i) => i.rowNumber === loteItem.rowNumber ? { ...i, estado: 'ok' as const, mensaje: undefined } : i);
                const actualizado = { ...prev, items };
                guardarLote(LOTE_KEY, actualizado);
                return actualizado;
            });
            showToast({ type: 'success', message: `"${loteItem.nombre || loteItem.codigo}" guardado correctamente` });
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

    const sedesDisponibles = useMemo(() => {
        const set = new Set<string>();
        resultado?.items.forEach((i) => { if (i.excelData.ubicacion) set.add(i.excelData.ubicacion); });
        return Array.from(set).sort();
    }, [resultado]);

    const itemsFiltrados = useMemo(() => {
        if (!resultado) return [];
        return resultado.items.filter((item) => {
            if (filtroEstado !== 'todos' && item.status !== filtroEstado) return false;
            if (filtroSede !== 'todos' && item.excelData.ubicacion !== filtroSede) return false;
            if (soloAdvertencias && item.warnings.length === 0) return false;
            if (busqueda.trim()) {
                const q = busqueda.trim().toLowerCase();
                const enCodigo = (item.codigo || '').toLowerCase().includes(q);
                const enNombre = (item.nombre || '').toLowerCase().includes(q);
                if (!enCodigo && !enNombre) return false;
            }
            return true;
        });
    }, [resultado, filtroEstado, filtroSede, soloAdvertencias, busqueda]);

    const toggleFiltroEstado = (estado: FiltroEstado) => {
        setFiltroEstado((prev) => (prev === estado ? 'todos' : estado));
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => { if (!open) { if (procesandoLote) return; handleClose(); } }}
        >
            <DialogContent
                className="flex max-h-[88vh] max-w-5xl flex-col gap-4 overflow-hidden"
                showCloseButton={!procesandoLote}
                onInteractOutside={(e) => { if (procesandoLote) e.preventDefault(); }}
                onEscapeKeyDown={(e) => { if (procesandoLote) e.preventDefault(); }}
            >
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconListDetails size={20} className="text-primary" />
                        Importar y Validar Equipos desde Excel
                    </DialogTitle>
                </DialogHeader>

                {procesandoLote && (
                    <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                        No cierres esta ventana mientras se procesa — el progreso queda respaldado, pero es mejor esperar a que termine.
                    </p>
                )}

                {/* Este resumen se mantiene visible aunque se abra el formulario de edición,
                    para no perder el contexto del análisis mientras se corrige un equipo. Los
                    contadores (Coinciden/Difieren/No existen) son clicables: filtran la tabla. */}
                {resultado && vista !== 'confirmacion_lote' && (
                    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-stretch">
                        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                            <StatCard label="Total analizados" value={resultado.resumen.total} tone="default" onClick={() => setFiltroEstado('todos')} active={filtroEstado === 'todos'} />
                            <StatCard label="Coinciden" value={resultado.resumen.coinciden} tone="success" onClick={() => toggleFiltroEstado('coincide')} active={filtroEstado === 'coincide'} />
                            <StatCard label="Difieren" value={resultado.resumen.difieren} tone="warning" onClick={() => toggleFiltroEstado('difiere')} active={filtroEstado === 'difiere'} />
                            <StatCard label="No existen" value={resultado.resumen.noExisten} tone="destructive" onClick={() => toggleFiltroEstado('no_existe')} active={filtroEstado === 'no_existe'} />
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            {resultado.resumen.noExisten > 0 && (
                                <Button
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => setConfirmarSubirTodo(true)}
                                    disabled={procesandoLote || analizando}
                                >
                                    {subiendoTodo ? (
                                        <>
                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                            Subiendo {progresoTodo ? `${progresoTodo.hecho}/${progresoTodo.total}` : '...'}
                                        </>
                                    ) : (
                                        <><IconCloudUpload size={14} /> Subir Todo ({resultado.resumen.noExisten})</>
                                    )}
                                </Button>
                            )}
                            {resultado.resumen.difieren > 0 && (
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="shrink-0"
                                    onClick={() => setConfirmarActualizarTodo(true)}
                                    disabled={procesandoLote || analizando}
                                >
                                    {actualizandoTodo ? (
                                        <>
                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            Actualizando {progresoTodo ? `${progresoTodo.hecho}/${progresoTodo.total}` : '...'}
                                        </>
                                    ) : (
                                        <><IconCloudUpload size={14} /> Actualizar Todo ({resultado.resumen.difieren})</>
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                onClick={reanalizar}
                                disabled={analizando || procesandoLote}
                            >
                                <IconRefresh size={14} className={cn(analizando && 'animate-spin')} /> Volver a analizar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Sistema de filtros: por sede, "solo con advertencias" y la lupa de
                    búsqueda flotante por código/nombre — todo sobre el array en memoria. */}
                {resultado && vista === 'resultados' && (
                    <div className="flex flex-wrap items-center gap-2">
                        {sedesDisponibles.length > 1 && (
                            <div className="w-40">
                                <Combobox
                                    value={filtroSede}
                                    onValueChange={setFiltroSede}
                                    placeholder="Sede"
                                    options={[{ value: 'todos', label: 'Todas las sedes' }, ...sedesDisponibles.map((s) => ({ value: s, label: s }))]}
                                />
                            </div>
                        )}
                        <Button
                            variant={soloAdvertencias ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSoloAdvertencias((v) => !v)}
                        >
                            <IconAlertTriangle size={14} /> Solo con advertencias
                        </Button>
                        {(filtroEstado !== 'todos' || filtroSede !== 'todos' || soloAdvertencias || busqueda) && (
                            <Button variant="ghost" size="sm" onClick={() => { setFiltroEstado('todos'); setFiltroSede('todos'); setSoloAdvertencias(false); setBusqueda(''); }}>
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
                            <p className="text-sm font-medium">Arrastre el inventario (OI-FoGe-21) o haga clic para seleccionarlo</p>
                            <p className="text-xs text-muted-foreground">Archivo Excel (.xlsx) de hasta 10 MB — hoja "EQUIPOS MUESTREO"</p>
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

                        <Button
                            className="self-center px-8"
                            onClick={() => file && analizar(file)}
                            disabled={!file || analizando}
                        >
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
                                                {item.status === 'no_existe' && (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => subirFila(item)}
                                                        disabled={subiendoFila === item.rowNumber || procesandoLote}
                                                    >
                                                        {subiendoFila === item.rowNumber ? (
                                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                                        ) : (
                                                            <IconUpload size={14} />
                                                        )}
                                                        Subir
                                                    </Button>
                                                )}
                                                {item.status === 'difiere' && (
                                                    <>
                                                        <Button size="sm" variant="outline" onClick={() => abrirDetalle(item)} disabled={procesandoLote}>
                                                            Ver
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => actualizarFila(item)}
                                                            disabled={actualizandoFila === item.rowNumber || procesandoLote}
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
                                                {item.status !== 'coincide' && (
                                                    <Button size="sm" variant="outline" onClick={() => abrirForm(item)} disabled={procesandoLote}>
                                                        {item.status === 'no_existe' ? 'Revisar' : 'Editar'}
                                                    </Button>
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
                        <Button variant="outline" size="sm" onClick={() => abrirForm(itemSeleccionado)}>
                            Editar en formulario completo
                        </Button>
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

                {vista === 'form' && itemSeleccionado && (
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <Button variant="ghost" size="sm" className="mb-2" onClick={() => setVista('resultados')}>
                            <IconArrowLeft size={14} /> Volver a resultados
                        </Button>
                        <EquipoForm
                            initialData={buildInitialData(itemSeleccionado)}
                            onCancel={() => setVista('resultados')}
                            onSave={() => {
                                setVista('resultados');
                                reanalizar();
                            }}
                        />
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

            <Dialog open={confirmarSubirTodo} onOpenChange={setConfirmarSubirTodo}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Subir todos los equipos faltantes</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Se van a crear <b>{resultado?.resumen.noExisten ?? 0}</b> equipo(s) marcados como "No existe", usando tal cual los datos leídos del Excel (sin pasar por el formulario de revisión). Si algún código no viene en el Excel, se genera automáticamente. Al terminar se mostrará una pantalla de confirmación con el detalle.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmarSubirTodo(false)}>Cancelar</Button>
                        <Button onClick={subirTodosLosFaltantes}>
                            <IconCloudUpload size={14} /> Confirmar y Subir Todo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmarActualizarTodo} onOpenChange={setConfirmarActualizarTodo}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Actualizar todos los equipos con diferencias</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Se van a actualizar <b>{resultado?.resumen.difieren ?? 0}</b> equipo(s) marcados como "Difiere", usando tal cual los datos leídos del Excel (sin pasar por el formulario de revisión). Al terminar se mostrará una pantalla de confirmación con el detalle.
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
