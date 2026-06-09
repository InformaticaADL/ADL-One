# Diseño: Distancia/Tiempo en Rutas + Entrenamiento y Competencias de Muestreadores

**Fecha:** 2026-06-02
**Estado:** Aprobado (decisiones confirmadas con el usuario)

## Resumen

Tres funcionalidades **independientes**, agrupadas en un solo spec y a implementar en orden:

1. **Rutas** — guardar y mostrar el tiempo en vehículo y los km (distancia) calculados por OSRM al guardar una ruta.
2. **Muestreadores · Entrenamiento** — estado "En entrenamiento / Operativo" + adjuntar varios documentos (certificados de cursos).
3. **Muestreadores · Competencias** — maestro de competencias + relación N:N con muestreadores, con soft delete.

Los scripts de base de datos (migraciones 003, 004, 005) **ya fueron ejecutados** por el usuario.

## Decisiones de diseño (confirmadas)

- **Permisos:** se reutilizan los existentes (`AI_MA_EDITAR_MUESTREADOR`, `AI_MA_CREAR_NUEVO_MUESTREADOR`, `MA_RUTA_*`). No se crean permisos nuevos.
- **Entrenamiento:** flag `en_entrenamiento` (S/N) + varios documentos por muestreador. Los muestreadores existentes quedan Operativo ('N'); los nuevos entran En entrenamiento ('S').
- **Competencias:** maestro + N:N. **Soft delete**: desactivar (`activo='N'`) en vez de borrar. Una competencia desactivada **permanece** en los muestreadores que ya la tenían, mostrada en **otro color (gris/inactiva)**, y **no** se ofrece para nuevas asignaciones.
- **Gestión de competencias:** sección propia en la página de Muestreadores (modal); asignación dentro del formulario del muestreador.
- **Rutas distancia/tiempo:** valor **automático (OSRM), total de la ruta, solo lectura**. Se recalcula al cambiar puntos/orden. Se muestra en el **modal de detalle y como columna en la lista**.
- **Backend muestreadores:** los campos nuevos se manejan con **endpoints y queries separados**, sin alterar los SP existentes (`MAM_Admin_Muestreador_Create/Update`).
- **Documentos:** se guardan en `<UPLOAD_PATH>/muestreadores/` (mismo root que `express.static('/uploads')`), creado con `mkdirSync({recursive:true})`. En BD se guarda la ruta relativa `/uploads/muestreadores/<archivo>`.

---

## Feature 1 — Rutas: distancia y tiempo

### Datos (migración 003, ejecutada)
`mae_rutas_planificadas` + `distancia_metros INT NULL`, `duracion_segundos INT NULL`.

### Frontend
- `RouteMapPlannerView.tsx`: el `useEffect` de OSRM ya obtiene `data.routes[0]`. Además de la geometría, capturar `data.routes[0].distance` (m) y `.duration` (s) en estado (`routeDistance`, `routeDuration`). Reset a `null` cuando hay <2 puntos.
- Incluir `distancia_metros` y `duracion_segundos` en el payload de `create` y `update`.
- `rutasPlanificadas.service.ts`: agregar los dos campos a los tipos de `create`/`update` y a la interfaz `RutaPlanificada`.

### Backend (`rutas-planificadas.service.js`)
- `create` y `update`: INSERT/UPDATE incluyen las dos columnas nuevas (con `sql.Int`, null si no vienen).
- `getAll` y `getById`: devolver `distancia_metros` y `duracion_segundos`.

### Visualización (`RutasListView.tsx`)
- Helper de formato: `formatDistancia(m)` → "124 km" (o "850 m"); `formatDuracion(s)` → "2 h 15 min".
- **Columna nueva** en la tabla de la lista (ej. "Vehículo": `124 km · 2 h 15 min`, "—" si null).
- En el **modal de detalle**: mostrar el dato en la cabecera junto al resto de info.

---

## Feature 2 — Entrenamiento del muestreador

### Datos (migración 004, ejecutada)
- `mae_muestreador.en_entrenamiento CHAR(1) DEFAULT 'S'`. Existentes = 'N'.
- `mae_muestreador_documento (id_documento, id_muestreador, nombre_documento, descripcion, ruta_archivo, fecha_subida, id_usuario_subida)`.

### Backend (`admin.service.js` / `admin.controller.js` / `admin.routes.js`)
Endpoints nuevos bajo `/api/admin` (auth + permiso `AI_MA_EDITAR_MUESTREADOR`):
- `PATCH /muestreadores/:id/entrenamiento` — body `{ en_entrenamiento: 'S'|'N' }` → `UPDATE mae_muestreador`.
- `GET /muestreadores/:id/documentos` — lista documentos del muestreador.
- `POST /muestreadores/:id/documentos` — sube archivo (multer a `<UPLOAD_PATH>/muestreadores/`) + body `{ nombre_documento, descripcion? }`; inserta fila con la ruta relativa.
- `DELETE /muestreadores/documentos/:idDoc` — elimina el registro (y opcionalmente el archivo en disco).
- `getMuestreadores`: incluir `en_entrenamiento` en el SELECT.

