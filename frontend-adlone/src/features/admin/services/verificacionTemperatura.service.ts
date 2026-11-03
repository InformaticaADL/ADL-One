import apiClient from '../../../config/axios.config';

// Formulario OI-FoGe-39 "Verificación Intermedia de Temperatura" (G. Calidad).

export type EstadoVerificacion = 'BORRADOR' | 'PENDIENTE_FIRMA' | 'FIRMADA' | 'ANULADA';

export interface LecturaTemp {
    tp: number | null;
    tc: number | null;
    hora: string;
}

export type LecturasTemp = Record<'0' | '15' | '30', LecturaTemp[]>;

export interface VerificacionResumen {
    id_verificacion: number;
    id_equipo: number;
    codigo_equipo: string;
    nombre_equipo: string;
    sede: string;
    periodo: string;
    fecha_verificacion: string;
    patron_codigo: string | null;
    error0: number | null;
    error15: number | null;
    error30: number | null;
    cumple: 'S' | 'N' | null;
    estado: EstadoVerificacion;
    id_muestreador: number | null;
    muestreador_nombre: string | null;
    responsable_nombre: string | null;
    fecha_firma: string | null;
    siguiente_verificacion: string | null;
    pdf_ruta: string | null;
    motivo_anulacion: string | null;
}

// "Antecedentes del Termómetro Patrón" (C23:H28 de la hoja Excel).
export interface AntecedentesPatron {
    patron_marca: string | null;
    patron_modelo: string | null;
    patron_serie: string | null;
    patron_identificacion: string | null;
    patron_intervalo: string | null;
    patron_fecha_calibracion: string | null;
    patron_empresa: string | null;
    patron_maxima_division: string | null;
}

export interface VerificacionDetalle extends VerificacionResumen, Partial<AntecedentesPatron> {
    maxima_division: string | null;
    id_patron: number | null;
    patron_nombre: string | null;
    patron_error0: number | null;
    patron_error15: number | null;
    patron_error30: number | null;
    lecturas: LecturasTemp;
    observacion: string | null;
    tiene_firma: boolean;
    muestreador_tiene_firma: number;
}

export interface EquipoElegible {
    id_equipo: number;
    codigo: string;
    nombre: string;
    tipoequipo: string;
    sede: string;
    estado_equipo: string | null;
    habilitado: string;
    // 1 = el equipo está dado de baja (se lista igual, con advertencia).
    dado_baja: number;
    id_muestreador: number | null;
    nombre_muestreador: string | null;
    ultima_verificacion: string | null;
    siguiente_verificacion: string | null;
    id_ficha_periodo: number | null;
}

export interface PatronTemp {
    id_equipo: number;
    codigo: string;
    nombre: string;
    sede: string;
    error0: number | null;
    error15: number | null;
    error30: number | null;
    /** Últimos antecedentes registrados para este patrón (null si nunca se ingresaron). */
    antecedentes: AntecedentesPatron | null;
}

export interface MuestreadorFirma {
    id_muestreador: number;
    nombre_muestreador: string;
    habilitado: string;
    tiene_firma: number;
}

const BASE = '/api/verificaciones-temperatura';

export const verificacionTemperaturaService = {
    listar: async (params: { periodo?: string; estado?: string; sede?: string; search?: string }) =>
        (await apiClient.get(BASE, { params })).data.data as VerificacionResumen[],
    periodos: async () => (await apiClient.get(`${BASE}/periodos`)).data.data as { periodo: string; total: number; firmadas: number }[],
    elegibles: async (params: { sede?: string; periodo?: string }) =>
        (await apiClient.get(`${BASE}/equipos-elegibles`, { params })).data.data as EquipoElegible[],
    patrones: async () => (await apiClient.get(`${BASE}/patrones`)).data.data as PatronTemp[],
    muestreadores: async () => (await apiClient.get(`${BASE}/muestreadores`)).data.data as MuestreadorFirma[],
    obtener: async (id: number) => (await apiClient.get(`${BASE}/${id}`)).data.data as VerificacionDetalle,
    crear: async (body: { id_equipo: number; fecha: string; periodo: string }) =>
        (await apiClient.post(BASE, body)).data.data as { id_verificacion: number },
    crearLote: async (body: { ids_equipo: number[]; fecha: string; periodo: string }) =>
        (await apiClient.post(`${BASE}/lote`, body)).data.data as { creadas: number; ids: number[]; omitidas: { id_equipo: number; motivo: string }[] },
    actualizar: async (id: number, body: Partial<{ fecha_verificacion: string; maxima_division: string; id_patron: number; lecturas: LecturasTemp; observacion: string; id_muestreador: number | null; patron_antecedentes: AntecedentesPatron }>) =>
        (await apiClient.put(`${BASE}/${id}`, body)).data.data as VerificacionDetalle,
    enviarFirma: async (id: number) => (await apiClient.post(`${BASE}/${id}/enviar-firma`)).data.data as VerificacionDetalle,
    volverBorrador: async (id: number) => (await apiClient.post(`${BASE}/${id}/volver-borrador`)).data.data as VerificacionDetalle,
    firmar: async (id: number, body: { id_muestreador: number; firma?: string; usar_firma_registrada?: boolean }) =>
        (await apiClient.post(`${BASE}/${id}/firmar`, body)).data.data as VerificacionDetalle,
    anular: async (id: number, motivo: string) => (await apiClient.post(`${BASE}/${id}/anular`, { motivo })).data,
    // Firma registrada del muestreador (imagen), para mostrarla antes de usarla.
    firmaRegistrada: async (idMuestreador: number) =>
        (await apiClient.get(`${BASE}/muestreadores/${idMuestreador}/firma`)).data.data as { id_muestreador: number; nombre_muestreador: string; firma: string | null },
    // Firma desde el celular: genera el QR (enlace de un solo uso, 15 minutos).
    iniciarFirmaRemota: async (id: number, id_muestreador: number) =>
        (await apiClient.post(`${BASE}/${id}/firma-remota`, { id_muestreador })).data.data as { token: string; url: string; qr: string; expira: string },
    estadoFirmaRemota: async (id: number, token: string) =>
        (await apiClient.get(`${BASE}/${id}/firma-remota/${token}`)).data.data as { estado: 'pendiente' | 'firmado'; registrada?: boolean; firma?: string; expira?: string },
    // El PDF va con token: se baja como blob y se muestra con una url local.
    pdfUrl: async (id: number) => {
        const res = await apiClient.get(`${BASE}/${id}/pdf`, { responseType: 'blob' });
        return URL.createObjectURL(res.data as Blob);
    },
};
