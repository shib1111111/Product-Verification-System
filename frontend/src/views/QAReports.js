import { apiClient } from '../api/apiClient.js';
import { useAuthStore } from '../store/authStore.js';

export default {
    template: `
        <div class="container-fluid py-4">
            <h3 class="mb-4 text-secondary"><i class="bi bi-file-earmark-bar-graph me-2"></i>Verification Reports</h3>
            
            <div class="card shadow-sm border-0 rounded-4 mb-4">
                <div class="card-body p-4">
                    <form @submit.prevent="fetchReports" class="row g-3 align-items-end">
                        <div class="col-md-4">
                            <label class="form-label fw-bold">Start Date</label>
                            <input type="date" v-model="startDate" class="form-control" required :disabled="loading">
                        </div>
                        <div class="col-md-4">
                            <label class="form-label fw-bold">End Date</label>
                            <input type="date" v-model="endDate" class="form-control" required :disabled="loading">
                        </div>
                        <div class="col-md-4 d-flex gap-2">
                            <button type="submit" class="btn btn-primary flex-grow-1 fw-bold" :disabled="loading">
                                <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                <i v-else class="bi bi-search me-2"></i>Search
                            </button>
                            <button type="button" @click="downloadCSV" class="btn btn-success fw-bold" :disabled="loading || !reports.length">
                                <i class="bi bi-download me-2"></i>CSV
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div v-if="error" class="alert alert-danger shadow-sm rounded-4 border-0 d-flex align-items-center">
                <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i><div>{{ error }}</div>
            </div>

            <div class="card shadow-sm border-0 rounded-4 overflow-hidden" v-if="reports.length > 0">
                <div class="table-responsive">
                    <table class="table table-hover table-striped mb-0 align-middle">
                        <thead class="table-dark">
                            <tr>
                                <th>Validation ID</th>
                                <th>WID</th>
                                <th>EAN</th>
                                <th>Status</th>
                                <th>Operator</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="report in reports" :key="report.validation_id">
                                <td>#{{ report.validation_id }}</td>
                                <td class="fw-bold">{{ report.wid }}</td>
                                <td>{{ report.ean }}</td>
                                <td>
                                    <span class="badge" :class="report.status === 'Match' ? 'bg-success' : 'bg-warning text-dark'">
                                        {{ report.status }}
                                    </span>
                                </td>
                                <td><i class="bi bi-person-badge me-2 text-primary"></i>{{ report.operator_id }}</td>
                                <td>{{ new Date(report.timestamp).toLocaleString() }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            
            <div v-else-if="searched && reports.length === 0" class="text-center p-5 text-muted">
                <i class="bi bi-inbox fs-1"></i>
                <h5>No verification logs found for this date range.</h5>
            </div>
        </div>
    `,
    setup() {
        const { ref } = Vue;
        const authStore = useAuthStore();
        const startDate = ref('');
        const endDate = ref('');
        const reports = ref([]);
        const loading = ref(false);
        const error = ref('');
        const searched = ref(false);

        const fetchReports = async () => {
            loading.value = true; error.value = ''; searched.value = true;
            try {
                const res = await apiClient.fetch(`/api/reports/?start_date=${startDate.value}&end_date=${endDate.value}`);
                reports.value = res.data;
            } catch (err) {
                error.value = err.message;
            } finally {
                loading.value = false;
            }
        };

        const downloadCSV = async () => {
            try {
                const res = await fetch(`/api/reports/export?start_date=${startDate.value}&end_date=${endDate.value}&format=csv`, {
                    headers: { 'Authorization': `Bearer ${authStore.accessToken}` }
                });
                if (!res.ok) throw new Error("Failed to download CSV");
                
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `compliance_report_${startDate.value}_to_${endDate.value}.csv`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            } catch (err) {
                error.value = err.message;
            }
        };

        return { startDate, endDate, reports, loading, error, searched, fetchReports, downloadCSV };
    }
};