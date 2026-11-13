# Copia local de LaboratorioADL (para probar Facturación Salud)

Este documento explica **cómo está armada la copia local de la base del laboratorio**, cómo **volver a traer datos nuevos** y cómo **probar sin riesgo**. Todo lo que se escribe va a la copia local; **producción solo se lee**.

Última actualización: 2026-11-10.

## 1. Qué es y por qué existe

ADL ONE no puede probarse contra producción (`LaboratorioADL` en `192.168.10.5`) porque Facturación Salud escribe: crea y elimina facturas, graba folios, marca casos. Se armó una **copia parcial** en este equipo, en una instancia aparte de SQL Server. Con ella se puede probar la facturación completa sin tocar nada real.

| | Producción | Copia local |
|---|---|---|
| Servidor | `WS2016` (192.168.10.5, SQL Server 2017) | `NTDMora\ADLLOCAL` (este equipo, SQL Server 2025 Developer) |
| Base | `LaboratorioADL` | `LaboratorioADL` (**se llama igual**) |
| Quién escribe | ADLSOFT y el equipo | Solo ADL ONE y las pruebas |

**Regla de oro:** las dos bases se llaman igual, así que **el nombre de la base no sirve para distinguirlas; lo que las distingue es el servidor.** Cualquier script que escriba debe comprobar el servidor antes.

## 2. Cómo quedó instalada

- **Instancia:** `ADLLOCAL` (servicio `MSSQL$ADLLOCAL`), SQL Server 2025 Developer, en la máquina `NTDMora`. Usuario `sa`; la contraseña la definió quien instaló y **no se guarda en el repositorio**.
- **Conexión TCP:** puerto fijo **14330**. La instancia venía con TCP/IP desactivado y solo escuchaba por el puerto del DAC (conexión de administrador dedicada, una sola conexión a la vez). El puerto `63003` que se usó al principio **era el del DAC** y por eso fallaba toda conexión simultánea (`ECONNRESET`). No usar 63003.
  - Para activarlo: clave de registro `HKLM\SOFTWARE\Microsoft\Microsoft SQL Server\MSSQL17.ADLLOCAL\MSSQLServer\SuperSocketNetLib\Tcp` con `Enabled = 1` y, en `IPAll`, `TcpPort = 14330` y `TcpDynamicPorts` vacío; luego reiniciar `MSSQL$ADLLOCAL` (requiere administrador).
- **Bases:** `LaboratorioADL` (unos 968 MB de datos; collation `Modern_Spanish_CI_AS`; nivel de compatibilidad 100, igual que producción; recuperación SIMPLE) y `Abastecimiento` (solo `gd_enc`, `gd_det` y el procedimiento `fac_guiasdespachoclientes`, que usa la reserva de guías).
- **Abrirla con SSMS:** servidor `localhost,14330`, autenticación SQL Server, usuario `sa`, y en *Options* marcar *Trust server certificate*.
- **Configuración de ADL ONE** (`api-backend-adlone/.env`, no versionado): `DB_SALUD_SERVER=localhost`, `DB_SALUD_PORT=14330`, `DB_SALUD_DATABASE=LaboratorioADL`, `DB_SALUD_USER=sa`, `DB_SALUD_PASSWORD=<la de sa>` y `FACTURACION_SALUD_DOCS_DIR=<carpeta de PDFs>`. El resto de ADL ONE sigue usando `PruebasInformatica` en producción: eso no es Facturación Salud.

## 3. Qué contiene (corte del 2026-11-10)

- **788 procedimientos almacenados** de ADLSOFT (`fac_*`, `consulta_*`, `maestro_*`, `facturacion_*`, `OtrasVentas*`, `actualiza_auditoria`). Son los mismos que usa ADLSOFT, así que las reglas de elegibilidad y de precios son las originales.
- **Tablas:** las que esos procedimientos usan, más `mae_*`, `facturacion*`, `Mae_id`, `atv_planilla`, `muestras` y `muestras_detalle`.
  - Las tablas de hasta 60 MB se copian completas.
  - **`muestras` y `muestras_detalle` solo traen los casos de los últimos 18 meses** (por `fecha_recepcion`). Hoy: **48.878 casos** (`id_caso` 289152 a 338044, desde abril de 2025) y **302.942 líneas de análisis**.
  - `facturacion_det` se copia **completa** (1.704.838 líneas), igual que `facturacion_enc` (37.992) y `facturacion_otro` (2.460): se puede consultar el historial completo de facturas, aunque los casos de las más antiguas no estén.
  - `auditoria` se copia **solo la estructura** (vacía).
