import { useState, useEffect, useRef } from 'react';
import {
    Group,
    ScrollArea,
    rem,
    Avatar,
    Text,
    UnstyledButton,
    Collapse,
    ThemeIcon,
    Box,
    Badge,
    Menu,
    ActionIcon,
    Tooltip,
    Portal
} from '@mantine/core';
import {
    IconChevronRight,
    IconUserCircle,
    IconClipboardList,
    IconBell,
    IconMessageCircle,
    IconQuestionMark,
    IconLogout,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarRightCollapse,
} from '@tabler/icons-react';
import logoAdl from '../../assets/images/logo-adlone.png';
import logoSmall from '../../assets/images/logo-adlone-pequeño.png';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationPopover } from '../../features/notifications/components/NotificationPopover';
import API_CONFIG from '../../config/api.config';
import axios from 'axios';
import { getIconComponent } from '../../config/iconRegistry';
import classes from './Sidebar.module.css';
import { HelpCenter } from '../common/HelpCenter';

// Módulos con iconos de Tabler
const FIXED_TOP_MODULES = [
    { label: 'Solicitudes', icon: IconClipboardList, id: 'solicitudes' },
    { label: 'Notificaciones', icon: IconBell, id: 'notificaciones' },
    { label: 'Chat / Mensajes', icon: IconMessageCircle, id: 'chat' },
];

const FIXED_BOTTOM_MODULES: any[] = [];

interface LinksGroupProps {
    icon: any;
    label: string;
    opened: boolean;
    onToggle: () => void;
    links?: { label: string; id: string; permission?: string | string[] }[];
    id: string;
    active?: boolean;
    activeSubmodule?: string;
    collapsed?: boolean;
    badge?: React.ReactNode;
    onClick?: () => void;
    onSubmoduleClick?: (id: string) => void;
    notificationRef?: React.RefObject<HTMLDivElement | null>; // Compatible con useRef inicializado en null
}

export function LinksGroup({
    icon: Icon,
    label,
    opened,
    onToggle,
    links,
    active,
    activeSubmodule,
    collapsed,
    badge,
    onClick,
    onSubmoduleClick,
    notificationRef // Destructure notificationRef
}: LinksGroupProps) {
    const hasLinks = Array.isArray(links) && links.length > 0;

    const items = (hasLinks ? links : []).map((link) => (
        <UnstyledButton
            className={`${classes.link} ${activeSubmodule === link.id ? classes.linkActive : ''}`}
            key={link.label}
            onClick={(event) => {
                event.preventDefault();
                if (onSubmoduleClick) onSubmoduleClick(link.id);
            }}
        >
            {link.label}
        </UnstyledButton>
    ));

    if (collapsed) {
        return (
            <Box style={{ marginBottom: 6 }} ref={notificationRef}>
                {hasLinks ? (
                    <Menu position="right-start" withArrow shadow="md" offset={10}>
                        <Menu.Target>
                            <UnstyledButton
                                className={`${classes.control} ${active ? classes.controlActive : ''}`}
                                onClick={onClick}
                            >
                                <ThemeIcon variant={active ? 'filled' : 'light'} size={28} color="adl-blue" radius="md">
                                    <Icon style={{ width: 16, height: 16 }} />
                                </ThemeIcon>
                                {badge && (
                                    <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 10 }}>
                                        {badge}
                                    </div>
                                )}
                            </UnstyledButton>
                        </Menu.Target>
                        <Menu.Dropdown>
                            <Menu.Label>{label}</Menu.Label>
                            {links.map((link) => (
                                <Menu.Item
                                    key={link.id}
                                    onClick={() => onSubmoduleClick?.(link.id)}
                                    className={activeSubmodule === link.id ? classes.menuItemActive : ''}
                                >
                                    {link.label}
                                </Menu.Item>
                            ))}
                        </Menu.Dropdown>
                    </Menu>
                ) : (
                    <Tooltip label={label} position="right" withArrow transitionProps={{ duration: 0 }}>
                        <UnstyledButton
                            className={`${classes.control} ${active ? classes.controlActive : ''}`}
                            onClick={onClick}
                        >
                            <ThemeIcon variant={active ? 'filled' : 'light'} size={28} color="adl-blue" radius="md">
                                <Icon style={{ width: 16, height: 16 }} />
                            </ThemeIcon>
                            {badge && (
                                <div style={{ position: 'absolute', top: -4, right: -4, zIndex: 10 }}>
                                    {badge}
                                </div>
                            )}
                        </UnstyledButton>
                    </Tooltip>
                )}
            </Box>
        );
    }

    return (
        <Box style={{ marginBottom: 6 }} ref={notificationRef}>
            <UnstyledButton
                onClick={() => {
                    if (hasLinks) onToggle();
                    if (onClick) onClick();
                }}
                className={`${classes.control} ${active ? classes.controlActive : ''}`}
            >
                <Group justify="space-between" gap={0} wrap="nowrap">
                    <Box style={{ display: 'flex', alignItems: 'center' }}>
                        <ThemeIcon variant={active ? 'filled' : 'light'} size={28} color="adl-blue" radius="md">
                            <Icon style={{ width: 16, height: 16 }} />
                        </ThemeIcon>
                        <Box ml="md" style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>{label}</Box>
                        {badge && <Box ml="sm">{badge}</Box>}
                    </Box>
                    {hasLinks && (
                        <IconChevronRight
                            className={classes.chevron}
                            stroke={1.5}
                            style={{
                                width: rem(16),
                                height: rem(16),
                                transform: opened ? 'rotate(-90deg)' : 'none',
                            }}
                        />
                    )}
                </Group>
            </UnstyledButton>
            {hasLinks && (
                <Collapse in={opened}>
                    <div className={classes.subItemsContainer}>
                        {items}
                    </div>
                </Collapse>
            )}
        </Box>
    );
}

