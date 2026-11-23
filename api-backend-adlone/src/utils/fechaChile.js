// Fecha de hoy en Chile (aaaa-mm-dd), sin depender de la zona horaria del servidor ni de UTC.
// Con UTC, desde las 20:00–21:00 de Chile ya "es mañana", y eso descuadra las validaciones de fecha.
const ZONA = 'America/Santiago';

export const hoyChile = (d = new Date()) => {
    const p = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' })
            .formatToParts(d).map((x) => [x.type, x.value]),
    );
    return `${p.year}-${p.month}-${p.day}`;
};
