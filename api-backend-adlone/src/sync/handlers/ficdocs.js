// Documentos enviados de una visita (App_Ma_Documentos_Enviados → fic_visita_documento): registro de cada FoMa / cadena de custodia que
// APP MAM manda por correo. La visita se resuelve por fic_visita.id_agendamam_legacy (igual que rut.js); id_envio se conserva por mig_id_map.
// Las filas cuya agenda ya no existe en el legado (datos de pruebas anteriores) no se pueden enlazar a ninguna visita: quedan como aviso.
import sql from 'mssql';
import { t, dt, upsertMapeado, borrarMapeado } from '../comun.js';
import { mapa } from './contexto.js';

const TIPO = { FOMA: 'FOMA', CADENA: 'CADENA_CUSTODIA', CADENA_CUSTODIA: 'CADENA_CUSTODIA' };

const documento = {
  async upsert({ ctx, run, leg, clave }) {
    const x = (await leg.request().input('v', sql.Int, Number(clave)).query(`SELECT * FROM App_Ma_Documentos_Enviados WHERE id_envio=@v`)).recordset[0]; if (!x) return 'SIN_FILA';
    const visita = (await run(`SELECT id FROM fic_visita WHERE id_agendamam_legacy=@a`, { a: Number(x.id_agendamam) }))[0]?.id;
    if (!visita) return `AVISO: el envío ${x.id_envio} (${t(x.tipo_documento)}) cita la agenda ${x.id_agendamam}, que no existe en el legado ni en fic_visita`;
    const tipo = TIPO[String(t(x.tipo_documento) ?? '').toUpperCase()]; if (!tipo) throw new Error(`tipo de documento "${x.tipo_documento}" desconocido`);
    let lab = null; if (Number(x.id_laboratorio) > 0) { lab = (await mapa(ctx, run, 'mae_laboratorioensayo')).get(Number(x.id_laboratorio)) ?? null; if (!lab) throw new Error(`laboratorio ${x.id_laboratorio} sin equivalente en fic_laboratorio_ensayo`); }
    let persona = null; if (Number(x.usuario_envio) > 0) { persona = (await mapa(ctx, run, 'mae_muestreador')).get(Number(x.usuario_envio)) ?? null; if (!persona) throw new Error(`muestreador ${x.usuario_envio} sin equivalente en per_persona`); }
    await upsertMapeado(run, { tablaLegado: 'App_Ma_Documentos_Enviados', idLegado: Number(x.id_envio), tabla: 'fic_visita_documento',
      obj: { id_visita: visita, tipo, id_laboratorio_ensayo: lab, destinatario: t(x.destinatario)?.slice(0, 200) ?? null, enviado_en: dt(x.fecha_envio) ?? new Date('1900-01-01T00:00:00Z'), id_persona_envio: persona } });
  },
  borrar: ({ run, clave }) => borrarMapeado(run, { tablaLegado: 'App_Ma_Documentos_Enviados', idLegado: Number(clave), tabla: 'fic_visita_documento' }),
};

export const manejadores = { App_Ma_Documentos_Enviados: documento };
