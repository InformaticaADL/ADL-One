import React from 'react';

interface Props {
    onBack: () => void;
}

export const TecnicaPage: React.FC<Props> = ({ onBack }) => {
    return (
        <div className="page-content">
            <button onClick={onBack} style={{ marginBottom: '1rem', cursor: 'pointer' }}>← Volver</button>
            <h2>Fichas de Ingreso - Área Técnica</h2>
            <p>Lógica especifica para el módulo Técnico / Ingreso de Muestras.</p>
        </div>
    );
};
