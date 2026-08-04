# Hoy en Vivo — Fase 3: frontend-adlone (mapa en vivo + panel de flota + drawer de detalle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the supervisor-facing "Hoy en Vivo" screen in ADL ONE Web: a live map with a fleet sidebar (layout A) that opens a detail drawer with the sampler's itinerary (layout B) on click, consuming the backend built in fases 1-2 (`GET /api/tracking/hoy` for the initial snapshot, the `hoy_en_vivo` Socket.IO room for live position updates).

**Architecture:** A new nav entry (`ma-hoy-en-vivo`) seeded into the existing DB-driven menu system, gated by the `AI_MA_HOY_EN_VIVO` permission (already seeded in fase 2). A dedicated Zustand store (`trackingStore.ts`) owns the snapshot fetch and a private Socket.IO connection (mirroring this codebase's established pattern — `notificationStore.ts` and `ChatModule.tsx` each keep their own private `socket` module variable, not a shared connection). Three presentational components (`TrackingMapa`, `FlotaPanel`, `DetalleJornadaDrawer`) render from that store's state, composed by `HoyEnVivoPage.tsx`, wired into `DashboardPage.tsx`'s existing `activeSubmodule` switch.

**Tech Stack:** React 19, TypeScript, Vite, Mantine v8, `react-leaflet` + `leaflet` (already installed — used by the existing route-planner map, `AssignmentMapView.tsx`), `socket.io-client` (already installed), Zustand.

**Repo:** `C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone` — this is a subdirectory of the single `ADL-One` monorepo (`C:\Users\vremolcoy\Desktop\ADL ONE`, remote `github.com/InformaticaADL/ADL-One.git`), not its own separate git repo. All git commands run from `C:\Users\vremolcoy\Desktop\ADL ONE`, even though the files live under `frontend-adlone/` (and Task 1's migration lives under `api-backend-adlone/`).

**Depends on (already shipped):**
- Fase 1 (`api-app-mam`): `mam_jornadas` / `mam_ubicaciones_tracking` tables, GPS reporting.
- Fase 2 (`api-backend-adlone`): `GET /api/tracking/hoy` (returns `{ jornadas: [{ id_jornada, id_muestreador, nombre_muestreador, fecha_inicio, ultima_posicion: { latitud, longitud, timestamp_reporte } | null, fichas_hoy: [{ id_agendamam, frecuencia_correlativo, id_muestreador, id_muestreador2, fecha_muestreo, fecha_retiro, hora_coordinador, estado_caso, instalacion_completado, retiro_completado, id_estadomuestreo }] }] }`), Socket.IO event `posicion_actualizada` (`{ id_muestreador, id_jornada, lat, lon, timestamp }`) broadcast to room `hoy_en_vivo`, joined by emitting `joinTracking` (permission-gated server-side, no client action needed beyond emitting the event on an authenticated socket). Permission `AI_MA_HOY_EN_VIVO` already exists in `mae_permiso`.

**Explicitly out of scope for this phase** (confirmed with the user during planning): ETA to the next scheduled stop. The design's original mockup showed it, but the only address data available (`App_Ma_FichaIngresoServicio_ENC.referencia_googlemaps`) is a shortened Google Maps link (`maps.app.goo.gl/...`), not raw coordinates — resolving it requires an existing-but-separate endpoint (`GET /api/fichas/resolve-url`) plus fragile regex-parsing of the redirected URL, with no guaranteed success rate. The drawer built in this phase shows the itinerary and completion status without ETA; adding it later is a self-contained follow-up, not a blocker for this phase.

---

### Task 1: Nav entry migration — "Hoy en Vivo" menu link

**Files:**
- Create: `api-backend-adlone/migrations/add_hoy_en_vivo_menu_link.sql`

This codebase's sidebar is fully database-driven (`mae_menu_modulo` / `mae_menu_link`, served via `GET /api/menu`, consumed by `Sidebar.tsx` through `navStore`'s `dynamicModules`). Without a row in `mae_menu_link`, the feature built in this phase would be unreachable from the UI regardless of how correct the code is. The existing "Medio Ambiente" module has `id_modulo = 'medio_ambiente'`; its existing links (`ma-fichas-ingreso`, `ma-reportes-view`) use `sort_order` 10 and 20 — this new one uses 30. `id_accion` becomes the exact string `DashboardPage.tsx` (Task 6) checks against `activeSubmodule`.

- [ ] **Step 1: Write the migration file**

Create `api-backend-adlone/migrations/add_hoy_en_vivo_menu_link.sql`:

```sql
IF NOT EXISTS (SELECT * FROM mae_menu_link WHERE id_accion = 'ma-hoy-en-vivo')
BEGIN
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES (
        'medio_ambiente',
        'ma-hoy-en-vivo',
        'Hoy en Vivo',
        'AI_MA_HOY_EN_VIVO',
        30,
        1
    );
    PRINT 'Link ma-hoy-en-vivo creado correctamente';
END
ELSE
BEGIN
    PRINT 'Link ma-hoy-en-vivo ya existe';
END
GO

-- Descripción:
-- Agrega "Hoy en Vivo" como link dentro del módulo Medio Ambiente en el menú
-- dinámico (mae_menu_modulo / mae_menu_link, servido por GET /api/menu). El
-- id_accion 'ma-hoy-en-vivo' es el valor que DashboardPage.tsx compara contra
-- activeSubmodule para renderizar HoyEnVivoPage. Visible solo para usuarios
-- cuyo rol tenga el permiso AI_MA_HOY_EN_VIVO (ya sembrado en fase 2).
```

- [ ] **Step 2: Verify the identity behavior and apply it to the real dev DB**

`id_link` in `mae_menu_link` is an `IDENTITY` column (confirmed via `COLUMNPROPERTY(OBJECT_ID('mae_menu_link'), 'id_link', 'IsIdentity')` during planning — it returned `1`), so the `INSERT` above (which omits `id_link`) is correct as written. Apply it:

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "
import('./src/config/env.js').then(() => import('./src/config/database.js')).then(async ({ getConnection }) => {
  const pool = await getConnection();
  const fs = await import('fs');
  const sqlText = fs.readFileSync('migrations/add_hoy_en_vivo_menu_link.sql', 'utf8');
  const batches = sqlText.split(/^GO\$/im).map(b => b.trim()).filter(Boolean);
  for (const batch of batches) { await pool.request().query(batch); }
  const check = await pool.request().query(\"SELECT * FROM mae_menu_link WHERE id_accion = 'ma-hoy-en-vivo'\");
  console.log(JSON.stringify(check.recordset, null, 2));
  process.exit(0);
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
"
```

Expected: one row printed with `id_accion: 'ma-hoy-en-vivo'`, `label: 'Hoy en Vivo'`, `permissions_str: 'AI_MA_HOY_EN_VIVO'`, `activo: true`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add api-backend-adlone/migrations/add_hoy_en_vivo_menu_link.sql
git commit -m "chore: add Hoy en Vivo nav link to the Medio Ambiente menu"
```

---

### Task 2: `tracking.service.ts` + `trackingStore.ts`

**Files:**
- Create: `frontend-adlone/src/features/medio-ambiente/services/tracking.service.ts`
- Create: `frontend-adlone/src/store/trackingStore.ts`

The service follows the exact pattern of `rutasPlanificadas.service.ts` (typed interfaces + `apiClient.get(...)` returning `response.data.data`). The store follows the exact pattern of `notificationStore.ts` / `ChatModule.tsx`'s private-socket-variable approach — a dedicated connection scoped to this feature, not a shared one, matching this codebase's established convention (confirmed by reading both files during planning: neither reuses the other's socket).

- [ ] **Step 1: Create the service**

Create `frontend-adlone/src/features/medio-ambiente/services/tracking.service.ts`:

```ts
import apiClient from '../../../config/axios.config';

export interface UltimaPosicion {
    latitud: number;
    longitud: number;
    timestamp_reporte: string;
}

export interface FichaHoy {
    id_agendamam: number;
    frecuencia_correlativo: string;
    id_muestreador: number;
    id_muestreador2: number | null;
    fecha_muestreo: string | null;
    fecha_retiro: string | null;
    hora_coordinador: string | null;
    estado_caso: string | null;
    instalacion_completado: string | null;
    retiro_completado: string | null;
    id_estadomuestreo: number | null;
}

export interface JornadaHoy {
    id_jornada: number;
    id_muestreador: number;
    nombre_muestreador: string;
    fecha_inicio: string;
    ultima_posicion: UltimaPosicion | null;
    fichas_hoy: FichaHoy[];
}

export const trackingService = {
    getSnapshotHoy: async (): Promise<JornadaHoy[]> => {
        const response = await apiClient.get('/api/tracking/hoy');
        return response.data.data.jornadas;
    },
};
```

- [ ] **Step 2: Create the store**

Create `frontend-adlone/src/store/trackingStore.ts`:

```ts
import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import API_CONFIG from '../config/api.config';
import { trackingService, type JornadaHoy } from '../features/medio-ambiente/services/tracking.service';

interface PosicionActualizadaPayload {
    id_muestreador: number;
    id_jornada: number;
    lat: number;
    lon: number;
    timestamp: string;
}

interface TrackingState {
    jornadas: JornadaHoy[];
    loading: boolean;
    error: string | null;
    selectedJornadaId: number | null;
    fetchSnapshot: () => Promise<void>;
    connectSocket: (token: string) => void;
    disconnectSocket: () => void;
    selectJornada: (id: number | null) => void;
}

// Conexión de socket privada de esta feature, igual al patrón ya usado en
// notificationStore.ts y ChatModule.tsx (cada feature abre la suya, no se
// comparte una única conexión global).
let socket: Socket | null = null;

export const useTrackingStore = create<TrackingState>((set) => ({
    jornadas: [],
    loading: false,
    error: null,
    selectedJornadaId: null,

    fetchSnapshot: async () => {
        set({ loading: true, error: null });
        try {
            const jornadas = await trackingService.getSnapshotHoy();
            set({ jornadas, loading: false });
        } catch (err) {
            console.error('Error fetching Hoy en Vivo snapshot:', err);
            set({ error: 'No se pudo cargar el estado de seguimiento.', loading: false });
        }
    },

    connectSocket: (token: string) => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }

        const baseUrl = API_CONFIG.getBaseURL();
        socket = io(baseUrl, {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            reconnectionDelayMax: 10000,
        });

        socket.on('connect', () => {
            socket?.emit('joinTracking');
        });

        socket.on('connect_error', (err) => {
            console.warn('[TrackingSocket] Connection error:', err.message);
        });

        socket.on('posicion_actualizada', (payload: PosicionActualizadaPayload) => {
            // Solo actualiza jornadas que YA están en el snapshot cargado. Si un
            // muestreador inicia su jornada DESPUÉS de que la pantalla ya cargó
            // el snapshot, no aparecerá hasta que se refresque manualmente —
            // limitación aceptada para esta fase (no hay auto-refresh del set
            // de jornadas activas, solo de su posición).
            set((state) => ({
                jornadas: state.jornadas.map((j) =>
                    j.id_jornada === payload.id_jornada
                        ? {
                            ...j,
                            ultima_posicion: {
                                latitud: payload.lat,
                                longitud: payload.lon,
                                timestamp_reporte: payload.timestamp,
                            },
                        }
                        : j
                ),
            }));
        });
    },

    disconnectSocket: () => {
        if (socket) {
            socket.emit('leaveTracking');
            socket.disconnect();
            socket = null;
        }
    },

    selectJornada: (id) => set({ selectedJornadaId: id }),
}));
```

- [ ] **Step 3: Verify both files compile**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
npx tsc --noEmit
```

Expected: no new TypeScript errors referencing `tracking.service.ts` or `trackingStore.ts`. (Pre-existing unrelated errors elsewhere in the codebase, if any, are not your concern — only check that these two new files don't introduce any.)

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add frontend-adlone/src/features/medio-ambiente/services/tracking.service.ts frontend-adlone/src/store/trackingStore.ts
git commit -m "feat: add tracking service and store (snapshot fetch + live position socket)"
```

---

### Task 3: `TrackingMapa.tsx`

**Files:**
- Create: `frontend-adlone/src/features/medio-ambiente/components/TrackingMapa.tsx`

Mirrors `AssignmentMapView.tsx`'s `react-leaflet` setup exactly (same `MapContainer`/`TileLayer`/`Marker`/`Popup` imports, same Leaflet default-icon fix — this fix must be repeated per-file in this codebase, since `AssignmentMapView.tsx` and `RouteMapPlannerView.tsx` both already duplicate it rather than sharing a util; follow that existing convention, don't introduce a new shared module for it).

- [ ] **Step 1: Create the component**

Create `frontend-adlone/src/features/medio-ambiente/components/TrackingMapa.tsx`:

```tsx
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';
import type { JornadaHoy } from '../services/tracking.service';

// Fix para los íconos por defecto de Leaflet, que no se resuelven bien en el
// bundle de Vite (mismo fix ya usado en AssignmentMapView.tsx).
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
});

const CENTRO_DEFECTO: [number, number] = [-33.4489, -70.6693]; // Santiago

interface TrackingMapaProps {
    jornadas: JornadaHoy[];
    selectedJornadaId: number | null;
    onSelectJornada: (id: number) => void;
}

// Centra el mapa en la jornada seleccionada cuando cambia la selección, sin
// desmontar/recrear el MapContainer (useMap da acceso a la instancia viva).
function CentradorMapa({ jornadas, selectedJornadaId }: { jornadas: JornadaHoy[]; selectedJornadaId: number | null }) {
    const map = useMap();
    useEffect(() => {
        if (!selectedJornadaId) return;
        const jornada = jornadas.find((j) => j.id_jornada === selectedJornadaId);
        if (jornada?.ultima_posicion) {
            map.setView([jornada.ultima_posicion.latitud, jornada.ultima_posicion.longitud], 13);
        }
    }, [selectedJornadaId, jornadas, map]);
    return null;
}

export function TrackingMapa({ jornadas, selectedJornadaId, onSelectJornada }: TrackingMapaProps) {
    const conPosicion = jornadas.filter((j) => j.ultima_posicion !== null);

    return (
        <MapContainer center={CENTRO_DEFECTO} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            <CentradorMapa jornadas={jornadas} selectedJornadaId={selectedJornadaId} />
            {conPosicion.map((j) => (
                <Marker
                    key={j.id_jornada}
                    position={[j.ultima_posicion!.latitud, j.ultima_posicion!.longitud]}
                    eventHandlers={{ click: () => onSelectJornada(j.id_jornada) }}
                >
                    <Popup>
                        <strong>{j.nombre_muestreador}</strong>
                        <br />
                        Última actualización: {new Date(j.ultima_posicion!.timestamp_reporte).toLocaleTimeString('es-CL')}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
npx tsc --noEmit
```

Expected: no new errors referencing `TrackingMapa.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add frontend-adlone/src/features/medio-ambiente/components/TrackingMapa.tsx
git commit -m "feat: add TrackingMapa component (Leaflet map with sampler markers)"
```

---

### Task 4: `FlotaPanel.tsx`

**Files:**
- Create: `frontend-adlone/src/features/medio-ambiente/components/FlotaPanel.tsx`

The left-hand fleet list from the approved mockup: search box, count badge, one row per active jornada with a status dot, ficha count, and "last updated" relative time. "Sin señal" after 10 minutes without a new position — matches the design spec's documented threshold.

- [ ] **Step 1: Create the component**

Create `frontend-adlone/src/features/medio-ambiente/components/FlotaPanel.tsx`:

```tsx
import { Box, ScrollArea, Text, TextInput, Badge, Stack, UnstyledButton, Group } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import type { JornadaHoy } from '../services/tracking.service';

interface FlotaPanelProps {
    jornadas: JornadaHoy[];
    selectedJornadaId: number | null;
    onSelectJornada: (id: number) => void;
}

const UMBRAL_SIN_SENAL_MS = 10 * 60 * 1000; // 10 minutos, per diseño "Hoy en Vivo"

function estadoDeJornada(jornada: JornadaHoy): { label: string; color: string } {
    if (!jornada.ultima_posicion) return { label: 'Sin posición', color: 'gray' };
    const msDesdeUltimoPing = Date.now() - new Date(jornada.ultima_posicion.timestamp_reporte).getTime();
    if (msDesdeUltimoPing > UMBRAL_SIN_SENAL_MS) return { label: 'Sin señal', color: 'gray' };
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

export function FlotaPanel({ jornadas, selectedJornadaId, onSelectJornada }: FlotaPanelProps) {
    const [busqueda, setBusqueda] = useState('');

    const jornadasFiltradas = useMemo(
        () => jornadas.filter((j) => j.nombre_muestreador.toLowerCase().includes(busqueda.toLowerCase())),
        [jornadas, busqueda]
    );

    return (
        <Box style={{ width: 280, borderRight: '1px solid var(--mantine-color-gray-3)', display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box p="sm">
                <Group justify="space-between" mb="xs">
                    <Text fw={700} size="sm">Hoy en vivo</Text>
                    <Badge size="sm" variant="light">{jornadas.length} en terreno</Badge>
                </Group>
                <TextInput
                    placeholder="Buscar muestreador..."
                    size="xs"
                    leftSection={<IconSearch size={14} />}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.currentTarget.value)}
                />
            </Box>
            <ScrollArea style={{ flex: 1 }} p="sm" pt={0}>
                <Stack gap="xs">
                    {jornadasFiltradas.length === 0 && (
                        <Text size="sm" c="dimmed" ta="center" mt="md">
                            No hay muestreadores en terreno en este momento.
                        </Text>
                    )}
                    {jornadasFiltradas.map((j) => {
                        const estado = estadoDeJornada(j);
                        const seleccionada = j.id_jornada === selectedJornadaId;
                        return (
                            <UnstyledButton
                                key={j.id_jornada}
                                onClick={() => onSelectJornada(j.id_jornada)}
                                p="xs"
                                style={{
                                    borderRadius: 8,
                                    border: `1px solid ${seleccionada ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-3)'}`,
                                    backgroundColor: seleccionada ? 'var(--mantine-color-blue-0)' : 'transparent',
                                }}
                            >
                                <Group justify="space-between" wrap="nowrap">
                                    <Text size="sm" fw={600} truncate>{j.nombre_muestreador}</Text>
                                    <Badge size="xs" color={estado.color} variant="dot">{estado.label}</Badge>
                                </Group>
                                <Text size="xs" c="dimmed">
                                    {j.fichas_hoy.length} ficha(s) hoy
                                    {j.ultima_posicion && ` · act. ${tiempoRelativo(j.ultima_posicion.timestamp_reporte)}`}
                                </Text>
                            </UnstyledButton>
                        );
                    })}
                </Stack>
            </ScrollArea>
        </Box>
    );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
