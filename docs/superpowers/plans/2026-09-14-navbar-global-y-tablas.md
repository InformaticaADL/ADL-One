# Navbar Global y Sistema de Tablas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un navbar global persistente en desktop (hoy no existe) y aplicar un sistema de color/densidad neutro en las tablas de datos de todo el sistema, siguiendo la spec `docs/superpowers/specs/2026-09-14-navbar-global-y-tablas-design.md`.

**Architecture:** Parte A extrae el bloque de notificaciones/tema/avatar que hoy vive al fondo de `Sidebar.tsx` a un componente nuevo `TopBar.tsx` (con un sub-componente `UserActionsCluster` reutilizado también en el header compacto de móvil), montado en `MainLayout.tsx`. Parte B introduce un componente `NameCell` para celdas de tabla "avatar+nombre+subtítulo" y aplica la regla "color solo para estado" a los `Tag` de todo el sistema, dejando `StatusBadge.tsx` como el único lugar con tags de color decorativo-semántico.

**Tech Stack:** React 19, Ant Design v6, TypeScript, Vite. Sin framework de testing (el proyecto no tiene `vitest`/`jest` configurado) — la verificación de cada tarea usa el mismo flujo ya establecido en la migración anterior: `npx tsc -b --force`, `npx eslint <archivo>`, `npx vite build`, todos ejecutados desde `frontend-adlone/`.

---

## Nota sobre TDD en este plan

Este repositorio no tiene infraestructura de tests unitarios (confirmado: no hay `vitest`/`jest` en `package.json`, y ningún archivo `*.test.tsx` existe en `src/`). El patrón de verificación establecido en la migración Mantine→AntD (idéntica en tamaño y naturaleza a este trabajo) es exclusivamente: type-check + lint + build de producción, más revisión visual manual del usuario. Este plan sigue ese mismo patrón en vez de introducir un framework de testing nuevo fuera del alcance pedido.

---

## Parte A — Navbar global

### Task 1: Crear `TopBar.tsx` con `UserActionsCluster`

**Files:**
- Create: `frontend-adlone/src/components/layout/TopBar.tsx`

- [ ] **Step 1: Escribir el archivo completo**

```tsx
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

                {showBubble && !notifOpen && createPortal(
                    <div
                        style={{
                            position: 'fixed',
                            top: (notificationsRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
                            left: (notificationsRef.current?.getBoundingClientRect().left ?? 0) - 80,
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
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend-adlone && npx tsc -b --force`
Expected: sin salida (0 errores). El archivo todavía no se usa en ningún lado, así que no debería haber "declared but never used" a nivel de proyecto — solo se verifica que el archivo nuevo compila.

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/layout/TopBar.tsx`
Expected: sin errores nuevos. Si aparece `react-hooks/exhaustive-deps` en algún useEffect, comparar contra el comportamiento idéntico que ya tenía en `Sidebar.tsx` (mismo código, solo movido) — si ya existía ahí sin warning, no debería aparecer aquí tampoco.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/TopBar.tsx
git commit -m "feat(layout): add TopBar and UserActionsCluster components"
```

---

### Task 2: Montar `TopBar` en `MainLayout.tsx` y extender el header móvil

**Files:**
- Modify: `frontend-adlone/src/components/layout/MainLayout.tsx:1-16` (imports)
- Modify: `frontend-adlone/src/components/layout/MainLayout.tsx:83-108` (bloque de header)

- [ ] **Step 1: Agregar el import de `TopBar`/`UserActionsCluster`**

En `frontend-adlone/src/components/layout/MainLayout.tsx`, después de la línea `import { Sidebar } from './Sidebar';` (línea 6), agregar:

```tsx
import { TopBar, UserActionsCluster } from './TopBar';
```

- [ ] **Step 2: Reemplazar el bloque de header (líneas 83-108)**

Reemplazar:

```tsx
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--app-bg)' }}>
            {isCompact && (
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
                    <div style={{ width: 30 }} />
                </div>
            )}
```

Por:

```tsx
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
                    <UserActionsCluster
                        onHelpClick={() => setHelpCenterOpen(true, true)}
                        onNavigate={close}
                        compact
                    />
                </div>
            ) : (
                <TopBar onHelpClick={() => setHelpCenterOpen(true, true)} />
            )}
```

