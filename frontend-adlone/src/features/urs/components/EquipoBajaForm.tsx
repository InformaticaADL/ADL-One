import React, { useState, useEffect } from 'react';
import { Select, Stack, Group, Text, Paper, Loader, Textarea, TextInput, Badge } from '@mantine/core';
import apiClient from '../../../config/axios.config';

interface EquipoBajaFormProps {
    onDataChange: (data: any) => void;
}

const EquipoBajaForm: React.FC<EquipoBajaFormProps> = ({ onDataChange }) => {
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [motivo, setMotivo] = useState<string | null>(null);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [observaciones, setObservaciones] = useState('');
    
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
        const equipoNombre = equipos.find(e => e.value === equipoId)?.label || '';

        onDataChange({
            id_equipo: equipoId,
            nombre_equipo_full: equipoNombre,
            motivo: motivo,
            fecha_baja: fecha,
            observaciones: observaciones,
            _form_type: 'BAJA_EQUIPO'
        });
    }, [equipoId, motivo, fecha, observaciones, equipos]);

    return (
        <Paper withBorder p="md" radius="md" bg="red.0">
            <Stack gap="md">
                <Group justify="space-between" mb={4}>
                    <Text fw={700} size="sm" c="red.8" style={{ textTransform: 'uppercase' }}>
                        Solicitud de Retiro / Baja de Equipo
                    </Text>
                    <Badge color="red" variant="dot">ALTA PRIORIDAD</Badge>
                </Group>

                <Select
                    label="Equipo a Desvincular"
                    placeholder={loadingEquipos ? "Cargando inventario..." : "Busque equipo por nombre o código"}
                    rightSection={loadingEquipos ? <Loader size={12} /> : null}
                    data={equipos}
                    value={equipoId}
                    onChange={setEquipoId}
                    searchable
                    required
                    radius="md"
                    description="Solo se muestran equipos actualmente activos en el sistema."
                />

                <Group grow>
                    <Select
                        label="Motivo del Cese"
                        placeholder="Seleccione causa..."
                        data={[
                            { value: 'OBSOLESCENCIA', label: 'Obsolescencia Técnica' },
                            { value: 'DANIO', label: 'Daño Irreparable' },
                            { value: 'EXTRAVIO', label: 'Pérdida / Robo / Extravío' },
                            { value: 'VIDA_UTIL', label: 'Fin de Vida Útil' },
                            { value: 'REEMPLAZO', label: 'Reemplazo por Tecnología Superior' },
                            { value: 'OTRO', label: 'Otro (Especificar en observaciones)' }
                        ]}
                        value={motivo}
                        onChange={setMotivo}
                        required
                        radius="md"
                    />
                    <TextInput
                        label="Fecha Efectiva"
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.currentTarget.value)}
                        required
                        radius="md"
                    />
                </Group>

                <Textarea
                    label="Fundamento Técnico / Observaciones"
                    placeholder="Describa el estado final del equipo, el número del acta de baja (si aplica) o detalles del siniestro..."
                    minRows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.currentTarget.value)}
                    radius="md"
                />
            </Stack>
        </Paper>
    );
};

export default EquipoBajaForm;
