import React, { useEffect, useState } from 'react';
import { IconPlayerPlay, IconPaperclip } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { puestaMarchaService, TIPOS_PUESTA_MARCHA, type PuestaMarcha } from '../services/puestaMarcha.service';

const NOMBRE_TIPO = Object.fromEntries(TIPOS_PUESTA_MARCHA.map((t) => [t.value, t.label]));
const dmy = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;

/**
 * Las puestas en marcha que ya se le hicieron al equipo, para verlas junto a su formulario OI-FoGe-42 (como se ven los
 * historiales por año). No muestra nada si el equipo no tiene ninguna o si aún falta la migración de puestas en marcha.
 */
export const PuestasMarchaEquipo: React.FC<{ idEquipo: number; onAbrir?: (id: number) => void; recarga?: number; mostrarVacio?: boolean }> = ({ idEquipo, onAbrir, recarga = 0, mostrarVacio = false }) => {
    const [filas, setFilas] = useState<PuestaMarcha[]>([]);

    useEffect(() => {
        let vigente = true;
        puestaMarchaService.listar({ id_equipo: idEquipo })
            .then((l) => { if (vigente) setFilas(l.filter((p) => p.estado !== 'ANULADA')); })
            .catch(() => { if (vigente) setFilas([]); });
        return () => { vigente = false; };
    }, [idEquipo, recarga]);

    if (!filas.length) return mostrarVacio ? <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Este equipo aún no tiene puestas en marcha registradas.</p> : null;
    return (
        <div className="overflow-hidden rounded-lg border border-border">
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-3 py-2 text-xs font-semibold text-muted-foreground">
                <IconPlayerPlay size={14} /> Puestas en marcha realizadas a este equipo
            </div>
            <ul className="divide-y divide-border">
                {filas.map((p) => (
                    <li key={p.id_puesta_marcha} onClick={onAbrir ? () => onAbrir(p.id_puesta_marcha) : undefined}
                        className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm ${onAbrir ? 'cursor-pointer hover:bg-muted/50' : ''}`}>
                        <span className="whitespace-nowrap font-medium">{dmy(p.fecha)}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{NOMBRE_TIPO[p.tipo]}</span>
                        {!!p.n_adjuntos && <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"><IconPaperclip size={13} />{p.n_adjuntos}</span>}
                        <Badge variant={p.estado === 'APROBADA' ? 'success' : 'warning'}>{p.estado === 'APROBADA' ? 'Aprobada' : 'Pendiente de firma'}</Badge>
                    </li>
                ))}
            </ul>
        </div>
    );
};
