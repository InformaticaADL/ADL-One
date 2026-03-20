import React, { useState, useEffect } from 'react';
import { TextInput, Select, Stack, Group, Text, Paper, Textarea, Loader, Badge } from '@mantine/core';
import apiClient from '../../../config/axios.config';

interface ReporteProblemaFormProps {
    onDataChange: (data: any) => void;
}

const ReporteProblemaForm: React.FC<ReporteProblemaFormProps> = ({ onDataChange }) => {
    const [asunto, setAsunto] = useState('');
    const [categoria, setCategoria] = useState<string | null>(null);
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [descripcion, setDescripcion] = useState('');
    const [gravedad, setGravedad] = useState<string | null>('MEDIO');
    
    const [equipos, setEquipos] = useState<any[]>([]);
    const [loadingEquipos, setLoadingEquipos] = useState(false);

    useEffect(() => {
        setLoadingEquipos(true);
        apiClient.get('/api/admin/equipos?limit=500')
            .then(res => {
                const data = res.data.data || [];
                setEquipos(data.map((e: any) => ({
                    value: String(e.id_equipo),
                    label: `${e.nombre} [${e.codigo}]`
                })));
            })
            .catch(err => console.error("Error loading equipos:", err))
            .finally(() => setLoadingEquipos(false));
    }, []);

    useEffect(() => {
        const equipoNombre = equipos.find(e => e.value === equipoId)?.label || 'No aplica / No especificado';

        onDataChange({
            asunto: asunto,
            categoria_problema: categoria,
            id_equipo_afectado: equipoId,
            nombre_equipo_afectado: equipoNombre,
            descripcion_problema: descripcion,
            gravedad: gravedad,
            _form_type: 'REPORTE_PROBLEMA'
        });
    }, [asunto, categoria, equipoId, descripcion, gravedad, equipos]);

    return (
        <Paper withBorder p="md" radius="md" bg="orange.0">
            <Stack gap="md">
                <Group justify="space-between" mb={4}>
                    <Text fw={700} size="sm" c="orange.9" style={{ textTransform: 'uppercase' }}>
                        Reporte de Incidencia / Problema Técnico
                    </Text>
                    <Badge color="orange" variant="light">SERVICIO TÉCNICO</Badge>
                </Group>

                <TextInput
                    label="Asunto / Resumen corto"
                    placeholder="Ej: Fallo en sensor de pH, No conecta a red, etc."
                    value={asunto}
                    onChange={(e) => setAsunto(e.currentTarget.value)}
                    required
                    radius="md"
                    description="Describa brevemente el problema (máx 50 caract.)"
                />

                <Group grow>
                    <Select
                        label="Categoría del Problema"
                        placeholder="Seleccione categoría"
                        data={[
                            { value: 'HARDWARE', label: 'Fallo de Hardware / Piezas' },
                            { value: 'SOFTWARE', label: 'Error de Software / App' },
                            { value: 'CONECTIVIDAD', label: 'Problema de Conectividad / Red' },
                            { value: 'CALIBRACION', label: 'Descalibración / Medición Errónea' },
                            { value: 'DANIO_FISICO', label: 'Daño Físico Visible' },
                            { value: 'OTRO', label: 'Otro / No especificado' }
                        ]}
                        value={categoria}
                        onChange={setCategoria}
                        required
                        radius="md"
                    />
                    <Select
                        label="Nivel de Gravedad"
                        placeholder="Seleccione nivel"
                        data={[
                            { value: 'BAJO', label: '🟢 Bajo (Sin impacto crítico)' },
                            { value: 'MEDIO', label: '🔵 Medio (Impacto parcial)' },
                            { value: 'ALTO', label: '🟡 Alto (Urgente)' },
                            { value: 'CRITICO', label: '🔴 Crítico (Bloqueante)' }
                        ]}
                        value={gravedad}
                        onChange={setGravedad}
                        required
                        radius="md"
                    />
                </Group>

                <Select
                    label="Equipo Afectado (Opcional)"
                    placeholder={loadingEquipos ? "Cargando inventario..." : "Busque equipo afectado"}
                    rightSection={loadingEquipos ? <Loader size={12} /> : null}
                    data={equipos}
                    value={equipoId}
                    onChange={setEquipoId}
                    searchable
                    clearable
                    radius="md"
                />

                <Textarea
                    label="Descripción detallada"
                    placeholder="Explique qué sucedió, cuándo, frecuencia del fallo y si hay algún mensaje de error específico..."
                    minRows={4}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.currentTarget.value)}
                    required
                    radius="md"
                />
            </Stack>
        </Paper>
    );
};

export default ReporteProblemaForm;
