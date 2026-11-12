import apiClient from '../config/axios.config';

// Firma digital del usuario conectado (tabla mae_firma_digital): se registra en
// su perfil y se usa para firmar formularios sin dibujarla cada vez, ej. la
// Ficha Técnica o la Ficha de Entrega de Equipos.

export interface FirmaUsuario {
    /** Imagen en data URL, o null si no tiene. */
    firma: string | null;
    /** false: falta ejecutar la migración add_firma_digital.sql. */
    disponible: boolean;
}

export const firmaUsuarioService = {
    obtener: async () => (await apiClient.get('/api/users/firma')).data.data as FirmaUsuario,
    /** `origen`: si se dibujó en pantalla o se importó una imagen. */
    guardar: async (firma: string, origen: 'DIBUJADA' | 'IMPORTADA') => { await apiClient.put('/api/users/firma', { firma, origen }); },
    quitar: async () => { await apiClient.delete('/api/users/firma'); },
};

// Azul tinta de las firmas (#1a3a9c), igual que el panel para firmar.
const TINTA_FIRMA = [0x1a, 0x3a, 0x9c];

/**
 * Imagen importada → PNG en data URL con fondo blanco, trazo en azul tinta y
 * ancho máximo, para que la firma viaje liviana y se vea igual en el PDF.
 */
export const imagenAFirma = (archivo: File, anchoMax = 1200): Promise<string> => new Promise((resolve, reject) => {
    if (!/^image\/(png|jpe?g|webp)$/.test(archivo.type)) {
        reject(new Error('La firma debe ser una imagen PNG, JPG o WEBP'));
        return;
    }
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
    lector.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('No se pudo leer la imagen'));
        img.onload = () => {
            const escala = Math.min(1, anchoMax / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * escala));
            canvas.height = Math.max(1, Math.round(img.height * escala));
            const ctx = canvas.getContext('2d')!;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // El trazo pasa a azul tinta (como lápiz pasta), con la misma
            // intensidad que tenía; el fondo queda blanco.
            const datos = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const p = datos.data;
            for (let i = 0; i < p.length; i += 4) {
                const luz = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
                const tinta = Math.max(0, Math.min(1, (235 - luz) / 175));
                p[i] = Math.round(255 + (TINTA_FIRMA[0] - 255) * tinta);
                p[i + 1] = Math.round(255 + (TINTA_FIRMA[1] - 255) * tinta);
                p[i + 2] = Math.round(255 + (TINTA_FIRMA[2] - 255) * tinta);
            }
            ctx.putImageData(datos, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.src = String(lector.result);
    };
    lector.readAsDataURL(archivo);
});
