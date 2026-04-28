import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { fichaService } from '../services/ficha.service';
import { rutasPlanificadasService } from '../services/rutasPlanificadas.service';
import { catalogosService } from '../services/catalogos.service';
import { useCatalogos } from '../context/CatalogosContext';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import {
    Stack,
    Paper,
    TextInput,
    Select,
    Button,
    Badge,
    Group,
    ScrollArea,
    Text,
    Box,
    Loader,
    Center,
    Checkbox,
    ThemeIcon,
    Tooltip,
    Modal
} from '@mantine/core';
import {
    IconRoute,
    IconMapPin,
    IconCalendarEvent,
    IconUserPlus,
    IconDeviceFloppy,
    IconSearch,
    IconEraser,
    IconTrash,
    IconArrowUp,
    IconArrowDown,
    IconWand
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
    status: string; // PENDIENTE | PROGRAMADO | EJECUTADO | EN_RUTA
    en_ruta: boolean;
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
    const [osrmRoute, setOsrmRoute] = useState<[number, number][]>([]);
    const [optimizing, setOptimizing] = useState(false);

    // Load data
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [fichasResponse, mData, oData] = await Promise.all([
                    fichaService.getForAssignment(),
                    getCatalogo('muestreadores', () => catalogosService.getMuestreadores()),
                    getCatalogo('objetivos-muestreo', () => catalogosService.getObjetivosMuestreo())
                ]);

                let rawFichas: any[] = [];
                if (Array.isArray(fichasResponse)) rawFichas = fichasResponse;
                else if (fichasResponse?.data && Array.isArray(fichasResponse.data)) rawFichas = fichasResponse.data;
                else if (fichasResponse?.recordset) rawFichas = fichasResponse.recordset;

                // Filter only fichas that actually have available services
                rawFichas = rawFichas.filter((f: any) => {
                    return f.servicios_disponibles > 0;
                });

                // Parse coordinates from refGoogle / ref_google / ma_coordenadas
                const parsedFichas: FichaWithCoords[] = await Promise.all(rawFichas.map(async (f: any) => {
                    let lat: number | null = null;
                    let lng: number | null = null;

                    let googleUrl = f.ref_google || f.refGoogle || f.ma_ref_google || '';
                    if (googleUrl) {
                        if (googleUrl.includes('goo.gl')) {
                            try {
                                const resolved = await fichaService.resolveGoogleUrl(googleUrl);
                                if (resolved?.finalUrl) {
                                    googleUrl = resolved.finalUrl;
                                }
                            } catch (e) {
                                console.warn('No se pudo resolver URL corta', googleUrl);
                            }
                        }

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
                }));

                setFichas(parsedFichas);
                if (mData) setMuestreadores(mData);
                if (oData) setObjetivosCat(oData);

                // If editing an existing route, pre-load its items
                if (editRutaId && parsedFichas.length > 0) {
                    try {
                        const ruta = await rutasPlanificadasService.getById(editRutaId);
                        if (ruta && ruta.fichas) {
                            const items: SelectedItem[] = ruta.fichas.map((rf: any) => {
                                const ficha = parsedFichas.find(f => f.id === rf.id_fichaingresoservicio);
                                const corrParts = (rf.frecuencia_correlativo || '').split('-');
                                const numSvc = corrParts.length >= 2 ? parseInt(corrParts[1]) : 1;
                                return {
                                    fichaId: rf.id_fichaingresoservicio,
                                    frecuencia_correlativo: rf.frecuencia_correlativo || '',
                                    numero_servicio: numSvc
                                };
                            });
                            setSelectedItems(items);
                            setNombreRuta(ruta.nombre_ruta || '');
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
    }, []);

    const handleGuardarRutaBase = async () => {
        if (!nombreRuta) {
            showToast({ type: 'warning', message: 'Ingresa un nombre para la ruta' });
            return;
        }
        setIsLoading(true);
        try {
            const payload = {
                nombre_ruta: nombreRuta,
                fichas: selectedItems.map((item, index) => ({
                    id_fichaingresoservicio: item.fichaId,
                    orden: index + 1,
                    frecuencia_correlativo: item.frecuencia_correlativo
                }))
            };

            if (editRutaId) {
                // Delete old route, create new one (simple update strategy)
                await rutasPlanificadasService.delete(editRutaId);
            }

            await rutasPlanificadasService.create(payload);
            showToast({ type: 'success', message: 'Ruta Base guardada exitosamente' });
            setIsSavingBase(false);
            setNombreRuta('');
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
            return;
        }
        const fetchRoute = async () => {
            try {
                const coordsStr = routePositions.map(p => `${p[1]},${p[0]}`).join(';');
                const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`);
                const data = await res.json();
                if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    const geometry = data.routes[0].geometry;
                    setOsrmRoute(geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]));
                } else {
                    setOsrmRoute([]);
                }
            } catch (err) {
                console.warn('OSRM routing fallback failed:', err);
                setOsrmRoute([]);
            }
        };
        fetchRoute();
    }, [routePositions]);

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
                const available = ficha.correlativos.find(c => c.status === 'DISPONIBLE' && !c.en_ruta);
                if (!available && ficha.correlativos.length > 0) {
                    showToast({ type: 'warning', message: `Ficha #${id}: todos los servicios ya están asignados o en otra ruta` });
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
            
            const available = ficha.correlativos.find(c => c.status === 'DISPONIBLE' && !c.en_ruta);
            
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

        setSaving(true);
        try {
            const assignmentPromises = selectedItems.map(item => fichaService.getAssignmentDetail(item.fichaId));
            const allDetails = await Promise.all(assignmentPromises);

            const assignments: any[] = [];
            for (let i = 0; i < selectedItems.length; i++) {
                const item = selectedItems[i];
                const rows = allDetails[i];

                if (!Array.isArray(rows) || rows.length === 0) {
                    showToast({ type: 'warning', message: `Ficha #${item.fichaId} no tiene registros de agenda pendientes. Se omitirá.` });
                    continue;
                }

                // Find the specific correlativo row, or fallback to first pending
                const targetRow = item.frecuencia_correlativo 
                    ? rows.find((r: any) => r.frecuencia_correlativo === item.frecuencia_correlativo)
                    : null;
                
                const pendingRow = targetRow || rows.find((r: any) => {
                    const estado = (r.nombre_estadomuestreo || '').toUpperCase();
                    return !estado.includes('EJECUTADO') && !estado.includes('CANCELADO') && !estado.includes('ANULADO');
                }) || rows[0];

                assignments.push({
                    id: pendingRow.id_agendamam,
                    fecha: assignDate,
                    fechaRetiro: assignDate,
                    idMuestreadorInstalacion: Number(assignMuestreadorInst),
                    idMuestreadorRetiro: Number(assignMuestreadorRet || assignMuestreadorInst),
                    idFichaIngresoServicio: pendingRow.id_fichaingresoservicio || item.fichaId,
                    frecuenciaCorrelativo: pendingRow.frecuencia_correlativo || 'PorAsignar'
                });
            }

            if (assignments.length === 0) {
                showToast({ type: 'error', message: 'No hay registros pendientes para asignar en ninguna de las fichas seleccionadas' });
                setSaving(false);
                return;
            }

            const response = await fichaService.batchUpdateAgenda({
                assignments,
                user: user ? { id: user.id } : { id: 0 },
                observaciones: `Asignación por ruta (${assignments.length} fichas) desde Planificador de Rutas`
            });

            showToast({ type: 'success', message: response.message || `✅ Ruta asignada: ${assignments.length} fichas programadas correctamente` });
            setIsModalOpen(false);
            setTimeout(() => onBack(), 1500);
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
            <Box p="md">
                <PageHeader title="Planificador de Rutas" onBack={onBack} />
                <Center mt="xl"><Loader size="lg" /></Center>
            </Box>
        );
    }

    return (
        <Box p="md" style={{ width: '100%' }}>
            <Modal
                opened={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Asignación de Ruta"
                centered
                size="md"
                zIndex={10000}
            >
                <Stack gap="md">
                    <TextInput
                        label="Fecha Muestreo"
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
                        placeholder="Seleccionar..."
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
                        placeholder="Igual al instalación"
                        leftSection={<IconUserPlus size={16} />}
                        comboboxProps={{ zIndex: 10001 }}
                    />
                    <Button
                        fullWidth
                        color="grape"
                        size="md"
                        leftSection={<IconDeviceFloppy size={20} />}
                        onClick={handleSaveRoute}
                        loading={saving}
                        disabled={selectedCount === 0 || !assignDate || !assignMuestreadorInst}
                        mt="md"
                    >
                        Confirmar Asignación ({selectedCount} fichas)
                    </Button>
                </Stack>
            </Modal>

            <Stack gap="lg">
                <PageHeader
                    title={editRutaId ? `Editando Ruta #${editRutaId}` : 'Planificador de Rutas'}
                    subtitle={editRutaId ? 'Modifique las fichas y guarde los cambios' : 'Seleccione fichas para armar una ruta de muestreo y asignar recursos'}
                    onBack={onBack}
                    rightSection={
                        <Group gap="xs">
                            <Badge size="lg" variant="light" color="blue" leftSection={<IconMapPin size={14} />}>
                                {fichasWithCoords.length} con ubicación
                            </Badge>
                            <Badge size="lg" variant="light" color="gray">
                                {fichas.length} fichas totales
                            </Badge>
                        </Group>
                    }
                />

                <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 180px)', minHeight: 500 }}>
                    {/* LEFT PANEL */}
                    <Paper withBorder radius="md" shadow="sm" style={{ width: '35%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {/* Filters */}
                        <Box p="sm" style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
                            <Stack gap="xs">
                                <TextInput
                                    size="xs"
                                    placeholder="Buscar ficha, empresa, centro..."
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    leftSection={<IconSearch size={14} />}
                                    rightSection={searchText ? <IconEraser size={14} style={{ cursor: 'pointer' }} onClick={() => setSearchText('')} /> : null}
                                />
                                <Stack gap="xs">
                                    <Select size="xs" placeholder="Empresa" data={uniqueEmpresas} value={filterEmpresa} onChange={setFilterEmpresa} clearable searchable />
                                    <Select size="xs" placeholder="Centro" data={uniqueCentros} value={filterCentro} onChange={setFilterCentro} clearable searchable />
                                    <Select size="xs" placeholder="Objetivo" data={uniqueObjetivos} value={filterObjetivo} onChange={setFilterObjetivo} clearable searchable />
                                    
                                    {(filterEmpresa || filterCentro || filterObjetivo || searchText) && (
                                        <Button 
                                            variant="light" 
                                            color="gray" 
                                            size="xs" 
                                            onClick={() => { setFilterEmpresa(null); setFilterCentro(null); setFilterObjetivo(null); setSearchText(''); }}
                                        >
                                            Limpiar Filtros
                                        </Button>
                                    )}
                                </Stack>
                            </Stack>
                        </Box>

                        {/* Fichas List */}
                        <ScrollArea style={{ flex: 1 }} p="xs">
                            <Stack gap={4}>
                                {filteredFichas.map(f => {
                                    const isSelected = selectedIds.includes(f.id);
                                    const hasCoords = f.lat !== null;
                                    const orderNum = isSelected ? selectedItems.findIndex(s => s.fichaId === f.id) + 1 : null;
                                    // Per-correlativo blocking: only fully blocked when ALL available correlativos are taken
                                    const allTaken = f.correlativos.length > 0 && f.correlativos.every(c => 
                                        c.status === 'EJECUTADO' || c.en_ruta
                                    );
                                    const isFullyBlocked = allTaken && !isSelected;
                                    const isMissingCoords = !hasCoords;
                                    const selectedCorr = selectedItems.find(s => s.fichaId === f.id);

                                    return (
                                        <Paper
                                            key={f.id}
                                            withBorder
                                            p="xs"
                                            radius="sm"
                                            bg={isFullyBlocked ? 'gray.1' : isMissingCoords ? 'red.0' : isSelected ? 'blue.0' : undefined}
                                            style={{
                                                cursor: isFullyBlocked ? 'not-allowed' : 'pointer',
                                                borderColor: isSelected ? 'var(--mantine-color-blue-4)' : isMissingCoords ? 'var(--mantine-color-red-3)' : undefined,
                                                borderWidth: isSelected ? 2 : 1,
                                                transition: 'all 0.15s ease',
                                                opacity: isFullyBlocked ? 0.55 : 1
                                            }}
                                            onClick={() => !isFullyBlocked && toggleFicha(f.id)}
                                        >
                                            <Group gap="xs" wrap="nowrap">
                                                <Checkbox checked={isSelected} onChange={() => {}} size="xs" readOnly color={isMissingCoords ? 'red' : 'blue'} />
                                                {orderNum && (
                                                    <ThemeIcon size="sm" radius="xl" color="blue" variant="filled">
                                                        <Text size="10px" fw={700}>{orderNum}</Text>
                                                    </ThemeIcon>
                                                )}
                                                <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                                                    <Group gap={4} wrap="nowrap">
                                                        <Text size="xs" fw={700} c="blue.8">#{f.id}</Text>
                                                        {hasCoords && <IconMapPin size={12} color="var(--mantine-color-green-6)" />}
                                                        {!hasCoords && (
                                                            <Tooltip label="Ubicación incorrecta o mal ingresada">
                                                                <IconMapPin size={12} color="var(--mantine-color-red-4)" />
                                                            </Tooltip>
                                                        )}
                                                    </Group>
                                                    <Text size="xs" truncate title={f.centro}>{f.centro}</Text>
                                                    <Group gap={4} wrap="wrap">
                                                        <Text size="10px" c="dimmed" truncate>{f.empresa_servicio}</Text>
                                                        {f.total_servicios > 0 && (
                                                            <Badge size="xs" color={isSelected ? 'teal' : 'blue'} variant="light">
                                                                {selectedCorr 
                                                                    ? `Servicio ${selectedCorr.numero_servicio} de ${f.total_servicios}` 
                                                                    : `${f.servicios_disponibles} de ${f.total_servicios} disp.`}
                                                            </Badge>
                                                        )}
                                                        {f.servicios_en_ruta > 0 && !isSelected && (
                                                            <Badge size="xs" color="orange" variant="light">
                                                                {f.servicios_en_ruta} en ruta
                                                            </Badge>
                                                        )}
                                                    </Group>
                                                </Stack>
                                            </Group>
                                        </Paper>
                                    );
                                })}
                                {filteredFichas.length === 0 && (
                                    <Text size="sm" c="dimmed" ta="center" py="xl">No hay fichas que coincidan con los filtros</Text>
                                )}
                            </Stack>
                        </ScrollArea>

                        {/* Route section */}
                        <Box style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
                            <Box p="xs" bg="blue.0">
                                <Group justify="space-between" align="center">
                                    <Group gap={4}>
                                        <IconRoute size={16} color="var(--mantine-color-blue-7)" />
                                        <Text size="sm" fw={700} c="blue.8">Ruta ({selectedCount})</Text>
                                    </Group>
                                    {selectedCount > 0 && (
                                        <Group gap="xs">
                                            <Button size="compact-xs" variant="subtle" color="red" leftSection={<IconTrash size={12} />} onClick={() => { setSelectedItems([]); setIsSavingBase(false); setNombreRuta(''); }}>
                                                Limpiar
                                            </Button>
                                        </Group>
                                    )}
                                </Group>
                            </Box>

                            {selectedCount > 0 && (
                                <ScrollArea h={100} p="xs">
                                    <Stack gap={2}>
                                        {selectedItems.map((item, i) => {
                                            const f = fichas.find(ff => ff.id === item.fichaId);
                                            return (
                                                <Group key={`${item.fichaId}-${item.frecuencia_correlativo}`} gap={4} wrap="nowrap">
                                                    <ThemeIcon size="xs" radius="xl" color="blue"><Text size="8px" fw={700}>{i + 1}</Text></ThemeIcon>
                                                    <Text size="xs" truncate style={{ flex: 1 }} title={f?.centro}>
                                                        #{item.fichaId} - {f?.centro || '?'}
                                                    </Text>
                                                    {f?.correlativos && f.correlativos.length > 0 ? (
                                                        <Select
                                                            size="xs"
                                                            w={105}
                                                            value={item.frecuencia_correlativo}
                                                            onChange={(val) => val && updateSelectedCorrelativo(item.fichaId, val)}
                                                            data={f.correlativos
                                                                .filter(c => c.status === 'DISPONIBLE' || c.frecuencia_correlativo === item.frecuencia_correlativo)
                                                                .map(c => ({
                                                                    value: c.frecuencia_correlativo,
                                                                    label: `Serv. ${c.numero_servicio} / ${f.total_servicios}`
                                                                }))
                                                            }
                                                            styles={{ input: { fontSize: '10px', minHeight: '22px', height: '22px', paddingLeft: '8px', paddingRight: '20px' } }}
                                                            allowDeselect={false}
                                                        />
                                                    ) : (
                                                        <Badge size="xs" variant="light" color="teal">
                                                            Serv. {item.numero_servicio}/{f?.total_servicios || '?'}
                                                        </Badge>
                                                    )}
                                                    <Group gap={2} ml={4}>
                                                        <ActionIconMini onClick={() => moveUp(i)} disabled={i === 0}><IconArrowUp size={10} /></ActionIconMini>
                                                        <ActionIconMini onClick={() => moveDown(i)} disabled={i === selectedCount - 1}><IconArrowDown size={10} /></ActionIconMini>
                                                    </Group>
                                                </Group>
                                            );
                                        })}
                                    </Stack>
                                </ScrollArea>
                            )}

                            {/* Assignment Controls */}
                            <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-gray-3)', backgroundColor: '#f8f9fa' }}>
                                {isSavingBase ? (
                                    <Stack gap="xs">
                                        <TextInput
                                            size="xs"
                                            placeholder="Ej. Ruta Chiloé Sur - Martes"
                                            value={nombreRuta}
                                            onChange={(e) => setNombreRuta(e.target.value)}
                                            required
                                            autoFocus
                                        />
                                        <Group grow gap="xs">
                                            <Button size="xs" variant="default" onClick={() => setIsSavingBase(false)}>Cancelar</Button>
                                            <Button size="xs" color="green" leftSection={<IconDeviceFloppy size={14} />} onClick={handleGuardarRutaBase} loading={isLoading}>
                                                Guardar
                                            </Button>
                                        </Group>
                                    </Stack>
                                ) : (
                                    <Group grow gap="xs">
                                        <Button size="sm" color="blue" onClick={() => setIsModalOpen(true)} disabled={selectedItems.length === 0}>
                                            Asignar Oficial ({selectedCount})
                                        </Button>
                                        <Button size="sm" variant="outline" color="blue" onClick={() => setIsSavingBase(true)} disabled={selectedItems.length === 0}>
                                            {editRutaId ? 'Actualizar Ruta' : 'Guardar Ruta Base'}
                                        </Button>
                                    </Group>
                                )}
                            </Box>
                        </Box>
                    </Paper>

                    {/* RIGHT PANEL - MAP */}
                    <Paper withBorder radius="md" shadow="sm" style={{ flex: 1, overflow: 'hidden' }}>
                        {fichasWithCoords.length === 0 ? (
                            <Center h="100%">
                                <Stack align="center" gap="md">
                                    <IconMapPin size={48} color="var(--mantine-color-gray-4)" />
                                    <Text c="dimmed" ta="center">
                                        No se detectaron coordenadas válidas en las fichas mostradas.<br />
                                        La ubicación es incorrecta o está mal ingresada en el enlace.
                                    </Text>
                                </Stack>
                            </Center>
                        ) : (
                            <MapContainer
                                center={allPositions[0] || [-33.45, -70.67]}
                                zoom={10}
                                style={{ height: '100%', width: '100%' }}
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
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

                                {/* Route polyline */}
                                {routePositions.length >= 2 && (
                                    <Polyline
                                        positions={osrmRoute.length > 0 ? osrmRoute : routePositions}
                                        pathOptions={{
                                            color: '#228be6',
                                            weight: 4,
                                            opacity: 0.8,
                                            dashArray: osrmRoute.length > 0 ? undefined : '10, 6'
                                        }}
                                    />
                                )}
                            </MapContainer>
                        )}
                    </Paper>
                </div>
            </Stack>

        </Box>
    );
};

// Tiny action icon helper
const ActionIconMini: React.FC<{ onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ onClick, disabled, children }) => (
    <div
        onClick={disabled ? undefined : onClick}
        style={{
            width: 18,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.3 : 0.7,
            borderRadius: 3,
            background: 'var(--mantine-color-gray-1)'
        }}
    >
        {children}
    </div>
);
