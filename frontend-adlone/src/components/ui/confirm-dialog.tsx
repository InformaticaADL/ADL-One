import { useCallback, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface OpcionesConfirmacion {
  titulo: string;
  mensaje: ReactNode;
  /** Texto del botón que confirma (por defecto «Confirmar»). */
  textoConfirmar?: string;
  /** Texto del botón que cancela (por defecto «Cancelar»). */
  textoCancelar?: string;
  /** Pinta el botón de confirmar como acción destructiva. */
  peligro?: boolean;
}

/**
 * Reemplazo de `window.confirm` con una ventana propia del sistema (no la del navegador, que muestra «localhost dice…»).
 *
 *   const { confirmar, dialogo } = useConfirmacion();
 *   if (!(await confirmar({ titulo: 'Eliminar', mensaje: '¿Eliminar este registro?', peligro: true }))) return;
 *   ...
 *   return (<div>{dialogo} ...</div>);
 */
export function useConfirmacion() {
  const [abierto, setAbierto] = useState(false);
  const [opciones, setOpciones] = useState<OpcionesConfirmacion>({ titulo: '', mensaje: '' });
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirmar = useCallback(
    (nuevas: OpcionesConfirmacion) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setOpciones(nuevas);
        setAbierto(true);
      }),
    []
  );

  const cerrar = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setAbierto(false);
  };

  const dialogo = (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open) cerrar(false); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{opciones.titulo}</DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground">{opciones.mensaje}</div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => cerrar(false)}>
            {opciones.textoCancelar ?? 'Cancelar'}
          </Button>
          <Button type="button" variant={opciones.peligro ? 'destructive' : 'default'} onClick={() => cerrar(true)}>
            {opciones.textoConfirmar ?? 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirmar, dialogo };
}
