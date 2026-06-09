# Rutas Distancia/Tiempo + Muestreadores Entrenamiento/Competencias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist & display OSRM driving distance/time on planned routes; add a training status + multiple support documents to samplers; add a competencies master (soft-delete) with a many-to-many link to samplers, fully editable per sampler.

**Architecture:** Three independent phases. Backend follows the existing `routes → controller → service` pattern (Express + `mssql`). New sampler fields use **separate endpoints/queries** (the existing `MAM_Admin_Muestreador_*` SPs are NOT modified). Frontend is React 19 + Mantine v8; services call `apiClient`. DB migrations (003/004/005) are **already executed**.

**Tech Stack:** Node/Express (ESM), `mssql`, `multer`; React 19, Vite, TypeScript, Mantine v8, `@tabler/icons-react`.

**Spec:** `docs/superpowers/specs/2026-06-02-rutas-muestreadores-competencias-design.md`

---

## Testing & verification approach (read first)

This repo has **no automated test framework** (only `npm run dev/start/build/lint`). Do NOT invent a test runner. Verify each task with:

- **Backend syntax:** `node --check <file>` from `api-backend-adlone/`.
- **Backend behavior:** ad-hoc verification scripts using the established pattern — create a temp file in `api-backend-adlone/`, `import dotenv from 'dotenv'; dotenv.config();` then `const { getConnection, closeConnection } = await import('./src/config/database.js');` (dynamic import AFTER dotenv so env loads), run a query/service call, print, `process.exit(0)`. **Delete the temp script after.** Run with `node tmp-verify.js 2>&1 | grep -v "service.*adl-one-api"`.
- **Frontend types:** from `frontend-adlone/`, `npx tsc -b --noEmit 2>&1 | grep -iE "<ChangedFile>"` — confirm no NEW errors in changed files (the repo has pre-existing errors in unrelated files; ignore those).
- **Manual UI:** stated per task ("open X, expect Y").

**Commits:** The user asked not to auto-commit. Each task ends with a prepared commit command — run it only when the user approves. Group commits per phase if preferred.

**DB note:** sampler PK `mae_muestreador.id_muestreador` is `NUMERIC(10,0)` → use `sql.Numeric(10,0)`. `mae_rutas_planificadas` PK uses `sql.Int`. `id_competencia` is `INT` identity.

---

# PHASE A — Rutas: distancia y tiempo

### Task A1: Backend persists & returns distancia/duracion

**Files:**
- Modify: `api-backend-adlone/src/services/rutas-planificadas.service.js` (`create` ~158-201, `update` ~215-263, and the read methods `getAll`/`getById`)

- [ ] **Step 1: Add the two columns to `create` INSERT**

In `create(data, user)`, change the destructure and the cabecera INSERT:

```js
async create(data, user) {
    const { nombre_ruta, fichas, id_grupo, descripcion, distancia_metros, duracion_segundos } = data;
    const pool = await getConnection();
    const transaction = new sql.Transaction(pool);

    try {
        await transaction.begin();

        const reqCabecera = new sql.Request(transaction);
        reqCabecera.input('nombre', sql.NVarChar(250), nombre_ruta);
        reqCabecera.input('creador', sql.Int, user ? user.id : null);
        reqCabecera.input('grupo', sql.Int, id_grupo || null);
        reqCabecera.input('desc', sql.NVarChar(1000), descripcion || null);
        reqCabecera.input('dist', sql.Int, (distancia_metros ?? null));
        reqCabecera.input('dur', sql.Int, (duracion_segundos ?? null));

        const insertResult = await reqCabecera.query(`
            INSERT INTO mae_rutas_planificadas (nombre_ruta, id_usuario_creador, estado, id_grupo, descripcion, distancia_metros, duracion_segundos)
            OUTPUT INSERTED.id_ruta_planificada
            VALUES (@nombre, @creador, 'PENDIENTE', @grupo, @desc, @dist, @dur)
        `);
        // ...rest unchanged
```

- [ ] **Step 2: Add columns to `update` UPDATE**

In `update(id, data, user)`, change the destructure and the header UPDATE:

```js
const { nombre_ruta, fichas, id_grupo, descripcion, distancia_metros, duracion_segundos } = data;
// ...
const reqHeader = new sql.Request(transaction);
await reqHeader
    .input('id', sql.Int, id)
    .input('nombre', sql.NVarChar(250), nombre_ruta)
    .input('grupo', sql.Int, id_grupo !== undefined ? (id_grupo || null) : undefined)
    .input('desc', sql.NVarChar(1000), descripcion !== undefined ? (descripcion || null) : undefined)
    .input('dist', sql.Int, (distancia_metros ?? null))
    .input('dur', sql.Int, (duracion_segundos ?? null))
    .query(`
        UPDATE mae_rutas_planificadas
        SET nombre_ruta = @nombre,
            id_grupo = @grupo,
            descripcion = @desc,
            distancia_metros = @dist,
            duracion_segundos = @dur
        WHERE id_ruta_planificada = @id
    `);
```

- [ ] **Step 3: Ensure read methods return the columns**

Find `getAll()` and `getById(id)` in the same file. If they use `SELECT *` on `mae_rutas_planificadas`, no change is needed. If they use an explicit column list, add `distancia_metros, duracion_segundos` (and in `getById` alias as needed). Read the methods first and adjust only if columns are explicitly listed.

- [ ] **Step 4: Syntax check**

Run from `api-backend-adlone/`: `node --check src/services/rutas-planificadas.service.js`
Expected: no output (success).

- [ ] **Step 5: Behavior check (temp script)**

Create `api-backend-adlone/tmp-verify-rutas.js`:

```js
import dotenv from 'dotenv'; dotenv.config();
const { getConnection, closeConnection } = await import('./src/config/database.js');
const pool = await getConnection();
const r = await pool.request().query("SELECT TOP 1 COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='mae_rutas_planificadas' AND COLUMN_NAME='distancia_metros'");
console.log('distancia_metros exists:', r.recordset.length === 1);
await closeConnection().catch(()=>{}); process.exit(0);
```

Run: `node tmp-verify-rutas.js 2>&1 | grep -v "service.*adl-one-api" | grep -iv "DB Config"`
Expected: `distancia_metros exists: true`. Then delete the temp file.

- [ ] **Step 6: Commit (when approved)**

```bash
git add api-backend-adlone/src/services/rutas-planificadas.service.js
git commit -m "feat(rutas): persist OSRM distance/time on planned routes"
```

---

### Task A2: Frontend service types

**Files:**
- Modify: `frontend-adlone/src/features/medio-ambiente/services/rutasPlanificadas.service.ts`

- [ ] **Step 1: Extend the `RutaPlanificada` interface**

Add to the interface (after `nombre_grupo?: string;`):

```ts
    distancia_metros?: number | null;
    duracion_segundos?: number | null;
```

- [ ] **Step 2: Extend `create` and `update` payload types**

In both `create` and `update`, add the two optional fields to the `data` param type:

