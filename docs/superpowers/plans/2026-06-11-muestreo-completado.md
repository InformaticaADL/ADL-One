# Notificación "Muestreo Completado" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify (web + email) the ficha owner when a field sampling is completed (Puntual: single process; Compuesta: only after the second/retiro process), via a new `FICHA_MUESTREO_COMPLETADO` UNS event, administrable from the Notification Hub.

**Architecture:** A new polling job in `api-backend-adlone`'s existing scheduler watches `App_Ma_Agenda_MUESTREOS` for rows with `id_estadomuestreo = 3` (Ejecutado) that haven't been notified yet (`notificado_completado = 0`), builds a notification context, calls `unsService.trigger('FICHA_MUESTREO_COMPLETADO', ...)`, and marks the row as notified. The event is rendered via the existing declarative `ficha.config.js` + `renderer.js` pipeline and links to a new `/?vista=ejecutados` deep-link that opens `MuestreosEjecutadosListView`.

**Tech Stack:** Node.js (ESM) + Express + mssql (api-backend-adlone backend), `node --test` for notification tests, React 19 + TypeScript + Zustand (frontend-adlone).

---

## File Structure

- **Modify** `api-backend-adlone/database/` — new SQL migration files (column + event seed):
  - `add_notificado_completado.sql` (new)
  - `add_muestreo_completado_event.sql` (new)
- **Modify** `api-backend-adlone/src/notifications/config/ficha.config.js` — add `CTA_EJECUTADOS` constant + `FICHA_MUESTREO_COMPLETADO` config entry.
- **Modify** `api-backend-adlone/src/notifications/renderer.test.js` — add test for the new event.
- **Modify** `api-backend-adlone/src/services/uns.service.js` — add `'FICHA_MUESTREO_COMPLETADO'` to `eventsForOwner`.
- **Modify** `api-backend-adlone/src/utils/scheduler.js` — add `pollMuestreosCompletados` job.
- **Modify** `frontend-adlone/src/App.tsx` — handle `?vista=ejecutados` deep-link.

No new files beyond the two SQL migrations — everything else extends existing, focused files following established patterns.

---

### Task 1: Email config — `FICHA_MUESTREO_COMPLETADO` in `ficha.config.js`

**Files:**
- Modify: `api-backend-adlone/src/notifications/config/ficha.config.js`
- Test: `api-backend-adlone/src/notifications/renderer.test.js`

- [ ] **Step 1: Write the failing test**

Append to `api-backend-adlone/src/notifications/renderer.test.js` (after the last test, which currently ends at line 84-85 with the `omits a campo row when its value is empty` test):

```js
test('renders FICHA_MUESTREO_COMPLETADO: subject, title, meta and CTA to ejecutados', () => {
    const result = renderEmail('FICHA_MUESTREO_COMPLETADO', BASE_CONTEXT);

    assert.equal(result.asunto, 'Muestreo Completado - Ficha #1245');
    assert.match(result.html, /Muestreo Completado/);
    assert.match(result.html, /Se complet.* el muestreo de la ficha #1245/);
    assert.match(result.html, /J\. Pérez/);
    assert.match(result.html, /10 de junio de 2026 16:18/);
    assert.match(result.html, /Ver Muestreos Ejecutados/);
    assert.match(result.html, /\/\?vista=ejecutados/);
    // INFORMATIVA outcome has no badge
    assert.doesNotMatch(result.html, />NUEVA</);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `api-backend-adlone/`): `node --test src/notifications`
Expected: FAIL — `renderEmail('FICHA_MUESTREO_COMPLETADO', ...)` returns `null` (no config), so `result.asunto` throws `TypeError: Cannot read properties of null`.

- [ ] **Step 3: Add the CTA constant and config entry**

In `api-backend-adlone/src/notifications/config/ficha.config.js`, locate the existing CTA constants:

```js
const CTA_FICHA = { label: 'Ver Ficha en ADL ONE', ruta: '/?ficha={ID_FICHA}' };

