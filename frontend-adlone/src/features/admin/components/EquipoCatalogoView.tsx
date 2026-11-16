import { useConfirmacion } from '@/components/ui/confirm-dialog';
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Ellipsis } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { AdvancedDataTable, DataTableColumnHeader } from '@/components/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '../../../components/layout/PageHeader';
import { IconPlus, IconEdit, IconTrash, IconPencil } from '@tabler/icons-react';
import { equipoService } from '../services/equipo.service';
import { useToast } from '../../../contexts/ToastContext';

interface CatalogItem {
    id_equipocatalogo?: number;
    nombre: string;
    que_mide: string;
    unidad_medida_textual: string;
    unidad_medida_sigla: string;
    tipo_equipo: string;
}

interface Props {
    onBack: () => void;
}

export const EquipoCatalogoView: React.FC<Props> = ({ onBack }) => {
    const { confirmar, dialogo: dialogoConfirmacion } = useConfirmacion();
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [formData, setFormData] = useState<CatalogItem>({
        nombre: '',
        que_mide: '',
        unidad_medida_textual: '',
        unidad_medida_sigla: '',
        tipo_equipo: ''
    });
    const [isSiglaManual, setIsSiglaManual] = useState(false);
    const [formInicial, setFormInicial] = useState<CatalogItem | null>(null);

    const { showToast } = useToast();

    const fetchItems = async () => {
        setLoading(true);
        try {
            const res = await equipoService.getEquipoCatalogo();
            if (res.success) {
                setItems(res.data);
            }
        } catch (error) {
            console.error('Error fetching catalog:', error);
            showToast({ type: 'error', message: 'Error al cargar el catálogo' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const autoGenerateSigla = (text: string) => {
        if (!text) return '';
        return text.split(',')
            .map(part => part.trim()
                .replace(/^(Unid\. de |Unidades de |Grados |de |en )/i, '')
            )
            .filter(part => part.length > 0)
            .join('/');
    };

    useEffect(() => {
        if (showForm && !isSiglaManual) {
            const suggestedSigla = autoGenerateSigla(formData.unidad_medida_textual);
            setFormData(prev => ({ ...prev, unidad_medida_sigla: suggestedSigla }));
        }
    }, [formData.unidad_medida_textual, showForm, isSiglaManual]);

    const handleEdit = (item: CatalogItem) => {
        setEditingItem(item);
        setFormData(item);
        setFormInicial(item);
        setIsSiglaManual(true);
        setShowForm(true);
    };

    const VACIO: CatalogItem = { nombre: '', que_mide: '', unidad_medida_textual: '', unidad_medida_sigla: '', tipo_equipo: '' };
    const handleNuevo = () => {
        setEditingItem(null);
        setFormData(VACIO);
        setFormInicial(VACIO);
        setIsSiglaManual(false);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!(await confirmar({ titulo: 'Eliminar elemento', mensaje: '¿Eliminar este elemento del catálogo?', textoConfirmar: 'Eliminar', peligro: true }))) return;

        try {
            const res = await equipoService.deleteEquipoCatalogo(id);
            if (res.success) {
                showToast({ type: 'success', message: 'Elemento eliminado' });
                fetchItems();
            }
        } catch (error) {
            console.error('Error deleting item:', error);
            showToast({ type: 'error', message: 'Error al eliminar el elemento' });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let res;
            if (editingItem?.id_equipocatalogo) {
                res = await equipoService.updateEquipoCatalogo(editingItem.id_equipocatalogo, formData);
            } else {
                res = await equipoService.createEquipoCatalogo(formData);
            }

            if (res.success) {
                showToast({
                    type: 'success',
                    message: editingItem ? 'Elemento actualizado' : 'Elemento creado'
                });
                setShowForm(false);
                fetchItems();
            }
        } catch (error) {
            console.error('Error saving item:', error);
            showToast({ type: 'error', message: 'Error al guardar el elemento' });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingItem(null);
        setFormData(VACIO);
        setFormInicial(null);
        setIsSiglaManual(false);
    };

    const sucio = JSON.stringify(formData) !== JSON.stringify(formInicial ?? VACIO);
    const salirDelFormulario = async () => {
        if (sucio && !(await confirmar({ titulo: 'Cambios sin guardar', mensaje: 'Si sales ahora se pierden los cambios que hiciste.', textoConfirmar: 'Salir sin guardar', textoCancelar: 'Seguir editando', peligro: true }))) return;
        handleCancel();
    };

    const columnas: ColumnDef<CatalogItem>[] = [
        {
            id: 'nombre',
            meta: { titulo: 'Nombre' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" />,
            accessorFn: (i) => i.nombre || '',
            cell: ({ row }) => <span className="ps-2 text-sm font-medium">{row.original.nombre}</span>,
        },
        {
            id: 'tipo',
            meta: { titulo: 'Tipo' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            accessorFn: (i) => i.tipo_equipo || '',
            filterFn: (row, id, valor: string[]) => valor.includes(row.getValue(id)),
            cell: ({ row }) => <span className="ps-2 text-sm">{row.original.tipo_equipo || '—'}</span>,
        },
        {
            id: 'que_mide',
            meta: { titulo: 'Qué mide', className: 'hidden md:table-cell' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Qué mide" />,
            accessorFn: (i) => i.que_mide || '',
            cell: ({ row }) => <span className="ps-2 text-sm text-muted-foreground">{row.original.que_mide || '—'}</span>,
        },
        {
            id: 'sigla',
            meta: { titulo: 'Sigla', className: 'hidden lg:table-cell' },
            header: ({ column }) => <DataTableColumnHeader column={column} title="Sigla" />,
            accessorFn: (i) => i.unidad_medida_sigla || '',
            cell: ({ row }) => <span className="ps-2 font-mono text-xs">{row.original.unidad_medida_sigla || '—'}</span>,
        },
        {
            id: 'acciones',
            enableHiding: false,
            enableSorting: false,
            header: () => null,
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex h-8 w-8 p-0 data-[state=open]:bg-muted">
                            <Ellipsis className="h-4 w-4" />
                            <span className="sr-only">Abrir menú de {row.original.nombre}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px]">
                        <DropdownMenuItem onSelect={() => handleEdit(row.original)}>
                            Editar <span className="ms-auto"><IconEdit size={16} /></span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => handleDelete(row.original.id_equipocatalogo!)} className="text-red-500">
                            Eliminar <span className="ms-auto"><IconTrash size={16} /></span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const tiposUsados = [...new Set(items.map((i) => i.tipo_equipo).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'es', { sensitivity: 'base' }));

    if (showForm) {
        const campos = formData.nombre.trim() && formData.tipo_equipo.trim() && formData.que_mide.trim() && formData.unidad_medida_textual.trim();
        return (
            <form onSubmit={handleSubmit} className="shadcn-scope w-full p-4 md:p-6">
                {dialogoConfirmacion}
                <PageHeader
                    title={editingItem ? 'Editar modelo' : 'Nuevo modelo de equipo'}
                    subtitle="Defina los parámetros técnicos del modelo en el catálogo maestro."
                    breadcrumbItems={[
                        { label: 'Admin. Información', onClick: onBack },
                        { label: 'Catálogo de equipos', onClick: salirDelFormulario },
                        { label: editingItem ? 'Editar' : 'Nuevo' },
                    ]}
                />

                <Card className="mt-6">
                    <CardContent className="grid grid-cols-1 gap-5 p-5 sm:grid-cols-2">
                        <Field label="Nombre del equipo" required hint="Nombre principal que identifica al modelo">
                            <Input placeholder="Ej: MULTIPARAMETRO" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
                        </Field>
                        <Field label="Tipo de equipo" required hint="Categoría técnica del equipo">
                            <Input placeholder="Ej: Sonda, Sensor, Medidor" value={formData.tipo_equipo} onChange={(e) => setFormData({ ...formData, tipo_equipo: e.target.value })} />
                        </Field>
                        <Field label="Qué mide (variables)" required hint="Variables que el equipo registra">
                            <Input placeholder="Ej: pH, Temperatura, Turbiedad" value={formData.que_mide} onChange={(e) => setFormData({ ...formData, que_mide: e.target.value })} />
                        </Field>
                        <Field label="Unidad de medida (detallada)" required hint="Descripción formal de las unidades">
                            <Input placeholder="Ej: Unid. de pH, Grados Celsius, NTU" value={formData.unidad_medida_textual} onChange={(e) => setFormData({ ...formData, unidad_medida_textual: e.target.value })} />
                        </Field>
                        <Field label="Sigla de la unidad" hint="Versión abreviada; se sugiere sola a partir de la unidad detallada">
                            <div className="relative">
                                <Input
                                    placeholder="Ej: pH/°C/NTU"
                                    value={formData.unidad_medida_sigla}
                                    onChange={(e) => { setIsSiglaManual(true); setFormData({ ...formData, unidad_medida_sigla: e.target.value }); }}
                                    className={isSiglaManual ? 'pr-9' : undefined}
                                />
                                {isSiglaManual && (
                                    <span title="Editada manualmente" className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-help text-muted-foreground">
                                        <IconPencil size={14} />
                                    </span>
                                )}
                            </div>
                        </Field>
                    </CardContent>
                </Card>

                <div className="sticky bottom-0 z-10 -mx-4 mt-6 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                    <div className="mx-auto flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <span className={'size-1.5 rounded-full ' + (sucio ? 'bg-[var(--sc-mark)]' : 'bg-muted-foreground/40')} />
                            {sucio ? 'Cambios sin guardar' : 'Sin cambios'}
                        </span>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={salirDelFormulario} disabled={loading}>{editingItem ? 'Descartar' : 'Cancelar'}</Button>
                            <Button type="submit" disabled={loading || !campos || (!!editingItem && !sucio)}>
                                {loading ? 'Guardando...' : editingItem ? 'Guardar cambios' : 'Crear modelo'}
                            </Button>
                        </div>
                    </div>
                </div>
            </form>
        );
    }

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            {dialogoConfirmacion}
            <PageHeader
                title="Catálogo de equipos"
                subtitle="Administre los modelos autorizados con sus especificaciones para el inventario."
                breadcrumbItems={[{ label: 'Admin. Información', onClick: onBack }, { label: 'Catálogo de equipos' }]}
                rightSection={
                    <Button className="space-x-1" onClick={handleNuevo}>
                        <span>Nuevo modelo</span> <IconPlus size={18} />
                    </Button>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <AdvancedDataTable
                    columns={columnas}
                    data={items}
                    getRowId={(i) => String(i.id_equipocatalogo)}
                    cargando={loading}
                    pageSize={10}
                    mensajeVacio="No hay modelos en el catálogo"
                    busqueda={{
                        placeholder: 'Buscar por nombre, tipo o variable...',
                        texto: (i) => [i.nombre, i.tipo_equipo, i.que_mide, i.unidad_medida_sigla].filter(Boolean).join(' '),
                    }}
                    filtros={[{ columna: 'tipo', titulo: 'Tipo', opciones: tiposUsados.map((t) => ({ label: t, value: t })) }]}
                />
            </div>
        </div>
    );
};

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {label}{required && <span className="text-destructive"> *</span>}
            </Label>
            {children}
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}
