import React from 'react';
import { Tag } from 'antd';

interface StatusBadgeProps {
    status: string;
    size?: 'xs' | 'sm' | 'md' | 'lg';
}

// Tamaño de fuente/alto por `size` — Tag de antd no tiene una prop de tamaño
// propia, así que se aplica como estilo.
const SIZE_STYLE: Record<NonNullable<StatusBadgeProps['size']>, React.CSSProperties> = {
    xs: { fontSize: 10, lineHeight: '16px', padding: '0 6px' },
    sm: { fontSize: 11, lineHeight: '18px', padding: '0 7px' },
    md: { fontSize: 12, lineHeight: '20px', padding: '0 8px' },
    lg: { fontSize: 13, lineHeight: '22px', padding: '0 10px' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    size = 'sm',
}) => {
    const getStatusConfig = (s: string): { color: string; label: string } => {
        const normalized = s.toUpperCase();
        switch (normalized) {
            case 'PENDIENTE':
            case 'PENDIENTE_TECNICA':
            case 'PENDIENTE_CALIDAD':
                return { color: 'orange', label: 'Pendiente' };
            case 'ACEPTADA':
            case 'APROBADA':
                return { color: 'cyan', label: 'Aceptada' };
            case 'REALIZADA':
                return { color: 'green', label: 'Realizada' };
            case 'APROBADO':
            case 'COMPLETADO':
            case 'EXITOSO':
            case 'CONCLUIDO':
                return { color: 'green', label: 'Aprobado' };
            case 'RECHAZADA':
            case 'RECHAZADO':
            case 'ERROR':
            case 'RECHAZADO_TECNICA':
                return { color: 'red', label: 'Rechazado' };
            case 'CANCELADA':
            case 'CANCELADO':
                return { color: 'default', label: 'Cancelada' };
            case 'EN_REVISION':
            case 'EN_REVISION_TECNICA':
            case 'PROCESANDO':
            case 'EJECUCIÓN':
            case 'EN_CURSO':
                return { color: 'blue', label: 'En Revisión' };
            case 'DERIVADO':
            case 'DERIVACION':
                return { color: 'geekblue', label: 'Derivado' };
            case 'OBSERVADO':
                return { color: 'gold', label: 'Observado' };
            default:
                return { color: 'default', label: s };
        }
    };

    const config = getStatusConfig(status);

    return (
        <Tag
            color={config.color}
            style={{
                ...SIZE_STYLE[size],
                textTransform: 'uppercase',
                fontWeight: 700,
                marginInlineEnd: 0,
            }}
        >
            {config.label}
        </Tag>
    );
};
