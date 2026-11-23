import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatearFechaHoraCorta } from '@/lib/fechas';
import { IconDownload, IconEye, IconInfoCircle, IconCalendarEvent, IconChecks, IconPlus, IconTrash, IconDeviceFloppy, IconCircleCheck, IconFileText, IconBan, IconAlertTriangle, IconDeviceMobile, IconSend } from '@tabler/icons-react';
import { VistaPreviaPdf } from './VistaPreviaPdf';
import { PuestasMarchaEquipo } from './PuestasMarchaEquipo';
import { CampoFirma, type CampoFirmaHandle } from './CampoFirma';
import { FirmaCelularDialog, type SlotFirma } from './FirmaCelularDialog';
import { fichaFirmaService } from '../services/fichaFirma.service';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from '@/components/ui/select';
import { firmaUsuarioService } from '../../../services/firmaUsuario.service';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useNavStore } from '../../../store/navStore';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import PdfViewerModal from '../../facturacion/components/PdfViewerModal';
import { equipoService, type Equipo } from '../services/equipo.service';
import {
    fichasEquipoService as api,
    ITEMS_RECEPCION,
    type DatosFichaEntrega,
    type DatosFichaRecepcion,
    type DatosFichaTecnica,
    type EventoRecepcion,
    type HistorialAnios,
    type ItemRecepcion,
    type PdfGenerado,
    type RegistroFichaTecnica,
    type FichaGuardada,
    type ResponsableEntrega,
} from '../services/fichasEquipo.service';

export type TipoFichaEquipo = 'tecnica' | 'historial' | 'entrega' | 'recepcion';

const FICHAS_EQUIPO: Record<TipoFichaEquipo, { codigo: string; titulo: string; descripcion: string }> = {
    tecnica: { codigo: 'OI-FoGe-22', titulo: 'Ficha técnica', descripcion: 'Datos del equipo con sus calibraciones y mantenciones.' },
    historial: { codigo: 'OI-FoGe-24', titulo: 'Historial por año', descripcion: 'Las observaciones del equipo de un año.' },
    entrega: { codigo: 'OI-FoGe-36', titulo: 'Ficha de entrega', descripcion: 'Acta de entrega del equipo a su responsable.' },
    recepcion: { codigo: 'OI-FoGe-42', titulo: 'Recepción, puesta en marcha y verificación', descripcion: 'Revisión del equipo al llegar: caja, contenido, encendido y verificación.' },
};

// Secciones del OI-FoGe-42, en el orden del formato.
const SECCIONES_RECEPCION: { titulo: string; items: { clave: ItemRecepcion; label: string }[] }[] = [
    { titulo: 'Recepción de equipo', items: [{ clave: 'caja', label: 'Condición de caja' }, { clave: 'embalaje', label: 'Condición de embalaje' }] },
    { titulo: 'Contenido caja', items: [{ clave: 'manual', label: 'Contiene manual' }, { clave: 'cable', label: 'Contiene cable alimentación' }, { clave: 'accesorios', label: 'Contiene accesorios' }] },
    { titulo: 'Puesta en marcha', items: [{ clave: 'interruptor', label: 'Condición interruptor' }, { clave: 'comandos', label: 'Condición de comandos' }, { clave: 'encendido', label: 'Encendido' }] },
];

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Qué ítems de "Puesta en marcha" aplican según el tipo de equipo:
//   pasivo      baterías, sondas, cables, filtros, disco Secchi… (sin interruptor ni encendido)
//   electronico medidores, GPS, muestreadores, termómetros… (se encienden)
//   desconocido no se supone nada
type PerfilEquipo = 'pasivo' | 'electronico' | 'desconocido';
const perfilEquipo = (nombre: string): PerfilEquipo => {
    const n = sinTildes(nombre || '');
    if (/^sonda|termocupla/.test(n)) return 'pasivo';
    if (/cargador|refrigerador|medidor|gps|muestreador|multiparametro|termometro|tester|power pack/.test(n)) return 'electronico';
    if (/bateria|botella|cable|disco|draga|filtro|malla|pedestal|tamiz|tomador|huinche|pozometro|molinete/.test(n)) return 'pasivo';
    return 'desconocido';
};
const SIN_ENCENDIDO: ItemRecepcion[] = ['cable', 'interruptor', 'comandos', 'encendido'];

const recepcionDesdeEquipo = (e: Partial<Equipo>, quienRecibe: string): DatosFichaRecepcion => {
    const pasivo = perfilEquipo(e.nombre || '') === 'pasivo';
    const na = (clave: ItemRecepcion) => (pasivo && SIN_ENCENDIDO.includes(clave) ? 'No Aplica' : '');
    return {
        nombre: e.nombre || '',
        codigo: e.codigo || '',
        marca: e.marca || '',
        modelo: e.modelo || '',
        serie: e.n_serie || '',
        fecha: hoy(),
        recepcion: true,
        puesta_marcha: true,
        verificacion: false,
        caja: '', embalaje: '', manual: '', accesorios: '',
        cable: na('cable'), interruptor: na('interruptor'), comandos: na('comandos'), encendido: na('encendido'),
        otros: '',
        estado_recepcion: '',
        funcionamiento: '',
        patron_referencia: '',
        observaciones: '',
        firma_recepcion: quienRecibe,
        firma_calidad: '',
    };
};

/**
 * Completa el formulario con un evento (o lo deja como recepción nueva de hoy
 * con `ev` null). Solo toca lo que sale del evento; caja, embalaje y contenido
 * quedan como estén.
 */
const aplicarEvento = (d: DatosFichaRecepcion, ev: EventoRecepcion | null, quienRecibe: string): DatosFichaRecepcion => {
    const perfil = perfilEquipo(d.nombre);
    // Puesta en marcha registrada sin falla = el equipo encendió y respondió.
    const encendio = !!ev?.puesta_marcha && !ev.falla && perfil === 'electronico';
    const marcha = (clave: 'interruptor' | 'comandos' | 'encendido') => {
        if (perfil === 'pasivo') return 'No Aplica';
        return encendio ? ITEMS_RECEPCION[clave][0] : '';
    };
    return {
        ...d,
        fecha: ev?.fecha || hoy(),
        recepcion: ev ? ev.recepcion : true,
        puesta_marcha: ev ? ev.puesta_marcha : true,
        verificacion: ev ? ev.verificacion : false,
        interruptor: marcha('interruptor'),
        comandos: marcha('comandos'),
        encendido: marcha('encendido'),
        estado_recepcion: ev && (ev.recepcion || ev.puesta_marcha) ? (ev.falla ? 'No Cumple' : 'Cumple') : '',
        // Si la recepción cumple, el equipo queda operativo (se puede cambiar).
        funcionamiento: ev && (ev.recepcion || ev.puesta_marcha) ? (ev.falla ? 'No Operativo' : 'Operativo') : '',
        patron_referencia: ev?.patron_referencia || '',
        observaciones: ev?.texto || '',
        firma_recepcion: ev?.firmante || quienRecibe,
    };
};


interface Props {
    tipo: TipoFichaEquipo | null;
    /** Equipo guardado. Sin id solo se puede la ficha de entrega (equipo en creación). */
    idEquipo?: number | null;
    /** Datos que ya se tienen (fila de la lista o el formulario en curso). */
    equipo?: Partial<Equipo> | null;
    onClose: () => void;
}

const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const soloFecha = (v?: string | null) => {
    if (!v) return '';
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
};
// "2025-03-14" + n meses (mismo día o el último del mes).
const sumarMeses = (ymd: string, meses: number) => {
    const [y, m, d] = ymd.split('-').map(Number);
    if (!y || !m || !d) return '';
    const objetivo = new Date(Date.UTC(y, m - 1 + meses, 1));
    const ultimo = new Date(Date.UTC(objetivo.getUTCFullYear(), objetivo.getUTCMonth() + 1, 0)).getUTCDate();
    objetivo.setUTCDate(Math.min(d, ultimo));
    return objetivo.toISOString().slice(0, 10);
};
// Empresas que prestan el servicio (calibración de T°: CESMEC, antes DTS; mantención anual: Geodex, antes SEICO).
// Empresas del servicio: calibración de temperatura CESMEC (antes DTS); mantención anual Geodex (antes SEICO).
const INSTITUCIONES_SERVICIO = [
    { grupo: 'Calibración', empresas: ['CESMEC', 'DTS'] },
    { grupo: 'Mantención', empresas: ['Geodex', 'SEICO'] },
];
// Observaciones de cada fila: normalmente se tarja (una línea), pero se puede escribir.
const OBSERVACION_TARJADA = '------------------------------';
// manualCal / manualMan: la próxima se escribió a mano (ya no se recalcula).
type FilaTecnica = RegistroFichaTecnica & { manualCal?: boolean; manualMan?: boolean };
let idFila = 0;

// Borrador: lo que se va llenando queda en este navegador hasta guardar la ficha.
const claveBorrador = (tipo: string, idEquipo?: number | null) => `adlone:borrador-ficha:${tipo}:${idEquipo ?? 'nuevo'}`;
const leerBorrador = (clave: string) => {
    try { const v = localStorage.getItem(clave); return v ? JSON.parse(v) : null; } catch { return null; }
};
const escribirBorrador = (clave: string, valor: string | null) => {
    try { if (valor === null) localStorage.removeItem(clave); else localStorage.setItem(clave, valor); } catch { /* sin almacenamiento */ }
};
// Hora guardada por la base (hora local de Chile): se muestra tal cual, sin convertir de zona.
const fechaHora = (v: string) => formatearFechaHoraCorta(v);

const pesos = (v?: number | string | null) => {
    const n = Number(v);
    return v === null || v === undefined || v === '' || Number.isNaN(n) || n === 0 ? '' : `$ ${n.toLocaleString('es-CL')}`;
};
const esFactura = (doc?: string | null) => !doc || /^(fc|fac|factura)/i.test(doc.trim());

