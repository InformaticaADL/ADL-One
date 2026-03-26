import { useState } from 'react';
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
    ThemeIcon,
    Box,
    Center
} from '@mantine/core';
import { 
    IconLock, 
    IconMail, 
    IconPhone, 
    IconArrowLeft 
} from '@tabler/icons-react';
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
    const [showForgotModal, setShowForgotModal] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (email && password) {
            onSubmit({ email, password, rememberMe });
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
                            label="Usuario / Email"
                            placeholder="nombre@empresa.com"
                            leftSection={<IconMail size={18} />}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
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
                onClose={() => setShowForgotModal(false)}
                title={<Text fw={700} size="lg">Recuperar Contraseña</Text>}
                centered
                radius="lg"
                padding="xl"
                styles={{
                    header: { borderBottom: '1px solid var(--mantine-color-gray-2)', paddingBottom: 'lg' }
                }}
            >
                <Stack gap="xl">
                    <Box bg="blue.0" p="md" style={{ borderRadius: 'var(--mantine-radius-md)', border: '1px solid var(--mantine-color-blue-1)' }}>
                        <Text size="sm" c="blue.9" ta="center" fw={500}>
                            Para recuperar su acceso, por favor contáctese con el área de informática:
                        </Text>
                    </Box>

                    <Stack gap="md">
                        <Paper withBorder p="md" radius="md">
                            <Group gap="md" wrap="nowrap">
                                <ThemeIcon size="lg" radius="xl" color="orange.1" variant="light">
                                    <IconMail size={20} color="var(--mantine-color-orange-7)" />
                                </ThemeIcon>
                                <Box>
                                    <Text size="xs" c="dimmed" fw={600}>EMAIL</Text>
                                    <Anchor 
                                        href="mailto:informatica@adldiagnostic.cl" 
                                        fw={700} 
                                        size="sm"
                                        c="blue.7"
                                    >
                                        informatica@adldiagnostic.cl
                                    </Anchor>
                                </Box>
                            </Group>
                        </Paper>

                        <Paper withBorder p="md" radius="md">
                            <Group gap="md" wrap="nowrap">
                                <ThemeIcon size="lg" radius="xl" color="orange.1" variant="light">
                                    <IconPhone size={20} color="var(--mantine-color-orange-7)" />
                                </ThemeIcon>
                                <Box>
                                    <Text size="xs" c="dimmed" fw={600}>TELÉFONO</Text>
                                    <Anchor 
                                        href="tel:+56957218268" 
                                        fw={700} 
                                        size="sm"
                                        c="blue.7"
                                    >
                                        +56 9 5721 8268
                                    </Anchor>
                                </Box>
                            </Group>
                        </Paper>
                    </Stack>

                    <Button 
                        variant="light" 
                        color="gray" 
                        fullWidth 
                        onClick={() => setShowForgotModal(false)}
                        leftSection={<IconArrowLeft size={16} />}
                        radius="md"
                    >
                        Volver al Login
                    </Button>
                </Stack>
            </Modal>
        </Paper>
    );
};
