import React from 'react';
import { NotificationHub } from './NotificationHub';

interface Props {
    onBack?: () => void;
}

export const NotificationsPage: React.FC<Props> = ({ onBack }) => {
    return (
        <NotificationHub onBack={onBack} />
    );
};
