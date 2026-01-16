import { useState } from 'react';
import { LoginForm } from '../features/auth/components/LoginForm';
import '../features/auth/Login.css';

const LoginPage = () => {
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (credentials: any) => {
        setIsLoading(true);
        console.log('Login attempt:', credentials);
        // Simulating API call
        setTimeout(() => {
            setIsLoading(false);
            alert('¡Login simulado exitoso! \nUsuario: ' + credentials.email);
        }, 1500);
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
            </div>
        </div>
    );
};

export default LoginPage;
