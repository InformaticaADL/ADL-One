import apiClient from '../../../config/axios.config';

// No need for custom axios instance - using centralized apiClient with automatic token injection


export interface Equipo {
    id_equipo: number;
    codigo: string;
    nombre: string;
    tipo: string;
    ubicacion: string;
    vigencia: string;
    id_muestreador: number;
    estado: string;
    nombre_asignado?: string;
    sigla?: string;
    correlativo?: number;
    tiene_fc?: string;

    equipo_asociado?: string | number;
    observacion?: string;
    visible_muestreador?: string;
    que_mide?: string;
    unidad_medida_textual?: string;
    unidad_medida_sigla?: string;
    informe?: string;
    error0?: number;
    error15?: number;
    error30?: number;
    version?: string;
    requestId?: number;
    requestStatus?: string;
    // Campos nuevos del Excel
    ultima_verificacion?: string;      // DATE - fecha de última verificación
    siguiente_verificacion?: string;   // DATE - calculada (ultima + 90 días) pero editable
    plazo_vigencia?: string;           // VARCHAR(500) - texto con el plazo
    estado_equipo?: string;            // VARCHAR(100) - Estado textual (Operativo, Dado de Baja, etc.)
    habilitado_muestreador?: string;   // 'S' o 'N' de mae_muestreador
    // Documento de la revisión/mantención vigente. En mae_equipo_historial las
    // mismas columnas conservan el de cada versión anterior.
    documento_nombre?: string | null;
    documento_ruta?: string | null;
    documento_fecha?: string | null;
}

export interface EquipoHistorial extends Equipo {
    id_historial: number;
    fecha_cambio: string;
    nombre_usuario_cambio: string;
    version?: string;
}

export interface EquiposResponse {
    success: boolean;
    data: Equipo[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    expiringCount?: number;
    expiredCount?: number;
    inactiveSamplerCount?: number;
    catalogs?: {
        tipos: string[];
        estados: string[];
        sedes: string[];
        nombres: any[];
        que_mide: string[];
        unidades: string[];
    };
}

export const equipoService = {
    getEquipos: async (params: any): Promise<EquiposResponse> => {
        const response = await apiClient.get('/api/admin/equipos/', { params });
        return response.data;
    },

    getEquipoCatalogo: async (): Promise<any> => {
        const response = await apiClient.get('/api/admin/equipos/catalogo');
        return response.data;
    },

    createEquipoCatalogo: async (data: any): Promise<any> => {
        const response = await apiClient.post('/api/admin/equipos/catalogo', data);
        return response.data;
    },

    updateEquipoCatalogo: async (id: number, data: any): Promise<any> => {
        const response = await apiClient.put(`/api/admin/equipos/catalogo/${id}`, data);
        return response.data;
    },

    deleteEquipoCatalogo: async (id: number): Promise<any> => {
        const response = await apiClient.delete(`/api/admin/equipos/catalogo/${id}`);
        return response.data;
    },

    createEquipo: async (data: Partial<Equipo>): Promise<any> => {
        const response = await apiClient.post('/api/admin/equipos/', data);
        return response.data;
    },

    createEquiposBulk: async (data: Partial<Equipo>[]): Promise<any> => {
        const response = await apiClient.post('/api/admin/equipos/bulk', data);
        return response.data;
    },

    getEquipoById: async (id: number): Promise<any> => {
        const response = await apiClient.get(`/api/admin/equipos/${id}`);
        return response.data;
    },

    updateEquipo: async (id: number, data: Partial<Equipo>): Promise<any> => {
        const response = await apiClient.put(`/api/admin/equipos/${id}`, data);
        return response.data;
    },

    deleteEquipo: async (id: number): Promise<any> => {
        const response = await apiClient.delete(`/api/admin/equipos/${id}`);
        return response.data;
    },

    getEquipoHistorial: async (id: number): Promise<any> => {
        const response = await apiClient.get(`/api/admin/equipos/${id}/historial`);
        return response.data;
    },

    getNextCorrelativo: async (tipo: string): Promise<any> => {
        const response = await apiClient.get(`/api/admin/equipos/next-correlativo/${encodeURIComponent(tipo)}`);
        return response.data;
    },

    suggestNextCode: async (tipo: string, ubicacion: string, nombre: string = ''): Promise<any> => {
        const response = await apiClient.get('/api/admin/equipos/suggest-code', {
            params: { tipo, ubicacion, nombre }
        });
        return response.data;
    },

    restoreVersion: async (id: number, idHistorial: number): Promise<any> => {
        const response = await apiClient.post(`/api/admin/equipos/${id}/restore/${idHistorial}`);
        return response.data;
    },

    exportEquiposExcel: async (params: any): Promise<Blob> => {
        const response = await apiClient.get('/api/admin/equipos/export/excel', {
            params,
            responseType: 'blob'
        });
        return response.data;
    },

    // --- DOCUMENTO DE LA REVISIÓN / MANTENCIÓN ---

    // Sube el archivo y devuelve su ruta. Todavía no queda asociado a nada: la
    // ruta se manda en el PUT del equipo y se guarda junto con la versión nueva.
    subirArchivoDocumento: async (archivo: File, nombreDocumento?: string): Promise<{ documento_nombre: string; documento_ruta: string; tamano_bytes: number }> => {
        const form = new FormData();
        form.append('archivo', archivo);
        if (nombreDocumento) form.append('nombre_documento', nombreDocumento);
        const response = await apiClient.post('/api/admin/equipos/documentos/archivo', form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.data;
    },

    // Las descargas van por la API y no por el /uploads estático: así viaja el
    // token y el archivo llega con su nombre real, no con el aleatorio del disco.
    descargarDocumentoEquipo: async (idEquipo: number): Promise<Blob> => {
        const response = await apiClient.get(`/api/admin/equipos/${idEquipo}/documento`, { responseType: 'blob' });
        return response.data;
    },

    descargarDocumentoHistorial: async (idHistorial: number): Promise<Blob> => {
        const response = await apiClient.get(`/api/admin/equipos/historial/${idHistorial}/documento`, { responseType: 'blob' });
        return response.data;
    }
};

export default equipoService;
