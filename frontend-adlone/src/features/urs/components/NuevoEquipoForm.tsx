import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { DatePicker } from '@/components/ui/date-picker';
import { TIPOS_EQUIPO } from '../constants/equipoTypes';

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
        <Card className="p-4 bg-[rgba(12,133,153,0.06)]">
            <div className="flex flex-col gap-4">
                <span className="text-xs font-semibold uppercase text-[#0c8599]">
                    Solicitud de Registro / Adquisición de Nuevo Equipo
                </span>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Nombre descriptivo *">
                        <Input
                            placeholder="Ej: Multiparámetro de Campo"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                        />
                    </Field>
                    <Field label="Categoría / Tipo *">
                        <Combobox
                            placeholder="Seleccione tipo"
                            searchPlaceholder="Buscar tipo..."
                            options={TIPOS_EQUIPO.map((t: string) => ({ value: t, label: t }))}
                            value={tipo ?? undefined}
                            onValueChange={(v) => setTipo(v ?? null)}
                        />
                    </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
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

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Número de Serie (si aplica)">
                        <Input
                            placeholder="Serie de fábrica"
                            value={serie}
                            onChange={(e) => setSerie(e.target.value)}
                        />
                    </Field>
                    <Field label="Fecha Estimada Ingreso *">
                        <DatePicker
                            value={fechaAdquisicion}
                            onChange={setFechaAdquisicion}
                        />
                    </Field>
                </div>

                <Field label="Detalles / Justificación">
                    <Textarea
                        placeholder="Indique por qué se requiere este equipo o detalles adicionales..."
                        rows={3}
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
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

export default NuevoEquipoForm;
