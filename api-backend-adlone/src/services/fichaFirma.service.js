import sql from 'mssql';
import { getConnection } from '../config/database.js';
import logger from '../utils/logger.js';
import fichasEquipoService from './fichasEquipo.service.js';
import gcDocumentosService from './gcDocumentos.service.js';
import firmaDigitalService from './firmaDigital.service.js';
import { PERMISOS_GC, puedeGc } from '../utils/permisosCalidad.js';

// Fichas de equipo que se envían a firmar (migrations/add_firmas_pendientes_fichas.sql).
//
//   1. Quien prepara la ficha (asistente de Gestión de Calidad - Medio Ambiente) la revisa y la envía: crear().
//   2. Cada firmante (responsable de entrega, responsable de área) recibe una solicitud de firma: aparece en
//      "Firmas pendientes" de Solicitudes, con un aviso. Ve la ficha sin opción de guardarla ni imprimirla y la
//      firma dibujando, con su firma registrada o con el celular (QR): firmar().
//   3. Cuando firman todos, la ficha se genera con todas las firmas, se guarda en el archivo de documentos de
//      Gestión de Calidad y a quien la preparó le llega un aviso: completar().
//
// Por ahora el único tipo de ficha es la de entrega (OI-FoGe-36).

const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const MAX_IMAGEN = 900_000;
const TEXTO_ROL = { ENTREGA: 'responsable de entrega', RESPONSABLE_AREA: 'responsable de área' };

// Campos de la ficha de entrega que viajan en la solicitud (los mismos del formulario).
const CAMPOS = ['nombre', 'marca', 'modelo', 'serie', 'codigo', 'proveedor', 'n_factura', 'fecha_factura', 'valor',
    'frecuencia_mantencion', 'fecha_adquisicion', 'area', 'seccion', 'responsable_equipo', 'fecha_recepcion',
    'observaciones', 'responsable_entrega', 'responsable_area', 'fecha_entrega', 'fecha_area'];

let hayTabla = false;
const exigirTablas = async (pool) => {
    if (hayTabla) return;
    const r = await pool.request().query("SELECT OBJECT_ID('mae_ficha_firma', 'U') AS a, OBJECT_ID('mae_ficha_firma_firmante', 'U') AS b");
    hayTabla = !!r.recordset[0]?.a && !!r.recordset[0]?.b;
    if (!hayTabla) throw error('Falta ejecutar la migración add_firmas_pendientes_fichas.sql en la base de datos.', 503);
};

const esImagen = (v) => /^data:image\/(png|jpeg);base64,/.test(String(v || '')) && String(v).length <= MAX_IMAGEN;
const hoyYmd = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

const notificar = async (idUsuario, titulo, mensaje, idFicha) => {
    try {
        const { default: uns } = await import('./uns.service.js');
        await uns.sendWebNotification(idUsuario, titulo, mensaje, 'INFO', idFicha, 'Firmas');
    } catch (e) {
        logger.warn(`Firmas pendientes: no se pudo avisar al usuario ${idUsuario}: ${e.message}`);
    }
};

const cargarFicha = async (pool, id) => {
    const f = (await pool.request().input('id', sql.Int, Number(id)).query('SELECT * FROM mae_ficha_firma WHERE id_ficha_firma = @id')).recordset[0];
    if (!f) throw error('Solicitud de firma no encontrada', 404);
    let datos = {};
    try { datos = JSON.parse(f.datos || '{}'); } catch { datos = {}; }
    const firmantes = (await pool.request().input('id', sql.Int, Number(id))
        .query('SELECT * FROM mae_ficha_firma_firmante WHERE id_ficha_firma = @id ORDER BY id_firmante')).recordset;
    return { ...f, datos, firmantes };
};

const puedeVerPropia = (f, idUsuario) => Number(f.id_usuario_crea) === Number(idUsuario) || f.firmantes.some((x) => Number(x.id_usuario) === Number(idUsuario));

// Seguimiento de todas las solicitudes de firma: permiso GC_SEGUIMIENTO_FIRMAS (Configurar rol / permisos). Mientras
// la migración add_permiso_seguimiento_firmas.sql no lo cree, rige el rol de Gestión de Calidad (e Informática).
// Se lee de la base en cada consulta, así un cambio de permisos rige de inmediato.
const puedeSeguimiento = (pool, idUsuario) => puedeGc(pool, idUsuario, PERMISOS_GC.SEGUIMIENTO_FIRMAS);

