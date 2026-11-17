import * as React from 'react';

import { cn } from '@/lib/utils';

interface RadioProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange?: () => void;
}

/**
 * Opción de radio con el diseño del sistema (círculo de 20 px con borde y punto central del color primario), en lugar del radio
 * nativo del navegador. Se usa igual que un radio: `checked` y `onChange`; dentro de un <label> el clic en el texto también lo marca.
 */
export const Radio = React.forwardRef<HTMLButtonElement, RadioProps>(({ checked, onChange, className, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="radio"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => { if (!checked) onChange?.(); }}
    className={cn(
      'peer inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
      checked ? 'border-primary' : 'hover:border-primary/60',
      className,
    )}
    {...props}
  >
    {checked && <span className="size-2.5 rounded-full bg-primary" />}
  </button>
));
Radio.displayName = 'Radio';
