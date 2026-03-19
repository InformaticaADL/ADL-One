import React, { useState, useEffect } from 'react';
import { Select, Stack, Group, Text, Paper, TextInput, Checkbox, Alert, Badge, Divider, Box, Loader } from '@mantine/core';
import { IconInfoCircle, IconArrowsExchange, IconUser, IconMapPin, IconCalendarEvent } from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';

interface EquipoTraspasoFormProps {
    onDataChange: (data: any) => void;
}

const EquipoTraspasoForm: React.FC<EquipoTraspasoFormProps> = ({ onDataChange }) => {
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [centroDestinoId, setCentroDestinoId] = useState<string | null>(null);
    const [muestreadorDestinoId, setMuestreadorDestinoId] = useState<string | null>(null);
    const [traspasoDe, setTraspasoDe] = useState<string[]>(['RESPONSABLE']); // Default to responsible
    const [motivo, setMotivo] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    
    const [equipos, setEquipos] = useState<any[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [ubicaciones, setUbicaciones] = useState<any[]>([]);
    const [fetchingEquipos, setFetchingEquipos] = useState(false);
    const [selectedEquipoDetails, setSelectedEquipoDetails] = useState<any | null>(null);
    const [fetchingDetails, setFetchingDetails] = useState(false);

    // List load
    useEffect(() => {
        setFetchingEquipos(true);
        const p1 = apiClient.get('/api/admin/equipos?limit=500');
        const p2 = apiClient.get('/api/catalogos/muestreadores');
        const p3 = apiClient.get('/api/catalogos/lugares-analisis');

        Promise.all([p1, p2, p3])
            .then(([resEq, resMues, resLugar]) => {
                setEquipos(resEq.data.data || []);
                setMuestreadores((resMues.data.data || []).map((m: any) => ({
                    value: String(m.id_muestreador || m.id),
                    label: m.nombre_muestreador || m.nombre
                })));
                setUbicaciones((resLugar.data.data || []).map((l: any) => ({
                    value: String(l.sigla),
                    label: `${l.nombre_lugaranalisis} (${l.sigla})`
                })));
            })
            .catch(console.error)
            .finally(() => setFetchingEquipos(false));
    }, []);

    // Load extra details when equipment is selected
    useEffect(() => {
        if (!equipoId) {
            setSelectedEquipoDetails(null);
            return;
        }

        setFetchingDetails(true);
        apiClient.get(`/api/admin/equipos/${equipoId}`)
            .then(res => {
                if (res.data.success) {
                    setSelectedEquipoDetails(res.data.data || null);
                }
            })
            .catch(err => console.error("Error fetching equipo details:", err))
            .finally(() => setFetchingDetails(false));
    }, [equipoId]);

    // Optimized derived data
    const equipoLabel = React.useMemo(() => {
        const basic = equipos.find(e => String(e.id_equipo) === equipoId);
        return basic ? `${basic.nombre} [${basic.codigo}]` : '';
    }, [equipos, equipoId]);

    const muesNombreDestino = React.useMemo(() => 
        muestreadores.find(m => m.value === muestreadorDestinoId)?.label || '',
    [muestreadores, muestreadorDestinoId]);

    const centroNombreDestino = React.useMemo(() => 
        ubicaciones.find(c => c.value === centroDestinoId)?.label || '',
    [ubicaciones, centroDestinoId]);

    // Update parent with cumulative data - slightly deferred or optimized
    useEffect(() => {
        // Solo notificamos si hay cambios reales y no estamos cargando detalles críticos
        if (fetchingDetails) return;

        onDataChange({
            id_equipo: equipoId,
            nombre_equipo_full: equipoLabel,
            traspaso_de: traspasoDe,
            
            // Current Info for Audit/Display (from detailed fetch)
            info_actual: selectedEquipoDetails ? {
                ubicacion: selectedEquipoDetails.ubicacion || selectedEquipoDetails.sede || 'No asignada',
                responsable: selectedEquipoDetails.nombre_asignado || selectedEquipoDetails.nombre_muestreador || 'No asignado',
                fecha_vigencia: selectedEquipoDetails.vigencia || selectedEquipoDetails.fecha_vigencia || 'N/A'
            } : null,

            // New values based on selection
            id_centro_destino: traspasoDe.includes('UBICACION') ? centroDestinoId : null,
            nombre_centro_destino: traspasoDe.includes('UBICACION') ? centroNombreDestino : null,
            id_muestreador_destino: traspasoDe.includes('RESPONSABLE') ? muestreadorDestinoId : null,
            nombre_muestreador_destino: traspasoDe.includes('RESPONSABLE') ? muesNombreDestino : null,
            
            motivo: motivo,
            fecha_traspaso: fecha,
            _form_type: 'TRASPASO_EQUIPO'
        });
    }, [
        equipoId, traspasoDe, centroDestinoId, muestreadorDestinoId, motivo, fecha, 
        selectedEquipoDetails, fetchingDetails, equipoLabel, muesNombreDestino, centroNombreDestino, ubicaciones
    ]);

    return (
        <Paper withBorder p="md" radius="md" bg="blue.0">
            <Stack gap="md">
                <Box>
                    <Group justify="space-between" mb={5}>
                        <Text fw={700} size="sm" c="blue.8" style={{ textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <IconArrowsExchange size={18} /> Solicitud de Traspaso de Equipo
                        </Text>
                        <Badge color="blue" variant="light">URS-03</Badge>
                    </Group>
                    <Text size="xs" c="dimmed">Utilice este formulario para cambiar la ubicación física o el responsable legal de un equipo.</Text>
                </Box>

                <Select
                    label="1. Seleccione el Equipo"
                    placeholder={fetchingEquipos ? "Cargando..." : "Busque por nombre o código"}
                    data={equipos.map(e => ({ value: String(e.id_equipo), label: `${e.nombre} [${e.codigo}]` }))}
                    value={equipoId}
                    onChange={setEquipoId}
                    searchable
                    required
                    leftSection={fetchingEquipos ? <Loader size={12} /> : <IconInfoCircle size={16} />}
                    nothingFoundMessage="No se encontraron equipos"
                />

                {fetchingDetails && (
                    <Group gap="xs" p="xs">
                        <Loader size="xs" />
                        <Text size="xs" c="dimmed">Obteniendo información actual...</Text>
                    </Group>
                )}

                {selectedEquipoDetails && !fetchingDetails && (
                    <Alert icon={<IconInfoCircle size={16} />} title="Información Actual del Equipo" color="blue" radius="md" variant="light">
                        <Stack gap={4}>
                            <Group gap="xs">
                                <IconMapPin size={14} color="#1c7ed6" />
                                <Text size="xs"><strong>Ubicación:</strong> {selectedEquipoDetails.ubicacion || selectedEquipoDetails.sede || 'No registrada'}</Text>
                            </Group>
                            <Group gap="xs">
                                <IconUser size={14} color="#1c7ed6" />
                                <Text size="xs"><strong>Responsable:</strong> {selectedEquipoDetails.nombre_asignado || selectedEquipoDetails.nombre_muestreador || 'No asignado'}</Text>
                            </Group>
                            <Group gap="xs">
                                <IconCalendarEvent size={14} color="#1c7ed6" />
                                <Text size="xs"><strong>Próxima Vigencia:</strong> {selectedEquipoDetails.vigencia || 'N/A'}</Text>
                            </Group>
                        </Stack>
                    </Alert>
                )}

                <Divider label="2. Detalles del Traspaso" labelPosition="center" />

                <Checkbox.Group
                    label="¿Qué desea traspasar?"
                    description="Seleccione una o ambas opciones"
                    value={traspasoDe}
                    onChange={setTraspasoDe}
                    required
                >
                    <Group mt="xs">
                        <Checkbox value="UBICACION" label="Cambio de Ubicación (Centro)" />
                        <Checkbox value="RESPONSABLE" label="Cambio de Responsable" />
                    </Group>
                </Checkbox.Group>

                <Group grow>
                    {traspasoDe.includes('UBICACION') && (
                        <Select
                            label="Nueva Ubicación (Destino)"
                            placeholder="Seleccione lugar"
                            data={ubicaciones}
                            value={centroDestinoId}
                            onChange={setCentroDestinoId}
                            searchable
                            required
                        />
                    )}
                    {traspasoDe.includes('RESPONSABLE') && (
                        <Select
                            label="Nuevo Responsable (Destino)"
                            placeholder="Seleccione persona"
                            data={muestreadores}
                            value={muestreadorDestinoId}
                            onChange={setMuestreadorDestinoId}
                            searchable
                            required
                        />
                    )}
                </Group>

                <Group grow>
                    <TextInput
                        label="Fecha Efectiva del Cambio"
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.currentTarget.value)}
                        required
                    />
                    <TextInput
                        label="Motivo / Justificación"
                        placeholder="Ej: Cambio de área, reemplazo, etc."
                        value={motivo}
                        onChange={(e) => setMotivo(e.currentTarget.value)}
                        required
                    />
                </Group>
            </Stack>
        </Paper>
    );
};

export default EquipoTraspasoForm;
