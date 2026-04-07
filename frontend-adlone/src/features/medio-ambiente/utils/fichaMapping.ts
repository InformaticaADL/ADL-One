/**
 * Shared utility for mapping raw Ficha data to the format expected by AntecedentesForm.
 */

export const mapToAntecedentes = (enc: any, agenda: any) => {
    if (!enc) return {};
    agenda = agenda || {};

    let zona = '', utmNorte = '', utmEste = '';
    const coordStr = enc.ma_coordenadas || '';
    const coordMatch = coordStr.match(/^(.*?) UTM (\d+)E (\d+)S/);
    if (coordMatch) {
        zona = coordMatch[1];
        utmNorte = coordMatch[2];
        utmEste = coordMatch[3];
    } else {
        const parts = coordStr.split(' ');
        zona = parts[0] || '';
    }

    let selInst = '';
    let nroInst = '';
    let anioInst = '';
    const rawInst = (enc.instrumento_ambiental || enc.ma_instrumento_ambiental || '').trim();

    if (rawInst && rawInst !== 'No aplica') {
        const upper = rawInst.toUpperCase();
        if (upper.startsWith('RCA')) selInst = 'RCA';
        else if (upper.startsWith('RES. EX') || upper.startsWith('RES EX') || upper.startsWith('RESOLUCION EX')) selInst = 'Res. Ex.';
        else if (upper.startsWith('DECRETO')) selInst = 'Decreto';
        else if (upper.startsWith('CARTA')) selInst = 'Carta';
        else if (upper.startsWith('RES SIS') || upper.startsWith('RESOLUCION SIS')) selInst = 'Res Sis';
        else if (upper.startsWith('DGTM')) selInst = 'DGTM';
        else selInst = 'Otro';

        let rest = rawInst;
        if (selInst !== 'Otro') {
            if (selInst === 'Res. Ex.') rest = rawInst.replace(/^Res\.?\s*Ex(enta)?\.?\s*(N°)?/i, '').trim();
            else if (selInst === 'RCA') rest = rawInst.replace(/^RCA\s*(N°)?/i, '').trim();
            else if (selInst === 'Decreto') rest = rawInst.replace(/^Decreto\s*(N°)?/i, '').trim();
            else if (selInst === 'Carta') rest = rawInst.replace(/^Carta\s*(N°)?/i, '').trim();
            else if (selInst === 'Res Sis') rest = rawInst.replace(/^Res\.?\s*Sis\.?\s*(N°)?/i, '').trim();
            else if (selInst === 'DGTM') rest = rawInst.replace(/^DGTM\s*(N°)?/i, '').trim();
        }

        const splitSlash = rest.split('/');
        if (splitSlash.length === 2) {
            nroInst = splitSlash[0].trim();
            anioInst = splitSlash[1].trim();
        } else {
            nroInst = rest;
        }
    } else if (rawInst === 'No aplica') {
        selInst = 'No aplica';
    }

    return {
        selectedEmpresa: enc.id_empresaservicios,
        selectedCliente: enc.id_empresa,
        selectedFuente: enc.id_centro,
        selectedContacto: (enc.id_contacto === 0 || !enc.id_contacto)
            ? (enc.nombre_contacto === 'No Aplica' ? 'No Aplica' : 'primary')
            : String(enc.id_contacto),
        selectedObjetivo: enc.id_objetivomuestreo_ma,
        selectedComponente: enc.id_tipomuestra,
        selectedSubArea: enc.id_subarea,
        selectedInstrumento: selInst || enc.ma_instrumento_ambiental || '',
        nroInstrumento: nroInst || enc.ma_nro_instrumento || '',
        anioInstrumento: anioInst || enc.ma_anio_instrumento || '',
        selectedInspector: agenda.id_inspectorambiental || enc.id_inspectorambiental || '',
        responsableMuestreo: enc.responsablemuestreo,
        cargoResponsable: enc.id_cargo,
        selectedTipoMuestreo: enc.id_tipomuestreo,
        selectedTipoMuestra: enc.id_tipomuestra_ma,
        selectedActividad: enc.id_actividadmuestreo,
        duracion: enc.ma_duracion_muestreo,
        selectedTipoDescarga: enc.id_tipodescarga,
        refGoogle: enc.referencia_googlemaps,
        medicionCaudal: enc.medicion_caudal,
        selectedModalidad: enc.id_modalidad,
        formaCanal: enc.id_formacanal,
        tipoMedidaCanal: enc.id_um_formacanal,
        detalleCanal: enc.formacanal_medida,
        dispositivo: enc.id_dispositivohidraulico,
        tipoMedidaDispositivo: enc.id_um_dispositivohidraulico,
        detalleDispositivo: enc.dispositivohidraulico_medida,
        frecuencia: agenda.frecuencia || enc.frecuencia || enc.ma_frecuencia,
        totalServicios: agenda.total_servicios || enc.total_servicios || enc.total_servicios_ma,
        factor: agenda.frecuencia_factor || enc.frecuencia_factor || 1,
        periodo: agenda.periodo || enc.periodo || agenda.id_frecuencia || enc.id_frecuencia || '',
        tipoMonitoreo: enc.tipo_fichaingresoservicio || '',
        selectedLugar: enc.id_lugaranalisis || '',
        puntoMuestreo: enc.ma_punto_muestreo || '',
        zona: zona || '',
        utmNorte: utmNorte || '',
        utmEste: utmEste || '',
        glosa: enc.nombre_tabla || enc.nombre_tabla_largo || enc.glosa || enc.ma_nombre_tabla || ''
    };
};
