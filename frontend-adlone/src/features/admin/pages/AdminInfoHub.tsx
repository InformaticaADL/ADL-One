import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { adminExportService } from '../services/admin.service';
import { EquipoCatalogoView } from '../components/EquipoCatalogoView';

// Mock list of areas as requested
// List of areas with specific permissions
const AREAS: { id: string, label: string, icon: string, permission: string | string[] }[] = [
    { id: 'gem', label: 'GEM', icon: '🧬', permission: 'GEM_ACCESO' },
    { id: 'necropsia', label: 'Necropsia', icon: '🐟', permission: 'NEC_ACCESO' },
    { id: 'microscopia', label: 'Microscopía', icon: '🔬', permission: 'MIC_ACCESO' },
    { id: 'biologia_molecular', label: 'Biología Molecular', icon: '🧪', permission: 'BM_ACCESO' },
    { id: 'cultivo_celular', label: 'Cultivo Celular', icon: '🧫', permission: 'CC_ACCESO' },
    { id: 'bacteriologia', label: 'Bacteriología', icon: '🦠', permission: 'BAC_ACCESO' },
    { id: 'screening', label: 'Screening', icon: '🔎', permission: 'SCR_ACCESO' },
    { id: 'derivaciones', label: 'Derivaciones', icon: '📬', permission: 'DER_ACCESO' },
    { id: 'medio_ambiente', label: 'Medio Ambiente', icon: '🌿', permission: 'MA_ACCESO' },
    { id: 'atl', label: 'ATL', icon: '⚖️', permission: 'ATL_ACCESO' },
    { id: 'id', label: 'I+D', icon: '💡', permission: 'ID_ACCESO' },
    { id: 'pve', label: 'PVE', icon: '🩺', permission: 'PVE_ACCESO' },
    { id: 'informatica', label: 'Informática', icon: '💻', permission: 'INF_ACCESO' },
    { id: 'comercial', label: 'Comercial', icon: '📈', permission: 'COM_ACCESO' },
    { id: 'gestion_calidad', label: 'Gestión de Calidad', icon: '⭐', permission: 'GC_ACCESO' },
    { id: 'administracion', label: 'Administración', icon: '🏢', permission: 'ADM_ACCESO' },
];

