import { useEffect, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavStore } from '../../../store/navStore';
import FacturacionDashboard from './FacturacionDashboard';
import FacturacionProcesar from './FacturacionProcesar';
import FacturacionPrefacturas from './FacturacionPrefacturas';
import FacturacionCotizaciones from './FacturacionCotizaciones';
import FacturacionBandejaOc from './FacturacionBandejaOc';
import FacturacionEstadoCuenta from './FacturacionEstadoCuenta';
import FacturacionConfiguracion from './FacturacionConfiguracion';

type Vista = 'fac-dashboard' | 'fac-procesar' | 'fac-prefacturas' | 'fac-cotizaciones' | 'fac-ordenes-compra' | 'fac-estado-cuenta' | 'fac-configuracion';

// Cada pestaña declara el permiso que su backend exige — debe calzar con
// sidebarModules.ts (FIXED_TOP_MODULES 'facturacion'.links), que es quien
// dibuja la navegación real ahora (sidebar principal, desplegable). Sin este
// chequeo acá también, el menú podría (por un bug de otro lado) ofrecer una
// pestaña cuyo backend igual responde 403.
const ITEMS: { key: Vista; permiso: string }[] = [
    { key: 'fac-dashboard', permiso: 'FAC_DASHBOARD' },
    { key: 'fac-procesar', permiso: 'FAC_PROCESAR' },
    { key: 'fac-prefacturas', permiso: 'FAC_PREFACTURAS_VER' },
    { key: 'fac-cotizaciones', permiso: 'FAC_COTIZACIONES_VER' },
    { key: 'fac-ordenes-compra', permiso: 'FAC_OC_REGISTRAR' },
    { key: 'fac-estado-cuenta', permiso: 'FAC_PREFACTURAS_VER' },
    { key: 'fac-configuracion', permiso: 'FAC_UF_ADMIN' },
];

const FacturacionModule: React.FC = () => {
    const { hasPermission } = useAuth();
    const { activeSubmodule, setActiveSubmodule } = useNavStore();
    // Solo las pestañas que el usuario puede realmente usar.
    const items = useMemo(() => ITEMS.filter((i) => hasPermission(i.permiso)), [hasPermission]);
    const primerPermitido = items[0]?.key;

    // Al entrar sin submódulo elegido (clic directo en "Facturación" en el
    // sidebar, sin desplegar) cae en la primera pestaña permitida — mismo
    // comportamiento que el estado inicial del `vista` local que reemplaza.
    useEffect(() => {
        if (!activeSubmodule && primerPermitido) setActiveSubmodule(primerPermitido);
    }, [activeSubmodule, primerPermitido, setActiveSubmodule]);

    if (items.length === 0) {
        return (
            <div className="shadcn-scope flex h-full items-center justify-center p-12 text-center text-sm text-muted-foreground">
                No tienes permisos para ninguna sección de Facturación.
            </div>
        );
    }

    const vista = (items.some((i) => i.key === activeSubmodule) ? activeSubmodule : primerPermitido) as Vista;

    return (
        <>
            {vista === 'fac-dashboard' && <FacturacionDashboard onNavigate={(v) => setActiveSubmodule(v)} />}
            {vista === 'fac-procesar' && <FacturacionProcesar />}
            {vista === 'fac-prefacturas' && <FacturacionPrefacturas />}
            {vista === 'fac-cotizaciones' && <FacturacionCotizaciones />}
            {vista === 'fac-ordenes-compra' && <FacturacionBandejaOc />}
            {vista === 'fac-estado-cuenta' && <FacturacionEstadoCuenta />}
            {vista === 'fac-configuracion' && <FacturacionConfiguracion />}
        </>
    );
};

export default FacturacionModule;
