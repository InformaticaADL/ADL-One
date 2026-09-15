import React, { useState, useEffect, useMemo } from 'react';
import {
    IconUserPlus,
    IconUsers,
    IconMail,
    IconBell,
    IconTrash,
    IconSearch,
    IconInfoCircle,
    IconUser,
    IconBriefcase
} from '@tabler/icons-react';
import { notificationService } from '../../../services/notification.service';
import { rbacService } from '../services/rbac.service';
import type { Role, User } from '../services/rbac.service';
import { useToast } from '../../../contexts/ToastContext';
import { PageHeader } from '../../../components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox } from '@/components/ui/combobox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface NotificationEvent {
    id_evento: number;
    codigo_evento: string;
    descripcion: string;
    asunto_template: string;
    modulo?: string;
}

interface Recipient {
    id_relacion: number;
    id_usuario?: number;
    id_rol?: number;
    nombre_usuario?: string;
    nombre_rol?: string;
    tipo_envio: string;
    envia_email?: boolean;
    envia_web?: boolean;
    area_destino?: string;
}

interface Props {
    event: NotificationEvent;
    onBack: () => void;
}

const ADD_TYPE_OPTIONS = [
    { value: 'ROLE', label: 'Rol (Grupo)' },
    { value: 'USER', label: 'Usuario Individual' }
];

const SEND_TYPE_OPTIONS = [
    { value: 'TO', label: 'Para (TO)' },
    { value: 'CC', label: 'Copia (CC)' },
    { value: 'BCC', label: 'Copia Oculta (BCC)' }
];

