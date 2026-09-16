import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
    IconPlus,
    IconEdit,
    IconTrash,
    IconArrowLeft,
    IconDeviceFloppy,
    IconX,
    IconSearch,
    IconListNumbers,
    IconPencil
} from '@tabler/icons-react';
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
    const [items, setItems] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState<CatalogItem>({
        nombre: '',
        que_mide: '',
        unidad_medida_textual: '',
        unidad_medida_sigla: '',
        tipo_equipo: ''
    });
    const [isSiglaManual, setIsSiglaManual] = useState(false);

    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

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
        setIsSiglaManual(true);
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('¿Estás seguro de eliminar este elemento del catálogo?')) return;

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

    const filteredItems = items.filter(item =>
        item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tipo_equipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.que_mide.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleCancel = () => {
        setShowForm(false);
        setEditingItem(null);
        setFormData({ nombre: '', que_mide: '', unidad_medida_textual: '', unidad_medida_sigla: '', tipo_equipo: '' });
        setIsSiglaManual(false);
    };

    const emptyMessage = loading ? 'Cargando datos...' : (searchTerm ? 'No se encontraron coincidencias.' : 'El catálogo está vacío.');

    return (
        <div className="shadcn-scope mx-auto w-full max-w-[1100px] p-2 md:p-4">
            <Card className="relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/60">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                )}

                <CardContent className="flex flex-col gap-6 p-4 md:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className={cnFlex(isMobile)}>
                            <div className={`flex items-center gap-2 ${isMobile ? 'flex-wrap justify-center' : 'justify-start'}`}>
                                <IconListNumbers size={28} className="shrink-0 text-primary" />
                                <h3 className={`m-0 font-semibold leading-tight ${isMobile ? 'text-lg text-center' : 'text-xl'}`}>
                                    {showForm ? (editingItem ? 'Editar Modelo' : 'Nuevo Modelo de Equipo') : 'Gestión de Catálogo'}
                                </h3>
                            </div>
                            <p className={`text-[13px] text-muted-foreground ${isMobile ? 'text-center' : 'text-left'}`}>
                                {showForm
                                    ? 'Defina los parámetros técnicos del modelo en el catálogo maestro.'
                                    : 'Administre los modelos autorizados con sus especificaciones detalladas para el inventario.'}
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            onClick={showForm ? handleCancel : onBack}
                            className={isMobile ? 'w-full' : 'w-auto'}
                        >
                            <IconArrowLeft size={16} /> {showForm ? 'Volver a la lista' : 'Volver al Hub'}
                        </Button>
                    </div>

                    <hr className="m-0 border-t border-border" />

                    {showForm ? (
                        <form onSubmit={handleSubmit}>
                            <Card className="bg-muted/40">
                                <CardContent className="flex flex-col gap-5 p-4">
                                    <div className={`grid gap-5 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                        <Field label="Nombre del Equipo *" hint="Nombre principal que identifica al modelo">
                                            <Input
                                                placeholder="Ej: MULTIPARAMETRO"
                                                value={formData.nombre}
                                                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Tipo de Equipo *" hint="Categoría técnica del equipo">
                                            <Input
                                                placeholder="Ej: Sonda, Sensor, Medidor"
                                                value={formData.tipo_equipo}
                                                onChange={(e) => setFormData({ ...formData, tipo_equipo: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Qué Mide (Variables) *" hint="Variables que el equipo registra">
                                            <Input
                                                placeholder="Ej: pH, Temperatura, Turbiedad"
                                                value={formData.que_mide}
                                                onChange={(e) => setFormData({ ...formData, que_mide: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Unidad de Medida (Detallado) *" hint="Descripción formal de las unidades">
                                            <Input
                                                placeholder="Ej: Unid. de pH, Grados Celsius, NTU"
                                                value={formData.unidad_medida_textual}
                                                onChange={(e) => setFormData({ ...formData, unidad_medida_textual: e.target.value })}
                                            />
                                        </Field>
                                        <Field label="Sigla de Unidad (Corta)" hint="Versión abreviada">
                                            <div className="relative">
                                                <Input
                                                    placeholder="Ej: pH/°C/NTU"
                                                    value={formData.unidad_medida_sigla}
                                                    onChange={(e) => {
                                                        setIsSiglaManual(true);
                                                        setFormData({ ...formData, unidad_medida_sigla: e.target.value });
                                                    }}
                                                    className={isSiglaManual ? 'pr-9' : undefined}
                                                />
                                                {isSiglaManual && (
                                                    <span
                                                        title="Editado manualmente"
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-help text-primary"
                                                    >
                                                        <IconPencil size={14} />
                                                    </span>
                                                )}
                                            </div>
                                        </Field>
                                    </div>

                                    <div className={`mt-2 flex justify-end gap-2 ${isMobile ? 'flex-col-reverse' : 'flex-row'}`}>
                                        <Button type="button" variant="outline" onClick={handleCancel} className={isMobile ? 'w-full' : undefined}>
                                            <IconX size={16} /> Cancelar
                                        </Button>
                                        <Button type="submit" className={isMobile ? 'w-full' : undefined}>
                                            <IconDeviceFloppy size={18} /> {editingItem ? 'Actualizar' : 'Registrar'} {isMobile ? '' : 'Modelo'}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </form>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className={`grid w-full gap-2 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                <div className="relative">
                                    <IconSearch size={16} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre, tipo o variable..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-8"
                                    />
                                </div>
                                <Button onClick={() => setShowForm(true)}>
                                    <IconPlus size={18} /> Agregar Nuevo Modelo
                                </Button>
                            </div>

                            {!isMobile ? (
                                <div className="overflow-hidden rounded-lg border border-border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Nombre</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Qué Mide</TableHead>
                                                <TableHead>Sigla</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredItems.length === 0 ? (
                                                <TableRow className="hover:bg-transparent">
                                                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                                                        {emptyMessage}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredItems.map((item) => (
                                                    <TableRow key={item.id_equipocatalogo}>
                                                        <TableCell className="text-[13px] font-semibold">{item.nombre}</TableCell>
                                                        <TableCell><Badge variant="outline">{item.tipo_equipo}</Badge></TableCell>
                                                        <TableCell className="max-w-[300px] truncate text-xs text-muted-foreground">{item.que_mide}</TableCell>
                                                        <TableCell><Badge variant="secondary">{item.unidad_medida_sigla || 'N/A'}</Badge></TableCell>
                                                        <TableCell>
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-primary"
                                                                    title="Editar detalles"
                                                                    onClick={() => handleEdit(item)}
                                                                >
                                                                    <IconEdit size={16} />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                    title="Eliminar del catálogo"
                                                                    onClick={() => handleDelete(item.id_equipocatalogo!)}
                                                                >
                                                                    <IconTrash size={16} />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {filteredItems.length === 0 ? (
                                        <div className="p-8 text-center">
                                            <p className="text-[13px] text-muted-foreground">{emptyMessage}</p>
                                        </div>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <Card key={item.id_equipocatalogo} className="bg-muted/40">
                                                <CardContent className="flex flex-col gap-2 p-3">
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <p className="block text-[15px] font-semibold text-primary">{item.nombre}</p>
                                                            <Badge variant="outline" className="mt-1">{item.tipo_equipo}</Badge>
                                                        </div>
                                                        <div className="flex gap-1.5">
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-primary" onClick={() => handleEdit(item)}>
                                                                <IconEdit size={20} />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDelete(item.id_equipocatalogo!)}>
                                                                <IconTrash size={20} />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <hr className="border-t border-dashed border-border" />

                                                    <div>
                                                        <p className="block text-[11px] font-semibold text-muted-foreground">MIDE:</p>
                                                        <p className="text-[13px]">{item.que_mide}</p>
                                                    </div>

                                                    <div className="flex justify-between">
                                                        <div>
                                                            <p className="block text-[11px] font-semibold text-muted-foreground">SIGLA:</p>
                                                            <Badge variant="secondary">{item.unidad_medida_sigla || 'N/A'}</Badge>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="block text-[11px] font-semibold text-muted-foreground">ID:</p>
                                                            <p className="text-xs font-semibold">#{item.id_equipocatalogo}</p>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))
                                    )}
                                </div>
                            )}

                            {!loading && filteredItems.length > 0 && (
                                <p className="text-right text-xs text-muted-foreground">
                                    Mostrando {filteredItems.length} modelos en el catálogo
                                </p>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

function cnFlex(isMobile: boolean) {
    return `flex flex-1 flex-col gap-1 ${isMobile ? 'min-w-full' : 'min-w-[280px]'}`;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1 block text-xs font-normal text-muted-foreground">{label}</Label>
            {children}
            {hint && <p className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}
