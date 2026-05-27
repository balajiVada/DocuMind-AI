import { pinecone, PINECONE_INDEX_NAME } from "../config/pinecone";
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI(process.env.GEMINI_API_KEY ? { apiKey: process.env.GEMINI_API_KEY } : {});

export class VectorService {
  constructor() {}

  async embedText(text: string): Promise<number[]> {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-2',
      contents: text,
      config: {
        outputDimensionality: 768,
      }
    });
    
    const embedding = response.embeddings?.[0]?.values;
    if (!embedding) {
      throw new Error("Failed to generate embedding from Gemini API.");
    }
    return embedding;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const response = await ai.models.embedContent({
          model: 'gemini-embedding-2',
          contents: text,
          config: {
            outputDimensionality: 768,
          }
        });
        return response.embeddings?.[0]?.values || [];
      })
    );
    
    if (embeddings.some(e => e.length === 0)) {
      throw new Error("Failed to generate embeddings for all documents from Gemini API.");
    }
    return embeddings as number[][];
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
