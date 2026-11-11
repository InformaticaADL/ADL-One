import React, { useState } from 'react';
import { IconDownload, IconFileTypePdf } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type FichaFactura } from '../../services/facturacionSalud.service';
import { Seccion } from '../compartido';
import { celdaTexto, descargarCsv, fmtNum } from '../formatos';

interface Props { ficha: FichaFactura }

/** Detalle de los casos de la factura y descarga de los datos de los Excel de resumen y detalle de ADLSOFT. */
const DetalleTab: React.FC<Props> = ({ ficha }) => {
    const { showToast } = useToast();
    const id = Number(ficha.encabezado.id_facturacion);
    const [descargando, setDescargando] = useState<string | null>(null);

    const descargarPdf = async (tipo: 'resumen' | 'detalle') => {
        setDescargando(`pdf-${tipo}`);
        try {
            const { blob, nombre, ruta } = tipo === 'resumen' ? await facturacionSaludService.descargarPdfResumen(id) : await facturacionSaludService.descargarPdfDetalle(id);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombre;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            showToast({ type: 'success', message: ruta ? `PDF guardado en ${ruta}` : 'PDF descargado. No hay carpeta de documentos configurada, así que no se guardó una copia.' });
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo generar el PDF.') });
        } finally {
            setDescargando(null);
        }
    };

    const descargar = async (tipo: 'resumen' | 'detalle' | 'lote') => {
        setDescargando(tipo);
        try {
            const datos = tipo === 'resumen' ? await facturacionSaludService.datosExcelResumen(id) : await facturacionSaludService.datosExcelDetalle(id, tipo === 'lote');
            descargarCsv(`Factura ${tipo} ID${id}.csv`, datos.columnas, datos.filas);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo preparar el archivo.') });
        } finally {
            setDescargando(null);
        }
    };

    return (
        <Seccion
            titulo={`Detalle de la factura (${ficha.detalle.length} líneas)`}
            descripcion={ficha.facturado_por ? `Facturado por ${ficha.facturado_por}${ficha.valor ? `: ${ficha.valor}` : ''}` : undefined}
            acciones={
                <>
                    <Button size="sm" disabled={descargando !== null} onClick={() => descargarPdf('resumen')}><IconFileTypePdf size={15} />Resumen PDF</Button>
                    <Button size="sm" disabled={descargando !== null} onClick={() => descargarPdf('detalle')}><IconFileTypePdf size={15} />Detalle PDF</Button>
                    <Button variant="outline" size="sm" disabled={descargando !== null} onClick={() => descargar('resumen')}><IconDownload size={15} />Resumen</Button>
                    <Button variant="outline" size="sm" disabled={descargando !== null} onClick={() => descargar('detalle')}><IconDownload size={15} />Detalle</Button>
                    <Button variant="outline" size="sm" disabled={descargando !== null} onClick={() => descargar('lote')}><IconDownload size={15} />Detalle por lote</Button>
                </>
            }
        >
            <div className="max-h-[55vh] overflow-auto rounded-md border border-border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Caso</TableHead>
                            <TableHead>Centro</TableHead>
                            <TableHead>Veterinario</TableHead>
                            <TableHead>Técnica</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">UF unitario</TableHead>
                            <TableHead className="text-right">UF total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {ficha.detalle.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">La factura no tiene líneas.</TableCell></TableRow>
                        ) : (
                            ficha.detalle.map((d, i) => (
                                <TableRow key={`${d.caso}-${d.tecnica}-${i}`}>
                                    <TableCell className={celdaTexto}>{String(d.caso ?? '').trim()}</TableCell>
                                    <TableCell className={celdaTexto}>{String(d.centro ?? '').trim()}</TableCell>
                                    <TableCell className={celdaTexto}>{String(d.veterinario ?? '').trim()}</TableCell>
                                    <TableCell className={celdaTexto}>{String(d.tecnica ?? '').trim()}</TableCell>
                                    <TableCell className="text-right align-top tabular-nums">{Number(d.n_analisis) || 0}</TableCell>
                                    <TableCell className="text-right align-top tabular-nums">{fmtNum(d.uf_uni, 3)}</TableCell>
                                    <TableCell className="text-right align-top tabular-nums">{fmtNum(d.uf_tot, 3)}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="text-right text-sm text-muted-foreground">Total del detalle: <span className="font-semibold text-foreground">{fmtNum(ficha.totalDetalleUf)} UF</span></div>
        </Seccion>
    );
};

export default DetalleTab;
