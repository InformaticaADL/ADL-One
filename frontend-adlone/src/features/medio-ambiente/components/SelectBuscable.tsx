import React from 'react';

import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';

export interface OpcionBuscable { value: string; label: string }

interface Props {
    opciones: OpcionBuscable[];
    /** '' = sin elegir (se muestra el texto de ayuda). */
    valor: string;
    onCambio: (valor: string) => void;
    placeholder: string;
    /** Marca el campo en rojo (por ejemplo un laboratorio obligatorio que falta). */
    invalido?: boolean;
    className?: string;
}

/**
 * Lista desplegable con buscador, compacta, para las filas de tablas y los diálogos.
 * El proyecto usa Combobox en todo select con más de un puñado de opciones; esto solo le fija el tamaño chico.
 */
export const SelectBuscable: React.FC<Props> = ({ opciones, valor, onCambio, placeholder, invalido, className }) => (
    <Combobox
        className={cn('h-8 min-w-[8.5rem] px-2 text-xs', invalido && 'border-destructive/60 bg-destructive/10', className)}
        contentClassName="min-w-[14rem]"
        options={opciones}
        value={valor || undefined}
        onValueChange={onCambio}
        placeholder={placeholder}
    />
);
