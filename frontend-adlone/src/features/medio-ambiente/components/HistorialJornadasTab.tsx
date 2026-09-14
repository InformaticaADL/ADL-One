import { useEffect, useMemo, useRef, useState } from 'react';
import { Typography, Input, DatePicker, Spin, Tag, Button, Card, Table } from 'antd';
import { IconSearch, IconFileSpreadsheet } from '@tabler/icons-react';
import dayjs, { Dayjs } from 'dayjs';
import { trackingService, type HistorialDia } from '../services/tracking.service';
import { HistorialDiaReplayModal } from './HistorialDiaReplayModal';

const { Text } = Typography;

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
    const [fechaDesde, setFechaDesde] = useState<Dayjs | null>(HACE_7_DIAS);
    const [fechaHasta, setFechaHasta] = useState<Dayjs | null>(HOY);
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
            .getHistorial(fechaDesde.format('YYYY-MM-DD'), fechaHasta.format('YYYY-MM-DD'))
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

    const columns = [
        { title: 'Fecha', dataIndex: 'dia', key: 'dia', render: (v: string) => dayjs(v).format('DD/MM/YYYY') },
        { title: 'Muestreador', dataIndex: 'nombre_muestreador', key: 'nombre_muestreador' },
        { title: 'Tiempo de ruta', key: 'tiempo', render: (_: unknown, d: HistorialDia) => formatearMinutos(d.horas_trabajadas_minutos) },
        { title: 'Km recorridos', key: 'km', render: (_: unknown, d: HistorialDia) => `${d.km_recorridos.toFixed(1)} km` },
        {
            title: 'Fichas', key: 'fichas', render: (_: unknown, d: HistorialDia) => {
                const sinNingunaCompletada = d.fichas_total > 0 && d.fichas_completadas === 0;
                return (
                    <Tag color={sinNingunaCompletada ? 'red' : (d.fichas_total > 0 && d.fichas_completadas === d.fichas_total ? 'green' : 'blue')}>
                        {d.fichas_completadas}/{d.fichas_total}
                    </Tag>
                );
            }
        },
        { title: 'Jornadas', key: 'jornadas', render: (_: unknown, d: HistorialDia) => (d.num_jornadas > 1 ? `${d.num_jornadas} tramos` : '1 tramo') },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap' }}>
                <Field label="Desde">
                    <DatePicker
                        value={fechaDesde}
                        onChange={(val) => setFechaDesde(val)}
                        format="DD/MM/YYYY"
                        maxDate={fechaHasta ?? undefined}
                        style={{ width: 150 }}
                    />
                </Field>
                <Field label="Hasta">
                    <DatePicker
                        value={fechaHasta}
                        onChange={(val) => setFechaHasta(val)}
                        format="DD/MM/YYYY"
                        minDate={fechaDesde ?? undefined}
                        maxDate={dayjs()}
                        style={{ width: 150 }}
                    />
                </Field>
                <Field label="Muestreador">
                    <Input
                        placeholder="Buscar por nombre..."
                        prefix={<IconSearch size={14} style={{ color: 'var(--app-text-secondary)' }} />}
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        style={{ width: 220 }}
                    />
                </Field>
                <Button
                    icon={<IconFileSpreadsheet size={14} />}
                    disabled={diasFiltrados.length === 0}
                    onClick={() => exportarHistorialCSV(diasFiltrados)}
                >
                    Exportar CSV
                </Button>
            </div>

            {!loading && !error && resumenPorMuestreador.length > 0 && (
                <Card size="small" style={{ marginBottom: 16 }}>
                    <Text strong type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                        Resumen del período por muestreador
                    </Text>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
                        {resumenPorMuestreador.map((r) => (
                            <div key={r.id_muestreador} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                                <Text style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre_muestreador}</Text>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                                    <Tag color="blue">{formatearMinutos(r.minutos)}</Tag>
                                    <Tag color="purple">{r.km.toFixed(1)} km</Tag>
                                    <Tag color={r.fichasTotal > 0 && r.fichasCompletadas === r.fichasTotal ? 'green' : 'default'}>
                                        {r.fichasCompletadas}/{r.fichasTotal}
                                    </Tag>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {loading && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin />
                </div>
            )}

            {!loading && error && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="danger">{error}</Text>
                </div>
            )}

            {!loading && !error && diasFiltrados.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Sin jornadas registradas en este rango.</Text>
                </div>
            )}

            {!loading && !error && diasFiltrados.length > 0 && (
                <Card size="small" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }} styles={{ body: { padding: 0, flex: 1, overflow: 'auto' } }}>
                    <Table
                        rowKey={(d) => `${d.id_muestreador}|${d.dia}`}
                        columns={columns}
                        dataSource={diasFiltrados}
                        pagination={false}
                        size="small"
                        onRow={(d) => ({
                            onClick: () => setDiaSeleccionado(d),
                            style: {
                                cursor: 'pointer',
                                backgroundColor: (d.fichas_total > 0 && d.fichas_completadas === 0) ? 'rgba(224,49,49,0.06)' : undefined,
                            },
                        })}
                    />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}
