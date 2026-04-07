import React, { useState } from 'react';
import { 
    Paper, 
    Text, 
    Stack, 
    Group, 
    ThemeIcon, 
    rem,
    Badge,
    SimpleGrid,
    Box,
    Button,
    Flex,
    Grid,
    Modal,
    ScrollArea
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useToast } from '../contexts/ToastContext';
import { 
    IconCalendarEvent, 
    IconClock,
    IconPhone,
    IconChevronRight,
    IconDoorEnter
} from '@tabler/icons-react';

import fondoLogin from '../assets/images/fondo-login.png';

export const WelcomePage: React.FC = () => {
    const [openedEvent, { open: openEvent, close: closeEvent }] = useDisclosure(false);
    const [openedReport, { open: openReport, close: closeReport }] = useDisclosure(false);
    const [openedSala, { open: openSala, close: closeSala }] = useDisclosure(false);
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [selectedSala, setSelectedSala] = useState<any>(null);
    const { showToast } = useToast();
    const isBannerFinished = true;

    // Mock data for demonstration
    const upcomingEvents = [
        { 
            id: 1, 
            title: 'Reunión Semanal de Laboratorio', 
            time: '14:00 - 15:30', 
            date: 'Hoy', 
            color: 'blue',
            description: 'Coordinación semanal de actividades, revisión de protocolos y gestión de insumos críticos para la operación de la unidad.',
            location: 'Sala de Conferencias B',
            organizer: 'Dirección Técnica',
            isFinished: true
        },

        { 
            id: 2, 
            title: 'Mantenimiento de Servidores', 
            time: '22:00 - 02:00', 
            date: 'Mañana', 
            color: 'orange',
            description: 'Actualización programada de sistemas críticos y respaldos de base de datos. Se esperan intermitencias en servicios internos.',
            location: 'Centro de Datos / Remoto',
            organizer: 'Informática ADL',
            isFinished: true
        },

        { 
            id: 3, 
            title: 'Auditoría Interna ISO 9001', 
            time: '09:00 - 18:00', 
            date: '25 Mar', 
            color: 'red',
            description: 'Revisión anual de procesos del sistema de gestión de calidad. Todos los departamentos deben tener su documentación al día.',
            location: 'Instalaciones Centrales',
            organizer: 'Calidad',
            isFinished: true
        },

    ];

    const salasReuniones = [
        { 
            name: 'SALA DE REUNIONES', 
            status: 'LIBRE', 
            time: 'Disponible', 
            color: 'green',
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
        { name: 'SEDE AYSEN', phone: '+56 9 97797306' },
        { name: 'SEDE VILLARICA', phone: '+56 9 62256271' },
    ];

    const handleEventClick = (event: any) => {
        if (event.isFinished) {
            showToast({ type: 'info', message: 'EVENTO FINALIZADO' });
            return;
        }
        setSelectedEvent(event);
        openEvent();
    };

    const handleReportClick = () => {
        if (isBannerFinished) {
            showToast({ type: 'info', message: 'INFORMACIÓN COMPLETADA' });
            return;
        }
        openReport();
    };

    const handleSalaClick = (sala: any) => {
        setSelectedSala(sala);
        openSala();
    };

    return (
        <Box p="md" style={{ width: '100% !important', maxWidth: '100% !important' }}>
            <Stack gap="lg">
                {/* INFORMACION IMPORTANTE (Article Card Style - Login Inspired) */}
                <Paper withBorder radius="md" p={0} shadow="sm" style={{ overflow: 'hidden' }}>
                    <Flex direction={{ base: 'column', lg: 'row' }} align="stretch" style={{ minHeight: rem(220) }}>

                        <Box 
                            w={{ base: '100%', lg: '40%' }} 
                            h={{ base: rem(160), lg: 'auto' }}
                            style={{ 
                                position: 'relative', 
                                backgroundImage: `url(${fondoLogin})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: rem(20)
                            }}
                        >
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0, 0, 0, 0.05)', zIndex: 1 }} />
                            
                            <Stack gap={rem(5)} align="center" style={{ zIndex: 2, width: '100%', padding: rem(20) }}>
                                <Text fw={300} size={rem(16)} ta="center" c="white" style={{ letterSpacing: rem(8), textTransform: 'lowercase', textShadow: '0 2px 4px rgba(0,0,0,0.5)', fontStyle: 'italic' }}>
                                    información
                                </Text>
                                <Group gap={rem(4)} wrap="nowrap">
                                    <Text fw={900} size={rem(32)} c="white" style={{ lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                        ADL
                                    </Text>
                                    <Text fw={400} size={rem(32)} c="orange.5" style={{ lineHeight: 1, letterSpacing: '-0.02em', textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                        Diagnóstico
                                    </Text>
                                </Group>
                            </Stack>
                        </Box>

                        <Box p={{ base: 'md', lg: 'xl' }} style={{ flex: 1, backgroundColor: 'white', position: 'relative' }}>
                            <div className="stamp-overlay-finalizado">FINALIZADO</div>

                            <Group justify="space-between" mb="sm">
                                <Badge color="orange" variant="filled" size="sm" radius="sm">INFORMACIÓN IMPORTANTE</Badge>
                                <Text size="xs" c="dimmed" fw={700}>20 MARZO, 2026</Text>
                            </Group>
                            <Text fw={800} size="xl" mb="md" c="blue.9" style={{ letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                                Comunicado Oficial: Cierre de Reportes GEM
                            </Text>
                            <Text size="sm" c="dimmed" lineClamp={3} mb="xl" style={{ lineHeight: 1.6 }}>
                                Recuerden que hoy finaliza el plazo para la carga de informes mensuales de la unidad Ensayo Molecular. 
                                Es fundamental asegurar que todos los correlativos estén al día para el cierre operativo.
                                Ante cualquier duda, contactar a la jefatura de área correspondiente.
                            </Text>
                            <Group gap={4} style={{ cursor: 'pointer' }} onClick={handleReportClick}>
                                <Text size="sm" fw={700} c="blue.6">Leer reporte completo</Text>

                                <IconChevronRight size={18} />
                            </Group>

                        </Box>
                    </Flex>
                </Paper>

                {/* PRÓXIMOS EVENTOS (Card Grid Style) */}
                <Box>
                    <Group gap="sm" mb="md">
                        <ThemeIcon variant="light" color="indigo" size="md" radius="sm">
                            <IconCalendarEvent size={20} />
                        </ThemeIcon>
                        <Text fw={700} tt="uppercase" style={{ letterSpacing: rem(1) }}>Próximos Eventos</Text>
                    </Group>
                    
                    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                        {upcomingEvents.map(event => (
                            <Paper 
                                key={event.id} 
                                p="md" 
                                withBorder 
                                radius="md" 
                                shadow="xs"
                                style={{ 
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    borderLeft: `5px solid var(--mantine-color-${event.color}-6)`,
                                    position: 'relative',
                                    overflow: 'hidden'
                                }}

                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = 'var(--mantine-shadow-md)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'var(--mantine-shadow-xs)';
                                }}
                                onClick={() => handleEventClick(event)}
                            >
                                <div className="stamp-overlay-finalizado event-card-stamp">FINALIZADO</div>
                                <Stack gap="md">

                                    <Group justify="space-between">
                                        <Badge color={event.color} variant="filled" size="sm" radius="sm">
                                            {event.date}
                                        </Badge>
                                        <IconClock size={16} style={{ color: 'var(--mantine-color-gray-6)' }} />
                                    </Group>
                                    <div style={{ height: rem(40) }}>
                                        <Text fw={700} size="sm" lineClamp={2}>{event.title}</Text>
                                    </div>
                                    <Group gap={4} mt="xs">
                                        <Text size="xs" fw={700} c={event.color}>{event.time}</Text>
                                        <Text size="xs" c="dimmed"> • Ver detalles</Text>
                                    </Group>
                                </Stack>
                            </Paper>
                        ))}
                    </SimpleGrid>
                </Box>

                <div style={{ height: rem(1.5), background: 'linear-gradient(to right, #0ea5e9, #6366f1)', borderRadius: rem(1), opacity: 0.1, margin: `${rem(5)} 0` }} />

                {/* SECCIÓN INFERIOR: Listas Informativas */}
                <Grid gutter="md">
                    <Grid.Col span={{ base: 12, sm: 6, lg: 4 }} order={{ base: 2, lg: 1 }}>
                        <Paper p="md" radius="md" withBorder shadow="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)', height: '100%' }}>
                        <Text fw={700} size={rem(12)} mb="md" c="blue.8" style={{ display: 'flex', alignItems: 'center', gap: rem(8), letterSpacing: rem(0.6) }}>
                            <IconPhone size={14} /> ANEXOS INTERNOS
                        </Text>
                        <ScrollArea h={rem(230)} offsetScrollbars>
                            <Stack gap="xs">
                                {anexosInternos.map((item, idx) => (
                                    <Paper key={idx} p="xs" radius="sm" withBorder shadow="xs" style={{ backgroundColor: 'white' }}>
                                        <Group justify="space-between" wrap="nowrap">
                                            <Text size={rem(11)} fw={600}>{item.name}</Text>
                                            <Text size={rem(11)} c="blue.7" fw={800}>{item.ext}</Text>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        </ScrollArea>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 6, lg: 4 }} order={{ base: 1, lg: 2 }}>
                        <Paper p="md" radius="md" withBorder shadow="xs" style={{ backgroundColor: 'white', height: '100%' }}>
                            <Text fw={700} size={rem(12)} mb="md" c="blue.8" style={{ display: 'flex', alignItems: 'center', gap: rem(8), letterSpacing: rem(0.5) }}>
                                <IconDoorEnter size={16} /> ESTADO SALA DE REUNIONES
                            </Text>
                            <Stack gap="xs">
                                {salasReuniones.map((sala, idx) => (
                                    <Paper 
                                        key={idx} 
                                        p="sm" 
                                        radius="sm" 
                                        withBorder 
                                        shadow="xs" 
                                        onClick={() => handleSalaClick(sala)}
                                        style={{ 
                                            borderLeft: `4px solid var(--mantine-color-${sala.color}-6)`,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Group justify="space-between" wrap="nowrap">
                                            <Stack gap={0}>
                                                <Text size={rem(11)} fw={800} style={{ letterSpacing: rem(0.3) }}>{sala.name}</Text>
                                                <Text size={rem(10)} c="dimmed">{sala.time}</Text>
                                            </Stack>
                                            <Badge color={sala.color} variant="light" size="xs" radius="xs">
                                                {sala.status}
                                            </Badge>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid.Col>

                    <Grid.Col span={{ base: 12, sm: 12, lg: 4 }} order={{ base: 3, lg: 3 }}>
                        <Paper p="md" radius="md" withBorder shadow="xs" style={{ backgroundColor: 'var(--mantine-color-gray-0)', height: '100%' }}>
                            <Text fw={700} size={rem(12)} mb="md" c="blue.8" style={{ display: 'flex', alignItems: 'center', gap: rem(8), letterSpacing: rem(0.5) }}>
                                SEDES Y SOPORTE
                            </Text>
                            <Stack gap="xs">
                                {contactosUtiles.map((item, idx) => (
                                    <Paper key={idx} p="xs" radius="sm" withBorder shadow="sm" style={{ backgroundColor: 'white' }}>
                                        <Group justify="space-between">
                                            <Text size={rem(11)} fw={600}>{item.name}</Text>
                                            <Text size={rem(11)} c="blue.7" fw={700}>{item.phone}</Text>
                                        </Group>
                                    </Paper>
                                ))}
                            </Stack>
                        </Paper>
                    </Grid.Col>
                </Grid>

                <div style={{ height: rem(4), background: 'linear-gradient(to right, #0ea5e9, #6366f1)', borderRadius: rem(2), opacity: 0.2, marginTop: rem(20) }} />
            </Stack>

            {/* MODAL PARA EVENTOS */}
            <Modal
                opened={openedEvent}
                onClose={closeEvent}
                title={<Text fw={800} size="sm" c="dimmed" style={{ letterSpacing: rem(1) }}>DETALLE DEL EVENTO</Text>}
                centered
                radius="md"
                padding="xl"
                overlayProps={{ backgroundOpacity: 0.4, blur: 10 }}
            >
                {selectedEvent && (
                    <Stack gap="xl">
                        <Box>
                            <Badge color={selectedEvent.color} variant="light" mb="xs" radius="sm" size="sm">
                                {selectedEvent.date}
                            </Badge>
                            <Text fw={900} size="xl" c="blue.9" style={{ letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                                {selectedEvent.title}
                            </Text>
                        </Box>
                        
                        <Group gap="xl">
                            <Stack gap={4}>
                                <Text size="xs" c="dimmed" fw={700}>HORARIO</Text>
                                <Text size="sm" fw={700}>{selectedEvent.time}</Text>
                            </Stack>
                            <Stack gap={4}>
                                <Text size="xs" c="dimmed" fw={700}>UBICACIÓN</Text>
                                <Text size="sm" fw={700}>{selectedEvent.location}</Text>
                            </Stack>
                        </Group>

                        <Stack gap={8}>
                            <Text size="xs" c="dimmed" fw={700}>DESCRIPCIÓN</Text>
                            <Text size="sm" c="gray.7" style={{ lineHeight: 1.6 }}>{selectedEvent.description}</Text>
                        </Stack>

                        <Group justify="space-between" align="flex-end">
                             <Stack gap={4}>
                                <Text size="xs" c="dimmed" fw={700}>ORGANIZA</Text>
                                <Text size="sm" fw={800} c="blue.6">{selectedEvent.organizer}</Text>
                            </Stack>
                            <Button variant="subtle" size="sm" onClick={closeEvent} color="gray">Cerrar</Button>
                        </Group>
                    </Stack>
                )}
            </Modal>

            {/* MODAL PARA REPORTE COMPLETO */}
            <Modal
                opened={openedReport}
                onClose={closeReport}
                title={<Text fw={800} size="sm" c="dimmed" style={{ letterSpacing: rem(1) }}>REPORTE OFICIAL</Text>}
                centered
                radius="md"
                size="lg"
                padding="xl"
                overlayProps={{ backgroundOpacity: 0.4, blur: 10 }}
            >
                <Stack gap="xl">
                    <Box>
                        <Text fw={900} size="24px" c="blue.9" style={{ letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                            Cierre de Operaciones Mensuales: Unidad Ensayo Molecular
                        </Text>
                        <Text size="xs" c="dimmed" mt="xs" fw={700}>Publicado el 20 de Marzo, 2026 • ADL Diagnóstico</Text>
                    </Box>

                    <Text size="sm" c="gray.8" style={{ lineHeight: 1.7 }}>
                        Se informa a todo el personal técnico y administrativo que el proceso de cierre para la unidad Ensayo Molecular correspondiente al presente mes se llevará a cabo el día de hoy.
                        <br /><br />
                        Este cierre es crítico para la facturación y el cumplimiento de los tiempos de entrega comprometidos con nuestros clientes.
                    </Text>

                    <Stack gap="md">
                        <Text size="xs" c="blue.7" fw={900} style={{ letterSpacing: rem(0.5) }}>PUNTOS CLAVE</Text>
                        <SimpleGrid cols={1} spacing="xs">
                            <Group gap="sm" wrap="nowrap">
                                <Box w={6} h={6} style={{ borderRadius: '50%', backgroundColor: 'var(--mantine-color-blue-6)' }} />
                                <Text size="sm" fw={600}>Carga total de informes antes de las 18:00 hrs.</Text>
                            </Group>
                            <Group gap="sm" wrap="nowrap">
                                <Box w={6} h={6} style={{ borderRadius: '50%', backgroundColor: 'var(--mantine-color-blue-6)' }} />
                                <Text size="sm" fw={600}>Revisión de correlativos y estados en el sistema Área Técnica Local.</Text>
                            </Group>
                            <Group gap="sm" wrap="nowrap">
                                <Box w={6} h={6} style={{ borderRadius: '50%', backgroundColor: 'var(--mantine-color-blue-6)' }} />
                                <Text size="sm" fw={600}>Validación de firmas digitales por supervisores.</Text>
                            </Group>
                        </SimpleGrid>
                    </Stack>

                    <Paper p="md" radius="sm" withBorder bg="blue.0" style={{ borderColor: 'var(--mantine-color-blue-2)' }}>
                        <Text size="xs" fw={600} c="blue.8">
                            Soporte técnico estará disponible de manera prioritaria para resolver cualquier incidencia con la plataforma durante este periodo.
                        </Text>
                    </Paper>

                    <Group justify="flex-end">
                        <Button variant="light" onClick={closeReport} color="blue">Entendido</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* MODAL PARA SALA DE REUNIONES */}
            <Modal
                opened={openedSala}
                onClose={closeSala}
                title={<Text fw={800} size="sm" c="dimmed" style={{ letterSpacing: rem(1) }}>INFO. DE SALA</Text>}
                centered
                radius="md"
                padding="xl"
                overlayProps={{ backgroundOpacity: 0.4, blur: 10 }}
            >
                {selectedSala && (
                    <Stack gap="xl">
                        <Box>
                             <Group justify="space-between" align="center" mb="xs">
                                <Text fw={900} size="xl" c="blue.9" style={{ letterSpacing: '-0.02em' }}>{selectedSala.name}</Text>
                                <Badge color={selectedSala.color} variant="light" radius="sm">{selectedSala.status}</Badge>
                             </Group>
                        </Box>
                        
                        <Stack gap={8}>
                            <Text size="xs" c="dimmed" fw={700}>DISPONIBILIDAD</Text>
                            <Text size="sm" c="gray.8" style={{ lineHeight: 1.6 }}>{selectedSala.details}</Text>
                        </Stack>

                        <Group justify="space-between" px="md" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)', borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                            <Text size="xs" fw={800} c="dimmed">PRÓXIMA RESERVA</Text>
                            <Text size="xs" fw={900} c="blue.8">{selectedSala.nextBooking}</Text>
                        </Group>

                        <Button fullWidth variant="light" onClick={closeSala} color="blue">Cerrar</Button>
                    </Stack>
                )}
            </Modal>
        </Box>
    );
};
