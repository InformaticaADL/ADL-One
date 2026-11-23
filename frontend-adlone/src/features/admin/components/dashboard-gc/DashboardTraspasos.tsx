import React, { useEffect, useMemo, useState } from 'react';
import { formatearFecha } from '@/lib/fechas';
import type { FichaArchivo } from '../../services/fichasEquipo.service';
import { Estado, FilaKpis, Kpi, PorMes, Ranking, Tabla, Tarjeta } from './comun';
import { COLOR, agruparPorMes, cargarArchivo, contar, sumarDias } from './datos';

/** Traspasos de equipos: fichas de entrega (OI-FoGe-36) y de recepción guardadas en el archivo. */
export const DashboardTraspasos: React.FC<{ onIr: () => void }> = ({ onIr }) => {
    const [entregas, setEntregas] = useState<FichaArchivo[]>([]);
    const [recepciones, setRecepciones] = useState<FichaArchivo[]>([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([cargarArchivo({ tipo: 'entrega' }), cargarArchivo({ tipo: 'recepcion' })])
            .then(([e, r]) => { setEntregas(e); setRecepciones(r); })
            .catch(() => setError('No se pudo leer el archivo de fichas.'))
            .finally(() => setCargando(false));
    }, []);

    const r = useMemo(() => {
        const hace30 = sumarDias(-30);
        const todas = [...entregas.map((f) => ({ ...f, clase: 'entrega' })), ...recepciones.map((f) => ({ ...f, clase: 'recepcion' }))];
        return {
            entregas: entregas.length,
            entregas30: entregas.filter((f) => String(f.fecha_documento).slice(0, 10) >= hace30).length,
            sinFirmas: entregas.filter((f) => !f.con_firmas),
            recepciones: recepciones.length,
            equipos: new Set(entregas.map((f) => f.id_equipo).filter(Boolean)).size,
            porMes: agruparPorMes(todas, (f) => f.fecha_documento, (f) => f.clase),
            porSede: contar(entregas, (f) => f.sede),
            porUsuario: contar(entregas, (f) => f.nombre_usuario, 10),
            recientes: [...entregas].sort((a, b) => String(b.fecha_documento).localeCompare(String(a.fecha_documento))).slice(0, 10),
        };
    }, [entregas, recepciones]);

    return (
        <Estado cargando={cargando} error={error}>
            <FilaKpis>
                <Kpi label="Fichas de entrega" valor={r.entregas} onClick={onIr} />
                <Kpi label="Entregas últimos 30 días" valor={r.entregas30} tono="text-success" />
                <Kpi label="Entregas sin firmas" valor={r.sinFirmas.length} tono="text-warning" detalle="guardadas sin las 3 firmas" />
                <Kpi label="Fichas de recepción" valor={r.recepciones} />
                <Kpi label="Equipos traspasados" valor={r.equipos} detalle="distintos, con al menos una entrega" />
            </FilaKpis>
            <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta titulo="Entregas y recepciones por mes" subtitulo="Últimos 12 meses, según la fecha del documento">
                    <PorMes datos={r.porMes} series={[{ key: 'entrega', nombre: 'Entregas', color: COLOR.main }, { key: 'recepcion', nombre: 'Recepciones', color: COLOR.ok }]} />
                </Tarjeta>
                <Tarjeta titulo="Entregas por sede">
                    <Ranking datos={r.porSede} nombre="Entregas" />
                </Tarjeta>
                <Tarjeta titulo="Quién registra las entregas" subtitulo="Usuario que guardó la ficha">
                    <Ranking datos={r.porUsuario} color={COLOR.muted} nombre="Entregas" />
                </Tarjeta>
                <Tarjeta titulo="Últimas entregas">
                    <Tabla
                        columnas={['Equipo', 'Sede', 'Fecha', 'Firmas']}
                        filas={r.recientes.map((f) => [
                            <span className="font-semibold">{f.codigo_equipo ?? '—'}</span>,
                            f.sede ?? '—',
                            formatearFecha(f.fecha_documento),
                            f.con_firmas ? <span className="text-success">Firmada</span> : <span className="text-warning">Sin firmas</span>,
                        ])}
                        vacio="Todavía no hay fichas de entrega guardadas."
                    />
                </Tarjeta>
            </div>
        </Estado>
    );
};
