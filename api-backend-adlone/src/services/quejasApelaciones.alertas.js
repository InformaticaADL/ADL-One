// =============================================================================
// Avisos de plazo de Quejas y apelaciones (campana de ADL-One).
//
// Una vez al día (scheduler) se revisan los casos abiertos (base de ADLWeb) y se
// avisa al área de Gestión de Calidad de los que están por vencer (3 días hábiles
// o menos) o ya vencidos. Mismo criterio que los avisos de vencimiento de equipos
// (equipo-vencimientos.service.js): cada caso se avisa UNA vez por tramo y por
// fecha de plazo, buscando el aviso en las notificaciones ya enviadas.
// Destinatarios: rol «Área Gestión de Calidad» (Informática no, para no saturarla).
// El aviso lleva id_referencia = id del caso: al pulsarlo se abre el caso.
// =============================================================================
import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { getConnectionAdlWeb } from '../config/databaseAdlWeb.js';
import unsService from './uns.service.js';
import logger from '../utils/logger.js';
import { diasHabilesHasta, DIAS_AVISO, TIPOS } from './quejasApelaciones.service.js';

export const AREA_QUEJAS_APELACIONES = 'Quejas y apelaciones';

const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pad2 = (n) => String(n).padStart(2, '0');
const isoLocal = (d) => (d instanceof Date ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` : String(d).slice(0, 10));
const dmy = (iso) => iso.split('-').reverse().join('/');
const hoyChile = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(new Date());

// Tramos: el título empieza con el tipo («Queja…» / «Apelación…»); así el frontend sabe qué sección abrir.
const tramoDe = (dias) => (dias < 0 ? { clave: 'vencida', tipoAviso: 'ERROR' } : dias <= DIAS_AVISO ? { clave: 'por vencer', tipoAviso: 'WARNING' } : null);
// Texto que identifica el caso y su plazo dentro del aviso; sirve para saber si ya se avisó.
const marca = (c) => `${c.folio} · plazo ${dmy(c.plazo)}`;

export async function notificarPlazosQuejasApelaciones() {
    const poolOne = await getConnection();
    const usuarios = (await poolOne.request().query(`
        SELECT u.id_usuario, r.nombre_rol
        FROM mae_usuario u
        JOIN rel_usuario_rol ur ON ur.id_usuario = u.id_usuario
        JOIN mae_rol r ON r.id_rol = ur.id_rol
        WHERE u.habilitado = 'S'`)).recordset
        .filter((x) => sinTildes(x.nombre_rol).includes('gestion de calidad'))
        .map((x) => Number(x.id_usuario));
    const destinatarios = [...new Set(usuarios)];
    if (!destinatarios.length) return { enviadas: 0 };

    const poolWeb = await getConnectionAdlWeb();
    const hoy = hoyChile();
    const casos = (await poolWeb.request().query(`
        SELECT id, folio, tipo, empresa, responsable, plazo_vence AS plazo
        FROM dbo.quejas_apelaciones
        WHERE estado NOT IN ('cerrada', 'no_procede') AND plazo_vence IS NOT NULL`)).recordset
        .map((c) => ({ ...c, plazo: isoLocal(c.plazo) }))
        .map((c) => ({ ...c, dias: diasHabilesHasta(hoy, c.plazo) }))
        .filter((c) => tramoDe(c.dias));
    if (!casos.length) return { enviadas: 0 };

    const previos = (await poolOne.request()
        .input('area', sql.VarChar(50), AREA_QUEJAS_APELACIONES)
        .query(`SELECT id_usuario, titulo, mensaje FROM mae_notificacion
                WHERE area = @area AND fecha_creacion >= DATEADD(day, -180, GETUTCDATE())`)).recordset;

    let enviadas = 0;
    for (const c of casos) {
        const tramo = tramoDe(c.dias);
        const tipoTxt = TIPOS[c.tipo] || 'Caso';
        const titulo = `${tipoTxt} ${tramo.clave === 'vencida' ? 'vencida' : 'por vencer'}: ${c.folio}`.slice(0, 200);
        const cuando = c.dias < 0
            ? `venció hace ${-c.dias} día${c.dias === -1 ? '' : 's'} hábil${c.dias === -1 ? '' : 'es'}`
            : c.dias === 0 ? 'vence hoy' : `vence en ${c.dias} día${c.dias === 1 ? '' : 's'} hábil${c.dias === 1 ? '' : 'es'}`;
        const mensaje = `${marca(c)} (${cuando}) · ${c.empresa || ''}${c.responsable ? ` · Responsable: ${c.responsable}` : ' · Sin responsable'}`;
        for (const idUsuario of destinatarios) {
            const yaAvisado = previos.some((n) => Number(n.id_usuario) === idUsuario
                && String(n.titulo || '').includes(tramo.clave === 'vencida' ? 'vencida' : 'por vencer')
                && String(n.mensaje || '').includes(marca(c)));
            if (yaAvisado) continue;
            try {
                await unsService.sendWebNotification(idUsuario, titulo, mensaje, tramo.tipoAviso, c.id, AREA_QUEJAS_APELACIONES);
                enviadas++;
            } catch (err) {
                logger.error(`[Quejas y apelaciones] No se pudo avisar al usuario ${idUsuario} del plazo de ${c.folio}:`, err);
            }
        }
    }
    return { enviadas };
}
