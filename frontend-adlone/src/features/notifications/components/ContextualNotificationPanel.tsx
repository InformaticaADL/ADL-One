import React from 'react';
import { useNotificationStore } from '../../../store/notificationStore';
import type { Notification } from '../../../store/notificationStore';
import './ContextualNotificationPanel.css';

interface ContextualNotificationPanelProps {
    area: string;
}

const ContextualNotificationPanel: React.FC<ContextualNotificationPanelProps> = ({ area }) => {
    const notifications = useNotificationStore((s) => s.notifications);
    const markAsRead = useNotificationStore((s) => s.markAsRead);

    const areaNotifications = React.useMemo(() => 
        notifications.filter((n: Notification) => n.area === area && !n.leido),
        [notifications, area]
    );

    if (areaNotifications.length === 0) return null;

    return (
        <div className="contextual-v2-container">
            <div className="v2-context-header">
                <div className="v2-context-info">
                    <span className="v2-context-pulse"></span>
                    <h3>Avisos: {area.replace(/_/g, ' ')}</h3>
                </div>
                <span className="v2-context-count">{areaNotifications.length}</span>
            </div>
            <div className="v2-context-list">
                {areaNotifications.map((notif) => (
                    <div key={notif.id_notificacion} className={`v2-context-card type-${notif.tipo.toLowerCase()}`}>
                        <div className="v2-card-indicator"></div>
                        <div className="v2-card-content">
                            <div className="v2-card-title">{notif.titulo}</div>
                            <div className="v2-card-text">{notif.mensaje}</div>
                        </div>
                        <button 
                            className="v2-card-close" 
                            onClick={() => markAsRead(notif.id_notificacion)}
                        >
                            ✕
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ContextualNotificationPanel;
