import React from 'react';
import '../admin.css';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const AdminMaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const OPTIONS = [
        { id: 'admin-muestreadores', label: 'Muestreadores', icon: '🧑‍🔬', description: 'Gestión de muestreadores activos, firmas y datos.' },
        { id: 'admin-equipos', label: 'Equipos', icon: '⚗️', description: 'Gestión de equipos, códigos y vencimientos de calibración.' },
        { id: 'ma-solicitudes', label: 'Realizar Solicitudes', icon: '📝', description: 'Creación de solicitudes de alta, traspaso y baja de equipos.' },
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

                <h1 className="admin-title">Medio Ambiente</h1>
                <p className="admin-subtitle">Gestión de recursos y personal de Medio Ambiente.</p>
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