const TABLES_TO_EXPORT = [
    // --- MAESTROS (GRAL) ---
    { id: 'mae_empresaservicios', label: 'mae_empresaservicios', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'mae_empresa', label: 'mae_empresa', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'mae_cargo', label: 'mae_cargo', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'mae_umedida', label: 'mae_umedida', type: 'TABLE', area: 'Maestros (Gral)' },
    { id: 'consulta_contacto_una_empresa', label: 'consulta_contacto_una_empresa (SP)', type: 'SP', area: 'Maestros (Gral)' },

    // --- FICHAS E INGRESOS ---
    { id: 'App_Ma_FichaIngresoServicio_ENC', label: 'App_Ma_FichaIngresoServicio_ENC', type: 'TABLE', area: 'Fichas e Ingresos' },
    { id: 'consulta_centro', label: 'consulta_centro (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_objetivomuestreo_ma_oservicios', label: 'consulta_objetivomuestreo_ma_oservicios (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_tipomuestreo_medio_ambiente', label: 'consulta_tipomuestreo_medio_ambiente (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_mae_actividadmuestreo', label: 'consulta_mae_actividadmuestreo (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_mae_tipodescarga', label: 'consulta_mae_tipodescarga (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'Consulta_Mae_Modalidad', label: 'Consulta_Mae_Modalidad (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'Consulta_Frecuencia_Periodo', label: 'Consulta_Frecuencia_Periodo (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'Consulta_Mae_Formacanal', label: 'Consulta_Mae_Formacanal (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'Consulta_App_Ma_ReferenciaAnalisis', label: 'Consulta_App_Ma_ReferenciaAnalisis (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'Maestro_Tipoentrega', label: 'Maestro_Tipoentrega (SP)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_subarea_medioambiente', label: 'Sub-área (MA)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'consulta_tipomuestra_ma', label: 'Tipo Muestra (MA)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'Consulta_App_Ma_NormativaReferencia', label: 'Normativa - Referencia (Relación)', type: 'SP', area: 'Fichas e Ingresos' },
    { id: 'mae_zonageografica', label: 'Zonas Geográficas (UTM)', type: 'TABLE', area: 'Fichas e Ingresos' },

    // --- SOLICITUDES Y MUESTREO ---
    { id: 'mae_muestreador', label: 'mae_muestreador', type: 'TABLE', area: 'Solicitudes y Muestreo' },
    { id: 'mae_estadomuestreo', label: 'mae_estadomuestreo', type: 'TABLE', area: 'Solicitudes y Muestreo' },
    { id: 'maestro_lugaranalisis', label: 'maestro_lugaranalisis (SP)', type: 'SP', area: 'Solicitudes y Muestreo' },
    { id: 'consulta_inspectorambiental', label: 'consulta_inspectorambiental (SP)', type: 'SP', area: 'Solicitudes y Muestreo' },
    { id: 'consulta_laboratorioensayo', label: 'consulta_laboratorioensayo (SP)', type: 'SP', area: 'Solicitudes y Muestreo' },

    // --- ANÁLISIS Y NORMATIVA ---
    { id: 'consulta_tipomuestra_medioambiente', label: 'consulta_tipomuestra_medioambiente (SP)', type: 'SP', area: 'Análisis y Normativa' },
    { id: 'consulta_subarea_medioambiente', label: 'consulta_subarea_medioambiente (SP)', type: 'SP', area: 'Análisis y Normativa' },
    { id: 'consulta_tipomuestra_ma', label: 'consulta_tipomuestra_ma (SP)', type: 'SP', area: 'Análisis y Normativa' },
    { id: 'Consulta_App_Ma_Normativa', label: 'Consulta_App_Ma_Normativa (SP)', type: 'SP', area: 'Análisis y Normativa' },
    { id: 'Consulta_App_Ma_NormativaReferencia', label: 'Consulta_App_Ma_NormativaReferencia (SP)', type: 'SP', area: 'Análisis y Normativa' },

    // --- EQUIPOS E INSTRUMENTOS ---
    { id: 'mae_instrumentoambiental', label: 'mae_instrumentoambiental', type: 'TABLE', area: 'Equipos e Instrumentos' },
    { id: 'Consulta_Mae_Dispositivohidraulico', label: 'Consulta_Mae_Dispositivohidraulico (SP)', type: 'SP', area: 'Equipos e Instrumentos' },

    // --- CALIDAD Y EQUIPOS ---
    { id: 'mae_equipo', label: 'Inventario de Equipos (Vigencia)', type: 'TABLE', area: 'Calidad y Equipos' },
    { id: 'mae_equipo_historial', label: 'Historial de Cambios (Equipos)', type: 'TABLE', area: 'Calidad y Equipos' },
    { id: 'mae_solicitud_equipo', label: 'Solicitudes de Gestión (Auditoría)', type: 'TABLE', area: 'Calidad y Equipos' },
];

import '../admin.css';

interface Props {
    onNavigate: (areaId: string) => void;
}

export const AdminInfoHub: React.FC<Props> = ({ onNavigate }) => {
    const { hasPermission, user } = useAuth();
    const [currentView, setCurrentView] = useState<'grid' | 'export' | 'catalogo'>('grid');
    const [selectedArea, setSelectedArea] = useState<string>(TABLES_TO_EXPORT[0].area);
    const [selectedId, setSelectedId] = useState(TABLES_TO_EXPORT[0].id);
    const [exporting, setExporting] = useState(false);

    const activeExport = TABLES_TO_EXPORT.find(t => t.id === selectedId);
    const areas = Array.from(new Set(TABLES_TO_EXPORT.map(t => t.area)));
    const filteredOptions = TABLES_TO_EXPORT.filter(t => t.area === selectedArea);

    // Filter areas based on user permissions
    const visibleAreas = AREAS.filter(area => {
        if (hasPermission('AI_MA_ADMIN_ACCESO')) return true;
        if (Array.isArray(area.permission)) {
            return area.permission.some(p => hasPermission(p));
        }
        return hasPermission(area.permission);
    });

    const handleExport = async () => {
        if (exporting || !activeExport) return;
        setExporting(true);
        try {
            const params: any = {};
            const response = await adminExportService.getExportTableData(
                activeExport.id, 
                activeExport.type as any, 
                params
            );

            if (response.success && response.data) {
                const worksheet = XLSX.utils.json_to_sheet(response.data);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
                
                XLSX.writeFile(workbook, `${activeExport.id}_${new Date().toISOString().split('T')[0]}.xlsx`);
            } else {
                alert('Error al obtener datos');
            }
        } catch (error: any) {
            console.error('Export error details:', error);
            alert(`Error en la exportación: ${error.message || 'Error desconocido'}`);
        } finally {
            setExporting(false);
        }
    };

    const isRdiaz = user?.username?.toLowerCase() === 'rdiaz' || user?.name?.toLowerCase().includes('diaz');

    return (
        <div className="admin-container">
            <div className="admin-header-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.25rem', marginBottom: '1.5rem' }}>
                <h1 className="admin-title" style={{ margin: 0 }}>
                    {currentView === 'export' ? 'Exportación de Datos' : 
                     currentView === 'catalogo' ? 'Catálogo Maestro' : 'Admin. Información'}
                </h1>
                <p className="admin-subtitle" style={{ margin: 0 }}>
                    {currentView === 'export' ? 'Configure su reporte personalizado abajo.' : 
                     currentView === 'catalogo' ? 'Gestione las definiciones base para el inventario.' : 'Seleccione un área para gestionar su información.'}
                </p>
            </div>

            {currentView === 'grid' && (
                <div className="hub-grid" style={{ animation: 'pve-fadeIn 0.4s ease-out' }}>
                    {visibleAreas.map((area) => (
                        <div
                            key={area.id}
                            onClick={() => onNavigate(area.id)}
                            className="hub-card"
                        >
                            <div className="card-icon-wrapper">
                                {area.icon}
                            </div>
                            <div>
                                <h3 className="card-title">{area.label}</h3>
                            </div>
                        </div>
                    ))}

                    {(isRdiaz || hasPermission('AI_MA_ADMIN_ACCESO')) && (
                        <div
                            onClick={() => setCurrentView('catalogo')}
                            className="hub-card"
                            style={{ 
                                border: '2px dashed rgba(30, 41, 59, 0.4)',
                                background: 'rgba(30, 41, 59, 0.02)'
                            }}
                        >
                            <div className="card-icon-wrapper" style={{ background: 'rgba(30, 41, 59, 0.1)', color: '#1e293b' }}>
                                📋
                            </div>
                            <div>
                                <h3 className="card-title" style={{ color: '#1e293b' }}>Administrar Catálogo</h3>
                            </div>
                        </div>
                    )}

                    {isRdiaz && (
                        <div
                            onClick={() => setCurrentView('export')}
                            className="hub-card"
                            style={{ 
                                border: '2px dashed rgba(34, 197, 94, 0.4)',
                                background: 'rgba(34, 197, 94, 0.02)'
                            }}
                        >
                            <div className="card-icon-wrapper" style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}>
                                📊
                            </div>
                            <div>
                                <h3 className="card-title" style={{ color: '#22c55e' }}>Exportar Excel</h3>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {currentView === 'export' && (
                <div className="export-view-container" style={{ 
                    animation: 'pve-slideUp 0.4s ease-out',
                    maxWidth: '1200px',
                    margin: '0 auto',
                    background: '#ffffff',
                    padding: '1.5rem 2rem',
                    borderRadius: '24px',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <div>
                            <h2 style={{ color: '#1e293b', margin: 0, fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.01em' }}>
                                <span style={{ marginRight: '0.5rem' }}>🚀</span> Centro de Exportación
                            </h2>
                            <p style={{ color: '#64748b', margin: '0.1rem 0 0 0', fontSize: '0.85rem' }}>
                                Seleccione un área y el recurso para descargar.
                            </p>
                        </div>
                        <button 
                            onClick={() => setCurrentView('grid')}
                            style={{
                                background: '#f1f5f9',
                                border: 'none',
                                color: '#475569',
                                padding: '0.4rem 1rem',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem'
                            }}
                        >
                            ⬅️ Volver
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Selector de Área con Botones / Chips */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                1. Área de Negocio
                            </label>
                            <div style={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: '0.5rem',
                                padding: '0.25rem 0'
                            }}>
                                {areas.map(area => (
                                    <button
                                        key={area}
                                        onClick={() => {
                                            setSelectedArea(area);
                                            const firstInArea = TABLES_TO_EXPORT.find(t => t.area === area);
                                            if (firstInArea) setSelectedId(firstInArea.id);
                                        }}
                                        style={{
                                            padding: '0.4rem 1rem',
                                            borderRadius: '12px',
                                            border: '2px solid',
                                            borderColor: selectedArea === area ? '#22c55e' : '#f1f5f9',
                                            background: selectedArea === area ? 'rgba(34, 197, 94, 0.05)' : '#ffffff',
                                            color: selectedArea === area ? '#166534' : '#64748b',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                                        }}
                                    >
                                        {area}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Visualizador de Recursos (Grid Compacto) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <label style={{ color: '#94a3b8', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                2. Recursos Disponibles
                            </label>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                                gap: '0.75rem'
                            }}>
                                {filteredOptions.map(t => (
                                    <div
                                        key={t.id}
                                        onClick={() => !exporting && setSelectedId(t.id)}
                                        style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: '16px',
                                            border: '1px solid',
                                            borderColor: selectedId === t.id ? '#22c55e' : '#f1f5f9',
                                            background: selectedId === t.id ? '#ffffff' : '#f8fafc',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'center',
                                            boxShadow: selectedId === t.id ? '0 8px 12px -3px rgba(34, 197, 94, 0.08)' : 'none',
                                            minHeight: '80px'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: selectedId === t.id ? '0.5rem' : '0' }}>
                                            <div style={{ 
                                                width: '24px', 
                                                height: '24px', 
                                                minWidth: '24px',
                                                borderRadius: '6px', 
                                                background: selectedId === t.id ? '#22c55e' : '#e2e8f0',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '0.65rem',
                                                color: 'white',
                                                fontWeight: 900
                                            }}>
                                                {t.type === 'SP' ? 'SP' : 'T'}
                                            </div>
                                            <div style={{ 
                                                fontSize: '0.8rem', 
                                                fontWeight: 700, 
                                                color: selectedId === t.id ? '#1e293b' : '#64748b',
                                                wordBreak: 'break-word',
                                                lineHeight: '1.2'
                                            }}>
                                                {t.label.replace(' (SP)', '')}
                                            </div>
                                        </div>

                                        {selectedId === t.id && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleExport();
                                                }}
                                                disabled={exporting}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.4rem',
                                                    borderRadius: '8px',
                                                    background: exporting ? '#94a3b8' : '#22c55e',
                                                    border: 'none',
                                                    color: 'white',
                                                    fontWeight: 800,
                                                    fontSize: '0.7rem',
                                                    cursor: exporting ? 'not-allowed' : 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '0.4rem'
                                                }}
                                            >
                                                {exporting ? 'GENERANDO...' : '📥 DESCARGAR'}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ 
                            marginTop: '0.5rem', 
                            padding: '1rem', 
                            borderRadius: '16px', 
                            background: '#f8fafc',
                            border: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <div style={{ fontSize: '1.2rem' }}>✨</div>
                            <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>
                                Exportación completa de registros en tiempo real.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {currentView === 'catalogo' && (
                <EquipoCatalogoView 
                    onBack={() => setCurrentView('grid')} 
                />
            )}
        </div>
    );
};
