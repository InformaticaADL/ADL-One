# Hoy en Vivo — Fase 2: api-backend-adlone (endpoint interno + Socket.IO + snapshot + purga) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the ADL ONE Web backend piece that receives GPS positions relayed by `api-app-mam` (fase 1, already shipped) and broadcasts them to connected supervisors over Socket.IO in real time, plus the initial-snapshot endpoint the frontend will use when a supervisor first opens "Hoy en Vivo", the permission that gates access to it, and the scheduled job that purges tracking history older than 30 days.

**Architecture:** A new `protectInternalService`-guarded endpoint (`POST /api/tracking/interno/posicion`) receives each relayed ping and emits it to a Socket.IO room (`hoy_en_vivo`) that supervisors join client-side after an in-socket permission check. A separate authenticated endpoint (`GET /api/tracking/hoy`) reads the current state directly from the same shared SQL Server database fase 1 already writes to (`mam_jornadas`, `mam_ubicaciones_tracking`) plus the existing `App_Ma_Agenda_MUESTREOS` table, using this codebase's existing raw-`mssql` query style (no ORM here, unlike `api-app-mam`). A `setInterval` job in the existing scheduler purges old position rows daily.

**Tech Stack:** Node.js (ESM), Express, `mssql` (raw SQL, no ORM), Socket.IO, `node:test` for pure-logic units (no test framework installed in this repo either — same convention established in fase 1).

**Repo:** `C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone` — this is a subdirectory of the single `ADL-One` monorepo (`C:\Users\vremolcoy\Desktop\ADL ONE`, remote `github.com/InformaticaADL/ADL-One.git`), not its own separate git repo. All git commands in this plan run from `C:\Users\vremolcoy\Desktop\ADL ONE` (the repo root), even though the files being touched live under `api-backend-adlone/`.

**Depends on (already shipped, fase 1):** `api-app-mam`'s `controllers/trackingController.js` already does a fire-and-forget `POST` to `${ADL_ONE_API_URL}/api/tracking/interno/posicion` with header `x-internal-key: ${INTERNAL_API_KEY}` and JSON body `{ id_muestreador, id_jornada, lat, lon, timestamp }` every time a mobile sampler reports a location. Until this plan ships, that call 404s and only produces a harmless `console.warn` on the `api-app-mam` side — this plan is what makes it actually work end-to-end.

**Out of scope for this plan:** the frontend UI (map, panel, drawer) is fase 3, a separate plan against `frontend-adlone`. This plan only needs to prove the backend contract works — Socket.IO events firing correctly and the snapshot endpoint returning correct data — verified with a raw Socket.IO test client and curl, not through any UI.

---

### Task 1: Add the `AI_MA_HOY_EN_VIVO` permission (DB seed migration)

**Files:**
- Create: `api-backend-adlone/migrations/add_hoy_en_vivo_permission.sql`

This codebase's permission catalog lives in table `mae_permiso` (columns: `id_permiso` numeric PK, `codigo` varchar(50), `nombre` varchar(100), `modulo` varchar(50), `submodulo` varchar(50), `tipo` varchar(20) — observed values `'ACCION'`, `'ACCIÓN'`, `'Vista'` — `orden` int, `habilitado` bit). "Hoy en Vivo" is a page/view a supervisor navigates to (not a one-off action), so `tipo = 'Vista'`. It belongs under the existing `modulo = 'Medio Ambiente'`, and fits best alongside the existing `submodulo = '4. Operaciones Terreno'` (confirmed to already exist in this table, alongside other Medio Ambiente submódulos like `'3. Coordinación Operativa'` and `'5. Historial y Ejecución'`).

- [ ] **Step 1: Write the migration file**

Create `api-backend-adlone/migrations/add_hoy_en_vivo_permission.sql`:

