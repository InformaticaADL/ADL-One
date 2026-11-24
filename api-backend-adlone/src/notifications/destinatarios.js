// Quién recibe de verdad un aviso. El sistema junta los destinatarios de un evento desde varios lugares (configuración del administrador, reglas,
// destinatarios fijos, gestores de la solicitud) y esta función aplica, EN ESTE ORDEN, las tres reglas que los hacen coherentes entre sí:
//
//  1) EL ACCESO ES EL TECHO. Si la persona no tiene acceso a lo que el aviso cuenta, no recibe nada (aunque alguien la haya puesto en la lista):
//     en una solicitud, acceso al tipo de solicitud; en una ficha u otro aviso, alguno de los permisos que ese aviso declara (cfg_evento_permiso).
//  2) LA SELECCIÓN DENTRO DEL ROL. Un rol puede limitarse a «solo estas personas». Una persona se descarta por esa limitación solo si TODOS los caminos
//     por los que le llegaría el aviso están limitados y la dejan fuera: si también está nombrada directamente, es la propietaria, o llega por otro rol
//     sin limitar, se queda.
//  3) EL SILENCIO POR PERSONA Y CANAL. Tener acceso no obliga a recibir correos: el administrador puede silenciar el correo, el aviso web o ambos para
//     una persona (en un evento o en todos). Si se silencian los dos canales, la persona sale.
//
// Es una función pura (no toca la base de datos) para poder probarla a fondo; uns.service reúne los datos y la usa.

export const MOTIVOS = Object.freeze({
    SIN_ACCESO: 'sin_acceso',
    FUERA_DE_LA_SELECCION: 'fuera_de_la_seleccion_del_rol',
    SILENCIADO: 'silenciado',
});

/**
 * Junta los dos techos posibles de un aviso: el acceso al tipo de solicitud y los permisos que el aviso declara. Si hay los dos, hay que cumplir ambos
 * (intersección); si hay uno solo, ese; si no hay ninguno, no hay techo (null).
 */
export function combinarAcceso(porTipoDeSolicitud, porPermiso) {
    if (!porTipoDeSolicitud && !porPermiso) return null;
    if (!porTipoDeSolicitud) return porPermiso;
    if (!porPermiso) return porTipoDeSolicitud;
    return new Set([...porTipoDeSolicitud].filter((u) => porPermiso.has(u)));
}

/**
 * @param {object} p
 * @param {Map<number,{id_usuario:number,web:boolean,email:boolean}>} p.destinatarios  ya resueltos por el sistema
 * @param {Map<number,number[]>} p.rolesDe              roles de cada persona (id_usuario → ids de rol)
 * @param {Set<number>} p.rolesDelEvento                roles por los que el evento llega (configuración + reglas + permisos del tipo de solicitud)
 * @param {Set<number>} p.directos                      personas nombradas directamente + propietaria (no las alcanza la limitación de un rol)
 * @param {Map<number,Set<number>>} p.limites           rol → «solo estas personas»
 * @param {Set<number>|null} p.acceso                   quién tiene acceso (null = el aviso no tiene techo: no aplica)
 * @param {Array<{id_usuario:number, canal:'EMAIL'|'WEB'|'TODOS'}>} p.silencios   ya filtrados para este evento
 * @returns {{aceptados: Map<number,object>, descartados: Array<{id_usuario:number, motivo:string, detalle?:string}>}}
 */
export function decidirDestinatarios({ destinatarios, rolesDe = new Map(), rolesDelEvento = new Set(), directos = new Set(), limites = new Map(), acceso = null, silencios = [] }) {
    const aceptados = new Map();
    const descartados = [];

    for (const [uid, dest] of destinatarios) {
        // 1) techo de acceso
        if (acceso && !acceso.has(uid)) {
            descartados.push({ id_usuario: uid, motivo: MOTIVOS.SIN_ACCESO });
            continue;
        }

        // 2) selección dentro del rol
        if (!directos.has(uid)) {
            const roles = rolesDe.get(uid) || [];
            // roles por los que este aviso podría llegarle a la persona
            const caminos = roles.filter((r) => rolesDelEvento.has(r));
            const limitados = caminos.filter((r) => limites.has(r));
            if (limitados.length > 0) {
                const hayCaminoLibre = caminos.some((r) => !limites.has(r));
                const laIncluyeAlguno = limitados.some((r) => limites.get(r).has(uid));
                if (!hayCaminoLibre && !laIncluyeAlguno) {
                    descartados.push({ id_usuario: uid, motivo: MOTIVOS.FUERA_DE_LA_SELECCION, detalle: limitados.join(',') });
                    continue;
                }
            }
        }

        // 3) silencio por persona y canal
        let email = !!dest.email;
        let web = !!dest.web;
        for (const s of silencios) {
            if (Number(s.id_usuario) !== uid) continue;
            if (s.canal === 'TODOS' || s.canal === 'EMAIL') email = false;
            if (s.canal === 'TODOS' || s.canal === 'WEB') web = false;
        }
        if (!email && !web) {
            descartados.push({ id_usuario: uid, motivo: MOTIVOS.SILENCIADO });
            continue;
        }
        aceptados.set(uid, { ...dest, email, web });
    }
    return { aceptados, descartados };
}

/**
 * Para la pantalla del administrador: por qué recibe (o no) cada persona. Recibe a todas las personas posibles y devuelve, para cada una, si recibe,
 * por qué canales y el motivo. No decide nada nuevo: usa decidirDestinatarios.
 */
export function explicarDestinatarios(entrada, nombres = new Map()) {
    const { aceptados, descartados } = decidirDestinatarios(entrada);
    const filas = [];
    for (const [uid, d] of aceptados) filas.push({ id_usuario: uid, nombre: nombres.get(uid) || null, recibe: true, email: d.email, web: d.web, motivo: null });
    for (const x of descartados) filas.push({ id_usuario: x.id_usuario, nombre: nombres.get(x.id_usuario) || null, recibe: false, email: false, web: false, motivo: x.motivo });
    return filas.sort((a, b) => (b.recibe - a.recibe) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
}
