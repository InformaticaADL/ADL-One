import React, { useState, useEffect } from 'react';
import '../styles/FichasIngreso.css';
import { fichaService } from '../services/ficha.service';
import { useCatalogos } from '../context/CatalogosContext';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { WorkflowAlert } from '../../../components/ui/WorkflowAlert';

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

    // Status Validation
    const [fichaStatus, setFichaStatus] = useState<number | null>(null);
    const [statusLoading, setStatusLoading] = useState(true);

    // Muestreador assignments per row
    const [muestreadorInstalacion, setMuestreadorInstalacion] = useState<Record<number, number>>({});
    const [muestreadorRetiro, setMuestreadorRetiro] = useState<Record<number, number>>({});

    // Filters / Inputs
    const [selectedDate, setSelectedDate] = useState('');
    const [dbFieldValue, setDbFieldValue] = useState(''); // Stores nombre_frecuencia

    // Editable dates per row
    const [editableDates, setEditableDates] = useState<Record<number, string>>({});
    const [editableRetiroDates, setEditableRetiroDates] = useState<Record<number, string>>({});

    // Frequency data (dias)
    const [frequencyDays, setFrequencyDays] = useState<number>(0);
    const [duracionMuestreo, setDuracionMuestreo] = useState<number>(0);

    // Load Data
    const loadAssignmentData = async () => {
        setLoading(true);
        try {
            const data = await fichaService.getAssignmentDetail(fichaId);
            if (Array.isArray(data)) {
                setRows(data);
                if (data.length > 0) {
                    setDbFieldValue(data[0].nombre_frecuencia || '');
                    setFrequencyDays(data[0].dias || 0);
                    setDuracionMuestreo(Number(data[0].ma_duracion_muestreo) || 0);

                    const existingDates: Record<number, string> = {};
                    const existingRetiroDates: Record<number, string> = {};
                    const existingInstalacion: Record<number, number> = {};
                    const existingRetiro: Record<number, number> = {};

                    // Track first valid programmed date for header
                    let firstRowDate = '';
                    let firstRowRetiroDate = '';

                    data.forEach((row: any) => {
                        // 1. Calculate base date from DB fields (dia, mes, ano) if available
                        let calculatedFromDB = '';
                        if (row.dia && row.mes && row.ano) {
                            const d = String(row.dia).padStart(2, '0');
                            const m = String(row.mes).padStart(2, '0');
                            const a = String(row.ano);
                            calculatedFromDB = `${a}-${m}-${d}`;
                        }

                        // 2. Load sampling date: priority 1 (existing in DB), priority 2 (calculated from programmed fields)
                        let samplingDate = '';
                        if (row.fecha_muestreo && row.fecha_muestreo !== '  /  /    ' && row.fecha_muestreo !== '01/01/1900' && row.fecha_muestreo !== '1900-01-01') {
                            samplingDate = formatDate(row.fecha_muestreo);
                        } else if (calculatedFromDB) {
                            samplingDate = calculatedFromDB;
                        }

                        if (samplingDate) {
                            existingDates[row.id_agendamam] = samplingDate;
                            if (!firstRowDate) firstRowDate = samplingDate;
                        }

                        // 3. Load retirement date
                        if (row.fecha_retiro && row.fecha_retiro !== '01/01/1900' && row.fecha_retiro !== '1900-01-01' && row.fecha_retiro !== '  /  /    ') {
                            const dateStr = formatDate(row.fecha_retiro);
                            if (dateStr) {
                                existingRetiroDates[row.id_agendamam] = dateStr;
                                if (!firstRowRetiroDate) firstRowRetiroDate = dateStr;
                            }
                        }

                        // 4. Load muestreadores
                        if (row.id_muestreador) existingInstalacion[row.id_agendamam] = row.id_muestreador;
                        if (row.id_muestreador2) existingRetiro[row.id_agendamam] = row.id_muestreador2;
                    });

                    setEditableDates(existingDates);
                    setEditableRetiroDates(existingRetiroDates);
                    setMuestreadorInstalacion(existingInstalacion);
                    setMuestreadorRetiro(existingRetiro);

                    // Auto-fill header if not already set
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

    // Check Ficha Status for Validation
    const checkStatus = async () => {
        setStatusLoading(true);
        try {
            const response = await fichaService.getById(fichaId);
            const ficha = response.data || response;

            if (ficha) {
                setFichaStatus(ficha.id_validaciontecnica);
            }
        } catch (error) {
            console.error("Error checking ficha status", error);
        } finally {
            setStatusLoading(false);
        }
    };

    useEffect(() => {
        const loadInitialData = async () => {
            await checkStatus();
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
    }, [fichaId, getCatalogo]);


    const handleMuestreadorInstalacionChange = (rowId: number, muestreadorId: number) => {
        setMuestreadorInstalacion(prev => ({
            ...prev,
            [rowId]: muestreadorId
        }));
        // Auto-fill retiro with same value
        setMuestreadorRetiro(prev => ({
            ...prev,
            [rowId]: muestreadorId
        }));
    };

    const handleMuestreadorRetiroChange = (rowId: number, muestreadorId: number) => {
        setMuestreadorRetiro(prev => ({
            ...prev,
            [rowId]: muestreadorId
        }));
    };

    const handleCalculateDates = () => {
        if (rows.length === 0) return;

        console.log('Calculating dates based on individual row data...');

        const newDates: Record<number, string> = {};
        const newRetiroDates: Record<number, string> = {};

        // Rule: if duration is 24 or more -> add days corresponding to duration (e.g. 24h = 1 day)
        // If duration < 24 -> same day (0 days offset)
        const dayOffset = Math.floor(duracionMuestreo / 24);

        const isMensual = dbFieldValue?.toUpperCase().includes('MENSUAL');

        rows.forEach((row, index) => {
            let baseDateStr = '';

            // If selectedDate is set, we use it as the START of a sequence for ALL rows
            // This allows the user to re-center the entire schedule (all 12 samplings)
            if (selectedDate) {
                const base = new Date(selectedDate + 'T00:00:00');
                if (isMensual) {
                    // For monthly, we increment by months to preserve the day of the month
                    base.setMonth(base.getMonth() + index);
                } else {
                    const interval = frequencyDays * index;
                    base.setDate(base.getDate() + interval);
                }
                baseDateStr = base.toISOString().split('T')[0];
            } else if (row.dia && row.mes && row.ano) {
                // Fallback to row specific programmed dates if no header date is selected
                const d = String(row.dia).padStart(2, '0');
                const m = String(row.mes).padStart(2, '0');
                const a = String(row.ano);
                baseDateStr = `${a}-${m}-${d}`;
            }

            if (baseDateStr) {
                newDates[row.id_agendamam] = baseDateStr;

                // Calculate retirement date adding offset
                const retiDate = new Date(baseDateStr + 'T00:00:00');
                retiDate.setDate(retiDate.getDate() + dayOffset);
                newRetiroDates[row.id_agendamam] = retiDate.toISOString().split('T')[0];
            }
        });

        setEditableDates(newDates);
        setEditableRetiroDates(newRetiroDates);
        showToast({ message: 'Fechas calculadas según programación', type: 'success' });
    };

    const handleDateChange = (id: number, newDate: string) => {
        setEditableDates(prev => ({
            ...prev,
            [id]: newDate
        }));
    };

    const handleRetiroDateChange = (id: number, newDate: string) => {
        setEditableRetiroDates(prev => ({
            ...prev,
            [id]: newDate
        }));
    };

    const handleSaveAssignment = async () => {
        // Check that all rows have dates and at least instalacion muestreador
        const rowsWithoutDates = rows.filter((row: any) => !editableDates[row.id_agendamam]);
        if (rowsWithoutDates.length > 0) {
            showToast({ message: 'Debe calcular o ingresar fechas para todos los registros', type: 'warning' });
            return;
        }

        const rowsWithoutMuestreador = rows.filter((row: any) => !muestreadorInstalacion[row.id_agendamam]);
        if (rowsWithoutMuestreador.length > 0) {
            showToast({ message: 'Debe seleccionar Muestreador de Instalación para todos los registros', type: 'warning' });
            return;
        }

        setSaving(true);
        try {
            // Build assignments array with all required data
            const assignments = rows.map((row: any) => ({
                id: row.id_agendamam,
                fecha: editableDates[row.id_agendamam],
                fechaRetiro: editableRetiroDates[row.id_agendamam] || editableDates[row.id_agendamam],
                idMuestreadorInstalacion: muestreadorInstalacion[row.id_agendamam],
                idMuestreadorRetiro: muestreadorRetiro[row.id_agendamam] || muestreadorInstalacion[row.id_agendamam],
                idFichaIngresoServicio: row.id_fichaingresoservicio,
                frecuenciaCorrelativo: row.frecuencia_correlativo
            }));

            const response = await fichaService.batchUpdateAgenda({
                assignments,
                user: user ? { id: user.id } : { id: 0 },
                observaciones: 'Fechas y muestreadores asignados, ficha lista para ser ejecutada.'
            });

            // Display success message from backend
            showToast({ message: response.message || 'Asignación guardada correctamente', type: 'success' });

            // Redirect to assignment list after 1.5 seconds
            setTimeout(() => {
                onBack();
            }, 1500);
        } catch (error) {
            console.error("Error saving assignment:", error);
            showToast({ message: 'Error al guardar la asignación', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fichas-ingreso-container commercial-layout">
            {/* Header */}
            <div className="header-row">
                <button onClick={onBack} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver
                </button>
                <h2 className="page-title-geo">Formulario de Asignación - Ficha {fichaId}</h2>
            </div>

            {/* Status Validation Banner */}
            {!statusLoading && fichaStatus !== 6 && fichaStatus !== 5 && (
                <WorkflowAlert
                    type="warning"
                    title="Acción Bloqueada"
                    message="Esta ficha requiere aprobación del Área de Coordinación antes de asignar fechas y muestreadores. Estado actual no permite esta acción."
                />
            )}

            {/* Top Inputs Section */}
            <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '2rem',
                alignItems: 'flex-start',
                justifyContent: 'center'
            }}>
                {/* GROUP 1: Dates & Calculation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="form-group" style={{ flex: '0 0 140px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '4px', display: 'block' }}>
                                Frecuencia (DB)
                            </label>
                            <input
                                type="text"
                                value={dbFieldValue}
                                disabled
                                style={{
                                    width: '100%',
                                    padding: '0.4rem',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#f9fafb',
                                    color: '#6b7280',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>

                        <div className="form-group" style={{ flex: '0 0 150px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '4px', display: 'block' }}>
                                Fecha Inicial
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    fontSize: '0.85rem'
                                }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCalculateDates}
                        disabled={!selectedDate || (fichaStatus !== 6 && fichaStatus !== 5)}
                        className="btn-secondary"
                        style={{
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            opacity: (!selectedDate || (fichaStatus !== 6 && fichaStatus !== 5)) ? 0.5 : 1,
                            cursor: (!selectedDate || (fichaStatus !== 6 && fichaStatus !== 5)) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        ⚡ Calcular Fechas
                    </button>
                </div>

                {/* Vertical Separator */}
                <div style={{
                    width: '1px',
                    height: '80px',
                    backgroundColor: '#e5e7eb',
                    alignSelf: 'center'
                }} />

                {/* GROUP 2: Bulk Assignment & Save */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <div className="form-group" style={{ flex: '0 0 190px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '4px', display: 'block' }}>
                                Asignar M. Instalación a Todos
                            </label>
                            <select
                                value=""
                                onChange={(e) => {
                                    const muestreadorId = Number(e.target.value);
                                    if (muestreadorId) {
                                        const newInstalacion: { [key: number]: number } = {};
                                        const newRetiro: { [key: number]: number } = {};
                                        rows.forEach(row => {
                                            newInstalacion[row.id_agendamam] = muestreadorId;
                                            newRetiro[row.id_agendamam] = muestreadorRetiro[row.id_agendamam] || muestreadorId;
                                        });
                                        setMuestreadorInstalacion(newInstalacion);
                                        setMuestreadorRetiro(newRetiro);
                                        e.target.value = ''; // Reset selector
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#fff',
                                    color: '#111827',
                                    fontSize: '0.8rem'
                                }}
                            >
                                <option value="">Seleccionar...</option>
                                {muestreadores.map(m => (
                                    <option key={m.id_muestreador} value={m.id_muestreador}>
                                        {m.nombre_muestreador}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group" style={{ flex: '0 0 190px' }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', marginBottom: '4px', display: 'block' }}>
                                Asignar M. Retiro a Todos
                            </label>
                            <select
                                value=""
                                onChange={(e) => {
                                    const muestreadorId = Number(e.target.value);
                                    if (muestreadorId) {
                                        const newRetiro: { [key: number]: number } = {};
                                        rows.forEach(row => {
                                            newRetiro[row.id_agendamam] = muestreadorId;
                                        });
                                        setMuestreadorRetiro(newRetiro);
                                        e.target.value = ''; // Reset selector
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.4rem',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: '#fff',
                                    color: '#111827',
                                    fontSize: '0.8rem'
                                }}
                            >
                                <option value="">Seleccionar...</option>
                                {muestreadores.map(m => (
                                    <option key={m.id_muestreador} value={m.id_muestreador}>
                                        {m.nombre_muestreador}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <button
                            onClick={handleSaveAssignment}
                            disabled={saving || loading || (fichaStatus !== 6 && fichaStatus !== 5)}
                            className="btn-primary"
                            style={{
                                backgroundColor: (saving || (fichaStatus !== 6 && fichaStatus !== 5)) ? '#9333ea' : '#7c3aed',
                                color: 'white',
                                padding: '0.4rem 1.2rem',
                                fontSize: '0.85rem',
                                height: '34px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                border: 'none',
                                cursor: (saving || (fichaStatus !== 6 && fichaStatus !== 5)) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                opacity: (fichaStatus !== 6 && fichaStatus !== 5) ? 0.6 : 1
                            }}
                        >
                            {saving ? 'Guardando...' : '💾 Guardar Asignación'}
                        </button>
                        {(!statusLoading && fichaStatus !== 6 && fichaStatus !== 5) && (
                            <div style={{ fontSize: '0.7rem', color: '#dc2626', marginTop: '4px', textAlign: 'center', fontWeight: 600 }}>
                                Requiere aprobación de Coordinación
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="responsive-table-container">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando datos...</div>
                ) : (
                    <div style={{ overflowX: 'auto', maxHeight: '650px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                            <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>N°Ficha</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Correlativo</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Estado</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>F.muestreo</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>F. Retiro</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Frecuencia</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>E.Servicio</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Tipo Punto</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Sub Área</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Coordinador</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', backgroundColor: '#fef3c7', fontSize: '9px', minWidth: '140px', textAlign: 'center' }}>M. Instalación</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', backgroundColor: '#fef3c7', fontSize: '9px', minWidth: '140px', textAlign: 'center' }}>M. Retiro</th>
                                </tr>
                            </thead>
                            <tbody style={{ fontSize: '9px' }}>
                                {rows.map((row, idx) => {
                                    let displayDate = row.fecha_muestreo;
                                    if (displayDate === '01/01/1900' || displayDate === '1900-01-01') {
                                        displayDate = '';
                                    }

                                    const isCancelled = row.estado_caso === 'CANCELADO' || row.id_estadomuestreo === 99 || row.nombre_estadomuestreo === 'CANCELADO' || row.nombre_estadomuestreo === 'Cancelado';

                                    return (
                                        <tr key={idx} style={{
                                            borderBottom: '1px solid #e5e7eb',
                                            height: '36px',
                                            backgroundColor: isCancelled ? '#f3f4f6' : 'transparent',
                                            color: isCancelled ? '#9ca3af' : 'inherit',
                                            textDecoration: isCancelled ? 'line-through' : 'none',
                                            opacity: isCancelled ? 0.6 : 1
                                        }}>
                                            <td style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>{row.fichaingresoservicio}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.frecuencia_correlativo}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '1px 6px',
                                                    borderRadius: '9999px',
                                                    fontSize: '9px',
                                                    fontWeight: 600,
                                                    backgroundColor: isCancelled ? '#e5e7eb' : (row.nombre_estadomuestreo?.includes('POR') ? '#ffedd5' : (row.nombre_estadomuestreo?.includes('PEND') ? '#fee2e2' : '#dcfce7')),
                                                    color: isCancelled ? '#6b7280' : (row.nombre_estadomuestreo?.includes('POR') ? '#c2410c' : (row.nombre_estadomuestreo?.includes('PEND') ? '#991b1b' : '#166534')),
                                                    textDecoration: 'none',
                                                    display: 'inline-block'
                                                }}>
                                                    {isCancelled ? 'CANCELADO' : row.nombre_estadomuestreo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <input
                                                    type="date"
                                                    value={editableDates[row.id_agendamam] || ''}
                                                    onChange={(e) => handleDateChange(row.id_agendamam, e.target.value)}
                                                    disabled={isCancelled || !editableDates[row.id_agendamam]}
                                                    placeholder="Calcular primero"
                                                    style={{
                                                        padding: '4px 6px',
                                                        fontSize: '10px',
                                                        border: editableDates[row.id_agendamam] ? '1px solid #10b981' : '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        width: '110px',
                                                        backgroundColor: editableDates[row.id_agendamam] ? '#f0fdf4' : '#f3f4f6',
                                                        cursor: editableDates[row.id_agendamam] ? 'text' : 'not-allowed',
                                                        color: editableDates[row.id_agendamam] ? '#1f2937' : '#9ca3af'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <input
                                                    type="date"
                                                    value={editableRetiroDates[row.id_agendamam] || ''}
                                                    onChange={(e) => handleRetiroDateChange(row.id_agendamam, e.target.value)}
                                                    disabled={isCancelled || !editableRetiroDates[row.id_agendamam]}
                                                    placeholder="Calcular primero"
                                                    style={{
                                                        padding: '4px 6px',
                                                        fontSize: '10px',
                                                        border: editableRetiroDates[row.id_agendamam] ? '1px solid #ef4444' : '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        width: '110px',
                                                        backgroundColor: editableRetiroDates[row.id_agendamam] ? '#fef2f2' : '#f3f4f6',
                                                        cursor: editableRetiroDates[row.id_agendamam] ? 'text' : 'not-allowed',
                                                        color: editableRetiroDates[row.id_agendamam] ? '#1f2937' : '#9ca3af'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_frecuencia}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.empresa_servicio}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_objetivomuestreo_ma}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_subarea}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_coordinador}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', backgroundColor: isCancelled ? 'transparent' : '#fffbeb', textAlign: 'center' }}>
                                                <select
                                                    value={muestreadorInstalacion[row.id_agendamam] ?? ''}
                                                    disabled={isCancelled}
                                                    onChange={(e) => handleMuestreadorInstalacionChange(row.id_agendamam, Number(e.target.value))}
                                                    style={{
                                                        padding: '3px 5px',
                                                        fontSize: '10px',
                                                        border: muestreadorInstalacion[row.id_agendamam] ? '1px solid #10b981' : '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        width: '140px',
                                                        backgroundColor: muestreadorInstalacion[row.id_agendamam] ? '#f0fdf4' : 'white'
                                                    }}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {muestreadores.map(m => (
                                                        <option key={m.id_muestreador} value={m.id_muestreador}>
                                                            {m.nombre_muestreador}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', backgroundColor: isCancelled ? 'transparent' : '#fffbeb', textAlign: 'center' }}>
                                                <select
                                                    value={muestreadorRetiro[row.id_agendamam] ?? ''}
                                                    disabled={isCancelled}
                                                    onChange={(e) => handleMuestreadorRetiroChange(row.id_agendamam, Number(e.target.value))}
                                                    style={{
                                                        padding: '3px 5px',
                                                        fontSize: '10px',
                                                        border: muestreadorRetiro[row.id_agendamam] ? '1px solid #10b981' : '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        width: '140px',
                                                        backgroundColor: muestreadorRetiro[row.id_agendamam] ? '#f0fdf4' : 'white'
                                                    }}
                                                >
                                                    <option value="">Seleccionar...</option>
                                                    {muestreadores.map(m => (
                                                        <option key={m.id_muestreador} value={m.id_muestreador}>
                                                            {m.nombre_muestreador}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
