import apiClient from '../../../config/axios.config';

const BASE = '/api/facturacion-salud';

/** Fila de datos que devuelve la API (columnas de la base). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Fila = Record<string, any>;

/** Convierte un objeto en parámetros de URL, omitiendo los valores vacíos. */
const query = (filtros: Record<string, unknown> = {}) =>
    new URLSearchParams(
        Object.entries(filtros)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => [k, String(v)])
    ).toString();

/** Mensaje legible de un error de la API. */
export const mensajeError = (error: unknown, porDefecto = 'Ocurrió un error inesperado.'): string => {
    const e = error as { response?: { data?: { message?: string } }; message?: string };
    return e?.response?.data?.message || e?.message || porDefecto;
};

// ---------------------------------------------------------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------------------------------------------------------

export interface FichaFactura {
    encabezado: Fila;
    /** Datos que se completan antes de generar el archivo para el emisor. */
    emision?: Fila;
    titulo: string;
    tieneFolio: boolean;
    editable: boolean;
    ingresos: Array<{ id_otrosingresos: number; nombre_otrosingresos: string; valor: number }>;
    descuentos: Array<{ id_otrosdescuentos: number; nombre_otrosdescuentos: string; valor: number }>;
    ordenes: Array<{ ocompra: string; ocompra_fecha: string; referencia: string; tipo: string; orden: number }>;
    detalle: Array<Fila>;
    totalOtrosIngresos: number;
    totalOtrosDescuentos: number;
    totalDetalleUf: number;
    facturado_por: string;
    valor: string;
    llevaDolar: boolean;
    usdTotalCasos: number;
    otrasFacturasConElMismoFolio?: number[];
}

export interface ArchivoGenerado {
    nombreArchivo: string;
    contenido: string;
    contenidoAnsiBase64: string;
    documentos: number;
    filas: number;
    ids: number[];
}

export interface MaestrosDocumentos {
    tiposDocumento: Array<{ id_tipodocumento: number; nombre_tipodocumento: string; sigla: string }>;
    glosas: Array<{ id_glosa: number; nombre_glosa: string; id_tipodocumento: number }>;
    formasPago: Array<{ id_formapago: number; nombre_formapago: string }>;
    otrosIngresos: Array<{ id_otrosingresos: number; nombre_otrosingresos: string }>;
    otrosDescuentos: Array<{ id_otrosdescuentos: number; nombre_otrosdescuentos: string }>;
    empresas: Array<{ id_empresaservicio: number; nombre_empresaservicios: string; rut_empresaservicios: string }>;
}

export type FlujoArchivo = 'CASOS' | 'FEA' | 'FEE' | 'NCE' | 'NDE';
export type EstadoLista = 'NO emitidos' | 'Emitidos' | 'Todos';

// ---------------------------------------------------------------------------------------------------------------------------
// Llamadas
// ---------------------------------------------------------------------------------------------------------------------------