export function Sidebar({ forceNotCollapsed, onNavigate, hideLogo }: { forceNotCollapsed?: boolean, onNavigate?: () => void, hideLogo?: boolean }) {
    const { user, logout, hasPermission, token } = useAuth();
    const {
        activeModule,
        activeSubmodule,
        sidebarCollapsed,
        toggleSidebar,
        setActiveModule,
        setActiveSubmodule,
        resetNavigation,
        dynamicModules,
        setDynamicModules,
    } = useNavStore();

    const isCollapsed = forceNotCollapsed ? false : sidebarCollapsed;
    const [openedModule, setOpenedModule] = useState<string | null>(activeModule);
    const [showBubble, setShowBubble] = useState(false);
    const isFirstLoad = useRef(true);
    const prevUnreadCount = useRef<number>(0);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const [helpOpened, setHelpOpened] = useState(false);

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
            } catch (_) {
                // Silently fail — sidebar will show static modules only
            }
        };
        fetchMenu();
    }, [token, dynamicModules.length]);

    // Sync opened module with active module changes
    useEffect(() => {
        if (activeModule) {
            // Si el módulo activo es notificaciones (historial), cerramos el popover
            if (activeModule === 'notificaciones') {
                setOpenedModule(null);
            } else {
                setOpenedModule(activeModule);
            }
        }
    }, [activeModule]);

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

        if (unreadCount > prevUnreadCount.current && unreadCount > 0 && openedModule !== 'notificaciones') {
            setShowBubble(true);
            const timer = setTimeout(() => setShowBubble(false), 5000);
            return () => clearTimeout(timer);
        }
        prevUnreadCount.current = unreadCount;
    }, [unreadCount, openedModule]);

    // Close popover when clicking outside the sidebar/popovers
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            if (!openedModule) return;

            // 1. Si clicamos FUERA del Sidebar y fuera de cualquier Popover
            const isOutsideSidebar = !target.closest(`.${classes.navbar}`);
            const isOutsidePopover = !target.closest('.mantine-Popover-dropdown');

            // 2. Si clicamos DENTRO del Sidebar pero en un espacio vacío (no es botón ni link)
            const isInteractive = target.closest('button, a, [role="button"]');
            const isInsideSidebar = !!target.closest(`.${classes.navbar}`);

            // 3. PERSISTENCIA: No cerrar si es el módulo activo o contiene al submódulo activo
            const { activeModule: activeMod, activeSubmodule: activeSub } = useNavStore.getState();

            // Si el módulo está expandido manuamente y es el activo, no cerrar
            if (openedModule === activeMod) return;

            // Si el submódulo activo pertenece al módulo expandido, no cerrar
            const currentModule = dynamicModules.find(m => m.id === openedModule);
            const links = Array.isArray(currentModule?.links) ? currentModule.links as Array<{ id: string }> : [];
            const hasActiveSub = links.some(link => link.id === activeSub);
            if (hasActiveSub) return;

            if ((isOutsideSidebar && isOutsidePopover) || (isInsideSidebar && !isInteractive)) {
                setOpenedModule(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [openedModule]);

    const canAccessModule = (module: any) => {
        // 1. Si no hay permisos definidos, acceso libre
        if (!module.permission) return true;

        // 2. Verificar permiso de acceso principal (Individual o Array)
        const hasMainPermission = Array.isArray(module.permission)
            ? module.permission.some((perm: string) => hasPermission(perm))
            : hasPermission(module.permission);

        if (hasMainPermission) return true;

        // 3. NUEVO: Si no tiene el principal, verificar si tiene acceso a cualquiera de sus links
        // Solo otorgamos acceso si el link TIENE un permiso específico y el usuario lo posee.
        if (module.links && Array.isArray(module.links)) {
            return module.links.some((link: any) => {
                if (!link.permission) return false; 
                if (Array.isArray(link.permission)) {
                    return link.permission.some((p: string) => hasPermission(p));
                }
                return hasPermission(link.permission);
            });
        }

        return false;
    };

    const handleModuleClick = (moduleId: string) => {
        if (moduleId === 'notificaciones') {
            setOpenedModule(openedModule === 'notificaciones' ? null : 'notificaciones');
            setShowBubble(false);
            return;
        }

        const mod = dynamicModules.find(m => m.id === moduleId) || FIXED_TOP_MODULES.find(m => m.id === moduleId);
        const hasSubItems = mod && 'links' in mod && Array.isArray(mod.links) && mod.links.length > 0;

        if (hasSubItems) {
            // Solo alternar expansión
            setOpenedModule(openedModule === moduleId ? null : moduleId);

            // Si el módulo ya es el activo, no reseteamos el submódulo
            if (activeModule !== moduleId) {
                setActiveModule(moduleId);
                setActiveSubmodule('');
            }
        } else {
            // Si no tiene subítems, navegamos directamente
            setActiveModule(moduleId);
            setActiveSubmodule('');
            // No cerramos el openedModule si es el actual para mantener el estado visual
            setOpenedModule(moduleId);
            onNavigate?.();
        }
    };

    // Los módulos dinámicos ya vienen filtrados del backend según los permisos,
    // excepto si el usuario es admin o el backend los manda de más. Usamos canAccessModule por doble seguridad.
    const visibleModules = dynamicModules.filter(m => canAccessModule(m));
    
    // Unidades: Filtrar módulos visibles según permisos
    const unidades = visibleModules.filter(m => m.group === 'unidades');
    
    // Gestión: Mostrar si el usuario tiene permiso para algún módulo de gestión
    const gestionOp = visibleModules.filter(m => m.group === 'gestion');

    const visibleBottom = FIXED_BOTTOM_MODULES.filter(m => !m.permission || hasPermission(m.permission));

    const mainLinks = FIXED_TOP_MODULES.map((item) => {
        const isNotificationsItem = item.id === 'notificaciones';
        const link = (
            <LinksGroup
                key={item.id}
                icon={item.icon}
                label={item.label}
                id={item.id}
                opened={openedModule === item.id}
                onToggle={() => setOpenedModule(openedModule === item.id ? null : item.id)}
                active={activeModule === item.id}
                activeSubmodule={activeSubmodule}
                collapsed={isCollapsed}
                onClick={() => handleModuleClick(item.id)}
                badge={(isNotificationsItem && unreadCount > 0) ? (
                    <Badge size="xs" variant="filled" color="red" className={classes.badge}>
                        {unreadCount}
                    </Badge>
                ) : null}
                notificationRef={isNotificationsItem ? notificationsRef : undefined} // Pass ref to notification item
                onSubmoduleClick={(subId) => {
                    setActiveSubmodule(subId);
                    onNavigate?.();
                }}
            />
        );

        if (isNotificationsItem) {
            return (
                <NotificationPopover
                    key={item.id}
                    opened={openedModule === 'notificaciones'}
                    onClose={() => setOpenedModule(null)}
                >
                    {link}
                </NotificationPopover>
            );
        }

        return link;
    });

    const bottomLinks = visibleBottom.map((item) => (
        <LinksGroup
            key={item.id}
            icon={item.icon}
            label={item.label}
            id={item.id}
            opened={openedModule === item.id}
            onToggle={() => setOpenedModule(openedModule === item.id ? null : item.id)}
            active={activeModule === item.id}
            activeSubmodule={activeSubmodule}
            collapsed={sidebarCollapsed}
            onClick={() => handleModuleClick(item.id)}
            onSubmoduleClick={(subId) => {
                setActiveSubmodule(subId);
                onNavigate?.();
            }}
        />
    ));

    const renderSecondaryLinks = (mods: any[], title: string) => {
        if (mods.length === 0) return null;
        return (
            <div className={classes.section}>
                <Text size="xs" fw={700} c="dimmed" className={classes.sectionTitle}>
                    {!isCollapsed && title}
                </Text>
                {mods.map((mod) => {
                    const filteredLinks = (mod.links || []).filter((link: any) => {
                        if (!link.permission) return true;
                        if (Array.isArray(link.permission)) {
                            return link.permission.some((perm: string) => hasPermission(perm));
                        }
                        return hasPermission(link.permission);
                    });

                    return (
                        <LinksGroup
                            key={mod.id}
                            icon={getIconComponent(mod.icon)}
                            label={mod.label}
                            id={mod.id}
                            opened={openedModule === mod.id}
                            onToggle={() => setOpenedModule(openedModule === mod.id ? null : mod.id)}
                            active={activeModule === mod.id}
                            activeSubmodule={activeSubmodule}
                            collapsed={isCollapsed}
                            onClick={() => handleModuleClick(mod.id)}
                            links={filteredLinks.length > 0 ? filteredLinks.map((l: any) => ({
                                label: l.label,
                                id: l.id,
                                permission: l.permission
                            })) : undefined}
                            onSubmoduleClick={(subId) => {
                                setActiveSubmodule(subId);
                                onNavigate?.();
                            }}
                        />
                    );
                })}
            </div>
        );
    };


    return (
        <nav className={`${classes.navbar} ${isCollapsed ? classes.navbarCollapsed : ''}`}>
            {!hideLogo && (
                <div className={classes.header}>
                    <Box style={{ width: '100%', display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <Box style={{ flex: 1, display: 'flex', justifyContent: 'center', paddingLeft: isCollapsed ? 0 : 28 }}>
                            <img
                                src={isCollapsed ? logoSmall : logoAdl}
                                alt="ADL Logo"
                                style={{
                                    height: isCollapsed ? 32 : 50,
                                    maxWidth: isCollapsed ? 32 : 180,
                                    objectFit: 'contain',
                                    cursor: 'pointer',
                                    transition: 'all 200ms ease',
                                    filter: 'none'
                                }}
                                onClick={() => resetNavigation()}
                            />
                        </Box>
                        {!isCollapsed ? (
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                onClick={toggleSidebar}
                                size="lg"
                            >
                                <IconLayoutSidebarLeftCollapse size={20} />
                            </ActionIcon>
                        ) : (
                            <ActionIcon
                                variant="subtle"
                                color="gray"
                                onClick={toggleSidebar}
                                size="md"
                                style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                            >
                                <IconLayoutSidebarRightCollapse size={18} />
                            </ActionIcon>
                        )}
                    </Box>
                </div>
            )}

            <ScrollArea className={classes.links}>
                <div className={classes.linksInner}>
                    <div className={classes.section}>
                        {mainLinks}
                    </div>

                    <div className={classes.separator} />

                    {renderSecondaryLinks(unidades, 'UNIDADES')}
                    {renderSecondaryLinks(gestionOp, 'GESTIÓN')}
                </div>
            </ScrollArea>

            <div className={classes.footer}>
                {!isCollapsed && bottomLinks.length > 0 && (
                    <div className={classes.section}>
                        <Text size="xs" fw={700} c="dimmed" className={classes.sectionTitle}>
                            SOPORTE
                        </Text>
                        {bottomLinks}
                    </div>
                )}

                <div className={classes.user}>
                    <Menu position="right-end" withArrow shadow="md">
                        <Menu.Target>
                            <UnstyledButton className={classes.userButton}>
                                <Group gap="sm" wrap="nowrap" align="center">
                                    <Avatar
                                        src={user?.foto ? `${API_CONFIG.getBaseURL()}${user.foto}` : null}
                                        radius="xl"
                                        color="blue"
                                        size={32}
                                    >
                                        {user?.name?.charAt(0)}
                                    </Avatar>
                                    {!isCollapsed && (
                                        <div style={{ flex: 1, minWidth: 0, paddingRight: 4, display: 'flex', flexDirection: 'column' }}>
                                            <Text style={{ fontSize: 12, lineHeight: 1.2, overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: 'normal' }} fw={600}>
                                                {user?.name || 'Usuario'}
                                            </Text>
                                            <Text
                                                c="dimmed"
                                                style={{ fontSize: 10, overflowWrap: 'anywhere', wordBreak: 'break-word', lineHeight: 1.1, whiteSpace: 'normal' }}
                                            >
                                                {user?.cargo || ''}
                                            </Text>
                                        </div>
                                    )}
                                    {!isCollapsed && <IconChevronRight size={12} stroke={1.5} />}
                                </Group>
                            </UnstyledButton>
                        </Menu.Target>

                        <Menu.Dropdown>
                            <Menu.Label>Panel de Usuario</Menu.Label>
                            <Menu.Item
                                leftSection={<IconUserCircle size={14} />}
                                onClick={() => {
                                    setActiveModule('perfil');
                                    setActiveSubmodule('');
                                    onNavigate?.();
                                }}
                            >
                                Mi Perfil
                            </Menu.Item>
                            <Menu.Item
                                leftSection={<IconQuestionMark size={14} />}
                                onClick={() => {
                                    setHelpOpened(true);
                                    onNavigate?.();
                                }}
                            >
                                Ayuda
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item
                                color="red"
                                onClick={logout}
                                leftSection={<IconLogout size={14} />}
                            >
                                Cerrar sesión
                            </Menu.Item>
                        </Menu.Dropdown>
                    </Menu>
                </div>
            </div>
            {showBubble && notificationsRef.current && openedModule !== 'notificaciones' && (
                <Portal>
                    <div
                        className={classes.bubbleNotification}
                        style={{
                            position: 'fixed',
                            top: notificationsRef.current.getBoundingClientRect().top + (notificationsRef.current.offsetHeight / 2) - 20,
                            left: notificationsRef.current.getBoundingClientRect().right + 10,
                        }}
                    >
                        {notifications[0]?.titulo || '¡Nueva notificación!'}
                    </div>
                </Portal>
            )}

            <HelpCenter opened={helpOpened} onClose={() => setHelpOpened(false)} />
        </nav>
    );
}
