import { type Notification } from '../../../store/notificationStore';

interface NavActions {
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setPendingRequestId: (id: number | null) => void;
    setPendingChatId: (id: number | null) => void;
    setPendingSolicitudClienteId: (id: number | null) => void;
    setSelectedRequestId: (id: number | null) => void;
    setFichasMode: (mode: 'list_ejecutados' | 'list_fichas') => void;
    hasPermission: (permission: string | string[]) => boolean;
    showToast: (toast: { type: 'error' | 'info' | 'success' | 'warning'; message: string }) => void;
}

// Permisos que habilitan ver el detalle de una ficha (mismos que FichasIngresoPage usa para 'list_fichas')
const FICHA_DETALLE_PERMS = ['FI_CONSULTAR', 'FI_VER', 'FI_APROBAR_TEC', 'FI_RECHAZAR_TEC', 'FI_APROBAR_COO', 'FI_RECHAZAR_COO', 'FI_EDITAR'];
// Permisos que habilitan ver el listado de Muestreos Ejecutados (mismos que FichasIngresoPage usa para 'list_ejecutados')
const FICHA_EJECUTADOS_PERMS = ['MA_COMERCIAL_HISTORIAL_ACCESO', 'FI_EXP_MC'];

// Avisos de solicitudes de clientes del portal (los crea WebClientesV2). Llevan el id de la solicitud del portal, que NO es
// el de una solicitud interna (URS): abrirlas en la bandeja interna da "Solicitud no encontrada".
export const esNotificacionSolicitudCliente = (n: { tipo?: unknown; titulo?: string | null }) =>
    String(n.tipo) === 'solicitud_cliente' ||
    ['nueva solicitud de cliente', 'el cliente respondió'].includes((n.titulo || '').trim().toLowerCase());

// Avisos de vencimiento de equipos (scheduler del backend, 30 y 7 días antes):
// no traen id_referencia y llevan al Calendario de Vencimientos de Calidad.
export const AREA_VENCIMIENTOS_EQUIPOS = 'Vencimientos de equipos';
const CALENDARIO_PERMS = ['GC_ACCESO', 'GC_EQUIPOS', 'MA_A_GEST_EQUIPO'];

export const abrirCalendarioVencimientos = (actions: Pick<NavActions, 'setActiveModule' | 'setActiveSubmodule' | 'hasPermission' | 'showToast'>) => {
    if (!actions.hasPermission(CALENDARIO_PERMS)) {
        actions.showToast({ type: 'error', message: 'No tienes permiso para ver el Calendario de Vencimientos.' });
        return;
    }
    actions.setActiveModule('admin_informacion');
    actions.setActiveSubmodule('gc-calendario-vencimientos');
};

// Avisos que hablan de una ficha o de una visita. Se reconocen por el título («Rechazo Coordinación: #1081», «Muestreo Asignado: #1057»…) o por
// el texto («La ficha #1081 …»); el área suele venir vacía, así que no se puede depender de ella. «Reasignación» y similares también son de fichas.
const TITULO_DE_FICHA = /^(nueva ficha|ficha\b|visita\b|aprobaci[oó]n (t[eé]cnica|coordinaci[oó]n)|rechazo (t[eé]cnico|t[eé]cnica|coordinaci[oó]n)|muestreo (asignado|cancelado|reprogramado|reagendado|reasignado)|reasignaci[oó]n|cambio de fecha|cambio integral|informe completo|ciclo finalizado|cancelaci[oó]n de muestreo)/i;
const TEXTO_DE_FICHA = /\b(ficha|visita)\s*(n[°º.]?\s*)?#?\s*\d+/i;

/** Id de la ficha a abrir: el que trae el aviso o, en los avisos antiguos que quedaron sin él, el número que aparece en el texto («#1081»). */
export const idFichaDeAviso = (n: { id_referencia?: number | null; titulo?: string | null; mensaje?: string | null }): number | null => {
    if (n.id_referencia) return Number(n.id_referencia);
    const m = `${n.titulo || ''} ${n.mensaje || ''}`.match(/#\s*(\d{1,9})\b/);
    return m ? Number(m[1]) : null;
};

export const esAvisoDeFicha = (n: { titulo?: string | null; mensaje?: string | null }) =>
    TITULO_DE_FICHA.test((n.titulo || '').trim()) || TEXTO_DE_FICHA.test(`${n.titulo || ''} ${n.mensaje || ''}`);

export const handleNotificationNavigation = (notif: Notification, actions: NavActions) => {
    const {
        setActiveModule,
        setActiveSubmodule,
        setPendingRequestId,
        setPendingChatId,
        setPendingSolicitudClienteId,
        setSelectedRequestId,
        setFichasMode,
        hasPermission,
        showToast
    } = actions;

    if (notif.area === AREA_VENCIMIENTOS_EQUIPOS) {
        abrirCalendarioVencimientos(actions);
        return;
    }

    const titulo = (notif.titulo || '').toLowerCase();
    const area = (notif.area || '').toLowerCase();

    // Chat
    if (area === 'chat' || area === 'mensajería') {
        if (notif.id_referencia) setPendingChatId(notif.id_referencia);
        setActiveModule('chat');
        setActiveSubmodule('');
        return;
    }

    // Solicitudes de clientes del portal
    if (notif.id_referencia && esNotificacionSolicitudCliente(notif)) {
        setPendingSolicitudClienteId(notif.id_referencia);
        setActiveModule('solicitudes-clientes');
        setActiveSubmodule('');
        return;
    }

    // Muestreo Completado: lleva al listado de Muestreos Ejecutados, no al detalle de la ficha
    if (titulo.includes('muestreo completado')) {
        if (!hasPermission(FICHA_EJECUTADOS_PERMS)) {
            showToast({ type: 'error', message: 'No tienes permiso para ver el listado de Muestreos Ejecutados.' });
            return;
        }
        setActiveModule('medio-ambiente');
        setActiveSubmodule('ma-fichas-ingreso');
        setFichasMode('list_ejecutados');
        return;
    }

    // Fichas y visitas: se abre la visita (si la ficha es un punto de una visita, la pantalla de la ficha muestra toda la visita)
    // Va ANTES que solicitudes: títulos como «Reasignación» o «Muestreo Asignado» contienen palabras que antes las mandaban a la bandeja equivocada.
    if (esAvisoDeFicha(notif) && !titulo.includes('consulta')) {
        if (!hasPermission(FICHA_DETALLE_PERMS)) {
            showToast({ type: 'error', message: 'No tienes permiso para ver el detalle de esta ficha.' });
            return;
        }
        const idFicha = idFichaDeAviso(notif);
        setActiveModule('medio-ambiente');
        setActiveSubmodule('ma-fichas-ingreso');
        if (idFicha) setPendingRequestId(idFicha);
        else setFichasMode('list_fichas');
        return;
    }

    if (!notif.id_referencia) return;

    // Solicitudes (bandeja universal)
    setSelectedRequestId(notif.id_referencia);
    setActiveModule('solicitudes');
    setActiveSubmodule('');
};
