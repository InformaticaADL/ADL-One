import React, { useEffect, useState, useMemo } from 'react';
import { IconArrowLeft, IconChartBar } from '@tabler/icons-react';
import { EquiposDashboard } from '../components/EquiposDashboard';
import type { Equipo } from '../services/equipo.service';
import apiClient from '../../../config/axios.config';

interface Props {
    onBack: () => void;
}

export const GcEquiposDashboardPage: React.FC<Props> = ({ onBack }) => {
    const [equipos, setEquipos] = useState<Equipo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchEquipos = async () => {
            try {
                setLoading(true);
                const res = await apiClient.get('/api/admin/equipos', { params: { limit: 5000, page: 1 } });
                const data = res.data?.data?.equipos ?? res.data?.data ?? [];
                setEquipos(Array.isArray(data) ? data : []);
            } catch (err) {
                setError('Error al cargar los equipos.');
            } finally {
                setLoading(false);
            }
        };
        fetchEquipos();
    }, []);

    const hoy = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
    const en30 = useMemo(() => { const d = new Date(hoy); d.setDate(d.getDate() + 30); return d; }, [hoy]);

    const parseVigencia = (v?: string | null): Date | null => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
    };

    const expiringCount = useMemo(() => equipos.filter(e => {
        const d = parseVigencia(e.vigencia || (e as any).siguiente_verificacion);
        return d != null && d >= hoy && d <= en30;
    }).length, [equipos, hoy, en30]);

    const expiredCount = useMemo(() => equipos.filter(e => {
        const d = parseVigencia(e.vigencia || (e as any).siguiente_verificacion);
        return d != null && d < hoy;
    }).length, [equipos, hoy]);

    const activeCount = useMemo(() => equipos.filter(e => e.estado === 'Activo').length, [equipos]);
    const inactiveSamplerCount = useMemo(() => equipos.filter(e => !e.id_muestreador).length, [equipos]);

    if (loading) {
        return (
            <div className="shadcn-scope flex h-64 items-center justify-center">
                <span className="text-muted-foreground text-sm">Cargando dashboard...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="shadcn-scope flex h-64 flex-col items-center justify-center gap-3">
                <span className="text-destructive text-sm">{error}</span>
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
                equipos={equipos}
                expiringCount={expiringCount}
                expiredCount={expiredCount}
                activeCount={activeCount}
                inactiveSamplerCount={inactiveSamplerCount}
            />
        </div>
    );
};
