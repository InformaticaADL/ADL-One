import React, { useRef, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { SignaturePad, type SignaturePadHandle } from './verificacion-temperatura/SignaturePad';

interface Props {
    titulo: string;
    /** Nombre de quien firma (se muestra bajo el título). */
    nombre?: string;
    /** Firma guardada en el perfil del usuario conectado: se ofrece usarla. */
    guardada?: string | null;
    /** Si la firma guardada viene marcada para usarse (por defecto sí). */
    usarGuardadaInicial?: boolean;
    /**
     * Cada vez que cambia la firma: la imagen dibujada (o null si está en
     * blanco) y si se usa la guardada.
     */
    onChange: (firma: string | null, usarGuardada: boolean) => void;
}

/**
 * Una firma de un formulario: se dibuja en pantalla (en el momento) o, si quien
 * llena tiene una guardada en su perfil, se usa esa.
 */
export const CampoFirma: React.FC<Props> = ({ titulo, nombre, guardada, usarGuardadaInicial = true, onChange }) => {
    const pad = useRef<SignaturePadHandle>(null);
    const [usarGuardada, setUsarGuardada] = useState(!!guardada && usarGuardadaInicial);

    const avisar = (usar: boolean) => onChange(usar ? null : pad.current?.toDataURL() || null, usar);

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{titulo}{nombre ? ` · ${nombre}` : ''}</span>
            {guardada && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={usarGuardada} onCheckedChange={(v) => { const u = v === true; setUsarGuardada(u); avisar(u); }} />
                    Usar mi firma guardada
                </label>
            )}
            {guardada && usarGuardada ? (
                <div className="flex h-24 items-center justify-center rounded-lg border border-border bg-white">
                    <img src={guardada} alt="Firma guardada" className="max-h-20 max-w-full object-contain" />
                </div>
            ) : (
                <div onPointerUp={() => avisar(false)}>
                    <SignaturePad ref={pad} onChange={(vacio) => { if (vacio) onChange(null, false); }} />
                </div>
            )}
        </div>
    );
};

export default CampoFirma;
