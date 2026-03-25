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
            case 'PENDIENTE_TECNICA':
            case 'PENDIENTE_CALIDAD':
                return { color: 'orange', label: 'Pendiente' };
            case 'ACEPTADA':
            case 'APROBADA':
                return { color: 'teal', label: 'Aceptada' };
            case 'REALIZADA':
                return { color: 'green', label: 'Realizada' };
            case 'APROBADO':
            case 'COMPLETADO':
            case 'EXITOSO':
            case 'CONCLUIDO':
                return { color: 'green', label: 'Aprobado' };
            case 'RECHAZADA':
            case 'RECHAZADO':
            case 'CANCELADO':
            case 'ERROR':
            case 'RECHAZADO_TECNICA':
                return { color: 'red', label: 'Rechazado' };
            case 'EN_REVISION':
            case 'EN_REVISION_TECNICA':
            case 'PROCESANDO':
            case 'EJECUCIÓN':
            case 'EN_CURSO':
                return { color: 'blue', label: 'En Revisión' };
            case 'DERIVADO':
            case 'DERIVACION':
                return { color: 'indigo', label: 'Derivado' };
            case 'OBSERVADO':
                return { color: 'yellow', label: 'Observado' };
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
