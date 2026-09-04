import { useEffect, useState, useCallback, useRef } from 'react';
import {
    Table, Tag, Select, Button, Empty, Spin, message,
    InputNumber, Input, Space, Divider, Tabs, Switch, Badge, Tooltip, Collapse, Timeline, Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
    IconRefresh, IconPlus, IconTrash, IconSend2, IconCircleCheck, IconCircleX,
    IconArrowLeft, IconMessageCircle2, IconWorldUpload, IconPaperclip, IconFileTypePdf, IconX,
    IconClipboardPlus, IconPhoto, IconFileSpreadsheet, IconFileTypeDoc, IconFile, IconDownload,
} from '@tabler/icons-react';
import { facturacionService } from '../services/facturacion.service';
import { useVisorArchivo } from '../utils/useVisorArchivo';
import { useNavStore } from '../../../store/navStore';
import logoAdl from '../../../assets/images/logo_adl.png';
import { catalogosService, type EmpresaServicio, type Centro } from '../../medio-ambiente/services/catalogos.service';
import { analysisService } from '../../medio-ambiente/services/analysis.service';

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', bg: '#ffffff',
    // Colores de marca del PDF (mismos que _drawHeader en facturacion.service.js)
    navy: '#173A5E', orange: '#F4801F', bandaTabla: '#EEF3F7',
};

// Estado unificado de una fila de la bandeja (mezcla el estado de la solicitud
// del cliente con el estado de la cotización que arma el staff — ver
// listarBandejaCotizaciones en el backend, que ya resuelve cuál manda).
const ESTADO_COLOR: Record<string, string> = {
    PENDIENTE: 'gold', BORRADOR: 'default', ENVIADA: 'blue',
    ACEPTADA: 'green', RECHAZADA: 'red', CANCELADA: 'default', EXPIRADA: 'red',
};
const ESTADO_LABEL: Record<string, string> = {
    PENDIENTE: 'Solicitud pendiente', BORRADOR: 'En preparación', ENVIADA: 'Enviada al cliente',
    ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada por el cliente', EXPIRADA: 'Expirada',
};

const CSS = `
.adl-fco-wrap { width:100%; padding:28px 32px 56px; background:#fff; }
.adl-fco-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:26px; flex-wrap:wrap; gap:12px; }
.adl-fco-title { margin:0; font-size:21px; font-weight:650; color:${C.text}; letter-spacing:-.3px; }
.adl-fco-sub { margin:3px 0 0; font-size:13px; color:${C.textTer}; }
.adl-fco-filters { display:flex; align-items:center; gap:16px; margin-bottom:20px; flex-wrap:wrap; }
.adl-fco-sectitle { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:.6px; color:${C.textTer}; margin:0 0 14px; }
.adl-fco-itembuilder { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:18px; }
.adl-fco-field { margin-bottom:20px; }
.adl-fco-field label { display:block; font-size:12.5px; color:${C.textSec}; margin-bottom:7px; }
/* Dos campos por fila: el formulario ahora tiene ancho de sobra */
.adl-fco-form-row { display:grid; grid-template-columns:1fr 1fr; column-gap:16px; }
@media (max-width: 760px) { .adl-fco-form-row { grid-template-columns:1fr; } }
.adl-fco-row-unread td { font-weight:600 !important; }

/* Servicios (glosas) de la cotización: una tarjeta por servicio. El borde de
   color marca cuál está activo — es al que se agregan las líneas nuevas. */
.adl-fco-seccion { border:1px solid ${C.border}; border-radius:9px; padding:14px 14px 10px;
                   margin-bottom:14px; background:#fff; cursor:pointer; transition:border-color .15s, box-shadow .15s; }
.adl-fco-seccion:hover { border-color:${C.primary}; }
.adl-fco-seccion-n { flex-shrink:0; width:22px; height:22px; border-radius:50%; background:${C.navy}; color:#fff;
                     font-size:11.5px; font-weight:700; display:inline-flex; align-items:center; justify-content:center; }

/* Encabezado de detalle / creación — separado por una línea, sin caja */
.adl-fco-detail-header { display:flex; align-items:center; gap:14px; margin-bottom:28px; padding-bottom:20px; border-bottom:1px solid ${C.border}; flex-wrap:wrap; }

.adl-fco-detail-grid { display:grid; grid-template-columns: 1fr 360px; gap:36px; align-items:start; }
/* La hoja se queda en su ancho de página (740px) y el FORMULARIO se lleva el
   espacio sobrante — así no queda una franja muerta al costado. El tope de
   1500px evita que en pantallas muy anchas el formulario se estire de más. */
.adl-fco-crear-grid { display:grid; grid-template-columns: minmax(320px, 1fr) minmax(0, 740px);
                      gap:32px; align-items:start; max-width:1500px; }
@media (max-width: 1150px) {
  .adl-fco-detail-grid, .adl-fco-crear-grid { grid-template-columns: 1fr; gap:28px; }
}

/* Superficies: todo blanco, separadas por borde fino — nada de fondos grises */
.adl-fco-card { border:1px solid ${C.border}; border-radius:10px; background:#fff; padding:24px; margin-bottom:22px; }

/* El panel de comunicación ocupa el alto real de la ventana en vez de una
   caja corta: el chat es lo que más se usa acá y antes quedaba media pantalla
   vacía debajo. 190px ≈ encabezado de página + márgenes. */
.adl-fco-panel { border:1px solid ${C.border}; border-radius:10px; background:#fff; position:sticky; top:20px;
                 overflow:hidden; display:flex; flex-direction:column; height:calc(100vh - 190px); min-height:460px; }
.adl-fco-panel > div:first-child { display:flex; flex-direction:column; height:100%; }
.adl-fco-chat { display:flex; flex-direction:column; height:100%; }
.adl-fco-chatlist { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:10px; }
.adl-fco-bubble { max-width:82%; border-radius:10px; padding:9px 12px; font-size:13px; line-height:1.45; }
/* Vista previa como HOJA de documento: proporción y aire de una página real,
   no una tarjeta de resumen. Los colores y el orden replican el PDF que se
   genera en el backend (Propuesta Técnico Económica). */
/* Hoja con ancho de página (~A4 a escala de pantalla). El max-width evita que
   la tarjeta se estire a todo el ancho disponible, que dejaba una banda blanca
   enorme con el texto apretado al medio. */
.adl-fco-preview { position:sticky; top:20px; max-height:calc(100vh - 150px); overflow-y:auto;
                   width:100%; background:#fff; border:1px solid #e3e3e3; border-radius:6px;
                   box-shadow:0 2px 12px rgba(0,0,0,0.06); padding:38px 46px 44px; }
.adl-fco-doc { color:#000; font-size:11.5px; line-height:1.55; }
.adl-fco-doc h3 { font-size:11.5px; font-weight:700; color:${C.navy}; margin:22px 0 9px; letter-spacing:.2px; }
.adl-fco-doc h4 { font-size:11px; font-weight:700; color:#000; margin:13px 0 5px; }
.adl-fco-doc p { margin:0 0 7px; }
.adl-fco-doc table { width:100%; border-collapse:collapse; font-size:10.5px; }
.adl-fco-doc thead th { background:${C.bandaTabla}; color:${C.navy}; font-weight:700; font-size:10px;
                        text-align:left; padding:7px 8px; }
.adl-fco-doc tbody td { padding:7px 8px; border-bottom:1px solid #eee; vertical-align:top; }
.adl-fco-datos { display:grid; grid-template-columns:112px 1fr; row-gap:3.5px; column-gap:8px; font-size:11px; }
.adl-fco-datos dt { color:${C.navy}; font-weight:700; }
.adl-fco-datos dd { margin:0; }
.adl-fco-preview-empty { text-align:center; color:${C.textTer}; font-size:11px; padding:30px 0;
                         border:1px dashed #e0e0e0; border-radius:6px; }
.adl-fco-tot { display:flex; justify-content:space-between; font-size:11px; padding:2.5px 0; }
.adl-fco-nota { font-size:10px; color:${C.textSec}; line-height:1.5; }
/* Listas legales: sangría colgante como en el documento Word */
.adl-fco-legal { font-size:10px; line-height:1.5; color:#000; margin:0; padding:0; list-style:none; }
.adl-fco-legal li { display:grid; grid-template-columns:16px 1fr; column-gap:4px; margin-bottom:5px; text-align:justify; }
.adl-fco-legal li > span:first-child { font-weight:700; }
.adl-fco-meta { font-size:12px; color:${C.textSec}; line-height:1.65; }
.adl-fco-adjunto { display:flex; align-items:center; gap:10px; padding:9px 11px; border:1px solid ${C.border};
                   border-radius:8px; background:#fff; cursor:pointer; width:100%; text-align:left;
                   font-family:inherit; transition:border-color .12s, background .12s; }
.adl-fco-adjunto:hover { border-color:${C.primary}; background:#f8fbff; }
.adl-fco-adjunto-ico { display:flex; align-items:center; justify-content:center; width:34px; height:34px;
                       border-radius:7px; flex-shrink:0; }
.adl-fco-adjunto-nom { display:block; font-size:14px; font-weight:500; color:${C.text};
                       overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.adl-fco-adjunto-meta { display:block; font-size:11.5px; color:${C.textTer}; margin-top:1px; }

/* Las pestañas del panel no deben scrollear ellas mismas: scrollea la lista */
.adl-fco-panel .ant-tabs { height:100%; display:flex; flex-direction:column; }
.adl-fco-panel .ant-tabs-content-holder { flex:1; overflow:hidden; }
.adl-fco-panel .ant-tabs-content, .adl-fco-panel .ant-tabs-tabpane { height:100%; }
`;

const fmtClp = (n: number) => Number(n || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });
const fmtUf = (n: number) => Number(n || 0).toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (v: string | null) => v ? new Date(v).toLocaleDateString('es-CL') : '—';
const fmtFechaHora = (v: string | null) => v ? new Date(v).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtTamano = (b: number) => !b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

