import React, { useEffect, useState } from 'react';
import { useNavStore } from '../../../store/navStore';
import { Badge } from '@/components/ui/badge';
import {
    IconLayoutDashboard,
    IconCalculator,
    IconFileInvoice,
    IconReceipt2,
    IconFileExport,
} from '@tabler/icons-react';
import FacturacionSaludDashboard from './FacturacionSaludDashboard';
import FacturacionSaludProcesar from './FacturacionSaludProcesar';
import FacturacionSaludPrefacturas from './FacturacionSaludPrefacturas';
import FacturacionSaludOtrasVentas from './FacturacionSaludOtrasVentas';
import FacturacionSaludDte from './FacturacionSaludDte';

export type VistaSalud =
    | 'fs-dashboard'
    | 'fs-procesar'
    | 'fs-prefacturas'
    | 'fs-otras-ventas'
    | 'fs-dte';

const TABS: { key: VistaSalud; label: string; icon: typeof IconLayoutDashboard }[] = [
    { key: 'fs-dashboard', label: 'Resumen', icon: IconLayoutDashboard },
    { key: 'fs-procesar', label: 'Valorizar y facturar', icon: IconCalculator },
    { key: 'fs-prefacturas', label: 'Facturas', icon: IconFileInvoice },
    { key: 'fs-otras-ventas', label: 'Otras ventas y notas', icon: IconReceipt2 },
    { key: 'fs-dte', label: 'Archivos para el emisor', icon: IconFileExport },
];

const FacturacionSaludModule: React.FC = () => {
    const { activeSubmodule, setActiveSubmodule } = useNavStore();
    const [programaElegido, setProgramaElegido] = useState<number>(4);
    // Factura que debe abrir la vista «Facturas» (por ejemplo, la que se acaba de crear)
    const [facturaInicial, setFacturaInicial] = useState<number | undefined>(undefined);

    useEffect(() => {
        if (!activeSubmodule || !TABS.some((t) => t.key === activeSubmodule)) {
            setActiveSubmodule('fs-dashboard');
        }
    }, [activeSubmodule, setActiveSubmodule]);

    const vista: VistaSalud = TABS.some((t) => t.key === activeSubmodule) ? (activeSubmodule as VistaSalud) : 'fs-dashboard';

    const navegar = (v: string, idFactura?: number) => {
        setFacturaInicial(idFactura);
        setActiveSubmodule(v);
    };

    return (
        <div className="shadcn-scope w-full p-4 pb-10 md:p-6 md:px-8 md:pb-12">
            <div className="mb-6 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h1 className="m-0 text-xl font-semibold text-foreground">Facturación área Salud</h1>
                        <p className="m-0 mt-1 text-sm text-muted-foreground">Valoriza los casos, crea y mantiene las facturas y prepara los archivos para el emisor electrónico.</p>
                    </div>
                    <Badge variant="outline">Base local de pruebas</Badge>
                </div>

                <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const activa = vista === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => navegar(tab.key)}
                                className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                                    activa ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Icon size={16} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {vista === 'fs-dashboard' && <FacturacionSaludDashboard onNavigate={navegar} onSelectPrograma={setProgramaElegido} />}
            {vista === 'fs-procesar' && <FacturacionSaludProcesar initialPrograma={programaElegido} onNavigate={navegar} />}
            {vista === 'fs-prefacturas' && <FacturacionSaludPrefacturas key={facturaInicial ?? 'sin'} idInicial={facturaInicial} />}
            {vista === 'fs-otras-ventas' && <FacturacionSaludOtrasVentas />}
            {vista === 'fs-dte' && <FacturacionSaludDte />}
        </div>
    );
};

export default FacturacionSaludModule;
