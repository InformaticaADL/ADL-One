import { useEffect } from 'react';
import { useNotificationStore } from '../../../store/notificationStore';
import { useToast } from '../../../contexts/ToastContext';

// Muestra un aviso emergente cuando llega, en vivo, una solicitud de un cliente del portal (o una respuesta suya).
export const AvisoSolicitudesCliente = () => {
    const aviso = useNotificationStore((s) => s.avisoSolicitudCliente);
    const limpiar = useNotificationStore((s) => s.limpiarAvisoSolicitudCliente);
    const { showToast } = useToast();

    useEffect(() => {
        if (!aviso) return;
        showToast({ type: 'info', message: `${aviso.titulo}: ${aviso.mensaje}`, duration: 8000 });
        limpiar();
    }, [aviso, limpiar, showToast]);

    return null;
};
