import { useState, useMemo } from 'react';
import { ConfigProvider, Menu } from 'antd';
import esES from 'antd/locale/es_ES';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import {
    IconLayoutDashboard, IconListCheck, IconFileInvoice, IconFileDollar, IconSettings,
    IconClipboardCheck, IconReceipt2,
} from '@tabler/icons-react';

dayjs.locale('es');
import { useAuth } from '../../../contexts/AuthContext';
import FacturacionDashboard from './FacturacionDashboard';
import FacturacionProcesar from './FacturacionProcesar';
import FacturacionPrefacturas from './FacturacionPrefacturas';
import FacturacionCotizaciones from './FacturacionCotizaciones';
import FacturacionBandejaOc from './FacturacionBandejaOc';
import FacturacionEstadoCuenta from './FacturacionEstadoCuenta';
import FacturacionConfiguracion from './FacturacionConfiguracion';

type Vista = 'dashboard' | 'procesar' | 'prefacturas' | 'cotizaciones' | 'ordenes-compra' | 'estado-cuenta' | 'configuracion';

const C = {
    // Todo el módulo va sobre blanco: la separación la dan los bordes finos y
    // el espaciado, no fondos grises.
    primary: '#1677ff', border: '#f0f0f0', bg: '#ffffff', bgLayout: '#ffffff',
    text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)',
};

const CSS = `
.adl-fac-root { display:flex; height:100%; overflow:hidden; background:${C.bg}; }
.adl-fac-nav { width:230px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid ${C.border}; background:${C.bg}; }
.adl-fac-navhead { padding:20px 20px 12px; }
.adl-fac-navtitle { margin:0; font-size:19px; font-weight:700; color:${C.text}; letter-spacing:-.2px; }
.adl-fac-navsub { margin:2px 0 0; font-size:12px; color:${C.textSec}; }
.adl-fac-content { flex:1; min-width:0; overflow-y:auto; background:${C.bgLayout}; }
`;

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
            <div style={{ padding: 48, textAlign: 'center', color: C.textSec }}>
                No tienes permisos para ninguna sección de Facturación.
            </div>
        );
    }

    return (
        <ConfigProvider locale={esES} theme={{ token: { colorPrimary: C.primary, borderRadius: 8 } }}>
            <style>{CSS}</style>
            <div className="adl-fac-root">
                <nav className="adl-fac-nav">
                    <div className="adl-fac-navhead">
                        <h1 className="adl-fac-navtitle">Facturación</h1>
                        <p className="adl-fac-navsub">Medio Ambiente</p>
                    </div>
                    <Menu
                        mode="inline"
                        selectedKeys={[vista]}
                        items={items}
                        onClick={(e) => setVista(e.key as Vista)}
                        style={{ border: 'none', padding: '4px 8px' }}
                    />
                </nav>
                <div className="adl-fac-content">
                    {vista === 'dashboard' && <FacturacionDashboard onNavigate={(v) => setVista(v as Vista)} />}
                    {vista === 'procesar' && <FacturacionProcesar />}
                    {vista === 'prefacturas' && <FacturacionPrefacturas />}
                    {vista === 'cotizaciones' && <FacturacionCotizaciones />}
                    {vista === 'ordenes-compra' && <FacturacionBandejaOc />}
                    {vista === 'estado-cuenta' && <FacturacionEstadoCuenta />}
                    {vista === 'configuracion' && <FacturacionConfiguracion />}
                </div>
            </div>
        </ConfigProvider>
    );
};

export default FacturacionModule;
