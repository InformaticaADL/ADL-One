import { useEffect, useState } from 'react';
import { IconMail, IconRefresh, IconRotateClockwise } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useConfirmacion } from '@/components/ui/confirm-dialog';
import { useToast } from '../../../../contexts/ToastContext';
import { quejasApelacionesService as api, mensajeError, type CorreoCola } from '../../services/quejasApelaciones.service';
import { Seccion } from './comun';
import { fmtDateTime } from './reglas';

const VARIANTE: Record<CorreoCola['estado'], 'secondary' | 'info' | 'success' | 'destructive' | 'warning'> = {
    pendiente: 'info', enviando: 'info', enviado: 'success', error: 'destructive', revisar: 'warning', descartado: 'secondary',
};
const AYUDA: Partial<Record<CorreoCola['estado'], string>> = {
    pendiente: 'ADLWeb lo enviará en menos de un minuto.',
    error: 'El servidor de correo lo rechazó 5 veces.',
    revisar: 'Quedó a medio enviar: confirma con el cliente si le llegó antes de reintentar.',
    descartado: 'El caso cambió de estado antes del envío; no se envió.',
};

/** Correos al cliente de este caso (cola que procesa ADLWeb): estado, intentos y reintento. */
export function CorreosCaso({ casoId, version, onCambio }: { casoId: number; version: number; onCambio: () => void }) {
    const { showToast } = useToast();
    const { confirmar, dialogo } = useConfirmacion();
    const [correos, setCorreos] = useState<CorreoCola[] | null>(null);
    const [recarga, setRecarga] = useState(0);
    const [ocupado, setOcupado] = useState<number | null>(null);
    useEffect(() => {
        let vigente = true;
        api.correos(casoId)
            .then((c) => { if (vigente) setCorreos(c); })
            .catch((e) => showToast({ type: 'error', message: mensajeError(e, 'No se pudieron cargar los correos') }));
        return () => { vigente = false; };
    }, [casoId, version, recarga, showToast]);
    // Mientras haya correos esperando, se vuelve a consultar cada 20 s para ver cuándo salen.
    const esperando = (correos || []).some((c) => c.estado === 'pendiente' || c.estado === 'enviando');
    useEffect(() => {
        if (!esperando) return;
        const t = setInterval(() => setRecarga((r) => r + 1), 20000);
        return () => clearInterval(t);
    }, [esperando]);

    const reintentar = async (c: CorreoCola) => {
        if (c.estado === 'revisar' && !(await confirmar({
            titulo: 'Reintentar el correo',
            mensaje: 'Este correo quedó a medio enviar y podría haberle llegado al cliente. Reintenta solo si confirmaste que NO lo recibió; si no, le llegará repetido.',
            textoConfirmar: 'Sí, no le llegó: reintentar',
        }))) return;
        setOcupado(c.id);
        try {
            setCorreos(await api.reintentarCorreo(casoId, c.id));
            showToast({ type: 'success', message: 'El correo volvió a la cola: ADLWeb lo enviará en menos de un minuto.' });
            onCambio();
        } catch (e) {
            showToast({ type: 'error', message: mensajeError(e, 'No se pudo reintentar el correo') });
        } finally {
            setOcupado(null);
        }
    };

    return (
        <Seccion titulo="Correos al cliente" icono={<IconMail size={18} className="text-primary" />}
            accion={<Button size="sm" variant="ghost" onClick={() => setRecarga((r) => r + 1)} aria-label="Actualizar correos"><IconRefresh size={14} />Actualizar</Button>}>
            {dialogo}
            <p className="-mt-2 mb-3 text-xs text-muted-foreground">
                Los envía ADLWeb desde su cola (con su servidor de correo). Al salir, quedan registrados solos en las notificaciones del caso.
            </p>
            {!correos ? <p className="text-sm text-muted-foreground">Cargando…</p> : correos.length ? (
                <div className="overflow-x-auto rounded-md border border-border">
                    <Table className="min-w-[640px]">
                        <TableHeader><TableRow><TableHead>Correo</TableHead><TableHead>Estado</TableHead><TableHead>Pedido</TableHead><TableHead>Enviado</TableHead><TableHead /></TableRow></TableHeader>
                        <TableBody>
                            {correos.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="text-sm font-medium">{c.tipoLabel}</TableCell>
                                    <TableCell>
                                        <Badge variant={VARIANTE[c.estado]}>{c.estadoLabel}</Badge>
                                        {AYUDA[c.estado] && <p className="mt-1 max-w-64 text-xs text-muted-foreground">{AYUDA[c.estado]}</p>}
                                        {c.ultimo_error && (c.estado === 'error' || c.estado === 'revisar') && <p className="mt-1 max-w-64 text-xs text-destructive">{c.ultimo_error}</p>}
                                    </TableCell>
                                    <TableCell className="text-xs">{fmtDateTime(c.creado_en)}<span className="block text-muted-foreground">{c.solicitado_por || '—'}</span></TableCell>
                                    <TableCell className="text-xs">{c.enviado_en ? fmtDateTime(c.enviado_en) : '—'}</TableCell>
                                    <TableCell className="text-right">
                                        {(c.estado === 'error' || c.estado === 'revisar') && (
                                            <Button size="sm" variant="outline" disabled={ocupado === c.id} onClick={() => reintentar(c)}><IconRotateClockwise size={14} />Reintentar</Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : <p className="text-sm text-muted-foreground">No se han pedido correos para este caso desde ADL-One.</p>}
        </Seccion>
    );
}
