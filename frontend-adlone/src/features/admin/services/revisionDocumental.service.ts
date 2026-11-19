import apiClient from '../../../config/axios.config';

export interface RevisionDocumental {
    anio: number;
    fecha_inicio: string;
    fecha_fin: string | null;
    motivo?: string | null;
    vigente: boolean;
}

export interface DocumentoControlado {
    codigo: string;
    nombre: string;
    version: string;
    fecha_vigencia: string;
    /** Revisión propia del documento (modificación a mitad de año); null = rige la anual. */
    fecha_revision: string | null;
    motivo?: string | null;
    /** Lo que sale hoy en el encabezado del PDF. */
    encabezado: { version: string | null; vigencia: string | null; revision: string | null };
}

export interface RevisionesDocumentales {
    /** false mientras falte ejecutar la migración: se ven las fechas pero no se pueden cambiar. */
    editable: boolean;
    revisiones: RevisionDocumental[];
    documentos_editables: boolean;
    documentos: DocumentoControlado[];
}

const BASE = '/api/revision-documental';

export const revisionDocumentalService = {
    listar: async () => (await apiClient.get(BASE)).data.data as RevisionesDocumentales,
    guardar: async (anio: number, cuerpo: { fecha_inicio: string; motivo?: string }) =>
        (await apiClient.put(`${BASE}/${anio}`, cuerpo)).data.data as RevisionesDocumentales,
    guardarDocumento: async (codigo: string, cuerpo: { nombre?: string; version: string; fecha_vigencia: string; fecha_revision?: string | null; motivo?: string }) =>
        (await apiClient.put(`${BASE}/documentos/${encodeURIComponent(codigo)}`, cuerpo)).data.data as RevisionesDocumentales,
    /** PDF del formulario en blanco con el encabezado que se está editando (no guarda nada). */
    vistaPreviaUrl: async (codigo: string, cuerpo: { nombre?: string; version?: string; fecha_vigencia?: string; fecha_revision?: string | null }) =>
        URL.createObjectURL((await apiClient.post(`${BASE}/documentos/${encodeURIComponent(codigo)}/vista-previa`, cuerpo, { responseType: 'blob' })).data as Blob),
    eliminar: async (anio: number) => (await apiClient.delete(`${BASE}/${anio}`)).data.data as RevisionesDocumentales,
};
