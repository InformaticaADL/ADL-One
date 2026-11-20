import apiClient from '../../../config/axios.config';
import type { ModalidadControl, ReglasControl } from '../utils/reglasControlEquipo';

// No need for custom axios instance - using centralized apiClient with automatic token injection


/** Una fila del registro de equipos eliminados definitivamente (mae_equipo_eliminado). */
export interface EquipoEliminado {
    id_eliminado: number;
    id_equipo_original: number;
    codigo: string | null;
    nombre: string | null;
    tipoequipo: string | null;
    sede: string | null;
    motivo: string;
    nombre_usuario: string | null;
    fecha_eliminacion: string;
}

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
    /** Habilitado para la verificación de temperatura aunque esté Fuera de Servicio o Dado de Baja. */
    habilitado_verif_temp?: boolean;
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
    // Qué ciclo de fechas rige: mantención anual / contrastación semestral / verificación
    // trimestral / calibración anual de patrón / sin vencimiento (complementos). Las fechas
    // de arriba son las de ESA modalidad.
    modalidad_control?: ModalidadControl | null;
    plazo_vigencia?: string;           // VARCHAR(500) - texto con el plazo
    estado_equipo?: string;            // VARCHAR(100) - Estado textual (Operativo, Dado de Baja, etc.)
    // Solo en /equipos/resumen-calidad: vigencia calculada en el backend.
    estado_vigencia?: 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha' | 'sin_vencimiento' | 'retirado';
    dias_restantes?: number | null;
    ultima_modificacion?: string | null;  // última fecha de cambio en mae_equipo_historial
    usuario_modificacion?: string | null; // quién hizo ese cambio
    habilitado_muestreador?: string;   // 'S' o 'N' de mae_muestreador
    // Documento de la revisión/mantención vigente. En mae_equipo_historial las
    // mismas columnas conservan el de cada versión anterior.
    documento_nombre?: string | null;
    documento_ruta?: string | null;
    documento_fecha?: string | null;
    // Factor de Corrección por punto — calculado server-side (= -error) cada
    // vez que se guarda el Error correspondiente, no es editable a mano.
    fc0?: number | null;
    fc15?: number | null;
    fc30?: number | null;
    // Datos de compra/baja (del inventario OI-FoGe-21).
    proveedor?: string | null;
    fecha_compra?: string | null;
    documento_compra?: string | null;
    n_documento_compra?: string | null;
    valor_unitario?: number | null;
    fecha_baja?: string | null;
    // Datos del inventario OI-FoGe-21 (migrations/add_equipo_datos_inventario.sql).
    marca?: string | null;
    modelo?: string | null;
    n_serie?: string | null;
    influencia_significativa?: string | null;
    justificacion_influencia?: string | null;
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
    activeCount?: number;
    fueraServicioCount?: number;
    bajaCount?: number;
    catalogs?: {
        tipos: string[];
        estados: string[];
        sedes: string[];
        nombres: any[];
        que_mide: string[];
        unidades: string[];
    };
}

export interface AnalisisExcelItem {
    rowNumber: number;
    codigo: string | null;
    nombre: string | null;
    status: 'coincide' | 'difiere' | 'no_existe';
    id_equipo: number | null;
    excelData: Partial<Equipo>;
    diffs: { campo: string; etiqueta: string; valorExcel: unknown; valorBD: unknown }[];
    warnings: string[];
    /** Responsable tal como viene en el Excel, y el muestreador del sistema al que se resolvió. */
    responsable_excel?: string | null;
    responsable_sistema?: string | null;
    referencia?: { marca?: string | null; modelo?: string | null; serie?: string | null };
    // Ficha actual del equipo en el sistema (coincide / difiere).
    equipo?: Equipo;
}

export interface AnalisisExcelResponse {
    success: boolean;
    resumen: { total: number; coinciden: number; difieren: number; noExisten: number; soloEnBD?: number };
    items: AnalisisExcelItem[];
    // Equipos del sistema que no vienen en el Excel (solo para consultar).
    soloEnBD?: Equipo[];
    rowErrors: { rowNumber: number; message: string }[];
}

export interface AnalisisTemperaturaItem {
    rowNumber: number;
    codigo: string | null;
    nombre: string | null;
    status: 'coincide' | 'difiere' | 'no_encontrado';
    id_equipo: number | null;
    excelData: Partial<Equipo>;
    diffs: { campo: string; etiqueta: string; valorExcel: unknown; valorBD: unknown }[];
    warnings: string[];
    responsable_excel?: string | null;
    responsable_sistema?: string | null;
}

export interface AnalisisTemperaturaResponse {
    success: boolean;
    resumen: { total: number; coinciden: number; difieren: number; noEncontrados: number };
    items: AnalisisTemperaturaItem[];
    rowErrors: { rowNumber: number; message: string }[];
}

