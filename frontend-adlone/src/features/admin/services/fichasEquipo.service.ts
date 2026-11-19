import apiClient from '../../../config/axios.config';

// Formularios del equipo en PDF:
//   OI-FoGe-22 Ficha técnica · OI-FoGe-24 Historial por año · OI-FoGe-36 Ficha de entrega
//   · OI-FoGe-42 Recepción, puesta en marcha y verificación.

const BASE = '/api/admin/equipos';

export interface HistorialAnios {
    id_equipo: number;
    codigo: string;
    nombre: string;
    anios: { anio: number; cantidad: number }[];
    lineas: { anio: number; fecha: string; texto: string }[];
    /** Líneas de la observación sin fecha: no entran en ningún año. */
    sin_fecha: number;
}

/** Fila de calibración / mantención de la ficha técnica, escrita a mano. */
export interface RegistroFichaTecnica {
    id: string;
    /** Calibración y mantención van juntas en la fila (como en el formato); cualquiera puede quedar vacía. */
    fecha_calibracion: string;
    proxima_calibracion: string;
    fecha_mantencion: string;
    proxima_mantencion: string;
    institucion: string;
    certificado: string;
    observaciones: string;
    /** La columna FIRMA lleva la firma guardada de quien llena la ficha (perfil). */
    firmar?: boolean;
}

export interface DatosFichaTecnica {
    id_equipo: number;
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    codigo: string;
    frecuencia_calibracion: string;
    frecuencia_mantencion: string;
    fecha_adquisicion: string | null;
    fecha_baja: string | null;
    observaciones: string;
    autorizacion_uso: string[];
    estado: string;
    /** Servicio anual del equipo (la próxima fecha se propone a un año): TPA/STP calibración, MAU/MOL mantención. */
    servicio_anual: 'calibracion' | 'mantencion' | null;
    /** Tipo de las filas: TPA/STP calibración; MAU, MOL y MPA/SON/MOD/SOD (al volver de reparación) mantención; null = sin filas. */
    tipo_registro: 'calibracion' | 'mantencion' | null;
    /** N° Documento de la ficha del equipo ('' si no tiene): certificado / informe de cada fila. */
    n_documento: string;
    /**
     * Firmas que se pueden poner: quien llena la ficha (realiza) y el Jefe
     * Técnico / Jefe de Terreno de Medio Ambiente (validan), con su firma guardada.
     */
    firmantes_ficha: FirmanteFicha[];
}

export interface DatosFichaEntrega {
    nombre: string;
    marca: string;
    modelo: string;
    serie: string;
    codigo: string;
    proveedor: string;
    n_factura: string;
    fecha_factura: string;
    valor: string;
    frecuencia_mantencion: string;
    fecha_adquisicion: string;
    area: string;
    seccion: string;
    responsable_equipo: string;
    fecha_recepcion: string;
    observaciones: string;
    responsable_entrega: string;
    responsable_area: string;
    fecha_entrega: string;
}

/** Ítems del OI-FoGe-42 con sus tres opciones (mismo orden y texto que el formato). */
export const ITEMS_RECEPCION = {
    caja: ['Sin problema', 'Con Golpe', 'No Aplica'],
    embalaje: ['Cumple', 'No Cumple', 'No Aplica'],
    manual: ['Con Manual', 'Sin Manual', 'No Aplica'],
    cable: ['Sí', 'No', 'No Aplica'],
    accesorios: ['Sí', 'No', 'No Aplica'],
    interruptor: ['Bueno', 'Malo', 'No Aplica'],
    comandos: ['Buena', 'Mala', 'No Aplica'],
    encendido: ['Enciende', 'No Enciende', 'No Aplica'],
} as const;
export type ItemRecepcion = keyof typeof ITEMS_RECEPCION;

export interface DatosFichaRecepcion extends Record<ItemRecepcion, string> {
    nombre: string;
    codigo: string;
    marca: string;
    modelo: string;
    serie: string;
    fecha: string;
    recepcion: boolean;
    puesta_marcha: boolean;
    verificacion: boolean;
    otros: string;
    estado_recepcion: string;
    funcionamiento: string;
    patron_referencia: string;
    observaciones: string;
    firma_recepcion: string;
    firma_calidad: string;
}

/** Recepción / puesta en marcha detectada en la observación o en una verificación de T° firmada. */
export interface EventoRecepcion {
    id: string;
    fecha: string;
    texto: string;
    origen: string;
    recepcion: boolean;
    puesta_marcha: boolean;
    verificacion: boolean;
    /** La línea habla de una falla o la verificación no cumple. */
    falla: boolean;
    firmante: string;
    funcionamiento: string;
    patron_referencia: string;
}

export interface DatosRecepcionEquipo {
    id_equipo: number;
    nombre: string;
    codigo: string;
    marca: string;
    modelo: string;
    serie: string;
    /** Del más reciente al más antiguo. */
    eventos: EventoRecepcion[];
}

export type PdfGenerado = { url: string; nombre: string };

