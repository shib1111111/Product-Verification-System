import { apiClient } from '../api/apiClient.js';

export default {
    template: `
        <div class="container-fluid py-2">
            <div class="row justify-content-center">
                <div class="col-12 col-xl-10">
                    <h4 class="mb-4 text-secondary"><i class="bi bi-upc-scan me-2"></i>Floor Validation</h4>
                    
                    <div class="card shadow-sm border-0 rounded-4 mb-4">
                        <div class="card-body p-4 p-md-5">
                            <form @submit.prevent="verifyProduct">
                                <div class="row g-4">
                                    <div class="col-12 col-md-6">
                                        <label class="form-label fw-bold">Scan or Enter WID <span class="text-muted fw-normal fs-6">(Optional if Image uploaded)</span></label>
                                        <div class="input-group input-group-lg shadow-sm rounded-pill overflow-hidden border">
                                            <span class="input-group-text bg-white border-0 text-muted"><i class="bi bi-upc"></i></span>
                                            <input type="text" v-model="wid" class="form-control border-0 px-2" placeholder="e.g. WID-123456" autofocus :disabled="loading">
                                        </div>
                                    </div>
                                    
                                    <div class="col-12 col-md-6">
                                        <label class="form-label fw-bold">OCR Engine</label>
                                        <select v-model="ocrMethod" class="form-select form-select-lg rounded-pill shadow-sm px-4 border" :disabled="loading">
                                            <option value="local_ocr">OCR (Local / Fast)</option>
                                            <option value="gemini">Google Gemini AI (Cloud / Smart)</option>
                                        </select>
                                    </div>

                                    <div class="col-12">
                                        <label class="form-label fw-bold">Capture Product Image <span class="text-muted fw-normal fs-6">(Optional if WID entered)</span></label>
                                        <input type="file" @change="onImageChange" accept="image/*" capture="environment" class="form-control form-control-lg rounded-pill px-4 shadow-sm border" :disabled="loading">
                                    </div>
                                    
                                    <div class="col-12 mt-4 pt-2">
                                        <button type="submit" class="btn btn-primary btn-lg w-100 rounded-pill fw-bold shadow" :disabled="loading || (!wid && !image)">
                                            <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
                                            <i v-else class="bi bi-search me-2"></i>
                                            {{ loading ? 'Verifying & Saving...' : 'Verify Product' }}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <div v-if="error" class="alert alert-danger shadow-sm rounded-4 border-0 d-flex align-items-center p-4 mb-4">
                        <i class="bi bi-exclamation-octagon-fill fs-3 me-3"></i>
                        <div class="fs-5">{{ error }}</div>
                    </div>

                    <div v-if="result" class="card text-white shadow border-0 rounded-4 transition-all" :class="result.status === 'Match' ? 'bg-success' : 'bg-warning text-dark'">
                        <div class="card-body p-4 p-md-5 text-center">
                            <i class="bi display-1 mb-3" :class="result.status === 'Match' ? 'bi-check-circle-fill text-white' : 'bi-exclamation-triangle-fill text-dark'"></i>
                            <h3 class="fw-bold mb-4">{{ result.status === 'Match' ? 'Verified Successfully' : 'Verification Mismatch / Manual Check Needed' }}</h3>
                            
                            <div class="row text-start mt-4 justify-content-center">
                                <div class="mb-3" :class="result.ocr_method ? 'col-12 col-md-6' : 'col-12 col-md-8'">
                                    <div class="bg-white bg-opacity-25 rounded-4 p-4 shadow-sm h-100 border border-white border-opacity-25">
                                        <h5 class="fw-bold mb-4"><i class="bi bi-database me-2"></i>System Database Info</h5>
                                        <p class="mb-3"><span class="text-uppercase fw-bold opacity-75 d-block text-sm">EAN</span> <span class="fs-5 fw-semibold">{{ result.db_product?.ean || 'N/A' }}</span></p>
                                        <p class="mb-3"><span class="text-uppercase fw-bold opacity-75 d-block text-sm">Mfg Date</span> <span class="fs-5 fw-semibold">{{ result.db_product?.mfg_date || 'N/A' }}</span></p>
                                        <p class="mb-0"><span class="text-uppercase fw-bold opacity-75 d-block text-sm">Exp Date</span> <span class="fs-5 fw-semibold">{{ result.db_product?.exp_date || 'N/A' }}</span></p>
                                    </div>
                                </div>
                                
                                <div class="col-12 col-md-6 mb-3" v-if="result.ocr_method">
                                    <div class="bg-white bg-opacity-25 rounded-4 p-4 shadow-sm h-100 border border-white border-opacity-25">
                                        <h5 class="fw-bold mb-4"><i class="bi bi-robot me-2"></i>{{ result.ocr_method === 'gemini' ? 'Gemini AI' : 'OCR' }} Extracted Info</h5>
                                        <p class="mb-3"><span class="text-uppercase fw-bold opacity-75 d-block text-sm">Mfg Date</span> <span class="fs-5 fw-semibold">{{ result.extracted_data?.mfg_date || 'Not detected' }}</span></p>
                                        <p class="mb-0"><span class="text-uppercase fw-bold opacity-75 d-block text-sm">Exp Date</span> <span class="fs-5 fw-semibold">{{ result.extracted_data?.exp_date || 'Not detected' }}</span></p>
                                    </div>
                                </div>
                            </div>
                            
                            <div v-if="result.notes" class="bg-white text-dark rounded-4 p-4 mt-3 text-start shadow-sm fs-6">
                                <h6 class="fw-bold text-primary mb-2"><i class="bi bi-journal-text me-2"></i>Diagnostic Notes</h6>
                                <p class="mb-0 text-muted" style="white-space: pre-wrap;">{{ result.notes }}</p>
                            </div>
                            
                            <button @click="reset" class="btn btn-light btn-lg w-100 rounded-pill mt-4 fw-bold shadow-sm" :class="result.status === 'Match' ? 'text-success' : 'text-dark'">
                                <i class="bi bi-arrow-clockwise me-2"></i> Scan Next Product
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `,
    setup() {
        // ... (Keep existing setup() logic exactly the same)
        const { ref } = Vue;
        const wid = ref('');
        const image = ref(null);
        const ocrMethod = ref('local_ocr');
        const loading = ref(false);
        const error = ref('');
        const result = ref(null);

        const onImageChange = (e) => { image.value = e.target.files[0]; };

        const verifyProduct = async () => {
            loading.value = true; error.value = ''; result.value = null;
            
            const fd = new FormData();
            if (wid.value.trim()) fd.append('wid', wid.value.trim()); 
            fd.append('ocr_method', ocrMethod.value);
            if (image.value) fd.append('image', image.value);
            
            try {
                const res = await apiClient.fetch('/api/validations/analyze', { method: 'POST', body: fd });
                result.value = res.data;
            } catch (err) { 
                error.value = err.message; 
            } finally { 
                loading.value = false; 
            }
        };
        
        const reset = () => {
            wid.value = ''; image.value = null; result.value = null; error.value = '';
            const fileInput = document.querySelector('input[type="file"]'); 
            if (fileInput) fileInput.value = '';
        };
        
        return { wid, image, ocrMethod, loading, error, result, onImageChange, verifyProduct, reset };
    }
};