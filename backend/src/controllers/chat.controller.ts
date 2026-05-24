import { Request, Response } from 'express';
import { vectorService } from '../services/vector.service';
import { llmService, ChatMessage } from '../services/llm.service';
import { logger } from '../utils/logger';

export const handleChat = async (req: Request, res: Response): Promise<any> => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message query is required and must be a string.' });
  }

  try {
    // 1. Generate embedding for user query
    const queryVector = await vectorService.embedText(message);

    // 2. Search Pinecone for similar chunks
    const matches = await vectorService.querySimilarity(queryVector, 6);

    // 3. Extract and map citations
    const citations = matches.map((match: any) => ({
      fileName: match.metadata?.fileName || 'Unknown Document',
      pageNumber: match.metadata?.pageNumber || 1,
      text: match.metadata?.text || '',
      score: match.score || 0,
    }));

    // 4. Construct context text
    const contextText = matches
      .map((match: any, index: number) => {
        const source = `[Source ${index + 1}: ${match.metadata?.fileName || 'Unknown'}, Page ${match.metadata?.pageNumber || 1}]`;
        return `${source}\n${match.metadata?.text || ''}`;
      })
      .join('\n\n');

    // 5. Setup SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Establish the connection immediately

    // Send citations first
    res.write(`data: ${JSON.stringify({ type: 'citations', citations })}\n\n`);

    // 6. Build RAG prompt messages
    const systemPrompt = `You are DocuMind-AI, a helpful, production-grade enterprise document intelligence assistant.
Your goal is to answer the user's question accurately using ONLY the provided document context chunks.

Strict Guidelines:
1. Base your answer solely on the provided document context. Do NOT use outside information or speculation.
2. If the answer cannot be found in the context, explicitly say: "I'm sorry, but I couldn't find any information about that in the uploaded documents."
3. Keep your answers highly clear, detailed, and structured.
4. When referring to facts from a document, suffix the sentence or point with its source index citation (e.g., [Source X]).

CONTEXT:
${contextText}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];

    // 7. Stream LLM response
    await llmService.generateResponse(messages, (token) => {
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    });

    // Send completed signal
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    logger.error({ err: error }, 'RAG Chat pipeline error');
    // If headers are already sent, write error event and close
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Internal RAG error' })}\n\n`);
      res.end();
    } else {
      return res.status(500).json({ error: error.message || 'Internal RAG error' });
    }
  }
};
