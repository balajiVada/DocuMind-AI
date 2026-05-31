import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/useAuthStore';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to inject JWT and Workspace ID
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Get latest state directly from Zustand store
    const { token, activeWorkspaceId } = useAuthStore.getState();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (activeWorkspaceId) {
      config.headers['x-workspace-id'] = activeWorkspaceId;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for global error normalization & 401 handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string; message?: string }>) => {
    // Auto-logout on 401 Unauthorized
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }

    // Normalize error message
    const normalizedError = 
      error.response?.data?.error || 
      error.response?.data?.message || 
      error.message || 
      'An unexpected error occurred.';

    return Promise.reject(new Error(normalizedError));
  }
);
