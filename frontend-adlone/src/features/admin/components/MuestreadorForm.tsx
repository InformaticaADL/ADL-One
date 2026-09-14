import React, { useState, useEffect, useRef } from 'react';
import {
    Input,
    Button,
    Typography,
    Spin,
    Alert,
    Checkbox,
    Tag,
    Card
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
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
import { adminService } from '../../../services/admin.service';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { ProtectedContent } from '../../../components/auth/ProtectedContent';

const { Text } = Typography;

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
        <div style={{ maxWidth: 720, margin: '0 auto', padding: isMobile ? '16px 8px' : '32px 16px' }}>
            {loading && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(255,255,255,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Spin size="large" />
                </div>
            )}

            <PageHeader
                title={initialData ? 'Editar Muestreador' : 'Nuevo Muestreador'}
                subtitle={!isMobile ? (initialData ? `Actualizando información de ${initialData.nombre_muestreador}` : 'Registra un nuevo técnico para toma de muestras') : undefined}
                onBack={onCancel}
            />

            <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginTop: 32 }}>
                    {error && (
                        <Alert type="error" showIcon icon={<IconAlertCircle size={16} />} message="Error" description={error} closable onClose={() => setError(null)} />
                    )}

                    {duplicateWarning && (
                        <Alert type="warning" showIcon icon={<IconAlertCircle size={16} />} message="Advertencia" description={duplicateWarning} />
                    )}

                    <Card>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Text strong style={{ fontSize: 16, color: '#1864ab', textAlign: isMobile ? 'center' : 'left' }}>Información Personal</Text>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                                <Field label="Nombre Completo *">
                                    <Input
                                        placeholder="Ej: Juan Pérez"
                                        prefix={<IconUser size={18} style={{ color: 'var(--app-text-secondary)' }} />}
                                        value={formData.nombre_muestreador}
                                        onChange={(e) => setFormData({ ...formData, nombre_muestreador: e.target.value })}
                                    />
                                </Field>
                                <Field label="Correo Electrónico *">
                                    <Input
                                        placeholder="ejemplo@adldiagnostic.cl"
                                        prefix={<IconMail size={18} style={{ color: 'var(--app-text-secondary)' }} />}
                                        value={formData.correo_electronico}
                                        onChange={(e) => setFormData({ ...formData, correo_electronico: e.target.value })}
                                    />
                                </Field>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                                <Field
                                    label={initialData?.id_muestreador ? "Clave de Acceso (opcional)" : "Clave de Acceso *"}
                                    hint={initialData?.id_muestreador
                                        ? `${claveLength} / 6 caracteres — solo escriba si desea cambiarla`
                                        : `${claveLength} / 6 caracteres`}
                                >
                                    <Input.Password
                                        placeholder={initialData?.id_muestreador ? "Dejar vacío para conservar la actual" : "******"}
                                        maxLength={6}
                                        value={formData.clave_usuario ?? ''}
                                        onChange={(e) => setFormData({ ...formData, clave_usuario: e.target.value })}
                                    />
                                </Field>
                                {!isMobile && <div />}
                            </div>
                        </div>
                    </Card>

                    <Card>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Text strong style={{ fontSize: 16, color: '#1864ab', textAlign: isMobile ? 'center' : 'left' }}>Firma Digital</Text>
                            <Text type="secondary" style={{ fontSize: 13, textAlign: isMobile ? 'center' : 'left' }}>Esta firma se utilizará para validar las fichas de muestreo electrónicamente.</Text>

                            <div
                                style={{
                                    border: '2px dashed var(--app-border)',
                                    borderRadius: 12,
                                    padding: 32,
                                    backgroundColor: 'var(--app-hover-bg)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    minHeight: 200
                                }}
                            >
                                {formData.firma_muestreador ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                        <Card size="small">
                                            <img
                                                src={formData.firma_muestreador}
                                                style={{ height: 120, objectFit: 'contain' }}
                                                alt="Vista previa firma"
                                            />
                                        </Card>
                                        <ProtectedContent permission="MU_FIRMA">
                                            <Button
                                                danger
                                                size="small"
                                                icon={<IconTrash size={14} />}
                                                onClick={() => setFormData({ ...formData, firma_muestreador: '' })}
                                            >
                                                Eliminar Firma
                                            </Button>
                                        </ProtectedContent>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                        <IconSignature size={48} strokeWidth={1} color="var(--app-text-secondary)" />
                                        <Text type="secondary" style={{ fontSize: 13 }}>No hay firma registrada</Text>
                                        <ProtectedContent permission="MU_FIRMA">
                                            <input
                                                ref={firmaFileInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg"
                                                style={{ display: 'none' }}
                                                onChange={(e) => { handleFileChange(e.target.files?.[0] ?? null); e.target.value = ''; }}
                                            />
                                            <Button
                                                icon={<IconUpload size={16} />}
                                                style={{ marginTop: 8 }}
                                                onClick={() => firmaFileInputRef.current?.click()}
                                            >
                                                Subir Imagen de Firma
                                            </Button>
                                        </ProtectedContent>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>

                    {/* --- Competencias --- */}
                    <Card>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <Text strong style={{ fontSize: 16, color: '#1864ab', textAlign: isMobile ? 'center' : 'left' }}>Competencias</Text>
                            <Text type="secondary" style={{ fontSize: 13 }}>Marque las competencias del muestreador. Se pueden agregar y quitar libremente.</Text>
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 4 }}>
                                {allCompetencias.map(c => (
                                    <Checkbox
                                        key={c.id_competencia}
                                        checked={compSeleccionadas.includes(c.id_competencia)}
                                        onChange={(e) => {
                                            const on = e.target.checked;
                                            setCompSeleccionadas(prev => on ? [...prev, c.id_competencia] : prev.filter(x => x !== c.id_competencia));
                                        }}
                                    >
                                        {c.nombre_competencia}
                                    </Checkbox>
                                ))}
                            </div>
                            {compAsignadas.filter(c => c.activo !== 'S').length > 0 && (
                                <div>
                                    <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginTop: 8 }}>Competencias inactivas (conservadas):</Text>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                                        {compAsignadas.filter(c => c.activo !== 'S').map(c => (
                                            <Tag key={c.id_competencia}>{c.nombre_competencia}</Tag>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* --- Documentos / Certificados (solo en edición) --- */}
                    {initialData?.id_muestreador && (
                        <Card>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                <Text strong style={{ fontSize: 16, color: '#1864ab', textAlign: isMobile ? 'center' : 'left' }}>Documentos / Certificados</Text>
                                <Text type="secondary" style={{ fontSize: 13 }}>Adjunte respaldos de cursos o capacitaciones (disponible para cualquier muestreador).</Text>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {documentos.length === 0 && <Text type="secondary" style={{ fontSize: 12 }}>Sin documentos.</Text>}
                                    {documentos.map(d => (
                                        <div key={d.id_documento} style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap', alignItems: 'center' }}>
                                            <a href={d.ruta_archivo} target="_blank" rel="noreferrer" style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nombre_documento}</a>
                                            <Button type="text" danger size="small" icon={<IconTrash size={16} />} onClick={() => handleDeleteDoc(d.id_documento)} />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 160 }}>
                                        <input
                                            ref={docFileInputRef}
                                            type="file"
                                            accept="application/pdf,image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                                        />
                                        <Input
                                            readOnly
                                            placeholder="Seleccionar archivo"
                                            value={docFile?.name ?? ''}
                                            onClick={() => docFileInputRef.current?.click()}
                                            suffix={docFile ? <IconTrash size={14} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); setDocFile(null); }} /> : undefined}
                                        />
                                    </div>
                                    <Input style={{ flex: 1, minWidth: 160 }} placeholder="Nombre/Título (opcional)" value={docNombre} onChange={e => setDocNombre(e.target.value)} />
                                    <Button onClick={handleUploadDoc} loading={docUploading} disabled={!docFile} icon={<IconUpload size={16} />}>Subir</Button>
                                </div>
                            </div>
                        </Card>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24, flexDirection: isMobile ? 'column' : 'row' }}>
                        <Button onClick={onCancel} block={isMobile}>
                            Cancelar
                        </Button>
                        <Button
                            htmlType="submit"
                            type="primary"
                            icon={<IconDeviceFloppy size={18} />}
                            loading={loading}
                            block={isMobile}
                        >
                            Guardar {isMobile ? '' : 'Muestreador'}
                        </Button>
                    </div>
                </div>
            </form>

            {pendingRequests.length > 0 && (
                <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 100 }}>
                    <Button
                        type="primary"
                        style={{ backgroundColor: '#e8590c', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
                        icon={<IconBell size={20} />}
                        size="large"
                        shape="round"
                        onClick={onViewRequests}
                    >
                        Solicitudes ({pendingRequests.length})
                    </Button>
                </div>
            )}
        </div>
    );
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
            {hint && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{hint}</Text>}
        </div>
    );
}
