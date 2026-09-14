import React, { useState, useEffect } from 'react';
import { Typography, Card, Switch, Button, Tag, Tooltip } from 'antd';
import { useMediaQuery } from '../../../../hooks/useMediaQuery';
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

const { Text } = Typography;

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
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [localConfig, setLocalConfig] = useState(event.config || []);
    const [hovering, setHovering] = useState(false);

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
        <Card
            size="small"
            style={{
                marginBottom: 8,
                transition: 'transform 150ms ease, border-color 150ms ease',
                transform: hovering ? 'translateX(4px)' : 'none',
                borderColor: hovering ? 'var(--app-accent-bg)' : undefined,
            }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: isMobile ? 'stretch' : 'center', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: isMobile ? '100%' : 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Text type="secondary" strong style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                            {event.codigo}
                        </Text>

                        {event.es_transaccional ? (
                            <Tag color="purple" icon={<IconBolt size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                                Dinámico
                            </Tag>
                        ) : localConfig.length > 0 ? (
                            <Tag color="green" icon={<IconCheck size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                                Configurado
                            </Tag>
                        ) : (
                            <Tag color="orange" icon={<IconAlertCircle size={10} style={{ verticalAlign: 'text-bottom' }} />}>
                                Sin Destinatarios
                            </Tag>
                        )}
                    </div>

                    <Text strong style={{ fontSize: 13 }}>
                        {event.descripcion}
                    </Text>
                </div>

                <div style={{ display: 'flex', gap: isMobile ? 12 : 32, flexWrap: isMobile ? 'wrap' : 'nowrap', width: isMobile ? '100%' : 'auto', justifyContent: isMobile ? 'space-between' : 'flex-end', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <Tooltip title="E-mail">
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <IconMail
                                    size={18}
                                    color={hasEmail ? '#1677ff' : 'var(--app-border)'}
                                />
                                <Switch
                                    checked={hasEmail}
                                    onChange={() => toggleQuickChannel('email', hasEmail)}
                                    disabled={saving}
                                    size="small"
                                />
                            </div>
                        </Tooltip>

                        <Tooltip title="Notificación Web">
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <IconBell
                                    size={18}
                                    color={hasWeb ? '#1677ff' : 'var(--app-border)'}
                                />
                                <Switch
                                    checked={hasWeb}
                                    onChange={() => toggleQuickChannel('web', hasWeb)}
                                    disabled={saving}
                                    size="small"
                                />
                            </div>
                        </Tooltip>
                    </div>

                    <Tooltip title="Enviar notificación de prueba a los destinatarios configurados">
                        <Button
                            size="small"
                            style={{ color: '#0c8599' }}
                            icon={<IconPlayerPlay size={14} />}
                            loading={testing}
                            onClick={handleTest}
                        >
                            Probar
                        </Button>
                    </Tooltip>
                    <Button
                        type="primary"
                        style={{ backgroundColor: '#212529' }}
                        size="small"
                        icon={<IconSettings size={14} />}
                        onClick={() => onOpenSettings(event)}
                    >
                        Configurar
                    </Button>
                </div>
            </div>
        </Card>
    );
};
