import { Request, Response } from 'express';
import DocumentModel from '../models/Document';
import fs from 'fs';
import path from 'path';
import { pinecone, PINECONE_INDEX_NAME } from '../config/pinecone';
import { documentService } from '../services/document.service';
import { logger } from '../utils/logger';

export const uploadDocument = async (req: Request, res: Response): Promise<any> => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, size, filename } = req.file;

    // Create record in MongoDB
    const doc = new DocumentModel({
      fileName: originalname,
      fileType: path.extname(originalname).toLowerCase().substring(1),
      fileSize: size,
      filePath: filename,
      status: 'processing',
      chunkCount: 0,
      metadata: {},
    });

    await doc.save();

    res.status(201).json({
      message: 'Document uploaded successfully, processing started.',
      document: doc,
    });

    // Trigger background processing asynchronously
    documentService.processDocument(doc._id.toString()).catch((err) => {
      logger.error({ err, fileName: doc.fileName }, 'Asynchronous document parsing failed');
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error uploading document');
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
