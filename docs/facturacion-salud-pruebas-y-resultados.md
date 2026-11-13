# Facturación Salud: pruebas realizadas y resultados

Registro de **qué se probó, cómo se probó y cómo salió** al replicar la facturación de ADLSOFT en ADL ONE. Complementa a `facturacion-salud-replica-adlsoft.md` (hallazgos H-xx, desviaciones D-xx y mejoras M-xx) y a `copia-local-laboratorioadl.md` (cómo está armada la copia local).

Fecha de las pruebas: **2026-11-10**. Rama `feature/facturacion-salud-replica-adlsoft` (sin commitear).

## Resumen

| Área | Estado | Cómo se comprobó |
|---|---|---|
| Pruebas automáticas | ✅ **99 de 99 pasan** | `node --test` |
| Seguridad (no escribir en producción) | ✅ verificada | candados + comprobación de producción antes y después |
| PDF «Detalle» y «Resumen» | ✅ idénticos a ADLSOFT en los casos comprobados | comparación con 7 PDF reales |
| Archivo plano de facturas de casos y otras ventas | ✅ **idéntico byte a byte** | 4 archivos reales |
| Valorización (cálculo de precios) | ✅ coincide línea por línea con facturas reales de 2026 | 14 facturas de 2026 + 6 de 2025 |
| Consultas y pantallas contra la copia local | ✅ responden con datos | prueba de humo de los servicios |
| Operaciones que escriben (eliminar, cambiar empresa, grabar folio, eliminar por folio, notas de crédito) | ✅ **41 de 41 comprobaciones correctas** con datos reales | prueba sobre la copia local, con instantánea y reversión |
| Algunas variantes sin original para comparar | ⏳ pendiente | ver sección 8 |

**Conclusión:** en todo lo que se pudo comparar contra ADLSOFT, ADL ONE da el mismo resultado. Las diferencias encontradas se explicaron (tarifas sin historial, UF del día, valores escritos a mano, orden de procesamiento) y ninguna fue un error de cálculo. Lo pendiente es lo que no se pudo comparar todavía, no algo que falle.

---

## 1. Pruebas automáticas

`node --test src/services/facturacion-salud.*.test.js` (en `api-backend-adlone`): **99 pruebas, 99 pasan, 0 fallan.**

| Módulo | Pruebas | Qué cubre |
|---|---|---|
| `valorizacion` | 20 | reglas de precio por programa, redondeos de FoxPro, jornada, costo operativo |
| `prefactura` | 19 | agrupación de casos y líneas, criterios, creación de grupos |
| `consulta` | 15 | ficha de factura, Graba Factura, guías, nombre de archivo |
| `exportacion` | 15 | archivo plano de 35 columnas, redondeos, OC/HES |
| `otrasventas` | 12 | documentos exentos, notas de crédito y débito, NC por casos |
| `mantencion` | 10 | eliminar factura, cambiar empresa, OC, otros ingresos y descuentos |
| `pdf` | 8 | Resumen y Detalle, nombres, carpeta |

## 2. Prueba de humo contra la copia local

Se llamó a los servicios del módulo contra `NTDMora\ADLLOCAL` (sin levantar el servidor completo): dashboard, maestros, maestros de documentos, prefacturas, detalle de prefactura, consulta de factura, otras ventas, listado de exportación y listado DTE. **Todos respondieron con datos** (el único «error» fue una validación esperada: pedía rango de fechas). Con 6 consultas simultáneas el grupo de conexiones responde en 274 ms.

Además, el **Resumen del dashboard cuenta más pendientes que los procedimientos de ADLSOFT** (2.440 casos contra menos, según el programa): el Resumen usa una consulta más simple. Está documentado (H-88) y propuesto corregirlo (M-34). La pantalla **Valorizar** sí usa los procedimientos de ADLSOFT.

## 3. Seguridad: que no se escribe en producción

Las dos bases se llaman `LaboratorioADL`; se distinguen **por servidor** (producción `WS2016`; copia `NTDMora\ADLLOCAL`).

**Candados** (en `src/config/databaseSalud.js`), probados el 10/11:

| Prueba | Resultado |
|---|---|
| `DB_SALUD_SERVER=localhost` | conecta a `NTDMora\ADLLOCAL` |
| `192.168.10.5` (producción) | **rechazado** al arrancar |
| `192.168.10.28` (servidor de informes) | **rechazado** |
| `WIN-TCFF9P4QMNC` (servidor de producción de ADL ONE) | **rechazado** |
| Ya conectado: la máquina del servidor SQL debe ser esta PC | verificación incorporada |

Cada script de prueba que escribe imprime «Servidor de la prueba: NTDMora\ADLLOCAL» y se aborta si no contiene `ADLLOCAL`.

**Producción antes y después de las pruebas de valorización** (solo `SELECT`):

| Dato | Antes | Después |
|---|---|---|
| Facturas (`facturacion_enc`) | 37.992 | 37.992 |
| Mayor `id_facturacion` | 74.906 | 74.906 |
| Detalle de facturas | 1.704.838 | 1.704.838 |
| Otras ventas | 2.461 | 2.461 |
| Contador de numeración (`Mae_id`) | 74.908 | 74.908 |
| Las 7 facturas que se probaron: líneas | 135 | 135 |
| Las 7 facturas que se probaron: suma de valores | 212,85 | 212,85 (diferencia 1e-13, ruido de coma flotante) |
| Líneas pendientes | 55.983 | 56.063 |

Las líneas pendientes subieron 80 porque **ingresaron 52 casos nuevos al laboratorio** durante la sesión (los casos en producción llegan a 338096; la copia termina en 338044): 84 líneas pendientes de casos nuevos, menos 4 líneas antiguas que el equipo facturó. Lo que habría cambiado si alguna prueba hubiera escrito en producción (facturas, detalle, otras ventas, contador) **no se movió**.

## 4. PDF «Detalle» y «Resumen»

**Método:** se pidió a ADLSOFT PDFs reales; se extrajo de cada uno el texto con su posición exacta, las líneas y su color; se generó el equivalente en ADL ONE **con los datos que tenía la factura cuando ADLSOFT hizo su PDF** (sin folio, la fecha y la UF de entonces) y se comparó texto por texto. Se leyeron también las definiciones de los informes originales (`C:\Programa\LaboratorioADL\REPORTS\*.frx`) para las reglas de impresión.

| PDF | Factura | Resultado |
|---|---|---|
| Detalle general | 74398 (Blumar) | 42 textos, 0 sin pareja, desvío 0,00 pt |
| Detalle Screening con jornada (2 hojas) | 74389 (Aquagen) | misma estructura, 2 hojas, 5 fechas de muestreo; alturas a 0,06 pt y líneas a 0,01 pt (comparado con los datos extraídos del original; el PDF se pisó) |
| Detalle Screening sin jornada | 70181 (Camanchaca) | 138 textos, 0 sin pareja, desvío 0,04 pt |
| Resumen | 69637 (Camanchaca) | 33 textos, 0 sin pareja, desvío 0,02 pt |
| Resumen con descuento | 70298 (AMSA) | 33 textos, 0 sin pareja, desvío 0,01 pt; líneas a 0,16 pt |
| Resumen con un otro ingreso | 74887 (Camanchaca) | 33 textos, 0 sin pareja, desvío 0,02 pt |
| Resumen con descuento que se parte | 70197 (Camanchaca) | 33 textos, 0 sin pareja, desvío 0,01 pt |

Se igualaron: carta, Arial, barras naranjas `#FF8000`, el logo «Diagnostic Chile SpA» (extraído del PDF original), la cabecera, el pie y la paginación. La única diferencia de contenido es el título («ADL ONE - Sistema de Facturación» en vez de «ADLSoft…», D-29) y décimas de ancho por la tipografía.

**Reglas de ADLSOFT descubiertas y replicadas** (detalle en el documento principal, H-89 a H-96): «Facturado por» con «Veterinario:» fijo; «Fecha proceso» muestra el rango de informe; los montos en cero se imprimen en blanco (`@Z`); recepción y caso solo en la primera línea; en la plantilla con jornada el subtotal por caso se acumula por centro (error de ADLSOFT); un valor de 2 o más dígitos enteros no cabe en su campo y pasa a una segunda línea, lo que baja todo lo siguiente 9,22 pt; filas de «Otros ingresos» de 23,46 pt y sin filas si no hay registros.

