import React from 'react';
import { Typography } from 'antd';
import { IconChevronRight } from '@tabler/icons-react';

const { Text } = Typography;

interface SelectionCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    onClick: () => void;
}

// Fila de una lista, no una tarjeta: con un número variable de opciones (acá
// son 7), un grid de tarjetas deja una última fila desbalanceada según el
// ancho de pantalla. Una lista vertical no tiene ese problema — cabe
// cualquier cantidad de ítems sin huecos ni filas cojas.
export const SelectionCard: React.FC<SelectionCardProps> = ({ title, description, icon, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="ma-selection-row"
            style={{
                display: 'flex', alignItems: 'center', gap: 16, width: '100%',
                padding: '16px 18px', border: '1px solid var(--app-border)', borderRadius: 10,
                background: 'var(--app-bg)', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 150ms ease, background-color 150ms ease',
            }}
        >
            <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 40, borderRadius: 10,
                backgroundColor: 'var(--app-accent-bg)', color: 'var(--app-accent-text)',
            }}>
                {icon}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <Text strong style={{ fontSize: 14, display: 'block' }}>{title}</Text>
                <Text type="secondary" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{description}</Text>
            </div>

            <IconChevronRight size={18} style={{ flexShrink: 0, color: 'var(--app-text-secondary)' }} />
        </button>
    );
};
