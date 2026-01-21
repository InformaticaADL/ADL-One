import React, { useState } from 'react';
import { AntecedentesForm } from '../components/AntecedentesForm';
import { CatalogosProvider } from '../context/CatalogosContext';
import { ToastProvider } from '../../../contexts/ToastContext';
import { ToastContainer } from '../../../components/Toast/Toast';

interface Props {
    onBack: () => void;
}

// Tipos para los datos del formulario (se ampliará después)
interface CommercialFormData {
    antecedentes?: any;
    analisis?: any;
    observaciones?: any;
}

export const ComercialPage: React.FC<Props> = ({ onBack }) => {
    // Estado de la pestaña activa
    const [activeTab, setActiveTab] = useState<'antecedentes' | 'analisis' | 'observaciones'>('antecedentes');

    // Estado persistente del formulario
    const [formData, setFormData] = useState<CommercialFormData>({});

    const handleSave = () => {
        console.log("Grabando ficha con datos:", formData);
        alert("Funcionalidad de Grabado: Datos listos para enviar al backend.");
    };

    return (
        <ToastProvider>
            <div className="fichas-ingreso-container commercial-layout">
                {/* 1. Header Row (Back Button + Title) */}
                <div className="header-row">
                    <button onClick={onBack} className="btn-back">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Volver
                    </button>
                    <h2 className="page-title-geo">Ficha de Ingreso - Comercial</h2>
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
                <div className="tab-content-area">
                    <div className="fade-in" style={{ display: activeTab === 'antecedentes' ? 'block' : 'none' }}>
                        <CatalogosProvider>
                            <AntecedentesForm />
                        </CatalogosProvider>
                    </div>

                    <div className="fade-in" style={{ display: activeTab === 'analisis' ? 'block' : 'none' }}>
                        <h3>Detalle de Análisis</h3>
                        <p>Selección de matriz y ensayos requeridos.</p>
                    </div>

                    <div className="fade-in" style={{ display: activeTab === 'observaciones' ? 'block' : 'none' }}>
                        <h3>Observaciones Finales</h3>
                        <p>Comentarios adicionales importantes para la muestra.</p>
                    </div>
                </div>

                {/* 4. Acción Global de Grabado */}
                <div className="form-actions">
                    <button className="btn-save" onClick={handleSave}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1-2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Grabar Ficha
                    </button>
                </div>
            </div>

            {/* Toast Container */}
            <ToastContainer />
        </ToastProvider>
    );
};
