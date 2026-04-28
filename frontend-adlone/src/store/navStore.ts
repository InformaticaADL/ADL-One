import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavState {
    activeModule: string;
    activeSubmodule: string;
    previousSubmodule: string;
    drawerOpen: boolean;
    pendingRequestId: number | null; // For deep-linking from notifications
    pendingChatId: number | null; // For deep-linking to specific chat
    selectedRequestId: number | null; // Phase 27
    selectedFichaId: number | null;
    selectedCorrelativo: string | null;
    ursInboxMode: 'RECEIVED' | 'SENT'; // Phase 27
    hiddenNotifications: string[]; // Persistent dismissed notifications
    maArea: 'comercial' | 'tecnica' | 'coordinacion' | null; // Deprecated, will be removed fully in Phase 2
    fichasMode: 'menu' | 'create_ficha' | 'create_choice' | 'create_manual' | 'create_bulk' | 'list_fichas' | 'detail_ficha' | 'list_assign' | 'detail_assign' | 'calendar' | 'list_ejecutados' | 'dashboard' | 'kpi_dashboard' | 'route_planner' | 'route_planner_map' | 'manage_empresas';
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setDrawerOpen: (isOpen: boolean) => void;
    setPendingRequestId: (id: number | null) => void;
    setPendingChatId: (id: number | null) => void;
    setSelectedRequestId: (id: number | null) => void;
    setSelectedFicha: (id: number | null, correlativo: string | null) => void;
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
}

const STORAGE_KEY = 'adl_hidden_notifications';

export const useNavStore = create<NavState>()(
    persist(
        (set) => ({
            activeModule: '', // Default a vacío para que muestre el dashboard general
            activeSubmodule: '',
            previousSubmodule: '',
            drawerOpen: false,
            sidebarCollapsed: false,
            pendingRequestId: null,
            pendingChatId: null,
            selectedRequestId: null,
            selectedFichaId: null,
            selectedCorrelativo: null,
            ursInboxMode: 'RECEIVED',
            hiddenNotifications: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
            maArea: null,
            fichasMode: 'menu',
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
            setPendingChatId: (id) => set({ pendingChatId: id }),
            setSelectedRequestId: (id) => set({ selectedRequestId: id }),
            setSelectedFicha: (id, correlativo) => set({ selectedFichaId: id, selectedCorrelativo: correlativo }),
            setUrsInboxMode: (mode) => set({ ursInboxMode: mode }),
            hideNotification: (id: string | number) => set((state) => {
                const idStr = String(id);
                const next = state.hiddenNotifications.includes(idStr)
                    ? state.hiddenNotifications
                    : [...state.hiddenNotifications, idStr];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return { hiddenNotifications: next };
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
                ursInboxMode: 'RECEIVED',
                adminSearchTerm: '',
                maArea: null,
                fichasMode: 'menu',
            }), // Reset to defaults
            adminSearchTerm: '',
            setAdminSearchTerm: (term: string) => set({ adminSearchTerm: term }),
            setMaArea: (area) => set({ maArea: area }),
            setFichasMode: (mode) => set({ fichasMode: mode }),
        }),
        {
            name: 'adl-nav-storage', // nombre en localStorage
            partialize: (state) => ({
                sidebarCollapsed: state.sidebarCollapsed
            }), // Solo guardamos sidebarCollapsed para que el inicio siempre sea limpio
        }
    )
);
