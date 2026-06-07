export default {
    template: `
        <div class="row min-vh-100 justify-content-center align-items-center">
            <div class="col-12 col-md-6 col-lg-4">
                <div class="card shadow border-0 rounded-3">
                    <div class="card-body p-5">
                        <div class="text-center mb-4">
                            <h3 class="fw-bold text-success">Sign Up</h3>
                            <p class="text-muted">Create a new account</p>
                        </div>
                        
                        <div v-if="error" class="alert alert-danger">{{ error }}</div>
                        <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>
                        
                        <form @submit.prevent="signup">
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Username</label>
                                <input type="text" v-model="form.username" class="form-control form-control-lg" required placeholder="Choose a username">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-semibold">Password</label>
                                <input type="password" v-model="form.password" class="form-control form-control-lg" required placeholder="Create a password">
                            </div>
                            <div class="mb-4">
                                <label class="form-label fw-semibold">Role</label>
                                <select v-model="form.role" class="form-select form-select-lg">
                                    <option value="operator">Operator (Floor Check)</option>
                                    <option value="qa">QA (Reports)</option>
                                </select>
                            </div>
                            <button type="submit" class="btn btn-success w-100 btn-lg shadow-sm" :disabled="loading">
                                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>Sign Up
                            </button>
                        </form>
                        
                        <div class="text-center mt-4 pt-3 border-top">
                            <span class="text-muted">Already have an account?</span> 
                            <router-link to="/login" class="text-success text-decoration-none fw-semibold">Log In</router-link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const { ref } = Vue;

        const form = ref({ username: '', password: '', role: 'operator' });
        const loading = ref(false);
        const error = ref('');
        const successMsg = ref('');

        const signup = async () => {
            loading.value = true;
            error.value = '';
            successMsg.value = '';
            try {
                const res = await fetch('/api/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form.value)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || "Signup failed");
                successMsg.value = "Account created successfully! You can now log in.";
                form.value = { username: '', password: '', role: 'operator' };
            } catch (err) {
                error.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        return { form, loading, error, successMsg, signup };
    }
};