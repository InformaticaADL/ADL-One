# Plan de la prueba en paralelo del lunes 16/11/2026

Objetivo: el lunes 16/11/2026, a las 9:00, el equipo **crea prefacturas** en ADLSOFT (producción). **Con el mismo estado de casos**, se crean las mismas prefacturas desde ADL ONE sobre la copia local, y se compara todo: valorización, prefacturas (líneas, totales y números internos) y PDF.

**Alcance del lunes: solo hasta la prefactura.** No se asigna folio (no se usa «Graba Factura») y no se exporta archivo plano. Por eso el folio, el archivo para el emisor y la marca de «emitido» **no forman parte de esta prueba** y siguen pendientes para una prueba posterior (ver sección 8). Los PDF «Resumen» y «Detalle» salen de la prefactura y sí se comparan; saldrán con «Factura N° : 0», como los de ADLSOFT antes del folio.

ADLSOFT sigue siendo la fuente de verdad. ADL ONE trabaja «en sombra»: **nada de ADL ONE llega a producción.**

Última actualización: 2026-11-10.

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Ingreso de casos y datos | Sigue en ADLSOFT. ADL ONE solo factura Salud. |
| Desactivar la facturación de Salud en ADLSOFT | **No por ahora.** Antes hay que hacer **muchas pruebas**: es dinero de una empresa y un error puede costar caro. |
| Índices en el LIMS | Se aprueba **migrarlos también**: primero se prueban en la copia local, se miden y, si ayudan, se llevan al LIMS (con aviso previo y plan de reversión `DROP INDEX`). |
| API del emisor de facturas | Existe y se integrará **en el futuro** (incluida ingeniería inversa si hace falta). Por ahora, archivo plano. |
| Datos para la prueba | Traer a la copia local todo lo nuevo hasta el **sábado 14/11**, y un último ajuste el lunes antes de las 9:00. |

## 2. Cronología

| Cuándo | Qué | Quién |
|---|---|---|
| Esta semana (hasta el jueves 12) | Pruebas de las operaciones que escriben (grabar folio, notas de crédito, cambiar empresa, eliminar), con instantánea. Preparar la planilla de captura (sección 4). Medir las mejoras de rendimiento e índices en la copia local. | Claude, con tu revisión |
| Viernes 13 | Ensayo general del procedimiento completo con 1 o 2 empresas (refresco, valorizar, comparar). | Claude y tú |
| **Sábado 14** | **Refresco incremental** de la copia local (2 a 3 minutos). Verificación contra producción. Instantánea «antes del lunes». Foto de producción. | Claude |
| **Lunes 16, 8:30 a 8:50** | **Segundo refresco incremental** (para incluir los casos que entraron el fin de semana y en la mañana). Nueva verificación. Foto de producción. | Claude |
| **Lunes 16, desde las 9:00** | El equipo factura en ADLSOFT. En paralelo, se repite lo mismo en ADL ONE (copia local) con los mismos parámetros. | Equipo de facturación y tú |
| Lunes 16, al terminar | Se leen de producción (solo lectura) las facturas nuevas de ADLSOFT y se comparan con las de ADL ONE. | Claude |
| Martes 17 | Informe de resultados y registro en `facturacion-salud-pruebas-y-resultados.md`. | Claude |

**Por qué dos refrescos:** la facturación a las 9:00 usa los casos pendientes de ese momento. Los casos que ingresen entre el sábado y el lunes cambiarían el resultado. El refresco del lunes antes de las 9:00 deja ambos sistemas con los mismos datos de partida.

## 3. Cómo se hace el refresco

Script nuevo: `api-backend-adlone/scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs`. Detalle en `copia-local-laboratorioadl.md`.

```
node scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs "<contraseña sa local>" --solo-ver     # solo muestra qué traería
node scripts/pruebas-salud/copia-local/actualizar-copia-local.cjs "<contraseña sa local>"               # actualiza
```

Probado el 10/11: **143 segundos** para traer 54 casos nuevos, 1.863 casos antiguos con líneas pendientes y los cambios de facturas. Termina comparando producción contra la copia: **las 11 comparaciones dieron «igual»** (casos, líneas, líneas pendientes, líneas facturadas, casos finales, facturas, facturas emitidas, detalle, otras ventas y los dos contadores de numeración). Solo lee producción (`SELECT` con `MAXDOP 1`) y se aborta si el destino no es la copia local de esta máquina.

**Antes del refresco del lunes:** crear la instantánea del sábado (para poder volver atrás), y comprobar que nadie haya usado la copia local ese fin de semana.

## 4. Qué hay que registrar durante la facturación del lunes