(Nota: `resetNavigation`, `close`, `setHelpCenterOpen`, `logoAdl` ya están definidos/importados más arriba en el archivo — no requieren imports nuevos.)

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc -b --force`
Expected: 0 errores.

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/layout/MainLayout.tsx`
Expected: sin errores nuevos respecto a los ya existentes en el archivo antes de este cambio.

- [ ] **Step 5: Build**

Run: `npx vite build`
Expected: build exitoso (warnings preexistentes de chunk-size/CSS son aceptables, ya presentes antes de este cambio).

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/MainLayout.tsx
git commit -m "feat(layout): mount global TopBar on desktop, extend mobile header"
```

---

### Task 3: Simplificar `Sidebar.tsx` (quitar notificaciones/tema/avatar)

**Files:**
- Modify: `frontend-adlone/src/components/layout/Sidebar.tsx` (reemplazo completo del archivo)
- Modify: `frontend-adlone/src/components/layout/MainLayout.tsx` (quitar prop `onHelpClick` de la invocación de `<Sidebar />`)

- [ ] **Step 1: Reemplazar el archivo completo**

Escribir `frontend-adlone/src/components/layout/Sidebar.tsx` con este contenido (idéntico al actual, menos: los imports `Dropdown, Avatar, Badge, Switch` de antd, `Typography`/`Text`, `createPortal`, los iconos `IconUserCircle, IconBell, IconExclamationMark, IconLogout, IconSun, IconMoon`, `useNotificationStore`, `useThemeStore`, `NotificationPopover`, la entrada `'Notificaciones'` de `FIXED_TOP_MODULES`, todo el estado/efectos de notificaciones (`notifOpen`, `showBubble`, `isFirstLoad`, `prevUnreadCount`, `notificationsRef`, `unreadCount`, los dos `useEffect` de la burbuja), `notifItem`/`notifActive`/`notifButton`, `userMenuItems`/`handleUserMenuClick`, el bloque `<div className={classes.section}><NotificationPopover>...` dentro de `.links`, todo `<div className={classes.footer}>...</div>`, y el portal de la burbuja al final):

```tsx
import { useState, useEffect, useMemo } from 'react';
import { Menu, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
    IconMessageCircle,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarRightCollapse,
    IconFileInvoice,
    IconClipboardList,
} from '@tabler/icons-react';
import logoAdl from '../../assets/images/logo-adlone.png';
import logoSmall from '../../assets/images/logo-adlone-pequeño.png';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import API_CONFIG from '../../config/api.config';
import axios from 'axios';
import { getIconComponent } from '../../config/iconRegistry';
import classes from './Sidebar.module.css';

// Módulos con iconos de Tabler
const FIXED_TOP_MODULES = [
    { label: 'Solicitudes', icon: IconClipboardList, id: 'solicitudes' },
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

export function Sidebar({ forceNotCollapsed, onNavigate, hideLogo }: { forceNotCollapsed?: boolean, onNavigate?: () => void, hideLogo?: boolean }) {
    const { hasPermission, token } = useAuth();
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

    const visibleTop = FIXED_TOP_MODULES.filter((m) => !m.permission || hasPermission(m.permission));

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
        </nav>
    );
}
```

- [ ] **Step 2: Quitar el prop `onHelpClick` de la invocación de `<Sidebar />` en `MainLayout.tsx`**

`Sidebar` ya no declara `onHelpClick` en su tipo de props (ver Step 1) — la ayuda ahora se dispara desde `UserActionsCluster` (Task 1/2). Sin este cambio, `tsc` falla con "Property 'onHelpClick' does not exist on type...".

En `frontend-adlone/src/components/layout/MainLayout.tsx`, ubicar la invocación de `<Sidebar />` dentro de la columna fija/drawer (no la del header compacto — esa no existe, `Sidebar` se invoca una sola vez):

```tsx
                    <Sidebar
                        forceNotCollapsed={isCompact}
                        hideLogo={isCompact}
                        onNavigate={close}
                        onHelpClick={() => setHelpCenterOpen(true, true)}
                    />
