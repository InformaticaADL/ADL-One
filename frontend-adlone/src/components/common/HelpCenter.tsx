import { Modal, Stack, Group, Text, ThemeIcon, ActionIcon, Paper, Accordion, Divider, Button } from '@mantine/core';
import { 
    IconMessageCircle, 
    IconMail, 
    IconExternalLink,
    IconInfoCircle,
    IconQuestionMark
} from '@tabler/icons-react';

interface HelpCenterProps {
    opened: boolean;
    onClose: () => void;
}

export const HelpCenter = ({ opened, onClose }: HelpCenterProps) => {
    return (
        <Modal
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="sm">
                    <ThemeIcon color="blue" variant="light" size="md">
                        <IconQuestionMark size={18} />
                    </ThemeIcon>
                    <Text fw={700} size="lg">Centro de Ayuda ADL One</Text>
                </Group>
            }
            size="lg"
            radius="md"
            overlayProps={{
                backgroundOpacity: 0.55,
                blur: 3,
            }}
        >
            <Stack gap="xl">
                {/* Support Cards */}
                <Group grow>
                    <Paper withBorder p="md" radius="md" style={{ textAlign: 'center' }}>
                        <Stack align="center" gap="xs">
                            <ThemeIcon size={40} radius="xl" color="blue" variant="light">
                                <IconMail size={24} />
                            </ThemeIcon>
                            <Text fw={600} size="sm">Correo Soporte</Text>
                            <Text size="xs" c="dimmed">informatica@adldiagnostic.cl</Text>
                            <Button variant="subtle" size="compact-xs" component="a" href="mailto:informatica@adldiagnostic.cl">
                                Enviar Correo
                            </Button>
                        </Stack>
                    </Paper>

                    <Paper withBorder p="md" radius="md" style={{ textAlign: 'center' }}>
                        <Stack align="center" gap="xs">
                            <ThemeIcon size={40} radius="xl" color="green" variant="light">
                                <IconMessageCircle size={24} />
                            </ThemeIcon>
                            <Text fw={600} size="sm">WhatsApp</Text>
                            <Text size="xs" c="dimmed">+56 9 5721 8268</Text>
                            <Button variant="subtle" size="compact-xs" color="green" component="a" href="https://wa.me/56957218268" target="_blank">
                                Abrir Chat
                            </Button>
                        </Stack>
                    </Paper>

                </Group>

                <Divider label="Preguntas Frecuentes" labelPosition="center" />

                <Accordion variant="separated" radius="md">
                    <Accordion.Item value="password">
                        <Accordion.Control icon={<IconInfoCircle size={16} color="var(--mantine-color-blue-filled)" />}>
                            ¿Cómo cambio mi contraseña?
                        </Accordion.Control>
                        <Accordion.Panel>
                            Para cambiar tu contraseña, ve a tu **Perfil** desde el menú de usuario (esquina inferior izquierda), haz clic en el botón de candado y sigue las instrucciones. Recuerda usar una contraseña segura con al menos 8 caracteres.
                        </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="notifications">
                        <Accordion.Control icon={<IconInfoCircle size={16} color="var(--mantine-color-blue-filled)" />}>
                            ¿Cómo gestionar mis notificaciones?
                        </Accordion.Control>
                        <Accordion.Panel>
                            Puedes ver tus notificaciones pendientes en el ícono de campana del menú lateral. También puedes acceder al historial completo desde el módulo de **Notificaciones**.
                        </Accordion.Panel>
                    </Accordion.Item>

                    <Accordion.Item value="error">
                        <Accordion.Control icon={<IconInfoCircle size={16} color="var(--mantine-color-blue-filled)" />}>
                            Me aparece un error inesperado, ¿qué hago?
                        </Accordion.Control>
                        <Accordion.Panel>
                            Si el sistema experimenta un fallo, verás una página de error personalizada. Intenta refrescar la página o volver al inicio. Si el problema persiste, contacta a soporte enviando una captura de pantalla del código de error mostrado.
                        </Accordion.Panel>
                    </Accordion.Item>
                </Accordion>

                <Group justify="space-between" mt="md">
                    <Group gap="xs">
                        <IconInfoCircle size={16} color="gray" />
                        <Text size="xs" c="dimmed">Versión del Sistema: v1.12.0-stable</Text>
                    </Group>
                    <Group gap={4}>
                        <Text size="xs" c="dimmed">© 2026 ADL One</Text>
                        <ActionIcon variant="subtle" size="xs" color="gray">
                            <IconExternalLink size={12} />
                        </ActionIcon>
                    </Group>
                </Group>
            </Stack>
        </Modal>
    );
};