export const facturacionSaludService = {
    // --- Resumen, valorización y creación de facturas --------------------------------------------------------------------
    async getDashboard() {
        return (await apiClient.get(`${BASE}/dashboard`)).data.data;
    },

    async getMaestros() {
        return (await apiClient.get(`${BASE}/maestros`)).data.data;
    },

    async getMaestrosDocumentos(): Promise<MaestrosDocumentos> {
        return (await apiClient.get(`${BASE}/maestros/documentos`)).data.data;
    },

    async getEmpresasElegibles(filtros: Record<string, unknown> = {}) {
        return (await apiClient.get(`${BASE}/empresas-elegibles?${query(filtros)}`)).data.data;
    },

    async getCasosElegibles(filtros: Record<string, unknown> = {}) {
        return (await apiClient.get(`${BASE}/casos-elegibles?${query(filtros)}`)).data.data;
    },

    async valorizarCasos(payload: {
        id_empresaservicio: number;
        eligeprograma: number;
        // "Fecha datos a procesar" (fecha de informe), como en ADLSOFT
        fecha_proceso_ini?: string;
        fecha_proceso_fin?: string;
        ensilaje?: boolean;
        proa?: boolean;
        uf: number;
        usd?: number;
    }) {
        return (await apiClient.post(`${BASE}/valorizar`, payload)).data.data;
    },

    async actualizarLineaCasoManual(payload: { id_caso: number; item: number; id_tecnica: number; n_analisis: number; vtaunitario: number }) {
        return (await apiClient.put(`${BASE}/casos/linea-manual`, payload)).data.data;
    },

    async cambiarEmpresaCaso(payload: { id_caso: number; id_empresaservicio: number }) {
        return (await apiClient.put(`${BASE}/casos/cambiar-empresa`, payload)).data.data;
    },

    // "Pre-ver Facturación" de ADLSOFT: en qué facturas quedarían los casos marcados (no escribe nada)
    async previsualizarPrefacturas(payload: Fila) {
        return (await apiClient.post(`${BASE}/prefacturas/previsualizar`, payload)).data.data;
    },

    async crearPrefacturas(payload: Fila) {
        return (await apiClient.post(`${BASE}/prefacturas`, payload)).data.data;
    },

    // --- Consulta y mantención de una factura ----------------------------------------------------------------------------
    async consultarFactura(params: { id_facturacion?: number; factura?: number }): Promise<FichaFactura> {
        return (await apiClient.get(`${BASE}/facturas/consulta?${query(params)}`)).data.data;
    },

    async grabarFactura(id: number, payload: { factura: number; uf: number; ingresos: Array<{ id_otrosingresos: number; valor: number }>; descuentos: Array<{ id_otrosdescuentos: number; valor: number }> }) {
        return (await apiClient.post(`${BASE}/prefacturas/${id}/grabar`, payload)).data.data;
    },

    async eliminarFacturaPorId(id: number) {
        return (await apiClient.delete(`${BASE}/prefacturas/${id}`)).data.data;
    },

    async eliminarFacturaPorNumero(factura: number) {
        return (await apiClient.delete(`${BASE}/facturas/numero/${factura}`)).data.data;
    },

    async cambiarEmpresaFactura(id: number, payload: { id_empresaservicio: number; motivo: string }) {
        return (await apiClient.put(`${BASE}/prefacturas/${id}/empresa`, payload)).data.data;
    },

    // Datos previos a exportar
    async modificarDatosExportacion(id: number, accion: 'fecha' | 'forma-pago' | 'nota' | 'glosa-libre' | 'glosa' | 'mes', payload: Record<string, unknown>) {
        return (await apiClient.put(`${BASE}/prefacturas/${id}/exportacion/${accion}`, payload)).data.data;
    },

    async agregarOcHes(id: number, payload: { oc?: { ocompra: string; fecha?: string; referencia?: string }; hes?: { ocompra: string; fecha?: string; referencia?: string } }) {
        return (await apiClient.post(`${BASE}/prefacturas/${id}/exportacion-oc-hes`, payload)).data.data;
    },

    async listarOcHes(id: number) {
        return (await apiClient.get(`${BASE}/prefacturas/${id}/exportacion-oc-hes`)).data.data as Array<Fila>;
    },

    async modificarOcHes(id: number, payload: { ocompra: string; tipo: 'OC' | 'HES'; fecha?: string; referencia?: string }) {
        return (await apiClient.put(`${BASE}/prefacturas/${id}/exportacion-oc-hes`, payload)).data.data;
    },

    async eliminarOcHes(id: number, ocompra: string) {
        return (await apiClient.post(`${BASE}/prefacturas/${id}/exportacion-oc-hes/eliminar`, { ocompra })).data.data;
    },

    async buscarOcEnOtrasFacturas(ocompra: string) {
        return (await apiClient.get(`${BASE}/dte/casos/ordenes-compra/buscar?${query({ ocompra })}`)).data.data as Array<Fila>;
    },

    // Órdenes de compra con valor (tabla facturacion_oc)
    async listarOcAsociadas(id: number) {
        return (await apiClient.get(`${BASE}/prefacturas/${id}/ordenes-compra-oc`)).data.data as { filas: Array<Fila>; totalPesos: number };
    },

    async agregarOcAsociada(id: number, payload: { oc: string; oc_fecha_emision: string; oc_moneda: string; oc_valor: number; oc_conversion?: number }) {
        return (await apiClient.post(`${BASE}/prefacturas/${id}/ordenes-compra-oc`, payload)).data.data;
    },

    async eliminarOcAsociada(id: number, payload: Record<string, unknown>) {
        return (await apiClient.post(`${BASE}/prefacturas/${id}/ordenes-compra-oc/eliminar`, payload)).data.data;
    },

    // Otros ingresos / descuentos de facturas recién creadas
    async grabarOtrosIngresosDescuentos(facturas: Array<{ id_facturacion: number; ingresos: Array<{ id_otrosingresos: number; valor: number }>; descuentos: Array<{ id_otrosdescuentos: number; valor: number }> }>) {
        return (await apiClient.post(`${BASE}/prefacturas/otros-ing-des/grabar`, { facturas })).data.data;
    },

    // Guías de despacho a clientes
    async listarGuiasPendientes(id_empresaservicio: number) {
        return (await apiClient.get(`${BASE}/guias/pendientes?${query({ id_empresaservicio })}`)).data.data as Array<Fila>;
    },

    async calcularNetoGuias(ids_gd: number[], uf: number) {
        return (await apiClient.post(`${BASE}/guias/neto`, { ids_gd, uf })).data.data as { netoUf: number };
    },

    async reservarGuias(id: number, ids_gd: number[], uf: number) {
        return (await apiClient.post(`${BASE}/prefacturas/${id}/guias/reservar`, { ids_gd, uf })).data.data as { id_otrosingresos: number; nombre_otrosingresos: string; valor: number };
    },

    async liberarGuias(id: number) {
        return (await apiClient.post(`${BASE}/prefacturas/${id}/guias/liberar`, {})).data.data;
    },

    // Datos de los Excel
    async datosExcelResumen(id: number) {
        return (await apiClient.get(`${BASE}/prefacturas/${id}/datos-resumen`)).data.data as { columnas: string[]; filas: Array<Fila> };
    },

    async datosExcelDetalle(id: number, lote = false) {
        return (await apiClient.get(`${BASE}/prefacturas/${id}/datos-detalle?${query({ lote: lote ? 'true' : '' })}`)).data.data as { columnas: string[]; filas: Array<Fila> };
    },

    /** PDF «Resumen» de la factura. Devuelve el archivo y la ruta donde el servidor guardó una copia (vacía si no hay carpeta configurada). */
    async descargarPdfResumen(id: number): Promise<{ blob: Blob; nombre: string; ruta: string }> {
        const r = await apiClient.get(`${BASE}/prefacturas/${id}/pdf-resumen`, { responseType: 'blob' });
        const h = r.headers as Record<string, string>;
        return {
            blob: r.data as Blob,
            nombre: decodeURIComponent(h['x-nombre-archivo'] || `Resumen ID${id}.PDF`),
            ruta: decodeURIComponent(h['x-ruta-guardada'] || ''),
        };
    },

    /** PDF «Detalle» de la factura. Devuelve el archivo y la ruta donde el servidor guardó una copia (vacía si no hay carpeta configurada). */
    async descargarPdfDetalle(id: number): Promise<{ blob: Blob; nombre: string; ruta: string }> {
        const r = await apiClient.get(`${BASE}/prefacturas/${id}/pdf-detalle`, { responseType: 'blob' });
        const h = r.headers as Record<string, string>;
        return {
            blob: r.data as Blob,
            nombre: decodeURIComponent(h['x-nombre-archivo'] || `Detalle ID${id}.PDF`),
            ruta: decodeURIComponent(h['x-ruta-guardada'] || ''),
        };
    },

    // --- Otras ventas, notas de crédito y débito -------------------------------------------------------------------------
    async listarOtrasVentas(estado: EstadoLista = 'NO emitidos') {
        return (await apiClient.get(`${BASE}/otras-ventas?${query({ estado })}`)).data.data as Array<Fila>;
    },

    async buscarReferenciaOtraVenta(params: { numero: number; fecha: string; tipoImpuesto: 'FEA' | 'FEE' }) {
        return (await apiClient.get(`${BASE}/otras-ventas/referencia?${query(params)}`)).data.data as Fila | null;
    },

    async crearOtraVenta(payload: Record<string, unknown>) {
        return (await apiClient.post(`${BASE}/otras-ventas`, payload)).data.data;
    },

    async modificarOtraVenta(id_otroscobros: number, accion: 'numero' | 'nota' | 'fecha' | 'glosa' | 'uf' | 'monto-uf', payload: Record<string, unknown>) {
        return (await apiClient.put(`${BASE}/otras-ventas/${id_otroscobros}/${accion}`, payload)).data.data;
    },

    async listarCasosDeFactura(id_facturacion: number) {
        return (await apiClient.get(`${BASE}/otras-ventas/casos-factura?${query({ id_facturacion })}`)).data.data as Array<Fila>;
    },

    async crearNotaCreditoCasos(payload: Record<string, unknown>) {
        return (await apiClient.post(`${BASE}/otras-ventas/nota-credito-casos`, payload)).data.data;
    },

    // --- Archivos planos -------------------------------------------------------------------------------------------------
    async listarParaArchivo(flujo: FlujoArchivo, estado: EstadoLista = 'NO emitidos') {
        const url = flujo === 'CASOS' ? `${BASE}/dte/casos/facturas?${query({ estado })}` : `${BASE}/dte/otras/${flujo}?${query({ estado })}`;
        return (await apiClient.get(url)).data.data as Array<Fila>;
    },

    async generarArchivo(flujo: FlujoArchivo, ids_facturacion: number[]): Promise<ArchivoGenerado> {
        const url = flujo === 'CASOS' ? `${BASE}/dte/casos/exportar` : `${BASE}/dte/otras/${flujo}/exportar`;
        return (await apiClient.post(url, { ids_facturacion })).data.data;
    },
};
