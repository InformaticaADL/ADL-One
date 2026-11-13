# Facturación Salud: cómo traer los cambios y probarlos con la base local

Guía para el equipo de desarrollo. Explica cómo bajar la rama de Facturación Salud, cómo armar la base de datos local que necesita y cómo comprobar que todo funciona.

Última actualización: 2026-11-13.

---

## 0. Lo primero que hay que saber

**Qué es.** Un módulo de ADL ONE que replica la facturación del Área de Salud de ADLSOFT (valorización, pre-facturas, mantención de facturas, archivo plano, otras ventas, notas de crédito y débito, PDF de Resumen y Detalle). Es una **réplica para probar**: ADLSOFT sigue siendo el sistema oficial y **no se desactiva**.

**Por qué necesita una base local.** El módulo **escribe** en la base del laboratorio: crea y elimina facturas, graba folios y marca casos. Por eso **no puede apuntar a producción** (`LaboratorioADL` en `192.168.10.5`). Hay que trabajar con una copia en tu propio equipo.

**Reglas que no se discuten:**

1. Facturación Salud **solo se conecta a este equipo** (`localhost`). El código lo exige con tres candados (sección 5) y se niega a arrancar si apunta a otro servidor.
2. **Nunca** pongas `DB_SALUD_SERVER` apuntando a `192.168.10.5`, al servidor `192.168.10.28` ni a ninguna otra máquina.
3. **No se sube** el archivo `.env` (tiene contraseñas). Está en `.gitignore`; no lo fuerces.
4. Las dos bases se llaman igual (`LaboratorioADL`): la de producción y la de tu copia. **Lo único que las distingue es el servidor.** Antes de ejecutar cualquier script que escriba, comprueba a qué servidor estás conectado.
5. El resto de ADL ONE (que no es Facturación Salud) sigue conectándose a `PruebasInformatica` en producción con las variables `DB_*` de tu `.env`. Si levantas el backend completo, **no hagas operaciones de escritura desde otros módulos** a menos que sepas lo que haces.

---

## 1. Traer los cambios

Todo el trabajo está en una rama aparte, **no está en `main`**:

```
feature/facturacion-salud-replica-adlsoft
```

Repositorio: `https://github.com/InformaticaADL/ADL-One.git`

### 1.1 Si ya tienes el repositorio clonado

Abre una terminal en la carpeta del proyecto (la que contiene `api-backend-adlone` y `frontend-adlone`).

```
git status
```

Si tienes cambios sin guardar, **guárdalos primero** para no perderlos:

```
git stash push -u -m "mi trabajo antes de probar Facturación Salud"
```

Después:

```
git fetch origin
git switch feature/facturacion-salud-replica-adlsoft
```

La primera vez, Git crea la rama local y la deja enlazada con `origin`. Para recibir lo que se suba después:

```
git pull
```

Para volver a tu trabajo anterior:

```
git switch <tu-rama-o-main>
git stash pop
```

### 1.2 Si no tienes el repositorio

```
git clone https://github.com/InformaticaADL/ADL-One.git
cd ADL-One
git switch feature/facturacion-salud-replica-adlsoft
```

### 1.3 Instalar dependencias

Esta rama agrega `pdfkit` (para los PDF). Hay que instalar de nuevo:

```
cd api-backend-adlone
npm install
cd ../frontend-adlone
npm install
```

### 1.4 Qué significa que sea una rama aparte

- **No mezcles esta rama con `main` por ahora.** Se revisará y se integrará cuando terminen las pruebas. `main` avanzó mientras tanto y la mezcla puede traer conflictos.
- Si quieres hacer un cambio, crea tu propia rama **a partir de esta** (`git switch -c mi-cambio`) y avisa antes de subirla.
- No hagas `git push` a esta rama sin avisar a quien la mantiene.

---

## 2. La base de datos local