- **Consecuencias:** para valorizar solo sirven casos desde abril o mayo de 2025; una factura vieja se ve completa, pero sin los datos de sus casos.

## 4. Cómo volver a traer datos nuevos

### 4.1 Refresco completo (existe, está probado)

Script: `api-backend-adlone/scripts/pruebas-salud/copia-local/crear-copia-local.cjs`.

```
node scripts/pruebas-salud/copia-local/crear-copia-local.cjs "<contraseña de sa local>" 18
```

El segundo argumento son los **meses de historia** de casos (18 por defecto).

Qué hace:
1. Lee producción con las credenciales de `WebClientesV2/app/backend/.env` (`DB_HOST`, `DB_USER`, `DB_PWD`; la ruta está al inicio del script) y **solo ejecuta `SELECT`**, con `MAXDOP 1` y pausas entre tablas para no cargar la CPU del servidor compartido con ADLSOFT. Si producción corta la conexión, reconecta y reintenta (hasta 3 veces).
2. En la instancia local **borra y vuelve a crear** cada tabla y cada procedimiento, y copia los datos.
3. Copia también `Abastecimiento` (guías).

**Antes de correrlo:**
- Detén el backend de ADL ONE (mantiene conexiones abiertas a la copia).
- Recuerda que **reemplaza todo lo que haya en la copia**, incluidas las pruebas que se hayan hecho. Si hay algo que conservar, primero sácalo.
- Hazlo **fuera del horario de mayor uso** de ADLSOFT. La corrida anterior leyó unos 1,7 millones de filas de `facturacion_det` y más de 300 mil líneas de análisis.
- Verifica que haya espacio en el disco C (la base ocupa ~1 GB y el registro de transacciones ~0,5 GB).

**Después:** comprueba el resultado (el script termina con «LISTO. Tablas con error: 0» y «procedimientos creados: 788 de 788») y reinicia el backend de ADL ONE.

**Notas técnicas que costaron tiempo la primera vez:**
- Producción tiene nivel de compatibilidad 100: **no existe `TRY_CONVERT`**; para validar fechas se usa `ISDATE` y `CONVERT(..., 103)`. Las fechas del LIMS son texto `dd/mm/yyyy`: toda consulta debe empezar con `SET DATEFORMAT dmy;`.
- Se hace **un solo `ALTER DATABASE` y solo si hace falta**, porque después de ejecutarlo las conexiones nuevas fallan un rato.
- El instalador de SQL Server en español falló por el idioma del sistema; se usó el medio en inglés (ENU) con collation `Modern_Spanish_CI_AS`.

### 4.2 Refresco incremental (implementado y probado el 2026-11-10)

Script: `api-backend-adlone/scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs`. Trae solo lo nuevo, **sin borrar la base ni los índices que se le agreguen**.

```
node scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs "<contraseña sa local>" --solo-ver   # muestra qué traería y compara con producción, sin escribir
node scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs "<contraseña sa local>"             # actualiza
node scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs "<contraseña sa local>" --ultimos=8000 # vuelve a traer más casos hacia atrás
```

| Parte | Qué hace |
|---|---|
| Tablas pequeñas (maestros, facturas, otras ventas, OC, planillas ATV, contadores) | Se copian a una tabla nueva y se cambian al final dentro de una transacción: si algo falla, queda la tabla original. |
| Casos y líneas (`muestras`, `muestras_detalle`) | Se borra y se vuelve a traer todo lo que esté por encima de *(último caso de la copia − 4.000)*, más los casos **anteriores con líneas pendientes** (que son los que importan para facturar). Todo en una sola transacción. |
| Detalle de facturas (`facturacion_det`) | Compara por factura (cantidad de líneas y suma) y trae solo las nuevas, cambiadas o eliminadas. |
| Procedimientos y guías de despacho | Se vuelven a crear. |

**Seguridad:** se aborta si el destino no es la instancia local de esta máquina o si el origen fuera la instancia local; en producción solo ejecuta `SELECT` con `MAXDOP 1`. Si la estructura de `muestras` o `muestras_detalle` cambió en producción, se detiene y pide usar el refresco completo.

