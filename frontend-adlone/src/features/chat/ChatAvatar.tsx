import { Avatar } from 'antd';
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
}

const ChatAvatar: React.FC<ChatAvatarProps> = ({ name, foto, size = 40, group, onClick, style }) => {
    const src = foto ? `${API_CONFIG.getBaseURL()}${foto}` : undefined;
    const bg = group ? '#13a8a8' : stringToColor(name);
    return (
        <Avatar
            src={src}
            size={size}
            onClick={onClick}
            icon={group && !src ? <IconUsers size={Math.round(size * 0.5)} /> : undefined}
            style={{ backgroundColor: src ? undefined : bg, flexShrink: 0, cursor: onClick ? 'pointer' : undefined, ...style }}>
            {!src && !group ? initials(name) : null}
        </Avatar>
    );
};

export default ChatAvatar;
