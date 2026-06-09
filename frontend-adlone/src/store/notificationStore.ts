import { create } from 'zustand';
import { notificationService } from '../services/notification.service';
import { io, Socket } from 'socket.io-client';
import API_CONFIG from '../config/api.config';

export interface Notification {
    id_notificacion: number;
    id_usuario: number;
    titulo: string;
    mensaje: string;
    tipo: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    id_referencia: number | null;
    leido: boolean;
    area: string | null;
    fecha: string;
}

interface NotificationState {
    notifications: Notification[];
    loading: boolean;
    // X-10: estado de la conexión Socket.IO
    socketStatus: 'idle' | 'connecting' | 'connected' | 'disconnected';
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAsReadByRef: (idReferencia: number) => Promise<void>;
    markAllAsRead: () => Promise<void>;
    addLocalNotification: (notification: any) => void;
    initSocket: (userId: number, token: string) => void;
    disconnectSocket: () => void;
    reset: () => void;
}

let socket: Socket | null = null;

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    loading: false,
    socketStatus: 'idle',

    fetchNotifications: async () => {
        set({ loading: true });
        try {
            const data = await notificationService.getMyNotifications(false);
            set({ notifications: data, loading: false });
        } catch (error) {
            console.error('Error fetching notifications:', error);
            set({ loading: false });
        }
    },

    markAsRead: async (id: number) => {
        try {
            await notificationService.markAsRead(id);
            set((state) => ({
                notifications: state.notifications.map((n) => 
                    n.id_notificacion === id ? { ...n, leido: true } : n
                ),
            }));
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    },

    markAsReadByRef: async (idReferencia: number) => {
        try {
            await notificationService.markAsReadByRef(idReferencia);
            set((state) => ({
                notifications: state.notifications.map((n) =>
                    n.id_referencia === idReferencia ? { ...n, leido: true } : n
                ),
            }));
        } catch (error) {
            console.error('Error marking notifications as read by ref:', error);
        }
    },

    markAllAsRead: async () => {
        try {
            await notificationService.markAllAsRead();
            // N-04: aplicar cambio local de inmediato + refetch para garantizar consistencia con BD.
            set((state) => ({
                notifications: state.notifications.map((n) => ({ ...n, leido: true }))
            }));
            // Refetch defensivo en background (por si quedaron notificaciones nuevas llegando en paralelo)
            try {
                const fresh = await notificationService.getMyNotifications();
                set({ notifications: fresh || [] });
            } catch {
                // Ignorar — el cambio local ya está aplicado
            }
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    },

    addLocalNotification: (notification) => {
        set((state) => ({
            notifications: [notification, ...state.notifications]
        }));
    },

    initSocket: (userId: number, token: string) => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        set({ socketStatus: 'connecting' });
        const baseUrl = API_CONFIG.getBaseURL();
        socket = io(baseUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
            auth: { token },
        });

        socket.on('connect', () => {
            socket?.emit('join', userId);
            set({ socketStatus: 'connected' });
        });

        // X-10: detectar desconexión y reconexión
        socket.on('disconnect', (reason) => {
            console.warn('[Socket] Disconnected:', reason);
            set({ socketStatus: 'disconnected' });
        });

        socket.on('connect_error', (err) => {
            console.warn('[Socket] Connection error:', err.message);
            set({ socketStatus: 'disconnected' });
        });

        socket.on('reconnect', () => {
            set({ socketStatus: 'connected' });
        });

        socket.on('reconnect_attempt', () => {
            set({ socketStatus: 'connecting' });
        });

        socket.on('nuevaNotificacion', (notif) => {
            const mappedNotif = {
                ...notif,
                fecha: notif.fecha_creacion || new Date().toISOString(),
                leido: false
            };
            set((state) => ({
                notifications: [mappedNotif, ...state.notifications]
            }));
        });
    },

    disconnectSocket: () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        set({ socketStatus: 'idle' });
    },

    // Limpia notificaciones y cierra el socket. Se llama en logout para que el
    // siguiente usuario no vea notificaciones del anterior.
    reset: () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        set({ notifications: [], loading: false, socketStatus: 'idle' });
    }
}));
