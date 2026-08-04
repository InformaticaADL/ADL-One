# Hoy en Vivo — Fase 4: app-mam (botón Iniciar/Terminar Jornada + reporte GPS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing mobile-app piece of "Hoy en Vivo": a real "Iniciar/Terminar Jornada" control in the app's Menu screen that a field sampler actually taps, backed by a helper that calls the already-shipped `api-app-mam` tracking endpoints and periodically reports GPS position while a jornada is active.

**Architecture:** A new `utils/trackingHelper.js` owns the jornada lifecycle: starting/stopping the backend jornada record, starting/stopping `expo-location`'s `watchPositionAsync` (foreground only — matches the design's "continuous, foreground" decision from fase 1, no background-location permission needed), and persisting jornada state in `AsyncStorage` so a killed/restarted app resumes reporting instead of silently going quiet mid-shift. `screens/MenuScreen.jsx` gets one new icon button in its existing header action row (next to the offline-mode toggle) plus a mount-time check that resumes an already-active jornada.

**Tech Stack:** React Native / Expo, `expo-location` (already a dependency, already used in `IngresoFotosScreen.jsx`/`utils/rutasHelper.js` for one-shot location reads — this task is the first use of its continuous `watchPositionAsync`), `AsyncStorage`, the existing `api` axios instance from `api/apiConfig.js`.

**Repo:** `C:\Users\vremolcoy\Desktop\APP MAM\app-mam` — its own separate git repo (NOT part of the `ADL-One` monorepo used by fases 2-3), branch `main`. All git commands in this plan run from this directory directly.

**Depends on (already shipped, fase 1):** `api-app-mam`'s `POST /mamapi/jornada/iniciar`, `POST /mamapi/jornada/terminar`, `POST /mamapi/ubicaciones/reportar` — already implemented, reviewed, and verified via curl in an earlier phase. This plan is what finally lets a real muestreador trigger them from the app instead of a terminal.

**No new Android permission needed:** `expo-location` is already installed and its Expo config plugin auto-configures `ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION` at build time — confirmed by the fact `Location.requestForegroundPermissionsAsync()` already works in this codebase (`screens/IngresoFotosScreen.jsx:162`). `app.json`'s `permissions` array only lists EXTRA permissions beyond what plugins auto-add (camera, mic, notifications, storage) — location isn't in that list because it doesn't need to be. This plan does not touch `app.json`.

---

### Task 1: `utils/trackingHelper.js` — jornada lifecycle + GPS watch

**Files:**
- Create: `app-mam/utils/trackingHelper.js`

Follows this codebase's established API-call pattern (`const token = await obtenerToken(); api.post(url, body, { headers: { Authorization: `Bearer ${token}` } })`, matching `utils/dataLayer.js`'s style throughout) and its `expo-location` usage pattern (`Location.requestForegroundPermissionsAsync()` + `Location.Accuracy.Balanced`, matching `screens/IngresoFotosScreen.jsx` and `utils/rutasHelper.js`).

- [ ] **Step 1: Create the helper**

Create `app-mam/utils/trackingHelper.js`:

