import { useEffect, useMemo, useState } from 'react';
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
} from '@tabler/icons-react';
import {
    kpiDashboardService,
    type KpiDashboardPayload,
} from '../services/kpi-dashboard.service';
import { PageHeader } from '../../../components/layout/PageHeader';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
    onBack: () => void;
}

const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6b7280', '#ec4899', '#14b8a6'];

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

const toneVariant: Record<string, BadgeVariant> = {
    green: 'success', teal: 'success', lime: 'success', red: 'destructive', blue: 'default',
    orange: 'warning', violet: 'secondary', cyan: 'default', indigo: 'default',
    pink: 'secondary', grape: 'secondary', dark: 'outline', yellow: 'warning',
};

const levelVariant: Record<string, BadgeVariant> = {
    critical: 'destructive',
    warning: 'warning',
    normal: 'default',
};

function DashCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <Card className={cn('rounded-[20px] p-6', className)}>
            {children}
        </Card>
    );
}

const tooltipStyle = { borderRadius: 12, border: '1px solid var(--sc-border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--sc-card)' };

const WidgetHeader = ({ widget, onInfoClick }: { widget: any, onInfoClick: (title: string, what: string, why: string) => void }) => (
    <div className="mb-4 flex items-start justify-between">
        <h5 className="m-0 text-[13px] font-semibold">{widget.title}</h5>
        {widget.help ? (
            <button
                onClick={() => onInfoClick(widget.title, widget.help.what, widget.help.why)}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground"
                title="Explicación detallada"
            >
                <IconInfoCircle size={16} />
            </button>
        ) : null}
    </div>
);

