import { create } from 'zustand';

// Las vistas de listado de fichas (Explorador, Asignación, Calendario) se
// desmontan por completo cada vez que fichasMode cambia a un detalle y se
// remontan limpias al volver — perdiendo cualquier filtro que viviera en un
// useState local. Estos filtros viven acá (fuera del ciclo de vida del
// componente) para que "volver" no obligue a re-filtrar desde cero.

export interface ExploradorFiltros {
    searchId: string;
    dateFrom: string;
    dateTo: string;
    searchEstado: string;
    searchTipo: string;
    searchEmpresaFacturar: string;
    searchEmpresaServicio: string;
    searchCentro: string;
    searchObjetivo: string;
    searchSubArea: string;
    searchUsuario: string;
}

export interface AsignacionFiltros {
    searchId: string;
    searchEstado: string | null;
    searchMonitoreo: string | null;
    searchEmpresaFacturar: string | null;
    searchEmpresaServicio: string | null;
    searchCentro: string | null;
    searchObjetivo: string | null;
    searchSubArea: string | null;
    dateFrom: string;
    dateTo: string;
}

export interface CalendarioFiltros {
    selectedEmpresa: string;
    selectedMuestreador: string;
    selectedCentro: string;
    searchTerm: string;
}

const exploradorDefaults: ExploradorFiltros = {
    searchId: '', dateFrom: '', dateTo: '', searchEstado: '', searchTipo: '',
    searchEmpresaFacturar: '', searchEmpresaServicio: '', searchCentro: '',
    searchObjetivo: '', searchSubArea: '', searchUsuario: '',
};

const asignacionDefaults: AsignacionFiltros = {
    searchId: '', searchEstado: null, searchMonitoreo: null, searchEmpresaFacturar: null,
    searchEmpresaServicio: null, searchCentro: null, searchObjetivo: null, searchSubArea: null,
    dateFrom: '', dateTo: '',
};

const calendarioDefaults: CalendarioFiltros = {
    selectedEmpresa: '', selectedMuestreador: '', selectedCentro: '', searchTerm: '',
};

interface FichasFiltersState {
    explorador: ExploradorFiltros;
    setExplorador: (patch: Partial<ExploradorFiltros>) => void;
    resetExplorador: () => void;

    asignacion: AsignacionFiltros;
    setAsignacion: (patch: Partial<AsignacionFiltros>) => void;
    resetAsignacion: () => void;

    calendario: CalendarioFiltros;
    setCalendario: (patch: Partial<CalendarioFiltros>) => void;
    resetCalendario: () => void;
}

export const useFichasFiltersStore = create<FichasFiltersState>()((set) => ({
    explorador: exploradorDefaults,
    setExplorador: (patch) => set((state) => ({ explorador: { ...state.explorador, ...patch } })),
    resetExplorador: () => set({ explorador: exploradorDefaults }),

    asignacion: asignacionDefaults,
    setAsignacion: (patch) => set((state) => ({ asignacion: { ...state.asignacion, ...patch } })),
    resetAsignacion: () => set({ asignacion: asignacionDefaults }),

    calendario: calendarioDefaults,
    setCalendario: (patch) => set((state) => ({ calendario: { ...state.calendario, ...patch } })),
    resetCalendario: () => set({ calendario: calendarioDefaults }),
}));
