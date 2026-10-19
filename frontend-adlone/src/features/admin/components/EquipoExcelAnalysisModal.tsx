import React, { useRef, useState } from 'react';
import {
    IconUpload,
    IconCloudUpload,
    IconRefresh,
    IconCheck,
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
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Attachment, AttachmentMedia, AttachmentContent, AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction } from '@/components/ui/attachment';
import { cn } from '@/lib/utils';
import { EquipoForm } from './EquipoForm';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onDataChanged: () => void;
}

type Vista = 'upload' | 'resultados' | 'form';

// Mapea excelData a las claves que espera createEquipo/updateEquipo (ver
// equipo.service.ts). Compartido entre el prellenado del formulario y la
// subida directa, para que ambos caminos manden exactamente los mismos datos.
const mapExcelDataToPayload = (d: AnalisisExcelItem['excelData']) => ({
    codigo: d.codigo || '',
    nombre: d.nombre || '',
    tipo: d.tipo || '',
    ubicacion: d.ubicacion || '',
    vigencia: d.siguiente_verificacion || '',
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
    ultima_verificacion: d.ultima_verificacion || '',
    siguiente_verificacion: d.siguiente_verificacion || '',
    plazo_vigencia: d.plazo_vigencia || '',
    estado_equipo: d.estado_equipo || '',
});

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

const STATUS_META: Record<AnalisisExcelItem['status'], { label: string; badge: 'success' | 'warning' | 'destructive' }> = {
    coincide: { label: 'Coincide', badge: 'success' },
    difiere: { label: 'Difiere', badge: 'warning' },
    no_existe: { label: 'No existe', badge: 'destructive' },
};

const StatusBadge: React.FC<{ status: AnalisisExcelItem['status'] }> = ({ status }) => {
    const meta = STATUS_META[status];
    return (
        <Badge variant={meta.badge} className="gap-1">
            {status === 'coincide' && <IconCheck size={12} />}
            {status === 'difiere' && <IconAlertTriangle size={12} />}
            {status === 'no_existe' && <IconX size={12} />}
            {meta.label}
        </Badge>
    );
};

