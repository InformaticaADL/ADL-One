import React, { useCallback, useEffect, useState } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type FichaFactura, type MaestrosDocumentos } from '../services/facturacionSalud.service';
import { Campo, Dato } from './compartido';
import { fmtNum } from './formatos';
import AccionesTab from './facturas/AccionesTab';
import DetalleTab from './facturas/DetalleTab';
import EmisionTab from './facturas/EmisionTab';
import MontosTab from './facturas/MontosTab';
import OcValorTab from './facturas/OcValorTab';

/**
 * Facturas: consulta y mantención de una factura ya creada (réplica de «Consulta una Factura» de ADLSOFT).
 * Se busca por N° interno o por N° de factura; desde la ficha se graban los montos, se asignan las guías y las órdenes de compra,
 * se completan los datos para el emisor y se cambia o elimina la factura.
 */
const FacturacionSaludPrefacturas: React.FC<{ idInicial?: number }> = ({ idInicial }) => {
    const { showToast } = useToast();
    const [maestros, setMaestros] = useState<MaestrosDocumentos | null>(null);
    const [idBuscado, setIdBuscado] = useState('');
    const [folioBuscado, setFolioBuscado] = useState('');
    const [ficha, setFicha] = useState<FichaFactura | null>(null);
    const [cargando, setCargando] = useState(false);
    // Cambia cada vez que se recarga la ficha, para que las pestañas con datos propios vuelvan a leerse
    const [version, setVersion] = useState(0);

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
    }, [ficha, buscar]);

    const enc = ficha?.encabezado;
    const emitida = String(ficha?.emision?.emitido ?? '').trim() === 'S';

    return (
        <div className="flex flex-col gap-5">
            <Card className="p-5">
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                    <Campo label="N° interno de la factura">
                        <Input inputMode="numeric" value={idBuscado} onChange={(e) => setIdBuscado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && idBuscado && buscar({ id_facturacion: Number(idBuscado) })} placeholder="Ej.: 74900" />
                    </Campo>
                    <Button variant="outline" disabled={!idBuscado || cargando} onClick={() => buscar({ id_facturacion: Number(idBuscado) })}><IconSearch size={16} />Buscar</Button>
                    <Campo label="N° de factura">
                        <Input inputMode="numeric" value={folioBuscado} onChange={(e) => setFolioBuscado(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && folioBuscado && buscar({ factura: Number(folioBuscado) })} placeholder="Ej.: 32021" />
                    </Campo>
                    <Button variant="outline" disabled={!folioBuscado || cargando} onClick={() => buscar({ factura: Number(folioBuscado) })}><IconSearch size={16} />Buscar</Button>
                </div>
            </Card>

            {!ficha || !enc || !maestros ? (
                <Card className="p-10 text-center text-sm text-muted-foreground">
                    {cargando ? 'Buscando la factura…' : 'Busca una factura por su N° interno o por su N° de factura.'}
                </Card>
            ) : (
                <>
                    <Card className="p-5">
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <h2 className="m-0 text-base font-semibold text-foreground">{ficha.titulo}</h2>
                            <Badge variant={ficha.tieneFolio ? 'success' : 'warning'}>{ficha.tieneFolio ? `Factura N° ${Number(enc.factura)}` : 'Sin N° de factura'}</Badge>
                            <Badge variant={emitida ? 'secondary' : 'outline'}>{emitida ? 'Incluida en archivo' : 'Aún no incluida en archivo'}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
                            <Dato label="Empresa a facturar" className="col-span-2">{String(enc.nombre_empresaservicios).trim()}</Dato>
                            <Dato label="Fecha de facturación">{String(enc.fecha_facturacion ?? '').trim() || '—'}</Dato>
                            <Dato label="Facturado por">{ficha.facturado_por ? `${ficha.facturado_por}${ficha.valor ? `: ${ficha.valor}` : ''}` : '—'}</Dato>
                            <Dato label="Total casos (UF)">{fmtNum(enc.uf_totalcaso)}</Dato>
                            <Dato label="Total factura (UF)">{fmtNum(enc.uf_totalfac)}</Dato>
                            <Dato label="Valor UF">{fmtNum(enc.uf)}</Dato>
                            <Dato label="Total en pesos">$ {Math.round(Number(enc.peso_totalfac) || 0).toLocaleString('es-CL')}</Dato>
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
                            <TabsContent value="acciones"><AccionesTab ficha={ficha} maestros={maestros} onActualizada={recargar} onEliminada={() => setFicha(null)} /></TabsContent>
                        </Tabs>
                    </Card>
                </>
            )}
        </div>
    );
};

export default FacturacionSaludPrefacturas;
