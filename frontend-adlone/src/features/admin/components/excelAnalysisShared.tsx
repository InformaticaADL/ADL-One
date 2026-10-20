import React, { useState } from 'react';
import { IconCheck, IconArrowLeft, IconDatabase, IconFileSpreadsheet, IconSearch, IconRefresh } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// Piezas visuales compartidas entre los modales de análisis de Excel
// (equipos e inventario, temperatura) para no duplicar el mismo patrón de
// tarjetas de resumen + badge de estado en cada uno.

// Al actualizar un equipo desde cualquiera de los dos analizadores, si ya
// tenía una observación guardada (ej. desde el otro analizador), se conserva
// y la nueva se agrega debajo con un guion y la fecha de la actualización —
// nunca se sobreescribe la observación existente.
export const appendObservacion = (actual: string | null | undefined, nueva: string): string => {
    const limpia = actual && actual.trim() ? actual.trim() : '';
    const hoy = new Date();
    const fecha = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    const linea = `- [${fecha}] ${nueva}`;
    return limpia ? `${limpia}\n${linea}` : linea;
};

export type EstadoBadgeTono = 'success' | 'warning' | 'destructive';

export interface EstadoMeta {
    label: string;
    badge: EstadoBadgeTono;
}

// Texto plano, sin ícono — mismo patrón que los Badge de estado en el resto
// de la app (ver getStatusBadgeVariant en EquiposPage.tsx: siempre
// <Badge variant={...}>{texto}</Badge>, nunca con ícono adentro).
export function EstadoBadge<TStatus extends string>({
    status,
    meta,
}: {
    status: TStatus;
    meta: Record<TStatus, EstadoMeta>;
}) {
    const m = meta[status];
    return (
        <Badge variant={m.badge}>
            {m.label}
        </Badge>
    );
}

// Doble de clicable: cuando trae onClick, funciona como filtro rápido por
// estado — un segundo clic sobre el mismo (active=true) lo quita.
export const StatCard: React.FC<{
    label: string;
    value: number;
    tone: 'default' | 'success' | 'warning' | 'destructive';
    onClick?: () => void;
    active?: boolean;
}> = ({ label, value, tone, onClick, active }) => (
    <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
        className={cn(
            'flex flex-1 flex-col gap-0.5 rounded-lg border px-3 py-2 transition-shadow',
            tone === 'default' && 'border-border bg-muted/30',
            tone === 'success' && 'border-success/20 bg-success/10',
            tone === 'warning' && 'border-warning/20 bg-warning/10',
            tone === 'destructive' && 'border-destructive/20 bg-destructive/10',
            onClick && 'cursor-pointer hover:brightness-95',
            active && 'ring-2 ring-primary ring-offset-1'
        )}
    >
        <span className={cn(
            'text-xl font-semibold leading-none',
            tone === 'success' && 'text-success',
            tone === 'warning' && 'text-warning',
            tone === 'destructive' && 'text-destructive'
        )}>
            {value}
        </span>
        <span className="text-xs text-muted-foreground">{label}</span>
    </div>
);

