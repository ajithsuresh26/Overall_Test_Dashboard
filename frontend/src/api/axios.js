// src/api/axios.js
import axios from 'axios';

// ── SEGREGATED PORT MANAGEMENT FOR PRODUCTION DESKTOP BUNDLES ──────────────────
// Live VPS admin base for remote asset pulling
export const ADMIN_API_BASE = 'https://qairosolution.com'; 

// Points cleanly to your local Desktop Client Software App process thread
export const SOFTWARE_BACKEND_BASE = 'http://127.0.0.1:5001';

// Base instance mapping for standard industrial telemetry & robot stream logs
const api = axios.create({
    baseURL: SOFTWARE_BACKEND_BASE,
});

// FIX: Target your local backend server for authentication requests so the 
// local script can intercept your login credentials safely!
export const adminAuthApi = axios.create({
    baseURL: SOFTWARE_BACKEND_BASE, // <-- CHANGED THIS FROM ADMIN_API_BASE TO SOFTWARE_BACKEND_BASE
});

// Automatic token attachment interceptor mapping logic
const appendTokenInterceptor = (config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
};

api.interceptors.request.use(appendTokenInterceptor, e => Promise.reject(e));
adminAuthApi.interceptors.request.use(appendTokenInterceptor, e => Promise.reject(e));

export default api;