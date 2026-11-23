import React, { useState, useRef, useEffect } from 'react';
import { useNotificationStore } from '../../../store/notificationStore';
import type { Notification } from '../../../store/notificationStore';
import { useNavStore } from '../../../store/navStore';
import { esNotificacionSolicitudCliente } from '../utils/notificationNavigation';
import './GlobalNotificationHub.css';

const GlobalNotificationHub: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const { notifications, fetchNotifications, markAsRead } = useNotificationStore();
    const { setActiveModule, setActiveSubmodule, setPendingRequestId, setPendingSolicitudClienteId, setFirmaPendienteId, setPuestaMarchaPendienteId, setPmRecepcionEquipoId, selectedRequestId } = useNavStore();
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 10000); // Check every 10 seconds
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Phase 27: Auto-read notifications for the active request
    useEffect(() => {
        if (selectedRequestId) {
            const activeNotifs = notifications.filter(n => !n.leido && n.id_referencia === selectedRequestId);
            if (activeNotifs.length > 0) {
                activeNotifs.forEach(n => markAsRead(n.id_notificacion));
            }
        }
    }, [selectedRequestId, notifications, markAsRead]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleItemClick = async (notif: Notification) => {
        setIsOpen(false);
        await markAsRead(notif.id_notificacion);
        
        if (notif.id_referencia && esNotificacionSolicitudCliente(notif)) {
            setPendingSolicitudClienteId(notif.id_referencia);
            setActiveModule('solicitudes-clientes');
            setActiveSubmodule('');
            return;
        }

        // Firma pendiente de una ficha (o aviso de que ya firmaron todos): abre Solicitudes > Firmas pendientes.
        if (notif.id_referencia && notif.area === 'Firmas') {
            setFirmaPendienteId(notif.id_referencia);
            setActiveModule('solicitudes');
            setActiveSubmodule('');
            return;
        }

        // Puesta en marcha que me enviaron a firmar (o aviso de que ya firmó la otra parte): abre Gestión de
        // Calidad > Puesta en Marcha directo en esa puesta en marcha.
        if (notif.id_referencia && notif.area === 'PuestaMarcha') {
            setPuestaMarchaPendienteId(notif.id_referencia);
            setActiveModule('gestion_calidad');
            setActiveSubmodule('gc-puesta-marcha');
            return;
        }

        // Un muestreador recibió un equipo (ficha de entrega firmada): abre la Puesta en Marcha por recepción de ese
        // equipo (id_referencia = id del equipo), lista para registrarla.
        if (notif.id_referencia && notif.area === 'PuestaMarchaRecepcion') {
            setPmRecepcionEquipoId(notif.id_referencia);
            setActiveModule('gestion_calidad');
            setActiveSubmodule('gc-puesta-marcha');
            return;
        }

        if (notif.id_referencia) {
            setPendingRequestId(notif.id_referencia);
            
            if (notif.area === 'Chat') {
                setActiveModule('chat');
                setActiveSubmodule('');
                return;
            }

            const titulo = notif.titulo.toLowerCase();
            const mensaje = notif.mensaje.toLowerCase();
            
            if (titulo.includes('equipo') || mensaje.includes('equipo')) {
                setActiveModule('gestion_calidad');
                setActiveSubmodule('admin-equipos-gestion');
            } else if (titulo.includes('solicitud') || mensaje.includes('solicitud') || titulo.includes('urs')) {
                setActiveModule('solicitudes');
            }
        }
    };

    const unreadCount = notifications.filter((n: Notification) => 
        !n.leido && (!selectedRequestId || n.id_referencia !== selectedRequestId)
    ).length;

    // Animación de Toast ante cambios en el Polling (Optimizado: Detectar por ID máximo)
    const maxNotifIdRef = useRef<number>(0);

    useEffect(() => {
        if (notifications.length > 0) {
            const currentMaxId = Math.max(...notifications.map(n => Number(n.id_notificacion) || 0));
            
            // Si el ID máximo actual es mayor al anterior y ya teníamos un valor base (no es el primer load)
            if (currentMaxId > maxNotifIdRef.current && maxNotifIdRef.current > 0) {
                // Solo lo mostramos si el dropdown principal está cerrado
                if (!isOpen) { 
                    setShowToast(false); // reset animation
                    setTimeout(() => setShowToast(true), 10);
                    const timer = setTimeout(() => setShowToast(false), 4000);
                    return () => clearTimeout(timer);
                }
            }
            maxNotifIdRef.current = currentMaxId;
        }
    }, [notifications, isOpen]);

    return (
        <div className="notification-hub-container" ref={containerRef}>
            <button 
                className={`hub-bell-button ${unreadCount > 0 ? 'has-unread' : ''}`}
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Notificaciones"
            >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}
            </button>

            {/* Bubble Toast Animado Modal */}
            {showToast && !isOpen && (
                <div className="mini-bell-toast animate-bounce-in">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--sc-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        <circle cx="18" cy="6" r="3" fill="var(--sc-destructive)" stroke="white" strokeWidth="1"></circle>
                    </svg>
                    <span>¡Nueva notificación!</span>
                </div>
            )}

            {isOpen && (
                <div className="hub-dropdown animate-fade-in">
                    <div className="hub-header">
                        <h3>Notificaciones</h3>
                        {unreadCount > 0 && <span className="hub-count">{unreadCount} nuevas</span>}
                    </div>
                    <div className="hub-list">
                        {notifications.length === 0 ? (
                            <div className="hub-empty">
                                <p>No tienes notificaciones pendientes</p>
                            </div>
                        ) : (
                            notifications.map((notif: Notification) => (
                                <div 
                                    key={notif.id_notificacion} 
                                    className={`hub-item ${!notif.leido ? 'unread' : ''}`}
                                    onClick={() => handleItemClick(notif)}
                                >
                                    <div className="hub-item-icon">
                                        {notif.tipo === 'WARNING' ? '⚠️' : 
                                         notif.tipo === 'SUCCESS' ? '✅' : 
                                         notif.tipo === 'ERROR' ? '🚫' : 'ℹ️'}
                                    </div>
                                    <div className="hub-item-content">
                                        <div className="hub-item-title">{notif.titulo}</div>
                                        <div className="hub-item-message">{notif.mensaje}</div>
                                        <div className="hub-item-date">
                                            {notif.fecha ? (
                                                isNaN(new Date(notif.fecha).getTime()) ? 
                                                'Fecha desconocida' : 
                                                new Date(notif.fecha).toLocaleString([], { 
                                                    day: '2-digit', 
                                                    month: '2-digit', 
                                                    year: 'numeric', 
                                                    hour: '2-digit', 
                                                    minute: '2-digit' 
                                                })
                                            ) : 'Sin fecha'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="hub-footer">
                        <button onClick={() => { setActiveModule('solicitudes'); setActiveSubmodule(''); setIsOpen(false); }}>Ver todo el historial</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalNotificationHub;
