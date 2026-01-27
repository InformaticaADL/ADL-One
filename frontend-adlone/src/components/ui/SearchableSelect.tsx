import React, { useEffect, useState, useRef } from 'react';

export interface SearchableSelectProps {
    options: { id: string | number; nombre: string }[];
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    label?: string;
    onFocus?: () => void;
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options, value, onChange, placeholder, disabled, label, onFocus, loading, error, onRetry
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => String(o?.id || '') === String(value || ''));

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredOptions = options.filter(opt =>
        (opt.nombre || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="form-group" ref={wrapperRef} style={{ position: 'relative' }}>
            {label && (
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '4px', display: 'block' }}>
                    {label}
                    {loading && <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#6b7280' }}>⏳ Cargando...</span>}
                </label>
            )}
            <div
                className={`custom-select-trigger ${disabled ? 'disabled' : ''}`}
                onClick={() => {
                    if (!disabled && !loading) {
                        if (onFocus) {
                            const result = onFocus() as any;
                            if (result === false) return;
                        }
                        setIsOpen(!isOpen);
                    }
                }}
                style={{
                    padding: '6px 10px',
                    fontSize: '0.85rem',
                    border: error ? '1px solid #ef4444' : '1px solid #d1d5db',
                    borderRadius: '6px',
                    backgroundColor: disabled || loading ? '#f3f4f6' : 'white',
                    cursor: disabled || loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '34px',
                    height: '34px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden'
                }}
            >
                <span style={{
                    color: selectedOption ? '#111827' : '#9ca3af',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1, // Use flex 1 to take available space
                    marginRight: '8px', // Add space between text and icons
                    display: 'block'
                }}>
                    {loading ? 'Cargando...' : (selectedOption ? selectedOption.nombre : placeholder || 'Seleccione...')}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {selectedOption && !disabled && !loading && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange('');
                            }}
                            style={{
                                cursor: 'pointer',
                                color: '#9ca3af',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '2px', // Increase hit area slightly
                                borderRadius: '50%',
                            }}
                            title="Limpiar campo"
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.backgroundColor = '#e5e7eb'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </div>
                    )}
                    {loading ? (
                        <span style={{ fontSize: '0.7rem', color: '#6b7280', animation: 'spin 1s linear infinite' }}>⟳</span>
                    ) : (
                        <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>▼</span>
                    )}
                </div>
            </div>

            {error && (
                <div style={{
                    marginTop: '4px',
                    padding: '6px 8px',
                    fontSize: '0.75rem',
                    color: '#dc2626',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '4px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span>⚠️ {error}</span>
                    {onRetry && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onRetry();
                            }}
                            style={{
                                marginLeft: '8px',
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                backgroundColor: '#dc2626',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                        >
                            Reintentar
                        </button>
                    )}
                </div>
            )}

            {isOpen && !disabled && !loading && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    marginTop: '4px',
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    maxHeight: '200px',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ padding: '4px' }}>
                        <input
                            type="text"
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '4px 8px',
                                fontSize: '0.8rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '4px',
                                outline: 'none'
                            }}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((opt, index) => (
                                <div
                                    key={`${opt.id}-${index}`}
                                    onClick={() => {
                                        if (opt.id !== undefined && opt.id !== null) {
                                            onChange(String(opt.id));
                                        }
                                        setIsOpen(false);
                                        setSearchTerm('');
                                    }}
                                    style={{
                                        padding: '6px 10px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        backgroundColor: value === String(opt.id || '') ? '#f3f4f6' : 'transparent',
                                        color: '#374151'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = value === String(opt.id || '') ? '#f3f4f6' : 'transparent'}
                                >
                                    {opt.nombre}
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '8px', fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center' }}>
                                No se encontraron resultados
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
