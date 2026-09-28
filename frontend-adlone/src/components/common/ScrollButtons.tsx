import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScrollButtonsProps {
    viewportRef: React.RefObject<HTMLDivElement | null>;
}

export const ScrollButtons: React.FC<ScrollButtonsProps> = ({ viewportRef }) => {
    const [scrollPos, setScrollPos] = useState(0);
    const [canScrollDown, setCanScrollDown] = useState(false);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const handleScroll = () => {
            setScrollPos(viewport.scrollTop);
            const hasMore = viewport.scrollHeight > viewport.clientHeight + viewport.scrollTop + 50;
            setCanScrollDown(hasMore);
        };

        viewport.addEventListener('scroll', handleScroll);
        handleScroll();

        // Also check on resize as scrollHeight might change
        window.addEventListener('resize', handleScroll);

        const observer = new MutationObserver(handleScroll);
        observer.observe(viewport, { childList: true, subtree: true });

        return () => {
            viewport.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
            observer.disconnect();
        };
    }, [viewportRef]);

    const scrollToTop = () => {
        viewportRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const scrollToBottom = () => {
        const viewport = viewportRef.current;
        if (viewport) {
            viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        }
    };

    const showTop = scrollPos > 300;
    const showBottom = canScrollDown;

    // Ocultos en teléfono: al estar fijos abajo a la derecha (z-900) tapaban los
    // controles de esa esquina —en Gestión de Equipos cubrían el botón "Siguiente"
    // de la paginación, así que el toque caía en el flotante y parecía que la
    // paginación no respondía—. En pantalla táctil el gesto de desplazar ya cumple
    // esa función.
    return (
        <div className="shadcn-scope fixed bottom-5 right-5 z-[900] hidden flex-col gap-2 md:flex">
            <Button
                size="icon"
                onClick={scrollToTop}
                className={cn(
                    'h-11 w-11 rounded-full shadow-lg transition-all duration-150',
                    showTop ? 'translate-y-0 opacity-85' : 'pointer-events-none translate-y-3 opacity-0'
                )}
            >
                <IconArrowUp size={20} />
            </Button>
            <Button
                size="icon"
                onClick={scrollToBottom}
                className={cn(
                    'h-11 w-11 rounded-full shadow-lg transition-all duration-150',
                    showBottom ? 'translate-y-0 opacity-85' : 'pointer-events-none translate-y-3 opacity-0'
                )}
            >
                <IconArrowDown size={20} />
            </Button>
        </div>
    );
};
