import React, { useState, useEffect, useMemo } from 'react';
import {
    Modal, Stack, Group, Text, Button, Loader, Center, Badge, Select,
    TextInput, Checkbox, Paper, ScrollArea, Divider, Alert, ThemeIcon,
    Tooltip, ActionIcon
} from '@mantine/core';
import {
    IconCalendarEvent, IconUserPlus, IconCheck, IconAlertCircle,
    IconRefresh, IconChevronDown
} from '@tabler/icons-react';
import { rutasEjecucionesService, type FichaDisponible, type CorrelativoOption } from '../services/rutasEjecuciones.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { useToast } from '../../../contexts/ToastContext';

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
    EN_RUTA: 'violet'
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
            opened={opened}
            onClose={onClose}
            title={
                <Group gap="xs">
                    <IconCalendarEvent size={20} color="var(--mantine-color-green-6)" />
                    <Text fw={600} size="lg">Nueva Ejecución</Text>
                    <Badge variant="light" color="blue" size="sm">{rutaNombre}</Badge>
                </Group>
            }
            centered
            size="xl"
            styles={{ body: { paddingTop: 8 } }}
        >
            {loading ? (
                <Center py="xl"><Loader /></Center>
            ) : (
                <Stack gap="sm">
                    {/* Header fields */}
                    <Paper withBorder p="sm" radius="sm" bg="gray.0">
                        <Group grow gap="sm" align="flex-start">
                            <TextInput
                                label="Fecha de Muestreo"
                                type="date"
                                value={fecha}
                                onChange={e => setFecha(e.target.value)}
                                leftSection={<IconCalendarEvent size={16} />}
                                required
                            />
                            <Select
                                label="Muestreador Instalación"
                                data={muestreadorOptions}
                                value={muestreadorInst}
                                onChange={v => { setMuestreadorInst(v); if (!muestreadorRet) setMuestreadorRet(v); }}
                                searchable
                                placeholder="Seleccionar..."
                                leftSection={<IconUserPlus size={16} />}
                                required
                                comboboxProps={{ zIndex: 10001 }}
                            />
                            <Select
                                label="Muestreador Retiro"
                                data={muestreadorOptions}
                                value={muestreadorRet}
                                onChange={setMuestreadorRet}
                                searchable
                                placeholder="Igual al de instalación"
                                leftSection={<IconUserPlus size={16} />}
                                comboboxProps={{ zIndex: 10001 }}
                            />
                        </Group>
                        <TextInput
                            label="Observaciones"
                            placeholder="Opcional"
                            value={observaciones}
                            onChange={e => setObservaciones(e.target.value)}
                            mt="xs"
                        />
                    </Paper>

                    <Divider />

                    {/* Banner fichas agotadas */}
                    {(plantillaData?.fichas ?? []).some(f => f.disponibles === 0) && (
                        <Alert icon={<IconAlertCircle size={16} />} color="orange" py="xs">
                            <Text size="xs">
                                <strong>{(plantillaData?.fichas ?? []).filter(f => f.disponibles === 0).length} ficha(s)</strong> no tienen correlativos disponibles y fueron deseleccionadas automáticamente.
                                Puedes seleccionarlas manualmente si lo requieres, pero su correlativo sugerido puede estar ya ejecutado.
                            </Text>
                        </Alert>
                    )}

                    {/* Fichas list */}
                    <Group justify="space-between" align="center">
                        <Text size="sm" fw={600}>
                            Fichas de la plantilla
                            <Text span c="dimmed" fw={400}> — {selectedCount} de {plantillaData?.fichas.length ?? 0} seleccionadas</Text>
                        </Text>
                        <Group gap="xs">
                            <Button size="compact-xs" variant="subtle" onClick={() => handleSelectAll(true)} disabled={allSelected}>Todas</Button>
                            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => handleSelectAll(false)} disabled={noneSelected}>Ninguna</Button>
                            <Tooltip label="Recargar correlativos disponibles">
                                <ActionIcon size="sm" variant="subtle" onClick={loadData}>
                                    <IconRefresh size={14} />
                                </ActionIcon>
                            </Tooltip>
                        </Group>
                    </Group>

                    {plantillaData?.fichas.length === 0 ? (
                        <Alert icon={<IconAlertCircle size={16} />} color="orange">
                            Esta plantilla no tiene fichas. Edítala primero para agregar fichas.
                        </Alert>
                    ) : selectedCount === 0 && (plantillaData?.fichas ?? []).every(f => f.disponibles === 0) ? (
                        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Sin fichas ejecutables">
                            Todas las fichas de esta ruta tienen sus correlativos agotados (ejecutados o cancelados).
                            No es posible crear una ejecución hasta que las fichas tengan nuevos servicios disponibles.
                        </Alert>
                    ) : (
                        <ScrollArea mah={340} offsetScrollbars>
                            <Stack gap="xs">
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
                                        <Paper
                                            key={f.id_fichaingresoservicio}
                                            withBorder
                                            p="sm"
                                            radius="sm"
                                            bg={sinDisponibles ? 'orange.0' : undefined}
                                            style={{
                                                opacity: isSelected ? 1 : 0.5,
                                                borderColor: sinDisponibles
                                                    ? 'var(--mantine-color-orange-4)'
                                                    : isSelected ? 'var(--mantine-color-blue-3)' : undefined,
                                                transition: 'opacity 0.15s'
                                            }}
                                        >
                                            <Group gap="sm" align="flex-start" wrap="nowrap">
                                                <Checkbox
                                                    checked={isSelected}
                                                    onChange={() => toggleFicha(f.id_fichaingresoservicio)}
                                                    mt={4}
                                                />
                                                <ThemeIcon size="sm" radius="xl" color="violet" variant="filled" style={{ flexShrink: 0, marginTop: 2 }}>
                                                    <Text size="10px" fw={700}>{f.orden}</Text>
                                                </ThemeIcon>
                                                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                                                    <Group gap="xs" wrap="nowrap">
                                                        <Text size="xs" fw={700} c="blue.8">#{f.id_fichaingresoservicio}</Text>
                                                        {f.centro && <Text size="xs" c="dimmed" truncate>{f.centro}</Text>}
                                                        {f.empresa_servicio && <Text size="10px" c="dimmed" truncate>{f.empresa_servicio}</Text>}
                                                        {sinDisponibles && (
                                                            <Tooltip label="Todos los correlativos de esta ficha ya fueron ejecutados o cancelados">
                                                                <Badge size="xs" color="orange" variant="filled" style={{ flexShrink: 0 }}>
                                                                    Sin disponibles
                                                                </Badge>
                                                            </Tooltip>
                                                        )}
                                                    </Group>
                                                    <Group gap="xs" align="center" wrap="nowrap">
                                                        <Select
                                                            size="xs"
                                                            data={corrOptions}
                                                            value={currentCorr}
                                                            onChange={v => v && setCorrelativo(f.id_fichaingresoservicio, f, v)}
                                                            disabled={!isSelected || corrOptions.length === 0}
                                                            placeholder={corrOptions.length === 0 ? 'Sin correlativos' : 'Seleccionar correlativo...'}
                                                            style={{ flex: 1, minWidth: 200 }}
                                                            comboboxProps={{ zIndex: 10001 }}
                                                            rightSection={<IconChevronDown size={12} />}
                                                        />
                                                        {selectedCorrObj && (
                                                            <Badge
                                                                size="xs"
                                                                color={STATUS_COLOR[selectedCorrObj.status] ?? 'gray'}
                                                                variant="light"
                                                                style={{ flexShrink: 0 }}
                                                            >
                                                                {STATUS_LABEL[selectedCorrObj.status] ?? selectedCorrObj.status}
                                                            </Badge>
                                                        )}
                                                        <Text size="10px" c="dimmed" style={{ flexShrink: 0 }}>
                                                            {f.disponibles}/{f.total} disp.
                                                        </Text>
                                                    </Group>
                                                </Stack>
                                            </Group>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </ScrollArea>
                    )}

                    <Divider />

                    <Group justify="flex-end" gap="sm">
                        <Button variant="default" onClick={onClose} disabled={submitting}>Cancelar</Button>
                        <Button
                            color="green"
                            leftSection={<IconCheck size={16} />}
                            onClick={handleSubmit}
                            loading={submitting}
                            disabled={selectedCount === 0 || !fecha || !muestreadorInst}
                        >
                            Crear Ejecución ({selectedCount} ficha{selectedCount !== 1 ? 's' : ''})
                        </Button>
                    </Group>
                </Stack>
            )}
        </Modal>
    );
};
