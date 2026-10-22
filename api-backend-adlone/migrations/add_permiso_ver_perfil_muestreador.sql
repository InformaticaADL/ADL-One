-- Permiso dedicado para "Ver Perfil y Rendimiento" de un muestreador —
-- separado de MA_MUESTREADORES (que gatea ver la lista/el módulo), para que
-- se pueda prender/apagar de forma independiente en el editor de roles.
-- Idempotente.

IF NOT EXISTS (SELECT 1 FROM mae_permiso WHERE codigo = 'MU_PERFIL')
BEGIN
    INSERT INTO mae_permiso (codigo, modulo, submodulo, nombre, tipo, orden, habilitado)
    VALUES ('MU_PERFIL', 'Gestión de Calidad', 'MUESTREADORES', 'Ver Perfil y Rendimiento', 'Acción', 37, 1);
END

-- Se lo doy a Área Informática (rol 1, para no quitarle nada de lo que ya
-- podía ver) y a Área Técnica MAM (rol 3, el Jefe Técnico) — no a Calidad.
INSERT INTO rel_rol_permiso (id_rol, id_permiso)
SELECT r.id_rol, p.id_permiso
FROM mae_permiso p
CROSS JOIN (SELECT 1 AS id_rol UNION ALL SELECT 3) r
WHERE p.codigo = 'MU_PERFIL'
AND NOT EXISTS (
    SELECT 1 FROM rel_rol_permiso rp WHERE rp.id_rol = r.id_rol AND rp.id_permiso = p.id_permiso
);

-- Vuelven a quedar con una versión de permisos distinta -> fuerza re-login.
UPDATE mae_usuario
SET permisos_version = ISNULL(permisos_version, 0) + 1
WHERE id_usuario IN (SELECT id_usuario FROM rel_usuario_rol WHERE id_rol IN (1, 3));
