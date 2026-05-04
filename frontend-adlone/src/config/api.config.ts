// API Configuration
interface ApiConfigType {
    getBaseURL: () => string;
    endpoints: {
        localhost: string;
        [key: string]: string;
    };
    timeout: number;
    headers: {
        'Content-Type': string;
    };
}

const API_CONFIG: ApiConfigType = {
    // Automatically detect the best API URL based on environment
    getBaseURL: () => {
        if (import.meta.env.VITE_API_URL) {
            return import.meta.env.VITE_API_URL;
        }
        const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
        return `http://${hostname}:8002`;
    },

    // Available endpoints for local network (override via VITE_API_URL in .env)
    endpoints: {
        localhost: 'http://localhost:8002',
    },

    // Timeout for API requests (in milliseconds)
    timeout: 30000,

    // Headers
    headers: {
        'Content-Type': 'application/json',
    },
};

export default API_CONFIG;
