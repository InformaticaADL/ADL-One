import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    IconBell,
    IconHome,
    IconInfoCircle,
    IconMoon,
    IconSun,
} from '@tabler/icons-react';
import { PanelLeft } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useNavStore } from '../../store/navStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';
import { NotificationPopover } from '../../features/notifications/components/NotificationPopover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { playThemeTransition } from '@/lib/themeTransition';
import { FIXED_TOP_MODULES, type DynamicModule } from '../../config/sidebarModules';

interface CompactProp {
    compact?: boolean;
}

const STATIC_MODULE_LABELS: Record<string, string> = {
    '': 'Inicio',
    perfil: 'Configuración',
    notificaciones: 'Notificaciones',
    'bm-historico': 'Biología Molecular Histórico',
    'bm-consulta': 'Consulta de Muestras',
    // Gestión de Calidad: vistas que se abren desde su portada y no están en el menú lateral.
    gestion_calidad: 'Gestión de Calidad',
    'gc-dashboard-equipos': 'Dashboard de Equipos',
    'gc-calendario-vencimientos': 'Calendario de Vencimientos',
    'gc-archivo-fichas': 'Archivo de Fichas',
    'gc-verificacion-caudal': 'Verificación Caudal',
};

// Campana de notificaciones — vive en la barra de ruta (RouteBreadcrumb),
// tanto en escritorio como en móvil. La variante `compact` agranda el botón
// para dedo en pantallas chicas.
export function NotificationBell({ compact }: CompactProp) {
    const { notifications } = useNotificationStore();
    const unreadCount = notifications.filter((n) => !n.leido).length;

    const [notifOpen, setNotifOpen] = useState(false);
    const [showBubble, setShowBubble] = useState(false);
    const [bubblePosition, setBubblePosition] = useState<{ top: number; right: number } | null>(null);
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
            if (localStorage.getItem('adl-pref-aviso-emergente') !== 'no') setShowBubble(true);
            const timer = setTimeout(() => setShowBubble(false), 5000);
            return () => clearTimeout(timer);
        }
        prevUnreadCount.current = unreadCount;
    }, [unreadCount, notifOpen]);

    // Compute notification bubble position in layout phase to avoid reading ref during render
    useLayoutEffect(() => {
        if (showBubble && notificationsRef.current) {
            const rect = notificationsRef.current.getBoundingClientRect();
            // Alineada al borde derecho de la campana (que vive en el extremo derecho de la barra): así nunca se sale de la pantalla.
            setBubblePosition({
                top: rect.bottom + 8,
                right: Math.max(8, window.innerWidth - rect.right),
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
                        'relative flex items-center justify-center rounded-lg transition-colors',
                        compact ? 'h-11 w-11' : 'h-10 w-10',
                        notifOpen ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                    )}
                >
                    <IconBell size={compact ? 24 : 22} stroke={1.75} />
                    {unreadCount > 0 && (
                        // El contador va en la esquina del botón, con borde del color del fondo, para que no tape la campana.
                        <Badge variant="destructive" className="pointer-events-none absolute -right-2 -top-2 h-5 min-w-5 justify-center rounded-full border-2 border-background px-1.5 py-0 text-[11px] font-bold leading-none">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
                </button>
            </NotificationPopover>

            {showBubble && !notifOpen && bubblePosition && createPortal(
                <div
                    style={{ top: bubblePosition.top, right: bubblePosition.right }}
                    className="fixed z-[2200] w-max max-w-[min(320px,calc(100vw-16px))] rounded-xl border border-border border-t-4 border-t-primary bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-2xl"
                >
                    <p>{notifications[0]?.titulo || '¡Nueva notificación!'}</p>
                    {notifications[0]?.mensaje && (
                        <p className="mt-0.5 line-clamp-2 text-xs font-normal text-muted-foreground">{notifications[0].mensaje}</p>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}

// Información de la página: abre el centro de ayuda. Solo ícono, discreto, junto a la campana y el tema.
export function InfoButton({ compact }: CompactProp) {
    const { setHelpCenterOpen } = useNavStore();
    return (
        <button
            type="button"
            onClick={() => setHelpCenterOpen(true)}
            aria-label="Información de esta página"
            title="Información de esta página"
            className={cn(
                'flex items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted',
                compact ? 'h-[38px] w-[38px]' : 'h-8 w-8'
            )}
        >
            <IconInfoCircle size={compact ? 19 : 17} stroke={1.75} />
        </button>
    );
}

// Toggle de tema claro/oscuro — vive a la derecha de la ruta (RouteBreadcrumb).
export function ThemeToggle({ compact }: CompactProp) {
    const { mode, toggleMode } = useThemeStore();
    const size = compact ? 24 : 22;

    return (
        <button
            onClick={() => playThemeTransition(toggleMode)}
            aria-label="Cambiar tema"
            title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}
            className={cn(
                'relative flex items-center justify-center overflow-hidden rounded-lg text-foreground transition-colors hover:bg-muted',
                compact ? 'h-11 w-11' : 'h-10 w-10'
            )}
        >
            <IconSun
                size={size}
                stroke={1.75}
                className={cn(
                    'absolute transition-all duration-300',
                    mode === 'dark' ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'
                )}
            />
            <IconMoon
                size={size}
                stroke={1.75}
                className={cn(
                    'absolute transition-all duration-300',
                    mode === 'dark' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'
                )}
            />
        </button>
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
        if (activeSubmodule === 'bm-historico') {
            return {
                moduleLabel: 'Biología Molecular Histórico',
                submoduleLabel: null
            };
        }

        const dynMod = dynamicModules.find((m) => m.id === activeModule);
        const fixedMod = FIXED_TOP_MODULES.find((m) => m.id === activeModule);
        const moduleLabel = fixedMod?.label ?? dynMod?.label ?? STATIC_MODULE_LABELS[activeModule] ?? activeModule;

        let submoduleLabel: string | null = null;
        if (activeSubmodule) {
            const link = dynamicModules.flatMap((m) => m.links || [])
                .find((l) => l.id === activeSubmodule)
                // Módulos fijos con links (ej. Facturación) — mismo lookup, otra fuente.
                ?? FIXED_TOP_MODULES.flatMap((m) => m.links || []).find((l) => l.id === activeSubmodule);
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
export function RouteBreadcrumb({ scrolled }: { scrolled?: boolean }) {
    const { resetNavigation, pageBreadcrumb, toggleSidebar, activeSubmodule, setActiveSubmodule } = useNavStore();
    const { moduleLabel, submoduleLabel } = useBreadcrumbLabels();

    // Muchas páginas empiezan su propio breadcrumbItems con el nombre del módulo («Admin. Info», «Admin. Información»), que esta barra ya
    // muestra: sin esto salía duplicado («Inicio / Admin. Info / Admin. Info / Informática»). Si la página repite el módulo, se descarta
    // ese tramo y su onClick pasa al tramo del módulo, así «Admin. Info» es un enlace y vuelve a donde la página decía.
    const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    const primero = pageBreadcrumb[0];
    const repiteModulo = !!primero && !!moduleLabel && (() => {
        const a = normalizar(primero.label), b = normalizar(moduleLabel);
        return a === b || a.startsWith(b) || b.startsWith(a);
    })();
    const tramosDeLaPagina = repiteModulo ? pageBreadcrumb.slice(1) : pageBreadcrumb;
    // El módulo es un enlace cuando hay algo más abajo: lleva a la portada del módulo (la que ven al elegirlo, sin submódulo). Si la página
    // dio su propio onClick para el módulo, se usa ese.
    const alModulo = repiteModulo && primero?.onClick
        ? primero.onClick
        : (activeSubmodule ? () => setActiveSubmodule('') : undefined);
    const moduloEsEnlace = !!alModulo && (pageBreadcrumb.length > 0 || !!submoduleLabel);
    // En la portada la ruta es solo «Inicio» (no «Inicio / Inicio»).
    const enInicio = pageBreadcrumb.length === 0 && !submoduleLabel && (!moduleLabel || normalizar(moduleLabel) === 'inicio');
    // En celular esta barra es el único lugar con campana y tema (el header
    // del logo ya no los repite), así que van en tamaño táctil y la barra se
    // achica un poco para no comerse el alto útil del contenido.
    const isMobile = useMediaQuery('(max-width: 768px)');

    return (
        <div className={cn(
            'shadcn-scope relative z-10 flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 transition-shadow duration-200 md:px-6',
            isMobile ? 'h-14' : 'h-16',
            scrolled ? 'bg-background/80 backdrop-blur-lg' : ''
        )}>
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                {!isMobile && (
                    <>
                        <button
                            type="button"
                            onClick={toggleSidebar}
                            aria-label="Mostrar u ocultar el menú"
                            title="Mostrar u ocultar el menú (Ctrl + B)"
                            className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground shadow-sm transition-colors hover:bg-muted"
                        >
                            <PanelLeft className="size-4" />
                        </button>
                        <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />
                    </>
                )}
                <button type="button" onClick={() => resetNavigation()} className={cn('flex shrink-0 items-center gap-1.5 hover:text-foreground', enInicio && 'font-medium text-foreground')}>
                    <IconHome size={15} />
                    <span>Inicio</span>
                </button>
                {!enInicio && <span className="shrink-0 text-border">/</span>}
                {enInicio ? null : moduloEsEnlace ? (
                    <button type="button" onClick={alModulo} className="truncate hover:text-foreground">{moduleLabel || 'Inicio'}</button>
                ) : (
                    <span className={cn('truncate', pageBreadcrumb.length === 0 && 'font-medium text-foreground')}>{moduleLabel || 'Inicio'}</span>
                )}
                {submoduleLabel && pageBreadcrumb.length === 0 && (
                    <>
                        <span className="shrink-0 text-border">/</span>
                        <span className="truncate font-medium text-foreground">{submoduleLabel}</span>
                    </>
                )}
                {tramosDeLaPagina.map((item, idx) => {
                    const isLast = idx === tramosDeLaPagina.length - 1;
                    return (
                        <Fragment key={`${item.label}-${idx}`}>
                            <span className="shrink-0 text-border">/</span>
                            {item.onClick && !isLast ? (
                                <button type="button" onClick={item.onClick} className="truncate hover:text-foreground">
                                    {item.label}
                                </button>
                            ) : (
                                <span className={cn('truncate', isLast && 'font-medium text-foreground')}>{item.label}</span>
                            )}
                        </Fragment>
                    );
                })}
            </div>
            <div className="flex shrink-0 items-center gap-1">
                <NotificationBell compact={isMobile} />
                <ThemeToggle compact={isMobile} />
            </div>
        </div>
    );
}
