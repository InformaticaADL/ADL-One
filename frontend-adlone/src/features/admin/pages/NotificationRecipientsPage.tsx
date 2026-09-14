import React, { useState, useEffect, useMemo } from 'react';
import {
    Card,
    Typography,
    Select,
    Input,
    Checkbox,
    Button,
    Tag,
    Spin,
    Modal,
    Table,
    Alert,
    Divider,
    Tooltip
} from 'antd';
import {
    IconUserPlus,
    IconUsers,
    IconMail,
    IconBell,
    IconTrash,
    IconSearch,
    IconInfoCircle,
    IconUser,
    IconBriefcase
} from '@tabler/icons-react';
import { notificationService } from '../../../services/notification.service';
import { rbacService } from '../services/rbac.service';
import type { Role, User } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';

const { Text } = Typography;

interface NotificationEvent {
    id_evento: number;
    codigo_evento: string;
    descripcion: string;
    asunto_template: string;
    modulo?: string;
}

interface Recipient {
    id_relacion: number;
    id_usuario?: number;
    id_rol?: number;
    nombre_usuario?: string;
    nombre_rol?: string;
    tipo_envio: string;
    envia_email?: boolean;
    envia_web?: boolean;
    area_destino?: string;
}

interface Props {
    event: NotificationEvent;
    onBack: () => void;
}

