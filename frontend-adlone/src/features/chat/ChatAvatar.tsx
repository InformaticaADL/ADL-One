import { useEffect, useState } from 'react';
import { IconUsers } from '@tabler/icons-react';
import API_CONFIG from '../../config/api.config';

const PALETTE = ['#1677ff', '#389e0d', '#d46b08', '#722ed1', '#c41d7f', '#2f54eb', '#08979c', '#7cb305', '#531dab', '#cf1322'];

export const stringToColor = (name?: string | null): string => {
    const str = name || '?';
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return PALETTE[Math.abs(hash) % PALETTE.length];
};

export const initials = (name?: string | null): string => {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

interface ChatAvatarProps {
    name?: string | null;
    foto?: string | null;
    size?: number;
    group?: boolean;
    onClick?: (e?: React.MouseEvent<HTMLElement>) => void;
    style?: React.CSSProperties;
    className?: string;
}

// Muchos usuarios (los que nunca subieron foto) quedaron con este archivo marcador, que no existe en el servidor.
const FOTO_MARCADOR = /sinfoto.jpg/i;

const ChatAvatar: React.FC<ChatAvatarProps> = ({ name, foto, size = 40, group, onClick, style, className }) => {
    // Si la imagen no carga (marcador, archivo borrado), se muestran las iniciales en vez del icono de imagen rota.
    const [fallo, setFallo] = useState(false);
    useEffect(() => { setFallo(false); }, [foto]);
    const fotoLimpia = foto && !FOTO_MARCADOR.test(foto) ? foto.trim() : null;
    const src = fotoLimpia && !fallo ? `${API_CONFIG.getBaseURL()}${fotoLimpia}` : undefined;
    const bg = group ? '#13a8a8' : stringToColor(name);
    return (
        <div
            onClick={onClick}
            className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${onClick ? 'cursor-pointer' : ''} ${className || ''}`}
            style={{
                width: size,
                height: size,
                fontSize: Math.max(11, Math.round(size * 0.38)),
                backgroundColor: src ? undefined : bg,
                ...style,
            }}
        >
            {src ? (
                <img src={src} alt={name || 'avatar'} className="h-full w-full object-cover" onError={() => setFallo(true)} />
            ) : group ? (
                <IconUsers size={Math.round(size * 0.5)} />
            ) : (
                initials(name)
            )}
        </div>
    );
};

export default ChatAvatar;
