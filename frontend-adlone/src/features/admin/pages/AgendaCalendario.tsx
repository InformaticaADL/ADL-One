import React, { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconCalendar } from '@tabler/icons-react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface AgendaItem {
    id_agendamam: number | string;
    correlativo_ficha: string;
    rol?: string;
    fecha_muestreo: string;
    cliente?: string;
    centro?: string;
    objetivo?: string;
    estado_caso?: string;
}

interface Props {
    agenda: AgendaItem[];
    /** Inicio del periodo seleccionado en el perfil ('YYYY-MM-DD'): define el día inicial. */
    desde: string;
}

type Vista = 'mes' | 'semana';

// Abreviados: con el calendario acotado a ~520px cada columna mide ~74px y los
// nombres completos se cortaban igual.
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// main.tsx importa el locale 'es' pero nunca llama a dayjs.locale('es'), así que el
// global sigue en inglés. Se aplica por llamada en vez de activarlo globalmente desde
// acá: un componente hoja no debería cambiarle el idioma al resto de la app.
const enEs = (d: dayjs.Dayjs) => d.locale('es');

// La fecha llega de SQL como 'YYYY-MM-DDT00:00:00.000Z' (fecha pura en UTC). Pasarla
// por `new Date()` la reinterpreta en la zona local y, al estar Chile detrás de UTC,
// el día se corre uno hacia atrás. Por eso la clave del día es el substring ISO.
const claveDia = (fecha: string) => String(fecha || '').split('T')[0];

type Tono = 'ejecutado' | 'cancelado' | 'pendiente';
const tonoDe = (estado?: string): Tono => {
    const e = (estado || '').toUpperCase();
    if (e.includes('EJECUTADO') || e.includes('REALIZADO')) return 'ejecutado';
    if (e.includes('CANCELADO') || e.includes('ANULADO')) return 'cancelado';
    return 'pendiente';
};

// Pastel de fondo + texto saturado. Lo ya cerrado (ejecutado/cancelado) va tachado,
// para que el día se lea de un vistazo sin tener que abrirlo.
const PILDORA: Record<Tono, string> = {
    ejecutado: 'bg-success/15 text-success line-through decoration-success/50',
    cancelado: 'bg-destructive/15 text-destructive line-through decoration-destructive/50',
    pendiente: 'bg-primary/10 text-primary',
};
const BADGE: Record<Tono, 'success' | 'destructive' | 'secondary'> = {
    ejecutado: 'success',
    cancelado: 'destructive',
    pendiente: 'secondary',
};

// Lunes como primer día de la semana (convención local): domingo es day() 0 y acá
// cuenta como el séptimo.
const indiceLunes = (d: dayjs.Dayjs) => (d.day() === 0 ? 6 : d.day() - 1);

const Pildora: React.FC<{ item: AgendaItem }> = ({ item }) => (
    <span
        title={`${item.correlativo_ficha} · ${item.centro || ''}${item.rol ? ` · ${item.rol}` : ''}`}
        className={cn('block truncate rounded px-1 text-[9px] font-medium leading-[1.35]', PILDORA[tonoDe(item.estado_caso)])}
    >
        <span className="opacity-70">{item.correlativo_ficha}</span> {item.centro || '—'}
    </span>
);

