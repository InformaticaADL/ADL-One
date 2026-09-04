import apiClient from '../../../config/axios.config';

export const facturacionService = {
    async getDashboard() {
        const response = await apiClient.get('/api/facturacion/dashboard');
        return response.data.data;
    },

    async actualizarUf() {
        const response = await apiClient.post('/api/facturacion/uf/actualizar');
        return response.data.data;
    },

    async listarUfHistorial(limit = 30) {
        const response = await apiClient.get(`/api/facturacion/uf/historial?limit=${limit}`);
        return response.data.data;
    },

    async registrarUfManual(fecha: string, valor: number) {
        const response = await apiClient.post('/api/facturacion/uf/manual', { fecha, valor });
        return response.data.data;
    },

    async listarFormasPago() {
        const response = await apiClient.get('/api/facturacion/maestros/formas-pago');
        return response.data.data;
    },

    async listarGlosas(idTipoDocumento = 1) {
        const response = await apiClient.get(`/api/facturacion/maestros/glosas?idTipoDocumento=${idTipoDocumento}`);
        return response.data.data;
    },

    async getClienteConfig(idEmpresaServicio: number) {
        const response = await apiClient.get(`/api/facturacion/cliente-config/${idEmpresaServicio}`);
        return response.data.data;
    },

    async upsertClienteConfig(idEmpresaServicio: number, datos: any) {
        const response = await apiClient.post(`/api/facturacion/cliente-config/${idEmpresaServicio}`, datos);
        return response.data.data;
    },

    async getCasosFacturables(filtros: Record<string, any> = {}) {
        const params = new URLSearchParams(
            Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')
        );
        const response = await apiClient.get(`/api/facturacion/casos-facturables?${params.toString()}`);
        return response.data.data;
    },

    async crearPrefacturas(payload: any) {
        const response = await apiClient.post('/api/facturacion/prefacturas', payload);
        return response.data.data;
    },

    async listarPrefacturas(filtros: Record<string, any> = {}) {
        const params = new URLSearchParams(
            Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')
        );
        const response = await apiClient.get(`/api/facturacion/prefacturas?${params.toString()}`);
        return response.data.data;
    },

    async getPrefacturaDetalle(id: number) {
        const response = await apiClient.get(`/api/facturacion/prefacturas/${id}`);
        return response.data.data;
    },

    async generarPdfs(id: number) {
        const response = await apiClient.post(`/api/facturacion/prefacturas/${id}/pdf`);
        return response.data.data;
    },

    async enviarPorEmail(id: number) {
        const response = await apiClient.post(`/api/facturacion/prefacturas/${id}/enviar`);
        return response.data.data;
    },

    async registrarOrdenCompra(id: number, datos: any) {
        const response = await apiClient.post(`/api/facturacion/prefacturas/${id}/ordenes-compra`, datos);
        return response.data.data;
    },

    async generarArchivoPlano(idPrefacturaList: number[]) {
        const response = await apiClient.post('/api/facturacion/emision/archivo-plano', { idPrefacturaList });
        return response.data.data;
    },

    async listarLotesEmision(limit = 50) {
        const response = await apiClient.get(`/api/facturacion/emision/lotes?limit=${limit}`);
        return response.data.data;
    },

    /** Publica la pre-factura en el portal del cliente (ADL WEB GO). */
    async publicarPrefacturaEnPortal(id: number) {
        const response = await apiClient.post(`/api/facturacion/prefacturas/${id}/portal`);
        return response.data.data;
    },

    /** Corrige datos de cabecera de una pre-factura (solo antes de emitir). */
    async actualizarPrefactura(idPrefactura: number, datos: Record<string, any>) {
        const response = await apiClient.put(`/api/facturacion/prefacturas/${idPrefactura}`, datos);
        return response.data.data;
    },

    /** Quita un caso de la pre-factura y lo devuelve a la cola de facturables. */
    async quitarCasoDePrefactura(idPrefactura: number, idPfCaso: number) {
        const response = await apiClient.delete(`/api/facturacion/prefacturas/${idPrefactura}/casos/${idPfCaso}`);
        return response.data.data;
    },

    /** Anula la pre-factura y libera todos sus casos. */
    async anularPrefactura(idPrefactura: number, motivo: string) {
        const response = await apiClient.post(`/api/facturacion/prefacturas/${idPrefactura}/anular`, { motivo });
        return response.data.data;
    },

    async getEstadoCuenta(idEmpresaServicio: number) {
        const response = await apiClient.get(`/api/facturacion/estado-cuenta/${idEmpresaServicio}`);
        return response.data.data;
    },

    async marcarFacturaPagada(idEmision: number, fechaPago?: string) {
        const response = await apiClient.post(`/api/facturacion/emision/${idEmision}/marcar-pagada`, { fechaPago });
        return response.data.data;
    },

    async listarCotizaciones(filtros: Record<string, any> = {}) {
        const params = new URLSearchParams(
            Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')
        );
        const response = await apiClient.get(`/api/facturacion/cotizaciones?${params.toString()}`);
        return response.data.data;
    },

    async getCotizacionDetalle(id: number) {
        const response = await apiClient.get(`/api/facturacion/cotizaciones/${id}`);
        return response.data.data;
    },

    async crearCotizacion(payload: any) {
        const response = await apiClient.post('/api/facturacion/cotizaciones', payload);
        return response.data.data;
    },

    async cambiarEstadoCotizacion(id: number, estado: string) {
        const response = await apiClient.post(`/api/facturacion/cotizaciones/${id}/estado`, { estado });
        return response.data.data;
    },

    async listarSolicitudesCotizacionPortal(todas = false) {
        const response = await apiClient.get(`/api/facturacion/cotizaciones/portal-solicitudes${todas ? '?todas=true' : ''}`);
        return response.data.data;
    },

    async listarBandejaCotizaciones(filtros: { estado?: string; soloNoLeidos?: boolean; idEmpresaServicio?: number } = {}) {
        const q = new URLSearchParams();
        if (filtros.estado) q.set('estado', filtros.estado);
        if (filtros.soloNoLeidos) q.set('soloNoLeidos', 'true');
        if (filtros.idEmpresaServicio) q.set('idEmpresaServicio', String(filtros.idEmpresaServicio));
        const response = await apiClient.get(`/api/facturacion/cotizaciones/bandeja?${q.toString()}`);
        return response.data.data;
    },

    async getSolicitudPortal(idSolicitudPortal: number) {
        const response = await apiClient.get(`/api/facturacion/cotizaciones/portal-solicitudes/${idSolicitudPortal}`);
        return response.data.data;
    },

    async marcarVistaStaffPortal(idSolicitudPortal: number) {
        const response = await apiClient.post(`/api/facturacion/cotizaciones/portal-solicitudes/${idSolicitudPortal}/marcar-vista`);
        return response.data.data;
    },

    async vincularCotizacionAPortal(idCotizacion: number, idSolicitudPortal: number) {
        const response = await apiClient.post(`/api/facturacion/cotizaciones/${idCotizacion}/vincular-portal`, { idSolicitudPortal });
        return response.data.data;
    },

    async publicarCotizacionEnPortal(idCotizacion: number) {
        const response = await apiClient.post(`/api/facturacion/cotizaciones/${idCotizacion}/publicar-portal`);
        return response.data.data;
    },

    async listarMensajesCotizacionPortal(idCotizacion: number) {
        const response = await apiClient.get(`/api/facturacion/cotizaciones/${idCotizacion}/mensajes-portal`);
        return response.data.data;
    },

    async enviarMensajeCotizacionPortal(idCotizacion: number, mensaje: string) {
        const response = await apiClient.post(`/api/facturacion/cotizaciones/${idCotizacion}/mensajes-portal`, { mensaje });
        return response.data.data;
    },

    async listarMensajesSolicitudPortal(idSolicitudPortal: number) {
        const response = await apiClient.get(`/api/facturacion/cotizaciones/portal-solicitudes/${idSolicitudPortal}/mensajes`);
        return response.data.data;
    },

    async enviarMensajeSolicitudPortal(idSolicitudPortal: number, mensaje: string, archivos: File[] = []) {
        const url = `/api/facturacion/cotizaciones/portal-solicitudes/${idSolicitudPortal}/mensajes`;
        if (archivos.length === 0) {
            const response = await apiClient.post(url, { mensaje });
            return response.data.data;
        }
        const form = new FormData();
        form.append('mensaje', mensaje);
        archivos.forEach((f) => form.append('archivos', f));
        const response = await apiClient.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data.data;
    },

    async listarAdjuntosSolicitudPortal(idSolicitudPortal: number) {
        const response = await apiClient.get(`/api/facturacion/cotizaciones/portal-solicitudes/${idSolicitudPortal}/adjuntos`);
        return response.data.data;
    },

    urlAdjuntoSolicitudPortal(idSolicitudPortal: number, idAdjunto: number) {
        return `${apiClient.defaults.baseURL || ''}/api/facturacion/cotizaciones/portal-solicitudes/${idSolicitudPortal}/adjuntos/${idAdjunto}`;
    },

    urlPdfCotizacion(idCotizacion: number) {
        return `${apiClient.defaults.baseURL || ''}/api/facturacion/cotizaciones/${idCotizacion}/pdf`;
    },

    /** Datos de una cotización aceptada listos para precargar el formulario de ficha. */
    async getCotizacionParaFicha(idCotizacion: number) {
        const response = await apiClient.get(`/api/facturacion/cotizaciones/${idCotizacion}/para-ficha`);
        return response.data.data;
    },

    async marcarCotizacionConvertida(idCotizacion: number) {
        const response = await apiClient.post(`/api/facturacion/cotizaciones/${idCotizacion}/marcar-convertida`);
        return response.data.data;
    },

    /** Precio a mano de un ítem: análisis sin tarifa o línea fuera del catálogo. */
    async actualizarPrecioItemCotizacion(idCotizacion: number, idItem: number, precioUf: number) {
        const response = await apiClient.put(`/api/facturacion/cotizaciones/${idCotizacion}/items/${idItem}/precio`, { precioUf });
        return response.data.data;
    },

    /** Tablas MA que tienen tarifa para ese cliente + centro. */
    async listarTablasDeConvenio(idEmpresaServicio: number, idCentro?: number) {
        const q = new URLSearchParams({ idEmpresaServicio: String(idEmpresaServicio) });
        if (idCentro) q.set('idCentro', String(idCentro));
        const response = await apiClient.get(`/api/facturacion/precios/tablas?${q.toString()}`);
        return response.data.data;
    },

    async resolverPrecio(params: Record<string, any>) {
        const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
        const response = await apiClient.get(`/api/facturacion/precios/resolver?${q.toString()}`);
        return response.data.data;
    },

    /**
     * Sube el PDF de una OC como candidato pendiente de confirmar.
     * Si `idPrefactura` es null, es una OC anticipada: se guarda contra el
     * cliente y espera a que exista la pre-factura.
     */
    async crearCandidatoOc(idPrefactura: number | null, archivo: File, idEmpresaServicio?: number) {
        const form = new FormData();
        form.append('archivo', archivo);
        if (!idPrefactura && idEmpresaServicio) form.append('idEmpresaServicio', String(idEmpresaServicio));
        const url = idPrefactura
            ? `/api/facturacion/prefacturas/${idPrefactura}/oc-candidatos`
            : '/api/facturacion/oc-candidatos';
        const response = await apiClient.post(url, form, { headers: { 'Content-Type': 'multipart/form-data' } });
        return response.data.data;
    },

    async listarCandidatosOc(idPrefactura?: number) {
        const q = idPrefactura ? `?idPrefactura=${idPrefactura}` : '';
        const response = await apiClient.get(`/api/facturacion/oc-candidatos${q}`);
        return response.data.data;
    },

    async confirmarCandidatoOc(id: number, datos: any) {
        const response = await apiClient.post(`/api/facturacion/oc-candidatos/${id}/confirmar`, datos);
        return response.data.data;
    },

    async descartarCandidatoOc(id: number) {
        const response = await apiClient.post(`/api/facturacion/oc-candidatos/${id}/descartar`);
        return response.data.data;
    },
};
