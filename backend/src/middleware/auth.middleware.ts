import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import Workspace from '../models/Workspace';
import mongoose from 'mongoose';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  workspaceId?: mongoose.Types.ObjectId;
}

export const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. No token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1] as string;
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;

    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;

    // Derive active workspace from headers or query
    const workspaceIdHeader = req.headers['x-workspace-id'] as string;
    if (workspaceIdHeader && mongoose.Types.ObjectId.isValid(workspaceIdHeader)) {
      // Validate user belongs to workspace (For MVP, we just check if it's the owner)
      const workspace = await Workspace.findOne({ _id: workspaceIdHeader, ownerId: user._id, isDeleted: false });
      if (workspace) {
        req.workspaceId = workspace._id as mongoose.Types.ObjectId;
      }
    }

    // Fallback: If no workspace ID provided, default to their first personal workspace
    if (!req.workspaceId) {
      const defaultWorkspace = await Workspace.findOne({ ownerId: user._id, isDeleted: false });
      if (defaultWorkspace) {
        req.workspaceId = defaultWorkspace._id as mongoose.Types.ObjectId;
      }
    }

    if (!req.workspaceId) {
      res.status(403).json({ error: 'No active workspace available for this user.' });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
