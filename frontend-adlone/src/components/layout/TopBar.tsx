import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar, Badge, Dropdown, Input, Switch, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import {
    IconBell,
    IconExclamationMark,
    IconLogout,
    IconMoon,
    IconSearch,
    IconSun,
    IconUserCircle,
} from '@tabler/icons-react';
import logoAdl from '../../assets/images/logo-adlone.png';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useThemeStore } from '../../store/themeStore';
import { NotificationPopover } from '../../features/notifications/components/NotificationPopover';
import API_CONFIG from '../../config/api.config';

const { Text } = Typography;

interface UserActionsClusterProps {
    onHelpClick?: () => void;
    onNavigate?: () => void;
    compact?: boolean;
}

// Campana de notificaciones + toggle de tema + avatar/menú de usuario — el
// bloque que antes vivía al fondo del Sidebar (ver Sidebar.tsx histórico).
// Se usa tanto en el TopBar de escritorio como en el header compacto de
// móvil (MainLayout), por eso vive en su propio componente reutilizable en
// vez de duplicar el JSX en los dos lugares.
export function UserActionsCluster({ onHelpClick, onNavigate, compact }: UserActionsClusterProps) {
    const { user, logout } = useAuth();
    const { mode, toggleMode } = useThemeStore();
    const { setActiveModule, setActiveSubmodule } = useNavStore();
    const { notifications } = useNotificationStore();
    const unreadCount = notifications.filter((n) => !n.leido).length;

    const [notifOpen, setNotifOpen] = useState(false);
    const [showBubble, setShowBubble] = useState(false);
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
            setShowBubble(true);
            const timer = setTimeout(() => setShowBubble(false), 5000);
            return () => clearTimeout(timer);
        }
        prevUnreadCount.current = unreadCount;
    }, [unreadCount, notifOpen]);

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

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div ref={notificationsRef} style={{ position: 'relative' }}>
                <NotificationPopover opened={notifOpen} onClose={() => setNotifOpen(false)}>
                    <Tooltip title="Notificaciones">
                        <button
                            onClick={() => { setNotifOpen((v) => !v); setShowBubble(false); }}
                            style={{
                                border: 'none',
                                background: notifOpen ? 'var(--app-accent-bg)' : 'transparent',
                                color: notifOpen ? 'var(--app-accent-text)' : 'var(--app-text)',
                                width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                        >
                            <Badge count={unreadCount} size="small" offset={[-2, 2]}>
                                <IconBell size={19} stroke={1.75} />
                            </Badge>
                        </button>
                    </Tooltip>
                </NotificationPopover>

                {/* eslint-disable react-hooks/refs */}
                {showBubble && notificationsRef.current && !notifOpen && createPortal(
                    <div
                        style={{
                            position: 'fixed',
                            top: notificationsRef.current.getBoundingClientRect().bottom + 8,
                            left: notificationsRef.current.getBoundingClientRect().left - 80,
                            backgroundColor: 'var(--app-bg-elevated)', color: 'var(--app-text)',
                            padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                            whiteSpace: 'nowrap', boxShadow: '0 10px 25px rgba(0,0,0,0.25)', zIndex: 2200,
                            pointerEvents: 'none', border: '1px solid var(--app-border)', borderTop: '4px solid #0062a8',
                        }}
                    >
                        {notifications[0]?.titulo || '¡Nueva notificación!'}
                    </div>,
                    document.body
                )}
                {/* eslint-enable react-hooks/refs */}
            </div>

            {compact ? (
                <Tooltip title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
                    <button
                        onClick={toggleMode}
                        aria-label="Cambiar tema"
                        style={{
                            border: 'none', background: 'transparent', color: 'var(--app-text)',
                            width: 38, height: 38, borderRadius: 8, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        {mode === 'dark' ? <IconMoon size={19} stroke={1.75} /> : <IconSun size={19} stroke={1.75} />}
                    </button>
                </Tooltip>
            ) : (
                <Tooltip title={mode === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'}>
                    <Switch
                        size="small"
                        checked={mode === 'dark'}
                        onChange={toggleMode}
                        checkedChildren={<IconMoon size={12} />}
                        unCheckedChildren={<IconSun size={12} />}
                        style={{ marginInline: 4 }}
                    />
                </Tooltip>
            )}

            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight" trigger={['click']}>
                <button style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, borderRadius: '50%', display: 'flex' }}>
                    <Avatar
                        src={user?.foto ? `${API_CONFIG.getBaseURL()}${user.foto}` : undefined}
                        size={34}
                        style={{ backgroundColor: 'var(--app-hover-bg)', color: 'var(--app-text-secondary)', flexShrink: 0 }}
                    >
                        {user?.name?.charAt(0)}
                    </Avatar>
                </button>
            </Dropdown>
        </div>
    );
}

interface TopBarProps {
    onHelpClick?: () => void;
}

// Barra global fija sobre sidebar+contenido, solo desktop (ver MainLayout —
// móvil extiende su propio header compacto con UserActionsCluster en vez de
// montar este componente). Logo + búsqueda (solo visual, sin lógica real
// todavía — ver spec) + UserActionsCluster.
export function TopBar({ onHelpClick }: TopBarProps) {
    const { resetNavigation } = useNavStore();

    return (
        <div
            style={{
                height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 20px', backgroundColor: 'var(--app-bg-elevated)',
                borderBottom: '1px solid var(--app-border)', position: 'relative', zIndex: 210, gap: 20,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', flexShrink: 0 }} onClick={() => resetNavigation()}>
                <img src={logoAdl} alt="ADL" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            </div>

            <Input
                placeholder="Buscar..."
                readOnly
                title="Búsqueda global (próximamente)"
                prefix={<IconSearch size={16} color="var(--app-text-secondary)" />}
                suffix={
                    <Text type="secondary" style={{ fontSize: 11, border: '1px solid var(--app-border)', borderRadius: 4, padding: '1px 6px' }}>
                        ⌘K
                    </Text>
                }
                style={{ maxWidth: 380, flex: 1 }}
            />

            <UserActionsCluster onHelpClick={onHelpClick} />
        </div>
    );
}
