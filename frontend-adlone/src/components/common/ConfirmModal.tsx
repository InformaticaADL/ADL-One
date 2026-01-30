import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    confirmColor = '#ef4444',
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onCancel}
        >
            <div
                style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    maxWidth: '450px',
                    width: '90%',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
                    animation: 'slideUp 0.3s ease-out'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                    <div
                        style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%',
                            backgroundColor: '#fee2e2',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#dc2626"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', margin: 0 }}>
                        {title}
                    </h3>
                </div>

                {/* Message */}
                <p style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                    {message}
                </p>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: '1px solid #d1d5db',
                            backgroundColor: 'white',
                            color: '#374151',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f9fafb';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'white';
                        }}
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: confirmColor,
                            color: 'white',
                            fontSize: '0.9rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }

                @keyframes slideUp {
                    from {
                        transform: translateY(20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }
            `}</style>
        </div>
    );
};
