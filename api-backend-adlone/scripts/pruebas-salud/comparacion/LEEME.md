# Comparación ADLSOFT vs ADL ONE (prueba del lunes 16/11/2026)

1. **Antes de las 9:00** (tras el refresco): anotar el mayor `id_facturacion` de producción → ese es `--desde`.
2. Facturar en ADLSOFT (producción) y, en paralelo, en ADL ONE (copia local).
3. **Cargar lo que hizo ADLSOFT** (solo lee producción: SELECT con MAXDOP 1, pausa entre tablas; ~11 s):
   `node cargar-facturas-adlsoft.cjs "<pwd sa local>" --desde=<id>`
   Guarda en `LaboratorioADL_comparacion` (instancia local) encabezado, detalle, otros ingresos/descuentos, OC y las líneas de los casos. Cada carga reemplaza la anterior.
4. **Comparar:** `node comparar-facturas.cjs "<pwd sa local>" --desde=<id> --salida=informe.md`
   Empareja por número si es la misma empresa y los mismos casos; si no, por empresa + casos (el número interno puede diferir). Informa columna por columna con la causa probable. El `id_facturacion` no cuenta como diferencia.
5. `--origen=local` en el cargador sirve para ensayar sin tocar producción.

Probado el 2026-11-11: copia contra sí misma = 7 de 7 idénticas; con 4 daños provocados (UF, valor de línea, fila de detalle faltante, factura renumerada) los detectó todos; carga real desde WS2016 de la factura 74906 = idéntica. Limitación: las tablas hijas de facturación no tienen índice, por eso cada carga lee tablas completas; no repetirla en horas de mucho uso.
