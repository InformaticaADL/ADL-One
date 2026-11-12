-- Migration: add_firma_digital
-- Firmas digitales de ADL One: la imagen de la firma de cada persona, guardada
-- en la base, para firmar formularios sin dibujarla cada vez (ej. la columna
-- FIRMA de la Ficha Técnica OI-FoGe-22 o la Ficha de Entrega OI-FoGe-36).
--
-- Distingue de quién es cada firma:
--   tipo_firmante = 'USUARIO'      id_firmante = mae_usuario.id_usuario
--                                  (la registra el propio usuario en su Perfil)
--   tipo_firmante = 'MUESTREADOR'  id_firmante = mae_muestreador.id_muestreador
--                                  (previsto; hoy los muestreadores siguen usando
--                                   mae_muestreador.firma_muestreador)
--
-- No reemplaza a mae_firma: esa tabla es del laboratorio (firmas de Jefe de
-- Laboratorio y Gerente para los informes de muestras, como ruta de archivo)
-- y la sigue usando el sistema antiguo.
--
-- Cada persona tiene una sola firma vigente. Al cambiarla, la anterior queda
-- como no vigente (historial); al quitarla, también queda no vigente.
--
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_firma_digital', 'U') IS NULL
BEGIN
    CREATE TABLE mae_firma_digital (
        id_firma             INT IDENTITY(1, 1) PRIMARY KEY,
        -- De quién es
        tipo_firmante        VARCHAR(15)    NOT NULL,              -- USUARIO | MUESTREADOR
        id_firmante          NUMERIC(10, 0) NOT NULL,
        nombre_firmante      NVARCHAR(150)  NULL,                  -- copia al registrarla
        -- Contexto al registrarla
        area                 NVARCHAR(80)   NULL,                  -- ej. Medio Ambiente, Gestión de Calidad
        cargo                NVARCHAR(150)  NULL,                  -- ej. Asistente de Gestión de Calidad – Medio Ambiente
        -- La firma
        imagen               NVARCHAR(MAX)  NOT NULL,              -- PNG/JPEG en data URL
        origen               VARCHAR(15)    NOT NULL CONSTRAINT DF_mae_firma_digital_origen DEFAULT 'DIBUJADA',
        -- Control
        vigente              BIT            NOT NULL CONSTRAINT DF_mae_firma_digital_vigente DEFAULT 1,
        id_usuario_registra  NUMERIC(10, 0) NULL,                  -- quién la registró
        fecha_creacion       DATETIME       NOT NULL CONSTRAINT DF_mae_firma_digital_creacion DEFAULT GETDATE(),
        fecha_baja           DATETIME       NULL,                  -- cuándo dejó de estar vigente
        CONSTRAINT CK_mae_firma_digital_tipo CHECK (tipo_firmante IN ('USUARIO', 'MUESTREADOR')),
        CONSTRAINT CK_mae_firma_digital_origen CHECK (origen IN ('DIBUJADA', 'IMPORTADA'))
    );
END
GO

-- Una sola firma vigente por persona.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_mae_firma_digital_vigente' AND object_id = OBJECT_ID('mae_firma_digital'))
    CREATE UNIQUE INDEX UX_mae_firma_digital_vigente ON mae_firma_digital (tipo_firmante, id_firmante) WHERE vigente = 1;
GO