const StatCard: React.FC<{
    label: string;
    value: number;
    tone: 'default' | 'success' | 'warning' | 'destructive';
}> = ({ label, value, tone }) => (
    <div
        className={cn(
            'flex flex-1 flex-col gap-0.5 rounded-lg border px-3 py-2',
            tone === 'default' && 'border-border bg-muted/30',
            tone === 'success' && 'border-success/20 bg-success/10',
            tone === 'warning' && 'border-warning/20 bg-warning/10',
            tone === 'destructive' && 'border-destructive/20 bg-destructive/10'
        )}
    >
        <span className={cn(
            'text-xl font-semibold leading-none',
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning',
            tone === 'destructive' && 'text-destructive'
        )}>
            {value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
    </div>
);

export const EquipoExcelAnalysisModal: React.FC<Props> = ({ isOpen, onClose, onDataChanged }) => {
    const [file, setFile] = useState<File | null>(null);
    const [dragOver, setDragOver] = useState(false);
    const [analizando, setAnalizando] = useState(false);
    const [resultado, setResultado] = useState<AnalisisExcelResponse | null>(null);
    const [vista, setVista] = useState<Vista>('upload');
    const [itemSeleccionado, setItemSeleccionado] = useState<AnalisisExcelItem | null>(null);
    const [subiendoFila, setSubiendoFila] = useState<number | null>(null);
    const [subiendoTodo, setSubiendoTodo] = useState(false);
    const [progresoTodo, setProgresoTodo] = useState<{ hecho: number; total: number } | null>(null);
    const [confirmarSubirTodo, setConfirmarSubirTodo] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { showToast } = useToast();

    const reset = () => {
        setFile(null);
        setResultado(null);
        setVista('upload');
        setItemSeleccionado(null);
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

    const subirTodosLosFaltantes = async () => {
        setConfirmarSubirTodo(false);
        const faltantes = resultado?.items.filter((i) => i.status === 'no_existe') || [];
        if (faltantes.length === 0) return;

        setSubiendoTodo(true);
        setProgresoTodo({ hecho: 0, total: faltantes.length });
        let creados = 0;
        const errores: { nombre: string; message: string }[] = [];

        for (const item of faltantes) {
            try {
                const idEquipo = await crearEquipoDesdeExcel(item);
                marcarComoCreado(item.rowNumber, idEquipo);
                creados++;
            } catch (err: any) {
                errores.push({ nombre: item.nombre || item.excelData.codigo || `fila ${item.rowNumber}`, message: err?.response?.data?.message || err?.message || 'Error desconocido' });
            }
            setProgresoTodo((prev) => prev ? { ...prev, hecho: prev.hecho + 1 } : prev);
        }

        setSubiendoTodo(false);
        setProgresoTodo(null);

        if (errores.length === 0) {
            showToast({ type: 'success', message: `${creados} equipo(s) creado(s) correctamente` });
        } else {
            showToast({
                type: errores.length === faltantes.length ? 'error' : 'warning',
                message: `${creados} creado(s), ${errores.length} con error. Ej: ${errores[0].nombre} — ${errores[0].message}`,
            });
        }
    };

    const seleccionarArchivo = (f: File | null) => {
        if (f && !f.name.toLowerCase().endsWith('.xlsx')) {
            showToast({ type: 'error', message: 'Solo se aceptan archivos Excel (.xlsx)' });
            return;
        }
        setFile(f);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col gap-4 overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <IconListDetails size={20} className="text-primary" />
                        Importar y Validar Equipos desde Excel
                    </DialogTitle>
                </DialogHeader>

                {/* Este resumen se mantiene visible aunque se abra el formulario de edición,
                    para no perder el contexto del análisis mientras se corrige un equipo. */}
                {resultado && (
                    <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-stretch">
                        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
                            <StatCard label="Total analizados" value={resultado.resumen.total} tone="default" />
                            <StatCard label="Coinciden" value={resultado.resumen.coinciden} tone="success" />
                            <StatCard label="Difieren" value={resultado.resumen.difieren} tone="warning" />
                            <StatCard label="No existen" value={resultado.resumen.noExisten} tone="destructive" />
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                            {resultado.resumen.noExisten > 0 && (
                                <Button
                                    size="sm"
                                    className="shrink-0"
                                    onClick={() => setConfirmarSubirTodo(true)}
                                    disabled={subiendoTodo || analizando}
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
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                onClick={reanalizar}
                                disabled={analizando || subiendoTodo}
                            >
                                <IconRefresh size={14} className={cn(analizando && 'animate-spin')} /> Volver a analizar
                            </Button>
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
                            <p className="text-sm font-medium">Arrastre la plantilla o haga clic para seleccionarla</p>
                            <p className="text-xs text-muted-foreground">Archivo Excel (.xlsx) de hasta 10 MB</p>
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
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Detalle</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {resultado.items.map((item) => (
                                    <TableRow key={item.rowNumber}>
                                        <TableCell className="font-mono text-xs">{item.codigo || '—'}</TableCell>
                                        <TableCell className="font-medium">{item.nombre || '—'}</TableCell>
                                        <TableCell><StatusBadge status={item.status} /></TableCell>
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
                                                        disabled={subiendoFila === item.rowNumber || subiendoTodo}
                                                    >
                                                        {subiendoFila === item.rowNumber ? (
                                                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                                        ) : (
                                                            <IconUpload size={14} />
                                                        )}
                                                        Subir
                                                    </Button>
                                                )}
                                                {item.status !== 'coincide' && (
                                                    <Button size="sm" variant="outline" onClick={() => abrirForm(item)} disabled={subiendoTodo}>
                                                        {item.status === 'no_existe' ? 'Revisar' : 'Editar'}
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        {resultado.rowErrors.length > 0 && (
                            <div className="m-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                                {resultado.rowErrors.map((e, i) => <div key={i}>Fila {e.rowNumber}: {e.message}</div>)}
                            </div>
                        )}
                    </div>
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
            </DialogContent>

            <Dialog open={confirmarSubirTodo} onOpenChange={setConfirmarSubirTodo}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Subir todos los equipos faltantes</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        Se van a crear <b>{resultado?.resumen.noExisten ?? 0}</b> equipo(s) marcados como "No existe", usando tal cual los datos leídos del Excel (sin pasar por el formulario de revisión). Si algún código no viene en el Excel, se genera automáticamente. Esta acción no se puede deshacer en lote.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmarSubirTodo(false)}>Cancelar</Button>
                        <Button onClick={subirTodosLosFaltantes}>
                            <IconCloudUpload size={14} /> Confirmar y Subir Todo
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
};
