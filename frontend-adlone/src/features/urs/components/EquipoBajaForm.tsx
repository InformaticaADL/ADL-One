import React, { useState, useEffect } from 'react';
import { Select, Typography, Card, Spin, Input, Tag } from 'antd';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;
const { TextArea } = Input;

interface EquipoBajaFormProps {
    onDataChange: (data: any) => void;
}

const EquipoBajaForm: React.FC<EquipoBajaFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
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
            .catch(() => showToast({ type: 'error', message: 'Error al cargar inventario de equipos' }))
            .finally(() => setLoadingEquipos(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipoId, motivo, fecha, observaciones, equipos]);

    return (
        <Card size="small" style={{ backgroundColor: 'rgba(224,49,49,0.05)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13, color: '#c92a2a', textTransform: 'uppercase' }}>
                        Solicitud de Retiro / Baja de Equipo
                    </Text>
                    <Tag color="red">ALTA PRIORIDAD</Tag>
                </div>

                <Field label="Equipo a Desvincular *" hint="Solo se muestran equipos actualmente activos en el sistema.">
                    <Select
                        placeholder={loadingEquipos ? "Cargando inventario..." : "Busque equipo por nombre o código"}
                        suffixIcon={loadingEquipos ? <Spin size="small" /> : undefined}
                        options={equipos}
                        value={equipoId ?? undefined}
                        onChange={(v) => setEquipoId(v ?? null)}
                        showSearch
                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                        style={{ width: '100%' }}
                    />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Motivo del Cese *">
                        <Select
                            placeholder="Seleccione causa..."
                            options={[
                                { value: 'OBSOLESCENCIA', label: 'Obsolescencia Técnica' },
                                { value: 'DANIO', label: 'Daño Irreparable' },
                                { value: 'EXTRAVIO', label: 'Pérdida / Robo / Extravío' },
                                { value: 'VIDA_UTIL', label: 'Fin de Vida Útil' },
                                { value: 'REEMPLAZO', label: 'Reemplazo por Tecnología Superior' },
                                { value: 'OTRO', label: 'Otro (Especificar en observaciones)' }
                            ]}
                            value={motivo ?? undefined}
                            onChange={(v) => setMotivo(v ?? null)}
                            style={{ width: '100%' }}
                        />
                    </Field>
                    <Field label="Fecha Efectiva *">
                        <Input
                            type="date"
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                    </Field>
                </div>

                <Field label="Fundamento Técnico / Observaciones">
                    <TextArea
                        placeholder="Describa el estado final del equipo, el número del acta de baja (si aplica) o detalles del siniestro..."
                        autoSize={{ minRows: 3 }}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
                    />
                </Field>
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

export default EquipoBajaForm;
