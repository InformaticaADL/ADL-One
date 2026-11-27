-- Migration: 2026-11-27-firma-muestreador-ficha-equipo
-- Quien RECIBE un equipo (un muestreador) acepta la ficha de entrega (OI-FoGe-36) desde ADL SAMPLING, con su firma registrada, o la rechaza con un
-- motivo. Una fila por ficha enviada a firmar. No cambia las tablas de las fichas (add_firmas_pendientes_fichas.sql).
--
--   PENDIENTE  se le pidió en la app y aún no responde (la ficha no se completa sin su respuesta)
--   ACEPTADA   aceptó: su firma queda en la ficha
--   RECHAZADA  la rechazó: la ficha queda cancelada con su motivo
--   ANULADA    ya no corresponde (se canceló la ficha o firmó en persona)
--
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_ficha_firma_recibe', 'U') IS NULL
BEGIN
    CREATE TABLE mae_ficha_firma_recibe (
        id_recibe       INT IDENTITY(1, 1) PRIMARY KEY,
        id_ficha_firma  INT            NOT NULL,
        id_muestreador  NUMERIC(10, 0) NOT NULL,
        nombre          NVARCHAR(150)  NULL,
        estado          VARCHAR(12)    NOT NULL CONSTRAINT DF_mae_ficha_firma_recibe_estado DEFAULT 'PENDIENTE',
        id_firma        INT            NULL,                    -- versión de mae_firma_digital usada, si la hay
        motivo          NVARCHAR(300)  NULL,
        fecha_creacion  DATETIME       NOT NULL CONSTRAINT DF_mae_ficha_firma_recibe_creacion DEFAULT GETDATE(),
        fecha_respuesta DATETIME       NULL,
        CONSTRAINT FK_mae_ficha_firma_recibe_ficha FOREIGN KEY (id_ficha_firma) REFERENCES mae_ficha_firma (id_ficha_firma),
        CONSTRAINT UQ_mae_ficha_firma_recibe_ficha UNIQUE (id_ficha_firma),
        CONSTRAINT CK_mae_ficha_firma_recibe_estado CHECK (estado IN ('PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'ANULADA'))
    );
    CREATE INDEX IX_mae_ficha_firma_recibe_muestreador ON mae_ficha_firma_recibe (id_muestreador, estado);
END
GO
