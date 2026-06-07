import { useAuthStore } from '../store/authStore.js';

export default {
    template: `
        <div class="row min-vh-100 justify-content-center align-items-center">
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card shadow border-0 rounded-3">
                    <div class="card-body p-5">
                        <div class="text-center mb-4">
                            <h3 class="fw-bold text-primary">Login</h3>
                            <p class="text-muted">Sign in to your account</p>
                        </div>
                        
                        <div v-if="error" class="alert alert-danger">{{ error }}</div>
                        
                        <form @submit.prevent="login">
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Username</label>
                                <input type="text" v-model="form.username" class="form-control form-control-lg" required placeholder="Enter username">
                            </div>
                            <div class="mb-4">
                                <label class="form-label fw-semibold">Password</label>
                                <input type="password" v-model="form.password" class="form-control form-control-lg" required placeholder="Enter password">
                            </div>
                            <button type="submit" class="btn btn-primary w-100 btn-lg shadow-sm" :disabled="loading">
                                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>Sign In
                            </button>
                        </form>

                        <div class="text-center mt-4 pt-3 border-top">
                            <span class="text-muted">Don't have an account?</span> 
                            <router-link to="/signup" class="text-primary text-decoration-none fw-semibold">Sign Up</router-link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const { ref } = Vue;
        const { useRouter } = VueRouter;
        const authStore = useAuthStore();
        const router = useRouter();

        const form = ref({ username: '', password: '' });
        const loading = ref(false);
        const error = ref('');

        const login = async () => {
            loading.value = true;
            error.value = '';
            try {
                const formData = new URLSearchParams();
                formData.append('username', form.value.username);
                formData.append('password', form.value.password);
                
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Login failed');
                
                authStore.setTokens(data.access_token, data.refresh_token, data.role, data.username);
                router.push('/dashboard');
            } catch (err) {
                error.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        return { form, loading, error, login };
    }
};