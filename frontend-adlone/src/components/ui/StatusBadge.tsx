import React from 'react';
import { Badge, type MantineColor } from '@mantine/core';

interface StatusBadgeProps {
    status: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    variant?: 'filled' | 'light' | 'outline' | 'dot';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
    status, 
    size = 'sm', 
    variant = 'light' 
}) => {
    const getStatusConfig = (s: string): { color: MantineColor; label: string } => {
        const normalized = s.toUpperCase();
        switch (normalized) {
            case 'PENDIENTE':
                return { color: 'orange', label: 'Pendiente' };
            case 'APROBADO':
            case 'COMPLETADO':
            case 'EXITOSO':
                return { color: 'green', label: 'Aprobado' };
            case 'RECHAZADO':
            case 'CANCELADO':
            case 'ERROR':
                return { color: 'red', label: 'Rechazado' };
            case 'EN_REVISION':
            case 'PROCESANDO':
            case 'EJECUCIÓN':
            case 'EN_CURSO':
                return { color: 'blue', label: 'En Revisión' };
            default:
                return { color: 'gray', label: s };
        }
    };

    const config = getStatusConfig(status);

    return (
        <Badge 
            color={config.color} 
            size={size} 
            variant={variant}
            tt="uppercase"
        >
            {config.label}
        </Badge>
    );
};
