import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IWorkspace extends MongooseDocument {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

WorkspaceSchema.index({ ownerId: 1 });

export default mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
