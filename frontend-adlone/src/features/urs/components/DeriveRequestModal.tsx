import React, { useState } from 'react';
import { ursService } from '../../../services/urs.service';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    IconArrowForwardUp,
    IconCheck
} from '@tabler/icons-react';

interface DeriveRequestModalProps {
    isOpen: boolean;
    requestId: number;
    requestTypeId: number;
    onClose: () => void;
    onSuccess: () => void;
}

const DeriveRequestModal: React.FC<DeriveRequestModalProps> = ({ isOpen, requestId, requestTypeId, onClose, onSuccess }) => {
    const [targets, setTargets] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingTargets, setLoadingTargets] = useState(false);

    React.useEffect(() => {
        if (isOpen && requestTypeId) {
            setLoadingTargets(true);
            ursService.getDerivationTargets(requestTypeId)
                .then(res => setTargets(res))
                .catch(err => console.error("Error loading targets:", err))
                .finally(() => setLoadingTargets(false));
        }
    }, [isOpen, requestTypeId]);

    const handleSubmit = async () => {
        if (!selectedTarget) return;

        const [type, id] = selectedTarget.split(':');
        const targetObj = targetOptions.find(o => o.value === selectedTarget);
        const targetLabel = targetObj ? targetObj.label : 'DERIVACION';

        setLoading(true);
        try {
            await ursService.deriveRequest(requestId, {
                area: targetLabel,
                userId: type === 'USR' ? Number(id) : undefined,
                roleId: type === 'ROL' ? Number(id) : undefined,
                comment
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error deriving request:", error);
        } finally {
            setLoading(false);
        }
    };

    const targetOptions = targets.map((t) => {
        const val = t.id_usuario ? `USR:${t.id_usuario}` : (t.id_rol ? `ROL:${t.id_rol}` : '');
        let lbl = '';

        if (t.id_rol) {
            lbl = t.id_usuario
                ? `${t.nombre_usuario || t.nombre_real || 'Usuario'} (${t.nombre_rol})`
                : `[ROL] ${t.nombre_rol}`;
        } else {
            lbl = `${t.nombre_usuario || t.nombre_real || 'Usuario'}`;
        }

        return { value: val, label: lbl };
    }).filter(opt => opt.value);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <IconArrowForwardUp size={18} />
                        </span>
                        Derivar Solicitud #{requestId}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    <Field label="Destinatario Autorizado *">
                        <Combobox
                            placeholder={loadingTargets ? 'Cargando...' : 'Seleccione destino...'}
                            searchPlaceholder="Buscar destino..."
                            emptyText="No se encontraron destinos"
                            options={targetOptions}
                            value={selectedTarget ?? undefined}
                            onValueChange={(v) => setSelectedTarget(v)}
                            disabled={loadingTargets || targetOptions.length === 0}
                        />
                    </Field>

                    <Field label="Comentario / Instrucciones">
                        <Textarea
                            placeholder="Indique el motivo de la derivación o instrucciones..."
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </Field>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button
                            disabled={!selectedTarget || loading}
                            onClick={handleSubmit}
                        >
                            {loading ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            ) : (
                                <IconCheck size={18} />
                            )}
                            Confirmar Derivación
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

export default DeriveRequestModal;
