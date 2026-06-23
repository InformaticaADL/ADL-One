# Notificación Inmediata de Muestreo Completado + Etiqueta "Nuevo" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the up-to-20-second delay before ADL ONE Web's "Muestreo Completado" notification fires, by having the mobile app's backend (`api-app-mam`) notify ADL ONE directly the instant a sampling finishes (Puntual: its single process; Compuesta: its retiro process), while keeping the existing 20s poller as a fallback. Also add a time-based "Nuevo" badge to the executed-samplings list in ADL ONE Web.

**Architecture:** A new DB column (`fecha_completado`) is stamped by `api-app-mam` at the exact moment a sampling becomes "Ejecutado". Right after that DB transaction commits, `api-app-mam` fires a best-effort (never blocks, never throws) HTTP call to a new internal endpoint in `api-backend-adlone`, reusing the same shared-secret (`INTERNAL_API_KEY`) pattern already used for FoMa/Cadena de Custodia regeneration, just in the opposite direction. The notification-building logic (today inline in the scheduler poller) is extracted into a single reusable service method, called both by the new endpoint and by the existing poller — so there is exactly one place that knows how to build a `FICHA_MUESTREO_COMPLETADO` notification for a given sampling.

**Tech Stack:** Node.js (CommonJS) + Sequelize + native `fetch` (`api-app-mam`); Node.js (ESM) + mssql + native `fetch` (`api-backend-adlone`); React + TypeScript + Mantine + dayjs (`frontend-adlone`).

---

## File Structure

- **Run directly (DB migration, not a code file)**: `ALTER TABLE App_Ma_Agenda_MUESTREOS ADD fecha_completado DATETIME NULL;` — executed once against the shared SQL Server DB.
- **Modify** `api-app-mam/controllers/fichaIngresoServicioController.js` — stamp `fecha_completado`, fire the notification call after commit.
- **Modify** `api-app-mam/.env` and `.env.example` — add `ADL_ONE_API_URL`.
- **Create** `api-backend-adlone/src/middlewares/protectInternalService.js` — shared-secret auth for this inbound direction (api-app-mam → ADL ONE).
- **Modify** `api-backend-adlone/src/services/ficha.service.js` — add `notificarMuestreoCompletado(frecuenciaCorrelativo)`, add `a.fecha_completado` to `getMuestreosEjecutados`'s query.
- **Modify** `api-backend-adlone/src/utils/scheduler.js` — simplify the poller to delegate to the new service method instead of building the notification context inline.
- **Modify** `api-backend-adlone/src/controllers/ficha.controller.js` — add `notificarMuestreoCompletado` controller method.
- **Modify** `api-backend-adlone/src/routes/ficha.routes.js` — add the new internal route.
- **Modify** `frontend-adlone/src/features/medio-ambiente/components/MuestreosEjecutadosListView.tsx` — add the "Nuevo" badge.

---

### Task 1: Add `fecha_completado` column to the database

**Files:**
- Create (temporary, run-once script): `c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\scripts\add_fecha_completado_column.js`

This task is run directly by the person/agent with DB access — the user explicitly asked that this migration be executed by Claude directly (not delegated to a subagent), since it's a one-time schema change against the shared production-like database.

- [ ] **Step 1: Write the migration script**

```js
// c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\scripts\add_fecha_completado_column.js
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    const { getConnection, closeConnection } = await import('../config/database.js');
    try {
        const pool = await getConnection();

        const existing = await pool.request().query(`
            SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('App_Ma_Agenda_MUESTREOS') AND name = 'fecha_completado'
        `);
        if (existing.recordset.length > 0) {
            console.log('La columna fecha_completado ya existe. Nada que hacer.');
            return;
        }

        await pool.request().query(`
            ALTER TABLE App_Ma_Agenda_MUESTREOS ADD fecha_completado DATETIME NULL
        `);
        console.log('Columna fecha_completado agregada correctamente.');

        const verify = await pool.request().query(`
            SELECT name, is_nullable FROM sys.columns
            WHERE object_id = OBJECT_ID('App_Ma_Agenda_MUESTREOS') AND name = 'fecha_completado'
        `);
        console.log(JSON.stringify(verify.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await closeConnection();
    }
}
run();
```

- [ ] **Step 2: Run it**

