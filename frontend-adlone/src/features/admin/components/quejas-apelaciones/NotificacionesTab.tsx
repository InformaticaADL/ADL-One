import { useEffect, useState } from 'react';
import { IconAlertTriangle, IconDeviceFloppy, IconFlag, IconPlus, IconRobot } from '@tabler/icons-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '../../../../contexts/ToastContext';
import { quejasApelacionesService as api, mensajeError, type Caso } from '../../services/quejasApelaciones.service';
import { Campo, ConSugerencias, Seccion } from './comun';
import { ETAPAS, VIAS, fmtDay, fmtDateTime, limites, noFuture, today } from './reglas';

function NuevaNotificacion({ casoId, recepcion, etapa, onAdded, onCancel }: { casoId: number; recepcion: string | null; etapa: string; onAdded: () => void; onCancel: () => void }) {
    const { showToast } = useToast();
    const [notificadoA, setNotificadoA] = useState('');
    const [via, setVia] = useState('');
    const [obs, setObs] = useState('');
    const [fecha, setFecha] = useState(today());
    const [saving, setSaving] = useState(false);
    const rango = noFuture(fecha, recepcion);
    const valid = notificadoA.trim().length >= 2 && via.trim().length >= 2 && Boolean(fecha) && !rango.error;
    const save = async () => {
        if (!valid) return;
        setSaving(true);
        try {
            await api.agregarNotificacion(casoId, { etapa, notificadoA: notificadoA.trim(), via: via.trim(), observaciones: obs.trim(), fecha });
            showToast({ type: 'success', message: 'Notificación registrada.' });
            onAdded();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo registrar la notificación') });
        } finally {
            setSaving(false);
        }
    };
    return (
        <div className="mt-3 rounded-md border border-border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
                <Campo label="Notificado a" required>
                    <Input placeholder="Nombre / cargo / empresa" value={notificadoA} maxLength={300} onChange={(e) => setNotificadoA(e.target.value)} />
                </Campo>
                <Campo label="Vía de notificación" required htmlFor={`qa-via-${etapa}`}>
                    <ConSugerencias id={`qa-via-${etapa}`} sugerencias={VIAS} placeholder="Ej. Correo electrónico" value={via} maxLength={100} onChange={(e) => setVia(e.target.value)} />
                </Campo>
                <Campo label="Fecha" required error={rango.error}>
                    <Input type="date" {...limites(rango)} value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </Campo>
            </div>
            <Campo label="Obs." className="mt-3">
                <Textarea rows={2} maxLength={2000} value={obs} onChange={(e) => setObs(e.target.value)} />
            </Campo>
            <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={onCancel}>Cancelar</Button>
                <Button size="sm" disabled={!valid || saving} onClick={save}><IconDeviceFloppy size={14} />Registrar</Button>
            </div>
        </div>
    );
}

export function NotificacionesTab({ caso, onSaved }: { caso: Caso; onSaved: () => void }) {
    const { showToast } = useToast();
    const [adding, setAdding] = useState<string | null>(null);
    const [sendingAcuse, setSendingAcuse] = useState(false);
    useEffect(() => { setAdding(null); }, [caso.id]);
    const sinInicio = !caso.notificaciones.some((n) => n.etapa === 'inicio');
    const enviarAcuse = async () => {
        setSendingAcuse(true);
        try {
            const r = await api.enviarAcuse(caso.id);
            showToast({
                type: 'success',
                message: r.correo === 'ya_en_cola'
                    ? 'Ya hay un acuse de recibo en cola para este caso; no se duplicó.'
                    : `Acuse de recibo en cola: ADLWeb lo enviará a ${caso.correo} en menos de un minuto y quedará registrado como inicio de proceso.`,
            });
            onSaved();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo enviar el acuse de recibo') });
        } finally {
            setSendingAcuse(false);
        }
    };
    return (
        <div className="flex flex-col gap-4">
            {sinInicio && (
                <Alert variant="warning">
                    <IconAlertTriangle />
                    <AlertTitle>Falta la notificación de inicio de proceso</AlertTitle>
                    <AlertDescription>
                        No se ha registrado el acuse de recibo, así que esa parte del formulario OI-FoGe-05 queda en blanco.
                        Envíalo ahora al mail de contacto, o regístralo con «Agregar» si se avisó por otra vía (teléfono, en persona…).
                        <div className="mt-2">
                            <Button size="sm" disabled={sendingAcuse} onClick={enviarAcuse}><IconFlag size={14} />{sendingAcuse ? 'Enviando…' : `Enviar acuse de recibo a ${caso.correo}`}</Button>
                        </div>
                    </AlertDescription>
                </Alert>
            )}
            <p className="text-sm text-muted-foreground">
                A quién, por qué vía y cuándo se notificó cada etapa. Los correos que envía el sistema (acuse, paso a tratamiento y
                respuesta formal) se registran solos. No se editan ni se borran: si hay un error, registra una nueva con la corrección en «Obs.».
            </p>
            {ETAPAS.map((et) => {
                const items = caso.notificaciones.filter((n) => n.etapa === et.value);
                const Icon = et.icon;
                return (
                    <Seccion
                        key={et.value}
                        titulo={<>{et.label} <Badge variant="secondary">{items.length}</Badge></>}
                        icono={<Icon size={18} className="text-primary" />}
                        accion={adding !== et.value && <Button size="sm" variant="outline" onClick={() => setAdding(et.value)}><IconPlus size={14} />Agregar</Button>}
                    >
                        {items.length > 0 ? (
                            <div className="overflow-x-auto rounded-md border border-border">
                                <Table className="min-w-[620px]">
                                    <TableHeader><TableRow><TableHead>Notificado a</TableHead><TableHead className="w-24">Fecha</TableHead><TableHead className="w-44">Vía de notificación</TableHead><TableHead>Obs.</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {items.map((n) => (
                                            <TableRow key={n.id}>
                                                <TableCell>{n.notificado_a}</TableCell>
                                                <TableCell>{fmtDay(n.fecha)}</TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center gap-1">
                                                        {n.automatico && <IconRobot size={14} className="text-muted-foreground" aria-label="Registrada automáticamente" />}{n.via}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="whitespace-pre-wrap">{n.observaciones || '—'}</p>
                                                    <p className="text-xs text-muted-foreground">{n.automatico ? 'Automática' : `Registró ${n.creado_por || 'admin'}`} · {fmtDateTime(n.creado_en)}</p>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : adding !== et.value && <p className="text-sm text-muted-foreground">Sin notificaciones registradas.</p>}
                        {adding === et.value && (
                            <NuevaNotificacion casoId={caso.id} recepcion={caso.fecha_recepcion} etapa={et.value}
                                onCancel={() => setAdding(null)} onAdded={() => { setAdding(null); onSaved(); }} />
                        )}
                    </Seccion>
                );
            })}
        </div>
    );
}
