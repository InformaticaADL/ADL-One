import React from 'react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------------------------------------------------------

/** Etiqueta + control, alineados y con el mismo ancho que su celda de la grilla. */
export const Campo: React.FC<{ label: string; children: React.ReactNode; ayuda?: string; className?: string }> = ({ label, children, ayuda, className }) => (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {children}
        {ayuda ? <p className="m-0 text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
);

/** Select con buscador. Los textos largos se parten en varias líneas, nunca se cortan con "…". */
export const SelectBuscable: React.FC<{
    opciones: ComboboxOption[];
    valor?: string;
    onChange: (v: string) => void;
    placeholder?: string;
    buscar?: string;
    disabled?: boolean;
    className?: string;
}> = ({ opciones, valor, onChange, placeholder = 'Seleccionar…', buscar = 'Buscar…', disabled, className }) => (
    <Combobox
        options={opciones}
        value={valor}
        onValueChange={onChange}
        placeholder={placeholder}
        searchPlaceholder={buscar}
        disabled={disabled}
        className={cn('h-auto min-h-9', className)}
        wrapOptions
        wrapSelected
    />
);

/** Título de una sección dentro de una tarjeta. */
export const Seccion: React.FC<{ titulo: string; descripcion?: string; acciones?: React.ReactNode; children?: React.ReactNode }> = ({ titulo, descripcion, acciones, children }) => (
    <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
                <h3 className="m-0 text-sm font-semibold text-foreground">{titulo}</h3>
                {descripcion ? <p className="m-0 mt-0.5 text-xs text-muted-foreground">{descripcion}</p> : null}
            </div>
            {acciones ? <div className="flex flex-wrap items-center gap-2">{acciones}</div> : null}
        </div>
        {children}
    </section>
);

/** Dato de solo lectura: etiqueta arriba, valor abajo (con saltos de línea si es largo). */
export const Dato: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={cn('min-w-0', className)}>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 whitespace-normal break-words text-sm font-medium text-foreground">{children}</div>
    </div>
);

/** Selector de pocas opciones excluyentes, en una sola fila que se parte si no hay espacio. */
export const Segmentado: React.FC<{
    opciones: Array<{ value: string; label: string }>;
    valor: string;
    onChange: (v: string) => void;
    disabled?: boolean;
}> = ({ opciones, valor, onChange, disabled }) => (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {opciones.map((o) => (
            <button
                key={o.value}
                type="button"
                disabled={disabled}
                onClick={() => onChange(o.value)}
                className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50',
                    valor === o.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
            >
                {o.label}
            </button>
        ))}
    </div>
);
