import React, { useState, useEffect, useMemo } from 'react';
import { IconSearch, IconMessageCircle, IconSend } from '@tabler/icons-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Card, CardContent } from '@/components/ui/card';

import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useNavStore } from '../../../store/navStore';
import { useNotificationStore } from '../../../store/notificationStore';
import { esNotificacionSolicitudCliente } from '../../notifications/utils/notificationNavigation';
import {
    solicitudesClientesService,
    type SolicitudClienteResumen,
    type SolicitudClienteDetalle,
} from '../../../services/solicitudesClientes.service';

interface Props {
    onBack: () => void;
}

const ESTADO_LABEL: Record<string, string> = {
    recibida: 'Recibida',
    en_revision: 'En revisión',
    respondida: 'Respondida',
    cerrada: 'Cerrada',
};
const ESTADO_VARIANT: Record<string, 'default' | 'outline' | 'success' | 'destructive'> = {
    recibida: 'default',
    en_revision: 'default',
    respondida: 'success',
    cerrada: 'outline',
};
const AREA_LABEL: Record<string, string> = { LAB: 'Laboratorio', MAM: 'Medio Ambiente' };
// Mismas transiciones que valida WebClientesV2 (ver TRANSICIONES en solicitudesRoutes.js) —
// solo para no ofrecer botones que el backend de todos modos rechazaría.
const TRANSICIONES: Record<string, string[]> = {
    recibida: ['en_revision', 'cerrada'],
    en_revision: ['respondida', 'cerrada'],
    respondida: ['en_revision', 'cerrada'],
    cerrada: ['en_revision'],
};

