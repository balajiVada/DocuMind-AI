import { create } from 'zustand';
import { apiClient } from '../services/api';

export interface ChatSession {
  _id: string;
  title: string;
  messageCount: number;
  updatedAt: string;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoadingSessions: boolean;
  
  fetchSessions: () => Promise<void>;
  createSession: () => Promise<string>;
  setActiveSession: (id: string | null) => void;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  isLoadingSessions: false,

  fetchSessions: async () => {
    set({ isLoadingSessions: true });
    try {
      const response = await apiClient.get('/chat/sessions');
      set({ sessions: response.data });
      
      const currentActive = get().activeSessionId;
      if (!currentActive && response.data.length > 0) {
        set({ activeSessionId: response.data[0]._id });
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
    } finally {
      set({ isLoadingSessions: false });
    }
  },

  createSession: async () => {
    try {
      const response = await apiClient.post('/chat/sessions');
      const newSession = response.data;
      set(state => ({
        sessions: [newSession, ...state.sessions],
        activeSessionId: newSession._id,
      }));
      return newSession._id;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  deleteSession: async (id) => {
    try {
      await apiClient.delete(`/chat/sessions/${id}`);
      set(state => {
        const newSessions = state.sessions.filter(s => s._id !== id);
        return {
          sessions: newSessions,
          activeSessionId: state.activeSessionId === id 
            ? (newSessions[0]?._id || null) 
            : state.activeSessionId
        };
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  },

  renameSession: async (id, title) => {
    try {
      await apiClient.put(`/chat/sessions/${id}`, { title });
      set(state => ({
        sessions: state.sessions.map(s => s._id === id ? { ...s, title } : s)
      }));
    } catch (error) {
      console.error('Failed to rename session:', error);
    }
  }
}));
