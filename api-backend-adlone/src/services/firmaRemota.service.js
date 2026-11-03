import crypto from 'crypto';
import os from 'os';
import QRCode from 'qrcode';

// Firma del muestreador desde su celular: la web genera un QR con un enlace de
// un solo uso; el celular abre una página pública (/firma/<token>) para firmar
// y "Grabar"; la web consulta la sesión hasta que llega la firma.
//
// Al "Grabar firma" la ficha queda firmada y registrada en el equipo en ese
// momento (lo hace la ruta pública, con el usuario que generó el QR): la web
// solo se entera y cierra la ventana. Después, el celular lista las otras
// fichas del mismo muestreador pendientes de firma y puede firmarlas ahí mismo
// (cada una con su propia sesión, heredando ese usuario).
//
// Las sesiones viven en memoria (15 minutos). Una vez registrada la firma, la
// sesión queda unos minutos más para que la web vea el resultado. El token
// (32 bytes aleatorios) es la única llave, por eso la página del celular no pide login.

const DURACION_MS = 15 * 60 * 1000;
const DURACION_REGISTRADA_MS = 10 * 60 * 1000;
const sesiones = new Map();

const limpiarVencidas = () => {
    const ahora = Date.now();
    for (const [t, s] of sesiones) if (s.expira < ahora) sesiones.delete(t);
};

const error = (mensaje, statusCode) => Object.assign(new Error(mensaje), { statusCode });
const ENLACE_INVALIDO = 'Este enlace de firma no es válido o ya venció. Pida que generen un código QR nuevo.';

const vigente = (token) => {
    const s = sesiones.get(token);
    if (!s || s.expira < Date.now()) throw error(ENLACE_INVALIDO, 410);
    return s;
};

const buscarPorFicha = (idVerificacion) => {
    for (const [t, s] of sesiones) if (s.idVerificacion === Number(idVerificacion) && s.expira >= Date.now()) return [t, s];
    return [null, null];
};

// URL que abre el celular. El navegador de la web suele hablar con el backend
// como "localhost", que el celular no puede alcanzar: en ese caso se usa la IP
// de este servidor en la red local. FIRMA_REMOTA_URL_BASE la fija a mano.
export const urlPublica = (req, token) => {
    if (process.env.FIRMA_REMOTA_URL_BASE) return `${process.env.FIRMA_REMOTA_URL_BASE.replace(/\/$/, '')}/firma/${token}`;
    const [host, puerto] = String(req.headers.host || '').split(':');
    let destino = host;
    if (!host || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
        const ip = Object.values(os.networkInterfaces()).flat().find((x) => x && x.family === 'IPv4' && !x.internal);
        destino = ip?.address || host || 'localhost';
    }
    return `${req.protocol}://${destino}${puerto ? `:${puerto}` : ''}/firma/${token}`;
};

const firmaRemotaService = {
    /**
     * Sesión de firma para una ficha (reemplaza la anterior de esa ficha).
     * @param url  (token) => enlace absoluto; si se pasa, también se genera el QR.
     */
    async crear({ idVerificacion, idMuestreador, idUsuario, info, url }) {
        limpiarVencidas();
        // Una sola sesión activa por ficha: una nueva invalida la anterior.
        const [tokenPrevio] = buscarPorFicha(idVerificacion);
        if (tokenPrevio) sesiones.delete(tokenPrevio);
        const token = crypto.randomBytes(32).toString('hex');
        const enlace = url ? url(token) : `/firma/${token}`;
        sesiones.set(token, {
            idVerificacion: Number(idVerificacion), idMuestreador: Number(idMuestreador), idUsuario: idUsuario || null,
            info, firma: null, firmadoEn: null, registrada: false, expira: Date.now() + DURACION_MS,
        });
        const qr = url ? await QRCode.toDataURL(enlace, { margin: 1, width: 320, errorCorrectionLevel: 'M' }) : null;
        return { token, url: enlace, qr, expira: new Date(Date.now() + DURACION_MS).toISOString() };
    },

    // Para la web (con sesión iniciada): ¿ya firmó?
    estado(token, idVerificacion) {
        const s = sesiones.get(token);
        if (!s || s.idVerificacion !== Number(idVerificacion)) throw error('El código QR ya no es válido. Genere uno nuevo.', 404);
        if (s.expira < Date.now()) { sesiones.delete(token); throw error('El código QR venció. Genere uno nuevo.', 410); }
        return s.firma
            ? { estado: 'firmado', registrada: s.registrada, firma: s.firma, firmado_en: s.firmadoEn, id_muestreador: s.idMuestreador }
            : { estado: 'pendiente', expira: new Date(s.expira).toISOString() };
    },

    // Para el celular (público): lo que ve antes de firmar.
    info(token) {
        const s = vigente(token);
        return { ...s.info, ya_firmado: s.registrada };
    },

    // Muestreador e id de ficha de una sesión vigente (para listar sus pendientes).
    sesion(token) {
        const s = vigente(token);
        return { idVerificacion: s.idVerificacion, idMuestreador: s.idMuestreador, idUsuario: s.idUsuario };
    },

    // Valida la firma recibida del celular y devuelve a qué ficha corresponde
    // (la ruta pública la firma y registra con verificacionTemperaturaService.firmar).
    recibirFirma(token, firma) {
        const s = vigente(token);
        if (s.registrada) throw error('Esta verificación ya quedó firmada.', 409);
        const f = String(firma || '');
        if (!/^data:image\/png;base64,/.test(f)) throw error('Firma inválida', 400);
        if (f.length > 900_000) throw error('La imagen de la firma es demasiado grande', 400);
        return { idVerificacion: s.idVerificacion, idMuestreador: s.idMuestreador, idUsuario: s.idUsuario, firma: f };
    },

    // La ficha quedó firmada y registrada: la web lo ve en su próxima consulta
    // y el enlace ya no permite volver a firmar.
    marcarRegistrada(idVerificacion, firma) {
        for (const s of sesiones.values()) {
            if (s.idVerificacion !== Number(idVerificacion)) continue;
            s.firma = firma || s.firma;
            s.firmadoEn = new Date().toISOString();
            s.registrada = true;
            s.expira = Date.now() + DURACION_REGISTRADA_MS;
        }
    },

};

export default firmaRemotaService;
