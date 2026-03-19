import { ursService } from '../../../services/urs.service';
import React, { useState, useEffect } from 'react';
import FileIcon from './FileIcon';
import './NewRequestModal.css';
import apiClient from '../../../config/axios.config';

interface RemoteSelectProps {
    source: string;
    value: any;
    onChange: (val: any) => void;
    labelField: string;
    valueField: string;
    placeholder?: string;
    required?: boolean;
}

const RemoteSelect: React.FC<RemoteSelectProps> = ({ source, value, onChange, labelField, valueField, placeholder, required }) => {
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        apiClient.get(source)
            .then(res => {
                // Handle different response structures: { data: [...] } or { data: { data: [...] } }
                const rawData = res.data.data;
                const items = Array.isArray(rawData) ? rawData : (rawData?.data || []);
                setOptions(items);
            })
            .catch(err => console.error(`Error loading remote source ${source}:`, err))
            .finally(() => setLoading(false));
    }, [source]);

    return (
        <select 
            className="v2-input" 
            value={value || ''} 
            onChange={(e) => onChange(e.target.value)}
            required={required}
            disabled={loading}
        >
            <option value="">{loading ? 'Cargando...' : (placeholder || 'Seleccione...')}</option>
            {options.map((opt: any) => (
                <option key={opt[valueField]} value={opt[valueField]}>
                    {opt[labelField]} {opt.codigo ? `(${opt.codigo})` : ''}
                </option>
            ))}
        </select>
    );
};

interface NewRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [types, setTypes] = useState<any[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
    const [dynamicData, setDynamicData] = useState<any>({});
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            ursService.getRequestTypes().then(setTypes).catch(console.error);
        }
    }, [isOpen]);

    const selectedType = types.find(t => t.id_tipo === selectedTypeId);
    
    // Parseamos la configuración del formulario
    const formConfig = React.useMemo(() => {
        if (!selectedType?.formulario_config) return null;
        try {
            return typeof selectedType.formulario_config === 'string' 
                ? JSON.parse(selectedType.formulario_config) 
                : selectedType.formulario_config;
        } catch (e) {
            console.error("Error parsing form config:", e);
            return null;
        }
    }, [selectedType]);

    useEffect(() => {
        // Al cambiar de tipo, reseteamos el formulario dinámico
        setDynamicData({});
    }, [selectedTypeId]);

    if (!isOpen) return null;

    const handleInputChange = (name: string, value: any) => {
        setDynamicData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedTypeId === 0) return alert('Selecciona un tipo de solicitud');

        setLoading(true);
        try {
            await ursService.createRequest({
                id_tipo: selectedTypeId,
                datos_json: dynamicData,
                prioridad: dynamicData.prioridad || 'NORMAL',
                archivos: files
            });
            onSuccess();
            onClose();
            // Reset form
            setDynamicData({});
            setFiles([]);
            setSelectedTypeId(0);
        } catch (error) {
            console.error("Error creating request:", error);
            alert("Error al crear la solicitud");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content urs-new-request-modal animate-pop-in">
                <div className="modal-header">
                    <h2>Nueva Solicitud</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>
                
                <form onSubmit={handleSubmit} className="new-request-form">
                    <div className="form-group v2-field">
                        <label>Tipo de Gestión</label>
                        <select 
                            value={selectedTypeId} 
                            onChange={(e) => setSelectedTypeId(Number(e.target.value))}
                            required
                            className="v2-input"
                        >
                            <option value={0}>Seleccione un tipo...</option>
                            {types.map((t: any) => (
                                <option key={t.id_tipo} value={t.id_tipo}>{t.nombre}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group v2-field">
                        <label>Prioridad de Atención</label>
                        <select 
                            value={dynamicData.prioridad || 'NORMAL'} 
                            onChange={(e) => handleInputChange('prioridad', e.target.value)}
                            required
                            className="v2-input"
                        >
                            <option value="BAJA">🟢 Baja</option>
                            <option value="NORMAL">🔵 Normal</option>
                            <option value="ALTA">🔴 Alta</option>
                            <option value="URGENTE">🔥 Urgente</option>
                        </select>
                    </div>

                    {formConfig ? (
                        <div className="dynamic-form-fields">
                            {formConfig.map((field: any) => (
                                <div key={field.name} className="form-group v2-field">
                                    <label>{field.label} {field.required && <span className="req">*</span>}</label>
                                    {field.type === 'textarea' ? (
                                        <textarea
                                            placeholder={field.placeholder || ''}
                                            value={dynamicData[field.name] || ''}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                            required={field.required}
                                            className="v2-input"
                                        />
                                    ) : field.type === 'select' ? (
                                        <select
                                            value={dynamicData[field.name] || ''}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                            required={field.required}
                                            className="v2-input"
                                        >
                                            <option value="">Seleccione...</option>
                                            {field.options?.map((opt: string) => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : field.type === 'remote-select' ? (
                                        <RemoteSelect
                                            source={field.remoteSource}
                                            value={dynamicData[field.name]}
                                            onChange={(val) => handleInputChange(field.name, val)}
                                            labelField={field.labelField || 'nombre'}
                                            valueField={field.valueField || 'id'}
                                            placeholder={field.placeholder}
                                            required={field.required}
                                        />
                                    ) : (
                                        <input
                                            type={field.type || 'text'}
                                            placeholder={field.placeholder || ''}
                                            value={dynamicData[field.name] || ''}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                            required={field.required}
                                            className="v2-input"
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : selectedTypeId !== 0 && (
                        <div className="standard-fields">
                             <div className="form-group v2-field">
                                <label>Título / Referencia</label>
                                <input 
                                    type="text" 
                                    placeholder="Ej: Problema con equipo XYZ"
                                    value={dynamicData.titulo || ''}
                                    onChange={(e) => handleInputChange('titulo', e.target.value)}
                                    required
                                    className="v2-input"
                                />
                            </div>
                            <div className="form-group v2-field">
                                <label>Descripción detallada</label>
                                <textarea 
                                    rows={4}
                                    placeholder="Explique detalladamente su requerimiento..."
                                    value={dynamicData.descripcion || ''}
                                    onChange={(e) => handleInputChange('descripcion', e.target.value)}
                                    required
                                    className="v2-input"
                                ></textarea>
                            </div>
                        </div>
                    )}

                    <div className="form-group v2-field">
                        <label>Adjuntar Archivos</label>
                        <div className="file-upload-area v2-upload">
                            <input 
                                type="file" 
                                id="fileInput"
                                multiple 
                                hidden
                                onChange={(e) => setFiles(Array.from(e.target.files || []))}
                            />
                            <label htmlFor="fileInput" className="v2-upload-btn">
                                📎 Seleccionar Archivos
                            </label>
                            <div className="file-list">
                                {files.map((f: File, i: number) => (
                                    <div key={i} className="file-chip">
                                        <FileIcon filename={f.name} mimetype={f.type} size={16} />
                                        <span>{f.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="v2-btn-secondary" onClick={onClose}>Cancelar</button>
                        <button type="submit" className="v2-btn-primary" disabled={loading}>
                            {loading ? 'Procesando...' : 'Confirmar Solicitud'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NewRequestModal;