```sql
IF NOT EXISTS (SELECT * FROM mae_permiso WHERE codigo = 'AI_MA_HOY_EN_VIVO')
BEGIN
    INSERT INTO mae_permiso (codigo, nombre, modulo, submodulo, tipo, orden, habilitado)
    VALUES (
        'AI_MA_HOY_EN_VIVO',
        'Hoy en Vivo',
        'Medio Ambiente',
        '4. Operaciones Terreno',
        'Vista',
        1002,
        1
    );
    PRINT 'Permiso AI_MA_HOY_EN_VIVO creado correctamente';
END
ELSE
BEGIN
    PRINT 'Permiso AI_MA_HOY_EN_VIVO ya existe';
END
GO

-- Descripción:
-- AI_MA_HOY_EN_VIVO controla el acceso al mapa de seguimiento en tiempo real
-- de muestreadores en terreno (submódulo "Hoy en Vivo" dentro de Medio
-- Ambiente → 4. Operaciones Terreno). Se otorga a supervisores/jefatura desde
-- el panel de administración de roles existente (RBAC), no hay UI nueva para
-- asignarlo — reutiliza el flujo estándar de gestión de roles/permisos.
```

(id_permiso is an IDENTITY-less numeric column populated by the app's own max+1 logic elsewhere in this codebase, but for a raw migration INSERT without an explicit `id_permiso`, confirm in Step 2 whether the column requires an explicit value — see verification below.)

- [ ] **Step 2: Verify the column allows auto-generation or requires an explicit ID**

Before running this against the real dev DB, check whether `id_permiso` is an IDENTITY column:

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "
import('./src/config/env.js').then(() => import('./src/config/database.js')).then(async ({ getConnection }) => {
  const pool = await getConnection();
  const r = await pool.request().query(\"SELECT COLUMNPROPERTY(OBJECT_ID('mae_permiso'), 'id_permiso', 'IsIdentity') AS is_identity\");
  console.log(JSON.stringify(r.recordset));
  process.exit(0);
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
"
```

If `is_identity` is `1`, the `INSERT` in Step 1 (which omits `id_permiso`) is correct as written — SQL Server will assign it automatically. If it's `0` (not an identity column), you must compute the next ID yourself and add it to the `INSERT`; edit the migration to:

```sql
IF NOT EXISTS (SELECT * FROM mae_permiso WHERE codigo = 'AI_MA_HOY_EN_VIVO')
BEGIN
    DECLARE @nextId INT = (SELECT ISNULL(MAX(id_permiso), 0) + 1 FROM mae_permiso);
    INSERT INTO mae_permiso (id_permiso, codigo, nombre, modulo, submodulo, tipo, orden, habilitado)
    VALUES (@nextId, 'AI_MA_HOY_EN_VIVO', 'Hoy en Vivo', 'Medio Ambiente', '4. Operaciones Terreno', 'Vista', 1002, 1);
    PRINT 'Permiso AI_MA_HOY_EN_VIVO creado correctamente';
END
ELSE
BEGIN
    PRINT 'Permiso AI_MA_HOY_EN_VIVO ya existe';
END
GO
```

- [ ] **Step 3: Apply it to the real dev DB and verify**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "
import('./src/config/env.js').then(() => import('./src/config/database.js')).then(async ({ getConnection }) => {
  const pool = await getConnection();
  const fs = await import('fs');
  const sqlText = fs.readFileSync('migrations/add_hoy_en_vivo_permission.sql', 'utf8');
  const batches = sqlText.split(/^GO\$/im).map(b => b.trim()).filter(Boolean);
  for (const batch of batches) { await pool.request().query(batch); }
  const check = await pool.request().query(\"SELECT * FROM mae_permiso WHERE codigo = 'AI_MA_HOY_EN_VIVO'\");
  console.log(JSON.stringify(check.recordset, null, 2));
  process.exit(0);
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
"
```

Expected: one row printed with `codigo: 'AI_MA_HOY_EN_VIVO'`, `tipo: 'Vista'`, `habilitado: true`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add api-backend-adlone/migrations/add_hoy_en_vivo_permission.sql
git commit -m "chore: add AI_MA_HOY_EN_VIVO permission for the live tracking view"
```

---

### Task 2: `tracking.service.js` — position broadcast + snapshot query logic

**Files:**
- Create: `api-backend-adlone/src/services/tracking.service.js`

Follows this codebase's service pattern (plain object/class exporting async methods, raw `mssql` queries via `getConnection()` — see `src/services/ficha.service.js`'s `notificarMuestreoCompletado` for the reference style already used for a very similar fire-and-forget internal notification).

- [ ] **Step 1: Create the service**

Create `api-backend-adlone/src/services/tracking.service.js`:

```js
import { getConnection } from '../config/database.js';
import sql from 'mssql';
import { getIo } from '../utils/socketManager.js';
import logger from '../utils/logger.js';

export const TRACKING_ROOM = 'hoy_en_vivo';

class TrackingService {
    /**
     * Recibe una posición ya persistida por api-app-mam (esta capa NO escribe
     * en mam_ubicaciones_tracking — esa tabla vive en la misma BD compartida y
     * ya fue insertada por el lado app-mam antes de reenviar). Su único trabajo
     * es difundirla en tiempo real a los supervisores conectados.
     */
    broadcastPosicion({ id_muestreador, id_jornada, lat, lon, timestamp }) {
        const payload = {
            id_muestreador: Number(id_muestreador),
            id_jornada: Number(id_jornada),
            lat: Number(lat),
            lon: Number(lon),
            timestamp,
        };
        getIo().to(TRACKING_ROOM).emit('posicion_actualizada', payload);
        logger.info(`[Tracking] Posición difundida: muestreador ${payload.id_muestreador}, jornada ${payload.id_jornada}`);
        return payload;
    }

    /**
     * Snapshot inicial para cuando un supervisor abre "Hoy en Vivo": jornadas
     * activas de hoy, su última posición conocida, y las fichas agendadas del
     * día (fecha_muestreo o fecha_retiro = hoy) para cada muestreador con
     * jornada activa, ordenadas por hora. Todo en la misma BD compartida que
     * usa la app móvil (mam_jornadas / mam_ubicaciones_tracking vienen de la
     * fase 1 de api-app-mam; App_Ma_Agenda_MUESTREOS es la tabla existente de
     * ADL ONE).
     */
    async getSnapshotHoy() {
        const pool = await getConnection();

        const jornadas = await pool.request().query(`
            SELECT
                j.id_jornada,
                j.id_muestreador,
                j.fecha_inicio,
                m.nombre_muestreador
            FROM mam_jornadas j
            INNER JOIN mae_muestreador m ON m.id_muestreador = j.id_muestreador
            WHERE j.fecha_fin IS NULL
            ORDER BY j.fecha_inicio ASC
        `);

        if (jornadas.recordset.length === 0) {
            return { jornadas: [] };
        }

        const idsJornada = jornadas.recordset.map(j => j.id_jornada);
        const idsMuestreador = jornadas.recordset.map(j => j.id_muestreador);

        // Última posición conocida por jornada (una fila por jornada activa).
        const ultimasPosiciones = await pool.request().query(`
            SELECT u.id_jornada, u.latitud, u.longitud, u.timestamp_reporte
            FROM mam_ubicaciones_tracking u
            INNER JOIN (
                SELECT id_jornada, MAX(id_ubicacion) AS max_id
                FROM mam_ubicaciones_tracking
                WHERE id_jornada IN (${idsJornada.join(',')})
                GROUP BY id_jornada
            ) ultimo ON ultimo.id_jornada = u.id_jornada AND ultimo.max_id = u.id_ubicacion
        `);
        const posicionPorJornada = new Map(
            ultimasPosiciones.recordset.map(p => [Number(p.id_jornada), p])
        );

        // Fichas agendadas hoy (muestreo o retiro) para los muestreadores con
        // jornada activa — cubre tanto el primer muestreador como el de retiro.
        const fichasHoy = await pool.request().query(`
            SELECT
                a.id_agendamam,
                a.frecuencia_correlativo,
                a.id_muestreador,
                a.id_muestreador2,
                a.fecha_muestreo,
                a.fecha_retiro,
                a.hora_coordinador,
                a.estado_caso,
                a.instalacion_completado,
                a.retiro_completado,
                a.id_estadomuestreo
            FROM App_Ma_Agenda_MUESTREOS a
            WHERE (a.id_muestreador IN (${idsMuestreador.join(',')}) OR a.id_muestreador2 IN (${idsMuestreador.join(',')}))
              AND (a.fecha_muestreo = CAST(GETDATE() AS DATE) OR a.fecha_retiro = CAST(GETDATE() AS DATE))
              AND (a.estado_caso IS NULL OR a.estado_caso <> 'CANCELADO')
            ORDER BY a.fecha_muestreo ASC, a.hora_coordinador ASC
        `);

        const fichasPorMuestreador = new Map();
        for (const ficha of fichasHoy.recordset) {
            for (const idMuestreador of [Number(ficha.id_muestreador), Number(ficha.id_muestreador2)]) {
                if (!idMuestreador) continue;
                if (!fichasPorMuestreador.has(idMuestreador)) fichasPorMuestreador.set(idMuestreador, []);
                fichasPorMuestreador.get(idMuestreador).push(ficha);
            }
        }

        const resultado = jornadas.recordset.map(j => {
            const idJornada = Number(j.id_jornada);
            const idMuestreador = Number(j.id_muestreador);
            return {
                id_jornada: idJornada,
                id_muestreador: idMuestreador,
                nombre_muestreador: j.nombre_muestreador,
                fecha_inicio: j.fecha_inicio,
                ultima_posicion: posicionPorJornada.get(idJornada) || null,
                fichas_hoy: fichasPorMuestreador.get(idMuestreador) || [],
            };
        });

        return { jornadas: resultado };
    }
}

export default new TrackingService();
```

- [ ] **Step 2: Verify it loads without syntax errors**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "import('./src/services/tracking.service.js').then(m => console.log(typeof m.default.broadcastPosicion, typeof m.default.getSnapshotHoy, m.TRACKING_ROOM))"
```

Expected: `function function hoy_en_vivo`

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add api-backend-adlone/src/services/tracking.service.js
git commit -m "feat: add tracking service (position broadcast + hoy-en-vivo snapshot query)"
```

---

### Task 3: `tracking.controller.js`

**Files:**
- Create: `api-backend-adlone/src/controllers/tracking.controller.js`

Follows the controller-class pattern used by `ficha.controller.js` (`export default new XController()`, `successResponse`/`errorResponse` from `utils/response.js`).

- [ ] **Step 1: Create the controller**

Create `api-backend-adlone/src/controllers/tracking.controller.js`:

```js
import { successResponse, errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';
import trackingService from '../services/tracking.service.js';

class TrackingController {
    /**
     * POST /api/tracking/interno/posicion — llamado por api-app-mam
     * (servidor-a-servidor, protegido con protectInternalService) cada vez que
     * un muestreador reporta su ubicación GPS. La posición YA está guardada en
     * mam_ubicaciones_tracking por el lado api-app-mam; acá solo se difunde en
     * tiempo real a los supervisores conectados.
     */
    async recibirPosicion(req, res) {
        try {
            const { id_muestreador, id_jornada, lat, lon, timestamp } = req.body;

            if (!id_muestreador || !id_jornada || lat === undefined || lon === undefined) {
                return errorResponse(res, 'id_muestreador, id_jornada, lat y lon son requeridos', 400);
            }

            const payload = trackingService.broadcastPosicion({ id_muestreador, id_jornada, lat, lon, timestamp });
            return successResponse(res, payload, 'Posición difundida');
        } catch (err) {
            logger.error('Error in recibirPosicion controller:', err);
            return errorResponse(res, 'Error al procesar la posición', 500, err.message);
        }
    }

    /**
     * GET /api/tracking/hoy — snapshot inicial para la pantalla "Hoy en Vivo"
     * de un supervisor. Requiere el permiso AI_MA_HOY_EN_VIVO.
     */
    async getSnapshot(req, res) {
        try {
            const data = await trackingService.getSnapshotHoy();
            return successResponse(res, data, 'Snapshot obtenido');
        } catch (err) {
            logger.error('Error in getSnapshot controller:', err);
            return errorResponse(res, 'Error al obtener el snapshot de seguimiento', 500, err.message);
        }
    }
}

export default new TrackingController();
```

- [ ] **Step 2: Verify it loads without syntax errors**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "import('./src/controllers/tracking.controller.js').then(m => console.log(typeof m.default.recibirPosicion, typeof m.default.getSnapshot))"
```

Expected: `function function`

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add api-backend-adlone/src/controllers/tracking.controller.js
git commit -m "feat: add tracking controller (recibirPosicion, getSnapshot)"
```

---

### Task 4: Routes + mount in `server.js`

**Files:**
- Create: `api-backend-adlone/src/routes/tracking.routes.js`
- Modify: `api-backend-adlone/src/server.js`

- [ ] **Step 1: Create the router**

Create `api-backend-adlone/src/routes/tracking.routes.js`:

```js
import express from 'express';
import trackingController from '../controllers/tracking.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { protectInternalService } from '../middlewares/protectInternalService.js';
import { verifyPermission } from '../middlewares/verifyPermission.js';

const router = express.Router();

router.post('/interno/posicion', protectInternalService, trackingController.recibirPosicion);
router.get('/hoy', authenticate, verifyPermission('AI_MA_HOY_EN_VIVO'), trackingController.getSnapshot);

export default router;
```

- [ ] **Step 2: Mount it in `server.js`**

In `api-backend-adlone/src/server.js`, find the route imports block (near the top, after the other route imports):

```js
import rutasPlanificadasRoutes from './routes/rutas-planificadas.routes.js';
import rutasEjecucionesRoutes from './routes/rutas-ejecuciones.routes.js';
```

Add right after:

```js
import trackingRoutes from './routes/tracking.routes.js';
```

Then find the mount block:

```js
app.use('/api/rutas-planificadas', rutasPlanificadasRoutes);
app.use('/api/rutas-ejecuciones', rutasEjecucionesRoutes);
```

Add right after:

```js
app.use('/api/tracking', trackingRoutes);
```

- [ ] **Step 3: Start the server and verify it boots cleanly**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
npm run dev
```

Expected: starts cleanly on port 8002 (per `.env`'s `PORT=8002`), no import/syntax errors. Leave it running for the next steps (or restart per-step as needed — `nodemon` will auto-reload on further file changes anyway).

- [ ] **Step 4: Verify `POST /api/tracking/interno/posicion` requires the internal key**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8002/api/tracking/interno/posicion \
  -H "Content-Type: application/json" \
  -d '{"id_muestreador":229,"id_jornada":1,"lat":-45.5,"lon":-72.0}'
```

Expected: `401` (missing `x-internal-key` header).

Find `INTERNAL_API_KEY`'s real value:

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "import('./src/config/env.js').then(() => console.log(process.env.INTERNAL_API_KEY))"
```

Then retry with it:

```bash
curl -s -X POST http://localhost:8002/api/tracking/interno/posicion \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <VALUE_FROM_ABOVE>" \
  -d '{"id_muestreador":229,"id_jornada":1,"lat":-45.5,"lon":-72.0,"timestamp":"2026-08-04T12:00:00.000Z"}'
```

Expected: `200` with `{"success":true,"message":"Posición difundida","data":{"id_muestreador":229,"id_jornada":1,"lat":-45.5,"lon":-72,"timestamp":"2026-08-04T12:00:00.000Z"},"timestamp":"..."}`.

- [ ] **Step 5: Verify `GET /api/tracking/hoy` requires auth and the permission**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8002/api/tracking/hoy
```

Expected: `401` (no token).

Full permission + data verification happens in Task 6 (needs the socket join test and a user account with the new permission assigned to a role) — for now just confirm the route exists and enforces auth.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add api-backend-adlone/src/server.js api-backend-adlone/src/routes/tracking.routes.js
git commit -m "feat: wire tracking routes (interno/posicion, hoy) into server.js"
```

---

### Task 5: Socket.IO room join with permission check

**Files:**
- Modify: `api-backend-adlone/src/server.js`

Follows the exact pattern already used for `joinChat` (a permission/participation check before `socket.join(...)`), except the check here is a JWT-embedded permission array lookup (no DB round-trip needed, since `authenticate` middleware already confirms `req.user.permissions` — and `socket.user` is populated from the same JWT via `jwt.verify` in the Socket.IO `io.use` middleware already present in this file).

- [ ] **Step 1: Add the `joinTracking` socket handler**

In `api-backend-adlone/src/server.js`, find the existing socket handlers block:

```js
    socket.on('leaveChat', (conversationId) => {
        socket.leave(`chat_${conversationId}`);
    });
```

Add right after it:

```js
    // Hoy en Vivo: unirse a la sala de tracking en vivo solo si el usuario
    // tiene el permiso AI_MA_HOY_EN_VIVO (embebido en el JWT decodificado en
    // el middleware io.use de arriba — sin round-trip a BD, igual que
    // verifyPermission en las rutas HTTP).
    socket.on('joinTracking', () => {
        const permissions = socket.user?.permissions || [];
        if (!permissions.includes('AI_MA_HOY_EN_VIVO')) {
            logger.warn(`User ${socket.user?.id} intentó unirse a hoy_en_vivo sin permiso`);
            return;
        }
        socket.join('hoy_en_vivo');
        logger.info(`User ${socket.user?.id} joined hoy_en_vivo room`);
    });

    socket.on('leaveTracking', () => {
        socket.leave('hoy_en_vivo');
    });
```

- [ ] **Step 2: Verify the server still boots cleanly**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
npm run dev
```

Expected: starts without errors (nodemon should have already reloaded from Task 4's server still running, but do a full stop/restart to confirm a clean boot from scratch).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add api-backend-adlone/src/server.js
git commit -m "feat: add hoy_en_vivo Socket.IO room with permission-gated join"
```

---

### Task 6: End-to-end verification (socket client + permission grant + snapshot)

**Files:** none created — this task verifies Tasks 1-5 together against the real dev DB and a real Socket.IO connection. No commit at the end (verification-only task).

- [ ] **Step 1: Grant the new permission to a real user for testing**

You need a dev user account that already has SOME admin/supervisor role, and grant that role the new `AI_MA_HOY_EN_VIVO` permission. Find an existing role and add the permission via direct SQL (mirroring what the RBAC admin UI would do — `rel_rol_permiso` links `id_rol` to `id_permiso`):

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "
import('./src/config/env.js').then(() => import('./src/config/database.js')).then(async ({ getConnection }) => {
  const pool = await getConnection();
  const roles = await pool.request().query(\"SELECT TOP 5 id_rol, nombre FROM mae_rol\");
  console.log('ROLES:', JSON.stringify(roles.recordset, null, 2));
  process.exit(0);
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
"
```

Pick a role that looks like a supervisor/admin role from the printed list (ask the user which one to use if it's not obvious from the names — do not guess on a production-adjacent shared dev DB). Then:

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "
import('./src/config/env.js').then(() => import('./src/config/database.js')).then(async ({ getConnection }) => {
  const pool = await getConnection();
  const perm = await pool.request().query(\"SELECT id_permiso FROM mae_permiso WHERE codigo = 'AI_MA_HOY_EN_VIVO'\");
  const idPermiso = perm.recordset[0].id_permiso;
  const ROLE_ID = <ID_ROL_ELEGIDO>; // reemplaza con el id_rol elegido arriba
  const exists = await pool.request()
    .query(\`SELECT * FROM rel_rol_permiso WHERE id_rol = \${ROLE_ID} AND id_permiso = \${idPermiso}\`);
  if (exists.recordset.length === 0) {
    await pool.request().query(\`INSERT INTO rel_rol_permiso (id_rol, id_permiso) VALUES (\${ROLE_ID}, \${idPermiso})\`);
    console.log('Permiso asignado al rol', ROLE_ID);
  } else {
    console.log('El rol ya tenía el permiso');
  }
  process.exit(0);
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
"
```

- [ ] **Step 2: Log in as a user with that role and get a JWT**

Use the existing `POST /api/auth/login` endpoint (confirmed at `src/routes/auth.routes.js:6` → `authController.login`, which reads `const { username, password, rememberMe } = req.body;` per `src/controllers/auth.controller.js:8`) with a dev account that has the role from Step 1. If you don't have credentials, ask the user for a working dev login for `api-backend-adlone` (same as fase 1 needed one for `api-app-mam` — do not guess or attempt to reset an existing user's password without asking first).

```bash
curl -s -X POST http://localhost:8002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"<usuario>","password":"<clave>"}'
```

Expected: a JSON response containing a `token`. Confirm the decoded JWT's `permissions` array includes `AI_MA_HOY_EN_VIVO` (you can decode it without verifying: `node -e "console.log(JSON.parse(Buffer.from('<token>'.split('.')[1], 'base64url').toString()))"`).

- [ ] **Step 3: Verify `GET /api/tracking/hoy` now works**

```bash
curl -s http://localhost:8002/api/tracking/hoy \
  -H "Authorization: Bearer <TOKEN_FROM_STEP_2>"
```

Expected: `200` with `{"success":true,"message":"Snapshot obtenido","data":{"jornadas":[...]},"timestamp":"..."}`. If there's currently an active jornada in `mam_jornadas` from fase 1's testing (there may be leftover test data), it should appear in the array with its `ultima_posicion` and `fichas_hoy`. If there's no active jornada right now, `jornadas` will be an empty array — that's a valid, correct response, not a failure.

- [ ] **Step 4: Verify the Socket.IO broadcast end-to-end with a real client**

Write a throwaway (do not commit) verification script:

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
cat > /tmp/verify-socket.mjs << 'EOF'
import { io as ioClient } from 'socket.io-client';

const TOKEN = process.argv[2];
const socket = ioClient('http://localhost:8002', { auth: { token: TOKEN } });

socket.on('connect', () => {
    console.log('Connected:', socket.id);
    socket.emit('joinTracking');
});

socket.on('posicion_actualizada', (payload) => {
    console.log('RECEIVED:', JSON.stringify(payload));
    process.exit(0);
});

socket.on('connect_error', (err) => {
    console.error('Connect error:', err.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('Timeout: no event received within 10s');
    process.exit(1);
}, 10000);
EOF
node /tmp/verify-socket.mjs "<TOKEN_FROM_STEP_2>"
```

(If `socket.io-client` isn't already a dependency of this project, install it as a dev dependency first: `npm install --save-dev socket.io-client`, then repeat — it must be present for this throwaway script to run, but check `package.json` first since the frontend might already share a compatible version pattern you can reference.)

While that script is running and waiting (within the 10s window), in a SEPARATE terminal, trigger a position report exactly like Task 4/Step 4 did:

```bash
curl -s -X POST http://localhost:8002/api/tracking/interno/posicion \
  -H "Content-Type: application/json" \
  -H "x-internal-key: <INTERNAL_API_KEY_VALUE>" \
  -d '{"id_muestreador":229,"id_jornada":1,"lat":-45.6,"lon":-72.1,"timestamp":"2026-08-04T12:05:00.000Z"}'
```

Expected: the socket script prints `RECEIVED: {"id_muestreador":229,"id_jornada":1,"lat":-45.6,"lon":-72.1,"timestamp":"2026-08-04T12:05:00.000Z"}` and exits 0 — proving the full relay → broadcast → client-receive chain works.

Delete the throwaway script afterward: `rm /tmp/verify-socket.mjs` (or leave it in `/tmp`, it's outside the repo either way — just don't `git add` it).

- [ ] **Step 5: Verify the purge job doesn't exist yet (sanity check before Task 7)**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
grep -n "mam_ubicaciones_tracking" src/utils/scheduler.js
```

Expected: no output (confirms Task 7 hasn't been done yet, and you're not about to duplicate work).

---

### Task 7: 30-day purge job in the scheduler

**Files:**
- Modify: `api-backend-adlone/src/utils/scheduler.js`

- [ ] **Step 1: Add the purge function and wire it into the scheduler**

In `api-backend-adlone/src/utils/scheduler.js`, find this section near the top (the other job definitions, before `// --- Startup Execution ---`):

```js
    // --- 3. KPI Analyst Dashboard Automation ---
    const runKpiAgent = async (mode = 'interval') => {
        try {
            await runKpiAnalyst({ mode });
        } catch (error) {
            logger.error(`[KPI Analyst] Error during ${mode} execution:`, error);
        }
    };
```

Add right after it:

```js
    // --- 4. Hoy en Vivo: purga de historial GPS (retención 30 días) ---
    const purgeTrackingHistory = async () => {
        try {
            const pool = await getConnection();
            const result = await pool.request().query(`
                DELETE FROM mam_ubicaciones_tracking
                WHERE creado_en < DATEADD(day, -30, GETDATE())
            `);
            const rowsDeleted = result.rowsAffected?.[0] ?? 0;
            if (rowsDeleted > 0) {
                logger.info(`[Tracking Purge] Eliminadas ${rowsDeleted} posiciones GPS con más de 30 días de antigüedad.`);
            } else {
                logger.info('[Tracking Purge] No hay posiciones antiguas para eliminar.');
            }
        } catch (error) {
            logger.error('[Tracking Purge] Error al purgar historial de ubicaciones:', error);
        }
    };
```

Then find the `// --- Startup Execution ---` block:

```js
    // --- Startup Execution ---
    setTimeout(() => {
        runDailyCheck();
        pollNewRequests();
        pollMuestreosCompletados();
    }, 10000);
```

Add `purgeTrackingHistory()` to that same startup batch:

```js
    // --- Startup Execution ---
    setTimeout(() => {
        runDailyCheck();
        pollNewRequests();
        pollMuestreosCompletados();
        purgeTrackingHistory();
    }, 10000);
```

Finally, find the `// --- Active Loops ---` block:

```js
    // --- Active Loops ---
    // Every 24 hours
    setInterval(runDailyCheck, 24 * 60 * 60 * 1000);
```

Add a new interval right after it:

```js
    // Every 24 hours (Tracking history purge — retention: 30 days)
    setInterval(purgeTrackingHistory, 24 * 60 * 60 * 1000);
```

And update the final log line:

```js
    logger.info('Scheduler initialized: Daily check, URS Watcher, Muestreo Completado Watcher, Tracking Purge, and KPI Analyst active.');
```

- [ ] **Step 2: Verify manually against the real dev DB**

Since this runs on a 24h interval and a 10s startup delay, don't wait for the schedule — call the query logic directly to confirm it's syntactically correct and safe to run:

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
node -e "
import('./src/config/env.js').then(() => import('./src/config/database.js')).then(async ({ getConnection }) => {
  const pool = await getConnection();
  const before = await pool.request().query('SELECT COUNT(*) AS total FROM mam_ubicaciones_tracking');
  console.log('Rows before:', before.recordset[0].total);
  const result = await pool.request().query(\`
    DELETE FROM mam_ubicaciones_tracking
    WHERE creado_en < DATEADD(day, -30, GETDATE())
  \`);
  console.log('Rows deleted:', result.rowsAffected[0]);
  const after = await pool.request().query('SELECT COUNT(*) AS total FROM mam_ubicaciones_tracking');
  console.log('Rows after:', after.recordset[0].total);
  process.exit(0);
}).catch(e => { console.error('ERR', e.message); process.exit(1); });
"
```

Expected: runs without SQL errors. `Rows deleted` will likely be `0` since all test data from fase 1/this fase's verification is brand new (well under 30 days old) — that's correct and expected, not a failure. The important thing is the query executes cleanly against the real schema.

- [ ] **Step 3: Full server smoke test**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE\api-backend-adlone"
npm run dev
```

Expected: starts cleanly, and within ~10 seconds the log line `[Tracking Purge] No hay posiciones antiguas para eliminar.` (or the "Eliminadas N" variant) appears, confirming the startup execution ran without throwing.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git add api-backend-adlone/src/utils/scheduler.js
git commit -m "feat: add 30-day retention purge job for tracking position history"
```

---

### Task 8: Push

- [ ] **Step 1: Push**

```bash
cd "C:\Users\vremolcoy\Desktop\ADL ONE"
git push origin main
```

---

## What fase 3 will need from this plan

The next plan (`frontend-adlone`) will build the actual "Hoy en Vivo" UI: it connects to the existing Socket.IO client setup (`useNotificationStore`'s pattern), emits `joinTracking` after connecting, listens for `posicion_actualizada` events, and calls `GET /api/tracking/hoy` for the initial snapshot when the page mounts. Nothing in this plan needs to change for that to work — the event name (`posicion_actualizada`), room name (`hoy_en_vivo`), and snapshot response shape (`{ jornadas: [{ id_jornada, id_muestreador, nombre_muestreador, fecha_inicio, ultima_posicion, fichas_hoy }] }`) are all final.
