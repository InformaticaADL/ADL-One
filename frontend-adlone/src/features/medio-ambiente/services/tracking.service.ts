import apiClient from '../../../config/axios.config';

export interface UltimaPosicion {
    latitud: number;
    longitud: number;
    timestamp_reporte: string;
}

export interface FichaHoy {
    id_agendamam: number;
    frecuencia_correlativo: string;
    id_muestreador: number;
    id_muestreador2: number | null;
    fecha_muestreo: string | null;
    fecha_retiro: string | null;
    hora_coordinador: string | null;
    estado_caso: string | null;
    instalacion_completado: string | null;
    retiro_completado: string | null;
    id_estadomuestreo: number | null;
    empresa: string | null;
    centro: string | null;
    objetivo: string | null;
    tiempo_trabajo_minutos: number | null;
    tiempo_estimado_minutos: number | null;
}

export interface JornadaHoy {
    id_jornada: number;
    id_muestreador: number;
    nombre_muestreador: string;
    fecha_inicio: string;
    // Inicio del tramo ACTIVO (null si no hay ninguno abierto) — distinto de
    // fecha_inicio, que es el inicio del PRIMER tramo del día. Junto con
    // horas_trabajadas_cerradas_minutos, permite que el tick en vivo del
    // frontend avance sin contar el tiempo de una pausa anterior del mismo
    // día como si fuera trabajo.
    fecha_inicio_tramo_actual: string | null;
    fecha_fin: string | null;
    estado: 'en_ruta' | 'pausada' | 'finalizada';
    horas_trabajadas_minutos: number;
    horas_trabajadas_cerradas_minutos: number;
    km_recorridos: number;
    bateria_inicio: number | null;
    bateria_fin: number | null;
    ultima_posicion: UltimaPosicion | null;
    fichas_hoy: FichaHoy[];
}

export interface HistorialDia {
    id_muestreador: number;
    nombre_muestreador: string;
    dia: string; // 'YYYY-MM-DD'
    num_jornadas: number;
    horas_trabajadas_minutos: number;
    km_recorridos: number;
    bateria_inicio: number | null;
    bateria_fin: number | null;
    fichas_completadas: number;
    fichas_total: number;
}

export interface FichaVisitadaDia {
    id_agendamam: number;
    frecuencia_correlativo: string;
    nombre_centro: string;
    nombre_empresa: string;
    lat: number;
    lon: number;
    tipo: 'instalacion' | 'retiro';
    hora: string;
}

export interface HistorialDiaDetalle {
    jornadas: Array<{ id_jornada: number; fecha_inicio: string; fecha_fin: string | null }>;
    fichas_visitadas: FichaVisitadaDia[];
}

export const trackingService = {
    getSnapshotHoy: async (): Promise<JornadaHoy[]> => {
        const response = await apiClient.get('/api/tracking/hoy');
        return response.data.data.jornadas;
    },

    getHistorial: async (fechaDesde: string, fechaHasta: string): Promise<HistorialDia[]> => {
        const response = await apiClient.get('/api/tracking/historial', {
            params: { fecha_desde: fechaDesde, fecha_hasta: fechaHasta },
        });
        return response.data.data.dias;
    },

    getHistorialDia: async (idMuestreador: number, dia: string): Promise<HistorialDiaDetalle> => {
        const response = await apiClient.get('/api/tracking/historial/dia', {
            params: { id_muestreador: idMuestreador, dia },
        });
        return response.data.data;
    },
};
