import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
    permission: string;
    children: React.ReactNode;
    fallback?: React.ReactNode; // Optional content to show if permission is denied
}

export const ProtectedContent: React.FC<Props> = ({ permission, children, fallback = null }) => {
    const { hasPermission } = useAuth();

    if (!hasPermission(permission)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
