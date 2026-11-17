import React from 'react';

import { useTemaNeutro } from '../../../hooks/useTemaNeutro';
import logoAdl from '../../../assets/images/logo-adlone.png';
import fondoLogin from '../../../assets/images/fondo-login.png';

/**
 * Medidas de shadcn-admin para las pantallas de acceso. Los componentes compartidos de la app (Card, Input) son un poco más
 * chicos o más planos, así que acá se les fija el tamaño del login de referencia sin tocar el resto de las pantallas:
 *  - tarjeta: py-6, gap-4, sombra suave; encabezado y contenido con px-6;
 *  - campos: 16 px en pantalla chica y 14 px desde md (evita el zoom en el celular), borde y aro de foco de 3 px.
 * La paleta y la escala tipográfica (text-sm 14 px, text-lg 18 px) son las de shadcn-admin: se piden con useTemaNeutro, igual que el resto de las páginas migradas.
 */
export const claseTarjetaAcceso = 'flex w-full flex-col gap-4 py-6 shadow-sm';
export const claseEncabezadoAcceso = 'gap-1.5 p-0 px-6';
export const claseContenidoAcceso = 'p-0 px-6';
export const claseCampoAcceso = 'text-base shadow-xs md:text-sm focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';
export const claseTituloAcceso = 'text-lg tracking-tight';

/** Logo de ADL ONE para la parte de arriba de la tarjeta de acceso. */
export const LogoAcceso: React.FC = () => (
    <div className="mb-3 flex items-center justify-center">
        <img src={logoAdl} className="w-[190px]" alt="ADL ONE" />
    </div>
);

/**
 * Disposición de las pantallas de acceso (login, restablecer contraseña, error): la imagen de fondo de siempre y una tarjeta de
 * 24 rem al centro; el logo va dentro de la tarjeta (LogoAcceso). Es la misma estructura de shadcn-admin (auth-layout.tsx), con el logo de ADL ONE en lugar del nombre.
 */
export const AuthLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    useTemaNeutro({ escala: true });
    return (
    <div
        className="shadcn-scope relative grid min-h-svh items-center justify-center overflow-hidden bg-background bg-cover bg-center bg-no-repeat px-4"
        style={{ backgroundImage: `url(${fondoLogin})` }}
    >
        {/* Los dos círculos suaves del fondo original. */}
        <div aria-hidden="true" className="pointer-events-none absolute -right-[300px] -top-[300px] h-[600px] w-[600px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--sc-primary) 10%, transparent) 0%, transparent 70%)' }} />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-[300px] -left-[300px] h-[600px] w-[600px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--sc-success) 5%, transparent) 0%, transparent 70%)' }} />

        <div className="relative z-10 mx-auto flex w-[24rem] max-w-full flex-col justify-center gap-2 py-8">
            {children}
        </div>
    </div>
    );
};
