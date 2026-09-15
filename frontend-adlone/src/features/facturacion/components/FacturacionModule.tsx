import { useState, useMemo } from 'react';
import {
    IconLayoutDashboard, IconListCheck, IconFileInvoice, IconFileDollar, IconSettings,
    IconClipboardCheck, IconReceipt2,
} from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { useAuth } from '../../../contexts/AuthContext';
import FacturacionDashboard from './FacturacionDashboard';
import FacturacionProcesar from './FacturacionProcesar';
import FacturacionPrefacturas from './FacturacionPrefacturas';
import FacturacionCotizaciones from './FacturacionCotizaciones';
import FacturacionBandejaOc from './FacturacionBandejaOc';
import FacturacionEstadoCuenta from './FacturacionEstadoCuenta';
import FacturacionConfiguracion from './FacturacionConfiguracion';

type Vista = 'dashboard' | 'procesar' | 'prefacturas' | 'cotizaciones' | 'ordenes-compra' | 'estado-cuenta' | 'configuracion';

// Cada pestaña declara el permiso que su backend exige. Sin esto el menú
// ofrece páginas que después responden 403: el usuario ve la sección, entra y
// se encuentra con una pantalla vacía o un error, sin saber que simplemente no
// tiene el permiso.
const ITEMS = [
    { key: 'dashboard', icon: <IconLayoutDashboard size={17} />, label: 'Dashboard', permiso: 'FAC_DASHBOARD' },
    { key: 'procesar', icon: <IconListCheck size={17} />, label: 'Procesar', permiso: 'FAC_PROCESAR' },
    { key: 'prefacturas', icon: <IconFileInvoice size={17} />, label: 'Pre-Facturas', permiso: 'FAC_PREFACTURAS_VER' },
    { key: 'cotizaciones', icon: <IconFileDollar size={17} />, label: 'Cotizaciones', permiso: 'FAC_COTIZACIONES_VER' },
    { key: 'ordenes-compra', icon: <IconClipboardCheck size={17} />, label: 'Órdenes de Compra', permiso: 'FAC_OC_REGISTRAR' },
    { key: 'estado-cuenta', icon: <IconReceipt2 size={17} />, label: 'Estado de cuenta', permiso: 'FAC_PREFACTURAS_VER' },
    { key: 'configuracion', icon: <IconSettings size={17} />, label: 'Configuración', permiso: 'FAC_UF_ADMIN' },
];

const FacturacionModule: React.FC = () => {
    const { hasPermission } = useAuth();
    // Solo las secciones que el usuario puede realmente usar.
    const items = useMemo(() => ITEMS.filter((i) => hasPermission(i.permiso)), [hasPermission]);
    const [vista, setVista] = useState<Vista>(() => (ITEMS.find((i) => hasPermission(i.permiso))?.key || 'dashboard') as Vista);

    if (items.length === 0) {
        return (
            <div className="shadcn-scope flex h-full items-center justify-center p-12 text-center text-sm text-muted-foreground">
                No tienes permisos para ninguna sección de Facturación.
            </div>
        );
    }

    return (
        <div className="shadcn-scope flex h-full overflow-hidden bg-background">
            <nav className="flex w-[230px] shrink-0 flex-col border-r border-border bg-background">
                <div className="px-5 pb-3 pt-5">
                    <h1 className="m-0 text-[19px] font-bold tracking-tight text-foreground">Facturación</h1>
                    <p className="m-0 mt-0.5 text-xs text-muted-foreground">Medio Ambiente</p>
                </div>
                <div className="flex flex-col gap-0.5 px-2">
                    {items.map((item) => (
                        <button
                            key={item.key}
                            type="button"
                            onClick={() => setVista(item.key as Vista)}
                            className={cn(
                                'flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                                vista === item.key
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto bg-background">
                {vista === 'dashboard' && <FacturacionDashboard onNavigate={(v) => setVista(v as Vista)} />}
                {vista === 'procesar' && <FacturacionProcesar />}
                {vista === 'prefacturas' && <FacturacionPrefacturas />}
                {vista === 'cotizaciones' && <FacturacionCotizaciones />}
                {vista === 'ordenes-compra' && <FacturacionBandejaOc />}
                {vista === 'estado-cuenta' && <FacturacionEstadoCuenta />}
                {vista === 'configuracion' && <FacturacionConfiguracion />}
            </div>
        </div>
    );
};

export default FacturacionModule;
