import React, { useState, useEffect } from 'react';
import { TextInput, Select, Stack, Group, Text, Paper, Loader } from '@mantine/core';
import apiClient from '../../../config/axios.config';

interface EquipoActivationFormProps {
    onDataChange: (data: any) => void;
}

const EquipoActivationForm: React.FC<EquipoActivationFormProps> = ({ onDataChange }) => {
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<string | null>(null);
    const [centroId, setCentroId] = useState<string | null>(null);
    const [muestreadorId, setMuestreadorId] = useState<string | null>(null);
    
    const [centros, setCentros] = useState<any[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [loadingCentros, setLoadingCentros] = useState(false);
    const [loadingMuestreadores, setLoadingMuestreadores] = useState(false);

    useEffect(() => {
        setLoadingCentros(true);
        apiClient.get('/api/catalogos/centros')
            .then(res => {
                const data = res.data.data || [];
                setCentros(data.map((c: any) => ({
                    value: String(c.id_centro || c.id || ''),
                    label: c.nombre_centro || c.nombre || 'Sin nombre'
                })));
            })
            .catch(err => console.error("Error loading centros:", err))
            .finally(() => setLoadingCentros(false));

        setLoadingMuestreadores(true);
        apiClient.get('/api/catalogos/muestreadores')
            .then(res => {
                const data = res.data.data || [];
                setMuestreadores(data.map((m: any) => ({
                    value: String(m.id_muestreador || m.id || ''),
                    label: m.nombre_muestreador || m.nombre || 'Sin nombre'
                })));
            })
            .catch(err => console.error("Error loading muestreadores:", err))
            .finally(() => setLoadingMuestreadores(false));
    }, []);

    useEffect(() => {
        const centroNombre = centros.find(c => c.value === centroId)?.label || '';
        const responsableNombre = muestreadores.find(m => m.value === muestreadorId)?.label || '';

        onDataChange({
            nombre_equipo: nombre,
            tipo_equipo: tipo,
            id_centro: centroId,
            nombre_centro: centroNombre,
            id_responsable: muestreadorId,
            nombre_responsable: responsableNombre,
            // Flag for specialized rendering in detail
            _form_type: 'ACTIVACION_EQUIPO'
        });
    }, [nombre, tipo, centroId, muestreadorId, centros, muestreadores]);

    return (
        <Paper withBorder p="md" radius="md" bg="gray.0">
            <Stack gap="md">
                <Text fw={700} size="sm" c="dimmed" style={{ textTransform: 'uppercase' }}>
                    Información Técnica del Equipo
                </Text>

                <Group grow>
                    <TextInput
                        label="Nombre / Modelo del Equipo"
                        placeholder="Ej: Multiparámetro WTW Multi 3630"
                        value={nombre}
                        onChange={(e) => setNombre(e.currentTarget.value)}
                        required
                    />
                    <Select
                        label="Tipo de Equipo"
                        placeholder="Seleccione tipo"
                        data={[
                            'Multiparámetro',
                            'Muestreador Isotérmico',
                            'Muestreador Automático',
                            'Sonda Nivel',
                            'GPS',
                            'Centrifuga',
                            'Otro'
                        ]}
                        value={tipo}
                        onChange={setTipo}
                        required
                    />
                </Group>

                <Group grow>
                    <Select
                        label="Ubicación (Centro / Sede)"
                        placeholder={loadingCentros ? "Cargando..." : "Seleccione centro"}
                        rightSection={loadingCentros ? <Loader size={12} /> : null}
                        data={centros}
                        value={centroId}
                        onChange={setCentroId}
                        searchable
                        required
                    />
                    <Select
                        label="Responsable Asignado"
                        placeholder={loadingMuestreadores ? "Cargando..." : "Seleccione responsable"}
                        rightSection={loadingMuestreadores ? <Loader size={12} /> : null}
                        data={muestreadores}
                        value={muestreadorId}
                        onChange={setMuestreadorId}
                        searchable
                        required
                    />
                </Group>
            </Stack>
        </Paper>
    );
};

export default EquipoActivationForm;
