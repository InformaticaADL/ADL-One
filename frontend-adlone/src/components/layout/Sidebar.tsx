import { useState, useEffect } from 'react';
import {
    IconChevronRight,
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
import { FIXED_TOP_MODULES, hasAccess, canAccessModule, type DynamicModule, type DynamicModuleLink, type FixedModule } from '../../config/sidebarModules';
import { cn } from '@/lib/utils';
import { CommandMenu } from './CommandMenu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import logoAdl from '../../assets/images/logo-adlone.png';
import logoSmall from '../../assets/images/logo-adlone-pequeño.png';

const FIXED_BOTTOM_MODULES: FixedModule[] = [];

interface SidebarProps {
    forceNotCollapsed?: boolean;
    onNavigate?: () => void;
    onHelpClick?: () => void;
}

// ---- Piezas visuales del menú (medidas del «shadcn-admin») ---------------------------------------
// Botón de menú: alto 32 px, texto 14 px, ícono 16 px, gap 8 px, activo con el gris del menú.
const BOTON_MENU =
    'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-[0.875rem] leading-5 outline-none ' +
    'transition-[width,height,padding,background-color,color] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ' +
    'focus-visible:ring-2 focus-visible:ring-sidebar-ring active:bg-sidebar-accent active:text-sidebar-accent-foreground ' +
    'data-[state=open]:bg-sidebar-accent data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground ' +
    '[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0';

interface BotonMenuProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    activo?: boolean;
    colapsado?: boolean;
    grande?: boolean;
    /** Texto del tooltip cuando el menú está contraído. */
    etiqueta?: string;
}

function BotonMenu({ activo, colapsado, grande, etiqueta, className, ...props }: BotonMenuProps) {
    const boton = (
        <button
            type="button"
            data-active={activo ? 'true' : undefined}
            className={cn(BOTON_MENU, grande ? 'h-12' : 'h-8', colapsado && (grande ? 'size-12 p-0 justify-center' : 'size-8 justify-center'), className)}
            {...props}
        />
    );
    if (!colapsado || !etiqueta) return boton;
    return (
        <Tooltip>
            <TooltipTrigger asChild>{boton}</TooltipTrigger>
            <TooltipContent side="right" align="center">{etiqueta}</TooltipContent>
        </Tooltip>
    );
}

/** Contenedor que anima su alto al abrirse/cerrarse (300 ms). */
function Colapsable({ abierto, children }: { abierto: boolean; children: React.ReactNode }) {
    return (
        <div className="sb-collapse" data-open={abierto} aria-hidden={!abierto}>
            <div>{children}</div>
        </div>
    );
}

function EtiquetaGrupo({ titulo, colapsado }: { titulo: string; colapsado: boolean }) {
    return (
        <div
            className={cn(
                'flex h-8 shrink-0 items-center rounded-md px-2 text-[0.75rem] font-medium text-sidebar-foreground/70 transition-[margin,opacity] duration-200 ease-linear',
                colapsado && '-mt-8 opacity-0'
            )}
        >
            {titulo}
        </div>
    );
}

