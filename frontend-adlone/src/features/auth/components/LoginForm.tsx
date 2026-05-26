import { useState, useEffect } from 'react';
import {
    Paper,
    TextInput,
    PasswordInput,
    Checkbox,
    Button,
    Group,
    Stack,
    Image,
    Title,
    Text,
    Modal,
    Anchor,
    Box,
    Center,
    Alert
} from '@mantine/core';
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
                {logoutReason && (
                    <Alert
                        icon={<IconAlertCircle size={18} />}
                        color="orange"
                        radius="md"
                        withCloseButton
                        onClose={() => setLogoutReason(null)}
                    >
                        {logoutReason}
                    </Alert>
                )}

                <Center flex={1}>
                    <Stack align="center" gap={0}>
                        <Image src={logoAdl} w={260} mb="xl" />
                        <Title order={2} fw={900}>Bienvenido</Title>
                        <Text c="dimmed" size="sm" ta="center">Ingresa tus credenciales para continuar</Text>
                    </Stack>
                </Center>

                <form onSubmit={handleSubmit}>
                    <Stack gap="md">
                        <TextInput
                            label="Usuario"
                            placeholder="ej: jperez"
                            leftSection={<IconMail size={18} />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="username"
                            size="md"
                            radius="md"
                            required
                            disabled={isLoading}
                        />

                        <PasswordInput
                            label="Contraseña"
                            placeholder="••••••••"
                            leftSection={<IconLock size={18} />}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            size="md"
                            radius="md"
                            required
                            disabled={isLoading}
                        />

                        <Group justify="space-between">
                            <Checkbox
                                label="Recuérdame"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                size="sm"
                                disabled={isLoading}
                            />
                            <Anchor 
                                size="sm" 
                                component="button" 
                                type="button"
                                onClick={() => setShowForgotModal(true)}
                                fw={500}
                            >
                                ¿Olvidaste tu contraseña?
                            </Anchor>
                        </Group>

                        <Button 
                            type="submit" 
                            size="lg" 
                            radius="md" 
                            fullWidth 
                            loading={isLoading}
                            mt="lg"
                            bg="blue.7"
                        >
                            {isLoading ? 'Ingresando...' : 'Ingresar'}
                        </Button>
                    </Stack>
                </form>
            </Stack>

            <Modal
                opened={showForgotModal}
                onClose={() => {
                    setShowForgotModal(false);
                    setForgotEmail('');
                    setForgotSent(false);
                    setForgotError(null);
                }}
                title={<Text fw={700} size="lg">Recuperar Contraseña</Text>}
                centered
                radius="lg"
                padding="xl"
            >
                <Stack gap="md">
                    {!forgotSent ? (
                        <>
                            <Box bg="blue.0" p="md" style={{ borderRadius: 'var(--mantine-radius-md)' }}>
                                <Text size="sm" c="blue.9">
                                    Ingresa tu email registrado y te enviaremos un link para crear una nueva contraseña.
                                </Text>
                            </Box>

                            <TextInput
                                label="Email"
                                type="email"
                                placeholder="tu.correo@adldiagnostic.cl"
                                value={forgotEmail}
                                onChange={(e) => setForgotEmail(e.currentTarget.value)}
                                leftSection={<IconMail size={18} />}
                                radius="md"
                                required
                                disabled={forgotSending}
                            />

                            {forgotError && (
                                <Alert icon={<IconAlertCircle size={18} />} color="red" radius="md">
                                    {forgotError}
                                </Alert>
                            )}

                            <Group justify="space-between" mt="sm">
                                <Button
                                    variant="subtle"
                                    color="gray"
                                    leftSection={<IconArrowLeft size={16} />}
                                    onClick={() => setShowForgotModal(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    color="blue.7"
                                    loading={forgotSending}
                                    onClick={async () => {
                                        const trimmed = forgotEmail.trim();
                                        if (!trimmed) { setForgotError('Ingresa tu email'); return; }
                                        setForgotError(null);
                                        setForgotSending(true);
                                        try {
                                            await apiClient.post('/api/auth/forgot-password', { email: trimmed });
                                            setForgotSent(true);
                                        } catch {
                                            // S-15: respuesta genérica incluso en error
                                            setForgotSent(true);
                                        } finally {
                                            setForgotSending(false);
                                        }
                                    }}
                                >
                                    Enviar link
                                </Button>
                            </Group>
                        </>
                    ) : (
                        <>
                            <Alert icon={<IconCheck size={18} />} color="green" radius="md" title="Solicitud enviada">
                                Si el email está registrado, recibirás un correo con un enlace para restablecer tu contraseña.
                                El link es válido por 60 minutos.
                            </Alert>
                            <Button
                                variant="light"
                                color="gray"
                                fullWidth
                                leftSection={<IconArrowLeft size={16} />}
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
                </Stack>
            </Modal>
        </Paper>
    );
};