npx tsc --noEmit
```

Expected: no new errors referencing `FlotaPanel.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add frontend-adlone/src/features/medio-ambiente/components/FlotaPanel.tsx
git commit -m "feat: add FlotaPanel component (fleet sidebar list)"
```

---

### Task 5: `DetalleJornadaDrawer.tsx`

**Files:**
- Create: `frontend-adlone/src/features/medio-ambiente/components/DetalleJornadaDrawer.tsx`

The right-hand detail drawer from the approved mockup: status, mini-stats (ficha count, start time), and a `Timeline` of today's fichas with completion state. No ETA (explicitly deferred — see the plan header's "Explicitly out of scope" note).

- [ ] **Step 1: Create the component**

Create `frontend-adlone/src/features/medio-ambiente/components/DetalleJornadaDrawer.tsx`:

```tsx
import { Drawer, Text, Timeline, Badge, Group, SimpleGrid, Box } from '@mantine/core';
import { IconCheck, IconClock, IconMapPin } from '@tabler/icons-react';
import type { JornadaHoy } from '../services/tracking.service';

interface DetalleJornadaDrawerProps {
    jornada: JornadaHoy | null;
    opened: boolean;
    onClose: () => void;
}

function fichaCompletada(ficha: JornadaHoy['fichas_hoy'][number]): boolean {
    return ficha.retiro_completado === 'S' || ficha.instalacion_completado === 'S';
}

