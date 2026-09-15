import React, { useState, useEffect } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

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
        <Card className="p-4 bg-[rgba(224,49,49,0.05)]">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-[#c92a2a]">
                        Solicitud de Retiro / Baja de Equipo
                    </span>
                    <Badge variant="destructive">ALTA PRIORIDAD</Badge>
                </div>

                <Field label="Equipo a Desvincular *" hint="Solo se muestran equipos actualmente activos en el sistema.">
                    <Combobox
                        placeholder={loadingEquipos ? 'Cargando inventario...' : 'Busque equipo por nombre o código'}
                        searchPlaceholder="Buscar equipo..."
                        options={equipos}
                        value={equipoId ?? undefined}
                        onValueChange={(v) => setEquipoId(v ?? null)}
                        disabled={loadingEquipos}
                    />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Motivo del Cese *">
                        <Combobox
                            placeholder="Seleccione causa..."
                            searchPlaceholder="Buscar motivo..."
                            options={[
                                { value: 'OBSOLESCENCIA', label: 'Obsolescencia Técnica' },
                                { value: 'DANIO', label: 'Daño Irreparable' },
                                { value: 'EXTRAVIO', label: 'Pérdida / Robo / Extravío' },
                                { value: 'VIDA_UTIL', label: 'Fin de Vida Útil' },
                                { value: 'REEMPLAZO', label: 'Reemplazo por Tecnología Superior' },
                                { value: 'OTRO', label: 'Otro (Especificar en observaciones)' }
                            ]}
                            value={motivo ?? undefined}
                            onValueChange={(v) => setMotivo(v ?? null)}
                        />
                    </Field>
                    <Field label="Fecha Efectiva *">
                        <DatePicker value={fecha} onChange={setFecha} />
                    </Field>
                </div>

                <Field label="Fundamento Técnico / Observaciones">
                    <Textarea
                        placeholder="Describa el estado final del equipo, el número del acta de baja (si aplica) o detalles del siniestro..."
                        rows={3}
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
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
            {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
        </div>
    );
}

export default EquipoBajaForm;
