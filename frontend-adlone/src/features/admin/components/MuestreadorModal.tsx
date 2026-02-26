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
        <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem'
        }}>
            <div className="modal-content animate-slide-up" style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '500px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '90vh',
                overflow: 'hidden'
            }}>
                <div className="modal-header" style={{
                    padding: '1.25rem 1.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: '#f8fafc'
                }}>
                    <h2 className="modal-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                        {initialData ? 'Editar Muestreador' : 'Nuevo Muestreador'}
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'none', border: 'none', fontSize: '1.5rem', color: '#64748b', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px',
                        borderRadius: '50%', transition: 'all 0.2s'
                    }} title="Cerrar" onMouseEnter={e => e.currentTarget.style.background = '#e2e8f0'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>×</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <div className="modal-body admin-content-scroll" style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {error && <div style={{ padding: '0.75rem', background: '#fef2f2', color: '#ef4444', borderRadius: '8px', border: '1px solid #f87171', fontSize: '0.9rem' }}>{error}</div>}

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>Nombre Completo</label>
                            <input
                                type="text"
                                name="nombre_muestreador"
                                value={formData.nombre_muestreador}
                                onChange={handleChange}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.95rem',
                                    width: '100%',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#2563eb'}
                                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                                placeholder="Ej: Juan Pérez"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>Correo Electrónico</label>
                            <input
                                type="email"
                                name="correo_electronico"
                                value={formData.correo_electronico}
                                onChange={handleChange}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.95rem',
                                    width: '100%',
                                    outline: 'none',
                                    transition: 'border-color 0.2s'
                                }}
                                onFocus={e => e.target.style.borderColor = '#2563eb'}
                                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                                placeholder="ejemplo@laboratorio.com"
                                required
                            />
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>Clave de Acceso</label>
                            <input
                                type="text"
                                name="clave_usuario"
                                value={formData.clave_usuario}
                                onChange={handleChange}
                                style={{
                                    padding: '0.75rem 1rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.95rem',
                                    width: '100%',
                                    outline: 'none',
                                    transition: 'border-color 0.2s',
                                    letterSpacing: '0.1em',
                                    fontFamily: 'monospace'
                                }}
                                onFocus={e => e.target.style.borderColor = '#2563eb'}
                                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                                required
                                maxLength={6}
                                placeholder="******"
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <small style={{ color: '#64748b', fontSize: '0.8rem' }}>Máximo 6 caracteres</small>
                                <small style={{ color: formData.clave_usuario.length === 6 ? '#16a34a' : '#64748b', fontSize: '0.8rem', fontWeight: 600 }}>
                                    {formData.clave_usuario.length} / 6
                                </small>
                            </div>
                        </div>

                        <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ fontWeight: 600, color: '#334155', fontSize: '0.9rem' }}>Firma Digital</label>
                            <div className="signature-upload-container" style={{
                                border: '2px dashed #cbd5e1',
                                borderRadius: '12px',
                                padding: '1.5rem',
                                textAlign: 'center',
                                background: '#f8fafc',
                                transition: 'all 0.2s ease',
                            }}>
                                {previewSignature ? (
                                    <div className="signature-preview-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ background: 'white', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                            <img src={previewSignature || undefined} alt="Firma" style={{ maxWidth: '100%', maxHeight: '120px', objectFit: 'contain' }} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPreviewSignature(null);
                                                setFormData(prev => ({ ...prev, firma_muestreador: '' }));
                                            }}
                                            style={{
                                                background: '#fee2e2',
                                                color: '#ef4444',
                                                border: 'none',
                                                padding: '0.5rem 1rem',
                                                borderRadius: '6px',
                                                fontSize: '0.85rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.5rem',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = '#fca5a5'}
                                            onMouseLeave={e => e.currentTarget.style.background = '#fee2e2'}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                            Eliminar Firma
                                        </button>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                        <div style={{
                                            width: '48px', height: '48px', borderRadius: '50%', background: '#e0e7ff', color: '#4f46e5',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                        }}>
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        </div>
                                        <div>
                                            <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#334155' }}>Sube una imagen de la firma</p>
                                            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>Formatos soportados: PNG, JPG, JPEG</p>
                                        </div>
                                        <label style={{
                                            cursor: 'pointer',
                                            padding: '0.5rem 1.25rem',
                                            background: 'white',
                                            border: '1px solid #cbd5e1',
                                            borderRadius: '6px',
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            color: '#334155',
                                            marginTop: '0.5rem',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                            transition: 'all 0.2s'
                                        }}
                                            onMouseEnter={e => e.currentTarget.style.borderColor = '#94a3b8'}
                                            onMouseLeave={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                                        >
                                            Seleccionar Archivo
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileChange}
                                                style={{ display: 'none' }}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer" style={{
                        padding: '1.25rem 1.5rem',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '1rem',
                        background: '#f8fafc'
                    }}>
                        <button type="button" onClick={onClose} disabled={loading} style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: 'white',
                            color: '#475569',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s'
                        }}
                            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#f1f5f9' }}
                            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'white' }}
                        >
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#2563eb',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.95rem',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
                        }}
                            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1d4ed8' }}
                            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#2563eb' }}
                        >
                            {loading && (
                                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                    <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                                </svg>
                            )}
                            {loading ? 'Guardando...' : 'Guardar Muestreador'}
                        </button>
                    </div>
                </form>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-slide-up {
                    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};
