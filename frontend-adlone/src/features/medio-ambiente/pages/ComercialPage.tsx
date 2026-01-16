import React from 'react';

interface Props {
    onBack: () => void;
}

export const ComercialPage: React.FC<Props> = ({ onBack }) => {
    return (
        <div className="fichas-ingreso-container">
            <button onClick={onBack} className="btn-back">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Volver
            </button>

            <header className="page-header">
                <h2 className="page-title-geo">Fichas de Ingreso - Comercial</h2>
                <p className="page-subtitle">Gestión de cotizaciones y oportunidades.</p>
            </header>

            <p>Lógica especifica para el módulo Comercial.</p>
        </div>
    );
};
