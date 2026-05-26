# 📋 Checklist QA — Validación de Fixes ADL ONE

> Lista de pruebas para verificar los arreglos implementados en las Fases 1–6.
> Marcar cada ítem con ✅ (pasa) / ❌ (no pasa) / ⏸️ (bloqueado / falta requisito).

**Antes de empezar**:
1. ⬜ SQL ejecutado: `db-migrations/phase5-auth-tables.sql`
2. ⬜ Variable de entorno agregada al backend: `FRONTEND_URL=http://localhost:5173`
3. ⬜ Backend reiniciado (`npm run dev` en `api-backend-adlone/`)
4. ⬜ Frontend corriendo (`npm run dev` en `frontend-adlone/`)
5. ⬜ Verificar que los emails SMTP funcionan (probar con un envío real desde el sistema)

---

## 🔴 FASE 1 — Bugs críticos

### Crashes Mantine Select
- [ ] **MA-05**: Entrar al maestro **EMPRESA DE SERVICIO** (que tiene muchos registros) — no debe crashear con "Cannot read properties of null (reading 'toLowerCase')".
- [ ] **RB-03**: En Gestión de Usuarios, cambiar el rol de un usuario — no debe crashear.
- [ ] Forzar prueba: insertar manualmente en BD un registro de empresa con `nombre = NULL` y verificar que el dropdown sigue funcionando (muestra "(sin nombre)").

### Asignación / Fechas
- [ ] **A-07**: En Asignación de Recursos, intentar guardar con fecha de instalación **posterior** a fecha de retiro → toast de error nombrando los correlativos. No se guarda.
- [ ] **A-07** (input): El input de F. Instalación tiene `max` igual al retiro; F. Retiro tiene `min` igual a la instalación → el navegador bloquea selecciones inválidas.
- [ ] **A-02**: Intentar elegir una fecha **anterior a hoy** en F. Instalación o F. Retiro → el navegador no la permite. Si se manipula el DOM, el servidor rechaza con toast.
- [ ] **C-07** (calendario): Al reagendar desde calendario, no permite elegir fecha pasada.

### Listas de asignación / rutas
- [ ] **A-01**: Lista de asignación NO muestra fichas en estado **PENDIENTE ÁREA COORDINACIÓN** (id_validaciontecnica = 1).
- [ ] **A-01**: Fichas EN PROCESO (5) sin servicios disponibles **NO aparecen** en la lista (ya están todas asignadas).
- [ ] **R-11**: Planificador de rutas — fichas en PENDIENTE COORDINACIÓN tampoco aparecen.

### Bug del servicio incorrecto al asignar ruta
- [ ] **A-09**: En el planificador, seleccionar una ficha, cambiar el correlativo a "Servicio 2" desde el dropdown, guardar → verificar en BD/UI que se guardó el **Servicio 2**, no otro.
- [ ] **A-09 edge**: Si entre selección y guardado el servicio cambia a AGENDADO/EJECUTADO/CANCELADO, debe omitirse con toast (no guardar silenciosamente otro).

### Permiso de comparación de versiones (remuestreo)
- [ ] **A-09 (403)**: Como usuario con `FI_GEST_ASIG` pero SIN `MA_A_GEST_EQUIPO`, abrir asignación de una ficha de remuestreo y hacer clic en "Ver Versiones" → debe abrir el modal de comparación (antes daba 403).

### Calendario
- [ ] **C-04**: Abrir una ficha **ya cancelada** en el calendario → el botón "Cancelar Muestreo" NO aparece.
- [ ] **C-05**: Abrir una ficha **ya ejecutada** (con `realizado_por_gem` o estado REALIZADO) → tampoco aparece "Cancelar Muestreo". Si se manipula el frontend para llamarlo, el backend rechaza con error.
- [ ] **C-06**: Cambiar el muestreador de un evento tipo INICIO, guardar, reabrir el mismo evento → el select muestra el muestreador nuevo (no el de retiro anterior).
- [ ] Para evento tipo RETIRO, el select debe mostrar el muestreador de retiro (`id_muestreador2`).

---

## 🟡 FASE 2 — Fichas (creación / edición / vista)

