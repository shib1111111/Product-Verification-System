import Login from '../views/Login.js';
import Dashboard from '../views/Dashboard.js';
import BulkUpload from '../views/BulkUpload.js';
import FloorValidation from '../views/FloorValidation.js';
import QAReports from '../views/QAReports.js';
import UserManagement from '../views/UserManagement.js';
import { useAuthStore } from '../store/authStore.js';

const { createRouter, createWebHashHistory } = VueRouter;

const routes = [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: Login, meta: { guestOnly: true } },
    { 
        path: '/dashboard', 
        component: Dashboard, 
        meta: { requiresAuth: true },
        children: [
            { path: '', redirect: to => {
                const store = useAuthStore();
                if (store.role === 'admin') return '/dashboard/upload';
                if (store.role === 'operator') return '/dashboard/validate';
                if (store.role === 'qa') return '/dashboard/reports';
                return '/login';
            }},
            { path: 'upload', component: BulkUpload, meta: { roles: ['admin'] } },
            { path: 'users', component: UserManagement, meta: { roles: ['admin'] } },
            { path: 'validate', component: FloorValidation, meta: { roles: ['admin', 'operator'] } },
            { path: 'reports', component: QAReports, meta: { roles: ['admin', 'qa'] } }
        ]
    }
];

export const router = createRouter({
    history: createWebHashHistory(),
    routes
});

// Navigation Guards
router.beforeEach((to, from, next) => {
    const authStore = useAuthStore();
    const isAuthenticated = !!authStore.accessToken;

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login');
    } else if (to.meta.guestOnly && isAuthenticated) {
        next('/dashboard');
    } else if (to.meta.roles && !to.meta.roles.includes(authStore.role)) {
        next('/dashboard'); // unauthorized role redirection
    } else {
        next();
    }
});