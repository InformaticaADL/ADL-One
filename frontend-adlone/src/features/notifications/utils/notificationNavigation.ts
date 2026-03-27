import { type Notification } from '../../../store/notificationStore';

interface NavActions {
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setPendingRequestId: (id: number | null) => void;
    setPendingChatId: (id: number | null) => void;
    setSelectedRequestId: (id: number | null) => void;
}

export const handleNotificationNavigation = (notif: Notification, actions: NavActions) => {
    const { 
        setActiveModule, 
        setActiveSubmodule, 
        setPendingRequestId, 
        setPendingChatId, 
        setSelectedRequestId 
    } = actions;

    if (!notif.id_referencia) {
        if (notif.area === 'Chat') {
            setActiveModule('chat');
            setActiveSubmodule('');
        }
        return;
    }

    const titulo = (notif.titulo || '').toLowerCase();
    const mensaje = (notif.mensaje || '').toLowerCase();
    const area = (notif.area || '').toLowerCase();

    // 1. Solicitudes (Universal Inbox)
    const isRequest = 
        titulo.includes('solicitud') || titulo.includes('estado') ||
        titulo.includes('derivación') || titulo.includes('derivacion') ||
        titulo.includes('baja') || titulo.includes('traspaso') ||
        titulo.includes('asignación') || titulo.includes('equipo') ||
        titulo.includes('activación') || titulo.includes('comentario') ||
        titulo.includes('mensaje en #') || titulo.includes('nuevo mensaje') ||
        area === 'urs' || area === 'solicitudes' ||
        area === 'gestión de calidad' || area === 'gestion de calidad';

    if (isRequest) {
        setSelectedRequestId(notif.id_referencia);
        setActiveModule('solicitudes');
        setActiveSubmodule('');
        return;
    }

    // 2. Chat
    const isChat = area === 'chat' || titulo.includes('grupo') || area === 'mensajería';
    if (isChat) {
        setPendingChatId(notif.id_referencia);
        setActiveModule('chat');
        setActiveSubmodule('');
        return;
    }

    // 3. Medio Ambiente (Fichas de Ingreso)
    const isFicha = 
        titulo.includes('ficha') || mensaje.includes('ficha') || 
        titulo.includes('programación') || mensaje.includes('muestreo') ||
        area === 'medio ambiente' || area === 'medio_ambiente' || area === 'fichas';

    if (isFicha) {
        setPendingRequestId(notif.id_referencia);
        setActiveModule('medio_ambiente');
        setActiveSubmodule('ma-fichas-ingreso');
        return;
    }

    // Fallback: Default to solicitudes if reference exists but type is unknown
    setSelectedRequestId(notif.id_referencia);
    setActiveModule('solicitudes');
    setActiveSubmodule('');
};
