import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { adminService } from '../../../services/admin.service';
import { equipoService } from '../../admin/services/equipo.service';
import type { Equipo } from '../../admin/services/equipo.service';
import { SearchableSelect } from '../../../components/ui/SearchableSelect';
import { HybridSelect } from '../../../components/ui/HybridSelect';
import '../styles/FichasIngreso.css'; // Reusing established styles

interface Props {
    onBack?: () => void;
}

type SolicitudeType = 'ALTA' | 'TRASPASO' | 'BAJA';

export const SolicitudesMaPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [type, setType] = useState<SolicitudeType>('ALTA');
    const [loading, setLoading] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
    const [showNotifications, setShowNotifications] = useState(false);

    // Data for selectors
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    // List of equipment for bulk deletion / reactivation
    const [equiposBaja, setEquiposBaja] = useState<{ id: string; nombre: string }[]>([]);
    const [equiposAlta, setEquiposAlta] = useState<{ id: string; nombre: string; datos_originales?: Equipo }[]>([]);

    // History of user's own requests
    const [history, setHistory] = useState<any[]>([]);
    const [hiddenNotifications, setHiddenNotifications] = useState<number[]>([]);

    // Catalogs for dynamic selectors
    const [tiposCatalogo, setTiposCatalogo] = useState<string[]>([]);
    const [nombresCatalogo, setNombresCatalogo] = useState<string[]>([]);

    // Form Data
    const [formData, setFormData] = useState({
        // Alta fields
        codigo: '',
        nombre: '',
        tipo: '',
        ubicacion: '',
        responsable: '',
        id_muestreador: '',
        vigencia: '',

        // Traspaso / Baja shared
        id_equipo: '',
        id_equipo_original: null as number | null,
        nueva_ubicacion: '',
        nuevo_responsable: '',
        motivo: ''
    });
    const [isReactivation, setIsReactivation] = useState(false);
    const [altaSubtype, setAltaSubtype] = useState<'CREAR' | 'ACTIVAR' | null>(null);
    const [pendingBajaIds, setPendingBajaIds] = useState<string[]>([]);
    const [generatingCode, setGeneratingCode] = useState(false);

    const loadHistory = async () => {
        try {
            const data = await adminService.getSolicitudes({ solo_mias: true });
            setHistory(data);
        } catch (error) {
            console.error("Error loading user history:", error);
        }
    };

    const loadInitialData = async () => {
        try {
            // For Traspaso/Baja we need the equipment list
            const equiposRes = await equipoService.getEquipos({ limit: 1000 });
            setEquipos(equiposRes.data || []);

            // Set dynamic catalogs
            if (equiposRes.catalogs) {
                setTiposCatalogo(equiposRes.catalogs.tipos || []);
                setNombresCatalogo(equiposRes.catalogs.nombres || []);
            }

            // For Alta we might need responsible list (muestreadores)
            const mueRes = await adminService.getMuestreadores('', 'ACTIVOS');
            setMuestreadores(mueRes.data || []);

            loadHistory();

            // Load all pending requests to filter out equipment already being processed for BAJA
            const pendingRes = await adminService.getSolicitudes({ estado: 'PENDIENTE' });
            const ids: string[] = [];
            pendingRes.forEach((sol: any) => {
                if (sol.tipo_solicitud === 'BAJA' && sol.datos_json?.equipos_baja) {
                    sol.datos_json.equipos_baja.forEach((eb: any) => ids.push(String(eb.id)));
                }
            });
            setPendingBajaIds(ids);
        } catch (error) {
            console.error("Error loading data for solicitudes:", error);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        if (type === 'ALTA' && altaSubtype === 'ACTIVAR' && equiposAlta.length > 0) {
            const currentMotivo = formData.motivo || '';

            // Collect codes that are not already in the motive
            const newCodes = equiposAlta
                .map(eq => eq.datos_originales?.codigo)
                .filter(code => code && !currentMotivo.includes(`${code}:`));

            if (newCodes.length > 0) {
                const prefix = currentMotivo.length > 0 && !currentMotivo.endsWith('\n') ? '\n' : '';
                const linesToAdd = newCodes.map(code => `${code}: `).join('\n');
                setFormData(prev => ({
                    ...prev,
                    motivo: currentMotivo + prefix + linesToAdd
                }));
            }
        }
    }, [equiposAlta, type, altaSubtype]);

    useEffect(() => {
        const canGenerate = altaSubtype === 'CREAR' &&
            type === 'ALTA' &&
            formData.nombre &&
            formData.tipo &&
            formData.ubicacion &&
            formData.responsable &&
            formData.id_muestreador &&
            formData.vigencia;

        if (canGenerate) {
            const timer = setTimeout(async () => {
                setGeneratingCode(true);
                try {
                    const res = await equipoService.suggestNextCode(formData.tipo, formData.ubicacion, formData.nombre);
                    if (res.success && res.data.suggestedCode) {
                        setFormData(prev => ({ ...prev, codigo: res.data.suggestedCode }));
                    }
                } catch (error) {
                    console.error("Error suggesting code:", error);
                } finally {
                    setGeneratingCode(false);
                }
            }, 600); // Debounce to avoid too many calls while typing last fields
            return () => clearTimeout(timer);
        }
    }, [formData.nombre, formData.tipo, formData.ubicacion, formData.responsable, formData.id_muestreador, formData.vigencia, altaSubtype, type]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setShowConfirm(true);
    };


    const confirmSubmit = async () => {
        setLoading(true);
        setShowConfirm(false);
        try {
            // Find IDs for names picked from suggestions to maintain data integrity
            const matchingResponsable = muestreadores.find(m => m.nombre_muestreador === formData.responsable);
            const matchingNuevoResponsable = muestreadores.find(m => m.nombre_muestreador === formData.nuevo_responsable);

            const payload = {
                tipo_solicitud: type,
                datos_json: {
                    ...formData,
                    isReactivation,
                    id_muestreador: formData.id_muestreador || matchingResponsable?.id_muestreador || null,
                    nuevo_responsable_id: matchingNuevoResponsable?.id_muestreador || null,
                    // If it's BAJA or ALTA Reactivation, we send lists
                    equipos_baja: type === 'BAJA' ? equiposBaja : null,
                    equipos_alta: (type === 'ALTA' && isReactivation) ? equiposAlta : null
                }
            };

            await adminService.createSolicitud(payload);

            showToast({
                type: 'success',
                message: `Solicitud de ${type.toLowerCase()} enviada correctamente`,
                duration: 5000
            });

            setFormData({
                codigo: '', nombre: '', tipo: '', ubicacion: '', responsable: '',
                id_muestreador: '', vigencia: '', id_equipo: '',
                nueva_ubicacion: '', nuevo_responsable: '', motivo: '',
                id_equipo_original: null
            });
            setAltaSubtype(null);

            if (type === 'BAJA') {
                const newIds = equiposBaja.map(eb => String(eb.id));
                setPendingBajaIds(prev => [...prev, ...newIds]);
            }

            setIsReactivation(false);
            setEquiposBaja([]);
            setEquiposAlta([]);
            loadHistory();

        } catch (error) {
            showToast({
                type: 'error',
                message: 'Error al enviar la solicitud',
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-header-section" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ justifySelf: 'start' }}>
                    {onBack && (
                        <button onClick={onBack} className="btn-back" style={{ margin: 0 }}>
                            <span className="icon-circle">←</span> Volver
                        </button>
                    )}
                </div>

                <div style={{ justifySelf: 'center', textAlign: 'center' }}>
                    <h1 className="admin-title" style={{ margin: 0, fontSize: '1.5rem' }}>Realizar Solicitudes</h1>
                    <p className="admin-subtitle" style={{ margin: 0, fontSize: '0.9rem' }}>Gestione el alta, traspaso o baja de equipos del sistema.</p>
                </div>

                <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="notification-container" style={{ position: 'relative' }} tabIndex={0} onBlur={() => setTimeout(() => setShowNotifications(false), 200)}>
                        <button
                            className="btn-secondary"
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', position: 'relative' }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                            Notificaciones
                            {history.filter(s => (s.estado === 'APROBADO' || s.estado === 'RECHAZADA') && !hiddenNotifications.includes(s.id_solicitud)).length > 0 && (
                                <span style={{
                                    background: '#ef4444',
                                    color: 'white',
                                    fontSize: '0.7rem',
                                    fontWeight: 'bold',
                                    minWidth: '18px',
                                    height: '18px',
                                    borderRadius: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '0 5px',
                                    marginLeft: '4px'
                                }}>
                                    {history.filter(s => (s.estado === 'APROBADO' || s.estado === 'RECHAZADA') && !hiddenNotifications.includes(s.id_solicitud)).length}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="notifications-dropdown" style={{
                                position: 'absolute',
                                top: '100%',
                                right: 0,
                                width: '300px',
                                backgroundColor: 'white',
                                borderRadius: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                                border: '1px solid #e5e7eb',
                                marginTop: '0.5rem',
                                zIndex: 1000,
                                overflow: 'hidden'
                            }}>
                                <div style={{ padding: '1rem', borderBottom: '1px solid #f3f4f6', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                                    Resultados de Solicitudes
                                </div>
                                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {history.filter(s => (s.estado === 'APROBADO' || s.estado === 'RECHAZADA') && !hiddenNotifications.includes(s.id_solicitud)).length === 0 ? (
                                        <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                                            No tienes nuevas notificaciones.
                                        </div>
                                    ) : (
                                        history
                                            .filter(s => (s.estado === 'APROBADO' || s.estado === 'RECHAZADA') && !hiddenNotifications.includes(s.id_solicitud))
                                            .map((sol) => (
                                                <div
                                                    key={sol.id_solicitud}
                                                    style={{
                                                        padding: '0.75rem 1rem',
                                                        borderBottom: '1px solid #f9fafb',
                                                        cursor: 'pointer',
                                                        transition: 'background-color 0.2s',
                                                        position: 'relative'
                                                    }}
                                                    onClick={() => { setSelectedRequest(sol); setShowNotifications(false); }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', paddingRight: '1.5rem' }}>
                                                        <span style={{
                                                            fontSize: '0.6rem',
                                                            fontWeight: 'bold',
                                                            background: sol.estado === 'APROBADO' ? '#dcfce7' : '#fee2e2',
                                                            color: sol.estado === 'APROBADO' ? '#166534' : '#991b1b',
                                                            padding: '1px 5px',
                                                            borderRadius: '3px'
                                                        }}>{sol.estado}</span>
                                                        <span style={{ fontWeight: 600, color: '#374151', fontSize: '0.8rem' }}>
                                                            {sol.tipo_solicitud}: {sol.tipo_solicitud === 'ALTA' ? sol.datos_json.nombre : sol.datos_json.codigo}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                                                        {new Date(sol.updated_at || sol.fecha_solicitud).toLocaleDateString()} • Ver detalle
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setHiddenNotifications(prev => [...prev, sol.id_solicitud]);
                                                        }}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '0.75rem',
                                                            right: '0.5rem',
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#d1d5db',
                                                            cursor: 'pointer',
                                                            padding: '4px'
                                                        }}
                                                    >
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    </button>
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="form-card" style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                {/* Selector de Tipo */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
                    {(['ALTA', 'TRASPASO', 'BAJA'] as SolicitudeType[]).map(t => {
                        const getActiveColor = () => {
                            if (t === 'ALTA') return '#16a34a';
                            if (t === 'TRASPASO') return '#2563eb';
                            if (t === 'BAJA') return '#dc2626';
                            return '#2563eb';
                        };

                        const isActive = type === t;
                        const activeColor = getActiveColor();

                        return (
                            <button
                                key={t}
                                onClick={() => {
                                    setType(t);
                                    setAltaSubtype(null);
                                    setIsReactivation(false);
                                    setFormData({
                                        codigo: '', nombre: '', tipo: '', ubicacion: '', responsable: '',
                                        id_muestreador: '', vigencia: '', id_equipo: '',
                                        id_equipo_original: null,
                                        nueva_ubicacion: '', nuevo_responsable: '', motivo: ''
                                    });
                                    setEquiposBaja([]);
                                    setEquiposAlta([]);
                                }}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '8px',
                                    border: 'none',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    backgroundColor: isActive ? activeColor : '#f3f4f6',
                                    color: isActive ? 'white' : '#64748b',
                                    flex: 1,
                                    boxShadow: isActive ? `0 4px 6px -1px ${activeColor}40` : 'none',
                                    transform: isActive ? 'scale(1.02)' : 'scale(1)'
                                }}
                            >
                                {t}
                            </button>
                        );
                    })}
                </div>


                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        {type === 'ALTA' && !altaSubtype && (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '1.5rem',
                                padding: '1rem 0',
                                gridColumn: 'span 2'
                            }}>
                                <div
                                    onClick={() => { setAltaSubtype('CREAR'); setIsReactivation(false); }}
                                    style={{
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '16px',
                                        padding: '2rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        background: 'white'
                                    }}
                                    className="alta-option-card"
                                >
                                    <div style={{ background: '#eff6ff', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: '#2563eb' }}>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"></path></svg>
                                    </div>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>Registrar Equipo NUEVO</h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Para equipos que nunca han estado en el sistema</p>
                                </div>

                                <div
                                    onClick={() => { setAltaSubtype('ACTIVAR'); setIsReactivation(true); }}
                                    style={{
                                        border: '2px solid #e2e8f0',
                                        borderRadius: '16px',
                                        padding: '2rem',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        background: 'white'
                                    }}
                                    className="alta-option-card"
                                >
                                    <div style={{ background: '#f0fdf4', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: '#16a34a' }}>
                                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 19l7-7-7-7M5 12h14"></path></svg>
                                    </div>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>ACTIVACIÓN DE EQUIPO</h4>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Para equipos que están de Baja y quieres volver a usar</p>
                                </div>
                            </div>
                        )}

                        {type === 'ALTA' && altaSubtype && (
                            <>
                                <div
                                    onClick={() => {
                                        setAltaSubtype(null);
                                        setIsReactivation(false);
                                        setFormData({ ...formData, codigo: '', nombre: '', tipo: '', ubicacion: '', responsable: '', id_muestreador: '', vigencia: '', id_equipo_original: null });
                                    }}
                                    style={{
                                        gridColumn: 'span 2',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '1rem',
                                        padding: '0.5rem 1rem',
                                        background: '#f8fafc',
                                        borderRadius: '8px',
                                        border: '1px solid #e2e8f0',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.backgroundColor = '#eff6ff';
                                        e.currentTarget.style.borderColor = '#dbeafe';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.backgroundColor = '#f8fafc';
                                        e.currentTarget.style.borderColor = '#e2e8f0';
                                    }}
                                >
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: altaSubtype === 'CREAR' ? '#2563eb' : '#16a34a' }}></span>
                                        {altaSubtype === 'CREAR' ? 'SOLICITUD DE CREACIÓN' : 'ACTIVACIÓN DE EQUIPO'}
                                    </span>
                                    <span style={{ color: '#2563eb', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}>
                                        Cambiar opción
                                    </span>
                                </div>
                                {altaSubtype === 'ACTIVAR' && (
                                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                        <SearchableSelect
                                            label="Seleccionar Equipo para Reactivación"
                                            placeholder="Busque por nombre o código..."
                                            value=""
                                            onChange={(val) => {
                                                const eq = equipos.find(e => String(e.id_equipo) === val);
                                                if (eq && !equiposAlta.find(a => a.id === val)) {
                                                    setEquiposAlta(prev => [...prev, {
                                                        id: String(eq.id_equipo),
                                                        nombre: `${eq.nombre} (${eq.codigo})`,
                                                        datos_originales: eq
                                                    }]);
                                                }
                                            }}
                                            options={equipos
                                                .filter(e => {
                                                    const idStr = String(e.id_equipo);
                                                    return (e.estado?.toLowerCase() === 'inactivo' || (e as any).habilitado === 'N') &&
                                                        !equiposAlta.find(a => a.id === idStr);
                                                })
                                                .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre}` }))}
                                        />
                                    </div>
                                )}

                                {altaSubtype === 'CREAR' ? (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span>Código del Equipo</span>
                                                {generatingCode && <span style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>Generando...</span>}
                                            </label>
                                            <input
                                                type="text"
                                                name="codigo"
                                                value={formData.codigo}
                                                onChange={handleChange}
                                                className="form-input"
                                                required
                                                placeholder={generatingCode ? "Generando código..." : "Se generará automáticamente"}
                                                readOnly
                                                style={{
                                                    backgroundColor: (generatingCode || formData.codigo) ? '#f8fafc' : 'white',
                                                    color: generatingCode ? '#94a3b8' : '#1e293b',
                                                    fontWeight: formData.codigo ? 700 : 400,
                                                    border: formData.codigo ? '2px solid #3b82f640' : '1px solid #cbd5e1'
                                                }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <HybridSelect
                                                label="Tipo"
                                                placeholder="Ej: Instrumento"
                                                value={formData.tipo}
                                                onChange={(val) => {
                                                    handleSelectChange('tipo', val);
                                                    // Reset name when type changes to ensure it matches the new filter
                                                    setFormData(prev => ({ ...prev, nombre: '', codigo: '' }));
                                                }}
                                                options={tiposCatalogo.length > 0 ? tiposCatalogo : ['Analizador', 'Balanza', 'Cámara Fotográfica', 'Centrífuga', 'GPS', 'Instrumento', 'Medidor', 'Multiparámetro', 'Phmetro', 'Sonda']}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <HybridSelect
                                                label="Nombre del Equipo"
                                                placeholder="Ej: Multiparámetro"
                                                value={formData.nombre}
                                                onChange={(val) => handleSelectChange('nombre', val)}
                                                options={nombresCatalogo.filter(n => {
                                                    if (!formData.tipo) return true;
                                                    // This is a basic filter, but we might need more complex logic if names are typed
                                                    // Let's assume the names in the catalog are already loosely related or
                                                    // we'll filter by matching the equipment list directly
                                                    return equipos.some(e => e.tipo === formData.tipo && e.nombre === n);
                                                })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Ubicación</label>
                                            <select
                                                name="ubicacion"
                                                value={formData.ubicacion}
                                                onChange={handleChange}
                                                className="form-input"
                                                required
                                            >
                                                <option value="">Seleccione ubicación...</option>
                                                {['AY', 'VI', 'PM', 'PA', 'PV', 'CH', 'CM', 'CN', 'Terreno'].map(u => (
                                                    <option key={u} value={u}>{u}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <HybridSelect
                                                label="Responsable"
                                                placeholder="Ej: Juan Pérez"
                                                value={formData.responsable}
                                                onChange={(val) => {
                                                    const matching = muestreadores.find(m => m.nombre_muestreador === val);
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        responsable: val,
                                                        id_muestreador: matching?.id_muestreador || ''
                                                    }));
                                                }}
                                                options={muestreadores.map(m => m.nombre_muestreador)}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Fecha de Vigencia</label>
                                            <input type="date" name="vigencia" value={formData.vigencia} onChange={handleChange} className="form-input" required />
                                        </div>

                                        <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                                            <button
                                                type="submit"
                                                disabled={loading || !formData.codigo || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia}
                                                style={{
                                                    background: (loading || !formData.codigo || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia)
                                                        ? '#cbd5e1'
                                                        : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                                    padding: '0.8rem 3rem',
                                                    borderRadius: '10px',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    border: 'none',
                                                    cursor: (loading || !formData.codigo || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia) ? 'not-allowed' : 'pointer',
                                                    boxShadow: (loading || !formData.codigo || !formData.nombre || !formData.tipo || !formData.ubicacion || !formData.responsable || !formData.id_muestreador || !formData.vigencia) ? 'none' : '0 4px 6px rgba(22, 163, 74, 0.2)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {loading ? 'Enviando...' : 'Enviar Solicitud de Creación'}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    altaSubtype === 'ACTIVAR' && (
                                        <>
                                            {/* List of selected equipment for activation */}
                                            {equiposAlta.length > 0 && (
                                                <div style={{ gridColumn: 'span 2', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#4b5563' }}>Equipos seleccionados para reactivación:</p>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                        {equiposAlta.map(eq => (
                                                            <div key={eq.id} style={{
                                                                background: '#f0fdf4',
                                                                color: '#166534',
                                                                padding: '4px 10px',
                                                                borderRadius: '6px',
                                                                fontSize: '0.85rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                border: '1px solid #bbf7d0'
                                                            }}>
                                                                <span>{eq.nombre}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setEquiposAlta(prev => prev.filter(p => p.id !== eq.id))}
                                                                    style={{ background: 'none', border: 'none', color: '#166534', cursor: 'pointer', padding: 0 }}
                                                                >
                                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="form-group" style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
                                                <label className="form-label">Explique motivo de activación</label>
                                                <textarea
                                                    name="motivo"
                                                    value={formData.motivo}
                                                    onChange={handleChange}
                                                    className="form-input"
                                                    placeholder="Ej: El equipo ha sido reparado y calibrado. Requiere cambio de sede a Puerto Montt..."
                                                    style={{ height: '100px', resize: 'vertical' }}
                                                />
                                            </div>

                                            <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                                <button
                                                    type="submit"
                                                    disabled={loading || equiposAlta.length === 0}
                                                    style={{
                                                        background: (loading || equiposAlta.length === 0)
                                                            ? '#cbd5e1'
                                                            : 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                                                        padding: '0.8rem 2.5rem',
                                                        borderRadius: '10px',
                                                        color: 'white',
                                                        fontWeight: 700,
                                                        border: 'none',
                                                        cursor: (loading || equiposAlta.length === 0) ? 'not-allowed' : 'pointer',
                                                        boxShadow: (loading || equiposAlta.length === 0) ? 'none' : '0 4px 6px rgba(22, 163, 74, 0.2)',
                                                        transition: 'all 0.3s ease'
                                                    }}
                                                >
                                                    {loading ? 'Procesando...' : 'Confirmar Solicitud de Activación'}
                                                </button>
                                            </div>
                                        </>
                                    )
                                )}
                            </>
                        )}

                        {type === 'TRASPASO' && (
                            <>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <SearchableSelect
                                        label="Seleccionar Equipo"
                                        placeholder="Busque equipo por nombre o código..."
                                        value={formData.id_equipo}
                                        onChange={(val) => handleSelectChange('id_equipo', val)}
                                        options={equipos.map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre}` }))}
                                    />
                                </div>

                                {formData.id_equipo && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Ubicación Actual</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={equipos.find(e => String(e.id_equipo) === formData.id_equipo)?.ubicacion || ''}
                                                readOnly
                                                style={{
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#64748b',
                                                    border: '1px solid #e2e8f0',
                                                    cursor: 'not-allowed',
                                                    fontSize: '0.8rem',
                                                    padding: '0.4rem 0.75rem',
                                                    height: 'auto'
                                                }}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label" style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Responsable Actual</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                value={equipos.find(e => String(e.id_equipo) === formData.id_equipo)?.nombre_asignado || 'Sin Asignar'}
                                                readOnly
                                                style={{
                                                    backgroundColor: '#f1f5f9',
                                                    color: '#64748b',
                                                    border: '1px solid #e2e8f0',
                                                    cursor: 'not-allowed',
                                                    fontSize: '0.8rem',
                                                    padding: '0.4rem 0.75rem',
                                                    height: 'auto'
                                                }}
                                            />
                                        </div>
                                    </>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Nueva Ubicación</label>
                                    <select
                                        name="nueva_ubicacion"
                                        value={formData.nueva_ubicacion}
                                        onChange={handleChange}
                                        className="form-input"
                                        required
                                    >
                                        <option value="">Seleccione ubicación...</option>
                                        {['AY', 'VI', 'PM', 'PA', 'CM', 'CN', 'Terreno'].map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <HybridSelect
                                        label="Nuevo Responsable"
                                        placeholder="Nombre nuevo responsable"
                                        value={formData.nuevo_responsable}
                                        onChange={(val) => {
                                            const matching = muestreadores.find(m => m.nombre_muestreador === val);
                                            setFormData(prev => ({
                                                ...prev,
                                                nuevo_responsable: val,
                                                nuevo_responsable_id: matching?.id_muestreador || ''
                                            }));
                                        }}
                                        options={muestreadores
                                            .filter(m => {
                                                const currentEq = equipos.find(e => String(e.id_equipo) === formData.id_equipo);
                                                return !currentEq || Number(m.id_muestreador) !== Number(currentEq.id_muestreador);
                                            })
                                            .map(m => m.nombre_muestreador)}
                                        required
                                    />
                                </div>
                                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button
                                        type="submit"
                                        disabled={loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable}
                                        style={{
                                            background: (loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable)
                                                ? '#cbd5e1'
                                                : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
                                            padding: '0.8rem 2.5rem',
                                            borderRadius: '10px',
                                            color: 'white',
                                            fontWeight: 700,
                                            border: 'none',
                                            cursor: (loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable) ? 'not-allowed' : 'pointer',
                                            boxShadow: (loading || !formData.id_equipo || !formData.nueva_ubicacion || !formData.nuevo_responsable) ? 'none' : '0 4px 6px rgba(37, 99, 235, 0.2)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        {loading ? 'Enviando...' : 'Solicitar Traspaso'}
                                    </button>
                                </div>
                            </>
                        )}

                        {type === 'BAJA' && (
                            <>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <SearchableSelect
                                        label="Seleccionar Equipos para Baja"
                                        placeholder="Busque equipo por nombre o código..."
                                        value=""
                                        onChange={(val) => {
                                            const eq = equipos.find(e => String(e.id_equipo) === val);
                                            if (eq && !equiposBaja.find(b => b.id === val)) {
                                                setEquiposBaja(prev => [...prev, { id: String(eq.id_equipo), nombre: eq.nombre + ' (' + eq.codigo + ')' }]);
                                            }
                                        }}
                                        options={equipos
                                            .filter(e => {
                                                const idStr = String(e.id_equipo);
                                                // Item must be active AND not already selected AND not have a pending request
                                                return (e.estado?.toLowerCase() === 'activo' || (e as any).habilitado === 'S' || !(e.estado)) &&
                                                    !equiposBaja.find(b => b.id === idStr) &&
                                                    !pendingBajaIds.includes(idStr);
                                            })
                                            .map(e => ({ id: String(e.id_equipo), nombre: `${e.codigo} - ${e.nombre}` }))}
                                    />

                                    {/* List of selected equipment */}
                                    {equiposBaja.length > 0 && (
                                        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                            <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#4b5563' }}>Equipos seleccionados:</p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                {equiposBaja.map(eq => (
                                                    <div key={eq.id} style={{
                                                        background: '#fee2e2',
                                                        color: '#991b1b',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '0.85rem',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        border: '1px solid #fecaca'
                                                    }}>
                                                        <span>{eq.nombre}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEquiposBaja(prev => prev.filter(p => p.id !== eq.id))}
                                                            style={{ background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', padding: 0 }}
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="form-label">Motivo de la Baja</label>
                                    <textarea name="motivo" value={formData.motivo} onChange={handleChange} className="form-input" style={{ height: '100px', resize: 'vertical' }} required placeholder="Explique el motivo de la baja del equipo..."></textarea>
                                </div>

                                <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button
                                        type="submit"
                                        disabled={loading || equiposBaja.length === 0 || !formData.motivo}
                                        style={{
                                            background: (loading || equiposBaja.length === 0 || !formData.motivo)
                                                ? '#cbd5e1'
                                                : 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)',
                                            padding: '0.8rem 2.5rem',
                                            borderRadius: '10px',
                                            color: 'white',
                                            fontWeight: 700,
                                            border: 'none',
                                            cursor: (loading || equiposBaja.length === 0 || !formData.motivo) ? 'not-allowed' : 'pointer',
                                            boxShadow: (loading || equiposBaja.length === 0 || !formData.motivo) ? 'none' : '0 4px 6px rgba(153, 27, 27, 0.2)',
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        {loading ? 'Procesando...' : 'Confirmar Baja de Equipos'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </form>
            </div>

            {/* Historial de Solicitudes Filtrado por Tipo (Caja Extra) */}
            <div className="form-card animate-fade-in" style={{ maxWidth: '800px', margin: '1.5rem auto 0 auto', background: 'white', padding: '1.5rem 2rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Historial Reciente: {type === 'ALTA' ? 'Altas' : type === 'TRASPASO' ? 'Traspasos' : 'Bajas'}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {history.filter(s => s.tipo_solicitud === type).length === 0 ? (
                        <div style={{ padding: '1.5rem', textAlign: 'center', background: '#f9fafb', borderRadius: '8px', border: '1px dashed #d1d5db', color: '#6b7280', fontSize: '0.9rem' }}>
                            No tienes solicitudes recientes de este tipo.
                        </div>
                    ) : (
                        history
                            .filter(s => s.tipo_solicitud === type)
                            .slice(0, 5)
                            .map((sol) => (
                                <div key={sol.id_solicitud}
                                    onClick={() => setSelectedRequest(sol)}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.85rem 1.25rem',
                                        background: '#ffffff',
                                        borderRadius: '10px',
                                        border: '1px solid #e5e7eb',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.borderColor = '#2563eb';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.08)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.borderColor = '#e5e7eb';
                                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: sol.estado === 'PENDIENTE' ? '#fffbeb' : sol.estado === 'APROBADO' ? '#f0fdf4' : '#fef2f2',
                                            color: sol.estado === 'PENDIENTE' ? '#d97706' : sol.estado === 'APROBADO' ? '#16a34a' : '#dc2626'
                                        }}>
                                            {sol.estado === 'PENDIENTE' ? '⏳' : sol.estado === 'APROBADO' ? '✅' : '❌'}
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, color: '#111827', fontSize: '0.95rem', marginBottom: '0.15rem' }}>
                                                {sol.tipo_solicitud === 'ALTA' ? (sol.datos_json.equipos_alta ? `${sol.datos_json.equipos_alta.length} Equipos` : sol.datos_json.nombre) : sol.datos_json.codigo}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span>Enviado: {new Date(sol.fecha_solicitud).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span className={`status-pill status-${sol.estado.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '1px 8px' }}>
                                                    {sol.estado}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="modal-overlay" style={{ zIndex: 10001 }}>
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div className="modal-body" style={{ padding: '2rem' }}>
                            <div style={{
                                width: '60px', height: '60px', backgroundColor: '#eff6ff',
                                borderRadius: '50%', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', margin: '0 auto 1.5rem auto', color: '#2563eb'
                            }}>
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            </div>
                            <h3 style={{ marginBottom: '1rem', color: '#111827', fontSize: '1.25rem' }}>¿Enviar solicitud?</h3>
                            <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                                ¿Está seguro de que desea enviar esta solicitud de <strong>{type.toLowerCase()}</strong> al sistema?
                            </p>
                        </div>
                        <div className="modal-footer" style={{ border: 'none', paddingTop: 0 }}>
                            <button
                                type="button" className="btn-cancel"
                                onClick={() => setShowConfirm(false)}
                                disabled={loading}
                                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button" className="btn-primary"
                                onClick={confirmSubmit}
                                disabled={loading}
                                style={{ flex: 1, backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                {loading ? '...' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Request Detail Modal */}
            {selectedRequest && (
                <div className="modal-overlay" style={{ zIndex: 10001 }}>
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header" style={{
                            background: selectedRequest.tipo_solicitud === 'ALTA' ? 'linear-gradient(135deg, #22c55e, #16a34a)' :
                                selectedRequest.tipo_solicitud === 'TRASPASO' ? 'linear-gradient(135deg, #3b82f6, #2563eb)' :
                                    'linear-gradient(135deg, #ef4444, #dc2626)',
                            color: 'white',
                            padding: '1.25rem',
                            borderTopLeftRadius: '12px',
                            borderTopRightRadius: '12px'
                        }}>
                            <h3 className="modal-title" style={{ color: 'white', margin: 0 }}>Detalle de Solicitud: {selectedRequest.tipo_solicitud} {selectedRequest.datos_json?.isReactivation ? '(Reactivación)' : ''}</h3>
                        </div>
                        <div className="modal-body" style={{ padding: '1.5rem' }}>
                            <div style={{ display: 'grid', gap: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Estado:</span>
                                    <span className={`status-pill ${selectedRequest.estado === 'APROBADO' ? 'status-active' :
                                        selectedRequest.estado === 'PENDIENTE' ? 'status-pending' : 'status-inactive'
                                        }`} style={{ padding: '2px 10px', fontSize: '0.8rem' }}>
                                        {selectedRequest.estado}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                                    <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Fecha Solicitud:</span>
                                    <span style={{ fontWeight: 600, color: '#374151' }}>{new Date(selectedRequest.fecha_solicitud).toLocaleString()}</span>
                                </div>
                                {selectedRequest.fecha_revision && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                                        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Revisado el:</span>
                                        <span style={{ fontWeight: 600, color: '#374151' }}>{new Date(selectedRequest.fecha_revision).toLocaleString()}</span>
                                    </div>
                                )}
                                {selectedRequest.nombre_revisor && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                                        <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>Revisado por:</span>
                                        <span style={{ fontWeight: 600, color: '#374151' }}>{selectedRequest.nombre_revisor}</span>
                                    </div>
                                )}

                                <div style={{ marginTop: '0.5rem' }}>
                                    <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#111827', marginBottom: '0.75rem' }}>Datos de la Solicitud:</h4>
                                    <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.9rem' }}>
                                        {selectedRequest.tipo_solicitud === 'ALTA' && (
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                {selectedRequest.datos_json?.equipos_alta ? (
                                                    <div>
                                                        <strong>Equipos para Reactivación ({selectedRequest.datos_json.equipos_alta.length}):</strong>
                                                        <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.5rem' }}>
                                                            {selectedRequest.datos_json.equipos_alta.map((eq: any) => {
                                                                const isProcesado = eq.procesado === true;
                                                                return (
                                                                    <div key={eq.id} style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.5rem',
                                                                        background: isProcesado ? '#f0fdf4' : 'white',
                                                                        padding: '4px 8px',
                                                                        borderRadius: '4px',
                                                                        border: `1px solid ${isProcesado ? '#bbf7d0' : '#e5e7eb'}`
                                                                    }}>
                                                                        {isProcesado ? (
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                        ) : (
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                                        )}
                                                                        <span style={{
                                                                            color: isProcesado ? '#166534' : '#4b5563',
                                                                            textDecoration: isProcesado ? 'line-through' : 'none',
                                                                            fontSize: '0.85rem'
                                                                        }}>{eq.nombre}</span>
                                                                        {isProcesado && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 800, color: '#16a34a' }}>REACTIVADO</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div><strong>Código:</strong> {selectedRequest.datos_json?.codigo}</div>
                                                        <div><strong>Nombre:</strong> {selectedRequest.datos_json?.nombre}</div>
                                                        <div><strong>Tipo:</strong> {selectedRequest.datos_json?.tipo}</div>
                                                        <div><strong>Ubicación:</strong> {selectedRequest.datos_json?.ubicacion}</div>
                                                        <div><strong>Responsable:</strong> {selectedRequest.datos_json?.responsable}</div>
                                                    </>
                                                )}
                                                <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                                                    <strong>Motivo:</strong>
                                                    <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563' }}>{selectedRequest.datos_json?.motivo || 'No especificado'}</p>
                                                </div>
                                            </div>
                                        )}
                                        {selectedRequest.tipo_solicitud === 'TRASPASO' && (
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                <div><strong>ID Equipo:</strong> {selectedRequest.datos_json?.id_equipo}</div>
                                                <div><strong>Nueva Ubicación:</strong> {selectedRequest.datos_json?.nueva_ubicacion}</div>
                                                <div><strong>Nuevo Responsable:</strong> {selectedRequest.datos_json?.nuevo_responsable}</div>
                                            </div>
                                        )}
                                        {selectedRequest.tipo_solicitud === 'BAJA' && (
                                            <div style={{ display: 'grid', gap: '0.5rem' }}>
                                                {selectedRequest.datos_json?.equipos_baja ? (
                                                    <div>
                                                        <strong>Equipos ({selectedRequest.datos_json.equipos_baja.length}):</strong>
                                                        <div style={{ display: 'grid', gap: '0.4rem', marginTop: '0.5rem' }}>
                                                            {selectedRequest.datos_json.equipos_baja.map((eq: any) => {
                                                                const isProcesado = eq.procesado === true;
                                                                return (
                                                                    <div key={eq.id} style={{
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '0.5rem',
                                                                        background: isProcesado ? '#f0fdf4' : 'white',
                                                                        padding: '4px 8px',
                                                                        borderRadius: '4px',
                                                                        border: `1px solid ${isProcesado ? '#bbf7d0' : '#e5e7eb'}`
                                                                    }}>
                                                                        {isProcesado ? (
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                                        ) : (
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="3"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                                                        )}
                                                                        <span style={{
                                                                            color: isProcesado ? '#166534' : '#4b5563',
                                                                            textDecoration: isProcesado ? 'line-through' : 'none',
                                                                            fontSize: '0.85rem'
                                                                        }}>{eq.nombre}</span>
                                                                        {isProcesado && <span style={{ marginLeft: 'auto', fontSize: '0.65rem', fontWeight: 800, color: '#16a34a' }}>DADO DE BAJA</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div><strong>ID Equipo:</strong> {selectedRequest.datos_json?.id_equipo}</div>
                                                )}
                                                <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                                                    <strong>Motivo:</strong>
                                                    <p style={{ margin: '0.25rem 0 0 0', color: '#4b5563' }}>{selectedRequest.datos_json?.motivo}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {selectedRequest.feedback_admin && (
                                    <div style={{ marginTop: '1rem', animation: 'pulse-custom 2s infinite ease-in-out' }}>
                                        <h4 style={{
                                            fontSize: '0.95rem',
                                            fontWeight: 700,
                                            color: selectedRequest.estado === 'RECHAZADA' ? '#dc2626' : '#16a34a',
                                            marginBottom: '0.5rem',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '0.5rem'
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                                            </svg>
                                            Respuesta del Administrador:
                                        </h4>
                                        <div style={{
                                            background: selectedRequest.estado === 'RECHAZADA' ? '#fff1f2' : '#f0fdf4',
                                            padding: '1.25rem',
                                            borderRadius: '10px',
                                            border: `2px solid ${selectedRequest.estado === 'RECHAZADA' ? '#fecaca' : '#bbf7d0'}`,
                                            color: selectedRequest.estado === 'RECHAZADA' ? '#991b1b' : '#166534',
                                            fontSize: '0.95rem',
                                            fontStyle: 'italic',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                            lineHeight: '1.5'
                                        }}>
                                            "{selectedRequest.feedback_admin}"
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ border: 'none', paddingTop: 0 }}>
                            <button
                                type="button"
                                className="btn-cancel"
                                onClick={() => setSelectedRequest(null)}
                                style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', height: '40px' }}
                            >
                                Cerrar Detalle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SolicitudesMaPage;
