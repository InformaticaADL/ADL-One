import React, { useMemo, useState } from 'react';
import { IconFileAnalytics, IconDownload, IconAlertTriangle, IconCircleCheck, IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// Informe completo de un análisis de Excel (Inventario o Verificaciones de T°).
// Es solo lectura: junta en un solo lugar lo detectado bien, lo que difiere (y en qué
// campo), lo que no existe en el sistema, las advertencias y los errores de lectura.
// Sirve para ambos analizadores, que comparten la forma de sus items.

export interface InformeItem {
    rowNumber: number;
    codigo: string | null;
    nombre?: string | null;
    status: 'coincide' | 'difiere' | 'no_existe' | 'no_encontrado';
    diffs: { campo: string; etiqueta: string; valorExcel: unknown; valorBD: unknown }[];
    warnings: string[];
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    titulo: string;
    archivo?: string | null;
    items: InformeItem[];
    rowErrors: { rowNumber: number; message: string }[];
}

const esAusente = (s: InformeItem['status']) => s === 'no_existe' || s === 'no_encontrado';

const fmt = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    return String(v);
};

// Agrupa advertencias iguales ignorando lo que va entre comillas (el nombre concreto).
const plantillaAdvertencia = (w: string) => w.replace(/"[^"]*"/g, '"…"');

const csvCelda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

