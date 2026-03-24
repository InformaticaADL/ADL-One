import { useEffect, useState } from 'react';
import { Drawer, Avatar, Text, Box, Group, Button, Divider, Loader, Center, Badge } from '@mantine/core';
import { IconMessageCircle, IconMail, IconBriefcase, IconShield } from '@tabler/icons-react';
import { generalChatService } from '../../services/general-chat.service';
import type { UserProfile } from '../../services/general-chat.service';
import API_CONFIG from '../../config/api.config';

interface ContactProfileDrawerProps {
    opened: boolean;
    onClose: () => void;
    userId: number | null;
    onStartChat: (userId: number) => void;
}

const ContactProfileDrawer: React.FC<ContactProfileDrawerProps> = ({
    opened, onClose, userId, onStartChat
}) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (opened && userId) {
            loadProfile(userId);
        }
        if (!opened) setProfile(null);
    }, [opened, userId]);

    const loadProfile = async (id: number) => {
        setLoading(true);
        try {
            const data = await generalChatService.getUserProfile(id);
            setProfile(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const baseUrl = API_CONFIG.getBaseURL();

    return (
        <Drawer
            opened={opened}
            onClose={onClose}
            title="Perfil de Contacto"
            position="right"
            size="sm"
        >
            {loading ? (
                <Center style={{ height: 200 }}><Loader /></Center>
            ) : !profile ? (
                <Text c="dimmed" ta="center" p="xl">No se encontró el usuario</Text>
            ) : (
                <Box>
                    {/* Avatar & Name */}
                    <Center style={{ flexDirection: 'column', gap: 12 }} mb="lg">
                        <Avatar
                            src={profile.foto ? `${baseUrl}${profile.foto}` : null}
                            size={100}
                            radius="100%"
                            color="blue"
                            style={{ border: '3px solid var(--mantine-color-blue-3)' }}
                        >
                            {profile.nombre?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        <Box ta="center">
                            <Text size="xl" fw={700}>{profile.nombre}</Text>
                            {profile.nombre_usuario && (
                                <Text size="sm" c="dimmed">@{profile.nombre_usuario}</Text>
                            )}
                        </Box>
                    </Center>

                    <Divider mb="md" />

                    {/* Info */}
                    <Box px="sm">
                        {profile.email && (
                            <Group gap="sm" mb="md">
                                <IconMail size={18} style={{ color: 'var(--mantine-color-blue-6)' }} />
                                <Box>
                                    <Text size="xs" c="dimmed">Correo electrónico</Text>
                                    <Text size="sm">{profile.email}</Text>
                                </Box>
                            </Group>
                        )}

                        {profile.cargo && (
                            <Group gap="sm" mb="md">
                                <IconBriefcase size={18} style={{ color: 'var(--mantine-color-teal-6)' }} />
                                <Box>
                                    <Text size="xs" c="dimmed">Cargo</Text>
                                    <Text size="sm">{profile.cargo}</Text>
                                </Box>
                            </Group>
                        )}

                        {profile.roles && (
                            <Group gap="sm" mb="md" align="flex-start">
                                <IconShield size={18} style={{ color: 'var(--mantine-color-violet-6)', marginTop: 3 }} />
                                <Box>
                                    <Text size="xs" c="dimmed">Roles</Text>
                                    <Group gap={4} mt={4}>
                                        {profile.roles.split(', ').map((r, i) => (
                                            <Badge key={i} size="sm" variant="light" color="violet">{r}</Badge>
                                        ))}
                                    </Group>
                                </Box>
                            </Group>
                        )}
                    </Box>

                    <Divider my="md" />

                    {/* Action */}
                    <Box px="sm">
                        <Button
                            fullWidth
                            leftSection={<IconMessageCircle size={18} />}
                            onClick={() => {
                                onClose();
                                if (userId) onStartChat(userId);
                            }}
                        >
                            Enviar mensaje
                        </Button>
                    </Box>
                </Box>
            )}
        </Drawer>
    );
};

export default ContactProfileDrawer;
