import apiClient from '../../../config/axios.config';

interface FichaUser {
    id?: number;
    id_usuario?: number;
    nombre_usuario?: string;
    usuario?: string;
    [key: string]: unknown;
}

interface ObsPayload {
    observaciones?: string;
    [key: string]: unknown;
}

export const fichaService = {
    getAll: async () => {
        const response = await apiClient.get('/api/fichas/');
        return response.data;
    },
    getEnProceso: async (month?: number, year?: number) => {
        let url = '/api/fichas/en-proceso';
        const params = new URLSearchParams();
        if (month) params.append('month', month.toString());
        if (year) params.append('year', year.toString());

        const queryString = params.toString();
        if (queryString) url += `?${queryString}`;

        const response = await apiClient.get(url);
        return response.data;
    },
    getMuestreosEjecutados: async () => {
        const response = await apiClient.get('/api/fichas/ejecutados');
        return response.data;
    },
    updateRealizadoGem: async (idAgendamam: number, isRealizado: boolean) => {
        const response = await apiClient.patch(`/api/fichas/agenda/${idAgendamam}/realizado-gem`, { isRealizado });
        return response.data;
    },
    updateCasoAdlab: async (idAgendamam: number, casoAdlab: string) => {
        const response = await apiClient.patch(`/api/fichas/agenda/${idAgendamam}/caso-adlab`, { casoAdlab });
        return response.data;
    },
    regenerarDocumentos: async (idAgendamam: number, opts: { foma: boolean; cadena: boolean }) => {
        const response = await apiClient.post('/api/fichas/regenerar-documentos', {
            id_agendamam: idAgendamam,
            foma: opts.foma,
            cadena: opts.cadena
        });
        return response.data as {
            success: boolean;
            data: {
                foma: { ok: boolean; error?: string } | null;
                cadena: { ok: boolean; regenerados?: number; error?: string } | null;
            };
        };
    },

    create: async (data: Record<string, unknown>) => {
        const response = await apiClient.post('/api/fichas/create', data);
        return response.data;
    },
    // Visita con varios puntos: una ficha por punto (mismos datos y análisis, costo operativo una sola vez), agrupadas.
    createGrupo: async (data: Record<string, unknown>) => {
        const response = await apiClient.post('/api/fichas/create-grupo', data);
        return response.data;
    },
    // Agrupa fichas que ya existen (misma empresa y centro) como una sola visita.
    agrupar: async (ids: number[], nota?: string, conservarOrden?: boolean) => {
        const response = await apiClient.post('/api/fichas/agrupar', { ids, nota, conservarOrden });
        return response.data;
    },
    desagrupar: async (idGrupo: number) => {
        const response = await apiClient.post('/api/fichas/desagrupar', { id_grupo: idGrupo });
        return response.data;
    },
    // Grupo de una ficha con todos sus puntos; null si no pertenece a ninguno.
    getGrupo: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/grupo`);
        return response.data;
    },
    // Programación y ejecución de la ficha: un renglón por servicio con su estado y fechas, más un resumen.
    getProgramacion: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/programacion`);
        return response.data?.data;
    },
    // Acompañante (opcional) de la visita a la que pertenece la ficha; id_grupo null si la ficha va sola.
    getAcompanante: async (id: number): Promise<{ id_grupo: number | null; id_muestreador: number | null; nombre: string | null }> => {
        const response = await apiClient.get(`/api/fichas/${id}/acompanante`);
        return response.data?.data ?? response.data;
    },
    setAcompanante: async (id: number, idMuestreador: number | null) => {
        const response = await apiClient.put(`/api/fichas/${id}/acompanante`, { id_muestreador: idMuestreador });
        return response.data;
    },
    update: async (id: number, data: Record<string, unknown>, user?: FichaUser) => {
        const payload = { ...data, user };
        const response = await apiClient.post(`/api/fichas/${id}/update`, payload);
        return response.data;
    },
    getById: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}`);
        return response.data;
    },
    approve: async (id: number, data: ObsPayload) => {
        const response = await apiClient.post(`/api/fichas/${id}/approve`, data);
        return response.data;
    },
    reject: async (id: number, data: ObsPayload) => {
        const response = await apiClient.post(`/api/fichas/${id}/reject`, data);
        return response.data;
    },
    // Aprueba de una vez todos los puntos de la visita de la ficha (etapa: 'tecnica' | 'coordinacion')
    aprobarVisita: async (id: number, etapa: 'tecnica' | 'coordinacion', data: ObsPayload) => {
        const response = await apiClient.post(`/api/fichas/${id}/approve-visita/${etapa}`, data);
        return response.data;
    },
    /** Devuelve a Comercial todos los puntos pendientes de la visita de la ficha (mismo motivo para todos). */
    rechazarVisita: async (id: number, etapa: 'tecnica' | 'coordinacion', data: ObsPayload) => {
        const response = await apiClient.post(`/api/fichas/${id}/reject-visita/${etapa}`, data);
        return response.data;
    },
    /** Edita solo nombre, zona, coordenadas y mapa de los puntos de una visita. */
    actualizarPuntosVisita: async (id: number, puntos: Array<{ id: number; punto: string; zona: string; utmNorte: string; utmEste: string; refGoogle: string }>) => {
        const response = await apiClient.post(`/api/fichas/${id}/puntos-visita`, { puntos });
        return response.data;
    },
    /** «Editar visita»: quita puntos (cada uno se cancela con un motivo). Si queda uno solo, la visita se deshace. */
    quitarPuntosVisita: async (id: number, data: { ids: number[]; idMotivo: number; observacion: string }) => {
        const response = await apiClient.post(`/api/fichas/${id}/quitar-puntos`, data);
        return response.data;
    },
    /** «Editar visita»: agrega puntos nuevos (cada uno, una ficha más de la visita) con sus análisis y su parte del costo operativo. */
    agregarPuntosVisita: async (id: number, data: { antecedentes: Record<string, unknown>; puntos: Array<Record<string, unknown>>; observaciones?: string }) => {
        const response = await apiClient.post(`/api/fichas/${id}/agregar-puntos`, data);
        return response.data;
    },
    /** «Editar visita»: antecedentes comunes y/o análisis y precio de cada punto (cada punto conserva lo suyo). */
    actualizarVisita: async (id: number, data: { antecedentes?: Record<string, unknown>; analisisPorFicha?: Array<{ id: number; analisis: any[]; costoOperativo: { activo: boolean; uf: number } }>; observaciones?: string }) => {
        const response = await apiClient.post(`/api/fichas/${id}/editar-visita`, data);
        return response.data;
    },
    approveCoordinacion: async (id: number, data: ObsPayload) => {
        const response = await apiClient.post(`/api/fichas/${id}/approve-coordinacion`, data);
        return response.data;
    },
    reviewCoordinacion: async (id: number, data: ObsPayload) => {
        const response = await apiClient.post(`/api/fichas/${id}/review-coordinacion`, data);
        return response.data;
    },
    updateAgenda: async (id: number, data: Record<string, unknown>) => {
        const response = await apiClient.post(`/api/fichas/${id}/agenda`, data);
        return response.data;
    },
    getForAssignment: async () => {
        const response = await apiClient.get('/api/fichas/for-assignment');
        return response.data;
    },
    resolveGoogleUrl: async (url: string) => {
        const response = await apiClient.get(`/api/fichas/resolve-url?url=${encodeURIComponent(url)}`);
        return response.data.data; // returns { finalUrl: string }
    },
    getAssignmentDetail: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/assignment-detail`);
        return response.data.data; // Backend wraps in { success, data, message }
    },
    batchUpdateAgenda: async (data: {
        assignments: {
            id: number,
            fecha: string | null,
            fechaRetiro?: string | null,
            idMuestreadorInstalacion: number | null,
            idMuestreadorRetiro: number | null,
            idFichaIngresoServicio: number,
            frecuenciaCorrelativo: string
        }[],

        user?: FichaUser,
        observaciones?: string,
        observacionNotificacion?: string | null,
        reactivating?: boolean
    }) => {
        const response = await apiClient.post('/api/fichas/batch-agenda', data);
        return response.data.data; // Access nested data from successResponse wrapper
    },
    getHistorial: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/historial`);
        return response.data.data;
    },
    // `tambien`: agendas de otros puntos de la misma visita que se cancelan junto con esta (mismo motivo y observación).
    cancelAgendaSampling: async (idAgenda: number, idFicha: number, user: FichaUser, motivo_cancelacion: string, idMotivoCancelacion: number, tambien: number[] = []) => {
        const response = await apiClient.post('/api/fichas/cancel-sampling', { idAgenda, idFicha, user, motivo_cancelacion, idMotivoCancelacion, tambien });
        return response.data;
    },
    // Portada del usuario: lo que le toca atender según sus permisos (todo en visitas).
    getResumenInicio: async (): Promise<any> => {
        const response = await apiClient.get('/api/fichas/mi-resumen');
        return response.data?.data ?? {};
    },
    // Dashboard Operativo (en visitas): embudo por etapa y agenda reciente (una fila por punto y servicio).
    getDashboardOperativo: async (): Promise<{ etapas: { etapa: string; visitas: number; puntos: number; dias_mas_antigua: number | null }[]; agenda: any[]; generado: string }> => {
        const response = await apiClient.get('/api/fichas/dashboard-operativo');
        return response.data?.data ?? { etapas: [], agenda: [], generado: '' };
    },
    // Fichas parecidas ya creadas (mismo cliente, centro, objetivo y punto) para avisar antes de grabar una duplicada.
    getPosiblesDuplicadas: async (p: { cliente: number | string; centro: number | string; objetivo: number | string; puntos: string[]; dias?: number }): Promise<{ id: number; ficha: string; punto: string; fecha: string; estado: string }[]> => {
        const response = await apiClient.get('/api/fichas/posibles-duplicadas', { params: { cliente: p.cliente, centro: p.centro, objetivo: p.objetivo, puntos: p.puntos.join('|'), dias: p.dias ?? 30 } });
        return response.data?.data ?? [];
    },
    // Cancela una ficha completa con motivo (p. ej. una ficha duplicada). No borra nada.
    cancelarFicha: async (id: number, idMotivo: number, observacion: string) => {
        const response = await apiClient.post(`/api/fichas/${id}/cancel-ficha`, { idMotivo, observacion });
        return response.data;
    },
    // Cancela una visita completa (duplicada o creada por error) con motivo: todos sus puntos. No borra nada.
    cancelarVisita: async (id: number, idMotivo: number, observacion: string) => {
        const response = await apiClient.post(`/api/fichas/${id}/cancelar-visita`, { idMotivo, observacion });
        return response.data;
    },
    // Quita la asignación (responsable y fecha): el servicio vuelve a quedar pendiente de coordinar. No es una cancelación.
    quitarAsignacion: async (idsAgenda: number[], observacion?: string) => {
        const response = await apiClient.post('/api/fichas/unassign-agenda', { idsAgenda, observacion });
        return response.data;
    },
    // Otros puntos de la visita que comparten este muestreo y todavía se pueden cancelar (vacío si la ficha no es de una visita).
    // modo 'ejecutados': en cambio devuelve los que ya se ejecutaron (para moverse entre ellos en el detalle).
    getPuntosVisita: async (idAgenda: number, modo: 'cancelables' | 'ejecutados' = 'cancelables'): Promise<{ id_agenda: number; id_ficha: number; punto: string | null; correlativo: string }[]> => {
        const response = await apiClient.get(`/api/fichas/agenda/${idAgenda}/puntos-visita`, { params: { modo } });
        return response.data?.data ?? [];
    },
    getSamplingEquipos: async (idFicha: number, correlativo: string) => {
        const response = await apiClient.get(`/api/fichas/${idFicha}/sampling-equipos?correlativo=${correlativo}`);
        return response.data;
    },
    downloadPdf: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/pdf`, { responseType: 'blob' });
        return response.data;
    },
    downloadExcel: async (id: number) => {
        const response = await apiClient.get(`/api/fichas/${id}/excel`, { responseType: 'blob' });
        return response.data;
    },
    enviarDocumentoManual: async (data: { idFicha: number; correlativo: string; documento: string | Blob; to: string; cc: string }) => {
        const response = await apiClient.post('/api/fichas/enviar-documento-manual', data);
        return response.data;
    },
    bulkParse: async (formData: FormData) => {
        const response = await apiClient.post('/api/fichas/bulk-parse', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    },
    bulkCommit: async (data: { items: Record<string, unknown>[], userId?: number }) => {
        const response = await apiClient.post('/api/fichas/bulk-commit', data);
        return response.data;
    },
    // Análisis fijos que se pre-agregan a toda ficha nueva (pH + Temperatura, DS 90 / Tabla 1 / Terreno)
    getDefaultAnalyses: async (): Promise<any[]> => {
        const response = await apiClient.get('/api/fichas/analisis-por-defecto');
        return response.data?.data || [];
    },
    downloadBulkTemplate: async () => {
        const response = await apiClient.get('/api/fichas/bulk-template', { responseType: 'blob' });
        // Trigger browser download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const date = new Date().toISOString().slice(0, 10);
        link.setAttribute('download', `Formato_Carga_Masiva_ADL_${date}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }
};
