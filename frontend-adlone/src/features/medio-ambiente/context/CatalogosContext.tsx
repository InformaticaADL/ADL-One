import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Cache entry interface with TTL
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number; // milliseconds
}

// Loading state for each catalog
interface LoadingState {
    [key: string]: boolean;
}

// Context interface
interface CatalogosContextType {
    getCatalogo: <T>(
        key: string,
        fetcher: () => Promise<T>,
        ttl?: number
    ) => Promise<T>;
    invalidateCache: (key?: string) => void;
    isLoading: (key: string) => boolean;
    clearAllCache: () => void;
}

const CatalogosContext = createContext<CatalogosContextType | undefined>(undefined);

// Default TTL: 5 minutes
const DEFAULT_TTL = 5 * 60 * 1000;

export const CatalogosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const cacheRef = useRef<Map<string, CacheEntry<any>>>(new Map());
    const [loadingStates, setLoadingStates] = useState<LoadingState>({});
    const pendingRequestsRef = useRef<Map<string, Promise<any>>>(new Map());

    const getCatalogo = useCallback(async <T,>(
        key: string,
        fetcher: () => Promise<T>,
        ttl: number = DEFAULT_TTL
    ): Promise<T> => {
        // Check if data is in cache and still valid
        const cached = cacheRef.current.get(key);
        const now = Date.now();

        if (cached && (now - cached.timestamp) < cached.ttl) {
            console.log(`[Cache HIT] ${key} - serving from cache`);
            return cached.data as T;
        }

        // Check if request is already pending (deduplication)
        if (pendingRequestsRef.current.has(key)) {
            console.log(`[Cache PENDING] ${key} - returning existing promise`);
            return pendingRequestsRef.current.get(key) as Promise<T>;
        }

        // Set loading state
        setLoadingStates(prev => ({ ...prev, [key]: true }));

        // Create new request promise
        const requestPromise = fetcher()
            .then(data => {
                console.log(`[Cache MISS] ${key} - fetched from API, caching for ${ttl}ms`);
                // Store in cache
                cacheRef.current.set(key, {
                    data,
                    timestamp: Date.now(),
                    ttl
                });
                return data;
            })
            .catch(error => {
                console.error(`[Cache ERROR] ${key}:`, error);
                throw error;
            })
            .finally(() => {
                // Clear loading state and pending request
                setLoadingStates(prev => ({ ...prev, [key]: false }));
                pendingRequestsRef.current.delete(key);
            });

        // Store pending request
        pendingRequestsRef.current.set(key, requestPromise);

        return requestPromise;
    }, []);

    const invalidateCache = useCallback((key?: string) => {
        if (key) {
            console.log(`[Cache INVALIDATE] ${key}`);
            cacheRef.current.delete(key);
        } else {
            console.log('[Cache INVALIDATE] All cache cleared');
            cacheRef.current.clear();
        }
    }, []);

    const isLoading = useCallback((key: string): boolean => {
        return loadingStates[key] || false;
    }, [loadingStates]);

    const clearAllCache = useCallback(() => {
        console.log('[Cache CLEAR] Clearing all cache');
        cacheRef.current.clear();
        pendingRequestsRef.current.clear();
        setLoadingStates({});
    }, []);

    const value: CatalogosContextType = {
        getCatalogo,
        invalidateCache,
        isLoading,
        clearAllCache
    };

    return (
        <CatalogosContext.Provider value={value}>
            {children}
        </CatalogosContext.Provider>
    );
};

// Custom hook to use the context
export const useCatalogos = (): CatalogosContextType => {
    const context = useContext(CatalogosContext);
    if (!context) {
        throw new Error('useCatalogos must be used within a CatalogosProvider');
    }
    return context;
};

export default CatalogosContext;
