import React, { useState, useEffect } from 'react';
import { equipoService, type Equipo } from '../services/equipo.service';
import { adminService } from '../../../services/admin.service';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialData?: Equipo | null;
}

export const EquipoModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState<Partial<Equipo>>({
        codigo: '',
        nombre: '',
        tipo: 'Medidor de pH y Temperatura', // Default or empty
        ubicacion: 'Puerto Montt', // Default or empty
        vigencia: new Date().toISOString().split('T')[0],
        id_muestreador: 0,
        estado: 'Activo'
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    useEffect(() => {
        if (isOpen) {
            // Load Muestreadores for the dropdown
            const fetchMuestreadores = async () => {
                try {
                    const res = await adminService.getMuestreadores('', 'ACTIVOS');
                    setMuestreadores(res.data || []);
                } catch (err) {
                    console.error('Error loading muestreadores', err);
                }
            };
            fetchMuestreadores();

            if (initialData) {
                // Formatting date to YYYY-MM-DD for input
                const formattedDate = initialData.vigencia ? new Date(initialData.vigencia).toISOString().split('T')[0] : '';
                setFormData({
                    ...initialData,
                    vigencia: formattedDate
                });
            } else {
                setFormData({
                    codigo: '',
                    nombre: '',
                    tipo: 'Medidor de pH y Temperatura',
                    ubicacion: 'Puerto Montt',
                    vigencia: new Date().toISOString().split('T')[0],
                    id_muestreador: 0,
                    estado: 'Activo'
                });
            }
            setError('');
        }
    }, [isOpen, initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (initialData?.id_equipo) {
                await equipoService.updateEquipo(initialData.id_equipo, formData);
            } else {
                await equipoService.createEquipo(formData);
            }
            onSave();
            onClose();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Error al guardar equipo');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 className="modal-title">{initialData ? 'Editar Equipo' : 'Nuevo Equipo'}</h2>
                    <button onClick={onClose} className="btn-close" title="Cerrar">×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Código</label>
                                <input
                                    type="text"
                                    name="codigo"
                                    value={formData.codigo}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Vigencia</label>
                                <input
                                    type="date"
                                    name="vigencia"
                                    value={formData.vigencia}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Nombre del Equipo</label>
                            <input
                                type="text"
                                name="nombre"
                                value={formData.nombre}
                                onChange={handleChange}
                                className="form-input"
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Tipo</label>
                                <select
                                    name="tipo"
                                    value={formData.tipo}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                >
                                    <option value="Medidor de pH y Temperatura">Medidor de pH y Temperatura</option>
                                    <option value="Medidor de Oxígeno">Medidor de Oxígeno</option>
                                    <option value="Conductímetro">Conductímetro</option>
                                    <option value="Turbidímetro">Turbidímetro</option>
                                    <option value="Multiparamétrico">Multiparamétrico</option>
                                    {/* Add more types as needed */}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ubicación (Sede)</label>
                                <select
                                    name="ubicacion"
                                    value={formData.ubicacion}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                >
                                    <option value="Puerto Montt">Puerto Montt</option>
                                    <option value="Parque Alerce">Parque Alerce</option>
                                    <option value="Villarrica">Villarrica</option>
                                    <option value="Chiloé">Chiloé</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Asignado a (Muestreador)</label>
                            <select
                                name="id_muestreador"
                                value={formData.id_muestreador}
                                onChange={handleChange}
                                className="form-input"
                            >
                                <option value="0">-- Sin Asignar --</option>
                                {muestreadores.map(m => (
                                    <option key={m.id_muestreador} value={m.id_muestreador}>
                                        {m.nombre_muestreador}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Estado</label>
                            <select
                                name="estado"
                                value={formData.estado}
                                onChange={handleChange}
                                className="form-input"
                            >
                                <option value="Activo">Activo</option>
                                <option value="Baja">Baja</option>
                                <option value="En Mantención">En Mantención</option>
                            </select>
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
        </div>
    );
};