Para repetir exactamente lo que hace ADLSOFT necesito los **parámetros de cada corrida**. Lo ideal es que quien factura los anote o les saque captura de pantalla:

| Dato | Dónde se ve |
|---|---|
| Programa (PVA, Screening, SDiag-ATV, I+D, CISA/PVS/SRS, SAMIC…) y, si aplica, «ensilaje» o «PROA» | pantalla Procesar |
| Empresa | pantalla Procesar |
| Rango de fechas de datos a procesar | pantalla Procesar |
| **Valor de la UF** (y del dólar si corresponde) que escribieron | pantalla Procesar |
| Hora aproximada de cada corrida | (para ordenar) |
| Valores que escribieron **a mano** en una línea (SAMIC, derivaciones) | pantalla de valorización |
| Criterio de agrupación (Na, Centro, Veterinario…) | creación de prefacturas |
| Fecha de facturación, forma de pago, glosa, mes, observaciones, nota | creación de prefacturas |
| OC y HES, si las escriben al crear la prefactura | creación de prefacturas |
| **El orden** en que crean las prefacturas (empresa por empresa) y el número interno de cada una | pantalla de prefacturas |
| Si eliminaron o rehicieron alguna prefactura (anotar el motivo) | pantalla de prefacturas |
| Los PDF «Resumen» y «Detalle» que generen | carpeta donde los guardan |

Se puede hacer de dos maneras: que alguien del equipo llene una planilla durante la mañana, o que yo lea después de producción las facturas nuevas y deduzca los parámetros (rango, UF, criterio) a partir de ellas. Lo segundo funciona para casi todo, pero **no** recupera los valores escritos a mano ni las corridas que se eliminaron; por eso conviene que los anoten.

## 5. Cómo se compara

1. **Facturas de ADLSOFT:** después de las 9:00, se leen de producción (solo lectura) las facturas nuevas (`id_facturacion` mayor a 74908), su detalle y las líneas de sus casos, y se cargan en una base de comparación aparte en la instancia local (`LaboratorioADL_comparacion`). **No se mezclan con la copia**, porque la numeración de las facturas de ADL ONE empieza en el mismo número que la de producción.
2. **Facturas de ADL ONE:** se crean en la copia local con los mismos parámetros.
3. **Comparación por factura:** empresa, programa, casos, y **cada línea** (caso, ítem, valor), total en UF y total en pesos. Se informa cada diferencia con su causa probable (UF, valor manual, orden de proceso de la jornada, tarifa).
4. **PDF:** el «Resumen» y el «Detalle» de las prefacturas de ADLSOFT contra los de ADL ONE (método de `facturacion-salud-pruebas-y-resultados.md`, sección 4). Sin folio, como los de antes de «Graba Factura».
5. **Estado de los casos:** que las líneas facturadas y las que quedan pendientes sean las mismas en ambos sistemas.

Scripts que ya existen: comparación de PDF y de archivo plano, valorización con comparación línea por línea, foto de producción. **Falta construir** (esta semana): la carga de las facturas de ADLSOFT a la base de comparación y el informe de diferencias.

## 6. Qué puede salir distinto, y qué mirar

Lo que ya aprendimos que cambia el resultado (ver `facturacion-salud-pruebas-y-resultados.md`, sección 6.3):

1. **El número interno de cada prefactura:** coincide **solo si** se crean en el mismo orden y nadie más consume números del contador compartido (otras ventas, notas de crédito, Medio Ambiente). Si no coincide, se compara por contenido (empresa y casos); no es un error.
2. **La UF que escribieron** en la pantalla (afecta al costo operativo).
3. **Valores escritos a mano** (SAMIC y derivaciones a Aysén): no se pueden deducir.
4. **El orden de proceso de la jornada de Aquagen**: se cobra una vez por fecha entre dos centros; si el equipo procesa las facturas por separado o juntas, cambia en qué caso cae.
5. **Líneas pendientes agregadas después** a un caso.
6. **Cambios de tarifas** ese mismo día: si alguien toca las tablas de precios, hay que anotarlo.
7. **Casos que cambian de estado** entre el refresco y las 9:00 (por eso el segundo refresco).

## 7. Reglas de seguridad durante la prueba

- ADL ONE **solo escribe en la copia local**: el módulo rechaza cualquier otro servidor.
- Producción solo se **lee**, antes y después, para comprobar que no cambió nada que ADL ONE pudiera tocar.
- El equipo factura en ADLSOFT **exactamente como siempre**; la prueba no debe cambiar su forma de trabajar ni retrasar nada.
- Si algo sale distinto, **se investiga y se documenta, no se «arregla» para que coincida** sin entender la causa.

## 8. Criterios para avanzar hacia producción (propuesta)

