# Facturación Salud en ADL ONE: réplica de ADLSOFT

Documento vivo. Registra qué hace ADLSOFT (Visual FoxPro) en la facturación de los programas de laboratorio, qué ya está replicado en ADL ONE, lo raro que se encontró, las diferencias deliberadas y las mejoras que se proponen. Última actualización: 2026-11-10 (bloque 6 y pantallas).

**Regla de trabajo acordada:** primero se replica ADLSOFT tal cual; después se decide qué cambiar, mejorar o automatizar. Por eso cada diferencia con ADLSOFT queda anotada aquí con un código (D-xx), y lo que se considera defecto de ADLSOFT con otro (H-xx). Las mejoras son propuestas (M-xx), no están implementadas.

**Reglas de seguridad vigentes**
- El código solo se escribe y se prueba en lectura. Nada se ejecuta contra datos reales: el servicio de Facturación Salud se conecta únicamente a `localhost` (ver `config/databaseSalud.js`), y las pruebas de escritura se harán sobre una copia de LaboratorioADL.
- Las pruebas unitarias usan un doble de la base de datos; no abren conexión.

---

## 1. Mapa ADLSOFT ↔ ADL ONE

| Pantalla de ADLSOFT (`C:\programa\laboratorioadl\FORMS`) | Qué hace | En ADL ONE |
|---|---|---|
| `fac_prefacturacion_new_v6` | Elegir programa y rango, procesar, valorizar casos, crear pre-facturas | `facturacion-salud.service.js` (`getEmpresasConCasosElegibles`, `getCasosElegiblesPorEmpresa`, `valorizarCasosSalud`, `previsualizarPrefacturasSalud`, `crearPrefacturasSalud`) |
| `fac_unaempresa_v4` | Previsualizar y crear las facturas de una empresa ("Facturar") | `previsualizarPrefacturasSalud`, `crearPrefacturasSalud` |
| `fac_facturacreada_oi_od` | Otros ingresos / descuentos de las facturas recién creadas | `facturacion-salud.mantencion.js` → `grabarOtrosIngresosDescuentos` |
| `fac_ocompra_factura` | Órdenes de compra asociadas (tabla `facturacion_oc`) | `mantencion.js` → `listarOcAsociadas`, `agregarOc`, `eliminarOc` |
| `fac_elimina_reprocesa_v2` | Eliminar factura (por número o por ID) | `mantencion.js` → `eliminarFacturaPorId`, `eliminarFacturaPorNumero` |
| `fac_cambiaempresafacturar_v1` | Cambiar la empresa a facturar | `mantencion.js` → `cambiarEmpresaFactura` |
| `fac_electronica_modifica_exportatxt_v2` | Datos previos a exportar (OC/HES libres, glosa, forma de pago) | `facturacion-salud.exportacion.js` → `grabarFechaFacturacion`, `grabarFormaPago`, `grabarGlosa*`, `grabarMes`, `grabarNota`, `agregarOcHes`, `modificarOcHes`, `eliminarOcHes`. El colega dejó `actualizarDatosPrefactura` (ver H-57); no es réplica. |
| `fac_electronica_exportatxt_v2` | Archivo plano de 35 columnas, marca `emitido='S'` | `exportacion.js` → `listarFacturasParaExportar`, `exportarFacturasCasos`, `csvFoxPro` |
| `fac_consulta_una_factura_v4` | "Graba Factura": N° de factura, OI/OD, guías, PDF/Excel | `facturacion-salud.consulta.js` → `consultarFacturaPorId/Folio`, `grabarFactura`, `datosExcelResumen/Detalle` |
| `fac_guiasclientes` | Guías de despacho a clientes que se cobran como otro ingreso | `consulta.js` → `listarGuiasPendientes`, `calcularNetoGuias`, `reservarGuias`, `asociarGuias`, `liberarGuiasDeFactura` |
| `fac_otrasventas_v2` | Otras ventas, notas de crédito y de débito (tabla `facturacion_otro`) | `facturacion-salud.otrasventas.js` → `crearDocumento`, `buscarFacturaReferencia`, mantención (`asignarNumeroDocumento`, `cambiarUfDocumento`…) |
| `fac_electronica_exportatxt_afecta_otro_v2`, `_exenta`, `_nc`, `_nd` | Archivos planos de otras ventas (FE, FEE, NCE, NDE) | `otrasventas.js` → `listarParaExportar`, `exportarDocumentos`, `filasDteDocumento` |
| `fac_otroscobros`, `fac_reversa_nc_casos` | Versión antigua con nota de crédito parcial por casos | `otrasventas.js` → `listarCasosDeFactura`, `crearNotaCreditoPorCasos` (misma lógica, sobre la estructura actual; ver H-82 y H-85) |

Los extractos de las pantallas y de los procedimientos almacenados usados para este análisis no están en el repositorio.

### Tablas (LaboratorioADL, salvo que se indique)

| Tabla | Filas hoy | Contenido |
|---|---|---|
| `facturacion_enc` | 37.992 | Encabezado de cada factura interna (`id_facturacion`). Solo tiene la clave primaria; `factura` (el N° de folio) no es único ni tiene índice. |
| `facturacion_det` | 1.704.838 | Detalle (caso, ítem, total). **Sin ningún índice.** |
| `facturacion_ing` / `facturacion_des` | 1.759 / 866 | Otros ingresos / descuentos. Sin índices. |
| `facturacion_oc` | 1.481 | Órdenes de compra *con valor y moneda*. Es la que edita `fac_ocompra_factura`. |
| `facturacion_ocompra` | 38.535 | OC/HES *de texto libre* (`ocompra`, `referencia`, `tipo`, `orden`). Se escribe al crear las facturas. |
| `muestras_detalle` | – | Líneas de cada caso; llevan `id_facturacion`, `vtaunitario`, `n_analisis`, `vtatotal`, `uf`, `usd`, `mf`, `valorizado`. |
| `auditoria` | – | Registro que usa `actualiza_auditoria`. |
| `Abastecimiento.dbo.gd_enc` | – | Guías de despacho; se liberan al eliminar una factura por ID. Está en **otra base** (Abastecimiento). |

Valores especiales de `muestras_detalle.id_facturacion` encontrados: `0` = sin facturar; `9999999998` (12.318 líneas) y `9999999999` (7 líneas) = marcas que no corresponden a ninguna factura (todas en cero, estado ENVIADO). No se encontró en las pantallas quién las asigna; ver H-30.

---

## 2. Flujo de punta a punta (como lo hace ADLSOFT)

1. **Elegir programa y fechas.** El rango "Fecha datos a procesar" filtra por `muestras.fecha_informe`. La "Fecha informe cliente" solo se guarda en el encabezado. UF obligatoria (y USD para la empresa 500, Benchmark Genetics).
2. **Procesar:** lista las empresas con casos por facturar, según el procedimiento del programa.
3. **Valorizar** (doble clic en la empresa): por cada caso se calcula precio y cantidad de cada línea, y se guarda en `muestras_detalle` (`vtaunitario`, `n_analisis`, `vtatotal`, `uf`, `usd`, `mf = 1`). Luego se agregan los costos operacionales, jornadas y costos fijos.
4. **Facturar** (`fac_unaempresa_v4`): previsualiza y crea una `facturacion_enc` por cada grupo (centro, veterinario, tipo de agua…); las líneas pasan a `mf = 3` y estado FACTURADO.
5. **Otros ingresos/descuentos** y **OC asociadas**.
6. **Archivo plano** para el emisor electrónico (marca `emitido = 'S'`).
7. **N° de factura:** la persona lo **teclea** en "Consulta una factura" (no viene de ningún sistema) y "Graba Factura" lo guarda en `facturacion_enc.factura`; ahí mismo se fijan los totales, la UF y las guías de despacho. (El Sistema de Ventas con su numeración compartida pertenece a "otras ventas", bloque 6.)

---

## 3. Estado de la réplica

| Bloque | Contenido | Estado |
|---|---|---|
| 1 | Elegibilidad por programa, rango por fecha de informe, previsualización, creación de facturas en transacción | Hecho, con pruebas |
| 2 / 2c | Valorización: precio por programa, lista de la empresa, proyecto, derivaciones, cantidades por tipo de cobro, cierre multiplex | Hecho, con pruebas (49 en total junto con los demás bloques) |
| 2d | Costo operativo (técnica 282), jornada AquaGen (955), costo fijo Mowi | Hecho, verificado solo en lectura |
| 3 | Mantención de facturas creadas: eliminar, cambiar empresa, OC, otros ingresos/descuentos | Hecho en el servidor (código y pruebas con doble). **Falta la pantalla** y probar contra la copia de la base. |
| 4 | Datos previos a exportar y archivo plano de las facturas de casos | Hecho en el servidor (62 pruebas en total); formato leído de la estructura real del cursor de FoxPro. **Falta la pantalla**, comparar el archivo con uno real de ADLSOFT y probar contra la copia. Los otros archivos (otras ventas, exenta, NC, ND) van en el bloque 6. |
| 5 | Consulta de factura, "Graba Factura", guías de despacho, datos de los Excel y PDF «Resumen» | Hecho en el servidor (76 pruebas en total; lectura verificada contra la base real). **Faltan** la pantalla, los PDF (plantillas `.frx` de ADLSOFT: ver decisión 12) y probar contra la copia. |
| 6 | Otras ventas, notas de crédito/débito y sus archivos planos | Hecho en el servidor (89 pruebas en total; lectura verificada contra la base real). La nota de crédito parcial por casos **sí se implementó** (decisión 16). |
| Pantallas | Las cinco vistas del módulo (sección 10) | Hechas; compilan y pasan el análisis de código. **No se probaron con datos** (no hay base local con LaboratorioADL todavía) ni se revisaron a ojo en el navegador. |

