import React from 'react';
import '../admin.css';

interface Props {
    onBack: () => void;
}

export const EquiposPage: React.FC<Props> = ({ onBack }) => {
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
                    Volver a Medio Ambiente
                </button>
                <h1 className="admin-title">Gestión de Equipos</h1>
            </div>
            <p>Lista de Equipos (En construcción)</p>
        </div>
    );
};
