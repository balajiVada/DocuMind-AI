import { Request, Response } from 'express';
import DocumentModel from '../models/Document';
import fs from 'fs';
import path from 'path';
import { pinecone, PINECONE_INDEX_NAME } from '../config/pinecone';
import { logger } from '../utils/logger';
import { generateFileHash } from '../utils/hash';
import { queueService } from '../services/queue.service';
import { UploadRequest } from '../middleware/upload';

export const uploadDocument = async (req: UploadRequest, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!req.user || !req.workspaceId || !req.documentId) {
      return res.status(401).json({ error: 'Authentication required or missing workspace' });
    }

    const { originalname, size, filename, path: filePath, mimetype } = req.file;
    const fileType = path.extname(originalname).toLowerCase().substring(1);

    // 1. Generate hash from the saved file
    const fileHash = await generateFileHash(filePath);

    // 2. Check for duplicate in the same workspace
    const existingDoc = await DocumentModel.findOne({
      workspaceId: req.workspaceId,
      fileHash,
      isDeleted: false,
    });

    if (existingDoc) {
      // Clean up the newly uploaded duplicate file
      if (fs.existsSync(filePath)) {
        // Delete the structured directory since we don't need it
        const docDir = path.dirname(filePath);
        fs.rmSync(docDir, { recursive: true, force: true });
      }
      
      logger.info({ fileHash, workspaceId: req.workspaceId }, 'Duplicate document detected. Returning existing.');
      return res.status(200).json({
        message: 'Document already exists in workspace.',
        document: existingDoc,
      });
    }

    const { folderId } = req.body;

    // 3. Create record in MongoDB
    const doc = new DocumentModel({
      _id: req.documentId,
      fileName: filename,
      originalFileName: originalname,
      mimeType: mimetype,
      fileType: fileType,
      fileSize: size,
      filePath: filePath, // Storing the full relative/absolute path
      fileHash,
      userId: req.user._id,
      uploadedBy: req.user._id,
      workspaceId: req.workspaceId,
      folderId: folderId || null,
      status: 'QUEUED',
      chunkCount: 0,
      metadata: {},
    });

    await doc.save();

    // 4. Enqueue BullMQ job
    await queueService.addJob('DocumentIngestionQueue', 'ProcessDocument', {
      documentId: doc._id.toString(),
    });

    return res.status(201).json({
      message: 'Document uploaded and queued for processing.',
      document: doc,
    });

  } catch (error: any) {
    logger.error({ err: error }, 'Error uploading document');
    
    // Cleanup on failure
    if (req.file && fs.existsSync(req.file.path)) {
      const docDir = path.dirname(req.file.path);
      fs.rmSync(docDir, { recursive: true, force: true });
    }

    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const listDocuments = async (req: Request, res: Response): Promise<any> => {
  try {
    const documents = await DocumentModel.find().sort({ uploadDate: -1 });
    return res.status(200).json(documents);
  } catch (error: any) {
    logger.error({ err: error }, 'Error fetching documents');
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const deleteDocument = async (req: Request, res: Response): Promise<any> => {
  try {
    const { id } = req.params;

    const doc = await DocumentModel.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 1. Delete file from local uploads
    const fullPath = path.join(__dirname, '../../uploads', doc.filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // 2. Delete vectors from Pinecone if client is active
    if (pinecone) {
      try {
        const index = pinecone.Index(PINECONE_INDEX_NAME);
        await index.deleteMany({
          filter: {
            documentId: doc._id.toString(),
          },
        });
        logger.info({ documentId: doc._id.toString() }, 'Deleted Pinecone vectors for document');
      } catch (pcError) {
        logger.error({ err: pcError }, 'Error deleting Pinecone vectors');
      }
    }

    // 3. Delete from MongoDB
    await DocumentModel.findByIdAndDelete(id);

    return res.status(200).json({ message: 'Document and associated vectors deleted successfully.' });
  } catch (error: any) {
    logger.error({ err: error }, 'Error deleting document');
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const retryDocument = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const doc = await DocumentModel.findOne({ _id: id, workspaceId: req.workspaceId });

    if (!doc) {
      return res.status(404).json({ error: 'Document not found in your workspace' });
    }

    if (doc.status !== 'FAILED') {
      return res.status(400).json({ error: 'Only failed documents can be retried' });
    }

    // Reset status and enqueue again
    doc.status = 'QUEUED';
    doc.processingError = '';
    await doc.save();

    await queueService.addJob('DocumentIngestionQueue', 'ProcessDocument', {
      documentId: doc._id.toString(),
    });

    return res.status(200).json({
      message: 'Document ingestion retry queued successfully',
      document: doc,
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error retrying document');
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
};

export const updateDocumentFolder = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { folderId } = req.body; // Can be null to remove from folder

    const document = await DocumentModel.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId, isDeleted: false },
      { folderId: folderId || null },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    return res.status(200).json(document);
  } catch (error: any) {
    logger.error({ err: error }, 'Failed to update document folder');
    return res.status(500).json({ error: 'Failed to update document folder' });
  }
};

