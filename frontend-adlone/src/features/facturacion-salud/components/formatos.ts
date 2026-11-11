/** Fila de datos que devuelve la API (columnas de la base). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Fila = Record<string, any>;

// ---------------------------------------------------------------------------------------------------------------------------
// Formatos
// ---------------------------------------------------------------------------------------------------------------------------

/** Pesos chilenos sin decimales: 1.234.567 */
export const fmtClp = (n: unknown): string => Math.round(Number(n) || 0).toLocaleString('es-CL');

/** Unidades de fomento (o cualquier número con decimales fijos): 12,50 */
export const fmtNum = (n: unknown, decimales = 2): string =>
    (Number(n) || 0).toLocaleString('es-CL', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** yyyy-mm-dd → dd/mm/yyyy ('' si no es una fecha). Acepta también dd/mm/yyyy. */
export const aDmy = (v: unknown): string => {
    const s = String(v ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10);
    return '';
};

/** dd/mm/yyyy → yyyy-mm-dd, para los selectores de fecha ('' si no es una fecha). */
export const aIso = (v: unknown): string => {
    const s = String(v ?? '').trim();
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return `${s.slice(6, 10)}-${s.slice(3, 5)}-${s.slice(0, 2)}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return '';
};

export const hoyIso = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Número desde un cuadro de texto (acepta coma decimal). */
export const aNumero = (v: string): number => {
    const n = Number(String(v).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

/** Descarga un texto como archivo en Windows-1252 (el formato que espera el emisor). */
export const descargarArchivoAnsi = (nombre: string, base64: string): void => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const url = window.URL.createObjectURL(new Blob([bytes], { type: 'text/plain;charset=windows-1252' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};

/** Descarga filas como CSV que Excel abre bien (UTF-8 con BOM, separador punto y coma). */
export const descargarCsv = (nombre: string, columnas: string[], filas: Fila[]): void => {
    const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const texto = [columnas.map(celda).join(';'), ...filas.map((f) => columnas.map((c) => celda(f[c])).join(';'))].join('\r\n');
    const url = window.URL.createObjectURL(new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
};


/** Celda de tabla que permite varias líneas (la tabla nunca corta el texto). */
export const celdaTexto = 'whitespace-normal break-words align-top';
