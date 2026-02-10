import React, { useState, useRef, useEffect } from 'react';

export interface HybridSelectProps {
    label?: string;
    value: string;
    options: string[];
    onChange: (val: string) => void;
    placeholder?: string;
    name?: string;
    required?: boolean;
    disabled?: boolean;
}

/**
 * A hybrid component that acts as both a text input and a custom dropdown.
 * Mimics the aesthetic of a standard custom select but allows free-text entry.
 */
export const HybridSelect: React.FC<HybridSelectProps> = ({
    label, value, options, onChange, placeholder, name, required, disabled
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Filter options based on current input text
    const filteredOptions = options.filter(opt =>
        (opt || '').toLowerCase().includes((value || '').toLowerCase())
    );

    return (
        <div className="form-group" ref={containerRef} style={{ position: 'relative' }}>
            {label && <label className="form-label">{label}</label>}
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    name={name}
                    value={value}
                    onChange={(e) => {
                        if (!disabled) {
                            onChange(e.target.value);
                            setIsOpen(true);
                        }
                    }}
                    onFocus={() => !disabled && setIsOpen(true)}
                    onClick={() => !disabled && setIsOpen(true)}
                    className="form-input"
                    required={required}
                    placeholder={placeholder}
                    autoComplete="off"
                    disabled={disabled}
                    style={{
                        paddingRight: '30px',
                        cursor: disabled ? 'not-allowed' : 'text',
                        backgroundColor: disabled ? '#f8fafc' : 'white',
                        color: disabled ? '#64748b' : 'inherit',
                    }}
                />
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        cursor: 'pointer',
                        color: '#9ca3af',
                        fontSize: '0.7rem',
                        userSelect: 'none',
                        transition: 'transform 0.2s',
                        transform: `translateY(-50%) rotate(${isOpen ? '180deg' : '0deg'})`
                    }}
                >
                    ▼
                </div>
            </div>

            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1000,
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto'
                }}>
                    {options.length === 0 ? (
                        <div style={{ padding: '0.5rem 1rem', color: '#9ca3af', fontStyle: 'italic', fontSize: '0.875rem' }}>
                            Sin opciones encontradas
                        </div>
                    ) : (filteredOptions.length > 0 ? filteredOptions : options).map((opt) => (
                        <div
                            key={opt}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                            style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: '#374151',
                                borderBottom: '1px solid #f3f4f6',
                                backgroundColor: value === opt ? '#f3f4f6' : 'transparent'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value === opt ? '#f3f4f6' : 'transparent'}
                        >
                            {opt}
                        </div>
                    ))}
                    {filteredOptions.length === 0 && (
                        <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>
                            Presione Enter para usar "{value}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
