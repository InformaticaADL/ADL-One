import React, { useState, useEffect } from 'react';
import { adminService } from '../../../services/admin.service';

interface Muestreador {
    id_muestreador?: number;
    nombre_muestreador: string;
    correo_electronico: string;
    clave_usuario: string;
    firma_muestreador?: string; // Base64 or URL
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: Muestreador | null;
}

export const MuestreadorModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<Muestreador>({
        nombre_muestreador: '',
        correo_electronico: '',
        clave_usuario: '',
        firma_muestreador: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewSignature, setPreviewSignature] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData(initialData);
                setPreviewSignature(initialData.firma_muestreador || null);
            } else {
                setFormData({
                    nombre_muestreador: '',
                    correo_electronico: '',
                    clave_usuario: '',
                    firma_muestreador: ''
                });
                setPreviewSignature(null);
            }
            setError('');
        }
    }, [isOpen, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result as string;
                setFormData(prev => ({ ...prev, firma_muestreador: base64 }));
                setPreviewSignature(base64);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (initialData?.id_muestreador) {
                await adminService.updateMuestreador(initialData.id_muestreador, {
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    clave: formData.clave_usuario,
                    firma: formData.firma_muestreador
                });
            } else {
                await adminService.createMuestreador({
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    clave: formData.clave_usuario,
                    firma: formData.firma_muestreador
                });
            }
            onSave();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Error al guardar muestreador');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="modal-title">{initialData ? 'Editar Muestreador' : 'Nuevo Muestreador'}</h2>
                    <button onClick={onClose} className="btn-close" title="Cerrar">×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-group">
                            <label>Nombre Completo</label>
                            <input
                                type="text"
                                name="nombre_muestreador"
                                value={formData.nombre_muestreador}
                                onChange={handleChange}
                                className="form-input"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Correo Electrónico</label>
                            <input
                                type="email"
                                name="correo_electronico"
                                value={formData.correo_electronico}
                                onChange={handleChange}
                                className="form-input"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Clave de Acceso</label>
                            <input
                                type="text"
                                name="clave_usuario"
                                value={formData.clave_usuario}
                                onChange={handleChange}
                                className="form-input"
                                required
                                maxLength={6}
                            />
                            <small style={{ color: '#666' }}>Máximo 6 caracteres</small>
                        </div>

                        <div className="form-group">
                            <label>Firma Digital</label>
                            <div className="signature-upload-container">
                                {previewSignature ? (
                                    <div className="signature-preview-box">
                                        <img src={previewSignature} alt="Firma" className="signature-img-preview" />
                                        <button
                                            type="button"
                                            className="btn-remove-signature"
                                            onClick={() => {
                                                setPreviewSignature(null);
                                                setFormData(prev => ({ ...prev, firma_muestreador: '' }));
                                            }}
                                        >
                                            Cambiar Firma
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="form-input-file"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} className="btn-secondary" disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                .signature-preview-box {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    border: 1px dashed #ccc;
                    border-radius: 8px;
                }
                .signature-img-preview {
                    max-width: 100%;
                    max-height: 100px;
                    object-fit: contain;
                }
                .btn-remove-signature {
                    background: none;
                    border: none;
                    color: #d32f2f;
                    cursor: pointer;
                    text-decoration: underline;
                    font-size: 0.9rem;
                }
            `}</style>
        </div>
    );
};
