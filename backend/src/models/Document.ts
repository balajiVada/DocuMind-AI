import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocument extends MongooseDocument {
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  fileHash?: string;
  userId: mongoose.Types.ObjectId;
  uploadedBy: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  folderId?: mongoose.Types.ObjectId;
  version: number;
  status: 'UPLOADING' | 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';
  processingError?: string;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  jobId?: string;
  attempts: number;
  retryCount: number;
  pineconeNamespace?: string;
  uploadDate: Date;
  chunkCount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  metadata: {
    pageCount?: number;
    author?: string;
    [key: string]: any;
  };
}

const DocumentSchema: Schema = new Schema({
  fileName: { type: String, required: true },
  originalFileName: { type: String, required: true },
  mimeType: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  filePath: { type: String, required: true },
  fileHash: { type: String },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
  folderId: { type: Schema.Types.ObjectId, ref: 'Folder' },
  version: { type: Number, default: 1 },
  status: { 
    type: String, 
    enum: ['UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED'], 
    default: 'UPLOADING' 
  },
  processingError: { type: String },
  processingStartedAt: { type: Date },
  processingCompletedAt: { type: Date },
  jobId: { type: String },
  attempts: { type: Number, default: 0 },
  retryCount: { type: Number, default: 0 },
  pineconeNamespace: { type: String },
  uploadDate: { type: Date, default: Date.now },
  chunkCount: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  metadata: { type: Object, default: {} },
}, { timestamps: true });

DocumentSchema.index({ userId: 1 });
DocumentSchema.index({ workspaceId: 1 });
DocumentSchema.index({ folderId: 1 });
DocumentSchema.index({ fileHash: 1, workspaceId: 1 });

export default mongoose.model<IDocument>('Document', DocumentSchema);
