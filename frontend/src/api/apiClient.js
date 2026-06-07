import { useAuthStore } from '../store/authStore.js';

export const apiClient = {
    async fetch(url, options = {}) {
        const authStore = useAuthStore();
        
        // Initialize headers safely
        options.headers = options.headers || {};
        
        // Inject auth token
        if (authStore.accessToken) {
            options.headers['Authorization'] = `Bearer ${authStore.accessToken}`;
        }
        
        // FIX for 422 Error: Automatically set JSON Content-Type if body is a string
        if (options.body && typeof options.body === 'string' && !options.headers['Content-Type']) {
            options.headers['Content-Type'] = 'application/json';
        }
        
        let response = await fetch(url, options);
        
        // Handle Token Expiry
        if (response.status === 401 && authStore.refreshToken) {
            const refreshRes = await fetch('/api/refresh', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({refresh_token: authStore.refreshToken})
            });
            
            if (refreshRes.ok) {
                const data = await refreshRes.json();
                authStore.setTokens(data.access_token, authStore.refreshToken, authStore.role, authStore.username);
                // Retry requested call
                options.headers['Authorization'] = `Bearer ${data.access_token}`;
                response = await fetch(url, options);
            } else {
                authStore.logoutLocally();
                window.location.hash = '#/login'; // Redirect to login
            }
        }
        
        const contentType = response.headers.get("content-type");
        const isJson = contentType && contentType.indexOf("application/json") !== -1;
        
        if (!response.ok) {
            const errorData = isJson ? await response.json() : await response.text();
            throw new Error(errorData.detail || errorData.message || 'Request failed');
        }
        
        return isJson ? await response.json() : response;
    }
};