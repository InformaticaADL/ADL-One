import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

const createNumberedIcon = (number: number) =>
    L.divIcon({
        className: 'custom-numbered-marker',
        html: `<div style="background:#7950f2;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${number}</div>`,
        iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14]
    });

const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
    if (!url) return null;
    const d = decodeURIComponent(url);
    const m1 = d.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (m1) return { lat: parseFloat(m1[1]), lng: parseFloat(m1[2]) };
    const m2 = d.match(/[?&](?:q|ll)=(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/);
    if (m2) return { lat: parseFloat(m2[1]), lng: parseFloat(m2[2]) };
    const m3 = d.match(/place\/(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/);
    if (m3) return { lat: parseFloat(m3[1]), lng: parseFloat(m3[2]) };
    const m4 = d.match(/@(-?\d+\.?\d*),\s*\+?(-?\d+\.?\d*)/);
    if (m4) return { lat: parseFloat(m4[1]), lng: parseFloat(m4[2]) };
    return null;
};

const FitBounds: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
    const map = useMap();
    useEffect(() => {
        if (positions.length === 1) map.setView(positions[0], 14);
        else if (positions.length > 1) {
            map.fitBounds(L.latLngBounds(positions.map(p => L.latLng(p[0], p[1]))), { padding: [40, 40], maxZoom: 14 });
        }
    }, [positions, map]);
    return null;
};

import { 
    IconTrash, IconCalendarEvent, IconRefresh, IconPlus, 
    IconEdit, IconUserPlus, IconRoute, IconMapPin, IconCheck, IconEye, IconList, IconMap
} from '@tabler/icons-react';
import { 
    Table, Button, Badge, Group, ActionIcon, Text, Loader, Center, 
    Paper, Stack, Title, Modal, Select, TextInput, Tooltip, ThemeIcon,
    ScrollArea as MantineScrollArea, SegmentedControl
} from '@mantine/core';
import { rutasPlanificadasService } from '../services/rutasPlanificadas.service';
import { fichaService } from '../services/ficha.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';

interface RutasListViewProps {
    onBackToMenu: () => void;
    onNuevaRuta: () => void;
    onEditarRuta?: (rutaId: number) => void;
}

