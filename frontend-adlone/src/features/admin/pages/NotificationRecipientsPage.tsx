import React, { useState, useEffect } from 'react';
import { notificationService } from '../../../services/notification.service';
import { rbacService } from '../services/rbac.service';
import type { Role, User } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import '../admin.css';

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
}

interface Props {
    event: NotificationEvent;
    onBack: () => void;
}

export const NotificationRecipientsPage: React.FC<Props> = ({ event, onBack }) => {
    const { showToast } = useToast();
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(false);

    // Catalogs
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    // Selection state
    const [addType, setAddType] = useState<'USER' | 'ROLE'>('ROLE');
    const [sendType, setSendType] = useState('TO');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    // Modal state
    const [showRoleMembersModal, setShowRoleMembersModal] = useState(false);
    const [modalRoleId, setModalRoleId] = useState<number | null>(null);
    const [modalRoleMembers, setModalRoleMembers] = useState<User[]>([]);

    // Confirm modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [recipientToDelete, setRecipientToDelete] = useState<number | null>(null);

    useEffect(() => {
        loadCatalogs();
        loadRecipients(event.id_evento);
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
            const members = await rbacService.getUsersByRole(roleId);
            setModalRoleMembers(members);
            setShowRoleMembersModal(true);
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar usuarios del rol" });
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
            setLoading(true);
            const promises = Array.from(selectedItems).map(id => {
                const payload = {
                    idUsuario: addType === 'USER' ? id : undefined,
                    idRol: addType === 'ROLE' ? id : undefined,
                    tipoEnvio: sendType
                };
                return notificationService.addRecipient(event.id_evento, payload);
            });

            await Promise.all(promises);
            showToast({ type: 'success', message: `${selectedItems.size} destinatario(s) agregado(s)` });
            loadRecipients(event.id_evento);
            setSelectedItems(new Set());
        } catch (error: any) {
            const msg = error.response?.data?.message || "Error al agregar";
            showToast({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (id: number) => {
        setRecipientToDelete(id);
        setShowConfirmModal(true);
    };

    const confirmDelete = async () => {
        if (!recipientToDelete) return;
        try {
            await notificationService.removeRecipient(recipientToDelete);
            showToast({ type: 'success', message: "Eliminado correctamente" });
            loadRecipients(event.id_evento);
        } catch (error) {
            showToast({ type: 'error', message: "Error al eliminar" });
        } finally {
            setShowConfirmModal(false);
            setRecipientToDelete(null);
        }
    };

    // Filter items based on search
    const filteredItems = addType === 'ROLE'
        ? roles.filter(r => r.nombre_rol.toLowerCase().includes(searchTerm.toLowerCase()))
        : users.filter(u =>
            u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.correo_electronico && u.correo_electronico.toLowerCase().includes(searchTerm.toLowerCase()))
        );

    const selectedRole = roles.find(r => r.id_rol === modalRoleId);

    return (
        <div className="admin-container">
            <div className="admin-header-section">
                <button onClick={onBack} className="btn-back">
                    <span className="icon-circle">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="19" y1="12" x2="5" y2="12"></line>
                            <polyline points="12 19 5 12 12 5"></polyline>
                        </svg>
                    </span>
                    Volver a Eventos
                </button>
                <h1 className="admin-title">Configuración de Correos - Paso 2</h1>
                <p className="admin-subtitle">
                    Configurando: <span style={{ color: '#3b82f6', fontWeight: 600 }}>{event.codigo_evento}</span> - {event.descripcion}
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
                {/* Left: Add Recipients */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>
                        ➕ Agregar Destinatarios
                    </h3>

                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Tipo</label>
                            <select
                                value={addType}
                                onChange={(e) => setAddType(e.target.value as 'USER' | 'ROLE')}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                            >
                                <option value="ROLE">Rol (Grupo)</option>
                                <option value="USER">Usuario Específico</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>Envío</label>
                            <select
                                value={sendType}
                                onChange={(e) => setSendType(e.target.value)}
                                style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
                            >
                                <option value="TO">Para (TO)</option>
                                <option value="CC">Copia (CC)</option>
                                <option value="BCC">Oculta (BCC)</option>
                            </select>
                        </div>
                    </div>

                    {/* Search */}
                    <input
                        type="text"
                        placeholder={`Buscar ${addType === 'ROLE' ? 'rol' : 'usuario'}...`}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            fontSize: '0.85rem',
                            marginBottom: '0.75rem'
                        }}
                    />

                    {/* Checkbox List */}
                    <div style={{
                        maxHeight: '400px',
                        overflowY: 'auto',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        backgroundColor: 'white',
                        marginBottom: '1rem'
                    }}>
                        {filteredItems.length === 0 ? (
                            <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
                                No se encontraron resultados
                            </div>
                        ) : (
                            filteredItems.map(item => {
                                const id = addType === 'ROLE' ? (item as Role).id_rol : (item as User).id_usuario;
                                const isUser = addType === 'USER';
                                const user = isUser ? (item as User) : null;
                                const role = !isUser ? (item as Role) : null;

                                return (
                                    <div
                                        key={id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '10px 12px',
                                            borderBottom: '1px solid #f3f4f6',
                                            cursor: 'pointer',
                                            backgroundColor: selectedItems.has(id) ? '#eff6ff' : 'white',
                                            transition: 'background-color 0.15s'
                                        }}
                                        onClick={() => handleToggleItem(id)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.has(id)}
                                            onChange={() => { }}
                                            style={{ marginRight: '10px', cursor: 'pointer' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: '0.85rem', color: '#1f2937', fontWeight: 500 }}>
                                                {isUser ? user!.nombre_usuario : role!.nombre_rol}
                                            </div>
                                            {isUser && user!.correo_electronico && (
                                                <div style={{ fontSize: '0.7rem', color: '#3b82f6', marginTop: '2px' }}>
                                                    📧 {user!.correo_electronico}
                                                </div>
                                            )}
                                        </div>
                                        {!isUser && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewRoleMembers(id);
                                                }}
                                                style={{
                                                    padding: '4px 8px',
                                                    fontSize: '0.7rem',
                                                    backgroundColor: '#e0e7ff',
                                                    color: '#3730a3',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontWeight: 600
                                                }}
                                                title="Ver usuarios"
                                            >
                                                👥 Ver
                                            </button>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={handleAddSelected}
                        disabled={loading || selectedItems.size === 0}
                        style={{
                            width: '100%',
                            backgroundColor: selectedItems.size > 0 ? '#3b82f6' : '#9ca3af',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '12px',
                            cursor: selectedItems.size > 0 ? 'pointer' : 'not-allowed',
                            fontWeight: 600,
                            fontSize: '0.9rem'
                        }}
                    >
                        Agregar Seleccionados ({selectedItems.size})
                    </button>
                </div>

                {/* Right: Current Recipients */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '1rem' }}>
                        📋 Destinatarios Configurados ({recipients.length})
                    </h3>

                    <div style={{ overflowY: 'auto', maxHeight: '600px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: 'white', zIndex: 1 }}>
                                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                                    <th style={{ padding: '8px', fontWeight: 600 }}>Tipo</th>
                                    <th style={{ padding: '8px', fontWeight: 600 }}>Nombre</th>
                                    <th style={{ padding: '8px', fontWeight: 600 }}>Modo</th>
                                    <th style={{ padding: '8px', width: '50px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recipients.map(rec => (
                                    <tr key={rec.id_relacion} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '10px 8px' }}>
                                            {rec.id_rol ? (
                                                <span style={{ backgroundColor: '#e0e7ff', color: '#3730a3', padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 600 }}>ROL</span>
                                            ) : (
                                                <span style={{ backgroundColor: '#f3f4f6', color: '#374151', padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 600 }}>USUARIO</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '10px 8px', color: '#1f2937', fontWeight: 500 }}>
                                            {rec.nombre_rol || rec.nombre_usuario || '-'}
                                        </td>
                                        <td style={{ padding: '10px 8px' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.75rem', color: rec.tipo_envio === 'TO' ? '#059669' : '#d97706' }}>
                                                {rec.tipo_envio}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                                            <button
                                                onClick={() => handleRemove(rec.id_relacion)}
                                                style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                                                title="Eliminar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {recipients.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                                            No hay destinatarios configurados para este evento
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal: Role Members */}
            {showRoleMembersModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }} onClick={() => setShowRoleMembersModal(false)}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        maxWidth: '600px',
                        width: '90%',
                        maxHeight: '80vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#111827' }}>
                                👥 Usuarios del Rol: <span style={{ color: '#3b82f6' }}>{selectedRole?.nombre_rol}</span>
                            </h3>
                            <button
                                onClick={() => setShowRoleMembersModal(false)}
                                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}
                            >
                                ×
                            </button>
                        </div>

                        {modalRoleMembers.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                                <p>⚠️ Este rol no tiene usuarios asignados</p>
                            </div>
                        ) : (
                            <div>
                                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
                                    {modalRoleMembers.length} usuario(s) activo(s) recibirán el correo:
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {modalRoleMembers.map(member => (
                                        <div key={member.id_usuario} style={{
                                            padding: '12px',
                                            backgroundColor: '#f9fafb',
                                            borderRadius: '8px',
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#1f2937' }}>
                                                        {member.nombre_usuario}
                                                    </div>
                                                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>
                                                        {member.nombre_real}
                                                    </div>
                                                </div>
                                            </div>
                                            {member.correo_electronico && (
                                                <div style={{
                                                    fontSize: '0.8rem',
                                                    color: '#3b82f6',
                                                    marginTop: '8px',
                                                    paddingTop: '8px',
                                                    borderTop: '1px solid #e5e7eb',
                                                    fontWeight: 500
                                                }}>
                                                    📧 {member.correo_electronico}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                title="Eliminar Destinatario"
                message="¿Está seguro que desea eliminar este destinatario? Esta acción no se puede deshacer."
                confirmText="Eliminar"
                cancelText="Cancelar"
                confirmColor="#ef4444"
                onConfirm={confirmDelete}
                onCancel={() => {
                    setShowConfirmModal(false);
                    setRecipientToDelete(null);
                }}
            />
        </div>
    );
};
