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
}

export interface JornadaHoy {
    id_jornada: number;
    id_muestreador: number;
    nombre_muestreador: string;
    fecha_inicio: string;
    ultima_posicion: UltimaPosicion | null;
    fichas_hoy: FichaHoy[];
}

export const trackingService = {
    getSnapshotHoy: async (): Promise<JornadaHoy[]> => {
        const response = await apiClient.get('/api/tracking/hoy');
        return response.data.data.jornadas;
    },
};