```

Reemplazar por:

```tsx
                    <Sidebar
                        forceNotCollapsed={isCompact}
                        hideLogo={isCompact}
                        onNavigate={close}
                    />
```

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc -b --force`
Expected: 0 errores.

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/layout/Sidebar.tsx src/components/layout/MainLayout.tsx`
Expected: 0 errores nuevos. Si aparece `no-unused-vars` para algún import, revisar contra la lista de imports del Step 1 — ya están recortados a lo que realmente se usa.

- [ ] **Step 5: Build**

Run: `npx vite build`
Expected: build exitoso.

- [ ] **Step 6: Commit**

```bash
git add src/components/layout/Sidebar.tsx src/components/layout/MainLayout.tsx
git commit -m "refactor(layout): remove notifications/theme/avatar footer from Sidebar (moved to TopBar)"
```

---

### Task 4: Quitar CSS huérfano de `Sidebar.module.css`

**Files:**
- Modify: `frontend-adlone/src/components/layout/Sidebar.module.css`

- [ ] **Step 1: Eliminar las clases que ya no usa ningún componente**

Quitar de `frontend-adlone/src/components/layout/Sidebar.module.css` las reglas `.footer`, `.notifButton`, `.notifButton:hover`, `.notifButtonActive`, `.notifButtonCollapsed`, `.themeSwitch`, `.themeSwitchCollapsed`, `.user`, `.userButton`, `.userButton:hover`, `.bubbleNotification`, `.bubbleNotification::before`, y el `@keyframes fadeIn` (solo lo usaba `.bubbleNotification`). El archivo resultante completo:

```css
/* Migrado a Ant Design: el listado de módulos/submódulos ahora lo dibuja
   <Menu> de antd (ver Sidebar.tsx), así que esta hoja solo conserva el
   chrome propio del panel — encabezado y scroll — que antd no cubre.
   Notificaciones/tema/avatar se movieron a TopBar.tsx. Usa los tokens
   --app-* de index.css (claro/oscuro según data-theme en <html>) en vez de
   var(--mantine-color-*) o hex fijo, para desacoplar este panel de Mantine
   y que responda al switch de tema. */

.navbar {
  background-color: transparent;
  height: 100%;
  width: 240px;
  padding: 10px;
  padding-bottom: 0;
  display: flex;
  flex-direction: column;
  border-right: none;
  transition: width 300ms ease;
}

.navbarCollapsed {
  width: 80px;
  padding: 10px;
}

.header {
  padding: 10px;
  padding-top: 0;
  margin-left: -10px;
  margin-right: -10px;
  color: var(--app-text);
  border-bottom: 1px solid var(--app-border);
  min-height: 70px;
  display: flex;
  align-items: center;
}

.links {
  flex: 1;
  margin-left: -10px;
  margin-right: -10px;
  overflow-y: auto;
}

.linksInner {
  padding-top: 10px;
  padding-bottom: 24px;
}

.section {
  padding: 0 10px;
}

.sectionTitle {
  margin-top: 16px;
  margin-bottom: 6px;
  padding-left: 0;
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--app-text-secondary);
}

.separator {
  height: 1px;
  background-color: var(--app-border);
  margin: 16px 0;
}

.counter {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background-color: #e03131;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(224, 49, 49, 0.4);
}
```

(Nota: `.section`, `.sectionTitle`, `.separator` se dejan aunque no se confirmó su uso activo en `Sidebar.tsx` tras el Task 3, para no arriesgar romper algo fuera de este archivo si algún otro componente las importa vía `classes` — verificar en el Step 2 de abajo.)

- [ ] **Step 2: Confirmar que ningún otro archivo referencia las clases eliminadas**

Run: `grep -rn "styles.footer\|styles.notifButton\|styles.themeSwitch\|styles.user\b\|styles.userButton\|styles.bubbleNotification\|classes.footer\|classes.notifButton\|classes.themeSwitch\|classes.user\b\|classes.userButton\|classes.bubbleNotification" src/`
Expected: sin resultados (todo el uso estaba solo en `Sidebar.tsx`, ya reemplazado en el Task 3).

- [ ] **Step 3: Build**

Run: `npx vite build`
Expected: build exitoso (CSS modules no rompen el build por clases no usadas, pero confirma que no hay una referencia rota).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Sidebar.module.css
git commit -m "chore(layout): remove orphaned CSS from Sidebar.module.css"
```