// Eventos de asignación/reprogramación de muestreo apuntan al Calendario,
// donde el responsable gestiona sus servicios agendados.
const CTA_CALENDARIO = { label: 'Ver Calendario en ADL ONE', ruta: '/?vista=calendario' };
```

Add a new constant right after `CTA_CALENDARIO`:

```js
// El evento de muestreo completado apunta al listado de Muestreos Ejecutados,
// donde se ve el avance/resultado del proceso recién finalizado.
const CTA_EJECUTADOS = { label: 'Ver Muestreos Ejecutados', ruta: '/?vista=ejecutados' };
```

Then, at the end of the `FICHA_CONFIG` array (after the `FICHA_MUESTREO_REAGENDADO_REASIGNADO` entry, before the closing `];`), add:

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

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/notifications`
Expected: PASS — all tests (29 total now) pass.

- [ ] **Step 5: Commit**

```bash
git add api-backend-adlone/src/notifications/config/ficha.config.js api-backend-adlone/src/notifications/renderer.test.js
git commit -m "feat(notifications): add FICHA_MUESTREO_COMPLETADO email config"
```

---

### Task 2: UNS owner recipient — `eventsForOwner`

**Files:**
- Modify: `api-backend-adlone/src/services/uns.service.js:690-703`

- [ ] **Step 1: Edit `eventsForOwner`**

Current code (around line 690-703):

```js
            const eventsForOwner = [
                'SOLICITUD_ESTADO_CAMBIO', 
                'SOLICITUD_COMENTARIO_NUEVO', 
                'SOLICITUD_DERIVACION',
                'FICHA_CREADA',
                'FICHA_REMUESTREO_CREADA',
                'FICHA_APROBADA_TECNICA',
                'FICHA_RECHAZADA_TECNICA',
                'FICHA_APROBADA_COORDINACION',
                'FICHA_RECHAZADA_COORDINACION',
                'FICHA_ASIGNADA',
                'GCHAT_GRUPO_EXPULSADO', 
                'GCHAT_GRUPO_CREADO'
            ];
```

Change to:

```js
            const eventsForOwner = [
                'SOLICITUD_ESTADO_CAMBIO', 
                'SOLICITUD_COMENTARIO_NUEVO', 
                'SOLICITUD_DERIVACION',
                'FICHA_CREADA',
                'FICHA_REMUESTREO_CREADA',
                'FICHA_APROBADA_TECNICA',
                'FICHA_RECHAZADA_TECNICA',
                'FICHA_APROBADA_COORDINACION',
                'FICHA_RECHAZADA_COORDINACION',
                'FICHA_ASIGNADA',
                'FICHA_MUESTREO_COMPLETADO',
                'GCHAT_GRUPO_EXPULSADO', 
                'GCHAT_GRUPO_CREADO'
            ];
```

- [ ] **Step 2: Verify syntax**

Run (from `api-backend-adlone/`): `node --check src/services/uns.service.js`
Expected: no output (valid syntax).

- [ ] **Step 3: Commit**

```bash
git add api-backend-adlone/src/services/uns.service.js
git commit -m "feat(notifications): notify ficha owner on FICHA_MUESTREO_COMPLETADO"
```

---

### Task 3: Frontend deep-link `/?vista=ejecutados`

**Files:**
- Modify: `frontend-adlone/src/App.tsx:39-44`

- [ ] **Step 1: Edit the deep-link `useEffect`**

Current code (lines 26-45):

```tsx
  useEffect(() => {
    if (!isAuthenticated) return;

    const params = new URLSearchParams(window.location.search);
    const fichaId = params.get('ficha');
    const vista = params.get('vista');

    if (fichaId) {
      const id = parseInt(fichaId, 10);
      setPendingRequestId(id);
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      window.history.replaceState({}, '', '/');
    } else if (vista === 'calendario') {
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      setFichasMode('calendar');
      window.history.replaceState({}, '', '/');
    }
  }, [isAuthenticated, setActiveModule, setActiveSubmodule, setPendingRequestId, setFichasMode]);
```

Add a new branch for `vista === 'ejecutados'`:

```tsx
  useEffect(() => {
    if (!isAuthenticated) return;

    const params = new URLSearchParams(window.location.search);
    const fichaId = params.get('ficha');
    const vista = params.get('vista');

    if (fichaId) {
      const id = parseInt(fichaId, 10);
      setPendingRequestId(id);
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      window.history.replaceState({}, '', '/');
    } else if (vista === 'calendario') {
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      setFichasMode('calendar');
      window.history.replaceState({}, '', '/');
    } else if (vista === 'ejecutados') {
      setActiveModule('medio_ambiente');
      setActiveSubmodule('ma-fichas-ingreso');
      setFichasMode('list_ejecutados');
      window.history.replaceState({}, '', '/');
    }
  }, [isAuthenticated, setActiveModule, setActiveSubmodule, setPendingRequestId, setFichasMode]);
```

