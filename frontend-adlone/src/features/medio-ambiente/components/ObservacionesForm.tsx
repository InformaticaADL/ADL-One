import React from 'react';

interface ObservacionesFormProps {
    value: string;
    onChange: (value: string) => void;
}

export const ObservacionesForm: React.FC<ObservacionesFormProps> = ({ value, onChange }) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (newValue.length <= 250) {
            onChange(newValue);
        }
    };

    return (
        <div style={{
            padding: '1.5rem',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            backgroundColor: 'white',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            maxWidth: '800px',
            margin: '0 auto'
        }}>
            <div className="form-group">
                <label
                    style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: '#374151',
                        marginBottom: '8px',
                        display: 'block'
                    }}
                >
                    Observaciones Comercial
                </label>
                <textarea
                    value={value}
                    onChange={handleChange}
                    placeholder="Ingrese observaciones generales para la ficha..."
                    rows={6}
                    style={{
                        width: '100%',
                        padding: '10px',
                        fontSize: '0.9rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        resize: 'vertical',
                        fontFamily: 'inherit',
                        minHeight: '120px'
                    }}
                />
                <div style={{
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    color: value.length >= 250 ? '#ef4444' : '#6b7280',
                    marginTop: '4px'
                }}>
                    {value.length} / 250 caracteres
                </div>
            </div>
        </div>
    );
};
