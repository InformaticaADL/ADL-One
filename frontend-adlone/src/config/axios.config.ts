import axios from 'axios';
import API_CONFIG from './api.config';

/**
 * Centralized Axios Instance with Automatic Token Injection
 * 
 * This instance automatically adds the Authorization header to all requests
 * by checking both localStorage (Remember Me) and sessionStorage (default session).
 * 
 * Usage: Import this instance instead of axios directly in all service files.
 */
const apiClient = axios.create({
    baseURL: API_CONFIG.getBaseURL(),
    headers: {
        'Content-Type': 'application/json'
    }
});

// Request Interceptor: Automatically inject token from storage
apiClient.interceptors.request.use(
    (config) => {
        // Check localStorage first (Remember Me), then sessionStorage (default session)
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle common errors (optional, can be extended)
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        // You can add global error handling here if needed
        // For now, just pass through to let individual services handle errors
        return Promise.reject(error);
    }
);

export default apiClient;
