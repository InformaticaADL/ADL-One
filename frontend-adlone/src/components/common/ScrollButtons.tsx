import { Button } from 'antd';
import { IconArrowUp, IconArrowDown } from '@tabler/icons-react';
import { useState, useEffect } from 'react';

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

    const btnStyle = (visible: boolean): React.CSSProperties => ({
        boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
        opacity: visible ? 0.85 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 150ms ease, transform 150ms ease',
    });

    return (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 900, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button
                type="primary"
                shape="circle"
                size="large"
                icon={<IconArrowUp size={20} />}
                onClick={scrollToTop}
                style={btnStyle(showTop)}
            />
            <Button
                type="primary"
                shape="circle"
                size="large"
                icon={<IconArrowDown size={20} />}
                onClick={scrollToBottom}
                style={btnStyle(showBottom)}
            />
        </div>
    );
};
