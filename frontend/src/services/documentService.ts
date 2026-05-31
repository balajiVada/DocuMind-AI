import { apiClient } from './api';
import type { Document, UploadResponse } from '../types/document';

export const documentService = {
  getDocuments: async (): Promise<Document[]> => {
    const { data } = await apiClient.get<Document[]>('/documents');
    return data;
  },

  uploadDocument: async (file: File, folderId: string | null, onUploadProgress?: (progressEvent: any) => void): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const { data } = await apiClient.post<UploadResponse>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    
    return data;
  },

  deleteDocument: async (id: string): Promise<{ message: string }> => {
    const { data } = await apiClient.delete<{ message: string }>(`/documents/${id}`);
    return data;
  },

  retryDocument: async (id: string): Promise<{ message: string; document: Document }> => {
    const { data } = await apiClient.post<{ message: string; document: Document }>(`/documents/${id}/retry`);
    return data;
  },

  updateDocumentFolder: async (id: string, folderId: string | null): Promise<Document> => {
    const { data } = await apiClient.put<Document>(`/documents/${id}/folder`, { folderId });
    return data;
  }
};
