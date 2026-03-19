import React, { useEffect } from 'react';
import { useToast } from '../contexts/ToastContext';
import { Bell } from 'lucide-react';

/**
 * NotificationListener
 * Este componente se puede montar en el MainLayout para escuchar eventos de sockets
 * y disparar los Toasts globales con estética Architecture 3.0.
 */
export const NotificationListener: React.FC = () => {
    const { showToast } = useToast();

    useEffect(() => {
        // Ejemplo: Simulación de conexión a WebSocket
        // En una implementación real usaríamos socket.io-client o similar.
        
        const handleNewNotification = (data: any) => {
            showToast({
                type: 'info',
                duration: 6000,
                message: (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                            width: '40px', 
                            height: '40px', 
                            borderRadius: '50%', 
                            backgroundColor: '#eff6ff', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            color: '#3b82f6'
                        }}>
                            <Bell size={20} className="bell-animation" />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                                {data.titulo || 'Nueva Notificación'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                                {data.mensaje || 'Ha recibido un nuevo aviso en el sistema.'}
                            </div>
                        </div>
                        <button 
                            onClick={() => window.location.hash = '/notifications'} // Ejemplo de navegación
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#1d4ed8',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Ver ahora
                        </button>
                    </div>
                ) as any // Cast explicit to string because ToastContext expects string, but we can update it or use double casting
            });
        };

        // Simular una notificación a los 5 segundos para demo
        const timer = setTimeout(() => {
            handleNewNotification({
                titulo: "Ficha Aprobada Técnica",
                mensaje: "La ficha #6784 ha sido aprobada por el área de Coordinación."
            });
        }, 5000);

        return () => clearTimeout(timer);
    }, [showToast]);

    return (
        <style>{`
            .bell-animation {
                animation: bell-ring 2s infinite ease;
            }
            @keyframes bell-ring {
                0%, 100% { transform: rotate(0); }
                10%, 30%, 50%, 70% { transform: rotate(15deg); }
                20%, 40%, 60%, 80% { transform: rotate(-15deg); }
            }
        `}</style>
    );
};
