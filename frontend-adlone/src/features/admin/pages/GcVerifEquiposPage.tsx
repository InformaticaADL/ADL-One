import React from 'react';
import { Input } from '@/components/ui/input';
import { MarcoVerificacionTerreno } from '../components/MarcoVerificacionTerreno';
import { SelectorMarca } from '../components/SelectorMarca';
import type { Marca, Formulario } from '../services/verificacionTerreno.service';

// OI-FoGe-26 · Verificación intermedia de los equipos de pH/T°, oxígeno y cloro que se usaron en el muestreo.
// El folio OI-FoMa-01 trae los equipos y el error de temperatura; los buffers y las mediciones se escriben.

const Campo: React.FC<{ etiqueta: string; valor: string; editable: boolean; onChange: (v: string) => void }> =
    ({ etiqueta, valor, editable, onChange }) => (
        <div>
            <span className="text-[10px] text-muted-foreground">{etiqueta}</span>
            <Input value={valor} onChange={(e) => onChange(e.target.value)} disabled={!editable} className="h-7 text-xs" />
        </div>
    );

export const GcVerifEquiposPage: React.FC<{ onBack: () => void }> = ({ onBack }) => (
    <MarcoVerificacionTerreno
        tipo="equipos"
        titulo="Verificación pH, Oxígeno y Cloro"
        subtitulo="Formulario OI-FoGe-26: verificación intermedia de los equipos usados en el muestreo."
        onBack={onBack}
    >
        {({ datos, items, editable, set }) => {
            const fila = (campo: 'ajuste_ph' | 'verificacion_ph', i: number) => (datos[campo]?.[i] || {}) as Record<string, string>;
            const setFila = (campo: 'ajuste_ph' | 'verificacion_ph', i: number, clave: string, valor: string) => {
                const actual = [0, 1, 2].map((n) => ({ ...(datos[campo]?.[n] || {}) }));
                actual[i][clave] = valor;
                set({ [campo]: actual } as Partial<Formulario>);
            };
            const tablaBuffer = (campo: 'ajuste_ph' | 'verificacion_ph', titulo: string) => (
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</p>
                    {items.buffers.map(([buffer], i) => (
                        <div key={buffer} className="mt-1 rounded-md border border-border p-1.5">
                            <span className="text-[11px] font-medium">Buffer pH {buffer}</span>
                            <div className="mt-1 grid grid-cols-3 gap-1">
                                {([['ph', 'pH'], ['t', 'T°'], ['tc', 'T°C'], ['lote', 'N° Lote'], ['marca', 'Marca'], ['vencimiento', 'Vence']] as const)
                                    .map(([clave, etiqueta]) => (
                                        <Campo key={clave} etiqueta={etiqueta} valor={fila(campo, i)[clave] || ''} editable={editable}
                                            onChange={(v) => setFila(campo, i, clave, v)} />
                                    ))}
                            </div>
                        </div>
                    ))}
                </div>
            );

            const setObjeto = (campo: keyof Formulario, clave: string, valor: string) =>
                set({ [campo]: { ...((datos[campo] as Record<string, unknown>) || {}), [clave]: valor } } as Partial<Formulario>);
            const setAnidado = (campo: keyof Formulario, grupo: string, clave: string, valor: string) => {
                const base = (datos[campo] as Record<string, Record<string, string>>) || {};
                set({ [campo]: { ...base, [grupo]: { ...(base[grupo] || {}), [clave]: valor } } } as Partial<Formulario>);
            };

            return (
                <>
                    {/* pH / temperatura */}
                    <div>
                        <label className="text-xs font-medium">Equipo medidor de pH/T°</label>
                        <Input value={datos.codigo_equipo_ph || ''} onChange={(e) => set({ codigo_equipo_ph: e.target.value })}
                            disabled={!editable} className="mt-1 h-8 text-xs" />
                        <p className="mt-2 text-xs font-medium">Error T° <span className="text-muted-foreground">(viene del muestreo)</span></p>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                            {([['error_t0', '0,0'], ['error_t15', '15,0'], ['error_t30', '30,0']] as const).map(([campo, etiqueta]) => (
                                <div key={campo}>
                                    <span className="text-[10px] text-muted-foreground">Error {etiqueta}</span>
                                    <Input value={datos[campo] ?? ''} type="number" step="0.1" disabled={!editable}
                                        onChange={(e) => set({ [campo]: e.target.value === '' ? null : Number(e.target.value) })}
                                        className="h-8 text-xs" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <SelectorMarca titulo="Parámetros pH/T°" items={items.equipos.ph}
                        valores={(datos.items_ph || {}) as Record<string, Marca>} editable={editable}
                        onChange={(v) => set({ items_ph: v })} />
                    {tablaBuffer('ajuste_ph', 'Control medición · Ajuste')}
                    {tablaBuffer('verificacion_ph', 'Control medición · Verificación')}

                    {/* Oxígeno */}
                    <div>
                        <label className="text-xs font-medium">Equipo medidor de oxígeno</label>
                        <Input value={datos.codigo_equipo_oxigeno || ''} onChange={(e) => set({ codigo_equipo_oxigeno: e.target.value })}
                            disabled={!editable} className="mt-1 h-8 text-xs" />
                    </div>
                    <SelectorMarca titulo="Parámetros oxígeno" items={items.equipos.oxigeno}
                        valores={(datos.items_oxigeno || {}) as Record<string, Marca>} editable={editable}
                        onChange={(v) => set({ items_oxigeno: v })} />
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Material de referencia · oxígeno</p>
                        <div className="mt-1 grid grid-cols-3 gap-1">
                            {([['lote', 'Lote'], ['caducidad', 'Caducidad'], ['marca', 'Marca']] as const).map(([clave, etiqueta]) => (
                                <Campo key={clave} etiqueta={etiqueta} editable={editable}
                                    valor={(datos.referencia_oxigeno || {})[clave] || ''}
                                    onChange={(v) => setObjeto('referencia_oxigeno', clave, v)} />
                            ))}
                        </div>
                        {(['verificacion', 'ajuste'] as const).map((grupo) => (
                            <div key={grupo} className="mt-1 rounded-md border border-border p-1.5">
                                <span className="text-[11px] font-medium capitalize">{grupo}</span>
                                <div className="mt-1 grid grid-cols-3 gap-1">
                                    {([['hora', 'Hora'], ['cero', '0% O₂'], ['cien', '100% O₂']] as const).map(([clave, etiqueta]) => (
                                        <Campo key={clave} etiqueta={etiqueta} editable={editable}
                                            valor={(datos.mediciones_oxigeno || {})[grupo]?.[clave] || ''}
                                            onChange={(v) => setAnidado('mediciones_oxigeno', grupo, clave, v)} />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Cloro */}
                    <div>
                        <label className="text-xs font-medium">Equipo medidor de cloro</label>
                        <Input value={datos.codigo_equipo_cloro || ''} onChange={(e) => set({ codigo_equipo_cloro: e.target.value })}
                            disabled={!editable} className="mt-1 h-8 text-xs" />
                    </div>
                    <SelectorMarca titulo="Parámetros cloro" items={items.equipos.cloro}
                        valores={(datos.items_cloro || {}) as Record<string, Marca>} editable={editable}
                        onChange={(v) => set({ items_cloro: v })} />
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Material de referencia · cloro</p>
                        {(['estandar0', 'estandar1'] as const).map((grupo, i) => (
                            <div key={grupo} className="mt-1 rounded-md border border-border p-1.5">
                                <span className="text-[11px] font-medium">Estándar {i === 0 ? '0,00' : '1,00'}</span>
                                <div className="mt-1 grid grid-cols-3 gap-1">
                                    {([['lote', 'Lote'], ['caducidad', 'Caducidad'], ['rango', 'Rango']] as const).map(([clave, etiqueta]) => (
                                        <Campo key={clave} etiqueta={etiqueta} editable={editable}
                                            valor={(datos.referencia_cloro || {})[grupo]?.[clave] || ''}
                                            onChange={(v) => setAnidado('referencia_cloro', grupo, clave, v)} />
                                    ))}
                                </div>
                                <div className="mt-1">
                                    <Campo etiqueta="Verificación" editable={editable}
                                        valor={(datos.mediciones_cloro || {})[grupo] || ''}
                                        onChange={(v) => setObjeto('mediciones_cloro', grupo, v)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            );
        }}
    </MarcoVerificacionTerreno>
);

export default GcVerifEquiposPage;
