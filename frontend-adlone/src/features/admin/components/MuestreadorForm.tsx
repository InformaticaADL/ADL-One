import React, { useState, useEffect, useRef } from 'react';
import {
    IconDeviceFloppy,
    IconTrash,
    IconUpload,
    IconAlertCircle,
    IconSignature,
    IconMail,
    IconUser,
    IconBell
} from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { adminService } from '../../../services/admin.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

interface Muestreador {
    id_muestreador?: number;
    nombre_muestreador: string;
    correo_electronico: string;
    clave_usuario: string;
    firma_muestreador?: string;
}

interface Props {
    initialData?: Muestreador | null;
    pendingRequests?: any[];
    onSave: () => void;
    onCancel: () => void;
    onViewRequests?: () => void;
}

export const MuestreadorForm: React.FC<Props> = ({
    initialData,
    pendingRequests = [],
    onSave,
    onCancel,
    onViewRequests
}) => {
    const [formData, setFormData] = useState<Muestreador>({
        nombre_muestreador: '',
        correo_electronico: '',
        clave_usuario: '',
        firma_muestreador: ''
    });
    // Helper to safely read clave_usuario length (guards against undefined from API responses)
    const claveLength = (formData.clave_usuario ?? '').length;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const { showToast } = useToast();
    const isMobile = useMediaQuery('(max-width: 768px)');

    // --- Documentos ---
    const [documentos, setDocumentos] = useState<any[]>([]);
    const [docFile, setDocFile] = useState<File | null>(null);
    const [docNombre, setDocNombre] = useState('');
    const [docUploading, setDocUploading] = useState(false);
    const docFileInputRef = useRef<HTMLInputElement>(null);
    const firmaFileInputRef = useRef<HTMLInputElement>(null);

    // --- Competencias ---
    const [allCompetencias, setAllCompetencias] = useState<any[]>([]);      // activas (asignables)
    const [compAsignadas, setCompAsignadas] = useState<any[]>([]);          // asignadas (incluye inactivas)
    const [compSeleccionadas, setCompSeleccionadas] = useState<number[]>([]); // ids activas marcadas

    useEffect(() => {
        if (initialData) {
            setFormData({ ...initialData, clave_usuario: initialData.clave_usuario ?? '' });
        } else {
            setFormData({
                nombre_muestreador: '',
                correo_electronico: '',
                clave_usuario: '',
                firma_muestreador: ''
            });
        }
    }, [initialData]);

    useEffect(() => {
        adminService.getCompetencias(false).then(setAllCompetencias).catch(() => {});
        const id = initialData?.id_muestreador;
        if (id) {
            adminService.getDocumentosMuestreador(id).then(setDocumentos).catch(() => {});
            adminService.getCompetenciasMuestreador(id).then((rows: any[]) => {
                setCompAsignadas(rows);
                setCompSeleccionadas(rows.filter(r => r.activo === 'S').map(r => r.id_competencia));
            }).catch(() => {});
        } else {
            setDocumentos([]); setCompAsignadas([]); setCompSeleccionadas([]);
        }
    }, [initialData]);

    const handleUploadDoc = async () => {
        const id = initialData?.id_muestreador;
        if (!id || !docFile) return;
        setDocUploading(true);
        try {
            await adminService.uploadDocumentoMuestreador(id, docFile, docNombre || docFile.name);
            const list = await adminService.getDocumentosMuestreador(id);
            setDocumentos(list);
            setDocFile(null); setDocNombre('');
            showToast({ type: 'success', message: 'Documento agregado' });
        } catch {
            showToast({ type: 'error', message: 'Error al subir documento' });
        } finally { setDocUploading(false); }
    };

    const handleDeleteDoc = async (idDoc: number) => {
        try {
            await adminService.deleteDocumentoMuestreador(idDoc);
            setDocumentos(prev => prev.filter(d => d.id_documento !== idDoc));
            showToast({ type: 'success', message: 'Documento eliminado' });
        } catch {
            showToast({ type: 'error', message: 'Error al eliminar documento' });
        }
    };

    const handleFileChange = (file: File | null) => {
        if (!file) return;
        // MS-06: validar tipo (solo imagen png/jpg/jpeg)
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
            showToast({ type: 'error', message: 'La firma debe ser una imagen PNG o JPG. Formato no permitido.' });
            return;
        }
        // MS-07: validar tamaño máximo 2 MB (suficiente para firmas)
        const MAX_SIZE = 2 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
            showToast({ type: 'error', message: `La firma supera el tamaño máximo (${sizeMb} MB). Máximo permitido: 2 MB.` });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            setFormData(prev => ({ ...prev, firma_muestreador: base64 }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setDuplicateWarning(null);

        try {
            if (initialData?.id_muestreador) {
                // MS-05: si el usuario no escribió clave nueva, no la enviamos (se conserva la actual).
                const payload: any = {
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    firma: formData.firma_muestreador
                };
                if (formData.clave_usuario && formData.clave_usuario.trim()) {
                    payload.clave = formData.clave_usuario;
                }
                await adminService.updateMuestreador(initialData.id_muestreador, payload);
                await adminService.setCompetenciasMuestreador(initialData.id_muestreador, compSeleccionadas);
                showToast({ type: 'success', message: 'Muestreador actualizado correctamente' });
            } else {
                // Check for duplicates
                const dupResult = await adminService.checkDuplicateMuestreador(
                    formData.nombre_muestreador,
                    formData.correo_electronico
                );
                const duplicates = dupResult?.data || [];
                if (duplicates.length > 0) {
                    const dup = duplicates[0];
                    const estado = dup.habilitado === 'S' ? 'Activo' : 'Inactivo';
                    setDuplicateWarning(
                        `Ya existe un muestreador similar: "${dup.nombre_muestreador}" (${dup.correo_electronico}) - Estado: ${estado}.`
                    );
                    setLoading(false);
                    return;
                }

                const created = await adminService.createMuestreador({
                    nombre: formData.nombre_muestreador,
                    correo: formData.correo_electronico,
                    clave: formData.clave_usuario,
                    firma: formData.firma_muestreador
                });
                const newId = created?.data?.id_muestreador;
                if (newId && compSeleccionadas.length > 0) {
                    try { await adminService.setCompetenciasMuestreador(newId, compSeleccionadas); } catch { /* no bloquear creación */ }
                }
                showToast({ type: 'success', message: 'Muestreador creado correctamente' });
            }
            onSave();
        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.message || 'Error al guardar los datos del muestreador');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={cn('shadcn-scope mx-auto max-w-3xl', isMobile ? 'px-2 py-4' : 'px-4 py-8')}>
            {loading && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/60">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            )}

            <PageHeader
                title={initialData ? 'Editar Muestreador' : 'Nuevo Muestreador'}
                subtitle={!isMobile ? (initialData ? `Actualizando información de ${initialData.nombre_muestreador}` : 'Registra un nuevo técnico para toma de muestras') : undefined}
                onBack={onCancel}
                breadcrumbItems={[
                    { label: 'Muestreadores', onClick: onCancel },
                    { label: initialData ? 'Editar muestreador' : 'Nuevo muestreador' }
                ]}
            />

            <form onSubmit={handleSubmit}>
                <div className="mt-8 flex flex-col gap-6">
                    {error && (
                        <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                            <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-destructive" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">Error</p>
                                <p className="text-sm text-muted-foreground">{error}</p>
                            </div>
                            <button type="button" onClick={() => setError(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                                Cerrar
                            </button>
                        </div>
                    )}

                    {duplicateWarning && (
                        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
                            <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-warning" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">Advertencia</p>
                                <p className="text-sm text-muted-foreground">{duplicateWarning}</p>
                            </div>
                        </div>
                    )}

                    <Card className="p-5">
                        <div className="flex flex-col gap-4">
                            <p className={cn('text-base font-semibold text-primary', isMobile ? 'text-center' : 'text-left')}>Información Personal</p>

                            <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                                <Field label="Nombre Completo *">
                                    <div className="relative">
                                        <IconUser size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            placeholder="Ej: Juan Pérez"
                                            value={formData.nombre_muestreador}
                                            onChange={(e) => setFormData({ ...formData, nombre_muestreador: e.target.value })}
                                            className="pl-9"
                                        />
                                    </div>
                                </Field>
                                <Field label="Correo Electrónico *">
                                    <div className="relative">
                                        <IconMail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            placeholder="ejemplo@adldiagnostic.cl"
                                            value={formData.correo_electronico}
                                            onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                                            className="pl-9"
                                        />
                                    </div>
                                </Field>
                            </div>

                            <div className={cn('grid gap-4', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                                <Field
                                    label={initialData?.id_muestreador ? 'Clave de Acceso (opcional)' : 'Clave de Acceso *'}
                                    hint={initialData?.id_muestreador
                                        ? `${claveLength} / 6 caracteres — solo escriba si desea cambiarla`
                                        : `${claveLength} / 6 caracteres`}
                                >
                                    <Input
                                        type="password"
                                        placeholder={initialData?.id_muestreador ? 'Dejar vacío para conservar la actual' : '******'}
                                        maxLength={6}
                                        value={formData.clave_usuario ?? ''}
                                        onChange={(e) => setFormData({ ...formData, clave_usuario: e.target.value })}
                                    />
                                </Field>
                                {!isMobile && <div />}
                            </div>
                        </div>
                    </Card>

                    <Card className="p-5">
                        <div className="flex flex-col gap-4">
                            <p className={cn('text-base font-semibold text-primary', isMobile ? 'text-center' : 'text-left')}>Firma Digital</p>
                            <p className={cn('text-[13px] text-muted-foreground', isMobile ? 'text-center' : 'text-left')}>Esta firma se utilizará para validar las fichas de muestreo electrónicamente.</p>

                            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-8">
                                {formData.firma_muestreador ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <Card className="p-2">
                                            <img
                                                src={formData.firma_muestreador}
                                                className="h-[120px] object-contain"
                                                alt="Vista previa firma"
                                            />
                                        </Card>
                                        <ProtectedContent permission="MU_FIRMA">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => setFormData({ ...formData, firma_muestreador: '' })}
                                            >
                                                <IconTrash size={14} /> Eliminar Firma
                                            </Button>
                                        </ProtectedContent>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <IconSignature size={48} strokeWidth={1} className="text-muted-foreground" />
                                        <p className="text-[13px] text-muted-foreground">No hay firma registrada</p>
                                        <ProtectedContent permission="MU_FIRMA">
                                            <input
                                                ref={firmaFileInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg"
                                                className="hidden"
                                                onChange={(e) => { handleFileChange(e.target.files?.[0] ?? null); e.target.value = ''; }}
                                            />
                                            <Button
                                                variant="outline"
                                                className="mt-2"
                                                onClick={() => firmaFileInputRef.current?.click()}
                                            >
                                                <IconUpload size={16} /> Subir Imagen de Firma
                                            </Button>
                                        </ProtectedContent>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* --- Competencias --- */}
                    <Card className="p-5">
                        <div className="flex flex-col gap-4">
                            <p className={cn('text-base font-semibold text-primary', isMobile ? 'text-center' : 'text-left')}>Competencias</p>
                            <p className="text-[13px] text-muted-foreground">Marque las competencias del muestreador. Se pueden agregar y quitar libremente.</p>
                            <div className={cn('grid gap-1', isMobile ? 'grid-cols-1' : 'grid-cols-2')}>
                                {allCompetencias.map(c => (
                                    <label key={c.id_competencia} className="flex items-center gap-2 py-1">
                                        <Checkbox
                                            checked={compSeleccionadas.includes(c.id_competencia)}
                                            onCheckedChange={(checked) => {
                                                const on = checked === true;
                                                setCompSeleccionadas(prev => on ? [...prev, c.id_competencia] : prev.filter(x => x !== c.id_competencia));
                                            }}
                                        />
                                        <span className="text-sm text-foreground">{c.nombre_competencia}</span>
                                    </label>
                                ))}
                            </div>
                            {compAsignadas.filter(c => c.activo !== 'S').length > 0 && (
                                <div>
                                    <p className="mt-2 text-xs font-semibold text-muted-foreground">Competencias inactivas (conservadas):</p>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {compAsignadas.filter(c => c.activo !== 'S').map(c => (
                                            <Badge key={c.id_competencia} variant="outline">{c.nombre_competencia}</Badge>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* --- Documentos / Certificados (solo en edición) --- */}
                    {initialData?.id_muestreador && (
                        <Card className="p-5">
                            <div className="flex flex-col gap-4">
                                <p className={cn('text-base font-semibold text-primary', isMobile ? 'text-center' : 'text-left')}>Documentos / Certificados</p>
                                <p className="text-[13px] text-muted-foreground">Adjunte respaldos de cursos o capacitaciones (disponible para cualquier muestreador).</p>
                                <div className="flex flex-col gap-2">
                                    {documentos.length === 0 && <p className="text-xs text-muted-foreground">Sin documentos.</p>}
                                    {documentos.map(d => (
                                        <div key={d.id_documento} className="flex flex-nowrap items-center justify-between">
                                            <a href={d.ruta_archivo} target="_blank" rel="noreferrer" className="truncate text-[13px] text-primary hover:underline">{d.nombre_documento}</a>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteDoc(d.id_documento)}>
                                                <IconTrash size={16} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex flex-wrap items-end gap-2">
                                    <div className="min-w-[160px] flex-1">
                                        <input
                                            ref={docFileInputRef}
                                            type="file"
                                            accept="application/pdf,image/*"
                                            className="hidden"
                                            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                                        />
                                        <div className="relative">
                                            <Input
                                                readOnly
                                                placeholder="Seleccionar archivo"
                                                value={docFile?.name ?? ''}
                                                onClick={() => docFileInputRef.current?.click()}
                                                className={cn('cursor-pointer', docFile && 'pr-8')}
                                            />
                                            {docFile && (
                                                <IconTrash
                                                    size={14}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground"
                                                    onClick={(e) => { e.stopPropagation(); setDocFile(null); }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <Input className="min-w-[160px] flex-1" placeholder="Nombre/Título (opcional)" value={docNombre} onChange={e => setDocNombre(e.target.value)} />
                                    <Button onClick={handleUploadDoc} disabled={docUploading || !docFile}>
                                        {docUploading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconUpload size={16} />}
                                        Subir
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div className={cn('mt-6 flex justify-end gap-2', isMobile && 'flex-col')}>
                        <Button variant="outline" className={isMobile ? 'w-full' : undefined} onClick={onCancel}>
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className={isMobile ? 'w-full' : undefined}
                        >
                            {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconDeviceFloppy size={18} />}
                            Guardar {isMobile ? '' : 'Muestreador'}
                        </Button>
                    </div>
                </div>
            </form>

            {pendingRequests.length > 0 && (
                <div className="fixed bottom-5 right-5 z-[100]">
                    <Button
                        className="rounded-full bg-[#e8590c] text-white shadow-lg hover:bg-[#e8590c]/90"
                        size="lg"
                        onClick={onViewRequests}
                    >
                        <IconBell size={20} /> Solicitudes ({pendingRequests.length})
                    </Button>
                </div>
            )}
        </div>
    );
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Label className="mb-1 block text-xs font-normal text-muted-foreground">{label}</Label>
            {children}
            {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
    );
}