### Endpoints nuevos del bloque 3

| Método y ruta | Acción |
|---|---|
| `DELETE /api/.../prefacturas/:id` | Eliminar por ID de facturación (libera líneas y guías) |
| `DELETE /api/.../facturas/numero/:factura` | Eliminar por N° de factura (solo la primera factura interna; no libera guías) |
| `PUT /prefacturas/:id/empresa` | Cambiar empresa (`id_empresaservicio`, `motivo` obligatorio) |
| `GET/POST /prefacturas/:id/ordenes-compra-oc` | Listar / agregar OC con valor y moneda |
| `POST /prefacturas/:id/ordenes-compra-oc/eliminar` | Eliminar una OC (se identifica por todos sus campos) |
| `POST /prefacturas/otros-ing-des/grabar` | "Graba" de otros ingresos/descuentos de las facturas en creación |

### Endpoints nuevos del bloque 4

| Método y ruta | Acción |
|---|---|
| `GET /dte/casos/facturas?estado=` | Facturas para exportar. `estado`: `NO emitidos` (por defecto), `Emitidos`, `Eliminado`, `Todos` |
| `POST /dte/casos/exportar` | `{ ids_facturacion }` → arma el archivo, marca `emitido = 'S'` y devuelve nombre, texto y el archivo en base64 (Windows-1252) |
| `PUT /prefacturas/:id/exportacion/:accion` | Datos previos. `accion`: `fecha`, `forma-pago`, `nota`, `glosa-libre`, `glosa`, `mes` |
| `POST/PUT /prefacturas/:id/exportacion-oc-hes` | Agregar (`oc`, `hes`) / modificar (`ocompra`, `tipo`, `fecha`, `referencia`) la OC o HES libre |
| `POST /prefacturas/:id/exportacion-oc-hes/eliminar` | Eliminar por número de OC/HES |
| `GET /dte/casos/ordenes-compra/buscar?ocompra=` | Dónde más se usó ese número de OC |

---

## 4. Reglas de negocio (resumen de lo replicado)

### 4.1 Valorización
- **Columna de precio de la lista** según la lista de la empresa: Precio lista → `precio_lista`; convenio → `precio_lista_menos`; ADL → `precio_lista_adl`; recargo → `precio_lista_mas`. Con cualquier otra lista el caso no se valoriza.
- **Programa del caso** (`id_programa`) decide la fuente del precio: PVA (tipo de lista general o por centro, agua dulce o mar), Screening (simple o multiplex, individual o pool, con o sin apertura), CISA/SRS (general o por centro), Salmón Chile, Servicio Diagnóstico (ensilaje, PROA, pack, precio especial o lista), I+D / Laboratorio / Caligus (especial o lista), ATV (lista), Medio Ambiente y SAMIC (tarifas propias).
- **Casos de proyecto** (programas Servicio Diagnóstico e I+D con proyecto): todas las líneas con la tarifa del proyecto; sin tarifa vale 0 y **no** cae a la lista.
- **Derivaciones y secciones 10/13**: no se revalorizan. Con valor previo entran a la factura; sin él quedan fuera (`mf = 0`).
- **Cantidad según tipo de cobro**: 0 NA, 1 pez, 2 muestra, 3 cada uno, 4 pool, 5 tejido, 6 placa y medio, 7 aislado, 8 identificación, 12 rango (ATBPlex).
- **Excepciones fijas**: técnicas 316/317 siempre cantidad 1; técnicas "RT-PCR-ELF…" usan la tarifa de la técnica 193; excepción de viabilidad.
- **Cierre**: líneas multiplex 958/959 completadas, totales por línea, `mf = 1` para las ya valorizadas, `uf_totalfac` del caso. Ya **no** se escribe `valorizado = 'S'` ni `uf_totalcaso` (lo agregó el colega y ADLSOFT no lo hace).

### 4.2 Costos agregados después de valorizar (bloque 2d)
- **Costo operativo (282)**: Screening = crotales del caso × tarifa 282 (pool; si es 0, individual); con apertura no se agrega. Resto de programas (menos Caligus) = costo de la planilla de terreno ATV (km × factor, peajes, transbordador, taxi, pasaje, colación, alojamiento convertidos a UF, más extra y veterinario), repartido entre los casos de la misma visita.
- **Jornada AquaGen** (empresa 56, Screening): una por fecha en los centros 7421 y 5610; una por fecha y centro en los demás; se cobra en el primer caso del grupo.
- **Costo fijo Mowi** (empresa 383): costo fijo del centro más veterinario, o la planilla si el centro tiene `pm_ingreso = 'S'`, repartido entre los casos de la visita.
- Con ensilaje marcado no se agrega costo operativo.

### 4.3 Mantención de facturas creadas (bloque 3)
- **Eliminar por ID**: líneas → estado ENVIADO, `id_facturacion = 0`, `uf = 0`, `valorizado = 'N'`; borra `facturacion_enc/_det/_des/_ing`; deja las guías de `Abastecimiento.gd_enc` en Pendiente (sin factura, sin fecha, marca 0, uf 0). No toca las OC.
- **Eliminar por número**: igual pero sin guías y solo la primera factura interna con ese número.
- **Cambiar empresa**: cambia `facturacion_enc.id_empresaservicio` y la empresa de **todos los casos** de la factura en `muestras` (es decir, la empresa del caso en el LIMS). Motivo obligatorio.
- **OC (`facturacion_oc`)**: número, fecha, moneda (`$`, `U.F.`, `U$`), valor y conversión. En pesos la conversión es el mismo valor; en otra moneda se escribe el monto en pesos. Agregar audita; eliminar se identifica por todos los campos.
- **Otros ingresos/descuentos**: total de la factura (UF) = total de casos + ingresos − descuentos; actualiza el encabezado y guarda las filas. Sin conceptos inserta una fila en cero.

### 4.4 Datos previos a exportar y archivo plano (bloque 4)
- **Datos previos** (cada botón graba un solo dato en `facturacion_enc`): fecha de facturación, forma de pago, nota, glosa (libre, o del maestro + mes) y mes/año. La glosa armada por la pantalla es `<glosa>, <mes>` (y `, <observaciones>` si se escriben; las observaciones no se guardan en ninguna parte). Los maestros se filtran por tipo de documento (glosas del tipo 1 = factura de casos).
- **OC y HES libres** (`facturacion_ocompra`): OC con orden 1 y HES con orden 2; solo se guardan si traen número, con referencia opcional. Modificar cambia fecha y referencia; eliminar borra por número. El campo de OC permite ver en qué otras facturas se usó el mismo número.
- **Listado**: procedimiento `fac_consulta_facturaelectronica_exporta`, una fila por factura y área de negocio. Filtros de la pantalla: NO emitidos (por defecto), Emitidos, Eliminado, Todos.
- **Archivo** (`FE_Casos_<id>_<id>….TXT`): CSV con encabezado y 35 columnas, textos entre comillas, números enteros sin formato, fechas dd/mm/aaaa sin comillas (fecha vacía = `/  /`), en la página de códigos de Windows. Una fila principal por factura (`n_td = "FE"`, cantidad 1, tipo de servicio "ADL") y, si la factura tiene OC o HES, una fila más por cada una (cantidad 0, neto 0, con tipo, número, fecha y referencia).
- **Montos** (todo se guarda como entero): *con OC*, la fila principal usa neto = ROUND(ROUND(UF_total, 2) × UF, 0) y total = ROUND(neto × 1,19, 0); las filas de OC usan ROUND(UF_total × UF × 1,19, 1). *Sin OC*, neto = ROUND(UF_total × UF, 1) y total = ROUND(UF_total × UF × 1,19, 1). El valor con decimal se vuelve a redondear al entrar al campo entero.
- **Largos de campo** (se cortan en silencio): n_td 20, oficina/banco/clase/tipo servicio/oficargo/proyecto 30, documento/ocompra/tipo_ref/num_ref 20, detalle y motivo 150, RUT 10, nombre/direcciones/giro 100, ciudad/comuna/forma de pago 40, nota 250.
- Cada factura exportada queda con `emitido = 'S'`.

### Endpoints nuevos del bloque 5

| Método y ruta | Acción |
|---|---|
| `GET /facturas/consulta?id_facturacion=` o `?factura=` | Ficha de la factura: encabezado, otros ingresos/descuentos, detalle, OC, título para los PDF, indicadores (con N° de factura no es editable; empresa 500 lleva dólar) |
| `POST /prefacturas/:id/grabar` | "Graba Factura": `{ factura, uf, ingresos, descuentos }`. `factura = 0` graba totales y UF; `factura > 0` graba el número |
| `GET /guias/pendientes?id_empresaservicio=` | Guías de despacho pendientes de la empresa |
| `POST /guias/neto` | `{ ids_gd, uf }` → neto en UF (no escribe) |
| `POST /prefacturas/:id/guias/reservar` | Reserva las guías y devuelve la línea de otros ingresos (concepto 4) |
| `POST /prefacturas/:id/guias/liberar` | Deja pendientes todas las guías de la factura |
| `GET /prefacturas/:id/datos-resumen`, `/datos-detalle?lote=true` | Columnas y filas de los Excel (el archivo lo arma quien llame) |

