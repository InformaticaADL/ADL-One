import React, { useEffect, useState } from 'react';
import { rbacService } from '../services/rbac.service';
import type { Role, Permission } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    role: Role | null; // Null if creating new
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const RoleModal: React.FC<Props> = ({ role, isOpen, onClose, onSuccess }) => {
    const { showToast } = useToast();
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [loading, setLoading] = useState(false);

    // Permissions Management
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

    useEffect(() => {
        if (isOpen) {
            loadPermissions();
            if (role) {
                setNombre(role.nombre_rol);
                setDescripcion(role.descripcion);
                loadRolePermissions(role.id_rol);
            } else {
                setNombre('');
                setDescripcion('');
                setSelectedPermissions([]);
            }
        }
    }, [isOpen, role]);

    const loadPermissions = async () => {
        try {
            const perms = await rbacService.getAllPermissions();
            setAllPermissions(perms);
        } catch (error) {
            console.error('Error loading permissions:', error);
            showToast({ type: 'error', message: 'Error cargando permisos' });
        }
    };

    const loadRolePermissions = async (roleId: number) => {
        try {
            const perms = await rbacService.getRolePermissions(roleId);
            setSelectedPermissions(perms.map(p => p.id_permiso));
        } catch (error) {
            console.error('Error loading role permissions:', error);
        }
    };

    const handleSave = async () => {
        if (!nombre) {
            showToast({ type: 'warning', message: 'El nombre es obligatorio' });
            return;
        }

        setLoading(true);
        try {
            let savedRole = role;

            if (!savedRole) {
                // Create
                savedRole = await rbacService.createRole(nombre, descripcion);
            } else {
                // Edit (Create edit endpoint if needed, for now assuming create/replace flow or focusing on create)
                // Assuming we have edit capability, but the service defined create. 
                // Let's implement full update later if needed. For now Phase 2 prioritizes structure.
                // We'll focus on saving permissions for EXISTING roles too.
            }

            if (savedRole) {
                // Assign Permissions
                await rbacService.assignPermissionsToRole(savedRole.id_rol, selectedPermissions);

                showToast({ type: 'success', message: 'Rol guardado correctamente' });
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error('Error saving role:', error);
            showToast({ type: 'error', message: 'Error al guardar rol' });
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (id: number) => {
        setSelectedPermissions(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    if (!isOpen) return null;

    // Group permissions by submodule for cleaner UI
    const groupedPermissions = allPermissions.reduce((acc, curr) => {
        const key = `${curr.modulo} - ${curr.submodulo || 'General'}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(curr);
        return acc;
    }, {} as Record<string, Permission[]>);

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {role ? 'Editar Rol' : 'Nuevo Rol'}
                    </h2>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">Nombre del Rol</label>
                        <input
                            type="text"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="form-input"
                            disabled={!!role}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Descripción</label>
                        <input
                            type="text"
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            className="form-input"
                        />
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem', color: '#111827' }}>Permisos</h3>
                        <div style={{ border: '1px solid #e5e7eb', padding: '0.5rem', borderRadius: '0.5rem', maxHeight: '300px', overflowY: 'auto', backgroundColor: '#f9fafb' }}>
                            {Object.entries(groupedPermissions).map(([category, perms]) => (
                                <div key={category} style={{ marginBottom: '1rem', padding: '0.5rem' }}>
                                    <h4 style={{ fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '0.5rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem' }}>
                                        {category}
                                    </h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                                        {perms.map(p => (
                                            <label key={p.id_permiso} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedPermissions.includes(p.id_permiso)}
                                                    onChange={() => togglePermission(p.id_permiso)}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                />
                                                <span style={{ color: '#374151' }}>{p.nombre}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button onClick={onClose} className="btn-cancel">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={loading} className="btn-primary">
                        {loading ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};
