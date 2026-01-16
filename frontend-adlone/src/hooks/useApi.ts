import { useState, useEffect } from 'react';

interface UseApiReturn<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
    execute: (...params: any[]) => Promise<T>;
    reset: () => void;
}

/**
 * Custom hook for API calls
 * @param apiFunction - API function to call
 * @param immediate - Whether to call immediately on mount
 * @returns { data, loading, error, execute, reset }
 */
export const useApi = <T = any>(
    apiFunction: (...args: any[]) => Promise<T>,
    immediate = false
): UseApiReturn<T> => {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(immediate);
    const [error, setError] = useState<string | null>(null);

    const execute = async (...params: any[]): Promise<T> => {
        try {
            setLoading(true);
            setError(null);
            const result = await apiFunction(...params);
            setData(result);
            return result;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An error occurred';
            setError(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setData(null);
        setError(null);
        setLoading(false);
    };

    useEffect(() => {
        if (immediate) {
            execute();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return { data, loading, error, execute, reset };
};
