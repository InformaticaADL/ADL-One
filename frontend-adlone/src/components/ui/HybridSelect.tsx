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
    strict?: boolean;
    style?: React.CSSProperties;
}

/**
 * A hybrid component that acts as both a text input and a custom dropdown.
 * Mimics the aesthetic of a standard custom select.
 * If 'strict' is true, it only allows selection from the list (input is readOnly).
 */
export const HybridSelect: React.FC<HybridSelectProps> = ({
    label, value, options, onChange, placeholder, name, required, disabled, strict, style
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clear search term when closing
    useEffect(() => {
        if (!isOpen) setSearchTerm('');
    }, [isOpen]);

    // Focus search input when opening in strict mode
    useEffect(() => {
        if (isOpen && strict && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, strict]);

    // Filter options based on:
    // 1. searchTerm (if strict)
    // 2. value (if not strict)
    const filteredOptions = options.filter(opt => {
        const query = strict ? searchTerm : value;
        return (opt || '').toLowerCase().includes((query || '').toLowerCase());
    });

    return (
        <div className="form-group" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
            {label && <label className="form-label">{label}</label>}
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    name={name}
                    value={value}
                    onChange={(e) => {
                        if (!disabled && !strict) {
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
                    readOnly={strict}
                    style={{
                        paddingRight: '30px',
                        cursor: disabled ? 'not-allowed' : (strict ? 'pointer' : 'text'),
                        backgroundColor: disabled ? '#f8fafc' : 'white',
                        color: disabled ? '#64748b' : 'inherit',
                        userSelect: strict ? 'none' : 'auto',
                        ...style
                    }}
                />
                <div
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        cursor: disabled ? 'not-allowed' : 'pointer',
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
                    maxHeight: '300px',
                    overflowY: 'auto',
                    padding: strict ? '8px' : '0'
                }}>
                    {strict && (
                        <div style={{ position: 'sticky', top: 0, background: 'white', paddingBottom: '8px', marginBottom: '4px', borderBottom: '1px solid #f3f4f6' }}>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="form-input"
                                placeholder="Buscar..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                style={{ fontSize: '0.85rem', padding: '6px 10px', height: 'auto' }}
                            />
                        </div>
                    )}

                    {filteredOptions.length === 0 ? (
                        <div style={{ padding: '0.5rem 1rem', color: '#9ca3af', fontStyle: 'italic', fontSize: '0.875rem' }}>
                            Sin opciones encontradas
                        </div>
                    ) : (
                        filteredOptions.map((opt) => (
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
                                    borderRadius: '4px',
                                    backgroundColor: value === opt ? '#eff6ff' : 'transparent',
                                    borderBottom: strict ? 'none' : '1px solid #f3f4f6',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = value === opt ? '#eff6ff' : '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value === opt ? '#eff6ff' : 'transparent'}
                                title={opt}
                            >
                                {opt}
                            </div>
                        ))
                    )}

                    {!strict && filteredOptions.length === 0 && value.trim() !== '' && (
                        <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>
                            Presione Enter para usar "{value}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
