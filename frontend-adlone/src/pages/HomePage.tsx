import './HomePage.css';
import { useState, useEffect } from 'react';
import apiService from '../services/api.service.ts';
import API_CONFIG from '../config/api.config.ts';

interface ServerStatus {
    success?: boolean;
    message?: string;
    data?: {
        status?: string;
        database?: string;
        message?: string;
        databaseDetails?: {
            database: string;
            version: string;
        };
    };
}

function HomePage() {
    const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentEndpoint, setCurrentEndpoint] = useState(API_CONFIG.getBaseURL());

    useEffect(() => {
        checkServerHealth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentEndpoint]);

    const checkServerHealth = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await apiService.healthCheck();
            setServerStatus(response as ServerStatus);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error de conexión';
            setError(errorMessage);
            setServerStatus(null);
        } finally {
            setLoading(false);
        }
    };

    const switchEndpoint = (endpoint: string) => {
        apiService.setBaseURL(endpoint);
        setCurrentEndpoint(endpoint);
    };

    return (
        <div className="home-page">
            <div className="container">
                <header className="header">
                    <div className="logo-section">
                        <div className="logo">ADL</div>
                        <h1 className="title">ADL One</h1>
                    </div>
                    <p className="subtitle">Sistema de Gestión Empresarial</p>
                </header>

                <div className="content">
                    <div className="status-card">
                        <h2>Estado del Servidor</h2>

                        {loading && (
                            <div className="status-loading">
                                <div className="spinner"></div>
                                <p>Conectando al servidor...</p>
                            </div>
                        )}

                        {!loading && serverStatus && (
                            <div className="status-success">
                                <div className="status-icon">✓</div>
                                <div className="status-info">
                                    <p className="status-title">Servidor Activo</p>
                                    <p className="status-message">{serverStatus.data?.message || serverStatus.message}</p>
                                    <div className="status-details">
                                        <span className="badge badge-success">
                                            Base de datos: {serverStatus.data?.database || 'N/A'}
                                        </span>
                                        <span className="badge badge-info">
                                            Estado: {serverStatus.data?.status || 'healthy'}
                                        </span>
                                        {serverStatus.data?.databaseDetails && (
                                            <span className="badge badge-primary">
                                                DB: {serverStatus.data.databaseDetails.database}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {!loading && error && (
                            <div className="status-error">
                                <div className="status-icon">✕</div>
                                <div className="status-info">
                                    <p className="status-title">Error de Conexión</p>
                                    <p className="status-message">{error}</p>
                                    <button className="btn-retry" onClick={checkServerHealth}>
                                        Reintentar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="endpoint-selector">
                        <h3>Seleccionar Endpoint</h3>
                        <div className="endpoint-buttons">
                            {Object.entries(API_CONFIG.endpoints).map(([name, url]) => (
                                <button
                                    key={name}
                                    className={`btn-endpoint ${currentEndpoint === url ? 'active' : ''}`}
                                    onClick={() => switchEndpoint(url as string)}
                                >
                                    <span className="endpoint-name">{name}</span>
                                    <span className="endpoint-url">{url as string}</span>
                                </button>
                            ))}
                        </div>
                        <p className="endpoint-current">
                            Endpoint actual: <strong>{currentEndpoint}</strong>
                        </p>
                    </div>

                    <div className="info-section">
                        <h3>Información del Sistema</h3>
                        <div className="info-grid">
                            <div className="info-item">
                                <span className="info-label">Frontend:</span>
                                <span className="info-value">React + Vite + TypeScript</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Backend:</span>
                                <span className="info-value">Node.js + Express</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Base de datos:</span>
                                <span className="info-value">SQL Server</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Versión:</span>
                                <span className="info-value">1.0.0</span>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="footer">
                    <p>© 2026 ADL One - Sistema de Gestión Empresarial</p>
                </footer>
            </div>
        </div>
    );
}

export default HomePage;
