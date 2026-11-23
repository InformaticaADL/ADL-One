-- Migration: add_mejoras_calidad_observaciones
-- Mejoras pedidas por Gestión de Calidad («Observaciones app», nov. 2026). Se puede ejecutar más de una vez.
--
-- 1. Influencia significativa y justificación por tipo de equipo, en el catálogo. Se cargan desde la hoja
--    «Influencia» del inventario OI-FoGe-21 (v2 18.11.26): los 37 tipos tienen una sola influencia en todas sus filas.
-- 2. Equipos creados desde la app: nacen «pendientes de puesta en marcha» (pendiente_pm = 1, Fuera de Servicio y sin
--    vigencia). La vigencia se calcula al aprobar su Puesta en Marcha. Los equipos anteriores a la app quedan como están.
-- 3. Requisitos del equipo al crearlo (puesta en marcha, verificaciones, mantención), como JSON.
-- 4. Puesta en marcha: fecha de calibración del informe del proveedor (control «Calibración anual de patrón»).

IF COL_LENGTH('mae_equipo_catalogo', 'influencia_significativa') IS NULL
    ALTER TABLE mae_equipo_catalogo ADD influencia_significativa NVARCHAR(20) NULL;
IF COL_LENGTH('mae_equipo_catalogo', 'justificacion_influencia') IS NULL
    ALTER TABLE mae_equipo_catalogo ADD justificacion_influencia NVARCHAR(1000) NULL;
GO

UPDATE mae_equipo_catalogo SET influencia_significativa = N'Baja', justificacion_influencia = N'Su función es permitir la conexión de sondas de pH y temperatura del mismo fabricante a dichos equipos AS950' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Adaptador';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Baja', justificacion_influencia = N'Fuente de energía sin influencia directa en resultados' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'BATERIA';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Permite la recolección a muestras a diferentes profundidades' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'BOTELLA OCEANOGRAFICA';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Baja', justificacion_influencia = N'Sólo transfiere información, no genera mediciones.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Cable de descarga de datos';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Baja', justificacion_influencia = N'Permite la carga de baterías para equipo muestreador, puede ser reemplazado por Power Pack' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Cargador de baterías';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Genera medición directa de transparencia reportada en programas ambientales.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Disco Secchi';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Permite recolección de muestras de sedimentos.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Draga para sedimentos';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Media', justificacion_influencia = N'Evitar que los sólidos ingresen por la manguera de succión al momento de ser recolectada.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'FILTRO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Media', justificacion_influencia = N'Determina ubicación geográfica del punto inspeccionado. Un error afecta trazabilidad espacial, aunque generalmente no modifica el valor analítico de la inspección.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'GPS' OR LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Sistema de Posicionamiento Global';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Media', justificacion_influencia = N'Controla profundidad o posicionamiento en algunos muestreos.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Huinche Mecánico';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Media', justificacion_influencia = N'Define área de muestreo en estudios biológicos.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Malla Surber' OR LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Malla Surver';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Mide parámetro que permite obtener resultado para ser reportado y/o utilizado para verificar cumplimiento normativo.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE CLORO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Patrón utilizado para verificaciones metrológicas de equipos de medición.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE CLORO DIGITAL PATRÓN';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Mide parámetro que permite obtener resultado para ser reportado y/o utilizado para verificar cumplimiento normativo.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE CLORO RESIDUAL';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Mide parámetro que permite obtener resultado para ser reportado y/o utilizado para verificar cumplimiento normativo.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE CLORO TOTAL';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Genera mediciones de caudal en tuberías donde no tenemos acceso al flujo a medir, resultados puedes ser utilizados como información interna o normativa' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE FLUJO ULTRASONICO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Genera resultados reportables relacionados con seguridad o condiciones ambientales.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE GASES';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Resultado reportado directamente en inspecciones y programas de monitoreo para control interno o cumplimiento normativo.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE OXIGENO DISUELTO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'El pH es un resultado reportado en inspecciones internas y normativas. Un error puede modificar la conformidad del resultado.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR DE pH';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'El pH es un resultado reportado en inspecciones internas y normativas. Un error puede modificar la conformidad del resultado.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MEDIDOR PH PORTÁTIL';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Determina velocidad de flujo de la matriz a medir, puede utilizarse para verificar sondas de caudal' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MOLINETE';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Define representatividad de muestras compuestas. Errores en volumen o programación afectan directamente la validez del resultado analítico posterior. Permite la recolección y almacenamiento hasta su descarga de información de mediciones In-Situ de pH y T°' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MUESTREADOR AUTOMÁTICO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Equipo permite almacenar información de medición que realiza la sonda Multiparámetro en inspecciones y programas de monitoreo para control interno o cumplimiento normativo, en mediciones de pH, Temperatura y oxigeno' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'MULTIPARAMETRO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Baja', justificacion_influencia = N'Elemento de soporte físico para sondas de medición en terreno' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Pedestal';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Baja', justificacion_influencia = N'Fuente de alimentación de equipos de muestreo automático' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'POWER PACK';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Determina nivel freático o profundidad de agua, parámetro reportado en inspecciones específicas.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Pozometro';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Media', justificacion_influencia = N'Utilizado para almacenar hielo o gel pack, contra muestras' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Refrigerador';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'El caudal es parámetro regulado y utilizado para cálculos de carga contaminante y cumplimiento normativo, equipo debe ser verificado según norma NCh3205' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'SONDA CAUDAL';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Mide parámetros directamente del flujo en inspecciones y programas de monitoreo para control interno o cumplimiento normativo, en mediciones de pH, Temperatura y oxigeno' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'SONDA MULTIPARAMETRO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Resultado reportado directamente en inspecciones y programas de monitoreo para control interno o cumplimiento normativo.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'SONDA OXIGENO DISUELTO';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'El pH es un resultado reportado en inspecciones internas y normativas. Un error puede modificar la conformidad del resultado.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'SONDA PH/TEMPERATURA';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Patrón utilizado para verificaciones y calibraciones internas.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Sonda termometro patrón';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Media', justificacion_influencia = N'Influye en preparación y clasificación de muestras.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Tamiz Sedimento';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Mide pH y Temperatura el cual permite ser reportado en inspecciones y normativas ambientales.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'TERMOCUPLA';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Alta', justificacion_influencia = N'Patrón utilizado para asegurar trazabilidad metrológica.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Termometro patrón';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Baja', justificacion_influencia = N'Uso auxiliar para comprobaciones eléctricas sin impacto directo en resultados de inspección.' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Tester';
UPDATE mae_equipo_catalogo SET influencia_significativa = N'Media', justificacion_influencia = N'Permite recolección de muestras de lodos, sin embargo, no es exclusiva para la representatividad de la muestra' WHERE LTRIM(RTRIM(nombre)) COLLATE Latin1_General_CI_AI = N'Tomador Muestra de Lodo';
GO

IF COL_LENGTH('mae_equipo', 'pendiente_pm') IS NULL
    ALTER TABLE mae_equipo ADD pendiente_pm BIT NULL;
IF COL_LENGTH('mae_equipo', 'requisitos') IS NULL
    ALTER TABLE mae_equipo ADD requisitos NVARCHAR(500) NULL;
GO

IF COL_LENGTH('mae_puesta_marcha', 'fecha_calibracion') IS NULL
    ALTER TABLE mae_puesta_marcha ADD fecha_calibracion DATE NULL;
GO
