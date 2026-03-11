import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface NavState {
    activeModule: string;
    activeSubmodule: string;
    previousSubmodule: string;
    drawerOpen: boolean;
    pendingRequestId: number | null; // For deep-linking from notifications
    hiddenNotifications: string[]; // Persistent dismissed notifications
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setDrawerOpen: (isOpen: boolean) => void;
    setPendingRequestId: (id: number | null) => void;
    hideNotification: (id: string | number) => void;
    resetNavigation: () => void; // Reset navigation state to defaults
}

const STORAGE_KEY = 'adl_hidden_notifications';

export const useNavStore = create<NavState>()(
    persist(
        (set) => ({
            activeModule: '', // Default a vacío para que muestre el dashboard general
            activeSubmodule: '',
            previousSubmodule: '',
            drawerOpen: false,
            pendingRequestId: null,
            hiddenNotifications: JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'),
            setActiveModule: (moduleId) => set({ activeModule: moduleId }),
            setActiveSubmodule: (submoduleId) => set((state) => ({
                previousSubmodule: state.activeSubmodule !== submoduleId ? state.activeSubmodule : state.previousSubmodule,
                activeSubmodule: submoduleId,
                drawerOpen: false
            })), // Cerrar drawer autom. al seleccionar submódulo
            setDrawerOpen: (isOpen) => set({ drawerOpen: isOpen }),
            setPendingRequestId: (id) => set({ pendingRequestId: id }),
            hideNotification: (id) => set((state) => {
                const idStr = String(id);
                const next = state.hiddenNotifications.includes(idStr)
                    ? state.hiddenNotifications
                    : [...state.hiddenNotifications, idStr];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                return { hiddenNotifications: next };
            }),
            resetNavigation: () => set({ activeModule: '', activeSubmodule: '', previousSubmodule: '', drawerOpen: false, pendingRequestId: null }), // Reset to defaults
        }),
        {
            name: 'adl-nav-storage', // nombre en localStorage
            partialize: (state) => ({
                activeModule: state.activeModule,
                activeSubmodule: state.activeSubmodule,
                previousSubmodule: state.previousSubmodule
            }), // Solo guardamos estas tres propiedades
        }
    )
);
