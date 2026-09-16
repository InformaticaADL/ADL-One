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

    return (
        <div className="shadcn-scope fixed bottom-5 right-5 z-[900] flex flex-col gap-2">
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
