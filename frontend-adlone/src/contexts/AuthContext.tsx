import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
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
    }>({
        user: null,
        token: null
    });
    const [loading, setLoading] = useState(true);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Initialize state from Storage (Local or Session)
    useEffect(() => {
        const storedToken = localStorage.getItem('token') || sessionStorage.getItem('token');
        const storedUser = localStorage.getItem('user') || sessionStorage.getItem('user');

        if (storedToken && storedUser) {
            const parsedUser = JSON.parse(storedUser);
            setAuthState({
                token: storedToken,
                user: parsedUser
            });
            
            // Sincronizar cabecera de axios inmediatamente al restaurar
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
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
        useNavStore.getState().resetNavigation();
    }, []);

    // Interceptor para manejar errores 401 (No autorizado) globalmente
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                // Verificar si es un error 401 o 403
                if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                    // Evitar loop infinito si el error viene del login
                    if (!error.config.url.includes('/auth/login')) {
                        console.warn('Sesión expirada o no autorizada. Cerrando sesión...');
                        logout();
                    }
                }
                return Promise.reject(error);
            }
        );

        // Limpiar interceptor al desmontar
        return () => {
            axios.interceptors.response.eject(interceptor);
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
