import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'start', sideOffset = 4, onWheel, onTouchMove, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      // Un Popover dentro de un Sheet/Dialog se dibuja en el <body>, fuera del contenido del diálogo. El diálogo bloquea el scroll de todo lo
      // que queda fuera de él (react-remove-scroll escucha la rueda y el touchpad en el document), así que la lista del desplegable solo
      // se podía mover arrastrando la barra. Cortando la propagación aquí, ese bloqueo no se entera y la rueda/touchpad vuelven a funcionar.
      onWheel={(e) => { e.stopPropagation(); onWheel?.(e); }}
      onTouchMove={(e) => { e.stopPropagation(); onTouchMove?.(e); }}
      className={cn(
        'shadcn-scope z-[300] w-72 rounded-md border border-border bg-card p-0 text-card-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
