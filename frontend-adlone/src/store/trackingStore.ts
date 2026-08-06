import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import API_CONFIG from '../config/api.config';
import { trackingService, type JornadaHoy } from '../features/medio-ambiente/services/tracking.service';

interface PosicionActualizadaPayload {
    id_muestreador: number;
    id_jornada: number;
    lat: number;
    lon: number;
    timestamp: string;
}

interface TrackingState {
    jornadas: JornadaHoy[];
    loading: boolean;
    error: string | null;
    // Por id_muestreador, NO por id_jornada: id_jornada es "la jornada más
    // reciente de HOY" para ese muestreador (ver tracking.service.js), y
    // cambia de valor en cuanto pausa y reanuda — si la selección se
    // guardara por id_jornada, el próximo poll de 60s (HoyEnVivoPage.tsx) la
    // dejaría apuntando a un id que ya no existe en el snapshot, y el drawer
    // se veía vacío justo cuando el supervisor más quería ver el detalle
    // (el muestreador acaba de retomar la ruta).
    selectedMuestreadorId: number | null;
    fetchSnapshot: () => Promise<void>;
    connectSocket: (token: string) => void;
    disconnectSocket: () => void;
    selectMuestreador: (id: number | null) => void;
    reset: () => void;
}

// Conexión de socket privada de esta feature, igual al patrón ya usado en
// notificationStore.ts y ChatModule.tsx (cada feature abre la suya, no se
// comparte una única conexión global).
let socket: Socket | null = null;

export const useTrackingStore = create<TrackingState>((set) => ({
    jornadas: [],
    loading: false,
    error: null,
    selectedMuestreadorId: null,

    fetchSnapshot: async () => {
        set({ loading: true, error: null });
        try {
            const jornadas = await trackingService.getSnapshotHoy();
            set({ jornadas, loading: false });
        } catch (err) {
            console.error('Error fetching Hoy en Vivo snapshot:', err);
            set({ error: 'No se pudo cargar el estado de seguimiento.', loading: false });
        }
    },

    connectSocket: (token: string) => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        const baseUrl = API_CONFIG.getBaseURL();
        socket = io(baseUrl, {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
        });

        socket.on('connect', () => {
            socket?.emit('joinTracking');
        });

        socket.on('connect_error', (err) => {
            console.warn('[TrackingSocket] Connection error:', err.message);
        });

        socket.on('posicion_actualizada', (payload: PosicionActualizadaPayload) => {
            // Solo actualiza jornadas que YA están en el snapshot cargado. Si un
            // muestreador inicia su jornada DESPUÉS de que la pantalla ya cargó
            // el snapshot, no aparece al instante — pero HoyEnVivoPage.tsx
            // vuelve a pedir el snapshot completo cada 60s, así que como mucho
            // tarda ese margen en aparecer (no requiere refresco manual).
            set((state) => ({
                jornadas: state.jornadas.map((j) =>
                    j.id_jornada === payload.id_jornada
                        ? {
                            ...j,
                            ultima_posicion: {
                                latitud: payload.lat,
                                longitud: payload.lon,
                                timestamp_reporte: payload.timestamp,
                            },
                        }
                        : j
                ),
            }));
        });
    },

    disconnectSocket: () => {
        if (socket) {
            socket.emit('leaveTracking');
            socket.disconnect();
            socket = null;
        }
    },

    selectMuestreador: (id) => set({ selectedMuestreadorId: id }),

    reset: () => set({ jornadas: [], selectedMuestreadorId: null, error: null }),
}));
