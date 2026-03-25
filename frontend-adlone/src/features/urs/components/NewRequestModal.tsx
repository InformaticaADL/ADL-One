import { ursService } from '../../../services/urs.service';
import React, { useState, useEffect, useMemo } from 'react';
import FileIcon from './FileIcon';
import apiClient from '../../../config/axios.config';
import {
    Modal,
    Stack,
    Group,
    Button,
    Select,
    TextInput,
    Textarea,
    Divider,
    Text,
    ActionIcon,
    Box,
    FileButton,
    Badge,
    Loader,
    ScrollArea,
    ThemeIcon
} from '@mantine/core';
import {
    IconInfoCircle,
    IconPaperclip,
    IconX,
    IconCheck,
    IconPlaylistAdd
} from '@tabler/icons-react';

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

const RemoteSelect: React.FC<RemoteSelectProps> = ({ source, value, onChange, labelField, valueField, placeholder, required, label }) => {
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
    }, [source]);

    return (
        <Select 
            label={label}
            placeholder={loading ? 'Cargando...' : (placeholder || 'Seleccione...')}
            data={options}
            value={value ? String(value) : null}
            onChange={onChange}
            required={required}
            disabled={loading}
            rightSection={loading ? <Loader size={14} /> : null}
            searchable
            clearable
            radius="md"
        />
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
            opened={isOpen} 
            onClose={onClose} 
            title={
                <Group gap="xs">
                    <ThemeIcon variant="light" color="adl-blue" radius="md">
                        <IconPlaylistAdd size={18} />
                    </ThemeIcon>
                    <Text fw={700}>Nueva Solicitud</Text>
                </Group>
            }
            size="lg"
            radius="lg"
            scrollAreaComponent={ScrollArea.Autosize}
        >
            <Stack gap="md" pb="md">
                <Select 
                    label="Tipo de Gestión"
                    placeholder="Seleccione un tipo..."
                    data={types.map(t => ({ value: String(t.id_tipo), label: t.nombre }))}
                    value={selectedTypeId}
                    onChange={setSelectedTypeId}
                    required
                    searchable
                    radius="md"
                />

                <Select 
                    label="Prioridad de Atención"
                    placeholder="Seleccione prioridad..."
                    data={[
                        { value: 'BAJA', label: '🟢 Baja' },
                        { value: 'NORMAL', label: '🔵 Normal' },
                        { value: 'ALTA', label: '🔴 Alta' },
                        { value: 'URGENTE', label: '🔥 Urgente' }
                    ]}
                    value={dynamicData.prioridad || 'NORMAL'}
                    onChange={(val) => handleInputChange('prioridad', val)}
                    required
                    radius="md"
                />

                {formConfig ? (
                    <Stack gap="md" mt="xs">
                        {formConfig.map((field: any) => (
                            <Box key={field.name}>
                                {field.type === 'textarea' ? (
                                    <Textarea
                                        label={field.label}
                                        placeholder={field.placeholder || ''}
                                        value={dynamicData[field.name] || ''}
                                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                                        required={field.required}
                                        radius="md"
                                        autosize
                                        minRows={2}
                                    />
                                ) : field.type === 'select' ? (
                                    <Select
                                        label={field.label}
                                        placeholder="Seleccione..."
                                        data={field.options?.map((opt: string) => ({ value: opt, label: opt })) || []}
                                        value={dynamicData[field.name] || ''}
                                        onChange={(val) => handleInputChange(field.name, val)}
                                        required={field.required}
                                        radius="md"
                                    />
                                ) : field.type === 'remote-select' ? (
                                    <RemoteSelect
                                        label={field.label}
                                        source={field.remoteSource}
                                        value={dynamicData[field.name]}
                                        onChange={(val) => handleInputChange(field.name, val)}
                                        labelField={field.labelField || 'nombre'}
                                        valueField={field.valueField || 'id'}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                    />
                                ) : (
                                    <TextInput
                                        type={field.type || 'text'}
                                        label={field.label}
                                        placeholder={field.placeholder || ''}
                                        value={dynamicData[field.name] || ''}
                                        onChange={(e) => handleInputChange(field.name, e.target.value)}
                                        required={field.required}
                                        radius="md"
                                    />
                                )}
                            </Box>
                        ))}
                    </Stack>
                ) : selectedTypeId && (
                    <Stack gap="md" mt="xs">
                        <TextInput 
                            label="Título / Referencia"
                            placeholder="Ej: Problema con equipo XYZ"
                            value={dynamicData.titulo || ''}
                            onChange={(e) => handleInputChange('titulo', e.target.value)}
                            required
                            radius="md"
                        />
                        <Textarea 
                            label="Descripción detallada"
                            placeholder="Explique detalladamente su requerimiento..."
                            value={dynamicData.descripcion || ''}
                            onChange={(e) => handleInputChange('descripcion', e.target.value)}
                            required
                            radius="md"
                            autosize
                            minRows={3}
                        />
                    </Stack>
                )}

                <Divider my="sm" />

                <Stack gap={4}>
                    <Text size="sm" fw={700}>Adjuntar Archivos</Text>
                    <Group gap="xs">
                        <FileButton onChange={(payload) => setFiles(prev => [...prev, ...payload])} accept="*" multiple>
                            {(props) => (
                                <Button {...props} variant="light" color="gray" leftSection={<IconPaperclip size={18} />} radius="md">
                                    Seleccionar Archivos
                                </Button>
                            )}
                        </FileButton>
                        <Text size="xs" c="dimmed">{files.length} archivos seleccionados</Text>
                    </Group>
                    
                    {files.length > 0 && (
                        <Group gap={6} mt="xs">
                            {files.map((f, i) => (
                                <Badge 
                                    key={i} 
                                    variant="outline" 
                                    color="gray" 
                                    radius="sm" 
                                    leftSection={<FileIcon filename={f.name} mimetype={f.type} size={14} />}
                                    rightSection={
                                        <ActionIcon size="xs" variant="transparent" color="red" onClick={() => removeFile(i)}>
                                            <IconX size={10} />
                                        </ActionIcon>
                                    }
                                >
                                    {f.name}
                                </Badge>
                            ))}
                        </Group>
                    )}
                </Stack>

                <Group justify="flex-end" mt="xl">
                    <Button variant="light" color="gray" onClick={onClose} radius="md">
                        Cancelar
                    </Button>
                    <Button 
                        color="adl-blue" 
                        radius="md" 
                        loading={loading} 
                        disabled={!selectedTypeId}
                        leftSection={<IconCheck size={18} />}
                        onClick={handleSubmit}
                    >
                        Confirmar Solicitud
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
};

export default NewRequestModal;
