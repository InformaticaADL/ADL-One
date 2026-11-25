import React from 'react';
import { cn } from '@/lib/utils';
import type { Marca } from '../services/verificacionTerreno.service';

// Cumple / No cumple / No aplica, como las tres casillas que trae impreso el formulario.
const OPCIONES: [Marca, string][] = [['C', 'C'], ['NC', 'NC'], ['NA', 'N/A']];

interface Props {
    items: [string, string][];
    valores: Record<string, Marca>;
    editable: boolean;
    onChange: (valores: Record<string, Marca>) => void;
    titulo?: string;
}

export const SelectorMarca: React.FC<Props> = ({ items, valores, editable, onChange, titulo }) => (
    <div>
        {titulo && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>}
        <div className="mt-1 flex flex-col gap-0.5">
            {items.map(([clave, etiqueta]) => (
                <div key={clave} className="flex items-center justify-between gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted/60">
                    <span className="min-w-0 flex-1 truncate" title={etiqueta}>{etiqueta}</span>
                    <div className="flex shrink-0 gap-0.5">
                        {OPCIONES.map(([valor, texto]) => (
                            <button
                                key={valor}
                                type="button"
                                disabled={!editable}
                                onClick={() => onChange({ ...valores, [clave]: valor })}
                                className={cn('w-9 rounded border px-1 py-0.5 text-[10px] transition-colors',
                                    valores[clave] === valor
                                        ? 'border-primary bg-primary/10 font-semibold text-primary'
                                        : 'border-border text-muted-foreground hover:bg-muted')}
                            >
                                {texto}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
);

export default SelectorMarca;
