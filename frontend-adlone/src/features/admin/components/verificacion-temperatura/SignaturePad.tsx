import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IconEraser } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Color de la firma: azul tinta, como un lápiz pasta.
const TINTA_FIRMA = '#1a3a9c';
const GROSOR = 2.2;
// Ancho máximo de la imagen exportada: se redibuja a esta resolución para que
// en el PDF no se vea pixelada aunque se agrande.
const ANCHO_EXPORTADO = 1600;

type Punto = { x: number; y: number };

/** Dibuja los trazos con curvas suaves (en coordenadas ya escaladas). */
const dibujarTrazos = (ctx: CanvasRenderingContext2D, trazos: Punto[][], grosor: number) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = TINTA_FIRMA;
    ctx.fillStyle = TINTA_FIRMA;
    ctx.lineWidth = grosor;
    for (const t of trazos) {
        if (t.length === 1) {
            ctx.beginPath();
            ctx.arc(t[0].x, t[0].y, grosor / 2, 0, Math.PI * 2);
            ctx.fill();
            continue;
        }
        ctx.beginPath();
        ctx.moveTo(t[0].x, t[0].y);
        for (let i = 1; i < t.length - 1; i += 1) {
            const medio = { x: (t[i].x + t[i + 1].x) / 2, y: (t[i].y + t[i + 1].y) / 2 };
            ctx.quadraticCurveTo(t[i].x, t[i].y, medio.x, medio.y);
        }
        ctx.lineTo(t[t.length - 1].x, t[t.length - 1].y);
        ctx.stroke();
    }
};

export interface SignaturePadHandle {
    /** PNG en base64 (data URL) recortado a la firma, o null si está vacío. */
    toDataURL: () => string | null;
    clear: () => void;
}

interface Props {
    onChange?: (vacio: boolean) => void;
    className?: string;
}

// Panel para firmar con mouse, dedo o lápiz (Pointer Events). Se dibuja en un
// canvas a la resolución real de la pantalla para que el trazo no salga
// pixelado; al exportar se recorta al área firmada y se limita el ancho, así la
// imagen viaja liviana al backend.
export const SignaturePad = React.forwardRef<SignaturePadHandle, Props>(({ onChange, className }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dibujando = useRef(false);
    const ultimo = useRef<{ x: number; y: number } | null>(null);
    const limites = useRef<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null);
    // Los puntos de cada trazo: con ellos se redibuja la firma nítida al exportar.
    const trazos = useRef<Punto[][]>([]);
    const [vacio, setVacio] = useState(true);

    const ajustarTamano = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        const { width, height } = canvas.getBoundingClientRect();
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        const ctx = canvas.getContext('2d')!;
        ctx.scale(dpr, dpr);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = TINTA_FIRMA;
        ctx.lineWidth = GROSOR;
    };

    useEffect(() => {
        ajustarTamano();
        // Al cambiar el tamaño se pierde el dibujo: se limpia para no dejar un trazo deformado.
        const onResize = () => { ajustarTamano(); limites.current = null; trazos.current = []; setVacio(true); onChange?.(true); };
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const marcar = (p: { x: number; y: number }) => {
        const l = limites.current;
        limites.current = l
            ? { minX: Math.min(l.minX, p.x), minY: Math.min(l.minY, p.y), maxX: Math.max(l.maxX, p.x), maxY: Math.max(l.maxY, p.y) }
            : { minX: p.x, minY: p.y, maxX: p.x, maxY: p.y };
    };

    const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        dibujando.current = true;
        const p = punto(e);
        ultimo.current = p;
        marcar(p);
        trazos.current.push([p]);
        const ctx = e.currentTarget.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(p.x, p.y, GROSOR / 2, 0, Math.PI * 2);
        ctx.fillStyle = TINTA_FIRMA;
        ctx.fill();
    };

    const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!dibujando.current || !ultimo.current) return;
        const p = punto(e);
        const ctx = e.currentTarget.getContext('2d')!;
        ctx.beginPath();
        ctx.moveTo(ultimo.current.x, ultimo.current.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ultimo.current = p;
        marcar(p);
        trazos.current[trazos.current.length - 1]?.push(p);
        if (vacio) { setVacio(false); onChange?.(false); }
    };

    const onUp = () => { dibujando.current = false; ultimo.current = null; };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        limites.current = null;
        trazos.current = [];
        setVacio(true);
        onChange?.(true);
    };

    useImperativeHandle(ref, () => ({
        clear,
        // La firma se redibuja desde sus trazos a alta resolución (nítida y en
        // azul tinta), recortada al área firmada.
        toDataURL: () => {
            const l = limites.current;
            if (!l || vacio || !trazos.current.length) return null;
            const margen = 8;
            const ancho = l.maxX - l.minX + margen * 2;
            const alto = l.maxY - l.minY + margen * 2;
            const k = Math.max(1, Math.min(4, ANCHO_EXPORTADO / ancho));
            const out = document.createElement('canvas');
            out.width = Math.max(1, Math.round(ancho * k));
            out.height = Math.max(1, Math.round(alto * k));
            const escalados = trazos.current.map((t) => t.map((p) => ({ x: (p.x - l.minX + margen) * k, y: (p.y - l.minY + margen) * k })));
            dibujarTrazos(out.getContext('2d')!, escalados, GROSOR * k);
            return out.toDataURL('image/png');
        },
    }));

    return (
        <div className={cn('relative', className)}>
            <canvas
                ref={canvasRef}
                className="h-44 w-full cursor-crosshair touch-none rounded-lg border-2 border-dashed border-border bg-white"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerLeave={onUp}
                aria-label="Área para firmar"
            />
            {vacio && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                    Firme aquí con el mouse, el dedo o un lápiz
                </span>
            )}
            <span className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-slate-300" />
            <Button type="button" variant="ghost" size="sm" className="absolute right-2 top-2 h-7 text-xs" onClick={clear} disabled={vacio}>
                <IconEraser size={14} /> Limpiar
            </Button>
        </div>
    );
});
SignaturePad.displayName = 'SignaturePad';
