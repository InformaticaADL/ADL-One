import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { LoginForm } from '../features/auth/components/LoginForm';
import '../features/auth/Login.css'; // Import the original CSS

const LoginPage = () => {
    const { login } = useAuth();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    // Tras 3 contraseñas incorrectas el servidor informa el correo (enmascarado) para ofrecer recuperarla.
    const [recoveryHint, setRecoveryHint] = useState<{ username: string; maskedEmail: string | null; attempts: number } | null>(null);

    const handleLoginSubmit = async (credentials: any) => {
        setLoading(true);
        try {
            await login(credentials.email, credentials.password, credentials.rememberMe);
            showToast({ type: 'success', message: '¡Bienvenido a ADL One!' });
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Credenciales Incorrectas';
            const datos = error.response?.data?.data;
            if (error.response?.status === 401 && datos?.failedAttempts >= 3) {
                setRecoveryHint({ username: credentials.email, maskedEmail: datos.maskedEmail ?? null, attempts: datos.failedAttempts });
            }
            showToast({ type: 'error', message: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <LoginForm onSubmit={handleLoginSubmit} isLoading={loading} recoveryHint={recoveryHint} onRecoveryClose={() => setRecoveryHint(null)} />
            </div>
        </div>
    );
};

export default LoginPage;
