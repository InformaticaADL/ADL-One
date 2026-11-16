import React, { useState } from 'react';
import {
    IconArrowLeft, IconFileDescription, IconDownload, IconInfoCircle, IconX,
    IconMapPin, IconCategory, IconUser, IconCalendarCheck, IconCalendarDue,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Equipo } from '../services/equipo.service';
import { descargarDocumentoRevision } from '../utils/documentosEquipo';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
    equipo: Equipo;
    onBack: () => void;
    // Texto de contexto arriba del detalle (ej. por qué se está viendo).
    aviso?: string;
    // Panel lateral (al lado de una lista): botón "Cerrar" en vez de "Volver".
    panel?: boolean;
    // Sin código/nombre/estado arriba, cuando el contenedor ya los muestra.
    sinEncabezado?: boolean;
}

const fmtFecha = (v?: string | null) => {
    if (!v) return '';
    const s = String(v).slice(0, 10);
    const [y, m, d] = s.split('-');
    return d && m && y && y.length === 4 ? `${d}-${m}-${y}` : String(v);
};

const hoyYmd = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmtNum = (n?: number | string | null) => (n === null || n === undefined || n === '' ? '' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 }));
const siNo = (v?: string | null) => (!v ? '' : ['S', 'SI', 'Si', 'si'].includes(String(v).trim()) ? 'Sí' : 'No');
const vacio = (v: React.ReactNode) => v === '' || v === null || v === undefined;

const Seccion: React.FC<{ titulo: string; campos: [string, React.ReactNode][]; className?: string }> = ({ titulo, campos, className }) => (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
        <div className="bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</div>
        <dl>
            {campos.map(([label, valor]) => (
                <div key={label} className="grid grid-cols-[minmax(110px,40%)_1fr] items-start gap-3 border-b border-border/60 px-3 py-1.5 text-sm last:border-0">
                    <dt className="text-xs leading-5 text-muted-foreground">{label}</dt>
                    <dd className={cn('min-w-0 break-words', vacio(valor) && 'text-muted-foreground')}>{vacio(valor) ? '—' : valor}</dd>
                </div>
            ))}
        </dl>
    </div>
);