Facturación Salud trabaja con una **copia de la base `LaboratorioADL`** (y de una parte de `Abastecimiento`, para las guías de despacho) instalada en tu equipo, **en una instancia de SQL Server llamada `ADLLOCAL`** con el puerto TCP fijo **14330**. Los scripts de prueba y los candados dependen de esos dos datos; si usas otro nombre o puerto hay que cambiar la configuración (ver sección 6).

### 2.1 Qué hay que instalar

- **SQL Server Developer** (gratuito) con una instancia con nombre `ADLLOCAL`. La copia de referencia se armó con **SQL Server 2025 Developer**.
  - **Collation:** `Modern_Spanish_CI_AS` (la misma de producción).
  - Si el instalador en español falla, usa el instalador en inglés con esa collation.
  - Un respaldo (`.bak`) solo se puede restaurar en la **misma versión de SQL Server o en una más nueva**. Si recibes un respaldo hecho con 2025, tu instancia debe ser 2025.
- **SQL Server Management Studio (SSMS)**, para mirar la base.
- Autenticación mixta (usuario `sa` con contraseña). **La contraseña es tuya**: no se comparte ni se sube.
- Espacio libre en el disco: unos **2 GB** (la base ocupa ~1 GB de datos y ~0,5 GB de registro).

### 2.2 Activar el puerto 14330

La instancia nueva viene con TCP/IP desactivado. Para activarlo (requiere administrador):

1. Abre **SQL Server Configuration Manager** → *Configuración de red de SQL Server* → *Protocolos de `ADLLOCAL`* → **TCP/IP** → *Habilitado*.
2. En *Propiedades de TCP/IP* → pestaña *Direcciones IP* → sección **IPAll**: deja **vacío** *Puertos dinámicos TCP* y escribe **14330** en *Puerto TCP*.
3. Reinicia el servicio `SQL Server (ADLLOCAL)` (en `services.msc`: `MSSQL$ADLLOCAL`).

Para comprobarlo, desde SSMS: servidor `localhost,14330`, autenticación *SQL Server*, usuario `sa`, y en *Opciones* marca **Trust server certificate**. Ejecuta:

```sql
SELECT @@SERVERNAME, SERVERPROPERTY('MachineName');
```

El nombre del servidor debe contener `ADLLOCAL` y la máquina debe ser **tu** equipo.

> Si el puerto que ves en SSMS es 63003 (o cualquiera distinto de 14330) y las conexiones simultáneas se cortan con `ECONNRESET`, estás usando el puerto de la conexión de administrador dedicada, que acepta una sola conexión. Usa 14330.

### 2.3 Cargar los datos: dos caminos

#### Camino A (recomendado): restaurar un respaldo

Quien ya tiene la copia local genera un respaldo y lo comparte por la red interna. Es más rápido y **no carga el servidor de producción**.

En el equipo que tiene la copia (SSMS, o `sqlcmd`):

```sql
BACKUP DATABASE LaboratorioADL TO DISK = N'C:\respaldo\LaboratorioADL_local.bak' WITH INIT, COMPRESSION;
BACKUP DATABASE Abastecimiento TO DISK = N'C:\respaldo\Abastecimiento_local.bak' WITH INIT, COMPRESSION;
```

En tu equipo (ajusta las rutas de los `MOVE` a tu disco; los nombres lógicos los ves con `RESTORE FILELISTONLY`):

```sql
RESTORE FILELISTONLY FROM DISK = N'C:\respaldo\LaboratorioADL_local.bak';

RESTORE DATABASE LaboratorioADL FROM DISK = N'C:\respaldo\LaboratorioADL_local.bak'
  WITH MOVE '<nombre lógico de datos>' TO N'C:\Datos\LaboratorioADL.mdf',
       MOVE '<nombre lógico del log>'  TO N'C:\Datos\LaboratorioADL_log.ldf', REPLACE;

RESTORE DATABASE Abastecimiento FROM DISK = N'C:\respaldo\Abastecimiento_local.bak'
  WITH MOVE '<nombre lógico de datos>' TO N'C:\Datos\Abastecimiento.mdf',
       MOVE '<nombre lógico del log>'  TO N'C:\Datos\Abastecimiento_log.ldf', REPLACE;
```

