import React, { useState, useEffect } from 'react';
import { Select, Stack, Group, Text, Paper, Loader, Textarea, TextInput } from '@mantine/core';
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
                <Text fw={700} size="sm" c="red.8" style={{ textTransform: 'uppercase' }}>
                    Solicitud de Retiro / Baja de Equipo
                </Text>

                <Select
                    label="Seleccionar Equipo"
                    placeholder={loadingEquipos ? "Cargando..." : "Busque equipo por nombre o código"}
                    rightSection={loadingEquipos ? <Loader size={12} /> : null}
                    data={equipos}
                    value={equipoId}
                    onChange={setEquipoId}
                    searchable
                    required
                />

                <Group grow>
                    <Select
                        label="Motivo de la Baja"
                        placeholder="Seleccione motivo"
                        data={[
                            'Obsolescencia Técnica',
                            'Daño Irreparable',
                            'Pérdida / Robo',
                            'Fin de Vida Útil',
                            'Reemplazo por Nuevo',
                            'Otro'
                        ]}
                        value={motivo}
                        onChange={setMotivo}
                        required
                    />
                    <TextInput
                        label="Fecha del Suceso / Último Uso"
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.currentTarget.value)}
                        required
                    />
                </Group>

                <Textarea
                    label="Observaciones Técnicas"
                    placeholder="Describa el estado final del equipo o detalles del incidente..."
                    minRows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.currentTarget.value)}
                />
            </Stack>
        </Paper>
    );
};

export default EquipoBajaForm;
