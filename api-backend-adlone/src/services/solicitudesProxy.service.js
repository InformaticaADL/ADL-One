// Proxy hacia los endpoints /api/v1/solicitudes/* de WebClientesV2.
// La API key (WEBCLIENTES_API_KEY) vive SOLO en este backend; el frontend
// de ADL ONE llama a ESTAS rutas con su JWT normal, y este backend reenvía
// la petición a WebClientesV2 ya autenticada con la key.
import { getConnection } from '../config/database.js';
import sql from 'mssql';

const WC_URL = process.env.WEBCLIENTES_API_URL || 'http://localhost:8020';
// Las solicitudes usan su propia llave (scope solicitudes:write). Facturación y cotizaciones siguen con
// WEBCLIENTES_API_KEY (ingesta:write, cotizaciones:*): no hace falta una sola llave con todos los permisos.
// Si WEBCLIENTES_SOLICITUDES_KEY no está definida se usa WEBCLIENTES_API_KEY, como antes.
const WC_KEY  = process.env.WEBCLIENTES_SOLICITUDES_KEY || process.env.WEBCLIENTES_API_KEY;

function wcHeaders() {
    if (!WC_KEY) throw new Error('WEBCLIENTES_SOLICITUDES_KEY (o WEBCLIENTES_API_KEY) no configurada en .env');
    return {
        Authorization: `Bearer ${WC_KEY}`,
        'Content-Type': 'application/json',
    };
}

async function wcFetch(path, options = {}) {
    const res = await fetch(`${WC_URL}/api${path}`, {
        ...options,
        headers: { ...wcHeaders(), ...(options.headers || {}) },
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
}

const SolicitudesProxyService = {
    /**
     * Lista las solicitudes que esa persona atiende según lo administrado en ADL WEB GO (Administración → Resp. solicitudes): se le pide a la
     * web por correo y responde con los clientes que la persona atiende (con sus asociados) y, si está en la jefatura, con todos.
     * Ya no existen en ADL ONE las empresas asignadas, el grupo de respaldo ni los verificadores: todo eso se administra solo en la web.
     */
    async listar(idUsuario) {
        let correo = null;
        try {
            const pool = await getConnection();
            const r = await pool.request().input('u', sql.Numeric(10, 0), idUsuario)
                .query("SELECT correo_electronico FROM mae_usuario WHERE id_usuario = @u AND habilitado = 'S'");
            correo = String(r.recordset[0]?.correo_electronico || '').trim().toLowerCase() || null;
        } catch (_) { /* sin correo: no se puede saber qué atiende */ }
        if (!correo) return [];
        const qs = new URLSearchParams({ usuario: correo });
        const { status, body } = await wcFetch(`/v1/solicitudes?${qs.toString()}`);
        if (status !== 200) throw new Error(body?.error || 'Error al obtener solicitudes.');
        return body;
    },

    async detalle(idSolicitud) {
        const { status, body } = await wcFetch(`/v1/solicitudes/${idSolicitud}`);
        if (status === 404) return null;
        if (status !== 200) throw new Error(body?.error || 'Error al obtener solicitud.');
        return body;
    },

    async responder(idSolicitud, { texto, autorNombre, autorEmail }) {
        const { status, body } = await wcFetch(`/v1/solicitudes/${idSolicitud}/mensajes`, {
            method: 'POST',
            body: JSON.stringify({ texto, autor_nombre: autorNombre, autor_email: autorEmail }),
        });
        if (status !== 201) throw new Error(body?.error || 'Error al enviar respuesta.');
        return body;
    },

    async cambiarEstado(idSolicitud, estado) {
        const { status, body } = await wcFetch(`/v1/solicitudes/${idSolicitud}/estado`, {
            method: 'PATCH',
            body: JSON.stringify({ estado }),
        });
        if (status !== 200) throw new Error(body?.error || 'Error al cambiar estado.');
        return body;
    },

    async tomar(idSolicitud, { autorNombre, autorEmail }) {
        const { status, body } = await wcFetch(`/v1/solicitudes/${idSolicitud}/tomar`, {
            method: 'POST',
            body: JSON.stringify({ autor_nombre: autorNombre, autor_email: autorEmail }),
        });
        if (status !== 200) throw new Error(body?.error || 'Error al tomar solicitud.');
        return body;
    },
};

export default SolicitudesProxyService;