// El PDF va con token: se baja como blob y se muestra con una url local.
const comoPdf = (res: { data: Blob; headers: Record<string, unknown> }, porDefecto: string): PdfGenerado => {
    const cab = res.headers['x-nombre-archivo'];
    const nombre = typeof cab === 'string' ? decodeURIComponent(cab) : porDefecto;
    return { url: URL.createObjectURL(res.data), nombre };
};

// --- FIRMAS DE LAS FICHAS: importar una registrada o firmar desde el celular (QR) ---
export interface ResponsableEntrega { id_usuario: number; nombre: string; cargo: string | null; tiene_firma: boolean }
export interface FirmaRegistrada { tipo: 'USUARIO' | 'MUESTREADOR'; id: number; nombre: string; cargo: string | null }
export interface SesionFirmaFicha { token: string; url: string; qr: string; expira: string }
export interface EstadoFirmaFicha {
    estado: 'pendiente' | 'completo';
    expira: string;
    slots: { id: string; firmada: boolean; firma: string | null }[];
}

// La lista de firmas registradas se pide una vez por sesión de la pantalla (la usan varios campos a la vez).
let firmasRegistradasEnCurso: Promise<FirmaRegistrada[]> | null = null;

export const fichasEquipoService = {
    /** Quiénes pueden ser responsable de entrega y de área en la ficha de entrega. */
    responsablesEntrega: async () => (await apiClient.get(`${BASE}/fichas/responsables-entrega`)).data.data as ResponsableEntrega[],
    /** Personas con firma registrada (sin la imagen). */
    firmasRegistradas: (): Promise<FirmaRegistrada[]> => {
        if (!firmasRegistradasEnCurso) {
            firmasRegistradasEnCurso = apiClient.get(`${BASE}/fichas/firmas-registradas`)
                .then((r) => r.data.data as FirmaRegistrada[])
                .catch((e) => { firmasRegistradasEnCurso = null; throw e; });
        }
        return firmasRegistradasEnCurso;
    },
    /** Imagen (data URL) de la firma registrada de una persona. */
    imagenFirmaRegistrada: async (tipo: FirmaRegistrada['tipo'], id: number) =>
        (await apiClient.get(`${BASE}/fichas/firmas-registradas/${tipo}/${id}`)).data.data.firma as string,
    /** Genera el QR para firmar desde el celular las firmas que faltan (enlace de un solo uso, 15 minutos). */
    crearFirmaRemota: async (cuerpo: { titulo: string; subtitulo?: string; slots: { id: string; titulo: string; nombre?: string | null; firmada?: boolean }[] }) =>
        (await apiClient.post(`${BASE}/fichas/firma-remota`, cuerpo)).data.data as SesionFirmaFicha,
    estadoFirmaRemota: async (token: string) =>
        (await apiClient.get(`${BASE}/fichas/firma-remota/${token}`)).data.data as EstadoFirmaFicha,

    historialAnios: async (idEquipo: number) =>
        (await apiClient.get(`${BASE}/${idEquipo}/fichas/historial`)).data.data as HistorialAnios,

    /** Agrega una observación al equipo (queda en su observación y en el historial de ese año). */
    historialObservacion: async (idEquipo: number, fecha: string, texto: string) =>
        (await apiClient.post(`${BASE}/${idEquipo}/fichas/historial/observacion`, { fecha, texto })).data.data as HistorialAnios,

    historialPdf: async (idEquipo: number, anio: number) =>
        comoPdf(await apiClient.get(`${BASE}/${idEquipo}/fichas/historial/pdf`, { params: { anio }, responseType: 'blob' }), `OI-FoGe-24 ${anio}.pdf`),

    tecnicaDatos: async (idEquipo: number) =>
        (await apiClient.get(`${BASE}/${idEquipo}/fichas/tecnica`)).data.data as DatosFichaTecnica,

    tecnicaPdf: async (idEquipo: number, body: Partial<DatosFichaTecnica> & {
        registros?: Omit<RegistroFichaTecnica, 'id'>[];
        /** Firmas marcadas: guardada del perfil o dibujada en el momento. */
        firmas_ficha?: { id_usuario: number; usar_guardada: boolean; imagen: string | null }[];
    }) =>
        comoPdf(await apiClient.post(`${BASE}/${idEquipo}/fichas/tecnica/pdf`, body, { responseType: 'blob' }), 'OI-FoGe-22.pdf'),

    entregaPdf: async (datos: DatosFichaEntrega & {
        /** Firmas (imagen en data URL): quien recibe, quien entrega y el responsable de área. */
        firma_equipo?: string | null;
        firma_entrega?: string | null;
        /** Quien entrega usa su firma guardada en el perfil. */
        usar_mi_firma_entrega?: boolean;
        firma_area?: string | null;
    }) =>
        comoPdf(await apiClient.post(`${BASE}/fichas/entrega/pdf`, datos, { responseType: 'blob' }), 'OI-FoGe-36.pdf'),

    recepcionDatos: async (idEquipo: number) =>
        (await apiClient.get(`${BASE}/${idEquipo}/fichas/recepcion`)).data.data as DatosRecepcionEquipo,

    recepcionPdf: async (datos: DatosFichaRecepcion & FirmasRecepcion) =>
        comoPdf(await apiClient.post(`${BASE}/fichas/recepcion/pdf`, datos, { responseType: 'blob' }), 'OI-FoGe-42.pdf'),

    // ── Fichas guardadas ────────────────────────────────────────────────────
    /** Guarda la ficha (el PDF con sus firmas queda en el sistema). Sin `idEquipo`: equipo en creación. */
    guardar: async (tipo: TipoFichaGuardada, idEquipo: number | null, cuerpo: object) => {
        const url = tipo === 'tecnica' || tipo === 'historial'
            ? `${BASE}/${idEquipo}/fichas/${tipo}/guardar`
            : `${BASE}/fichas/${tipo}/guardar`;
        return (await apiClient.post(url, { ...cuerpo, id_equipo: idEquipo })).data.data as { id_ficha: number; fecha_creacion: string; nombre: string };
    },

    guardadas: async (idEquipo: number, tipo?: TipoFichaGuardada) =>
        (await apiClient.get(`${BASE}/${idEquipo}/fichas/guardadas`, { params: { tipo } })).data.data as { disponible: boolean; fichas: FichaGuardada[] },

    guardadaPdf: async (idFicha: number) =>
        comoPdf(await apiClient.get(`${BASE}/fichas/guardadas/${idFicha}/pdf`, { responseType: 'blob' }), 'ficha.pdf'),

    /** Anula una ficha guardada (queda registrada como anulada, con motivo). */
    anularGuardada: async (idFicha: number, motivo: string) =>
        (await apiClient.post(`${BASE}/fichas/guardadas/${idFicha}/anular`, { motivo })).data,

    // ── Archivo de fichas de todos los equipos (consulta por año de vigencia) ──
    archivo: async (params: { tipo?: TipoFichaGuardada; anio?: number; sede?: string; estado?: EstadoFichaArchivo; q?: string; page?: number; limit?: number }) =>
        (await apiClient.get(`${BASE}/fichas/archivo`, { params })).data.data as { disponible: boolean; total: number; page: number; limit: number; fichas: FichaArchivo[] },

    archivoAnios: async () =>
        (await apiClient.get(`${BASE}/fichas/archivo/anios`)).data.data as { disponible: boolean; anios: AnioArchivo[] },

    /** Ficha vigente del mismo tipo (y año) para avisar antes de guardar otra igual; null si no hay. */
    guardadaVigente: async (idEquipo: number, tipo: TipoFichaGuardada, anio?: number | null) =>
        (await apiClient.get(`${BASE}/${idEquipo}/fichas/guardadas/vigente`, { params: { tipo, anio: anio ?? undefined } })).data.data as
            { id_documento: number; anio: number | null; nombre_usuario: string | null; fecha_creacion: string } | null,
};

