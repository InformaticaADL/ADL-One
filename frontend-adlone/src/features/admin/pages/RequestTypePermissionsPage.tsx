import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Typography,
    Button,
    Table,
    Checkbox,
    Tag,
    Spin,
    Select,
    Tooltip,
    Avatar,
    Input,
    Card
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconUsers,
    IconUser,
    IconShield,
    IconDeviceFloppy,
    IconPlus,
    IconX,
    IconEye,
    IconUserCheck,
    IconGitBranch,
    IconChevronDown,
    IconChevronUp,
    IconAlertTriangle,
    IconInfoCircle,
    IconSettings
} from '@tabler/icons-react';

import { ursService } from '../../../services/urs.service';
import { rbacService } from '../services/rbac.service';
import type { Role, User as UserType } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Text } = Typography;

interface RequestType {
    id_tipo: number;
    nombre: string;
    area_destino: string;
    modulo_destino?: string | null;
    estado: boolean;
}

type AccessType = 'ENVIO' | 'VISTA' | 'GESTION' | 'DERIVACION' | 'DESTINO_DERIVACION';

interface PermissionEntry {
    type: 'role' | 'user';
    id: number;
    name: string;
    ENVIO: boolean;
    VISTA: boolean;
    GESTION: boolean;
    DERIVACION: boolean;
    DESTINO_DERIVACION: boolean;
    isNew?: boolean;
    membersLoaded?: boolean;
    members?: string[];
}

const ACCESS_LABELS: { key: AccessType; label: string; icon: React.ReactNode }[] = [
    { key: 'ENVIO',     label: 'Crear',   icon: <IconPlus size={14} /> },
    { key: 'VISTA',     label: 'Solo Ver', icon: <IconEye size={14} /> },
    { key: 'GESTION',   label: 'Accionar', icon: <IconUserCheck size={14} /> },
    { key: 'DERIVACION',label: 'Derivar',  icon: <IconGitBranch size={14} /> },
    { key: 'DESTINO_DERIVACION', label: 'Recibir Derivación', icon: <IconUser size={14} /> },
];

interface Props {
    requestType: RequestType;
    onBack: () => void;
}

