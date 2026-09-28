import React, { useEffect, useMemo, useState } from 'react';
import { IconSearch, IconScale } from '@tabler/icons-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { PageHeader } from '../../../components/layout/PageHeader';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    onBack: () => void;
}

type Modo = 'tecnica' | 'detalle';

interface Fila {
    id: number;
    idTecnica: number;
    tecnica: string;
    idNormativa: number;
    normativa: string;
    idTabla: number;
    tabla: string;
    desde: number;
    hasta: number;
    habilitada: boolean;
}

const ALL = 'all';
const PAGE_SIZE = 25;
const trim = (v: unknown) => String(v ?? '').trim();
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true });

export const ReferenciasNormativasView: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [filas, setFilas] = useState<Fila[]>([]);
    const [normativas, setNormativas] = useState<{ id: number; nombre: string }[]>([]);
    const [tablas, setTablas] = useState<{ id: number; nombre: string; idNormativa: number }[]>([]);

    const [modo, setModo] = useState<Modo>('tecnica');
    const [search, setSearch] = useState('');
    const [normativaSel, setNormativaSel] = useState(ALL);
    const [tablaSel, setTablaSel] = useState(ALL);
    const [estado, setEstado] = useState<'habilitadas' | 'todas'>('habilitadas');
    const [page, setPage] = useState(1);

    useEffect(() => {
        (async () => {
            try {
                const [refs, tecnicas, norm, tab] = await Promise.all([
                    catalogosService.getMaestroData('App_Ma_ReferenciaAnalisis'),
                    catalogosService.getMaestroData('mae_tecnica'),
                    catalogosService.getMaestroData('mae_normativa'),
                    catalogosService.getMaestroData('mae_normativareferencia')
                ]);
                const tecnicaNombre = new Map<number, string>(tecnicas.map((t: any) => [Number(t.id_tecnica), trim(t.nombre_tecnica)]));
                const normNombre = new Map<number, string>(norm.map((n: any) => [Number(n.id_normativa), trim(n.nombre_normativa)]));
                const tablaNombre = new Map<number, string>(tab.map((t: any) => [Number(t.id_normativareferencia), trim(t.nombre_normativareferencia)]));

                setNormativas(norm
                    .filter((n: any) => Number(n.id_normativa) !== 0)
                    .map((n: any) => ({ id: Number(n.id_normativa), nombre: trim(n.nombre_normativa) })));
                setTablas(tab
                    .filter((t: any) => Number(t.id_normativareferencia) !== 0)
                    .map((t: any) => ({ id: Number(t.id_normativareferencia), nombre: trim(t.nombre_normativareferencia), idNormativa: Number(t.id_normativa) })));
                setFilas(refs.map((r: any): Fila => ({
                    id: Number(r.id_referenciaanalisis),
                    idTecnica: Number(r.id_tecnica),
                    tecnica: tecnicaNombre.get(Number(r.id_tecnica)) || `Técnica #${r.id_tecnica}`,
                    idNormativa: Number(r.id_normativa),
                    normativa: normNombre.get(Number(r.id_normativa)) || `Normativa #${r.id_normativa}`,
                    idTabla: Number(r.id_normativareferencia),
                    tabla: tablaNombre.get(Number(r.id_normativareferencia)) || `Tabla #${r.id_normativareferencia}`,
                    desde: Number(r.limitemax_d),
                    hasta: Number(r.limitemax_h),
                    habilitada: r.habilitado === 'S'
                })));
            } catch {
                showToast({ type: 'error', message: 'No se pudieron cargar las referencias normativas' });
            } finally {
                setLoading(false);
            }
        })();
    }, [showToast]);

    useEffect(() => { setPage(1); }, [search, normativaSel, tablaSel, estado, modo]);

    const normativaOptions = useMemo(
        () => [{ value: ALL, label: 'Todas las normativas' }, ...normativas.map(n => ({ value: String(n.id), label: n.nombre }))],
        [normativas]
    );

    const tablaOptions = useMemo(() => {
        const normNombre = new Map(normativas.map(n => [n.id, n.nombre]));
        const visibles = normativaSel === ALL ? tablas : tablas.filter(t => String(t.idNormativa) === normativaSel);
        return [
            { value: ALL, label: 'Todas las tablas' },
            ...visibles.map(t => ({
                value: String(t.id),
                label: normativaSel === ALL ? `${normNombre.get(t.idNormativa) ?? ''} · ${t.nombre}` : t.nombre
            }))
        ];
    }, [tablas, normativas, normativaSel]);

    const filtradas = useMemo(() => {
        const q = search.trim().toLowerCase();
        return filas
            .filter(f => estado === 'todas' || f.habilitada)
            .filter(f => normativaSel === ALL || String(f.idNormativa) === normativaSel)
            .filter(f => tablaSel === ALL || String(f.idTabla) === tablaSel)
            .filter(f => !q || f.tecnica.toLowerCase().includes(q))
            .sort((a, b) =>
                collator.compare(a.tecnica, b.tecnica) ||
                collator.compare(a.normativa, b.normativa) ||
                collator.compare(a.tabla, b.tabla));
    }, [filas, estado, normativaSel, tablaSel, search]);

    // Una fila por técnica con todas sus normativas/tablas
    const porTecnica = useMemo(() => {
        const m = new Map<number, { idTecnica: number; tecnica: string; refs: Fila[] }>();
        filtradas.forEach(f => {
            const g = m.get(f.idTecnica) ?? { idTecnica: f.idTecnica, tecnica: f.tecnica, refs: [] };
            g.refs.push(f);
            m.set(f.idTecnica, g);
        });
        return [...m.values()];
    }, [filtradas]);

    // Resumen por normativa sobre lo filtrado (sin contar el filtro de normativa/tabla propio)
    const resumen = useMemo(() => {
        const q = search.trim().toLowerCase();
        const cuenta = new Map<number, Set<number>>();
        filas
            .filter(f => estado === 'todas' || f.habilitada)
            .filter(f => !q || f.tecnica.toLowerCase().includes(q))
            .forEach(f => {
                const s = cuenta.get(f.idNormativa) ?? new Set<number>();
                s.add(f.idTecnica);
                cuenta.set(f.idNormativa, s);
            });
        return normativas
            .map(n => ({ ...n, tecnicas: cuenta.get(n.id)?.size ?? 0 }))
            .filter(n => n.tecnicas > 0);
    }, [filas, normativas, estado, search]);

    const totalFilas = modo === 'tecnica' ? porTecnica.length : filtradas.length;
    const inicio = (page - 1) * PAGE_SIZE;

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Técnicas por Normativa"
                subtitle="Vista unificada: a qué normativa y tabla de referencia pertenece cada técnica."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Informática', onClick: onBack },
                    { label: 'Maestros Hub', onClick: onBack },
                    { label: 'Técnicas por Normativa' }
                ]}
            />

            {/* Resumen por normativa: clic para filtrar */}
            {!loading && resumen.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {resumen.map(n => {
                        const activa = normativaSel === String(n.id);
                        return (
                            <button
                                key={n.id}
                                type="button"
                                onClick={() => { setNormativaSel(activa ? ALL : String(n.id)); setTablaSel(ALL); }}
                                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${activa ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'}`}
                            >
                                <IconScale size={14} />
                                <span className="font-medium">{n.nombre}</span>
                                <span className="text-xs text-muted-foreground">{n.tecnicas} técnicas</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="relative w-full max-w-[320px]">
                    <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar técnica..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-10 pl-9"
                    />
                </div>
                <Combobox
                    className="w-[220px]"
                    options={normativaOptions}
                    value={normativaSel}
                    onValueChange={(v) => { setNormativaSel(v); setTablaSel(ALL); }}
                />
                <Combobox className="w-[240px]" options={tablaOptions} value={tablaSel} onValueChange={setTablaSel} />
                <Combobox
                    className="w-[170px]"
                    options={[
                        { value: 'habilitadas', label: 'Solo habilitadas' },
                        { value: 'todas', label: 'Todas' }
                    ]}
                    value={estado}
                    onValueChange={(v) => setEstado(v as 'habilitadas' | 'todas')}
                />
                <Tabs value={modo} onValueChange={(v) => setModo(v as Modo)} className="ml-auto">
                    <TabsList>
                        <TabsTrigger value="tecnica">Por técnica</TabsTrigger>
                        <TabsTrigger value="detalle">Detalle con límites</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            <Card className="mt-4 overflow-hidden p-0">
                {loading ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Cargando...</p>
                ) : totalFilas === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">No hay resultados con esos filtros.</p>
                ) : modo === 'tecnica' ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Técnica</TableHead>
                                <TableHead>Pertenece a (normativa · tabla)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {porTecnica.slice(inicio, inicio + PAGE_SIZE).map(g => (
                                <TableRow key={g.idTecnica}>
                                    <TableCell className="align-top font-medium">{g.tecnica}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1.5">
                                            {g.refs.map(r => (
                                                <Badge key={r.id} variant="outline" className={`normal-case ${r.habilitada ? '' : 'opacity-50 line-through'}`}>
                                                    {r.normativa} · {r.tabla}
                                                </Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Técnica</TableHead>
                                <TableHead>Normativa</TableHead>
                                <TableHead>Tabla</TableHead>
                                <TableHead className="text-right">Límite desde</TableHead>
                                <TableHead className="text-right">Límite hasta</TableHead>
                                <TableHead>Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtradas.slice(inicio, inicio + PAGE_SIZE).map(f => (
                                <TableRow key={f.id} className={f.habilitada ? '' : 'opacity-60'}>
                                    <TableCell className="font-medium">{f.tecnica}</TableCell>
                                    <TableCell>{f.normativa}</TableCell>
                                    <TableCell>{f.tabla}</TableCell>
                                    <TableCell className="text-right tabular-nums">{f.desde}</TableCell>
                                    <TableCell className="text-right tabular-nums">{f.hasta}</TableCell>
                                    <TableCell>
                                        <Badge variant={f.habilitada ? 'default' : 'outline'}>{f.habilitada ? 'Habilitada' : 'Deshabilitada'}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            <DataPagination className="mt-4" page={page} pageSize={PAGE_SIZE} total={totalFilas} onPageChange={setPage} />
            {!loading && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {porTecnica.length} técnicas · {filtradas.length} referencias. Para editar los límites, abra la técnica en Maestros → Técnica → Técnicas.
                </p>
            )}
        </div>
    );
};