Run: `cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone" && node src/scripts/add_fecha_completado_column.js`
Expected: prints `Columna fecha_completado agregada correctamente.` followed by `[{"name": "fecha_completado", "is_nullable": true}]`. If run a second time, prints `La columna fecha_completado ya existe. Nada que hacer.` (idempotent, safe to re-run).

- [ ] **Step 3: Delete the script and confirm via git**

The script is a one-off migration tool, not part of the application — remove it after running so it doesn't linger as dead code:

```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
rm src/scripts/add_fecha_completado_column.js
git status
```
Expected: `git status` shows no changes (the script was never committed — it's deleted before ever being staged). No commit needed for this task.

---

### Task 2: Stamp `fecha_completado` + fire-and-forget notification (api-app-mam)

**Files:**
- Modify: `C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam\controllers\fichaIngresoServicioController.js`
- Modify: `C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam\.env` and `.env.example`

- [ ] **Step 1: Stamp `fecha_completado` when the sampling completes**

Find this block inside `crearMuestreo` (search for `datosActualizacion.estado_caso = "PROCESO";`):
```js
        if (esProcesoTermino && camposCompletado.retiro_completado === 'S') {
            datosActualizacion.estado_caso = "PROCESO";
            console.log(`ℹ️ Proceso 2 completado: id_caso y caso_adlab NO se actualizan (quedan NULL). Solo se actualiza estado_caso.`);
```

Change to:
```js
        if (esProcesoTermino && camposCompletado.retiro_completado === 'S') {
            datosActualizacion.estado_caso = "PROCESO";
            // ✅ NUEVO: marca el instante exacto en que el muestreo queda completo
            // (Puntual: único proceso; Compuesta: proceso de retiro). Usado por ADL ONE
            // Web para la etiqueta "Nuevo" en el listado de muestreos ejecutados.
            datosActualizacion.fecha_completado = now;
            console.log(`ℹ️ Proceso 2 completado: id_caso y caso_adlab NO se actualizan (quedan NULL). Solo se actualiza estado_caso.`);
```

(`now` is already defined at the top of `crearMuestreo`, line 662: `const now = new Date();` — don't redeclare it.)

- [ ] **Step 2: Fire the notification right after the transaction commits**

Find (search for `await transaction.commit();`):
```js
        // ✅ TRANSACCIÓN: Commit de todas las operaciones de BD
        await transaction.commit();
        console.log('✅ Transacción de base de datos confirmada exitosamente');
```

Change to:
```js
        // ✅ TRANSACCIÓN: Commit de todas las operaciones de BD
        await transaction.commit();
        console.log('✅ Transacción de base de datos confirmada exitosamente');

        // ✅ NUEVO: Avisar a ADL ONE Web de inmediato cuando el muestreo queda completo
        // (en vez de esperar a que su poller de 20s lo detecte). Fire-and-forget: nunca
        // bloquea ni hace fallar la respuesta de subida. Si falla (red, ADL ONE caído),
        // el poller de ADL ONE lo recupera igual dentro de los siguientes 20 segundos.
        if (esProcesoTermino && camposCompletado.retiro_completado === 'S') {
            fetch(`${process.env.ADL_ONE_API_URL}/api/fichas/interno/muestreo-completado`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-internal-key': process.env.INTERNAL_API_KEY },
                body: JSON.stringify({ frecuencia_correlativo: frecuenciaActualizada }),
                signal: AbortSignal.timeout(5000),
            }).catch(err => console.warn('⚠️ No se pudo notificar muestreo completado a ADL ONE:', err.message));
        }
```

- [ ] **Step 3: Add the new env var**

Add to `C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam\.env`, right after the existing `INTERNAL_API_KEY=...` line:
```
ADL_ONE_API_URL=http://localhost:8002
```

Add to `C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam\.env.example`, right after the `INTERNAL_API_KEY=` line added in a prior feature:
```
# URL base de api-backend-adlone (ADL ONE Web), para avisos servidor-a-servidor
ADL_ONE_API_URL=http://localhost:8002
```

- [ ] **Step 4: Manual verification**

Run: `cd "C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam" && node -e "require('./controllers/fichaIngresoServicioController'); console.log('LOADED OK')"`
Expected: prints `LOADED OK`, no syntax errors.

Full live verification of this fetch call happens in Task 9 (end-to-end), once the receiving endpoint exists (Task 6). For now, this task's verification is limited to confirming the file still parses and the edits are syntactically correct — there is nothing meaningful to curl yet since the target endpoint doesn't exist.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam"
git add controllers/fichaIngresoServicioController.js .env.example
git commit -m "feat: stamp fecha_completado and notify ADL ONE immediately when a sampling completes"
```

(`.env` is gitignored — confirm with `git status` it doesn't appear in the diff.)

---

### Task 3: `protectInternalService` middleware (api-backend-adlone)

**Files:**
- Create: `c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\middlewares\protectInternalService.js`

This protects the NEW inbound direction (api-app-mam calling ADL ONE) — the opposite direction of the existing FoMa/Cadena feature, which already established `INTERNAL_API_KEY` as a value shared identically between both repos' `.env` files. This task reuses that same env var, just validated on the ADL ONE side now too.

- [ ] **Step 1: Create the middleware**

```js
// c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\middlewares\protectInternalService.js

/**
 * Protege endpoints destinados a llamadas servidor-a-servidor (api-app-mam ->
 * ADL ONE Web), distintas de los endpoints de usuario web (authenticate, que
 * exige un JWT de sesión de un usuario logueado). Se valida una clave
 * compartida fija en vez de un JWT porque el llamador es otro backend, no un
 * usuario autenticado. Mismo contrato y mismo valor de INTERNAL_API_KEY que
 * ya usa api-app-mam para el sentido inverso (regeneración de FoMa/Cadena).
 */
export const protectInternalService = (req, res, next) => {
    const key = req.headers['x-internal-key'];
    if (!process.env.INTERNAL_API_KEY) {
        console.error('INTERNAL_API_KEY no está configurada en .env');
        return res.status(500).json({ message: 'Servicio mal configurado.' });
    }
    if (!key || key !== process.env.INTERNAL_API_KEY) {
        return res.status(401).json({ message: 'Clave interna inválida o ausente.' });
    }
    next();
};
```

(Note the `export const` — this repo is ESM, unlike `api-app-mam`'s CommonJS `module.exports`. Match this repo's existing middleware style, e.g. `src/middlewares/auth.middleware.js`, which uses named exports.)

- [ ] **Step 2: Manual verification**

Run: `cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone" && node -e "import('./src/middlewares/protectInternalService.js').then(m => console.log(typeof m.protectInternalService))"`
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
git add src/middlewares/protectInternalService.js
git commit -m "feat: add protectInternalService middleware for inbound api-app-mam calls"
```

---

### Task 4: `notificarMuestreoCompletado` shared service method (api-backend-adlone)

**Files:**
- Modify: `c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\services\ficha.service.js`

This is the single place that knows how to turn "a sampling identified by `frecuencia_correlativo` just completed" into an actual `FICHA_MUESTREO_COMPLETADO` notification. It will be called both by the new internal endpoint (Task 6) and by the refactored poller (Task 5).

- [ ] **Step 1: Add the method**

Add this method right after `getFichaContextForNotification`'s closing `}` (search for that method, it ends right before `async createFicha(data) {`):

```js
    /**
     * Construye y dispara la notificación FICHA_MUESTREO_COMPLETADO para una
     * fila de App_Ma_Agenda_MUESTREOS identificada por su frecuencia_correlativo,
     * si todavía no fue notificada. Reutilizada tanto por el endpoint interno
     * (aviso inmediato desde api-app-mam) como por el poller de respaldo
     * (scheduler.js) — es la única lógica que sabe armar este contexto, para
     * no duplicarla entre ambos caminos.
     *
     * @param {string} frecuenciaCorrelativo
     * @returns {Promise<{notificado: boolean, motivo?: string}>}
     */
    async notificarMuestreoCompletado(frecuenciaCorrelativo) {
        const pool = await getConnection();

        const pending = await pool.request()
            .input('frecuencia', sql.VarChar(50), frecuenciaCorrelativo)
            .query(`
                SELECT TOP 1
                    a.id_agendamam,
                    a.id_fichaingresoservicio,
                    a.frecuencia_correlativo,
                    e.id_usuario as id_usuario_propietario,
                    e.fichaingresoservicio as correlativo_txt,
                    COALESCE(m2.nombre_muestreador, m1.nombre_muestreador) as nombre_muestreador,
                    (SELECT COUNT(*)
                     FROM App_Ma_Agenda_MUESTREOS a2
                     WHERE a2.id_fichaingresoservicio = a.id_fichaingresoservicio
                       AND (a2.estado_caso IS NULL OR a2.estado_caso != 'CANCELADO')) as total_servicios
                FROM App_Ma_Agenda_MUESTREOS a
                INNER JOIN App_Ma_FichaIngresoServicio_ENC e ON e.id_fichaingresoservicio = a.id_fichaingresoservicio
                LEFT JOIN mae_muestreador m1 ON a.id_muestreador = m1.id_muestreador
                LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                WHERE a.frecuencia_correlativo = @frecuencia
                  AND a.id_estadomuestreo = 3
                  AND (a.notificado_completado = 0 OR a.notificado_completado IS NULL)
            `);

        if (pending.recordset.length === 0) {
            return { notificado: false, motivo: 'No encontrado, no está completo, o ya fue notificado.' };
        }

        const row = pending.recordset[0];

        try {
            const baseContext = await this.getFichaContextForNotification(
                row.id_fichaingresoservicio,
                row.nombre_muestreador || 'Muestreador',
                'Muestreo Completado',
                pool
            );

            // El correlativo "X-Y-Estado-Z" codifica el numero de servicio (Y) dentro de la ficha (X)
            const correlativoParts = (row.frecuencia_correlativo || '').split('-');
            const numeroServicio = correlativoParts.length >= 2 ? correlativoParts[1] : '1';

            await unsService.trigger('FICHA_MUESTREO_COMPLETADO', {
                ...baseContext,
                correlativo: (row.correlativo_txt || String(row.id_fichaingresoservicio)).trim(),
                numero_servicio: numeroServicio,
                total_servicios: row.total_servicios || 1,
                id_usuario_propietario: row.id_usuario_propietario,
                id_usuario_accion: 0,
            });

            logger.info(`[MuestreoCompletado] Notificación enviada para agenda #${row.id_agendamam}`);
        } catch (triggerError) {
            logger.error(`[MuestreoCompletado] Error notificando agenda #${row.id_agendamam}:`, triggerError);
        }

        // Se marca como notificado incluso si el trigger falló, para no reintentar
        // en bucle sobre una fila que falla de forma permanente (mismo criterio
        // que ya usaba el poller antes de este refactor).
        await pool.request()
            .input('id', sql.Numeric(10, 0), row.id_agendamam)
            .query('UPDATE App_Ma_Agenda_MUESTREOS SET notificado_completado = 1 WHERE id_agendamam = @id');

        return { notificado: true };
    }
```

- [ ] **Step 2: Add `a.fecha_completado` to `getMuestreosEjecutados`'s SELECT**

Find (search for `a.id_estadomuestreo,` inside the `getMuestreosEjecutados` query):
```js
                a.fecha_muestreo,
                a.ma_muestreo_fechat as fecha_retiro,
                a.id_estadomuestreo,
```

Change to:
```js
                a.fecha_muestreo,
                a.ma_muestreo_fechat as fecha_retiro,
                a.fecha_completado,
                a.id_estadomuestreo,
```

- [ ] **Step 3: Manual verification**

Run: `cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone" && node -e "import('./src/services/ficha.service.js').then(() => console.log('OK'))"`
Expected: prints `OK`.

Then, with the dev server running and Task 1's column already in place, test the new method directly:
```bash
node -e "
import('./src/services/ficha.service.js').then(async ({ default: fichaService }) => {
    const result = await fichaService.notificarMuestreoCompletado('una-frecuencia-que-no-existe');
    console.log(result);
    process.exit(0);
});
"
```
Expected: `{ notificado: false, motivo: 'No encontrado, no está completo, o ya fue notificado.' }`. If you have a real `frecuencia_correlativo` in your dev DB with `id_estadomuestreo = 3` and `notificado_completado` still `0`/`NULL`, run it again with that real value and expect `{ notificado: true }`, plus a new web/email notification actually being sent (check logs / the notifications bell in ADL ONE Web).

- [ ] **Step 4: Commit**

```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
git add src/services/ficha.service.js
git commit -m "feat: add notificarMuestreoCompletado shared service method, select fecha_completado"
```

---

### Task 5: Refactor the poller to delegate to the shared method

**Files:**
- Modify: `c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\utils\scheduler.js`

**Files:**

- [ ] **Step 1: Simplify `pollMuestreosCompletados`**

Find the whole `pollMuestreosCompletados` function (search for `const pollMuestreosCompletados = async () => {`). Its current body is:
```js
    let _pollMuestreosRunning = false;
    const pollMuestreosCompletados = async () => {
        if (_pollMuestreosRunning) return;
        _pollMuestreosRunning = true;
        try {
            const pool = await getConnection();

            const pending = await pool.request()
                .query(`
                    SELECT TOP 10
                        a.id_agendamam,
                        a.id_fichaingresoservicio,
                        a.frecuencia_correlativo,
                        e.id_usuario as id_usuario_propietario,
                        e.fichaingresoservicio as correlativo_txt,
                        COALESCE(m2.nombre_muestreador, m1.nombre_muestreador) as nombre_muestreador,
                        (SELECT COUNT(*)
                         FROM App_Ma_Agenda_MUESTREOS a2
                         WHERE a2.id_fichaingresoservicio = a.id_fichaingresoservicio
                           AND (a2.estado_caso IS NULL OR a2.estado_caso != 'CANCELADO')) as total_servicios
                    FROM App_Ma_Agenda_MUESTREOS a
                    INNER JOIN App_Ma_FichaIngresoServicio_ENC e ON e.id_fichaingresoservicio = a.id_fichaingresoservicio
                    LEFT JOIN mae_muestreador m1 ON a.id_muestreador = m1.id_muestreador
                    LEFT JOIN mae_muestreador m2 ON a.id_muestreador2 = m2.id_muestreador
                    WHERE a.id_estadomuestreo = 3
                      AND (a.notificado_completado = 0 OR a.notificado_completado IS NULL)
                    ORDER BY a.id_agendamam ASC
                `);

            for (const row of pending.recordset) {
                try {
                    const baseContext = await fichaService.getFichaContextForNotification(
                        row.id_fichaingresoservicio,
                        row.nombre_muestreador || 'Muestreador',
                        'Muestreo Completado',
                        pool
                    );

                    // El correlativo "X-Y-Estado-Z" codifica el numero de servicio (Y) dentro de la ficha (X)
                    const correlativoParts = (row.frecuencia_correlativo || '').split('-');
                    const numeroServicio = correlativoParts.length >= 2 ? correlativoParts[1] : '1';

                    await unsService.trigger('FICHA_MUESTREO_COMPLETADO', {
                        ...baseContext,
                        correlativo: (row.correlativo_txt || String(row.id_fichaingresoservicio)).trim(),
                        numero_servicio: numeroServicio,
                        total_servicios: row.total_servicios || 1,
                        id_usuario_propietario: row.id_usuario_propietario,
                        id_usuario_accion: 0,
                    });

                    logger.info(`[MuestreoCompletado] Notificación enviada para agenda #${row.id_agendamam}`);
                } catch (triggerError) {
                    logger.error(`[MuestreoCompletado] Error notificando agenda #${row.id_agendamam}:`, triggerError);
                }

                // Mark as notified regardless of success, to avoid retry storms
                // on a permanently-failing row (mirrors the Vigilante's behavior).
                await pool.request()
                    .input('id', sql.Numeric(10, 0), row.id_agendamam)
                    .query('UPDATE App_Ma_Agenda_MUESTREOS SET notificado_completado = 1 WHERE id_agendamam = @id');
            }
        } catch (pollError) {
            if (pollError.message?.includes('ConnectionError') || pollError.message?.includes('deadlock')) {
                logger.debug('[MuestreoCompletado] DB unreachable or busy, skipping poll');
            } else if (pollError.number === 207 && pollError.message?.includes('notificado_completado')) {
                logger.debug('[MuestreoCompletado] Columna notificado_completado pendiente de migración, omitiendo poll');
            } else {
                logger.error('[MuestreoCompletado] Error during polling:', pollError);
            }
        } finally {
            _pollMuestreosRunning = false;
        }
    };
