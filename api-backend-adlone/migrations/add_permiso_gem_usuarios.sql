-- Permiso dedicado para que el Jefe Técnico (rol "Área Técnica MAM", id 3)
-- administre de forma acotada a los usuarios del área GEM MaM (rol id 20):
-- crear, editar, deshabilitar/habilitar y asignarles empresas a cargo.
-- No se le da a Informática (rol 1): ya tiene INF_USUARIOS, que cubre esto
-- y mucho más vía la pantalla genérica de usuarios.
-- Idempotente.

IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'GEM_USUARIOS')
BEGIN
    INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
    VALUES ('GEM_USUARIOS', 'Medio Ambiente', 'GEM', 'Gestionar Usuarios GEM', 'Acción', 65, 1);
END

-- GEM_USUARIOS -> rol 3 (Área Técnica MAM).
INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT 3, p.id_permiso
FROM mae_permiso p
WHERE p.codigo = 'GEM_USUARIOS'
AND NOT EXISTS (
    SELECT 1 FROM rel_rol_permiso rp WHERE rp.id_rol = 3 AND rp.id_permiso = p.id_permiso
);

-- Menú: "Usuarios GEM" aparece dentro de "Medio Ambiente".
IF NOT EXISTS (
    SELECT 1 FROM mae_menu_link WHERE id_modulo = 'medio_ambiente' AND id_accion = 'admin-usuarios-gem'
)
BEGIN
    INSERT INTO mae_menu_link (id_modulo, id_accion, label, permissions_str, sort_order, activo)
    VALUES ('medio_ambiente', 'admin-usuarios-gem', 'Usuarios GEM', 'GEM_USUARIOS', 50, 1);
END

-- Forzar a que los usuarios del rol 3 vuelvan a iniciar sesión: el JWT lleva
-- los permisos "congelados" desde el login, y como los pasos anteriores tocan
-- rel_rol_permiso directo por SQL (no por el endpoint normal de asignación de
-- permisos), no hay invalidación automática.
UPDATE mae_usuario
SET permisos_version = ISNULL(permisos_version, 0) + 1
WHERE id_usuario IN (SELECT id_usuario FROM rel_usuario_rol WHERE id_rol = 3);
