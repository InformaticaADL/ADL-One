import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    IconUsers, IconShieldCheck, IconMail, IconDeviceFloppy, IconUser, IconSearch, IconBolt, IconBell,
    IconCircleCheck, IconAlertCircle, IconX,
} from '@tabler/icons-react';
import { rbacService } from '../../services/rbac.service';
import { notificationService } from '../../../../services/notification.service';
import { useToast } from '../../../../contexts/ToastContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    event: {
        id: number;
        codigo: string;
        descripcion: string;
        es_transaccional?: boolean;
        config?: any[];
    };
    onSaved: () => void;
}

export const RecipientModal: React.FC<Props> = ({ isOpen, onClose, event, onSaved }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    // Catalogos
    const [allRoles, setAllRoles] = useState<any[]>([]);
    const [allUsers, setAllUsers] = useState<any[]>([]);

    // Form State
    const [selectedRoles, setSelectedRoles] = useState<number[]>([]);
    const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
    const [notifyOwner, setNotifyOwner] = useState(false);
    const [ccEmails, setCcEmails] = useState('');
    const [showCc, setShowCc] = useState(false);
    const [channels, setChannels] = useState({ email: true, web: true });

    // Autocomplete State
    const [searchTerm, setSearchTerm] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            loadData();
            processExistingConfig();
            setShowCc(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, event]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const loadData = async () => {
        try {
            const [roles, users] = await Promise.all([
                rbacService.getRoles(),
                rbacService.getUsers()
            ]);
            setAllRoles(roles);
            setAllUsers(users);
        } catch (error) {
            console.error(error);
        }
    };

    const processExistingConfig = () => {
        if (!event.config || event.config.length === 0) {
            setSelectedRoles([]);
            setSelectedUsers([]);
            setNotifyOwner(false);
            setCcEmails('');
            setChannels({ email: false, web: false });
            return;
        }

        const roles: number[] = [];
        const users: number[] = [];
        let owner = false;
        let cc = '';

        // Channels: true if ANY config entry has the channel enabled
        const email = event.config.some(c => !!c.envia_email);
        const web = event.config.some(c => !!c.envia_web);

        event.config.forEach((c) => {
            if (c.id_rol) roles.push(c.id_rol);
            if (c.id_usuario) users.push(c.id_usuario);
            if (c.es_propietario) owner = true;
            // CC: take the first non-empty value (it's the same across all rows)
            if (c.cc_emails && !cc) {
                cc = c.cc_emails;
                setShowCc(true);
            }
        });

        setSelectedRoles([...new Set(roles)]);
        setSelectedUsers([...new Set(users)]);
        setNotifyOwner(owner);
        setCcEmails(cc);
        setChannels({ email, web });
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const configs: any[] = [];

            if (event.es_transaccional) {
                configs.push({ envia_email: channels.email, envia_web: channels.web });
            } else {
                // Recipients: each row carries channels but NOT cc_emails (cc is a single separate entry)
                selectedRoles.forEach(roleId => configs.push({ id_rol: roleId, envia_email: channels.email, envia_web: channels.web }));
                selectedUsers.forEach(userId => configs.push({ id_usuario: userId, envia_email: channels.email, envia_web: channels.web }));
                if (notifyOwner) configs.push({ es_propietario: true, envia_email: channels.email, envia_web: channels.web });
                // CC emails: a single dedicated row so they don't get duplicated per recipient
                if (ccEmails.trim()) configs.push({ cc_emails: ccEmails.trim(), envia_email: true, envia_web: false });
                // Edge case: only CCs configured with no other recipients
                if (configs.length === 0) {
                    showToast({ type: 'warning', message: 'Debe configurar al menos un destinatario o correo CC' });
                    return;
                }
            }

            await notificationService.saveNotificationConfig(event.id, configs);
            showToast({ type: 'success', message: 'Configuración guardada correctamente' });
            onSaved();
            onClose();
        } catch (error) {
            console.error(error);
            showToast({ type: 'error', message: 'Error al guardar configuración' });
        } finally {
            setLoading(false);
        }
    };

    // Derived States for Autocomplete
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        const roleMatches = allRoles.filter(r => r.nombre_rol.toLowerCase().includes(term) && !selectedRoles.includes(r.id_rol)).map(r => ({ type: 'role', id: r.id_rol, label: r.nombre_rol, email: undefined }));
        const userMatches = allUsers.filter(u =>
            (u.nombre_usuario?.toLowerCase().includes(term) || u.correo_electronico?.toLowerCase().includes(term)) && !selectedUsers.includes(u.id_usuario)
        ).map(u => ({ type: 'user', id: u.id_usuario, label: u.nombre_usuario, email: u.correo_electronico }));
        return [...roleMatches, ...userMatches];
    }, [searchTerm, allRoles, allUsers, selectedRoles, selectedUsers]);

    const selectedChips = useMemo(() => {
        const chips: any[] = [];
        selectedRoles.forEach(id => {
            const role = allRoles.find(r => r.id_rol === id);
            if (role) chips.push({ type: 'role', id, label: role.nombre_rol });
        });
        selectedUsers.forEach(id => {
            const user = allUsers.find(u => u.id_usuario === id);
            if (user) chips.push({ type: 'user', id, label: user.nombre_usuario });
        });
        return chips;
    }, [selectedRoles, selectedUsers, allRoles, allUsers]);

    const handleSelectOption = (opt: any) => {
        if (opt.type === 'role') setSelectedRoles(p => [...p, opt.id]);
        else setSelectedUsers(p => [...p, opt.id]);
        setSearchTerm('');
        setShowSuggestions(false);
    };

    const handleRemoveChip = (type: string, id: number) => {
        if (type === 'role') setSelectedRoles(p => p.filter(x => x !== id));
        else setSelectedUsers(p => p.filter(x => x !== id));
    };

    const StepBadge = ({ n }: { n: number }) => (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{n}</span>
    );

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-[950px]">
                <SheetHeader className="flex-row items-start justify-between gap-4 space-y-0 border-b border-border p-6 sm:p-8">
                    <div>
                        <Badge variant="secondary" className="mb-2 font-mono normal-case">{event.codigo}</Badge>
                        <SheetTitle className="text-2xl">Configurar Notificación</SheetTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{event.descripcion}</p>
                    </div>
                </SheetHeader>

                <div className="flex flex-1 flex-col overflow-hidden bg-muted/30 lg:flex-row">
                    {/* Columna izquierda: configuración */}
                    <div className="flex-1 overflow-y-auto border-b border-border p-6 lg:border-b-0 lg:border-r lg:p-8">
                        {/* 1. Canales */}
                        <div className="mb-8">
                            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
                                <StepBadge n={1} /> ¿Por qué canales enviamos?
                            </h3>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {(['email', 'web'] as const).map((ch) => {
                                    const active = channels[ch];
                                    const Icon = ch === 'email' ? IconMail : IconBell;
                                    return (
                                        <button
                                            key={ch}
                                            type="button"
                                            onClick={() => setChannels((p) => ({ ...p, [ch]: !p[ch] }))}
                                            className={cn(
                                                'flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors',
                                                active ? 'border-primary bg-primary/5' : 'border-border bg-card'
                                            )}
                                        >
                                            <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground')}>
                                                <Icon size={22} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-foreground">{ch === 'email' ? 'Correo Electrónico' : 'Campanita App'}</div>
                                                <div className="text-xs text-muted-foreground">{ch === 'email' ? 'A la bandeja de entrada' : 'Notificación dentro de URS'}</div>
                                            </div>
                                            <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2', active ? 'border-primary bg-primary' : 'border-border')}>
                                                {active && <IconCircleCheck size={14} className="text-primary-foreground" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. Destinatarios */}
                        <div>
                            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
                                <StepBadge n={2} /> ¿A quién le notificamos?
                            </h3>

                            {event.es_transaccional ? (
                                <div className="flex gap-4 rounded-xl border border-primary/30 bg-card p-6 shadow-sm">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <IconBolt size={22} />
                                    </div>
                                    <div>
                                        <h4 className="mb-1.5 text-sm font-bold text-foreground">Evento Transaccional Dinámico</h4>
                                        <p className="text-sm leading-relaxed text-muted-foreground">
                                            Este es un evento "Maestro". No necesitas asignar usuarios manualmente. El sistema detectará en el momento exacto a quién debe avisar (Ej: Al responsable actual o al creador).
                                            <br /><br />
                                            <strong className="text-foreground">Tu configuración queda lista definiendo únicamente los Canales en el Paso 1.</strong>
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-4">
                                    {/* Buscador de roles/usuarios */}
                                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                                        <label className="mb-2 block text-sm font-bold text-foreground">
                                            Buscar Roles o Usuarios Específicos
                                        </label>

                                        <div ref={wrapperRef} className="relative">
                                            <div className="relative">
                                                <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                                <Input
                                                    value={searchTerm}
                                                    onChange={(e) => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                                                    onFocus={() => setShowSuggestions(true)}
                                                    placeholder="Ej: Administrador, Operador, Juan Perez..."
                                                    className="pl-9"
                                                />
                                            </div>

                                            {showSuggestions && searchTerm && (
                                                <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-[250px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                                                    {filteredOptions.length === 0 ? (
                                                        <div className="p-4 text-center text-sm text-muted-foreground">No se encontraron coincidencias</div>
                                                    ) : (
                                                        filteredOptions.map((opt) => (
                                                            <button
                                                                key={`${opt.type}-${opt.id}`}
                                                                type="button"
                                                                onClick={() => handleSelectOption(opt)}
                                                                className="flex w-full items-center gap-2.5 border-b border-border px-4 py-2.5 text-left last:border-0 hover:bg-muted"
                                                            >
                                                                {opt.type === 'role' ? <IconUsers size={16} className="text-primary" /> : <IconUser size={16} className="text-[#7e22ce]" />}
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-sm font-semibold text-foreground">{opt.label}</div>
                                                                    <div className="truncate text-xs text-muted-foreground">{opt.type === 'role' ? 'Rol General' : opt.email || 'Usuario'}</div>
                                                                </div>
                                                            </button>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {selectedChips.length > 0 && (
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {selectedChips.map((chip) => (
                                                    <Badge
                                                        key={`${chip.type}-${chip.id}`}
                                                        variant="outline"
                                                        className={cn('gap-1.5 py-1 pl-2 pr-1.5 font-normal normal-case', chip.type === 'role' ? 'border-primary/30 text-primary' : 'border-[#e9d5ff] text-[#7e22ce]')}
                                                    >
                                                        {chip.type === 'role' ? <IconUsers size={12} /> : <IconUser size={12} />}
                                                        {chip.label}
                                                        <button type="button" onClick={() => handleRemoveChip(chip.type, chip.id)} className="ml-0.5 rounded-full hover:bg-foreground/10">
                                                            <IconX size={12} />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Propietario */}
                                    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                                                <IconShieldCheck size={18} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-foreground">Propietario del Registro</div>
                                                <div className="text-xs text-muted-foreground">Avisar siempre a quien creó o es dueño de la data.</div>
                                            </div>
                                        </div>
                                        <Switch checked={notifyOwner} onCheckedChange={setNotifyOwner} />
                                    </label>

                                    {/* CC */}
                                    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                                        <button
                                            type="button"
                                            onClick={() => setShowCc(!showCc)}
                                            className={cn('flex w-full items-center justify-between px-5 py-4', showCc && 'bg-muted/50')}
                                        >
                                            <span className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                                                <IconMail size={18} className="text-warning" /> Copias Externas (CC)
                                            </span>
                                            <span className="text-xs font-semibold text-primary">{showCc ? 'Cerrar' : '+ Añadir Correos'}</span>
                                        </button>
                                        {showCc && (
                                            <div className="border-t border-border p-5 pt-4">
                                                <Textarea
                                                    placeholder="ej: gerencia@empresa.com, auditor@gmail.com"
                                                    value={ccEmails}
                                                    onChange={(e) => setCcEmails(e.target.value)}
                                                    className="min-h-20"
                                                />
                                                <p className="mt-2 text-xs text-muted-foreground">Separa direcciones con comas. Solo por Email.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Columna derecha: resumen en vivo */}
                    <div className="flex flex-col bg-card lg:w-[340px] lg:shrink-0">
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                            <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-foreground">
                                <IconCircleCheck size={18} className="text-success" /> Resumen en Vivo
                            </h3>

                            <div className="rounded-xl border border-dashed border-border p-5">
                                <div className="mb-5">
                                    <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Se enviará por:</div>
                                    <div className="flex flex-wrap gap-1.5">
                                        {channels.email && <Badge className="gap-1 normal-case"><IconMail size={12} /> EMAIL</Badge>}
                                        {channels.web && <Badge variant="warning" className="gap-1 normal-case"><IconBell size={12} /> APP WEB</Badge>}
                                        {!channels.email && !channels.web && <span className="text-xs font-semibold text-destructive">Ningún canal activo</span>}
                                    </div>
                                </div>

                                <div>
                                    <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Destinatarios:</div>

                                    {event.es_transaccional ? (
                                        <div className="flex items-center gap-2 rounded-md border border-border bg-background p-2 text-sm text-foreground">
                                            <IconBolt size={14} className="text-primary" /> Resueltos automáticamente
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3">
                                            {notifyOwner && (
                                                <div className="flex items-start gap-2">
                                                    <IconShieldCheck size={14} className="mt-0.5 shrink-0 text-success" />
                                                    <span className="text-sm font-semibold text-foreground">Propietario del Registro</span>
                                                </div>
                                            )}

                                            {selectedRoles.length > 0 && (
                                                <div className="flex items-start gap-2">
                                                    <IconUsers size={14} className="mt-0.5 shrink-0 text-primary" />
                                                    <div className="min-w-0">
                                                        <span className="block text-sm font-semibold text-foreground">Roles</span>
                                                        <div className="text-xs text-muted-foreground">{selectedChips.filter(c => c.type === 'role').map(c => c.label).join(', ')}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {selectedUsers.length > 0 && (
                                                <div className="flex items-start gap-2">
                                                    <IconUser size={14} className="mt-0.5 shrink-0 text-[#7e22ce]" />
                                                    <div className="min-w-0">
                                                        <span className="block text-sm font-semibold text-foreground">Usuarios Específicos</span>
                                                        <div className="text-xs text-muted-foreground">{selectedChips.filter(c => c.type === 'user').map(c => c.label).join(', ')}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {ccEmails && (
                                                <div className="flex items-start gap-2">
                                                    <IconMail size={14} className="mt-0.5 shrink-0 text-warning" />
                                                    <div className="min-w-0">
                                                        <span className="block text-sm font-semibold text-foreground">Copia (CC)</span>
                                                        <div className="break-all text-xs text-muted-foreground">{ccEmails.substring(0, 30)}{ccEmails.length > 30 ? '...' : ''}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {!notifyOwner && selectedRoles.length === 0 && selectedUsers.length === 0 && !ccEmails && (
                                                <div className="flex items-start gap-2 text-destructive">
                                                    <IconAlertCircle size={14} className="mt-0.5 shrink-0" />
                                                    <span className="text-sm font-semibold">No hay destinatarios configurados. La alerta no será enviada a nadie.</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-border p-6">
                            <Button onClick={handleSave} disabled={loading} size="lg">
                                {loading ? (
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                ) : (
                                    <IconDeviceFloppy size={18} />
                                )}
                                {loading ? 'Procesando...' : 'CONFIRMAR Y GUARDAR'}
                            </Button>
                            <Button variant="outline" onClick={onClose} disabled={loading}>
                                Cancelar Cambios
                            </Button>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};