```

Replace with (this is now a thin "find pending rows, delegate to the shared method" loop — the actual notification-building logic lives in `ficha.service.js`'s `notificarMuestreoCompletado`, added in Task 4):
```js
    let _pollMuestreosRunning = false;
    const pollMuestreosCompletados = async () => {
        if (_pollMuestreosRunning) return;
        _pollMuestreosRunning = true;
        try {
            const pool = await getConnection();

            const pending = await pool.request()
                .query(`
                    SELECT TOP 10 a.id_agendamam, a.frecuencia_correlativo
                    FROM App_Ma_Agenda_MUESTREOS a
                    WHERE a.id_estadomuestreo = 3
                      AND (a.notificado_completado = 0 OR a.notificado_completado IS NULL)
                    ORDER BY a.id_agendamam ASC
                `);

            for (const row of pending.recordset) {
                try {
                    await fichaService.notificarMuestreoCompletado(row.frecuencia_correlativo);
                } catch (rowError) {
                    logger.error(`[MuestreoCompletado] Error procesando agenda #${row.id_agendamam}:`, rowError);
                }
            }
        } catch (pollError) {
            if (pollError.message?.includes('ConnectionError') || pollError.message?.includes('deadlock')) {
                logger.debug('[MuestreoCompletado] DB unreachable or busy, skipping poll');
            } else if (pollError.number === 207 && pollError.message?.includes('notificado_completado')) {
                logger.debug('[MuestreoCompletado] Columna notificado_completado pendiente de migración, omitiendo poll');
            } else {
                logger.error('[MuestreoCompletado] Error during polling:', pollError);
            }
        } finally {
            _pollMuestreosRunning = false;
        }
    };
