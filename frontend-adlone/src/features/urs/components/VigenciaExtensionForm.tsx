import React, { useState, useEffect } from 'react';
import { Select, Typography, Card, Spin, Input, Tag } from 'antd';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;
const { TextArea } = Input;

interface VigenciaExtensionFormProps {
    onDataChange: (data: any) => void;
}

const parseDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    // Handle dd/MM/yyyy format (e.g. "30/06/2026")
    const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(ddmmyyyyPattern);
    if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed month
        const year = parseInt(match[3], 10);
        const date = new Date(year, month, day);
        return isNaN(date.getTime()) ? null : date;
    }
    // Fallback to ISO / standard format
    const parsed = new Date(dateStr);
    return isNaN(parsed.getTime()) ? null : parsed;
};

const VigenciaExtensionForm: React.FC<VigenciaExtensionFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [fechaRevision, setFechaRevision] = useState('');
    const [siguienteVerif, setSiguienteVerif] = useState('');
    const [justificacion, setJustificacion] = useState('');

    const [equipos, setEquipos] = useState<{ value: string; label: string }[]>([]);
    const [equiposRaw, setEquiposRaw] = useState<any[]>([]);
    const [loadingEquipos, setLoadingEquipos] = useState(false);

    const selectedEquipoRaw = equiposRaw.find(e => String(e.id_equipo) === equipoId) || null;

    useEffect(() => {
        setLoadingEquipos(true);
        apiClient.get('/api/admin/equipos?limit=500')
            .then(res => {
                const data = res.data.data || [];
                setEquiposRaw(data);
                setEquipos(data.map((e: any) => ({
                    value: String(e.id_equipo),
                    label: `${e.nombre} [${e.codigo}]`
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar inventario de equipos' }))
            .finally(() => setLoadingEquipos(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Calcular fecha de siguiente verificación (+90 días) al ingresar fecha de revisión
    useEffect(() => {
        if (fechaRevision) {
            const d = new Date(fechaRevision);
            d.setDate(d.getDate() + 90);
            setSiguienteVerif(d.toISOString().split('T')[0]);
        } else {
            setSiguienteVerif('');
        }
    }, [fechaRevision]);

    useEffect(() => {
        onDataChange({
            id_equipo: equipoId,
            nombre_equipo_full: selectedEquipoRaw ? `${selectedEquipoRaw.nombre} [${selectedEquipoRaw.codigo}]` : '',
            fecha_revision: fechaRevision,
            nueva_vigencia: siguienteVerif,
            nueva_vigencia_solicitada: siguienteVerif,
            siguiente_verificacion: siguienteVerif,
            justificacion: justificacion,
            _form_type: 'EXTENSION_VIGENCIA'
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipoId, fechaRevision, siguienteVerif, justificacion, selectedEquipoRaw]);

    return (
        <Card size="small" style={{ backgroundColor: 'rgba(156,54,181,0.06)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13, color: '#862e9c', textTransform: 'uppercase' }}>
                        Solicitud de Extensión de Vigencia
                    </Text>
                    <Tag color="purple">CALIDAD / MA</Tag>
                </div>

                <Field label="Seleccionar Equipo *">
                    <Select
                        placeholder={loadingEquipos ? "Cargando..." : "Busque equipo por nombre o código"}
                        suffixIcon={loadingEquipos ? <Spin size="small" /> : undefined}
                        options={equipos}
                        value={equipoId ?? undefined}
                        onChange={(v) => setEquipoId(v ?? null)}
                        showSearch
                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                        style={{ width: '100%' }}
                    />
                </Field>

                {selectedEquipoRaw?.vigencia && (
                    <div style={{ padding: 10, background: 'rgba(156,54,181,0.1)', borderRadius: 8 }}>
                        <Text strong style={{ fontSize: 11, color: '#862e9c', textTransform: 'uppercase', display: 'block' }}>Vigencia actual</Text>
                        <Text strong style={{ fontSize: 13, color: '#862e9c' }}>
                            {(() => {
                                const d = parseDate(selectedEquipoRaw.vigencia);
                                return d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha Inválida';
                            })()}
                        </Text>
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'end' }}>
                    <Field label="Fecha de Revisión / Verificación *">
                        <Input
                            type="date"
                            value={fechaRevision}
                            onChange={(e) => setFechaRevision(e.target.value)}
                        />
                    </Field>
                    {siguienteVerif && (
                        <div style={{ padding: 8, background: 'rgba(9,143,131,0.08)', border: '1px solid rgba(9,143,131,0.2)', borderRadius: 8 }}>
                            <Text strong style={{ fontSize: 11, color: '#087f5b', textTransform: 'uppercase', display: 'block' }}>Nueva Vigencia Autocalculada</Text>
                            <Text strong style={{ fontSize: 13, color: '#087f5b', display: 'block' }}>
                                {new Date(siguienteVerif + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </Text>
                            <Text style={{ fontSize: 11, color: '#0ca678' }}>(Auto: Revisión + 90 días)</Text>
                        </div>
                    )}
                </div>

                <Field label="Justificación de la Extensión *">
                    <TextArea
                        placeholder="Explique por qué se requiere extender el plazo de uso de este equipo..."
                        autoSize={{ minRows: 3 }}
                        value={justificacion}
                        onChange={(e) => setJustificacion(e.target.value)}
                    />
                </Field>
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

export default VigenciaExtensionForm;
