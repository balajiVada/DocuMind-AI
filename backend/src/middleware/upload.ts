import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from './auth.middleware';

// Ensure base uploads directory exists
const baseUploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(baseUploadDir)) {
  fs.mkdirSync(baseUploadDir, { recursive: true });
}

export interface UploadRequest extends AuthenticatedRequest {
  documentId?: string;
}

const storage = multer.diskStorage({
  destination: (req: UploadRequest, file, cb) => {
    const workspaceId = req.workspaceId ? req.workspaceId.toString() : 'default_workspace';
    
    // Generate documentId early to construct the path
    const documentId = new mongoose.Types.ObjectId().toString();
    req.documentId = documentId;

    const workspaceDir = path.join(baseUploadDir, workspaceId);
    const docDir = path.join(workspaceDir, documentId);

    // Create the structured directories
    fs.mkdirSync(docDir, { recursive: true });
    
    cb(null, docDir);
  },
  filename: (req, file, cb) => {
    // Keep the original extension but normalize the name to prevent path traversal
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, safeOriginalName);
  },
});

const fileFilter = (req: any, file: any, cb: any) => {
  const allowedExtensions = ['.pdf', '.docx', '.txt', '.csv', '.xlsx', '.pptx'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} is not supported.`), false);
  }
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // Increased to 50MB
  },
});
