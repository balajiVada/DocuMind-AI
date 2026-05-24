import { pinecone, PINECONE_INDEX_NAME } from "../config/pinecone";

export class VectorService {
  constructor() {}

  private generateMockVector(text: string): number[] {
    const vector = new Array(1536).fill(0);
    // Simple deterministic generation based on text content
    let seed = 0;
    for (let i = 0; i < text.length; i++) {
      seed += text.charCodeAt(i);
    }
    for (let i = 0; i < 1536; i++) {
      const x = Math.sin(seed++ + i) * 10000;
      vector[i] = x - Math.floor(x); // Gives a pseudo-random float between 0 and 1
    }
    return vector;
  }

  async embedText(text: string): Promise<number[]> {
    return this.generateMockVector(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateMockVector(text));
  }

  async upsertVectors(
    documentId: string,
    fileName: string,
    chunks: Array<{ text: string; pageNumber: number; chunkIndex: number }>
  ): Promise<void> {
    if (!pinecone) {
      throw new Error("Pinecone client is not initialized.");
    }

    const index = pinecone.Index(PINECONE_INDEX_NAME);

    // Embed all chunks
    const texts = chunks.map(c => c.text);
    const embeddings = await this.embedDocuments(texts);

    const records = chunks.map((chunk, idx) => {
      const vector = embeddings[idx];
      if (!vector) {
        throw new Error(`Failed to generate embedding for chunk ${idx}`);
      }
      return {
        id: `${documentId}-chunk-${chunk.chunkIndex}`,
        values: vector,
        metadata: {
          text: chunk.text,
          documentId: documentId,
          fileName: fileName,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
        },
      };
    });

    // Batch upsert to Pinecone (max 100 vectors per request is standard and safe)
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await index.upsert({ records: batch });
    }
  }

  async querySimilarity(vector: number[], topK = 6, filter?: Record<string, any>) {
    if (!pinecone) {
      throw new Error("Pinecone client is not initialized.");
    }

    const index = pinecone.Index(PINECONE_INDEX_NAME);

    const queryOptions: any = {
      vector,
      topK,
      includeMetadata: true,
    };

    if (filter) {
      queryOptions.filter = filter;
    }

    const response = await index.query(queryOptions);

    return response.matches || [];
  }
}

export const vectorService = new VectorService();