/** Firmas del formulario de recepción (imagen en data URL); el nombre va en firma_recepcion / firma_calidad. */
export interface FirmasRecepcion {
    imagen_firma_recepcion?: string | null;
    /** Recepción Área Técnica con la firma guardada del perfil. */
    usar_mi_firma_recepcion?: boolean;
    imagen_firma_calidad?: string | null;
}

export interface FirmanteFicha {
    id_usuario: number;
    nombre: string;
    cargo: string | null;
    /** REALIZA: quien llena la ficha; VALIDA: Jefe Técnico / Jefe de Terreno. */
    rol: 'REALIZA' | 'VALIDA';
    /** Su firma guardada (mae_firma_digital) o null. */
    firma_guardada: string | null;
}

export type TipoFichaGuardada = 'tecnica' | 'historial' | 'entrega' | 'recepcion' | 'caudal';

export type EstadoFichaArchivo = 'VIGENTE' | 'ANULADO' | 'TODOS';

/** Fila del archivo de fichas (todas las de todos los equipos, sin el PDF). */
export interface FichaArchivo {
    id_ficha: number;
    tipo: TipoFichaGuardada | null;
    formato: string;
    nombre_formulario: string | null;
    id_equipo: number | null;
    codigo_equipo: string | null;
    nombre_equipo: string | null;
    sede: string | null;
    /** Año de vigencia: en que se emitió (el historial, el año que cubre). */
    anio: number | null;
    fecha_documento: string;
    nombre_archivo: string;
    tamano_bytes: number | null;
    con_firmas: boolean;
    estado: 'VIGENTE' | 'ANULADO';
    motivo_anulacion: string | null;
    fecha_anulacion: string | null;
    nombre_usuario: string | null;
    fecha_creacion: string;
}

export interface AnioArchivo {
    anio: number;
    total: number;
    por_tipo: Partial<Record<TipoFichaGuardada, number>>;
}

export interface FichaGuardada {
    id_ficha: number;
    tipo: TipoFichaGuardada;
    formato: string;
    anio: number | null;
    nombre_archivo: string;
    nombre_usuario: string | null;
    fecha_creacion: string;
    con_firmas?: boolean;
    /** Código y sede del equipo cuando se emitió (cambian con un cambio de sede). */
    codigo_equipo?: string | null;
    sede?: string | null;
}

export default fichasEquipoService;
