import { useEffect, useState, type ReactElement } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const Row = ({ icon, label, value }: { icon: ReactElement; label: string; value: React.ReactNode }) => (
    <div className="flex items-start gap-3">
        <span className="mt-0.5 text-primary">{icon}</span>
        <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-sm text-foreground">{value}</div>
        </div>
    </div>
);

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

    return (
        <Sheet open={opened} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent className="shadcn-scope w-full sm:max-w-sm">
                <SheetHeader>
                    <SheetTitle>Perfil de contacto</SheetTitle>
                </SheetHeader>
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                ) : !profile ? (
                    <p className="text-center text-sm text-muted-foreground">No se encontró el usuario</p>
                ) : (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-3 py-2">
                            <ChatAvatar name={profile.nombre} foto={profile.foto} size={120} />
                            <div className="text-center">
                                <div className="text-lg font-bold text-foreground">{profile.nombre}</div>
                                {profile.nombre_usuario && <div className="mt-0.5 text-xs text-muted-foreground">@{profile.nombre_usuario}</div>}
                            </div>
                        </div>
                        <div className="h-px bg-border" />
                        <div className="flex flex-col gap-4">
                            {profile.email && <Row icon={<IconMail size={20} />} label="Correo electrónico" value={profile.email} />}
                            {profile.cargo && <Row icon={<IconBriefcase size={20} />} label="Cargo" value={profile.cargo} />}
                            {profile.roles && (
                                <Row icon={<IconShield size={20} />} label="Roles" value={
                                    <div className="mt-0.5 flex flex-wrap gap-1">
                                        {profile.roles.split(', ').map((r, i) => <Badge key={i} variant="outline">{r}</Badge>)}
                                    </div>
                                } />
                            )}
                        </div>
                        <Button onClick={() => { onClose(); if (userId) onStartChat(userId); }}>
                            <IconMessageCircle size={18} /> Enviar mensaje
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
};

export default ContactProfileDrawer;
