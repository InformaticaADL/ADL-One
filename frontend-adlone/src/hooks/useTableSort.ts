import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

type SortValue = string | number | null | undefined;

export interface SortState<K extends string> {
    key: K | null;
    direction: SortDirection;
}

// Orden client-side reutilizable para todas las tablas. `accessors` debe ser
// estable (definido fuera del componente o memoizado). Vacíos siempre al
// final, en ambas direcciones.
export function useTableSort<T, K extends string>(
    rows: T[],
    accessors: Record<K, (row: T) => SortValue>,
    initial?: { key: K; direction?: SortDirection }
) {
    const [sort, setSort] = useState<SortState<K>>({
        key: initial?.key ?? null,
        direction: initial?.direction ?? 'asc',
    });

    const toggleSort = (key: K) =>
        setSort((prev) => {
            if (prev.key !== key) return { key, direction: 'asc' };
            if (prev.direction === 'asc') return { key, direction: 'desc' };
            return { key: null, direction: 'asc' };
        });

    const sorted = useMemo(() => {
        if (!sort.key) return rows;
        const get = accessors[sort.key];
        const dir = sort.direction === 'asc' ? 1 : -1;
        const isEmpty = (v: SortValue) => v === null || v === undefined || v === '';
        return [...rows].sort((a, b) => {
            const va = get(a);
            const vb = get(b);
            if (isEmpty(va) && isEmpty(vb)) return 0;
            if (isEmpty(va)) return 1;
            if (isEmpty(vb)) return -1;
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb), 'es', { numeric: true, sensitivity: 'base' }) * dir;
        });
    }, [rows, sort, accessors]);

    return { sorted, sort, toggleSort };
}