export const NotificationRecipientsPage: React.FC<Props> = ({ event, onBack }) => {
    const { showToast } = useToast();
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Catalogs
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);

    // Selection state
    const [addType, setAddType] = useState<string>('ROLE');
    const [sendType, setSendType] = useState<string>('TO');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());

    // UNS Rule Configuration
    const [enviaWeb, setEnviaWeb] = useState(false);
    const [enviaEmail, setEnviaEmail] = useState(true);
    const [areaDestino, setAreaDestino] = useState('');

    // Modal state
    const [membersModalOpened, setMembersModalOpened] = useState(false);
    const [modalRoleId, setModalRoleId] = useState<number | null>(null);
    const [modalRoleMembers, setModalRoleMembers] = useState<User[]>([]);
    const [membersLoading, setMembersLoading] = useState(false);

    // Confirm modal state
    const [deleteModalOpened, setDeleteModalOpened] = useState(false);
    const [recipientToDelete, setRecipientToDelete] = useState<number | null>(null);

    useEffect(() => {
        loadCatalogs();
        loadRecipients(event.id_evento);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event]);

    // Reset selections when changing type
    useEffect(() => {
        setSelectedItems(new Set());
        setSearchTerm('');
    }, [addType]);

    const loadCatalogs = async () => {
        try {
            const [u, r] = await Promise.all([rbacService.getUsers(), rbacService.getRoles()]);
            setUsers(u);
            setRoles(r);
        } catch (error) {
            console.error(error);
        }
    };

    const loadRecipients = async (eventId: number) => {
        try {
            setLoading(true);
            const data = await notificationService.getRecipients(eventId);
            setRecipients(data);
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar destinatarios" });
        } finally {
            setLoading(false);
        }
    };

    const handleViewRoleMembers = async (roleId: number) => {
        try {
            setModalRoleId(roleId);
            setMembersLoading(true);
            setMembersModalOpened(true);
            const members = await rbacService.getUsersByRole(roleId);
            setModalRoleMembers(members);
        } catch (error) {
            showToast({ type: 'error', message: "Error al cargar usuarios del rol" });
            setMembersModalOpened(false);
        } finally {
            setMembersLoading(false);
        }
    };

    const handleToggleItem = (id: number) => {
        const newSet = new Set(selectedItems);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedItems(newSet);
    };

    const handleAddSelected = async () => {
        if (selectedItems.size === 0) {
            return showToast({ type: 'error', message: "Seleccione al menos un elemento" });
        }

        try {
            setActionLoading(true);
            const promises = Array.from(selectedItems).map(id => {
                const payload = {
                    idUsuario: addType === 'USER' ? id : undefined,
                    idRol: addType === 'ROLE' ? id : undefined,
                    tipoEnvio: sendType,
                    enviaWeb,
                    enviaEmail,
                    areaDestino
                };
                return notificationService.addRecipient(event.id_evento, payload);
            });

            await Promise.all(promises);
            showToast({ type: 'success', message: `${selectedItems.size} regla(s) configurada(s)` });
            loadRecipients(event.id_evento);
            setSelectedItems(new Set());
        } catch (error: any) {
            const msg = error.response?.data?.message || "Error al agregar";
            showToast({ type: 'error', message: msg });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRemove = (id: number) => {
        setRecipientToDelete(id);
        setDeleteModalOpened(true);
    };

    const confirmDelete = async () => {
        if (!recipientToDelete) return;
        try {
            setActionLoading(true);
            await notificationService.removeRecipient(recipientToDelete);
            showToast({ type: 'success', message: "Eliminado correctamente" });
            loadRecipients(event.id_evento);
        } catch (error) {
            showToast({ type: 'error', message: "Error al eliminar" });
        } finally {
            setActionLoading(false);
            setDeleteModalOpened(false);
            setRecipientToDelete(null);
        }
    };

    const filteredItems = useMemo(() => {
        if (addType === 'ROLE') {
            return roles.filter(r => r.nombre_rol.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return users.filter(u =>
            u.nombre_usuario.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.nombre_real.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.correo_electronico && u.correo_electronico.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [addType, searchTerm, roles, users]);

    const selectedRole = roles.find(r => r.id_rol === modalRoleId);

    return (
        <div className="shadcn-scope w-full p-4 md:p-6">
            <PageHeader
                title="Configuración de Destinatarios"
                subtitle={`Evento: ${event.codigo_evento} - ${event.descripcion}`}
                onBack={onBack}
                breadcrumbItems={[
                    { label: 'Administración', onClick: onBack },
                    { label: 'Notificaciones', onClick: onBack },
                    { label: 'Destinatarios' }
                ]}
            />

            <div className="mt-8 grid items-start gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
                <Card className="p-6">
                    <div className="mb-4 flex items-center gap-2">
                        <IconUserPlus size={20} className="text-primary" />
                        <p className="text-sm font-semibold text-foreground">Agregar Destinatarios</p>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-2">
                            <Field label="Tipo Destinatario">
                                <Combobox
                                    value={addType}
                                    onValueChange={(val) => setAddType(val || 'ROLE')}
                                    options={ADD_TYPE_OPTIONS}
                                />
                            </Field>
                            <Field label="Modo de Envío">
                                <Combobox
                                    value={sendType}
                                    onValueChange={(val) => setSendType(val || 'TO')}
                                    disabled={!enviaEmail}
                                    options={SEND_TYPE_OPTIONS}
                                />
                            </Field>
                        </div>

                        <div className="grid grid-cols-2 items-end gap-4">
                            <div>
                                <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Canales Habilitados</p>
                                <div className="flex gap-4">
                                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                                        <Checkbox checked={enviaEmail} onCheckedChange={(v) => setEnviaEmail(v === true)} />
                                        Email
                                    </label>
                                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                                        <Checkbox checked={enviaWeb} onCheckedChange={(v) => setEnviaWeb(v === true)} />
                                        Web
                                    </label>
                                </div>
                            </div>
                            <Field label="Área Destino (Opcional)">
                                <Input
                                    placeholder="Ej: Lab, Bioq..."
                                    value={areaDestino}
                                    onChange={(e) => setAreaDestino(e.target.value)}
                                />
                            </Field>
                        </div>

                        {enviaWeb && (
                            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                                <IconInfoCircle size={16} className="mt-0.5 shrink-0" />
                                El sistema generará notificaciones automáticas en la campanita para este evento.
                            </div>
                        )}

                        <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border" />
                            <p className="text-xs font-medium text-muted-foreground">Selección de elementos</p>
                            <div className="h-px flex-1 bg-border" />
                        </div>

                        <div className="relative">
                            <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                placeholder={`Buscar ${addType === 'ROLE' ? 'rol' : 'usuario'}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        <div className="h-[300px] overflow-y-auto rounded-md border border-border p-2">
                            <div className="flex flex-col gap-1">
                                {filteredItems.map(item => {
                                    const id = addType === 'ROLE' ? (item as Role).id_rol : (item as User).id_usuario;
                                    const isSelected = selectedItems.has(id);
                                    const name = addType === 'ROLE' ? (item as Role).nombre_rol : (item as User).nombre_usuario;
                                    const sub = addType === 'USER' ? (item as User).correo_electronico : null;

                                    return (
                                        <div
                                            key={id}
                                            onClick={() => handleToggleItem(id)}
                                            className={cn(
                                                'flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors',
                                                isSelected ? 'bg-accent' : 'hover:bg-muted'
                                            )}
                                        >
                                            <Checkbox checked={isSelected} onCheckedChange={() => handleToggleItem(id)} />
                                            <div className="flex-1">
                                                <p className={cn('text-sm', isSelected ? 'font-semibold text-foreground' : 'text-foreground')}>{name}</p>
                                                {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
                                            </div>
                                            {addType === 'ROLE' && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Ver miembros del rol"
                                                    onClick={(e) => { e.stopPropagation(); handleViewRoleMembers(id); }}
                                                >
                                                    <IconUsers size={16} />
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                                {filteredItems.length === 0 && (
                                    <p className="py-8 text-center text-sm text-muted-foreground">No se encontraron resultados</p>
                                )}
                            </div>
                        </div>

                        <Button
                            onClick={handleAddSelected}
                            disabled={selectedItems.size === 0 || actionLoading}
                            className="w-full"
                        >
                            {actionLoading ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            ) : (
                                <IconUserPlus size={18} />
                            )}
                            Vincular Seleccionados ({selectedItems.size})
                        </Button>
                    </div>
                </Card>

                <Card className="p-6">
                    <div className="mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <IconUsers size={20} className="text-primary" />
                            <p className="text-sm font-semibold text-foreground">Destinatarios Configurados</p>
                        </div>
                        <Badge variant="outline">{recipients.length} reglas</Badge>
                    </div>

                    {loading ? (
                        <div className="flex h-[400px] items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : recipients.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-16">
                            <IconUsers size={40} className="text-border" />
                            <p className="text-sm text-muted-foreground">Sin destinatarios configurados</p>
                        </div>
                    ) : (
                        <div className="max-h-[600px] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Destinatario</TableHead>
                                        <TableHead>Canales</TableHead>
                                        <TableHead className="w-[50px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recipients.map(rec => (
                                        <TableRow key={rec.id_relacion}>
                                            <TableCell>
                                                <Badge variant="outline" className="gap-1">
                                                    {rec.id_rol ? <IconBriefcase size={10} /> : <IconUser size={10} />}
                                                    {rec.id_rol ? 'ROL' : 'USR'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <p className="text-sm font-semibold text-foreground">{rec.nombre_rol || rec.nombre_usuario}</p>
                                                {rec.area_destino && <p className="text-xs text-muted-foreground">Área: {rec.area_destino}</p>}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex gap-1">
                                                    {rec.envia_email && (
                                                        <Badge variant="outline" className="gap-1" title={`Modo: ${rec.tipo_envio}`}>
                                                            <IconMail size={10} /> {rec.tipo_envio}
                                                        </Badge>
                                                    )}
                                                    {rec.envia_web && (
                                                        <Badge variant="outline" className="gap-1">
                                                            <IconBell size={10} /> WEB
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    title="Eliminar"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleRemove(rec.id_relacion)}
                                                >
                                                    <IconTrash size={16} />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Card>
            </div>

            {/* Modal: Role Members */}
            <Dialog open={membersModalOpened} onOpenChange={setMembersModalOpened}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <IconUsers size={20} />
                            Usuarios del Rol: {selectedRole?.nombre_rol}
                        </DialogTitle>
                    </DialogHeader>
                    {membersLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                                {modalRoleMembers.length} usuario(s) activo(s) recibirán notificaciones a través de este rol.
                            </div>
                            <div className="max-h-[400px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Usuario</TableHead>
                                            <TableHead>Correo</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {modalRoleMembers.map(member => (
                                            <TableRow key={member.id_usuario}>
                                                <TableCell>
                                                    <p className="text-sm font-semibold text-foreground">{member.nombre_usuario}</p>
                                                    <p className="text-xs text-muted-foreground">{member.nombre_real}</p>
                                                </TableCell>
                                                <TableCell className="text-sm">{member.correo_electronico || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {modalRoleMembers.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} className="py-8 text-center text-sm text-muted-foreground">
                                                    Este rol no tiene usuarios asignados actualmente.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal: Confirm Delete */}
            <Dialog open={deleteModalOpened} onOpenChange={setDeleteModalOpened}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar eliminación</DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        ¿Está seguro que desea eliminar este destinatario? Esta regla de notificación dejará de aplicarse inmediatamente.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteModalOpened(false)}>Cancelar</Button>
                        <Button variant="destructive" disabled={actionLoading} onClick={confirmDelete}>
                            {actionLoading ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : null}
                            Eliminar regla
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="mb-1 text-xs text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}
