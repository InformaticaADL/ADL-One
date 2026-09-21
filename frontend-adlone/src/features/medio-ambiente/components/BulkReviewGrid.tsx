import React from 'react';
import {
    IconCheck,
    IconAlertTriangle,
    IconX,
    IconInfoCircle,
    IconFlask,
    IconEye,
    IconClipboardList,
    IconCodeDots,
    IconMapPin
} from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props {
    items: any[];
    selectedIndices: number[];
    onSelectChange: (indices: number[]) => void;
}

type LinkStatus = { status: 'loading' | 'ok' | 'warn' | 'invalid' | 'empty'; lat?: number; lon?: number };

export const BulkReviewGrid: React.FC<Props> = ({ items, selectedIndices, onSelectChange }) => {
    const [previewItem, setPreviewItem] = React.useState<any>(null);
    const [previewIndex, setPreviewIndex] = React.useState<number>(-1);
    const [linkStatuses, setLinkStatuses] = React.useState<Record<number, LinkStatus>>({});

    // "-" o vacío se consideran SIN enlace (no se validan en Google Maps)
    const cleanLink = (l?: string): string => {
        const t = (l || '').trim();
        return (t === '' || t === '-') ? '' : t;
    };

    // Auto-verify all Google Maps links when items load
    React.useEffect(() => {
        if (!items || items.length === 0) { setLinkStatuses({}); return; }

        const initialStatuses: Record<number, LinkStatus> = {};
        items.forEach((item, idx) => {
            const link = cleanLink(item.antecedentes?.refGoogle);
            initialStatuses[idx] = link ? { status: 'loading' } : { status: 'empty' };
        });
        setLinkStatuses(initialStatuses);

        items.forEach((item, idx) => {
            const link = cleanLink(item.antecedentes?.refGoogle);
            if (!link) return;
            apiClient.post('/api/fichas/verificar-link', { link })
                .then(({ data }) => {
                    const d = data?.data;
                    setLinkStatuses(prev => ({
                        ...prev,
                        [idx]: d?.ok ? { status: 'ok', lat: d.lat, lon: d.lon } : { status: 'warn' }
                    }));
                })
                .catch(() => {
                    setLinkStatuses(prev => ({ ...prev, [idx]: { status: 'warn' } }));
                });
        });
    }, [items]);

    const toggleAll = () => {
        if (selectedIndices.length === items.filter(i => i.status === 'READY' || i.status === 'WARNING').length) {
            onSelectChange([]);
        } else {
            onSelectChange(items.map((item, index) => (item.status === 'READY' || item.status === 'WARNING' ? index : -1)).filter(i => i !== -1));
        }
    };

    const toggleItem = (index: number) => {
        const item = items[index];
        if (!item || (item.status !== 'READY' && item.status !== 'WARNING')) return;
        if (selectedIndices.includes(index)) {
            onSelectChange(selectedIndices.filter(i => i !== index));
        } else {
            onSelectChange([...selectedIndices, index]);
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'READY': return <IconWrap color="#2f9e44" bg="rgba(47,158,68,0.12)"><IconCheck size={16} /></IconWrap>;
            case 'WARNING': return <IconWrap color="#f08c00" bg="rgba(240,140,0,0.12)"><IconAlertTriangle size={16} /></IconWrap>;
            case 'ERROR': return <IconWrap color="#e03131" bg="rgba(224,49,49,0.12)"><IconX size={16} /></IconWrap>;
            default: return null;
        }
    };

    const isAllSelected = items.length > 0 && selectedIndices.length === items.filter(i => i.status === 'READY' || i.status === 'WARNING').length;
    const hasIndeterminate = selectedIndices.length > 0 && !isAllSelected;

    const linkSummary = React.useMemo(() => {
        const vals = Object.values(linkStatuses);
        return {
            ok: vals.filter(v => v.status === 'ok').length,
            warn: vals.filter(v => v.status === 'warn').length,
            invalid: vals.filter(v => v.status === 'invalid').length,
            loading: vals.filter(v => v.status === 'loading').length,
            total: vals.filter(v => v.status !== 'empty').length,
        };
    }, [linkStatuses]);

    return (
        <div className="shadcn-scope">
            {linkSummary.total > 0 && (
                <InlineAlert type={linkSummary.warn > 0 || linkSummary.invalid > 0 ? 'warning' : 'success'} icon={<IconMapPin size={16} />} className="mb-2">
                    <div className="flex flex-wrap items-center gap-4">
                        <span className="text-xs font-semibold">Ubicaciones Google Maps:</span>
                        {linkSummary.loading > 0 && <span className="text-xs text-muted-foreground">Verificando {linkSummary.loading}…</span>}
                        {linkSummary.ok > 0 && <span className="text-xs text-success">✓ {linkSummary.ok} detectada{linkSummary.ok !== 1 ? 's' : ''}</span>}
                        {linkSummary.warn > 0 && <span className="text-xs text-[#e8590c]">⚠ {linkSummary.warn} sin coordenadas</span>}
                        {linkSummary.invalid > 0 && <span className="text-xs text-destructive">✗ {linkSummary.invalid} inválido{linkSummary.invalid !== 1 ? 's' : ''}</span>}
                        {linkSummary.warn > 0 && <span className="text-xs text-muted-foreground">(se guardarán sin coordenadas de ruta)</span>}
                    </div>
                </InlineAlert>
            )}

            <div className="max-h-[500px] overflow-auto rounded-lg border border-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10">
                                <Checkbox
                                    checked={hasIndeterminate ? 'indeterminate' : isAllSelected}
                                    onCheckedChange={toggleAll}
                                />
                            </TableHead>
                            <TableHead className="w-[60px] text-center">Estado</TableHead>
                            <TableHead className="w-[200px]">ID Muestra / Archivo</TableHead>
                            <TableHead className="w-40">Cliente</TableHead>
                            <TableHead className="w-40">Empresa Srv.</TableHead>
                            <TableHead className="w-[150px]">Fuente Emisora</TableHead>
                            <TableHead className="w-[130px]">Objetivo</TableHead>
                            <TableHead>Análisis (#)</TableHead>
                            <TableHead className="w-[90px]">UF Total</TableHead>
                            <TableHead className="w-[70px] text-center">Ubicación</TableHead>
                            <TableHead className="w-20 text-center">Problemas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                                    No hay elementos para mostrar
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, idx) => {
                                const ants = item.antecedentes || {};
                                const validAnalyses = item.analisis?.filter((a: any) => a._matched) || [];
                                const totalAnalyses = item.analisis?.length || 0;
                                const ls = linkStatuses[idx];
                                const hasErrors = item.errors?.length > 0 || item.analysisErrors?.length > 0;
                                const hasWarnings = item.warnings?.length > 0;
                                const problemCount = (item.errors?.length || 0) + (item.analysisErrors?.length || 0) + (item.warnings?.length || 0);

                                return (
                                    <TableRow key={idx} className={item.status === 'ERROR' ? 'bg-destructive/5 hover:bg-destructive/10' : undefined}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIndices.includes(idx)}
                                                onCheckedChange={() => toggleItem(idx)}
                                                disabled={item.status !== 'READY' && item.status !== 'WARNING'}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">{getStatusIcon(item.status)}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-nowrap items-center gap-2">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" title="Ver detalles extraídos" onClick={() => { setPreviewItem(item); setPreviewIndex(idx); }}>
                                                    <IconEye size={16} />
                                                </Button>
                                                <div className="min-w-0">
                                                    <span className="block max-w-[150px] truncate text-[13px] font-semibold" title={item.idMuestra || item.filename}>
                                                        {item.idMuestra || item.filename}
                                                    </span>
                                                    {item.excelRow && <span className="text-[10px] text-muted-foreground">fila Excel {item.excelRow}</span>}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {ants._clienteNombre
                                                ? <span className="block max-w-[140px] truncate text-xs" title={ants._clienteNombre}>{ants._clienteNombre}</span>
                                                : <span className="text-xs text-destructive">No encontrado</span>}
                                        </TableCell>
                                        <TableCell>
                                            <span className="block max-w-[140px] truncate text-xs text-muted-foreground" title={ants._empresaNombre || '-'}>{ants._empresaNombre || '-'}</span>
                                        </TableCell>
                                        <TableCell>
                                            {ants._fuenteNombre
                                                ? <span className="block max-w-[130px] truncate text-xs" title={ants._fuenteNombre}>{ants._fuenteNombre}</span>
                                                : <span className="text-xs text-destructive">No encontrado</span>}
                                        </TableCell>
                                        <TableCell>
                                            <span className="block max-w-[120px] truncate text-xs text-muted-foreground" title={ants._objetivoNombre || '-'}>{ants._objetivoNombre || '-'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={totalAnalyses === 0 ? 'destructive' : (validAnalyses.length === totalAnalyses ? 'default' : 'warning')}>
                                                    <IconFlask size={12} className="mr-1" />{validAnalyses.length} / {totalAnalyses}
                                                </Badge>
                                                {item._normativa && (
                                                    <Badge variant="outline" className="max-w-[150px] truncate" title={item._normativa}>{item._normativa}</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={cn('text-xs font-semibold', (item._ufTotal || 0) > 0 ? 'text-success' : 'text-muted-foreground')}>
                                                {(item._ufTotal || 0) > 0 ? `${Number(item._ufTotal).toFixed(2)} UF` : '-'}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {!ls || ls.status === 'empty' ? <span className="text-xs text-muted-foreground">-</span> : (
                                                ls.status === 'loading' ? (
                                                    <div className="mx-auto h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                                ) : ls.status === 'ok' ? (
                                                    <IconWrap color="#2f9e44" bg="rgba(47,158,68,0.12)" size={22} title={`Lat: ${ls.lat?.toFixed(5)} · Lon: ${ls.lon?.toFixed(5)}`}><IconCheck size={12} /></IconWrap>
                                                ) : ls.status === 'warn' ? (
                                                    <IconWrap color="#f08c00" bg="rgba(240,140,0,0.12)" size={22} title="Link válido pero sin coordenadas extraíbles. Se guardará sin ubicación de ruta."><IconAlertTriangle size={12} /></IconWrap>
                                                ) : (
                                                    <IconWrap color="#e03131" bg="rgba(224,49,49,0.12)" size={22} title="Link inválido."><IconX size={12} /></IconWrap>
                                                )
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {!hasErrors && !hasWarnings ? <span className="text-xs text-muted-foreground">-</span> : (
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="relative h-8 w-8">
                                                            <IconInfoCircle size={20} color={hasErrors ? '#e03131' : '#f08c00'} />
                                                            <span className={cn('absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white', hasErrors ? 'bg-destructive' : 'bg-[#f08c00]')}>
                                                                {problemCount}
                                                            </span>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="end" className="w-[350px] p-3">
                                                        <div className="flex flex-col gap-2">
                                                            {item.errors?.map((err: any, i: number) => (
                                                                <InlineAlert key={`err-${i}`} type="error" icon={<IconX size={16} />} title={err.field}>{err.message}</InlineAlert>
                                                            ))}
                                                            {item.analysisErrors?.map((err: any, i: number) => {
                                                                const msg = typeof err === 'string' ? err : (err?.message || JSON.stringify(err));
                                                                const title = (err && typeof err === 'object' && err.field) ? err.field : 'Análisis';
                                                                return (
                                                                    <InlineAlert key={`aerr-${i}`} type="warning" icon={<IconAlertTriangle size={16} />} title={title}>{msg}</InlineAlert>
                                                                );
                                                            })}
                                                            {item.warnings?.map((warn: any, i: number) => (
                                                                <InlineAlert key={`warn-${i}`} type="warning" icon={<IconAlertTriangle size={16} />} title={warn.field}>{warn.message}</InlineAlert>
                                                            ))}
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!previewItem} onOpenChange={(open) => { if (!open) { setPreviewItem(null); setPreviewIndex(-1); } }}>
                <DialogContent className="max-h-[85vh] w-[75vw] max-w-[1100px] overflow-y-auto p-0">
                    {previewItem && (
                        <>
                            <DialogHeader className="border-b border-border px-6 py-4">
                                <DialogTitle className="flex items-center gap-2">
                                    <IconEye size={20} className="text-[#1c7ed6]" />
                                    Vista Previa: {previewItem?.idMuestra || previewItem?.filename}
                                </DialogTitle>
                            </DialogHeader>

                            <Tabs defaultValue="antecedentes" className="px-4 pb-4">
                                <TabsList className="mt-3">
                                    <TabsTrigger value="antecedentes"><IconClipboardList size={18} className="mr-1.5" />Antecedentes</TabsTrigger>
                                    <TabsTrigger value="analisis"><IconFlask size={18} className="mr-1.5" />Análisis</TabsTrigger>
                                    <TabsTrigger value="auditoria"><IconCodeDots size={18} className="mr-1.5" />Auditoría de Match</TabsTrigger>
                                </TabsList>
                                <TabsContent value="antecedentes">
                                    <div className="rounded-lg bg-muted/40 p-6">
                                        <PreviewAntecedentes previewItem={previewItem} previewIndex={previewIndex} linkStatuses={linkStatuses} cleanLink={cleanLink} />
                                    </div>
                                </TabsContent>
                                <TabsContent value="analisis">
                                    <div className="rounded-lg bg-muted/40 p-6">
                                        <PreviewAnalisis previewItem={previewItem} />
                                    </div>
                                </TabsContent>
                                <TabsContent value="auditoria">
                                    <div className="p-6">
                                        <PreviewAuditoria previewItem={previewItem} />
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

function IconWrap({ children, color, bg, size = 24, title }: { children: React.ReactNode; color: string; bg: string; size?: number; title?: string }) {
    return (
        <div
            className="inline-flex items-center justify-center rounded-full"
            style={{ width: size, height: size, backgroundColor: bg, color }}
            title={title}
        >
            {children}
        </div>
    );
}

const INLINE_ALERT_TEXT_COLOR: Record<'success' | 'warning' | 'error' | 'info', string> = {
    success: 'text-success', warning: 'text-warning', error: 'text-destructive', info: 'text-primary',
};

function InlineAlert({ type, icon, title, children, className }: { type: 'success' | 'warning' | 'error' | 'info'; icon?: React.ReactNode; title?: string; children: React.ReactNode; className?: string }) {
    return (
        <Alert variant={type === 'error' ? 'destructive' : type} className={cn('py-2 text-xs', INLINE_ALERT_TEXT_COLOR[type], className)}>
            {icon}
            {title && <AlertTitle className="text-xs">{title}</AlertTitle>}
            <AlertDescription className="text-xs text-current">{children}</AlertDescription>
        </Alert>
    );
}

function StaticField({ label, value }: { label: string; value: any }) {
    return (
        <div>
            <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[11px] font-bold uppercase text-muted-foreground">{label}</span>
            <Card className="mt-0.5 p-2.5">
                <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold" title={String(value || '-')}>
                    {value || '-'}
                </span>
            </Card>
        </div>
    );
}

function SectionDivider({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">{children}</span>
            <div className="h-px flex-1 bg-border" />
        </div>
    );
}

function PreviewAntecedentes({ previewItem, previewIndex, linkStatuses, cleanLink }: { previewItem: any; previewIndex: number; linkStatuses: Record<number, LinkStatus>; cleanLink: (l?: string) => string }) {
    const ants = previewItem.antecedentes || {};
    return (
        <div className="flex flex-col gap-6">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Monitoreo" value={ants.tipoMonitoreo} />
                <StaticField label="Base Operaciones" value={ants._lugarNombre || 'No Aplica'} />
                <StaticField label="Cliente" value={ants._clienteNombre} />
                <StaticField label="Empresa Servicio" value={ants._empresaNombre} />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Fuente Emisora" value={ants._fuenteNombre} />
                <StaticField label="Código Centro" value={ants.codigoCentro} />
                <StaticField label="ID Centro" value={ants.idCentro || ants.selectedFuente} />
                <StaticField label="Tipo Agua" value={ants.tipoAgua} />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Comuna" value={ants.comuna} />
                <StaticField label="Región" value={ants.region} />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Contacto" value={ants.contactoNombre} />
                <StaticField label="E-mail" value={ants.contactoEmail} />
                <StaticField label="Objetivo" value={ants._objetivoNombre} />
                <StaticField label="Ubicación" value={ants.ubicacion} />
            </div>

            <StaticField label="Tabla / Glosa" value={ants.glosa} />

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Es ETFA" value={ants.esETFA || (ants.etfa ? 'Sí' : 'No')} />
                <StaticField label="Inspector" value={ants._inspectorNombre} />
                <StaticField label="Punto de Muestreo" value={ants.puntoMuestreo} />
                <StaticField label="Responsable" value={ants.responsableMuestreo} />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Instrumento" value={ants.instrumentoFull || ants.selectedInstrumento || '-'} />
                <StaticField label="Ref. Google Maps" value={(() => {
                    const ls = linkStatuses[previewIndex];
                    if (!cleanLink(ants.refGoogle)) return 'Sin enlace';
                    if (!ls || ls.status === 'loading') return '⏳ Verificando…';
                    if (ls.status === 'ok') return `✓ Lat: ${ls.lat?.toFixed(6)}, Lon: ${ls.lon?.toFixed(6)}`;
                    if (ls.status === 'warn') return '⚠ Sin coordenadas extraíbles';
                    return '✗ Link inválido';
                })()} />
                <StaticField label="Zona UTM" value={ants.zona} />
                <StaticField label="Coordenadas" value={ants.utmNorte && ants.utmEste ? `N ${ants.utmNorte} / E ${ants.utmEste}` : '-'} />
            </div>

            <SectionDivider>Frecuencia y Programación</SectionDivider>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Frecuencia" value={ants.frecuencia} />
                <StaticField label="Periodo" value={ants._periodoNombre} />
                <StaticField label="Factor" value={ants.factor} />
                <StaticField label="Total Servicios" value={ants.totalServicios} />
            </div>

            <SectionDivider>Detalles del Servicio</SectionDivider>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Componente" value={ants._componenteNombre} />
                <StaticField label="Sub Área" value={ants._subAreaNombre} />
                <StaticField label="Duración (hrs)" value={ants.duracion} />
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <StaticField label="Cargo" value={ants._cargoNombre || ants.cargoResponsable} />
                <StaticField label="Tipo Muestreo" value={ants._tipoMuestreoNombre} />
                <StaticField label="Medición Caudal" value={ants.medicionCaudal} />
                <StaticField label="Normativa" value={ants._normativaNombre} />
            </div>

            {ants.observaciones && (
                <InlineAlert type="info" icon={<IconInfoCircle size={16} />} title="Observaciones">{ants.observaciones}</InlineAlert>
            )}
        </div>
    );
}

function PreviewAnalisis({ previewItem }: { previewItem: any }) {
    const co = previewItem.costoOperativo || { activo: false, uf: 0 };
    const sumAnal = (previewItem.analisis || []).reduce((s: number, a: any) => s + (parseFloat(a.uf_individual) || 0), 0);
    const costoUF = co.activo ? Number(co.uf || 0) : 0;
    const ufTotal = sumAnal + costoUF;

    const rows = [...(previewItem.analisis || []), { __costoOperativo: true, costoUF }];

    return (
        <div className="flex flex-col gap-6">
            <Card className="bg-accent p-4">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
                    <div className="flex gap-1">
                        <span className="text-[11px] font-bold uppercase text-muted-foreground">Normativa (ficha):</span>
                        <span className="text-xs font-semibold">{previewItem._normativa || '-'}</span>
                    </div>
                    <div className="flex gap-1">
                        <span className="text-[11px] font-bold uppercase text-muted-foreground">Referencia (ficha):</span>
                        <span className="text-xs font-semibold">{previewItem._normativaRef || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold uppercase text-muted-foreground">Costo Operativo:</span>
                        <Badge variant={co.activo && costoUF > 0 ? 'warning' : 'outline'}>{co.activo && costoUF > 0 ? `${costoUF.toFixed(2)} UF` : 'No aplica'}</Badge>
                    </div>
                    <div className="flex gap-1">
                        <span className="text-[11px] font-bold uppercase text-muted-foreground">UF Total:</span>
                        <span className="text-xs font-semibold text-success">{ufTotal.toFixed(2)} UF</span>
                    </div>
                </div>
                <p className="mt-2 text-xs italic text-muted-foreground">
                    Cada análisis puede pertenecer a una normativa/tabla distinta. La normativa de la ficha es la dominante para la cabecera.
                </p>
            </Card>

            <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead>Estado Match</TableHead>
                            <TableHead>Análisis</TableHead>
                            <TableHead>Normativa</TableHead>
                            <TableHead>Tabla / Referencia</TableHead>
                            <TableHead>Tipo Muestra</TableHead>
                            <TableHead className="text-right">Límite Min</TableHead>
                            <TableHead className="text-right">Límite Max</TableHead>
                            <TableHead>Tipo Entrega</TableHead>
                            <TableHead>Lab. Principal</TableHead>
                            <TableHead className="text-right">UF Individual</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row: any, i: number) => (
                            <TableRow
                                key={i}
                                className={
                                    row.__costoOperativo
                                        ? (row.costoUF > 0 ? 'bg-warning/5 hover:bg-warning/10' : 'bg-muted/50 hover:bg-muted/50')
                                        : (!row._matched ? 'bg-warning/5 hover:bg-warning/10' : undefined)
                                }
                            >
                                <TableCell>
                                    {row.__costoOperativo ? (
                                        <Badge variant={row.costoUF > 0 ? 'warning' : 'outline'}>{row.costoUF > 0 ? 'Activo' : 'Inactivo'}</Badge>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <Badge variant={row._matched ? 'success' : 'destructive'}>{row._matched ? 'OK' : 'No Encontrado'}</Badge>
                                            {row._errors?.length > 0 && (
                                                <IconAlertTriangle size={14} className="cursor-help text-destructive" title={row._errors.join(', ')} />
                                            )}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {row.__costoOperativo
                                        ? <span className={cn('text-xs font-semibold', row.costoUF > 0 ? 'text-[#e8a600]' : 'text-muted-foreground')}>Costo Operativo</span>
                                        : <span className={cn('text-xs font-semibold', !row._matched && 'text-destructive')} title={row.nombre_original}>{row.nombre_original}</span>}
                                </TableCell>
                                <TableCell className="text-xs">{row.__costoOperativo ? <span className="text-muted-foreground">—</span> : <span title={row.nombre_normativa || row._normativaNombre || previewItem._normativa || '-'}>{row.nombre_normativa || row._normativaNombre || previewItem._normativa || '-'}</span>}</TableCell>
                                <TableCell className="text-xs">{row.__costoOperativo ? <span className="text-muted-foreground">—</span> : <span title={row.nombre_normativareferencia || row._normativaRefNombre || previewItem._normativaRef || '-'}>{row.nombre_normativareferencia || row._normativaRefNombre || previewItem._normativaRef || '-'}</span>}</TableCell>
                                <TableCell className="text-xs">{row.__costoOperativo ? <span className="text-muted-foreground">—</span> : row.tipo_analisis}</TableCell>
                                <TableCell className="text-right text-xs">{row.__costoOperativo ? <span className="text-muted-foreground">—</span> : row.limitemax_d}</TableCell>
                                <TableCell className="text-right text-xs">{row.__costoOperativo ? <span className="text-muted-foreground">—</span> : row.limitemax_h}</TableCell>
                                <TableCell className="text-xs">{row.__costoOperativo ? <span className="text-muted-foreground">—</span> : row.tipo_entrega_texto}</TableCell>
                                <TableCell className="text-xs">{row.__costoOperativo ? <span className="text-muted-foreground">—</span> : row.laboratorio_texto}</TableCell>
                                <TableCell className="text-right">
                                    {row.__costoOperativo ? (
                                        <span className={cn('text-xs font-semibold', row.costoUF > 0 ? 'text-[#e8a600]' : 'text-muted-foreground')}>{row.costoUF > 0 ? row.costoUF.toFixed(2) : 'No aplica'}</span>
                                    ) : (
                                        <span className={cn('text-xs font-semibold', row.uf_individual > 0 ? 'text-success' : 'text-muted-foreground')}>
                                            {row.uf_individual > 0 ? parseFloat(row.uf_individual).toFixed(2) : '-'}
                                        </span>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function PreviewAuditoria({ previewItem }: { previewItem: any }) {
    return (
        <div className="mt-4">
            <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">MODO DESARROLLADOR: AUDITORÍA DE EXTRACCIÓN Y MATCH</span>
            <div className="mb-2 grid grid-cols-3 gap-2">
                <div>
                    <span className="block text-[10px] font-semibold">Cliente Match</span>
                    <Badge variant="outline">{previewItem.antecedentes?._clienteMatch_method || 'fuzzy'}</Badge>
                </div>
                <div>
                    <span className="block text-[10px] font-semibold">Fuente Match</span>
                    <Badge variant="outline">{previewItem.antecedentes?._fuenteMatch_method || 'fuzzy'}</Badge>
                </div>
                <div>
                    <span className="block text-[10px] font-semibold">Sede Match</span>
                    <Badge variant="outline">{previewItem.antecedentes?._lugarMatch_method || 'fuzzy'}</Badge>
                </div>
            </div>
            <div className="max-h-[300px] overflow-auto">
                <pre className="m-0 rounded border border-border bg-muted/50 p-2.5 text-[11px] text-foreground">
                    {JSON.stringify(
                        {
                            insert_payload: {
                                encabezado: previewItem.antecedentes,
                                analisis: previewItem.analisis.map((a: any) => ({
                                    ra_id: a.id_referenciaanalisis,
                                    tec_id: a.id_tecnica,
                                    lab_id: a.id_laboratorioensayo,
                                    tipo: a.tipo_analisis
                                }))
                            }
                        },
                        null, 2)}
                </pre>
            </div>
        </div>
    );
}
