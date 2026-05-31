import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IChatSession extends MongooseDocument {
  title?: string;
  userId: mongoose.Types.ObjectId;
  workspaceId: mongoose.Types.ObjectId;
  messageCount: number;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSessionSchema = new Schema<IChatSession>(
  {
    title: { type: String },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    messageCount: { type: Number, default: 0 },
    lastMessageAt: { type: Date },
  },
  { timestamps: true }
);

ChatSessionSchema.index({ userId: 1 });
ChatSessionSchema.index({ workspaceId: 1 });

export default mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);
