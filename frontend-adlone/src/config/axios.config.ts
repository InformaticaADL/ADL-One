import axios from 'axios';
import API_CONFIG from './api.config';

/**
 * Centralized Axios Instance with Automatic Token Injection.
 * Auth error handling (401/403) is owned exclusively by AuthContext to avoid
 * double-logout and window.location conflicts in the SPA.
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
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

export default apiClient;
