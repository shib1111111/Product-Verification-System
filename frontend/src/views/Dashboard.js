import { useAuthStore } from '../store/authStore.js';

export default {
    template: `
        <div class="d-flex flex-column min-vh-100">
            <nav class="navbar navbar-expand navbar-dark bg-dark shadow-sm sticky-top">
                <div class="container-fluid px-3 px-md-4">
                    <a class="navbar-brand fw-bold d-flex align-items-center" href="#">
                        <i class="bi bi-box-seam text-primary me-2"></i><span class="d-none d-sm-inline">PVS</span>
                    </a>
                    
                    <div class="d-flex align-items-center text-white ms-auto">
                        <span class="me-3 text-nowrap">
                            <i class="bi bi-person-circle me-1 d-sm-none"></i>
                            <span class="d-none d-sm-inline">Welcome, <strong>{{ authStore.username }}</strong></span>
                            <span class="badge bg-secondary ms-1">{{ authStore.role }}</span>
                        </span>
                        <button class="btn btn-outline-light btn-sm rounded-pill px-3 fw-bold shadow-sm" @click="handleLogout">
                            <span class="d-none d-md-inline">Logout</span> <i class="bi bi-box-arrow-right ms-md-1"></i>
                        </button>
                    </div>
                </div>
            </nav>

            <div class="container-fluid flex-grow-1 p-0">
                <div class="row g-0 h-100 flex-column flex-md-row">
                    
                    <div class="col-12 col-md-3 col-lg-2 bg-white border-end shadow-sm z-1">
                        <div class="p-2 p-md-4 sticky-md-top" style="top: 60px;">
                            <ul class="nav nav-pills flex-row flex-md-column gap-2 flex-nowrap overflow-auto hide-scrollbar pb-1 pb-md-0 m-0">
                                <li class="nav-item" v-if="['admin'].includes(authStore.role)">
                                    <router-link class="nav-link text-dark shadow-sm-hover" active-class="active shadow text-white fw-bold" to="/dashboard/upload">
                                        <i class="bi bi-cloud-upload me-2"></i> Bulk Upload
                                    </router-link>
                                </li>
                                <li class="nav-item" v-if="['admin'].includes(authStore.role)">
                                    <router-link class="nav-link text-dark shadow-sm-hover" active-class="active shadow text-white fw-bold" to="/dashboard/users">
                                        <i class="bi bi-people-fill me-2"></i> Manage Users
                                    </router-link>
                                </li>
                                <li class="nav-item" v-if="['admin', 'operator'].includes(authStore.role)">
                                    <router-link class="nav-link text-dark shadow-sm-hover" active-class="active shadow text-white fw-bold" to="/dashboard/validate">
                                        <i class="bi bi-upc-scan me-2"></i> Floor Validation
                                    </router-link>
                                </li>
                                <li class="nav-item" v-if="['admin', 'qa'].includes(authStore.role)">
                                    <router-link class="nav-link text-dark shadow-sm-hover" active-class="active shadow text-white fw-bold" to="/dashboard/reports">
                                        <i class="bi bi-file-earmark-bar-graph me-2"></i> QA Reports
                                    </router-link>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div class="col-12 col-md-9 col-lg-10 p-3 p-md-4 p-lg-5 bg-light flex-grow-1">
                        <router-view></router-view>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const { useRouter } = VueRouter;
        const authStore = useAuthStore();
        const router = useRouter();

        const handleLogout = async () => {
            if (authStore.refreshToken) {
                try {
                    await fetch('/api/logout', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({refresh_token: authStore.refreshToken})
                    });
                } catch (e) {}
            }
            authStore.logoutLocally();
            router.push('/login');
        };

        return { authStore, handleLogout };
    }
};