import React, { useState } from 'react';
import { ursService } from '../../../services/urs.service';
import {
    Modal,
    Select,
    Input,
    Button,
    Typography,
    Spin
} from 'antd';
import {
    IconArrowForwardUp,
    IconCheck,
    IconUserPin
} from '@tabler/icons-react';

const { Text } = Typography;
const { TextArea } = Input;

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
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={480}
            zIndex={1100}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(76,110,245,0.12)', color: '#4c6ef5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconArrowForwardUp size={18} />
                    </div>
                    <Text strong>Derivar Solicitud #{requestId}</Text>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                <Field label="Destinatario Autorizado *">
                    <Select
                        placeholder={loadingTargets ? 'Cargando...' : 'Seleccione destino...'}
                        options={targetOptions}
                        value={selectedTarget ?? undefined}
                        onChange={(v) => setSelectedTarget(v ?? null)}
                        disabled={loadingTargets || targetOptions.length === 0}
                        showSearch
                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                        notFoundContent="No se encontraron destinos"
                        suffixIcon={loadingTargets ? <Spin size="small" /> : <IconUserPin size={16} />}
                        style={{ width: '100%' }}
                    />
                </Field>

                <Field label="Comentario / Instrucciones">
                    <TextArea
                        placeholder="Indique el motivo de la derivación o instrucciones..."
                        rows={3}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </Field>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <Button onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="primary"
                        style={{ backgroundColor: '#4c6ef5' }}
                        loading={loading}
                        disabled={!selectedTarget}
                        icon={<IconCheck size={18} />}
                        onClick={handleSubmit}
                    >
                        Confirmar Derivación
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}

export default DeriveRequestModal;
