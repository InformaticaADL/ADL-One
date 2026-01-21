import React, { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import type { Toast as ToastType } from '../../contexts/ToastContext';
import './Toast.css';

const Toast: React.FC<{ toast: ToastType }> = ({ toast }) => {
    const { removeToast } = useToast();
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (!toast.duration) return;

        const interval = setInterval(() => {
            setProgress(prev => {
                const newProgress = prev - (100 / (toast.duration! / 50));
                return newProgress < 0 ? 0 : newProgress;
            });
        }, 50);

        return () => clearInterval(interval);
    }, [toast.duration]);

    const getIcon = () => {
        switch (toast.type) {
            case 'success': return '✓';
            case 'error': return '✕';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return 'ℹ️';
        }
    };

    return (
        <div className={`toast toast-${toast.type}`}>
            <div className="toast-content">
                <span className="toast-icon">{getIcon()}</span>
                <span className="toast-message">{toast.message}</span>
                <button
                    className="toast-close"
                    onClick={() => removeToast(toast.id)}
                    aria-label="Cerrar"
                >
                    ✕
                </button>
            </div>
            {toast.duration && (
                <div className="toast-progress">
                    <div
                        className="toast-progress-bar"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export const ToastContainer: React.FC = () => {
    const { toasts } = useToast();

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <Toast key={toast.id} toast={toast} />
            ))}
        </div>
    );
};
