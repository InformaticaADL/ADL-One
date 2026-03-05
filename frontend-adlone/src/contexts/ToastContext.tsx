import React, { createContext, useContext, useState, useCallback } from 'react';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

interface ToastContextType {
    toasts: Toast[];
    showToast: (toast: Omit<Toast, 'id'> & { id?: string }) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timeouts = React.useRef<Map<string, any>>(new Map());

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
        if (timeouts.current.has(id)) {
            clearTimeout(timeouts.current.get(id));
            timeouts.current.delete(id);
        }
    }, []);

    const showToast = useCallback((toast: Omit<Toast, 'id'> & { id?: string }) => {
        const id = toast.id || `toast-${Date.now()}-${Math.random()}`;
        const duration = toast.duration || 4000;

        const newToast: Toast = {
            ...toast,
            id,
            duration
        };

        // Clear existing timeout for this ID if it exists
        if (timeouts.current.has(id)) {
            clearTimeout(timeouts.current.get(id));
        }

        setToasts(prev => {
            const filtered = prev.filter(t => t.id !== id);
            return [...filtered, newToast];
        });

        // Set new auto-dismiss timeout
        const timeout = setTimeout(() => {
            removeToast(id);
        }, duration);

        timeouts.current.set(id, timeout);
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
};