// Ficha de un equipo en solo lectura (sin editar ni actualizar): para consultar
// equipos desde otras pantallas, como los que están en el sistema pero no en el
// Excel analizado. Las secciones pasan a dos columnas cuando el contenedor es
// ancho (container query), así sirve igual a pantalla completa o como panel.
export const EquipoDetalleLectura: React.FC<Props> = ({ equipo: e, onBack, aviso, panel = false, sinEncabezado = false }) => {
    const { showToast } = useToast();
    const [descargando, setDescargando] = useState(false);
    const activo = e.estado === 'Activo';
    const vencida = !!e.siguiente_verificacion && String(e.siguiente_verificacion).slice(0, 10) < hoyYmd();

    const verDocumento = async () => {
        setDescargando(true);
        try { await descargarDocumentoRevision('equipo', e.id_equipo, e.documento_nombre); } catch { showToast({ type: 'error', message: 'No se pudo abrir el documento' }); } finally { setDescargando(false); }
    };

    // Datos clave arriba, para no tener que buscarlos en las secciones.
    const claves: { icono: React.ReactNode; label: string; valor: React.ReactNode; alerta?: boolean }[] = [
        { icono: <IconMapPin size={14} />, label: 'Sede', valor: e.ubicacion },
        { icono: <IconCategory size={14} />, label: 'Tipo', valor: e.tipo },
        { icono: <IconUser size={14} />, label: 'Responsable', valor: e.nombre_asignado ? `${e.nombre_asignado}${e.habilitado_muestreador === 'N' ? ' (Inactivo)' : ''}` : '' },
        { icono: <IconCalendarCheck size={14} />, label: 'Última revisión', valor: fmtFecha(e.ultima_verificacion) },
        { icono: <IconCalendarDue size={14} />, label: 'Siguiente revisión', valor: fmtFecha(e.siguiente_verificacion), alerta: vencida },
    ];

    return (
        <div className="@container flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {/* Encabezado */}
            {!sinEncabezado && <div className="flex items-start gap-3">
                {!panel && <Button variant="ghost" size="sm" onClick={onBack}><IconArrowLeft size={14} /> Volver</Button>}
                <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold leading-tight" title={e.codigo}>{e.codigo}</p>
                    <p className="truncate text-sm text-muted-foreground" title={e.nombre}>{e.nombre}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {/* Un solo estado: el del inventario (Operativo / Fuera de Servicio / Dado de Baja). */}
                        {e.estado_equipo
                            ? <Badge variant={/baja/i.test(e.estado_equipo) ? 'destructive' : /fuera/i.test(e.estado_equipo) ? 'warning' : 'success'}>{e.estado_equipo}</Badge>
                            : <Badge variant={activo ? 'success' : 'secondary'}>{e.estado}</Badge>}
                        <Badge variant="outline">Solo lectura</Badge>
                    </div>
                </div>
                {panel && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack} aria-label="Cerrar detalle" title="Cerrar detalle">
                        <IconX size={16} />
                    </Button>
                )}
            </div>}

            {aviso && (
                <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <IconInfoCircle size={14} className="mt-0.5 shrink-0" /> {aviso}
                </p>
            )}

            {/* Datos clave */}
            <div className="grid grid-cols-2 gap-2 @xl:grid-cols-3 @4xl:grid-cols-5">
                {claves.map((c) => (
                    <div key={c.label} className={cn('min-w-0 rounded-lg border px-3 py-2', c.alerta ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/30')}>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">{c.icono} {c.label}</p>
                        <p className={cn('truncate text-sm font-semibold', c.alerta && 'text-destructive', vacio(c.valor) && 'font-normal text-muted-foreground')} title={typeof c.valor === 'string' ? c.valor : undefined}>
                            {vacio(c.valor) ? '—' : c.valor}{c.alerta ? ' · vencida' : ''}
                        </p>
                    </div>
                ))}
            </div>

            {/* Secciones: una columna en panel angosto, dos cuando hay espacio */}
            <div className="grid gap-3 @3xl:grid-cols-2">
                <Seccion titulo="Identificación" campos={[
                    ['Código', <b key="c">{e.codigo}</b>],
                    ['Nombre', e.nombre],
                    ['Tipo', e.tipo],
                    ['Sigla / Correlativo', [e.sigla, e.correlativo].filter((x) => x !== null && x !== undefined && x !== '').join(' · ')],
                    ['Versión', e.version],
                ]} />
                <Seccion titulo="Verificación" campos={[
                    ['Última revisión', fmtFecha(e.ultima_verificacion)],
                    ['Siguiente revisión', vencida ? <span key="v" className="font-semibold text-destructive">{fmtFecha(e.siguiente_verificacion)} (vencida)</span> : fmtFecha(e.siguiente_verificacion)],
                    ['Plazo vigencia', e.plazo_vigencia],
                    ['Factor de corrección', siNo(e.tiene_fc)],
                    ['Error 0 / 15 / 30', [e.error0, e.error15, e.error30].some((x) => x !== null && x !== undefined) ? [e.error0, e.error15, e.error30].map(fmtNum).join(' / ') : ''],
                    ['FC 0 / 15 / 30', [e.fc0, e.fc15, e.fc30].some((x) => x !== null && x !== undefined) ? [e.fc0, e.fc15, e.fc30].map(fmtNum).join(' / ') : ''],
                ]} />
                <Seccion titulo="Estado y responsable" campos={[
                    ['Estado', e.estado_equipo || e.estado],
                    ['Responsable', e.nombre_asignado ? `${e.nombre_asignado}${e.habilitado_muestreador === 'N' ? ' (Inactivo)' : ''}` : ''],
                    ['Equipo asociado', e.equipo_asociado && e.equipo_asociado !== '0' ? e.equipo_asociado : 'No Aplica'],
                ]} />
                <Seccion titulo="Configuración técnica" campos={[
                    ['¿Qué mide?', e.que_mide],
                    ['Unidad de medida', [e.unidad_medida_textual, e.unidad_medida_sigla ? `(${e.unidad_medida_sigla})` : ''].filter(Boolean).join(' ')],
                    ['Visible para muestreadores', siNo(e.visible_muestreador)],
                    ['Incluir en informe', siNo(e.informe)],
                ]} />
                <Seccion titulo="Inventario" campos={[
                    ['Marca', e.marca],
                    ['Modelo', e.modelo],
                    ['N° de serie', e.n_serie],
                    ['Influencia significativa', e.influencia_significativa],
                    ['Justificación', e.justificacion_influencia],
                ]} />
                <Seccion titulo="Compra y baja" campos={[
                    ['Proveedor', e.proveedor],
                    ['Fecha de compra', fmtFecha(e.fecha_compra)],
                    ['Documento', [e.documento_compra, e.n_documento_compra].filter(Boolean).join(' N° ')],
                    ['Valor unitario', e.valor_unitario !== null && e.valor_unitario !== undefined ? `$ ${Number(e.valor_unitario).toLocaleString('es-CL')}` : ''],
                    ['Fecha dado de baja', fmtFecha(e.fecha_baja)],
                ]} />
                <div className="overflow-hidden rounded-lg border border-border">
                    <div className="bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documento de la revisión</div>
                    <div className="flex items-center gap-3 px-3 py-3 text-sm">
                        {e.documento_ruta ? (
                            <>
                                <IconFileDescription size={20} className="shrink-0 text-primary" />
                                <span className="min-w-0 flex-1 truncate" title={e.documento_nombre || ''}>{e.documento_nombre || 'Documento'}</span>
                                <Button size="sm" variant="outline" className="h-7" onClick={verDocumento} disabled={descargando}>
                                    <IconDownload size={14} /> Descargar
                                </Button>
                            </>
                        ) : <span className="text-muted-foreground">Sin documento adjunto</span>}
                    </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border @3xl:col-span-2">
                    <div className="bg-muted/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observación</div>
                    <p className="max-h-60 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-sm">{e.observacion?.trim() || <span className="text-muted-foreground">—</span>}</p>
                </div>
            </div>
        </div>
    );
};
