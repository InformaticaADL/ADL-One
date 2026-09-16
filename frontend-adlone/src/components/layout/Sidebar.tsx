import { useState, useEffect } from 'react';
import {
    IconChevronLeft,
    IconChevronRight,
    IconChevronDown,
    IconSearch,
    IconSelector,
    IconUserCircle,
    IconExclamationMark,
    IconLogout,
} from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import API_CONFIG from '../../config/api.config';
import axios from 'axios';
import { getIconComponent } from '../../config/iconRegistry';
import { FIXED_TOP_MODULES, type DynamicModule, type DynamicModuleLink, type FixedModule } from '../../config/sidebarModules';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import logoAdl from '../../assets/images/logo-adlone.png';
import logoSmall from '../../assets/images/logo-adlone-pequeño.png';

const FIXED_BOTTOM_MODULES: FixedModule[] = [];

function matches(label: string, q: string) {
    return !q || label.toLowerCase().includes(q.toLowerCase());
}

function hasAccess(permission: string | string[] | undefined, hasPermission: (p: string) => boolean) {
    if (!permission || permission.length === 0) return true;
    return Array.isArray(permission) ? permission.some(hasPermission) : hasPermission(permission);
}

interface SidebarProps {
    forceNotCollapsed?: boolean;
    onNavigate?: () => void;
    onHelpClick?: () => void;
}

