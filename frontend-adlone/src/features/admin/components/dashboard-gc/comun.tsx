import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { COLOR } from './datos';

// Piezas comunes de los dashboards de G.C. MAM (mismo estilo que EquiposDashboard).


export const Tarjeta: React.FC<{ titulo: string; subtitulo?: string; children: React.ReactNode; className?: string }> = ({ titulo, subtitulo, children, className }) => (
    <div className={cn('min-w-0 rounded-[10px] border border-border bg-card p-4 shadow-sm', className)}>
        <div className="text-[12.5px] font-semibold">{titulo}</div>
        {subtitulo && <div className="mb-3 mt-0.5 text-[11px] text-muted-foreground">{subtitulo}</div>}
        {children}
    </div>
);

export const Kpi: React.FC<{ label: string; valor: number | string; tono?: string; detalle?: string; onClick?: () => void }> = ({ label, valor, tono = 'text-foreground', detalle, onClick }) => {
    const Comp = onClick ? 'button' : 'div';
    return (
        <Comp
            type={onClick ? 'button' : undefined}
            onClick={onClick}
            className={cn('rounded-xl border border-border bg-card px-4 py-3 text-left', onClick && 'transition-colors hover:border-primary/40')}
        >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums', tono)}>{valor}</p>
            {detalle && <p className="text-[11px] text-muted-foreground">{detalle}</p>}
        </Comp>
    );
};

export const FilaKpis: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{children}</div>
);

export const Vacio: React.FC<{ texto: string }> = ({ texto }) => (
    <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">{texto}</p>
);

export const Estado: React.FC<{ cargando: boolean; error: string | null; children: React.ReactNode }> = ({ cargando, error, children }) => {
    if (cargando) return <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">Cargando...</div>;
    if (error) return <div className="flex h-48 items-center justify-center text-sm text-destructive">{error}</div>;
    return <div className="flex flex-col gap-4 px-4 pb-6 pt-2 md:px-6">{children}</div>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Globo: React.FC<any> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
            {label && <div className="mb-1 font-semibold text-foreground">{label}</div>}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {payload.map((p: any, i: number) => (
                <div key={i} className="text-muted-foreground">{p.name ?? p.dataKey}: <span className="font-medium text-foreground">{p.value}</span></div>
            ))}
        </div>
    );
};

const eje = { fontSize: 10, fill: 'var(--muted-foreground)' };

/** Barras horizontales de una sola serie (ranking): [{ name, value }]. */
export const Ranking: React.FC<{ datos: { name: string; value: number }[]; color?: string; nombre?: string; vacio?: string }> = ({ datos, color = COLOR.main, nombre = 'Cantidad', vacio = 'Sin datos.' }) => {
    if (!datos.length) return <Vacio texto={vacio} />;
    return (
        <ResponsiveContainer width="100%" height={Math.max(120, datos.length * 26 + 20)}>
            <BarChart data={datos} layout="vertical" margin={{ left: 4, right: 32, top: 0, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke="var(--border)" strokeOpacity={0.35} />
                <XAxis type="number" tick={eje} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10.5, fill: 'var(--foreground)' }} axisLine={false} tickLine={false} />
                <Tooltip content={<Globo />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                <Bar dataKey="value" name={nombre} fill={color} fillOpacity={0.85} radius={[0, 4, 4, 0]} maxBarSize={16}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );
};

/** Columnas por mes, apiladas si hay varias series: datos [{ mes, serieA, serieB }]. */
export const PorMes: React.FC<{ datos: Record<string, string | number>[]; series: { key: string; nombre: string; color: string }[] }> = ({ datos, series }) => {
    if (!datos.some((d) => series.some((s) => Number(d[s.key]) > 0))) return <Vacio texto="Sin registros en los últimos 12 meses." />;
    return (
        <ResponsiveContainer width="100%" height={220}>
            <BarChart data={datos} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.35} />
                <XAxis dataKey="mes" tick={eje} axisLine={false} tickLine={false} />
                <YAxis tick={eje} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<Globo />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
                {series.length > 1 && <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
                {series.map((s, i) => (
                    <Bar key={s.key} dataKey={s.key} name={s.nombre} stackId="m" fill={s.color} fillOpacity={0.85} maxBarSize={28}
                        radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
            </BarChart>
        </ResponsiveContainer>
    );
};

export const Tabla: React.FC<{ columnas: string[]; filas: React.ReactNode[][]; vacio?: string }> = ({ columnas, filas, vacio = 'Sin registros.' }) => {
    if (!filas.length) return <Vacio texto={vacio} />;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                        {columnas.map((c) => <th key={c} className="whitespace-nowrap px-2 py-1.5 font-medium">{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {filas.map((f, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                            {f.map((c, j) => <td key={j} className="px-2 py-1.5 align-top">{c}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
