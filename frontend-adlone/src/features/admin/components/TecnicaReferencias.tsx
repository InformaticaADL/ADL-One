import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconCheck, IconEdit, IconPlus, IconPower } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { catalogosService } from '../../medio-ambiente/services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';

const REF_TABLE = 'App_Ma_ReferenciaAnalisis';
const REF_ID = 'id_referenciaanalisis';

interface Props {
    idTecnica: number;
}

interface RefForm {
    id_normativa: string;
    id_normativareferencia: string;
    limitemax_d: string;
    limitemax_h: string;
    llevaerror: 'S' | 'N';
    error_min: string;
    error_max: string;
    llevatraduccion: 'S' | 'N';
    traduccion_0: string;
    traduccion_1: string;
}

const EMPTY_FORM: RefForm = {
    id_normativa: '',
    id_normativareferencia: '',
    limitemax_d: '0',
    limitemax_h: '0',
    llevaerror: 'N',
    error_min: '0',
    error_max: '0',
    llevatraduccion: 'N',
    traduccion_0: '',
    traduccion_1: ''
};

const SI_NO = [
    { value: 'N', label: 'No' },
    { value: 'S', label: 'Sí' }
];

const trim = (v: unknown) => String(v ?? '').trim();
const num = (v: string) => (v.trim() === '' ? 0 : Number(v));

