import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import logoAdl from '../assets/images/logo-adlone.png';
import '../features/auth/Login.css'; // Import the original CSS

const LoginPage = () => {
    const { login } = useAuth();
    const { showToast } = useToast();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username || !password) {
            showToast({ type: 'warning', message: 'Por favor ingrese usuario y contraseña' });
            return;
        }

        setLoading(true);
        try {
            await login(username, password);
            showToast({ type: 'success', message: '¡Bienvenido a ADL One!' });
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Credenciales Incorrectas';
            showToast({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <img src={logoAdl} alt="ADL Logo" className="login-logo-img" />
                        <h2 className="login-title">Bienvenido</h2>
                        <p className="login-subtitle">Ingresa tus credenciales para continuar</p>
                    </div>

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Usuario</label>
                            <div className="form-input-wrapper">
                                <input
                                    type="text"
                                    className="form-input"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Nombre de usuario"
                                    disabled={loading}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Contraseña</label>
                            <div className="form-input-wrapper">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    disabled={loading}
                                    required
                                />
                                <span
                                    className="input-icon"
                                    onClick={() => setShowPassword(!showPassword)}
                                    role="button"
                                    style={{ cursor: 'pointer' }}
                                >
                                    {showPassword ? '👁️' : '👁️‍🗨️'}
                                </span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="login-button"
                            disabled={loading}
                        >
                            {loading ? 'Iniciando sesión...' : 'Ingresar'}
                        </button>
                    </form>

                    <div className="login-footer">
                        {/* Opcional: Links de recuperación */}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
