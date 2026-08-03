# Hoy en Vivo — Tracking en tiempo real de muestreadores en terreno

**Fecha:** 2026-08-03
**Estado:** Diseño aprobado, pendiente de plan de implementación

## Contexto y objetivo

ADL ONE es el software web previo a la app móvil ADL SAMPLING: maneja solicitudes, fichas, tablas maestras y todo el flujo administrativo. La app móvil (React Native / Expo) es usada por muestreadores en terreno para ejecutar los muestreos agendados, con soporte offline-first.

Se quiere dar a supervisores/jefatura una vista tipo "Uber Live" dentro de ADL ONE: ver en un mapa dónde está cada muestreador en este momento, qué paradas (fichas) tiene agendadas hoy, cuánto le falta para llegar a la próxima, y el estado de cada ficha (pendiente / en curso / subida OK).

## Alcance de esta versión (v1)

**Incluido:**
- Mapa en vivo con posición de muestreadores en jornada activa.
- Panel lateral de flota con estado, progreso de fichas y última actualización.
- Drawer de detalle por muestreador: itinerario del día (timeline), ETA a la próxima parada, mini-estadísticas (fichas completadas, km recorridos, hora de inicio).
- Control manual de jornada desde la app (Iniciar/Terminar) que activa/desactiva el tracking.
- Permiso dedicado en ADL ONE y retención de 30 días de historial de posiciones.

**Explícitamente fuera de v1** (evaluar en v2 con datos reales de uso):
- Alertas automáticas (atraso, muestreador detenido, sin señal prolongado).
- Motor de rutas por carretera (ETA es estimación por distancia/velocidad promedio, no ruta real).
- Reproducción histórica de recorridos pasados (solo se muestra el día actual; el historial de 30 días queda en BD para auditoría/soporte, no expuesto en UI todavía).

## Decisiones de diseño

### Modo de tracking: continuo, foreground, jornada manual
El muestreador reporta posición cada 30-60 segundos mientras tiene una **jornada activa**, que él mismo inicia/termina con un botón en el Menú de la app (`MenuScreen.jsx`). No es tracking en segundo plano (no requiere `ACCESS_BACKGROUND_LOCATION` en Android, evitando la revisión de permisos sensibles de Google Play) — el GPS captura mientras la app está abierta, igual que hoy hace `IngresoTerrenoModal` para coordenadas de ficha.

Auto-fin de jornada a las 21:00 si el usuario olvida cerrarla, para no drenar batería ni dejar un estado "activo" fantasma de un día para otro.

### Mapa: OpenStreetMap + MapLibre/Leaflet, sin motor de rutas
Sin costo ni API keys. ETA calculada por distancia en línea recta entre la última posición conocida y la coordenada de la parada agendada, dividida por una velocidad promedio configurable (ej. 45 km/h en zona rural). Se muestra siempre como aproximación ("~25 min"), nunca como precisión de minuto exacto.

### Acceso: permiso dedicado + retención 30 días
Nuevo permiso `AI_MA_HOY_EN_VIVO` en el sistema de permisos de ADL ONE (mismo patrón `hasPermission` que el resto de la app), asignable a supervisores/jefatura desde el admin. Las posiciones GPS se conservan 30 días y se purgan automáticamente vía un job del scheduler existente (`src/utils/scheduler.js`).

### Layout: mapa protagonista (A) + drawer de detalle (B)
Panel de flota fijo a la izquierda con cada muestreador (estado por color, progreso, última actualización). Mapa centrado. Al hacer clic en un muestreador se abre un drawer sobre el mapa (lado derecho) con: estado actual + velocidad, mini-estadísticas del día, y un timeline (paradas del día con hora real, estado de subida, ETA a la siguiente). El drawer se cierra volviendo a la vista de flota completa.

Ver mockup validado en `.superpowers/brainstorm/522-1785786133/content/layout-combinado.html`.

## Arquitectura

```
App ADL SAMPLING ──POST /mamapi/ubicaciones/reportar──► api-app-mam
  (jornada activa,                                       (guarda en tabla nueva,
   ping cada 30-60s)                                       ADL_ONE_DB compartida)
                                                                  │
                                                    POST interno (protectInternalService)
                                                                  ▼
                                                          api-backend-adlone
                                                                  │
                                                     global.io.to('hoy_en_vivo').emit(...)
                                                                  ▼
                                                          frontend-adlone
                                                     (Mantine + MapLibre, Socket.IO
                                                      ya inicializado en useNotificationStore)
```

La app **solo habla con api-app-mam** (`/mamapi`), consistente con la arquitectura actual — no se le agrega una segunda API ni un segundo JWT. api-app-mam reenvía a ADL ONE de forma *fire-and-forget*, reutilizando el mismo patrón ya probado en `fichaIngresoServicioController.js` para la notificación de "muestreo completado" (línea ~1885): si ADL ONE está caído, la posición ya quedó persistida en BD y el frontend la recupera al reconectar, sin perder tracking.

## Componentes