---

### Task 5: Verificación final de Parte A + revisión visual

- [ ] **Step 1: Verificación de proyecto completo**

Run: `npx tsc -b --force && npx vite build`
Expected: ambos exitosos, 0 errores.

- [ ] **Step 2: Levantar el dev server y pedir revisión visual al usuario**

Run: `npm run dev` (o confirmar que ya está corriendo)

Pedir al usuario que abra la app y confirme:
- El navbar aparece fijo arriba en desktop, con logo, buscador (inerte) y el cluster de notificaciones/tema/avatar a la derecha.
- El Sidebar ya no muestra nada al fondo (sin footer).
- En mobile, el header compacto muestra el mismo cluster a la derecha del logo.
- Notificaciones, cambio de tema y el menú de usuario (perfil/ayuda/cerrar sesión) siguen funcionando igual que antes.

No proceder a la Parte B hasta que el usuario confirme que esto se ve y funciona correctamente.

---

## Parte B — Sistema de tablas

### Task 6: Crear el componente `NameCell`

**Files:**
- Create: `frontend-adlone/src/components/ui/NameCell.tsx`

- [ ] **Step 1: Escribir el archivo completo**

```tsx
import React from 'react';
import { Avatar, Typography } from 'antd';

const { Text } = Typography;

interface NameCellProps {
    avatarText: string;
    title: string;
    subtitle?: string;
}

// Celda compuesta avatar+nombre(+subtítulo) para tablas que listan personas
// o entidades con nombre+identificador (email, código, RUT). El fondo del
// avatar es siempre neutro — en las tablas del sistema el color queda
// reservado exclusivamente para estado (ver StatusBadge), no para decorar
// filas por categoría.
export const NameCell: React.FC<NameCellProps> = ({ avatarText, title, subtitle }) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <Avatar
            size={32}
            style={{ backgroundColor: 'var(--app-hover-bg)', color: 'var(--app-text-secondary)', flexShrink: 0, fontSize: 12, fontWeight: 600 }}
        >
            {avatarText}
        </Avatar>
        <div style={{ minWidth: 0 }}>
            <Text strong style={{ fontSize: 13, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {title}
            </Text>
            {subtitle && (
                <Text type="secondary" style={{ fontSize: 12, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subtitle}
                </Text>
            )}
        </div>
    </div>
);
```

- [ ] **Step 2: Verificar tipos, lint, build**

Run: `npx tsc -b --force && npx eslint src/components/ui/NameCell.tsx && npx vite build`
Expected: todos exitosos, 0 errores.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/NameCell.tsx
git commit -m "feat(ui): add NameCell component for table avatar+name+subtitle pattern"
```

---

### Task 7: Aplicar `NameCell` en `UsersManagementPage.tsx` (caso de referencia)

**Files:**
- Modify: `frontend-adlone/src/features/admin/pages/UsersManagementPage.tsx`

Esta tabla hoy tiene 3 columnas separadas ("Usuario" con avatar+username, "Nombre Real" en texto plano, "Email" con ícono) — se consolidan en una sola columna "Usuario" con `NameCell`, igual al patrón nombre+email apilado de la referencia visual.

- [ ] **Step 1: Agregar el import**

En `frontend-adlone/src/features/admin/pages/UsersManagementPage.tsx`, agregar junto a los demás imports de componentes propios (cerca de `import { ConfirmModal } from '../../../components/common/ConfirmModal';`):

```tsx
import { NameCell } from '../../../components/ui/NameCell';
```

- [ ] **Step 2: Reemplazar las 3 columnas por 1**

Ubicar en `columns` (dentro del archivo) este bloque de 3 columnas:

```tsx
        {
            title: 'Usuario', key: 'usuario',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Avatar size="small" style={{ backgroundColor: 'var(--app-accent-bg)', color: '#0062a8' }}>
                        <IconUser size={14} />
                    </Avatar>
                    <Text strong style={{ fontSize: 13 }}>{user.nombre_usuario}</Text>
                </div>
            ),
        },
        { title: 'Nombre Real', key: 'nombre_real', render: (_: unknown, user: User) => <Text style={{ fontSize: 13 }}>{user.nombre_real}</Text> },
        { title: 'Cargo', key: 'cargo', render: (_: unknown, user: User) => <Text style={{ fontSize: 13 }}>{user.nombre_cargo || '-'}</Text> },
        {
            title: 'Roles', key: 'roles',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {user.roles?.map((rol, i) => <Tag key={i}>{rol}</Tag>)}
                </div>
            ),
        },
        {
            title: 'Email', key: 'email',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <IconMail size={14} color="gray" />
                    <Text style={{ fontSize: 12, color: '#1c7ed6' }}>{user.correo_electronico || '-'}</Text>
                </div>
            ),
        },