El respaldo contiene datos reales de la empresa: **compártelo solo por la red interna** y bórralo cuando termines.

El respaldo queda con el corte de datos de quien lo generó. Para ponerlo al día, ver la sección 3.

#### Camino B: crear la copia desde producción

El script `api-backend-adlone/scripts/pruebas-salud/copia-local/crear-copia-local.cjs` lee producción (**solo `SELECT`**, con `MAXDOP 1` y pausas) y arma la copia local: 788 procedimientos almacenados de ADLSOFT, tablas de facturación, maestros y los casos de los últimos 18 meses.

**Antes de usarlo:**

- Necesitas las credenciales de lectura de producción (`DB_HOST`, `DB_USER`, `DB_PWD`). **Pídelas a quien mantiene la rama; no las pongas en ningún archivo que se suba.**
- Carga el servidor de producción, que comparte con ADLSOFT. Hazlo **fuera de horario** y avisa antes.
- **Los scripts de esta carpeta tienen rutas del equipo de quien los escribió** (por ejemplo `C:/Users/vremolcoy/...` al principio de `crear-copia-local.cjs`) y el puerto `14330` fijo. Ábrelos y ajusta esas rutas a las tuyas antes de ejecutarlos.
- **Reemplaza todo** lo que haya en tu copia.

Detalle completo, con lo que contiene la copia y las notas técnicas: `docs/copia-local-laboratorioadl.md`.

---

## 3. Mantener la copia al día

La copia es una foto de producción. Para traer lo nuevo **sin borrar tus pruebas ni los índices**, existe el refresco incremental:

```
cd api-backend-adlone
node scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs "<contraseña sa local>" --solo-ver   # muestra qué traería, sin escribir
node scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs "<contraseña sa local>"              # actualiza
```

Al terminar compara producción contra tu copia en 11 puntos y dice «igual» o «DIFERENTE». Cada vez que ejecutes algo que escribe, hazlo sobre una **instantánea** para poder volver atrás (sección 6).

También lee producción, así que necesita las credenciales de lectura y se aplican las mismas advertencias del camino B.

---

## 4. Configurar el backend

En `api-backend-adlone`, copia el ejemplo y edítalo (el `.env` **no se sube**):

```
copy .env.example .env
```

Las variables de Facturación Salud:

| Variable | Valor | Para qué |
|---|---|---|
| `DB_SALUD_SERVER` | `localhost` | Solo se acepta `localhost`, `127.0.0.1` o `::1`. |
| `DB_SALUD_PORT` | `14330` | Puerto de la instancia `ADLLOCAL`. Si usas `DB_SALUD_INSTANCE`, el puerto se ignora. |
| `DB_SALUD_INSTANCE` | *(vacío)* | Déjalo vacío si usas el puerto. |
| `DB_SALUD_DATABASE` | `LaboratorioADL` | Nombre de la base local. |
| `DB_SALUD_USER` | `sa` | |
| `DB_SALUD_PASSWORD` | *tu contraseña de `sa` local* | No se comparte ni se sube. |
| `FACTURACION_SALUD_DOCS_DIR` | una carpeta tuya, por ejemplo `C:\FacturacionSalud` | Donde se guardan los PDF (crea sola `<año>\<MES>`). Si queda vacío, el PDF solo se descarga. |

El resto del `.env` (`DB_SERVER`, `DB_DATABASE`, correo, claves internas…) es de ADL ONE en general: pídelo a quien mantiene el proyecto.

