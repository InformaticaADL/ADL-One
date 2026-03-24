import React, { useState, useEffect } from 'react';
import { ursService } from '../../../services/urs.service';
import RequestTypePermissionsPage from './RequestTypePermissionsPage';
import './AdminUrsPage.css';

interface AdminUrsPageProps {
    onBack: () => void;
}

const AdminUrsPage: React.FC<AdminUrsPageProps> = ({ onBack }) => {
    const [types, setTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'LIST' | 'PERMISSIONS'>('LIST');
    const [selectedType, setSelectedType] = useState<any>(null);

    useEffect(() => {
        loadTypes();
    }, []);

    const loadTypes = async () => {
        try {
            setLoading(true);
            const data = await ursService.getRequestTypes(true); 
            setTypes(data);
        } catch (error) {
            console.error('Error loading types:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleManagePermissions = (type: any) => {
        setSelectedType(type);
        setView('PERMISSIONS');
    };

    const handleToggleStatus = async (type: any) => {
        try {
            await (ursService as any).toggleTypeStatus(type.id_tipo, !type.estado);
            loadTypes();
        } catch (error) {
            console.error('Error toggling status:', error);
        }
    };

    if (view === 'PERMISSIONS' && selectedType) {
        return (
            <RequestTypePermissionsPage 
                requestType={selectedType} 
                onBack={() => {
                    setView('LIST');
                    setSelectedType(null);
                    loadTypes();
                }} 
            />
        );
    }

    return (
        <div className="admin-urs-container">
            <header className="admin-urs-header">
                <button onClick={onBack} className="btn-back">
                    <span className="icon-circle">←</span>
                    Volver
                </button>
                <div className="header-info">
                    <h1>Administración de Solicitudes</h1>
                    <p>Gestiona quién puede enviar y quién puede resolver los trámites del sistema.</p>
                </div>
            </header>

            <div className="admin-urs-content">
                {loading ? (
                    <div className="loading">Cargando tipos...</div>
                ) : (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Nombre del Trámite</th>
                                <th>Área Destino</th>
                                <th>Estado</th>
                                <th>Acciones de Administración</th>
                            </tr>
                        </thead>
                        <tbody>
                            {types.map((type) => (
                                <tr key={type.id_tipo}>
                                    <td>
                                        <div style={{ fontWeight: 600, color: '#1e293b' }}>{type.nombre}</div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {type.id_tipo}</div>
                                    </td>
                                    <td><span className="badge-area">{type.area_destino}</span></td>
                                    <td>
                                        <span className={`status-pill ${type.estado ? 'active' : 'inactive'}`}>
                                            {type.estado ? 'Habilitado' : 'Deshabilitado'}
                                        </span>
                                    </td>
                                    <td>
                                        <button 
                                            className="btn-primary" 
                                            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                            onClick={() => handleManagePermissions(type)}
                                        >
                                            🛡️ Administrar Accesos
                                        </button>
                                        <button 
                                            className={`btn-icon ${type.estado ? 'btn-disable' : 'btn-enable'}`} 
                                            onClick={() => handleToggleStatus(type)}
                                            title={type.estado ? 'Deshabilitar' : 'Habilitar'}
                                            style={{ marginLeft: '10px' }}
                                        >
                                            {type.estado ? '🚫' : '✅'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
            
            <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#475569', fontSize: '0.9rem' }}>ℹ️ Nota para Administradores</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem', lineHeight: '1.5' }}>
                    La creación de nuevos tipos de formularios y la edición técnica del JSON están reservadas para el equipo de desarrollo. 
                    Desde este panel usted puede controlar de manera sencilla <strong>quién tiene permiso para enviar</strong> cada solicitud y 
                    <strong>quién tiene la autoridad para resolverla</strong> (Aprobar/Rechazar).
                </p>
            </div>
        </div>
    );
};

export default AdminUrsPage;
