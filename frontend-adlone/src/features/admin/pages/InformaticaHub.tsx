import React from 'react';
import '../admin.css';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const InformaticaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const OPTIONS = [
        { id: 'admin-roles', label: 'Gestión de Roles', icon: '🛡️', description: 'Definir perfiles y permisos del sistema.' },
        { id: 'admin-users', label: 'Gestión de Usuarios', icon: '👤', description: 'Crear, editar y administrar usuarios.' },
        { id: 'admin-user-roles', label: 'Asignación de Roles', icon: '👥', description: 'Asignar roles a los usuarios.' },
        { id: 'admin-notifications', label: 'Notificaciones', icon: '🔔', description: 'Configurar eventos y destinatarios de correo.' },
    ];

    return (
        <div className="admin-container">
            <div className="admin-header-section">
                <button onClick={onBack} className="btn-back">
                    <span className="icon-circle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </span>
                    Volver a Administración
                </button>

                <h1 className="admin-title">Informática</h1>
                <p className="admin-subtitle">Centro de control y seguridad del sistema.</p>
            </div>

            <div className="hub-grid">
                {OPTIONS.map((opt) => (
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