### App móvil (`app-mam/`)
- **`utils/ubicacionTrackingHelper.js`** (nuevo): usa `expo-location` (`watchPositionAsync`, `timeInterval: 30000-60000`) mientras `jornada_activa` es true. Encola reportes fallidos con el mismo mecanismo de `syncQueueHelper.js` (nuevo tipo `REPORT_UBICACION`), reintentando al reconectar — igual que equipos/firmas offline.
- **`screens/MenuScreen.jsx`**: botón Iniciar/Terminar jornada. Guarda `jornada_activa` + `jornada_id` en AsyncStorage; dispara `startWatching()`/`stopWatching()`.
- Permisos Android: reutiliza `ACCESS_FINE_LOCATION` (ya declarado); **no** se agrega `ACCESS_BACKGROUND_LOCATION`.

### `api-app-mam/`
- `POST /mamapi/ubicaciones/reportar` (protegido con `protectRoute`, el JWT de usuario existente): guarda en tabla nueva `mam_ubicaciones_tracking` y reenvía a ADL ONE.
- `POST /mamapi/jornada/iniciar` y `POST /mamapi/jornada/terminar`: crean/cierran el registro de jornada, independiente del último ping (para poder distinguir "sin señal" de "jornada terminada").

### `api-backend-adlone/`
- `routes/tracking.routes.js` → `controllers/tracking.controller.js`: endpoint interno protegido con `protectInternalService` que recibe la posición reenviada y emite `posicion_actualizada` a la sala Socket.IO `hoy_en_vivo`.
- `services/tracking.service.js`: arma el estado inicial (`GET /api/tracking/hoy`) combinando jornadas activas + última posición + fichas agendadas del día (join con `FichaIngresoServicio_ENC` / `AgendaMuestreo`).
- Permiso nuevo `AI_MA_HOY_EN_VIVO`.
- Job de purga (30 días) registrado en `initScheduler()`.

### `frontend-adlone/`
- Nueva feature `src/features/medio-ambiente/hoy-en-vivo/`:
  - `pages/HoyEnVivoPage.tsx`
  - `components/PanelFlota.tsx`
  - `components/DrawerDetalle.tsx`
  - `components/MapaTracking.tsx` (MapLibre + tiles OSM)
  - `services/tracking.service.ts`
- Se conecta a la sala `hoy_en_vivo` reutilizando el Socket.IO ya inicializado en `useNotificationStore`.
- Nuevo submódulo en `useNavStore` bajo Medio Ambiente, visible solo con el permiso `AI_MA_HOY_EN_VIVO` (patrón `hasPermission` estándar del proyecto).

## Flujo de datos

1. Muestreador toca "Iniciar jornada" → `POST /mamapi/jornada/iniciar` crea el registro y arranca el GPS local.
2. Supervisor abre "Hoy en vivo" → `GET /api/tracking/hoy` trae el snapshot inicial (jornadas activas, última posición de cada una, fichas del día ordenadas por hora con su estado) — así el panel pinta correctamente sin depender de que ya haya llegado un ping por socket.
3. Cada ping (30-60s) viaja app → api-app-mam → ADL ONE → socket → frontend, actualizando en vivo posición y "hace cuánto se actualizó" sin recargar la página.
4. Al subirse una ficha (flujo normal existente), ADL ONE ya recibe el aviso de "muestreo-completado" (integración existente) — se reutiliza ese mismo evento para tachar la parada en el timeline del drawer, sin inventar un mensaje nuevo.
5. Fin de jornada (manual o auto-fin 21:00) emite `jornada_finalizada`; el muestreador pasa a estado gris "jornada terminada" (distinto de "sin señal", para no generar alarma falsa).

## Manejo de errores

- **Sin señal en terreno**: la app guarda posiciones localmente (mismo patrón que `syncQueueHelper`) y las sube en lote al reconectar. El panel muestra "sin señal hace X min" pasado un umbral de 10 minutos sin ping nuevo — nunca "desconectado", para no generar pánico por una zona con mala cobertura.
- **ADL ONE caído al llegar un ping**: el POST interno falla silenciosamente (la posición ya está en BD). Al recuperarse, el frontend reobtiene el estado real vía `GET /api/tracking/hoy` al reconectar el socket.
- **GPS deshabilitado en el teléfono**: aviso no bloqueante en la app (no impide seguir trabajando la ficha); el panel del supervisor simplemente deja de recibir pings y cae en "sin señal".
- **Supervisor sin permiso `AI_MA_HOY_EN_VIVO`**: el submódulo no aparece en la navegación.
- **Jornada olvidada abierta**: auto-fin a las 21:00.

## Testing

- **Backend**: tests de integración para `/mamapi/ubicaciones/reportar` (persistencia + disparo del POST interno mockeado) y para el endpoint interno de ADL ONE (verificar el `emit` de socket con un cliente Socket.IO de prueba).
- **Frontend**: verificación manual guiada (consistente con el patrón actual del proyecto, sin suite automatizada de UI) — reconexión de socket, apertura/cierre del drawer, cálculo de ETA con datos mock.
- **App móvil**: prueba de campo con modo avión intermitente para validar la cola offline de posiciones; medición de consumo de batería en una jornada completa (8h) como criterio de aceptación antes de liberar a todos los muestreadores.

## Fuera de alcance / decisiones diferidas

- Alertas automáticas (atrasos, detenido mucho tiempo, sin señal prolongado): evaluar en v2 con datos reales de uso, para evitar falsas alarmas por mala calibración de umbrales.
- Motor de rutas real (OSRM u otro): si la precisión de ETA por distancia recta resulta insuficiente en la práctica.
- Vista de reproducción histórica de recorridos pasados.