- [ ] **Step 2: Lint check**

Run (from `frontend-adlone/`): `npx eslint src/App.tsx`
Expected: no output (no new lint errors).

- [ ] **Step 3: Commit**

```bash
git add frontend-adlone/src/App.tsx
git commit -m "feat: add /?vista=ejecutados deep-link to Muestreos Ejecutados"
```

---

### Task 4: Database migrations

**Files:**
- Create: `api-backend-adlone/database/add_notificado_completado.sql`
- Create: `api-backend-adlone/database/add_muestreo_completado_event.sql`

- [ ] **Step 1: Write the column migration**

Create `api-backend-adlone/database/add_notificado_completado.sql`:

```sql
-- ============================================================
-- Agrega columna de control para notificación "Muestreo Completado"
-- ============================================================

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID('App_Ma_Agenda_MUESTREOS') AND name = 'notificado_completado'
)
BEGIN
    ALTER TABLE App_Ma_Agenda_MUESTREOS
    ADD notificado_completado BIT NOT NULL CONSTRAINT DF_AMAM_notif_completado DEFAULT 0;
END

-- Baseline: marcar como ya notificados todos los muestreos que YA estaban
-- Ejecutados antes de esta migración, para no enviar notificaciones
-- retroactivas masivas.
UPDATE App_Ma_Agenda_MUESTREOS
SET notificado_completado = 1
WHERE id_estadomuestreo = 3
  AND notificado_completado = 0;

-- Verificar resultado
SELECT
    SUM(CASE WHEN id_estadomuestreo = 3 AND notificado_completado = 0 THEN 1 ELSE 0 END) AS pendientes_notificar,
    SUM(CASE WHEN id_estadomuestreo = 3 AND notificado_completado = 1 THEN 1 ELSE 0 END) AS ya_notificados
FROM App_Ma_Agenda_MUESTREOS;
```

- [ ] **Step 2: Write the event-seed migration**

Create `api-backend-adlone/database/add_muestreo_completado_event.sql`:

```sql
-- ============================================================
-- Registra el evento FICHA_MUESTREO_COMPLETADO en el catálogo de
-- notificaciones (mae_evento_notificacion), reutilizando el mismo
-- id_funcionalidad que FICHA_ASIGNADA para que aparezca en la misma
-- sección del Hub de Notificaciones.
-- ============================================================

IF NOT EXISTS (
    SELECT * FROM mae_evento_notificacion WHERE codigo_evento = 'FICHA_MUESTREO_COMPLETADO'
)
BEGIN
    INSERT INTO mae_evento_notificacion (codigo_evento, descripcion, asunto_template, id_funcionalidad)
    SELECT 'FICHA_MUESTREO_COMPLETADO', 'Muestreo Completado', 'Muestreo Completado - Ficha #{CORRELATIVO}', id_funcionalidad
    FROM mae_evento_notificacion
    WHERE codigo_evento = 'FICHA_ASIGNADA';
END

-- Verificar resultado
SELECT id_evento, codigo_evento, descripcion, id_funcionalidad
FROM mae_evento_notificacion
WHERE codigo_evento IN ('FICHA_ASIGNADA', 'FICHA_MUESTREO_COMPLETADO');
```

- [ ] **Step 3: Run both migrations against the database**

Run each file against `ADL_ONE_DB` using your usual SQL Server client (e.g., `sqlcmd` or SSMS). Example with `sqlcmd`:

```bash
sqlcmd -S <DB_SERVER> -d ADL_ONE_DB -U sa -P <password> -i api-backend-adlone/database/add_notificado_completado.sql
sqlcmd -S <DB_SERVER> -d ADL_ONE_DB -U sa -P <password> -i api-backend-adlone/database/add_muestreo_completado_event.sql
```

Expected: the first prints `pendientes_notificar = 0` and `ya_notificados = <N existing executed rows>`; the second prints one row per event code with the same `id_funcionalidad` for `FICHA_ASIGNADA` and `FICHA_MUESTREO_COMPLETADO`.