export const SolicitudesClientesPage: React.FC<Props> = ({ onBack }) => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    const { showToast } = useToast();
    const { pendingSolicitudClienteId, setPendingSolicitudClienteId } = useNavStore();
    const { notifications, markAsRead } = useNotificationStore();

    const [solicitudes, setSolicitudes] = useState<SolicitudClienteResumen[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [detalle, setDetalle] = useState<SolicitudClienteDetalle | null>(null);
    const [loadingDetalle, setLoadingDetalle] = useState(false);
    const [respuesta, setRespuesta] = useState('');
    const [enviando, setEnviando] = useState(false);

    useEffect(() => {
        loadLista();
    }, []);

    // Llegada desde una notificación de la campana: abre directamente esa solicitud.
    useEffect(() => {
        if (!pendingSolicitudClienteId) return;
        const id = pendingSolicitudClienteId;
        setPendingSolicitudClienteId(null);
        abrirDetalle(id);
    }, [pendingSolicitudClienteId]);

    const loadLista = async () => {
        try {
            setLoading(true);
            setSolicitudes(await solicitudesClientesService.listar());
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar las solicitudes' });
        } finally {
            setLoading(false);
        }
    };

    const abrirDetalle = async (id: number) => {
        // Sus avisos de la campana quedan leídos (solo los de solicitudes de clientes: el id_referencia puede coincidir con el de una solicitud interna).
        notifications
            .filter((n) => !n.leido && n.id_referencia === id && esNotificacionSolicitudCliente(n))
            .forEach((n) => { void markAsRead(n.id_notificacion); });
        try {
            setLoadingDetalle(true);
            setDetalle(await solicitudesClientesService.detalle(id));
        } catch (error) {
            showToast({ type: 'error', message: 'Error al cargar la solicitud' });
        } finally {
            setLoadingDetalle(false);
        }
    };

    const cerrarDetalle = () => {
        setDetalle(null);
        setRespuesta('');
        loadLista();
    };

    const filtradas = useMemo(() => {
        const term = searchTerm.toLowerCase();
        return solicitudes.filter((s) =>
            (s.cliente_nombre || '').toLowerCase().includes(term) ||
            (s.asunto || '').toLowerCase().includes(term)
        );
    }, [solicitudes, searchTerm]);

    const handleTomar = async (id: number) => {
        try {
            await solicitudesClientesService.tomar(id);
            showToast({ type: 'success', message: 'Solicitud tomada' });
            abrirDetalle(id);
            loadLista();
        } catch (error) {
            showToast({ type: 'error', message: 'Error al tomar la solicitud' });
        }
    };

    const handleResponder = async () => {
        if (!detalle || !respuesta.trim()) return;
        try {
            setEnviando(true);
            await solicitudesClientesService.responder(detalle.id, respuesta.trim());
            setRespuesta('');
            await abrirDetalle(detalle.id);
            loadLista();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al enviar la respuesta' });
        } finally {
            setEnviando(false);
        }
    };

    const handleCambiarEstado = async (estado: string) => {
        if (!detalle) return;
        try {
            await solicitudesClientesService.cambiarEstado(detalle.id, estado as any);
            showToast({ type: 'success', message: `Estado cambiado a ${ESTADO_LABEL[estado]}` });
            await abrirDetalle(detalle.id);
            loadLista();
        } catch (error: any) {
            showToast({ type: 'error', message: error.response?.data?.message || 'Error al cambiar el estado' });
        }
    };

    // ---- Detalle ----------------------------------------------------------

    if (detalle || loadingDetalle) {
        return (
            <div className="shadcn-scope w-full p-4 md:p-6">
                <PageHeader
                    title={detalle?.asunto || 'Solicitud'}
                    subtitle={detalle?.cliente_nombre}
                    onBack={cerrarDetalle}
                    breadcrumbItems={[{ label: 'Solicitudes de clientes', onClick: cerrarDetalle }, { label: `#${detalle?.id ?? ''}` }]}
                    rightSection={detalle && <Badge variant={ESTADO_VARIANT[detalle.estado]}>{ESTADO_LABEL[detalle.estado]}</Badge>}
                />

                {loadingDetalle || !detalle ? (
                    <div className="flex justify-center p-12">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : (
                    <div className="mt-6 flex flex-col gap-4">
                        <div className="flex flex-wrap gap-2">
                            {(TRANSICIONES[detalle.estado] || []).map((estado) => (
                                <Button key={estado} variant="outline" size="sm" onClick={() => handleCambiarEstado(estado)}>
                                    Pasar a {ESTADO_LABEL[estado]}
                                </Button>
                            ))}
                        </div>

                        <Card>
                            <CardContent className="flex flex-col gap-4 pt-4">
                                {detalle.mensajes.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-muted-foreground">Sin mensajes todavía.</p>
                                ) : (
                                    detalle.mensajes.map((m) => (
                                        <div
                                            key={m.id}
                                            className={m.es_adl
                                                ? 'ml-auto max-w-[80%] rounded-xl bg-primary/10 p-3'
                                                : 'max-w-[80%] rounded-xl bg-muted p-3'}
                                        >
                                            <p className="mb-1 text-xs font-semibold text-muted-foreground">
                                                {m.es_adl ? (m.autor_externo || m.autor_nombre) : m.autor_nombre}
                                            </p>
                                            <p className="whitespace-pre-wrap text-sm text-foreground">{m.texto}</p>
                                            <p className="mt-1 text-[11px] text-muted-foreground">
                                                {new Date(m.creado_en).toLocaleString('es-CL')}
                                            </p>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>

                        {detalle.estado !== 'cerrada' && (
                            <div className="flex flex-col gap-2">
                                <Textarea
                                    placeholder="Escribe tu respuesta..."
                                    value={respuesta}
                                    onChange={(e) => setRespuesta(e.target.value)}
                                    rows={3}
                                />
                                <Button onClick={handleResponder} disabled={enviando || !respuesta.trim()} className="self-end">
                                    <IconSend size={15} /> {enviando ? 'Enviando...' : 'Responder'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ---- Lista --------------------------------------------------------

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Solicitudes de clientes"
                subtitle="Solicitudes de las empresas que tienes asignadas."
                onBack={onBack}
                rightSection={
                    <div className="relative">
                        <IconSearch size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            placeholder="Buscar..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={isMobile ? 'w-full pl-8' : 'w-72 pl-8'}
                        />
                    </div>
                }
            />

            <div className="mt-6 flex flex-col gap-4">
                <div className="relative overflow-hidden rounded-xl border border-border bg-card">
                    {loading && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    )}

                    {isMobile ? (
                        <div className="flex flex-col divide-y divide-border">
                            {filtradas.length > 0 ? filtradas.map((s) => (
                                <button
                                    key={s.id}
                                    type="button"
                                    className="flex w-full flex-col gap-1 p-3 text-left hover:bg-muted/60"
                                    onClick={() => abrirDetalle(s.id)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-semibold text-foreground">{s.cliente_nombre}</p>
                                        <Badge variant={ESTADO_VARIANT[s.estado]}>{ESTADO_LABEL[s.estado]}</Badge>
                                    </div>
                                    <p className="truncate text-sm text-muted-foreground">{s.asunto}</p>
                                    <Badge variant="outline" className="mt-1 w-fit">{AREA_LABEL[s.area] || s.area}</Badge>
                                </button>
                            )) : (
                                <p className="p-6 text-center text-sm text-muted-foreground">No hay solicitudes</p>
                            )}
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="hover:bg-transparent">
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Asunto</TableHead>
                                    <TableHead>Área</TableHead>
                                    <TableHead>Responsable</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtradas.length > 0 ? filtradas.map((s) => (
                                    <TableRow key={s.id} className="cursor-pointer" onClick={() => abrirDetalle(s.id)}>
                                        <TableCell className="text-sm font-medium text-foreground">{s.cliente_nombre}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{s.asunto}</TableCell>
                                        <TableCell><Badge variant="outline">{AREA_LABEL[s.area] || s.area}</Badge></TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{s.responsable_nombre || '-'}</TableCell>
                                        <TableCell><Badge variant={ESTADO_VARIANT[s.estado]}>{ESTADO_LABEL[s.estado]}</Badge></TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            {s.responsable_nombre ? (
                                                <Button variant="ghost" size="sm" onClick={() => abrirDetalle(s.id)}>Ver</Button>
                                            ) : (
                                                <Button size="sm" onClick={() => handleTomar(s.id)}>Tomar</Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell colSpan={6} className="py-16 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <IconMessageCircle size={40} className="text-muted-foreground/40" />
                                                <p className="text-sm font-medium text-muted-foreground">No tienes solicitudes pendientes</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SolicitudesClientesPage;
