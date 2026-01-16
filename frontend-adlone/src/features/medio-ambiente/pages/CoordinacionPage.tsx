import React from 'react';

interface Props {
    onBack: () => void;
}

export const CoordinacionPage: React.FC<Props> = ({ onBack }) => {
    return (
        <div className="page-content">
            <button onClick={onBack} style={{ marginBottom: '1rem', cursor: 'pointer' }}>← Volver</button>
            <h2>Fichas de Ingreso - Coordinación</h2>
            <p>Lógica especifica para Coordinación y Logística.</p>
        </div>
    );
};