export const RutasListView: React.FC<RutasListViewProps> = ({ onBackToMenu, onNuevaRuta, onEditarRuta }) => {
    const [rutas, setRutas] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();
    const { hasPermission } = useAuth();
    const { getCatalogo } = useCatalogos();

    // Delete confirmation modal
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; nombre: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // View detail modal
    const [viewTarget, setViewTarget] = useState<any | null>(null);
    const [viewLoading, setViewLoading] = useState(false);

    const handleViewRuta = async (ruta: any) => {
        setViewLoading(true);
        setViewTarget({ ...ruta, fichas: null });
        setViewOsrmRoute([]);
        setViewTab('mapa');
        try {
            const detail = await rutasPlanificadasService.getById(ruta.id_ruta_planificada);

            // Replicate the same 3-step coordinate resolution as RouteMapPlannerView
            const fichasConCoords = await Promise.all((detail?.fichas || []).map(async (f: any) => {
                let lat: number | null = null;
                let lng: number | null = null;

                // Step 1: Try to parse Google Maps URL
                let googleUrl = f.ref_google || '';
                if (googleUrl) {
                    // Resolve goo.gl short URLs first
                    if (googleUrl.includes('goo.gl')) {
                        try {
                            const resolved = await fichaService.resolveGoogleUrl(googleUrl);
                            if (resolved?.finalUrl) googleUrl = resolved.finalUrl;
                        } catch {
                            // ignore, continue with original url
                        }
                    }
                    const coords = parseGoogleMapsUrl(googleUrl);
                    if (coords) { lat = coords.lat; lng = coords.lng; }
                }

                // Step 2: Try latitud/longitud direct fields
                if (lat === null && f.latitud && f.longitud) {
                    lat = parseFloat(f.latitud);
                    lng = parseFloat(f.longitud);
                }

                // Step 3: Fallback to ma_coordenadas (direct lat,lng text)
                if (lat === null && f.ma_coordenadas) {
                    const coordsFromText = parseGoogleMapsUrl('/@' + f.ma_coordenadas);
                    if (coordsFromText) { lat = coordsFromText.lat; lng = coordsFromText.lng; }
                    // Also try comma-separated format
                    if (lat === null) {
                        const parts = String(f.ma_coordenadas).split(',').map((s: string) => parseFloat(s.trim()));
                        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                            lat = parts[0]; lng = parts[1];
                        }
                    }
                }

                return { ...f, lat, lng };
            }));

            setViewTarget({ ...detail, fichas: fichasConCoords });
        } catch (e) {
            showToast({ type: 'error', message: 'Error al cargar el detalle de la ruta' });
        } finally {
            setViewLoading(false);
        }
    };

    // OSRM route for the detail modal map
    const [viewOsrmRoute, setViewOsrmRoute] = useState<[number, number][]>([]);
    const [viewTab, setViewTab] = useState<string>('mapa');

    const viewRoutePositions = useMemo((): [number, number][] => {
        if (!viewTarget?.fichas) return [];
        return viewTarget.fichas
            .filter((f: any) => f.lat !== null && f.lng !== null)
            .map((f: any) => [f.lat, f.lng] as [number, number]);
    }, [viewTarget]);

    useEffect(() => {
        if (viewRoutePositions.length < 2) { setViewOsrmRoute([]); return; }
        const fetchOsrm = async () => {
            try {
                const coordsStr = viewRoutePositions.map(p => `${p[1]},${p[0]}`).join(';');
                const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`);
                const data = await res.json();
                if (data.code === 'Ok' && data.routes?.length > 0) {
                    setViewOsrmRoute(data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]));
                } else setViewOsrmRoute([]);
            } catch { setViewOsrmRoute([]); }
        };
        fetchOsrm();
    }, [viewRoutePositions]);

    // Assignment modal
    const [assignTarget, setAssignTarget] = useState<{ id: number; nombre: string; fichas: number } | null>(null);
    const [assigning, setAssigning] = useState(false);
    const [assignDate, setAssignDate] = useState('');
    const [assignMuestreadorInst, setAssignMuestreadorInst] = useState<string | null>(null);
    const [assignMuestreadorRet, setAssignMuestreadorRet] = useState<string | null>(null);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);

    const muestreadorOptions = useMemo(() =>
        muestreadores.map((m: any) => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const fetchRutas = async () => {
        setLoading(true);
        try {
            const data = await rutasPlanificadasService.getAll();
            setRutas(data || []);
        } catch (e) {
            showToast({ type: 'error', message: 'Error al obtener rutas guardadas' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRutas();
        // Pre-load muestreadores for assignment
        getCatalogo('muestreadores', () => catalogosService.getMuestreadores())
            .then(data => { if (data) setMuestreadores(data); })
            .catch(() => {});
    }, []);

    // --- DELETE ---
    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await rutasPlanificadasService.delete(deleteTarget.id);
            showToast({ type: 'success', message: 'Ruta eliminada correctamente' });
            setDeleteTarget(null);
            fetchRutas();
        } catch (e) {
            showToast({ type: 'error', message: 'Error al eliminar la ruta' });
        } finally {
            setDeleting(false);
        }
    };

    // --- ASSIGN ---
    const handleAssignConfirm = async () => {
        if (!assignTarget) return;
        if (!assignDate) {
            showToast({ type: 'warning', message: 'Selecciona una fecha de muestreo' });
            return;
        }
        if (!assignMuestreadorInst) {
            showToast({ type: 'warning', message: 'Selecciona un muestreador de instalación' });
            return;
        }
        setAssigning(true);
        try {
            await rutasPlanificadasService.asignar(assignTarget.id, {
                assignDate,
                assignMuestreadorInst,
                assignMuestreadorRet: assignMuestreadorRet || undefined
            });
            showToast({ type: 'success', message: `Ruta "${assignTarget.nombre}" asignada oficialmente ✅` });
            setAssignTarget(null);
            resetAssignForm();
            fetchRutas();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al asignar la ruta' });
        } finally {
            setAssigning(false);
        }
    };

    const resetAssignForm = () => {
        setAssignDate('');
        setAssignMuestreadorInst(null);
        setAssignMuestreadorRet(null);
    };

    // --- EDIT ---
    const handleEdit = (rutaId: number) => {
        if (onEditarRuta) {
            onEditarRuta(rutaId);
        } else {
            showToast({ type: 'info', message: 'Edición de rutas próximamente' });
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'PENDIENTE': return 'blue';
            case 'ASIGNADA': return 'green';
            case 'COMPLETADA': return 'teal';
            case 'CANCELADA': return 'red';
            default: return 'gray';
        }
    };

    return (
        <Stack gap="md" style={{ width: '100%' }} p="md">
            <PageHeader 
                title="Administrador de Rutas" 
                subtitle="Gestiona y asigna las rutas planificadas de muestreo."
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Rutas Planificadas' }
                ]}
                rightSection={
                    hasPermission('MA_RUTA_CREAR') ? (
                        <Button leftSection={<IconPlus size={16} />} color="blue" onClick={onNuevaRuta}>
                            Nueva Ruta
                        </Button>
                    ) : undefined
                }
            />

            <Paper withBorder radius="md" p="md" shadow="sm">
                <Group justify="space-between" mb="md">
                    <Group gap="sm">
                        <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                            <IconRoute size={18} />
                        </ThemeIcon>
                        <div>
                            <Title order={4}>Rutas Guardadas</Title>
                            <Text size="xs" c="dimmed">{rutas.length} ruta{rutas.length !== 1 ? 's' : ''} en el sistema</Text>
                        </div>
                    </Group>
                    <Button size="xs" variant="light" leftSection={<IconRefresh size={14} />} onClick={fetchRutas} loading={loading}>
                        Actualizar
                    </Button>
                </Group>

                {loading ? (
                    <Center p="xl"><Loader /></Center>
                ) : rutas.length === 0 ? (
                    <Center py={60}>
                        <Stack align="center" gap="md">
                            <IconRoute size={48} color="var(--mantine-color-gray-4)" />
                            <div>
                                <Text c="dimmed" ta="center" fw={500}>No hay rutas guardadas</Text>
                                <Text c="dimmed" ta="center" size="sm">Haz clic en "Nueva Ruta" para comenzar a planificar.</Text>
                            </div>
                            <Button variant="light" leftSection={<IconPlus size={14} />} onClick={onNuevaRuta}>
                                Crear Primera Ruta
                            </Button>
                        </Stack>
                    </Center>
                ) : (
                    <MantineScrollArea offsetScrollbars>
                        <Table striped highlightOnHover verticalSpacing="sm" style={{ minWidth: 800 }}>
                            <Table.Thead>
                                <Table.Tr>
                                    <Table.Th>ID</Table.Th>
                                    <Table.Th>Nombre Ruta</Table.Th>
                                    <Table.Th>Creador</Table.Th>
                                    <Table.Th ta="center">Fichas</Table.Th>
                                    <Table.Th>Fecha Creación</Table.Th>
                                    <Table.Th>Estado</Table.Th>
                                    <Table.Th ta="right">Acciones</Table.Th>
                                </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {rutas.map(r => (
                                    <Table.Tr key={r.id_ruta_planificada}>
                                        <Table.Td>
                                            <Text size="sm" c="dimmed">#{r.id_ruta_planificada}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs" wrap="nowrap">
                                                <IconMapPin size={14} color="var(--mantine-color-blue-5)" />
                                                <Text fw={500} size="sm" style={{ whiteSpace: 'nowrap' }}>{r.nombre_ruta}</Text>
                                            </Group>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{r.creador || 'Sistema'}</Text>
                                        </Table.Td>
                                        <Table.Td ta="center">
                                            <Badge variant="light" color="blue" size="sm">{r.cantidad_fichas}</Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.fecha_creacion)}</Text>
                                        </Table.Td>
                                        <Table.Td>
                                            <Badge color={getEstadoColor(r.estado)} variant="light" size="sm">
                                                {r.estado}
                                            </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                            <Group gap="xs" justify="flex-end" wrap="nowrap">
                                                {hasPermission('MA_RUTA_VER_DETALLE') && (
                                                    <Tooltip label="Ver detalle de la ruta">
                                                        <ActionIcon color="violet" variant="subtle" onClick={() => handleViewRuta(r)}>
                                                            <IconEye size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                                {r.estado === 'PENDIENTE' && (
                                                    <Tooltip label="Asignar fecha y muestreador">
                                                        <Button 
                                                            size="compact-xs" 
                                                            color="green" 
                                                            variant="light"
                                                            leftSection={<IconCalendarEvent size={14} />}
                                                            onClick={() => setAssignTarget({ 
                                                                id: r.id_ruta_planificada, 
                                                                nombre: r.nombre_ruta, 
                                                                fichas: r.cantidad_fichas 
                                                            })}
                                                        >
                                                            Asignar
                                                        </Button>
                                                    </Tooltip>
                                                )}
                                                {r.estado === 'PENDIENTE' && (
                                                    <Tooltip label="Editar ruta">
                                                        <ActionIcon color="blue" variant="subtle" onClick={() => handleEdit(r.id_ruta_planificada)}>
                                                            <IconEdit size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                                {hasPermission('MA_RUTA_ELIMINAR') && (
                                                    <Tooltip label="Eliminar ruta">
                                                        <ActionIcon 
                                                            color="red" 
                                                            variant="subtle" 
                                                            onClick={() => setDeleteTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })}
                                                        >
                                                            <IconTrash size={16} />
                                                        </ActionIcon>
                                                    </Tooltip>
                                                )}
                                            </Group>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                    </MantineScrollArea>
                )}
            </Paper>

            {/* ======================== VIEW ROUTE DETAIL MODAL ======================== */}
            <Modal
                opened={viewTarget !== null}
                onClose={() => { setViewTarget(null); setViewOsrmRoute([]); }}
                title={
                    <Group gap="xs">
                        <IconRoute size={20} color="var(--mantine-color-violet-6)" />
                        <Text fw={600} size="lg">{viewTarget?.nombre_ruta || 'Detalle de Ruta'}</Text>
                        {viewTarget?.estado && (
                            <Badge color={getEstadoColor(viewTarget.estado)} variant="filled" size="sm">
                                {viewTarget.estado}
                            </Badge>
                        )}
                    </Group>
                }
                centered
                size="90%"
                styles={{ body: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 } }}
            >
                {viewLoading ? (
                    <Center py="xl"><Loader /></Center>
                ) : viewTarget && (
                    <Stack gap={0}>
                        {/* Sub-header */}
                        <Group px="md" py="xs" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                            <Text size="xs" c="dimmed">
                                Creado por: <strong>{viewTarget.creador || 'Sistema'}</strong> · {formatDate(viewTarget.fecha_creacion)}
                                {' · '}<strong>{viewTarget.fichas?.filter((f: any) => f.lat !== null).length ?? 0}</strong> de <strong>{viewTarget.fichas?.length ?? viewTarget.cantidad_fichas ?? 0}</strong> fichas con ubicación
                            </Text>
                            <SegmentedControl
                                size="xs"
                                value={viewTab}
                                onChange={setViewTab}
                                data={[
                                    { label: <Group gap={4} wrap="nowrap"><IconMap size={13} /><span>Mapa</span></Group>, value: 'mapa' },
                                    { label: <Group gap={4} wrap="nowrap"><IconList size={13} /><span>Lista</span></Group>, value: 'lista' },
                                ]}
                            />
                        </Group>

                        {/* CONTENT */}
                        {viewTab === 'mapa' ? (
                            <div style={{ display: 'flex', height: 520 }}>
                                {/* MAP */}
                                <div style={{ flex: 1, position: 'relative' }}>
                                    {viewRoutePositions.length === 0 ? (
                                        <Center style={{ height: '100%' }}>
                                            <Stack align="center" gap="xs">
                                                <IconMapPin size={40} color="var(--mantine-color-gray-4)" />
                                                <Text c="dimmed" size="sm">Ninguna ficha de esta ruta tiene coordenadas registradas.</Text>
                                            </Stack>
                                        </Center>
                                    ) : (
                                        <MapContainer
                                            center={viewRoutePositions[0] ?? [-38.5, -72.5]}
                                            zoom={8}
                                            style={{ height: '100%', width: '100%' }}
                                            zoomControl
                                        >
                                            <TileLayer
                                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            />
                                            <FitBounds positions={viewRoutePositions} />
                                            {/* OSRM route polyline */}
                                            {viewOsrmRoute.length > 1 && (
                                                <Polyline positions={viewOsrmRoute} color="#7950f2" weight={4} opacity={0.75} dashArray="8,4" />
                                            )}
                                            {/* Direct line fallback */}
                                            {viewOsrmRoute.length === 0 && viewRoutePositions.length > 1 && (
                                                <Polyline positions={viewRoutePositions} color="#7950f2" weight={3} opacity={0.5} />
                                            )}
                                            {/* Numbered markers */}
                                            {viewTarget.fichas
                                                .filter((f: any) => f.lat !== null)
                                                .map((f: any, idx: number) => (
                                                    <Marker key={f.id_fichaingresoservicio} position={[f.lat, f.lng]} icon={createNumberedIcon(f.orden ?? idx + 1)}>
                                                        <Popup>
                                                            <strong>#{f.id_fichaingresoservicio}</strong><br />
                                                            {f.centro && <span>{f.centro}<br /></span>}
                                                            {f.empresa_servicio && <span style={{ fontSize: 11, color: '#666' }}>{f.empresa_servicio}</span>}
                                                        </Popup>
                                                    </Marker>
                                                ))
                                            }
                                        </MapContainer>
                                    )}
                                </div>

                                {/* SIDE LIST */}
                                <MantineScrollArea style={{ width: 240, borderLeft: '1px solid var(--mantine-color-gray-2)', paddingTop: 8, paddingBottom: 8, paddingLeft: 8, paddingRight: 8 }}>
                                    <Stack gap="xs">
                                        <Text size="xs" fw={700} c="dimmed" mb={4}>ORDEN DE PARADAS</Text>
                                        {(viewTarget.fichas || []).map((f: any, idx: number) => (
                                            <Paper key={f.id_fichaingresoservicio ?? idx} withBorder p="xs" radius="sm"
                                                bg={f.lat !== null ? undefined : 'red.0'}
                                                style={{ borderColor: f.lat !== null ? undefined : 'var(--mantine-color-red-3)' }}
                                            >
                                                <Group gap="xs" wrap="nowrap">
                                                    <ThemeIcon size="sm" radius="xl" color={f.lat !== null ? 'violet' : 'red'} variant="filled">
                                                        <Text size="10px" fw={700}>{f.orden ?? idx + 1}</Text>
                                                    </ThemeIcon>
                                                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                                                        <Text size="xs" fw={700} c="blue.8" truncate>#{f.id_fichaingresoservicio}</Text>
                                                        <Text size="10px" c="dimmed" truncate>{f.centro || '-'}</Text>
                                                        {f.lat === null && <Text size="10px" c="red">Sin coordenadas</Text>}
                                                    </Stack>
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </MantineScrollArea>
                            </div>
                        ) : (
                            /* LISTA TAB */
                            <MantineScrollArea mah={520} style={{ paddingTop: 16, paddingBottom: 16, paddingLeft: 16, paddingRight: 16 }}>
                                <Stack gap="xs">
                                    {(viewTarget.fichas && viewTarget.fichas.length > 0) ? (
                                        viewTarget.fichas.map((f: any, idx: number) => (
                                            <Paper key={f.id_fichaingresoservicio ?? idx} withBorder p="sm" radius="sm">
                                                <Group gap="xs" wrap="nowrap">
                                                    <ThemeIcon size="sm" radius="xl" color="violet" variant="filled">
                                                        <Text size="10px" fw={700}>{f.orden ?? idx + 1}</Text>
                                                    </ThemeIcon>
                                                    <Stack gap={2} style={{ flex: 1 }}>
                                                        <Group gap="xs">
                                                            <Text size="xs" fw={700} c="blue.8">#{f.id_fichaingresoservicio}</Text>
                                                            {f.frecuencia_correlativo && (
                                                                <Badge size="xs" variant="light" color="blue">{f.frecuencia_correlativo}</Badge>
                                                            )}
                                                            {f.lat === null && (
                                                                <Badge size="xs" color="red" variant="light">Sin coord.</Badge>
                                                            )}
                                                        </Group>
                                                        {f.centro && <Text size="xs" c="dimmed">{f.centro}</Text>}
                                                        {f.empresa_servicio && <Text size="10px" c="dimmed">{f.empresa_servicio}</Text>}
                                                        {f.objetivo && <Text size="10px" c="dimmed">Obj: {f.objetivo}</Text>}
                                                    </Stack>
                                                </Group>
                                            </Paper>
                                        ))
                                    ) : (
                                        <Text c="dimmed" size="sm" ta="center" py="md">Sin fichas registradas en esta ruta.</Text>
                                    )}
                                </Stack>
                            </MantineScrollArea>
                        )}

                        <Group p="md" justify="flex-end" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                            <Button variant="default" onClick={() => { setViewTarget(null); setViewOsrmRoute([]); }}>Cerrar</Button>
                        </Group>
                    </Stack>
                )}
            </Modal>

            {/* ======================== DELETE CONFIRMATION MODAL ======================== */}
            <Modal
                opened={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                title={<Text fw={600} size="lg">Confirmar Eliminación</Text>}
                centered
                size="sm"
            >
                <Stack gap="md">
                    <Text size="sm">
                        ¿Estás seguro de que deseas eliminar la ruta <Text span fw={700}>"{deleteTarget?.nombre}"</Text>?
                    </Text>
                    <Text size="xs" c="dimmed">
                        Esta acción no se puede deshacer. Las fichas asociadas no serán eliminadas, solo la planificación de la ruta.
                    </Text>
                    <Group justify="flex-end" mt="sm">
                        <Button variant="default" onClick={() => setDeleteTarget(null)}>
                            Cancelar
                        </Button>
                        <Button color="red" leftSection={<IconTrash size={16} />} onClick={handleDeleteConfirm} loading={deleting}>
                            Eliminar Ruta
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* ======================== ASSIGNMENT MODAL ======================== */}
            <Modal
                opened={assignTarget !== null}
                onClose={() => { setAssignTarget(null); resetAssignForm(); }}
                title={
                    <Group gap="xs">
                        <IconCalendarEvent size={20} color="var(--mantine-color-green-6)" />
                        <Text fw={600} size="lg">Asignar Ruta Oficialmente</Text>
                    </Group>
                }
                centered
                size="md"
            >
                <Stack gap="md">
                    <Paper withBorder p="sm" radius="sm" bg="blue.0">
                        <Group gap="xs">
                            <IconRoute size={16} color="var(--mantine-color-blue-7)" />
                            <Text size="sm" fw={600} c="blue.8">{assignTarget?.nombre}</Text>
                            <Badge size="xs" variant="light" color="blue">{assignTarget?.fichas} fichas</Badge>
                        </Group>
                    </Paper>

                    <TextInput
                        label="Fecha de Muestreo"
                        type="date"
                        value={assignDate}
                        onChange={(e) => setAssignDate(e.target.value)}
                        leftSection={<IconCalendarEvent size={16} />}
                        required
                    />
                    <Select
                        label="Muestreador Instalación"
                        data={muestreadorOptions}
                        value={assignMuestreadorInst}
                        onChange={(v) => { setAssignMuestreadorInst(v); if (!assignMuestreadorRet) setAssignMuestreadorRet(v); }}
                        searchable
                        placeholder="Seleccionar muestreador..."
                        leftSection={<IconUserPlus size={16} />}
                        required
                        comboboxProps={{ zIndex: 10001 }}
                    />
                    <Select
                        label="Muestreador Retiro"
                        data={muestreadorOptions}
                        value={assignMuestreadorRet}
                        onChange={setAssignMuestreadorRet}
                        searchable
                        placeholder="Igual al de instalación"
                        leftSection={<IconUserPlus size={16} />}
                        comboboxProps={{ zIndex: 10001 }}
                    />

                    <Button
                        fullWidth
                        color="green"
                        size="md"
                        leftSection={<IconCheck size={20} />}
                        onClick={handleAssignConfirm}
                        loading={assigning}
                        disabled={!assignDate || !assignMuestreadorInst}
                        mt="xs"
                    >
                        Confirmar Asignación Oficial
                    </Button>
                </Stack>
            </Modal>
        </Stack>
    );
};
