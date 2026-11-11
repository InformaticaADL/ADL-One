import React, { useMemo, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { MaestrosDocumentos } from '../../services/facturacionSalud.service';
import { Campo, SelectBuscable } from '../compartido';
import { aDmy, fmtClp, fmtNum, hoyIso } from '../formatos';

export interface GrupoVista { label: string; casos: number; totalUf: number }

export interface DatosFacturas {
    fecha_facturacion: string;
    id_formapago: number;
    id_glosa: number;
    glosa: string;
    mes: string;
    nota: string;
    ordenes_compra: Array<{ tipo: 'OC' | 'HES'; ocompra: string; ocompra_fecha: string; referencia: string }>;
}

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    empresa: string;
    grupos: GrupoVista[];
    criterio: string;
    uf: number;
    idFormaPagoEmpresa?: number;
    maestros: MaestrosDocumentos | null;
    creando: boolean;
    onConfirmar: (datos: DatosFacturas) => void;
}

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
const opcionesMes = () => {
    const hoy = new Date();
    return Array.from({ length: 18 }, (_, i) => {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() - 14 + i, 1);
        const t = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
        return { value: t, label: t };
    });
};

/** Las glosas con estos códigos llevan el mes y el año en el texto de la factura (regla de ADLSOFT). */
const glosaLlevaMes = (id: number) => id >= 14 && id <= 22;