**Verificación final (automática):** compara producción contra la copia en 11 puntos: casos, líneas, líneas pendientes, líneas facturadas, casos finales, facturas, facturas emitidas, detalle de facturas, otras ventas y los contadores de numeración (`Mae_id`). Dice "igual" o "DIFERENTE" en cada uno. Producción está viva, así que unas pocas diferencias recientes son normales; por eso conviene correrlo justo antes de probar.

**Prueba del 10/11:** 143 segundos para traer 54 casos nuevos, 1.863 casos antiguos con líneas pendientes y 1 factura cambiada; las 11 comparaciones dieron "igual".

**Por qué no se usa la fecha de recepción para elegir el rango:** un caso con la fecha mal digitada movería el límite y obligaría a traer decenas de miles de casos de más. Se usa el número de caso, que solo crece.

**Cuándo conviene el refresco completo** (`crear-copia-local.cjs`) en vez del incremental: si cambia la estructura de una tabla, si se quiere más historia de casos (por ejemplo 24 meses) o si la copia quedó inconsistente.

### 4.3 Cuándo refrescar

La facturación se hace a **fin de mes**. Para probar la valorización «en vivo» el momento ideal es **unos días antes del cierre** (por ejemplo, del 25 al 27): los casos del mes aparecen como pendientes, se valorizan en ADL ONE, y cuando el equipo factura en ADLSOFT se traen esas facturas y se comparan línea por línea (ver el documento de pruebas y `plan-prueba-cierre-16-nov-2026.md`).

## 5. Probar con seguridad: candados y reversión

**Candados que ya están en el código** (`src/config/databaseSalud.js`):
1. Rechaza `192.168.10.5`.
2. Solo acepta `localhost`, `127.0.0.1` o `::1`: cualquier otra dirección (incluida `192.168.10.28` o el nombre del servidor) detiene el arranque del módulo.
3. Ya conectado, exige que `SERVERPROPERTY('MachineName')` sea **esta máquina**; si no, cierra la conexión y falla.

Los scripts de prueba imprimen **«Servidor de la prueba: NTDMora\ADLLOCAL»** y se **abortan** si el servidor no contiene `ADLLOCAL`.

**Instantánea para probar y volver atrás** (scripts en `scripts/pruebas-salud/copia-local/`):
1. `crear-instantanea.cjs <pwd>`: crea `LaboratorioADL_antes_prueba` como instantánea (`CREATE DATABASE … AS SNAPSHOT OF`). Es casi instantánea y casi no ocupa espacio.
2. Se hacen las pruebas que escriben.
3. `restaurar-instantanea.cjs <pwd>`: deja la base **exactamente** como estaba (`RESTORE DATABASE … FROM DATABASE_SNAPSHOT`); pone la base en modo de un solo usuario un momento. Reinicia el backend de ADL ONE después.
4. `eliminar-instantanea.cjs <pwd>`: la elimina cuando ya no hace falta.

**Comprobar que producción no cambió** (solo lectura): `scripts/pruebas-salud/produccion-solo-lectura/foto-produccion.cjs <archivo.json>` guarda conteos (facturas, detalle, otras ventas, contador de numeración, líneas pendientes y las facturas que se van a probar). Se corre **antes y después** y se comparan. Ojo: producción está viva; las «líneas pendientes» suben cuando ingresan casos nuevos (en la prueba del 10/11 subieron 80 por 52 casos nuevos del laboratorio). Lo que **no** debe moverse son las facturas, el detalle, las otras ventas y el contador.

## 6. Problemas conocidos

| Síntoma | Causa | Solución |
|---|---|---|
| `Connection lost - read ECONNRESET` al abrir una segunda conexión | Se estaba usando el puerto del DAC (63003) | Usar 14330; verificar que TCP/IP esté activo en `ADLLOCAL` |
| `'TRY_CONVERT' is not a recognized built-in function` | Compatibilidad 100 | `ISDATE` + `CONVERT(…, 103)` |
| Fechas que no convierten | Formato de fecha del puesto | `SET DATEFORMAT dmy;` al inicio |
| «La base de datos está en uso» al restaurar | Hay conexiones abiertas (ADL ONE) | El script restaura en modo de un solo usuario; reiniciar el backend después |