### F-01a Redirección post-creación
- [ ] Crear una ficha y cerrar el modal de éxito con "Volver al Menú" → debe llevar al **Listado de Fichas** (no al selector Manual/Bulk).
- [ ] El botón "Ver Ficha" sigue funcionando: lleva al detalle de la ficha recién creada.

### F-01b Normativa / Tabla por análisis
- [ ] Al grabar análisis con normativa A y referencia X, luego cambiar a normativa B y referencia Y, grabar otro grupo → la tabla "Análisis Grabados" muestra una **columna "Normativa"** y otra **"Tabla / Referencia"** con valores diferentes por línea.
- [ ] Verificar en BD: cada fila de `App_Ma_FichaIngresoServicio_DET` tiene su `id_normativa` y `id_normativareferencia` correctos (no todos idénticos).

### F-01c+d Placeholders y validación año
- [ ] Campo "Número Instrumento": cuando el instrumento NO es "Otro", solo permite dígitos. Placeholder dice "Solo número (ej: 123)".
- [ ] Campo "Número Instrumento": cuando el instrumento ES "Otro", permite texto libre. Placeholder dice "Texto libre".
- [ ] Campo "Año Instrumento": solo dígitos, máximo 4. Si está fuera del rango 1900–año actual+1, muestra error inline "Año inválido".

### F-01e "No Aplica" hardcoded eliminado
- [ ] Verificar selects de: Cliente, Empresa Servicio, Fuente Emisora, Objetivo, Cargo, Componente, Sub-Área, Inspector, Tipo Muestreo, Tipo Muestra, Actividad, Tipo Descarga, Modalidad, Forma Canal, Dispositivo, Contacto, Responsable → ninguno tiene "No Aplica" como primera opción.
- [ ] Medición Caudal SÍ conserva "No Aplica" (es opcional y legítimo).
- [ ] Instrumento Ambiental SÍ tiene "No aplica" (viene del maestro DB, no hardcoded).

### F-01f Instrumento ambiental graba bien
- [ ] Seleccionar "Otro" en Instrumento Ambiental, escribir "Resolución SISS 2122" en Número, "2023" en Año, guardar → BD guarda solo el texto del Número (no "Otro Otro …").
- [ ] Seleccionar "Res Siss" sin número ni año → BD guarda "Res Siss" sin el "/" colgante.
- [ ] Seleccionar "DS 90" con número "123" y año "2024" → BD guarda "DS 90 123/2024".

### F-01g Hora línea de tiempo correcta
- [ ] Crear una ficha a una hora conocida (ej: 15:30 hora Chile) → ver el detalle de la ficha → la línea de tiempo muestra la hora correcta (no -4h).
- [ ] Verificar en BD `mae_ficha_historial`: la columna `fecha` debe tener la hora local de Chile.

### F-11 Tabs no permiten saltar sin validar
- [ ] En el formulario de creación, sin completar Antecedentes, **clic directo en la pestaña "Análisis"** → toast de error y no cambia de tab.
- [ ] Sin grabar al menos un análisis, **clic directo en "Observaciones"** → toast de error.
- [ ] El botón "Siguiente" sigue funcionando con la misma validación.

### F-15 "No aplica" Instrumento Ambiental limpia campos
- [ ] Llenar Número + Año, luego cambiar el select a "No aplica" → los campos Número y Año quedan **vacíos y deshabilitados**.
- [ ] Cambiar de vuelta a otro instrumento → los campos quedan editables nuevamente.

### F-16 Duración solo enteros
- [ ] En el campo "Duración (Hrs)", intentar escribir un punto, una coma, "e", "+", "-" → no se permite.
- [ ] Pegar "1.5" → solo guarda "15" (filtra el punto). Pegar "horas" → no se acepta nada.

### F-35 Edición con campos prellenados
- [ ] Abrir una ficha existente con datos completos (con ubicación, comuna, región, código centro, ETFA) → en edición, todos los campos aparecen con su valor.
- [ ] No deben aparecer campos vacíos que sí se ven en la vista de solo lectura.

### F-36 Sin lag al escribir observaciones en edición
- [ ] Entrar en edición de una ficha grande (muchos análisis) → tipear rápido en "Nueva Observación Comercial" → no debe haber lag perceptible.
- [ ] Repetir para los textareas de Técnica y Coordinación.

