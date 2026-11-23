import React, { useEffect, useMemo, useState } from 'react';
import { formatearFecha } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import { verificacionCaudalService, type VerificacionCaudal } from '../../services/verificacionCaudal.service';
import { Estado, FilaKpis, Kpi, PorMes, Ranking, Tabla, Tarjeta } from './comun';
import { COLOR, agruparPorMes, hoyIso, sumarDias } from './datos';

/** Verificación de sondas de caudal (OI-FoGe-30): resultados, sondas que no cumplen y próximas verificaciones. */
export const DashboardCaudal: React.FC<{ onIr: () => void }> = ({ onIr }) => {
    const [datos, setDatos] = useState<VerificacionCaudal[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        verificacionCaudalService.listar()
            .then(setDatos)
            .catch(() => setError('No se pudieron cargar las verificaciones de caudal.'))
            .finally(() => setCargando(false));
    }, []);

    const r = useMemo(() => {
        const vigentes = datos.filter((v) => v.estado !== 'ANULADA');
        const firmadas = vigentes.filter((v) => v.estado === 'FIRMADA');
        // Última verificación firmada de cada sonda: es la que dice si hoy cumple.
        const ultimaPorSonda = new Map<number, VerificacionCaudal>();
        for (const v of firmadas) {
            const prev = ultimaPorSonda.get(v.id_equipo);
            if (!prev || v.fecha_verificacion > prev.fecha_verificacion) ultimaPorSonda.set(v.id_equipo, v);
        }
        const ultimas = [...ultimaPorSonda.values()];
        const cumplen = firmadas.filter((v) => v.cumple === true).length;
        const hoy = hoyIso();
        const en30 = sumarDias(30);
        return {
            firmadas: firmadas.length,
            borrador: vigentes.filter((v) => v.estado === 'BORRADOR').length,
            pctCumple: firmadas.length ? Math.round((cumplen / firmadas.length) * 100) : null,
            sondas: ultimas.length,
            noCumplenHoy: ultimas.filter((v) => v.cumple === false),
            proximas: ultimas.filter((v) => v.fecha_proxima && v.fecha_proxima.slice(0, 10) <= en30).sort((a, b) => String(a.fecha_proxima).localeCompare(String(b.fecha_proxima))),
            vencidas: ultimas.filter((v) => v.fecha_proxima && v.fecha_proxima.slice(0, 10) < hoy).length,
            porMes: agruparPorMes(firmadas, (v) => v.fecha_verificacion, (v) => (v.cumple === false ? 'no' : 'si')),
            desviacion: ultimas
                .filter((v) => v.desviacion_pct !== null)
                .map((v) => ({ name: v.codigo_equipo ?? `#${v.id_equipo}`, value: Math.round(Math.abs(Number(v.desviacion_pct)) * 10) / 10 }))
                .sort((a, b) => b.value - a.value)
                .slice(0, 12),
        };
    }, [datos]);

    return (
        <Estado cargando={cargando} error={error}>
            <FilaKpis>
                <Kpi label="Verificaciones firmadas" valor={r.firmadas} onClick={onIr} />
                <Kpi label="Cumplen" valor={r.pctCumple === null ? '—' : `${r.pctCumple}%`} tono="text-success" detalle="de las firmadas" />
                <Kpi label="Sondas que hoy no cumplen" valor={r.noCumplenHoy.length} tono="text-destructive" detalle={`de ${r.sondas} sondas verificadas`} />
                <Kpi label="Próxima verificación vencida" valor={r.vencidas} tono="text-destructive" />
                <Kpi label="En borrador" valor={r.borrador} tono="text-muted-foreground" />
            </FilaKpis>
            <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta titulo="Verificaciones por mes" subtitulo="Firmadas en los últimos 12 meses">
                    <PorMes datos={r.porMes} series={[{ key: 'si', nombre: 'Cumple', color: COLOR.ok }, { key: 'no', nombre: 'No cumple', color: COLOR.bad }]} />
                </Tarjeta>
                <Tarjeta titulo="Desviación por sonda (%)" subtitulo="Última verificación de cada sonda, mayor desviación primero">
                    <Ranking datos={r.desviacion} color={COLOR.warn} nombre="Desviación %" vacio="Sin verificaciones firmadas." />
                </Tarjeta>
                <Tarjeta titulo="Próximas verificaciones" subtitulo="Vencidas o dentro de los próximos 30 días">
                    <Tabla
                        columnas={['Sonda', 'Última', 'Próxima', 'Resultado']}
                        filas={r.proximas.slice(0, 10).map((v) => [
                            <span className="font-semibold">{v.codigo_equipo ?? '—'}</span>,
                            formatearFecha(v.fecha_verificacion),
                            <span className={cn('tabular-nums', String(v.fecha_proxima).slice(0, 10) < hoyIso() ? 'text-destructive' : 'text-warning')}>{formatearFecha(v.fecha_proxima)}</span>,
                            v.cumple === false ? <span className="text-destructive">No cumple</span> : 'Cumple',
                        ])}
                        vacio="Ninguna sonda vence en los próximos 30 días."
                    />
                </Tarjeta>
                <Tarjeta titulo="Sondas que no cumplen" subtitulo="Según su última verificación firmada">
                    <Tabla
                        columnas={['Sonda', 'Fecha', 'Desviación', 'Grado']}
                        filas={r.noCumplenHoy.map((v) => [
                            <span className="font-semibold">{v.codigo_equipo ?? '—'}</span>,
                            formatearFecha(v.fecha_verificacion),
                            v.desviacion_pct === null ? '—' : `${v.desviacion_pct}%`,
                            v.grado ?? '—',
                        ])}
                        vacio="Todas las sondas verificadas cumplen."
                    />
                </Tarjeta>
            </div>
        </Estado>
    );
};