export const TecnicaReferencias: React.FC<Props> = ({ idTecnica }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [refs, setRefs] = useState<any[]>([]);
    const [normativas, setNormativas] = useState<any[]>([]);
    const [tablas, setTablas] = useState<any[]>([]);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<any | null>(null);
    const [form, setForm] = useState<RefForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [allRefs, norm, tab] = await Promise.all([
                catalogosService.getMaestroData(REF_TABLE),
                catalogosService.getMaestroData('mae_normativa'),
                catalogosService.getMaestroData('mae_normativareferencia')
            ]);
            setRefs(allRefs.filter((r: any) => Number(r.id_tecnica) === Number(idTecnica)));
            setNormativas(norm);
            setTablas(tab);
        } catch {
            showToast({ type: 'error', message: 'No se pudieron cargar las referencias normativas' });
        } finally {
            setLoading(false);
        }
    }, [idTecnica, showToast]);

    useEffect(() => { load(); }, [load]);

    const normativaNombre = useMemo(() => {
        const m = new Map<number, string>();
        normativas.forEach(n => m.set(Number(n.id_normativa), trim(n.nombre_normativa)));
        return m;
    }, [normativas]);

    const tablaNombre = useMemo(() => {
        const m = new Map<number, string>();
        tablas.forEach(t => m.set(Number(t.id_normativareferencia), trim(t.nombre_normativareferencia)));
        return m;
    }, [tablas]);

    const normativaOptions = useMemo(
        () => normativas
            .filter(n => n.habilitado === 'S' || String(n.id_normativa) === form.id_normativa)
            .filter(n => Number(n.id_normativa) !== 0)
            .map(n => ({ value: String(n.id_normativa), label: trim(n.nombre_normativa) })),
        [normativas, form.id_normativa]
    );

    const tablaOptions = useMemo(
        () => tablas
            .filter(t => String(t.id_normativa) === form.id_normativa && Number(t.id_normativareferencia) !== 0)
            .filter(t => t.habilitado === 'S' || String(t.id_normativareferencia) === form.id_normativareferencia)
            .map(t => ({ value: String(t.id_normativareferencia), label: trim(t.nombre_normativareferencia) })),
        [tablas, form.id_normativa, form.id_normativareferencia]
    );

    const openCreate = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setDialogOpen(true);
    };

    const openEdit = (r: any) => {
        setEditing(r);
        setForm({
            id_normativa: String(r.id_normativa ?? ''),
            id_normativareferencia: String(r.id_normativareferencia ?? ''),
            limitemax_d: String(r.limitemax_d ?? 0),
            limitemax_h: String(r.limitemax_h ?? 0),
            llevaerror: r.llevaerror === 'S' ? 'S' : 'N',
            error_min: String(r.error_min ?? 0),
            error_max: String(r.error_max ?? 0),
            llevatraduccion: r.llevatraduccion === 'S' ? 'S' : 'N',
            traduccion_0: trim(r.traduccion_0),
            traduccion_1: trim(r.traduccion_1)
        });
        setDialogOpen(true);
    };

    const handleSave = async () => {
        if (!form.id_normativa || !form.id_normativareferencia) {
            showToast({ type: 'error', message: 'Seleccione la normativa y la tabla de referencia' });
            return;
        }
        const numbers = [form.limitemax_d, form.limitemax_h, form.error_min, form.error_max].map(num);
        if (numbers.some(n => Number.isNaN(n))) {
            showToast({ type: 'error', message: 'Los límites y errores deben ser numéricos' });
            return;
        }
        const [limitemax_d, limitemax_h, error_min, error_max] = numbers;
        if (limitemax_d > limitemax_h) {
            showToast({ type: 'error', message: 'El límite "desde" no puede ser mayor que el límite "hasta"' });
            return;
        }
        const duplicate = refs.some(r =>
            (!editing || r[REF_ID] !== editing[REF_ID]) &&
            String(r.id_normativa) === form.id_normativa &&
            String(r.id_normativareferencia) === form.id_normativareferencia
        );
        if (duplicate) {
            showToast({ type: 'error', message: 'Esta técnica ya tiene esa normativa y tabla de referencia' });
            return;
        }

        const payload = {
            id_tecnica: idTecnica,
            id_normativa: Number(form.id_normativa),
            id_normativareferencia: Number(form.id_normativareferencia),
            limitemax_d,
            limitemax_h,
            llevaerror: form.llevaerror,
            error_min: form.llevaerror === 'S' ? error_min : 0,
            error_max: form.llevaerror === 'S' ? error_max : 0,
            llevatraduccion: form.llevatraduccion,
            traduccion_0: form.llevatraduccion === 'S' ? form.traduccion_0 : '',
            traduccion_1: form.llevatraduccion === 'S' ? form.traduccion_1 : ''
        };

        setSaving(true);
        try {
            if (editing) {
                await catalogosService.updateMaestro(REF_TABLE, REF_ID, editing[REF_ID], payload);
                showToast({ type: 'success', message: 'Referencia actualizada' });
            } else {
                await catalogosService.createMaestro(REF_TABLE, { ...payload, habilitado: 'S', marca: false });
                showToast({ type: 'success', message: 'Referencia agregada' });
            }
            setDialogOpen(false);
            await load();
        } catch (err: any) {
            showToast({ type: 'error', message: err?.response?.data?.message || 'No se pudo guardar la referencia' });
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (r: any) => {
        const newStatus = r.habilitado === 'S' ? 'N' : 'S';
        try {
            await catalogosService.toggleMaestroStatus(REF_TABLE, REF_ID, r[REF_ID], 'habilitado', newStatus);
            setRefs(prev => prev.map(x => (x[REF_ID] === r[REF_ID] ? { ...x, habilitado: newStatus } : x)));
        } catch {
            showToast({ type: 'error', message: 'No se pudo cambiar el estado de la referencia' });
        }
    };

    const setField = (field: keyof RefForm, value: string) => setForm(prev => ({ ...prev, [field]: value }));

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h5 className="m-0 text-base font-semibold">Normativas y tablas de referencia</h5>
                    <p className="text-[13px] text-muted-foreground">
                        Límites que aplican a esta técnica según cada normativa (tabla {REF_TABLE}).
                    </p>
                </div>
                <Button type="button" onClick={openCreate}>
                    <IconPlus size={16} /> Agregar referencia
                </Button>
            </div>

            {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Cargando referencias...</p>
            ) : refs.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                    Esta técnica no tiene normativas asociadas.
                </p>
            ) : (
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Normativa</TableHead>
                                <TableHead>Tabla de referencia</TableHead>
                                <TableHead className="text-right">Límite desde</TableHead>
                                <TableHead className="text-right">Límite hasta</TableHead>
                                <TableHead>Error</TableHead>
                                <TableHead>Traducción</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {refs.map(r => (
                                <TableRow key={r[REF_ID]} className={r.habilitado === 'S' ? '' : 'opacity-60'}>
                                    <TableCell className="font-medium">{normativaNombre.get(Number(r.id_normativa)) || `#${r.id_normativa}`}</TableCell>
                                    <TableCell>{tablaNombre.get(Number(r.id_normativareferencia)) || `#${r.id_normativareferencia}`}</TableCell>
                                    <TableCell className="text-right tabular-nums">{r.limitemax_d}</TableCell>
                                    <TableCell className="text-right tabular-nums">{r.limitemax_h}</TableCell>
                                    <TableCell className="tabular-nums">
                                        {r.llevaerror === 'S' ? `${r.error_min} a ${r.error_max}` : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {r.llevatraduccion === 'S'
                                            ? `${trim(r.traduccion_0) || '—'} / ${trim(r.traduccion_1) || '—'}`
                                            : '—'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={r.habilitado === 'S' ? 'default' : 'outline'}>
                                            {r.habilitado === 'S' ? 'Habilitada' : 'Deshabilitada'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button type="button" variant="ghost" size="sm" title="Editar" onClick={() => openEdit(r)}>
                                                <IconEdit size={16} />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                title={r.habilitado === 'S' ? 'Deshabilitar' : 'Habilitar'}
                                                onClick={() => handleToggle(r)}
                                            >
                                                <IconPower size={16} />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open && !saving) setDialogOpen(false); }}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editing ? 'Editar referencia' : 'Agregar referencia'}</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="flex flex-col gap-1.5">
                            <Label>Normativa</Label>
                            <Combobox
                                placeholder="Seleccione normativa..."
                                searchPlaceholder="Buscar..."
                                options={normativaOptions}
                                value={form.id_normativa}
                                onValueChange={(v) => setForm(prev => ({ ...prev, id_normativa: v, id_normativareferencia: '' }))}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Tabla de referencia</Label>
                            <Combobox
                                placeholder={form.id_normativa ? 'Seleccione tabla...' : 'Primero elija la normativa'}
                                searchPlaceholder="Buscar..."
                                options={tablaOptions}
                                value={form.id_normativareferencia}
                                onValueChange={(v) => setField('id_normativareferencia', v)}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Límite desde</Label>
                            <Input type="number" step="any" value={form.limitemax_d} onChange={(e) => setField('limitemax_d', e.target.value)} />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Límite hasta</Label>
                            <Input type="number" step="any" value={form.limitemax_h} onChange={(e) => setField('limitemax_h', e.target.value)} />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Lleva error</Label>
                            <Combobox options={SI_NO} value={form.llevaerror} onValueChange={(v) => setField('llevaerror', v)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1.5">
                                <Label>Error mín.</Label>
                                <Input type="number" step="any" disabled={form.llevaerror !== 'S'} value={form.error_min} onChange={(e) => setField('error_min', e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Error máx.</Label>
                                <Input type="number" step="any" disabled={form.llevaerror !== 'S'} value={form.error_max} onChange={(e) => setField('error_max', e.target.value)} />
                            </div>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label>Lleva traducción</Label>
                            <Combobox options={SI_NO} value={form.llevatraduccion} onValueChange={(v) => setField('llevatraduccion', v)} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col gap-1.5">
                                <Label>Traducción 0</Label>
                                <Input maxLength={20} disabled={form.llevatraduccion !== 'S'} value={form.traduccion_0} onChange={(e) => setField('traduccion_0', e.target.value)} />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Traducción 1</Label>
                                <Input maxLength={20} disabled={form.llevatraduccion !== 'S'} value={form.traduccion_1} onChange={(e) => setField('traduccion_1', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button type="button" onClick={handleSave} disabled={saving}>
                            <IconCheck size={16} /> {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
