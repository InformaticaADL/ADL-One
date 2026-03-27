import { Affix, Transition, Stack, ActionIcon, rem } from '@mantine/core';
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

    return (
        <Affix position={{ bottom: 20, right: 20 }} zIndex={900}>
            <Stack gap="xs">
                <Transition transition="slide-up" mounted={showTop}>
                    {(transitionStyles) => (
                        <ActionIcon
                            color="adl-blue"
                            size="lg"
                            radius="xl"
                            variant="filled"
                            style={{ 
                                ...transitionStyles,
                                boxShadow: 'var(--mantine-shadow-md)',
                                opacity: 0.8
                            }}
                            onClick={scrollToTop}
                        >
                            <IconArrowUp style={{ width: rem(20), height: rem(20) }} />
                        </ActionIcon>
                    )}
                </Transition>

                <Transition transition="slide-up" mounted={showBottom}>
                    {(transitionStyles) => (
                        <ActionIcon
                            color="adl-blue"
                            size="lg"
                            radius="xl"
                            variant="filled"
                            style={{ 
                                ...transitionStyles,
                                boxShadow: 'var(--mantine-shadow-md)',
                                opacity: 0.8
                            }}
                            onClick={scrollToBottom}
                        >
                            <IconArrowDown style={{ width: rem(20), height: rem(20) }} />
                        </ActionIcon>
                    )}
                </Transition>
            </Stack>
        </Affix>
    );
};
