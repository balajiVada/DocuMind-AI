import { apiClient } from './api';
import type { AuthResponse, ProfileResponse } from '../types/auth';

export const authService = {
  login: async (credentials: Record<string, string>): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return data;
  },
  
  register: async (details: Record<string, string>): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/auth/register', details);
    return data;
  },

  getProfile: async (): Promise<ProfileResponse> => {
    const { data } = await apiClient.get<ProfileResponse>('/auth/me');
    return data;
  }
};