```js
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api/apiConfig';
import { obtenerToken } from './borradorHelper';
import logger from './logger';

const KEY_JORNADA_ACTIVA = 'jornada_tracking_activa';
const KEY_JORNADA_ID = 'jornada_tracking_id';

// Cada 45s mientras la jornada está activa (rango 30-60s de la fase 1 del
// diseño). Se reporta por tiempo, no por distancia (distanceInterval: 0):
// un muestreador detenido también debe seguir emitiendo pings, o el
// supervisor lo vería incorrectamente como "sin señal".
const INTERVALO_REPORTE_MS = 45000;

let watchSubscription = null;

/**
 * Devuelve la jornada activa persistida localmente, si existe. No consulta al
 * backend — solo lee lo que esta misma app guardó al iniciarla.
 */
export async function obtenerJornadaActivaLocal() {
    const activa = await AsyncStorage.getItem(KEY_JORNADA_ACTIVA);
    if (activa !== 'true') return null;
    const idJornada = await AsyncStorage.getItem(KEY_JORNADA_ID);
    if (!idJornada) return null;
    return { id_jornada: Number(idJornada) };
}

async function reportarPosicion(idJornada, lat, lon) {
    try {
        const token = await obtenerToken();
        if (!token) return;
        await api.post(
            '/ubicaciones/reportar',
            { id_jornada: idJornada, lat, lon },
            { headers: { Authorization: `Bearer ${token}` } }
        );
    } catch (error) {
        // No crítico: si falla un ping puntual (sin señal, backend caído), el
        // siguiente intento en INTERVALO_REPORTE_MS lo intenta de nuevo. No
        // hay cola offline para esto — a diferencia de guardar una ficha, un
        // ping de posición vencido no tiene valor si llega tarde.
        logger.warn('[Tracking] No se pudo reportar posición:', error.message);
    }
}

function iniciarWatchGPS(idJornada) {
    detenerWatchGPS();
    Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: INTERVALO_REPORTE_MS, distanceInterval: 0 },
        (location) => {
            reportarPosicion(idJornada, location.coords.latitude, location.coords.longitude);
        }
    ).then((sub) => {
        watchSubscription = sub;
    }).catch((error) => {
        logger.warn('[Tracking] No se pudo iniciar el seguimiento GPS:', error.message);
    });
}

function detenerWatchGPS() {
    if (watchSubscription) {
        watchSubscription.remove();
        watchSubscription = null;
    }
}

/**
 * Inicia una jornada de tracking: pide permiso de ubicación, crea la jornada
 * en el backend, persiste su id localmente y arranca el reporte periódico.
 * @returns {Promise<{ok: true, id_jornada: number} | {ok: false, error: string}>}
 */
export async function iniciarJornada() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        return { ok: false, error: 'Se necesita permiso de ubicación para iniciar la jornada.' };
    }

    try {
        const token = await obtenerToken();
        if (!token) return { ok: false, error: 'Sesión inválida. Vuelve a iniciar sesión.' };

        const response = await api.post('/jornada/iniciar', {}, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const idJornada = response.data.id_jornada;
        await AsyncStorage.setItem(KEY_JORNADA_ACTIVA, 'true');
        await AsyncStorage.setItem(KEY_JORNADA_ID, String(idJornada));

        iniciarWatchGPS(idJornada);

        return { ok: true, id_jornada: idJornada };
    } catch (error) {
        logger.warn('[Tracking] Error al iniciar jornada:', error.message);
        return { ok: false, error: 'No se pudo iniciar la jornada. Verifica tu conexión.' };
    }
}

/**
 * Termina la jornada activa: detiene el GPS, avisa al backend, y limpia el
 * estado local. Es tolerante a fallos de red — si el backend no responde, la
 * jornada igual se marca localmente como terminada (el backend la
 * auto-cerrará a las 21:00 si quedó "olvidada" — ver fase 1).
 */
export async function terminarJornada() {
    detenerWatchGPS();

    const idJornada = await AsyncStorage.getItem(KEY_JORNADA_ID);

    await AsyncStorage.setItem(KEY_JORNADA_ACTIVA, 'false');
    await AsyncStorage.removeItem(KEY_JORNADA_ID);

    if (!idJornada) return { ok: true };

    try {
        const token = await obtenerToken();
        if (!token) return { ok: true };
        await api.post('/jornada/terminar', { id_jornada: Number(idJornada) }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        return { ok: true };
    } catch (error) {
        logger.warn('[Tracking] Error al terminar jornada en el backend (ya se limpió localmente):', error.message);
        return { ok: true };
    }
}

/**
 * Llamar al montar la pantalla principal: si el dispositivo tiene una
 * jornada activa persistida (p.ej. la app se cerró/mató a mitad de turno),
 * retoma el reporte GPS sin que el usuario tenga que volver a tocar el botón.
 */
export async function reanudarJornadaSiActiva() {
    const jornada = await obtenerJornadaActivaLocal();
    if (!jornada) return null;
    iniciarWatchGPS(jornada.id_jornada);
    return jornada;
}
```

