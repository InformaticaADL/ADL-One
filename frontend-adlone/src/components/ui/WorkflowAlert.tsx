import React from 'react';

interface WorkflowAlertProps {
    type?: 'warning' | 'error' | 'info';
    title: string;
    message: string;
}

export const WorkflowAlert: React.FC<WorkflowAlertProps> = ({
    type = 'warning',
    title,
    message
}) => {
    const styles = {
        warning: {
            bg: '#fffbeb',
            border: '#fcd34d',
            text: '#92400e',
            iconColor: '#f59e0b'
        },
        error: {
            bg: '#fef2f2',
            border: '#fca5a5',
            text: '#991b1b',
            iconColor: '#ef4444'
        },
        info: {
            bg: '#eff6ff',
            border: '#93c5fd',
            text: '#1e40af',
            iconColor: '#3b82f6'
        }
    };

    const currentStyle = styles[type];

    return (
        <div style={{
            marginBottom: '1.5rem',
            padding: '0.875rem 1rem',
            backgroundColor: currentStyle.bg,
            border: `1px solid ${currentStyle.border}`,
            borderRadius: '8px',
            color: currentStyle.text,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            maxWidth: '100%'
        }}>
            {/* Icon */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                style={{
                    width: '20px',
                    height: '20px',
                    flexShrink: 0,
                    marginTop: '2px'
                }}
                fill="none"
                viewBox="0 0 24 24"
                stroke={currentStyle.iconColor}
                strokeWidth={2}
            >
                {type === 'warning' && (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                )}
                {type === 'error' && (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                )}
                {type === 'info' && (
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                )}
            </svg>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '0.9rem',
                    fontWeight: 600
                }}>
                    {title}
                </strong>
                <p style={{
                    margin: 0,
                    fontSize: '0.875rem',
                    lineHeight: '1.4'
                }}>
                    {message}
                </p>
            </div>
        </div>
    );
};
