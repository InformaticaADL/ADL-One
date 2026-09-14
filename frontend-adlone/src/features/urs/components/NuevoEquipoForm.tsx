import React, { useState, useEffect } from 'react';
import { Input, Select, Typography, Card } from 'antd';
import { TIPOS_EQUIPO } from '../constants/equipoTypes';

const { Text } = Typography;
const { TextArea } = Input;

interface NuevoEquipoFormProps {
    onDataChange: (data: any) => void;
}

const NuevoEquipoForm: React.FC<NuevoEquipoFormProps> = ({ onDataChange }) => {
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<string | null>(null);
    const [marca, setMarca] = useState('');
    const [modelo, setModelo] = useState('');
    const [serie, setSerie] = useState('');
    const [fechaAdquisicion, setFechaAdquisicion] = useState(new Date().toISOString().split('T')[0]);
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        onDataChange({
            nombre_equipo: nombre,
            tipo_equipo: tipo,
            marca: marca,
            modelo: modelo,
            serie: serie,
            fecha_adquisicion: fechaAdquisicion,
            observaciones: observaciones,
            _form_type: 'NUEVO_EQUIPO'
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nombre, tipo, marca, modelo, serie, fechaAdquisicion, observaciones]);

    return (
        <Card size="small" style={{ backgroundColor: 'rgba(12,133,153,0.06)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Text strong style={{ fontSize: 13, color: '#0c8599', textTransform: 'uppercase' }}>
                    Solicitud de Registro / Adquisición de Nuevo Equipo
                </Text>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Nombre descriptivo *">
                        <Input
                            placeholder="Ej: Multiparámetro de Campo"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />
                    </Field>
                    <Field label="Categoría / Tipo *">
                        <Select
                            placeholder="Seleccione tipo"
                            options={TIPOS_EQUIPO.map((t: string) => ({ value: t, label: t }))}
                            value={tipo ?? undefined}
                            onChange={(v) => setTipo(v ?? null)}
                            style={{ width: '100%' }}
                        />
                    </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Marca">
                        <Input
                            placeholder="Ej: WTW, YSI, etc."
                            value={marca}
                            onChange={(e) => setMarca(e.target.value)}
                        />
                    </Field>
                    <Field label="Modelo">
                        <Input
                            placeholder="Ej: Multi 3630"
                            value={modelo}
                            onChange={(e) => setModelo(e.target.value)}
                        />
                    </Field>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Field label="Número de Serie (si aplica)">
                        <Input
                            placeholder="Serie de fábrica"
                            value={serie}
                            onChange={(e) => setSerie(e.target.value)}
                        />
                    </Field>
                    <Field label="Fecha Estimada Ingreso *">
                        <Input
                            type="date"
                            value={fechaAdquisicion}
                            onChange={(e) => setFechaAdquisicion(e.target.value)}
                        />
                    </Field>
                </div>

                <Field label="Detalles / Justificación">
                    <TextArea
                        placeholder="Indique por qué se requiere este equipo o detalles adicionales..."
                        autoSize={{ minRows: 3 }}
                        value={observaciones}
                        onChange={(e) => setObservaciones(e.target.value)}
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

export default NuevoEquipoForm;