export const AgendaCalendario: React.FC<Props> = ({ agenda, desde }) => {
    const [vista, setVista] = useState<Vista>('mes');
    // Ancla de navegación: el día de referencia de la vista actual. Arranca en hoy si
    // cae dentro del periodo; si no, al inicio del periodo (al mirar un mes pasado,
    // abrir ahí es más útil que caer en un mes vacío).
    const [ancla, setAncla] = useState(() => {
        const inicio = dayjs(desde);
        const hoy = dayjs();
        return hoy.isSame(inicio, 'month') || hoy.isAfter(inicio, 'day') ? hoy : inicio;
    });
    const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(dayjs().format('YYYY-MM-DD'));

    const porDia = useMemo(() => {
        const mapa = new Map<string, AgendaItem[]>();
        agenda.forEach((a) => {
            const k = claveDia(a.fecha_muestreo);
            if (!k) return;
            if (!mapa.has(k)) mapa.set(k, []);
            mapa.get(k)!.push(a);
        });
        return mapa;
    }, [agenda]);

    // La grilla del mes incluye la cola del mes anterior y la cabeza del siguiente para
    // completar semanas enteras — como en cualquier calendario, en vez de dejar huecos.
    const celdasMes = useMemo(() => {
        const primero = ancla.startOf('month');
        const offset = indiceLunes(primero);
        const semanas = Math.ceil((offset + ancla.daysInMonth()) / 7);
        const inicio = primero.subtract(offset, 'day');
        return Array.from({ length: semanas * 7 }, (_, i) => inicio.add(i, 'day'));
    }, [ancla]);

    const diasSemana = useMemo(
        () => Array.from({ length: 7 }, (_, i) => ancla.subtract(indiceLunes(ancla), 'day').add(i, 'day')),
        [ancla]
    );

    const navegar = (dir: 1 | -1) => {
        setAncla((a) => a.add(dir, vista === 'mes' ? 'month' : 'week'));
    };

    const visibles = useMemo(() => {
        if (vista === 'semana') return diasSemana.flatMap((d) => porDia.get(d.format('YYYY-MM-DD')) ?? []);
        return agenda.filter((a) => claveDia(a.fecha_muestreo).startsWith(ancla.format('YYYY-MM')));
    }, [vista, ancla, diasSemana, porDia, agenda]);

    const titulo = vista === 'mes'
        ? enEs(ancla).format('MMMM YYYY')
        : `${enEs(diasSemana[0]).format('D MMM')} – ${enEs(diasSemana[6]).format('D MMM YYYY')}`;

    const hoyKey = dayjs().format('YYYY-MM-DD');
    const itemsDelDia = diaSeleccionado ? (porDia.get(diaSeleccionado) ?? []) : [];

    return (
        <div className="flex flex-col gap-4 xl:flex-row">
            {/* Ancho acotado: el calendario es para ubicarse y elegir un día, no para leer
                el detalle — ese espacio lo aprovecha mejor la tabla de la derecha. */}
            <div className="flex min-w-0 flex-col gap-3 xl:w-[520px] xl:shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => { setAncla(dayjs()); setDiaSeleccionado(hoyKey); }}>
                            <IconCalendar size={14} /> Hoy
                        </Button>
                        <Button variant="ghost" size="icon-xs" aria-label="Anterior" onClick={() => navegar(-1)}>
                            <IconChevronLeft size={16} />
                        </Button>
                        <span className="min-w-[170px] text-center text-sm font-semibold capitalize">{titulo}</span>
                        <Button variant="ghost" size="icon-xs" aria-label="Siguiente" onClick={() => navegar(1)}>
                            <IconChevronRight size={16} />
                        </Button>
                    </div>

                    <div className="flex items-center gap-2">
                        <Badge variant="secondary">{visibles.length} ficha{visibles.length !== 1 ? 's' : ''}</Badge>
                        <Select value={vista} onValueChange={(v) => setVista(v as Vista)}>
                            <SelectTrigger className="h-8 w-[104px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="mes">Mes</SelectItem>
                                <SelectItem value="semana">Semana</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {vista === 'mes' ? (
                    <div className="overflow-hidden rounded-xl border border-border">
                        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                            {DIAS.map((d) => (
                                <span key={d} className="truncate px-1 py-1 text-center text-[10px] font-medium text-muted-foreground">{d}</span>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {celdasMes.map((d, idx) => {
                                const k = d.format('YYYY-MM-DD');
                                const items = porDia.get(k) ?? [];
                                const delMesActual = d.isSame(ancla, 'month');
                                return (
                                    <button
                                        type="button"
                                        key={k}
                                        onClick={() => setDiaSeleccionado(k)}
                                        className={cn(
                                            'flex min-h-[60px] flex-col items-stretch gap-px border-b border-r border-border p-0.5 text-left transition-colors',
                                            idx % 7 === 6 && 'border-r-0',
                                            !delMesActual && 'bg-muted/30',
                                            'hover:bg-muted/60',
                                            k === diaSeleccionado && 'ring-2 ring-inset ring-primary'
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                'flex h-4 w-4 items-center justify-center self-start rounded-full text-[10px] leading-none',
                                                k === hoyKey ? 'bg-foreground font-bold text-background' : delMesActual ? 'text-foreground' : 'text-muted-foreground/50'
                                            )}
                                        >
                                            {d.date()}
                                        </span>
                                        {items.slice(0, 2).map((a) => <Pildora key={String(a.id_agendamam)} item={a} />)}
                                        {items.length > 2 && (
                                            <span className="px-1 text-[9px] leading-none text-muted-foreground">+{items.length - 2}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-xl border border-border">
                        <div className="grid grid-cols-7 border-b border-border bg-muted/40">
                            {diasSemana.map((d) => (
                                <span key={d.format('YYYY-MM-DD')} className={cn('px-2 py-1.5 text-center text-[11px] font-medium capitalize', d.format('YYYY-MM-DD') === hoyKey ? 'text-primary' : 'text-muted-foreground')}>
                                    {enEs(d).format('ddd D')}
                                </span>
                            ))}
                        </div>
                        <div className="grid grid-cols-7">
                            {diasSemana.map((d, idx) => {
                                const k = d.format('YYYY-MM-DD');
                                const items = porDia.get(k) ?? [];
                                return (
                                    <button
                                        type="button"
                                        key={k}
                                        onClick={() => setDiaSeleccionado(k)}
                                        className={cn(
                                            'flex min-h-[140px] flex-col gap-0.5 border-r border-border p-1 text-left transition-colors hover:bg-muted/60',
                                            idx === 6 && 'border-r-0',
                                            k === hoyKey && 'bg-accent',
                                            k === diaSeleccionado && 'ring-2 ring-inset ring-primary'
                                        )}
                                    >
                                        {items.map((a) => <Pildora key={String(a.id_agendamam)} item={a} />)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Detalle del día seleccionado. Al lado del calendario en pantallas anchas y
                debajo en angostas, para no competir por el ancho con la grilla. */}
            <aside className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                    <span className="truncate text-sm font-semibold capitalize">
                        {diaSeleccionado ? enEs(dayjs(diaSeleccionado)).format('dddd D [de] MMMM') : 'Ningún día seleccionado'}
                    </span>
                    {diaSeleccionado && (
                        <Badge variant="secondary" className="shrink-0">{itemsDelDia.length}</Badge>
                    )}
                </div>

                {!diaSeleccionado ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                        Seleccioná un día en el calendario para ver sus fichas.
                    </p>
                ) : itemsDelDia.length === 0 ? (
                    <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                        Sin fichas agendadas este día.
                    </p>
                ) : (
                    <div className="max-h-[520px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ficha</TableHead>
                                    <TableHead>Centro</TableHead>
                                    <TableHead>Rol</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {itemsDelDia.map((a) => (
                                    <TableRow key={String(a.id_agendamam)}>
                                        <TableCell className="font-medium text-primary">{a.correlativo_ficha}</TableCell>
                                        <TableCell className="max-w-[260px]">
                                            <span className="block truncate" title={a.centro}>{a.centro || '-'}</span>
                                            <span className="block truncate text-xs text-muted-foreground" title={`${a.cliente || ''} · ${a.objetivo || ''}`}>
                                                {[a.cliente, a.objetivo].filter(Boolean).join(' · ') || '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell>{a.rol ? <Badge variant="outline">{a.rol}</Badge> : '-'}</TableCell>
                                        <TableCell>
                                            <Badge variant={BADGE[tonoDe(a.estado_caso)]}>{a.estado_caso || 'Pendiente'}</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </aside>
        </div>
    );
};
