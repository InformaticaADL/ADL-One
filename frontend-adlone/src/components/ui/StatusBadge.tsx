import React from 'react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
    status: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASS: Record<NonNullable<StatusBadgeProps['size']>, string> = {
    xs: 'text-[10px] leading-4 px-1.5',
    sm: 'text-[11px] leading-[18px] px-1.5',
    md: 'text-xs leading-5 px-2',
    lg: 'text-[13px] leading-[22px] px-2.5',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    size = 'sm',
}) => {
    const getStatusConfig = (s: string): { variant: NonNullable<BadgeProps['variant']>; label: string } => {
        const normalized = s.toUpperCase();
        switch (normalized) {
            case 'PENDIENTE':
            case 'PENDIENTE_TECNICA':
            case 'PENDIENTE_CALIDAD':
                return { variant: 'warning', label: 'Pendiente' };
            case 'ACEPTADA':
            case 'APROBADA':
                return { variant: 'default', label: 'Aceptada' };
            case 'REALIZADA':
                return { variant: 'success', label: 'Realizada' };
            case 'APROBADO':
            case 'COMPLETADO':
            case 'EXITOSO':
            case 'CONCLUIDO':
                return { variant: 'success', label: 'Aprobado' };
            case 'RECHAZADA':
            case 'RECHAZADO':
            case 'ERROR':
            case 'RECHAZADO_TECNICA':
                return { variant: 'destructive', label: 'Rechazado' };
            case 'CANCELADA':
            case 'CANCELADO':
                return { variant: 'secondary', label: 'Cancelada' };
            case 'EN_REVISION':
            case 'EN_REVISION_TECNICA':
            case 'PROCESANDO':
            case 'EJECUCIÓN':
            case 'EN_CURSO':
                return { variant: 'default', label: 'En Revisión' };
            case 'DERIVADO':
            case 'DERIVACION':
                return { variant: 'outline', label: 'Derivado' };
            case 'OBSERVADO':
                return { variant: 'warning', label: 'Observado' };
            default:
                return { variant: 'outline', label: s };
        }
    };

    const config = getStatusConfig(status);

    return (
        <Badge variant={config.variant} className={cn('font-bold uppercase', SIZE_CLASS[size])}>
            {config.label}
        </Badge>
    );
};
