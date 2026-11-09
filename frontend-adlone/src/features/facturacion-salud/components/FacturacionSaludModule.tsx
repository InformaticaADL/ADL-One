import React, { useEffect, useState } from 'react';
import { useNavStore } from '../../../store/navStore';
import { Badge } from '@/components/ui/badge';
import {
    IconLayoutDashboard,
    IconCalculator,
    IconFileInvoice,
    IconReceipt2,
    IconFileExport,
    IconDatabase,
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
    { key: 'fs-dashboard', label: 'Dashboard Salud', icon: IconLayoutDashboard },
    { key: 'fs-procesar', label: '1. Pre-Facturación y Valorización', icon: IconCalculator },
    { key: 'fs-prefacturas', label: '2. Bandeja Pre-Facturas (OI/OD/Excel)', icon: IconFileInvoice },
    { key: 'fs-otras-ventas', label: '3. Otras Ventas y Notas (NC/ND)', icon: IconReceipt2 },
    { key: 'fs-dte', label: '4. Exportación DTE (35 Columnas)', icon: IconFileExport },
];

const FacturacionSaludModule: React.FC = () => {
    const { activeSubmodule, setActiveSubmodule } = useNavStore();
    const [selectedPrograma, setSelectedPrograma] = useState<number>(4);

    useEffect(() => {
        if (!activeSubmodule || !TABS.some((t) => t.key === activeSubmodule)) {
            setActiveSubmodule('fs-dashboard');
        }
    }, [activeSubmodule, setActiveSubmodule]);

    const vista: VistaSalud = TABS.some((t) => t.key === activeSubmodule)
        ? (activeSubmodule as VistaSalud)
        : 'fs-dashboard';

    return (
        <div className="shadcn-scope w-full p-4 pb-10 md:p-6 md:px-8 md:pb-12">
            {/* Banner Superior de Seguridad de Conexión Local y Navegación */}
            <div className="mb-5 rounded-xl border border-border bg-card p-3.5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600">
                            <IconDatabase size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="m-0 text-base font-bold text-foreground md:text-lg">
                                    Facturación Área Salud (ADLSoft Replica)
                                </h1>
                                <Badge variant="success" className="font-mono text-[11px]">
                                    SQL Local: localhost:1433 → LaboratorioADL
                                </Badge>
                            </div>
                            <p className="m-0 text-xs text-muted-foreground">
                                Conexión estrictamente local para pruebas y validación funcional (aislada de producción)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Pestañas del Módulo */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = vista === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveSubmodule(tab.key)}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                                    active
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                            >
                                <Icon size={15} />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Contenido de la Vista Activa */}
            {vista === 'fs-dashboard' && (
                <FacturacionSaludDashboard
                    onNavigate={(v) => setActiveSubmodule(v)}
                    onSelectPrograma={(prog) => setSelectedPrograma(prog)}
                />
            )}
            {vista === 'fs-procesar' && (
                <FacturacionSaludProcesar
                    initialPrograma={selectedPrograma}
                    onNavigate={(v) => setActiveSubmodule(v)}
                />
            )}
            {vista === 'fs-prefacturas' && <FacturacionSaludPrefacturas />}
            {vista === 'fs-otras-ventas' && <FacturacionSaludOtrasVentas />}
            {vista === 'fs-dte' && <FacturacionSaludDte />}
        </div>
    );
};

export default FacturacionSaludModule;

