import { useEffect, useState } from 'react';
import {
    Card,
    Input,
    Button,
    Typography,
    Alert,
    Spin
} from 'antd';
import { IconLock, IconAlertCircle, IconCheck, IconArrowLeft } from '@tabler/icons-react';
import apiClient from '../config/axios.config';
import { useToast } from '../contexts/ToastContext';
import logoAdl from '../assets/images/logo-adlone.png';

const { Title, Text } = Typography;

interface Props {
    onDone: () => void; // volver al login
}

export const ResetPasswordPage = ({ onDone }: Props) => {
    const { showToast } = useToast();
    const [token, setToken] = useState<string>('');
    const [validating, setValidating] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [nombreUsuario, setNombreUsuario] = useState<string>('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token') || '';
        setToken(t);
        if (!t) {
            setValidating(false);
            setValidationError('No se proporcionó un token de recuperación.');
            return;
        }
        apiClient.get(`/api/auth/reset-password/validate?token=${encodeURIComponent(t)}`)
            .then(res => {
                setNombreUsuario(res.data?.data?.nombreUsuario || '');
                setValidationError(null);
            })
            .catch(err => {
                setValidationError(err.response?.data?.message || 'El link no es válido o ha expirado.');
            })
            .finally(() => setValidating(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 4) {
            showToast({ type: 'warning', message: 'La contraseña debe tener al menos 4 caracteres.' });
            return;
        }
        if (password !== password2) {
            showToast({ type: 'warning', message: 'Las contraseñas no coinciden.' });
            return;
        }
        setSaving(true);
        try {
            await apiClient.post('/api/auth/reset-password', { token, newPassword: password });
            setDone(true);
            showToast({ type: 'success', message: 'Contraseña actualizada correctamente.' });
        } catch (err: any) {
            showToast({ type: 'error', message: err.response?.data?.message || 'No se pudo restablecer la contraseña.' });
        } finally {
            setSaving(false);
        }
    };

    const backToLogin = () => {
        // Limpiar query y volver al login
        window.history.replaceState({}, '', '/');
        onDone();
    };

    const passwordsMismatch = !!password2 && password !== password2;

    return (
        <div className="login-page">
            <div className="login-container">
                <Card
                    style={{
                        width: '100%',
                        borderRadius: 16,
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <img src={logoAdl} style={{ width: 260, marginBottom: 24 }} alt="ADL" />
                                <Title level={2} style={{ margin: 0 }}>Restablecer contraseña</Title>
                                {nombreUsuario && (
                                    <Text type="secondary" style={{ fontSize: 13, textAlign: 'center' }}>
                                        para <strong>{nombreUsuario}</strong>
                                    </Text>
                                )}
                            </div>
                        </div>

                        {validating && (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
                        )}

                        {!validating && validationError && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Alert type="error" showIcon icon={<IconAlertCircle size={18} />} message={validationError} />
                                <Button icon={<IconArrowLeft size={16} />} onClick={backToLogin}>
                                    Volver al login
                                </Button>
                            </div>
                        )}

                        {!validating && !validationError && !done && (
                            <form onSubmit={handleSubmit}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <Field label="Nueva contraseña *">
                                        <Input.Password
                                            placeholder="Ingrese su nueva contraseña"
                                            prefix={<IconLock size={18} style={{ color: 'var(--app-text-secondary)' }} />}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            size="large"
                                            disabled={saving}
                                        />
                                    </Field>
                                    <Field label="Confirmar contraseña *">
                                        <Input.Password
                                            placeholder="Repita la contraseña"
                                            prefix={<IconLock size={18} style={{ color: 'var(--app-text-secondary)' }} />}
                                            value={password2}
                                            onChange={(e) => setPassword2(e.target.value)}
                                            size="large"
                                            disabled={saving}
                                            status={passwordsMismatch ? 'error' : undefined}
                                        />
                                        {passwordsMismatch && <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>Las contraseñas no coinciden</Text>}
                                    </Field>
                                    <Button
                                        htmlType="submit"
                                        type="primary"
                                        size="large"
                                        block
                                        loading={saving}
                                        style={{ marginTop: 8 }}
                                    >
                                        Restablecer contraseña
                                    </Button>
                                </div>
                            </form>
                        )}

                        {done && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Alert type="success" showIcon icon={<IconCheck size={18} />} message="Listo" description="Tu contraseña fue actualizada. Ya puedes iniciar sesión con ella." />
                                <Button onClick={backToLogin} size="large">
                                    Ir al login
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
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

export default ResetPasswordPage;