### F-37 Guardar sin observación
- [ ] Abrir edición de una ficha, no cambiar nada, no escribir observación → clic en "Guardar Cambios" → debe guardar sin error con observación por defecto "Edición sin observaciones adicionales".

### F-24/F-25 Vista de ficha con Google Maps
- [ ] Abrir una ficha que tiene `referencia_googlemaps` con coordenadas válidas → en pestaña Antecedentes, al final, sección **"Ubicación"** muestra:
  - Link clickeable con botón "Abrir en Google Maps"
  - Mapa embebido (OpenStreetMap) centrado en las coordenadas
  - Texto con las coordenadas debajo
- [ ] Para ficha CON link pero SIN coordenadas resueltas → muestra el link + mensaje "Coordenadas no resueltas — verifique el link".
- [ ] Para ficha sin nada → la sección no aparece.

### F-34/M-04 Ficha de remuestreo referencia original
- [ ] Crear o abrir una ficha que sea remuestreo (`es_remuestreo='S'` y `id_ficha_original` con valor) → arriba aparece un `WorkflowAlert` azul: *"Ficha de Remuestreo — Original: N° X"* con el mensaje de verificar equipos.
- [ ] El título de la página también incluye "(REMUESTREO DE LA FICHA N° X)".

### F-40 Auditoría completa
- [ ] Crear una ficha nueva → ver historial en pestaña "Validación e Historial" → debe aparecer el evento "FICHA CREADA" con la hora local correcta y el usuario.
- [ ] Asignar fechas/muestreadores a esa ficha → ver historial → aparece "Asignación Masiva" con hora correcta.
- [ ] Aprobar/Rechazar técnica → aparece en historial.

---

## 🟠 FASE 3 — Rutas / Calendario / Asignación

### R-05 Nombres de grupo duplicados
- [ ] Crear un grupo "Mantención" → exitoso.
- [ ] Crear otro grupo "Mantención" (mismo nombre, mismo case) → error 409 con mensaje "Ya existe un grupo con ese nombre".
- [ ] Crear otro "MANTENCIÓN" (case distinto) → también error (la validación es case-insensitive).
- [ ] Editar el nombre de un grupo existente a uno que ya existe → mismo error.

### R-08 Rutas "Sin grupo" con botón mover
- [ ] Eliminar un grupo que tenía rutas → sus rutas quedan en "Sin grupo".
- [ ] Header del grupo "Sin grupo" ahora muestra un botón **"Asignar a grupo"** (si hay 1 ruta) o **"N sin grupo — asignar"** (si hay varias).
- [ ] Con 1 ruta → al hacer clic abre el modal de "Cambiar grupo" para esa ruta.
- [ ] Con varias → muestra mensaje indicando usar el botón de carpeta por fila.

### C-09 Filtro de calendario por correlativo
- [ ] En el filtro avanzado del calendario, el placeholder ahora dice "N° ficha, correlativo, empresa, muestreador..."
- [ ] Buscar por número de ficha → filtra correctamente.
- [ ] Buscar por correlativo (parte del string) → filtra correctamente.

### C-01 Fichas con asignación parcial en calendario
- [ ] Crear una ficha con varios servicios, asignar fecha de retiro a uno solo (sin fecha de muestreo) → la ficha debe aparecer en el calendario en el mes del retiro.
- [ ] Una ficha en EN PROCESO con asignación normal sigue apareciendo correctamente.

### A-05/A-06 Guardado parcial de asignación
- [ ] En Asignación de Recursos, para una fila ingresar **solo fecha** (sin muestreador) → permite guardar. Al recargar la ficha, la fecha se guardó y el muestreador conserva su valor anterior (o null si no había).
- [ ] Para otra fila ingresar **solo muestreador** (sin fecha) → permite guardar. La fecha conserva su valor anterior.
- [ ] Si no se ingresa ni fecha ni muestreador en NINGUNA fila → toast de aviso "Debe ingresar al menos una fecha o un muestreador…".

