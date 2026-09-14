import { Typography, Input, Tag, Avatar } from 'antd';
import { IconSearch } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';
import type { JornadaHoy } from '../services/tracking.service';
import { colorPorMuestreador, inicialesDe } from '../utils/colorMuestreador';
import { contarFichasCompletadas, siguienteFichaPendiente, distanciaKm } from '../utils/fichaHoyHelpers';

const { Text } = Typography;

interface FlotaPanelProps {
    jornadas: JornadaHoy[];
    selectedMuestreadorId: number | null;
    onSelectMuestreador: (id: number) => void;
}

const UMBRAL_SIN_SENAL_MS = 10 * 60 * 1000; // 10 minutos, per diseño "Hoy en Vivo"

function estadoDeJornada(jornada: JornadaHoy): { label: string; color: string } {
    if (jornada.estado === 'pausada') return { label: 'En pausa', color: 'orange' };
    if (jornada.estado === 'finalizada') return { label: 'Día finalizado', color: 'blue' };
    if (!jornada.ultima_posicion) return { label: 'Sin posición', color: 'default' };
    const msDesdeUltimoPing = Date.now() - new Date(jornada.ultima_posicion.timestamp_reporte).getTime();
    if (msDesdeUltimoPing > UMBRAL_SIN_SENAL_MS) return { label: 'Sin señal', color: 'default' };
    return { label: 'En ruta', color: 'green' };
}

function tiempoRelativo(fechaIso: string): string {
    const segundos = Math.floor((Date.now() - new Date(fechaIso).getTime()) / 1000);
    if (segundos < 60) return `hace ${segundos}s`;
    const minutos = Math.floor(segundos / 60);
    if (minutos < 60) return `hace ${minutos} min`;
    const horas = Math.floor(minutos / 60);
    return `hace ${horas} h`;
}

export function FlotaPanel({ jornadas, selectedMuestreadorId, onSelectMuestreador }: FlotaPanelProps) {
    const [busqueda, setBusqueda] = useState('');

    // Fuerza un re-render cada 15s para que estadoDeJornada/tiempoRelativo se
    // reevalúen aunque no llegue ningún evento nuevo por socket — sin esto, un
    // muestreador sin pings nuevos se queda "En ruta" para siempre en vez de
    // pasar a "Sin señal" al cruzar el umbral de 10 minutos.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 15_000);
        return () => clearInterval(id);
    }, []);

    const jornadasFiltradas = useMemo(
        () => jornadas.filter((j) => j.nombre_muestreador.toLowerCase().includes(busqueda.toLowerCase())),
        [jornadas, busqueda]
    );

    return (
        <div style={{ width: 280, borderRight: '1px solid var(--app-border)', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text strong style={{ fontSize: 13 }}>Hoy en vivo</Text>
                    <Tag style={{ marginInlineEnd: 0 }}>
                        {jornadas.filter((j) => j.estado === 'en_ruta').length} en terreno
                    </Tag>
                </div>
                <Input
                    placeholder="Buscar muestreador..."
                    size="small"
                    prefix={<IconSearch size={14} style={{ color: 'var(--app-text-secondary)' }} />}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, paddingTop: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {jornadasFiltradas.length === 0 && (
                        <Text type="secondary" style={{ fontSize: 13, textAlign: 'center', marginTop: 16 }}>
                            No hay muestreadores en terreno en este momento.
                        </Text>
                    )}
                    {jornadasFiltradas.map((j) => {
                        const estado = estadoDeJornada(j);
                        const seleccionada = j.id_muestreador === selectedMuestreadorId;
                        return (
                            <button
                                key={j.id_muestreador}
                                onClick={() => onSelectMuestreador(j.id_muestreador)}
                                style={{
                                    padding: 8,
                                    borderRadius: 8,
                                    border: `1px solid ${seleccionada ? '#1677ff' : 'var(--app-border)'}`,
                                    backgroundColor: seleccionada ? 'var(--app-accent-bg)' : 'transparent',
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    width: '100%',
                                }}
                            >
                                {/* Sin truncate ni nowrap a propósito: un nombre largo o el
                                    label "Día finalizado" terminaban cortados en "..." al
                                    forzarlos a compartir una sola línea angosta. Se prefiere
                                    que la card crezca en alto antes que recortar texto. */}
                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap', marginBottom: 4 }}>
                                    <Avatar size={22} style={{ backgroundColor: colorPorMuestreador(j.id_muestreador), flexShrink: 0, marginTop: 1, fontSize: 10, fontWeight: 700 }}>
                                        {inicialesDe(j.nombre_muestreador)}
                                    </Avatar>
                                    <Text strong style={{ fontSize: 13, flex: 1 }}>{j.nombre_muestreador}</Text>
                                </div>
                                <Tag color={estado.color} style={{ marginBottom: 4, marginInlineEnd: 0 }}>
                                    {estado.label}
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>
                                    {j.estado !== 'en_ruta'
                                        ? (() => {
                                              const { completadas, total } = contarFichasCompletadas(j.fichas_hoy);
                                              return `${completadas}/${total} completadas`;
                                          })()
                                        : `${j.fichas_hoy.length} ficha(s) hoy`}
                                    {/* "última señal", no "act." — la abreviatura se prestaba a
                                        leerse como "estuvo activo/moviéndose en esos segundos"; es
                                        solo hace cuánto llegó el último ping GPS, se mueva o no. */}
                                    {j.estado === 'en_ruta' && j.ultima_posicion && ` · última señal ${tiempoRelativo(j.ultima_posicion.timestamp_reporte)}`}
                                </Text>
                                {/* Distancia en línea recta a la próxima ficha pendiente — no
                                    es ruta real por calle (no hay motor de ruteo acá), pero le
                                    da al supervisor una idea de "qué tan cerca está" sin tener
                                    que abrir el drawer de detalle. Solo mientras está en_ruta y
                                    hay posición + ficha con coordenadas resueltas. */}
                                {j.estado === 'en_ruta' && j.ultima_posicion && (() => {
                                    const siguiente = siguienteFichaPendiente(j.fichas_hoy);
                                    if (!siguiente) return null;
                                    const dist = distanciaKm(
                                        { lat: j.ultima_posicion.latitud, lon: j.ultima_posicion.longitud },
                                        { lat: Number(siguiente.ubicacion_lat), lon: Number(siguiente.ubicacion_lon) }
                                    );
                                    return (
                                        <Text style={{ fontSize: 12, color: '#1677ff', display: 'block', marginTop: 2 }}>
                                            {dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} a {siguiente.centro || 'la próxima ficha'}
                                        </Text>
                                    );
                                })()}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
