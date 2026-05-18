import React, { useState, useEffect } from 'react';
import { Select, Stack, Group, Text, Paper, Loader, TextInput, Textarea, Badge, Box } from '@mantine/core';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

interface VigenciaExtensionFormProps {
    onDataChange: (data: any) => void;
}

const VigenciaExtensionForm: React.FC<VigenciaExtensionFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [nuevaVigencia, setNuevaVigencia] = useState('');
    const [justificacion, setJustificacion] = useState('');
    
    const [equipos, setEquipos] = useState<{ value: string; label: string }[]>([]);
    const [equiposRaw, setEquiposRaw] = useState<any[]>([]);
    const [loadingEquipos, setLoadingEquipos] = useState(false);

    const selectedEquipoRaw = equiposRaw.find(e => String(e.id_equipo) === equipoId) || null;

    useEffect(() => {
        setLoadingEquipos(true);
        apiClient.get('/api/admin/equipos?limit=500')
            .then(res => {
                const data = res.data.data || [];
                setEquiposRaw(data);
                setEquipos(data.map((e: any) => ({
                    value: String(e.id_equipo),
                    label: `${e.nombre} [${e.codigo}]`
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar inventario de equipos' }))
            .finally(() => setLoadingEquipos(false));
    }, []);

    useEffect(() => {
        onDataChange({
            id_equipo: equipoId,
            nombre_equipo_full: selectedEquipoRaw ? `${selectedEquipoRaw.nombre} [${selectedEquipoRaw.codigo}]` : '',
            nueva_vigencia: nuevaVigencia,
            justificacion: justificacion,
            _form_type: 'EXTENSION_VIGENCIA'
        });
    }, [equipoId, nuevaVigencia, justificacion, selectedEquipoRaw]);

    return (
        <Paper withBorder p="md" radius="md" bg="violet.0">
            <Stack gap="md">
                <Group justify="space-between" mb={4}>
                    <Text fw={700} size="sm" c="violet.9" style={{ textTransform: 'uppercase' }}>
                        Solicitud de Extensión de Vigencia
                    </Text>
                    <Badge color="violet" variant="light">CALIDAD / MA</Badge>
                </Group>

                <Select
                    label="Seleccionar Equipo"
                    placeholder={loadingEquipos ? "Cargando..." : "Busque equipo por nombre o código"}
                    rightSection={loadingEquipos ? <Loader size={12} /> : null}
                    data={equipos}
                    value={equipoId}
                    onChange={setEquipoId}
                    searchable
                    required
                    radius="md"
                />

                {selectedEquipoRaw?.fecha_vigencia && (
                    <Box p="sm" style={{ background: 'var(--mantine-color-violet-1)', borderRadius: 'var(--mantine-radius-md)' }}>
                        <Text size="xs" c="violet.8" fw={700} tt="uppercase">Vigencia actual</Text>
                        <Text size="sm" fw={700} c="violet.9">
                            {new Date(selectedEquipoRaw.fecha_vigencia).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </Text>
                    </Box>
                )}

                <Group grow>
                    <TextInput
                        label="Nueva Fecha de Vigencia"
                        type="date"
                        value={nuevaVigencia}
                        onChange={(e) => setNuevaVigencia(e.currentTarget.value)}
                        required
                        radius="md"
                    />
                    <Box style={{ visibility: 'hidden' }}>
                        <TextInput label="-" />
                    </Box>
                </Group>

                <Textarea
                    label="Justificación de la Extensión"
                    placeholder="Explique por qué se requiere extender el plazo de uso de este equipo..."
                    minRows={3}
                    value={justificacion}
                    onChange={(e) => setJustificacion(e.currentTarget.value)}
                    required
                    radius="md"
                />
            </Stack>
        </Paper>
    );
};

export default VigenciaExtensionForm;
