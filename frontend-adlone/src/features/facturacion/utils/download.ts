/** Descarga un archivo forzando el diálogo de guardado (no lo abre en pestaña nueva). */
export async function descargarArchivo(url: string, nombreArchivo: string): Promise<void> {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error(`No se pudo descargar el archivo (${response.status})`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
}
