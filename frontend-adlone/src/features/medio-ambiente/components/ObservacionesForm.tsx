import React from 'react';


interface ObservacionesFormProps {
    value: string;
    onChange: (value: string) => void;

    label?: string;
    readOnly?: boolean;
    placeholder?: string;
    children?: React.ReactNode;
}

const ObservacionesFormComponent: React.FC<ObservacionesFormProps> = ({
    value,
    onChange,
    label = "Observaciones",
    readOnly = false,
    placeholder = "Ingrese observaciones...",
    children
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        if (newValue.length <= 250) {
            onChange(newValue);
        }
    };



    return (
        <div style={{
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%'
        }}>
            <div style={{
                padding: '1.5rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                height: 'fit-content'
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
                        {label}
                    </label>
                    <textarea
                        value={value}
                        onChange={handleChange}
                        placeholder={placeholder}
                        readOnly={readOnly}
                        rows={6}
                        style={{
                            width: '100%',
                            padding: '10px',
                            fontSize: '0.9rem',
                            border: readOnly ? '1px solid #e5e7eb' : '1px solid #d1d5db',
                            borderRadius: '6px',
                            resize: 'vertical',
                            fontFamily: 'inherit',
                            minHeight: '120px',
                            backgroundColor: readOnly ? '#f9fafb' : 'white',
                            color: '#374151'
                        }}
                    />
                    {!readOnly && (
                        <div style={{
                            textAlign: 'right',
                            fontSize: '0.75rem',
                            color: value.length >= 250 ? '#ef4444' : '#6b7280',
                            marginTop: '4px'
                        }}>
                            {value.length} / 250 caracteres
                        </div>
                    )}

                    {children && (
                        <div style={{
                            marginTop: '1.5rem',
                            borderTop: '1px solid #f3f4f6',
                            paddingTop: '1rem',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: '1rem'
                        }}>
                            {children}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Wrap with React.memo to prevent unnecessary re-renders and flickering
export const ObservacionesForm = React.memo(ObservacionesFormComponent);
