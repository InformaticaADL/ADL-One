import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// Mismos tonos semánticos que badge.tsx (success/warning/destructive) — un
// solo lenguaje de color para "estado" en toda la app, en vez de que cada
// alerta ad-hoc definiera su propia paleta (ver WorkflowAlert.tsx, InlineAlert
// local a 3 archivos distintos, AlertBox local a RequestDetailPanel.tsx —
// todas reemplazadas por este primitivo).
const alertVariants = cva(
  'relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[20px_1fr] has-[>svg]:gap-x-3 [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:text-current',
  {
    variants: {
      variant: {
        default: 'border-border bg-card text-card-foreground',
        info: 'border-primary/30 bg-primary/5 text-foreground [&>svg]:text-primary',
        success: 'border-success/30 bg-success/5 text-foreground [&>svg]:text-success',
        warning: 'border-warning/30 bg-warning/5 text-foreground [&>svg]:text-warning',
        destructive: 'border-destructive/30 bg-destructive/5 text-foreground [&>svg]:text-destructive',
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

function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
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
