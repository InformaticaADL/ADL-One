import { useEffect, useState } from 'react';

/** Non-Mantine replacement for `@mantine/hooks`' useMediaQuery, so the parts of the
 * app already migrated to Ant Design don't need to pull in Mantine hooks. */
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
