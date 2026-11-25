// Áreas a las que pertenece un usuario según sus roles. Misma regla que el backend
// (api-backend-adlone/src/utils/areasRoles.js), que es quien realmente valida el acceso:
//   · Gestión de Calidad: rol «Área Gestión de Calidad».
//   · Informática: todas (soporte y pruebas).
// En el frontend solo decide qué se muestra (menú y tarjetas).
const sinTildes = (t: string) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const esAreaCalidad = (roles: string[] | undefined | null): boolean => {
    const r = (Array.isArray(roles) ? roles : []).map(sinTildes);
    return r.some((x) => x.includes('informatica') || x.includes('gestion de calidad'));
};
