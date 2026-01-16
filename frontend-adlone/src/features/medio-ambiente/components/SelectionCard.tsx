import React from 'react';

interface SelectionCardProps {
    title: string;
    description: string;
    icon: string;
    onClick: () => void;
    color?: string; // Color de acento
}

export const SelectionCard: React.FC<SelectionCardProps> = ({
    title,
    description,
    icon,
    onClick,
    color = '#1565c0'
}) => {
    return (
        <div
            className="selection-card"
            onClick={onClick}
            style={{ borderTopColor: color }}
        >
            <div className="card-icon" style={{ backgroundColor: `${color}15`, color: color }}>
                {icon}
            </div>
            <h3 className="card-title">{title}</h3>
            <p className="card-description">{description}</p>
            <div className="card-arrow" style={{ color: color }}>➜</div>
        </div>
    );
};
