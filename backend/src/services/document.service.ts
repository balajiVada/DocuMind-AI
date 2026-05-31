import DocumentModel from '../models/Document';
import DocumentChunk from '../models/DocumentChunk';
import { parseFile } from '../utils/parser';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { vectorService } from './vector.service';
import { logger } from '../utils/logger';

export class DocumentService {
  private splitter: RecursiveCharacterTextSplitter;

  constructor() {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  }

  async processDocument(docId: string): Promise<void> {
    const doc = await DocumentModel.findById(docId);
    if (!doc) {
      logger.error({ docId }, 'Document process failed: ID not found');
      return;
    }

    try {
      logger.info({ fileName: doc.fileName }, 'Parsing document');
      const parsedPages = await parseFile(doc.filePath, doc.fileType);

      logger.info({ fileName: doc.fileName }, 'Chunking document');
      const chunks: Array<{ text: string; pageNumber: number; chunkIndex: number; chunkId: string }> = [];
      let globalChunkIndex = 0;

      for (const page of parsedPages) {
        const splitTexts = await this.splitter.splitText(page.text);
        
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

      logger.info({ chunksLength: chunks.length }, 'Vectorizing and storing chunks to Pinecone');
      await vectorService.upsertVectors(
        doc._id.toString(),
        doc.workspaceId.toString(),
        doc.userId.toString(),
        doc.version || 1,
        doc.fileName,
        chunks,
        doc.folderId ? doc.folderId.toString() : undefined
      );

      // Update document ingestion status in MongoDB
      doc.status = 'READY';
      doc.chunkCount = chunks.length;
      doc.metadata = {
        ...doc.metadata,
        pageCount: parsedPages.length,
      };
      
      await doc.save();
      logger.info({ fileName: doc.fileName }, 'Document successfully ingested and indexed');
    } catch (error) {
      logger.error({ err: error, fileName: doc.fileName }, 'Ingestion pipeline failed for document');
      doc.status = 'FAILED';
      await doc.save();
    }
  }
}

export const documentService = new DocumentService();