```ts
create: async (data: { nombre_ruta: string; descripcion?: string; id_grupo?: number; distancia_metros?: number | null; duracion_segundos?: number | null; fichas: { id_fichaingresoservicio: number; orden: number; frecuencia_correlativo?: string }[] }) => {
    const response = await apiClient.post('/api/rutas-planificadas', data);
    return response.data.data;
},
update: async (id: number, data: { nombre_ruta: string; descripcion?: string; id_grupo?: number; distancia_metros?: number | null; duracion_segundos?: number | null; fichas: { id_fichaingresoservicio: number; orden: number; frecuencia_correlativo?: string }[] }) => {
    const response = await apiClient.put(`/api/rutas-planificadas/${id}`, data);
    return response.data.data;
},
```

- [ ] **Step 2b:** No verification beyond the typecheck in Task A3 (this file alone won't error).

---

### Task A3: Capture OSRM distance/time and send on save

**Files:**
- Modify: `frontend-adlone/src/features/medio-ambiente/components/RouteMapPlannerView.tsx` (OSRM `useEffect` ~486-512; save `payload` ~379-388)

- [ ] **Step 1: Add state for distance/duration**

Near the other route state (e.g., right after `const [osrmRoute, setOsrmRoute] = useState<[number, number][]>([]);` ~line 235):

```tsx
const [routeDistance, setRouteDistance] = useState<number | null>(null); // metros
const [routeDuration, setRouteDuration] = useState<number | null>(null); // segundos
```

- [ ] **Step 2: Capture distance/duration in the OSRM `useEffect`**

In the OSRM `useEffect` (~486), update the success and the `<2 points`/fail branches:

```tsx
useEffect(() => {
    if (routePositions.length < 2) {
        setOsrmRoute([]);
        setRouteDistance(null);
        setRouteDuration(null);
        return;
    }
    const controller = new AbortController();
    const fetchRoute = async () => {
        try {
            const coordsStr = routePositions.map(p => `${p[1]},${p[0]}`).join(';');
            const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`, { signal: controller.signal });
            const data = await res.json();
            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                setOsrmRoute(route.geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]));
                setRouteDistance(typeof route.distance === 'number' ? Math.round(route.distance) : null);
                setRouteDuration(typeof route.duration === 'number' ? Math.round(route.duration) : null);
            } else {
                setOsrmRoute([]);
                setRouteDistance(null);
                setRouteDuration(null);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.warn('OSRM routing fallback failed:', err);
                setOsrmRoute([]);
                setRouteDistance(null);
                setRouteDuration(null);
            }
        }
    };
    fetchRoute();
    return () => controller.abort();
}, [routePositions]);
```

- [ ] **Step 3: Include in the save payload**

In the `payload` object (~379) add the two fields:

```tsx
const payload = {
    nombre_ruta: nombreRuta,
    descripcion: descripcionRuta || undefined,
    id_grupo: selectedGrupo ? Number(selectedGrupo) : undefined,
    distancia_metros: routeDistance,
    duracion_segundos: routeDuration,
    fichas: selectedItems.map((item, index) => ({
        id_fichaingresoservicio: item.fichaId,
        orden: index + 1,
        frecuencia_correlativo: item.frecuencia_correlativo
    }))
};
```

- [ ] **Step 4: (Optional) Show live total in the planner UI**

If there is a summary area near the save button, optionally show `routeDistance`/`routeDuration` using the formatters added in Task A4. Skip if no obvious spot; this is cosmetic.

- [ ] **Step 5: Typecheck**

From `frontend-adlone/`: `npx tsc -b --noEmit 2>&1 | grep -i "RouteMapPlannerView"`
Expected: empty (no errors in this file).

- [ ] **Step 6: Commit (when approved)**

```bash
git add frontend-adlone/src/features/medio-ambiente/components/RouteMapPlannerView.tsx frontend-adlone/src/features/medio-ambiente/services/rutasPlanificadas.service.ts
git commit -m "feat(rutas): capture OSRM distance/time and send on route save"
```

---

### Task A4: Display distance/time in list column + detail modal

**Files:**
- Modify: `frontend-adlone/src/features/medio-ambiente/components/RutasListView.tsx`

- [ ] **Step 1: Add formatter helpers**

Near the existing `formatDate` helper (~208), add:

```tsx
const formatDistancia = (m?: number | null) => {
    if (m === null || m === undefined) return '—';
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
};
const formatDuracion = (s?: number | null) => {
    if (s === null || s === undefined) return '—';
    const h = Math.floor(s / 3600);
    const min = Math.round((s % 3600) / 60);
    return h > 0 ? `${h} h ${min} min` : `${min} min`;
};
```

- [ ] **Step 2: Add the "Vehículo" header column**

In the table `<Table.Thead>` (~716-725), add a header after `Ejecuciones`:

```tsx
<Table.Th>Vehículo</Table.Th>
```

- [ ] **Step 3: Render the cell in `renderRutaRow`**

In `renderRutaRow` (~478-567), after the "Ejecuciones" `<Table.Td>` (the one ending ~509) and before the Estado `<Table.Td>`, add:

```tsx
<Table.Td>
    {(r.distancia_metros != null || r.duracion_segundos != null) ? (
        <Stack gap={0}>
            <Text size="xs" fw={600}>{formatDistancia(r.distancia_metros)}</Text>
            <Text size="10px" c="dimmed">{formatDuracion(r.duracion_segundos)}</Text>
        </Stack>
    ) : <Text size="xs" c="dimmed">—</Text>}