### Endpoints nuevos del bloque 6

| Método y ruta | Acción |
|---|---|
| `GET /otras-ventas?estado=` | Documentos de otras ventas (NO emitidos por defecto, Emitidos o Todos) |
| `GET /otras-ventas/referencia?numero=&fecha=&tipoImpuesto=` | Busca la factura que referencia una nota (casos y otras ventas) |
| `POST /otras-ventas` | Crea el documento (y, si es nota de crédito que anula, borra la factura de casos referenciada y libera sus líneas) |
| `PUT /otras-ventas/:id/:accion` | `accion`: `numero` (N° SII), `nota`, `fecha`, `glosa`, `uf`, `monto-uf`. `:id` es `id_otroscobros` |
| `GET /dte/otras/:flujo?estado=` | Documentos para el archivo. `flujo`: `FEA`, `FEE`, `NCE`, `NDE` |
| `POST /dte/otras/:flujo/exportar` | `{ ids_facturacion }` → arma el archivo, marca emitidos y entrega texto y base64 |

La OC/HES de un documento ya creado se agrega, cambia o quita con las rutas `/prefacturas/:id/exportacion-oc-hes` del bloque 4 (sirven para cualquier `id_facturacion`).

### 4.5 Consulta de una factura y "Graba Factura" (bloque 5)
- **Buscar** por ID de facturación o por N° de factura. Con N° de factura la ficha queda bloqueada (solo consulta). Sin N° se puede editar. Título para los PDF: `<3 letras del mes> ID<id> <sigla empresa> <sigla programa>`.
- **Otros ingresos/descuentos:** se agregan y quitan en pantalla; el total de la factura es casos + ingresos − descuentos.
- **Graba Factura sin N° de factura:** totales a 2 decimales; pesos = ROUND(ROUND(total, 2) × UF, 0); empresa 500: total en dólares = pesos ÷ USD de la factura; la UF también se escribe en **todas las líneas** de la factura; los otros ingresos/descuentos se **reemplazan**; y se asocian las guías.
- **Graba Factura con N° de factura:** solo número y UF en el encabezado, más las guías.
- **Guías de despacho** (base Abastecimiento): se listan las pendientes de la empresa (tipos de guía 1, 2 y 9); al elegirlas se calcula el neto en UF (pesos ÷ UF, UF tal cual, dólares no suman), se reservan (`marca = 1`) y se agrega un otro ingreso "Guías de despachos por materiales" (concepto 4). Al grabar, todas las reservadas de la empresa pasan a FACTURADO con el ID, N° y fecha de la factura.
- **Excel:** resumen (14 columnas; los tres datos finales se reubican según por qué se factura) y detalle (con lote opcional; con la columna de dólar solo para la empresa 500).
- **PDF:** resumen y detalle, a partir de plantillas de ADLSOFT (`fac_prever_resumen_general.frx`, una distinta para Screening de proyecto). ADLSOFT los guarda en una carpeta de red.
- Los botones de edición se bloquean para el perfil "COM" solo en la pantalla (H-71).

### 4.6 Otras ventas, notas de crédito y de débito (bloque 6)
- **Documentos** de la tabla `facturacion_otro`: factura electrónica afecta (tipo 1), nota de crédito electrónica (8), nota de débito electrónica (10) y factura exenta (11). El impuesto (afecto o exento) se elige aparte y se guarda en `tipoimpuesto`.
- **Crear:** lee `Mae_id.id_facturacion` e `id_otroscobros` (el documento usa los valores leídos y el contador sube 1); inserta con `emitido = 'N'`; `concepto_cobro` y `motivo` llevan la glosa elegida; `observacion` queda vacía. Solo exige tipo y monto distintos de cero. Las notas llevan el código de razón (1 anula, 2 corrige texto, 3 corrige montos) y la referencia (tipo `FE`, número y fecha de la factura).
- **Referencia de una nota:** por número y fecha. Con impuesto afecto busca primero entre las facturas de casos y después entre las otras ventas; con exento solo entre las otras ventas.
- **Nota de crédito que anula (código 1):** borra `facturacion_enc` y `facturacion_det` de la factura referenciada y devuelve sus líneas a ENVIADO con `mf = 0` (no toca `uf` ni `valorizado`). Los otros códigos no cambian nada de la factura.
- **Mantención de un documento:** asignar el N° que entregó el SII (`numero_documento`), grabar la nota, cambiar la fecha, la glosa, la UF (recalcula pesos = monto UF × UF) o el monto en UF (recalcula pesos).
- **Archivos planos** (mismas 35 columnas que el de casos, ver 4.4; nombre `<prefijo><ids>.TXT`, marca `emitido = 'S'` por ID de facturación):

| Archivo | Prefijo | `n_td` | Neto | Total | Columna `ocompra` | Referencias | Filas de OC |
|---|---|---|---|---|---|---|---|
| Factura afecta | `FE_OtrasVentas_` | FE | monto | ROUND(monto × 1,19) | vacía | vacías | sí (tipo de la OC) |
| Factura exenta | `FEE_` | FEE | monto | monto | vacía | las del documento | sí (siempre tipo "OC") |
| Nota de crédito | `NCE_` | NCE | ROUND(monto) | afecta: ROUND(monto × 1,19); exenta: ROUND(monto) | AFE o EXE | las del documento | no |
| Nota de débito | `NDE_` | NDE | monto | ROUND(monto) | siempre EXE | las del documento | no |

  En NCE el motivo es `<motivo> . <observación>`. Cada listado usa un procedimiento distinto: el de la factura afecta toma la forma de pago del documento y los demás la de la empresa.

---

## 5. Hallazgos raros de ADLSOFT (H-xx)

Las cifras salen de leer la base el 2026-11-10 (solo lectura).

### Eliminación y mantención de facturas
- **H-01. "Eliminar por número de factura" borra solo una de varias.** Un mismo N° de factura cubre varias facturas internas (14.679 filas comparten 7.326 números). La pantalla toma el primer registro y deja las demás, sin avisar.
- **H-02. Eliminar por número no libera las guías de despacho**; por ID sí. Dos caminos del mismo botón hacen cosas distintas.
- **H-03. Se puede eliminar cualquier factura**, también las emitidas (29.527 de las 37.992 están emitidas): no hay validación de estado, de folio ni de archivo plano ya enviado.
- **H-04. Borrado definitivo y sin rastro.** No se audita quién ni cuándo eliminó. La columna `eliminado` existe y se usa en el filtro de la pantalla de exportación, pero la eliminación no la usa (85 facturas tienen `eliminado = 'S'`; de dónde sale es desconocido).
- **H-05. Deja datos huérfanos**: 2.298 filas de `facturacion_ocompra`, 362 de `facturacion_det` y 17 de `facturacion_ing` sin factura. La eliminación no borra `facturacion_oc` ni `facturacion_ocompra`.
- **H-06. Líneas facturadas apuntando a facturas que no existen**: 40 líneas (ids 3053, 3056, 39013, 39014) además de las marcas especiales de H-30.
- **H-07. El botón "Cambiar" de la pantalla de eliminación borra la factura** (es una copia del código de "Elimina Factura"). Quedan restos sin uso: un combo de empresa y un cuadro de motivo.
- **H-08. "Cambiar empresa" descarta el motivo.** Lo exige, pero no lo guarda en ningún lugar; tampoco hay auditoría (no existe ni un registro de esta acción en `auditoria`).
- **H-09. "Cambiar empresa" modifica el caso en el LIMS** (`muestras.id_empresaservicio`) para siempre, para todos los casos de la factura. Si un caso tiene líneas en dos facturas, cambia para ambas.
- **H-10. La segunda opción de la pantalla ("dejar los casos para re-procesar") no hace nada.** El código ignora la selección.
- **H-11. "Cambiar empresa" no verifica** si la factura ya fue emitida, exportada o tiene folio. El combo parte con la empresa de id 1 preseleccionada.
- **H-12. Cada acción abre y cierra su propia conexión, sin transacción.** Si falla a mitad, queda a medias (líneas liberadas con la factura todavía existente, o al revés). Los errores de `SQLEXEC` no se revisan.

### Órdenes de compra
- **H-13. Dos tablas distintas para "la OC"**: `facturacion_ocompra` (texto libre, se escribe al crear las facturas) y `facturacion_oc` (con valor y moneda, la edita esta pantalla). No hay relación entre ambas.
- **H-14. Total en pesos calculado de dos formas**: al abrir, suma `valor × conversión` para las no pesos; después de agregar o quitar, suma solo la columna conversión. La base muestra que `oc_conversion` es el monto en pesos (p. ej. 77,96 U.F. → 1.853.375), así que la primera fórmula es la errónea.
- **H-15. Eliminar una OC compara todos los campos**; si hay dos idénticas se borran ambas.
- **H-16. La auditoría guarda el ID de facturación en la columna `id_caso`** (mezcla dos numeraciones) y solo hay 20 registros "Agrega O.Compra"; nunca hay "Elimina O.Compra", aunque la pantalla lo intenta.
- **H-17. Fechas como texto** (`dd/mm/yyyy`, formato dependiente de la configuración del puesto) y monedas escritas a mano.

