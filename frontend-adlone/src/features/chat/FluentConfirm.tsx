import { useCallback, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export interface ConfirmOpts {
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
}

// Hook de confirmación basado en shadcn Dialog. Devuelve `ask(opts)` para
// pedir confirmación y un `dialog` que se renderiza una sola vez en el árbol.
export function useConfirm() {
    const [opts, setOpts] = useState<ConfirmOpts | null>(null);
    const ask = useCallback((o: ConfirmOpts) => setOpts(o), []);

    const dialog = (
        <Dialog open={!!opts} onOpenChange={(open) => { if (!open) setOpts(null); }}>
            <DialogContent className="shadcn-scope">
                <DialogHeader>
                    <DialogTitle>{opts?.title}</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">{opts?.message}</p>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpts(null)}>Cancelar</Button>
                    <Button
                        variant={opts?.danger ? 'destructive' : 'default'}
                        onClick={() => { opts?.onConfirm(); setOpts(null); }}
                    >
                        {opts?.confirmLabel || 'Confirmar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return { ask, dialog };
}
