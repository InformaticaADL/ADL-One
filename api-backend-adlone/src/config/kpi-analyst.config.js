const kpiAnalystConfig = {
    agent: {
        id: 'adl-kpi-analyst',
        name: 'ADL KPI Analyst',
        version: '1.0.0',
        mode: 'autonomous',
        output: 'dashboard_bundle',
    },
    orchestration: {
        refreshIntervalMs: 15 * 60 * 1000,
        startupDelayMs: 15000,
        eventDebounceMs: 10000,
        defaultWindowDays: 180,
        executionModes: ['startup', 'interval', 'event', 'manual'],
    },
    priorities: {
        criticalThreshold: 80,
        warningThreshold: 60,
    },
    sources: [
        {
            id: 'sql-fichas-agenda',
            type: 'database',
            driver: 'mssql',
            entities: ['fichas', 'agenda', 'clientes', 'centros', 'analisis'],
            refresh: 'batch',
        },
    ],
    domains: {
        medioambiente: {
            label: 'Medioambiente',
            icon: 'leaf',
            objective: 'Controlar volumen, alertas operativas y consumo de servicios ambientales.',
            priorities: ['ejecucion', 'alertas', 'tendencia'],
        },
        calidad: {
            label: 'Calidad',
            icon: 'shield',
            objective: 'Monitorear cumplimiento, desviaciones y carga pendiente de validacion.',
            priorities: ['cumplimiento', 'desviaciones', 'backlog'],
        },
        clientes: {
            label: 'Clientes',
            icon: 'users',
            objective: 'Entender comportamiento, segmentacion y adopcion de servicios.',
            priorities: ['segmentacion', 'uso', 'retencion'],
        },
        gerencial: {
            label: 'Gerencial',
            icon: 'briefcase',
            objective: 'Resumir KPIs globales, riesgos y oportunidades de gestion.',
            priorities: ['resumen', 'riesgos', 'insights'],
        },
    },
};

export default kpiAnalystConfig;
