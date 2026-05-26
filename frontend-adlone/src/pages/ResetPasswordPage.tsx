import { useEffect, useState } from 'react';
import {
    Paper,
    PasswordInput,
    Button,
    Stack,
    Image,
    Title,
    Text,
    Box,
    Center,
    Alert,
    Loader
} from '@mantine/core';
import { IconLock, IconAlertCircle, IconCheck, IconArrowLeft } from '@tabler/icons-react';
import apiClient from '../config/axios.config';
import { useToast } from '../contexts/ToastContext';
import logoAdl from '../assets/images/logo-adlone.png';

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

    return (
        <div className="login-page">
            <div className="login-container">
                <Paper
                    shadow="xl"
                    p={40}
                    radius="lg"
                    withBorder
                    style={{
                        width: '100%',
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)'
                    }}
                >
                    <Stack gap="xl">
                        <Center flex={1}>
                            <Stack align="center" gap={0}>
                                <Image src={logoAdl} w={260} mb="xl" />
                                <Title order={2} fw={900}>Restablecer contraseña</Title>
                                {nombreUsuario && (
                                    <Text c="dimmed" size="sm" ta="center">
                                        para <strong>{nombreUsuario}</strong>
                                    </Text>
                                )}
                            </Stack>
                        </Center>

                        {validating && (
                            <Center py="xl"><Loader /></Center>
                        )}

                        {!validating && validationError && (
                            <Stack gap="md">
                                <Alert icon={<IconAlertCircle size={18} />} color="red" radius="md">
                                    {validationError}
                                </Alert>
                                <Button variant="light" leftSection={<IconArrowLeft size={16} />} onClick={backToLogin}>
                                    Volver al login
                                </Button>
                            </Stack>
                        )}

                        {!validating && !validationError && !done && (
                            <form onSubmit={handleSubmit}>
                                <Stack gap="md">
                                    <PasswordInput
                                        label="Nueva contraseña"
                                        placeholder="Ingrese su nueva contraseña"
                                        leftSection={<IconLock size={18} />}
                                        value={password}
                                        onChange={(e) => setPassword(e.currentTarget.value)}
                                        size="md"
                                        radius="md"
                                        required
                                        disabled={saving}
                                    />
                                    <PasswordInput
                                        label="Confirmar contraseña"
                                        placeholder="Repita la contraseña"
                                        leftSection={<IconLock size={18} />}
                                        value={password2}
                                        onChange={(e) => setPassword2(e.currentTarget.value)}
                                        size="md"
                                        radius="md"
                                        required
                                        disabled={saving}
                                        error={password2 && password !== password2 ? 'Las contraseñas no coinciden' : null}
                                    />
                                    <Button
                                        type="submit"
                                        size="lg"
                                        radius="md"
                                        fullWidth
                                        loading={saving}
                                        mt="lg"
                                        bg="blue.7"
                                    >
                                        Restablecer contraseña
                                    </Button>
                                </Stack>
                            </form>
                        )}

                        {done && (
                            <Stack gap="md">
                                <Alert icon={<IconCheck size={18} />} color="green" radius="md" title="Listo">
                                    Tu contraseña fue actualizada. Ya puedes iniciar sesión con ella.
                                </Alert>
                                <Button onClick={backToLogin} size="md" radius="md">
                                    Ir al login
                                </Button>
                            </Stack>
                        )}
                    </Stack>
                </Paper>
            </div>
        </div>
    );
};

export default ResetPasswordPage;
