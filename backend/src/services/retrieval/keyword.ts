import DocumentChunk from '../../models/DocumentChunk';
import { RetrievedChunk, RetrievalFilters } from './types';
import { logger } from '../../utils/logger';
import mongoose from 'mongoose';

export async function keywordRetrieve(
  query: string, 
  filters: RetrievalFilters,
  topK: number = 8,
  timeoutMs: number = 5000
): Promise<RetrievedChunk[]> {
  try {
    const matchStage: any = {
      $text: { $search: query },
    };

    // Need to join Document to filter by workspaceId
    // Since DocumentChunk doesn't have workspaceId directly, we must lookup Document
    
    const docMatch: any = {
      'document.workspaceId': new mongoose.Types.ObjectId(filters.workspaceId)
    };

    const orConditions: any[] = [];
    if (filters.folderIds && filters.folderIds.length > 0) {
      orConditions.push({ 'document.folderId': { $in: filters.folderIds.map(id => new mongoose.Types.ObjectId(id)) } });
    }
    if (filters.documentIds && filters.documentIds.length > 0) {
      orConditions.push({ 'documentId': { $in: filters.documentIds.map(id => new mongoose.Types.ObjectId(id)) } });
    }

    if (orConditions.length === 1) {
      Object.assign(docMatch, orConditions[0]);
    } else if (orConditions.length > 1) {
      docMatch['$or'] = orConditions;
    }

    const pipeline = [
      { $match: matchStage },
      { $sort: { score: { $meta: 'textScore' } } },
      {
        $lookup: {
          from: 'documents',
          localField: 'documentId',
          foreignField: '_id',
          as: 'document'
        }
      },
      { $unwind: '$document' },
      { $match: docMatch },
      { $limit: topK },
      {
        $project: {
          _id: 1,
          documentId: 1,
          text: 1,
          pageNumber: 1,
          score: { $meta: 'textScore' },
          'document.fileName': 1,
        }
      }
    ];

    const searchPromise = DocumentChunk.aggregate(pipeline as mongoose.PipelineStage[]).exec();
    const timeoutPromise = new Promise<any[]>((_, reject) => 
      setTimeout(() => reject(new Error('Keyword retrieval timeout')), timeoutMs)
    );

    const results = await Promise.race([searchPromise, timeoutPromise]);

    return results.map((result: any) => ({
      chunkId: result._id.toString(),
      documentId: result.documentId.toString(),
      documentName: result.document?.fileName || 'Unknown Document',
      pageNumber: result.pageNumber || 1,
      text: result.text || '',
      score: result.score || 0, // Unbounded MongoDB textScore
      retrievalMethod: 'keyword',
      source: `[Source: ${result.document?.fileName || 'Unknown'}, Page ${result.pageNumber || 1}]`,
      metadata: {}, // Mongo metadata limited
    }));
  } catch (error: any) {
    logger.error({ err: error, filters }, 'Keyword retrieval failed');
    return []; // Return empty array on failure (fallback)
  }
}