```

Reemplazarlo por (mismo orden relativo, ahora 3 columnas en vez de 5 — "Roles" y "Cargo" se mantienen igual, solo cambia el bloque de identidad):

```tsx
        {
            title: 'Usuario', key: 'usuario',
            render: (_: unknown, user: User) => (
                <NameCell
                    avatarText={(user.nombre_real || user.nombre_usuario || '?').charAt(0).toUpperCase()}
                    title={user.nombre_real || user.nombre_usuario}
                    subtitle={user.correo_electronico || `@${user.nombre_usuario}`}
                />
            ),
        },
        { title: 'Cargo', key: 'cargo', render: (_: unknown, user: User) => <Text style={{ fontSize: 13 }}>{user.nombre_cargo || '-'}</Text> },
        {
            title: 'Roles', key: 'roles',
            render: (_: unknown, user: User) => (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {user.roles?.map((rol, i) => <Tag key={i}>{rol}</Tag>)}
                </div>
            ),
        },
```

- [ ] **Step 3: Confirmar si `IconUser`/`IconMail` quedan sin uso en el archivo**

Run: `grep -n "IconUser\b\|IconMail" src/features/admin/pages/UsersManagementPage.tsx`

Si ambos siguen apareciendo en otras líneas (la vista de tarjetas móviles del mismo archivo también usa `IconUser` e `IconMail` — confirmado al escribir este plan, líneas ~454 y ~468 de la versión actual), no se toca el import. Si el grep muestra que ya no se usan en ningún otro lugar, quitarlos del import de `@tabler/icons-react` al inicio del archivo.

- [ ] **Step 4: Verificar tipos, lint, build**

Run: `npx tsc -b --force && npx eslint src/features/admin/pages/UsersManagementPage.tsx && npx vite build`
Expected: todos exitosos, 0 errores nuevos.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/pages/UsersManagementPage.tsx
git commit -m "refactor(admin): consolidate user identity columns into NameCell"
```

---

### Task 8: Barrer `Tag` con color decorativo en el resto del sistema

**Files:** determinados dinámicamente por el grep del Step 1 (no se conoce la lista completa de antemano — mismo enfoque de barrido sistemático que se usó para la migración Mantine→AntD).

- [ ] **Step 1: Encontrar todos los `Tag` con color explícito fuera de `StatusBadge.tsx`**

Run (desde `frontend-adlone/`):
```bash
grep -rn "Tag color=\|<Tag[^>]*color=" src/ --include="*.tsx" | grep -v "components/ui/StatusBadge.tsx"
```

Esto lista cada ocurrencia con archivo:línea:código. Guardar la lista completa antes de empezar a editar (para no perder ninguna).

- [ ] **Step 2: Clasificar cada ocurrencia — regla de decisión**

Para cada línea del resultado del Step 1, decidir:

- **Es ESTADO real** (activo/inactivo/habilitado/deshabilitado/pendiente/vencido/aprobado/rechazado/vigente/expirado, o cualquier campo que representa el ciclo de vida de un registro) → **se deja como está**, el color se mantiene. Ejemplos ya correctos que NO se tocan: `<Tag color={user.habilitado === 'S' ? 'green' : 'red'}>` en `UsersManagementPage.tsx`, cualquier uso de `StatusBadge`.
- **Es CATEGORÍA/TIPO/ROL/UBICACIÓN decorativa** (sin significado de estado — ej. tipo de equipo, sede, nombre de tabla maestra, rol de sistema mostrado como pill) → **se quita el prop `color`** (el `Tag` queda con el gris/negro neutro por defecto de Ant Design). Ejemplo de transformación:

