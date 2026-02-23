import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import '../admin.css';

interface Props {
    onNavigate: (view: string) => void;
    onBack: () => void;
}

export const AdminMaHub: React.FC<Props> = ({ onNavigate, onBack }) => {
    const { hasPermission } = useAuth();

    const OPTIONS = [
        { id: 'admin-muestreadores', label: 'Muestreadores', icon: '🧑‍🔬', description: 'Gestión de muestreadores activos, firmas y datos.', permission: 'AI_MA_MUESTREADORES' },
        {
            id: 'admin-equipos',
            label: 'Equipos',
            icon: (
                <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '42px', lineHeight: '1' }}>🖥️</span>
                    <span style={{ position: 'absolute', bottom: '-5px', right: '-8px', fontSize: '24px', filter: 'drop-shadow(2px 2px 0 white)' }}>⚙️</span>
                </div>
            ),
            description: 'Gestión de equipos, códigos y vencimientos de calibración.',
            permission: 'AI_MA_EQUIPOS'
        },
        { id: 'ma-solicitudes', label: 'Realizar Solicitudes', icon: '📝', description: 'Creación de solicitudes de alta, traspaso y baja de equipos.', permission: 'AI_MA_SOLICITUDES' },
    ];

    const visibleOptions = OPTIONS.filter(opt => {
        if (opt.id === 'ma-solicitudes') {
            return hasPermission('AI_MA_SOLICITUDES') || hasPermission('MA_ADMIN_ACCESO');
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
                            <h3 className="card-title">{opt.label}</h3>
                            <p className="card-desc">{opt.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