</Table.Td>
```

- [ ] **Step 4: Show it in the detail modal header**

In the detail modal info line (~764-768), append after the fichas-con-ubicación text:

```tsx
{(viewTarget.distancia_metros != null || viewTarget.duracion_segundos != null) && (
    <> · 🚗 <strong>{formatDistancia(viewTarget.distancia_metros)}</strong> · ⏱ <strong>{formatDuracion(viewTarget.duracion_segundos)}</strong></>
)}
```

- [ ] **Step 5: Typecheck**

From `frontend-adlone/`: `npx tsc -b --noEmit 2>&1 | grep -i "RutasListView"`
Expected: empty.

- [ ] **Step 6: Manual check**

Run `npm run dev` (frontend) + backend. Create/edit a route with ≥2 fichas with coords → save → in the list the "Vehículo" column shows e.g. `124.3 km / 2 h 15 min`; the detail modal header shows the same. Routes without data show `—`.

- [ ] **Step 7: Commit (when approved)**

```bash
git add frontend-adlone/src/features/medio-ambiente/components/RutasListView.tsx
git commit -m "feat(rutas): show vehicle distance/time in list column and detail"
```

---

# PHASE B — Muestreadores: entrenamiento + documentos

> Migration 004 already added `mae_muestreador.en_entrenamiento` (existing rows = 'N') and table `mae_muestreador_documento`.

### Task B1: Backend — include `en_entrenamiento` in list + set-status + documents service

**Files:**
- Modify: `api-backend-adlone/src/services/admin.service.js`

- [ ] **Step 1: Add `en_entrenamiento` to the `getMuestreadores` SELECT**

In `getMuestreadores` (~36), update the SELECT column list:

```js
let query = `
    SELECT 
        id_muestreador,
        nombre_muestreador,
        correo_electronico,
        habilitado,
        en_entrenamiento,
        firma_muestreador
    FROM mae_muestreador
    WHERE 1=1
`;
```

- [ ] **Step 2: Add service methods for training status & documents**

Add these methods to the `adminService` object (e.g., after `enableMuestreador`). Imports needed at top of file: ensure `sql`, `getConnection`, `logger` are already imported (they are). Add `import fs from 'fs'; import path from 'path';` if not present.

```js
    // --- ENTRENAMIENTO ---
    setEntrenamiento: async (id, enEntrenamiento) => {
        const pool = await getConnection();
        const val = enEntrenamiento === 'S' ? 'S' : 'N';
        await pool.request()
            .input('id', sql.Numeric(10, 0), Number(id))
            .input('val', sql.Char(1), val)
            .query('UPDATE mae_muestreador SET en_entrenamiento = @val WHERE id_muestreador = @id');
        return { id_muestreador: Number(id), en_entrenamiento: val };
    },

    // --- DOCUMENTOS DE MUESTREADOR ---
    getDocumentosMuestreador: async (id) => {
        const pool = await getConnection();
        const r = await pool.request()
            .input('id', sql.Numeric(10, 0), Number(id))
            .query(`SELECT id_documento, id_muestreador, nombre_documento, descripcion, ruta_archivo, fecha_subida, id_usuario_subida
                    FROM mae_muestreador_documento WHERE id_muestreador = @id ORDER BY fecha_subida DESC`);
        return r.recordset;
    },

    addDocumentoMuestreador: async (id, { nombre_documento, descripcion, ruta_archivo, id_usuario_subida }) => {
        const pool = await getConnection();
        const r = await pool.request()
            .input('id', sql.Numeric(10, 0), Number(id))
            .input('nombre', sql.NVarChar(200), nombre_documento)
            .input('desc', sql.NVarChar(500), descripcion || null)
            .input('ruta', sql.NVarChar(500), ruta_archivo)
            .input('uid', sql.Numeric(10, 0), id_usuario_subida || null)
            .query(`INSERT INTO mae_muestreador_documento (id_muestreador, nombre_documento, descripcion, ruta_archivo, id_usuario_subida)
                    OUTPUT INSERTED.id_documento
                    VALUES (@id, @nombre, @desc, @ruta, @uid)`);
        return { id_documento: r.recordset[0].id_documento };
    },

    deleteDocumentoMuestreador: async (idDoc) => {
        const pool = await getConnection();
        // Read path to remove the file from disk (best-effort)
        const sel = await pool.request()
            .input('id', sql.Int, Number(idDoc))
            .query('SELECT ruta_archivo FROM mae_muestreador_documento WHERE id_documento = @id');
        await pool.request()
            .input('id', sql.Int, Number(idDoc))
            .query('DELETE FROM mae_muestreador_documento WHERE id_documento = @id');
        const ruta = sel.recordset[0]?.ruta_archivo;
        if (ruta) {
            try {
                const uploadRoot = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
                const abs = path.join(uploadRoot, ruta.replace(/^\/uploads\//, ''));
                if (fs.existsSync(abs)) fs.unlinkSync(abs);
            } catch (e) { logger.warn('No se pudo borrar archivo físico del documento:', e.message); }
        }
        return { success: true };
    },
```

- [ ] **Step 3: Syntax check**

From `api-backend-adlone/`: `node --check src/services/admin.service.js`
Expected: no output.

- [ ] **Step 4: Behavior check (temp script)**

Create `api-backend-adlone/tmp-verify-ent.js`:

```js
import dotenv from 'dotenv'; dotenv.config();
const { default: adminService } = await import('./src/services/admin.service.js');
const { closeConnection } = await import('./src/config/database.js');
const list = await adminService.getMuestreadores('', 'TODOS');
console.log('first sampler has en_entrenamiento field:', list.length ? ('en_entrenamiento' in list[0]) : 'no rows');
await closeConnection().catch(()=>{}); process.exit(0);
```

Run: `node tmp-verify-ent.js 2>&1 | grep -v "service.*adl-one-api" | grep -iv "DB Config\|Loading\|Connected"`
Expected: `first sampler has en_entrenamiento field: true`. Delete temp file.

- [ ] **Step 5: Commit (when approved)**

```bash
git add api-backend-adlone/src/services/admin.service.js
git commit -m "feat(muestreadores): training status + documents service methods"
```

---

### Task B2: Backend — controller + routes (training + documents upload)

**Files:**
- Modify: `api-backend-adlone/src/controllers/admin.controller.js`
- Modify: `api-backend-adlone/src/routes/admin.routes.js`

- [ ] **Step 1: Add controller methods**

In `admin.controller.js`, add to the `adminController` object (after `enableMuestreador`):

```js
    setEntrenamiento: async (req, res) => {
        try {
            const { id } = req.params;
            const { en_entrenamiento } = req.body;
            if (en_entrenamiento !== 'S' && en_entrenamiento !== 'N') {
                return res.status(400).json({ success: false, message: "en_entrenamiento debe ser 'S' o 'N'" });
            }
            const result = await adminService.setEntrenamiento(id, en_entrenamiento);
            res.json({ success: true, data: result, message: 'Estado de entrenamiento actualizado' });
        } catch (error) {
            logger.error('Controller setEntrenamiento error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar estado de entrenamiento' });
        }
    },

    getDocumentosMuestreador: async (req, res) => {
        try {
            const result = await adminService.getDocumentosMuestreador(req.params.id);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getDocumentosMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener documentos' });
        }
    },

    addDocumentoMuestreador: async (req, res) => {
        try {
            const { id } = req.params;
            if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió archivo' });
            const ruta_archivo = `/uploads/muestreadores/${req.file.filename}`;
            const nombre_documento = req.body.nombre_documento || req.file.originalname;
            const result = await adminService.addDocumentoMuestreador(id, {
                nombre_documento,
                descripcion: req.body.descripcion,
                ruta_archivo,
                id_usuario_subida: req.user ? (req.user.id_usuario || req.user.id) : null
            });
            res.json({ success: true, data: { ...result, ruta_archivo, nombre_documento }, message: 'Documento agregado' });
        } catch (error) {
            logger.error('Controller addDocumentoMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al subir documento' });
        }
    },

    deleteDocumentoMuestreador: async (req, res) => {
        try {
            await adminService.deleteDocumentoMuestreador(req.params.idDoc);
            res.json({ success: true, message: 'Documento eliminado' });
        } catch (error) {
            logger.error('Controller deleteDocumentoMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al eliminar documento' });
        }
    },
```

- [ ] **Step 2: Add a multer instance for sampler docs in `admin.routes.js`**

At the top of `admin.routes.js` (after existing imports), add:

```js
import multer from 'multer';
import fs from 'fs';
import path from 'path';

