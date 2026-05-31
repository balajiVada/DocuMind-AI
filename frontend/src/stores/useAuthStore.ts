import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Workspace } from '../types/auth';
import { authService } from '../services/authService';

interface AuthState {
  token: string | null;
  user: User | null;
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  login: (credentials: Record<string, string>) => Promise<void>;
  register: (details: Record<string, string>) => Promise<void>;
  logout: () => void;
  setActiveWorkspace: (workspaceId: string) => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      activeWorkspaceId: null,
      workspaces: [],
      isAuthenticated: false,
      isLoading: true,

      login: async (credentials) => {
        const response = await authService.login(credentials);
        set({
          token: response.token,
          user: response.user,
          activeWorkspaceId: response.defaultWorkspace?._id || null,
          workspaces: response.defaultWorkspace ? [response.defaultWorkspace] : [],
          isAuthenticated: true,
        });
      },

      register: async (details) => {
        const response = await authService.register(details);
        set({
          token: response.token,
          user: response.user,
          activeWorkspaceId: response.defaultWorkspace?._id || null,
          workspaces: response.defaultWorkspace ? [response.defaultWorkspace] : [],
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          activeWorkspaceId: null,
          workspaces: [],
          isAuthenticated: false,
          isLoading: false,
        });
      },

      setActiveWorkspace: (workspaceId) => {
        set({ activeWorkspaceId: workspaceId });
      },

      initializeAuth: async () => {
        const { token } = get();
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        try {
          const profile = await authService.getProfile();
          set({
            user: profile.user,
            workspaces: profile.workspaces,
            activeWorkspaceId: profile.activeWorkspaceId || (profile.workspaces.length > 0 ? profile.workspaces[0]._id : null),
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Token is invalid or expired
          get().logout();
        }
      },
    }),
    {
      name: 'auth-storage', // unique name for localStorage
      // Only persist token and activeWorkspaceId, avoiding stale user data
      partialize: (state) => ({ 
        token: state.token, 
        activeWorkspaceId: state.activeWorkspaceId 
      }),
    }
  )
);
