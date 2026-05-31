import { v4 as uuidv4 } from 'uuid';
import { semanticRetrieve } from './semantic';
import { keywordRetrieve } from './keyword';
import { reciprocalRankFusion } from './fusion';
import { RetrievalFilters, RetrievalResult, RetrievalMetrics } from './types';
import { logger } from '../../utils/logger';

import { PipelineStep } from './types';

export class RetrievalService {
  /**
   * Main retrieval orchestrator.
   * Executes hybrid search using Pinecone (Semantic) and MongoDB (Keyword) concurrently.
   */
  async retrieve(
    query: string,
    filters: RetrievalFilters,
    semanticTopK = 8,
    keywordTopK = 8,
    finalTopK = 5,
    onPipelineStep?: (step: PipelineStep) => void
  ): Promise<RetrievalResult> {
    const requestId = uuidv4();
    const tStart = performance.now();

    logger.info({ requestId, query, filters }, 'Starting hybrid retrieval');
    if (onPipelineStep) {
      onPipelineStep({
        step: 'retrieval_started',
        status: 'completed',
        timestamp: Date.now(),
        durationMs: 0
      });
    }

    const [semanticResults, keywordResults] = await Promise.all([
      (async () => {
        const sStart = performance.now();
        const results = await semanticRetrieve(query, filters, semanticTopK);
        const durationMs = performance.now() - sStart;
        if (onPipelineStep) {
          onPipelineStep({
            step: 'semantic_search_completed',
            status: 'completed',
            timestamp: Date.now(),
            durationMs,
            chunksRetrieved: results.length,
            topScores: results.map(r => r.score)
          });
        }
        return { results, latency: durationMs };
      })(),
      (async () => {
        const kStart = performance.now();
        const results = await keywordRetrieve(query, filters, keywordTopK);
        const durationMs = performance.now() - kStart;
        if (onPipelineStep) {
          onPipelineStep({
            step: 'keyword_search_completed',
            status: 'completed',
            timestamp: Date.now(),
            durationMs,
            chunksRetrieved: results.length
          });
        }
        return { results, latency: durationMs };
      })()
    ]);

    const fStart = performance.now();
    const fusedChunks = reciprocalRankFusion(
      semanticResults.results, 
      keywordResults.results, 
      finalTopK
    );
    const fusionLatency = performance.now() - fStart;
    
    if (onPipelineStep) {
      onPipelineStep({
        step: 'fusion_completed',
        status: 'completed',
        timestamp: Date.now(),
        durationMs: fusionLatency,
        finalChunkCount: fusedChunks.length
      });
    }

    const totalLatency = performance.now() - tStart;

    // Token estimation (rough approximation: ~4 chars per token)
    const contextTokensEstimate = fusedChunks.reduce((acc, chunk) => acc + (chunk.text.length / 4), 0);

    if (onPipelineStep) {
      onPipelineStep({
        step: 'context_compiled',
        status: 'completed',
        timestamp: Date.now(),
        durationMs: totalLatency,
        tokenEstimate: Math.round(contextTokensEstimate),
        chunksUsed: fusedChunks.length,
        retrievedChunks: fusedChunks
      });
    }

    const metrics: RetrievalMetrics = {
      retrievalRequestId: requestId,
      queryLatency: totalLatency,
      semanticLatency: semanticResults.latency,
      keywordLatency: keywordResults.latency,
      fusionLatency,
      semanticHits: semanticResults.results.length,
      keywordHits: keywordResults.results.length,
      chunksReturned: fusedChunks.length,
      contextTokensEstimate: Math.round(contextTokensEstimate),
      filters,
    };

    logger.info({ metrics }, 'Hybrid retrieval complete');

    return {
      chunks: fusedChunks,
      metrics
    };
  }
}

export const retrievalService = new RetrievalService();
