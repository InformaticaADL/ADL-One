/**
 * Un color del tema con transparencia. Los colores del tema son variables CSS (var(--sc-primary)…), así que no se les puede pegar
 * un sufijo hexadecimal como a «#1677ff1a»: se mezclan con transparente. `porcentaje` es la opacidad (0 a 100).
 */
export const tinte = (color: string, porcentaje: number): string => `color-mix(in srgb, ${color} ${porcentaje}%, transparent)`;
