// API Configuration
interface ApiConfigType {
    getBaseURL: () => string;
    endpoints: {
        localhost: string;
        wifi: string;
        ethernet: string;
    };
    timeout: number;
    headers: {
        'Content-Type': string;
    };
}

const API_CONFIG: ApiConfigType = {
    // Automatically detect the best API URL based on environment
    getBaseURL: () => {
        // In production, use the production API URL
        if (import.meta.env.PROD) {
            return import.meta.env.VITE_API_URL || 'http://192.168.10.152:8002';
        }

        // In development, try to use the custom API URL or default to localhost
        return import.meta.env.VITE_API_URL || 'http://localhost:8002';
    },

    // Available endpoints for local network
    endpoints: {
        localhost: 'http://localhost:8002',
        wifi: 'http://192.168.10.152:8002',
        ethernet: 'http://192.168.10.68:8002',
    },

    // Timeout for API requests (in milliseconds)
    timeout: 30000,

    // Headers
    headers: {
        'Content-Type': 'application/json',
    },
};

export default API_CONFIG;
