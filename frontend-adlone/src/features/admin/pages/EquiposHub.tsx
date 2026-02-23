import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import '../admin.css';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const EquiposHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const OPTIONS = [
        {
            id: 'ma-reportes-view',
            label: 'Reportes',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            ),
            description: 'Visualización de reportes de problemas y bajas por pérdida.',
            permission: 'AI_GC_EQUIPOS'
        },
        {
            id: 'admin-equipos-gestion',
            label: 'Gestión de Equipos',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
            ),
            description: 'Inventario, configuración y mantenimiento de equipos.',
            permission: 'AI_GC_EQUIPOS'
        },
    ];

    const visibleOptions = OPTIONS.filter(opt => {
        // Special handling: Admin sees all
        if (hasPermission('MA_ADMIN_ACCESO')) return true;

        // Specific checks
        if (opt.permission === 'AI_GC_EQUIPOS') {
            return hasPermission('AI_GC_EQUIPOS') || hasPermission('AI_GC_ACCESO') || hasPermission('AI_MA_EQUIPOS');
        }

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
                            <h3 className="card-title">{opt.label}</h3>
                            <p className="card-desc">{opt.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
