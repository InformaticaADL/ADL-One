import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Menu, Dropdown, Avatar, Badge, Tooltip, Typography, Switch } from 'antd';
import type { MenuProps } from 'antd';
import {
    IconUserCircle,
    IconBell,
    IconMessageCircle,
    IconExclamationMark,
    IconLogout,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarRightCollapse,
    IconFileInvoice,
    IconClipboardList,
    IconSun,
    IconMoon,
} from '@tabler/icons-react';
import logoAdl from '../../assets/images/logo-adlone.png';
import logoSmall from '../../assets/images/logo-adlone-pequeño.png';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';
import { NotificationPopover } from '../../features/notifications/components/NotificationPopover';
import API_CONFIG from '../../config/api.config';
import axios from 'axios';
import { getIconComponent } from '../../config/iconRegistry';
import classes from './Sidebar.module.css';

const { Text } = Typography;

// Módulos con iconos de Tabler
const FIXED_TOP_MODULES = [
    { label: 'Solicitudes', icon: IconClipboardList, id: 'solicitudes' },
    { label: 'Notificaciones', icon: IconBell, id: 'notificaciones' },
    { label: 'Chat / Mensajes', icon: IconMessageCircle, id: 'chat' },
    { label: 'Facturación', icon: IconFileInvoice, id: 'facturacion', permission: 'FAC_ACCESO' },
];

const FIXED_BOTTOM_MODULES: any[] = [];

type MenuItem = Required<MenuProps>['items'][number];

// Ícono + etiqueta con badge opcional a la derecha — reemplaza al antiguo
// ThemeIcon/Group manual: antd ya resuelve estado activo/hover por token.
function itemLabel(label: string, badgeCount?: number) {
    if (!badgeCount) return label;
    return (
        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <span>{label}</span>
            <span className={classes.counter}>{badgeCount > 99 ? '99+' : badgeCount}</span>
        </span>
    );
}