const muestreadorDocsDir = path.join(process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads'), 'muestreadores');
const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        fs.mkdirSync(muestreadorDocsDir, { recursive: true });
        cb(null, muestreadorDocsDir);
    },
    filename: (req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `doc-${unique}${path.extname(file.originalname)}`);
    }
});
const uploadDoc = multer({ storage: docStorage, limits: { fileSize: 20 * 1024 * 1024 } });
```

- [ ] **Step 3: Register the routes**

In `admin.routes.js`, add these AFTER the existing `/muestreadores/:id/...` routes (so `:id` patterns are grouped) and BEFORE `export default router`:

```js
// --- ENTRENAMIENTO & DOCUMENTOS ---
router.patch('/muestreadores/:id/entrenamiento', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.setEntrenamiento);
router.get('/muestreadores/:id/documentos', verifyToken, verifyPermission(['MA_MUESTREADORES', 'MA_A_GEST_EQUIPO']), adminController.getDocumentosMuestreador);
router.post('/muestreadores/:id/documentos', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), uploadDoc.single('archivo'), adminController.addDocumentoMuestreador);
router.delete('/muestreadores/documentos/:idDoc', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.deleteDocumentoMuestreador);
```

- [ ] **Step 4: Confirm `/uploads/muestreadores` is statically served**

`server.js` already serves `app.use('/uploads', express.static(UPLOAD_PATH))`. Since docs are written under `<UPLOAD_PATH>/muestreadores/`, they resolve at `/uploads/muestreadores/<file>`. No change needed — verify by reading `server.js:221-222`.

- [ ] **Step 5: Syntax check**

From `api-backend-adlone/`: `node --check src/controllers/admin.controller.js && node --check src/routes/admin.routes.js`
Expected: no output.

- [ ] **Step 6: Runtime smoke check**

Start backend: `npm run dev`. Confirm it boots with no errors (route registration valid). Stop after confirming startup log.

- [ ] **Step 7: Commit (when approved)**

```bash
git add api-backend-adlone/src/controllers/admin.controller.js api-backend-adlone/src/routes/admin.routes.js
git commit -m "feat(muestreadores): endpoints for training status and documents"
```

---

### Task B3: Frontend service methods (entrenamiento + documentos)

**Files:**
- Modify: `frontend-adlone/src/services/admin.service.ts`

- [ ] **Step 1: Add methods to `adminService`**

Add (after `enableMuestreador`):

```ts
    setEntrenamiento: async (id: number, en_entrenamiento: 'S' | 'N') => {
        const response = await apiClient.patch(`/api/admin/muestreadores/${id}/entrenamiento`, { en_entrenamiento });
        return response.data;
    },
    getDocumentosMuestreador: async (id: number) => {
        const response = await apiClient.get(`/api/admin/muestreadores/${id}/documentos`);
        return response.data.data;
    },
    uploadDocumentoMuestreador: async (id: number, file: File, nombre_documento: string, descripcion?: string) => {
        const form = new FormData();
        form.append('archivo', file);
        form.append('nombre_documento', nombre_documento);
        if (descripcion) form.append('descripcion', descripcion);
        const response = await apiClient.post(`/api/admin/muestreadores/${id}/documentos`, form, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.data;
    },
    deleteDocumentoMuestreador: async (idDoc: number) => {
        const response = await apiClient.delete(`/api/admin/muestreadores/documentos/${idDoc}`);
        return response.data;
    },
```

- [ ] **Step 2: Typecheck**

From `frontend-adlone/`: `npx tsc -b --noEmit 2>&1 | grep -i "admin.service"`
Expected: empty.

---

### Task B4: MuestreadoresPage — "Entrenamiento" column + toggle

**Files:**
- Modify: `frontend-adlone/src/features/admin/pages/MuestreadoresPage.tsx`

- [ ] **Step 1: Import an icon for training**

Add `IconSchool` to the `@tabler/icons-react` import.

- [ ] **Step 2: Add a toggle handler**

Inside the component, near `confirmEnable` (~185), add:

```tsx
const handleToggleEntrenamiento = async (m: any) => {
    const nuevo = m.en_entrenamiento === 'S' ? 'N' : 'S';
    try {
        await adminService.setEntrenamiento(m.id_muestreador, nuevo);
        showToast({ type: 'success', message: nuevo === 'N' ? 'Marcado como Operativo' : 'Marcado En entrenamiento' });
        fetchData();
    } catch {
        showToast({ type: 'error', message: 'Error al actualizar estado de entrenamiento' });
    }
};
```

- [ ] **Step 3: Add the desktop table header**

In `<Table.Thead>` (~300), add after `<Table.Th>Estado</Table.Th>`:

```tsx
<Table.Th>Entrenamiento</Table.Th>
```

- [ ] **Step 4: Add the desktop cell**

In the desktop row (after the Estado `<Table.Td>`, ~339), add:

```tsx
<Table.Td>
    <Tooltip label={m.en_entrenamiento === 'S' ? 'En entrenamiento — clic para marcar Operativo' : 'Operativo — clic para marcar En entrenamiento'}>
        <Badge
            color={m.en_entrenamiento === 'S' ? 'yellow' : 'green'}
            variant="light"
            leftSection={<IconSchool size={10} />}
            style={{ cursor: 'pointer' }}
            onClick={() => handleToggleEntrenamiento(m)}
        >
            {m.en_entrenamiento === 'S' ? 'En entrenamiento' : 'Operativo'}
        </Badge>
    </Tooltip>
</Table.Td>
```

(Wrap the clickable toggle in `<ProtectedContent permission="AI_MA_EDITAR_MUESTREADOR">` if you want to hide it for read-only users; otherwise leave visible and let the API enforce.)

- [ ] **Step 5: Add to the mobile card**

In the mobile card (~430, near the Estado badge), add a second badge:

```tsx
<Badge color={m.en_entrenamiento === 'S' ? 'yellow' : 'green'} variant="light" size="sm" onClick={() => handleToggleEntrenamiento(m)} style={{ cursor: 'pointer' }}>
    {m.en_entrenamiento === 'S' ? 'En entrenamiento' : 'Operativo'}
</Badge>
```

- [ ] **Step 6: Typecheck**

From `frontend-adlone/`: `npx tsc -b --noEmit 2>&1 | grep -i "MuestreadoresPage"`
Expected: empty.

- [ ] **Step 7: Manual check**

`npm run dev`. The list shows the new column; clicking the badge toggles En entrenamiento ↔ Operativo and persists after refresh. Existing samplers show "Operativo".

- [ ] **Step 8: Commit (when approved)**

```bash
git add frontend-adlone/src/services/admin.service.ts frontend-adlone/src/features/admin/pages/MuestreadoresPage.tsx
git commit -m "feat(muestreadores): training status column with toggle"
```

---

### Task B5: MuestreadorForm — documents block (upload/list/delete)

**Files:**
- Modify: `frontend-adlone/src/features/admin/components/MuestreadorForm.tsx`

> **Read the file first** to match its props (it receives `initialData`, `onSave`, `onCancel`, `onViewRequests`, `pendingRequests`) and its layout/imports.

- [ ] **Step 1: Add documents state + load on mount (edit mode only)**

Add state and an effect. `initialData?.id_muestreador` identifies edit mode:

```tsx
const [documentos, setDocumentos] = useState<any[]>([]);
const [docFile, setDocFile] = useState<File | null>(null);
const [docNombre, setDocNombre] = useState('');
const [docDesc, setDocDesc] = useState('');
const [docUploading, setDocUploading] = useState(false);

useEffect(() => {
    const id = initialData?.id_muestreador;
    if (!id) return;
    adminService.getDocumentosMuestreador(id).then(setDocumentos).catch(() => {});
}, [initialData]);
```

- [ ] **Step 2: Add upload/delete handlers**

```tsx
const handleUploadDoc = async () => {
    const id = initialData?.id_muestreador;
    if (!id || !docFile) return;
    setDocUploading(true);
    try {
        await adminService.uploadDocumentoMuestreador(id, docFile, docNombre || docFile.name, docDesc);
        const list = await adminService.getDocumentosMuestreador(id);
        setDocumentos(list);
        setDocFile(null); setDocNombre(''); setDocDesc('');
        showToast({ type: 'success', message: 'Documento agregado' });
    } catch {
        showToast({ type: 'error', message: 'Error al subir documento' });
    } finally { setDocUploading(false); }
};

const handleDeleteDoc = async (idDoc: number) => {
    try {
        await adminService.deleteDocumentoMuestreador(idDoc);
        setDocumentos(prev => prev.filter(d => d.id_documento !== idDoc));
        showToast({ type: 'success', message: 'Documento eliminado' });
    } catch {
        showToast({ type: 'error', message: 'Error al eliminar documento' });
    }
};
```

(Use the form's existing toast/notification mechanism; if it uses `useToast`, import it as the page does. If the form has no toast, use Mantine `notifications` or pass errors up — match the file's existing pattern.)

- [ ] **Step 3: Render the documents section (edit mode only)**

Place inside the form layout, after the signature block. Uses Mantine `FileInput`, `TextInput`, `Button`, `Stack`, `Group`, `Anchor`, `ActionIcon`:

```tsx
{initialData?.id_muestreador && (
    <Paper withBorder p="md" radius="md" mt="md">
        <Text fw={700} size="sm" mb="xs">Documentos / Certificados</Text>
        <Text size="xs" c="dimmed" mb="sm">Adjunte respaldos de cursos o capacitaciones (disponible para cualquier muestreador).</Text>
        <Stack gap="xs" mb="sm">
            {documentos.length === 0 && <Text size="xs" c="dimmed">Sin documentos.</Text>}
            {documentos.map(d => (
                <Group key={d.id_documento} justify="space-between" wrap="nowrap">
                    <Anchor href={d.ruta_archivo} target="_blank" size="sm" truncate>{d.nombre_documento}</Anchor>
                    <ActionIcon color="red" variant="subtle" onClick={() => handleDeleteDoc(d.id_documento)}><IconTrash size={16} /></ActionIcon>
                </Group>
            ))}
        </Stack>
        <Group align="flex-end" gap="xs">
            <FileInput placeholder="Seleccionar archivo" value={docFile} onChange={setDocFile} accept="application/pdf,image/*" style={{ flex: 1 }} />
            <TextInput placeholder="Nombre/Título" value={docNombre} onChange={e => setDocNombre(e.currentTarget.value)} style={{ flex: 1 }} />
            <Button onClick={handleUploadDoc} loading={docUploading} disabled={!docFile}>Subir</Button>
        </Group>
    </Paper>
)}
```

Add any missing imports (`FileInput`, `Anchor`, `Paper`, `IconTrash`) to the file. If creating a NEW sampler (no `id`), the block is hidden; document upload becomes available after first save (edit).

- [ ] **Step 4: Typecheck**

From `frontend-adlone/`: `npx tsc -b --noEmit 2>&1 | grep -i "MuestreadorForm"`
Expected: empty.

- [ ] **Step 5: Manual check**

Edit a sampler → Documents section appears → upload a PDF → it lists with a working link (`/uploads/muestreadores/...`) → delete removes it.

- [ ] **Step 6: Commit (when approved)**

```bash
git add frontend-adlone/src/features/admin/components/MuestreadorForm.tsx
git commit -m "feat(muestreadores): attach/list/delete support documents in form"
```

---

# PHASE C — Competencias (maestro + N:N, soft delete)

> Migration 005 already created `mae_competencia`, `mae_muestreador_competencia` and seeded 11 competencies.

### Task C1: Backend service — competencias master + assignment

**Files:**
- Modify: `api-backend-adlone/src/services/admin.service.js`

- [ ] **Step 1: Add competency service methods**

Add to `adminService`:

```js
    // --- COMPETENCIAS (maestro) ---
    getCompetencias: async (incluirInactivas = false) => {
        const pool = await getConnection();
        const where = incluirInactivas ? '' : "WHERE activo = 'S'";
        const r = await pool.request().query(`
            SELECT id_competencia, nombre_competencia, descripcion, activo, orden
            FROM mae_competencia ${where}
            ORDER BY CASE WHEN orden IS NULL THEN 1 ELSE 0 END, orden, nombre_competencia
        `);
        return r.recordset;
    },

    createCompetencia: async ({ nombre_competencia, descripcion, orden }) => {
        const pool = await getConnection();
        // evitar duplicado de nombre activo
        const dup = await pool.request()
            .input('n', sql.NVarChar(200), nombre_competencia)
            .query("SELECT COUNT(*) c FROM mae_competencia WHERE activo='S' AND LOWER(LTRIM(RTRIM(nombre_competencia))) = LOWER(LTRIM(RTRIM(@n)))");
        if (dup.recordset[0].c > 0) { const e = new Error('Ya existe una competencia activa con ese nombre'); e.statusCode = 409; throw e; }
        const r = await pool.request()
            .input('n', sql.NVarChar(200), nombre_competencia)
            .input('d', sql.NVarChar(500), descripcion || null)
            .input('o', sql.Int, orden ?? null)
            .query(`INSERT INTO mae_competencia (nombre_competencia, descripcion, orden)
                    OUTPUT INSERTED.id_competencia VALUES (@n, @d, @o)`);
        return { id_competencia: r.recordset[0].id_competencia };
    },

    updateCompetencia: async (id, { nombre_competencia, descripcion, orden }) => {
        const pool = await getConnection();
        await pool.request()
            .input('id', sql.Int, Number(id))
            .input('n', sql.NVarChar(200), nombre_competencia)
            .input('d', sql.NVarChar(500), descripcion || null)
            .input('o', sql.Int, orden ?? null)
            .query(`UPDATE mae_competencia SET nombre_competencia=@n, descripcion=@d, orden=@o WHERE id_competencia=@id`);
        return { success: true };
    },

    // SOFT DELETE: marca inactiva, conserva asignaciones existentes
    deactivateCompetencia: async (id) => {
        const pool = await getConnection();
        const cnt = await pool.request()
            .input('id', sql.Int, Number(id))
            .query('SELECT COUNT(*) c FROM mae_muestreador_competencia WHERE id_competencia = @id');
        await pool.request()
            .input('id', sql.Int, Number(id))
            .query("UPDATE mae_competencia SET activo='N' WHERE id_competencia=@id");
        return { success: true, asignados: cnt.recordset[0].c };
    },

    reactivateCompetencia: async (id) => {
        const pool = await getConnection();
        await pool.request().input('id', sql.Int, Number(id))
            .query("UPDATE mae_competencia SET activo='S' WHERE id_competencia=@id");
        return { success: true };
    },

    // --- COMPETENCIAS por muestreador ---
    getCompetenciasMuestreador: async (id) => {
        const pool = await getConnection();
        const r = await pool.request()
            .input('id', sql.Numeric(10, 0), Number(id))
            .query(`SELECT c.id_competencia, c.nombre_competencia, c.activo, mc.fecha_asignacion
                    FROM mae_muestreador_competencia mc
                    JOIN mae_competencia c ON c.id_competencia = mc.id_competencia
                    WHERE mc.id_muestreador = @id
                    ORDER BY c.orden, c.nombre_competencia`);
        return r.recordset;
    },

    // Reemplaza SOLO las competencias ACTIVAS asignadas; nunca toca las inactivas ya asignadas
    setCompetenciasMuestreador: async (id, ids) => {
        const pool = await getConnection();
        const transaction = new sql.Transaction(pool);
        const wanted = (ids || []).map(Number).filter(Boolean);
        try {
            await transaction.begin();
            // 1) Borrar solo las asignaciones de competencias ACTIVAS (las inactivas se conservan)
            await new sql.Request(transaction)
                .input('id', sql.Numeric(10, 0), Number(id))
                .query(`DELETE mc FROM mae_muestreador_competencia mc
                        JOIN mae_competencia c ON c.id_competencia = mc.id_competencia
                        WHERE mc.id_muestreador = @id AND c.activo = 'S'`);
            // 2) Insertar las seleccionadas que sean ACTIVAS y no estén ya asignadas
            for (const cid of wanted) {
                await new sql.Request(transaction)
                    .input('id', sql.Numeric(10, 0), Number(id))
                    .input('c', sql.Int, cid)
                    .query(`INSERT INTO mae_muestreador_competencia (id_muestreador, id_competencia)
                            SELECT @id, @c
                            WHERE EXISTS (SELECT 1 FROM mae_competencia WHERE id_competencia=@c AND activo='S')
                              AND NOT EXISTS (SELECT 1 FROM mae_muestreador_competencia WHERE id_muestreador=@id AND id_competencia=@c)`);
            }
            await transaction.commit();
            return { success: true };
        } catch (e) {
            await transaction.rollback();
            throw e;
        }
    },
```

- [ ] **Step 2: Syntax check**

`node --check src/services/admin.service.js` → no output.

- [ ] **Step 3: Behavior check (temp script)**

Create `api-backend-adlone/tmp-verify-comp.js`:

```js
import dotenv from 'dotenv'; dotenv.config();
const { default: adminService } = await import('./src/services/admin.service.js');
const { closeConnection } = await import('./src/config/database.js');
const comps = await adminService.getCompetencias(false);
console.log('competencias activas:', comps.length, '| primera:', comps[0]?.nombre_competencia);
await closeConnection().catch(()=>{}); process.exit(0);
```

Run: `node tmp-verify-comp.js 2>&1 | grep -v "service.*adl-one-api" | grep -iv "DB Config\|Loading\|Connected"`
Expected: `competencias activas: 11 | primera: Muestreo y medición Agua Residual`. Delete temp file.

- [ ] **Step 4: Commit (when approved)**

```bash
git add api-backend-adlone/src/services/admin.service.js
git commit -m "feat(competencias): master CRUD (soft delete) + sampler assignment service"
```

---

### Task C2: Backend — controller + routes for competencias

**Files:**
- Modify: `api-backend-adlone/src/controllers/admin.controller.js`
- Modify: `api-backend-adlone/src/routes/admin.routes.js`

- [ ] **Step 1: Controller methods**

Add to `adminController`:

```js
    // --- COMPETENCIAS ---
    getCompetencias: async (req, res) => {
        try {
            const incluir = req.query.incluirInactivas === '1' || req.query.incluirInactivas === 'true';
            const result = await adminService.getCompetencias(incluir);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getCompetencias error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener competencias' });
        }
    },
    createCompetencia: async (req, res) => {
        try {
            const { nombre_competencia } = req.body;
            if (!nombre_competencia || !nombre_competencia.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
            const result = await adminService.createCompetencia(req.body);
            res.json({ success: true, data: result, message: 'Competencia creada' });
        } catch (error) {
            logger.error('Controller createCompetencia error:', error);
            res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Error al crear competencia' });
        }
    },
    updateCompetencia: async (req, res) => {
        try {
            await adminService.updateCompetencia(req.params.id, req.body);
            res.json({ success: true, message: 'Competencia actualizada' });
        } catch (error) {
            logger.error('Controller updateCompetencia error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar competencia' });
        }
    },
    deleteCompetencia: async (req, res) => {
        try {
            const result = await adminService.deactivateCompetencia(req.params.id);
            res.json({ success: true, data: result, message: `Competencia desactivada${result.asignados ? ` (la conservan ${result.asignados} muestreador(es))` : ''}` });
        } catch (error) {
            logger.error('Controller deleteCompetencia error:', error);
            res.status(500).json({ success: false, message: 'Error al desactivar competencia' });
        }
    },
    reactivateCompetencia: async (req, res) => {
        try {
            await adminService.reactivateCompetencia(req.params.id);
            res.json({ success: true, message: 'Competencia reactivada' });
        } catch (error) {
            logger.error('Controller reactivateCompetencia error:', error);
            res.status(500).json({ success: false, message: 'Error al reactivar competencia' });
        }
    },
    getCompetenciasMuestreador: async (req, res) => {
        try {
            const result = await adminService.getCompetenciasMuestreador(req.params.id);
            res.json({ success: true, data: result });
        } catch (error) {
            logger.error('Controller getCompetenciasMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al obtener competencias del muestreador' });
        }
    },
    setCompetenciasMuestreador: async (req, res) => {
        try {
            await adminService.setCompetenciasMuestreador(req.params.id, req.body.ids || []);
            res.json({ success: true, message: 'Competencias actualizadas' });
        } catch (error) {
            logger.error('Controller setCompetenciasMuestreador error:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar competencias del muestreador' });
        }
    },