**Nombre del archivo** (H-92): ADLSOFT propone `<mes> ID<id> <sigla> <programa>` y el personal agrega a mano el folio y el centro o veterinario. ADL ONE lo arma así: `OCT FACTURA 31873 ID74389 AQUAGEN SCR RIO IGNAO`, `OCT ID74398 S.BLUMAR SDG PACUÑA`, `JUN FACTURA 30632 ID72325 NALCAHUE MAM CHESQUE ALTO`. Coincide con las 3 muestras reales (la de junio solo cambia el orden). **Falta confirmar la regla con ADL.** El Detalle se guarda como `<nombre>.PDF` y el Resumen como `<nombre> RESUMEN.PDF`.

**La UF queda guardada en cada factura** (`facturacion_enc.uf`) y se reemplaza por la del día al **grabar el folio** (comportamiento de ADLSOFT). Un PDF de una factura con folio no cambia con el tiempo; el de una prefactura puede cambiar al grabar el folio.

## 5. Archivo plano para el emisor (`FE_CASOS_…TXT`, `FE_OTRASVENTAS_…TXT`)

**Método:** con la misma lógica del botón, y **sin marcar nada como emitido**, se generó el archivo de las mismas facturas y se comparó **byte a byte** con el original de ADLSOFT.

| Archivo real de ADLSOFT | Contenido | Resultado |
|---|---|---|
| `FE_CASOS_73718_…_73704.TXT` | 8 facturas de casos (31/08/2026), con OC y HES | **idéntico** (5.558 bytes) |
| `FE_OTRASVENTAS_73153.TXT` | 1 otra venta con OC y HES (28/08/2026) | **idéntico** (1.426 bytes) |
| `FE_CASOS_74891_…_74540.TXT` | 8 facturas de casos (30/10/2026), una de I+D | **idéntico** (7.000 bytes) |
| `FE_OTRASVENTAS_74591.TXT` | 1 otra venta **sin OC** (30/10/2026) | **idéntico** (749 bytes) |

Incluye Windows-1252, saltos de línea CRLF, comillas, fechas sin comillas, la fecha vacía `/  /` y los redondeos de neto, IVA y total. También el **orden** de las facturas (el del listado) y el nombre en mayúsculas (`FE_CASOS_…`).

**Único error encontrado y corregido** (H-97): el N.° de la OC/HES salía con espacios al final (el campo está relleno a 20 caracteres y ADLSOFT los quita). Se arregló en los dos flujos y se agregó una prueba automática.

## 6. Valorización

**Método** (seguro, solo en la copia local, con instantánea):
1. Se guarda lo que calculó ADLSOFT para una factura ya emitida (líneas, valores, totales).
2. Se **elimina** la factura con la función del módulo: sus casos vuelven a quedar pendientes.
3. Se **valoriza de nuevo con ADL ONE**: misma empresa y programa, mismo rango de fechas de informe de los casos, misma UF.
4. Se **crea la prefactura** con los mismos datos y se compara línea por línea (caso, ítem, valor).
5. Se devuelve la copia a su estado original con la instantánea.

Si varias facturas se procesaron juntas en ADLSOFT (por ejemplo, la jornada de Aquagen se reparte entre facturas), se procesan juntas (`73840+73838`).

### 6.1 Facturas de 2026 (tarifas vigentes): todas coinciden

| Programa | Factura (ID / folio) | Líneas iguales |
|---|---|---|
| PVA | 74477 / 31892 | 24 de 24 |
| PVA | 74609 / 31901 | 24 de 24 |
| Screening (Aquagen) | 73840 / 31557 y 73838 / 31559 (procesadas juntas) | 21 de 21 y 7 de 7 |
| Servicios Diagnósticos | 74553 / 31907 | 35 de 35 |
| Servicios Diagnósticos | 74617 / 31899 | 21 de 21 |
| I+D | 74891 / 31902 | 15 de 15 |
| I+D | 74624 / 31877 | 10 de 10 |
| CISA | 74613 / 31900 | 20 de 20 |
| CISA | 74889 / 31835 | 8 de 8 (con la UF del día en que se procesó) |
| PVS | 74489 / 31886 | 6 de 6 |
| PVS | 73974 / 31797 | 9 de 9 |
| SAMIC | 73951 / 31742 | 16 de 16 (con los valores manuales repuestos) |
| SAMIC | 73953 / 31799 | 15 de 15 (con los valores manuales repuestos) |

También coinciden los **totales en UF** y el **valor en pesos** de cada factura.

