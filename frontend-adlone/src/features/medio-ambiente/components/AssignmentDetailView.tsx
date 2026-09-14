import React, { useState, useEffect, useMemo } from 'react';
import { fichaService } from '../services/ficha.service';
import { useCatalogos } from '../context/CatalogosContext';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { adminService } from '../../../services/admin.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';
import {
    Button,
    Tag,
    Typography,
    Divider,
    Spin,
    Alert,
    Modal,
    Radio,
    Input,
    Select,
} from 'antd';
import {
    IconCalendarEvent,
    IconDeviceFloppy,
    IconBolt,
    IconInfoCircle,
    IconBuilding,
    IconTarget,
    IconMapPin,
    IconUser,
    IconPencil
} from '@tabler/icons-react';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
    fichaId: number;
    onBack: () => void;
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

        // Validación de conflicto (Remuestreo) - Pop up modal
        if (resamplingData && resamplingData.idMuestreadorOriginal && newId !== 0 && newId !== resamplingData.idMuestreadorOriginal) {
            Modal.confirm({
                title: 'Confirmar Cambio de Muestreador',
                centered: true,
                okText: 'Confirmar Asignación',
                cancelText: 'Cancelar',
                content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <Text style={{ fontSize: 13 }}>
                            Atención: El muestreador seleccionado no es el que realizó el muestreo original (<b>{resamplingData.nombreOriginal}</b>).
                        </Text>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            Cambiar el muestreador en un remuestreo puede generar conflictos técnicos, ya que el nuevo muestreador podría no contar con los mismos equipos o conocimientos específicos utilizados en el muestreo original.
                        </Text>
                        <Text strong style={{ fontSize: 13 }}>¿Desea proceder con esta asignación de todas formas?</Text>
                    </div>
                ),
                onOk: applyChange,
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
                Modal.confirm({
                    title: 'Guardado Parcial',
                    centered: true,
                    okText: 'Guardar de todas formas',
                    cancelText: 'Volver',
                    content: (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Text style={{ fontSize: 13 }}>
                                Se guardarán <b>{completedRows.length}</b> de <b>{editableRows.length}</b> correlativos.
                                Los <b>{skippedCount}</b> restantes quedan sin asignar.
                            </Text>
                            <Text style={{ fontSize: 13 }}>¿Desea continuar?</Text>
                        </div>
                    ),
                    onOk: onConfirm,
                });
            } else {
                onConfirm();
            }
        };

        if (hasConflicts) {
            openSaveConfirm(() => Modal.confirm({
                title: 'Confirmar Guardado con Conflictos',
                centered: true,
                width: 480,
                okText: 'Confirmar y Guardar',
                cancelText: 'Volver a Revisar',
                content: (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Text style={{ fontSize: 13 }}>
                            Se ha detectado que uno o más muestreadores asignados <b>no coinciden</b> con el muestreador original de la ficha <b>#{resamplingData?.idOriginal}</b> ({resamplingData?.nombreOriginal}).
                        </Text>
                        <Text style={{ fontSize: 13, color: '#e8590c', fontWeight: 500 }}>
                            Atención: Realizar un remuestreo con personal distinto puede derivar en inconsistencias técnicas, falta de equipos específicos o fallos en la metodología aplicada originalmente.
                        </Text>
                        <Text style={{ fontSize: 13 }}>¿Está seguro que desea proceder con el guardado de la planificación actual?</Text>
                    </div>
                ),
                onOk: executeSave,
            }));
        } else {
            openSaveConfirm(executeSave);
        }
    };

    const muestreadorOptions = useMemo(() =>
        muestreadores.map(m => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const metricSep = <div style={{ width: 1, alignSelf: 'stretch', backgroundColor: 'var(--app-border)' }} />;
    const Metric = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: 'var(--app-text-secondary)', textTransform: 'uppercase' }}>{label}</Text>
            {children}
        </div>
    );

    return (
        <div>
            <PageHeader
                title={`Asignación de Recursos - Ficha ${fichaId}${resamplingData ? ` (REMUESTREO DE LA FICHA N° ${resamplingData.idOriginal})` : ''}`}
                subtitle={resamplingData ? "Gestione la asignación para este remuestreo" : "Defina fechas y muestreadores responsables para cada servicio"}
                onBack={onBack}
                rightSection={
                    <ProtectedContent permission="FI_GEST_ASIG">
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#9c36b5' }}
                            size="large"
                            icon={<IconDeviceFloppy size={20} />}
                            onClick={handleSaveAssignment}
                            loading={saving}
                        >
                            Guardar Planificación
                        </Button>
                    </ProtectedContent>
                }
            />

            {resamplingData && (
                <Alert
                    type="info"
                    showIcon
                    icon={<IconInfoCircle size={18} />}
                    style={{ marginBottom: 16 }}
                    message="Ficha de Remuestreo"
                    description={
                        <>
                            Esta ficha corresponde a un remuestreo de la ficha <b>#{resamplingData.idOriginal}</b>.
                            El muestreador original fue: <b>{resamplingData.nombreOriginal || 'No identificado'}</b>.
                            Se recomienda asignar al mismo muestreador para evitar conflictos de equipamiento, o verificar la disponibilidad de equipos equivalentes.
                        </>
                    }
                />
            )}

            <div style={{ border: '1px solid var(--app-border)', borderRadius: 12, padding: 24, backgroundColor: 'var(--app-bg)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Unified Configuration & Metadata Header */}
                    <div style={{ border: '1px solid var(--app-border)', borderRadius: 10, padding: 16, backgroundColor: 'var(--app-hover-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                                <Metric label="Frecuencia">
                                    <Text strong style={{ fontSize: 13 }}>{numericFrequency} {rows[0]?.nombre_frecuencia ? `(${rows[0].nombre_frecuencia})` : ''}</Text>
                                </Metric>
                                {metricSep}
                                <Metric label="Periodo"><Text strong style={{ fontSize: 13 }}>{dbFieldValue || '-'}</Text></Metric>
                                {metricSep}
                                <Metric label="Factor"><Text strong style={{ fontSize: 13 }}>{frecuenciaFactor}</Text></Metric>
                                {metricSep}
                                <Metric label="Servicios"><Tag color="blue">{activeServicesCount}</Tag></Metric>
                                {!isPuntual && (
                                    <>
                                        {metricSep}
                                        <Metric label="Duración"><Text strong style={{ fontSize: 13 }}>{duracionMuestreo} hrs</Text></Metric>
                                    </>
                                )}
                                {isPuntual && (
                                    <>
                                        {metricSep}
                                        <Metric label="Tipo"><Tag color="purple">Puntual</Tag></Metric>
                                    </>
                                )}
                            </div>

                            {rows[0] && (
                                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <IconBuilding size={16} color="var(--app-text-secondary)" />
                                        <div>
                                            <Text style={{ fontSize: 11, color: 'var(--app-text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Empresa</Text>
                                            <Text strong style={{ fontSize: 13 }}>{rows[0].empresa_servicio}</Text>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <IconTarget size={16} color="var(--app-text-secondary)" />
                                        <div>
                                            <Text style={{ fontSize: 11, color: 'var(--app-text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Objetivo</Text>
                                            <Text strong style={{ fontSize: 13 }}>{rows[0].nombre_objetivomuestreo}</Text>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <IconMapPin size={16} color="var(--app-text-secondary)" />
                                        <div>
                                            <Text style={{ fontSize: 11, color: 'var(--app-text-secondary)', fontWeight: 700, textTransform: 'uppercase', display: 'block' }}>Sub-Área</Text>
                                            <Text strong style={{ fontSize: 13 }}>{rows[0].nombre_subarea}</Text>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <ProtectedContent permission="FI_GEST_ASIG">
                        <div>
                            <Text style={{ fontSize: 13, fontWeight: 500, display: 'block' }}>Observación para la notificación</Text>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                                Se incluirá en el correo de asignación enviado al responsable
                            </Text>
                            <TextArea
                                placeholder="Ej: Coordinar acceso con guardia antes de las 9:00 AM"
                                autoSize={{ minRows: 2 }}
                                value={observacionAsignacion}
                                onChange={(e) => setObservacionAsignacion(e.target.value)}
                            />
                        </div>
                    </ProtectedContent>

                    <Divider style={{ margin: 0 }} />

                    {/* Bulk Assignment Controls */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
                        <ProtectedContent permission="FI_GEST_ASIG">
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Fecha Referencia (Muestreo)</Text>
                                    <Input
                                        type="date"
                                        min={todayStr}
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        prefix={<IconCalendarEvent size={14} />}
                                    />
                                </div>
                                <Button icon={<IconBolt size={14} />} onClick={handleCalculateDates} disabled={!selectedDate}>
                                    Auto-Calcular
                                </Button>
                            </div>
                        </ProtectedContent>

                        {metricSep}

                        <ProtectedContent permission="FI_GEST_ASIG">
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>{isPuntual ? 'Muestreador (Todos)' : 'M. Instalación (Todos)'}</Text>
                                    <Select
                                        style={{ width: 180 }}
                                        placeholder="Seleccionar..."
                                        options={muestreadorOptions}
                                        showSearch
                                        onChange={(val) => {
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
                                                    Modal.confirm({
                                                        title: 'Confirmar Asignación',
                                                        content: <Text style={{ fontSize: 13 }}>¿Asignar a muestreador distinto al original?</Text>,
                                                        okText: 'Sí', cancelText: 'No',
                                                        onOk: applyBulk,
                                                    });
                                                } else { applyBulk(); }
                                            }
                                        }}
                                    />
                                </div>
                                {!isPuntual && (
                                    <div>
                                        <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>M. Retiro (Todos)</Text>
                                        <Select
                                            style={{ width: 180 }}
                                            placeholder="Seleccionar..."
                                            options={muestreadorOptions}
                                            showSearch
                                            onChange={(val) => {
                                                if (val) {
                                                    const id = Number(val);
                                                    const applyBulkRetiro = () => {
                                                        const newRet: Record<number, number> = {};
                                                        rows.forEach(r => { newRet[r.id_agendamam as number] = id; });
                                                        setMuestreadorRetiro(newRet);
                                                    };
                                                    if (resamplingData && resamplingData.idMuestreadorOriginal && id !== resamplingData.idMuestreadorOriginal) {
                                                        Modal.confirm({
                                                            title: 'Confirmar Asignación',
                                                            content: <Text style={{ fontSize: 13 }}>¿Asignar a retiro distinto al original?</Text>,
                                                            okText: 'Sí', cancelText: 'No',
                                                            onOk: applyBulkRetiro,
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

                    <Divider style={{ margin: 0 }} />

                    {/* Assignments Table — markup nativo (no antd <Table>): hay demasiadas
                        columnas condicionales (isPuntual) y celdas con inputs propios como
                        para forzarlo a la API de `columns`; se mantiene la semántica de
                        tabla real, solo con los controles de antd adentro. */}
                    <div style={{ position: 'relative' }}>
                        {loading && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--app-bg)', opacity: 0.7 }}>
                                <Spin size="large" />
                            </div>
                        )}
                        <div style={{ maxHeight: 500, overflow: 'auto', border: '1px solid var(--app-border)', borderRadius: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                                <thead style={{ backgroundColor: 'var(--app-hover-bg)', position: 'sticky', top: 0, zIndex: 1 }}>
                                    <tr>
                                        <Th w={50}>Ficha</Th>
                                        <Th w={160}>Correlativo</Th>
                                        <Th w={90}>Estado</Th>
                                        <Th w={135}>{isPuntual ? 'Fecha Muestreo' : 'F. Instalación'}</Th>
                                        {!isPuntual && <Th w={135}>F. Muestreo</Th>}
                                        <Th w={130}>Coordinador</Th>
                                        <Th w={145}>
                                            <span style={{ display: 'flex', gap: 4, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                                                {isPuntual ? 'Muestreador' : 'M. Instalación'}
                                                <span style={{ fontSize: 9, color: 'var(--app-accent-text)', fontWeight: 700 }}>(Orig.)</span>
                                            </span>
                                        </Th>
                                        {!isPuntual && <Th w={145}>
                                            <span style={{ display: 'flex', gap: 4, justifyContent: 'center', whiteSpace: 'nowrap' }}>
                                                M. Retiro
                                                <span style={{ fontSize: 9, color: 'var(--app-accent-text)', fontWeight: 700 }}>(Orig.)</span>
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
                                        const statusColor = isCancelled ? 'red' : (row.nombre_estadomuestreo?.includes('POR') ? 'orange' : 'green');

                                        return (
                                            <tr key={rowId} style={{ opacity: isCancelled ? 0.5 : 1, backgroundColor: locked ? 'var(--app-hover-bg)' : undefined }}>
                                                <Td center>{row.num_ficha}</Td>
                                                <Td center bold>{row.frecuencia_correlativo}</Td>
                                                <Td center>
                                                    <Tag color={statusColor} style={{ whiteSpace: 'normal', textAlign: 'center', lineHeight: 1.2, fontSize: 10 }}>
                                                        {row.nombre_estadomuestreo}
                                                    </Tag>
                                                </Td>
                                                <Td center>
                                                    {locked ? (
                                                        <Text delete type="secondary" style={{ fontSize: 12 }}>{editableDates[rowId] || '-'}</Text>
                                                    ) : (
                                                        <Input
                                                            type="date"
                                                            style={{ width: 125 }}
                                                            disabled={isCancelled}
                                                            min={editingRows.has(rowId) ? undefined : todayStr}
                                                            max={editableRetiroDates[rowId] || undefined}
                                                            value={editableDates[rowId] || ''}
                                                            onChange={(e) => {
                                                                const val = e.currentTarget.value;
                                                                setEditableDates(prev => ({ ...prev, [rowId]: val }));
                                                            }}
                                                        />
                                                    )}
                                                </Td>
                                                {!isPuntual && (
                                                    <Td center>
                                                        {locked ? (
                                                            <Text delete type="secondary" style={{ fontSize: 12 }}>{editableRetiroDates[rowId] || '-'}</Text>
                                                        ) : (
                                                            <Input
                                                                type="date"
                                                                style={{ width: 125 }}
                                                                disabled={isCancelled}
                                                                min={editableDates[rowId] || (editingRows.has(rowId) ? undefined : todayStr)}
                                                                value={editableRetiroDates[rowId] || ''}
                                                                onChange={(e) => {
                                                                    const val = e.currentTarget.value;
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
                                                <Td center><Text style={{ fontSize: 12, fontWeight: 500 }}>{row.nombre_coordinador}</Text></Td>
                                                <Td>
                                                    {locked ? (
                                                        <Text delete type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>{instName}</Text>
                                                    ) : (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                                            <Select
                                                                disabled={isCancelled}
                                                                style={{ width: 140 }}
                                                                options={muestreadorOptions}
                                                                value={muestreadorInstalacion[rowId] ? String(muestreadorInstalacion[rowId]) : undefined}
                                                                onChange={(v) => handleTechnicianChange(rowId, Number(v), 'instalacion')}
                                                                showSearch
                                                                placeholder="Seleccionar..."
                                                                status={resamplingData && muestreadorInstalacion[rowId] && resamplingData.idMuestreadorOriginal && muestreadorInstalacion[rowId] !== resamplingData.idMuestreadorOriginal ? 'error' : undefined}
                                                                suffixIcon={<IconUser size={14} />}
                                                            />
                                                            {resamplingData && muestreadorInstalacion[rowId] === resamplingData.idMuestreadorOriginal && (
                                                                <Text style={{ fontSize: 10, color: 'var(--app-accent-text)', fontWeight: 700, whiteSpace: 'nowrap' }}>H. ✓</Text>
                                                            )}
                                                        </div>
                                                    )}
                                                </Td>
                                                {!isPuntual && (
                                                    <Td>
                                                        {locked ? (
                                                            <Text delete type="secondary" style={{ fontSize: 12, textAlign: 'center', display: 'block' }}>{retiroName}</Text>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                                                                <Select
                                                                    disabled={isCancelled}
                                                                    style={{ width: 140 }}
                                                                    options={muestreadorOptions}
                                                                    value={muestreadorRetiro[rowId] ? String(muestreadorRetiro[rowId]) : undefined}
                                                                    onChange={(v) => handleTechnicianChange(rowId, Number(v), 'retiro')}
                                                                    showSearch
                                                                    placeholder="Seleccionar..."
                                                                    status={resamplingData && muestreadorRetiro[rowId] && resamplingData.idMuestreadorOriginal && muestreadorRetiro[rowId] !== resamplingData.idMuestreadorOriginal ? 'error' : undefined}
                                                                    suffixIcon={<IconUser size={14} />}
                                                                />
                                                                {resamplingData && muestreadorRetiro[rowId] === resamplingData.idMuestreadorOriginal && (
                                                                    <Text style={{ fontSize: 10, color: 'var(--app-accent-text)', fontWeight: 700, whiteSpace: 'nowrap' }}>H. ✓</Text>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Td>
                                                )}
                                                <Td center>
                                                    {locked ? (
                                                        <Button size="small" icon={<IconPencil size={12} />} onClick={() => unlockRow(rowId)}>
                                                            Editar
                                                        </Button>
                                                    ) : resamplingData && (muestreadorInstalacion[rowId] === resamplingData.idMuestreadorOriginal || muestreadorRetiro[rowId] === resamplingData.idMuestreadorOriginal) && (
                                                        <Button
                                                            size="small"
                                                            type={equipmentSelections[row.frecuencia_correlativo] ? 'primary' : 'default'}
                                                            style={equipmentSelections[row.frecuencia_correlativo] ? { backgroundColor: '#2f9e44' } : undefined}
                                                            icon={<IconBolt size={12} />}
                                                            onClick={() => handleViewVersions(resamplingData.idMuestreadorOriginal, row.frecuencia_correlativo)}
                                                        >
                                                            {equipmentSelections[row.frecuencia_correlativo] ? 'Versiones OK' : 'Config. Versiones'}
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

            {/* Modal de Comparación de Versiones */}
            <Modal
                title={`Comparación de Equipos - Correlativo ${activeRowCorrelativo}`}
                open={versionModalOpen}
                onCancel={() => setVersionModalOpen(false)}
                width="70%"
                centered
                footer={
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setVersionModalOpen(false)}>Cerrar</Button>
                        <Button type="primary" onClick={() => setVersionModalOpen(false)}>Aceptar</Button>
                    </div>
                }
            >
                <div style={{ position: 'relative' }}>
                    {comparisonLoading && (
                        <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spin size="large" />
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                            Versión al momento del muestreo original <b>(Ficha #{resamplingData?.idOriginal})</b> vs Versión vigente actual <b>(mae_equipo)</b>
                        </Text>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Button size="small" onClick={() => handleBulkSelection('original')}>Usar Todas Originales</Button>
                            <Button size="small" onClick={() => handleBulkSelection('nueva')}>Usar Todas Actuales</Button>
                        </div>
                    </div>

                    {comparisonData.length === 0 && !comparisonLoading ? (
                        <Alert type="warning" showIcon message="Sin Datos" description={
                            <>No se encontraron registros de equipos para este correlativo en la ficha original (#<b>{resamplingData?.idOriginal}</b>).</>
                        } />
                    ) : (
                        <div style={{ overflowX: 'auto', border: '1px solid var(--app-border)', borderRadius: 8 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
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
                                            <tr key={idx} style={{ backgroundColor: hasAnomalies ? 'rgba(250,173,20,0.08)' : undefined }}>
                                                <Td>
                                                    <Text strong style={{ fontSize: 13, display: 'block' }}>{item.nombre}</Text>
                                                    <Text type="secondary" style={{ fontSize: 11 }}>{item.codigo}</Text>
                                                </Td>
                                                <Td center tint="blue"><Tag>{item.version_original || 'v1'}</Tag></Td>
                                                <Td center tint="blue">{item.error0_original}%</Td>
                                                <Td center tint="blue">{item.error15_original}%</Td>
                                                <Td center tint="blue">{item.error30_original}%</Td>
                                                <Td center tint="green"><Tag color={versionChanged ? 'orange' : 'green'}>{item.version_nueva}</Tag></Td>
                                                <Td center tint="green" bold={error0Changed}>{item.error0_nueva}%</Td>
                                                <Td center tint="green" bold={error15Changed}>{item.error15_nueva}%</Td>
                                                <Td center tint="green" bold={error30Changed}>{item.error30_nueva}%</Td>
                                                <Td center>
                                                    <Radio.Group
                                                        size="small"
                                                        value={currentSelection}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setEquipmentSelections(prev => {
                                                                const correlSelections = { ...(prev[activeRowCorrelativo] || {}) };
                                                                correlSelections[item.id_equipo] = val;
                                                                return { ...prev, [activeRowCorrelativo]: correlSelections };
                                                            });
                                                        }}
                                                    >
                                                        <Radio value="original">Ori.</Radio>
                                                        <Radio value="nueva">Act.</Radio>
                                                    </Radio.Group>
                                                </Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
};

function Th({ children, w, colSpan, rowSpan, tint }: { children?: React.ReactNode; w?: number; colSpan?: number; rowSpan?: number; tint?: 'blue' | 'green' }) {
    const tintBg = tint === 'blue' ? 'var(--app-accent-bg)' : tint === 'green' ? 'rgba(47,158,68,0.12)' : undefined;
    return (
        <th
            colSpan={colSpan}
            rowSpan={rowSpan}
            style={{
                width: w, padding: '6px 4px', textAlign: 'center', fontWeight: 700, fontSize: 11,
                border: '1px solid var(--app-border)', backgroundColor: tintBg || 'var(--app-hover-bg)',
            }}
        >
            {children}
        </th>
    );
}

function Td({ children, center, bold, tint }: { children?: React.ReactNode; center?: boolean; bold?: boolean; tint?: 'blue' | 'green' }) {
    const tintBg = tint === 'blue' ? 'rgba(0,98,168,0.05)' : tint === 'green' ? 'rgba(47,158,68,0.06)' : undefined;
    return (
        <td
            style={{
                padding: '4px', border: '1px solid var(--app-border)',
                textAlign: center ? 'center' : 'left', fontWeight: bold ? 700 : 400,
                backgroundColor: tintBg,
            }}
        >
            {children}
        </td>
    );
}
