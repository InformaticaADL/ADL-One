import React from 'react';
import { IconAlertTriangle, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    /** Antes `confirmColor` (hex libre) — ahora un tono semántico, igual que
     * Alert/Badge, en vez de que cada call site inventara su propio color. */
    tone?: 'destructive' | 'info' | 'success';
    onConfirm: () => void;
    onCancel: () => void;
}

const TONE_STYLES = {
    destructive: { Icon: IconAlertTriangle, badge: 'bg-destructive/10 text-destructive' },
    info: { Icon: IconInfoCircle, badge: 'bg-primary/10 text-primary' },
    success: { Icon: IconCheck, badge: 'bg-success/10 text-success' },
};

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    tone = 'destructive',
    onConfirm,
    onCancel,
}) => {
    const { Icon, badge } = TONE_STYLES[tone];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="max-w-[480px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', badge)}>
                            <Icon size={22} />
                        </div>
                        <DialogTitle>{title}</DialogTitle>
                    </div>
                </DialogHeader>

                <p className="text-sm leading-relaxed text-muted-foreground">{message}</p>

                <DialogFooter>
                    <Button variant="outline" onClick={onCancel}>{cancelText}</Button>
                    <Button variant={tone === 'destructive' ? 'destructive' : 'default'} onClick={onConfirm}>{confirmText}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
