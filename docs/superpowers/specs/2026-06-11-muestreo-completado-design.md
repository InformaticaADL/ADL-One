# Notificación "Muestreo Completado" — Diseño

## Contexto

La app móvil APP MAM permite a los muestreadores completar un muestreo en
terreno (`POST /mamapi/ficha/subir-muestreo`, manejado por
`crearMuestreo` en `api-app-mam/controllers/fichaIngresoServicioController.js`).

Ese endpoint marca `App_Ma_Agenda_MUESTREOS.id_estadomuestreo = 3` (Ejecutado)
exactamente cuando:

```js
esProcesoTermino && camposCompletado.retiro_completado === 'S'
```

Esta única condición cubre los dos casos pedidos por el usuario:
- **Puntual** (`esProcesoUnico`): una sola subida marca `instalacion_completado='S'`
  y `retiro_completado='S'` a la vez → la condición es verdadera de inmediato.
- **Compuesta**: la condición solo es verdadera cuando se completa el
  **segundo proceso (retiro)**.

`api-app-mam` y `api-backend-adlone` comparten la misma base de datos
(`ADL_ONE_DB`). `api-app-mam` ya tiene un job de polling análogo
(`jobs/fichasNuevasPushJob.js`) que usa una tabla/columna de control para no
re-notificar. Replicaremos ese patrón pero del lado de `api-backend-adlone`,
reutilizando el "Vigilante" (`pollNewRequests`) ya existente en
`src/utils/scheduler.js`, que sigue exactamente esta forma:
consultar filas con flag de notificación pendiente → construir contexto →
`unsService.trigger(...)` → marcar flag.

Esto evita tocar `api-app-mam` y no requiere coordinar secretos/env vars
entre los dos repos.

## 1. Migración de BD

Agregar columna de control a `App_Ma_Agenda_MUESTREOS`:

```sql
ALTER TABLE App_Ma_Agenda_MUESTREOS
ADD notificado_completado BIT NOT NULL CONSTRAINT DF_AMAM_notif_completado DEFAULT 0;
```

Archivo: `api-backend-adlone/database/add_notificado_completado.sql`.

**Baseline**: al igual que `fichasNuevasPushJob.js`, el primer poll después de
desplegar este cambio NO debe notificar retroactivamente todos los registros
ya `id_estadomuestreo = 3` existentes. La migración SQL incluye, además del
`ALTER TABLE`, un `UPDATE` que marca como `notificado_completado = 1` todas
las filas que YA estén en `id_estadomuestreo = 3` en el momento de aplicar la
migración. Solo los muestreos que se completen DESPUÉS de la migración
generarán notificación.

## 2. Job de polling (`api-backend-adlone/src/utils/scheduler.js`)

Nueva función `pollMuestreosCompletados`, agregada junto a `pollNewRequests`:

- Consulta cada 20s (mismo intervalo que el Vigilante):
  ```sql
  SELECT TOP 10
      a.id_agendamam,
      a.id_fichaingresoservicio,
      a.frecuencia_correlativo,
      e.id_usuario as id_usuario_propietario,
      e.tipo_fichaingresoservicio as tipo_ficha,
      e.fichaingresoservicio as correlativo_txt,
      COALESCE(m2.nombre_muestreador, m1.nombre_muestreador) as nombre_muestreador
  FROM App_Ma_Agenda_MUESTREOS a
  INNER JOIN App_Ma_FichaIngresoServicio_ENC e ON e.id_fichaingresoservicio = a.id_fichaingresoservicio
  LEFT JOIN mae_muestreador m1 ON a.id_muestreador = m1.id_muestreador
  LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
  WHERE a.id_estadomuestreo = 3
    AND (a.notificado_completado = 0 OR a.notificado_completado IS NULL)
  ORDER BY a.id_agendamam ASC
  ```
- Para cada fila:
  1. Llama `fichaService.getFichaContextForNotification(id_fichaingresoservicio, nombre_muestreador, 'Muestreo Completado', pool)`.
  2. Llama `unsService.trigger('FICHA_MUESTREO_COMPLETADO', { ...baseContext, correlativo: (correlativo_txt || String(id_fichaingresoservicio)).trim(), id_usuario_propietario, id_usuario_accion: 0 })`.
  3. `UPDATE App_Ma_Agenda_MUESTREOS SET notificado_completado = 1 WHERE id_agendamam = @id` (siempre, incluso si el trigger falla, igual que el Vigilante hace con `notificado_uns = 1` — para no reintentar infinitamente un evento problemático; los errores quedan en logs).

