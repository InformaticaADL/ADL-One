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

// Fila de la hoja "Resumen": cada equipo con su última ficha (o, si aún no
// tiene, lo registrado en el equipo: eq_*).
export interface ResumenEquipo {
    id_equipo: number;
    codigo: string;
    nombre: string;
    tipoequipo: string;
    sede: string;
    estado_equipo: string | null;
    habilitado: string;
    dado_baja: number;
    equipo_asociado: string | null;
    nombre_muestreador: string | null;
    eq_error0: number | null;
    eq_error15: number | null;
    eq_error30: number | null;
    eq_ultima_verificacion: string | null;
    eq_siguiente_verificacion: string | null;
    id_verificacion: number | null;
    periodo: string | null;
    fecha_verificacion: string | null;
    error0: number | null;
    error15: number | null;
    error30: number | null;
    cumple: 'S' | 'N' | null;
    estado: EstadoVerificacion | null;
    del_periodo: number;
}

export interface ResumenPeriodo {
    periodo: string;
    total: number;
    firmadas: number;
    pendientes: number;
    borradores: number;
    cumplen: number;
    no_cumplen: number;
    prom_abs0: number | null;
    prom_abs15: number | null;
    prom_abs30: number | null;
}

export interface ResumenVerificaciones {
    periodo: string;
    tolerancia: number;
    equipos: ResumenEquipo[];
    serie: ResumenPeriodo[];
}

// Tabla "Errores de patrón": por año y termómetro patrón.
export interface ErrorPatronRegistro {
    id_error: number;
    id_equipo: number;
    codigo: string;
    anio: number;
    fecha_calibracion: string | null;
    error0: number | null;
    error15: number | null;
    error30: number | null;
    valido_hasta: string | null;
    fecha_modificacion?: string;
}

export interface ErroresPatron {
    /** false = falta la migración add_errores_termometro_patron.sql */
    disponible: boolean;
    patrones: { id_equipo: number; codigo: string; nombre: string; sede: string; habilitado: string; error0: number | null; error15: number | null; error30: number | null }[];
    registros: ErrorPatronRegistro[];
}

export interface ErrorPatronEntrada {
    id_equipo: number;
    anio: number;
    fecha_calibracion: string | null;
    error0: number | string | null;
    error15: number | string | null;
    error30: number | string | null;
    valido_hasta: string | null;
}

const BASE = '/api/verificaciones-temperatura';

export const verificacionTemperaturaService = {
    listar: async (params: { periodo?: string; estado?: string; sede?: string; search?: string }) =>
        (await apiClient.get(BASE, { params })).data.data as VerificacionResumen[],
    periodos: async () => (await apiClient.get(`${BASE}/periodos`)).data.data as { periodo: string; total: number; firmadas: number }[],
    elegibles: async (params: { sede?: string; periodo?: string }) =>
        (await apiClient.get(`${BASE}/equipos-elegibles`, { params })).data.data as EquipoElegible[],
    patrones: async () => (await apiClient.get(`${BASE}/patrones`)).data.data as PatronTemp[],
    resumen: async (periodo?: string) =>
        (await apiClient.get(`${BASE}/resumen`, { params: { periodo } })).data.data as ResumenVerificaciones,
    erroresPatron: async () => (await apiClient.get(`${BASE}/errores-patron`)).data.data as ErroresPatron,
    // Agrega un año nuevo (posterior al vigente de cada patrón).
    guardarErroresPatron: async (filas: ErrorPatronEntrada[]) =>
        (await apiClient.post(`${BASE}/errores-patron`, { filas })).data.data as ErroresPatron,
    // Solo el registro vigente de cada patrón.
    actualizarErrorPatron: async (idError: number, fila: Omit<ErrorPatronEntrada, 'id_equipo'>) =>
        (await apiClient.put(`${BASE}/errores-patron/${idError}`, fila)).data.data as ErroresPatron,
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
    // Solo fichas en borrador: se borran del todo.
    eliminar: async (id: number) => (await apiClient.delete(`${BASE}/${id}`)).data,
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
