// Formatos de fecha y hora para mostrar al usuario (dd-mm-yyyy). Los valores que no tienen la forma
// esperada se devuelven tal cual, para no esconder un dato raro detrás de un formato equivocado.

const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/** "2026-11-12" o "2026-11-12T00:00:00.000Z" → "12-11-2026". Una fecha (sin hora) se toma del texto, sin pasar por zona horaria. */
export const formatearFecha = (valor?: string | null): string => {
  if (!valor) return '';
  const m = ISO.exec(String(valor));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : String(valor);
};

/** "2026-11-12 09:04:02" → "12-11-2026 a las 09:04". Sin hora en el valor, devuelve solo la fecha. */
export const formatearFechaHora = (valor?: string | null): string => {
  if (!valor) return '';
  const m = ISO.exec(String(valor));
  if (!m) return String(valor);
  return m[4] ? `${m[3]}-${m[2]}-${m[1]} a las ${m[4]}:${m[5]}` : `${m[3]}-${m[2]}-${m[1]}`;
};

/**
 * "2026-11-19T10:26:27.133Z" → "19/11/2026 10:26" (o "10:26:27" con segundos). La base guarda la hora local de Chile
 * (GETDATE) y el driver la entrega con «Z» como si fuera UTC: se toma del texto, sin convertir de zona, para no restarle
 * 3 horas al mostrarla.
 */
export const formatearFechaHoraCorta = (valor?: string | null, conSegundos = false): string => {
  if (!valor) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(valor));
  if (!m) return String(valor);
  const fecha = `${m[3]}/${m[2]}/${m[1]}`;
  if (!m[4]) return fecha;
  return `${fecha} ${m[4]}:${m[5]}${conSegundos && m[6] ? `:${m[6]}` : ''}`;
};