```

- [ ] **Step 2: Routes**

Add to `admin.routes.js` before `export default router` (place the master `/competencias` routes and the per-sampler routes). Read permissions reuse existing ones:

```js
// --- COMPETENCIAS (maestro) ---
router.get('/competencias', verifyToken, verifyPermission(['MA_MUESTREADORES', 'MA_A_GEST_EQUIPO']), adminController.getCompetencias);
router.post('/competencias', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.createCompetencia);
router.put('/competencias/:id', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.updateCompetencia);
router.delete('/competencias/:id', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.deleteCompetencia);
router.put('/competencias/:id/reactivar', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.reactivateCompetencia);

// --- COMPETENCIAS por muestreador ---
router.get('/muestreadores/:id/competencias', verifyToken, verifyPermission(['MA_MUESTREADORES', 'MA_A_GEST_EQUIPO']), adminController.getCompetenciasMuestreador);
router.put('/muestreadores/:id/competencias', verifyToken, verifyPermission('AI_MA_EDITAR_MUESTREADOR'), adminController.setCompetenciasMuestreador);
```

> Route-order note: `/muestreadores/:id/competencias` must NOT shadow `/muestreadores/check-duplicate` etc. Since those are literal segments and `:id/competencias` has an extra segment, there is no conflict. Keep `/competencias` (master) separate from `/muestreadores/...`.

- [ ] **Step 3: Syntax check**

`node --check src/controllers/admin.controller.js && node --check src/routes/admin.routes.js` → no output.

- [ ] **Step 4: Runtime smoke + endpoint check**

Start `npm run dev`. With a valid token, `GET /api/admin/competencias` returns the 11 active competencies. (Or rely on the frontend in C4.)

- [ ] **Step 5: Commit (when approved)**

```bash
git add api-backend-adlone/src/controllers/admin.controller.js api-backend-adlone/src/routes/admin.routes.js
git commit -m "feat(competencias): controller + routes (master + per-sampler)"
```

---

### Task C3: Frontend service methods (competencias)

**Files:**
- Modify: `frontend-adlone/src/services/admin.service.ts`

- [ ] **Step 1: Add methods**

```ts
    getCompetencias: async (incluirInactivas = false) => {
        const response = await apiClient.get('/api/admin/competencias', { params: incluirInactivas ? { incluirInactivas: 1 } : {} });
        return response.data.data;
    },
    createCompetencia: async (data: { nombre_competencia: string; descripcion?: string; orden?: number }) => {
        const response = await apiClient.post('/api/admin/competencias', data);
        return response.data;
    },
    updateCompetencia: async (id: number, data: { nombre_competencia: string; descripcion?: string; orden?: number }) => {
        const response = await apiClient.put(`/api/admin/competencias/${id}`, data);
        return response.data;
    },
    deleteCompetencia: async (id: number) => {
        const response = await apiClient.delete(`/api/admin/competencias/${id}`);
        return response.data;
    },
    reactivateCompetencia: async (id: number) => {
        const response = await apiClient.put(`/api/admin/competencias/${id}/reactivar`);
        return response.data;
    },
    getCompetenciasMuestreador: async (id: number) => {
        const response = await apiClient.get(`/api/admin/muestreadores/${id}/competencias`);
        return response.data.data;
    },
    setCompetenciasMuestreador: async (id: number, ids: number[]) => {
        const response = await apiClient.put(`/api/admin/muestreadores/${id}/competencias`, { ids });
        return response.data;
    },
