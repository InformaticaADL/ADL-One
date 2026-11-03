-- Migration: add_verificacion_temperatura
-- Digitaliza el formulario OI-FoGe-39 "Verificación Intermedia de Temperatura"
-- (antes una hoja por equipo en "Guia - Verificación Temperatura <mes>.xlsx").
--
-- Flujo de cada ficha (columna `estado`):
--   BORRADOR         → G. Calidad la crea (sola o en lote) y llena las lecturas.
--   PENDIENTE_FIRMA  → lecturas cerradas; el PDF existe solo como vista previa
--                      temporal (se genera al vuelo, no se guarda).
--   FIRMADA          → firmó el muestreador: se genera el PDF definitivo, queda
--                      como documento de la revisión del equipo y se actualizan
--                      sus datos (Error 0/15/30, FC, Última/Siguiente revisión).
--   ANULADA          → descartada, con motivo.
--
-- Se puede ejecutar más de una vez (cada bloque comprueba si ya existe).

IF OBJECT_ID('mae_verificacion_temperatura', 'U') IS NULL
BEGIN
    CREATE TABLE mae_verificacion_temperatura (
        id_verificacion         INT IDENTITY(1, 1) PRIMARY KEY,
        id_equipo               NUMERIC(10, 0) NOT NULL,
        -- Copia del equipo al crear la ficha: el PDF debe reflejar cómo era el
        -- equipo al verificarlo aunque después cambie su código o nombre.
        codigo_equipo           VARCHAR(100)   NULL,
        nombre_equipo           NVARCHAR(200)  NULL,
        sede                    VARCHAR(10)    NULL,
        -- Campaña de verificación 'AAAA-MM' (ej. '2026-10' = Octubre 2026).
        periodo                 VARCHAR(7)     NOT NULL,
        fecha_verificacion      DATE           NOT NULL,
        maxima_division         NVARCHAR(50)   NULL,
        -- Termómetro patrón usado y su error en ese momento (copia, por la misma razón).
        id_patron               NUMERIC(10, 0) NULL,
        patron_codigo           VARCHAR(100)   NULL,
        patron_nombre           NVARCHAR(200)  NULL,
        patron_error0           DECIMAL(6, 2)  NULL,
        patron_error15          DECIMAL(6, 2)  NULL,
        patron_error30          DECIMAL(6, 2)  NULL,
        -- JSON {"0":[{tp,tc,hora}x5],"15":[...],"30":[...]}
        lecturas                NVARCHAR(MAX)  NULL,
        -- Error promedio por rango (TC - TFP), calculado en el backend.
        error0                  DECIMAL(6, 2)  NULL,
        error15                 DECIMAL(6, 2)  NULL,
        error30                 DECIMAL(6, 2)  NULL,
        cumple                  CHAR(1)        NULL,
        observacion             NVARCHAR(2000) NULL,
        estado                  VARCHAR(20)    NOT NULL CONSTRAINT DF_mae_verif_temp_estado DEFAULT 'BORRADOR',
        -- Responsable = usuario de G. Calidad que llena la ficha.
        id_usuario_responsable  NUMERIC(10, 0) NULL,
        -- Muestreador que firma (por defecto, el responsable del equipo).
        id_muestreador          NUMERIC(10, 0) NULL,
        firma_muestreador       NVARCHAR(MAX)  NULL,
        fecha_firma             DATETIME       NULL,
        siguiente_verificacion  DATE           NULL,
        pdf_ruta                NVARCHAR(500)  NULL,
        motivo_anulacion        NVARCHAR(500)  NULL,
        id_usuario_crea         NUMERIC(10, 0) NULL,
        fecha_creacion          DATETIME       NOT NULL CONSTRAINT DF_mae_verif_temp_creacion DEFAULT GETDATE(),
        fecha_modificacion      DATETIME       NULL
    );
    CREATE INDEX IX_mae_verif_temp_equipo ON mae_verificacion_temperatura (id_equipo, fecha_verificacion);
    CREATE INDEX IX_mae_verif_temp_periodo ON mae_verificacion_temperatura (periodo, estado);
END;
GO

-- Permiso para la sección, para Gestión de Calidad (5) e Informática (1).
IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'GC_VERIF_TEMP')
BEGIN
    INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
    VALUES ('GC_VERIF_TEMP', 'Gestión de Calidad', 'VERIFICACION TEMPERATURA', 'Verificación de Temperatura (OI-FoGe-39)', 'VISTA', 120, 1);
END;
GO

INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM mae_permiso p
CROSS JOIN (VALUES (1), (5)) r(id_rol)
WHERE p.codigo = 'GC_VERIF_TEMP'
  AND NOT EXISTS (SELECT 1 FROM rel_rol_permiso rp WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso);
GO

-- Link en el menú lateral, dentro de "G. Calidad". El id_accion es el
-- activeSubmodule que DashboardPage.tsx usa para mostrar la pantalla.
IF NOT EXISTS (SELECT 1 FROM mae_menu_link WHERE id_modulo = 'gestion_calidad' AND id_accion = 'gc-verificacion-temperatura')
BEGIN
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES ('gestion_calidad', 'gc-verificacion-temperatura', 'Verificación T°', 'GC_VERIF_TEMP', 25, 1);
END;
GO
