import React from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MarcoVerificacionTerreno } from '../components/MarcoVerificacionTerreno';
import { SelectorMarca } from '../components/SelectorMarca';
import type { Marca } from '../services/verificacionTerreno.service';

// OI-FoMa-03 · Lista de verificación del muestreador automático. Del muestreo llegan el código del MAU y de
// la sonda de caudal con su error de temperatura: la app del muestreador ya los registra.

const SiNo: React.FC<{ valor: boolean | null | undefined; editable: boolean; onChange: (v: boolean) => void }> =
    ({ valor, editable, onChange }) => (
        <div className="mt-1 flex gap-1">
            {[['SI', true], ['NO', false]].map(([texto, v]) => (
                <button
                    key={String(texto)}
                    type="button"
                    disabled={!editable}
                    onClick={() => onChange(v as boolean)}
                    className={cn('flex-1 rounded border px-2 py-1 text-[11px] transition-colors',
                        valor === v ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border hover:bg-muted')}
                >
                    {texto}
                </button>
            ))}
        </div>
    );

export const GcVerifMauPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
    <MarcoVerificacionTerreno
        tipo="mau"
        titulo="Muestreador Automático"
        subtitulo="Formulario OI-FoMa-03: verificación del MAU y la sonda de caudal usados en el muestreo."
        onBack={onBack}
    >
        {({ datos, items, editable, set }) => {
            const marcas = (datos.items || {}) as Record<string, Marca>;
            return (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-medium">Código equipo (MAU)</label>
                            <Input value={datos.codigo_equipo || ''} onChange={(e) => set({ codigo_equipo: e.target.value })}
                                disabled={!editable} className="mt-1 h-8 text-xs" />
                        </div>
                        <div>
                            <label className="text-xs font-medium">Cód. sonda caudal</label>
                            <Input value={datos.codigo_sonda_caudal || ''} onChange={(e) => set({ codigo_sonda_caudal: e.target.value })}
                                disabled={!editable} className="mt-1 h-8 text-xs" />
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-medium">Error T° <span className="text-muted-foreground">(viene del muestreo)</span></p>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                            {([['error_t0', '0,0'], ['error_t15', '15,0'], ['error_t30', '30,0']] as const).map(([campo, etiqueta]) => (
                                <div key={campo}>
                                    <span className="text-[10px] text-muted-foreground">Error {etiqueta}</span>
                                    <Input
                                        value={datos[campo] ?? ''}
                                        onChange={(e) => set({ [campo]: e.target.value === '' ? null : Number(e.target.value) })}
                                        disabled={!editable}
                                        type="number"
                                        step="0.1"
                                        className="h-8 text-xs"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {items.mau.map(({ grupo, items: lista }) => (
                        <SelectorMarca
                            key={grupo}
                            titulo={grupo}
                            items={lista}
                            valores={marcas}
                            editable={editable}
                            onChange={(v) => set({ items: v })}
                        />
                    ))}

                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Verificación</p>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[10px] text-muted-foreground">Nivel real ±5%</span>
                                <Input value={datos.nivel_real ?? ''} type="number" step="0.001" disabled={!editable}
                                    onChange={(e) => set({ nivel_real: e.target.value === '' ? null : Number(e.target.value) })}
                                    className="h-8 text-xs" />
                            </div>
                            <div>
                                <span className="text-[10px] text-muted-foreground">Nivel equipo ±5%</span>
                                <Input value={datos.nivel_equipo ?? ''} type="number" step="0.001" disabled={!editable}
                                    onChange={(e) => set({ nivel_equipo: e.target.value === '' ? null : Number(e.target.value) })}
                                    className="h-8 text-xs" />
                            </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Acepta medición de nivel</span>
                        <SiNo valor={datos.acepta_nivel} editable={editable} onChange={(v) => set({ acepta_nivel: v })} />

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[10px] text-muted-foreground">Volumen obtenido</span>
                                <Input value={datos.volumen_obtenido ?? ''} type="number" step="0.001" disabled={!editable}
                                    onChange={(e) => set({ volumen_obtenido: e.target.value === '' ? null : Number(e.target.value) })}
                                    className="h-8 text-xs" />
                            </div>
                            <div>
                                <span className="text-[10px] text-muted-foreground">Volumen real</span>
                                <Input value={datos.volumen_real ?? ''} type="number" step="0.001" disabled={!editable}
                                    onChange={(e) => set({ volumen_real: e.target.value === '' ? null : Number(e.target.value) })}
                                    className="h-8 text-xs" />
                            </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">Acepta medición de volumen</span>
                        <SiNo valor={datos.acepta_volumen} editable={editable} onChange={(v) => set({ acepta_volumen: v })} />

                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[10px] text-muted-foreground">Inicio</span>
                                <Input value={datos.hora_inicio || ''} disabled={!editable} placeholder="HH:MM"
                                    onChange={(e) => set({ hora_inicio: e.target.value })} className="h-8 text-xs" />
                            </div>
                            <div>
                                <span className="text-[10px] text-muted-foreground">Término</span>
                                <Input value={datos.hora_termino || ''} disabled={!editable} placeholder="HH:MM"
                                    onChange={(e) => set({ hora_termino: e.target.value })} className="h-8 text-xs" />
                            </div>
                        </div>
                    </div>
                </>
            );
        }}
    </MarcoVerificacionTerreno>
);

export default GcVerifMauPage;
