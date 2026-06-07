import { apiClient } from '../api/apiClient.js';
import { useAuthStore } from '../store/authStore.js';

export default {
    template: `
        <div class="container-fluid py-3">
            <h4 class="mb-4 text-secondary"><i class="bi bi-people-fill me-2"></i>User Management</h4>
            
            <div class="row g-4">
                <div class="col-md-5 col-lg-4">
                    <div class="card shadow-sm border-0 rounded-4">
                        <div class="card-header bg-white border-0 pt-4 pb-0 px-4">
                            <h5 class="fw-bold m-0"><i class="bi bi-person-plus text-primary me-2"></i>Create User</h5>
                        </div>
                        <div class="card-body p-4">
                            <form @submit.prevent="createUser">
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Username</label>
                                    <input type="text" v-model="form.username" class="form-control" placeholder="Enter username" required :disabled="loading">
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label fw-bold">Password</label>
                                    <input type="password" v-model="form.password" class="form-control" placeholder="Create a password" required :disabled="loading" minlength="6">
                                </div>
                                
                                <div class="mb-4">
                                    <label class="form-label fw-bold">Assign Role</label>
                                    <select v-model="form.role" class="form-select" required :disabled="loading">
                                        <option value="" disabled>Select a role...</option>
                                        <option value="operator">Operator (Floor Validation Only)</option>
                                        <option value="qa">QA (View Reports Only)</option>
                                        <option value="admin">Admin (Full Access)</option>
                                    </select>
                                </div>
                                
                                <button type="submit" class="btn btn-primary w-100 fw-bold" :disabled="loading">
                                    <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                    <i v-else class="bi bi-check-lg me-1"></i>
                                    {{ loading ? 'Creating...' : 'Create User' }}
                                </button>
                            </form>
                            
                            <div v-if="message" :class="['alert mt-3 mb-0', isError ? 'alert-danger' : 'alert-success']">
                                {{ message }}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-md-7 col-lg-8">
                    <div class="card shadow-sm border-0 rounded-4 h-100">
                        <div class="card-header bg-white border-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
                            <h5 class="fw-bold m-0"><i class="bi bi-card-list text-primary me-2"></i>System Users</h5>
                            <button class="btn btn-sm btn-light" @click="fetchUsers" title="Refresh List"><i class="bi bi-arrow-clockwise"></i></button>
                        </div>
                        <div class="card-body p-0">
                            <div class="table-responsive">
                                <table class="table table-hover align-middle mb-0">
                                    <thead class="table-light">
                                        <tr>
                                            <th class="ps-4">Username</th>
                                            <th>Role</th>
                                            <th class="text-end pe-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr v-if="fetchingUsers">
                                            <td colspan="3" class="text-center py-4 text-muted">Loading users...</td>
                                        </tr>
                                        <tr v-else-if="users.length === 0">
                                            <td colspan="3" class="text-center py-4 text-muted">No users found.</td>
                                        </tr>
                                        <tr v-else v-for="user in users" :key="user.id">
                                            <td class="ps-4 fw-bold">
                                                {{ user.username }}
                                                <span v-if="user.username === authStore.username" class="badge bg-primary ms-2">You</span>
                                            </td>
                                            <td>
                                                <span class="badge" :class="{
                                                    'bg-danger': user.role === 'admin',
                                                    'bg-info text-dark': user.role === 'qa',
                                                    'bg-success': user.role === 'operator'
                                                }">{{ user.role.toUpperCase() }}</span>
                                            </td>
                                            <td class="text-end pe-4">
                                                <button class="btn btn-sm btn-outline-danger" 
                                                        @click="deleteUser(user.id, user.username)" 
                                                        :disabled="user.username === authStore.username || deletingId === user.id">
                                                    <span v-if="deletingId === user.id" class="spinner-border spinner-border-sm"></span>
                                                    <i v-else class="bi bi-trash3-fill"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const { ref, onMounted } = Vue;
        const authStore = useAuthStore();
        
        const form = ref({ username: '', password: '', role: '' });
        const users = ref([]);
        const loading = ref(false);
        const fetchingUsers = ref(false);
        const deletingId = ref(null);
        const message = ref('');
        const isError = ref(false);

        const fetchUsers = async () => {
            fetchingUsers.value = true;
            try {
                const response = await apiClient.fetch('/api/users/');
                users.value = response.data;
            } catch (err) {
                console.error("Failed to fetch users:", err);
            } finally {
                fetchingUsers.value = false;
            }
        };

        const createUser = async () => {
            loading.value = true;
            message.value = '';
            
            try {
                const response = await apiClient.fetch('/api/users/', {
                    method: 'POST',
                    body: JSON.stringify(form.value)
                });
                console.log("User creation response:", response);
                message.value = response.message || "User created successfully!";
                isError.value = false;
                form.value = { username: '', password: '', role: '' }; // Reset form
                fetchUsers(); // Refresh the table
            } catch (err) {
                message.value = err.message || "Failed to create user.";
                isError.value = true;
            } finally {
                loading.value = false;
            }
        };

        const deleteUser = async (id, username) => {
            if (!confirm(`Are you sure you want to completely delete the user '${username}'?`)) return;
            
            deletingId.value = id;
            try {
                await apiClient.fetch(`/api/users/${id}`, { method: 'DELETE' });
                fetchUsers(); // Refresh table on success
            } catch (err) {
                alert(`Error deleting user: ${err.message}`);
            } finally {
                deletingId.value = null;
            }
        };

        onMounted(() => {
            fetchUsers();
        });

        return { authStore, form, users, loading, fetchingUsers, deletingId, message, isError, createUser, fetchUsers, deleteUser };
    }
};