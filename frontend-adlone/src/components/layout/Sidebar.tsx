import { useState, useEffect } from 'react';
import {
    IconChevronRight,
    IconSelector,
    IconSettings,
    IconLogout,
} from '@tabler/icons-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNavStore } from '../../store/navStore';
import API_CONFIG from '../../config/api.config';
import axios from 'axios';
import { getIconComponent } from '../../config/iconRegistry';
import { FIXED_TOP_MODULES, hasAccess, canAccessModule, type DynamicModule, type DynamicModuleLink, type FixedModule } from '../../config/sidebarModules';
import { cn } from '@/lib/utils';
import { esAreaCalidad } from '../../features/admin/utils/areasRoles';
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
}

// ---- Piezas visuales del menú (medidas del «shadcn-admin») ---------------------------------------
// Botón de menú: alto 32 px, texto 14 px, ícono 16 px, gap 8 px, activo con el gris del menú.
const BOTON_MENU =
    'peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-start text-[0.875rem] leading-5 outline-none ' +
    'transition-[width,height,padding,background-color,color] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ' +
    'focus-visible:ring-2 focus-visible:ring-sidebar-ring active:bg-sidebar-accent active:text-sidebar-accent-foreground ' +
    'data-[state=open]:bg-sidebar-accent data-[active=true]:bg-primary/10 data-[active=true]:font-medium data-[active=true]:text-primary data-[active=true]:shadow-[inset_2px_0_0_var(--sc-mark)] ' +
    '[&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground data-[active=true]:[&>svg]:text-primary';

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
                'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 transition-[margin,opacity] duration-200 ease-linear',
                colapsado && '-mt-8 opacity-0'
            )}
        >
            {titulo}
        </div>
    );
}

const INSIGNIA = 'rounded-full px-1.5 py-0 text-[0.75rem]';

// Ver el efecto que fija el menú contraído por defecto en pantallas angostas.
let defaultAplicado = false;

