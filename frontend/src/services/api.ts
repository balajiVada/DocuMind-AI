import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';

export interface DocumentInfo {
  _id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  status: 'processing' | 'indexed' | 'failed';
  uploadDate: string;
  chunkCount: number;
}

export const api = {
  getDocuments: async (): Promise<DocumentInfo[]> => {
    const response = await axios.get(`${API_BASE_URL}/documents`);
    return response.data;
  },

  uploadDocument: async (file: File, onUploadProgress?: (progressEvent: any) => void): Promise<DocumentInfo> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_BASE_URL}/documents/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress,
    });
    
    return response.data.document;
  },

  deleteDocument: async (id: string): Promise<void> => {
    await axios.delete(`${API_BASE_URL}/documents/${id}`);
  },
};
