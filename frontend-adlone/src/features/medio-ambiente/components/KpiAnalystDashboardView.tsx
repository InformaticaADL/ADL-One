import { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Tabs, Table, Modal, Spin, Typography, Alert as AntAlert } from 'antd';
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

const { Text, Title } = Typography;

interface Props {
    onBack: () => void;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

const toneMap: Record<string, string> = {
    green: 'green', teal: 'cyan', lime: 'lime', red: 'red', blue: 'blue',
    orange: 'orange', violet: 'purple', cyan: 'cyan', indigo: 'geekblue',
    pink: 'magenta', grape: 'purple', dark: 'default', yellow: 'gold',
};

const levelColor: Record<string, string> = {
    critical: 'red',
    warning: 'orange',
    normal: 'blue',
};

function DashCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            borderRadius: 20, padding: 24, backgroundColor: 'var(--app-bg)',
            border: '1px solid var(--app-border)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            boxSizing: 'border-box', ...style,
        }}>
            {children}
        </div>
    );
}

const tooltipStyle = { borderRadius: 12, border: '1px solid var(--app-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--app-bg-elevated)' };

const WidgetHeader = ({ widget, onInfoClick }: { widget: any, onInfoClick: (title: string, what: string, why: string) => void }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <Title level={5} style={{ margin: 0, fontSize: 13 }}>{widget.title}</Title>
        {widget.help ? (
            <button
                onClick={() => onInfoClick(widget.title, widget.help.what, widget.help.why)}
                style={{
                    width: 28, height: 28, borderRadius: 8, backgroundColor: 'var(--app-bg)',
                    border: '1px solid var(--app-border)', color: 'var(--app-text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
                title="Explicación detallada"
            >
                <IconInfoCircle size={16} />
            </button>
        ) : null}
    </div>
);

const renderWidget = (widget: any) => {
    if (widget.type === 'table') {
        const columns = (widget.columns || []).map((column: string) => ({
            title: column, dataIndex: column,
            render: (v: any) => <Text style={{ fontSize: 12.5, fontWeight: 500 }}>{String(v ?? '-')}</Text>,
        }));
        return (
            <Table
                size="small"
                columns={columns}
                dataSource={(widget.data || []).map((row: any, i: number) => ({ ...row, key: `${widget.id}-${i}` }))}
                pagination={false}
                style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--app-border)' }}
            />
        );
    }

    if (widget.type === 'metric-list' || widget.type === 'summary') {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(widget.data || []).map((item: any, index: number) => (
                    <div key={`${widget.id}-${index}`} style={{ padding: 16, borderRadius: 16, backgroundColor: 'var(--app-hover-bg)', border: '1px solid var(--app-border)' }}>
                        <Text strong style={{ fontSize: 13, display: 'block' }}>{item.title || item.label}</Text>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{item.narrative || item.value}</Text>
                        {item.recommendation ? (
                            <Text style={{ fontSize: 12, marginTop: 8, fontWeight: 700, color: 'var(--app-accent-text)', display: 'block' }}>{item.recommendation}</Text>
                        ) : null}
                    </div>
                ))}
            </div>
        );
    }

    if (widget.type === 'donut') {
        return (
            <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <PieChart>
                        <Pie data={widget.data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} paddingAngle={2} stroke="none">
                            {(widget.data || []).map((_: any, index: number) => (
                                <Cell key={`${widget.id}-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    }

    const commonProps = {
        data: widget.data || [],
        margin: { top: 16, right: 12, left: -20, bottom: 0 },
    };

    if (widget.type === 'bar') {
        return (
            <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: 'var(--app-hover-bg)'}} contentStyle={tooltipStyle} />
                        <Bar dataKey={widget.yKeys?.[0]} radius={[6, 6, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (widget.type === 'multi-bar' || widget.type === 'stacked-bar') {
        return (
            <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{fill: 'var(--app-hover-bg)'}} contentStyle={tooltipStyle} />
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
            </div>
        );
    }

    if (widget.type === 'line') {
        return (
            <div style={{ height: 240, width: '100%', minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey={widget.yKeys?.[0]} stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} strokeWidth={3} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }

    return (
        <div style={{ height: 240, width: '100%', minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" />
                    <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area
                        type="monotone"
                        dataKey={widget.yKeys?.[0]}
                        stroke="#10b981"
                        fill={`url(#gradient-${widget.id})`}
                        strokeWidth={3}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export const KpiAnalystDashboardView = ({ onBack }: Props) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [payload, setPayload] = useState<KpiDashboardPayload | null>(null);
    const [activeTab, setActiveTab] = useState<string>('medioambiente');
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
            <DashCard style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                    <Spin size="large" />
                    <Title level={3} style={{ margin: 0 }}>Procesando Data Intelligence...</Title>
                    <Text type="secondary">Construyendo tu Dashboard en tiempo real</Text>
                </div>
            </DashCard>
        );
    }

    return (
        <div style={{ padding: 8 }}>
            <PageHeader
                title="Dashboard Inteligente"
                subtitle="Análisis automático de métricas operativas, rendimiento de laboratorios y detección de riesgos."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: 'Dashboard Inteligente' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            Actualizado {new Date(payload.generatedAt).toLocaleString('es-CL')}
                        </Text>
                        <Button icon={<IconRefresh size={16} />} loading={refreshing} onClick={() => loadDashboard(true)}>
                            Recalcular
                        </Button>
                    </div>
                }
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginTop: 24 }}>
                <DashCard>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Universo</Text>
                    <Text style={{ fontSize: 32, fontWeight: 800, display: 'block' }}>{payload.dataProfile.totalRows}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>registros procesados</Text>
                </DashCard>
                <DashCard>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Clientes</Text>
                    <Text style={{ fontSize: 32, fontWeight: 800, display: 'block' }}>{payload.dataProfile.uniqueClients}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>cuentas activas</Text>
                </DashCard>
                <DashCard>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Alertas</Text>
                    <Text style={{ fontSize: 32, fontWeight: 800, display: 'block', color: '#e03131' }}>{payload.alerts.length}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>riesgos detectados</Text>
                </DashCard>
                <DashCard>
                    <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Cobertura</Text>
                    <Text style={{ fontSize: 32, fontWeight: 800, display: 'block' }}>{payload.dataProfile.coveredMonths}</Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>meses analizados</Text>
                </DashCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 24 }}>
                <DashCard>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <IconCircle color="#e03131"><IconAlertTriangle size={24} /></IconCircle>
                        <Title level={5} style={{ margin: 0 }}>Alertas del Analista</Title>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {payload.alerts.length ? payload.alerts.map((alert, index) => (
                            <AntAlert
                                key={`${alert.title}-${index}`}
                                type={(levelColor[alert.level] === 'red' ? 'error' : levelColor[alert.level] === 'orange' ? 'warning' : 'info')}
                                showIcon
                                message={alert.title}
                                description={alert.message}
                                style={{ borderRadius: 16 }}
                            />
                        )) : <Text type="secondary">No se han detectado riesgos activos en este periodo.</Text>}
                    </div>
                </DashCard>

                <DashCard>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                        <IconCircle color="#9c36b5"><IconSparkles size={24} /></IconCircle>
                        <Title level={5} style={{ margin: 0 }}>Insights Estratégicos</Title>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {payload.insights.slice(0, 3).map((insight, index) => (
                            <div key={`${insight.title}-${index}`} style={{ padding: 16, borderRadius: 16, backgroundColor: 'var(--app-hover-bg)', border: '1px solid var(--app-border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <Text strong style={{ fontSize: 13 }}>{insight.title}</Text>
                                    <Tag color={levelColor[insight.level] || 'blue'}>{insight.level}</Tag>
                                </div>
                                <Text type="secondary" style={{
                                    fontSize: 12.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                }}>{insight.narrative}</Text>
                                <Text style={{ fontSize: 12, marginTop: 8, fontWeight: 700, color: 'var(--app-accent-text)', display: 'block' }}>{insight.recommendation}</Text>
                            </div>
                        ))}
                    </div>
                </DashCard>
            </div>

            <div style={{ marginTop: 24 }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={payload.dashboards.map((dashboard) => ({
                        key: dashboard.key,
                        label: <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconChartBar size={16} />{dashboard.title}</span>,
                        children: (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                <div>
                                    <Title level={4} style={{ margin: 0 }}>{dashboard.title}</Title>
                                    <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>{dashboard.description}</Text>
                                </div>

                                {dashboard.executiveSummary ? (
                                    <DashCard>
                                        <Text strong style={{ fontSize: 17 }}>{dashboard.executiveSummary.headline}</Text>
                                        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>{dashboard.executiveSummary.body}</Text>
                                        <Tag color={dashboard.executiveSummary.trend.changePct >= 0 ? 'cyan' : 'red'} style={{ marginTop: 12, fontSize: 13, padding: '4px 10px' }}>
                                            Variación {dashboard.executiveSummary.trend.changePct}% vs periodo anterior
                                        </Tag>
                                    </DashCard>
                                ) : null}

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                                    {dashboard.kpis.map((kpi) => (
                                        <DashCard key={kpi.id}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                <Text type="secondary" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>{kpi.title}</Text>
                                                <Tag color={toneMap[kpi.tone] || 'blue'}>Foco</Tag>
                                            </div>
                                            <Text style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, display: 'block', marginBottom: 6 }}>{kpi.value}</Text>
                                            <Text type="secondary" style={{ fontSize: 12 }}>{kpi.helper}</Text>
                                        </DashCard>
                                    ))}
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                                    {dashboard.widgets.map((widget) => (
                                        <DashCard key={widget.id}>
                                            <WidgetHeader widget={widget} onInfoClick={handleInfoClick} />
                                            <div style={{ minHeight: 240, width: '100%' }}>
                                                {renderWidget(widget)}
                                            </div>
                                        </DashCard>
                                    ))}
                                </div>
                            </div>
                        ),
                    }))}
                />
            </div>

            <Modal
                open={!!infoModal}
                onCancel={() => setInfoModal(null)}
                closable={false}
                width={640}
                footer={null}
                styles={{ root: { borderRadius: 24 }, body: { padding: 32 } }}
            >
                {infoModal && (
                    <div style={{ maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                        <Button type="text" shape="circle" icon={<IconX size={20} />} onClick={() => setInfoModal(null)} style={{ position: 'absolute', top: 0, right: 0 }} />

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                            <IconCircle color="#0062a8" size={56}><IconInfoCircle size={28} /></IconCircle>
                            <div>
                                <Text style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-accent-text)', textTransform: 'uppercase', letterSpacing: 1, display: 'block' }}>Explicación Detallada</Text>
                                <Title level={4} style={{ margin: 0 }}>{infoModal.title}</Title>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <div>
                                <Text style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-accent-text)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>¿Qué muestra este gráfico?</Text>
                                <Text style={{ fontSize: 13.5, lineHeight: 1.6 }}>{infoModal.what}</Text>
                            </div>
                            <div>
                                <Text style={{ fontSize: 11, fontWeight: 800, color: 'var(--app-accent-text)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>¿Para qué sirve?</Text>
                                <Text style={{ fontSize: 13.5, lineHeight: 1.6 }}>{infoModal.why}</Text>
                            </div>
                        </div>

                        <Button block size="large" style={{ marginTop: 24 }} onClick={() => setInfoModal(null)}>Entendido</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
};

function IconCircle({ children, color, size = 44 }: { children: React.ReactNode; color: string; size?: number }) {
    return (
        <div style={{
            flexShrink: 0, width: size, height: size, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: `${color}1f`, color,
        }}>
            {children}
        </div>
    );
}
