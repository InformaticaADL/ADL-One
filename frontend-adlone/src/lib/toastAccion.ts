import { toast } from 'sonner';

interface MensajesToast<T> {
    /** Texto mientras corre la acción (se muestra con la rueda girando). */
    cargando: string;
    /** Texto al terminar bien (se muestra con el check); recibe el resultado. */
    exito: string | ((resultado: T) => string);
    /** Texto si falla; por defecto el mensaje del error. */
    error?: string | ((error: unknown) => string);
}

const mensajeDeError = (e: unknown): string => {
    const r = e as { response?: { data?: { message?: string } }; message?: string };
    return r?.response?.data?.message || r?.message || 'No se pudo completar la acción';
};

/**
 * Aviso de una acción asíncrona: aparece «cargando» con la rueda girando y el mismo aviso
 * pasa al check de éxito (o al de error) al terminar. Es el patrón de las acciones masivas
 * de las tablas; úsalo en cualquier acción que tarde.
 */
export function toastAccion<T>(promesa: Promise<T>, mensajes: MensajesToast<T>): Promise<T> {
    toast.promise(promesa, {
        loading: mensajes.cargando,
        success: (r) => (typeof mensajes.exito === 'function' ? mensajes.exito(r as T) : mensajes.exito),
        error: (e) => (typeof mensajes.error === 'function' ? mensajes.error(e) : mensajes.error ?? mensajeDeError(e)),
    });
    return promesa;
}