export function Sidebar({ forceNotCollapsed, onNavigate }: SidebarProps) {
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
    // El menú de módulos se pide al servidor una vez por sesión: mientras llega se muestran líneas de relleno, en vez de que los grupos
    // «aparezcan» de golpe y empujen todo lo demás.
    const [menuCargando, setMenuCargando] = useState(() => !!token && dynamicModules.length === 0);
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
        // Solo la primera vez que se monta el menú en esta carga de la página: el menú se vuelve a montar al cambiar de modo (columna fija ↔ panel
        // flotante) y, sin esta guarda, volvía a cerrarse solo cada vez que el usuario lo abría.
        if (defaultAplicado) return;
        defaultAplicado = true;
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
            } finally {
                setMenuCargando(false);
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
            const isFernandoB = (user?.username || '').trim().toUpperCase() === 'FERNANDOB';
            const isInformatica = hasPermission('INF_ACCESO') || (user?.permissions || []).includes('INF_ACCESO');
            const canAccessHistorico = isFernandoB || isInformatica;

            const bmLinks: DynamicModuleLink[] = [
                { id: 'bm-consulta', label: 'Consulta de Muestras', permission: 'BM_ACCESO' }
            ];

            if (canAccessHistorico) {
                bmLinks.push({
                    id: 'bm-historico',
                    label: 'Biología Molecular Histórico'
                });
            }

            return {
                ...m,
                links: bmLinks
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
        // Elegir «Fichas de Ingreso» en el menú siempre abre el menú de la sección, nunca la ficha o el listado donde se había quedado.
        if (leafId === 'ma-fichas-ingreso') { const nav = useNavStore.getState(); nav.setFichasMode('menu'); nav.setSelectedFicha(null, null); }
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
    // Un módulo sin ningún enlace al que se pueda entrar (p. ej. Comercial, Informática) no lleva a nada: se oculta. Admin. Info no tiene
    // enlaces propios, pero su portada es un hub, así que se mantiene.
    const MODULOS_CON_PORTADA = new Set(['admin_informacion']);
    const tieneAlgoAdentro = (m: DynamicModule) => MODULOS_CON_PORTADA.has(m.id) || (m.links || []).some((l: DynamicModuleLink) => hasAccess(l.permission, hasPermission));
    const visibleModules = enrichedDynamicModules.filter((m) => canAccessModule(m, hasPermission) && tieneAlgoAdentro(m));

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
                    {isCollapsed && !!badgeCount && (
                        <span aria-label={`${badgeCount} pendientes`} className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[var(--sc-mark)]" />
                    )}
                    {!isCollapsed && !!badgeCount && (
                        <Badge variant="outline" className={INSIGNIA + ' border-transparent bg-[var(--sc-mark)] text-[#2b1600]'}>{badgeCount > 99 ? '99+' : badgeCount}</Badge>
                    )}
                </BotonMenu>
            </li>
        );
    };

    // Subcategorías fijas dentro de un módulo (hoy: G. Calidad → Medio Ambiente / Calidad / Laboratorio).
    // Un enlace sin subgrupo propio, o de un módulo que no está acá, sigue mostrándose en la lista plana de siempre.
    // Laboratorio (G.C. LAB) no se muestra por ahora: todavía no tiene submódulos. Su pantalla sigue en 'gc-hub-lab'.
    // Calidad (quejas y apelaciones) no tiene filas en mae_menu_link: se muestra solo al área de Gestión de
    // Calidad (e Informática), la misma regla con que el backend protege sus datos.
    const SUBGRUPOS_POR_MODULO: Record<string, string[]> = {
        gestion_calidad: ['Medio Ambiente', ...(esAreaCalidad(user?.roles) ? ['Calidad'] : [])],
    };
    // Cada subcategoría no lista sus enlaces en el árbol del sidebar: lleva a su propia pantalla con
    // tarjetas (una por submódulo), igual que los demás hubs de Admin. Información.
    const HUB_DESTINO_POR_SUBGRUPO: Record<string, Record<string, string>> = {
        gestion_calidad: { 'Medio Ambiente': 'gc-hub-mam', Calidad: 'gc-hub-cal', Laboratorio: 'gc-hub-lab' },
    };
    // Nombre que se muestra en el menú; el subgrupo guardado en mae_menu_link sigue siendo "Medio Ambiente" / "Laboratorio".
    const ETIQUETA_SUBGRUPO: Record<string, string> = { 'Medio Ambiente': 'G.C. MAM', Calidad: 'Calidad', Laboratorio: 'G.C. LAB' };

    const renderLinkItem = (moduleId: string, link: DynamicModuleLink, isOpen: boolean) => {
        const active = activeSubmodule === link.id && activeModule === moduleId;
        return (
            <li key={link.id}>
                <button
                    type="button"
                    tabIndex={isOpen ? 0 : -1}
                    data-active={active ? 'true' : undefined}
                    onClick={() => { setActiveModule(moduleId); handleLeafClick(link.id); }}
                    className="relative flex min-h-7 w-full min-w-0 data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:-left-[10px] data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary -translate-x-px items-center gap-2 rounded-md px-2 py-1 text-left text-[0.875rem] leading-5 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-[inset_2px_0_0_var(--sc-mark)]"
                >
                    <span>{link.label}</span>
                </button>
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
        forceOpen: boolean,
        subgrupos?: string[]
    ) => {
        const hasSubItems = filteredLinks.length > 0 || !!subgrupos?.length;
        const isOpen = isCollapsed ? false : (forceOpen || openedModule === id);
        const isActiveParent = activeModule === id;
        const padreActivo = isActiveParent && !activeSubmodule;

        // Sin subgrupos, exactamente como antes. Con ellos, el resto de los enlaces (si queda alguno sin
        // subgrupo asignado) se muestra primero, plano; cada subcategoría se muestra como un solo ítem que
        // lleva a su propia pantalla de tarjetas, no a una lista anidada de enlaces.
        const sinGrupo = subgrupos?.length ? filteredLinks.filter((l) => !l.subgrupo || !subgrupos.includes(l.subgrupo)) : filteredLinks;
        const destinoDe = (nombre: string) => HUB_DESTINO_POR_SUBGRUPO[id]?.[nombre];
        const irASubgrupo = (nombre: string) => {
            const destino = destinoDe(nombre);
            if (destino) { setActiveModule(id); handleLeafClick(destino); }
        };

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
                        {/* Al cerrarse el menú flotante, Radix devolvía el foco al ícono y su globo con el nombre del módulo (fondo negro) se quedaba pegado: no se devuelve el foco. */}
                        <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
                            <DropdownMenuLabel>{label}</DropdownMenuLabel>
                            <DropdownMenuItem onSelect={() => { setActiveModule(id); setActiveSubmodule(''); onNavigate?.(); }}>
                                Inicio de {label}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {subgrupos?.map((nombre) => (
                                <DropdownMenuItem
                                    key={nombre}
                                    className={activeSubmodule === destinoDe(nombre) ? 'bg-primary/10 font-medium text-primary shadow-[inset_2px_0_0_var(--sc-mark)]' : undefined}
                                    onSelect={() => irASubgrupo(nombre)}
                                >
                                    {ETIQUETA_SUBGRUPO[nombre] ?? nombre}
                                </DropdownMenuItem>
                            ))}
                            {sinGrupo.map((link) => {
                                const active = activeSubmodule === link.id;
                                return (
                                    <DropdownMenuItem
                                        key={link.id}
                                        className={active ? 'bg-primary/10 font-medium text-primary shadow-[inset_2px_0_0_var(--sc-mark)]' : undefined}
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
                        <ul className="mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-s border-sidebar-border/60 px-2.5 py-0.5">
                            {!subgrupos?.length && sinGrupo.map((link) => renderLinkItem(id, link, isOpen))}
                            {subgrupos?.map((nombre) => {
                                const active = activeSubmodule === destinoDe(nombre);
                                return (
                                    <li key={nombre}>
                                        <button
                                            type="button"
                                            tabIndex={isOpen ? 0 : -1}
                                            data-active={active ? 'true' : undefined}
                                            onClick={() => irASubgrupo(nombre)}
                                            className="relative flex min-h-7 w-full min-w-0 data-[active=true]:before:absolute data-[active=true]:before:inset-y-1 data-[active=true]:before:-left-[10px] data-[active=true]:before:w-0.5 data-[active=true]:before:rounded-full data-[active=true]:before:bg-primary -translate-x-px items-center gap-2 rounded-md px-2 py-1 text-left text-[0.875rem] leading-5 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[active=true]:bg-primary/10 data-[active=true]:text-primary data-[active=true]:shadow-[inset_2px_0_0_var(--sc-mark)]"
                                        >
                                            <span>{ETIQUETA_SUBGRUPO[nombre] ?? nombre}</span>
                                        </button>
                                    </li>
                                );
                            })}
                            {/* Con subcategorías, los enlaces directos del módulo (ej. Muestreadores) van después de ellas. */}
                            {!!subgrupos?.length && sinGrupo.map((link) => renderLinkItem(id, link, isOpen))}
                        </ul>
                    </Colapsable>
                )}
            </li>
        );
    };

    const renderDynamicModule = (mod: DynamicModule & { forceOpen?: boolean }) => {
        const filteredLinks = (mod.links || []).filter((link: DynamicModuleLink) => hasAccess(link.permission, hasPermission));
        return renderExpandableModule(mod.id, mod.label, getIconComponent(mod.icon), filteredLinks, !!mod.forceOpen, SUBGRUPOS_POR_MODULO[mod.id]);
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
                    className={cn(BOTON_MENU, 'h-12 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground', isCollapsed && 'size-12 justify-center p-0')}
                    aria-label="Menú de usuario"
                >
                    <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                        {user?.foto && <AvatarImage src={`${API_CONFIG.getBaseURL()}${user.foto}`} />}
                        <AvatarFallback className="rounded-lg bg-muted text-muted-foreground in-[.ui-neutral]:bg-primary in-[.ui-neutral]:text-primary-foreground">{user?.name?.charAt(0)}</AvatarFallback>
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
                        <AvatarFallback className="rounded-lg bg-muted text-muted-foreground in-[.ui-neutral]:bg-primary in-[.ui-neutral]:text-primary-foreground">{user?.name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate text-[0.875rem] font-semibold">{user?.name}</span>
                        <span className="truncate text-[0.75rem] text-muted-foreground">{user?.email || user?.cargo}</span>
                    </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => { useNavStore.getState().abrirConfiguracion('perfil'); onNavigate?.(); }}>
                    <IconSettings size={15} /> Configuración
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
                        className={cn(BOTON_MENU, 'h-14', isCollapsed && 'size-8 justify-center p-0')}
                    >
                        <img
                            src={isCollapsed ? logoSmall : logoAdl}
                            alt="ADL"
                            className={cn('shrink-0 object-contain', isCollapsed ? 'size-8' : 'h-11 w-auto')}
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
                    {menuCargando && unidades.length === 0 && gestionOp.length === 0 && (
                        <div className="flex w-full flex-col gap-1 p-2" aria-hidden="true">
                            {!isCollapsed && <div className="mb-1 h-4 w-16 animate-pulse rounded bg-sidebar-accent" />}
                            {[0, 1, 2, 3].map((i) => <div key={i} className={cn('h-8 animate-pulse rounded-md bg-sidebar-accent', isCollapsed ? 'w-8' : 'w-full')} />)}
                        </div>
                    )}
                    {renderGroup('Unidades', unidades.map(renderDynamicModule), unidades.length > 0)}
                    {renderGroup('Gestión', gestionOp.map(renderDynamicModule), gestionOp.length > 0)}
                    {renderGroup('Soporte', visibleBottom.map((m) => renderFlatItem(m)), visibleBottom.length > 0)}
                </div>

                <div className="flex flex-col gap-2 border-t border-sidebar-border p-2">
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