### M-06 PDF de muestreo con datos de ejecución
- [ ] Marcar un muestreo como ejecutado (con totalizadores, fechas reales, "realizado por GEM") → descargar PDF.
- [ ] El PDF tiene una sección nueva **"Datos de Ejecución del Muestreo"** con tabla: Correlativo, Inst. Real, Retiro Real (con timestamps), Totalizador Inicio, Totalizador Final, Ejecutado por.
- [ ] Si ningún muestreo está ejecutado, la sección no aparece (solo se ve la tabla de asignación normal).

### R-09 Historial de ejecuciones de rutas
- [ ] En el listado de Rutas Planificadas, en una ruta ya ejecutada, hacer clic en el icono de "Historial de ejecuciones" → se abre modal con las ejecuciones registradas (fecha, muestreadores, fichas).
- [ ] Si nunca se ejecutó → modal muestra "Sin ejecuciones registradas".

### R-03 Sin parpadeo de línea recta en planificador
- [ ] Seleccionar 3-4 fichas en el planificador de rutas → la polyline solo aparece DESPUÉS de que OSRM responda (no se ve línea recta intermedia).
- [ ] Cambiar el orden o agregar/quitar fichas → no se ve línea recta de transición.

---

## 🟣 FASE 4 — Equipos / Muestreadores

### E-01 Botón "Guardar Todo"
- [ ] Crear un equipo nuevo: completar formulario → clic en "Siguiente" → pasa al step "Bulk Check".
- [ ] En step 1 (Bulk Check), clic en "Guardar Todo" → ahora abre el modal de confirmación de guardado y luego guarda los equipos.
- [ ] Editar un equipo existente: clic en "Actualizar" → abre directo el modal de confirmación.

### E-01 Equipo Asociado muestra nombres
- [ ] En el formulario de equipo, el dropdown "Equipo Asociado" muestra `CÓDIGO - Nombre` (no IDs crudos como "1", "2", "3").
- [ ] Es searchable y permite filtrar por código o nombre.
- [ ] Tiene "No Aplica" como primera opción.

### MS-05 Clave opcional en edición
- [ ] Editar un muestreador existente → el campo de Clave aparece como **"Clave de Acceso (opcional)"** con placeholder "Dejar vacío para conservar la actual" y NO es required.
- [ ] Guardar sin escribir nada en clave → la clave actual se conserva (verificar logueándose con la clave anterior).
- [ ] Escribir una clave nueva → al guardar, la clave cambia.

### MS-06 Firma solo imágenes
- [ ] En edición de muestreador, intentar subir un PDF como firma (cambiando el filtro del FileButton) → toast de error "La firma debe ser una imagen PNG o JPG".
- [ ] Subir un PNG o JPG válido → carga sin problema.

### MS-07 Firma con límite de tamaño
- [ ] Subir una imagen mayor a 2 MB → toast de error nombrando el tamaño real y el máximo permitido.
- [ ] Subir una imagen pequeña → carga normal.