// Respuesta del endpoint unificado: "tipo" dice qué analizador corresponde —
// el resto de los campos son exactamente los de AnalisisExcelResponse o
// AnalisisTemperaturaResponse según ese valor.
export type AnalisisAutoResponse =
    | ({ tipo: 'equipos' } & AnalisisExcelResponse)
    | ({ tipo: 'temperatura' } & AnalisisTemperaturaResponse);

export interface ResumenCalidad {
    kpis: { total: number; activos: number; vencidos: number; porVencer: number; sinAsignar: number; retirados: number };
    equipos: Equipo[];
}

// --- Solicitudes URS aceptadas que cambian un equipo ---
export interface CambioSolicitud { campo: string; etiqueta: string; actual: string; nuevo: string }
export interface EquipoDelPlan {
    id_equipo: number;
    codigo: string;
    nombre: string;
    tipo?: string | null;
    sede?: string | null;
    id_muestreador?: number | null;
    responsable?: string | null;
    estado_equipo?: string | null;
    ultima_verificacion?: string | null;
    siguiente_verificacion?: string | null;
    fecha_baja?: string | null;
    rol: 'PRINCIPAL' | 'ASOCIADO';
    cambios: CambioSolicitud[];
}
export interface PlanSolicitudEquipo {
    id_solicitud: number;
    estado: string;
    /** _form_type de la solicitud: TRASPASO_EQUIPO, BAJA_EQUIPO, EXTENSION_VIGENCIA, REPORTE_PROBLEMA. */
    tipo: string;
    nombre_tipo: string;
    solicitante?: string | null;
    fecha_creacion?: string | null;
    motivo?: string;
    observacion_aceptacion: string;
    equipos: EquipoDelPlan[];
}
export interface ResultadoAplicar { resultados: { id_equipo: number; codigo: string; ok: boolean; error?: string }[]; realizada: boolean }

export const equipoService = {
    /** Qué hay que cambiar en los equipos por una solicitud aceptada (no modifica nada). */
    planSolicitud: async (idSolicitud: number): Promise<PlanSolicitudEquipo> =>
        (await apiClient.get(`/api/urs/${idSolicitud}/plan-equipo`)).data.data,
    /** Hace esos cambios, deja la observación de la aceptación y marca la solicitud como realizada. */
    aplicarSolicitud: async (idSolicitud: number): Promise<ResultadoAplicar> =>
        (await apiClient.post(`/api/urs/${idSolicitud}/aplicar-equipo`)).data.data,

    // Dashboard y Calendario de Vencimientos (Gestión de Calidad): vigencia y KPIs calculados en el backend.
    getResumenCalidad: async (): Promise<ResumenCalidad> => {
        const response = await apiClient.get('/api/admin/equipos/resumen-calidad');
        return response.data.data;
    },

    analizarExcel: async (file: File): Promise<AnalisisExcelResponse> => {
        const formData = new FormData();
        formData.append('archivo', file);
        const response = await apiClient.post('/api/admin/equipos/import-excel/analizar', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    analizarExcelTemperatura: async (file: File): Promise<AnalisisTemperaturaResponse> => {
        const formData = new FormData();
        formData.append('archivo', file);
        const response = await apiClient.post('/api/admin/equipos/import-excel/analizar-temperatura', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    // Un solo botón: detecta si el Excel es de Inventario o de Temperaturas.
    analizarExcelAuto: async (file: File): Promise<AnalisisAutoResponse> => {
        const formData = new FormData();
        formData.append('archivo', file);
        const response = await apiClient.post('/api/admin/equipos/import-excel/analizar-auto', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },


    getEquipos: async (params: any): Promise<EquiposResponse> => {
        const response = await apiClient.get('/api/admin/equipos/', { params });
        return response.data;
    },

    getReglasControl: async (): Promise<ReglasControl> => {
        const response = await apiClient.get('/api/admin/equipos/reglas-control');
        return response.data.data;
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

    /** Habilita (o no) un equipo Fuera de Servicio o Dado de Baja para la verificación de temperatura. */
    habilitarVerifTemp: async (id: number, habilitado: boolean) =>
        (await apiClient.put(`/api/admin/equipos/${id}/habilitar-verif-temp`, { habilitado })).data as { success: boolean; message?: string },

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

    /** Eliminación definitiva (solo ingresos erróneos, sin verificaciones ni fichas asociadas). Pide observación. */
    eliminarDefinitivo: async (id: number, observacion: string): Promise<any> => {
        const response = await apiClient.post(`/api/admin/equipos/${id}/eliminar-definitivo`, { observacion });
        return response.data;
    },

    /** Registro de equipos eliminados definitivamente. */
    equiposEliminados: async (q?: string): Promise<{ success: boolean; data: EquipoEliminado[] }> => {
        const response = await apiClient.get('/api/admin/equipos-eliminados', { params: { q: q || undefined } });
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

    /** ¿La sigla está libre para un tipo de equipo nuevo? → { disponible, usada_por } */
    siglaDisponible: async (sigla: string): Promise<{ disponible: boolean; usada_por: string | null }> =>
        (await apiClient.get('/api/admin/equipos/sigla-disponible', { params: { sigla } })).data.data,

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
