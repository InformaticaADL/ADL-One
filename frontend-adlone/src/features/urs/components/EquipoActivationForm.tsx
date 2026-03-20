import React, { useState, useEffect } from 'react';
import { TextInput, Select, Stack, Group, Text, Paper, Loader, Button, Box } from '@mantine/core';
import apiClient from '../../../config/axios.config';

interface EquipoActivationFormProps {
    onDataChange: (data: any) => void;
}

const EquipoActivationForm: React.FC<EquipoActivationFormProps> = ({ onDataChange }) => {
    const [altaSubtype, setAltaSubtype] = useState<'NUEVO' | 'EXISTENTE'>('EXISTENTE');
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<string | null>(null);
    const [centroId, setCentroId] = useState<string | null>(null);
    const [muestreadorId, setMuestreadorId] = useState<string | null>(null);
    const [fechaVigencia, setFechaVigencia] = useState(new Date().toISOString().split('T')[0]);
    
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
            subtipo_alta: altaSubtype,
            nombre_equipo: nombre,
            tipo_equipo: tipo,
            id_centro: centroId,
            nombre_centro: centroNombre,
            id_responsable: muestreadorId,
            nombre_responsable: responsableNombre,
            fecha_vigencia: fechaVigencia,
            _form_type: 'ACTIVACION_EQUIPO'
        });
    }, [nombre, tipo, centroId, muestreadorId, centros, muestreadores, altaSubtype, fechaVigencia]);

    return (
        <Paper withBorder p="md" radius="md" bg="blue.0">
            <Stack gap="md">
                <Group justify="space-between">
                    <Text fw={700} size="sm" c="blue.8" style={{ textTransform: 'uppercase' }}>
                        Activación de Equipo
                    </Text>
                    <Group gap="xs">
                        <Button 
                            variant={altaSubtype === 'EXISTENTE' ? 'filled' : 'light'} 
                            onClick={() => setAltaSubtype('EXISTENTE')}
                            size="compact-xs"
                            radius="xl"
                        >
                            Desde Existente
                        </Button>
                        <Button 
                            variant={altaSubtype === 'NUEVO' ? 'filled' : 'light'} 
                            onClick={() => setAltaSubtype('NUEVO')}
                            size="compact-xs"
                            radius="xl"
                        >
                            Nuevo Registro
                        </Button>
                    </Group>
                </Group>

                <Group grow>
                    <TextInput
                        label="Nombre / Modelo del Equipo"
                        placeholder="Ej: Multiparámetro WTW Multi 3630"
                        value={nombre}
                        onChange={(e) => setNombre(e.currentTarget.value)}
                        required
                        radius="md"
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
                            'Termo / Incubadora',
                            'Otro'
                        ]}
                        value={tipo}
                        onChange={setTipo}
                        required
                        radius="md"
                        searchable
                    />
                </Group>

                <Group grow>
                    <Select
                        label="Ubicación Destino"
                        placeholder={loadingCentros ? "Cargando..." : "Seleccione centro"}
                        rightSection={loadingCentros ? <Loader size={12} /> : null}
                        data={centros}
                        value={centroId}
                        onChange={setCentroId}
                        searchable
                        required
                        radius="md"
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
                        radius="md"
                    />
                </Group>

                <Group grow>
                    <TextInput
                        label="Fecha de Inicio / Vigencia"
                        type="date"
                        value={fechaVigencia}
                        onChange={(e) => setFechaVigencia(e.currentTarget.value)}
                        required
                        radius="md"
                    />
                    <Box style={{ visibility: 'hidden' }}>
                        {/* Spacer to maintain grid symmetry */}
                        <TextInput label="-" />
                    </Box>
                </Group>
            </Stack>
        </Paper>
    );
};

export default EquipoActivationForm;
