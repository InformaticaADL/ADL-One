import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconFilePlus, IconSearch, IconFileTypePdf, IconPencil, IconEye, IconSignature, IconRefresh } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import PdfViewerModal from '../../facturacion/components/PdfViewerModal';
import { verificacionTemperaturaService as api, type VerificacionResumen, type EstadoVerificacion } from '../services/verificacionTemperatura.service';
import { ESTADO_META, fmtFecha, fmtNum, hoyYmd, nombrePeriodo } from '../utils/verificacionTemperatura';
import { VerificacionTempEditor } from '../components/verificacion-temperatura/VerificacionTempEditor';
import { CrearFichasDialog } from '../components/verificacion-temperatura/CrearFichasDialog';

interface Props {
    onBack: () => void;
}

type FiltroEstado = '' | EstadoVerificacion | 'NO_CUMPLE';
const SEDES = ['PM', 'VI', 'AY', 'PA'];

// Sección de G. Calidad que reemplaza la planilla "Guia - Verificación
// Temperatura <mes>.xlsx": cada fila es una ficha OI-FoGe-39 (lo que antes era
// una hoja por equipo) y la tabla hace de hoja "Resumen".
export const GcVerificacionTemperaturaPage: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [periodos, setPeriodos] = useState<{ periodo: string; total: number; firmadas: number }[]>([]);
    const [periodo, setPeriodo] = useState(hoyYmd().slice(0, 7));
    const [fichas, setFichas] = useState<VerificacionResumen[]>([]);
    const [cargando, setCargando] = useState(false);
    const [estado, setEstado] = useState<FiltroEstado>('');
    const [sede, setSede] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [abierta, setAbierta] = useState<number | null>(null);
    const [crearAbierto, setCrearAbierto] = useState(false);
    const [pdf, setPdf] = useState<{ url: string; titulo: string } | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const [lista, pers] = await Promise.all([api.listar({ periodo: periodo || undefined }), api.periodos()]);
            setFichas(lista);
            setPeriodos(pers);
        } catch (err) {
            const mensaje = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: mensaje || 'No se pudieron cargar las verificaciones' });
        } finally {
            setCargando(false);
        }
    }, [periodo, showToast]);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);

    const visibles = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        return fichas.filter((f) => {
            if (estado === 'NO_CUMPLE' ? f.cumple !== 'N' : estado && f.estado !== estado) return false;
            if (sede && f.sede !== sede) return false;
            if (q && !`${f.codigo_equipo} ${f.nombre_equipo} ${f.muestreador_nombre || ''}`.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [fichas, estado, sede, busqueda]);

    const activas = fichas.filter((f) => f.estado !== 'ANULADA');
    const cuenta = (e: EstadoVerificacion) => fichas.filter((f) => f.estado === e).length;
    const stats: { key: FiltroEstado; label: string; valor: number; tono: string }[] = [
        { key: '', label: 'Fichas del periodo', valor: activas.length, tono: 'text-foreground' },
        { key: 'BORRADOR', label: 'En borrador', valor: cuenta('BORRADOR'), tono: 'text-muted-foreground' },
        { key: 'PENDIENTE_FIRMA', label: 'Pendientes de firma', valor: cuenta('PENDIENTE_FIRMA'), tono: 'text-warning' },
        { key: 'FIRMADA', label: 'Firmadas', valor: cuenta('FIRMADA'), tono: 'text-success' },
        { key: 'NO_CUMPLE', label: 'No cumplen', valor: activas.filter((f) => f.cumple === 'N').length, tono: 'text-destructive' },
    ];
    const avance = activas.length ? Math.round((cuenta('FIRMADA') / activas.length) * 100) : 0;

    const opcionesPeriodo = useMemo(() => {
        const set = new Set([hoyYmd().slice(0, 7), ...periodos.map((p) => p.periodo)]);
        return [...set].sort().reverse().map((p) => ({ value: p, label: nombrePeriodo(p) }));
    }, [periodos]);

    const verPdf = async (f: VerificacionResumen) => {
        try {
            const url = await api.pdfUrl(f.id_verificacion);
            setPdf({ url, titulo: `OI-FoGe-39 · ${f.codigo_equipo}${f.estado !== 'FIRMADA' ? ' (vista previa, sin firma)' : ''}` });
        } catch {
            showToast({ type: 'error', message: 'No se pudo abrir el PDF' });
        }
    };

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Verificación de Temperatura"
                subtitle="Formulario OI-FoGe-39 · Verificación intermedia de temperatura de los equipos de medición."
                onBack={onBack}
                breadcrumbItems={[{ label: 'Gestión de Calidad', onClick: onBack }, { label: 'Verificación de Temperatura' }]}
                rightSection={(
                    <Button onClick={() => setCrearAbierto(true)}>
                        <IconFilePlus size={16} /> Crear fichas
                    </Button>
                )}
            />

            <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="w-52">
                    <p className="mb-1 text-xs text-muted-foreground">Periodo (campaña)</p>
                    <Combobox value={periodo} onValueChange={setPeriodo} options={opcionesPeriodo} placeholder="Periodo" />
                </div>
                {activas.length > 0 && (
                    <div className="min-w-[220px] flex-1">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                            <span>Avance de {nombrePeriodo(periodo)}</span>
                            <span className="tabular-nums">{cuenta('FIRMADA')} de {activas.length} firmadas · {avance}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${avance}%` }} />
                        </div>
                    </div>
                )}
                <Button variant="ghost" size="sm" onClick={cargar} disabled={cargando}>
                    <IconRefresh size={15} className={cn(cargando && 'animate-spin')} /> Actualizar
                </Button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {stats.map((s) => (
                    <button
                        key={s.key || 'todas'}
                        type="button"
                        onClick={() => setEstado((prev) => (prev === s.key ? '' : s.key))}
                        className={cn(
                            'rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40',
                            estado === s.key && s.key !== '' ? 'border-primary ring-1 ring-primary' : 'border-border',
                        )}
                    >
                        <p className="text-xs text-muted-foreground">{s.label}</p>
                        <p className={cn('text-2xl font-bold tabular-nums', s.tono)}>{s.valor}</p>
                    </button>
                ))}
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                    {['', ...SEDES].map((s) => (
                        <button
                            key={s || 'todas'}
                            type="button"
                            onClick={() => setSede(s)}
                            className={cn('h-8 rounded-md border px-3 text-sm transition-colors', sede === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted')}
                        >
                            {s || 'Todas las sedes'}
                        </button>
                    ))}
                </div>
                <div className="relative ml-auto w-full max-w-xs">
                    <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-8 pl-8" placeholder="Buscar equipo o muestreador..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Equipo</TableHead>
                            <TableHead>Sede</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-center">Error 0 °C</TableHead>
                            <TableHead className="text-center">Error 15 °C</TableHead>
                            <TableHead className="text-center">Error 30 °C</TableHead>
                            <TableHead>Resultado</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Muestreador</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibles.map((f) => {
                            const meta = ESTADO_META[f.estado];
                            const fuera = (e: number | null) => e !== null && Math.abs(e) > 0.5;
                            return (
                                <TableRow key={f.id_verificacion} className={cn('cursor-pointer', f.estado === 'ANULADA' && 'opacity-60')} onClick={() => setAbierta(f.id_verificacion)}>
                                    <TableCell>
                                        <p className="font-semibold">{f.codigo_equipo}</p>
                                        <p className="max-w-[220px] truncate text-xs text-muted-foreground">{f.nombre_equipo}</p>
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{f.sede}</Badge></TableCell>
                                    <TableCell className="whitespace-nowrap text-sm">{fmtFecha(f.fecha_verificacion)}</TableCell>
                                    {[f.error0, f.error15, f.error30].map((e, i) => (
                                        <TableCell key={i} className={cn('text-center tabular-nums', fuera(e) && 'font-semibold text-destructive')}>{fmtNum(e)}</TableCell>
                                    ))}
                                    <TableCell>
                                        {f.cumple === null ? <span className="text-xs text-muted-foreground">Incompleta</span>
                                            : <Badge variant={f.cumple === 'S' ? 'success' : 'destructive'}>{f.cumple === 'S' ? 'Cumple' : 'No cumple'}</Badge>}
                                    </TableCell>
                                    <TableCell><Badge variant={meta.badge}>{meta.label}</Badge></TableCell>
                                    <TableCell className="max-w-[160px] truncate text-sm">{f.muestreador_nombre || '—'}</TableCell>
                                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-end gap-1">
                                            <Button size="sm" variant={f.estado === 'PENDIENTE_FIRMA' ? 'default' : 'outline'} onClick={() => setAbierta(f.id_verificacion)}>
                                                {f.estado === 'BORRADOR' ? <><IconPencil size={14} /> Llenar</>
                                                    : f.estado === 'PENDIENTE_FIRMA' ? <><IconSignature size={14} /> Firmar</>
                                                        : <><IconEye size={14} /> Ver</>}
                                            </Button>
                                            {f.estado !== 'ANULADA' && (
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => verPdf(f)} title={f.estado === 'FIRMADA' ? 'Ver PDF firmado' : 'Vista previa PDF'}>
                                                    <IconFileTypePdf size={16} className="text-red-600" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                {!cargando && visibles.length === 0 && (
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <p className="text-sm text-muted-foreground">
                            {fichas.length === 0 ? `Aún no hay fichas para ${nombrePeriodo(periodo)}.` : 'Ninguna ficha coincide con los filtros.'}
                        </p>
                        {fichas.length === 0 && (
                            <Button variant="outline" onClick={() => setCrearAbierto(true)}><IconFilePlus size={15} /> Crear fichas del periodo</Button>
                        )}
                    </div>
                )}
            </div>

            <CrearFichasDialog
                open={crearAbierto}
                onClose={() => setCrearAbierto(false)}
                onCreadas={(ids) => {
                    setCrearAbierto(false);
                    cargar();
                    if (ids.length === 1) setAbierta(ids[0]);
                }}
            />
            <VerificacionTempEditor idVerificacion={abierta} onClose={() => setAbierta(null)} onChanged={cargar} />
            <PdfViewerModal open={!!pdf} onClose={() => setPdf(null)} url={pdf?.url ?? null} title={pdf?.titulo} />
        </div>
    );
};
