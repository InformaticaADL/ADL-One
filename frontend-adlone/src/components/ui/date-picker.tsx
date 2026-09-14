import * as React from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

interface DatePickerProps {
  /** Fecha en formato 'yyyy-MM-dd', igual al value de un <input type="date">. */
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// Reemplazo del <input type="date"> nativo del navegador por un calendario
// desplegable (Popover + react-day-picker), consistente con el resto de la
// UI. Misma forma de dato (string 'yyyy-MM-dd') que el input nativo, así que
// es un reemplazo directo en cualquier filtro/formulario existente.
export function DatePicker({ value, onChange, placeholder = 'Selecciona una fecha', className, disabled }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseISO(value) : undefined;
  const isValidDate = selected && isValid(selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            !isValidDate && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-60" />
          <span className="flex-1 truncate text-left">
            {isValidDate ? format(selected, 'dd/MM/yyyy', { locale: es }) : placeholder}
          </span>
          {isValidDate && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpiar fecha"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={isValidDate ? selected : undefined}
          onSelect={(date) => {
            onChange(date ? format(date, 'yyyy-MM-dd') : '');
            setOpen(false);
          }}
          locale={es}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