const renderWidget = (widget: any) => {
    if (widget.type === 'table') {
        const columns = (widget.columns || []) as string[];
        const rows = (widget.data || []).map((row: any, i: number) => ({ ...row, key: `${widget.id}-${i}` }));
        return (
            <div className="overflow-hidden rounded-xl border border-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {columns.map((column) => <TableHead key={column}>{column}</TableHead>)}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row: any) => (
                            <TableRow key={row.key}>
                                {columns.map((column) => (
                                    <TableCell key={column} className="text-[12.5px] font-medium">{String(row[column] ?? '-')}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    if (widget.type === 'metric-list' || widget.type === 'summary') {
        return (
            <div className="flex flex-col gap-2.5">
                {(widget.data || []).map((item: any, index: number) => (
                    <div key={`${widget.id}-${index}`} className="rounded-2xl border border-border bg-muted/50 p-4">
                        <span className="block text-[13px] font-semibold">{item.title || item.label}</span>
                        <span className="mt-1 block text-xs text-muted-foreground">{item.narrative || item.value}</span>
                        {item.recommendation ? (
                            <span className="mt-2 block text-xs font-bold text-primary">{item.recommendation}</span>
                        ) : null}
                    </div>
                ))}
            </div>
        );
    }

    if (widget.type === 'donut') {
        return (
            <div className="h-60 w-full min-w-0">
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
            <div className="h-60 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sc-border)" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'var(--sc-muted)' }} contentStyle={tooltipStyle} />
                        <Bar dataKey={widget.yKeys?.[0]} radius={[6, 6, 0, 0]} fill="#0ea5e9" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    }

    if (widget.type === 'multi-bar' || widget.type === 'stacked-bar') {
        return (
            <div className="h-60 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sc-border)" />
                        <XAxis dataKey={widget.xKey} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'var(--sc-muted)' }} contentStyle={tooltipStyle} />
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
            <div className="h-60 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                    <AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sc-border)" />
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
        <div className="h-60 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={1}>
                <AreaChart {...commonProps}>
                    <defs>
                        <linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sc-border)" />
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            <div className="shadcn-scope">
                <DashCard className="flex min-h-[400px] items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <h3 className="m-0 text-lg font-semibold">Procesando Data Intelligence...</h3>
                        <span className="text-muted-foreground">Construyendo tu Dashboard en tiempo real</span>
                    </div>
                </DashCard>
            </div>
        );
    }

    return (
        <div className="shadcn-scope p-2">
            <PageHeader
                title="Dashboard Inteligente"
                subtitle="Análisis automático de métricas operativas, rendimiento de laboratorios y detección de riesgos."
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBack },
                    { label: 'Dashboard Inteligente' }
                ]}
                rightSection={
                    <div className="flex items-center gap-2.5">
                        <span className="text-xs text-muted-foreground">
                            Actualizado {new Date(payload.generatedAt).toLocaleString('es-CL')}
                        </span>
                        <Button variant="outline" disabled={refreshing} onClick={() => loadDashboard(true)}>
                            {refreshing ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : <IconRefresh size={16} />}
                            Recalcular
                        </Button>
                    </div>
                }
            />

            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4">
                <DashCard>
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">Universo</span>
                    <span className="block text-[32px] font-extrabold">{payload.dataProfile.totalRows}</span>
                    <span className="text-[13px] text-muted-foreground">registros procesados</span>
                </DashCard>
                <DashCard>
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">Clientes</span>
                    <span className="block text-[32px] font-extrabold">{payload.dataProfile.uniqueClients}</span>
                    <span className="text-[13px] text-muted-foreground">cuentas activas</span>
                </DashCard>
                <DashCard>
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">Alertas</span>
                    <span className="block text-[32px] font-extrabold text-destructive">{payload.alerts.length}</span>
                    <span className="text-[13px] text-muted-foreground">riesgos detectados</span>
                </DashCard>
                <DashCard>
                    <span className="text-[11px] font-bold uppercase text-muted-foreground">Cobertura</span>
                    <span className="block text-[32px] font-extrabold">{payload.dataProfile.coveredMonths}</span>
                    <span className="text-[13px] text-muted-foreground">meses analizados</span>
                </DashCard>
            </div>

            <div className="mt-6 grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-4">
                <DashCard>
                    <div className="mb-6 flex items-center gap-3">
                        <IconCircle color="#e03131"><IconAlertTriangle size={24} /></IconCircle>
                        <h5 className="m-0 text-base font-semibold">Alertas del Analista</h5>
                    </div>
                    <div className="flex flex-col gap-3">
                        {payload.alerts.length ? payload.alerts.map((alert, index) => (
                            <InlineAlert key={`${alert.title}-${index}`} variant={levelVariant[alert.level] || 'default'} title={alert.title} message={alert.message} />
                        )) : <span className="text-muted-foreground">No se han detectado riesgos activos en este periodo.</span>}
                    </div>
                </DashCard>

                <DashCard>
                    <div className="mb-6 flex items-center gap-3">
                        <IconCircle color="#9c36b5"><IconSparkles size={24} /></IconCircle>
                        <h5 className="m-0 text-base font-semibold">Insights Estratégicos</h5>
                    </div>
                    <div className="flex flex-col gap-2.5">
                        {payload.insights.slice(0, 3).map((insight, index) => (
                            <div key={`${insight.title}-${index}`} className="rounded-2xl border border-border bg-muted/50 p-4">
                                <div className="mb-1 flex justify-between">
                                    <span className="text-[13px] font-semibold">{insight.title}</span>
                                    <Badge variant={levelVariant[insight.level] || 'default'}>{insight.level}</Badge>
                                </div>
                                <p className="m-0 line-clamp-2 text-[12.5px] text-muted-foreground">{insight.narrative}</p>
                                <span className="mt-2 block text-xs font-bold text-primary">{insight.recommendation}</span>
                            </div>
                        ))}
                    </div>
                </DashCard>
            </div>

            <div className="mt-6">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="flex-wrap">
                        {payload.dashboards.map((dashboard) => (
                            <TabsTrigger key={dashboard.key} value={dashboard.key}>
                                <IconChartBar size={16} className="mr-1.5" />{dashboard.title}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {payload.dashboards.map((dashboard) => (
                        <TabsContent key={dashboard.key} value={dashboard.key}>
                            <div className="flex flex-col gap-6">
                                <div>
                                    <h4 className="m-0 text-lg font-semibold">{dashboard.title}</h4>
                                    <p className="mt-1 text-muted-foreground">{dashboard.description}</p>
                                </div>

                                {dashboard.executiveSummary ? (
                                    <DashCard>
                                        <span className="text-[17px] font-semibold">{dashboard.executiveSummary.headline}</span>
                                        <p className="mt-2 text-muted-foreground">{dashboard.executiveSummary.body}</p>
                                        <Badge variant={dashboard.executiveSummary.trend.changePct >= 0 ? 'default' : 'destructive'} className="mt-3 px-2.5 py-1 text-[13px]">
                                            Variación {dashboard.executiveSummary.trend.changePct}% vs periodo anterior
                                        </Badge>
                                    </DashCard>
                                ) : null}

                                <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
                                    {dashboard.kpis.map((kpi) => (
                                        <DashCard key={kpi.id}>
                                            <div className="mb-2 flex items-start justify-between">
                                                <span className="text-[11px] font-bold uppercase text-muted-foreground">{kpi.title}</span>
                                                <Badge variant={toneVariant[kpi.tone] || 'default'}>Foco</Badge>
                                            </div>
                                            <span className="mb-1.5 block text-[32px] font-extrabold leading-none">{kpi.value}</span>
                                            <span className="text-xs text-muted-foreground">{kpi.helper}</span>
                                        </DashCard>
                                    ))}
                                </div>

                                <div className="grid grid-cols-[repeat(auto-fit,minmax(360px,1fr))] gap-4">
                                    {dashboard.widgets.map((widget) => (
                                        <DashCard key={widget.id}>
                                            <WidgetHeader widget={widget} onInfoClick={handleInfoClick} />
                                            <div className="min-h-60 w-full">
                                                {renderWidget(widget)}
                                            </div>
                                        </DashCard>
                                    ))}
                                </div>
                            </div>
                        </TabsContent>
                    ))}
                </Tabs>
            </div>

            <Dialog open={!!infoModal} onOpenChange={(open) => !open && setInfoModal(null)}>
                <DialogContent className="max-h-[85vh] max-w-[640px] overflow-y-auto rounded-3xl p-8">
                    {infoModal && (
                        <>
                            <DialogHeader className="mb-2 flex-row items-center gap-4 space-y-0">
                                <IconCircle color="#1677ff" size={56}><IconInfoCircle size={28} /></IconCircle>
                                <div>
                                    <span className="block text-[11px] font-extrabold uppercase tracking-wide text-primary">Explicación Detallada</span>
                                    <h4 className="m-0 text-lg font-semibold">{infoModal.title}</h4>
                                </div>
                            </DialogHeader>

                            <div className="flex flex-col gap-5">
                                <div>
                                    <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-primary">¿Qué muestra este gráfico?</span>
                                    <p className="text-[13.5px] leading-relaxed">{infoModal.what}</p>
                                </div>
                                <div>
                                    <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-primary">¿Para qué sirve?</span>
                                    <p className="text-[13.5px] leading-relaxed">{infoModal.why}</p>
                                </div>
                            </div>

                            <Button size="lg" variant="outline" className="mt-6 w-full" onClick={() => setInfoModal(null)}>Entendido</Button>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

const ALERT_STYLES: Record<BadgeVariant, string> = {
    default: 'border-primary/30 bg-primary/10 text-primary',
    secondary: 'border-secondary/30 bg-secondary/40 text-secondary-foreground',
    outline: 'border-border bg-muted/50 text-foreground',
    success: 'border-success/30 bg-success/10 text-success',
    warning: 'border-warning/30 bg-warning/10 text-warning',
    destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
};

function InlineAlert({ variant, title, message }: { variant: BadgeVariant; title: string; message: string }) {
    return (
        <div className={cn('rounded-2xl border px-4 py-3', ALERT_STYLES[variant])}>
            <span className="block text-sm font-semibold">{title}</span>
            <span className="mt-0.5 block text-xs">{message}</span>
        </div>
    );
}

function IconCircle({ children, color, size = 44 }: { children: React.ReactNode; color: string; size?: number }) {
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{ width: size, height: size, backgroundColor: `${color}1f`, color }}
        >
            {children}
        </div>
    );
}
