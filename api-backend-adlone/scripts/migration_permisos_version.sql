-- Migration: Add permisos_version to mae_usuario
-- Purpose: Enables JWT invalidation when a user's roles or permissions change
--          without requiring a token blacklist. The middleware compares the
--          version embedded in the JWT against the current DB value.
-- Safe to run multiple times (IF NOT EXISTS guard).

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'mae_usuario' AND COLUMN_NAME = 'permisos_version'
)
BEGIN
    ALTER TABLE mae_usuario ADD permisos_version INT NOT NULL DEFAULT 0;
    PRINT 'Column permisos_version added to mae_usuario.';
END
ELSE
BEGIN
    PRINT 'Column permisos_version already exists. Skipping.';
END
