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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { rutasPlanificadasService, type RutaPlanificada, type GrupoRuta } from '../services/rutasPlanificadas.service';
import { rutasEjecucionesService } from '../services/rutasEjecuciones.service';
import { fichaService } from '../services/ficha.service';
import { catalogosService } from '../services/catalogos.service';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { NuevaEjecucionModal } from './NuevaEjecucionModal';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive';

interface RutasListViewProps {
    onBackToMenu: () => void;
    onNuevaRuta: () => void;
    onEditarRuta?: (rutaId: number) => void;
}

const Spinner = ({ className }: { className?: string }) => (
    <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent', className)} />
);

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

    const getEstadoVariant = (estado: string): BadgeVariant => {
        switch (estado) {
            case 'ACTIVA': return 'success';
            case 'ASIGNADA': return 'secondary';
            case 'CANCELADA': return 'destructive';
            default: return 'outline';
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

    const grupoOptionsClearable = useMemo(() =>
        [{ value: '', label: 'Sin grupo' }, ...grupoOptions],
        [grupoOptions]
    );

    // ─── Render helpers ──────────────────────────────────────────────────────

    const resultadoVariant = (status: GrupoExecResultado['status']): BadgeVariant => {
        switch (status) {
            case 'success': return 'success';
            case 'error': return 'destructive';
            case 'loading': return 'default';
            default: return 'outline';
        }
    };

    const renderRutaRow = (r: RutaPlanificada) => (
        <TableRow key={r.id_ruta_planificada}>
            <TableCell className="text-xs text-muted-foreground">#{r.id_ruta_planificada}</TableCell>
            <TableCell>
                <div className="flex items-center gap-1.5">
                    <IconMapPin size={13} className="text-[#4dabf7]" />
                    <span className="text-[13px] font-semibold">{r.nombre_ruta}</span>
                </div>
                {r.descripcion && (
                    <span className="block max-w-[240px] truncate text-xs text-muted-foreground">{r.descripcion}</span>
                )}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{r.creador || 'Sistema'}</TableCell>
            <TableCell className="text-center">
                <Badge variant="outline">{r.cantidad_fichas}</Badge>
            </TableCell>
            <TableCell>
                <span className="block text-xs font-semibold">{r.total_ejecuciones || 0} ejecuciones</span>
                {r.ultima_ejecucion && (
                    <span className="text-[10px] text-muted-foreground">última: {formatDate(r.ultima_ejecucion)}</span>
                )}
            </TableCell>
            <TableCell>
                {(r.distancia_metros != null || r.duracion_segundos != null) ? (
                    <>
                        <span className="block text-xs font-semibold">{formatDistancia(r.distancia_metros)}</span>
                        <span className="text-[10px] text-muted-foreground">{formatDuracion(r.duracion_segundos)}</span>
                    </>
                ) : <span className="text-xs text-muted-foreground">—</span>}
            </TableCell>
            <TableCell>
                <Badge variant={getEstadoVariant(getEstadoDinamico(r))}>{getEstadoDinamico(r)}</Badge>
            </TableCell>
            <TableCell className="text-right">
                <div className="flex flex-nowrap justify-end gap-1">
                    {hasPermission('MA_RUTA_VER_DETALLE') && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-[#7048e8]" title="Ver detalle de la ruta" onClick={() => handleViewRuta(r)}>
                            <IconEye size={15} />
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#0c8599]" title="Historial de ejecuciones" onClick={() => handleViewHistorial(r)}>
                        <IconHistory size={15} />
                    </Button>
                    {r.estado !== 'CANCELADA' && (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[#2f9e44] hover:text-[#2f9e44]"
                            title="Nueva ejecución"
                            onClick={() => setEjecucionTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })}
                        >
                            <IconCalendarEvent size={13} /> Ejecutar
                        </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#1c7ed6]" title="Editar ruta" onClick={() => onEditarRuta ? onEditarRuta(r.id_ruta_planificada) : showToast({ type: 'info', message: 'Edición próximamente' })}>
                        <IconEdit size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#0c8599]" title={r.id_grupo ? 'Cambiar grupo' : 'Añadir a grupo'} onClick={() => handleOpenGrupo(r)}>
                        <IconFolder size={15} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-[#e8590c]" title="Clonar ruta" onClick={() => handleOpenClonar(r)}>
                        <IconCopy size={15} />
                    </Button>
                    {hasPermission('MA_RUTA_ELIMINAR') && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Eliminar ruta" onClick={() => setDeleteTarget({ id: r.id_ruta_planificada, nombre: r.nombre_ruta })}>
                            <IconTrash size={15} />
                        </Button>
                    )}
                </div>
            </TableCell>
        </TableRow>
    );

    // ─── JSX ─────────────────────────────────────────────────────────────────

    return (
        <div className="shadcn-scope flex w-full flex-col gap-4 p-4">
            <PageHeader
                title="Administrador de Rutas"
                subtitle="Gestiona y asigna las rutas planificadas de muestreo."
                onBack={onBackToMenu}
                breadcrumbItems={[
                    { label: 'Fichas de Ingreso', onClick: onBackToMenu },
                    { label: 'Rutas Planificadas' }
                ]}
                rightSection={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowGruposModal(true)}>
                            <IconFolder size={16} /> Grupos
                        </Button>
                        {hasPermission('MA_RUTA_CREAR') && (
                            <Button onClick={onNuevaRuta}>
                                <IconPlus size={16} /> Nueva Ruta
                            </Button>
                        )}
                    </div>
                }
            />

            {/* Filtros */}
            <div className="flex items-center gap-3">
                <div className="relative max-w-[320px] flex-1">
                    <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre o grupo..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className={cn('pl-8', searchTerm && 'pr-8')}
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <IconX size={12} />
                        </button>
                    )}
                </div>
                <Combobox
                    placeholder="Filtrar por grupo"
                    options={[{ value: 'sin-grupo', label: 'Sin grupo' }, ...grupoOptions]}
                    value={filterGrupo ?? ''}
                    onValueChange={(v) => setFilterGrupo(v || null)}
                    className="min-w-[180px]"
                />
                <Button variant="outline" onClick={fetchAll} disabled={loading}>
                    {loading ? <Spinner className="h-3.5 w-3.5" /> : <IconRefresh size={14} />}
                    Actualizar
                </Button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
                <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <IconRoute size={18} />
                    </div>
                    <div>
                        <h4 className="m-0 text-base font-semibold">Rutas Guardadas</h4>
                        <span className="text-xs text-muted-foreground">{filteredRutas.length} ruta{filteredRutas.length !== 1 ? 's' : ''} · {grupos.length} grupo{grupos.length !== 1 ? 's' : ''}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-8"><Spinner /></div>
                ) : filteredRutas.length === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-14">
                        <IconRoute size={48} className="text-muted-foreground" />
                        <div className="text-center">
                            <p className="font-semibold text-muted-foreground">No hay rutas{searchTerm ? ' que coincidan con la búsqueda' : ' guardadas'}</p>
                            {!searchTerm && <p className="text-[13px] text-muted-foreground">Haz clic en "Nueva Ruta" para comenzar.</p>}
                        </div>
                        {!searchTerm && hasPermission('MA_RUTA_CREAR') && (
                            <Button onClick={onNuevaRuta}><IconPlus size={14} /> Crear Primera Ruta</Button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {rutasByGroup.map(group => (
                            <div key={group.key}>
                                {/* Group header */}
                                <div
                                    className="flex cursor-pointer items-center gap-2 rounded-lg bg-muted/60 p-2 hover:bg-muted"
                                    onClick={() => toggleGroup(group.key)}
                                >
                                    {expandedGroups.has(group.key) ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                                    <div className={cn('flex h-[22px] w-[22px] items-center justify-center rounded-md', group.key === 'sin-grupo' ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary')}>
                                        <IconFolder size={12} />
                                    </div>
                                    <span className="text-[13px] font-semibold">{group.label}</span>
                                    <Badge variant="outline">{group.rutas.length} ruta{group.rutas.length !== 1 ? 's' : ''}</Badge>
                                    {group.key !== 'sin-grupo' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="ml-auto h-7 text-[#2f9e44] hover:text-[#2f9e44] disabled:text-muted-foreground"
                                            disabled={group.rutas.length === 0}
                                            title={group.rutas.length === 0
                                                ? 'Este grupo no tiene rutas asociadas'
                                                : `Ejecutar todas las rutas de "${group.label}"`}
                                            onClick={e => {
                                                e.stopPropagation();
                                                const grupoObj = grupos.find(g => String(g.id_grupo) === group.key);
                                                handleOpenEjecucionGrupo({ id: Number(group.key), nombre: grupoObj?.nombre_grupo || group.label, rutas: group.rutas });
                                            }}
                                        >
                                            <IconPlayerPlay size={12} /> Ejecutar grupo
                                        </Button>
                                    )}
                                    {/* R-08: para "Sin grupo", botón explícito para asignar todas las rutas a un grupo */}
                                    {group.key === 'sin-grupo' && group.rutas.length > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="ml-auto h-7 text-[#0c8599] hover:text-[#0c8599]"
                                            title="Asignar estas rutas a un grupo"
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
                                            <IconFolder size={12} />
                                            {group.rutas.length === 1 ? 'Asignar a grupo' : `${group.rutas.length} sin grupo — asignar`}
                                        </Button>
                                    )}
                                </div>

                                {expandedGroups.has(group.key) && (
                                    group.rutas.length === 0 ? (
                                        <p className="py-4 text-center text-[13px] italic text-muted-foreground">
                                            No hay rutas asociadas
                                        </p>
                                    ) : (
                                        <Table className="mt-1">
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-[50px]">ID</TableHead>
                                                    <TableHead>Nombre</TableHead>
                                                    <TableHead>Creador</TableHead>
                                                    <TableHead className="text-center">Fichas</TableHead>
                                                    <TableHead>Ejecuciones</TableHead>
                                                    <TableHead className="w-[110px]">Vehículo</TableHead>
                                                    <TableHead className="w-[100px]">Estado</TableHead>
                                                    <TableHead className="text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {group.rutas.map(renderRutaRow)}
                                            </TableBody>
                                        </Table>
                                    )
                                )}

                                <hr className="mt-2 border-t border-border" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── VIEW ROUTE DETAIL MODAL ─────────────────────────────────────── */}
            <Dialog open={viewTarget !== null} onOpenChange={(open) => { if (!open) { setViewTarget(null); setViewOsrmRoute([]); } }}>
                <DialogContent className="flex max-h-[90vh] w-[92vw] max-w-[1100px] flex-col gap-0 overflow-hidden p-0">
                    <DialogHeader className="border-b border-border px-4 py-3">
                        <DialogTitle className="flex items-center gap-2">
                            <IconRoute size={20} className="text-[#7048e8]" />
                            {viewTarget?.nombre_ruta || 'Detalle de Ruta'}
                            {viewTarget?.estado && (
                                <Badge variant={getEstadoVariant(getEstadoDinamico(viewTarget))}>
                                    {getEstadoDinamico(viewTarget)}
                                </Badge>
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {viewLoading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : viewTarget && (
                        <div className="flex flex-1 flex-col overflow-hidden">
                            <div className="flex items-center justify-between border-b border-border px-4 py-2">
                                <span className="text-xs text-muted-foreground">
                                    Creado por: <strong>{viewTarget.creador || 'Sistema'}</strong> ·
                                    {' '}<strong>{viewTarget.fichas?.filter((f: any) => f.lat !== null).length ?? 0}</strong> de <strong>{viewTarget.fichas?.length ?? viewTarget.cantidad_fichas ?? 0}</strong> fichas con ubicación
                                    {(viewTarget.distancia_metros != null || viewTarget.duracion_segundos != null) && (
                                        <> · 🚗 <strong>{formatDistancia(viewTarget.distancia_metros)}</strong> · ⏱ <strong>{formatDuracion(viewTarget.duracion_segundos)}</strong></>
                                    )}
                                    {viewTarget.descripcion && <> · <em>{viewTarget.descripcion}</em></>}
                                </span>
                                <Tabs value={viewTab} onValueChange={setViewTab}>
                                    <TabsList>
                                        <TabsTrigger value="mapa"><IconMap size={13} className="mr-1" />Mapa</TabsTrigger>
                                        <TabsTrigger value="lista"><IconList size={13} className="mr-1" />Lista</TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {viewTab === 'mapa' ? (
                                    <div className={cn('flex', isMobile ? 'flex-col' : 'flex-row', isMobile ? 'h-auto' : 'h-[520px]')}>
                                        <div className={cn('relative', isMobile ? 'h-[350px]' : 'flex-1')}>
                                            {viewRoutePositions.length === 0 ? (
                                                <div className="flex h-full items-center justify-center">
                                                    <div className="flex flex-col items-center gap-2">
                                                        <IconMapPin size={40} className="text-muted-foreground" />
                                                        <span className="text-[13px] text-muted-foreground">Ninguna ficha tiene coordenadas registradas.</span>
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
                                        <div className={cn('overflow-y-auto p-2', isMobile ? 'w-full border-t border-border' : 'h-[520px] w-[240px] border-l border-border')}>
                                            <div className="flex flex-col gap-2">
                                                <span className="mb-1 text-[11px] font-semibold text-muted-foreground">ORDEN DE PARADAS</span>
                                                {(viewTarget.fichas || []).map((f: any, idx: number) => (
                                                    <div
                                                        key={f.id_fichaingresoservicio ?? idx}
                                                        className={cn('rounded-md border p-2', f.lat !== null ? 'border-border' : 'border-destructive/40 bg-destructive/5')}
                                                    >
                                                        <div className="flex flex-nowrap gap-2">
                                                            <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white', f.lat !== null ? 'bg-[#7048e8]' : 'bg-destructive')}>
                                                                <span className="text-[10px] font-bold text-white">{f.orden ?? idx + 1}</span>
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="block truncate text-xs font-semibold text-primary">#{f.id_fichaingresoservicio}</span>
                                                                <span className="block truncate text-[10px] text-muted-foreground">{f.centro || '-'}</span>
                                                                {f.lat === null && <span className="text-[10px] text-destructive">Sin coordenadas</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="max-h-[520px] overflow-y-auto p-4">
                                        <div className="flex flex-col gap-2">
                                            {(viewTarget.fichas && viewTarget.fichas.length > 0) ? viewTarget.fichas.map((f: any, idx: number) => (
                                                <div key={f.id_fichaingresoservicio ?? idx} className="rounded-md border border-border p-2.5">
                                                    <div className="flex flex-nowrap gap-2">
                                                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#7048e8] text-white">
                                                            <span className="text-[10px] font-bold text-white">{f.orden ?? idx + 1}</span>
                                                        </div>
                                                        <div className="flex flex-1 flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-semibold text-primary">#{f.id_fichaingresoservicio}</span>
                                                                {f.frecuencia_correlativo && <Badge variant="outline">{f.frecuencia_correlativo}</Badge>}
                                                                {f.lat === null && <Badge variant="destructive">Sin coord.</Badge>}
                                                            </div>
                                                            {f.centro && <span className="text-xs text-muted-foreground">{f.centro}</span>}
                                                            {f.empresa_servicio && <span className="text-[10px] text-muted-foreground">{f.empresa_servicio}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : <p className="py-4 text-center text-[13px] text-muted-foreground">Sin fichas registradas.</p>}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="flex justify-end border-t border-border p-4">
                                <Button variant="outline" onClick={() => { setViewTarget(null); setViewOsrmRoute([]); }}>Cerrar</Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── ASIGNAR GRUPO MODAL ─────────────────────────────────────────── */}
            <Dialog open={grupoTarget !== null} onOpenChange={(open) => !open && setGrupoTarget(null)}>
                <DialogContent className="max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconFolder size={20} className="text-[#0c8599]" />
                            {grupoTarget?.id_grupo ? 'Cambiar grupo' : 'Añadir a grupo'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px] text-muted-foreground">
                            Ruta: <span className="font-semibold text-foreground">{grupoTarget?.nombre}</span>
                        </p>
                        <Field label="Grupo" hint="Selecciona un grupo o deja vacío para quitar de cualquier grupo">
                            <Combobox
                                placeholder="Sin grupo"
                                options={grupoOptionsClearable}
                                value={grupoTargetValue ?? ''}
                                onValueChange={(v) => setGrupoTargetValue(v || null)}
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGrupoTarget(null)}>Cancelar</Button>
                        <Button
                            className="bg-[#0c8599] text-white hover:bg-[#0c8599]/90"
                            onClick={handleGuardarGrupo}
                            disabled={grupoSaving}
                        >
                            {grupoSaving ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <IconCheck size={16} />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── CLONAR RUTA MODAL ───────────────────────────────────────────── */}
            <Dialog open={clonarTarget !== null} onOpenChange={(open) => !open && setClonarTarget(null)}>
                <DialogContent className="max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconCopy size={20} className="text-[#e8590c]" />
                            Clonar Ruta
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <Field label="Nombre de la copia *">
                            <Input
                                value={clonarNombre}
                                onChange={e => setClonarNombre(e.target.value)}
                                autoFocus
                                placeholder="Nombre para la nueva ruta..."
                            />
                        </Field>
                        <Field label="Grupo" hint="Deja vacío para clonar sin grupo">
                            <Combobox
                                placeholder="Sin grupo"
                                options={grupoOptionsClearable}
                                value={clonarGrupo ?? ''}
                                onValueChange={(v) => setClonarGrupo(v || null)}
                            />
                        </Field>

                        {/* Advertencia fichas agotadas */}
                        {clonarLoadingFichas && (
                            <div className="flex items-center gap-2">
                                <Spinner className="h-4 w-4" />
                                <span className="text-xs text-muted-foreground">Verificando disponibilidad de correlativos...</span>
                            </div>
                        )}
                        {!clonarLoadingFichas && clonarFichasAgotadas.length > 0 && (
                            <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
                                <IconAlertCircle size={16} className="mt-0.5 shrink-0 text-warning" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-foreground">
                                        {clonarFichasAgotadas.length} ficha{clonarFichasAgotadas.length > 1 ? 's' : ''} sin correlativos disponibles
                                    </p>
                                    <p className="mb-1 text-xs text-muted-foreground">
                                        Las siguientes fichas no tienen servicios pendientes. La copia las incluirá pero no podrán ejecutarse hasta que tengan nuevos correlativos:
                                    </p>
                                    <div className="flex flex-col gap-0.5">
                                        {clonarFichasAgotadas.map(f => (
                                            <span key={f.id} className="text-xs font-semibold text-foreground">• #{f.id} — {f.centro}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                        {!clonarLoadingFichas && clonarFichasAgotadas.length === 0 && clonarTarget && (
                            <div className="flex items-center gap-2 text-[#0c8599]">
                                <IconCheck size={14} />
                                <span className="text-xs">Todas las fichas tienen correlativos disponibles.</span>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setClonarTarget(null)}>Cancelar</Button>
                        <Button
                            className="bg-[#e8590c] text-white hover:bg-[#e8590c]/90"
                            onClick={handleClonarConfirm}
                            disabled={clonarConfirming || !clonarNombre.trim()}
                        >
                            {clonarConfirming ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <IconCopy size={16} />}
                            Clonar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── DELETE MODAL ────────────────────────────────────────────────── */}
            <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Confirmar Eliminación</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px]">¿Estás seguro de eliminar la ruta <span className="font-semibold">"{deleteTarget?.nombre}"</span>?</p>
                        <p className="text-xs text-muted-foreground">Las fichas no serán eliminadas, solo la planificación de la ruta.</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDeleteConfirm} disabled={deleting}>
                            {deleting ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <IconTrash size={16} />}
                            Eliminar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                    <Dialog
                        open={ejecucionGrupoTarget !== null}
                        onOpenChange={(open) => { if (!open && grupoExecFase !== 'executing') setEjecucionGrupoTarget(null); }}
                    >
                        <DialogContent
                            className="max-h-[85vh] max-w-[680px] overflow-y-auto"
                            onInteractOutside={(e) => { if (grupoExecFase === 'executing') e.preventDefault(); }}
                            onEscapeKeyDown={(e) => { if (grupoExecFase === 'executing') e.preventDefault(); }}
                        >
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <IconPlayerPlay size={18} className="text-[#2f9e44]" />
                                    Ejecutar grupo: {ejecucionGrupoTarget.nombre}
                                    <Badge variant="outline">{ejecucionGrupoTarget.rutas.length} rutas</Badge>
                                </DialogTitle>
                            </DialogHeader>

                            {/* ── FASE SETUP ── */}
                            {grupoExecFase === 'setup' && (
                                <div className="flex flex-col gap-4">
                                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                                        {grupoExecLoadingMuest ? (
                                            <div className="flex justify-center py-2"><Spinner className="h-4 w-4" /></div>
                                        ) : (
                                            <div className="flex flex-col gap-3">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <Field label="Fecha de muestreo *">
                                                        <Input
                                                            type="date"
                                                            value={grupoExecFecha}
                                                            onChange={e => setGrupoExecFecha(e.target.value)}
                                                        />
                                                    </Field>
                                                    <Field label="Muestreador Instalación *">
                                                        <Combobox
                                                            placeholder="Seleccionar..."
                                                            searchPlaceholder="Buscar muestreador..."
                                                            options={muestOptions}
                                                            value={grupoExecMuestInst ?? ''}
                                                            onValueChange={v => { setGrupoExecMuestInst(v || null); if (!grupoExecMuestRet) setGrupoExecMuestRet(v || null); }}
                                                        />
                                                    </Field>
                                                    <Field label="Muestreador Retiro" hint="Solo compuestas. Si se omite, se usa el de instalación (en puntuales no aplica).">
                                                        <Combobox
                                                            placeholder="Igual al de instalación"
                                                            searchPlaceholder="Buscar muestreador..."
                                                            options={muestOptions}
                                                            value={grupoExecMuestRet ?? ''}
                                                            onValueChange={(v) => setGrupoExecMuestRet(v || null)}
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

                                    <span className="text-[11px] font-semibold text-muted-foreground">RUTAS A EJECUTAR</span>
                                    <div className="max-h-[240px] overflow-y-auto">
                                        <div className="flex flex-col gap-2">
                                            {ejecucionGrupoTarget.rutas.map(r => (
                                                <div key={r.id_ruta_planificada} className="rounded-md border border-border p-2">
                                                    <div className="flex flex-nowrap justify-between">
                                                        <div className="flex flex-nowrap items-center gap-2">
                                                            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary/10 text-primary">
                                                                <IconRoute size={12} />
                                                            </div>
                                                            <span className="truncate text-[13px]">{r.nombre_ruta}</span>
                                                        </div>
                                                        <div className="flex flex-nowrap gap-2">
                                                            <Badge variant="outline">{r.cantidad_fichas} fichas</Badge>
                                                            <Badge variant={getEstadoVariant(getEstadoDinamico(r))}>{getEstadoDinamico(r)}</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setEjecucionGrupoTarget(null)}>Cancelar</Button>
                                        <Button
                                            className="bg-[#2f9e44] text-white hover:bg-[#2f9e44]/90"
                                            onClick={handleEjecutarGrupo}
                                            disabled={!grupoExecFecha || !grupoExecMuestInst || grupoExecLoadingMuest}
                                        >
                                            <IconPlayerPlay size={16} /> Ejecutar {ejecucionGrupoTarget.rutas.length} rutas
                                        </Button>
                                    </DialogFooter>
                                </div>
                            )}

                            {/* ── FASE EXECUTING / DONE ── */}
                            {(grupoExecFase === 'executing' || grupoExecFase === 'done') && (
                                <div className="flex flex-col gap-4">
                                    {grupoExecFase === 'executing' && (
                                        <div className="flex items-center gap-2 text-primary">
                                            <Spinner className="h-4 w-4" />
                                            <span className="text-[13px]">Ejecutando rutas... no cierres esta ventana.</span>
                                        </div>
                                    )}
                                    {grupoExecFase === 'done' && (
                                        <div className="flex gap-2">
                                            {exitosos > 0 && <Badge variant="success">{exitosos} exitosas</Badge>}
                                            {fallidos > 0 && <Badge variant="destructive">{fallidos} con error</Badge>}
                                            {pendientes === 0 && <span className="text-[13px] text-muted-foreground">Proceso finalizado.</span>}
                                        </div>
                                    )}

                                    <div className="max-h-[340px] overflow-y-auto">
                                        <div className="flex flex-col gap-2">
                                            {grupoExecResultados.map(r => (
                                                <div
                                                    key={r.rutaId}
                                                    className={cn(
                                                        'rounded-md border border-border p-2',
                                                        r.status === 'success' && 'bg-success/5',
                                                        r.status === 'error' && 'bg-destructive/5'
                                                    )}
                                                >
                                                    <div className="flex flex-nowrap justify-between">
                                                        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
                                                            <div className={cn(
                                                                'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full',
                                                                r.status === 'success' && 'bg-success/15 text-success',
                                                                r.status === 'error' && 'bg-destructive/15 text-destructive',
                                                                r.status === 'loading' && 'bg-primary/15 text-primary',
                                                                r.status === 'pending' && 'bg-muted text-muted-foreground'
                                                            )}>
                                                                {r.status === 'loading' ? <Spinner className="h-3.5 w-3.5" /> :
                                                                 r.status === 'success' ? <IconCheck size={11} /> :
                                                                 r.status === 'error' ? <IconX size={11} /> :
                                                                 <IconRoute size={11} />}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="block truncate text-xs font-semibold">{r.rutaNombre}</span>
                                                                {r.status === 'error' && r.error && (
                                                                    <span className="text-[10px] text-destructive">{r.error}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Badge variant={resultadoVariant(r.status)}>
                                                            {r.status === 'success' ? 'Listo' : r.status === 'error' ? 'Error' : r.status === 'loading' ? 'Ejecutando...' : 'Pendiente'}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {grupoExecFase === 'done' && (
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setEjecucionGrupoTarget(null)}>Cerrar</Button>
                                        </DialogFooter>
                                    )}
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                );
            })()}

            {/* ── HISTORIAL EJECUCIONES ────────────────────────────────────────── */}
            <Dialog open={histTarget !== null} onOpenChange={(open) => { if (!open) { setHistTarget(null); setHistEjecuciones([]); } }}>
                <DialogContent className="max-h-[85vh] max-w-[640px] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconHistory size={20} className="text-[#0c8599]" />
                            Historial de Ejecuciones
                            {histTarget && <Badge variant="outline">{histTarget.nombre}</Badge>}
                        </DialogTitle>
                    </DialogHeader>
                    {histLoading ? (
                        <div className="flex justify-center py-8"><Spinner /></div>
                    ) : histEjecuciones.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-8">
                            <IconHistory size={40} className="text-muted-foreground" />
                            <span className="text-[13px] text-muted-foreground">Sin ejecuciones registradas.</span>
                        </div>
                    ) : (
                        <div className="max-h-[400px] overflow-y-auto">
                            <div className="flex flex-col gap-2 p-2">
                                {histEjecuciones.map((e: any) => (
                                    <div key={e.id_ejecucion} className="rounded-md border border-border p-2.5">
                                        <div className="flex flex-nowrap justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="success">{e.estado}</Badge>
                                                    <span className="text-xs font-semibold">
                                                        {e.fecha_ejecucion ? new Date(e.fecha_ejecucion).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                                    </span>
                                                    <Badge variant="outline">{e.cantidad_fichas} fichas</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Inst: <span className="font-semibold">{e.muestreador_inst || '-'}</span>
                                                    {e.muestreador_ret && e.muestreador_ret !== e.muestreador_inst && <> · Ret: <span className="font-semibold">{e.muestreador_ret}</span></>}
                                                </p>
                                                {e.observaciones && <p className="block text-[10px] italic text-muted-foreground">{e.observaciones}</p>}
                                            </div>
                                            <span className="whitespace-nowrap text-[10px] text-muted-foreground">#{e.id_ejecucion}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setHistTarget(null); setHistEjecuciones([]); }}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── GESTIÓN DE GRUPOS MODAL ──────────────────────────────────────── */}
            <Dialog open={showGruposModal} onOpenChange={(open) => { if (!open) { setShowGruposModal(false); setEditandoGrupo(null); setNuevoGrupoNombre(''); setNuevoGrupoDesc(''); } }}>
                <DialogContent className="max-h-[85vh] max-w-[560px] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconFolderPlus size={20} className="text-[#1c7ed6]" />
                            Gestión de Grupos
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        {/* Form crear/editar grupo */}
                        <div className="rounded-lg border border-border bg-muted/40 p-3">
                            <span className="mb-2 block text-[11px] font-semibold text-muted-foreground">{editandoGrupo ? 'EDITAR GRUPO' : 'NUEVO GRUPO'}</span>
                            <div className="flex flex-col gap-2">
                                <Input
                                    placeholder="Nombre del grupo (ej: Chiloé, Puerto Montt)"
                                    value={nuevoGrupoNombre}
                                    onChange={e => setNuevoGrupoNombre(e.target.value)}
                                />
                                <Textarea
                                    placeholder="Descripción opcional"
                                    value={nuevoGrupoDesc}
                                    onChange={e => setNuevoGrupoDesc(e.target.value)}
                                    rows={2}
                                />
                                <div className="flex justify-end gap-2">
                                    {editandoGrupo && (
                                        <Button variant="ghost" size="sm" onClick={() => { setEditandoGrupo(null); setNuevoGrupoNombre(''); setNuevoGrupoDesc(''); }}>
                                            Cancelar
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        disabled={!nuevoGrupoNombre.trim() || savingGrupo}
                                        onClick={handleSaveGrupo}
                                    >
                                        {savingGrupo ? <Spinner className="h-3.5 w-3.5 border-white/40 border-t-white" /> : (editandoGrupo ? <IconCheck size={14} /> : <IconPlus size={14} />)}
                                        {editandoGrupo ? 'Guardar cambios' : 'Crear grupo'}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Lista de grupos */}
                        <div className="flex flex-col gap-2">
                            {grupos.length === 0 ? (
                                <p className="py-2 text-center text-[13px] text-muted-foreground">No hay grupos creados aún.</p>
                            ) : grupos.map(g => (
                                <div key={g.id_grupo} className="rounded-md border border-border p-2.5">
                                    <div className="flex flex-nowrap justify-between">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <IconFolder size={14} className="text-[#4dabf7]" />
                                                <span className="text-[13px] font-semibold">{g.nombre_grupo}</span>
                                                <Badge variant="outline">{g.cantidad_rutas || 0} rutas</Badge>
                                            </div>
                                            {g.descripcion && <span className="text-xs text-muted-foreground">{g.descripcion}</span>}
                                        </div>
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-[#1c7ed6]" onClick={() => { setEditandoGrupo(g); setNuevoGrupoNombre(g.nombre_grupo); setNuevoGrupoDesc(g.descripcion || ''); }}>
                                                <IconEdit size={14} />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGrupo(g.id_grupo)}>
                                                <IconTrash size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
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
