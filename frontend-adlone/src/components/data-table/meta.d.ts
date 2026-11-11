import '@tanstack/react-table';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        /** Nombre de la columna en el selector «Vista». */
        titulo?: string;
        /** Clases extra para el encabezado y las celdas de esta columna (ej. `hidden md:table-cell`). */
        className?: string;
    }
}