// Botón de lupa que despliega un cuadro de búsqueda flotante (Popover) — filtra
// en vivo sobre el array ya cargado en memoria, sin pegarle al backend.
export const BusquedaFlotante: React.FC<{
    valor: string;
    onChange: (v: string) => void;
    placeholder?: string;
}> = ({ valor, onChange, placeholder }) => {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    aria-label="Buscar"
                    className={cn(valor && 'border-primary text-primary')}
                >
                    <IconSearch size={15} />
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-3">
                <div className="relative">
                    <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        autoFocus
                        placeholder={placeholder || 'Buscar por código o nombre...'}
                        value={valor}
                        onChange={(e) => onChange(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
};

export interface DiffRow {
    campo: string;
    etiqueta: string;
    valorExcel: unknown;
    valorBD: unknown;
}

// Campos que se guardan como número crudo en la BD pero se muestran como
// peso chileno ($184.400) en esta vista — solo formato visual, no toca el dato.
const CAMPOS_MONEDA = ['valor_unitario'];

// Mismo patrón que fmtClp en el módulo de Facturación ("$ " + miles con punto).
const formatPeso = (v: unknown) => {
    const n = Number(v);
    if (Number.isNaN(n)) return String(v);
    return `$ ${n.toLocaleString('es-CL', { maximumFractionDigits: 0 })}`;
};

const formatearValorDiff = (v: unknown, campo?: string) => {
    if (v === null || v === undefined || v === '') return '—';
    if (campo && CAMPOS_MONEDA.includes(campo)) return formatPeso(v);
    return String(v);
};

// Un panel ("ventana") con una lista de campo: valor — usado dos veces en
// DiffDetailView, una para lo actual y otra para lo nuevo.
const PanelCampos: React.FC<{
    titulo: string;
    icon: React.ReactNode;
    tono: 'neutral' | 'cambio';
    filas: { campo: string; etiqueta: string; valor: unknown }[];
}> = ({ titulo, icon, tono, filas }) => (
    <div className={cn(
        'flex min-w-0 flex-1 flex-col gap-3 rounded-lg border p-4',
        tono === 'neutral' ? 'border-border bg-muted/20' : 'border-warning/30 bg-warning/5'
    )}>
        <div className="flex items-center gap-2">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', tono === 'neutral' ? 'bg-muted text-muted-foreground' : 'bg-warning/15 text-warning')}>
                {icon}
            </span>
            <h5 className="text-sm font-semibold">{titulo}</h5>
        </div>
        <dl className="flex flex-col divide-y divide-border">
            {filas.map((f) => (
                <div key={f.etiqueta} className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0">
                    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{f.etiqueta}</dt>
                    <dd className={cn('text-sm', tono === 'cambio' && 'font-medium text-warning')}>{formatearValorDiff(f.valor, f.campo)}</dd>
                </div>
            ))}
            {filas.length === 0 && <p className="py-2 text-xs italic text-muted-foreground">Sin diferencias.</p>}
        </dl>
    </div>
);

// Vista de detalle compartida: "Ver" en una fila con diferencias abre esto en
// vez de la tabla de resultados — dos paneles lado a lado (uno con lo que hay
// hoy en la BD, otro con lo que trae el Excel) en vez de una sola tabla, para
// que se lean como dos "ventanas" separadas de un vistazo. El botón "Volver"
// solo cambia de vista (no vuelve a analizar ni pierde el estado de la
// lista) — quien lo use sigue viendo exactamente el mismo análisis.
export const DiffDetailView: React.FC<{
    titulo: string;
    subtitulo?: string;
    diffs: DiffRow[];
    onBack: () => void;
    children?: React.ReactNode;
}> = ({ titulo, subtitulo, diffs, onBack, children }) => (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
            <IconArrowLeft size={14} /> Volver a resultados
        </Button>
        <div>
            <h4 className="text-base font-semibold">{titulo}</h4>
            {subtitulo && <p className="text-xs text-muted-foreground">{subtitulo}</p>}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <PanelCampos
                titulo="Actual (Base de Datos)"
                icon={<IconDatabase size={15} />}
                tono="neutral"
                filas={diffs.map((d) => ({ campo: d.campo, etiqueta: d.etiqueta, valor: d.valorBD }))}
            />
            <PanelCampos
                titulo="Nuevo (Excel)"
                icon={<IconFileSpreadsheet size={15} />}
                tono="cambio"
                filas={diffs.map((d) => ({ campo: d.campo, etiqueta: d.etiqueta, valor: d.valorExcel }))}
            />
        </div>
        {children && <div className="flex justify-end gap-2">{children}</div>}
    </div>
);

export interface LoteItemResultado {
    rowNumber: number;
    codigo: string | null;
    nombre: string | null;
    estado: 'ok' | 'error';
    mensaje?: string;
}

// Clave de localStorage + forma guardada: respalda el progreso de un lote
// ("Subir Todo"/"Actualizar Todo") para que un cierre accidental de pestaña o
// una recarga a mitad de camino no borre el resultado — al reabrir el modal
// se detecta esta entrada pendiente y se muestra LoteResultadoView de nuevo.
export interface LoteGuardado {
    tipo: string;
    items: LoteItemResultado[];
    terminado: boolean;
    timestamp: number;
}

export const guardarLote = (key: string, lote: LoteGuardado) => {
    try { localStorage.setItem(key, JSON.stringify(lote)); } catch { /* localStorage no disponible, no es crítico */ }
};
export const leerLote = (key: string): LoteGuardado | null => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as LoteGuardado) : null;
    } catch { return null; }
};
export const limpiarLote = (key: string) => {
    try { localStorage.removeItem(key); } catch { /* ídem */ }
};

// Pantalla que se muestra al terminar un lote: resumen + detalle de los que
// fallaron (con botón para reintentar cada uno) + un botón "Confirmar" que
// recién ahí limpia el respaldo de localStorage y vuelve a los resultados.
export const LoteResultadoView: React.FC<{
    titulo: string;
    items: LoteItemResultado[];
    onReintentar: (item: LoteItemResultado) => void;
    reintentando: number | null;
    onConfirmar: () => void;
}> = ({ titulo, items, onReintentar, reintentando, onConfirmar }) => {
    const exitosos = items.filter((i) => i.estado === 'ok');
    const fallidos = items.filter((i) => i.estado === 'error');
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            <div>
                <h4 className="text-base font-semibold">{titulo}</h4>
                <p className="text-sm text-muted-foreground">
                    <span className="text-success">{exitosos.length} exitoso(s)</span>
                    {fallidos.length > 0 && <>, <span className="text-destructive">{fallidos.length} con error</span></>}
                </p>
            </div>

            {fallidos.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-destructive/30 bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Código</TableHead>
                                <TableHead>Nombre</TableHead>
                                <TableHead>Error</TableHead>
                                <TableHead className="text-right">Acción</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fallidos.map((f) => (
                                <TableRow key={f.rowNumber}>
                                    <TableCell className="text-sm font-semibold text-foreground">{f.codigo || '—'}</TableCell>
                                    <TableCell className="font-medium text-foreground">{f.nombre || '—'}</TableCell>
                                    <TableCell className="max-w-xs text-xs text-destructive">{f.mensaje}</TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => onReintentar(f)}
                                            disabled={reintentando === f.rowNumber}
                                        >
                                            {reintentando === f.rowNumber ? (
                                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                            ) : (
                                                <IconRefresh size={14} />
                                            )}
                                            Reintentar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Button className="self-end" onClick={onConfirmar}>
                <IconCheck size={14} /> Confirmar Actualización
            </Button>
        </div>
    );
};
