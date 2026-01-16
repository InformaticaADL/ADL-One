import API_CONFIG from '../config/api.config';

interface RequestOptions extends RequestInit {
    headers?: Record<string, string>;
}

class ApiService {
    private baseURL: string;

    constructor() {
        this.baseURL = API_CONFIG.getBaseURL();
    }

    /**
     * Make a GET request
     */
    async get<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'GET',
            ...options,
        });
    }

    /**
     * Make a POST request
     */
    async post<T = any>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: JSON.stringify(data),
            ...options,
        });
    }

    /**
     * Make a PUT request
     */
    async put<T = any>(endpoint: string, data: any, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data),
            ...options,
        });
    }

    /**
     * Make a DELETE request
     */
    async delete<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'DELETE',
            ...options,
        });
    }

    /**
     * Generic request method
     */
    async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const url = `${this.baseURL}${endpoint}`;

        const config: RequestInit = {
            ...options,
            headers: {
                ...API_CONFIG.headers,
                ...options.headers,
            },
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

            const response = await fetch(url, {
                ...config,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const error = await response.json().catch(() => ({
                    message: `HTTP Error ${response.status}`,
                }));
                throw new Error(error.message || `Request failed with status ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Request timeout - please check your connection');
            }
            throw error;
        }
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<any> {
        return this.get('/api/health');
    }

    /**
     * Change the base URL (useful for switching between network endpoints)
     */
    setBaseURL(url: string): void {
        this.baseURL = url;
    }

    /**
     * Get current base URL
     */
    getBaseURL(): string {
        return this.baseURL;
    }
}

export default new ApiService();
