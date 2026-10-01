import React, { useEffect, useMemo, useState } from 'react';
import {
    IconMail,
    IconCalendarStats,
    IconRoute,
    IconClock,
    IconCheck,
    IconDownload,
    IconAward,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PageHeader } from '../../../components/layout/PageHeader';
import { adminService } from '../../../services/admin.service';
import { trackingService, type HistorialDia } from '../../medio-ambiente/services/tracking.service';
import { colorPorMuestreador } from '../../medio-ambiente/utils/colorMuestreador';

interface Props {
    muestreador: any;
    onBack: () => void;
}

type Periodo = 'hoy' | 'mes' | 'anio' | 'rango';

interface Estadisticas {
    total: number;
    ejecutadas: number;
    pendientes: number;
    atrasadas: number;
    cumplimiento: number;
}

const getInitials = (name: string) =>
    (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function rangoDePeriodo(periodo: Periodo, desde: string, hasta: string): { desde: string; hasta: string } {
    const hoy = dayjs();
    switch (periodo) {
        case 'hoy':
            return { desde: hoy.format('YYYY-MM-DD'), hasta: hoy.format('YYYY-MM-DD') };
        case 'mes':
            return { desde: hoy.startOf('month').format('YYYY-MM-DD'), hasta: hoy.endOf('month').format('YYYY-MM-DD') };
        case 'anio':
            return { desde: hoy.startOf('year').format('YYYY-MM-DD'), hasta: hoy.format('YYYY-MM-DD') };
        case 'rango':
            return { desde, hasta };
    }
}

function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.round(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Descarga un CSV simple a partir de un array de objetos — sin librería: es
// una exportación puntual para el supervisor, no justifica sumar una
// dependencia (xlsx/exceljs) solo para esto.
function descargarCsv(nombreArchivo: string, filas: Record<string, any>[]) {
    if (filas.length === 0) return;
    const columnas = Object.keys(filas[0]);
    const escapar = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lineas = [
        columnas.join(','),
        ...filas.map((f) => columnas.map((c) => escapar(f[c])).join(',')),
    ];
    // BOM para que Excel reconozca UTF-8 (tildes/ñ) al abrir el CSV directo.
    const blob = new Blob(['﻿' + lineas.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export const MuestreadorPerfilView: React.FC<Props> = ({ muestreador, onBack }) => {
    const [periodo, setPeriodo] = useState<Periodo>('mes');
    const [rangoDesde, setRangoDesde] = useState(dayjs().subtract(30, 'day').format('YYYY-MM-DD'));
    const [rangoHasta, setRangoHasta] = useState(dayjs().format('YYYY-MM-DD'));
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Estadisticas | null>(null);
    const [historial, setHistorial] = useState<HistorialDia[]>([]);
    const [agenda, setAgenda] = useState<any[]>([]);
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [competencias, setCompetencias] = useState<any[]>([]);

    const { desde, hasta } = useMemo(() => rangoDePeriodo(periodo, rangoDesde, rangoHasta), [periodo, rangoDesde, rangoHasta]);

    useEffect(() => {
        let cancelado = false;
        setLoading(true);
        Promise.all([
            adminService.getEstadisticasMuestreador(muestreador.id_muestreador, desde, hasta),
            trackingService.getHistorial(desde, hasta, muestreador.id_muestreador),
            adminService.getAgendaMuestreador(muestreador.id_muestreador, desde, hasta),
        ])
            .then(([statsRes, historialRes, agendaRes]) => {
                if (cancelado) return;
                setStats(statsRes);
                setHistorial(historialRes);
                setAgenda(agendaRes);
            })
            .finally(() => { if (!cancelado) setLoading(false); });
        return () => { cancelado = true; };
    }, [muestreador.id_muestreador, desde, hasta]);

    useEffect(() => {
        adminService.getDocumentosMuestreador(muestreador.id_muestreador).then(setDocumentos).catch(() => {});
        adminService.getCompetenciasMuestreador(muestreador.id_muestreador).then(
            (rows: any[]) => setCompetencias(rows.filter((r) => r.activo === 'S'))
        ).catch(() => {});
    }, [muestreador.id_muestreador]);

    const totalesHistorial = useMemo(() => historial.reduce(
        (acc, d) => ({
            horas: acc.horas + (d.horas_trabajadas_minutos || 0),
            km: acc.km + (d.km_recorridos || 0),
            jornadas: acc.jornadas + (d.num_jornadas || 0),
        }),
        { horas: 0, km: 0, jornadas: 0 }
    ), [historial]);

    const complianceColor = !stats ? 'text-muted-foreground' : stats.cumplimiento >= 80 ? 'text-success' : stats.cumplimiento >= 50 ? 'text-warning' : 'text-destructive';

    const exportarAgenda = () => {
        descargarCsv(
            `agenda_${muestreador.nombre_muestreador}_${desde}_a_${hasta}.csv`,
            agenda.map((a) => ({
                Ficha: a.correlativo_ficha,
                Correlativo: a.frecuencia_correlativo,
                Rol: a.rol,
                Fecha_Instalacion: a.fecha_muestreo ? dayjs(a.fecha_muestreo).format('DD-MM-YYYY') : '',
                Fecha_Retiro: a.fecha_retiro && dayjs(a.fecha_retiro).year() > 1900 ? dayjs(a.fecha_retiro).format('DD-MM-YYYY') : '',
                Cliente: a.cliente,
                Centro: a.centro,
                Objetivo: a.objetivo,
                Estado: a.estado_caso || '',
            }))
        );
    };

    const exportarRendimiento = () => {
        descargarCsv(
            `rendimiento_${muestreador.nombre_muestreador}_${desde}_a_${hasta}.csv`,
            historial.map((d) => ({
                Dia: dayjs(d.dia).format('DD-MM-YYYY'),
                Jornadas: d.num_jornadas,
                Horas_Trabajadas: formatearMinutos(d.horas_trabajadas_minutos),
                Km_Recorridos: d.km_recorridos.toFixed(1),
                Fichas_Completadas: d.fichas_completadas,
                Fichas_Total: d.fichas_total,
            }))
        );
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Perfil del Muestreador"
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Muestreadores', onClick: onBack },
                    { label: muestreador.nombre_muestreador },
                ]}
            />

            {/* Encabezado de perfil */}
            <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16 shrink-0">
                        <AvatarFallback
                            className="text-lg font-bold text-white"
                            style={{ backgroundColor: colorPorMuestreador(muestreador.id_muestreador) }}
                        >
                            {getInitials(muestreador.nombre_muestreador)}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold text-foreground">{muestreador.nombre_muestreador}</h2>
                            <Badge variant={muestreador.habilitado === 'S' ? 'success' : 'destructive'}>
                                {muestreador.habilitado === 'S' ? 'Activo' : 'Inactivo'}
                            </Badge>
                            {muestreador.en_entrenamiento === 'S' && <Badge variant="warning">En entrenamiento</Badge>}
                        </div>
                        {muestreador.correo_electronico && (
                            <span className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                                <IconMail size={14} /> {muestreador.correo_electronico}
                            </span>
                        )}
                        {competencias.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {competencias.map((c) => (
                                    <Badge key={c.id_competencia} variant="outline" className="gap-1 text-[11px]">
                                        <IconAward size={11} /> {c.nombre_competencia}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Selector de periodo */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 rounded-lg bg-muted p-1">
                        {([
                            { label: 'Hoy', value: 'hoy' as const },
                            { label: 'Mes', value: 'mes' as const },
                            { label: 'Año', value: 'anio' as const },
                            { label: 'Rango', value: 'rango' as const },
                        ]).map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setPeriodo(opt.value)}
                                className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${periodo === opt.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                    {periodo === 'rango' && (
                        <div className="flex items-center gap-1.5">
                            <input type="date" className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={rangoDesde} max={rangoHasta} onChange={(e) => setRangoDesde(e.target.value)} />
                            <span className="text-xs text-muted-foreground">a</span>
                            <input type="date" className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={rangoHasta} min={rangoDesde} max={dayjs().format('YYYY-MM-DD')} onChange={(e) => setRangoHasta(e.target.value)} />
                        </div>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="flex h-40 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            ) : (
                <>
                    {/* Stat cards */}
                    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        <StatMini icon={<IconCalendarStats size={16} />} label="Asignadas" value={stats?.total ?? 0} />
                        <StatMini icon={<IconCheck size={16} />} label="Ejecutadas" value={stats?.ejecutadas ?? 0} tone="success" />
                        <StatMini icon={<IconClock size={16} />} label="Pendientes" value={stats?.pendientes ?? 0} tone="warning" />
                        <StatMini icon={<IconClock size={16} />} label="No realizadas" value={stats?.atrasadas ?? 0} tone="destructive" />
                        <StatMini icon={<IconRoute size={16} />} label="Km recorridos" value={totalesHistorial.km.toFixed(1)} />
                        <StatMini icon={<IconClock size={16} />} label="Horas trabajadas" value={formatearMinutos(totalesHistorial.horas)} />
                    </div>

                    {/* Cumplimiento */}
                    {stats && stats.total > 0 && (
                        <div className="mb-6 rounded-xl border border-border bg-card p-4">
                            <div className="mb-2 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Tasa de cumplimiento</p>
                                    <p className="text-xs text-muted-foreground">{stats.ejecutadas} de {stats.total} fichas completadas en el periodo</p>
                                </div>
                                <span className={`text-xl font-bold ${complianceColor}`}>{stats.cumplimiento}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <div
                                    className={`h-full ${stats.cumplimiento >= 80 ? 'bg-success' : stats.cumplimiento >= 50 ? 'bg-warning' : 'bg-destructive'}`}
                                    style={{ width: `${stats.cumplimiento}%` }}
                                />
                            </div>
                        </div>
                    )}

                    <Tabs defaultValue="rendimiento">
                        <TabsList>
                            <TabsTrigger value="rendimiento">Rendimiento</TabsTrigger>
                            <TabsTrigger value="agenda">Agenda ({agenda.length})</TabsTrigger>
                            <TabsTrigger value="documentos">Documentos ({documentos.length})</TabsTrigger>
                        </TabsList>

                        <TabsContent value="rendimiento">
                            <div className="mb-2 flex justify-end">
                                <Button variant="outline" size="sm" onClick={exportarRendimiento} disabled={historial.length === 0}>
                                    <IconDownload size={14} /> Exportar CSV
                                </Button>
                            </div>
                            <div className="overflow-hidden rounded-xl border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Día</TableHead>
                                            <TableHead className="text-center">Jornadas</TableHead>
                                            <TableHead className="text-center">Horas</TableHead>
                                            <TableHead className="text-center">Km</TableHead>
                                            <TableHead className="text-center">Fichas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historial.length === 0 ? (
                                            <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Sin jornadas en este periodo.</TableCell></TableRow>
                                        ) : historial.map((d) => (
                                            <TableRow key={d.dia}>
                                                <TableCell className="whitespace-nowrap text-sm">{dayjs(d.dia).format('DD/MM/YYYY')}</TableCell>
                                                <TableCell className="text-center text-sm">{d.num_jornadas}</TableCell>
                                                <TableCell className="text-center text-sm">{formatearMinutos(d.horas_trabajadas_minutos)}</TableCell>
                                                <TableCell className="text-center text-sm">{d.km_recorridos.toFixed(1)}</TableCell>
                                                <TableCell className="text-center text-sm">{d.fichas_completadas}/{d.fichas_total}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="agenda">
                            <div className="mb-2 flex justify-end">
                                <Button variant="outline" size="sm" onClick={exportarAgenda} disabled={agenda.length === 0}>
                                    <IconDownload size={14} /> Exportar CSV
                                </Button>
                            </div>
                            <div className="overflow-hidden rounded-xl border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ficha</TableHead>
                                            <TableHead>Rol</TableHead>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Cliente</TableHead>
                                            <TableHead>Centro</TableHead>
                                            <TableHead>Objetivo</TableHead>
                                            <TableHead>Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {agenda.length === 0 ? (
                                            <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Sin fichas agendadas en este periodo.</TableCell></TableRow>
                                        ) : agenda.map((a) => (
                                            <TableRow key={`${a.id_agendamam}`}>
                                                <TableCell className="font-medium text-primary">{a.correlativo_ficha}</TableCell>
                                                <TableCell><Badge variant="outline">{a.rol}</Badge></TableCell>
                                                <TableCell className="whitespace-nowrap text-sm">{dayjs(a.fecha_muestreo).format('DD/MM/YYYY')}</TableCell>
                                                <TableCell className="max-w-[160px] truncate text-sm" title={a.cliente}>{a.cliente || '-'}</TableCell>
                                                <TableCell className="max-w-[160px] truncate text-sm" title={a.centro}>{a.centro || '-'}</TableCell>
                                                <TableCell className="max-w-[140px] truncate text-sm" title={a.objetivo}>{a.objetivo || '-'}</TableCell>
                                                <TableCell className="text-sm">{a.estado_caso || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>

                        <TabsContent value="documentos">
                            {documentos.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">Sin documentos cargados.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {documentos.map((d) => (
                                        <a
                                            key={d.id_documento}
                                            href={d.ruta_archivo || d.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted"
                                        >
                                            <span className="text-sm font-medium text-foreground">{d.nombre_documento}</span>
                                            <span className="text-xs text-muted-foreground">{d.fecha_subida ? dayjs(d.fecha_subida).format('DD/MM/YYYY') : ''}</span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </>
            )}
        </div>
    );
};

function StatMini({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string | number; tone?: 'success' | 'warning' | 'destructive' }) {
    const toneClass = tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
    return (
        <div className="rounded-xl border border-border bg-card p-3">
            <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
                {icon}
                <span className="text-[11px] font-medium uppercase">{label}</span>
            </div>
            <p className={`text-xl font-bold ${toneClass}`}>{value}</p>
        </div>
    );
}
