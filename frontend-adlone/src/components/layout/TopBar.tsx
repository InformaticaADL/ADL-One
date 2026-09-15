import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    IconBell,
    IconHome,
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

interface CompactProp {
    compact?: boolean;
}

const STATIC_MODULE_LABELS: Record<string, string> = {
    '': 'Inicio',
    perfil: 'Mi Perfil',
    notificaciones: 'Notificaciones',
};

// Campana de notificaciones — vive en el header del Sidebar (desktop) y en
// el header compacto de móvil (MainLayout), por eso está en su propio
// componente reutilizable en vez de duplicar el JSX en los dos lugares.
export function NotificationBell({ compact }: CompactProp) {
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
        <div ref={notificationsRef} className="relative">
            <NotificationPopover opened={notifOpen} onClose={() => setNotifOpen(false)}>
                <button
                    title="Notificaciones"
                    onClick={() => { setNotifOpen((v) => !v); setShowBubble(false); }}
                    className={cn(
                        'flex items-center justify-center rounded-lg transition-colors',
                        compact ? 'h-[38px] w-[38px]' : 'h-8 w-8',
                        notifOpen ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                    )}
                >
                    <span className="relative inline-flex">
                        <IconBell size={compact ? 19 : 17} stroke={1.75} />
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
    );
}

// Toggle de tema claro/oscuro — vive a la derecha de la ruta (RouteBreadcrumb)
// y en el header compacto de móvil.
export function ThemeToggle({ compact }: CompactProp) {
    const { mode, toggleMode } = useThemeStore();

    if (compact) {
        return (
            <button
                onClick={toggleMode}
                aria-label="Cambiar tema"
                title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-lg text-foreground hover:bg-muted"
            >
                {mode === 'dark' ? <IconMoon size={19} stroke={1.75} /> : <IconSun size={19} stroke={1.75} />}
            </button>
        );
    }

    return (
        <div className="flex items-center" title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
            <Switch checked={mode === 'dark'} onCheckedChange={toggleMode} />
        </div>
    );
}

// Agrupa campana + tema para el header compacto de móvil (MainLayout), que
// no tiene una franja de ruta separada donde poner el toggle de tema.
export function UserActionsCluster({ compact }: CompactProp) {
    return (
        <div className="flex items-center gap-1">
            <NotificationBell compact={compact} />
            <ThemeToggle compact={compact} />
        </div>
    );
}

// Resuelve el label de un módulo/submódulo activo para la ruta que se
// muestra arriba del contenido — primero en los módulos fijos y dinámicos
// del Sidebar, con un mapa estático de respaldo para vistas que no viven en
// el menú (perfil, notificaciones).
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

// Ruta actual a la izquierda, campana + toggle de tema a la derecha —
// funciona como el "navbar" de la app, chico y solo sobre la columna de
// contenido (no una barra global sobre sidebar+contenido). shadcn-scope es
// necesario acá: sin él el botón "Inicio" no recibe el reset de botones
// (bg/border/padding nativos del navegador) y se ve encuadrado.
export function RouteBreadcrumb() {
    const { resetNavigation } = useNavStore();
    const { moduleLabel, submoduleLabel } = useBreadcrumbLabels();

    return (
        <div className="shadcn-scope flex h-16 shrink-0 items-center justify-between gap-2 px-4 md:px-6">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                <button type="button" onClick={() => resetNavigation()} className="flex shrink-0 items-center gap-1.5 hover:text-foreground">
                    <IconHome size={15} />
                    <span>Inicio</span>
                </button>
                <span className="shrink-0 text-border">/</span>
                <span className="truncate font-medium text-foreground">{moduleLabel || 'Inicio'}</span>
                {submoduleLabel && (
                    <>
                        <span className="shrink-0 text-border">/</span>
                        <span className="truncate">{submoduleLabel}</span>
                    </>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <NotificationBell />
                <ThemeToggle />
            </div>
        </div>
    );
}
