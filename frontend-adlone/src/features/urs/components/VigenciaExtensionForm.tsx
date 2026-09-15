import React, { useState, useEffect } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

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
        <Card className="p-4 bg-[rgba(156,54,181,0.06)]">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-[#862e9c]">
                        Solicitud de Extensión de Vigencia
                    </span>
                    <Badge variant="secondary">CALIDAD / MA</Badge>
                </div>

                <Field label="Seleccionar Equipo *">
                    <Combobox
                        placeholder={loadingEquipos ? 'Cargando...' : 'Busque equipo por nombre o código'}
                        searchPlaceholder="Buscar equipo..."
                        options={equipos}
                        value={equipoId ?? undefined}
                        onValueChange={(v) => setEquipoId(v ?? null)}
                        disabled={loadingEquipos}
                    />
                </Field>

                {selectedEquipoRaw?.vigencia && (
                    <div className="rounded-lg bg-[rgba(156,54,181,0.1)] p-2.5">
                        <span className="block text-[11px] font-bold uppercase text-[#862e9c]">Vigencia actual</span>
                        <span className="text-sm font-bold text-[#862e9c]">
                            {(() => {
                                const d = parseDate(selectedEquipoRaw.vigencia);
                                return d ? d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }) : 'Fecha Inválida';
                            })()}
                        </span>
                    </div>
                )}

                <div className="grid grid-cols-2 items-end gap-4">
                    <Field label="Fecha de Revisión / Verificación *">
                        <DatePicker value={fechaRevision} onChange={setFechaRevision} />
                    </Field>
                    {siguienteVerif && (
                        <div className="rounded-lg border border-[rgba(9,143,131,0.2)] bg-[rgba(9,143,131,0.08)] p-2">
                            <span className="block text-[11px] font-bold uppercase text-[#087f5b]">Nueva Vigencia Autocalculada</span>
                            <span className="block text-sm font-bold text-[#087f5b]">
                                {new Date(siguienteVerif + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                            </span>
                            <span className="text-[11px] text-[#0ca678]">(Auto: Revisión + 90 días)</span>
                        </div>
                    )}
                </div>

                <Field label="Justificación de la Extensión *">
                    <Textarea
                        placeholder="Explique por qué se requiere extender el plazo de uso de este equipo..."
                        rows={3}
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
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
        </div>
    );
}

export default VigenciaExtensionForm;
