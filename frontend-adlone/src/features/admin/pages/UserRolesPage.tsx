import React, { useEffect, useState } from 'react';
import { rbacService } from '../services/rbac.service';
import '../admin.css';
import type { User } from '../services/rbac.service';
import { UserRoleModal } from '../components/UserRoleModal';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    onBack?: () => void;
}

export const UserRolesPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await rbacService.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Error loading users:', error);
            showToast({ type: 'error', message: 'Error cargando usuarios' });
        } finally {
            setLoading(false);
        }
    };

    const handleAssignClick = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const filteredUsers = users.filter(user =>
        user.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.nombre_real && user.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (

        <div className="admin-container">
            <div className="admin-header-section">
                <div className="toolbar">
                    <div>
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
                        <h1 className="admin-title">Gestión de Usuarios</h1>
                        <p className="admin-subtitle">Administra los accesos y roles del personal.</p>
                    </div>

                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Buscar usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        <div className="search-icon">
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <div className="table-container">
                <table className="admin-table-compact">
                    <thead>
                        <tr>
                            <th style={{ width: '40%' }}>Usuario</th>
                            <th style={{ width: '40%' }}>Nombre Real</th>
                            <th style={{ width: '20%', textAlign: 'center' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                                        <svg className="spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                                        Cargando usuarios...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredUsers.length === 0 ? (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                                    {searchTerm ? 'No se encontraron usuarios con ese criterio.' : 'No hay usuarios registrados.'}
                                </td>
                            </tr>
                        ) : (
                            filteredUsers.map((user) => (
                                <tr key={user.id_usuario}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: '#111827' }}>{user.nombre_usuario}</div>
                                    </td>
                                    <td>
                                        <div style={{ color: '#4b5563' }}>{user.nombre_real || '-'}</div>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            onClick={() => handleAssignClick(user)}
                                            className="btn-assign"
                                            title="Asignar Roles"
                                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                            Asignar Roles
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <UserRoleModal
                user={selectedUser}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setSelectedUser(null);
                }}
                onSuccess={() => {
                    // Refresh if needed, though permission assignment doesn't change user list
                }}
            />
        </div>
    );

};
