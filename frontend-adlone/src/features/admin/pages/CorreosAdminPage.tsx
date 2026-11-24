import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { IconMail, IconBell, IconUsers, IconSearch, IconShieldCheck } from '@tabler/icons-react';
import { PageHeader } from '../../../components/layout/PageHeader';
import { useToast } from '../../../contexts/ToastContext';
import { rbacService, type User } from '../services/rbac.service';
import {
    correosAdminService, canalesSilenciados, MOTIVO_TEXTO,
    type EventoCorreo, type TipoSolicitud, type PersonaDestino, type Silencio, type CanalesAviso, type RolDelAviso, type AvisoDePersona, type MotivoNoRecibe,
} from '../services/correosAdmin.service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

const esDeSolicitud = (codigo: string) => /^(SOL_|SOLICITUD_)/.test(codigo);

const Estado: React.FC<{ recibe: boolean; motivo: MotivoNoRecibe | null }> = ({ recibe, motivo }) => {
    if (recibe) return <Badge variant="success">Recibe</Badge>;
    if (motivo === 'sin_acceso') return <Badge variant="destructive">Sin acceso</Badge>;
    if (motivo === 'silenciado') return <Badge variant="warning">Silenciado</Badge>;
    return <Badge variant="secondary">No elegido en el rol</Badge>;
};

