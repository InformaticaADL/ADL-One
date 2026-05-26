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
    IconEdit, IconRoute, IconMapPin, IconEye, IconList, IconMap, IconHistory,
    IconCopy, IconChevronDown, IconChevronRight, IconSearch, IconFolderPlus,
    IconFolder, IconX, IconCheck, IconPlayerPlay, IconAlertCircle
} from '@tabler/icons-react';
import {
    Table, Button, Badge, Group, ActionIcon, Text, Loader, Center,
    Paper, Stack, Title, Modal, Tooltip, ThemeIcon, Alert,
    ScrollArea as MantineScrollArea, SegmentedControl, TextInput,
    Collapse, Divider, Textarea, Select, Box
} from '@mantine/core';
import { rutasPlanificadasService, type RutaPlanificada, type GrupoRuta } from '../services/rutasPlanificadas.service';
import { rutasEjecucionesService } from '../services/rutasEjecuciones.service';
import { fichaService } from '../services/ficha.service';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { NuevaEjecucionModal } from './NuevaEjecucionModal';

interface RutasListViewProps {
    onBackToMenu: () => void;
    onNuevaRuta: () => void;
    onEditarRuta?: (rutaId: number) => void;
}

export const RutasListView: React.FC<RutasListViewProps> = ({ onBackToMenu, onNuevaRuta, onEditarRuta }) => {
    const [rutas, setRutas] = useState<RutaPlanificada[]>([]);
    const [grupos, setGrupos] = useState<GrupoRuta[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGrupo, setFilterGrupo] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['sin-grupo']));
    const { showToast } = useToast();
    const { hasPermission } = useAuth();

    // Delete confirmation
    const [deleteTarget, setDeleteTarget] = useState<{ id: number; nombre: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // View detail modal
    const [viewTarget, setViewTarget] = useState<any | null>(null);
    const [viewLoading, setViewLoading] = useState(false);
    const [viewOsrmRoute, setViewOsrmRoute] = useState<[number, number][]>([]);
    const [viewTab, setViewTab] = useState<string>('mapa');

    // Nueva ejecución
    const [ejecucionTarget, setEjecucionTarget] = useState<{ id: number; nombre: string } | null>(null);

    // Historial ejecuciones
    const [histTarget, setHistTarget] = useState<{ id: number; nombre: string } | null>(null);
    const [histEjecuciones, setHistEjecuciones] = useState<any[]>([]);
    const [histLoading, setHistLoading] = useState(false);

    // Gestión de grupos modal
    const [showGruposModal, setShowGruposModal] = useState(false);
    const [nuevoGrupoNombre, setNuevoGrupoNombre] = useState('');
    const [nuevoGrupoDesc, setNuevoGrupoDesc] = useState('');
    const [editandoGrupo, setEditandoGrupo] = useState<GrupoRuta | null>(null);
    const [savingGrupo, setSavingGrupo] = useState(false);

    // Ejecución masiva de grupo
    const [ejecucionGrupoTarget, setEjecucionGrupoTarget] = useState<{ id: number; nombre: string; rutas: RutaPlanificada[] } | null>(null);
    type GrupoExecFase = 'setup' | 'executing' | 'done';
    type GrupoExecResultado = { rutaId: number; rutaNombre: string; status: 'pending' | 'loading' | 'success' | 'error'; error?: string };
    const [grupoExecFase, setGrupoExecFase] = useState<GrupoExecFase>('setup');
    const [grupoExecFecha, setGrupoExecFecha] = useState('');
    const [grupoExecMuestInst, setGrupoExecMuestInst] = useState<string | null>(null);
    const [grupoExecMuestRet, setGrupoExecMuestRet] = useState<string | null>(null);
    const [grupoExecObs, setGrupoExecObs] = useState('');
    const [grupoExecMuestreadores, setGrupoExecMuestreadores] = useState<any[]>([]);
    const [grupoExecLoadingMuest, setGrupoExecLoadingMuest] = useState(false);
    const [grupoExecResultados, setGrupoExecResultados] = useState<GrupoExecResultado[]>([]);

    // Asignar/cambiar grupo
    const [grupoTarget, setGrupoTarget] = useState<{ id: number; nombre: string; id_grupo: number | null } | null>(null);
    const [grupoTargetValue, setGrupoTargetValue] = useState<string | null>(null);
    const [grupoSaving, setGrupoSaving] = useState(false);

    // Clonar ruta
    const [clonarTarget, setClonarTarget] = useState<{ id: number; nombre: string; id_grupo?: number | null } | null>(null);
    const [clonarNombre, setClonarNombre] = useState('');
    const [clonarGrupo, setClonarGrupo] = useState<string | null>(null);
    const [clonarLoadingFichas, setClonarLoadingFichas] = useState(false);
    const [clonarFichasAgotadas, setClonarFichasAgotadas] = useState<{ id: number; centro: string }[]>([]);
    const [clonarConfirming, setClonarConfirming] = useState(false);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [rutasData, gruposData] = await Promise.all([
                rutasPlanificadasService.getAll(),
                rutasPlanificadasService.getGrupos(),
            ]);
            setRutas(rutasData || []);
            setGrupos(gruposData || []);
            // Auto-expand all groups
            const ids = new Set<string>(['sin-grupo']);
            (gruposData || []).forEach((g: GrupoRuta) => ids.add(String(g.id_grupo)));
            setExpandedGroups(ids);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar rutas' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, []);

    // ─── Computed ────────────────────────────────────────────────────────────

    const filteredRutas = useMemo(() => {
        return rutas.filter(r => {
            const matchSearch = !searchTerm ||
                r.nombre_ruta.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (r.nombre_grupo || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchGrupo = !filterGrupo ||
                (filterGrupo === 'sin-grupo' ? !r.id_grupo : String(r.id_grupo) === filterGrupo);
            return matchSearch && matchGrupo;
        });
    }, [rutas, searchTerm, filterGrupo]);

    const rutasByGroup = useMemo(() => {
        const map = new Map<string, { label: string; rutas: RutaPlanificada[] }>();
        map.set('sin-grupo', { label: 'Sin grupo', rutas: [] });
        grupos.forEach(g => map.set(String(g.id_grupo), { label: g.nombre_grupo, rutas: [] }));
        filteredRutas.forEach(r => {
            const key = r.id_grupo ? String(r.id_grupo) : 'sin-grupo';
            if (!map.has(key)) map.set(key, { label: r.nombre_grupo || 'Sin grupo', rutas: [] });
            map.get(key)!.rutas.push(r);
        });
        // Remove empty groups (except 'sin-grupo' if it has rutas)
        const result: { key: string; label: string; rutas: RutaPlanificada[] }[] = [];
        map.forEach((v, k) => { if (v.rutas.length > 0) result.push({ key: k, label: v.label, rutas: v.rutas }); });
        // Sort: named groups first alphabetically, sin-grupo last
        result.sort((a, b) => {
            if (a.key === 'sin-grupo') return 1;
            if (b.key === 'sin-grupo') return -1;
            return a.label.localeCompare(b.label);
        });
        return result;
    }, [filteredRutas, grupos]);

    const getEstadoDinamico = (r: RutaPlanificada) => {
        if (r.estado === 'CANCELADA') return 'CANCELADA';
        if ((r.total_ejecuciones || 0) === 0) return 'PENDIENTE';
        if (r.ultima_ejecucion) {
            const diffDays = (Date.now() - new Date(r.ultima_ejecucion).getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays < 30) return 'ACTIVA';
        }
        return 'ASIGNADA';
    };

    const getEstadoColor = (estado: string) => {
        switch (estado) {
            case 'PENDIENTE': return 'blue';
            case 'ACTIVA': return 'green';
            case 'ASIGNADA': return 'teal';
            case 'CANCELADA': return 'red';
            default: return 'gray';
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    };

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    };

    // ─── Actions ─────────────────────────────────────────────────────────────

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await rutasPlanificadasService.delete(deleteTarget.id);
            showToast({ type: 'success', message: 'Ruta eliminada correctamente' });
            setDeleteTarget(null);
            fetchAll();
        } catch (e: any) {
            showToast({ type: 'error', message: e?.response?.data?.message || 'Error al eliminar la ruta' });
        } finally {
            setDeleting(false);
        }
    };

    const handleOpenGrupo = (r: RutaPlanificada) => {
        setGrupoTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta, id_grupo: r.id_grupo ?? null });
        setGrupoTargetValue(r.id_grupo ? String(r.id_grupo) : null);
    };

    const handleGuardarGrupo = async () => {
        if (!grupoTarget) return;
        setGrupoSaving(true);
        try {
            await rutasPlanificadasService.updateRutaGrupo(
                grupoTarget.id,
                grupoTargetValue ? Number(grupoTargetValue) : null
            );
            const grupoNombre = grupoTargetValue
                ? grupos.find(g => String(g.id_grupo) === grupoTargetValue)?.nombre_grupo ?? 'grupo seleccionado'
                : 'sin grupo';
            showToast({ type: 'success', message: `Ruta movida a ${grupoNombre}` });
            setGrupoTarget(null);
            fetchAll();
        } catch {
            showToast({ type: 'error', message: 'Error al actualizar el grupo' });
        } finally {
            setGrupoSaving(false);
        }
    };

    const handleOpenEjecucionGrupo = async (grupo: { id: number; nombre: string; rutas: RutaPlanificada[] }) => {
        setEjecucionGrupoTarget(grupo);
        setGrupoExecFase('setup');
        setGrupoExecFecha('');
        setGrupoExecMuestInst(null);
        setGrupoExecMuestRet(null);
        setGrupoExecObs('');
        setGrupoExecResultados([]);
        setGrupoExecLoadingMuest(true);
        try {
            const muest = await catalogosService.getMuestreadores();
            setGrupoExecMuestreadores(muest || []);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar muestreadores' });
        } finally {
            setGrupoExecLoadingMuest(false);
        }
    };

    const handleEjecutarGrupo = async () => {
        if (!ejecucionGrupoTarget || !grupoExecFecha || !grupoExecMuestInst) return;
        const rutas = ejecucionGrupoTarget.rutas;

        setGrupoExecFase('executing');
        setGrupoExecResultados(rutas.map(r => ({
            rutaId: r.id_ruta_planificada,
            rutaNombre: r.nombre_ruta,
            status: 'pending'
        })));

        for (let i = 0; i < rutas.length; i++) {
            const ruta = rutas[i];
            setGrupoExecResultados(prev => prev.map(r =>
                r.rutaId === ruta.id_ruta_planificada ? { ...r, status: 'loading' } : r
            ));
            try {
                await rutasPlanificadasService.asignar(ruta.id_ruta_planificada, {
                    assignDate: grupoExecFecha,
                    assignMuestreadorInst: grupoExecMuestInst,
                    assignMuestreadorRet: grupoExecMuestRet || undefined,
                    observaciones: grupoExecObs || undefined,
                });
                setGrupoExecResultados(prev => prev.map(r =>
                    r.rutaId === ruta.id_ruta_planificada ? { ...r, status: 'success' } : r
                ));
            } catch (e: any) {
                const msg = e?.response?.data?.message || e?.message || 'Error al ejecutar';
                setGrupoExecResultados(prev => prev.map(r =>
                    r.rutaId === ruta.id_ruta_planificada ? { ...r, status: 'error', error: msg } : r
                ));
            }
        }

        setGrupoExecFase('done');
        fetchAll();
    };

    const handleOpenClonar = async (r: RutaPlanificada) => {
        setClonarTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta, id_grupo: r.id_grupo });
        setClonarNombre(`${r.nombre_ruta} (copia)`);
        setClonarGrupo(r.id_grupo ? String(r.id_grupo) : null);
        setClonarFichasAgotadas([]);
        setClonarLoadingFichas(true);
        try {
            const data = await rutasEjecucionesService.getFichasDisponibles(r.id_ruta_planificada);
            const agotadas = (data.fichas || [])
                .filter((f: any) => f.disponibles === 0)
                .map((f: any) => ({ id: f.id_fichaingresoservicio, centro: f.centro || `#${f.id_fichaingresoservicio}` }));
            setClonarFichasAgotadas(agotadas);
        } catch {
            // No bloqueamos el modal si falla la carga de disponibilidad
        } finally {
            setClonarLoadingFichas(false);
        }
    };

    const handleClonarConfirm = async () => {
        if (!clonarTarget || !clonarNombre.trim()) return;
        setClonarConfirming(true);
        try {
            await rutasPlanificadasService.clone(clonarTarget.id, {
                nombre_ruta: clonarNombre.trim(),
                id_grupo: clonarGrupo ? Number(clonarGrupo) : null,
            });
            showToast({ type: 'success', message: `Ruta clonada como "${clonarNombre.trim()}"` });
            setClonarTarget(null);
            fetchAll();
        } catch {
            showToast({ type: 'error', message: 'Error al clonar la ruta' });
        } finally {
            setClonarConfirming(false);
        }
    };

    const handleViewRuta = async (ruta: any) => {
        setViewLoading(true);
        setViewTarget({ ...ruta, fichas: null });
        setViewOsrmRoute([]);
        setViewTab('mapa');
        try {
            const detail = await rutasPlanificadasService.getById(ruta.id_ruta_planificada);
            const fichasConCoords = await Promise.all((detail?.fichas || []).map(async (f: any) => {
                let lat: number | null = null;
                let lng: number | null = null;
                let googleUrl = f.ref_google || '';
                if (googleUrl) {
                    if (googleUrl.includes('goo.gl')) {
                        try {
                            const resolved = await fichaService.resolveGoogleUrl(googleUrl);
                            if (resolved?.finalUrl) googleUrl = resolved.finalUrl;
                        } catch { /* ignore */ }
                    }
                    const coords = parseGoogleMapsUrl(googleUrl);
                    if (coords) { lat = coords.lat; lng = coords.lng; }
                }
                if (lat === null && f.latitud && f.longitud) { lat = parseFloat(f.latitud); lng = parseFloat(f.longitud); }
                if (lat === null && f.ma_coordenadas) {
                    const c = parseGoogleMapsUrl('/@' + f.ma_coordenadas);
                    if (c) { lat = c.lat; lng = c.lng; }
                    else {
                        const parts = String(f.ma_coordenadas).split(',').map((s: string) => parseFloat(s.trim()));
                        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) { lat = parts[0]; lng = parts[1]; }
                    }
                }
                return { ...f, lat, lng };
            }));
            setViewTarget({ ...detail, fichas: fichasConCoords });
        } catch {
            showToast({ type: 'error', message: 'Error al cargar el detalle de la ruta' });
        } finally {
            setViewLoading(false);
        }
    };

    const viewRoutePositions = useMemo((): [number, number][] => {
        if (!viewTarget?.fichas) return [];
        return viewTarget.fichas.filter((f: any) => f.lat !== null && f.lng !== null).map((f: any) => [f.lat, f.lng] as [number, number]);
    }, [viewTarget]);

    useEffect(() => {
        if (viewRoutePositions.length < 2) { setViewOsrmRoute([]); return; }
        const controller = new AbortController();
        const fetchOsrm = async () => {
            try {
                const coordsStr = viewRoutePositions.map(p => `${p[1]},${p[0]}`).join(';');
                const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`, { signal: controller.signal });
                const data = await res.json();
                if (data.code === 'Ok' && data.routes?.length > 0) {
                    setViewOsrmRoute(data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]));
                } else setViewOsrmRoute([]);
            } catch (err: any) {
                if (err.name !== 'AbortError') setViewOsrmRoute([]);
            }
        };
        fetchOsrm();
        return () => controller.abort();
    }, [viewRoutePositions]);

    const handleViewHistorial = async (r: any) => {
        setHistTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta });
        setHistLoading(true);
        try {
            const data = await rutasEjecucionesService.getEjecucionesByPlantilla(r.id_ruta_planificada);
            setHistEjecuciones(data || []);
        } catch {
            showToast({ type: 'error', message: 'Error al cargar el historial de ejecuciones' });
        } finally {
            setHistLoading(false);
        }
    };

    // ─── Grupos CRUD ─────────────────────────────────────────────────────────

    const handleSaveGrupo = async () => {
        if (!nuevoGrupoNombre.trim()) return;
        setSavingGrupo(true);
        try {
            if (editandoGrupo) {
                await rutasPlanificadasService.updateGrupo(editandoGrupo.id_grupo, { nombre_grupo: nuevoGrupoNombre.trim(), descripcion: nuevoGrupoDesc.trim() || undefined });
                showToast({ type: 'success', message: 'Grupo actualizado' });
            } else {
                await rutasPlanificadasService.createGrupo({ nombre_grupo: nuevoGrupoNombre.trim(), descripcion: nuevoGrupoDesc.trim() || undefined });
                showToast({ type: 'success', message: 'Grupo creado' });
            }
            setNuevoGrupoNombre('');
            setNuevoGrupoDesc('');
            setEditandoGrupo(null);
            fetchAll();
        } catch {
            showToast({ type: 'error', message: 'Error al guardar el grupo' });
        } finally {
            setSavingGrupo(false);
        }
    };

    const handleDeleteGrupo = async (id: number) => {
        try {
            await rutasPlanificadasService.deleteGrupo(id);
            showToast({ type: 'success', message: 'Grupo eliminado (las rutas quedan sin grupo)' });
            fetchAll();
        } catch {
            showToast({ type: 'error', message: 'Error al eliminar el grupo' });
        }
    };

    const grupoOptions = useMemo(() =>
        grupos.map(g => ({ value: String(g.id_grupo), label: g.nombre_grupo })),
        [grupos]
    );

    // ─── Render helpers ──────────────────────────────────────────────────────

    const renderRutaRow = (r: RutaPlanificada) => {
        const estadoDinamico = getEstadoDinamico(r);
        return (
            <Table.Tr key={r.id_ruta_planificada}>
                <Table.Td>
                    <Text size="sm" c="dimmed">#{r.id_ruta_planificada}</Text>
                </Table.Td>
                <Table.Td>
                    <Stack gap={2}>
                        <Group gap="xs" wrap="nowrap">
                            <IconMapPin size={13} color="var(--mantine-color-blue-5)" />
                            <Text fw={600} size="sm">{r.nombre_ruta}</Text>
                        </Group>
                        {r.descripcion && (
                            <Text size="xs" c="dimmed" truncate style={{ maxWidth: 240 }}>{r.descripcion}</Text>
                        )}
                    </Stack>
                </Table.Td>
                <Table.Td>
                    <Text size="sm" c="dimmed">{r.creador || 'Sistema'}</Text>
                </Table.Td>
                <Table.Td ta="center">
                    <Badge variant="light" color="blue" size="sm">{r.cantidad_fichas}</Badge>
                </Table.Td>
                <Table.Td>
                    <Stack gap={1}>
                        <Text size="xs" fw={600}>{r.total_ejecuciones || 0} ejecuciones</Text>
                        {r.ultima_ejecucion && (
                            <Text size="10px" c="dimmed">última: {formatDate(r.ultima_ejecucion)}</Text>
                        )}
                    </Stack>
                </Table.Td>
                <Table.Td>
                    <Badge color={getEstadoColor(estadoDinamico)} variant="light" size="sm">
                        {estadoDinamico}
                    </Badge>
                </Table.Td>
                <Table.Td>
                    <Group gap={4} justify="flex-end" wrap="nowrap">
                        {hasPermission('MA_RUTA_VER_DETALLE') && (
                            <Tooltip label="Ver detalle de la ruta">
                                <ActionIcon color="violet" variant="subtle" size="sm" onClick={() => handleViewRuta(r)}>
                                    <IconEye size={15} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                        <Tooltip label="Historial de ejecuciones">
                            <ActionIcon color="teal" variant="subtle" size="sm" onClick={() => handleViewHistorial(r)}>
                                <IconHistory size={15} />
                            </ActionIcon>
                        </Tooltip>
                        {r.estado !== 'CANCELADA' && (
                            <Tooltip label="Nueva ejecución">
                                <Button
                                    size="compact-xs"
                                    color="green"
                                    variant="light"
                                    leftSection={<IconCalendarEvent size={13} />}
                                    onClick={() => setEjecucionTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })}
                                >
                                    Ejecutar
                                </Button>
                            </Tooltip>
                        )}
                        <Tooltip label="Editar ruta">
                            <ActionIcon color="blue" variant="subtle" size="sm" onClick={() => onEditarRuta ? onEditarRuta(r.id_ruta_planificada) : showToast({ type: 'info', message: 'Edición próximamente' })}>
                                <IconEdit size={15} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={r.id_grupo ? 'Cambiar grupo' : 'Añadir a grupo'}>
                            <ActionIcon color="teal" variant="subtle" size="sm" onClick={() => handleOpenGrupo(r)}>
                                <IconFolder size={15} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Clonar ruta">
                            <ActionIcon color="orange" variant="subtle" size="sm" onClick={() => handleOpenClonar(r)}>
                                <IconCopy size={15} />
                            </ActionIcon>
                        </Tooltip>
                        {hasPermission('MA_RUTA_ELIMINAR') && (
                            <Tooltip label="Eliminar ruta">
                                <ActionIcon color="red" variant="subtle" size="sm" onClick={() => setDeleteTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })}>
                                    <IconTrash size={15} />
                                </ActionIcon>
                            </Tooltip>
                        )}
                    </Group>
                </Table.Td>
            </Table.Tr>
        );
    };

    // ─── JSX ─────────────────────────────────────────────────────────────────

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
                    <Group gap="xs">
                        <Button variant="light" leftSection={<IconFolder size={16} />} onClick={() => setShowGruposModal(true)} size="sm">
                            Grupos
                        </Button>
                        {hasPermission('MA_RUTA_CREAR') && (
                            <Button leftSection={<IconPlus size={16} />} color="blue" onClick={onNuevaRuta}>
                                Nueva Ruta
                            </Button>
                        )}
                    </Group>
                }
            />

            {/* Filtros */}
            <Group gap="sm">
                <TextInput
                    placeholder="Buscar por nombre o grupo..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    leftSection={<IconSearch size={14} />}
                    rightSection={searchTerm ? <ActionIcon size="xs" variant="subtle" onClick={() => setSearchTerm('')}><IconX size={12} /></ActionIcon> : null}
                    size="sm"
                    style={{ flex: 1, maxWidth: 320 }}
                />
                <Select
                    placeholder="Filtrar por grupo"
                    data={[{ value: 'sin-grupo', label: 'Sin grupo' }, ...grupoOptions]}
                    value={filterGrupo}
                    onChange={setFilterGrupo}
                    clearable
                    size="sm"
                    style={{ minWidth: 180 }}
                />
                <Button size="sm" variant="light" leftSection={<IconRefresh size={14} />} onClick={fetchAll} loading={loading}>
                    Actualizar
                </Button>
            </Group>

            <Paper withBorder radius="md" p="md" shadow="sm">
                <Group justify="space-between" mb="md">
                    <Group gap="sm">
                        <ThemeIcon size="lg" variant="light" color="blue" radius="md">
                            <IconRoute size={18} />
                        </ThemeIcon>
                        <div>
                            <Title order={4}>Rutas Guardadas</Title>
                            <Text size="xs" c="dimmed">{filteredRutas.length} ruta{filteredRutas.length !== 1 ? 's' : ''} · {grupos.length} grupo{grupos.length !== 1 ? 's' : ''}</Text>
                        </div>
                    </Group>
                </Group>

                {loading ? (
                    <Center p="xl"><Loader /></Center>
                ) : filteredRutas.length === 0 ? (
                    <Center py={60}>
                        <Stack align="center" gap="md">
                            <IconRoute size={48} color="var(--mantine-color-gray-4)" />
                            <div>
                                <Text c="dimmed" ta="center" fw={500}>No hay rutas{searchTerm ? ' que coincidan con la búsqueda' : ' guardadas'}</Text>
                                {!searchTerm && <Text c="dimmed" ta="center" size="sm">Haz clic en "Nueva Ruta" para comenzar.</Text>}
                            </div>
                            {!searchTerm && hasPermission('MA_RUTA_CREAR') && (
                                <Button variant="light" leftSection={<IconPlus size={14} />} onClick={onNuevaRuta}>Crear Primera Ruta</Button>
                            )}
                        </Stack>
                    </Center>
                ) : (
                    <Stack gap="xs">
                        {rutasByGroup.map(group => (
                            <Box key={group.key}>
                                {/* Group header */}
                                <Group
                                    gap="xs"
                                    py="xs"
                                    px="sm"
                                    style={{ cursor: 'pointer', borderRadius: 8, background: 'var(--mantine-color-gray-0)' }}
                                    onClick={() => toggleGroup(group.key)}
                                >
                                    {expandedGroups.has(group.key) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                    <ThemeIcon size="sm" variant="light" color={group.key === 'sin-grupo' ? 'gray' : 'blue'} radius="sm">
                                        <IconFolder size={12} />
                                    </ThemeIcon>
                                    <Text fw={700} size="sm">{group.label}</Text>
                                    <Badge size="xs" variant="light" color="gray">{group.rutas.length} ruta{group.rutas.length !== 1 ? 's' : ''}</Badge>
                                    {group.key !== 'sin-grupo' && (
                                        <Tooltip label={`Ejecutar todas las rutas de "${group.label}"`}>
                                            <Button
                                                size="compact-xs"
                                                color="green"
                                                variant="subtle"
                                                leftSection={<IconPlayerPlay size={12} />}
                                                ml="auto"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    const grupoObj = grupos.find(g => String(g.id_grupo) === group.key);
                                                    handleOpenEjecucionGrupo({ id: Number(group.key), nombre: grupoObj?.nombre_grupo || group.label, rutas: group.rutas });
                                                }}
                                            >
                                                Ejecutar grupo
                                            </Button>
                                        </Tooltip>
                                    )}
                                    {/* R-08: para "Sin grupo", botón explícito para asignar todas las rutas a un grupo */}
                                    {group.key === 'sin-grupo' && group.rutas.length > 0 && (
                                        <Tooltip label="Asignar estas rutas a un grupo">
                                            <Button
                                                size="compact-xs"
                                                color="teal"
                                                variant="light"
                                                leftSection={<IconFolder size={12} />}
                                                ml="auto"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    // Si hay una sola ruta, abrir directamente el modal de "cambiar grupo" para esa.
                                                    if (group.rutas.length === 1) {
                                                        handleOpenGrupo(group.rutas[0]);
                                                    } else {
                                                        showToast({
                                                            type: 'info',
                                                            message: 'Use el botón de carpeta en cada fila para asignar grupo a cada ruta individualmente.'
                                                        });
                                                    }
                                                }}
                                            >
                                                {group.rutas.length === 1 ? 'Asignar a grupo' : `${group.rutas.length} sin grupo — asignar`}
                                            </Button>
                                        </Tooltip>
                                    )}
                                </Group>

                                <Collapse in={expandedGroups.has(group.key)}>
                                    <MantineScrollArea offsetScrollbars>
                                        <Table striped highlightOnHover verticalSpacing="xs" style={{ minWidth: 800 }} mt={4}>
                                            <Table.Thead>
                                                <Table.Tr>
                                                    <Table.Th w={50}>ID</Table.Th>
                                                    <Table.Th>Nombre</Table.Th>
                                                    <Table.Th>Creador</Table.Th>
                                                    <Table.Th ta="center" w={70}>Fichas</Table.Th>
                                                    <Table.Th>Ejecuciones</Table.Th>
                                                    <Table.Th w={100}>Estado</Table.Th>
                                                    <Table.Th ta="right">Acciones</Table.Th>
                                                </Table.Tr>
                                            </Table.Thead>
                                            <Table.Tbody>
                                                {group.rutas.map(renderRutaRow)}
                                            </Table.Tbody>
                                        </Table>
                                    </MantineScrollArea>
                                </Collapse>

                                <Divider mt="xs" />
                            </Box>
                        ))}
                    </Stack>
                )}
            </Paper>

            {/* ── VIEW ROUTE DETAIL MODAL ─────────────────────────────────────── */}
            <Modal
                opened={viewTarget !== null}
                onClose={() => { setViewTarget(null); setViewOsrmRoute([]); }}
                title={
                    <Group gap="xs">
                        <IconRoute size={20} color="var(--mantine-color-violet-6)" />
                        <Text fw={600} size="lg">{viewTarget?.nombre_ruta || 'Detalle de Ruta'}</Text>
                        {viewTarget?.estado && (
                            <Badge color={getEstadoColor(getEstadoDinamico(viewTarget))} variant="filled" size="sm">
                                {getEstadoDinamico(viewTarget)}
                            </Badge>
                        )}
                    </Group>
                }
                centered size="90%"
                styles={{ body: { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 } }}
            >
                {viewLoading ? (
                    <Center py="xl"><Loader /></Center>
                ) : viewTarget && (
                    <Stack gap={0}>
                        <Group px="md" py="xs" justify="space-between" style={{ borderBottom: '1px solid var(--mantine-color-gray-2)' }}>
                            <Text size="xs" c="dimmed">
                                Creado por: <strong>{viewTarget.creador || 'Sistema'}</strong> ·
                                {' '}<strong>{viewTarget.fichas?.filter((f: any) => f.lat !== null).length ?? 0}</strong> de <strong>{viewTarget.fichas?.length ?? viewTarget.cantidad_fichas ?? 0}</strong> fichas con ubicación
                                {viewTarget.descripcion && <> · <em>{viewTarget.descripcion}</em></>}
                            </Text>
                            <SegmentedControl
                                size="xs" value={viewTab} onChange={setViewTab}
                                data={[
                                    { label: <Group gap={4} wrap="nowrap"><IconMap size={13} /><span>Mapa</span></Group>, value: 'mapa' },
                                    { label: <Group gap={4} wrap="nowrap"><IconList size={13} /><span>Lista</span></Group>, value: 'lista' },
                                ]}
                            />
                        </Group>
                        {viewTab === 'mapa' ? (
                            <div style={{ display: 'flex', height: 520 }}>
                                <div style={{ flex: 1, position: 'relative' }}>
                                    {viewRoutePositions.length === 0 ? (
                                        <Center style={{ height: '100%' }}>
                                            <Stack align="center" gap="xs">
                                                <IconMapPin size={40} color="var(--mantine-color-gray-4)" />
                                                <Text c="dimmed" size="sm">Ninguna ficha tiene coordenadas registradas.</Text>
                                            </Stack>
                                        </Center>
                                    ) : (
                                        <MapContainer center={viewRoutePositions[0] ?? [-38.5, -72.5]} zoom={8} style={{ height: '100%', width: '100%' }} zoomControl>
                                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
                                            <FitBounds positions={viewRoutePositions} />
                                            {viewOsrmRoute.length > 1 && <Polyline positions={viewOsrmRoute} color="#7950f2" weight={4} opacity={0.75} dashArray="8,4" />}
                                            {viewOsrmRoute.length === 0 && viewRoutePositions.length > 1 && <Polyline positions={viewRoutePositions} color="#7950f2" weight={3} opacity={0.5} />}
                                            {viewTarget.fichas.filter((f: any) => f.lat !== null).map((f: any, idx: number) => (
                                                <Marker key={f.id_fichaingresoservicio} position={[f.lat, f.lng]} icon={createNumberedIcon(f.orden ?? idx + 1)}>
                                                    <Popup>
                                                        <strong>#{f.id_fichaingresoservicio}</strong><br />
                                                        {f.centro && <span>{f.centro}<br /></span>}
                                                        {f.empresa_servicio && <span style={{ fontSize: 11, color: '#666' }}>{f.empresa_servicio}</span>}
                                                    </Popup>
                                                </Marker>
                                            ))}
                                        </MapContainer>
                                    )}
                                </div>
                                <MantineScrollArea style={{ width: 240, borderLeft: '1px solid var(--mantine-color-gray-2)', padding: 8 }}>
                                    <Stack gap="xs">
                                        <Text size="xs" fw={700} c="dimmed" mb={4}>ORDEN DE PARADAS</Text>
                                        {(viewTarget.fichas || []).map((f: any, idx: number) => (
                                            <Paper key={f.id_fichaingresoservicio ?? idx} withBorder p="xs" radius="sm" bg={f.lat !== null ? undefined : 'red.0'} style={{ borderColor: f.lat !== null ? undefined : 'var(--mantine-color-red-3)' }}>
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
                            <MantineScrollArea mah={520} style={{ padding: 16 }}>
                                <Stack gap="xs">
                                    {(viewTarget.fichas && viewTarget.fichas.length > 0) ? viewTarget.fichas.map((f: any, idx: number) => (
                                        <Paper key={f.id_fichaingresoservicio ?? idx} withBorder p="sm" radius="sm">
                                            <Group gap="xs" wrap="nowrap">
                                                <ThemeIcon size="sm" radius="xl" color="violet" variant="filled">
                                                    <Text size="10px" fw={700}>{f.orden ?? idx + 1}</Text>
                                                </ThemeIcon>
                                                <Stack gap={2} style={{ flex: 1 }}>
                                                    <Group gap="xs">
                                                        <Text size="xs" fw={700} c="blue.8">#{f.id_fichaingresoservicio}</Text>
                                                        {f.frecuencia_correlativo && <Badge size="xs" variant="light" color="blue">{f.frecuencia_correlativo}</Badge>}
                                                        {f.lat === null && <Badge size="xs" color="red" variant="light">Sin coord.</Badge>}
                                                    </Group>
                                                    {f.centro && <Text size="xs" c="dimmed">{f.centro}</Text>}
                                                    {f.empresa_servicio && <Text size="10px" c="dimmed">{f.empresa_servicio}</Text>}
                                                </Stack>
                                            </Group>
                                        </Paper>
                                    )) : <Text c="dimmed" size="sm" ta="center" py="md">Sin fichas registradas.</Text>}
                                </Stack>
                            </MantineScrollArea>
                        )}
                        <Group p="md" justify="flex-end" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
                            <Button variant="default" onClick={() => { setViewTarget(null); setViewOsrmRoute([]); }}>Cerrar</Button>
                        </Group>
                    </Stack>
                )}
            </Modal>

            {/* ── ASIGNAR GRUPO MODAL ─────────────────────────────────────────── */}
            <Modal
                opened={grupoTarget !== null}
                onClose={() => setGrupoTarget(null)}
                title={
                    <Group gap="xs">
                        <IconFolder size={20} color="var(--mantine-color-teal-6)" />
                        <Text fw={600} size="lg">{grupoTarget?.id_grupo ? 'Cambiar grupo' : 'Añadir a grupo'}</Text>
                    </Group>
                }
                centered size="sm"
            >
                <Stack gap="md">
                    <Text size="sm" c="dimmed">
                        Ruta: <Text span fw={600} c="dark">{grupoTarget?.nombre}</Text>
                    </Text>
                    <Select
                        label="Grupo"
                        description="Selecciona un grupo o deja vacío para quitar de cualquier grupo"
                        placeholder="Sin grupo"
                        data={grupos.map(g => ({ value: String(g.id_grupo), label: g.nombre_grupo }))}
                        value={grupoTargetValue}
                        onChange={setGrupoTargetValue}
                        clearable
                        searchable
                    />
                    <Group justify="flex-end" mt="xs">
                        <Button variant="default" onClick={() => setGrupoTarget(null)}>Cancelar</Button>
                        <Button
                            color="teal"
                            leftSection={<IconCheck size={16} />}
                            onClick={handleGuardarGrupo}
                            loading={grupoSaving}
                        >
                            Guardar
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* ── CLONAR RUTA MODAL ───────────────────────────────────────────── */}
            <Modal
                opened={clonarTarget !== null}
                onClose={() => setClonarTarget(null)}
                title={
                    <Group gap="xs">
                        <IconCopy size={20} color="var(--mantine-color-orange-6)" />
                        <Text fw={600} size="lg">Clonar Ruta</Text>
                    </Group>
                }
                centered size="sm"
            >
                <Stack gap="md">
                    <TextInput
                        label="Nombre de la copia"
                        value={clonarNombre}
                        onChange={e => setClonarNombre(e.target.value)}
                        required
                        autoFocus
                        placeholder="Nombre para la nueva ruta..."
                    />
                    <Select
                        label="Grupo"
                        description="Deja vacío para clonar sin grupo"
                        placeholder="Sin grupo"
                        data={grupos.map(g => ({ value: String(g.id_grupo), label: g.nombre_grupo }))}
                        value={clonarGrupo}
                        onChange={setClonarGrupo}
                        clearable
                        searchable
                    />

                    {/* Advertencia fichas agotadas */}
                    {clonarLoadingFichas && (
                        <Group gap="xs" c="dimmed">
                            <Loader size="xs" />
                            <Text size="xs">Verificando disponibilidad de correlativos...</Text>
                        </Group>
                    )}
                    {!clonarLoadingFichas && clonarFichasAgotadas.length > 0 && (
                        <Alert
                            icon={<IconAlertCircle size={16} />}
                            color="orange"
                            title={`${clonarFichasAgotadas.length} ficha${clonarFichasAgotadas.length > 1 ? 's' : ''} sin correlativos disponibles`}
                        >
                            <Text size="xs" mb={4}>
                                Las siguientes fichas no tienen servicios pendientes. La copia las incluirá pero no podrán ejecutarse hasta que tengan nuevos correlativos:
                            </Text>
                            <Stack gap={2}>
                                {clonarFichasAgotadas.map(f => (
                                    <Text key={f.id} size="xs" fw={600}>• #{f.id} — {f.centro}</Text>
                                ))}
                            </Stack>
                        </Alert>
                    )}
                    {!clonarLoadingFichas && clonarFichasAgotadas.length === 0 && clonarTarget && (
                        <Group gap="xs" c="teal">
                            <IconCheck size={14} />
                            <Text size="xs">Todas las fichas tienen correlativos disponibles.</Text>
                        </Group>
                    )}

                    <Group justify="flex-end" mt="xs">
                        <Button variant="default" onClick={() => setClonarTarget(null)}>Cancelar</Button>
                        <Button
                            color="orange"
                            leftSection={<IconCopy size={16} />}
                            onClick={handleClonarConfirm}
                            loading={clonarConfirming}
                            disabled={!clonarNombre.trim()}
                        >
                            Clonar
                        </Button>
                    </Group>
                </Stack>
            </Modal>

            {/* ── DELETE MODAL ────────────────────────────────────────────────── */}
            <Modal opened={deleteTarget !== null} onClose={() => setDeleteTarget(null)} title={<Text fw={600} size="lg">Confirmar Eliminación</Text>} centered size="sm">
                <Stack gap="md">
                    <Text size="sm">¿Estás seguro de eliminar la ruta <Text span fw={700}>"{deleteTarget?.nombre}"</Text>?</Text>
                    <Text size="xs" c="dimmed">Las fichas no serán eliminadas, solo la planificación de la ruta.</Text>
                    <Group justify="flex-end" mt="sm">
                        <Button variant="default" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button color="red" leftSection={<IconTrash size={16} />} onClick={handleDeleteConfirm} loading={deleting}>Eliminar</Button>
                    </Group>
                </Stack>
            </Modal>

            {/* ── NUEVA EJECUCIÓN MODAL ───────────────────────────────────────── */}
            {ejecucionTarget && (
                <NuevaEjecucionModal
                    opened={ejecucionTarget !== null}
                    onClose={() => setEjecucionTarget(null)}
                    rutaId={ejecucionTarget.id}
                    rutaNombre={ejecucionTarget.nombre}
                    onSuccess={fetchAll}
                />
            )}

            {/* ── EJECUCIÓN MASIVA DE GRUPO ────────────────────────────────── */}
            {ejecucionGrupoTarget && (() => {
                const muestOptions = grupoExecMuestreadores.map((m: any) => ({
                    value: String(m.id_muestreador),
                    label: m.nombre_muestreador
                }));
                const exitosos = grupoExecResultados.filter(r => r.status === 'success').length;
                const fallidos = grupoExecResultados.filter(r => r.status === 'error').length;
                const pendientes = grupoExecResultados.filter(r => r.status === 'pending' || r.status === 'loading').length;

                return (
                    <Modal
                        opened={ejecucionGrupoTarget !== null}
                        onClose={() => grupoExecFase !== 'executing' && setEjecucionGrupoTarget(null)}
                        closeOnClickOutside={grupoExecFase !== 'executing'}
                        closeOnEscape={grupoExecFase !== 'executing'}
                        title={
                            <Group gap="xs">
                                <IconPlayerPlay size={18} color="var(--mantine-color-green-6)" />
                                <Text fw={600}>Ejecutar grupo: {ejecucionGrupoTarget.nombre}</Text>
                                <Badge size="sm" variant="light" color="gray">{ejecucionGrupoTarget.rutas.length} rutas</Badge>
                            </Group>
                        }
                        centered size="lg"
                    >
                        {/* ── FASE SETUP ── */}
                        {grupoExecFase === 'setup' && (
                            <Stack gap="md">
                                <Paper withBorder p="sm" radius="sm" bg="gray.0">
                                    {grupoExecLoadingMuest ? (
                                        <Center py="sm"><Loader size="sm" /></Center>
                                    ) : (
                                        <Stack gap="sm">
                                            <Group grow gap="sm">
                                                <TextInput
                                                    label="Fecha de muestreo"
                                                    type="date"
                                                    value={grupoExecFecha}
                                                    onChange={e => setGrupoExecFecha(e.target.value)}
                                                    leftSection={<IconCalendarEvent size={15} />}
                                                    required
                                                />
                                                <Select
                                                    label="Muestreador Instalación"
                                                    data={muestOptions}
                                                    value={grupoExecMuestInst}
                                                    onChange={v => { setGrupoExecMuestInst(v); if (!grupoExecMuestRet) setGrupoExecMuestRet(v); }}
                                                    searchable
                                                    placeholder="Seleccionar..."
                                                    required
                                                    comboboxProps={{ zIndex: 10001 }}
                                                />
                                                <Select
                                                    label="Muestreador Retiro"
                                                    data={muestOptions}
                                                    value={grupoExecMuestRet}
                                                    onChange={setGrupoExecMuestRet}
                                                    searchable
                                                    placeholder="Igual al de instalación"
                                                    comboboxProps={{ zIndex: 10001 }}
                                                />
                                            </Group>
                                            <TextInput
                                                label="Observaciones"
                                                placeholder="Opcional — se aplicará a todas las rutas"
                                                value={grupoExecObs}
                                                onChange={e => setGrupoExecObs(e.target.value)}
                                            />
                                        </Stack>
                                    )}
                                </Paper>

                                <Text size="xs" fw={600} c="dimmed">RUTAS A EJECUTAR</Text>
                                <MantineScrollArea mah={240} offsetScrollbars>
                                    <Stack gap="xs">
                                        {ejecucionGrupoTarget.rutas.map(r => (
                                            <Paper key={r.id_ruta_planificada} withBorder p="xs" radius="sm">
                                                <Group justify="space-between" wrap="nowrap">
                                                    <Group gap="xs" wrap="nowrap">
                                                        <ThemeIcon size="sm" radius="xl" color="blue" variant="light">
                                                            <IconRoute size={12} />
                                                        </ThemeIcon>
                                                        <Text size="sm" truncate>{r.nombre_ruta}</Text>
                                                    </Group>
                                                    <Group gap="xs" wrap="nowrap">
                                                        <Badge size="xs" variant="light" color="blue">{r.cantidad_fichas} fichas</Badge>
                                                        <Badge size="xs" variant="light" color={getEstadoColor(getEstadoDinamico(r))}>{getEstadoDinamico(r)}</Badge>
                                                    </Group>
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </MantineScrollArea>

                                <Group justify="flex-end" mt="xs">
                                    <Button variant="default" onClick={() => setEjecucionGrupoTarget(null)}>Cancelar</Button>
                                    <Button
                                        color="green"
                                        leftSection={<IconPlayerPlay size={16} />}
                                        onClick={handleEjecutarGrupo}
                                        disabled={!grupoExecFecha || !grupoExecMuestInst || grupoExecLoadingMuest}
                                    >
                                        Ejecutar {ejecucionGrupoTarget.rutas.length} rutas
                                    </Button>
                                </Group>
                            </Stack>
                        )}

                        {/* ── FASE EXECUTING / DONE ── */}
                        {(grupoExecFase === 'executing' || grupoExecFase === 'done') && (
                            <Stack gap="md">
                                {grupoExecFase === 'executing' && (
                                    <Group gap="xs" c="blue">
                                        <Loader size="xs" />
                                        <Text size="sm">Ejecutando rutas... no cierres esta ventana.</Text>
                                    </Group>
                                )}
                                {grupoExecFase === 'done' && (
                                    <Group gap="sm">
                                        {exitosos > 0 && <Badge color="green" variant="light" size="md">{exitosos} exitosas</Badge>}
                                        {fallidos > 0 && <Badge color="red" variant="light" size="md">{fallidos} con error</Badge>}
                                        {pendientes === 0 && <Text size="sm" c="dimmed">Proceso finalizado.</Text>}
                                    </Group>
                                )}

                                <MantineScrollArea mah={340} offsetScrollbars>
                                    <Stack gap="xs">
                                        {grupoExecResultados.map(r => (
                                            <Paper
                                                key={r.rutaId}
                                                withBorder p="xs" radius="sm"
                                                bg={r.status === 'success' ? 'green.0' : r.status === 'error' ? 'red.0' : undefined}
                                                style={{ borderColor: r.status === 'success' ? 'var(--mantine-color-green-3)' : r.status === 'error' ? 'var(--mantine-color-red-3)' : undefined }}
                                            >
                                                <Group justify="space-between" wrap="nowrap">
                                                    <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
                                                        <ThemeIcon size="sm" radius="xl" variant="light"
                                                            color={r.status === 'success' ? 'green' : r.status === 'error' ? 'red' : r.status === 'loading' ? 'blue' : 'gray'}>
                                                            {r.status === 'loading' ? <Loader size={10} color="blue" /> :
                                                             r.status === 'success' ? <IconCheck size={11} /> :
                                                             r.status === 'error' ? <IconX size={11} /> :
                                                             <IconRoute size={11} />}
                                                        </ThemeIcon>
                                                        <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                                                            <Text size="xs" fw={600} truncate>{r.rutaNombre}</Text>
                                                            {r.status === 'error' && r.error && (
                                                                <Text size="10px" c="red">{r.error}</Text>
                                                            )}
                                                        </Stack>
                                                    </Group>
                                                    <Badge size="xs" variant="light"
                                                        color={r.status === 'success' ? 'green' : r.status === 'error' ? 'red' : r.status === 'loading' ? 'blue' : 'gray'}>
                                                        {r.status === 'success' ? 'Listo' : r.status === 'error' ? 'Error' : r.status === 'loading' ? 'Ejecutando...' : 'Pendiente'}
                                                    </Badge>
                                                </Group>
                                            </Paper>
                                        ))}
                                    </Stack>
                                </MantineScrollArea>

                                {grupoExecFase === 'done' && (
                                    <Group justify="flex-end">
                                        <Button onClick={() => setEjecucionGrupoTarget(null)}>Cerrar</Button>
                                    </Group>
                                )}
                            </Stack>
                        )}
                    </Modal>
                );
            })()}

            {/* ── HISTORIAL EJECUCIONES ────────────────────────────────────────── */}
            <Modal
                opened={histTarget !== null}
                onClose={() => { setHistTarget(null); setHistEjecuciones([]); }}
                title={
                    <Group gap="xs">
                        <IconHistory size={20} color="var(--mantine-color-teal-6)" />
                        <Text fw={600} size="lg">Historial de Ejecuciones</Text>
                        {histTarget && <Badge variant="light" color="blue" size="sm">{histTarget.nombre}</Badge>}
                    </Group>
                }
                centered size="lg"
            >
                {histLoading ? (
                    <Center py="xl"><Loader /></Center>
                ) : histEjecuciones.length === 0 ? (
                    <Stack align="center" py="xl" gap="xs">
                        <IconHistory size={40} color="var(--mantine-color-gray-4)" />
                        <Text c="dimmed" size="sm">Sin ejecuciones registradas.</Text>
                    </Stack>
                ) : (
                    <MantineScrollArea mah={400} offsetScrollbars>
                        <Stack gap="xs" p="xs">
                            {histEjecuciones.map((e: any) => (
                                <Paper key={e.id_ejecucion} withBorder p="sm" radius="sm">
                                    <Group justify="space-between" wrap="nowrap">
                                        <Stack gap={2}>
                                            <Group gap="xs">
                                                <Badge size="xs" color="green" variant="light">{e.estado}</Badge>
                                                <Text size="xs" fw={600}>
                                                    {e.fecha_ejecucion ? new Date(e.fecha_ejecucion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                </Text>
                                                <Badge size="xs" variant="dot" color="blue">{e.cantidad_fichas} fichas</Badge>
                                            </Group>
                                            <Text size="xs" c="dimmed">
                                                Inst: <strong>{e.muestreador_inst || '-'}</strong>
                                                {e.muestreador_ret && e.muestreador_ret !== e.muestreador_inst && <> · Ret: <strong>{e.muestreador_ret}</strong></>}
                                            </Text>
                                            {e.observaciones && <Text size="10px" c="dimmed" fs="italic">{e.observaciones}</Text>}
                                        </Stack>
                                        <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap' }}>#{e.id_ejecucion}</Text>
                                    </Group>
                                </Paper>
                            ))}
                        </Stack>
                    </MantineScrollArea>
                )}
                <Group justify="flex-end" mt="sm">
                    <Button variant="default" onClick={() => { setHistTarget(null); setHistEjecuciones([]); }}>Cerrar</Button>
                </Group>
            </Modal>

            {/* ── GESTIÓN DE GRUPOS MODAL ──────────────────────────────────────── */}
            <Modal
                opened={showGruposModal}
                onClose={() => { setShowGruposModal(false); setEditandoGrupo(null); setNuevoGrupoNombre(''); setNuevoGrupoDesc(''); }}
                title={
                    <Group gap="xs">
                        <IconFolderPlus size={20} color="var(--mantine-color-blue-6)" />
                        <Text fw={600} size="lg">Gestión de Grupos</Text>
                    </Group>
                }
                centered size="md"
            >
                <Stack gap="md">
                    {/* Form crear/editar grupo */}
                    <Paper withBorder p="sm" radius="md" bg="gray.0">
                        <Text size="xs" fw={700} c="dimmed" mb="xs">{editandoGrupo ? 'EDITAR GRUPO' : 'NUEVO GRUPO'}</Text>
                        <Stack gap="xs">
                            <TextInput
                                placeholder="Nombre del grupo (ej: Chiloé, Puerto Montt)"
                                value={nuevoGrupoNombre}
                                onChange={e => setNuevoGrupoNombre(e.target.value)}
                                size="sm"
                            />
                            <Textarea
                                placeholder="Descripción opcional"
                                value={nuevoGrupoDesc}
                                onChange={e => setNuevoGrupoDesc(e.target.value)}
                                size="sm"
                                rows={2}
                            />
                            <Group justify="flex-end">
                                {editandoGrupo && (
                                    <Button variant="subtle" size="xs" onClick={() => { setEditandoGrupo(null); setNuevoGrupoNombre(''); setNuevoGrupoDesc(''); }}>
                                        Cancelar
                                    </Button>
                                )}
                                <Button
                                    size="xs"
                                    leftSection={editandoGrupo ? <IconCheck size={14} /> : <IconPlus size={14} />}
                                    disabled={!nuevoGrupoNombre.trim()}
                                    loading={savingGrupo}
                                    onClick={handleSaveGrupo}
                                >
                                    {editandoGrupo ? 'Guardar cambios' : 'Crear grupo'}
                                </Button>
                            </Group>
                        </Stack>
                    </Paper>

                    {/* Lista de grupos */}
                    <Stack gap="xs">
                        {grupos.length === 0 ? (
                            <Text size="sm" c="dimmed" ta="center" py="sm">No hay grupos creados aún.</Text>
                        ) : grupos.map(g => (
                            <Paper key={g.id_grupo} withBorder p="sm" radius="sm">
                                <Group justify="space-between" wrap="nowrap">
                                    <Stack gap={1}>
                                        <Group gap="xs">
                                            <IconFolder size={14} color="var(--mantine-color-blue-5)" />
                                            <Text size="sm" fw={600}>{g.nombre_grupo}</Text>
                                            <Badge size="xs" variant="light" color="gray">{g.cantidad_rutas || 0} rutas</Badge>
                                        </Group>
                                        {g.descripcion && <Text size="xs" c="dimmed">{g.descripcion}</Text>}
                                    </Stack>
                                    <Group gap={4}>
                                        <ActionIcon size="sm" variant="subtle" color="blue" onClick={() => { setEditandoGrupo(g); setNuevoGrupoNombre(g.nombre_grupo); setNuevoGrupoDesc(g.descripcion || ''); }}>
                                            <IconEdit size={14} />
                                        </ActionIcon>
                                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => handleDeleteGrupo(g.id_grupo)}>
                                            <IconTrash size={14} />
                                        </ActionIcon>
                                    </Group>
                                </Group>
                            </Paper>
                        ))}
                    </Stack>
                </Stack>
            </Modal>
        </Stack>
    );
};
