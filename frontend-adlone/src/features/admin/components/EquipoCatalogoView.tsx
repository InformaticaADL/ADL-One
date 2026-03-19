import React, { useState, useEffect } from 'react';
import { equipoService } from '../services/equipo.service';
import { useToast } from '../../../contexts/ToastContext';

interface CatalogItem {
    id_equipocatalogo?: number;
    nombre: string;
    que_mide: string;
    unidad_medida_textual: string;
    unidad_medida_sigla: string;
    tipo_equipo: string;
}

interface Props {
    onBack: () => void;
}

export const EquipoCatalogoView: React.FC<Props> = ({ onBack }) => {
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [formData, setFormData] = useState<CatalogItem>({
        nombre: '',
        que_mide: '',
        unidad_medida_textual: '',
        unidad_medida_sigla: '',
        tipo_equipo: ''
    });
    const [isSiglaManual, setIsSiglaManual] = useState(false);

    const { showToast } = useToast();

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await equipoService.getEquipoCatalogo();
            if (res.success) {
                setItems(res.data);
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
            showToast({ type: 'error', message: 'Error al cargar el catálogo' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const autoGenerateSigla = (text: string) => {
        if (!text) return '';
        // Split by commas, remove common filler words, join with /
        return text.split(',')
            .map(part => part.trim()
                .replace(/^(Unid\. de |Unidades de |Grados |de |en )/i, '')
            )
            .filter(part => part.length > 0)
            .join('/');
    };

    useEffect(() => {
        if (showForm && !isSiglaManual) {
            const suggestedSigla = autoGenerateSigla(formData.unidad_medida_textual);
            setFormData(prev => ({ ...prev, unidad_medida_sigla: suggestedSigla }));
        }
    }, [formData.unidad_medida_textual, showForm, isSiglaManual]);

    const handleEdit = (item: CatalogItem) => {
        setEditingItem(item);
        setFormData(item);
        setIsSiglaManual(true); // Treat existing as manual to avoid overwriting on load
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este elemento del catálogo?')) return;
        
        try {
            const res = await equipoService.deleteEquipoCatalogo(id);
            if (res.success) {
                showToast({ type: 'success', message: 'Elemento eliminado' });
                fetchItems();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast({ type: 'error', message: 'Error al eliminar el elemento' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (editingItem?.id_equipocatalogo) {
                res = await equipoService.updateEquipoCatalogo(editingItem.id_equipocatalogo, formData);
            } else {
                res = await equipoService.createEquipoCatalogo(formData);
            }

            if (res.success) {
                showToast({ 
                    type: 'success', 
                    message: editingItem ? 'Elemento actualizado' : 'Elemento creado' 
                });
                setShowForm(false);
                fetchItems();
            }
        } catch (error) {
            console.error('Error saving item:', error);
            showToast({ type: 'error', message: 'Error al guardar el elemento' });
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        if (name === 'unidad_medida_sigla') {
            setIsSiglaManual(true);
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="catalog-view-container-refined">
            <div className="catalog-header-refined">
                <div className="catalog-title-section-refined">
                    <h2>
                        <span style={{ marginRight: '0.6rem' }}>📋</span> 
                        {showForm ? 'Modelo de Equipo' : 'Gestión de Catálogo'}
                    </h2>
                    <p className="catalog-subtitle-refined">
                        {showForm 
                            ? 'Defina los parámetros técnicos del nuevo modelo.' 
                            : 'Administre los modelos autorizados con sus especificaciones detalladas.'}
                    </p>
                </div>
                <button 
                    onClick={showForm ? () => setShowForm(false) : onBack}
                    className="catalog-btn-cancel-refined"
                    style={{ padding: '0.5rem 1.25rem', fontSize: '0.8rem' }}
                >
                    {showForm ? '← Volver a la lista' : '← Volver al Hub'}
                </button>
            </div>

            <div className="catalog-content-refined">
                {showForm ? (
                    <div className="catalog-form-card-refined" style={{ animation: 'pve-fadeIn 0.3s ease-out' }}>
                        <form onSubmit={handleSubmit}>
                            <div className="catalog-form-grid-refined">
                                <div className="catalog-input-group-refined">
                                    <label>Nombre del Equipo</label>
                                    <input
                                        type="text"
                                        name="nombre"
                                        value={formData.nombre}
                                        onChange={handleChange}
                                        placeholder="Ej: MULTIPARAMETRO"
                                        className="catalog-input-field-refined"
                                        required
                                    />
                                </div>
                                <div className="catalog-input-group-refined">
                                    <label>Tipo de Equipo</label>
                                    <input
                                        type="text"
                                        name="tipo_equipo"
                                        value={formData.tipo_equipo}
                                        onChange={handleChange}
                                        placeholder="Ej: Sonda"
                                        className="catalog-input-field-refined"
                                        required
                                    />
                                </div>
                                <div className="catalog-input-group-refined">
                                    <label>Qué Mide (Variables)</label>
                                    <input
                                        type="text"
                                        name="que_mide"
                                        value={formData.que_mide}
                                        onChange={handleChange}
                                        placeholder="Ej: pH, Temperatura, Turbiedad"
                                        className="catalog-input-field-refined"
                                        required
                                    />
                                </div>
                                <div className="catalog-input-group-refined">
                                    <label>Unidad de Medida</label>
                                    <input
                                        type="text"
                                        name="unidad_medida_textual"
                                        value={formData.unidad_medida_textual}
                                        onChange={handleChange}
                                        placeholder="Ej: Unid. de pH, °C, NTU"
                                        className="catalog-input-field-refined"
                                        required
                                    />
                                </div>
                                <div className="catalog-input-group-refined">
                                    <label>Sigla de Unidad</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            name="unidad_medida_sigla"
                                            value={formData.unidad_medida_sigla}
                                            onChange={handleChange}
                                            placeholder="Ej: pH/°C/NTU"
                                            className="catalog-input-field-refined"
                                            style={{ width: '100%', paddingRight: '3rem' }}
                                        />
                                        {isSiglaManual && (
                                            <span 
                                                title="Manual" 
                                                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem', color: '#94a3b8' }}
                                            >
                                                ✍️
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="catalog-form-actions-refined">
                                <button type="button" onClick={() => setShowForm(false)} className="catalog-btn-cancel-refined">
                                    Cancelar
                                </button>
                                <button type="submit" disabled={loading} className="catalog-btn-submit-refined">
                                    {loading ? 'Procesando...' : (editingItem ? 'Actualizar Registro' : 'Registrar en Catálogo')}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div style={{ animation: 'pve-fadeIn 0.3s ease-out' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                            <button 
                                onClick={() => {
                                    setEditingItem(null);
                                    setFormData({ nombre: '', que_mide: '', unidad_medida_textual: '', unidad_medida_sigla: '', tipo_equipo: '' });
                                    setIsSiglaManual(false);
                                    setShowForm(true);
                                }} 
                                className="catalog-btn-submit-refined"
                                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#0f172a' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Agregar Nuevo Modelo
                            </button>
                        </div>
                        
                        <div className="catalog-table-wrapper-refined">
                            <table className="catalog-premium-table-refined">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Tipo</th>
                                        <th>Qué Mide</th>
                                        <th>Sigla</th>
                                        <th style={{ textAlign: 'right' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} style={{ padding: '5rem', textAlign: 'center', color: '#94a3b8' }}>
                                                {loading ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                                        <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid #2563eb', borderRadius: '50%', animation: 'spin 1.1s linear infinite' }}></div>
                                                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cargando catálogo maestro...</span>
                                                    </div>
                                                ) : 'Catálogo vacío.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        items.map((item) => (
                                            <tr key={item.id_equipocatalogo}>
                                                <td style={{ fontWeight: 700, color: '#0f172a' }}>{item.nombre}</td>
                                                <td>
                                                    <span className="catalog-badge-type-refined">
                                                        {item.tipo_equipo}
                                                    </span>
                                                </td>
                                                <td style={{ color: '#475569', fontSize: '0.85rem' }}>{item.que_mide}</td>
                                                <td>
                                                    <span className="catalog-badge-sigla-refined">
                                                        {item.unidad_medida_sigla || 'N/A'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="catalog-action-group-refined">
                                                        <button 
                                                            onClick={() => handleEdit(item)} 
                                                            title="Editar detalles"
                                                            className="catalog-btn-icon-refined catalog-btn-edit-refined"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4L18.5 2.5z"></path></svg>
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(item.id_equipocatalogo!)} 
                                                            title="Eliminar del catálogo"
                                                            className="catalog-btn-icon-refined catalog-btn-delete-refined"
                                                        >
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes pve-fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
        </div>
    );
};