- [ ] **Step 2: Verify the module has no syntax errors**

This project has no TypeScript/`tsc` step and no test framework for `app-mam`'s JS files (React Native's Babel/Metro transform is needed for the `import`/`export` syntax, so plain Node can't parse the file directly outside the app). Do a lightweight sanity check that the four expected functions are actually exported, before wiring the file into the UI in Task 2 (where Metro's own bundler will do the real syntax check when it tries to import this file):

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\app-mam"
node -e "
const fs = require('fs');
const content = fs.readFileSync('utils/trackingHelper.js', 'utf8');
const requiredExports = ['obtenerJornadaActivaLocal', 'iniciarJornada', 'terminarJornada', 'reanudarJornadaSiActiva'];
const missing = requiredExports.filter(name => !content.includes('export async function ' + name) && !content.includes('export function ' + name));
if (missing.length > 0) {
    console.error('FAIL: missing expected exports:', missing.join(', '));
    process.exit(1);
}
console.log('OK: all four expected exports are present in trackingHelper.js.');
"
```

Expected: `OK: all four expected exports are present in trackingHelper.js.`

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\app-mam"
git add utils/trackingHelper.js
git commit -m "feat: add trackingHelper (jornada lifecycle + periodic GPS reporting)"
```

---

### Task 2: Wire the toggle into `MenuScreen.jsx`

**Files:**
- Modify: `app-mam/screens/MenuScreen.jsx`