// Tipo de archivo por mime o extensión, con el mismo código de colores que usa
// ADL WEB GO — así un PDF se ve igual en los dos sistemas.
const tipoArchivo = (nombre = '', mime = '') => {
    const m = (mime || '').toLowerCase();
    const n = (nombre || '').toLowerCase();
    if (m.includes('pdf') || n.endsWith('.pdf')) return { Icono: IconFileTypePdf, color: '#c93a3a', fondo: '#fdf0f0', etiqueta: 'PDF' };
    if (m.includes('image') || /\.(jpe?g|png|gif|webp)$/.test(n)) return { Icono: IconPhoto, color: '#9333ea', fondo: '#f3eafd', etiqueta: 'Imagen' };
    if (m.includes('spreadsheet') || m.includes('ms-excel') || /\.(xlsx?|csv)$/.test(n)) return { Icono: IconFileSpreadsheet, color: '#16a34a', fondo: '#eafaf0', etiqueta: 'Excel' };
    if (m.includes('word') || /\.(docx?)$/.test(n)) return { Icono: IconFileTypeDoc, color: '#2563eb', fondo: '#eaf1fd', etiqueta: 'Word' };
    return { Icono: IconFile, color: '#615d59', fondo: '#f1f1f1', etiqueta: 'Archivo' };
};

// Textos legales de la Propuesta Técnico Económica — copiados literales del
// documento Word que usa Medio Ambiente. Deben coincidir con las constantes
// del backend (ANTECEDENTES_GENERALES / NOTAS_IMPORTANTES en
// facturacion.service.js), que son las que terminan en el PDF.
const ANTECEDENTES_GENERALES = [
    'Todos los informes serán entregados dentro de 10 a 15 días hábiles de recepcionada la muestra en laboratorio de análisis.',
    'La emisión de informes se realizará en forma electrónica.',
    'Laboratorio de análisis cuenta con acreditación INN bajo la Norma Chilena ISO 17025 Of. 2017.',
    'Los muestreos normativos serán subcontratados al laboratorio Hidrolab S.A. (Código ETFA 003-01) y/o laboratorio Análisis Ambientales S.A. (Código ETFA 011-01 y 011-02). Estos laboratorios cuentan con la autorización por parte de la Superintendencia del Medio Ambiente (SMA) como Entidad Técnica de Fiscalización Ambiental (ETFA) para la ejecución de dichos muestreos y sus correspondientes mediciones.',
    'Análisis son analizados por Laboratorio ETFA, autorizado por la Superintendencia del Medio Ambiente (SMA).',
];

const NOTAS_IMPORTANTES = [
    'Soc. ADL Diagnostic Chile SpA., aplica en el cobro de todos sus servicios una facturación mínima neta de 2,5 UF mensual, por lo que si el monto global no alcanza a este valor se cobrará el monto mínimo indicado.',
    'El tiempo de respuesta contará desde la recepción de la muestra en el laboratorio de análisis hasta que se entregue el informe final al cliente.',
    'El Informe solo contendrá resultados de análisis.',
    'Si la cotización es aceptada, debe indicar por escrito el número de esta al solicitar el servicio.',
    'El atraso del pago en más de 60 días de emitida la factura, facultará a Soc. ADL Diagnostic Chile SpA., a retener indefinidamente y hasta el pago total de lo adeudado, la entrega del respectivo informe de resultados.',
    'Para los servicios realizados en zonas lejanas, propuesta indicará claramente la cantidad de días involucrados en la realización del servicio; si por razones externas a Soc. ADL Diagnostic Chile SpA., sean estas condiciones climáticas, cierre de puertos u otras que hagan extender el servicio, se cobrará un valor adicional diario de 5 UF.',
    'En aquellos casos que el servicio sea suspendido por parte del mandante en el lugar de ejecución de éste por razones de operatividad del establecimiento industrial se cobrará 3,0 UF por concepto de visita, 0,01 UF por kilómetro recorrido, peajes y transbordador si correspondiere.',
    'En actividades de muestreo realizadas en zonas lejanas que impliquen viajes en avión, avioneta y/o embarcaciones, los costos de traslado, alojamiento y alimentación son de cargo del mandante durante el o los días que dure la actividad de muestreo.',
    'El mandante debe velar por las condiciones mínimas de seguridad para que la actividad se desarrolle sin problemas, independiente de las medidas que entregue ADL a sus trabajadores.',
    'Si la propuesta es aceptada, se deben establecer claramente las contrapartes asociadas a la actividad.',
    'Soc. ADL Diagnostic Chile SpA., se compromete a mantener la confidencialidad respecto de toda la información obtenida o creada durante la realización de actividades de inspección, excepto la información que el cliente pone a disposición del público o lo acuerda previamente con ADL.',
    'Cuando ADL deba revelar información confidencial, ya sea requerido por ley o autorizado por las disposiciones contractuales, se debe notificar al cliente o persona interesada, la información proporcionada, salvo que esté prohibido por ley.',
    'Toda información obtenida del cliente por terceros, será confidencial entre el cliente y ADL. La fuente de información también debe mantenerse como confidencial por parte de ADL y no puede compartirse con el cliente, a menos que se haya acordado con la fuente.',
    'ADL debe informar al cliente con antelación acerca de la información que pretende poner al alcance del público.',
];

// Mismos formatos que usa el PDF: código MA-P{n}-DDMMYYYY-CLIENTE y fecha larga.
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const fmtDdmmyyyy = (d: Date) => `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`;
const fmtFechaLarga = (d: Date) => `${String(d.getDate()).padStart(2, '0')} de ${MESES_LARGO[d.getMonth()]} de ${d.getFullYear()}`;

interface BandejaRow {
    origen: 'PORTAL' | 'MANUAL';
    id_solicitud_portal: number | null;
    id_cotizacion: number | null;
    numero_cotizacion: number | null;
    referencia_externa: string | null;
    id_empresaservicio: number | null;
    nombre_cliente_portal: string | null;
    nombre_empresaservicios: string | null;
    nombre_cliente: string;
    titulo: string | null;
    estado_cotizacion: string | null;
    estado_portal: string | null;
    estado_unificado: string;
    estado_label: string;
    tiene_mensaje_nuevo: 0 | 1;
    ultimo_mensaje_texto: string | null;
    ultimo_mensaje_autor: string | null;
    ultimo_mensaje_fecha: string | null;
    total_uf: number | null;
    total_clp: number | null;
    fecha_creacion: string;
    fecha_actualizacion: string;
}

interface ItemBuilder {
    key: number;
    // Nulos en una línea libre ("Gastos de Traslado", "Manejo Muestras"): no
    // están en el catálogo de análisis y su precio se pone a mano.
    idTecnica: number | null;
    // Identidad completa del análisis: se guarda en la cotización para poder
    // convertirla en ficha después sin volver a elegir cada análisis.
    idNormativa: number | null;
    idNormativaReferencia: number | null;
    idReferenciaAnalisis: number | null;
    nombre_tecnica: string;
    cantidad: number;
    precioUf: number | null;
    precioManual?: boolean;
    resolviendo?: boolean;
}

// Una propuesta real trae varios servicios, cada uno con su título y su tabla
// (ver el Word de Medio Ambiente, que tiene dos).
interface SeccionBuilder {
    key: number;
    titulo: string;
    items: ItemBuilder[];
}

