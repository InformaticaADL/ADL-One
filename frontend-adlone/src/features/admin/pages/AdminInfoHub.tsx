import React from 'react';


// Mock list of areas as requested
const AREAS = [
    { id: 'gem', label: 'GEM', icon: '🧬' },
    { id: 'necropsia', label: 'Necropsia', icon: '🐟' },
    { id: 'microscopia', label: 'Microscopía', icon: '🔬' },
    { id: 'biologia_molecular', label: 'Biología Molecular', icon: '🧪' },
    { id: 'cultivo_celular', label: 'Cultivo Celular', icon: '🧫' },
    { id: 'bacteriologia', label: 'Bacteriología', icon: '🦠' },
    { id: 'screening', label: 'Screening', icon: '🔎' },
    { id: 'derivaciones', label: 'Derivaciones', icon: '📬' },
    { id: 'medio_ambiente', label: 'Medio Ambiente', icon: '🌿' },
    { id: 'atl', label: 'ATL', icon: '⚖️' },
    { id: 'id', label: 'I+D', icon: '💡' },
    { id: 'pve', label: 'PVE', icon: '🩺' },
    { id: 'informatica', label: 'Informática', icon: '💻' },
    { id: 'comercial', label: 'Comercial', icon: '📈' },
    { id: 'gestion_calidad', label: 'Gestión de Calidad', icon: '⭐' },
    { id: 'administracion', label: 'Administración', icon: '🏢' },
];

import '../admin.css';

interface Props {
    onNavigate: (areaId: string) => void;
}

export const AdminInfoHub: React.FC<Props> = ({ onNavigate }) => {
    return (
        <div className="admin-container">
            <div className="admin-header-section">
                <h1 className="admin-title">Admin. Información</h1>
                <p className="admin-subtitle">Seleccione un área para gestionar su información.</p>
            </div>

            <div className="hub-grid">
                {AREAS.map((area) => (
                    <div
                        key={area.id}
                        onClick={() => onNavigate(area.id)}
                        className="hub-card"
                    >
                        <div className="card-icon-wrapper">
                            {area.icon}
                        </div>
                        <div>
                            <h3 className="card-title">{area.label}</h3>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
