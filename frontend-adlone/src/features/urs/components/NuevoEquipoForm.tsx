import React, { useState, useEffect } from 'react';
import { TextInput, Select, Stack, Group, Text, Paper, Textarea } from '@mantine/core';

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
    }, [nombre, tipo, marca, modelo, serie, fechaAdquisicion, observaciones]);

    return (
        <Paper withBorder p="md" radius="md" bg="teal.0">
            <Stack gap="md">
                <Text fw={700} size="sm" c="teal.8" style={{ textTransform: 'uppercase' }}>
                    Solicitud de Registro / Adquisición de Nuevo Equipo
                </Text>

                <Group grow>
                    <TextInput
                        label="Nombre descriptivo"
                        placeholder="Ej: Multiparámetro de Campo"
                        value={nombre}
                        onChange={(e) => setNombre(e.currentTarget.value)}
                        required
                    />
                    <Select
                        label="Categoría / Tipo"
                        placeholder="Seleccione tipo"
                        data={[
                            'Multiparámetro',
                            'Muestreador Isotérmico',
                            'Muestreador Automático',
                            'Sonda Nivel',
                            'GPS',
                            'Centrifuga',
                            'Nevera / Termo',
                            'Otro'
                        ]}
                        value={tipo}
                        onChange={setTipo}
                        required
                    />
                </Group>

                <Group grow>
                    <TextInput
                        label="Marca"
                        placeholder="Ej: WTW, YSI, etc."
                        value={marca}
                        onChange={(e) => setMarca(e.currentTarget.value)}
                    />
                    <TextInput
                        label="Modelo"
                        placeholder="Ej: Multi 3630"
                        value={modelo}
                        onChange={(e) => setModelo(e.currentTarget.value)}
                    />
                </Group>

                <Group grow>
                    <TextInput
                        label="Número de Serie (si aplica)"
                        placeholder="Serie de fábrica"
                        value={serie}
                        onChange={(e) => setSerie(e.currentTarget.value)}
                    />
                    <TextInput
                        label="Fecha Estimada Ingreso"
                        type="date"
                        value={fechaAdquisicion}
                        onChange={(e) => setFechaAdquisicion(e.currentTarget.value)}
                        required
                    />
                </Group>

                <Textarea
                    label="Detalles / Justificación"
                    placeholder="Indique por qué se requiere este equipo o detalles adicionales..."
                    minRows={3}
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.currentTarget.value)}
                />
            </Stack>
        </Paper>
    );
};

export default NuevoEquipoForm;
