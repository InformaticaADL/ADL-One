export interface LoginCredentials {
    email: string;
    password: string;
    rememberMe?: boolean;
}

export interface AuthResponse {
    user: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    token: string;
}
