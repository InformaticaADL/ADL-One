import { useEffect, useState } from 'react';

/** Dependency-free media-query hook (no external UI library needed). */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia(query).matches : false
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const listener = () => setMatches(mql.matches);
        listener();
        mql.addEventListener('change', listener);
        return () => mql.removeEventListener('change', listener);
    }, [query]);

    return matches;
}
