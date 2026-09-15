import React, { useState, useEffect } from 'react';
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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

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
        <Card className="mb-2 flex flex-col gap-3 p-3 transition-all hover:translate-x-1 hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{event.codigo}</span>

                    {event.es_transaccional ? (
                        <Badge variant="outline" className="gap-1"><IconBolt size={10} /> Dinámico</Badge>
                    ) : localConfig.length > 0 ? (
                        <Badge variant="success" className="gap-1"><IconCheck size={10} /> Configurado</Badge>
                    ) : (
                        <Badge variant="warning" className="gap-1"><IconAlertCircle size={10} /> Sin Destinatarios</Badge>
                    )}
                </div>

                <p className="text-sm font-semibold text-foreground">{event.descripcion}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 sm:justify-end sm:gap-8">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2" title="E-mail">
                        <IconMail size={18} className={cn(hasEmail ? 'text-primary' : 'text-border')} />
                        <Switch checked={hasEmail} onCheckedChange={() => toggleQuickChannel('email', hasEmail)} disabled={saving} />
                    </div>

                    <div className="flex items-center gap-2" title="Notificación Web">
                        <IconBell size={18} className={cn(hasWeb ? 'text-primary' : 'text-border')} />
                        <Switch checked={hasWeb} onCheckedChange={() => toggleQuickChannel('web', hasWeb)} disabled={saving} />
                    </div>
                </div>

                <Button variant="outline" size="sm" title="Enviar notificación de prueba a los destinatarios configurados" onClick={handleTest} disabled={testing}>
                    {testing ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <IconPlayerPlay size={14} />}
                    Probar
                </Button>
                <Button size="sm" onClick={() => onOpenSettings(event)}>
                    <IconSettings size={14} />
                    Configurar
                </Button>
            </div>
        </Card>
    );
};
