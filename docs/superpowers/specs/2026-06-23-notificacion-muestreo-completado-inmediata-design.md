# Notificación inmediata de "Muestreo Completado" + etiqueta "Nuevo"

## Contexto

ADL ONE Web ya tiene una notificación `FICHA_MUESTREO_COMPLETADO` (web + email), con mensaje "`{muestreador}` completó el servicio `X/Y` de la ficha `#N`". Hoy se dispara mediante un **poller** en `api-backend-adlone/src/utils/scheduler.js` que corre cada 20 segundos, buscando en `App_Ma_Agenda_MUESTREOS` filas con `id_estadomuestreo = 3` (Ejecutado) y `notificado_completado = 0`. El poller ya distingue correctamente entre fichas Puntuales (un solo proceso) y Compuestas (solo se marca `id_estadomuestreo = 3` al completar el proceso de **retiro**), porque ambos casos confluyen en esa misma condición de BD — no necesita lógica especial por tipo.

El problema: hay un retraso de hasta 20 segundos entre que el muestreador termina de subir el muestreo desde la app móvil (`app-mam`) y que la notificación aparece en ADL ONE, porque nadie avisa directamente al backend web — este solo "pregunta" periódicamente.

**Objetivo:** que la app móvil (vía su backend, `api-app-mam`) avise directamente a ADL ONE en el instante en que un muestreo queda completo (mismo patrón servidor-a-servidor ya usado para la regeneración de FoMa/Cadena de Custodia), eliminando el retraso, manteniendo el poller existente como respaldo. Además, mostrar una etiqueta "Nuevo" en `MuestreosEjecutadosListView.tsx` (ADL ONE Web) para los muestreos completados en las últimas 24 horas.

## Alcance

- Nueva columna `fecha_completado` en `App_Ma_Agenda_MUESTREOS`.
- `api-app-mam`: al completar un muestreo (Puntual o Compuesta-retiro) en `crearMuestreo`, se setea esa columna y se dispara un aviso best-effort a ADL ONE.
- `api-backend-adlone`: nuevo endpoint interno que recibe ese aviso, construye el mismo contexto que ya usa el poller (extraído a una función compartida) y dispara la notificación existente.
- El poller de 20s no cambia de comportamiento — sigue como respaldo, sin tocar su lógica de detección.
- `MuestreosEjecutadosListView.tsx`: nueva etiqueta "Nuevo" basada en `fecha_completado` (ventana de 24 horas).

Fuera de alcance: cambiar el contenido del mensaje de la notificación (se mantiene igual); cambiar el comportamiento del poller; lógica de "visto/no visto" por usuario (la etiqueta es puramente temporal, no depende de quién la vio).

## Diseño

### 1. Columna `fecha_completado` (BD compartida)

`ALTER TABLE App_Ma_Agenda_MUESTREOS ADD fecha_completado DATETIME NULL;`

Se setea en `api-app-mam/controllers/fichaIngresoServicioController.js`, dentro de `crearMuestreo`, en el mismo UPDATE que ya pone `id_estadomuestreo = 3` (la rama donde `esProcesoTermino && retiro_completado === 'S'`, o la rama equivalente para Puntual). Se usa `GETDATE()` del lado de SQL Server, igual que otros timestamps ya seteados ahí (`fecha_muestreador`/`hora_muestreador`).

Filas anteriores a este cambio quedan con `fecha_completado = NULL` — nunca mostrarán "Nuevo" (correcto, son históricas).

### 2. Aviso best-effort desde `crearMuestreo` (api-app-mam)

Después del UPDATE que marca completado + `fecha_completado`, dentro del mismo bloque condicional (Puntual o retiro de Compuesta), se agrega una llamada **fire-and-forget**:

