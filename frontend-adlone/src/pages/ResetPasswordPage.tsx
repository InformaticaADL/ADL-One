import { useEffect, useState } from 'react';
import { IconLock, IconAlertCircle, IconCheck, IconArrowLeft, IconEye, IconEyeOff } from '@tabler/icons-react';
import apiClient from '../config/axios.config';
import { useToast } from '../contexts/ToastContext';
import logoAdl from '../assets/images/logo-adlone.png';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Props {
    onDone: () => void; // volver al login
}

export const ResetPasswordPage = ({ onDone }: Props) => {
    const { showToast } = useToast();
    const [token, setToken] = useState<string>('');
    const [validating, setValidating] = useState(true);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [nombreUsuario, setNombreUsuario] = useState<string>('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token') || '';
        setToken(t);
        if (!t) {
            setValidating(false);
            setValidationError('No se proporcionó un token de recuperación.');
            return;
        }
        apiClient.get(`/api/auth/reset-password/validate?token=${encodeURIComponent(t)}`)
            .then(res => {
                setNombreUsuario(res.data?.data?.nombreUsuario || '');
                setValidationError(null);
            })
            .catch(err => {
                setValidationError(err.response?.data?.message || 'El link no es válido o ha expirado.');
            })
            .finally(() => setValidating(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < 4) {
            showToast({ type: 'warning', message: 'La contraseña debe tener al menos 4 caracteres.' });
            return;
        }
        if (password !== password2) {
            showToast({ type: 'warning', message: 'Las contraseñas no coinciden.' });
            return;
        }
        setSaving(true);
        try {
            await apiClient.post('/api/auth/reset-password', { token, newPassword: password });
            setDone(true);
            showToast({ type: 'success', message: 'Contraseña actualizada correctamente.' });
        } catch (err: any) {
            showToast({ type: 'error', message: err.response?.data?.message || 'No se pudo restablecer la contraseña.' });
        } finally {
            setSaving(false);
        }
    };

    const backToLogin = () => {
        // Limpiar query y volver al login
        window.history.replaceState({}, '', '/');
        onDone();
    };

    const passwordsMismatch = !!password2 && password !== password2;

    return (
        <div className="login-page">
            <div className="login-container">
                <Card className="shadcn-scope w-full rounded-2xl bg-card/95 p-6 shadow-lg backdrop-blur">
                    <div className="flex flex-col gap-6">
                        <div className="flex flex-col items-center">
                            <img src={logoAdl} className="mb-6 w-[260px]" alt="ADL" />
                            <h2 className="m-0 text-2xl font-bold text-foreground">Restablecer contraseña</h2>
                            {nombreUsuario && (
                                <p className="text-center text-[13px] text-muted-foreground">
                                    para <strong>{nombreUsuario}</strong>
                                </p>
                            )}
                        </div>

                        {validating && (
                            <div className="flex justify-center p-8">
                                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                        )}

                        {!validating && validationError && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
                                    <IconAlertCircle size={18} className="mt-0.5 shrink-0 text-destructive" />
                                    {validationError}
                                </div>
                                <Button variant="outline" onClick={backToLogin}>
                                    <IconArrowLeft size={16} />
                                    Volver al login
                                </Button>
                            </div>
                        )}

                        {!validating && !validationError && !done && (
                            <form onSubmit={handleSubmit}>
                                <div className="flex flex-col gap-4">
                                    <Field label="Nueva contraseña *">
                                        <PasswordField
                                            placeholder="Ingrese su nueva contraseña"
                                            value={password}
                                            onChange={setPassword}
                                            disabled={saving}
                                        />
                                    </Field>
                                    <Field label="Confirmar contraseña *">
                                        <PasswordField
                                            placeholder="Repita la contraseña"
                                            value={password2}
                                            onChange={setPassword2}
                                            disabled={saving}
                                            invalid={passwordsMismatch}
                                        />
                                        {passwordsMismatch && <p className="mt-0.5 text-[11px] text-destructive">Las contraseñas no coinciden</p>}
                                    </Field>
                                    <Button type="submit" size="lg" disabled={saving} className="mt-2 w-full">
                                        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : null}
                                        Restablecer contraseña
                                    </Button>
                                </div>
                            </form>
                        )}

                        {done && (
                            <div className="flex flex-col gap-4">
                                <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-foreground">
                                    <IconCheck size={18} className="mt-0.5 shrink-0 text-success" />
                                    <div>
                                        <p className="font-medium">Listo</p>
                                        <p className="mt-1 text-muted-foreground">Tu contraseña fue actualizada. Ya puedes iniciar sesión con ella.</p>
                                    </div>
                                </div>
                                <Button size="lg" onClick={backToLogin}>
                                    Ir al login
                                </Button>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <span className="mb-1.5 block text-[13px] font-semibold text-foreground">{label}</span>
            {children}
        </div>
    );
}

function PasswordField({ placeholder, value, onChange, disabled, invalid }: { placeholder?: string; value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
    const [visible, setVisible] = useState(false);
    return (
        <div className="relative">
            <IconLock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
                type={visible ? 'text' : 'password'}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                autoComplete="new-password"
                className={`h-11 pl-10 pr-10 ${invalid ? 'border-destructive' : ''}`}
            />
            <button
                type="button"
                aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setVisible((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
                {visible ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </button>
        </div>
    );
}

export default ResetPasswordPage;
