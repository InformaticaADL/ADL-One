import { create } from 'zustand';

interface NavState {
    activeModule: string;
    activeSubmodule: string;
    drawerOpen: boolean;
    setActiveModule: (moduleId: string) => void;
    setActiveSubmodule: (submoduleId: string) => void;
    setDrawerOpen: (isOpen: boolean) => void;
    resetNavigation: () => void; // Reset navigation state to defaults
}

export const useNavStore = create<NavState>((set) => ({
    activeModule: 'gem', // Default a GEM como se vio anteriormente, o 'dashboard'
    activeSubmodule: '',
    drawerOpen: false,
    setActiveModule: (moduleId) => set({ activeModule: moduleId }),
    setActiveSubmodule: (submoduleId) => set({ activeSubmodule: submoduleId, drawerOpen: false }), // Cerrar drawer autom. al seleccionar submódulo
    setDrawerOpen: (isOpen) => set({ drawerOpen: isOpen }),
    resetNavigation: () => set({ activeModule: 'gem', activeSubmodule: '', drawerOpen: false }), // Reset to defaults
}));

