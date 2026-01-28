import { useEffect, useState } from 'react';
import { rbacService } from '../services/rbac.service';
import type { Role } from '../services/rbac.service';
import { RoleModal } from '../components/RoleModal';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    onBack?: () => void;
}

import '../admin.css';

export const RolesPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedRole, setSelectedRole] = useState<Role | null>(null);

    useEffect(() => {
        loadRoles();
    }, []);

    const loadRoles = async () => {
        setLoading(true);
        try {
            const data = await rbacService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
            showToast({ type: 'error', message: 'Error cargando roles' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedRole(null);
        setIsModalOpen(true);
    };

    const handleEdit = (role: Role) => {
        setSelectedRole(role);
        setIsModalOpen(true);
    };

    return (
        <div className="admin-container">
            <div className="admin-header-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        {onBack && (
                            <button onClick={onBack} className="btn-back">
                                <span className="icon-circle">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="19" y1="12" x2="5" y2="12"></line>
                                        <polyline points="12 19 5 12 12 5"></polyline>
                                    </svg>
                                </span>
                                Volver
                            </button>
                        )}
                        <h1 className="admin-title">Administración de Roles</h1>
                        <p className="admin-subtitle">Gestiona los perfiles de acceso y permisos del sistema.</p>
                    </div>

                    <button onClick={handleCreate} className="btn-primary">
                        + Nuevo Rol
                    </button>
                </div>
            </div>

            <div className="table-container">
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Rol</th>
                            <th>Descripción</th>
                            <th>Estado</th>
                            <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={4} className="loading-state">
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                        <svg className="spinner" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                            <circle cx="12" cy="12" r="10" strokeWidth="4" opacity="0.25"></circle>
                                            <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75" fill="currentColor"></path>
                                        </svg>
                                        Cargando roles...
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            roles.map((role) => (
                                <tr key={role.id_rol}>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{role.nombre_rol}</div>
                                    </td>
                                    <td>
                                        <div className="text-subtle">{role.descripcion}</div>
                                    </td>
                                    <td>
                                        <span style={{
                                            padding: '2px 8px',
                                            borderRadius: '999px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            backgroundColor: role.estado ? '#d1fae5' : '#fee2e2',
                                            color: role.estado ? '#065f46' : '#991b1b'
                                        }}>
                                            {role.estado ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <button
                                            onClick={() => handleEdit(role)}
                                            style={{ color: '#4f46e5', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 500 }}
                                        >
                                            Editar / Permisos
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <RoleModal
                isOpen={isModalOpen}
                role={selectedRole}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadRoles}
            />
        </div>
    );
};
