import { Job } from 'bullmq';
import fs from 'fs';
import DocumentModel from '../models/Document';
import DocumentChunk from '../models/DocumentChunk';
import { parserService } from '../services/parser.service';
import { chunkingService } from '../services/chunking.service';
import { vectorService } from '../services/vector.service';
import { pinecone, PINECONE_INDEX_NAME } from '../config/pinecone';
import { logger } from '../utils/logger';
import { queueService } from '../services/queue.service';

export const processDocumentJob = async (job: Job): Promise<void> => {
  const { documentId } = job.data;
  
  logger.info({ documentId, jobId: job.id, attempt: job.attemptsMade }, 'Starting document ingestion job');

  const doc = await DocumentModel.findById(documentId);
  if (!doc || doc.isDeleted) {
    logger.warn({ documentId }, 'Document not found or is deleted. Aborting job.');
    return;
  }

  // Idempotency: Clean up any partial data from previous failed attempts
  if (job.attemptsMade > 1) {
    logger.info({ documentId }, 'Retrying job: Cleaning up previous partial data');
    await cleanupPartialData(documentId);
  }

  if (!fs.existsSync(doc.filePath)) {
    doc.status = 'FAILED';
    doc.processingError = 'File missing from disk';
    await doc.save();
    throw new Error('File missing from disk');
  }

  try {
    // 1. Mark as PROCESSING
    doc.status = 'PROCESSING';
    doc.processingStartedAt = new Date();
    doc.jobId = job.id || 'unknown';
    doc.attempts = job.attemptsMade;
    await doc.save();

    logger.info({ documentId }, 'PARSING_STARTED');
    
    // 2. Parse File
    const parsedPages = await parserService.parseFile(doc.filePath, doc.fileType);
    logger.info({ documentId, pages: parsedPages.length }, 'PARSING_COMPLETED');

    // 3. Chunking
    logger.info({ documentId }, 'CHUNKING_STARTED');
    const chunks: Array<{ text: string; pageNumber: number; chunkIndex: number; chunkId: string }> = [];
    let globalChunkIndex = 0;

    for (const page of parsedPages) {
      const splitTexts = await chunkingService.splitText(page.text);
      
      for (const text of splitTexts) {
        if (text.trim().length > 0) {
          const chunkDoc = new DocumentChunk({
            documentId: doc._id,
            chunkIndex: globalChunkIndex,
            pageNumber: page.pageNumber,
            text: text.trim(),
          });
          await chunkDoc.save();

          chunks.push({
            text: text.trim(),
            pageNumber: page.pageNumber,
            chunkIndex: globalChunkIndex++,
            chunkId: chunkDoc._id.toString(),
          });
        }
      }
    }
    logger.info({ documentId, totalChunks: chunks.length }, 'CHUNKING_COMPLETED');

    // 4. Embedding & Indexing
    logger.info({ documentId }, 'EMBEDDING_AND_INDEXING_STARTED');
    await vectorService.upsertVectors(
      doc._id.toString(),
      doc.workspaceId.toString(),
      doc.userId.toString(),
      doc.version || 1,
      doc.fileName,
      chunks,
      doc.folderId ? doc.folderId.toString() : undefined
    );
    logger.info({ documentId }, 'INDEXING_COMPLETED');

    // 5. Finalize
    doc.status = 'READY';
    doc.processingCompletedAt = new Date();
    doc.chunkCount = chunks.length;
    doc.metadata = {
      ...doc.metadata,
      pageCount: parsedPages.length,
    };
    await doc.save();

    logger.info({ documentId }, 'Ingestion fully completed. READY.');

  } catch (error: any) {
    logger.error({ err: error, documentId }, 'Ingestion pipeline failed');
    
    // Cleanup partial data on failure to prevent orphaned chunks
    await cleanupPartialData(documentId);

    doc.status = 'FAILED';
    doc.processingError = error.message || 'Unknown processing error';
    await doc.save();
    
    // Re-throw so BullMQ knows it failed and handles retries
    throw error;
  }
};

const cleanupPartialData = async (documentId: string) => {
  try {
    // Clean MongoDB chunks
    await DocumentChunk.deleteMany({ documentId });
    
    // Clean Pinecone vectors
    if (pinecone) {
      const index = pinecone.Index(PINECONE_INDEX_NAME);
      await index.deleteMany({ filter: { documentId } });
    }
    logger.info({ documentId }, 'Partial data cleanup successful');
  } catch (error) {
    logger.error({ err: error, documentId }, 'Failed to cleanup partial data');
  }
};

// Register worker with concurrency limit
export const startWorker = () => {
  queueService.registerWorker('DocumentIngestionQueue', processDocumentJob, 3);
};
