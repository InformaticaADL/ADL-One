import React from 'react';
import { IconAlertTriangle, IconAlertCircle, IconInfoCircle, IconCircleCheck } from '@tabler/icons-react';
import { Alert, AlertTitle, AlertDescription } from './alert';

interface WorkflowAlertProps {
    type?: 'warning' | 'error' | 'info' | 'success';
    title: string;
    message: string;
}

const VARIANT_BY_TYPE = {
    warning: 'warning',
    error: 'destructive',
    info: 'info',
    success: 'success',
} as const;

const ICON_BY_TYPE = {
    warning: IconAlertTriangle,
    error: IconAlertCircle,
    info: IconInfoCircle,
    success: IconCircleCheck,
};

// Wrapper fino sobre el Alert de shadcn/ui — antes era una implementación
// propia con estilos inline y SVG a mano; mismas props (type/title/message)
// en los ~14 call sites, así que ninguno necesitó cambiar.
export const WorkflowAlert: React.FC<WorkflowAlertProps> = ({ type = 'warning', title, message }) => {
    const Icon = ICON_BY_TYPE[type];
    return (
        <Alert variant={VARIANT_BY_TYPE[type]}>
            <Icon />
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
};
