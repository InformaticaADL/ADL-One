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
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email && password) {
            onSubmit({ email, password });
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

                <button type="submit" className="login-button" disabled={isLoading}>
                    {isLoading ? 'Ingresando...' : 'Ingresar'}
                </button>
            </form>

            <div className="login-footer">
                <a href="#" className="link">¿Olvidaste tu contraseña?</a>
            </div>
        </div>
    );
};
