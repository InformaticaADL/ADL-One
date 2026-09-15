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

const ChatAvatar: React.FC<ChatAvatarProps> = ({ name, foto, size = 40, group, onClick, style, className }) => {
    const src = foto ? `${API_CONFIG.getBaseURL()}${foto}` : undefined;
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
                <img src={src} alt={name || 'avatar'} className="h-full w-full object-cover" />
            ) : group ? (
                <IconUsers size={Math.round(size * 0.5)} />
            ) : (
                initials(name)
            )}
        </div>
    );
};

export default ChatAvatar;