Multer: nueva config de `diskStorage` con destination `path.join(UPLOAD_PATH, 'muestreadores')`, creando el dir con `fs.mkdirSync({recursive:true})`.

### Frontend
- `MuestreadoresPage.tsx`: **columna "Entrenamiento"** con badge (🟡 "En entrenamiento" / 🟢 "Operativo") y acción para alternar. Tarjeta móvil con el mismo dato.
- `MuestreadorForm.tsx`: bloque "Estado de entrenamiento" con switch En entrenamiento/Operativo, y un sub-bloque "Documentos / Certificados" para **subir, listar y eliminar** varios archivos. Marcar Operativo **no exige** documento (opcional, se sugiere).
  - **Los documentos están disponibles para CUALQUIER muestreador**, esté en entrenamiento u Operativo (incluidos los muestreadores actuales ya operativos). No están condicionados al estado de entrenamiento: un muestreador operativo puede adjuntar respaldos de cursos que haga en el futuro.
- `admin.service.ts` (frontend): métodos `setEntrenamiento`, `getDocumentos`, `uploadDocumento`, `deleteDocumento`.

---

## Feature 3 — Competencias

### Datos (migración 005, ejecutada)
- `mae_competencia (id_competencia, nombre_competencia, descripcion, activo CHAR(1) DEFAULT 'S', orden)`. Sembradas las 11 competencias técnicas.
- `mae_muestreador_competencia (id_muestreador, id_competencia, fecha_asignacion)` con PK compuesta.

### Backend (`admin.service.js` / controller / routes)
Maestro de competencias (`/api/admin/competencias`):
- `GET /competencias?incluirInactivas=0|1` — lista; por defecto solo activas, ordenadas por `orden`.
- `POST /competencias` — `{ nombre_competencia, descripcion?, orden? }`.
- `PUT /competencias/:id` — editar nombre/descr/orden.
- `DELETE /competencias/:id` — **soft delete** → `UPDATE mae_competencia SET activo='N'`. No borra filas de la relación.

Asignación por muestreador:
- `GET /muestreadores/:id/competencias` — devuelve las competencias asignadas, cada una con su `activo` (para pintar las inactivas en gris).
- `PUT /muestreadores/:id/competencias` — `{ ids: number[] }` reemplaza el conjunto. **Regla:** solo se permiten **asignar/quitar competencias activas**; las inactivas ya asignadas se **conservan siempre** (no se tocan al guardar, aunque no vengan en `ids`).

### Frontend
- `MuestreadoresPage.tsx`: botón **"Competencias"** (junto a "Nuevo") → modal de gestión del maestro: lista con activas/inactivas, crear, editar, desactivar (con confirmación que avisa cuántos muestreadores la tienen). Las inactivas se muestran en gris con opción "reactivar".
- `MuestreadorForm.tsx`: bloque "Competencias" con checkboxes/multiselect de competencias **activas**, **totalmente editable**: se pueden **agregar y quitar** competencias activas libremente (una o varias). Las ya asignadas se ven como chips; una asignada **desactivada** aparece como chip **gris ("inactiva")**, no editable, y se conserva al guardar.
- Vista de lista/detalle del muestreador: badges de competencias (activas en color, inactivas en gris).
- `admin.service.ts` (frontend): `getCompetencias`, `createCompetencia`, `updateCompetencia`, `deleteCompetencia`, `getCompetenciasMuestreador`, `setCompetenciasMuestreador`.

### Validaciones clave
- Eliminar competencia en uso → soft delete; permanece en los muestreadores (en gris); fuera de nuevas asignaciones.
- `PUT competencias` del muestreador nunca elimina asignaciones de competencias inactivas.
- Nombre de competencia no vacío; evitar duplicados de nombre activo (validación en backend).

---

## Componentes / archivos afectados

**Frontend**
- `features/medio-ambiente/components/RouteMapPlannerView.tsx` (captura OSRM + payload)
- `features/medio-ambiente/components/RutasListView.tsx` (columna + detalle)
- `features/medio-ambiente/services/rutasPlanificadas.service.ts` (tipos)
- `features/admin/pages/MuestreadoresPage.tsx` (columna entrenamiento, botón competencias)
- `features/admin/components/MuestreadorForm.tsx` (entrenamiento, documentos, competencias)
- `services/admin.service.ts` (métodos nuevos)
- (posible) nuevo componente modal de gestión de competencias

**Backend**
- `services/rutas-planificadas.service.js`
- `services/admin.service.js`
- `controllers/admin.controller.js`
- `routes/admin.routes.js`
- (config multer para documentos)

## Fuera de alcance (YAGNI)
- Historial estructurado de capacitaciones (se eligió flag + documentos).
- Distancia/tiempo por tramo (solo total).
- Edición manual de distancia/tiempo (solo lectura, auto).
- Permisos nuevos.
- Filtrar/asignar rutas por competencia del muestreador (futuro posible, no ahora).
