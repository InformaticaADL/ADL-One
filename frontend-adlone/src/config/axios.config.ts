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
        // Handle 401 (Unauthorized) or 403 (Forbidden) errors
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            // Check if we're not already on the login page or trying to login
            if (!window.location.pathname.includes('/login') && !error.config.url.includes('/auth/login')) {
                console.warn('apiClient: Session expired or unauthorized. Clearing storage...');
                // Clear storage and redirect
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                // Redirect to login if possible, or reload to trigger AuthContext state change
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default apiClient;
