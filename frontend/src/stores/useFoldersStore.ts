import { create } from 'zustand';
import { folderService } from '../services/folderService';
import type { Folder } from '../services/folderService';

interface FoldersState {
  folders: Folder[];
  activeFolderId: string | null;
  isLoading: boolean;
  error: string | null;
  fetchFolders: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  setActiveFolder: (id: string | null) => void;
}

export const useFoldersStore = create<FoldersState>((set) => ({
  folders: [],
  activeFolderId: null,
  isLoading: false,
  error: null,

  fetchFolders: async () => {
    set({ isLoading: true, error: null });
    try {
      const folders = await folderService.getFolders();
      set({ folders, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch folders', isLoading: false });
    }
  },

  createFolder: async (name: string) => {
    try {
      const newFolder = await folderService.createFolder(name);
      set((state) => ({ folders: [newFolder, ...state.folders] }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to create folder' });
      throw err;
    }
  },

  updateFolder: async (id: string, name: string) => {
    try {
      const updatedFolder = await folderService.updateFolder(id, name);
      set((state) => ({
        folders: state.folders.map(f => f._id === id ? updatedFolder : f)
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to update folder' });
      throw err;
    }
  },

  deleteFolder: async (id: string) => {
    try {
      await folderService.deleteFolder(id);
      set((state) => ({
        folders: state.folders.filter(f => f._id !== id),
        activeFolderId: state.activeFolderId === id ? null : state.activeFolderId
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete folder' });
      throw err;
    }
  },

  setActiveFolder: (id: string | null) => {
    set({ activeFolderId: id });
  }
}));
