-- Migration: add_puesta_marcha_asignacion_firma
-- Enviar una puesta en marcha a firmar: quien la registra firma su propia parte y, si no puede firmar la otra
-- (porque no tiene el permiso de esa área), elige a una persona concreta que sí lo tiene y se la envía. Esa
-- persona recibe un aviso ("Firmas pendientes") y firma desde su propia sesión con el mismo endpoint de siempre
-- (POST /api/puestas-marcha/:id/firmar) — esta tabla solo registra a quién se le pidió cada firma y si ya la hizo,
-- no cambia el mecanismo de firma ni los permisos que ya exigía puestaMarcha.service.js.
--
-- Una fila por envío. Si se reenvía a otra persona para el mismo rol mientras la anterior sigue pendiente, esa
-- anterior queda ANULADA (no se borra, para no perder el registro de quién se pidió primero).
-- Se puede ejecutar más de una vez.

IF OBJECT_ID('mae_puesta_marcha_asignacion_firma', 'U') IS NULL
BEGIN
    CREATE TABLE mae_puesta_marcha_asignacion_firma (
        id_asignacion       INT IDENTITY(1, 1) PRIMARY KEY,
        id_puesta_marcha    INT            NOT NULL,
        rol                 VARCHAR(10)    NOT NULL,                 -- TECNICA · CALIDAD (la parte que falta firmar)
        id_usuario_destino  NUMERIC(10, 0) NOT NULL,                 -- a quién se le pidió la firma
        id_usuario_envia    NUMERIC(10, 0) NOT NULL,                 -- quién hizo el envío
        estado              VARCHAR(12)    NOT NULL CONSTRAINT DF_pm_asig_firma_estado DEFAULT 'PENDIENTE', -- PENDIENTE · FIRMADA · ANULADA
        fecha_creacion      DATETIME       NOT NULL CONSTRAINT DF_pm_asig_firma_creacion DEFAULT GETDATE(),
        fecha_resuelta      DATETIME       NULL,
        CONSTRAINT FK_pm_asig_firma_puesta FOREIGN KEY (id_puesta_marcha) REFERENCES mae_puesta_marcha (id_puesta_marcha)
    );
    CREATE INDEX IX_pm_asig_firma_destino ON mae_puesta_marcha_asignacion_firma (id_usuario_destino, estado);
    CREATE INDEX IX_pm_asig_firma_puesta ON mae_puesta_marcha_asignacion_firma (id_puesta_marcha, rol, estado);
END
GO
