import React, { useState, useEffect } from 'react';
import { Select, Stack, Group, Text, Paper, Loader, TextInput, Textarea, Badge, Box } from '@mantine/core';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

interface VigenciaExtensionFormProps {
    onDataChange: (data: any) => void;
}

const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    // Handle dd/MM/yyyy format (e.g. "30/06/2026")
    const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(ddmmyyyyPattern);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed month
        const year = parseInt(match[3], 10);
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? null : date;
    }
    // Fallback to ISO / standard format
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const VigenciaExtensionForm: React.FC<VigenciaExtensionFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [fechaRevision, setFechaRevision] = useState('');
    const [siguienteVerif, setSiguienteVerif] = useState('');
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

    // Calcular fecha de siguiente verificación (+90 días) al ingresar fecha de revisión
    useEffect(() => {
        if (fechaRevision) {
            const d = new Date(fechaRevision);
            d.setDate(d.getDate() + 90);
            setSiguienteVerif(d.toISOString().split('T')[0]);
        } else {
            setSiguienteVerif('');
        }
    }, [fechaRevision]);

    useEffect(() => {
        onDataChange({
            id_equipo: equipoId,
            nombre_equipo_full: selectedEquipoRaw ? `${selectedEquipoRaw.nombre} [${selectedEquipoRaw.codigo}]` : '',
            fecha_revision: fechaRevision,
            nueva_vigencia: siguienteVerif,
            nueva_vigencia_solicitada: siguienteVerif,
            siguiente_verificacion: siguienteVerif,
            justificacion: justificacion,
            _form_type: 'EXTENSION_VIGENCIA'
        });
    }, [equipoId, fechaRevision, siguienteVerif, justificacion, selectedEquipoRaw]);

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

                {selectedEquipoRaw?.vigencia && (
                    <Box p="sm" style={{ background: 'var(--mantine-color-violet-1)', borderRadius: 'var(--mantine-radius-md)' }}>
                        <Text size="xs" c="violet.8" fw={700} tt="uppercase">Vigencia actual</Text>
                        <Text size="sm" fw={700} c="violet.9">
                            {(() => {
                                const d = parseDate(selectedEquipoRaw.vigencia);
                                return d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha Inválida';
                            })()}
                        </Text>
                    </Box>
                )}

                <Group grow align="flex-end">
                    <TextInput
                        label="Fecha de Revisión / Verificación"
                        type="date"
                        value={fechaRevision}
                        onChange={(e) => setFechaRevision(e.currentTarget.value)}
                        required
                        radius="md"
                    />
                    {siguienteVerif ? (
                        <Box p="xs" style={{ background: 'var(--mantine-color-teal-0)', border: '1px solid var(--mantine-color-teal-2)', borderRadius: 'var(--mantine-radius-md)' }}>
                            <Text size="xs" c="teal.8" fw={700} tt="uppercase">Nueva Vigencia Autocalculada</Text>
                            <Text size="sm" fw={700} c="teal.9">
                                {new Date(siguienteVerif + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </Text>
                            <Text size="xs" c="teal.6">(Auto: Revisión + 90 días)</Text>
                        </Box>
                    ) : (
                        <Box style={{ visibility: 'hidden' }}>
                            <TextInput label="-" />
                        </Box>
                    )}
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
