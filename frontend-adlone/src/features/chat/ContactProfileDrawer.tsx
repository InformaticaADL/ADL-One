import { useEffect, useState, type ReactElement } from 'react';
import { Drawer, Button, Divider, Tag, Spin } from 'antd';
import { IconMail, IconBriefcase, IconShield, IconMessageCircle } from '@tabler/icons-react';
import { generalChatService } from '../../services/general-chat.service';
import type { UserProfile } from '../../services/general-chat.service';
import ChatAvatar from './ChatAvatar';

interface ContactProfileDrawerProps {
    opened: boolean;
    onClose: () => void;
    userId: number | null;
    onStartChat: (userId: number) => void;
}

const C = { text: 'rgba(0,0,0,0.88)', textTer: 'rgba(0,0,0,0.45)', primary: '#1677ff' };

const ContactProfileDrawer: React.FC<ContactProfileDrawerProps> = ({ opened, onClose, userId, onStartChat }) => {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (opened && userId) {
            setLoading(true);
            generalChatService.getUserProfile(userId).then(setProfile).catch((e) => console.error(e)).finally(() => setLoading(false));
        }
        if (!opened) setProfile(null);
    }, [opened, userId]);

    const Row = ({ icon, label, value }: { icon: ReactElement; label: string; value: React.ReactNode }) => (
        <div style={{ display: 'flex', columnGap: 12, alignItems: 'flex-start' }}>
            <span style={{ color: C.primary, marginTop: 2 }}>{icon}</span>
            <div>
                <div style={{ fontSize: 12, color: C.textTer, textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
                <div style={{ fontSize: 14, marginTop: 2, color: C.text }}>{value}</div>
            </div>
        </div>
    );

    return (
        <Drawer open={opened} onClose={onClose} placement="right" width={360} title="Perfil de contacto">
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>
            ) : !profile ? (
                <p style={{ textAlign: 'center', color: C.textTer }}>No se encontró el usuario</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', rowGap: 12, padding: '8px 0' }}>
                        <ChatAvatar name={profile.nombre} foto={profile.foto} size={120} />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{profile.nombre}</div>
                            {profile.nombre_usuario && <div style={{ fontSize: 12, color: C.textTer, marginTop: 2 }}>@{profile.nombre_usuario}</div>}
                        </div>
                    </div>
                    <Divider style={{ margin: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', rowGap: 16 }}>
                        {profile.email && <Row icon={<IconMail size={20} />} label="Correo electrónico" value={profile.email} />}
                        {profile.cargo && <Row icon={<IconBriefcase size={20} />} label="Cargo" value={profile.cargo} />}
                        {profile.roles && (
                            <Row icon={<IconShield size={20} />} label="Roles" value={
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
                                    {profile.roles.split(', ').map((r, i) => <Tag key={i} color="blue">{r}</Tag>)}
                                </div>
                            } />
                        )}
                    </div>
                    <Button type="primary" icon={<IconMessageCircle size={18} />} onClick={() => { onClose(); if (userId) onStartChat(userId); }}>
                        Enviar mensaje
                    </Button>
                </div>
            )}
        </Drawer>
    );
};

export default ContactProfileDrawer;
