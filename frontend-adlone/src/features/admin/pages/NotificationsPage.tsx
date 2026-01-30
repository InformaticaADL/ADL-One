import React, { useState } from 'react';
import { NotificationEventsPage } from './NotificationEventsPage';
import { NotificationRecipientsPage } from './NotificationRecipientsPage';

interface NotificationEvent {
    id_evento: number;
    codigo_evento: string;
    descripcion: string;
    asunto_template: string;
    modulo?: string;
}

interface Props {
    onBack?: () => void;
}

export const NotificationsPage: React.FC<Props> = ({ onBack }) => {
    const [selectedEvent, setSelectedEvent] = useState<NotificationEvent | null>(null);

    if (selectedEvent) {
        return (
            <NotificationRecipientsPage
                event={selectedEvent}
                onBack={() => setSelectedEvent(null)}
            />
        );
    }

    return (
        <NotificationEventsPage
            onBack={onBack}
            onSelectEvent={setSelectedEvent}
        />
    );
};
