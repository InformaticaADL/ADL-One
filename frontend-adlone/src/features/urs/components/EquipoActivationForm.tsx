import React, { useState, useEffect } from 'react';
import { TextInput, Select, Stack, Group, Text, Paper, Loader, Button, Box, Alert } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';
import { TIPOS_EQUIPO } from '../constants/equipoTypes';

interface EquipoActivationFormProps {
    onDataChange: (data: any) => void;
}

const EquipoActivationForm: React.FC<EquipoActivationFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
    const [altaSubtype, setAltaSubtype] = useState<'NUEVO' | 'EXISTENTE'>('EXISTENTE');

    // EXISTENTE mode
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [equipos, setEquipos] = useState<any[]>([]);
    const [loadingEquipos, setLoadingEquipos] = useState(false);

    // NUEVO mode
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<string | null>(null);

    // Shared fields
    const [ubicacionId, setUbicacionId] = useState<string | null>(null);
    const [muestreadorId, setMuestreadorId] = useState<string | null>(null);
    const [fechaVigencia, setFechaVigencia] = useState(new Date().toISOString().split('T')[0]);

    const [ubicaciones, setUbicaciones] = useState<any[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [loadingUbicaciones, setLoadingUbicaciones] = useState(false);
    const [loadingMuestreadores, setLoadingMuestreadores] = useState(false);

    useEffect(() => {
        setLoadingUbicaciones(true);
        apiClient.get('/api/catalogos/lugares-analisis')
            .then(res => {
                const data = res.data.data || [];
                setUbicaciones(data.map((l: any) => ({
                    value: String(l.sigla || ''),
                    label: l.nombre_lugaranalisis || l.nombre || 'Sin nombre'
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar ubicaciones' }))
            .finally(() => setLoadingUbicaciones(false));

        setLoadingMuestreadores(true);
        apiClient.get('/api/catalogos/muestreadores')
            .then(res => {
                const data = res.data.data || [];
                setMuestreadores(data.map((m: any) => ({
                    value: String(m.id_muestreador || m.id || ''),
                    label: m.nombre_muestreador || m.nombre || 'Sin nombre'
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar responsables' }))
            .finally(() => setLoadingMuestreadores(false));
    }, []);

    // Load inventory only when EXISTENTE mode is active
    useEffect(() => {
        if (altaSubtype !== 'EXISTENTE' || equipos.length > 0) return;
        setLoadingEquipos(true);
        apiClient.get('/api/admin/equipos?limit=500')
            .then(res => {
                setEquipos((res.data.data || []).map((e: any) => ({
                    value: String(e.id_equipo),
                    label: `${e.nombre} [${e.codigo}]`,
                    tipo: e.tipo || null
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar inventario de equipos' }))
            .finally(() => setLoadingEquipos(false));
    }, [altaSubtype]);

    // Auto-fill tipo when equipo is selected in EXISTENTE mode
    const selectedEquipoData = equipos.find(e => e.value === equipoId);
    useEffect(() => {
        if (altaSubtype === 'EXISTENTE' && selectedEquipoData?.tipo) {
            setTipo(selectedEquipoData.tipo);
        }
    }, [equipoId, altaSubtype]);

    // Reset equipo selection when switching modes
    const handleModeSwitch = (mode: 'NUEVO' | 'EXISTENTE') => {
        setAltaSubtype(mode);
        setEquipoId(null);
        setNombre('');
        setTipo(null);
    };

    useEffect(() => {
        const ubicacionNombre = ubicaciones.find(u => u.value === ubicacionId)?.label || '';
        const responsableNombre = muestreadores.find(m => m.value === muestreadorId)?.label || '';
        const nombreFinal = altaSubtype === 'EXISTENTE'
            ? (selectedEquipoData?.label || '')
            : nombre;

        onDataChange({
            subtipo_alta: altaSubtype,
            id_equipo: altaSubtype === 'EXISTENTE' ? equipoId : null,
            nombre_equipo: nombreFinal,
            tipo_equipo: tipo,
            id_ubicacion: ubicacionId,
            nombre_ubicacion: ubicacionNombre,
            id_responsable: muestreadorId,
            nombre_responsable: responsableNombre,
            fecha_vigencia: fechaVigencia,
            _form_type: 'ACTIVACION_EQUIPO'
        });
    }, [nombre, tipo, ubicacionId, muestreadorId, ubicaciones, muestreadores, altaSubtype, fechaVigencia, equipoId, selectedEquipoData]);

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
                            onClick={() => handleModeSwitch('EXISTENTE')}
                            size="compact-xs"
                            radius="xl"
                        >
                            Desde Inventario
                        </Button>
                        <Button
                            variant={altaSubtype === 'NUEVO' ? 'filled' : 'light'}
                            onClick={() => handleModeSwitch('NUEVO')}
                            size="compact-xs"
                            radius="xl"
                        >
                            Nuevo Registro
                        </Button>
                    </Group>
                </Group>

                {altaSubtype === 'EXISTENTE' ? (
                    <>
                        <Alert icon={<IconInfoCircle size={14} />} color="blue" variant="light" radius="md" p="xs">
                            <Text size="xs">Selecciona un equipo del inventario para reactivarlo o reasignarlo.</Text>
                        </Alert>
                        <Select
                            label="Equipo del Inventario"
                            placeholder={loadingEquipos ? 'Cargando inventario...' : 'Busque por nombre o código'}
                            rightSection={loadingEquipos ? <Loader size={12} /> : null}
                            data={equipos}
                            value={equipoId}
                            onChange={setEquipoId}
                            searchable
                            required
                            radius="md"
                            nothingFoundMessage="No se encontraron equipos"
                        />
                    </>
                ) : (
                    <>
                        <Alert icon={<IconInfoCircle size={14} />} color="teal" variant="light" radius="md" p="xs">
                            <Text size="xs">Completa los datos del equipo nuevo que ingresará al inventario.</Text>
                        </Alert>
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
                                data={TIPOS_EQUIPO}
                                value={tipo}
                                onChange={setTipo}
                                required
                                radius="md"
                                searchable
                            />
                        </Group>
                    </>
                )}

                <Group grow>
                    <Select
                        label="Ubicación Destino"
                        placeholder={loadingUbicaciones ? 'Cargando...' : 'Seleccione base / laboratorio'}
                        rightSection={loadingUbicaciones ? <Loader size={12} /> : null}
                        data={ubicaciones}
                        value={ubicacionId}
                        onChange={setUbicacionId}
                        searchable
                        required
                        radius="md"
                    />
                    <Select
                        label="Responsable Asignado"
                        placeholder={loadingMuestreadores ? 'Cargando...' : 'Seleccione responsable'}
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
                        <TextInput label="-" />
                    </Box>
                </Group>
            </Stack>
        </Paper>
    );
};

export default EquipoActivationForm;
