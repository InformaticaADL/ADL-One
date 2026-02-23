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

    // UI States for Scalability
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

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


    const toggleSelectAllCategory = (_category: string, perms: Permission[]) => {
        const allIds = perms.map(p => p.id_permiso);
        const allSelected = allIds.every(id => selectedPermissions.includes(id));

        if (allSelected) {
            // Deselect all
            setSelectedPermissions(prev => prev.filter(id => !allIds.includes(id)));
        } else {
            // Select all
            setSelectedPermissions(prev => {
                const newIds = allIds.filter(id => !prev.includes(id));
                return [...prev, ...newIds];
            });
        }
    };

    // Filter permissions based on search
    const filteredPermissions = allPermissions.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.modulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.submodulo && p.submodulo.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // UI Helper: Group permissions hierarchically (Module -> Submodule -> Permissions)
    const hierarchicalPermissions = React.useMemo(() => {
        const groups: Record<string, Record<string, Permission[]>> = {};

        filteredPermissions.forEach(p => {
            const mod = p.modulo || 'Otros';
            const sub = p.submodulo || 'General';

            if (!groups[mod]) groups[mod] = {};
            if (!groups[mod][sub]) groups[mod][sub] = [];

            groups[mod][sub].push(p);
        });

        return groups;
    }, [filteredPermissions]);

    // UI Helper: Find generic access permission for a module
    const getModuleAccessPermissionId = (moduleName: string): number | undefined => {
        // Naive strategy: Look for permission with submodulo 'General' and type 'VISTA' or Access
        // Or simply the first one in 'General'.
        const generalPerms = allPermissions.filter(p => p.modulo === moduleName && (p.submodulo === 'General' || !p.submodulo));
        // Prioritize one that says "ACCESO" or "VER"
        const accessPerm = generalPerms.find(p => p.codigo.endsWith('_ACCESO') || p.codigo.endsWith('_VER')) || generalPerms[0];
        return accessPerm?.id_permiso;
    };

    const togglePermission = (id: number, moduleName?: string) => {
        setSelectedPermissions(prev => {
            const isSelecting = !prev.includes(id);
            let newSelection = [...prev];

            if (isSelecting) {
                newSelection.push(id);
                // Auto-select Module Access if exists
                if (moduleName) {
                    const parentId = getModuleAccessPermissionId(moduleName);
                    // Don't auto-select if we are toggling the parent itself (already handled)
                    if (parentId && parentId !== id && !newSelection.includes(parentId)) {
                        newSelection.push(parentId);
                        showToast({ type: 'info', message: 'Se activó automáticamente el acceso al módulo.' });
                    }
                }
            } else {
                newSelection = newSelection.filter(p => p !== id);

                // CASCADING VALIDATION: If removing Module Access, remove ALL module permissions
                if (moduleName) {
                    const parentId = getModuleAccessPermissionId(moduleName);
                    if (parentId === id) {
                        // We are actively deselecting the Parent Access
                        // Find all permissions for this module to remove them
                        const modulePerms = allPermissions
                            .filter(p => p.modulo === moduleName)
                            .map(p => p.id_permiso);

                        // Remove all of them from selection
                        newSelection = newSelection.filter(selId => !modulePerms.includes(selId));

                        showToast({ type: 'warning', message: 'Se desactivaron todas las funcionalidades dependientes del módulo.' });
                    }
                }
            }
            return newSelection;
        });
    };

    const toggleModuleGroup = (moduleName: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [moduleName]: !prev[moduleName]
        }));
    };

    // Auto-expand categories if searching
    useEffect(() => {
        if (searchTerm) {
            const newExpanded: Record<string, boolean> = {};
            Object.keys(hierarchicalPermissions).forEach(key => {
                newExpanded[key] = true;
            });
            setExpandedCategories(newExpanded);
        }
    }, [searchTerm, hierarchicalPermissions]); // Dependency on search term match

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '900px', width: '90%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {role ? 'Editar Rol' : 'Nuevo Rol'}
                    </h2>
                </div>

                <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
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

                    <div style={{ marginTop: '2rem' }}>
                        <h3 style={{ fontWeight: 600, marginBottom: '1rem', fontSize: '1.1rem', color: '#111827', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>
                            Permisos del Sistema
                        </h3>

                        {/* Search Bar */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="🔍 Buscar permisos por nombre, módulo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="form-input"
                                    style={{ padding: '0.6rem 1rem', paddingLeft: '2.5rem' }}
                                />
                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>

                                </span>
                            </div>
                        </div>

                        <div className="permissions-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {Object.entries(hierarchicalPermissions).length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', background: '#f9fafb', borderRadius: '0.5rem' }}>
                                    No se encontraron permisos.
                                </div>
                            ) : (
                                Object.entries(hierarchicalPermissions).map(([moduleName, submodules]) => {
                                    const isExpanded = expandedCategories[moduleName] || !!searchTerm;

                                    // Calculate module stats
                                    const modulePerms = Object.values(submodules).flat();
                                    const selectedCount = modulePerms.filter(p => selectedPermissions.includes(p.id_permiso)).length;
                                    const totalCount = modulePerms.length;
                                    const isFullSelection = selectedCount === totalCount && totalCount > 0;

                                    return (
                                        <div key={moduleName} style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                            {/* MODULE HEADER */}
                                            <div
                                                style={{
                                                    padding: '1rem',
                                                    background: '#f8fafc',
                                                    borderBottom: isExpanded ? '1px solid #e5e7eb' : 'none',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    cursor: 'pointer'
                                                }}
                                                onClick={() => toggleModuleGroup(moduleName)}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                    <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>
                                                        ▶
                                                    </span>
                                                    <div>
                                                        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{moduleName}</h4>
                                                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                                            {selectedCount} de {totalCount} permisos activos
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Mini Progress Bar */}
                                                <div style={{ width: '100px', height: '6px', background: '#e2e8f0', borderRadius: '3px', marginLeft: 'auto', marginRight: '1rem' }}>
                                                    <div style={{ width: `${(selectedCount / totalCount) * 100}%`, height: '100%', background: isFullSelection ? '#10b981' : '#3b82f6', borderRadius: '3px', transition: 'width 0.3s' }}></div>
                                                </div>
                                            </div>

                                            {/* MODULE CONTENT (SUBMODULES) */}
                                            {isExpanded && (
                                                <div style={{ padding: '1.5rem', background: '#ffffff' }}>
                                                    {Object.entries(submodules).map(([submoduleName, perms]) => (
                                                        <div key={submoduleName} style={{ marginBottom: '1.5rem' }}>
                                                            <h5 style={{
                                                                fontSize: '0.85rem',
                                                                fontWeight: 600,
                                                                color: '#475569',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                                marginBottom: '0.75rem',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                borderBottom: '1px solid #f1f5f9',
                                                                paddingBottom: '0.25rem'
                                                            }}>
                                                                {submoduleName}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleSelectAllCategory(submoduleName, perms)}
                                                                    style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'none' }}
                                                                >
                                                                    {perms.every(p => selectedPermissions.includes(p.id_permiso)) ? 'Deseleccionar grupo' : 'Seleccionar grupo'}
                                                                </button>
                                                            </h5>

                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                                                                {perms.map(p => (
                                                                    <label
                                                                        key={p.id_permiso}
                                                                        className="permission-card"
                                                                        style={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '0.75rem',
                                                                            padding: '0.75rem',
                                                                            border: selectedPermissions.includes(p.id_permiso) ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
                                                                            borderRadius: '0.5rem',
                                                                            cursor: 'pointer',
                                                                            background: selectedPermissions.includes(p.id_permiso) ? '#eff6ff' : 'white',
                                                                            transition: 'all 0.2s'
                                                                        }}
                                                                    >
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={selectedPermissions.includes(p.id_permiso)}
                                                                            onChange={() => togglePermission(p.id_permiso, moduleName)}
                                                                            style={{ width: '1.1rem', height: '1.1rem' }}
                                                                        />
                                                                        <div style={{ lineHeight: 1.2 }}>
                                                                            <span style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, color: '#334155' }}>{p.nombre}</span>
                                                                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.1rem' }}>{p.codigo}</span>
                                                                        </div>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 1.5rem', background: '#f8fafc' }}>
                    <button onClick={onClose} className="btn-cancel">
                        Cancelar
                    </button>
                    <button onClick={handleSave} disabled={loading} className="btn-primary" style={{ minWidth: '120px' }}>
                        {loading ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                </div>
            </div>
        </div>
    );
};
