import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { adminService } from '../../../services/admin.service';
import '../admin.css';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const EquiposHub: React.FC<Props> = ({ onNavigate, onBack }) => {
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
        // Only fetch if they have access
        if (hasPermission('MA_A_GEST_EQUIPO') || hasPermission('AI_MA_SOLICITUDES') || hasPermission('AI_MA_ADMIN_ACCESO')) {
            fetchStats();
        }
    }, [hasPermission]);

    const OPTIONS = [
        {
            id: 'admin-equipos-gestion',
            label: 'Gestión de Equipos',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
            ),
            description: 'Inventario, configuración y mantenimiento de equipos.',
            permission: 'MA_A_GEST_EQUIPO'
        },
    ];

    const visibleOptions = OPTIONS.filter(opt => {
        // Specific legacy/shared checks (can be removed if all use individual perms)
        return hasPermission(opt.permission);
    });

    return (
        <div className="admin-container">
            <div className="admin-header-section responsive-header">
                {/* Columna izquierda: botón Volver */}
                <div style={{ justifySelf: 'start' }}>
                    <button onClick={onBack} className="btn-back">
                        <span className="icon-circle">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>
                        </span>
                        Volver a Medio Ambiente
                    </button>
                </div>

                {/* Columna central: título + subtitulo */}
                <div style={{ justifySelf: 'center', textAlign: 'center' }}>
                    <h1 className="admin-title" style={{ margin: '0 0 0.15rem 0' }}>Centro de Equipos</h1>
                    <p className="admin-subtitle" style={{ margin: 0 }}>Seleccione una acción para continuar.</p>
                </div>

                {/* Columna derecha: vacía (balance) */}
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
                                {opt.id === 'admin-equipos-gestion' && pendientes > 0 && (
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