### 6.2 Facturas de 2025: diferencias explicadas

| Programa | Factura | Resultado | Explicación |
|---|---|---|---|
| PVA | 67830 | 16 de 16 | — |
| Screening | 67834 | 28 de 28 | — |
| CISA | 68571 | 24 de 24 | — |
| Servicios Diagnósticos | 68632 | 14 de 37 | precios especiales distintos |
| PVS | 68539 | 10 de 15 | tarifa distinta |
| SAMIC | 67901 | 5 de 11 | valores escritos a mano |
| I+D | 68017 | no concluyente | la primera corrida usó un rango que dejó fuera un caso, y la factura ya no se pudo repetir |

### 6.3 Por qué hubo diferencias, y por qué no son errores

1. **Las tarifas no guardan historial.** Las tablas de precio especial y de proyecto son las de hoy. Una factura de 2025 se compara contra precios de 2026 (ejemplo: técnica 212 de la empresa 20, **0,49 UF entonces, 0,55 hoy**; técnica 56: 0,372 entonces, 0,45 hoy). Las líneas cuyos precios no cambiaron sí coincidieron. Por eso **la verificación sirve con facturas del año en curso**.
2. **La UF del día.** El costo operativo (técnica 282) se calcula en pesos y se convierte a UF, así que depende de la UF de **cuando se procesó**, que no es la que queda en la factura al grabar el folio. En la 74889: con la UF del folio (41.237,01) una línea da 0,247 y con la del 15/10 (41.162,73) da 0,248, igual que ADLSOFT.
3. **Valores escritos a mano** (SAMIC y derivaciones a Aysén, con `valorizado='N'` y sin tarifa): se pierden al eliminar la factura, igual que en ADLSOFT (el código de la pantalla original deja la línea en 0 cuando no hay tarifa de SAMIC). Al volver a escribirlos con la función de línea manual, coincide.
4. **La jornada de Aquagen** se cobra **una vez por fecha de muestreo** entre los centros 7421 y 5610. Si el otro centro ya está facturado, la jornada cae en el siguiente caso; por eso hay que procesar juntas las facturas que ADLSOFT procesó juntas.
5. **Líneas pendientes agregadas después**: en la 74553 había 2 líneas de 0,3 UF (técnicas 24 y 25) que quedaron pendientes en el original; aparecen como «extra» y no cuentan.

## 6 bis. Operaciones que escriben, con datos reales (2026-11-10)

**Método:** sobre la copia local, con instantánea. Se prepararon 4 prefacturas reales hechas por ADL ONE (a partir de facturas de octubre ya emitidas: 3 de PVA y 1 de Servicios Diagnósticos con 5 casos) y sobre ellas se probó cada operación comprobando el estado de la base antes y después. Al terminar se devolvió la copia a su estado anterior y se comprobó que producción no cambió.

| Prueba | Qué se comprobó | Resultado |
|---|---|---|
| **T1. Eliminar una prefactura** | se borran encabezado, detalle, ingresos y descuentos; las líneas vuelven a ENVIADO, sin factura, UF 0 y no valorizadas; solo desaparece esa factura; eliminar de nuevo y sin ID falla con el mensaje de ADLSOFT | 7 de 7 |
| **T2. Cambiar la empresa** | falla sin motivo, sin empresa y con una factura inexistente; la factura y **todos sus casos** (también en el LIMS) pasan a la empresa nueva; queda registrado en la auditoría con el motivo | 8 de 8 |
| **T3. Graba Factura** | UF cero falla; sin folio graba UF, totales y pesos, pone la UF en todas las líneas y reemplaza los otros ingresos; con folio graba el número y la UF; grabar de nuevo una factura con folio falla | 8 de 8 |
| **T4. Eliminar por N.° de factura** | elimina la factura que lleva ese folio y libera sus líneas; un folio inexistente falla | 3 de 3 |
| **T5. Nota de crédito que anula** | la búsqueda por folio y fecha encuentra la factura; sin motivo y con monto cero falla; toma el número del contador y aumenta **los dos** contadores; la nota queda registrada (tipo 8, razón 1, no emitida, con su referencia); la factura anulada se borra y sus líneas vuelven a ENVIADO sin marca | 7 de 7 |
| **T6. Nota de crédito parcial por casos** | falla sin casos y con código 1; la nota tiene su **propio número**; es por la suma en UF de los casos elegidos; se liberan solo las líneas de esos casos; la factura original **no se modifica**; se guarda una copia en las columnas `*nc` | 8 de 8 |