export function Sidebar({ forceNotCollapsed, onNavigate, onHelpClick }: SidebarProps) {
    const { user, hasPermission, token, logout } = useAuth();
    const {
        activeModule,
        activeSubmodule,
        sidebarCollapsed,
        toggleSidebar,
        setSidebarCollapsed,
        setActiveModule,
        setActiveSubmodule,
        dynamicModules: rawDynamicModules,
        setDynamicModules,
        ursUnreadCount,
    } = useNavStore();
    const dynamicModules = rawDynamicModules as unknown as DynamicModule[];

    const isCollapsed = forceNotCollapsed ? false : sidebarCollapsed;
    const [openedModule, setOpenedModule] = useState<string | null>(activeModule);
    const [search, setSearch] = useState('');

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

    const canAccessModule = (module: DynamicModule) => {
        const hasBasePermission = hasAccess(module.permission, hasPermission);

        // Si tiene submódulos (links), OBLIGATORIAMENTE debe tener acceso a al menos uno para ver el módulo padre
        if (module.links && module.links.length > 0) {
            const canAccessAnyLink = module.links.some((link) => hasAccess(link.permission, hasPermission));
            // Para ver el módulo, debe cumplir el permiso base (si lo hay) Y tener acceso a un link
            return hasBasePermission && canAccessAnyLink;
        }

        return hasBasePermission;
    };

    const handleModuleClick = (moduleId: string) => {
        const mod = dynamicModules.find((m) => m.id === moduleId) || FIXED_TOP_MODULES.find((m) => m.id === moduleId);
        const hasSubItems = !!mod && 'links' in mod && Array.isArray(mod.links) && mod.links.length > 0;

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

    const handleLeafClick = (leafId: string) => {
        setActiveSubmodule(leafId);
        onNavigate?.();
    };

    const handleToggleGroup = (moduleId: string, hasSubItems: boolean) => {
        if (isCollapsed || !hasSubItems) {
            handleModuleClick(moduleId);
            return;
        }
        const next = openedModule === moduleId ? null : moduleId;
        setOpenedModule(next);
        if (next) handleModuleClick(next);
    };

    // Los módulos dinámicos ya vienen filtrados del backend según los permisos,
    // excepto si el usuario es admin o el backend los manda de más. Usamos canAccessModule por doble seguridad.
    const visibleModules = dynamicModules.filter(canAccessModule);

    // Unidades: Filtrar módulos visibles según permisos
    const unidades = visibleModules.filter((m) => m.group === 'unidades');

    // Gestión: Mostrar si el usuario tiene permiso para algún módulo de gestión
    const gestionOp = visibleModules.filter((m) => m.group === 'gestion');

    const visibleBottom = FIXED_BOTTOM_MODULES.filter((m) => !m.permission || hasPermission(m.permission));

    const visibleTop = FIXED_TOP_MODULES.filter((m) => !m.permission || hasPermission(m.permission));

    const q = search.trim();

    const filteredTop = visibleTop.filter((m) => matches(m.label, q));

    const filterGroup = (mods: DynamicModule[]): (DynamicModule & { forceOpen: boolean })[] => {
        if (!q) return mods.map((m) => ({ ...m, forceOpen: false }));
        const result: (DynamicModule & { forceOpen: boolean })[] = [];
        for (const m of mods) {
            const selfMatches = matches(m.label, q);
            const childMatches = (m.links || []).filter((l) => matches(l.label, q));
            if (!selfMatches && childMatches.length === 0) continue;
            result.push({ ...m, links: selfMatches ? m.links : childMatches, forceOpen: true });
        }
        return result;
    };

    const filteredUnidades = filterGroup(unidades);
    const filteredGestion = filterGroup(gestionOp);
    const filteredBottom = visibleBottom.filter((m) => matches(m.label, q));

    const renderFlatItem = (item: FixedModule, badgeCount?: number) => {
        const active = !activeSubmodule && activeModule === item.id;
        const Icon = item.icon;
        return (
            <button
                key={item.id}
                type="button"
                title={isCollapsed ? item.label : undefined}
                onClick={() => handleModuleClick(item.id)}
                className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    isCollapsed ? 'justify-center' : 'w-full',
                    active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                )}
            >
                <Icon size={18} stroke={1.75} className={cn('shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                {!isCollapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                {!isCollapsed && !!badgeCount && (
                    <Badge variant="destructive" className="px-1.5">{badgeCount > 99 ? '99+' : badgeCount}</Badge>
                )}
            </button>
        );
    };

    const renderDynamicModule = (mod: DynamicModule & { forceOpen?: boolean }) => {
        const filteredLinks = (mod.links || []).filter((link: DynamicModuleLink) => hasAccess(link.permission, hasPermission));
        const Icon = getIconComponent(mod.icon);
        const hasSubItems = filteredLinks.length > 0;
        const isOpen = isCollapsed ? false : (mod.forceOpen || openedModule === mod.id);
        const isActiveParent = activeModule === mod.id;

        return (
            <div key={mod.id}>
                <button
                    type="button"
                    title={isCollapsed ? mod.label : undefined}
                    onClick={() => handleToggleGroup(mod.id, hasSubItems)}
                    className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                        isCollapsed ? 'w-full justify-center' : 'w-full',
                        isActiveParent && !activeSubmodule ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                    )}
                >
                    <Icon size={18} stroke={1.75} className={cn('shrink-0', isActiveParent && !activeSubmodule ? 'text-primary' : 'text-muted-foreground')} />
                    {!isCollapsed && <span className="flex-1 truncate text-left">{mod.label}</span>}
                    {!isCollapsed && hasSubItems && (
                        <IconChevronDown size={14} className={cn('shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
                    )}
                </button>
                {!isCollapsed && hasSubItems && isOpen && (
                    <div className="ml-[13px] flex flex-col gap-0.5 border-l border-border py-1 pl-4">
                        {filteredLinks.map((link) => {
                            const active = activeSubmodule === link.id;
                            return (
                                <button
                                    key={link.id}
                                    type="button"
                                    onClick={() => handleLeafClick(link.id)}
                                    className={cn(
                                        'truncate rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                                        active ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    {link.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    const renderGroup = (title: string, mods: (DynamicModule & { forceOpen?: boolean })[]) => {
        if (mods.length === 0) return null;
        return (
            <div className="mb-3">
                {!isCollapsed && (
                    <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
                )}
                <div className="flex flex-col gap-0.5">
                    {mods.map(renderDynamicModule)}
                </div>
            </div>
        );
    };

    const renderFixedGroup = (title: string, mods: FixedModule[]) => {
        if (mods.length === 0) return null;
        return (
            <div className="mb-3">
                {!isCollapsed && (
                    <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
                )}
                <div className="flex flex-col gap-0.5">
                    {mods.map((m) => renderFlatItem(m))}
                </div>
            </div>
        );
    };

    const userMenu = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        'flex items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-muted',
                        isCollapsed ? 'w-full justify-center' : 'w-full'
                    )}
                >
                    <Avatar className="h-8 w-8 shrink-0">
                        {user?.foto && <AvatarImage src={`${API_CONFIG.getBaseURL()}${user.foto}`} />}
                        <AvatarFallback className="bg-muted text-muted-foreground">{user?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                        <>
                            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{user?.name}</p>
                            <IconSelector size={16} className="shrink-0 text-muted-foreground" />
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
                <DropdownMenuItem onSelect={() => { setActiveModule('perfil'); setActiveSubmodule(''); onNavigate?.(); }}>
                    <IconUserCircle size={15} /> Mi Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { onHelpClick?.(); onNavigate?.(); }}>
                    <IconExclamationMark size={15} /> Ayuda
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem danger onSelect={() => logout()}>
                    <IconLogout size={15} /> Cerrar sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return (
        <nav className="shadcn-scope flex h-full flex-col bg-sidebar text-sidebar-foreground">
            <div className={cn('h-16 shrink-0 border-b border-sidebar-border px-3', isCollapsed ? 'flex flex-col items-center justify-center gap-1' : 'flex items-center justify-between gap-2')}>
                <img
                    src={isCollapsed ? logoSmall : logoAdl}
                    alt="ADL"
                    className={cn('w-auto object-contain', isCollapsed ? 'h-7' : 'h-9')}
                />
                {!forceNotCollapsed && (
                    <button
                        onClick={toggleSidebar}
                        aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                        title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        {isCollapsed ? <IconChevronRight size={15} /> : <IconChevronLeft size={15} />}
                    </button>
                )}
            </div>

            {!isCollapsed && (
                <div className="px-3 pb-4 pt-4">
                    <div className="relative">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="h-8 border-transparent bg-muted pl-8 text-sm shadow-none focus-visible:border-border focus-visible:bg-background"
                        />
                    </div>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-2">
                <div className="mb-3 flex flex-col gap-0.5">
                    {filteredTop.map((item) => renderFlatItem(item, item.id === 'solicitudes' ? ursUnreadCount : undefined))}
                </div>
                {renderGroup('UNIDADES', filteredUnidades)}
                {renderGroup('GESTIÓN', filteredGestion)}
                {renderFixedGroup('SOPORTE', filteredBottom)}
            </div>

            <div className="border-t border-sidebar-border p-2">
                {userMenu}
            </div>
        </nav>
    );
}
