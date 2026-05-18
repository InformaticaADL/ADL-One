import React, { useState, useEffect } from 'react';
import { 
    Group, 
    Stack, 
    Text, 
    Paper, 
    Switch, 
    Button, 
    Badge, 
    Tooltip,
    useMantineTheme
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import {
    IconSettings,
    IconMail,
    IconBell,
    IconCheck,
    IconAlertCircle,
    IconBolt,
    IconPlayerPlay
} from '@tabler/icons-react';
import { notificationService } from '../../../../services/notification.service';
import apiClient from '../../../../config/axios.config';
import { useToast } from '../../../../contexts/ToastContext';

interface Props {
    event: {
        id: number;
        codigo: string;
        descripcion: string;
        es_transaccional?: boolean;
        config?: any[];
    };
    onOpenSettings: (event: any) => void;
    onStatusChange?: () => void;
}

export const EventRow: React.FC<Props> = ({ event, onOpenSettings, onStatusChange }) => {
    const theme = useMantineTheme();
    const isMobile = useMediaQuery(`(max-width: ${theme.breakpoints.sm})`);
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [localConfig, setLocalConfig] = useState(event.config || []);

    useEffect(() => {
        setLocalConfig(event.config || []);
    }, [event.config]);

    const handleTest = async () => {
        try {
            setTesting(true);
            await apiClient.post('/api/notifications/test/send', {
                eventCode: event.codigo,
                context: { correlativo: 'TEST-001', usuario: 'Admin Test' }
            });
            showToast({ type: 'success', message: `Notificación de prueba enviada para "${event.codigo}". Revisa la campanita y el email.` });
        } catch {
            showToast({ type: 'error', message: 'Error al enviar notificación de prueba' });
        } finally {
            setTesting(false);
        }
    };

    const hasEmail = localConfig.some(c => c.envia_email) || false;
    const hasWeb = localConfig.some(c => c.envia_web) || false;

    const toggleQuickChannel = async (channel: 'email' | 'web', currentVal: boolean) => {
        const prevConfig = localConfig; // snapshot before optimistic update
        try {
            setSaving(true);
            let newConfigs: any[] = [];

            if (localConfig.length === 0) {
                if (event.es_transaccional) {
                    newConfigs = [{
                        envia_email: channel === 'email' ? !currentVal : hasEmail,
                        envia_web: channel === 'web' ? !currentVal : hasWeb
                    }];
                } else {
                    showToast({ type: 'info', message: 'Primero configure los destinatarios para este evento' });
                    onOpenSettings(event);
                    return;
                }
            } else {
                newConfigs = localConfig.map(c => ({
                    ...c,
                    envia_email: channel === 'email' ? !currentVal : c.envia_email,
                    envia_web: channel === 'web' ? !currentVal : c.envia_web
                }));
            }

            setLocalConfig(newConfigs);
            await notificationService.saveNotificationConfig(event.id, newConfigs);
            showToast({
                type: 'success',
                message: `${channel === 'email' ? 'Email' : 'Notificaciones Web'} ${!currentVal ? 'activadas' : 'desactivadas'}`
            });

            if (onStatusChange) onStatusChange();
        } catch (error) {
            setLocalConfig(prevConfig); // revert to known-good state, not stale prop
            showToast({ type: 'error', message: 'Error al actualizar configuración rápida' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Paper
            p="md"
            mb="sm"
            shadow="xs"
            withBorder
            styles={{
                root: {
                    transition: 'transform 150ms ease, border-color 150ms ease',
                    cursor: 'default',
                    '&:hover': {
                        transform: 'translateX(4px)',
                        borderColor: 'var(--mantine-color-adl-blue-2)',
                    }
                }
            }}
        >
            <Group justify="space-between" wrap={isMobile ? "wrap" : "nowrap"} align={isMobile ? "stretch" : "center"}>
                <Stack gap={4} style={{ flex: 1, minWidth: isMobile ? '100%' : 0 }}>
                    <Group gap="xs">
                        <Text style={{ fontSize: '10px' }} fw={800} c="dimmed" tt="uppercase" lts="1px">
                            {event.codigo}
                        </Text>
                        
                        {event.es_transaccional ? (
                            <Badge variant="light" color="violet" size="xs" leftSection={<IconBolt size={10} />}>
                                Dinámico
                            </Badge>
                        ) : localConfig.length > 0 ? (
                            <Badge variant="light" color="green" size="xs" leftSection={<IconCheck size={10} />}>
                                Configurado
                            </Badge>
                        ) : (
                            <Badge variant="light" color="orange" size="xs" leftSection={<IconAlertCircle size={10} />}>
                                Sin Destinatarios
                            </Badge>
                        )}
                    </Group>
                    
                    <Text fw={600} size="sm" c="dark.4">
                        {event.descripcion}
                    </Text>
                </Stack>

                <Group gap={isMobile ? "sm" : "xl"} wrap={isMobile ? "wrap" : "nowrap"} style={{ width: isMobile ? '100%' : 'auto' }} justify={isMobile ? "space-between" : "flex-end"}>
                    <Group gap="md">
                        <Tooltip label="E-mail" position="top" withArrow>
                            <Group gap={8}>
                                <IconMail 
                                    size={18} 
                                    color={hasEmail ? 'var(--mantine-color-adl-blue-6)' : 'var(--mantine-color-gray-4)'} 
                                />
                                <Switch 
                                    checked={hasEmail}
                                    onChange={() => toggleQuickChannel('email', hasEmail)}
                                    disabled={saving}
                                    size="sm"
                                    color="adl-blue"
                                />
                            </Group>
                        </Tooltip>

                        <Tooltip label="Notificación Web" position="top" withArrow>
                            <Group gap={8}>
                                <IconBell 
                                    size={18} 
                                    color={hasWeb ? 'var(--mantine-color-adl-blue-6)' : 'var(--mantine-color-gray-4)'} 
                                />
                                <Switch 
                                    checked={hasWeb}
                                    onChange={() => toggleQuickChannel('web', hasWeb)}
                                    disabled={saving}
                                    size="sm"
                                    color="adl-blue"
                                />
                            </Group>
                        </Tooltip>
                    </Group>

                    <Tooltip label="Enviar notificación de prueba a los destinatarios configurados" withArrow>
                        <Button
                            variant="light"
                            color="teal"
                            size="xs"
                            leftSection={<IconPlayerPlay size={14} />}
                            loading={testing}
                            onClick={handleTest}
                        >
                            Probar
                        </Button>
                    </Tooltip>
                    <Button
                        variant="filled"
                        color="dark"
                        size="xs"
                        leftSection={<IconSettings size={14} />}
                        onClick={() => onOpenSettings(event)}
                    >
                        Configurar
                    </Button>
                </Group>
            </Group>
        </Paper>
    );
};