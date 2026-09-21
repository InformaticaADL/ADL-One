import React, { createContext, useContext, useCallback } from 'react';
import { toast as sonnerToast } from 'sonner';

export interface Toast {
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
    duration?: number;
}

interface ToastContextType {
    showToast: (toast: Omit<Toast, 'id'> & { id?: string }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Mismo showToast({ type, message, duration? }) que usan ~65 componentes en
// toda la app — solo cambió qué hay detrás: antes un <div> + CSS a mano
// propios (src/components/Toast, ya eliminado), ahora sonner (la librería de
// toasts que usa shadcn/ui), renderizado por <Toaster /> en App.tsx.
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const showToast = useCallback((toast: Omit<Toast, 'id'> & { id?: string }) => {
        const options = { id: toast.id, duration: toast.duration || 4000 };
        switch (toast.type) {
            case 'success': sonnerToast.success(toast.message, options); break;
            case 'error': sonnerToast.error(toast.message, options); break;
            case 'warning': sonnerToast.warning(toast.message, options); break;
            default: sonnerToast.info(toast.message, options);
        }
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
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
