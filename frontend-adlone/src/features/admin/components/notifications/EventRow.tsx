import React, { useState, useEffect } from 'react';
import { Settings, Mail, Bell, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { notificationService } from '../../../../services/notification.service';
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
    onStatusChange?: () => void; // NUEVO: Para avisarle al padre que refresque (opcional)
}

export const EventRow: React.FC<Props> = ({ event, onOpenSettings, onStatusChange }) => {
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);

    // NUEVO: Estado local para respuesta instantánea de UI
    const [localConfig, setLocalConfig] = useState(event.config || []);

    // Sincronizar estado local si las props cambian (cuando el Modal guarda)
    useEffect(() => {
        setLocalConfig(event.config || []);
    }, [event.config]);

    // CORRECCIÓN: Nombres de variables correctos (envia_email, envia_web)
    const hasEmail = localConfig.some(c => c.envia_email) || false;
    const hasWeb = localConfig.some(c => c.envia_web) || false;

    const toggleQuickChannel = async (channel: 'email' | 'web', currentVal: boolean) => {
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
                // CORRECCIÓN: Nombres de variables correctos
                newConfigs = localConfig.map(c => ({
                    ...c,
                    envia_email: channel === 'email' ? !currentVal : c.envia_email,
                    envia_web: channel === 'web' ? !currentVal : c.envia_web
                }));
            }

            // Actualización optimista de UI (se ve instantáneo)
            setLocalConfig(newConfigs);

            await notificationService.saveNotificationConfig(event.id, newConfigs);
            showToast({ type: 'success', message: `${channel === 'email' ? 'Email' : 'Notificaciones Web'} ${!currentVal ? 'activadas' : 'desactivadas'}` });

            // Avisar al padre si se pasó la prop
            if (onStatusChange) onStatusChange();

        } catch (error) {
            // Si falla, revertimos al estado original
            setLocalConfig(event.config || []);
            showToast({ type: 'error', message: 'Error al actualizar configuración rápida' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="event-row" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            backgroundColor: 'white',
            borderRadius: '12px',
            border: '1px solid #f1f5f9',
            marginBottom: '0.75rem',
            transition: 'all 0.2s ease',
            gap: '1.5rem'
        }}>
            {/* Info */}
            <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em' }}>{event.codigo}</span>
                    {event.es_transaccional ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#8b5cf6', fontSize: '0.7rem', fontWeight: 700 }}>
                            <Zap size={12} /> DESTINATARIOS DINÁMICOS
                        </div>
                    ) : localConfig.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontSize: '0.7rem', fontWeight: 700 }}>
                            <CheckCircle2 size={12} /> CONFIGURADO
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#f59e0b', fontSize: '0.7rem', fontWeight: 700 }}>
                            <AlertCircle size={12} /> SIN DESTINATARIOS
                        </div>
                    )}
                </div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#334155' }}>{event.descripcion}</h4>
            </div>

            {/* Quick Toggles */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {/* Email Switch */}
                <div
                    onClick={() => !saving && toggleQuickChannel('email', hasEmail)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        backgroundColor: hasEmail ? '#f0fdf4' : '#f8fafc',
                        border: `1px solid ${hasEmail ? '#bbf7d0' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        opacity: saving ? 0.6 : 1,
                        transition: 'all 0.2s'
                    }}
                >
                    <Mail size={16} color={hasEmail ? '#16a34a' : '#94a3b8'} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: hasEmail ? '#166534' : '#64748b' }}>Email</span>
                    <div className={`switch-mini ${hasEmail ? 'active' : ''}`}></div>
                </div>

                {/* Web Switch */}
                <div
                    onClick={() => !saving && toggleQuickChannel('web', hasWeb)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        backgroundColor: hasWeb ? '#eff6ff' : '#f8fafc',
                        border: `1px solid ${hasWeb ? '#bfdbfe' : '#e2e8f0'}`,
                        cursor: 'pointer',
                        opacity: saving ? 0.6 : 1,
                        transition: 'all 0.2s'
                    }}
                >
                    <Bell size={16} color={hasWeb ? '#2563eb' : '#94a3b8'} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: hasWeb ? '#1e40af' : '#64748b' }}>Web</span>
                    <div className={`switch-mini ${hasWeb ? 'active' : ''}`}></div>
                </div>
            </div>

            {/* Config Button */}
            <button
                onClick={() => onOpenSettings(event)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.6rem 1rem',
                    backgroundColor: '#1e293b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
            >
                <Settings size={16} /> Configurar
            </button>

            <style>{`
                .event-row:hover {
                    border-color: #cbd5e1;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    transform: translateX(4px);
                }
                .switch-mini {
                    width: 24px;
                    height: 14px;
                    background-color: #cbd5e1;
                    border-radius: 10px;
                    position: relative;
                    transition: all 0.3s;
                }
                .switch-mini::after {
                    content: '';
                    position: absolute;
                    width: 10px;
                    height: 10px;
                    background-color: white;
                    border-radius: 50%;
                    top: 2px;
                    left: 2px;
                    transition: all 0.3s;
                }
                .switch-mini.active {
                    background-color: #3b82f6;
                }
                .switch-mini.active::after {
                    left: 12px;
                }
            `}</style>
        </div>
    );
};