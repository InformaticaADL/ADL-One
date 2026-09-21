import { useEffect, useState, useCallback, useRef } from 'react';
import {
    IconRefresh, IconPlus, IconTrash, IconSend2, IconCircleCheck, IconCircleX,
    IconArrowLeft, IconMessageCircle2, IconWorldUpload, IconPaperclip, IconFileTypePdf, IconX,
    IconClipboardPlus, IconPhoto, IconFileSpreadsheet, IconFileTypeDoc, IconFile, IconDownload,
    IconChevronDown, IconAlertTriangle, IconInfoCircle, IconInbox, IconGripVertical,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { DataPagination } from '@/components/ui/pagination';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../../components/layout/PageHeader';
import { facturacionService } from '../services/facturacion.service';
import { useVisorArchivo } from '../utils/useVisorArchivo';
import { useNavStore } from '../../../store/navStore';
import { useToast } from '../../../contexts/ToastContext';
import logoAdl from '../../../assets/images/logo_adl.png';
import { catalogosService, type EmpresaServicio, type Centro } from '../../medio-ambiente/services/catalogos.service';
import { analysisService } from '../../medio-ambiente/services/analysis.service';

// Colores de marca del PDF (mismos que _drawHeader en facturacion.service.js) —
// se mantienen literales porque describen el documento impreso, no el tema de
// la app.
const C = {
    navy: '#173A5E', orange: '#F4801F', bandaTabla: '#EEF3F7',
};

// Estado unificado de una fila de la bandeja (mezcla el estado de la solicitud
// del cliente con el estado de la cotización que arma el staff — ver
// listarBandejaCotizaciones en el backend, que ya resuelve cuál manda).
const ESTADO_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive'> = {
    PENDIENTE: 'warning', BORRADOR: 'secondary', ENVIADA: 'default',
    ACEPTADA: 'success', RECHAZADA: 'destructive', CANCELADA: 'secondary', EXPIRADA: 'destructive',
};
const ESTADO_LABEL: Record<string, string> = {
    PENDIENTE: 'Solicitud pendiente', BORRADOR: 'En preparación', ENVIADA: 'Enviada al cliente',
    ACEPTADA: 'Aceptada', RECHAZADA: 'Rechazada', CANCELADA: 'Cancelada por el cliente', EXPIRADA: 'Expirada',
};

const BANDEJA_PAGE_SIZE = 20;

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

const Spinner = ({ className }: { className?: string }) => (
    <div className={cn('animate-spin rounded-full border-2 border-primary border-t-transparent', className || 'h-6 w-6')} />
);

const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <div className="mb-5">
        <Label className="mb-1.5 block text-[12.5px] font-normal text-muted-foreground">{label}</Label>
        {children}
        {hint && <p className="mt-1.5 text-[11.5px] text-muted-foreground">{hint}</p>}
    </div>
);

const InlineAlert = ({ tone, title, description }: { tone: 'warning' | 'info'; title: string; description: string }) => (
    <div className={cn(
        'mb-3 flex items-start gap-2 rounded-lg border p-3',
        tone === 'warning' ? 'border-warning/40 bg-warning/10' : 'border-border bg-muted/50'
    )}>
        {tone === 'warning'
            ? <IconAlertTriangle size={16} className="mt-0.5 shrink-0 text-warning" />
            : <IconInfoCircle size={16} className="mt-0.5 shrink-0 text-muted-foreground" />}
        <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
        </div>
    </div>
);

const TIMELINE_DOT: Record<string, string> = {
    gray: 'bg-muted-foreground/40', blue: 'bg-primary', green: 'bg-success', red: 'bg-destructive',
};

const HistorialTimeline = ({ items }: { items: { color: string; children: React.ReactNode }[] }) => (
    <div className="flex flex-col">
        {items.map((it, i) => (
            <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                    <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', TIMELINE_DOT[it.color] || TIMELINE_DOT.gray)} />
                    {i < items.length - 1 && <span className="w-px flex-1 bg-border" />}
                </div>
                <div className="pb-5 text-sm text-foreground">{it.children}</div>
            </div>
        ))}
    </div>
);

