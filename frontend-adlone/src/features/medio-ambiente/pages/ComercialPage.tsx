import React, { useState, useRef } from 'react';
import { AntecedentesForm } from '../components/AntecedentesForm';
import type { AntecedentesFormHandle } from '../components/AntecedentesForm';
import { AnalysisForm } from '../components/AnalysisForm';
import { ObservacionesForm } from '../components/ObservacionesForm';
import { CatalogosProvider } from '../context/CatalogosContext';
import { ToastProvider, useToast } from '../../../contexts/ToastContext';
import { ToastContainer } from '../../../components/Toast/Toast';
import { fichaService } from '../services/ficha.service';
// import { useNavigate } from 'react-router-dom';

interface Props {
    onBack: () => void;
}

// Inline Success Modal Component
const SuccessModal = ({
    isOpen,
    onClose,
    fichaId
}: {
    isOpen: boolean;
    onClose: () => void;
    fichaId: number | null
}) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                backgroundColor: 'white',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '400px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    backgroundColor: '#dcfce7',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                    color: '#16a34a'
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
                    ¡Ficha Creada Exitosamente!
                </h3>
                <p style={{ color: '#374151', marginBottom: '24px' }}>
                    Se ha generado la Ficha N° <strong>{fichaId}</strong> correctamente en el sistema.
                </p>
                <button
                    onClick={onClose}
                    style={{
                        width: '100%',
                        padding: '10px',
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '1rem',
                        transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#15803d'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                >
                    Aceptar y Volver
                </button>
            </div>
        </div>
    );
};

// Wrapper component to provide toast context to handleSave
const ComercialPageContent: React.FC<Props> = ({ onBack }) => {
    const { showToast } = useToast();
    // const navigate = useNavigate(); // Assume routing is handled by onBack or parent for now

    // Estado de la pestaña activa
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'analisis' | 'observaciones'>('antecedentes');

    // Estado persistente del formulario
    const [observaciones, setObservaciones] = useState('');

    // Lifted State for Analysis
    const [savedAnalysis, setSavedAnalysis] = useState<any[]>([]);

    // State for Success Modal
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdFichaId, setCreatedFichaId] = useState<number | null>(null);

    // Ref for Antecedentes Form
    const antecedentesRef = useRef<AntecedentesFormHandle>(null);

    const handleSave = async () => {
        try {
            // 1. Get Data from Antecedentes
            const antData = antecedentesRef.current?.getData();

            // Helper to validate Antecedentes
            const validateAntecedentes = (data: any) => {
                const requiredFields = [
                    { key: 'selectedLugar', label: 'Base de Operaciones' },
                    { key: 'selectedEmpresa', label: 'Empresa a Facturar' },
                    { key: 'selectedCliente', label: 'Empresa de Servicio' },
                    { key: 'selectedContacto', label: 'Contacto empresa' },
                    { key: 'responsableMuestreo', label: 'Responsable Muestreo' },
                    { key: 'cargoResponsable', label: 'Cargo Responsable' }
                ];

                for (const field of requiredFields) {
                    if (!data || !data[field.key] || String(data[field.key]).trim() === '') {
                        return `Falta completar: ${field.label}`;
                    }
                }
                return null;
            };

            const antError = validateAntecedentes(antData);
            if (antError) {
                showToast({ type: 'error', message: antError });
                setActiveTab('antecedentes');
                return;
            }

            // 2. Validate Analysis
            if (savedAnalysis.length === 0) {
                showToast({ type: 'warning', message: 'Debes ingresar al menos un análisis' });
                setActiveTab('analisis');
                return;
            }

            // 3. Prepare Payload
            const payload = {
                antecedentes: antData,
                analisis: savedAnalysis,
                observaciones: observaciones,
                user: { id: 1 } // Hardcoded user for now, should come from AuthContext
            };

            console.log("Saving Payload:", payload);

            // 4. Call Service
            const result = await fichaService.create(payload);

            if (result && (result.success || result.data?.success)) {
                // Handle nested data structure from successResponse wrapper
                // Structure is likely: { success: true, data: { success: true, id: 54, ... }, message: ... }
                const idToUse = result.data?.id || result.id;

                if (idToUse) {
                    setCreatedFichaId(Number(idToUse));
                    setShowSuccessModal(true);
                } else {
                    showToast({ type: 'warning', message: 'Ficha creada pero no se recibió un ID válido.' });
                }
            } else {
                showToast({ type: 'error', message: 'Error al respuesta del servidor' });
            }

        } catch (error: any) {
            console.error("Error saving ficha:", error);
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al grabar la ficha' });
        }
    };

    const handleCloseSuccess = () => {
        setShowSuccessModal(false);
        setCreatedFichaId(null);
        // Clear forms logic if needed (handled by unmounting)
        onBack();
    };

    return (
        <div className="fichas-ingreso-container commercial-layout">
            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleCloseSuccess}
                fichaId={createdFichaId}
            />

            {/* 1. Header Row (Back Button + Title) */}
            <div className="header-row">
                <button onClick={onBack} className="btn-back">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                    </svg>
                    Volver
                </button>
                <h2 className="page-title-geo">Creación Ficha de Ingreso - Comercial</h2>
            </div>

            {/* 2. Navegación por Pestañas (Centradas) */}
            <div className="tabs-container">
                <button
                    className={`tab-button ${activeTab === 'antecedentes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('antecedentes')}
                >
                    Antecedentes
                </button>
                <button
                    className={`tab-button ${activeTab === 'analisis' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analisis')}
                >
                    Análisis
                </button>
                <button
                    className={`tab-button ${activeTab === 'observaciones' ? 'active' : ''}`}
                    onClick={() => setActiveTab('observaciones')}
                >
                    Observaciones
                </button>
            </div>

            {/* 3. Contenido Dinámico (Persistente) */}
            <CatalogosProvider>
                <div className="tab-content-area">
                    <div className="fade-in" style={{ display: activeTab === 'antecedentes' ? 'block' : 'none' }}>
                        <AntecedentesForm ref={antecedentesRef} />
                    </div>

                    <div className="fade-in" style={{ display: activeTab === 'analisis' ? 'block' : 'none' }}>
                        <AnalysisForm
                            savedAnalysis={savedAnalysis}
                            onSavedAnalysisChange={setSavedAnalysis}
                        />
                    </div>

                    <div className="fade-in" style={{ display: activeTab === 'observaciones' ? 'block' : 'none' }}>
                        <ObservacionesForm
                            value={observaciones}
                            onChange={setObservaciones}
                        />
                    </div>
                </div>
            </CatalogosProvider>

            {/* 4. Acción Global de Grabado */}
            <div className="form-actions">
                <button className="btn-save" onClick={handleSave}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    Grabar Ficha
                </button>
            </div>
        </div>
    );
};

export const ComercialPage: React.FC<Props> = (props) => {
    return (
        <ToastProvider>
            <ComercialPageContent {...props} />
            <ToastContainer />
        </ToastProvider>
    );
};
