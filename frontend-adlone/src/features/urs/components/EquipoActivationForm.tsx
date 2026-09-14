import React, { useState, useEffect } from 'react';
import { Input, Select, Typography, Card, Spin, Button, Alert } from 'antd';
import { IconInfoCircle } from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';
import { TIPOS_EQUIPO } from '../constants/equipoTypes';

const { Text } = Typography;

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [altaSubtype]);

    // Auto-fill tipo when equipo is selected in EXISTENTE mode
    const selectedEquipoData = equipos.find(e => e.value === equipoId);
    useEffect(() => {
        if (altaSubtype === 'EXISTENTE' && selectedEquipoData?.tipo) {
            setTipo(selectedEquipoData.tipo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nombre, tipo, ubicacionId, muestreadorId, ubicaciones, muestreadores, altaSubtype, fechaVigencia, equipoId, selectedEquipoData]);

    return (
        <Card size="small" style={{ backgroundColor: 'var(--app-accent-bg)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13, color: '#1864ab', textTransform: 'uppercase' }}>
                        Activación de Equipo
                    </Text>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                            type={altaSubtype === 'EXISTENTE' ? 'primary' : 'default'}
                            onClick={() => handleModeSwitch('EXISTENTE')}
                            size="small"
                            shape="round"
                        >
                            Desde Inventario
                        </Button>
                        <Button
                            type={altaSubtype === 'NUEVO' ? 'primary' : 'default'}
                            onClick={() => handleModeSwitch('NUEVO')}
                            size="small"
                            shape="round"
                        >
                            Nuevo Registro
                        </Button>
                    </div>
                </div>

                {altaSubtype === 'EXISTENTE' ? (
                    <>
                        <Alert type="info" showIcon icon={<IconInfoCircle size={14} />} message={<Text style={{ fontSize: 12 }}>Selecciona un equipo del inventario para reactivarlo o reasignarlo.</Text>} />
                        <Field label="Equipo del Inventario *">
                            <Select
                                placeholder={loadingEquipos ? 'Cargando inventario...' : 'Busque por nombre o código'}
                                suffixIcon={loadingEquipos ? <Spin size="small" /> : undefined}
                                options={equipos}
                                value={equipoId ?? undefined}
                                onChange={(v) => setEquipoId(v ?? null)}
                                showSearch
                                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                notFoundContent="No se encontraron equipos"
                                style={{ width: '100%' }}
                            />
                        </Field>
                    </>
                ) : (
                    <>
                        <Alert type="success" showIcon icon={<IconInfoCircle size={14} />} message={<Text style={{ fontSize: 12 }}>Completa los datos del equipo nuevo que ingresará al inventario.</Text>} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                            <Field label="Nombre / Modelo del Equipo *">
                                <Input
                                    placeholder="Ej: Multiparámetro WTW Multi 3630"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                />
                            </Field>
                            <Field label="Tipo de Equipo *">
                                <Select
                                    placeholder="Seleccione tipo"
                                    options={TIPOS_EQUIPO.map((t: string) => ({ value: t, label: t }))}
                                    value={tipo ?? undefined}
                                    onChange={(v) => setTipo(v ?? null)}
                                    showSearch
                                    style={{ width: '100%' }}
                                />
                            </Field>
                        </div>
                    </>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Ubicación Destino *">
                        <Select
                            placeholder={loadingUbicaciones ? 'Cargando...' : 'Seleccione base / laboratorio'}
                            suffixIcon={loadingUbicaciones ? <Spin size="small" /> : undefined}
                            options={ubicaciones}
                            value={ubicacionId ?? undefined}
                            onChange={(v) => setUbicacionId(v ?? null)}
                            showSearch
                            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                            style={{ width: '100%' }}
                        />
                    </Field>
                    <Field label="Responsable Asignado *">
                        <Select
                            placeholder={loadingMuestreadores ? 'Cargando...' : 'Seleccione responsable'}
                            suffixIcon={loadingMuestreadores ? <Spin size="small" /> : undefined}
                            options={muestreadores}
                            value={muestreadorId ?? undefined}
                            onChange={(v) => setMuestreadorId(v ?? null)}
                            showSearch
                            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                            style={{ width: '100%' }}
                        />
                    </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Fecha de Inicio / Vigencia *">
                        <Input
                            type="date"
                            value={fechaVigencia}
                            onChange={(e) => setFechaVigencia(e.target.value)}
                        />
                    </Field>
                    <div />
                </div>
            </div>
        </Card>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
        </div>
    );
}

export default EquipoActivationForm;
