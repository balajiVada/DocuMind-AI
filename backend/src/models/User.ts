import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface IUser extends MongooseDocument {
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    firstName: { type: String },
    lastName: { type: String },
  },
  { timestamps: true }
);

// Unique index on email
UserSchema.index({ email: 1 }, { unique: true });

export default mongoose.model<IUser>('User', UserSchema);
