# Índices y rendimiento de la facturación de Salud (medición en la copia local)

Fecha: 2026-11-11. Todas las mediciones se hicieron en la **copia local** (`NTDMora\ADLLOCAL`), nunca en producción. Cada corrida usó instantáneas de las dos bases (LaboratorioADL y Abastecimiento), restauradas y eliminadas al terminar: los datos quedaron limpios.

## 1. Qué se midió

Una carga de trabajo fija (≈65 s) que repite lo que hace ADL ONE: (1) pantallas y listados ×3 vueltas, (2) elegibilidad de los 6 programas, (3) valorizar una empresa grande (Australis Mar, 95 casos, 280 líneas), (4) ciclo de una prefactura (eliminar, valorizar, crear), (5) operaciones sobre la factura (grabar totales y folio, PDF, nota de crédito parcial, eliminar). Se mide CPU de SQL Server y lecturas lógicas desde `sys.dm_exec_query_stats`. Scripts: `scripts/pruebas-salud/indices/`.

## 2. Resultados

| Configuración | CPU SQL | Lecturas lógicas |
|---|---|---|
| C0 · copia sin índices | 224 s | 52,2 M |
| C1f · los 181 índices que **ya tiene producción** | **29,6 s** | 1,53 M |
| C2f · C1f + candidatos de facturación | 33,1 s | 2,2 M |

(C1 y C2 parciales dieron 58,9 s y 30,9 s; la copia no era fiel a producción hasta crear los 181 índices.)

Por fase en C2f: listados ≈ 30,6 s de CPU; valorizar 2,1 s; ciclo de prefactura 159 ms (antes 538); operaciones por factura 12 ms (antes 562).

## 3. Conclusiones

1. **Producción ya tiene la mayoría de los índices útiles.** Con ellos, valorizar cuesta poco (2,1 s de CPU). El salto grande (224 s → 30 s) lo da tener los índices que producción ya tiene, no los nuevos.
2. **Los candidatos** (`id_facturacion` en `facturacion_det`, `muestras_detalle`, `facturacion_enc/otro/ing/des/oc/ocompra`, `gd_enc`, `gd_det`) bajan las operaciones por factura unas 30 a 40 veces (de 562 a 12 ms de CPU), pero son operaciones baratas en sí. **No cambian la CPU total de forma relevante.**
3. **Lo que realmente pesa son dos listados:** exportación (`fac_consulta_facturaelectronica_exporta`) y DTE. Cada llamada une `facturacion_enc` con `muestras_detalle` (1,5 M de filas) y `muestras`, agrupa con 40 columnas y **devuelve las 5.750 facturas históricas**, sin filtrar por «emitido» (solo 227 están sin emitir). ADL ONE filtra después en memoria (`filtrarLista`). Los candidatos no ayudan y a veces empeoran este plan.
4. **Arreglo propuesto (del lado de ADL ONE, no del LIMS):** consulta propia con `WHERE emitido <> 'S'` (y rango de fechas) aplicada **antes** de unir con `muestras_detalle`, y paginada. Así se revisan unas 227 facturas, no 5.750.
5. **No migrar** el índice `muestras (id_empresaservicio, id_programa, estado_caso)`. Cambió el plan de `fac_agrupaempresa_entrefechas_samic`, que empezó a fallar al convertir una fecha mal digitada. Los procedimientos de ADLSOFT dependen del orden de evaluación. **Antes de crear cualquier índice en el LIMS hay que probar todos los procedimientos de ADLSOFT.**

## 4. Decisión pendiente / siguiente paso

- Crear los listados propios de exportación y DTE y volver a medir (meta: bajar los ≈30 s de CPU de los listados a unos pocos segundos).
- Migrar al LIMS solo los índices de `id_facturacion` si, tras probar todos los procedimientos, no hay efectos; con aviso previo y reversión `DROP INDEX`.
- Reducir las 1.142 sentencias por empresa de la valorización (actualizar por caso/empresa, no por línea; leer una vez `fac_agrupaempresacasos_uno`).

## 5. Estado de la copia local

Quedan los 181 índices fieles a producción (`indices-fieles.cjs`); se quitaron los candidatos (`quitar-candidatos.cjs`). Nota para el refresco del sábado: las tablas pequeñas se reconstruyen por intercambio y pueden perder índices; las grandes los conservan. Conviene volver a correr `indices-fieles.cjs` después del refresco.

## 6. Listado propio de exportación y DTE (M-35, hecho el 2026-11-11)

