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
    // Igual que DynamicModule.links: si viene con ítems, el módulo se
    // renderiza como grupo desplegable en vez de como enlace plano (ver
    // Facturación, antes un sidebar propio de 230px dentro del módulo).
    links?: DynamicModuleLink[];
}

// Módulos con iconos de Tabler, fijos (no vienen del menú dinámico del backend).
export const FIXED_TOP_MODULES: FixedModule[] = [
    { label: 'Solicitudes', icon: IconClipboardList, id: 'solicitudes' },
    { label: 'Chat / Mensajes', icon: IconMessageCircle, id: 'chat' },
    {
        label: 'Facturación', icon: IconFileInvoice, id: 'facturacion', permission: 'FAC_ACCESO',
        links: [
            { id: 'fac-dashboard', label: 'Dashboard', permission: 'FAC_DASHBOARD' },
            { id: 'fac-procesar', label: 'Procesar', permission: 'FAC_PROCESAR' },
            { id: 'fac-prefacturas', label: 'Pre-Facturas', permission: 'FAC_PREFACTURAS_VER' },
            { id: 'fac-cotizaciones', label: 'Cotizaciones', permission: 'FAC_COTIZACIONES_VER' },
            { id: 'fac-ordenes-compra', label: 'Órdenes de Compra', permission: 'FAC_OC_REGISTRAR' },
            { id: 'fac-estado-cuenta', label: 'Estado de cuenta', permission: 'FAC_PREFACTURAS_VER' },
            { id: 'fac-configuracion', label: 'Configuración', permission: 'FAC_UF_ADMIN' },
        ],
    },
];
