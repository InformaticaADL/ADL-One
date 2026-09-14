import { useEffect, useState } from 'react';
import { Drawer, Typography, Timeline, Tag } from 'antd';
import { IconCheck, IconClock, IconMapPin, IconFlagCheck, IconPlayerPause, IconBattery2 } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';
import { fichaCompletada, tipoVisitaHoy, contarFichasCompletadas } from '../utils/fichaHoyHelpers';

const { Text } = Typography;

// Mientras la jornada sigue activa ('en_ruta'), "Tiempo de ruta" se
// recalcula en vivo contra fecha_inicio en vez de mostrar el valor fijo del
// último snapshot: horas_trabajadas_minutos llega del backend en cada fetch
// (cada 60s, ver HoyEnVivoPage.tsx), pero entre un fetch y otro igual
// queremos que el contador avance visualmente. 'pausada' y 'finalizada' ya
// no avanzan — se muestra el total fijo que vino calculado del backend (para
// 'pausada' es la suma de los tramos ya cerrados, sin contar la pausa).
function formatearMinutos(totalMin: number): string {
    const min = Math.max(0, Math.floor(totalMin));
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatearHorasTrabajadas(jornada: JornadaHoy): string {
    if (jornada.estado !== 'en_ruta') return formatearMinutos(jornada.horas_trabajadas_minutos);
    // horas_trabajadas_cerradas_minutos (tramos YA cerrados) + minutos desde
    // que empezó el tramo ACTIVO — antes se calculaba desde jornada.
    // fecha_inicio (el inicio del PRIMER tramo del día), así que una pausa de
    // almuerzo se sumaba como si fuera trabajo hasta el próximo fetch del
    // snapshot (cada 60s), donde el número "saltaba" hacia abajo de golpe.
    const inicioTramoActual = jornada.fecha_inicio_tramo_actual ?? jornada.fecha_inicio;
    const msTramoActual = Date.now() - new Date(inicioTramoActual).getTime();
    return formatearMinutos(jornada.horas_trabajadas_cerradas_minutos + msTramoActual / 60000);
}

interface DetalleJornadaDrawerProps {
    jornada: JornadaHoy | null;
    opened: boolean;
    onClose: () => void;
}

// Leaflet dibuja sus propios panes internos (tiles, overlays, markers,
// tooltips, popups) con z-index hasta 700 dentro del propio MapContainer. El
// Drawer, en cambio, se monta vía Portal con su z-index por defecto — más
// bajo que Leaflet — así que sin fijarlo explícitamente por encima, el mapa
// termina visualmente delante del drawer en vez de detrás. 1000 deja margen
// sobre cualquier pane de Leaflet.
const DRAWER_Z_INDEX = 1000;

export function DetalleJornadaDrawer({ jornada, opened, onClose }: DetalleJornadaDrawerProps) {
    // Fuerza un re-render cada 30s para que "Tiempo de ruta" avance en vivo
    // entre un fetch del snapshot y el siguiente (mismo patrón que
    // FlotaPanel.tsx usa para su badge de estado/tiempo relativo). No hace
    // nada útil si la jornada ya no está 'en_ruta' (el valor es fijo), pero
    // tampoco molesta — se limpia igual al desmontar.
    const [, forceTick] = useState(0);
    useEffect(() => {
        const id = setInterval(() => forceTick((t) => t + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    if (!jornada) {
        return <Drawer open={opened} onClose={onClose} placement="right" width={380} title="Detalle" zIndex={DRAWER_Z_INDEX} />;
    }

    const indiceActivo = jornada.fichas_hoy.findIndex((f) => !fichaCompletada(f));
    const { completadas, total } = contarFichasCompletadas(jornada.fichas_hoy);
    const enRuta = jornada.estado === 'en_ruta';
    const pausada = jornada.estado === 'pausada';
    const finalizada = jornada.estado === 'finalizada';
    const tieneBateria = jornada.bateria_inicio != null && jornada.bateria_fin != null;

    return (
        <Drawer
            open={opened}
            onClose={onClose}
            placement="right"
            width={380}
            title={jornada.nombre_muestreador}
            zIndex={DRAWER_Z_INDEX}
            styles={{ header: { fontWeight: 700 } }}
        >
            <div style={{ marginBottom: 16 }}>
                {pausada ? (
                    <Tag color="orange" icon={<IconPlayerPause size={12} style={{ verticalAlign: 'text-bottom' }} />}>
                        En pausa
                    </Tag>
                ) : finalizada ? (
                    <Tag color="blue" icon={<IconFlagCheck size={12} style={{ verticalAlign: 'text-bottom' }} />}>
                        Día finalizado
                    </Tag>
                ) : (
                    <Tag color={jornada.ultima_posicion ? 'green' : 'default'} icon={<IconMapPin size={12} style={{ verticalAlign: 'text-bottom' }} />}>
                        {jornada.ultima_posicion ? 'En ruta' : 'Sin posición'}
                    </Tag>
                )}
            </div>

            {!enRuta && (
                <Text strong style={{ display: 'block', marginBottom: 16 }}>
                    {completadas}/{total} ficha{total === 1 ? '' : 's'} completada{completadas === 1 ? '' : 's'}
                </Text>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Fichas hoy</Text>
                    <Text strong style={{ display: 'block' }}>{jornada.fichas_hoy.length}</Text>
                </div>
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Inicio jornada</Text>
                    <Text strong style={{ display: 'block' }}>
                        {new Date(jornada.fecha_inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {!enRuta && jornada.fecha_fin && (
                        <>
                            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>{pausada ? 'Pausado a las' : 'Término jornada'}</Text>
                            <Text strong style={{ display: 'block' }}>
                                {new Date(jornada.fecha_fin).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </>
                    )}
                </div>
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Tiempo de ruta</Text>
                    <Text strong style={{ display: 'block' }}>{formatearHorasTrabajadas(jornada)}</Text>
                </div>
                <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Km recorridos</Text>
                    <Text strong style={{ display: 'block' }}>{jornada.km_recorridos.toFixed(1)} km</Text>
                </div>
                {tieneBateria && (
                    <div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            <IconBattery2 size={12} style={{ verticalAlign: 'text-bottom', marginRight: 2 }} />
                            Batería
                        </Text>
                        <Text strong style={{ display: 'block' }}>{jornada.bateria_inicio}% → {jornada.bateria_fin}%</Text>
                    </div>
                )}
            </div>

            <Text strong type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Itinerario de hoy</Text>

            {jornada.fichas_hoy.length === 0 ? (
                <Text type="secondary" style={{ fontSize: 13 }}>Sin fichas agendadas hoy.</Text>
            ) : (
                <Timeline
                    items={jornada.fichas_hoy.map((ficha) => {
                        const completada = fichaCompletada(ficha);
                        const activa = jornada.fichas_hoy.indexOf(ficha) < (indiceActivo === -1 ? jornada.fichas_hoy.length : indiceActivo);
                        return {
                            key: ficha.id_agendamam,
                            dot: (
                                <div style={{
                                    width: 20, height: 20, borderRadius: '50%',
                                    backgroundColor: activa || completada ? '#0062a8' : 'var(--app-border)',
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    {completada ? <IconCheck size={11} /> : <IconClock size={11} />}
                                </div>
                            ),
                            children: (
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                                        <Text strong style={{ fontSize: 13 }}>{ficha.frecuencia_correlativo}</Text>
                                        <Tag color={completada ? 'green' : 'blue'} style={{ fontSize: 11, marginInlineEnd: 0 }}>
                                            {tipoVisitaHoy(ficha)}
                                        </Tag>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                                        {completada ? 'Completada' : 'Pendiente'} · {ficha.hora_coordinador || '—'}
                                        {ficha.tiempo_trabajo_minutos != null && ` · ${formatearMinutos(ficha.tiempo_trabajo_minutos)} en terreno`}
                                    </Text>
                                    {/* Promedio histórico por objetivo de muestreo (ver
                                        getSnapshotHoy en tracking.service.js) — null hasta que
                                        se acumulen al menos 3 fichas completadas con ese mismo
                                        objetivo, para no mostrar un "esperado" basado en 1-2
                                        muestras. Se muestra aunque la ficha siga pendiente, como
                                        referencia de cuánto suele tomar. */}
                                    {ficha.tiempo_estimado_minutos != null && (
                                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>
                                            Esperado: ≈{formatearMinutos(ficha.tiempo_estimado_minutos)} (promedio histórico)
                                            {ficha.tiempo_trabajo_minutos != null && ficha.tiempo_trabajo_minutos > ficha.tiempo_estimado_minutos * 1.3 && (
                                                <Text style={{ color: '#e8590c', fontWeight: 600, fontSize: 12 }}> · sobre lo esperado</Text>
                                            )}
                                        </Text>
                                    )}
                                    {ficha.empresa && <Text style={{ fontSize: 12, display: 'block' }}>Empresa: {ficha.empresa}</Text>}
                                    {ficha.centro && <Text style={{ fontSize: 12, display: 'block' }}>Centro: {ficha.centro}</Text>}
                                    {ficha.objetivo && <Text style={{ fontSize: 12, display: 'block' }}>Objetivo: {ficha.objetivo}</Text>}
                                </div>
                            ),
                        };
                    })}
                />
            )}
        </Drawer>
    );
}
