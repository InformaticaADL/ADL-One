import React, { useEffect, useMemo, useState } from 'react';
import { formatearFecha } from '@/lib/fechas';
import { puestaMarchaService, TIPOS_PUESTA_MARCHA, type PuestaMarcha } from '../../services/puestaMarcha.service';
import { Estado, FilaKpis, Kpi, PorMes, Ranking, Tabla, Tarjeta } from './comun';
import { COLOR, agruparPorMes, contar, diasEntre, hoyIso } from './datos';

const nombreTipo = (t: string) => TIPOS_PUESTA_MARCHA.find((x) => x.value === t)?.label ?? t;

/** Puestas en marcha: cuántas, de qué tipo, cuánto tardan en firmarse y quién tiene firmas pendientes. */
export const DashboardPuestaMarcha: React.FC<{ onIr: () => void }> = ({ onIr }) => {
    const [datos, setDatos] = useState<PuestaMarcha[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        puestaMarchaService.listar()
            .then(setDatos)
            .catch(() => setError('No se pudieron cargar las puestas en marcha.'))
            .finally(() => setCargando(false));
    }, []);

    const r = useMemo(() => {
        const vigentes = datos.filter((p) => p.estado !== 'ANULADA');
        const aprobadas = vigentes.filter((p) => p.estado === 'APROBADA');
        const pendientes = vigentes.filter((p) => p.estado === 'PENDIENTE_FIRMA');
        // Días desde que se creó hasta la última de las dos firmas.
        const demoras = aprobadas
            .map((p) => {
                const fechas = [p.firmas?.TECNICA?.fecha, p.firmas?.CALIDAD?.fecha].filter(Boolean) as string[];
                const ultima = fechas.sort().at(-1);
                return diasEntre(p.fecha_creacion, ultima);
            })
            .filter((d): d is number => d !== null);
        const promedio = demoras.length ? Math.round((demoras.reduce((a, b) => a + b, 0) / demoras.length) * 10) / 10 : null;
        const faltaTecnica = pendientes.filter((p) => !p.firmas?.TECNICA?.firmada).length;
        const faltaCalidad = pendientes.filter((p) => !p.firmas?.CALIDAD?.firmada).length;
        return {
            total: vigentes.length,
            aprobadas: aprobadas.length,
            pendientes,
            anuladas: datos.length - vigentes.length,
            promedio,
            noCumple: vigentes.filter((p) => p.estado_recepcion === 'NO_CUMPLE').length,
            porMes: agruparPorMes(vigentes, (p) => p.fecha, (p) => (p.estado === 'APROBADA' ? 'aprobada' : 'pendiente')),
            porTipo: contar(vigentes, (p) => nombreTipo(p.tipo)),
            porSede: contar(vigentes, (p) => p.sede),
            faltaTecnica,
            faltaCalidad,
        };
    }, [datos]);

    return (
        <Estado cargando={cargando} error={error}>
            <FilaKpis>
                <Kpi label="Puestas en marcha" valor={r.total} onClick={onIr} />
                <Kpi label="Aprobadas" valor={r.aprobadas} tono="text-success" />
                <Kpi label="Pendientes de firma" valor={r.pendientes.length} tono="text-warning" detalle={`${r.faltaTecnica} sin firma Técnica · ${r.faltaCalidad} sin firma Calidad`} />
                <Kpi label="Días promedio hasta aprobar" valor={r.promedio ?? '—'} detalle="desde que se crea hasta la 2ª firma" />
                <Kpi label="Recepción no cumple" valor={r.noCumple} tono="text-destructive" />
            </FilaKpis>
            <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta titulo="Puestas en marcha por mes" subtitulo="Últimos 12 meses, según la fecha de la PM">
                    <PorMes datos={r.porMes} series={[{ key: 'aprobada', nombre: 'Aprobadas', color: COLOR.ok }, { key: 'pendiente', nombre: 'Pendientes de firma', color: COLOR.warn }]} />
                </Tarjeta>
                <Tarjeta titulo="Por tipo" subtitulo="Equipo nuevo, retorno, cambio de sede, reactivación, asignación">
                    <Ranking datos={r.porTipo} />
                </Tarjeta>
                <Tarjeta titulo="Por sede">
                    <Ranking datos={r.porSede} color={COLOR.muted} />
                </Tarjeta>
                <Tarjeta titulo="Esperando firma" subtitulo="Las más antiguas primero">
                    <Tabla
                        columnas={['Equipo', 'Creada', 'Días', 'Falta']}
                        filas={[...r.pendientes]
                            .sort((a, b) => a.fecha_creacion.localeCompare(b.fecha_creacion))
                            .slice(0, 10)
                            .map((p) => [
                                <span className="font-semibold">{p.codigo_equipo ?? '—'}</span>,
                                formatearFecha(p.fecha_creacion),
                                <span className="tabular-nums">{diasEntre(p.fecha_creacion, hoyIso()) ?? '—'}</span>,
                                [!p.firmas?.TECNICA?.firmada && 'Técnica', !p.firmas?.CALIDAD?.firmada && 'Calidad'].filter(Boolean).join(' y '),
                            ])}
                        vacio="No hay puestas en marcha esperando firma."
                    />
                </Tarjeta>
            </div>
        </Estado>
    );
};
