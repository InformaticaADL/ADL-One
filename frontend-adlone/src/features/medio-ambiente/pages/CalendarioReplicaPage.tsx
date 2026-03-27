import React, { useState, useMemo, useEffect } from 'react';
import { adminService } from '../../../services/admin.service';
import { CoordinacionDetailView } from '../components/CoordinacionDetailView';
import { 
    Group, 
    Text, 
    Title,
    Button, 
    Select, 
    TextInput, 
    ActionIcon, 
    Tooltip, 
    SimpleGrid,
    Paper,
    Box,
    Center,
    Loader,
    Stack,
    ScrollArea,
    Badge as MantineBadge
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { 
    IconChevronLeft, 
    IconChevronRight,
    IconArrowLeft,
    IconFilter,
    IconInfoCircle
} from '@tabler/icons-react';

interface Props {
    onBack: () => void;
}

interface DBRow {
    id_agendamam: number;
    fecha_muestreo: string | null;
    dia: number | null;
    mes: number | null;
    ano: number | null;
    frecuencia: string | null;
    id_fichaingresoservicio: number;
    id_estadomuestreo: number | null;
    id_empresa: number | null;
    nombre_empresa: string | null;
    id_fuenteemisora: number | null;
    nombre_fuenteemisora: string | null;
    nombre_fuenteemisora_ma: string | null;
    nombre_objetivomuestreo_ma: string | null;
    nombre_sector: string | null;
}

const PASTEL_COLORS = [
    '#bae6fd', '#bbf7d0', '#fef08a', '#fbcfe8', '#e9d5ff', '#fed7aa', '#c7d2fe', '#a7f3d0'
];

export const CalendarioReplicaPage: React.FC<Props> = ({ onBack }) => {
    const [selectedEmpresa, setSelectedEmpresa] = useState('');
    const [selectedFuente, setSelectedFuente] = useState('');
    const [dbData, setDbData] = useState<DBRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchDay, setSearchDay] = useState<string | null>(null);

    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedFichaId, setSelectedFichaId] = useState<number | null>(null);
    const [selectedDayMobile, setSelectedDayMobile] = useState<number>(new Date().getDate());

    const isMobile = useMediaQuery('(max-width: 768px)');
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const today = new Date();
    const isPastMonth = (year < today.getFullYear()) || (year === today.getFullYear() && month < today.getMonth());

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await adminService.getCalendarioReplica(month + 1, year);
                if (response.success && response.data) {
                    setDbData(response.data);
                }
            } catch (error) {
                console.error("Failed to load calendario data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [month, year]);

    const empresas = useMemo(() => {
        const unique = Array.from(new Set(dbData.map(d => d.nombre_empresa))).filter(Boolean) as string[];
        return unique.sort();
    }, [dbData]);

    const fuentes = useMemo(() => {
        const filteredList = selectedEmpresa
            ? dbData.filter(d => d.nombre_empresa === selectedEmpresa)
            : dbData;
        const unique = Array.from(new Set(filteredList.map(d => d.nombre_fuenteemisora))).filter(Boolean) as string[];
        return unique.sort();
    }, [dbData, selectedEmpresa]);

    const companyColorMap = useMemo(() => {
        const map: Record<string, { bg: string, text: string }> = {};
        const uniqueEmpresas = Array.from(new Set(dbData.map(d => d.nombre_empresa))).filter(Boolean) as string[];
        uniqueEmpresas.sort().forEach((e, idx) => {
            const bg = PASTEL_COLORS[idx % PASTEL_COLORS.length];
            map[e] = { bg, text: '#1e293b' };
        });
        return map;
    }, [dbData]);

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let firstDayOfWeek = new Date(year, month, 1).getDay() - 1;
    if (firstDayOfWeek === -1) firstDayOfWeek = 6;

    const calendarCells = useMemo(() => {
        const cells = Array.from({ length: firstDayOfWeek + daysInMonth }, (_, i) => {
            if (i < firstDayOfWeek) return null;
            return i - firstDayOfWeek + 1;
        });
        return cells;
    }, [firstDayOfWeek, daysInMonth]);

    const formattedMonth = useMemo(() => {
        return new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(currentDate);
    }, [currentDate]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    if (selectedFichaId) {
        return (
            <Box pos="fixed" inset={0} bg="white" style={{ zIndex: 1000 }} p={0}>
                <CoordinacionDetailView
                    fichaId={selectedFichaId}
                    onBack={() => setSelectedFichaId(null)}
                />
            </Box>
        );
    }

    return (
        <Box py="md" style={{ width: '100%' }}>
            <Paper withBorder p="xl" radius="lg" shadow="sm">
                <Stack gap="xl">
                    <Group justify="space-between" align="center" wrap="wrap" gap="md">
                        <Button 
                            variant="subtle" 
                            color="gray" 
                            size={isMobile ? "xs" : "sm"}
                            leftSection={<IconArrowLeft size={isMobile ? 16 : 20} />}
                            onClick={onBack}
                        >
                            {isMobile ? 'Volver' : 'Volver a Medio Ambiente'}
                        </Button>
                        <Stack gap={0} align="center" style={{ flex: isMobile ? '1 1 100%' : 'auto', order: isMobile ? 3 : 2 }}>
                            {!isMobile && (
                                <>
                                    <Title order={2} fw={800} c="blue.8">Calendario de Terreno</Title>
                                    <Group gap="xs" mt="xs">
                                        <ActionIcon variant="light" onClick={prevMonth} size="lg" radius="md">
                                            <IconChevronLeft size={20} />
                                        </ActionIcon>
                                        <Text fw={700} size="lg" w={180} ta="center" style={{ textTransform: 'capitalize' }}>
                                            {formattedMonth}
                                        </Text>
                                        <ActionIcon variant="light" onClick={nextMonth} size="lg" radius="md">
                                            <IconChevronRight size={20} />
                                        </ActionIcon>
                                    </Group>
                                </>
                            )}
                            {isMobile && <Title order={4} fw={800} c="blue.8">Calendario de Terreno</Title>}
                        </Stack>
                        <Button 
                            variant={showFilters ? 'filled' : 'light'} 
                            size={isMobile ? "xs" : "sm"}
                            leftSection={<IconFilter size={18} />}
                            onClick={() => setShowFilters(!showFilters)}
                            style={{ order: isMobile ? 2 : 3 }}
                        >
                            Filtros
                        </Button>
                    </Group>

                    {showFilters && (
                        <Paper withBorder p="md" radius="md" bg="gray.0">
                            <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="sm">
                                <TextInput 
                                    label="Buscar" 
                                    placeholder="Nombre, ficha..." 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.currentTarget.value)}
                                    size="xs"
                                />
                                <Select 
                                    label="Día" 
                                    placeholder="Todos" 
                                    data={Array.from({ length: 31 }, (_, i) => ({ value: String(i+1), label: `Día ${i+1}` }))}
                                    value={searchDay}
                                    onChange={setSearchDay}
                                    size="xs"
                                    clearable
                                />
                                <Select 
                                    label="Empresa" 
                                    placeholder="Todas" 
                                    data={empresas.map(e => ({ value: e, label: e }))}
                                    value={selectedEmpresa}
                                    onChange={(v) => { setSelectedEmpresa(v || ''); setSelectedFuente(''); }}
                                    size="xs"
                                    clearable
                                />
                                <Select 
                                    label="Fuente" 
                                    placeholder="Todas" 
                                    data={fuentes.map(f => ({ value: f, label: f }))}
                                    value={selectedFuente}
                                    onChange={(v) => setSelectedFuente(v || '')}
                                    size="xs"
                                    clearable
                                />
                                <Group align="flex-end">
                                    <Button fullWidth variant="subtle" color="gray" size="xs" onClick={() => {
                                        setSearchTerm('');
                                        setSearchDay(null);
                                        setSelectedEmpresa('');
                                        setSelectedFuente('');
                                    }}>
                                        Limpiar Filtros
                                    </Button>
                                </Group>
                            </SimpleGrid>
                        </Paper>
                    )}

                    <Box pos="relative" mih={400}>
                        {isLoading && (
                            <Box pos="absolute" inset={0} bg="rgba(255,255,255,0.7)" style={{ zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <Loader color="blue" />
                            </Box>
                        )}
                        
                        {!isMobile ? (
                            <SimpleGrid cols={7} spacing={1} bg="gray.2" style={{ border: '1px solid var(--mantine-color-gray-2)', borderRadius: '8px', overflow: 'hidden' }}>
                                {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(dayName => (
                                    <Center key={dayName} p="xs" bg="gray.1">
                                        <Text fw={700} size="sm" c="gray.7">{dayName}</Text>
                                    </Center>
                                ))}
                                
                                {calendarCells.map((day, idx) => {
                                    if (day === null) return <Box key={`empty-${idx}`} bg="gray.0" mih={120} />;
                                    
                                    const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                                    
                                    const dayEvents = dbData.filter(row => {
                                        if (row.dia !== day) return false;
                                        if (selectedEmpresa && row.nombre_empresa !== selectedEmpresa) return false;
                                        if (selectedFuente && row.nombre_fuenteemisora !== selectedFuente) return false;
                                        if (searchDay && String(row.dia) !== searchDay) return false;
                                        if (searchTerm) {
                                            const search = searchTerm.toLowerCase();
                                            return (row.nombre_empresa?.toLowerCase().includes(search) ||
                                                    row.nombre_fuenteemisora?.toLowerCase().includes(search) ||
                                                    row.nombre_objetivomuestreo_ma?.toLowerCase().includes(search) ||
                                                    String(row.id_fichaingresoservicio).includes(search));
                                        }
                                        return true;
                                    });

                                    return (
                                        <Box 
                                            key={day} 
                                            p="xs" 
                                            bg={isToday ? 'blue.0' : 'white'} 
                                            mih={120} 
                                            style={{ 
                                                borderTop: '1px solid var(--mantine-color-gray-2)',
                                                borderLeft: idx % 7 !== 0 ? '1px solid var(--mantine-color-gray-2)' : 'none',
                                                filter: isPastMonth ? 'grayscale(0.4) opacity(0.8)' : 'none',
                                                transition: 'all 0.2s',
                                                ...(isToday ? { border: '2px solid var(--mantine-color-blue-5)', zIndex: 1 } : {})
                                            }}
                                        >
                                            <Text fw={700} size="sm" c={isToday ? 'blue.7' : 'gray.6'} mb={4}>
                                                {day}
                                            </Text>
                                            <Stack gap={4}>
                                                {dayEvents.map((ev, eIdx) => {
                                                    const empresa = ev.nombre_empresa || '';
                                                    const colors = companyColorMap[empresa] || { bg: '#f1f3f5', text: '#495057' };
                                                    return (
                                                        <Tooltip 
                                                            key={`${day}-${eIdx}`} 
                                                            label={`${empresa} - ${ev.nombre_fuenteemisora}\nObj: ${ev.nombre_objetivomuestreo_ma || '-'}`}
                                                            multiline
                                                            withinPortal
                                                        >
                                                            <Box
                                                                px={6}
                                                                py={2}
                                                                bg={colors.bg}
                                                                style={{ 
                                                                    cursor: 'pointer', 
                                                                    borderRadius: '4px',
                                                                    borderLeft: `3px solid ${colors.text}`
                                                                }}
                                                                onClick={() => setSelectedFichaId(ev.id_fichaingresoservicio)}
                                                            >
                                                                <Text size="10px" fw={700} truncate title={ev.nombre_fuenteemisora || ''}>
                                                                    {ev.nombre_fuenteemisora || 'S/F'}
                                                                </Text>
                                                            </Box>
                                                        </Tooltip>
                                                    );
                                                })}
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </SimpleGrid>
                        ) : (
                            <Stack gap="md">
                                <Paper withBorder p="md" radius="md" bg="blue.0">
                                    <Group justify="space-between">
                                        <ActionIcon variant="subtle" onClick={prevMonth} size="md">
                                            <IconChevronLeft size={20} />
                                        </ActionIcon>
                                        <Text fw={800} size="lg" style={{ textTransform: 'capitalize' }} c="blue.9">
                                            {formattedMonth}
                                        </Text>
                                        <ActionIcon variant="subtle" onClick={nextMonth} size="md">
                                            <IconChevronRight size={20} />
                                        </ActionIcon>
                                    </Group>
                                </Paper>

                                <Box>
                                    <ScrollArea scrollbars="x" offsetScrollbars={false}>
                                        <Group wrap="nowrap" gap="xs" pb="sm">
                                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                                const hasEvents = dbData.some(ev => ev.dia === day);
                                                const isSelected = selectedDayMobile === day;
                                                const dateObj = new Date(year, month, day);
                                                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

                                                return (
                                                    <Paper
                                                        key={day}
                                                        withBorder
                                                        p="xs"
                                                        onClick={() => setSelectedDayMobile(day)}
                                                        style={{
                                                            cursor: 'pointer',
                                                            minWidth: 55,
                                                            textAlign: 'center',
                                                            borderRadius: '12px',
                                                            borderColor: isSelected ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-gray-3)',
                                                            backgroundColor: isSelected ? 'var(--mantine-color-blue-1)' : isToday ? 'var(--mantine-color-blue-0)' : 'white',
                                                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                                            transform: isSelected ? 'scale(1.05)' : 'none',
                                                            boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                                                        }}
                                                    >
                                                        <Text size="10px" c={isSelected ? 'blue.7' : 'dimmed'} fw={700} tt="uppercase">
                                                            {new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(dateObj)}
                                                        </Text>
                                                        <Text fw={900} size="lg" c={isSelected ? 'blue.8' : 'dark'}>{day}</Text>
                                                        {hasEvents && (
                                                            <Box h={5} w={5} bg={isSelected ? 'blue.7' : 'blue.4'} style={{ borderRadius: '50%', margin: '4px auto 0' }} />
                                                        )}
                                                    </Paper>
                                                );
                                            })}
                                        </Group>
                                    </ScrollArea>
                                </Box>

                                <Stack gap="sm">
                                    <Group justify="space-between" align="center" px="xs">
                                        <Text fw={800} size="md" c="blue.9">Servicios del Día {selectedDayMobile}</Text>
                                        <MantineBadge color="blue" variant="light">{dbData.filter(ev => ev.dia === selectedDayMobile).length} Servicios</MantineBadge>
                                    </Group>

                                    {dbData.filter(ev => ev.dia === selectedDayMobile).length === 0 ? (
                                        <Paper withBorder p="xl" radius="lg" bg="gray.0" style={{ borderStyle: 'dashed' }}>
                                            <Center>
                                                <Stack align="center" gap="xs">
                                                    <IconInfoCircle size={40} color="var(--mantine-color-gray-4)" />
                                                    <Text c="dimmed" size="sm" fw={500}>No hay servicios programados para esta fecha</Text>
                                                </Stack>
                                            </Center>
                                        </Paper>
                                    ) : (
                                        <Stack gap="sm">
                                            {dbData.filter(ev => {
                                                if (ev.dia !== selectedDayMobile) return false;
                                                if (selectedEmpresa && ev.nombre_empresa !== selectedEmpresa) return false;
                                                if (selectedFuente && ev.nombre_fuenteemisora !== selectedFuente) return false;
                                                if (searchTerm) {
                                                    const s = searchTerm.toLowerCase();
                                                    return (ev.nombre_empresa?.toLowerCase().includes(s) || 
                                                           ev.nombre_fuenteemisora?.toLowerCase().includes(s));
                                                }
                                                return true;
                                            }).map((ev, eIdx) => {
                                                const empresa = ev.nombre_empresa || '';
                                                const colors = companyColorMap[empresa] || { bg: '#f1f3f5', text: '#495057' };
                                                return (
                                                    <Paper 
                                                        key={eIdx} withBorder p="md" radius="lg" shadow="xs" 
                                                        onClick={() => setSelectedFichaId(ev.id_fichaingresoservicio)}
                                                        style={{ 
                                                            borderLeft: `6px solid ${colors.text}`, 
                                                            cursor: 'pointer',
                                                            background: `linear-gradient(to right, ${colors.bg}0A, white)`
                                                        }}
                                                    >
                                                        <Stack gap={8}>
                                                            <Group justify="space-between" wrap="nowrap">
                                                                <Text size="xs" fw={900} c="blue.7" style={{ letterSpacing: '0.5px' }}>
                                                                    FICHA #{ev.id_fichaingresoservicio}
                                                                </Text>
                                                                <MantineBadge size="sm" variant="dot" color="blue">
                                                                    {ev.nombre_objetivomuestreo_ma}
                                                                </MantineBadge>
                                                            </Group>
                                                            <Box>
                                                                <Text size="sm" fw={800} c="dark.4" lh={1.2}>{ev.nombre_empresa}</Text>
                                                                <Text size="xs" c="dimmed" fw={500}>{ev.nombre_fuenteemisora}</Text>
                                                            </Box>
                                                            <Group gap={4}>
                                                                <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.text }} />
                                                                <Text size="11px" fw={700} c="dimmed" tt="uppercase">Programado</Text>
                                                            </Group>
                                                        </Stack>
                                                    </Paper>
                                                );
                                            })}
                                        </Stack>
                                    )}
                                </Stack>
                            </Stack>
                        )}
                    </Box>
                </Stack>
            </Paper>
        </Box>
    );
};
