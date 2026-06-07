// Setup Pinia auth store
const { defineStore } = Pinia;

export const useAuthStore = defineStore('auth', {
    state: () => ({
        accessToken: localStorage.getItem('accessToken') || null,
        refreshToken: localStorage.getItem('refreshToken') || null,
        role: localStorage.getItem('role') || null,
        username: localStorage.getItem('username') || null
    }),
    actions: {
        setTokens(access, refresh, role, username) {
            this.accessToken = access;
            this.refreshToken = refresh;
            this.role = role;
            this.username = username;
            localStorage.setItem('accessToken', access);
            localStorage.setItem('refreshToken', refresh);
            localStorage.setItem('role', role);
            localStorage.setItem('username', username);
        },
        logoutLocally() {
            this.accessToken = null;
            this.refreshToken = null;
            this.role = null;
            this.username = null;
            localStorage.clear();
        }
    }
});