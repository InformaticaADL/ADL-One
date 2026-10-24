// Proxy hacia los endpoints /api/v1/solicitudes/* de WebClientesV2.
// La API key (WEBCLIENTES_API_KEY) vive SOLO en este backend; el frontend
// de ADL ONE llama a ESTAS rutas con su JWT normal, y este backend reenvía
// la petición a WebClientesV2 ya autenticada con la key.
import { getConnection } from '../config/database.js';
import sql from 'mssql';
import empresaAsignadaService from './empresaAsignada.service.js';
import verificadorSolicitudesService from './verificadorSolicitudes.service.js';

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
     * Lista las solicitudes de las empresas asignadas al usuario, más las de cualquier empresa
     * sin nadie asignado si el usuario es del grupo de respaldo (mismo criterio que WebClientesV2
     * usa para decidir a quién avisar — ver incluirSinAsignar en GET /v1/solicitudes). Antes solo
     * se pedían las explícitamente asignadas: alguien del grupo de respaldo recibía el aviso en su
     * campanita pero no encontraba la solicitud acá.
     */
    async listar(idUsuario) {
        const [empresas, esRespaldo, esVerificador] = await Promise.all([
            empresaAsignadaService.misEmpresas(idUsuario),
            empresaAsignadaService.esRespaldo(idUsuario),
            verificadorSolicitudesService.esVerificador(idUsuario),
        ]);
        if (!empresas.length && !esRespaldo && !esVerificador) return [];
        const ids = empresas.map(e => e.id_empresa).join(',');
        const qs = new URLSearchParams();
        if (ids) qs.set('empresas', ids);
        if (esRespaldo) qs.set('incluirSinAsignar', '1');
        // Los verificadores (jefatura en copia) ven las solicitudes de TODAS las empresas.
        if (esVerificador) qs.set('todas', '1');
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
// Reusado por empresaAsignada.service.js para pedirle a WebClientesV2 qué empresas son
// clientes reales del portal (misma API key, mismo helper de fetch).
export { wcFetch };
