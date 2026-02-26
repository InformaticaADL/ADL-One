import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';


// Mock list of areas as requested
// List of areas with specific permissions
const AREAS: { id: string, label: string, icon: string, permission: string | string[] }[] = [
    { id: 'gem', label: 'GEM', icon: '🧬', permission: 'GEM_ACCESO' },
    { id: 'necropsia', label: 'Necropsia', icon: '🐟', permission: 'NEC_ACCESO' },
    { id: 'microscopia', label: 'Microscopía', icon: '🔬', permission: 'MIC_ACCESO' },
    { id: 'biologia_molecular', label: 'Biología Molecular', icon: '🧪', permission: 'BM_ACCESO' },
    { id: 'cultivo_celular', label: 'Cultivo Celular', icon: '🧫', permission: 'CC_ACCESO' },
    { id: 'bacteriologia', label: 'Bacteriología', icon: '🦠', permission: 'BAC_ACCESO' },
    { id: 'screening', label: 'Screening', icon: '🔎', permission: 'SCR_ACCESO' },
    { id: 'derivaciones', label: 'Derivaciones', icon: '📬', permission: 'DER_ACCESO' },
    { id: 'medio_ambiente', label: 'Medio Ambiente', icon: '🌿', permission: 'MA_ACCESO' },
    { id: 'atl', label: 'ATL', icon: '⚖️', permission: 'ATL_ACCESO' },
    { id: 'id', label: 'I+D', icon: '💡', permission: 'ID_ACCESO' },
    { id: 'pve', label: 'PVE', icon: '🩺', permission: 'PVE_ACCESO' },
    { id: 'informatica', label: 'Informática', icon: '💻', permission: 'INF_ACCESO' },
    { id: 'comercial', label: 'Comercial', icon: '📈', permission: 'COM_ACCESO' },
    { id: 'gestion_calidad', label: 'Gestión de Calidad', icon: '⭐', permission: 'GC_ACCESO' },
    { id: 'administracion', label: 'Administración', icon: '🏢', permission: 'ADM_ACCESO' },
];

import '../admin.css';

interface Props {
    onNavigate: (areaId: string) => void;
}

export const AdminInfoHub: React.FC<Props> = ({ onNavigate }) => {
    const { hasPermission } = useAuth();

    // Filter areas based on user permissions
    // If user is SuperAdmin (AI_MA_ADMIN_ACCESO), show all.
    // Otherwise, check for specific area permission.
    const visibleAreas = AREAS.filter(area => {
        if (hasPermission('AI_MA_ADMIN_ACCESO')) return true;
        if (Array.isArray(area.permission)) {
            return area.permission.some(p => hasPermission(p));
        }
        return hasPermission(area.permission);
    });

    return (
        <div className="admin-container">
            <div className="admin-header-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.25rem' }}>
                <h1 className="admin-title" style={{ margin: 0 }}>Admin. Información</h1>
                <p className="admin-subtitle" style={{ margin: 0 }}>Seleccione un área para gestionar su información.</p>
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
