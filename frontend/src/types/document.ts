export type DocumentStatus = 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

export interface Document {
  _id: string;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileType: string;
  fileSize: number;
  userId: string;
  workspaceId: string;
  folderId?: string;
  version: number;
  status: DocumentStatus;
  processingError?: string;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  uploadDate: string;
  chunkCount: number;
  metadata?: Record<string, any>;
}

export interface UploadResponse {
  message: string;
  document: Document;
}
