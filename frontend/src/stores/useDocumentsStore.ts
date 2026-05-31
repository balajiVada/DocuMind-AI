import { create } from 'zustand';
import type { Document } from '../types/document';
import { documentService } from '../services/documentService';

interface DocumentsState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDocuments: () => Promise<void>;
  addDocument: (doc: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  removeDocument: (id: string) => void;
  deleteDocument: (id: string) => Promise<void>;
  retryDocument: (id: string) => Promise<void>;
  updateDocumentFolder: (id: string, folderId: string | null) => Promise<void>;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  isLoading: false,
  error: null,

  fetchDocuments: async () => {
    set({ isLoading: true, error: null });
    try {
      const docs = await documentService.getDocuments();
      set({ documents: docs, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addDocument: (doc) => {
    set((state) => ({ documents: [doc, ...state.documents] }));
  },

  updateDocument: (id, updates) => {
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc._id === id ? { ...doc, ...updates } : doc
      ),
    }));
  },

  removeDocument: (id) => {
    set((state) => ({
      documents: state.documents.filter((doc) => doc._id !== id),
    }));
  },

  deleteDocument: async (id) => {
    try {
      await documentService.deleteDocument(id);
      get().removeDocument(id);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  retryDocument: async (id) => {
    try {
      const response = await documentService.retryDocument(id);
      get().updateDocument(id, response.document);
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },

  updateDocumentFolder: async (id: string, folderId: string | null) => {
    try {
      const updatedDoc = await documentService.updateDocumentFolder(id, folderId);
      get().updateDocument(id, { folderId: updatedDoc.folderId });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    }
  },
}));
