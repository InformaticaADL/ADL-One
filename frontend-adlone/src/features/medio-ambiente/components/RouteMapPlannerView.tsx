import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { BaseTiles } from './BaseTiles';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fichaService } from '../services/ficha.service';
import { rutasPlanificadasService } from '../services/rutasPlanificadas.service';
import type { GrupoRuta } from '../services/rutasPlanificadas.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { DatePicker } from '@/components/ui/date-picker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    IconRoute,
    IconMapPin,
    IconDeviceFloppy,
    IconSearch,
    IconEraser,
    IconTrash,
    IconArrowUp,
    IconArrowDown
} from '@tabler/icons-react';

// Fix Leaflet default marker icons
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

// Custom numbered marker icon
const createNumberedIcon = (number: number) => {
    return L.divIcon({
        className: 'custom-numbered-marker',
        html: `<div style="
            background: #228be6;
            color: white;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            border: 2px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${number}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
    });
};

const defaultIcon = L.divIcon({
    className: 'custom-default-marker',
    html: `<div style="
        background: #868e96;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        opacity: 0.7;
    ">●</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -10]
});

// Parse coordinates from Google Maps URLs
const parseGoogleMapsUrl = (url: string): { lat: number; lng: number } | null => {
    if (!url) return null;
    // Decodificar la URL para limpiar %2B(+) u otros
    const decodedUrl = decodeURIComponent(url);
    // 1. PIN EXACTO (!3d y !4d en data=) -> Máxima precisión
    const exactPinMatch = decodedUrl.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
    if (exactPinMatch) return { lat: parseFloat(exactPinMatch[1]), lng: parseFloat(exactPinMatch[2]) };

    // 2. Query param ?q= o ll=
    const qMatch = decodedUrl.match(/[?&](?:q|ll)=(-?\d+\.?\d*)\s*,\s*\+?(-?\d+\.?\d*)/);
    if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

    // 3. place/lat,lng (A veces lleva pin exacto si no hay data payload)
    const placeMatch = decodedUrl.match(/place\/(-?\d+\.?\d*)\s*,\s*\+?(-?\d+\.?\d*)/);
    if (placeMatch) return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };

    // 4. search/lat,lng
    const searchMatch = decodedUrl.match(/search\/(-?\d+\.?\d*)\s*,\s*\+?(-?\d+\.?\d*)/);
    if (searchMatch) return { lat: parseFloat(searchMatch[1]), lng: parseFloat(searchMatch[2]) };

    // 5. fallback: @lat,lng (Posición del viewport, menos precisa)
    const atMatch = decodedUrl.match(/@(-?\d+\.?\d*)\s*,\s*\+?(-?\d+\.?\d*)/);
    if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

    // 6. /dir/lat,lng
    const dirMatch = decodedUrl.match(/\/(-?\d+\.?\d*)\s*,\s*\+?(-?\d+\.?\d*)/);
    if (dirMatch) {
        const lat = parseFloat(dirMatch[1]);
        const lng = parseFloat(dirMatch[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    }
    return null;
};

// Component to auto-fit map bounds
const FitBounds: React.FC<{ positions: [number, number][] }> = ({ positions }) => {
    const map = useMap();
    useEffect(() => {
        if (positions.length > 0) {
            const bounds = L.latLngBounds(positions.map(p => L.latLng(p[0], p[1])));
            if (positions.length === 1) {
                map.setView(positions[0], 16); // Closer zoom for single item
            } else {
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
            }
        }
    }, [positions, map]);
    return null;
};

// Component to slide map to newly selected ficha if out of bounds
const MapFocusHandler: React.FC<{ selectedFichas: FichaWithCoords[] }> = ({ selectedFichas }) => {
    const map = useMap();
    useEffect(() => {
        if (selectedFichas.length > 0) {
            // Check the last selected ficha (it is appended to the end)
            const last = selectedFichas[selectedFichas.length - 1];
            if (last && last.lat !== null && last.lng !== null) {
                const latLng = L.latLng(last.lat, last.lng);
                if (!map.getBounds().contains(latLng)) {
                    map.panTo(latLng, { animate: true, duration: 0.5 });
                }
            }
        }
    }, [selectedFichas, map]);
    return null;
};

interface CorrelativoInfo {
    frecuencia_correlativo: string;
    numero_servicio: number;
    status: string; // DISPONIBLE | AGENDADO | EN_RUTA
    en_ruta: boolean;
    tiene_equipos?: boolean;
    tiene_resultados?: boolean;
}

interface FichaWithCoords {
    id: number;
    empresa_servicio: string;
    empresa_facturar: string;
    centro: string;
    objetivo: string;
    subarea: string;
    estado: string;
    ref_google: string;
    lat: number | null;
    lng: number | null;
    correlativo?: string;
    total_servicios: number;
    servicios_disponibles: number;
    servicios_en_ruta: number;
    servicios_ejecutados: number;
    correlativos: CorrelativoInfo[];
}

interface SelectedItem {
    fichaId: number;
    frecuencia_correlativo: string;
    numero_servicio: number;
}

interface ConfirmDialogState {
    title: string;
    content: React.ReactNode;
    okText?: string;
    cancelText?: string;
    onOk: () => void;
}

// Servicio por defecto al agregar una ficha: primero DISPONIBLE (no en otra ruta);
// si no hay, el primero AGENDADO (para reagendar). Los EN_RUTA quedan excluidos.
const pickDefaultCorrelativo = (corrs: CorrelativoInfo[]): CorrelativoInfo | undefined =>
    corrs.find(c => c.status === 'DISPONIBLE' && !c.en_ruta) || corrs.find(c => c.status === 'AGENDADO');

interface Props {
    onBack: () => void;
    editRutaId?: number | null;
}

export const RouteMapPlannerView: React.FC<Props> = ({ onBack, editRutaId }) => {
    const { showToast } = useToast();
    const { user } = useAuth();
    const { getCatalogo } = useCatalogos();

    // Data
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSavingBase, setIsSavingBase] = useState(false);
    const [nombreRuta, setNombreRuta] = useState('');
    const [descripcionRuta, setDescripcionRuta] = useState('');
    const [selectedGrupo, setSelectedGrupo] = useState<string | null>(null);
    const [grupos, setGrupos] = useState<GrupoRuta[]>([]);
    const [fichas, setFichas] = useState<FichaWithCoords[]>([]);
    const [muestreadores, setMuestreadores] = useState<any[]>([]);
    const [objetivosCat, setObjetivosCat] = useState<any[]>([]);

    // Filters
    const [searchText, setSearchText] = useState('');
    const [filterEmpresa, setFilterEmpresa] = useState<string | null>(null);
    const [filterObjetivo, setFilterObjetivo] = useState<string | null>(null);
    const [filterCentro, setFilterCentro] = useState<string | null>(null);

    // Route
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const selectedIds = useMemo(() => [...new Set(selectedItems.map(s => s.fichaId))], [selectedItems]);
    const [assignDate, setAssignDate] = useState('');
    const [assignMuestreadorInst, setAssignMuestreadorInst] = useState<string | null>(null);
    const [assignMuestreadorRet, setAssignMuestreadorRet] = useState<string | null>(null);
    const [assignObservacion, setAssignObservacion] = useState('');
    const [osrmRoute, setOsrmRoute] = useState<[number, number][]>([]);
    const [routeDistance, setRouteDistance] = useState<number | null>(null); // metros
    const [routeDuration, setRouteDuration] = useState<number | null>(null); // segundos

    // Generic confirmation dialog — replaces antd Modal.confirm (usado al
    // reagendar servicios que ya tienen equipos/resultados cargados).
    const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [fichasResponse, mData, oData, gruposData] = await Promise.all([
                    fichaService.getForAssignment(),
                    getCatalogo('muestreadores', () => catalogosService.getMuestreadores()),
                    getCatalogo('objetivos-muestreo', () => catalogosService.getObjetivosMuestreo()),
                    rutasPlanificadasService.getGrupos()
                ]);
                setGrupos(gruposData || []);

                let rawFichas: any[] = [];
                if (Array.isArray(fichasResponse)) rawFichas = fichasResponse;
                else if (fichasResponse?.data && Array.isArray(fichasResponse.data)) rawFichas = fichasResponse.data;
                else if (fichasResponse?.recordset) rawFichas = fichasResponse.recordset;

                // Filter only fichas that actually have available services
                rawFichas = rawFichas.filter((f: any) => {
                    return f.servicios_disponibles > 0;
                });

                // Resolve all unique goo.gl short URLs in one pass before processing fichas.
                // Many fichas share the same URL, so resolving once and reusing saves N×1s calls.
                const shortUrls = new Set<string>();
                rawFichas.forEach((f: any) => {
                    const u = f.ref_google || f.refGoogle || f.ma_ref_google || '';
                    if (u && u.includes('goo.gl')) shortUrls.add(u);
                });

                const resolvedUrlMap = new Map<string, string>();
                const CONCURRENCY = 5;
                const uniqueUrls = [...shortUrls];
                for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
                    const batch = uniqueUrls.slice(i, i + CONCURRENCY);
                    await Promise.all(batch.map(async (u) => {
                        try {
                            const resolved = await fichaService.resolveGoogleUrl(u);
                            if (resolved?.finalUrl) resolvedUrlMap.set(u, resolved.finalUrl);
                        } catch {
                            // keep original
                        }
                    }));
                }

                const parseFicha = (f: any): FichaWithCoords => {
                    let lat: number | null = null;
                    let lng: number | null = null;

                    const rawUrl = f.ref_google || f.refGoogle || f.ma_ref_google || '';
                    const googleUrl = (rawUrl && resolvedUrlMap.has(rawUrl)) ? resolvedUrlMap.get(rawUrl)! : rawUrl;

                    if (googleUrl) {
                        const coords = parseGoogleMapsUrl(googleUrl);
                        if (coords) { lat = coords.lat; lng = coords.lng; }
                    }

                    if (lat === null && f.latitud && f.longitud) {
                        lat = parseFloat(f.latitud);
                        lng = parseFloat(f.longitud);
                    }

                    if (lat === null && f.ma_coordenadas) {
                        const directCoords = parseGoogleMapsUrl('fake_url/' + f.ma_coordenadas);
                        if (directCoords) { lat = directCoords.lat; lng = directCoords.lng; }
                    }

                    return {
                        id: f.id_fichaingresoservicio || f.fichaingresoservicio,
                        empresa_servicio: f.empresa_servicio || f.nombre_empresaservicios || '-',
                        empresa_facturar: f.empresa_facturar || f.nombre_empresa || '-',
                        centro: f.centro || f.nombre_centro || '-',
                        objetivo: f.id_objetivomuestreo_ma || f.objetivo || f.nombre_objetivomuestreo || f.objetivo_muestreo || f.nombre_objetivo || '-',
                        subarea: f.subarea || f.nombre_subarea || '-',
                        estado: f.estado_ficha || f.nombre_estadomuestreo || '-',
                        ref_google: googleUrl,
                        lat,
                        lng,
                        correlativo: f.frecuencia_correlativo,
                        total_servicios: f.total_servicios || 0,
                        servicios_disponibles: f.servicios_disponibles || 0,
                        servicios_en_ruta: f.servicios_en_ruta || 0,
                        servicios_ejecutados: f.servicios_ejecutados || 0,
                        correlativos: (f.correlativos || []) as CorrelativoInfo[]
                    };
                };

                const parsedFichas: FichaWithCoords[] = rawFichas.map(parseFicha);

                setFichas(parsedFichas);
                if (mData) setMuestreadores(mData);
                if (oData) setObjetivosCat(oData);

                // If editing an existing route, pre-load its items
                if (editRutaId && parsedFichas.length > 0) {
                    try {
                        const ruta = await rutasPlanificadasService.getById(editRutaId);
                        if (ruta && ruta.fichas) {
                            const items: SelectedItem[] = ruta.fichas.map((rf: any) => {
                                const corrParts = (rf.frecuencia_correlativo || '').split('-');
                                const numSvc = corrParts.length >= 2 ? parseInt(corrParts[1], 10) : 1;
                                return {
                                    fichaId: rf.id_fichaingresoservicio,
                                    frecuencia_correlativo: rf.frecuencia_correlativo || '',
                                    numero_servicio: numSvc
                                };
                            });
                            setSelectedItems(items);
                            setNombreRuta(ruta.nombre_ruta || '');
                            setDescripcionRuta(ruta.descripcion || '');
                            if (ruta.id_grupo) setSelectedGrupo(String(ruta.id_grupo));
                            setIsSavingBase(true); // Pre-enter save mode for editing
                        }
                    } catch (e) {
                        console.warn('Could not load route for editing:', e);
                    }
                }
            } catch (error) {
                console.error("Error loading route planner data:", error);
                showToast({ type: 'error', message: 'Error al cargar datos para el planificador' });
            } finally {
                setLoading(false);
            }
        };
        loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleGuardarRutaBase = async () => {
        if (!nombreRuta) {
            showToast({ type: 'warning', message: 'Ingresa un nombre para la ruta' });
            return;
        }
        // Validar que todos los ítems tengan correlativo válido
        const itemsInvalidos = selectedItems.filter(i => !i.frecuencia_correlativo);
        if (itemsInvalidos.length > 0) {
            showToast({ type: 'error', message: `${itemsInvalidos.length} ficha(s) no tienen un correlativo válido seleccionado` });
            return;
        }
        setIsLoading(true);
        try {
            const payload = {
                nombre_ruta: nombreRuta,
                descripcion: descripcionRuta || undefined,
                id_grupo: selectedGrupo ? Number(selectedGrupo) : undefined,
                distancia_metros: routeDistance,
                duracion_segundos: routeDuration,
                fichas: selectedItems.map((item, index) => ({
                    id_fichaingresoservicio: item.fichaId,
                    orden: index + 1,
                    frecuencia_correlativo: item.frecuencia_correlativo
                }))
            };

            if (editRutaId) {
                await rutasPlanificadasService.update(editRutaId, payload);
            } else {
                await rutasPlanificadasService.create(payload);
            }
            showToast({ type: 'success', message: 'Ruta Base guardada exitosamente' });
            setIsSavingBase(false);
            setNombreRuta('');
            setDescripcionRuta('');
            setSelectedGrupo(null);
            setSelectedItems([]);
            setTimeout(() => onBack(), 1500); // return to list view
        } catch (error) {
            showToast({ type: 'error', message: 'Error al guardar la Ruta Base' });
        } finally {
            setIsLoading(false);
        }
    };

    // Filter fichas
    const getObjetivoName = useCallback((idStr: string) => {
        const obj = objetivosCat.find(o => String(o.id_objetivomuestreo_ma) === idStr || String(o.id) === idStr);
        return obj ? (obj.nombre_objetivomuestreo_ma || obj.nombre) : idStr;
    }, [objetivosCat]);

    const filteredFichas = useMemo(() => {
        return fichas.filter(f => {
            const text = searchText.toLowerCase();
            const matchText = !text ||
                String(f.id).includes(text) ||
                f.empresa_servicio.toLowerCase().includes(text) ||
                f.centro.toLowerCase().includes(text) ||
                f.empresa_facturar.toLowerCase().includes(text);
            const matchEmpresa = !filterEmpresa || f.empresa_servicio === filterEmpresa;
            const matchObjetivo = !filterObjetivo || String(f.objetivo) === filterObjetivo;
            const matchCentro = !filterCentro || f.centro === filterCentro;
            return matchText && matchEmpresa && matchObjetivo && matchCentro;
        });
    }, [fichas, searchText, filterEmpresa, filterObjetivo, filterCentro]);

    const uniqueEmpresas = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const matchObjetivo = !filterObjetivo || String(f.objetivo) === filterObjetivo;
            const matchCentro = !filterCentro || f.centro === filterCentro;
            if (matchObjetivo && matchCentro && f.empresa_servicio && f.empresa_servicio !== '-') {
                set.add(String(f.empresa_servicio));
            }
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas, filterObjetivo, filterCentro]);

    const uniqueCentros = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const matchEmpresa = !filterEmpresa || f.empresa_servicio === filterEmpresa;
            const matchObjetivo = !filterObjetivo || String(f.objetivo) === filterObjetivo;
            if (matchEmpresa && matchObjetivo && f.centro && f.centro !== '-') {
                set.add(String(f.centro));
            }
        });
        return Array.from(set).sort().map(v => ({ value: v, label: v }));
    }, [fichas, filterEmpresa, filterObjetivo]);

    const uniqueObjetivos = useMemo(() => {
        const set = new Set<string>();
        fichas.forEach(f => {
            const matchEmpresa = !filterEmpresa || f.empresa_servicio === filterEmpresa;
            const matchCentro = !filterCentro || f.centro === filterCentro;
            if (matchEmpresa && matchCentro && f.objetivo && f.objetivo !== '-') {
                set.add(String(f.objetivo));
            }
        });
        return Array.from(set).map(id => ({ value: id, label: getObjetivoName(id) })).sort((a, b) => a.label.localeCompare(b.label));
    }, [fichas, filterEmpresa, filterCentro, getObjetivoName]);

    const muestreadorOptions = useMemo(() =>
        muestreadores.map((m: any) => ({ value: String(m.id_muestreador), label: m.nombre_muestreador })),
        [muestreadores]
    );

    const selectedFichas = useMemo(() => {
        return selectedItems.map(item => fichas.find(f => f.id === item.fichaId)).filter(Boolean) as FichaWithCoords[];
    }, [selectedItems, fichas]);

    const fichasWithCoords = useMemo(() => fichas.filter(f => f.lat !== null && f.lng !== null), [fichas]);
    const routePositions = useMemo((): [number, number][] => {
        return selectedFichas
            .filter(f => f.lat !== null && f.lng !== null)
            .map(f => [f.lat!, f.lng!] as [number, number]);
    }, [selectedFichas]);

    const allPositions = useMemo((): [number, number][] => {
        return fichasWithCoords.map(f => [f.lat!, f.lng!] as [number, number]);
    }, [fichasWithCoords]);

    useEffect(() => {
        if (routePositions.length < 2) {
            setOsrmRoute([]);
            setRouteDistance(null);
            setRouteDuration(null);
            return;
        }
        const controller = new AbortController();
        const fetchRoute = async () => {
            try {
                const coordsStr = routePositions.map(p => `${p[1]},${p[0]}`).join(';');
                const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`, { signal: controller.signal });
                const data = await res.json();
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const route = data.routes[0];
                    setOsrmRoute(route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]));
                    setRouteDistance(typeof route.distance === 'number' ? Math.round(route.distance) : null);
                    setRouteDuration(typeof route.duration === 'number' ? Math.round(route.duration) : null);
                } else {
                    setOsrmRoute([]);
                    setRouteDistance(null);
                    setRouteDuration(null);
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    console.warn('OSRM routing fallback failed:', err);
                    setOsrmRoute([]);
                    setRouteDistance(null);
                    setRouteDuration(null);
                }
            }
        };
        fetchRoute();
        return () => controller.abort();
    }, [routePositions]);

    const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

    const toggleFicha = useCallback((id: number) => {
        // Pre-check outside the state updater to avoid double-toasts in React Strict Mode
        const isCurrentlySelected = selectedItems.some(s => s.fichaId === id);

        if (!isCurrentlySelected) {
            const ficha = fichas.find(f => f.id === id);
            if (ficha) {
                if (ficha.lat === null || ficha.lng === null) {
                    showToast({ type: 'warning', message: `La Ficha #${id} no tiene coordenadas válidas registradas. Actualice su ubicación primero.` });
                    return;
                }
                // Preferimos un servicio DISPONIBLE; si no hay, permitimos uno AGENDADO para reagendar.
                const selectable = pickDefaultCorrelativo(ficha.correlativos);
                if (!selectable && ficha.correlativos.length > 0) {
                    showToast({ type: 'warning', message: `Ficha #${id}: todos los servicios están en otra ruta y no hay ninguno disponible ni reagendable` });
                    return;
                }
            }
        }

        setSelectedItems(prev => {
            const existing = prev.findIndex(s => s.fichaId === id);
            if (existing >= 0) {
                return prev.filter(s => s.fichaId !== id);
            }

            const ficha = fichas.find(f => f.id === id);
            if (!ficha) return prev;

            const available = pickDefaultCorrelativo(ficha.correlativos);

            return [...prev, {
                fichaId: id,
                frecuencia_correlativo: available?.frecuencia_correlativo || '',
                numero_servicio: available?.numero_servicio || 1
            }];
        });
    }, [fichas, selectedItems, showToast]);

    const moveUp = (index: number) => {
        if (index === 0) return;
        setSelectedItems(prev => {
            const arr = [...prev];
            [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
            return arr;
        });
    };

    const moveDown = (index: number) => {
        setSelectedItems(prev => {
            if (index >= prev.length - 1) return prev;
            const arr = [...prev];
            [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
            return arr;
        });
    };

    const updateSelectedCorrelativo = (fichaId: number, frecuencia_correlativo: string) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.fichaId === fichaId) {
                const ficha = fichas.find(f => f.id === fichaId);
                const corr = ficha?.correlativos.find(c => c.frecuencia_correlativo === frecuencia_correlativo);
                return {
                    ...item,
                    frecuencia_correlativo,
                    numero_servicio: corr?.numero_servicio || item.numero_servicio
                };
            }
            return item;
        }));
    };

    const handleSaveRoute = async () => {
        if (selectedIds.length === 0) {
            showToast({ type: 'warning', message: 'Seleccione al menos una ficha para la ruta' });
            return;
        }
        if (!assignDate) {
            showToast({ type: 'warning', message: 'Debe seleccionar una fecha de muestreo' });
            return;
        }
        if (!assignMuestreadorInst) {
            showToast({ type: 'warning', message: 'Debe seleccionar un muestreador de instalación' });
            return;
        }
        // Validación de fecha pasada (paridad con AssignmentDetailView).
        if (assignDate < todayStr) {
            showToast({ type: 'error', message: 'La fecha de muestreo no puede ser anterior a hoy.' });
            return;
        }

        setSaving(true);
        try {
            const assignmentResults = await Promise.allSettled(
                selectedItems.map(item => fichaService.getAssignmentDetail(item.fichaId))
            );

            const assignments: any[] = [];
            const reagendaConDatos: string[] = [];
            const pastInstFichas: string[] = [];
            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i];
                const result = assignmentResults[i];

                if (result.status === 'rejected') {
                    showToast({ type: 'warning', message: `Ficha #${item.fichaId}: error al obtener agenda. Se omitirá.` });
                    continue;
                }

                const rows = result.value;

                if (!Array.isArray(rows) || rows.length === 0) {
                    showToast({ type: 'warning', message: `Ficha #${item.fichaId} no tiene registros de agenda pendientes. Se omitirá.` });
                    continue;
                }

                // A-09: si el usuario eligió un correlativo específico, DEBE coincidir exactamente.
                // No usar fallback silencioso (eso causaba que se guarde el servicio incorrecto).
                let pendingRow: any = null;
                if (item.frecuencia_correlativo) {
                    const normSel = String(item.frecuencia_correlativo).trim();
                    pendingRow = rows.find((r: any) => String(r.frecuencia_correlativo || '').trim() === normSel);
                    if (!pendingRow) {
                        showToast({
                            type: 'error',
                            message: `Ficha #${item.fichaId}: no se encontró el correlativo "${item.frecuencia_correlativo}" en la agenda. Se omitirá.`
                        });
                        continue;
                    }
                    // Un servicio EJECUTADO/CANCELADO/ANULADO nunca se puede (re)asignar. Los AGENDADO sí (reagendar).
                    const estado = String(pendingRow.nombre_estadomuestreo || '').toUpperCase();
                    if (estado.includes('EJECUTADO') || estado.includes('CANCELADO') || estado.includes('ANULADO')) {
                        showToast({
                            type: 'warning',
                            message: `Ficha #${item.fichaId} (${item.frecuencia_correlativo}): el servicio no es asignable (${pendingRow.nombre_estadomuestreo}). Se omitirá.`
                        });
                        continue;
                    }
                } else {
                    pendingRow = rows.find((r: any) => {
                        const estado = (r.nombre_estadomuestreo || '').toUpperCase();
                        return !estado.includes('EJECUTADO') && !estado.includes('CANCELADO') && !estado.includes('ANULADO');
                    });
                    if (!pendingRow) {
                        showToast({ type: 'warning', message: `Ficha #${item.fichaId}: no hay servicios disponibles. Se omitirá.` });
                        continue;
                    }
                }

                // ¿Es un reagendamiento? El servicio elegido ya estaba AGENDADO (con fecha previa).
                const fichaInfo = fichas.find(f => f.id === item.fichaId);
                const corrInfo = fichaInfo?.correlativos.find(c => c.frecuencia_correlativo === item.frecuencia_correlativo);
                const isReagenda = corrInfo?.status === 'AGENDADO';

                const dayOffset = Math.floor((Number(pendingRow.ma_duracion_muestreo) || 0) / 24);
                const instDate = dayOffset > 0
                    ? (() => { const d = new Date(assignDate + 'T00:00:00'); d.setDate(d.getDate() - dayOffset); return d.toISOString().split('T')[0]; })()
                    : assignDate;

                // La instalación (retiro − duración) no puede caer antes de hoy.
                if (instDate < todayStr) {
                    pastInstFichas.push(`#${item.fichaId} (${item.frecuencia_correlativo})`);
                    continue;
                }
                // Coherencia: instalación nunca posterior al muestreo/retiro (defensivo).
                if (instDate > assignDate) {
                    showToast({ type: 'error', message: `Ficha #${item.fichaId}: la fecha de instalación no puede ser posterior a la de muestreo. Se omitirá.` });
                    continue;
                }

                if (isReagenda && (corrInfo?.tiene_equipos || corrInfo?.tiene_resultados)) {
                    reagendaConDatos.push(`#${item.fichaId} · ${item.frecuencia_correlativo}`);
                }

                assignments.push({
                    id: pendingRow.id_agendamam,
                    fecha: instDate,
                    fechaRetiro: assignDate,
                    idMuestreadorInstalacion: Number(assignMuestreadorInst),
                    idMuestreadorRetiro: Number(assignMuestreadorRet || assignMuestreadorInst),
                    idFichaIngresoServicio: pendingRow.id_fichaingresoservicio || item.fichaId,
                    frecuenciaCorrelativo: pendingRow.frecuencia_correlativo || 'PorAsignar',
                    // Reagendar un servicio ya agendado vs. asignar uno disponible.
                    // expectAvailable activa la re-validación anti-carrera en el backend.
                    reagendar: isReagenda,
                    expectAvailable: !isReagenda
                });
            }

            if (pastInstFichas.length > 0) {
                showToast({ type: 'error', message: `Por la duración del muestreo, la instalación caería antes de hoy en: ${pastInstFichas.join(', ')}. Use una fecha de muestreo posterior.` });
                return;
            }

            if (assignments.length === 0) {
                showToast({ type: 'error', message: 'No hay registros pendientes para asignar en ninguna de las fichas seleccionadas' });
                return;
            }

            const executePost = async () => {
                setSaving(true);
                try {
                    const response = await fichaService.batchUpdateAgenda({
                        assignments,
                        user: user ? { id: user.id } : { id: 0 },
                        observaciones: `Asignación por ruta (${assignments.length} fichas) desde Planificador de Rutas`,
                        observacionNotificacion: assignObservacion.trim() || null
                    });
                    showToast({ type: 'success', message: response.message || `✅ Ruta asignada: ${assignments.length} fichas programadas correctamente` });
                    setIsModalOpen(false);
                    setAssignObservacion('');
                    setTimeout(() => onBack(), 1500);
                } catch (error: any) {
                    console.error("Error saving route:", error);
                    showToast({ type: 'error', message: error?.response?.data?.message || 'Error al guardar la asignación de ruta' });
                } finally {
                    setSaving(false);
                }
            };

            // Si hay reagendamientos sobre servicios con equipos/resultados, confirmar primero.
            if (reagendaConDatos.length > 0) {
                setConfirmDialog({
                    title: 'Reagendar servicios con datos cargados',
                    okText: 'Reagendar de todas formas',
                    cancelText: 'Cancelar',
                    content: (
                        <div className="flex flex-col gap-2">
                            <p className="text-[13px]">
                                {reagendaConDatos.length} servicio{reagendaConDatos.length !== 1 ? 's' : ''} que vas a reagendar ya
                                {' '}tiene{reagendaConDatos.length !== 1 ? 'n' : ''} equipos y/o resultados cargados:
                            </p>
                            <div className="flex flex-col gap-0.5">
                                {reagendaConDatos.map(s => <span key={s} className="text-xs font-semibold">• {s}</span>)}
                            </div>
                            <p className="text-[13px] text-[#e8590c]">Cambiar la fecha puede afectar la consistencia de esos datos. ¿Deseas continuar?</p>
                        </div>
                    ),
                    onOk: () => { setConfirmDialog(null); executePost(); }
                });
                return;
            }

            await executePost();
        } catch (error) {
            console.error("Error saving route:", error);
            showToast({ type: 'error', message: 'Error al guardar la asignación de ruta' });
        } finally {
            setSaving(false);
        }
    };

    const selectedCount = selectedItems.length;

    if (loading) {
        return (
            <div className="shadcn-scope p-4">
                <PageHeader
                    title="Planificador de Rutas"
                    onBack={onBack}
                    breadcrumbItems={[
                        { label: 'Fichas de Ingreso', onClick: onBack },
                        { label: 'Planificador' }
                    ]}
                />
                <div className="mt-8 flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
            </div>
        );
    }

    return (
        <div className="shadcn-scope w-full p-4">
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Asignación de Ruta</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <Field label="Fecha Muestreo *">
                            <DatePicker
                                value={assignDate}
                                onChange={(v) => {
                                    // El input nativo original usaba min={todayStr}; DatePicker no
                                    // soporta min/max, así que la regla se aplica en el handler.
                                    if (v && v < todayStr) return;
                                    setAssignDate(v);
                                }}
                            />
                        </Field>
                        <Field label="Muestreador Instalación *">
                            <Combobox
                                placeholder="Seleccionar..."
                                options={muestreadorOptions}
                                value={assignMuestreadorInst ?? ''}
                                onValueChange={(v) => { setAssignMuestreadorInst(v || null); if (!assignMuestreadorRet) setAssignMuestreadorRet(v || null); }}
                            />
                        </Field>
                        <Field label="Muestreador Retiro" hint="Solo compuestas. Si se omite, se usa el de instalación (en puntuales no aplica).">
                            <Combobox
                                placeholder="Igual al de instalación"
                                options={muestreadorOptions}
                                value={assignMuestreadorRet ?? ''}
                                onValueChange={(v) => setAssignMuestreadorRet(v || null)}
                            />
                        </Field>
                        <Field label="Observación para la notificación" hint="Se incluirá en el correo de asignación enviado al responsable">
                            <Textarea
                                placeholder="Ej: Coordinar acceso con guardia antes de las 9:00 AM"
                                rows={2}
                                value={assignObservacion}
                                onChange={(e) => setAssignObservacion(e.target.value)}
                            />
                        </Field>
                        <Button
                            className="w-full bg-violet-500 text-white hover:bg-violet-600"
                            size="lg"
                            onClick={handleSaveRoute}
                            disabled={selectedCount === 0 || !assignDate || !assignMuestreadorInst || saving}
                        >
                            {saving ? (
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                                <IconDeviceFloppy size={20} />
                            )}
                            Confirmar Asignación ({selectedCount} fichas)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <div className="flex flex-col gap-6">
                <PageHeader
                    title={editRutaId ? `Editando Ruta #${editRutaId}` : 'Planificador de Rutas'}
                    subtitle={editRutaId ? 'Modifique las fichas y guarde los cambios' : 'Seleccione fichas para armar una ruta de muestreo y asignar recursos'}
                    onBack={onBack}
                    breadcrumbItems={[
                        { label: 'Fichas de Ingreso', onClick: onBack },
                        { label: editRutaId ? 'Editar Ruta' : 'Planificador' }
                    ]}
                    rightSection={
                        <div className="flex gap-2">
                            <Badge variant="secondary" className="gap-1">
                                <IconMapPin size={14} />
                                {fichasWithCoords.length} con ubicación
                            </Badge>
                            <Badge variant="outline">
                                {fichas.length} fichas totales
                            </Badge>
                        </div>
                    }
                />

                <div className="flex gap-4" style={{ height: 'calc(100vh - 180px)', minHeight: 500 }}>
                    {/* LEFT PANEL */}
                    <div className="flex w-[35%] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        {/* Filters */}
                        <div className="border-b border-border p-3">
                            <div className="flex flex-col gap-2">
                                <div className="relative">
                                    <IconSearch size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar ficha, empresa, centro..."
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                        className="h-8 pl-8 pr-8 text-sm"
                                    />
                                    {searchText && (
                                        <IconEraser
                                            size={14}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground"
                                            onClick={() => setSearchText('')}
                                        />
                                    )}
                                </div>
                                <div className="flex flex-col gap-2">
                                    <Combobox placeholder="Empresa" options={uniqueEmpresas} value={filterEmpresa ?? ''} onValueChange={(v) => setFilterEmpresa(v || null)} className="h-8 text-sm" />
                                    <Combobox placeholder="Centro" options={uniqueCentros} value={filterCentro ?? ''} onValueChange={(v) => setFilterCentro(v || null)} className="h-8 text-sm" />
                                    <Combobox placeholder="Objetivo" options={uniqueObjetivos} value={filterObjetivo ?? ''} onValueChange={(v) => setFilterObjetivo(v || null)} className="h-8 text-sm" />

                                    {(filterEmpresa || filterCentro || filterObjetivo || searchText) && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full"
                                            onClick={() => { setFilterEmpresa(null); setFilterCentro(null); setFilterObjetivo(null); setSearchText(''); }}
                                        >
                                            Limpiar Filtros
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Fichas List */}
                        <div className="flex-1 overflow-y-auto p-2">
                            <div className="flex flex-col gap-1">
                                {filteredFichas.map(f => {
                                    const isSelected = selectedIds.includes(f.id);
                                    const hasCoords = f.lat !== null;
                                    const orderNum = isSelected ? selectedItems.findIndex(s => s.fichaId === f.id) + 1 : null;
                                    const allTaken = f.correlativos.length > 0 && f.correlativos.every(c =>
                                        c.status === 'EJECUTADO' || c.status === 'AGENDADO' || c.en_ruta
                                    );
                                    const isFullyBlocked = allTaken && !isSelected;
                                    const isMissingCoords = !hasCoords;
                                    const selectedCorr = selectedItems.find(s => s.fichaId === f.id);

                                    return (
                                        <div
                                            key={f.id}
                                            className={cn(
                                                'rounded-md p-2 transition-colors',
                                                isSelected ? 'border-2 border-sky-400 bg-accent' : isMissingCoords ? 'border border-destructive/40 bg-destructive/5' : 'border border-border',
                                                isFullyBlocked ? 'cursor-not-allowed bg-muted/40 opacity-55' : 'cursor-pointer'
                                            )}
                                            onClick={() => !isFullyBlocked && toggleFicha(f.id)}
                                        >
                                            <div className="flex flex-nowrap items-start gap-2">
                                                <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                                                {orderNum && (
                                                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600">
                                                        <span className="text-[10px] font-bold text-white">{orderNum}</span>
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-nowrap items-center gap-1">
                                                        <span className="text-xs font-bold text-sky-800">#{f.id}</span>
                                                        {hasCoords && <IconMapPin size={12} className="text-success" />}
                                                        {!hasCoords && (
                                                            <IconMapPin size={12} className="text-destructive/40" title="Ubicación incorrecta o mal ingresada" />
                                                        )}
                                                    </div>
                                                    <span className="block truncate text-xs" title={f.centro}>{f.centro}</span>
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <span className="truncate text-[10px] text-muted-foreground">{f.empresa_servicio}</span>
                                                        {f.total_servicios > 0 && (
                                                            <Badge variant={isSelected ? 'default' : 'secondary'} className="px-1 py-0 text-[10px]">
                                                                {selectedCorr
                                                                    ? `Servicio ${selectedCorr.numero_servicio} de ${f.total_servicios}`
                                                                    : `${f.servicios_disponibles} de ${f.total_servicios} disp.`}
                                                            </Badge>
                                                        )}
                                                        {f.servicios_en_ruta > 0 && !isSelected && (
                                                            <Badge variant="warning" className="px-1 py-0 text-[10px]">
                                                                {f.servicios_en_ruta} en ruta
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {filteredFichas.length === 0 && (
                                    <p className="py-8 text-center text-[13px] text-muted-foreground">No hay fichas que coincidan con los filtros</p>
                                )}
                            </div>
                        </div>

                        {/* Route section */}
                        <div className="border-t border-border">
                            <div className="bg-accent p-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <IconRoute size={16} className="text-sky-800" />
                                        <span className="text-[13px] font-semibold text-sky-800">Ruta ({selectedCount})</span>
                                    </div>
                                    {selectedCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => { setSelectedItems([]); setIsSavingBase(false); setNombreRuta(''); setDescripcionRuta(''); setSelectedGrupo(null); }}
                                        >
                                            <IconTrash size={12} />
                                            Limpiar
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {selectedCount > 0 && (
                                <div className="h-[100px] overflow-y-auto p-2">
                                    <div className="flex flex-col gap-0.5">
                                        {selectedItems.map((item, i) => {
                                            const f = fichas.find(ff => ff.id === item.fichaId);
                                            return (
                                                <div key={`${item.fichaId}-${item.frecuencia_correlativo}`} className="flex flex-nowrap items-center gap-1">
                                                    <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-600">
                                                        <span className="text-[8px] font-bold text-white">{i + 1}</span>
                                                    </div>
                                                    <span className="flex-1 truncate text-xs" title={f?.centro}>
                                                        #{item.fichaId} - {f?.centro || '?'}
                                                    </span>
                                                    {f?.correlativos && f.correlativos.length > 0 ? (
                                                        <Combobox
                                                            className="h-7 w-[115px] text-xs"
                                                            value={item.frecuencia_correlativo}
                                                            onValueChange={(val) => val && updateSelectedCorrelativo(item.fichaId, val)}
                                                            options={f.correlativos
                                                                .filter(c => (c.status === 'DISPONIBLE' && !c.en_ruta) || c.status === 'AGENDADO' || c.frecuencia_correlativo === item.frecuencia_correlativo)
                                                                .map(c => ({
                                                                    value: c.frecuencia_correlativo,
                                                                    label: `Serv. ${c.numero_servicio} / ${f.total_servicios}${
                                                                        c.status === 'AGENDADO' ? ' ↻ Reagendar' :
                                                                        c.en_ruta ? ' ↗ En ruta' : ''
                                                                    }`
                                                                }))
                                                            }
                                                        />
                                                    ) : (
                                                        <Badge variant="secondary" className="px-1 py-0 text-[10px]">
                                                            Serv. {item.numero_servicio}/{f?.total_servicios || '?'}
                                                        </Badge>
                                                    )}
                                                    <div className="ml-1 flex gap-0.5">
                                                        <ActionIconMini onClick={() => moveUp(i)} disabled={i === 0}><IconArrowUp size={10} /></ActionIconMini>
                                                        <ActionIconMini onClick={() => moveDown(i)} disabled={i === selectedCount - 1}><IconArrowDown size={10} /></ActionIconMini>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Assignment Controls */}
                            <div className="border-t border-border bg-muted/40 p-2">
                                {isSavingBase ? (
                                    <div className="flex flex-col gap-2">
                                        <Input
                                            className="h-8 text-sm"
                                            placeholder="Ej. Ruta Chiloé Sur - Martes"
                                            value={nombreRuta}
                                            onChange={(e) => setNombreRuta(e.target.value)}
                                            autoFocus
                                        />
                                        <Combobox
                                            className="h-8 text-sm"
                                            placeholder="Grupo (opcional)"
                                            options={grupos.map(g => ({ value: String(g.id_grupo), label: g.nombre_grupo }))}
                                            value={selectedGrupo ?? ''}
                                            onValueChange={(v) => setSelectedGrupo(v || null)}
                                        />
                                        <Textarea
                                            placeholder="Notas o descripción (opcional)"
                                            value={descripcionRuta}
                                            onChange={(e) => setDescripcionRuta(e.target.value)}
                                            rows={2}
                                        />
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsSavingBase(false)}>Cancelar</Button>
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                                                onClick={handleGuardarRutaBase}
                                                disabled={isLoading}
                                            >
                                                {isLoading ? (
                                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-success-foreground border-t-transparent" />
                                                ) : (
                                                    <IconDeviceFloppy size={14} />
                                                )}
                                                Guardar
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button className="flex-1" onClick={() => setIsModalOpen(true)} disabled={selectedItems.length === 0}>
                                            Asignar Oficial ({selectedCount})
                                        </Button>
                                        <Button variant="outline" className="flex-1" onClick={() => setIsSavingBase(true)} disabled={selectedItems.length === 0}>
                                            {editRutaId ? 'Actualizar Ruta' : 'Guardar Ruta Base'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL - MAP */}
                    <div className="flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                        {fichasWithCoords.length === 0 ? (
                            <div className="flex h-full items-center justify-center">
                                <div className="flex flex-col items-center gap-4">
                                    <IconMapPin size={48} className="text-muted-foreground" />
                                    <p className="text-center text-muted-foreground">
                                        No se detectaron coordenadas válidas en las fichas mostradas.<br />
                                        La ubicación es incorrecta o está mal ingresada en el enlace.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <MapContainer
                                center={allPositions[0] || [-33.45, -70.67]}
                                zoom={10}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <BaseTiles />
                                {allPositions.length > 0 && <FitBounds positions={allPositions} />}
                                <MapFocusHandler selectedFichas={selectedFichas} />

                                {/* All ficha markers */}
                                {fichasWithCoords.map(f => {
                                    const isSelected = selectedIds.includes(f.id);
                                    const orderNum = isSelected ? selectedIds.indexOf(f.id) + 1 : 0;

                                    return (
                                        <Marker
                                            key={f.id}
                                            position={[f.lat!, f.lng!]}
                                            icon={isSelected ? createNumberedIcon(orderNum) : defaultIcon}
                                            eventHandlers={{
                                                click: () => toggleFicha(f.id)
                                            }}
                                        >
                                            <Popup>
                                                <div style={{ minWidth: 200 }}>
                                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                                                        Ficha #{f.id}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: '#666', marginBottom: 2 }}>{f.centro}</div>
                                                    <div style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>{f.empresa_servicio}</div>
                                                    <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>{f.objetivo}</div>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleFicha(f.id); }}
                                                        style={{
                                                            width: '100%',
                                                            padding: '6px 12px',
                                                            background: isSelected ? '#fa5252' : '#228be6',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: 4,
                                                            cursor: 'pointer',
                                                            fontSize: 12,
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        {isSelected ? '✕ Quitar de Ruta' : '+ Agregar a Ruta'}
                                                    </button>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    );
                                })}

                                {/* R-03: solo renderizar polyline cuando OSRM ya entregó la ruta real,
                                    para evitar el flash de línea recta entre puntos. */}
                                {osrmRoute.length > 0 && (
                                    <Polyline
                                        positions={osrmRoute}
                                        pathOptions={{
                                            color: '#228be6',
                                            weight: 4,
                                            opacity: 0.8
                                        }}
                                    />
                                )}
                            </MapContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmación genérica — reemplaza Modal.confirm de antd */}
            <Dialog open={!!confirmDialog} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{confirmDialog?.title}</DialogTitle>
                    </DialogHeader>
                    {confirmDialog?.content}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmDialog(null)}>{confirmDialog?.cancelText || 'Cancelar'}</Button>
                        <Button className="bg-[#e8590c] text-white hover:bg-[#d9480f]" onClick={() => confirmDialog?.onOk()}>
                            {confirmDialog?.okText || 'Confirmar'}
                        </Button>
                    </DialogFooter>
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

// Tiny action icon helper
const ActionIconMini: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <div
        onClick={disabled ? undefined : onClick}
        className={cn(
            'flex h-[18px] w-[18px] items-center justify-center rounded-sm bg-muted',
            disabled ? 'cursor-default opacity-30' : 'cursor-pointer opacity-70'
        )}
    >
        {children}
    </div>
);