**Total: 41 comprobaciones correctas, 0 con falla.**

**Observaciones (rarezas de ADLSOFT que se replican):**
- **Los pesos no se recalculan al grabar el folio.** Si entre el primer grabado (totales) y el folio cambia la UF, la factura queda con la UF nueva pero con los pesos calculados con la UF anterior (ejemplo de la prueba: UF 41.300 y luego 41.310; los pesos siguen en el valor de 41.300).
- Cambiar la empresa también cambia la empresa **del caso en el LIMS** (`muestras`), no solo la de la factura.
- La nota de crédito parcial deja la factura original intacta (H-85).

**Seguridad:** el script comprueba que el servidor sea `NTDMoraADLLOCAL` antes de escribir. Producción (solo lectura) antes y después: facturas 37.992, detalle 1.704.831, otras ventas 2.461 y contador de numeración 74.908, sin cambios; las 7 facturas de referencia, intactas. La copia local quedó como antes de la prueba (facturas 37.992, detalle 1.704.831, otras ventas 2.461, contador 74.908).

**Cómo repetirla:** `scripts/pruebas-salud/operaciones-escritura/probar-operaciones-escritura.mjs`, con la instantánea creada (ver la guía de la copia local) y devolviéndola al terminar.

## 7. Cómo repetir cada prueba

Los scripts están en `api-backend-adlone/scripts/pruebas-salud/`. Ver `copia-local-laboratorioadl.md` para la instantánea y la copia.