const RequestTypePermissionsPage: React.FC<Props> = ({ requestType, onBack }) => {
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const isCompact = useMediaQuery('(max-width: 1200px)');

    const [entries, setEntries] = useState<PermissionEntry[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [users, setUsers] = useState<UserType[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Header edit states
    const [typeName, setTypeName] = useState(requestType.nombre);
    const [areaDestino, setAreaDestino] = useState(requestType.area_destino);
    const [moduloDestino, setModuloDestino] = useState(requestType.modulo_destino || '');
    const [isEditingHeader, setIsEditingHeader] = useState(false);

    // Expanded row state
    const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
    const [loadingMembersIdx, setLoadingMembersIdx] = useState<number | null>(null);

    // User→roles map
    const [userRolesMap, setUserRolesMap] = useState<Map<number, number[]>>(new Map());

    const load = useCallback(async () => {
        try {
            setLoading(true);
            const [perms, allRoles, allUsers] = await Promise.all([
                ursService.getPermissions(requestType.id_tipo),
                rbacService.getRoles(),
                rbacService.getUsers(),
            ]);

            setRoles(allRoles);
            setUsers(allUsers);

            const map = new Map<string, PermissionEntry>();
            perms.forEach((p: any) => {
                let key: string;
                if (p.id_rol) {
                    key = `role_${p.id_rol}`;
                    if (!map.has(key)) map.set(key, { type: 'role', id: p.id_rol, name: p.nombre_rol || `Rol ${p.id_rol}`, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false, DESTINO_DERIVACION: false });
                } else if (p.id_usuario) {
                    key = `user_${p.id_usuario}`;
                    if (!map.has(key)) map.set(key, { type: 'user', id: p.id_usuario, name: p.nombre_real || p.nombre_usuario || `Usuario ${p.id_usuario}`, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false, DESTINO_DERIVACION: false });
                } else return;
                map.get(key)![p.tipo_acceso as AccessType] = true;
            });

            setEntries(Array.from(map.values()));
        } catch {
            showToast({ type: 'error', message: 'Error al cargar permisos' });
        } finally {
            setLoading(false);
        }
    }, [requestType.id_tipo, showToast]);

    useEffect(() => { load(); }, [load]);

    const rolesInList = useMemo(() => new Set(entries.filter(e => e.type === 'role').map(e => e.id)), [entries]);

    const userOverlapsWithRole = (userId: number): boolean => {
        const userRoles = userRolesMap.get(userId) || [];
        return userRoles.some(rId => rolesInList.has(rId));
    };

    const toggleCell = (idx: number, access: AccessType) =>
        setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [access]: !e[access] } : e));

    const removeEntry = (idx: number) => {
        setEntries(prev => prev.filter((_, i) => i !== idx));
        if (expandedIdx === idx) setExpandedIdx(null);
    };

    const loadMembers = async (idx: number, entry: PermissionEntry) => {
        if (expandedIdx === idx) {
            setExpandedIdx(null);
            return;
        }
        if (entry.membersLoaded) {
            setExpandedIdx(idx);
            return;
        }
        try {
            setLoadingMembersIdx(idx);
            let memberNames: string[] = [];
            if (entry.type === 'role') {
                const roleUsers = await rbacService.getUsersByRole(entry.id);
                memberNames = roleUsers.map(u => u.nombre_real || u.nombre_usuario);
            } else {
                const userRoles = await rbacService.getUserRoles(entry.id);
                memberNames = userRoles.map(r => r.nombre_rol);
                setUserRolesMap(prev => new Map(prev).set(entry.id, userRoles.map(r => r.id_rol)));
            }
            setEntries(prev => prev.map((e, i) => i === idx ? { ...e, membersLoaded: true, members: memberNames } : e));
            setExpandedIdx(idx);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar detalles de la entidad' });
        } finally {
            setLoadingMembersIdx(null);
        }
    };

    const addEntry = async (type: 'role' | 'user', idValue: string | null) => {
        if (!idValue) return;
        const id = parseInt(idValue);
        const item = type === 'role'
            ? roles.find(r => r.id_rol === id)
            : users.find(u => u.id_usuario === id);

        if (!item) return;

        const name = type === 'role' ? (item as Role).nombre_rol : ((item as UserType).nombre_real || (item as UserType).nombre_usuario);
        const key = `${type}_${id}`;

        if (entries.some(e => `${e.type}_${e.id}` === key)) {
            showToast({ type: 'warning', message: 'Esta entidad ya está en la lista.' });
            return;
        }

        const newEntry: PermissionEntry = { type, id, name, ENVIO: false, VISTA: false, GESTION: false, DERIVACION: false, DESTINO_DERIVACION: false, isNew: true };
        setEntries(prev => [...prev, newEntry]);

        if (type === 'user') {
            try {
                const userRoles = await rbacService.getUserRoles(id);
                setUserRolesMap(prev => new Map(prev).set(id, userRoles.map(r => r.id_rol)));
                setEntries(prev => prev.map(e =>
                    e.type === 'user' && e.id === id
                        ? { ...e, membersLoaded: true, members: userRoles.map(r => r.nombre_rol) }
                        : e
                ));
            } catch { /* silent */ }
        }
    };

    const save = async () => {
        try {
            setSaving(true);

            // 1. Update Basic Info if changed
            if (typeName !== requestType.nombre || areaDestino !== requestType.area_destino) {
                await ursService.createUpdateType(requestType.id_tipo, {
                    nombre: typeName,
                    area_destino: areaDestino,
                    modulo_destino: moduloDestino || null,
                    estado: requestType.estado
                    // formulario_config and workflow_config remain the same as they are not edited here
                });
            }

            // 2. Update Permissions
            const currentPerms = await ursService.getPermissions(requestType.id_tipo);
            const toAdd: any[] = [];
            const toDeleteIds: number[] = [];

            entries.forEach(entry => {
                (['ENVIO', 'VISTA', 'GESTION', 'DERIVACION', 'DESTINO_DERIVACION'] as AccessType[]).forEach(access => {
                    const existing = currentPerms.find((p: any) =>
                        entry.type === 'role' ? p.id_rol === entry.id && p.tipo_acceso === access
                                               : p.id_usuario === entry.id && p.tipo_acceso === access
                    );
                    if (entry[access] && !existing) toAdd.push({ ...(entry.type === 'role' ? { id_rol: entry.id } : { id_usuario: entry.id }), tipo_acceso: access });
                    else if (!entry[access] && existing) toDeleteIds.push(existing.id_permiso_sol);
                });
            });

            currentPerms.forEach((p: any) => {
                const key = p.id_rol ? `role_${p.id_rol}` : `user_${p.id_usuario}`;
                if (!entries.some(e => `${e.type}_${e.id}` === key) && !toDeleteIds.includes(p.id_permiso_sol)) {
                    toDeleteIds.push(p.id_permiso_sol);
                }
            });

            await Promise.allSettled([
                ...toAdd.map(item => ursService.addPermission(requestType.id_tipo, item)),
                ...toDeleteIds.map(id => ursService.removePermission(id)),
            ]);
            showToast({ type: 'success', message: '¡Cambios guardados correctamente!' });
            setIsEditingHeader(false);
            load();
        } catch {
            showToast({ type: 'error', message: 'Error al guardar los cambios' });
        } finally {
            setSaving(false);
        }
    };

    const rolesOptions = roles
        .filter(r => !entries.some(e => e.type === 'role' && e.id === r.id_rol))
        .map(r => ({ value: r.id_rol.toString(), label: r.nombre_rol }));

    const usersOptions = users
        .filter(u => !entries.some(e => e.type === 'user' && e.id === u.id_usuario))
        .map(u => {
            const hasOver = userOverlapsWithRole(u.id_usuario);
            return {
                value: u.id_usuario.toString(),
                label: (u.nombre_real || u.nombre_usuario) + (hasOver ? ' (⚠️ Rol ya activo)' : '')
            };
        });

    const entityCols = [
        {
            title: (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--app-text-secondary)' }}>
                    <IconShield size={14} />
                    <Text type="secondary" strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>Entidad</Text>
                </div>
            ),
            key: 'entidad',
            render: (_: unknown, entry: PermissionEntry, idx: number) => {
                const isExpanded = expandedIdx === idx;
                const isLoadingThis = loadingMembersIdx === idx;
                const hasOverlap = entry.type === 'user' && userOverlapsWithRole(entry.id);
                return (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'nowrap' }}>
                        <Avatar shape="square" style={{ borderRadius: 8, backgroundColor: entry.type === 'role' ? 'var(--app-accent-bg)' : 'rgba(12,133,153,0.12)', color: entry.type === 'role' ? '#0062a8' : '#0c8599' }}>
                            {entry.type === 'role' ? <IconUsers size={16} /> : <IconUser size={16} />}
                        </Avatar>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' }}>
                                <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</Text>
                                {entry.isNew && <Tag color="gold">NUEVO</Tag>}
                                {hasOverlap && (
                                    <Tooltip title="Este usuario ya está cubierto por un rol activo">
                                        <Tag color="orange" icon={<IconAlertTriangle size={10} style={{ verticalAlign: 'text-bottom' }} />}>Rol Activo</Tag>
                                    </Tooltip>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                                <Text type="secondary" strong style={{ fontSize: 10 }}>{entry.type === 'role' ? '👥 ROL' : '👤 USUARIO'}</Text>
                                <Button
                                    type="text"
                                    size="small"
                                    icon={isLoadingThis ? <Spin size="small" /> : isExpanded ? <IconChevronUp size={10} /> : <IconChevronDown size={10} />}
                                    onClick={() => loadMembers(idx, entry)}
                                    style={{ fontSize: 10, height: 'auto', padding: '2px 6px' }}
                                >
                                    {entry.type === 'role' ? 'Usuarios' : 'Roles'}
                                </Button>
                            </div>
                        </div>
                    </div>
                );
            },
        },
        ...ACCESS_LABELS.map(a => ({
            title: (
                <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, color: 'var(--app-text-secondary)' }}>
                    <div style={{ display: 'flex' }}>{a.icon}</div>
                    <Text type="secondary" strong style={{ fontSize: 10, textTransform: 'uppercase', textAlign: 'center' }}>{a.label}</Text>
                </div>
            ),
            key: a.key,
            width: 115,
            align: 'center' as const,
            render: (_: unknown, entry: PermissionEntry, idx: number) => (
                <Checkbox checked={entry[a.key]} onChange={() => toggleCell(idx, a.key)} />
            ),
        })),
        {
            title: '', key: 'acciones', width: 60, align: 'center' as const,
            render: (_: unknown, _entry: PermissionEntry, idx: number) => (
                <Button type="text" danger size="small" icon={<IconX size={16} />} onClick={() => removeEntry(idx)} />
            ),
        },
    ];

    const renderMembers = (entry: PermissionEntry) => (
        <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
            <Text type="secondary" strong style={{ fontSize: 10, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                {entry.type === 'role' ? 'Usuarios asignados a este rol' : 'Roles que posee el usuario'}
            </Text>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {entry.members && entry.members.length > 0 ? entry.members.map((m, i) => (
                    <Tag key={i} color={entry.type === 'role' ? 'blue' : 'cyan'} icon={entry.type === 'role' ? <IconUser size={10} style={{ verticalAlign: 'text-bottom' }} /> : <IconUsers size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                        {m}
                    </Tag>
                )) : (
                    <Text type="secondary" italic style={{ fontSize: 12 }}>No se encontraron datos asociados.</Text>
                )}
            </div>
        </Card>
    );

    return (
        <div style={{ padding: 16, width: '100%' }}>
            <PageHeader
                title={`Permisos: ${typeName}`}
                subtitle={`Define quién puede crear, ver, gestionar o derivar el trámite "${typeName}".`}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Solicitudes URS', onClick: onBack },
                    { label: 'Configuración de Permisos' }
                ]}
                rightSection={
                    <Button
                        type="primary"
                        icon={saving ? <Spin size="small" style={{ color: 'white' }} /> : <IconDeviceFloppy size={16} />}
                        onClick={save}
                        disabled={saving}
                    >
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </Button>
                }
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
                {/* Header Section / Basic Info Edit */}
                <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                    {isEditingHeader ? (
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <Field label="Nombre del Trámite" style={{ flex: 2 }}>
                                <Input
                                    placeholder="Ej: Solicitud de Vacaciones"
                                    value={typeName}
                                    onChange={(e) => setTypeName(e.target.value)}
                                />
                            </Field>
                            <Field label="Área Responsable" style={{ flex: 1 }}>
                                <Input
                                    placeholder="Ej: Recursos Humanos"
                                    value={areaDestino}
                                    onChange={(e) => setAreaDestino(e.target.value)}
                                />
                            </Field>
                            <Field label="Módulo UI (Filtro)" style={{ flex: 1 }}>
                                <Input
                                    placeholder="Ej: EQUIPOS"
                                    value={moduloDestino}
                                    onChange={(e) => setModuloDestino(e.target.value)}
                                />
                            </Field>
                            <Button danger type="text" icon={<IconX size={18} />} onClick={() => setIsEditingHeader(false)} />
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                <Text strong style={{ fontSize: 13 }}>Información Básica del Trámite</Text>
                                <Tooltip title="Editar nombre y área">
                                    <Button type="text" size="small" icon={<IconSettings size={14} />} onClick={() => setIsEditingHeader(true)} />
                                </Tooltip>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 16 }}>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Nombre del Trámite</Text>
                                    <Text strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{typeName}</Text>
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Área Destino / Responsable</Text>
                                    <Tag color="blue" style={{ display: 'block', textAlign: 'center', marginTop: 2 }}>{areaDestino}</Tag>
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Estado actual</Text>
                                    <Tag color={requestType.estado ? 'green' : 'red'} style={{ display: 'block', textAlign: 'center', marginTop: 2 }}>
                                        {requestType.estado ? 'ACTIVO' : 'INACTIVO'}
                                    </Tag>
                                </div>
                                <div>
                                    <Text type="secondary" style={{ fontSize: 12 }}>Módulo Destino</Text>
                                    <Tag style={{ display: 'block', textAlign: 'center', marginTop: 2 }}>
                                        {moduloDestino || 'NINGUNO'}
                                    </Tag>
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {loading ? (
                    <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <Card size="small" style={{ overflow: 'hidden', backgroundColor: 'transparent', border: isCompact ? 'none' : undefined }} styles={{ body: { padding: isCompact ? 0 : undefined } }}>
                        {!isCompact ? (
                            <Table
                                rowKey={(entry) => `${entry.type}_${entry.id}`}
                                columns={entityCols}
                                dataSource={entries}
                                pagination={false}
                                size="small"
                                scroll={{ x: 900 }}
                                expandable={{
                                    expandedRowRender: renderMembers,
                                    expandedRowKeys: expandedIdx !== null ? [`${entries[expandedIdx]?.type}_${entries[expandedIdx]?.id}`] : [],
                                    showExpandColumn: false,
                                }}
                                locale={{
                                    emptyText: (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '60px 0' }}>
                                            <IconUsers size={40} style={{ opacity: 0.2 }} />
                                            <Text strong style={{ fontSize: 13 }}>Sin entidades configuradas</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>Usa los selectores de abajo para añadir roles o usuarios.</Text>
                                        </div>
                                    ),
                                }}
                            />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                {entries.length === 0 ? (
                                    <Card style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                            <IconUsers size={40} style={{ opacity: 0.2 }} />
                                            <Text strong style={{ fontSize: 13 }}>Sin entidades configuradas</Text>
                                            <Text type="secondary" style={{ fontSize: 12, textAlign: 'center' }}>Usa los selectores de abajo para añadir roles o usuarios.</Text>
                                        </div>
                                    </Card>
                                ) : (
                                    entries.map((entry, idx) => {
                                        const isExpanded = expandedIdx === idx;
                                        const isLoadingThis = loadingMembersIdx === idx;
                                        const hasOverlap = entry.type === 'user' && userOverlapsWithRole(entry.id);

                                        return (
                                            <Card key={`${entry.type}_${entry.id}`} size="small">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'nowrap', marginBottom: 16 }}>
                                                    <div style={{ display: 'flex', gap: 12, flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
                                                        <Avatar shape="square" size={40} style={{ borderRadius: 8, backgroundColor: entry.type === 'role' ? 'var(--app-accent-bg)' : 'rgba(12,133,153,0.12)', color: entry.type === 'role' ? '#0062a8' : '#0c8599' }}>
                                                            {entry.type === 'role' ? <IconUsers size={20} /> : <IconUser size={20} />}
                                                        </Avatar>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <Text strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{entry.name}</Text>
                                                            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                                                                <Tag color={entry.type === 'role' ? 'blue' : 'cyan'}>{entry.type === 'role' ? 'ROL' : 'USUARIO'}</Tag>
                                                                {entry.isNew && <Tag color="gold">NUEVO</Tag>}
                                                                {hasOverlap && <Tag color="orange" icon={<IconAlertTriangle size={10} style={{ verticalAlign: 'text-bottom' }} />}>Rol Activo</Tag>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button type="text" danger icon={<IconX size={18} />} onClick={() => removeEntry(idx)} />
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                                    {ACCESS_LABELS.map(a => (
                                                        <div
                                                            key={a.key}
                                                            onClick={() => toggleCell(idx, a.key)}
                                                            style={{
                                                                padding: 8, borderRadius: 8, cursor: 'pointer',
                                                                border: `1px solid ${entry[a.key] ? '#4dabf7' : 'var(--app-border)'}`,
                                                                backgroundColor: entry[a.key] ? 'var(--app-accent-bg)' : 'var(--app-hover-bg)',
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'center' }}>
                                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                    <div style={{ color: entry[a.key] ? '#1c7ed6' : 'var(--app-text-secondary)', display: 'flex' }}>{a.icon}</div>
                                                                    <Text style={{ fontSize: 11, fontWeight: 600, color: entry[a.key] ? '#1864ab' : 'var(--app-text-secondary)' }}>{a.label}</Text>
                                                                </div>
                                                                <Checkbox checked={entry[a.key]} onChange={() => toggleCell(idx, a.key)} onClick={(e) => e.stopPropagation()} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                <Button
                                                    block
                                                    size="small"
                                                    style={{ marginTop: 16 }}
                                                    icon={isLoadingThis ? <Spin size="small" /> : isExpanded ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                                                    onClick={() => loadMembers(idx, entry)}
                                                >
                                                    {entry.type === 'role' ? 'Ver Usuarios del Rol' : 'Ver Roles del Usuario'}
                                                </Button>

                                                {isExpanded && (
                                                    <div style={{ marginTop: 8 }}>
                                                        {renderMembers(entry)}
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        )}

                        {/* Footer Adder */}
                        <div style={{ padding: 16, backgroundColor: isCompact ? 'transparent' : 'var(--app-hover-bg)', marginTop: isCompact ? 24 : 0, borderTop: isCompact ? 'none' : '1px solid var(--app-border)' }}>
                            <div style={{ display: 'flex', gap: 16, flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'flex-start' }}>
                                <Select
                                    placeholder="Añadir Rol..."
                                    showSearch
                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                    options={rolesOptions}
                                    notFoundContent="No se encontraron roles"
                                    suffixIcon={<IconUsers size={14} color="#228be6" />}
                                    value={null}
                                    onChange={(val) => addEntry('role', val)}
                                    style={{ flex: isMobile ? '1 1 100%' : 1 }}
                                />
                                <Select
                                    placeholder="Añadir Usuario..."
                                    showSearch
                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                    options={usersOptions}
                                    notFoundContent="No se encontraron usuarios"
                                    suffixIcon={<IconUser size={14} color="#12b886" />}
                                    value={null}
                                    onChange={(val) => addEntry('user', val)}
                                    style={{ flex: isMobile ? '1 1 100%' : 1 }}
                                />
                                <div style={{ flex: isMobile ? '1 1 100%' : 2 }}>
                                    <div style={{ display: 'flex', gap: 8, marginTop: isMobile ? 0 : 5, justifyContent: isMobile ? 'center' : 'flex-start', alignItems: 'center' }}>
                                        <IconInfoCircle size={14} color="#94a3b8" />
                                        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, textAlign: isMobile ? 'center' : 'left' }}>
                                            Los <strong>roles</strong> gestionan permisos de grupos. Los <strong>usuarios</strong> definen excepciones.
                                        </Text>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

function Field({ label, style, children }: { label: string; style?: React.CSSProperties; children: React.ReactNode }) {
    return (
        <div style={style}>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}

export default RequestTypePermissionsPage;
