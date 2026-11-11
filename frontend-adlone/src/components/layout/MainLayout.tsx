import { useEffect, useRef, useState } from 'react';
import { IconWifiOff, IconMenu2 } from '@tabler/icons-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavStore } from '../../store/navStore';
import { Sidebar } from './Sidebar';
import { NavigationProgress } from './NavigationProgress';
import { useTemaNeutro } from '../../hooks/useTemaNeutro';
import { RouteBreadcrumb } from './TopBar';
import { HelpCenter } from '../common/HelpCenter';

import logoAdl from '../../assets/images/logo-adlone.png';
import { useNotificationStore } from '../../store/notificationStore';
import { solicitudesClientesService } from '../../services/solicitudesClientes.service';
import { esNotificacionSolicitudCliente } from '../../features/notifications/utils/notificationNavigation';
import { useAuth } from '../../contexts/AuthContext';
import ContextualNotificationPanel from '../../features/notifications/components/ContextualNotificationPanel';
import { ScrollButtons } from '../common/ScrollButtons';
import { ursService } from '../../services/urs.service';

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    // Diseño del «shadcn-admin» (paleta neutra con el azul de ADL ONE) en todo el sistema.
    useTemaNeutro();
    // Mismo umbral que usaba el breakpoint 'lg' (1200px) de la versión Mantine:
    // por debajo, la navegación pasa a panel deslizante en vez de columna fija.
    const isCompact = useMediaQuery('(max-width: 1200px)');
    const isPhone = useMediaQuery('(max-width: 768px)');
    const {
        activeModule,
        activeSubmodule,
        fichasMode,
        sidebarCollapsed,
        resetNavigation,
        toggleSidebar,
        helpCenterOpen,
        setHelpCenterOpen,
    } = useNavStore();
    const [opened, setOpened] = useState(false);
    const close = () => setOpened(false);
    const toggle = () => setOpened((v) => !v);
    const viewportRef = useRef<HTMLDivElement>(null);
    // La cabecera gana sombra y desenfoque cuando el contenido ya se desplazó (como la de la plantilla).
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setScrolled(false);
    }, [activeModule, activeSubmodule]);

    // Ctrl/Cmd + B pliega y despliega el menú (atajo de la plantilla); no actúa mientras se escribe.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'b') return;
            const el = e.target as HTMLElement | null;
            if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
            e.preventDefault();
            toggleSidebar();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [toggleSidebar]);

    // Modules that manage their own internal scroll per column — bypass wrapper padding/overflow.
    // "Hoy en Vivo" needs this too: its map must fill the real available height, not a vh-minus-
    // magic-number guess that drifts whenever the header/alert bar height changes.
    // Listados que fijan encabezado y filtros arriba y scrollean solo la lista.
    // En teléfono NO se usa: esa cabecera se come casi toda la pantalla y deja
    // la lista en una franja de dos filas, así que ahí vuelve a scrollear la
    // página completa (las propias vistas hacen el mismo chequeo).
    const esListadoConScrollPropio =
        activeSubmodule === 'admin-muestreadores' ||
        activeSubmodule === 'admin-equipos-gestion' ||
        activeSubmodule === 'bm-consulta' ||
        // Fichas de Ingreso: Explorador, Asignación Terreno y el Planificador de
        // Rutas (mapa + selector de fichas, antes scrolleaba la página completa
        // en vez de quedar contenido en sus propios paneles). El resto de los
        // modos (menú, formularios, calendario, detalles y Muestreos
        // Completados) sigue scrolleando como página.
        (activeSubmodule === 'ma-fichas-ingreso' &&
            ['list_fichas', 'list_assign', 'route_planner_map'].includes(fichasMode));

    const isFullHeightModule =
        (!activeSubmodule && (activeModule === 'solicitudes' || activeModule === 'chat')) ||
        // El mapa sí necesita el alto real incluso en teléfono.
        activeSubmodule === 'ma-hoy-en-vivo' ||
        (esListadoConScrollPropio && !isPhone);

    // Pantallas propias de "Admin. Información" (su hub y la gestión interna).
    // Quedan tal cual: conservan el fundido corto que ya tenían. Ojo que Equipos
    // y Muestreadores cuelgan del mismo activeModule pero NO son parte de esta
    // gestión, por eso el filtro va por submódulo y no por módulo.
    const ADMIN_INFO_SCREENS = [
        '', 'informatica', 'medio_ambiente', 'gestion_calidad',
        'admin-roles', 'admin-users', 'admin-notifications', 'admin-urs',
        'admin-menu-web', 'admin-maestros', 'admin-revision-duplicados',
        'gc-dashboard-equipos',
    ];
    const esAdminInfo =
        activeModule === 'admin_informacion' && ADMIN_INFO_SCREENS.includes(activeSubmodule || '');

    // Auto-close sidebar on compact view when navigating (only on terminal submodule
    // selection). Dispatches the same event the "external navigation" listener below
    // already handles, instead of calling setState directly from this effect.
    useEffect(() => {
        if (isCompact && activeSubmodule) {
            window.dispatchEvent(new CustomEvent('close-mobile-sidebar'));
        }
    }, [activeSubmodule, isCompact]);

    // Listener global para cerrar el sidebar móvil desde otros componentes (ej. al hacer click en una notificación)
    useEffect(() => {
        const handleCloseMobile = () => close();
        window.addEventListener('close-mobile-sidebar', handleCloseMobile);
        return () => window.removeEventListener('close-mobile-sidebar', handleCloseMobile);
    }, []);

    // Global Notifications listener (Toast logic)
    const { user, token } = useAuth();
    const { fetchNotifications, initSocket, disconnectSocket, socketStatus } = useNotificationStore();
    const { setUrsUnreadCount, setSolicitudesClientePendientes } = useNavStore();

    // Socket Initialization + global counters fetch
    useEffect(() => {
        if (user?.id && token) {
            initSocket(user.id, token);
            fetchNotifications();
            ursService.getUnreadCount().then(setUrsUnreadCount).catch(() => {});
        }

        return () => {
            disconnectSocket();
        };
    }, [user?.id, token, initSocket, disconnectSocket, fetchNotifications, setUrsUnreadCount]);

    // Contador de "Solicitudes de clientes": las que siguen pendientes de atender (no las que alguien solo abrió).
    // Se recalcula al iniciar, cada 30 s y apenas llega un aviso nuevo de una solicitud (socket).
    const firmaAvisosSolicitudes = useNotificationStore((s) => s.notifications
        .filter((n) => esNotificacionSolicitudCliente(n)).map((n) => n.id_notificacion).join(','));
    useEffect(() => {
        if (!user?.id) return;
        const actualizar = () => { solicitudesClientesService.pendientes().then(setSolicitudesClientePendientes).catch(() => {}); };
        actualizar();
        const t = setInterval(() => { if (!document.hidden) actualizar(); }, 30000);
        return () => clearInterval(t);
    }, [user?.id, firmaAvisosSolicitudes, setSolicitudesClientePendientes]);

    // Medidas de la plantilla: 16 rem abierto y 4 rem contraído (3 rem del riel + el margen del diseño «inset»).
    const siderWidth = sidebarCollapsed ? 64 : 256;

    return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--sc-sidebar)' }}>
            <NavigationProgress />
            {isCompact ? (
                <div
                    style={{
                        height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 16px', backgroundColor: 'var(--app-glass-bg)', backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid var(--app-border)',
                        position: 'relative', zIndex: 210,
                    }}
                >
                    <button
                        onClick={toggle}
                        aria-label={opened ? 'Cerrar menú' : 'Abrir menú'}
                        style={{ border: 'none', background: 'transparent', padding: 6, borderRadius: 8, cursor: 'pointer', display: 'flex', color: 'var(--app-text)' }}
                    >
                        <IconMenu2 size={22} />
                    </button>
                    <img
                        src={logoAdl}
                        alt="ADL"
                        style={{ height: 36, width: 'auto', objectFit: 'contain', cursor: 'pointer' }}
                        onClick={() => { resetNavigation(); close(); }}
                    />
                    {/* La campana y el toggle de tema ya viven en la barra de
                        ruta (RouteBreadcrumb), que también se muestra en móvil:
                        tenerlos acá al lado del logo los duplicaba. Queda un
                        espaciador del ancho del botón de menú para que el logo
                        siga centrado. */}
                    <div style={{ width: 34, flexShrink: 0 }} aria-hidden />
                </div>
            ) : null}

            {/* Fila principal: sidebar + contenido lado a lado. Un <div> flex explícito
                en vez de <Layout> de antd, que solo pone sus hijos en fila cuando
                detecta un <Layout.Sider> real entre ellos — con un <div> normal
                (necesario por el desplazamiento propio del panel móvil) los apilaba
                verticalmente. */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'row', background: 'var(--sc-sidebar)' }}>
                {/* Escritorio: columna fija que empuja el contenido. Móvil: panel
                    superpuesto que desliza sobre el contenido (no reserva ancho). */}
                <div
                    style={
                        isCompact
                            ? {
                                position: 'fixed', top: 60, bottom: 0, left: 0, zIndex: 220, width: 288,
                                transform: opened ? 'translateX(0)' : 'translateX(-100%)',
                                transition: 'transform 250ms ease',
                                backgroundColor: 'var(--app-glass-bg-strong)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                borderRight: '1px solid var(--app-border)',
                            }
                            : {
                                width: siderWidth, flexShrink: 0, transition: 'width 200ms linear', padding: 8,
                            }
                    }
                >
                    <Sidebar
                        forceNotCollapsed={isCompact}
                        onNavigate={close}
                        onHelpClick={() => setHelpCenterOpen(true, true)}
                    />
                </div>

                {isCompact && opened && (
                    <div onClick={close} style={{ position: 'fixed', inset: '60px 0 0 0', zIndex: 215, background: 'transparent' }} />
                )}

                <div
                    className="@container/content"
                    style={{
                        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--sc-background)',
                        // Diseño «inset» de la plantilla: el contenido es una tarjeta con esquinas redondeadas sobre el fondo del menú.
                        ...(isCompact ? { height: '100%' } : { alignSelf: 'stretch', margin: '8px 8px 8px 0', borderRadius: 12, boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }),
                    }}
                >
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        <RouteBreadcrumb scrolled={scrolled} />
                        {activeModule && (
                            <ContextualNotificationPanel area={activeModule.toUpperCase()} />
                        )}
                        {/* X-10: aviso de conexión Socket.IO perdida */}
                        {socketStatus === 'disconnected' && (
                            <div className="shadcn-scope flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-foreground">
                                <IconWifiOff size={16} className="shrink-0 text-warning" />
                                Sin conexión en tiempo real — intentando reconectar. Las notificaciones nuevas pueden tardar en llegar.
                            </div>
                        )}
                        <div
                            key={`${activeModule}-${activeSubmodule}`}
                            ref={viewportRef}
                            onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 10)}
                            // El resto de las secciones —Equipos, Muestreadores, fichas,
                            // GEM, Facturación…— entra con el mismo despliegue que usan
                            // los formularios, en vez del fundido corto.
                            className={esAdminInfo ? 'animate-in fade-in-0 duration-200' : 'adl-unfold'}
                            style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                minHeight: 0,
                                overflowY: isFullHeightModule ? 'hidden' : 'auto',
                                padding: isFullHeightModule ? 0 : (isCompact ? 8 : 16),
                                paddingBottom: 0,
                            }}
                        >
                            {children}
                        </div>
                        <ScrollButtons viewportRef={viewportRef} />

                        <HelpCenter opened={helpCenterOpen} onClose={() => setHelpCenterOpen(false)} />
                    </div>
                </div>
            </div>
        </div>
    );
};