const INSIGNIA = 'rounded-full px-1.5 py-0 text-[0.75rem]';

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
        solicitudesClientePendientes,
    } = useNavStore();
    const dynamicModules = rawDynamicModules as unknown as DynamicModule[];

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

    const enrichedDynamicModules = dynamicModules.map((m) => {
        if (m.id === 'biologia_molecular') {
            return {
                ...m,
                links: [
                    { id: 'bm-consulta', label: 'Consulta de Muestras', permission: 'BM_ACCESO' }
                ]
            };
        }
        return m;
    });

    const handleModuleClick = (moduleId: string) => {
        setActiveModule(moduleId);
        setActiveSubmodule('');
        onNavigate?.();
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
        // Solo expande/contrae el árbol — solo navega si el módulo ya está activo
        // o si el usuario hace clic en un sub-ítem (handleLeafClick se encarga de eso)
        const next = openedModule === moduleId ? null : moduleId;
        setOpenedModule(next);
        // No llamar handleModuleClick: evita navegar al hacer clic en el chevron
    };

    // Los módulos dinámicos ya vienen filtrados del backend según los permisos,
    // excepto si el usuario es admin o el backend los manda de más. Usamos canAccessModule por doble seguridad.
    const visibleModules = enrichedDynamicModules.filter((m) => canAccessModule(m, hasPermission));

    // Unidades: Filtrar módulos visibles según permisos
    const unidades = visibleModules.filter((m) => m.group === 'unidades');

    // Gestión: Mostrar si el usuario tiene permiso para algún módulo de gestión
    const gestionOp = visibleModules.filter((m) => m.group === 'gestion');

    const visibleBottom = FIXED_BOTTOM_MODULES.filter((m) => !m.permission || hasPermission(m.permission));

    const visibleTop = FIXED_TOP_MODULES.filter((m) => !m.permission || hasPermission(m.permission));

    const renderFlatItem = (item: FixedModule, badgeCount?: number) => {
        const active = !activeSubmodule && activeModule === item.id;
        const Icon = item.icon;
        return (
            <li key={item.id} className="relative">
                <BotonMenu activo={active} colapsado={isCollapsed} etiqueta={item.label} onClick={() => handleModuleClick(item.id)}>
                    <Icon size={16} stroke={1.75} />
                    {!isCollapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                    {!isCollapsed && !!badgeCount && (
                        <Badge variant="destructive" className={INSIGNIA}>{badgeCount > 99 ? '99+' : badgeCount}</Badge>
                    )}
                </BotonMenu>
            </li>
        );
    };

    // Núcleo compartido por los módulos dinámicos (backend) y los fijos que
    // declaran `links` (ej. Facturación) — ambos son "grupo desplegable con
    // ítems", solo cambia de dónde sale el ícono ya resuelto.
    const renderExpandableModule = (
        id: string,
        label: string,
        Icon: ReturnType<typeof getIconComponent>,
        filteredLinks: DynamicModuleLink[],
        forceOpen: boolean
    ) => {
        const hasSubItems = filteredLinks.length > 0;
        const isOpen = isCollapsed ? false : (forceOpen || openedModule === id);
        const isActiveParent = activeModule === id;
        const padreActivo = isActiveParent && !activeSubmodule;

        // Contraído: no hay espacio para el árbol, así que las subopciones se
        // muestran en un menú flotante a la derecha del ícono.
        if (isCollapsed && hasSubItems) {
            return (
                <li key={id} className="relative">
                    <DropdownMenu>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        data-active={isActiveParent ? 'true' : undefined}
                                        aria-label={label}
                                        className={cn(BOTON_MENU, 'size-8 justify-center')}
                                    >
                                        <Icon size={16} stroke={1.75} />
                                    </button>
                                </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent side="right" align="center">{label}</TooltipContent>
                        </Tooltip>
                        <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56">
                            <DropdownMenuLabel>{label}</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => { setActiveModule(id); setActiveSubmodule(''); onNavigate?.(); }}>
                                Inicio de {label}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {filteredLinks.map((link) => {
                                const active = activeSubmodule === link.id;
                                return (
                                    <DropdownMenuItem
                                        key={link.id}
                                        className={active ? 'bg-sidebar-accent font-medium' : undefined}
                                        onSelect={() => {
                                            if (activeModule !== id) setActiveModule(id);
                                            handleLeafClick(link.id);
                                        }}
                                    >
                                        {link.label}
                                    </DropdownMenuItem>
                                );
                            })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </li>
            );
        }

        return (
            <li key={id} className="group/collapsible relative">
                <BotonMenu
                    activo={padreActivo}
                    colapsado={isCollapsed}
                    etiqueta={label}
                    aria-expanded={hasSubItems ? isOpen : undefined}
                    onClick={() => handleToggleGroup(id, hasSubItems)}
                >
                    <Icon size={16} stroke={1.75} />
                    {!isCollapsed && <span className="flex-1 truncate text-left">{label}</span>}
                    {!isCollapsed && hasSubItems && (
                        <IconChevronRight size={16} className={cn('ms-auto shrink-0 transition-transform duration-200', isOpen && 'rotate-90')} />
                    )}
                </BotonMenu>
                {!isCollapsed && hasSubItems && (
                    <Colapsable abierto={isOpen}>
                        <ul className="mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-s border-sidebar-border px-2.5 py-0.5">
                            {filteredLinks.map((link) => {
                                const active = activeSubmodule === link.id && activeModule === id;
                                return (
                                    <li key={link.id}>
                                        <button
                                            type="button"
                                            tabIndex={isOpen ? 0 : -1}
                                            data-active={active ? 'true' : undefined}
                                            onClick={() => { setActiveModule(id); handleLeafClick(link.id); }}
                                            className="flex min-h-7 w-full min-w-0 -translate-x-px items-center gap-2 rounded-md px-2 py-1 text-left text-[0.875rem] leading-5 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground"
                                        >
                                            <span>{link.label}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </Colapsable>
                )}
            </li>
        );
    };

    const renderDynamicModule = (mod: DynamicModule & { forceOpen?: boolean }) => {
        const filteredLinks = (mod.links || []).filter((link: DynamicModuleLink) => hasAccess(link.permission, hasPermission));
        return renderExpandableModule(mod.id, mod.label, getIconComponent(mod.icon), filteredLinks, !!mod.forceOpen);
    };

    const renderFixedItem = (item: FixedModule & { forceOpen?: boolean }, badgeCount?: number) => {
        if (!item.links || item.links.length === 0) return renderFlatItem(item, badgeCount);
        const filteredLinks = item.links.filter((link) => hasAccess(link.permission, hasPermission));
        return renderExpandableModule(item.id, item.label, item.icon, filteredLinks, !!item.forceOpen);
    };

    const renderGroup = (title: string, items: React.ReactNode[], hasItems: boolean) => {
        if (!hasItems) return null;
        return (
            <div className="relative flex w-full min-w-0 flex-col p-2">
                <EtiquetaGrupo titulo={title} colapsado={isCollapsed} />
                <ul className="flex w-full min-w-0 flex-col gap-1">{items}</ul>
            </div>
        );
    };

    const userMenu = (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className={cn(BOTON_MENU, 'h-12', isCollapsed && 'size-12 justify-center p-0')}
                    aria-label="Menú de usuario"
                >
                    <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                        {user?.foto && <AvatarImage src={`${API_CONFIG.getBaseURL()}${user.foto}`} />}
                        <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">{user?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {!isCollapsed && (
                        <>
                            <div className="grid min-w-0 flex-1 text-start leading-tight">
                                <span className="truncate font-semibold">{user?.name}</span>
                                <span className="truncate text-[0.75rem] text-sidebar-foreground/70">{user?.cargo || user?.email}</span>
                            </div>
                            <IconSelector size={16} className="ms-auto shrink-0" />
                        </>
                    )}
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side={forceNotCollapsed ? 'top' : 'right'} sideOffset={4} className="w-56 min-w-56 rounded-lg">
                <div className="flex items-center gap-2 px-1.5 py-1.5 text-start">
                    <Avatar className="h-8 w-8 rounded-lg">
                        {user?.foto && <AvatarImage src={`${API_CONFIG.getBaseURL()}${user.foto}`} />}
                        <AvatarFallback className="rounded-lg bg-muted text-muted-foreground">{user?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate text-[0.875rem] font-semibold">{user?.name}</span>
                        <span className="truncate text-[0.75rem] text-muted-foreground">{user?.email || user?.cargo}</span>
                    </div>
                </div>
                <DropdownMenuSeparator />
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
        <TooltipProvider delayDuration={0}>
            <nav className="shadcn-scope relative flex h-full min-h-0 w-full flex-col bg-sidebar text-sidebar-foreground">
                <div className="flex flex-col gap-2 p-2">
                    <button
                        type="button"
                        title="Ir al inicio"
                        onClick={() => { setActiveModule('inicio'); setActiveSubmodule(''); onNavigate?.(); }}
                        className={cn(BOTON_MENU, 'h-12', isCollapsed && 'size-12 justify-center p-0')}
                    >
                        <img
                            src={isCollapsed ? logoSmall : logoAdl}
                            alt="ADL"
                            className={cn('w-auto shrink-0 object-contain', isCollapsed ? 'h-7' : 'h-8')}
                        />
                    </button>
                    <div className={cn(isCollapsed && 'flex justify-center')}>
                        <CommandMenu isCollapsed={isCollapsed} onNavigate={onNavigate} />
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-y-auto overflow-x-hidden">
                    {renderGroup(
                        'Principal',
                        visibleTop.map((item) => renderFixedItem(item, item.id === 'solicitudes' ? ursUnreadCount : item.id === 'solicitudes-clientes' ? solicitudesClientePendientes : undefined)),
                        visibleTop.length > 0
                    )}
                    {renderGroup('Unidades', unidades.map(renderDynamicModule), unidades.length > 0)}
                    {renderGroup('Gestión', gestionOp.map(renderDynamicModule), gestionOp.length > 0)}
                    {renderGroup('Soporte', visibleBottom.map((m) => renderFlatItem(m)), visibleBottom.length > 0)}
                </div>

                <div className="flex flex-col gap-2 p-2">
                    {userMenu}
                </div>

                {!forceNotCollapsed && (
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        aria-label={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                        title={isCollapsed ? 'Expandir menú' : 'Contraer menú'}
                        tabIndex={-1}
                        className={cn(
                            'absolute inset-y-0 -right-2 z-20 hidden w-4 translate-x-0 transition-all ease-linear sm:flex',
                            'after:absolute after:inset-y-0 after:left-1/2 after:w-0.5 hover:after:bg-sidebar-border',
                            isCollapsed ? 'cursor-e-resize' : 'cursor-w-resize'
                        )}
                    />
                )}
            </nav>
        </TooltipProvider>
    );
}
