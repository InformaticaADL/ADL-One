import {
    IconMessageCircle,
    IconFileInvoice,
    IconClipboardList,
} from '@tabler/icons-react';

export interface DynamicModuleLink {
    id: string;
    label: string;
    permission?: string | string[];
}

export interface DynamicModule {
    id: string;
    label: string;
    icon: string;
    group?: 'unidades' | 'gestion';
    permission?: string | string[];
    links?: DynamicModuleLink[];
}

export interface FixedModule {
    id: string;
    label: string;
    icon: typeof IconMessageCircle;
    permission?: string;
}

// Módulos con iconos de Tabler, fijos (no vienen del menú dinámico del backend).
export const FIXED_TOP_MODULES: FixedModule[] = [
    { label: 'Solicitudes', icon: IconClipboardList, id: 'solicitudes' },
    { label: 'Chat / Mensajes', icon: IconMessageCircle, id: 'chat' },
    { label: 'Facturación', icon: IconFileInvoice, id: 'facturacion', permission: 'FAC_ACCESO' },
];
