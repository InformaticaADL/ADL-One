import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Props {
    permission: string | string[];
    children: React.ReactNode;
    fallback?: React.ReactNode; // Optional content to show if permission is denied
}

export const ProtectedContent: React.FC<Props> = ({ permission, children, fallback = null }) => {
    const { hasPermission, isAuthenticating, user } = useAuth();

    // Si estamos en proceso de login o el usuario aún no se ha cargado pero estamos autenticados,
    // mostramos nada o un cargador en lugar del fallback de "No tiene permisos"
    if (isAuthenticating || (!user && localStorage.getItem('token'))) {
        return null;
    }

    if (!hasPermission(permission)) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};