### Otros ingresos y descuentos
- **H-18. "Graba" solo inserta.** Si se pulsa dos veces o se vuelve a abrir, duplica las filas (14 combinaciones duplicadas en `facturacion_ing`).
- **H-19. Inserta filas en cero con concepto 0** cuando no hay conceptos (47 en ingresos y 47 en descuentos). No se sabe quién las necesita; no se pueden unir con el maestro.
- **H-20. "Eliminar" una fila solo la quita de la lista en pantalla** hasta el siguiente "Graba"; no hay confirmación y actúa sobre el registro activo de la grilla.
- **H-21. Validación mínima**: el valor solo debe ser distinto de cero; acepta negativos. El total se calcula en la pantalla y se copia al encabezado sin volver a calcularlo.
- **H-22. El total en pesos del Excel de resumen/detalle** se calcula en la pantalla (`uf_total × valor_uf`); el encabezado tiene `peso_totalfac` pero esa pantalla no lo actualiza.

### Consistencia de datos
- **H-23. 10 facturas** con `uf_totalfac` distinto de casos + ingresos − descuentos.
- **H-24. 184 facturas** con `uf_totalcaso` distinto de la suma de su detalle.
- **H-25. 9.140 encabezados sin ninguna línea** asociada.
- **H-26. 4 facturas emitidas sin folio; 8.143 con folio y `emitido = 'N'`; 2 con folio y `emitido` vacío.**
- **H-27. Sin integridad referencial**: no hay claves foráneas ni disparadores; las únicas tablas con índice son `facturacion_enc` (solo la clave primaria). Las búsquedas por `id_facturacion` sobre `facturacion_det` (1,7 millones de filas) recorren la tabla entera.
- **H-28. El N° de factura no es único** y se usa como si lo fuera (H-01); hay un folio 99999 repetido en 5 facturas.
- **H-29. `fac_consulta_una_factura_enc` devuelve varias filas** cuando la factura mezcla programas (agrupa por sigla del programa).
- **H-30. Marcas `9999999998` y `9999999999` en `id_facturacion`**: aparecen en 12.325 líneas con total cero. Se usan en varios procedimientos y reportes a medida (`FB_*`, `RFL_*`, `KR_*`) pero no en las pantallas analizadas. Hay que averiguar su significado antes de migrar.

### Datos previos y archivo plano
- **H-41. El total del documento puede diferir en 1 peso entre la fila principal y las de OC/HES** de la misma factura, porque se calculan con redondeos distintos. En 59 facturas de 2026 con OC revisadas, **17** quedaban así.
- **H-42. Doble redondeo.** El total o neto se redondea a 1 decimal y luego otra vez al entero al guardarlo: 12,45 queda 13 (con un solo redondeo sería 12). Con y sin OC se calcula distinto (H-41), así que la misma factura daría montos distintos según tenga o no OC.
- **H-43. Textos cortados sin aviso** por el largo fijo de los campos. Ejemplo real: el área de negocio "Programas de Vigilancia Epidemiológica" sale como "Programas de Vigilancia Epidio" (30 caracteres). Hay 8 glosas de más de 150 caracteres; el RUT se corta a 10 (hoy ninguno es más largo).
- **H-44. Forma de pago inconsistente en el archivo:** el código (`id_formapago`) es el de la **empresa** y el nombre (`nom_fp`) es el de la **factura**. En 602 de las 3.454 facturas de 2026 no coinciden (ejemplo: código 2 con "30 días"). No se sabe cuál usa el emisor.
- **H-45. La factura queda marcada como emitida antes de guardar el archivo.** Si se cancela el cuadro "Guardar como", las facturas siguen marcadas y no hay archivo.
- **H-46. El listado repite facturas** que abarcan más de un área de negocio (9 hoy): si se marcan ambas filas, se emite el documento dos veces. Y como el listado usa uniones obligatorias con giro, dirección, ciudad, comuna, glosa y forma de pago, una factura a la que le falte alguno de esos datos no aparece, sin ningún aviso.
- **H-47. "Emitido" tiene tres valores** (vacío, N y S) sin significado documentado: hay 8.143 con N, casi todas sin líneas, y 236 pendientes reales con valor vacío. "Seleccionar todos" solo marca las vacías.
- **H-48. Glosa con el mes vacío queda con coma al final** ("Servicios…, "). 12 facturas así.
- **H-49. La lista de meses de la pantalla es fija** (octubre 2025 a diciembre 2026) y hay que reprogramarla cada año.
- **H-50. Variable mal reutilizada:** al elegir una OC en la grilla, la pantalla guarda el N° de OC en la variable que contiene el ID de la factura. Hoy no rompe nada porque las acciones leen el ID del cuadro de texto, pero es frágil.
- **H-51. Eliminar OC/HES borra por número**, sin mirar el tipo ni la fecha; el procedimiento que busca una OC en otras facturas mira solo 12 caracteres (8 OC tienen más).
- **H-52. Sin validaciones:** la OC se guarda sin fecha (queda en blanco), se pueden repetir, y la columna `oc` de la tabla nunca se llena (quedan 586 filas con tipo vacío y 6 nulo, heredadas). Las columnas `ocompra` y `ocompra_fecha` del encabezado se muestran deshabilitadas: son restos de otra versión.
- **H-53. Mensaje equivocado:** al grabar la glosa, la confirmación dice "grabar la Glosa Factura electrónica vacía".
- **H-54. Se puede cambiar glosa, fecha, forma de pago, nota y OC de una factura ya emitida**, sin avisar ni dejar auditoría.
- **H-55. El módulo de Medio Ambiente de ADL ONE calcula el total distinto:** neto + ROUND(neto × 0,19) contra ROUND(neto × 1,19) de ADLSOFT. En un archivo real de agosto 2026 (neto 1.817.594) el total sale 2.162.937 en vez de 2.162.938. Una diferencia de 1 peso entre sistemas del mismo laboratorio.
- **H-56. Las fechas dependen de la configuración del puesto:** la pantalla de datos previos fuerza formato inglés/británico, la del archivo no. Si un puesto tiene otro formato, la fecha del archivo puede salir mal.
- **H-57. Código del colega (`actualizarDatosPrefactura`):** usa 38.500 como UF por defecto y borra y vuelve a crear **todas** las OC de la factura en cada guardado; además rellena la columna `oc` y reasigna el orden, cosas que ADLSOFT no hace. Debe reemplazarse por las acciones nuevas cuando se arme la pantalla.
- **H-58. Su generador de archivo** (`generarArchivoPlanoDteSalud`) tampoco es réplica: usa `n_td = "FEA"` (ADLSOFT: "FE"), no repite los textos entre comillas, no escribe la fecha vacía como ADLSOFT, no usa los redondeos de H-41/H-42 y no corta los textos. Sigue sirviendo para los flujos de otras ventas hasta el bloque 6.

