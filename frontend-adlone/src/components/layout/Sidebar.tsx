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

export function Sidebar({ forceNotCollapsed, onNavigate }: { forceNotCollapsed?: boolean, onNavigate?: () => void }) {
    const { hasPermission, token } = useAuth();
    const {
        activeModule,
        activeSubmodule,
        sidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        setActiveModule,
        setActiveSubmodule,
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
            setOpenedModule(activeModule);
        }
    }, [activeModule]);

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
            {/* En desktop el logo ya lo muestra TopBar arriba — este bloque solo
                conserva el botón de colapsar/expandir. En mobile (forceNotCollapsed)
                no hay concepto de colapsar, así que no se renderiza nada aquí. */}
            {!forceNotCollapsed && (
                <div className={classes.header}>
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'flex-end' }}>
                        <Tooltip title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}>
                            <button
                                onClick={toggleSidebar}
                                style={{
                                    border: 'none', background: 'transparent', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--app-text-secondary)', padding: 6, borderRadius: 6,
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
