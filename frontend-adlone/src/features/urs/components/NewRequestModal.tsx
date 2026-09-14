import { ursService } from '../../../services/urs.service';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import FileIcon from './FileIcon';
import apiClient from '../../../config/axios.config';
import {
    Modal,
    Button,
    Select,
    Input,
    Typography,
    Divider,
    Tag,
    Spin
} from 'antd';
import {
    IconPaperclip,
    IconCheck,
    IconPlaylistAdd
} from '@tabler/icons-react';

const { Text } = Typography;
const { TextArea } = Input;

interface RemoteSelectProps {
    source: string;
    value: any;
    onChange: (val: any) => void;
    labelField: string;
    valueField: string;
    placeholder?: string;
    required?: boolean;
    label: string;
}

const RemoteSelect: React.FC<RemoteSelectProps> = ({ source, value, onChange, labelField, valueField, placeholder, label }) => {
    const [options, setOptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        apiClient.get(source)
            .then(res => {
                const rawData = res.data.data;
                const items = Array.isArray(rawData) ? rawData : (rawData?.data || []);
                setOptions(items.map((opt: any) => ({
                    value: String(opt[valueField]),
                    label: `${opt[labelField]}${opt.codigo ? ` (${opt.codigo})` : ''}`
                })));
            })
            .catch(err => console.error(`Error loading remote source ${source}:`, err))
            .finally(() => setLoading(false));
    }, [source, valueField, labelField]);

    return (
        <Field label={label}>
            <Select
                placeholder={loading ? 'Cargando...' : (placeholder || 'Seleccione...')}
                options={options}
                value={value ? String(value) : undefined}
                onChange={onChange}
                disabled={loading}
                suffixIcon={loading ? <Spin size="small" /> : undefined}
                showSearch
                allowClear
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                style={{ width: '100%' }}
            />
        </Field>
    );
};