### Consulta de factura, N° de factura y guías
- **H-59. El N° de factura se escribe a mano.** No se valida el formato, que sea único para la empresa ni que exista en el emisor. Hay 7.326 números repetidos (muchos legítimos: una factura se reparte en varias internas por centro) y el 99999 se usa de comodín en 5 facturas.
- **H-60. Las guías no reciben el N° de factura.** Al grabar sin número, las guías quedan FACTURADO con número 0; al grabar con número, el sistema busca solo guías "reservadas y pendientes", así que las ya asociadas nunca se actualizan. Hoy hay 394 guías FACTURADO sin número de factura (de 406 con marca).
- **H-61. La reserva de guías vive en la base antes de grabar.** Al elegir las guías quedan marcadas (`marca = 1`) aunque no se grabe; y al grabar se asocian **todas** las reservadas de la empresa, no solo las elegidas para esta factura: dos facturas de la misma empresa en paralelo se pueden quitar las guías.
- **H-62. Tres cifras de pesos para lo mismo:** el encabezado guarda pesos enteros, el Excel suma sin redondear y el PDF redondea a 2 decimales.
- **H-63. El segundo grabado (con N° de factura) cambia la UF del encabezado pero no la de las líneas, ni los pesos, ni los dólares.**
- **H-64. Quitar cualquier fila de otros ingresos libera todas las guías de la factura en la base**, al instante, sin esperar "Grabar" y aunque la fila quitada no fuera una guía.
- **H-65. Las guías en dólares no se cobran:** el cálculo les da valor 0 (hoy hay 2 guías en dólares). Además el procedimiento que las lista suma en una sola columna montos de monedas distintas.
- **H-66. Los PDF se escriben directo en una carpeta de red** (`\\192.168.10.5\adl.ws\Disco I\CA\ADM\Documentos ADL\<año>\FACTURACION\<mes>\`), con año y mes elegidos a mano y sin comprobar que la carpeta exista. ADL ONE **no debe escribir ahí** hasta decidir dónde guardar los documentos (decisión 12).
- **H-67. Conexión secundaria mezclada:** el código que toca las guías prepara una conexión y se desconecta de otra, y si la secundaria falla no se avisa: la factura queda grabada sin guías y sin mensaje.
- **H-68. Estados de guía inconsistentes:** "FACTURADO" y "Facturado"; hay 996 guías NULO con ID de factura asignado (463 también con N° de factura).
- **H-69. La división por USD no está protegida:** si la factura de la empresa 500 no tiene dólar, el cálculo falla en la pantalla.
- **H-70. El total en dólares solo se calcula para la empresa 500**; para las demás se graba 0. Es una regla fija en el código.
- **H-71. Los permisos son de pantalla:** el perfil "COM" solo tiene botones deshabilitados; en la base nada impide el cambio.

### Otras ventas, notas de crédito y débito
- **H-72. Monto en pesos y monto en UF se teclean por separado** y pueden no cuadrar. Ejemplo real: una nota de crédito de 233.225 pesos (6,16 UF) sobre una factura de 233.365.
- **H-73. El N° del SII se asigna después a mano.** Hay 21 notas de crédito emitidas sin ese número (desde 2020). No se valida que sea único ni su formato.
- **H-74. `observacion` siempre se graba vacía** (la pantalla tiene un cuadro de nota aparte); la glosa se copia a `concepto_cobro` y a `motivo`. En el archivo de la nota de crédito el motivo siempre termina en " . " aunque no haya observación.
- **H-75. Anular una factura con nota de crédito la borra:** 333 de las 334 facturas anuladas ya no existen en `facturacion_enc`; solo queda su número en la referencia de la nota. Se borra encabezado y detalle sin transacción, las líneas vuelven con `mf = 0` pero conservan UF y marca de valorizadas (a diferencia de "Eliminar"), y no se tocan guías, otros ingresos/descuentos ni OC (quedan huérfanos, H-05).
- **H-76. Las notas que corrigen texto o montos no cambian nada de la factura:** la corrección de montos no se refleja en ningún total.
- **H-77. Los documentos de otras ventas y las facturas de casos comparten el contador `Mae_id.id_facturacion`**, que se lee y se aumenta sin bloqueo (dos usuarios a la vez obtienen el mismo número). El módulo de casos además lo reescribe como máximo de `facturacion_enc` + 1, sin mirar las otras ventas. Ya hay un ID repetido entre ambas tablas, y la anulación usa el ID que encontró aunque sea de una otra venta: podría borrar una factura de casos ajena.
- **H-78. Una factura (tipo 1) marcada como exenta sale en el archivo de facturas afectas** y con IVA: hay 3 casos de 2021.
- **H-79. Los procedimientos de listado terminan en `OR factura IS NULL`**: cualquier fila sin factura aparecería en todos los archivos sin importar su tipo (hoy ninguna). Además, al terminar de exportar facturas exentas y notas de débito la pantalla recarga el listado de **notas de crédito** (procedimiento equivocado).
- **H-80. Las OC elegidas al crear un documento se guardan dos veces:** primero con ID 0 (119 filas huérfanas hoy) y luego, al crear, sin tipo ni orden (590 documentos). El archivo de factura afecta toma el tipo desde la tabla, así que esas referencias salen sin tipo; el de factura exenta lo fija en "OC".
- **H-81. Forma de pago distinta según el archivo:** la factura afecta usa la del documento (172 difieren de la de la empresa); la exenta y las notas usan la de la empresa.
- **H-82. Versión antigua con nota de crédito parcial por casos** (`fac_otroscobros` y `fac_reversa_nc_casos`): guarda una copia de las líneas y libera solo las marcadas, pero escribe columnas que ya no existen en `facturacion_otro`. Nunca se ha usado con la estructura actual (0 líneas con copia, 0 con marca de reversa). No se replica.
- **H-83. Cambiar la UF o el monto en UF** recalcula los pesos sin redondear; con UF 0 los pesos quedan en 0. El código no mira si el documento ya está emitido.
- **H-84. La nota de débito siempre sale como exenta (`EXE`)** aunque el documento sea afecto, y sin IVA.

### Nota de crédito por casos y pantallas
- **H-85. La nota de crédito por casos deja la factura original intacta:** sigue con sus totales y su detalle completos, aunque algunos casos ya se hayan liberado para volver a facturarse. La copia de las líneas va en las columnas `*nc` de `muestras_detalle`, que nunca se han usado. La versión antigua de ADLSOFT daba a la nota el mismo ID de la factura (por eso hay un ID repetido entre facturas y otras ventas); en ADL ONE la nota recibe su propio ID (D-25).
- **H-86. El listado de «facturas recién creadas» de ADLSOFT trae todas las facturas** (`mf = 1` en 37.991 de las 37.992), así que la pantalla de otros ingresos/descuentos posterior a «Facturar» no es usable a esa escala. En ADL ONE esa función quedó dentro de la ficha de cada factura («Montos y N° de factura»).
- **H-87. Pantallas del colega (módulo de Facturación Salud):** usaban listas desplegables sin buscador y selectores de fecha del navegador; cortaban los textos con «…»; partían con UF 38.500 y dólar 950 escritos en el código; mostraban programas con nombre equivocado («3. Peces Reproductores», «7. Genética» en vez de CISA/PVS/SRS y Medio Ambiente); permitían cambiar la empresa de un solo caso (ADLSOFT solo cambia la de una factura entera); y trabajaban sobre rutas propias que no replican ADLSOFT. Se reemplazaron por las nuevas (sección 10). La ruta `PUT /casos/cambiar-empresa` sigue en el servidor pero ya no se usa: conviene quitarla.
- **H-88. Quién queda por facturar: el procedimiento de ADLSOFT filtra más que el Resumen (verificado en la copia local, 2026-11-10).** Al comparar, por programa, los casos que ofrece el procedimiento de ADLSOFT contra los que cuenta el Resumen (líneas `ENVIADO`, sin factura, `CLIENTE`/`COMPLEMENT`, técnica distinta de 647), el procedimiento siempre queda **dentro** del Resumen. El Resumen cuenta 2.440 casos y los procedimientos ofrecen menos: Screening 37 de 39, SDiag-ATV 1.538 de 1.705, SAMIC 12 de 35; PVA, CISA/PVS/SRS e I+D coinciden. Lo que filtran los procedimientos y el Resumen no: (a) **fecha de informe** — el caso debe tener `fecha_informe` válida y dentro del rango (Screening 2 casos y SAMIC 21 sin fecha de informe, SDiag 1); (b) **estado del caso** — Screening y SAMIC exigen `FINAL` o `ENMIENDA-F` (SAMIC 2 `ABIERTO`, SDiag 6 `PRELIMINAR`; SDiag no lo exige); (c) **ensilaje** — SDiag-ATV exige `ensilaje = 'N'`. **Rareza:** desde el caso 337663 (informes del 05/11/2026 en adelante) 381 casos tienen `ensilaje` **vacío (NULL)** y, por eso, SDiag-ATV **no los ofrece** (160 casos de SDiag en esa situación: Ventisqueros 45, Blumar 45, Australis 27, Camanchaca 18…). Todos los casos anteriores traen `N` o `S`. Hay que confirmar con ADL si es un retraso normal (algún proceso rellena el campo después) o un error al crear casos nuevos. **Decisión tomada:** la pantalla Valorizar usa los procedimientos (igual que ADLSOFT); el Resumen (dashboard del colega) usa su propia consulta y **sobrestima** — pendiente ajustarlo para que cuente igual que los procedimientos (M-34).
- **H-89. PDF «Detalle»: «Facturado por» tiene la palabra «Veterinario:» fija (comparado con el PDF real de la factura ID 74398, 2026-11-10).** ADLSOFT imprime siempre `<por>(Veterinario: <veterinario> )`, aunque se facture por centro o por tipo de agua: una factura «por Centro» sale como «Centro(Veterinario: Ana )». Solo el programa 9 (Medio Ambiente) imprime únicamente el veterinario. Se replica igual.
- **H-90. PDF «Detalle»: «Fecha proceso» muestra el rango de las fechas de INFORME, no el de proceso.** El informe imprime `fecha_informe_ini - fecha_informe_fin` bajo la etiqueta «Fecha proceso» (en la factura 74398: 21/09/2026 - 20/10/2026), mientras la factura guarda además un rango de proceso distinto (01/01/2022 - 20/10/2026). La primera versión de ADL ONE mostraba el de proceso y no coincidía. Se replica el de informe.
- **H-91. PDF «Detalle»: reglas de impresión que se replicaron.** Carta (no A4); los montos en cero se dejan en blanco (el «Costo operativo» sale sin U.F. unitario ni total); recepción y N.° de caso solo se imprimen en la primera línea de cada caso; cada caso termina con su subtotal bajo una línea; el N.° de factura sale como `0` cuando aún no tiene folio (no «Sin N°»); los totales de UF llevan 3 decimales (0,570).
- **H-92. Nombre de los PDF: ADLSOFT solo propone una parte; el resto lo escribe el personal a mano (comparado con tres PDF reales, 2026-11-10).** El cuadro de texto de la pantalla trae `<3 letras del mes> ID<id> <sigla empresa> <sigla programa>` y es editable. Los archivos reales llevan además el N.° de factura y el centro o el veterinario, que alguien agrega a mano, y ni siquiera siguen el mismo orden: octubre `OCT FACTURA 31873 ID74389 AQUAGEN SCR RIO IGNAO`, junio `FACTURA 30632 JUN ID72325 NALCAHUE MAM CHESQUE ALTO`, y una prefactura sin folio `OCT ID74398 S.BLUMAR SDG PACUÑA`. ADL ONE lo automatiza con lo que muestran esas muestras: `<mes> [FACTURA <folio>] ID<id> <sigla> <programa> <centro o veterinario>`, con el veterinario como inicial + apellido (Pedo Acuña → PACUÑA, conservando la Ñ) cuando se factura por veterinario y, en los demás casos, el centro en mayúsculas sin tildes y sin la palabra «Piscicultura» (Piscicultura Río Ignao → RIO IGNAO). Se usó el orden de octubre (el más reciente). **Pendiente de confirmar con ADL** que esa regla es la que quieren.
- **H-93. PDF «Detalle» con jornada (Screening de AquaGen, empresa 56): los subtotales se acumulan mal.** A la plantilla `fac_prever_detalle_general_scree_jornada` se le agregó el grupo «fecha de muestreo» sin ajustar los códigos de reinicio de los totales (siguen siendo 6 y 7). Resultado verificable en la factura 74389: el subtotal bajo cada caso es **acumulado dentro del centro** (el segundo caso muestra 18,580 en vez de 13,010) y el «TOTAL CENTRO» se acumula **por fecha de muestreo**, no por centro. Con un solo caso por centro no se nota. Se replica igual.
- **H-94. PDF «Detalle»: reglas de pagina y repeticiones (comparado con la factura 74389, 2 hojas).** La «Fecha de muestreo» abre un encabezado nuevo solo cuando cambia; al empezar otra hoja se repiten la fecha de muestreo y el centro; el último encabezado de la hoja 1 puede quedar solo al final (la banda siguiente no cabe); la «Fecha Informe» solo se imprime cuando cambia o al empezar un centro o una hoja; en la plantilla de Screening el pie lleva Arial (en la general, Times). Se replicó todo y las posiciones coinciden con el original a 0,01 pt.
- **H-95. PDF «Resumen»: reglas de impresión del informe (comparado con el PDF real de la factura ID 69637, Screening con un otro ingreso, 2026-11-10).** (a) Los campos numéricos usan el formato «@Z»: los ceros se imprimen en blanco, por eso no sale «0,000» en U.F. Des. ni el folio cuando vale 0. (b) Los campos de UF miden 30,75 pt y el formato «9.999,999» ocupa 9 posiciones: un valor con 2 o más dígitos enteros (65,520 y 66,300 en esa factura) no cabe y pasa a una segunda línea 8 pt más abajo; esa línea agranda la banda y **baja 9,22 pt todo lo que viene después**. Los valores de 1 dígito (0,780) quedan en su sitio, así que el diseño cambia según los montos. (c) En «Otros ingresos» la fila ocupa 23,9 pt (el nombre del concepto no se recorta y viene relleno de espacios, y también se parte en una línea en blanco); si no hay registros no se imprime ninguna fila (la primera versión de ADL ONE dejaba una en blanco). (d) «Programa» y «Facturado por» van con etiqueta aparte y el valor se imprime `: <por>( <detalle> )`, sin espacio antes del paréntesis. (e) El pie va en Arial 7 (en el Detalle general va en Times) y la barra naranja del pie está 6 pt más abajo (y=774). (f) La fecha, la UF y el valor en pesos de esa factura difieren del PDF antiguo porque la factura cambió después (de 14/02 a 19/02, UF 39.711,29 → 39.739,61 y folio 29065); con los datos de entonces el cálculo da exactamente 2.632.859.
- **H-96. PDF «Detalle» de Screening sin jornada y Resumen con descuento (comparados con los PDF reales de las facturas ID 70181 y 70298, 2026-11-10).** (a) Sin jornada (Screening de Camanchaca) se agrupa solo por centro y cada caso lleva su propio subtotal (a diferencia de la plantilla con jornada, H-93); el encabezado del centro va 2,25 pt más arriba que el de la fecha de muestreo. (b) El N.° de análisis también usa el formato «@Z»: las líneas con cantidad cero (por ejemplo «RT-PCR ELF (BKD, IPNV)») salen sin número, sin U.F. unitario y sin total. (c) La «Fecha Informe» se imprime en la primera línea de cada caso (aunque repita la del caso anterior); con jornada solo cuando cambia. (d) En «Otros ingresos / descuentos», con registros la fila y el pie crecen 9,22 pt cada uno; sin registros el bloque mide 75 pt. La suma de descuentos va en Arial 7 y la de ingresos en Arial 8 (H-95).
- **H-97. Archivo plano comparado con dos archivos reales de ADLSOFT (2026-11-10).** `FE_CASOS_73718_73716_…_73704.TXT` (8 facturas de casos con OC y HES, 31/08/2026) y `FE_OTRASVENTAS_73153.TXT` (otra venta con OC y HES, 28/08/2026): con la misma lógica que el botón, ADL ONE genera ambos archivos **idénticos byte a byte** (5.558 y 1.426 bytes), incluidos Windows-1252, CRLF, comillas, fechas sin comillas, la fecha vacía `/  /` y los redondeos de neto, IVA y total. La única diferencia que apareció fue que el N.° de la OC/HES salía con espacios al final (el campo de la base está relleno a 20 caracteres y ADLSOFT los quita); corregido en los dos flujos. Se comparó además con otros dos archivos reales del 30/10/2026 (`FE_CASOS_74891_…_74540.TXT`, 8 facturas incluida una de I+D, y `FE_OTRASVENTAS_74591.TXT`, una otra venta **sin OC**): también idénticos byte a byte, con el mismo orden de facturas que el listado. El nombre del archivo en ADLSOFT va en mayúsculas (`FE_CASOS_…`, `FE_OTRASVENTAS_…`); se igualó. **Sin comparar aún:** facturas con USD, exentas y los archivos de exportación (FEE), nota de crédito (NCE) y nota de débito (NDE).
- **H-98. Valorización comparada con 20 facturas ya emitidas por ADLSOFT (2026-11-10, solo en la copia local).** Método: se guarda lo que calculó ADLSOFT, se elimina la factura con la función del módulo (los casos vuelven a quedar pendientes), se valoriza de nuevo con ADL ONE (misma UF, rango de informe de los casos y mismo criterio), se crea la prefactura y se compara línea por línea. **Resultado con facturas de 2026 (tarifas vigentes):** PVA 24/24 y 24/24; Screening (AquaGen, con jornada compartida) 21/21 y 7/7; SDG 35/35 y 21/21; I+D 15/15 y 10/10; CISA 20/20 y 8/8 (con la UF del día); SRS/PVS 6/6 y 9/9; SAMIC 16/16 y 15/15 (con los valores manuales repuestos). **2025:** PVA 16/16, Screening 28/28 y CISA 24/24; SDG (14/37), PVS (10/15) y SAMIC (5/11) difieren por los motivos de abajo; I+D de 2025 no fue concluyente (la primera corrida usó un rango que dejó fuera un caso y la factura ya no se pudo repetir). **Todas las diferencias se explicaron; ninguna es un error del cálculo:** (a) *las tarifas no guardan historial*: las tablas de precio especial y de proyecto son las de hoy, así que una factura de 2025 se compara contra precios de 2026 (ej. técnica 212: 0,49 entonces, 0,55 hoy); (b) *la UF*: el costo operativo se calcula en pesos y depende de la UF del día en que se procesó, que no es la que queda en la factura al grabar el folio (74889: con 41.162,73 da 8/8, con 41.237,01 sale una milésima distinta); (c) *valores escritos a mano* (SAMIC, derivaciones a Aysén) se pierden al eliminar la factura, igual que en ADLSOFT: con valorizado='N' y sin tarifa la línea queda en 0 (código de la pantalla original); (d) *la jornada de AquaGen* se cobra una vez por fecha de muestreo entre los centros 7421 y 5610: si el otro centro ya está facturado, la jornada cae en el siguiente caso (mi prueba lo reproducía mal al procesar solo una factura; con las dos juntas, 73840 y 73838, coincide); (e) *líneas pendientes* que se agregaron al caso después de la factura (74553: técnicas 24 y 25 de 0,3 UF) aparecen como extra y no cuentan. **Mejora M-36:** guardar el historial de tarifas y la UF de valorización por línea, para poder explicar o reproducir una factura antigua.

### Valorización (ya documentados en bloques anteriores)
- **H-31.** El costo operativo se decide con una marca que se reinicia en cada caso y queda con el valor del **último**: si el último caso de Servicio Diagnóstico es PROA, no se agrega costo operativo a ninguno.
- **H-32.** La actualización de las líneas 958/959 (`n_analisis = pooles`) corre sobre **toda la tabla** (`mf = 1`), no solo los casos procesados ni solo sin facturar.
- **H-33.** El costo fijo de Mowi recorre **todos** los casos pendientes de Mowi, no solo los del rango; además usa una fecha de recepción que viene de una variable de un paso anterior.
- **H-34.** Para Screening, el costo operativo usa la marca "multiplex" del último caso leído, no la de cada caso.
- **H-35.** La exclusión de Caligus en el costo operativo se mira solo en el primer caso de la lista.
- **H-36.** Si el procedimiento de precio del costo operativo de Screening no devuelve fila, el código falla (o toma valores vacíos); y si el reparto por visita no encuentra casos, divide por cero.
- **H-37.** La jornada AquaGen: los casos hermanos del mismo día conservan el precio que les dio la valorización general (no se ponen en cero), y el código reescribe varias veces el primer caso del día.
- **H-38.** La tarifa PROA solo se aplica a empresas con lista "Precio lista"; para las demás se ignora sin avisar.
- **H-39.** El folio de Sistema de Ventas se calcula como máximo + 1, sin bloqueo: dos usuarios a la vez pueden obtener el mismo número.
- **H-40.** El código del colega ignoraba la UF tecleada (usaba 38.500 fijo) y cobraba con valores por defecto; ya corregido en ADL ONE (la UF es obligatoria). `actualizarDatosPrefactura` todavía tiene `38500` por defecto.

---

## 6. Diferencias deliberadas con ADLSOFT (D-xx)

| Código | Diferencia | Motivo |
|---|---|---|
| D-01 | Todo lo que ADLSOFT hace en sentencias sueltas va en **una transacción** (eliminar, cambiar empresa, OC, OI/OD). | Evita estados a medias (H-12). El resultado final es el mismo. |
| D-02 | **Cambiar empresa** guarda el motivo en `auditoria`. | ADLSOFT lo exige y lo pierde (H-08). |
| D-03 | **Eliminar OC** también audita. | ADLSOFT lo intenta y nunca queda nada (H-16). |
| D-04 | **"Graba" de OI/OD** reemplaza las filas de la factura en vez de insertar encima. | Evita duplicados (H-18). Con un solo clic el resultado es idéntico. |
| D-05 | **OI/OD** solo se graba en facturas que siguen en creación (`mf = 1`). | ADLSOFT trabaja solo sobre esa lista; aquí se valida. |
| D-06 | **Eliminar por número** informa qué otras facturas comparten el número. | Es solo información; no cambia lo que se borra (H-01). |
| D-07 | El costo fijo de **Mowi** se limita a los casos que se están valorizando. | H-33. Para igualarlo a ADLSOFT hay que quitar un filtro en `_aplicarCostosOperacionales`. |
| D-08 | La actualización multiplex 958/959 se limita al caso procesado y sin facturar. | H-32. |
| D-10 | OC: se valida en el servidor que la fecha, la moneda y los valores existan antes de insertar. | ADLSOFT valida en la pantalla. |
| D-11 | En el archivo, una comilla dentro de un texto se duplica y los saltos de línea se cambian por espacio. | FoxPro no protege las comillas y rompería la fila. |
| D-12 | Cada factura entra una sola vez al archivo aunque el listado la repita (H-46). | Evita emitir dos veces. |
| D-13 | El archivo y la marca `emitido` se hacen en una sola operación; el archivo se devuelve en la misma respuesta (texto y base64 en Windows-1252). | Reduce H-45; no la elimina si el navegador no llega a guardarlo. |
| D-14 | Se exige que las facturas pedidas existan en el listado de exportación; si no, no se genera nada. | ADLSOFT solo trabaja con lo que se ve en pantalla. |
| D-15 | No se puede grabar una factura que ya tiene N° de factura (ni cambiarlo). | La pantalla de ADLSOFT bloquea los campos, pero la base no. |
| D-16 | La UF debe ser mayor que cero para grabar. | Con UF 0 los pesos quedan en cero. |
| D-17 | Los totales se calculan en el servidor a partir del total de casos guardado y de las listas de ingresos/descuentos enviadas. | ADLSOFT los toma de lo que muestra la pantalla. |
| D-18 | Los Excel y PDF no se escriben en ninguna carpeta: el servidor entrega columnas y filas. | H-66. |
| D-19 | Con empresa 500 sin USD en la factura se devuelve un mensaje en vez de fallar. | H-69. |
| D-20 | Al crear un documento, la lectura del contador toma un bloqueo para que dos usuarios no obtengan el mismo número. | H-77. |
| D-22 | En cada archivo solo entran documentos del tipo que corresponde. | H-79. |
| D-23 | Se exige la empresa (y el código de razón en notas) antes de insertar. | ADLSOFT lo obtiene de la lista o de la referencia y falla si falta. |
| D-24 | En la ficha de factura, quitar una fila de otros ingresos libera las guías de despacho solo si la fila quitada es la de guías. | ADLSOFT las libera al quitar cualquier fila (H-64). |
| D-25 | La nota de crédito por casos recibe su propio ID. | H-85. |
| D-26 | Las pantallas no escriben archivos en carpetas: descargan el archivo plano (Windows-1252) y los datos de los Excel en CSV. | H-66; los PDF quedan pendientes (decisión 12). |
| D-27 | El PDF «Resumen» se guarda en `<carpeta de documentos><año><MES>` con el año y el mes de la fecha de facturación, no en una carpeta de red con año y mes elegidos a mano. | H-66. Si no hay carpeta configurada, el PDF solo se descarga. |
| D-28 | El PDF «Detalle» se guarda con el nombre sugerido sin sufijo (`<título>.PDF`) y el «Resumen» como `<título> RESUMEN.PDF`; el título lo arma ADL ONE (H-92). | Igual que ADLSOFT en el sufijo; la diferencia es que allá el N.° de factura y el centro o veterinario los escribe el personal a mano. |
| D-29 | PDFs «Resumen» y «Detalle»: el título dice «ADL ONE - Sistema de Facturación». Mismo diseño que ADLSOFT (carta, Arial, barras naranjas #FF8000, logo «Diagnostic Chile SpA» extraído del PDF original). | ADLSOFT dice «ADLSoft - Sistema de Facturación». **Estado de la comparación (2026-11-10):** se compararon con PDF reales de ADLSOFT el Detalle general (factura 74398), el Detalle de Screening con jornada (74389, 2 hojas), el Detalle de Screening sin jornada (70181), y cuatro Resumen (69637, 70298 con descuento, 74887 con un ingreso y 70197 con descuento que se parte): 0 textos sin pareja, misma altura de cada texto a 0,04 pt como máximo y líneas a 0,16 pt; solo difieren la marca, el folio de los PDF antiguos y décimas de ancho por la tipografía. **Sin comparar aún:** el Detalle de Screening de proyecto (no hay facturas así en la copia local), el de la empresa con dólares (500), el Detalle general con 2 o más centros o de varias hojas, y el Resumen con USD o cuando ningún monto llega a 10 UF (derivado de las reglas del informe, no verificado). |

---

## 7. Mejoras propuestas (M-xx)

Ordenadas por impacto. Ninguna está implementada.

**Integridad y trazabilidad**
- **M-01. Eliminación con historial.** Mover la factura a una tabla de historial (o marcar `eliminado = 'S'` con usuario y fecha) en vez de borrar; y no permitir eliminar facturas emitidas sin un permiso especial y un motivo. Resuelve H-03 y H-04.
- **M-02. Auditoría completa** con el usuario real y el ID de factura en su propia columna (hoy va en `id_caso`).
- **M-03. Eliminar por número**: eliminar *todas* las facturas internas con ese número, previa confirmación con el listado, o impedirlo. Resuelve H-01 y H-02.
- **M-04. Limpieza de huérfanos**: listar (solo lectura) y, con aprobación, borrar los registros de H-05 y H-06; y quitar la causa para que no se repitan.
- **M-05. Unificar las dos tablas de OC** (`facturacion_oc` y `facturacion_ocompra`) en un único modelo con tipo (OC, HES, otro), valor y moneda.
- **M-06. Índices** en `facturacion_det`, `facturacion_ing/des/oc/ocompra` por `id_facturacion`, y en `facturacion_enc.factura`. Hay precedente de índices autorizados en el LIMS (2026-11-04); se propone pedir autorización y medir antes y después.
- **M-07. Folio atómico** (secuencia o bloqueo) en lugar de máximo + 1 (H-39), y relación 1 a muchos clara entre folio y facturas internas (H-28).
- **M-08. Revisión periódica de consistencia** (H-23 a H-26): una consulta que avise cuando un encabezado no cuadra con su detalle.

**Reglas**
- **M-09. Cambiar empresa sin tocar el LIMS**: guardar una "empresa a facturar" propia de la factura en vez de reescribir la empresa del caso (H-09), o al menos avisar cuando afecta casos con otras facturas.
- **M-10. Moneda de las OC con tasa explícita** (valor, moneda, tasa, pesos) en lugar de la columna ambigua "conversión" (H-14).
- **M-11. Validaciones**: bloquear cambios sobre facturas emitidas o ya exportadas; negativos en descuentos; fechas reales.
- **M-12. Costo operativo y jornada por caso**, sin variables de estado entre casos (H-31 a H-37).

**Automatización**
- **M-13.** Asignar el folio y marcar `emitido` sin pasos manuales, como ya hace el módulo de Medio Ambiente con su proceso periódico de folios.
- **M-14.** Sugerir la UF del día (hoy se teclea a mano) y verificar contra la UF de la fecha de facturación.
- **M-15.** Crear automáticamente las facturas de los programas con convenio (PVA, CISA…) en fechas fijas.
- **M-16. Una sola regla de montos** (neto, IVA y total), compartida entre casos, Medio Ambiente y otras ventas, definida con Contabilidad: hoy hay tres formas (H-41, H-42, H-55).
- **M-17. Avisar antes de exportar** los textos que se cortarían y los datos que faltan en la empresa (giro, dirección, ciudad, comuna), en vez de cortar o esconder la factura (H-43, H-46).
- **M-18. Forma de pago**: tomar código y nombre de la misma fuente (H-44).
- **M-19. Marcar como emitida solo cuando el archivo se descargó** (o cuando vuelve el folio), y permitir reemitir con permiso y motivo (H-45).
- **M-20. Meses desde el calendario**, no desde una lista fija (H-49).
- **M-21. Bloquear y auditar la edición de facturas emitidas** (H-54), con el usuario real.
- **M-22. Envío directo al emisor electrónico** (si ofrece conexión) en lugar de archivo manual, y recibir el folio de vuelta (une con M-13).
- **M-23. N° de factura recibido del emisor** (o al menos validado: formato, único por empresa y centro, con aviso si ya existe), en lugar de teclearlo (H-59, M-13, M-22).
- **M-24. Asociar las guías por ID explícito** (las elegidas para esa factura), propagar el N° de factura a todas y no usar reservas globales por empresa (H-60, H-61).
- **M-25. Guías en dólares:** convertir con el dólar de la factura o impedir elegirlas (H-65).
- **M-26. Guardar los PDF y Excel en ADL ONE** (con versión y quién los generó) en vez de una carpeta de red (H-66), y generarlos desde plantillas propias.
- **M-27. Una sola cifra de pesos** y una regla de redondeo para el encabezado, Excel y PDF (H-62; une con M-16).
- **M-28. Operaciones sobre dos bases en un solo paso** con error visible si falla la segunda (H-67).
- **M-29. Un solo contador transaccional** (secuencia) para las facturas de casos y las otras ventas, sin colisiones (H-77).
- **M-30. Anulación que conserve la factura:** marcarla anulada con la nota que la anuló, en vez de borrarla (H-75), y liberar guías, otros ingresos/descuentos y OC en el mismo paso.
- **M-31. Nota de crédito parcial por casos** rehecha sobre la estructura actual: elegir líneas, crear la nota por ese monto, liberar solo esas líneas y dejar rastro (H-76, H-82).
- **M-32. Un solo generador de archivos planos** para los cinco tipos, con una regla única de montos y de referencias (H-41, H-78, H-81, H-84).
- **M-33. Recibir del emisor el N° del documento** y asignarlo automáticamente, como se hará con el N° de factura (M-23) (H-73).
- **M-34. Alinear el Resumen con los procedimientos de ADLSOFT:** que el conteo de casos pendientes use los mismos procedimientos (fecha de informe, estado del caso, ensilaje) y no una consulta aparte; hoy sobrestima (H-88).

---

## 8. Decisiones pendientes

1. ¿Dónde guardar el folio y marcar lo facturado sin escribir en el LIMS? (hoy se escribe en tablas de facturación de LaboratorioADL y en `muestras_detalle`, `muestras` y `Abastecimiento.gd_enc`).
2. Tarifa PROA: replicar la restricción de H-38 o corregirla.
3. Mowi: ¿limitado a los casos del rango (D-07) o idéntico a ADLSOFT?
4. Significado de `id_facturacion = 9999999998 / 9999999999` (H-30).
5. Quién y cuándo marca `eliminado = 'S'` (H-04).
6. ¿Qué proceso necesita las filas en cero de ingresos/descuentos (H-19)?
7. Para "Cambiar empresa": ¿se mantiene que cambie el caso en el LIMS?
8. Regla de redondeo e IVA que debe usar el archivo: la de ADLSOFT (H-41/H-42), la de Medio Ambiente (H-55) u otra definida con Contabilidad.
9. Forma de pago del archivo: ¿manda el código de la empresa o el de la factura? (H-44).
10. Facturas que abarcan más de un área de negocio: ¿una fila o una por área? (H-46).
11. ¿Se compara el archivo nuevo con uno real de ADLSOFT (mismas facturas) antes de usarlo?
12. ~~PDF de resumen y detalle~~ **Decidido (2026-11-10):** se guardan en una carpeta propia de ADL ONE, no en la carpeta de red de ADLSOFT (H-66). **Carpeta:** `Facturacion Salud ADL ONE` en el escritorio (variable `FACTURACION_SALUD_DOCS_DIR`); el sistema crea sola las subcarpetas `<año><MES>`. **PDF «Resumen» hecho** (réplica del informe `fac_prever_resumen_general`); **PDF «Detalle» hecho** (réplica de `fac_prever_detalle_general` y `_scree`).
13. ~~N° de factura~~ **Decidido (2026-11-10):** por ahora se replica el ingreso manual; más adelante se automatiza con la misma lógica del módulo de Medio Ambiente (proceso que toma el folio del emisor). Ver M-13 y M-23.
14. ~~Guías en dólares~~ **Decidido (2026-11-10):** se replica como está en ADLSOFT (valen 0). Queda anotado como H-65 para revisarlo con Administración.
15. ¿El permiso por perfil ("COM" no edita) se traslada a los permisos de ADL ONE? (H-71).
16. ~~Nota de crédito parcial por casos~~ **Decidido (2026-11-10):** también se implementa (hecha, H-85).
17. **Factura afecta marcada como exenta (3 casos de 2021):** son datos históricos que ya estaban así en la base; ADL ONE no modificó nada. La pregunta es solo qué hacer con esa regla al generar archivos nuevos: ¿que vayan al archivo exento o se deja como ADLSOFT? (H-78).
18. ~~OC al crear un documento~~ **Decidido (2026-11-10):** como ADLSOFT (sin tipo ni orden). Ya está así (H-80).
19. Qué mejoras de la sección 7 se hacen y en qué orden.
## 10. Pantallas

Módulo «Facturación área Salud» (`frontend-adlone/src/features/facturacion-salud`). Diseño con los componentes shadcn del proyecto, estilo limpio y minimalista; listas desplegables siempre con buscador (las opciones largas se parten en varias líneas, no se cortan); fechas con el selector del proyecto; tablas que no cortan el texto.

| Vista | Qué permite | Bloques |
|---|---|---|
| Resumen | Indicadores y accesos rápidos (del colega, con textos ajustados) | – |
| Valorizar y facturar | Programa, fechas de informe, UF y dólar (sin valores por defecto; la UF se sugiere con la última conocida); empresas con casos; valorizar; ajustar líneas; agrupar; crear las facturas con fecha, forma de pago, glosa (con mes si corresponde), nota y OC/HES | 1, 2, 2c, 2d |
| Facturas | Buscar por N° interno o N° de factura. Pestañas: **Montos y N° de factura** (otros ingresos/descuentos, guías de despacho, UF, N° de factura), **Detalle** (y datos de los Excel), **Datos para el emisor** (fecha, forma de pago, glosa y mes, nota, OC/HES), **Órdenes de compra con valor**, **Cambiar o eliminar** | 3, 4, 5 |
| Otras ventas y notas | Lista con filtro y buscador; nuevo documento (factura afecta o exenta, nota de crédito, nota de débito, con búsqueda de la factura que corrige); nota de crédito por casos; edición de N° SII, fecha, glosa, UF, monto, nota y OC/HES | 6 |
| Archivos para el emisor | Elegir el tipo de archivo (casos, otras ventas, exentas, notas de crédito, notas de débito), elegir documentos y generar el archivo (queda marcado como emitido y se descarga) | 4, 6 |

PDF «Resumen»: botón en la pestaña **Detalle** de la ficha de factura; se descarga y se guarda una copia en la carpeta de documentos (`<carpeta><año><MES><título> RESUMEN.PDF`, por ejemplo `OCT ID74900 BLU MAM RESUMEN.PDF`). Contenido igual al de ADLSOFT: empresa, programa, facturado por, fecha e ID, valor de la UF, totales (con dólar para la empresa 500), otros ingresos y descuentos, fecha del informe y página.

PDF «Detalle»: segundo botón en la misma pestaña; mismo destino (`<título> DETALLE.PDF`). Contenido: encabezado (factura, empresa, programa, facturado por, fecha, fecha de proceso, UF y dólar), líneas agrupadas por centro (recepción o, en Screening, fecha de informe; caso; técnica; cantidad; UF unitario y total), total por centro, suma por página y totales generales (UF, neto, IVA, total y, para la empresa 500, dólares). Variantes de ADLSOFT: general; Screening (con fecha de informe); y Screening de AquaGen (empresa 56) que usa el detalle con jornada, sin «Costo jornada» en cero ni las técnicas 960 a 963. No hay plantilla aparte para Screening de proyecto: usa la de Screening.

Pendiente en las pantallas: revisión visual con datos reales.


---

## 9. Cómo probar

- Pruebas automáticas (sin base de datos): `node --test src/services/facturacion-salud.*.test.js` desde `api-backend-adlone`.
- Pruebas contra datos: cuando haya una copia de LaboratorioADL en el servidor local (`DB_SALUD_*` en el `.env`), repetir cada flujo en ADLSOFT y en ADL ONE sobre los mismos casos y comparar `muestras_detalle`, `facturacion_enc/_det/_ing/_des/_oc`.
- Lecturas sin riesgo que sirven para comparar: procedimientos `fac_prever_*`, `fac_excel_detalle`, `fac_consulta_una_factura_*`.

## Documentos relacionados
- `copia-local-laboratorioadl.md`: cómo está armada la copia local de la base, cómo volver a traer datos nuevos, y cómo probar con instantánea sin riesgo.
- `facturacion-salud-pruebas-y-resultados.md`: qué pruebas se hicieron, cómo se hicieron y cómo salieron (PDF, archivo plano, valorización, seguridad), con lo que falta por comprobar.
- Scripts de prueba: `api-backend-adlone/scripts/pruebas-salud/`.
