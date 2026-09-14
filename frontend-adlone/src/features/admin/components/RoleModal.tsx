import React, { useEffect, useState, useMemo } from 'react';
import {
    Modal,
    Input,
    Typography,
    Button,
    Checkbox,
    Divider,
    Tag,
    Select
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconSearch,
    IconShield,
    IconInfoCircle,
    IconChevronRight,
    IconChevronDown,
    IconCheck,
    IconWorld,
    IconBuildingHospital,
    IconMicroscope,
    IconFlask,
    IconSettings,
    IconChartBar,
    IconLeaf
} from '@tabler/icons-react';
import { rbacService } from '../services/rbac.service';
import type { Role, Permission } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/common/ConfirmModal';

const { Text, Title } = Typography;

interface Props {
    role: Role | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const RoleModal: React.FC<Props> = ({ role, isOpen, onClose, onSuccess }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [nombre, setNombre] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
    const [affectedCount, setAffectedCount] = useState<number | null>(null);

    // Permissions Management
    const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);

    // UI States
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<string>('GENERAL');
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const doSave = async () => {
        setConfirmSaveOpen(false);
        setLoading(true);
        try {
            let savedRole = role;

            if (!savedRole) {
                savedRole = await rbacService.createRole(nombre.trim(), descripcion);
            } else {
                await rbacService.updateRole(savedRole.id_rol, nombre.trim(), descripcion);
            }

            if (savedRole) {
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

    const handleSave = async () => {
        if (!nombre.trim()) {
            showToast({ type: 'warning', message: 'El nombre es obligatorio' });
            return;
        }

        // New role: no users yet, save directly
        if (!role) {
            doSave();
            return;
        }

        // Existing role: check how many users will be affected
        try {
            const users = await rbacService.getUsersByRole(role.id_rol);
            if (users.length === 0) {
                doSave();
            } else {
                setAffectedCount(users.length);
                setConfirmSaveOpen(true);
            }
        } catch {
            // If fetch fails, proceed without warning
            doSave();
        }
    };

    const togglePermission = (id: number) => {
        setSelectedPermissions(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const toggleSelectAllCategory = (perms: Permission[]) => {
        const allIds = perms.map(p => p.id_permiso);
        const allSelected = allIds.every(id => selectedPermissions.includes(id));

        if (allSelected) {
            setSelectedPermissions(prev => prev.filter(id => !allIds.includes(id)));
        } else {
            setSelectedPermissions(prev => {
                const newIds = allIds.filter(id => !prev.includes(id));
                return [...prev, ...newIds];
            });
        }
    };

    const filteredPermissions = allPermissions.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.modulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.submodulo && p.submodulo.toLowerCase().includes(searchTerm.toLowerCase())) ||
        p.codigo.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const hierarchicalPermissions = useMemo(() => {
        const groups: Record<string, Record<string, Permission[]>> = {};

        filteredPermissions.forEach(p => {
            let mod = p.modulo || 'Otros';
            const sub = p.submodulo || 'General';

            // Normalización básica para asegurar que los nombres coincidan con las pestañas
            const modUpper = mod.toUpperCase().trim();

            if (modUpper.includes('ADMIN')) mod = 'Admin. Información';
            else if (modUpper.includes('CALIDAD')) mod = 'Gestión de Calidad';
            else if (modUpper.includes('MEDIO AMBIENTE')) mod = 'Medio Ambiente';
            else if (modUpper.includes('LABORATORY')) mod = 'Laboratory';
            else if (modUpper.includes('MICROSCOP')) mod = 'Microscopía';
            else if (modUpper.includes('OTROS')) mod = 'Otros';

            if (!groups[mod]) groups[mod] = {};
            if (!groups[mod][sub]) groups[mod][sub] = [];
            groups[mod][sub].push(p);
        });

        return groups;
    }, [filteredPermissions]);

    const moduleIcons: Record<string, React.ReactNode> = {
        'Informática': <IconSettings size={16} />,
        'General': <IconWorld size={16} />,
        'Medio Ambiente': <IconLeaf size={16} />,
        'Admin. Info': <IconBuildingHospital size={16} />,
        'Gestión de Calidad': <IconChartBar size={16} />,
        'Laboratory': <IconFlask size={16} />,
        'Microscopía': <IconMicroscope size={16} />,
        'Otros': <IconInfoCircle size={16} />
    };

    const getModuleIcon = (name: string) => {
        const found = Object.keys(moduleIcons).find(key => name.toLowerCase().includes(key.toLowerCase()));
        return found ? moduleIcons[found] : <IconShield size={16} />;
    };

    const toggleSubmodule = (mod: string, sub: string) => {
        const key = `${mod}:${sub}`;
        setExpandedSubmodules(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const renderPermissionCard = (p: Permission) => {
        const selected = selectedPermissions.includes(p.id_permiso);
        return (
            <div
                key={p.id_permiso}
                onClick={() => togglePermission(p.id_permiso)}
                style={{
                    border: `1px solid ${selected ? '#4dabf7' : 'var(--app-border)'}`,
                    borderRadius: 6,
                    padding: 8,
                    backgroundColor: selected ? 'var(--app-accent-bg)' : 'var(--app-bg-elevated)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                }}
            >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <Checkbox checked={selected} onChange={() => {}} style={{ marginTop: 3 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{p.nombre}</Text>
                        <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>{p.codigo}</Text>
                    </div>
                </div>
            </div>
        );
    };

    const generalPanel = (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: isMobile ? 120 : 0 }}>
                <div>
                    <Title level={4} style={{ marginBottom: 16 }}>Información del Rol</Title>
                    <Text type="secondary" style={{ fontSize: 13, display: 'block', marginBottom: 24 }}>
                        Introduce el nombre y una descripción clara para que otros administradores sepan qué permite hacer este rol.
                    </Text>
                </div>

                <Field label="Nombre del Rol *">
                    <Input
                        placeholder="Ej: Administrador Maestro"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                    />
                </Field>
                <Field label="Descripción">
                    <Input
                        placeholder="Describe el alcance de este rol..."
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
                    />
                </Field>

                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16, backgroundColor: 'var(--app-hover-bg)', marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <IconShield color="#1c7ed6" />
                        <div>
                            <Text strong style={{ fontSize: 13, display: 'block' }}>Resumen de Permisos</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Este rol tiene actualmente <Text strong style={{ color: '#1c7ed6', fontSize: 12 }}>{selectedPermissions.length}</Text> permisos otorgados de un total de {allPermissions.length}.
                            </Text>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderModulePanel = (moduleName: string, submodules: Record<string, Permission[]>) => {
        const allModulePerms = Object.values(submodules).flat();
        const allSelectedInModule = allModulePerms.every(p => selectedPermissions.includes(p.id_permiso));

        return (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: isMobile ? 120 : 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div>
                            <Title level={3} style={{ margin: 0 }}>{moduleName}</Title>
                            <Text type="secondary" style={{ fontSize: 13 }}>Administra los accesos específicos para este módulo.</Text>
                        </div>
                        <Button
                            type="text"
                            size="small"
                            block={isMobile}
                            onClick={() => toggleSelectAllCategory(allModulePerms)}
                        >
                            {allSelectedInModule ? 'Desmarcar' : 'Marcar Todo'}
                        </Button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {moduleName === 'Medio Ambiente' ? (
                            <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                <div
                                    style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                                    onClick={() => {
                                        const allSubKeys = Object.keys(submodules).map(s => `${moduleName}:${s}`);
                                        const someClosed = allSubKeys.some(k => expandedSubmodules[k] === false);
                                        const newState: Record<string, boolean> = {};
                                        allSubKeys.forEach(k => newState[k] = someClosed);
                                        setExpandedSubmodules(prev => ({ ...prev, ...newState }));
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <IconChevronDown size={14} />
                                        <Text strong style={{ fontSize: 13, textTransform: 'uppercase' }}>MEDIOAMBIENTE</Text>
                                        <Tag>{Object.values(submodules).reduce((acc, curr) => acc + curr.length, 0)} permisos</Tag>
                                    </div>
                                    <Checkbox
                                        checked={allSelectedInModule}
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={() => toggleSelectAllCategory(allModulePerms)}
                                    >
                                        Marcar Todo Gestión
                                    </Checkbox>
                                </div>

                                <div style={{ marginTop: 16 }}>
                                    {Object.entries(submodules).map(([subName, perms], idx) => (
                                        <div key={subName} style={{ marginTop: idx > 0 ? 24 : 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                <Text strong style={{ fontSize: 11, color: '#1864ab' }}>{subName}</Text>
                                                <Tag>{perms.length}</Tag>
                                                <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                                                {perms.map(p => renderPermissionCard(p))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            Object.entries(submodules).map(([subName, perms]) => {
                                const subId = `${moduleName}:${subName}`;
                                const isExpanded = expandedSubmodules[subId] !== false;
                                const allSubSelected = perms.every(p => selectedPermissions.includes(p.id_permiso));

                                return (
                                    <div key={subName} style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 16 }}>
                                        <div
                                            style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                                            onClick={() => toggleSubmodule(moduleName, subName)}
                                        >
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                                <Text strong style={{ fontSize: 13, textTransform: 'uppercase' }}>{subName}</Text>
                                                <Tag>{perms.length} permisos</Tag>
                                            </div>
                                            <Checkbox
                                                checked={allSubSelected}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => toggleSelectAllCategory(perms)}
                                            >
                                                Marcar Submódulo
                                            </Checkbox>
                                        </div>

                                        {isExpanded && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
                                                {perms.map(p => renderPermissionCard(p))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={isMobile ? '100%' : '85%'}
            style={isMobile ? { top: 0, maxWidth: '100vw', margin: 0 } : undefined}
            styles={{ body: { padding: 0 } }}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconShield size={22} color="#1677ff" />
                    <div>
                        <Text strong style={{ display: 'block' }}>{role ? 'Configurar Rol / Permisos' : 'Crear Nuevo Rol de Acceso'}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{role ? `Editando: ${role.nombre_rol}` : 'Define capacidades del sistema'}</Text>
                    </div>
                </div>
            }
        >
            <div style={{ height: isMobile ? 'calc(100dvh - 240px)' : '75vh', display: 'flex', overflow: 'hidden', flexDirection: isMobile ? 'column' : 'row', borderTop: '1px solid var(--app-border)' }}>
                {isMobile ? (
                    <>
                        <div style={{ padding: 16, backgroundColor: 'var(--app-hover-bg)', borderBottom: '1px solid var(--app-border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Button
                                    type={activeTab === 'GENERAL' ? 'primary' : 'default'}
                                    icon={<IconInfoCircle size={16} />}
                                    onClick={() => setActiveTab('GENERAL')}
                                    block
                                >
                                    Info. General
                                </Button>

                                <Input
                                    placeholder="Buscar permisos..."
                                    prefix={<IconSearch size={14} style={{ color: 'var(--app-text-secondary)' }} />}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />

                                <Select
                                    placeholder="Seleccionar módulo..."
                                    options={Object.keys(hierarchicalPermissions).map(mod => ({ value: mod, label: mod }))}
                                    value={activeTab === 'GENERAL' ? undefined : activeTab}
                                    onChange={(val) => val && setActiveTab(val)}
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                            {activeTab === 'GENERAL' ? generalPanel : (
                                hierarchicalPermissions[activeTab] ? renderModulePanel(activeTab, hierarchicalPermissions[activeTab]) : generalPanel
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <div style={{ width: 280, borderRight: '1px solid var(--app-border)', backgroundColor: 'var(--app-hover-bg)', padding: 12, display: 'flex', flexDirection: 'column' }}>
                            <Input
                                placeholder="Buscar permisos..."
                                prefix={<IconSearch size={14} style={{ color: 'var(--app-text-secondary)' }} />}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ marginBottom: 16 }}
                            />

                            <button
                                onClick={() => setActiveTab('GENERAL')}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                                    border: 'none', cursor: 'pointer', fontWeight: 600, textAlign: 'left',
                                    backgroundColor: activeTab === 'GENERAL' ? '#1677ff' : 'transparent',
                                    color: activeTab === 'GENERAL' ? '#fff' : 'var(--app-text)',
                                }}
                            >
                                <IconInfoCircle size={16} />
                                Info. General
                            </button>

                            <Divider style={{ margin: '12px 0' }}>Módulos</Divider>

                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {Object.entries(hierarchicalPermissions).map(([moduleName, submods]) => {
                                        const modulePerms = Object.values(submods).flat();
                                        const selectedInModule = modulePerms.filter(p => selectedPermissions.includes(p.id_permiso)).length;
                                        const isActive = activeTab === moduleName;

                                        return (
                                            <button
                                                key={moduleName}
                                                onClick={() => setActiveTab(moduleName)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8,
                                                    border: 'none', cursor: 'pointer', fontWeight: 600, textAlign: 'left',
                                                    backgroundColor: isActive ? '#1677ff' : 'transparent',
                                                    color: isActive ? '#fff' : 'var(--app-text)',
                                                }}
                                            >
                                                {getModuleIcon(moduleName)}
                                                <Text style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? '#fff' : undefined }}>{moduleName}</Text>
                                                {selectedInModule > 0 && (
                                                    <Tag color={isActive ? undefined : 'blue'} style={{ marginInlineEnd: 0 }}>{selectedInModule}</Tag>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                            {activeTab === 'GENERAL' ? generalPanel : (
                                hierarchicalPermissions[activeTab] ? renderModulePanel(activeTab, hierarchicalPermissions[activeTab]) : generalPanel
                            )}
                        </div>
                    </>
                )}
            </div>

            <Divider style={{ margin: 0 }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 24, paddingBottom: isMobile ? 60 : 24, backgroundColor: 'var(--app-hover-bg)' }}>
                <Button onClick={onClose} block={isMobile}>
                    Cancelar / Descartar
                </Button>
                <Button
                    type="primary"
                    loading={loading}
                    onClick={handleSave}
                    icon={<IconCheck size={18} />}
                    block={isMobile}
                >
                    Guardar Cambios
                </Button>
            </div>

            <ConfirmModal
                isOpen={confirmSaveOpen}
                title="Guardar Cambios de Permisos"
                message={`${affectedCount} usuario${affectedCount !== 1 ? 's' : ''} ${affectedCount !== 1 ? 'tienen' : 'tiene'} este rol asignado y ${affectedCount !== 1 ? 'serán desconectados' : 'será desconectado'} para aplicar los nuevos permisos. ¿Confirmas?`}
                confirmText="Sí, guardar"
                cancelText="Cancelar"
                confirmColor="#1c7ed6"
                onConfirm={doSave}
                onCancel={() => { setConfirmSaveOpen(false); setAffectedCount(null); }}
            />
        </Modal>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}
