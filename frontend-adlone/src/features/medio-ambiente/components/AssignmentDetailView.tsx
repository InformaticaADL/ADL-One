import React, { useState, useEffect } from 'react';
import '../styles/FichasIngreso.css';
import { fichaService } from '../services/ficha.service';
import { useCatalogos } from '../context/CatalogosContext';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';

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

    // Muestreador assignments per row
    const [muestreadorInstalacion, setMuestreadorInstalacion] = useState<Record<number, number>>({});
    const [muestreadorRetiro, setMuestreadorRetiro] = useState<Record<number, number>>({});

    // Filters / Inputs
    const [selectedDate, setSelectedDate] = useState('');
    const [dbFieldValue, setDbFieldValue] = useState(''); // Stores nombre_frecuencia

    // Editable dates per row
    const [editableDates, setEditableDates] = useState<Record<number, string>>({});

    // Frequency data (dias)
    const [frequencyDays, setFrequencyDays] = useState<number>(0);

    // Load Data
    const loadAssignmentData = async () => {
        setLoading(true);
        try {
            const data = await fichaService.getAssignmentDetail(fichaId);
            if (Array.isArray(data)) {
                setRows(data);
                if (data.length > 0) {
                    setDbFieldValue(data[0].nombre_frecuencia || '');
                    // Store frequency days for calculation
                    setFrequencyDays(data[0].dias || 0);

                    // Load existing dates and muestreadores if already assigned
                    const existingDates: Record<number, string> = {};
                    const existingInstalacion: Record<number, number> = {};
                    const existingRetiro: Record<number, number> = {};

                    data.forEach((row: any) => {
                        // Load existing dates
                        if (row.fecha_muestreo && row.fecha_muestreo !== '  /  /    ' && row.fecha_muestreo !== '01/01/1900') {
                            let dateStr = '';

                            if (typeof row.fecha_muestreo === 'string') {
                                if (row.fecha_muestreo.includes('T')) {
                                    // Handle ISO string (e.g., 2024-01-27T00:00:00.000Z)
                                    dateStr = row.fecha_muestreo.split('T')[0];
                                } else if (row.fecha_muestreo.includes('/')) {
                                    // Handle legacy format DD/MM/YYYY
                                    const dateParts = row.fecha_muestreo.split('/');
                                    if (dateParts.length === 3) {
                                        const [day, month, year] = dateParts;
                                        dateStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                                    }
                                } else if (row.fecha_muestreo.includes('-')) {
                                    // Handle simple YYYY-MM-DD
                                    dateStr = row.fecha_muestreo;
                                }
                            } else if (row.fecha_muestreo instanceof Date) {
                                // Handle Date object (common in mssql driver results)
                                const d = row.fecha_muestreo;
                                const year = d.getFullYear();
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const day = String(d.getDate()).padStart(2, '0');
                                dateStr = `${year}-${month}-${day}`;
                            }

                            if (dateStr) {
                                existingDates[row.id_agendamam] = dateStr;
                            }
                        }

                        // Load existing muestreadores
                        if (row.id_muestreador) {
                            existingInstalacion[row.id_agendamam] = row.id_muestreador;
                        }
                        if (row.id_muestreador2) {
                            existingRetiro[row.id_agendamam] = row.id_muestreador2;
                        }
                    });

                    setEditableDates(existingDates);
                    setMuestreadorInstalacion(existingInstalacion);
                    setMuestreadorRetiro(existingRetiro);
                }
            }
        } catch (error) {
            console.error("Error loading assignment data:", error);
            showToast({ message: 'Error al cargar datos de asignación', type: 'error' });
        } finally {
            setLoading(false);
        }
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
        if (!selectedDate) {
            showToast({ message: 'Debe seleccionar una fecha inicial', type: 'warning' });
            return;
        }

        const baseDate = new Date(selectedDate);
        const newDates: Record<number, string> = {};

        rows.forEach((row, index) => {
            const calculatedDate = new Date(baseDate);
            calculatedDate.setDate(calculatedDate.getDate() + (frequencyDays * index));

            // Format as YYYY-MM-DD
            const formattedDate = calculatedDate.toISOString().split('T')[0];
            newDates[row.id_agendamam] = formattedDate;
        });

        setEditableDates(newDates);
        showToast({ message: 'Fechas calculadas correctamente. Puede editarlas antes de asignar.', type: 'success' });
    };

    const handleDateChange = (id: number, newDate: string) => {
        setEditableDates(prev => ({
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
                idMuestreadorInstalacion: muestreadorInstalacion[row.id_agendamam],
                idMuestreadorRetiro: muestreadorRetiro[row.id_agendamam] || muestreadorInstalacion[row.id_agendamam],
                idFichaIngresoServicio: row.id_fichaingresoservicio,
                frecuenciaCorrelativo: row.frecuencia_correlativo
            }));

            const response = await fichaService.batchUpdateAgenda({
                assignments,
                user: user ? { id: user.id } : { id: 0 }
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

            {/* Top Inputs Section */}
            <div style={{
                backgroundColor: 'white',
                padding: '1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'end',
                flexWrap: 'wrap'
            }}>
                <div className="form-group" style={{ flex: '0 0 160px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                        Frecuencia (DB)
                    </label>
                    <input
                        type="text"
                        value={dbFieldValue}
                        disabled
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#f3f4f6',
                            color: '#6b7280',
                            fontSize: '0.9rem'
                        }}
                    />
                </div>

                <div className="form-group" style={{ flex: '0 0 160px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                        Fecha Inicial
                    </label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.9rem'
                        }}
                    />
                </div>

                <div className="form-group" style={{ flex: '0 0 auto' }}>
                    <button
                        onClick={handleCalculateDates}
                        disabled={!selectedDate}
                        className="btn-secondary"
                        style={{
                            padding: '0.6rem 1rem',
                            height: '38px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        ⚡ Calcular Fechas
                    </button>
                </div>

                {/* Bulk Assignment for Muestreador Instalacion */}
                <div className="form-group" style={{ flex: '0 0 200px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
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
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            color: '#1f2937',
                            fontSize: '0.85rem'
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

                {/* Bulk Assignment for Muestreador Retiro */}
                <div className="form-group" style={{ flex: '0 0 200px' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
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
                            padding: '0.5rem',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: '#fff',
                            color: '#1f2937',
                            fontSize: '0.85rem'
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

                <div className="form-group" style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
                    <button
                        onClick={handleSaveAssignment}
                        disabled={saving || loading}
                        className="btn-primary"
                        style={{
                            backgroundColor: saving ? '#a78bfa' : '#8b5cf6',
                            color: 'white',
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            border: 'none',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        {saving ? 'Guardando...' : '💾 Guardar Asignación'}
                    </button>
                </div>
            </div>

            {/* Table Section */}
            <div className="responsive-table-container">
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Cargando datos...</div>
                ) : (
                    <div style={{ overflowX: 'auto', maxHeight: '400px', border: '1px solid #e5e7eb', borderRadius: '4px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
                            <thead style={{ backgroundColor: '#f9fafb', position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>N°Ficha</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Correlativo</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Estado</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>F.muestreo</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Frecuencia</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>E.Servicio</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Tipo Punto</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Sub Área</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>Coordinador</th>
                                    <th style={{ padding: '6px 4px', whiteSpace: 'nowrap', fontSize: '9px', textAlign: 'center' }}>sync</th>
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

                                    return (
                                        <tr key={idx} style={{
                                            borderBottom: '1px solid #e5e7eb',
                                            height: '36px'
                                        }}>
                                            <td style={{ padding: '6px 8px', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>{row.fichaingresoservicio}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.frecuencia_correlativo}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '1px 6px',
                                                    borderRadius: '9999px',
                                                    fontSize: '9px',
                                                    fontWeight: 600,
                                                    backgroundColor: row.nombre_estadomuestreo?.includes('POR') ? '#ffedd5' : (row.nombre_estadomuestreo?.includes('PEND') ? '#fee2e2' : '#dcfce7'),
                                                    color: row.nombre_estadomuestreo?.includes('POR') ? '#c2410c' : (row.nombre_estadomuestreo?.includes('PEND') ? '#991b1b' : '#166534')
                                                }}>
                                                    {row.nombre_estadomuestreo}
                                                </span>
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <input
                                                    type="date"
                                                    value={editableDates[row.id_agendamam] || ''}
                                                    onChange={(e) => handleDateChange(row.id_agendamam, e.target.value)}
                                                    disabled={!editableDates[row.id_agendamam]}
                                                    placeholder="Calcular primero"
                                                    style={{
                                                        padding: '4px 6px',
                                                        fontSize: '10px',
                                                        border: editableDates[row.id_agendamam] ? '1px solid #10b981' : '1px solid #d1d5db',
                                                        borderRadius: '4px',
                                                        width: '120px',
                                                        backgroundColor: editableDates[row.id_agendamam] ? '#f0fdf4' : '#f3f4f6',
                                                        cursor: editableDates[row.id_agendamam] ? 'text' : 'not-allowed',
                                                        color: editableDates[row.id_agendamam] ? '#1f2937' : '#9ca3af'
                                                    }}
                                                />
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_frecuencia}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.empresa_servicio}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_objetivomuestreo_ma}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_subarea}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>{row.nombre_coordinador}</td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', textAlign: 'center' }}>
                                                <span style={{
                                                    padding: '1px 6px',
                                                    borderRadius: '9999px',
                                                    fontSize: '9px',
                                                    fontWeight: 600,
                                                    backgroundColor: (row.sincronizado === 'S' || row.sincronizado === true) ? '#dcfce7' : '#fee2e2',
                                                    color: (row.sincronizado === 'S' || row.sincronizado === true) ? '#166534' : '#991b1b'
                                                }}>
                                                    {(row.sincronizado === 'S' || row.sincronizado === true) ? 'SI' : 'NO'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', backgroundColor: '#fffbeb', textAlign: 'center' }}>
                                                <select
                                                    value={muestreadorInstalacion[row.id_agendamam] ?? ''}
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
                                            <td style={{ padding: '6px 8px', whiteSpace: 'nowrap', backgroundColor: '#fffbeb', textAlign: 'center' }}>
                                                <select
                                                    value={muestreadorRetiro[row.id_agendamam] ?? ''}
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