const FacturacionCotizaciones: React.FC = () => {
    const { setActiveSubmodule, setFichasMode, setCotizacionParaFicha } = useNavStore();
    const { abrirArchivo, Visores } = useVisorArchivo();
    const { showToast } = useToast();

    // --- Bandeja unificada ---
    const [bandeja, setBandeja] = useState<BandejaRow[]>([]);
    const [bandejaLoading, setBandejaLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState<string | undefined>(undefined);
    const [filtroNoLeidos, setFiltroNoLeidos] = useState(false);
    const [bandejaPage, setBandejaPage] = useState(1);

    // --- Vista: lista | detalle | crear ---
    const [seleccion, setSeleccion] = useState<BandejaRow | null>(null);
    const [solicitudDetalle, setSolicitudDetalle] = useState<any>(null);
    const [cotizacionDetalle, setCotizacionDetalle] = useState<any>(null);
    const [precioGuardando, setPrecioGuardando] = useState<number | null>(null);
    const [detalleLoading, setDetalleLoading] = useState(false);
    const [rightTab, setRightTab] = useState('mensajes');
    const [accionLoading, setAccionLoading] = useState<string | null>(null);
    const [publicando, setPublicando] = useState(false);
    const [solicitudAbierta, setSolicitudAbierta] = useState(() => !cotizacionDetalle);

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
            showToast({ type: 'error', message: 'No se pudo cargar la bandeja' });
        } finally {
            setBandejaLoading(false);
        }
    }, [filtroEstado, filtroNoLeidos, showToast]);

    useEffect(() => { cargarBandeja(); }, [cargarBandeja]);
    useEffect(() => { setBandejaPage(1); }, [filtroEstado, filtroNoLeidos]);

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
            if (!silencioso) showToast({ type: 'error', message: 'No se pudo cargar el chat con el cliente' });
        } finally {
            if (!silencioso) setMensajesLoading(false);
        }
    }, [showToast]);

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
            showToast({ type: 'error', message: 'No se pudo cargar el detalle' });
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
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo enviar el mensaje' });
        } finally {
            setEnviandoMensaje(false);
        }
    };

    const cambiarEstado = async (nuevoEstado: string) => {
        if (!cotizacionDetalle) return;
        setAccionLoading(nuevoEstado);
        try {
            await facturacionService.cambiarEstadoCotizacion(cotizacionDetalle.id_cotizacion, nuevoEstado);
            showToast({ type: 'success', message: 'Estado actualizado' });
            setCotizacionDetalle(await facturacionService.getCotizacionDetalle(cotizacionDetalle.id_cotizacion));
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo actualizar el estado' });
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
                showToast({ type: 'warning', message: `${prep.avisos.length} análisis de esta cotización hay que agregarlos a mano (se cotizaron antes de que se guardara su normativa).` });
            }
            setCotizacionParaFicha(cotizacionDetalle.id_cotizacion);
            // 'ma-fichas-ingreso' se resuelve como submódulo compartido de alta
            // prioridad en DashboardPage, sin importar el módulo activo.
            setFichasMode('create_manual');
            setActiveSubmodule('ma-fichas-ingreso');
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo preparar la ficha' });
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
        if (!Number.isFinite(nuevo) || nuevo < 0) { showToast({ type: 'warning', message: 'El precio debe ser un número mayor o igual a 0' }); return; }
        if (item.precio_unitario_uf != null && Number(item.precio_unitario_uf) === nuevo) return;
        setPrecioGuardando(item.id_item);
        try {
            const actualizado = await facturacionService.actualizarPrecioItemCotizacion(
                cotizacionDetalle.id_cotizacion, item.id_item, nuevo,
            );
            setCotizacionDetalle(actualizado);
            showToast({ type: 'success', message: 'Precio actualizado' });
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo actualizar el precio' });
        } finally {
            setPrecioGuardando(null);
        }
    };

    const enviarCotizacionAlCliente = async () => {
        if (!cotizacionDetalle) return;
        setPublicando(true);
        try {
            await facturacionService.publicarCotizacionEnPortal(cotizacionDetalle.id_cotizacion);
            showToast({ type: 'success', message: 'Cotización enviada al cliente' });
            setCotizacionDetalle(await facturacionService.getCotizacionDetalle(cotizacionDetalle.id_cotizacion));
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo enviar la cotización' });
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
            showToast({ type: 'error', message: 'No se pudieron cargar las tablas con tarifa de este centro' });
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
            showToast({ type: 'error', message: 'No se pudieron cargar los centros de este cliente' });
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
        if (!idEmpresaServicioSel) { showToast({ type: 'warning', message: 'Selecciona el cliente primero — el precio depende de él.' }); return; }
        if (!idCentroSel) { showToast({ type: 'warning', message: 'Selecciona el centro: el precio del mismo análisis cambia según el centro.' }); return; }
        // La tabla solo se exige cuando el centro TIENE convenio. Si no hay
        // ninguna tarifa cargada (pasa en la mayoría de los clientes), exigirla
        // dejaría al cliente sin poder cotizarse: se permite seguir y los ítems
        // quedan marcados "Sin tarifa" para ponerles precio a mano.
        if (tablas.length > 0 && !idTablamaSel) {
            showToast({ type: 'warning', message: 'Selecciona la tabla: sin ella no se puede resolver la tarifa del convenio.' });
            return;
        }
        if (!tecnicaSel) { showToast({ type: 'warning', message: 'Selecciona una técnica' }); return; }
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

    // Reordenar arrastrando — solo dentro de la misma sección: cruzar ítems
    // entre secciones cambiaría a qué servicio/tabla de tarifa pertenecen
    // (afecta el precio), así que no se permite en el drag.
    const reordenarItems = (keySeccion: number, startIndex: number, endIndex: number) => {
        setSecciones((prev) => prev.map((s) => {
            if (s.key !== keySeccion) return s;
            const items = [...s.items];
            const [moved] = items.splice(startIndex, 1);
            items.splice(endIndex, 0, moved);
            return { ...s, items };
        }));
    };

    const handleDragEndItems = (result: DropResult) => {
        const { source, destination } = result;
        if (!destination || source.droppableId !== destination.droppableId || source.index === destination.index) return;
        reordenarItems(Number(source.droppableId), source.index, destination.index);
    };

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
        if (!idEmpresaServicioSel) { showToast({ type: 'warning', message: 'Selecciona un cliente' }); return; }
        if (items.length === 0) { showToast({ type: 'warning', message: 'Agrega al menos un ítem' }); return; }
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
                showToast({ type: 'warning', duration: 6000, message: `Cotización N° ${r.numero_cotizacion} creada, pero ${r.items_sin_precio.length} ítem(s) quedaron sin tarifa. Ponles precio en el detalle antes de enviarla al cliente.` });
            } else {
                showToast({ type: 'success', message: `Cotización N° ${r.numero_cotizacion} creada` });
            }
            if (seleccion?.origen === 'PORTAL' && seleccion.id_solicitud_portal && !seleccion.id_cotizacion) {
                try {
                    await facturacionService.vincularCotizacionAPortal(r.id_cotizacion, seleccion.id_solicitud_portal);
                } catch (e: any) {
                    showToast({ type: 'warning', message: 'La cotización se creó, pero no se pudo vincular a la solicitud: ' + (e?.response?.data?.message || '') });
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
            showToast({ type: 'error', message: e?.response?.data?.message || 'No se pudo crear la cotización' });
        } finally {
            setGuardandoCotizacion(false);
        }
    };

    // ------------------------------------------------------------------
    // Vista: CREAR (formulario + vista previa en vivo)
    // ------------------------------------------------------------------

    if (creando) {
        return (
            <div className="shadcn-scope w-full bg-background px-8 pb-14 pt-7">
                <PageHeader
                    title="Armar cotización"
                    onBack={cerrarCreacion}
                    breadcrumbItems={[{ label: 'Cotizaciones', onClick: cerrarCreacion }, { label: 'Armar cotización' }]}
                    rightSection={
                        <Button disabled={guardandoCotizacion} onClick={guardarCotizacion}>
                            {guardandoCotizacion && <Spinner className="h-4 w-4 border-primary-foreground/40 border-t-transparent" />}
                            Crear cotización
                        </Button>
                    }
                />

                <div className="grid w-full grid-cols-1 items-start gap-7 lg:grid-cols-2 lg:gap-8">
                    {/* Formulario */}
                    <div className="mb-5 rounded-xl border border-border bg-card p-6">
                        <div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="Cliente *" hint={items.length > 0 ? 'Quita los ítems para cambiar de cliente.' : undefined}>
                                    <Combobox
                                        disabled={items.length > 0}
                                        placeholder="Selecciona un cliente"
                                        searchPlaceholder="Buscar cliente..."
                                        value={idEmpresaServicioSel !== undefined ? String(idEmpresaServicioSel) : undefined}
                                        options={empresas.map((e) => ({ value: String(e.id), label: e.nombre }))}
                                        onValueChange={(val) => onEmpresaChange(Number(val))}
                                    />
                                </Field>
                                <Field label="Centro *">
                                    <Combobox
                                        disabled={!idEmpresaServicioSel || items.length > 0}
                                        placeholder={idEmpresaServicioSel ? 'Selecciona un centro' : 'Elige un cliente primero'}
                                        searchPlaceholder="Buscar centro..."
                                        value={idCentroSel !== undefined ? String(idCentroSel) : undefined}
                                        options={[
                                            { value: '', label: '— Ninguno —' },
                                            ...centros.map((c) => ({ value: String(c.id), label: c.nombre })),
                                        ]}
                                        onValueChange={(val) => onCentroChange(val ? Number(val) : undefined)}
                                    />
                                </Field>
                            </div>
                            <Field
                                label={`Tabla ${tablas.length > 0 ? '*' : '(este centro no tiene convenio)'}`}
                                hint={`El precio del mismo análisis cambia según el centro y la tabla del convenio.${idCentroSel && tablas.length === 0 ? ' Este centro no tiene convenio cargado: los ítems saldrán sin tarifa.' : ''}`}
                            >
                                <Combobox
                                    disabled={!idCentroSel || tablas.length === 0 || items.length > 0}
                                    placeholder={idCentroSel ? (tablas.length ? 'Selecciona la tabla del convenio' : 'Este centro no tiene tarifas cargadas') : 'Elige un centro primero'}
                                    searchPlaceholder="Buscar tabla..."
                                    value={idTablamaSel !== undefined ? String(idTablamaSel) : undefined}
                                    options={tablas.map((t: any) => ({
                                        value: String(Number(t.id_tablama)),
                                        label: `${t.nombre_tablama || `Tabla ${t.id_tablama}`} · ${t.tarifas} tarifas`,
                                    }))}
                                    onValueChange={(val) => setIdTablamaSel(val ? Number(val) : undefined)}
                                />
                            </Field>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <Field label="Título / Glosa">
                                    <Input placeholder="Ej: Monitoreo trimestral" value={glosaSel} onChange={(e) => setGlosaSel(e.target.value)} />
                                </Field>
                                <Field label="Vigencia (días)">
                                    <Input
                                        type="number" min={1}
                                        value={vigenciaDiasSel}
                                        onChange={(e) => setVigenciaDiasSel(Number(e.target.value) || 30)}
                                    />
                                </Field>
                            </div>
                            <Field label="Notas para el cliente">
                                <Textarea rows={2} placeholder="Opcional" value={observacionesSel} onChange={(e) => setObservacionesSel(e.target.value)} />
                            </Field>

                            <div className="my-1 mb-3.5 border-t border-border" />
                            <p className="mb-3.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Agregar ítems</p>
                            {(!idEmpresaServicioSel || !idCentroSel) ? (
                                <InlineAlert tone="warning" title="Completa cliente y centro antes de agregar ítems"
                                    description="Las tarifas del convenio están definidas por esa combinación: sin ellas el precio no se puede resolver." />
                            ) : tablas.length === 0 ? (
                                <InlineAlert tone="info" title="Este centro no tiene convenio cargado"
                                    description="Puedes cotizar igual, pero los ítems quedarán marcados “Sin tarifa” y habrá que definir el precio a mano." />
                            ) : !idTablamaSel ? (
                                <InlineAlert tone="warning" title="Selecciona la tabla del convenio"
                                    description="Sin la tabla el motor no puede calzar la tarifa y los precios saldrían en cero." />
                            ) : null}

                            <div className="mb-4 flex flex-wrap items-center gap-2">
                                <Combobox
                                    className="min-w-[130px] flex-1"
                                    placeholder="Normativa"
                                    searchPlaceholder="Buscar normativa..."
                                    value={normativaSel}
                                    onValueChange={onNormativaChange}
                                    options={normativas.map((n) => ({ value: String(n.id_normativa), label: n.nombre_normativa }))}
                                />
                                <Combobox
                                    className="min-w-[130px] flex-1"
                                    placeholder="Referencia"
                                    searchPlaceholder="Buscar referencia..."
                                    value={referenciaSel}
                                    disabled={!normativaSel}
                                    onValueChange={onReferenciaChange}
                                    options={referencias.map((r) => ({ value: String(r.id_normativareferencia), label: r.nombre_normativareferencia }))}
                                />
                                <Combobox
                                    className="min-w-[160px] flex-[2_1_200px]"
                                    placeholder="Técnica"
                                    searchPlaceholder="Buscar técnica..."
                                    value={tecnicaSel}
                                    disabled={!referenciaSel}
                                    onValueChange={setTecnicaSel}
                                    options={tecnicasDisponibles.map((t) => ({ value: String(t.id_referenciaanalisis), label: t.nombre_tecnica }))}
                                />
                                <Input
                                    type="number" min={1}
                                    value={cantidadSel}
                                    onChange={(e) => setCantidadSel(Number(e.target.value) || 1)}
                                    className="w-[72px] shrink-0"
                                />
                                <Button variant="outline" className="shrink-0" onClick={agregarItem}><IconPlus size={14} /> Agregar</Button>
                            </div>

                            {/* Una tarjeta por servicio: el título y sus ítems.
                                El servicio activo es al que se agregan las
                                líneas nuevas. */}
                            <DragDropContext onDragEnd={handleDragEndItems}>
                                {secciones.map((sec, idx) => (
                                    <div
                                        key={sec.key}
                                        className={cn(
                                            'mb-3.5 cursor-pointer rounded-lg border bg-card p-3.5 pb-2.5 transition-colors hover:border-primary',
                                            sec.key === seccionActiva ? 'border-primary' : 'border-border'
                                        )}
                                        onClick={() => setSeccionActiva(sec.key)}
                                    >
                                        <div className="mb-2.5 flex items-center gap-2">
                                            <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11.5px] font-bold text-white" style={{ background: C.navy }}>
                                                {idx + 1}
                                            </span>
                                            <Input
                                                placeholder={`Título del servicio ${idx + 1} — ej: Muestreo y análisis aguas residuales`}
                                                value={sec.titulo}
                                                className="h-8"
                                                onChange={(e) => setSecciones((prev) => prev.map((s) => s.key === sec.key ? { ...s, titulo: e.target.value } : s))}
                                            />
                                            {secciones.length > 1 && (
                                                <Button
                                                    variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    title="Quitar este servicio"
                                                    onClick={(e) => { e.stopPropagation(); quitarSeccion(sec.key); }}
                                                >
                                                    <IconTrash size={14} />
                                                </Button>
                                            )}
                                        </div>

                                        {sec.items.length > 0 ? (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="w-6" />
                                                        <TableHead>Ítem</TableHead>
                                                        <TableHead className="w-[70px] text-right">Cant.</TableHead>
                                                        <TableHead className="w-[120px] text-right">P. Unit. UF</TableHead>
                                                        <TableHead className="w-10" />
                                                    </TableRow>
                                                </TableHeader>
                                                <Droppable droppableId={String(sec.key)}>
                                                    {(droppableProvided) => (
                                                        <TableBody ref={droppableProvided.innerRef} {...droppableProvided.droppableProps}>
                                                            {sec.items.map((it, itemIdx) => (
                                                                <Draggable key={it.key} draggableId={String(it.key)} index={itemIdx}>
                                                                    {(draggableProvided, snapshot) => (
                                                                        <TableRow
                                                                            ref={draggableProvided.innerRef}
                                                                            {...draggableProvided.draggableProps}
                                                                            className={cn('hover:bg-transparent', snapshot.isDragging && 'bg-accent')}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            <TableCell {...draggableProvided.dragHandleProps} className="cursor-grab text-muted-foreground active:cursor-grabbing">
                                                                                <IconGripVertical size={14} />
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                {it.idTecnica ? it.nombre_tecnica : (
                                                                                    // Línea libre: el nombre lo escribe el usuario.
                                                                                    <Input
                                                                                        className="h-8"
                                                                                        placeholder="Ej: Gastos de Traslado"
                                                                                        value={it.nombre_tecnica}
                                                                                        onChange={(e) => parchearItem(sec.key, it.key, { nombre_tecnica: e.target.value })}
                                                                                    />
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                <Input
                                                                                    type="number" min={1}
                                                                                    className="h-8 w-[60px] text-right"
                                                                                    value={it.cantidad}
                                                                                    onChange={(e) => parchearItem(sec.key, it.key, { cantidad: Number(e.target.value) || 1 })}
                                                                                />
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                {it.resolviendo ? (
                                                                                    <div className="flex justify-end"><Spinner className="h-4 w-4" /></div>
                                                                                ) : (
                                                                                    <Input
                                                                                        type="number" min={0} step={0.01}
                                                                                        className={cn('h-8 w-[100px] text-right', it.precioUf == null && 'border-warning')}
                                                                                        placeholder="Sin tarifa"
                                                                                        value={it.precioUf ?? ''}
                                                                                        onChange={(e) => parchearItem(sec.key, it.key, { precioUf: e.target.value === '' ? null : Number(e.target.value), precioManual: true })}
                                                                                    />
                                                                                )}
                                                                            </TableCell>
                                                                            <TableCell className="text-center">
                                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => quitarItem(sec.key, it.key)}>
                                                                                    <IconTrash size={14} />
                                                                                </Button>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    )}
                                                                </Draggable>
                                                            ))}
                                                            {droppableProvided.placeholder}
                                                        </TableBody>
                                                    )}
                                                </Droppable>
                                            </Table>
                                        ) : (
                                            <p className="text-[12.5px] text-muted-foreground">
                                                Sin ítems. {sec.key === seccionActiva ? 'Agrégalos con el buscador de arriba.' : 'Haz clic para activarlo.'}
                                            </p>
                                        )}

                                        <Button
                                            variant="link" size="sm"
                                            className="mt-1.5 h-auto px-0 text-xs"
                                            onClick={(e) => { e.stopPropagation(); agregarLineaLibre(sec.key); }}
                                        >
                                            <IconPlus size={13} /> Agregar línea sin tarifa (traslado, manejo de muestras…)
                                        </Button>
                                    </div>
                                ))}
                            </DragDropContext>

                            <Button variant="outline" className="mt-1 w-full" onClick={agregarSeccion}>
                                <IconPlus size={14} /> Agregar otro servicio a esta propuesta
                            </Button>
                        </div>
                    </div>

                    {/* Vista previa en vivo — misma estructura y colores que el PDF
                        que genera el backend (Propuesta Técnico Económica). */}
                    <div className="sticky top-5 w-full overflow-y-auto rounded-md border border-[#e3e3e3] bg-white px-7 pb-8 pt-7 shadow-[0_2px_12px_rgba(0,0,0,0.06)]" style={{ maxHeight: 'calc(100vh - 150px)' }}>
                        {/* zoom (no transform): encoge el documento completo -incluido el alto
                            que ocupa- para que se vea "alejado", en vez de un scale() que deja
                            hueco vacío abajo porque el contenedor no sabe que el contenido
                            encogió. */}
                        <div className="text-[11.5px] leading-[1.55] text-black" style={{ zoom: 0.8 }}>
                            {/* Encabezado: logo + título + doble filete de marca */}
                            <div className="flex items-start justify-between gap-5">
                                <img src={logoAdl} alt="ADL Diagnostic" className="w-[170px]" />
                                <div className="text-right">
                                    <div className="text-base font-bold leading-tight" style={{ color: C.navy }}>
                                        PROPUESTA<br />TÉCNICO ECONÓMICA
                                    </div>
                                    <div className="mt-1 text-[10.5px] text-neutral-500">Medio Ambiente</div>
                                </div>
                            </div>
                            <div className="mt-4 border-t-[1.5px]" style={{ borderColor: C.navy }} />
                            <div className="mb-[22px] mt-[2.5px] border-t-[2.5px]" style={{ borderColor: C.orange }} />

                            {/* Datos de la propuesta */}
                            <dl className="grid grid-cols-[112px_1fr] gap-x-2 gap-y-[3.5px] text-[11px]">
                                <dt className="font-bold" style={{ color: C.navy }}>Código Propuesta</dt>
                                <dd>: MA-P<i className="not-italic text-neutral-500">(nuevo)</i>-{fmtDdmmyyyy(new Date())}-{(nombreClienteSel || '—').toUpperCase()}</dd>
                                <dt className="font-bold" style={{ color: C.navy }}>Señores</dt>
                                <dd>: {nombreClienteSel || <span className="text-neutral-400">Selecciona un cliente</span>}</dd>
                                <dt className="font-bold" style={{ color: C.navy }}>RUT</dt>
                                <dd>: {clienteConfig?.rut?.trim() || <span className="text-neutral-400">—</span>}</dd>
                                <dt className="font-bold" style={{ color: C.navy }}>Dirección</dt>
                                <dd>: {clienteConfig?.direccion?.trim() || <span className="text-neutral-400">—</span>}</dd>
                                <dt className="font-bold" style={{ color: C.navy }}>Fecha</dt>
                                <dd>: {fmtFechaLarga(new Date())}</dd>
                                {(clienteConfig?.contacto || '').trim() && (
                                    <>
                                        <dt className="font-bold" style={{ color: C.navy }}>Atención</dt>
                                        <dd>: {clienteConfig.contacto.trim()}</dd>
                                    </>
                                )}
                                {nombreCentroSel && (
                                    <>
                                        <dt className="font-bold" style={{ color: C.navy }}>Centro</dt>
                                        <dd>: {nombreCentroSel}</dd>
                                    </>
                                )}
                            </dl>

                            {/* Un bloque numerado por servicio, igual que la propuesta en Word */}
                            {items.length === 0 ? (
                                <>
                                    <h3 className="my-[22px] mb-2.5 text-[11.5px] font-bold tracking-wide" style={{ color: C.navy }}>
                                        1. {(secciones[0]?.titulo || glosaSel || 'SERVICIO DE MUESTREO Y ANÁLISIS').toUpperCase()}
                                    </h3>
                                    <div className="rounded-md border border-dashed border-neutral-300 py-7 text-center text-[11px] text-neutral-400">
                                        Los ítems que agregues aparecerán acá, con el precio real del convenio del cliente.
                                    </div>
                                </>
                            ) : (
                                secciones.filter((s) => s.items.length > 0).map((sec, idx, visibles) => {
                                    const subtotalSec = sec.items.reduce((a, it) => a + (it.precioUf || 0) * it.cantidad, 0);
                                    return (
                                        <div key={sec.key}>
                                            <h3 className="my-[22px] mb-2.5 text-[11.5px] font-bold tracking-wide" style={{ color: C.navy }}>
                                                {idx + 1}. {(sec.titulo || glosaSel || `SERVICIO ${idx + 1}`).toUpperCase()}
                                            </h3>
                                            <table className="w-full border-collapse text-[10.5px]">
                                                <thead>
                                                    <tr>
                                                        <th className="p-2 text-left text-[10px] font-bold" style={{ background: C.bandaTabla, color: C.navy }}>ÍTEM</th>
                                                        <th className="w-[130px] p-2 text-right text-[10px] font-bold" style={{ background: C.bandaTabla, color: C.navy }}>Valor Neto Unitario (UF)</th>
                                                        <th className="w-20 p-2 text-right text-[10px] font-bold" style={{ background: C.bandaTabla, color: C.navy }}>N° Muestras</th>
                                                        <th className="w-[100px] p-2 text-right text-[10px] font-bold" style={{ background: C.bandaTabla, color: C.navy }}>Valor Neto (UF)</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {sec.items.map((it) => (
                                                        <tr key={it.key}>
                                                            <td className="border-b border-neutral-200 p-2 align-top">{it.nombre_tecnica || <span className="text-neutral-400">(sin nombre)</span>}</td>
                                                            <td className="border-b border-neutral-200 p-2 text-right align-top tabular-nums">
                                                                {it.resolviendo ? '…' : it.precioUf != null ? fmtUf(it.precioUf) : <span className="text-destructive">Sin tarifa</span>}
                                                            </td>
                                                            <td className="border-b border-neutral-200 p-2 text-right align-top">{it.cantidad}</td>
                                                            <td className="border-b border-neutral-200 p-2 text-right align-top tabular-nums">
                                                                {it.resolviendo ? '…' : it.precioUf != null ? fmtUf(it.precioUf * it.cantidad) : '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {/* El subtotal por servicio solo aporta si hay más de uno */}
                                            {visibles.length > 1 && (
                                                <div className="mt-1.5 flex justify-end gap-4 text-[11px] font-bold" style={{ color: C.navy }}>
                                                    <span>Subtotal servicio U.F.:</span>
                                                    <span className="tabular-nums">{fmtUf(subtotalSec)}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}

                            {items.length > 0 && (
                                <>
                                    <div className="ml-auto mt-[18px] w-[290px]">
                                        <div className="mb-2 border-t-[1.5px]" style={{ borderColor: C.navy }} />
                                        <div className="flex justify-between py-0.5 text-[11px]"><span>Subtotal U.F.:</span><span className="tabular-nums">{fmtUf(subtotalUf)}</span></div>
                                        <div className="flex justify-between py-0.5 text-[11px] font-bold" style={{ color: C.navy }}>
                                            <span>TOTAL GENERAL U.F.:</span><span className="tabular-nums">{fmtUf(subtotalUf)}</span>
                                        </div>
                                        {valorUfHoy && (
                                            <>
                                                <div className="mt-2 flex justify-between py-0.5 text-[11px]"><span>TOTAL NETO $:</span><span className="tabular-nums">$ {fmtClp(netoClp)}</span></div>
                                                <div className="flex justify-between py-0.5 text-[11px]"><span>IVA (19%) $:</span><span className="tabular-nums">$ {fmtClp(ivaClp)}</span></div>
                                                <div className="flex justify-between py-0.5 text-[13px] font-bold" style={{ color: C.orange }}>
                                                    <span>TOTAL $:</span><span className="tabular-nums">$ {fmtClp(totalClp)}</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                    <p className="mt-3.5 text-[10px] italic leading-relaxed text-neutral-600">
                                        Valores expresados en UF.{valorUfHoy ? ` Conversión referencial con UF de $ ${fmtUf(valorUfHoy)}; se factura con la UF del día de facturación.` : ''}
                                    </p>
                                </>
                            )}

                            {/* Secciones fijas: su número va después de los
                                servicios (con dos servicios son la 3 y la 4) */}
                            <h3 className="my-[22px] mb-2.5 text-[11.5px] font-bold tracking-wide" style={{ color: C.navy }}>{nFijoPreview + 1}. ANTECEDENTES GENERALES</h3>
                            <ul className="m-0 list-none p-0 text-[10px] leading-relaxed text-black">
                                {ANTECEDENTES_GENERALES.map((t, i) => (
                                    <li key={i} className="mb-1.5 grid grid-cols-[16px_1fr] gap-x-1 text-justify">
                                        <span className="font-bold">{String.fromCharCode(97 + i)}.</span><span>{t}</span>
                                    </li>
                                ))}
                            </ul>

                            <h3 className="my-[22px] mb-2.5 text-[11.5px] font-bold tracking-wide" style={{ color: C.navy }}>{nFijoPreview + 2}. CONDICIONES GENERALES DEL SERVICIO</h3>

                            <h4 className="mb-1 mt-3.5 text-[11px] font-bold text-black">a. VALIDEZ DE LA PROPUESTA</h4>
                            <p className="text-[10px] leading-relaxed text-neutral-600">
                                La presente cotización tiene una validez de {vigenciaDiasSel} días a partir de la fecha de emisión
                                (hasta el {fmtFecha(fechaVigenciaPreview.toISOString())}).
                            </p>

                            <h4 className="mb-1 mt-3.5 text-[11px] font-bold text-black">b. DATOS EMPRESA</h4>
                            <p className="text-[10px] leading-relaxed text-neutral-600">
                                Nombre: Soc. ADL Diagnostic Chile SpA.<br />
                                Rut: 77.354.970-2<br />
                                Giro: Laboratorio<br />
                                Dirección: Sector la Vara S/N, Camino Alerce, Puerto Montt<br />
                                El depósito o transferencia debe realizarse a nombre de ADL Diagnostic Chile SpA., Cta. Cte. Nro. 63042975
                                Banco Crédito e Inversiones (BCI), Puerto Montt. Para validar el pago se deberá enviar copia del
                                comprobante respectivo a la Srta. Karina Rival a la casilla electrónica krival@adldiagnostic.cl
                            </p>

                            <h4 className="mb-1 mt-3.5 text-[11px] font-bold text-black">c. CONDICIONES DE PAGO</h4>
                            <p className="text-[10px] leading-relaxed text-neutral-600">
                                El pago se realizará a 30 días, con valor de UF al día de facturación y previa emisión de la
                                respectiva Orden de Compra a nombre de ADL Diagnostic Chile SpA.
                            </p>

                            <h4 className="mb-1 mt-3.5 text-[11px] font-bold text-black">d. NOTAS IMPORTANTES DEL SERVICIO</h4>
                            <ul className="m-0 list-none p-0 text-[10px] leading-relaxed text-black">
                                {NOTAS_IMPORTANTES.map((t, i) => (
                                    <li key={i} className="mb-1.5 grid grid-cols-[16px_1fr] gap-x-1 text-justify">
                                        <span className="font-bold">•</span><span>{t}</span>
                                    </li>
                                ))}
                            </ul>

                            {observacionesSel && (
                                <>
                                    <h4 className="mb-1 mt-3.5 text-[11px] font-bold text-black">e. OBSERVACIONES</h4>
                                    <p className="whitespace-pre-wrap text-[10px] leading-relaxed text-neutral-600">{observacionesSel}</p>
                                </>
                            )}

                            <div className="mt-[34px]">
                                <p className="mb-[34px]">Atentamente,</p>
                                <div className="w-[230px] border-t border-neutral-400" />
                                <div className="mt-[5px] text-[11.5px] font-bold" style={{ color: C.navy }}>Jefe Comercial Medio Ambiente</div>
                                <div className="text-[11px]">Soc. ADL Diagnostic Chile SpA.</div>
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
            { color: ESTADO_BADGE_VARIANT[seleccion.estado_unificado] === 'success' ? 'green' : ESTADO_BADGE_VARIANT[seleccion.estado_unificado] === 'destructive' ? 'red' : 'blue', children: <span><b>Estado actual:</b> {seleccion.estado_label}</span> },
        ];

        return (
            <div className="shadcn-scope w-full bg-background px-8 pb-14 pt-7">
                <div className="mb-7 flex flex-wrap items-center gap-3.5 border-b border-border pb-5">
                    <Button variant="outline" onClick={volverALista}><IconArrowLeft size={16} /> Volver a la bandeja</Button>
                    <div className="min-w-0 flex-1">
                        <div className="text-[17px] font-bold text-foreground">
                            {cotizacionDetalle ? `Cotización N° ${cotizacionDetalle.numero_cotizacion} — ` : ''}{seleccion.nombre_cliente}
                        </div>
                        <div className="text-sm text-muted-foreground">{seleccion.titulo || 'Sin título'}</div>
                    </div>
                    {cotizacionDetalle && (
                        <div className="mr-1 text-right">
                            <div className="text-[11px] uppercase text-muted-foreground">Total</div>
                            <div className="text-base font-bold text-primary">{fmtUf(cotizacionDetalle.total_uf)} UF</div>
                        </div>
                    )}
                    <Badge variant={ESTADO_BADGE_VARIANT[seleccion.estado_unificado] || 'secondary'} className="px-2.5 py-1 text-[12.5px]">
                        {seleccion.estado_label}
                    </Badge>
                    {cotizacionDetalle?.estado === 'ACEPTADA' && (
                        <Button
                            title={cotizacionDetalle.fecha_convertida_ficha
                                ? `Ya se generó trabajo desde esta cotización el ${fmtFecha(cotizacionDetalle.fecha_convertida_ficha)}. Puedes crear otra ficha si hace falta.`
                                : 'Abre el formulario de ficha con el cliente, el centro y los análisis cotizados ya cargados'}
                            disabled={accionLoading === 'FICHA'}
                            onClick={crearFichaDesdeCotizacion}
                        >
                            {accionLoading === 'FICHA' ? <Spinner className="h-4 w-4 border-primary-foreground/40 border-t-transparent" /> : <IconClipboardPlus size={15} />}
                            {cotizacionDetalle.fecha_convertida_ficha ? 'Crear otra ficha' : 'Crear ficha'}
                        </Button>
                    )}
                    {cotizacionDetalle && (
                        <Button
                            variant="outline"
                            title="Ver la Propuesta Técnico Económica"
                            disabled={accionLoading === 'PDF'}
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
                            {accionLoading === 'PDF' ? <Spinner className="h-4 w-4" /> : <IconFileTypePdf size={15} />}
                            PDF
                        </Button>
                    )}
                    {puedeGestionarCotizacion && (
                        <div className="flex items-center gap-2">
                            {cotizacionDetalle.estado === 'BORRADOR' && !cotizacionDetalle.portal_publicado && (
                                <Button
                                    title="Genera el PDF y se lo entrega al cliente en su portal (ADL WEB GO); pasa a Enviada."
                                    disabled={publicando}
                                    onClick={enviarCotizacionAlCliente}
                                >
                                    {publicando ? <Spinner className="h-4 w-4 border-primary-foreground/40 border-t-transparent" /> : <IconWorldUpload size={14} />}
                                    Enviar cotización al cliente
                                </Button>
                            )}
                            <Button variant="outline" disabled={accionLoading === 'ACEPTADA'} onClick={() => cambiarEstado('ACEPTADA')}>
                                {accionLoading === 'ACEPTADA' ? <Spinner className="h-4 w-4" /> : <IconCircleCheck size={14} />} Aceptada
                            </Button>
                            <Button variant="destructive" disabled={accionLoading === 'RECHAZADA'} onClick={() => cambiarEstado('RECHAZADA')}>
                                {accionLoading === 'RECHAZADA' ? <Spinner className="h-4 w-4 border-white/40 border-t-transparent" /> : <IconCircleX size={14} />} Rechazada
                            </Button>
                        </div>
                    )}
                </div>

                {detalleLoading ? (
                    <div className="flex justify-center py-16"><Spinner /></div>
                ) : (
                    <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_360px] lg:gap-9">
                        {/* Columna izquierda: datos / ítems / cotización */}
                        <div>
                            {seleccion.origen === 'PORTAL' && solicitudDetalle && (
                                <div className="mb-5 rounded-xl border border-border bg-card">
                                    <button
                                        type="button"
                                        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                                        onClick={() => setSolicitudAbierta((v) => !v)}
                                    >
                                        <span className="text-[13px] font-semibold text-foreground">Solicitud original del cliente</span>
                                        <IconChevronDown size={16} className={cn('shrink-0 text-muted-foreground transition-transform', solicitudAbierta && 'rotate-180')} />
                                    </button>
                                    {solicitudAbierta && (
                                        <div className="px-4 pb-4">
                                            {!solicitudDetalle.id_empresaservicio && (
                                                <Badge variant="warning" className="mb-2.5">
                                                    Cliente no resuelto — {solicitudDetalle.nombre_cliente_portal || 'sin nombre'}
                                                </Badge>
                                            )}
                                            {(solicitudDetalle.solicitante_nombre || solicitudDetalle.solicitante_email) && (
                                                <div className="mb-3 text-sm leading-relaxed text-muted-foreground">
                                                    Enviada por <b className="text-foreground">{solicitudDetalle.solicitante_nombre || '—'}</b>
                                                    {solicitudDetalle.solicitante_email && (
                                                        <> · <a href={`mailto:${solicitudDetalle.solicitante_email}`} className="text-primary hover:underline">{solicitudDetalle.solicitante_email}</a></>
                                                    )}
                                                    {' · '}{fmtFechaHora(solicitudDetalle.fecha_creacion)}
                                                </div>
                                            )}
                                            {solicitudDetalle.descripcion && (
                                                <p className="mb-2.5 whitespace-pre-wrap text-sm text-foreground">{solicitudDetalle.descripcion}</p>
                                            )}
                                            {solicitudDetalle.items?.length > 0 && (
                                                <ul className="m-0 list-disc pl-[18px] text-sm text-foreground">
                                                    {solicitudDetalle.items.map((it: any, i: number) => (
                                                        <li key={i}><b>{it.cantidad}×</b> {it.descripcion}</li>
                                                    ))}
                                                </ul>
                                            )}
                                            {adjuntos.length > 0 && (
                                                <div className="mt-3.5">
                                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Archivos ({adjuntos.length})</p>
                                                    <div className="flex flex-col gap-2">
                                                        {adjuntos.map((a: any) => {
                                                            const t = tipoArchivo(a.nombre_original, a.mime);
                                                            return (
                                                                <button
                                                                    key={a.id}
                                                                    type="button"
                                                                    className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition-colors hover:border-primary hover:bg-primary/5"
                                                                    onClick={() => bajarAdjunto(seleccion.id_solicitud_portal!, a)}
                                                                >
                                                                    <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md" style={{ background: t.fondo, color: t.color }}>
                                                                        <t.Icono size={17} />
                                                                    </span>
                                                                    <span className="min-w-0 flex-1 text-left">
                                                                        <span className="block truncate text-sm font-medium text-foreground">{a.nombre_original}</span>
                                                                        <span className="block text-[11.5px] text-muted-foreground">
                                                                            {t.etiqueta}{a.tamano_bytes ? ` · ${fmtTamano(a.tamano_bytes)}` : ''}
                                                                            {a.origen === 'ADL_ONE' ? ' · enviado por ADL' : ''}
                                                                        </span>
                                                                    </span>
                                                                    <IconDownload size={15} className="shrink-0 text-muted-foreground" />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {!cotizacionDetalle ? (
                                <div className="mb-5 rounded-xl border border-border bg-card p-12 text-center">
                                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                                        <IconInbox size={22} />
                                    </div>
                                    <p className="text-sm text-muted-foreground">Todavía no se ha armado la cotización real para esta solicitud.</p>
                                    <Button className="mt-4" onClick={() => abrirCreacion(solicitudDetalle || seleccion)}>
                                        <IconPlus size={16} /> Armar cotización
                                    </Button>
                                </div>
                            ) : (
                                <div className="mb-5 rounded-xl border border-border bg-card p-6">
                                    {/* Metadatos en una línea, no en una tabla de etiquetas — menos ruido visual */}
                                    <div className="mb-[22px] flex flex-wrap gap-[22px] text-sm text-muted-foreground">
                                        <span>Vigente hasta <b className="text-foreground">{fmtFecha(cotizacionDetalle.fecha_vigencia)}</b></span>
                                        <span>UF <b className="text-foreground">{fmtUf(cotizacionDetalle.valor_uf)}</b></span>
                                    </div>
                                    {cotizacionDetalle.observaciones && (
                                        <p className="mb-[22px] whitespace-pre-wrap text-sm text-muted-foreground">{cotizacionDetalle.observaciones}</p>
                                    )}

                                    {/* Una tabla por servicio: la cotización puede
                                        traer varias glosas, cada una con sus ítems. */}
                                    {seccionesDetalle.map((sec: any, idx: number) => (
                                        <div key={sec.id_seccion ?? idx} className="mb-[18px]">
                                            {seccionesDetalle.length > 1 && (
                                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    {idx + 1}. {sec.titulo || `Servicio ${idx + 1}`}
                                                </p>
                                            )}
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead>Ítem</TableHead>
                                                        <TableHead className="w-[60px] text-right">Cant.</TableHead>
                                                        <TableHead className="w-[120px] text-right">P. Unit. UF</TableHead>
                                                        <TableHead className="w-[90px] text-right">Subtotal</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {(sec.items || []).map((it: any) => (
                                                        <TableRow key={it.id_item} className="hover:bg-transparent">
                                                            <TableCell>{it.descripcion || `Técnica #${it.id_tecnica}`}</TableCell>
                                                            <TableCell className="text-right">{it.cantidad}</TableCell>
                                                            <TableCell className="text-right">
                                                                {precioEditable ? (
                                                                    <Input
                                                                        type="number" min={0} step={0.01}
                                                                        className={cn('h-8 w-[100px] text-right', it.precio_unitario_uf == null && 'border-warning')}
                                                                        placeholder="Sin tarifa"
                                                                        defaultValue={it.precio_unitario_uf == null ? '' : Number(it.precio_unitario_uf)}
                                                                        disabled={precioGuardando === it.id_item}
                                                                        onBlur={(e) => guardarPrecioItem(it, e.currentTarget.value)}
                                                                        onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                                                                    />
                                                                ) : (it.precio_unitario_uf != null ? fmtUf(it.precio_unitario_uf) : <Badge variant="destructive">Sin tarifa</Badge>)}
                                                            </TableCell>
                                                            <TableCell className="text-right">{it.precio_total_uf == null ? '—' : fmtUf(it.precio_total_uf)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                            {seccionesDetalle.length > 1 && (
                                                <div className="mt-1.5 text-right text-[12.5px] text-muted-foreground">
                                                    Subtotal servicio: <b className="text-foreground">{fmtUf(sec.subtotal_uf)} UF</b>
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {precioEditable && (cotizacionDetalle.items || []).some((i: any) => i.precio_unitario_uf == null) && (
                                        <InlineAlert tone="warning" title="Hay ítems sin tarifa en el convenio"
                                            description="Escribe el valor unitario en UF directamente en la tabla; queda guardado como precio manual y se recalculan los totales." />
                                    )}

                                    <div className="flex justify-end gap-6 text-sm text-muted-foreground">
                                        <span>Neto: <b className="text-foreground">$ {fmtClp(cotizacionDetalle.neto_clp)}</b></span>
                                        <span>IVA: <b className="text-foreground">$ {fmtClp(cotizacionDetalle.iva_clp)}</b></span>
                                        <span>Total: <b className="text-primary">$ {fmtClp(cotizacionDetalle.total_clp)}</b></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Columna derecha: comunicación y actividad (fija) */}
                        <div
                            className="sticky top-5 flex flex-col overflow-hidden rounded-xl border border-border bg-card"
                            style={{ height: 'calc(100vh - 190px)', minHeight: 460 }}
                        >
                            <Tabs value={rightTab} onValueChange={setRightTab} className="flex h-full flex-col">
                                <TabsList className="mx-3 mt-3 shrink-0 justify-center">
                                    {seleccion.origen === 'PORTAL' && (
                                        <TabsTrigger value="mensajes"><IconMessageCircle2 size={14} className="mr-1.5" />Mensajes</TabsTrigger>
                                    )}
                                    <TabsTrigger value="historial">Historial</TabsTrigger>
                                </TabsList>

                                {seleccion.origen === 'PORTAL' && (
                                    <TabsContent value="mensajes" className="m-0 flex min-h-0 flex-1 flex-col">
                                        <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-4">
                                            {mensajesLoading ? (
                                                <div className="flex justify-center py-7"><Spinner /></div>
                                            ) : mensajes.length === 0 ? (
                                                <p className="my-5 text-center text-sm text-muted-foreground">Aún no hay mensajes. Escribe el primero.</p>
                                            ) : (
                                                mensajes.map((m) => {
                                                    const esNuestro = m.origen === 'ADL_ONE' || m.usuario_nombre === 'Facturación ADL ONE';
                                                    const adjuntosMsg = adjuntos.filter((a: any) => a.id_mensaje === m.id);
                                                    if (m.es_sistema) {
                                                        return (
                                                            <div key={m.id} className="self-center px-1 py-0.5 text-center text-[11.5px] italic text-muted-foreground">
                                                                {m.mensaje}
                                                            </div>
                                                        );
                                                    }
                                                    return (
                                                        <div
                                                            key={m.id}
                                                            className={cn(
                                                                'max-w-[82%] rounded-lg px-3 py-2 text-[13px] leading-snug',
                                                                esNuestro ? 'self-end bg-primary text-primary-foreground' : 'self-start border border-border bg-background text-foreground'
                                                            )}
                                                        >
                                                            <div className="mb-0.5 text-[10.5px] font-semibold opacity-75">
                                                                {m.usuario_nombre}{m.usuario_email ? ` · ${m.usuario_email}` : ''}
                                                            </div>
                                                            {m.mensaje}
                                                            {adjuntosMsg.map((a: any) => (
                                                                <button
                                                                    key={a.id}
                                                                    type="button"
                                                                    onClick={() => bajarAdjunto(seleccion.id_solicitud_portal!, a)}
                                                                    className={cn('mt-1.5 flex items-center gap-1.5 text-[11.5px] underline', esNuestro ? 'text-primary-foreground' : 'text-primary')}
                                                                >
                                                                    <IconPaperclip size={12} />{a.nombre_original}
                                                                </button>
                                                            ))}
                                                            <div className="mt-1 text-[10px] opacity-60">{fmtFechaHora(m.fecha)}</div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                            <div ref={finChatRef} />
                                        </div>

                                        <div className="shrink-0 border-t border-border p-3">
                                            {archivosAdjuntar.length > 0 && (
                                                <div className="mb-2 flex flex-wrap gap-1.5">
                                                    {archivosAdjuntar.map((f, i) => (
                                                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                                                            {f.name} ({fmtTamano(f.size)})
                                                            <button type="button" onClick={() => setArchivosAdjuntar((p) => p.filter((_, idx) => idx !== i))} className="rounded-full p-0.5 hover:bg-black/10">
                                                                <IconX size={11} />
                                                            </button>
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        setArchivosAdjuntar((p) => [...p, ...Array.from(e.target.files || [])]);
                                                        e.target.value = '';
                                                    }}
                                                />
                                                <Button variant="outline" size="icon" title="Adjuntar archivos (Word, PDF, imágenes...)" onClick={() => fileInputRef.current?.click()}>
                                                    <IconPaperclip size={15} />
                                                </Button>
                                                <Input
                                                    placeholder="Escribe un mensaje al cliente..."
                                                    value={mensajeNuevo}
                                                    onChange={(e) => setMensajeNuevo(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') enviarMensaje(); }}
                                                    disabled={enviandoMensaje}
                                                />
                                                <Button
                                                    size="icon"
                                                    disabled={enviandoMensaje || (!mensajeNuevo.trim() && archivosAdjuntar.length === 0)}
                                                    onClick={enviarMensaje}
                                                >
                                                    {enviandoMensaje ? <Spinner className="h-4 w-4 border-primary-foreground/40 border-t-transparent" /> : <IconSend2 size={14} />}
                                                </Button>
                                            </div>
                                        </div>
                                    </TabsContent>
                                )}

                                <TabsContent value="historial" className="m-0 min-h-0 flex-1 overflow-y-auto px-5 py-5">
                                    <HistorialTimeline items={historialItems} />
                                </TabsContent>
                            </Tabs>
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

    const bandejaPaginada = bandeja.slice((bandejaPage - 1) * BANDEJA_PAGE_SIZE, bandejaPage * BANDEJA_PAGE_SIZE);

    return (
        <div className="shadcn-scope w-full bg-background px-8 pb-14 pt-7">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold tracking-tight text-foreground">Cotizaciones</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Solicitudes de clientes y cotizaciones armadas — todo en una sola bandeja.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={cargarBandeja}><IconRefresh size={16} /> Actualizar</Button>
                    <Button onClick={() => abrirCreacion()}><IconPlus size={16} /> Nueva cotización</Button>
                </div>
            </div>

            <div className="mb-5 flex flex-wrap items-center gap-4">
                <Combobox
                    className="w-[220px]"
                    placeholder="Filtrar por estado"
                    searchPlaceholder="Buscar estado..."
                    value={filtroEstado ?? ''}
                    onValueChange={(v) => setFiltroEstado(v || undefined)}
                    options={[{ value: '', label: 'Todos los estados' }, ...Object.entries(ESTADO_LABEL).map(([value, label]) => ({ value, label }))]}
                />
                <div className="flex items-center gap-1.5">
                    <Switch checked={filtroNoLeidos} onCheckedChange={setFiltroNoLeidos} />
                    <span className="text-sm text-muted-foreground">Solo con mensajes nuevos</span>
                </div>
            </div>

            {bandejaLoading ? (
                <div className="flex justify-center py-16"><Spinner /></div>
            ) : bandeja.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
                    <IconInbox size={36} className="opacity-50" />
                    <p className="text-sm">No hay nada con ese filtro.</p>
                </div>
            ) : (
                <>
                    <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-2" />
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Título / Glosa</TableHead>
                                    <TableHead className="w-[170px]">Estado</TableHead>
                                    <TableHead>Último mensaje</TableHead>
                                    <TableHead className="w-[130px] text-right">Total</TableHead>
                                    <TableHead className="w-[150px]">Actualizada</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bandejaPaginada.map((r) => (
                                    <TableRow
                                        key={`${r.origen}-${r.id_solicitud_portal ?? r.id_cotizacion}`}
                                        className={cn('cursor-pointer', r.tiene_mensaje_nuevo && 'font-semibold')}
                                        onClick={() => abrirDetalle(r)}
                                    >
                                        <TableCell>{r.tiene_mensaje_nuevo ? <span className="block h-2 w-2 rounded-full bg-primary" /> : null}</TableCell>
                                        <TableCell className="max-w-[220px] truncate">{r.nombre_cliente}</TableCell>
                                        <TableCell className="max-w-[260px] truncate">{r.titulo || <span className="font-normal text-muted-foreground">—</span>}</TableCell>
                                        <TableCell>
                                            <Badge variant={ESTADO_BADGE_VARIANT[r.estado_unificado] || 'secondary'}>{r.estado_label}</Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[280px] truncate font-normal">
                                            {r.ultimo_mensaje_texto ? (
                                                <span>
                                                    <span className="text-[11.5px] text-muted-foreground">{r.ultimo_mensaje_autor === 'ADL_ONE' ? 'Tú: ' : 'Cliente: '}</span>
                                                    {r.ultimo_mensaje_texto}
                                                </span>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right font-normal">
                                            {r.total_uf ? (
                                                <span className="tabular-nums">
                                                    {fmtUf(r.total_uf)} UF<br /><span className="text-[11px] text-muted-foreground">$ {fmtClp(r.total_clp || 0)}</span>
                                                </span>
                                            ) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap font-normal text-muted-foreground">{fmtFechaHora(r.fecha_actualizacion)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="mt-4">
                        <DataPagination page={bandejaPage} pageSize={BANDEJA_PAGE_SIZE} total={bandeja.length} onPageChange={setBandejaPage} />
                    </div>
                </>
            )}
        </div>
    );
};

export default FacturacionCotizaciones;
