import React, { useState, useEffect } from 'react';
import { Input, Select, Typography, Card, Spin, Tag } from 'antd';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;
const { TextArea } = Input;

interface ReporteProblemaFormProps {
    onDataChange: (data: any) => void;
}

const ReporteProblemaForm: React.FC<ReporteProblemaFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
    const [asunto, setAsunto] = useState('');
    const [categoria, setCategoria] = useState<string | null>(null);
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [descripcion, setDescripcion] = useState('');
    const [gravedad, setGravedad] = useState<string | null>('MEDIO');

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
        const equipoNombre = equipos.find(e => e.value === equipoId)?.label || 'No aplica / No especificado';

        onDataChange({
            asunto: asunto,
            categoria_problema: categoria,
            id_equipo_afectado: equipoId,
            nombre_equipo_afectado: equipoNombre,
            descripcion_problema: descripcion,
            gravedad: gravedad,
            _form_type: 'REPORTE_PROBLEMA'
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [asunto, categoria, equipoId, descripcion, gravedad, equipos]);

    return (
        <Card size="small" style={{ backgroundColor: 'rgba(232,140,0,0.06)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13, color: '#d9480f', textTransform: 'uppercase' }}>
                        Reporte de Incidencia / Problema Técnico
                    </Text>
                    <Tag color="orange">SERVICIO TÉCNICO</Tag>
                </div>

                <Field label="Asunto / Resumen corto *" hint={`Describa brevemente el problema (${asunto.length}/50 caract.)`}>
                    <Input
                        placeholder="Ej: Fallo en sensor de pH, No conecta a red, etc."
                        value={asunto}
                        onChange={(e) => setAsunto(e.target.value)}
                        maxLength={50}
                    />
                </Field>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Categoría del Problema *">
                        <Select
                            placeholder="Seleccione categoría"
                            options={[
                                { value: 'HARDWARE', label: 'Fallo de Hardware / Piezas' },
                                { value: 'SOFTWARE', label: 'Error de Software / App' },
                                { value: 'CONECTIVIDAD', label: 'Problema de Conectividad / Red' },
                                { value: 'CALIBRACION', label: 'Descalibración / Medición Errónea' },
                                { value: 'DANIO_FISICO', label: 'Daño Físico Visible' },
                                { value: 'OTRO', label: 'Otro / No especificado' }
                            ]}
                            value={categoria ?? undefined}
                            onChange={(v) => setCategoria(v ?? null)}
                            style={{ width: '100%' }}
                        />
                    </Field>
                    <Field label="Nivel de Gravedad *">
                        <Select
                            placeholder="Seleccione nivel"
                            options={[
                                { value: 'BAJO', label: '🟢 Bajo (Sin impacto crítico)' },
                                { value: 'MEDIO', label: '🔵 Medio (Impacto parcial)' },
                                { value: 'ALTO', label: '🟡 Alto (Urgente)' },
                                { value: 'CRITICO', label: '🔴 Crítico (Bloqueante)' }
                            ]}
                            value={gravedad ?? undefined}
                            onChange={(v) => setGravedad(v ?? null)}
                            style={{ width: '100%' }}
                        />
                    </Field>
                </div>

                <Field label="Equipo Afectado (Opcional)">
                    <Select
                        placeholder={loadingEquipos ? "Cargando inventario..." : "Busque equipo afectado"}
                        suffixIcon={loadingEquipos ? <Spin size="small" /> : undefined}
                        options={equipos}
                        value={equipoId ?? undefined}
                        onChange={(v) => setEquipoId(v ?? null)}
                        showSearch
                        allowClear
                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                        style={{ width: '100%' }}
                    />
                </Field>

                <Field label="Descripción detallada *">
                    <TextArea
                        placeholder="Explique qué sucedió, cuándo, frecuencia del fallo y si hay algún mensaje de error específico..."
                        autoSize={{ minRows: 4 }}
                        value={descripcion}
                        onChange={(e) => setDescripcion(e.target.value)}
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

export default ReporteProblemaForm;
