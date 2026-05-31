import { vectorService } from '../vector.service';
import { RetrievedChunk, RetrievalFilters } from './types';
import { logger } from '../../utils/logger';

export async function semanticRetrieve(
  query: string, 
  filters: RetrievalFilters,
  topK: number = 8,
  timeoutMs: number = 5000
): Promise<RetrievedChunk[]> {
  try {
    const queryVector = await vectorService.embedText(query);
    
    const pineconeFilters: Record<string, any> = { workspaceId: filters.workspaceId };
    
    const orConditions: any[] = [];
    if (filters.folderIds && filters.folderIds.length > 0) {
      orConditions.push({ folderId: { $in: filters.folderIds } });
    }
    if (filters.documentIds && filters.documentIds.length > 0) {
      orConditions.push({ documentId: { $in: filters.documentIds } });
    }

    if (orConditions.length === 1) {
      Object.assign(pineconeFilters, orConditions[0]);
    } else if (orConditions.length > 1) {
      pineconeFilters['$or'] = orConditions;
    }

    const searchPromise = vectorService.querySimilarity(queryVector, topK, pineconeFilters);
    const timeoutPromise = new Promise<any[]>((_, reject) => 
      setTimeout(() => reject(new Error('Semantic retrieval timeout')), timeoutMs)
    );

    const matches = await Promise.race([searchPromise, timeoutPromise]);

    return matches.map((match: any, index: number) => ({
      chunkId: match.metadata?.chunkId || `semantic-chunk-${index}`,
      documentId: match.metadata?.documentId || '',
      documentName: match.metadata?.fileName || 'Unknown Document',
      pageNumber: match.metadata?.pageNumber || 1,
      text: match.metadata?.text || '',
      score: match.score || 0,
      retrievalMethod: 'semantic',
      source: `[Source: ${match.metadata?.fileName || 'Unknown'}, Page ${match.metadata?.pageNumber || 1}]`,
      metadata: match.metadata,
    }));
  } catch (error: any) {
    logger.error({ err: error, filters }, 'Semantic retrieval failed');
    return []; // Return empty array on failure (fallback)
  }
}
