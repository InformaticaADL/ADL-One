# Plan y Registro de Implementación: Facturación Salud en `ADLFacturacion` y Flujo de Aprobaciones

**Fecha:** 2026-11-20  
**Estado:** Implementado y verificado (flujo principal); migración de `15` prefacturas locales completada (`#1` al `#15`)

---

## 1. Objetivo
Desacoplar la persistencia de **Facturación Salud** de las tablas y procedimientos heredados de `LaboratorioADL` (`Mae_id`, `mf = 3`, saltos de correlativo de 2 en 2), manteniendo la lectura de casos, tarifas y catálogos desde `LaboratorioADL` local y guardando todo el proceso de facturación y aprobaciones en **`ADLFacturacion`** (`192.168.10.5`).

---

## 2. Arquitectura de Bases de Datos y Seguridad

| Pool | Archivo | Servidor / Base | Uso |
|---|---|---|---|
| **Principal** | `api-backend-adlone/src/config/database.js` | `192.168.10.5` / `PruebasInformatica` | Sistema general ADL ONE y `audit_log` |
| **Origen Salud (solo lectura)** | `api-backend-adlone/src/config/databaseSalud.js` | `localhost` / `LaboratorioADL` | Lectura de muestras, casos elegibles, tarifas y catálogos (`mae_*`) |
| **Facturación (lectura/escritura)** | `api-backend-adlone/src/config/databaseFacturacion.js` | `192.168.10.5` / `ADLFacturacion` | Todo el ciclo de facturación, valorizaciones y aprobaciones |

- **Candado estricto en `databaseFacturacion.js`:** valida antes de conectar (`DB_FACTURACION_DATABASE` debe ser `ADLFacturacion`) y después de conectar (`SELECT DB_NAME()`) cerrando el pool si la base activa no corresponde.

---

## 3. Esquema en `ADLFacturacion`
Definido en `db-migrations/2026-11-20-adlf-facturacion-schema.sql` con correlativos `IDENTITY(1, 1)` desde `1`:
- `dbo.facturacion_enc` (encabezado de prefactura/factura con auditoría y borrado lógico `eliminado`)
- `dbo.facturacion_det` (*snapshot* completo de líneas valorizadas: técnica, centro, veterinario, subprograma, fechas, montos)
- `dbo.facturacion_valorizacion` (almacenamiento temporal de valorizaciones y ajustes manuales sin mutar `LaboratorioADL.dbo.muestras_detalle`)
- `dbo.facturacion_ing` y `dbo.facturacion_des` (otros ingresos y descuentos)
- `dbo.facturacion_ocompra` y `dbo.facturacion_oc` (OC/HES y OC con valor)
- `dbo.facturacion_guias` (vínculo de guías de despacho)
- `dbo.facturacion_otro` (estructura para otras ventas y notas)
- `dbo.fac_aprobacion_cambio_empresa` (solicitudes y resoluciones de cambio de empresa a facturar)
- `dbo.auditoria` (registro de cambios aprobados)

---

## 4. Cambios Implementados

### Backend (`api-backend-adlone`)
1. **Motor híbrido y migración a `ADLFacturacion`** (`src/services/facturacion-salud.service.js`):
   - `getCasosElegiblesPorEmpresa`: lee desde `LaboratorioADL`, excluye automáticamente las líneas `(id_caso, item)` presentes en `ADLFacturacion.dbo.facturacion_det` de facturas activas (`eliminado <> 'S'`) y superpone las valorizaciones guardadas en `ADLFacturacion.dbo.facturacion_valorizacion`.
   - `valorizarCasosSalud` y `actualizarLineaCasoManual`: guardan en `ADLFacturacion.dbo.facturacion_valorizacion` sin escribir en `LaboratorioADL`.
   - `previsualizarPrefacturasSalud` y `crearPrefacturasSalud`: asignan correlativos consecutivos (`OUTPUT INSERTED.id_facturacion`) y guardan *snapshot* completo en `ADLFacturacion`.
   - Bandeja, consulta, grabado de montos/folio, OI/OD, OC/HES, PDF Resumen/Detalle, Excel, quitar caso y eliminación lógica (`eliminado = 'S'`) operando sobre `ADLFacturacion`.
   - Soporte opcional `incluir_rezagados` (desde `01/01/2022`) en backend para capturar casos de períodos anteriores manteniendo el `fecha_proceso_ini` en el encabezado.
