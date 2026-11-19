import React, { useEffect, useState } from 'react';
import { PageHeader } from '../../../components/layout/PageHeader';
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
            {/* Mismo encabezado que las demás pantallas de Gestión de Calidad (se acomoda solo en el celular). */}
            <div className="px-4 pt-4 md:px-6 md:pt-6">
                <PageHeader
                    title="Dashboard de Equipos"
                    subtitle="KPIs, gráficos y análisis del inventario de equipos de calidad."
                    onBack={onBack}
                    breadcrumbItems={[{ label: 'Gestión de Calidad', onClick: onBack }, { label: 'Dashboard de Equipos' }]}
                />
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
