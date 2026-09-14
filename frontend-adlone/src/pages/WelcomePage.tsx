import React, { useState } from 'react';
import { Typography, Tag, Button, Modal } from 'antd';
import { useToast } from '../contexts/ToastContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
    IconCalendarEvent,
    IconClock,
    IconPhone,
    IconChevronRight,
    IconDoorEnter
} from '@tabler/icons-react';

import fondoLogin from '../assets/images/fondo-login.png';

const { Text, Title } = Typography;

export const WelcomePage: React.FC = () => {
    const [openedEvent, setOpenedEvent] = useState(false);
    const [openedReport, setOpenedReport] = useState(false);
    const [openedSala, setOpenedSala] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [selectedSala, setSelectedSala] = useState<any>(null);
    const { showToast } = useToast();
    const isBannerFinished = false;
    const isNarrow = useMediaQuery('(max-width: 992px)');

    // Mock data for demonstration
    const upcomingEvents = [
        {
            id: 1,
            title: 'Reunión Semanal de Laboratorio',
            time: '14:00 - 15:30',
            date: 'Hoy',
            color: '#1c7ed6',
            description: 'Coordinación semanal de actividades, revisión de protocolos y gestión de insumos críticos para la operación de la unidad.',
            location: 'Sala de Conferencias B',
            organizer: 'Dirección Técnica',
            isFinished: false
        },

        {
            id: 2,
            title: 'Mantenimiento de Servidores',
            time: '22:00 - 02:00',
            date: 'Mañana',
            color: '#e8590c',
            description: 'Actualización programada de sistemas críticos y respaldos de base de datos. Se esperan intermitencias en servicios internos.',
            location: 'Centro de Datos / Remoto',
            organizer: 'Informática ADL',
            isFinished: false
        },

        {
            id: 3,
            title: 'Auditoría Interna ISO 9001',
            time: '09:00 - 18:00',
            date: '25 Mar',
            color: '#e03131',
            description: 'Revisión anual de procesos del sistema de gestión de calidad. Todos los departamentos deben tener su documentación al día.',
            location: 'Instalaciones Centrales',
            organizer: 'Calidad',
            isFinished: false
        },

    ];

    const salasReuniones = [
        {
            name: 'SALA DE REUNIONES',
            status: 'LIBRE',
            time: 'Disponible',
            color: '#2f9e44',
            nextBooking: '15:30 - Reunión Comercial',
            details: 'La sala se encuentra actualmente desocupada y disponible para su uso hasta las 15:30 hrs.'
        },
    ];

    const anexosInternos = [
        { ext: '11', name: 'SECRETARIA' },
        { ext: '12', name: 'GERENCIA GENERAL' },
        { ext: '13', name: 'GERENCIA ADMINISTRATIVA' },
        { ext: '14', name: 'ADQUISICIONES' },
        { ext: '18/22', name: 'OFIC. LABORATORIO' },
        { ext: '19', name: 'GEM' },
        { ext: '20', name: 'NECROPSIA' },
        { ext: '21', name: 'BACTERIOLOGIA' },
        { ext: '16', name: 'UNIDAD DE APOYO' },
        { ext: '17', name: 'INVESTIGACIÓN + D' },
        { ext: '22', name: 'MICRO' },
        { ext: '24', name: 'VIROLOGIA' },
        { ext: '24', name: 'CULTIVO CELULAR' },
        { ext: '25', name: 'BIOLOGIA MOLECULAR' },
        { ext: '23', name: 'VIGILANCIA EPI.' },
        { ext: '18', name: 'PROTEOMICA' },
    ];

    const contactosUtiles = [
        { name: 'SEDE PUERTO MONTT', phone: '+56 65 2250292' },
        { name: 'SEDE AYSEN', phone: '+56 67 2336130' },
        { name: 'SEDE VILLARICA', phone: '+56 9 42222123' },
        { name: 'SOPORTE TI', phone: '+56 9 57218268' },
    ];

    const handleEventClick = (event: any) => {
        if (event.isFinished) {
            showToast({ type: 'info', message: 'EVENTO FINALIZADO' });
            return;
        }
        setSelectedEvent(event);
        setOpenedEvent(true);
    };

    const handleReportClick = () => {
        if (isBannerFinished) {
            showToast({ type: 'info', message: 'INFORMACIÓN COMPLETADA' });
            return;
        }
        setOpenedReport(true);
    };

    const handleSalaClick = (sala: any) => {
        setSelectedSala(sala);
        setOpenedSala(true);
    };

    return (
        <div style={{ padding: 16, width: '100%', maxWidth: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {/* INFORMACION IMPORTANTE (Article Card Style - Login Inspired) */}
                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, overflow: 'hidden', position: 'relative', backgroundColor: 'var(--app-bg-elevated)' }}>
                    <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', alignItems: 'stretch', minHeight: 220 }}>

                        <div
                            style={{
                                width: isNarrow ? '100%' : '40%',
                                height: isNarrow ? 160 : 'auto',
                                position: 'relative',
                                backgroundImage: `url(${fondoLogin})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 20
                            }}
                        >
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.05)', zIndex: 1 }} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', zIndex: 2, width: '100%', padding: 20 }}>
                                <Text style={{ fontWeight: 300, fontSize: 16, textAlign: 'center', color: 'white', letterSpacing: 8, textTransform: 'lowercase', textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontStyle: 'italic' }}>
                                    información
                                </Text>
                                <div style={{ display: 'flex', gap: 4, flexWrap: 'nowrap' }}>
                                    <Text style={{ fontWeight: 900, fontSize: 32, color: 'white', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                        ADL
                                    </Text>
                                    <Text style={{ fontWeight: 400, fontSize: 32, color: '#ff922b', lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                        Diagnostic
                                    </Text>
                                </div>
                            </div>
                        </div>

                        <div style={{ padding: 24, flex: 1, backgroundColor: 'var(--app-bg-elevated)', position: 'relative', pointerEvents: 'none' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(220, 220, 220, 0.3)', backdropFilter: 'grayscale(100%) blur(2px)', zIndex: 10 }} />
                            {isBannerFinished && (
                                <div className="stamp-overlay-finalizado">FINALIZADO</div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <Tag color="orange">INFORMACIÓN IMPORTANTE</Tag>
                                <Text type="secondary" strong style={{ fontSize: 12 }}>20 MARZO, 2026</Text>
                            </div>
                            <Text strong style={{ fontSize: 20, display: 'block', marginBottom: 16, color: '#1864ab', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                                Comunicado Oficial: Cierre de Reportes GEM
                            </Text>
                            <Text type="secondary" style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 24, lineHeight: 1.6 }}>
                                Recuerden que hoy finaliza el plazo para la carga de informes mensuales de la unidad Ensayo Molecular.
                                Es fundamental asegurar que todos los correlativos estén al día para el cierre operativo.
                                Ante cualquier duda, contactar a la jefatura de área correspondiente.
                            </Text>
                            <div style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }} onClick={handleReportClick}>
                                <Text strong style={{ fontSize: 13, color: '#1c7ed6' }}>Leer reporte completo</Text>
                                <IconChevronRight size={18} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* PRÓXIMOS EVENTOS (Card Grid Style) */}
                <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'rgba(76,110,245,0.12)', color: '#4c6ef5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconCalendarEvent size={20} />
                        </div>
                        <Text strong style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Próximos Eventos</Text>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                        {upcomingEvents.map(event => (
                            <div
                                key={event.id}
                                style={{
                                    padding: 16,
                                    border: '1px solid var(--app-border)',
                                    borderRadius: 8,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    borderLeft: `5px solid ${event.color}`,
                                    position: 'relative',
                                    overflow: 'hidden',
                                    pointerEvents: 'none',
                                    backgroundColor: 'var(--app-bg-elevated)',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';
                                }}
                                onClick={() => handleEventClick(event)}
                            >
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(220, 220, 220, 0.3)', backdropFilter: 'grayscale(100%) blur(2px)', zIndex: 10 }} />
                                {event.isFinished && (
                                    <div className="stamp-overlay-finalizado event-card-stamp">FINALIZADO</div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Tag color={event.color}>{event.date}</Tag>
                                        <IconClock size={16} style={{ color: 'var(--app-text-secondary)' }} />
                                    </div>
                                    <div style={{ height: 40 }}>
                                        <Text strong style={{ fontSize: 13, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{event.title}</Text>
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                                        <Text strong style={{ fontSize: 12, color: event.color }}>{event.time}</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}> • Ver detalles</Text>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ height: 1.5, background: 'linear-gradient(to right, #0ea5e9, #6366f1)', borderRadius: 1, opacity: 0.1, margin: '5px 0' }} />

                {/* SECCIÓN INFERIOR: Listas Informativas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
                    <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--app-border)', backgroundColor: 'var(--app-hover-bg)', height: '100%' }}>
                        <Text strong style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: 0.6, color: '#1864ab', marginBottom: 16 }}>
                            <IconPhone size={14} /> ANEXOS INTERNOS
                        </Text>
                        <div style={{ height: 230, overflowY: 'auto' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {anexosInternos.map((item, idx) => (
                                    <div key={idx} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--app-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)', backgroundColor: 'var(--app-bg-elevated)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                            <Text strong style={{ fontSize: 11 }}>{item.name}</Text>
                                            <Text strong style={{ fontSize: 11, color: '#1864ab' }}>{item.ext}</Text>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--app-border)', backgroundColor: 'var(--app-bg-elevated)', height: '100%', position: 'relative', overflow: 'hidden', pointerEvents: 'none' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(220, 220, 220, 0.3)', backdropFilter: 'grayscale(100%) blur(2px)', zIndex: 10 }} />
                        <Text strong style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: 0.5, color: '#1864ab', marginBottom: 16 }}>
                            <IconDoorEnter size={16} /> ESTADO SALA DE REUNIONES
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {salasReuniones.map((sala, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSalaClick(sala)}
                                    style={{
                                        padding: 10, borderRadius: 6, border: '1px solid var(--app-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                                        borderLeft: `4px solid ${sala.color}`,
                                        cursor: 'pointer',
                                        backgroundColor: 'var(--app-bg-elevated)',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                        <div>
                                            <Text strong style={{ fontSize: 11, letterSpacing: 0.3, display: 'block' }}>{sala.name}</Text>
                                            <Text type="secondary" style={{ fontSize: 10 }}>{sala.time}</Text>
                                        </div>
                                        <Tag color={sala.color}>{sala.status}</Tag>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ padding: 16, borderRadius: 8, border: '1px solid var(--app-border)', backgroundColor: 'var(--app-hover-bg)', height: '100%' }}>
                        <Text strong style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: 0.5, color: '#1864ab', marginBottom: 16 }}>
                            SEDES Y SOPORTE
                        </Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {contactosUtiles.map((item, idx) => (
                                <div key={idx} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--app-border)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', backgroundColor: 'var(--app-bg-elevated)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Text strong style={{ fontSize: 11 }}>{item.name}</Text>
                                        <Text strong style={{ fontSize: 11, color: '#1864ab' }}>{item.phone}</Text>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{ height: 4, background: 'linear-gradient(to right, #0ea5e9, #6366f1)', borderRadius: 2, opacity: 0.2, marginTop: 20 }} />
            </div>

            {/* MODAL PARA EVENTOS */}
            <Modal
                open={openedEvent}
                onCancel={() => setOpenedEvent(false)}
                footer={null}
                centered
                title={<Text type="secondary" strong style={{ fontSize: 13, letterSpacing: 1 }}>DETALLE DEL EVENTO</Text>}
            >
                {selectedEvent && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                        <div>
                            <Tag color={selectedEvent.color} style={{ marginBottom: 8 }}>{selectedEvent.date}</Tag>
                            <Title level={3} style={{ margin: 0, color: '#1864ab', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                {selectedEvent.title}
                            </Title>
                        </div>

                        <div style={{ display: 'flex', gap: 32 }}>
                            <div>
                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>HORARIO</Text>
                                <Text strong style={{ fontSize: 13 }}>{selectedEvent.time}</Text>
                            </div>
                            <div>
                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>UBICACIÓN</Text>
                                <Text strong style={{ fontSize: 13 }}>{selectedEvent.location}</Text>
                            </div>
                        </div>

                        <div>
                            <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>DESCRIPCIÓN</Text>
                            <Text style={{ fontSize: 13, lineHeight: 1.6 }}>{selectedEvent.description}</Text>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                            <div>
                                <Text type="secondary" strong style={{ fontSize: 11, display: 'block' }}>ORGANIZA</Text>
                                <Text strong style={{ fontSize: 13, color: '#1c7ed6' }}>{selectedEvent.organizer}</Text>
                            </div>
                            <Button onClick={() => setOpenedEvent(false)}>Cerrar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* MODAL PARA REPORTE COMPLETO */}
            <Modal
                open={openedReport}
                onCancel={() => setOpenedReport(false)}
                footer={null}
                width={640}
                centered
                title={<Text type="secondary" strong style={{ fontSize: 13, letterSpacing: 1 }}>REPORTE OFICIAL</Text>}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                    <div>
                        <Title level={2} style={{ margin: 0, color: '#1864ab', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                            Cierre de Operaciones Mensuales: Unidad Ensayo Molecular
                        </Title>
                        <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginTop: 8 }}>Publicado el 20 de Marzo, 2026 • ADL Diagnostic</Text>
                    </div>

                    <Text style={{ fontSize: 13, lineHeight: 1.7 }}>
                        Se informa a todo el personal técnico y administrativo que el proceso de cierre para la unidad Ensayo Molecular correspondiente al presente mes se llevará a cabo el día de hoy.
                        <br /><br />
                        Este cierre es crítico para la facturación y el cumplimiento de los tiempos de entrega comprometidos con nuestros clientes.
                    </Text>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <Text strong style={{ fontSize: 11, color: '#1c7ed6', letterSpacing: 0.5 }}>PUNTOS CLAVE</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#1c7ed6' }} />
                                <Text strong style={{ fontSize: 13 }}>Carga total de informes antes de las 18:00 hrs.</Text>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#1c7ed6' }} />
                                <Text strong style={{ fontSize: 13 }}>Revisión de correlativos y estados en el sistema Área Técnica Local.</Text>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <div style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#1c7ed6' }} />
                                <Text strong style={{ fontSize: 13 }}>Validación de firmas digitales por supervisores.</Text>
                            </div>
                        </div>
                    </div>

                    <div style={{ padding: 16, borderRadius: 6, border: '1px solid var(--app-border)', backgroundColor: 'var(--app-accent-bg)' }}>
                        <Text strong style={{ fontSize: 12, color: '#1864ab' }}>
                            Soporte técnico estará disponible de manera prioritaria para resolver cualquier incidencia con la plataforma durante este periodo.
                        </Text>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button type="primary" onClick={() => setOpenedReport(false)}>Entendido</Button>
                    </div>
                </div>
            </Modal>

            {/* MODAL PARA SALA DE REUNIONES */}
            <Modal
                open={openedSala}
                onCancel={() => setOpenedSala(false)}
                footer={null}
                centered
                title={<Text type="secondary" strong style={{ fontSize: 13, letterSpacing: 1 }}>INFO. DE SALA</Text>}
            >
                {selectedSala && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 16 }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Title level={3} style={{ margin: 0, color: '#1864ab', letterSpacing: '-0.02em' }}>{selectedSala.name}</Title>
                                <Tag color={selectedSala.color}>{selectedSala.status}</Tag>
                            </div>
                        </div>

                        <div>
                            <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>DISPONIBILIDAD</Text>
                            <Text style={{ fontSize: 13, lineHeight: 1.6 }}>{selectedSala.details}</Text>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderTop: '1px solid var(--app-border)', borderBottom: '1px solid var(--app-border)' }}>
                            <Text type="secondary" strong style={{ fontSize: 11 }}>PRÓXIMA RESERVA</Text>
                            <Text strong style={{ fontSize: 12, color: '#1864ab' }}>{selectedSala.nextBooking}</Text>
                        </div>

                        <Button block onClick={() => setOpenedSala(false)}>Cerrar</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};