El frontend busca el backend en `http://localhost:8002` (`VITE_API_URL` en `frontend-adlone/.env.example`; cópialo a `frontend-adlone/.env`). El `.env.example` del backend trae `PORT=4000`: **cámbialo a `PORT=8002`** para que coincidan, o cambia `VITE_API_URL` en el frontend.

Levantar:

```
cd api-backend-adlone
npm run dev          # backend

cd frontend-adlone
npm run dev          # frontend; abre http://localhost:5173
```

En el menú de ADL ONE entra a **Facturación Salud**.

---

## 5. Los candados de seguridad

Están en `api-backend-adlone/src/config/databaseSalud.js`:

1. Si `DB_SALUD_SERVER` contiene `192.168.10.5`, el módulo **no arranca**.
2. Solo acepta `localhost`, `127.0.0.1`, `::1`, `(local)` o `.`. Cualquier otro nombre o dirección lo detiene.
3. Ya conectado, comprueba que `SERVERPROPERTY('MachineName')` sea **tu propia máquina**; si no, cierra la conexión y falla antes de ejecutar nada.

Los scripts de prueba imprimen «Servidor de la prueba: …\ADLLOCAL» y se **abortan** si el servidor no contiene `ADLLOCAL`.

Si el módulo no arranca y el mensaje habla de «BLOQUEO DE SEGURIDAD», es el candado: revisa `DB_SALUD_SERVER`.

---

## 6. Probar con seguridad: pruebas y vuelta atrás

### 6.1 Pruebas automáticas (no necesitan base de datos)

```
cd api-backend-adlone
node --test src/services/facturacion-salud.prefactura.test.js src/services/facturacion-salud.valorizacion.test.js src/services/facturacion-salud.mantencion.test.js src/services/facturacion-salud.consulta.test.js src/services/facturacion-salud.exportacion.test.js src/services/facturacion-salud.otrasventas.test.js src/services/facturacion-salud.pdf.test.js
```

Resultado esperado al 2026-11-13: **99 pruebas, 99 aprobadas**, comprobado sobre una copia limpia de esta rama.

### 6.2 Instantánea: probar y volver atrás

Antes de cualquier prueba que escriba, crea una instantánea. Es casi instantánea y casi no ocupa espacio. Los scripts están en `api-backend-adlone/scripts/pruebas-salud/copia-local/` (después de ajustar rutas y puerto si hace falta):

1. `crear-instantanea.cjs <contraseña sa local>`: guarda el estado actual.
2. Haz las pruebas.
3. `restaurar-instantanea.cjs <contraseña sa local>`: deja la base **exactamente** como estaba. Reinicia el backend después (la restauración necesita que no haya conexiones abiertas).
4. `eliminar-instantanea.cjs <contraseña sa local>`: la borra cuando ya no la necesitas.

La instantánea debe cubrir `LaboratorioADL` **y** `Abastecimiento` (las guías de despacho viven en la segunda).

### 6.3 Qué hay en `scripts/pruebas-salud/`

| Carpeta | Qué contiene |
|---|---|
| `copia-local/` | Crear y refrescar la copia, instantáneas y estado. |
| `valorizacion/` | Pruebas de valorización contra facturas reales. |
| `operaciones-escritura/` | Pruebas de eliminar, cambiar empresa, grabar folio, notas de crédito y débito, guías y otras ventas. |
| `comparacion/` | Carga de facturas de ADLSOFT a una base de comparación y el informe de diferencias (ver `LEEME.md`). |
| `archivo-plano/`, `pdf/` | Comparación del archivo plano y de los PDF contra los originales de ADLSOFT. |
| `indices/` | Medición de rendimiento con y sin índices. |
| `produccion-solo-lectura/` | Foto de producción (conteos) para comprobar que no cambió nada. |