Para que ADL ONE pase de «en sombra» a facturar de verdad, sugiero exigir como mínimo:

1. **Varios cierres de mes consecutivos** (por ejemplo, tres) con **100 % de coincidencia** en totales por factura (UF y pesos), líneas, PDF y archivo plano, o con cada diferencia explicada y aceptada.
2. Pruebas con datos reales de todas las operaciones que escriben (grabar folio, notas de crédito, cambiar empresa, eliminar).
3. Las mejoras de rendimiento hechas (valorización por lotes, proceso en segundo plano con pausas y límite de CPU) y medidas contra ADLSOFT, para no volver a ralentizar a los demás usuarios.
4. Entrada gradual: primero un programa o unas pocas empresas, con **doble revisión** de cada factura por una persona, y ADLSOFT disponible como respaldo.
5. Respaldo antes de cada cierre y plan de reversión escrito.
6. Recién entonces, evaluar desactivar la facturación de Salud en ADLSOFT.

## 9. Lo que necesito de ti

- Confirmar que el **sábado 14/11** y el **lunes 16/11 a las 8:30** me avisarás para correr los refrescos (yo no los ejecuto solo).
- Quién del equipo anotará los parámetros de cada corrida del lunes, o permiso para pedirles una captura de pantalla de cada paso.
- Qué empresas y programas piensan facturar el lunes, si ya lo saben, para ensayar con ellos el viernes.
- Si los otros programas de Salud (Screening de proyecto, empresa de dólares) se facturarán ese día, para tener al menos un PDF y un archivo plano reales de esos casos.

## 10. Lo que NO se prueba el lunes (queda para una prueba posterior)
Como el lunes solo se crean prefacturas, estas partes del flujo quedan pendientes y se probarán después, también con datos reales y en paralelo:
- **Grabar el folio, notas de crédito, cambio de empresa y eliminación** ya se probaron el 10/11 con datos reales sobre la copia (41 de 41 comprobaciones, ver el documento de pruebas); falta compararlas **en paralelo** con lo que haga el equipo en ADLSOFT.
- **El archivo plano para el emisor** y la marca de «emitido», en paralelo con ADLSOFT.
- **La asociación de guías de despacho** con datos reales y las **notas de débito**.
- **La integración con la API del emisor**, que es una etapa futura.

## 11. Aclaración del 2026-11-11
- Los parámetros (empresas, programas, UF, orden) **se sabrán recién el lunes**. Se reconstruirán después leyendo de producción (solo lectura) las prefacturas nuevas; no se recuperan los valores manuales ni las corridas eliminadas.
- El lunes puede haber **prefacturas y también archivos planos**. Si se exportan, ADLSOFT habrá asignado folio y marcado «emitido»: en la copia se asignarán los mismos folios y se exportará para comparar. Pedir al equipo que guarde los archivos planos y los PDF reales en una carpeta aparte, sin sobrescribir.
- El ensayo del viernes 13 se hace con facturas ya emitidas de otras fechas.
- La valorización por lotes y la migración de índices al LIMS se hacen **después** de la comparación del lunes.

## 12. Herramienta de comparación lista (2026-11-11)
La carga de las facturas de ADLSOFT y el informe de diferencias ya existen: `api-backend-adlone/scripts/pruebas-salud/comparacion/` (ver su `LEEME.md`). Probados con la copia contra sí misma, con daños provocados y con una carga real de producción (solo lectura).

## 13. Script de reproducción listo (2026-11-11)
`scripts/pruebas-salud/comparacion/reproducir-corrida.mjs`: lee las facturas de ADLSOFT cargadas en la base de comparación, las agrupa en corridas (misma empresa, programa, UF y rango de proceso), y en la copia local valoriza y crea las prefacturas (una por cada factura de ADLSOFT, con sus casos, OC/HES y datos de cabecera), en el orden de ADLSOFT. **No elimina nada.** Sin `--ejecutar` solo muestra el plan y avisa de problemas (programa sin mapeo, líneas ya facturadas, sin pendientes). Opciones: `--manuales-auto` (deduce los valores a mano de lo que ADLSOFT dejó guardado), `--manuales=archivo.json`, `--uf=`, `--solo=`. Ensayo: `ensayo-reproducir.sh`.

**Resultado del ensayo (facturas ya emitidas 74884, 74887, 74889, 74891):** SAMIC coincide por completo con `--manuales-auto`; la empresa 6 sale en dos prefacturas como en ADLSOFT; quedan solo diferencias de redondeo en la técnica 282 (costo operativo, 0,001 UF) porque al grabar el folio ADLSOFT reemplaza la UF de la factura: con prefacturas (el lunes) la UF guardada es la usada al valorizar, así que esa diferencia no debería aparecer.
