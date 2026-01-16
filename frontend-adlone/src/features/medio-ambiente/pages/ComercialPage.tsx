import React from 'react';

interface Props {
    onBack: () => void;
}

export const ComercialPage: React.FC<Props> = ({ onBack }) => {
    return (
        <div className="page-content">
            <button onClick={onBack} style={{ marginBottom: '1rem', cursor: 'pointer' }}>← Volver</button>
            <h2>Fichas de Ingreso - Comercial</h2>
            <p>Lógica especifica para el módulo Comercial.</p>
            {/* Aquí irá el formulario comercial */}
        </div>
    );
};