export const ImportacionInformeModal: React.FC<Props> = ({ isOpen, onClose, titulo, archivo, items, rowErrors }) => {
    const [abiertos, setAbiertos] = useState<Set<number>>(new Set());
    const [busqueda, setBusqueda] = useState('');

    const datos = useMemo(() => {
        const coinciden = items.filter((i) => i.status === 'coincide');
        const difieren = items.filter((i) => i.status === 'difiere');
        const ausentes = items.filter((i) => esAusente(i.status));
        const conAdvertencias = items.filter((i) => i.warnings.length > 0);

        const porCampo = new Map<string, { etiqueta: string; cantidad: number; ejemplos: string[] }>();
        difieren.forEach((it) => it.diffs.forEach((d) => {
            const actual = porCampo.get(d.campo) || { etiqueta: d.etiqueta, cantidad: 0, ejemplos: [] };
            actual.cantidad += 1;
            if (actual.ejemplos.length < 2) actual.ejemplos.push(`${it.codigo}: ${fmt(d.valorBD)} → ${fmt(d.valorExcel)}`);
            porCampo.set(d.campo, actual);
        }));

        const porAdvertencia = new Map<string, number>();
        items.forEach((it) => it.warnings.forEach((w) => {
            const k = plantillaAdvertencia(w);
            porAdvertencia.set(k, (porAdvertencia.get(k) || 0) + 1);
        }));

        const repetidos = new Map<string, number>();
        items.forEach((it) => { if (it.codigo) repetidos.set(it.codigo, (repetidos.get(it.codigo) || 0) + 1); });

        return {
            coinciden, difieren, ausentes, conAdvertencias,
            porCampo: [...porCampo.entries()].sort((a, b) => b[1].cantidad - a[1].cantidad),
            porAdvertencia: [...porAdvertencia.entries()].sort((a, b) => b[1] - a[1]),
            repetidos: [...repetidos.entries()].filter(([, n]) => n > 1),
        };
    }, [items]);

    const filtrar = (lista: InformeItem[]) => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return lista;
        return lista.filter((i) => `${i.codigo || ''} ${i.nombre || ''}`.toLowerCase().includes(q));
    };

    const alternar = (fila: number) => setAbiertos((prev) => {
        const n = new Set(prev);
        if (n.has(fila)) n.delete(fila); else n.add(fila);
        return n;
    });

    const descargarCsv = () => {
        const filas: string[] = [['Fila', 'Código', 'Nombre', 'Resultado', 'Campo', 'Valor en el sistema', 'Valor en el Excel', 'Advertencias'].map(csvCelda).join(';')];
        items.forEach((it) => {
            const resultado = it.status === 'coincide' ? 'Coincide' : it.status === 'difiere' ? 'Difiere' : 'No existe en el sistema';
            const adv = it.warnings.join(' | ');
            if (it.status === 'difiere' && it.diffs.length > 0) {
                it.diffs.forEach((d) => filas.push([it.rowNumber, it.codigo, it.nombre, resultado, d.etiqueta, fmt(d.valorBD), fmt(d.valorExcel), adv].map(csvCelda).join(';')));
            } else {
                filas.push([it.rowNumber, it.codigo, it.nombre, resultado, '', '', '', adv].map(csvCelda).join(';'));
            }
        });
        rowErrors.forEach((e) => filas.push([e.rowNumber, '', '', 'Error de lectura', '', '', '', e.message].map(csvCelda).join(';')));
        const blob = new Blob(['﻿' + filas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `informe-importacion-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const Buscador = (
        <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por código o nombre…"
            className="h-8 w-full max-w-xs rounded-md border border-border bg-background px-3 text-sm"
        />
    );

    const listaSimple = ({ lista, vacio, extra }: { lista: InformeItem[]; vacio: string; extra?: (i: InformeItem) => React.ReactNode }) => {
        const visibles = filtrar(lista);
        if (lista.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">{vacio}</p>;
        return (
            <div className="flex flex-col gap-2">
                {Buscador}
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-16">Fila</TableHead>
                            <TableHead>Código</TableHead>
                            <TableHead>Nombre</TableHead>
                            {extra && <TableHead>Detalle</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {visibles.map((it) => (
                            <TableRow key={it.rowNumber}>
                                <TableCell className="text-xs text-muted-foreground">{it.rowNumber}</TableCell>
                                <TableCell className="font-semibold">{it.codigo || '—'}</TableCell>
                                <TableCell>{it.nombre || '—'}</TableCell>
                                {extra && <TableCell className="text-xs text-muted-foreground">{extra(it)}</TableCell>}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {visibles.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados para la búsqueda.</p>}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col gap-4 overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-2">
                        <IconFileAnalytics size={20} className="text-primary" />
                        Informe del análisis: {titulo}
                        {archivo && <span className="text-xs font-normal text-muted-foreground">({archivo})</span>}
                        <Button size="sm" variant="outline" className="ml-auto" onClick={descargarCsv}>
                            <IconDownload size={14} /> Descargar CSV
                        </Button>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="resumen" className="flex min-h-0 flex-1 flex-col">
                    <TabsList className="flex-wrap">
                        <TabsTrigger value="resumen">Resumen</TabsTrigger>
                        <TabsTrigger value="coinciden">Coinciden ({datos.coinciden.length})</TabsTrigger>
                        <TabsTrigger value="difieren">Difieren ({datos.difieren.length})</TabsTrigger>
                        <TabsTrigger value="ausentes">No existen ({datos.ausentes.length})</TabsTrigger>
                        <TabsTrigger value="alertas">Advertencias y errores ({datos.conAdvertencias.length + rowErrors.length})</TabsTrigger>
                    </TabsList>

                    <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                        <TabsContent value="resumen" className="mt-0 flex flex-col gap-6">
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                                {[
                                    ['Filas leídas', items.length],
                                    ['Coinciden', datos.coinciden.length],
                                    ['Difieren', datos.difieren.length],
                                    ['No existen', datos.ausentes.length],
                                    ['Errores de lectura', rowErrors.length],
                                ].map(([l, v]) => (
                                    <div key={l as string} className="rounded-md border border-border p-3">
                                        <div className="text-2xl font-semibold tabular-nums">{v}</div>
                                        <div className="text-xs text-muted-foreground">{l}</div>
                                    </div>
                                ))}
                            </div>

                            <section>
                                <h4 className="mb-2 text-sm font-semibold">En qué campos difieren</h4>
                                {datos.porCampo.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No hay diferencias.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Campo</TableHead>
                                                <TableHead className="w-24 text-right">Equipos</TableHead>
                                                <TableHead>Ejemplos (sistema → Excel)</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {datos.porCampo.map(([campo, info]) => (
                                                <TableRow key={campo}>
                                                    <TableCell className="font-medium">{info.etiqueta}</TableCell>
                                                    <TableCell className="text-right tabular-nums">{info.cantidad}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{info.ejemplos.join('  ·  ')}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </section>

                            <section>
                                <h4 className="mb-2 text-sm font-semibold">Advertencias frecuentes</h4>
                                {datos.porAdvertencia.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Sin advertencias.</p>
                                ) : (
                                    <ul className="flex flex-col gap-1 text-sm">
                                        {datos.porAdvertencia.map(([texto, n]) => (
                                            <li key={texto} className="flex items-start gap-2">
                                                <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
                                                <span><strong className="tabular-nums">{n}</strong> × {texto}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>

                            {datos.repetidos.length > 0 && (
                                <section>
                                    <h4 className="mb-2 text-sm font-semibold">Códigos repetidos en el Excel</h4>
                                    <p className="text-sm text-muted-foreground">
                                        {datos.repetidos.map(([c, n]) => `${c} (${n} filas)`).join(', ')}
                                    </p>
                                </section>
                            )}
                        </TabsContent>

                        <TabsContent value="coinciden" className="mt-0">
                            {listaSimple({ lista: datos.coinciden, vacio: "Ningún equipo coincide por completo con el sistema.", extra: () => <span className="inline-flex items-center gap-1 text-success"><IconCircleCheck size={14} /> Sin diferencias</span> })}
                        </TabsContent>

                        <TabsContent value="difieren" className="mt-0">
                            {datos.difieren.length === 0 ? (
                                <p className="py-8 text-center text-sm text-muted-foreground">No hay equipos con diferencias.</p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {Buscador}
                                    {filtrar(datos.difieren).map((it) => {
                                        const abierto = abiertos.has(it.rowNumber);
                                        return (
                                            <div key={it.rowNumber} className="rounded-md border border-border">
                                                <button type="button" onClick={() => alternar(it.rowNumber)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm">
                                                    {abierto ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                                    <span className="font-semibold">{it.codigo || '—'}</span>
                                                    <span className="text-muted-foreground">{it.nombre || ''}</span>
                                                    <span className="ml-auto text-xs text-muted-foreground">fila {it.rowNumber} · {it.diffs.length} campo(s): {it.diffs.map((d) => d.etiqueta).join(', ')}</span>
                                                </button>
                                                {abierto && (
                                                    <div className="border-t border-border p-2">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="hover:bg-transparent">
                                                                    <TableHead>Campo</TableHead>
                                                                    <TableHead>En el sistema</TableHead>
                                                                    <TableHead>En el Excel</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {it.diffs.map((d) => (
                                                                    <TableRow key={d.campo}>
                                                                        <TableCell className="font-medium">{d.etiqueta}</TableCell>
                                                                        <TableCell className="max-w-sm whitespace-pre-wrap break-words text-xs text-muted-foreground">{fmt(d.valorBD)}</TableCell>
                                                                        <TableCell className="max-w-sm whitespace-pre-wrap break-words text-xs">{fmt(d.valorExcel)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                        {it.warnings.length > 0 && (
                                                            <ul className="mt-2 text-xs text-warning">{it.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}</ul>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="ausentes" className="mt-0">
                            {listaSimple({ lista: datos.ausentes, vacio: "Todos los equipos del Excel existen en el sistema.", extra: (i) => i.warnings.join(' · ') || 'No existe un equipo con este código' })}
                        </TabsContent>

                        <TabsContent value="alertas" className="mt-0 flex flex-col gap-6">
                            <section>
                                <h4 className="mb-2 text-sm font-semibold">Errores de lectura ({rowErrors.length})</h4>
                                {rowErrors.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Todas las filas se leyeron sin problemas.</p>
                                ) : (
                                    <ul className="flex flex-col gap-1 text-sm">
                                        {rowErrors.map((e, i) => <li key={i}><span className="text-muted-foreground">Fila {e.rowNumber}:</span> {e.message}</li>)}
                                    </ul>
                                )}
                            </section>
                            <section>
                                <h4 className="mb-2 text-sm font-semibold">Equipos con advertencias ({datos.conAdvertencias.length})</h4>
                                {datos.conAdvertencias.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Ningún equipo tiene advertencias.</p>
                                ) : (
                                    <>
                                        {Buscador}
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-16">Fila</TableHead>
                                                    <TableHead>Código</TableHead>
                                                    <TableHead>Advertencia</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filtrar(datos.conAdvertencias).map((it) => (
                                                    <TableRow key={it.rowNumber}>
                                                        <TableCell className="text-xs text-muted-foreground">{it.rowNumber}</TableCell>
                                                        <TableCell className="font-semibold">{it.codigo || '—'}</TableCell>
                                                        <TableCell className="text-xs">{it.warnings.join(' · ')}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </>
                                )}
                            </section>
                        </TabsContent>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
};
