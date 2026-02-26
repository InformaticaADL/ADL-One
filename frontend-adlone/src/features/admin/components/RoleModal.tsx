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

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('GENERAL_INFO');
    const [expandedSubmodules, setExpandedSubmodules] = useState<Record<string, boolean>>({});

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
        setSelectedPermissions(prev => {
            const isSelecting = !prev.includes(id);
            if (isSelecting) {
                return [...prev, id];
            } else {
                return prev.filter(p => p !== id);
            }
        });
    };

    const toggleSelectAllCategory = (perms: Permission[]) => {
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

    // Header structure
    const hierarchicalPermissions = React.useMemo(() => {
        const groups: Record<string, Record<string, Permission[]>> = {};

        filteredPermissions.forEach(p => {
            let mod = p.modulo || 'Otros';
            let sub = p.submodulo || 'General';

            // FORCE MA_A_REPORTES and related permissions to 'Medio Ambiente' category exclusively as per user request
            if (['MA_A_REPORTES', 'MA_A_REPORTES_DETALLE', 'MA_A_REPORTES_REVISION'].includes(p.codigo)) {
                mod = 'Medio Ambiente';
                sub = 'Reportes';
            }

            if (!groups[mod]) groups[mod] = {};
            if (!groups[mod][sub]) groups[mod][sub] = [];

            // Add if not already present
            if (!groups[mod][sub].some(existing => existing.id_permiso === p.id_permiso)) {
                groups[mod][sub].push(p);
            }
        });

        return groups;
    }, [filteredPermissions]);

    const toggleSubmoduleGroup = (moduleName: string, submoduleName: string) => {
        const key = `${moduleName}:${submoduleName}`;
        setExpandedSubmodules(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Auto-expand submodules if searching
    useEffect(() => {
        if (searchTerm) {
            const newExpanded: Record<string, boolean> = {};
            Object.entries(hierarchicalPermissions).forEach(([mod, submods]) => {
                Object.keys(submods).forEach(sub => {
                    newExpanded[`${mod}:${sub}`] = true;
                });
            });
            setExpandedSubmodules(newExpanded);
        }
    }, [searchTerm, hierarchicalPermissions]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay role-modal-premium">
            <div className="modal-content" style={{ maxWidth: '800px', width: '92%', height: '88vh', display: 'flex', flexDirection: 'column' }}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        <span style={{ fontSize: '2.4rem' }}>🛡️</span>
                        {role ? 'Editar Rol' : 'Configurar Nuevo Rol'}
                    </h2>
                    <p style={{ margin: '0', opacity: 0.7, fontSize: '0.85rem', fontWeight: 500 }}>
                        {role ? `Ajustando privilegios para: ${role.nombre_rol}` : 'Define las capacidades y alcances de este nuevo rol.'}
                    </p>
                </div>

                <div className="modal-body">
                    <div className="modal-layout-premium">
                        {/* Sidebar Navigation / Mobile Accordion Container */}
                        <div className="sidebar-premium">
                            <div className="sidebar-header-premium">
                                <div className="search-wrapper-premium">
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="search-input-premium"
                                    />
                                    <span className="search-icon-premium">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3">
                                            <circle cx="11" cy="11" r="8" />
                                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                        </svg>
                                    </span>
                                </div>
                            </div>

                            <div className="sidebar-items-premium">
                                {/* Informacion General - Desktop Sidebar Button */}
                                <div className="desktop-only-section">
                                    <button
                                        onClick={() => setActiveCategory('GENERAL_INFO')}
                                        className={`sidebar-item-premium ${activeCategory === 'GENERAL_INFO' ? 'active' : ''}`}
                                    >
                                        <span className="sidebar-icon-premium">📝</span>
                                        <span>Información General</span>
                                    </button>
                                </div>

                                {/* Mobile Only: Static General Info Form */}
                                <div className="mobile-only-general-info">
                                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Nombre del Rol *</label>
                                        <input
                                            type="text"
                                            value={nombre}
                                            onChange={(e) => setNombre(e.target.value)}
                                            className="form-input"
                                            style={{ background: '#ffffff', padding: '0.7rem 0.9rem' }}
                                            placeholder="Ej: Administrador Tier 1"
                                            disabled={!!role}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.7rem' }}>Descripción</label>
                                        <textarea
                                            value={descripcion}
                                            onChange={(e) => setDescripcion(e.target.value)}
                                            className="form-input"
                                            style={{ background: '#ffffff', minHeight: '80px', padding: '0.7rem 0.9rem' }}
                                            placeholder="Describa las responsabilidades..."
                                        />
                                    </div>
                                </div>

                                <div className="desktop-only-divider" style={{ height: '1px', background: '#f1f5f9', margin: '0.5rem 1.5rem' }}></div>

                                {Object.entries(hierarchicalPermissions).map(([moduleName, submodules]) => {
                                    const modulePerms = Object.values(submodules).flat();
                                    const selectedCount = modulePerms.filter(p => selectedPermissions.includes(p.id_permiso)).length;
                                    const totalCount = modulePerms.length;

                                    const getModuleIcon = (name: string) => {
                                        const lower = name.toLowerCase();
                                        if (lower.includes('gem')) return '🧬';
                                        if (lower.includes('necropsía') || lower.includes('necropsia')) return '🐟';
                                        if (lower.includes('microscopía') || lower.includes('microscopia')) return '🔬';
                                        if (lower.includes('biología molecular')) return '🧪';
                                        if (lower.includes('cultivo celular')) return '🧫';
                                        if (lower.includes('bacteriología') || lower.includes('bacteriologia')) return '🦠';
                                        if (lower.includes('screening')) return '🔍';
                                        if (lower.includes('derivaciones')) return '📤';
                                        if (lower.includes('medio ambiente')) return '🍃';
                                        if (lower.includes('atl')) return '⚖️';
                                        if (lower.includes('i+d')) return '💡';
                                        if (lower.includes('pve')) return '🩺';
                                        if (lower.includes('informática') || lower.includes('informatica')) return '💻';
                                        if (lower.includes('comercial')) return '📈';
                                        if (lower.includes('calidad')) return '⭐';
                                        if (lower.includes('administración') || lower.includes('administracion')) return '🏢';
                                        if (lower.includes('general')) return '🌐';
                                        return '📦';
                                    };

                                    return (
                                        <div key={moduleName} className="mobile-accordion-section">
                                            <button
                                                onClick={() => setActiveCategory(prev => prev === moduleName ? '' : moduleName)}
                                                className={`sidebar-item-premium ${activeCategory === moduleName ? 'active' : ''}`}
                                            >
                                                <span className="sidebar-icon-premium">{getModuleIcon(moduleName)}</span>
                                                <span style={{ flex: 1 }}>{moduleName}</span>
                                                <span className="sidebar-badge-premium">
                                                    {selectedCount}/{totalCount}
                                                </span>
                                            </button>

                                            {/* Mobile Only: Content inside accordion */}
                                            <div className={`mobile-permissions-container ${activeCategory === moduleName ? 'expanded' : ''}`}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>PERMISOS</span>
                                                    <button
                                                        type="button"
                                                        className="btn-select-group-premium"
                                                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                                        onClick={() => toggleSelectAllCategory(modulePerms)}
                                                    >
                                                        {modulePerms.every(p => selectedPermissions.includes(p.id_permiso)) ? 'Desmarcar' : 'Marcar'} Todo
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                    {Object.entries(submodules)
                                                        .sort(([a], [b]) => {
                                                            const isAGeneral = a.toLowerCase().includes('general');
                                                            const isBGeneral = b.toLowerCase().includes('general');
                                                            if (isAGeneral && !isBGeneral) return -1;
                                                            if (!isAGeneral && isBGeneral) return 1;
                                                            return a.localeCompare(b);
                                                        })
                                                        .map(([subName, perms]) => (
                                                            <div key={subName}>
                                                                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', marginBottom: '0.5rem', textTransform: 'uppercase' }}>{subName}</div>
                                                                <div className="permissions-grid-premium">
                                                                    {perms.map(p => (
                                                                        <div
                                                                            key={p.id_permiso}
                                                                            className={`permission-item-premium ${selectedPermissions.includes(p.id_permiso) ? 'selected' : ''}`}
                                                                            onClick={() => togglePermission(p.id_permiso)}
                                                                        >
                                                                            <div className="checkbox-custom-premium">
                                                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                                                                    <polyline points="20 6 9 17 4 12" />
                                                                                </svg>
                                                                            </div>
                                                                            <div className="permission-text-content">
                                                                                <span className="permission-name-premium">{p.nombre}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Main Content Area (Desktop Only) */}
                        <div className="permissions-panel-premium">
                            {activeCategory === 'GENERAL_INFO' ? (
                                <div style={{ maxWidth: '600px' }}>
                                    <h3 style={{ marginBottom: '2rem', color: '#1e293b', fontWeight: 800 }}>Información del Rol</h3>
                                    <div className="form-group" style={{ alignItems: 'flex-start' }}>
                                        <label className="form-label" style={{ textAlign: 'left' }}>Nombre del Rol *</label>
                                        <input
                                            type="text"
                                            value={nombre}
                                            onChange={(e) => setNombre(e.target.value)}
                                            className="form-input"
                                            style={{ textAlign: 'left', maxWidth: '100%', background: '#f8fafc' }}
                                            placeholder="Ej: Administrador Tier 1"
                                            disabled={!!role}
                                        />
                                    </div>

                                    <div className="form-group" style={{ alignItems: 'flex-start', marginTop: '1.5rem' }}>
                                        <label className="form-label" style={{ textAlign: 'left' }}>Descripción</label>
                                        <textarea
                                            value={descripcion}
                                            onChange={(e) => setDescripcion(e.target.value)}
                                            className="form-input"
                                            style={{ textAlign: 'left', maxWidth: '100%', minHeight: '120px', resize: 'vertical', background: '#f8fafc' }}
                                            placeholder="Describa las responsabilidades..."
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="permissions-panel-header-premium">
                                        <div>
                                            <h3 style={{ margin: 0, color: '#1e293b', fontWeight: 800 }}>{activeCategory}</h3>
                                            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                                                Gestión de permisos para el módulo seleccionado.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-select-group-premium"
                                            onClick={() => {
                                                const perms = Object.values(hierarchicalPermissions[activeCategory] || {}).flat();
                                                toggleSelectAllCategory(perms);
                                            }}
                                        >
                                            {Object.values(hierarchicalPermissions[activeCategory] || {}).flat().every(p => selectedPermissions.includes(p.id_permiso)) ? 'Desmarcar' : 'Marcar'} Todo
                                        </button>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                        {Object.entries(hierarchicalPermissions[activeCategory] || {})
                                            .sort(([a], [b]) => {
                                                const isAGeneral = a.toLowerCase().includes('general');
                                                const isBGeneral = b.toLowerCase().includes('general');
                                                if (isAGeneral && !isBGeneral) return -1;
                                                if (!isAGeneral && isBGeneral) return 1;
                                                return a.localeCompare(b);
                                            })
                                            .map(([submoduleName, perms]) => {
                                                const subId = `${activeCategory}:${submoduleName}`;
                                                const isSubExpanded = expandedSubmodules[subId] !== false;

                                                return (
                                                    <div key={submoduleName} className={`submodule-section-premium ${isSubExpanded ? 'expanded' : ''}`}>
                                                        <div
                                                            className="submodule-header-premium"
                                                            onClick={() => toggleSubmoduleGroup(activeCategory, submoduleName)}
                                                        >
                                                            <div className="submodule-title-premium">
                                                                <span className="submodule-chevron">
                                                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                        <polyline points="9 18 15 12 9 6" />
                                                                    </svg>
                                                                </span>
                                                                {submoduleName}
                                                            </div>
                                                        </div>

                                                        {isSubExpanded && (
                                                            <div className="permissions-grid-premium" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                                                                {perms.map(p => (
                                                                    <div
                                                                        key={p.id_permiso}
                                                                        className={`permission-item-premium ${selectedPermissions.includes(p.id_permiso) ? 'selected' : ''}`}
                                                                        onClick={() => togglePermission(p.id_permiso)}
                                                                    >
                                                                        <div className="checkbox-custom-premium">
                                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                                                                                <polyline points="20 6 9 17 4 12" />
                                                                            </svg>
                                                                        </div>
                                                                        <div className="permission-text-content">
                                                                            <span className="permission-name-premium">{p.nombre}</span>
                                                                            <span className="permission-code-premium">{p.codigo}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="modal-footer-premium">
                    <button onClick={onClose} className="btn-premium-cancel">
                        Descartar
                    </button>
                    <button onClick={handleSave} disabled={loading} className="btn-premium-save">
                        {loading ? 'Guardando...' : (role ? 'Actualizar Cambios' : 'Confirmar y Guardar')}
                    </button>
                </div>
            </div>
        </div>
    );
};
