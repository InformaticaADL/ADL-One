import axios from 'axios';
import API_CONFIG from '../../../config/api.config';

export const adminExportService = {
    getExportTableData: async (name: string, type: 'TABLE' | 'SP' = 'TABLE', params: any = {}) => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/admin/export-table`, {
                params: { 
                    name, 
                    type, 
                    params: JSON.stringify(params) 
                },
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error in getExportTableData:', error);
            throw error;
        }
    },
    getExportPdf: async (params: any = {}) => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/admin/export-pdf`, {
                params: { 
                    params: JSON.stringify(params) 
                },
                responseType: 'blob',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error in getExportPdf:', error);
            throw error;
        }
    },
    getMuestreadoresPdf: async (nombre?: string, estado?: string) => {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const response = await axios.get(`${API_CONFIG.getBaseURL()}/api/admin/muestreadores/export-pdf`, {
                params: { nombre, estado },
                responseType: 'blob',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error in getMuestreadoresPdf:', error);
            throw error;
        }
    }
};
