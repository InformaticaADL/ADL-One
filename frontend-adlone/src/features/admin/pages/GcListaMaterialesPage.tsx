import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MarcoVerificacionTerreno } from '../components/MarcoVerificacionTerreno';

// OI-FoMa-19 · Lista de chequeo de materiales y EPP. Del muestreo llegan empresa, fecha, muestreador y la
// característica de la muestra (según el tipo de agua); el resto se marca antes de salir a terreno.

export const GcListaMaterialesPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
    <MarcoVerificacionTerreno
        tipo="materiales"
        titulo="Materiales y EPP"
        subtitulo="Formulario OI-FoMa-19: chequeo de seguridad, RILES e implementos de muestreo."
        onBack={onBack}
    >
        {({ datos, items, editable, set }) => {
            const marcados = (datos.items || {}) as Record<string, boolean>;
            const alternar = (clave: string) => set({ items: { ...marcados, [clave]: !marcados[clave] } });
            return (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-medium">Lote de lavado</label>
                            <Input value={datos.lote_lavado || ''} onChange={(e) => set({ lote_lavado: e.target.value })}
                                disabled={!editable} className="mt-1 h-8 text-xs" />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Muestreador</label>
                            <Input value={datos.muestreador || ''} onChange={(e) => set({ muestreador: e.target.value })}
                                disabled={!editable} className="mt-1 h-8 text-xs" />
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-medium">Característica de la muestra</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                            {items.caracteristicas.map(([clave, etiqueta]) => (
                                <button
                                    key={clave}
                                    type="button"
                                    disabled={!editable}
                                    onClick={() => set({ caracteristica: clave })}
                                    className={cn('rounded-md border px-2 py-1 text-[11px] transition-colors',
                                        datos.caracteristica === clave
                                            ? 'border-primary bg-primary/10 font-medium text-primary'
                                            : 'border-border hover:bg-muted')}
                                >
                                    {etiqueta}
                                </button>
                            ))}
                        </div>
                        {datos.caracteristica === 'OTROS' && (
                            <Input value={datos.caracteristica_otro || ''} onChange={(e) => set({ caracteristica_otro: e.target.value })}
                                disabled={!editable} placeholder="¿Cuál?" className="mt-1 h-8 text-xs" />
                        )}
                    </div>

                    {items.materiales.map(({ grupo, items: lista }) => (
                        <div key={grupo}>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</p>
                            <div className="mt-1 flex flex-col gap-0.5">
                                {lista.map(([clave, etiqueta]) => (
                                    <label key={clave} className={cn('flex items-center gap-2 rounded px-1 py-0.5 text-xs',
                                        editable && 'cursor-pointer hover:bg-muted')}>
                                        <input
                                            type="checkbox"
                                            checked={!!marcados[clave]}
                                            onChange={() => alternar(clave)}
                                            disabled={!editable}
                                            className="h-3.5 w-3.5"
                                        />
                                        <span>{etiqueta}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </>
            );
        }}
    </MarcoVerificacionTerreno>
);

export default GcListaMaterialesPage;
