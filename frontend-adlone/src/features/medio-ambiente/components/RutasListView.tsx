import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { BaseTiles } from './BaseTiles';
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
    Table, Button, Tag, Spin, Modal, Tooltip, Alert, Input, Select, Segmented, Typography
} from 'antd';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { rutasPlanificadasService, type RutaPlanificada, type GrupoRuta } from '../services/rutasPlanificadas.service';
import { rutasEjecucionesService } from '../services/rutasEjecuciones.service';
import { fichaService } from '../services/ficha.service';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { NuevaEjecucionModal } from './NuevaEjecucionModal';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface RutasListViewProps {
    onBackToMenu: () => void;
    onNuevaRuta: () => void;
    onEditarRuta?: (rutaId: number) => void;
}

export const RutasListView: React.FC<RutasListViewProps> = ({ onBackToMenu, onNuevaRuta, onEditarRuta }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
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
        // Mantener un grupo si tiene rutas, o si es un grupo real existente (aunque esté vacío).
        // 'sin-grupo' solo se muestra cuando tiene rutas. Al filtrar por un grupo puntual,
        // no se muestran los demás grupos reales vacíos.
        const realGroupKeys = new Set(grupos.map(g => String(g.id_grupo)));
        const result: { key: string; label: string; rutas: RutaPlanificada[] }[] = [];
        map.forEach((v, k) => {
            const isRealGroup = k !== 'sin-grupo' && realGroupKeys.has(k);
            const keep = v.rutas.length > 0 ||
                (isRealGroup && (!filterGrupo || filterGrupo === k));
            if (keep) result.push({ key: k, label: v.label, rutas: v.rutas });
        });
        // Sort: named groups first alphabetically, sin-grupo last
        result.sort((a, b) => {
            if (a.key === 'sin-grupo') return 1;
            if (b.key === 'sin-grupo') return -1;
            return a.label.localeCompare(b.label);
        });
        return result;
    }, [filteredRutas, grupos, filterGrupo]);

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
            case 'ASIGNADA': return 'cyan';
            case 'CANCELADA': return 'red';
            default: return 'default';
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    };

    const formatDistancia = (m?: number | null) => {
        if (m === null || m === undefined) return '—';
        if (m < 1000) return `${Math.round(m)} m`;
        return `${(m / 1000).toFixed(1)} km`;
    };
    const formatDuracion = (s?: number | null) => {
        if (s === null || s === undefined) return '—';
        const h = Math.floor(s / 3600);
        const min = Math.round((s % 3600) / 60);
        return h > 0 ? `${h} h ${min} min` : `${min} min`;
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
        if (!grupo.rutas || grupo.rutas.length === 0) {
            showToast({ type: 'info', message: 'Este grupo no tiene rutas asociadas para ejecutar' });
            return;
        }
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

    const rutaColumns = [
        { title: 'ID', key: 'id', width: 50, render: (_: unknown, r: RutaPlanificada) => <Text type="secondary" style={{ fontSize: 13 }}>#{r.id_ruta_planificada}</Text> },
        {
            title: 'Nombre', key: 'nombre',
            render: (_: unknown, r: RutaPlanificada) => (
                <div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap' as const }}>
                        <IconMapPin size={13} color="#4dabf7" />
                        <Text strong style={{ fontSize: 13 }}>{r.nombre_ruta}</Text>
                    </div>
                    {r.descripcion && (
                        <Text type="secondary" style={{ fontSize: 12, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.descripcion}</Text>
                    )}
                </div>
            ),
        },
        { title: 'Creador', key: 'creador', render: (_: unknown, r: RutaPlanificada) => <Text type="secondary" style={{ fontSize: 13 }}>{r.creador || 'Sistema'}</Text> },
        { title: 'Fichas', key: 'fichas', width: 70, align: 'center' as const, render: (_: unknown, r: RutaPlanificada) => <Tag color="blue">{r.cantidad_fichas}</Tag> },
        {
            title: 'Ejecuciones', key: 'ejecuciones',
            render: (_: unknown, r: RutaPlanificada) => (
                <div>
                    <Text strong style={{ fontSize: 12, display: 'block' }}>{r.total_ejecuciones || 0} ejecuciones</Text>
                    {r.ultima_ejecucion && (
                        <Text type="secondary" style={{ fontSize: 10 }}>última: {formatDate(r.ultima_ejecucion)}</Text>
                    )}
                </div>
            ),
        },
        {
            title: 'Vehículo', key: 'vehiculo', width: 110,
            render: (_: unknown, r: RutaPlanificada) => (r.distancia_metros != null || r.duracion_segundos != null) ? (
                <div>
                    <Text strong style={{ fontSize: 12, display: 'block' }}>{formatDistancia(r.distancia_metros)}</Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>{formatDuracion(r.duracion_segundos)}</Text>
                </div>
            ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
        },
        {
            title: 'Estado', key: 'estado', width: 100,
            render: (_: unknown, r: RutaPlanificada) => {
                const estadoDinamico = getEstadoDinamico(r);
                return <Tag color={getEstadoColor(estadoDinamico)}>{estadoDinamico}</Tag>;
            },
        },
        {
            title: 'Acciones', key: 'acciones', align: 'right' as const,
            render: (_: unknown, r: RutaPlanificada) => (
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', flexWrap: 'nowrap' as const }}>
                    {hasPermission('MA_RUTA_VER_DETALLE') && (
                        <Tooltip title="Ver detalle de la ruta">
                            <Button type="text" size="small" icon={<IconEye size={15} color="#7048e8" />} onClick={() => handleViewRuta(r)} />
                        </Tooltip>
                    )}
                    <Tooltip title="Historial de ejecuciones">
                        <Button type="text" size="small" icon={<IconHistory size={15} color="#0c8599" />} onClick={() => handleViewHistorial(r)} />
                    </Tooltip>
                    {r.estado !== 'CANCELADA' && (
                        <Tooltip title="Nueva ejecución">
                            <Button
                                size="small"
                                icon={<IconCalendarEvent size={13} />}
                                style={{ color: '#2f9e44' }}
                                onClick={() => setEjecucionTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })}
                            >
                                Ejecutar
                            </Button>
                        </Tooltip>
                    )}
                    <Tooltip title="Editar ruta">
                        <Button type="text" size="small" icon={<IconEdit size={15} color="#1c7ed6" />} onClick={() => onEditarRuta ? onEditarRuta(r.id_ruta_planificada) : showToast({ type: 'info', message: 'Edición próximamente' })} />
                    </Tooltip>
                    <Tooltip title={r.id_grupo ? 'Cambiar grupo' : 'Añadir a grupo'}>
                        <Button type="text" size="small" icon={<IconFolder size={15} color="#0c8599" />} onClick={() => handleOpenGrupo(r)} />
                    </Tooltip>
                    <Tooltip title="Clonar ruta">
                        <Button type="text" size="small" icon={<IconCopy size={15} color="#e8590c" />} onClick={() => handleOpenClonar(r)} />
                    </Tooltip>
                    {hasPermission('MA_RUTA_ELIMINAR') && (
                        <Tooltip title="Eliminar ruta">
                            <Button type="text" size="small" icon={<IconTrash size={15} color="#e03131" />} onClick={() => setDeleteTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })} />
                        </Tooltip>
                    )}
                </div>
            ),
        },
    ];

    // ─── JSX ─────────────────────────────────────────────────────────────────

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', padding: 16 }}>
            <PageHeader
                title="Administrador de Rutas"
                subtitle="Gestiona y asigna las rutas planificadas de muestreo."
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Rutas Planificadas' }
                ]}
                rightSection={
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button icon={<IconFolder size={16} />} onClick={() => setShowGruposModal(true)}>
                            Grupos
                        </Button>
                        {hasPermission('MA_RUTA_CREAR') && (
                            <Button icon={<IconPlus size={16} />} type="primary" onClick={onNuevaRuta}>
                                Nueva Ruta
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Input
                    placeholder="Buscar por nombre o grupo..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    prefix={<IconSearch size={14} style={{ color: 'var(--app-text-secondary)' }} />}
                    suffix={searchTerm ? <IconX size={12} style={{ cursor: 'pointer' }} onClick={() => setSearchTerm('')} /> : null}
                    style={{ flex: 1, maxWidth: 320 }}
                />
                <Select
                    placeholder="Filtrar por grupo"
                    options={[{ value: 'sin-grupo', label: 'Sin grupo' }, ...grupoOptions]}
                    value={filterGrupo ?? undefined}
                    onChange={(v) => setFilterGrupo(v ?? null)}
                    allowClear
                    style={{ minWidth: 180 }}
                />
                <Button icon={<IconRefresh size={14} />} onClick={fetchAll} loading={loading}>
                    Actualizar
                </Button>
            </div>

            <div style={{ background: 'var(--app-bg-elevated)', border: '1px solid var(--app-border)', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'var(--app-accent-bg)', color: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconRoute size={18} />
                        </div>
                        <div>
                            <Title level={4} style={{ margin: 0 }}>Rutas Guardadas</Title>
                            <Text type="secondary" style={{ fontSize: 12 }}>{filteredRutas.length} ruta{filteredRutas.length !== 1 ? 's' : ''} · {grupos.length} grupo{grupos.length !== 1 ? 's' : ''}</Text>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
                ) : filteredRutas.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0' }}>
                        <IconRoute size={48} color="var(--app-text-secondary)" />
                        <div>
                            <Text type="secondary" strong style={{ textAlign: 'center', display: 'block' }}>No hay rutas{searchTerm ? ' que coincidan con la búsqueda' : ' guardadas'}</Text>
                            {!searchTerm && <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', display: 'block' }}>Haz clic en "Nueva Ruta" para comenzar.</Text>}
                        </div>
                        {!searchTerm && hasPermission('MA_RUTA_CREAR') && (
                            <Button icon={<IconPlus size={14} />} onClick={onNuevaRuta}>Crear Primera Ruta</Button>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {rutasByGroup.map(group => (
                            <div key={group.key}>
                                {/* Group header */}
                                <div
                                    style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', cursor: 'pointer', borderRadius: 8, background: 'var(--app-hover-bg)' }}
                                    onClick={() => toggleGroup(group.key)}
                                >
                                    {expandedGroups.has(group.key) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                    <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: group.key === 'sin-grupo' ? 'var(--app-border)' : 'var(--app-accent-bg)', color: group.key === 'sin-grupo' ? 'var(--app-text-secondary)' : '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <IconFolder size={12} />
                                    </div>
                                    <Text strong style={{ fontSize: 13 }}>{group.label}</Text>
                                    <Tag>{group.rutas.length} ruta{group.rutas.length !== 1 ? 's' : ''}</Tag>
                                    {group.key !== 'sin-grupo' && (
                                        <Tooltip title={group.rutas.length === 0
                                            ? 'Este grupo no tiene rutas asociadas'
                                            : `Ejecutar todas las rutas de "${group.label}"`}>
                                            <Button
                                                type="text"
                                                size="small"
                                                style={{ color: '#2f9e44', marginLeft: 'auto' }}
                                                icon={<IconPlayerPlay size={12} />}
                                                disabled={group.rutas.length === 0}
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
                                        <Tooltip title="Asignar estas rutas a un grupo">
                                            <Button
                                                type="text"
                                                size="small"
                                                style={{ color: '#0c8599', marginLeft: 'auto' }}
                                                icon={<IconFolder size={12} />}
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
                                </div>

                                {expandedGroups.has(group.key) && (
                                    group.rutas.length === 0 ? (
                                        <Text type="secondary" italic style={{ fontSize: 13, textAlign: 'center', display: 'block', padding: '16px 0' }}>
                                            No hay rutas asociadas
                                        </Text>
                                    ) : (
                                        <Table
                                            rowKey="id_ruta_planificada"
                                            columns={rutaColumns}
                                            dataSource={group.rutas}
                                            pagination={false}
                                            size="small"
                                            scroll={{ x: 800 }}
                                            style={{ marginTop: 4 }}
                                        />
                                    )
                                )}

                                <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0 0' }} />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── VIEW ROUTE DETAIL MODAL ─────────────────────────────────────── */}
            <Modal
                open={viewTarget !== null}
                onCancel={() => { setViewTarget(null); setViewOsrmRoute([]); }}
                footer={null}
                width="90%"
                styles={{ body: { padding: 0 } }}
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconRoute size={20} color="#7048e8" />
                        <Text strong style={{ fontSize: 16 }}>{viewTarget?.nombre_ruta || 'Detalle de Ruta'}</Text>
                        {viewTarget?.estado && (
                            <Tag color={getEstadoColor(getEstadoDinamico(viewTarget))}>
                                {getEstadoDinamico(viewTarget)}
                            </Tag>
                        )}
                    </div>
                }
            >
                {viewLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
                ) : viewTarget && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--app-border)' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                                Creado por: <strong>{viewTarget.creador || 'Sistema'}</strong> ·
                                {' '}<strong>{viewTarget.fichas?.filter((f: any) => f.lat !== null).length ?? 0}</strong> de <strong>{viewTarget.fichas?.length ?? viewTarget.cantidad_fichas ?? 0}</strong> fichas con ubicación
                                {(viewTarget.distancia_metros != null || viewTarget.duracion_segundos != null) && (
                                    <> · 🚗 <strong>{formatDistancia(viewTarget.distancia_metros)}</strong> · ⏱ <strong>{formatDuracion(viewTarget.duracion_segundos)}</strong></>
                                )}
                                {viewTarget.descripcion && <> · <em>{viewTarget.descripcion}</em></>}
                            </Text>
                            <Segmented
                                size="small" value={viewTab} onChange={(v) => setViewTab(v as string)}
                                options={[
                                    { label: <span><IconMap size={13} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />Mapa</span>, value: 'mapa' },
                                    { label: <span><IconList size={13} style={{ verticalAlign: 'text-bottom', marginRight: 4 }} />Lista</span>, value: 'lista' },
                                ]}
                            />
                        </div>
                        {viewTab === 'mapa' ? (
                            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: isMobile ? 'auto' : 520 }}>
                                <div style={{ flex: isMobile ? 'none' : 1, height: isMobile ? 350 : 'auto', position: 'relative' }}>
                                    {viewRoutePositions.length === 0 ? (
                                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                                <IconMapPin size={40} color="var(--app-text-secondary)" />
                                                <Text type="secondary" style={{ fontSize: 13 }}>Ninguna ficha tiene coordenadas registradas.</Text>
                                            </div>
                                        </div>
                                    ) : (
                                        <MapContainer center={viewRoutePositions[0] ?? [-38.5, -72.5]} zoom={8} style={{ height: '100%', width: '100%' }} zoomControl>
                                            <BaseTiles />
                                            <FitBounds positions={viewRoutePositions} />
                                            {viewOsrmRoute.length > 1 && <Polyline positions={viewOsrmRoute} pathOptions={{ color: '#7950f2', weight: 4, opacity: 0.75, dashArray: '8,4' }} />}
                                            {viewOsrmRoute.length === 0 && viewRoutePositions.length > 1 && <Polyline positions={viewRoutePositions} pathOptions={{ color: '#7950f2', weight: 3, opacity: 0.5 }} />}
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
                                <div style={{
                                    width: isMobile ? '100%' : 240,
                                    height: isMobile ? 'auto' : 520,
                                    overflowY: 'auto',
                                    borderLeft: isMobile ? 'none' : '1px solid var(--app-border)',
                                    borderTop: isMobile ? '1px solid var(--app-border)' : 'none',
                                    padding: 8
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <Text type="secondary" strong style={{ fontSize: 11, marginBottom: 4 }}>ORDEN DE PARADAS</Text>
                                        {(viewTarget.fichas || []).map((f: any, idx: number) => (
                                            <div
                                                key={f.id_fichaingresoservicio ?? idx}
                                                style={{
                                                    padding: 8, borderRadius: 6,
                                                    border: `1px solid ${f.lat !== null ? 'var(--app-border)' : '#ffa8a8'}`,
                                                    backgroundColor: f.lat !== null ? undefined : 'rgba(224,49,49,0.05)',
                                                }}
                                            >
                                                <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
                                                    <div style={{
                                                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                                        backgroundColor: f.lat !== null ? '#7048e8' : '#e03131', color: '#fff',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Text style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{f.orden ?? idx + 1}</Text>
                                                    </div>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <Text strong style={{ fontSize: 12, color: '#1864ab', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>#{f.id_fichaingresoservicio}</Text>
                                                        <Text type="secondary" style={{ fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{f.centro || '-'}</Text>
                                                        {f.lat === null && <Text type="danger" style={{ fontSize: 10 }}>Sin coordenadas</Text>}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ maxHeight: 520, overflowY: 'auto', padding: 16 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {(viewTarget.fichas && viewTarget.fichas.length > 0) ? viewTarget.fichas.map((f: any, idx: number) => (
                                        <div key={f.id_fichaingresoservicio ?? idx} style={{ padding: 10, borderRadius: 6, border: '1px solid var(--app-border)' }}>
                                            <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
                                                <div style={{
                                                    width: 20, height: 20, borderRadius: '50%', backgroundColor: '#7048e8', color: '#fff',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                }}>
                                                    <Text style={{ fontSize: 10, fontWeight: 700, color: '#fff' }}>{f.orden ?? idx + 1}</Text>
                                                </div>
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                        <Text strong style={{ fontSize: 12, color: '#1864ab' }}>#{f.id_fichaingresoservicio}</Text>
                                                        {f.frecuencia_correlativo && <Tag color="blue">{f.frecuencia_correlativo}</Tag>}
                                                        {f.lat === null && <Tag color="red">Sin coord.</Tag>}
                                                    </div>
                                                    {f.centro && <Text type="secondary" style={{ fontSize: 12 }}>{f.centro}</Text>}
                                                    {f.empresa_servicio && <Text type="secondary" style={{ fontSize: 10 }}>{f.empresa_servicio}</Text>}
                                                </div>
                                            </div>
                                        </div>
                                    )) : <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', display: 'block', padding: '16px 0' }}>Sin fichas registradas.</Text>}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16, borderTop: '1px solid var(--app-border)' }}>
                            <Button onClick={() => { setViewTarget(null); setViewOsrmRoute([]); }}>Cerrar</Button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* ── ASIGNAR GRUPO MODAL ─────────────────────────────────────────── */}
            <Modal
                open={grupoTarget !== null}
                onCancel={() => setGrupoTarget(null)}
                footer={null}
                width={420}
                centered
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconFolder size={20} color="#0c8599" />
                        <Text strong style={{ fontSize: 16 }}>{grupoTarget?.id_grupo ? 'Cambiar grupo' : 'Añadir a grupo'}</Text>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                        Ruta: <Text strong>{grupoTarget?.nombre}</Text>
                    </Text>
                    <Field label="Grupo" hint="Selecciona un grupo o deja vacío para quitar de cualquier grupo">
                        <Select
                            placeholder="Sin grupo"
                            options={grupos.map(g => ({ value: String(g.id_grupo), label: g.nombre_grupo }))}
                            value={grupoTargetValue ?? undefined}
                            onChange={(v) => setGrupoTargetValue(v ?? null)}
                            allowClear
                            showSearch
                            style={{ width: '100%' }}
                        />
                    </Field>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setGrupoTarget(null)}>Cancelar</Button>
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#0c8599' }}
                            icon={<IconCheck size={16} />}
                            onClick={handleGuardarGrupo}
                            loading={grupoSaving}
                        >
                            Guardar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── CLONAR RUTA MODAL ───────────────────────────────────────────── */}
            <Modal
                open={clonarTarget !== null}
                onCancel={() => setClonarTarget(null)}
                footer={null}
                width={460}
                centered
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconCopy size={20} color="#e8590c" />
                        <Text strong style={{ fontSize: 16 }}>Clonar Ruta</Text>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <Field label="Nombre de la copia *">
                        <Input
                            value={clonarNombre}
                            onChange={e => setClonarNombre(e.target.value)}
                            autoFocus
                            placeholder="Nombre para la nueva ruta..."
                        />
                    </Field>
                    <Field label="Grupo" hint="Deja vacío para clonar sin grupo">
                        <Select
                            placeholder="Sin grupo"
                            options={grupos.map(g => ({ value: String(g.id_grupo), label: g.nombre_grupo }))}
                            value={clonarGrupo ?? undefined}
                            onChange={(v) => setClonarGrupo(v ?? null)}
                            allowClear
                            showSearch
                            style={{ width: '100%' }}
                        />
                    </Field>

                    {/* Advertencia fichas agotadas */}
                    {clonarLoadingFichas && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <Spin size="small" />
                            <Text type="secondary" style={{ fontSize: 12 }}>Verificando disponibilidad de correlativos...</Text>
                        </div>
                    )}
                    {!clonarLoadingFichas && clonarFichasAgotadas.length > 0 && (
                        <Alert
                            type="warning"
                            showIcon
                            icon={<IconAlertCircle size={16} />}
                            message={`${clonarFichasAgotadas.length} ficha${clonarFichasAgotadas.length > 1 ? 's' : ''} sin correlativos disponibles`}
                            description={
                                <div>
                                    <Text style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                                        Las siguientes fichas no tienen servicios pendientes. La copia las incluirá pero no podrán ejecutarse hasta que tengan nuevos correlativos:
                                    </Text>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {clonarFichasAgotadas.map(f => (
                                            <Text key={f.id} strong style={{ fontSize: 12 }}>• #{f.id} — {f.centro}</Text>
                                        ))}
                                    </div>
                                </div>
                            }
                        />
                    )}
                    {!clonarLoadingFichas && clonarFichasAgotadas.length === 0 && clonarTarget && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#0c8599' }}>
                            <IconCheck size={14} />
                            <Text style={{ fontSize: 12, color: '#0c8599' }}>Todas las fichas tienen correlativos disponibles.</Text>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setClonarTarget(null)}>Cancelar</Button>
                        <Button
                            type="primary"
                            style={{ backgroundColor: '#e8590c' }}
                            icon={<IconCopy size={16} />}
                            onClick={handleClonarConfirm}
                            loading={clonarConfirming}
                            disabled={!clonarNombre.trim()}
                        >
                            Clonar
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* ── DELETE MODAL ────────────────────────────────────────────────── */}
            <Modal open={deleteTarget !== null} onCancel={() => setDeleteTarget(null)} footer={null} width={420} centered title={<Text strong style={{ fontSize: 16 }}>Confirmar Eliminación</Text>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <Text style={{ fontSize: 13 }}>¿Estás seguro de eliminar la ruta <Text strong>"{deleteTarget?.nombre}"</Text>?</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>Las fichas no serán eliminadas, solo la planificación de la ruta.</Text>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <Button onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button danger type="primary" icon={<IconTrash size={16} />} onClick={handleDeleteConfirm} loading={deleting}>Eliminar</Button>
                    </div>
                </div>
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
                        open={ejecucionGrupoTarget !== null}
                        onCancel={() => grupoExecFase !== 'executing' && setEjecucionGrupoTarget(null)}
                        maskClosable={grupoExecFase !== 'executing'}
                        keyboard={grupoExecFase !== 'executing'}
                        closable={grupoExecFase !== 'executing'}
                        footer={null}
                        width={680}
                        centered
                        title={
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <IconPlayerPlay size={18} color="#2f9e44" />
                                <Text strong>Ejecutar grupo: {ejecucionGrupoTarget.nombre}</Text>
                                <Tag>{ejecucionGrupoTarget.rutas.length} rutas</Tag>
                            </div>
                        }
                    >
                        {/* ── FASE SETUP ── */}
                        {grupoExecFase === 'setup' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                                <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 12, backgroundColor: 'var(--app-hover-bg)' }}>
                                    {grupoExecLoadingMuest ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 8 }}><Spin size="small" /></div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                                                <Field label="Fecha de muestreo *">
                                                    <Input
                                                        type="date"
                                                        value={grupoExecFecha}
                                                        onChange={e => setGrupoExecFecha(e.target.value)}
                                                        prefix={<IconCalendarEvent size={15} style={{ color: 'var(--app-text-secondary)' }} />}
                                                    />
                                                </Field>
                                                <Field label="Muestreador Instalación *">
                                                    <Select
                                                        options={muestOptions}
                                                        value={grupoExecMuestInst ?? undefined}
                                                        onChange={v => { setGrupoExecMuestInst(v); if (!grupoExecMuestRet) setGrupoExecMuestRet(v); }}
                                                        showSearch
                                                        allowClear
                                                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                                        placeholder="Seleccionar..."
                                                        style={{ width: '100%' }}
                                                    />
                                                </Field>
                                                <Field label="Muestreador Retiro" hint="Solo compuestas. Si se omite, se usa el de instalación (en puntuales no aplica).">
                                                    <Select
                                                        options={muestOptions}
                                                        value={grupoExecMuestRet ?? undefined}
                                                        onChange={(v) => setGrupoExecMuestRet(v ?? null)}
                                                        showSearch
                                                        allowClear
                                                        filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                                                        placeholder="Igual al de instalación"
                                                        style={{ width: '100%' }}
                                                    />
                                                </Field>
                                            </div>
                                            <Field label="Observaciones">
                                                <Input
                                                    placeholder="Opcional — se aplicará a todas las rutas"
                                                    value={grupoExecObs}
                                                    onChange={e => setGrupoExecObs(e.target.value)}
                                                />
                                            </Field>
                                        </div>
                                    )}
                                </div>

                                <Text type="secondary" strong style={{ fontSize: 11 }}>RUTAS A EJECUTAR</Text>
                                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {ejecucionGrupoTarget.rutas.map(r => (
                                            <div key={r.id_ruta_planificada} style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 8 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap' }}>
                                                        <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: 'var(--app-accent-bg)', color: '#1677ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <IconRoute size={12} />
                                                        </div>
                                                        <Text style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre_ruta}</Text>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
                                                        <Tag color="blue">{r.cantidad_fichas} fichas</Tag>
                                                        <Tag color={getEstadoColor(getEstadoDinamico(r))}>{getEstadoDinamico(r)}</Tag>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                    <Button onClick={() => setEjecucionGrupoTarget(null)}>Cancelar</Button>
                                    <Button
                                        type="primary"
                                        style={{ backgroundColor: '#2f9e44' }}
                                        icon={<IconPlayerPlay size={16} />}
                                        onClick={handleEjecutarGrupo}
                                        disabled={!grupoExecFecha || !grupoExecMuestInst || grupoExecLoadingMuest}
                                    >
                                        Ejecutar {ejecucionGrupoTarget.rutas.length} rutas
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* ── FASE EXECUTING / DONE ── */}
                        {(grupoExecFase === 'executing' || grupoExecFase === 'done') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                                {grupoExecFase === 'executing' && (
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#1c7ed6' }}>
                                        <Spin size="small" />
                                        <Text style={{ fontSize: 13, color: '#1c7ed6' }}>Ejecutando rutas... no cierres esta ventana.</Text>
                                    </div>
                                )}
                                {grupoExecFase === 'done' && (
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {exitosos > 0 && <Tag color="green">{exitosos} exitosas</Tag>}
                                        {fallidos > 0 && <Tag color="red">{fallidos} con error</Tag>}
                                        {pendientes === 0 && <Text type="secondary" style={{ fontSize: 13 }}>Proceso finalizado.</Text>}
                                    </div>
                                )}

                                <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {grupoExecResultados.map(r => {
                                            const color = r.status === 'success' ? '#2f9e44' : r.status === 'error' ? '#e03131' : r.status === 'loading' ? '#1c7ed6' : 'var(--app-text-secondary)';
                                            return (
                                                <div
                                                    key={r.rutaId}
                                                    style={{
                                                        border: '1px solid var(--app-border)', borderRadius: 6, padding: 8,
                                                        backgroundColor: r.status === 'success' ? 'rgba(47,158,68,0.05)' : r.status === 'error' ? 'rgba(224,49,49,0.05)' : undefined,
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'nowrap', flex: 1, minWidth: 0 }}>
                                                            <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: `${color}22`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                                {r.status === 'loading' ? <Spin size="small" /> :
                                                                 r.status === 'success' ? <IconCheck size={11} /> :
                                                                 r.status === 'error' ? <IconX size={11} /> :
                                                                 <IconRoute size={11} />}
                                                            </div>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <Text strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{r.rutaNombre}</Text>
                                                                {r.status === 'error' && r.error && (
                                                                    <Text type="danger" style={{ fontSize: 10 }}>{r.error}</Text>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Tag color={r.status === 'success' ? 'green' : r.status === 'error' ? 'red' : r.status === 'loading' ? 'blue' : 'default'}>
                                                            {r.status === 'success' ? 'Listo' : r.status === 'error' ? 'Error' : r.status === 'loading' ? 'Ejecutando...' : 'Pendiente'}
                                                        </Tag>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {grupoExecFase === 'done' && (
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button onClick={() => setEjecucionGrupoTarget(null)}>Cerrar</Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Modal>
                );
            })()}

            {/* ── HISTORIAL EJECUCIONES ────────────────────────────────────────── */}
            <Modal
                open={histTarget !== null}
                onCancel={() => { setHistTarget(null); setHistEjecuciones([]); }}
                footer={null}
                width={640}
                centered
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconHistory size={20} color="#0c8599" />
                        <Text strong style={{ fontSize: 16 }}>Historial de Ejecuciones</Text>
                        {histTarget && <Tag color="blue">{histTarget.nombre}</Tag>}
                    </div>
                }
            >
                {histLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spin /></div>
                ) : histEjecuciones.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '32px 0' }}>
                        <IconHistory size={40} color="var(--app-text-secondary)" />
                        <Text type="secondary" style={{ fontSize: 13 }}>Sin ejecuciones registradas.</Text>
                    </div>
                ) : (
                    <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
                            {histEjecuciones.map((e: any) => (
                                <div key={e.id_ejecucion} style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                        <div>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                                <Tag color="green">{e.estado}</Tag>
                                                <Text strong style={{ fontSize: 12 }}>
                                                    {e.fecha_ejecucion ? new Date(e.fecha_ejecucion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                </Text>
                                                <Tag color="blue">{e.cantidad_fichas} fichas</Tag>
                                            </div>
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                Inst: <strong>{e.muestreador_inst || '-'}</strong>
                                                {e.muestreador_ret && e.muestreador_ret !== e.muestreador_inst && <> · Ret: <strong>{e.muestreador_ret}</strong></>}
                                            </Text>
                                            {e.observaciones && <Text type="secondary" italic style={{ fontSize: 10, display: 'block' }}>{e.observaciones}</Text>}
                                        </div>
                                        <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>#{e.id_ejecucion}</Text>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                    <Button onClick={() => { setHistTarget(null); setHistEjecuciones([]); }}>Cerrar</Button>
                </div>
            </Modal>

            {/* ── GESTIÓN DE GRUPOS MODAL ──────────────────────────────────────── */}
            <Modal
                open={showGruposModal}
                onCancel={() => { setShowGruposModal(false); setEditandoGrupo(null); setNuevoGrupoNombre(''); setNuevoGrupoDesc(''); }}
                footer={null}
                width={560}
                centered
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconFolderPlus size={20} color="#1c7ed6" />
                        <Text strong style={{ fontSize: 16 }}>Gestión de Grupos</Text>
                    </div>
                }
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    {/* Form crear/editar grupo */}
                    <div style={{ border: '1px solid var(--app-border)', borderRadius: 8, padding: 12, backgroundColor: 'var(--app-hover-bg)' }}>
                        <Text type="secondary" strong style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>{editandoGrupo ? 'EDITAR GRUPO' : 'NUEVO GRUPO'}</Text>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <Input
                                placeholder="Nombre del grupo (ej: Chiloé, Puerto Montt)"
                                value={nuevoGrupoNombre}
                                onChange={e => setNuevoGrupoNombre(e.target.value)}
                            />
                            <TextArea
                                placeholder="Descripción opcional"
                                value={nuevoGrupoDesc}
                                onChange={e => setNuevoGrupoDesc(e.target.value)}
                                rows={2}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                {editandoGrupo && (
                                    <Button type="text" size="small" onClick={() => { setEditandoGrupo(null); setNuevoGrupoNombre(''); setNuevoGrupoDesc(''); }}>
                                        Cancelar
                                    </Button>
                                )}
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={editandoGrupo ? <IconCheck size={14} /> : <IconPlus size={14} />}
                                    disabled={!nuevoGrupoNombre.trim()}
                                    loading={savingGrupo}
                                    onClick={handleSaveGrupo}
                                >
                                    {editandoGrupo ? 'Guardar cambios' : 'Crear grupo'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Lista de grupos */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {grupos.length === 0 ? (
                            <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', padding: '8px 0' }}>No hay grupos creados aún.</Text>
                        ) : grupos.map(g => (
                            <div key={g.id_grupo} style={{ border: '1px solid var(--app-border)', borderRadius: 6, padding: 10 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'nowrap' }}>
                                    <div>
                                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                            <IconFolder size={14} color="#4dabf7" />
                                            <Text strong style={{ fontSize: 13 }}>{g.nombre_grupo}</Text>
                                            <Tag>{g.cantidad_rutas || 0} rutas</Tag>
                                        </div>
                                        {g.descripcion && <Text type="secondary" style={{ fontSize: 12 }}>{g.descripcion}</Text>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 4 }}>
                                        <Button type="text" size="small" icon={<IconEdit size={14} color="#1c7ed6" />} onClick={() => { setEditandoGrupo(g); setNuevoGrupoNombre(g.nombre_grupo); setNuevoGrupoDesc(g.descripcion || ''); }} />
                                        <Button type="text" size="small" icon={<IconTrash size={14} color="#e03131" />} onClick={() => handleDeleteGrupo(g.id_grupo)} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 12, color: 'var(--app-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</Text>
            {children}
            {hint && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{hint}</Text>}
        </div>
    );
}
