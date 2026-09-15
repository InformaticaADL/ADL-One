import React, { useState, useEffect } from 'react';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { IconInfoCircle, IconArrowsExchange, IconUser, IconMapPin, IconCalendarEvent } from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';

interface EquipoTraspasoFormProps {
    onDataChange: (data: any) => void;
}

const EquipoTraspasoForm: React.FC<EquipoTraspasoFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [centroDestinoId, setCentroDestinoId] = useState<string | null>(null);
    const [muestreadorDestinoId, setMuestreadorDestinoId] = useState<string | null>(null);
    const [traspasoDe, setTraspasoDe] = useState<string[]>(['RESPONSABLE']); // Default to responsible
    const [motivo, setMotivo] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

    const [equipos, setEquipos] = useState<any[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [ubicaciones, setUbicaciones] = useState<any[]>([]);
    const [fetchingEquipos, setFetchingEquipos] = useState(false);
    const [selectedEquipoDetails, setSelectedEquipoDetails] = useState<any | null>(null);
    const [fetchingDetails, setFetchingDetails] = useState(false);

    // List load
    useEffect(() => {
        setFetchingEquipos(true);
        const p1 = apiClient.get('/api/admin/equipos?limit=500');
        const p2 = apiClient.get('/api/catalogos/muestreadores');
        const p3 = apiClient.get('/api/catalogos/lugares-analisis');

        Promise.all([p1, p2, p3])
            .then(([resEq, resMues, resLugar]) => {
                setEquipos(resEq.data.data || []);
                setMuestreadores((resMues.data.data || []).map((m: any) => ({
                    value: String(m.id_muestreador || m.id),
                    label: m.nombre_muestreador || m.nombre
                })));
                setUbicaciones((resLugar.data.data || []).map((l: any) => ({
                    value: String(l.sigla),
                    label: `${l.nombre_lugaranalisis} (${l.sigla})`
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar datos del formulario' }))
            .finally(() => setFetchingEquipos(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load extra details when equipment is selected
    useEffect(() => {
        if (!equipoId) {
            setSelectedEquipoDetails(null);
            return;
        }

        setFetchingDetails(true);
        apiClient.get(`/api/admin/equipos/${equipoId}`)
            .then(res => {
                if (res.data.success) {
                    setSelectedEquipoDetails(res.data.data || null);
                }
            })
            .catch(() => showToast({ type: 'error', message: 'Error al obtener detalles del equipo' }))
            .finally(() => setFetchingDetails(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipoId]);

    // Optimized derived data
    const equipoOptions = React.useMemo(() => equipos.map(e => ({ value: String(e.id_equipo), label: `${e.nombre} [${e.codigo}]` })), [equipos]);

    const equipoLabel = React.useMemo(() => {
        const basic = equipos.find(e => String(e.id_equipo) === equipoId);
        return basic ? `${basic.nombre} [${basic.codigo}]` : '';
    }, [equipos, equipoId]);

    const muesNombreDestino = React.useMemo(() =>
        muestreadores.find(m => m.value === muestreadorDestinoId)?.label || '',
    [muestreadores, muestreadorDestinoId]);

    const centroNombreDestino = React.useMemo(() =>
        ubicaciones.find(c => c.value === centroDestinoId)?.label || '',
    [ubicaciones, centroDestinoId]);

    // Update parent with cumulative data - slightly deferred or optimized
    useEffect(() => {
        // Solo notificamos si hay cambios reales y no estamos cargando detalles críticos
        if (fetchingDetails) return;

        onDataChange({
            id_equipo: equipoId,
            nombre_equipo_full: equipoLabel,
            traspaso_de: traspasoDe,

            // Current Info for Audit/Display (from detailed fetch)
            info_actual: selectedEquipoDetails ? {
                ubicacion: selectedEquipoDetails.ubicacion || selectedEquipoDetails.sede || 'No asignada',
                responsable: selectedEquipoDetails.nombre_asignado || selectedEquipoDetails.nombre_muestreador || 'No asignado',
                fecha_vigencia: selectedEquipoDetails.vigencia || selectedEquipoDetails.fecha_vigencia || 'N/A'
            } : null,

            // New values based on selection
            id_centro_destino: traspasoDe.includes('UBICACION') ? centroDestinoId : null,
            nombre_centro_destino: traspasoDe.includes('UBICACION') ? centroNombreDestino : null,
            id_muestreador_destino: traspasoDe.includes('RESPONSABLE') ? muestreadorDestinoId : null,
            nombre_muestreador_destino: traspasoDe.includes('RESPONSABLE') ? muesNombreDestino : null,

            motivo: motivo,
            fecha_traspaso: fecha,
            _form_type: 'TRASPASO_EQUIPO'
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        equipoId, traspasoDe, centroDestinoId, muestreadorDestinoId, motivo, fecha,
        selectedEquipoDetails, fetchingDetails, equipoLabel, muesNombreDestino, centroNombreDestino, ubicaciones
    ]);

    const toggleTraspasoDe = (value: string, checked: boolean) => {
        setTraspasoDe(prev => checked ? [...prev, value] : prev.filter(v => v !== value));
    };

    return (
        <Card className="p-4 bg-accent">
            <div className="flex flex-col gap-4">
                <div>
                    <div className="mb-1.5 flex justify-between">
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase text-[#1864ab]">
                            <IconArrowsExchange size={18} /> Solicitud de Traspaso de Equipo
                        </span>
                        <Badge variant="outline">URS-03</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">Utilice este formulario para cambiar la ubicación física o el responsable legal de un equipo.</span>
                </div>

                <Field label="1. Seleccione el Equipo *">
                    <Combobox
                        placeholder={fetchingEquipos ? 'Cargando...' : 'Busque por nombre o código'}
                        searchPlaceholder="Buscar equipo..."
                        emptyText="No se encontraron equipos"
                        options={equipoOptions}
                        value={equipoId ?? undefined}
                        onValueChange={(v) => setEquipoId(v ?? null)}
                        disabled={fetchingEquipos}
                    />
                </Field>

                {fetchingDetails && (
                    <div className="flex items-center gap-2 p-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <span className="text-xs text-muted-foreground">Obteniendo información actual...</span>
                    </div>
                )}

                {selectedEquipoDetails && !fetchingDetails && (
                    <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                        <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="font-medium">Información Actual del Equipo</span>
                            <div className="flex items-center gap-2">
                                <IconMapPin size={14} className="text-primary" />
                                <span><strong>Ubicación:</strong> {selectedEquipoDetails.ubicacion || selectedEquipoDetails.sede || 'No registrada'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <IconUser size={14} className="text-primary" />
                                <span><strong>Responsable:</strong> {selectedEquipoDetails.nombre_asignado || selectedEquipoDetails.nombre_muestreador || 'No asignado'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <IconCalendarEvent size={14} className="text-primary" />
                                <span><strong>Próxima Vigencia:</strong> {selectedEquipoDetails.vigencia || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-3 text-xs font-semibold uppercase text-muted-foreground">
                    <div className="h-px flex-1 bg-border" />
                    2. Detalles del Traspaso
                    <div className="h-px flex-1 bg-border" />
                </div>

                <Field label="¿Qué desea traspasar? *" hint="Seleccione una o ambas opciones">
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={traspasoDe.includes('UBICACION')} onCheckedChange={(c) => toggleTraspasoDe('UBICACION', c === true)} />
                            Cambio de Ubicación (Centro)
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox checked={traspasoDe.includes('RESPONSABLE')} onCheckedChange={(c) => toggleTraspasoDe('RESPONSABLE', c === true)} />
                            Cambio de Responsable
                        </label>
                    </div>
                </Field>

                <div className={`grid gap-4 ${traspasoDe.includes('UBICACION') && traspasoDe.includes('RESPONSABLE') ? 'grid-cols-2' : 'grid-cols-1'}`}>
                    {traspasoDe.includes('UBICACION') && (
                        <Field label="Nueva Ubicación (Destino) *">
                            <Combobox
                                placeholder="Seleccione lugar"
                                searchPlaceholder="Buscar lugar..."
                                options={ubicaciones}
                                value={centroDestinoId ?? undefined}
                                onValueChange={(v) => setCentroDestinoId(v ?? null)}
                            />
                        </Field>
                    )}
                    {traspasoDe.includes('RESPONSABLE') && (
                        <Field label="Nuevo Responsable (Destino) *">
                            <Combobox
                                placeholder="Seleccione persona"
                                searchPlaceholder="Buscar persona..."
                                options={muestreadores}
                                value={muestreadorDestinoId ?? undefined}
                                onValueChange={(v) => setMuestreadorDestinoId(v ?? null)}
                            />
                        </Field>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Fecha Efectiva del Cambio *">
                        <DatePicker value={fecha} onChange={setFecha} />
                    </Field>
                    <Field label="Motivo / Justificación *">
                        <Input
                            placeholder="Ej: Cambio de área, reemplazo, etc."
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                        />
                    </Field>
                </div>
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

export default EquipoTraspasoForm;
