import apiClient from '../../../config/axios.config';

export const facturacionSaludService = {
    async getDashboard() {
        const response = await apiClient.get('/api/facturacion-salud/dashboard');
        return response.data.data;
    },

    async getMaestros() {
        const response = await apiClient.get('/api/facturacion-salud/maestros');
        return response.data.data;
    },

    async getEmpresasElegibles(filtros: Record<string, any> = {}) {
        const params = new URLSearchParams(
            Object.entries(filtros)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => [k, String(v)])
        );
        const response = await apiClient.get(`/api/facturacion-salud/empresas-elegibles?${params.toString()}`);
        return response.data.data;
    },

    async getCasosElegibles(filtros: Record<string, any> = {}) {
        const params = new URLSearchParams(
            Object.entries(filtros)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => [k, String(v)])
        );
        const response = await apiClient.get(`/api/facturacion-salud/casos-elegibles?${params.toString()}`);
        return response.data.data;
    },

    async valorizarCasos(payload: {
        id_empresaservicio: number;
        eligeprograma: number;
        fecha_rec_ini?: string;
        fecha_rec_fin?: string;
        fecha_inf_ini?: string;
        fecha_inf_fin?: string;
        ensilaje?: boolean;
        proa?: boolean;
        uf: number;
        usd?: number;
    }) {
        const response = await apiClient.post('/api/facturacion-salud/valorizar', payload);
        return response.data.data;
    },

    async actualizarLineaCasoManual(payload: {
        id_caso: number;
        item: number;
        id_tecnica: number;
        n_analisis: number;
        vtaunitario: number;
    }) {
        const response = await apiClient.put('/api/facturacion-salud/casos/linea-manual', payload);
        return response.data.data;
    },

    async cambiarEmpresaCaso(payload: { id_caso: number; id_empresaservicio: number }) {
        const response = await apiClient.put('/api/facturacion-salud/casos/cambiar-empresa', payload);
        return response.data.data;
    },

    async crearPrefacturas(payload: any) {
        const response = await apiClient.post('/api/facturacion-salud/prefacturas', payload);
        return response.data.data;
    },

    async listarPrefacturas(filtros: Record<string, any> = {}) {
        const params = new URLSearchParams(
            Object.entries(filtros)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => [k, String(v)])
        );
        const response = await apiClient.get(`/api/facturacion-salud/prefacturas?${params.toString()}`);
        return response.data.data;
    },

    async getPrefacturaDetalle(id: number) {
        const response = await apiClient.get(`/api/facturacion-salud/prefacturas/${id}`);
        return response.data.data;
    },

    async actualizarPrefactura(id: number, payload: any) {
        const response = await apiClient.put(`/api/facturacion-salud/prefacturas/${id}`, payload);
        return response.data.data;
    },

    async eliminarPrefactura(id: number) {
        const response = await apiClient.delete(`/api/facturacion-salud/prefacturas/${id}`);
        return response.data.data;
    },

    async quitarCasoPrefactura(id: number, idCaso: number) {
        const response = await apiClient.delete(`/api/facturacion-salud/prefacturas/${id}/casos/${idCaso}`);
        return response.data.data;
    },

    async agregarOtroIngreso(id: number, payload: { id_otrosingresos: number; valor: number }) {
        const response = await apiClient.post(`/api/facturacion-salud/prefacturas/${id}/otros-ingresos`, payload);
        return response.data.data;
    },

    async eliminarOtroIngreso(id: number, idOtrosIngresos: number) {
        const response = await apiClient.delete(`/api/facturacion-salud/prefacturas/${id}/otros-ingresos/${idOtrosIngresos}`);
        return response.data.data;
    },

    async agregarOtroDescuento(id: number, payload: { id_otrosdescuentos: number; valor: number }) {
        const response = await apiClient.post(`/api/facturacion-salud/prefacturas/${id}/otros-descuentos`, payload);
        return response.data.data;
    },

    async eliminarOtroDescuento(id: number, idOtrosDescuentos: number) {
        const response = await apiClient.delete(`/api/facturacion-salud/prefacturas/${id}/otros-descuentos/${idOtrosDescuentos}`);
        return response.data.data;
    },

    async descargarExcelPrefactura(id: number, tipo: 'RESUMEN' | 'DETALLE' = 'DETALLE') {
        const response = await apiClient.get(`/api/facturacion-salud/prefacturas/${id}/excel?tipo=${tipo}`, {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `respaldo_${tipo.toLowerCase()}_prefactura_${id}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    async listarOtrosCobros(filtros: Record<string, any> = {}) {
        const params = new URLSearchParams(
            Object.entries(filtros)
                .filter(([, v]) => v !== undefined && v !== null && v !== '')
                .map(([k, v]) => [k, String(v)])
        );
        const response = await apiClient.get(`/api/facturacion-salud/otros-cobros?${params.toString()}`);
        return response.data.data;
    },

    async buscarFacturaReferencia(folio: string | number, origen: 'CASOS' | 'OTRAS_VENTAS' = 'CASOS') {
        const response = await apiClient.get(
            `/api/facturacion-salud/otros-cobros/referencia?folio=${encodeURIComponent(String(folio))}&origen=${origen}`
        );
        return response.data.data;
    },

    async crearOtroCobro(payload: any) {
        const response = await apiClient.post('/api/facturacion-salud/otros-cobros', payload);
        return response.data.data;
    },

    async listarDocumentosDte(filtros: { flujo?: string; solo_pendientes?: boolean; busqueda?: string } = {}) {
        const params = new URLSearchParams();
        if (filtros.flujo) params.set('flujo', filtros.flujo);
        if (filtros.solo_pendientes !== undefined) params.set('solo_pendientes', String(filtros.solo_pendientes));
        if (filtros.busqueda) params.set('busqueda', filtros.busqueda);
        const response = await apiClient.get(`/api/facturacion-salud/dte/documentos?${params.toString()}`);
        return response.data.data;
    },

    async generarArchivoDte(payload: { flujo: string; ids_facturacion: number[]; marcar_emitido: boolean }) {
        const response = await apiClient.post('/api/facturacion-salud/dte/exportar', payload);
        return response.data.data;
    }
};