- `src/services/facturacion-salud.listado-facturas.sql.js`: copia de `fac_consulta_facturaelectronica_exporta` con un `WHERE` inyectable antes de unir con `muestras_detalle`. `consultarListadoFacturasCasos` (en `facturacion-salud.exportacion.js`) pone el filtro de estado y, al exportar, `id_facturacion IN (…)`. Lo usan el listado de exportación, el listado DTE de casos (FEA_CASOS) y la exportación del archivo plano. Los otros flujos DTE (otras ventas, FEE, NCE, NDE) siguen con sus procedimientos.
- Comprobación (`indices/listados-comparar.mjs`, copia local): los 4 estados devuelven **exactamente las mismas filas** que el procedimiento original + filtro en memoria (227 / 5.523 / 0 / 5.750).
- Resultado en la pantalla por defecto («NO emitidos»): **≈105 ms de CPU y 277 ms** contra ≈4,7 s de CPU y 1,2–1,4 s del original. «Emitidos» y «Todos» cuestan igual que antes (no hay qué filtrar).
- Los 99 tests pasan. Si ADLSOFT cambia el procedimiento original hay que regenerar el archivo `.sql.js`.

## 7. ¿Los índices candidatos rompen algún procedimiento? (prueba del 2026-11-11, copia local)

**Estado real de producción (leído hoy del catálogo, solo lectura, servidor WS2016):** `facturacion_enc` solo tiene su clave primaria; `facturacion_det`, `_otro`, `_ing`, `_des`, `_oc` y `_ocompra` **no tienen ningún índice**; `muestras` tiene PK + 2 índices; `muestras_detalle` tiene 3 índices y ninguna PK. La copia local replica exactamente eso (compatibilidad 100, igual que producción).

**Método** (`indices/probar-sp-con-indices.cjs` + `comparar-sp.cjs`): se ejecutan los **788 procedimientos** de LaboratorioADL con parámetros de ejemplo, cada uno dentro de una transacción que se deshace, antes (A) y después (B) de crear los candidatos (14 índices: `id_facturacion` en `facturacion_det/otro/ing/des/oc/ocompra`, `muestras_detalle`, `facturacion_enc`, `gd_enc`, `gd_det`). Se compara un hash de las filas ordenadas, o el mensaje de error. La base quedó intacta en ambas corridas.

| Resultado | Cantidad |
|---|---|
| Procedimientos ejecutados | 788 |
| Con datos en A | 363 |
| **Idénticos en A y B** | **731** |
| Resultado distinto | 1 (falso positivo, ver abajo) |
| Error en A que desaparece en B | 56 |
| Error nuevo en B | **0** |
| Tiempo total | A 73 s, B 58 s |

- **El único «distinto»** (`consulta_est_nanalisis_2015`, 257.407 filas): al volcar las filas en cada estado y compararlas una por una hay **0 diferencias**; fue un artefacto del cálculo del hash.
- **Los 56 con error en A** (`fac_prever_programa_*`, `fac_agrupaempresacasos_entrefechas_*_porfacturar`) fallan en la copia sin candidatos por «conversión de varchar a datetime fuera de rango»: hay 29.022 casos con `fecha_informe` que no es fecha y esos procedimientos convierten **antes** de filtrar por empresa. Con los índices el plan filtra primero y no fallan (devuelven 0 filas con mis parámetros). **Esto no demuestra que estén bien**: con mis parámetros no hay comparación posible. No son los que usa ADL ONE (su valorización pasa en ambos estados).
- **Pruebas funcionales con los candidatos puestos:** operaciones que escriben 41/41 y guías/notas de débito/otras ventas 37/37 (cada una con instantánea y restauración).

**Qué no cubre esta prueba:** (1) procedimientos con parámetros reales distintos a los de ejemplo; (2) el comportamiento del optimizador de SQL Server 2017 de producción frente al de la copia (SQL 2025 en compatibilidad 100); (3) las consultas que ADLSOFT escribe como texto desde la aplicación (no están en la base). Por eso, antes de crearlos en el LIMS: crearlos primero fuera de horario, con el equipo de ADLSOFT probando sus pantallas de facturación y un `DROP INDEX` listo.

**Conclusión:** ningún procedimiento cambia de resultado ni empieza a fallar con los 14 candidatos. El único índice que rompió algo es el de `muestras (id_empresaservicio, id_programa, estado_caso)`, ya descartado.
