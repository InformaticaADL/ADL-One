/**
 * Cuando se publica una versión nueva, los archivos de la anterior dejan de existir en el servidor. Quien tenía la web abierta (o guardada en
 * el navegador) pide un archivo que ya no está y ve «Failed to fetch dynamically imported module». La solución es cargar la página de nuevo:
 * así baja la versión nueva sola, sin que el usuario haga nada. Se limita a un intento cada 30 s para no entrar en un ciclo si el servidor
 * realmente está caído.
 */
const CLAVE = 'adl-recarga-por-version';
const ESPERA_MS = 30_000;

export const esErrorDeVersionVieja = (mensaje?: string | null): boolean =>
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(mensaje || '');

/** Recarga la página una vez. Devuelve true si la recarga se pidió (false si ya se intentó hace poco). */
export function recargarPorVersionNueva(): boolean {
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE) || 0);
    if (Date.now() - ultima < ESPERA_MS) return false;
    sessionStorage.setItem(CLAVE, String(Date.now()));
  } catch { /* sin sessionStorage: se recarga igual */ }
  window.location.reload();
  return true;
}
