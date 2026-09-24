import apiClient from '../../../config/axios.config';

export type EntidadRevision = 'CLI_EMPRESA' | 'CLI_SERVICIO' | 'CLI_CENTRO' | 'FAC_CONVENIO';
export type AccionRevision = 'FUSIONAR' | 'MANTENER_SEPARADO' | 'DESCARTAR';
export type EstadoRevision = 'PENDIENTE' | 'FUSIONAR' | 'MANTENER_SEPARADO' | 'DESCARTAR';

export interface LadoDuplicado {
    legado_id: number;
    nombre: string;
    fantasia?: string | null;
    codigo?: string | null;
    rut?: string | null;
    empresa?: string | null;
    email?: string | null;
    email_facturacion?: string | null;
    direccion?: string | null;
    ubicacion?: string | null;
    servicio?: string | null;
    centro?: string | null;
    tarifas?: number;
    usos?: number;
    lat?: number | null;
    lon?: number | null;
    habilitada?: boolean;
    habilitado?: boolean;
    fichas: number;
}

export interface ParDuplicado {
    id: number;
    entidad: EntidadRevision;
    id_registro_a: number;
    id_registro_b: number;
    criterio: string;
    distancia_metros: number | null;
    detalle: { a: LadoDuplicado; b: LadoDuplicado; comparacion?: { en_comun: number; precio_distinto: number; solo_a: number; solo_b: number } } | null;
    estado: EstadoRevision;
    revisado_en: string | null;
    observacion: string | null;
}

export interface ResumenFila { entidad: string; criterio: string; estado: string; n: number }

export interface FiltrosRevision {
    entidad: EntidadRevision;
    criterio?: string;
    estado?: EstadoRevision | 'TODOS';
    q?: string;
    soloConFichas?: boolean;
    page?: number;
    limit?: number;
}

const BASE = '/api/revision-duplicados';

export const revisionDuplicadosService = {
    async resumen(): Promise<ResumenFila[]> {
        const { data } = await apiClient.get(`${BASE}/resumen`);
        return data.data;
    },
    async listar(f: FiltrosRevision): Promise<{ items: ParDuplicado[]; total: number; page: number; limit: number }> {
        const { data } = await apiClient.get(BASE, { params: { ...f, soloConFichas: f.soloConFichas ? 'true' : undefined } });
        return { items: data.data, total: data.pagination.total, page: data.pagination.page, limit: data.pagination.limit };
    },
    async resolver(id: number, body: { accion: AccionRevision; mantener?: 'A' | 'B'; observacion?: string }) {
        const { data } = await apiClient.post(`${BASE}/${id}/resolver`, body);
        return data;
    },
    async resolverLote(ids: number[], body: { accion: AccionRevision; observacion?: string }): Promise<{ ok: number; errores: { id: number; mensaje: string }[] }> {
        const { data } = await apiClient.post(`${BASE}/resolver-lote`, { ids, ...body });
        return data.data;
    },
};
