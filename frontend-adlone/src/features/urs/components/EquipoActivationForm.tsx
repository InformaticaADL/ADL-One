import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { IconInfoCircle } from '@tabler/icons-react';
import apiClient from '../../../config/axios.config';
import { useToast } from '../../../contexts/ToastContext';
import { TIPOS_EQUIPO } from '../constants/equipoTypes';

interface EquipoActivationFormProps {
    onDataChange: (data: any) => void;
}

const EquipoActivationForm: React.FC<EquipoActivationFormProps> = ({ onDataChange }) => {
    const { showToast } = useToast();
    const [altaSubtype, setAltaSubtype] = useState<'NUEVO' | 'EXISTENTE'>('EXISTENTE');

    // EXISTENTE mode
    const [equipoId, setEquipoId] = useState<string | null>(null);
    const [equipos, setEquipos] = useState<any[]>([]);
    const [loadingEquipos, setLoadingEquipos] = useState(false);

    // NUEVO mode
    const [nombre, setNombre] = useState('');
    const [tipo, setTipo] = useState<string | null>(null);

    // Shared fields
    const [ubicacionId, setUbicacionId] = useState<string | null>(null);
    const [muestreadorId, setMuestreadorId] = useState<string | null>(null);
    const [fechaVigencia, setFechaVigencia] = useState(new Date().toISOString().split('T')[0]);

    const [ubicaciones, setUbicaciones] = useState<any[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [loadingUbicaciones, setLoadingUbicaciones] = useState(false);
    const [loadingMuestreadores, setLoadingMuestreadores] = useState(false);

    useEffect(() => {
        setLoadingUbicaciones(true);
        apiClient.get('/api/catalogos/lugares-analisis')
            .then(res => {
                const data = res.data.data || [];
                setUbicaciones(data.map((l: any) => ({
                    value: String(l.sigla || ''),
                    label: l.nombre_lugaranalisis || l.nombre || 'Sin nombre'
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar ubicaciones' }))
            .finally(() => setLoadingUbicaciones(false));

        setLoadingMuestreadores(true);
        apiClient.get('/api/catalogos/muestreadores')
            .then(res => {
                const data = res.data.data || [];
                setMuestreadores(data.map((m: any) => ({
                    value: String(m.id_muestreador || m.id || ''),
                    label: m.nombre_muestreador || m.nombre || 'Sin nombre'
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar responsables' }))
            .finally(() => setLoadingMuestreadores(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load inventory only when EXISTENTE mode is active
    useEffect(() => {
        if (altaSubtype !== 'EXISTENTE' || equipos.length > 0) return;
        setLoadingEquipos(true);
        apiClient.get('/api/admin/equipos?limit=500')
            .then(res => {
                setEquipos((res.data.data || []).map((e: any) => ({
                    value: String(e.id_equipo),
                    label: `${e.nombre} [${e.codigo}]`,
                    tipo: e.tipo || null
                })));
            })
            .catch(() => showToast({ type: 'error', message: 'Error al cargar inventario de equipos' }))
            .finally(() => setLoadingEquipos(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [altaSubtype]);

    // Auto-fill tipo when equipo is selected in EXISTENTE mode
    const selectedEquipoData = equipos.find(e => e.value === equipoId);
    useEffect(() => {
        if (altaSubtype === 'EXISTENTE' && selectedEquipoData?.tipo) {
            setTipo(selectedEquipoData.tipo);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [equipoId, altaSubtype]);

    // Reset equipo selection when switching modes
    const handleModeSwitch = (mode: 'NUEVO' | 'EXISTENTE') => {
        setAltaSubtype(mode);
        setEquipoId(null);
        setNombre('');
        setTipo(null);
    };

    useEffect(() => {
        const ubicacionNombre = ubicaciones.find(u => u.value === ubicacionId)?.label || '';
        const responsableNombre = muestreadores.find(m => m.value === muestreadorId)?.label || '';
        const nombreFinal = altaSubtype === 'EXISTENTE'
            ? (selectedEquipoData?.label || '')
            : nombre;

        onDataChange({
            subtipo_alta: altaSubtype,
            id_equipo: altaSubtype === 'EXISTENTE' ? equipoId : null,
            nombre_equipo: nombreFinal,
            tipo_equipo: tipo,
            id_ubicacion: ubicacionId,
            nombre_ubicacion: ubicacionNombre,
            id_responsable: muestreadorId,
            nombre_responsable: responsableNombre,
            fecha_vigencia: fechaVigencia,
            _form_type: 'ACTIVACION_EQUIPO'
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nombre, tipo, ubicacionId, muestreadorId, ubicaciones, muestreadores, altaSubtype, fechaVigencia, equipoId, selectedEquipoData]);

    return (
        <Card className="p-4 bg-accent">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-[#1864ab]">
                        Activación de Equipo
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant={altaSubtype === 'EXISTENTE' ? 'default' : 'outline'}
                            onClick={() => handleModeSwitch('EXISTENTE')}
                            size="sm"
                            className="rounded-full"
                        >
                            Desde Inventario
                        </Button>
                        <Button
                            variant={altaSubtype === 'NUEVO' ? 'default' : 'outline'}
                            onClick={() => handleModeSwitch('NUEVO')}
                            size="sm"
                            className="rounded-full"
                        >
                            Nuevo Registro
                        </Button>
                    </div>
                </div>

                {altaSubtype === 'EXISTENTE' ? (
                    <>
                        <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                            <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
                            <span>Selecciona un equipo del inventario para reactivarlo o reasignarlo.</span>
                        </div>
                        <Field label="Equipo del Inventario *">
                            <Combobox
                                placeholder={loadingEquipos ? 'Cargando inventario...' : 'Busque por nombre o código'}
                                searchPlaceholder="Buscar equipo..."
                                emptyText="No se encontraron equipos"
                                options={equipos}
                                value={equipoId ?? undefined}
                                onValueChange={(v) => setEquipoId(v ?? null)}
                                disabled={loadingEquipos}
                            />
                        </Field>
                    </>
                ) : (
                    <>
                        <div className="flex gap-2 rounded-lg border border-success/30 bg-success/5 p-3 text-xs">
                            <IconInfoCircle size={14} className="mt-0.5 shrink-0" />
                            <span>Completa los datos del equipo nuevo que ingresará al inventario.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Nombre / Modelo del Equipo *">
                                <Input
                                    placeholder="Ej: Multiparámetro WTW Multi 3630"
                                    value={nombre}
                                    onChange={(e) => setNombre(e.target.value)}
                                />
                            </Field>
                            <Field label="Tipo de Equipo *">
                                <Combobox
                                    placeholder="Seleccione tipo"
                                    searchPlaceholder="Buscar tipo..."
                                    options={TIPOS_EQUIPO.map((t: string) => ({ value: t, label: t }))}
                                    value={tipo ?? undefined}
                                    onValueChange={(v) => setTipo(v ?? null)}
                                />
                            </Field>
                        </div>
                    </>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Ubicación Destino *">
                        <Combobox
                            placeholder={loadingUbicaciones ? 'Cargando...' : 'Seleccione base / laboratorio'}
                            searchPlaceholder="Buscar ubicación..."
                            options={ubicaciones}
                            value={ubicacionId ?? undefined}
                            onValueChange={(v) => setUbicacionId(v ?? null)}
                            disabled={loadingUbicaciones}
                        />
                    </Field>
                    <Field label="Responsable Asignado *">
                        <Combobox
                            placeholder={loadingMuestreadores ? 'Cargando...' : 'Seleccione responsable'}
                            searchPlaceholder="Buscar responsable..."
                            options={muestreadores}
                            value={muestreadorId ?? undefined}
                            onValueChange={(v) => setMuestreadorId(v ?? null)}
                            disabled={loadingMuestreadores}
                        />
                    </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <Field label="Fecha de Inicio / Vigencia *">
                        <DatePicker value={fechaVigencia} onChange={setFechaVigencia} />
                    </Field>
                    <div />
                </div>
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

export default EquipoActivationForm;
