import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { retrievalService } from '../services/retrieval';
import { llmService, ChatMessage as LLMChatMessage } from '../services/llm.service';
import { logger } from '../utils/logger';
import ChatSession from '../models/ChatSession';
import ChatMessage from '../models/ChatMessage';
import { PipelineStep } from '../services/retrieval/types';

export const handleChat = async (req: Request | any, res: Response): Promise<any> => {
  const { message, sessionId, filters = {} } = req.body;
  const workspaceId = req.workspaceId;
  const userId = req.user._id;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message query is required and must be a string.' });
  }

  const runId = uuidv4();
  
  // 0. Setup SSE headers immediately to stream pipeline steps
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); 

  const emitPipelineStep = (step: PipelineStep) => {
    res.write(`data: ${JSON.stringify({ 
      type: 'pipeline_step', 
      runId,
      timestamp: step.timestamp,
      payload: step 
    })}\n\n`);
  };

  emitPipelineStep({
    step: 'query_received',
    status: 'completed',
    timestamp: Date.now(),
    query: message
  });

  try {
    // 1. Session Handling
    let chatSession;
    if (sessionId) {
      chatSession = await ChatSession.findOne({ _id: sessionId, workspaceId });
      if (!chatSession) {
        throw new Error('Chat session not found in this workspace.');
      }
    } else {
      chatSession = new ChatSession({
        userId,
        workspaceId,
        title: message.substring(0, 40) + (message.length > 40 ? '...' : ''),
        messageCount: 0
      });
      await chatSession.save();
    }

    // 2. Sliding Window Memory (last 6 messages)
    const history = await ChatMessage.find({ chatSessionId: chatSession._id })
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();
    history.reverse(); // oldest -> newest

    const memoryContext = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    emitPipelineStep({
      step: 'memory_loaded',
      status: 'completed',
      timestamp: Date.now(),
      messageCount: memoryContext.length
    });

    // 3. Query Rewriting
    const tRewriteStart = performance.now();
    const rewrittenQuery = await llmService.rewriteQuery(message, memoryContext);
    const rewriteLatency = performance.now() - tRewriteStart;

    emitPipelineStep({
      step: 'query_rewritten',
      status: 'completed',
      timestamp: Date.now(),
      durationMs: rewriteLatency,
      originalQuery: message,
      rewrittenQuery,
      wasRewritten: rewrittenQuery !== message
    });

    // 4. Hybrid Retrieval Pipeline
    const tRetrievalStart = performance.now();
    const retrievalResult = await retrievalService.retrieve(
      rewrittenQuery, 
      { workspaceId, ...filters },
      8, 8, 5,
      emitPipelineStep
    );
    const retrievalLatency = performance.now() - tRetrievalStart;
    const matches = retrievalResult.chunks;

    // Extract citations
    const citations = matches.map(match => ({
      chunkId: match.chunkId,
      documentId: match.documentId,
      fileName: match.documentName,
      pageNumber: match.pageNumber,
      text: match.text,
      score: match.score,
      retrievalMethod: match.retrievalMethod,
    }));

    // 5. Construct Prompts separately
    const contextText = matches
      .map((match, index) => `${match.source}\n${match.text}`)
      .join('\n\n');

    const systemPrompt = `You are DocuMind-AI, a helpful, production-grade enterprise document intelligence assistant.
Your goal is to answer the user's question accurately using ONLY the provided document context chunks.

Strict Guidelines:
1. Base your answer solely on the provided document context. Do NOT use outside information or speculation.
2. If the answer cannot be found in the context, explicitly say: "I'm sorry, but I couldn't find any information about that in the uploaded documents."
3. Keep your answers highly clear, detailed, and structured.
4. When referring to facts from a document, suffix the sentence or point with its source index citation (e.g., [Source X]).
5. Use the conversation memory ONLY for context, but answer based on the CONTEXT chunks.

CONTEXT:
${contextText}`;

    const messages: LLMChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...memoryContext as LLMChatMessage[],
      { role: 'user', content: message },
    ];

    emitPipelineStep({
      step: 'prompt_compiled',
      status: 'completed',
      timestamp: Date.now()
    });

    // Persist User Message
    await ChatMessage.create({
      chatSessionId: chatSession._id,
      role: 'user',
      content: message,
    });
    chatSession.messageCount += 1;
    chatSession.lastMessageAt = new Date();
    await chatSession.save();

    // Send citations and metrics first
    const metadata = {
      ...retrievalResult.metrics,
      originalQuery: message,
      rewrittenQuery,
      rewriteLatency,
      retrievalLatency,
    };

    res.write(`data: ${JSON.stringify({ 
      type: 'citations', 
      citations,
      metrics: metadata,
      sessionId: chatSession._id
    })}\n\n`);

    // 7. Stream LLM response
    emitPipelineStep({
      step: 'generation_started',
      status: 'completed',
      timestamp: Date.now()
    });

    const tGenStart = performance.now();
    let fullResponse = '';
    let isFirstToken = true;
    
    await llmService.generateResponse(messages, (token) => {
      if (isFirstToken) {
        isFirstToken = false;
        emitPipelineStep({
          step: 'stream_first_token',
          status: 'completed',
          timestamp: Date.now(),
          durationMs: performance.now() - tGenStart
        });
      }
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    });
    const generationLatency = performance.now() - tGenStart;
    
    // Estimate LLM response tokens (very rough approximation)
    const totalTokens = Math.round(fullResponse.length / 4);
    
    emitPipelineStep({
      step: 'generation_completed',
      status: 'completed',
      timestamp: Date.now(),
      durationMs: generationLatency,
      totalTokens
    });

    // Persist Assistant Message
    await ChatMessage.create({
      chatSessionId: chatSession._id,
      role: 'assistant',
      content: fullResponse,
      citations,
      retrievalMetadata: {
        ...metadata,
        generationLatency,
      }
    });
    chatSession.messageCount += 1;
    chatSession.lastMessageAt = new Date();
    await chatSession.save();

    // Send completed signal
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    logger.error({ err: error }, 'RAG Chat pipeline error');
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message || 'Internal RAG error' })}\n\n`);
      res.end();
    } else {
      return res.status(500).json({ error: error.message || 'Internal RAG error' });
    }
  }
};

export const getSessions = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const sessions = await ChatSession.find({ workspaceId: req.workspaceId })
      .sort({ updatedAt: -1 })
      .lean();
    return res.json(sessions);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const createSession = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const chatSession = new ChatSession({
      userId: req.user._id,
      workspaceId: req.workspaceId,
      title: 'New Chat',
      messageCount: 0
    });
    await chatSession.save();
    return res.status(201).json(chatSession);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const getSessionMessages = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const session = await ChatSession.findOne({ _id: id, workspaceId: req.workspaceId });
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const messages = await ChatMessage.find({ chatSessionId: id })
      .sort({ createdAt: 1 })
      .lean();
    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const deleteSession = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const session = await ChatSession.findOneAndDelete({ _id: id, workspaceId: req.workspaceId });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    
    await ChatMessage.deleteMany({ chatSessionId: id });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};

export const renameSession = async (req: Request | any, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const session = await ChatSession.findOneAndUpdate(
      { _id: id, workspaceId: req.workspaceId },
      { title },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    return res.json(session);
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};
