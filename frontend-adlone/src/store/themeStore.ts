import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark';

interface ThemeState {
    mode: ThemeMode;
    toggleMode: () => void;
    setMode: (mode: ThemeMode) => void;
}

// Preferencia de tema, compartida por Ant Design y Mantine (ver main.tsx) y
// por las hojas de estilo propias (index.css define --app-* para ambos modos).
export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            mode: 'light',
            toggleMode: () => set((state) => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
            setMode: (mode) => set({ mode }),
        }),
        { name: 'adl-theme-storage' }
    )
);
