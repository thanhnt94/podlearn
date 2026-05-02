import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import axios from 'axios'
import App from './App.tsx'

// ── Global Axios Config (JWT & API Base) ─────────────────────
axios.defaults.baseURL = '/';

axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && !config.url?.startsWith('http')) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle global 401 errors in Admin Studio
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn("Unauthorized access to admin API.");
    }
    return Promise.reject(error);
  }
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
