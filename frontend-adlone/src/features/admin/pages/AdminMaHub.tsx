import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { adminService } from '../../../services/admin.service';
import '../admin.css';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const AdminMaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();
    const [pendientes, setPendientes] = useState(0);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await adminService.getDashboardStats();
                if (data) {
                    setPendientes(data.pendientesTecnica || 0);
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            }
        };
        // Technical/Admin access check
        if (hasPermission('AI_MA_SOLICITUDES') || hasPermission('AI_MA_ADMIN_ACCESO') || hasPermission('MA_A_GEST_EQUIPO')) {
            fetchStats();
        }
    }, [hasPermission]);

    const OPTIONS = [
        { id: 'admin-muestreadores', label: 'Muestreadores', icon: '🧑‍🔬', description: 'Gestión de muestreadores activos, firmas y datos.', permission: 'MA_MUESTREADORES' },
        { id: 'ma-solicitudes', label: 'Solicitudes', icon: '📝', description: 'Creación de solicitudes de alta, traspaso y baja de equipos.', permission: 'AI_MA_SOLICITUDES' },
    ];

    const visibleOptions = OPTIONS.filter(opt => {
        if (opt.id === 'ma-solicitudes') {
            return hasPermission('AI_MA_SOLICITUDES') || hasPermission('AI_MA_ADMIN_ACCESO');
        }
        return hasPermission(opt.permission);
    });

    return (
        <div className="admin-container">
            <div className="admin-header-section responsive-header">
                {/* Izquierda: botón Volver */}
                <div style={{ justifySelf: 'start' }}>
                    <button onClick={onBack} className="btn-back">
                        <span className="icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </span>
                        Volver a Administración
                    </button>
                </div>

                {/* Centro: título + subtitulo */}
                <div style={{ justifySelf: 'center', textAlign: 'center' }}>
                    <h1 className="admin-title" style={{ margin: '0 0 0.15rem 0' }}>Medio Ambiente</h1>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Gestión de recursos y personal de Medio Ambiente.</p>
                </div>

                {/* Derecha: vacío (balance) */}
                <div></div>
            </div>

            <div className="hub-grid">
                {visibleOptions.map((opt) => (
                    <div
                        key={opt.id}
                        onClick={() => onNavigate(opt.id)}
                        className="hub-card"
                    >
                        <div className="card-icon-wrapper">
                            {opt.icon}
                        </div>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                <h3 className="card-title" style={{ margin: 0 }}>{opt.label}</h3>
                                {opt.id === 'ma-solicitudes' && pendientes > 0 && (
                                    <span style={{
                                        background: '#ef4444',
                                        color: 'white',
                                        fontSize: '0.7rem',
                                        fontWeight: 'bold',
                                        padding: '2px 8px',
                                        borderRadius: '12px'
                                    }}>
                                        {pendientes} pendientes
                                    </span>
                                )}
                            </div>
                            <p className="card-desc">{opt.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