### MS-04 Advertencia al deshabilitar muestreador con asignaciones futuras
- [ ] Asignar a un muestreador uno o más muestreos con fecha futura.
- [ ] Abrir el modal de "Deshabilitar Muestreador" → debe mostrar Alert rojo "Asignaciones de muestreo pendientes" con el conteo y hasta 5 ejemplos (Ficha #X — correlativo — rol — fecha).
- [ ] Si el muestreador no tiene asignaciones futuras → el Alert no aparece.

### MS-01/02 Crear muestreador
- [ ] Como admin con permiso `AI_MA_CREAR_NEW_MUESTREADOR` → ver botón "Nuevo Muestreador" en MuestreadoresPage.
- [ ] Sin el permiso → el botón no aparece (esto es correcto).
- [ ] Crear muestreador con nombre/correo ya existente → muestra advertencia de duplicado.

---

## 🔐 FASE 5 — Auth / Reset Password / RBAC

### S-01 Placeholder login
- [ ] LoginForm: el campo dice "Usuario" (no "Usuario / Email") con placeholder "ej: jperez".

### S-11 Trim de espacios
- [ ] Login: agregar espacios al inicio y final del usuario y contraseña → debe iniciar sesión correctamente.

### S-02 Login case-sensitive
- [ ] Login con contraseña en mayúscula cuando la guardada está en minúscula (o viceversa) → debe **fallar** con "Credenciales inválidas".
- [ ] El nombre de usuario sigue siendo case-insensitive (es UX estándar).

### S-03 Mensajes diferenciados
- [ ] Login con usuario que NO existe → mensaje "Usuario inexistente" (404).
- [ ] Login con usuario válido pero contraseña incorrecta → "Credenciales inválidas" (401).
- [ ] Login con usuario deshabilitado → "Usuario deshabilitado" (403).

### S-13 Bloqueo por intentos fallidos
- [ ] Fallar el login 5 veces con un mismo usuario → al 6to intento (o incluso al recargar antes de los 15 min), error "Demasiados intentos fallidos. Inténtelo nuevamente en N minuto(s)." (423).
- [ ] Login exitoso → el contador se resetea (se puede confirmar haciendo un login exitoso y luego fallar de nuevo).
- [ ] Verificar en BD: tabla `mae_login_attempts` tiene un registro por nombre de usuario, con `failed_count` y `locked_until` poblados.

### S-07 JWT expirado / Sesión inválida
- [ ] Iniciar sesión con un usuario, copiar el JWT. Manualmente expirarlo (esperar la expiración: 12h normal, 30d con remember me) o forzar invalidación (deshabilitando el usuario desde otra sesión admin).
- [ ] Próxima petición → automáticamente desloguea y muestra mensaje "Tu sesión fue cerrada porque un administrador modificó tus permisos" en la LoginPage.

### S-14/15/16/17 Reset de contraseña por email

#### S-14 / S-15: Solicitar reset
- [ ] LoginForm: clic en "¿Olvidaste tu contraseña?" → abre modal nuevo (ya no muestra contactos).
- [ ] Ingresar email **registrado** → mensaje "Si el email está registrado, recibirá un correo con instrucciones."
- [ ] Ingresar email **no registrado** → mismo mensaje genérico (S-15: no revela existencia).
- [ ] Verificar que llegue el correo (revisar inbox o logs SMTP).

#### S-16: Validación de token
- [ ] Abrir el link del email → se abre la página de Reset (URL `/reset-password?token=...`).
- [ ] Si el token es válido → muestra el formulario con el nombre del usuario.
- [ ] Modificar manualmente el token en la URL → muestra "El link no es válido".
- [ ] Usar el mismo link dos veces → la segunda vez muestra "El link ya fue utilizado".
- [ ] Esperar a que el token expire (60 min) y volver a abrirlo → "El link ha expirado".

#### S-17: Solo el último token es válido
- [ ] Solicitar reset dos veces seguidas con el mismo email → el primer link queda inválido, solo el segundo funciona.

#### Aplicar nueva contraseña
- [ ] En la página de Reset, escribir nueva contraseña + confirmación → al enviar, mensaje de éxito y botón "Ir al login".
- [ ] Iniciar sesión con la nueva contraseña → éxito.
- [ ] Si el usuario tenía bloqueo por intentos fallidos, se limpia automáticamente.

### RB-01 Lag y overlay residual en Usuarios
- [ ] Abrir Gestión de Usuarios → la lista carga con LoadingOverlay.
- [ ] Abrir modal "Crear Nuevo Usuario" → **NO** se ve un overlay blanco residual detrás.
- [ ] Tipear en los campos del modal → sin lag.
- [ ] Tipear en el filtro de búsqueda de roles del modal → sin lag.

### RB-04 Cierre forzado al deshabilitar
- [ ] Usuario A inicia sesión y queda navegando.
- [ ] Admin B (en otra sesión / browser) deshabilita al Usuario A.
- [ ] La próxima petición que haga A → su sesión cae automáticamente con mensaje "Tu sesión fue cerrada porque un administrador modificó tus permisos".

### RB-07 Permisos sin recargar
- [ ] Usuario A inicia sesión, navega a una sección.
- [ ] Admin B quita un rol con permisos clave al Usuario A.
- [ ] La próxima petición de A → sesión cae con el mismo mensaje (es el mismo mecanismo de permisos_version).

### RB-08 AI_MA_ADMIN_ACCESO eliminado
- [ ] Verificar en BD que el rol/permiso `AI_MA_ADMIN_ACCESO` no existe (o si existe, ningún usuario lo tiene asignado).
- [ ] Un usuario sin permisos específicos NO debe poder hacer nada — el bypass ya no funciona.
- [ ] Backend (`verifyPermission.js`) y frontend (`AuthContext.hasPermission`) no hacen referencia al permiso.

### RB-09 Confirmación con cantidad de usuarios
- [ ] En la página de Roles, al deshabilitar/eliminar un rol → modal de confirmación muestra "N usuario(s) perderán sus permisos asociados y serán desconectados".
- [ ] Si el rol no tiene usuarios → mensaje genérico sin número.

---

## ⚪ FASE 6 — Polish UX

### MA-01 Maestros con validación de campos
- [ ] Entrar a cualquier maestro, abrir el formulario de creación con todos los campos vacíos → clic en Guardar → toast "Debe completar al menos un campo para guardar".
- [ ] Llenar todos los campos excepto el principal (display column) → toast "Faltan campos obligatorios: <nombre del campo>".

### MA-02/03 Advertencia al deshabilitar maestro
- [ ] En cualquier maestro, deshabilitar un registro → aparece confirm() del browser advirtiendo "si está en uso por fichas activas…".
- [ ] Cancelar → no se deshabilita.
- [ ] Aceptar → se deshabilita normalmente.

### N-04 Marcar todas como leídas
- [ ] Tener varias notificaciones no leídas (badge muestra el número).
- [ ] Clic en "Marcar todas como leídas" → badge baja a 0.
- [ ] Las notificaciones siguen en la lista pero ya no tienen el fondo azul (estilo de "no leída").

### CH-03 Iconos por tipo de archivo en chat
- [ ] Enviar como adjunto: PDF, Excel (xlsx), Word (docx), PowerPoint (pptx), ZIP, TXT.
- [ ] Cada uno debe aparecer con su icono y color específico (PDF rojo, Excel verde, Word azul, etc.) en lugar del icono genérico de archivo.

### CH-04 Tamaño máximo de adjuntos
- [ ] Intentar enviar un archivo > 25 MB → mensaje de error con el nombre y el límite.
- [ ] Enviar archivo dentro del límite → sube sin problema.

### X-10 Alerta de Socket.IO desconectado
- [ ] Estando logueado, parar el backend (Ctrl+C) → en pocos segundos aparece banner naranjo arriba del contenido: "Sin conexión en tiempo real — intentando reconectar...".
- [ ] Reiniciar el backend → el banner desaparece cuando el socket reconecta.

### X-08 Caracteres especiales escapados
- [ ] Crear un usuario con nombre `<script>alert('x')</script>` → al solicitar reset de contraseña a ese usuario, el email recibido renderiza el nombre como texto literal (no ejecuta el script).
- [ ] React UI siempre escapa automáticamente; verificar que ningún campo se muestre con HTML interpretado.

---

## 📊 Resumen final

| Fase | Total ítems | ✅ Pasa | ❌ Falla | ⏸️ Bloqueado |
|------|-------------|---------|----------|---------------|
| 1 — Crashes y críticos | 13 | | | |
| 2 — Fichas | 24 | | | |
| 3 — Rutas/Calendario/Asignación | 10 | | | |
| 4 — Equipos/Muestreadores | 8 | | | |
| 5 — Auth/Reset/RBAC | 21 | | | |
| 6 — Polish UX | 9 | | | |
| **TOTAL** | **85** | | | |

---

### 🐛 Espacio para hallazgos nuevos durante QA

| # | Sección | Descripción del problema | Severidad | Estado |
|---|---------|--------------------------|-----------|--------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

---

**Tips para probar más rápido**:
- Tener 2 sesiones de navegador abiertas (una admin, una usuario normal) para validar RB-04/RB-07.
- Usar la consola del navegador (Network tab) para verificar los status HTTP (401, 423, 410) en escenarios de error.
- Mantener abierto SQL Server Management Studio para inspeccionar `mae_login_attempts`, `mae_password_reset_tokens`, `mae_ficha_historial` durante las pruebas.
