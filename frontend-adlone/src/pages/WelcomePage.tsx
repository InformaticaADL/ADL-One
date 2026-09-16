import React, { useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import {
    IconCalendarEvent,
    IconClock,
    IconPhone,
    IconChevronRight,
    IconDoorEnter
} from '@tabler/icons-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import fondoLogin from '../assets/images/fondo-login.png';

interface EventItem {
    id: number;
    title: string;
    time: string;
    date: string;
    color: string;
    description: string;
    location: string;
    organizer: string;
    isFinished: boolean;
}

interface SalaItem {
    name: string;
    status: string;
    time: string;
    color: string;
    nextBooking: string;
    details: string;
}

export const WelcomePage: React.FC = () => {
    const [openedEvent, setOpenedEvent] = useState(false);
    const [openedReport, setOpenedReport] = useState(false);
    const [openedSala, setOpenedSala] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
    const [selectedSala, setSelectedSala] = useState<SalaItem | null>(null);
    const { showToast } = useToast();
    const isBannerFinished = false;
    const isNarrow = useMediaQuery('(max-width: 992px)');

    // Mock data for demonstration
    const upcomingEvents: EventItem[] = [
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

    const salasReuniones: SalaItem[] = [
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

    const handleEventClick = (event: EventItem) => {
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

    const handleSalaClick = (sala: SalaItem) => {
        setSelectedSala(sala);
        setOpenedSala(true);
    };

    return (
        <div className="shadcn-scope w-full max-w-full p-4">
            <div className="flex flex-col gap-6">
                {/* INFORMACION IMPORTANTE (Article Card Style - Login Inspired) */}
                <div className="relative overflow-hidden rounded-lg border border-border bg-card">
                    <div className={cn('flex items-stretch', isNarrow ? 'flex-col' : 'flex-row', 'min-h-[220px]')}>

                        <div
                            className={cn('relative flex items-center justify-center bg-cover bg-center p-5', isNarrow ? 'h-40 w-full' : 'w-2/5')}
                            style={{ backgroundImage: `url(${fondoLogin})` }}
                        >
                            <div className="absolute inset-0 z-[1] bg-black/5" />

                            <div className="relative z-[2] flex w-full flex-col items-center gap-1 p-5">
                                <span className="text-center text-base italic font-light uppercase tracking-[8px] text-white [text-shadow:0_2px_4px_rgba(0,0,0,0.5)]">
                                    información
                                </span>
                                <div className="flex flex-nowrap gap-1">
                                    <span className="text-[32px] font-black leading-none tracking-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
                                        ADL
                                    </span>
                                    <span className="text-[32px] font-normal leading-none tracking-tight text-[#ff922b] [text-shadow:0_2px_8px_rgba(0,0,0,0.4)]">
                                        Diagnostic
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="pointer-events-none relative flex-1 bg-card p-6">
                            <div className="absolute inset-0 z-10 bg-black/[0.06] backdrop-blur-[2px] grayscale" />
                            {isBannerFinished && (
                                <div className="stamp-overlay-finalizado">FINALIZADO</div>
                            )}

                            <div className="mb-2 flex justify-between">
                                <Badge className="bg-warning/15 text-warning">INFORMACIÓN IMPORTANTE</Badge>
                                <span className="text-xs font-semibold text-muted-foreground">20 MARZO, 2026</span>
                            </div>
                            <p className="mb-4 text-xl font-bold leading-tight tracking-tight text-primary">
                                Comunicado Oficial: Cierre de Reportes GEM
                            </p>
                            <p className="mb-6 line-clamp-3 text-[13px] leading-relaxed text-muted-foreground">
                                Recuerden que hoy finaliza el plazo para la carga de informes mensuales de la unidad Ensayo Molecular.
                                Es fundamental asegurar que todos los correlativos estén al día para el cierre operativo.
                                Ante cualquier duda, contactar a la jefatura de área correspondiente.
                            </p>
                            <div className="flex cursor-pointer items-center gap-1" onClick={handleReportClick}>
                                <span className="text-[13px] font-semibold text-primary">Leer reporte completo</span>
                                <IconChevronRight size={18} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* PRÓXIMOS EVENTOS (Card Grid Style) */}
                <div>
                    <div className="mb-4 flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <IconCalendarEvent size={20} />
                        </div>
                        <span className="font-semibold uppercase tracking-wide text-foreground">Próximos Eventos</span>
                    </div>

                    <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                        {upcomingEvents.map(event => (
                            <Card
                                key={event.id}
                                className="relative cursor-pointer overflow-hidden p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                                style={{ borderLeft: `5px solid ${event.color}` }}
                                onClick={() => handleEventClick(event)}
                            >
                                <div className="pointer-events-none absolute inset-0 z-10 bg-black/[0.06] backdrop-blur-[2px] grayscale" />
                                {event.isFinished && (
                                    <div className="stamp-overlay-finalizado event-card-stamp">FINALIZADO</div>
                                )}
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between">
                                        <Badge style={{ backgroundColor: `${event.color}22`, color: event.color }}>{event.date}</Badge>
                                        <IconClock size={16} className="text-muted-foreground" />
                                    </div>
                                    <div className="h-10">
                                        <p className="line-clamp-2 text-[13px] font-semibold text-foreground">{event.title}</p>
                                    </div>
                                    <div className="mt-2 flex gap-1">
                                        <span className="text-xs font-semibold" style={{ color: event.color }}>{event.time}</span>
                                        <span className="text-xs text-muted-foreground"> • Ver detalles</span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

                <div className="my-1 h-[1.5px] rounded-sm bg-gradient-to-r from-sky-500 to-indigo-500 opacity-10" />

                {/* SECCIÓN INFERIOR: Listas Informativas */}
                <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                    <Card className="h-full bg-muted/40 p-4">
                        <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-wide text-primary">
                            <IconPhone size={14} /> ANEXOS INTERNOS
                        </p>
                        <div className="h-[230px] overflow-y-auto">
                            <div className="flex flex-col gap-2">
                                {anexosInternos.map((item, idx) => (
                                    <div key={idx} className="rounded-md border border-border bg-card p-2 shadow-sm">
                                        <div className="flex flex-nowrap justify-between">
                                            <span className="text-[11px] font-semibold text-foreground">{item.name}</span>
                                            <span className="text-[11px] font-semibold text-primary">{item.ext}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>

                    <Card className="relative h-full overflow-hidden p-4">
                        <div className="pointer-events-none absolute inset-0 z-10 bg-black/[0.06] backdrop-blur-[2px] grayscale" />
                        <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-wide text-primary">
                            <IconDoorEnter size={16} /> ESTADO SALA DE REUNIONES
                        </p>
                        <div className="flex flex-col gap-2">
                            {salasReuniones.map((sala, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSalaClick(sala)}
                                    className="cursor-pointer rounded-md border border-border bg-card p-2.5 shadow-sm"
                                    style={{ borderLeft: `4px solid ${sala.color}` }}
                                >
                                    <div className="flex flex-nowrap justify-between">
                                        <div>
                                            <span className="block text-[11px] font-semibold tracking-wide text-foreground">{sala.name}</span>
                                            <span className="text-[10px] text-muted-foreground">{sala.time}</span>
                                        </div>
                                        <Badge style={{ backgroundColor: `${sala.color}22`, color: sala.color }}>{sala.status}</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card className="h-full bg-muted/40 p-4">
                        <p className="mb-4 text-xs font-semibold tracking-wide text-primary">
                            SEDES Y SOPORTE
                        </p>
                        <div className="flex flex-col gap-2">
                            {contactosUtiles.map((item, idx) => (
                                <div key={idx} className="rounded-md border border-border bg-card p-2 shadow-sm">
                                    <div className="flex justify-between">
                                        <span className="text-[11px] font-semibold text-foreground">{item.name}</span>
                                        <span className="text-[11px] font-semibold text-primary">{item.phone}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

                <div className="mt-5 h-1 rounded bg-gradient-to-r from-sky-500 to-indigo-500 opacity-20" />
            </div>

            {/* MODAL PARA EVENTOS */}
            <Dialog open={openedEvent} onOpenChange={setOpenedEvent}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">DETALLE DEL EVENTO</DialogTitle>
                    </DialogHeader>
                    {selectedEvent && (
                        <div className="flex flex-col gap-6">
                            <div>
                                <Badge className="mb-2" style={{ backgroundColor: `${selectedEvent.color}22`, color: selectedEvent.color }}>{selectedEvent.date}</Badge>
                                <h3 className="m-0 text-xl font-bold leading-tight tracking-tight text-primary">
                                    {selectedEvent.title}
                                </h3>
                            </div>

                            <div className="flex gap-8">
                                <div>
                                    <span className="block text-[11px] font-semibold text-muted-foreground">HORARIO</span>
                                    <span className="text-[13px] font-semibold text-foreground">{selectedEvent.time}</span>
                                </div>
                                <div>
                                    <span className="block text-[11px] font-semibold text-muted-foreground">UBICACIÓN</span>
                                    <span className="text-[13px] font-semibold text-foreground">{selectedEvent.location}</span>
                                </div>
                            </div>

                            <div>
                                <span className="mb-2 block text-[11px] font-semibold text-muted-foreground">DESCRIPCIÓN</span>
                                <p className="text-[13px] leading-relaxed text-foreground">{selectedEvent.description}</p>
                            </div>

                            <div className="flex items-end justify-between">
                                <div>
                                    <span className="block text-[11px] font-semibold text-muted-foreground">ORGANIZA</span>
                                    <span className="text-[13px] font-semibold text-primary">{selectedEvent.organizer}</span>
                                </div>
                                <Button variant="outline" onClick={() => setOpenedEvent(false)}>Cerrar</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* MODAL PARA REPORTE COMPLETO */}
            <Dialog open={openedReport} onOpenChange={setOpenedReport}>
                <DialogContent className="max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">REPORTE OFICIAL</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-6">
                        <div>
                            <h2 className="m-0 text-2xl font-bold leading-tight tracking-tight text-primary">
                                Cierre de Operaciones Mensuales: Unidad Ensayo Molecular
                            </h2>
                            <span className="mt-2 block text-[11px] font-semibold text-muted-foreground">Publicado el 20 de Marzo, 2026 • ADL Diagnostic</span>
                        </div>

                        <p className="text-[13px] leading-[1.7] text-foreground">
                            Se informa a todo el personal técnico y administrativo que el proceso de cierre para la unidad Ensayo Molecular correspondiente al presente mes se llevará a cabo el día de hoy.
                            <br /><br />
                            Este cierre es crítico para la facturación y el cumplimiento de los tiempos de entrega comprometidos con nuestros clientes.
                        </p>

                        <div className="flex flex-col gap-4">
                            <span className="text-[11px] font-semibold tracking-wide text-primary">PUNTOS CLAVE</span>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    <span className="text-[13px] font-semibold text-foreground">Carga total de informes antes de las 18:00 hrs.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    <span className="text-[13px] font-semibold text-foreground">Revisión de correlativos y estados en el sistema Área Técnica Local.</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                    <span className="text-[13px] font-semibold text-foreground">Validación de firmas digitales por supervisores.</span>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-md border border-border bg-primary/5 p-4">
                            <span className="text-xs font-semibold text-primary">
                                Soporte técnico estará disponible de manera prioritaria para resolver cualquier incidencia con la plataforma durante este periodo.
                            </span>
                        </div>

                        <div className="flex justify-end">
                            <Button onClick={() => setOpenedReport(false)}>Entendido</Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL PARA SALA DE REUNIONES */}
            <Dialog open={openedSala} onOpenChange={setOpenedSala}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">INFO. DE SALA</DialogTitle>
                    </DialogHeader>
                    {selectedSala && (
                        <div className="flex flex-col gap-6">
                            <div className="mb-2 flex items-center justify-between">
                                <h3 className="m-0 text-xl font-bold tracking-tight text-primary">{selectedSala.name}</h3>
                                <Badge style={{ backgroundColor: `${selectedSala.color}22`, color: selectedSala.color }}>{selectedSala.status}</Badge>
                            </div>

                            <div>
                                <span className="mb-2 block text-[11px] font-semibold text-muted-foreground">DISPONIBILIDAD</span>
                                <p className="text-[13px] leading-relaxed text-foreground">{selectedSala.details}</p>
                            </div>

                            <div className="flex justify-between border-y border-border px-4 py-2">
                                <span className="text-[11px] font-semibold text-muted-foreground">PRÓXIMA RESERVA</span>
                                <span className="text-xs font-semibold text-primary">{selectedSala.nextBooking}</span>
                            </div>

                            <Button className="w-full" onClick={() => setOpenedSala(false)}>Cerrar</Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
