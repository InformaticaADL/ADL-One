import type { ReactElement } from 'react';
import { Button, Tooltip } from 'antd';
import { IconPlus, IconMessages, IconStar, IconUsers } from '@tabler/icons-react';

export type ChatView = 'chats' | 'favoritos' | 'grupos';

interface ChatNavProps {
    view: ChatView;
    onChangeView: (v: ChatView) => void;
    counts: { chats: number; favoritos: number; grupos: number };
    onCreateGroup: () => void;
}

const C = {
    border: '#f0f0f0', text: 'rgba(0,0,0,0.88)', textSec: 'rgba(0,0,0,0.65)', textTer: 'rgba(0,0,0,0.45)',
    primary: '#1677ff', primaryBg: '#e6f4ff', bg: '#ffffff', hover: '#fafafa',
};

const CSS = `
.adl-nav { width:240px; flex-shrink:0; display:flex; flex-direction:column; background:${C.bg}; border-right:1px solid ${C.border}; padding:4px; }
.adl-nav-head { display:flex; align-items:center; justify-content:space-between; padding:12px 12px 8px; }
.adl-nav-title { margin:0; font-size:20px; font-weight:700; color:${C.text}; }
.adl-nav-section { padding:8px 12px 4px; font-size:12px; font-weight:600; letter-spacing:.4px; text-transform:uppercase; color:${C.textTer}; }
.adl-nav-item { display:flex; align-items:center; column-gap:12px; width:100%; padding:10px 12px; border:none; background:transparent; cursor:pointer; text-align:left; border-radius:8px; color:${C.textSec}; font-size:14px; }
.adl-nav-item:hover { background:${C.hover}; color:${C.text}; }
.adl-nav-item.active { background:${C.primaryBg}; color:${C.primary}; font-weight:600; }
.adl-nav-icon { display:inline-flex; flex-shrink:0; }
.adl-nav-label { flex:1; }
.adl-nav-count { font-size:12px; font-weight:600; font-variant-numeric:tabular-nums; }
`;

const ITEMS: { id: ChatView; label: string; icon: ReactElement }[] = [
    { id: 'chats', label: 'Conversaciones', icon: <IconMessages size={20} /> },
    { id: 'favoritos', label: 'Favoritos', icon: <IconStar size={20} /> },
    { id: 'grupos', label: 'Grupos', icon: <IconUsers size={20} /> },
];

const ChatNav: React.FC<ChatNavProps> = ({ view, onChangeView, counts, onCreateGroup }) => {
    return (
        <nav className="adl-nav">
            <style>{CSS}</style>
            <div className="adl-nav-head">
                <h1 className="adl-nav-title">Mensajes</h1>
                <Tooltip title="Nuevo grupo">
                    <Button type="primary" shape="circle" icon={<IconPlus size={18} />} onClick={onCreateGroup} />
                </Tooltip>
            </div>
            <div className="adl-nav-section">Navegación</div>
            {ITEMS.map((it) => (
                <button key={it.id} type="button" className={`adl-nav-item ${view === it.id ? 'active' : ''}`}
                    onClick={() => onChangeView(it.id)} aria-current={view === it.id}>
                    <span className="adl-nav-icon">{it.icon}</span>
                    <span className="adl-nav-label">{it.label}</span>
                    <span className="adl-nav-count">{counts[it.id]}</span>
                </button>
            ))}
        </nav>
    );
};

export default ChatNav;
