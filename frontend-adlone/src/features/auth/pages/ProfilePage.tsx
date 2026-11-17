import React from 'react';
import { IconUser, IconMail, IconShieldCheck, IconId, IconUserCircle, IconCamera, IconBriefcase, IconLock, IconMessageCircle, IconTrash, IconEye, IconEyeOff, IconUserCog, IconTool, IconPalette, IconBell, IconSun, IconMoon, IconHelp } from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { generalChatService } from '../../../services/general-chat.service';
import type { UserProfile } from '../../../services/general-chat.service';
import axios from 'axios';
import API_CONFIG from '../../../config/api.config';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useThemeStore } from '../../../store/themeStore';
import { useNavStore } from '../../../store/navStore';
import { AyudaContenido } from '../../../components/common/HelpCenter';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FirmaPerfilCard } from '../components/FirmaPerfilCard';

interface ProfilePageProps {
    userId?: number;
    onStartChat?: (userId: number) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ userId, onStartChat }) => {
    const { user, updateUser, token } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [opened, setOpened] = React.useState(false);
    // Configuración (mi propio perfil): sección activa y preferencias locales
    const [seccion, setSeccion] = React.useState<'perfil' | 'cuenta' | 'apariencia' | 'notificaciones' | 'ayuda'>('perfil');
    // Al venir de «Ayuda» (botón Información) o de «Configuración» (menú del perfil) se abre la sección pedida.
    const perfilSeccionPedida = useNavStore((st) => st.perfilSeccion);
    const clearPerfilSeccion = useNavStore((st) => st.clearPerfilSeccion);
    React.useEffect(() => {
        if (perfilSeccionPedida) { setSeccion(perfilSeccionPedida); clearPerfilSeccion(); }
    }, [perfilSeccionPedida, clearPerfilSeccion]);
    const { mode: modoTema, setMode: setModoTema } = useThemeStore();
    const setPageBreadcrumb = useNavStore((st) => st.setPageBreadcrumb);
    // Ruta: Inicio / Configuración / <sección>  (solo en mi propio perfil)
    React.useEffect(() => {
        if (userId && userId !== user?.id) return;
        const titulos = { perfil: 'Perfil', cuenta: 'Cuenta', apariencia: 'Apariencia', notificaciones: 'Notificaciones', ayuda: 'Ayuda' } as const;
        setPageBreadcrumb([{ label: 'Configuración', onClick: () => setSeccion('perfil') }, { label: titulos[seccion] }]);
        return () => setPageBreadcrumb([]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seccion]);
    const [avisoEmergente, setAvisoEmergente] = React.useState(() => localStorage.getItem('adl-pref-aviso-emergente') !== 'no');
    const cambiarAvisoEmergente = (v: boolean) => { setAvisoEmergente(v); localStorage.setItem('adl-pref-aviso-emergente', v ? 'si' : 'no'); };
    const [passwordOpened, setPasswordOpened] = React.useState(false);
    const isMobile = useMediaQuery('(max-width: 768px)');

    // Password change form state
    const [currentPassword, setCurrentPassword] = React.useState('');
    const [newPassword, setNewPassword] = React.useState('');
    const [confirmPassword, setConfirmPassword] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [profileData, setProfileData] = React.useState<UserProfile | null>(null);
    const [loadingProfile, setLoadingProfile] = React.useState(false);

    const isOwnProfile = !userId || userId === user?.id;

    React.useEffect(() => {
        if (!isOwnProfile && userId) {
            loadUserProfile(userId);
        } else if (user) {
            // Map auth user to profile structure
            setProfileData({
                id_entidad: user.id,
                id_usuario: user.id,
                nombre: user.name,
                nombre_usuario: user.username,
                email: user.email || '',
                cargo: user.cargo || '',
                tipo_entidad: 'USER',
                roles: user.roles?.join(', ') || (user.role === 1 ? 'Administrador' : user.role === 2 ? 'Usuario Estándar' : 'Otro'),
                foto: user.foto || null
            });
        }
    }, [userId, user, isOwnProfile]);

    const loadUserProfile = async (id: number) => {
        setLoadingProfile(true);
        try {
            const data = await generalChatService.getUserProfile(id);
            setProfileData(data);
        } catch (err) {
            console.error('Error loading profile:', err);
            showToast({ message: 'Error cargando perfil', type: 'error' });
        } finally {
            setLoadingProfile(false);
        }
    };

    if (!user || (!profileData && !loadingProfile)) return null;

    const predefinedAvatars = [
        { id: 1, path: '/uploads/avatars/avatar1.png' },
        { id: 2, path: '/uploads/avatars/avatar2.png' },
        { id: 3, path: '/uploads/avatars/avatar3.png' },
        { id: 4, path: '/uploads/avatars/avatar4.png' },
        { id: 5, path: '/uploads/avatars/avatar5.png' },
        { id: 6, path: '/uploads/avatars/avatar6.png' },
    ];

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            showToast({
                message: 'Las contraseñas nuevas no coinciden',
                type: 'error'
            });
            return;
        }

        if (newPassword.length < 4) {
            showToast({
                message: 'La nueva contraseña debe tener al menos 4 caracteres',
                type: 'error'
            });
            return;
        }

        if (newPassword === currentPassword) {
            showToast({
                message: 'La nueva contraseña no puede ser igual a la actual',
                type: 'error'
            });
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/users/change-password`, {
                currentPassword,
                newPassword
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                showToast({
                    message: 'Contraseña actualizada correctamente',
                    type: 'success'
                });
                setPasswordOpened(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            }
        } catch (error: any) {
            console.error('Error changing password:', error);
            showToast({
                message: error.response?.data?.message || 'Error al cambiar la contraseña',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarClick = () => {
        setOpened(true);
    };

    const handleSelectPredefined = async (avatarPath: string | null) => {
        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/users/avatar`, { avatarPath }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                updateUser({ foto: avatarPath ?? undefined });
                showToast({
                    message: 'Avatar actualizado correctamente',
                    type: 'success'
                });
                setOpened(false);
            }
        } catch (error) {
            console.error('Error setting predefined avatar:', error);
            showToast({
                message: 'No se pudo actualizar el avatar',
                type: 'error'
            });
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (!file.type.startsWith('image/')) {
            showToast({
                message: 'Por favor seleccione una imagen válida',
                type: 'error'
            });
            return;
        }

        const formData = new FormData();
        formData.append('photo', file);

        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/users/profile-picture`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                const newFoto = response.data.data.foto;
                updateUser({ foto: newFoto });
                showToast({
                    message: 'Foto de perfil actualizada correctamente',
                    type: 'success'
                });
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            showToast({
                message: 'No se pudo subir la foto de perfil',
                type: 'error'
            });
        }
    };

    const getStrength = (password: string) => {
        if (password.length === 0) return { value: 0, color: 'bg-muted', label: '' };
        if (password.length < 4) return { value: 15, color: 'bg-destructive', label: 'Muy corta' };

        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;

        if (strength <= 25) return { value: 35, color: 'bg-warning', label: 'Débil' };
        if (strength <= 50) return { value: 65, color: 'bg-primary', label: 'Media' };
        if (strength <= 75) return { value: 85, color: 'bg-primary', label: 'Buena' };
        return { value: 100, color: 'bg-success', label: 'Excelente' };
    };

    const strength = getStrength(newPassword);
    const passwordsMatch = newPassword && confirmPassword ? newPassword === confirmPassword : null;

    const profilePicUrl = profileData?.foto ? `${API_CONFIG.getBaseURL()}${profileData.foto}` : null;

    if (loadingProfile) {
        return (
            <div className="shadcn-scope flex h-[400px] w-full items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="shadcn-scope w-full max-w-full p-4">
            {isOwnProfile ? (
                <div className="flex flex-col">
                    <div className="space-y-0.5">
                        <h1 className="m-0 text-2xl font-bold tracking-tight md:text-3xl">Configuración</h1>
                        <p className="m-0 text-muted-foreground">Administra tu perfil y tu cuenta, y elige cómo ves ADL ONE.</p>
                    </div>
                    <Separator className="my-4 lg:my-6" />
                    <div className="flex flex-1 flex-col space-y-2 lg:flex-row lg:space-x-12 lg:space-y-0">
                        <aside className="top-0 lg:sticky lg:w-1/5">
                            <nav className="flex space-x-2 overflow-x-auto py-1 lg:flex-col lg:space-x-0 lg:space-y-1">
                                {([
                                    { id: 'perfil', titulo: 'Perfil', icono: <IconUserCog size={18} /> },
                                    { id: 'cuenta', titulo: 'Cuenta', icono: <IconTool size={18} /> },
                                    { id: 'apariencia', titulo: 'Apariencia', icono: <IconPalette size={18} /> },
                                    { id: 'notificaciones', titulo: 'Notificaciones', icono: <IconBell size={18} /> },
                                    { id: 'ayuda', titulo: 'Ayuda', icono: <IconHelp size={18} /> },
                                ] as const).map((it) => (
                                    <button
                                        key={it.id}
                                        type="button"
                                        onClick={() => setSeccion(it.id)}
                                        aria-current={seccion === it.id ? 'page' : undefined}
                                        className={cn(buttonVariants({ variant: 'ghost' }), seccion === it.id ? 'bg-muted hover:bg-accent' : 'hover:bg-accent hover:underline', 'justify-start')}
                                    >
                                        <span className="me-2">{it.icono}</span>{it.titulo}
                                    </button>
                                ))}
                            </nav>
                        </aside>

                        <div className="flex w-full p-1">
                            <div className="flex flex-1 flex-col">
                                {(() => {
                                    const info = {
                                        perfil: { t: 'Perfil', d: 'Así te ven los demás en ADL ONE.' },
                                        cuenta: { t: 'Cuenta', d: 'Tu acceso y tus roles en el sistema.' },
                                        apariencia: { t: 'Apariencia', d: 'Elige el tema de la aplicación.' },
                                        notificaciones: { t: 'Notificaciones', d: 'Cómo quieres que te avisemos.' },
                                        ayuda: { t: 'Ayuda', d: 'Cómo se usa ADL ONE y a quién pedir ayuda.' },
                                    }[seccion];
                                    return (
                                        <div className="flex-none">
                                            <h3 className="m-0 text-lg font-medium">{info.t}</h3>
                                            <p className="m-0 text-sm text-muted-foreground">{info.d}</p>
                                        </div>
                                    );
                                })()}
                                <Separator className="my-4 flex-none" />
                                <div className={cn('w-full pb-12', seccion === 'ayuda' ? 'lg:max-w-3xl' : 'lg:max-w-xl')}>
                                    {seccion === 'perfil' && (
                                        <div className="flex flex-col gap-6">
                                            <div className="flex items-center gap-4">
                                                <div className="relative">
                                                    <Avatar onClick={handleAvatarClick} className="h-20 w-20 cursor-pointer border-2 border-border bg-primary text-2xl font-bold text-primary-foreground">
                                                        {profilePicUrl && <AvatarImage src={profilePicUrl} />}
                                                        <AvatarFallback className="bg-primary text-primary-foreground">{profileData?.nombre?.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <button type="button" onClick={handleAvatarClick} aria-label="Cambiar foto" className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                                                        <IconCamera size={14} />
                                                    </button>
                                                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="m-0 truncate text-lg font-semibold">{profileData?.nombre}</p>
                                                    {profileData?.nombre_usuario && <p className="m-0 text-sm text-muted-foreground">@{profileData.nombre_usuario}</p>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-4">
                                                <ProfileRow icon={<IconUser size={16} />} label="Nombre completo" value={profileData?.nombre} isMobile={isMobile} />
                                                <hr className="border-t border-dotted border-border" />
                                                <ProfileRow icon={<IconMail size={16} />} label="Correo electrónico" value={profileData?.email || 'No especificado'} isMobile={isMobile} breakAll />
                                                <hr className="border-t border-dotted border-border" />
                                                <ProfileRow icon={<IconUserCircle size={16} />} label="Nombre de usuario" value={profileData?.nombre_usuario || 'No especificado'} isMobile={isMobile} />
                                                <hr className="border-t border-dotted border-border" />
                                                <ProfileRow icon={<IconBriefcase size={16} />} label="Cargo" value={profileData?.cargo || 'No especificado'} isMobile={isMobile} />
                                            </div>
                                            <Separator />
                                            <FirmaPerfilCard />
                                        </div>
                                    )}

                                    {seccion === 'cuenta' && (
                                        <div className="flex flex-col gap-6">
                                            <div>
                                                <p className="mb-2 text-sm font-medium">Contraseña</p>
                                                <p className="mb-3 mt-0 text-sm text-muted-foreground">Cámbiala si crees que otra persona la conoce.</p>
                                                <Button variant="outline" onClick={() => setPasswordOpened(true)}><IconLock size={16} /> Cambiar contraseña</Button>
                                            </div>
                                            <Separator />
                                            <div>
                                                <p className="mb-2 text-sm font-medium">Roles asignados</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {profileData?.roles?.split(', ').map((role: string, idx: number) => <Badge key={idx}>{role}</Badge>)}
                                                </div>
                                                <p className="mb-0 mt-2 text-xs text-muted-foreground">Los roles los define el administrador; determinan qué ves en el menú.</p>
                                            </div>
                                            <Separator />
                                            <div>
                                                <p className="mb-1 text-sm font-medium">ID de usuario</p>
                                                <p className="m-0 text-sm text-muted-foreground">#{profileData?.id_usuario}</p>
                                            </div>
                                        </div>
                                    )}

                                    {seccion === 'apariencia' && (
                                        <div className="flex flex-col gap-4">
                                            <div>
                                                <p className="mb-1 text-sm font-medium">Tema</p>
                                                <p className="m-0 text-sm text-muted-foreground">Elige entre el tema claro y el oscuro.</p>
                                            </div>
                                            <div className="grid max-w-md grid-cols-2 gap-6 pt-2">
                                                {([{ id: 'light', titulo: 'Claro', icono: <IconSun size={16} />, fondo: 'bg-[#ecedef]', barra: 'bg-white', linea: 'bg-[#ecedef]' },
                                                   { id: 'dark', titulo: 'Oscuro', icono: <IconMoon size={16} />, fondo: 'bg-slate-950', barra: 'bg-slate-800', linea: 'bg-slate-400' }] as const).map((t) => (
                                                    <button key={t.id} type="button" onClick={() => setModoTema(t.id)} aria-pressed={modoTema === t.id} className="text-left">
                                                        <div className={cn('items-center rounded-md border-2 p-1', modoTema === t.id ? 'border-primary' : 'border-muted hover:border-accent')}>
                                                            <div className={cn('space-y-2 rounded-sm p-2', t.fondo)}>
                                                                <div className={cn('space-y-2 rounded-md p-2 shadow-xs', t.barra)}>
                                                                    <div className={cn('h-2 w-[80px] rounded-lg', t.linea)} />
                                                                    <div className={cn('h-2 w-[100px] rounded-lg', t.linea)} />
                                                                </div>
                                                                <div className={cn('flex items-center space-x-2 rounded-md p-2 shadow-xs', t.barra)}>
                                                                    <div className={cn('h-4 w-4 rounded-full', t.linea)} />
                                                                    <div className={cn('h-2 w-[100px] rounded-lg', t.linea)} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <span className="mt-2 flex items-center justify-center gap-1.5 text-sm font-normal">{t.icono}{t.titulo}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {seccion === 'ayuda' && <AyudaContenido />}

                                    {seccion === 'notificaciones' && (
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                                                <div>
                                                    <p className="m-0 text-sm font-medium">Aviso emergente</p>
                                                    <p className="m-0 text-xs text-muted-foreground">Muestra un globo junto a la campana cuando llega una notificación nueva.</p>
                                                </div>
                                                <Switch checked={avisoEmergente} onCheckedChange={cambiarAvisoEmergente} aria-label="Aviso emergente de notificaciones" />
                                            </div>
                                            <p className="m-0 text-xs text-muted-foreground">Esta preferencia se guarda solo en este navegador. Las notificaciones siempre quedan disponibles en la campana.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
            <div className="flex flex-col gap-6">
                <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-6">
                    <div className={cn('relative z-10 flex items-center gap-6 text-center', isMobile ? 'flex-col' : 'flex-row')}>
                        <div className="relative">
                            <Avatar
                                onClick={handleAvatarClick}
                                className={cn('cursor-pointer border-4 border-primary/20 bg-primary font-bold text-primary-foreground', isMobile ? 'h-[100px] w-[100px] text-3xl' : 'h-[120px] w-[120px] text-5xl')}
                            >
                                {profilePicUrl && <AvatarImage src={profilePicUrl} />}
                                <AvatarFallback className="bg-primary text-primary-foreground">{profileData?.nombre?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            {isOwnProfile && (
                                <div
                                    onClick={handleAvatarClick}
                                    className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
                                >
                                    <IconCamera size={18} />
                                </div>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>
                        <div className={cn('flex flex-col gap-1', isMobile ? 'items-center' : 'items-start')}>
                            <p className={cn('m-0 font-bold leading-tight text-foreground', isMobile ? 'text-2xl' : 'text-3xl')}>
                                {profileData?.nombre}
                            </p>
                            <div className={cn('flex flex-wrap items-center gap-2', isMobile ? 'justify-center' : 'justify-start')}>
                                {profileData?.roles?.split(', ').map((role: string, idx: number) => (
                                    <Badge key={idx} className="font-extrabold">{role.toUpperCase()}</Badge>
                                ))}
                                {profileData?.nombre_usuario && (
                                    <span className="text-[13px] font-bold text-primary/80">@{profileData.nombre_usuario}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="pointer-events-none absolute -right-[5%] -top-[10%] h-[300px] w-[300px] rounded-full bg-primary/10 blur-3xl" />
                </Card>

                <div className={cn('grid items-start gap-6', isMobile ? 'grid-cols-1' : 'grid-cols-[7fr_5fr]')}>
                    <Card className="p-4">
                        <div className="mb-6 flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <IconId size={18} />
                            </div>
                            <span className="text-base font-semibold text-foreground">Información Personal</span>
                        </div>

                        <div className="flex flex-col gap-5">
                            <ProfileRow icon={<IconUser size={16} />} label="Nombre Completo" value={profileData?.nombre} isMobile={isMobile} />
                            <hr className="border-t border-dotted border-border" />
                            <ProfileRow icon={<IconMail size={16} />} label="Correo Electrónico" value={profileData?.email || 'No especificado'} isMobile={isMobile} breakAll />
                            <hr className="border-t border-dotted border-border" />
                            <ProfileRow icon={<IconUserCircle size={16} />} label="Nombre de Usuario" value={profileData?.nombre_usuario || 'No especificado'} isMobile={isMobile} />
                            <hr className="border-t border-dotted border-border" />
                            <ProfileRow icon={<IconBriefcase size={16} />} label="Cargo" value={profileData?.cargo || 'No especificado'} isMobile={isMobile} />

                            {isOwnProfile ? (
                                <>
                                    <hr className="my-1 border-t border-border" />
                                    <Button variant="outline" className="w-full" onClick={() => setPasswordOpened(true)}>
                                        <IconLock size={16} /> Cambiar Contraseña
                                    </Button>
                                </>
                            ) : (
                                onStartChat && (
                                    <>
                                        <hr className="my-1 border-t border-border" />
                                        <Button className="w-full" onClick={() => onStartChat(userId!)}>
                                            <IconMessageCircle size={16} /> Enviar Mensaje
                                        </Button>
                                    </>
                                )
                            )}
                        </div>
                    </Card>

                    <Card className="p-4">
                        <div className="mb-6 flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                                <IconShieldCheck size={18} />
                            </div>
                            <span className="text-base font-semibold text-foreground">Seguridad y Rol</span>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div>
                                <p className="mb-2 text-[11px] font-semibold uppercase text-muted-foreground">Roles Asignados</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {profileData?.roles?.split(', ').map((role: string, idx: number) => (
                                        <Badge key={idx}>{role}</Badge>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">ID de Usuario</p>
                                <p className="font-semibold text-foreground">#{profileData?.id_usuario}</p>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Firma guardada: solo en el propio perfil. */}
                {isOwnProfile && <FirmaPerfilCard />}
            </div>
            )}

            <Dialog open={opened} onOpenChange={setOpened}>
                <DialogContent className="max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Cambiar foto de perfil</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <p className="text-[13px] text-muted-foreground">Selecciona un avatar predefinido o sube una foto propia:</p>

                        <div className="grid grid-cols-3 gap-6 py-2">
                            {predefinedAvatars.map((avatar) => {
                                const isSelected = user.foto === avatar.path;
                                return (
                                    <div key={avatar.id} className="flex flex-col items-center">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectPredefined(avatar.path)}
                                            className={cn(
                                                'relative h-[90px] w-[90px] cursor-pointer rounded-full bg-transparent p-0.5 transition-transform',
                                                isSelected ? 'border-4 border-primary' : 'border border-border'
                                            )}
                                        >
                                            <Avatar className="mx-auto h-[82px] w-[82px]">
                                                <AvatarImage src={`${API_CONFIG.getBaseURL()}${avatar.path}`} />
                                                <AvatarFallback />
                                            </Avatar>
                                            {isSelected && (
                                                <div className="absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
                                                    <IconShieldCheck size={12} />
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="my-2 flex items-center gap-3">
                            <hr className="flex-1 border-t border-border" />
                            <span className="text-[11px] text-muted-foreground">O SUBE TU PROPIA FOTO</span>
                            <hr className="flex-1 border-t border-border" />
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setOpened(false);
                                fileInputRef.current?.click();
                            }}
                            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4"
                        >
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary">
                                <IconCamera size={24} />
                            </div>
                            <span className="text-[13px] font-semibold text-primary">Subir propia foto</span>
                        </button>

                        {user.foto && (
                            <Button variant="destructive" className="mt-2 w-full" onClick={() => handleSelectPredefined(null)}>
                                <IconTrash size={16} /> Eliminar foto actual
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={passwordOpened} onOpenChange={setPasswordOpened}>
                <DialogContent className="max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Cambiar Contraseña</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handlePasswordChange}>
                        <div className="flex flex-col gap-4">
                            <Field label="Contraseña Actual *">
                                <PasswordField
                                    placeholder="Ingrese su contraseña actual"
                                    value={currentPassword}
                                    onChange={setCurrentPassword}
                                />
                            </Field>

                            <div>
                                <Field label="Nueva Contraseña *" error={newPassword && newPassword === currentPassword ? 'No puede ser igual a la actual' : undefined}>
                                    <PasswordField
                                        placeholder="Ingrese su nueva contraseña"
                                        value={newPassword}
                                        onChange={setNewPassword}
                                        invalid={!!newPassword && newPassword === currentPassword}
                                    />
                                </Field>
                                {newPassword && (
                                    <div className="mt-1.5">
                                        <div className="mb-0.5 flex justify-between">
                                            <span className="text-xs font-semibold text-foreground">{strength.label}</span>
                                            <span className="text-xs text-muted-foreground">{strength.value}%</span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                            <div className={cn('h-full rounded-full transition-all', strength.color)} style={{ width: `${strength.value}%` }} />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Field label="Confirmar Nueva Contraseña *" error={passwordsMatch === false ? 'Las contraseñas no coinciden' : undefined}>
                                    <PasswordField
                                        placeholder="Repita la nueva contraseña"
                                        value={confirmPassword}
                                        onChange={setConfirmPassword}
                                        invalid={passwordsMatch === false}
                                    />
                                </Field>
                                {passwordsMatch === true && (
                                    <span className="mt-1 flex items-center gap-1 text-xs font-bold text-success">
                                        <IconShieldCheck size={12} /> Las contraseñas coinciden
                                    </span>
                                )}
                            </div>

                            <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setPasswordOpened(false)}>Cancelar</Button>
                                <Button
                                    type="submit"
                                    disabled={loading || !passwordsMatch || strength.value < 15 || newPassword === currentPassword}
                                >
                                    {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : null}
                                    Actualizar Contraseña
                                </Button>
                            </DialogFooter>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

function ProfileRow({ icon, label, value, isMobile, breakAll }: { icon: React.ReactNode; label: string; value?: string | null; isMobile: boolean; breakAll?: boolean }) {
    return (
        <div className={cn('flex justify-between gap-6', isMobile ? 'flex-col items-start gap-1' : 'flex-row items-center')}>
            <div className="flex shrink-0 items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    {icon}
                </div>
                <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
            </div>
            <span className={cn('font-semibold text-foreground', isMobile ? 'text-left' : 'text-right', breakAll && 'break-all')}>{value}</span>
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-foreground">{label}</span>
            {children}
            {error && <span className="mt-0.5 block text-[11px] text-destructive">{error}</span>}
        </div>
    );
}

function PasswordField({ placeholder, value, onChange, invalid }: { placeholder?: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
    const [visible, setVisible] = React.useState(false);
    return (
        <div className="relative">
            <Input
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                autoComplete="new-password"
                className={cn('pr-9', invalid && 'border-destructive')}
            />
            <button
                type="button"
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
                {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
        </div>
    );
}