Adds one icon button to the existing header action row (alongside the sync and offline-mode buttons, `screens/MenuScreen.jsx:1077-1123`), state to track whether a jornada is active, a confirmation-gated toggle handler (matching this file's existing `showCustomAlert` pattern), and a mount-time resume check.

- [ ] **Step 1: Add the import**

In `app-mam/screens/MenuScreen.jsx`, find this existing import (around line 63):

```js
import { resolverCoordenadas, construirUrlRuta, obtenerUbicacionActual, isUrlValida } from '../utils/rutasHelper';
```

Add right after it:

```js
import { iniciarJornada, terminarJornada, reanudarJornadaSiActiva, obtenerJornadaActivaLocal } from '../utils/trackingHelper';
```

- [ ] **Step 2: Add state and the mount-time resume check**

Find the existing state declaration (around line 215):

```js
    const [pendientesCount, setPendientesCount] = useState(0);
```

Add right after it:

```js
    const [jornadaActiva, setJornadaActiva] = useState(false);
    const [jornadaCargando, setJornadaCargando] = useState(false);
```

Find the component's other top-level `useEffect` hooks (there are several already, e.g. the one starting `useEffect(() => { yaCargoDatos.current = false; }, [offlineMode]);` around line 556) and add a new one anywhere in that same group:

```js
    // Si el dispositivo tiene una jornada de tracking activa (p.ej. la app se
    // cerró/mató a mitad de turno), retoma el reporte GPS al abrir el Menú sin
    // que el usuario tenga que volver a tocar el botón.
    useEffect(() => {
        obtenerJornadaActivaLocal().then((jornada) => {
            if (jornada) {
                reanudarJornadaSiActiva();
                setJornadaActiva(true);
            }
        });
    }, []);
```

- [ ] **Step 3: Add the toggle handler**

Find the existing `handleOfflineToggle` function (around line 855):

```js
    const handleOfflineToggle = async () => {
        if (offlineMode) {
            setOfflineMode(false);
            setIsOffline(false);
            await AsyncStorage.setItem("modo_offline_manual", "false");
            navigation.setParams({ offlineMode: false });
            setTimeout(() => fetchFichas(), 1500);
        } else {
            setOfflineMode(true);
            setIsOffline(true);
            await AsyncStorage.setItem("modo_offline_manual", "true");
            navigation.setParams({ offlineMode: true });
            cargarDatosLocales();
        }
    };
```

Add right after it:

```js
    const handleToggleJornada = () => {
        if (jornadaCargando) return;

        if (jornadaActiva) {
            showCustomAlert({
                title: 'Terminar jornada',
                message: '¿Terminar tu jornada de seguimiento? El supervisor dejará de ver tu ubicación en vivo.',
                type: 'warning',
                showCancel: true,
                confirmText: 'Terminar',
                cancelText: 'Cancelar',
                onConfirm: async () => {
                    hideCustomAlert();
                    setJornadaCargando(true);
                    await terminarJornada();
                    setJornadaActiva(false);
                    setJornadaCargando(false);
                },
            });
            return;
        }

        showCustomAlert({
            title: 'Iniciar jornada',
            message: 'Tu supervisor podrá ver tu ubicación en el mapa "Hoy en Vivo" mientras la jornada esté activa.',
            type: 'info',
            showCancel: true,
            confirmText: 'Iniciar',
            cancelText: 'Cancelar',
            onConfirm: async () => {
                hideCustomAlert();
                setJornadaCargando(true);
                const resultado = await iniciarJornada();
                setJornadaCargando(false);
                if (resultado.ok) {
                    setJornadaActiva(true);
                } else {
                    showCustomAlert({
                        title: 'No se pudo iniciar',
                        message: resultado.error,
                        type: 'error',
                        showCancel: false,
                    });
                }
            },
        });
    };
```

- [ ] **Step 4: Add the button to the header**

Find the existing offline-mode toggle button in the header actions row (around line 1113):

```jsx
                            <TouchableOpacity
                                onPress={handleOfflineToggle}
                                style={[styles.iconBtn, offlineMode && styles.activeOfflineBtn]}
                            >
                                <Ionicons
                                    name={offlineMode ? "cloud-offline-outline" : "wifi-outline"}
                                    size={22}
                                    color="rgba(255,255,255,0.85)"
                                />
                            </TouchableOpacity>
```

Add a new button right after it, inside the same `styles.headerActions` container:

```jsx
                            <TouchableOpacity
                                onPress={handleToggleJornada}
                                disabled={jornadaCargando}
                                style={[styles.iconBtn, jornadaActiva && styles.activeOfflineBtn]}
                            >
                                <Ionicons
                                    name={jornadaActiva ? "navigate" : "navigate-outline"}
                                    size={22}
                                    color="rgba(255,255,255,0.85)"
                                />
                            </TouchableOpacity>
```

(Reusing `styles.activeOfflineBtn` for the "active" highlight state — it's a generic "this toggle is on" style already defined in this file's `StyleSheet`, not offline-specific despite the name; matches how it's already used for a single other toggle button, and avoids introducing a near-duplicate style block for the same visual treatment.)

- [ ] **Step 5: Verify the app starts**

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\app-mam"
npx expo start
```

Expected: Metro bundler starts without a syntax/import error. Open it on a device or emulator (press `a` for Android in the Expo CLI, or scan the QR code with Expo Go) and confirm the Menu screen loads with the new location-pin icon button visible in the header, next to the wifi/offline icon. Stop the dev server (`Ctrl+C`) once confirmed — full interactive testing happens in Task 3.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\app-mam"
git add screens/MenuScreen.jsx
git commit -m "feat: add Iniciar/Terminar Jornada toggle to MenuScreen header"
```

---

### Task 3: End-to-end verification with the real app and the real "Hoy en Vivo" map

**Files:** none created — this task verifies Tasks 1-2 against the real dev backend, using the actual app UI this time (not curl simulating it), while watching ADL ONE Web's live map update in real time. No commit at the end (verification-only task).

- [ ] **Step 1: Start all three backends**

Terminal 1:
```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam"
npm run dev
```

Terminal 2:
```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
npm run dev
```

Terminal 3:
```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
npm run dev
```

Check each port isn't already occupied by a stale process first (`netstat -ano | findstr :8001`, `:8002`, `:5173` respectively) and kill/retry if needed.

- [ ] **Step 2: Open "Hoy en Vivo" in a browser, logged in as a supervisor**

Open the frontend's local URL (typically `http://localhost:5173`), log in as `vremolcoy` / `1542` (confirmed in an earlier phase to have the `AI_MA_HOY_EN_VIVO` permission), navigate to Medio Ambiente → Hoy en Vivo. Leave this tab open and visible — you'll watch it update live in Step 4.

- [ ] **Step 3: Start the mobile app and log in as a muestreador**

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\app-mam"
npx expo start
```

Open it on a real device or emulator. Log in with `achiesa@adldiagnostic.cl` / `12345` (confirmed working dev credentials from an earlier phase). Make sure the device/emulator has location services enabled at the OS level (Android Settings → Location → On) — this is separate from the in-app permission prompt and is often the actual reason `watchPositionAsync` silently never fires in an emulator.

- [ ] **Step 4: Tap "Iniciar jornada" and watch the map**

In the app's Menu screen, tap the new location-pin icon in the header. Confirm the dialog, grant the location permission if prompted. Confirm:
- The button visually flips to its "active" state (filled `navigate` icon instead of outline).
- Within ~45 seconds (the report interval), switch to the browser tab from Step 2 and confirm a new marker appears on the map for this muestreador, and the `FlotaPanel` row shows "En ruta" with a recent "act. hace X s/min" timestamp.
- Click the marker or the panel row — confirm `DetalleJornadaDrawer` opens showing the muestreador's name and today's itinerary (if any fichas are scheduled today for this account — if not, "Sin fichas agendadas hoy." is expected and correct).

This is the single most important check in the entire 4-phase feature: it proves a real person tapping a real button in the real app produces a real, live-updating dot on a supervisor's real map, with no simulation anywhere in the chain.

- [ ] **Step 5: Verify app-restart resilience**

While the jornada is still active, fully close the app (swipe it away from Android's recent-apps list, not just background it) and reopen it. Confirm:
- The header button still shows the "active" state on the Menu screen (proving `reanudarJornadaSiActiva()`'s mount-time check worked).
- Position updates keep arriving on the "Hoy en Vivo" map after the restart (wait ~45s and check for a fresh timestamp), proving the GPS watch actually resumed, not just the UI's visual state.

- [ ] **Step 6: Tap "Terminar jornada" and confirm cleanup**

Tap the header button again, confirm the "terminar" dialog. Confirm:
- The button returns to its inactive state.
- On the "Hoy en Vivo" map, this muestreador's jornada disappears from the `FlotaPanel` list (since `GET /api/tracking/hoy`/the store only track jornadas with `fecha_fin IS NULL`, and terminating sets `fecha_fin`).
- No further position updates arrive for this muestreador after terminating, even if you wait past another 45s interval (confirms `detenerWatchGPS()` actually stopped the subscription, not just that the backend started rejecting late pings).

- [ ] **Step 7: Clean up**

Stop all dev servers (`Ctrl+C` in each terminal). No database cleanup needed — Step 6 already terminated the jornada through the normal flow, which is the correct, realistic end state (not test data to delete).

---

### Task 4: Push

- [ ] **Step 1: Push**

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\app-mam"
git push origin main
```

---

## Feature complete

With this phase, all 4 phases of "Hoy en Vivo" are done: `app-mam` (this phase — the real button + GPS reporting), `api-app-mam` (fase 1 — jornada/position endpoints), `api-backend-adlone` (fase 2 — relay + Socket.IO broadcast + snapshot), `frontend-adlone` (fase 3 — the live map UI). There is no fase 5 planned. Remaining work outside this plan's scope: running all the shipped SQL migrations against the production database, and deploying the updated code in all four repos to their production servers.
