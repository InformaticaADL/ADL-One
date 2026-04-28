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
    Tooltip as MantineTooltip,
    Title,
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
    IconArrowLeft,
    IconChartBar,
    IconRefresh,
    IconSparkles,
    IconInfoCircle,
} from '@tabler/icons-react';
import {
    kpiDashboardService,
    type KpiDashboardPayload,
} from '../services/kpi-dashboard.service';

interface Props {
    onBack: () => void;
}

const COLORS = ['#0f766e', '#0284c7', '#f59e0b', '#e11d48', '#7c3aed', '#65a30d'];

const toneMap: Record<string, string> = {
    green: '#15803d',
    teal: '#0f766e',
    lime: '#65a30d',
    red: '#dc2626',
    blue: '#2563eb',
    orange: '#ea580c',
    violet: '#7c3aed',
    cyan: '#0891b2',
    indigo: '#4f46e5',
    pink: '#db2777',
    grape: '#7e22ce',
    dark: '#1f2937',
    yellow: '#ca8a04',
};

const levelColor: Record<string, string> = {
    critical: 'red',
    warning: 'yellow',
    normal: 'blue',
};

const WidgetHeader = ({ widget }: { widget: any }) => (
    <Group justify="space-between" align="flex-start" mb="md">
        <Title order={4} c="blue.9">{widget.title}</Title>
        {widget.help ? (
            <MantineTooltip
                multiline
                w={320}
                withArrow
                label={
                    <Box>
                        <Text fw={700} size="sm" c="blue.9">Que es</Text>
                        <Text size="sm">{widget.help.what}</Text>
                        <Text fw={700} size="sm" mt="sm" c="blue.9">Para que sirve</Text>
                        <Text size="sm">{widget.help.why}</Text>
                    </Box>
                }
            >
                <ActionIcon variant="light" color="blue" radius="xl" aria-label={`Informacion de ${widget.title}`}>
                    <IconInfoCircle size={16} />
                </ActionIcon>
            </MantineTooltip>
        ) : null}
    </Group>
);

