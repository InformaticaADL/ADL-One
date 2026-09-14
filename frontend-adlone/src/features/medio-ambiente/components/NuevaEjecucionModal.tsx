import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal, Typography, Button, Spin, Tag, Select,
    Input, Checkbox, Card, Divider, Alert, Tooltip
} from 'antd';
import {
    IconCalendarEvent, IconUserPlus, IconCheck, IconAlertCircle,
    IconRefresh, IconChevronDown
} from '@tabler/icons-react';
import { rutasEjecucionesService, type FichaDisponible, type CorrelativoOption } from '../services/rutasEjecuciones.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { useToast } from '../../../contexts/ToastContext';

const { Text } = Typography;

interface NuevaEjecucionModalProps {
    opened: boolean;
    onClose: () => void;
    rutaId: number;
    rutaNombre: string;
    onSuccess: () => void;
}

const STATUS_COLOR: Record<string, string> = {
    DISPONIBLE: 'green',
    AGENDADO: 'orange',
    EN_RUTA: 'purple'
};

const STATUS_LABEL: Record<string, string> = {
    DISPONIBLE: 'Disponible',
    AGENDADO: 'Agendado',
    EN_RUTA: 'En Ruta'
};

export const NuevaEjecucionModal: React.FC<NuevaEjecucionModalProps> = ({
    opened, onClose, rutaId, rutaNombre, onSuccess
}) => {
    const { showToast } = useToast();
    const { getCatalogo } = useCatalogos();

    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [plantillaData, setPlantillaData] = useState<{ fichas: FichaDisponible[] } | null>(null);

    // Form fields
    const [fecha, setFecha] = useState('');
    const [muestreadorInst, setMuestreadorInst] = useState<string | null>(null);
    const [muestreadorRet, setMuestreadorRet] = useState<string | null>(null);
    const [observaciones, setObservaciones] = useState('');

    // Per-ficha selection state: Map<id_fichaingresoservicio, { selected, correlativo, id_agendamam }>
    const [fichaState, setFichaState] = useState<Map<number, { selected: boolean; correlativo: string; id_agendamam: number | null }>>(new Map());

    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    const muestreadorOptions = useMemo(
        () => muestreadores.map((m: any) => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const loadData = async () => {
        setLoading(true);
        try {
            const [result, muest] = await Promise.all([
                rutasEjecucionesService.getFichasDisponibles(rutaId),
                getCatalogo('muestreadores', () => catalogosService.getMuestreadores())
            ]);
            setPlantillaData(result);
            if (muest) setMuestreadores(muest);

            // Initialize per-ficha state: auto-deselect fichas with 0 disponibles
            const initMap = new Map<number, { selected: boolean; correlativo: string; id_agendamam: number | null }>();
            result.fichas.forEach((f: FichaDisponible) => {
                initMap.set(f.id_fichaingresoservicio, {
                    selected: f.disponibles > 0,
                    correlativo: f.suggested_correlativo || '',
                    id_agendamam: f.suggested_id_agendamam
                });
            });
            setFichaState(initMap);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar las fichas de la ruta' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (opened) {
            loadData();
            setFecha('');
            setMuestreadorInst(null);
            setMuestreadorRet(null);
            setObservaciones('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [opened, rutaId]);

    const toggleFicha = (id: number) => {
        setFichaState(prev => {
            const next = new Map(prev);
            const cur = next.get(id);
            if (cur) next.set(id, { ...cur, selected: !cur.selected });
            return next;
        });
    };

    const setCorrelativo = (id: number, ficha: FichaDisponible, corrValue: string) => {
        const corrObj = ficha.correlativos.find(c => c.frecuencia_correlativo === corrValue);
        setFichaState(prev => {
            const next = new Map(prev);
            const cur = next.get(id);
            if (cur) next.set(id, { ...cur, correlativo: corrValue, id_agendamam: corrObj?.id_agendamam ?? null });
            return next;
        });
    };

    const selectedCount = useMemo(() =>
        [...fichaState.values()].filter(v => v.selected).length,
        [fichaState]
    );

    const handleSelectAll = (val: boolean) => {
        setFichaState(prev => {
            const next = new Map(prev);
            next.forEach((v, k) => next.set(k, { ...v, selected: val }));
            return next;
        });
    };

    const handleSubmit = async () => {
        if (!fecha) { showToast({ type: 'warning', message: 'Selecciona la fecha de muestreo' }); return; }
        if (!muestreadorInst) { showToast({ type: 'warning', message: 'Selecciona el muestreador de instalación' }); return; }
        if (selectedCount === 0) { showToast({ type: 'warning', message: 'Selecciona al menos una ficha' }); return; }

        const sinCorrelativo = [...fichaState.values()].filter(v => v.selected && !v.correlativo?.trim());
        if (sinCorrelativo.length > 0) {
            showToast({ type: 'warning', message: 'Todas las fichas seleccionadas deben tener un correlativo asignado' });
            return;
        }

        const fichasPayload = (plantillaData?.fichas ?? [])
            .filter(f => fichaState.get(f.id_fichaingresoservicio)?.selected)
            .map((f, i) => {
                const state = fichaState.get(f.id_fichaingresoservicio)!;
                return {
                    id_fichaingresoservicio: f.id_fichaingresoservicio,
                    orden: f.orden ?? i + 1,
                    frecuencia_correlativo: state.correlativo,
                    id_agendamam: state.id_agendamam ?? undefined
                };
            });

        setSubmitting(true);
        try {
            await rutasEjecucionesService.create({
                id_ruta_planificada: rutaId,
                fecha_ejecucion: fecha,
                id_muestreador_inst: Number(muestreadorInst),
                id_muestreador_ret: muestreadorRet ? Number(muestreadorRet) : undefined,
                fichas: fichasPayload,
                observaciones: observaciones || undefined
            });
            showToast({ type: 'success', message: `Ejecución creada: ${selectedCount} ficha(s) asignadas` });
            onSuccess();
            onClose();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al crear la ejecución' });
        } finally {
            setSubmitting(false);
        }
    };

    const allSelected = selectedCount === (plantillaData?.fichas.length ?? 0);
    const noneSelected = selectedCount === 0;

    return (
        <Modal
            open={opened}
            onCancel={onClose}
            footer={null}
            centered
            width={840}
            title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconCalendarEvent size={20} color="#2f9e44" />
                    <Text strong style={{ fontSize: 16 }}>Nueva Ejecución</Text>
                    <Tag color="blue" style={{ marginInlineEnd: 0 }}>{rutaNombre}</Tag>
                </div>
            }
        >
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}><Spin /></div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
                    {/* Header fields */}
                    <Card size="small" style={{ backgroundColor: 'var(--app-hover-bg)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, alignItems: 'start' }}>
                            <Field label="Fecha de Muestreo *">
                                <Input
                                    type="date"
                                    value={fecha}
                                    onChange={e => setFecha(e.target.value)}
                                    prefix={<IconCalendarEvent size={14} style={{ color: 'var(--app-text-secondary)' }} />}
                                />
                            </Field>
                            <Field label="Muestreador Instalación *">
                                <Select
                                    options={muestreadorOptions}
                                    value={muestreadorInst ?? undefined}
                                    onChange={v => { setMuestreadorInst(v); if (!muestreadorRet) setMuestreadorRet(v); }}
                                    showSearch
                                    allowClear
                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                    placeholder="Seleccionar..."
                                    style={{ width: '100%' }}
                                    suffixIcon={<IconUserPlus size={14} />}
                                />
                            </Field>
                            <Field label="Muestreador Retiro">
                                <Select
                                    options={muestreadorOptions}
                                    value={muestreadorRet ?? undefined}
                                    onChange={v => setMuestreadorRet(v ?? null)}
                                    showSearch
                                    allowClear
                                    filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                    placeholder="Igual al de instalación"
                                    style={{ width: '100%' }}
                                    suffixIcon={<IconUserPlus size={14} />}
                                />
                            </Field>
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <Field label="Observaciones">
                                <Input
                                    placeholder="Opcional"
                                    value={observaciones}
                                    onChange={e => setObservaciones(e.target.value)}
                                />
                            </Field>
                        </div>
                    </Card>

                    <Divider style={{ margin: 0 }} />

                    {/* Banner fichas agotadas */}
                    {(plantillaData?.fichas ?? []).some(f => f.disponibles === 0) && (
                        <Alert
                            type="warning"
                            showIcon
                            icon={<IconAlertCircle size={16} />}
                            message={
                                <Text style={{ fontSize: 12 }}>
                                    <strong>{(plantillaData?.fichas ?? []).filter(f => f.disponibles === 0).length} ficha(s)</strong> no tienen correlativos disponibles y fueron deseleccionadas automáticamente.
                                    Puedes seleccionarlas manualmente si lo requieres, pero su correlativo sugerido puede estar ya ejecutado.
                                </Text>
                            }
                        />
                    )}

                    {/* Fichas list */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text strong style={{ fontSize: 13 }}>
                            Fichas de la plantilla
                            <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}> — {selectedCount} de {plantillaData?.fichas.length ?? 0} seleccionadas</Text>
                        </Text>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Button type="text" size="small" onClick={() => handleSelectAll(true)} disabled={allSelected}>Todas</Button>
                            <Button type="text" size="small" onClick={() => handleSelectAll(false)} disabled={noneSelected}>Ninguna</Button>
                            <Tooltip title="Recargar correlativos disponibles">
                                <Button type="text" size="small" icon={<IconRefresh size={14} />} onClick={loadData} />
                            </Tooltip>
                        </div>
                    </div>

                    {plantillaData?.fichas.length === 0 ? (
                        <Alert type="warning" showIcon icon={<IconAlertCircle size={16} />} message="Esta plantilla no tiene fichas. Edítala primero para agregar fichas." />
                    ) : selectedCount === 0 && (plantillaData?.fichas ?? []).every(f => f.disponibles === 0) ? (
                        <Alert
                            type="error"
                            showIcon
                            icon={<IconAlertCircle size={16} />}
                            message="Sin fichas ejecutables"
                            description="Todas las fichas de esta ruta tienen sus correlativos agotados (ejecutados o cancelados). No es posible crear una ejecución hasta que las fichas tengan nuevos servicios disponibles."
                        />
                    ) : (
                        <div style={{ maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(plantillaData?.fichas ?? []).map((f) => {
                                    const state = fichaState.get(f.id_fichaingresoservicio);
                                    const isSelected = state?.selected ?? false;
                                    const currentCorr = state?.correlativo ?? '';
                                    const sinDisponibles = f.disponibles === 0;
                                    const corrOptions = f.correlativos.map((c: CorrelativoOption) => ({
                                        value: c.frecuencia_correlativo,
                                        label: `${c.frecuencia_correlativo} — ${STATUS_LABEL[c.status] ?? c.status}${c.fecha_muestreo ? ` (${new Date(c.fecha_muestreo).toLocaleDateString('es-CL')})` : ''}`
                                    }));

                                    const selectedCorrObj = f.correlativos.find(c => c.frecuencia_correlativo === currentCorr);

                                    return (
                                        <Card
                                            key={f.id_fichaingresoservicio}
                                            size="small"
                                            style={{
                                                opacity: isSelected ? 1 : 0.5,
                                                backgroundColor: sinDisponibles ? 'rgba(232,140,0,0.06)' : undefined,
                                                borderColor: sinDisponibles
                                                    ? '#e8590c'
                                                    : isSelected ? '#4dabf7' : undefined,
                                                transition: 'opacity 0.15s'
                                            }}
                                        >
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={() => toggleFicha(f.id_fichaingresoservicio)}
                                                    style={{ marginTop: 4 }}
                                                />
                                                <div style={{
                                                    flexShrink: 0, marginTop: 2, width: 20, height: 20, borderRadius: '50%',
                                                    backgroundColor: '#9c36b5', color: '#fff',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 10, fontWeight: 700,
                                                }}>
                                                    {f.orden}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', alignItems: 'center' }}>
                                                        <Text strong style={{ fontSize: 12, color: '#1864ab' }}>#{f.id_fichaingresoservicio}</Text>
                                                        {f.centro && <Text type="secondary" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.centro}</Text>}
                                                        {f.empresa_servicio && <Text type="secondary" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.empresa_servicio}</Text>}
                                                        {sinDisponibles && (
                                                            <Tooltip title="Todos los correlativos de esta ficha ya fueron ejecutados o cancelados">
                                                                <Tag color="orange" style={{ flexShrink: 0, marginInlineEnd: 0 }}>
                                                                    Sin disponibles
                                                                </Tag>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                                        <Select
                                                            size="small"
                                                            options={corrOptions}
                                                            value={currentCorr || undefined}
                                                            onChange={v => v && setCorrelativo(f.id_fichaingresoservicio, f, v)}
                                                            disabled={!isSelected || corrOptions.length === 0}
                                                            placeholder={corrOptions.length === 0 ? 'Sin correlativos' : 'Seleccionar correlativo...'}
                                                            style={{ flex: 1, minWidth: 200 }}
                                                            suffixIcon={<IconChevronDown size={12} />}
                                                        />
                                                        {selectedCorrObj && (
                                                            <Tag color={STATUS_COLOR[selectedCorrObj.status] ?? 'default'} style={{ flexShrink: 0, marginInlineEnd: 0 }}>
                                                                {STATUS_LABEL[selectedCorrObj.status] ?? selectedCorrObj.status}
                                                            </Tag>
                                                        )}
                                                        <Text type="secondary" style={{ fontSize: 10, flexShrink: 0 }}>
                                                            {f.disponibles}/{f.total} disp.
                                                        </Text>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <Divider style={{ margin: 0 }} />

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={onClose} disabled={submitting}>Cancelar</Button>
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#2f9e44' }}
                            icon={<IconCheck size={16} />}
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={selectedCount === 0 || !fecha || !muestreadorInst}
                        >
                            Crear Ejecución ({selectedCount} ficha{selectedCount !== 1 ? 's' : ''})
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
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