```js
// No bloquea la respuesta de subida ni falla el upload si esto falla.
fetch(`${process.env.ADL_ONE_API_URL}/api/fichas/interno/muestreo-completado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY },
    body: JSON.stringify({ frecuencia_correlativo: frecuenciaActualizada }),
    signal: AbortSignal.timeout(5000),
}).catch(err => console.warn('No se pudo notificar muestreo completado a ADL ONE:', err.message));
```

No se usa `await` en la ruta crítica de la respuesta HTTP del upload — el fetch se dispara y se deja correr en segundo plano (su promesa se maneja con `.catch`, pero no bloquea el `return`/`res.json(...)` de `crearMuestreo`). Si falla (red, ADL ONE caído, timeout), el poller de 20s lo recupera igual que cualquier otra fila pendiente — sin necesidad de reintentos manuales aquí.

Nuevas variables de entorno en `api-app-mam/.env` y `.env.example`:
```
ADL_ONE_API_URL=http://localhost:8002
```
(`INTERNAL_API_KEY` ya existe en ambos `.env` desde la funcionalidad anterior — se reutiliza tal cual, mismo valor compartido.)

### 3. Endpoint interno en `api-backend-adlone`

Nueva ruta protegida con el mismo patrón de clave compartida usado en la funcionalidad anterior, pero en sentido inverso (api-app-mam llamando a ADL ONE). Se crea `src/middlewares/protectInternalService.js` en este repo (análogo al de `api-app-mam`, mismo contrato: header `x-internal-key` contra `process.env.INTERNAL_API_KEY`).

```js
// src/routes/ficha.routes.js
router.post('/interno/muestreo-completado', protectInternalService, fichaController.notificarMuestreoCompletado);
```

Controlador:

```js
async notificarMuestreoCompletado(req, res) {
    try {
        const { frecuencia_correlativo } = req.body;
        if (!frecuencia_correlativo) {
            return errorResponse(res, 'frecuencia_correlativo requerido', 400);
        }
        const result = await fichaService.notificarMuestreoCompletado(frecuencia_correlativo);
        return successResponse(res, result, 'Notificación procesada');
    } catch (err) {
        logger.error('Error in notificarMuestreoCompletado controller:', err);
        return errorResponse(res, 'Error al notificar muestreo completado', 500, err.message);
    }
}
```

### 4. Lógica compartida entre el poller y el endpoint nuevo

Hoy, la construcción del contexto (número de servicio, total de servicios, nombre del muestreador, propietario) vive inline dentro de `pollMuestreosCompletados` en `scheduler.js`. Se extrae a un nuevo método en `ficha.service.js`:

```js
async notificarMuestreoCompletado(frecuenciaCorrelativo) {
    // 1. Busca la fila en App_Ma_Agenda_MUESTREOS por frecuencia_correlativo
    //    (mismo SELECT que ya usa el poller, con el JOIN a App_Ma_FichaIngresoServicio_ENC
    //    y la subconsulta de total_servicios), filtrando además
    //    notificado_completado = 0 OR NULL (evita doble-disparo si el poller ya la tomó
    //    en la misma ventana de carrera).
    // 2. Si no encuentra fila pendiente, retorna { notificado: false, motivo: 'ya notificado o no encontrado' }.
    // 3. Si encuentra, construye el context igual que el poller (numeroServicio desde
    //    frecuencia_correlativo.split('-'), total_servicios, etc.), llama
    //    unsService.trigger('FICHA_MUESTREO_COMPLETADO', context), marca
    //    notificado_completado = 1 (igual que el poller: se marca incluso si el trigger
    //    falla, para no reintentar en bucle), y retorna { notificado: true }.
}
```

`scheduler.js`'s `pollMuestreosCompletados` se refactoriza para, por cada fila encontrada, delegar la construcción de contexto + trigger + marcado a esta misma función de `ficha.service.js` (pasándole el `frecuencia_correlativo` de cada fila), eliminando la duplicación. El intervalo de 20 segundos y el `TOP 10` por ciclo no cambian.

### 5. Etiqueta "Nuevo" en `MuestreosEjecutadosListView.tsx`

- Backend (`getMuestreosEjecutados` en `ficha.service.js`): se agrega `a.fecha_completado` al SELECT existente.
- Frontend: se agrega `dayjs` (ya está como dependencia y ya se usa en este archivo) para calcular, por fila:
```ts
const esNuevo = m.fecha_completado && dayjs().diff(dayjs(m.fecha_completado), 'hour') < 24;
```
- Se muestra un `<Badge color="green" variant="filled" size="xs">Nuevo</Badge>` junto a la celda de "Correlativo" cuando `esNuevo` es verdadero.

## Manejo de errores y casos límite

- **Llamada directa falla** (red, ADL ONE caído, timeout de 5s): no afecta la respuesta de subida al muestreador (la llamada es fire-and-forget); el poller de 20s lo recupera en su siguiente ciclo.
- **Carrera entre llamada directa y poller** (ambos intentan notificar la misma fila casi al mismo tiempo): el endpoint nuevo filtra por `notificado_completado = 0 OR NULL` igual que el poller, así que como máximo uno de los dos gana la carrera (el otro no encuentra fila pendiente y no hace nada) — sin notificación duplicada salvo una ventana de milisegundos teóricamente posible pero de impacto mínimo (en el peor caso, una notificación duplicada, no una pérdida).
- **Filas históricas sin `fecha_completado`**: nunca muestran "Nuevo" — comportamiento esperado, no requiere backfill.
- **`frecuencia_correlativo` no encontrado** en el endpoint nuevo: responde `200` con `{ notificado: false, motivo: '...' }` (no es un error del llamador — la fila simplemente no existe o ya fue procesada), siguiendo el mismo patrón ya usado en la funcionalidad de regeneración de documentos (no fallar fuerte por "nada que hacer").

## Testing

- Función compartida `notificarMuestreoCompletado` en `ficha.service.js`: se prueba con mocks de BD, cubriendo fila encontrada/no encontrada/ya notificada.
- Templates/lógica pura: no aplica aquí (no hay PDFs involucrados en esta funcionalidad).
- Verificación manual end-to-end: subir un muestreo Puntual y uno Compuesto (completando ambos procesos) desde la app móvil (o simulando la llamada con curl), confirmar que la notificación web aparece en ADL ONE casi de inmediato (no a los 20s), y que el registro aparece con la etiqueta "Nuevo" en `MuestreosEjecutadosListView`. Apagar `api-backend-adlone` temporalmente, subir un muestreo, confirmar que la notificación de todas formas llega vía el poller dentro de los 20s siguientes al reiniciar el backend.
