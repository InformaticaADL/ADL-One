import { useEffect, useMemo, useState } from 'react';
import {
    ActionIcon,
    Alert,
    Badge,
    Box,
    Button,
    Group,
    Paper,
    SimpleGrid,
    Stack,
    Table,
    Tabs,
    Text,
    ThemeIcon,
    Title,
    Loader,
    Center,
} from '@mantine/core';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    IconAlertTriangle,
    IconChartBar,
    IconRefresh,
    IconSparkles,
    IconInfoCircle,
    IconX,
} from '@tabler/icons-react';
import {
    kpiDashboardService,
    type KpiDashboardPayload,
} from '../services/kpi-dashboard.service';
import { PageHeader } from '../../../components/layout/PageHeader';

interface Props {
    onBack: () => void;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

const toneMap: Record<string, string> = {
    green: '#10b981',
    teal: '#14b8a6',
    lime: '#84cc16',
    red: '#ef4444',
    blue: '#3b82f6',
    orange: '#f97316',
    violet: '#8b5cf6',
    cyan: '#06b6d4',
    indigo: '#6366f1',
    pink: '#ec4899',
    grape: '#a855f7',
    dark: '#1f2937',
    yellow: '#eab308',
};

const levelColor: Record<string, string> = {
    critical: 'red',
    warning: 'orange',
    normal: 'blue',
};

const WidgetHeader = ({ widget, onInfoClick }: { widget: any, onInfoClick: (title: string, what: string, why: string) => void }) => (
    <Group justify="space-between" align="flex-start" mb="md">
        <Title order={4} c="dark.8" fw={700} size="sm">{widget.title}</Title>
        {widget.help ? (
            <button 
                onClick={() => onInfoClick(widget.title, widget.help.what, widget.help.why)}
                style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    border: '1px solid var(--mantine-color-gray-2)',
                    color: 'var(--mantine-color-gray-5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                }}
                title="Explicación detallada"
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)'; e.currentTarget.style.color = 'var(--mantine-color-dark-9)'; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = 'var(--mantine-color-gray-5)'; }}
            >
                <IconInfoCircle size={16} />
            </button>
        ) : null}
    </Group>
);