const FacturacionCotizaciones: React.FC = () => {
    const { setActiveSubmodule, setFichasMode, setCotizacionParaFicha } = useNavStore();
    const { abrirArchivo, Visores } = useVisorArchivo();

    // --- Bandeja unificada ---
    const [bandeja, setBandeja] = useState<BandejaRow[]>([]);
    const [bandejaLoading, setBandejaLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState<string | undefined>(undefined);
    const [filtroNoLeidos, setFiltroNoLeidos] = useState(false);

    // --- Vista: lista | detalle | crear ---
    const [seleccion, setSeleccion] = useState<BandejaRow | null>(null);
    const [solicitudDetalle, setSolicitudDetalle] = useState<any>(null);
    const [cotizacionDetalle, setCotizacionDetalle] = useState<any>(null);
    const [precioGuardando, setPrecioGuardando] = useState<number | null>(null);
    const [detalleLoading, setDetalleLoading] = useState(false);
    const [rightTab, setRightTab] = useState('mensajes');
    const [accionLoading, setAccionLoading] = useState<string | null>(null);
    const [publicando, setPublicando] = useState(false);

    // --- Chat (siempre por id_solicitud_portal — misma conversación exista o no la cotización) ---
    const [mensajes, setMensajes] = useState<any[]>([]);
    const [mensajesLoading, setMensajesLoading] = useState(false);
    const [mensajeNuevo, setMensajeNuevo] = useState('');
    const [enviandoMensaje, setEnviandoMensaje] = useState(false);
    const [archivosAdjuntar, setArchivosAdjuntar] = useState<File[]>([]);
    const [adjuntos, setAdjuntos] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const finChatRef = useRef<HTMLDivElement>(null);

    // PDFs e imágenes se abren en el visor de la app; el resto se descarga.
    // Todo pasa por fetch autenticado: estos endpoints van con Bearer token y
    // un <a href> plano daría 401.
    const bajarAdjunto = (idSolicitudPortal: number, adj: any) =>
        abrirArchivo(
            facturacionService.urlAdjuntoSolicitudPortal(idSolicitudPortal, adj.id),
            adj.nombre_original || 'archivo',
            adj.mime || '');

    // --- Vista "crear cotización" (formulario + vista previa en vivo) ---
    // Sin antd Form acá a propósito: son campos controlados 1:1 con estado de
    // React, sin capa de sincronización de por medio — así la vista previa
    // (que lee este mismo estado) queda garantizada en vivo.
    const [creando, setCreando] = useState(false);
    const [creacionOrigen, setCreacionOrigen] = useState<'lista' | 'detalle'>('lista');
    const [empresas, setEmpresas] = useState<EmpresaServicio[]>([]);
    const [centros, setCentros] = useState<Centro[]>([]);
    const [idEmpresaServicioSel, setIdEmpresaServicioSel] = useState<number | undefined>();
    const [idCentroSel, setIdCentroSel] = useState<number | undefined>();
    const [nombreClienteSel, setNombreClienteSel] = useState<string | undefined>();
    // Tabla MA: sin ella el motor de precios no calza ninguna tarifa, porque
    // todas están amarradas a (cliente, empresa, centro, tabla). Se ofrecen
    // solo las que tienen tarifa para el cliente+centro elegidos.
    const [tablas, setTablas] = useState<any[]>([]);
    const [idTablamaSel, setIdTablamaSel] = useState<number | undefined>();
    // Datos reales del cliente (RUT, dirección, giro) para que la vista previa
    // sea el documento de verdad y no solo un nombre — viene de fac_cliente_config
    // con fallback a mae_empresaservicios (ver getClienteConfig en el backend).
    const [clienteConfig, setClienteConfig] = useState<any>(null);
    const [normativas, setNormativas] = useState<any[]>([]);
    const [referencias, setReferencias] = useState<any[]>([]);
    const [tecnicasDisponibles, setTecnicasDisponibles] = useState<any[]>([]);
    const [normativaSel, setNormativaSel] = useState<string | undefined>();
    const [referenciaSel, setReferenciaSel] = useState<string | undefined>();
    const [tecnicaSel, setTecnicaSel] = useState<string | undefined>();
    const [cantidadSel, setCantidadSel] = useState<number>(1);
    const [secciones, setSecciones] = useState<SeccionBuilder[]>([{ key: 1, titulo: '', items: [] }]);
    const [seccionActiva, setSeccionActiva] = useState<number>(1);
    const [glosaSel, setGlosaSel] = useState('');
    const [observacionesSel, setObservacionesSel] = useState('');
    const [vigenciaDiasSel, setVigenciaDiasSel] = useState(30);
    const [valorUfHoy, setValorUfHoy] = useState<number | null>(null);
    const [guardandoCotizacion, setGuardandoCotizacion] = useState(false);

    const cargarBandeja = useCallback(async () => {
        setBandejaLoading(true);
        try {
            const r = await facturacionService.listarBandejaCotizaciones({
                estado: filtroEstado, soloNoLeidos: filtroNoLeidos || undefined,
            });
            setBandeja(r || []);
        } catch {
            message.error('No se pudo cargar la bandeja');
        } finally {
            setBandejaLoading(false);
        }
    }, [filtroEstado, filtroNoLeidos]);

    useEffect(() => { cargarBandeja(); }, [cargarBandeja]);

    // ------------------------------------------------------------------
    // Detalle
    // ------------------------------------------------------------------

    // `silencioso` es para el refresco automático: sin él, cada ciclo mostraba
    // el spinner y hacía parpadear la conversación entera.
    const cargarChat = useCallback(async (idSolicitudPortal: number, silencioso = false) => {
        if (!silencioso) setMensajesLoading(true);
        try {
            const [msgs, adj] = await Promise.all([
                facturacionService.listarMensajesSolicitudPortal(idSolicitudPortal),
                facturacionService.listarAdjuntosSolicitudPortal(idSolicitudPortal).catch(() => []),
            ]);
            setMensajes(msgs);
            setAdjuntos(adj || []);
        } catch {
            if (!silencioso) message.error('No se pudo cargar el chat con el cliente');
        } finally {
            if (!silencioso) setMensajesLoading(false);
        }
    }, []);

// Chat en vivo: el hilo vive en ADL WEB GO, así que no hay socket que
    // escuchar desde acá — se relee cada 8 segundos, el mismo intervalo que
    // usa el portal. Antes había que salir de la cotización y volver a entrar
    // para ver un mensaje nuevo.
    useEffect(() => {
        const id = seleccion?.id_solicitud_portal;
        if (!id) return;
        const t = setInterval(() => cargarChat(id, true), 8000);
        return () => clearInterval(t);
    }, [seleccion?.id_solicitud_portal, cargarChat]);

    // Al llegar mensajes nuevos con el detalle abierto: bajar la conversación y
    // marcarlos como vistos, para que el badge de la bandeja no se encienda por
    // algo que la persona está leyendo en pantalla.
    useEffect(() => {
        finChatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        const id = seleccion?.id_solicitud_portal;
        if (id && mensajes.length > 0) {
            facturacionService.marcarVistaStaffPortal(id).catch(() => {});
        }
    }, [mensajes.length, seleccion?.id_solicitud_portal]);

    const abrirDetalle = async (row: BandejaRow) => {
        setSeleccion(row);
        setSolicitudDetalle(null);
        setCotizacionDetalle(null);
        setMensajes([]);
        setRightTab(row.origen === 'PORTAL' ? 'mensajes' : 'historial');
        setDetalleLoading(true);
        try {
            if (row.origen === 'PORTAL' && row.id_solicitud_portal) {
                const sol = await facturacionService.getSolicitudPortal(row.id_solicitud_portal);
                setSolicitudDetalle(sol);
                facturacionService.marcarVistaStaffPortal(row.id_solicitud_portal).catch(() => {});
                setBandeja((prev) => prev.map((r) => r.id_solicitud_portal === row.id_solicitud_portal ? { ...r, tiene_mensaje_nuevo: 0 } : r));
                cargarChat(row.id_solicitud_portal);
            }
            if (row.id_cotizacion) {
                setCotizacionDetalle(await facturacionService.getCotizacionDetalle(row.id_cotizacion));
            }
        } catch {
            message.error('No se pudo cargar el detalle');
        } finally {
            setDetalleLoading(false);
        }
    };

    const volverALista = () => {
        setSeleccion(null);
        setSolicitudDetalle(null);
        setCotizacionDetalle(null);
        setMensajes([]);
        cargarBandeja();
    };

    const enviarMensaje = async () => {
        if (!seleccion?.id_solicitud_portal) return;
        if (!mensajeNuevo.trim() && archivosAdjuntar.length === 0) return;
        setEnviandoMensaje(true);
        try {
            await facturacionService.enviarMensajeSolicitudPortal(
                seleccion.id_solicitud_portal, mensajeNuevo.trim(), archivosAdjuntar);
            setMensajeNuevo('');
            setArchivosAdjuntar([]);
            await cargarChat(seleccion.id_solicitud_portal);
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo enviar el mensaje');
        } finally {
            setEnviandoMensaje(false);
        }
    };

    const cambiarEstado = async (nuevoEstado: string) => {
        if (!cotizacionDetalle) return;
        setAccionLoading(nuevoEstado);
        try {
            await facturacionService.cambiarEstadoCotizacion(cotizacionDetalle.id_cotizacion, nuevoEstado);
            message.success('Estado actualizado');
            setCotizacionDetalle(await facturacionService.getCotizacionDetalle(cotizacionDetalle.id_cotizacion));
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo actualizar el estado');
        } finally {
            setAccionLoading(null);
        }
    };

    // Lleva al formulario de ficha con la cotización cargada. No crea la ficha
    // sola: una ficha necesita objetivo, punto de muestreo, frecuencia e
    // inspector, que la cotización no sabe — inventarlos sería peor que pedirlos.
    const crearFichaDesdeCotizacion = async () => {
        if (!cotizacionDetalle) return;
        setAccionLoading('FICHA');
        try {
            const prep = await facturacionService.getCotizacionParaFicha(cotizacionDetalle.id_cotizacion);
            if (prep.avisos?.length) {
                message.warning(`${prep.avisos.length} análisis de esta cotización hay que agregarlos a mano (se cotizaron antes de que se guardara su normativa).`);
            }
            setCotizacionParaFicha(cotizacionDetalle.id_cotizacion);
            // 'ma-fichas-ingreso' se resuelve como submódulo compartido de alta
            // prioridad en DashboardPage, sin importar el módulo activo.
            setFichasMode('create_manual');
            setActiveSubmodule('ma-fichas-ingreso');
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo preparar la ficha');
        } finally {
            setAccionLoading(null);
        }
    };

    // Precio a mano sobre una cotización ya creada: la salida para los análisis
    // que el convenio del cliente no cubre y para las líneas fuera de catálogo.
    const guardarPrecioItem = async (item: any, valorCrudo: string) => {
        const limpio = String(valorCrudo ?? '').replace(',', '.').trim();
        if (limpio === '') return;
        const nuevo = Number(limpio);
        if (!Number.isFinite(nuevo) || nuevo < 0) { message.warning('El precio debe ser un número mayor o igual a 0'); return; }
        if (item.precio_unitario_uf != null && Number(item.precio_unitario_uf) === nuevo) return;
        setPrecioGuardando(item.id_item);
        try {
            const actualizado = await facturacionService.actualizarPrecioItemCotizacion(
                cotizacionDetalle.id_cotizacion, item.id_item, nuevo,
            );
            setCotizacionDetalle(actualizado);
            message.success('Precio actualizado');
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo actualizar el precio');
        } finally {
            setPrecioGuardando(null);
        }
    };

    const enviarCotizacionAlCliente = async () => {
        if (!cotizacionDetalle) return;
        setPublicando(true);
        try {
            await facturacionService.publicarCotizacionEnPortal(cotizacionDetalle.id_cotizacion);
            message.success('Cotización enviada al cliente');
            setCotizacionDetalle(await facturacionService.getCotizacionDetalle(cotizacionDetalle.id_cotizacion));
        } catch (e: any) {
            message.error(e?.response?.data?.message || 'No se pudo enviar la cotización');
        } finally {
            setPublicando(false);
        }
    };

    // ------------------------------------------------------------------
    // Vista "crear cotización" (formulario + vista previa en vivo)
    // ------------------------------------------------------------------

    const abrirCreacion = async (prefillDesdeSolicitud?: any) => {
        setCreacionOrigen(seleccion ? 'detalle' : 'lista');
        setCreando(true);
        setSecciones([{ key: 1, titulo: '', items: [] }]);
        setSeccionActiva(1);
        setIdEmpresaServicioSel(undefined);
        setIdCentroSel(undefined);
        setIdTablamaSel(undefined);
        setTablas([]);
        setNombreClienteSel(undefined);
        setClienteConfig(null);
        setCentros([]);
        setNormativaSel(undefined); setReferenciaSel(undefined); setTecnicaSel(undefined); setCantidadSel(1);
        setGlosaSel(''); setObservacionesSel(''); setVigenciaDiasSel(30);
        let empresasActuales = empresas;
        if (empresasActuales.length === 0) {
            try {
                const raw: any[] = await catalogosService.getEmpresasServicio();
                empresasActuales = raw.map((e) => ({ id: e.id_empresaservicio, nombre: e.nombre_empresaservicios }));
                setEmpresas(empresasActuales);
            } catch { /* noop */ }
        }
        if (normativas.length === 0) {
            try { setNormativas(await analysisService.getNormativas()); } catch { /* noop */ }
        }
        if (valorUfHoy === null) {
            try {
                const hist = await facturacionService.listarUfHistorial(1);
                if (hist?.[0]?.valor) setValorUfHoy(Number(hist[0].valor));
            } catch { /* noop */ }
        }
        if (prefillDesdeSolicitud) {
            setGlosaSel(prefillDesdeSolicitud.titulo || '');
            setObservacionesSel(prefillDesdeSolicitud.descripcion || '');
            // La primera sección hereda el título de la solicitud: casi siempre
            // es el nombre del servicio pedido ("Monitoreo RCA", "Hidrolab"…).
            if (prefillDesdeSolicitud.titulo) {
                setSecciones([{ key: 1, titulo: String(prefillDesdeSolicitud.titulo), items: [] }]);
            }
            if (prefillDesdeSolicitud.id_empresaservicio) {
                await onEmpresaChange(prefillDesdeSolicitud.id_empresaservicio, empresasActuales);
            }
        }
    };

    const cerrarCreacion = () => {
        setCreando(false);
        if (creacionOrigen === 'lista') cargarBandeja();
    };

    // `listaEmpresas` opcional: cuando se llama justo después de recién cargar el
    // catálogo (ver abrirCreacion), el estado `empresas` todavía no se actualizó
    // en este render — se pasa la lista recién obtenida para no perder el nombre.
    // Al cambiar el centro cambian las tablas con tarifa: se recargan y se
    // limpia la selección anterior para no cotizar contra una tabla que ya no
    // aplica a ese centro.
    const onCentroChange = async (val?: number) => {
        setIdCentroSel(val);
        setIdTablamaSel(undefined);
        setTablas([]);
        if (!val || !idEmpresaServicioSel) return;
        try {
            const t = await facturacionService.listarTablasDeConvenio(idEmpresaServicioSel, val);
            setTablas(t || []);
            if (t?.length === 1) setIdTablamaSel(Number(t[0].id_tablama));
        } catch {
            message.error('No se pudieron cargar las tablas con tarifa de este centro');
        }
    };

    const onEmpresaChange = async (val: number, listaEmpresas?: EmpresaServicio[]) => {
        setIdEmpresaServicioSel(val);
        setNombreClienteSel((listaEmpresas || empresas).find((e) => e.id === val)?.nombre);
        setIdCentroSel(undefined);
        setIdTablamaSel(undefined);
        setTablas([]);
        setCentros([]);
        setClienteConfig(null);
        try {
            const raw: any[] = await catalogosService.getCentros(undefined, val);
            setCentros(raw.map((c) => ({ id: c.id_centro, nombre: (c.nombre_centro || '').trim() })));
        } catch {
            message.error('No se pudieron cargar los centros de este cliente');
        }
        try {
            setClienteConfig(await facturacionService.getClienteConfig(val));
        } catch { /* el documento se muestra igual, solo sin RUT/dirección */ }
    };

    const onNormativaChange = async (val: string) => {
        setNormativaSel(val);
        setReferenciaSel(undefined); setTecnicaSel(undefined);
        setReferencias([]); setTecnicasDisponibles([]);
        try { setReferencias(await analysisService.getReferenciasByNormativa(val)); } catch { /* noop */ }
    };

    const onReferenciaChange = async (val: string) => {
        setReferenciaSel(val);
        setTecnicaSel(undefined);
        setTecnicasDisponibles([]);
        if (!normativaSel) return;
        try { setTecnicasDisponibles(await analysisService.getAnalysisByNormativaReferencia(normativaSel, val)); } catch { /* noop */ }
    };

    const agregarItem = async () => {
        if (!idEmpresaServicioSel) { message.warning('Selecciona el cliente primero — el precio depende de él.'); return; }
        if (!idCentroSel) { message.warning('Selecciona el centro: el precio del mismo análisis cambia según el centro.'); return; }
        // La tabla solo se exige cuando el centro TIENE convenio. Si no hay
        // ninguna tarifa cargada (pasa en la mayoría de los clientes), exigirla
        // dejaría al cliente sin poder cotizarse: se permite seguir y los ítems
        // quedan marcados "Sin tarifa" para ponerles precio a mano.
        if (tablas.length > 0 && !idTablamaSel) {
            message.warning('Selecciona la tabla: sin ella no se puede resolver la tarifa del convenio.');
            return;
        }
        if (!tecnicaSel) { message.warning('Selecciona una técnica'); return; }
        const opt = tecnicasDisponibles.find((t) => String(t.id_referenciaanalisis) === tecnicaSel);
        if (!opt) return;
        const key = Date.now();
        const cantidad = cantidadSel || 1;
        const idSec = seccionActiva;
        parchearItem(idSec, null, {
            key,
            idTecnica: opt.id_tecnica,
            idNormativa: opt.id_normativa,
            idNormativaReferencia: opt.id_normativareferencia,
            idReferenciaAnalisis: opt.id_referenciaanalisis,
            nombre_tecnica: (opt.nombre_tecnica || '').trim(),
            cantidad,
            precioUf: null,
            resolviendo: true,
        });
        setTecnicaSel(undefined);
        setCantidadSel(1);
        try {
            // Contexto completo: sin centro y tabla el motor no calza ninguna
            // tarifa. La empresa la deriva el backend a partir del centro.
            const precio = await facturacionService.resolverPrecio({
                idTecnica: opt.id_tecnica,
                idEmpresaServicio: idEmpresaServicioSel,
                idCentro: idCentroSel,
                idTablama: idTablamaSel,
            });
            parchearItem(idSec, key, { precioUf: precio?.precioUf ?? null, resolviendo: false });
        } catch {
            parchearItem(idSec, key, { precioUf: null, resolviendo: false });
        }
    };

    // Agrega (si `key` es null) o modifica un ítem dentro de una sección.
    const parchearItem = (keySeccion: number, key: number | null, datos: any) => {
        setSecciones((prev) => prev.map((s) => {
            if (s.key !== keySeccion) return s;
            if (key === null) return { ...s, items: [...s.items, datos] };
            return { ...s, items: s.items.map((i) => (i.key === key ? { ...i, ...datos } : i)) };
        }));
    };

    const quitarItem = (keySeccion: number, key: number) =>
        setSecciones((prev) => prev.map((s) => (s.key === keySeccion ? { ...s, items: s.items.filter((i) => i.key !== key) } : s)));

    // Línea que no es un análisis del catálogo: "Gastos de Traslado", "Manejo
    // Muestras", "Derivación Muestras". Nace con precio 0 puesto a mano.
    const agregarLineaLibre = (keySeccion: number) => {
        parchearItem(keySeccion, null, {
            key: Date.now(),
            idTecnica: null, idNormativa: null, idNormativaReferencia: null, idReferenciaAnalisis: null,
            nombre_tecnica: '', cantidad: 1, precioUf: 0, precioManual: true,
        });
    };

    const agregarSeccion = () =>
        setSecciones((prev) => {
            const nueva = { key: Date.now(), titulo: '', items: [] };
            setSeccionActiva(nueva.key);
            return [...prev, nueva];
        });

    const quitarSeccion = (keySeccion: number) =>
        setSecciones((prev) => {
            const quedan = prev.filter((s) => s.key !== keySeccion);
            if (seccionActiva === keySeccion && quedan.length) setSeccionActiva(quedan[0].key);
            return quedan;
        });

    const items = secciones.flatMap((s) => s.items);
    const nombreCentroSel = centros.find((c) => c.id === idCentroSel)?.nombre;
    const subtotalUf = items.reduce((s, it) => s + (it.precioUf || 0) * it.cantidad, 0);
    const netoClp = valorUfHoy ? Math.round(subtotalUf * valorUfHoy) : 0;
    const ivaClp = Math.round(netoClp * 0.19);
    const totalClp = netoClp + ivaClp;
    const fechaVigenciaPreview = new Date(Date.now() + vigenciaDiasSel * 86400000);
    // Cuántos bloques numerados ocupan los servicios: los bloques fijos
    // (antecedentes, condiciones) van justo después. Mínimo 1 aunque no haya
    // ítems todavía, para que la hoja vacía muestre "1. …", "2. …", "3. …".
    const nFijoPreview = Math.max(1, secciones.filter((s) => s.items.length > 0).length);

    const guardarCotizacion = async () => {
        if (!idEmpresaServicioSel) { message.warning('Selecciona un cliente'); return; }
        if (items.length === 0) { message.warning('Agrega al menos un ítem'); return; }
        try {
            setGuardandoCotizacion(true);
            const r = await facturacionService.crearCotizacion({
                idEmpresaServicio: idEmpresaServicioSel,
                idCentro: idCentroSel,
                idTablama: idTablamaSel,
                secciones: secciones
                    .filter((s) => s.items.length > 0)
                    .map((s, i) => ({
                        titulo: s.titulo?.trim() || glosaSel?.trim() || `Servicio ${i + 1}`,
                        items: s.items.map((it) => ({
                            idTecnica: it.idTecnica,
                            idNormativa: it.idNormativa,
                            idNormativaReferencia: it.idNormativaReferencia,
                            idReferenciaAnalisis: it.idReferenciaAnalisis,
                            descripcion: it.nombre_tecnica,
                            cantidad: it.cantidad,
                            precioUf: it.precioUf,
                            precioManual: it.precioManual,
                        })),
                    })),
                glosa: glosaSel || undefined,
                observaciones: observacionesSel || undefined,
                vigenciaDias: vigenciaDiasSel || 30,
            });
            if (r.items_sin_precio?.length) {
                message.warning(`Cotización N° ${r.numero_cotizacion} creada, pero ${r.items_sin_precio.length} ítem(s) quedaron sin tarifa. Ponles precio en el detalle antes de enviarla al cliente.`, 6);
            } else {
                message.success(`Cotización N° ${r.numero_cotizacion} creada`);
            }
            if (seleccion?.origen === 'PORTAL' && seleccion.id_solicitud_portal && !seleccion.id_cotizacion) {
                try {
                    await facturacionService.vincularCotizacionAPortal(r.id_cotizacion, seleccion.id_solicitud_portal);
                } catch (e: any) {
                    message.warning('La cotización se creó, pero no se pudo vincular a la solicitud: ' + (e?.response?.data?.message || ''));
                }
            }
            setCreando(false);
            if (seleccion) {
                await abrirDetalle(seleccion);
            } else {
                await cargarBandeja();
            }
        } catch (e: any) {
            if (e?.errorFields) return;
            message.error(e?.response?.data?.message || 'No se pudo crear la cotización');
        } finally {
            setGuardandoCotizacion(false);
        }
    };

    // ------------------------------------------------------------------
    // Tabla de la bandeja
    // ------------------------------------------------------------------

    const columns: ColumnsType<BandejaRow> = [
        {
            title: '', dataIndex: 'tiene_mensaje_nuevo', width: 8,
            render: (v) => v ? <Badge status="processing" /> : null,
        },
        { title: 'Cliente', dataIndex: 'nombre_cliente', ellipsis: true },
        { title: 'Título / Glosa', dataIndex: 'titulo', ellipsis: true, render: (v) => v || <span style={{ color: C.textTer }}>—</span> },
        {
            title: 'Estado', dataIndex: 'estado_label', width: 170,
            render: (v, r) => <Tag color={ESTADO_COLOR[r.estado_unificado] || 'default'}>{v}</Tag>,
        },
        {
            title: 'Último mensaje', dataIndex: 'ultimo_mensaje_texto', ellipsis: true,
            render: (v, r) => v ? (
                <span>
                    <span style={{ color: C.textTer, fontSize: 11.5 }}>{r.ultimo_mensaje_autor === 'ADL_ONE' ? 'Tú: ' : 'Cliente: '}</span>
                    {v}
                </span>
            ) : <span style={{ color: C.textTer }}>—</span>,
        },
        {
            title: 'Total', dataIndex: 'total_uf', width: 130, align: 'right',
            render: (v, r) => v ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUf(v)} UF<br /><span style={{ fontSize: 11, color: C.textTer }}>$ {fmtClp(r.total_clp || 0)}</span></span> : <span style={{ color: C.textTer }}>—</span>,
        },
        { title: 'Actualizada', dataIndex: 'fecha_actualizacion', width: 150, render: fmtFechaHora },
    ];

    // ------------------------------------------------------------------
    // Vista: CREAR (formulario + vista previa en vivo)
    // ------------------------------------------------------------------

    if (creando) {
        return (
            <div className="adl-fco-wrap">
                <style>{CSS}</style>
                <div className="adl-fco-detail-header">
                    <Button icon={<IconArrowLeft size={16} />} onClick={cerrarCreacion}>Cancelar</Button>
                    <div style={{ flex: 1 }}>
                        <h2 className="adl-fco-title" style={{ fontSize: 19 }}>Armar cotización</h2>
                    </div>
                    <Button type="primary" loading={guardandoCotizacion} onClick={guardarCotizacion}>Crear cotización</Button>
                </div>

                <div className="adl-fco-crear-grid">
                    {/* Formulario */}
                    <div className="adl-fco-card">
                        <div>
                            <div className="adl-fco-form-row">
                                <div className="adl-fco-field">
                                    <label>Cliente *</label>
                                    <Select
                                        showSearch
                                        disabled={items.length > 0}
                                        placeholder="Selecciona un cliente"
                                        optionFilterProp="label"
                                        style={{ width: '100%' }}
                                        value={idEmpresaServicioSel}
                                        options={empresas.map((e) => ({ value: e.id, label: e.nombre }))}
                                        onChange={(val) => onEmpresaChange(val)}
                                    />
                                    {items.length > 0 && <p style={{ fontSize: 11.5, color: C.textTer, margin: '6px 0 0' }}>Quita los ítems para cambiar de cliente.</p>}
                                </div>
                                <div className="adl-fco-field">
                                    <label>Centro *</label>
                                    <Select
                                        allowClear
                                        showSearch
                                        disabled={!idEmpresaServicioSel || items.length > 0}
                                        placeholder={idEmpresaServicioSel ? 'Selecciona un centro' : 'Elige un cliente primero'}
                                        optionFilterProp="label"
                                        style={{ width: '100%' }}
                                        value={idCentroSel}
                                        options={centros.map((c) => ({ value: c.id, label: c.nombre }))}
                                        onChange={onCentroChange}
                                    />
                                </div>
                            </div>
                            <div className="adl-fco-field">
                                <label>Tabla {tablas.length > 0 ? '*' : '(este centro no tiene convenio)'}</label>
                                <Select
                                    showSearch
                                    disabled={!idCentroSel || tablas.length === 0 || items.length > 0}
                                    placeholder={idCentroSel ? (tablas.length ? 'Selecciona la tabla del convenio' : 'Este centro no tiene tarifas cargadas') : 'Elige un centro primero'}
                                    optionFilterProp="label"
                                    style={{ width: '100%' }}
                                    value={idTablamaSel}
                                    options={tablas.map((t: any) => ({
                                        value: Number(t.id_tablama),
                                        label: `${t.nombre_tablama || `Tabla ${t.id_tablama}`} · ${t.tarifas} tarifas`,
                                    }))}
                                    onChange={setIdTablamaSel}
                                />
                                <p style={{ fontSize: 11.5, color: C.textTer, margin: '6px 0 0' }}>
                                    El precio del mismo análisis cambia según el centro y la tabla del convenio.
                                    {idCentroSel && tablas.length === 0 && ' Este centro no tiene convenio cargado: los ítems saldrán sin tarifa.'}
                                </p>
                            </div>
                            <div className="adl-fco-form-row">
                                <div className="adl-fco-field">
                                    <label>Título / Glosa</label>
                                    <Input placeholder="Ej: Monitoreo trimestral" value={glosaSel} onChange={(e) => setGlosaSel(e.target.value)} />
                                </div>
                                <div className="adl-fco-field">
                                    <label>Vigencia (días)</label>
                                    <InputNumber min={1} style={{ width: '100%' }} value={vigenciaDiasSel} onChange={(v) => setVigenciaDiasSel(Number(v) || 30)} />
                                </div>
                            </div>
                            <div className="adl-fco-field">
                                <label>Notas para el cliente</label>
                                <Input.TextArea rows={2} placeholder="Opcional" value={observacionesSel} onChange={(e) => setObservacionesSel(e.target.value)} />
                            </div>

                            <Divider style={{ margin: '4px 0 14px' }} />
                            <p className="adl-fco-sectitle">Agregar ítems</p>
                            {(!idEmpresaServicioSel || !idCentroSel) ? (
                                <Alert
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 12 }}
                                    message="Completa cliente y centro antes de agregar ítems"
                                    description="Las tarifas del convenio están definidas por esa combinación: sin ellas el precio no se puede resolver."
                                />
                            ) : tablas.length === 0 ? (
                                <Alert
                                    type="info"
                                    showIcon
                                    style={{ marginBottom: 12 }}
                                    message="Este centro no tiene convenio cargado"
                                    description="Puedes cotizar igual, pero los ítems quedarán marcados “Sin tarifa” y habrá que definir el precio a mano."
                                />
                            ) : !idTablamaSel ? (
                                <Alert
                                    type="warning"
                                    showIcon
                                    style={{ marginBottom: 12 }}
                                    message="Selecciona la tabla del convenio"
                                    description="Sin la tabla el motor no puede calzar la tarifa y los precios saldrían en cero."
                                />
                            ) : null}

                            <div className="adl-fco-itembuilder">
                                <Select
                                    placeholder="Normativa"
                                    style={{ flex: '1 1 150px', minWidth: 130 }}
                                    value={normativaSel}
                                    onChange={onNormativaChange}
                                    options={normativas.map((n) => ({ value: String(n.id_normativa), label: n.nombre_normativa }))}
                                />
                                <Select
                                    placeholder="Referencia"
                                    style={{ flex: '1 1 150px', minWidth: 130 }}
                                    value={referenciaSel}
                                    disabled={!normativaSel}
                                    onChange={onReferenciaChange}
                                    options={referencias.map((r) => ({ value: String(r.id_normativareferencia), label: r.nombre_normativareferencia }))}
                                />
                                <Select
                                    placeholder="Técnica"
                                    style={{ flex: '2 1 200px', minWidth: 160 }}
                                    value={tecnicaSel}
                                    disabled={!referenciaSel}
                                    showSearch
                                    optionFilterProp="label"
                                    onChange={setTecnicaSel}
                                    options={tecnicasDisponibles.map((t) => ({ value: String(t.id_referenciaanalisis), label: t.nombre_tecnica }))}
                                />
                                <InputNumber min={1} value={cantidadSel} onChange={(v) => setCantidadSel(Number(v) || 1)} style={{ width: 72, flexShrink: 0 }} />
                                <Button icon={<IconPlus size={14} />} onClick={agregarItem} style={{ flexShrink: 0 }}>Agregar</Button>
                            </div>

                            {/* Una tarjeta por servicio: el título y sus ítems.
                                El servicio activo es al que se agregan las
                                líneas nuevas. */}
                            {secciones.map((sec, idx) => (
                                <div
                                    key={sec.key}
                                    className="adl-fco-seccion"
                                    style={{ borderColor: sec.key === seccionActiva ? C.primary : C.border }}
                                    onClick={() => setSeccionActiva(sec.key)}
                                >
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                                        <span className="adl-fco-seccion-n">{idx + 1}</span>
                                        <Input
                                            size="small"
                                            placeholder={`Título del servicio ${idx + 1} — ej: Muestreo y análisis aguas residuales`}
                                            value={sec.titulo}
                                            onChange={(e) => setSecciones((prev) => prev.map((s) => s.key === sec.key ? { ...s, titulo: e.target.value } : s))}
                                        />
                                        {secciones.length > 1 && (
                                            <Tooltip title="Quitar este servicio">
                                                <Button size="small" type="text" danger icon={<IconTrash size={14} />} onClick={() => quitarSeccion(sec.key)} />
                                            </Tooltip>
                                        )}
                                    </div>

                                    {sec.items.length > 0 ? (
                                        <Table
                                            size="small"
                                            pagination={false}
                                            rowKey="key"
                                            dataSource={sec.items}
                                            columns={[
                                                {
                                                    title: 'Ítem', dataIndex: 'nombre_tecnica',
                                                    render: (v, r) => r.idTecnica ? v : (
                                                        // Línea libre: el nombre lo escribe el usuario.
                                                        <Input
                                                            size="small"
                                                            placeholder="Ej: Gastos de Traslado"
                                                            value={v}
                                                            onChange={(e) => parchearItem(sec.key, r.key, { nombre_tecnica: e.target.value })}
                                                        />
                                                    ),
                                                },
                                                {
                                                    title: 'Cant.', dataIndex: 'cantidad', width: 70, align: 'right',
                                                    render: (v, r) => (
                                                        <InputNumber
                                                            size="small" min={1} value={v} style={{ width: 60 }}
                                                            onChange={(nv) => parchearItem(sec.key, r.key, { cantidad: Number(nv) || 1 })}
                                                        />
                                                    ),
                                                },
                                                {
                                                    // Editable siempre: es la salida para los análisis
                                                    // que el convenio no cubre y para las líneas libres.
                                                    title: 'P. Unit. UF', dataIndex: 'precioUf', width: 120, align: 'right',
                                                    render: (v, r) => r.resolviendo ? <Spin size="small" /> : (
                                                        <InputNumber
                                                            size="small" min={0} step={0.01} value={v ?? undefined}
                                                            placeholder="Sin tarifa" style={{ width: 100 }}
                                                            status={v == null ? 'warning' : undefined}
                                                            onChange={(nv) => parchearItem(sec.key, r.key, { precioUf: nv == null ? null : Number(nv), precioManual: true })}
                                                        />
                                                    ),
                                                },
                                                {
                                                    title: '', width: 40, align: 'center',
                                                    render: (_, r) => <Button size="small" type="text" danger icon={<IconTrash size={14} />} onClick={() => quitarItem(sec.key, r.key)} />,
                                                },
                                            ]}
                                        />
                                    ) : (
                                        <p style={{ fontSize: 12.5, color: C.textTer, margin: 0 }}>
                                            Sin ítems. {sec.key === seccionActiva ? 'Agrégalos con el buscador de arriba.' : 'Haz clic para activarlo.'}
                                        </p>
                                    )}

                                    <Button
                                        size="small"
                                        type="link"
                                        icon={<IconPlus size={13} />}
                                        style={{ paddingLeft: 0, marginTop: 6 }}
                                        onClick={(e) => { e.stopPropagation(); agregarLineaLibre(sec.key); }}
                                    >
                                        Agregar línea sin tarifa (traslado, manejo de muestras…)
                                    </Button>
                                </div>
                            ))}

                            <Button
                                icon={<IconPlus size={14} />}
                                onClick={agregarSeccion}
                                style={{ marginTop: 4 }}
                                block
                            >
                                Agregar otro servicio a esta propuesta
                            </Button>
                        </div>
                    </div>

                    {/* Vista previa en vivo — misma estructura y colores que el PDF
                        que genera el backend (Propuesta Técnico Económica). */}
                    <div className="adl-fco-preview">
                        <div className="adl-fco-doc">
                            {/* Encabezado: logo + título + doble filete de marca */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
                                <img src={logoAdl} alt="ADL Diagnostic" style={{ width: 170 }} />
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: C.navy, lineHeight: 1.25 }}>
                                        PROPUESTA<br />TÉCNICO ECONÓMICA
                                    </div>
                                    <div style={{ fontSize: 10.5, color: C.textTer, marginTop: 4 }}>Medio Ambiente</div>
                                </div>
                            </div>
                            <div style={{ borderTop: `1.5px solid ${C.navy}`, marginTop: 16 }} />
                            <div style={{ borderTop: `2.5px solid ${C.orange}`, marginTop: 2.5, marginBottom: 22 }} />

                            {/* Datos de la propuesta */}
                            <dl className="adl-fco-datos">
                                <dt>Código Propuesta</dt>
                                <dd>: MA-P<i style={{ color: C.textTer, fontStyle: 'normal' }}>(nuevo)</i>-{fmtDdmmyyyy(new Date())}-{(nombreClienteSel || '—').toUpperCase()}</dd>
                                <dt>Señores</dt>
                                <dd>: {nombreClienteSel || <span style={{ color: C.textTer }}>Selecciona un cliente</span>}</dd>
                                <dt>RUT</dt>
                                <dd>: {clienteConfig?.rut?.trim() || <span style={{ color: C.textTer }}>—</span>}</dd>
                                <dt>Dirección</dt>
                                <dd>: {clienteConfig?.direccion?.trim() || <span style={{ color: C.textTer }}>—</span>}</dd>
                                <dt>Fecha</dt>
                                <dd>: {fmtFechaLarga(new Date())}</dd>
                                {(clienteConfig?.contacto || '').trim() && (
                                    <>
                                        <dt>Atención</dt>
                                        <dd>: {clienteConfig.contacto.trim()}</dd>
                                    </>
                                )}
                                {nombreCentroSel && (
                                    <>
                                        <dt>Centro</dt>
                                        <dd>: {nombreCentroSel}</dd>
                                    </>
                                )}
                            </dl>

                            {/* Un bloque numerado por servicio, igual que la propuesta en Word */}
                            {items.length === 0 ? (
                                <>
                                    <h3>1. {(secciones[0]?.titulo || glosaSel || 'SERVICIO DE MUESTREO Y ANÁLISIS').toUpperCase()}</h3>
                                    <div className="adl-fco-preview-empty">
                                        Los ítems que agregues aparecerán acá, con el precio real del convenio del cliente.
                                    </div>
                                </>
                            ) : (
                                secciones.filter((s) => s.items.length > 0).map((sec, idx, visibles) => {
                                    const subtotalSec = sec.items.reduce((a, it) => a + (it.precioUf || 0) * it.cantidad, 0);
                                    return (
                                        <div key={sec.key}>
                                            <h3>{idx + 1}. {(sec.titulo || glosaSel || `SERVICIO ${idx + 1}`).toUpperCase()}</h3>
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>ÍTEM</th>
                                                        <th style={{ textAlign: 'right', width: 130 }}>Valor Neto Unitario (UF)</th>
                                                        <th style={{ textAlign: 'right', width: 80 }}>N° Muestras</th>
                                                        <th style={{ textAlign: 'right', width: 100 }}>Valor Neto (UF)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sec.items.map((it) => (
                                                        <tr key={it.key}>
                                                            <td>{it.nombre_tecnica || <span style={{ color: C.textTer }}>(sin nombre)</span>}</td>
                                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                                {it.resolviendo ? '…' : it.precioUf != null ? fmtUf(it.precioUf) : <span style={{ color: '#cf1322' }}>Sin tarifa</span>}
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>{it.cantidad}</td>
                                                            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                                                {it.resolviendo ? '…' : it.precioUf != null ? fmtUf(it.precioUf * it.cantidad) : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {/* El subtotal por servicio solo aporta si hay más de uno */}
                                            {visibles.length > 1 && (
                                                <div className="adl-fco-tot" style={{ marginTop: 6, fontWeight: 700, color: C.navy, justifyContent: 'flex-end', gap: 18 }}>
                                                    <span>Subtotal servicio U.F.:</span>
                                                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUf(subtotalSec)}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}

                            {items.length > 0 && (
                                <>
                                    <div style={{ marginTop: 18, marginLeft: 'auto', width: 290 }}>
                                        <div style={{ borderTop: `1.5px solid ${C.navy}`, marginBottom: 8 }} />
                                        <div className="adl-fco-tot"><span>Subtotal U.F.:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUf(subtotalUf)}</span></div>
                                        <div className="adl-fco-tot" style={{ fontWeight: 700, color: C.navy }}>
                                            <span>TOTAL GENERAL U.F.:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtUf(subtotalUf)}</span>
                                        </div>
                                        {valorUfHoy && (
                                            <>
                                                <div className="adl-fco-tot" style={{ marginTop: 8 }}><span>TOTAL NETO $:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>$ {fmtClp(netoClp)}</span></div>
                                                <div className="adl-fco-tot"><span>IVA (19%) $:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>$ {fmtClp(ivaClp)}</span></div>
                                                <div className="adl-fco-tot" style={{ fontWeight: 700, color: C.orange, fontSize: 13 }}>
                                                    <span>TOTAL $:</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>$ {fmtClp(totalClp)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <p className="adl-fco-nota" style={{ marginTop: 14, fontStyle: 'italic' }}>
                                        Valores expresados en UF.{valorUfHoy ? ` Conversión referencial con UF de $ ${fmtUf(valorUfHoy)}; se factura con la UF del día de facturación.` : ''}
                                    </p>
                                </>
                            )}

                            {/* Secciones fijas: su número va después de los
                                servicios (con dos servicios son la 3 y la 4) */}
                            <h3>{nFijoPreview + 1}. ANTECEDENTES GENERALES</h3>
                            <ul className="adl-fco-legal">
                                {ANTECEDENTES_GENERALES.map((t, i) => (
                                    <li key={i}><span>{String.fromCharCode(97 + i)}.</span><span>{t}</span></li>
                                ))}
                            </ul>

                            <h3>{nFijoPreview + 2}. CONDICIONES GENERALES DEL SERVICIO</h3>

                            <h4>a. VALIDEZ DE LA PROPUESTA</h4>
                            <p className="adl-fco-nota">
                                La presente cotización tiene una validez de {vigenciaDiasSel} días a partir de la fecha de emisión
                                (hasta el {fmtFecha(fechaVigenciaPreview.toISOString())}).
                            </p>

                            <h4>b. DATOS EMPRESA</h4>
                            <p className="adl-fco-nota">
                                Nombre: Soc. ADL Diagnostic Chile SpA.<br />
                                Rut: 77.354.970-2<br />
                                Giro: Laboratorio<br />
                                Dirección: Sector la Vara S/N, Camino Alerce, Puerto Montt<br />
                                El depósito o transferencia debe realizarse a nombre de ADL Diagnostic Chile SpA., Cta. Cte. Nro. 63042975
                                Banco Crédito e Inversiones (BCI), Puerto Montt. Para validar el pago se deberá enviar copia del
                                comprobante respectivo a la Srta. Karina Rival a la casilla electrónica krival@adldiagnostic.cl
                            </p>

                            <h4>c. CONDICIONES DE PAGO</h4>
                            <p className="adl-fco-nota">
                                El pago se realizará a 30 días, con valor de UF al día de facturación y previa emisión de la
                                respectiva Orden de Compra a nombre de ADL Diagnostic Chile SpA.
                            </p>

                            <h4>d. NOTAS IMPORTANTES DEL SERVICIO</h4>
                            <ul className="adl-fco-legal">
                                {NOTAS_IMPORTANTES.map((t, i) => (
                                    <li key={i}><span>•</span><span>{t}</span></li>
                                ))}
                            </ul>

                            {observacionesSel && (
                                <>
                                    <h4>e. OBSERVACIONES</h4>
                                    <p className="adl-fco-nota" style={{ whiteSpace: 'pre-wrap' }}>{observacionesSel}</p>
                                </>
                            )}

                            <div style={{ marginTop: 34 }}>
                                <p style={{ margin: '0 0 34px' }}>Atentamente,</p>
                                <div style={{ borderTop: '1px solid #bbb', width: 230 }} />
                                <div style={{ fontWeight: 700, color: C.navy, fontSize: 11.5, marginTop: 5 }}>Jefe Comercial Medio Ambiente</div>
                                <div style={{ fontSize: 11 }}>Soc. ADL Diagnostic Chile SpA.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ------------------------------------------------------------------
    // Vista: DETALLE (dos columnas — datos/ítems a la izquierda, comunicación fija a la derecha)
    // ------------------------------------------------------------------

    if (seleccion) {
        const puedeGestionarCotizacion = cotizacionDetalle && cotizacionDetalle.estado !== 'ACEPTADA' && cotizacionDetalle.estado !== 'RECHAZADA';
        // Cotizaciones viejas (anteriores a las secciones) no traen `secciones`:
        // se muestran como un único servicio con todos sus ítems.
        const seccionesDetalle: any[] = cotizacionDetalle?.secciones?.length
            ? cotizacionDetalle.secciones
            : cotizacionDetalle
                ? [{ id_seccion: null, titulo: cotizacionDetalle.glosa, items: cotizacionDetalle.items || [], subtotal_uf: cotizacionDetalle.subtotal_uf }]
                : [];
        // Mismos estados que acepta el backend: una vez aceptada o rechazada el
        // precio queda congelado.
        const precioEditable = !!cotizacionDetalle && ['BORRADOR', 'ENVIADA'].includes(cotizacionDetalle.estado);

        const historialItems = [
            { color: 'gray', children: <span>Solicitud recibida — {fmtFechaHora(seleccion.fecha_creacion)}</span> },
            ...(cotizacionDetalle ? [{ color: 'blue', children: <span>Cotización N° {cotizacionDetalle.numero_cotizacion} creada — {fmtFechaHora(cotizacionDetalle.fecha_creacion)}</span> }] : []),
            ...(cotizacionDetalle?.portal_publicado ? [{ color: 'blue', children: <span>Enviada al cliente — {fmtFechaHora(cotizacionDetalle.fecha_portal_publicado)}</span> }] : []),
            { color: ESTADO_COLOR[seleccion.estado_unificado] === 'green' ? 'green' : ESTADO_COLOR[seleccion.estado_unificado] === 'red' ? 'red' : 'blue', children: <span><b>Estado actual:</b> {seleccion.estado_label}</span> },
        ];

        return (
            <div className="adl-fco-wrap">
                <style>{CSS}</style>
                <div className="adl-fco-detail-header">
                    <Button icon={<IconArrowLeft size={16} />} onClick={volverALista}>Volver a la bandeja</Button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17, fontWeight: 700, color: C.text }}>
                            {cotizacionDetalle ? `Cotización N° ${cotizacionDetalle.numero_cotizacion} — ` : ''}{seleccion.nombre_cliente}
                        </div>
                        <div style={{ fontSize: 13, color: C.textSec }}>{seleccion.titulo || 'Sin título'}</div>
                    </div>
                    {cotizacionDetalle && (
                        <div style={{ textAlign: 'right', marginRight: 4 }}>
                            <div style={{ fontSize: 11, color: C.textTer, textTransform: 'uppercase' }}>Total</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: C.primary }}>{fmtUf(cotizacionDetalle.total_uf)} UF</div>
                        </div>
                    )}
                    <Tag color={ESTADO_COLOR[seleccion.estado_unificado] || 'default'} style={{ fontSize: 12.5, padding: '4px 10px' }}>
                        {seleccion.estado_label}
                    </Tag>
                    {cotizacionDetalle?.estado === 'ACEPTADA' && (
                        <Tooltip title={cotizacionDetalle.fecha_convertida_ficha
                            ? `Ya se generó trabajo desde esta cotización el ${fmtFecha(cotizacionDetalle.fecha_convertida_ficha)}. Puedes crear otra ficha si hace falta.`
                            : 'Abre el formulario de ficha con el cliente, el centro y los análisis cotizados ya cargados'}>
                            <Button
                                type="primary"
                                icon={<IconClipboardPlus size={15} />}
                                loading={accionLoading === 'FICHA'}
                                onClick={crearFichaDesdeCotizacion}
                            >
                                {cotizacionDetalle.fecha_convertida_ficha ? 'Crear otra ficha' : 'Crear ficha'}
                            </Button>
                        </Tooltip>
                    )}
                    {cotizacionDetalle && (
                        <Tooltip title="Ver la Propuesta Técnico Económica">
                            <Button
                                icon={<IconFileTypePdf size={15} />}
                                loading={accionLoading === 'PDF'}
                                onClick={async () => {
                                    setAccionLoading('PDF');
                                    try {
                                        await abrirArchivo(
                                            facturacionService.urlPdfCotizacion(cotizacionDetalle.id_cotizacion),
                                            `Propuesta_MA-P${cotizacionDetalle.numero_cotizacion}.pdf`,
                                            'application/pdf');
                                    } finally {
                                        setAccionLoading(null);
                                    }
                                }}
                            >
                                PDF
                            </Button>
                        </Tooltip>
                    )}
                    {puedeGestionarCotizacion && (
                        <Space>
                            {cotizacionDetalle.estado === 'BORRADOR' && !cotizacionDetalle.portal_publicado && (
                                <Tooltip title="Genera el PDF y se lo entrega al cliente en su portal (ADL WEB GO); pasa a Enviada.">
                                    <Button type="primary" icon={<IconWorldUpload size={14} />} loading={publicando} onClick={enviarCotizacionAlCliente}>
                                        Enviar cotización al cliente
                                    </Button>
                                </Tooltip>
                            )}
                            <Button icon={<IconCircleCheck size={14} />} loading={accionLoading === 'ACEPTADA'} onClick={() => cambiarEstado('ACEPTADA')}>Aceptada</Button>
                            <Button danger icon={<IconCircleX size={14} />} loading={accionLoading === 'RECHAZADA'} onClick={() => cambiarEstado('RECHAZADA')}>Rechazada</Button>
                        </Space>
                    )}
                </div>

                {detalleLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin /></div>
                ) : (
                    <div className="adl-fco-detail-grid">
                        {/* Columna izquierda: datos / ítems / cotización */}
                        <div>
                            {seleccion.origen === 'PORTAL' && solicitudDetalle && (
                                <Collapse
                                    ghost
                                    defaultActiveKey={cotizacionDetalle ? [] : ['sol']}
                                    style={{ marginBottom: 22, background: '#fff', borderRadius: 10, border: `1px solid ${C.border}` }}
                                    items={[{
                                        key: 'sol',
                                        label: <span style={{ fontWeight: 600, fontSize: 13 }}>Solicitud original del cliente</span>,
                                        children: (
                                            <div>
                                                {!solicitudDetalle.id_empresaservicio && (
                                                    <Tag color="orange" style={{ marginBottom: 10 }}>
                                                        Cliente no resuelto — {solicitudDetalle.nombre_cliente_portal || 'sin nombre'}
                                                    </Tag>
                                                )}
                                                {(solicitudDetalle.solicitante_nombre || solicitudDetalle.solicitante_email) && (
                                                    <div className="adl-fco-meta" style={{ marginBottom: 12 }}>
                                                        Enviada por <b style={{ color: C.text }}>{solicitudDetalle.solicitante_nombre || '—'}</b>
                                                        {solicitudDetalle.solicitante_email && (
                                                            <> · <a href={`mailto:${solicitudDetalle.solicitante_email}`}>{solicitudDetalle.solicitante_email}</a></>
                                                        )}
                                                        {' · '}{fmtFechaHora(solicitudDetalle.fecha_creacion)}
                                                    </div>
                                                )}
                                                {solicitudDetalle.descripcion && (
                                                    <p style={{ fontSize: 13, color: C.text, whiteSpace: 'pre-wrap', marginBottom: 10 }}>{solicitudDetalle.descripcion}</p>
                                                )}
                                                {solicitudDetalle.items?.length > 0 && (
                                                    <ul style={{ paddingLeft: 18, fontSize: 13, color: C.text, margin: 0 }}>
                                                        {solicitudDetalle.items.map((it: any, i: number) => (
                                                            <li key={i}><b>{it.cantidad}×</b> {it.descripcion}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                                {adjuntos.length > 0 && (
                                                    <div style={{ marginTop: 14 }}>
                                                        <p className="adl-fco-sectitle" style={{ marginBottom: 8 }}>Archivos ({adjuntos.length})</p>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {adjuntos.map((a: any) => {
                                                                const t = tipoArchivo(a.nombre_original, a.mime);
                                                                return (
                                                                    <button
                                                                        key={a.id}
                                                                        type="button"
                                                                        className="adl-fco-adjunto"
                                                                        onClick={() => bajarAdjunto(seleccion.id_solicitud_portal!, a)}
                                                                    >
                                                                        <span className="adl-fco-adjunto-ico" style={{ background: t.fondo, color: t.color }}>
                                                                            <t.Icono size={17} />
                                                                        </span>
                                                                        <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                                                                            <span className="adl-fco-adjunto-nom">{a.nombre_original}</span>
                                                                            <span className="adl-fco-adjunto-meta">
                                                                                {t.etiqueta}{a.tamano_bytes ? ` · ${fmtTamano(a.tamano_bytes)}` : ''}
                                                                                {a.origen === 'ADL_ONE' ? ' · enviado por ADL' : ''}
                                                                            </span>
                                                                        </span>
                                                                        <IconDownload size={15} style={{ color: C.textTer, flexShrink: 0 }} />
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ),
                                    }]}
                                />
                            )}

                            {!cotizacionDetalle ? (
                                <div className="adl-fco-card" style={{ textAlign: 'center', padding: '48px 20px' }}>
                                    <Empty description="Todavía no se ha armado la cotización real para esta solicitud." />
                                    <Button type="primary" icon={<IconPlus size={16} />} style={{ marginTop: 16 }} onClick={() => abrirCreacion(solicitudDetalle || seleccion)}>
                                        Armar cotización
                                    </Button>
                                </div>
                            ) : (
                                <div className="adl-fco-card">
                                    {/* Metadatos en una línea, no en una tabla de etiquetas — menos ruido visual */}
                                    <div className="adl-fco-meta" style={{ marginBottom: 22, display: 'flex', gap: 22, flexWrap: 'wrap' }}>
                                        <span>Vigente hasta <b style={{ color: C.text }}>{fmtFecha(cotizacionDetalle.fecha_vigencia)}</b></span>
                                        <span>UF <b style={{ color: C.text }}>{fmtUf(cotizacionDetalle.valor_uf)}</b></span>
                                    </div>
                                    {cotizacionDetalle.observaciones && (
                                        <p style={{ fontSize: 13, color: C.textSec, marginBottom: 22, whiteSpace: 'pre-wrap' }}>{cotizacionDetalle.observaciones}</p>
                                    )}

                                    {/* Una tabla por servicio: la cotización puede
                                        traer varias glosas, cada una con sus ítems. */}
                                    {seccionesDetalle.map((sec: any, idx: number) => (
                                        <div key={sec.id_seccion ?? idx} style={{ marginBottom: 18 }}>
                                            {seccionesDetalle.length > 1 && (
                                                <p className="adl-fco-sectitle" style={{ marginBottom: 8 }}>
                                                    {idx + 1}. {sec.titulo || `Servicio ${idx + 1}`}
                                                </p>
                                            )}
                                            <Table
                                                size="small"
                                                pagination={false}
                                                rowKey="id_item"
                                                dataSource={sec.items || []}
                                                columns={[
                                                    { title: 'Ítem', dataIndex: 'descripcion', render: (v, r: any) => v || `Técnica #${r.id_tecnica}` },
                                                    { title: 'Cant.', dataIndex: 'cantidad', width: 60, align: 'right' },
                                                    {
                                                        // Sin tarifa en el convenio o línea fuera de
                                                        // catálogo: acá se le pone precio a mano.
                                                        title: 'P. Unit. UF', dataIndex: 'precio_unitario_uf', width: 120, align: 'right',
                                                        render: (v, r: any) => precioEditable ? (
                                                            <InputNumber
                                                                size="small" min={0} step={0.01}
                                                                value={v == null ? undefined : Number(v)}
                                                                placeholder="Sin tarifa" style={{ width: 100 }}
                                                                status={v == null ? 'warning' : undefined}
                                                                disabled={precioGuardando === r.id_item}
                                                                onBlur={(e) => guardarPrecioItem(r, e.currentTarget.value)}
                                                                onPressEnter={(e) => (e.currentTarget as HTMLInputElement).blur()}
                                                            />
                                                        ) : (v != null ? fmtUf(v) : <Tag color="red">Sin tarifa</Tag>),
                                                    },
                                                    { title: 'Subtotal', dataIndex: 'precio_total_uf', width: 90, align: 'right', render: (v) => v == null ? '—' : fmtUf(v) },
                                                ]}
                                            />
                                            {seccionesDetalle.length > 1 && (
                                                <div style={{ textAlign: 'right', fontSize: 12.5, color: C.textSec, marginTop: 6 }}>
                                                    Subtotal servicio: <b style={{ color: C.text }}>{fmtUf(sec.subtotal_uf)} UF</b>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {precioEditable && (cotizacionDetalle.items || []).some((i: any) => i.precio_unitario_uf == null) && (
                                        <Alert
                                            type="warning"
                                            showIcon
                                            style={{ marginBottom: 16 }}
                                            message="Hay ítems sin tarifa en el convenio"
                                            description="Escribe el valor unitario en UF directamente en la tabla; queda guardado como precio manual y se recalculan los totales."
                                        />
                                    )}

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, fontSize: 13, color: C.textSec }}>
                                        <span>Neto: <b style={{ color: C.text }}>$ {fmtClp(cotizacionDetalle.neto_clp)}</b></span>
                                        <span>IVA: <b style={{ color: C.text }}>$ {fmtClp(cotizacionDetalle.iva_clp)}</b></span>
                                        <span>Total: <b style={{ color: C.primary }}>$ {fmtClp(cotizacionDetalle.total_clp)}</b></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Columna derecha: comunicación y actividad (fija) */}
                        <div className="adl-fco-panel">
                            <Tabs
                                activeKey={rightTab}
                                onChange={setRightTab}
                                centered
                                items={[
                                    ...(seleccion.origen === 'PORTAL' ? [{
                                        key: 'mensajes',
                                        label: <span><IconMessageCircle2 size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Mensajes</span>,
                                        children: (
                                            <div className="adl-fco-chat">
                                                <div className="adl-fco-chatlist">
                                                    {mensajesLoading ? (
                                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Spin /></div>
                                                    ) : mensajes.length === 0 ? (
                                                        <p style={{ fontSize: 13, color: C.textTer, textAlign: 'center', margin: '20px 0' }}>Aún no hay mensajes. Escribe el primero.</p>
                                                    ) : (
                                                        mensajes.map((m) => {
                                                            const esNuestro = m.origen === 'ADL_ONE' || m.usuario_nombre === 'Facturación ADL ONE';
                                                            const adjuntosMsg = adjuntos.filter((a: any) => a.id_mensaje === m.id);
                                                            return (
                                                                <div
                                                                    key={m.id}
                                                                    className="adl-fco-bubble"
                                                                    style={{
                                                                        background: m.es_sistema ? 'transparent' : (esNuestro ? C.primary : '#fff'),
                                                                        color: m.es_sistema ? C.textTer : (esNuestro ? '#fff' : C.text),
                                                                        border: m.es_sistema ? 'none' : (esNuestro ? 'none' : `1px solid ${C.border}`),
                                                                        fontStyle: m.es_sistema ? 'italic' : 'normal',
                                                                        textAlign: m.es_sistema ? 'center' : 'left',
                                                                        padding: m.es_sistema ? '2px 4px' : '8px 12px',
                                                                        fontSize: m.es_sistema ? 11.5 : 13,
                                                                        alignSelf: m.es_sistema ? 'center' : (esNuestro ? 'flex-end' : 'flex-start'),
                                                                    }}
                                                                >
                                                                    {!m.es_sistema && (
                                                                        <div style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.75, marginBottom: 2 }}>
                                                                            {m.usuario_nombre}{m.usuario_email ? ` · ${m.usuario_email}` : ''}
                                                                        </div>
                                                                    )}
                                                                    {m.mensaje}
                                                                    {adjuntosMsg.map((a: any) => (
                                                                        <button
                                                                            key={a.id}
                                                                            type="button"
                                                                            onClick={() => bajarAdjunto(seleccion.id_solicitud_portal!, a)}
                                                                            style={{
                                                                                display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 11.5,
                                                                                color: esNuestro ? '#fff' : C.primary, textDecoration: 'underline',
                                                                                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                                                                            }}
                                                                        >
                                                                            <IconPaperclip size={12} />{a.nombre_original}
                                                                        </button>
                                                                    ))}
                                                                    {!m.es_sistema && <div style={{ fontSize: 10, opacity: 0.6, marginTop: 3 }}>{fmtFechaHora(m.fecha)}</div>}
                                                                </div>
                                                            );
                                                        })
                                                    )}
                                                    <div ref={finChatRef} />
                                                </div>

                                                <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
                                                    {archivosAdjuntar.length > 0 && (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                                            {archivosAdjuntar.map((f, i) => (
                                                                <Tag key={i} closable onClose={() => setArchivosAdjuntar((p) => p.filter((_, idx) => idx !== i))} closeIcon={<IconX size={11} />}>
                                                                    {f.name} ({fmtTamano(f.size)})
                                                                </Tag>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', gap: 8 }}>
                                                        <input
                                                            ref={fileInputRef}
                                                            type="file"
                                                            multiple
                                                            style={{ display: 'none' }}
                                                            onChange={(e) => {
                                                                setArchivosAdjuntar((p) => [...p, ...Array.from(e.target.files || [])]);
                                                                e.target.value = '';
                                                            }}
                                                        />
                                                        <Tooltip title="Adjuntar archivos (Word, PDF, imágenes...)">
                                                            <Button icon={<IconPaperclip size={15} />} onClick={() => fileInputRef.current?.click()} />
                                                        </Tooltip>
                                                        <Input
                                                            placeholder="Escribe un mensaje al cliente..."
                                                            value={mensajeNuevo}
                                                            onChange={(e) => setMensajeNuevo(e.target.value)}
                                                            onPressEnter={enviarMensaje}
                                                            disabled={enviandoMensaje}
                                                        />
                                                        <Button
                                                            type="primary"
                                                            icon={<IconSend2 size={14} />}
                                                            loading={enviandoMensaje}
                                                            disabled={!mensajeNuevo.trim() && archivosAdjuntar.length === 0}
                                                            onClick={enviarMensaje}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ),
                                    }] : []),
                                    {
                                        key: 'historial',
                                        label: 'Historial',
                                        children: <div style={{ padding: '20px 20px 24px' }}><Timeline items={historialItems} /></div>,
                                    },
                                ]}
                            />
                        </div>
                    </div>
                )}

                <Visores />
            </div>
        );
    }

    // ------------------------------------------------------------------
    // Vista: LISTA (bandeja unificada)
    // ------------------------------------------------------------------

    return (
        <div className="adl-fco-wrap">
            <style>{CSS}</style>

            <div className="adl-fco-header">
                <div>
                    <h2 className="adl-fco-title">Cotizaciones</h2>
                    <p className="adl-fco-sub">Solicitudes de clientes y cotizaciones armadas — todo en una sola bandeja.</p>
                </div>
                <Space>
                    <Button icon={<IconRefresh size={16} />} onClick={cargarBandeja}>Actualizar</Button>
                    <Button type="primary" icon={<IconPlus size={16} />} onClick={() => abrirCreacion()}>Nueva cotización</Button>
                </Space>
            </div>

            <div className="adl-fco-filters">
                <Select
                    allowClear
                    placeholder="Filtrar por estado"
                    style={{ width: 220 }}
                    value={filtroEstado}
                    onChange={setFiltroEstado}
                    options={Object.entries(ESTADO_LABEL).map(([value, label]) => ({ value, label }))}
                />
                <Space size={6}>
                    <Switch size="small" checked={filtroNoLeidos} onChange={setFiltroNoLeidos} />
                    <span style={{ fontSize: 13, color: C.textSec }}>Solo con mensajes nuevos</span>
                </Space>
            </div>

            {bandejaLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spin /></div>
            ) : bandeja.length === 0 ? (
                <Empty description="No hay nada con ese filtro." />
            ) : (
                <Table<BandejaRow>
                    rowKey={(r) => `${r.origen}-${r.id_solicitud_portal ?? r.id_cotizacion}`}
                    columns={columns}
                    dataSource={bandeja}
                    size="small"
                    pagination={{ pageSize: 20, size: 'small' }}
                    rowClassName={(r) => r.tiene_mensaje_nuevo ? 'adl-fco-row-unread' : ''}
                    onRow={(r) => ({ onClick: () => abrirDetalle(r), style: { cursor: 'pointer' } })}
                />
            )}
        </div>
    );
};

export default FacturacionCotizaciones;
