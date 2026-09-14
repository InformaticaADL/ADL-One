import React, { useState, useEffect } from 'react';
import { Select, Typography, Card, Input, Checkbox, Alert, Tag, Divider, Spin } from 'antd';
import { IconInfoCircle, IconArrowsExchange, IconUser, IconMapPin, IconCalendarEvent } from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface EquipoTraspasoFormProps {
    onDataChange: (data: any) => void;
}

const EquipoTraspasoForm: React.FC<EquipoTraspasoFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
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
            .catch(() => showToast({ type: 'error', message: 'Error al cargar datos del formulario' }))
            .finally(() => setFetchingEquipos(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            .catch(() => showToast({ type: 'error', message: 'Error al obtener detalles del equipo' }))
            .finally(() => setFetchingDetails(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipoId]);

    // Optimized derived data
    const equipoOptions = React.useMemo(() => equipos.map(e => ({ value: String(e.id_equipo), label: `${e.nombre} [${e.codigo}]` })), [equipos]);

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        equipoId, traspasoDe, centroDestinoId, muestreadorDestinoId, motivo, fecha,
        selectedEquipoDetails, fetchingDetails, equipoLabel, muesNombreDestino, centroNombreDestino, ubicaciones
    ]);

    return (
        <Card size="small" style={{ backgroundColor: 'var(--app-accent-bg)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <Text strong style={{ fontSize: 13, color: '#1864ab', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <IconArrowsExchange size={18} /> Solicitud de Traspaso de Equipo
                        </Text>
                        <Tag color="blue">URS-03</Tag>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Utilice este formulario para cambiar la ubicación física o el responsable legal de un equipo.</Text>
                </div>

                <Field label="1. Seleccione el Equipo *">
                    <Select
                        placeholder={fetchingEquipos ? "Cargando..." : "Busque por nombre o código"}
                        options={equipoOptions}
                        value={equipoId ?? undefined}
                        onChange={(v) => setEquipoId(v ?? null)}
                        showSearch
                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                        notFoundContent="No se encontraron equipos"
                        suffixIcon={fetchingEquipos ? <Spin size="small" /> : <IconInfoCircle size={16} />}
                        style={{ width: '100%' }}
                    />
                </Field>

                {fetchingDetails && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 8 }}>
                        <Spin size="small" />
                        <Text type="secondary" style={{ fontSize: 12 }}>Obteniendo información actual...</Text>
                    </div>
                )}

                {selectedEquipoDetails && !fetchingDetails && (
                    <Alert
                        type="info"
                        showIcon
                        icon={<IconInfoCircle size={16} />}
                        message="Información Actual del Equipo"
                        description={
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <IconMapPin size={14} color="#1c7ed6" />
                                    <Text style={{ fontSize: 12 }}><strong>Ubicación:</strong> {selectedEquipoDetails.ubicacion || selectedEquipoDetails.sede || 'No registrada'}</Text>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <IconUser size={14} color="#1c7ed6" />
                                    <Text style={{ fontSize: 12 }}><strong>Responsable:</strong> {selectedEquipoDetails.nombre_asignado || selectedEquipoDetails.nombre_muestreador || 'No asignado'}</Text>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <IconCalendarEvent size={14} color="#1c7ed6" />
                                    <Text style={{ fontSize: 12 }}><strong>Próxima Vigencia:</strong> {selectedEquipoDetails.vigencia || 'N/A'}</Text>
                                </div>
                            </div>
                        }
                    />
                )}

                <Divider style={{ margin: 0 }}>2. Detalles del Traspaso</Divider>

                <Field label="¿Qué desea traspasar? *" hint="Seleccione una o ambas opciones">
                    <Checkbox.Group
                        value={traspasoDe}
                        onChange={(v) => setTraspasoDe(v as string[])}
                        options={[
                            { value: 'UBICACION', label: 'Cambio de Ubicación (Centro)' },
                            { value: 'RESPONSABLE', label: 'Cambio de Responsable' },
                        ]}
                    />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: traspasoDe.includes('UBICACION') && traspasoDe.includes('RESPONSABLE') ? '1fr 1fr' : '1fr', gap: 16 }}>
                    {traspasoDe.includes('UBICACION') && (
                        <Field label="Nueva Ubicación (Destino) *">
                            <Select
                                placeholder="Seleccione lugar"
                                options={ubicaciones}
                                value={centroDestinoId ?? undefined}
                                onChange={(v) => setCentroDestinoId(v ?? null)}
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                style={{ width: '100%' }}
                            />
                        </Field>
                    )}
                    {traspasoDe.includes('RESPONSABLE') && (
                        <Field label="Nuevo Responsable (Destino) *">
                            <Select
                                placeholder="Seleccione persona"
                                options={muestreadores}
                                value={muestreadorDestinoId ?? undefined}
                                onChange={(v) => setMuestreadorDestinoId(v ?? null)}
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                style={{ width: '100%' }}
                            />
                        </Field>
                    )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Fecha Efectiva del Cambio *">
                        <Input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                    </Field>
                    <Field label="Motivo / Justificación *">
                        <Input
                            placeholder="Ej: Cambio de área, reemplazo, etc."
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                        />
                    </Field>
                </div>
            </div>
        </Card>
    );
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
            {hint && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{hint}</Text>}
        </div>
    );
}

export default EquipoTraspasoForm;