interface NewRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const NewRequestModal: React.FC<NewRequestModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [types, setTypes] = useState<any[]>([]);
    const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
    const [dynamicData, setDynamicData] = useState<any>({});
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            ursService.getRequestTypes().then(setTypes).catch(console.error);
        }
    }, [isOpen]);

    const selectedType = types.find(t => String(t.id_tipo) === selectedTypeId);

    const formConfig = useMemo(() => {
        if (!selectedType?.formulario_config) return null;
        try {
            return typeof selectedType.formulario_config === 'string'
                ? JSON.parse(selectedType.formulario_config)
                : selectedType.formulario_config;
        } catch (e) {
            console.error("Error parsing form config:", e);
            return null;
        }
    }, [selectedType]);

    useEffect(() => {
        setDynamicData({});
    }, [selectedTypeId]);

    const handleInputChange = (name: string, value: any) => {
        setDynamicData((prev: any) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!selectedTypeId) return;

        setLoading(true);
        try {
            await ursService.createRequest({
                id_tipo: Number(selectedTypeId),
                datos_json: dynamicData,
                prioridad: dynamicData.prioridad || 'NORMAL',
                archivos: files
            });
            onSuccess();
            onClose();
            // Reset form
            setDynamicData({});
            setFiles([]);
            setSelectedTypeId(null);
        } catch (error) {
            console.error("Error creating request:", error);
        } finally {
            setLoading(false);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <Modal
            open={isOpen}
            onCancel={onClose}
            footer={null}
            width={620}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'var(--app-accent-bg)', color: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <IconPlaylistAdd size={18} />
                    </div>
                    <Text strong>Nueva Solicitud</Text>
                </div>
            }
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16, paddingBottom: 16 }}>
                <Field label="Tipo de Gestión *">
                    <Select
                        placeholder="Seleccione un tipo..."
                        options={types.map(t => ({ value: String(t.id_tipo), label: t.nombre }))}
                        value={selectedTypeId ?? undefined}
                        onChange={(v) => setSelectedTypeId(v ?? null)}
                        showSearch
                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                        style={{ width: '100%' }}
                    />
                </Field>

                <Field label="Prioridad de Atención *">
                    <Select
                        placeholder="Seleccione prioridad..."
                        options={[
                            { value: 'BAJA', label: '🟢 Baja' },
                            { value: 'NORMAL', label: '🔵 Normal' },
                            { value: 'ALTA', label: '🔴 Alta' },
                            { value: 'URGENTE', label: '🔥 Urgente' }
                        ]}
                        value={dynamicData.prioridad || 'NORMAL'}
                        onChange={(val) => handleInputChange('prioridad', val)}
                        style={{ width: '100%' }}
                    />
                </Field>

                {formConfig ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
                        {formConfig.map((field: any) => (
                            <div key={field.name}>
                                {field.type === 'textarea' ? (
                                    <Field label={`${field.label}${field.required ? ' *' : ''}`}>
                                        <TextArea
                                            placeholder={field.placeholder || ''}
                                            value={dynamicData[field.name] || ''}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                            autoSize={{ minRows: 2 }}
                                        />
                                    </Field>
                                ) : field.type === 'select' ? (
                                    <Field label={`${field.label}${field.required ? ' *' : ''}`}>
                                        <Select
                                            placeholder="Seleccione..."
                                            options={field.options?.map((opt: string) => ({ value: opt, label: opt })) || []}
                                            value={dynamicData[field.name] || undefined}
                                            onChange={(val) => handleInputChange(field.name, val)}
                                            style={{ width: '100%' }}
                                        />
                                    </Field>
                                ) : field.type === 'remote-select' ? (
                                    <RemoteSelect
                                        label={`${field.label}${field.required ? ' *' : ''}`}
                                        source={field.remoteSource}
                                        value={dynamicData[field.name]}
                                        onChange={(val) => handleInputChange(field.name, val)}
                                        labelField={field.labelField || 'nombre'}
                                        valueField={field.valueField || 'id'}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                    />
                                ) : (
                                    <Field label={`${field.label}${field.required ? ' *' : ''}`}>
                                        <Input
                                            type={field.type || 'text'}
                                            placeholder={field.placeholder || ''}
                                            value={dynamicData[field.name] || ''}
                                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                                        />
                                    </Field>
                                )}
                            </div>
                        ))}
                    </div>
                ) : selectedTypeId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
                        <Field label="Título / Referencia *">
                            <Input
                                placeholder="Ej: Problema con equipo XYZ"
                                value={dynamicData.titulo || ''}
                                onChange={(e) => handleInputChange('titulo', e.target.value)}
                            />
                        </Field>
                        <Field label="Descripción detallada *">
                            <TextArea
                                placeholder="Explique detalladamente su requerimiento..."
                                value={dynamicData.descripcion || ''}
                                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                                autoSize={{ minRows: 3 }}
                            />
                        </Field>
                    </div>
                )}

                <Divider style={{ margin: '8px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Text strong style={{ fontSize: 13 }}>Adjuntar Archivos</Text>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,application/pdf,.xlsx,.xls,.doc,.docx,.txt,.csv"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                                e.target.value = '';
                            }}
                        />
                        <Button icon={<IconPaperclip size={18} />} onClick={() => fileInputRef.current?.click()}>
                            Seleccionar Archivos
                        </Button>
                        <Text type="secondary" style={{ fontSize: 12 }}>{files.length} archivos seleccionados</Text>
                    </div>

                    {files.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                            {files.map((f, i) => (
                                <Tag
                                    key={i}
                                    icon={<FileIcon filename={f.name} mimetype={f.type} size={14} />}
                                    closable
                                    onClose={() => removeFile(i)}
                                >
                                    {f.name}
                                </Tag>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
                    <Button onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="primary"
                        loading={loading}
                        disabled={!selectedTypeId}
                        icon={<IconCheck size={18} />}
                        onClick={handleSubmit}
                    >
                        Confirmar Solicitud
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}

export default NewRequestModal;