const entregaDesdeEquipo = (e: Partial<Equipo>, responsableEntrega: string): DatosFichaEntrega => ({
    nombre: e.nombre || '',
    marca: e.marca || '',
    modelo: e.modelo || '',
    serie: e.n_serie || '',
    codigo: e.codigo || '',
    proveedor: e.proveedor || '',
    // El inventario guarda factura u orden de compra: si no es factura se indica cuál es.
    n_factura: e.n_documento_compra ? (esFactura(e.documento_compra) ? e.n_documento_compra : `${e.documento_compra} ${e.n_documento_compra}`) : '',
    fecha_factura: esFactura(e.documento_compra) ? soloFecha(e.fecha_compra) : '',
    valor: pesos(e.valor_unitario),
    frecuencia_mantencion: 'No aplica',
    fecha_adquisicion: soloFecha(e.fecha_compra),
    area: 'Medio Ambiente',
    seccion: 'No aplica',
    responsable_equipo: e.nombre_asignado || '',
    fecha_recepcion: '',
    observaciones: '',
    responsable_entrega: responsableEntrega,
    responsable_area: '',
    fecha_entrega: hoy(),
});

// «Se registra» se marca solo a medida que se llenan los datos de cada parte (nunca se desmarca solo).
const ITEMS_DE_RECEPCION: ItemRecepcion[] = ['caja', 'embalaje', 'manual', 'cable', 'accesorios'];
const ITEMS_DE_PUESTA: ItemRecepcion[] = ['interruptor', 'comandos', 'encendido'];
const conRegistro = (r: DatosFichaRecepcion): DatosFichaRecepcion => ({
    ...r,
    recepcion: r.recepcion || ITEMS_DE_RECEPCION.some((c) => !!r[c]) || !!r.estado_recepcion,
    puesta_marcha: r.puesta_marcha || ITEMS_DE_PUESTA.some((c) => !!r[c]),
    verificacion: r.verificacion || !!r.funcionamiento || !!r.patron_referencia.trim(),
});
const BUFFERS_PATRON = ['Buffer 4.0', 'Buffer 7.0', 'Buffer 10.0'];

const Campo: React.FC<{ label: string; className?: string; children: React.ReactNode; ayuda?: string }> = ({ label, className, children, ayuda }) => (
    <label className={cn('flex flex-col gap-1.5', className)}>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {children}
        {ayuda && <span className="text-[11px] text-muted-foreground">{ayuda}</span>}
    </label>
);

