import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LoginForm } from '../features/auth/components/LoginForm';
import '../features/auth/Login.css'; // Import the original CSS

const LoginPage = () => {
    const { login } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const handleLoginSubmit = async (credentials: any) => {
        setLoading(true);
        try {
            await login(credentials.email, credentials.password, credentials.rememberMe);
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
                <LoginForm onSubmit={handleLoginSubmit} isLoading={loading} />
            </div>
        </div>
    );
};

export default LoginPage;