export const NotificationRecipientsPage: React.FC<Props> = ({ event, onBack }) => {
    const { showToast } = useToast();
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Catalogs
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    // Selection state
    const [addType, setAddType] = useState<string>('ROLE');
    const [sendType, setSendType] = useState<string>('TO');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    // UNS Rule Configuration
    const [enviaWeb, setEnviaWeb] = useState(false);
    const [enviaEmail, setEnviaEmail] = useState(true);
    const [areaDestino, setAreaDestino] = useState('');

    // Modal state
    const [membersModalOpened, setMembersModalOpened] = useState(false);
    const [modalRoleId, setModalRoleId] = useState<number | null>(null);
    const [modalRoleMembers, setModalRoleMembers] = useState<User[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Confirm modal state
    const [deleteModalOpened, setDeleteModalOpened] = useState(false);
    const [recipientToDelete, setRecipientToDelete] = useState<number | null>(null);

    useEffect(() => {
        loadCatalogs();
        loadRecipients(event.id_evento);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event]);

    // Reset selections when changing type
    useEffect(() => {
        setSelectedItems(new Set());
        setSearchTerm('');
    }, [addType]);

    const loadCatalogs = async () => {
        try {
            const [u, r] = await Promise.all([rbacService.getUsers(), rbacService.getRoles()]);
            setUsers(u);
            setRoles(r);
        } catch (error) {
            console.error(error);
        }
    };

    const loadRecipients = async (eventId: number) => {
        try {
            setLoading(true);
            const data = await notificationService.getRecipients(eventId);
            setRecipients(data);
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar destinatarios" });
        } finally {
            setLoading(false);
        }
    };

    const handleViewRoleMembers = async (roleId: number) => {
        try {
            setModalRoleId(roleId);
            setMembersLoading(true);
            setMembersModalOpened(true);
            const members = await rbacService.getUsersByRole(roleId);
            setModalRoleMembers(members);
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar usuarios del rol" });
            setMembersModalOpened(false);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleToggleItem = (id: number) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedItems(newSet);
    };

    const handleAddSelected = async () => {
        if (selectedItems.size === 0) {
            return showToast({ type: 'error', message: "Seleccione al menos un elemento" });
        }

        try {
            setActionLoading(true);
            const promises = Array.from(selectedItems).map(id => {
                const payload = {
                    idUsuario: addType === 'USER' ? id : undefined,
                    idRol: addType === 'ROLE' ? id : undefined,
                    tipoEnvio: sendType,
                    enviaWeb,
                    enviaEmail,
                    areaDestino
                };
                return notificationService.addRecipient(event.id_evento, payload);
            });

            await Promise.all(promises);
            showToast({ type: 'success', message: `${selectedItems.size} regla(s) configurada(s)` });
            loadRecipients(event.id_evento);
            setSelectedItems(new Set());
        } catch (error: any) {
            const msg = error.response?.data?.message || "Error al agregar";
            showToast({ type: 'error', message: msg });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemove = (id: number) => {
        setRecipientToDelete(id);
        setDeleteModalOpened(true);
    };

    const confirmDelete = async () => {
        if (!recipientToDelete) return;
        try {
            setActionLoading(true);
            await notificationService.removeRecipient(recipientToDelete);
            showToast({ type: 'success', message: "Eliminado correctamente" });
            loadRecipients(event.id_evento);
        } catch (error) {
            showToast({ type: 'error', message: "Error al eliminar" });
        } finally {
            setActionLoading(false);
            setDeleteModalOpened(false);
            setRecipientToDelete(null);
        }
    };

    const filteredItems = useMemo(() => {
        if (addType === 'ROLE') {
            return roles.filter(r => r.nombre_rol.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return users.filter(u =>
            u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.correo_electronico && u.correo_electronico.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [addType, searchTerm, roles, users]);

    const selectedRole = roles.find(r => r.id_rol === modalRoleId);

    const recipientColumns = [
        {
            title: 'Tipo', key: 'tipo',
            render: (_: unknown, rec: Recipient) => (
                <Tag color={rec.id_rol ? 'geekblue' : 'default'} icon={rec.id_rol ? <IconBriefcase size={10} style={{ verticalAlign: 'text-bottom' }} /> : <IconUser size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                    {rec.id_rol ? 'ROL' : 'USR'}
                </Tag>
            ),
        },
        {
            title: 'Destinatario', key: 'destinatario',
            render: (_: unknown, rec: Recipient) => (
                <div>
                    <Text strong style={{ fontSize: 13, display: 'block' }}>{rec.nombre_rol || rec.nombre_usuario}</Text>
                    {rec.area_destino && <Text type="secondary" style={{ fontSize: 12 }}>Área: {rec.area_destino}</Text>}
                </div>
            ),
        },
        {
            title: 'Canales', key: 'canales',
            render: (_: unknown, rec: Recipient) => (
                <div style={{ display: 'flex', gap: 4 }}>
                    {rec.envia_email && (
                        <Tooltip title={`Modo: ${rec.tipo_envio}`}>
                            <Tag color="cyan" icon={<IconMail size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                                {rec.tipo_envio}
                            </Tag>
                        </Tooltip>
                    )}
                    {rec.envia_web && (
                        <Tag color="blue" icon={<IconBell size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                            WEB
                        </Tag>
                    )}
                </div>
            ),
        },
        {
            title: '', key: 'acciones', width: 50,
            render: (_: unknown, rec: Recipient) => (
                <Button type="text" danger size="small" icon={<IconTrash size={16} />} onClick={() => handleRemove(rec.id_relacion)} />
            ),
        },
    ];

    return (
        <div style={{ padding: 16, width: '100%' }}>
            <PageHeader
                title="Configuración de Destinatarios"
                subtitle={`Evento: ${event.codigo_evento} - ${event.descripcion}`}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Notificaciones', onClick: onBack },
                    { label: 'Destinatarios' }
                ]}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, marginTop: 32, alignItems: 'start' }}>
                <Card>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                        <IconUserPlus size={20} color="#1c7ed6" />
                        <Text strong>Agregar Destinatarios</Text>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <Field label="Tipo Destinatario">
                                <Select
                                    value={addType}
                                    onChange={(val) => setAddType(val || 'ROLE')}
                                    options={[
                                        { value: 'ROLE', label: 'Rol (Grupo)' },
                                        { value: 'USER', label: 'Usuario Individual' }
                                    ]}
                                    style={{ width: '100%' }}
                                />
                            </Field>
                            <Field label="Modo de Envío">
                                <Select
                                    value={sendType}
                                    onChange={(val) => setSendType(val || 'TO')}
                                    disabled={!enviaEmail}
                                    options={[
                                        { value: 'TO', label: 'Para (TO)' },
                                        { value: 'CC', label: 'Copia (CC)' },
                                        { value: 'BCC', label: 'Copia Oculta (BCC)' }
                                    ]}
                                    style={{ width: '100%' }}
                                />
                            </Field>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
                            <div>
                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Canales Habilitados</Text>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <Checkbox checked={enviaEmail} onChange={(e) => setEnviaEmail(e.target.checked)}>Email</Checkbox>
                                    <Checkbox checked={enviaWeb} onChange={(e) => setEnviaWeb(e.target.checked)}>Web</Checkbox>
                                </div>
                            </div>
                            <Field label="Área Destino (Opcional)">
                                <Input
                                    placeholder="Ej: Lab, Bioq..."
                                    value={areaDestino}
                                    onChange={(e) => setAreaDestino(e.target.value)}
                                />
                            </Field>
                        </div>

                        {enviaWeb && (
                            <Alert type="info" showIcon icon={<IconInfoCircle size={16} />} message="El sistema generará notificaciones automáticas en la campanita para este evento." />
                        )}

                        <Divider style={{ margin: 0 }}>Selección de elementos</Divider>

                        <Input
                            placeholder={`Buscar ${addType === 'ROLE' ? 'rol' : 'usuario'}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            prefix={<IconSearch size={16} style={{ color: 'var(--app-text-secondary)' }} />}
                        />

                        <Card size="small" styles={{ body: { padding: 8 } }}>
                            <div style={{ height: 300, overflowY: 'auto' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {filteredItems.map(item => {
                                        const id = addType === 'ROLE' ? (item as Role).id_rol : (item as User).id_usuario;
                                        const isSelected = selectedItems.has(id);
                                        const name = addType === 'ROLE' ? (item as Role).nombre_rol : (item as User).nombre_usuario;
                                        const sub = addType === 'USER' ? (item as User).correo_electronico : null;

                                        return (
                                            <div
                                                key={id}
                                                onClick={() => handleToggleItem(id)}
                                                style={{
                                                    display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8, padding: 8,
                                                    cursor: 'pointer',
                                                    borderRadius: 6,
                                                    backgroundColor: isSelected ? 'var(--app-accent-bg)' : 'transparent',
                                                    transition: 'background-color 0.1s ease'
                                                }}
                                            >
                                                <Checkbox checked={isSelected} onChange={() => {}} />
                                                <div style={{ flex: 1 }}>
                                                    <Text strong={isSelected} style={{ fontSize: 13, display: 'block' }}>{name}</Text>
                                                    {sub && <Text type="secondary" style={{ fontSize: 12 }}>{sub}</Text>}
                                                </div>
                                                {addType === 'ROLE' && (
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        icon={<IconUsers size={14} />}
                                                        onClick={(e) => { e.stopPropagation(); handleViewRoleMembers(id); }}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                    {filteredItems.length === 0 && (
                                        <div style={{ padding: '32px 0', textAlign: 'center' }}>
                                            <Text type="secondary" style={{ fontSize: 13 }}>No se encontraron resultados</Text>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Card>

                        <Button
                            onClick={handleAddSelected}
                            loading={actionLoading}
                            disabled={selectedItems.size === 0}
                            block
                            type="primary"
                            icon={<IconUserPlus size={18} />}
                        >
                            Vincular Seleccionados ({selectedItems.size})
                        </Button>
                    </div>
                </Card>

                <Card>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <IconUsers size={20} color="#0c8599" />
                            <Text strong>Destinatarios Configurados</Text>
                        </div>
                        <Tag color="cyan">{recipients.length} reglas</Tag>
                    </div>

                    {loading ? (
                        <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Spin />
                        </div>
                    ) : (
                        <Table
                            rowKey="id_relacion"
                            columns={recipientColumns}
                            dataSource={recipients}
                            pagination={false}
                            size="small"
                            scroll={{ y: 600 }}
                            locale={{
                                emptyText: (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '60px 0' }}>
                                        <IconUsers size={40} color="var(--app-border)" />
                                        <Text type="secondary" style={{ fontSize: 13 }}>Sin destinatarios configurados</Text>
                                    </div>
                                ),
                            }}
                        />
                    )}
                </Card>
            </div>

            {/* Modal: Role Members */}
            <Modal
                open={membersModalOpened}
                onCancel={() => setMembersModalOpened(false)}
                footer={null}
                width={700}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconUsers size={20} />
                        <Text strong>Usuarios del Rol: {selectedRole?.nombre_rol}</Text>
                    </div>
                }
            >
                {membersLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                        <Alert type="info" message={`${modalRoleMembers.length} usuario(s) activo(s) recibirán notificaciones a través de este rol.`} />
                        <Table
                            rowKey="id_usuario"
                            dataSource={modalRoleMembers}
                            pagination={false}
                            size="small"
                            scroll={{ y: 400 }}
                            locale={{ emptyText: 'Este rol no tiene usuarios asignados actualmente.' }}
                            columns={[
                                {
                                    title: 'Usuario', key: 'usuario',
                                    render: (_: unknown, member: User) => (
                                        <div>
                                            <Text strong style={{ fontSize: 13, display: 'block' }}>{member.nombre_usuario}</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{member.nombre_real}</Text>
                                        </div>
                                    ),
                                },
                                { title: 'Correo', key: 'correo', render: (_: unknown, member: User) => <Text style={{ fontSize: 13 }}>{member.correo_electronico || '-'}</Text> },
                            ]}
                        />
                    </div>
                )}
            </Modal>

            {/* Modal: Confirm Delete */}
            <Modal
                open={deleteModalOpened}
                onCancel={() => setDeleteModalOpened(false)}
                footer={null}
                centered
                title="Confirmar eliminación"
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <Text style={{ fontSize: 13 }}>
                        ¿Está seguro que desea eliminar este destinatario? Esta regla de notificación dejará de aplicarse inmediatamente.
                    </Text>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setDeleteModalOpened(false)}>Cancelar</Button>
                        <Button danger type="primary" loading={actionLoading} onClick={confirmDelete}>Eliminar regla</Button>
                    </div>
                </div>
            </Modal>
        </div>
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
