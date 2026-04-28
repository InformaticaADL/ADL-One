import apiClient from '../../../config/axios.config';

export interface KpiDashboardPayload {
    generatedAt: string;
    execution: {
        mode: string;
        source: string;
        usedFallback: boolean;
    };
    configuration: {
        agent: {
            id: string;
            name: string;
            version: string;
        };
        orchestration: {
            refreshIntervalMs: number;
            executionModes: string[];
        };
    };
    dataProfile: {
        totalRows: number;
        uniqueClients: number;
        uniqueCenters: number;
        uniqueSamplers: number;
        coveredMonths: number;
    };
    automation: {
        steps: { id: string; title: string; status: string }[];
        triggers: {
            interval: string;
            event: string;
            manual: string;
        };
    };
    alerts: { level: string; title: string; message: string }[];
    insights: { level: string; title: string; narrative: string; recommendation: string }[];
    dashboards: {
        key: string;
        title: string;
        description: string;
        executiveSummary?: {
            headline: string;
            body: string;
            trend: {
                current: number;
                previous: number;
                changePct: number;
            };
        };
        kpis: { id: string; title: string; value: string | number; helper: string; tone: string }[];
        widgets: any[];
        filters: string[];
        insights: { level: string; title: string; narrative: string; recommendation: string }[];
    }[];
}

export interface KpiDashboardStatus {
    running: boolean;
    lastRunAt: string | null;
    lastError: string | null;
    history: { generatedAt: string; mode: string; totalRows: number; usedFallback: boolean }[];
}

export interface ExcelDashboardPayload {
    fileName: string;
    generatedAt: string;
    profile: {
        sheets: number;
        rows: number;
        columns: number;
        numericColumns: string[];
        dateColumns: string[];
        categoryColumns: string[];
        hoursColumns?: string[];
    };
    kpis: { id: string; title: string; value: string | number; helper: string; tone: string }[];
    widgets: any[];
    insights: { level: string; title: string; narrative: string; recommendation: string }[];
    sheets: {
        sheetName: string;
        profile: {
            rows: number;
            columns: number;
            numericColumns: string[];
            dateColumns: string[];
            categoryColumns: string[];
            hoursColumns?: string[];
        };
        kpis: { id: string; title: string; value: string | number; helper: string; tone: string }[];
        widgets: any[];
        insights: { level: string; title: string; narrative: string; recommendation: string }[];
    }[];
}

export const kpiDashboardService = {
    async getDashboard(refresh = false): Promise<KpiDashboardPayload> {
        const response = await apiClient.get('/api/analysis/dashboard-kpis', {
            params: refresh ? { refresh: true } : undefined,
        });
        return response.data.data;
    },

    async execute(windowDays?: number): Promise<KpiDashboardPayload> {
        const response = await apiClient.post('/api/analysis/dashboard-kpis/execute', {
            windowDays,
        });
        return response.data.data;
    },

    async getStatus(): Promise<KpiDashboardStatus> {
        const response = await apiClient.get('/api/analysis/dashboard-kpis/status');
        return response.data.data;
    },

    async notifyEvent(type: string, source = 'frontend'): Promise<KpiDashboardPayload> {
        const response = await apiClient.post('/api/analysis/dashboard-kpis/events', {
            type,
            source,
        });
        return response.data.data;
    },

    async analyzeExcel(file: File): Promise<ExcelDashboardPayload> {
        const formData = new FormData();
        formData.append('archivo', file);

        const response = await apiClient.post('/api/analysis/dashboard-kpis/excel', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        return response.data.data;
    },
};
