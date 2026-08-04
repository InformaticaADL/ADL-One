import type { JornadaHoy } from '../services/tracking.service';

// Una ficha Compuesta aparece en el itinerario dos días distintos (instalación
// y retiro, con fecha_muestreo/fecha_retiro distintas) — usando la MISMA fila
// de App_Ma_Agenda_MUESTREOS ambas veces. Si solo mirásemos "cualquiera de los
// dos flags en 'S'", una ficha de retiro se vería "Completada" apenas se abre
// el drawer el día del retiro, porque instalacion_completado ya quedó en 'S'
// desde la visita anterior — antes de que el retiro realmente ocurra. Hay que
// mirar el flag que corresponde a la visita de HOY, no cualquiera de los dos.
export function fichaCompletada(ficha: JornadaHoy['fichas_hoy'][number]): boolean {
    const hoy = new Date().toISOString().slice(0, 10);
    const esRetiroHoy = ficha.fecha_retiro?.slice(0, 10) === hoy;
    return esRetiroHoy ? ficha.retiro_completado === 'S' : ficha.instalacion_completado === 'S';
}

// Una ficha Puntual de proceso único tiene fecha_muestreo === fecha_retiro
// (instalación y retiro el mismo día, mismo muestreador): sin esta
// distinción, el itinerario mostraría "Instalación" o "Retiro" de forma
// arbitraria para una visita que en realidad es una sola.
export function tipoVisitaHoy(ficha: JornadaHoy['fichas_hoy'][number]): string {
    const hoy = new Date().toISOString().slice(0, 10);
    const esInstalacionHoy = ficha.fecha_muestreo?.slice(0, 10) === hoy;
    const esRetiroHoy = ficha.fecha_retiro?.slice(0, 10) === hoy;
    if (esInstalacionHoy && esRetiroHoy) return 'Instalación y Retiro';
    return esRetiroHoy ? 'Retiro' : 'Instalación';
}

export function contarFichasCompletadas(fichas: JornadaHoy['fichas_hoy']): { completadas: number; total: number } {
    return { completadas: fichas.filter(fichaCompletada).length, total: fichas.length };
}
