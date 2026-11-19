-- Migration: alter_equipo_catalogo_sigla
-- Cada tipo de equipo del catálogo guarda la sigla de su código (la define Calidad: 3 letras, no se repite entre tipos)
-- y su control de fechas. Así el código de un equipo nuevo sale siempre de la sigla del tipo, sin adivinarla por nombre.
-- Rellena la sigla de los tipos que ya existen con la que usan sus equipos (la más frecuente para ese nombre).
-- Se puede ejecutar más de una vez.

IF COL_LENGTH('mae_equipo_catalogo', 'sigla') IS NULL
    ALTER TABLE mae_equipo_catalogo ADD sigla VARCHAR(10) NULL;
GO
IF COL_LENGTH('mae_equipo_catalogo', 'modalidad_control') IS NULL
    ALTER TABLE mae_equipo_catalogo ADD modalidad_control VARCHAR(30) NULL;
GO

UPDATE c SET c.sigla = s.sigla
FROM mae_equipo_catalogo c
CROSS APPLY (
    SELECT TOP 1 LTRIM(RTRIM(e.sigla)) AS sigla
    FROM mae_equipo e
    WHERE LTRIM(RTRIM(e.nombre)) = LTRIM(RTRIM(c.nombre)) AND ISNULL(LTRIM(RTRIM(e.sigla)), '') <> ''
    GROUP BY LTRIM(RTRIM(e.sigla))
    ORDER BY COUNT(*) DESC
) s
WHERE ISNULL(c.sigla, '') = '';
GO

IF COL_LENGTH('mae_equipo', 'modalidad_control') IS NOT NULL
    EXEC('UPDATE c SET c.modalidad_control = m.modalidad_control
          FROM mae_equipo_catalogo c
          CROSS APPLY (SELECT TOP 1 e.modalidad_control FROM mae_equipo e
                       WHERE LTRIM(RTRIM(e.nombre)) = LTRIM(RTRIM(c.nombre)) AND e.modalidad_control IS NOT NULL
                       GROUP BY e.modalidad_control ORDER BY COUNT(*) DESC) m
          WHERE c.modalidad_control IS NULL');
GO
