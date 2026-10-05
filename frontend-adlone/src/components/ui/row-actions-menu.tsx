import * as React from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export interface RowAction {
    /** Omitir la acción entera (en vez de deshabilitarla) cuando no aplica a esta fila. */
    hidden?: boolean;
    disabled?: boolean;
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    /** Texto en rojo (ej. "Deshabilitar", "Eliminar"). */
    danger?: boolean;
    /** Línea divisoria ANTES de este ítem — para separar, ej., las acciones destructivas del resto. */
    separatorBefore?: boolean;
}

interface RowActionsMenuProps {
    actions: RowAction[];
    /** Accesible: qué fila es ("Acciones para Juan Pérez"). */
    label?: string;
}

/**
 * Menú de 3 puntos para la columna de acciones de una tabla — reemplaza una
 * fila de botones-ícono sueltos (que compite por espacio y obliga a ensanchar
 * la columna cada vez que se agrega una acción nueva) por un solo punto de
 * entrada. Las acciones con `hidden` no se listan (ej. "Habilitar" en una fila
 * ya activa); las que no aplican por estado pero sí quieren verse, usar
 * `disabled`.
 */
export function RowActionsMenu({ actions, label = 'Abrir menú de acciones' }: RowActionsMenuProps) {
    const visibles = actions.filter((a) => !a.hidden);
    if (visibles.length === 0) return null;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {/* icon-xs y no icon: un botón de 36px fijaba el alto de toda la
                    fila, por encima del padding de la celda. */}
                <Button variant="ghost" size="icon-xs" aria-label={label}>
                    <IconDotsVertical size={15} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {visibles.map((action, i) => (
                    <React.Fragment key={i}>
                        {action.separatorBefore && i > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                            disabled={action.disabled}
                            danger={action.danger}
                            onClick={action.onClick}
                        >
                            {action.icon}
                            {action.label}
                        </DropdownMenuItem>
                    </React.Fragment>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