const renderWidget = (widget: any) => {
    if (widget.type === 'table') {
        return (
            <Table striped highlightOnHover style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--mantine-color-gray-2)' }}>
                <Table.Thead bg="gray.0">
                    <Table.Tr>
                        {(widget.columns || []).map((column: string) => (
                            <Table.Th key={column} style={{ color: 'var(--mantine-color-dark-4)', fontSize: '0.75rem', textTransform: 'uppercase' }}>{column}</Table.Th>
                        ))}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {(widget.data || []).map((row: any, index: number) => (
                        <Table.Tr key={`${widget.id}-${index}`}>
                            {(widget.columns || []).map((column: string) => (
                                <Table.Td key={column} style={{ fontSize: '0.8rem', fontWeight: 500 }}>{String(row[column] ?? '-')}</Table.Td>
                            ))}
                        </Table.Tr>
                    ))}
                </Table.Tbody>
            </Table>
        );
    }

    if (widget.type === 'metric-list' || widget.type === 'summary') {
        return (
            <Stack gap="sm">
                {(widget.data || []).map((item: any, index: number) => (
                    <Paper key={`${widget.id}-${index}`} p="md" radius="xl" bg="gray.0" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                        <Text fw={700} c="dark.8" size="sm">{item.title || item.label}</Text>
                        <Text c="dimmed" size="xs" mt={4}>
                            {item.narrative || item.value}
                        </Text>
                        {item.recommendation ? (
                            <Text size="xs" mt={8} fw={700} c="blue.6">
                                {item.recommendation}
                            </Text>
                        ) : null}
                    </Paper>
                ))}
            </Stack>
        );
    }

    if (widget.type === 'donut') {
        return (
            <Box style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <PieChart>
                        <Pie data={widget.data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={2} stroke="none">
                            {(widget.data || []).map((_: any, index: number) => (
                                <Cell key={`${widget.id}-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    </PieChart>
                </ResponsiveContainer>
            </Box>
        );
    }

    const commonProps = {
        data: widget.data || [],
        margin: { top: 16, right: 12, left: -20, bottom: 0 },
    };

    if (widget.type === 'bar') {
        return (
            <Box style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey={widget.yKeys?.[0]} radius={[6, 6, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        );
    }

    if (widget.type === 'multi-bar' || widget.type === 'stacked-bar') {
        return (
            <Box style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        {(widget.yKeys || []).map((key: string, index: number) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId={widget.type === 'stacked-bar' ? 'stack' : undefined}
                                radius={widget.type === 'stacked-bar' ? [0, 0, 0, 0] : [6, 6, 0, 0]}
                                fill={COLORS[index % COLORS.length]}
                            />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        );
    }

    if (widget.type === 'line') {
        return (
            <Box style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" dataKey={widget.yKeys?.[0]} stroke="#3b82f6" fill="#eff6ff" fillOpacity={0.8} strokeWidth={3} />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>
        );
    }

    return (
        <Box style={{ height: 240, width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area
                        type="monotone"
                        dataKey={widget.yKeys?.[0]}
                        stroke="#10b981"
                        fill={`url(#gradient-${widget.id})`}
                        strokeWidth={3}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </Box>
    );
};

export const KpiAnalystDashboardView = ({ onBack }: Props) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payload, setPayload] = useState<KpiDashboardPayload | null>(null);
    const [activeTab, setActiveTab] = useState<string | null>('medioambiente');
    const [infoModal, setInfoModal] = useState<{ title: string, what: string, why: string } | null>(null);

    const loadDashboard = async (forceRefresh = false) => {
        try {
            if (forceRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }
            const result = await kpiDashboardService.getDashboard(forceRefresh);
            setPayload(result);
            if (!activeTab) {
                setActiveTab(result.dashboards?.[0]?.key || 'medioambiente');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const activeDashboard = useMemo(
        () => payload?.dashboards?.find((item) => item.key === activeTab) || payload?.dashboards?.[0],
        [payload, activeTab],
    );

    const handleInfoClick = (title: string, what: string, why: string) => {
        setInfoModal({ title, what, why });
    };

    if (loading || !payload || !activeDashboard) {
        return (
            <Paper p="xl" radius="xl" style={{ minHeight: 400, border: '1px solid var(--mantine-color-gray-2)' }} bg="white">
                <Center h={400}>
                    <Stack align="center" gap="md">
                        <Loader size="xl" color="blue" type="bars" />
                        <Title order={3} c="dark.8" fw={800}>Procesando Data Intelligence...</Title>
                        <Text c="dimmed">Construyendo tu Dashboard en tiempo real</Text>
                    </Stack>
                </Center>
            </Paper>
        );
    }

    return (
        <Box style={{ animation: 'fadeIn 0.5s ease', backgroundColor: '#f8fafc', padding: '16px', minHeight: '100vh', borderRadius: '24px' }}>
            <PageHeader 
                title="Dashboard Inteligente"
                subtitle="Análisis automático de métricas operativas, rendimiento de laboratorios y detección de riesgos."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: 'Dashboard Inteligente' }
                ]}
                rightSection={
                    <Group align="center" justify="flex-end" gap="xs" wrap="nowrap">
                        <Text size="xs" c="dimmed" visibleFrom="lg">
                            Actualizado {new Date(payload.generatedAt).toLocaleString('es-CL')}
                        </Text>
                        <Button 
                            leftSection={<IconRefresh size={16} />} 
                            loading={refreshing} 
                            onClick={() => loadDashboard(true)}
                            radius="xl"
                            size="sm"
                            variant="white"
                            color="dark"
                            style={{ border: '1px solid var(--mantine-color-gray-2)' }}
                        >
                            Recalcular
                        </Button>
                    </Group>
                }
            />

            <Box mt="xl">
                <SimpleGrid cols={{ base: 1, md: 4 }} spacing="lg">
                    <Paper p="lg" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Universo</Text>
                        <Text size="2.5rem" fw={800} c="dark.9">{payload.dataProfile.totalRows}</Text>
                        <Text size="sm" c="dimmed">registros procesados</Text>
                    </Paper>
                    <Paper p="lg" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Clientes</Text>
                        <Text size="2.5rem" fw={800} c="dark.9">{payload.dataProfile.uniqueClients}</Text>
                        <Text size="sm" c="dimmed">cuentas activas</Text>
                    </Paper>
                    <Paper p="lg" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Alertas</Text>
                        <Text size="2.5rem" fw={800} c="red.6">{payload.alerts.length}</Text>
                        <Text size="sm" c="dimmed">riesgos detectados</Text>
                    </Paper>
                    <Paper p="lg" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Cobertura</Text>
                        <Text size="2.5rem" fw={800} c="dark.9">{payload.dataProfile.coveredMonths}</Text>
                        <Text size="sm" c="dimmed">meses analizados</Text>
                    </Paper>
                </SimpleGrid>
            </Box>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mt="xl">
                <Paper p="xl" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                    <Group mb="xl">
                        <ThemeIcon color="red" variant="light" size="xl" radius="xl">
                            <IconAlertTriangle size={24} />
                        </ThemeIcon>
                        <Title order={4} c="dark.8">Alertas del Analista</Title>
                    </Group>
                    <Stack gap="md">
                        {payload.alerts.length ? payload.alerts.map((alert, index) => (
                            <Alert key={`${alert.title}-${index}`} color={levelColor[alert.level] || 'blue'} variant="light" title={alert.title} radius="xl" style={{ border: '1px solid transparent' }}>
                                {alert.message}
                            </Alert>
                        )) : <Text c="dimmed">No se han detectado riesgos activos en este periodo.</Text>}
                    </Stack>
                </Paper>

                <Paper p="xl" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                    <Group mb="xl">
                        <ThemeIcon color="grape" variant="light" size="xl" radius="xl">
                            <IconSparkles size={24} />
                        </ThemeIcon>
                        <Title order={4} c="dark.8">Insights Estratégicos</Title>
                    </Group>
                    <Stack gap="sm">
                        {payload.insights.slice(0, 3).map((insight, index) => (
                            <Paper key={`${insight.title}-${index}`} p="md" radius="xl" bg="gray.0" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                                <Group justify="space-between" mb={4}>
                                    <Text fw={700} c="dark.8">{insight.title}</Text>
                                    <Badge color={levelColor[insight.level] || 'blue'} variant="filled" size="sm">{insight.level}</Badge>
                                </Group>
                                <Text size="sm" c="dimmed" lineClamp={2}>{insight.narrative}</Text>
                                <Text size="xs" mt={8} fw={700} c="blue.6">{insight.recommendation}</Text>
                            </Paper>
                        ))}
                    </Stack>
                </Paper>
            </SimpleGrid>

            <Box mt="xl">
                <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false} variant="pills" radius="xl" color="dark">
                    <Tabs.List>
                        {payload.dashboards.map((dashboard) => (
                            <Tabs.Tab key={dashboard.key} value={dashboard.key} leftSection={<IconChartBar size={16} />}>
                                {dashboard.title}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>

                    {payload.dashboards.map((dashboard) => (
                        <Tabs.Panel key={dashboard.key} value={dashboard.key} pt="xl">
                            <Stack gap="xl">
                                <Box>
                                    <Title order={3} c="dark.9">{dashboard.title}</Title>
                                    <Text c="dimmed" mt={4}>{dashboard.description}</Text>
                                </Box>

                                {dashboard.executiveSummary ? (
                                    <Paper p="xl" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                                        <Text fw={800} size="lg" c="dark.9">{dashboard.executiveSummary.headline}</Text>
                                        <Text c="dimmed" mt={8}>{dashboard.executiveSummary.body}</Text>
                                        <Badge mt="md" color={dashboard.executiveSummary.trend.changePct >= 0 ? 'teal' : 'red'} variant="light" size="lg">
                                            Variación {dashboard.executiveSummary.trend.changePct}% vs periodo anterior
                                        </Badge>
                                    </Paper>
                                ) : null}

                                <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="lg">
                                    {dashboard.kpis.map((kpi) => (
                                        <Paper key={kpi.id} p="xl" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                                            <Group justify="space-between" align="flex-start" mb="sm">
                                                <Text size="xs" tt="uppercase" fw={700} c="dimmed">{kpi.title}</Text>
                                                <Badge color={toneMap[kpi.tone] || 'blue'} variant="light" size="sm">Foco</Badge>
                                            </Group>
                                            <Text size="2.5rem" fw={800} c="dark.9" lh={1} mb="xs">{kpi.value}</Text>
                                            <Text size="xs" c="dimmed">{kpi.helper}</Text>
                                        </Paper>
                                    ))}
                                </SimpleGrid>

                                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
                                    {dashboard.widgets.map((widget) => (
                                        <Paper key={widget.id} p="xl" radius="xl" bg="white" shadow="xs" style={{ border: '1px solid var(--mantine-color-gray-2)' }}>
                                            <WidgetHeader widget={widget} onInfoClick={handleInfoClick} />
                                            <Box style={{ minHeight: 240, width: '100%', marginTop: '16px' }}>
                                                {renderWidget(widget)}
                                            </Box>
                                        </Paper>
                                    ))}
                                </SimpleGrid>
                            </Stack>
                        </Tabs.Panel>
                    ))}
                </Tabs>
            </Box>

            {/* Modal para Explicación de Gráficos */}
            {infoModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={() => setInfoModal(null)}>
                    <div style={{
                        backgroundColor: 'white', padding: '3rem', borderRadius: '32px',
                        maxWidth: '600px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        position: 'relative', animation: 'slideUp 0.3s ease-out'
                    }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setInfoModal(null)} style={{
                            position: 'absolute', top: '1.5rem', right: '1.5rem', border: 'none',
                            background: 'none', cursor: 'pointer', color: '#9ca3af'
                        }}>
                            <IconX size={24} />
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                            <ThemeIcon size={56} radius="xl" color="blue" variant="light">
                                <IconInfoCircle size={28} />
                            </ThemeIcon>
                            <Title order={3} fw={800} c="dark.9">{infoModal.title}</Title>
                        </div>

                        <Stack gap="xl">
                            <Box>
                                <Text size="xs" fw={800} c="blue.6" tt="uppercase" lts={1} mb="xs">¿Qué muestra este gráfico?</Text>
                                <Text c="dark.6" size="sm" lh={1.6}>{infoModal.what}</Text>
                            </Box>
                            <Box>
                                <Text size="xs" fw={800} c="blue.6" tt="uppercase" lts={1} mb="xs">¿Para qué sirve?</Text>
                                <Text c="dark.6" size="sm" lh={1.6}>{infoModal.why}</Text>
                            </Box>
                        </Stack>

                        <Button fullWidth size="lg" radius="xl" mt="xl" onClick={() => setInfoModal(null)} color="dark">
                            Entendido
                        </Button>
                    </div>
                </div>
            )}

            <style>{`
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </Box>
    );
};