/** Quien la envió, quien debe firmarla o quien lleva el seguimiento (solo para ver: firmar sigue siendo de cada firmante). */
const puedeVer = async (pool, f, idUsuario) => puedeVerPropia(f, idUsuario) || puedeSeguimiento(pool, idUsuario);

const fichaFirmaService = {
    /** Prepara y envía la ficha a firmar. body = datos de la ficha de entrega + id_equipo + id_firmante_entrega + id_firmante_area. */
    async crear(body = {}, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const idEntrega = Number(body.id_firmante_entrega);
        const idArea = Number(body.id_firmante_area);
        if (!idEntrega || !idArea) throw error('Elija el responsable de entrega y el responsable de área.');
        // Pueden ser la misma persona: entonces firma una sola vez y esa firma vale para los dos cargos.
        const lista = await fichasEquipoService.responsablesEntrega();
        const entrega = lista.find((r) => r.id_usuario === idEntrega);
        const area = lista.find((r) => r.id_usuario === idArea);
        if (!entrega || !area) throw error('Solo pueden firmar las personas de la lista de responsables de la ficha de entrega.');
        if (area.puede_area === false) throw error(`${area.nombre} firma como responsable de entrega, no como responsable de área (jefe del área).`);

        const datos = {};
        for (const c of CAMPOS) datos[c] = body[c] === undefined || body[c] === null ? '' : String(body[c]).slice(0, c === 'observaciones' ? 2000 : 300);
        datos.responsable_entrega = entrega.nombre;
        datos.responsable_area = area.nombre;
        // La firma de quien recibe el equipo (un muestreador) puede venir hecha; las demás se firman después.
        // La fecha de recepción es la de esa firma (si no se escribió otra).
        if (esImagen(body.firma_equipo)) {
            datos.firma_equipo = body.firma_equipo;
            if (!datos.fecha_recepcion) datos.fecha_recepcion = hoyYmd();
        }
        // Se comprueba que la ficha se puede generar antes de enviarla a nadie.
        await fichasEquipoService.entregaPdf({ ...datos }, null);

        let idEquipo = Number(body.id_equipo) || null;
        let equipo = { codigo: datos.codigo, nombre: datos.nombre, sede: '' };
        if (idEquipo) { try { equipo = { ...equipo, ...(await fichasEquipoService.equipoBasico(idEquipo)) }; } catch { idEquipo = null; } }

        const tx = new sql.Transaction(pool);
        await tx.begin();
        let idFicha;
        try {
            const r = await new sql.Request(tx)
                .input('eq', sql.Numeric(10, 0), idEquipo)
                .input('cod', sql.VarChar(100), String(equipo.codigo || '').slice(0, 100) || null)
                .input('nom', sql.NVarChar(200), String(equipo.nombre || '').slice(0, 200) || null)
                .input('sede', sql.VarChar(10), String(equipo.sede || '').slice(0, 10) || null)
                .input('datos', sql.NVarChar(sql.MAX), JSON.stringify(datos))
                .input('usu', sql.Numeric(10, 0), Number(usuario.id))
                .input('nomUsu', sql.NVarChar(150), usuario.name ? String(usuario.name).slice(0, 150) : null)
                .query(`INSERT INTO mae_ficha_firma (tipo_ficha, id_equipo, codigo_equipo, nombre_equipo, sede, datos, id_usuario_crea, nombre_crea)
                        OUTPUT INSERTED.id_ficha_firma
                        VALUES ('ENTREGA', @eq, @cod, @nom, @sede, @datos, @usu, @nomUsu)`);
            idFicha = r.recordset[0].id_ficha_firma;
            for (const [rol, p] of [['ENTREGA', entrega], ['RESPONSABLE_AREA', area]]) {
                await new sql.Request(tx)
                    .input('f', sql.Int, idFicha).input('rol', sql.VarChar(20), rol)
                    .input('u', sql.Numeric(10, 0), p.id_usuario)
                    .input('n', sql.NVarChar(150), p.nombre).input('c', sql.NVarChar(150), p.cargo || null)
                    .query('INSERT INTO mae_ficha_firma_firmante (id_ficha_firma, rol, id_usuario, nombre, cargo) VALUES (@f, @rol, @u, @n, @c)');
            }
            await tx.commit();
        } catch (e) {
            await tx.rollback();
            throw e;
        }

        // Un aviso por persona (si es la misma en los dos cargos, uno solo que nombra ambos).
        const avisados = new Map();
        for (const [rol, p] of [['ENTREGA', entrega], ['RESPONSABLE_AREA', area]]) {
            avisados.set(p.id_usuario, [...(avisados.get(p.id_usuario) || []), TEXTO_ROL[rol]]);
        }
        for (const [idUsuario, roles] of avisados) {
            await notificar(idUsuario, 'Firma pendiente: ficha de entrega',
                `${usuario.name || 'Gestión de Calidad'} le envió la ficha de entrega de ${equipo.codigo || datos.nombre} para que la firme como ${roles.join(' y ')}.`, idFicha);
        }
        return { id_ficha_firma: idFicha };
    },

    /** Solicitudes de firma que esta persona tiene por firmar. */
    async pendientes(usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const r = await pool.request().input('u', sql.Numeric(10, 0), Number(usuario.id)).query(`
            SELECT f.id_ficha_firma, f.tipo_ficha, f.codigo_equipo, f.nombre_equipo, f.nombre_crea, f.fecha_creacion, fm.rol,
                   (SELECT COUNT(*) FROM mae_ficha_firma_firmante x WHERE x.id_ficha_firma = f.id_ficha_firma AND x.estado = 'FIRMADA') AS firmadas,
                   (SELECT COUNT(*) FROM mae_ficha_firma_firmante x WHERE x.id_ficha_firma = f.id_ficha_firma) AS total
            FROM mae_ficha_firma f
            JOIN mae_ficha_firma_firmante fm ON fm.id_ficha_firma = f.id_ficha_firma
            WHERE f.estado = 'PENDIENTE' AND fm.id_usuario = @u AND fm.estado = 'PENDIENTE'
            ORDER BY f.fecha_creacion DESC`);
        // Una persona puede ser a la vez responsable de entrega y de área: se muestra una sola vez, con sus cargos.
        const porFicha = new Map();
        for (const x of r.recordset) {
            const previo = porFicha.get(x.id_ficha_firma);
            if (previo) previo.roles.push(x.rol); else porFicha.set(x.id_ficha_firma, { ...x, roles: [x.rol] });
        }
        return [...porFicha.values()];
    },

    /** Cuántas firmas tiene pendientes (para el contador). 0 si aún no existen las tablas. */
    async contar(usuario) {
        try { return (await this.pendientes(usuario)).length; } catch (e) { if (e.statusCode === 503) return 0; throw e; }
    },

    /** Las que esta persona preparó y envió, con el estado de cada firma. */
    async enviadas(usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const fichas = (await pool.request().input('u', sql.Numeric(10, 0), Number(usuario.id)).query(`
            SELECT TOP 100 id_ficha_firma, tipo_ficha, codigo_equipo, nombre_equipo, estado, fecha_creacion, fecha_completa, id_documento, motivo_cancelacion
            FROM mae_ficha_firma WHERE id_usuario_crea = @u ORDER BY fecha_creacion DESC`)).recordset;
        if (!fichas.length) return [];
        const ids = fichas.map((f) => Number(f.id_ficha_firma)).join(',');
        const firmantes = (await pool.request().query(`
            SELECT id_ficha_firma, rol, nombre, cargo, estado, fecha_firma FROM mae_ficha_firma_firmante WHERE id_ficha_firma IN (${ids}) ORDER BY id_firmante`)).recordset;
        return fichas.map((f) => ({ ...f, firmantes: firmantes.filter((x) => x.id_ficha_firma === f.id_ficha_firma) }));
    },

    /**
     * Seguimiento para Gestión de Calidad: todas las solicitudes de firma (de cualquiera que las haya enviado),
     * con el estado de cada firma. Solo lectura.
     */
    /** ¿Ve esta persona el seguimiento de firmas? (decide si Solicitudes muestra la carpeta). */
    async accesoSeguimiento(usuario) {
        const pool = await getConnection();
        return !!(await puedeSeguimiento(pool, usuario.id));
    },

    async seguimiento(usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        if (!(await puedeSeguimiento(pool, usuario.id))) throw error('No tiene el permiso de seguimiento de firmas (GC_SEGUIMIENTO_FIRMAS).', 403);
        const fichas = (await pool.request().query(`
            SELECT TOP 500 id_ficha_firma, tipo_ficha, codigo_equipo, nombre_equipo, estado, fecha_creacion, fecha_completa,
                   id_documento, motivo_cancelacion, nombre_crea
            FROM mae_ficha_firma ORDER BY fecha_creacion DESC`)).recordset;
        if (!fichas.length) return [];
        const ids = fichas.map((f) => Number(f.id_ficha_firma)).join(',');
        const firmantes = (await pool.request().query(`
            SELECT id_ficha_firma, rol, nombre, cargo, estado, fecha_firma FROM mae_ficha_firma_firmante WHERE id_ficha_firma IN (${ids}) ORDER BY id_firmante`)).recordset;
        return fichas.map((f) => ({ ...f, firmantes: firmantes.filter((x) => x.id_ficha_firma === f.id_ficha_firma) }));
    },

    /** Detalle para quien debe firmar, quien la envió o Gestión de Calidad (sin imágenes de firma). */
    async obtener(id, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const f = await cargarFicha(pool, id);
        if (!(await puedeVer(pool, f, usuario.id))) throw error('No tiene acceso a esta solicitud de firma.', 403);
        const mios = f.firmantes.filter((x) => Number(x.id_usuario) === Number(usuario.id) && x.estado === 'PENDIENTE');
        const mio = mios[0];
        return {
            id_ficha_firma: f.id_ficha_firma,
            tipo_ficha: f.tipo_ficha,
            estado: f.estado,
            codigo_equipo: f.codigo_equipo,
            nombre_equipo: f.nombre_equipo,
            nombre_crea: f.nombre_crea,
            fecha_creacion: f.fecha_creacion,
            fecha_completa: f.fecha_completa,
            id_documento: f.id_documento,
            motivo_cancelacion: f.motivo_cancelacion,
            es_creador: Number(f.id_usuario_crea) === Number(usuario.id),
            puede_firmar: f.estado === 'PENDIENTE' && !!mio,
            mi_rol: mio?.rol || null,
            mis_roles: mios.map((x) => x.rol),
            // Quien firma como responsable de entrega también pide la firma de quien recibe el equipo (con el celular).
            requiere_firma_equipo: f.estado === 'PENDIENTE' && mios.some((x) => x.rol === 'ENTREGA') && !f.datos.firma_equipo,
            responsable_equipo: f.datos.responsable_equipo || '',
            fecha_entrega: f.datos.fecha_entrega || '',
            observaciones: f.datos.observaciones || '',
            firmantes: f.firmantes.map((x) => ({ rol: x.rol, nombre: x.nombre, cargo: x.cargo, estado: x.estado, modo: x.modo, fecha_firma: x.fecha_firma })),
        };
    },

    /** PDF de la ficha como está (con las firmas hechas hasta ahora); completa, el archivado. Solo lectura. */
    async pdf(id, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const f = await cargarFicha(pool, id);
        if (!(await puedeVer(pool, f, usuario.id))) throw error('No tiene acceso a esta solicitud de firma.', 403);
        if (f.estado === 'COMPLETA' && f.id_documento) return gcDocumentosService.pdf(f.id_documento);
        const imagen = (rol) => f.firmantes.find((x) => x.rol === rol && x.estado === 'FIRMADA')?.imagen || '';
        return fichasEquipoService.entregaPdf({ ...f.datos, firma_entrega: imagen('ENTREGA'), firma_area: imagen('RESPONSABLE_AREA') }, null);
    },

    /**
     * Vista previa de la ficha con las firmas que esta persona está poniendo (aún sin guardar): la suya (dibujada,
     * registrada o del celular) y la de quien recibe el equipo. Sirve para ver la ficha como quedaría mientras se firma.
     */
    async pdfProvisional(id, usuario, { imagen, usarRegistrada = false, imagenEquipo } = {}) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const f = await cargarFicha(pool, id);
        if (!(await puedeVer(pool, f, usuario.id))) throw error('No tiene acceso a esta solicitud de firma.', 403);
        if (f.estado !== 'PENDIENTE') return this.pdf(id, usuario);
        const mios = f.firmantes.filter((x) => Number(x.id_usuario) === Number(usuario.id) && x.estado === 'PENDIENTE');
        let propia = '';
        if (usarRegistrada) propia = (await firmaDigitalService.vigente('USUARIO', usuario.id))?.imagen || '';
        else if (esImagen(imagen)) propia = imagen;
        const de = (rol) => {
            const fila = f.firmantes.find((x) => x.rol === rol);
            if (fila?.estado === 'FIRMADA') return fila.imagen || '';
            return propia && mios.some((m) => m.rol === rol) ? propia : '';
        };
        const equipo = f.datos.firma_equipo || (mios.some((m) => m.rol === 'ENTREGA') && esImagen(imagenEquipo) ? imagenEquipo : '');
        return fichasEquipoService.entregaPdf({ ...f.datos, firma_equipo: equipo, firma_entrega: de('ENTREGA'), firma_area: de('RESPONSABLE_AREA') }, null);
    },

    /** Firma la ficha quien la tiene pendiente: con su firma registrada o con la imagen que llega (dibujada o del celular). */
    async firmar(id, usuario, { imagen, usarRegistrada = false, imagenEquipo } = {}) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const f = await cargarFicha(pool, id);
        if (f.estado !== 'PENDIENTE') throw error(f.estado === 'COMPLETA' ? 'Esta ficha ya tiene todas sus firmas.' : 'Esta solicitud de firma fue cancelada.', 409);
        // Si es responsable de entrega y de área a la vez, su firma vale para los dos cargos.
        const mios = f.firmantes.filter((x) => Number(x.id_usuario) === Number(usuario.id) && x.estado === 'PENDIENTE');
        if (!mios.length) throw error('No tiene una firma pendiente en esta ficha.', 403);

        // El responsable de entrega entrega el equipo y le pide su firma a quien lo recibe: sin ella no se firma.
        const pideEquipo = mios.some((x) => x.rol === 'ENTREGA') && !f.datos.firma_equipo;
        if (pideEquipo && !esImagen(imagenEquipo)) throw error('Falta la firma del responsable del equipo (quien recibe). Pídasela con el celular o fírmela en pantalla.');

        let img = imagen;
        let modo = 'EN_EL_MOMENTO';
        let idFirma = null;
        if (usarRegistrada) {
            const g = await firmaDigitalService.vigente('USUARIO', usuario.id);
            if (!g?.imagen) throw error('No tiene una firma registrada. Registre su firma en su Perfil o firme en pantalla.');
            img = g.imagen; modo = 'GUARDADA'; idFirma = g.id_firma;
        }
        if (!esImagen(img)) throw error('La firma debe ser una imagen PNG o JPG de tamaño razonable.');

        // La firma de quien recibe queda en los datos de la ficha (va en el PDF final), y la fecha de recepción
        // se completa sola con la de su firma.
        if (pideEquipo) {
            const conRecepcion = { ...f.datos, firma_equipo: imagenEquipo, fecha_recepcion: f.datos.fecha_recepcion || hoyYmd() };
            await pool.request().input('id', sql.Int, Number(id)).input('datos', sql.NVarChar(sql.MAX), JSON.stringify(conRecepcion))
                .query('UPDATE mae_ficha_firma SET datos = @datos WHERE id_ficha_firma = @id');
            f.datos = conRecepcion;
        }
        for (const m of mios) {
            await pool.request()
                .input('id', sql.Int, m.id_firmante).input('img', sql.NVarChar(sql.MAX), img)
                .input('modo', sql.VarChar(15), modo).input('idFirma', sql.Int, idFirma)
                .query(`UPDATE mae_ficha_firma_firmante SET estado = 'FIRMADA', imagen = @img, modo = @modo, id_firma = @idFirma, fecha_firma = GETDATE()
                        WHERE id_firmante = @id AND estado = 'PENDIENTE'`);
        }

        const idsMios = new Set(mios.map((m) => m.id_firmante));
        const faltan = f.firmantes.filter((x) => x.estado === 'PENDIENTE' && !idsMios.has(x.id_firmante)).length;
        if (faltan > 0) return { completa: false, faltan };
        try {
            await this.completar(id);
            return { completa: true, faltan: 0 };
        } catch (e) {
            logger.error(`Firmas pendientes: la ficha ${id} tiene todas las firmas pero no se pudo guardar:`, e);
            return { completa: false, faltan: 0, error: 'Todas las firmas están hechas, pero no se pudo guardar la ficha. Avise a Gestión de Calidad.' };
        }
    },

    /** Con todas las firmas: genera la ficha final, la guarda en el archivo y avisa a quien la preparó. */
    async completar(id) {
        const pool = await getConnection();
        const f = await cargarFicha(pool, id);
        if (f.estado !== 'PENDIENTE') return;
        const de = (rol) => f.firmantes.find((x) => x.rol === rol);
        const creador = { id: Number(f.id_usuario_crea), name: f.nombre_crea };
        const body = { ...f.datos, firma_entrega: de('ENTREGA')?.imagen || '', firma_area: de('RESPONSABLE_AREA')?.imagen || '' };
        const pdf = await fichasEquipoService.entregaPdf(body, creador);
        const firmas = [];
        if (f.datos.firma_equipo) firmas.push({ rol: 'RECIBE', tipo_firmante: null, id_firmante: null, nombre_firmante: f.datos.responsable_equipo || null, cargo: null, modo: 'EN_EL_MOMENTO', id_firma: null });
        for (const x of f.firmantes) {
            firmas.push({ rol: x.rol, tipo_firmante: 'USUARIO', id_firmante: x.id_usuario, nombre_firmante: x.nombre, cargo: x.cargo, modo: x.modo || 'EN_EL_MOMENTO', id_firma: x.id_firma });
        }
        const guardada = await gcDocumentosService.guardarFichaEquipo({
            tipo: 'entrega',
            equipo: { id_equipo: f.id_equipo, codigo: f.codigo_equipo, nombre: f.nombre_equipo, sede: f.sede },
            ...pdf, datos: body, usuario: creador, firmas,
        });
        await pool.request().input('id', sql.Int, Number(id)).input('doc', sql.Int, guardada.id_ficha)
            .query("UPDATE mae_ficha_firma SET estado = 'COMPLETA', fecha_completa = GETDATE(), id_documento = @doc WHERE id_ficha_firma = @id");
        await notificar(creador.id, 'Ficha de entrega firmada',
            `Todos firmaron la ficha de entrega de ${f.codigo_equipo || f.nombre_equipo}. Quedó guardada en el archivo de fichas del equipo.`, Number(id));
        // Recepción en el historial y aviso de que corresponde la Puesta en Marcha por recepción (lleva directo a
        // registrarla, con el equipo ya elegido).
        if (await fichasEquipoService.registrarRecepcion(f.id_equipo, f.datos, creador)) {
            try {
                const { default: uns } = await import('./uns.service.js');
                await uns.sendWebNotification(creador.id, 'Puesta en marcha por recepción',
                    `${f.datos.responsable_equipo || 'El responsable'} recibió el equipo ${f.codigo_equipo || f.nombre_equipo}: corresponde registrar su Puesta en Marcha por recepción.`,
                    'INFO', Number(f.id_equipo), 'PuestaMarchaRecepcion');
            } catch (e) {
                logger.warn(`No se pudo avisar la puesta en marcha por recepción del equipo ${f.id_equipo}: ${e.message}`);
            }
        }
    },

    /** La anula quien la envió (mientras falten firmas). */
    async cancelar(id, usuario, motivo = '') {
        const pool = await getConnection();
        await exigirTablas(pool);
        const f = await cargarFicha(pool, id);
        if (Number(f.id_usuario_crea) !== Number(usuario.id)) throw error('Solo quien envió la ficha puede cancelarla.', 403);
        if (f.estado !== 'PENDIENTE') throw error('Solo se puede cancelar una ficha que aún tiene firmas pendientes.', 409);
        const m = String(motivo || '').trim();
        if (m.length < 3) throw error('Escriba el motivo de la cancelación.');
        await pool.request().input('id', sql.Int, Number(id)).input('m', sql.NVarChar(300), m.slice(0, 300))
            .query("UPDATE mae_ficha_firma SET estado = 'CANCELADA', motivo_cancelacion = @m, fecha_cancelacion = GETDATE() WHERE id_ficha_firma = @id");
        for (const x of f.firmantes.filter((p) => p.estado === 'PENDIENTE')) {
            await notificar(x.id_usuario, 'Firma cancelada', `Se canceló la solicitud de firma de la ficha de entrega de ${f.codigo_equipo || f.nombre_equipo}. Motivo: ${m}`, Number(id));
        }
    },

    /** ¿Esta persona tiene esta ficha pendiente de firma? (para generar su código QR) */
    async validarFirmante(id, usuario) {
        const pool = await getConnection();
        await exigirTablas(pool);
        const f = await cargarFicha(pool, id);
        const mios = f.firmantes.filter((x) => Number(x.id_usuario) === Number(usuario.id) && x.estado === 'PENDIENTE');
        if (f.estado !== 'PENDIENTE' || !mios.length) throw error('No tiene una firma pendiente en esta ficha.', 403);
        return {
            rol: mios[0].rol, roles: mios.map((x) => x.rol), nombre: mios[0].nombre, codigo_equipo: f.codigo_equipo,
            requiere_firma_equipo: mios.some((x) => x.rol === 'ENTREGA') && !f.datos.firma_equipo,
            responsable_equipo: f.datos.responsable_equipo || '',
        };
    },
};

export default fichaFirmaService;