const renderWidget = (widget: any) => {
    if (widget.type === 'table') {
        return (
            <Table striped highlightOnHover withTableBorder>
                <Table.Thead>
                    <Table.Tr>
                        {(widget.columns || []).map((column: string) => (
                            <Table.Th key={column}>{column}</Table.Th>
                        ))}
                    </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {(widget.data || []).map((row: any, index: number) => (
                        <Table.Tr key={`${widget.id}-${index}`}>
                            {(widget.columns || []).map((column: string) => (
                                <Table.Td key={column}>{String(row[column] ?? '-')}</Table.Td>
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
                    <Paper key={`${widget.id}-${index}`} p="md" radius="md" bg="gray.0" withBorder>
                        <Text fw={700} c="blue.9">{item.title || item.label}</Text>
                        <Text c="dimmed" size="sm">
                            {item.narrative || item.value}
                        </Text>
                        {item.recommendation ? (
                            <Text size="xs" mt={6} c="blue.9">
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
            <Box style={{ height: 280, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <PieChart>
                        <Pie data={widget.data} dataKey="value" nameKey="name" innerRadius={65} outerRadius={95}>
                            {(widget.data || []).map((_: any, index: number) => (
                                <Cell key={`${widget.id}-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
            </Box>
        );
    }

    const commonProps = {
        data: widget.data || [],
        margin: { top: 16, right: 12, left: 0, bottom: 0 },
    };

    if (widget.type === 'bar') {
        return (
            <Box style={{ height: 280, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey={widget.yKeys?.[0]} radius={[8, 8, 0, 0]} fill="#0f766e" />
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        );
    }

    if (widget.type === 'multi-bar' || widget.type === 'stacked-bar') {
        return (
            <Box style={{ height: 280, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        {(widget.yKeys || []).map((key: string, index: number) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                stackId={widget.type === 'stacked-bar' ? 'stack' : undefined}
                                radius={widget.type === 'stacked-bar' ? [0, 0, 0, 0] : [8, 8, 0, 0]}
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
            <Box style={{ height: 280, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey={widget.yKeys?.[0]} stroke="#2563eb" fill="#bfdbfe" fillOpacity={0.8} />
                    </AreaChart>
                </ResponsiveContainer>
            </Box>
        );
    }

    return (
        <Box style={{ height: 280, width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0f766e" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey={widget.xKey} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                        type="monotone"
                        dataKey={widget.yKeys?.[0]}
                        stroke="#0f766e"
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

    if (loading || !payload || !activeDashboard) {
        return (
            <Paper p="xl" radius="xl" withBorder>
                <Text>Cargando dashboard de KPIs...</Text>
            </Paper>
        );
    }

    return (
        <Box>
            <Paper
                radius="xl"
                p="xl"
                withBorder
                style={{
                    background: 'linear-gradient(135deg, #ecfeff 0%, #eff6ff 45%, #fefce8 100%)',
                    overflow: 'hidden',
                }}
            >
                <Group justify="space-between" align="flex-start">
                    <Stack gap="xs">
                        <Group gap="sm">
                            <ActionIcon variant="white" radius="xl" size="lg" onClick={onBack}>
                                <IconArrowLeft size={18} />
                            </ActionIcon>
                            <ThemeIcon size={48} radius="xl" color="blue" variant="filled">
                                <IconChartBar size={24} />
                            </ThemeIcon>
                        </Group>
                        <Title order={1} c="blue.9">Dashboard Inteligente</Title>
                        <Text maw={760} c="dimmed">
                            Análisis automático de métricas operativas, rendimiento de laboratorios y detección de riesgos en la gestión de servicios ambientales.
                        </Text>
                    </Stack>

                    <Stack align="flex-end" gap="sm">
                        <Button leftSection={<IconRefresh size={16} />} loading={refreshing} onClick={() => loadDashboard(true)}>
                            Recalcular
                        </Button>
                        <Text size="sm" c="dimmed">
                            Actualizado {new Date(payload.generatedAt).toLocaleString('es-CL')}
                        </Text>
                    </Stack>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 4 }} spacing="lg" mt="xl">
                    <Paper p="md" radius="lg" withBorder bg="white">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Universo</Text>
                        <Text size="2rem" fw={800} c="blue.9">{payload.dataProfile.totalRows}</Text>
                        <Text size="sm" c="dimmed">registros procesados</Text>
                    </Paper>
                    <Paper p="md" radius="lg" withBorder bg="white">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Clientes</Text>
                        <Text size="2rem" fw={800} c="blue.9">{payload.dataProfile.uniqueClients}</Text>
                        <Text size="sm" c="dimmed">cuentas activas</Text>
                    </Paper>
                    <Paper p="md" radius="lg" withBorder bg="white">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Alertas</Text>
                        <Text size="2rem" fw={800} c="blue.9">{payload.alerts.length}</Text>
                        <Text size="sm" c="dimmed">riesgos detectados</Text>
                    </Paper>
                    <Paper p="md" radius="lg" withBorder bg="white">
                        <Text size="xs" tt="uppercase" fw={700} c="dimmed">Cobertura</Text>
                        <Text size="2rem" fw={800} c="blue.9">{payload.dataProfile.coveredMonths}</Text>
                        <Text size="sm" c="dimmed">meses analizados</Text>
                    </Paper>
                </SimpleGrid>
            </Paper>

            <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg" mt="lg">
                <Paper p="lg" radius="xl" withBorder shadow="sm">
                    <Group mb="md">
                        <ThemeIcon color="red" variant="light" size="lg" radius="md">
                            <IconAlertTriangle size={22} />
                        </ThemeIcon>
                        <Title order={4} c="blue.9">Alertas del Analista</Title>
                    </Group>
                    <Stack gap="sm">
                        {payload.alerts.length ? payload.alerts.map((alert, index) => (
                            <Alert key={`${alert.title}-${index}`} color={levelColor[alert.level] || 'blue'} variant="light" title={alert.title} radius="md">
                                {alert.message}
                            </Alert>
                        )) : <Text c="dimmed">No se han detectado riesgos activos en este periodo.</Text>}
                    </Stack>
                </Paper>

                <Paper p="lg" radius="xl" withBorder shadow="sm">
                    <Group mb="md">
                        <ThemeIcon color="grape" variant="light" size="lg" radius="md">
                            <IconSparkles size={22} />
                        </ThemeIcon>
                        <Title order={4} c="blue.9">Insights Estratégicos</Title>
                    </Group>
                    <Stack gap="sm">
                        {payload.insights.slice(0, 3).map((insight, index) => (
                            <Paper key={`${insight.title}-${index}`} p="sm" radius="md" bg="gray.0" withBorder>
                                <Group justify="space-between" mb={4}>
                                    <Text fw={700} c="blue.9">{insight.title}</Text>
                                    <Badge color={levelColor[insight.level] || 'blue'} variant="filled">{insight.level}</Badge>
                                </Group>
                                <Text size="sm" c="dimmed" lineClamp={2}>{insight.narrative}</Text>
                                <Text size="xs" mt={6} fw={600} c="blue.7">{insight.recommendation}</Text>
                            </Paper>
                        ))}
                    </Stack>
                </Paper>
            </SimpleGrid>

            <Paper p="lg" radius="xl" withBorder mt="lg" shadow="sm">
                <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
                    <Tabs.List>
                        {payload.dashboards.map((dashboard) => (
                            <Tabs.Tab key={dashboard.key} value={dashboard.key} leftSection={<IconChartBar size={16} />}>
                                {dashboard.title}
                            </Tabs.Tab>
                        ))}
                    </Tabs.List>

                    {payload.dashboards.map((dashboard) => (
                        <Tabs.Panel key={dashboard.key} value={dashboard.key} pt="lg">
                            <Stack gap="lg">
                                <Box>
                                    <Title order={3} c="blue.9">{dashboard.title}</Title>
                                    <Text c="dimmed">{dashboard.description}</Text>
                                </Box>

                                {dashboard.executiveSummary ? (
                                    <Paper p="lg" radius="lg" withBorder bg="gray.0" shadow="xs">
                                        <Text fw={800} size="lg" c="blue.9">{dashboard.executiveSummary.headline}</Text>
                                        <Text c="dimmed" mt={4}>{dashboard.executiveSummary.body}</Text>
                                        <Badge mt="sm" color={dashboard.executiveSummary.trend.changePct >= 0 ? 'teal' : 'red'} variant="light">
                                            variación {dashboard.executiveSummary.trend.changePct}% vs periodo anterior
                                        </Badge>
                                    </Paper>
                                ) : null}

                                <SimpleGrid cols={{ base: 1, sm: 2, xl: 4 }} spacing="md">
                                    {dashboard.kpis.map((kpi) => (
                                        <Paper key={kpi.id} p="md" radius="lg" withBorder style={{ borderTop: `4px solid ${toneMap[kpi.tone] || '#2563eb'}` }} shadow="xs">
                                            <Text size="xs" tt="uppercase" fw={700} c="dimmed">{kpi.title}</Text>
                                            <Text size="1.75rem" fw={800} c="blue.9">{kpi.value}</Text>
                                            <Text size="sm" c="dimmed">{kpi.helper}</Text>
                                        </Paper>
                                    ))}
                                </SimpleGrid>

                                <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg">
                                    {dashboard.widgets.map((widget) => (
                                        <Paper key={widget.id} p="lg" radius="lg" withBorder shadow="xs">
                                            <WidgetHeader widget={widget} />
                                            <Box style={{ minHeight: 280, width: '100%' }}>
                                                {renderWidget(widget)}
                                            </Box>
                                        </Paper>
                                    ))}
                                </SimpleGrid>
                            </Stack>
                        </Tabs.Panel>
                    ))}
                </Tabs>
            </Paper>
        </Box>
    );
};