```

- [ ] **Step 2: Typecheck** — `npx tsc -b --noEmit 2>&1 | grep -i "admin.service"` → empty.

---

### Task C4: MuestreadoresPage — "Competencias" master management modal

**Files:**
- Modify: `frontend-adlone/src/features/admin/pages/MuestreadoresPage.tsx`

- [ ] **Step 1: Imports & state**

Add `Modal` is already imported; add `Checkbox`, `Stack`, `TextInput` as needed (some already imported). Add icons `IconAward`, `IconTrash`, `IconPlus`, `IconRotateClockwise`. Add state:

```tsx
const [showCompetenciasModal, setShowCompetenciasModal] = useState(false);
const [competencias, setCompetencias] = useState<any[]>([]);
const [compLoading, setCompLoading] = useState(false);
const [nuevaCompNombre, setNuevaCompNombre] = useState('');
const [editandoComp, setEditandoComp] = useState<any | null>(null);

const loadCompetencias = async () => {
    setCompLoading(true);
    try { setCompetencias(await adminService.getCompetencias(true)); }
    catch { showToast({ type: 'error', message: 'Error al cargar competencias' }); }
    finally { setCompLoading(false); }
};
const handleOpenCompetencias = () => { setShowCompetenciasModal(true); loadCompetencias(); };
const handleSaveComp = async () => {
    if (!nuevaCompNombre.trim()) return;
    try {
        if (editandoComp) await adminService.updateCompetencia(editandoComp.id_competencia, { nombre_competencia: nuevaCompNombre.trim(), descripcion: editandoComp.descripcion, orden: editandoComp.orden });
        else await adminService.createCompetencia({ nombre_competencia: nuevaCompNombre.trim() });
        setNuevaCompNombre(''); setEditandoComp(null); loadCompetencias();
        showToast({ type: 'success', message: 'Competencia guardada' });
    } catch (e: any) { showToast({ type: 'error', message: e?.response?.data?.message || 'Error al guardar competencia' }); }
};
const handleDeactivateComp = async (c: any) => {
    try { const r = await adminService.deleteCompetencia(c.id_competencia); showToast({ type: 'success', message: r.message || 'Desactivada' }); loadCompetencias(); }
    catch { showToast({ type: 'error', message: 'Error al desactivar' }); }
};
const handleReactivateComp = async (c: any) => {
    try { await adminService.reactivateCompetencia(c.id_competencia); loadCompetencias(); }
    catch { showToast({ type: 'error', message: 'Error al reactivar' }); }
};
```

- [ ] **Step 2: Add the "Competencias" button**

In the `PageHeader` `rightSection` (~237), add before the "Nuevo" button (inside a `ProtectedContent permission="AI_MA_EDITAR_MUESTREADOR"`):

```tsx
<Button variant="light" color="grape" leftSection={<IconAward size={18} />} onClick={handleOpenCompetencias} radius="md" size={isMobile ? "xs" : "sm"}>
    Competencias
