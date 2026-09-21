import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Mismos tonos semánticos que badge.tsx (success/warning/destructive) — un
// solo lenguaje de color para "estado" en toda la app, en vez de que cada
// alerta ad-hoc definiera su propia paleta (ver WorkflowAlert.tsx, InlineAlert
// local a 3 archivos distintos, AlertBox local a RequestDetailPanel.tsx —
// todas reemplazadas por este primitivo).
const alertVariants = cva(
  'relative grid w-full items-start gap-x-3 gap-y-0.5 rounded-lg border px-4 py-3 text-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        info: 'border-primary/30 bg-primary/5 text-foreground',
        success: 'border-success/30 bg-success/5 text-foreground',
        warning: 'border-warning/30 bg-warning/5 text-foreground',
        destructive: 'border-destructive/30 bg-destructive/5 text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Insignia circular con tinte del color de la variante — mismo tratamiento
// que el bloque de referencia (ícono a color adentro de un círculo bg-color/10,
// nunca el ícono suelto en negro/currentColor, que es lo que se veía mal
// antes: un `[&>svg]:text-current` en la clase base competía con el color
// por variante y ese `text-current` a veces ganaba la cascada).
const iconBadgeVariants = cva(
  'flex size-8 shrink-0 items-center justify-center rounded-full [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        info: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        destructive: 'bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

// Detecta el ícono entre los children (todo lo que no sea AlertTitle/
// AlertDescription) y lo envuelve en la insignia circular — así cada call
// site sigue escribiendo <Alert>{icon}<AlertTitle/>...</Alert> exactamente
// igual que antes, sin tener que armar la insignia a mano en cada uso.
function Alert({ className, variant, children, ...props }: AlertProps) {
  const items = React.Children.toArray(children);
  const iconChild = items.find(
    (child) => React.isValidElement(child) && child.type !== AlertTitle && child.type !== AlertDescription
  );
  const rest = items.filter((child) => child !== iconChild);

  return (
    <div
      role="alert"
      className={cn(
        alertVariants({ variant }),
        iconChild ? 'grid-cols-[32px_1fr]' : 'grid-cols-[0_1fr]',
        className
      )}
      {...props}
    >
      {iconChild && <div className={cn(iconBadgeVariants({ variant }))}>{iconChild}</div>}
      {rest}
    </div>
  );
}

function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('col-start-2 min-h-4 font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription, alertVariants };
