import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavState {
    activeModule: string;
    activeSubmodule: string;
    previousSubmodule: string;
    drawerOpen: boolean;
    pendingRequestId: number | null; // For deep-linking from notifications
    selectedRequestId: number | null; // Phase 27
    ursInboxMode: 'RECEIVED' | 'SENT'; // Phase 27
    hiddenNotifications: string[]; // Persistent dismissed notifications
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setDrawerOpen: (isOpen: boolean) => void;
    setPendingRequestId: (id: number | null) => void;
    setSelectedRequestId: (id: number | null) => void;
    setUrsInboxMode: (mode: 'RECEIVED' | 'SENT') => void;
    sidebarCollapsed: boolean;
    setSidebarCollapsed: (isCollapsed: boolean) => void;
    toggleSidebar: () => void;
    resetNavigation: () => void; // Reset navigation state to defaults
    adminSearchTerm: string;
    setAdminSearchTerm: (term: string) => void;
    hideNotification: (id: string | number) => void;
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
            selectedRequestId: null,
            ursInboxMode: 'RECEIVED',
            hiddenNotifications: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
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
            setSelectedRequestId: (id) => set({ selectedRequestId: id }),
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
                ursInboxMode: 'RECEIVED',
                adminSearchTerm: '',
            }), // Reset to defaults
            adminSearchTerm: '',
            setAdminSearchTerm: (term: string) => set({ adminSearchTerm: term }),
        }),
        {
            name: 'adl-nav-storage', // nombre en localStorage
            partialize: (state) => ({
                activeModule: state.activeModule,
                activeSubmodule: state.activeSubmodule,
                previousSubmodule: state.previousSubmodule,
                sidebarCollapsed: state.sidebarCollapsed
            }), // Solo guardamos estas cuatro propiedades
        }
    )
);
