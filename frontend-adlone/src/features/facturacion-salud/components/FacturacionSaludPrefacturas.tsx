import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconArrowLeft, IconRefresh, IconSearch } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type FichaFactura, type MaestrosDocumentos } from '../services/facturacionSalud.service';
import { Campo, Dato, SelectBuscable } from './compartido';
import { celdaTexto, fmtClp, fmtNum, type Fila } from './formatos';
import AccionesTab from './facturas/AccionesTab';
import DetalleTab from './facturas/DetalleTab';
import EmisionTab from './facturas/EmisionTab';
import MontosTab from './facturas/MontosTab';
import OcValorTab from './facturas/OcValorTab';

const FILTROS_ESTADO = [
    { value: 'N', label: 'Pendientes de archivo' },
    { value: 'ALL', label: 'Todas las facturas' },
    { value: 'S', label: 'Ya incluidas en archivo' },
];

/**
 * Facturas: consulta y mantención de una factura ya creada (réplica de «Consulta una Factura» de ADLSOFT),
 * con bandeja de facturas recientes para abrirlas con un clic.
 */
const FacturacionSaludPrefacturas: React.FC<{ idInicial?: number; onLimpiarInicial?: () => void }> = ({ idInicial, onLimpiarInicial }) => {
    const { showToast } = useToast();
    const [maestros, setMaestros] = useState<MaestrosDocumentos | null>(null);
    const [idBuscado, setIdBuscado] = useState('');
    const [folioBuscado, setFolioBuscado] = useState('');
    const [ficha, setFicha] = useState<FichaFactura | null>(null);
    const [cargando, setCargando] = useState(false);
    // Cambia cada vez que se recarga la ficha, para que las pestañas con datos propios vuelvan a leerse
    const [version, setVersion] = useState(0);

    // Listado de facturas recientes creadas
    const [listado, setListado] = useState<Array<Fila>>([]);
    const [cargandoListado, setCargandoListado] = useState(false);
    const [filtroEstado, setFiltroEstado] = useState<'ALL' | 'N' | 'S'>('N');
    const [busquedaLista, setBusquedaLista] = useState('');

    const cargarListado = useCallback(async () => {
        setCargandoListado(true);
        try {
            const rows = await facturacionSaludService.listarPrefacturas({
                emitido: filtroEstado,
                limite: 100,
            });
            setListado(rows);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo cargar el listado de facturas.') });
        } finally {
            setCargandoListado(false);
        }
    }, [filtroEstado, showToast]);

    useEffect(() => {
        cargarListado();
    }, [cargarListado]);

    useEffect(() => {
        facturacionSaludService
            .getMaestrosDocumentos()
            .then(setMaestros)
            .catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los catálogos.') }));
    }, [showToast]);

    const buscar = useCallback(
        async (params: { id_facturacion?: number; factura?: number }) => {
            setCargando(true);
            try {
                const f = await facturacionSaludService.consultarFactura(params);
                setFicha(f);
                setIdBuscado(String(f.encabezado.id_facturacion ?? ''));
                setVersion((v) => v + 1);
                if (f.otrasFacturasConElMismoFolio?.length) {
                    showToast({ type: 'info', message: `Ese N° de factura también está en las facturas internas ${f.otrasFacturasConElMismoFolio.join(', ')}.` });
                }
            } catch (e) {
                setFicha(null);
                showToast({ type: 'error', message: mensajeError(e, 'No existen datos registrados para esta factura.') });
            } finally {
                setCargando(false);
            }
        },
        [showToast]
    );

    // Si se llega desde otra vista con una factura (por ejemplo, la recién creada), se abre sola
    useEffect(() => {
        if (idInicial) {
            setIdBuscado(String(idInicial));
            buscar({ id_facturacion: idInicial });
        }
    }, [idInicial, buscar]);

    const recargar = useCallback(() => {
        if (ficha) buscar({ id_facturacion: Number(ficha.encabezado.id_facturacion) });
        cargarListado();
    }, [ficha, buscar, cargarListado]);

    const listadoFiltrado = useMemo(() => {
        const q = busquedaLista.trim().toLowerCase();
        if (!q) return listado;
        return listado.filter((f) =>
            [f.id_facturacion, f.factura, f.nombre_empresaservicios, f.rut_empresaservicios, f.nombre_centro, f.glosa, f.fecha_facturacion]
                .some((v) => String(v ?? '').toLowerCase().includes(q))
        );
    }, [listado, busquedaLista]);

    const enc = ficha?.encabezado;
    const emitida = String(ficha?.emision?.emitido ?? '').trim() === 'S';

    return (
        <div className="flex flex-col gap-5">
            <Card className="p-5">
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                    <Campo label="N° interno de la factura" info="Correlativo interno único de ADL (id_facturacion) asignado automáticamente al crear la pre-factura.">
                        <Input inputMode="numeric" value={idBuscado} onChange={(e) => setIdBuscado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && idBuscado && buscar({ id_facturacion: Number(idBuscado) })} placeholder="Ej.: 74910" />
                    </Campo>
                    <Button variant="outline" disabled={!idBuscado || cargando} onClick={() => buscar({ id_facturacion: Number(idBuscado) })}><IconSearch size={16} />Buscar</Button>
                    <Campo label="N° de factura" info="Folio tributario SII asignado a la factura. Si aún no se le ha grabado folio, búscala por su N° interno.">
                        <Input inputMode="numeric" value={folioBuscado} onChange={(e) => setFolioBuscado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && folioBuscado && buscar({ factura: Number(folioBuscado) })} placeholder="Ej.: 32021" />
                    </Campo>
                    <Button variant="outline" disabled={!folioBuscado || cargando} onClick={() => buscar({ factura: Number(folioBuscado) })}><IconSearch size={16} />Buscar</Button>
                </div>
            </Card>

            {!ficha || !enc || !maestros ? (
                <Card className="p-5">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="m-0 text-sm font-semibold text-foreground">
                                Facturas creadas ({listadoFiltrado.length})
                            </h3>
                            <p className="m-0 mt-0.5 text-xs text-muted-foreground">
                                Haz clic en cualquier factura para abrir su ficha, grabar montos/folio, agregar OC/HES o eliminarla.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                            <div className="w-56">
                                <Campo label="Filtrar listado">
                                    <Input
                                        value={busquedaLista}
                                        onChange={(e) => setBusquedaLista(e.target.value)}
                                        placeholder="Empresa, N° interno o glosa…"
                                    />
                                </Campo>
                            </div>
                            <div className="w-52">
                                <Campo label="Estado">
                                    <SelectBuscable
                                        opciones={FILTROS_ESTADO}
                                        valor={filtroEstado}
                                        onChange={(v) => setFiltroEstado(v as 'ALL' | 'N' | 'S')}
                                    />
                                </Campo>
                            </div>
                            <Button variant="outline" size="sm" onClick={cargarListado} disabled={cargandoListado}>
                                <IconRefresh size={15} /> Actualizar
                            </Button>
                        </div>
                    </div>

                    <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-24">N° interno</TableHead>
                                    <TableHead className="w-28">N° factura</TableHead>
                                    <TableHead className="w-28">Fecha</TableHead>
                                    <TableHead className="min-w-[190px]">Empresa</TableHead>
                                    <TableHead className="min-w-[150px]">Centro</TableHead>
                                    <TableHead className="w-44 max-w-[180px]">Glosa</TableHead>
                                    <TableHead className="text-right">Casos</TableHead>
                                    <TableHead className="text-right">Total UF</TableHead>
                                    <TableHead className="text-right">Total $</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cargando || cargandoListado ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                                            Cargando facturas…
                                        </TableCell>
                                    </TableRow>
                                ) : listadoFiltrado.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                                            No hay facturas para el filtro seleccionado.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    listadoFiltrado.map((row) => {
                                        const id = Number(row.id_facturacion);
                                        const folio = Number(row.factura) || 0;
                                        const enArchivo = String(row.emitido ?? '').trim() === 'S';
                                        const glosaTexto = String(row.glosa ?? '').trim();
                                        const centroTexto = String(row.nombre_centro ?? '').trim();
                                        return (
                                            <TableRow
                                                key={id}
                                                className="cursor-pointer hover:bg-muted/50"
                                                onClick={() => buscar({ id_facturacion: id })}
                                            >
                                                <TableCell className="font-mono font-semibold text-primary">#{id}</TableCell>
                                                <TableCell className={celdaTexto}>
                                                    {folio > 0 ? folio : <span className="text-xs text-muted-foreground">Sin número</span>}
                                                </TableCell>
                                                <TableCell className={celdaTexto}>{String(row.fecha_facturacion ?? '').trim()}</TableCell>
                                                <TableCell className={celdaTexto}>{String(row.nombre_empresaservicios ?? '').trim()}</TableCell>
                                                <TableCell className={celdaTexto}>{centroTexto || <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                                                <TableCell className="max-w-[180px] truncate align-top text-xs text-muted-foreground" title={glosaTexto}>
                                                    {glosaTexto}
                                                </TableCell>
                                                <TableCell className="text-right align-top tabular-nums">{Number(row.total_casos) || 0}</TableCell>
                                                <TableCell className="text-right align-top font-semibold tabular-nums">{fmtNum(row.uf_totalfac)}</TableCell>
                                                <TableCell className="whitespace-nowrap text-right align-top tabular-nums">$ {fmtClp(row.peso_totalfac)}</TableCell>
                                                <TableCell className="align-top">
                                                    <Badge variant={enArchivo ? 'secondary' : 'warning'}>
                                                        {enArchivo ? 'En archivo' : 'Pendiente'}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </Card>
            ) : (
                <>
                    <Card className="p-5">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="m-0 text-base font-semibold text-foreground">{ficha.titulo}</h2>
                                <Badge variant={ficha.tieneFolio ? 'success' : 'warning'}>{ficha.tieneFolio ? `Factura N° ${Number(enc.factura)}` : 'Sin N° de factura'}</Badge>
                                <Badge variant={emitida ? 'secondary' : 'outline'}>{emitida ? 'Incluida en archivo' : 'Aún no incluida en archivo'}</Badge>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setFicha(null);
                                    setIdBuscado('');
                                    setFolioBuscado('');
                                    onLimpiarInicial?.();
                                }}
                            >
                                <IconArrowLeft size={15} /> Volver al listado
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                            <Dato label="Empresa a facturar" info="Razón social del cliente (Empresa de Servicio) al que se emite la factura." className="col-span-2">{String(enc.nombre_empresaservicios).trim()}</Dato>
                            <Dato label="Fecha de facturación" info="Fecha de emisión registrada en el encabezado de la factura.">{String(enc.fecha_facturacion ?? '').trim() || '—'}</Dato>
                            <Dato label="Facturado por" info="Criterio de agrupación con que se generó la factura (Centro, Veterinario, Tipo de Agua o General).">{ficha.facturado_por ? `${ficha.facturado_por}${ficha.valor ? `: ${ficha.valor}` : ''}` : '—'}</Dato>
                            <Dato label="Total casos (UF)" info="Suma en UF únicamente de las prestaciones y análisis de laboratorio de los casos incluidos en esta factura.">{fmtNum(enc.uf_totalcaso)}</Dato>
                            <Dato label="Total factura (UF)" info="Monto final en UF a cobrar: Total casos (UF) + Otros ingresos (UF) − Otros descuentos (UF).">{fmtNum(enc.uf_totalfac)}</Dato>
                            <Dato label="Valor UF" info="Valor en pesos chilenos de la UF con que se convierte el total de esta factura.">{fmtNum(enc.uf)}</Dato>
                            <Dato label="Total en pesos" info="Monto neto en pesos chilenos (sin IVA), calculado como Total factura (UF) × Valor UF.">$ {fmtClp(Number(enc.peso_totalfac) || (Math.round((Number(enc.uf_totalfac) || 0) * 100) / 100) * (Number(enc.uf) || 0))}</Dato>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <Tabs defaultValue="montos">
                            <TabsList className="mb-4 h-auto flex-wrap justify-start gap-1">
                                <TabsTrigger value="montos">Montos y N° de factura</TabsTrigger>
                                <TabsTrigger value="detalle">Detalle</TabsTrigger>
                                <TabsTrigger value="emision">Datos para el emisor</TabsTrigger>
                                <TabsTrigger value="oc">Órdenes de compra con valor</TabsTrigger>
                                <TabsTrigger value="acciones">Cambiar o eliminar</TabsTrigger>
                            </TabsList>
                            <TabsContent value="montos"><MontosTab key={version} ficha={ficha} maestros={maestros} onActualizada={recargar} /></TabsContent>
                            <TabsContent value="detalle"><DetalleTab ficha={ficha} /></TabsContent>
                            <TabsContent value="emision"><EmisionTab key={version} ficha={ficha} maestros={maestros} onActualizada={recargar} /></TabsContent>
                            <TabsContent value="oc"><OcValorTab idFacturacion={Number(enc.id_facturacion)} /></TabsContent>
                            <TabsContent value="acciones"><AccionesTab ficha={ficha} maestros={maestros} onActualizada={recargar} onEliminada={() => { setFicha(null); cargarListado(); }} /></TabsContent>
                        </Tabs>
                    </Card>
                </>
            )}
        </div>
    );
};

export default FacturacionSaludPrefacturas;
