import React, { useEffect, useState } from 'react';
import { rbacService } from '../services/rbac.service';
import type { Role, User } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    user: User | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const UserRoleModal: React.FC<Props> = ({ user, isOpen, onClose, onSuccess }) => {
    const { showToast } = useToast();
    const [roles, setRoles] = useState<Role[]>([]);
    const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadRoles();
            if (user) {
                loadUserRoles(user.id_usuario);
            } else {
                setSelectedRoleIds([]);
            }
        }
    }, [isOpen, user]);

    const loadRoles = async () => {
        try {
            const data = await rbacService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
            showToast({ type: 'error', message: 'Error cargando roles' });
        }
    };

    const loadUserRoles = async (userId: number) => {
        try {
            const userRoles = await rbacService.getUserRoles(userId);
            setSelectedRoleIds(userRoles.map(r => r.id_rol));
        } catch (error) {
            console.error('Error loading user roles:', error);
        }
    };

    const toggleRole = (roleId: number) => {
        setSelectedRoleIds(prev =>
            prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
        );
    };

    const handleSave = async () => {
        if (!user) return;

        setLoading(true);
        try {
            await rbacService.assignRolesToUser(user.id_usuario, selectedRoleIds);
            showToast({ type: 'success', message: 'Roles asignados correctamente' });
            onSuccess();
            onClose();
        } catch (error) {
            console.error('Error assigning roles:', error);
            showToast({ type: 'error', message: 'Error asignando roles' });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !user) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="modal-title">
                        Asignar Roles: <span style={{ color: '#2563eb' }}>{user.nombre_real || user.nombre_usuario}</span>
                    </h2>
                    <button onClick={onClose} className="btn-close" title="Cerrar">×</button>
                </div>

                <div className="modal-body">
                    <p className="text-subtle" style={{ marginBottom: '1rem' }}>Seleccione los roles que desea asignar a este usuario.</p>

                    {roles.length === 0 ? (
                        <p>No hay roles disponibles.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {roles.map(role => (
                                <label key={role.id_rol} style={{
                                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem',
                                    border: '1px solid #e5e7eb', borderRadius: '0.5rem', cursor: 'pointer',
                                    backgroundColor: selectedRoleIds.includes(role.id_rol) ? '#eff6ff' : 'white',
                                    transition: 'background-color 0.2s'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedRoleIds.includes(role.id_rol)}
                                        onChange={() => toggleRole(role.id_rol)}
                                        style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                    />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: '#1f2937' }}>{role.nombre_rol}</div>
                                        <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{role.descripcion}</div>
                                    </div>
                                    <div>
                                        <span className={`status-pill ${role.estado ? 'status-active' : 'status-inactive'}`}>
                                            {role.estado ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn-secondary">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={loading} className="btn-primary">
                        {loading ? 'Guardando...' : 'Guardar Asignaciones'}
                    </button>
                </div>
            </div>
        </div>
    );
};
