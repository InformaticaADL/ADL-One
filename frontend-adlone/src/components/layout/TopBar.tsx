import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    IconBell,
    IconChevronRight,
    IconMoon,
    IconSun,
} from '@tabler/icons-react';
import { useNavStore } from '../../store/navStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';
import { NotificationPopover } from '../../features/notifications/components/NotificationPopover';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { FIXED_TOP_MODULES, type DynamicModule } from '../../config/sidebarModules';
import logoAdl from '../../assets/images/logo-adlone.png';
import logoSmall from '../../assets/images/logo-adlone-pequeño.png';

interface UserActionsClusterProps {
    compact?: boolean;
}

const STATIC_MODULE_LABELS: Record<string, string> = {
    '': 'Inicio',
    perfil: 'Mi Perfil',
    notificaciones: 'Notificaciones',
};

// Campana de notificaciones + toggle de tema — el bloque que antes también
// incluía el avatar/menú de usuario, ahora movido a la card de usuario al
// fondo del Sidebar. Se usa tanto en el TopBar de escritorio como en el
// header compacto de móvil (MainLayout), por eso vive en su propio
// componente reutilizable en vez de duplicar el JSX en los dos lugares.
export function UserActionsCluster({ compact }: UserActionsClusterProps) {
    const { mode, toggleMode } = useThemeStore();
    const { notifications } = useNotificationStore();
    const unreadCount = notifications.filter((n) => !n.leido).length;

    const [notifOpen, setNotifOpen] = useState(false);
    const [showBubble, setShowBubble] = useState(false);
    const [bubblePosition, setBubblePosition] = useState<{ top: number; left: number } | null>(null);
    const isFirstLoad = useRef(true);
    const prevUnreadCount = useRef(0);
    const notificationsRef = useRef<HTMLDivElement>(null);

    // Escudo temporal para suprimir la burbuja durante el arranque (hidratación asíncrona del store)
    useEffect(() => {
        const timer = setTimeout(() => { isFirstLoad.current = false; }, 5000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isFirstLoad.current) {
            prevUnreadCount.current = unreadCount;
            return;
        }
        if (unreadCount > prevUnreadCount.current && unreadCount > 0 && !notifOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setShowBubble(true);
            const timer = setTimeout(() => setShowBubble(false), 5000);
            return () => clearTimeout(timer);
        }
        prevUnreadCount.current = unreadCount;
    }, [unreadCount, notifOpen]);

    // Compute notification bubble position in layout phase to avoid reading ref during render
    useLayoutEffect(() => {
        if (showBubble && notificationsRef.current) {
            const rect = notificationsRef.current.getBoundingClientRect();
            setBubblePosition({
                top: rect.bottom + 8,
                left: rect.left - 80,
            });
        }
    }, [showBubble]);

    return (
        <div className="flex items-center gap-1">
            <div ref={notificationsRef} className="relative">
                <NotificationPopover opened={notifOpen} onClose={() => setNotifOpen(false)}>
                    <button
                        title="Notificaciones"
                        onClick={() => { setNotifOpen((v) => !v); setShowBubble(false); }}
                        className={cn(
                            'flex h-[38px] w-[38px] items-center justify-center rounded-lg transition-colors',
                            notifOpen ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                        )}
                    >
                        <span className="relative inline-flex">
                            <IconBell size={19} stroke={1.75} />
                            {unreadCount > 0 && (
                                <Badge variant="destructive" className="absolute -right-1.5 -top-1.5 h-4 min-w-4 justify-center rounded-full px-1 py-0 text-[10px] leading-none">
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Badge>
                            )}
                        </span>
                    </button>
                </NotificationPopover>

                {showBubble && !notifOpen && bubblePosition && createPortal(
                    <div
                        style={{ top: bubblePosition.top, left: bubblePosition.left }}
                        className="fixed z-[2200] whitespace-nowrap rounded-xl border border-border border-t-4 border-t-primary bg-card px-[18px] py-2.5 text-sm font-semibold text-foreground shadow-2xl"
                    >
                        {notifications[0]?.titulo || '¡Nueva notificación!'}
                    </div>,
                    document.body
                )}
            </div>

            {compact ? (
                <button
                    onClick={toggleMode}
                    aria-label="Cambiar tema"
                    title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
                    className="flex h-[38px] w-[38px] items-center justify-center rounded-lg text-foreground hover:bg-muted"
                >
                    {mode === 'dark' ? <IconMoon size={19} stroke={1.75} /> : <IconSun size={19} stroke={1.75} />}
                </button>
            ) : (
                <div className="mx-1 flex items-center" title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
                    <Switch checked={mode === 'dark'} onCheckedChange={toggleMode} />
                </div>
            )}
        </div>
    );
}

// Resuelve el label de un módulo/submódulo activo para la ruta del TopBar —
// primero en los módulos fijos y dinámicos del Sidebar, con un mapa estático
// de respaldo para vistas que no viven en el menú (perfil, notificaciones).
function useBreadcrumbLabels() {
    const { activeModule, activeSubmodule, dynamicModules: rawDynamicModules } = useNavStore();
    const dynamicModules = rawDynamicModules as unknown as DynamicModule[];

    return useMemo(() => {
        const dynMod = dynamicModules.find((m) => m.id === activeModule);
        const fixedMod = FIXED_TOP_MODULES.find((m) => m.id === activeModule);
        const moduleLabel = fixedMod?.label ?? dynMod?.label ?? STATIC_MODULE_LABELS[activeModule] ?? activeModule;

        let submoduleLabel: string | null = null;
        if (activeSubmodule) {
            const link = dynamicModules
                .flatMap((m) => m.links || [])
                .find((l) => l.id === activeSubmodule);
            submoduleLabel = link?.label ?? STATIC_MODULE_LABELS[activeSubmodule] ?? activeSubmodule;
        }

        return { moduleLabel, submoduleLabel };
    }, [activeModule, activeSubmodule, dynamicModules]);
}

// Barra global fija sobre sidebar+contenido, solo desktop (ver MainLayout —
// móvil extiende su propio header compacto con UserActionsCluster en vez de
// montar este componente). Logo + ruta actual a la izquierda +
// UserActionsCluster (notificaciones/tema) a la derecha. El buscador del
// menú vive en el Sidebar.
export function TopBar() {
    const { resetNavigation, sidebarCollapsed } = useNavStore();
    const { moduleLabel, submoduleLabel } = useBreadcrumbLabels();

    return (
        <div className="relative z-[210] flex h-[72px] shrink-0 items-center justify-between gap-5 border-b border-border bg-card px-6">
            <button
                type="button"
                onClick={() => resetNavigation()}
                className="flex min-w-0 items-center gap-3"
            >
                <img
                    src={sidebarCollapsed ? logoSmall : logoAdl}
                    alt="ADL"
                    className={cn('w-auto object-contain transition-all', sidebarCollapsed ? 'h-7' : 'h-8')}
                />
                <div className="h-6 w-px shrink-0 bg-border" />
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-muted-foreground">
                    <span className="truncate">{moduleLabel || 'Inicio'}</span>
                    {submoduleLabel && (
                        <>
                            <IconChevronRight size={14} className="shrink-0" />
                            <span className="truncate font-semibold text-foreground">{submoduleLabel}</span>
                        </>
                    )}
                </span>
            </button>

            <UserActionsCluster />
        </div>
    );
}
