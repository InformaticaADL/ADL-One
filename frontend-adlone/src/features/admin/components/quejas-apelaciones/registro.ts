import type { Caso } from '../../services/quejasApelaciones.service';
import { today, nowTime, noFuture, companyError, nameError, emailError, phoneError, finalizePhone } from './reglas';

// Datos de la etapa 1 (Registro): formulario, valores iniciales y validación (mismas reglas que el servidor).

export interface RegForm {
    tipo: string; origen: string; empresa: string; nombre: string; correo: string; telefono: string;
    fechaRecepcion: string; horaRecepcion: string; fechaTratamiento: string; numeroInforme: string; motivo: string;
    emisor: string; viaIngreso: string;
}
export const emptyReg = (tipo = 'queja'): RegForm => ({
    tipo, origen: 'externo', empresa: '', nombre: '', correo: '', telefono: '',
    fechaRecepcion: today(), horaRecepcion: nowTime(), fechaTratamiento: '', numeroInforme: '', motivo: '',
    emisor: 'cliente', viaIngreso: '',
});
export const regFrom = (c: Caso): RegForm => ({
    tipo: c.tipo, origen: c.origen, empresa: c.empresa || '', nombre: c.nombre || '', correo: c.correo || '', telefono: c.telefono || '',
    fechaRecepcion: c.fecha_recepcion || '', horaRecepcion: c.hora_recepcion || '', fechaTratamiento: c.fecha_tratamiento || '',
    numeroInforme: c.numero_informe || '', motivo: c.motivo || '', emisor: c.emisor || 'cliente', viaIngreso: c.via_ingreso || '',
});
export const regPayload = (f: RegForm) => ({
    ...f, empresa: f.empresa.trim(), nombre: f.nombre.trim(), correo: f.correo.trim(), telefono: finalizePhone(f.telefono),
    motivo: f.motivo.trim(), numeroInforme: f.numeroInforme.trim(), viaIngreso: f.viaIngreso.trim(),
});
export type Errores = Partial<Record<keyof RegForm, string>>;
export function regErrors(f: RegForm, web = false): Errores {
    const e: Errores = {
        empresa: companyError(f.empresa),
        nombre: nameError(f.nombre),
        correo: web ? '' : emailError(f.correo),
        telefono: phoneError(f.telefono),
        fechaRecepcion: f.fechaRecepcion ? noFuture(f.fechaRecepcion).error || '' : 'Indica la fecha de recepción.',
        horaRecepcion: /^([01]\d|2[0-3]):[0-5]\d$/.test(f.horaRecepcion) ? '' : 'Indica la hora de recepción.',
        motivo: web || f.motivo.trim().length >= 10 ? '' : 'Describe el motivo (al menos 10 caracteres).',
    };
    return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as Errores;
}

/** Casilla del OI-FoGe-05 que corresponde a cada campo del registro (para resaltarla en la vista previa). */
export const CASILLA_DE_CAMPO: Record<keyof RegForm, 'tipo' | 'origen' | 'empresa' | 'nombre' | 'mail' | 'fono' | 'fechaRecepcion' | 'horaRecepcion' | 'fechaTratamiento' | 'motivo' | 'tratamiento' | null> = {
    tipo: 'tipo', origen: 'origen', empresa: 'empresa', nombre: 'nombre', correo: 'mail', telefono: 'fono',
    fechaRecepcion: 'fechaRecepcion', horaRecepcion: 'horaRecepcion', fechaTratamiento: 'fechaTratamiento',
    numeroInforme: null, motivo: 'motivo', emisor: 'tratamiento', viaIngreso: 'tratamiento',
};
