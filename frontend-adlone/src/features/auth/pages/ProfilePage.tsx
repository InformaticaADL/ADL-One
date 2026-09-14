import React from 'react';
import {
    Avatar, Typography, Tag,
    Card, Button,
    Modal, Input,
    Progress,
    Spin
} from 'antd';
import { IconUser, IconMail, IconShieldCheck, IconId, IconUserCircle, IconCamera, IconBriefcase, IconLock, IconMessageCircle, IconTrash } from '@tabler/icons-react';
import { useAuth } from '../../../contexts/AuthContext';
import { generalChatService } from '../../../services/general-chat.service';
import type { UserProfile } from '../../../services/general-chat.service';
import axios from 'axios';
import API_CONFIG from '../../../config/api.config';
import { useToast } from '../../../contexts/ToastContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

const { Text } = Typography;

interface ProfilePageProps {
    userId?: number;
    onStartChat?: (userId: number) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ userId, onStartChat }) => {
    const { user, updateUser, token } = useAuth();
    const { showToast } = useToast();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [opened, setOpened] = React.useState(false);
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

    const handleSelectPredefined = async (avatarPath: string) => {
        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/users/avatar`, { avatarPath }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                updateUser({ foto: avatarPath });
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
        if (password.length === 0) return { value: 0, color: 'gray', label: '' };
        if (password.length < 4) return { value: 15, color: '#e03131', label: 'Muy corta' };

        let strength = 0;
        if (password.length >= 8) strength += 25;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
        if (/\d/.test(password)) strength += 25;
        if (/[^A-Za-z0-9]/.test(password)) strength += 25;

        if (strength <= 25) return { value: 35, color: '#e8590c', label: 'Débil' };
        if (strength <= 50) return { value: 65, color: '#1c7ed6', label: 'Media' };
        if (strength <= 75) return { value: 85, color: '#0c8599', label: 'Buena' };
        return { value: 100, color: '#2f9e44', label: 'Excelente' };
    };

    const strength = getStrength(newPassword);
    const passwordsMatch = newPassword && confirmPassword ? newPassword === confirmPassword : null;

    const profilePicUrl = profileData?.foto ? `${API_CONFIG.getBaseURL()}${profileData.foto}` : null;

    if (loadingProfile) {
        return (
            <div style={{ padding: 32 }}>
                <div style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spin size="large" /></div>
            </div>
        );
    }

    return (
        <div style={{ padding: 16, width: '100%', maxWidth: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <Card style={{
                    background: 'linear-gradient(135deg, var(--app-accent-bg) 0%, rgba(0,98,168,0.1) 100%)',
                    position: 'relative',
                    overflow: 'hidden',
                    borderColor: 'var(--app-border)'
                }}>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            flexDirection: isMobile ? 'column' : 'row',
                            gap: 24,
                            textAlign: 'center',
                        }}>
                            <div style={{ position: 'relative' }}>
                                <Avatar
                                    src={profilePicUrl}
                                    size={isMobile ? 100 : 120}
                                    style={{
                                        border: '4px solid rgba(0, 98, 168, 0.2)',
                                        cursor: 'pointer',
                                        backgroundColor: '#0062a8',
                                        fontSize: isMobile ? 32 : 48,
                                        fontWeight: 700,
                                    }}
                                    onClick={handleAvatarClick}
                                >
                                    {profileData?.nombre?.charAt(0)}
                                </Avatar>
                                {isOwnProfile && (
                                    <div
                                        onClick={handleAvatarClick}
                                        style={{
                                            width: 32, height: 32, borderRadius: '50%', backgroundColor: '#0062a8', color: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            position: 'absolute',
                                            bottom: 5,
                                            right: 5,
                                            border: '2px solid var(--app-bg-elevated)',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <IconCamera size={18} />
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: isMobile ? 'center' : 'flex-start' }}>
                                <Text strong style={{
                                    lineHeight: 1.2,
                                    textAlign: 'center',
                                    fontSize: isMobile ? 24 : 32,
                                }}>
                                    {profileData?.nombre}
                                </Text>
                                <div style={{ display: 'flex', gap: 8, justifyContent: isMobile ? 'center' : 'flex-start', flexWrap: 'wrap', alignItems: 'center' }}>
                                    {profileData?.roles?.split(', ').map((role: string, idx: number) => (
                                        <Tag key={idx} color="blue" style={{ fontWeight: 800 }}>
                                            {role.toUpperCase()}
                                        </Tag>
                                    ))}
                                    {profileData?.nombre_usuario && (
                                        <Text strong style={{ fontSize: 13, color: '#0062a8', opacity: 0.8 }}>
                                            @{profileData.nombre_usuario}
                                        </Text>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(56, 189, 248, 0.1) 0%, transparent 70%)', zIndex: 0 }} />
                </Card>

                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '7fr 5fr', gap: 24, alignItems: 'start' }}>
                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, whiteSpace: 'nowrap' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--app-accent-bg)', color: '#0062a8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <IconId size={18} />
                            </div>
                            <Text strong style={{ fontSize: 16 }}>Información Personal</Text>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            <ProfileRow icon={<IconUser size={16} />} label="Nombre Completo" value={profileData?.nombre} isMobile={isMobile} />
                            <hr style={{ border: 'none', borderTop: '1px dotted var(--app-border)' }} />
                            <ProfileRow icon={<IconMail size={16} />} label="Correo Electrónico" value={profileData?.email || 'No especificado'} isMobile={isMobile} breakAll />
                            <hr style={{ border: 'none', borderTop: '1px dotted var(--app-border)' }} />
                            <ProfileRow icon={<IconUserCircle size={16} />} label="Nombre de Usuario" value={profileData?.nombre_usuario || 'No especificado'} isMobile={isMobile} />
                            <hr style={{ border: 'none', borderTop: '1px dotted var(--app-border)' }} />
                            <ProfileRow icon={<IconBriefcase size={16} />} label="Cargo" value={profileData?.cargo || 'No especificado'} isMobile={isMobile} />

                            {isOwnProfile ? (
                                <>
                                    <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />
                                    <Button
                                        block
                                        icon={<IconLock size={16} />}
                                        onClick={() => setPasswordOpened(true)}
                                    >
                                        Cambiar Contraseña
                                    </Button>
                                </>
                            ) : (
                                onStartChat && (
                                    <>
                                        <hr style={{ border: 'none', borderTop: '1px solid var(--app-border)', margin: '8px 0' }} />
                                        <Button
                                            block
                                            type="primary"
                                            icon={<IconMessageCircle size={16} />}
                                            onClick={() => onStartChat(userId!)}
                                        >
                                            Enviar Mensaje
                                        </Button>
                                    </>
                                )
                            )}
                        </div>
                    </Card>

                    <Card>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24, whiteSpace: 'nowrap' }}>
                            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: 'var(--app-accent-bg)', color: '#0062a8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <IconShieldCheck size={18} />
                            </div>
                            <Text strong style={{ fontSize: 16 }}>Seguridad y Rol</Text>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <Text type="secondary" strong style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Roles Asignados</Text>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {profileData?.roles?.split(', ').map((role: string, idx: number) => (
                                        <Tag key={idx} color="blue">{role}</Tag>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Text type="secondary" strong style={{ fontSize: 11, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>ID de Usuario</Text>
                                <Text strong>#{profileData?.id_usuario}</Text>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>

            <Modal open={opened} onCancel={() => setOpened(false)} footer={null} width={480} centered title="Cambiar foto de perfil">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                    <Text type="secondary" style={{ fontSize: 13 }}>Selecciona un avatar predefinido o sube una foto propia:</Text>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, padding: '16px 0' }}>
                        {predefinedAvatars.map((avatar) => {
                            const isSelected = user.foto === avatar.path;
                            return (
                                <div key={avatar.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handleSelectPredefined(avatar.path)}
                                        style={{
                                            position: 'relative',
                                            width: 90,
                                            height: 90,
                                            borderRadius: '50%',
                                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                            border: isSelected ? '4px solid #4dabf7' : '1px solid var(--app-border)',
                                            padding: 2,
                                            cursor: 'pointer',
                                            background: 'none',
                                        }}
                                    >
                                        <Avatar
                                            src={`${API_CONFIG.getBaseURL()}${avatar.path}`}
                                            size={82}
                                            style={{ margin: 'auto' }}
                                        />
                                        {isSelected && (
                                            <div style={{
                                                width: 20, height: 20, borderRadius: '50%', backgroundColor: '#0062a8', color: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                position: 'absolute',
                                                top: -2,
                                                right: -2,
                                                zIndex: 2,
                                                border: '2px solid var(--app-bg-elevated)'
                                            }}>
                                                <IconShieldCheck size={12} />
                                            </div>
                                        )}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
                        <Text type="secondary" style={{ fontSize: 11 }}>O SUBE TU PROPIA FOTO</Text>
                        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--app-border)' }} />
                    </div>

                    <button
                        onClick={() => {
                            setOpened(false);
                            fileInputRef.current?.click();
                        }}
                        style={{
                            width: '100%',
                            padding: 16,
                            borderRadius: 8,
                            border: '1px dashed #74c0fc',
                            backgroundColor: 'var(--app-accent-bg)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 8,
                            cursor: 'pointer',
                        }}
                    >
                        <div style={{ width: 44, height: 44, borderRadius: '50%', backgroundColor: 'rgba(0,98,168,0.15)', color: '#0062a8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <IconCamera size={24} />
                        </div>
                        <Text strong style={{ fontSize: 13, color: '#0062a8' }}>Subir propia foto</Text>
                    </button>

                    {user.foto && (
                        <Button
                            danger
                            block
                            style={{ marginTop: 8 }}
                            icon={<IconTrash size={16} />}
                            onClick={() => handleSelectPredefined(null as any)}
                        >
                            Eliminar foto actual
                        </Button>
                    )}
                </div>
            </Modal>
            <Modal open={passwordOpened} onCancel={() => setPasswordOpened(false)} footer={null} width={420} centered title={<Text strong>Cambiar Contraseña</Text>}>
                <form onSubmit={handlePasswordChange}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
                        <Field label="Contraseña Actual *">
                            <Input.Password
                                placeholder="Ingrese su contraseña actual"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                            />
                        </Field>

                        <div>
                            <Field label="Nueva Contraseña *" error={newPassword && newPassword === currentPassword ? 'No puede ser igual a la actual' : undefined}>
                                <Input.Password
                                    placeholder="Ingrese su nueva contraseña"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    status={newPassword && newPassword === currentPassword ? 'error' : undefined}
                                />
                            </Field>
                            {newPassword && (
                                <div style={{ marginTop: 7 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <Text strong style={{ fontSize: 12 }}>{strength.label}</Text>
                                        <Text type="secondary" style={{ fontSize: 12 }}>{strength.value}%</Text>
                                    </div>
                                    <Progress percent={strength.value} strokeColor={strength.color} size="small" showInfo={false} />
                                </div>
                            )}
                        </div>

                        <div>
                            <Field label="Confirmar Nueva Contraseña *" error={passwordsMatch === false ? 'Las contraseñas no coinciden' : undefined}>
                                <Input.Password
                                    placeholder="Repita la nueva contraseña"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    status={passwordsMatch === false ? 'error' : undefined}
                                />
                            </Field>
                            {passwordsMatch === true && (
                                <Text style={{ fontSize: 12, color: '#2f9e44', fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <IconShieldCheck size={12} /> Las contraseñas coinciden
                                </Text>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                            <Button onClick={() => setPasswordOpened(false)}>Cancelar</Button>
                            <Button
                                htmlType="submit"
                                type="primary"
                                loading={loading}
                                disabled={!passwordsMatch || strength.value < 15 || newPassword === currentPassword}
                            >
                                Actualizar Contraseña
                            </Button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

function ProfileRow({ icon, label, value, isMobile, breakAll }: { icon: React.ReactNode; label: string; value?: string | null; isMobile: boolean; breakAll?: boolean }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 4 : 24 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'var(--app-hover-bg)', color: 'var(--app-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                </div>
                <Text type="secondary" strong style={{ fontSize: 13 }}>{label}</Text>
            </div>
            <Text strong style={{ textAlign: isMobile ? 'left' : 'right', wordBreak: breakAll ? 'break-all' : undefined }}>{value}</Text>
        </div>
    );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
    return (
        <div>
            <Text style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>{label}</Text>
            {children}
            {error && <Text type="danger" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{error}</Text>}
        </div>
    );
}
