import React from 'react';
import { 
    Container, 
    Paper, 
    Text, 
    Avatar, 
    Group, 
    Stack, 
    Badge, 
    Divider, 
    Grid,
    Card,
    ThemeIcon,
    Box,
    rem,
    Modal,
    SimpleGrid,
    UnstyledButton,
    PasswordInput,
    Button,
    Progress,
    Loader,
    Center
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconUser, IconMail, IconShieldCheck, IconId, IconUserCircle, IconCamera, IconBriefcase, IconLock, IconMessageCircle } from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { generalChatService } from '../../../services/general-chat.service';
import type { UserProfile } from '../../../services/general-chat.service';
import axios from 'axios';
import API_CONFIG from '../../../config/api.config';
import { useToast } from '../../../contexts/ToastContext';

interface ProfilePageProps {
    userId?: number;
    onStartChat?: (userId: number) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ userId, onStartChat }) => {
    const { user, updateUser, token } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [opened, { open, close }] = useDisclosure(false);
    const [passwordOpened, { open: openPassword, close: closePassword }] = useDisclosure(false);

    // Password change form state
    const [currentPassword, setCurrentPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [profileData, setProfileData] = React.useState<UserProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = React.useState(false);

    const isOwnProfile = !userId || userId === user?.id;

    React.useEffect(() => {
        if (!isOwnProfile && userId) {
            loadUserProfile(userId);
        } else if (user) {
            // Map auth user to profile structure
            setProfileData({
                id_usuario: user.id,
                nombre: user.name,
                nombre_usuario: user.username,
                email: user.email || '',
                cargo: user.cargo || '',
                roles: user.roles?.join(', ') || (user.role === 1 ? 'Administrador' : user.role === 2 ? 'Usuario Estándar' : 'Otro'),
                foto: user.foto || null
            });
        }
    }, [userId, user, isOwnProfile]);

    const loadUserProfile = async (id: number) => {
        setLoadingProfile(true);
        try {
            const data = await generalChatService.getUserProfile(id);
            setProfileData(data);
        } catch (err) {
            console.error('Error loading profile:', err);
            showToast({ message: 'Error cargando perfil', type: 'error' });
        } finally {
            setLoadingProfile(false);
        }
    };

    if (!user || (!profileData && !loadingProfile)) return null;

    const predefinedAvatars = [
        { id: 1, path: '/uploads/avatars/avatar1.png' },
        { id: 2, path: '/uploads/avatars/avatar2.png' },
        { id: 3, path: '/uploads/avatars/avatar3.png' },
        { id: 4, path: '/uploads/avatars/avatar4.png' },
        { id: 5, path: '/uploads/avatars/avatar5.png' },
        { id: 6, path: '/uploads/avatars/avatar6.png' },
    ];

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (newPassword !== confirmPassword) {
            showToast({
                message: 'Las contraseñas nuevas no coinciden',
                type: 'error'
            });
            return;
        }

        if (newPassword.length < 4) {
            showToast({
                message: 'La nueva contraseña debe tener al menos 4 caracteres',
                type: 'error'
            });
            return;
        }

        if (newPassword === currentPassword) {
            showToast({
                message: 'La nueva contraseña no puede ser igual a la actual',
                type: 'error'
            });
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/users/change-password`, {
                currentPassword,
                newPassword
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                showToast({
                    message: 'Contraseña actualizada correctamente',
                    type: 'success'
                });
                closePassword();
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (error: any) {
            console.error('Error changing password:', error);
            showToast({
                message: error.response?.data?.message || 'Error al cambiar la contraseña',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarClick = () => {
        open();
    };

    const handleSelectPredefined = async (avatarPath: string) => {
        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/users/avatar`, { avatarPath }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                updateUser({ foto: avatarPath });
                showToast({
                    message: 'Avatar actualizado correctamente',
                    type: 'success'
                });
                close();
            }
        } catch (error) {
            console.error('Error setting predefined avatar:', error);
            showToast({
                message: 'No se pudo actualizar el avatar',
                type: 'error'
            });
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            showToast({
                message: 'Por favor seleccione una imagen válida',
                type: 'error'
            });
            return;
        }

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/users/profile-picture`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                const newFoto = response.data.data.foto;
                updateUser({ foto: newFoto });
                showToast({
                    message: 'Foto de perfil actualizada correctamente',
                    type: 'success'
                });
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showToast({
                message: 'No se pudo subir la foto de perfil',
                type: 'error'
            });
        }
    };

    const getStrength = (password: string) => {
        if (password.length === 0) return { value: 0, color: 'gray', label: '' };
        if (password.length < 4) return { value: 15, color: 'red', label: 'Muy corta' };
        
        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;
        
        if (strength <= 25) return { value: 35, color: 'orange', label: 'Débil' };
        if (strength <= 50) return { value: 65, color: 'blue', label: 'Media' };
        if (strength <= 75) return { value: 85, color: 'teal', label: 'Buena' };
        return { value: 100, color: 'green', label: 'Excelente' };
    };

    const strength = getStrength(newPassword);
    const passwordsMatch = newPassword && confirmPassword ? newPassword === confirmPassword : null;

    const profilePicUrl = profileData?.foto ? `${API_CONFIG.getBaseURL()}${profileData.foto}` : null;

    if (loadingProfile) {
        return (
            <Container size="md" py="xl">
                <Center style={{ height: 400 }}><Loader size="xl" color="adl-blue" /></Center>
            </Container>
        );
    }

    return (
        <Container size="md" py="xl">
            <Stack gap="xl">
                <Paper p="xl" radius="md" withBorder style={{ 
                    background: 'linear-gradient(135deg, var(--mantine-color-adl-blue-0) 0%, var(--mantine-color-adl-blue-1) 100%)',
                    color: 'var(--mantine-color-adl-blue-9)',
                    position: 'relative',
                    overflow: 'hidden',
                    borderColor: 'var(--mantine-color-adl-blue-2)'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <Group align="flex-start" justify="space-between">
                            <Group gap="xl">
                                <Box style={{ position: 'relative' }}>
                                    <Avatar 
                                        src={profilePicUrl} 
                                        size={120} 
                                        radius={120} 
                                        color="adl-blue"
                                        style={{ 
                                            border: '4px solid rgba(0, 98, 168, 0.2)',
                                            cursor: 'pointer'
                                        }}
                                        onClick={handleAvatarClick}
                                    >
                                        <Text size={rem(48)} fw={700}>{profileData?.nombre?.charAt(0)}</Text>
                                    </Avatar>
                                    {isOwnProfile && (
                                        <ThemeIcon 
                                            size="lg" 
                                            radius="xl" 
                                            variant="filled" 
                                            color="adl-blue"
                                            style={{ 
                                                position: 'absolute', 
                                                bottom: 5, 
                                                right: 5, 
                                                border: '2px solid white',
                                                cursor: 'pointer'
                                            }}
                                            onClick={handleAvatarClick}
                                        >
                                            <IconCamera size={18} />
                                        </ThemeIcon>
                                    )}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        style={{ display: 'none' }} 
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </Box>
                                <Stack gap={4}>
                                    <Text size="xl" fw={800} style={{ fontSize: rem(32), lineHeight: 1.2 }}>
                                        {profileData?.nombre}
                                    </Text>
                                    <Group gap="xs">
                                        {profileData?.roles?.split(', ').map((role: string, idx: number) => (
                                            <Badge key={idx} color="adl-blue" variant="filled" size="sm" style={{ fontWeight: 800 }}>
                                                {role.toUpperCase()}
                                            </Badge>
                                        ))}
                                        {profileData?.nombre_usuario && (
                                            <Text size="sm" fw={600} c="adl-blue" style={{ opacity: 0.8 }}>
                                                @{profileData.nombre_usuario}
                                            </Text>
                                        )}
                                    </Group>
                                </Stack>
                            </Group>
                        </Group>
                    </div>
                    <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)', zIndex: 0 }} />
                </Paper>

                <Grid gutter="xl">
                    <Grid.Col span={{ base: 12, md: 8 }}>
                        <Card withBorder radius="md" p="xl" shadow="sm" style={{ background: 'white' }}>
                            <Text component="div" size="lg" fw={700} mb="xl" style={{ display: 'flex', alignItems: 'center', gap: rem(8) }}>
                                <ThemeIcon variant="light" color="adl-blue" size="md" radius="sm">
                                    <IconId size={18} />
                                </ThemeIcon>
                                Información Personal
                            </Text>

                            <Stack gap="lg">
                                <Group justify="space-between">
                                    <Group gap="sm">
                                        <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                                            <IconUser size={16} />
                                        </ThemeIcon>
                                        <Text size="sm" fw={600} c="dimmed">Nombre Completo</Text>
                                    </Group>
                                    <Text fw={500}>{profileData?.nombre}</Text>
                                </Group>
                                <Divider variant="dotted" />
                                <Group justify="space-between">
                                    <Group gap="sm">
                                        <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                                            <IconMail size={16} />
                                        </ThemeIcon>
                                        <Text size="sm" fw={600} c="dimmed">Correo Electrónico</Text>
                                    </Group>
                                    <Text fw={500}>{profileData?.email || 'No especificado'}</Text>
                                </Group>
                                <Divider variant="dotted" />
                                <Group justify="space-between">
                                    <Group gap="sm">
                                        <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                                            <IconUserCircle size={16} />
                                        </ThemeIcon>
                                        <Text size="sm" fw={600} c="dimmed">Nombre de Usuario</Text>
                                    </Group>
                                    <Text fw={500}>{profileData?.nombre_usuario || 'No especificado'}</Text>
                                </Group>
                                <Divider variant="dotted" />
                                <Group justify="space-between">
                                    <Group gap="sm">
                                        <ThemeIcon variant="light" color="gray" size="md" radius="sm">
                                            <IconBriefcase size={16} />
                                        </ThemeIcon>
                                        <Text size="sm" fw={600} c="dimmed">Cargo</Text>
                                    </Group>
                                    <Text fw={500}>{profileData?.cargo || 'No especificado'}</Text>
                                </Group>

                                {isOwnProfile ? (
                                    <>
                                        <Divider my="lg" />
                                        <Button 
                                            variant="light" 
                                            color="adl-blue" 
                                            fullWidth 
                                            leftSection={<IconLock size={16} />}
                                            onClick={openPassword}
                                        >
                                            Cambiar Contraseña
                                        </Button>
                                    </>
                                ) : (
                                    onStartChat && (
                                        <>
                                            <Divider my="lg" />
                                            <Button 
                                                variant="filled" 
                                                color="adl-blue" 
                                                fullWidth 
                                                leftSection={<IconMessageCircle size={16} />}
                                                onClick={() => onStartChat(userId!)}
                                            >
                                                Enviar Mensaje
                                            </Button>
                                        </>
                                    )
                                )}
                            </Stack>
                        </Card>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, md: 4 }}>
                        <Stack gap="xl">
                             <Card withBorder radius="md" p="xl" shadow="sm" style={{ background: 'white' }}>
                                <Text component="div" size="lg" fw={700} mb="xl" style={{ display: 'flex', alignItems: 'center', gap: rem(8) }}>
                                    <ThemeIcon variant="light" color="adl-blue" size="md" radius="sm">
                                        <IconShieldCheck size={18} />
                                    </ThemeIcon>
                                    Seguridad y Rol
                                </Text>

                                <Stack gap="md">
                                    <Box>
                                        <Text size="xs" fw={700} c="dimmed" mb={8} style={{ textTransform: 'uppercase' }}>Roles Asignados</Text>
                                        <Group gap={6}>
                                            {profileData?.roles?.split(', ').map((role: string, idx: number) => (
                                                <Badge key={idx} color="adl-blue" variant="light" size="md">
                                                    {role}
                                                </Badge>
                                            ))}
                                        </Group>
                                    </Box>
                                    
                                    <Box>
                                        <Text size="xs" fw={700} c="dimmed" mb={4} style={{ textTransform: 'uppercase' }}>ID de Usuario</Text>
                                        <Text fw={600}>#{profileData?.id_usuario}</Text>
                                    </Box>
                                </Stack>
                            </Card>
                        </Stack>
                    </Grid.Col>
                </Grid>
            </Stack>

            <Modal opened={opened} onClose={close} title="Cambiar foto de perfil" centered size="md">
                <Stack gap="md">
                    <Text size="sm" c="dimmed">Selecciona un avatar predefinido o sube una foto propia:</Text>
                    
                    <SimpleGrid cols={3} spacing="xl" py="md">
                        {predefinedAvatars.map((avatar) => {
                            const isSelected = user.foto === avatar.path;
                            return (
                                <Stack key={avatar.id} align="center" gap={0}>
                                    <UnstyledButton 
                                        onClick={() => handleSelectPredefined(avatar.path)}
                                        style={{ 
                                            position: 'relative',
                                            width: rem(90),
                                            height: rem(90),
                                            borderRadius: '50%',
                                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                            border: isSelected ? '4px solid var(--mantine-color-adl-blue-6)' : '1px solid var(--mantine-color-gray-2)',
                                            padding: rem(2),
                                            '&:hover': {
                                                transform: 'scale(1.05)',
                                                boxShadow: 'var(--mantine-shadow-md)'
                                            }
                                        }}
                                    >
                                        <Avatar 
                                            src={`${API_CONFIG.getBaseURL()}${avatar.path}`} 
                                            size={rem(82)} 
                                            radius={rem(82)} 
                                            style={{ margin: 'auto' }}
                                        />
                                        {isSelected && (
                                            <ThemeIcon 
                                                size="sm" 
                                                radius="xl" 
                                                color="adl-blue" 
                                                variant="filled"
                                                style={{ 
                                                    position: 'absolute', 
                                                    top: -2, 
                                                    right: -2, 
                                                    zIndex: 2,
                                                    border: '2px solid white'
                                                }}
                                            >
                                                <IconShieldCheck size={12} />
                                            </ThemeIcon>
                                        )}
                                    </UnstyledButton>
                                </Stack>
                            );
                        })}
                    </SimpleGrid>

                    <Divider label="O SUBE TU PROPIA FOTO" labelPosition="center" my="md" />

                    <UnstyledButton 
                        onClick={() => {
                            close();
                            fileInputRef.current?.click();
                        }}
                        style={{
                            width: '100%',
                            padding: rem(16),
                            borderRadius: rem(8),
                            border: '1px dashed var(--mantine-color-adl-blue-3)',
                            backgroundColor: 'var(--mantine-color-adl-blue-0)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: rem(8),
                            transition: 'hover 0.2s ease'
                        }}
                    >
                        <ThemeIcon color="adl-blue" size="xl" radius="xl" variant="light">
                            <IconCamera size={24} />
                        </ThemeIcon>
                        <Text size="sm" fw={600} color="adl-blue">Subir propia foto</Text>
                    </UnstyledButton>
                </Stack>
            </Modal>
            <Modal opened={passwordOpened} onClose={closePassword} title={<Text fw={700}>Cambiar Contraseña</Text>} centered size="sm">
                <form onSubmit={handlePasswordChange}>
                    <Stack gap="md">
                        <PasswordInput
                            label="Contraseña Actual"
                            placeholder="Ingrese su contraseña actual"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            radius="md"
                        />
                        
                        <Box>
                            <PasswordInput
                                label="Nueva Contraseña"
                                placeholder="Ingrese su nueva contraseña"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                radius="md"
                                error={newPassword && newPassword === currentPassword ? 'No puede ser igual a la actual' : null}
                            />
                            {newPassword && (
                                <Box mt={7}>
                                    <Group justify="space-between" mb={2}>
                                        <Text size="xs" fw={700}>{strength.label}</Text>
                                        <Text size="xs" c="dimmed">{strength.value}%</Text>
                                    </Group>
                                    <Progress 
                                        value={strength.value} 
                                        color={strength.color} 
                                        size="xs" 
                                        radius="xl" 
                                        striped 
                                        animated 
                                    />
                                </Box>
                            )}
                        </Box>

                        <Box>
                            <PasswordInput
                                label="Confirmar Nueva Contraseña"
                                placeholder="Repita la nueva contraseña"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                radius="md"
                                error={passwordsMatch === false ? 'Las contraseñas no coinciden' : null}
                            />
                            {passwordsMatch === true && (
                                <Text size="xs" c="green" fw={700} mt={4} style={{ display: 'flex', alignItems: 'center', gap: rem(4) }}>
                                    <IconShieldCheck size={12} /> Las contraseñas coinciden
                                </Text>
                            )}
                        </Box>

                        <Group justify="flex-end" mt="md">
                            <Button variant="outline" onClick={closePassword} radius="md">Cancelar</Button>
                            <Button 
                                type="submit" 
                                color="adl-blue" 
                                loading={loading} 
                                radius="md"
                                disabled={!passwordsMatch || strength.value < 15 || newPassword === currentPassword}
                            >
                                Actualizar Contraseña
                            </Button>
                        </Group>
                    </Stack>
                </form>
            </Modal>
        </Container>
    );
};
