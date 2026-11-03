import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { IconEraser } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.2;
    };

    useEffect(() => {
        ajustarTamano();
        // Al cambiar el tamaño se pierde el dibujo: se limpia para no dejar un trazo deformado.
        const onResize = () => { ajustarTamano(); limites.current = null; setVacio(true); onChange?.(true); };
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
        const ctx = e.currentTarget.getContext('2d')!;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.1, 0, Math.PI * 2);
        ctx.fillStyle = '#0f172a';
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
        if (vacio) { setVacio(false); onChange?.(false); }
    };

    const onUp = () => { dibujando.current = false; ultimo.current = null; };

    const clear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
        limites.current = null;
        setVacio(true);
        onChange?.(true);
    };

    useImperativeHandle(ref, () => ({
        clear,
        toDataURL: () => {
            const canvas = canvasRef.current;
            const l = limites.current;
            if (!canvas || !l || vacio) return null;
            const dpr = window.devicePixelRatio || 1;
            const margen = 8;
            const sx = Math.max(0, (l.minX - margen) * dpr);
            const sy = Math.max(0, (l.minY - margen) * dpr);
            const sw = Math.min(canvas.width - sx, (l.maxX - l.minX + margen * 2) * dpr);
            const sh = Math.min(canvas.height - sy, (l.maxY - l.minY + margen * 2) * dpr);
            const escala = Math.min(1, 600 / sw);
            const out = document.createElement('canvas');
            out.width = Math.max(1, Math.round(sw * escala));
            out.height = Math.max(1, Math.round(sh * escala));
            out.getContext('2d')!.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
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
