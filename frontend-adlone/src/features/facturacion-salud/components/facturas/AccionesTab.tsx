import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type FichaFactura, type MaestrosDocumentos } from '../../services/facturacionSalud.service';
import { Campo, Seccion, SelectBuscable } from '../compartido';

interface Props {
    ficha: FichaFactura;
    maestros: MaestrosDocumentos;
    onActualizada: () => void;
    /** La factura dejó de existir (se eliminó). */
    onEliminada: () => void;
}

/** Cambiar la empresa a facturar y eliminar la factura. Ambas cambian datos de los casos: se piden con confirmación. */
const AccionesTab: React.FC<Props> = ({ ficha, maestros, onActualizada, onEliminada }) => {
    const { showToast } = useToast();
    const enc = ficha.encabezado;
    const id = Number(enc.id_facturacion);
    const emitida = String(ficha.emision?.emitido ?? '').trim() === 'S';

    const [empresa, setEmpresa] = useState('');
    const [motivo, setMotivo] = useState('');
    const [trabajando, setTrabajando] = useState(false);
    const [confirmarCambio, setConfirmarCambio] = useState(false);
    const [confirmarEliminar, setConfirmarEliminar] = useState<null | 'id' | 'numero'>(null);

    const opcionesEmpresa = maestros.empresas.map((e) => ({
        value: String(e.id_empresaservicio),
        label: `${String(e.nombre_empresaservicios).trim()}${e.rut_empresaservicios ? ` (${String(e.rut_empresaservicios).trim()})` : ''}`,
    }));

    const cambiarEmpresa = async () => {
        setTrabajando(true);
        try {
            await facturacionSaludService.cambiarEmpresaFactura(id, { id_empresaservicio: Number(empresa), motivo });
            showToast({ type: 'success', message: 'Se cambió la empresa a facturar.' });
            setConfirmarCambio(false);
            setEmpresa('');
            setMotivo('');
            onActualizada();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setTrabajando(false);
        }
    };

    const eliminar = async () => {
        setTrabajando(true);
        try {
            const r = confirmarEliminar === 'numero'
                ? await facturacionSaludService.eliminarFacturaPorNumero(Number(enc.factura))
                : await facturacionSaludService.eliminarFacturaPorId(id);
            const otras: number[] = r?.otrasFacturasConElMismoNumero ?? [];
            showToast({
                type: 'success',
                message: otras.length
                    ? `Se eliminó la factura interna ${r.id_facturacion}. Quedan otras con el mismo número: ${otras.join(', ')}.`
                    : `Se eliminó la factura interna ${r.id_facturacion ?? id}.`,
            });
            setConfirmarEliminar(null);
            onEliminada();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setTrabajando(false);
        }
    };

    return (
        <div className="flex flex-col gap-8">
            <Seccion titulo="Cambiar la empresa a facturar" descripcion="Cambia la empresa de la factura y también la de todos sus casos. El motivo es obligatorio y queda registrado.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Campo label="Empresa actual"><div className="min-h-9 whitespace-normal break-words rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{String(enc.nombre_empresaservicios).trim()}</div></Campo>
                    <Campo label="Cambiar por"><SelectBuscable opciones={opcionesEmpresa} valor={empresa} onChange={setEmpresa} placeholder="Elegir empresa" buscar="Buscar por nombre o RUT…" /></Campo>
                </div>
                <Campo label="Motivo"><Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explica por qué se cambia la empresa" /></Campo>
                <div className="flex justify-end">
                    <Button variant="outline" disabled={!empresa || !motivo.trim()} onClick={() => setConfirmarCambio(true)}>Cambiar empresa</Button>
                </div>
            </Seccion>

            <Seccion titulo="Eliminar la factura" descripcion="Los casos vuelven a quedar disponibles para facturarse. No se puede deshacer.">
                {emitida && (
                    <Alert variant="warning">
                        <AlertTitle>Esta factura ya fue incluida en un archivo para el emisor</AlertTitle>
                        <AlertDescription>Eliminarla aquí no la anula ante el SII. Si ya se emitió, corresponde una nota de crédito.</AlertDescription>
                    </Alert>
                )}
                <div className="flex flex-wrap gap-3">
                    <Button variant="destructive" onClick={() => setConfirmarEliminar('id')}>Eliminar esta factura interna (N° {id})</Button>
                    {ficha.tieneFolio && (
                        <Button variant="outline" onClick={() => setConfirmarEliminar('numero')}>Eliminar por N° de factura ({Number(enc.factura)})</Button>
                    )}
                </div>
                {ficha.tieneFolio && <p className="m-0 text-xs text-muted-foreground">«Por N° de factura» elimina solo la primera factura interna que tenga ese número y no libera las guías de despacho.</p>}
            </Seccion>

            <Dialog open={confirmarCambio} onOpenChange={setConfirmarCambio}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Cambiar la empresa a facturar?</DialogTitle>
                        <DialogDescription>Se cambiará la empresa de la factura {id} y de todos sus casos.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmarCambio(false)}>Cancelar</Button>
                        <Button onClick={cambiarEmpresa} disabled={trabajando}>{trabajando ? 'Cambiando…' : 'Sí, cambiar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={confirmarEliminar !== null} onOpenChange={(o) => !o && setConfirmarEliminar(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Eliminar la factura?</DialogTitle>
                        <DialogDescription>
                            {confirmarEliminar === 'numero'
                                ? `Se eliminará la primera factura interna con el N° de factura ${Number(enc.factura)}. Este proceso no se puede deshacer.`
                                : `Se eliminará la factura interna ${id} y sus casos quedarán disponibles. Este proceso no se puede deshacer.`}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmarEliminar(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={eliminar} disabled={trabajando}>{trabajando ? 'Eliminando…' : 'Sí, eliminar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AccionesTab;
