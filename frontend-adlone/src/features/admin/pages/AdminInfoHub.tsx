import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';


// Mock list of areas as requested
// List of areas with specific permissions
const AREAS = [
    { id: 'gem', label: 'GEM', icon: '🧬', permission: 'AI_GEM_ACCESO' },
    { id: 'necropsia', label: 'Necropsia', icon: '🐟', permission: 'AI_NEC_ACCESO' },
    { id: 'microscopia', label: 'Microscopía', icon: '🔬', permission: 'AI_MIC_ACCESO' },
    { id: 'biologia_molecular', label: 'Biología Molecular', icon: '🧪', permission: 'AI_BM_ACCESO' },
    { id: 'cultivo_celular', label: 'Cultivo Celular', icon: '🧫', permission: 'AI_CC_ACCESO' },
    { id: 'bacteriologia', label: 'Bacteriología', icon: '🦠', permission: 'AI_BAC_ACCESO' },
    { id: 'screening', label: 'Screening', icon: '🔎', permission: 'AI_SCR_ACCESO' },
    { id: 'derivaciones', label: 'Derivaciones', icon: '📬', permission: 'AI_DER_ACCESO' },
    { id: 'medio_ambiente', label: 'Medio Ambiente', icon: '🌿', permission: 'AI_MA_ACCESO' },
    { id: 'atl', label: 'ATL', icon: '⚖️', permission: 'AI_ATL_ACCESO' },
    { id: 'id', label: 'I+D', icon: '💡', permission: 'AI_ID_ACCESO' },
    { id: 'pve', label: 'PVE', icon: '🩺', permission: 'AI_PVE_ACCESO' },
    { id: 'informatica', label: 'Informática', icon: '💻', permission: 'AI_INF_ACCESO' },
    { id: 'comercial', label: 'Comercial', icon: '📈', permission: 'AI_COM_ACCESO' },
    { id: 'gestion_calidad', label: 'Gestión de Calidad', icon: '⭐', permission: 'AI_GC_ACCESO' },
    { id: 'administracion', label: 'Administración', icon: '🏢', permission: 'AI_ADM_ACCESO' },
];

import '../admin.css';

interface Props {
    onNavigate: (areaId: string) => void;
}

export const AdminInfoHub: React.FC<Props> = ({ onNavigate }) => {
    const { hasPermission } = useAuth();

    // Filter areas based on user permissions
    // If user is SuperAdmin (MA_ADMIN_ACCESO), show all.
    // Otherwise, check for specific area permission.
    const visibleAreas = AREAS.filter(area =>
        hasPermission('MA_ADMIN_ACCESO') || hasPermission(area.permission)
    );

    return (
        <div className="admin-container">
            <div className="admin-header-section">
                <h1 className="admin-title">Admin. Información</h1>
                <p className="admin-subtitle">Seleccione un área para gestionar su información.</p>
            </div>

            <div className="hub-grid">
                {visibleAreas.map((area) => (
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
