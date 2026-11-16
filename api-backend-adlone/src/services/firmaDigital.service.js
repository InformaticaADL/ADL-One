import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';

// Firmas digitales (migrations/add_firma_digital.sql). Cada persona —usuario
// de ADL One o muestreador— tiene una firma vigente; al cambiarla, la anterior
// queda como historial (vigente = 0). No toca mae_firma (laboratorio).

const TABLA = 'mae_firma_digital';
const MAX_IMAGEN = 900_000;
const TIPOS = ['USUARIO', 'MUESTREADOR'];
const ORIGENES = ['DIBUJADA', 'IMPORTADA'];
const error = (message, status = 400) => Object.assign(new Error(message), { status });

// Mientras falte la tabla se vuelve a revisar (funciona apenas se ejecute la
// migración, sin reiniciar), pero el aviso sale una sola vez.
let tablaExiste = false;
let avisado = false;
const hayTabla = async (pool) => {
    if (tablaExiste) return true;
    const r = await pool.request().query(`SELECT OBJECT_ID('${TABLA}', 'U') AS id`);
    tablaExiste = !!r.recordset[0]?.id;
    if (!tablaExiste && !avisado) {
        avisado = true;
        logger.warn(`Falta ${TABLA} — ejecute migrations/add_firma_digital.sql`);
    }
    return tablaExiste;
};
const exigirTabla = async (pool) => {
    if (!(await hayTabla(pool))) throw error('Falta ejecutar la migración add_firma_digital.sql en la base de datos', 503);
};

const firmante = (tipo, id) => {
    if (!TIPOS.includes(tipo)) throw error('Tipo de firmante inválido');
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) throw error('Firmante inválido', 401);
    return n;
};

// Área a partir del cargo (ej. "Asistente de Gestión de Calidad – Medio Ambiente").
const areaDeCargo = (cargo) => {
    const c = String(cargo || '').toLowerCase();
    if (/calidad/.test(c)) return 'Gestión de Calidad';
    if (/medio ambiente/.test(c)) return 'Medio Ambiente';
    if (/laborator/.test(c)) return 'Laboratorio';
    return null;
};

// Nombre y cargo actuales de la persona, para dejarlos con la firma.
const datosFirmante = async (pool, tipo, id) => {
    if (tipo === 'USUARIO') {
        const r = await pool.request().input('id', sql.Numeric(10, 0), id).query(`
            SELECT LTRIM(RTRIM(u.usuario)) AS nombre, LTRIM(RTRIM(k.nombre_cargo)) AS cargo
            FROM mae_usuario u LEFT JOIN mae_cargo k ON k.id_cargo = u.id_cargo
            WHERE u.id_usuario = @id`);
        return r.recordset[0] || {};
    }
    const r = await pool.request().input('id', sql.Numeric(10, 0), id)
        .query('SELECT LTRIM(RTRIM(nombre_muestreador)) AS nombre, NULL AS cargo FROM mae_muestreador WHERE id_muestreador = @id');
    return r.recordset[0] || {};
};

const firmaDigitalService = {
    async disponible() {
        const pool = await getConnection();
        return hayTabla(pool);
    },

    /** Imagen de la firma vigente, o null si no tiene (o falta la tabla). */
    async obtener(tipo, idFirmante) {
        const id = firmante(tipo, idFirmante);
        const pool = await getConnection();
        if (!(await hayTabla(pool))) return null;
        const r = await pool.request()
            .input('tipo', sql.VarChar(15), tipo)
            .input('id', sql.Numeric(10, 0), id)
            .query(`SELECT imagen FROM ${TABLA} WHERE tipo_firmante = @tipo AND id_firmante = @id AND vigente = 1`);
        return r.recordset[0]?.imagen || null;
    },

    /**
     * Firma vigente con su versión ({ id_firma, imagen, nombre, cargo }) o null.
     * El id_firma queda registrado en los documentos que la usan.
     */
    async vigente(tipo, idFirmante) {
        const id = firmante(tipo, idFirmante);
        const pool = await getConnection();
        if (!(await hayTabla(pool))) return null;
        const r = await pool.request()
            .input('tipo', sql.VarChar(15), tipo)
            .input('id', sql.Numeric(10, 0), id)
            .query(`SELECT id_firma, imagen, nombre_firmante AS nombre, cargo FROM ${TABLA}
                    WHERE tipo_firmante = @tipo AND id_firmante = @id AND vigente = 1`);
        return r.recordset[0] || null;
    },

    /** Nombre y cargo actuales de un usuario o muestreador. */
    async datos(tipo, idFirmante) {
        const id = firmante(tipo, idFirmante);
        const pool = await getConnection();
        return datosFirmante(pool, tipo, id);
    },

    /** Registra una firma nueva (la anterior queda como historial). */
    async guardar(tipo, idFirmante, { imagen, origen = 'DIBUJADA', idUsuarioRegistra = null } = {}) {
        const id = firmante(tipo, idFirmante);
        const img = String(imagen || '');
        if (!/^data:image\/(png|jpeg);base64,/.test(img)) throw error('La firma debe ser una imagen PNG o JPG');
        if (img.length > MAX_IMAGEN) throw error('La imagen de la firma es demasiado grande');
        const org = ORIGENES.includes(String(origen).toUpperCase()) ? String(origen).toUpperCase() : 'DIBUJADA';
        const pool = await getConnection();
        await exigirTabla(pool);
        const p = await datosFirmante(pool, tipo, id);
        const tx = new sql.Transaction(pool);
        await tx.begin();
        try {
            await new sql.Request(tx)
                .input('tipo', sql.VarChar(15), tipo)
                .input('id', sql.Numeric(10, 0), id)
                .query(`UPDATE ${TABLA} SET vigente = 0, fecha_baja = GETDATE() WHERE tipo_firmante = @tipo AND id_firmante = @id AND vigente = 1`);
            await new sql.Request(tx)
                .input('tipo', sql.VarChar(15), tipo)
                .input('id', sql.Numeric(10, 0), id)
                .input('nombre', sql.NVarChar(150), p.nombre ? String(p.nombre).slice(0, 150) : null)
                .input('area', sql.NVarChar(80), areaDeCargo(p.cargo))
                .input('cargo', sql.NVarChar(150), p.cargo ? String(p.cargo).slice(0, 150) : null)
                .input('imagen', sql.NVarChar(sql.MAX), img)
                .input('origen', sql.VarChar(15), org)
                .input('registra', sql.Numeric(10, 0), idUsuarioRegistra ? Number(idUsuarioRegistra) : null)
                .query(`INSERT INTO ${TABLA} (tipo_firmante, id_firmante, nombre_firmante, area, cargo, imagen, origen, id_usuario_registra)
                        VALUES (@tipo, @id, @nombre, @area, @cargo, @imagen, @origen, @registra)`);
            await tx.commit();
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },

    /** Deja sin firma vigente (queda en el historial). */
    async quitar(tipo, idFirmante) {
        const id = firmante(tipo, idFirmante);
        const pool = await getConnection();
        await exigirTabla(pool);
        await pool.request()
            .input('tipo', sql.VarChar(15), tipo)
            .input('id', sql.Numeric(10, 0), id)
            .query(`UPDATE ${TABLA} SET vigente = 0, fecha_baja = GETDATE() WHERE tipo_firmante = @tipo AND id_firmante = @id AND vigente = 1`);
    },
};

export default firmaDigitalService;
