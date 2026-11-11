import React, { useState } from 'react';
import { IconCheck, IconChevronDown, IconChevronRight, IconPencil, IconX } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { aNumero, celdaTexto, fmtNum, type Fila } from '../formatos';

interface Props {
    casos: Fila[];
    elegidos: Set<number>;
    onElegidos: (s: Set<number>) => void;
    guardando: boolean;
    onGuardarLinea: (caso: Fila, linea: Fila, cantidad: number, unitario: number) => Promise<void>;
}

/** Casos de la empresa con el desglose de sus técnicas. Cada línea se puede ajustar a mano. */
const CasosTabla: React.FC<Props> = ({ casos, elegidos, onElegidos, guardando, onGuardarLinea }) => {
    const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
    const [edicion, setEdicion] = useState<{ clave: string; cantidad: string; unitario: string } | null>(null);

    const alternarAbierto = (id: number) =>
        setAbiertos((p) => {
            const s = new Set(p);
            if (s.has(id)) s.delete(id);
            else s.add(id);
            return s;
        });

    const alternarElegido = (id: number) => {
        const s = new Set(elegidos);
        if (s.has(id)) s.delete(id);
        else s.add(id);
        onElegidos(s);
    };

    return (
        <div className="max-h-[560px] overflow-auto rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10">
                            <Checkbox
                                checked={casos.length > 0 && elegidos.size === casos.length}
                                onCheckedChange={(c) => onElegidos(c ? new Set(casos.map((x) => Number(x.id_caso))) : new Set())}
                                aria-label="Elegir todos los casos"
                            />
                        </TableHead>
                        <TableHead className="w-10" />
                        <TableHead>Caso</TableHead>
                        <TableHead className="min-w-[180px]">Centro y agua</TableHead>
                        <TableHead className="min-w-[160px]">Veterinario</TableHead>
                        <TableHead>Recepción → informe</TableHead>
                        <TableHead className="text-right">Líneas</TableHead>
                        <TableHead className="text-right">Total UF</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {casos.map((c) => {
                        const id = Number(c.id_caso);
                        const abierto = abiertos.has(id);
                        return (
                            <React.Fragment key={id}>
                                <TableRow>
                                    <TableCell className="align-top"><Checkbox checked={elegidos.has(id)} onCheckedChange={() => alternarElegido(id)} aria-label={`Elegir caso ${c.caso_adlab}`} /></TableCell>
                                    <TableCell className="align-top">
                                        <Button variant="ghost" size="icon-xs" aria-label={abierto ? 'Ocultar técnicas' : 'Ver técnicas'} onClick={() => alternarAbierto(id)}>
                                            {abierto ? <IconChevronDown size={15} /> : <IconChevronRight size={15} />}
                                        </Button>
                                    </TableCell>
                                    <TableCell className={`${celdaTexto} font-medium`}>{c.caso_adlab || c.id_caso}</TableCell>
                                    <TableCell className={celdaTexto}>
                                        <div>{String(c.nombre_centro ?? '').trim()}</div>
                                        <div className="text-xs text-muted-foreground">{String(c.nombre_tipoagua ?? '').trim()}</div>
                                    </TableCell>
                                    <TableCell className={celdaTexto}>{String(c.cliente_entrega ?? '').trim()}</TableCell>
                                    <TableCell className={celdaTexto}>{String(c.fecha_recepcion ?? '').trim()} → {String(c.fecha_informe ?? '').trim()}</TableCell>
                                    <TableCell className="text-right align-top tabular-nums">{c.lineas?.length || 0}</TableCell>
                                    <TableCell className="text-right align-top font-semibold tabular-nums">{fmtNum(c.uf_totalfac, 3)}</TableCell>
                                </TableRow>

                                {abierto && (
                                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                                        <TableCell colSpan={8} className="p-4">
                                            <div className="mb-2 text-xs text-muted-foreground">Especie: {String(c.nombre_especie ?? '—').trim()} · Recepción: {c.n_recepcion || '—'}</div>
                                            <div className="overflow-x-auto rounded-md border border-border bg-background">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Ítem</TableHead>
                                                            <TableHead className="min-w-[200px]">Técnica</TableHead>
                                                            <TableHead className="min-w-[140px]">Órgano / medio</TableHead>
                                                            <TableHead>Ingreso</TableHead>
                                                            <TableHead className="min-w-[160px]">Regla</TableHead>
                                                            <TableHead className="text-right">Cantidad</TableHead>
                                                            <TableHead className="text-right">UF unitario</TableHead>
                                                            <TableHead className="text-right">UF total</TableHead>
                                                            <TableHead className="w-32" />
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {(c.lineas || []).map((l: Fila) => {
                                                            const clave = `${id}_${l.item}_${l.id_tecnica}`;
                                                            const editando = edicion?.clave === clave;
                                                            return (
                                                                <TableRow key={clave}>
                                                                    <TableCell className="align-top tabular-nums">{l.item}</TableCell>
                                                                    <TableCell className={celdaTexto}>[{l.id_tecnica}] {String(l.nombre_tecnica ?? '').trim()}</TableCell>
                                                                    <TableCell className={celdaTexto}>{String(l.nombre_organo ?? '').trim()}{l.nombre_medios ? ` / ${String(l.nombre_medios).trim()}` : ''}</TableCell>
                                                                    <TableCell className={celdaTexto}>{String(l.tipoingreso ?? '').trim()} (I: {l.ind_nmuestras} / P: {l.pol_npooles})</TableCell>
                                                                    <TableCell className="align-top"><Badge variant="outline" className="whitespace-normal break-words">{l.regla_aplicada || (l.mf === 1 ? 'Valorizado' : 'Pendiente')}</Badge></TableCell>
                                                                    <TableCell className="text-right align-top tabular-nums">
                                                                        {editando ? <Input className="h-8 w-20 text-right" inputMode="numeric" value={edicion!.cantidad} onChange={(e) => setEdicion({ ...edicion!, cantidad: e.target.value })} /> : l.n_analisis}
                                                                    </TableCell>
                                                                    <TableCell className="text-right align-top tabular-nums">
                                                                        {editando ? <Input className="h-8 w-28 text-right" inputMode="decimal" value={edicion!.unitario} onChange={(e) => setEdicion({ ...edicion!, unitario: e.target.value })} /> : fmtNum(l.vtaunitario, 4)}
                                                                    </TableCell>
                                                                    <TableCell className="text-right align-top font-semibold tabular-nums">{fmtNum(l.vtatotal, 3)}</TableCell>
                                                                    <TableCell className="align-top">
                                                                        {editando ? (
                                                                            <div className="flex justify-end gap-1">
                                                                                <Button size="icon-xs" aria-label="Guardar" disabled={guardando} onClick={async () => { await onGuardarLinea(c, l, aNumero(edicion!.cantidad), aNumero(edicion!.unitario)); setEdicion(null); }}><IconCheck size={13} /></Button>
                                                                                <Button variant="ghost" size="icon-xs" aria-label="Cancelar" onClick={() => setEdicion(null)}><IconX size={13} /></Button>
                                                                            </div>
                                                                        ) : (
                                                                            <Button variant="ghost" size="sm" onClick={() => setEdicion({ clave, cantidad: String(l.n_analisis || 1), unitario: String(l.vtaunitario || 0) })}><IconPencil size={13} />Ajustar</Button>
                                                                        )}
                                                                    </TableCell>
                                                                </TableRow>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
};

export default CasosTabla;
