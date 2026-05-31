import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IDocumentChunk extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  chunkIndex: number;
  pageNumber?: number;
  text: string;
  tokenCount?: number;
  embeddingModel?: string;
  chunkingStrategy?: string;
  contentHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true },
    chunkIndex: { type: Number, required: true },
    pageNumber: { type: Number },
    text: { type: String, required: true },
    tokenCount: { type: Number },
    embeddingModel: { type: String },
    chunkingStrategy: { type: String },
    contentHash: { type: String },
  },
  { timestamps: true }
);

DocumentChunkSchema.index({ documentId: 1 });
DocumentChunkSchema.index({ text: 'text' });

export default mongoose.model<IDocumentChunk>('DocumentChunk', DocumentChunkSchema);
