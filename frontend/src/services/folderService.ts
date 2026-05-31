import { apiClient } from './api';

export interface Folder {
  _id: string;
  name: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

export const folderService = {
  getFolders: async (): Promise<Folder[]> => {
    const response = await apiClient.get('/folders');
    return response.data;
  },

  createFolder: async (name: string): Promise<Folder> => {
    const response = await apiClient.post('/folders', { name });
    return response.data;
  },

  updateFolder: async (id: string, name: string): Promise<Folder> => {
    const response = await apiClient.put(`/folders/${id}`, { name });
    return response.data;
  },

  deleteFolder: async (id: string): Promise<void> => {
    await apiClient.delete(`/folders/${id}`);
  },
};
