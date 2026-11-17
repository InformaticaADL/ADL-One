// Por qué un equipo que el Excel trae "Activo" no quedaría activo en el sistema.
//
// La revisión diaria (inactivateExpiredEquipos) inactiva todo equipo activo cuya
// Siguiente_verificacion ya pasó, y solo lo reactiva (reactivarEquiposRenovados) cuando
// tiene una siguiente fecha vigente. Entonces, si el Excel dice Activo pero el sistema lo
// tiene Inactivo y las fechas que quedarían guardadas siguen vencidas (o no existen),
// actualizar el estado no sirve: volvería a quedar inactivo. Hay que decirlo antes.

import { resolverModalidad } from './reglasControlEquipo.js';

const aDMY = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
    return m ? `${m[3]}-${m[2]}-${m[1]}` : String(iso ?? '');
};

const aISO = (v) => {
    if (!v) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/**
 * @param excel  datos del Excel: { nombre, estado, estado_equipo, ultima_verificacion, siguiente_verificacion }
 * @param db     equipo en el sistema: { nombre, estado, estado_equipo, ultima_verificacion, siguiente_verificacion, modalidad_control }
 * @param hoyISO fecha de hoy 'YYYY-MM-DD'
 * @returns texto de la alerta, o null si no hay nada que advertir.
 */
export const advertenciaActivacion = (excel, db, hoyISO) => {
    if (!excel || !db) return null;
    if (excel.estado !== 'Activo' || db.estado !== 'Inactivo') return null;
    // Baja y fuera de servicio se retiraron a propósito: el estado del Excel manda y no hay fecha que exigir.
    const estadoDB = String(db.estado_equipo ?? '').toLowerCase();
    if (estadoDB.includes('baja') || estadoDB.includes('fuera de servicio')) return null;
    // Los complementos (baterías, botellas…) no vencen: no necesitan fecha para estar activos.
    const modalidad = resolverModalidad(excel.nombre ?? db.nombre, db.modalidad_control);
    if (modalidad === 'SIN_VENCIMIENTO') return null;

    const sigExcel = aISO(excel.siguiente_verificacion);
    const sigDB = aISO(db.siguiente_verificacion);
    const ultExcel = aISO(excel.ultima_verificacion);
    const ultDB = aISO(db.ultima_verificacion);
    // Lo que quedaría guardado: el Excel manda si trae fecha, si no se conserva la del sistema.
    const sigFinal = sigExcel ?? sigDB;

    if (sigFinal && sigFinal >= hoyISO) return null; // con fecha vigente se reactiva sin problema

    const trajoFechasNuevas = (sigExcel && sigExcel !== sigDB) || (ultExcel && ultExcel !== ultDB);
    if (!sigFinal) {
        return 'No se podrá activar: el equipo no tiene fecha de Siguiente revisión (ni en el Excel ni en el sistema). Registre una revisión con fecha vigente para activarlo.';
    }
    return trajoFechasNuevas
        ? `No se mantendría activo: la Siguiente revisión que quedaría (${aDMY(sigFinal)}) ya venció. Corrija la fecha en el Excel o en la ficha para activarlo.`
        : `No se mantendría activo: el sistema lo tiene Inactivo porque su vigencia venció el ${aDMY(sigFinal)} y el Excel no trae una nueva Última ni Siguiente revisión. Al actualizar solo el estado volvería a inactivarse: registre una revisión con fecha vigente.`;
};
