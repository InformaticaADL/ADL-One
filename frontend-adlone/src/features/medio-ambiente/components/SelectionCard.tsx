import React from 'react';
import { IconChevronRight } from '@tabler/icons-react';

interface SelectionCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
}

// Fila de una lista, no una tarjeta: con un número variable de opciones (acá
// son 7), un grid de tarjetas deja una última fila desbalanceada según el
// ancho de pantalla. Una lista vertical no tiene ese problema — cabe
// cualquier cantidad de ítems sin huecos ni filas cojas.
export const SelectionCard: React.FC<SelectionCardProps> = ({ title, description, icon, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-4 rounded-lg border border-border bg-card px-[18px] py-4 text-left transition-colors hover:border-primary/50 hover:bg-accent"
        >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {icon}
            </div>

            <div className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{title}</span>
                <span className="block text-[12.5px] leading-relaxed text-muted-foreground">{description}</span>
            </div>

            <IconChevronRight size={18} className="shrink-0 text-muted-foreground" />
        </button>
    );
};
