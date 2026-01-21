import axios from 'axios';
import API_CONFIG from '../../../config/api.config';

const axiosInstance = axios.create({
    baseURL: `${API_CONFIG.getBaseURL()}/api/analysis`,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json'
    }
});

export const analysisService = {
    /**
     * Get all normativas
     */
    getNormativas: async () => {
        const response = await axiosInstance.get('/normativas');
        return response.data.data;
    },

    /**
     * Get referencias by normativa ID
     */
    getReferenciasByNormativa: async (normativaId: string | number) => {
        const response = await axiosInstance.get('/referencias', {
            params: { normativaId }
        });
        return response.data.data;
    },

    /**
     * Get analysis by normativa and referencia
     */
    getAnalysisByNormativaReferencia: async (normativaId: string | number, referenciaId: string | number) => {
        const response = await axiosInstance.get('/analisis', {
            params: { normativaId, referenciaId }
        });
        return response.data.data;
    },

    /**
     * Get laboratorios
     */
    getLaboratorios: async () => {
        const response = await axiosInstance.get('/laboratorios');
        return response.data.data;
    },

    /**
     * Get tipos de entrega
     */
    getTiposEntrega: async () => {
        const response = await axiosInstance.get('/tipos-entrega');
        return response.data.data;
    }
};
