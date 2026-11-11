import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError } from '../../services/facturacionSalud.service';
import { aDmy, celdaTexto, fmtNum, type Fila } from '../formatos';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    idFacturacion: number;
    idEmpresaServicio: number;
    uf: number;
    /** Recibe la línea de "otros ingresos" que cobra las guías elegidas. */
    onAgregar: (linea: { id_otrosingresos: number; nombre_otrosingresos: string; valor: number }) => void;
}

/** Guías de despacho a clientes pendientes de la empresa: se eligen, se calcula su neto en UF y se agregan como otro ingreso. */
const GuiasDialog: React.FC<Props> = ({ abierto, onCerrar, idFacturacion, idEmpresaServicio, uf, onAgregar }) => {
    const { showToast } = useToast();
    const [guias, setGuias] = useState<Array<Fila>>([]);
    const [elegidas, setElegidas] = useState<Set<number>>(new Set());
    const [neto, setNeto] = useState<number | null>(null);
    const [cargando, setCargando] = useState(false);
    const [trabajando, setTrabajando] = useState(false);

    useEffect(() => {
        if (!abierto) return;
        setElegidas(new Set());
        setNeto(null);
        setCargando(true);
        facturacionSaludService
            .listarGuiasPendientes(idEmpresaServicio)
            .then(setGuias)
            .catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar las guías.') }))
            .finally(() => setCargando(false));
    }, [abierto, idEmpresaServicio, showToast]);

    const ids = useMemo(() => Array.from(elegidas), [elegidas]);

    const alternar = (id: number) => {
        setNeto(null);
        setElegidas((prev) => {
            const sig = new Set(prev);
            if (sig.has(id)) sig.delete(id);
            else sig.add(id);
            return sig;
        });
    };

    const calcular = async () => {
        setTrabajando(true);
        try {
            const r = await facturacionSaludService.calcularNetoGuias(ids, uf);
            setNeto(r.netoUf);
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setTrabajando(false);
        }
    };

    const agregar = async () => {
        setTrabajando(true);
        try {
            const linea = await facturacionSaludService.reservarGuias(idFacturacion, ids, uf);
            onAgregar({ id_otrosingresos: linea.id_otrosingresos, nombre_otrosingresos: linea.nombre_otrosingresos, valor: linea.valor });
            showToast({ type: 'success', message: 'Guías agregadas. Recuerda grabar la factura para asociarlas.' });
            onCerrar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setTrabajando(false);
        }
    };

    return (
        <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Guías de despacho a clientes</DialogTitle>
                    <DialogDescription>
                        Elige las guías que se cobran en esta factura. Los montos en pesos se convierten a UF con el valor {fmtNum(uf, 2)}; los montos en dólares no se suman.
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[50vh] overflow-auto rounded-md border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-10" />
                                <TableHead>N° guía</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Unidad de negocio</TableHead>
                                <TableHead>Solicitado por</TableHead>
                                <TableHead>Laboratorio</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cargando ? (
                                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Cargando guías…</TableCell></TableRow>
                            ) : guias.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">La empresa no tiene guías pendientes.</TableCell></TableRow>
                            ) : (
                                guias.map((g) => (
                                    <TableRow key={g.id_gd} className="cursor-pointer" onClick={() => alternar(Number(g.id_gd))}>
                                        <TableCell className="align-top"><Checkbox checked={elegidas.has(Number(g.id_gd))} onCheckedChange={() => alternar(Number(g.id_gd))} /></TableCell>
                                        <TableCell className={celdaTexto}>{g.gd}</TableCell>
                                        <TableCell className={celdaTexto}>{aDmy(g.fecha_gd) || g.fecha_gd}</TableCell>
                                        <TableCell className={celdaTexto}>{String(g.nombre_unegocio ?? '').trim()}</TableCell>
                                        <TableCell className={celdaTexto}>{String(g.solicitado_por ?? '').trim()}</TableCell>
                                        <TableCell className={celdaTexto}>{String(g.nombre_lugaranalisis ?? '').trim()}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                <DialogFooter className="items-center gap-2 sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        {neto === null ? `${ids.length} guía(s) elegida(s)` : <>Neto de las guías: <span className="font-semibold text-foreground">{fmtNum(neto, 3)} UF</span></>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
                        <Button variant="outline" disabled={!ids.length || trabajando} onClick={calcular}>Calcular neto</Button>
                        <Button disabled={neto === null || trabajando} onClick={agregar}>Agregar a la factura</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default GuiasDialog;