</Button>
```

- [ ] **Step 3: Add the management modal**

Add near the other modals (before the closing `</>` of the return, ~573):

```tsx
<Modal opened={showCompetenciasModal} onClose={() => { setShowCompetenciasModal(false); setEditandoComp(null); setNuevaCompNombre(''); }} title={<Text fw={600}>Maestro de Competencias</Text>} centered size="md">
    <MantineStack gap="md">
        <Paper withBorder p="sm" radius="md" bg="gray.0">
            <Text size="xs" fw={700} c="dimmed" mb="xs">{editandoComp ? 'EDITAR' : 'NUEVA COMPETENCIA'}</Text>
            <Group align="flex-end" gap="xs">
                <TextInput placeholder="Nombre de la competencia" value={nuevaCompNombre} onChange={e => setNuevaCompNombre(e.currentTarget.value)} style={{ flex: 1 }} />
                <Button onClick={handleSaveComp} disabled={!nuevaCompNombre.trim()} leftSection={<IconPlus size={14} />}>{editandoComp ? 'Guardar' : 'Crear'}</Button>
                {editandoComp && <Button variant="subtle" onClick={() => { setEditandoComp(null); setNuevaCompNombre(''); }}>Cancelar</Button>}
            </Group>
        </Paper>
        {compLoading ? <Text size="sm" c="dimmed">Cargando…</Text> : (
            <MantineStack gap="xs">
                {competencias.map(c => (
                    <Group key={c.id_competencia} justify="space-between" wrap="nowrap">
                        <Text size="sm" c={c.activo === 'S' ? undefined : 'dimmed'} fs={c.activo === 'S' ? undefined : 'italic'}>
                            {c.nombre_competencia} {c.activo !== 'S' && <Badge size="xs" color="gray" variant="light">inactiva</Badge>}
                        </Text>
                        <Group gap={4}>
                            <ActionIcon variant="subtle" color="blue" onClick={() => { setEditandoComp(c); setNuevaCompNombre(c.nombre_competencia); }}><IconEdit size={14} /></ActionIcon>
                            {c.activo === 'S'
                                ? <ActionIcon variant="subtle" color="red" onClick={() => handleDeactivateComp(c)}><IconTrash size={14} /></ActionIcon>
                                : <ActionIcon variant="subtle" color="green" onClick={() => handleReactivateComp(c)}><IconRotateClockwise size={14} /></ActionIcon>}
                        </Group>
                    </Group>
                ))}
            </MantineStack>
        )}
    </MantineStack>
