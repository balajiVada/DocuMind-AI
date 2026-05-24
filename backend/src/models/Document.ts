import mongoose, { Schema, Document } from 'mongoose';

export interface IDocument extends Document {
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  status: 'processing' | 'indexed' | 'failed';
  uploadDate: Date;
  chunkCount: number;
  metadata: {
    pageCount?: number;
    author?: string;
    [key: string]: any;
  };
}

const DocumentSchema: Schema = new Schema({
  fileName: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: Number, required: true },
  filePath: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['processing', 'indexed', 'failed'], 
    default: 'processing' 
  },
  uploadDate: { type: Date, default: Date.now },
  chunkCount: { type: Number, default: 0 },
  metadata: { type: Object, default: {} },
});

export default mongoose.model<IDocument>('Document', DocumentSchema);
