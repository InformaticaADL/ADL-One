import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

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
        <Card className="p-4 bg-[rgba(232,140,0,0.06)]">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-[#d9480f]">
                        Reporte de Incidencia / Problema Técnico
                    </span>
                    <Badge variant="warning">SERVICIO TÉCNICO</Badge>
                </div>

                <Field label="Asunto / Resumen corto *" hint={`Describa brevemente el problema (${asunto.length}/50 caract.)`}>
                    <Input
                        placeholder="Ej: Fallo en sensor de pH, No conecta a red, etc."
                        value={asunto}
                        onChange={(e) => setAsunto(e.target.value)}
                        maxLength={50}
                    />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Categoría del Problema *">
                        <Combobox
                            placeholder="Seleccione categoría"
                            searchPlaceholder="Buscar categoría..."
                            options={[
                                { value: 'HARDWARE', label: 'Fallo de Hardware / Piezas' },
                                { value: 'SOFTWARE', label: 'Error de Software / App' },
                                { value: 'CONECTIVIDAD', label: 'Problema de Conectividad / Red' },
                                { value: 'CALIBRACION', label: 'Descalibración / Medición Errónea' },
                                { value: 'DANIO_FISICO', label: 'Daño Físico Visible' },
                                { value: 'OTRO', label: 'Otro / No especificado' }
                            ]}
                            value={categoria ?? undefined}
                            onValueChange={(v) => setCategoria(v ?? null)}
                        />
                    </Field>
                    <Field label="Nivel de Gravedad *">
                        <Combobox
                            placeholder="Seleccione nivel"
                            searchPlaceholder="Buscar nivel..."
                            options={[
                                { value: 'BAJO', label: '🟢 Bajo (Sin impacto crítico)' },
                                { value: 'MEDIO', label: '🔵 Medio (Impacto parcial)' },
                                { value: 'ALTO', label: '🟡 Alto (Urgente)' },
                                { value: 'CRITICO', label: '🔴 Crítico (Bloqueante)' }
                            ]}
                            value={gravedad ?? undefined}
                            onValueChange={(v) => setGravedad(v ?? null)}
                        />
                    </Field>
                </div>

                <Field label="Equipo Afectado (Opcional)">
                    <Combobox
                        placeholder={loadingEquipos ? 'Cargando inventario...' : 'Busque equipo afectado'}
                        searchPlaceholder="Buscar equipo..."
                        options={[{ value: 'none', label: 'Ninguno / No aplica' }, ...equipos]}
                        value={equipoId ?? 'none'}
                        onValueChange={(v) => setEquipoId(v === 'none' ? null : v)}
                        disabled={loadingEquipos}
                    />
                </Field>

                <Field label="Descripción detallada *">
                    <Textarea
                        placeholder="Explique qué sucedió, cuándo, frecuencia del fallo y si hay algún mensaje de error específico..."
                        rows={4}
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
            <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
            {children}
            {hint && <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>}
        </div>
    );
}

export default ReporteProblemaForm;