export function DetalleJornadaDrawer({ jornada, opened, onClose }: DetalleJornadaDrawerProps) {
    if (!jornada) {
        return <Drawer opened={opened} onClose={onClose} position="right" size="sm" title="Detalle" />;
    }

    const indiceActivo = jornada.fichas_hoy.findIndex((f) => !fichaCompletada(f));

    return (
        <Drawer opened={opened} onClose={onClose} position="right" size="sm" title={jornada.nombre_muestreador}>
            <Group mb="md">
                <Badge color={jornada.ultima_posicion ? 'green' : 'gray'} variant="light" leftSection={<IconMapPin size={12} />}>
                    {jornada.ultima_posicion ? 'En ruta' : 'Sin posición'}
                </Badge>
            </Group>

            <SimpleGrid cols={2} mb="md">
                <Box>
                    <Text size="xs" c="dimmed">Fichas hoy</Text>
                    <Text fw={700}>{jornada.fichas_hoy.length}</Text>
                </Box>
                <Box>
                    <Text size="xs" c="dimmed">Inicio jornada</Text>
                    <Text fw={700}>
                        {new Date(jornada.fecha_inicio).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </Box>
            </SimpleGrid>

            <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">Itinerario de hoy</Text>

            {jornada.fichas_hoy.length === 0 ? (
                <Text size="sm" c="dimmed">Sin fichas agendadas hoy.</Text>
            ) : (
                <Timeline active={indiceActivo === -1 ? jornada.fichas_hoy.length : indiceActivo} bulletSize={20}>
                    {jornada.fichas_hoy.map((ficha) => {
                        const completada = fichaCompletada(ficha);
                        return (
                            <Timeline.Item
                                key={ficha.id_agendamam}
                                bullet={completada ? <IconCheck size={12} /> : <IconClock size={12} />}
                                title={ficha.frecuencia_correlativo}
                            >
                                <Text size="xs" c="dimmed">
                                    {completada ? 'Completada' : 'Pendiente'} · {ficha.hora_coordinador || '—'}
                                </Text>
                            </Timeline.Item>
                        );
                    })}
                </Timeline>
            )}
        </Drawer>
    );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
npx tsc --noEmit
```

Expected: no new errors referencing `DetalleJornadaDrawer.tsx`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add frontend-adlone/src/features/medio-ambiente/components/DetalleJornadaDrawer.tsx
git commit -m "feat: add DetalleJornadaDrawer component (sampler itinerary timeline)"
```

---

### Task 6: `HoyEnVivoPage.tsx` + wire into `DashboardPage.tsx`

**Files:**
- Create: `frontend-adlone/src/features/medio-ambiente/pages/HoyEnVivoPage.tsx`
- Modify: `frontend-adlone/src/pages/DashboardPage.tsx`

Composes the three components built in Tasks 3-5, driven by the store from Task 2. Full-height split layout matches the established convention in `RouteMapPlannerView.tsx` (`calc(100vh - 180px)` under `MainLayout`'s chrome).

- [ ] **Step 1: Create the page**

Create `frontend-adlone/src/features/medio-ambiente/pages/HoyEnVivoPage.tsx`:

```tsx
import { useEffect } from 'react';
import { Box, Center, Loader, Text } from '@mantine/core';
import { useAuth } from '../../../contexts/AuthContext';
import { useTrackingStore } from '../../../store/trackingStore';
import { TrackingMapa } from '../components/TrackingMapa';
import { FlotaPanel } from '../components/FlotaPanel';
import { DetalleJornadaDrawer } from '../components/DetalleJornadaDrawer';

export function HoyEnVivoPage() {
    const { token } = useAuth();
    const {
        jornadas,
        loading,
        error,
        selectedJornadaId,
        fetchSnapshot,
        connectSocket,
        disconnectSocket,
        selectJornada,
    } = useTrackingStore();

    useEffect(() => {
        fetchSnapshot();
    }, [fetchSnapshot]);

    useEffect(() => {
        if (!token) return;
        connectSocket(token);
        return () => disconnectSocket();
    }, [token, connectSocket, disconnectSocket]);

    const jornadaSeleccionada = jornadas.find((j) => j.id_jornada === selectedJornadaId) ?? null;

    if (loading && jornadas.length === 0) {
        return (
            <Center style={{ height: 'calc(100vh - 180px)' }}>
                <Loader />
            </Center>
        );
    }

    if (error) {
        return (
            <Center style={{ height: 'calc(100vh - 180px)' }}>
                <Text c="red">{error}</Text>
            </Center>
        );
    }

    return (
        <Box style={{ display: 'flex', height: 'calc(100vh - 180px)', minHeight: 500 }}>
            <FlotaPanel
                jornadas={jornadas}
                selectedJornadaId={selectedJornadaId}
                onSelectJornada={selectJornada}
            />
            <Box style={{ flex: 1, position: 'relative' }}>
                <TrackingMapa
                    jornadas={jornadas}
                    selectedJornadaId={selectedJornadaId}
                    onSelectJornada={selectJornada}
                />
            </Box>
            <DetalleJornadaDrawer
                jornada={jornadaSeleccionada}
                opened={selectedJornadaId !== null}
                onClose={() => selectJornada(null)}
            />
        </Box>
    );
}
```

- [ ] **Step 2: Wire it into `DashboardPage.tsx`**

In `frontend-adlone/src/pages/DashboardPage.tsx`, find the import block (near the top, after the other `medio-ambiente` feature imports):

```tsx
import { FichasIngresoPage } from '../features/medio-ambiente/pages/FichasIngresoPage';
import { CalendarioReplicaPage } from '../features/medio-ambiente/pages/CalendarioReplicaPage';
import { FichaDetailView } from '../features/medio-ambiente/pages/FichaDetailView';
import { RemuestreoPage } from '../features/medio-ambiente/pages/RemuestreoPage';
```

Add right after:

```tsx
import { HoyEnVivoPage } from '../features/medio-ambiente/pages/HoyEnVivoPage';
```

Then find the `renderContent` switch:

```tsx
        if (activeSubmodule === 'ma-fichas-ingreso') return <FichasIngresoPage />;
        if (activeSubmodule === 'ma-ficha-detalle') return <FichaDetailView />;
        if (activeSubmodule === 'ma-remuestreo') return <RemuestreoPage />;
```

Add right after:

```tsx
        if (activeSubmodule === 'ma-hoy-en-vivo') return (
            <ProtectedContent permission="AI_MA_HOY_EN_VIVO">
                <HoyEnVivoPage />
            </ProtectedContent>
        );
```

`ProtectedContent` is already imported at the top of `DashboardPage.tsx` (used elsewhere in the same file, e.g. the `gem-muestreos-completados` case) — this is defense-in-depth alongside the menu-level permission gating from Task 1 (a user could theoretically have `activeSubmodule` set to `'ma-hoy-en-vivo'` via a stale persisted nav state without actually having the permission, if their role was changed after their last login — `ProtectedContent` catches that case).

- [ ] **Step 3: Verify the app builds**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
npx tsc --noEmit
```

Expected: no new errors referencing `HoyEnVivoPage.tsx` or `DashboardPage.tsx`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add frontend-adlone/src/features/medio-ambiente/pages/HoyEnVivoPage.tsx frontend-adlone/src/pages/DashboardPage.tsx
git commit -m "feat: add HoyEnVivoPage and wire it into DashboardPage routing"
```

---

### Task 7: End-to-end verification in a real browser

**Files:** none created — this task verifies Tasks 1-6 together against the real dev backend and a real browser session. No commit at the end (verification-only task).

- [ ] **Step 1: Start both backends**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
npm run dev
```

Leave this running. Check `netstat -ano | findstr :8002` first and kill any stale process if the port is already occupied.

- [ ] **Step 2: Start the frontend dev server**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
npm run dev
```

Note the local URL it prints (typically `http://localhost:5173`).

- [ ] **Step 3: Log in and navigate to Hoy en Vivo**

Use the same dev credentials already confirmed to have the `AI_MA_HOY_EN_VIVO` permission from fase 2's testing:
- username: `vremolcoy`
- password: `1542`

Open the app in a browser, log in, and navigate to Medio Ambiente → Hoy en Vivo (the new sidebar link from Task 1). Confirm:
- The page loads without a console error.
- `FlotaPanel` shows either "No hay muestreadores en terreno en este momento." (if `mam_jornadas` currently has no active row) or a list of active jornadas — check via the DB directly if you need to know which state to expect:

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "
import('./src/config/env.js').then(() => import('./src/config/database.js')).then(async ({ getConnection }) => {
  const pool = await getConnection();
  const r = await pool.request().query('SELECT id_jornada, id_muestreador, fecha_fin FROM mam_jornadas WHERE fecha_fin IS NULL');
  console.log(JSON.stringify(r.recordset));
  process.exit(0);
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
"
```

If there's no active jornada, create one so you have something to see on screen. Use the `api-app-mam` login flow already validated in fase 1 (credentials `achiesa@adldiagnostic.cl` / `12345`, or ask the user for different ones), and call `POST /mamapi/jornada/iniciar` against `api-app-mam` (must also be running — `cd "C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam" && npm run dev` in a third terminal) to create a fresh active jornada that this screen can display.

- [ ] **Step 4: Verify the map renders and a marker appears**

Once a jornada is active but has no position yet, `FlotaPanel` should show it with "Sin posición" and no marker on the map (since `TrackingMapa` filters to `ultima_posicion !== null`). Report a position for it from `api-app-mam` through the real HTTP flow (not a direct DB write), so the fase-2 relay/broadcast path gets exercised too — reusing the exact pattern from fase 1's own end-to-end verification:

```bash
curl -s -X POST http://localhost:8001/mamapi/ubicaciones/reportar \
  -H "Authorization: Bearer <TOKEN_FROM_api-app-mam_LOGIN>" \
  -H "Content-Type: application/json" \
  -d '{"id_jornada": <ID_JORNADA_FROM_STEP_3>, "lat": -33.45, "lon": -70.66}'
```

Expected: within a few seconds (no page refresh needed — this is the live Socket.IO path), a marker appears on the map at that location, and `FlotaPanel`'s row for that sampler flips from "Sin posición" to "En ruta". This is the single most important check in this task — it proves the ENTIRE cross-repo chain works: `api-app-mam` → `api-backend-adlone` → Socket.IO → browser, rendered correctly.

- [ ] **Step 5: Verify the detail drawer**

Click the fleet-panel row (or the map marker). Confirm the `DetalleJornadaDrawer` opens on the right showing the sampler's name, status badge, ficha count, start time, and an itinerary `Timeline` (if `fichas_hoy` is non-empty for that jornada — otherwise "Sin fichas agendadas hoy." is expected and correct).

- [ ] **Step 6: Clean up test state**

If you created a throwaway jornada in Step 3 purely for this verification, terminate it so it doesn't linger as a fake "active" sampler:

```bash
curl -s -X POST http://localhost:8001/mamapi/jornada/terminar \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"id_jornada": <ID_JORNADA>}'
```

Stop all three dev servers (`Ctrl+C` in each terminal, or `taskkill` by PID) when done.

---

### Task 8: Push

- [ ] **Step 1: Push**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git push origin main
```

---

## What fase 4 will need from this plan

Fase 4 (`app-mam`, the mobile app) is already shipped — it's what fases 1-3 consume, not the other way around. There is no fase 5 planned. If ETA-to-next-stop is picked up later as a follow-up, it would extend `tracking.service.ts` (Task 2) to also request destination coordinates (resolved via the existing `GET /api/fichas/resolve-url` endpoint plus URL parsing — a backend change in `api-backend-adlone`, not just this frontend) and add a distance/ETA calculation to `DetalleJornadaDrawer.tsx` (Task 5). Nothing in this plan needs to change to support that later — the component boundaries already separate "data" (store/service) from "presentation" (the three components) cleanly.
