import { apiClient } from '../api/apiClient.js';

export default {
    template: `
        <div class="container-fluid py-4">
            <div class="row justify-content-center">
                <div class="col-12 col-md-10 col-lg-8">
                    <div class="d-flex justify-content-between align-items-center mb-4">
                        <h3 class="mb-0 text-secondary"><i class="bi bi-cloud-arrow-up me-2"></i>Bulk Upload Products</h3>
                    </div>
                    
                    <div class="card shadow border-0 rounded-4">
                        <div class="card-body p-4 p-md-5">
                            <div class="text-center mb-4">
                                <div class="display-1 text-primary mb-3 opacity-75">
                                    <i class="bi bi-file-earmark-spreadsheet-fill"></i>
                                </div>
                                <h4 class="fw-bold text-dark">Upload Product CSV</h4>
                                <p class="text-muted">Ensure your file contains the following columns:<br>
                                <code class="bg-light px-2 py-1 rounded text-primary border shadow-sm">WID, EAN, Manufacturing_Date, Expiry_Date</code></p>
                            </div>

                            <form @submit.prevent="handleFileUpload" class="mb-4">
                                <div class="input-group input-group-lg shadow-sm rounded-pill overflow-hidden border">
                                    <input class="form-control border-0 ps-4 py-3" type="file" accept=".csv" @change="onFileChange" required :disabled="loading" id="csvFile">
                                    <button class="btn btn-primary px-4 px-md-5 fw-bold text-uppercase tracking-wide" type="submit" :disabled="loading || !uploadFile">
                                        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                        <i v-else class="bi bi-cloud-upload me-2"></i>
                                        <span class="d-none d-md-inline">{{ loading ? 'Uploading...' : 'Upload' }}</span>
                                    </button>
                                </div>
                            </form>
                            
                            <div v-if="uploadStatus" class="mt-4 p-4 bg-light rounded-4 border shadow-sm transition-all">
                                <div class="d-flex justify-content-between align-items-center mb-3">
                                    <h5 class="mb-0 fw-bold text-secondary">
                                        <i class="bi bi-activity me-2"></i>Live Progress
                                    </h5>
                                    <span class="badge rounded-pill px-3 py-2 fs-6" :class="statusBadgeClass">
                                        {{ uploadStatus.status.toUpperCase() }}
                                    </span>
                                </div>
                                
                                <div class="progress mb-3 shadow-sm rounded-pill bg-white border" style="height: 25px;">
                                    <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary fw-bold fs-6" role="progressbar" 
                                         :style="{ width: progressPercentage + '%' }">
                                        {{ progressPercentage }}%
                                    </div>
                                </div>
                                
                                <div class="d-flex justify-content-between align-items-center mt-4 pt-2 border-top">
                                    <div>
                                        <p v-if="uploadStatus.status === 'processing'" class="text-primary mb-0 fw-bold fs-5">
                                            <i class="bi bi-arrow-repeat me-2 fa-spin"></i> {{ uploadStatus.rows_processed }} / {{ uploadStatus.total_rows }} <span class="text-muted fw-normal fs-6">rows processed</span>
                                        </p>
                                        <p v-else-if="uploadStatus.status === 'completed'" class="text-success mb-0 fw-bold fs-5">
                                            <i class="bi bi-check-circle-fill me-2"></i> {{ uploadStatus.rows_processed }} <span class="text-muted fw-normal fs-6">rows successfully synced</span>
                                        </p>
                                        <p v-else-if="uploadStatus.status === 'cancelled'" class="text-warning mb-0 fw-bold fs-5">
                                            <i class="bi bi-exclamation-circle-fill me-2"></i> {{ uploadStatus.rows_processed }} <span class="text-muted fw-normal fs-6">rows processed before cancellation</span>
                                        </p>
                                    </div>
                                    
                                    <div>
                                        <button v-if="uploadStatus.status === 'processing'" @click="cancelUpload" class="btn btn-danger rounded-pill px-4 fw-bold shadow-sm">
                                            <i class="bi bi-x-circle-fill me-2"></i> Cancel Sync
                                        </button>
                                        <button v-else @click="resetForm" class="btn btn-secondary rounded-pill px-4 fw-bold shadow-sm">
                                            <i class="bi bi-check2-all me-2"></i> Done
                                        </button>
                                    </div>
                                </div>
                                
                                <div v-if="uploadStatus.error" class="alert alert-danger mt-3 mb-0 d-flex align-items-center border-0 shadow-sm rounded-3">
                                    <i class="bi bi-exclamation-triangle-fill fs-4 me-3"></i> 
                                    <div><strong>Error Encountered:</strong><br>{{ uploadStatus.error }}</div>
                                </div>
                            </div>

                            <div v-if="message && !uploadStatus" class="alert mt-4 mb-0 shadow-sm rounded-4 d-flex align-items-center border-0" :class="isError ? 'alert-danger' : 'alert-success'">
                                <i class="bi fs-3 me-3" :class="isError ? 'bi-exclamation-octagon-fill' : 'bi-check-circle-fill'"></i>
                                <div class="fs-5">{{ message }}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        const { ref, computed, onUnmounted } = Vue;
        const uploadFile = ref(null);
        const loading = ref(false);
        const message = ref('');
        const isError = ref(false);
        const uploadStatus = ref(null);
        const currentTaskId = ref(null);
        let pollInterval = null;

        const onFileChange = (e) => {
            uploadFile.value = e.target.files[0];
            uploadStatus.value = null;
            message.value = '';
        };

        const progressPercentage = computed(() => {
            if (!uploadStatus.value || uploadStatus.value.total_rows === 0) return 0;
            const pct = Math.round((uploadStatus.value.rows_processed / uploadStatus.value.total_rows) * 100);
            return Math.min(pct, 100);
        });

        const statusBadgeClass = computed(() => {
            if (!uploadStatus.value) return 'bg-secondary';
            if (uploadStatus.value.status === 'completed') return 'bg-success';
            if (uploadStatus.value.status === 'failed') return 'bg-danger';
            if (uploadStatus.value.status === 'cancelled') return 'bg-warning text-dark';
            return 'bg-primary';
        });

        const pollStatus = async (taskId) => {
            try {
                const res = await apiClient.fetch(`/api/products/upload-status/${taskId}`);
                uploadStatus.value = res.data;
                
                // FIXED SYNTAX ISSUE HERE
                if (['completed', 'failed', 'cancelled'].includes(res.data.status)) {
                    clearInterval(pollInterval);
                    pollInterval = null;
                    loading.value = false;
                    
                    if (res.data.status === 'completed') {
                        message.value = 'Upload completed successfully!';
                        isError.value = false;
                    } else if (res.data.status === 'cancelled') {
                        message.value = 'Upload was cancelled by the user.';
                        isError.value = true;
                    } else {
                        message.value = 'Upload failed: ' + res.data.error;
                        isError.value = true;
                    }
                }
            } catch (err) {
                clearInterval(pollInterval);
                pollInterval = null;
                loading.value = false;
                message.value = 'Failed to get upload status: ' + err.message;
                isError.value = true;
            }
        };

        const handleFileUpload = async () => {
            if (!uploadFile.value) return;
            loading.value = true;
            message.value = '';
            uploadStatus.value = null;
            isError.value = false;
            
            const fd = new FormData();
            fd.append('file', uploadFile.value);
            
            try {
                const res = await apiClient.fetch('/api/products/upload-csv', {
                    method: 'POST',
                    body: fd
                });
                message.value = res.message;
                
                if (res.data && res.data.task_id) {
                    currentTaskId.value = res.data.task_id;
                    uploadStatus.value = { status: 'processing', rows_processed: 0, total_rows: 0 };
                    pollInterval = setInterval(() => {
                        pollStatus(res.data.task_id);
                    }, 1000);
                } else {
                    loading.value = false;
                }
            } catch (err) {
                message.value = err.message;
                isError.value = true;
                loading.value = false;
            } finally {
                uploadFile.value = null;
            }
        };
        
        const cancelUpload = async () => {
            if (!currentTaskId.value) return;
            try {
                await apiClient.fetch(`/api/products/cancel-upload/${currentTaskId.value}`, {
                    method: 'POST'
                });
                if (uploadStatus.value && uploadStatus.value.status === 'processing') {
                    uploadStatus.value.status = 'cancelled';
                    loading.value = false;
                    if (pollInterval) {
                        clearInterval(pollInterval);
                        pollInterval = null;
                    }
                }
            } catch (err) {
                message.value = 'Failed to cancel upload: ' + err.message;
                isError.value = true;
            }
        };
        
        const resetForm = () => {
            uploadStatus.value = null;
            message.value = '';
            uploadFile.value = null;
            currentTaskId.value = null;
            isError.value = false;
            const fileInput = document.getElementById('csvFile');
            if (fileInput) fileInput.value = '';
        };

        onUnmounted(() => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        });

        return { 
            uploadFile, loading, message, isError, uploadStatus, 
            progressPercentage, statusBadgeClass, 
            onFileChange, handleFileUpload, cancelUpload, resetForm 
        };
    }
};