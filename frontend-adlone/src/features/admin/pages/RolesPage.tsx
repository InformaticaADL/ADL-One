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
            <div className="admin-header-section responsive-header">
                {/* Izquierda: Botón Volver */}
                <div style={{ justifySelf: 'start' }}>
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
                </div>

                {/* Centro: Título y Subtítulo */}
                <div style={{ justifySelf: 'center', textAlign: 'center' }}>
                    <h1 className="admin-title">Administración de Roles</h1>
                    <p className="admin-subtitle">Gestiona los perfiles de acceso y permisos del sistema.</p>
                </div>

                {/* Derecha: Acción */}
                <div style={{ justifySelf: 'end' }}>
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
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', color: '#6b7280' }}>
                                        <div style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spinner-spin 1s linear infinite' }}></div>
                                        Cargando roles...
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            roles.map((role) => (
                                <tr
                                    key={role.id_rol}
                                    className="mobile-clickable-row"
                                    onClick={() => {
                                        // On mobile, clicking the row opens the modal directly
                                        if (window.innerWidth <= 768) {
                                            handleEdit(role);
                                        }
                                    }}
                                >
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
                                            style={{
                                                padding: '0.4rem 0.8rem',
                                                borderRadius: '6px',
                                                border: '1px solid #c7d2fe',
                                                background: '#e0e7ff',
                                                color: '#4338ca',
                                                fontWeight: 600,
                                                fontSize: '0.85rem',
                                                cursor: 'pointer',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '0.4rem',
                                                transition: 'all 0.2s',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}
                                            onMouseEnter={e => {
                                                e.currentTarget.style.background = '#c7d2fe';
                                                e.currentTarget.style.borderColor = '#a5b4fc';
                                            }}
                                            onMouseLeave={e => {
                                                e.currentTarget.style.background = '#e0e7ff';
                                                e.currentTarget.style.borderColor = '#c7d2fe';
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
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