/** Datos que se piden al crear las facturas: fecha, forma de pago, glosa, nota y órdenes de compra. Quien lo usa lo vuelve a montar (con `key`) cada vez que se abre, para empezar en blanco. */
const CrearFacturasDialog: React.FC<Props> = ({ abierto, onCerrar, empresa, grupos, criterio, uf, idFormaPagoEmpresa, maestros, creando, onConfirmar }) => {
    const [fecha, setFecha] = useState(hoyIso());
    const [formaPago, setFormaPago] = useState(() => String(idFormaPagoEmpresa || maestros?.formasPago[0]?.id_formapago || ''));
    const [glosaId, setGlosaId] = useState('');
    const [mes, setMes] = useState('');
    const [nota, setNota] = useState('');
    const [ordenes, setOrdenes] = useState<DatosFacturas['ordenes_compra']>([]);
    const [nueva, setNueva] = useState({ tipo: 'OC' as 'OC' | 'HES', ocompra: '', fecha: '', referencia: '' });


    const glosas = useMemo(() => (maestros?.glosas ?? []).filter((g) => Number(g.id_tipodocumento) === 1).map((g) => ({ value: String(g.id_glosa), label: String(g.nombre_glosa).trim() })), [maestros]);
    const formas = useMemo(() => (maestros?.formasPago ?? []).map((f) => ({ value: String(f.id_formapago), label: String(f.nombre_formapago).trim() })), [maestros]);
    const meses = useMemo(() => opcionesMes(), []);

    const nombreGlosa = glosas.find((g) => g.value === glosaId)?.label ?? '';
    const lleva = glosaLlevaMes(Number(glosaId));
    const textoGlosa = lleva && mes ? `${nombreGlosa}, ${mes}` : nombreGlosa;
    const completo = !!fecha && !!formaPago && !!glosaId && (!lleva || !!mes);

    const agregar = () => {
        if (!nueva.ocompra.trim()) return;
        setOrdenes((p) => [...p, { tipo: nueva.tipo, ocompra: nueva.ocompra.trim(), ocompra_fecha: nueva.fecha, referencia: nueva.referencia.trim() }]);
        setNueva({ ...nueva, ocompra: '', fecha: '', referencia: '' });
    };

    return (
        <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
            <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Crear facturas · {empresa}</DialogTitle>
                    <DialogDescription>Los casos elegidos quedarán facturados y se asignará un N° interno a cada factura.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-5">
                    <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <p className="m-0 mb-2 text-sm font-medium text-foreground">Se crearán {grupos.length} factura(s) · agrupadas por «{criterio}»</p>
                        <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                            {grupos.map((g, i) => (
                                <div key={i} className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm">
                                    <span className="min-w-0 whitespace-normal break-words">{g.label}</span>
                                    <span className="tabular-nums text-muted-foreground">{g.casos} caso(s) · <span className="font-semibold text-foreground">{fmtNum(g.totalUf)} UF</span> · $ {fmtClp(g.totalUf * uf)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Campo label="Fecha de facturación"><DatePicker value={fecha} onChange={setFecha} placeholder="Elegir fecha" /></Campo>
                        <Campo label="Forma de pago"><SelectBuscable opciones={formas} valor={formaPago} onChange={setFormaPago} placeholder="Elegir forma de pago" /></Campo>
                        <Campo label="Glosa de la factura" className="md:col-span-2"><SelectBuscable opciones={glosas} valor={glosaId} onChange={setGlosaId} placeholder="Elegir glosa" /></Campo>
                        {lleva && <Campo label="Mes / año" ayuda="Esta glosa lleva el mes y el año en el texto."><SelectBuscable opciones={meses} valor={mes} onChange={setMes} placeholder="Elegir mes" /></Campo>}
                        {textoGlosa && <Campo label="Así saldrá la glosa" className={lleva ? '' : 'md:col-span-2'}><div className="min-h-9 whitespace-normal break-words rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{textoGlosa}</div></Campo>}
                    </div>

                    <Campo label="Nota para el emisor" ayuda="Sale en el archivo como «Nota: …». Es opcional."><Textarea rows={2} value={nota} onChange={(e) => setNota(e.target.value)} /></Campo>

                    <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
                        <div className="text-sm font-medium text-foreground">Órdenes de compra y HES <span className="font-normal text-muted-foreground">(opcional, se copian a todas las facturas)</span></div>
                        {ordenes.map((o, i) => (
                            <div key={i} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                                <span className="min-w-0 whitespace-normal break-words"><Badge variant="outline" className="mr-2">{o.tipo}</Badge>{o.ocompra}{o.ocompra_fecha ? ` · ${aDmy(o.ocompra_fecha)}` : ''}{o.referencia ? ` · ${o.referencia}` : ''}</span>
                                <Button variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => setOrdenes((p) => p.filter((_, k) => k !== i))}><IconTrash size={14} /></Button>
                            </div>
                        ))}
                        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[110px_1fr_1fr_1.3fr_auto]">
                            <Campo label="Tipo"><SelectBuscable opciones={[{ value: 'OC', label: 'OC' }, { value: 'HES', label: 'HES' }]} valor={nueva.tipo} onChange={(v) => setNueva({ ...nueva, tipo: v as 'OC' | 'HES' })} /></Campo>
                            <Campo label="Número"><Input value={nueva.ocompra} onChange={(e) => setNueva({ ...nueva, ocompra: e.target.value })} /></Campo>
                            <Campo label="Fecha"><DatePicker value={nueva.fecha} onChange={(f) => setNueva({ ...nueva, fecha: f })} placeholder="Elegir fecha" /></Campo>
                            <Campo label="Referencia"><Input value={nueva.referencia} onChange={(e) => setNueva({ ...nueva, referencia: e.target.value })} /></Campo>
                            <Button variant="outline" onClick={agregar} disabled={!nueva.ocompra.trim()}><IconPlus size={16} />Agregar</Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onCerrar}>Cancelar</Button>
                    <Button
                        disabled={!completo || creando}
                        onClick={() => onConfirmar({
                            fecha_facturacion: fecha, id_formapago: Number(formaPago), id_glosa: Number(glosaId), glosa: textoGlosa, mes, nota, ordenes_compra: ordenes,
                        })}
                    >
                        {creando ? 'Creando facturas…' : `Crear ${grupos.length} factura(s)`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CrearFacturasDialog;
