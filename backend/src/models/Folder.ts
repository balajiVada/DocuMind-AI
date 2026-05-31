import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IFolder extends MongooseDocument {
  name: string;
  workspaceId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema = new Schema<IFolder>(
  {
    name: { type: String, required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

FolderSchema.index({ workspaceId: 1 });

export default mongoose.model<IFolder>('Folder', FolderSchema);