`_pollRunning` guard reutilizando el mismo flag o uno nuevo (`_pollMuestreosRunning`)
para evitar solapamiento, y se agrega `setInterval(pollMuestreosCompletados, 20 * 1000)`
junto al resto.

No se incluye bloque especial `fichaServicios` (sin lista de servicios) — el
correo es un aviso simple por ficha.

## 3. Configuración del email (`ficha.config.js`)

Nueva entrada:

```js
{
    codigo: 'FICHA_MUESTREO_COMPLETADO',
    categoria: 'FICHA',
    outcome: 'INFORMATIVA',
    asunto: 'Muestreo Completado - Ficha #{CORRELATIVO}',
    titulo: 'Muestreo Completado',
    resumen: 'Se completó el muestreo de la ficha #{CORRELATIVO}.',
    campos: FICHA_CAMPOS_BASE,
    eventoMeta: EVENTO_META,
    cta: CTA_EJECUTADOS,
},
```

Donde `EVENTO_META.usuario` resuelve a `nombre_muestreador` (quien completó el
proceso final), vía `getFichaContextForNotification`'s parámetro `usuario`.

Nuevo CTA:

```js
const CTA_EJECUTADOS = { label: 'Ver Muestreos Ejecutados', ruta: '/?vista=ejecutados' };
```

## 4. Deep-link `/?vista=ejecutados` (frontend)

`frontend-adlone/src/App.tsx`: extender el `useEffect` existente que parsea
`window.location.search`:

```tsx
} else if (vista === 'calendario') {
  ...
} else if (vista === 'ejecutados') {
  setActiveModule('medio_ambiente');
  setActiveSubmodule('ma-fichas-ingreso');
  setFichasMode('list_ejecutados');
  window.history.replaceState({}, '', '/');
}
```

`fichasMode: 'list_ejecutados'` ya existe en `useNavStore` y renderiza
`MuestreosEjecutadosListView` desde `FichasIngresoPage.tsx`. No se requieren
cambios adicionales en el store ni en `FichasIngresoPage.tsx`.

## 5. Recipients / administrabilidad desde el Hub

- Agregar `'FICHA_MUESTREO_COMPLETADO'` al array `eventsForOwner` en
  `uns.service.js` (~línea 700), junto a `'FICHA_ASIGNADA'`. Esto notifica por
  defecto al propietario de la ficha (`id_usuario_propietario`), igual que los
  demás eventos FICHA_*.
- Migración para que el evento aparezca en el Hub de Notificaciones: insertar
  fila en `mae_evento_notificacion`, reutilizando el mismo `id_funcionalidad`
  que `FICHA_ASIGNADA` (misma sección del Hub):

  ```sql
  INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, id_funcionalidad)
  SELECT 'FICHA_MUESTREO_COMPLETADO', 'Muestreo Completado', 'Muestreo Completado - Ficha #{CORRELATIVO}', id_funcionalidad
  FROM mae_evento_notificacion
  WHERE codigo_evento = 'FICHA_ASIGNADA';
  ```

  Archivo: `api-backend-adlone/database/add_muestreo_completado_event.sql`.
  Una vez insertado, los administradores pueden agregar roles/usuarios
  adicionales (Email/Web) desde `NotificationHub.tsx` sin más cambios de
  código.

## 6. Testing

- `renderer.test.js`: nuevo test para `FICHA_MUESTREO_COMPLETADO` —
  verifica asunto, título, campos, `eventoMeta` (usuario = muestreador) y CTA
  apuntando a `/?vista=ejecutados`.
- No se agregan tests de integración para el job de polling (sigue el patrón
  no testeado de `pollNewRequests`), pero se verifica manualmente con
  `node --check` sobre `scheduler.js`.

## Fuera de alcance

- No se modifica `api-app-mam` / `IngresoFirmasScreen.jsx`.
- No se agrega notificación push (Expo) — solo Web (Socket.IO) y Email vía UNS.
- No se distingue visualmente Puntual vs Compuesta en el correo; el mismo
  template aplica a ambos casos (la lógica de "cuándo" ya lo resuelve el
  `WHERE id_estadomuestreo = 3`).