| Prueba | Script | Notas |
|---|---|---|
| Pruebas automáticas | `node --test src/services/facturacion-salud.*.test.js` | |
| Comparar PDF | `pdf/extraer-texto-pdf.mjs`, `extraer-alturas-pdf.mjs`, `extraer-lineas-pdf.mjs`, `verificar-pdf.mjs` | usan `pdfjs-dist` de `WebClientesV2/app/backend` |
| Leer un informe original de ADLSOFT | `pdf/leer-informe-frx.cjs <ruta sin extensión>` | `C:\Programa\LaboratorioADL\REPORTS\` |
| Comparar archivo plano de casos | `node archivo-plano/comparar-fe-casos.mjs <archivo real> <ids…>` | el orden de los ids debe ser el del nombre del archivo |
| Comparar archivo de otras ventas | `node archivo-plano/comparar-otras-ventas.mjs <archivo real> FEA <ids…>` | flujos `FEA`, `FEE`, `NCE`, `NDE` |
| Valorización | `node valorizacion/valorizacion-prueba.mjs 74477 73840+73838 … \| node valorizacion/resumir-resultados.cjs` | **solo con la instantánea creada**; variables `UF_OVERRIDE=<uf>` (UF del día de proceso), `REPLAY_MANUAL=1` (repone valores manuales) y `SALIDA=<carpeta>` |
| Foto de producción (solo lectura) | `produccion-solo-lectura/foto-produccion.cjs <salida.json>` | editar la lista de facturas dentro del script |

## 8. Lo que falta por comprobar

**Comparaciones que necesitan un original de ADLSOFT:**
- PDF: Screening **de proyecto** (no hay facturas así en la copia local), empresa con **dólares (500)**, Detalle con **2 o más centros** o de **varias hojas**, y Resumen con **todos los montos menores a 10 UF** o con USD. Folios candidatos: 32011 y 32000 (Resumen menor a 10 UF); 28920 y 28478 (dólares); 31844 (varios centros, su Resumen ya está comparado); 32012 y 31852 (varias hojas).
- Archivo plano: facturas con **dólares**, **exentas**, exportación (**FEE**), **nota de crédito (NCE)** y **nota de débito (NDE)**. ADLSOFT pide dónde guardarlos y los nombra `FE_Casos_…`, `FEE_…`, `NCE_…`, `NDE_…`.
- Nombre de archivo: confirmar con ADL la regla de H-92.

**Operaciones que escriben:** ya probadas con datos reales (sección 6 bis). Queda pendiente la **liberación y asociación de guías de despacho** con datos reales (la copia de `Abastecimiento` no tenía guías reservadas en esta prueba), las **notas de débito** y las **otras ventas** creadas desde cero.

**Valorización «en vivo»:** probar con casos pendientes del mes y comparar cuando el equipo facture en ADLSOFT (ver sección 4.3 de la guía de la copia local).

**Otros pendientes:** revisión visual de las pantallas con datos; decisiones abiertas del documento principal (sección de decisiones); un PDF para «Screening de proyecto» sin plantilla propia hasta tener un original.

## 8. Ensayo general con facturas ya emitidas (2026-11-11)

Procedimiento completo del lunes ensayado sobre la copia local con `scripts/pruebas-salud/comparacion/ensayo-general.sh`: instantánea → carga de las facturas de ADLSOFT desde producción (solo lectura, 11 s) → eliminar y rehacer en ADL ONE con los parámetros deducidos de la factura → comparación → restauración. Facturas: 74884 (programa 18, prefactura), 74887 + 74889 (empresa 6, programa 5, procesadas juntas) y 74891 (programa 4).

- El procedimiento funciona de punta a punta y emparejó las 4 facturas por empresa + casos (el número interno cambia: 74909, 74911, 74913, 74915).
- Valorización contra la factura original: 74884 18/18, 74891 15/15, 74887 23/28, 74889 7/8. Las diferencias de 74887/74889 son de redondeo del costo operativo (técnica 282), conocido: depende de la UF del día de proceso.
- **Hallazgo H-99 (pendiente de analizar):** la bandera `muestras_detalle.valorizado` al terminar el ciclo no coincide. En producción, ADLSOFT deja la factura 74884 con las 18 líneas en «N» y la 74891 con 10 en «N» y 5 en «S»; ADL ONE las deja en otro estado (los valores sí coinciden). Hay que entender cuándo ADLSOFT cambia esa bandera antes de decidir si ADL ONE debe replicarla. Parte puede ser artefacto de «eliminar y rehacer»; el lunes se verá partiendo de casos pendientes.
- Diferencias que son de parámetros, no de lógica: `fecha_proceso_ini/fin` (el ensayo usa un rango acotado a los casos; ADLSOFT usó 01/01/2022 hasta el día) y las filas de `facturacion_ocompra` (OC/HES que el ensayo no repite). El folio y «emitido» se esperan distintos en una prefactura.
- **Alcance:** las facturas de Medio Ambiente (programa 9) no se manejan en ADL ONE; el arnés solo mapea los programas de Salud.
- Los 14 índices candidatos estaban puestos en la copia al correr; un grupo de prueba falló igual con y sin ellos (causa: programa 9 sin mapeo, no los índices). Al terminar se quitaron los candidatos de la copia (hay que volver a crearlos antes del lunes: `indices-ddl.cjs C2`).

### 8.1 H-99 analizado: la bandera `valorizado` no es una diferencia de lógica (2026-11-11)

- **Quién la escribe:** en el flujo de facturación, ADLSOFT **no** la pone en «S» al valorizar (ver réplica, sección de valorización: ya no se escribe). Solo la pone en «N» al **eliminar** una factura («Elimina ID Facturación»). Ningún procedimiento de la base la modifica (solo un módulo la menciona, sin escribirla). La «S» llega con las líneas desde antes de facturar (la fija otra parte de ADLSOFT / el laboratorio); en producción hay 182.823 líneas FACTURADO en «S» y 81.368 en «N», mezcladas por programa y por técnica (p. ej. la 282 tiene 31.299 en «N» y 12.622 en «S»).
- **Por qué el ensayo mostró diferencias:** al eliminar la factura, las líneas pasan a «N» (igual que en ADLSOFT) y se pierde el valor original; luego el arnés vuelve a escribir en «S» las líneas con valor manual. Por eso 74884 (18 líneas siempre «N» en producción) quedó «S» en ADL ONE y las 5 «S» de 74891 quedaron «N». **Es un efecto de «eliminar y rehacer», no de la valorización ni de la prefactura.**
- **Qué esperar el lunes:** partiendo de casos pendientes, ni ADLSOFT ni ADL ONE tocan la bandera al valorizar ni al crear prefacturas, así que **debe quedar igual en ambos**; si el lunes aparece una diferencia en `valorizado`, sí sería un hallazgo real y se investiga. En el ensayo con facturas ya emitidas la columna se trata como «esperada».
