import { type Notification } from '../../../store/notificationStore';

interface NavActions {
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setPendingRequestId: (id: number | null) => void;
    setPendingChatId: (id: number | null) => void;
    setSelectedRequestId: (id: number | null) => void;
    setFichasMode: (mode: 'list_ejecutados') => void;
    hasPermission: (permission: string | string[]) => boolean;
    showToast: (toast: { type: 'error' | 'info' | 'success' | 'warning'; message: string }) => void;
}

// Permisos que habilitan ver el detalle de una ficha (mismos que FichasIngresoPage usa para 'list_fichas')
const FICHA_DETALLE_PERMS = ['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR'];
// Permisos que habilitan ver el listado de Muestreos Ejecutados (mismos que FichasIngresoPage usa para 'list_ejecutados')
const FICHA_EJECUTADOS_PERMS = ['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC'];

export const handleNotificationNavigation = (notif: Notification, actions: NavActions) => {
    const {
        setActiveModule,
        setActiveSubmodule,
        setPendingRequestId,
        setPendingChatId,
        setSelectedRequestId,
        setFichasMode,
        hasPermission,
        showToast
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

    // 1. Chat — check FIRST to prevent mis-routing (chat notifications can have titles
    //    like "nuevo mensaje" that would otherwise match the solicitudes check below)
    const isChat = area === 'chat' || area === 'mensajería';
    if (isChat) {
        setPendingChatId(notif.id_referencia);
        setActiveModule('chat');
        setActiveSubmodule('');
        return;
    }

    // 2. Solicitudes (Universal Inbox)
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

    // 3. Muestreo Completado: lleva al listado de Muestreos Ejecutados, no al detalle de la ficha
    if (titulo.includes('muestreo completado')) {
        if (!hasPermission(FICHA_EJECUTADOS_PERMS)) {
            showToast({ type: 'error', message: 'No tienes permiso para ver el listado de Muestreos Ejecutados.' });
            return;
        }
        setActiveModule('medio_ambiente');
        setActiveSubmodule('ma-fichas-ingreso');
        setFichasMode('list_ejecutados');
        return;
    }

    // 4. Medio Ambiente (Fichas de Ingreso)
    const isFicha =
        titulo.includes('ficha') || mensaje.includes('ficha') ||
        titulo.includes('programación') || mensaje.includes('muestreo') ||
        area === 'medio ambiente' || area === 'medio_ambiente' || area === 'fichas';

    if (isFicha) {
        if (!hasPermission(FICHA_DETALLE_PERMS)) {
            showToast({ type: 'error', message: 'No tienes permiso para ver el detalle de esta ficha.' });
            return;
        }
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