Antes (ej. patrón visto en `MaestrosHub.tsx`):
```tsx
<Tag color={m.color === 'dark' ? 'default' : m.color} style={{ textTransform: 'none', fontFamily: 'monospace', fontSize: 10 }}>
    {m.tableName}
</Tag>
```

Después:
```tsx
<Tag style={{ textTransform: 'none', fontFamily: 'monospace', fontSize: 10 }}>
    {m.tableName}
</Tag>
```

Otro ejemplo (tags "relaciones"/"Jerárquico" en el mismo archivo):

Antes:
```tsx
{m.lookups && Object.keys(m.lookups).length > 0 && (
    <Tag color="blue">
        {Object.keys(m.lookups).length} relaci{Object.keys(m.lookups).length === 1 ? 'ón' : 'ones'}
    </Tag>
)}
{m.dependsOn && (
    <Tag color="orange">
        Jerárquico
    </Tag>
)}
```

Después:
```tsx
{m.lookups && Object.keys(m.lookups).length > 0 && (
    <Tag>
        {Object.keys(m.lookups).length} relaci{Object.keys(m.lookups).length === 1 ? 'ón' : 'ones'}
    </Tag>
)}
{m.dependsOn && (
    <Tag>
        Jerárquico
    </Tag>
)}
```

Si al quitar el `color` una variable/prop queda sin uso en ese archivo (ej. `m.color` ya no se lee en ningún otro lado de `MaestrosHub.tsx` — sí se sigue usando en `colorOf(m.color)` para el ícono de la card, así que en ese caso concreto la variable se mantiene; verificar caso por caso con grep antes de tocar la definición de datos).

- [ ] **Step 3: Aplicar la transformación archivo por archivo**

Ir uno por uno por cada archivo de la lista del Step 1, aplicando la regla del Step 2. Después de cada archivo, correr:

```bash
npx eslint <archivo-modificado>
```

y confirmar 0 errores nuevos antes de pasar al siguiente archivo.

- [ ] **Step 4: Verificación de proyecto completo**

Run: `npx tsc -b --force && npx vite build`
Expected: ambos exitosos, 0 errores.

- [ ] **Step 5: Confirmar que no queda ningún `Tag` decorativo con color fuera de `StatusBadge.tsx`**

Run:
```bash
grep -rn "Tag color=\|<Tag[^>]*color=" src/ --include="*.tsx" | grep -v "components/ui/StatusBadge.tsx"
```

Revisar manualmente cada resultado restante — a esta altura, cualquier resultado debe ser justificable como estado real (según la regla del Step 2), no categoría decorativa. Si alguno no lo es, corregirlo antes de continuar.

- [ ] **Step 6: Commit**

```bash
git add -A -- src/
git commit -m "refactor(ui): restrict Tag color to state semantics, neutral tags for categories"
```

(Si el barrido tocó muchos archivos y se prefiere un commit por archivo/grupo en vez de uno solo, está bien — usar el mismo mensaje base con el archivo específico en cada commit.)

---

### Task 9: Verificación final del proyecto + revisión visual

- [ ] **Step 1: Verificación completa**

Run: `npx tsc -b --force && npx vite build`
Expected: ambos exitosos, 0 errores.

- [ ] **Step 2: Confirmar que la spec quedó cubierta**

Repasar `docs/superpowers/specs/2026-09-14-navbar-global-y-tablas-design.md` sección por sección y confirmar que cada punto tiene una tarea correspondiente en este plan (Parte A → Tasks 1-5, Parte B → Tasks 6-8).

- [ ] **Step 3: Revisión visual del usuario**

Pedir al usuario que revise en la app corriendo (`npm run dev`):
- Que las tablas ya no muestren colores decorativos por categoría/rol/tipo, solo por estado real.
- Que la tabla de Usuarios muestre la columna combinada avatar+nombre+email.
- Que el navbar (Task 5) siga funcionando correctamente tras los cambios de esta parte.

No dar el trabajo por terminado hasta la confirmación del usuario.
