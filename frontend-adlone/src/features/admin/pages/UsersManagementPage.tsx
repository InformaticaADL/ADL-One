import React, { useState, useEffect } from 'react';
import { rbacService, type User, type CreateUserData, type UpdateUserData, type Role } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import '../admin.css';

interface Props {
    onBack?: () => void;
}

export const UsersManagementPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('active');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    // Form states
    const [formData, setFormData] = useState<CreateUserData>({
        nombre_usuario: '',
        nombre_real: '',
        correo_electronico: '',
        clave_usuario: ''
    });
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [roleSearchTerm, setRoleSearchTerm] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        loadUsers();
        loadRoles();
    }, []);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const data = await rbacService.getAllUsersWithStatus();
            setUsers(data);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar usuarios' });
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        try {
            const data = await rbacService.getRoles();
            setRoles(data);
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    };

    const handleCreateUser = async () => {
        if (!formData.nombre_usuario || !formData.nombre_real || !formData.clave_usuario) {
            return showToast({ type: 'error', message: 'Complete los campos requeridos' });
        }

        try {
            setLoading(true);
            const newUser = await rbacService.createUser(formData);

            // Assign roles if any selected
            if (selectedRoles.length > 0) {
                await rbacService.assignRolesToUser(newUser.id_usuario, selectedRoles);
            }

            showToast({ type: 'success', message: 'Usuario creado exitosamente' });
            setShowCreateModal(false);
            resetForm();
            loadUsers();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al crear usuario' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async () => {
        if (!selectedUser) return;

        const updateData: UpdateUserData = {
            nombre_usuario: formData.nombre_usuario,
            nombre_real: formData.nombre_real,
            correo_electronico: formData.correo_electronico
        };

        try {
            setLoading(true);
            await rbacService.updateUser(selectedUser.id_usuario, updateData);

            // Update roles
            await rbacService.assignRolesToUser(selectedUser.id_usuario, selectedRoles);

            showToast({ type: 'success', message: 'Usuario actualizado exitosamente' });
            setShowEditModal(false);
            resetForm();
            loadUsers();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al actualizar usuario' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async () => {
        if (!selectedUser) return;
        if (!newPassword || newPassword !== confirmPassword) {
            return showToast({ type: 'error', message: 'Las contraseñas no coinciden' });
        }

        try {
            setLoading(true);
            await rbacService.updateUserPassword(selectedUser.id_usuario, newPassword);
            showToast({ type: 'success', message: 'Contraseña actualizada exitosamente' });
            setShowPasswordModal(false);
            setNewPassword('');
            setConfirmPassword('');
            setSelectedUser(null);
        } catch (error) {
            showToast({ type: 'error', message: 'Error al actualizar contraseña' });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedUser) return;

        const newStatus = selectedUser.habilitado !== 'S';

        try {
            setLoading(true);
            await rbacService.toggleUserStatus(selectedUser.id_usuario, newStatus);
            showToast({
                type: 'success',
                message: `Usuario ${newStatus ? 'habilitado' : 'deshabilitado'} exitosamente`
            });
            setShowConfirmModal(false);
            setSelectedUser(null);
            loadUsers();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cambiar estado del usuario' });
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        resetForm();
        setSelectedRoles([]);
        setShowCreateModal(true);
    };

    const openEditModal = async (user: User) => {
        setSelectedUser(user);
        setFormData({
            nombre_usuario: user.nombre_usuario,
            nombre_real: user.nombre_real,
            correo_electronico: user.correo_electronico || '',
            clave_usuario: ''
        });

        // Load user's current roles
        try {
            const userRoles = await rbacService.getUserRoles(user.id_usuario);
            setSelectedRoles(userRoles.map(r => r.id_rol));
        } catch (error) {
            console.error('Error loading user roles:', error);
            setSelectedRoles([]);
        }

        setShowEditModal(true);
    };

    const openPasswordModal = (user: User) => {
        setSelectedUser(user);
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordModal(true);
    };

    const openConfirmModal = (user: User) => {
        setSelectedUser(user);
        setShowConfirmModal(true);
    };

    const resetForm = () => {
        setFormData({
            nombre_usuario: '',
            nombre_real: '',
            correo_electronico: '',
            clave_usuario: ''
        });
        setSelectedRoles([]);
        setSelectedUser(null);
    };

    const toggleRole = (roleId: number) => {
        setSelectedRoles(prev =>
            prev.includes(roleId)
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    // Filter users
    const filteredUsers = users.filter(user => {
        const matchesSearch =
            user.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (user.correo_electronico && user.correo_electronico.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus =
            filterStatus === 'all' ||
            (filterStatus === 'active' && user.habilitado === 'S') ||
            (filterStatus === 'inactive' && user.habilitado === 'N');

        return matchesSearch && matchesStatus;
    });

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
                    <h1 className="admin-title">Gestión de Usuarios</h1>
                    <p className="admin-subtitle">Crear, editar y administrar usuarios del sistema</p>
                </div>

                {/* Derecha: Vacío para balance */}
                <div style={{ justifySelf: 'end' }}></div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '1400px', margin: '0 auto' }}>
                {/* Filters and Actions */}
                <div className="filter-card" style={{ marginBottom: '2rem' }}>
                    <div className="filter-controls-left">
                        <div className="search-container" style={{ width: '100%', maxWidth: '400px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0 1rem' }}>
                            <span className="search-icon-main" style={{ color: '#9ca3af', marginRight: '0.5rem' }}>🔍</span>
                            <input
                                type="text"
                                placeholder="Buscar por nombre, usuario o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ width: '100%', border: 'none', background: 'transparent', padding: '0.75rem 0', fontSize: '0.9rem', outline: 'none', color: '#111827' }}
                            />
                        </div>

                        <div className="vertical-divider"></div>

                        <div className="filter-group">
                            <label className="filter-label" style={{ color: '#4b5563', fontSize: '0.85rem', fontWeight: 600 }}>Estado:</label>
                            <select
                                className="filter-select"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value as any)}
                                style={{ minWidth: '150px', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#111827', fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                                <option value="all">Todos los Estados</option>
                                <option value="active">Solo Activos</option>
                                <option value="inactive">Solo Inactivos</option>
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={openCreateModal}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.25rem', whiteSpace: 'nowrap' }}
                    >
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> Nuevo Usuario
                    </button>
                </div>

                {/* Users Table */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: '30px', height: '30px', border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spinner-spin 1s linear infinite' }}></div>
                        Cargando usuarios...
                    </div>
                ) : filteredUsers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                        No se encontraron usuarios
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e5e7eb', color: '#6b7280', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Usuario</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Nombre Real</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Email</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'center' }}>Estado</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(user => (
                                    <tr key={user.id_usuario} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px 8px', fontWeight: 600, color: '#1f2937' }}>
                                            {user.nombre_usuario}
                                        </td>
                                        <td style={{ padding: '12px 8px', color: '#4b5563' }}>
                                            {user.nombre_real}
                                        </td>
                                        <td style={{ padding: '12px 8px', color: '#3b82f6', fontSize: '0.8rem' }}>
                                            {user.correo_electronico || '-'}
                                        </td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '99px',
                                                fontSize: '0.75rem',
                                                fontWeight: 600,
                                                backgroundColor: user.habilitado === 'S' ? '#d1fae5' : '#fee2e2',
                                                color: user.habilitado === 'S' ? '#065f46' : '#991b1b'
                                            }}>
                                                {user.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#eff6ff',
                                                        color: '#1e40af',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}
                                                    title="Editar"
                                                >
                                                    ✏️ Editar
                                                </button>
                                                <button
                                                    onClick={() => openPasswordModal(user)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: '#fef3c7',
                                                        color: '#92400e',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}
                                                    title="Cambiar contraseña"
                                                >
                                                    🔑
                                                </button>
                                                <button
                                                    onClick={() => openConfirmModal(user)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        backgroundColor: user.habilitado === 'S' ? '#fee2e2' : '#d1fae5',
                                                        color: user.habilitado === 'S' ? '#991b1b' : '#065f46',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600
                                                    }}
                                                    title={user.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}
                                                >
                                                    {user.habilitado === 'S' ? '🚫' : '✅'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {(showCreateModal || showEditModal) && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}
                    onClick={() => {
                        setShowCreateModal(false);
                        setShowEditModal(false);
                        resetForm();
                    }}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '2rem',
                            maxWidth: '600px',
                            width: '90%',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.5rem', color: '#111827' }}>
                            {showCreateModal ? '➕ Crear Nuevo Usuario' : '✏️ Editar Usuario'}
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                                    Usuario (Login) *
                                </label>
                                <input
                                    type="text"
                                    value={formData.nombre_usuario}
                                    onChange={(e) => setFormData({ ...formData, nombre_usuario: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                                    Nombre Real *
                                </label>
                                <input
                                    type="text"
                                    value={formData.nombre_real}
                                    onChange={(e) => setFormData({ ...formData, nombre_real: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.correo_electronico}
                                    onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>



                            {showCreateModal && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                                        Contraseña *
                                    </label>
                                    <input
                                        type="password"
                                        value={formData.clave_usuario}
                                        onChange={(e) => setFormData({ ...formData, clave_usuario: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            borderRadius: '6px',
                                            border: '1px solid #d1d5db',
                                            fontSize: '0.9rem'
                                        }}
                                    />
                                </div>
                            )}

                            {/* Roles Section */}
                            <div style={{ marginTop: '0.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: '#374151' }}>
                                    🛡️ Roles
                                </label>

                                {/* Role Search Input */}
                                <input
                                    type="text"
                                    placeholder="🔍 Buscar rol..."
                                    value={roleSearchTerm}
                                    onChange={(e) => setRoleSearchTerm(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.85rem',
                                        marginBottom: '8px'
                                    }}
                                />

                                <div style={{
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    padding: '8px',
                                    backgroundColor: '#f9fafb'
                                }}>
                                    {(() => {
                                        const filteredRoles = roles.filter(role =>
                                            role.nombre_rol.toLowerCase().includes(roleSearchTerm.toLowerCase()) ||
                                            (role.descripcion && role.descripcion.toLowerCase().includes(roleSearchTerm.toLowerCase()))
                                        );

                                        if (roles.length === 0) {
                                            return (
                                                <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', padding: '8px' }}>
                                                    No hay roles disponibles
                                                </p>
                                            );
                                        }

                                        if (filteredRoles.length === 0) {
                                            return (
                                                <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', padding: '8px' }}>
                                                    No se encontraron roles
                                                </p>
                                            );
                                        }

                                        return filteredRoles.map(role => (
                                            <label
                                                key={role.id_rol}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    padding: '6px 8px',
                                                    cursor: 'pointer',
                                                    borderRadius: '4px',
                                                    marginBottom: '4px',
                                                    backgroundColor: selectedRoles.includes(role.id_rol) ? '#dbeafe' : 'transparent'
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRoles.includes(role.id_rol)}
                                                    onChange={() => toggleRole(role.id_rol)}
                                                    style={{ marginRight: '8px', cursor: 'pointer' }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1f2937' }}>
                                                        {role.nombre_rol}
                                                    </div>
                                                    {role.descripcion && (
                                                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                            {role.descripcion}
                                                        </div>
                                                    )}
                                                </div>
                                            </label>
                                        ));
                                    })()}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '4px' }}>
                                    {selectedRoles.length} rol(es) seleccionado(s)
                                </p>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setShowEditModal(false);
                                    resetForm();
                                }}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: 'white',
                                    color: '#374151',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={showCreateModal ? handleCreateUser : handleUpdateUser}
                                disabled={loading}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#3b82f6',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                {showCreateModal ? 'Crear Usuario' : 'Guardar Cambios'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Password Modal */}
            {showPasswordModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999
                    }}
                    onClick={() => {
                        setShowPasswordModal(false);
                        setNewPassword('');
                        setConfirmPassword('');
                        setSelectedUser(null);
                    }}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            borderRadius: '12px',
                            padding: '2rem',
                            maxWidth: '450px',
                            width: '90%',
                            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: '#111827' }}>
                            🔑 Cambiar Contraseña
                        </h3>
                        <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '1.5rem' }}>
                            Usuario: <strong>{selectedUser?.nombre_usuario}</strong>
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                                    Nueva Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: '#374151' }}>
                                    Confirmar Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        borderRadius: '6px',
                                        border: '1px solid #d1d5db',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => {
                                    setShowPasswordModal(false);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                    setSelectedUser(null);
                                }}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    border: '1px solid #d1d5db',
                                    backgroundColor: 'white',
                                    color: '#374151',
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    cursor: 'pointer'
                                }}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleUpdatePassword}
                                disabled={loading}
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: '#f59e0b',
                                    color: 'white',
                                    fontSize: '0.9rem',
                                    fontWeight: 600,
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1
                                }}
                            >
                                Actualizar Contraseña
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Status Change Modal */}
            <ConfirmModal
                isOpen={showConfirmModal}
                title={selectedUser?.habilitado === 'S' ? 'Deshabilitar Usuario' : 'Habilitar Usuario'}
                message={
                    selectedUser?.habilitado === 'S'
                        ? `¿Está seguro que desea deshabilitar al usuario "${selectedUser?.nombre_usuario}"? El usuario no podrá acceder al sistema.`
                        : `¿Está seguro que desea habilitar al usuario "${selectedUser?.nombre_usuario}"? El usuario podrá acceder al sistema.`
                }
                confirmText={selectedUser?.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}
                cancelText="Cancelar"
                confirmColor={selectedUser?.habilitado === 'S' ? '#ef4444' : '#10b981'}
                onConfirm={handleToggleStatus}
                onCancel={() => {
                    setShowConfirmModal(false);
                    setSelectedUser(null);
                }}
            />
        </div>
    );
};
