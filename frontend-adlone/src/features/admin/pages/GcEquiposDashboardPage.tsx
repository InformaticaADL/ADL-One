import React, { useEffect, useState } from 'react';
import { IconArrowLeft, IconChartBar } from '@tabler/icons-react';
import { EquiposDashboard } from '../components/EquiposDashboard';
import { equipoService, type ResumenCalidad } from '../services/equipo.service';

interface Props {
    onBack: () => void;
}

export const GcEquiposDashboardPage: React.FC<Props> = ({ onBack }) => {
    const [resumen, setResumen] = useState<ResumenCalidad | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Vigencia y KPIs vienen calculados del backend, con las mismas reglas que la
    // revisión diaria (los dados de baja / fuera de servicio no cuentan como vencidos).
    useEffect(() => {
        equipoService.getResumenCalidad()
            .then(setResumen)
            .catch(() => setError('Error al cargar los equipos.'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="shadcn-scope flex h-64 items-center justify-center">
                <span className="text-muted-foreground text-sm">Cargando dashboard...</span>
            </div>
        );
    }

    if (error || !resumen) {
        return (
            <div className="shadcn-scope flex h-64 flex-col items-center justify-center gap-3">
                <span className="text-destructive text-sm">{error || 'Error al cargar los equipos.'}</span>
                <button onClick={onBack} className="text-sm text-primary underline">Volver</button>
            </div>
        );
    }

    return (
        <div className="shadcn-scope flex flex-col gap-0">
            <div className="flex items-center gap-3 px-4 pt-4 pb-2">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                    <IconArrowLeft size={16} />
                    Gestión de Calidad
                </button>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <div className="flex items-center gap-1.5">
                    <IconChartBar size={16} className="text-primary" />
                    <span className="text-sm font-medium">Dashboard de Equipos</span>
                </div>
            </div>
            <EquiposDashboard
                equipos={resumen.equipos}
                expiringCount={resumen.kpis.porVencer}
                expiredCount={resumen.kpis.vencidos}
                activeCount={resumen.kpis.activos}
                inactiveSamplerCount={resumen.kpis.sinAsignar}
            />
        </div>
    );
};
