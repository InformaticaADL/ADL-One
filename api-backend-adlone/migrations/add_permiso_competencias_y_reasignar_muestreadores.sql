-- Separa la gestión de Muestreadores (pasa a "Área Técnica MAM", id 3 — el
-- "Jefe Técnico") de Competencias (pasa a ser exclusivo de "Área Gestión de
-- Calidad", id 5). "Área Informática" (id 1) conserva todo lo que ya tenía.
-- Idempotente.

-- 1. Nuevo permiso dedicado a Competencias (hoy no existe ninguno separado).
IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'MU_COMPETENCIAS')
BEGIN
    INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
    VALUES ('MU_COMPETENCIAS', 'Gestión de Calidad', 'MUESTREADORES', 'Gestionar Competencias', 'Acción', 36, 1);
END

-- 2. MU_COMPETENCIAS -> rol 5 (Área Gestión de Calidad).
IF NOT EXISTS (
    SELECT 1 FROM rel_rol_permiso rp
    JOIN mae_permiso p ON p.id_permiso = rp.id_permiso
    WHERE rp.id_rol = 5 AND p.codigo = 'MU_COMPETENCIAS'
)
BEGIN
    INSERT INTO rel_rol_permiso (id_rol, id_permiso)
    SELECT 5, id_permiso FROM mae_permiso WHERE codigo = 'MU_COMPETENCIAS';
END

-- 3. Gestión completa de muestreadores -> rol 3 (Área Técnica MAM), los
--    mismos 7 códigos que ya tiene hoy el rol 1 (Área Informática).
DECLARE @codigosMuestreador TABLE (codigo VARCHAR(50));
INSERT INTO @codigosMuestreador (codigo) VALUES
    ('MA_MUESTREADORES'), ('AI_MA_CREAR_NUEVO_MUESTREADOR'), ('AI_MA_EDITAR_MUESTREADOR'),
    ('AI_MA_DESHABILITAR_MUESTREADOR'), ('MU_EXP'), ('MU_FIRMA'), ('MU_SOLICITUDES');

INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT 3, p.id_permiso
FROM mae_permiso p
JOIN @codigosMuestreador c ON c.codigo = p.codigo
WHERE NOT EXISTS (
    SELECT 1 FROM rel_rol_permiso rp WHERE rp.id_rol = 3 AND rp.id_permiso = p.id_permiso
);

-- 4. Menú: "Muestreadores" aparece también dentro de "Medio Ambiente"
--    (mismo id_accion que ya usa G. Calidad -> misma pantalla).
IF NOT EXISTS (
    SELECT 1 FROM mae_menu_link WHERE id_modulo = 'medio_ambiente' AND id_accion = 'admin-muestreadores'
)
BEGIN
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES ('medio_ambiente', 'admin-muestreadores', 'Muestreadores', 'MA_MUESTREADORES', 40, 1);
END

-- 5. El link de Muestreadores bajo "G. Calidad" pasa a depender de
--    MU_COMPETENCIAS (así Calidad lo sigue viendo ahí, pero por el permiso
--    de competencias, no por el de gestión general).
UPDATE mae_menu_link
SET permissions_str = 'MU_COMPETENCIAS'
WHERE id_modulo = 'gestion_calidad' AND id_accion = 'admin-muestreadores';

-- 6. Forzar a que los usuarios de los roles 3 y 5 vuelvan a iniciar sesión:
--    el JWT lleva los permisos "congelados" desde el login, y como los pasos
--    1-3 tocan rel_rol_permiso directo por SQL (no por el endpoint normal de
--    asignación de permisos), no hay invalidación automática. Sin este paso,
--    sus sesiones activas seguirían viendo los permisos de antes del cambio.
UPDATE mae_usuario
SET permisos_version = ISNULL(permisos_version, 0) + 1
WHERE id_usuario IN (SELECT id_usuario FROM rel_usuario_rol WHERE id_rol IN (3, 5));