// ── Por aviso ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const RolPanel: React.FC<{ rol: RolDelAviso; onGuardar: (idRol: number, usuarios: number[]) => Promise<void> }> = ({ rol, onGuardar }) => {
    const [modo, setModo] = useState<'todo' | 'algunas'>(rol.limitado ? 'algunas' : 'todo');
    const [elegidos, setElegidos] = useState<Set<number>>(new Set(rol.miembros.filter((m) => m.elegido).map((m) => m.id_usuario)));
    const [guardando, setGuardando] = useState(false);
    useEffect(() => {
        setModo(rol.limitado ? 'algunas' : 'todo');
        setElegidos(new Set(rol.miembros.filter((m) => m.elegido).map((m) => m.id_usuario)));
    }, [rol]);

    const conAcceso = rol.miembros.filter((m) => m.tiene_acceso !== false).length;
    const hayCambios = modo === 'todo' ? rol.limitado : (!rol.limitado || rol.miembros.some((m) => m.elegido !== elegidos.has(m.id_usuario)));
    const puedeGuardar = hayCambios && (modo === 'todo' || elegidos.size > 0) && !guardando;

    const guardar = async () => {
        setGuardando(true);
        try { await onGuardar(rol.id_rol, modo === 'todo' ? [] : [...elegidos]); } finally { setGuardando(false); }
    };
    const alternar = (id: number) => setElegidos((prev) => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });

    return (
        <div className="rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-foreground">{rol.nombre_rol}</p>
                    <p className="text-xs text-muted-foreground">
                        {rol.miembros.length} persona{rol.miembros.length === 1 ? '' : 's'}
                        {rol.miembros.some((m) => m.tiene_acceso !== null) && ` · ${conAcceso} con acceso a esta solicitud`}
                    </p>
                </div>
                <div className="flex rounded-lg border border-border p-0.5 text-xs font-medium">
                    <button type="button" onClick={() => setModo('todo')} className={cn('rounded-md px-3 py-1.5', modo === 'todo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Todo el rol</button>
                    <button type="button" onClick={() => setModo('algunas')} className={cn('rounded-md px-3 py-1.5', modo === 'algunas' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>Solo algunas personas</button>
                </div>
            </div>

            {modo === 'algunas' && (
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {rol.miembros.map((m) => {
                        const sinAcceso = m.tiene_acceso === false;
                        return (
                            <label key={m.id_usuario} className={cn('flex items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-sm', sinAcceso && 'opacity-60', elegidos.has(m.id_usuario) && !sinAcceso && 'bg-primary/5')}>
                                <Checkbox checked={elegidos.has(m.id_usuario)} onCheckedChange={() => alternar(m.id_usuario)} />
                                <span className="min-w-0 flex-1 truncate">{m.nombre}</span>
                                {sinAcceso && <Badge variant="destructive" className="shrink-0">Sin acceso</Badge>}
                            </label>
                        );
                    })}
                </div>
            )}
            {modo === 'algunas' && elegidos.size === 0 && <p className="mt-2 text-xs text-warning">Elige al menos una persona, o vuelve a «Todo el rol».</p>}
            {modo === 'todo' && <p className="mt-2 text-xs text-muted-foreground">Recibe todo el rol (las personas sin acceso a la solicitud igual no reciben nada).</p>}

            <div className="mt-3 flex justify-end">
                <Button size="sm" onClick={guardar} disabled={!puedeGuardar}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
            </div>
        </div>
    );
};

const PorAviso: React.FC = () => {
    const { showToast } = useToast();
    const [eventos, setEventos] = useState<EventoCorreo[]>([]);
    const [tipos, setTipos] = useState<TipoSolicitud[]>([]);
    const [busqueda, setBusqueda] = useState('');
    const [codigo, setCodigo] = useState<string | null>(null);
    const [idTipo, setIdTipo] = useState<number | null>(null);
    const [personas, setPersonas] = useState<PersonaDestino[]>([]);
    const [silencios, setSilencios] = useState<Silencio[]>([]);
    const [canales, setCanales] = useState<CanalesAviso>({ email: true, web: true });
    const [roles, setRoles] = useState<RolDelAviso[]>([]);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        correosAdminService.getCatalogo()
            .then((c) => { setEventos(c.eventos); setTipos(c.tipos); })
            .catch(() => showToast({ type: 'error', message: 'No se pudo cargar la lista de avisos' }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargar = useCallback(async () => {
        if (!codigo) return;
        setCargando(true);
        try {
            const [d, r] = await Promise.all([correosAdminService.getDestinatarios(codigo, idTipo), correosAdminService.getRoles(codigo, idTipo)]);
            setPersonas(d.personas); setSilencios(d.silencios); setCanales(d.canales); setRoles(r);
        } catch {
            showToast({ type: 'error', message: 'No se pudo calcular quién recibe este aviso' });
        } finally { setCargando(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [codigo, idTipo]);
    useEffect(() => { void cargar(); }, [cargar]);

    const grupos = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        const filtrados = eventos.filter((e) => !q || e.codigo.toLowerCase().includes(q) || (e.descripcion || '').toLowerCase().includes(q));
        const m = new Map<string, EventoCorreo[]>();
        filtrados.forEach((e) => m.set(e.modulo, [...(m.get(e.modulo) || []), e]));
        return [...m.entries()];
    }, [eventos, busqueda]);

    const evento = eventos.find((e) => e.codigo === codigo) || null;
    const reciben = personas.filter((p) => p.recibe).length;

    const guardarRol = async (idRol: number, usuarios: number[]) => {
        if (!codigo) return;
        try {
            await correosAdminService.guardarLimiteDeRol(codigo, idRol, usuarios);
            showToast({ type: 'success', message: usuarios.length ? 'Selección guardada' : 'Ahora recibe todo el rol' });
            await cargar();
        } catch { showToast({ type: 'error', message: 'No se pudo guardar la selección' }); }
    };

    const cambiarCanal = async (p: PersonaDestino, canal: 'email' | 'web', recibir: boolean) => {
        if (!codigo) return;
        const actual = canalesSilenciados(silencios.filter((s) => s.codigo_evento === codigo), p.id_usuario, codigo);
        const email = canal === 'email' ? !recibir : actual.email;
        const web = canal === 'web' ? !recibir : actual.web;
        try {
            await correosAdminService.guardarSilencio(p.id_usuario, codigo, email, web);
            await cargar();
        } catch { showToast({ type: 'error', message: 'No se pudo guardar el cambio' }); }
    };

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="h-fit lg:sticky lg:top-4">
                <CardHeader>
                    <CardTitle>Avisos</CardTitle>
                    <div className="relative pt-1">
                        <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 mt-0.5 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar un aviso…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    </div>
                </CardHeader>
                <CardContent className="max-h-[60vh] overflow-y-auto pr-1">
                    {grupos.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Sin resultados</p>}
                    {grupos.map(([modulo, lista]) => (
                        <div key={modulo} className="mb-3">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{modulo}</p>
                            {lista.map((e) => (
                                <button key={e.codigo} type="button" onClick={() => { setCodigo(e.codigo); setIdTipo(null); }}
                                    className={cn('block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted/60', codigo === e.codigo && 'bg-primary/10 font-medium text-primary')}>
                                    <span className="block truncate">{e.descripcion || e.codigo}</span>
                                    <span className="block truncate text-[11px] text-muted-foreground">{e.codigo}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </CardContent>
            </Card>

            <div className="flex min-w-0 flex-col gap-4">
                {!evento ? (
                    <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Elige un aviso de la lista para ver quién lo recibe.</CardContent></Card>
                ) : (
                    <>
                        <Card>
                            <CardHeader>
                                <CardTitle>{evento.descripcion || evento.codigo}</CardTitle>
                                <CardDescription>{evento.codigo}</CardDescription>
                            </CardHeader>
                            {esDeSolicitud(evento.codigo) && (
                                <CardContent>
                                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tipo de solicitud (para comprobar quién tiene acceso)</p>
                                    <Combobox placeholder="Sin elegir: no se comprueba el acceso" searchPlaceholder="Buscar tipo…" options={tipos.map((t) => ({ value: String(t.id_tipo), label: t.nombre }))}
                                        value={idTipo ? String(idTipo) : ''} onValueChange={(v) => setIdTipo(v ? Number(v) : null)} />
                                </CardContent>
                            )}
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><IconUsers size={18} /> Quién lo recibe hoy</CardTitle>
                                <CardDescription>{cargando ? 'Calculando…' : `${reciben} reciben · ${personas.length - reciben} no reciben`}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!canales.email && !canales.web && <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">Este aviso no tiene ningún canal activo (ni correo ni aviso web): hoy no le llega a nadie.</p>}
                                {personas.length === 0 && !cargando ? (
                                    <p className="py-4 text-center text-sm text-muted-foreground">Este aviso no tiene personas ni roles asignados.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent">
                                                <TableHead>Persona</TableHead>
                                                <TableHead className="w-24 text-center"><IconMail size={14} className="mx-auto" aria-label="Correo" /></TableHead>
                                                <TableHead className="w-24 text-center"><IconBell size={14} className="mx-auto" aria-label="Aviso web" /></TableHead>
                                                <TableHead className="w-48">Estado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {personas.map((p) => {
                                                const sil = canalesSilenciados(silencios, p.id_usuario, codigo);
                                                const global = canalesSilenciados(silencios.filter((s) => s.codigo_evento === null), p.id_usuario, codigo);
                                                const editable = p.motivo !== 'sin_acceso' && p.motivo !== 'fuera_de_la_seleccion_del_rol';
                                                const celda = (canal: 'email' | 'web') => {
                                                    if (!canales[canal]) return <span className="text-muted-foreground">—</span>;
                                                    const silenciado = canal === 'email' ? sil.email : sil.web;
                                                    const porGlobal = canal === 'email' ? global.email : global.web;
                                                    return <Switch checked={!silenciado} disabled={!editable || porGlobal} onCheckedChange={(v) => cambiarCanal(p, canal, v)} aria-label={`${canal === 'email' ? 'Correo' : 'Aviso web'} de ${p.nombre}`} />;
                                                };
                                                return (
                                                    <TableRow key={p.id_usuario}>
                                                        <TableCell className="font-medium">{p.nombre || `Usuario ${p.id_usuario}`}</TableCell>
                                                        <TableCell className="text-center">{celda('email')}</TableCell>
                                                        <TableCell className="text-center">{celda('web')}</TableCell>
                                                        <TableCell>
                                                            <Estado recibe={p.recibe} motivo={p.motivo} />
                                                            {p.motivo && <span className="mt-0.5 block text-[11px] text-muted-foreground">{MOTIVO_TEXTO[p.motivo]}</span>}
                                                            {(global.email || global.web) && <span className="mt-0.5 block text-[11px] text-muted-foreground">Tiene silencios en todos los avisos (ver «Por persona»)</span>}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>

                        {roles.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><IconShieldCheck size={18} /> Roles de este aviso</CardTitle>
                                    <CardDescription>De cada rol puedes elegir solo a algunas personas. Quien no tiene acceso a la solicitud no recibe nada, aunque esté elegido.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-col gap-3">
                                    {roles.map((r) => <RolPanel key={r.id_rol} rol={r} onGuardar={guardarRol} />)}
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ── Por persona ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

const PorPersona: React.FC = () => {
    const { showToast } = useToast();
    const [usuarios, setUsuarios] = useState<User[]>([]);
    const [idUsuario, setIdUsuario] = useState<number | null>(null);
    const [silencios, setSilencios] = useState<Silencio[]>([]);
    const [avisos, setAvisos] = useState<AvisoDePersona[]>([]);
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        rbacService.getUsers().then((u) => setUsuarios(u.filter((x) => x.habilitado !== 'N')))
            .catch(() => showToast({ type: 'error', message: 'No se pudo cargar la lista de personas' }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const cargar = useCallback(async () => {
        if (!idUsuario) return;
        setCargando(true);
        try { const d = await correosAdminService.getPersona(idUsuario); setSilencios(d.silencios); setAvisos(d.eventos); }
        catch { showToast({ type: 'error', message: 'No se pudo armar la vista de esta persona' }); }
        finally { setCargando(false); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idUsuario]);
    useEffect(() => { void cargar(); }, [cargar]);

    const global = canalesSilenciados(silencios.filter((s) => s.codigo_evento === null), idUsuario || 0, null);

    const fijar = async (codigoEvento: string | null, email: boolean, web: boolean) => {
        if (!idUsuario) return;
        try { await correosAdminService.guardarSilencio(idUsuario, codigoEvento, email, web); await cargar(); }
        catch { showToast({ type: 'error', message: 'No se pudo guardar el cambio' }); }
    };

    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>Persona</CardTitle>
                    <CardDescription>Elige a alguien para ver qué avisos le llegan y apagarle el correo o el aviso web.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Combobox placeholder="Buscar una persona…" searchPlaceholder="Escribe un nombre…"
                        options={usuarios.map((u) => ({ value: String(u.id_usuario), label: `${u.nombre_real || u.nombre_usuario} (${u.nombre_usuario})` }))}
                        value={idUsuario ? String(idUsuario) : ''} onValueChange={(v) => setIdUsuario(v ? Number(v) : null)} />
                </CardContent>
            </Card>

            {idUsuario && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>En todos los avisos</CardTitle>
                            <CardDescription>Seguirá viendo las solicitudes y fichas a las que tiene acceso: esto solo apaga los avisos.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-wrap gap-x-10 gap-y-3">
                            <label className="flex items-center gap-3 text-sm"><Switch checked={!global.email} onCheckedChange={(v) => fijar(null, !v, global.web)} /> Recibir correos</label>
                            <label className="flex items-center gap-3 text-sm"><Switch checked={!global.web} onCheckedChange={(v) => fijar(null, global.email, !v)} /> Recibir avisos web</label>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Avisos que le llegan</CardTitle>
                            <CardDescription>{cargando ? 'Calculando…' : `${avisos.filter((a) => a.recibe).length} activos · ${avisos.filter((a) => !a.recibe).length} apagados o sin acceso`}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {avisos.length === 0 && !cargando ? <p className="py-4 text-center text-sm text-muted-foreground">Ningún aviso le llega a esta persona.</p> : (
                                <Table>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Aviso</TableHead>
                                            <TableHead className="w-24 text-center"><IconMail size={14} className="mx-auto" aria-label="Correo" /></TableHead>
                                            <TableHead className="w-24 text-center"><IconBell size={14} className="mx-auto" aria-label="Aviso web" /></TableHead>
                                            <TableHead className="w-40">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {avisos.map((a) => {
                                            const ev = canalesSilenciados(silencios.filter((s) => s.codigo_evento === a.codigo_evento), idUsuario, a.codigo_evento);
                                            const editable = a.motivo !== 'sin_acceso' && a.motivo !== 'fuera_de_la_seleccion_del_rol';
                                            // El canal se ofrece si el aviso lo trae, o si ya está silenciado (en ese caso no sabemos si lo traía y se deja corregir)
                                            const ofrece = (canal: 'email' | 'web') => (a.recibe ? a[canal] || (canal === 'email' ? ev.email : ev.web) : true);
                                            return (
                                                <TableRow key={a.codigo_evento}>
                                                    <TableCell>
                                                        <span className="block font-medium">{a.descripcion || a.codigo_evento}</span>
                                                        <span className="block text-[11px] text-muted-foreground">{a.codigo_evento}</span>
                                                    </TableCell>
                                                    {(['email', 'web'] as const).map((canal) => (
                                                        <TableCell key={canal} className="text-center">
                                                            {ofrece(canal)
                                                                ? <Switch checked={canal === 'email' ? !ev.email && !global.email : !ev.web && !global.web}
                                                                    disabled={!editable || (canal === 'email' ? global.email : global.web)}
                                                                    onCheckedChange={(v) => fijar(a.codigo_evento, canal === 'email' ? !v : ev.email, canal === 'web' ? !v : ev.web)} aria-label={`${canal === 'email' ? 'Correo' : 'Aviso web'}: ${a.descripcion}`} />
                                                                : <span className="text-muted-foreground">—</span>}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell>
                                                        <Estado recibe={a.recibe} motivo={a.motivo} />
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
};

// ── Página ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

export const CorreosAdminPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => (
    <div className="shadcn-scope w-full p-4 md:p-6">
        <PageHeader
            title="Administrador de correos"
            subtitle="Quién recibe cada aviso: por rol, eligiendo personas dentro del rol y apagando el correo o el aviso web de quien no lo quiere."
            onBack={onBack}
            breadcrumbItems={[{ label: 'Admin. Info', onClick: onBack }, { label: 'Informática', onClick: onBack }, { label: 'Administrador de correos' }]}
        />
        <Tabs defaultValue="aviso">
            <TabsList>
                <TabsTrigger value="aviso">Por aviso</TabsTrigger>
                <TabsTrigger value="persona">Por persona</TabsTrigger>
            </TabsList>
            <TabsContent value="aviso" className="mt-4"><PorAviso /></TabsContent>
            <TabsContent value="persona" className="mt-4"><PorPersona /></TabsContent>
        </Tabs>
    </div>
);
