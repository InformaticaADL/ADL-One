import { useState } from 'react';
import '../Login.css';
import type { LoginCredentials } from '../types/index';
import logoAdl from '../../../assets/images/logo-adlone.png';

interface LoginFormProps {
    onSubmit: (credentials: LoginCredentials) => void;
    isLoading?: boolean;
}

export const LoginForm = ({ onSubmit, isLoading = false }: LoginFormProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email && password) {
            onSubmit({ email, password, rememberMe });
        }
    };

    return (
        <div className="login-card">
            <div className="login-header">
                <img src={logoAdl} alt="ADL One Logo" className="login-logo-img" />
                <h2 className="login-title">Bienvenido</h2>
                <p className="login-subtitle">Ingresa tus credenciales para continuar</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">Usuario / Email</label>
                    <div className="form-input-wrapper">
                        <input
                            type="text"
                            className="form-input"
                            placeholder="nombre@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Contraseña</label>
                    <div className="form-input-wrapper">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                        <span
                            className="input-icon"
                            onClick={() => setShowPassword(!showPassword)}
                            role="button"
                        >
                            {showPassword ? '👁️' : '👁️‍🗨️'}
                        </span>
                    </div>
                </div>

                <div className="form-group">
                    <div className="form-checkbox-wrapper">
                        <input
                            type="checkbox"
                            id="rememberMe"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            disabled={isLoading}
                        />
                        <label htmlFor="rememberMe">
                            Recuérdame (Mantener sesión activa)
                        </label>
                    </div>
                </div>

                <button type="submit" className="login-button" disabled={isLoading}>
                    {isLoading ? 'Ingresando...' : 'Ingresar'}
                </button>
            </form>

            <div className="login-footer">
                <button
                    type="button"
                    className="link"
                    onClick={() => setShowForgotModal(true)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                    ¿Olvidaste tu contraseña?
                </button>
            </div>

            {/* Forgot Password Modal */}
            {showForgotModal && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#ffffff',
                        borderRadius: '1.5rem',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        zIndex: 10,
                        animation: 'fadeIn 0.2s ease-out'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header with background color */}
                    <div
                        style={{
                            background: 'linear-gradient(135deg, #0288d1, #01579b)', // ADL Blue gradient
                            padding: '1.5rem 2rem',
                            textAlign: 'center',
                            color: 'white'
                        }}
                    >
                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 600 }}>Recuperar Contraseña</h3>
                    </div>

                    {/* Content Body */}
                    <div
                        style={{
                            padding: '2rem 2.5rem',
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                    >
                        <div
                            style={{
                                width: '100%',
                                textAlign: 'center',
                                position: 'relative',
                                zIndex: 20
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <p style={{ color: '#546e7a', lineHeight: '1.6', marginBottom: '2rem', fontSize: '1rem', textAlign: 'center' }}>
                                Para recuperar su acceso, por favor contáctese con el área de informática:
                            </p>

                            <div style={{ width: '100%', marginBottom: '2.5rem', padding: '0 0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '15px', marginBottom: '1.5rem' }}>
                                    <div style={{ background: '#fff3e0', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', minHeight: '40px' }}>
                                        <span style={{ fontSize: '1.2rem' }}>📧</span>
                                    </div>
                                    <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                                        <strong style={{ display: 'block', color: '#37474f', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Email:</strong>
                                        <a href="mailto:informatica@adldiagnostic.cl" style={{ color: '#0288d1', textDecoration: 'none', wordBreak: 'break-all', display: 'block', fontWeight: 500 }}>
                                            informatica@adldiagnostic.cl
                                        </a>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ background: '#fff3e0', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', minHeight: '40px' }}>
                                        <span style={{ fontSize: '1.2rem' }}>📱</span>
                                    </div>
                                    <div style={{ textAlign: 'left' }}>
                                        <strong style={{ display: 'block', color: '#37474f', marginBottom: '0.2rem', fontSize: '0.9rem' }}>Teléfono:</strong>
                                        <a href="tel:+56957218268" style={{ color: '#0288d1', textDecoration: 'none', fontWeight: 500 }}>
                                            +56 9 5721 8268
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowForgotModal(false)}
                                style={{
                                    padding: '0.9rem',
                                    background: 'linear-gradient(45deg, #ff9800, #f57c00)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.8rem',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    width: '100%',
                                    fontSize: '1rem',
                                    boxShadow: '0 4px 15px rgba(245, 124, 0, 0.3)',
                                    transition: 'transform 0.2s',
                                    marginTop: '1rem'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.background = 'linear-gradient(45deg, #ffa726, #fb8c00)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(245, 124, 0, 0.4)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.background = 'linear-gradient(45deg, #ff9800, #f57c00)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(245, 124, 0, 0.3)';
                                }}
                            >
                                Volver al Login
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