</Modal>
```

- [ ] **Step 4: Typecheck** — `npx tsc -b --noEmit 2>&1 | grep -i "MuestreadoresPage"` → empty.

- [ ] **Step 5: Manual check** — "Competencias" button opens modal listing 11 active; create adds one; deactivate marks it `inactiva` (gray) and shows count if assigned; reactivate restores.

- [ ] **Step 6: Commit (when approved)**

```bash
git add frontend-adlone/src/services/admin.service.ts frontend-adlone/src/features/admin/pages/MuestreadoresPage.tsx
git commit -m "feat(competencias): master management modal in Muestreadores page"
```

---

### Task C5: MuestreadorForm — assign competencies (editable, inactive in gray)

**Files:**
- Modify: `frontend-adlone/src/features/admin/components/MuestreadorForm.tsx`

> Read the file first. Reuse the same toast/imports added in B5.

- [ ] **Step 1: State + load on mount**

```tsx
const [allCompetencias, setAllCompetencias] = useState<any[]>([]);     // activas (para asignar)
const [compAsignadas, setCompAsignadas] = useState<any[]>([]);          // asignadas actuales (incluye inactivas)
const [compSeleccionadas, setCompSeleccionadas] = useState<number[]>([]); // ids activas marcadas

useEffect(() => {
    adminService.getCompetencias(false).then(setAllCompetencias).catch(() => {});
    const id = initialData?.id_muestreador;
    if (id) {
        adminService.getCompetenciasMuestreador(id).then((rows: any[]) => {
            setCompAsignadas(rows);
            setCompSeleccionadas(rows.filter(r => r.activo === 'S').map(r => r.id_competencia));
        }).catch(() => {});
    }
}, [initialData]);
```

- [ ] **Step 2: Save handler (call on form save, edit mode)**

If the form has a single `handleSave`, after the sampler is saved/updated and an `id` is known, call:

```tsx
await adminService.setCompetenciasMuestreador(id, compSeleccionadas);
```

For NEW samplers: after `createMuestreador` returns the new `id_muestreador`, call `setCompetenciasMuestreador(newId, compSeleccionadas)`. Match the form's existing save flow (read it). If competency assignment must wait until the sampler exists, that's fine — assign right after creation in the same handler.

- [ ] **Step 3: Render the competencies block**

```tsx
<Paper withBorder p="md" radius="md" mt="md">
    <Text fw={700} size="sm" mb="xs">Competencias</Text>
    <Text size="xs" c="dimmed" mb="sm">Marque las competencias del muestreador. Se pueden agregar y quitar libremente.</Text>
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={4}>
        {allCompetencias.map(c => (
            <Checkbox
                key={c.id_competencia}
                label={c.nombre_competencia}
                checked={compSeleccionadas.includes(c.id_competencia)}
                onChange={(e) => {
                    const on = e.currentTarget.checked;
                    setCompSeleccionadas(prev => on ? [...prev, c.id_competencia] : prev.filter(x => x !== c.id_competencia));
                }}
            />
        ))}
    </SimpleGrid>
    {/* Inactivas ya asignadas: se muestran en gris, no editables */}
    {compAsignadas.filter(c => c.activo !== 'S').length > 0 && (
        <>
            <Text size="xs" fw={600} c="dimmed" mt="sm">Competencias inactivas (conservadas):</Text>
            <Group gap={4} mt={4}>
                {compAsignadas.filter(c => c.activo !== 'S').map(c => (
                    <Badge key={c.id_competencia} color="gray" variant="light">{c.nombre_competencia}</Badge>
                ))}
            </Group>
        </>
    )}
</Paper>
```

Add missing imports (`Checkbox`, `SimpleGrid`, `Badge`, `Group`, `Paper`, `Text`).

- [ ] **Step 4: Typecheck** — `npx tsc -b --noEmit 2>&1 | grep -i "MuestreadorForm"` → empty.

- [ ] **Step 5: Manual check** — Edit a sampler → check/uncheck competencies → save → reopen: selection persisted. Deactivate a competency that the sampler had (via the master modal) → reopen the form: it appears under "inactivas (conservadas)" in gray, not in the checkbox list.

- [ ] **Step 6: Commit (when approved)**

```bash
git add frontend-adlone/src/features/admin/components/MuestreadorForm.tsx
git commit -m "feat(competencias): assign competencies per sampler (editable, inactive preserved)"
```

---

## Final verification (whole feature)

- [ ] Backend boots: `cd api-backend-adlone && npm run dev` — no errors.
- [ ] Frontend builds: `cd frontend-adlone && npx tsc -b --noEmit` — no NEW errors in changed files.
- [ ] Routes: create a route with coords → list shows distance/time → detail shows it.
- [ ] Sampler: toggle En entrenamiento/Operativo persists; existing samplers = Operativo.
- [ ] Sampler docs: upload/list/delete works; link opens the file.
- [ ] Competencias: master create/deactivate(soft)/reactivate; assign per sampler; inactive assigned shown in gray and preserved on save.
- [ ] No temp `tmp-verify-*.js` scripts left in `api-backend-adlone/`.

## Self-review notes (done)

- **Spec coverage:** Feature 1 (A1–A4), Feature 2 training+docs (B1–B5), Feature 3 competencias (C1–C5) — all spec sections mapped.
- **Types consistent:** service method names match across backend/controller/routes/frontend (`setEntrenamiento`, `getDocumentosMuestreador`, `uploadDocumentoMuestreador`, `deleteDocumentoMuestreador`, `getCompetencias`, `createCompetencia`, `updateCompetencia`, `deleteCompetencia`(→deactivate), `reactivateCompetencia`, `getCompetenciasMuestreador`, `setCompetenciasMuestreador`).
- **Soft-delete rule:** `setCompetenciasMuestreador` deletes only ACTIVE assignments and never removes inactive ones — matches spec.
- **No new permissions:** reuses `AI_MA_EDITAR_MUESTREADOR` + read perms.
