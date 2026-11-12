-- Script: limpiar_marca_observacion_equipos
-- Generado el 2026-11-12 a partir de las observaciones actuales (solo lectura).
--
-- Quita la marca "- [dd/mm/aaaa] " que la importación de Excel puso delante de
-- líneas de la observación que YA traían su propia fecha. Ejemplo:
--   antes:   - [09/11/2026] 23.01.26 Puesta en marcha por el area tecnica ...
--   después: 23.01.26 Puesta en marcha por el area tecnica ...
--
-- 613 líneas en 601 equipos. Las 52 líneas que tienen la marca
-- pero NINGUNA otra fecha no se tocan (la marca es su única fecha).
--
-- Cada UPDATE reemplaza solo esa línea exacta (REPLACE): el resto de la
-- observación queda igual. Si la línea ya no existe tal cual (se editó o el
-- script ya se ejecutó), no hace nada. Se puede ejecutar más de una vez.
-- Todo va en una transacción: si algo falla, no se aplica nada.

SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @lineas INT = 0;


-- BAT.01/MA.PM (id 482)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 482 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.02/MA.PM (id 483)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 483 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.03/MA.PM (id 484)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 484 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.04/MA.PM (id 485)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 485 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.05/MA.PM (id 486)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 486 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.06/MA.PM (id 487)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 487 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.07/MA.PM (id 488)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 488 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.08/MA.PM (id 489)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Operativo se encuentra en bodega Puerto Montt 22.12.22 Marca CS3 no Ultracell', N'Operativo se encuentra en bodega Puerto Montt 22.12.22 Marca CS3 no Ultracell')
WHERE id_equipo = 489 AND CHARINDEX(N'- [09/11/2026] Operativo se encuentra en bodega Puerto Montt 22.12.22 Marca CS3 no Ultracell', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.09/MA.PM (id 490)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 490 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.10/MA.PM (id 491)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 491 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.100/MA.PM (id 669)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 669 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.101/MA.PM (id 581)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 581 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.102/MA.PM (id 582)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 582 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.103/MA.PM (id 583)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 583 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.104/MA.PM (id 584)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 584 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.105/MA.PM (id 585)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 585 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.106/MA.PM (id 586)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 586 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.107/MA.VI (id 587)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 587 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.108/MA.VI (id 588)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 588 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.109/MA.VI (id 589)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 589 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.11/MA.PM (id 493)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 493 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.110/MA.VI (id 590)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 590 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.111/MA.VI (id 591)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 591 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.112/MA.VI (id 592)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 592 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.113/MA.AY (id 593)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 593 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.114/MA.AY (id 594)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 594 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.115/MA.AY (id 595)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 595 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.116/MA.PM (id 596)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 596 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.117/MA.PM (id 597)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 597 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.118/MA.PM (id 598)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 598 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.119/MA.PM (id 599)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 599 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.12/MA.PM (id 494)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 494 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.120/MA.PM (id 600)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 600 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.121/MA.PM (id 601)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 14.04.25 Bateria dada de baja por el area tecnica.', N'14.04.25 Bateria dada de baja por el area tecnica.')
WHERE id_equipo = 601 AND CHARINDEX(N'- [09/11/2026] 14.04.25 Bateria dada de baja por el area tecnica.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.122/MA.PM (id 602)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 602 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.123/MA.PM (id 603)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 603 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.124/MA.PM (id 604)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 604 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.125/MA.PM (id 605)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 605 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.126/MA.PM (id 606)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 606 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.127/MA.PM (id 607)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 607 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.128/MA.PM (id 608)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 608 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.129/MA.PM (id 609)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 609 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.13/MA.PM (id 495)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 495 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.130/MA.PM (id 610)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 610 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.131/MA.PM (id 611)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 611 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.132/MA.PM (id 612)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 612 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.133/MA.PM (id 613)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 No se realizo puesta en marcha, Area tecnica da de baja por perdida de vida util', N'26.08.25 No se realizo puesta en marcha, Area tecnica da de baja por perdida de vida util')
WHERE id_equipo = 613 AND CHARINDEX(N'- [09/11/2026] 26.08.25 No se realizo puesta en marcha, Area tecnica da de baja por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.134/MA.PM (id 614)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 614 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.135/MA.PM (id 615)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 615 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.136/MA.VI (id 616)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', N'05.12.24 Puesta en marcha personal Dilaco')
WHERE id_equipo = 616 AND CHARINDEX(N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.137/MA.VI (id 617)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', N'05.12.24 Puesta en marcha personal Dilaco')
WHERE id_equipo = 617 AND CHARINDEX(N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.138/MA.VI (id 618)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', N'05.12.24 Puesta en marcha personal Dilaco')
WHERE id_equipo = 618 AND CHARINDEX(N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.139/MA.VI (id 619)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', N'05.12.24 Puesta en marcha personal Dilaco')
WHERE id_equipo = 619 AND CHARINDEX(N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.14/MA.PM (id 496)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 496 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.140/MA.VI (id 620)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', N'13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25')
WHERE id_equipo = 620 AND CHARINDEX(N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.141/MA.VI (id 621)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', N'13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25')
WHERE id_equipo = 621 AND CHARINDEX(N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.142/MA.VI (id 622)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', N'03.01.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 622 AND CHARINDEX(N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.143/MA.VI (id 623)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', N'03.01.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 623 AND CHARINDEX(N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.144/MA.VI (id 624)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.06.25 Puesta en marcha por el area tecnica VI', N'09.06.25 Puesta en marcha por el area tecnica VI')
WHERE id_equipo = 624 AND CHARINDEX(N'- [09/11/2026] 09.06.25 Puesta en marcha por el area tecnica VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.145/MA.VI (id 625)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.12.25 Puesta en Marcha realizada por el area tecnica VI, equipo retorna de servicio tecnico dilaco - No corresponde informe de mantencion y/o reparacion ya que solo fue como equipo acompañante.', N'30.12.25 Puesta en Marcha realizada por el area tecnica VI, equipo retorna de servicio tecnico dilaco - No corresponde informe de mantencion y/o reparacion ya que solo fue como equipo acompañante.')
WHERE id_equipo = 625 AND CHARINDEX(N'- [09/11/2026] 30.12.25 Puesta en Marcha realizada por el area tecnica VI, equipo retorna de servicio tecnico dilaco - No corresponde informe de mantencion y/o reparacion ya que solo fue como equipo acompañante.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.146/MA.VI (id 626)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', N'03.01.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 626 AND CHARINDEX(N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.147/MA.VI (id 627)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', N'03.01.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 627 AND CHARINDEX(N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.148/MA.VI (id 628)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 06.05.25 Equipo retorna de servicio tecnico Dilaco, puesta en marcha conforme por el area tecnica PM.', N'06.05.25 Equipo retorna de servicio tecnico Dilaco, puesta en marcha conforme por el area tecnica PM.')
WHERE id_equipo = 628 AND CHARINDEX(N'- [09/11/2026] 06.05.25 Equipo retorna de servicio tecnico Dilaco, puesta en marcha conforme por el area tecnica PM.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.149/MA.VI (id 629)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', N'13.01.25 Puesta en Marcha por personal Dilaco')
WHERE id_equipo = 629 AND CHARINDEX(N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.15/MA.PM (id 497)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 497 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.150/MA.VI (id 630)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', N'13.01.25 Puesta en Marcha por personal Dilaco')
WHERE id_equipo = 630 AND CHARINDEX(N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.151/MA.VI (id 631)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', N'13.01.25 Puesta en Marcha por personal Dilaco')
WHERE id_equipo = 631 AND CHARINDEX(N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.152/MA.PM (id 632)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 632 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.153/MA.PM (id 633)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 633 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.154/MA.PM (id 634)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 19.08.25 Enviado a SEICO GD7800 por reparacion', N'19.08.25 Enviado a SEICO GD7800 por reparacion')
WHERE id_equipo = 634 AND CHARINDEX(N'- [09/11/2026] 19.08.25 Enviado a SEICO GD7800 por reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.155/MA.PM (id 635)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 635 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.156/MA.PM (id 636)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 636 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.157/MA.PM (id 637)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 637 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.158/MA.PM (id 638)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 638 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.159/MA.PM (id 639)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 639 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.16/MA.PM (id 498)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 498 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.160/MA.PM (id 640)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 640 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.161/MA.PM (id 641)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 641 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.162/MA.PM (id 642)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 642 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.163/MA.PM (id 643)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 643 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.164/MA.PM (id 644)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 644 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.165/MA.PM (id 645)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 645 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.166/MA.PM (id 646)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', N'04.07.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 646 AND CHARINDEX(N'- [09/11/2026] 04.07.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.167/MA.PM (id 647)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 647 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.168/MA.PM (id 648)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 648 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.169/MA.PM (id 649)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 649 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.17/MA.PM (id 499)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 499 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.170/MA.PM (id 650)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.07.25 Se realiza puesta en marcha', N'29.07.25 Se realiza puesta en marcha')
WHERE id_equipo = 650 AND CHARINDEX(N'- [09/11/2026] 29.07.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.171/MA.PM (id 651)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.07.25 Se realiza puesta en marcha', N'29.07.25 Se realiza puesta en marcha')
WHERE id_equipo = 651 AND CHARINDEX(N'- [09/11/2026] 29.07.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.172/MA.PM (id 652)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 652 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.173/MA.PM (id 653)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Sebastian Pallauta, presento su renuncia el 28.11.25, pero no contaba con este equipo en su poder', N'28.11.25 Sebastian Pallauta, presento su renuncia el 28.11.25, pero no contaba con este equipo en su poder')
WHERE id_equipo = 653 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Sebastian Pallauta, presento su renuncia el 28.11.25, pero no contaba con este equipo en su poder', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.174/MA.PM (id 654)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 654 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.175/MA.PM (id 655)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 655 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.176/MA.PM (id 656)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 656 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.177/MA.PM (id 657)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 657 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.178/MA.PM (id 658)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 658 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.179/MA.PM (id 659)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 659 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.18/MA.PM (id 500)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 500 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.180/MA.PM (id 660)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.03.26 Dada de baja por el area tecnica Carlos Gamboa - Pendiente informe de servicio tecnico SEICO', N'04.03.26 Dada de baja por el area tecnica Carlos Gamboa - Pendiente informe de servicio tecnico SEICO')
WHERE id_equipo = 660 AND CHARINDEX(N'- [09/11/2026] 04.03.26 Dada de baja por el area tecnica Carlos Gamboa - Pendiente informe de servicio tecnico SEICO', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.181/MA.PM (id 661)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 661 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.182/MA.PM (id 662)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 662 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.183/MA.PM (id 663)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Sebastian Pallauta, presento su renuncia el 28.11.25, pero no contaba con este equipo en su poder', N'28.11.25 Sebastian Pallauta, presento su renuncia el 28.11.25, pero no contaba con este equipo en su poder')
WHERE id_equipo = 663 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Sebastian Pallauta, presento su renuncia el 28.11.25, pero no contaba con este equipo en su poder', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.184/MA.PM (id 664)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', N'22.08.25 Se realiza puesta en marcha')
WHERE id_equipo = 664 AND CHARINDEX(N'- [09/11/2026] 22.08.25 Se realiza puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.185/MA.VI - Prestamo (id 665)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.12.25 Puesta en marcha realizada por el area tecnica', N'29.12.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 665 AND CHARINDEX(N'- [09/11/2026] 29.12.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.186/MA.VI - Prestamo (id 666)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', N'03.01.25 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 666 AND CHARINDEX(N'- [09/11/2026] 03.01.25 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.19/MA.VI (id 501)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 501 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.20/MA.VI (id 502)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 502 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.208/MA.PM (id 673)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.06.26 Puesta en marcha realizada por el area tecnica', N'12.06.26 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 673 AND CHARINDEX(N'- [09/11/2026] 12.06.26 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.216/MA.PM (id 674)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 674 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.221/MA.PM (id 672)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 10.06.26 Puesta en marcha realizada por el area tecnica', N'10.06.26 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 672 AND CHARINDEX(N'- [09/11/2026] 10.06.26 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.222/MA.PM (id 671)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 10.06.26 Puesta en marcha realizada por el area tecnica', N'10.06.26 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 671 AND CHARINDEX(N'- [09/11/2026] 10.06.26 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.24/MA.VI (id 506)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 506 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.25/MA.PM (id 507)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 507 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.26/MA.PM (id 508)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 508 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.27/MA.PM (id 509)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 509 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.29/MA.PM (id 510)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 510 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.30/MA.PM (id 511)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 511 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.32/MA.PM (id 512)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 512 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.33/MA.PM (id 513)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 513 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.34/MA.PM (id 514)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 514 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.35/MA.PM (id 515)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 515 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.36/MA.PM (id 516)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 516 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.37/MA.PM (id 517)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Bateria quemada // Dado de Baja 14-08-23', N'Bateria quemada // Dado de Baja 14-08-23')
WHERE id_equipo = 517 AND CHARINDEX(N'- [09/11/2026] Bateria quemada // Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.38/MA.PM (id 518)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 518 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.39/MA.PM (id 519)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 519 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.40/MA.PM (id 520)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 520 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.41/MA.PM (id 521)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 14-08-23', N'Dado de Baja 14-08-23')
WHERE id_equipo = 521 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.42/MA.PM (id 522)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 522 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.43/MA.PM (id 523)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 523 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.44/MA.PM (id 524)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 524 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.45/MA.PM (id 525)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 525 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.46/MA.VI (id 526)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 526 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.47/MA.VI (id 527)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 527 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.48/MA.VI (id 528)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 528 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.49/MA.VI (id 529)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 529 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.50/MA.VI (id 530)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 530 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.51/MA.PM (id 531)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de baja 09.09.24 Problemas de carga // Ingresa a Inventario 7.3.23 y se destina a sede Puerto Montt', N'Dado de baja 09.09.24 Problemas de carga // Ingresa a Inventario 7.3.23 y se destina a sede Puerto Montt')
WHERE id_equipo = 531 AND CHARINDEX(N'- [09/11/2026] Dado de baja 09.09.24 Problemas de carga // Ingresa a Inventario 7.3.23 y se destina a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.52/MA.PM (id 532)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 532 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.53/MA.PM (id 533)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 533 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.54/MA.PM (id 534)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 534 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.55/MA.PM (id 535)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 535 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.56/MA.PM (id 536)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', N'19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado')
WHERE id_equipo = 536 AND CHARINDEX(N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.57/MA.PM (id 537)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 537 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.58/MA.PM (id 538)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Bateria quemada // Dado de Baja 14-08-23 //  Ingresa a inventario 17.05.23 destinada a sede Puerto Montt', N'Bateria quemada // Dado de Baja 14-08-23 //  Ingresa a inventario 17.05.23 destinada a sede Puerto Montt')
WHERE id_equipo = 538 AND CHARINDEX(N'- [09/11/2026] Bateria quemada // Dado de Baja 14-08-23 //  Ingresa a inventario 17.05.23 destinada a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.59/MA.PM (id 539)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 539 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.60/MA.PM (id 540)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', N'Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23')
WHERE id_equipo = 540 AND CHARINDEX(N'- [09/11/2026] Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.61/MA.PM (id 541)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', N'19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado')
WHERE id_equipo = 541 AND CHARINDEX(N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.62/MA.PM (id 542)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', N'Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23')
WHERE id_equipo = 542 AND CHARINDEX(N'- [09/11/2026] Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.63/MA.PM (id 543)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 543 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.64/MA.PM (id 544)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 544 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.65/MA.PM (id 545)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Bateria quemada // Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', N'Bateria quemada // Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23')
WHERE id_equipo = 545 AND CHARINDEX(N'- [09/11/2026] Bateria quemada // Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.66/MA.PM (id 546)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', N'19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado')
WHERE id_equipo = 546 AND CHARINDEX(N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.67/MA.PM (id 547)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 547 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.68/MA.PM (id 548)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', N'Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23')
WHERE id_equipo = 548 AND CHARINDEX(N'- [09/11/2026] Ingresa a inventario 17.05.23 destinada a sede Puerto Montt - Dado de Baja 14-08-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.69/MA.PM (id 549)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', N'26.08.25 Dado de baja por el area tecnica por perdida de vida util')
WHERE id_equipo = 549 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dado de baja por el area tecnica por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.70/MA.PM (id 550)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de Baja 12-06-24', N'Dado de Baja 12-06-24')
WHERE id_equipo = 550 AND CHARINDEX(N'- [09/11/2026] Dado de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.71/MA.PM (id 551)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', N'26.08.25 Dada de baja por el area tecnica, por perdida de vida util')
WHERE id_equipo = 551 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.72/MA.PM (id 552)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', N'26.08.25 Dada de baja por el area tecnica, por perdida de vida util')
WHERE id_equipo = 552 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.73/MA.PM (id 553)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', N'26.08.25 Dada de baja por el area tecnica, por perdida de vida util')
WHERE id_equipo = 553 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.74/MA.PM (id 554)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', N'26.08.25 Dada de baja por el area tecnica, por perdida de vida util')
WHERE id_equipo = 554 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.75/MA.PM (id 555)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', N'19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado')
WHERE id_equipo = 555 AND CHARINDEX(N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.76/MA.PM (id 556)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', N'26.08.25 Dada de baja por el area tecnica, por perdida de vida util')
WHERE id_equipo = 556 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica, por perdida de vida util', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.77/MA.PM (id 557)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Bateria quemada // Ingresa a inventario 10.08.23 destinada a sede Puerto Montt', N'Bateria quemada // Ingresa a inventario 10.08.23 destinada a sede Puerto Montt')
WHERE id_equipo = 557 AND CHARINDEX(N'- [09/11/2026] Bateria quemada // Ingresa a inventario 10.08.23 destinada a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.78/MA.PM (id 558)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', N'19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado')
WHERE id_equipo = 558 AND CHARINDEX(N'- [09/11/2026] 19.11.24 Coordinador Mario Jofre da de baja baterias en mal estado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.79/MA.PM (id 559)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', N'16.10.24 Retorna de Servicio Tecnico, se da de baja')
WHERE id_equipo = 559 AND CHARINDEX(N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.80/MA.PM (id 560)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', N'16.10.24 Retorna de Servicio Tecnico, se da de baja')
WHERE id_equipo = 560 AND CHARINDEX(N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.81/MA.PM (id 561)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', N'16.10.24 Retorna de Servicio Tecnico, se da de baja')
WHERE id_equipo = 561 AND CHARINDEX(N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.82/MA.PM (id 562)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', N'16.10.24 Retorna de Servicio Tecnico, se da de baja')
WHERE id_equipo = 562 AND CHARINDEX(N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.83/MA.PM (id 563)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', N'16.10.24 Retorna de Servicio Tecnico, se da de baja')
WHERE id_equipo = 563 AND CHARINDEX(N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.84/MA.PM (id 564)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', N'16.10.24 Retorna de Servicio Tecnico, se da de baja')
WHERE id_equipo = 564 AND CHARINDEX(N'- [09/11/2026] 16.10.24 Retorna de Servicio Tecnico, se da de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.85/MA.PM (id 565)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dada de baja 05.09.24 Ingresa a inventario 10.08.23 destinada a sede Puerto Montt', N'Dada de baja 05.09.24 Ingresa a inventario 10.08.23 destinada a sede Puerto Montt')
WHERE id_equipo = 565 AND CHARINDEX(N'- [09/11/2026] Dada de baja 05.09.24 Ingresa a inventario 10.08.23 destinada a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.86/MA.PM (id 566)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dada de Baja 12-06-24', N'Dada de Baja 12-06-24')
WHERE id_equipo = 566 AND CHARINDEX(N'- [09/11/2026] Dada de Baja 12-06-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.87/MA.PM (id 567)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util,')
WHERE id_equipo = 567 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.88/MA.PM (id 568)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util,')
WHERE id_equipo = 568 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.89/MA.PM (id 569)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util,')
WHERE id_equipo = 569 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.90/MA.PM (id 570)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util,')
WHERE id_equipo = 570 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.91/MA.PM (id 571)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util,')
WHERE id_equipo = 571 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.92/MA.PM (id 572)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util,')
WHERE id_equipo = 572 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.93/MA.PM (id 573)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util,')
WHERE id_equipo = 573 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.94/MA.PM (id 574)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 574 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.95/MA.PM (id 575)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Bateria quemada // Dado de Baja 14-08-23 // Ingresa a inventario 07.03.24 destinada a sede Puerto Montt', N'Bateria quemada // Dado de Baja 14-08-23 // Ingresa a inventario 07.03.24 destinada a sede Puerto Montt')
WHERE id_equipo = 575 AND CHARINDEX(N'- [09/11/2026] Bateria quemada // Dado de Baja 14-08-23 // Ingresa a inventario 07.03.24 destinada a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.96/MA.PM (id 576)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', N'07.07.25 Dado de baja por el area tecnica')
WHERE id_equipo = 576 AND CHARINDEX(N'- [09/11/2026] 07.07.25 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.97/MA.PM (id 577)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Bateria quemada // Ingresa a inventario 07.03.24 destinada a sede Puerto Montt', N'Bateria quemada // Ingresa a inventario 07.03.24 destinada a sede Puerto Montt')
WHERE id_equipo = 577 AND CHARINDEX(N'- [09/11/2026] Bateria quemada // Ingresa a inventario 07.03.24 destinada a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.98/MA.PM (id 578)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 578 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BAT.99/MA.PM (id 579)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', N'26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.')
WHERE id_equipo = 579 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Dada de baja por el area tecnica por perdida de vida util, no se realizo puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BOC.10/MA.PM (id 297)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.03.25 Recepcion y puesta en marcha por el area tecnica, equipo operativo.', N'05.03.25 Recepcion y puesta en marcha por el area tecnica, equipo operativo.')
WHERE id_equipo = 297 AND CHARINDEX(N'- [09/11/2026] 05.03.25 Recepcion y puesta en marcha por el area tecnica, equipo operativo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BOC.11/MA.PM (id 298)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.03.26 Asignado a Ernesto Lira por Mario Jofre', N'26.03.26 Asignado a Ernesto Lira por Mario Jofre')
WHERE id_equipo = 298 AND CHARINDEX(N'- [09/11/2026] 26.03.26 Asignado a Ernesto Lira por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BOC.12/MA.PM (id 299)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.03.26 Equipo se encuentra en uso por Ariel Arias', N'25.03.26 Equipo se encuentra en uso por Ariel Arias')
WHERE id_equipo = 299 AND CHARINDEX(N'- [09/11/2026] 25.03.26 Equipo se encuentra en uso por Ariel Arias', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BOC.13/MA.PM (id 300)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pérdida informalmente avisada el 17.07.24', N'Pérdida informalmente avisada el 17.07.24')
WHERE id_equipo = 300 AND CHARINDEX(N'- [09/11/2026] Pérdida informalmente avisada el 17.07.24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BOC.14/MA.PM (id 301)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.26 Puesta en Marcha realizada por el area tecnica, en cotizacion adjunta se citan el servicio realizado,', N'27.02.26 Puesta en Marcha realizada por el area tecnica, en cotizacion adjunta se citan el servicio realizado,')
WHERE id_equipo = 301 AND CHARINDEX(N'- [09/11/2026] 27.02.26 Puesta en Marcha realizada por el area tecnica, en cotizacion adjunta se citan el servicio realizado,', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BOC.17/MA.PA (id 304)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.03.26 Asignado a Felipe Dimter por Mario Jofre', N'13.03.26 Asignado a Felipe Dimter por Mario Jofre')
WHERE id_equipo = 304 AND CHARINDEX(N'- [09/11/2026] 13.03.26 Asignado a Felipe Dimter por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- BOC.18/MA.PM (id 305)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.10.24 Asignado a Nicolas Soto', N'24.10.24 Asignado a Nicolas Soto')
WHERE id_equipo = 305 AND CHARINDEX(N'- [09/11/2026] 24.10.24 Asignado a Nicolas Soto', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.05/MA.PM (id 360)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Enviado a Servicio Técnico 25-07-2024. Ingreso a serv. Tecnico 26.07.24 (informe N°2353)', N'Enviado a Servicio Técnico 25-07-2024. Ingreso a serv. Tecnico 26.07.24 (informe N°2353)')
WHERE id_equipo = 360 AND CHARINDEX(N'- [09/11/2026] Enviado a Servicio Técnico 25-07-2024. Ingreso a serv. Tecnico 26.07.24 (informe N°2353)', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.06/MA.VI (id 361)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', N'05.12.24 Puesta en marcha personal Dilaco')
WHERE id_equipo = 361 AND CHARINDEX(N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.07/MA.VI (id 362)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', N'05.12.24 Puesta en marcha personal Dilaco')
WHERE id_equipo = 362 AND CHARINDEX(N'- [09/11/2026] 05.12.24 Puesta en marcha personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.08/MA.VI (id 363)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', N'13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25')
WHERE id_equipo = 363 AND CHARINDEX(N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.09/MA.VI (id 364)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', N'13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25')
WHERE id_equipo = 364 AND CHARINDEX(N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.10/MA.VI (id 365)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', N'13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25')
WHERE id_equipo = 365 AND CHARINDEX(N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.11/MA.VI (id 366)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', N'13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25')
WHERE id_equipo = 366 AND CHARINDEX(N'- [09/11/2026] 13.12.24 Puesta en marcha, recepcion, Puesta en marcha tecnica por personal DILACO con fecha 02.01.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.12/MA.VI (id 367)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', N'13.01.25 Puesta en Marcha por personal Dilaco')
WHERE id_equipo = 367 AND CHARINDEX(N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CBA.13/MA.VI (id 368)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', N'13.01.25 Puesta en Marcha por personal Dilaco')
WHERE id_equipo = 368 AND CHARINDEX(N'- [09/11/2026] 13.01.25 Puesta en Marcha por personal Dilaco', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.01/MA.PM (id 408)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Muestreador desvinculado, equipo asignado a Sede Puerto Montt', N'28.08.26 Muestreador desvinculado, equipo asignado a Sede Puerto Montt')
WHERE id_equipo = 408 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Muestreador desvinculado, equipo asignado a Sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.02/MA.AY (id 409)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', N'27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.')
WHERE id_equipo = 409 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.03/MA.PM (id 410)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', N'27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.')
WHERE id_equipo = 410 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.04/MA.PM (id 411)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.02.26 Puesta en marcha por el area tecnica PM, se adjunta informe Geodex Folio 3506', N'09.02.26 Puesta en marcha por el area tecnica PM, se adjunta informe Geodex Folio 3506')
WHERE id_equipo = 411 AND CHARINDEX(N'- [09/11/2026] 09.02.26 Puesta en marcha por el area tecnica PM, se adjunta informe Geodex Folio 3506', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.05/MA.PM (id 412)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', N'27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.')
WHERE id_equipo = 412 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.06/MA.PM (id 413)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 23.02.26 Puesta en marcha realizada por el area tecnica, informe Geodex folio 3505', N'23.02.26 Puesta en marcha realizada por el area tecnica, informe Geodex folio 3505')
WHERE id_equipo = 413 AND CHARINDEX(N'- [09/11/2026] 23.02.26 Puesta en marcha realizada por el area tecnica, informe Geodex folio 3505', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.07/MA.PM (id 414)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.09.25 Equipo dado de baja por el area tecnica, no tiene reparacion', N'26.09.25 Equipo dado de baja por el area tecnica, no tiene reparacion')
WHERE id_equipo = 414 AND CHARINDEX(N'- [09/11/2026] 26.09.25 Equipo dado de baja por el area tecnica, no tiene reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.08/MA.PM (id 415)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo figuraba a cargo de Sebastian Pallauta, pero no lo tenia a cargo, tenia el CDD.14/MA.PM', N'28.11.25 Equipo figuraba a cargo de Sebastian Pallauta, pero no lo tenia a cargo, tenia el CDD.14/MA.PM')
WHERE id_equipo = 415 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo figuraba a cargo de Sebastian Pallauta, pero no lo tenia a cargo, tenia el CDD.14/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.09/MA.PM (id 416)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 416 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.10/MA.VI (id 417)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 08.05.25 Aviso de envio a servicio tecnico Geodex', N'08.05.25 Aviso de envio a servicio tecnico Geodex')
WHERE id_equipo = 417 AND CHARINDEX(N'- [09/11/2026] 08.05.25 Aviso de envio a servicio tecnico Geodex', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.11/MA.VI (id 418)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', N'27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.')
WHERE id_equipo = 418 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Se genera documentacion, debido a que estos se pueden enviar a reparacion y generan informe de reparacion.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.12/MA.PM (id 419)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', N'27.02.25 Puesta en marcha, operativo (Equipo Nuevo)')
WHERE id_equipo = 419 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.13/MA.PM (id 420)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', N'27.02.25 Puesta en marcha, operativo (Equipo Nuevo)')
WHERE id_equipo = 420 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.14/MA.PM (id 421)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.12.25 Asignado a Ariel Arias, despachado a Chiloe.', N'15.12.25 Asignado a Ariel Arias, despachado a Chiloe.')
WHERE id_equipo = 421 AND CHARINDEX(N'- [09/11/2026] 15.12.25 Asignado a Ariel Arias, despachado a Chiloe.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.15/MA.PM (id 422)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', N'27.02.25 Puesta en marcha, operativo (Equipo Nuevo)')
WHERE id_equipo = 422 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.16/MA.PM (id 423)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', N'27.02.25 Puesta en marcha, operativo (Equipo Nuevo)')
WHERE id_equipo = 423 AND CHARINDEX(N'- [09/11/2026] 27.02.25 Puesta en marcha, operativo (Equipo Nuevo)', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.17/MA.AY (id 424)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 23.02.26 Puesta en marcha realizada por el area tecnica, informe geodex folio 3507', N'23.02.26 Puesta en marcha realizada por el area tecnica, informe geodex folio 3507')
WHERE id_equipo = 424 AND CHARINDEX(N'- [09/11/2026] 23.02.26 Puesta en marcha realizada por el area tecnica, informe geodex folio 3507', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.18/MA.AY (id 425)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.03.26 Enviado a Geodex GD8562 por reparacion', N'26.03.26 Enviado a Geodex GD8562 por reparacion')
WHERE id_equipo = 425 AND CHARINDEX(N'- [09/11/2026] 26.03.26 Enviado a Geodex GD8562 por reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.19/MA.PM (id 426)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Pablo Campos por Mario Jofre', N'18.05.26 Asignado a Pablo Campos por Mario Jofre')
WHERE id_equipo = 426 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Pablo Campos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.20/MA.PM (id 427)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 17.03.26 Ingreso a inventario y Puesta en Marcha', N'17.03.26 Ingreso a inventario y Puesta en Marcha')
WHERE id_equipo = 427 AND CHARINDEX(N'- [09/11/2026] 17.03.26 Ingreso a inventario y Puesta en Marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- CDD.21/MA.PM (id 428)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 428 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- DIS.02/MA.PM (id 384)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Operativo se encuentra en Bodega Puerto Montt 22.12.22', N'Operativo se encuentra en Bodega Puerto Montt 22.12.22')
WHERE id_equipo = 384 AND CHARINDEX(N'- [09/11/2026] Operativo se encuentra en Bodega Puerto Montt 22.12.22', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- DIS.03/MA.VI (id 385)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] sede villarrica 15.03.23', N'sede villarrica 15.03.23')
WHERE id_equipo = 385 AND CHARINDEX(N'- [09/11/2026] sede villarrica 15.03.23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- DIS.04/MA.PM (id 386)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Ingresa a inventario 17.05.23 destinado a sede Puerto Montt', N'Ingresa a inventario 17.05.23 destinado a sede Puerto Montt')
WHERE id_equipo = 386 AND CHARINDEX(N'- [09/11/2026] Ingresa a inventario 17.05.23 destinado a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- DIS.05/MA.PM (id 387)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Ingresa a inventario 17.05.23 destinado a sede Puerto Montt', N'Ingresa a inventario 17.05.23 destinado a sede Puerto Montt')
WHERE id_equipo = 387 AND CHARINDEX(N'- [09/11/2026] Ingresa a inventario 17.05.23 destinado a sede Puerto Montt', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- DRA.02/MA.PM (id 370)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 06.06.25 Puesta en marcha por el area tecnica', N'06.06.25 Puesta en marcha por el area tecnica')
WHERE id_equipo = 370 AND CHARINDEX(N'- [09/11/2026] 06.06.25 Puesta en marcha por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- FL-01 (id 433)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 433 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- FL-02 (id 434)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 434 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- FL-03 (id 435)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 435 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- FL-10 (id 442)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 442 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- FL-11 (id 443)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.03.26 Luis seiler hace entrega de este filtro a Mario Jofre al momento de ser desvinculado', N'16.03.26 Luis seiler hace entrega de este filtro a Mario Jofre al momento de ser desvinculado')
WHERE id_equipo = 443 AND CHARINDEX(N'- [09/11/2026] 16.03.26 Luis seiler hace entrega de este filtro a Mario Jofre al momento de ser desvinculado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- FL-12 (id 444)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 444 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.04/MA.AY (id 267)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.12.24 Puesta en marcha por asignacion a sebastian figueroa en sede aysen', N'16.12.24 Puesta en marcha por asignacion a sebastian figueroa en sede aysen')
WHERE id_equipo = 267 AND CHARINDEX(N'- [09/11/2026] 16.12.24 Puesta en marcha por asignacion a sebastian figueroa en sede aysen', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.09/MA.PM (id 268)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.10.24 Designado a Nicolás Soto', N'24.10.24 Designado a Nicolás Soto')
WHERE id_equipo = 268 AND CHARINDEX(N'- [09/11/2026] 24.10.24 Designado a Nicolás Soto', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.13/MA.VI (id 270)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Robado 12.07.24 Reemplazo por Equipo GPS.18/MA.VI 17.07.24', N'Robado 12.07.24 Reemplazo por Equipo GPS.18/MA.VI 17.07.24')
WHERE id_equipo = 270 AND CHARINDEX(N'- [09/11/2026] Robado 12.07.24 Reemplazo por Equipo GPS.18/MA.VI 17.07.24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.16/MA.PM (id 272)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Area tecnica no logra identificar este equipo y proceden a darlo de baja', N'28.08.26 Area tecnica no logra identificar este equipo y proceden a darlo de baja')
WHERE id_equipo = 272 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Area tecnica no logra identificar este equipo y proceden a darlo de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.17/MA.PM (id 273)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Pablo Campos por Mario Jofre', N'18.05.26 Asignado a Pablo Campos por Mario Jofre')
WHERE id_equipo = 273 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Pablo Campos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.18/MA.VI (id 274)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pertenecio a Luis Navarrete, reemplaza a GPS.13/MA.VI por robo 12.07.24', N'Pertenecio a Luis Navarrete, reemplaza a GPS.13/MA.VI por robo 12.07.24')
WHERE id_equipo = 274 AND CHARINDEX(N'- [09/11/2026] Pertenecio a Luis Navarrete, reemplaza a GPS.13/MA.VI por robo 12.07.24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.20/MA.PM (id 275)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 10.08-24 Equipo es trasladado a Sede Puerto Montt para su uso en la zona 1 mes aproximadamente, no se realiza cambio de rotulacion, se realiza puesta en marcha.', N'10.08-24 Equipo es trasladado a Sede Puerto Montt para su uso en la zona 1 mes aproximadamente, no se realiza cambio de rotulacion, se realiza puesta en marcha.')
WHERE id_equipo = 275 AND CHARINDEX(N'- [09/11/2026] 10.08-24 Equipo es trasladado a Sede Puerto Montt para su uso en la zona 1 mes aproximadamente, no se realiza cambio de rotulacion, se realiza puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.24/MA.AY (id 278)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.12.22 Ingresado a inventario y su puesta en marcha', N'20.12.22 Ingresado a inventario y su puesta en marcha')
WHERE id_equipo = 278 AND CHARINDEX(N'- [09/11/2026] 20.12.22 Ingresado a inventario y su puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.25/MA.PM (id 279)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.11.25 Asignado a Luis Seiler por Mario Jofre', N'18.11.25 Asignado a Luis Seiler por Mario Jofre')
WHERE id_equipo = 279 AND CHARINDEX(N'- [09/11/2026] 18.11.25 Asignado a Luis Seiler por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.26/MA.PM (id 280)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.12.22 Ingresado a inventario y su puesta en marcha', N'20.12.22 Ingresado a inventario y su puesta en marcha')
WHERE id_equipo = 280 AND CHARINDEX(N'- [09/11/2026] 20.12.22 Ingresado a inventario y su puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.27/MA.PM (id 281)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 17.06.26 Equipo dado de baja, cae accidentalmente al mar mientras el muestreador ejecutaba sus funciones', N'17.06.26 Equipo dado de baja, cae accidentalmente al mar mientras el muestreador ejecutaba sus funciones')
WHERE id_equipo = 281 AND CHARINDEX(N'- [09/11/2026] 17.06.26 Equipo dado de baja, cae accidentalmente al mar mientras el muestreador ejecutaba sus funciones', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.28/MA.PM (id 282)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Cristian Mellado por Mario Jofre', N'18.05.26 Asignado a Cristian Mellado por Mario Jofre')
WHERE id_equipo = 282 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Cristian Mellado por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.29/MA.VI (id 283)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.12.22 Ingresado a inventario y su puesta en marcha', N'20.12.22 Ingresado a inventario y su puesta en marcha')
WHERE id_equipo = 283 AND CHARINDEX(N'- [09/11/2026] 20.12.22 Ingresado a inventario y su puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.30/MA.PA (id 284)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.03.26 Asignado a Felipe Dimter por Mario Jofre', N'13.03.26 Asignado a Felipe Dimter por Mario Jofre')
WHERE id_equipo = 284 AND CHARINDEX(N'- [09/11/2026] 13.03.26 Asignado a Felipe Dimter por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.31/MA.VI (id 285)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 17.12.24 Equipo asignado a Mario Carcamo, cambio de rotulacion a VI', N'17.12.24 Equipo asignado a Mario Carcamo, cambio de rotulacion a VI')
WHERE id_equipo = 285 AND CHARINDEX(N'- [09/11/2026] 17.12.24 Equipo asignado a Mario Carcamo, cambio de rotulacion a VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.32/MA.PM (id 286)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.07.26 Asignado a Nicolas Mera por Gaston Teneb', N'07.07.26 Asignado a Nicolas Mera por Gaston Teneb')
WHERE id_equipo = 286 AND CHARINDEX(N'- [09/11/2026] 07.07.26 Asignado a Nicolas Mera por Gaston Teneb', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.34/MA.PM (id 288)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.08.23 Ingresado a inventario y puesta en marcha', N'29.08.23 Ingresado a inventario y puesta en marcha')
WHERE id_equipo = 288 AND CHARINDEX(N'- [09/11/2026] 29.08.23 Ingresado a inventario y puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.35/MA.PM (id 289)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.08.23 Ingresado a inventario y puesta en marcha', N'29.08.23 Ingresado a inventario y puesta en marcha')
WHERE id_equipo = 289 AND CHARINDEX(N'- [09/11/2026] 29.08.23 Ingresado a inventario y puesta en marcha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.36/MA.PM (id 290)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 06.12.24 Puesta en marcha por asignacion a Ariel Arias.', N'06.12.24 Puesta en marcha por asignacion a Ariel Arias.')
WHERE id_equipo = 290 AND CHARINDEX(N'- [09/11/2026] 06.12.24 Puesta en marcha por asignacion a Ariel Arias.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- GPS.37/MA.PM (id 291)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.03.26 Asignado a Ernesto Lira por Mario Jofre', N'26.03.26 Asignado a Ernesto Lira por Mario Jofre')
WHERE id_equipo = 291 AND CHARINDEX(N'- [09/11/2026] 26.03.26 Asignado a Ernesto Lira por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- HUI.01/MA.PM (id 431)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 06.06.25 Puesta en Marcha por el area tecnica', N'06.06.25 Puesta en Marcha por el area tecnica')
WHERE id_equipo = 431 AND CHARINDEX(N'- [09/11/2026] 06.06.25 Puesta en Marcha por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAG.01/MA.AY (id 380)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Operativo - AY 13.02.23', N'Operativo - AY 13.02.23')
WHERE id_equipo = 380 AND CHARINDEX(N'- [09/11/2026] Operativo - AY 13.02.23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.01/MA.PM (id 72)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.08.26 Equipo asignado a Sede Puerto Montt a cargo del Area Tecnica, requerimiento realizado por Mario Jofre', N'03.08.26 Equipo asignado a Sede Puerto Montt a cargo del Area Tecnica, requerimiento realizado por Mario Jofre')
WHERE id_equipo = 72 AND CHARINDEX(N'- [09/11/2026] 03.08.26 Equipo asignado a Sede Puerto Montt a cargo del Area Tecnica, requerimiento realizado por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.02/MA.PM (id 73)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 73 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.03/MA.PM (id 74)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3746 proxima mantencion 25.04.27 - Debe corregir el codigo cito VI en su codigo y es PM', N'25.04.26 Mantencion anual presencial, cumple informe ITM3746 proxima mantencion 25.04.27 - Debe corregir el codigo cito VI en su codigo y es PM')
WHERE id_equipo = 74 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3746 proxima mantencion 25.04.27 - Debe corregir el codigo cito VI en su codigo y es PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.04/MA.PM (id 75)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.08.26 Equipo asignado a Sede Puerto Montt a cargo del Area Tecnica, requerimiento realizado por Mario Jofre', N'03.08.26 Equipo asignado a Sede Puerto Montt a cargo del Area Tecnica, requerimiento realizado por Mario Jofre')
WHERE id_equipo = 75 AND CHARINDEX(N'- [09/11/2026] 03.08.26 Equipo asignado a Sede Puerto Montt a cargo del Area Tecnica, requerimiento realizado por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.05/MA.PM (id 76)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 06.04.26 Puesta en marcha realizada por el area tecnica', N'06.04.26 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 76 AND CHARINDEX(N'- [09/11/2026] 06.04.26 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.06/MA.PM (id 78)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.01.26 Puesta en marcha - Mantencion Anual 2025 Informe SEICO 26012 realizado el 30.12.2025', N'02.01.26 Puesta en marcha - Mantencion Anual 2025 Informe SEICO 26012 realizado el 30.12.2025')
WHERE id_equipo = 78 AND CHARINDEX(N'- [09/11/2026] 02.01.26 Puesta en marcha - Mantencion Anual 2025 Informe SEICO 26012 realizado el 30.12.2025', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.07/MA.PM (id 79)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 14.08.26 Puesta en marcha realizada por el area tecnica - Informe Geodex Folio 3996', N'14.08.26 Puesta en marcha realizada por el area tecnica - Informe Geodex Folio 3996')
WHERE id_equipo = 79 AND CHARINDEX(N'- [09/11/2026] 14.08.26 Puesta en marcha realizada por el area tecnica - Informe Geodex Folio 3996', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.07/MA.VI (id 80)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.01.26 Puesta en marcha por el area tecnica VI. Se realizo mantencion anual con servicio SEICO, informe Folio 25107 Mantencion realizada el 30.12.25 Equipo despachado a sede VI con fecha 06.01.26 GD 8313', N'09.01.26 Puesta en marcha por el area tecnica VI. Se realizo mantencion anual con servicio SEICO, informe Folio 25107 Mantencion realizada el 30.12.25 Equipo despachado a sede VI con fecha 06.01.26 GD 8313')
WHERE id_equipo = 80 AND CHARINDEX(N'- [09/11/2026] 09.01.26 Puesta en marcha por el area tecnica VI. Se realizo mantencion anual con servicio SEICO, informe Folio 25107 Mantencion realizada el 30.12.25 Equipo despachado a sede VI con fecha 06.01.26 GD 8313', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.08/MA.PM (id 81)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.03-26 Puesta en marcha por el area tecnica - Mantencion anual realizada por SEICO, informe anual folio 26023 fecha 27.02.26', N'04.03-26 Puesta en marcha por el area tecnica - Mantencion anual realizada por SEICO, informe anual folio 26023 fecha 27.02.26')
WHERE id_equipo = 81 AND CHARINDEX(N'- [09/11/2026] 04.03-26 Puesta en marcha por el area tecnica - Mantencion anual realizada por SEICO, informe anual folio 26023 fecha 27.02.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.09/MA.PM (id 82)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] SIGUE EN GEODEX ¿? - SIN REPARACION - Dado de baja por el area tecnica con fecha 26.05.26', N'SIGUE EN GEODEX ¿? - SIN REPARACION - Dado de baja por el area tecnica con fecha 26.05.26')
WHERE id_equipo = 82 AND CHARINDEX(N'- [09/11/2026] SIGUE EN GEODEX ¿? - SIN REPARACION - Dado de baja por el area tecnica con fecha 26.05.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.10/MA.PM (id 83)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Enviado a servicio técnico 27.02.24 guía de despacho N° 5864 (Le ingresa agua a placa madre) Falta informe Servicio Técnico', N'Enviado a servicio técnico 27.02.24 guía de despacho N° 5864 (Le ingresa agua a placa madre) Falta informe Servicio Técnico')
WHERE id_equipo = 83 AND CHARINDEX(N'- [09/11/2026] Enviado a servicio técnico 27.02.24 guía de despacho N° 5864 (Le ingresa agua a placa madre) Falta informe Servicio Técnico', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.11/MA.PM (id 84)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Cristobal Ramos por Mario Jofre', N'18.05.26 Asignado a Cristobal Ramos por Mario Jofre')
WHERE id_equipo = 84 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Cristobal Ramos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.12/MA.PM (id 85)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3742, proxima mantencion 25.04.27', N'25.04.26 Mantencion anual presencial, cumple informe ITM3742, proxima mantencion 25.04.27')
WHERE id_equipo = 85 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3742, proxima mantencion 25.04.27', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.13/MA.VI (id 86)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.01.25 Puesta en marcha por el area tecnica VI. Se realizo mantencion anual con servicio SEICO, informe Folio 25106 Mantencion realizada el 30.12.25 Equipo despachado a sede VI con fecha 06.01.26 GD 8313', N'09.01.25 Puesta en marcha por el area tecnica VI. Se realizo mantencion anual con servicio SEICO, informe Folio 25106 Mantencion realizada el 30.12.25 Equipo despachado a sede VI con fecha 06.01.26 GD 8313')
WHERE id_equipo = 86 AND CHARINDEX(N'- [09/11/2026] 09.01.25 Puesta en marcha por el area tecnica VI. Se realizo mantencion anual con servicio SEICO, informe Folio 25106 Mantencion realizada el 30.12.25 Equipo despachado a sede VI con fecha 06.01.26 GD 8313', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.14/MA.PM (id 87)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 14.09.26 Puesta en marcha realizada por el area tecnica. Se adjunta informe Geodex Folio 3975, el equipo fue destinado a reparacion el 21.07.26', N'14.09.26 Puesta en marcha realizada por el area tecnica. Se adjunta informe Geodex Folio 3975, el equipo fue destinado a reparacion el 21.07.26')
WHERE id_equipo = 87 AND CHARINDEX(N'- [09/11/2026] 14.09.26 Puesta en marcha realizada por el area tecnica. Se adjunta informe Geodex Folio 3975, el equipo fue destinado a reparacion el 21.07.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.15/MA.VI (id 88)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.06.26 Puesta en Marcha realizada por el area tecnica - Se adjunta informe 3850 emitido por Geodex', N'22.06.26 Puesta en Marcha realizada por el area tecnica - Se adjunta informe 3850 emitido por Geodex')
WHERE id_equipo = 88 AND CHARINDEX(N'- [09/11/2026] 22.06.26 Puesta en Marcha realizada por el area tecnica - Se adjunta informe 3850 emitido por Geodex', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.16/MA.PM (id 89)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3744, proxima mantencion 25.04.27', N'25.04.26 Mantencion anual presencial, cumple informe ITM3744, proxima mantencion 25.04.27')
WHERE id_equipo = 89 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3744, proxima mantencion 25.04.27', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.17/MA.PM (id 90)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.01.26 Puesta en marcha. Mantencion anual realiza el 30.12.25, informe SEICO Folio 25109', N'02.01.26 Puesta en marcha. Mantencion anual realiza el 30.12.25, informe SEICO Folio 25109')
WHERE id_equipo = 90 AND CHARINDEX(N'- [09/11/2026] 02.01.26 Puesta en marcha. Mantencion anual realiza el 30.12.25, informe SEICO Folio 25109', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.18/MA.AY (id 91)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.05.26 Puesta en Marcha base AY - Informe de mantencion SEICO folio 26059, con fecha de emision 28.03.26', N'02.05.26 Puesta en Marcha base AY - Informe de mantencion SEICO folio 26059, con fecha de emision 28.03.26')
WHERE id_equipo = 91 AND CHARINDEX(N'- [09/11/2026] 02.05.26 Puesta en Marcha base AY - Informe de mantencion SEICO folio 26059, con fecha de emision 28.03.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.19/MA.PM (id 92)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Angel Roa por Mario Jofre', N'18.05.26 Asignado a Angel Roa por Mario Jofre')
WHERE id_equipo = 92 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Angel Roa por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.20/MA.PM (id 93)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3739, proxima mantencion 25.04.27', N'25.04.26 Mantencion anual presencial, cumple informe ITM3739, proxima mantencion 25.04.27')
WHERE id_equipo = 93 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3739, proxima mantencion 25.04.27', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.21/MA.PM (id 94)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3741, proxima mantencion 25.04.27', N'25.04.26 Mantencion anual presencial, cumple informe ITM3741, proxima mantencion 25.04.27')
WHERE id_equipo = 94 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3741, proxima mantencion 25.04.27', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.22/MA.PM (id 95)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Angel Roa por Mario Jofre', N'18.05.26 Asignado a Angel Roa por Mario Jofre')
WHERE id_equipo = 95 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Angel Roa por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.23/MA.AY (id 96)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.01.26 Puesta en marcha por el area tecnica AY. Se adjunta informe de mantencion anual folio 3418 realizada el 30.12.25', N'02.01.26 Puesta en marcha por el area tecnica AY. Se adjunta informe de mantencion anual folio 3418 realizada el 30.12.25')
WHERE id_equipo = 96 AND CHARINDEX(N'- [09/11/2026] 02.01.26 Puesta en marcha por el area tecnica AY. Se adjunta informe de mantencion anual folio 3418 realizada el 30.12.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.24/MA.PM (id 97)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3740, proxima mantencion 25.04.27', N'25.04.26 Mantencion anual presencial, cumple informe ITM3740, proxima mantencion 25.04.27')
WHERE id_equipo = 97 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3740, proxima mantencion 25.04.27', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.25/MA.PM (id 98)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 98 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.26/MA.PM (id 99)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 99 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.27/MA.PM (id 100)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3738, proxima mantencion 25.04.27', N'25.04.26 Mantencion anual presencial, cumple informe ITM3738, proxima mantencion 25.04.27')
WHERE id_equipo = 100 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3738, proxima mantencion 25.04.27', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.28/MA.PM (id 101)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.08.26 Recepcion y puesta en marcha, informe de reparacion Geodex Folio 3995', N'12.08.26 Recepcion y puesta en marcha, informe de reparacion Geodex Folio 3995')
WHERE id_equipo = 101 AND CHARINDEX(N'- [09/11/2026] 12.08.26 Recepcion y puesta en marcha, informe de reparacion Geodex Folio 3995', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.29/MA.VI (id 102)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.01.26 Mantencion Anual presencial proveedor Dilaco informe 26013', N'28.01.26 Mantencion Anual presencial proveedor Dilaco informe 26013')
WHERE id_equipo = 102 AND CHARINDEX(N'- [09/11/2026] 28.01.26 Mantencion Anual presencial proveedor Dilaco informe 26013', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.30/MA.VI (id 103)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Enviado a servicio tecnico Dilaco por reparacion', N'15.07.26 Enviado a servicio tecnico Dilaco por reparacion')
WHERE id_equipo = 103 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Enviado a servicio tecnico Dilaco por reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.31/MA.VI (id 104)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.01.26 Mantencion Anual presencial proveedor Dilaco informe 26011', N'27.01.26 Mantencion Anual presencial proveedor Dilaco informe 26011')
WHERE id_equipo = 104 AND CHARINDEX(N'- [09/11/2026] 27.01.26 Mantencion Anual presencial proveedor Dilaco informe 26011', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.32/MA.VI (id 105)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.01.26 Mantencion Anual presencial proveedor Dilaco informe 26012', N'28.01.26 Mantencion Anual presencial proveedor Dilaco informe 26012')
WHERE id_equipo = 105 AND CHARINDEX(N'- [09/11/2026] 28.01.26 Mantencion Anual presencial proveedor Dilaco informe 26012', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.33/MA.VI (id 106)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Enviado a servicio tecnico Dilaco por reparacion', N'15.07.26 Enviado a servicio tecnico Dilaco por reparacion')
WHERE id_equipo = 106 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Enviado a servicio tecnico Dilaco por reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.34/MA.VI (id 107)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.01.26 Mantencion Anual presencial proveedor Dilaco informe 26008', N'26.01.26 Mantencion Anual presencial proveedor Dilaco informe 26008')
WHERE id_equipo = 107 AND CHARINDEX(N'- [09/11/2026] 26.01.26 Mantencion Anual presencial proveedor Dilaco informe 26008', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.35/MA.VI (id 108)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 10.03.26 Puesta en marcha VI, Informe Tecnico Dilaco 10586, Emision 25.02.26 - Adicionalmente el proveedor emite otro informe mas completo 10467.', N'10.03.26 Puesta en marcha VI, Informe Tecnico Dilaco 10586, Emision 25.02.26 - Adicionalmente el proveedor emite otro informe mas completo 10467.')
WHERE id_equipo = 108 AND CHARINDEX(N'- [09/11/2026] 10.03.26 Puesta en marcha VI, Informe Tecnico Dilaco 10586, Emision 25.02.26 - Adicionalmente el proveedor emite otro informe mas completo 10467.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.36/MA.VI (id 109)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.01.26 Mantencion Anual presencial proveedor Dilaco informe 26009', N'27.01.26 Mantencion Anual presencial proveedor Dilaco informe 26009')
WHERE id_equipo = 109 AND CHARINDEX(N'- [09/11/2026] 27.01.26 Mantencion Anual presencial proveedor Dilaco informe 26009', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.37/MA.VI - Prestamo (id 110)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.01.26 Puesta en marcha realizada por el area tecnica, Informe Tecnico Demo AS950 emitido el 13 de Noviembre 2025.', N'20.01.26 Puesta en marcha realizada por el area tecnica, Informe Tecnico Demo AS950 emitido el 13 de Noviembre 2025.')
WHERE id_equipo = 110 AND CHARINDEX(N'- [09/11/2026] 20.01.26 Puesta en marcha realizada por el area tecnica, Informe Tecnico Demo AS950 emitido el 13 de Noviembre 2025.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.38/MA.PM (id 111)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3745, proxima mantencion 25.04.27', N'25.04.26 Mantencion anual presencial, cumple informe ITM3745, proxima mantencion 25.04.27')
WHERE id_equipo = 111 AND CHARINDEX(N'- [09/11/2026] 25.04.26 Mantencion anual presencial, cumple informe ITM3745, proxima mantencion 25.04.27', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.39/MA.PM (id 676)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.26 Puesta en marcha realizada por el area tecnica, informe Geodex Folio 4065', N'16.09.26 Puesta en marcha realizada por el area tecnica, informe Geodex Folio 4065')
WHERE id_equipo = 676 AND CHARINDEX(N'- [09/11/2026] 16.09.26 Puesta en marcha realizada por el area tecnica, informe Geodex Folio 4065', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MAU.40/MA.PM (id 677)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.08.26 Equipo cuenta con el módulo de caudal nº de serie 218C02553 del MAU.01/MA.PM', N'04.08.26 Equipo cuenta con el módulo de caudal nº de serie 218C02553 del MAU.01/MA.PM')
WHERE id_equipo = 677 AND CHARINDEX(N'- [09/11/2026] 04.08.26 Equipo cuenta con el módulo de caudal nº de serie 218C02553 del MAU.01/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.19/MA.AY (id 112)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion Septiembre 2026', N'Proxima verificacion Septiembre 2026')
WHERE id_equipo = 112 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion Septiembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.20/MA.VI (id 113)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion Diciembre 2026', N'Proxima verificacion Diciembre 2026')
WHERE id_equipo = 113 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion Diciembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.22/MA.PM (id 114)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25076', N'30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25076')
WHERE id_equipo = 114 AND CHARINDEX(N'- [09/11/2026] 30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25076', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.23/MA.PM (id 115)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25068', N'30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25068')
WHERE id_equipo = 115 AND CHARINDEX(N'- [09/11/2026] 30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25068', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.25/MA.AY (id 116)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Aviso de envío a Servicio Técnico 20.03.24 - Ultimo dato - se desconoce cuando fue dada de baja', N'Aviso de envío a Servicio Técnico 20.03.24 - Ultimo dato - se desconoce cuando fue dada de baja')
WHERE id_equipo = 116 AND CHARINDEX(N'- [09/11/2026] Aviso de envío a Servicio Técnico 20.03.24 - Ultimo dato - se desconoce cuando fue dada de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.26/MA.PM (id 117)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.09.25 Dado de baja con informe del proveedro folio 25092', N'30.09.25 Dado de baja con informe del proveedro folio 25092')
WHERE id_equipo = 117 AND CHARINDEX(N'- [09/11/2026] 30.09.25 Dado de baja con informe del proveedro folio 25092', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.28/MA.VI (id 118)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion Septiembre 2026', N'Proxima verificacion Septiembre 2026')
WHERE id_equipo = 118 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion Septiembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.31/MA.PM (id 120)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 120 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.32/MA.PM (id 121)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 31.03.26 Verificaicon semestral SEICO Informe 26038 - No cumple - Sonda dada de baja', N'31.03.26 Verificaicon semestral SEICO Informe 26038 - No cumple - Sonda dada de baja')
WHERE id_equipo = 121 AND CHARINDEX(N'- [09/11/2026] 31.03.26 Verificaicon semestral SEICO Informe 26038 - No cumple - Sonda dada de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.33/MA.PM (id 122)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 122 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.34/MA.PM (id 123)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25065', N'30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25065')
WHERE id_equipo = 123 AND CHARINDEX(N'- [09/11/2026] 30.09.25 Sonda dada de baja, no cumple con verificacion externa - Informe SEICO 25065', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.35/MA.PM (id 124)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 124 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.36/MA.PM (id 125)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion Septiembre 2026', N'Proxima verificacion Septiembre 2026')
WHERE id_equipo = 125 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion Septiembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.37/MA.PM (id 126)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 126 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.38/MA.PM (id 127)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 127 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.39/MA.PM (id 128)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 31.01.25 Equipo dado de baja por el area tecnica', N'31.01.25 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 128 AND CHARINDEX(N'- [09/11/2026] 31.01.25 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.40/MA.PM (id 129)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 31.01.25 Sonda dada de baja por el area tecnica', N'31.01.25 Sonda dada de baja por el area tecnica')
WHERE id_equipo = 129 AND CHARINDEX(N'- [09/11/2026] 31.01.25 Sonda dada de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.41/MA.PM (id 130)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Septiembre 2026 Proxima verificacion', N'Septiembre 2026 Proxima verificacion')
WHERE id_equipo = 130 AND CHARINDEX(N'- [09/11/2026] Septiembre 2026 Proxima verificacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.42/MA.PM (id 131)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion Septiembre 2026', N'Proxima verificacion Septiembre 2026')
WHERE id_equipo = 131 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion Septiembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.43/MA.PM (id 132)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', N'16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.')
WHERE id_equipo = 132 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.44/MA.PM (id 133)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion Septiembre 2026', N'Proxima verificacion Septiembre 2026')
WHERE id_equipo = 133 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion Septiembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.45 MA.VI (id 134)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion Septiembre 2026', N'Proxima verificacion Septiembre 2026')
WHERE id_equipo = 134 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion Septiembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.46/MA.AY (id 135)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 31.03.26 Verificaicon semestral SEICO Informe 26040- No cumple - Sonda dada de baja - Informe corregido', N'31.03.26 Verificaicon semestral SEICO Informe 26040- No cumple - Sonda dada de baja - Informe corregido')
WHERE id_equipo = 135 AND CHARINDEX(N'- [09/11/2026] 31.03.26 Verificaicon semestral SEICO Informe 26040- No cumple - Sonda dada de baja - Informe corregido', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.47/MA.PM (id 136)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.09.25 Sonda dada de baja por el area tecnica - Conector en mal estado no se puede reparar.', N'12.09.25 Sonda dada de baja por el area tecnica - Conector en mal estado no se puede reparar.')
WHERE id_equipo = 136 AND CHARINDEX(N'- [09/11/2026] 12.09.25 Sonda dada de baja por el area tecnica - Conector en mal estado no se puede reparar.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.48/MA.VI (id 137)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion semestral; Octubre 2026', N'Proxima verificacion semestral; Octubre 2026')
WHERE id_equipo = 137 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion semestral; Octubre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.49/MA.PM (id 138)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 138 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.50/MA.PM (id 139)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 139 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.51/MA.VI (id 140)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.01.26 Dada de baja por area tecnica - Informe 26010', N'27.01.26 Dada de baja por area tecnica - Informe 26010')
WHERE id_equipo = 140 AND CHARINDEX(N'- [09/11/2026] 27.01.26 Dada de baja por area tecnica - Informe 26010', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.52/MA.VI (id 141)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', N'Octubre 2026 Proxima Verificacion semestral')
WHERE id_equipo = 141 AND CHARINDEX(N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.53/MA.VI (id 142)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', N'Octubre 2026 Proxima Verificacion semestral')
WHERE id_equipo = 142 AND CHARINDEX(N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.54/MA.VI (id 143)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', N'Octubre 2026 Proxima Verificacion semestral')
WHERE id_equipo = 143 AND CHARINDEX(N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.55/MA.VI (id 144)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', N'Octubre 2026 Proxima Verificacion semestral')
WHERE id_equipo = 144 AND CHARINDEX(N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.56/MA.VI (id 145)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.01.26 Dada de baja por area tecnica - Informe 26007', N'26.01.26 Dada de baja por area tecnica - Informe 26007')
WHERE id_equipo = 145 AND CHARINDEX(N'- [09/11/2026] 26.01.26 Dada de baja por area tecnica - Informe 26007', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.57/MA.VI (id 146)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', N'Octubre 2026 Proxima Verificacion semestral')
WHERE id_equipo = 146 AND CHARINDEX(N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.58/MA.VI (id 147)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Julio 2026 Proxima Verificacion semestral', N'Julio 2026 Proxima Verificacion semestral')
WHERE id_equipo = 147 AND CHARINDEX(N'- [09/11/2026] Julio 2026 Proxima Verificacion semestral', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.59/MA.PM (id 148)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', N'16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.')
WHERE id_equipo = 148 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.60/MA.PM (id 149)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', N'16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.')
WHERE id_equipo = 149 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.61/MA.PM (id 150)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', N'16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.')
WHERE id_equipo = 150 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.62/MA.PM (id 151)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 151 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.63/MA.PM (id 152)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 152 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.64/MA.PM (id 153)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima verificacion semestral; Septiembre 2026', N'Proxima verificacion semestral; Septiembre 2026')
WHERE id_equipo = 153 AND CHARINDEX(N'- [09/11/2026] Proxima verificacion semestral; Septiembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.65/MA.PM (id 154)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', N'16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.')
WHERE id_equipo = 154 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.66/MA.PM (id 155)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', N'02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130')
WHERE id_equipo = 155 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Aviso de envio a Proveedor SEICO, por motivos de la operacion la verificacion semestral programada para Septiembre 2026 se realizara en el Mes de Octubre GD9130', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.67/MA.PM (id 156)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', N'16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.')
WHERE id_equipo = 156 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.68/MA.PM (id 157)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', N'16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.')
WHERE id_equipo = 157 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Aviso de envio a SEICO GD9183, verificacion semestral externa. Si bien estaba programada para Septiembre 2026, esta fue reprogramada por el area tecnica para el mes de Octubre 2026.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.69/MA.VI - Prestamo (id 158)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', N'Octubre 2026 Proxima Verificacion semestral')
WHERE id_equipo = 158 AND CHARINDEX(N'- [09/11/2026] Octubre 2026 Proxima Verificacion semestral', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.70/MA.VI (id 159)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima Verificacion Octubre 2026', N'Proxima Verificacion Octubre 2026')
WHERE id_equipo = 159 AND CHARINDEX(N'- [09/11/2026] Proxima Verificacion Octubre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.71/MA.VI (id 160)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima Verificacion Octubre 2026', N'Proxima Verificacion Octubre 2026')
WHERE id_equipo = 160 AND CHARINDEX(N'- [09/11/2026] Proxima Verificacion Octubre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.72/MA.VI (id 161)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima Verificacion Octubre 2026', N'Proxima Verificacion Octubre 2026')
WHERE id_equipo = 161 AND CHARINDEX(N'- [09/11/2026] Proxima Verificacion Octubre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.73/MA.PM (id 162)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Proxima Verificacion Octubre 2026', N'Proxima Verificacion Octubre 2026')
WHERE id_equipo = 162 AND CHARINDEX(N'- [09/11/2026] Proxima Verificacion Octubre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCA.74/MA.AY (id 163)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Prox. Verif Semestral Noviembre 2026', N'Prox. Verif Semestral Noviembre 2026')
WHERE id_equipo = 163 AND CHARINDEX(N'- [09/11/2026] Prox. Verif Semestral Noviembre 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.08/MA.AY (id 234)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.09.25 Area tecnica informo que este equipo se encuentra dado de baja', N'22.09.25 Area tecnica informo que este equipo se encuentra dado de baja')
WHERE id_equipo = 234 AND CHARINDEX(N'- [09/11/2026] 22.09.25 Area tecnica informo que este equipo se encuentra dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.09/MA.PM (id 235)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion', N'28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion')
WHERE id_equipo = 235 AND CHARINDEX(N'- [09/11/2026] 28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.10/MA.PM (id 236)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 236 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.12/MA.PM (id 237)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Nicolas Uribe hace devolución de equipos a Pablo Flores por cambio de funciones 17.07.24', N'Nicolas Uribe hace devolución de equipos a Pablo Flores por cambio de funciones 17.07.24')
WHERE id_equipo = 237 AND CHARINDEX(N'- [09/11/2026] Nicolas Uribe hace devolución de equipos a Pablo Flores por cambio de funciones 17.07.24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.13/MA.PM (id 238)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.10.24 Designado a Pedro Lopez', N'24.10.24 Designado a Pedro Lopez')
WHERE id_equipo = 238 AND CHARINDEX(N'- [09/11/2026] 24.10.24 Designado a Pedro Lopez', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.17/MA.PM (id 242)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.10.26 Equipo actualmente en uso por Ariel Arias y se realiza la asignacion formal al muestreador por Mario Jofre', N'02.10.26 Equipo actualmente en uso por Ariel Arias y se realiza la asignacion formal al muestreador por Mario Jofre')
WHERE id_equipo = 242 AND CHARINDEX(N'- [09/11/2026] 02.10.26 Equipo actualmente en uso por Ariel Arias y se realiza la asignacion formal al muestreador por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.18/MA.PM (id 243)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.12.24 Cambio de sede, cambio de codigo VI a PM', N'09.12.24 Cambio de sede, cambio de codigo VI a PM')
WHERE id_equipo = 243 AND CHARINDEX(N'- [09/11/2026] 09.12.24 Cambio de sede, cambio de codigo VI a PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.19/MA.PM (id 244)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion', N'28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion')
WHERE id_equipo = 244 AND CHARINDEX(N'- [09/11/2026] 28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.20/MA.PM (id 245)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 14.05.26 Asignado a Nicolas Mera por Mario Jofre', N'14.05.26 Asignado a Nicolas Mera por Mario Jofre')
WHERE id_equipo = 245 AND CHARINDEX(N'- [09/11/2026] 14.05.26 Asignado a Nicolas Mera por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.21/MA.PM (id 246)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Ingreso a inventario y puesta en marcha 05-01-23', N'Ingreso a inventario y puesta en marcha 05-01-23')
WHERE id_equipo = 246 AND CHARINDEX(N'- [09/11/2026] Ingreso a inventario y puesta en marcha 05-01-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.22/MA.PM (id 247)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 10.08-24 Equipo es trasladado a Sede Puerto Montt para su uso en la zona 1 mes aproximadamente, no se realiza cambio de rotulacion, se realiza puesta en marcha.', N'10.08-24 Equipo es trasladado a Sede Puerto Montt para su uso en la zona 1 mes aproximadamente, no se realiza cambio de rotulacion, se realiza puesta en marcha.')
WHERE id_equipo = 247 AND CHARINDEX(N'- [09/11/2026] 10.08-24 Equipo es trasladado a Sede Puerto Montt para su uso en la zona 1 mes aproximadamente, no se realiza cambio de rotulacion, se realiza puesta en marcha.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.23/MA.AY (id 248)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Ingreso a inventario y puesta en marcha 05-01-23', N'Ingreso a inventario y puesta en marcha 05-01-23')
WHERE id_equipo = 248 AND CHARINDEX(N'- [09/11/2026] Ingreso a inventario y puesta en marcha 05-01-23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.24/MA.PA (id 249)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.03.26 Asignado a Felipe Dimter por Mario Jofre', N'13.03.26 Asignado a Felipe Dimter por Mario Jofre')
WHERE id_equipo = 249 AND CHARINDEX(N'- [09/11/2026] 13.03.26 Asignado a Felipe Dimter por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.25/MA.PM (id 250)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.10.24 Designado a Fernando Cardenas', N'24.10.24 Designado a Fernando Cardenas')
WHERE id_equipo = 250 AND CHARINDEX(N'- [09/11/2026] 24.10.24 Designado a Fernando Cardenas', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.26/MA.PM (id 251)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.01.25 Equipo asignado a Nicolas Soto', N'20.01.25 Equipo asignado a Nicolas Soto')
WHERE id_equipo = 251 AND CHARINDEX(N'- [09/11/2026] 20.01.25 Equipo asignado a Nicolas Soto', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.27/MA.PM (id 252)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion', N'28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion')
WHERE id_equipo = 252 AND CHARINDEX(N'- [09/11/2026] 28.08.26 De acuerdo a informe tecnico Hanna OTST39858 Equipo no tiene reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.28/MA.PM (id 253)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 253 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.29/MA.PM (id 254)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 14.05.26 Equipo dado de baja por el area tecnica, informe Hanna OTST40101', N'14.05.26 Equipo dado de baja por el area tecnica, informe Hanna OTST40101')
WHERE id_equipo = 254 AND CHARINDEX(N'- [09/11/2026] 14.05.26 Equipo dado de baja por el area tecnica, informe Hanna OTST40101', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.30/MA.PM (id 255)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Pablo Campos por Mario Jofre', N'18.05.26 Asignado a Pablo Campos por Mario Jofre')
WHERE id_equipo = 255 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Pablo Campos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.31/MA.PM (id 256)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.26 Recepcion de informe Hanna 40976, Equipo sin reparacion, dado de baja', N'16.09.26 Recepcion de informe Hanna 40976, Equipo sin reparacion, dado de baja')
WHERE id_equipo = 256 AND CHARINDEX(N'- [09/11/2026] 16.09.26 Recepcion de informe Hanna 40976, Equipo sin reparacion, dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.32/MA.VI (id 257)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.12.24 Puesta en marcha realizada en conjunto con Hanna Instruments', N'04.12.24 Puesta en marcha realizada en conjunto con Hanna Instruments')
WHERE id_equipo = 257 AND CHARINDEX(N'- [09/11/2026] 04.12.24 Puesta en marcha realizada en conjunto con Hanna Instruments', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.33/MA.AY (id 258)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.12.24 Puesta en marcha por asignacion a sebastian figueroa en sede aysen', N'16.12.24 Puesta en marcha por asignacion a sebastian figueroa en sede aysen')
WHERE id_equipo = 258 AND CHARINDEX(N'- [09/11/2026] 16.12.24 Puesta en marcha por asignacion a sebastian figueroa en sede aysen', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.34/MA.PM (id 259)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 23.10.25 Ricardo hace entrega de equipos por cese de funciones en ADL', N'23.10.25 Ricardo hace entrega de equipos por cese de funciones en ADL')
WHERE id_equipo = 259 AND CHARINDEX(N'- [09/11/2026] 23.10.25 Ricardo hace entrega de equipos por cese de funciones en ADL', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.35/MA.AY (id 260)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.09.25 Asignado a Liseth Llanos por Mario Jofre, se realiza cambio de codigo al equipo de PM a AY', N'26.09.25 Asignado a Liseth Llanos por Mario Jofre, se realiza cambio de codigo al equipo de PM a AY')
WHERE id_equipo = 260 AND CHARINDEX(N'- [09/11/2026] 26.09.25 Asignado a Liseth Llanos por Mario Jofre, se realiza cambio de codigo al equipo de PM a AY', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.36/MA.PM (id 261)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.03.26 Asignado a Ernesto Lira por Mario Jofre', N'26.03.26 Asignado a Ernesto Lira por Mario Jofre')
WHERE id_equipo = 261 AND CHARINDEX(N'- [09/11/2026] 26.03.26 Asignado a Ernesto Lira por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.37/MA.PM (id 262)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Asignado a Angel Roa por Mario Jofre', N'18.05.26 Asignado a Angel Roa por Mario Jofre')
WHERE id_equipo = 262 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Asignado a Angel Roa por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.38/MA.PM (id 263)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 10.09.26 Asignado de manera temporar a Cristian Mellado mientras reparan el MCL.31/MA.PM', N'10.09.26 Asignado de manera temporar a Cristian Mellado mientras reparan el MCL.31/MA.PM')
WHERE id_equipo = 263 AND CHARINDEX(N'- [09/11/2026] 10.09.26 Asignado de manera temporar a Cristian Mellado mientras reparan el MCL.31/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.39/MA.PM (id 264)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.03.26 Puesta en marcha realizada por el area tecnica.', N'05.03.26 Puesta en marcha realizada por el area tecnica.')
WHERE id_equipo = 264 AND CHARINDEX(N'- [09/11/2026] 05.03.26 Puesta en marcha realizada por el area tecnica.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MCL.40/MA.PM (id 265)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.03.26 Puesta en marcha realizada por el area tecnica.', N'05.03.26 Puesta en marcha realizada por el area tecnica.')
WHERE id_equipo = 265 AND CHARINDEX(N'- [09/11/2026] 05.03.26 Puesta en marcha realizada por el area tecnica.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.01/MA.AY (id 306)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.10.26 Verificacion de T°', N'13.10.26 Verificacion de T°')
WHERE id_equipo = 306 AND CHARINDEX(N'- [09/11/2026] 13.10.26 Verificacion de T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.05/MA.PM (id 308)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 308 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.06/MA.VI (id 310)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pendiente Octubre 2025', N'Pendiente Octubre 2025')
WHERE id_equipo = 310 AND CHARINDEX(N'- [09/11/2026] Pendiente Octubre 2025', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.07/MA.PM (id 312)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 312 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.08/MA.PM (id 314)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 314 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.09/MA.VI (id 316)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pendiente Abril 2026', N'Pendiente Abril 2026')
WHERE id_equipo = 316 AND CHARINDEX(N'- [09/11/2026] Pendiente Abril 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.10/MA.PM (id 318)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 318 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [30/10/2026] Verificación intermedia de temperatura (OI-FoGe-39, ficha N° 1): NO CUMPLE. Error 0/15/30 °C: 3,1 / 1,8 / -22,9.', N'Verificación intermedia de temperatura (OI-FoGe-39, ficha N° 1): NO CUMPLE. Error 0/15/30 °C: 3,1 / 1,8 / -22,9.')
WHERE id_equipo = 318 AND CHARINDEX(N'- [30/10/2026] Verificación intermedia de temperatura (OI-FoGe-39, ficha N° 1): NO CUMPLE. Error 0/15/30 °C: 3,1 / 1,8 / -22,9.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.11/MA.PM (id 320)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 320 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.12/MA.PM (id 322)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 322 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOD.14/MA.PM (id 326)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.07.26 Verificacion de temperatura', N'30.07.26 Verificacion de temperatura')
WHERE id_equipo = 326 AND CHARINDEX(N'- [09/11/2026] 30.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOL.01/MA.PM (id 292)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] >>actualizar fecha de dado de baja a 06.01.26<<', N'>>actualizar fecha de dado de baja a 06.01.26<<')
WHERE id_equipo = 292 AND CHARINDEX(N'- [09/11/2026] >>actualizar fecha de dado de baja a 06.01.26<<', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MOL.02/MA.PM (id 293)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 23.01.26 Puesta en marcha por el area tecnica - se adjunta informe y/o certificado de verificacion SEICO Folio 26002 - Emision 19.01.26, equipo cumple como equipo movil, pero no como patron.', N'23.01.26 Puesta en marcha por el area tecnica - se adjunta informe y/o certificado de verificacion SEICO Folio 26002 - Emision 19.01.26, equipo cumple como equipo movil, pero no como patron.')
WHERE id_equipo = 293 AND CHARINDEX(N'- [09/11/2026] 23.01.26 Puesta en marcha por el area tecnica - se adjunta informe y/o certificado de verificacion SEICO Folio 26002 - Emision 19.01.26, equipo cumple como equipo movil, pero no como patron.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MPA.02/MA.PM (id 343)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 343 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MPA.03/MA.PM (id 345)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Envío servicio técnico 11.10.23 y se da de baja 26.10.23 (Asociada SON.03/MA.PM)', N'Envío servicio técnico 11.10.23 y se da de baja 26.10.23 (Asociada SON.03/MA.PM)')
WHERE id_equipo = 345 AND CHARINDEX(N'- [09/11/2026] Envío servicio técnico 11.10.23 y se da de baja 26.10.23 (Asociada SON.03/MA.PM)', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MPA.04/MA.PM (id 346)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 346 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MPA.05/MA.PM (id 348)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 348 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MPA.06/MA.PM (id 350)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.07.26 Verificacion de temperatura', N'02.07.26 Verificacion de temperatura')
WHERE id_equipo = 350 AND CHARINDEX(N'- [09/11/2026] 02.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MPA.07/MA.PM (id 352)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 352 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MPA.08/MA.PM (id 354)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.03.26 Area tecnica deja fuera de uso este equipo por no uso', N'30.03.26 Area tecnica deja fuera de uso este equipo por no uso')
WHERE id_equipo = 354 AND CHARINDEX(N'- [09/11/2026] 30.03.26 Area tecnica deja fuera de uso este equipo por no uso', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MpH.02/MA.PM (id 332)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.10.23 se da de baja junto a TMC.03/MA.PM (Informe Hanna Instruments N° 33331) Nicolás Uribe', N'12.10.23 se da de baja junto a TMC.03/MA.PM (Informe Hanna Instruments N° 33331) Nicolás Uribe')
WHERE id_equipo = 332 AND CHARINDEX(N'- [09/11/2026] 12.10.23 se da de baja junto a TMC.03/MA.PM (Informe Hanna Instruments N° 33331) Nicolás Uribe', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MpH.05/MA.PM (id 334)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.04.25 Equipo dado de baja por el area tecnica MAM', N'03.04.25 Equipo dado de baja por el area tecnica MAM')
WHERE id_equipo = 334 AND CHARINDEX(N'- [09/11/2026] 03.04.25 Equipo dado de baja por el area tecnica MAM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MpH.06/MA.PM (id 336)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', N'29.06.26 Dado de baja por el area tecnica')
WHERE id_equipo = 336 AND CHARINDEX(N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MpH.07/MA.PM (id 338)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.04.25 Verificacion intermedia de temperatura - parametros fuera de rango - Equipo dado de baja por el area tecnica.', N'03.04.25 Verificacion intermedia de temperatura - parametros fuera de rango - Equipo dado de baja por el area tecnica.')
WHERE id_equipo = 338 AND CHARINDEX(N'- [09/11/2026] 03.04.25 Verificacion intermedia de temperatura - parametros fuera de rango - Equipo dado de baja por el area tecnica.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MpH.08/MA.PM (id 340)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', N'29.06.26 Dado de baja por el area tecnica')
WHERE id_equipo = 340 AND CHARINDEX(N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- MSU.01/MA.VI (id 429)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.02.25 Equipo retorna de servicio tecnico, se realiza puesta en marcha por el area tecnica', N'24.02.25 Equipo retorna de servicio tecnico, se realiza puesta en marcha por el area tecnica')
WHERE id_equipo = 429 AND CHARINDEX(N'- [09/11/2026] 24.02.25 Equipo retorna de servicio tecnico, se realiza puesta en marcha por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- PED.06/MA.PM (id 403)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.02.2025 Extraviado por el muestreador', N'07.02.2025 Extraviado por el muestreador')
WHERE id_equipo = 403 AND CHARINDEX(N'- [09/11/2026] 07.02.2025 Extraviado por el muestreador', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.100/MA.PM (id 47)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', N'09.03.26 Dado de baja por el area tecnica')
WHERE id_equipo = 47 AND CHARINDEX(N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.101/MA.PM (id 48)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Dado de baja por el area tecnica', N'16.02.26 Dado de baja por el area tecnica')
WHERE id_equipo = 48 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.102/MA.PM (id 49)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.07.26 Equipo dado de baja por el Area tecnica, Angelo Chiesa informa que mientras realizaba mediciones en terreno el sensor se quebro.', N'09.07.26 Equipo dado de baja por el Area tecnica, Angelo Chiesa informa que mientras realizaba mediciones en terreno el sensor se quebro.')
WHERE id_equipo = 49 AND CHARINDEX(N'- [09/11/2026] 09.07.26 Equipo dado de baja por el Area tecnica, Angelo Chiesa informa que mientras realizaba mediciones en terreno el sensor se quebro.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.103/MA.PM (id 50)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.07.26 Verificacion de Temperatura', N'02.07.26 Verificacion de Temperatura')
WHERE id_equipo = 50 AND CHARINDEX(N'- [09/11/2026] 02.07.26 Verificacion de Temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.104/MA.PM (id 51)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.08.25 Dado de baja, equipo se cae al agua sin reparacion', N'13.08.25 Dado de baja, equipo se cae al agua sin reparacion')
WHERE id_equipo = 51 AND CHARINDEX(N'- [09/11/2026] 13.08.25 Dado de baja, equipo se cae al agua sin reparacion', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.105/MA.PM (id 52)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.08.26 Recepcion de informe Hanna OTST 40668, Equipo sin reparacion y dado de baja por el area tecnica', N'07.08.26 Recepcion de informe Hanna OTST 40668, Equipo sin reparacion y dado de baja por el area tecnica')
WHERE id_equipo = 52 AND CHARINDEX(N'- [09/11/2026] 07.08.26 Recepcion de informe Hanna OTST 40668, Equipo sin reparacion y dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.106/MA.PM (id 53)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 53 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.107/MA.PM (id 54)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.05.26 Equipo dado de baja por Mario Jofre, calibraciones fuera de rango.', N'26.05.26 Equipo dado de baja por Mario Jofre, calibraciones fuera de rango.')
WHERE id_equipo = 54 AND CHARINDEX(N'- [09/11/2026] 26.05.26 Equipo dado de baja por Mario Jofre, calibraciones fuera de rango.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.108/MA.PM (id 55)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 55 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.109/MA.PM (id 56)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 56 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.110/MA.AY (id 57)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.10.26 Verificacion de T°', N'13.10.26 Verificacion de T°')
WHERE id_equipo = 57 AND CHARINDEX(N'- [09/11/2026] 13.10.26 Verificacion de T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.111/MA.VI (id 58)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 58 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.112/MA.VI (id 59)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Mario Informa por correo que este equipo esta como prestamo en sede PM, pero no informo cuando retorno de VI a PM', N'01.10.26 Mario Informa por correo que este equipo esta como prestamo en sede PM, pero no informo cuando retorno de VI a PM')
WHERE id_equipo = 59 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Mario Informa por correo que este equipo esta como prestamo en sede PM, pero no informo cuando retorno de VI a PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.114/MA.PM (id 61)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 61 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.116/MA.PM (id 63)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 05.03.26 Verif. Inicial, equipo nuevo', N'05.03.26 Verif. Inicial, equipo nuevo')
WHERE id_equipo = 63 AND CHARINDEX(N'- [29/10/2026] 05.03.26 Verif. Inicial, equipo nuevo', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.117/MA.PM (id 64)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.26 Puesta en marcha realizada por el area tecnica, informe adjunto OTST40668', N'16.09.26 Puesta en marcha realizada por el area tecnica, informe adjunto OTST40668')
WHERE id_equipo = 64 AND CHARINDEX(N'- [09/11/2026] 16.09.26 Puesta en marcha realizada por el area tecnica, informe adjunto OTST40668', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.118/MA.PM (id 65)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 65 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.119/MA.PM (id 66)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 66 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.120/MA.PM (id 67)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 21.07.26 Verificacion de Temperatura', N'21.07.26 Verificacion de Temperatura')
WHERE id_equipo = 67 AND CHARINDEX(N'- [09/11/2026] 21.07.26 Verificacion de Temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.121/MA.PM (id 68)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 68 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.122/MA.PM (id 69)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 69 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.123/MA.PM (id 70)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.07.26 Verificacion de temperatura', N'02.07.26 Verificacion de temperatura')
WHERE id_equipo = 70 AND CHARINDEX(N'- [09/11/2026] 02.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.124/MA.PM (id 71)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.26 Recepcion de informe OTST40879, Equipo dado de baja', N'16.09.26 Recepcion de informe OTST40879, Equipo dado de baja')
WHERE id_equipo = 71 AND CHARINDEX(N'- [09/11/2026] 16.09.26 Recepcion de informe OTST40879, Equipo dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.35/MA.PM (id 670)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.01.25 Equipo no enciende, dado de baja por el area tecnica', N'22.01.25 Equipo no enciende, dado de baja por el area tecnica')
WHERE id_equipo = 670 AND CHARINDEX(N'- [09/11/2026] 22.01.25 Equipo no enciende, dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.43/MA.AY (id 3)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.', N'07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.')
WHERE id_equipo = 3 AND CHARINDEX(N'- [09/11/2026] 07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.44/MA.PM (id 4)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 11.10.24 Equipo extraviado, de acuerdo a lo que informó Itiare Vera', N'11.10.24 Equipo extraviado, de acuerdo a lo que informó Itiare Vera')
WHERE id_equipo = 4 AND CHARINDEX(N'- [09/11/2026] 11.10.24 Equipo extraviado, de acuerdo a lo que informó Itiare Vera', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.54/MA.VI (id 6)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.02.25 Equipo dado de baja por el area tecnica, figuraba como extraviado.', N'18.02.25 Equipo dado de baja por el area tecnica, figuraba como extraviado.')
WHERE id_equipo = 6 AND CHARINDEX(N'- [09/11/2026] 18.02.25 Equipo dado de baja por el area tecnica, figuraba como extraviado.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.56/MA.AY (id 7)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Extraviado informado por Sebastían Barría 19-01-2023', N'Extraviado informado por Sebastían Barría 19-01-2023')
WHERE id_equipo = 7 AND CHARINDEX(N'- [09/11/2026] Extraviado informado por Sebastían Barría 19-01-2023', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.60/MA.AY (id 8)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.', N'07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.')
WHERE id_equipo = 8 AND CHARINDEX(N'- [09/11/2026] 07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.61/MA.AY (id 9)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.05.24 aviso que presenta problemas de calibración y verificación, en el cual los buffer no los reconoce o reconoce erróneamente // Dado de baja', N'03.05.24 aviso que presenta problemas de calibración y verificación, en el cual los buffer no los reconoce o reconoce erróneamente // Dado de baja')
WHERE id_equipo = 9 AND CHARINDEX(N'- [09/11/2026] 03.05.24 aviso que presenta problemas de calibración y verificación, en el cual los buffer no los reconoce o reconoce erróneamente // Dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.62/MA.AY (id 10)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.', N'07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.')
WHERE id_equipo = 10 AND CHARINDEX(N'- [09/11/2026] 07.05.25 No se realiza verificacion  de temperatura durante el mes de abril ya que el equipo fue dado de baja dentro del mes por recambio de equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.64/MA.PM (id 11)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', N'16.09.24 Equipo dado de baja, no cumple con NCh 2313/1')
WHERE id_equipo = 11 AND CHARINDEX(N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.65/MA.PM (id 12)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.05.24 Área terreno da de baja el equipo problemas de medición 16.09.24', N'07.05.24 Área terreno da de baja el equipo problemas de medición 16.09.24')
WHERE id_equipo = 12 AND CHARINDEX(N'- [09/11/2026] 07.05.24 Área terreno da de baja el equipo problemas de medición 16.09.24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.66/MA.PM (id 13)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', N'16.09.24 Equipo dado de baja, no cumple con NCh 2313/1')
WHERE id_equipo = 13 AND CHARINDEX(N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.67/MA.PM (id 14)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pérdido y avisado 22.01.23', N'Pérdido y avisado 22.01.23')
WHERE id_equipo = 14 AND CHARINDEX(N'- [09/11/2026] Pérdido y avisado 22.01.23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.68/MA.PM (id 15)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', N'16.09.24 Equipo dado de baja, no cumple con NCh 2313/1')
WHERE id_equipo = 15 AND CHARINDEX(N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.69/MA.PM (id 16)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', N'16.09.24 Equipo dado de baja, no cumple con NCh 2313/1')
WHERE id_equipo = 16 AND CHARINDEX(N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.70/MA.PA (id 17)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', N'16.09.24 Equipo dado de baja, no cumple con NCh 2313/1')
WHERE id_equipo = 17 AND CHARINDEX(N'- [09/11/2026] 16.09.24 Equipo dado de baja, no cumple con NCh 2313/1', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.71/MA.PM (id 18)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.12.25 Equipo dado de baja por el area tecnica, tecnico informa que sensor no reconoce pH4 y 7', N'12.12.25 Equipo dado de baja por el area tecnica, tecnico informa que sensor no reconoce pH4 y 7')
WHERE id_equipo = 18 AND CHARINDEX(N'- [09/11/2026] 12.12.25 Equipo dado de baja por el area tecnica, tecnico informa que sensor no reconoce pH4 y 7', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.72/MA.PM (id 19)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.10.24 Equipo dado de baja, informe tecnico Hanna 35573, oxidacion - sulfatacion - humedad interior', N'24.10.24 Equipo dado de baja, informe tecnico Hanna 35573, oxidacion - sulfatacion - humedad interior')
WHERE id_equipo = 19 AND CHARINDEX(N'- [09/11/2026] 24.10.24 Equipo dado de baja, informe tecnico Hanna 35573, oxidacion - sulfatacion - humedad interior', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.73/MA.PM (id 20)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 14.05.25 Equipo dado de baja, se asigna en reemplazo pHp.100/MA.PM', N'14.05.25 Equipo dado de baja, se asigna en reemplazo pHp.100/MA.PM')
WHERE id_equipo = 20 AND CHARINDEX(N'- [09/11/2026] 14.05.25 Equipo dado de baja, se asigna en reemplazo pHp.100/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.74/MA.PM (id 21)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Se informa rótura de pantalla del equipo 13.02.2024 por parte del Jefe de Terreno - Alejandra Olavarria no trabaja actualmente en ADL', N'Se informa rótura de pantalla del equipo 13.02.2024 por parte del Jefe de Terreno - Alejandra Olavarria no trabaja actualmente en ADL')
WHERE id_equipo = 21 AND CHARINDEX(N'- [09/11/2026] Se informa rótura de pantalla del equipo 13.02.2024 por parte del Jefe de Terreno - Alejandra Olavarria no trabaja actualmente en ADL', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.75/MA.PA (id 1)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.09.26 Puesta en Marcha y verificacion de temperatura en PM, equipo actualmente en PM', N'07.09.26 Puesta en Marcha y verificacion de temperatura en PM, equipo actualmente en PM')
WHERE id_equipo = 1 AND CHARINDEX(N'- [09/11/2026] 07.09.26 Puesta en Marcha y verificacion de temperatura en PM, equipo actualmente en PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.76/MA.PM (id 23)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', N'09.03.26 Dado de baja por el area tecnica')
WHERE id_equipo = 23 AND CHARINDEX(N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.77/MA.PM (id 24)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 24 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.78/MA.PA (id 25)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.08.26 Puesta en marcha PA', N'30.08.26 Puesta en marcha PA')
WHERE id_equipo = 25 AND CHARINDEX(N'- [09/11/2026] 30.08.26 Puesta en marcha PA', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.79/MA.PM (id 26)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 14.05.25 Equipo dado de baja, se asigna en reemplazo pHp.102/MA.PM', N'14.05.25 Equipo dado de baja, se asigna en reemplazo pHp.102/MA.PM')
WHERE id_equipo = 26 AND CHARINDEX(N'- [09/11/2026] 14.05.25 Equipo dado de baja, se asigna en reemplazo pHp.102/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.80/MA.PM (id 27)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 22.01.24 Equipo dado de baja por el area tecnica', N'22.01.24 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 27 AND CHARINDEX(N'- [09/11/2026] 22.01.24 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.82/MA.AY (id 29)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.10.24 Equipo extraviado', N'25.10.24 Equipo extraviado')
WHERE id_equipo = 29 AND CHARINDEX(N'- [09/11/2026] 25.10.24 Equipo extraviado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.83/MA.PM (id 30)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.09.25 Dado de baja por el area tecnica por falla en el sensor', N'03.09.25 Dado de baja por el area tecnica por falla en el sensor')
WHERE id_equipo = 30 AND CHARINDEX(N'- [09/11/2026] 03.09.25 Dado de baja por el area tecnica por falla en el sensor', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.84/MA.PM (id 31)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.07.25 Equipo dado de baja por el area tecnica.', N'09.07.25 Equipo dado de baja por el area tecnica.')
WHERE id_equipo = 31 AND CHARINDEX(N'- [09/11/2026] 09.07.25 Equipo dado de baja por el area tecnica.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.85/MA.PM (id 32)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.09.24 Extraviado, de acuerdo a lo informado por Itiare Vera', N'27.09.24 Extraviado, de acuerdo a lo informado por Itiare Vera')
WHERE id_equipo = 32 AND CHARINDEX(N'- [09/11/2026] 27.09.24 Extraviado, de acuerdo a lo informado por Itiare Vera', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.86/MA.PM (id 33)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.02.25 Equipo dado de baja', N'18.02.25 Equipo dado de baja')
WHERE id_equipo = 33 AND CHARINDEX(N'- [09/11/2026] 18.02.25 Equipo dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.87/MA.VI (id 34)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 34 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.88/MA.VI (id 35)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 35 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.89/MA.VI (id 36)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.04.26 Equipo dado de baja por el area tecnica, no reconoce buffer en consencuencia no mide temperatura', N'29.04.26 Equipo dado de baja por el area tecnica, no reconoce buffer en consencuencia no mide temperatura')
WHERE id_equipo = 36 AND CHARINDEX(N'- [09/11/2026] 29.04.26 Equipo dado de baja por el area tecnica, no reconoce buffer en consencuencia no mide temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.90/MA.PM (id 37)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', N'09.03.26 Dado de baja por el area tecnica')
WHERE id_equipo = 37 AND CHARINDEX(N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.91/MA.PM (id 38)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 38 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.92/MA.PM (id 39)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', N'09.03.26 Dado de baja por el area tecnica')
WHERE id_equipo = 39 AND CHARINDEX(N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.93/MA.AY (id 40)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.10.26 Verificacion de T°', N'13.10.26 Verificacion de T°')
WHERE id_equipo = 40 AND CHARINDEX(N'- [09/11/2026] 13.10.26 Verificacion de T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.94/MA.AY (id 41)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.10.26 Verificacion de T°', N'13.10.26 Verificacion de T°')
WHERE id_equipo = 41 AND CHARINDEX(N'- [09/11/2026] 13.10.26 Verificacion de T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.95/MA.AY (id 42)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.03.26 Area tecnica informa que el equipo fue dado de baja', N'20.03.26 Area tecnica informa que el equipo fue dado de baja')
WHERE id_equipo = 42 AND CHARINDEX(N'- [09/11/2026] 20.03.26 Area tecnica informa que el equipo fue dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.96/MA.AY (id 43)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.03.26 Area tecnica informa que el equipo fue dado de baja', N'20.03.26 Area tecnica informa que el equipo fue dado de baja')
WHERE id_equipo = 43 AND CHARINDEX(N'- [09/11/2026] 20.03.26 Area tecnica informa que el equipo fue dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.97/MA.PM (id 44)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.11.25 Equipo dado de baja por el area tecnica. Se reutiliza sensor en pHp.98/MA.PM', N'18.11.25 Equipo dado de baja por el area tecnica. Se reutiliza sensor en pHp.98/MA.PM')
WHERE id_equipo = 44 AND CHARINDEX(N'- [09/11/2026] 18.11.25 Equipo dado de baja por el area tecnica. Se reutiliza sensor en pHp.98/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.98/MA.PM (id 45)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', N'09.03.26 Dado de baja por el area tecnica')
WHERE id_equipo = 45 AND CHARINDEX(N'- [09/11/2026] 09.03.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHp.99/MA.AY (id 46)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.03.26 Dado de baja por el area tecnica', N'20.03.26 Dado de baja por el area tecnica')
WHERE id_equipo = 46 AND CHARINDEX(N'- [09/11/2026] 20.03.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.100/MA.PM (id 675)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 675 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.17/MA.PM (id 165)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] Dado de baja 16.02.26 Informado por Carlos Gamboa', N'Dado de baja 16.02.26 Informado por Carlos Gamboa')
WHERE id_equipo = 165 AND CHARINDEX(N'- [29/10/2026] Dado de baja 16.02.26 Informado por Carlos Gamboa', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Dado de baja por el area tecnica', N'16.02.26 Dado de baja por el area tecnica')
WHERE id_equipo = 165 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.29/MA.VI (id 166)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de baja 07.05.24 por Jefe de Terreno.', N'Dado de baja 07.05.24 por Jefe de Terreno.')
WHERE id_equipo = 166 AND CHARINDEX(N'- [09/11/2026] Dado de baja 07.05.24 por Jefe de Terreno.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.30/MA.VI (id 167)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 11.08.25 Se desconoce su ubicación', N'11.08.25 Se desconoce su ubicación')
WHERE id_equipo = 167 AND CHARINDEX(N'- [29/10/2026] 11.08.25 Se desconoce su ubicación', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.33/MA.PM (id 168)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Envio nuevamente a servicio técnico 01.03.24 Guía N°5876, 12.03.24 Se recepcióna Informe Geodex N° 1548 que indica que la sonda no tiene reparación.', N'Envio nuevamente a servicio técnico 01.03.24 Guía N°5876, 12.03.24 Se recepcióna Informe Geodex N° 1548 que indica que la sonda no tiene reparación.')
WHERE id_equipo = 168 AND CHARINDEX(N'- [09/11/2026] Envio nuevamente a servicio técnico 01.03.24 Guía N°5876, 12.03.24 Se recepcióna Informe Geodex N° 1548 que indica que la sonda no tiene reparación.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.35/MA.PM (id 170)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 170 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.36/MA.PM (id 171)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 171 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.37/MA.PM (id 172)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de baja 07.05.24 por Jefe de Terreno.', N'Dado de baja 07.05.24 por Jefe de Terreno.')
WHERE id_equipo = 172 AND CHARINDEX(N'- [09/11/2026] Dado de baja 07.05.24 por Jefe de Terreno.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.38/MA.PM (id 173)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 173 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.39/MA.VI (id 174)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.08.24 Se recepciona en Bodega PM y presenta incosistencias de medición', N'07.08.24 Se recepciona en Bodega PM y presenta incosistencias de medición')
WHERE id_equipo = 174 AND CHARINDEX(N'- [09/11/2026] 07.08.24 Se recepciona en Bodega PM y presenta incosistencias de medición', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.42/MA.PM (id 175)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Enviada a servivio técnico 10.10.23 y recepcionada 24-10-23 De baja según informe', N'Enviada a servivio técnico 10.10.23 y recepcionada 24-10-23 De baja según informe')
WHERE id_equipo = 175 AND CHARINDEX(N'- [09/11/2026] Enviada a servivio técnico 10.10.23 y recepcionada 24-10-23 De baja según informe', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.43/MA.PM (id 176)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 20.11.24 Sonda dada de baja por el Jefe Tecnico MAM', N'20.11.24 Sonda dada de baja por el Jefe Tecnico MAM')
WHERE id_equipo = 176 AND CHARINDEX(N'- [29/10/2026] 20.11.24 Sonda dada de baja por el Jefe Tecnico MAM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.11.24 Recepcion desde Geodex, se intenta hacer puesta en marcha pero la sonda no es reconocida por MAU.28MAPM, sonda dada de baja', N'20.11.24 Recepcion desde Geodex, se intenta hacer puesta en marcha pero la sonda no es reconocida por MAU.28MAPM, sonda dada de baja')
WHERE id_equipo = 176 AND CHARINDEX(N'- [09/11/2026] 20.11.24 Recepcion desde Geodex, se intenta hacer puesta en marcha pero la sonda no es reconocida por MAU.28MAPM, sonda dada de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.44/MA.PM (id 177)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 177 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.46/MA.PM (id 178)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Dado de baja 07.05.24 por Jefe de Terreno.', N'Dado de baja 07.05.24 por Jefe de Terreno.')
WHERE id_equipo = 178 AND CHARINDEX(N'- [09/11/2026] Dado de baja 07.05.24 por Jefe de Terreno.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.47/MA.PM (id 179)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 20.11.24 Segundo cambio de cartridge // 01.08.25 Tercer cambio de catridge', N'20.11.24 Segundo cambio de cartridge // 01.08.25 Tercer cambio de catridge')
WHERE id_equipo = 179 AND CHARINDEX(N'- [29/10/2026] 20.11.24 Segundo cambio de cartridge // 01.08.25 Tercer cambio de catridge', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 08.09.25 Dado de baja por el area tecnica, por problema en su tarjeta de memoria, pendiente informe tecnico de Geodex', N'08.09.25 Dado de baja por el area tecnica, por problema en su tarjeta de memoria, pendiente informe tecnico de Geodex')
WHERE id_equipo = 179 AND CHARINDEX(N'- [09/11/2026] 08.09.25 Dado de baja por el area tecnica, por problema en su tarjeta de memoria, pendiente informe tecnico de Geodex', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.49/MA.PM (id 180)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.10.24 Puesta en marcha, no cumple, equipo dado de baja', N'04.10.24 Puesta en marcha, no cumple, equipo dado de baja')
WHERE id_equipo = 180 AND CHARINDEX(N'- [09/11/2026] 04.10.24 Puesta en marcha, no cumple, equipo dado de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.51/MA.VI (id 182)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.03.24 Se envía Sonda a Servicio Técnico para reparación Guia N° 5895, 12.03.24 Recepción Informe Diagnostico N° 1547 Geodex recomienda dar de baja la Sonda pHs.51/MA.VI', N'07.03.24 Se envía Sonda a Servicio Técnico para reparación Guia N° 5895, 12.03.24 Recepción Informe Diagnostico N° 1547 Geodex recomienda dar de baja la Sonda pHs.51/MA.VI')
WHERE id_equipo = 182 AND CHARINDEX(N'- [09/11/2026] 07.03.24 Se envía Sonda a Servicio Técnico para reparación Guia N° 5895, 12.03.24 Recepción Informe Diagnostico N° 1547 Geodex recomienda dar de baja la Sonda pHs.51/MA.VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] Dada de Baja // 12-03-24', N'Dada de Baja // 12-03-24')
WHERE id_equipo = 182 AND CHARINDEX(N'- [29/10/2026] Dada de Baja // 12-03-24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.52/MA.PM (id 183)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 183 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.53/MA.PM (id 184)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 01-07-2025 Actualmente en uso por Franco Rivas', N'01-07-2025 Actualmente en uso por Franco Rivas')
WHERE id_equipo = 184 AND CHARINDEX(N'- [29/10/2026] 01-07-2025 Actualmente en uso por Franco Rivas', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 23.07.26 Recepcion de informe folio 3755 Geodex, Sonda sin reparacion, se presume que sera dada de baja, pero el codigo citado en el informe es de la sonda pHs.39/MA.VI la cual no corresponde a la sonda, ya que el correcto segun numero de serie es pHs.53/MA.PM', N'23.07.26 Recepcion de informe folio 3755 Geodex, Sonda sin reparacion, se presume que sera dada de baja, pero el codigo citado en el informe es de la sonda pHs.39/MA.VI la cual no corresponde a la sonda, ya que el correcto segun numero de serie es pHs.53/MA.PM')
WHERE id_equipo = 184 AND CHARINDEX(N'- [09/11/2026] 23.07.26 Recepcion de informe folio 3755 Geodex, Sonda sin reparacion, se presume que sera dada de baja, pero el codigo citado en el informe es de la sonda pHs.39/MA.VI la cual no corresponde a la sonda, ya que el correcto segun numero de serie es pHs.53/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.54/MA.PM (id 185)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Enviado a servicio técnico 08.05.23 último responsable JP Cárdenas', N'Enviado a servicio técnico 08.05.23 último responsable JP Cárdenas')
WHERE id_equipo = 185 AND CHARINDEX(N'- [09/11/2026] Enviado a servicio técnico 08.05.23 último responsable JP Cárdenas', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.55/MA.VI (id 186)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 27.03.24 Aviso para envíar a Servicio Técnico', N'27.03.24 Aviso para envíar a Servicio Técnico')
WHERE id_equipo = 186 AND CHARINDEX(N'- [09/11/2026] 27.03.24 Aviso para envíar a Servicio Técnico', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.56/MA.AY (id 187)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 23.02.24 Se da aviso de envio de Sonda a Pto Montt la cuál es recepcionada el 26.02.24 para reparación en servicio técnico. Enviada 01.03.24 según guía N°5876', N'23.02.24 Se da aviso de envio de Sonda a Pto Montt la cuál es recepcionada el 26.02.24 para reparación en servicio técnico. Enviada 01.03.24 según guía N°5876')
WHERE id_equipo = 187 AND CHARINDEX(N'- [09/11/2026] 23.02.24 Se da aviso de envio de Sonda a Pto Montt la cuál es recepcionada el 26.02.24 para reparación en servicio técnico. Enviada 01.03.24 según guía N°5876', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.57/MA.PM (id 188)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 188 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.58/MA.VI (id 189)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 31.07.25 En uso VI', N'31.07.25 En uso VI')
WHERE id_equipo = 189 AND CHARINDEX(N'- [29/10/2026] 31.07.25 En uso VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.01.26 Sonda dada de baja por el area tecnica - no tiene reparacion - tarjeta sulfatada y/o mojada sin reparacion, Informe SEICO, folio 25111', N'09.01.26 Sonda dada de baja por el area tecnica - no tiene reparacion - tarjeta sulfatada y/o mojada sin reparacion, Informe SEICO, folio 25111')
WHERE id_equipo = 189 AND CHARINDEX(N'- [09/11/2026] 09.01.26 Sonda dada de baja por el area tecnica - no tiene reparacion - tarjeta sulfatada y/o mojada sin reparacion, Informe SEICO, folio 25111', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.59/MA.PM (id 190)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] Cambio de cartridge operativa desde 12.09.24', N'Cambio de cartridge operativa desde 12.09.24')
WHERE id_equipo = 190 AND CHARINDEX(N'- [29/10/2026] Cambio de cartridge operativa desde 12.09.24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 190 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.60/MA.PM (id 191)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] Actualmente en uso por Sebastian Pallauta // 24.07.25 Sonda dada de baja, informe pendiente', N'Actualmente en uso por Sebastian Pallauta // 24.07.25 Sonda dada de baja, informe pendiente')
WHERE id_equipo = 191 AND CHARINDEX(N'- [29/10/2026] Actualmente en uso por Sebastian Pallauta // 24.07.25 Sonda dada de baja, informe pendiente', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.07.25 Sonda dada de baja - Informe pendiente', N'24.07.25 Sonda dada de baja - Informe pendiente')
WHERE id_equipo = 191 AND CHARINDEX(N'- [09/11/2026] 24.07.25 Sonda dada de baja - Informe pendiente', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.61/MA.PM (id 192)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 01/07/25 Actualmente en uso por Pablo Campos', N'01/07/25 Actualmente en uso por Pablo Campos')
WHERE id_equipo = 192 AND CHARINDEX(N'- [29/10/2026] 01/07/25 Actualmente en uso por Pablo Campos', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.62/MA.PM (id 193)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] Fuera de servicio desde octubre 2024 // Dada de baja 07.05.25', N'Fuera de servicio desde octubre 2024 // Dada de baja 07.05.25')
WHERE id_equipo = 193 AND CHARINDEX(N'- [29/10/2026] Fuera de servicio desde octubre 2024 // Dada de baja 07.05.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.05.25 Sonda no fue reparada por servicio tecnico, Sonda dada de baja.', N'07.05.25 Sonda no fue reparada por servicio tecnico, Sonda dada de baja.')
WHERE id_equipo = 193 AND CHARINDEX(N'- [09/11/2026] 07.05.25 Sonda no fue reparada por servicio tecnico, Sonda dada de baja.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.63/MA.PM (id 194)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.01.26 Sonda dada de baja por el area tecnica - no tiene reparacion - tarjeta sulfatada y/o mojada sin reparacion, Informe SEICO, folio 25110', N'09.01.26 Sonda dada de baja por el area tecnica - no tiene reparacion - tarjeta sulfatada y/o mojada sin reparacion, Informe SEICO, folio 25110')
WHERE id_equipo = 194 AND CHARINDEX(N'- [09/11/2026] 09.01.26 Sonda dada de baja por el area tecnica - no tiene reparacion - tarjeta sulfatada y/o mojada sin reparacion, Informe SEICO, folio 25110', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.64/MA.PM (id 195)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 05.02.25 - Dado de baja por el area tecnica', N'05.02.25 - Dado de baja por el area tecnica')
WHERE id_equipo = 195 AND CHARINDEX(N'- [29/10/2026] 05.02.25 - Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.02.25 Sonda retorna de Geodex informe 2772, Se da de baja.', N'05.02.25 Sonda retorna de Geodex informe 2772, Se da de baja.')
WHERE id_equipo = 195 AND CHARINDEX(N'- [09/11/2026] 05.02.25 Sonda retorna de Geodex informe 2772, Se da de baja.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.65/MA.AY (id 196)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de T°', N'16.10.26 Verificacion de T°')
WHERE id_equipo = 196 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.66/MA.PM (id 197)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [29/10/2026] 18.11.25 primer cambio de catridge // Sonda no Reconocida por equipos MAU 01.10.26', N'18.11.25 primer cambio de catridge // Sonda no Reconocida por equipos MAU 01.10.26')
WHERE id_equipo = 197 AND CHARINDEX(N'- [29/10/2026] 18.11.25 primer cambio de catridge // Sonda no Reconocida por equipos MAU 01.10.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Sonda fuera de servicio, no fue reconocida por equipos MAU en el momento de la verificacion de temperatura', N'01.10.26 Sonda fuera de servicio, no fue reconocida por equipos MAU en el momento de la verificacion de temperatura')
WHERE id_equipo = 197 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Sonda fuera de servicio, no fue reconocida por equipos MAU en el momento de la verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.67/MA.AY (id 198)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 21.07.26 Verificacion de T°', N'21.07.26 Verificacion de T°')
WHERE id_equipo = 198 AND CHARINDEX(N'- [09/11/2026] 21.07.26 Verificacion de T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.68/MA.PM (id 199)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.07.26 Verificacion de temperatura, se realiza un traslado interno hacia la base VI', N'30.07.26 Verificacion de temperatura, se realiza un traslado interno hacia la base VI')
WHERE id_equipo = 199 AND CHARINDEX(N'- [09/11/2026] 30.07.26 Verificacion de temperatura, se realiza un traslado interno hacia la base VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.69/MA.PM (id 200)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 200 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.70/MA.PM (id 201)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.04.26 Aviso de envio geodex - No se pudo verificar T°', N'01.04.26 Aviso de envio geodex - No se pudo verificar T°')
WHERE id_equipo = 201 AND CHARINDEX(N'- [09/11/2026] 01.04.26 Aviso de envio geodex - No se pudo verificar T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.71/MA.VI (id 202)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 202 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.72/MA.PM (id 203)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 203 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.73/MA.PM (id 204)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 204 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.74/MA.PM (id 205)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Area tecnica concluye que, esta sonda fue sustraida a Luis Seiler', N'28.08.26 Area tecnica concluye que, esta sonda fue sustraida a Luis Seiler')
WHERE id_equipo = 205 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Area tecnica concluye que, esta sonda fue sustraida a Luis Seiler', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.75/MA.PM (id 206)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 08.09.25 Dado de baja por el area tecnica, electrodo quebrado si posibilidad de cambio de catridge debido a que es una sonda de modulo completo.', N'08.09.25 Dado de baja por el area tecnica, electrodo quebrado si posibilidad de cambio de catridge debido a que es una sonda de modulo completo.')
WHERE id_equipo = 206 AND CHARINDEX(N'- [09/11/2026] 08.09.25 Dado de baja por el area tecnica, electrodo quebrado si posibilidad de cambio de catridge debido a que es una sonda de modulo completo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.76/MA.VI (id 207)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.26 Recepcion informe Tecnico Dilaco N°11229, Sonda dada de baja', N'26.08.26 Recepcion informe Tecnico Dilaco N°11229, Sonda dada de baja')
WHERE id_equipo = 207 AND CHARINDEX(N'- [09/11/2026] 26.08.26 Recepcion informe Tecnico Dilaco N°11229, Sonda dada de baja', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.77/MA.VI (id 208)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.04.26 verificacion de temperatura', N'01.04.26 verificacion de temperatura')
WHERE id_equipo = 208 AND CHARINDEX(N'- [09/11/2026] 01.04.26 verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.78/MA.VI (id 209)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 209 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.79/MA.VI (id 210)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.01.26 Sonda dada de baja por el area tecnica, sensor quebrado. No se realizo verificacion de temperatura.', N'26.01.26 Sonda dada de baja por el area tecnica, sensor quebrado. No se realizo verificacion de temperatura.')
WHERE id_equipo = 210 AND CHARINDEX(N'- [09/11/2026] 26.01.26 Sonda dada de baja por el area tecnica, sensor quebrado. No se realizo verificacion de temperatura.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.81/MA.VI (id 212)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 212 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.82/MA.VI (id 213)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 verificacion de temperatura', N'15.07.26 verificacion de temperatura')
WHERE id_equipo = 213 AND CHARINDEX(N'- [09/11/2026] 15.07.26 verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.83/MA.VI (id 214)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 214 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.84/MA.PM (id 215)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 215 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.85/MA.PM (id 216)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 216 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.86/MA.VI (id 217)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 217 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.87/MA.PM (id 218)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 218 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.88/MA.PM (id 219)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, debido a que sonda sufre siniestro en planta prolesur', N'02.03.26 Dado de baja por el area tecnica, debido a que sonda sufre siniestro en planta prolesur')
WHERE id_equipo = 219 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, debido a que sonda sufre siniestro en planta prolesur', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.89/MA.PM (id 220)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 220 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.90/MA.PM (id 221)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Sonda dada de baja por el area tecnica el 01.06.26, sonda no tiene reparacion, informado por Mario Jofre', N'Sonda dada de baja por el area tecnica el 01.06.26, sonda no tiene reparacion, informado por Mario Jofre')
WHERE id_equipo = 221 AND CHARINDEX(N'- [09/11/2026] Sonda dada de baja por el area tecnica el 01.06.26, sonda no tiene reparacion, informado por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.91/MA.VI - Prestamo (id 222)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pendiente Verificacion de temperatura JULIO 2026', N'Pendiente Verificacion de temperatura JULIO 2026')
WHERE id_equipo = 222 AND CHARINDEX(N'- [09/11/2026] Pendiente Verificacion de temperatura JULIO 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.92/MA.PM (id 223)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 223 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.93/MA.PM (id 224)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 224 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.94/MA.PM (id 225)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 225 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.95/MA.PM (id 226)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 226 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.96/MA.PM (id 227)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 227 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.97/MA.PM (id 228)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 17.08.26 Sonda dada de baja por el area tecnica, proveedor informa que la sonda no tiene reparacion, se adjunta correo de respaldo.', N'17.08.26 Sonda dada de baja por el area tecnica, proveedor informa que la sonda no tiene reparacion, se adjunta correo de respaldo.')
WHERE id_equipo = 228 AND CHARINDEX(N'- [09/11/2026] 17.08.26 Sonda dada de baja por el area tecnica, proveedor informa que la sonda no tiene reparacion, se adjunta correo de respaldo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- pHs.98/MA.VI (id 229)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 15.07.26 Verificacion de temperatura', N'15.07.26 Verificacion de temperatura')
WHERE id_equipo = 229 AND CHARINDEX(N'- [09/11/2026] 15.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.02/MA.PM (id 449)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.11.24 Asignado a Franco Rivas', N'12.11.24 Asignado a Franco Rivas')
WHERE id_equipo = 449 AND CHARINDEX(N'- [09/11/2026] 12.11.24 Asignado a Franco Rivas', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.03/MA.PM (id 450)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.11.25 Puesta en Marcha por el area tecnica, equipo operativo - Pendiente informe SEICO', N'25.11.25 Puesta en Marcha por el area tecnica, equipo operativo - Pendiente informe SEICO')
WHERE id_equipo = 450 AND CHARINDEX(N'- [09/11/2026] 25.11.25 Puesta en Marcha por el area tecnica, equipo operativo - Pendiente informe SEICO', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.04/MA.PM (id 451)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', N'02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.')
WHERE id_equipo = 451 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Dado de baja por el area tecnica, viernes 27 durante la amanecida al Sr. Luis Seiler le sustrajeron este equipo.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.06/MA.PM (id 452)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.11.25 Puesta en Marcha por el area tecnica, equipo operativo - Informe SEICO 25082', N'25.11.25 Puesta en Marcha por el area tecnica, equipo operativo - Informe SEICO 25082')
WHERE id_equipo = 452 AND CHARINDEX(N'- [09/11/2026] 25.11.25 Puesta en Marcha por el area tecnica, equipo operativo - Informe SEICO 25082', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.12/MA.PM (id 453)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 31.08.26 Equipo no tiene reparacion, dado de baja por el area tecnica', N'31.08.26 Equipo no tiene reparacion, dado de baja por el area tecnica')
WHERE id_equipo = 453 AND CHARINDEX(N'- [09/11/2026] 31.08.26 Equipo no tiene reparacion, dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.13/MA.PM (id 454)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.01.25 Puesta en marcha por el area tecnica, cumple.', N'28.01.25 Puesta en marcha por el area tecnica, cumple.')
WHERE id_equipo = 454 AND CHARINDEX(N'- [09/11/2026] 28.01.25 Puesta en marcha por el area tecnica, cumple.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.14/MA.PM (id 455)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Asignado a Cristian Mellado', N'26.08.25 Asignado a Cristian Mellado')
WHERE id_equipo = 455 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Asignado a Cristian Mellado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.15/MA.PM (id 456)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.11.25 Puesta en marcha preventiva por el area tecnica. Equipo operativo en PM, se actualiza su ficha', N'25.11.25 Puesta en marcha preventiva por el area tecnica. Equipo operativo en PM, se actualiza su ficha')
WHERE id_equipo = 456 AND CHARINDEX(N'- [09/11/2026] 25.11.25 Puesta en marcha preventiva por el area tecnica. Equipo operativo en PM, se actualiza su ficha', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.19/MA.AY (id 457)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.11.25 Puesta en marcha preventiva por area tecnica, equipo operativo', N'26.11.25 Puesta en marcha preventiva por area tecnica, equipo operativo')
WHERE id_equipo = 457 AND CHARINDEX(N'- [09/11/2026] 26.11.25 Puesta en marcha preventiva por area tecnica, equipo operativo', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.20/MA.PM (id 458)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.02.25 Asignado a Cristian Mellado', N'12.02.25 Asignado a Cristian Mellado')
WHERE id_equipo = 458 AND CHARINDEX(N'- [09/11/2026] 12.02.25 Asignado a Cristian Mellado', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.21/MA.PM (id 459)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Operativo - Se encuentra en Bodega Puerto Montt 26.12.22', N'Operativo - Se encuentra en Bodega Puerto Montt 26.12.22')
WHERE id_equipo = 459 AND CHARINDEX(N'- [09/11/2026] Operativo - Se encuentra en Bodega Puerto Montt 26.12.22', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.22/MA.PM (id 460)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.11.25 Puesta en marcha preventiva por el area tecnica, equipo operativo - pendiente informe Geodex reparacion del 27.02.24', N'25.11.25 Puesta en marcha preventiva por el area tecnica, equipo operativo - pendiente informe Geodex reparacion del 27.02.24')
WHERE id_equipo = 460 AND CHARINDEX(N'- [09/11/2026] 25.11.25 Puesta en marcha preventiva por el area tecnica, equipo operativo - pendiente informe Geodex reparacion del 27.02.24', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.24/MA.PM (id 461)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Uso actual en Chiloe, a cargo de Base PM', N'26.08.25 Uso actual en Chiloe, a cargo de Base PM')
WHERE id_equipo = 461 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Uso actual en Chiloe, a cargo de Base PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.25/MA.PM (id 462)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Uso actual en Chiloe, a cargo de Base PM', N'26.08.25 Uso actual en Chiloe, a cargo de Base PM')
WHERE id_equipo = 462 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Uso actual en Chiloe, a cargo de Base PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.26/MA.PM (id 463)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Asignado a Constanza Flores - Cambio de sede de VI a PM, se realiza puesta en marcha preventiva', N'26.08.25 Asignado a Constanza Flores - Cambio de sede de VI a PM, se realiza puesta en marcha preventiva')
WHERE id_equipo = 463 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Asignado a Constanza Flores - Cambio de sede de VI a PM, se realiza puesta en marcha preventiva', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.27/MA.VI (id 464)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 04.02.25 Asignado a Mario Carcamo por coordinador Mario Jofre', N'04.02.25 Asignado a Mario Carcamo por coordinador Mario Jofre')
WHERE id_equipo = 464 AND CHARINDEX(N'- [09/11/2026] 04.02.25 Asignado a Mario Carcamo por coordinador Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.28/MA.AY (id 465)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Asignado a Liseth Llanos', N'26.08.25 Asignado a Liseth Llanos')
WHERE id_equipo = 465 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Asignado a Liseth Llanos', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.29/MA.PM (id 466)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Asignado a Pablo Campos', N'26.08.25 Asignado a Pablo Campos')
WHERE id_equipo = 466 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Asignado a Pablo Campos', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.30/MA.PM (id 467)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 25.11.25 Puesta en marcha por el area tecnica, equipo operativo - Informe SEICO 25081', N'25.11.25 Puesta en marcha por el area tecnica, equipo operativo - Informe SEICO 25081')
WHERE id_equipo = 467 AND CHARINDEX(N'- [09/11/2026] 25.11.25 Puesta en marcha por el area tecnica, equipo operativo - Informe SEICO 25081', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.31/MA.PM (id 468)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Asignado a Franco Rivas', N'26.08.25 Asignado a Franco Rivas')
WHERE id_equipo = 468 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Asignado a Franco Rivas', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.32/MA.PM (id 469)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Asignado a Pablo Campos', N'26.08.25 Asignado a Pablo Campos')
WHERE id_equipo = 469 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Asignado a Pablo Campos', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.33/MA.AY (id 470)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 26.08.25 Asignado a Liseth Llanos', N'26.08.25 Asignado a Liseth Llanos')
WHERE id_equipo = 470 AND CHARINDEX(N'- [09/11/2026] 26.08.25 Asignado a Liseth Llanos', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.34/MA.VI (id 471)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.09.25 Puesta en marcha por el area tecnica VI', N'01.09.25 Puesta en marcha por el area tecnica VI')
WHERE id_equipo = 471 AND CHARINDEX(N'- [09/11/2026] 01.09.25 Puesta en marcha por el area tecnica VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.35/MA.VI (id 472)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.09.25 Puesta en marcha por el area tecnica VI', N'01.09.25 Puesta en marcha por el area tecnica VI')
WHERE id_equipo = 472 AND CHARINDEX(N'- [09/11/2026] 01.09.25 Puesta en marcha por el area tecnica VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.36/MA.VI (id 473)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.09.25 Puesta en marcha por el area tecnica VI', N'01.09.25 Puesta en marcha por el area tecnica VI')
WHERE id_equipo = 473 AND CHARINDEX(N'- [09/11/2026] 01.09.25 Puesta en marcha por el area tecnica VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.37/MA.PM (id 474)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', N'28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25')
WHERE id_equipo = 474 AND CHARINDEX(N'- [09/11/2026] 28.11.25 Equipo entregado por el Muestreador Sebastian Pallauta, quien presento su renuncia el 28.11.25', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.38/MA.PM (id 475)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.12.25 Puesta en marcha por el area tecnica VI', N'12.12.25 Puesta en marcha por el area tecnica VI')
WHERE id_equipo = 475 AND CHARINDEX(N'- [09/11/2026] 12.12.25 Puesta en marcha por el area tecnica VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.39/MA.VI (id 476)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.01.26 Puesta en marcha por el area tecnica VI', N'09.01.26 Puesta en marcha por el area tecnica VI')
WHERE id_equipo = 476 AND CHARINDEX(N'- [09/11/2026] 09.01.26 Puesta en marcha por el area tecnica VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.40/MA.VI (id 477)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 07.01.26 Puesta en marcha por el area tecnica VI', N'07.01.26 Puesta en marcha por el area tecnica VI')
WHERE id_equipo = 477 AND CHARINDEX(N'- [09/11/2026] 07.01.26 Puesta en marcha por el area tecnica VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.41/MA.VI (id 478)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 09.01.26 Puesta en marcha en base VI', N'09.01.26 Puesta en marcha en base VI')
WHERE id_equipo = 478 AND CHARINDEX(N'- [09/11/2026] 09.01.26 Puesta en marcha en base VI', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.42/MA.PM (id 479)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.03.26 Puesta en marcha realizada por el area tecnica.', N'02.03.26 Puesta en marcha realizada por el area tecnica.')
WHERE id_equipo = 479 AND CHARINDEX(N'- [09/11/2026] 02.03.26 Puesta en marcha realizada por el area tecnica.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.43/MA.PM (id 480)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Puesta en marcha realizada por el area tecnica', N'18.05.26 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 480 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POW.44/MA.PM (id 481)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 18.05.26 Puesta en marcha realizada por el area tecnica', N'18.05.26 Puesta en marcha realizada por el area tecnica')
WHERE id_equipo = 481 AND CHARINDEX(N'- [09/11/2026] 18.05.26 Puesta en marcha realizada por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- POZ.01/MA.PM (id 448)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 11.11.25 Equipo devuelto al proveedor, GD8117', N'11.11.25 Equipo devuelto al proveedor, GD8117')
WHERE id_equipo = 448 AND CHARINDEX(N'- [09/11/2026] 11.11.25 Equipo devuelto al proveedor, GD8117', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- REF.05/APO.MAM.PM (id 432)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.06.25 Ingreso al inventario MAM, equipo pertenenciente a Laboratorio es trasladado como apoyo en el area de operaciones MAM para contener Gelpack. Se asigna y se modifica su codigo de REF.05/LAB.BMO.PM a REF.05/APO.MAM.PM', N'16.06.25 Ingreso al inventario MAM, equipo pertenenciente a Laboratorio es trasladado como apoyo en el area de operaciones MAM para contener Gelpack. Se asigna y se modifica su codigo de REF.05/LAB.BMO.PM a REF.05/APO.MAM.PM')
WHERE id_equipo = 432 AND CHARINDEX(N'- [09/11/2026] 16.06.25 Ingreso al inventario MAM, equipo pertenenciente a Laboratorio es trasladado como apoyo en el area de operaciones MAM para contener Gelpack. Se asigna y se modifica su codigo de REF.05/LAB.BMO.PM a REF.05/APO.MAM.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.01/MA.PM (id 309)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 309 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.02/MA.PM (id 315)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.10.26 Verificacion de temperatura', N'01.10.26 Verificacion de temperatura')
WHERE id_equipo = 315 AND CHARINDEX(N'- [09/11/2026] 01.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.03/MA.PM (id 319)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 319 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.04/MA.PM (id 321)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.10.26 Verificacion de temperatura', N'16.10.26 Verificacion de temperatura')
WHERE id_equipo = 321 AND CHARINDEX(N'- [09/11/2026] 16.10.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.05/MA.PM (id 313)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 313 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.06/MA.AY (id 307)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 13.10.26 Verificacion de T°', N'13.10.26 Verificacion de T°')
WHERE id_equipo = 307 AND CHARINDEX(N'- [09/11/2026] 13.10.26 Verificacion de T°', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.07/MA.VI (id 317)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pendiente Abril 2026', N'Pendiente Abril 2026')
WHERE id_equipo = 317 AND CHARINDEX(N'- [09/11/2026] Pendiente Abril 2026', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.08/MA.VI (id 311)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Pendiente Octubre 2025', N'Pendiente Octubre 2025')
WHERE id_equipo = 311 AND CHARINDEX(N'- [09/11/2026] Pendiente Octubre 2025', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.09/MA.PM (id 323)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 323 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SOD.11/MA.PM (id 327)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.07.26 Verificacion de temperatura', N'30.07.26 Verificacion de temperatura')
WHERE id_equipo = 327 AND CHARINDEX(N'- [09/11/2026] 30.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SON.01/MA.PM (id 351)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 02.07.26 Verificacion de temperatura', N'02.07.26 Verificacion de temperatura')
WHERE id_equipo = 351 AND CHARINDEX(N'- [09/11/2026] 02.07.26 Verificacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SON.02/MA.PM (id 344)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', N'01.07.26 Verificiacion de temperatura')
WHERE id_equipo = 344 AND CHARINDEX(N'- [09/11/2026] 01.07.26 Verificiacion de temperatura', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SON.03/MA.PM (id 353)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 353 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SON.04/MA.PM (id 347)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', N'16.02.26 Equipo dado de baja por el area tecnica')
WHERE id_equipo = 347 AND CHARINDEX(N'- [09/11/2026] 16.02.26 Equipo dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SON.05/MA.PM (id 349)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', N'28.08.26 Asignado a Juan Barrientos por Mario Jofre')
WHERE id_equipo = 349 AND CHARINDEX(N'- [09/11/2026] 28.08.26 Asignado a Juan Barrientos por Mario Jofre', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SON.06/MA.PM (id 355)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.03.26 Area tecnica deja fuera de uso este equipo por no uso', N'30.03.26 Area tecnica deja fuera de uso este equipo por no uso')
WHERE id_equipo = 355 AND CHARINDEX(N'- [09/11/2026] 30.03.26 Area tecnica deja fuera de uso este equipo por no uso', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- SON.07/MA.PM (id 356)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 30.03.26 Area tecnica deja fuera de uso este equipo por no uso', N'30.03.26 Area tecnica deja fuera de uso este equipo por no uso')
WHERE id_equipo = 356 AND CHARINDEX(N'- [09/11/2026] 30.03.26 Area tecnica deja fuera de uso este equipo por no uso', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- STP.01/MA.PM (id 372)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.06.26 Puesta en marcha por GCA', N'24.06.26 Puesta en marcha por GCA')
WHERE id_equipo = 372 AND CHARINDEX(N'- [09/11/2026] 24.06.26 Puesta en marcha por GCA', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- STP.02/MA.VI (id 374)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82954, fecha de calibracion 29.09.26', N'05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82954, fecha de calibracion 29.09.26')
WHERE id_equipo = 374 AND CHARINDEX(N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82954, fecha de calibracion 29.09.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- STP.03/MA.AY (id 376)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82955, fecha de calibracion 29.09.26', N'05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82955, fecha de calibracion 29.09.26')
WHERE id_equipo = 376 AND CHARINDEX(N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82955, fecha de calibracion 29.09.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TAM.01/MA.PM (id 430)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 06.06.25 Puesta en Marcha por el area tecnica', N'06.06.25 Puesta en Marcha por el area tecnica')
WHERE id_equipo = 430 AND CHARINDEX(N'- [09/11/2026] 06.06.25 Puesta en Marcha por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TES.02/MA.PM (id 381)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Operativo - PM (Requiere cambio) 26/12/2022', N'Operativo - PM (Requiere cambio) 26/12/2022')
WHERE id_equipo = 381 AND CHARINDEX(N'- [09/11/2026] Operativo - PM (Requiere cambio) 26/12/2022', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TES.03/MA.PM (id 382)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 20.05.25 Equipo en Bodega MAM, se realiza puesta en marcha preventiva, equipo con cables para medir voltaje en mal estado, pero se utilizan los cables del TES.04/MA.PM para su funcionamiento.', N'20.05.25 Equipo en Bodega MAM, se realiza puesta en marcha preventiva, equipo con cables para medir voltaje en mal estado, pero se utilizan los cables del TES.04/MA.PM para su funcionamiento.')
WHERE id_equipo = 382 AND CHARINDEX(N'- [09/11/2026] 20.05.25 Equipo en Bodega MAM, se realiza puesta en marcha preventiva, equipo con cables para medir voltaje en mal estado, pero se utilizan los cables del TES.04/MA.PM para su funcionamiento.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TES.04/MA.PM (id 383)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] Equipo nuevo, Ingreso a inventario el 20.05.25, se realiza puesta en marcha con el area tecnica. Este equipo queda guardado en Bodega MAM como backup ya que los cables para medir voltaje seran utilizados en el TES.03/MA.PM', N'Equipo nuevo, Ingreso a inventario el 20.05.25, se realiza puesta en marcha con el area tecnica. Este equipo queda guardado en Bodega MAM como backup ya que los cables para medir voltaje seran utilizados en el TES.03/MA.PM')
WHERE id_equipo = 383 AND CHARINDEX(N'- [09/11/2026] Equipo nuevo, Ingreso a inventario el 20.05.25, se realiza puesta en marcha con el area tecnica. Este equipo queda guardado en Bodega MAM como backup ya que los cables para medir voltaje seran utilizados en el TES.03/MA.PM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TMC.01/MA.PM (id 337)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', N'29.06.26 Dado de baja por el area tecnica')
WHERE id_equipo = 337 AND CHARINDEX(N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TMC.02/MA.PM (id 339)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.04.25 Verificacion intermedia de temperatura - parametros fuera de rango - Equipo dado de baja por el area tecnica.', N'03.04.25 Verificacion intermedia de temperatura - parametros fuera de rango - Equipo dado de baja por el area tecnica.')
WHERE id_equipo = 339 AND CHARINDEX(N'- [09/11/2026] 03.04.25 Verificacion intermedia de temperatura - parametros fuera de rango - Equipo dado de baja por el area tecnica.', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TMC.03/MA.PM (id 333)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 12.10.23 se da de baja junto a Mph.02/MA.PM (Informe Hanna Instruments N° 33331) Nicolás Uribe', N'12.10.23 se da de baja junto a Mph.02/MA.PM (Informe Hanna Instruments N° 33331) Nicolás Uribe')
WHERE id_equipo = 333 AND CHARINDEX(N'- [09/11/2026] 12.10.23 se da de baja junto a Mph.02/MA.PM (Informe Hanna Instruments N° 33331) Nicolás Uribe', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TMC.04/MA.PM (id 335)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 03.04.25 Equipo dado de baja por el area tecnica MAM', N'03.04.25 Equipo dado de baja por el area tecnica MAM')
WHERE id_equipo = 335 AND CHARINDEX(N'- [09/11/2026] 03.04.25 Equipo dado de baja por el area tecnica MAM', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TMC.06/MA.PM (id 341)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', N'29.06.26 Dado de baja por el area tecnica')
WHERE id_equipo = 341 AND CHARINDEX(N'- [09/11/2026] 29.06.26 Dado de baja por el area tecnica', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TML.01/MA.VI (id 377)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] ingresa a inventario 22.12.23', N'ingresa a inventario 22.12.23')
WHERE id_equipo = 377 AND CHARINDEX(N'- [09/11/2026] ingresa a inventario 22.12.23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TML.02/MA.PM (id 378)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] ingresa a inventario 22.12.23', N'ingresa a inventario 22.12.23')
WHERE id_equipo = 378 AND CHARINDEX(N'- [09/11/2026] ingresa a inventario 22.12.23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TML.03/MA.AY (id 379)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] ingresa a inventario 22.12.23', N'ingresa a inventario 22.12.23')
WHERE id_equipo = 379 AND CHARINDEX(N'- [09/11/2026] ingresa a inventario 22.12.23', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TPA.01/MA.PM (id 371)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 24.06.26 Puesta en marcha por GCA', N'24.06.26 Puesta en marcha por GCA')
WHERE id_equipo = 371 AND CHARINDEX(N'- [09/11/2026] 24.06.26 Puesta en marcha por GCA', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TPA.02/MA.VI (id 373)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82954, fecha de calibracion 29.09.26', N'05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82954, fecha de calibracion 29.09.26')
WHERE id_equipo = 373 AND CHARINDEX(N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82954, fecha de calibracion 29.09.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

-- TPA.03/MA.AY (id 375)
UPDATE mae_equipo SET observacion = REPLACE(observacion, N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82955, fecha de calibracion 29.09.26', N'05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82955, fecha de calibracion 29.09.26')
WHERE id_equipo = 375 AND CHARINDEX(N'- [09/11/2026] 05.10.26 Puesta en Marcha PM, equipo retorna de CESMEC Certificado SMD-82955, fecha de calibracion 29.09.26', observacion) > 0;
SET @lineas = @lineas + @@ROWCOUNT;

COMMIT TRANSACTION;
PRINT CONCAT('Líneas corregidas: ', @lineas, ' (esperadas: 613; menos si ya se había ejecutado o se editaron).');
