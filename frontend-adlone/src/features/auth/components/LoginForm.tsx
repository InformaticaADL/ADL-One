import { useState, useEffect } from 'react';
import {
    IconLock,
    IconMail,
    IconArrowLeft,
    IconAlertCircle,
    IconCheck,
    IconEye,
    IconEyeOff,
    IconX,
} from '@tabler/icons-react';
import type { LoginCredentials } from '../types/index';
import logoAdl from '../../../assets/images/logo-adlone.png';
import apiClient from '../../../config/axios.config';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface LoginFormProps {
    onSubmit: (credentials: LoginCredentials) => void;
    isLoading?: boolean;
    // Se informa tras 3 contraseñas incorrectas: abre el aviso para recuperar la contraseña por correo.
    recoveryHint?: { username: string; maskedEmail: string | null; attempts: number } | null;
    onRecoveryClose?: () => void;
}

export const LoginForm = ({ onSubmit, isLoading = false, recoveryHint = null, onRecoveryClose }: LoginFormProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [logoutReason, setLogoutReason] = useState<string | null>(null);
    // S-14: estado del formulario de recuperación
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotSending, setForgotSending] = useState(false);
    const [forgotSent, setForgotSent] = useState(false);
    const [forgotError, setForgotError] = useState<string | null>(null);
    const [hintSending, setHintSending] = useState(false);
    const [hintSent, setHintSent] = useState(false);
    const [hintError, setHintError] = useState<string | null>(null);

    useEffect(() => {
        const reason = sessionStorage.getItem('auth_logout_reason');
        if (reason) {
            setLogoutReason(reason);
            sessionStorage.removeItem('auth_logout_reason');
        }
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // S-11: trim espacios al inicio/final tanto del usuario como de la contraseña.
        const trimmedUser = email.trim();
        const trimmedPass = password.trim();
        if (trimmedUser && trimmedPass) {
            onSubmit({ email: trimmedUser, password: trimmedPass, rememberMe });
        }
    };

    const closeRecoveryHint = () => {
        setHintSent(false);
        setHintError(null);
        onRecoveryClose?.();
    };

    const sendRecoveryHint = async () => {
        if (!recoveryHint) return;
        setHintError(null);
        setHintSending(true);
        try {
            await apiClient.post('/api/auth/forgot-password', { username: recoveryHint.username });
            setHintSent(true);
        } catch (err: any) {
            setHintError(err?.response?.data?.message || 'No se pudo enviar el correo. Intenta nuevamente.');
        } finally {
            setHintSending(false);
        }
    };

    const closeForgotModal = () => {
        setShowForgotModal(false);
        setForgotEmail('');
        setForgotSent(false);
        setForgotError(null);
    };

    return (
        <Card className="shadcn-scope w-full rounded-2xl bg-card/95 p-6 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-6">
                {logoutReason && (
                    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
                        <IconAlertCircle size={18} className="mt-0.5 shrink-0 text-warning" />
                        <p className="flex-1">{logoutReason}</p>
                        <button type="button" aria-label="Cerrar" onClick={() => setLogoutReason(null)} className="shrink-0 text-muted-foreground hover:text-foreground">
                            <IconX size={16} />
                        </button>
                    </div>
                )}

                <div className="flex flex-col items-center">
                    <img src={logoAdl} className="mb-6 w-[260px]" alt="ADL" />
                    <h1 className="m-0 text-2xl font-bold text-foreground">Bienvenido</h1>
                    <p className="text-center text-[13px] text-muted-foreground">Ingresa tus credenciales para continuar</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col gap-4">
                        <Field label="Usuario *">
                            <div className="relative">
                                <IconMail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    placeholder="ej: jperez"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="username"
                                    disabled={isLoading}
                                    className="h-11 pl-10"
                                />
                            </div>
                        </Field>

                        <Field label="Contraseña *">
                            <div className="relative">
                                <IconLock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type={passwordVisible ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disabled={isLoading}
                                    className="h-11 pl-10 pr-10"
                                />
                                <button
                                    type="button"
                                    aria-label={passwordVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    onClick={() => setPasswordVisible((v) => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {passwordVisible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                                </button>
                            </div>
                        </Field>

                        <div className="flex items-center justify-between">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                                <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} disabled={isLoading} />
                                Recuérdame
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowForgotModal(true)}
                                className="text-sm font-medium text-primary hover:underline"
                            >
                                ¿Olvidaste tu contraseña?
                            </button>
                        </div>

                        <Button type="submit" size="lg" disabled={isLoading} className="mt-2 w-full">
                            {isLoading ? (
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                            ) : null}
                            {isLoading ? 'Ingresando...' : 'Ingresar'}
                        </Button>
                    </div>
                </form>
            </div>

            <Dialog open={!!recoveryHint} onOpenChange={(open) => !open && closeRecoveryHint()}>
                <DialogContent className="max-w-[460px]">
                    <DialogHeader>
                        <DialogTitle>¿Olvidaste tus credenciales?</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        {!hintSent ? (
                            <>
                                <div className="rounded-lg bg-primary/5 p-4 text-sm text-foreground">
                                    {recoveryHint?.maskedEmail ? (
                                        <>Llevas {recoveryHint.attempts} intentos con una contraseña incorrecta. Podemos enviar un correo a <strong>{recoveryHint.maskedEmail}</strong> con un enlace para crear una nueva contraseña.</>
                                    ) : (
                                        <>Llevas {recoveryHint?.attempts} intentos con una contraseña incorrecta, y este usuario no tiene un correo registrado. Contacta al administrador para recuperar el acceso.</>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground">Con 5 intentos fallidos la cuenta se bloquea por 5 minutos.</p>
                                {hintError && (
                                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                                        <IconAlertCircle size={18} className="mt-0.5 shrink-0 text-destructive" />
                                        {hintError}
                                    </div>
                                )}
                                <div className="mt-2 flex justify-between gap-2">
                                    <Button variant="outline" onClick={closeRecoveryHint}>Ahora no</Button>
                                    {recoveryHint?.maskedEmail && (
                                        <Button disabled={hintSending} onClick={sendRecoveryHint}>
                                            {hintSending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <IconMail size={16} />}
                                            Enviar correo
                                        </Button>
                                    )}
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
                                    <IconCheck size={18} className="mt-0.5 shrink-0 text-success" />
                                    <div>
                                        <p className="font-medium">Correo enviado</p>
                                        <p className="mt-1 text-muted-foreground">Revisa {recoveryHint?.maskedEmail}. El enlace es válido por 60 minutos.</p>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" onClick={closeRecoveryHint}>
                                    <IconArrowLeft size={16} /> Volver al login
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showForgotModal} onOpenChange={(open) => !open && closeForgotModal()}>
                <DialogContent className="max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Recuperar Contraseña</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        {!forgotSent ? (
                            <>
                                <div className="rounded-lg bg-primary/5 p-4 text-sm text-foreground">
                                    Ingresa tu email registrado y te enviaremos un link para crear una nueva contraseña.
                                </div>

                                <Field label="Email *">
                                    <Input
                                        type="email"
                                        placeholder="tu.correo@adldiagnostic.cl"
                                        value={forgotEmail}
                                        onChange={(e) => setForgotEmail(e.target.value)}
                                        disabled={forgotSending}
                                    />
                                </Field>

                                {forgotError && (
                                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                                        <IconAlertCircle size={18} className="mt-0.5 shrink-0 text-destructive" />
                                        {forgotError}
                                    </div>
                                )}

                                <div className="mt-2 flex justify-between">
                                    <Button variant="outline" onClick={() => setShowForgotModal(false)}>
                                        <IconArrowLeft size={16} /> Cancelar
                                    </Button>
                                    <Button
                                        disabled={forgotSending}
                                        onClick={async () => {
                                            const trimmed = forgotEmail.trim();
                                            if (!trimmed) { setForgotError('Ingresa tu email'); return; }
                                            setForgotError(null);
                                            setForgotSending(true);
                                            try {
                                                await apiClient.post('/api/auth/forgot-password', { email: trimmed });
                                                setForgotSent(true);
                                            } catch (err: any) {
                                                // S-15 (revisado): mensaje específico cuando el email no existe
                                                const msg = err?.response?.data?.message
                                                    || 'No se pudo procesar la solicitud. Intenta nuevamente.';
                                                setForgotError(msg);
                                            } finally {
                                                setForgotSending(false);
                                            }
                                        }}
                                    >
                                        {forgotSending ? (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                                        ) : null}
                                        Enviar link
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
                                    <IconCheck size={18} className="mt-0.5 shrink-0 text-success" />
                                    <div>
                                        <p className="font-medium">Solicitud enviada</p>
                                        <p className="mt-1 text-muted-foreground">
                                            Si el email está registrado, recibirás un correo con un enlace para restablecer tu contraseña. El link es válido por 60 minutos.
                                        </p>
                                    </div>
                                </div>
                                <Button variant="outline" className="w-full" onClick={closeForgotModal}>
                                    <IconArrowLeft size={16} /> Volver al Login
                                </Button>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className={cn('flex flex-col gap-1.5')}>
            <span className="text-[13px] font-semibold text-foreground">{label}</span>
            {children}
        </div>
    );
}
