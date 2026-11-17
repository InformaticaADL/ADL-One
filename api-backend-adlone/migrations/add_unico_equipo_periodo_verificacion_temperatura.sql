-- Migration: add_unico_equipo_periodo_verificacion_temperatura
-- Una sola ficha OI-FoGe-39 no anulada por equipo y periodo. La aplicación ya
-- lo revisaba antes de crear, pero dos creaciones simultáneas (doble clic en
-- "Crear fichas", dos usuarios a la vez) podían pasar las dos. Con este índice
-- la base de datos rechaza la segunda y la aplicación responde "ya tiene una
-- ficha en el periodo".
--
-- Si ya existen duplicados, el índice no se crea: este script los lista para
-- que Calidad decida cuál anular, y se vuelve a ejecutar.
-- Se puede ejecutar más de una vez.

IF EXISTS (
    SELECT 1 FROM mae_verificacion_temperatura
    WHERE estado <> 'ANULADA'
    GROUP BY id_equipo, periodo HAVING COUNT(*) > 1
)
BEGIN
    SELECT v.id_verificacion, v.codigo_equipo, v.periodo, v.estado, v.fecha_creacion
    FROM mae_verificacion_temperatura v
    JOIN (
        SELECT id_equipo, periodo FROM mae_verificacion_temperatura
        WHERE estado <> 'ANULADA'
        GROUP BY id_equipo, periodo HAVING COUNT(*) > 1
    ) d ON d.id_equipo = v.id_equipo AND d.periodo = v.periodo
    WHERE v.estado <> 'ANULADA'
    ORDER BY v.codigo_equipo, v.periodo, v.id_verificacion;
    RAISERROR('Hay fichas duplicadas (mismo equipo y periodo, no anuladas): anule las sobrantes y vuelva a ejecutar.', 16, 1);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_mae_verif_temp_equipo_periodo' AND object_id = OBJECT_ID('mae_verificacion_temperatura'))
BEGIN
    CREATE UNIQUE INDEX UX_mae_verif_temp_equipo_periodo
        ON mae_verificacion_temperatura (id_equipo, periodo)
        WHERE estado <> 'ANULADA';
END;
