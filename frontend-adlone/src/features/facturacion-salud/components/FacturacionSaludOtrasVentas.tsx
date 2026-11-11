import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconFileMinus, IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type EstadoLista, type MaestrosDocumentos } from '../services/facturacionSalud.service';
import { Campo, SelectBuscable } from './compartido';
import { celdaTexto, fmtClp, fmtNum, type Fila } from './formatos';
import MantencionDialog from './otras-ventas/MantencionDialog';
import NotaCreditoCasosDialog from './otras-ventas/NotaCreditoCasosDialog';
import NuevoDocumentoDialog from './otras-ventas/NuevoDocumentoDialog';

const ESTADOS: Array<{ value: EstadoLista; label: string }> = [
    { value: 'NO emitidos', label: 'Aún no incluidos en archivo' },
    { value: 'Emitidos', label: 'Ya incluidos en archivo' },
    { value: 'Todos', label: 'Todos' },
];

/** Otras ventas, notas de crédito y notas de débito (réplica de «Facturación - Otras Ventas» de ADLSOFT). */
const FacturacionSaludOtrasVentas: React.FC = () => {
    const { showToast } = useToast();
    const [maestros, setMaestros] = useState<MaestrosDocumentos | null>(null);
    const [documentos, setDocumentos] = useState<Array<Fila>>([]);
    const [estado, setEstado] = useState<EstadoLista>('NO emitidos');
    const [busqueda, setBusqueda] = useState('');
    const [cargando, setCargando] = useState(true);
    const [nuevoAbierto, setNuevoAbierto] = useState(false);
    const [notaCasosAbierto, setNotaCasosAbierto] = useState(false);
    const [mantener, setMantener] = useState<Fila | null>(null);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            setDocumentos(await facturacionSaludService.listarOtrasVentas(estado));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los documentos.') });
        } finally {
            setCargando(false);
        }
    }, [estado, showToast]);

    useEffect(() => { cargar(); }, [cargar]);

    // Si el documento abierto cambió, se muestra con los datos guardados
    useEffect(() => {
        setMantener((actual) => (actual ? documentos.find((d) => d.id_otroscobros === actual.id_otroscobros) ?? actual : actual));
    }, [documentos]);

    useEffect(() => {
        facturacionSaludService
            .getMaestrosDocumentos()
            .then(setMaestros)
            .catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los catálogos.') }));
    }, [showToast]);

    const filtrados = useMemo(() => {
        const t = busqueda.trim().toLowerCase();
        const lista = [...documentos].sort((a, b) => Number(b.id_facturacion) - Number(a.id_facturacion));
        if (!t) return lista;
        return lista.filter((d) =>
            [d.id_facturacion, d.numero_documento, d.nombre_empresaservicios, d.concepto_cobro, d.nombre_tipodocumento].some((v) => String(v ?? '').toLowerCase().includes(t))
        );
    }, [documentos, busqueda]);

    return (
        <div className="flex flex-col gap-5">
            <Card className="p-5">
                <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                    <Campo label="Buscar">
                        <div className="relative">
                            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input className="pl-9" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Empresa, glosa, N° interno o N° del documento" />
                        </div>
                    </Campo>
                    <Campo label="Mostrar"><SelectBuscable opciones={ESTADOS} valor={estado} onChange={(v) => setEstado(v as EstadoLista)} /></Campo>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => setNotaCasosAbierto(true)} disabled={!maestros}><IconFileMinus size={16} />Nota de crédito por casos</Button>
                        <Button onClick={() => setNuevoAbierto(true)} disabled={!maestros}><IconPlus size={16} />Nuevo documento</Button>
                    </div>
                </div>
            </Card>

            <Card className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-24">N° interno</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>N° SII</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="min-w-[220px]">Empresa</TableHead>
                                <TableHead className="min-w-[220px]">Glosa</TableHead>
                                <TableHead className="text-right">Monto UF</TableHead>
                                <TableHead className="text-right">Monto $</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="w-28" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cargando ? (
                                <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">Cargando documentos…</TableCell></TableRow>
                            ) : filtrados.length === 0 ? (
                                <TableRow><TableCell colSpan={10} className="py-10 text-center text-muted-foreground">No hay documentos para mostrar.</TableCell></TableRow>
                            ) : (
                                filtrados.map((d) => (
                                    <TableRow key={d.id_otroscobros}>
                                        <TableCell className={celdaTexto}>{d.id_facturacion}</TableCell>
                                        <TableCell className={celdaTexto}>{String(d.nombre_tipodocumento).trim()}</TableCell>
                                        <TableCell className={celdaTexto}>{Number(d.numero_documento) || <span className="text-muted-foreground">Sin número</span>}</TableCell>
                                        <TableCell className={celdaTexto}>{String(d.fecha_documento).trim()}</TableCell>
                                        <TableCell className={celdaTexto}>{String(d.nombre_empresaservicios).trim()}</TableCell>
                                        <TableCell className={celdaTexto}>{String(d.concepto_cobro).trim()}</TableCell>
                                        <TableCell className="text-right align-top tabular-nums">{fmtNum(d.monto_uf)}</TableCell>
                                        <TableCell className="text-right align-top tabular-nums">{fmtClp(d.monto)}</TableCell>
                                        <TableCell className="align-top"><Badge variant={String(d.emitido).trim() === 'S' ? 'secondary' : 'warning'}>{String(d.emitido).trim() === 'S' ? 'En archivo' : 'Pendiente'}</Badge></TableCell>
                                        <TableCell className="align-top"><Button variant="outline" size="sm" onClick={() => setMantener(d)}><IconPencil size={14} />Editar</Button></TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {maestros && (
                <>
                    <NuevoDocumentoDialog abierto={nuevoAbierto} onCerrar={() => setNuevoAbierto(false)} onCreado={cargar} maestros={maestros} />
                    <NotaCreditoCasosDialog abierto={notaCasosAbierto} onCerrar={() => setNotaCasosAbierto(false)} onCreada={cargar} maestros={maestros} />
                    <MantencionDialog documento={mantener} onCerrar={() => setMantener(null)} onCambio={cargar} maestros={maestros} />
                </>
            )}
        </div>
    );
};

export default FacturacionSaludOtrasVentas;
