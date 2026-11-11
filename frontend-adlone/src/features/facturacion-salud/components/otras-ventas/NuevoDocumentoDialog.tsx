import React, { useEffect, useMemo, useState } from 'react';
import { IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '../../../../contexts/ToastContext';
import { facturacionSaludService, mensajeError, type MaestrosDocumentos } from '../../services/facturacionSalud.service';
import { Campo, Segmentado, SelectBuscable } from '../compartido';
import { aDmy, aNumero, fmtClp, fmtNum, hoyIso, type Fila } from '../formatos';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    onCreado: () => void;
    maestros: MaestrosDocumentos;
}

const TIPOS = [
    { value: '1', label: 'Factura electrónica' },
    { value: '11', label: 'Factura exenta' },
    { value: '8', label: 'Nota de crédito' },
    { value: '10', label: 'Nota de débito' },
];

const MOTIVOS = [
    { value: '1', label: 'Anula' },
    { value: '2', label: 'Corrige texto' },
    { value: '3', label: 'Corrige montos' },
];

type Oc = { ocompra: string; fecha: string; referencia: string };

/** Crea un documento de otras ventas, una nota de crédito o una nota de débito. */
const NuevoDocumentoDialog: React.FC<Props> = ({ abierto, onCerrar, onCreado, maestros }) => {
    const { showToast } = useToast();
    const [tipo, setTipo] = useState('1');
    const [impuesto, setImpuesto] = useState<'FEA' | 'FEE'>('FEA');
    const [motivoNota, setMotivoNota] = useState('1');
    const [empresa, setEmpresa] = useState('');
    const [glosa, setGlosa] = useState('');
    const [formaPago, setFormaPago] = useState('1');
    const [fecha, setFecha] = useState(hoyIso());
    const [uf, setUf] = useState('');
    const [montoUf, setMontoUf] = useState('');
    const [monto, setMonto] = useState('');
    const [numeroSii, setNumeroSii] = useState('');
    const [nota, setNota] = useState('');
    const [ordenes, setOrdenes] = useState<Oc[]>([]);
    const [nuevaOc, setNuevaOc] = useState<Oc>({ ocompra: '', fecha: '', referencia: '' });

    // Referencia de las notas
    const [refNumero, setRefNumero] = useState('');
    const [refFecha, setRefFecha] = useState('');
    const [ref, setRef] = useState<Fila | null>(null);
    const [buscando, setBuscando] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const esNota = tipo === '8' || tipo === '10';

    useEffect(() => {
        if (!abierto) return;
        setTipo('1'); setImpuesto('FEA'); setMotivoNota('1'); setEmpresa(''); setGlosa(''); setFormaPago('1'); setFecha(hoyIso());
        setUf(''); setMontoUf(''); setMonto(''); setNumeroSii(''); setNota(''); setOrdenes([]); setRefNumero(''); setRefFecha(''); setRef(null);
    }, [abierto]);

    useEffect(() => {
        setGlosa('');
        setRef(null);
        if (tipo === '11') setImpuesto('FEE');
        else if (tipo === '1') setImpuesto('FEA');
    }, [tipo]);

    const glosas = useMemo(() => maestros.glosas.filter((g) => String(g.id_tipodocumento) === tipo).map((g) => ({ value: String(g.id_glosa), label: String(g.nombre_glosa).trim() })), [maestros.glosas, tipo]);
    const empresas = useMemo(() => maestros.empresas.map((e) => ({ value: String(e.id_empresaservicio), label: `${String(e.nombre_empresaservicios).trim()}${e.rut_empresaservicios ? ` (${String(e.rut_empresaservicios).trim()})` : ''}` })), [maestros.empresas]);
    const formas = useMemo(() => maestros.formasPago.map((f) => ({ value: String(f.id_formapago), label: String(f.nombre_formapago).trim() })), [maestros.formasPago]);

    // Monto en pesos = monto en UF × valor de la UF, mientras la persona no lo escriba a mano
    const recalcular = (nuevoUf: string, nuevoMontoUf: string) => {
        const m = aNumero(nuevoUf) * aNumero(nuevoMontoUf);
        if (m > 0) setMonto(String(Math.round(m)));
    };

    const buscarReferencia = async () => {
        setBuscando(true);
        try {
            const r = await facturacionSaludService.buscarReferenciaOtraVenta({ numero: aNumero(refNumero), fecha: refFecha, tipoImpuesto: impuesto });
            if (!r) {
                setRef(null);
                return showToast({ type: 'error', message: 'No existe esa factura con esa fecha.' });
            }
            setRef(r);
            setEmpresa(String(r.id_empresaservicio));
            setUf(String(r.uf));
            setMontoUf(String(r.uf_totalfac));
            setMonto(String(Math.round(Number(r.peso_totalfac) || 0)));
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e) });
        } finally {
            setBuscando(false);
        }
    };

    const agregarOc = () => {
        if (!nuevaOc.ocompra.trim()) return;
        setOrdenes((p) => [...p, nuevaOc]);
        setNuevaOc({ ocompra: '', fecha: '', referencia: '' });
    };

    const puedeCrear = aNumero(monto) > 0 && glosa && (esNota ? !!ref : !!empresa);

    const crear = async () => {
        setGuardando(true);
        try {
            const r = await facturacionSaludService.crearOtraVenta({
                id_tipodocumento: Number(tipo),
                tipoimpuesto: impuesto,
                cod_razon: esNota ? Number(motivoNota) : 0,
                id_empresaservicio: Number(empresa),
                factura: ref ? aNumero(refNumero) : 0,
                fecha_documento: fecha,
                concepto_cobro: glosas.find((g) => g.value === glosa)?.label ?? '',
                uf: aNumero(uf),
                monto: aNumero(monto),
                monto_uf: aNumero(montoUf),
                numero_documento: aNumero(numeroSii),
                nota,
                id_formapago: Number(formaPago),
                tipo_ref: ref ? 'FE' : '',
                num_ref: ref ? String(aNumero(refNumero)) : '',
                fecha_ref: ref ? aDmy(ref.fecha_ref) : '',
                origen_referencia: ref?.origen ?? '',
                id_facturacion_referencia: ref?.id_facturacion ?? 0,
                ordenes_compra: ordenes.map((o) => ({ ocompra: o.ocompra, fecha: o.fecha, referencia: o.referencia })),
            });
            showToast({
                type: 'success',
                message: r.facturaAnulada ? `Documento ${r.id_facturacion} creado. La factura ${r.facturaAnulada.id_facturacion} fue eliminada y sus casos quedaron disponibles.` : `Documento ${r.id_facturacion} creado.`,
            });
            onCreado();
            onCerrar();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo crear el documento.') });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Nuevo documento</DialogTitle>
                    <DialogDescription>Otras ventas, notas de crédito y notas de débito.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-5">
                    <div className="flex flex-wrap items-end gap-4">
                        <Campo label="Tipo de documento"><Segmentado opciones={TIPOS} valor={tipo} onChange={setTipo} /></Campo>
                        <Campo label="Impuesto"><Segmentado opciones={[{ value: 'FEA', label: 'Afecto' }, { value: 'FEE', label: 'Exento' }]} valor={impuesto} onChange={(v) => setImpuesto(v as 'FEA' | 'FEE')} /></Campo>
                    </div>

                    {esNota && (
                        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
                            <Campo label="Motivo de la nota"><Segmentado opciones={MOTIVOS} valor={motivoNota} onChange={setMotivoNota} /></Campo>
                            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
                                <Campo label="N° de la factura que se corrige"><Input inputMode="numeric" value={refNumero} onChange={(e) => { setRefNumero(e.target.value); setRef(null); }} /></Campo>
                                <Campo label="Fecha de esa factura"><DatePicker value={refFecha} onChange={(f) => { setRefFecha(f); setRef(null); }} placeholder="Elegir fecha" /></Campo>
                                <Button variant="outline" onClick={buscarReferencia} disabled={!refNumero || !refFecha || buscando}><IconSearch size={16} />{buscando ? 'Buscando…' : 'Buscar'}</Button>
                            </div>
                            {ref && (
                                <Alert variant="success">
                                    <AlertDescription>
                                        <span className="font-medium">{String(ref.nombre_empresaservicios)}</span> · {ref.origen === 'CASOS' ? 'factura de casos' : 'otra venta'} · $ {fmtClp(ref.peso_totalfac)} ({fmtNum(ref.uf_totalfac)} UF)
                                        {tipo === '8' && motivoNota === '1' ? '. Al crear la nota, esta factura se eliminará y sus casos quedarán disponibles para facturarse otra vez.' : ''}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {!esNota && <Campo label="Empresa a facturar" className="md:col-span-2"><SelectBuscable opciones={empresas} valor={empresa} onChange={setEmpresa} placeholder="Elegir empresa" buscar="Buscar por nombre o RUT…" /></Campo>}
                        <Campo label="Glosa" className="md:col-span-2"><SelectBuscable opciones={glosas} valor={glosa} onChange={setGlosa} placeholder="Elegir glosa" /></Campo>
                        <Campo label="Fecha del documento"><DatePicker value={fecha} onChange={setFecha} placeholder="Elegir fecha" /></Campo>
                        <Campo label="Forma de pago"><SelectBuscable opciones={formas} valor={formaPago} onChange={setFormaPago} /></Campo>
                        <Campo label="Valor de la UF"><Input inputMode="decimal" value={uf} onChange={(e) => { setUf(e.target.value); recalcular(e.target.value, montoUf); }} /></Campo>
                        <Campo label="Monto en UF"><Input inputMode="decimal" value={montoUf} onChange={(e) => { setMontoUf(e.target.value); recalcular(uf, e.target.value); }} /></Campo>
                        <Campo label="Monto en pesos (neto)"><Input inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo>
                        <Campo label="N° del documento (SII)" ayuda="Se puede asignar después de emitirlo."><Input inputMode="numeric" value={numeroSii} onChange={(e) => setNumeroSii(e.target.value)} /></Campo>
                    </div>

                    <Campo label="Nota"><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>

                    {!esNota && (
                        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                            <div className="text-sm font-medium text-foreground">Órdenes de compra</div>
                            {ordenes.map((o, i) => (
                                <div key={i} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                                    <span className="min-w-0 whitespace-normal break-words">{o.ocompra}{o.fecha ? ` · ${aDmy(o.fecha)}` : ''}{o.referencia ? ` · ${o.referencia}` : ''}</span>
                                    <Button variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => setOrdenes((p) => p.filter((_, k) => k !== i))}><IconTrash size={14} /></Button>
                                </div>
                            ))}
                            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                                <Campo label="Número"><Input value={nuevaOc.ocompra} onChange={(e) => setNuevaOc({ ...nuevaOc, ocompra: e.target.value })} /></Campo>
                                <Campo label="Fecha"><DatePicker value={nuevaOc.fecha} onChange={(f) => setNuevaOc({ ...nuevaOc, fecha: f })} placeholder="Elegir fecha" /></Campo>
                                <Campo label="Referencia"><Input value={nuevaOc.referencia} onChange={(e) => setNuevaOc({ ...nuevaOc, referencia: e.target.value })} /></Campo>
                                <Button variant="outline" onClick={agregarOc} disabled={!nuevaOc.ocompra.trim()}><IconPlus size={16} />Agregar</Button>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
                    <Button onClick={crear} disabled={!puedeCrear || guardando}>{guardando ? 'Creando…' : 'Crear documento'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default NuevoDocumentoDialog;
