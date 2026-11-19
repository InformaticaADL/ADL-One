// Áreas a las que pertenece un usuario según sus roles (nombres de mae_rol):
//   · Gestión de Calidad: rol «Área Gestión de Calidad».
//   · Medio Ambiente: roles «Área Técnica MAM», «Área Coordinación MAM» y «Gerencia Técnica».
//   · Informática: ambas (soporte y pruebas).
// Se usa para las firmas de Puesta en Marcha, el V°B° de la verificación de caudal y para registrar tipos de equipo
// nuevos (la sigla la define Calidad).

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const areasPorRoles = (nombresRoles = []) => {
    const r = (Array.isArray(nombresRoles) ? nombresRoles : []).map(sinTildes);
    const informatica = r.some((x) => x.includes('informatica'));
    return {
        CALIDAD: informatica || r.some((x) => x.includes('gestion de calidad')),
        TECNICA: informatica || r.some((x) => x.includes('tecnica mam') || x.includes('coordinacion mam') || x.includes('gerencia tecnica')),
    };
};
