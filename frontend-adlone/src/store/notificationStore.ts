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
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAsReadByRef: (idReferencia: number) => Promise<void>;
    addLocalNotification: (notification: any) => void;
    initSocket: (userId: number) => void;
    disconnectSocket: () => void;
}

let socket: Socket | null = null;

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],
    loading: false,

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

    addLocalNotification: (notification) => {
        set((state) => ({
            notifications: [notification, ...state.notifications]
        }));
    },

    initSocket: (userId: number) => {
        // Disconnect any existing socket before creating a new one (e.g. re-login with different user)
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        const baseUrl = API_CONFIG.getBaseURL();
        socket = io(baseUrl, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
        });

        socket.on('connect', () => {
            socket?.emit('join', userId);
        });

        socket.on('connect_error', (err) => {
            console.warn('[Socket] Connection error:', err.message);
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
    }
}));
