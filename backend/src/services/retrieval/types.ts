export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  text: string;
  score: number;
  retrievalMethod: 'semantic' | 'keyword' | 'hybrid';
  source: string;
  metadata?: any;
}

export interface RetrievalFilters {
  workspaceId: string;
  folderIds?: string[];
  documentIds?: string[];
}

export interface RetrievalMetrics {
  retrievalRequestId: string;
  queryLatency: number;
  semanticLatency: number;
  keywordLatency: number;
  fusionLatency: number;
  semanticHits: number;
  keywordHits: number;
  chunksReturned: number;
  contextTokensEstimate: number;
  filters: RetrievalFilters;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  metrics: RetrievalMetrics;
}

export type PipelineStepStatus = 'pending' | 'completed' | 'failed';

export interface BasePipelineStep {
  step: string;
  status: PipelineStepStatus;
  timestamp: number;
  durationMs?: number;
}

export interface QueryReceivedStep extends BasePipelineStep {
  step: 'query_received';
  query: string;
}

export interface MemoryLoadedStep extends BasePipelineStep {
  step: 'memory_loaded';
  messageCount: number;
}

export interface QueryRewriteStep extends BasePipelineStep {
  step: 'query_rewritten';
  originalQuery: string;
  rewrittenQuery: string;
  wasRewritten: boolean;
}

export interface RetrievalStartedStep extends BasePipelineStep {
  step: 'retrieval_started';
}

export interface SemanticSearchStep extends BasePipelineStep {
  step: 'semantic_search_completed';
  chunksRetrieved: number;
  topScores: number[];
}

export interface KeywordSearchStep extends BasePipelineStep {
  step: 'keyword_search_completed';
  chunksRetrieved: number;
}

export interface FusionStep extends BasePipelineStep {
  step: 'fusion_completed';
  finalChunkCount: number;
}

export interface ContextCompilationStep extends BasePipelineStep {
  step: 'context_compiled';
  tokenEstimate: number;
  chunksUsed: number;
  retrievedChunks: RetrievedChunk[];
}

export interface PromptCompiledStep extends BasePipelineStep {
  step: 'prompt_compiled';
}

export interface GenerationStartedStep extends BasePipelineStep {
  step: 'generation_started';
}

export interface StreamFirstTokenStep extends BasePipelineStep {
  step: 'stream_first_token';
}

export interface GenerationCompletedStep extends BasePipelineStep {
  step: 'generation_completed';
  totalTokens: number;
}

export type PipelineStep =
  | QueryReceivedStep
  | MemoryLoadedStep
  | QueryRewriteStep
  | RetrievalStartedStep
  | SemanticSearchStep
  | KeywordSearchStep
  | FusionStep
  | ContextCompilationStep
  | PromptCompiledStep
  | GenerationStartedStep
  | StreamFirstTokenStep
  | GenerationCompletedStep;
