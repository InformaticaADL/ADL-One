import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import apiClient from '../config/axios.config';
import API_CONFIG from '../config/api.config';
import { useNavStore } from '../store/navStore';

interface User {
    id: number;
    username: string;
    name: string;
    email: string;
    role: number | string;
    cargo?: string;
    roles?: string[];
    foto?: string;
    permissions?: string[]; // RBAC Permissions
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, pass: string, rememberMe?: boolean) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isAuthenticating: boolean; // New: to distinguish between loading from storage and idle
    loading: boolean;
    hasPermission: (permission: string | string[]) => boolean;
    updateUser: (newData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [authState, setAuthState] = useState<{
        user: User | null;
        token: string | null;
    }>(() => {
        // Read from storage immediately during state initialization to avoid flickers
        const storedToken = typeof window !== 'undefined' ? (localStorage.getItem('token') || sessionStorage.getItem('token')) : null;
        const storedUser = typeof window !== 'undefined' ? (localStorage.getItem('user') || sessionStorage.getItem('user')) : null;

        if (storedToken && storedUser) {
            try {
                const user = JSON.parse(storedUser);
                // Pre-set axios defaults if possible (though interceptors are better)
                if (typeof axios !== 'undefined') {
                    axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                }
                return { token: storedToken, user };
            } catch (e) {
                console.error('[Auth] Error parsing stored user in lazy init:', e);
                return { token: null, user: null };
            }
        }
        return { token: null, user: null };
    });

    const [loading, setLoading] = useState(() => {
        // If we found a session in lazy init, we might still want to show loader for a split second 
        // to ensure all stores (Zustand, etc) are synced, but usually false is fine if data is ready.
        const hasSession = !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
        return !hasSession; // Only load if we have no session to restore
    });
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Initialize state from Storage (Local or Session) - Final Sync
    useEffect(() => {
        const storedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
        const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

        // If lazy init didn't catch it or for extra safety
        if (storedToken && storedUser && !authState.token) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setAuthState({
                    token: storedToken,
                    user: parsedUser
                });
                axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
            } catch (error) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
            }
        }
        
        // Ensure loading is always off after mount
        setLoading(false);
    }, []);

    // Efecto para sincronizar el token con axios globalmente
    useEffect(() => {
        if (authState.token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${authState.token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [authState.token]);

    const login = async (username: string, pass: string, rememberMe: boolean = false) => {
        setIsAuthenticating(true);
        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/auth/login`, {
                username,
                password: pass,
                rememberMe
            });

            if (response.data && response.data.success) {
                const { token, user } = response.data.data;

                // Atómicamente actualizar token y usuario
                setAuthState({ token, user });

                // Establecer cabecera de axios inmediatamente post-login
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

                if (rememberMe) {
                    sessionStorage.removeItem('token');
                    sessionStorage.removeItem('user');
                    localStorage.setItem('token', token);
                    localStorage.setItem('user', JSON.stringify(user));
                } else {
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    sessionStorage.setItem('token', token);
                    sessionStorage.setItem('user', JSON.stringify(user));
                }
            } else {
                throw new Error(response.data.message || 'Error al iniciar sesión');
            }
        } catch (error: any) {
            console.error("Login Context Error:", error);
            throw error;
        } finally {
            setIsAuthenticating(false);
        }
    };

    const logout = useCallback(() => {
        setAuthState({ token: null, user: null });
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];

        // Reset navigation state to prevent unauthorized access on next login
        const navStore = useNavStore.getState();
        navStore.resetNavigation();
        navStore.setDynamicModules([]);
    }, []);

    // Interceptor para manejar errores 401 (No autorizado) globalmente
    useEffect(() => {
        const handleAuthError = (error: any) => {
            if (error.response && error.response.status === 401) {
                // Solo hacer logout en 401 (token inválido/expirado)
                // El 403 (sin permiso para esa acción) NO debe cerrar sesión
                const isLoginRequest = error.config?.url?.includes('/auth/login');
                if (!isLoginRequest) {
                    console.warn('[Auth] Session expired (401). Logging out...', {
                        status: error.response.status,
                        url: error.config?.url
                    });
                    logout();
                }
            }
            return Promise.reject(error);
        };


        // Añadir interceptor a la instancia global de axios
        const globalInterceptor = axios.interceptors.response.use(
            (response) => response,
            handleAuthError
        );

        // [IMPORTANTE] También añadirlo a apiClient ya que los servicios lo usan exclusivamente
        const apiClientInterceptor = apiClient.interceptors.response.use(
            (response) => response,
            handleAuthError
        );

        return () => {
            axios.interceptors.response.eject(globalInterceptor);
            apiClient.interceptors.response.eject(apiClientInterceptor);
        };
    }, [logout]);

    // RBAC Helper memoizado y más robusto
    const hasPermission = useCallback((permissionCode: string | string[]): boolean => {
        const currentUser = authState.user;
        if (!currentUser) return false;
        
        const perms = currentUser.permissions || [];
        
        // Super Admin access
        if (perms.includes('AI_MA_ADMIN_ACCESO')) return true;
        
        if (Array.isArray(permissionCode)) {
            return permissionCode.some(p => perms.includes(p));
        }
        
        return perms.includes(permissionCode);
    }, [authState.user]);

    const updateUser = useCallback((newData: Partial<User>) => {
        setAuthState(prev => {
            if (!prev.user) return prev;
            const updatedUser = { ...prev.user, ...newData };
            
            // Update storage
            const storage = localStorage.getItem('user') ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(updatedUser));
            
            return { ...prev, user: updatedUser };
        });
    }, []);

    // Memoizar el valor del contexto para evitar re-renders innecesarios
    const contextValue = useMemo(() => ({
        user: authState.user,
        token: authState.token,
        login,
        logout,
        isAuthenticated: !!authState.token && !!authState.user,
        isAuthenticating,
        loading,
        hasPermission,
        updateUser
    }), [authState.user, authState.token, isAuthenticating, loading, hasPermission, logout, updateUser]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );

};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
