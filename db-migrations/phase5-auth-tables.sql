-- =============================================================================
-- ADL ONE — Fase 5 (Seguridad / Auth)
-- Tablas nuevas requeridas por las funcionalidades S-13 y S-14/15/16/17.
-- Ejecutar UNA SOLA VEZ en la base de datos ADL_ONE_DB.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLA 1: mae_login_attempts
-- Registra intentos fallidos de login por nombre de usuario para implementar
-- bloqueo temporal tras N intentos consecutivos (S-13).
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'mae_login_attempts')
BEGIN
    CREATE TABLE mae_login_attempts (
        id_login_attempt INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        nombre_usuario   VARCHAR(150)      NOT NULL,
        failed_count     INT               NOT NULL DEFAULT 0,
        last_attempt_at  DATETIME2(0)      NOT NULL DEFAULT SYSDATETIME(),
        last_reason      VARCHAR(100)      NULL,
        locked_until     DATETIME2(0)      NULL,
        CONSTRAINT UQ_mae_login_attempts_usuario UNIQUE (nombre_usuario)
    );

    CREATE INDEX IX_mae_login_attempts_locked_until
        ON mae_login_attempts (locked_until)
        WHERE locked_until IS NOT NULL;

    PRINT 'Tabla mae_login_attempts creada.';
END
ELSE
BEGIN
    PRINT 'Tabla mae_login_attempts ya existe — sin cambios.';
END
GO

-- -----------------------------------------------------------------------------
-- TABLA 2: mae_password_reset_tokens
-- Tokens de un solo uso para recuperación de contraseña vía email
-- (S-14 / S-15 / S-16 / S-17).
-- -----------------------------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'mae_password_reset_tokens')
BEGIN
    CREATE TABLE mae_password_reset_tokens (
        id_token        INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_usuario      NUMERIC(10, 0)    NOT NULL,
        token_hash      VARCHAR(255)      NOT NULL,    -- hash SHA-256 (NO el token en claro)
        created_at      DATETIME2(0)      NOT NULL DEFAULT SYSDATETIME(),
        expires_at      DATETIME2(0)      NOT NULL,    -- típicamente created_at + 60 minutos
        used_at         DATETIME2(0)      NULL,        -- NULL = aún válido; con valor = ya consumido
        ip_solicitante  VARCHAR(45)       NULL,
        CONSTRAINT FK_mae_password_reset_tokens_usuario
            FOREIGN KEY (id_usuario) REFERENCES mae_usuario(id_usuario)
    );

    CREATE INDEX IX_mae_password_reset_tokens_hash
        ON mae_password_reset_tokens (token_hash);

    CREATE INDEX IX_mae_password_reset_tokens_usuario
        ON mae_password_reset_tokens (id_usuario, created_at DESC);

    PRINT 'Tabla mae_password_reset_tokens creada.';
END
ELSE
BEGIN
    PRINT 'Tabla mae_password_reset_tokens ya existe — sin cambios.';
END
GO

-- -----------------------------------------------------------------------------
-- AJUSTE: permisos_version en mae_usuario (para RB-04 / RB-07).
-- Si la columna ya existe, no hacer nada. Si no existe, agregarla.
-- Esta columna se incrementa cuando el admin deshabilita el usuario o
-- modifica sus roles/permisos, invalidando JWTs antiguos automáticamente.
-- -----------------------------------------------------------------------------
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE Name = N'permisos_version'
      AND Object_ID = Object_ID(N'mae_usuario')
)
BEGIN
    ALTER TABLE mae_usuario ADD permisos_version INT NOT NULL DEFAULT 0;
    PRINT 'Columna permisos_version agregada a mae_usuario.';
END
ELSE
BEGIN
    PRINT 'Columna permisos_version ya existe en mae_usuario — sin cambios.';
END
GO

-- =============================================================================
-- FIN — Verificar resultados
-- =============================================================================
SELECT 'mae_login_attempts'         AS tabla, COUNT(*) AS filas FROM mae_login_attempts
UNION ALL
SELECT 'mae_password_reset_tokens'  AS tabla, COUNT(*) AS filas FROM mae_password_reset_tokens;
GO
