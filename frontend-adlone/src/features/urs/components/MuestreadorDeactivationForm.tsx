import React, { useState, useEffect } from 'react';
import { ursService } from '../../../services/urs.service';
import { useNavStore } from '../../../store/navStore';
import apiClient from '../../../config/axios.config';
import './MuestreadorDeactivationForm.css';

interface MuestreadorDeactivationFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    isEmbedded?: boolean;
    onDataChange?: (data: any) => void;
}

const MuestreadorDeactivationForm: React.FC<MuestreadorDeactivationFormProps> = ({ 
    onSuccess, 
    onCancel,
    isEmbedded = false,
    onDataChange
}) => {
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [selectedId, setSelectedId] = useState<number | ''>('');
    const [transferType, setTransferType] = useState<'BASE' | 'MUESTREADOR' | 'MANUAL' | ''>('');
    const [targetBase, setTargetBase] = useState('');
    const [targetMuestreadorId, setTargetMuestreadorId] = useState<number | ''>('');
    const [equipmentList, setEquipmentList] = useState<any[]>([]);
    const [manualAssignments, setManualAssignments] = useState<Record<number, number>>({});
    const [loading, setLoading] = useState(false);
    const [loadingEquipos, setLoadingEquipos] = useState(false);
    const [equipmentCount, setEquipmentCount] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const { setActiveSubmodule } = useNavStore();

    // Notify parent of data changes
    useEffect(() => {
        if (onDataChange) {
            const data: any = {
                muestreador_origen_id: selectedId,
                muestreador_origen_nombre: muestreadores.find(m => m.id_muestreador === selectedId)?.nombre_muestreador,
                tipo_traspaso: transferType,
            };

            if (transferType === 'BASE') {
                data.base_destino = targetBase;
            } else if (transferType === 'MUESTREADOR') {
                data.muestreador_destino_id = targetMuestreadorId;
                data.muestreador_destino_nombre = muestreadores.find(m => m.id_muestreador === targetMuestreadorId)?.nombre_muestreador;
            } else if (transferType === 'MANUAL') {
                data.reasignacion_manual = equipmentList.map(eq => ({
                    id_equipo: eq.id_equipo,
                    nombre_equipo: eq.nombre,
                    codigo_equipo: eq.codigo,
                    id_muestreador_nuevo: manualAssignments[eq.id_equipo] || null
                }));
            }
            onDataChange(data);
        }
    }, [selectedId, transferType, targetBase, targetMuestreadorId, manualAssignments, equipmentList, muestreadores, onDataChange]);

    const bases = ['Base Aysén', 'Base Puerto Montt', 'Base Villarrica', 'Sede Villarrica'];

    useEffect(() => {
        apiClient.get('/api/catalogos/muestreadores')
            .then(res => setMuestreadores(res.data.data))
            .catch(console.error);
    }, []);

    useEffect(() => {
        if (selectedId) {
            setLoadingEquipos(true);
            setEquipmentCount(null);
            apiClient.get(`/api/admin/equipos?id_muestreador=${selectedId}&limit=100`)
                .then(res => {
                    const list = res.data.data || [];
                    setEquipmentList(list);
                    setEquipmentCount(list.length);
                })
                .catch(console.error)
                .finally(() => setLoadingEquipos(false));
        } else {
            setEquipmentList([]);
            setEquipmentCount(null);
        }
    }, [selectedId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isEmbedded) return; // Parent handles submission
        
        if (!selectedId || !transferType) return alert('Complete los campos iniciales');

        const payload: any = {
            id_tipo: 0,
            datos_json: {
                muestreador_origen_id: selectedId,
                muestreador_origen_nombre: muestreadores.find(m => m.id_muestreador === selectedId)?.nombre_muestreador,
                tipo_traspaso: transferType,
            }
        };

        if (transferType === 'BASE') {
            if (!targetBase) return alert('Seleccione una base de destino');
            payload.datos_json.base_destino = targetBase;
        } else if (transferType === 'MUESTREADOR') {
            if (!targetMuestreadorId) return alert('Seleccione un muestreador de destino');
            if (targetMuestreadorId === selectedId) return alert('El destino debe ser diferente al origen');
            payload.datos_json.muestreador_destino_id = targetMuestreadorId;
            payload.datos_json.muestreador_destino_nombre = muestreadores.find(m => m.id_muestreador === targetMuestreadorId)?.nombre_muestreador;
        } else if (transferType === 'MANUAL') {
            payload.datos_json.reasignacion_manual = equipmentList.map(eq => ({
                id_equipo: eq.id_equipo,
                nombre_equipo: eq.nombre,
                codigo_equipo: eq.codigo,
                id_muestreador_nuevo: manualAssignments[eq.id_equipo] || null
            }));
        }

        setLoading(true);
        try {
            const types = await ursService.getRequestTypes();
            const type = types.find((t: any) => t.codigo === 'DESHABILITAR_MUESTREADOR' || t.nombre === 'Deshabilitar muestreador');
            if (!type) throw new Error("No se encontró el tipo de solicitud");

            await ursService.createRequest({
                id_tipo: type.id_tipo,
                datos_json: payload.datos_json,
                archivos: []
            });
            setSubmitted(true);
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            alert('Error al crear la solicitud');
        } finally {
            setLoading(false);
        }
    };

    if (submitted && !isEmbedded) {
        return (
            <div className="form-container-v2 success-view animate-fade-in">
                <div className="success-content">
                    <div className="success-icon">✅</div>
                    <h2>¡Solicitud Enviada!</h2>
                    <p>La solicitud de deshabilitación ha sido creada correctamente.</p>
                    <button className="v2-btn-secondary" onClick={() => setActiveSubmodule('urs-list')}>
                        Ir ahora
                    </button>
                </div>
            </div>
        );
    }

    const content = (
        <div className={`muestreador-form-v2 ${isEmbedded ? 'embedded' : ''}`}>
            <section className="form-section-compact">
                {!isEmbedded && (
                    <div className="section-header-compact">
                        <span className="step-badge">1</span>
                        <h3>Paso 1: Identificación</h3>
                    </div>
                )}
                <div className="form-group-compact">
                    <label className="adl-label-small">Muestreador a deshabilitar</label>
                    <select 
                        className="adl-select-compact"
                        value={selectedId}
                        onChange={(e) => setSelectedId(Number(e.target.value))}
                        required
                    >
                        <option value="">Seleccione un muestreador...</option>
                        {muestreadores.map(m => (
                            <option key={m.id_muestreador} value={m.id_muestreador}>
                                {m.nombre_muestreador}
                            </option>
                        ))}
                    </select>
                </div>
            </section>

            {selectedId && (
                <section className="form-section-compact animate-slide-up">
                    <div className="section-header-compact">
                        {!isEmbedded && <span className="step-badge">2</span>}
                        <h3>Gestión de Equipos Asociados</h3>
                    </div>
                    <div className="options-row-v2">
                        <div 
                            className={`mini-option-card ${transferType === 'BASE' ? 'active' : ''}`}
                            onClick={() => setTransferType('BASE')}
                        >
                            <strong>Trasladar a Base</strong>
                            <p>{equipmentCount !== null ? `${equipmentCount} equipos a base` : 'Traspaso a base fija'}</p>
                        </div>
                        <div 
                            className={`mini-option-card ${transferType === 'MUESTREADOR' ? 'active' : ''}`}
                            onClick={() => setTransferType('MUESTREADOR')}
                        >
                            <strong>Otro Muestreador</strong>
                            <p>{equipmentCount !== null ? `${equipmentCount} equipos a compañero` : 'Traspaso total'}</p>
                        </div>
                        <div 
                            className={`mini-option-card ${transferType === 'MANUAL' ? 'active' : ''}`}
                            onClick={() => setTransferType('MANUAL')}
                        >
                            <strong>Manual</strong>
                            <p>{equipmentCount !== null ? `Asignar ${equipmentCount} equipos` : 'Por equipo'}</p>
                        </div>
                    </div>
                </section>
            )}

            {transferType === 'BASE' && (
                <section className="form-section-compact animate-slide-up">
                    <div className="form-group-compact">
                        <label className="adl-label-small">Base de destino</label>
                        <select 
                            className="adl-select-compact"
                            value={targetBase}
                            onChange={(e) => setTargetBase(e.target.value)}
                            required
                        >
                            <option value="">Seleccione base...</option>
                            {bases.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                </section>
            )}

            {transferType === 'MUESTREADOR' && (
                <section className="form-section-compact animate-slide-up">
                    <div className="form-group-compact">
                        <label className="adl-label-small">Muestreador de destino</label>
                        <select 
                            className="adl-select-compact"
                            value={targetMuestreadorId}
                            onChange={(e) => setTargetMuestreadorId(Number(e.target.value))}
                            required
                        >
                            <option value="">Seleccione destino...</option>
                            {muestreadores.filter(m => m.id_muestreador !== selectedId).map(m => (
                                <option key={m.id_muestreador} value={m.id_muestreador}>
                                    {m.nombre_muestreador}
                                </option>
                            ))}
                        </select>
                    </div>
                </section>
            )}

            {transferType === 'MANUAL' && (
                <section className="form-section-compact animate-slide-up">
                    <div className="compact-list-header">
                        <span className="label">Equipos Asociados</span>
                        <span className="label">Nuevo Responsable</span>
                    </div>
                    {loadingEquipos ? <p className="loading-txt-small">Cargando...</p> : (
                        <div className="compact-eq-list">
                            {equipmentList.map(eq => (
                                <div key={eq.id_equipo} className="eq-row-v2">
                                    <div className="eq-name-group">
                                        <span className="eq-code-v2">{eq.codigo}</span>
                                        <span className="eq-title-v2">{eq.nombre}</span>
                                    </div>
                                    <select 
                                        className="adl-select-mini"
                                        value={manualAssignments[eq.id_equipo] || ''}
                                        onChange={(e) => setManualAssignments({
                                            ...manualAssignments,
                                            [eq.id_equipo]: Number(e.target.value)
                                        })}
                                    >
                                        <option value="">Sin asignar</option>
                                        {muestreadores.filter(m => m.id_muestreador !== selectedId).map(m => (
                                            <option key={m.id_muestreador} value={m.id_muestreador}>{m.nombre_muestreador}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            )}

            {!isEmbedded && (
                <div className="form-actions-v2">
                    <button type="button" className="v2-btn-secondary" onClick={onCancel}>Cancelar</button>
                    <button type="submit" className="v2-btn-primary" disabled={loading || !transferType}>
                        {loading ? 'Enviando...' : 'Enviar'}
                    </button>
                </div>
            )}
        </div>
    );

    return isEmbedded ? content : <form onSubmit={handleSubmit}>{content}</form>;
};

export default MuestreadorDeactivationForm;
