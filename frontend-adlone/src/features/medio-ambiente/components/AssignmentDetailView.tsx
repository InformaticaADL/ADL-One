import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useCatalogos } from '../context/CatalogosContext';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { adminService } from '../../../services/admin.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    IconDeviceFloppy,
    IconBolt,
    IconBuilding,
    IconTarget,
    IconMapPin,
    IconUser,
    IconPencil
} from '@tabler/icons-react';

interface Props {
    fichaId: number;
    onBack: () => void;
}

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

interface ConfirmDialogState {
    title: string;
    content: React.ReactNode;
    okText?: string;
    cancelText?: string;
    destructive?: boolean;
    onOk: () => void;
}

export const AssignmentDetailView: React.FC<Props> = ({ fichaId, onBack }) => {
    // Context & Services
    const { getCatalogo } = useCatalogos();
    const { showToast } = useToast();
    const { user } = useAuth();

    // State
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    const [muestreadorInstalacion, setMuestreadorInstalacion] = useState<Record<number, number>>({});
    const [muestreadorRetiro, setMuestreadorRetiro] = useState<Record<number, number>>({});
    const [selectedDate, setSelectedDate] = useState('');
    const [dbFieldValue, setDbFieldValue] = useState('');
    const [frequencyDays, setFrequencyDays] = useState<number>(0);
    const [numericFrequency, setNumericFrequency] = useState<number>(1);
    const [frecuenciaFactor, setFrecuenciaFactor] = useState<number>(1);
    const [duracionMuestreo, setDuracionMuestreo] = useState<number>(0);
    const [editableDates, setEditableDates] = useState<Record<number, string>>({});
    const [editableRetiroDates, setEditableRetiroDates] = useState<Record<number, string>>({});
    // Snapshot of data as loaded from DB — used to identify rows already saved
    const [savedDates, setSavedDates] = useState<Record<number, string>>({});
    const [savedRetiroDates, setSavedRetiroDates] = useState<Record<number, string>>({});
    const [savedInstalacion, setSavedInstalacion] = useState<Record<number, number>>({});
    const [savedRetiro, setSavedRetiro] = useState<Record<number, number>>({});
    // Rows the user explicitly unlocked for editing this session
    const [editingRows, setEditingRows] = useState<Set<number>>(new Set());

    // New State for Versions Comparison
    const [versionModalOpen, setVersionModalOpen] = useState(false);
    const [comparisonLoading, setComparisonLoading] = useState(false);
    const [comparisonData, setComparisonData] = useState<any[]>([]);
    const [activeRowCorrelativo, setActiveRowCorrelativo] = useState('');
    // State to store chosen versions: { correlativo: { idEquipo: 'original' | 'nueva' } }
    const [equipmentSelections, setEquipmentSelections] = useState<Record<string, Record<number, 'original' | 'nueva'>>>({});
    const [observacionAsignacion, setObservacionAsignacion] = useState('');

    // Generic confirmation dialog — replaces antd Modal.confirm for every
    // branch below (technician conflicts, bulk assignment overrides, partial
    // save, resampling conflicts). Each caller supplies its own content and
    // decides what happens on confirm.
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

    const resamplingData = useMemo(() => {
        if (rows.length === 0) return null;
        const first = rows[0];
        // Normalización para SQL Server (puede venir como 'S', 1 o boolean)
        if (first.es_remuestreo !== 'S' && first.es_remuestreo !== true && first.es_remuestreo !== 1) return null;

        return {
            idOriginal: first.id_ficha_original,
            nombreOriginal: first.nombre_muestreador_original,
            idMuestreadorOriginal: first.id_muestreador_original
        };
    }, [rows]);

    const activeServicesCount = useMemo(() => {
        return rows.filter(r => !['CANCELADO', 'ANULADO'].includes((r.nombre_estadomuestreo || '').toUpperCase())).length;
    }, [rows]);

    // ✅ PUNTUAL = un solo proceso, una sola fecha. No se divide en instalación/retiro.
    // Para estas fichas se muestra y guarda únicamente la "Fecha Muestreo" (y un único muestreador).
    const isPuntual = useMemo(() => {
        return (rows[0]?.tipo_fichaingresoservicio || '').toString().trim().toLowerCase() === 'puntual';
    }, [rows]);

    const handleTechnicianChange = (rowId: number, newId: number, type: 'instalacion' | 'retiro') => {
        const applyChange = () => {
            if (type === 'instalacion') {
                setMuestreadorInstalacion(p => ({ ...p, [rowId]: newId }));
                if (!muestreadorRetiro[rowId]) {
                    setMuestreadorRetiro(p => ({ ...p, [rowId]: newId }));
                }
            } else {
                setMuestreadorRetiro(p => ({ ...p, [rowId]: newId }));
            }
        };

        // Validación de conflicto (Remuestreo) - confirmación previa
        if (resamplingData && resamplingData.idMuestreadorOriginal && newId !== 0 && newId !== resamplingData.idMuestreadorOriginal) {
            setConfirmDialog({
                title: 'Confirmar Cambio de Muestreador',
                okText: 'Confirmar Asignación',
                cancelText: 'Cancelar',
                content: (
                    <div className="flex flex-col gap-1.5 text-sm">
                        <p>Atención: El muestreador seleccionado no es el que realizó el muestreo original (<b>{resamplingData.nombreOriginal}</b>).</p>
                        <p className="text-muted-foreground">Cambiar el muestreador en un remuestreo puede generar conflictos técnicos, ya que el nuevo muestreador podría no contar con los mismos equipos o conocimientos específicos utilizados en el muestreo original.</p>
                        <p className="font-semibold">¿Desea proceder con esta asignación de todas formas?</p>
                    </div>
                ),
                onOk: () => { applyChange(); setConfirmDialog(null); },
            });
        } else {
            applyChange();
        }
    };

    const handleViewVersions = async (idMuestreador: number, correlativo: string) => {
        if (!resamplingData?.idOriginal || !idMuestreador) return;

        setComparisonLoading(true);
        setVersionModalOpen(true);
        setActiveRowCorrelativo(correlativo);

        try {
            const response = await adminService.getEquipmentComparison(resamplingData.idOriginal, fichaId, idMuestreador);
            if (response.success) {
                setComparisonData(response.data);

                // Initialize selections for this correlativo if not set
                if (!equipmentSelections[correlativo]) {
                    const initial: Record<number, 'original' | 'nueva'> = {};
                    response.data.forEach((item: any) => {
                        // Default to original if version is the same, otherwise require choice?
                        // Let's default to original to be safer in resampling
                        initial[item.id_equipo] = 'original';
                    });
                    setEquipmentSelections(prev => ({ ...prev, [correlativo]: initial }));
                }
            } else {
                showToast({ message: 'Error al obtener comparación de equipos', type: 'error' });
            }
        } catch (error) {
            console.error("Error fetching comparison:", error);
            showToast({ message: 'Error al conectar con el servidor', type: 'error' });
        } finally {
            setComparisonLoading(false);
        }
    };

    const handleBulkSelection = (type: 'original' | 'nueva') => {
        if (!activeRowCorrelativo || comparisonData.length === 0) return;

        const newSelections = { ...equipmentSelections[activeRowCorrelativo] };
        comparisonData.forEach(item => {
            newSelections[item.id_equipo] = type;
        });

        setEquipmentSelections(prev => ({
            ...prev,
            [activeRowCorrelativo]: newSelections
        }));
    };

    const loadAssignmentData = async () => {
        setLoading(true);
        try {
            const data = await fichaService.getAssignmentDetail(fichaId);
            if (Array.isArray(data)) {
                setRows(data);
                if (data.length > 0) {
                    setDbFieldValue(data[0].nombre_frecuencia || '');
                    setFrequencyDays(data[0].dias || 0);
                    setNumericFrequency(Number(data[0].frecuencia) || 1);
                    setFrecuenciaFactor(Number(data[0].frecuencia_factor) || 1);
                    setDuracionMuestreo(Number(data[0].ma_duracion_muestreo) || 0);

                    const existingDates: Record<number, string> = {};
                    const existingRetiroDates: Record<number, string> = {};
                    const existingInstalacion: Record<number, number> = {};
                    const existingRetiro: Record<number, number> = {};

                    let firstRowDate = '';

                    data.forEach((row: any) => {
                        let samplingDate = '';
                        if (row.fecha_muestreo && !['  /  /    ', '01/01/1900', '1900-01-01'].includes(row.fecha_muestreo)) {
                            samplingDate = formatDate(row.fecha_muestreo);
                        } else if (row.dia && row.mes && row.ano) {
                            samplingDate = `${row.ano}-${String(row.mes).padStart(2, '0')}-${String(row.dia).padStart(2, '0')}`;
                        }

                        if (samplingDate) {
                            existingDates[row.id_agendamam] = samplingDate;
                            if (!firstRowDate) firstRowDate = samplingDate;
                        }

                        if (row.fecha_retiro && !['01/01/1900', '1900-01-01', '  /  /    '].includes(row.fecha_retiro)) {
                            existingRetiroDates[row.id_agendamam] = formatDate(row.fecha_retiro);
                        }

                        if (row.id_muestreador) existingInstalacion[row.id_agendamam] = row.id_muestreador;
                        if (row.id_muestreador2) existingRetiro[row.id_agendamam] = row.id_muestreador2;
                    });

                    setEditableDates(existingDates);
                    setEditableRetiroDates(existingRetiroDates);
                    setSavedDates({ ...existingDates });
                    setSavedRetiroDates({ ...existingRetiroDates });
                    setMuestreadorInstalacion(existingInstalacion);
                    setMuestreadorRetiro(existingRetiro);
                    setSavedInstalacion({ ...existingInstalacion });
                    setSavedRetiro({ ...existingRetiro });
                    setEditingRows(new Set());
                    if (firstRowDate && !selectedDate) setSelectedDate(firstRowDate);
                }
            }
        } catch (error) {
            console.error("Error loading assignment data:", error);
            showToast({ message: 'Error al cargar datos de asignación', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: any) => {
        if (!date) return '';
        let dateStr = '';
        if (typeof date === 'string') {
            if (date.includes('T')) dateStr = date.split('T')[0];
            else if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 3) dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (date.includes('-')) dateStr = date;
        } else if (date instanceof Date) {
            dateStr = date.toISOString().split('T')[0];
        }
        return dateStr;
    };

    useEffect(() => {
        const loadInitialData = async () => {
            await loadAssignmentData();
            try {
                const mData = await getCatalogo('muestreadores', () => catalogosService.getMuestreadores());
                setMuestreadores(mData || []);
            } catch (err) {
                console.error("Error loading muestreadores:", err);
            }
        };

        if (fichaId) {
            loadInitialData();
        }
    }, [fichaId]);

    const handleCalculateDates = () => {
        if (rows.length === 0 || !selectedDate) return;

        const newDates: Record<number, string> = {};
        const newRetiroDates: Record<number, string> = {};
        const dayOffset = Math.floor(duracionMuestreo / 24);
        const isMensual = dbFieldValue?.toUpperCase().includes('MENSUAL');

        rows.forEach((row, index) => {
            const base = new Date(selectedDate + 'T00:00:00');
            if (isMensual) {
                const monthOffset = Math.floor(index / numericFrequency);
                const partOfMonth = index % numericFrequency;
                const daysOffset = Math.floor((30 / numericFrequency) * partOfMonth);
                base.setMonth(base.getMonth() + monthOffset);
                base.setDate(base.getDate() + daysOffset);
            } else {
                const interval = (frequencyDays / numericFrequency) * index;
                base.setDate(base.getDate() + Math.floor(interval));
            }

            const retirementDateStr = base.toISOString().split('T')[0];
            newRetiroDates[row.id_agendamam] = retirementDateStr;

            const instDate = new Date(retirementDateStr + 'T00:00:00');
            instDate.setDate(instDate.getDate() - dayOffset);
            newDates[row.id_agendamam] = instDate.toISOString().split('T')[0];
        });

        setEditableDates(newDates);
        setEditableRetiroDates(newRetiroDates);
        showToast({ message: 'Fechas calculadas según programación', type: 'success' });
    };

    const isSavedRow = (rowId: number) =>
        !!(savedDates[rowId] || savedRetiroDates[rowId] || savedInstalacion[rowId] || savedRetiro[rowId]);

    const isLockedRow = (rowId: number) => isSavedRow(rowId) && !editingRows.has(rowId);

    const unlockRow = (rowId: number) => {
        setEditingRows(prev => new Set(prev).add(rowId));
    };

    const handleSaveAssignment = async () => {
        const activeRows = rows.filter(r => !['CANCELADO', 'ANULADO'].includes((r.nombre_estadomuestreo || '').toUpperCase()));
        // Excluir filas bloqueadas (ya guardadas y no editadas esta sesión) — no se re-envían al backend
        // A-05/A-06: ahora basta con tener fecha O muestreador (no ambos). El backend conserva el campo no provisto.
        // Filas candidatas a guardar en esta sesión: activas y NO bloqueadas.
        // Las bloqueadas ya están guardadas, así que no cuentan como "sin asignar".
        const editableRows = activeRows.filter(r => !isLockedRow(r.id_agendamam));
        const completedRows = editableRows.filter(r =>
            editableDates[r.id_agendamam] || muestreadorInstalacion[r.id_agendamam]
        );

        if (completedRows.length === 0) {
            showToast({ message: 'Debe ingresar al menos una fecha o un muestreador en algún registro para guardar', type: 'warning' });
            return;
        }

        if (!isPuntual && duracionMuestreo >= 24) {
            const sameDayRows = completedRows.filter(r => {
                const inst = editableDates[r.id_agendamam];
                const retiro = editableRetiroDates[r.id_agendamam];
                // Only validate when both dates are explicitly set — skip rows with only fecha or only retiro
                return inst && retiro && inst === retiro;
            });
            if (sameDayRows.length > 0) {
                showToast({ message: `Muestreo de ${duracionMuestreo}h: instalación y retiro no pueden ser el mismo día (${sameDayRows.length} fila${sameDayRows.length !== 1 ? 's' : ''})`, type: 'error' });
                return;
            }
        }

        // A-07: fecha de instalación NUNCA debe ser posterior a fecha de retiro
        const invertedRows = completedRows.filter(r => {
            const inst = editableDates[r.id_agendamam];
            const retiro = editableRetiroDates[r.id_agendamam];
            return inst && retiro && inst > retiro;
        });
        if (invertedRows.length > 0) {
            showToast({
                message: `La fecha de instalación no puede ser posterior a la de retiro (${invertedRows.length} fila${invertedRows.length !== 1 ? 's' : ''}). Revise los correlativos: ${invertedRows.map(r => r.frecuencia_correlativo).join(', ')}`,
                type: 'error'
            });
            return;
        }

        // A-02: bloquear fechas pasadas.
        // Para filas en edición (desbloqueadas): solo valida fechas que cambiaron respecto a BD.
        // Para filas nuevas: valida todas las fechas.
        const today = new Date().toISOString().split('T')[0];
        const pastDateRows = completedRows.filter(r => {
            const id = r.id_agendamam;
            const inst = editableDates[id];
            const retiro = editableRetiroDates[id];
            const isEditing = editingRows.has(id);
            const instToCheck = isEditing ? (inst !== savedDates[id] ? inst : null) : inst;
            const retiroToCheck = isEditing ? (retiro !== savedRetiroDates[id] ? retiro : null) : retiro;
            return (instToCheck && instToCheck < today) || (retiroToCheck && retiroToCheck < today);
        });
        if (pastDateRows.length > 0) {
            showToast({
                message: `No se permiten fechas anteriores a hoy (${pastDateRows.length} fila${pastDateRows.length !== 1 ? 's' : ''}). Revise los correlativos: ${pastDateRows.map(r => r.frecuencia_correlativo).join(', ')}`,
                type: 'error'
            });
            return;
        }

        if (resamplingData) {
            const rowsMissingVersions = completedRows.filter(r =>
                muestreadorInstalacion[r.id_agendamam] === resamplingData.idMuestreadorOriginal &&
                !equipmentSelections[r.frecuencia_correlativo]
            );

            if (rowsMissingVersions.length > 0) {
                showToast({
                    message: `Debe seleccionar las versiones de equipos para ${rowsMissingVersions.length} registros de remuestreo`,
                    type: 'warning'
                });
                return;
            }
        }

        const skippedCount = editableRows.length - completedRows.length;

        const executeSave = async () => {
            setSaving(true);
            try {
                // A-05/A-06: enviar null cuando un campo no fue completado (el backend conserva el valor previo)
                const assignments = completedRows.map((row: any) => {
                    const hasDate = !!editableDates[row.id_agendamam];
                    const hasMuestreador = !!muestreadorInstalacion[row.id_agendamam];
                    return {
                        id: row.id_agendamam,
                        fecha: hasDate ? editableDates[row.id_agendamam] : null,
                        // ✅ PUNTUAL: retiro = muestreo (misma fecha, mismo muestreador) → un solo día/proceso
                        fechaRetiro: hasDate
                            ? (isPuntual ? editableDates[row.id_agendamam] : (editableRetiroDates[row.id_agendamam] || editableDates[row.id_agendamam]))
                            : null,
                        idMuestreadorInstalacion: hasMuestreador ? muestreadorInstalacion[row.id_agendamam] : null,
                        idMuestreadorRetiro: hasMuestreador
                            ? (isPuntual ? muestreadorInstalacion[row.id_agendamam] : (muestreadorRetiro[row.id_agendamam] || muestreadorInstalacion[row.id_agendamam]))
                            : null,
                        idFichaIngresoServicio: row.id_fichaingresoservicio,
                        frecuenciaCorrelativo: row.frecuencia_correlativo,
                        equipmentSelections: equipmentSelections[row.frecuencia_correlativo] || null,
                        equipmentComparisonData: equipmentSelections[row.frecuencia_correlativo] ? comparisonData : null
                    };
                });

                const response = await fichaService.batchUpdateAgenda({
                    assignments,
                    user: user ? { id: user.id } : { id: 0 },
                    observaciones: 'Asignación de recursos y programación masiva desde sistema.',
                    observacionNotificacion: observacionAsignacion.trim() || null
                });

                showToast({ message: response.message || 'Asignación guardada correctamente', type: 'success' });
                setTimeout(() => onBack(), 1500);
            } catch (error) {
                console.error("Error saving assignment:", error);
                showToast({ message: 'Error al guardar la asignación', type: 'error' });
            } finally {
                setSaving(false);
            }
        };

        // Verificación final de conflictos de muestreador (solo para remuestreos)
        const hasConflicts = resamplingData && completedRows.some(row => {
            const instId = muestreadorInstalacion[row.id_agendamam];
            const retId = muestreadorRetiro[row.id_agendamam] || instId;
            const originalId = resamplingData.idMuestreadorOriginal;
            return (instId && instId !== originalId) || (retId && retId !== originalId);
        });

        const openSaveConfirm = (onConfirm: () => void) => {
            if (skippedCount > 0) {
                setConfirmDialog({
                    title: 'Guardado Parcial',
                    okText: 'Guardar de todas formas',
                    cancelText: 'Volver',
                    content: (
                        <div className="flex flex-col gap-2 text-sm">
                            <p>
                                Se guardarán <b>{completedRows.length}</b> de <b>{editableRows.length}</b> correlativos.
                                Los <b>{skippedCount}</b> restantes quedan sin asignar.
                            </p>
                            <p>¿Desea continuar?</p>
                        </div>
                    ),
                    onOk: () => { setConfirmDialog(null); onConfirm(); },
                });
            } else {
                onConfirm();
            }
        };

        if (hasConflicts) {
            openSaveConfirm(() => setConfirmDialog({
                title: 'Confirmar Guardado con Conflictos',
                okText: 'Confirmar y Guardar',
                cancelText: 'Volver a Revisar',
                content: (
                    <div className="flex flex-col gap-2 text-sm">
                        <p>
                            Se ha detectado que uno o más muestreadores asignados <b>no coinciden</b> con el muestreador original de la ficha <b>#{resamplingData?.idOriginal}</b> ({resamplingData?.nombreOriginal}).
                        </p>
                        <p className="font-medium text-warning">
                            Atención: Realizar un remuestreo con personal distinto puede derivar en inconsistencias técnicas, falta de equipos específicos o fallos en la metodología aplicada originalmente.
                        </p>
                        <p>¿Está seguro que desea proceder con el guardado de la planificación actual?</p>
                    </div>
                ),
                onOk: () => { setConfirmDialog(null); executeSave(); },
            }));
        } else {
            openSaveConfirm(executeSave);
        }
    };

    const muestreadorOptions = useMemo(() =>
        muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const metricSep = <div className="h-full w-px self-stretch bg-border" />;
    const Metric = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
            {children}
        </div>
    );

    return (
        <div className="shadcn-scope">
            <PageHeader
                title={`Asignación de Recursos - Ficha ${fichaId}${resamplingData ? ` (REMUESTREO DE LA FICHA N° ${resamplingData.idOriginal})` : ''}`}
                subtitle={resamplingData ? "Gestione la asignación para este remuestreo" : "Defina fechas y muestreadores responsables para cada servicio"}
                onBack={onBack}
                breadcrumbItems={[{ label: 'Planificación y Asignación', onClick: onBack }, { label: `Ficha ${fichaId}` }]}
                rightSection={
                    <ProtectedContent permission="FI_GEST_ASIG">
                        <Button
                            size="lg"
                            className="bg-[#9c36b5] text-white hover:bg-[#9c36b5]/90"
                            onClick={handleSaveAssignment}
                            disabled={saving}
                        >
                            {saving && <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                            <IconDeviceFloppy size={20} /> Guardar Planificación
                        </Button>
                    </ProtectedContent>
                }
            />

            {resamplingData && (
                <div className="mb-4">
                    <WorkflowAlert
                        type="info"
                        title="Ficha de Remuestreo"
                        message={`Esta ficha corresponde a un remuestreo de la ficha #${resamplingData.idOriginal}. El muestreador original fue: ${resamplingData.nombreOriginal || 'No identificado'}. Se recomienda asignar al mismo muestreador para evitar conflictos de equipamiento, o verificar la disponibilidad de equipos equivalentes.`}
                    />
                </div>
            )}

            <div className="rounded-xl border border-border bg-background p-6">
                <div className="flex flex-col gap-6">
                    {/* Unified Configuration & Metadata Header */}
                    <div className="rounded-[10px] border border-border bg-muted/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-5">
                                <Metric label="Frecuencia">
                                    <span className="text-[13px] font-semibold">{numericFrequency} {rows[0]?.nombre_frecuencia ? `(${rows[0].nombre_frecuencia})` : ''}</span>
                                </Metric>
                                {metricSep}
                                <Metric label="Periodo"><span className="text-[13px] font-semibold">{dbFieldValue || '-'}</span></Metric>
                                {metricSep}
                                <Metric label="Factor"><span className="text-[13px] font-semibold">{frecuenciaFactor}</span></Metric>
                                {metricSep}
                                <Metric label="Servicios"><Badge variant="default">{activeServicesCount}</Badge></Metric>
                                {!isPuntual && (
                                    <>
                                        {metricSep}
                                        <Metric label="Duración"><span className="text-[13px] font-semibold">{duracionMuestreo} hrs</span></Metric>
                                    </>
                                )}
                                {isPuntual && (
                                    <>
                                        {metricSep}
                                        <Metric label="Tipo"><Badge className="bg-[#9c36b5] text-white">Puntual</Badge></Metric>
                                    </>
                                )}
                            </div>

                            {rows[0] && (
                                <div className="flex flex-wrap gap-6">
                                    <div className="flex items-center gap-2">
                                        <IconBuilding size={16} className="text-muted-foreground" />
                                        <div>
                                            <span className="block text-[11px] font-bold uppercase text-muted-foreground">Empresa</span>
                                            <span className="text-[13px] font-semibold">{rows[0].empresa_servicio}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <IconTarget size={16} className="text-muted-foreground" />
                                        <div>
                                            <span className="block text-[11px] font-bold uppercase text-muted-foreground">Objetivo</span>
                                            <span className="text-[13px] font-semibold">{rows[0].nombre_objetivomuestreo}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <IconMapPin size={16} className="text-muted-foreground" />
                                        <div>
                                            <span className="block text-[11px] font-bold uppercase text-muted-foreground">Sub-Área</span>
                                            <span className="text-[13px] font-semibold">{rows[0].nombre_subarea}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <ProtectedContent permission="FI_GEST_ASIG">
                        <div>
                            <span className="block text-[13px] font-medium">Observación para la notificación</span>
                            <span className="mb-1.5 block text-xs text-muted-foreground">
                                Se incluirá en el correo de asignación enviado al responsable
                            </span>
                            <Textarea
                                placeholder="Ej: Coordinar acceso con guardia antes de las 9:00 AM"
                                rows={2}
                                value={observacionAsignacion}
                                onChange={(e) => setObservacionAsignacion(e.target.value)}
                            />
                        </div>
                    </ProtectedContent>

                    <div className="h-px bg-border" />

                    {/* Bulk Assignment Controls */}
                    <div className="flex flex-wrap items-end justify-center gap-6">
                        <ProtectedContent permission="FI_GEST_ASIG">
                            <div className="flex items-end gap-2">
                                <div>
                                    <span className="mb-1 block text-xs">Fecha Referencia (Muestreo)</span>
                                    <DatePicker value={selectedDate} onChange={setSelectedDate} className="w-44" />
                                </div>
                                <Button variant="outline" onClick={handleCalculateDates} disabled={!selectedDate}>
                                    <IconBolt size={14} /> Auto-Calcular
                                </Button>
                            </div>
                        </ProtectedContent>

                        {metricSep}

                        <ProtectedContent permission="FI_GEST_ASIG">
                            <div className="flex items-end gap-2">
                                <div>
                                    <span className="mb-1 block text-xs">{isPuntual ? 'Muestreador (Todos)' : 'M. Instalación (Todos)'}</span>
                                    <Combobox
                                        className="w-44"
                                        placeholder="Seleccionar..."
                                        searchPlaceholder="Buscar muestreador..."
                                        options={muestreadorOptions}
                                        value=""
                                        onValueChange={(val) => {
                                            if (val) {
                                                const id = Number(val);
                                                const applyBulk = () => {
                                                    const newInst: Record<number, number> = {};
                                                    const newRet: Record<number, number> = {};
                                                    rows.forEach(r => {
                                                        newInst[r.id_agendamam as number] = id;
                                                        newRet[r.id_agendamam as number] = muestreadorRetiro[r.id_agendamam] || id;
                                                    });
                                                    setMuestreadorInstalacion(newInst);
                                                    setMuestreadorRetiro(newRet);
                                                };
                                                if (resamplingData && resamplingData.idMuestreadorOriginal && id !== resamplingData.idMuestreadorOriginal) {
                                                    setConfirmDialog({
                                                        title: 'Confirmar Asignación',
                                                        okText: 'Sí',
                                                        cancelText: 'No',
                                                        content: <p className="text-sm">¿Asignar a muestreador distinto al original?</p>,
                                                        onOk: () => { applyBulk(); setConfirmDialog(null); },
                                                    });
                                                } else { applyBulk(); }
                                            }
                                        }}
                                    />
                                </div>
                                {!isPuntual && (
                                    <div>
                                        <span className="mb-1 block text-xs">M. Retiro (Todos)</span>
                                        <Combobox
                                            className="w-44"
                                            placeholder="Seleccionar..."
                                            searchPlaceholder="Buscar muestreador..."
                                            options={muestreadorOptions}
                                            value=""
                                            onValueChange={(val) => {
                                                if (val) {
                                                    const id = Number(val);
                                                    const applyBulkRetiro = () => {
                                                        const newRet: Record<number, number> = {};
                                                        rows.forEach(r => { newRet[r.id_agendamam as number] = id; });
                                                        setMuestreadorRetiro(newRet);
                                                    };
                                                    if (resamplingData && resamplingData.idMuestreadorOriginal && id !== resamplingData.idMuestreadorOriginal) {
                                                        setConfirmDialog({
                                                            title: 'Confirmar Asignación',
                                                            okText: 'Sí',
                                                            cancelText: 'No',
                                                            content: <p className="text-sm">¿Asignar a retiro distinto al original?</p>,
                                                            onOk: () => { applyBulkRetiro(); setConfirmDialog(null); },
                                                        });
                                                    } else { applyBulkRetiro(); }
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </ProtectedContent>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Assignments Table — markup nativo (no <Table> de shadcn): hay demasiadas
                        columnas condicionales (isPuntual) y celdas con inputs propios como
                        para forzarlo a un layout de tabla genérico; se mantiene la semántica de
                        tabla real, solo con los controles shadcn adentro. */}
                    <div className="relative">
                        {loading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        )}
                        <div className="max-h-[500px] overflow-auto rounded-lg border border-border">
                            <table className="w-full border-collapse text-[11px]">
                                <thead className="sticky top-0 z-[1] bg-muted/40">
                                    <tr>
                                        <Th w={50}>Ficha</Th>
                                        <Th w={160}>Correlativo</Th>
                                        <Th w={90}>Estado</Th>
                                        <Th w={135}>{isPuntual ? 'Fecha Muestreo' : 'F. Instalación'}</Th>
                                        {!isPuntual && <Th w={135}>F. Muestreo</Th>}
                                        <Th w={130}>Coordinador</Th>
                                        <Th w={145}>
                                            <span className="flex justify-center gap-1 whitespace-nowrap">
                                                {isPuntual ? 'Muestreador' : 'M. Instalación'}
                                                <span className="text-[9px] font-bold text-primary">(Orig.)</span>
                                            </span>
                                        </Th>
                                        {!isPuntual && <Th w={145}>
                                            <span className="flex justify-center gap-1 whitespace-nowrap">
                                                M. Retiro
                                                <span className="text-[9px] font-bold text-primary">(Orig.)</span>
                                            </span>
                                        </Th>}
                                        <Th w={135}>{''}</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => {
                                        const isCancelled = ['CANCELADO', 'ANULADO'].includes((row.nombre_estadomuestreo || '').toUpperCase());
                                        const rowId = row.id_agendamam;
                                        const locked = !isCancelled && isLockedRow(rowId);
                                        const instName = muestreadorOptions.find(o => o.value === String(muestreadorInstalacion[rowId] || ''))?.label || '-';
                                        const retiroName = muestreadorOptions.find(o => o.value === String(muestreadorRetiro[rowId] || ''))?.label || '-';
                                        const statusVariant: BadgeVariant = isCancelled ? 'destructive' : (row.nombre_estadomuestreo?.includes('POR') ? 'warning' : 'success');
                                        const instConflict = !!(resamplingData && muestreadorInstalacion[rowId] && resamplingData.idMuestreadorOriginal && muestreadorInstalacion[rowId] !== resamplingData.idMuestreadorOriginal);
                                        const retiroConflict = !!(resamplingData && muestreadorRetiro[rowId] && resamplingData.idMuestreadorOriginal && muestreadorRetiro[rowId] !== resamplingData.idMuestreadorOriginal);

                                        return (
                                            <tr key={rowId} className={cn(isCancelled && 'opacity-50', locked && 'bg-muted/40')}>
                                                <Td center>{row.num_ficha}</Td>
                                                <Td center bold>{row.frecuencia_correlativo}</Td>
                                                <Td center>
                                                    <Badge variant={statusVariant} className="whitespace-normal text-center text-[10px] leading-tight">
                                                        {row.nombre_estadomuestreo}
                                                    </Badge>
                                                </Td>
                                                <Td center>
                                                    {locked ? (
                                                        <span className="text-xs text-muted-foreground line-through">{editableDates[rowId] || '-'}</span>
                                                    ) : (
                                                        <DatePicker
                                                            className="w-[125px]"
                                                            disabled={isCancelled}
                                                            value={editableDates[rowId] || ''}
                                                            onChange={(val) => setEditableDates(prev => ({ ...prev, [rowId]: val }))}
                                                        />
                                                    )}
                                                </Td>
                                                {!isPuntual && (
                                                    <Td center>
                                                        {locked ? (
                                                            <span className="text-xs text-muted-foreground line-through">{editableRetiroDates[rowId] || '-'}</span>
                                                        ) : (
                                                            <DatePicker
                                                                className="w-[125px]"
                                                                disabled={isCancelled}
                                                                value={editableRetiroDates[rowId] || ''}
                                                                onChange={(val) => {
                                                                    setEditableRetiroDates(prev => ({ ...prev, [rowId]: val }));
                                                                    if (val) {
                                                                        const dayOffset = Math.floor(duracionMuestreo / 24);
                                                                        const instDate = new Date(val + 'T00:00:00');
                                                                        instDate.setDate(instDate.getDate() - dayOffset);
                                                                        setEditableDates(prev => ({ ...prev, [rowId]: instDate.toISOString().split('T')[0] }));
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </Td>
                                                )}
                                                <Td center><span className="text-xs font-medium">{row.nombre_coordinador}</span></Td>
                                                <Td>
                                                    {locked ? (
                                                        <span className="block text-center text-xs text-muted-foreground line-through">{instName}</span>
                                                    ) : (
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Combobox
                                                                disabled={isCancelled}
                                                                className={cn('w-[140px]', instConflict && 'border-destructive text-destructive')}
                                                                options={muestreadorOptions}
                                                                value={muestreadorInstalacion[rowId] ? String(muestreadorInstalacion[rowId]) : ''}
                                                                onValueChange={(v) => handleTechnicianChange(rowId, Number(v), 'instalacion')}
                                                                placeholder="Seleccionar..."
                                                                searchPlaceholder="Buscar muestreador..."
                                                            />
                                                            <IconUser size={14} className="shrink-0 text-muted-foreground" />
                                                            {resamplingData && muestreadorInstalacion[rowId] === resamplingData.idMuestreadorOriginal && (
                                                                <span className="whitespace-nowrap text-[10px] font-bold text-primary">H. ✓</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </Td>
                                                {!isPuntual && (
                                                    <Td>
                                                        {locked ? (
                                                            <span className="block text-center text-xs text-muted-foreground line-through">{retiroName}</span>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <Combobox
                                                                    disabled={isCancelled}
                                                                    className={cn('w-[140px]', retiroConflict && 'border-destructive text-destructive')}
                                                                    options={muestreadorOptions}
                                                                    value={muestreadorRetiro[rowId] ? String(muestreadorRetiro[rowId]) : ''}
                                                                    onValueChange={(v) => handleTechnicianChange(rowId, Number(v), 'retiro')}
                                                                    placeholder="Seleccionar..."
                                                                    searchPlaceholder="Buscar muestreador..."
                                                                />
                                                                <IconUser size={14} className="shrink-0 text-muted-foreground" />
                                                                {resamplingData && muestreadorRetiro[rowId] === resamplingData.idMuestreadorOriginal && (
                                                                    <span className="whitespace-nowrap text-[10px] font-bold text-primary">H. ✓</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Td>
                                                )}
                                                <Td center>
                                                    {locked ? (
                                                        <Button size="sm" variant="outline" onClick={() => unlockRow(rowId)}>
                                                            <IconPencil size={12} /> Editar
                                                        </Button>
                                                    ) : resamplingData && (muestreadorInstalacion[rowId] === resamplingData.idMuestreadorOriginal || muestreadorRetiro[rowId] === resamplingData.idMuestreadorOriginal) && (
                                                        <Button
                                                            size="sm"
                                                            variant={equipmentSelections[row.frecuencia_correlativo] ? 'default' : 'outline'}
                                                            className={equipmentSelections[row.frecuencia_correlativo] ? 'bg-success text-success-foreground hover:bg-success/90' : undefined}
                                                            onClick={() => handleViewVersions(resamplingData.idMuestreadorOriginal, row.frecuencia_correlativo)}
                                                        >
                                                            <IconBolt size={12} /> {equipmentSelections[row.frecuencia_correlativo] ? 'Versiones OK' : 'Config. Versiones'}
                                                        </Button>
                                                    )}
                                                </Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Confirmación genérica — reemplaza Modal.confirm de antd */}
            <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{confirmDialog?.title}</DialogTitle>
                    </DialogHeader>
                    {confirmDialog?.content}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialog(null)}>{confirmDialog?.cancelText || 'Cancelar'}</Button>
                        <Button variant={confirmDialog?.destructive ? 'destructive' : 'default'} onClick={() => confirmDialog?.onOk()}>{confirmDialog?.okText || 'Confirmar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal de Comparación de Versiones */}
            <Dialog open={versionModalOpen} onOpenChange={setVersionModalOpen}>
                <DialogContent className="max-w-[70vw]">
                    <DialogHeader>
                        <DialogTitle>Comparación de Equipos - Correlativo {activeRowCorrelativo}</DialogTitle>
                    </DialogHeader>
                    <div className="relative">
                        {comparisonLoading && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        )}

                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-[13px] text-muted-foreground">
                                Versión al momento del muestreo original <b>(Ficha #{resamplingData?.idOriginal})</b> vs Versión vigente actual <b>(mae_equipo)</b>
                            </span>
                            <div className="flex gap-2">
                                <Button size="sm" variant="outline" onClick={() => handleBulkSelection('original')}>Usar Todas Originales</Button>
                                <Button size="sm" variant="outline" onClick={() => handleBulkSelection('nueva')}>Usar Todas Actuales</Button>
                            </div>
                        </div>

                        {comparisonData.length === 0 && !comparisonLoading ? (
                            <WorkflowAlert
                                type="warning"
                                title="Sin Datos"
                                message={`No se encontraron registros de equipos para este correlativo en la ficha original (#${resamplingData?.idOriginal}).`}
                            />
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full border-collapse text-xs">
                                    <thead>
                                        <tr>
                                            <Th rowSpan={2}>Equipo / Código</Th>
                                            <Th colSpan={4} tint="blue">Versión Original (Ficha #{resamplingData?.idOriginal})</Th>
                                            <Th colSpan={4} tint="green">Versión Actual (Vigente)</Th>
                                        </tr>
                                        <tr>
                                            <Th w={80} tint="blue">Versión</Th>
                                            <Th w={60} tint="blue">E 0%</Th>
                                            <Th w={60} tint="blue">E 15%</Th>
                                            <Th w={60} tint="blue">E 30%</Th>
                                            <Th w={80} tint="green">Versión</Th>
                                            <Th w={60} tint="green">E 0%</Th>
                                            <Th w={60} tint="green">E 15%</Th>
                                            <Th w={60} tint="green">E 30%</Th>
                                            <Th w={140}>Selección Versión</Th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonData.map((item, idx) => {
                                            const versionChanged = item.version_original !== item.version_nueva;
                                            const error0Changed = Number(item.error0_original) !== Number(item.error0_nueva);
                                            const error15Changed = Number(item.error15_original) !== Number(item.error15_nueva);
                                            const error30Changed = Number(item.error30_original) !== Number(item.error30_nueva);

                                            const hasAnomalies = versionChanged || error0Changed || error15Changed || error30Changed;
                                            const currentSelection = (equipmentSelections[activeRowCorrelativo] || {})[item.id_equipo];

                                            return (
                                                <tr key={idx} className={hasAnomalies ? 'bg-warning/10' : undefined}>
                                                    <Td>
                                                        <span className="block text-[13px] font-semibold">{item.nombre}</span>
                                                        <span className="text-[11px] text-muted-foreground">{item.codigo}</span>
                                                    </Td>
                                                    <Td center tint="blue"><Badge variant="outline">{item.version_original || 'v1'}</Badge></Td>
                                                    <Td center tint="blue">{item.error0_original}%</Td>
                                                    <Td center tint="blue">{item.error15_original}%</Td>
                                                    <Td center tint="blue">{item.error30_original}%</Td>
                                                    <Td center tint="green"><Badge variant={versionChanged ? 'warning' : 'success'}>{item.version_nueva}</Badge></Td>
                                                    <Td center tint="green" bold={error0Changed}>{item.error0_nueva}%</Td>
                                                    <Td center tint="green" bold={error15Changed}>{item.error15_nueva}%</Td>
                                                    <Td center tint="green" bold={error30Changed}>{item.error30_nueva}%</Td>
                                                    <Td center>
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button
                                                                size="sm"
                                                                variant={currentSelection === 'original' ? 'default' : 'outline'}
                                                                onClick={() => setEquipmentSelections(prev => {
                                                                    const correlSelections = { ...(prev[activeRowCorrelativo] || {}) };
                                                                    correlSelections[item.id_equipo] = 'original';
                                                                    return { ...prev, [activeRowCorrelativo]: correlSelections };
                                                                })}
                                                            >
                                                                Ori.
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant={currentSelection === 'nueva' ? 'default' : 'outline'}
                                                                onClick={() => setEquipmentSelections(prev => {
                                                                    const correlSelections = { ...(prev[activeRowCorrelativo] || {}) };
                                                                    correlSelections[item.id_equipo] = 'nueva';
                                                                    return { ...prev, [activeRowCorrelativo]: correlSelections };
                                                                })}
                                                            >
                                                                Act.
                                                            </Button>
                                                        </div>
                                                    </Td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setVersionModalOpen(false)}>Cerrar</Button>
                        <Button onClick={() => setVersionModalOpen(false)}>Aceptar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function Th({ children, w, colSpan, rowSpan, tint }: { children?: React.ReactNode; w?: number; colSpan?: number; rowSpan?: number; tint?: 'blue' | 'green' }) {
    return (
        <th
            colSpan={colSpan}
            rowSpan={rowSpan}
            style={{ width: w }}
            className={cn(
                'border border-border p-1.5 text-center text-[11px] font-bold',
                tint === 'blue' ? 'bg-primary/10' : tint === 'green' ? 'bg-success/10' : 'bg-muted/40'
            )}
        >
            {children}
        </th>
    );
}

function Td({ children, center, bold, tint }: { children?: React.ReactNode; center?: boolean; bold?: boolean; tint?: 'blue' | 'green' }) {
    return (
        <td
            className={cn(
                'border border-border p-1',
                center ? 'text-center' : 'text-left',
                bold ? 'font-bold' : 'font-normal',
                tint === 'blue' ? 'bg-primary/5' : tint === 'green' ? 'bg-success/5' : undefined
            )}
        >
            {children}
        </td>
    );
}
