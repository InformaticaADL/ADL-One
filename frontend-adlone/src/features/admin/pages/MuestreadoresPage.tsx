import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/admin.service';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { MuestreadorModal } from '../components/MuestreadorModal';
import '../admin.css';

interface Props {
    onBack: () => void;
}

export const MuestreadoresPage: React.FC<Props> = ({ onBack }) => {
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ACTIVOS');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedMuestreador, setSelectedMuestreador] = useState<any | null>(null);

    // Confirm Modal State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [muestreadorToDisable, setMuestreadorToDisable] = useState<any | null>(null);

    // Image Zoom State
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const result = await adminService.getMuestreadores(searchTerm, statusFilter);
            setMuestreadores(result.data || []); // Access data property from API response
        } catch (error) {
            console.error('Error fetching muestreadores:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Debounce search slightly
        const timer = setTimeout(() => {
            fetchData();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm, statusFilter]);

    const handleCreate = () => {
        setSelectedMuestreador(null);
        setIsModalOpen(true);
    };

    const handleEdit = (m: any) => {
        setSelectedMuestreador(m);
        setIsModalOpen(true);
    };

    const handleDisableClick = (m: any) => {
        setMuestreadorToDisable(m);
        setIsConfirmModalOpen(true);
    };

    const confirmDisable = async () => {
        if (!muestreadorToDisable) return;

        try {
            await adminService.disableMuestreador(muestreadorToDisable.id_muestreador);
            fetchData();
            setIsConfirmModalOpen(false);
            setMuestreadorToDisable(null);
        } catch (error) {
            console.error(error);
            alert('Error al deshabilitar'); // Keep simple alert for error or use toast if available
        }
    };

    return (
        <div className="admin-container">
            <div className="admin-header-section">
                <button onClick={onBack} className="btn-back">
                    <span className="icon-circle">←</span>
                    Volver
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div>
                        <h1 className="admin-title">Gestión de Muestreadores</h1>
                        <p className="admin-subtitle">Administra el personal de muestreo y sus firmas.</p>
                    </div>
                    <button className="btn-primary" onClick={handleCreate}>
                        + Nuevo Muestreador
                    </button>
                </div>
            </div>

            {/* FILTROS */}
            <div className="filters-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#64748b' }}>Buscar por Nombre</label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="Escriba nombre..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ width: '200px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.3rem', color: '#64748b' }}>Estado</label>
                    <select
                        className="form-input"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="ACTIVOS">Solo Activos</option>
                        <option value="INACTIVOS">Solo Inactivos</option>
                        <option value="TODOS">Todos</option>
                    </select>
                </div>
            </div>

            {/* TABLA */}
            <div className="table-container">
                <table className="admin-table-compact">
                    <thead>
                        <tr>
                            <th style={{ width: '30%' }}>Nombre / ID</th>
                            <th style={{ width: '25%' }}>Correo Electrónico</th>
                            <th style={{ width: '15%' }}>Estado</th>
                            <th style={{ width: '15%' }}>Firma</th>
                            <th style={{ width: '15%', textAlign: 'center' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>Cargando registros...</td></tr>
                        ) : muestreadores.length === 0 ? (
                            <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>No se encontraron muestreadores.</td></tr>
                        ) : (
                            muestreadores.map(m => (
                                <tr key={m.id_muestreador}>
                                    <td>
                                        <div style={{ fontWeight: '600', color: '#111827' }}>{m.nombre_muestreador}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>ID: {m.id_muestreador}</div>
                                    </td>
                                    <td style={{ color: '#4b5563' }}>{m.correo_electronico}</td>
                                    <td>
                                        <span className={`status-pill ${m.habilitado === 'S' ? 'status-active' : 'status-inactive'}`}>
                                            {m.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td>
                                        {m.firma_muestreador ? (
                                            <div
                                                style={{
                                                    width: '80px',
                                                    height: '40px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'zoom-in',
                                                    backgroundColor: '#f9fafb'
                                                }}
                                                onClick={() => setZoomedImage(m.firma_muestreador)}
                                                title="Ver firma ampliada"
                                            >
                                                <img
                                                    src={m.firma_muestreador}
                                                    alt="Firma"
                                                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                                />
                                            </div>
                                        ) : (
                                            <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>Sin firma</span>
                                        )}
                                    </td>
                                    <td>
                                        <div className="action-buttons" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                            <button
                                                className="btn-icon"
                                                onClick={() => handleEdit(m)}
                                                title="Editar"
                                                style={{ color: '#2563eb', background: '#eff6ff', padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                            </button>
                                            {m.habilitado === 'S' && (
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handleDisableClick(m)}
                                                    title="Deshabilitar"
                                                    style={{ color: '#dc2626', background: '#fef2f2', padding: '6px', borderRadius: '4px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL MUESTREADOR */}
            <MuestreadorModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={fetchData}
                initialData={selectedMuestreador}
            />

            {/* CONFIRM MODAL */}
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                title="Confirmar Deshabilitación"
                message={`¿Está seguro de deshabilitar a ${muestreadorToDisable?.nombre_muestreador}? Esta acción impedirá que el muestreador sea asignado a nuevas fichas.`}
                confirmText="Deshabilitar"
                confirmColor="#dc2626"
                onConfirm={confirmDisable}
                onCancel={() => {
                    setIsConfirmModalOpen(false);
                    setMuestreadorToDisable(null);
                }}
            />

            {/* IMAGE ZOOM MODAL */}
            {zoomedImage && (
                <div className="modal-overlay" onClick={() => setZoomedImage(null)} style={{ zIndex: 10000 }}>
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                        <img src={zoomedImage} alt="Firma Ampliada" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }} />
                        <button
                            onClick={() => setZoomedImage(null)}
                            style={{
                                position: 'absolute', top: '-15px', right: '-15px',
                                background: 'white', border: 'none', borderRadius: '50%',
                                width: '30px', height: '30px', cursor: 'pointer', fontWeight: 'bold'
                            }}
                        >✕</button>
                    </div>
                </div>
            )}
        </div>
    );
};