- [ ] **Step 4: Commit**

```bash
git add api-backend-adlone/database/add_notificado_completado.sql api-backend-adlone/database/add_muestreo_completado_event.sql
git commit -m "chore(db): add migrations for FICHA_MUESTREO_COMPLETADO notification"
```

---

### Task 5: Polling job in `scheduler.js`

**Files:**
- Modify: `api-backend-adlone/src/utils/scheduler.js`

This task depends on Task 4's migration having been applied to the database
(the query references `notificado_completado`), and on Tasks 1-2 (config +
`eventsForOwner`) for the trigger to actually send notifications.

- [ ] **Step 1: Add the `fichaService` import**

At the top of `api-backend-adlone/src/utils/scheduler.js`, current imports are:

```js
import { equipoService } from '../services/equipo.service.js';
import { getConnection } from '../config/database.js';
import sql from 'mssql';
import unsService from '../services/uns.service.js';
import { runAnalysis as runKpiAnalyst } from '../services/kpi-analyst.service.js';
import kpiAnalystConfig from '../config/kpi-analyst.config.js';
import logger from './logger.js';
```

Add a new import line after the `unsService` import:

```js
import { equipoService } from '../services/equipo.service.js';
import { getConnection } from '../config/database.js';
import sql from 'mssql';
import unsService from '../services/uns.service.js';
import fichaService from '../services/ficha.service.js';
import { runAnalysis as runKpiAnalyst } from '../services/kpi-analyst.service.js';
import kpiAnalystConfig from '../config/kpi-analyst.config.js';
import logger from './logger.js';
```

- [ ] **Step 2: Add the `pollMuestreosCompletados` function**

In `api-backend-adlone/src/utils/scheduler.js`, the file currently has, after the
`pollNewRequests` function closes (its closing brace and `};` are right before
the `// --- 3. KPI Analyst Dashboard Automation ---` comment, around line 220-221):

```js
        } finally {
            _pollRunning = false;
        }
    };

    // --- 3. KPI Analyst Dashboard Automation ---
```

Insert a new section between them:

```js
        } finally {
            _pollRunning = false;
        }
    };

    // --- 2b. Muestreo Completado Watcher ---
    // Polls App_Ma_Agenda_MUESTREOS for samplings that just finished
    // (id_estadomuestreo = 3, "Ejecutado") and haven't been notified yet.
    // Covers both Puntual (single process) and Compuesta (only fires when
    // the second/retiro process completes), since both end up with
    // id_estadomuestreo = 3 in App_Ma_Agenda_MUESTREOS.
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
                        e.id_usuario as id_usuario_propietario,
                        e.fichaingresoservicio as correlativo_txt,
                        COALESCE(m2.nombre_muestreador, m1.nombre_muestreador) as nombre_muestreador
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

                    await unsService.trigger('FICHA_MUESTREO_COMPLETADO', {
                        ...baseContext,
                        correlativo: (row.correlativo_txt || String(row.id_fichaingresoservicio)).trim(),
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
            } else {
                logger.error('[MuestreoCompletado] Error during polling:', pollError);
            }
        } finally {
            _pollMuestreosRunning = false;
        }
    };

    // --- 3. KPI Analyst Dashboard Automation ---
```

- [ ] **Step 3: Wire the new job into startup and intervals**

Current startup/interval block (around line 230-251):

```js
    // --- Startup Execution ---
    setTimeout(() => {
        runDailyCheck();
        pollNewRequests();
    }, 10000);

    setTimeout(() => {
        runKpiAgent('startup');
    }, kpiAnalystConfig.orchestration.startupDelayMs);

    // --- Active Loops ---
    // Every 24 hours
    setInterval(runDailyCheck, 24 * 60 * 60 * 1000);

    // Every 20 seconds (Vigilante poll)
    setInterval(pollNewRequests, 20 * 1000);

    // KPI analyst interval execution
    setInterval(() => {
        runKpiAgent('interval');
    }, kpiAnalystConfig.orchestration.refreshIntervalMs);

    logger.info('Scheduler initialized: Daily check, URS Watcher and KPI Analyst active.');
```

Change to:

```js
    // --- Startup Execution ---
    setTimeout(() => {
        runDailyCheck();
        pollNewRequests();
        pollMuestreosCompletados();
    }, 10000);

    setTimeout(() => {
        runKpiAgent('startup');
    }, kpiAnalystConfig.orchestration.startupDelayMs);

    // --- Active Loops ---
    // Every 24 hours
    setInterval(runDailyCheck, 24 * 60 * 60 * 1000);

    // Every 20 seconds (Vigilante poll)
    setInterval(pollNewRequests, 20 * 1000);

    // Every 20 seconds (Muestreo Completado watcher)
    setInterval(pollMuestreosCompletados, 20 * 1000);

    // KPI analyst interval execution
    setInterval(() => {
        runKpiAgent('interval');
    }, kpiAnalystConfig.orchestration.refreshIntervalMs);

    logger.info('Scheduler initialized: Daily check, URS Watcher, Muestreo Completado Watcher and KPI Analyst active.');
```

- [ ] **Step 4: Verify syntax**

Run (from `api-backend-adlone/`): `node --check src/utils/scheduler.js`
Expected: no output (valid syntax).

- [ ] **Step 5: Commit**

```bash
git add api-backend-adlone/src/utils/scheduler.js
git commit -m "feat(notifications): poll for completed samplings and trigger FICHA_MUESTREO_COMPLETADO"
```

---

### Task 6: Full notification test suite + manual smoke test

**Files:**
- Test: `api-backend-adlone/src/notifications` (whole directory)

- [ ] **Step 1: Run the full notification test suite**

Run (from `api-backend-adlone/`): `node --test src/notifications`
Expected: all 29 tests pass (28 previous + 1 new from Task 1).

- [ ] **Step 2: Manual smoke test — verify the polling job runs without errors**

Start the backend with the migrations from Task 4 already applied:

```bash
cd api-backend-adlone
npm run dev
```

Watch the logs for `Scheduler initialized: Daily check, URS Watcher, Muestreo Completado Watcher and KPI Analyst active.` and confirm no errors are logged from `[MuestreoCompletado]` within the first 20-30 seconds (it should simply find 0 pending rows if nothing new was completed).

- [ ] **Step 3: Manual smoke test — end-to-end notification**

In the database, pick (or create) a row in `App_Ma_Agenda_MUESTREOS` that is
NOT yet `id_estadomuestreo = 3`, and update it manually to simulate a
completed sampling:

```sql
UPDATE App_Ma_Agenda_MUESTREOS
SET id_estadomuestreo = 3, notificado_completado = 0
WHERE id_agendamam = <pick a real id_agendamam from a test ficha>;
```

Within ~20 seconds, confirm:
- A log line `[MuestreoCompletado] Notificación enviada para agenda #<id>` appears.
- The ficha owner (`id_usuario_propietario` of that ficha) receives a web (Socket.IO) notification and an email titled "Muestreo Completado - Ficha #<correlativo>".
- The email's "Ver Muestreos Ejecutados" button opens `https://<APP_URL>/?vista=ejecutados`, and clicking it (while logged into the frontend) opens the "Muestreos Ejecutados" list view.
- `App_Ma_Agenda_MUESTREOS.notificado_completado` is now `1` for that row (won't re-notify).

- [ ] **Step 4: Commit (if any fixes were needed)**

If steps 1-3 required any code fixes, commit them with a descriptive message,
e.g.:

```bash
git add -A
git commit -m "fix(notifications): address issues found in FICHA_MUESTREO_COMPLETADO smoke test"
```

If no fixes were needed, skip this step — there is nothing to commit.

---

## Self-Review Notes

- **Spec coverage:** All 6 sections of the design spec are covered — DB migration (Task 4), polling job (Task 5), email config (Task 1), deep-link (Task 3), recipients/admin (Tasks 2 + 4), testing (Tasks 1 + 6).
- **Placeholder scan:** No TBD/TODO; all code blocks are complete and copy-pasteable.
- **Type/name consistency:** `fichaService.getFichaContextForNotification(idFicha, usuario, accionText, poolOrTransaction)` signature matches the existing definition at `ficha.service.js:15`. `unsService.trigger(codigoEvento, context)` matches `uns.service.js:13`. Config field names (`codigo`, `categoria`, `outcome`, `asunto`, `titulo`, `resumen`, `campos`, `eventoMeta`, `cta`) match the shape used by `FICHA_ASIGNADA` and consumed by `renderer.js`.
