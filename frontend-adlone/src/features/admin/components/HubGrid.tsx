import React from 'react';
import { Card } from '@/components/ui/card';

export interface HubOption {
    id: string;
    label: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    description: string;
    badge?: React.ReactNode;
}

interface HubGridProps {
    options: HubOption[];
    onNavigate: (id: string) => void;
    emptyText?: string;
}

export function HubGrid({ options, onNavigate, emptyText = 'No tiene permisos para acceder a las funcionalidades de este módulo.' }: HubGridProps) {
    return (
        <div className="shadcn-scope mt-8 grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {options.map((opt) => (
                <div key={opt.id} onClick={() => onNavigate(opt.id)} className="h-full cursor-pointer">
                    <Card className="h-full p-5 transition-all hover:-translate-y-1 hover:shadow-md">
                        <div
                            className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-lg"
                            style={{ backgroundColor: opt.bg, color: opt.color }}
                        >
                            {opt.icon}
                        </div>

                        <p className="mb-1 flex items-center gap-1.5 text-base font-semibold text-foreground">
                            {opt.label}
                            {opt.badge}
                        </p>

                        <p className="text-[13px] leading-relaxed text-muted-foreground">
                            {opt.description}
                        </p>
                    </Card>
                </div>
            ))}

            {options.length === 0 && (
                <Card className="bg-muted/40 p-5">
                    <p className="text-center text-sm text-muted-foreground">{emptyText}</p>
                </Card>
            )}
        </div>
    );
}
