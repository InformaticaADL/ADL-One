import React, { useState } from 'react';
import { ursService } from '../../../services/urs.service';
import {
    Modal,
    Stack,
    Group,
    Select,
    Textarea,
    Button,
    ThemeIcon,
    Text,
    Loader
} from '@mantine/core';
import {
    IconArrowForwardUp,
    IconCheck,
    IconUserPin
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

    // Debugging line (will appear in browser console)
    if (targets.length > 0) console.log("URS Derivation Targets:", targetOptions);

    return (
        <Modal 
            opened={isOpen} 
            onClose={onClose} 
            title={
                <Group gap="xs">
                    <ThemeIcon variant="light" color="indigo" radius="md">
                        <IconArrowForwardUp size={18} />
                    </ThemeIcon>
                    <Text fw={700}>Derivar Solicitud #{requestId}</Text>
                </Group>
            }
            radius="lg"
            zIndex={1100}
        >
            <Stack gap="md">
                <Select 
                    label="Destinatario Autorizado"
                    placeholder={loadingTargets ? 'Cargando...' : 'Seleccione destino...'}
                    data={targetOptions}
                    value={selectedTarget}
                    onChange={setSelectedTarget}
                    disabled={loadingTargets || targetOptions.length === 0}
                    required
                    searchable
                    nothingFoundMessage="No se encontraron destinos"
                    comboboxProps={{ zIndex: 2000 }}
                    radius="md"
                    leftSection={loadingTargets ? <Loader size={14} /> : <IconUserPin size={16} />}
                />

                <Textarea 
                    label="Comentario / Instrucciones"
                    placeholder="Indique el motivo de la derivación o instrucciones..."
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.currentTarget.value)}
                    radius="md"
                />

                <Group justify="flex-end" mt="lg">
                    <Button variant="light" color="gray" onClick={onClose} radius="md">
                        Cancelar
                    </Button>
                    <Button 
                        color="indigo" 
                        radius="md" 
                        loading={loading} 
                        disabled={!selectedTarget}
                        leftSection={<IconCheck size={18} />}
                        onClick={handleSubmit}
                    >
                        Confirmar Derivación
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default DeriveRequestModal;
