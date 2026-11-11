import React from 'react';
import { IconRefresh } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Campo, Seccion, SelectBuscable } from '../compartido';

export interface Programa { eligeprograma: number; nombre: string; soporta_ensilaje_proa?: boolean }

interface Props {
    programas: Programa[];
    programa: number;
    onPrograma: (v: number) => void;
    fechaIni: string;
    fechaFin: string;
    onFechaIni: (v: string) => void;
    onFechaFin: (v: string) => void;
    informeIni: string;
    informeFin: string;
    onInformeIni: (v: string) => void;
    onInformeFin: (v: string) => void;
    uf: string;
    usd: string;
    onUf: (v: string) => void;
    onUsd: (v: string) => void;
    ensilaje: boolean;
    proa: boolean;
    onEnsilaje: (v: boolean) => void;
    onProa: (v: boolean) => void;
    onRecargar: () => void;
}

/** Parámetros de la valorización: programa, fechas de los datos a procesar, valor de la UF y del dólar. */
const ParametrosCard: React.FC<Props> = (p) => {
    const actual = p.programas.find((x) => x.eligeprograma === p.programa);
    return (
        <Card className="p-5">
            <Seccion
                titulo="Programa y parámetros"
                descripcion="Elige el programa y el rango de fechas de informe de los datos que se van a facturar."
                acciones={<Button variant="outline" size="sm" onClick={p.onRecargar}><IconRefresh size={15} />Recargar empresas</Button>}
            >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Campo label="Programa" className="md:col-span-2">
                        <SelectBuscable
                            opciones={p.programas.map((x) => ({ value: String(x.eligeprograma), label: x.nombre }))}
                            valor={String(p.programa)}
                            onChange={(v) => p.onPrograma(Number(v))}
                            placeholder="Elegir programa"
                        />
                    </Campo>
                    <Campo label="Valor de la UF" ayuda="Obligatorio para valorizar.">
                        <Input inputMode="decimal" value={p.uf} onChange={(e) => p.onUf(e.target.value)} placeholder="Ej.: 39.500,00" />
                    </Campo>
                    <Campo label="Valor del dólar" ayuda="Solo para la empresa que se factura también en dólares.">
                        <Input inputMode="decimal" value={p.usd} onChange={(e) => p.onUsd(e.target.value)} placeholder="Opcional" />
                    </Campo>
                    <Campo label="Datos a procesar · desde" ayuda="Fecha de informe de los casos."><DatePicker value={p.fechaIni} onChange={p.onFechaIni} placeholder="Elegir fecha" /></Campo>
                    <Campo label="Datos a procesar · hasta"><DatePicker value={p.fechaFin} onChange={p.onFechaFin} placeholder="Elegir fecha" /></Campo>
                    <Campo label="Informe al cliente · desde" ayuda="Solo se anota en la factura; no filtra."><DatePicker value={p.informeIni} onChange={p.onInformeIni} placeholder="Elegir fecha" /></Campo>
                    <Campo label="Informe al cliente · hasta"><DatePicker value={p.informeFin} onChange={p.onInformeFin} placeholder="Elegir fecha" /></Campo>
                </div>

                {actual?.soporta_ensilaje_proa && (
                    <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-muted/30 px-4 py-3">
                        <span className="text-sm font-medium text-foreground">Modalidad de Servicio Diagnóstico</span>
                        <div className="flex items-center gap-2">
                            <Checkbox id="chk-ensilaje" checked={p.ensilaje} onCheckedChange={(c) => { p.onEnsilaje(!!c); if (c) p.onProa(false); }} />
                            <Label htmlFor="chk-ensilaje" className="text-sm font-normal">Solo ensilaje</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox id="chk-proa" checked={p.proa} onCheckedChange={(c) => { p.onProa(!!c); if (c) p.onEnsilaje(false); }} />
                            <Label htmlFor="chk-proa" className="text-sm font-normal">Solo PROA</Label>
                        </div>
                    </div>
                )}
            </Seccion>
        </Card>
    );
};

export default ParametrosCard;
