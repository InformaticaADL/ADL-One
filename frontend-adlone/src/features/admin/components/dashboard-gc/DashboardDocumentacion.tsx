import React, { useEffect, useMemo, useState } from 'react';
import { formatearFecha } from '@/lib/fechas';
import type { Equipo } from '../../services/equipo.service';
import type { FichaArchivo, TipoFichaGuardada } from '../../services/fichasEquipo.service';
import { revisionDocumentalService, type RevisionesDocumentales } from '../../services/revisionDocumental.service';
import { Estado, FilaKpis, Kpi, Ranking, Tabla, Tarjeta } from './comun';
import { COLOR, cargarArchivo } from './datos';

const NOMBRE_TIPO: Record<TipoFichaGuardada, string> = {
    tecnica: 'Ficha técnica (OI-FoGe-22)',
    historial: 'Historial (OI-FoGe-24)',
    entrega: 'Ficha de entrega (OI-FoGe-36)',
    recepcion: 'Recepción',
    caudal: 'Verificación caudal (OI-FoGe-30)',
};

/** Estado de la documentación: fichas guardadas, anuladas, equipos sin ficha técnica y revisión de formularios. */
export const DashboardDocumentacion: React.FC<{ equipos: Equipo[]; onIrArchivo: () => void; onIrRevision: () => void }> = ({ equipos, onIrArchivo, onIrRevision }) => {
    const [fichas, setFichas] = useState<FichaArchivo[]>([]);
    const [revision, setRevision] = useState<RevisionesDocumentales | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([
            cargarArchivo({ estado: 'TODOS' }),
            revisionDocumentalService.listar().catch(() => null),
        ])
            .then(([f, rev]) => { setFichas(f); setRevision(rev); })
            .catch(() => setError('No se pudo leer el archivo de fichas.'))
            .finally(() => setCargando(false));
    }, []);

    const r = useMemo(() => {
        const vigentes = fichas.filter((f) => f.estado === 'VIGENTE');
        const conTecnica = new Set(vigentes.filter((f) => f.tipo === 'tecnica').map((f) => Number(f.id_equipo)));
        const enUso = equipos.filter((e) => e.estado !== 'Dado de Baja');
        const sinTecnica = enUso.filter((e) => !conTecnica.has(Number(e.id_equipo)));
        const vigenteAnual = (revision?.revisiones ?? []).find((x) => x.vigente) ?? null;
        return {
            vigentes: vigentes.length,
            anuladas: fichas.length - vigentes.length,
            conFirmas: vigentes.length ? Math.round((vigentes.filter((f) => f.con_firmas).length / vigentes.length) * 100) : null,
            sinTecnica,
            pctTecnica: enUso.length ? Math.round(((enUso.length - sinTecnica.length) / enUso.length) * 100) : null,
            porTipo: Object.entries(NOMBRE_TIPO).map(([k, name]) => ({ name, value: vigentes.filter((f) => f.tipo === k).length })).filter((x) => x.value > 0),
            sinTecnicaPorSede: (() => {
                const m = new Map<string, number>();
                for (const e of sinTecnica) m.set(e.ubicacion || 'Sin sede', (m.get(e.ubicacion || 'Sin sede') || 0) + 1);
                return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
            })(),
            docs: revision?.documentos ?? [],
            vigenteAnual,
        };
    }, [fichas, equipos, revision]);

    return (
        <Estado cargando={cargando} error={error}>
            <FilaKpis>
                <Kpi label="Fichas vigentes" valor={r.vigentes} onClick={onIrArchivo} />
                <Kpi label="Con firmas" valor={r.conFirmas === null ? '—' : `${r.conFirmas}%`} tono="text-success" detalle="de las vigentes" />
                <Kpi label="Fichas anuladas" valor={r.anuladas} tono="text-muted-foreground" detalle="incluye las obsoletas" />
                <Kpi label="Equipos sin ficha técnica" valor={r.sinTecnica.length} tono="text-warning" detalle={r.pctTecnica === null ? undefined : `${r.pctTecnica}% de los equipos la tiene`} />
                <Kpi label="Revisión anual vigente" valor={r.vigenteAnual ? String(r.vigenteAnual.anio) : '—'} detalle={r.vigenteAnual ? `desde ${formatearFecha(r.vigenteAnual.fecha_inicio)} · ${r.docs.length} formularios` : undefined} onClick={onIrRevision} />
            </FilaKpis>
            <div className="grid gap-4 lg:grid-cols-2">
                <Tarjeta titulo="Fichas vigentes por tipo">
                    <Ranking datos={r.porTipo} nombre="Fichas" vacio="Todavía no hay fichas guardadas." />
                </Tarjeta>
                <Tarjeta titulo="Equipos sin ficha técnica, por sede" subtitulo="Sin contar dados de baja">
                    <Ranking datos={r.sinTecnicaPorSede} color={COLOR.warn} nombre="Sin ficha técnica" vacio="Todos los equipos tienen ficha técnica." />
                </Tarjeta>
                <Tarjeta titulo="Formularios controlados" subtitulo="Lo que sale hoy en el encabezado de cada PDF">
                    <Tabla
                        columnas={['Código', 'Formulario', 'Versión', 'Vigencia', 'Revisión']}
                        filas={r.docs.map((d) => [
                            <span className="font-semibold">{d.codigo}</span>,
                            d.nombre,
                            d.encabezado?.version ?? d.version,
                            d.encabezado?.vigencia ?? formatearFecha(d.fecha_vigencia),
                            d.encabezado?.revision ?? (d.fecha_revision ? formatearFecha(d.fecha_revision) : 'Anual'),
                        ])}
                        vacio="No hay formularios controlados registrados."
                    />
                </Tarjeta>
                <Tarjeta titulo="Equipos sin ficha técnica" subtitulo="Los primeros 12">
                    <Tabla
                        columnas={['Código', 'Equipo', 'Sede', 'Estado']}
                        filas={r.sinTecnica.slice(0, 12).map((e) => [<span className="font-semibold">{e.codigo}</span>, e.nombre, e.ubicacion ?? '—', e.estado])}
                        vacio="Todos los equipos tienen ficha técnica."
                    />
                </Tarjeta>
            </div>
        </Estado>
    );
};
