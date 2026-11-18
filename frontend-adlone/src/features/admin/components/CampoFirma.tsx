import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { IconCircleCheck, IconFileImport, IconX } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { cn } from '@/lib/utils';
import { SignaturePad, type SignaturePadHandle } from './verificacion-temperatura/SignaturePad';
import { fichasEquipoService, type FirmaRegistrada } from '../services/fichasEquipo.service';

export interface CampoFirmaHandle {
    /** Deja la firma ya hecha (la de un celular o una registrada): el campo queda firmado y avisa con onChange. */
    fijar: (imagen: string, etiqueta?: string) => void;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Personas con firma registrada que corresponden al nombre de quien firma este campo. Mismo
 * nombre, o uno con todas las palabras del otro ("Nicolas Mera" y "Nicolás Mera Pérez"). Un
 * nombre de una sola palabra solo coincide si es idéntico.
 */
const coincidenciasDeNombre = (nombre: string | undefined, registradas: FirmaRegistrada[]) => {
    const n = normalizar(nombre || '');
    if (!n) return [];
    const palabras = n.split(' ');
    return registradas.filter((r) => {
        const rn = normalizar(r.nombre);
        if (rn === n) return true;
        const rp = rn.split(' ');
        const [corto, largo] = palabras.length <= rp.length ? [palabras, rp] : [rp, palabras];
        return corto.length >= 2 && corto.every((w) => largo.includes(w));
    });
};

interface Props {
    titulo: string;
    /** Nombre de quien firma (se muestra bajo el título). */
    nombre?: string;
    /** Firma guardada en el perfil del usuario conectado: se ofrece usarla. */
    guardada?: string | null;
    /** Si la firma guardada viene marcada para usarse (por defecto sí). */
    usarGuardadaInicial?: boolean;
    /**
     * Ofrece importar la firma registrada de quien firma este campo, solo si el nombre (`nombre`)
     * corresponde a una persona que ya la tiene registrada; si no, no aparece nada (por defecto sí).
     */
    importable?: boolean;
    /** Sin marco propio, para usarlo dentro de otra tarjeta. */
    plano?: boolean;
    /**
     * Cada vez que cambia la firma: la imagen dibujada, importada o recibida del celular
     * (o null si está en blanco) y si se usa la guardada.
     */
    onChange: (firma: string | null, usarGuardada: boolean) => void;
}

// Alto fijo del área de firma: así todas las firmas de una ficha quedan alineadas.
const ALTO_AREA = 'h-32';

/**
 * Una firma de un formulario, como tarjeta: título y nombre arriba con su estado (Firmada /
 * Pendiente), el área de firma de alto fijo, y debajo las opciones. Se puede dibujar en pantalla,
 * usar la guardada en el perfil de quien llena, importar la firma registrada de la persona (solo
 * si la tiene) o recibirla del celular (código QR, ver FirmaCelularDialog).
 */
export const CampoFirma = forwardRef<CampoFirmaHandle, Props>(({ titulo, nombre, guardada, usarGuardadaInicial = true, importable = true, plano = false, onChange }, ref) => {
    const pad = useRef<SignaturePadHandle>(null);
    const [usarGuardada, setUsarGuardada] = useState(!!guardada && usarGuardadaInicial);
    const [fija, setFija] = useState<{ imagen: string; etiqueta: string } | null>(null);
    const [dibujada, setDibujada] = useState(false);
    const [registradas, setRegistradas] = useState<FirmaRegistrada[]>([]);
    const [importando, setImportando] = useState(false);
    const [errorImportar, setErrorImportar] = useState<string | null>(null);

    const fijar = (imagen: string, etiqueta = 'Firmada desde el celular') => {
        setFija({ imagen, etiqueta });
        setUsarGuardada(false);
        setErrorImportar(null);
        onChange(imagen, false);
    };
    useImperativeHandle(ref, () => ({ fijar }));

    useEffect(() => {
        if (!importable) return;
        let vigente = true;
        fichasEquipoService.firmasRegistradas().then((l) => { if (vigente) setRegistradas(l); }).catch(() => { /* sin lista: solo queda dibujar */ });
        return () => { vigente = false; };
    }, [importable]);

    // Solo la(s) persona(s) que corresponden al nombre de este campo y que tienen firma registrada.
    // Quien ya tiene su firma guardada en el perfil la usa con el cuadro de abajo.
    const coincidencias = useMemo(
        () => (importable && !guardada ? coincidenciasDeNombre(nombre, registradas) : []),
        [importable, guardada, nombre, registradas],
    );

    const avisar = (usar: boolean) => onChange(usar ? null : pad.current?.toDataURL() || null, usar);

    const importar = async (persona: FirmaRegistrada) => {
        setImportando(true);
        setErrorImportar(null);
        try {
            const imagen = await fichasEquipoService.imagenFirmaRegistrada(persona.tipo, persona.id);
            fijar(imagen, `Firma registrada de ${persona.nombre}`);
        } catch {
            setErrorImportar(`No se pudo traer la firma de ${persona.nombre}.`);
        } finally {
            setImportando(false);
        }
    };

    const quitar = () => { setFija(null); setDibujada(false); onChange(null, false); };

    const usandoGuardada = !!guardada && usarGuardada && !fija;
    const firmada = !!fija || usandoGuardada || dibujada;
    const origen = fija ? fija.etiqueta : usandoGuardada ? 'Con tu firma guardada' : dibujada ? 'Firmada en pantalla' : null;

    return (
        <div className={cn('flex min-w-0 flex-col gap-2', !plano && 'rounded-lg border border-border bg-card p-3')}>
            {/* Quién firma y en qué estado está */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <p className="text-sm font-medium leading-tight">{titulo}</p>
                    {nombre && <p className="mt-0.5 truncate text-xs text-muted-foreground" title={nombre}>{nombre}</p>}
                </div>
                {firmada
                    ? <Badge variant="success" className="shrink-0 gap-1"><IconCircleCheck size={12} /> Firmada</Badge>
                    : <Badge variant="outline" className="shrink-0 text-muted-foreground">Pendiente</Badge>}
            </div>

            {/* Área de firma (alto fijo) */}
            {fija || usandoGuardada ? (
                <div className={cn('flex items-center justify-center rounded-lg border border-border bg-white', ALTO_AREA)}>
                    <img src={fija ? fija.imagen : (guardada as string)} alt={origen ?? 'Firma'} className="max-h-[6.5rem] max-w-full object-contain" />
                </div>
            ) : (
                <div onPointerUp={() => avisar(false)}>
                    <SignaturePad
                        ref={pad}
                        alto={ALTO_AREA}
                        ayuda="Firme aquí"
                        onChange={(vacio) => { setDibujada(!vacio); if (vacio) onChange(null, false); }}
                    />
                </div>
            )}

            {/* Opciones */}
            {(origen || guardada || coincidencias.length > 0) && (
                <div className="flex flex-col gap-1.5">
                    {origen && (
                        <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate text-xs text-muted-foreground" title={origen}>{origen}</span>
                            {fija && <Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={quitar}><IconX size={13} /> Quitar</Button>}
                        </div>
                    )}
                    {guardada && !fija && (
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox checked={usarGuardada} onCheckedChange={(v) => { const u = v === true; setUsarGuardada(u); avisar(u); }} />
                            Usar mi firma guardada
                        </label>
                    )}
                    {!fija && coincidencias.length > 0 && (
                        coincidencias.length === 1 ? (
                            <Button type="button" variant="outline" size="sm" className="w-full justify-start" disabled={importando} onClick={() => importar(coincidencias[0])}>
                                <IconFileImport size={14} /> <span className="truncate">{importando ? 'Trayendo la firma…' : `Importar firma de ${coincidencias[0].nombre}`}</span>
                            </Button>
                        ) : (
                            <Combobox
                                value=""
                                onValueChange={(v) => { const r = coincidencias.find((c) => `${c.tipo}:${c.id}` === v); if (r) importar(r); }}
                                placeholder={importando ? 'Trayendo la firma…' : 'Importar firma registrada…'}
                                disabled={importando}
                                options={coincidencias.map((r) => ({ value: `${r.tipo}:${r.id}`, label: r.cargo ? `${r.nombre} · ${r.cargo}` : r.nombre }))}
                            />
                        )
                    )}
                    {errorImportar && <span className="text-xs text-destructive">{errorImportar}</span>}
                </div>
            )}
        </div>
    );
});
CampoFirma.displayName = 'CampoFirma';

export default CampoFirma;
