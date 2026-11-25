import sql from 'mssql';
import { getConnection } from '../config/database.js';
import { errorResponse } from '../utils/response.js';
import logger from '../utils/logger.js';

const PERMISOS_PREPARAR = ['MA_A_GEST_EQUIPO', 'GC_VERIF_TEMP'];

/**
 * Quién puede leer las firmas registradas para importarlas en una ficha: quien administra fichas de equipo y,
 * además, quien tiene una ficha esperando su firma. Sin lo segundo, los jefes que solo firman (Área Técnica y
 * Coordinación MAM) recibían 403 al traer la firma del responsable que recibe el equipo, aunque firmar la ficha
 * sí les esté permitido (ver routes/fichaFirma.routes.js).
 */
export const permisoFirmasRegistradas = async (req, res, next) => {
    try {
        if (!req.user?.id) return errorResponse(res, 'No autenticado', 401);
        if ((req.user.permissions || []).some((p) => PERMISOS_PREPARAR.includes(p))) return next();

        const pool = await getConnection();
        const existen = await pool.request().query(
            "SELECT OBJECT_ID('mae_ficha_firma', 'U') AS f, OBJECT_ID('mae_ficha_firma_firmante', 'U') AS fm");
        const { f, fm } = existen.recordset[0];
        if (f && fm) {
            const r = await pool.request().input('u', sql.Numeric(10, 0), Number(req.user.id)).query(`
                SELECT TOP 1 1 AS hay
                FROM mae_ficha_firma f
                JOIN mae_ficha_firma_firmante x ON x.id_ficha_firma = f.id_ficha_firma
                WHERE f.estado = 'PENDIENTE' AND x.id_usuario = @u AND x.estado = 'PENDIENTE'`);
            if (r.recordset.length) return next();
        }
        return errorResponse(res, 'No tiene acceso a las firmas registradas.', 403);
    } catch (e) {
        logger.error('permisoFirmasRegistradas:', e);
        return errorResponse(res, 'No se pudo validar el acceso', 500);
    }
};

export default permisoFirmasRegistradas;
