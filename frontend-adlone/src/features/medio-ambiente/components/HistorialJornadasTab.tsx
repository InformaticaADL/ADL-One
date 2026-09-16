import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconSearch, IconFileSpreadsheet } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { trackingService, type HistorialDia } from '../services/tracking.service';
import { HistorialDiaReplayModal } from './HistorialDiaReplayModal';

function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.floor(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Escapa para CSV: envuelve en comillas y duplica comillas internas solo si
// el valor las necesita (coma, comilla o salto de línea) — así los nombres
// normales quedan legibles sin comillas de más.
function celdaCSV(valor: string | number): string {
    const s = String(valor);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function exportarHistorialCSV(dias: HistorialDia[]) {
    const encabezado = ['Fecha', 'Muestreador', 'Tiempo de ruta (min)', 'Km recorridos', 'Fichas completadas', 'Fichas totales', 'Jornadas'];
    const filas = dias.map((d) => [
        d.dia,
        d.nombre_muestreador,
        Math.round(d.horas_trabajadas_minutos),
        d.km_recorridos.toFixed(2),
        d.fichas_completadas,
        d.fichas_total,
        d.num_jornadas,
    ]);
    // Prefijo BOM (U+FEFF): sin esto, Excel en Windows abre el CSV con
    // tildes/ñ rotas (asume Windows-1252 en vez de UTF-8) — el BOM le indica
    // que lea el archivo como UTF-8.
    const contenido = '﻿' + [encabezado, ...filas].map((fila) => fila.map(celdaCSV).join(',')).join('\n');
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `historial_jornadas_${dayjs().format('YYYY-MM-DD')}.csv`);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
}

interface ResumenMuestreador {
    id_muestreador: number;
    nombre_muestreador: string;
    dias: number;
    minutos: number;
    km: number;
    fichasCompletadas: number;
    fichasTotal: number;
}

function calcularResumenPorMuestreador(dias: HistorialDia[]): ResumenMuestreador[] {
    const porMuestreador = new Map<number, ResumenMuestreador>();
    for (const d of dias) {
        if (!porMuestreador.has(d.id_muestreador)) {
            porMuestreador.set(d.id_muestreador, {
                id_muestreador: d.id_muestreador,
                nombre_muestreador: d.nombre_muestreador,
                dias: 0,
                minutos: 0,
                km: 0,
                fichasCompletadas: 0,
                fichasTotal: 0,
            });
        }
        const acc = porMuestreador.get(d.id_muestreador)!;
        acc.dias += 1;
        acc.minutos += d.horas_trabajadas_minutos;
        acc.km += d.km_recorridos;
        acc.fichasCompletadas += d.fichas_completadas;
        acc.fichasTotal += d.fichas_total;
    }
    return [...porMuestreador.values()].sort((a, b) => b.minutos - a.minutos);
}

// Por defecto, últimos 7 días — vista rápida de la semana. El supervisor
// ajusta el rango manualmente si necesita algo más amplio (ej. rendición
// mensual).
const HOY = dayjs();
const HACE_7_DIAS = HOY.subtract(6, 'day');

export function HistorialJornadasTab() {
    const [fechaDesde, setFechaDesde] = useState<string>(HACE_7_DIAS.format('YYYY-MM-DD'));
    const [fechaHasta, setFechaHasta] = useState<string>(HOY.format('YYYY-MM-DD'));
    const [busqueda, setBusqueda] = useState('');
    const [dias, setDias] = useState<HistorialDia[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [diaSeleccionado, setDiaSeleccionado] = useState<HistorialDia | null>(null);

    // Guard de carrera: si el usuario cambia de fecha rápido (dos requests en
    // vuelo), sin esto podía ganar la que responde último, no la que se pidió
    // último — dejando en pantalla el resultado de un rango que ya no es el
    // seleccionado.
    const solicitudActual = useRef(0);
    useEffect(() => {
        if (!fechaDesde || !fechaHasta) return;
        const idSolicitud = ++solicitudActual.current;
        setLoading(true);
        setError(null);
        trackingService
            .getHistorial(fechaDesde, fechaHasta)
            .then((resultado) => {
                if (idSolicitud !== solicitudActual.current) return;
                setDias(resultado);
            })
            .catch(() => {
                if (idSolicitud !== solicitudActual.current) return;
                setError('No se pudo cargar el historial de jornadas.');
            })
            .finally(() => {
                if (idSolicitud !== solicitudActual.current) return;
                setLoading(false);
            });
    }, [fechaDesde, fechaHasta]);

    const diasFiltrados = useMemo(
        () => dias.filter((d) => d.nombre_muestreador.toLowerCase().includes(busqueda.toLowerCase())),
        [dias, busqueda]
    );

    const resumenPorMuestreador = useMemo(() => calcularResumenPorMuestreador(diasFiltrados), [diasFiltrados]);

    return (
        <div className="shadcn-scope flex h-full flex-col p-4">
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <Field label="Desde">
                    {/* DatePicker no soporta min/maxDate (a diferencia del antd.DatePicker
                        original) — se valida el rango al cambiar en vez de deshabilitar
                        días en el calendario, para no permitir "Desde" posterior a "Hasta". */}
                    <DatePicker
                        value={fechaDesde}
                        onChange={(val) => { if (!val || !fechaHasta || val <= fechaHasta) setFechaDesde(val); }}
                        className="w-[150px]"
                    />
                </Field>
                <Field label="Hasta">
                    <DatePicker
                        value={fechaHasta}
                        onChange={(val) => {
                            if (!val) { setFechaHasta(val); return; }
                            if (fechaDesde && val < fechaDesde) return;
                            if (val > HOY.format('YYYY-MM-DD')) return;
                            setFechaHasta(val);
                        }}
                        className="w-[150px]"
                    />
                </Field>
                <Field label="Muestreador">
                    <div className="relative">
                        <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre..."
                            className="w-[220px] pl-8"
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>
                </Field>
                <Button variant="outline" disabled={diasFiltrados.length === 0} onClick={() => exportarHistorialCSV(diasFiltrados)}>
                    <IconFileSpreadsheet size={14} />
                    Exportar CSV
                </Button>
            </div>

            {!loading && !error && resumenPorMuestreador.length > 0 && (
                <Card className="mb-4 p-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">
                        Resumen del período por muestreador
                    </p>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2">
                        {resumenPorMuestreador.map((r) => (
                            <div key={r.id_muestreador} className="flex flex-nowrap items-center justify-between gap-2">
                                <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-foreground">{r.nombre_muestreador}</span>
                                <div className="flex flex-nowrap gap-1.5">
                                    <Badge variant="default">{formatearMinutos(r.minutos)}</Badge>
                                    <Badge variant="secondary">{r.km.toFixed(1)} km</Badge>
                                    <Badge variant={r.fichasTotal > 0 && r.fichasCompletadas === r.fichasTotal ? 'success' : 'outline'}>
                                        {r.fichasCompletadas}/{r.fichasTotal}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {loading && (
                <div className="flex flex-1 items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-1 items-center justify-center">
                    <span className="text-destructive">{error}</span>
                </div>
            )}

            {!loading && !error && diasFiltrados.length === 0 && (
                <div className="flex flex-1 items-center justify-center">
                    <span className="text-sm text-muted-foreground">Sin jornadas registradas en este rango.</span>
                </div>
            )}

            {!loading && !error && diasFiltrados.length > 0 && (
                <Card className="flex flex-1 flex-col overflow-hidden p-0">
                    <div className="flex-1 overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Muestreador</TableHead>
                                    <TableHead>Tiempo de ruta</TableHead>
                                    <TableHead>Km recorridos</TableHead>
                                    <TableHead>Fichas</TableHead>
                                    <TableHead>Jornadas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diasFiltrados.map((d) => {
                                    const sinNingunaCompletada = d.fichas_total > 0 && d.fichas_completadas === 0;
                                    const completa = d.fichas_total > 0 && d.fichas_completadas === d.fichas_total;
                                    return (
                                        <TableRow
                                            key={`${d.id_muestreador}|${d.dia}`}
                                            className={cn('cursor-pointer', sinNingunaCompletada && 'bg-destructive/5')}
                                            onClick={() => setDiaSeleccionado(d)}
                                        >
                                            <TableCell>{dayjs(d.dia).format('DD/MM/YYYY')}</TableCell>
                                            <TableCell>{d.nombre_muestreador}</TableCell>
                                            <TableCell>{formatearMinutos(d.horas_trabajadas_minutos)}</TableCell>
                                            <TableCell>{d.km_recorridos.toFixed(1)} km</TableCell>
                                            <TableCell>
                                                <Badge variant={sinNingunaCompletada ? 'destructive' : completa ? 'success' : 'default'}>
                                                    {d.fichas_completadas}/{d.fichas_total}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{d.num_jornadas > 1 ? `${d.num_jornadas} tramos` : '1 tramo'}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            )}

            <HistorialDiaReplayModal
                opened={diaSeleccionado !== null}
                onClose={() => setDiaSeleccionado(null)}
                idMuestreador={diaSeleccionado?.id_muestreador ?? null}
                nombreMuestreador={diaSeleccionado?.nombre_muestreador ?? ''}
                dia={diaSeleccionado?.dia ?? null}
            />
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}
