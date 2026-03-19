import { ursService } from '../../../services/urs.service';
import { useAuth } from '../../../contexts/AuthContext';
import React, { useState } from 'react';
import FileIcon from './FileIcon';
import DeriveRequestModal from './DeriveRequestModal';
import './RequestDetailPanel.css';

interface RequestDetailPanelProps {
    request: any;
    onRequestUpdate: () => void;
    onReload: () => void;
}

const RequestDetailPanel: React.FC<RequestDetailPanelProps> = ({ request, onRequestUpdate, onReload }) => {
    const [isDeriving, setIsDeriving] = useState(false);
    const { token } = useAuth();

    const handleStatusUpdate = async (newStatus: string) => {
        try {
            await ursService.updateStatus(request.id_solicitud, { status: newStatus });
            onReload();
            onRequestUpdate();
        } catch (error) {
            console.error("Error updating status:", error);
        }
    };

    if (!request) return <div className="details-placeholder">Selecciona una solicitud</div>;

    return (
        <div className="request-detail-panel open">
            <div className="premium-detail-header">
                <div className="header-top-row">
                    <span className="premium-id-badge">ID #{request.id_solicitud}</span>
                    <div className={`premium-status-card ${request.id_estado === 2 ? 'approved' : request.id_estado === 3 ? 'rejected' : 'pending'}`}>
                        {request.estado}
                    </div>
                </div>
                
                <h2 className="premium-title">{request.titulo || request.nombre_tipo}</h2>
                
                <div className="header-meta-row">
                     <div className="meta-item">
                        <span className="meta-label">TIPO</span>
                        <span className="meta-value">{request.nombre_tipo}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">CREADA EL</span>
                        <span className="meta-value">{new Date(request.fecha_solicitud).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </div>
                    <div className="meta-item">
                        <span className="meta-label">PRIORIDAD</span>
                        <span className={`priority-indicator ${request.prioridad?.toLowerCase() || 'normal'}`}>
                             {request.prioridad || 'NORMAL'}
                        </span>
                    </div>
                     <div className="meta-item">
                        <span className="meta-label">SOLICITANTE</span>
                        <span className="meta-value" style={{ fontWeight: 700 }}>{request.nombre_solicitante}</span>
                    </div>
                </div>
            </div>

            <DeriveRequestModal 
                isOpen={isDeriving} 
                requestId={request.id_solicitud} 
                requestTypeId={request.id_tipo}
                onClose={() => setIsDeriving(false)} 
                onSuccess={() => {
                    onReload();
                    onRequestUpdate();
                }}
            />
            <div className="panel-content">
                {request.observaciones && (
                    <div className="premium-observation-card">
                        <div className="observation-label">Observaciones del Solicitante</div>
                        <div className="observation-text">"{request.observaciones}"</div>
                    </div>
                )}

                <section className="section-data">
                    <div className="section-title-row">
                        <span className="section-icon">📄</span>
                        <h3>Detalle de la Información</h3>
                    </div>

                    <div className="premium-data-grid">
                        {/* Specialized for Sampler Deactivation (Phase 13 IDs: 7, 8) */}
                        {request.id_tipo === 7 || request.id_tipo === 8 ? (
                            <div className="specialized-container">
                                <section className="specialized-group">
                                    <div className="info-card-v3 primary">
                                        <div className="card-lbl">Muestreador a deshabilitar</div>
                                        <div className="sampler-horizontal">
                                            <span className="s-id">ID: {request.datos_json?.muestreador_origen_id || '11'}</span>
                                            <span className="s-name">{request.datos_json?.muestreador_origen_nombre}</span>
                                        </div>
                                    </div>

                                    <div className="status-grid-mini">
                                        <div className="mini-card">
                                            <span className="mini-lbl">Equipos asociados</span>
                                            <span className={`mini-val ${request.datos_json?.muestreador_origen_id ? 'yes' : 'no'}`}>
                                                {request.datos_json?.reasignacion_manual || request.datos_json?.muestreador_destino_nombre || request.datos_json?.base_destino ? '✅ SI' : '❌ NO'}
                                            </span>
                                        </div>
                                        <div className="mini-card">
                                            <span className="mini-lbl">Tipo de traspaso de equipos</span>
                                            <span className="mini-val emphasis">
                                                {request.datos_json?.tipo_traspaso === 'IGUAL' || request.datos_json?.tipo_traspaso === 'MUESTREADOR' ? 'A un Muestreador' : 
                                                 request.datos_json?.tipo_traspaso === 'BASE' ? 'BASE' : 
                                                 request.datos_json?.tipo_traspaso === 'DISTINGO' || request.datos_json?.tipo_traspaso === 'MANUAL' ? 'Personalizado / Manual' : 
                                                 request.datos_json?.tipo_traspaso || 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="info-card-v3 destination-card">
                                        <div className="card-lbl">Destino</div>
                                        <div className="card-val-big">
                                            {request.datos_json?.tipo_traspaso === 'IGUAL' || request.datos_json?.tipo_traspaso === 'MUESTREADOR' ? (
                                                <span className="dest-highlight">👤 {request.datos_json?.muestreador_destino_nombre || 'Muestreador No Especificado'}</span>
                                            ) : request.datos_json?.tipo_traspaso === 'BASE' ? (
                                                <span className="dest-highlight">🏢 {request.datos_json?.base_destino || 'Base No Especificada'}</span>
                                            ) : request.datos_json?.tipo_traspaso === 'DISTINGO' || request.datos_json?.tipo_traspaso === 'MANUAL' ? (
                                                <span className="dest-highlight">🛠️ Reasignación Manual ({request.datos_json?.reasignacion_manual?.length || 0} equipos)</span>
                                            ) : (
                                                <span className="dest-highlight">❓ {request.datos_json?.tipo_traspaso || 'No definido'}</span>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {(request.datos_json?.tipo_traspaso === 'DISTINGO' || request.datos_json?.tipo_traspaso === 'MANUAL') && request.datos_json?.reasignacion_manual && (
                                    <div className="manual-mapping-table">
                                        <div className="table-header">
                                            <span>Equipo / Código</span>
                                            <span>Destino: Muestreador</span>
                                        </div>
                                        <div className="table-body">
                                            {request.datos_json.reasignacion_manual.map((item: any, idx: number) => (
                                                <div key={idx} className="table-row">
                                                    <div className="eq-cell">
                                                        <span className="eq-name">{item.nombre}</span>
                                                        <span className="eq-code">COD: {item.codigo}</span>
                                                    </div>
                                                    <div className="target-cell">
                                                        <span className="target-badge">➔</span>
                                                        <span className="target-name">{item.nuevo_muestreador_nombre}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (request.id_tipo === 1 || request.datos_json?._form_type === 'ACTIVACION_EQUIPO') ? (
                            <div className="specialized-container">
                                <section className="specialized-group">
                                    <div className="info-card-v3 primary">
                                        <div className="card-lbl">Nombre del Equipo</div>
                                        <div className="sampler-horizontal">
                                            <span className="s-name" style={{ fontSize: '1.2rem', color: '#1e40af' }}>
                                                {request.datos_json?.nombre_equipo}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="status-grid-mini">
                                        <div className="mini-card">
                                            <span className="mini-lbl">Tipo de Dispositivo</span>
                                            <span className="mini-val emphasis" style={{ color: '#0369a1' }}>
                                                {request.datos_json?.tipo_equipo || 'No especificado'}
                                            </span>
                                        </div>
                                        <div className="mini-card">
                                            <span className="mini-lbl">Sede / Centro Destino</span>
                                            <span className="mini-val" style={{ color: '#0f766e' }}>
                                                📍 {request.datos_json?.nombre_centro || 'No especificado'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="info-card-v3" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                                        <div className="card-lbl">Responsable Asignado</div>
                                        <div className="card-val-big" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ fontSize: '1.4rem' }}>👤</span>
                                            <span style={{ fontWeight: 600, color: '#0369a1' }}>
                                                {request.datos_json?.nombre_responsable || 'Sin asignar'}
                                            </span>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        ) : (request.id_tipo === 2 || request.id_tipo === 6 || request.id_tipo === 10 || request.nombre_tipo?.includes('Baja de Equipo') || request.datos_json?._form_type === 'BAJA_EQUIPO') ? (
                             <div className="specialized-container">
                                <section className="specialized-group">
                                    <div className="info-card-v3" style={{ background: '#fef2f2', border: '1px solid #fecaca' }}>
                                        <div className="card-lbl" style={{ color: '#991b1b' }}>Equipo Desvinculado / Dado de Baja</div>
                                        <div className="sampler-horizontal">
                                            <span className="s-name" style={{ fontSize: '1.2rem', color: '#991b1b', fontWeight: 700 }}>
                                                {request.datos_json?.nombre_equipo_full}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="status-grid-mini">
                                        <div className="mini-card" style={{ borderLeft: '4px solid #ef4444' }}>
                                            <span className="mini-lbl">Causa / Motivo</span>
                                            <span className="mini-val emphasis" style={{ color: '#b91c1c' }}>
                                                ⚠️ {request.datos_json?.motivo || 'No especificado'}
                                            </span>
                                        </div>
                                        <div className="mini-card">
                                            <span className="mini-lbl">Fecha del Suceso</span>
                                            <span className="mini-val">
                                                📅 {request.datos_json?.fecha_baja ? new Date(request.datos_json.fecha_baja).toLocaleDateString() : 'No especificado'}
                                            </span>
                                        </div>
                                    </div>

                                    {request.datos_json?.observaciones && (
                                        <div className="info-card-v3" style={{ background: 'white' }}>
                                            <div className="card-lbl">Observaciones Técnicas</div>
                                            <div className="observation-text" style={{ fontSize: '0.9rem', color: '#475569', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                                "{request.datos_json.observaciones}"
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        ) : (request.id_tipo === 3 || request.nombre_tipo?.includes('Traspaso') || request.datos_json?._form_type === 'TRASPASO_EQUIPO') ? (
                            <div className="specialized-container">
                                <section className="specialized-group">
                                    <div className="info-card-v3 primary" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                        <div className="card-lbl" style={{ color: '#166534' }}>Equipo en Proceso de Traspaso</div>
                                        <div className="sampler-horizontal">
                                            <span className="s-name" style={{ fontSize: '1.2rem', color: '#166534', fontWeight: 700 }}>
                                                {request.datos_json?.nombre_equipo_full}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                                        {/* UBICACION CHANGE */}
                                        {request.datos_json?.traspaso_de?.includes('UBICACION') && (
                                            <div className="info-card-v3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                                                <div className="card-lbl">Cambio de Ubicación (Centro)</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0' }}>
                                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Actual</div>
                                                        <div style={{ fontWeight: 600, color: '#64748b' }}>{request.datos_json?.info_actual?.ubicacion || 'N/A'}</div>
                                                    </div>
                                                    <div style={{ color: '#228be6' }}>➡️</div>
                                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#228be6', textTransform: 'uppercase', fontWeight: 700 }}>Nueva</div>
                                                        <div style={{ fontWeight: 700, color: '#1e40af' }}>{request.datos_json?.nombre_centro_destino}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* RESPONSABLE CHANGE */}
                                        {request.datos_json?.traspaso_de?.includes('RESPONSABLE') && (
                                            <div className="info-card-v3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                                                <div className="card-lbl">Cambio de Responsable</div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0' }}>
                                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>Actual</div>
                                                        <div style={{ fontWeight: 600, color: '#64748b' }}>{request.datos_json?.info_actual?.responsable || 'N/A'}</div>
                                                    </div>
                                                    <div style={{ color: '#12b886' }}>➡️</div>
                                                    <div style={{ flex: 1, textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.75rem', color: '#12b886', textTransform: 'uppercase', fontWeight: 700 }}>Nuevo</div>
                                                        <div style={{ fontWeight: 700, color: '#065f46' }}>{request.datos_json?.nombre_muestreador_destino}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* FALLBACK FOR OLDER REQUESTS (Legacy) */}
                                        {!request.datos_json?.traspaso_de && (
                                            <div className="info-card-v3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                                                <div className="card-lbl">Responsable Destino</div>
                                                <div className="card-val-big" style={{ fontSize: '1.1rem', color: '#1e40af' }}>
                                                    👤 {request.datos_json?.nombre_muestreador_destino}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="status-grid-mini" style={{ marginTop: '1rem' }}>
                                        <div className="mini-card" style={{ borderLeft: '4px solid #3b82f6' }}>
                                            <span className="mini-lbl">Fecha Efectiva</span>
                                            <span className="mini-val">
                                                📅 {request.datos_json?.fecha_traspaso ? new Date(request.datos_json.fecha_traspaso).toLocaleDateString() : 'No especificado'}
                                            </span>
                                        </div>
                                        <div className="mini-card">
                                            <span className="mini-lbl">Motivo Indicado</span>
                                            <span className="mini-val" style={{ fontSize: '0.85rem' }}>
                                                {request.datos_json?.motivo || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        ) : (request.id_tipo === 4 || request.nombre_tipo?.includes('Nuevo Equipo') || request.datos_json?._form_type === 'NUEVO_EQUIPO') ? (
                             <div className="specialized-container">
                                <section className="specialized-group">
                                    <div className="info-card-v3 primary" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
                                        <div className="card-lbl" style={{ color: '#5b21b6' }}>Nuevo Equipo Requerido</div>
                                        <div className="sampler-horizontal">
                                            <span className="s-name" style={{ fontSize: '1.2rem', color: '#5b21b6', fontWeight: 700 }}>
                                                {request.datos_json?.nombre_equipo}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="status-grid-mini">
                                        <div className="mini-card">
                                            <span className="mini-lbl">Categoría</span>
                                            <span className="mini-val emphasis" style={{ color: '#6d28d9' }}>
                                                📦 {request.datos_json?.tipo_equipo || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="mini-card">
                                            <span className="mini-lbl">Marca / Modelo</span>
                                            <span className="mini-val" style={{ fontSize: '0.85rem' }}>
                                                {request.datos_json?.marca} {request.datos_json?.modelo}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="status-grid-mini" style={{ marginTop: '0.5rem' }}>
                                         <div className="mini-card">
                                            <span className="mini-lbl">N° Serie</span>
                                            <span className="mini-val" style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                                                {request.datos_json?.serie || 'POR ASIGNAR'}
                                            </span>
                                        </div>
                                        <div className="mini-card">
                                            <span className="mini-lbl">Fecha Adquisición</span>
                                            <span className="mini-val">
                                                📅 {request.datos_json?.fecha_adquisicion ? new Date(request.datos_json.fecha_adquisicion).toLocaleDateString() : 'N/A'}
                                            </span>
                                        </div>
                                    </div>

                                    {request.datos_json?.observaciones && (
                                        <div className="info-card-v3" style={{ background: 'white', marginTop: '0.5rem' }}>
                                            <div className="card-lbl">Justificación / Observaciones</div>
                                            <div className="observation-text" style={{ fontSize: '0.9rem', color: '#475569', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                                "{request.datos_json.observaciones}"
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        ) : (request.id_tipo === 5 || request.id_tipo === 9 || request.nombre_tipo?.includes('Problema') || request.datos_json?._form_type === 'REPORTE_PROBLEMA') ? (
                             <div className="specialized-container">
                                <section className="specialized-group">
                                    <div className="info-card-v3 primary" style={{ background: '#fff7ed', border: '1px solid #ffedd5' }}>
                                        <div className="card-lbl" style={{ color: '#9a3412' }}>Incidencia Reportada</div>
                                        <div className="sampler-horizontal">
                                            <span className="s-name" style={{ fontSize: '1.2rem', color: '#9a3412', fontWeight: 700 }}>
                                                {request.datos_json?.asunto}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="status-grid-mini">
                                        <div className="mini-card" style={{ borderLeft: '4px solid #f97316' }}>
                                            <span className="mini-lbl">Categoría</span>
                                            <span className="mini-val emphasis" style={{ color: '#ea580c' }}>
                                                🛠️ {request.datos_json?.categoria_problema || 'General'}
                                            </span>
                                        </div>
                                        <div className="mini-card">
                                            <span className="mini-lbl">Prioridad Reportada</span>
                                            <span className="mini-val" style={{ fontWeight: 700, color: request.datos_json?.gravedad === 'CRITICO' ? '#dc2626' : '#ea580c' }}>
                                                {request.datos_json?.gravedad || 'NORMAL'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="info-card-v3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <div className="card-lbl">Equipo Involucrado</div>
                                        <div className="card-val" style={{ fontSize: '0.95rem', color: '#334155' }}>
                                            📟 {request.datos_json?.nombre_equipo_afectado || 'No especificado'}
                                        </div>
                                    </div>

                                    {request.datos_json?.descripcion_problema && (
                                        <div className="info-card-v3" style={{ background: 'white' }}>
                                            <div className="card-lbl">Descripción del Hallazgo</div>
                                            <div className="observation-text" style={{ fontSize: '0.95rem', color: '#1e293b', padding: '0.5rem 0', whiteSpace: 'pre-wrap' }}>
                                                "{request.datos_json.descripcion_problema}"
                                            </div>
                                        </div>
                                    )}
                                </section>
                            </div>
                        ) : (
                            /* Generic Display for other types */
                            <div className="generic-data-list">
                                {request.datos_json && typeof request.datos_json === 'object' ? (
                                    Object.entries(request.datos_json).map(([key, value]) => {
                                        if (['prioridad', 'titulo', 'descripcion'].includes(key)) return null;
                                        return (
                                            <div key={key} className="generic-row">
                                                <span className="gen-label">{key.replace(/_/g, ' ')}</span>
                                                <span className="gen-value">{String(value)}</span>
                                            </div>
                                        );
                                    })
                                ) : null}
                            </div>
                        )}
                    </div>
                </section>

                <section className="section-attachments">
                    <div className="section-title-row">
                        <span className="section-icon">📎</span>
                        <h3>Archivos Adjuntos</h3>
                    </div>
                    <div className="premium-attachments-list">
                        {request.archivos_adjuntos && request.archivos_adjuntos.length > 0 ? (
                            request.archivos_adjuntos.map((file: any) => (
                                <a 
                                    key={file.id_adjunto} 
                                    href={`${import.meta.env.VITE_API_URL}/api/urs/download/${file.id_adjunto}?token=${token}`} 
                                    className="attachment-item"
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                >
                                    <span className="file-icon">
                                        <FileIcon mimetype={file.tipo_archivo} filename={file.nombre_archivo} size={28} />
                                    </span>
                                    <div className="file-info">
                                        <span className="file-name">{file.nombre_archivo}</span>
                                        <span className="file-meta">{(file.tipo_archivo || 'Archivo').toUpperCase()} • {new Date(file.fecha).toLocaleDateString()}</span>
                                    </div>
                                    <span className="download-hint">⬇️</span>
                                </a>
                            ))
                        ) : (
                            <div className="empty-attachments">
                                <span className="empty-icon">📂</span>
                                <p>No hay archivos adjuntos para esta solicitud.</p>
                            </div>
                        )}
                    </div>
                </section>

                <section className="section-management premium-management">
                    <div className="section-title-row">
                        <span className="section-icon">⚙️</span>
                        <h3>Bandeja de Gestión</h3>
                    </div>
                    
                    <div className="premium-actions-grid">
                        {(request.can_manage || request.can_derive) ? (
                            <>
                                {request.can_manage && (
                                    <>
                                        <button className="p-btn p-approve" onClick={() => handleStatusUpdate('APROBADO')}>
                                            <span className="btn-ico">✅</span> Aprobar
                                        </button>
                                        <button className="p-btn p-reject" onClick={() => handleStatusUpdate('RECHAZADO')}>
                                            <span className="btn-ico">❌</span> Rechazar
                                        </button>
                                        <button className="p-btn p-review" onClick={() => handleStatusUpdate('EN_REVISION')}>
                                            <span className="btn-ico">🔍</span> Revisión
                                        </button>
                                    </>
                                )}
                                {request.can_derive && (
                                    <button className="p-btn p-derive" onClick={() => setIsDeriving(true)}>
                                        <span className="btn-ico">⤴️</span> Derivar
                                    </button>
                                )}
                            </>
                        ) : (
                            <div className="read-only-notice">
                                <span className="notice-icon">🔒</span>
                                <div className="notice-content">
                                    <strong>Modo Lectura</strong>
                                    <p>Tienes acceso de visualización para este trámite.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default RequestDetailPanel;