Estos scripts los escribió una sola persona en su equipo: **31 de los 43 tienen rutas del equipo del autor** (por ejemplo `C:/Users/vremolcoy/Desktop/ADL ONE/...`), el puerto `14330` fijo, y algunos usan módulos o credenciales de otro repositorio (`WebClientesV2`, el portal de clientes). Léelos y ajusta las rutas antes de ejecutarlos. Los que solo leen producción (copia, refresco, comparación) necesitan además las credenciales de lectura que te dé quien mantiene la rama.

---

## 7. Qué está hecho y qué falta

**Hecho:** los 6 bloques de la réplica (elegibilidad, valorización, creación de pre-facturas, mantención de facturas, consulta y «Graba Factura», otras ventas y notas), las cinco pantallas y los PDF de Resumen y Detalle. Verificado en la copia local: operaciones que escriben (78 de 78 casos de prueba), valorización contra 20 facturas reales, archivo plano idéntico byte a byte a los originales, PDF con desvío menor a 0,04 pt.

**Falta:**

- La **prueba en paralelo del lunes 16/11/2026**: el equipo factura en ADLSOFT y se repite lo mismo en ADL ONE sobre la copia, comparando valorización, pre-facturas y PDF (`docs/plan-prueba-cierre-16-nov-2026.md`).
- Comparar contra originales de ADLSOFT: Screening de proyecto, empresa con dólares, Detalle con varios centros o varias hojas, y archivo plano de dólares, exentas y notas.
- Probar con datos reales la liberación y asociación de guías de despacho.
- **Decisiones abiertas** (se tratan después de las pruebas): cómo marcar un caso como facturado sin escribir en `LaboratorioADL`, cómo se obtiene el número de factura y la integración con la API del emisor.
- Valorización por lotes y migración de índices al laboratorio real: **después** de la prueba del lunes, y nunca en producción sin una orden expresa.

---

## 8. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| `[BLOQUEO DE SEGURIDAD] … solo puede conectarse a este equipo` | `DB_SALUD_SERVER` no es `localhost` | Ponlo en `localhost`. |
| `Connection lost - read ECONNRESET` | Puerto del DAC (63003) o TCP/IP desactivado | Activa TCP/IP y usa el puerto fijo 14330. |
| `Cannot find package 'pdfkit'` | Faltó instalar dependencias | `npm install` en `api-backend-adlone`. |
| `'TRY_CONVERT' is not a recognized built-in function` | La base tiene nivel de compatibilidad 100, como producción | Usar `ISDATE` y `CONVERT(…, 103)`. |
| Fechas que no convierten | Formato de fecha de la sesión | `SET DATEFORMAT dmy;` al inicio de la consulta. |
| «La base de datos está en uso» al restaurar la instantánea | Hay conexiones abiertas | Detén el backend y vuelve a intentar. |
| El respaldo no se restaura | Tu SQL Server es más antiguo que el del respaldo | Instala una versión igual o más nueva. |
| El PDF no se guarda en una carpeta | `FACTURACION_SALUD_DOCS_DIR` vacío | Define la carpeta en `.env`; si no, el PDF solo se descarga. |

---

## 9. Dónde está el resto de la documentación

| Documento | Para qué sirve |
|---|---|
| `docs/facturacion-salud-replica-adlsoft.md` | Qué se replicó, hallazgos de ADLSOFT (H-xx), desvíos (D-xx), mejoras (M-xx) y decisiones pendientes. |
| `docs/copia-local-laboratorioadl.md` | La copia local en detalle: contenido, refrescos, candados y reversión. |
| `docs/facturacion-salud-pruebas-y-resultados.md` | Registro de todas las pruebas, con resultados y lo que falta. |
| `docs/facturacion-salud-indices-y-rendimiento.md` | Medición de rendimiento e índices. |
| `docs/plan-prueba-cierre-16-nov-2026.md` | Plan de la prueba en paralelo del lunes 16/11. |
| `facturacion_salud_laboratorio_adl.md` | Ingeniería inversa del módulo en ADLSOFT (documento original del colega que inició el módulo). |