// Lista para elegir quién es responsable de entrega o de área: solo las personas registradas del área.
const ListaResponsables: React.FC<{ label: string; valor: string; lista: ResponsableEntrega[]; onCambio: (nombre: string) => void }> = ({ label, valor, lista, onCambio }) => (
    <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Select value={valor || undefined} onValueChange={onCambio}>
            <SelectTrigger><SelectValue placeholder="Seleccione la persona" /></SelectTrigger>
            <SelectContent>
                {lista.map((r) => (
                    <SelectItem key={r.id_usuario} value={r.nombre}>
                        {r.nombre}{r.cargo ? ` · ${r.cargo}` : ''}{r.tiene_firma ? ' · con firma registrada' : ''}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    </div>
);

/**
 * Genera los formularios del equipo en PDF (OI-FoGe-22 / 24 / 36). Antes de
 * generar se ven y se pueden ajustar los datos que van en la hoja; generar no
 * modifica el equipo.
 */
export const FichasEquipoDialog: React.FC<Props> = ({ tipo, idEquipo, equipo, onClose }) => {
    const { showToast } = useToast();
    const { user, hasPermission } = useAuth();
    const { setPmRecepcionEquipoId, setActiveModule, setActiveSubmodule } = useNavStore();
    // Ficha de entrega firmada por quien recibe: la recepción quedó en el historial y corresponde la Puesta en Marcha por recepción.
    const [pmRecepcion, setPmRecepcion] = useState(false);
    const irAPmRecepcion = () => {
        if (!idEquipo) return;
        setPmRecepcionEquipoId(idEquipo);
        setActiveModule('gestion_calidad');
        setActiveSubmodule('gc-puesta-marcha');
        onClose();
    };
    // Anular una ficha guardada: quien edita equipos o tiene G. Calidad > Equipos.
    const puedeAnular = hasPermission('AI_MA_EDITAR_EQUIPO') || hasPermission('GC_EQUIPOS');
    const [cargando, setCargando] = useState(false);
    // La vista previa al lado solo en pantallas anchas (en angostas, botón «Vista previa»).
    const pantallaAncha = useMediaQuery('(min-width: 1024px)');
    const [generando, setGenerando] = useState<'ver' | 'bajar' | null>(null);
    const [pdf, setPdf] = useState<(PdfGenerado & { titulo: string }) | null>(null);

    // Historial
    const [historial, setHistorial] = useState<HistorialAnios | null>(null);
    const [anio, setAnio] = useState<number | null>(null);
    // Nueva observación desde el historial (se agrega a la observación del equipo).
    const [nuevaObs, setNuevaObs] = useState<{ fecha: string; texto: string }>({ fecha: '', texto: '' });
    const [agregandoObs, setAgregandoObs] = useState(false);
    // Años agregados con «+ Año» que todavía no tienen observaciones (ej. 2026).
    const [aniosExtra, setAniosExtra] = useState<number[]>([]);
    const [nuevoAnio, setNuevoAnio] = useState<string | null>(null);
    // Ficha técnica
    const [tecnica, setTecnica] = useState<DatosFichaTecnica | null>(null);
    const [autorizados, setAutorizados] = useState('');
    // Calibraciones y mantenciones: se escriben a mano (no salen del historial del equipo).
    const [filas, setFilas] = useState<FilaTecnica[]>([]);
    // Firma guardada de quien llena la ficha (se registra en el perfil).
    const [miFirma, setMiFirma] = useState<string | null>(null);
    // Firmas de la ficha de entrega: quien recibe, quien entrega y responsable de área.
    // Firmas del formulario de recepción: Área Técnica (guardada o dibujada) y Gestión de Calidad.
    const [firmasRecepcion, setFirmasRecepcion] = useState<{ recepcion: string | null; usarMiFirma: boolean; calidad: string | null }>(
        { recepcion: null, usarMiFirma: false, calidad: null });
    const [firmasEntrega, setFirmasEntrega] = useState<{ equipo: string | null; entrega: string | null; usarMiFirma: boolean; area: string | null }>(
        { equipo: null, entrega: null, usarMiFirma: false, area: null });
    // Firmas de la columna FIRMA: se marcan las que van (quien llena, Pablo Flores,
    // Mario Jofré); cada una usa su firma guardada o se dibuja en el momento.
    const [firmasSel, setFirmasSel] = useState<Record<number, { imagen: string | null; usarGuardada: boolean }>>({});
    // Firmar con el celular (QR): cada campo de firma se registra acá para poder ponerle la firma que llega.
    const firmaRefs = useRef<Record<string, CampoFirmaHandle | null>>({});
    const [celularAbierto, setCelularAbierto] = useState(false);
    // Enviar la ficha de entrega a firmar: primero se revisa y se confirma.
    const [envioAbierto, setEnvioAbierto] = useState(false);
    const [revisada, setRevisada] = useState(false);
    const [enviando, setEnviando] = useState(false);
    // Entrega
    const [entrega, setEntrega] = useState<DatosFichaEntrega | null>(null);
    // Quiénes pueden ser responsable de entrega y responsable de área (usuarios registrados de la web).
    const [responsablesEnt, setResponsablesEnt] = useState<ResponsableEntrega[]>([]);
    // Recepción
    const [recepcion, setRecepcion] = useState<DatosFichaRecepcion | null>(null);

    // Guardado de la ficha y fichas ya guardadas de este equipo.
    const [guardada, setGuardada] = useState<{ id_ficha: number; fecha_creacion: string } | null>(null);
    const [guardando, setGuardando] = useState(false);
    const [guardadas, setGuardadas] = useState<FichaGuardada[]>([]);
    // Anulación de una ficha guardada (con motivo) y aviso cuando ya hay una vigente igual.
    const [aAnular, setAAnular] = useState<FichaGuardada | null>(null);
    const [motivoAnular, setMotivoAnular] = useState('');
    const [anulando, setAnulando] = useState(false);
    const [duplicada, setDuplicada] = useState<{ fecha_creacion: string; nombre_usuario: string | null; anio: number | null } | null>(null);
    // Borrador recuperado de una sesión anterior.
    const [borradorRecuperado, setBorradorRecuperado] = useState(false);
    const borradorRevisado = useRef(false);
    const estadoInicial = useRef<string | null>(null);

    const abierto = !!tipo;

    useEffect(() => {
        if (!tipo) return;
        let vigente = true;
        setHistorial(null); setTecnica(null); setEntrega(null); setRecepcion(null); setAnio(null); setFilas([]);
        setFirmasEntrega({ equipo: null, entrega: null, usarMiFirma: false, area: null }); setMiFirma(null);
        setFirmasRecepcion({ recepcion: null, usarMiFirma: false, calidad: null });
        setFirmasSel({});
        setAniosExtra([]); setNuevoAnio(null);
        setGuardada(null); setGuardadas([]); setBorradorRecuperado(false); setPmRecepcion(false);
        borradorRevisado.current = false; estadoInicial.current = null;
        if (idEquipo) {
            api.guardadas(idEquipo, tipo).then((r) => { if (vigente) setGuardadas(r.fichas); }).catch(() => { /* sin tabla o sin permiso */ });
        }
        const cargar = async () => {
            setCargando(true);
            try {
                if (tipo === 'historial' && idEquipo) {
                    const h = await api.historialAnios(idEquipo);
                    if (!vigente) return;
                    setHistorial(h);
                    setAnio(h.anios[0]?.anio ?? null);
                } else if (tipo === 'tecnica' && idEquipo) {
                    const t = await api.tecnicaDatos(idEquipo);
                    if (!vigente) return;
                    setTecnica(t);
                    try {
                        const f = await firmaUsuarioService.obtener();
                        if (vigente) setMiFirma(f.firma);
                    } catch {
                        if (vigente) setMiFirma(null);
                    }
                    setAutorizados(t.autorizacion_uso.join('\n'));
                } else if (tipo === 'entrega') {
                    let base: Partial<Equipo> = equipo || {};
                    // Desde una lista que no trae todo (ej. Verificación T°), se lee el equipo completo.
                    if (idEquipo && (!equipo || equipo.proveedor === undefined)) {
                        const r = await equipoService.getEquipoById(idEquipo);
                        base = { ...(equipo || {}), ...(r?.data || {}) };
                    }
                    // Responsable de entrega y de área: solo las personas de la lista (si quien llena es una de ellas, parte como entrega).
                    let lista: ResponsableEntrega[] = [];
                    try { lista = await api.responsablesEntrega(); } catch { /* sin lista: quedan los campos de texto */ }
                    if (!vigente) return;
                    setResponsablesEnt(lista);
                    const sinTildes = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                    const yo = lista.find((r) => sinTildes(r.nombre) === sinTildes(user?.name || ''));
                    setEntrega(entregaDesdeEquipo(base, lista.length ? (yo?.nombre ?? '') : (user?.name || '')));
                    try {
                        const f = await firmaUsuarioService.obtener();
                        if (vigente) {
                            setMiFirma(f.firma);
                            setFirmasEntrega((p) => ({ ...p, usarMiFirma: !!f.firma }));
                        }
                    } catch {
                        // Sin firma guardada: quien entrega la dibuja.
                    }
                } else if (tipo === 'recepcion') {
                    const quien = user?.name || '';
                    try {
                        const f = await firmaUsuarioService.obtener();
                        if (vigente) {
                            setMiFirma(f.firma);
                            setFirmasRecepcion((p) => ({ ...p, usarMiFirma: !!f.firma }));
                        }
                    } catch {
                        // Sin firma guardada: se dibuja.
                    }
                    // Equipo en creación: solo lo que hay en el formulario.
                    if (!idEquipo) {
                        setRecepcion(aplicarEvento(recepcionDesdeEquipo(equipo || {}, quien), null, quien));
                        return;
                    }
                    const r = await api.recepcionDatos(idEquipo);
                    if (!vigente) return;
                    // Lo del formulario abierto (si viene de ahí) manda sobre lo guardado.
                    const base = recepcionDesdeEquipo({
                        nombre: r.nombre, codigo: r.codigo, marca: r.marca, modelo: r.modelo, n_serie: r.serie,
                        ...Object.fromEntries(Object.entries(equipo || {}).filter(([, v]) => v !== '' && v !== null && v !== undefined)),
                    }, quien);
                    // Desde ahora los formularios se hacen en digital: siempre es una
                    // recepción nueva de hoy (no se completan con recepciones antiguas).
                    setRecepcion(aplicarEvento(base, null, quien));
                }
            } catch {
                if (vigente) showToast({ type: 'error', message: 'No se pudieron leer los datos del equipo' });
            } finally {
                if (vigente) setCargando(false);
            }
        };
        cargar();
        return () => { vigente = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo, idEquipo]);

    useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);

    const aniosVisibles = useMemo(() => {
        const base = historial?.anios ?? [];
        const extra = aniosExtra.filter((x) => !base.some((a) => a.anio === x)).map((x) => ({ anio: x, cantidad: 0 }));
        return [...base, ...extra].sort((a, b) => b.anio - a.anio);
    }, [historial, aniosExtra]);
    const agregarAnio = () => {
        const n = Number(nuevoAnio);
        if (!Number.isInteger(n) || n < 1990 || n > 2100) {
            showToast({ type: 'error', message: 'Escribe un año válido (ej. 2026)' });
            return;
        }
        if (!aniosVisibles.some((a) => a.anio === n)) setAniosExtra((p) => [...p, n]);
        setAnio(n);
        setNuevoAnio(null);
    };
    const lineasAnio = useMemo(() => (historial && anio ? historial.lineas.filter((l) => l.anio === anio) : []), [historial, anio]);

    const info = tipo ? FICHAS_EQUIPO[tipo] : null;
    const codigoEquipo = historial?.codigo || tecnica?.codigo || entrega?.codigo || recepcion?.codigo || equipo?.codigo || '';

    // Las firmas de la ficha abierta y cuáles ya están hechas (dibujadas, guardadas o importadas):
    // al celular solo se piden las que faltan.
    const slotsCelular = (): SlotFirma[] => {
        if (tipo === 'entrega' && entrega) {
            return [
                { id: 'entrega:equipo', titulo: 'Responsable del equipo (recibe)', nombre: entrega.responsable_equipo, firmada: !!firmasEntrega.equipo },
                { id: 'entrega:entrega', titulo: 'Responsable de entrega', nombre: entrega.responsable_entrega, firmada: !!firmasEntrega.entrega || (firmasEntrega.usarMiFirma && !!miFirma) },
                { id: 'entrega:area', titulo: 'Responsable de área', nombre: entrega.responsable_area, firmada: !!firmasEntrega.area },
            ];
        }
        if (tipo === 'recepcion' && recepcion) {
            return [
                { id: 'recepcion:recepcion', titulo: 'Recepción Área Técnica Medio Ambiente', nombre: recepcion.firma_recepcion, firmada: !!firmasRecepcion.recepcion || (firmasRecepcion.usarMiFirma && !!miFirma) },
                { id: 'recepcion:calidad', titulo: 'Área Gestión de Calidad', nombre: recepcion.firma_calidad, firmada: !!firmasRecepcion.calidad },
            ];
        }
        if (tipo === 'tecnica' && tecnica) {
            return tecnica.firmantes_ficha.filter((p) => firmasSel[p.id_usuario]).map((p) => {
                const sel = firmasSel[p.id_usuario];
                return { id: `tecnica:${p.id_usuario}`, titulo: p.rol === 'REALIZA' ? 'Firma de quien realiza' : 'Firma de quien valida', nombre: p.nombre, firmada: !!sel.imagen || (sel.usarGuardada && !!p.firma_guardada) };
            });
        }
        return [];
    };
    const cabeceraFirmas = (() => {
        const lista = slotsCelular();
        const listas = lista.filter((x) => x.firmada).length;
        return (
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Firmas</span>
                    {lista.length > 0 && (
                        <Badge variant={listas === lista.length ? 'success' : 'outline'} className={listas === lista.length ? '' : 'text-muted-foreground'}>
                            {listas} de {lista.length} listas
                        </Badge>
                    )}
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => setCelularAbierto(true)} disabled={tipo === 'tecnica' && lista.length === 0}>
                    <IconDeviceMobile size={14} /> Firmar con el celular
                </Button>
            </div>
        );
    })();

    const puedeGenerar = !cargando && (
        (tipo === 'historial' && !!anio)
        || (tipo === 'tecnica' && !!tecnica)
        || (tipo === 'entrega' && !!entrega && !!(entrega.codigo.trim() || entrega.nombre.trim()))
        || (tipo === 'recepcion' && !!recepcion && !!(recepcion.codigo.trim() || recepcion.nombre.trim()))
    );

    // Lo que va en la ficha técnica (para el PDF y para guardarla).
    const cuerpoTecnica = () => (!tecnica ? null : {
                nombre: tecnica.nombre,
                marca: tecnica.marca,
                modelo: tecnica.modelo,
                serie: tecnica.serie,
                codigo: tecnica.codigo,
                frecuencia_calibracion: tecnica.frecuencia_calibracion,
                frecuencia_mantencion: tecnica.frecuencia_mantencion,
                fecha_adquisicion: tecnica.fecha_adquisicion,
                fecha_baja: tecnica.fecha_baja,
                observaciones: tecnica.observaciones,
                autorizacion_uso: autorizados.split('\n').map((s) => s.trim()).filter(Boolean),
                registros: filas.map(({ fecha_calibracion, proxima_calibracion, fecha_mantencion, proxima_mantencion, institucion, certificado, observaciones, firmar }) => (
                    { fecha_calibracion, proxima_calibracion, fecha_mantencion, proxima_mantencion, institucion, certificado, observaciones, firmar: !!firmar })),
                firmas_ficha: Object.entries(firmasSel).map(([id, v]) => ({ id_usuario: Number(id), usar_guardada: v.usarGuardada, imagen: v.usarGuardada ? null : v.imagen })),
    });
    const cuerpoEntrega = () => (!entrega ? null : {
        ...entrega,
        firma_equipo: firmasEntrega.equipo,
        firma_entrega: firmasEntrega.usarMiFirma ? null : firmasEntrega.entrega,
        usar_mi_firma_entrega: firmasEntrega.usarMiFirma && !!miFirma,
        firma_area: firmasEntrega.area,
    });

    // Enviar la ficha de entrega a firmar: responsable de entrega y de área firman desde Solicitudes > Firmas pendientes.
    const firmanteEntrega = entrega ? responsablesEnt.find((r) => r.nombre === entrega.responsable_entrega) : undefined;
    const firmanteArea = entrega ? responsablesEnt.find((r) => r.nombre === entrega.responsable_area) : undefined;
    // Pueden ser la misma persona: firma una sola vez y vale para los dos cargos.
    const puedeEnviarAFirma = tipo === 'entrega' && puedeGenerar && !!firmanteEntrega && !!firmanteArea;
    const enviarAFirma = async () => {
        if (!entrega || !firmanteEntrega || !firmanteArea) return;
        setEnviando(true);
        try {
            await fichaFirmaService.crear({
                ...entrega,
                id_equipo: idEquipo ?? null,
                // La firma de quien recibe puede venir hecha; las de entrega y de área las hacen sus responsables.
                firma_equipo: firmasEntrega.equipo,
                id_firmante_entrega: firmanteEntrega.id_usuario,
                id_firmante_area: firmanteArea.id_usuario,
            });
            showToast({ type: 'success', message: firmanteEntrega.id_usuario === firmanteArea.id_usuario ? `Ficha enviada a firmar a ${firmanteEntrega.nombre}` : `Ficha enviada a firmar a ${firmanteEntrega.nombre} y ${firmanteArea.nombre}` });
            setEnvioAbierto(false);
            onClose();
        } catch (e) {
            showToast({ type: 'error', message: (e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo enviar la ficha a firmar' });
        } finally {
            setEnviando(false);
        }
    };

    const cuerpoRecepcion = () => (!recepcion ? null : {
        ...recepcion,
        imagen_firma_recepcion: firmasRecepcion.usarMiFirma ? null : firmasRecepcion.recepcion,
        usar_mi_firma_recepcion: firmasRecepcion.usarMiFirma && !!miFirma,
        imagen_firma_calidad: firmasRecepcion.calidad,
    });

    const generar = async (): Promise<PdfGenerado | null> => {
        if (tipo === 'historial' && idEquipo && anio) return api.historialPdf(idEquipo, anio);
        const t = cuerpoTecnica();
        if (tipo === 'tecnica' && idEquipo && t) return api.tecnicaPdf(idEquipo, t);
        const e = cuerpoEntrega();
        if (tipo === 'entrega' && e) return api.entregaPdf(e);
        const rc = cuerpoRecepcion();
        if (tipo === 'recepcion' && rc) return api.recepcionPdf(rc);
        return null;
    };

    // Guarda la ficha en el sistema; la ventana sigue abierta para descargarla.
    // Si ya hay una vigente igual (mismo formulario y mismo año: el historial
    // el que cubre, las demás el año en que se emiten) primero avisa: lo normal
    // es anular la anterior y guardar la nueva.
    const guardar = async (confirmado = false) => {
        if (!tipo) return;
        const cuerpo = tipo === 'historial' ? { anio } : tipo === 'tecnica' ? cuerpoTecnica() : tipo === 'entrega' ? cuerpoEntrega() : cuerpoRecepcion();
        if (!cuerpo) return;
        setGuardando(true);
        // Un equipo puede tener varias recepciones o puestas en marcha en el año: no se pide reemplazar la anterior.
        // Ficha técnica: tras un cambio de sede u otra actualización se conserva la anterior y la nueva pasa a ser la «actual».
        if (!confirmado && idEquipo && tipo !== 'recepcion' && tipo !== 'tecnica') {
            try {
                const previa = await api.guardadaVigente(idEquipo, tipo, tipo === 'historial' ? anio : new Date().getFullYear());
                if (previa) { setDuplicada(previa); setGuardando(false); return; }
            } catch { /* si no se puede consultar, se guarda igual */ }
        }
        try {
            const r = await api.guardar(tipo, idEquipo ?? null, cuerpo);
            setGuardada(r);
            if (tipo === 'entrega' && idEquipo && (r as { recepcion_registrada?: boolean }).recepcion_registrada) setPmRecepcion(true);
            escribirBorrador(claveBorrador(tipo, idEquipo), null);
            setBorradorRecuperado(false);
            showToast({ type: 'success', message: 'Ficha guardada' });
            if (idEquipo) api.guardadas(idEquipo, tipo).then((l) => setGuardadas(l.fichas)).catch(() => { /* lista opcional */ });
        } catch (err) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: msg || 'No se pudo guardar la ficha' });
        } finally {
            setGuardando(false);
        }
    };

    const anularGuardada = async () => {
        if (!aAnular || !motivoAnular.trim()) return;
        setAnulando(true);
        try {
            await api.anularGuardada(aAnular.id_ficha, motivoAnular.trim());
            setGuardadas((prev) => prev.filter((g) => g.id_ficha !== aAnular.id_ficha));
            if (guardada?.id_ficha === aAnular.id_ficha) setGuardada(null);
            setAAnular(null);
            setMotivoAnular('');
            showToast({ type: 'success', message: 'Ficha anulada' });
        } catch (err) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: msg || 'No se pudo anular la ficha' });
        } finally {
            setAnulando(false);
        }
    };

    const abrirGuardada = async (f: FichaGuardada) => {
        try {
            const r = await api.guardadaPdf(f.id_ficha);
            setPdf({ ...r, titulo: f.nombre_archivo.replace(/\.pdf$/i, '') });
        } catch {
            showToast({ type: 'error', message: 'No se pudo abrir la ficha guardada' });
        }
    };

    // ── Borrador ─────────────────────────────────────────────────────────────
    // Lo editable de cada ficha (sin las firmas, que se vuelven a hacer).
    const datosBorrador = () => {
        if (tipo === 'tecnica' && tecnica) {
            const { frecuencia_calibracion, frecuencia_mantencion, fecha_adquisicion, fecha_baja, observaciones } = tecnica;
            return { campos: { frecuencia_calibracion, frecuencia_mantencion, fecha_adquisicion, fecha_baja, observaciones }, autorizados, filas };
        }
        if (tipo === 'entrega' && entrega) return { entrega };
        if (tipo === 'recepcion' && recepcion) return { recepcion };
        return null;
    };
    const aplicarBorrador = (b: { campos?: Partial<DatosFichaTecnica>; autorizados?: string; filas?: FilaTecnica[]; entrega?: DatosFichaEntrega; recepcion?: DatosFichaRecepcion }) => {
        if (tipo === 'tecnica') {
            if (b.campos) setTecnica((p) => (p ? { ...p, ...b.campos } : p));
            if (typeof b.autorizados === 'string') setAutorizados(b.autorizados);
            if (Array.isArray(b.filas) && b.filas.every((f) => 'fecha_calibracion' in f)) setFilas(b.filas.map((f) => ({ ...f, id: `fila-${idFila += 1}` })));
        }
        if (tipo === 'entrega' && b.entrega) setEntrega(b.entrega);
        if (tipo === 'recepcion' && b.recepcion) setRecepcion(b.recepcion);
    };
    // Al terminar de cargar: se recuerda cómo venía y, si había un borrador, se recupera.
    useEffect(() => {
        if (cargando || !tipo || tipo === 'historial' || borradorRevisado.current) return;
        const actual = datosBorrador();
        if (!actual) return;
        borradorRevisado.current = true;
        estadoInicial.current = JSON.stringify(actual);
        const b = leerBorrador(claveBorrador(tipo, idEquipo));
        if (b && JSON.stringify(b) !== estadoInicial.current) {
            aplicarBorrador(b);
            setBorradorRecuperado(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cargando, tipo, tecnica, entrega, recepcion]);
    // Cada cambio se guarda como borrador (si quedó igual a como venía, se borra).
    useEffect(() => {
        if (!tipo || !borradorRevisado.current || guardada) return;
        const actual = datosBorrador();
        if (!actual) return;
        const json = JSON.stringify(actual);
        escribirBorrador(claveBorrador(tipo, idEquipo), json === estadoInicial.current ? null : json);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tecnica, autorizados, filas, entrega, recepcion]);
    const descartarBorrador = () => {
        if (!tipo) return;
        escribirBorrador(claveBorrador(tipo, idEquipo), null);
        if (estadoInicial.current) aplicarBorrador(JSON.parse(estadoInicial.current));
        setBorradorRecuperado(false);
    };

    // Vista previa en vivo: se regenera cuando cambia lo que va en el documento.
    const clavePrevia = JSON.stringify(
        tipo === 'historial' ? { anio, lineas: historial?.lineas.length }
            : tipo === 'tecnica' ? { tecnica, autorizados, filas, firmasSel }
                : tipo === 'entrega' ? { entrega, firmasEntrega }
                    : { recepcion, firmasRecepcion },
    );
    const avisoPrevia = cargando ? 'Cargando datos del equipo…'
        : tipo === 'historial' && historial && historial.anios.length === 0 ? 'Sin observaciones con fecha: no hay historial que mostrar.'
            : (tipo === 'entrega' || tipo === 'recepcion') && !puedeGenerar ? 'Escribe el nombre o el código del equipo para ver el documento.'
                : !puedeGenerar ? 'Cargando datos del equipo…' : null;

    const accion = async (modo: 'ver' | 'bajar') => {
        setGenerando(modo);
        try {
            const r = await generar();
            if (!r) return;
            if (modo === 'ver') {
                setPdf({ ...r, titulo: r.nombre.replace(/\.pdf$/i, '') });
            } else {
                const a = document.createElement('a');
                a.href = r.url;
                a.download = r.nombre;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(r.url), 4000);
            }
        } catch {
            showToast({ type: 'error', message: 'No se pudo generar el PDF' });
        } finally {
            setGenerando(null);
        }
    };

    // Fecha por defecto de la nueva observación: hoy si es el año elegido; si no, en blanco.
    useEffect(() => {
        const h = hoy();
        setNuevaObs((p) => ({ ...p, fecha: !anio || h.startsWith(String(anio)) ? h : '' }));
    }, [anio]);
    const agregarObservacion = async () => {
        if (!idEquipo || !nuevaObs.fecha || nuevaObs.texto.trim().length < 2) return;
        setAgregandoObs(true);
        try {
            const h = await api.historialObservacion(idEquipo, nuevaObs.fecha, nuevaObs.texto.trim());
            setHistorial(h);
            setAnio(Number(nuevaObs.fecha.slice(0, 4)));
            setNuevaObs((p) => ({ ...p, texto: '' }));
            showToast({ type: 'success', message: 'Observación agregada al equipo' });
        } catch (err) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            showToast({ type: 'error', message: msg || 'No se pudo agregar la observación' });
        } finally {
            setAgregandoObs(false);
        }
    };
    // Formulario "Añadir observación" del historial.
    const formObservacion = idEquipo ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <span className="text-sm font-semibold">Añadir observación{anio ? ` a ${anio}` : ''}</span>
            <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
                <Campo label="Fecha">
                    <Input type="date" value={nuevaObs.fecha}
                        min={anio ? `${anio}-01-01` : undefined} max={anio ? `${anio}-12-31` : undefined}
                        onChange={(e) => setNuevaObs((p) => ({ ...p, fecha: e.target.value }))} />
                </Campo>
                <Campo label="Observación">
                    <Input value={nuevaObs.texto} maxLength={500} placeholder="Ej.: Puesta en marcha por el área técnica"
                        onChange={(e) => setNuevaObs((p) => ({ ...p, texto: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarObservacion(); } }} />
                </Campo>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">Se agrega a la observación del equipo (no borra nada) y queda en el historial de ese año.</span>
                <Button type="button" size="sm" disabled={agregandoObs || !nuevaObs.fecha || nuevaObs.texto.trim().length < 2} onClick={agregarObservacion}>
                    <IconPlus size={14} /> {agregandoObs ? 'Agregando…' : 'Añadir'}
                </Button>
            </div>
        </div>
    ) : null;

    const setE = (campo: keyof DatosFichaEntrega) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setEntrega((prev) => (prev ? { ...prev, [campo]: e.target.value } : prev));
    const setT = (campo: keyof DatosFichaTecnica) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setTecnica((prev) => (prev ? { ...prev, [campo]: e.target.value } : prev));
    // Filas de la ficha técnica. Con servicio anual (TPA/STP calibración, MAU/MOL
    // mantención) la próxima fecha se propone a un año mientras no se escriba a mano.
    // La fecha parte con el día en que se llena la ficha (se puede cambiar).
    // Cualquier equipo puede llevar filas, con calibración y mantención juntas. Si
    // por su tipo le corresponde una (TPA/STP calibración; MAU, MOL, MPA, SON,
    // MOD, SOD mantención), esa parte con la fecha de hoy; lo demás queda vacío.
    // La fila nueva viene sin fechas: se escribe la de calibración y/o la de
    // mantención, y su próxima se calcula a un año recién ahí.
    const agregarFila = () => setFilas((prev) => {
        if (!tecnica) return prev;
        return [...prev, {
            id: `fila-${idFila += 1}`,
            fecha_calibracion: '',
            proxima_calibracion: '',
            fecha_mantencion: '',
            proxima_mantencion: '',
            // Certificado / informe = N° Documento de la ficha del equipo (vacío si no tiene).
            institucion: '', certificado: tecnica.n_documento || '', observaciones: OBSERVACION_TARJADA,
            firmar: true,
        }];
    });
    // Cada próxima se calcula a un año de su fecha; si se escribe a mano, se respeta.
    const cambiarFila = (id: string, cambio: Partial<FilaTecnica>) => setFilas((prev) => prev.map((f) => {
        if (f.id !== id) return f;
        const nueva = { ...f, ...cambio };
        if ('fecha_calibracion' in cambio && !nueva.manualCal) {
            nueva.proxima_calibracion = nueva.fecha_calibracion ? sumarMeses(nueva.fecha_calibracion, 12) : '';
        }
        if ('fecha_mantencion' in cambio && !nueva.manualMan) {
            nueva.proxima_mantencion = nueva.fecha_mantencion ? sumarMeses(nueva.fecha_mantencion, 12) : '';
        }
        return nueva;
    }));
    const setR = <K extends keyof DatosFichaRecepcion>(campo: K, valor: DatosFichaRecepcion[K]) =>
        setRecepcion((prev) => {
            if (!prev) return prev;
            const nuevo = { ...prev, [campo]: valor };
            // Quien marca o desmarca «Se registra» a mano manda sobre el automático.
            return campo === 'recepcion' || campo === 'puesta_marcha' || campo === 'verificacion' ? nuevo : conRegistro(nuevo);
        });
    // Recepción Cumple / No Cumple; el funcionamiento sale de ahí (Operativo / No Operativo) y se puede cambiar.
    const elegirEstadoRecepcion = (v: 'Cumple' | 'No Cumple') => setRecepcion((prev) => {
        if (!prev) return prev;
        const quita = prev.estado_recepcion === v;
        return conRegistro({ ...prev, estado_recepcion: quita ? '' : v, funcionamiento: quita ? '' : (v === 'Cumple' ? 'Operativo' : 'No Operativo') });
    });
    const setRTexto = (campo: keyof DatosFichaRecepcion) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setR(campo, e.target.value);
    // Marca la primera opción ("Sin problema", "Cumple", "Con Manual", "Sí", "Bueno"…)
    // en los ítems que siguen en blanco; lo ya marcado no se toca.
    const todoConforme = () => setRecepcion((prev) => {
        if (!prev) return prev;
        const r = { ...prev };
        for (const clave of Object.keys(ITEMS_RECEPCION) as ItemRecepcion[]) {
            if (!r[clave]) r[clave] = ITEMS_RECEPCION[clave][0];
        }
        if (!r.estado_recepcion) { r.estado_recepcion = 'Cumple'; if (!r.funcionamiento) r.funcionamiento = 'Operativo'; }
        return conRegistro(r);
    });

    // Lista de fichas guardadas de este equipo (siempre visible, nunca colapsada): al presionar una abre el
    // popup con cómo quedó. Se arma una sola vez y se muestra como columna aparte en pantallas anchas, o
    // arriba del formulario en pantallas angostas (ver más abajo). Se lista por id_equipo, no por la versión
    // del equipo que esté abierta ahora, así que es la misma lista sin importar desde dónde se entre.
    const listaGuardadas = (
        <div className="flex h-full flex-col rounded-lg border border-border">
            <div className="flex w-full items-center gap-1.5 border-b border-border px-3 py-2 text-left text-sm font-medium">
                <IconFileText size={15} /> Guardadas de este equipo ({guardadas.length})
            </div>
            {guardadas.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">Todavía no hay fichas guardadas de este equipo.</p>
            ) : (
                <div className="max-h-[220px] min-h-0 flex-1 divide-y divide-border overflow-y-auto lg:max-h-none">
                    {guardadas.map((f, i) => (
                        <button
                            type="button"
                            key={f.id_ficha}
                            onClick={() => abrirGuardada(f)}
                            className="flex w-full flex-col items-start gap-1 px-3 py-2 text-left text-sm hover:bg-muted"
                            title="Ver cómo quedó esta ficha"
                        >
                            <span className="flex w-full items-center gap-1.5">
                                <IconEye size={14} className="shrink-0 text-muted-foreground" />
                                {tipo === 'tecnica' && (() => {
                                    const esVigente = (g: FichaGuardada) => !g.codigo_equipo || !codigoEquipo || g.codigo_equipo === codigoEquipo;
                                    if (!esVigente(f)) {
                                        return <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">OBSOLETO</Badge>;
                                    }
                                    // La actual es la más reciente con el código vigente del equipo (la lista viene de la más nueva a la más antigua).
                                    return guardadas.findIndex(esVigente) === i ? <Badge variant="success">Ficha actual</Badge> : <Badge variant="outline">Anterior</Badge>;
                                })()}
                                <span className="truncate">{fechaHora(f.fecha_creacion)}</span>
                            </span>
                            <span className="pl-[20px] text-xs text-muted-foreground">
                                {f.anio ? `Año ${f.anio}` : ''}{f.codigo_equipo ? ` · ${f.codigo_equipo}` : ''} · {f.nombre_usuario || '—'}
                            </span>
                            {puedeAnular && (
                                <span
                                    role="button"
                                    tabIndex={0}
                                    className="ml-[20px] flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10"
                                    title="Anular esta ficha guardada (queda registrada como anulada)"
                                    onClick={(e) => { e.stopPropagation(); setMotivoAnular(''); setAAnular(f); }}
                                >
                                    <IconBan size={14} /> Anular
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <>
            <Dialog open={abierto} onOpenChange={(o) => { if (!o) onClose(); }}>
                {/* Formulario a la izquierda y el documento a la derecha (en pantallas anchas). */}
                <DialogContent className="flex max-h-[94vh] w-[96vw] max-w-3xl flex-col gap-4 overflow-hidden lg:h-[94vh] lg:max-w-[1500px]">
                    <DialogHeader>
                        <DialogTitle className="flex flex-wrap items-center gap-2">
                            {info?.titulo}
                            <Badge variant="secondary" className="font-mono text-[11px]">{info?.codigo}</Badge>
                        </DialogTitle>
                        <DialogDescription>
                            {info?.descripcion}{codigoEquipo && <> Equipo <span className="font-semibold text-foreground">{codigoEquipo}</span>.</>}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,2.2fr)_minmax(0,4.8fr)_minmax(0,6fr)]">
                    {!cargando && <div className="hidden min-h-0 lg:block">{listaGuardadas}</div>}
                    <div className="min-h-0 overflow-y-auto pr-1">
                        {!cargando && borradorRecuperado && (
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">
                                <span className="flex items-center gap-1.5"><IconInfoCircle size={15} /> Se recuperó lo que habías escrito antes (sin las firmas).</span>
                                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={descartarBorrador}>Descartar borrador</Button>
                            </div>
                        )}
                        {/* En pantallas angostas, donde no hay una tercera columna para la lista de guardadas,
                            se ve aquí arriba del formulario (en pantallas anchas vive en su propia columna). */}
                        {!cargando && <div className="mb-3 lg:hidden">{listaGuardadas}</div>}
                        {cargando && (
                            <div className="flex items-center justify-center py-12">
                                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        )}

                        {/* ── Historial por año ─────────────────────────────── */}
                        {!cargando && tipo === 'historial' && historial && (
                            aniosVisibles.length === 0 ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col items-center gap-2 py-8 text-center">
                                        <IconCalendarEvent size={28} className="text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground">Las observaciones de este equipo no tienen fechas, así que aún no hay años para el historial.</p>
                                    </div>
                                    {formObservacion}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-2">
                                        <span className="text-xs font-medium text-muted-foreground">Año</span>
                                        <div className="flex flex-wrap gap-2">
                                            {aniosVisibles.map((a) => (
                                                <button
                                                    key={a.anio}
                                                    type="button"
                                                    onClick={() => setAnio(a.anio)}
                                                    className={cn(
                                                        'flex items-baseline gap-1.5 rounded-lg border px-3 py-2 text-left transition-colors',
                                                        anio === a.anio ? 'border-primary bg-primary/10 text-foreground' : 'border-border bg-card hover:bg-muted',
                                                    )}
                                                >
                                                    <span className="text-sm font-semibold tabular-nums">{a.anio}</span>
                                                    <span className="text-xs text-muted-foreground">{a.cantidad} {a.cantidad === 1 ? 'registro' : 'registros'}</span>
                                                </button>
                                            ))}
                                            {idEquipo && (nuevoAnio === null ? (
                                                <button type="button"
                                                    onClick={() => setNuevoAnio(String(Math.max(new Date().getFullYear(), ...aniosVisibles.map((a) => a.anio + 1))))}
                                                    className="flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
                                                    <IconPlus size={14} /> Año
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-1.5 rounded-lg border border-primary/50 px-2 py-1">
                                                    <Input type="number" min={1990} max={2100} value={nuevoAnio} autoFocus className="h-8 w-24"
                                                        onChange={(e) => setNuevoAnio(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregarAnio(); } if (e.key === 'Escape') setNuevoAnio(null); }} />
                                                    <Button type="button" size="sm" className="h-8" onClick={agregarAnio}>Agregar</Button>
                                                    <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setNuevoAnio(null)}>Cancelar</Button>
                                                </div>
                                            ))}
                                        </div>
                                        {anio && !historial.anios.some((a) => a.anio === anio) && (
                                            <span className="text-[11px] text-muted-foreground">El año {anio} aún no tiene observaciones: añade la primera abajo para que quede en el historial.</span>
                                        )}
                                    </div>
                                    <div className="overflow-hidden rounded-lg border border-border">
                                        <div className="grid grid-cols-[110px_1fr] border-b border-border bg-muted/60 text-xs font-semibold text-muted-foreground">
                                            <span className="px-3 py-2">Fecha</span>
                                            <span className="px-3 py-2">Observación</span>
                                        </div>
                                        <div className="max-h-[320px] divide-y divide-border overflow-y-auto">
                                            {lineasAnio.map((l, i) => (
                                                <div key={i} className="grid grid-cols-[110px_1fr] text-sm">
                                                    <span className="px-3 py-2 tabular-nums text-muted-foreground">{l.fecha}</span>
                                                    <span className="px-3 py-2">{l.texto}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {historial.sin_fecha > 0 && (
                                        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                            <IconInfoCircle size={14} className="mt-px shrink-0" />
                                            {historial.sin_fecha === 1 ? 'Una línea' : `${historial.sin_fecha} líneas`} de la observación no {historial.sin_fecha === 1 ? 'tiene' : 'tienen'} fecha y no {historial.sin_fecha === 1 ? 'entra' : 'entran'} en ningún año.
                                        </p>
                                    )}
                                    {formObservacion}
                                </div>
                            )
                        )}

                        {/* ── Ficha técnica ─────────────────────────────────── */}
                        {!cargando && tipo === 'tecnica' && tecnica && (
                            <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm sm:grid-cols-3">
                                    <span><span className="text-muted-foreground">Nombre:</span> {tecnica.nombre || '—'}</span>
                                    <span><span className="text-muted-foreground">Marca:</span> {tecnica.marca || '—'}</span>
                                    <span><span className="text-muted-foreground">Modelo:</span> {tecnica.modelo || '—'}</span>
                                    <span><span className="text-muted-foreground">Serie:</span> {tecnica.serie || '—'}</span>
                                    <span><span className="text-muted-foreground">Código:</span> {tecnica.codigo || '—'}</span>
                                    <span><span className="text-muted-foreground">Estado:</span> {tecnica.estado || '—'}</span>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Campo label="Frecuencia de calibración">
                                        <Input value={tecnica.frecuencia_calibracion} onChange={setT('frecuencia_calibracion')} />
                                    </Campo>
                                    <Campo label="Frecuencia de mantención">
                                        <Input value={tecnica.frecuencia_mantencion} onChange={setT('frecuencia_mantencion')} />
                                    </Campo>
                                    <Campo label="Fecha de adquisición">
                                        <Input type="date" value={tecnica.fecha_adquisicion || ''} onChange={setT('fecha_adquisicion')} />
                                    </Campo>
                                    <Campo label="Fecha de baja" ayuda="Vacía se imprime como “-------”.">
                                        <Input type="date" value={tecnica.fecha_baja || ''} onChange={setT('fecha_baja')} />
                                    </Campo>
                                    <Campo label="Observaciones">
                                        <Textarea rows={3} value={tecnica.observaciones} onChange={setT('observaciones')} />
                                    </Campo>
                                    {(() => {
                                        // Se marcan los cargos del área; lo que no sea un cargo de la lista queda como «Otros», una línea cada uno.
                                        const cargos = tecnica.cargos_autorizacion ?? [];
                                        const lineas = autorizados.split('\n').map((s) => s.trim()).filter(Boolean);
                                        // Sin recortar ni quitar líneas vacías: si no, no se podría escribir un salto de línea en «Otros».
                                        const otros = autorizados.split('\n').filter((l) => !cargos.includes(l.trim()));
                                        const marcados = cargos.filter((c) => lineas.includes(c));
                                        const armar = (sel: string[], extra: string[]) => [...cargos.filter((c) => sel.includes(c)), ...extra].join('\n');
                                        if (cargos.length === 0) {
                                            return (
                                                <Campo label="Autorización de uso" ayuda="Una persona o grupo por línea.">
                                                    <Textarea rows={3} value={autorizados} onChange={(e) => setAutorizados(e.target.value)} />
                                                </Campo>
                                            );
                                        }
                                        return (
                                            <Campo label="Autorización de uso" ayuda="Cargos del área que pueden usar el equipo.">
                                                <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
                                                    {cargos.map((c) => (
                                                        <label key={c} className="flex items-center gap-2 text-sm">
                                                            <Checkbox
                                                                checked={marcados.includes(c)}
                                                                onCheckedChange={(v) => setAutorizados(armar(v ? [...marcados, c] : marcados.filter((m) => m !== c), otros))}
                                                            />
                                                            {c}
                                                        </label>
                                                    ))}
                                                    <Textarea
                                                        rows={1}
                                                        className="mt-1 min-h-[34px] text-sm"
                                                        placeholder="Otros (una persona o grupo por línea)"
                                                        value={otros.join('\n')}
                                                        onChange={(e) => setAutorizados(armar(marcados, e.target.value.split('\n')))}
                                                    />
                                                </div>
                                            </Campo>
                                        );
                                    })()}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <span className="text-sm font-semibold">Calibraciones y mantenciones</span>
                                        <Button type="button" size="sm" variant="outline" onClick={agregarFila}>
                                            <IconPlus size={14} /> Agregar fila
                                        </Button>
                                    </div>
                                    {filas.length === 0 ? (
                                        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                                            Agrega una fila por cada calibración o mantención. Si no agregas ninguna, la tabla sale en blanco para completarla en papel.
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            {filas.map((f, n) => (
                                                <div key={f.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-medium text-muted-foreground">Fila {n + 1}</span>
                                                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" aria-label={`Quitar fila ${n + 1}`}
                                                            onClick={() => setFilas((prev) => prev.filter((x) => x.id !== f.id))}>
                                                            <IconTrash size={14} /> Quitar
                                                        </Button>
                                                    </div>
                                                    {/* Calibración y mantención juntas, como en las columnas del formato (la del equipo primero). */}
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {(['cal', 'man'] as const).map((k) => (
                                                            <div key={k} className="flex flex-col gap-2 rounded-md border border-border/70 bg-muted/20 p-2">
                                                                <span className="text-xs font-semibold">{k === 'cal' ? 'Calibración' : 'Mantención'}</span>
                                                                <Campo label="Fecha">
                                                                    <Input type="date" value={k === 'cal' ? f.fecha_calibracion : f.fecha_mantencion}
                                                                        onChange={(e) => cambiarFila(f.id, k === 'cal' ? { fecha_calibracion: e.target.value } : { fecha_mantencion: e.target.value })} />
                                                                </Campo>
                                                                <Campo label="Próxima" ayuda="Un año después de la fecha; se puede cambiar.">
                                                                    <Input type="date" value={k === 'cal' ? f.proxima_calibracion : f.proxima_mantencion}
                                                                        onChange={(e) => cambiarFila(f.id, k === 'cal' ? { proxima_calibracion: e.target.value, manualCal: true } : { proxima_mantencion: e.target.value, manualMan: true })} />
                                                                </Campo>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        <Campo label="Institución">
                                                            <Select value={f.institucion || undefined} onValueChange={(v) => cambiarFila(f.id, { institucion: v })}>
                                                                <SelectTrigger><SelectValue placeholder="Seleccione la empresa" /></SelectTrigger>
                                                                <SelectContent>
                                                                    {INSTITUCIONES_SERVICIO.map((g) => (
                                                                        <SelectGroup key={g.grupo}>
                                                                            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">{g.grupo}</div>
                                                                            {g.empresas.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                                                                        </SelectGroup>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </Campo>
                                                        <Campo label="Certificado / informe">
                                                            <Input value={f.certificado} onChange={(e) => cambiarFila(f.id, { certificado: e.target.value })} placeholder="El equipo no tiene N° Documento" />
                                                        </Campo>
                                                    </div>
                                                    <Campo label="Observaciones">
                                                        <Input value={f.observaciones} onChange={(e) => cambiarFila(f.id, { observaciones: e.target.value })} />
                                                    </Campo>
                                                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                                                        <Checkbox checked={!!f.firmar} onCheckedChange={(v) => cambiarFila(f.id, { firmar: v === true })} />
                                                        Lleva las firmas de abajo (quien realiza y quien valida)
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {filas.length > 0 && (
                                        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                                            {cabeceraFirmas}
                                            <span className="text-[11px] text-muted-foreground">Marca las firmas que van en la columna FIRMA. Cada una puede usar la firma guardada de esa persona, dibujarse en el momento o firmarse desde el celular.</span>
                                            <div className="flex flex-col gap-2">
                                                {tecnica.firmantes_ficha.map((p) => {
                                                    const sel = firmasSel[p.id_usuario];
                                                    return (
                                                        <div key={p.id_usuario} className={cn('flex flex-col gap-2 rounded-lg border p-2.5', sel ? 'border-primary/60 bg-primary/5' : 'border-border')}>
                                                            <label className="flex cursor-pointer items-center gap-2.5">
                                                                <Checkbox
                                                                    checked={!!sel}
                                                                    onCheckedChange={(v) => setFirmasSel((prev) => {
                                                                        const n = { ...prev };
                                                                        if (v === true) n[p.id_usuario] = { imagen: null, usarGuardada: !!p.firma_guardada };
                                                                        else delete n[p.id_usuario];
                                                                        return n;
                                                                    })}
                                                                />
                                                                <span className="flex flex-col">
                                                                    <span className="text-sm font-medium">{p.nombre}{p.id_usuario === user?.id ? ' (tú)' : ''}</span>
                                                                    <span className="text-[11px] text-muted-foreground">{p.rol === 'REALIZA' ? 'Realiza' : 'Valida'}{p.cargo ? ` · ${p.cargo}` : ''}</span>
                                                                </span>
                                                            </label>
                                                            {sel && (
                                                                <CampoFirma
                                                                    plano
                                                                    ref={(r) => { firmaRefs.current[`tecnica:${p.id_usuario}`] = r; }}
                                                                    titulo="Firma"
                                                                    guardada={p.firma_guardada}
                                                                    onChange={(f, usar) => setFirmasSel((prev) => (prev[p.id_usuario] ? { ...prev, [p.id_usuario]: { imagen: f, usarGuardada: usar } } : prev))}
                                                                />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                        <IconInfoCircle size={14} className="mt-px shrink-0" />
                                        La columna FIRMA lleva las firmas marcadas, una sobre otra, en las filas marcadas. Lo que no se firme queda en blanco para firmar en papel. Lo escrito aquí no se guarda en el equipo.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* ── Ficha de entrega ──────────────────────────────── */}
                        {!cargando && tipo === 'entrega' && entrega && (
                            <div className="flex flex-col gap-4">
                                <div className="rounded-lg border border-border bg-muted/20 p-3">
                                    <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datos del equipo (inventario)</p>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <Campo label="Nombre del equipo"><Input value={entrega.nombre} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Marca"><Input value={entrega.marca} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Modelo"><Input value={entrega.modelo} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Serie"><Input value={entrega.serie} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Código interno"><Input value={entrega.codigo} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Proveedor"><Input value={entrega.proveedor} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="N° de factura"><Input value={entrega.n_factura} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Fecha factura"><Input type="date" value={entrega.fecha_factura} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Valor"><Input value={entrega.valor} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Frecuencia de mantención"><Input value={entrega.frecuencia_mantencion} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Fecha de adquisición"><Input type="date" value={entrega.fecha_adquisicion} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Área"><Input value={entrega.area} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Sección / unidad"><Input value={entrega.seccion} readOnly className="bg-muted/50 cursor-default" /></Campo>
                                        <Campo label="Responsable del equipo (recibe)"><Input value={entrega.responsable_equipo} onChange={setE('responsable_equipo')} /></Campo>
                                        <Campo label="Fecha de recepción" ayuda="Se completa automáticamente al firmar quien recibe o puede ingresarse a mano."><Input type="date" value={entrega.fecha_recepcion} onChange={setE('fecha_recepcion')} /></Campo>
                                    </div>
                                </div>
                                <Campo label="Observaciones">
                                    <Textarea rows={3} value={entrega.observaciones} onChange={setE('observaciones')} placeholder="Ej.: Se envía en reemplazo de… / Equipo va sin pilas." />
                                </Campo>
                                <div className="grid gap-3 sm:grid-cols-3">
                                    {responsablesEnt.length > 0 ? (
                                        <>
                                            <ListaResponsables label="Responsable de entrega" valor={entrega.responsable_entrega} lista={responsablesEnt} onCambio={(v) => setEntrega((p) => (p ? { ...p, responsable_entrega: v } : p))} />
                                            <ListaResponsables label="Responsable de área" valor={entrega.responsable_area} lista={responsablesEnt.filter((r) => r.puede_area !== false)} onCambio={(v) => setEntrega((p) => (p ? { ...p, responsable_area: v } : p))} />
                                        </>
                                    ) : (
                                        <>
                                            <Campo label="Responsable de entrega"><Input value={entrega.responsable_entrega} onChange={setE('responsable_entrega')} /></Campo>
                                            <Campo label="Responsable de área"><Input value={entrega.responsable_area} onChange={setE('responsable_area')} /></Campo>
                                        </>
                                    )}
                                    <Campo label="Fecha de entrega"><Input type="date" value={entrega.fecha_entrega} onChange={setE('fecha_entrega')} /></Campo>
                                </div>
                                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                                    {cabeceraFirmas}
                                    <div className={cn('grid gap-3', pantallaAncha ? 'grid-cols-1' : 'sm:grid-cols-3')}>
                                        <CampoFirma
                                            ref={(r) => { firmaRefs.current['entrega:equipo'] = r; }}
                                            titulo="Responsable del equipo (recibe)"
                                            nombre={entrega.responsable_equipo}
                                            onChange={(f) => {
                                                setFirmasEntrega((p) => ({ ...p, equipo: f }));
                                                if (f && entrega && !entrega.fecha_recepcion) {
                                                    setEntrega((prev) => (prev ? { ...prev, fecha_recepcion: hoy() } : prev));
                                                }
                                            }}
                                        />
                                        <CampoFirma
                                            ref={(r) => { firmaRefs.current['entrega:entrega'] = r; }}
                                            key={miFirma ? 'con-guardada' : 'sin-guardada'}
                                            titulo="Responsable de entrega"
                                            nombre={entrega.responsable_entrega}
                                            guardada={miFirma}
                                            onChange={(f, usar) => setFirmasEntrega((p) => ({ ...p, entrega: f, usarMiFirma: usar }))}
                                        />
                                        <CampoFirma
                                            ref={(r) => { firmaRefs.current['entrega:area'] = r; }}
                                            titulo="Responsable de área"
                                            nombre={entrega.responsable_area}
                                            onChange={(f) => setFirmasEntrega((p) => ({ ...p, area: f }))}
                                        />
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Se puede firmar en pantalla, importar la firma registrada de la persona (si la tiene) o firmar con el celular (solo se piden las que faltan). Lo que no se firme queda en blanco para firmar en papel.
                                    </span>
                                </div>
                                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <IconInfoCircle size={14} className="mt-px shrink-0" />
                                    Los campos vacíos salen como “N/I”, igual que en el formato. Generar la ficha no cambia el equipo.
                                </p>
                            </div>
                        )}

                        {/* ── Recepción, puesta en marcha y verificación ────── */}
                        {!cargando && tipo === 'recepcion' && recepcion && (
                            <div className="flex flex-col gap-4">
                                <p className="flex items-start gap-1.5 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
                                    <IconInfoCircle size={14} className="mt-px shrink-0" />
                                    Formulario libre: no crea una puesta en marcha ni escribe en el historial del equipo. Para registrarla con la validación de Área Técnica y Gestión de Calidad use «Puesta en Marcha» (G. Calidad o el menú del equipo en el inventario).
                                </p>
                                {!!idEquipo && <PuestasMarchaEquipo idEquipo={idEquipo} />}
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Campo label="Equipo"><Input value={recepcion.nombre} onChange={setRTexto('nombre')} /></Campo>
                                    <Campo label="Código interno"><Input value={recepcion.codigo} onChange={setRTexto('codigo')} /></Campo>
                                    <Campo label="Fecha"><Input type="date" value={recepcion.fecha} onChange={setRTexto('fecha')} /></Campo>
                                    <Campo label="Marca"><Input value={recepcion.marca} onChange={setRTexto('marca')} /></Campo>
                                    <Campo label="Modelo"><Input value={recepcion.modelo} onChange={setRTexto('modelo')} /></Campo>
                                    <Campo label="Serie"><Input value={recepcion.serie} onChange={setRTexto('serie')} /></Campo>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                                    <span className="text-xs font-medium text-muted-foreground">Se registra</span>
                                    {([['recepcion', 'Recepción'], ['puesta_marcha', 'Puesta en marcha'], ['verificacion', 'Verificación']] as const).map(([clave, label]) => (
                                        <label key={clave} className="flex cursor-pointer items-center gap-2 text-sm">
                                            <Checkbox checked={recepcion[clave]} onCheckedChange={(v) => setR(clave, v === true)} />
                                            {label}
                                        </label>
                                    ))}
                                </div>

                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs text-muted-foreground">
                                        Caja, embalaje y contenido no quedan registrados en ningún lado: márcalos o usa «Todo conforme».
                                    </p>
                                    <Button type="button" variant="outline" size="sm" onClick={todoConforme}>
                                        <IconChecks size={16} /> Todo conforme
                                    </Button>
                                </div>

                                {SECCIONES_RECEPCION.map((s) => (
                                    <div key={s.titulo} className="overflow-hidden rounded-lg border border-border">
                                        <div className="border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground">{s.titulo}</div>
                                        <div className="divide-y divide-border">
                                            {s.items.map((it) => (
                                                <div key={it.clave} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                                    <span className="text-sm">{it.label}</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {ITEMS_RECEPCION[it.clave].map((op) => {
                                                            const activa = recepcion[it.clave] === op;
                                                            return (
                                                                <button
                                                                    key={op}
                                                                    type="button"
                                                                    aria-pressed={activa}
                                                                    // Un segundo clic la desmarca (queda en blanco en la hoja).
                                                                    onClick={() => setR(it.clave, activa ? '' : op)}
                                                                    className={cn(
                                                                        'min-w-[88px] rounded-md border px-2.5 py-1 text-xs transition-colors',
                                                                        activa ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted',
                                                                    )}
                                                                >
                                                                    {op}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                            {s.items[0].clave === 'manual' && (
                                                <div className="px-3 py-2"><Campo label="Otros"><Input value={recepcion.otros} onChange={setRTexto('otros')} placeholder="Ej.: maletín, sonda, pilas" /></Campo></div>
                                            )}
                                            {s.items[0].clave === 'interruptor' && (
                                                <div className="flex flex-col gap-1.5 px-3 py-2">
                                                    <span className="text-xs font-medium text-muted-foreground">Estado recepción</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(['Cumple', 'No Cumple'] as const).map((op) => (
                                                            <button key={op} type="button" aria-pressed={recepcion.estado_recepcion === op} onClick={() => elegirEstadoRecepcion(op)}
                                                                className={cn('min-w-[88px] rounded-md border px-2.5 py-1 text-xs transition-colors', recepcion.estado_recepcion === op ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>
                                                                {op}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Campo label="Verificación · Funcionamiento" ayuda="Si la recepción cumple, queda Operativo automáticamente.">
                                        <div className="flex flex-wrap gap-1.5">
                                            {(['Operativo', 'No Operativo'] as const).map((op) => (
                                                <button key={op} type="button" aria-pressed={recepcion.funcionamiento === op} onClick={() => setR('funcionamiento', recepcion.funcionamiento === op ? '' : op)}
                                                    className={cn('min-w-[100px] rounded-md border px-2.5 py-1.5 text-xs transition-colors', recepcion.funcionamiento === op ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted')}>
                                                    {op}
                                                </button>
                                            ))}
                                        </div>
                                    </Campo>
                                    <Campo label="Verificación · Con patrón de referencia" ayuda="Cite el equipo (tipo y código) o, si es buffer, cuál se usó.">
                                        <Input value={recepcion.patron_referencia} onChange={setRTexto('patron_referencia')} />
                                        <span className="flex flex-wrap gap-1">
                                            {BUFFERS_PATRON.map((b) => (
                                                <button key={b} type="button" onClick={() => setR('patron_referencia', recepcion.patron_referencia.includes(b) ? recepcion.patron_referencia : [recepcion.patron_referencia.trim(), b].filter(Boolean).join(' / '))}
                                                    className="rounded-full border border-border px-2 py-0.5 text-[11px] hover:bg-muted">{b}</button>
                                            ))}
                                        </span>
                                    </Campo>
                                </div>
                                <Campo label="Observaciones">
                                    <Textarea rows={3} value={recepcion.observaciones} onChange={setRTexto('observaciones')} />
                                </Campo>
                                <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
                                    {cabeceraFirmas}
                                    <div className={cn('grid gap-3', pantallaAncha ? 'grid-cols-1' : 'sm:grid-cols-2')}>
                                        <div className="flex flex-col gap-2">
                                            <Campo label="Recepción Área Técnica Medio Ambiente · nombre" ayuda="Va sobre la línea, bajo la firma.">
                                                <Input value={recepcion.firma_recepcion} onChange={setRTexto('firma_recepcion')} />
                                            </Campo>
                                            <CampoFirma
                                                ref={(r) => { firmaRefs.current['recepcion:recepcion'] = r; }}
                                                key={miFirma ? 'con-guardada' : 'sin-guardada'}
                                                titulo="Firma"
                                                nombre={recepcion.firma_recepcion}
                                                guardada={miFirma}
                                                onChange={(f, usar) => setFirmasRecepcion((p) => ({ ...p, recepcion: f, usarMiFirma: usar }))}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <Campo label="Área Gestión de Calidad · nombre" ayuda="Va sobre la línea, bajo la firma.">
                                                <Input value={recepcion.firma_calidad} onChange={setRTexto('firma_calidad')} />
                                            </Campo>
                                            <CampoFirma
                                                ref={(r) => { firmaRefs.current['recepcion:calidad'] = r; }}
                                                titulo="Firma"
                                                nombre={recepcion.firma_calidad}
                                                onChange={(f) => setFirmasRecepcion((p) => ({ ...p, calidad: f }))}
                                            />
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-muted-foreground">
                                        Se puede firmar en pantalla, importar la firma registrada de la persona (si la tiene) o firmar con el celular (solo se piden las que faltan). Lo que no se firme queda en blanco para firmar en papel.
                                    </span>
                                </div>
                                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                    <IconInfoCircle size={14} className="mt-px shrink-0" />
                                    Es una recepción nueva con la fecha de hoy y los datos del equipo; los ítems sin interruptor ni encendido (baterías, sondas, cables…) van en «No Aplica». Todo se puede cambiar. Lo que quede sin marcar sale en blanco para completarlo a mano. Generar el formulario no cambia el equipo.
                                </p>
                            </div>
                        )}
                    </div>
                    {pantallaAncha && (
                        <VistaPreviaPdf key={tipo || ''} generar={generar} clave={clavePrevia} aviso={avisoPrevia} />
                    )}
                    </div>

                    {pmRecepcion && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                            <span>Recepción registrada en el historial del equipo. Corresponde su <b>Puesta en Marcha por recepción</b>.</span>
                            <Button size="sm" onClick={irAPmRecepcion}>Registrar puesta en marcha</Button>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={onClose}>Cerrar</Button>
                        <Button variant="outline" disabled={!puedeGenerar || !!generando} onClick={() => accion('ver')}>
                            <IconEye size={16} /> {generando === 'ver' ? 'Generando…' : 'Vista previa'}
                        </Button>
                        {tipo === 'entrega' && responsablesEnt.length > 0 && (
                            <Button variant="secondary" disabled={!puedeEnviarAFirma || !!generando} onClick={() => { setRevisada(false); setEnvioAbierto(true); }}
                                title={!puedeEnviarAFirma ? 'Elija el responsable de entrega y el responsable de área' : undefined}>
                                <IconSend size={16} /> Enviar a firma
                            </Button>
                        )}
                        {guardada ? (
                            <span className="flex items-center gap-1.5 px-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                <IconCircleCheck size={16} /> Ficha guardada
                            </span>
                        ) : (
                            <Button variant="secondary" disabled={!puedeGenerar || !!generando || guardando} onClick={() => guardar()}>
                                <IconDeviceFloppy size={16} /> {guardando ? 'Guardando…' : 'Guardar'}
                            </Button>
                        )}
                        <Button disabled={!puedeGenerar || !!generando} onClick={() => accion('bajar')}>
                            <IconDownload size={16} /> {generando === 'bajar' ? 'Generando…' : 'Descargar PDF'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PdfViewerModal open={!!pdf} onClose={() => setPdf(null)} url={pdf?.url ?? null} title={pdf?.titulo} />

            {/* Ya hay una ficha vigente igual: ¿guardar otra de todos modos? */}
            <Dialog open={!!duplicada} onOpenChange={(o) => { if (!o && !guardando) setDuplicada(null); }}>
                <DialogContent className="max-w-md gap-5">
                    <DialogHeader className="items-center text-center sm:text-center">
                        <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-warning/15 text-warning">
                            <IconAlertTriangle size={24} />
                        </div>
                        <DialogTitle>Ya hay una ficha guardada</DialogTitle>
                        <DialogDescription>
                            {tipo ? FICHAS_EQUIPO[tipo].titulo : 'Esta ficha'}{duplicada?.anio ? ` del año ${duplicada.anio}` : ''} ya tiene una versión vigente,
                            guardada el {duplicada ? fechaHora(duplicada.fecha_creacion) : ''}{duplicada?.nombre_usuario ? ` por ${duplicada.nombre_usuario}` : ''}.
                            Si guardas otra, quedarán las dos vigentes. Lo recomendable es anular la anterior desde "Guardadas de este equipo" y luego guardar esta.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-center">
                        <Button variant="outline" onClick={() => setDuplicada(null)} disabled={guardando}>Cancelar</Button>
                        <Button variant="secondary" onClick={() => { setDuplicada(null); guardar(true); }} disabled={guardando}>
                            <IconDeviceFloppy size={15} /> Guardar de todos modos
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Anular una ficha guardada (con motivo). */}
            <Dialog open={!!aAnular} onOpenChange={(o) => { if (!o && !anulando) setAAnular(null); }}>
                <DialogContent className="max-w-md gap-4">
                    <DialogHeader>
                        <DialogTitle>¿Anular esta ficha guardada?</DialogTitle>
                        <DialogDescription>
                            {aAnular ? `${aAnular.formato} · ${fechaHora(aAnular.fecha_creacion)}${aAnular.anio ? ` · año ${aAnular.anio}` : ''}` : ''}.
                            Queda registrada como anulada con su motivo; el PDF no se borra, pero deja de aparecer como vigente.
                        </DialogDescription>
                    </DialogHeader>
                    <Textarea rows={3} autoFocus placeholder="Motivo de la anulación (obligatorio)" value={motivoAnular} onChange={(e) => setMotivoAnular(e.target.value)} className="resize-none" />
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setAAnular(null)} disabled={anulando}>Cancelar</Button>
                        <Button variant="destructive" onClick={anularGuardada} disabled={!motivoAnular.trim() || anulando}>
                            <IconBan size={15} /> {anulando ? 'Anulando…' : 'Anular ficha'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Revisar y enviar la ficha de entrega a firmar */}
            <Dialog open={envioAbierto} onOpenChange={(o) => { if (!o && !enviando) setEnvioAbierto(false); }}>
                <DialogContent className="max-w-lg grid-cols-[minmax(0,1fr)] gap-4">
                    <DialogHeader>
                        <DialogTitle>Revisar y enviar a firma</DialogTitle>
                        <DialogDescription>Antes de enviarla, revise que todo esté bien: después la firman sus responsables y queda guardada.</DialogDescription>
                    </DialogHeader>
                    {entrega && (
                        <dl className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                            <div><dt className="text-[11px] text-muted-foreground">Equipo</dt><dd className="font-medium">{entrega.codigo} · {entrega.nombre}</dd></div>
                            <div><dt className="text-[11px] text-muted-foreground">Recibe el equipo</dt><dd>{entrega.responsable_equipo || '—'}</dd></div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div><dt className="text-[11px] text-muted-foreground">Firma como responsable de entrega</dt><dd className="font-medium">{firmanteEntrega?.nombre}{firmanteEntrega?.cargo ? ` · ${firmanteEntrega.cargo}` : ''}</dd></div>
                                <div><dt className="text-[11px] text-muted-foreground">Firma como responsable de área</dt><dd className="font-medium">{firmanteArea?.nombre}{firmanteArea?.cargo ? ` · ${firmanteArea.cargo}` : ''}</dd></div>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                                <div><dt className="text-[11px] text-muted-foreground">Fecha de entrega</dt><dd>{entrega.fecha_entrega || '—'}</dd></div>
                                <div><dt className="text-[11px] text-muted-foreground">Observaciones</dt><dd className="line-clamp-2">{entrega.observaciones || '—'}</dd></div>
                            </div>
                        </dl>
                    )}
                    <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => accion('ver')} disabled={!!generando}>
                        <IconEye size={15} /> {generando === 'ver' ? 'Generando…' : 'Ver la ficha antes de enviarla'}
                    </Button>
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <IconInfoCircle size={14} className="mt-px shrink-0" />
                        A cada uno le llega una solicitud de firma (Solicitudes &gt; Firmas pendientes) y un aviso. Podrán firmar en pantalla, con su firma registrada o con el celular. Cuando firmen todos se guarda la ficha y le avisamos.
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={revisada} onCheckedChange={(v) => setRevisada(v === true)} />
                        Revisé la ficha y está todo bien
                    </label>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setEnvioAbierto(false)} disabled={enviando}>Volver a revisar</Button>
                        <Button onClick={enviarAFirma} disabled={!revisada || enviando}><IconSend size={16} /> {enviando ? 'Enviando…' : 'Enviar a firma'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Firmar con el celular: las firmas que llegan se ponen en su campo de la ficha. */}
            <FirmaCelularDialog
                open={celularAbierto && !!tipo}
                onClose={() => setCelularAbierto(false)}
                titulo={tipo ? `${FICHAS_EQUIPO[tipo].codigo} · ${FICHAS_EQUIPO[tipo].titulo}` : ''}
                subtitulo={codigoEquipo ? `Equipo ${codigoEquipo}` : undefined}
                slots={celularAbierto ? slotsCelular() : []}
                onFirma={(id, imagen) => firmaRefs.current[id]?.fijar(imagen)}
            />
        </>
    );
};

export default FichasEquipoDialog;
