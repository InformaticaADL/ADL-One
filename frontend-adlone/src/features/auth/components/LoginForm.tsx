import { useState, useEffect } from 'react';
import {
    Card,
    Input,
    Checkbox,
    Button,
    Typography,
    Modal,
    Alert
} from 'antd';
import {
    IconLock,
    IconMail,
    IconArrowLeft,
    IconAlertCircle,
    IconCheck
} from '@tabler/icons-react';
import type { LoginCredentials } from '../types/index';
import logoAdl from '../../../assets/images/logo-adlone.png';
import apiClient from '../../../config/axios.config';

const { Title, Text } = Typography;

interface LoginFormProps {
    onSubmit: (credentials: LoginCredentials) => void;
    isLoading?: boolean;
}

export const LoginForm = ({ onSubmit, isLoading = false }: LoginFormProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [logoutReason, setLogoutReason] = useState<string | null>(null);
    // S-14: estado del formulario de recuperación
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSending, setForgotSending] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotError, setForgotError] = useState<string | null>(null);

    useEffect(() => {
        const reason = sessionStorage.getItem('auth_logout_reason');
        if (reason) {
            setLogoutReason(reason);
            sessionStorage.removeItem('auth_logout_reason');
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // S-11: trim espacios al inicio/final tanto del usuario como de la contraseña.
        const trimmedUser = email.trim();
        const trimmedPass = password.trim();
        if (trimmedUser && trimmedPass) {
            onSubmit({ email: trimmedUser, password: trimmedPass, rememberMe });
        }
    };

    return (
        <Card
            style={{
                width: '100%',
                borderRadius: 16,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)'
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {logoutReason && (
                    <Alert
                        type="warning"
                        showIcon
                        icon={<IconAlertCircle size={18} />}
                        message={logoutReason}
                        closable
                        onClose={() => setLogoutReason(null)}
                    />
                )}

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img src={logoAdl} style={{ width: 260, marginBottom: 24 }} alt="ADL" />
                        <Title level={2} style={{ margin: 0 }}>Bienvenido</Title>
                        <Text type="secondary" style={{ fontSize: 13, textAlign: 'center' }}>Ingresa tus credenciales para continuar</Text>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Field label="Usuario *">
                            <Input
                                placeholder="ej: jperez"
                                prefix={<IconMail size={18} style={{ color: 'var(--app-text-secondary)' }} />}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="username"
                                size="large"
                                disabled={isLoading}
                            />
                        </Field>

                        <Field label="Contraseña *">
                            <Input.Password
                                placeholder="••••••••"
                                prefix={<IconLock size={18} style={{ color: 'var(--app-text-secondary)' }} />}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                size="large"
                                disabled={isLoading}
                            />
                        </Field>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Checkbox
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                disabled={isLoading}
                            >
                                Recuérdame
                            </Checkbox>
                            <Button
                                type="link"
                                htmlType="button"
                                onClick={() => setShowForgotModal(true)}
                                style={{ padding: 0, fontWeight: 500 }}
                            >
                                ¿Olvidaste tu contraseña?
                            </Button>
                        </div>

                        <Button
                            htmlType="submit"
                            type="primary"
                            size="large"
                            block
                            loading={isLoading}
                            style={{ marginTop: 8 }}
                        >
                            {isLoading ? 'Ingresando...' : 'Ingresar'}
                        </Button>
                    </div>
                </form>
            </div>

            <Modal
                open={showForgotModal}
                onCancel={() => {
                    setShowForgotModal(false);
                    setForgotEmail('');
                    setForgotSent(false);
                    setForgotError(null);
                }}
                footer={null}
                width={480}
                centered
                title={<Text strong style={{ fontSize: 16 }}>Recuperar Contraseña</Text>}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    {!forgotSent ? (
                        <>
                            <div style={{ backgroundColor: 'var(--app-accent-bg)', padding: 16, borderRadius: 8 }}>
                                <Text style={{ fontSize: 13, color: '#1864ab' }}>
                                    Ingresa tu email registrado y te enviaremos un link para crear una nueva contraseña.
                                </Text>
                            </div>

                            <Field label="Email *">
                                <Input
                                    type="email"
                                    placeholder="tu.correo@adldiagnostic.cl"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    prefix={<IconMail size={18} style={{ color: 'var(--app-text-secondary)' }} />}
                                    disabled={forgotSending}
                                />
                            </Field>

                            {forgotError && (
                                <Alert type="error" showIcon icon={<IconAlertCircle size={18} />} message={forgotError} />
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                                <Button
                                    icon={<IconArrowLeft size={16} />}
                                    onClick={() => setShowForgotModal(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="primary"
                                    loading={forgotSending}
                                    onClick={async () => {
                                        const trimmed = forgotEmail.trim();
                                        if (!trimmed) { setForgotError('Ingresa tu email'); return; }
                                        setForgotError(null);
                                        setForgotSending(true);
                                        try {
                                            await apiClient.post('/api/auth/forgot-password', { email: trimmed });
                                            setForgotSent(true);
                                        } catch (err: any) {
                                            // S-15 (revisado): mensaje específico cuando el email no existe
                                            const msg = err?.response?.data?.message
                                                || 'No se pudo procesar la solicitud. Intenta nuevamente.';
                                            setForgotError(msg);
                                        } finally {
                                            setForgotSending(false);
                                        }
                                    }}
                                >
                                    Enviar link
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Alert
                                type="success"
                                showIcon
                                icon={<IconCheck size={18} />}
                                message="Solicitud enviada"
                                description="Si el email está registrado, recibirás un correo con un enlace para restablecer tu contraseña. El link es válido por 60 minutos."
                            />
                            <Button
                                block
                                icon={<IconArrowLeft size={16} />}
                                onClick={() => {
                                    setShowForgotModal(false);
                                    setForgotEmail('');
                                    setForgotSent(false);
                                }}
                            >
                                Volver al Login
                            </Button>
                        </>
                    )}
                </div>
            </Modal>
        </Card>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</Text>
            {children}
        </div>
    );
}
