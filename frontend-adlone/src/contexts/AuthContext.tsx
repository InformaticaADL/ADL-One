import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_CONFIG from '../config/api.config';

interface User {
    id: number;
    username: string;
    name: string;
    email: string;
    role: number;
    permissions?: string[]; // RBAC Permissions
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, pass: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    loading: boolean;
    hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialize state from LocalStorage
    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            // Optional: Validate token validity here if API supports it
        }
        setLoading(false);
    }, []);

    const login = async (username: string, pass: string) => {
        try {
            const response = await axios.post(`${API_CONFIG.getBaseURL()}/api/auth/login`, {
                username,
                password: pass
            });

            if (response.data && response.data.success) {
                const { token, user } = response.data.data;
                setToken(token);
                // Ensure permissions are present
                setUser(user);
                localStorage.setItem('token', token);
                // Store full user object including permissions
                localStorage.setItem('user', JSON.stringify(user));
            } else {
                throw new Error(response.data.message || 'Error al iniciar sesión');
            }
        } catch (error: any) {
            console.error("Login Context Error:", error);
            throw error;
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // No reloading needed, App.tsx handles the view switch via isAuthenticated
    };

    // RBAC Helper
    const hasPermission = (permissionCode: string): boolean => {
        if (!user) return false;
        // If user is Admin (role==1 usually), allow all. Adjust logic as needed.
        // For now, strict check against permissions array.
        // Also check if permissions is undefined (e.g. old session), default to false.
        const perms = user.permissions || [];
        return perms.includes(permissionCode);
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            isAuthenticated: !!token,
            loading,
            hasPermission
        }}>
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
