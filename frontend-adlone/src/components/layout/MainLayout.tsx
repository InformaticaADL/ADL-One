import { useEffect, useRef, useState } from 'react';
import { IconWifiOff, IconMenu2 } from '@tabler/icons-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavStore } from '../../store/navStore';
import { Sidebar } from './Sidebar';
import { RouteBreadcrumb, UserActionsCluster } from './TopBar';
import { HelpCenter } from '../common/HelpCenter';

import logoAdl from '../../assets/images/logo-adlone.png';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuth } from '../../contexts/AuthContext';
import ContextualNotificationPanel from '../../features/notifications/components/ContextualNotificationPanel';
import { ScrollButtons } from '../common/ScrollButtons';
import { ursService } from '../../services/urs.service';

interface MainLayoutProps {
    children?: React.ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
    // Mismo umbral que usaba el breakpoint 'lg' (1200px) de la versión Mantine:
    // por debajo, la navegación pasa a panel deslizante en vez de columna fija.
    const isCompact = useMediaQuery('(max-width: 1200px)');
    const {
        activeModule,
        activeSubmodule,
        sidebarCollapsed,
        resetNavigation,
        helpCenterOpen,
        setHelpCenterOpen,
    } = useNavStore();
    const [opened, setOpened] = useState(false);
    const close = () => setOpened(false);
    const toggle = () => setOpened((v) => !v);
    const viewportRef = useRef<HTMLDivElement>(null);

    // Modules that manage their own internal scroll per column — bypass wrapper padding/overflow.
    // "Hoy en Vivo" needs this too: its map must fill the real available height, not a vh-minus-
    // magic-number guess that drifts whenever the header/alert bar height changes.
    const isFullHeightModule =
        (!activeSubmodule && (activeModule === 'solicitudes' || activeModule === 'chat')) ||
        activeSubmodule === 'ma-hoy-en-vivo';

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
    const { setUrsUnreadCount } = useNavStore();

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

    const siderWidth = sidebarCollapsed ? 80 : 240;

    return (
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)' }}>
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
                    <UserActionsCluster compact />
                </div>
            ) : null}

            {/* Fila principal: sidebar + contenido lado a lado. Un <div> flex explícito
                en vez de <Layout> de antd, que solo pone sus hijos en fila cuando
                detecta un <Layout.Sider> real entre ellos — con un <div> normal
                (necesario por el desplazamiento propio del panel móvil) los apilaba
                verticalmente. */}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'row', background: 'var(--app-bg)' }}>
                {/* Escritorio: columna fija que empuja el contenido. Móvil: panel
                    superpuesto que desliza sobre el contenido (no reserva ancho). */}
                <div
                    style={
                        isCompact
                            ? {
                                position: 'fixed', top: 60, bottom: 0, left: 0, zIndex: 220, width: 240,
                                transform: opened ? 'translateX(0)' : 'translateX(-100%)',
                                transition: 'transform 250ms ease',
                                backgroundColor: 'var(--app-glass-bg-strong)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
                                borderRight: '1px solid var(--app-border)',
                            }
                            : {
                                width: siderWidth, flexShrink: 0, transition: 'width 300ms ease',
                                borderRight: '1px solid var(--app-border)',
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

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--app-bg)' }}>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                        <RouteBreadcrumb />
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
                            className="animate-in fade-in-0 duration-200"
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