export function Sidebar({ forceNotCollapsed, onNavigate, hideLogo, onHelpClick }: { forceNotCollapsed?: boolean, onNavigate?: () => void, hideLogo?: boolean, onHelpClick?: () => void }) {
    const { user, logout, hasPermission, token } = useAuth();
    const { mode, toggleMode } = useThemeStore();
    const {
        activeModule,
        activeSubmodule,
        sidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        setActiveModule,
        setActiveSubmodule,
        resetNavigation,
        dynamicModules,
        setDynamicModules,
        ursUnreadCount,
    } = useNavStore();

    const isCollapsed = forceNotCollapsed ? false : sidebarCollapsed;
    const [openedModule, setOpenedModule] = useState<string | null>(activeModule);
    const [notifOpen, setNotifOpen] = useState(false);
    const [showBubble, setShowBubble] = useState(false);
    const isFirstLoad = useRef(true);
    const prevUnreadCount = useRef<number>(0);
    const notificationsRef = useRef<HTMLDivElement>(null);

    // Notebooks con escalado de Windows alto (125-150%) le reportan al
    // navegador un viewport efectivo mucho más angosto que la resolución
    // física — a diferencia de un font-size fijo, este umbral SÍ responde a
    // eso: colapsa el sidebar por defecto para aprovechar mejor ese espacio.
    // Solo fija un DEFAULT al cargar (no pelea con lo que el usuario ya
    // haya elegido manualmente después) y no aplica en modo forzado (drawer
    // mobile, que ya maneja su propio ancho).
    useEffect(() => {
        if (forceNotCollapsed) return;
        if (window.innerWidth < 1440 && !sidebarCollapsed) {
            setSidebarCollapsed(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch dynamic menu only once per session (cached in Zustand store)
    useEffect(() => {
        if (!token || dynamicModules.length > 0) return;
        const fetchMenu = async () => {
            try {
                const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/menu`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.data && response.data.success) {
                    setDynamicModules(response.data.data);
                }
            } catch {
                // Silently fail — sidebar will show static modules only
            }
        };
        fetchMenu();
    }, [token, dynamicModules.length]);

    // Sync opened module with active module changes
    useEffect(() => {
        if (activeModule) {
            // En modo compacto (móvil), 'notificaciones' se maneja como panel inline,
            // no cerramos openedModule cuando está activo
            if (activeModule === 'notificaciones' && !forceNotCollapsed) {
                setOpenedModule(null);
            } else if (activeModule !== 'notificaciones') {
                setOpenedModule(activeModule);
            }
        }
    }, [activeModule, forceNotCollapsed]);

    const { notifications } = useNotificationStore();
    const unreadCount = notifications.filter(n => !n.leido).length;

    // Escudo temporal para suprimir alertas durante el arranque (hidratación asíncrona del store)
    useEffect(() => {
        const timer = setTimeout(() => {
            isFirstLoad.current = false;
        }, 5000);
        return () => clearTimeout(timer);
    }, []);

    // Detect new notifications for Bubble
    useEffect(() => {
        // Ignorar cambios si estamos en la ventana de carga inicial
        if (isFirstLoad.current) {
            prevUnreadCount.current = unreadCount;
            return;
        }

        if (unreadCount > prevUnreadCount.current && unreadCount > 0 && !notifOpen) {
            setShowBubble(true);
            const timer = setTimeout(() => setShowBubble(false), 5000);
            return () => clearTimeout(timer);
        }
        prevUnreadCount.current = unreadCount;
    }, [unreadCount, notifOpen]);

    const canAccessModule = (module: any) => {
        let hasBasePermission = false;

        if (!module.permission || module.permission.length === 0) {
            hasBasePermission = true;
        } else {
            hasBasePermission = Array.isArray(module.permission)
                ? module.permission.some((perm: string) => hasPermission(perm))
                : hasPermission(module.permission);
        }

        // Si tiene submódulos (links), OBLIGATORIAMENTE debe tener acceso a al menos uno para ver el módulo padre
        if (module.links && Array.isArray(module.links) && module.links.length > 0) {
            const canAccessAnyLink = module.links.some((link: any) => {
                if (!link.permission || link.permission.length === 0) return true;
                if (Array.isArray(link.permission)) {
                    return link.permission.some((p: string) => hasPermission(p));
                }
                return hasPermission(link.permission);
            });

            // Para ver el módulo, debe cumplir el permiso base (si lo hay) Y tener acceso a un link
            return hasBasePermission && canAccessAnyLink;
        }

        return hasBasePermission;
    };

    const handleModuleClick = (moduleId: string) => {
        const mod = dynamicModules.find((m: any) => m.id === moduleId) || FIXED_TOP_MODULES.find(m => m.id === moduleId);
        const hasSubItems = mod && 'links' in mod && Array.isArray((mod as any).links) && (mod as any).links.length > 0;

        if (hasSubItems) {
            // Si el módulo ya es el activo, no reseteamos el submódulo
            if (activeModule !== moduleId) {
                setActiveModule(moduleId);
                setActiveSubmodule('');
            }
        } else {
            // Si no tiene subítems, navegamos directamente
            setActiveModule(moduleId);
            setActiveSubmodule('');
            onNavigate?.();
        }
    };

    // Los módulos dinámicos ya vienen filtrados del backend según los permisos,
    // excepto si el usuario es admin o el backend los manda de más. Usamos canAccessModule por doble seguridad.
    const visibleModules = dynamicModules.filter((m: any) => canAccessModule(m));

    // Unidades: Filtrar módulos visibles según permisos
    const unidades = visibleModules.filter((m: any) => m.group === 'unidades');

    // Gestión: Mostrar si el usuario tiene permiso para algún módulo de gestión
    const gestionOp = visibleModules.filter((m: any) => m.group === 'gestion');

    const visibleBottom = FIXED_BOTTOM_MODULES.filter((m) => !m.permission || hasPermission(m.permission));

    const visibleTop = FIXED_TOP_MODULES.filter((m) => !m.permission || hasPermission(m.permission))
        .filter((m) => m.id !== 'notificaciones'); // Notificaciones se renderiza aparte (abre un popover, no navega)

    const buildDynamicItem = (mod: any): MenuItem => {
        const filteredLinks = (mod.links || []).filter((link: any) => {
            if (!link.permission) return true;
            if (Array.isArray(link.permission)) {
                return link.permission.some((perm: string) => hasPermission(perm));
            }
            return hasPermission(link.permission);
        });
        const Icon = getIconComponent(mod.icon);
        return {
            key: mod.id,
            icon: <Icon size={18} stroke={1.75} />,
            label: mod.label,
            children: filteredLinks.length > 0
                ? filteredLinks.map((l: any) => ({ key: l.id, label: l.label }))
                : undefined,
        };
    };

    const items: MenuItem[] = useMemo(() => {
        const result: MenuItem[] = visibleTop.map((item) => ({
            key: item.id,
            icon: <item.icon size={18} stroke={1.75} />,
            label: itemLabel(item.label, item.id === 'solicitudes' ? ursUnreadCount : undefined),
        }));

        if (unidades.length > 0) {
            result.push({
                type: 'group',
                key: 'grp-unidades',
                label: 'UNIDADES',
                children: unidades.map(buildDynamicItem),
            } as MenuItem);
        }
        if (gestionOp.length > 0) {
            result.push({
                type: 'group',
                key: 'grp-gestion',
                label: 'GESTIÓN',
                children: gestionOp.map(buildDynamicItem),
            } as MenuItem);
        }
        if (visibleBottom.length > 0) {
            result.push({
                type: 'group',
                key: 'grp-soporte',
                label: 'SOPORTE',
                children: visibleBottom.map((item) => ({
                    key: item.id,
                    icon: <item.icon size={18} stroke={1.75} />,
                    label: item.label,
                })),
            } as MenuItem);
        }
        return result;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleTop, unidades, gestionOp, visibleBottom, ursUnreadCount]);

    // Selección: si hay submódulo activo, resalta ese; si no, el módulo raíz.
    const selectedKeys = activeSubmodule ? [activeSubmodule] : (activeModule ? [activeModule] : []);
    const openKeys = openedModule ? [openedModule] : [];

    const handleClick: MenuProps['onClick'] = ({ key, keyPath }) => {
        // keyPath.length > 1 → un ítem hoja dentro de un submódulo (el submódulo
        // es keyPath[1]). keyPath.length === 1 → un módulo raíz sin hijos.
        if (keyPath.length > 1) {
            setActiveSubmodule(key);
            onNavigate?.();
        } else {
            handleModuleClick(key);
        }
    };

    const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
        // Solo un submódulo abierto a la vez (comportamiento acordeón previo).
        const next = keys.find((k) => !openKeys.includes(k)) ?? null;
        setOpenedModule(next);
        if (next) handleModuleClick(next);
    };

    const userMenuItems: MenuProps['items'] = [
        { key: 'perfil', icon: <IconUserCircle size={14} />, label: 'Mi Perfil' },
        { key: 'ayuda', icon: <IconExclamationMark size={14} />, label: 'Ayuda' },
        { type: 'divider' },
        { key: 'logout', icon: <IconLogout size={14} />, label: 'Cerrar sesión', danger: true },
    ];

    const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
        if (key === 'perfil') {
            setActiveModule('perfil');
            setActiveSubmodule('');
            onNavigate?.();
        } else if (key === 'ayuda') {
            onHelpClick?.();
            onNavigate?.();
        } else if (key === 'logout') {
            logout();
        }
    };

    const notifItem = FIXED_TOP_MODULES.find((m) => m.id === 'notificaciones')!;
    const notifActive = notifOpen || activeModule === 'notificaciones';
    const notifButton = (
        <div ref={notificationsRef}>
            <Tooltip title={isCollapsed ? 'Notificaciones' : ''} placement="right">
                <button
                    className={`${classes.notifButton} ${notifActive ? classes.notifButtonActive : ''} ${isCollapsed ? classes.notifButtonCollapsed : ''}`}
                    onClick={() => { setNotifOpen((v) => !v); setShowBubble(false); }}
                >
                    <Badge count={unreadCount} size="small" offset={isCollapsed ? [-2, 2] : [0, 0]}>
                        <notifItem.icon size={18} stroke={1.75} />
                    </Badge>
                    {!isCollapsed && <span style={{ flex: 1 }}>{notifItem.label}</span>}
                </button>
            </Tooltip>
        </div>
    );

    return (
        <nav className={`${classes.navbar} ${isCollapsed ? classes.navbarCollapsed : ''}`}>
            {!hideLogo && (
                <div className={classes.header}>
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', paddingLeft: isCollapsed ? 0 : 28 }}>
                            <img
                                src={isCollapsed ? logoSmall : logoAdl}
                                alt="ADL Logo"
                                style={{
                                    height: isCollapsed ? 32 : 50,
                                    maxWidth: isCollapsed ? 32 : 180,
                                    objectFit: 'contain',
                                    cursor: 'pointer',
                                    transition: 'all 200ms ease',
                                }}
                                onClick={() => resetNavigation()}
                            />
                        </div>
                        <Tooltip title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}>
                            <button
                                onClick={toggleSidebar}
                                style={{
                                    border: 'none', background: 'transparent', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--app-text-secondary)', padding: 6, borderRadius: 6,
                                    ...(isCollapsed ? { position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' } : {}),
                                }}
                            >
                                {isCollapsed
                                    ? <IconLayoutSidebarRightCollapse size={18} />
                                    : <IconLayoutSidebarLeftCollapse size={20} />}
                            </button>
                        </Tooltip>
                    </div>
                </div>
            )}

            <div className={classes.links}>
                <div className={classes.linksInner}>
                    <div className={classes.section}>
                        <NotificationPopover opened={notifOpen} onClose={() => setNotifOpen(false)}>
                            {notifButton}
                        </NotificationPopover>
                    </div>

                    <Menu
                        mode="inline"
                        inlineCollapsed={isCollapsed}
                        selectedKeys={selectedKeys}
                        openKeys={isCollapsed ? undefined : openKeys}
                        onOpenChange={handleOpenChange}
                        onClick={handleClick}
                        items={items}
                        style={{ border: 'none', background: 'transparent' }}
                    />
                </div>
            </div>

            <div className={classes.footer}>
                <div className={classes.section}>
                    {isCollapsed ? (
                        <Tooltip title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'} placement="right">
                            <button
                                className={`${classes.themeSwitch} ${classes.themeSwitchCollapsed}`}
                                onClick={toggleMode}
                                aria-label="Cambiar tema"
                            >
                                {mode === 'dark' ? <IconMoon size={17} stroke={1.75} /> : <IconSun size={17} stroke={1.75} />}
                            </button>
                        </Tooltip>
                    ) : (
                        <div className={classes.themeSwitch}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {mode === 'dark' ? <IconMoon size={15} stroke={1.75} /> : <IconSun size={15} stroke={1.75} />}
                                Modo {mode === 'dark' ? 'oscuro' : 'claro'}
                            </span>
                            <Switch size="small" checked={mode === 'dark'} onChange={toggleMode} />
                        </div>
                    )}
                </div>

                <div className={classes.user}>
                    <Dropdown
                        menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                        placement="topRight"
                        trigger={['click']}
                    >
                        <button className={classes.userButton}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'nowrap' }}>
                                <Avatar
                                    src={user?.foto ? `${API_CONFIG.getBaseURL()}${user.foto}` : undefined}
                                    size={32}
                                    style={{ backgroundColor: '#0062a8', flexShrink: 0 }}
                                >
                                    {user?.name?.charAt(0)}
                                </Avatar>
                                {!isCollapsed && (
                                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                        <Text style={{ fontSize: 12, lineHeight: 1.2, display: 'block' }} strong ellipsis={{ tooltip: user?.name }}>
                                            {user?.name || 'Usuario'}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: 10, lineHeight: 1.1, display: 'block' }} ellipsis={{ tooltip: user?.cargo }}>
                                            {user?.cargo || ''}
                                        </Text>
                                    </div>
                                )}
                            </div>
                        </button>
                    </Dropdown>
                </div>
            </div>

            {showBubble && notificationsRef.current && !notifOpen && createPortal(
                <div
                    className={classes.bubbleNotification}
                    style={{
                        position: 'fixed',
                        top: notificationsRef.current.getBoundingClientRect().top + (notificationsRef.current.offsetHeight / 2) - 20,
                        left: notificationsRef.current.getBoundingClientRect().right + 10,
                    }}
                >
                    {notifications[0]?.titulo || '¡Nueva notificación!'}
                </div>,
                document.body
            )}
        </nav>
    );
}
