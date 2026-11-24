import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavState {
    activeModule: string;
    activeSubmodule: string;
    previousSubmodule: string;
    drawerOpen: boolean;
    pendingRequestId: number | null; // For deep-linking from notifications
    // Solicitud aceptada que cambia un equipo: Gestión de Equipos abre sola la pantalla para aplicarla.
    aplicarSolicitudId: number | null;
    setAplicarSolicitudId: (id: number | null) => void;
    // Solicitud de firma de una ficha (Solicitudes > Firmas pendientes) a abrir al llegar desde una notificación.
    firmaPendienteId: number | null;
    setFirmaPendienteId: (id: number | null) => void;
    // Puesta en marcha que me enviaron a firmar: Gestión de Calidad > Puesta en Marcha la abre sola al llegar desde una notificación.
    puestaMarchaPendienteId: number | null;
    setPuestaMarchaPendienteId: (id: number | null) => void;
    // Equipo recién recibido por un muestreador (ficha de entrega firmada): Puesta en Marcha abre sola la nueva
    // puesta en marcha «por recepción» de ese equipo.
    pmRecepcionEquipoId: number | null;
    setPmRecepcionEquipoId: (id: number | null) => void;
    // KPI pulsado en el Dashboard de G.C. MAM: Inventario de Equipos abre el listado con ese filtro.
    equiposKpiPendiente: 'all' | 'activos' | 'vencidos' | 'por_vencer' | 'sin_asignar' | null;
    setEquiposKpiPendiente: (filtro: 'all' | 'activos' | 'vencidos' | 'por_vencer' | 'sin_asignar' | null) => void;
    pendingChatId: number | null; // For deep-linking to specific chat
    pendingQaCasoId: number | null; // Caso de quejas y apelaciones a abrir al llegar desde un aviso de plazo
    selectedRequestId: number | null; // Phase 27
    selectedFichaId: number | null;
    selectedCorrelativo: string | null;
    ursInboxMode: 'RECEIVED' | 'SENT'; // Phase 27
    hiddenNotifications: string[]; // Persistent dismissed notifications
    maArea: 'comercial' | 'tecnica' | 'coordinacion' | null; // Deprecated, will be removed fully in Phase 2
    fichasMode: 'menu' | 'create_ficha' | 'create_choice' | 'create_manual' | 'create_bulk' | 'list_fichas' | 'detail_ficha' | 'list_assign' | 'detail_assign' | 'calendar' | 'list_ejecutados' | 'dashboard' | 'kpi_dashboard' | 'route_planner' | 'route_planner_map' | 'manage_empresas';
    helpCenterOpen: boolean; // (heredado) ya no hay modal: pedir la ayuda lleva a Configuración > Ayuda
    helpCenterIsGlobal: boolean;
    setHelpCenterOpen: (open: boolean, isGlobal?: boolean) => void;
    // La Ayuda vive en Configuración. Al abrirla se guarda desde qué pantalla se pidió para mostrar la ayuda de ESA sección.
    helpContext: { module: string; submodule: string; fichasMode: string } | null;
    // Sección de Configuración a mostrar al entrar (la consume la página y la limpia).
    perfilSeccion: 'perfil' | 'cuenta' | 'apariencia' | 'notificaciones' | 'ayuda' | null;
    abrirAyuda: () => void;
    abrirConfiguracion: (seccion?: 'perfil' | 'cuenta' | 'apariencia' | 'notificaciones' | 'ayuda') => void;
    clearPerfilSeccion: () => void;
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setDrawerOpen: (isOpen: boolean) => void;
    setPendingRequestId: (id: number | null) => void;
    setPendingChatId: (id: number | null) => void;
    setPendingQaCasoId: (id: number | null) => void;
    setSelectedRequestId: (id: number | null) => void;
    setSelectedFicha: (id: number | null, correlativo: string | null) => void;
    // Cotización que originó la ficha que se está creando: el formulario la lee
    // para precargarse y para dejar la trazabilidad al guardar.
    cotizacionParaFicha: number | null;
    setCotizacionParaFicha: (id: number | null) => void;
    setUrsInboxMode: (mode: 'RECEIVED' | 'SENT') => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (isCollapsed: boolean) => void;
    toggleSidebar: () => void;
    resetNavigation: () => void; // Reset navigation state to defaults
    adminSearchTerm: string;
    setAdminSearchTerm: (term: string) => void;
    hideNotification: (id: string | number) => void;
    setMaArea: (area: 'comercial' | 'tecnica' | 'coordinacion' | null) => void;
    setFichasMode: (mode: 'menu' | 'create_ficha' | 'create_choice' | 'create_manual' | 'create_bulk' | 'list_fichas' | 'detail_ficha' | 'list_assign' | 'detail_assign' | 'calendar' | 'list_ejecutados' | 'dashboard' | 'kpi_dashboard' | 'route_planner' | 'route_planner_map' | 'manage_empresas') => void;
    dynamicModules: Record<string, unknown>[];
    setDynamicModules: (modules: Record<string, unknown>[]) => void;
    ursFilters: { searchTerm: string; status: string; area: string; type: string };
    setUrsFilters: (filters: Partial<{ searchTerm: string; status: string; area: string; type: string }>) => void;
    ursUnreadCount: number;
    setUrsUnreadCount: (count: number) => void;
    // Solicitudes de clientes pendientes de atender (contador de la barra lateral).
    // Tramo de ruta más allá del submódulo activo (p.ej. "Fichas de Ingreso >
    // Carga masiva"), publicado por el PageHeader de la vista actual — así la
    // barra de ruta persistente (RouteBreadcrumb) puede reflejar navegación
    // interna de una página que el store de módulo/submódulo no ve.
    pageBreadcrumb: { label: string; onClick?: () => void }[];
    setPageBreadcrumb: (items: { label: string; onClick?: () => void }[]) => void;
}