```

Note: `fichaService` is already imported at the top of `scheduler.js` (it was already used inside the old body, via `fichaService.getFichaContextForNotification(...)`) — no new import needed. `unsService` and `sql` may now be unused in this file if nothing else in `scheduler.js` references them — check with a repo-wide search (`grep -n "unsService\.\|sql\." src/utils/scheduler.js`) before removing their imports; only remove an import if truly nothing else in the file uses it.

- [ ] **Step 2: Manual verification**

Run: `cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone" && node -e "import('./src/utils/scheduler.js').then(() => console.log('OK'))"`
Expected: prints `OK`, no syntax/reference errors (this confirms `fichaService` is still correctly in scope and no leftover reference to removed local variables like `pool`'s old per-row usage causes a crash at parse/import time — note this only validates the module loads, not that `initScheduler()` runs cleanly, since that requires a live DB connection at startup).

If you have a dev server you can start (`npm run dev`) and a real pending row in the DB (`id_estadomuestreo = 3`, `notificado_completado = 0`), let it run for up to 20 seconds and confirm the notification still fires exactly as it did before this refactor — same message content, same web+email delivery.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
git add src/utils/scheduler.js
git commit -m "refactor: poller delegates to notificarMuestreoCompletado instead of duplicating the logic"
```

---

### Task 6: Internal endpoint for the immediate notification (api-backend-adlone)

**Files:**
- Modify: `c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\controllers\ficha.controller.js`
- Modify: `c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone\src\routes\ficha.routes.js`

- [ ] **Step 1: Add the controller method**

Add inside `FichaIngresoController`, e.g. right after `regenerarDocumentos`:

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

- [ ] **Step 2: Add the route**

In `ficha.routes.js`, add the import for the new middleware at the top, alongside the existing ones:
```js
import { authenticate } from '../middlewares/auth.middleware.js';
import { protectInternalService } from '../middlewares/protectInternalService.js';
```

Then find the line:
```js
router.post('/regenerar-documentos', authenticate, fichaController.regenerarDocumentos);
```

Add immediately after it (note: this route uses `protectInternalService`, NOT `authenticate` — the caller is `api-app-mam`'s backend, not a logged-in ADL ONE user):
```js
router.post('/interno/muestreo-completado', protectInternalService, fichaController.notificarMuestreoCompletado);
```

- [ ] **Step 3: Manual verification**

Start the backend if not already running (`cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone" && npm run dev`), then:

```bash
curl -X POST http://localhost:8002/api/fichas/interno/muestreo-completado -H "Content-Type: application/json" -H "x-internal-key: <valor real de INTERNAL_API_KEY en .env>" -d "{\"frecuencia_correlativo\": \"no-existe\"}"
```
Expected: `200` with `{"success":true,"data":{"notificado":false,"motivo":"No encontrado, no está completo, o ya fue notificado."},"message":"Notificación procesada"}`.

Then test the wrong-key case:
```bash
curl -X POST http://localhost:8002/api/fichas/interno/muestreo-completado -H "Content-Type: application/json" -H "x-internal-key: wrong" -d "{\"frecuencia_correlativo\": \"no-existe\"}"
```
Expected: `401` with `{"message":"Clave interna inválida o ausente."}`.

Then, if you have a real pending row, call it with the real `frecuencia_correlativo` and confirm `{"notificado": true}` plus an actual notification appearing in ADL ONE Web.

- [ ] **Step 4: Commit**

```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
git add src/controllers/ficha.controller.js src/routes/ficha.routes.js
git commit -m "feat: add POST /api/fichas/interno/muestreo-completado endpoint"
```

---

### Task 7: "Nuevo" badge in `MuestreosEjecutadosListView.tsx`

**Files:**
- Modify: `c:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone\src\features\medio-ambiente\components\MuestreosEjecutadosListView.tsx`

- [ ] **Step 1: Add the "is new" check and the badge**

Find the table row rendering (search for `<Table.Td style={{ whiteSpace: 'nowrap' }}>` followed by `<Text size="xs" fw={600} truncate title={m.frecuencia_correlativo}>` — this is the "Correlativo" cell):
```tsx
                                                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                            <Text size="xs" fw={600} truncate title={m.frecuencia_correlativo}>
                                                                {m.frecuencia_correlativo || '-'}
                                                            </Text>
                                                        </Table.Td>
```

Change to:
```tsx
                                                        <Table.Td style={{ whiteSpace: 'nowrap' }}>
                                                            <Group gap={4} wrap="nowrap">
                                                                <Text size="xs" fw={600} truncate title={m.frecuencia_correlativo}>
                                                                    {m.frecuencia_correlativo || '-'}
                                                                </Text>
                                                                {m.fecha_completado && dayjs().diff(dayjs(m.fecha_completado), 'hour') < 24 && (
                                                                    <Badge color="green" variant="filled" size="xs">Nuevo</Badge>
                                                                )}
                                                            </Group>
                                                        </Table.Td>
```

`dayjs`, `Badge`, and `Group` are all already imported in this file (`dayjs` is used for `getDayLabel`/date formatting elsewhere in the same component; `Badge` is used for the "N servicios" pill; `Group` is used throughout) — do not add new imports.

- [ ] **Step 2: Manual verification**

Run: `cd "c:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone" && npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone"
git add src/features/medio-ambiente/components/MuestreosEjecutadosListView.tsx
git commit -m "feat: show Nuevo badge for samplings completed in the last 24 hours"
```

---

### Task 8: End-to-end manual verification

This is exclusively manual/live (requires real DB rows, a running mobile-app flow or a realistic simulated upload, and visual confirmation in the browser) — not part of automated review.

- [ ] **Step 1: Start all three services**

```bash
cd "C:\Users\vremolcoy\Desktop\APP MAM\api-app-mam" && npm run dev
```
```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone" && npm run dev
```
```bash
cd "c:\Users\vremolcoy\Desktop\ADL ONE\frontend-adlone" && npm run dev
```

- [ ] **Step 2: Complete a Puntual sampling from the mobile app**

Using the app (or `IngresoFirmasScreen.jsx`'s flow), complete a Puntual ficha's single process end to end. Confirm: a `FICHA_MUESTREO_COMPLETADO` notification appears in ADL ONE Web's notification bell within a couple seconds (not ~20s later), and the row appears in `MuestreosEjecutadosListView` with the green "Nuevo" badge.

- [ ] **Step 3: Complete a Compuesta sampling (both processes)**

Complete the instalación process first — confirm NO notification fires and `id_estadomuestreo` stays at 1/Pendiente. Then complete the retiro process — confirm the notification fires immediately and the badge appears, same as Step 2.

- [ ] **Step 4: Verify the fallback path**

Stop `api-backend-adlone`. Complete another sampling from the mobile app (Puntual is simplest). Confirm the upload still succeeds normally from the app's perspective (no error shown to the muestreador). Restart `api-backend-adlone` and wait up to 20 seconds — confirm the notification arrives via the poller (check logs for `[MuestreoCompletado] Notificación enviada...`), proving the fallback works when the direct call fails.

- [ ] **Step 5: Verify the badge disappears after 24 hours (or simulate it)**

Either wait 24 hours on a real row, or temporarily change a test row's `fecha_completado` directly in the DB to a timestamp more than 24 hours in the past, reload `MuestreosEjecutadosListView`, and confirm the badge no longer shows for that row while the rest of the row's data is unaffected.
