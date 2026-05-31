import { RetrievedChunk } from './types';

// Reciprocal Rank Fusion constant k (typically 60)
const K = 60;

export function reciprocalRankFusion(
  semanticResults: RetrievedChunk[],
  keywordResults: RetrievedChunk[],
  topK: number = 6
): RetrievedChunk[] {
  const chunkMap = new Map<string, { chunk: RetrievedChunk; rrfScore: number; methods: Set<string> }>();

  // Helper to process a ranked list
  const processList = (results: RetrievedChunk[], method: 'semantic' | 'keyword') => {
    results.forEach((chunk, index) => {
      const rank = index + 1; // 1-indexed rank
      const rrfScore = 1 / (K + rank);
      
      const id = chunk.chunkId;
      if (chunkMap.has(id)) {
        const existing = chunkMap.get(id)!;
        existing.rrfScore += rrfScore; // Add scores for fusion
        existing.methods.add(method);
      } else {
        chunkMap.set(id, {
          chunk,
          rrfScore,
          methods: new Set([method]),
        });
      }
    });
  };

  processList(semanticResults, 'semantic');
  processList(keywordResults, 'keyword');

  // Convert map to array and format
  const fusedChunks = Array.from(chunkMap.values()).map(entry => {
    const isHybrid = entry.methods.has('semantic') && entry.methods.has('keyword');
    const primaryMethod = isHybrid 
      ? 'hybrid' 
      : entry.methods.values().next().value;

    return {
      ...entry.chunk,
      score: entry.rrfScore, // Override with normalized RRF score
      retrievalMethod: primaryMethod as 'semantic' | 'keyword' | 'hybrid',
    };
  });

  // Sort by final RRF score descending
  fusedChunks.sort((a, b) => b.score - a.score);

  // Return top K
  return fusedChunks.slice(0, topK);
}