export const useNavStore = create<NavState>()(
    persist(
        (set) => ({
            activeModule: '', // Default a vacío para que muestre el dashboard general
            activeSubmodule: '',
            previousSubmodule: '',
            drawerOpen: false,
            sidebarCollapsed: false,
            pendingRequestId: null,
            aplicarSolicitudId: null,
            firmaPendienteId: null,
            puestaMarchaPendienteId: null,
            pmRecepcionEquipoId: null,
            equiposKpiPendiente: null,
            pendingChatId: null,
            pendingQaCasoId: null,
            selectedRequestId: null,
            selectedFichaId: null,
            selectedCorrelativo: null,
            cotizacionParaFicha: null,
            ursInboxMode: 'RECEIVED',
            hiddenNotifications: [],
            maArea: null,
            fichasMode: 'menu',
            helpCenterOpen: false,
            helpCenterIsGlobal: false,
            helpContext: null,
            perfilSeccion: null,
            // Compatibilidad: quien antes abría el modal ahora abre la página de Ayuda.
            setHelpCenterOpen: (open, isGlobal = false) => {
                if (open) useNavStore.getState().abrirAyuda();
                set({ helpCenterOpen: false, helpCenterIsGlobal: isGlobal });
            },
            abrirAyuda: () => set((state) => ({
                helpContext: state.activeModule === 'perfil'
                    ? state.helpContext
                    : { module: state.activeModule, submodule: state.activeSubmodule, fichasMode: state.fichasMode },
                perfilSeccion: 'ayuda',
                activeModule: 'perfil',
                activeSubmodule: '',
                drawerOpen: false,
            })),
            abrirConfiguracion: (seccion = 'perfil') => set({ perfilSeccion: seccion, activeModule: 'perfil', activeSubmodule: '', drawerOpen: false }),
            clearPerfilSeccion: () => set({ perfilSeccion: null }),
            setActiveModule: (moduleId) => set({ activeModule: moduleId }),
            setActiveSubmodule: (submoduleId) => set((state) => ({
                previousSubmodule: state.activeSubmodule !== submoduleId ? state.activeSubmodule : state.previousSubmodule,
                activeSubmodule: submoduleId,
                drawerOpen: false
            })), // Cerrar drawer autom. al seleccionar submódulo
            setDrawerOpen: (isOpen) => set({ drawerOpen: isOpen }),
            setSidebarCollapsed: (isCollapsed) => set({ sidebarCollapsed: isCollapsed }),
            toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
            setPendingRequestId: (id) => set({ pendingRequestId: id }),
            setAplicarSolicitudId: (id) => set({ aplicarSolicitudId: id }),
            setFirmaPendienteId: (id) => set({ firmaPendienteId: id }),
            setPuestaMarchaPendienteId: (id) => set({ puestaMarchaPendienteId: id }),
            setPmRecepcionEquipoId: (id) => set({ pmRecepcionEquipoId: id }),
            setEquiposKpiPendiente: (filtro) => set({ equiposKpiPendiente: filtro }),
            setPendingChatId: (id) => set({ pendingChatId: id }),
            setPendingQaCasoId: (id) => set({ pendingQaCasoId: id }),
            setSelectedRequestId: (id) => set({ selectedRequestId: id }),
            setSelectedFicha: (id, correlativo) => set({ selectedFichaId: id, selectedCorrelativo: correlativo }),
            setCotizacionParaFicha: (id) => set({ cotizacionParaFicha: id }),
            setUrsInboxMode: (mode) => set({ ursInboxMode: mode }),
            hideNotification: (id: string | number) => set((state) => {
                const idStr = String(id);
                if (state.hiddenNotifications.includes(idStr)) return state;
                return { hiddenNotifications: [...state.hiddenNotifications, idStr] };
            }),
            resetNavigation: () => set({
                activeModule: '',
                activeSubmodule: '',
                previousSubmodule: '',
                drawerOpen: false,
                sidebarCollapsed: false,
                pendingRequestId: null,
                selectedRequestId: null,
                selectedFichaId: null,
                selectedCorrelativo: null,
                cotizacionParaFicha: null,
                ursInboxMode: 'RECEIVED',
                adminSearchTerm: '',
                maArea: null,
                fichasMode: 'menu',
                pageBreadcrumb: [],
            }),
            adminSearchTerm: '',
            setAdminSearchTerm: (term: string) => set({ adminSearchTerm: term }),
            setMaArea: (area) => set({ maArea: area }),
            setFichasMode: (mode) => set({ fichasMode: mode }),
            dynamicModules: [],
            setDynamicModules: (modules) => set({ dynamicModules: modules }),
            ursFilters: { searchTerm: '', status: '', area: '', type: '' },
            setUrsFilters: (filters) => set((state) => ({ ursFilters: { ...state.ursFilters, ...filters } })),
            ursUnreadCount: 0,
            setUrsUnreadCount: (count) => set({ ursUnreadCount: count }),
            pageBreadcrumb: [],
            setPageBreadcrumb: (items) => set({ pageBreadcrumb: items }),
        }),
        {
            name: 'adl-nav-storage', // nombre en localStorage
            partialize: (state) => ({
                sidebarCollapsed: state.sidebarCollapsed,
                hiddenNotifications: state.hiddenNotifications,
                // Sobrevive a un F5: sin esto, recargar la página siempre
                // devolvía al dashboard general en vez de quedarse donde
                // estaba el usuario (no hay React Router / URL que lo
                // recuerde por su cuenta — toda la navegación vive acá).
                activeModule: state.activeModule,
                activeSubmodule: state.activeSubmodule,
                fichasMode: state.fichasMode,
                selectedFichaId: state.selectedFichaId,
                selectedCorrelativo: state.selectedCorrelativo,
                selectedRequestId: state.selectedRequestId,
            }),
        }
    )
);