2. **Flujo de aprobación de cambio de empresa** (`src/services/facturacion-salud.aprobacion.js`):
   - Lee facturas y casos desde `ADLFacturacion`, lee datos maestros de la nueva empresa desde `LaboratorioADL`, registra solicitudes en `ADLFacturacion.dbo.fac_aprobacion_cambio_empresa` y, al aprobar, actualiza `facturacion_enc`, `facturacion_det` y `auditoria` en transacción única dentro de `ADLFacturacion`.
3. **Migración inicial de datos de prueba:**
   - Se migraron las `15` prefacturas creadas entre el `16/11/2026` y el `19/11/2026` desde `LaboratorioADL` (`74912`–`74944`) hacia `ADLFacturacion`, quedando numeradas consecutivamente del `#1` al `#15`.

### Frontend (`frontend-adlone`)
1. **Procesar / Valorizar y Facturar** (`src/features/facturacion-salud/components/FacturacionSaludProcesar.tsx` y `procesar/CasosTabla.tsx`):
   - Colapso automático del panel de empresas al seleccionar una empresa, liberando el `100%` del ancho para filtros y tabla de casos (con botón `Cambiar empresa (N)`).
   - Etiqueta de subprograma (`nombre_programa`) en cada fila y selector **Filtrar por subprograma** cuando el programa agrupa múltiples subprogramas (ej. *Contingencia ISA - PVSalmon Chile - SRS*).
   - Opción de casos rezagados oculta y desactivada por defecto (`incluirRezagados = false`) para trabajar solo con el rango de fechas elegido.
2. **Bandeja de Facturas** (`FacturacionSaludPrefacturas.tsx` y `FacturacionSaludModule.tsx`):
   - Nueva columna **Centro** junto a **Empresa** y compactación de la columna **Glosa** con tooltip completo.
   - Botón **Volver al listado** y clic en la pestaña **Facturas** corregidos para limpiar `ficha` e `idInicial` y regresar siempre al listado completo.
3. **Administración y Finanzas** (`src/features/admin/pages/AdminAdmHub.tsx`, `AdministracionFinanzasPage.tsx`, `AdminInfoHub.tsx`, `DashboardPage.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `CommandMenu.tsx`):
   - Hub con submenú (`PageHeader` + `HubGrid`) para *Aprobación Cambio de Empresa* y *Auditoría e Historial de Cambios*, y acceso directo en **Unidades** con ícono `IconCurrencyDollar`.

---

## 5. Verificación Realizada
- **Frontend:** `npx tsc --noEmit` en `frontend-adlone` finalizado con código `0`.
- **Backend:** `node --check` sobre `databaseFacturacion.js`, `facturacion-salud.aprobacion.js` y `facturacion-salud.service.js`, y `node --test` sobre las 7 suites de `facturacion-salud.*.test.js` (**99/99** pruebas aprobadas).
- **Integración en vivo:** verificación de lectura/escritura dual contra `LaboratorioADL` (`localhost`) y `ADLFacturacion` (`WS2016`), confirmando las `15` facturas migradas y la ficha `#10` (`NOV ID10 CAMANCHACA AALMONACID`, `17,2 UF`).

---

## 6. Pendientes / Próximos Pasos
- Migrar los flujos secundarios de **Otras Ventas / Notas de Crédito** (`facturacion-salud.otrasventas.js`) y **Exportación de Archivo Plano DTE** (`facturacion-salud.exportacion.js`) para que también lean/escriban 100% en `ADLFacturacion`.
- Si se requiere reprocesar en `ADLFacturacion` alguna de las 15 prefacturas migradas (`#1`–`#15`), tener en cuenta que en `LaboratorioADL` local sus líneas originales quedaron marcadas como `FACTURADO`.
