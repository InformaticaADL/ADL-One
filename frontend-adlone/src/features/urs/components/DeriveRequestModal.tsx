import React, { useState } from 'react';
import { ursService } from '../../../services/urs.service';
import './DeriveRequestModal.css';

interface DeriveRequestModalProps {
    isOpen: boolean;
    requestId: number;
    requestTypeId: number;
    onClose: () => void;
    onSuccess: () => void;
}

const DeriveRequestModal: React.FC<DeriveRequestModalProps> = ({ isOpen, requestId, requestTypeId, onClose, onSuccess }) => {
    const [targets, setTargets] = useState<any[]>([]);
    const [selectedTarget, setSelectedTarget] = useState<string>(''); // Formato: "ROL:id" o "USR:id"
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

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTarget) return alert('Selecciona un destino de derivación');

        const [type, id] = selectedTarget.split(':');
        setLoading(true);
        try {
            await ursService.deriveRequest(requestId, { 
                area: 'DERIVACION', // El backend resolverá el área si es necesario o podemos pasar el nombre del rol
                userId: type === 'USR' ? Number(id) : undefined,
                roleId: type === 'ROL' ? Number(id) : undefined,
                comment 
            });
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error deriving request:", error);
            alert("Error al derivar la solicitud");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-content animate-pop-in urs-derive-modal">
                <div className="modal-header">
                    <h2>Derivar Solicitud #{requestId}</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <form onSubmit={handleSubmit} className="derive-form">
                    <div className="form-group">
                        <label>Destinatario Autorizado</label>
                        <select 
                            value={selectedTarget} 
                            onChange={(e) => setSelectedTarget(e.target.value)} 
                            required
                            disabled={loadingTargets}
                        >
                            <option value="">{loadingTargets ? 'Cargando...' : 'Seleccione destino...'}</option>
                            {targets.map((t, idx) => (
                                <option 
                                    key={idx} 
                                    value={t.id_rol ? `ROL:${t.id_rol}` : `USR:${t.id_usuario}`}
                                >
                                    {t.id_rol ? `[ROL] ${t.nombre_rol}` : `[PERSONA] ${t.nombre_usuario}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Comentario / Instrucciones</label>
                        <textarea 
                            rows={3}
                            placeholder="Indique el motivo de la derivación o instrucciones..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        ></textarea>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Derivando...' : 'Confirmar Derivación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default DeriveRequestModal;
